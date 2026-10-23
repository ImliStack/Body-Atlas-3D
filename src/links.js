import { useEffect } from 'react'
import { useAtlas, index } from './store.js'
import { SYSTEM_BY_ID, REGION_BY_ID, FEATURED } from './data.js'
import { ORGANS } from './organs.js'

// The URL hash mirrors what is on screen, so any view can be shared or bookmarked:
//   #organ/heart · #featured/skull · #concept/left%20femur · #part/FJ1252 · #system/venous · #region/head

/** Hash for the current state; '' for the whole-body overview. */
function hashOf(s) {
  if (s.quiz) return ''
  const sel = s.selection
  if (sel?.kind === 'organ') return `#organ/${sel.organKey}`
  if (sel?.kind === 'featured') return `#featured/${sel.featured.key}`
  if (sel?.kind === 'concept') return `#concept/${encodeURIComponent(sel.name.toLowerCase())}`
  if (sel?.kind === 'part') return `#part/${sel.partIds[0]}`
  if (s.focusSystem) return `#system/${s.focusSystem}`
  if (s.region) return `#region/${s.region}`
  return ''
}

/** Open whatever a hash points at. Unknown links fall back to the overview. */
function openHash(hash) {
  const st = useAtlas.getState()
  if (hash === hashOf(st)) return
  const [kind, raw = ''] = hash.replace(/^#/, '').split('/')
  const key = decodeURIComponent(raw)
  if (kind === 'organ' && ORGANS[key]) st.openOrgan(key)
  else if (kind === 'featured' && FEATURED.some((f) => f.key === key)) st.selectFeatured(key)
  else if (kind === 'concept' && index.concepts.has(key)) st.selectConcept(key)
  else if (kind === 'part' && index.parts.has(key)) st.selectPart(key)
  else if (kind === 'system' && SYSTEM_BY_ID[key]) st.showSystem(key)
  else if (kind === 'region' && REGION_BY_ID[key]) st.region !== key && st.showRegion(key)
  else if (st.selection || st.focusSystem || st.region) st.showAll()
}

export function useHashLink() {
  const ready = useAtlas((s) => s.ready)

  useEffect(() => {
    if (!ready) return
    if (location.hash) openHash(location.hash)
    // Keep the address bar in step without adding a history entry per click.
    const unsubscribe = useAtlas.subscribe((s, prev) => {
      if (s.selection === prev.selection && s.focusSystem === prev.focusSystem && s.region === prev.region && s.quiz === prev.quiz) return
      const hash = hashOf(s)
      if (hash !== location.hash) history.replaceState(null, '', hash || location.pathname + location.search)
    })
    const onHash = () => openHash(location.hash)
    window.addEventListener('hashchange', onHash)
    return () => {
      unsubscribe()
      window.removeEventListener('hashchange', onHash)
    }
  }, [ready])
}
