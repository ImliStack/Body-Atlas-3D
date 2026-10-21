import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { ORGANS } from '../organs.js'

// One load per organ; the promise is reused so a click can start the download
// while the camera is still flying.
const cache = new Map()
const loader = new GLTFLoader()

function structureOf(object, known) {
  for (let node = object; node; node = node.parent) {
    const id = node.userData?.structureId || node.name
    if (known.has(id)) return id
  }
  return null
}

export function loadOrgan(key) {
  if (cache.has(key)) return cache.get(key)
  const model = ORGANS[key].model
  const promise = loader.loadAsync(model.src).then((gltf) => {
    const structures = new Map(model.structures.map((s) => [s.id, s]))
    const known = new Set(structures.keys())
    const meshes = new Map() // structureId -> Mesh[]
    gltf.scene.traverse((object) => {
      if (!object.isMesh) return
      const id = structureOf(object, known)
      if (!id) return
      object.material = new THREE.MeshStandardMaterial({
        color: structures.get(id).color, roughness: 0.58, metalness: 0, transparent: true, opacity: 0,
      })
      object.userData.structureId = id
      if (!meshes.has(id)) meshes.set(id, [])
      meshes.get(id).push(object)
    })
    return { key, scene: gltf.scene, meshes }
  })
  promise.catch(() => cache.delete(key))
  cache.set(key, promise)
  return promise
}
