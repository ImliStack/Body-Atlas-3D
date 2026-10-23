import { useMemo, useState } from 'react'
import { useAtlas, index } from '../store.js'
import { SYSTEMS, REGIONS } from '../data.js'
import Icon from './Icon.jsx'

function storedFolds() {
  try {
    return JSON.parse(localStorage.getItem('atlas-folds')) ?? {}
  } catch {
    return {}
  }
}

/** A sidebar group whose header folds it away; the folded state is remembered per browser. */
function Group({ id, title, folds, setFolds, aside, children }) {
  const open = !folds[id]
  const toggle = () => {
    const next = { ...folds, [id]: open }
    setFolds(next)
    try { localStorage.setItem('atlas-folds', JSON.stringify(next)) } catch {}
  }
  return (
    <div className={`nav-group ${open ? 'is-open' : ''}`}>
      <div className="nav-label">
        <button className="fold" onClick={toggle} aria-expanded={open}>
          <Icon name="chevDown" size={14} className="fold-chev" />
          {title}
        </button>
        {open && aside}
      </div>
      {open && children}
    </div>
  )
}

function OpacityRow({ system, value }) {
  const setOpacity = useAtlas((s) => s.setOpacity)
  return (
    <label className="opacity-row" style={{ '--c': system.color }}>
      <span className="sr-only">{system.name} opacity</span>
      <input type="range" min="0" max="1" step="0.05" value={value}
        onChange={(e) => setOpacity(system.id, Number(e.target.value))}
        style={{ '--p': `${value * 100}%` }} />
      <span className="opacity-val">{Math.round(value * 100)}%</span>
    </label>
  )
}

export default function Sidebar() {
  const ready = useAtlas((s) => s.ready)
  const visible = useAtlas((s) => s.visible)
  const focusSystem = useAtlas((s) => s.focusSystem)
  const region = useAtlas((s) => s.region)
  const selection = useAtlas((s) => s.selection)
  const quiz = useAtlas((s) => s.quiz)
  const opacityOpen = useAtlas((s) => s.opacityOpen)
  const layerOpacity = useAtlas((s) => s.layerOpacity)
  const { toggleSystem, showSystem, showAll, showRegion, openOrgan, startQuiz, toggleOpacityOpen, resetOpacity } = useAtlas.getState()
  const [folds, setFolds] = useState(storedFolds)

  const counts = useMemo(() => {
    const c = {}
    for (const p of index.parts.values()) c[p.system] = (c[p.system] ?? 0) + 1
    return c
  }, [ready])

  const homeActive = !focusSystem && !region && !selection && !quiz
  const featuredActive = selection?.kind === 'organ' && selection.organKey === 'heart'
  const faded = Object.values(layerOpacity).some((v) => v < 1)

  return (
    <aside className="sidebar">
      <a className="brand" href="#" onClick={(e) => { e.preventDefault(); showAll() }}>
        Body Atlas
      </a>
      <nav className="side-nav" aria-label="Body systems and regions">
        <button className={`nav-row ${homeActive ? 'is-active' : ''}`} onClick={showAll}>
          <Icon name="home" />
          <span className="nav-text"><span className="nav-title">Whole body</span></span>
        </button>
        <button className={`nav-row ${featuredActive ? 'is-active' : ''}`} onClick={() => openOrgan('heart')}>
          <Icon name="star" />
          <span className="nav-text"><span className="nav-title">Featured</span></span>
        </button>
        <button className={`nav-row ${quiz ? 'is-active' : ''}`} onClick={startQuiz} disabled={!ready}>
          <Icon name="target" />
          <span className="nav-text"><span className="nav-title">Quiz yourself</span></span>
        </button>
        <div className="nav-scroll">
          <Group id="regions" title="Regions" folds={folds} setFolds={setFolds}>
            <div className="region-grid">
              {REGIONS.map((r) => (
                <button key={r.id} className={`region-btn ${region === r.id ? 'is-active' : ''}`} disabled={!ready}
                  onClick={() => showRegion(r.id)} aria-pressed={region === r.id}>
                  <Icon name={r.icon} size={18} />
                  <span>{r.name}</span>
                </button>
              ))}
            </div>
          </Group>
          <Group id="systems" title="Systems" folds={folds} setFolds={setFolds}
            aside={
              <span className="nav-aside">
                {faded && opacityOpen && (
                  <button className="mini-btn is-icon" onClick={resetOpacity} aria-label="Reset opacity" data-tip="Reset all to 100%">
                    <Icon name="rotL" size={13} />
                  </button>
                )}
                <button className={`mini-btn ${opacityOpen ? 'is-on' : ''}`} onClick={toggleOpacityOpen} aria-pressed={opacityOpen}
                  data-tip="Fade each layer">
                  <Icon name="sliders" size={14} /> Opacity
                </button>
              </span>
            }>
            {SYSTEMS.map((s) => {
              const on = visible.has(s.id)
              return (
                <div key={s.id} className={`system-wrap ${on ? '' : 'is-off'}`}>
                  <div className={`nav-row system-row ${focusSystem === s.id ? 'is-active' : ''}`}>
                    <button className="system-main" onClick={() => showSystem(s.id)}>
                      <span className="swatch" style={{ '--c': s.color, opacity: on ? Math.max(0.25, layerOpacity[s.id] ?? 1) : undefined }} />
                      <span className="nav-text">
                        <span className="nav-title">{s.name}</span>
                        <span className="nav-sub">{counts[s.id] ? `${counts[s.id]} structures` : '—'}</span>
                      </span>
                    </button>
                    <button className="eye" onClick={() => toggleSystem(s.id)}
                      aria-label={`${on ? 'Hide' : 'Show'} ${s.name}`} title={on ? 'Hide layer' : 'Show layer'}>
                      <Icon name={on ? 'eye' : 'eyeOff'} size={17} />
                    </button>
                  </div>
                  {opacityOpen && on && <OpacityRow system={s} value={layerOpacity[s.id] ?? 1} />}
                </div>
              )
            })}
          </Group>
        </div>
      </nav>

      <div className="feature-card">
        <div className="eyebrow">Featured structure</div>
        <div className="feature-art" aria-hidden="true">
          <svg viewBox="0 0 120 80">
            <path d="M60 70C30 50 18 36 18 24a16 16 0 0 1 30-8c4 6 8 6 12 0a16 16 0 0 1 30 8c0 12-12 26-30 46z"
              fill="#b9605a" opacity=".9" />
            <path d="M48 14c4-8 8-10 12-10M70 12c2-6 6-9 10-9" stroke="#8f3f3a" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <h3>A rhythm that never rests.</h3>
        <p>Four chambers, two circuits and around 100,000 beats every day.</p>
        <button className="link-btn" disabled={!ready} onClick={() => openOrgan('heart')}>
          Explore the heart <Icon name="arrow" size={16} />
        </button>
      </div>
    </aside>
  )
}
