# Body Atlas 3D — R&D + Plan

Goal: build a real 3D educational website (in the spirit of anatomy3datlas.com)
where the explorer itself runs fully in the browser, not just marketing renders.

## 1. Reference analysis — anatomy3datlas.com

| Layer | Finding |
|---|---|
| Website | **Astro** static site (`/_astro/*` hashed bundles, per-page CSS) behind **Cloudflare** |
| 3D on web | **None.** Every "model" on the site is a pre-rendered `.webp` (512w/1024w `srcset`) |
| Analytics | Firebase Analytics (gtag) + store-link detection script |
| Real 3D | Native apps (iOS / Android / macOS / Windows) by Catfish Animation Studio, sold via stores |
| IA | Two entry axes: **body region** (head, trunk, upper/lower limbs) and **system** (10 systems) |
| SEO | One static page per system / region, rich text, many images |

Takeaway: the site is a marketing shell; the product is a native app. Our
experiment goes further — the 3D explorer itself runs on the web.

### Second reference — bottega-di-leonardo-codex-3d.vercel.app
| Layer | Finding |
|---|---|
| Build | **None.** Raw ES modules (`./src/main.js`) + an import map pointing at vendored `three.module.js` |
| 3D | Vanilla **Three.js** + `OrbitControls`, PCF soft shadows, ACES tone mapping |
| Models | **100% procedural** — four Leonardo machines built from `LatheGeometry`, `TubeGeometry`, `ExtrudeGeometry` (no .glb files) |
| Materials | Procedural canvas textures + named swatch palettes (walnut, bronze, linen…) the user can swap |
| UX | Tabs per machine, buttons for drive / wireframe / exploded view / lanterns, technical-elevation drawings |

Takeaway: **hard-surface / mechanical** models can be written entirely in code
(the Arduino site does the same). **Organic anatomy cannot be hand-coded** —
it needs real scan/atlas data. So: procedural for machines, open datasets for bodies.
Ideas to borrow later: exploded view, material/colour swatches, wireframe toggle.

## 2. Research — what to build on

### Anatomy data (the hard part)
| Source | License | Notes |
|---|---|---|
| **BodyParts3D 4.0** (DBCLS, Japan) | **CC BY 4.0** (2025 relicense) | 2,234 OBJ meshes, FMA names. Used here. |
| Z-Anatomy | CC BY-SA 4.0 | Blender file, built on BodyParts3D; share-alike |
| HuBMAP Female Reference Organs v1.5 | CC BY 4.0 | GLB, organs + partial skeleton |

### Open-source repos
| Repo | ★ | Use |
|---|---|---|
| [ashemag/human-atlas](https://github.com/ashemag/human-atlas) | 4.3k, MIT | Browser-ready BodyParts3D chunks (meshopt-simplified, gz). **We reuse its packed data** (CC BY 4.0) and write our own viewer. |
| [ivershuo/somakine](https://github.com/ivershuo/somakine) | MIT | Anatomy viewer framework on three.js — ideas for layers |
| [pmndrs/react-three-fiber](https://github.com/pmndrs/react-three-fiber) | 33k, MIT | React renderer for three.js |
| [pmndrs/drei](https://github.com/pmndrs/drei) | 10k, MIT | Controls, environment, shadows, Bounds, Html |
| [yomotsu/camera-controls](https://github.com/yomotsu/camera-controls) | 2.4k, MIT | Smooth animated camera fly-to |
| [gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | 3.5k, MIT | Fast raycasting on heavy meshes |
| [donmccurdy/glTF-Transform](https://github.com/donmccurdy/glTF-Transform) | 2k, MIT | Optimise / Draco / meshopt GLB pipeline |
| [google/model-viewer](https://github.com/google/model-viewer) | 8.3k, Apache | Zero-code GLB viewer + AR (for simple pages) |

### npm packages (latest checked 2026-10-21)
- `three` 0.186 · `@react-three/fiber` 9.8 · `@react-three/drei` 10.7
- `@react-three/postprocessing` 3.2 · `three-mesh-bvh` 0.9 · `camera-controls` 3.1
- `zustand` 5 (state) · `gsap` 3.15 / `motion` 14 (UI animation) · `leva` (debug GUI)
- `gltfjsx` 6.5 / `@gltf-transform/cli` 4.5 (asset pipeline) · `r3f-perf` (profiling)
- Build: Vite. (Local Node is 18 → pinned Vite 5; Vite 8 needs Node ≥ 20.19.)

### Framework choice
**Vite + React 19 + React Three Fiber + drei**, plain CSS. Reasons: largest
ecosystem, declarative scene, easy UI overlay. Astro could wrap it later for SEO
pages (one static page per system, like the reference site).

## 3. Product — "Body Atlas" (UI after the Feather Atlas reference)

- Left sidebar: body systems with structure counts + "featured" card
- Top: quick-pick cards (Heart, Brain, Skull, Lungs…)
- Centre: 3D body, soft floor shadow, tool column (zoom, search, fit, light), 360° control, italic caption
- Right panel: system eyebrow, serif title, tags, description, key facts, "related structures"
- Header search over all 2,234 structures
- Click a structure → highlight, fly camera, show details; isolate mode

## 4. Milestones
1. ✅ R&D + plan
2. ✅ Scaffold + load BodyParts3D chunks + system toggles + selection + info panel
   (search, quick picks, ghost/isolate, camera fly-to, 360° turntable, mobile layout)
3. ✅ Organ deep-dive + motion system: click organ → press/clear/fly → OrganUI model lifts
   out → staggered panel → heartbeat/breathing hold; 14 organs, part-level details,
   reverse "back" move, one timing file (`src/motion.js`), reduced-motion support
4. ✅ UI pass after reviewing BioDigital Human, Zygote Body, Complete Anatomy, Visible Body and
   human-atlas: hover labels, BVH picking, preset views, x-ray, quiz mode, shareable URLs,
   PNG export, dark theme, shortcut sheet, WebGL fallback, mobile search on top
5. Exploded view, region axis (head / trunk / limbs), pinned labels with leader lines,
   per-layer opacity sliders, merged draw calls
6. Static SEO pages per system (Astro), PWA offline cache
7. Mobile layout + performance pass (BVH, LOD, merged draw calls)

## Attribution
BodyParts3D, © The Database Center for Life Science, CC BY 4.0.
Packed geometry from ashemag/human-atlas (MIT code, CC BY 4.0 data).
