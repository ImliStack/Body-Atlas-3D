import { useAtlas } from '../store.js'
import Icon from './Icon.jsx'

/** Edge handles that fold the side panels away to give the body the full width. */
export default function PanelToggles() {
  const panels = useAtlas((s) => s.panels)
  const toggle = useAtlas((s) => s.togglePanel)
  const btn = (side, open, label) => (
    <button className={`edge-toggle is-${side}`} onClick={() => toggle(side)} aria-expanded={open}
      aria-label={`${open ? 'Hide' : 'Show'} ${label}`} data-tip={`${open ? 'Hide' : 'Show'} ${label} · ${side === 'left' ? '[' : ']'}`}>
      <Icon name={(side === 'left') === open ? 'chevL' : 'chevron'} size={16} />
    </button>
  )
  return (
    <>
      {btn('left', panels.left, 'systems')}
      {btn('right', panels.right, 'details')}
    </>
  )
}
