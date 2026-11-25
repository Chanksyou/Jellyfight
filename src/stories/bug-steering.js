// Bugs steer by the floor map (the chase word, src/bug-nav.js): round furniture, apart from each
// other before they touch, and to the floor under a jelly that is up on furniture.
import * as THREE from 'three';
import { G, V, holdJelly, ok, setupFight, spawn, step, story, stub, tp } from './kit.js';

const DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const calm = () => { const { run } = G(); stub(run, 'hurt', () => {}); stub(run, 'hit', () => {}); run.health = 1e6; };
const settle = () => { const N = G().enemies.nav, n = N.floods; step(60, () => N.floods > n && !N.job.L); };

// a spot on the jelly's floor about a metre away or more with furniture in the straight line between (the probe's search), that the floor map reaches
function behindFurniture(P, from = 0.9) {
  return spotBehind(P, from) || spotBehind(P, 0.6) || spotBehind(P, 0.45);
}
function spotBehind(P, from) {
  const { run } = G(), pc = P.clone().setY(P.y + 0.045);
  for (let i = 0; i < 1200; i++) {
    const a = i * 2.399, d = from + (i % 7) * 0.12 + (i >= 400 ? 0.05 : 0), x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
    if (!run.inStage(x, z)) continue;
    if (!run.world.castAll(pc, V(x - P.x, 0, z - P.z).normalize(), d)) continue;
    const hit = run.world.cast(V(x, P.y + 0.12, z), DOWN, 0.3);
    if (!hit || Math.abs(hit.point.y - P.y) > 0.03) continue;
    if (run.world.cast(V(x, P.y + 0.02, z), UP, 0.1)) continue;
    if (G().enemies.nav.distAt(x, P.y, z, 0.034) === Infinity) continue;   // not shut in (the probe's fifth spot was inside the cat's box)
    return V(x, P.y + 0.01, z);
  }
  return null;
}

story('bugs/go-round-furniture', {
  about: 'Cockroaches released where furniture stands between them and a still jelly (five places in the living room) walk round it by the floor map: all 8 at each place (the fifth has none but inside the cat\'s box, where nothing could spawn, so it may sit out) reach the jelly (come within 16 cm, the ring round it) within 20 s.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const { enemies } = G(), tries = [];
    for (const [jx, jz] of [[3.2, 3.0], [2.4, 3.6], [3.8, 4.2], [2.0, 2.4], [4.4, 3.0]]) {
      tp(jx, 0.05, jz, 0); step(30); holdJelly(); calm(); settle();
      const P = G().player.position, spot = behindFurniture(P);
      if (!spot) { tries.push({ jelly: [jx, jz], spot: null }); continue; }
      const bugs = [];
      // a clump of 8 round the spot, on squares the floor map reaches (not in a pocket behind a wall or under a piece: a real spawn sees the jelly)
      const N = enemies.nav;
      for (let i = 0; i < 25 && bugs.length < 8; i++) {
        const x = spot.x + (i % 5 - 2) * 0.05, z = spot.z + (Math.floor(i / 5) - 2) * 0.05;
        if (N.distAt(x, P.y, z, 0.034) < Infinity) bugs.push(spawn('roach', V(x, spot.y, z), { hp: 1e7 }));
      }
      const came = new Set();   // a bug has arrived once it has been within 16 cm (the jelly and a ring of bugs: the rest queue behind)
      let at = -1;
      step(20 * 60, (i) => { for (const e of bugs) if (flat(e.pos, P) < 0.16) came.add(e); if (came.size === bugs.length) { at = i; return true; } });
      tries.push({ jelly: [jx, jz], from: +flat(spot, P).toFixed(2), released: bugs.length, arrived: came.size, secs: at < 0 ? null : +(at / 60).toFixed(1), last: bugs.filter((e) => !came.has(e)).map((e) => +flat(e.pos, P).toFixed(2)) });
      for (const e of bugs) enemies.kill(e, true);
    }
    return ok(tries.filter((t) => t.spot !== null).length >= 4 && tries.every((t) => t.spot === null || (t.released === 8 && t.arrived === 8)), { tries });
  },
});

// how many pairs of bugs are nearly touching (within 1.4 times their radii) while they walk in
function crowding(steered) {
  const { enemies } = G();
  setupFight({ bubbles: false, lash: false }); holdJelly(); calm();
  settle();
  if (!steered) stub(enemies, 'nav', null);
  const bugs = [];
  for (let i = 0; i < 12; i++) bugs.push(spawn('roach', near(0.7 + (i % 4) * 0.06, -0.1 + Math.floor(i / 4) * 0.07), { hp: 1e7 }));
  const P = G().player.position;
  let pairs = 0, frames = 0;
  step(150, (f) => {
    if (f < 20) return;
    frames++;
    for (let a = 0; a < bugs.length; a++) for (let b = a + 1; b < bugs.length; b++) {
      const A = bugs[a], B = bugs[b];
      if (flat(A.pos, P) < 0.15 || flat(B.pos, P) < 0.15) continue;   // before touching the jelly
      if (flat(A.pos, B.pos) < (A.r + B.r) * 1.4) pairs++;
    }
  });
  step(8 * 60);
  const arrived = bugs.filter((e) => flat(e.pos, P) < 0.15).length;
  for (const e of bugs) enemies.kill(e, true);
  return { pairs: +(pairs / frames).toFixed(2), arrived };
}
const near = (dx, dz) => G().player.position.clone().add(V(dx, 0, dz));

story('bugs/keep-apart-before-touching', {
  setup() {},
  about: 'A clump of 12 Cockroaches walking in spreads out on the way, each steering away from the bugs ahead of it: far fewer pairs crowd together than when they walk the straight line, and all still reach the jelly.',
  play() {
    const straight = crowding(false), steered = crowding(true);
    return ok(steered.pairs < straight.pairs * 0.6 && steered.arrived === 12, { straight, steered });
  },
});

story('bugs/gather-under-a-jelly-on-furniture', {
  about: 'With the jelly up on the desk, Cockroaches on the floor a metre away walk to the floor right under it (where the map\'s flood starts: all of the floor within 15 cm under it) and wait there, all within 30 cm of it, instead of pressing into the furniture between.',
  setup() { setupFight({ bubbles: false, lash: false }); tp(0.62, 0.83, 2.95, 0); step(20); holdJelly(); calm(); },
  play() {
    const { enemies } = G(), N = enemies.nav, P = G().player.position;
    settle();
    const bugs = [];
    for (let i = 0; i < 360 && bugs.length < 6; i++) {
      const a = i * 2.399, d = 0.8 + (i % 5) * 0.1, x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
      if (N.distAt(x, 0, z, 0.034) < Infinity) bugs.push(spawn('roach', V(x, 0.005, z), { hp: 1e7 }));
    }
    step(15 * 60);
    const left = bugs.map((e) => +flat(e.pos, P).toFixed(2));
    for (const e of bugs) enemies.kill(e, true);
    return ok(bugs.length === 6 && P.y > 0.5 && left.every((d) => d < 0.3), { jellyY: +P.y.toFixed(2), left });
  },
});
