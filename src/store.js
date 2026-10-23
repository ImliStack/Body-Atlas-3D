import { create } from 'zustand'
import { DEFAULT_VISIBLE, FEATURED, QUIZ, pretty, regionIdOf } from './data.js'
import { ORGANS } from './organs.js'
import { MOTION, ms } from './motion.js'
import { fx, press, clear } from './scene/fx.js'
import { loadOrgan } from './scene/organLoader.js'

// Lookup tables built once the manifest arrives.
export const index = {
  parts: new Map(), // partId -> part
  concepts: new Map(), // lower-case name -> concept
  partConcepts: new Map(), // partId -> concepts containing it, smallest first
  partOrgan: new Map(), // partId -> organ key with a detail model
  partRegion: new Map(), // partId -> 'head' | 'trunk' | 'upper' | 'lower'
  regionParts: new Map(), // region id -> partIds
  searchList: [], // { label, kind, key, size }
}

// Timeline steps for the current interaction; a new interaction cancels the old one.
let timers = []
function schedule(steps) {
  timers.forEach(clearTimeout)
  timers = steps.map(([seconds, fn]) => setTimeout(fn, ms(seconds)))
}

export const organOfPart = (id) => index.partOrgan.get(id)

export function buildIndex(atlas) {
  if (index.parts.size) return
  for (const p of atlas.parts) {
    index.parts.set(p.id, p)
    const r = regionIdOf(p.bounds)
    index.partRegion.set(p.id, r)
    if (!index.regionParts.has(r)) index.regionParts.set(r, [])
    index.regionParts.get(r).push(p.id)
  }
  for (const c of atlas.concepts) {
    index.concepts.set(c.name.toLowerCase(), c)
    for (const el of c.elements) {
      if (!index.partConcepts.has(el)) index.partConcepts.set(el, [])
      index.partConcepts.get(el).push(c)
    }
  }
  for (const list of index.partConcepts.values()) list.sort((a, b) => a.elements.length - b.elements.length)
  // ORGANS is ordered from small to large, so a shared mesh goes to the more specific organ.
  for (const [key, organ] of Object.entries(ORGANS))
    for (const id of partsOfConcepts(organ.concepts)) if (!index.partOrgan.has(id)) index.partOrgan.set(id, key)

  const seen = new Set()
  for (const c of atlas.concepts) {
    const key = c.name.toLowerCase()
    if (seen.has(key) || !c.elements.some((e) => index.parts.has(e))) continue
    seen.add(key)
    index.searchList.push({ label: pretty(c.name), kind: 'concept', key, size: c.elements.length })
  }
  for (const p of atlas.parts) {
    const key = p.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    index.searchList.push({ label: p.name, kind: 'part', key: p.id, size: 1 })
  }
}

export function search(query, limit = 8) {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const hits = []
  for (const item of index.searchList) {
    const at = item.label.toLowerCase().indexOf(q)
    if (at >= 0) hits.push([at === 0 ? 0 : 1, item.label.length, item])
  }
  hits.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  return hits.slice(0, limit).map((h) => h[2])
}

export function partsOfConcepts(names) {
  const ids = new Set()
  for (const n of names) {
    const c = index.concepts.get(n.toLowerCase())
    if (c) for (const e of c.elements) if (index.parts.has(e)) ids.add(e)
  }
  return [...ids]
}

