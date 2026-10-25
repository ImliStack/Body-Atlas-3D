// Completes the female reference skeleton.
//
// The HRA female set models the spine, pelvis and legs but has no skull, ribcage, shoulder
// girdle, arms or feet. This script copies those bones from the male BodyParts3D skeleton and
// fits each region to landmarks the female body does have:
//
//   head      uniform scale about the brain, centred on the female brain
//   thorax    per-axis map from the thoracic spine (height) and the lungs (width, depth)
//   arms      rigid swing at the shoulder into the female A-pose, read off the skin outline
//   feet      attached to the bottom of each female tibia, soles on the floor
//
// Grafted parts are tagged `graft: 'bp3d-male'` and live in their own chunk, so the script can be
// re-run: it drops any earlier graft before adding a fresh one.
//
//   node scripts/build-female-skeleton.mjs

import { writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'
import { MODELS, loadAtlas, geometry, partsOf, boundsOf, centre, size } from './atlas-io.mjs'

const GRAFT = 'bp3d-male'
const M = loadAtlas('atlas.json')
const F = loadAtlas('atlas-female.json')

// ── Drop an earlier graft ──
const graftChunks = new Set(F.atlas.parts.filter((p) => p.graft === GRAFT).map((p) => p.chunk))
F.atlas.parts = F.atlas.parts.filter((p) => p.graft !== GRAFT)
F.atlas.concepts = F.atlas.concepts
  .map((c) => (c.graft === GRAFT ? null : { ...c, elements: c.elements.filter((e) => !e.startsWith('G_')) }))
  .filter(Boolean)
F.atlas.chunks = F.atlas.chunks.filter((_, i) => !graftChunks.has(i))
F.byId = new Map(F.atlas.parts.map((p) => [p.id, p]))

// ── Landmarks ──
const fIds = (test) => F.atlas.parts.filter(test).map((p) => p.id)
const fNamed = (re) => fIds((p) => re.test(p.name))
const mBox = (name) => boundsOf(M, partsOf(M, name))
const fBox = (ids) => boundsOf(F, ids)

const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth']
const mT = (i) => centre(mBox(`${ORD[i - 1]} thoracic vertebra`))
const fT = (i) => centre(fBox(fNamed(new RegExp(`^thoracic vertebra ${i}$`))))

const lungIds = (side) => fIds((p) => p.system === 'respiratory' && new RegExp(`^${side}.*(bronchopulmonary segment|hilus)`, 'i').test(p.name))
const fLungs = fBox([...lungIds('left'), ...lungIds('right')])
const mLungs = boundsOf(M, [...partsOf(M, 'left lung'), ...partsOf(M, 'right lung')])

const fBrain = fBox(fIds((p) => p.system === 'nervous' && p.id.startsWith('Allen')))
const mBrain = mBox('brain')
const fSkin = fNamed(/^skin of body$/).map((id) => geometry(F, F.byId.get(id)).positions)

// ── Transforms: each is (point) => point, plus a matching normal transform ──
const lerpMap = ([a0, b0], [a1, b1]) => { const s = (b1 - a1) / (b0 - a0); return [s, a1 - s * a0] }

function perAxis(scale, offset) {
  return {
    point: (p) => p.map((v, i) => scale[i] * v + offset[i]),
    normal: (n) => n.map((v, i) => v / scale[i]),
  }
}

// Head: the female head differs from the male one in ways a single scale can't absorb — the eyes
// are set wider, the vault is lower above them and the head is held tipped forward. So the skull
// map (a scale per axis, a nod about the x axis and an offset) is solved for, scoring:
//   brain inside the vault  every direction from the brain centre clears the brain by 4 mm
//   eyes in the orbits      male eyeball centres land on the female ones
//   on the spine            the male atlas (C1) lands on the female one
//   under the scalp         the vault stays 3 mm inside the skin
const eye = (A, name) => centre(boundsOf(A, partsOf(A, name)))
const mEyeL = eye(M, 'left eyeball')
const mEyeR = [-mEyeL[0], mEyeL[1], mEyeL[2]] // the male "right eyeball" group also holds the left one
const fEyeL = eye(F, 'eye l'), fEyeR = eye(F, 'eye r')
const mAtlas = centre(mBox('atlas')), fAtlas = centre(fBox(fNamed(/^vertebral bone 1$/)))
const mBrainC = centre(mBrain), brainC = centre(fBrain)

const dirBin = (v) => {
  const r = Math.hypot(...v)
  const el = Math.asin(v[1] / r), az = Math.atan2(v[0], v[2])
  if (el < -0.25) return [-1, r, el] // below: the brainstem leaves through the skull base
  return [Math.floor((el + 0.25) / 0.12) * 64 + Math.floor((az + Math.PI) / 0.1), r, el]
}
const radii = (pointsList, map = (p) => p, step = 1) => {
  const out = new Map()
  for (const pts of pointsList) for (let i = 0; i < pts.length; i += 3 * step) {
    const q = map([pts[i], pts[i + 1], pts[i + 2]])
    const [bin, r] = dirBin([q[0] - brainC[0], q[1] - brainC[1], q[2] - brainC[2]])
    if (bin >= 0) out.set(bin, Math.max(out.get(bin) ?? 0, r))
  }
  return out
}
const brainR = radii(fIds((p) => p.system === 'nervous' && p.id.startsWith('Allen')).map((id) => geometry(F, F.byId.get(id)).positions))
const skinR = radii(fSkin)
const vault = new Set([...brainR.keys()].filter((bin) => Math.floor(bin / 64) * 0.12 - 0.25 > 0.5))
const skullPts = partsOf(M, 'skull').map((id) => geometry(M, M.byId.get(id)).positions)

// x = [sx, sy, sz, pitch, ty, tz]
const headMap = ([sx, sy, sz, pitch, ty, tz]) => {
  const c = Math.cos(pitch), s = Math.sin(pitch)
  const point = (p) => {
    const x = sx * (p[0] - mBrainC[0]), y = sy * (p[1] - mBrainC[1]), z = sz * (p[2] - mBrainC[2])
    return [brainC[0] + x, brainC[1] + ty + s * z + c * y, brainC[2] + tz + c * z - s * y]
  }
  const normal = (n) => {
    const x = n[0] / sx, y = n[1] / sy, z = n[2] / sz
    return [x, s * z + c * y, c * z - s * y]
  }
  return { point, normal }
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
function headCost(x) {
  const h = headMap(x)
  const skull = radii(skullPts, h.point, 4)
  let inside = 0, scalp = 0
  for (const [bin, r] of brainR) { const k = skull.get(bin); if (k) inside += Math.max(0, r - (k - 0.004)) }
  for (const bin of vault) { const k = skull.get(bin), sk = skinR.get(bin); if (k && sk) scalp += Math.max(0, k - (sk - 0.003)) }
  const eyes = dist(h.point(mEyeL), fEyeL) + dist(h.point(mEyeR), fEyeR)
  const spine = dist(h.point(mAtlas), fAtlas)
  const spread = Math.max(x[0], x[1], x[2]) - Math.min(x[0], x[1], x[2])
  return (40 * inside + 40 * scalp) / brainR.size + eyes + 0.5 * spine + 0.05 * spread
}
// Coordinate descent from "scale by brain size", halving the steps when nothing improves.
const r0 = size(fBrain).map((v, i) => v / size(mBrain)[i])
let headX = [r0[0], r0[1], r0[2], 0, 0, 0]
let best = headCost(headX)
const steps = [0.04, 0.04, 0.04, 0.05, 0.01, 0.01]
for (let round = 0; round < 7; round++) {
  let improved = true
  while (improved) {
    improved = false
    for (let i = 0; i < headX.length; i++) for (const dir of [1, -1]) {
      const t = headX.slice(); t[i] += dir * steps[i]
      const c = headCost(t)
      if (c < best) { best = c; headX = t; improved = true }
    }
  }
  for (let i = 0; i < steps.length; i++) steps[i] /= 2
}
const head = headMap(headX)
const hReport = (() => {
  const h = head, skull = radii(skullPts, h.point, 1)
  let out = 0
  for (const [bin, r] of brainR) { const k = skull.get(bin); if (k && r > k - 0.004) out++ }
  return `brain clear in ${(100 - (100 * out) / brainR.size).toFixed(1)}% of directions, eye error ${((dist(h.point(mEyeL), fEyeL) + dist(h.point(mEyeR), fEyeR)) * 500).toFixed(1)} mm, atlas error ${(dist(h.point(mAtlas), fAtlas) * 1000).toFixed(1)} mm`
})()

// Thorax: height from T1–T12, depth from spine to the front of the lungs, width from the lungs.
const [sy, oy] = lerpMap([mT(12)[1], mT(1)[1]], [fT(12)[1], fT(1)[1]])
const [sz, oz] = lerpMap([mT(6)[2], mLungs[1][2]], [fT(6)[2], fLungs[1][2]])
const sx = size(fLungs)[0] / size(mLungs)[0]
const ox = fT(6)[0] - sx * mT(6)[0]
const thorax = perAxis([sx, sy, sz], [ox, oy, oz])

// Arms: the female arm centre-line from gaps in the skin outline (torso | gap | arm).
function armLine(side) {
  const pts = []
  for (let y = 1.1; y >= 0.74; y -= 0.04) {
    const xs = []
    for (const p of fSkin) for (let i = 0; i < p.length; i += 3)
      if (Math.abs(p[i + 1] - y) < 0.005 && Math.sign(p[i]) === side) xs.push(Math.abs(p[i]))
    xs.sort((a, b) => a - b)
    let gap = -1
    for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > 0.02) gap = i
    if (gap > 0) pts.push([side * (xs[gap] + xs.at(-1)) / 2, y])
  }
  return pts
}

const sub = (a, b) => a.map((v, i) => v - b[i])
const add = (a, b) => a.map((v, i) => v + b[i])
const scl = (a, s) => a.map((v) => v * s)
const len = (a) => Math.hypot(...a)
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0)
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/** Rotation taking unit vector a onto unit vector b (Rodrigues). */
function rotationBetween(a, b) {
  const v = cross(a, b), c = dot(a, b), k = 1 / (1 + c)
  return [
    [v[0] * v[0] * k + c, v[0] * v[1] * k - v[2], v[0] * v[2] * k + v[1]],
    [v[1] * v[0] * k + v[2], v[1] * v[1] * k + c, v[1] * v[2] * k - v[0]],
    [v[2] * v[0] * k - v[1], v[2] * v[1] * k + v[0], v[2] * v[2] * k + c],
  ]
}
const apply = (R, p) => R.map((row) => dot(row, p))

