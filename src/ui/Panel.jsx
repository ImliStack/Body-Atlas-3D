import { useMemo } from 'react'
import { useAtlas, index, selectionBounds, systemBlurb, partsOfConcepts, pinOf } from '../store.js'
import { SYSTEMS, SYSTEM_BY_ID, REGION_BY_ID, pretty } from '../data.js'
import { BODIES } from '../bodies.js'
import { ORGANS } from '../organs.js'
import { MOTION, REDUCED } from '../motion.js'
import Icon from './Icon.jsx'


function Facts({ rows }) {
return (



Key facts


{rows.map(([icon, k, v]) => (




{k}


{v}



))}



)
}



function sizeLabel(partIds) {
const [min, max] = selectionBounds(partIds)
const d = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * 100
return d >= 10 ? ≈ ${Math.round(d)} cm : ≈ ${d.toFixed(1)} cm
}


function sideOf(name) {
if (/^left\b/i.test(name) || /\sL$|left$/.test(name)) return 'Left'
if (/^right\b/i.test(name) || /\sR$|right$/.test(name)) return 'Right'
return 'Midline / both'
}


const millions = (n) => ${(n / 1e6).toFixed(2)} million


function Overview() {
const ready = useAtlas((s) => s.ready)
const body = BODIES[useAtlas((s) => s.body)]
const m = ready ? index.meta : null
const n = (v) => (m ? v.toLocaleString('en') : '…')


return (
<>

{body.eyebrow}


The Human Body



3D atlas
{m ? ${m.systems} systems : body.label}
Free & open




A full-body anatomy explorer that runs in your browser. Turn the body, peel back layers by system
and click any structure — a bone, a vessel, a nerve — to learn what it is and where it sits.


{body.note && 
{body.note}
}
<Facts rows={[
['cube', 'Structures', n(m?.parts)],
['layers', 'Systems', n(m?.systems)],
['spark', 'Named concepts', n(m?.concepts)],
['ruler', 'Triangles', m ? millions(m.triangles) : '…'],
['link', 'Source', body.source],
]} />



How to explore




Drag to orbit · scroll to zoom · right-drag to pan


Click a structure to inspect it


Use the  toggles to show or hide systems, or Opacity to fade them


Pick a region to study the head, trunk or limbs on their own


 Explode spreads the pieces apart;  pins labels





</>
)
}



function SystemView({ id }) {
const s = SYSTEM_BY_ID[id]
const ready = useAtlas((st) => st.ready)
const body = useAtlas((st) => st.body)


const count = useMemo(
() => [...index.parts.values()].filter((p) => p.system === id).length,
[id, ready]
)


const examples = useMemo(() => {
const names = new Set()
for (const p of index.parts.values()) {
if (p.system !== id) continue
names.add(p.name.replace(/^(left|right) /i, ''))
if (names.size >= 8) break
}
return [...names]
}, [id, ready])


const selectConcept = useAtlas.getState().selectConcept


return (
<>

{s.latin}


{s.name}


Body system{count} structures


{systemBlurb(id, body)}




Start with



{examples.map((n) => (
<button key={n} className="chip" onClick={() => {
const c = index.concepts.get(n.toLowerCase())
if (c) selectConcept(n)
else {
const p = [...index.parts.values()].find((x) => x.name.toLowerCase().endsWith(n.toLowerCase()))
if (p) useAtlas.getState().selectPart(p.id)
}
}}>{pretty(n)}
))}




</>
)
}



const REGION_STARTS = {
head: ['skull', 'brain', 'mandible', 'left eyeball', 'hyoid bone'],
trunk: ['heart', 'right lung', 'liver', 'stomach', 'rib cage', 'right kidney', 'uterus'],
upper: ['humerus', 'radius', 'ulna', 'scapula', 'clavicle'],
lower: ['femur', 'tibia', 'patella', 'fibula', 'calcaneus'],
}


function RegionView({ id }) {
const r = REGION_BY_ID[id]
const ready = useAtlas((s) => s.ready)
const { selectConcept, showAll } = useAtlas.getState()


const bySystem = useMemo(() => {
const c = {}
for (const pid of index.regionParts.get(id) ?? []) {
const sys = index.parts.get(pid).system
c[sys] = (c[sys] ?? 0) + 1
}
return SYSTEMS.filter((s) => c[s.id])
.map((s) => [s, c[s.id]])
.sort((a, b) => b[1] - a[1])
}, [id, ready])


const total = bySystem.reduce((n, [, k]) => n + k, 0)
const top = bySystem[0]?.[1] ?? 1
const starts = REGION_STARTS[id].filter((n) => partsOfConcepts([n]).length)


return (
<>



{r.latin}







{r.name}


Body region{total.toLocaleString()} structures


{r.blurb}

{starts.length > 0 && (



Start with



{starts.map((n) => (
<button key={n} className="chip" onClick={() => selectConcept(n)}>{pretty(n)}
))}




)}



By system



{bySystem.map(([s, k]) => (
<li key={s.id} style={{ '--c': s.color }}>
{s.name}
<span style={{ transform: scaleX(${k / top}) }} />
{k}

))}




</>
)
}



