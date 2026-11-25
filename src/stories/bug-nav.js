// The bugs' floor map (src/bug-nav.js): what it marks agrees with the real body sweep, its flood
// stays off the frame clock, and moving a piece of furniture marks the floor again.
import * as THREE from 'three';
import { markMoved } from '../static-batch.js';
import { CELL, SIZES } from '../bug-nav.js';
import { G, V, act2, act3, fresh, holdJelly, night4, ok, setupFight, spawn, step, story } from './kit.js';

const centre = (L, k) => [L.x0 + (k % L.nx + 0.5) * CELL, L.z0 + (((k / L.nx) | 0) + 0.5) * CELL];
const reached = (L, s, k) => L.dist[s][k] !== 0xffff;
const settle = () => { const N = G().enemies.nav, n = N.floods; step(60, () => N.floods > n && !N.job.L); };

story('nav/floor-map-matches-the-room', {
  about: 'The floor map agrees with how a bug really moves: a body stepped between two squares it calls open is never stopped, one stepped across an edge it calls closed is stopped; it reaches most of the room, round the furniture, never shorter than a straight line, and finds cover under the low furniture that only small bugs fit under.',
  setup() { setupFight({ bubbles: false, lash: false }); holdJelly(); },
  play() {
    const { enemies } = G(), N = enemies.nav;
    settle();
    const L = N.levels[0], P = G().player.position;
    let floor = 0, small = 0, big = 0, bigOnly = 0, shorter = 0, coverSmallOnly = 0;
    for (let k = 0; k < L.n; k++) {
      if (L.region[k] !== 2 || Number.isNaN(L.floor[k])) continue;
      floor++;
      if (reached(L, 0, k)) small++;
      if (reached(L, 1, k)) { big++; if (!reached(L, 0, k)) bigOnly++; }
      if (L.cover[k] && reached(L, 0, k) && !reached(L, 1, k)) coverSmallOnly++;
      const [x, z] = centre(L, k);
      if (reached(L, 0, k) && L.dist[0][k] / 5 * CELL < Math.hypot(x - P.x, z - P.z) - CELL * 1.5) shorter++;
    }
    // The real body (a Cockroach, held still, lifted as the map's sweep is) stepped across sampled edges
    const e = spawn('roach', P.clone(), { still: true });
    const open = [], shut = [];
    for (let tries = 0; tries < 20000 && (open.length < 40 || shut.length < 40); tries++) {
      const k = Math.floor(Math.random() * L.n), i = k % L.nx, j = (k / L.nx) | 0, east = Math.random() < 0.5;
      const b = east ? k + 1 : k + L.nx;
      if ((east ? i + 1 >= L.nx : j + 1 >= L.nz) || Number.isNaN(L.floor[k]) || Number.isNaN(L.floor[b]) || Math.abs(L.floor[k] - L.floor[b]) > 0.004) continue;
      const isOpen = (L.pass[0][k] & (east ? 1 : 2)) !== 0;
      if ((isOpen ? open : shut).length >= 40) continue;
      const [x, z] = centre(L, k);
      e.pos.set(x, L.floor[k] + 0.012 + (SIZES[0] - e.r), z);   // the body's middle where the map's small ball had it
      const blocked = enemies.move(e, V(east ? CELL : 0, 0, east ? 0 : CELL), 1, false);
      (isOpen ? open : shut).push(blocked);
    }
    enemies.kill(e, true);
    const openStopped = open.filter(Boolean).length, shutPassed = shut.filter((x) => !x).length;
    return ok(N.ready && small > floor * 0.5 && big < small && bigOnly === 0 && shorter === 0 && coverSmallOnly > 20
      && open.length === 40 && shut.length === 40 && openStopped === 0 && shutPassed <= 2,
    { floor, small, big, bigOnly, shorter, coverSmallOnly, openStopped, shutPassed, of: [open.length, shut.length] });
  },
});

story('nav/flood-runs-off-the-frame-clock', {
  about: 'The floor map floods from the jelly only when its square changes, at most 5 times a second, and a flood is spread over several frames: a still jelly costs no floods, and one crossing a square every frame for 2 s about 10.',
  setup() { setupFight({ bubbles: false, lash: false }); holdJelly(); },
  play() {
    const N = G().enemies.nav, P = G().player.position;
    settle();
    const a = N.floods;
    step(120);
    const still = N.floods - a;
    // a new square: the flood takes more than one frame to finish
    P.x += CELL * 3;
    const b = N.floods, frames = step(60, () => N.floods > b) + 1;
    const c = N.floods, x0 = P.x;
    step(120, (i) => { P.x = x0 + ((i % 20) - 10) * CELL; });
    const moving = N.floods - c;
    return ok(still === 0 && frames > 1 && frames < 30 && moving >= 4 && moving <= 11, { still, framesForOne: frames, movingFor2s: moving });
  },
});

