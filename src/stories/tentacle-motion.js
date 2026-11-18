// Stories: the tentacles' physics (tentacles.js). Each stroke squeezes the roots in and the
// chain carries it down as a wave, the same at 30 and 60 fps.
import * as THREE from 'three';
import { buildCharacter } from '../character.js';
import { squeeze } from '../swim.js';
import { ok, story } from './kit.js';

// one stroke on a still jelly at frame step dt: when each point of tentacle 0 is furthest from
// where it hung before the stroke (root, middle, tip), and how far the tip went
function stroke(dt) {
  const c = buildCharacter({ body: 'nettle' }, 1), rig = c.tentacles, still = new THREE.Vector3();
  const at = (ct) => rig.update(dt, { localVel: still, contract: ct, vy: 0 });
  for (let t = 0; t < 4; t += dt) at(0);                  // settle (hang, sink a little)
  const rest = rig.list[0].sim.map((p) => p.clone()), probe = [2, 10, 20];
  for (let t = 0; t < 1; t += dt) at(0);                  // no stroke: nothing moves on a clock
  const drift = rig.list[0].sim[20].distanceTo(rest[20]);
  const peak = probe.map(() => ({ d: 0, t: 0 }));
  for (let t = 0; t < 1.6; t += dt) {
    at(t < 1 ? squeeze(t) : 0);
    probe.forEach((j, i) => { const d = rig.list[0].sim[j].distanceTo(rest[j]); if (d > peak[i].d) peak[i] = { d, t }; });
  }
  c.dispose();
  return { times: peak.map((p) => +p.t.toFixed(3)), tip: +peak[2].d.toFixed(4), drift: +drift.toFixed(5) };
}

story('motion/stroke-wave-travels-down', {
  about: 'A still jelly\'s tentacles hang still (no ripple on a clock). After a stroke the tentacle moves furthest at the root first, then the middle, then the tip (a wave running down it), and it plays out the same at 30, 60 and 120 fps.',
  setup() {},
  play() {
    const a = stroke(1 / 30), b = stroke(1 / 60), c = stroke(1 / 120);
    const down = (r) => r.times[0] < r.times[1] && r.times[1] < r.times[2] && r.tip > 0.005 && r.drift < 1e-3;
    const like = (x, y) => Math.abs(x.tip - y.tip) < 0.2 * Math.max(x.tip, y.tip) && Math.abs(x.times[2] - y.times[2]) < 0.07, same = like(a, b) && like(b, c);
    return ok(down(a) && down(b) && down(c) && same, { fps30: a, fps60: b, fps120: c });
  },
});