function SelectionView({ sel }) {
const { selectConcept, clearSelection, toggleIsolate, togglePin } = useAtlas.getState()
const isolate = useAtlas((s) => s.isolate)
const pinKey = pinOf(sel).key
const pinned = useAtlas((s) => s.pins.some((p) => p.key === pinKey))
const system = SYSTEM_BY_ID[sel.system]
const first = index.parts.get(sel.partIds[0])
const f = sel.featured


const partOf = useMemo(() => {
if (sel.kind !== 'part') return []
return (index.partConcepts.get(sel.partIds[0]) ?? [])
.filter((c) => c.name.toLowerCase() !== sel.name.toLowerCase() && c.elements.length > 1)
.slice(0, 6)
}, [sel])


const facts = f
? [...f.facts, ['ruler', 'Model size', sizeLabel(sel.partIds)]]
: [
['layers', 'System', system?.name ?? sel.system],
['pin', 'Region', first ? REGION_BY_ID[index.partRegion.get(first.id)].name : '—'],
['side', 'Side', sideOf(sel.name)],
['ruler', 'Model size', sizeLabel(sel.partIds)],
['cube', 'Meshes', sel.partIds.length.toLocaleString()],
]


return (
<>



{f ? f.latin : system?.name}


<button className={icon-btn ghost ${pinned ? 'is-on' : ''}} onClick={() => togglePin(sel)} aria-pressed={pinned}
aria-label={pinned ? 'Unpin label' : 'Pin a label on the body'} title={pinned ? 'Unpin label' : 'Pin label'}>








<h1 className={title ${sel.name.length > 22 ? 'is-long' : ''}}>{sel.name}


{(f?.tags ?? [system?.name, sel.kind === 'concept' ? 'Group' : 'Structure']).map((t) => {t})}



{f ? f.text : systemBlurb(sel.system)}


{partOf.length > 0 && (



Part of



{partOf.map((c) => (
<button key={c.id} className="chip" onClick={() => selectConcept(c.name)}>{pretty(c.name)}
))}




)}
<button className={detail-card ${isolate ? 'is-on' : ''}} onClick={toggleIsolate}>
<span className="detail-swatch" style={{ '--c': system?.color ?? '#b9605a' }} />

{isolate ? 'Back to full body' : 'Close-up detail'}
{isolate ? 'Bring every visible layer back around this structure.' : 'Isolate this structure and study it on its own from every angle.'}



</>
)
}



function OrganPanel({ sel }) {
const organ = ORGANS[sel.organKey]
const model = organ.model
const structureId = useAtlas((s) => s.structureId)
const phase = useAtlas((s) => s.organPhase)
const organError = useAtlas((s) => s.organError)
const { clearSelection, selectStructure } = useAtlas.getState()


const groups = useMemo(() => {
const byGroup = new Map()
for (const s of model.structures) {
if (!byGroup.has(s.group)) byGroup.set(s.group, [])
byGroup.get(s.group).push(s)
}
return [...byGroup]
}, [model])


const structure = model.structures.find((s) => s.id === structureId)
const ready = phase === 'detail'


return (
<>



 Body


{organ.latin}




{organ.title}


{organ.tags.map((t) => {t})}


{organ.text}

{structure && (
<div className="structure-card" key={structure.id} style={{ '--c': structure.color }}>

{structure.group}


{structure.label}


{structure.description}


)}
{organError && 
{organError}
}



Structures


{ready ? 'Click the model, or a name below.' : 'Lifting the organ out of the body…'}

{groups.map(([group, list]) => (



{group}



{list.map((s) => (
<button key={s.id} className={chip struct ${s.id === structureId ? 'is-on' : ''}}
style={{ '--c': s.color }} disabled={!ready} aria-pressed={s.id === structureId}
onClick={() => selectStructure(s.id)}>
{s.label}

))}




))}





3D model: {model.attribution.credit}
{' '}· prepared by OrganUI


</>
)
}



export default function Panel() {
const selection = useAtlas((s) => s.selection)
const focusSystem = useAtlas((s) => s.focusSystem)
const revealAt = useAtlas((s) => s.revealAt)
const region = useAtlas((s) => s.region)


const key = selection
? selection.kind === 'organ' ? organ-${selection.organKey} : selection.name
: focusSystem ?? (region ? region-${region} : 'overview')


const style = {
'--reveal-at': ${REDUCED ? 0 : revealAt}s,
'--reveal-stagger': ${REDUCED ? 0 : MOTION.reveal.stagger}s,
'--reveal-dur': ${REDUCED ? 0.01 : MOTION.reveal.duration}s,
}


return (


{selection?.kind === 'organ' ? 
: selection ? 
: focusSystem ? 
: region ? 
: }

)
}



