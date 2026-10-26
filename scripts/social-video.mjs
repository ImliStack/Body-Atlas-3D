// Record a ~50 s 16:9 social video (X / LinkedIn) of the real app with burned-in captions (feeds autoplay muted),
// plus a copy with a soft generated ambient loop. The tour plays twice in one page so the kept pass has warm caches.
// Output: docs/social/body-atlas-x.mp4 and docs/social/body-atlas-x-sound.mp4. Run: node scripts/social-video.mjs
import fs from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'
import { chromium } from 'playwright'

const out = 'outputs/social', size = { width: 1280, height: 720 }
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true }); fs.mkdirSync('docs/social', { recursive: true })
const port = 5196, base = `http://127.0.0.1:${port}`
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'inherit'] })
process.on('exit', () => vite.kill()) // never leave the dev server running
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('vite did not start')), 30000); vite.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); res() } }) })

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: [`--window-size=${size.width},${size.height}`, '--enable-gpu', '--ignore-gpu-blocklist'] })
const context = await browser.newContext({ viewport: size, screen: size, deviceScaleFactor: 1, recordVideo: { dir: out, size } })
await context.addInitScript(() => {
  // Same look every run: light theme, both panels, AO on, no saved pins, male body.
  localStorage.setItem('atlas-theme', 'light'); localStorage.setItem('atlas-panels', '{"left":true,"right":true}')
  localStorage.setItem('atlas-hq', 'true'); localStorage.setItem('atlas-pins', '[]'); localStorage.setItem('atlas-body', '"male"'); localStorage.removeItem('atlas-folds')
})
const page = await context.newPage(), t0 = Date.now()
const wait = (ms) => page.waitForTimeout(ms)
const A = (js) => page.evaluate(`(() => { const s = window.__atlas.getState(); ${js} })()`)
const ready = async (label = '') => {
  const t = Date.now()
  await page.waitForFunction(() => window.__atlas?.getState().ready, null, { timeout: 300000 })
  console.log(`ready ${label} in ${((Date.now() - t) / 1000).toFixed(1)} s`)
}
const caption = (text, sub = '') => page.evaluate(([text, sub]) => {
  let el = document.getElementById('social-caption')
  if (!el) {
    el = document.createElement('div'); el.id = 'social-caption'; document.body.append(el)
    const b = document.createElement('div'); b.id = 'social-brand'; b.innerHTML = '<span>Imli</span>Stack · imlistack.com'; document.body.append(b)
    const s = document.createElement('style')
    s.textContent = '#social-caption{position:fixed;z-index:99;left:50%;bottom:118px;transform:translateX(-50%);padding:12px 22px;border-radius:14px;background:rgba(24,21,16,.84);color:#fff;font:500 26px/1.25 Inter,system-ui;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.3);transition:opacity .35s;max-width:900px;white-space:nowrap}#social-caption small{display:block;font-weight:400;font-size:17px;color:#e2dccd;margin-top:3px}#social-caption.hide{opacity:0}#social-brand{position:fixed;z-index:99;left:50%;transform:translateX(-50%);top:14px;padding:7px 12px;border-radius:10px;background:rgba(24,21,16,.84);color:#fff;font:500 15px/1 Inter,system-ui}#social-brand span{color:#a3b47c}'
    document.head.append(s)
  }
  el.classList.toggle('hide', !text); if (text) el.innerHTML = text + (sub ? `<small>${sub}</small>` : '')
}, [text, sub])

