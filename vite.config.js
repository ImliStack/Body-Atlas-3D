import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { SYSTEMS, REGIONS, regionIdOf } from './src/data.js'

// Public address, for canonical links and the sitemap. Override with SITE_URL=… npm run build.
const SITE = (process.env.SITE_URL || 'https://body-atlas-3d.imlistack.workers.dev').replace(/\/$/, '')

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/** Unique structure names in a list of parts, sides folded together: [name, first part id]. */
function namesOf(parts, limit = 60) {
  const seen = new Map()
  for (const p of parts) {
    const n = p.name.replace(/^(left|right) /i, '')
    const key = n.toLowerCase()
    if (!seen.has(key)) seen.set(key, [n.charAt(0).toUpperCase() + n.slice(1), p.id])
  }
  return [...seen.values()].sort((a, b) => a[0].localeCompare(b[0])).slice(0, limit)
}

/** One readable, crawlable page per system or region, with a link into the 3D view. */
function page({ path, title, latin, blurb, count, kind, names, appHash, siblings }) {
  const url = `${SITE}${path}`
  const desc = `${title} (${latin}) in 3D: ${count.toLocaleString('en')} structures you can turn, search and click. ${blurb}`.slice(0, 300)
  const ld = {
    '@context': 'https://schema.org', '@type': 'LearningResource', name: `${title} — Body Atlas`,
    description: desc, url, learningResourceType: '3D model', educationalLevel: 'beginner',
    isAccessibleForFree: true, inLanguage: 'en', about: { '@type': 'AnatomicalSystem', name: title },
  }
  if (kind === 'region') ld.about = { '@type': 'AnatomicalStructure', name: title }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} in 3D — Body Atlas</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${url}" />
<meta property="og:title" content="${esc(title)} in 3D — Body Atlas" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${url}" />
<meta name="theme-color" content="#f5f0e6" />
<link rel="icon" href="/icon.svg" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&display=swap" rel="stylesheet" />
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
:root { --bg: #f5f0e6; --paper: #faf7f0; --line: #e6dfd0; --ink: #1f1c18; --ink-2: #36322b; --muted: #7a7366; --soft: #ece5d6; --accent: #56653f; --accent-ink: #f5f3ea; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { --bg: #15130f; --paper: #1d1a15; --line: #2d2921; --ink: #efe9dc; --ink-2: #d4ccbb; --muted: #9b9282; --soft: #28241c; --accent: #a3b47c; --accent-ink: #15130f; color-scheme: dark; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.6 Inter, system-ui, sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 32px 16px 64px; }
a { color: inherit; }
.top { display: flex; justify-content: space-between; align-items: center; gap: 12px; font: 400 26px/1 Newsreader, Georgia, serif; text-decoration: none; }
.eyebrow { margin-top: 48px; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); }
h1 { font: 400 clamp(40px, 8vw, 64px)/1.02 Newsreader, Georgia, serif; letter-spacing: -.02em; margin: 8px 0 16px; }
h2 { font: 400 24px/1.2 Newsreader, Georgia, serif; margin: 36px 0 12px; }
.lede { font-size: 17px; color: var(--ink-2); }
.cta { display: inline-flex; align-items: center; gap: 8px; margin-top: 18px; padding: 11px 18px; border-radius: 999px; background: var(--accent); color: var(--accent-ink); text-decoration: none; font-weight: 500; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; padding: 0; list-style: none; }
.chips a { display: inline-block; padding: 5px 12px; border: 1px solid var(--line); border-radius: 999px; font-size: 13px; text-decoration: none; background: var(--paper); }
.chips a:hover { background: var(--soft); }
.facts { color: var(--muted); }
footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 12px; color: var(--muted); }
</style>
</head>
<body>
<main>
  <a class="top" href="/">Body Atlas</a>
  <div class="eyebrow">${esc(latin)} · ${kind === 'region' ? 'body region' : 'body system'}</div>
  <h1>${esc(title)}</h1>
  <p class="lede">${esc(blurb)}</p>
  <p class="facts">${count.toLocaleString('en')} structures in this ${kind}, modelled from BodyParts3D 4.0.</p>
  <a class="cta" href="/${appHash}">Open the ${esc(title.toLowerCase())} in 3D →</a>
  <h2>Structures</h2>
  <ul class="chips">${names.map(([n, id]) => `<li><a href="/#part/${id}">${esc(n)}</a></li>`).join('')}</ul>
  <h2>Keep exploring</h2>
  <ul class="chips">${siblings.map(([href, label]) => `<li><a href="${href}">${esc(label)}</a></li>`).join('')}</ul>
  <footer>Anatomy from BodyParts3D 4.0 © DBCLS (CC BY 4.0). Educational use only — not a clinical tool.</footer>