story('nav/moved-furniture-updates-the-map', {
  about: 'Moving a piece of furniture (the cat scratcher and its box, with markMoved) marks the floor again: where it stood opens up to the flood, where it now stands is closed, and moving it back puts the map back as it was.',
  setup() { setupFight({ bubbles: false, lash: false }); holdJelly(); },
  play() {
    const { enemies, APT, world } = G(), N = enemies.nav, node = APT.root.getObjectByName('Cat_scratcher_and_box');
    settle();
    const L = N.levels[0], was = node.position.clone(), w0 = node.getWorldPosition(V(0, 0, 0));
    const open = (x, z) => N.distAt(x, 0, z, SIZES[0]) < Infinity;
    const box = new THREE.Box3();   // its middle, from its pieces' collision bounds
    world.colliders.forEach((m, i) => { for (let o = m; o; o = o.parent) if (o === node) { box.union(world.sweepBounds[i].box); break; } });
    const pot = box.getCenter(V(0, 0, 0));
    // somewhere open on the floor 60 cm or more from it, with 30 cm round it open too
    let to = null, best = Infinity;
    for (let k = 0; k < L.n; k++) {
      const [x, z] = centre(L, k), d = Math.hypot(x - pot.x, z - pot.z);
      if (d < 0.6 || d > best || !open(x, z)) continue;
      let clear = true;
      for (let a = -0.3; a <= 0.3 && clear; a += CELL) for (let b = -0.3; b <= 0.3 && clear; b += CELL) clear = open(x + a, z + b);
      if (clear) { best = d; to = V(x, 0, z); }
    }
    const before = [open(pot.x, pot.z), open(to.x, to.z)];
    node.position.copy(node.parent.worldToLocal(w0.clone().add(V(to.x - pot.x, 0, to.z - pot.z))));
    markMoved(node);
    settle();
    const moved = [open(pot.x, pot.z), open(to.x, to.z)];
    node.position.copy(was);
    markMoved(node);
    settle();
    const back = [open(pot.x, pot.z), open(to.x, to.z)];
    return ok(!before[0] && before[1] && moved[0] && !moved[1] && !back[0] && back[1], { at: [pot.x, pot.z].map((v) => +v.toFixed(2)), to: [to.x, to.z].map((v) => +v.toFixed(2)), before, moved, back });
  },
});

// every act's floor, and the Clog's tub (a level of its own, 15 cm up): the flood from where the jelly starts reaches most of it
function coverage(L) {
  let floor = 0, small = 0, big = 0;
  for (let k = 0; k < L.n; k++) if (L.region[k] === 2 && !Number.isNaN(L.floor[k])) { floor++; if (reached(L, 0, k)) small++; if (reached(L, 1, k)) big++; }
  return { floor, small, big, share: +(small / Math.max(1, floor)).toFixed(2) };
}
const actFloor = { setup() { fresh({ bubbles: false, lash: false }); holdJelly(); }, play() { const N = G().enemies.nav; settle(); const c = coverage(N.levels[0]); return ok(N.ready && N.levels[0].flooded && c.share > 0.5 && c.big > 0, c); } };
act3('bug-map-covers-the-floor', { about: 'The bugs\' floor map covers act 3\'s bedroom: from where the jelly starts, its flood reaches most of the floor.', ...actFloor });
night4('bug-map-covers-the-floor', { about: 'The bugs\' floor map covers act 4\'s living room (act 1\'s layout): from where the jelly starts, its flood reaches most of the floor.', ...actFloor });
act2('bug-map-covers-the-floor-and-the-tub', {
  about: 'The bugs\' floor map covers act 2\'s hallway and bathroom, and the Clog\'s widened tub as a level of its own: in the boss fight the flood runs on the tub\'s floor, where its Hair tangles walk.',
  setup() { fresh({ bubbles: false, lash: false }); holdJelly(); },
  play() {
    const { enemies, run } = G(), N = enemies.nav;
    settle();
    const floor = coverage(N.levels[0]);
    run.startBossIntro();
    step(60 * 8, () => run.phase === 'boss' && run.boss);
    holdJelly();
    settle();
    const P = G().player.position, l = N.levels.length > 1 ? N.levelAt(P.x, P.y, P.z) : -1, tub = l > 0 ? coverage(N.levels[l]) : null;
    return ok(floor.share > 0.5 && l === 1 && N.levels[1].flooded && tub.small > 100 && tub.share > 0.5, { floor, level: l, tub, y: +P.y.toFixed(3) });
  },
});
