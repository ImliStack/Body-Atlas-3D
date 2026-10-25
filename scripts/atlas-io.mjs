// Read packed atlases (manifest + gzipped binary chunks) from public/models in Node.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MODELS = fileURLToPath(new URL('../public/models/', import.meta.url))

export function loadAtlas(file) {
  const atlas = JSON.parse(readFileSync(join(MODELS, file), 'utf8'))
  const buffers = atlas.chunks.map((c) => {
    const buf = gunzipSync(readFileSync(join(MODELS, c.gzip.split('/').pop())))
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  })
  const byId = new Map(atlas.parts.map((p) => [p.id, p]))
  const concepts = new Map(atlas.concepts.map((c) => [c.name.toLowerCase(), c]))
  return { atlas, buffers, byId, concepts }
}

export function geometry({ buffers }, p) {
  const b = buffers[p.chunk]
  return {
    positions: new Float32Array(b, p.positions, p.vertexCount * 3),
    normals: new Int16Array(b, p.normals, p.vertexCount * 3),
    indices: new Uint32Array(b, p.indices, p.indexCount),
  }
}

/** Part ids of a concept (by name) that exist as meshes. */
export function partsOf(a, name) {
  const c = a.concepts.get(name.toLowerCase())
  return c ? c.elements.filter((e) => a.byId.has(e)) : []
}

export function boundsOf(a, ids) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]
  for (const id of ids) {
    const [lo, hi] = a.byId.get(id).bounds
    for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], lo[i]); mx[i] = Math.max(mx[i], hi[i]) }
  }
  return [mn, mx]
}

export const centre = ([mn, mx]) => mn.map((v, i) => (v + mx[i]) / 2)
export const size = ([mn, mx]) => mn.map((v, i) => mx[i] - v)