</main>
</body>
</html>
`
}

/** Service worker: precaches the app shell, then keeps models, organs and fonts as they are fetched. */
function serviceWorker(version, shell) {
  return `// Generated by vite.config.js at build time.
const VERSION = '${version}'
const SHELL = 'atlas-shell-' + VERSION
const DATA = 'atlas-data-v1' // models change rarely; kept across app updates
const PRECACHE = ${JSON.stringify(shell)}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('atlas-shell-') && k !== SHELL).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()))
})

const cacheFirst = async (req, name) => {
  const hit = await caches.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok || res.type === 'opaque') (await caches.open(name)).put(req, res.clone())
  return res
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Pages: network first so a deploy shows up at once; offline, the cached copy (or the app shell).
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone()
      caches.open(SHELL).then((c) => c.put(req, copy))
      return res
    }).catch(async () => (await caches.match(req)) || caches.match('/')))
    return
  }
  if (url.origin === location.origin && /^\\/(models|organs)\\//.test(url.pathname)) e.respondWith(cacheFirst(req, DATA))
  else if (url.origin === location.origin || /fonts\\.(googleapis|gstatic)\\.com$/.test(url.hostname)) e.respondWith(cacheFirst(req, SHELL))
})
`
}

/** Static SEO pages per system and region, sitemap.xml, robots.txt and sw.js. */
function atlasPages() {
  const atlas = () => JSON.parse(readFileSync(new URL('./public/models/atlas.json', import.meta.url)))
  const links = [
    ...SYSTEMS.map((s) => [`/systems/${s.id}/`, s.name]),
    ...REGIONS.map((r) => [`/regions/${r.id}/`, r.name]),
  ]
  return {
    name: 'atlas-pages',
    // Crawlers that skip JavaScript still find every page from the home page.
    transformIndexHtml: (html) => html.replace('<div id="root"></div>',
      `<div id="root"></div>\n    <noscript><nav>${links.map(([h, l]) => `<a href="${h}">${l}</a>`).join(' · ')}</nav></noscript>`),
    apply: 'build',
    generateBundle(_, bundle) {
      const { parts } = atlas()
      const emit = (fileName, source) => this.emitFile({ type: 'asset', fileName, source })
      for (const s of SYSTEMS) {
        const list = parts.filter((p) => p.system === s.id)
        emit(`systems/${s.id}/index.html`, page({
          path: `/systems/${s.id}/`, title: s.name, latin: s.latin, blurb: s.blurb, count: list.length, kind: 'system',
          names: namesOf(list), appHash: `#system/${s.id}`, siblings: links.filter(([h]) => h !== `/systems/${s.id}/`),
        }))
      }
      for (const r of REGIONS) {
        const list = parts.filter((p) => regionIdOf(p.bounds) === r.id)
        emit(`regions/${r.id}/index.html`, page({
          path: `/regions/${r.id}/`, title: r.name, latin: r.latin, blurb: r.blurb, count: list.length, kind: 'region',
          names: namesOf(list), appHash: `#region/${r.id}`, siblings: links.filter(([h]) => h !== `/regions/${r.id}/`),
        }))
      }
      const urls = ['/', ...links.map(([h]) => h)]
      emit('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
        urls.map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join('\n')}\n</urlset>\n`)
      emit('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`)
      const assets = Object.keys(bundle).filter((f) => f.startsWith('assets/')).map((f) => `/${f}`)
      const shell = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', ...assets]
      // Changes whenever any built file name (and so its content hash) changes.
      let h = 0
      for (const c of assets.join('|')) h = (h * 31 + c.charCodeAt(0)) >>> 0
      const version = h.toString(36)
      emit('sw.js', serviceWorker(version, shell))
    },
  }
}

export default defineConfig({
  plugins: [react(), atlasPages()],
  build: {
    chunkSizeWarningLimit: 1800,
  },
})