function arm(side) {
  const s = side > 0 ? 'left' : 'right' // anatomical left is +x
  const hum = mBox(`${s} humerus`)
  // Shoulder pivot: top of the humeral head. Wrist: bottom of the radius.
  const shoulderM = [side > 0 ? hum[0][0] + 0.03 : hum[1][0] - 0.03, hum[1][1] - 0.02, centre(hum)[2]]
  const rad = mBox(`${s} radius`)
  const wristM = [centre(rad)[0], rad[0][1], centre(rad)[2]]
  const shoulderF = thorax.point(shoulderM)
  const line = armLine(side)
  // Female wrist: where the centre-line reaches the male arm's length from the shoulder.
  const reach = len(sub(wristM, shoulderM)) * sy
  let wristF = null
  for (const [x, y] of line) {
    const p = [x, y, shoulderF[2]]
    if (len(sub(p, shoulderF)) >= reach) { wristF = p; break }
  }
  wristF ??= [...line.at(-1), shoulderF[2]]
  const a = sub(wristM, shoulderM), b = sub(wristF, shoulderF)
  const R = rotationBetween(scl(a, 1 / len(a)), scl(b, 1 / len(b)))
  const k = len(b) / len(a)
  return {
    point: (p) => add(shoulderF, scl(apply(R, sub(p, shoulderM)), k)),
    normal: (n) => apply(R, n),
    info: { shoulderF, wristF, k, deg: (Math.acos(Math.min(1, dot(a, b) / len(a) / len(b))) * 180) / Math.PI },
  }
}
const arms = { 1: arm(1), [-1]: arm(-1) }

