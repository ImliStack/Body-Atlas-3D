import * as THREE from 'three'
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh'
import { SYSTEMS } from '../data.js'
import { fx, stepValues } from './fx.js'

// Layer 0: rendered + pickable. Layer 1: hidden. Layer 2: rendered context the
// raycaster ignores (the body batches, and the body behind an open organ). The camera renders 0 and 2.
export const LAYER = { pick: 0, hidden: 1, context: 2 }

// BVH raycasting keeps hover labels cheap on 2.29M triangles. Meshes without a
// tree yet fall back to the plain raycast, so trees can be built after load.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
THREE.Mesh.prototype.raycast = acceleratedRaycast

// Two copies of the body, both kept outside React so 2,234 objects never pass
// through reconciliation:
//  - `batchRoot`: one BatchedMesh per system draws everything that isn't selected —
//    15 draw calls instead of ~2,200.
//  - `root`: one plain Mesh per structure. These are what the raycaster hits, and the
//    selected ones are drawn on their own with the glow material.
export const root = new THREE.Group()
export const batchRoot = new THREE.Group()
export const meshes = new Map() // partId -> THREE.Mesh
const batches = {} // systemId -> THREE.BatchedMesh
const instance = new Map() // partId -> instance id in its system's batch
const centers = new Map() // partId -> Vector3 (rest position, centre of its bounds)
let generation = 0 // bumped on every body swap, so idle work for the old body stops

const solid = {}
const ghost = {}
const glow = {}
const xray = {}
const XRAY = (id) => (id === 'skeletal' ? 0.5 : 0.26)
for (const s of SYSTEMS) {
  const color = new THREE.Color(s.color)
  solid[s.id] = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.02 })
  ghost[s.id] = new THREE.MeshStandardMaterial({
    color, roughness: 0.8, transparent: true, opacity: 0.09, depthWrite: false,
  })
  glow[s.id] = new THREE.MeshStandardMaterial({
    color, roughness: 0.45, emissive: color.clone().lerp(new THREE.Color('#ffb36b'), 0.4), emissiveIntensity: 0.35,
  })
  // Bones stay fairly solid in x-ray so the soft tissue reads against them.
  xray[s.id] = new THREE.MeshStandardMaterial({
    color, roughness: 0.7, transparent: true, depthWrite: false, opacity: XRAY(s.id),
  })
}

/** Fetch a packed chunk; static hosts may or may not add Content-Encoding for .gz. */
async function fetchChunk(chunk, signal) {
  const useGzip = !!chunk.gzip && typeof DecompressionStream !== 'undefined'
  const res = await fetch(useGzip ? chunk.gzip : chunk.url, { signal })
  if (!res.ok) throw new Error(`Could not load ${chunk.url}`)
  let buf = await res.arrayBuffer()
  const head = new Uint8Array(buf, 0, 2)
  if (useGzip && head[0] === 0x1f && head[1] === 0x8b) {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
    buf = await new Response(stream).arrayBuffer()
  }
  if (buf.byteLength !== chunk.bytes) throw new Error('A model chunk arrived incomplete — please reload.')
  return buf
}

/** One BatchedMesh per system, sized up front from the manifest. */
function createBatches(atlas) {
  const totals = {}
  for (const p of atlas.parts) {
    const t = (totals[p.system] ??= { n: 0, v: 0, i: 0 })
    t.n++
    t.v += p.vertexCount
    t.i += p.indexCount
  }
  for (const [sys, t] of Object.entries(totals)) {
    if (batches[sys] || !solid[sys]) continue
    const b = new THREE.BatchedMesh(t.n, t.v, t.i, solid[sys])
    b.sortObjects = false
    // Its own bounds are computed once, before any piece arrives; per-piece culling still runs.
    b.frustumCulled = false
    b.layers.set(LAYER.context)
    b.userData.system = sys
    batches[sys] = b
    batchRoot.add(b)
  }
}

function buildPart(buffer, p) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buffer, p.positions, p.vertexCount * 3), 3))
  g.setAttribute('normal', new THREE.BufferAttribute(new Int16Array(buffer, p.normals, p.vertexCount * 3), 3, true))
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer, p.indices, p.indexCount), 1))
  g.computeBoundingSphere()
  const m = new THREE.Mesh(g, glow[p.system])
  m.userData.partId = p.id
  m.userData.system = p.system
  m.matrixAutoUpdate = false
  m.visible = false
  const b = batches[p.system]
  if (b) instance.set(p.id, b.addInstance(b.addGeometry(g)))
  const [min, max] = p.bounds
  centers.set(p.id, new THREE.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2))
  return m
}