const shuffle = (list) => {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Read a JSON preference; private windows and blocked storage fall back to the default. */
function stored(key, fallback, ok = () => true) {
  try {
    const v = JSON.parse(localStorage.getItem(key))
    if (v != null && ok(v)) return v
  } catch {}
  return fallback
}
function keep(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

// Labels pinned the first time the label tool is switched on with nothing pinned yet.
const DEFAULT_PINS = ['skull', 'heart', 'right lung', 'liver', 'stomach', 'right kidney', 'urinary bladder', 'femur']
  .map((name) => ({ key: `concept:${name}`, kind: 'concept', ref: name, label: pretty(name) }))

/** Parts a pinned label points at. */
export function pinParts(pin) {
  if (pin.kind === 'part') return index.parts.has(pin.ref) ? [pin.ref] : []
  if (pin.kind === 'featured') return partsOfConcepts(FEATURED.find((f) => f.key === pin.ref)?.concepts ?? [])
  return partsOfConcepts([pin.ref])
}

function pinOf(sel) {
  if (sel.kind === 'part') return { key: `part:${sel.partIds[0]}`, kind: 'part', ref: sel.partIds[0], label: sel.name }
  if (sel.kind === 'featured') return { key: `featured:${sel.featured.key}`, kind: 'featured', ref: sel.featured.key, label: sel.name }
  return { key: `concept:${sel.name.toLowerCase()}`, kind: 'concept', ref: sel.name.toLowerCase(), label: sel.name }
}

function storedTheme() {
  try {
    const t = localStorage.getItem('atlas-theme')
    if (t === 'light' || t === 'dark') return t
  } catch {}
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Leave whatever was selected: cancel pending steps and bring the body back to solid. */
function release() {
  schedule([])
  fx.glowTarget = 1
}

/** Shared event for every selection: press, clear the stage, then fly. */
function focusOn(set, get, selection, extra = {}) {
  press()
  clear(!get().selection)
  set({ selection, focusSystem: null, structureId: null, organPhase: null, hover: null, revealAt: MOTION.reveal.at, ...extra })
  schedule([[MOTION.fly.at, () => get().cameraCommand('selection')]])
}

export const useAtlas = create((set, get) => ({
  status: 'loading',
  progress: 0,
  error: null,
  ready: false,

  visible: new Set(DEFAULT_VISIBLE),
  focusSystem: null,
  // { kind: 'part' | 'concept' | 'featured' | 'organ', name, partIds, system, featured?, organKey? }
  selection: null,
  // Organ deep-dive: 'enter' (flying) → 'detail' (model shown) → 'exit' (returning)
  organPhase: null,
  structureId: null,
  organError: null,
  revealAt: MOTION.reveal.quick, // when the panel text starts arriving (s)
  isolate: false,
  // Body region filter: null or 'head' | 'trunk' | 'upper' | 'lower'
  region: null,
  explode: false,
  explodeAmount: 0.6,
  pins: stored('atlas-pins', [], Array.isArray),
  showPins: true,
  layerOpacity: {}, // systemId -> 0..1, missing = 1
  opacityOpen: false,
  // Side panels: folded or open, remembered per browser.
  panels: stored('atlas-panels', { left: true, right: true }, (v) => typeof v.left === 'boolean'),
  // Ambient occlusion; off by default on phones.
  hq: stored('atlas-hq', typeof matchMedia === 'undefined' || !matchMedia('(pointer: coarse)').matches),
  autoRotate: true,
  light: 'soft',
  xray: false,
  theme: storedTheme(),
  help: false,
  // Hovered body structure for the cursor label: { id, x, y } in client pixels.
  hover: null,
  // "Find the …" quiz: { rounds, i, score, misses, state: 'ask' | 'right' | 'wrong' | 'reveal' | 'done', picked }
  quiz: null,
  snap: 0,
  sceneVersion: 0,
  camera: { type: 'home', n: 0 },

  setProgress: (progress) => set({ progress }),
  setReady: () => set({ status: 'ready', ready: true }),
  setError: (error) => set({ status: 'error', error }),
  bumpScene: () => set((s) => ({ sceneVersion: s.sceneVersion + 1 })),

  cameraCommand: (type, box) => set((s) => ({ camera: { type, box, n: s.camera.n + 1 } })),

  openOrgan: (key) => {
    const organ = ORGANS[key]
    const partIds = partsOfConcepts(organ.concepts)
    if (!partIds.length) return
    fx.explodeTarget = 0
    loadOrgan(key).catch(() => set({ organError: `The ${organ.title.toLowerCase()} model couldn’t load.` }))
    focusOn(set, get, { kind: 'organ', organKey: key, name: organ.title, partIds, system: organ.system },
      { organPhase: 'enter', organError: null, isolate: false, autoRotate: false, explode: false })
    schedule([
      [MOTION.fly.at, () => get().cameraCommand('selection')],
      [MOTION.lift.at, () => {
        fx.glowTarget = 0
        fx.ghostTarget = MOTION.clear.organGhost
        set({ organPhase: 'detail' })
      }],
    ])
  },

  selectStructure: (id) => set((s) => ({ structureId: s.structureId === id ? null : id })),

  toggleSystem: (id) =>
    set((s) => {
      const visible = new Set(s.visible)
      visible.has(id) ? visible.delete(id) : visible.add(id)
      return { visible }
    }),

  showSystem: (id) => {
    release()
    set((s) => {
      const visible = new Set(s.visible)
      visible.add(id)
      return { visible, focusSystem: id, region: null, selection: null, organPhase: null, structureId: null, isolate: false, quiz: null,
        revealAt: MOTION.reveal.quick, camera: { type: 'home', n: s.camera.n + 1 } }
    })
  },

  showAll: () => {
    release()
    set((s) => ({ visible: new Set(DEFAULT_VISIBLE), focusSystem: null, region: null, selection: null, organPhase: null,
      structureId: null, isolate: false, quiz: null, revealAt: MOTION.reveal.quick, camera: { type: 'home', n: s.camera.n + 1 } }))
  },

  showRegion: (id) => {
    release()
    set((s) => ({ region: s.region === id ? null : id, focusSystem: null, selection: null, organPhase: null, structureId: null,
      isolate: false, quiz: null, revealAt: MOTION.reveal.quick, camera: { type: 'home', n: s.camera.n + 1 } }))
  },

  selectPart: (id) => {
    const p = index.parts.get(id)
    if (!p) return
    focusOn(set, get, { kind: 'part', name: p.name, partIds: [id], system: p.system })
  },

  selectConcept: (name) => {
    const partIds = partsOfConcepts([name])
    if (!partIds.length) return
    const c = index.concepts.get(name.toLowerCase())
    const system = index.parts.get(partIds[0]).system
    focusOn(set, get, { kind: 'concept', name: pretty(c.name), partIds, system })
  },

  selectFeatured: (key) => {
    const f = FEATURED.find((x) => x.key === key)
    const partIds = partsOfConcepts(f.concepts)
    if (!partIds.length) return
    focusOn(set, get, { kind: 'featured', name: f.title, partIds, system: f.system, featured: f })
  },

  clearSelection: () => {
    const s = get()
    if (s.selection?.kind === 'organ' && s.organPhase !== 'exit') {
      // Reverse of the entry: the detail fades, the organ reappears in the body, then the camera pulls back.
      fx.glowTarget = 1
      fx.ghostTarget = 0.5
      set({ organPhase: 'exit', structureId: null })
      schedule([[MOTION.back.at, () => set((st) => ({ selection: null, organPhase: null, isolate: false,
        revealAt: MOTION.reveal.quick, camera: { type: 'home', n: st.camera.n + 1 } }))]])
      return
    }
    release()
    set((st) => ({ selection: null, organPhase: null, structureId: null, isolate: false,
      revealAt: MOTION.reveal.quick, camera: { type: 'home', n: st.camera.n + 1 } }))
  },

  toggleExplode: () => {
    const s = get()
    if (s.selection?.kind === 'organ') return
    const explode = !s.explode
    fx.explodeTarget = explode ? s.explodeAmount : 0
    set({ explode, autoRotate: false })
    get().cameraCommand(s.selection ? 'selection' : 'home')
  },
  setExplodeAmount: (explodeAmount) => {
    if (get().explode) fx.explodeTarget = explodeAmount
    set({ explodeAmount })
  },
  /** Re-frame after the spread slider is let go. */
  fitExplode: () => get().cameraCommand(get().selection ? 'selection' : 'home'),

  togglePin: (sel = get().selection) => {
    if (!sel || sel.kind === 'organ') return
    const pin = pinOf(sel)
    set((s) => {
      const pins = s.pins.some((p) => p.key === pin.key) ? s.pins.filter((p) => p.key !== pin.key) : [...s.pins, pin]
      keep('atlas-pins', pins)
      return { pins, showPins: true }
    })
  },
  removePin: (key) => set((s) => {
    const pins = s.pins.filter((p) => p.key !== key)
    keep('atlas-pins', pins)
    return { pins }
  }),
  clearPins: () => {
    keep('atlas-pins', [])
    set({ pins: [] })
  },
  /** The label tool: shows or hides pins; with none pinned it starts from a set of landmarks. */
  togglePins: () => set((s) => {
    if (!s.pins.length) {
      keep('atlas-pins', DEFAULT_PINS)
      return { pins: DEFAULT_PINS, showPins: true }
    }
    return { showPins: !s.showPins }
  }),

  setOpacity: (id, v) => set((s) => ({ layerOpacity: { ...s.layerOpacity, [id]: v } })),
  resetOpacity: () => set({ layerOpacity: {} }),
  toggleOpacityOpen: () => set((s) => ({ opacityOpen: !s.opacityOpen })),

  togglePanel: (side) => set((s) => {
    const panels = side === 'focus'
      ? (s.panels.left || s.panels.right ? { left: false, right: false } : { left: true, right: true })
      : { ...s.panels, [side]: !s.panels[side] }
    keep('atlas-panels', panels)
    // Re-frame once the columns have finished sliding (.28s in styles.css).
    setTimeout(() => get().cameraCommand(get().selection ? 'selection' : 'home'), 320)
    return { panels }
  }),
  toggleHq: () => set((s) => {
    keep('atlas-hq', !s.hq)
    return { hq: !s.hq }
  }),

  toggleIsolate: () => set((s) => ({ isolate: s.selection ? !s.isolate : false })),
  toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),
  toggleLight: () => set((s) => ({ light: s.light === 'soft' ? 'contrast' : 'soft' })),
  toggleXray: () => set((s) => ({ xray: !s.xray })),
  toggleTheme: () => set((s) => {
    const theme = s.theme === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem('atlas-theme', theme) } catch {}
    return { theme }
  }),
  setHelp: (help) => set({ help }),
  setHover: (hover) => set({ hover }),
  takeSnapshot: () => set((s) => ({ snap: s.snap + 1 })),
  view: (side) => {
    set({ autoRotate: false })
    get().cameraCommand(side)
  },

  startQuiz: () => {
    const rounds = shuffle(QUIZ.filter((q) => partsOfConcepts(q.concepts).length)).slice(0, 8)
    get().showAll()
    get().view('front')
    set({ quiz: { rounds, i: 0, score: 0, misses: 0, state: 'ask', picked: null }, autoRotate: false, hover: null })
  },

  /** A body click while the quiz runs: right if it lands on the asked structure. */
  answerQuiz: (partId) => {
    const q = get().quiz
    if (!q || q.state !== 'ask') return
    const round = q.rounds[q.i]
    const target = partsOfConcepts(round.concepts)
    const picked = index.parts.get(partId)?.name ?? null
    if (target.includes(partId)) {
      set({ quiz: { ...q, state: 'right', score: q.score + (q.misses ? 0.5 : 1), picked } })
      focusOn(set, get, { kind: 'concept', name: round.title, partIds: target, system: round.system })
    } else if (q.misses >= 1) {
      set({ quiz: { ...q, state: 'reveal', misses: q.misses + 1, picked } })
      focusOn(set, get, { kind: 'concept', name: round.title, partIds: target, system: round.system })
    } else {
      set({ quiz: { ...q, state: 'wrong', misses: q.misses + 1, picked } })
    }
  },

  nextQuiz: () => {
    const q = get().quiz
    if (!q) return
    release()
    const done = q.i + 1 >= q.rounds.length
    set((s) => ({
      quiz: { ...q, i: done ? q.i : q.i + 1, misses: 0, picked: null, state: done ? 'done' : 'ask' },
      selection: null, isolate: false, revealAt: MOTION.reveal.quick, camera: { type: 'home', n: s.camera.n + 1 },
    }))
  },

  endQuiz: () => {
    release()
    set((s) => ({ quiz: null, selection: null, isolate: false, camera: { type: 'home', n: s.camera.n + 1 } }))
  },
}))

export const regionBounds = (id) => selectionBounds(index.regionParts.get(id) ?? [])

export function selectionBounds(partIds) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const id of partIds) {
    const b = index.parts.get(id)?.bounds
    if (!b) continue
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], b[0][i])
      max[i] = Math.max(max[i], b[1][i])
    }
  }
  return [min, max]
}

// Handle for the README screenshot and demo scripts (scripts/readme-*.sh).
if (typeof window !== 'undefined') window.__atlas = useAtlas