// Feet: male foot bones keep their size, moved so the ankle sits under the female tibia.
function foot(side) {
  const s = side > 0 ? 'left' : 'right'
  const mt = mBox(`${s} tibia`), ft = fBox(fNamed(new RegExp(`^${s} tibia$`, 'i')))
  const off = [centre(ft)[0] - centre(mt)[0], ft[0][1] - mt[0][1], ft[0][2] - mt[0][2] + 0.01]
  return perAxis([1, 1, 1], off)
}
const feet = { 1: foot(1), [-1]: foot(-1) }

// ── Which male bones go where ──
const exclude = new Set([
  'vertebral column', 'vertebra', 'intervertebral disk', 'sacrum', 'coccyx', 'hip bone', 'pelvis',
  'femur', 'tibia', 'fibula', 'patella',
].flatMap((n) => partsOf(M, n)))
const thoraxIds = new Set(['rib cage', 'sternum', 'costal cartilage', 'clavicle', 'scapula'].flatMap((n) => partsOf(M, n)))
const headIds = new Set(['skull', 'mandible', 'hyoid bone'].flatMap((n) => partsOf(M, n)))

const region = (p) => {
  if (exclude.has(p.id)) return null
  if (thoraxIds.has(p.id)) return thorax
  const [x, y] = centre(p.bounds)
  if (headIds.has(p.id) || (y > 1.47 && Math.abs(x) < 0.1)) return head
  if (y < 0.13) return feet[Math.sign(x) || 1]
  if (Math.abs(x) > 0.13 && y > 0.6 && y < 1.45) return arms[Math.sign(x)]
  return null
}

