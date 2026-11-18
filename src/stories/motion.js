// Stories: how the jelly's body moves (swim.js, character.js update). The look at rest never
// changes (look/rest-pose-unchanged); these check the motion: a second push in each stroke, and a
// body with weight that tips back as it starts and rocks on past upright as it stops.
import * as THREE from 'three';
import { thrust, thrustPeak } from '../swim.js';
import { buildCharacter } from '../character.js';
import { ok, story } from './kit.js';

story('motion/second-surge', {
  about: 'Each stroke pushes twice: the big surge after the squeeze, and a second, about a third as big, late in the glide. Over a stroke the push still averages 1, so the move speed is unchanged.',
  setup() {},
  play() {
    const N = 2000, v = Array.from({ length: N }, (_, i) => thrust(i / N));
    const mean = v.reduce((a, b) => a + b, 0) / N;
    const peaks = [];
    for (let i = 1; i < N - 1; i++) if (v[i] > v[i - 1] && v[i] >= v[i + 1]) peaks.push({ at: +(i / N).toFixed(3), v: +v[i].toFixed(3) });
    const [first, second] = peaks;
    const ratio = second ? second.v / first.v : 0;
    return ok(peaks.length === 2 && ratio >= 0.2 && ratio <= 0.4 && second.at > 0.6 && Math.abs(mean - 1) < 0.01 && Math.abs(first.v - thrustPeak()) < 0.01,
      { peaks, ratio: +ratio.toFixed(2), mean: +mean.toFixed(3) });
  },
});

// Swim at the player's pace: the velocity chases the wish like player.js does (groundAccel 15),
// the bell held between strokes (swim 0.5: no surge), so only the body's weight tips it. Returns the lean every frame.
const WALK = 0.42;
function run(dt, stopAt, length) {
  const c = buildCharacter({ accent: '#ff00ff' }, 0.089);
  const vel = new THREE.Vector3(), out = [], pose = () => ({ speed: vel.length(), walkSpeed: WALK, grounded: true, vy: 0, swim: 0.5, vel });
  c.update(dt, pose());   // a frame at rest first, as every jelly has had
  for (let t = 0; t < length - 1e-9; t += dt) {
    vel.z += ((t < stopAt ? WALK : 0) - vel.z) * (1 - Math.exp(-15 * dt));
    c.update(dt, pose());
    out.push(c.lean.rotation.x);
  }
  c.dispose();
  return out;
}

story('motion/stop-follow-through', {
  about: 'Starting tips the jelly back, then forward into the swim; stopping rocks it on forward and through upright, and it settles inside 0.8 s. The same at 30 and 60 frames a second.',
  setup() {},
  play() {
    const a = run(1 / 30, 2, 4), b = run(1 / 60, 2, 4);
    const at = (l, from, to) => l.slice(Math.round(from * l.length / 4), Math.round(to * l.length / 4));   // seconds of a 4 s run
    const cruise = a[Math.round(1.95 * a.length / 4)];
    const start = at(a, 0, 0.6), after = at(a, 2, 2.8), rocked = Math.max(...after), through = Math.min(...after), settled = Math.abs(at(a, 2.8, 2.85)[0]);
    const ext = (l) => [Math.min(...at(l, 0, 0.6)), Math.max(...at(l, 2, 2.8)), Math.min(...at(l, 2, 2.8))];   // a frame's timing moves the curve a little, not how far it swings
    const peaks = Math.max(...ext(a).map((x, i) => Math.abs(x - ext(b)[i])));
    const apart = Math.max(...[...Array(39).keys()].map((i) => Math.abs(a[(i + 1) * 3 - 1] - b[(i + 1) * 6 - 1])));   // every 0.1 s
    return ok(Math.min(...start) < -0.03 && cruise > 0.1 && rocked > cruise + 0.03 && through < -0.002 && settled < 0.005 && apart < 0.05 && peaks < 0.01,
      { tipsBack: +Math.min(...start).toFixed(3), cruise: +cruise.toFixed(3), rocked: +rocked.toFixed(3), through: +through.toFixed(3), settled: +settled.toFixed(4), peaks: +peaks.toFixed(4), apart: +apart.toFixed(4) });
  },
});
