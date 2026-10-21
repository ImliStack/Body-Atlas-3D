import { useMemo } from 'react'
import { useAtlas, index, selectionBounds } from '../store.js'
import { SYSTEM_BY_ID, regionOf, pretty } from '../data.js'
import { ORGANS } from '../organs.js'
import { MOTION, REDUCED } from '../motion.js'
import Icon from './Icon.jsx'

function Facts({ rows }) {
  return (
    <section className="block">
      <h2>Key facts</h2>
      <dl className="facts">
        {rows.map(([icon, k, v]) => (
          <div className="fact" key={k}>
            <Icon name={icon} size={19} />
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function sizeLabel(partIds) {
  const [min, max] = selectionBounds(partIds)
  const d = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * 100
  return d >= 10 ? `≈ ${Math.round(d)} cm` : `≈ ${d.toFixed(1)} cm`
}

function sideOf(name) {
  if (/^left\b/i.test(name)) return 'Left'
  if (/^right\b/i.test(name)) return 'Right'
  return 'Midline / both'
}

function Overview() {
  const ready = useAtlas((s) => s.ready)
  const total = ready ? index.parts.size.toLocaleString() : '2,234'
  return (
    <>
      <div className="eyebrow">Homo sapiens · adult male reference</div>
      <h1 className="title">The Human Body</h1>
      <div className="tags"><span>3D atlas</span><span>15 systems</span><span>Free & open</span></div>
      <p className="lede">
        A full-body anatomy explorer that runs in your browser. Turn the body, peel back layers by system
        and click any structure — a bone, a vessel, a nerve — to learn what it is and where it sits.
      </p>
      <Facts rows={[
        ['cube', 'Structures', total],
        ['layers', 'Systems', '15'],
        ['spark', 'Named concepts', '3,432'],
        ['ruler', 'Triangles', '2.29 million'],
      ]} />
      <section className="block">
        <h2>How to explore</h2>
        <ul className="howto">
          <li><b>Drag</b> to orbit · <b>scroll</b> to zoom · <b>right-drag</b> to pan</li>
          <li><b>Click</b> a structure to inspect it</li>
          <li>Use the <Icon name="eye" size={15} /> toggles to show or hide systems</li>
        </ul>
      </section>
    </>
  )
}

function SystemView({ id }) {
  const s = SYSTEM_BY_ID[id]
  const count = useMemo(() => [...index.parts.values()].filter((p) => p.system === id).length, [id])
  const examples = useMemo(() => {
    const names = new Set()
    for (const p of index.parts.values()) {
      if (p.system !== id) continue
      names.add(p.name.replace(/^(left|right) /i, ''))
      if (names.size >= 8) break
    }
    return [...names]
  }, [id])
  const selectConcept = useAtlas.getState().selectConcept
  return (
    <>
      <div className="eyebrow">{s.latin}</div>
      <h1 className="title">{s.name}</h1>
      <div className="tags"><span>Body system</span><span>{count} structures</span></div>
      <p className="lede">{s.blurb}</p>
      <section className="block">
        <h2>Start with</h2>
        <div className="chips">
          {examples.map((n) => (
            <button key={n} className="chip" onClick={() => {
              const c = index.concepts.get(n.toLowerCase())
              if (c) selectConcept(n)
              else {
                const p = [...index.parts.values()].find((x) => x.name.toLowerCase().endsWith(n.toLowerCase()))
                if (p) useAtlas.getState().selectPart(p.id)
              }
            }}>{pretty(n)}</button>
          ))}
        </div>
      </section>
    </>
  )
}

function SelectionView({ sel }) {
  const { selectConcept, clearSelection, toggleIsolate } = useAtlas.getState()
  const isolate = useAtlas((s) => s.isolate)
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
        ['pin', 'Region', first ? regionOf(first.bounds) : '—'],
        ['side', 'Side', sideOf(sel.name)],
        ['ruler', 'Model size', sizeLabel(sel.partIds)],
        ['cube', 'Meshes', sel.partIds.length.toLocaleString()],
      ]

  return (
    <>
      <div className="eyebrow-row">
        <div className="eyebrow">{f ? f.latin : system?.name}</div>
        <button className="icon-btn ghost" onClick={clearSelection} aria-label="Clear selection" title="Clear">
          <Icon name="close" size={17} />
        </button>
      </div>
      <h1 className={`title ${sel.name.length > 22 ? 'is-long' : ''}`}>{sel.name}</h1>
      <div className="tags">
        {(f?.tags ?? [system?.name, sel.kind === 'concept' ? 'Group' : 'Structure']).map((t) => <span key={t}>{t}</span>)}
      </div>
      <p className="lede">{f ? f.text : system?.blurb}</p>
      <Facts rows={facts} />
      {partOf.length > 0 && (
        <section className="block">
          <h2>Part of</h2>
          <div className="chips">
            {partOf.map((c) => (
              <button key={c.id} className="chip" onClick={() => selectConcept(c.name)}>{pretty(c.name)}</button>
            ))}
          </div>
        </section>
      )}
      <button className={`detail-card ${isolate ? 'is-on' : ''}`} onClick={toggleIsolate}>
        <span className="detail-swatch" style={{ '--c': system?.color ?? '#b9605a' }} />
        <span className="detail-text">
          <b>{isolate ? 'Back to full body' : 'Close-up detail'}</b>
          <small>{isolate ? 'Bring every visible layer back around this structure.' : 'Isolate this structure and study it on its own from every angle.'}</small>
        </span>
        <Icon name="chevron" size={18} />
      </button>
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
      <div className="eyebrow-row">
        <button className="back-btn" onClick={clearSelection} aria-label="Back to the whole body">
          <Icon name="arrow" size={15} className="flip" /> Body
        </button>
        <div className="eyebrow">{organ.latin}</div>
      </div>
      <h1 className="title">{organ.title}</h1>
      <div className="tags">{organ.tags.map((t) => <span key={t}>{t}</span>)}</div>
      <p className="lede">{organ.text}</p>
      {structure && (
        <div className="structure-card" key={structure.id} style={{ '--c': structure.color }}>
          <div className="eyebrow">{structure.group}</div>
          <h3><span className="chip-dot" />{structure.label}</h3>
          <p>{structure.description}</p>
        </div>
      )}
      {organError && <p className="organ-error">{organError}</p>}
      <section className="block">
        <h2>Structures</h2>
        <p className="hint">{ready ? 'Click the model, or a name below.' : 'Lifting the organ out of the body…'}</p>
        {groups.map(([group, list]) => (
          <div className="group" key={group}>
            <div className="group-name">{group}</div>
            <div className="chips">
              {list.map((s) => (
                <button key={s.id} className={`chip struct ${s.id === structureId ? 'is-on' : ''}`}
                  style={{ '--c': s.color }} disabled={!ready} aria-pressed={s.id === structureId}
                  onClick={() => selectStructure(s.id)}>
                  <span className="chip-dot" />{s.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
      <Facts rows={organ.facts} />
      <p className="credit">
        3D model: <a href={model.attribution.source} target="_blank" rel="noreferrer">{model.attribution.credit}</a>
        {' '}· prepared by OrganUI
      </p>
    </>
  )
}

function QuizPanel({ quiz }) {
  const { nextQuiz, endQuiz, startQuiz } = useAtlas.getState()
  const round = quiz.rounds[quiz.i]
  const total = quiz.rounds.length
  if (quiz.state === 'done') {
    const score = quiz.score
    const verdict = score >= total - 1 ? 'Anatomist’s eye.' : score >= total / 2 ? 'Solid work.' : 'A good start.'
    return (
      <>
        <div className="eyebrow">Quiz · finished</div>
        <h1 className="title">{verdict}</h1>
        <div className="quiz-score"><b>{score % 1 ? score.toFixed(1) : score}</b><span>/ {total}</span></div>
        <p className="lede">A first-try find scores a point, a second-try find half. Every round starts from the whole body.</p>
        <div className="quiz-actions">
          <button className="btn is-primary" onClick={startQuiz}>Play again</button>
          <button className="btn" onClick={endQuiz}>Back to the atlas</button>
        </div>
      </>
    )
  }
  const found = quiz.state === 'right' || quiz.state === 'reveal'
  return (
    <>
      <div className="eyebrow-row">
        <div className="eyebrow">Quiz · {quiz.i + 1} of {total}</div>
        <button className="icon-btn ghost" onClick={endQuiz} aria-label="End quiz" title="End quiz"><Icon name="close" size={17} /></button>
      </div>
      <div className="quiz-progress" aria-hidden="true"><span style={{ transform: `scaleX(${(quiz.i + (found ? 1 : 0)) / total})` }} /></div>
      <h1 className="title">Find the {round.title.toLowerCase()}</h1>
      <div className="tags">
        <span>{SYSTEM_BY_ID[round.system]?.latin}</span>
        <span>Score {quiz.score % 1 ? quiz.score.toFixed(1) : quiz.score}</span>
      </div>
      <p className="lede">Click it on the body. Drag to turn the body, scroll to come closer.</p>
      {quiz.state === 'wrong' && (
        <div className="quiz-note is-wrong" role="status">
          <b>Not quite{quiz.picked ? ` — that’s the ${quiz.picked.toLowerCase()}` : ''}.</b>
          <span>Hint: {round.hint}</span>
        </div>
      )}
      {quiz.state === 'right' && (
        <div className="quiz-note is-right" role="status"><b>Found it.</b><span>{round.hint}</span></div>
      )}
      {quiz.state === 'reveal' && (
        <div className="quiz-note" role="status">
          <b>Here it is.</b><span>{round.hint}</span>
        </div>
      )}
      {found && (
        <div className="quiz-actions">
          <button className="btn is-primary" onClick={nextQuiz} autoFocus>
            {quiz.i + 1 < total ? 'Next structure' : 'See your score'} <Icon name="arrow" size={16} />
          </button>
        </div>
      )}
    </>
  )
}

export default function Panel() {
  const selection = useAtlas((s) => s.selection)
  const focusSystem = useAtlas((s) => s.focusSystem)
  const revealAt = useAtlas((s) => s.revealAt)
  const quiz = useAtlas((s) => s.quiz)
  const key = quiz ? `quiz-${quiz.i}-${quiz.state === 'done'}` : selection
    ? selection.kind === 'organ' ? `organ-${selection.organKey}` : selection.name
    : focusSystem ?? 'overview'
  // Panel lines arrive one by one after the camera has landed (see MOTION.reveal).
  const style = {
    '--reveal-at': `${REDUCED ? 0 : revealAt}s`,
    '--reveal-stagger': `${REDUCED ? 0 : MOTION.reveal.stagger}s`,
    '--reveal-dur': `${REDUCED ? 0.01 : MOTION.reveal.duration}s`,
  }
  return (
    <aside className="panel" key={key} style={style}>
      {quiz ? <QuizPanel quiz={quiz} />
        : selection?.kind === 'organ' ? <OrganPanel sel={selection} />
        : selection ? <SelectionView sel={selection} />
        : focusSystem ? <SystemView id={focusSystem} /> : <Overview />}
    </aside>
  )
}