const picked = []
const skipped = []
for (const p of M.atlas.parts) {
  if (p.system !== 'skeletal' && !thoraxIds.has(p.id)) continue
  const t = region(p)
  t ? picked.push([p, t]) : skipped.push(p)
}

// ── Soft tissue: muscles, vessels, nerves, glands ──
// The female set has organs but almost no muscles, a few vessels and no peripheral nerves. These
// come from the male body too, carried along by the bones around them, like skinning: every male
// bone has a male → female map (the grafted ones above, and a box fit onto the female bone for the
// spine, pelvis and legs the female set already has). Each soft-tissue vertex follows a blend of
// its nearest bones, weighted by distance, so muscles stretch across joints instead of tearing.
/** Map a male bone box onto a female one: centres aligned, per-axis scale clamped to ±25 %. */
function boxMap(m, f) {
  const mc = centre(m), fc = centre(f), ms = size(m), fs = size(f)
  const k = ms.map((v, i) => Math.min(1.25, Math.max(0.8, fs[i] / (v || 1))))
  return perAxis(k, fc.map((v, i) => v - k[i] * mc[i]))
}
const native = []
const pairBone = (mName, fIdsList) => {
  const m = partsOf(M, mName)
  if (!m.length || !fIdsList.length) return
  native.push([m, boxMap(boundsOf(M, m), fBox(fIdsList))])
}
const CERV = ['atlas', 'axis', 'third cervical vertebra', 'fourth cervical vertebra', 'fifth cervical vertebra', 'sixth cervical vertebra', 'seventh cervical vertebra']
CERV.forEach((n, i) => pairBone(n, fNamed(new RegExp(i < 2 ? `^vertebral bone ${i + 1}$` : `^mammalian cervical vertebra ${i + 1}$`))))
for (let i = 1; i <= 12; i++) pairBone(`${ORD[i - 1]} thoracic vertebra`, fNamed(new RegExp(`^thoracic vertebra ${i}$`)))
for (let i = 1; i <= 5; i++) pairBone(`${ORD[i - 1]} lumbar vertebra`, fNamed(new RegExp(`^lumbar vertebra ${i}$`)))
pairBone('sacrum', fNamed(/^fused sacrum$/))
for (const [side, S] of [['left', 'L'], ['right', 'R']]) {
  pairBone(`${side} hip bone`, fIds((p) => new RegExp(`^VH_F_(ilium|ischium|pubis)_compact_bone_${S}$`).test(p.id)))
  for (const b of ['femur', 'tibia', 'fibula', 'patella']) pairBone(`${side} ${b}`, fNamed(new RegExp(`^${side} ${b}$`, 'i')))
}

