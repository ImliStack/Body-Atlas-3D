import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import * as THREE from 'three'
import { useAtlas, buildIndex, selectionBounds, organOfPart } from '../store.js'
import { root, loadModel, applyState, stepFx, buildBoundsTrees, LAYER } from './meshes.js'
import { MOTION, REDUCED } from '../motion.js'
import OrganDetail from './OrganDetail.jsx'

const BODY_BOX = new THREE.Box3(new THREE.Vector3(-0.32, 0, -0.18), new THREE.Vector3(0.32, 1.76, 0.18))
// Leave room for the quick picks above and the 360° control + caption below.
const HOME_PADDING = { paddingTop: 0.16, paddingBottom: 0.42, paddingLeft: 0.1, paddingRight: 0.1 }

function Body() {
  const sceneVersion = useAtlas((s) => s.sceneVersion)
  const visible = useAtlas((s) => s.visible)
  const selection = useAtlas((s) => s.selection)
  const isolate = useAtlas((s) => s.isolate)
  const xray = useAtlas((s) => s.xray)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    const abort = new AbortController()
    const { setProgress, setReady, setError, bumpScene } = useAtlas.getState()
    ;(async () => {
      try {
        const atlas = await (await fetch('/models/atlas.json', { signal: abort.signal })).json()
        buildIndex(atlas)
        await loadModel(atlas, {
          signal: abort.signal,
          onChunk: (f) => {
            setProgress(f)
            bumpScene()
          },
        })
        setReady()
        buildBoundsTrees()
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message)
      }
    })()
    return () => abort.abort()
  }, [])

  useEffect(() => {
    applyState({ visible, selection, isolate, xray })
    invalidate()
  }, [sceneVersion, visible, selection, isolate, xray, invalidate])

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
    if (!id) return st.hover && st.setHover(null)
    // During the quiz the label would give the answer away, so only the cursor changes.
    st.setHover(st.quiz ? null : { id, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
    document.body.style.cursor = 'pointer'
  }
  const onPointerOut = () => {
    document.body.style.cursor = ''
    useAtlas.getState().hover && useAtlas.getState().setHover(null)
  }

  return <primitive object={root} onClick={onClick} onPointerMove={onPointerMove} onPointerOut={onPointerOut} />
}

/** Faded "ghost" layers sit in front of the selection; prefer solid structures. */
function pickHit(e) {
  const hits = e.intersections.filter((i) => i.object.visible && i.object.userData.partId)
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

function Rig() {
  const ref = useRef()
  const camera = useAtlas((s) => s.camera)
  const autoRotate = useAtlas((s) => s.autoRotate)
  const selection = useAtlas((s) => s.selection)
  const threeCamera = useThree((s) => s.camera)

  useEffect(() => {
    threeCamera.layers.enable(LAYER.context)
    ref.current?.setLookAt(1.1, 1.25, 2.9, 0, 0.88, 0, false)
    ref.current?.fitToBox(BODY_BOX, false, HOME_PADDING)
  }, [threeCamera])

  useEffect(() => {
    const c = ref.current
    if (!c || camera.n === 0) return
    const { type } = camera
    const animate = !REDUCED
    c.smoothTime = SMOOTH[type] ?? 0.35
    if (type === 'home') c.fitToBox(BODY_BOX, animate, HOME_PADDING)
    else if (type === 'selection' && selection) fitPadded(c, selectionBounds(selection.partIds), animate)
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

export default function Stage() {
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
      <Snapshot />
    </Canvas>
  )
}
