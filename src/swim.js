// One stroke of the bell, for the animation (character.js). player.js advances the phase, faster
// the harder you push; the swim speed itself stays steady. p is the stroke phase, 0..1.
//
//   0.00-0.30  power stroke: the bell squeezes shut, pushing water out, and the jelly surges
//   0.30-1.00  recovery: the bell relaxes open wider than rest while the jelly glides and slows

const POWER = 0.3;

// Bell shape: 1 = squeezed shut, 0 = at rest, negative = relaxed open
export function squeeze(p) {
  return p < POWER ? Math.sin((Math.PI * p) / POWER) : -0.35 * Math.sin((Math.PI * (p - POWER)) / (1 - POWER));
}

// Push from the stroke, peaking just after the squeeze. Averages 1 over a stroke.
const MEAN = 0.12 * Math.sqrt(Math.PI);
export function thrust(p) {
  return Math.exp(-(((p - 0.22) / 0.12) ** 2)) / MEAN;
}

// Strokes per second: slow idle pulsing, faster the harder you push and the faster you swim
export function strokeRate(push, speedMul = 1) {
  return (0.6 + 1.3 * push) * Math.sqrt(speedMul);
}
