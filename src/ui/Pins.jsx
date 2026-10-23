import { useAtlas } from '../store.js'
import Icon from './Icon.jsx'

/**
 * Pinned labels over the canvas: a name card and a leader line per pin.
 * <PinProjector> in the scene positions them every frame, outside React.
 */
export default function Pins() {
  const pins = useAtlas((s) => s.pins)
  const ready = useAtlas((s) => s.ready)
  const organ = useAtlas((s) => s.selection?.kind === 'organ')
  const quiz = useAtlas((s) => !!s.quiz)
  // Labels would give quiz answers away, and an open organ has its own names.
  if (!ready || organ || quiz || !pins.length) return null
  const { selectConcept, selectPart, selectFeatured, removePin } = useAtlas.getState()
  const open = (p) => (p.kind === 'part' ? selectPart(p.ref) : p.kind === 'featured' ? selectFeatured(p.ref) : selectConcept(p.ref))
  return (
    <div className="pin-layer">
      <svg className="pin-lines" aria-hidden="true">
        {pins.map((p) => <polyline key={p.key} id={`pin-line-${p.key}`} style={{ opacity: 0 }} />)}
      </svg>
      {pins.map((p) => (
        <div key={p.key} id={`pin-${p.key}`} className="pin" style={{ opacity: 0 }}>
          <button className="pin-name" onClick={() => open(p)}>{p.label}</button>
          <button className="pin-x" onClick={() => removePin(p.key)} aria-label={`Unpin ${p.label}`}>
            <Icon name="close" size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
