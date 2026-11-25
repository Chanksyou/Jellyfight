// Ground bugs walk in rhythms (the chase word's bursts, rush, side and hug): bursts and stops, never faster
// than the jelly in a dash, the same average speed.
import { G, V, holdJelly, ok, setupFight, spawn, step, story, stub } from './kit.js';

const JELLY_SPEED = 0.42;

// walk a bug in the open (the straight line: no map) for `secs`; its path length, its fastest moment and its stops
function walk(type, secs, dist = 2.6) {
  const { enemies } = G(), P = G().player.position;
  setupFight({ bubbles: false, lash: false }); holdJelly();
  stub(G().run, 'hurt', () => {}); stub(G().run, 'hit', () => {}); G().run.health = 1e6;
  stub(enemies, 'nav', null);
  // from a clear spot `dist` m off, with nothing between it and the jelly
  const pc = P.clone().setY(P.y + 0.045);
  let at = null;
  for (let i = 0; i < 24 && !at; i++) {
    const a = i * 0.7, x = P.x + Math.cos(a) * dist, z = P.z + Math.sin(a) * dist;
    if (G().run.inStage(x, z) && !G().run.world.castAll(pc, V(x - P.x, 0, z - P.z).normalize(), dist + 0.1)) at = V(x, P.y + 0.01, z);
  }
  const e = spawn(type, at || V(P.x - dist, P.y + 0.01, P.z), { hp: 1e7 });
  step(30);   // (it starts out of step with the others: its own phase)
  let len = 0, max = 0, stopped = 0, last = e.pos.clone();
  const dt = 1 / 60;
  step(Math.round(secs * 60), () => {
    len += Math.hypot(e.pos.x - last.x, e.pos.z - last.z); last.copy(e.pos);
    const v = Math.hypot(e.vel.x, e.vel.z);
    max = Math.max(max, v); if (v < 0.1) stopped += dt;
    return false;
  });
  enemies.kill(e, true);
  return { len, max, stopped, secs };
}

story('bugs/rhythm-keeps-the-average-speed', {
  about: 'A Cockroach (bursts of 2 s, walking 85% of each) and a Spotted lanternfly (1.6 s, 70%) cover the same ground in whole bursts as a steady walker at their `speed`, within 10%, and they really do stop for a share of the time.',
  setup() {},
  play() {
    const roach = walk('roach', 6), fly = walk('lanternfly', 6.4, 2);
    const near = (r, speed) => Math.abs(r.len / (speed * r.secs) - 1) < 0.1;
    return ok(near(roach, 0.35) && near(fly, 0.2) && roach.stopped > 0.3 && fly.stopped > 0.8, { roach, fly });
  },
});

story('bugs/cockroach-never-outruns-the-jelly', {
  about: 'A Cockroach in a dash never goes faster than the jelly swims (0.42 m/s), and its content line says so: speed over its walking share is under it.',
  setup() {},
  play() {
    const r = walk('roach', 8, 3);
    return ok(r.len > 1 && r.max <= JELLY_SPEED + 1e-3, { len: +r.len.toFixed(2), max: +r.max.toFixed(3), stopped: +r.stopped.toFixed(2) });
  },
});

story('bugs/spider-side-steps-while-it-holds', {
  about: 'A House spider that has come to its holding distance (0.55 m) does not stand: it side-steps, so its position moves round the jelly while its distance stays near 0.55 m, and it faces the jelly while it does.',
  setup() {},
  play() {
    const { enemies } = G(), P = G().player.position;
    setupFight({ bubbles: false, lash: false }); holdJelly();
    stub(G().run, 'hurt', () => {}); stub(G().run, 'hit', () => {}); G().run.health = 1e6;
    stub(enemies, 'nav', null);
    const pc = P.clone().setY(P.y + 0.045);
    let at = null;
    for (let i = 0; i < 24 && !at; i++) {
      const a = i * 0.7, x = P.x + Math.cos(a) * 0.55, z = P.z + Math.sin(a) * 0.55;
      if (G().run.inStage(x, z) && !G().run.world.castAll(pc, V(x - P.x, 0, z - P.z).normalize(), 0.65)) at = V(x, P.y + 0.01, z);
    }
    const e = spawn('spider', at, { hp: 1e7 });
    step(4 * 60);   // it holds and lobs for a while first
    const from = e.pos.clone();
    let off = 0, n = 0;
    step(240, () => {
      const toJ = Math.atan2(P.x - e.pos.x, P.z - e.pos.z), d = Math.atan2(Math.sin(toJ - e.root.rotation.y), Math.cos(toJ - e.root.rotation.y));
      off = Math.max(off, Math.abs(d)); n++; return false;
    });
    const moved = Math.hypot(e.pos.x - from.x, e.pos.z - from.z), dist = Math.hypot(e.pos.x - P.x, e.pos.z - P.z);
    enemies.kill(e, true);
    return ok(moved > 0.03 && dist > 0.4 && dist < 0.7 && off < 0.9, { moved: +moved.toFixed(3), dist: +dist.toFixed(2), off: +off.toFixed(2) });
  },
});
