# Body Atlas 3D

An interactive 3D human anatomy explorer that runs fully in the browser — no app
install, no plugin. See [PLAN.md](PLAN.md) for the research notes and roadmap.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5180. The first load downloads ~31 MB of compressed anatomy
geometry, so it takes a few seconds.

`npm run build` writes a static site to `dist/` (deploy to Vercel / Netlify / Cloudflare Pages).

## Organ deep-dive

Click an organ in the body (or a quick pick) to open it: the click flashes, the rest of
the body steps back, the camera springs in, and a detailed OrganUI model "lifts out" in the
organ's place. Click its parts (heart chambers, lung segments, brain lobes…) to read about
each one; **← Body** or `Esc` reverses the move. The heart beats and the lungs breathe while
you read. 14 organs: heart, brain, lungs, liver, kidneys, stomach, pancreas, spleen,
gallbladder, bladder, eye, esophagus, intestines, larynx.

## Exploring

- **Hover labels** — the name and system of whatever is under the mouse.
- **Preset views** — Front / Back / Left / Right under the body, or keys `1`–`4`.
- **X-ray** — every visible layer turns translucent, bones stay readable.
- **Quiz yourself** — eight "Find the …" rounds; a first-try find scores 1, a second try ½,
  and after two misses the answer is shown with a hint.
- **Share a view** — the URL hash follows what is open (`#organ/heart`, `#featured/skull`,
  `#concept/femur`, `#part/FJ1252`, `#system/venous`), so any view can be linked or bookmarked.
- **Save image** — exports the current 3D view as a PNG.
- **Light / dark theme** — follows the system setting, remembered per browser.
- **Keyboard** — press `?` for the full list (`/` search, `Esc` back, `F` fit, `X` x-ray, `R` rotate…).
- Without WebGL the atlas still loads its panels and explains why the 3D view is missing.

## Motion

Every timing lives in [`src/motion.js`](src/motion.js), in seconds: press → clear → fly →
lift → reveal → hold. Retune a move by editing one value there. Camera moves use
camera-controls' smoothing, the lift uses a spring with a little overshoot, panel lines arrive
with a stagger, and `prefers-reduced-motion` turns every move into an instant cut with no idle
animation.

## Stack

- Vite 5 · React 19 · React Three Fiber 9 · drei 10 (`CameraControls`) · three 0.186 · zustand 5
- three-mesh-bvh for fast hover / click picking (trees are built in idle time after load)
- Plain CSS; fonts Newsreader + Inter (Google Fonts)

## Structure

```
src/
  data.js               systems, colours, featured bones, quiz rounds, copy
  links.js              URL hash <-> current view (shareable links)
  organs.js             organs with a deep-dive: body concepts, copy, idle animation, quick picks
  organ-models.json     OrganUI model data: structures, views, credits
  motion.js             all timings + spring / heartbeat / breathing helpers
  store.js              zustand store, search index, interaction timeline
  scene/meshes.js       loads packed chunks, builds 2,234 meshes, applies visibility/materials
  scene/fx.js           shared animated values (ghost fade, press flash, organ dissolve)
  scene/organLoader.js  cached GLB loading for organ models
  scene/OrganDetail.jsx lifted-out organ: fade, spring, idle, part picking
  scene/Stage.jsx       R3F canvas: lights, body, organ, floor shadow, camera rig
  ui/                   Sidebar, Panel (right column), Icon
  App.jsx               layout, search, quick picks, tools, views, hover label, shortcuts, loader
public/models/          atlas.json manifest + body-*.bin.gz geometry chunks
public/organs/          14 organ GLBs from OrganUI + ATTRIBUTION.md
```

## Data & credits

Anatomy: **BodyParts3D 4.0**, © The Database Center for Life Science, CC BY 4.0.
Packed browser geometry from [ashemag/human-atlas](https://github.com/ashemag/human-atlas)
(MIT code, CC BY 4.0 data). Full attribution in `public/ATTRIBUTION.md`.
Organ models: [OrganUI](https://github.com/organui) explorers (MIT code); each model's
licence (CC BY 4.0 or CC BY-SA) is listed in `public/organs/ATTRIBUTION.md` and shown in the panel.
Educational use only — not a clinical tool.