async function tour() {
  await caption('')
  await A('s.autoRotate || s.toggleAutoRotate()'); await wait(1500)
  await caption('The human body in 3D, in your browser', '2,234 real structures from BodyParts3D · free & open'); await wait(4200)
  await A("s.toggleAutoRotate(); s.view('front'); s.togglePins()")
  await caption('Labels pinned to the body', 'They follow the camera and never overlap'); await wait(3400)
  await A('s.toggleExplode()')
  await caption('Pull it apart', 'Exploded view, with a slider for how far'); await wait(3800)
  await A("s.toggleExplode(); s.togglePins(); s.selectFeatured('skull')"); await wait(1800)
  await A('s.setExplodeAmount(0.85); s.toggleExplode()')
  await caption('Spread one group', 'The skull’s 22 bones, one by one'); await wait(3800)
  await A("s.toggleExplode(); s.openOrgan('heart')")
  await caption('Open 14 organs as detailed models', 'The heart beats, the lungs breathe'); await wait(3000)
  await A("s.selectStructure('left-ventricle')"); await wait(2400)
  await A("s.clearSelection()"); await wait(900)
  await A("s.showRegion('upper'); s.toggleSystem('muscular')")
  await caption('Browse by region', 'Head & neck · trunk · arms · legs'); await wait(3200)
  await A("s.showAll(); s.view('front'); s.toggleOpacityOpen(); s.toggleSystem('muscular')"); await wait(600)
  await caption('Fade any system', 'Per-layer opacity, not all-or-nothing')
  for (const v of [0.8, 0.6, 0.4, 0.25]) { await A(`s.setOpacity('muscular', ${v})`); await wait(650) }
  await wait(900)
  await A("s.resetOpacity(); s.toggleOpacityOpen(); s.setBody('female')")
  await caption('Male and female reference bodies', 'The same systems, fitted to her skeleton'); await ready('female'); await A("s.autoRotate && s.toggleAutoRotate(); s.view('front')"); await wait(3000)
  await A("s.toggleSystem('muscular')"); await wait(2200)
  await A("s.toggleSystem('muscular'); s.setBody('male')"); await ready('male')
  await A('s.startQuiz()')
  await caption('Quiz yourself', '“Find the …” — click it on the body'); await wait(3000)
  await A('s.endQuiz()'); await A("s.autoRotate || s.toggleAutoRotate()")
  await caption('Try it 👇', 'body-atlas-3d.imlistack.workers.dev'); await wait(3200)
  await caption('Built by ImliStack', 'imlistack.com · open source on GitHub'); await wait(2800)
}

let keepFrom = 0
try {
  await page.goto(`${base}/`); await ready(); await wait(2000)
  await tour() // warm-up pass: loads both bodies, organ models and post effects
  await page.goto(`${base}/?pass=2`); await ready(); await wait(2500)
  keepFrom = (Date.now() - t0) / 1000
  await tour()
} finally {
  const video = page.video(); await context.close(); await browser.close(); vite.kill()
  const webm = await video.path()
  const mp4 = 'docs/social/body-atlas-x.mp4', withSound = 'docs/social/body-atlas-x-sound.mp4'
  // H.264 High, yuv420p, 30 fps, faststart: X's recommended upload format.
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(keepFrom + 0.3), '-i', webm, '-r', '30', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart', '-an', mp4])
  const d = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], { encoding: 'utf8' }).trim())
  // A soft, original ambient pad (A minor chords, 4 s each) made with ffmpeg: no music rights to clear.
  const chord = (f) => f.map((h) => `0.05*sin(2*PI*${h}*t)*(0.6+0.4*sin(2*PI*0.25*t))`).join('+')
  const prog = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [164.81, 207.65, 246.94]]
  const expr = prog.map((c, i) => `between(mod(t,16),${i * 4},${i * 4 + 4})*(${chord(c)})`).join('+')
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-f', 'lavfi', '-i', `aevalsrc='${expr}':s=44100:d=${d}`, '-filter_complex', `[1]lowpass=f=1800,afade=t=in:d=1.5,afade=t=out:st=${d - 2}:d=2,volume=0.9[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', withSound])
  console.log(JSON.stringify({ file: mp4, seconds: d, mb: +(fs.statSync(mp4).size / 1e6).toFixed(1) }))
}
