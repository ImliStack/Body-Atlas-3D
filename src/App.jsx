import { Component, useEffect, useRef, useState } from 'react'
import Stage from './scene/Stage.jsx'
import Sidebar from './ui/Sidebar.jsx'
import Panel from './ui/Panel.jsx'
import Icon from './ui/Icon.jsx'
import Pins from './ui/Pins.jsx'
import PanelToggles from './ui/PanelToggles.jsx'
import { useAtlas, search, index, partsOfConcepts } from './store.js'
import { FEATURED, SYSTEM_BY_ID, REGION_BY_ID } from './data.js'
import { BODIES } from './bodies.js'
import { useHashLink } from './links.js'
import { ORGANS, PICKS } from './organs.js'
import { MOTION, REDUCED } from './motion.js'

function SearchBox() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ready = useAtlas((s) => s.ready)
  const results = ready ? search(q) : []
  const inputRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pick = (r) => {
    const st = useAtlas.getState()
    r.kind === 'concept' ? st.selectConcept(r.label) : st.selectPart(r.key)
    setQ('')
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <div className="search">
      <Icon name="search" size={17} />
      <input
        ref={inputRef}
        value={q}
        placeholder={ready ? 'Search anatomy' : 'Loading anatomy…'}
        disabled={!ready}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          if (e.key === 'Enter' && results[active]) pick(results[active])
          if (e.key === 'Escape') { setQ(''); e.currentTarget.blur() }
        }}
        aria-label="Search anatomy"
      />
      <kbd>/</kbd>
      {open && results.length > 0 && (
        <ul className="results" role="listbox">
          {results.map((r, i) => (
            <li key={r.kind + r.key} role="option" aria-selected={i === active}
              className={i === active ? 'is-active' : ''}
              onMouseDown={(e) => { e.preventDefault(); pick(r) }}
              onMouseEnter={() => setActive(i)}>
              <span>{r.label}</span>
              <small>{r.kind === 'concept' && r.size > 1 ? `${r.size} parts` : 'structure'}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function QuickPicks() {
  const body = useAtlas((s) => s.body)
  const selection = useAtlas((s) => s.selection)
  const ready = useAtlas((s) => s.ready)
  const { openOrgan, selectFeatured } = useAtlas.getState()
  return (
    <div className="picks" role="list">
      {PICKS.map((p) => {
        const item = p.organ ? ORGANS[p.organ] : FEATURED.find((f) => f.key === p.featured)
        const key = p.organ ?? p.featured
        const active = p.organ ? selection?.organKey === p.organ : selection?.featured?.key === p.featured
        // A pick with no match in the body on screen stays in place but greys out.
        const missing = ready && !partsOfConcepts(item.concepts).length
        return (
          <button key={key} role="listitem" disabled={!ready || missing} title={missing ? `Not in the ${BODIES[body].label.toLowerCase()} reference body` : undefined} className={`pick ${active ? 'is-active' : ''}`}
            onClick={() => (p.organ ? openOrgan(p.organ) : selectFeatured(p.featured))}>
            <span className="pick-dot" style={{ '--c': SYSTEM_BY_ID[item.system].color }} />
            <span className="pick-title">{item.title}</span>
            <span className="pick-latin">{item.latin}</span>
          </button>
        )
      })}
    </div>
  )
}

function Tools() {
  const st = useAtlas.getState()
  const light = useAtlas((s) => s.light)
  const isolate = useAtlas((s) => s.isolate)
  const xray = useAtlas((s) => s.xray)
  const hasSel = useAtlas((s) => !!s.selection)
  const organMode = useAtlas((s) => s.selection?.kind === 'organ')
  const ready = useAtlas((s) => s.ready)
  const quiz = useAtlas((s) => !!s.quiz)
  const explode = useAtlas((s) => s.explode)
  const pinsOn = useAtlas((s) => s.showPins && s.pins.length > 0)
  const hq = useAtlas((s) => s.hq)
  const focus = useAtlas((s) => !s.panels.left && !s.panels.right)
  const tool = (icon, tip, onClick, { on = false, disabled = false, key } = {}) => (
    <button className={`tool ${on ? 'is-on' : ''}`} onClick={onClick} disabled={disabled}
      aria-label={tip} aria-pressed={on} data-tip={key ? `${tip} · ${key}` : tip}>
      <Icon name={icon} />
    </button>
  )
  return (
    <div className="tools">
      <div className="tool-group">
        {tool('zoomIn', 'Zoom in', () => st.cameraCommand('zoomIn'), { key: '+' })}
        {tool('zoomOut', 'Zoom out', () => st.cameraCommand('zoomOut'), { key: '−' })}
        {tool('fit', 'Fit to view', () => st.cameraCommand(hasSel ? 'selection' : 'home'), { key: 'F' })}
      </div>
      <div className="tool-group">
        {tool('isolate', organMode ? 'Hide the body' : 'Isolate selection', st.toggleIsolate, { on: isolate, disabled: !hasSel, key: 'I' })}
        {tool('xray', 'X-ray', st.toggleXray, { on: xray, disabled: organMode, key: 'X' })}
        {tool('explode', 'Exploded view', st.toggleExplode, { on: explode, disabled: !ready || organMode || quiz, key: 'E' })}
        {tool('tag', 'Pinned labels', st.togglePins, { on: pinsOn, disabled: !ready || quiz, key: 'N' })}
      </div>
      <div className="tool-group">
        {tool('sun', 'Studio light', st.toggleLight, { on: light === 'contrast', key: 'L' })}
        {tool('hq', hq ? 'Ambient occlusion on' : 'Ambient occlusion off — faster', st.toggleHq, { on: hq, key: 'H' })}
        {tool('focus', 'Focus mode', () => st.togglePanel('focus'), { on: focus, key: '\\' })}
        {tool('camera', 'Save image', st.takeSnapshot, { disabled: !ready, key: 'P' })}
      </div>
    </div>
  )
}

/** Spread slider, shown while the exploded view is on. */
function ExplodeBar() {
  const explode = useAtlas((s) => s.explode)
  const amount = useAtlas((s) => s.explodeAmount)
  const multi = useAtlas((s) => (s.selection?.partIds.length ?? 0) > 1)
  const { setExplodeAmount, fitExplode, toggleExplode } = useAtlas.getState()
  if (!explode) return null
  return (
    <div className="explode-bar">
      <Icon name="explode" size={16} />
      <span>{multi ? 'Spread selection' : 'Spread'}</span>
      <input type="range" min="0.1" max="1" step="0.01" value={amount} aria-label="How far the pieces spread"
        style={{ '--p': `${((amount - 0.1) / 0.9) * 100}%` }}
        onChange={(e) => setExplodeAmount(Number(e.target.value))} onPointerUp={fitExplode} onKeyUp={fitExplode} />
      <button onClick={toggleExplode} aria-label="Put the body back together" title="Assemble (E)"><Icon name="close" size={14} /></button>
    </div>
  )
}

const VIEWS = [['front', 'Front', '1'], ['back', 'Back', '2'], ['leftSide', 'Left', '3'], ['rightSide', 'Right', '4']]

function Turntable() {
  const autoRotate = useAtlas((s) => s.autoRotate)
  const st = useAtlas.getState()
  return (
    <div className="turntable">
      <button onClick={() => st.cameraCommand('left')} aria-label="Rotate left"><Icon name="rotL" size={17} /></button>
      <button className={`spin ${autoRotate ? 'is-on' : ''}`} onClick={st.toggleAutoRotate} aria-pressed={autoRotate}
        title={autoRotate ? 'Stop turning (R)' : 'Auto-rotate (R)'}>360°</button>
      <button onClick={() => st.cameraCommand('right')} aria-label="Rotate right"><Icon name="rotR" size={17} /></button>
      <span className="turntable-sep" aria-hidden="true" />
      <div className="views" role="group" aria-label="Preset views">
        {VIEWS.map(([key, label, k]) => (
          <button key={key} onClick={() => st.view(key)} title={`${label} view (${k})`}>{label}</button>
        ))}
      </div>
    </div>
  )
}

function Caption() {
  const selection = useAtlas((s) => s.selection)
  const focusSystem = useAtlas((s) => s.focusSystem)
  const revealAt = useAtlas((s) => s.revealAt)
  const quiz = useAtlas((s) => s.quiz)
  const region = useAtlas((s) => s.region)
  const explode = useAtlas((s) => s.explode)
  let text = 'Turn the body slowly. Every structure is one click away.'
  if (quiz && quiz.state !== 'done') text = quiz.state === 'ask' || quiz.state === 'wrong'
    ? `Find the ${quiz.rounds[quiz.i].title.toLowerCase()}.` : quiz.state === 'right' ? 'Found it.' : 'Here it is.'
  else if (selection?.kind === 'organ') text = ORGANS[selection.organKey].caption
  else if (selection?.featured) text = selection.featured.caption
  else if (selection) text = 'Drag to look around it · scroll to come closer.'
  else if (focusSystem) text = `${SYSTEM_BY_ID[focusSystem].latin} — one thread through the whole body.`
  else if (region) text = `${REGION_BY_ID[region].latin} — every system, cut to one region.`
  else if (explode) text = 'Pulled apart, so every piece can be seen.'
  // The caption lands with the panel's last line, so it never competes with the camera move.
  const delay = REDUCED ? 0 : revealAt + 3 * MOTION.reveal.stagger
  if (quiz) return <p className="caption is-quiz" key={text}>{text}</p>
  return <p className="caption" key={text} style={{ animationDelay: `${delay}s` }}>{text}</p>
}

function Loader() {
  const status = useAtlas((s) => s.status)
  const progress = useAtlas((s) => s.progress)
  const error = useAtlas((s) => s.error)
  if (status === 'ready') return null
  return (
    <div className="loader" role="status" aria-live="polite">
      {status === 'error' ? (
        <p className="loader-error">{error}</p>
      ) : (
        <>
          <div className="loader-track"><span style={{ transform: `scaleX(${Math.max(progress, 0.03)})` }} /></div>
          <p>Assembling anatomy · {Math.round(progress * 100)}%</p>
        </>
      )}
    </div>
  )
}

/** The structure name under the mouse, offset so it never sits under the cursor. */
function HoverLabel() {
  const hover = useAtlas((s) => s.hover)
  const part = hover && index.parts.get(hover.id)
  if (!part) return null
  const system = SYSTEM_BY_ID[part.system]
  return (
    <div className="hover-label" style={{ transform: `translate(${hover.x + 16}px, ${hover.y + 14}px)` }} aria-hidden="true">
      <span className="chip-dot" style={{ '--c': system?.color }} />
      <span>{part.name}</span>
      <small>{system?.name}</small>
    </div>
  )
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const NO_GL = 'This browser can’t draw 3D graphics right now. Turn on hardware acceleration, or try a recent Chrome, Edge, Firefox or Safari.'

/** Without WebGL (or if the scene crashes) the rest of the atlas still works; the loader shows why. */
class StageBoundary extends Component {
  state = { failed: !hasWebGL() }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidMount() {
    if (this.state.failed) useAtlas.getState().setError(NO_GL)
  }
  componentDidCatch() {
    useAtlas.getState().setError(NO_GL)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

const SHORTCUTS = [
  ['/', 'Search'], ['Esc', 'Back / clear'], ['F', 'Fit to view'], ['+ −', 'Zoom'],
  ['1 – 4', 'Preset views'], ['R', 'Auto-rotate'], ['I', 'Isolate selection'],
  ['X', 'X-ray'], ['E', 'Exploded view'], ['N', 'Pinned labels'], ['L', 'Studio light'],
  ['H', 'Ambient occlusion'], ['[  ]', 'Fold side panels'], ['\\', 'Focus mode'],
  ['P', 'Save image'], ['T', 'Light / dark theme'], ['?', 'This sheet'],
]

function HelpSheet() {
  const help = useAtlas((s) => s.help)
  const body = useAtlas((s) => s.body)
  const setHelp = useAtlas((s) => s.setHelp)
  if (!help) return null
  return (
    <div className="sheet-backdrop" onClick={() => setHelp(false)}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onClick={(e) => e.stopPropagation()}>
        <div className="eyebrow-row">
          <div className="eyebrow">Body Atlas</div>
          <button className="icon-btn ghost" onClick={() => setHelp(false)} aria-label="Close" autoFocus><Icon name="close" size={17} /></button>
        </div>
        <h2 id="sheet-title">Shortcuts & credits</h2>
        <dl className="keys hide-touch">
          {SHORTCUTS.map(([k, label]) => (
            <div key={label}><dt><kbd>{k}</kbd></dt><dd>{label}</dd></div>
          ))}
        </dl>
        <p className="sheet-credit">
          Anatomy from {BODIES[body].credit}; organ models from OrganUI.
          Educational use only — not a clinical tool. <a href="./ATTRIBUTION.md" target="_blank" rel="noreferrer">Full credits</a>
        </p>
      </div>
    </div>
  )
}

const KEYS = {
  f: (st) => st.cameraCommand(st.selection ? 'selection' : 'home'),
  '+': (st) => st.cameraCommand('zoomIn'),
  '=': (st) => st.cameraCommand('zoomIn'),
  '-': (st) => st.cameraCommand('zoomOut'),
  1: (st) => st.view('front'),
  2: (st) => st.view('back'),
  3: (st) => st.view('leftSide'),
  4: (st) => st.view('rightSide'),
  r: (st) => st.toggleAutoRotate(),
  i: (st) => st.selection && st.toggleIsolate(),
  x: (st) => st.selection?.kind !== 'organ' && st.toggleXray(),
  l: (st) => st.toggleLight(),
  p: (st) => st.ready && st.takeSnapshot(),
  t: (st) => st.toggleTheme(),
  e: (st) => st.ready && st.toggleExplode(),
  n: (st) => st.ready && st.togglePins(),
  h: (st) => st.toggleHq(),
  '[': (st) => st.togglePanel('left'),
  ']': (st) => st.togglePanel('right'),
  '\\': (st) => st.togglePanel('focus'),
  '?': (st) => st.setHelp(!st.help),
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const st = useAtlas.getState()
      if (e.key === 'Escape') {
        if (st.help) st.setHelp(false)
        else if (st.selection) st.clearSelection()
        else if (st.quiz) st.endQuiz()
        return
      }
      const run = KEYS[e.key.toLowerCase()]
      if (!run) return
      e.preventDefault()
      run(st)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

function useTheme() {
  const theme = useAtlas((s) => s.theme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#15130f' : '#f5f0e6')
  }, [theme])
}

function TopActions() {
  const theme = useAtlas((s) => s.theme)
  const { toggleTheme, setHelp } = useAtlas.getState()
  const [copied, setCopied] = useState(false)
  const share = async () => {
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: document.title, url: location.href })
      else {
        await navigator.clipboard.writeText(location.href)
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      }
    } catch {}
  }
  return (
    <div className="top-actions">
      <button className="icon-btn" onClick={share} aria-label="Copy a link to this view" data-tip={copied ? 'Link copied' : 'Share this view'}>
        <Icon name={copied ? 'check' : 'share'} />
      </button>
      <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle dark theme" data-tip={theme === 'dark' ? 'Light theme · T' : 'Dark theme · T'}>
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
      </button>
      <button className="icon-btn" onClick={() => setHelp(true)} aria-label="Shortcuts and credits" data-tip="Shortcuts & credits · ?">
        <Icon name="info" />
      </button>
    </div>
  )
}

export default function App() {
  useShortcuts()
  useTheme()
  useHashLink()
  const panels = useAtlas((s) => s.panels)
  return (
    <div className={`app ${panels.left ? '' : 'no-left'} ${panels.right ? '' : 'no-right'}`}>
      <Sidebar />
      <main className="stage">
        <StageBoundary><Stage /></StageBoundary>
        <Pins />
        <QuickPicks />
        <Tools />
        <PanelToggles />
        <Loader />
        <div className="stage-foot">
          <ExplodeBar />
          <Turntable />
          <Caption />
        </div>
      </main>
      <div className="right">
        <header className="topbar">
          <SearchBox />
          <TopActions />
        </header>
        <Panel />
      </div>
      <HoverLabel />
      <HelpSheet />
    </div>
  )
}
