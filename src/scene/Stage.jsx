import { Suspense, lazy, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import * as THREE from 'three'
import { useAtlas, buildIndex, resetIndex, organOfPart, index, pinParts } from '../store.js'
import { BODIES } from '../bodies.js'
import {
  root, batchRoot, loadModel, resetModel, applyState, stepFx, buildBoundsTrees, setLayerOpacity, setExplodeScope,
  explodedBounds, homeBox, partCentre, anyShown, LAYER,
} from './meshes.js'
import { fx } from './fx.js'
import { MOTION, REDUCED } from '../motion.js'
import OrganDetail from './OrganDetail.jsx'

// Post effects (ambient occlusion) load only when high quality is on.
const Effects = lazy(() => import('./Effects.jsx'))

// Leave room for the quick picks above and the 360° control + caption below.
const HOME_PADDING = { paddingTop: 0.16, paddingBottom: 0.42, paddingLeft: 0.1, paddingRight: 0.1 }
// On a phone the picks and the turntable cover more of a narrow stage.
const HOME_PADDING_NARROW = { paddingTop: 0.32, paddingBottom: 0.62, paddingLeft: 0.06, paddingRight: 0.06 }

function Body() {
  const body = useAtlas((s) => s.body)
  const loaded = useRef(0) // bodies loaded so far
  const sceneVersion = useAtlas((s) => s.sceneVersion)
  const visible = useAtlas((s) => s.visible)
  const selection = useAtlas((s) => s.selection)
  const isolate = useAtlas((s) => s.isolate)
  const xray = useAtlas((s) => s.xray)
  const region = useAtlas((s) => s.region)
  const layerOpacity = useAtlas((s) => s.layerOpacity)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    const abort = new AbortController()
    const { setProgress, setReady, setError, bumpScene } = useAtlas.getState()
    // A body swap starts from nothing: the old meshes and lookups go before the new manifest arrives.
    resetModel()
    resetIndex()
    bumpScene()
    ;(async () => {
      try {
        const res = await fetch(BODIES[body].atlas, { signal: abort.signal })
        if (!res.ok) throw new Error(`The ${BODIES[body].label.toLowerCase()} body couldn’t load.`)
        const atlas = await res.json()
        if (abort.signal.aborted) return
        buildIndex(atlas, body)
        await loadModel(atlas, {
          signal: abort.signal,
          onChunk: (f) => {
            setProgress(f)
            bumpScene()
          },
        })
        if (abort.signal.aborted) return
        setReady()
        // After a body swap, frame the new body once its size is known (the first load is framed by Rig).
        if (loaded.current++ && !useAtlas.getState().selection) useAtlas.getState().cameraCommand('home')
        buildBoundsTrees()
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message)
      }
    })()
    return () => abort.abort()
  }, [body])

  useEffect(() => {
    setLayerOpacity(layerOpacity)
    const inRegion = region ? (id) => index.partRegion.get(id) === region : null
    applyState({ visible, selection, isolate, xray, inRegion })
    // A selection of several pieces spreads on its own; otherwise the whole body does.
    setExplodeScope(selection && selection.kind !== 'organ' ? selection.partIds : null)
    invalidate()
  }, [sceneVersion, visible, selection, isolate, xray, region, layerOpacity, invalidate])

  useFrame((_, dt) => stepFx(dt))

  const onClick = (e) => {
    if (e.delta > 5) return // that was an orbit drag, not a click
    const st = useAtlas.getState()
    if (st.selection?.kind === 'organ') return // the body is only context while an organ is open
    const hit = pickHit(e)
    if (!hit) return
    e.stopPropagation()
    const id = hit.object.userData.partId
    if (st.quiz) return st.answerQuiz(id)
    const organ = organOfPart(id)
    organ ? st.openOrgan(organ) : st.selectPart(id)
  }

  // Name under the cursor, like a map label. Mouse only: touch has no hover.
  const onPointerMove = (e) => {
    const st = useAtlas.getState()
    if (e.pointerType !== 'mouse' || e.buttons || st.selection?.kind === 'organ') return st.hover && st.setHover(null)
    const hit = pickHit(e)
    const id = hit?.object.userData.partId
    if (!id) {
      document.body.style.cursor = ''
      return st.hover && st.setHover(null)
    }
    // During the quiz the label would give the answer away, so only the cursor changes.
    st.setHover(st.quiz ? null : { id, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
    document.body.style.cursor = 'pointer'
  }
  const onPointerOut = () => {
    document.body.style.cursor = ''
    useAtlas.getState().hover && useAtlas.getState().setHover(null)
  }

  return (
    <>
      <primitive object={batchRoot} />
      <primitive object={root} onClick={onClick} onPointerMove={onPointerMove} onPointerOut={onPointerOut} />
    </>
  )
}

/** Faded "ghost" layers sit in front of the selection; prefer solid structures. */
function pickHit(e) {
  const hits = e.intersections.filter((i) => i.object.userData.shown && i.object.userData.partId)
  return hits.find((i) => !i.object.userData.ghost) ?? hits[0]
}

/** Render one fresh frame and save the canvas as a PNG. */
function Snapshot() {
  const snap = useAtlas((s) => s.snap)
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    if (!snap) return
    gl.render(scene, camera)
    const name = useAtlas.getState().selection?.name ?? 'human-body'
    gl.domElement.toBlob((blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `body-atlas-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    })
  }, [snap, gl, scene, camera])
  return null
}

function FloorShadow() {
  const texture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(60,45,30,0.32)')
    grad.addColorStop(0.55, 'rgba(60,45,30,0.12)')
    grad.addColorStop(1, 'rgba(60,45,30,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(c)
  }, [])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.005, 0.02]} scale={[0.95, 0.55, 1]} renderOrder={-1}>
      <circleGeometry args={[1, 48]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  )
}

function Lights() {
  const light = useAtlas((s) => s.light)
  const soft = light === 'soft'
  return (
    <>
      <hemisphereLight args={['#fffaf0', '#cbb89c', soft ? 1.5 : 0.55]} />
      <directionalLight position={[1.6, 2.6, 2.2]} intensity={soft ? 1.6 : 2.6} color="#fff4e2" />
      <directionalLight position={[-2, 1.4, -1.6]} intensity={soft ? 0.7 : 1.3} color="#dfe9ff" />
      <directionalLight position={[0, 0.6, 3]} intensity={soft ? 0.5 : 0.15} />
    </>
  )
}

const boundsOf = (id) => index.parts.get(id)?.bounds

/** Frame a box with room for the picks above and the turntable + caption below. */
function fitPadded(c, [min, max], animate, k = 1) {
  const box = new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max))
  const size = box.getSize(new THREE.Vector3())
  // Pad small structures so a single tooth still shows some context.
  const m = Math.max(size.x, size.y, size.z) * k
  box.expandByScalar(Math.max(0.03 * k, 0.18 * m))
  c.fitToBox(box, animate, { paddingTop: 0.4 * m, paddingBottom: 0.7 * m, paddingLeft: 0.5 * m, paddingRight: 0.5 * m })
}

// Azimuth of each preset view. The body faces +z; its left side is +x.
const VIEWS = { front: 0, back: Math.PI, leftSide: Math.PI / 2, rightSide: -Math.PI / 2 }

const SMOOTH = {
  home: MOTION.back.smoothTime,
  selection: MOTION.fly.smoothTime,
  box: MOTION.settle.smoothTime,
}

const toBox3 = ([min, max]) => new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max))

function Rig() {
  const ref = useRef()
  const camera = useAtlas((s) => s.camera)
  const autoRotate = useAtlas((s) => s.autoRotate)
  const selection = useAtlas((s) => s.selection)
  const region = useAtlas((s) => s.region)
  const threeCamera = useThree((s) => s.camera)
  const width = useThree((s) => s.size.width)
  const homePadding = width < 600 ? HOME_PADDING_NARROW : HOME_PADDING

  useEffect(() => {
    threeCamera.layers.enable(LAYER.context)
    ref.current?.setLookAt(1.1, 1.25, 2.9, 0, 0.88, 0, false)
    ref.current?.fitToBox(toBox3(homeBox(0)), false, homePadding)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threeCamera])

  useEffect(() => {
    const c = ref.current
    if (!c || camera.n === 0) return
    const { type } = camera
    const animate = !REDUCED
    c.smoothTime = fx.explodeTarget !== fx.explode ? MOTION.explode.smoothTime : SMOOTH[type] ?? 0.35
    const e = fx.explodeTarget
    // A region is framed like a selection; the whole body grows its box with the spread.
    if (type === 'home' && region) fitPadded(c, explodedBounds(index.regionParts.get(region) ?? [], boundsOf, e), animate, 0.8)
    else if (type === 'home') c.fitToBox(toBox3(homeBox(e)), animate, homePadding)
    else if (type === 'selection' && selection) fitPadded(c, explodedBounds(selection.partIds, boundsOf, e), animate)
    // The lifted-out organ is the subject now, so frame it tighter than a body selection.
    else if (type === 'box' && camera.box) fitPadded(c, camera.box, animate, 0.5)
    else if (type === 'zoomIn') c.dolly(0.35, animate)
    else if (type === 'zoomOut') c.dolly(-0.35, animate)
    else if (type === 'left') c.rotate(-Math.PI / 4, 0, animate)
    else if (type === 'right') c.rotate(Math.PI / 4, 0, animate)
    else if (type in VIEWS) c.rotateTo(VIEWS[type], Math.PI / 2 - 0.12, animate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera])

  useFrame((_, delta) => {
    if (autoRotate && ref.current) ref.current.rotate(delta * 0.18, 0, false)
  })

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={0.12}
      maxDistance={5}
      smoothTime={0.45}
      onStart={() => useAtlas.getState().autoRotate && useAtlas.getState().toggleAutoRotate()}
    />
  )
}

/**
 * Moves the pinned-label DOM (see ui/Pins.jsx) every frame: each label sits out to the side of
 * its structure with a leader line back to it. Labels on one side are stacked so they never overlap.
 */
function PinProjector() {
  const pins = useAtlas((s) => s.pins)
  const showPins = useAtlas((s) => s.showPins)
  const ready = useAtlas((s) => s.ready)
  const { camera, size } = useThree()
  const parts = useMemo(() => (ready ? pins.map((p) => [p, pinParts(p)]) : []), [pins, ready])
  const v = useMemo(() => new THREE.Vector3(), [])
  const c = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const placed = []
    for (const [pin, ids] of parts) {
      const el = document.getElementById(`pin-${pin.key}`)
      const line = document.getElementById(`pin-line-${pin.key}`)
      if (!el || !line) continue
      let n = 0
      v.set(0, 0, 0)
      for (const id of ids) if (partCentre(id, c)) { v.add(c); n++ }
      // Nothing to point at in this body (say, a pin made on the other one): keep it out of sight.
      if (!n) { el.style.opacity = line.style.opacity = '0'; el.style.pointerEvents = 'none'; continue }
      v.divideScalar(n).project(camera)
      const hidden = !showPins || !anyShown(ids) || v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      const side = x < size.width / 2 ? -1 : 1
      // Keep clear of the quick picks above and the turntable + caption below.
      placed.push({ el, line, hidden, x, y, side, ly: Math.min(Math.max(y - 18, 84), size.height - 150) })
    }
    // Same-side labels keep at least 30 px between them, top to bottom.
    for (const side of [-1, 1]) {
      const list = placed.filter((p) => p.side === side && !p.hidden).sort((a, b) => a.ly - b.ly)
      for (let i = 1; i < list.length; i++) list[i].ly = Math.max(list[i].ly, list[i - 1].ly + 30)
      // If the stack runs into the bottom band, push it back up.
      for (let i = list.length - 1, floor = size.height - 150; i >= 0; i--, floor -= 30) list[i].ly = Math.min(list[i].ly, floor)
    }
    for (const p of placed) {
      const lx = p.x + p.side * Math.max(70, Math.abs(p.ly - p.y) * 0.6 + 50)
      p.el.style.opacity = p.line.style.opacity = p.hidden ? '0' : '1'
      p.el.style.pointerEvents = p.hidden ? 'none' : ''
      p.el.style.transform = `translate(${lx}px, ${p.ly}px) translate(${p.side < 0 ? '-100%' : '0'}, -50%)`
      p.line.setAttribute('points', `${p.x},${p.y} ${lx - p.side * 14},${p.ly} ${lx},${p.ly}`)
    }
  })
  return null
}

/** Draw calls of the last frame, for the README benchmark (`window.__drawCalls()`). */
function DrawStats() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    window.__drawCalls = () => gl.info.render.calls
  }, [gl])
  return null
}

export default function Stage() {
  const hq = useAtlas((s) => s.hq)
  return (
    <Canvas
      className="stage-canvas"
      dpr={[1, 2]}
      camera={{ fov: 30, near: 0.01, far: 50, position: [1.1, 1.25, 2.9] }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      <Lights />
      <Body />
      <OrganDetail />
      <FloorShadow />
      <Rig />
      <PinProjector />
      <Suspense fallback={null}>{hq && <Effects />}</Suspense>
      <DrawStats />
      <Snapshot />
    </Canvas>
  )
}
