import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useAtlas, selectionBounds } from '../store.js'
import { ORGANS } from '../organs.js'
import { MOTION, REDUCED, spring, heartbeat, breath } from '../motion.js'
import { loadOrgan } from './organLoader.js'

const BLACK = new THREE.Color('#000000')

// The OrganUI model "lifts out" of the body: it appears at the organ's place in the
// whole-body model, springs to full size, then idles (heartbeat / breathing).
export default function OrganDetail() {
  const selection = useAtlas((s) => s.selection)
  const phase = useAtlas((s) => s.organPhase)
  const structureId = useAtlas((s) => s.structureId)
  const organKey = selection?.kind === 'organ' ? selection.organKey : null

  const [entry, setEntry] = useState(null)
  const outer = useRef()
  const inner = useRef()
  const anim = useRef({ fade: { x: 0, v: 0 }, lift: { x: MOTION.lift.from, v: 0 }, framed: false })
  const lastPlacement = useRef(null)

  const placement = useMemo(() => {
    if (!organKey) return null
    const [min, max] = selectionBounds(selection.partIds)
    const centre = min.map((v, i) => (v + max[i]) / 2)
    const bodyMax = Math.max(...max.map((v, i) => v - min[i]))
    const model = ORGANS[organKey].model
    return { centre, scale: bodyMax / Math.max(...model.size), size: model.size }
  }, [organKey, selection])
  if (placement) lastPlacement.current = placement

  useEffect(() => {
    if (!organKey) return
    let alive = true
    loadOrgan(organKey).then((e) => alive && setEntry(e)).catch(() => {})
    return () => { alive = false }
  }, [organKey])

  // Structure emphasis: the chosen one glows, the rest step back.
  useEffect(() => {
    if (!entry) return
    for (const [id, list] of entry.meshes)
      for (const m of list) {
        const on = id === structureId
        m.material.emissive.copy(on ? m.material.color : BLACK)
        m.material.emissiveIntensity = on ? 0.35 : 0
      }
  }, [entry, structureId])

  useFrame((state, dt) => {
    if (!entry || !outer.current) return
    const a = anim.current
    const active = entry.key === organKey && phase === 'detail'
    const fade = spring(a.fade, active ? 1 : 0, MOTION.springs.fade, dt)
    if (active) spring(a.lift, 1, MOTION.springs.lift, dt)

    if (!active && fade < 0.003) {
      outer.current.visible = false
      a.lift.x = MOTION.lift.from
      a.lift.v = 0
      a.framed = false
      return
    }
    const place = lastPlacement.current
    outer.current.visible = true
    outer.current.position.set(...place.centre)
    outer.current.scale.setScalar(place.scale * a.lift.x)

    const idle = ORGANS[entry.key].idle
    const t = state.clock.elapsedTime
    const pulse = REDUCED || !active ? 1
      : idle === 'heartbeat' ? heartbeat(t, MOTION.idle.heartbeat)
      : idle === 'breath' ? breath(t, MOTION.idle.breath) : 1
    inner.current.scale.setScalar(pulse)

    const o = Math.min(Math.max(fade, 0), 1)
    for (const [id, list] of entry.meshes) {
      const base = !structureId || id === structureId ? 1 : 0.22
      for (const m of list) {
        const mat = m.material
        mat.opacity = o * base
        const see = mat.opacity < 0.999
        if (mat.transparent !== see) {
          mat.transparent = see
          mat.depthWrite = !see
          mat.needsUpdate = true
        }
      }
    }

    // Once the model is visible, let the camera settle on the full specimen.
    if (active && !a.framed && fade > 0.05) {
      a.framed = true
      const half = place.size.map((v) => (v * place.scale) / 2)
      const min = place.centre.map((c, i) => c - half[i])
      const max = place.centre.map((c, i) => c + half[i])
      useAtlas.getState().cameraCommand('box', [min, max])
    }
  })

  if (!entry) return null

  const onClick = (e) => {
    if (e.delta > 5 || useAtlas.getState().organPhase !== 'detail') return
    const hit = e.intersections.find((i) => i.object.userData.structureId && i.object.material.opacity > 0.1)
    if (!hit) return
    e.stopPropagation()
    useAtlas.getState().selectStructure(hit.object.userData.structureId)
  }

  return (
    <group ref={outer} visible={false}>
      <group ref={inner}>
        <primitive
          object={entry.scene}
          onClick={onClick}
          onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
          onPointerOut={() => { document.body.style.cursor = '' }}
        />
      </group>
    </group>
  )
}