/** Drop the loaded body (geometry, batches, positions) so another one can be read in. */
export function resetModel() {
  generation++
  for (const m of meshes.values()) m.geometry.dispose()
  root.clear()
  meshes.clear()
  instance.clear()
  centers.clear()
  for (const [sys, b] of Object.entries(batches)) {
    b.dispose()
    delete batches[sys]
  }
  batchRoot.clear()
  explode.ids = null
  explode.dirty = true
}

export async function loadModel(atlas, { onChunk, signal }) {
  setBodyBox(atlas)
  createBatches(atlas)
  const byChunk = atlas.chunks.map(() => [])
  for (const p of atlas.parts) byChunk[p.chunk].push(p)
  let next = 0
  let done = 0
  const worker = async () => {
    while (next < atlas.chunks.length) {
      const ci = next++
      const buffer = await fetchChunk(atlas.chunks[ci], signal)
      if (signal.aborted) return // another body was asked for while this chunk was on its way
      for (const p of byChunk[ci]) {
        if (meshes.has(p.id)) continue
        const m = buildPart(buffer, p)
        meshes.set(p.id, m)
        root.add(m)
      }
      explode.dirty = true
      onChunk(++done / atlas.chunks.length)
    }
  }
  await Promise.all([worker(), worker(), worker()])
}

/** Build BVH trees in idle time after load, a few meshes per slice, so the first frames stay smooth. */
export function buildBoundsTrees() {
  const queue = [...meshes.values()].filter((m) => !m.geometry.boundsTree)
  const idle = window.requestIdleCallback ?? ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 16))
  const gen = generation
  const step = (deadline) => {
    if (gen !== generation) return
    while (queue.length && deadline.timeRemaining() > 2) queue.pop().geometry.computeBoundsTree()
    if (queue.length) idle(step)
  }
  idle(step)
}

// ───── Exploded view ─────
// Each piece slides away from a centre, keeping its own size, so gaps open between
// neighbours. Sideways and front-to-back spread more than height, which already reads well.
const SPREAD = [1.5, 0.55, 2.2]
const BODY_CENTRE = new THREE.Vector3(0, 0.95, 0)
const explode = { ids: null, origin: BODY_CENTRE.clone(), applied: -1, dirty: false }
// Half-width, half-depth and top of the framed body. These defaults fit the male body; each atlas resets them.
const body = { x: 0.32, z: 0.18, top: 1.76 }

/** Size the home box and the spread centre to an atlas's own extent. */
function setBodyBox(atlas) {
  let x = 0
  let z = 0
  let h = 0
  for (const p of atlas.parts) {
    if (!solid[p.system] || p.system === 'pregnancy') continue
    const [min, max] = p.bounds
    x = Math.max(x, -min[0], max[0])
    z = Math.max(z, -min[2], max[2])
    h = Math.max(h, max[1])
  }
  if (!h) return
  // The same margins the male defaults were tuned with.
  body.x = x * 0.96
  body.z = z * 1.22
  body.top = h * 1.02
  BODY_CENTRE.y = h * 0.55
  explode.origin.copy(BODY_CENTRE)
}

/** Which pieces spread: a multi-part selection spreads on its own, otherwise the whole body. */
export function setExplodeScope(partIds) {
  const ids = partIds && partIds.length > 1 ? new Set(partIds) : null
  const origin = ids ? centreOf(partIds) : BODY_CENTRE.clone()
  const same = (ids === null && explode.ids === null) ||
    (ids && explode.ids && ids.size === explode.ids.size && [...ids].every((id) => explode.ids.has(id)))
  if (same) return
  explode.ids = ids
  explode.origin = origin
  explode.dirty = true
}

function centreOf(partIds) {
  const c = new THREE.Vector3()
  let n = 0
  for (const id of partIds) {
    const p = centers.get(id)
    if (p) { c.add(p); n++ }
  }
  return n ? c.divideScalar(n) : BODY_CENTRE.clone()
}

/** Offset of one piece at spread `e` (0 = assembled). */
export function explodeOffset(id, e = fx.explode, out = new THREE.Vector3()) {
  const c = centers.get(id)
  if (!c || e <= 0 || (explode.ids && !explode.ids.has(id))) return out.set(0, 0, 0)
  return out.set(
    (c.x - explode.origin.x) * SPREAD[0] * e,
    (c.y - explode.origin.y) * SPREAD[1] * e,
    (c.z - explode.origin.z) * SPREAD[2] * e,
  )
}

