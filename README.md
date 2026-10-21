# Body Atlas 3D

An interactive 3D human anatomy atlas that runs entirely in the browser. Turn a full adult
body, peel it back system by system, click any of its 2,234 structures to learn what it is,
and open 14 organs in detailed models you can take apart. There's nothing to install and no
plugin. It's a static site that works on desktop and mobile.

![Body Atlas — whole body with a hover label](docs/screenshots/overview-hover.jpg)

<p align="center">
  <img src="docs/screenshots/heart-structure.jpg" width="49%" alt="Heart deep-dive with the left ventricular cavity selected" />
  <img src="docs/screenshots/brain-dark.jpg" width="49%" alt="Brain deep-dive in the dark theme" />
</p>

---

## Contents

- [Features](#features)
- [Getting started](#getting-started)
- [Using the atlas](#using-the-atlas)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Shareable links](#shareable-links)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [Customising](#customising)
- [Browser support & performance](#browser-support--performance)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Data, credits & licence](#data-credits--licence)

---

## Features

| | |
|---|---|
| **Whole-body model** | 2,234 individually selectable meshes from BodyParts3D 4.0, grouped into 15 body systems. |
| **System layers** | Show or hide any system from the sidebar. Muscles and skin start hidden so the organs are visible. |
| **Search** | Instant search across every structure and 3,432 named concepts, such as "femur", "aorta" or "left kidney". |
| **Organ deep-dives** | 14 organs open as detailed models with labelled parts. The heart beats and the lungs breathe while you read. |
| **Hover labels** | The name and system of whatever is under the mouse, like labels on a map. |
| **Preset views** | Front, back, left and right, one click each, plus a 360° turntable. |
| **X-ray mode** | Every layer turns translucent so you can see what sits behind what. Bones stay readable. |
| **Isolate** | Hide everything except the selected structure and study it alone from every angle. |
| **Quiz yourself** | Eight "Find the …" rounds with hints and a score at the end. |
| **Shareable links** | The URL always matches what's on screen, so you can send someone straight to the heart. |
| **Save image** | Export the current 3D view as a PNG. |
| **Light & dark themes** | Follows your system setting and is remembered per browser. |
| **Keyboard first** | Every tool has a shortcut. Press `?` to see them. |
| **Accessible motion** | `prefers-reduced-motion` turns every animation into an instant cut. |
| **Graceful fallback** | Without WebGL, the panels, search and facts still work, and the page explains why the 3D view is missing. |

---

## Getting started

**Requirements:** Node.js 18 or newer and npm. The project is pinned to Vite 5, so Node 18 works.

```bash
git clone https://github.com/ImliStack/Body-Atlas-3D.git
cd Body-Atlas-3D
npm install
npm run dev
```

Open <http://localhost:5180>. The first visit downloads about 31 MB of compressed anatomy
geometry in 15 chunks, with a progress bar while it assembles. The browser caches it after that.

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload on port 5180 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built `dist/` locally on port 5180 |

---

## Using the atlas

### Explore the body

Drag to orbit, scroll to zoom and right-drag to pan. Click any structure to select it. The
camera flies to it, the rest of the body fades back, and the right panel shows its system,
region, side, real-world size and the larger structures it belongs to.

Use the **eye** icons in the sidebar to switch systems on and off. Click a system's name to
focus on it and get a short introduction with suggested starting points.

<p align="center">
  <img src="docs/screenshots/xray.jpg" width="49%" alt="X-ray mode" />
  <img src="docs/screenshots/search-dark.jpg" width="49%" alt="Searching for the femur in the dark theme" />
</p>

### Open an organ

Click an organ in the body, or use a quick pick along the top. The selected organ flashes, the
body steps back, the camera springs in, and a detailed model lifts out of the body in its place.
Click its parts, such as heart chambers, lung lobes or brain lobes, to read about each one.
**← Body** or `Esc` plays the move in reverse.

Organs with a deep-dive: heart, brain, lungs, liver, kidneys, stomach, pancreas, spleen,
gallbladder, bladder, eye, esophagus, intestines and larynx.

### Quiz yourself

Choose **Quiz yourself** in the sidebar. Each round asks for one structure. Find it on the
first try for a point, or on the second try for half a point. After two misses the answer is
shown with a hint. Hover labels are switched off during the quiz so they can't give the answer
away.

<p align="center">
  <img src="docs/screenshots/quiz.jpg" width="66%" alt="Quiz round: find the stomach, with a hint after a wrong guess" />
  <img src="docs/screenshots/mobile-lungs.jpg" width="24%" alt="Mobile layout with the lungs open" />
</p>

---

## Keyboard shortcuts

| Key | Action | | Key | Action |
|---|---|---|---|---|
| `/` | Focus search | | `R` | Auto-rotate on/off |
| `Esc` | Back / clear selection | | `I` | Isolate selection |
| `F` | Fit to view | | `X` | X-ray |
| `+` `−` | Zoom in / out | | `L` | Studio lighting |
| `1` `2` `3` `4` | Front / back / left / right view | | `P` | Save image |
| `T` | Light / dark theme | | `?` | Shortcuts & credits |

In search, `↑` `↓` move through the results and `Enter` opens one.

---

## Shareable links

The URL hash always matches what's open. Copy it with the share button in the top bar, or
just copy the address bar.

| Link | Opens |
|---|---|
| `#organ/heart` | Organ deep-dive (`heart`, `brain`, `lungs`, `liver`, `kidneys`, …) |
| `#featured/skull` | Featured structure (`skull`, `spine`, `femur`) |
| `#concept/femur` | Any named concept, lower-case and URL-encoded (`#concept/left%20kidney`) |
| `#part/FJ1252` | A single mesh by its BodyParts3D id |
| `#system/venous` | A body system overview |

Unknown links fall back to the whole-body view. The hash is updated with `replaceState`, so
clicking around doesn't fill up the browser history.

---

## How it works

**Geometry.** BodyParts3D meshes are pre-packed into 15 gzipped binary chunks
(`public/models/body-*.bin.gz`) with a JSON manifest (`atlas.json`) that lists every part's
name, system, byte offsets and bounding box. Three workers fetch the chunks in parallel. If the
host hasn't already decompressed a chunk, the browser's `DecompressionStream` does, and each
part becomes a `THREE.BufferGeometry` that reads straight from the buffer without copying.

**Rendering outside React.** All 2,234 meshes live in one plain `THREE.Group` that React
never reconciles. When the selection, layers or x-ray change, `applyState()` updates
visibility, material and render layer in a single pass. Materials are shared per system
(solid / ghost / glow / x-ray), so a state change swaps references and never creates new
materials.

**Picking.** Hover and click raycasting uses [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh).
The BVH trees are built in `requestIdleCallback` slices after load, so the first frames stay
smooth. Until a mesh has its tree, it falls back to the standard raycast. Faded "ghost" layers
are skipped in favour of solid structures, so a click lands on what you can actually see.

**Camera.** [camera-controls](https://github.com/yomotsu/camera-controls), through drei, handles
the fly-to, fit-to-box and preset views. Small structures get extra padding, so a single tooth
still shows some of the jaw around it.

**State.** A single [zustand](https://github.com/pmndrs/zustand) store (`src/store.js`) holds
the selection, layers, quiz, theme and camera commands. It also builds the search index
when the manifest arrives. Every selection follows the same timeline: press → clear → fly →
lift → reveal → hold. That timeline is scheduled from one timing table.

**Motion.** Every duration lives in [`src/motion.js`](src/motion.js), in seconds, so you can
retune a move by editing one number. The organ lift uses a damped spring with a little
overshoot, panel lines arrive with a stagger, and the heartbeat and breathing are small
procedural scale curves.

**Organ models.** Each organ is a GLB (`public/organs/*.glb`), with its labelled structures,
groups, colours and credits described in `src/organ-models.json`. Models load on first open
and stay cached after that.

---

## Project structure

```
src/
  App.jsx               layout, search, quick picks, tools, views, hover label, shortcuts, loader
  store.js              zustand store, search index, selection timeline, quiz logic
  links.js              URL hash <-> current view (shareable links)
  data.js               body systems, colours, featured structures, quiz rounds, copy
  organs.js             organ deep-dives: body concepts, copy, facts, idle animation, quick picks
  organ-models.json     organ model data: structures, groups, colours, credits
  motion.js             all timings + spring / heartbeat / breathing helpers
  styles.css            design tokens (light + dark), layout, components
  scene/
    Stage.jsx           R3F canvas: lights, body, picking, camera rig, floor shadow, PNG export
    meshes.js           chunk loading, mesh building, materials, BVH, applyState()
    fx.js               shared animated values (ghost fade, press flash, organ dissolve)
    OrganDetail.jsx     lifted-out organ: fade, spring, idle motion, part picking
    organLoader.js      cached GLB loading
  ui/
    Sidebar.jsx         navigation, system layers, quiz entry, featured card
    Panel.jsx           right column: overview, system, selection, organ and quiz views
    Icon.jsx            24px stroke icon set
public/
  models/               atlas.json manifest + body-*.bin.gz geometry chunks
  organs/               14 organ GLBs + ATTRIBUTION.md
  ATTRIBUTION.md        full data credits
docs/screenshots/       images used in this README
```

---

## Customising

- **Add a quiz round:** add an entry to `QUIZ` in `src/data.js` with a title, the
  BodyParts3D concept names, a system and a one-line hint. Rounds whose concepts don't
  exist in the atlas are skipped automatically.
- **Change the quick picks:** edit `PICKS` at the bottom of `src/organs.js`.
- **Retune an animation:** change the value in `src/motion.js`. Every move reads from there.
- **Re-colour a system:** edit its `color` in `SYSTEMS` in `src/data.js`. The 3D materials,
  swatches and chips all follow it.
- **Theme colours:** every UI colour is a CSS custom property at the top of `src/styles.css`,
  with the dark values under `:root[data-theme='dark']`.

---

## Browser support & performance

- Works in current Chrome, Edge, Firefox and Safari, on desktop and mobile. It needs WebGL,
  which is on by default unless hardware acceleration is disabled.
- About 2.29 million triangles across 2,234 meshes. Device pixel ratio is capped at 2 to
  keep high-density screens smooth.
- The first load is about 31 MB of geometry plus up to 14 organ models that load as you open
  them. After that, everything comes from the browser cache.
- On touch screens, hover labels and shortcut hints are hidden, and the native share sheet
  is used for links.

---

## Deployment

`npm run build` outputs a fully static site to `dist/`. You can host it on any static host,
such as Vercel, Netlify, Cloudflare Pages or GitHub Pages, with no server or environment
variables.

If your host serves `.gz` files with `Content-Encoding: gzip`, the browser decompresses them
automatically. If it serves them as plain binary, the app decompresses them itself. Both
work.

---

## Roadmap

- Exploded view that spreads the visible pieces apart
- Browse by region: head & neck, trunk, upper and lower limbs
- Labels pinned to the model with leader lines
- Per-layer opacity sliders
- Fewer draw calls by merging static meshes
- One static page per system for search engines, plus offline caching (PWA)

Research notes and earlier milestones are in [PLAN.md](PLAN.md).

---

## Data, credits & licence

- **Anatomy:** [BodyParts3D 4.0](https://lifesciencedb.jp/bp3d/), © The Database Center for
  Life Science (DBCLS), licensed **CC BY 4.0**.
- **Packed browser geometry:** [ashemag/human-atlas](https://github.com/ashemag/human-atlas)
  (MIT code, CC BY 4.0 data).
- **Organ models:** [OrganUI](https://github.com/organui) explorers (MIT code). Each model's
  licence (CC BY 4.0 or CC BY-SA) is listed in `public/organs/ATTRIBUTION.md` and shown in
  the organ panel.
- **Fonts:** Newsreader and Inter, via Google Fonts.

Full attribution is in [`public/ATTRIBUTION.md`](public/ATTRIBUTION.md).

> **Educational use only.** Body Atlas is a learning tool, not a clinical or diagnostic
> reference. The reference body is a single adult male; real anatomy varies.
