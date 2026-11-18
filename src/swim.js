// One stroke of the bell, for the animation (character.js). player.js advances the phase, faster
// the harder you push; the move speed itself stays steady. p is the stroke phase, 0..1.
//
//   0.00-0.30  power stroke: the bell squeezes shut, pushing water out, and the jelly surges
//   0.30-1.00  recovery: the bell relaxes open wider than rest while the jelly glides and slows,
//              then the bell's recoil gives a small second push (passive energy recapture)
//   idle only  the stroke is squeezed into the front of the cycle, the rest is a still hold
//              while the jelly sinks a little, then the next pulse lifts it again
//
// The numbers are `--jelly-motion-*` in content/look.css, read on first use (this file loads
// before look.css does).
import { LOOK } from './look.js';

const POWER = 0.3;

// Bell shape: 1 = squeezed shut, 0 = at rest, negative = relaxed open
export function squeeze(p) {
  return p < POWER ? Math.sin((Math.PI * p) / POWER) : -0.35 * Math.sin((Math.PI * (p - POWER)) / (1 - POWER));
}

let K = null;
const knobs = () => K ||= {
  second: Math.max(0, LOOK.num('jelly-motion-second-surge', 0.33)),   // second push, as a share of the first
  at: LOOK.num('jelly-motion-second-at', 0.8),
  width: Math.max(0.01, LOOK.num('jelly-motion-second-width', 0.09)),
  hold: Math.min(0.9, Math.max(0.01, LOOK.num('jelly-motion-idle-hold', 0.33))),      // share of an idle cycle spent holding still
  sink: LOOK.num('jelly-motion-idle-sink', 0.02),        // how far it sinks in that hold (jelly heights)
  mean: 1, peak: 1,
};
const bumps = (p, k) => Math.exp(-(((p - 0.22) / 0.12) ** 2)) + k.second * Math.exp(-(((p - k.at) / k.width) ** 2));
function shape() {
  const k = knobs();
  if (k.peak === 1) {   // once: normalise so a stroke's push averages 1 (the move speed stays steady)
    let sum = 0, peak = 0;
    for (let i = 0; i < 1000; i++) { const v = bumps(i / 1000, k); sum += v; peak = Math.max(peak, v); }
    k.mean = sum / 1000; k.peak = peak / k.mean;
  }
  return k;
}

// Push from the stroke: a big surge just after the squeeze and a small second one late in the
// glide. Averages 1 over a stroke.
export function thrust(p) { const k = shape(); return bumps(p, k) / k.mean; }
// The first surge's height, for scaling what the push does to the body
export const thrustPeak = () => shape().peak;

// Idle strokes squeeze into the front of the cycle (the stroke itself is quicker, the cycle isn't
// longer) and the rest is a hold. `idle` is 0 (moving) .. 1 (still); returns the share of the
// cycle that is held, the phase to play the stroke at, and how far the held jelly has sunk.
export function holdOf(idle) { return knobs().hold * idle; }
export function strokeAt(p, hold) { return hold > 0 ? Math.min(1, p / (1 - hold)) : p; }
export function sinkOf(p, hold) {
  if (hold <= 0) return 0;
  const u = p > 1 - hold ? (p - 1 + hold) / hold : p < 0.15 ? 1 - p / 0.15 : 0;   // sinks through the hold, rises as the next pulse starts
  return knobs().sink * (hold / knobs().hold) * u * u * (3 - 2 * u);
}

// Strokes per second: slow idle pulsing, faster the harder you push and the faster you swim
export function strokeRate(push, speedMul = 1) {
  return (0.6 + 1.3 * push) * Math.sqrt(speedMul);
}

// Half-life spring with a wobble (Holden, "Spring-It-On: The Game Developer's Spring-Roll-Call"):
// s = { x, v } chases `goal`, closing about half the gap in a `halflife` s while swinging `freq`
// times a second. The exact solution, so 30 and 60 fps land in the same place. No allocation.
export function spring(s, goal, halflife, freq, dt) {
  const y = (2 * Math.LN2) / Math.max(1e-3, halflife), w = freq * 2 * Math.PI;
  const j0 = s.x - goal, j1 = s.v + y * j0, e = Math.exp(-y * dt), c = Math.cos(w * dt), n = Math.sin(w * dt);
  s.x = e * (j0 * c + (w > 0 ? (j1 / w) * n : j1 * dt)) + goal;
  s.v = e * (s.v * c - (j0 * w + (w > 0 ? (y * j1) / w : 0)) * n) + (w > 0 ? 0 : -e * y * j1 * dt);
}