// Handles: sample points on each male bone, tagged with that bone's map.
const handles = [...picked.map(([p, t]) => [[p.id], t]), ...native]
const CELL = 0.03
const grid = new Map()
const cellKey = (x, y, z) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`
handles.forEach(([ids], h) => {
  for (const id of ids) {
    const pos = geometry(M, M.byId.get(id)).positions
    const step = Math.max(1, Math.round(pos.length / 3 / 120)) * 3
    for (let i = 0; i < pos.length; i += step) {
      const k = cellKey(pos[i], pos[i + 1], pos[i + 2])
      if (!grid.has(k)) grid.set(k, [])
      grid.get(k).push(pos[i], pos[i + 1], pos[i + 2], h)
    }
  }
})
const FALL = 0.03 // bones up to 3 cm further than the nearest one still pull
/** Weights of the bones near a point: [[handle, weight]…], summing to 1. */
function weightsAt(x, y, z) {
  const best = new Map()
  for (let r = 1; r <= 6 && !best.size; r++) {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL)
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
      const list = grid.get(`${cx + i},${cy + j},${cz + k}`)
      if (!list) continue
      for (let n = 0; n < list.length; n += 4) {
        const d = Math.hypot(list[n] - x, list[n + 1] - y, list[n + 2] - z)
        const h = list[n + 3]
        if (!(best.get(h) <= d)) best.set(h, d)
      }
    }
  }
  let dmin = Infinity
  for (const d of best.values()) dmin = Math.min(dmin, d)
  const out = []
  let sum = 0
  for (const [h, d] of best) {
    if (d > dmin + FALL) continue
    const w = (1 - (d - dmin) / FALL) ** 2 / (d + 0.005)
    out.push([h, w]); sum += w
  }
  for (const o of out) o[1] /= sum
  return out
}
function skinned(p) {
  const w = weightsAt(p[0], p[1], p[2])
  const q = [0, 0, 0]
  for (const [h, k] of w) { const t = handles[h][1].point(p); q[0] += k * t[0]; q[1] += k * t[1]; q[2] += k * t[2] }
  return [q, w]
}
const skinnedNormal = (n, w) => {
  const o = [0, 0, 0]
  for (const [h, k] of w) { const t = handles[h][1].normal(n); o[0] += k * t[0]; o[1] += k * t[1]; o[2] += k * t[2] }
  return o
}

// Which male soft tissue to bring over: what the female set lacks, nothing male-only, nothing it already has.
const femaleNames = new Set(F.atlas.parts.map((p) => p.name.toLowerCase()))
const brainIds = new Set([...partsOf(M, 'brain'), ...partsOf(M, 'spinal cord')])
const MALE_ONLY = /testi|scrot|penis|penile|prostat|spermatic|deferent|epididym|seminal|cremaster|dartos|bulbourethral|ejaculat|urethra/i
const IN_HEART = /coronary|cardiac vein|coronary sinus|interventricular|conus branch|ventricular branch|atrial branch|of left atrium|sinoatrial|atrioventricular|papillary|chordae|trabecul/i
const KIDNEY = /(^|\s)renal|interlobar|arcuate|kidney/i
const EXTRA = {
  digestive: /^(esophagus|stomach|tongue|(left|right) (sublingual|submandibular) gland)$/i,
  respiratory: /nasal|pharyn|stylopharyngeus/i,
  sensory: /lacrimal (gland|sac|canaliculus|lake)|nasolacrimal|external ear|tarsal plate|tendinous ring/i,
}
const SOFT = new Set(['muscular', 'arterial', 'venous', 'nervous', 'connective', 'endocrine'])
// Skeletal-system parts the bone graft passed over that aren't female bones: disks, a few muscles.
const nativeIds = new Set(native.flatMap(([ids]) => ids))
const leftover = new Set(skipped.filter((p) => !nativeIds.has(p.id)).map((p) => p.id))
const softPicked = M.atlas.parts.filter((p) => {
  if (!(SOFT.has(p.system) || EXTRA[p.system]?.test(p.name) || leftover.has(p.id))) return false
  if (MALE_ONLY.test(p.name) || IN_HEART.test(p.name) || femaleNames.has(p.name.toLowerCase())) return false
  if (p.system === 'nervous' && brainIds.has(p.id)) return false
  if ((p.system === 'arterial' || p.system === 'venous') && KIDNEY.test(p.name)) return false
  return true
})

// ── Write the grafted parts into new chunks (about 8 MB each before gzip) ──
const newParts = []
let blobs = [], offset = 0
const pad4 = () => { const r = offset % 4; if (r) { blobs.push(Buffer.alloc(4 - r)); offset += 4 - r } }
const written = []
function flush() {
  if (!offset) return
  const bin = Buffer.concat(blobs)
  const gz = gzipSync(bin, { level: 9 })
  const name = `female-${F.atlas.chunks.length}.bin`
  writeFileSync(join(MODELS, `${name}.gz`), gz)
  F.atlas.chunks.push({ url: `/models/${name}`, bytes: bin.byteLength, gzip: `/models/${name}.gz`, gzipBytes: gz.byteLength })
  written.push(`${name}.gz ${(gz.byteLength / 1e6).toFixed(2)} MB`)
  blobs = []; offset = 0
}
/** Map one male part through `map(position) → [position, normalMap]` and append it to the current chunk. */
function graft(p, map) {
  const g = geometry(M, p)
  const pos = new Float32Array(g.positions.length)
  const nor = new Int16Array(g.normals.length)
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < pos.length; i += 3) {
    const [q, nmap] = map([g.positions[i], g.positions[i + 1], g.positions[i + 2]])
    const n = nmap([g.normals[i] / 32767, g.normals[i + 1] / 32767, g.normals[i + 2] / 32767])
    const l = Math.hypot(...n) || 1
    for (let j = 0; j < 3; j++) {
      pos[i + j] = q[j]
      nor[i + j] = Math.round((n[j] / l) * 32767)
      mn[j] = Math.min(mn[j], q[j]); mx[j] = Math.max(mx[j], q[j])
    }
  }
  const part = { ...p, id: `G_${p.id}`, graft: GRAFT, chunk: F.atlas.chunks.length, bounds: [mn, mx] }
  part.positions = offset; blobs.push(Buffer.from(pos.buffer)); offset += pos.byteLength; pad4()
  part.normals = offset; blobs.push(Buffer.from(nor.buffer)); offset += nor.byteLength; pad4()
  part.indices = offset; blobs.push(Buffer.from(new Uint32Array(g.indices).buffer)); offset += g.indices.byteLength; pad4()
  newParts.push(part)
  if (offset > 8e6) flush()
}
for (const [p, t] of picked) graft(p, (q) => [t.point(q), t.normal])
flush()
const boneCount = newParts.length
for (const p of softPicked) graft(p, (q) => { const [r, w] = skinned(q); return [r, (n) => skinnedNormal(n, w)] })
flush()

// ── Manifest: parts, and male groupings ("skull", "aorta", "rib cage"…) for the grafted parts ──
const renamed = new Map(newParts.map((p) => [p.id.slice(2), p.id]))
const byName = new Map(F.atlas.concepts.map((c) => [c.name.toLowerCase(), c]))
for (const c of M.atlas.concepts) {
  const els = c.elements.filter((e) => renamed.has(e)).map((e) => renamed.get(e))
  if (!els.length) continue
  const existing = byName.get(c.name.toLowerCase())
  if (existing) existing.elements.push(...els)
  else F.atlas.concepts.push({ id: c.id, name: c.name, elements: els, graft: GRAFT })
}
F.atlas.parts.push(...newParts)
F.atlas.triangles = F.atlas.parts.reduce((s, p) => s + p.indexCount / 3, 0)
F.atlas.scope = 'Human Reference Atlas female organs; skull, ribcage, shoulder girdle, arm and foot bones, muscles, vessels, nerves and glands fitted from BodyParts3D 4.0'
writeFileSync(join(MODELS, 'atlas-female.json'), JSON.stringify(F.atlas))

// ── Report ──
const f3 = (v) => v.map((x) => x.toFixed(3)).join(', ')
console.log(`grafted ${boneCount} bones and ${newParts.length - boneCount} soft-tissue parts → ${written.join(', ')}`)
const bySys = {}
for (const p of newParts.slice(boneCount)) bySys[p.system] = (bySys[p.system] ?? 0) + 1
console.log('soft tissue by system', bySys)
console.log(`head ×(${f3(headX.slice(0, 3))}) nod ${(headX[3] * 180 / Math.PI).toFixed(1)}° — ${hReport}`)
console.log(`thorax ×(${f3([sx, sy, sz])})`)
for (const s of [1, -1]) console.log(`arm ${s > 0 ? 'L' : 'R'}: swing ${arms[s].info.deg.toFixed(1)}°, ×${arms[s].info.k.toFixed(3)}, shoulder ${f3(arms[s].info.shoulderF)}, wrist ${f3(arms[s].info.wristF)}`)
console.log(`left to the female bones ${nativeIds.size}, skinned with the soft tissue ${leftover.size}`)
