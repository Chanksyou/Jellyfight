// Stories: the tentacles' and oral arms' physics (tentacles.js, arms.js). Each stroke squeezes the
// roots in and the chain carries it down as a wave; the arms trail a turn and swing on after a
// stop; the same at 30 and 60 fps.
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

// A jelly swims ahead (+z) at full speed, turns 90 degrees (to +x) in 0.3 s and swims on, then
// stops, at frame step dt. Watches where arm 0's end is against where it would hang (world, flat):
// `back` how far behind it trails while cruising (barely), `out` how far it swings on toward the old
// heading (+z) through the turn, `settled` how far it is off straight behind 0.8 s later,
// `swing` how far ahead of hanging it swings after the stop, `still` how far off it is 1.5 s later
function armTurn(dt) {
  const c = buildCharacter({ body: 'nettle' }, 1), A = c.arms.list[0], vel = new THREE.Vector3(), trail = new THREE.Vector3();
  const out = { out: 0, swing: 0 };
  let yaw = 0, speed = 0;
  const step = () => {
    vel.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(speed);
    c.root.position.addScaledVector(vel, dt);
    c.root.rotation.y = yaw;
    c.update(dt, { speed, walkSpeed: speed || 1, grounded: false, vy: 0, vel, swim: 0 });
    trail.copy(A.sim[4]).sub(A.goal[4]).setY(0);
  };
  for (let t = 0; t < 2; t += dt) step();                                    // settle
  speed = 4.7;                                                               // full speed (0.42 m/s for a 8.9 cm jelly)
  for (let t = 0; t < 2; t += dt) step();                                    // cruise ahead
  out.back = -trail.z;
  for (let t = 0; t < 0.3 - 1e-6; t += dt) { yaw = Math.min(Math.PI / 2, yaw + (Math.PI / 2) * dt / 0.3); step(); out.out = Math.max(out.out, trail.z); }
  yaw = Math.PI / 2;
  for (let t = 0; t < 0.3 - 1e-6; t += dt) { step(); out.out = Math.max(out.out, trail.z); }
  for (let t = 0; t < 0.8 - 1e-6; t += dt) step();
  out.settled = Math.abs(trail.z);
  speed = 0;
  for (let t = 0; t < 1; t += dt) { step(); out.swing = Math.max(out.swing, trail.x); }   // swings on past hanging
  for (let t = 0; t < 1.5; t += dt) step();
  out.still = trail.length();
  c.dispose();
  for (const k in out) out[k] = +out[k].toFixed(4);
  return out;
}

story('motion/arms-lag-turns', {
  about: 'A cruising jelly\'s oral arms barely trail (the water under the bell goes along with it); through a 90 degree turn their ends keep going the old way and fall in behind once it swims on, after a stop they swing on forward past hanging, then settle; the same at 30 and 60 fps.',
  setup() {},
  play() {
    const a = armTurn(1 / 30), b = armTurn(1 / 60);
    const good = (r) => Math.abs(r.back) < 0.1 && r.out > 0.03 && r.settled < r.out / 3 && r.swing > 0.02 && r.still < 0.01;
    const like = (x, y) => ['out', 'swing'].every((k) => Math.abs(x[k] - y[k]) < 0.25 * Math.max(x[k], y[k]));
    return ok(good(a) && good(b) && like(a, b), { fps30: a, fps60: b });
  },
});
