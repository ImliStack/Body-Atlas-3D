import { MOTION, damp } from '../motion.js'

// Shared animated values for the body's materials. Store actions set targets;
// meshes.stepFx() eases the current values toward them every frame.
export const fx = {
  ghost: 1, // opacity of ghosted (non-selected) structures
  ghostTarget: MOTION.clear.ghost,
  flash: MOTION.press.settle, // emissive intensity of the selection
  glow: 1, // opacity of the selection; drops to 0 when the detail model takes over
  glowTarget: 1,
  explode: 0, // exploded-view spread, 0 = assembled
  explodeTarget: 0,
}

/** The click registers: the selection flashes, then settles. */
export function press() {
  fx.flash = MOTION.press.flash
}

/** The rest of the body steps back. Starts from a brighter ghost only when nothing was selected. */
export function clear(fromNothing, target = MOTION.clear.ghost) {
  if (fromNothing) fx.ghost = MOTION.clear.from
  fx.ghostTarget = target
  fx.glowTarget = 1
}

export function stepValues(dt) {
  fx.ghost = damp(fx.ghost, fx.ghostTarget, MOTION.clear.rate, dt)
  fx.flash = damp(fx.flash, MOTION.press.settle, MOTION.press.rate, dt)
  fx.glow = damp(fx.glow, fx.glowTarget, MOTION.lift.dissolveRate, dt)
  fx.explode = damp(fx.explode, fx.explodeTarget, MOTION.explode.rate, dt)
  if (Math.abs(fx.explode - fx.explodeTarget) < 1e-3) fx.explode = fx.explodeTarget
}
