import { useMemo } from 'react'
import { useAtlas, index } from '../store.js'
import { SYSTEMS } from '../data.js'
import Icon from './Icon.jsx'

export default function Sidebar() {
  const ready = useAtlas((s) => s.ready)
  const visible = useAtlas((s) => s.visible)
  const focusSystem = useAtlas((s) => s.focusSystem)
  const selection = useAtlas((s) => s.selection)
  const quiz = useAtlas((s) => s.quiz)
  const { toggleSystem, showSystem, showAll, openOrgan, startQuiz } = useAtlas.getState()

  const counts = useMemo(() => {
    const c = {}
    for (const p of index.parts.values()) c[p.system] = (c[p.system] ?? 0) + 1
    return c
  }, [ready])

  const homeActive = !focusSystem && !selection && !quiz
  const featuredActive = selection?.kind === 'organ' && selection.organKey === 'heart'

  return (
    <aside className="sidebar">
      <a className="brand" href="#" onClick={(e) => { e.preventDefault(); showAll() }}>
        Body Atlas
      </a>
      <nav className="side-nav" aria-label="Body systems">
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
        <div className="nav-label">Systems</div>
        <div className="nav-scroll">
          {SYSTEMS.map((s) => {
            const on = visible.has(s.id)
            return (
              <div key={s.id} className={`nav-row system-row ${focusSystem === s.id ? 'is-active' : ''} ${on ? '' : 'is-off'}`}>
                <button className="system-main" onClick={() => showSystem(s.id)}>
                  <span className="swatch" style={{ '--c': s.color }} />
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
            )
          })}
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
