// Every timing in the experience lives here, in seconds, so one edit retunes a move.
// Clicking an organ is written as an event:
//   press   — the click registers (glow flash)
//   clear   — the rest of the body steps back (ghost fade)
//   fly     — the camera springs to the organ
//   lift    — the detail model emerges as the body organ dissolves
//   reveal  — the panel text arrives after the camera lands, one line at a time
//   hold    — only the organ moves (heartbeat / breathing) while you read

export const REDUCED =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export const MOTION = {
  press: { flash: 1.5, settle: 0.35, rate: 5 }, // emissive intensity, decay rate (1/s)
  clear: { at: 0.1, from: 0.55, ghost: 0.09, organGhost: 0.035, rate: 7 },
  fly: { at: 0.16, smoothTime: 0.55 },
  lift: { at: 0.9, from: 0.86, dissolveRate: 6 },
  settle: { smoothTime: 0.7 }, // camera re-frames the detail model after the lift
  reveal: { at: 0.85, stagger: 0.09, duration: 0.5, quick: 0.15 },
  back: { at: 0.32, smoothTime: 0.6 },
  idle: {
    heartbeat: { bpm: 66, amount: 0.03 },
    breath: { perMinute: 14, amount: 0.03 },
  },
  springs: {
    lift: { stiffness: 140, damping: 15 }, // slight overshoot on landing
    fade: { stiffness: 90, damping: 19 },
  },
}

/** Seconds → milliseconds for timers; zero when the user prefers reduced motion. */
export const ms = (seconds) => (REDUCED ? 0 : seconds * 1000)

/** Damped spring on a { x, v } state. Snaps when motion is reduced. */
export function spring(state, target, { stiffness, damping }, dt) {
  if (REDUCED) {
    state.x = target
    state.v = 0
    return state.x
  }
  const h = Math.min(dt, 1 / 30)
  state.v += (-stiffness * (state.x - target) - damping * state.v) * h
  state.x += state.v * h
  return state.x
}

/** Frame-rate independent exponential approach. */
export function damp(current, target, rate, dt) {
  if (REDUCED) return target
  return current + (target - current) * (1 - Math.exp(-rate * Math.min(dt, 1 / 20)))
}

const bump = (p, centre, width) => Math.exp(-((p - centre) ** 2) / (2 * width * width))
const easeInOut = (t) => t * t * (3 - 2 * t)

/** "Lub-dub": a strong beat followed by a softer one, as a scale factor. */
export function heartbeat(t, { bpm, amount }) {
  const p = ((t * bpm) / 60) % 1
  return 1 + amount * (bump(p, 0.1, 0.035) + 0.55 * bump(p, 0.31, 0.04))
}

/** Breathing: inhale over 40% of the cycle, exhale over the rest. */
export function breath(t, { perMinute, amount }) {
  const p = ((t * perMinute) / 60) % 1
  const e = p < 0.4 ? easeInOut(p / 0.4) : 1 - easeInOut((p - 0.4) / 0.6)
  return 1 + amount * e
}
