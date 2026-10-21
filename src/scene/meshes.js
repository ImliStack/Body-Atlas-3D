import * as THREE from 'three'
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh'
import { SYSTEMS } from '../data.js'
import { fx, stepValues } from './fx.js'

// Layer 0: rendered + pickable. Layer 1: hidden. Layer 2: rendered context the
// raycaster ignores (the body behind an open organ). The camera renders 0 and 2.
export const LAYER = { pick: 0, hidden: 1, context: 2 }

// BVH raycasting keeps hover labels cheap on 2.29M triangles. Meshes without a
// tree yet fall back to the plain raycast, so trees can be built after load.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
THREE.Mesh.prototype.raycast = acceleratedRaycast

// One mesh per BodyParts3D structure, kept outside React so 2,234 objects
// never pass through reconciliation. Body.jsx mutates them in place.
export const root = new THREE.Group()
export const meshes = new Map() // partId -> THREE.Mesh

const solid = {}
const ghost = {}
const glow = {}
const xray = {}
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
    color, roughness: 0.7, transparent: true, depthWrite: false, opacity: s.id === 'skeletal' ? 0.5 : 0.26,
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

function buildPart(buffer, p) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buffer, p.positions, p.vertexCount * 3), 3))
  g.setAttribute('normal', new THREE.BufferAttribute(new Int16Array(buffer, p.normals, p.vertexCount * 3), 3, true))
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer, p.indices, p.indexCount), 1))
  g.computeBoundingSphere()
  const m = new THREE.Mesh(g, solid[p.system])
  m.userData.partId = p.id
  m.userData.system = p.system
  m.matrixAutoUpdate = false
  return m
}

export async function loadModel(atlas, { onChunk, signal }) {
  const byChunk = atlas.chunks.map(() => [])
  for (const p of atlas.parts) byChunk[p.chunk].push(p)
  let next = 0
  let done = 0
  const worker = async () => {
    while (next < atlas.chunks.length) {
      const ci = next++
      const buffer = await fetchChunk(atlas.chunks[ci], signal)
      for (const p of byChunk[ci]) {
        if (meshes.has(p.id)) continue
        const m = buildPart(buffer, p)
        meshes.set(p.id, m)
        root.add(m)
      }
      onChunk(++done / atlas.chunks.length)
    }
  }
  await Promise.all([worker(), worker(), worker()])
}

/** Build BVH trees in idle time after load, a few meshes per slice, so the first frames stay smooth. */
export function buildBoundsTrees() {
  const queue = [...meshes.values()].filter((m) => !m.geometry.boundsTree)
  const idle = window.requestIdleCallback ?? ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 16))
  const step = (deadline) => {
    while (queue.length && deadline.timeRemaining() > 2) queue.pop().geometry.computeBoundsTree()
    if (queue.length) idle(step)
  }
  idle(step)
}

/** Ease the shared material values (ghost fade, press flash, organ dissolve). */
export function stepFx(dt) {
  stepValues(dt)
  for (const m of Object.values(ghost)) m.opacity = fx.ghost
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
}

/** Apply visibility + material for the current UI state. */
export function applyState({ visible, selection, isolate, xray: xrayOn }) {
  const selected = selection ? new Set(selection.partIds) : null
  const organMode = selection?.kind === 'organ'
  for (const [id, m] of meshes) {
    const sys = m.userData.system
    const isSel = selected?.has(id)
    let show
    let mat
    if (!selected) {
      show = visible.has(sys)
      mat = xrayOn ? xray[sys] : solid[sys]
    } else if (isSel) {
      show = true
      mat = glow[sys]
    } else {
      show = !isolate && visible.has(sys)
      mat = ghost[sys]
    }
    m.visible = show
    // Hidden meshes leave layer 0 so the raycaster skips them entirely.
    m.layers.set(!show ? LAYER.hidden : organMode ? LAYER.context : LAYER.pick)
    m.material = mat
    // Ghosts render after solids so they never hide the selection.
    m.userData.ghost = mat === ghost[sys]
    m.renderOrder = m.userData.ghost ? 2 : mat === xray[sys] ? 1 : 0
  }
}