/** Where a piece is drawn right now (rest centre + explode offset). */
export function partCentre(id, out = new THREE.Vector3()) {
  const c = centers.get(id)
  if (!c) return null
  return explodeOffset(id, fx.explode, out).add(c)
}

/** World box of some pieces at a given spread, for the camera. */
export function explodedBounds(partIds, bounds, e) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const o = new THREE.Vector3()
  for (const id of partIds) {
    const b = bounds(id)
    if (!b) continue
    explodeOffset(id, e, o)
    const d = [o.x, o.y, o.z]
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], b[0][i] + d[i])
      max[i] = Math.max(max[i], b[1][i] + d[i])
    }
  }
  return [min, max]
}

/** The body's home box, grown to fit the spread. */
export function homeBox(e) {
  const k = (i) => 1 + SPREAD[i] * e
  // Spread out, the body is about as deep as it is wide: keep the box round so any view angle fits.
  const x = e > 0 ? Math.max(body.x * k(0), body.z * k(2)) : body.x
  const z = e > 0 ? x : body.z
  const c = BODY_CENTRE.y
  return [
    [-x, c - c * k(1), -z],
    [x, c + (body.top - c) * k(1), z],
  ]
}

const offset = new THREE.Vector3()
function applyExplode() {
  if (!explode.dirty && Math.abs(fx.explode - explode.applied) < 1e-4) return false
  for (const [id, m] of meshes) {
    explodeOffset(id, fx.explode, offset)
    m.position.copy(offset)
    m.updateMatrix()
    const b = batches[m.userData.system]
    if (b) b.setMatrixAt(instance.get(id), m.matrix)
  }
  explode.applied = fx.explode
  explode.dirty = false
  return true
}

// ───── Per-system opacity ─────
const layerOpacity = {}
export function setLayerOpacity(opacity) {
  for (const s of SYSTEMS) {
    const o = opacity[s.id] ?? 1
    layerOpacity[s.id] = o
    const see = o < 0.999
    const m = solid[s.id]
    m.opacity = o
    if (m.transparent !== see) {
      m.transparent = see
      m.depthWrite = !see
      m.needsUpdate = true
    }
    xray[s.id].opacity = XRAY(s.id) * o
  }
}

/** Ease the shared material values (ghost fade, press flash, organ dissolve, spread). Returns true while moving. */
export function stepFx(dt) {
  stepValues(dt)
  for (const [id, m] of Object.entries(ghost)) m.opacity = fx.ghost * (layerOpacity[id] ?? 1)
  const dissolving = fx.glow < 0.999
  for (const m of Object.values(glow)) {
    m.emissiveIntensity = fx.flash
    m.opacity = fx.glow
    m.visible = fx.glow > 0.01
    if (m.transparent !== dissolving) {
      m.transparent = dissolving
      m.depthWrite = !dissolving
      m.needsUpdate = true
    }
  }
  return applyExplode()
}

/** Apply visibility + material for the current UI state. `inRegion(partId)` filters by body region. */
export function applyState({ visible, selection, isolate, xray: xrayOn, inRegion }) {
  const selected = selection ? new Set(selection.partIds) : null
  const organMode = selection?.kind === 'organ'
  for (const [id, m] of meshes) {
    const sys = m.userData.system
    const isSel = !!selected?.has(id)
    const shown = visible.has(sys) && (!inRegion || inRegion(id))
    const inBody = shown && !isSel && !(selected && isolate)
    // Selected pieces draw on their own (glow); everything else is drawn by its system's batch.
    m.visible = isSel
    m.material = glow[sys]
    m.userData.shown = isSel || inBody
    m.userData.ghost = !!selected && !isSel
    // Hidden meshes leave layer 0 so the raycaster skips them entirely.
    m.layers.set(organMode ? (isSel ? LAYER.context : LAYER.hidden) : m.userData.shown ? LAYER.pick : LAYER.hidden)
    const b = batches[sys]
    if (b && instance.has(id)) b.setVisibleAt(instance.get(id), inBody)
  }
  for (const [sys, b] of Object.entries(batches)) {
    b.material = selected ? ghost[sys] : xrayOn ? xray[sys] : solid[sys]
    // Ghosts and see-through layers render after solids so they never hide the selection.
    b.renderOrder = selected ? 2 : b.material.transparent ? 1 : 0
  }
}

/** True when any of these pieces is drawn solid (for pinned labels; ghosts behind a selection don't count). */
export function anyShown(partIds) {
  for (const id of partIds) {
    const d = meshes.get(id)?.userData
    if (d?.shown && !d.ghost) return true
  }
  return false
}
