// Where new bugs come from (run.js arriveFrom, BugNav.cover, content/waves.kdl arrive): out of the
// camera's view, from under furniture or a floor vent the floor map reaches, fliers from above the
// view; a walk from the jelly like today's; and today's in-view spawn where the map has nothing.
import * as THREE from 'three';
import { CONTENT } from '../content.js';
import { G, V, fresh, holdJelly, ok, spawn, step, story, stub, tp } from './kit.js';

const calm = () => { const { run } = G(); stub(run, 'hurt', () => {}); stub(run, 'hit', () => {}); run.health = 1e6; };
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function inView(p, r) {
  const cam = G().tpc.camera;
  cam.updateMatrixWorld();
  const f = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  return f.intersectsSphere(new THREE.Sphere(p, r));
}
// every wave bug that comes in over `secs` with the jelly held still at a few places in the room: where and how
function arrivals(places, secs) {
  const { run, enemies } = G(), out = [];
  for (const [x, z, yaw] of places) {
    fresh({ waves: true, elites: false, bubbles: false, lash: false }); tp(x, 0.05, z, yaw); holdJelly(); calm();
    step(40);   // the floor map floods from the jelly's square
    const real = enemies.spawn.bind(enemies);
    stub(enemies, 'spawn', (type, pos, ...rest) => {
      const e = real(type, pos, ...rest), T = CONTENT.enemies[type], c = pos.clone().setY(pos.y + (T.fly ? 0 : T.r));
      const v = run.traversal.vents.find((q) => Math.hypot(q.x - pos.x, q.z - pos.z) < 0.01);
      const N = enemies.nav, L = N.levels[0], over = !T.fly && N.byCover(L, Math.floor((pos.x - L.x0) / 0.05), Math.floor((pos.z - L.z0) / 0.05));
      out.push({ e, type, fly: T.fly, seen: inView(c, T.r * 3), vent: !!v, cover: !!over, walk: enemies.nav.distAt(pos.x, pos.y, pos.z, T.r), straight: flat(pos, G().player.position), up: pos.y - G().player.position.y });
      return e;
    });
    step(Math.round(secs * 60));
  }
  return out;
}

story('spawn/bugs-arrive-from-cover-out-of-view', {
  about: 'Act 1 at night, the jelly still at four places in the living room for 45 s each: at least 9 in 10 wave bugs come in out of the camera\'s view, on squares the floor map reaches from the jelly (never a shut-in pocket like the cat\'s box), a walk in the arrive band (content/waves.kdl) away, and none grows in from nothing; at least 1 in 5 of the ground bugs crawls out from under the edge of furniture or out of a floor vent (in the open middle of the room there is little cover close by). Ten Mosquito arrivals come down from at least 30 cm above the jelly, out of view.',
  setup() {},
  play() {
    const all = arrivals([[1.5, 2.5, 0], [3.2, 3.0, 0], [2.4, 3.6, 1.6], [1.0, 3.6, 2.4]], 45);
    const hidden = all.filter((a) => !a.seen), ground = hidden.filter((a) => !a.fly), fly = hidden.filter((a) => a.fly);
    const A = CONTENT.waves.arrive, bad = hidden.filter((a) => a.fly ? a.up < 0.3 : !(a.walk >= A.near - 0.04 && a.walk <= ((a.cover || a.vent) ? A.cover : A.far) + 0.04));
    const covered = ground.filter((a) => a.cover || a.vent).length;
    const grew = hidden.filter((a) => a.e.spawnT < 1).length;
    const { run } = G(), P = G().player.position, high = [];
    for (let i = 0; i < 30 && high.length < 10; i++) { const at = run.arriveFrom('mosquito', A); if (at) high.push({ up: at.y - P.y, seen: inView(at, 0.15) }); }
    const fliersOk = high.length === 10 && high.every((h) => h.up >= 0.3 && !h.seen);
    return ok(all.length >= 12 && hidden.length >= all.length * 0.9 && bad.length === 0 && grew === 0 && covered >= ground.length / 5 && fliersOk,
      { mosquitoes: high.map((h) => +h.up.toFixed(2)), mosquitoSeen: high.filter((h) => h.seen).length, spawned: all.length, outOfView: hidden.length, ground: ground.length, fromCoverOrVents: covered, fromVents: ground.filter((a) => a.vent).length, fliers: fly.length, bad: bad.map((a) => ({ type: a.type, cover: a.cover, vent: a.vent, walk: +a.walk.toFixed(2) })), grew });
  },
});

// how long a Cockroach takes from where it comes in to the jelly (within 16 cm), one at a time
function reachTimes(rule, n) {
  const { run, enemies } = G(), out = [];
  fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); holdJelly(); calm();
  step(40);
  const P = G().player.position;
  for (let i = 0; i < n * 3 && out.length < n; i++) {
    const at = rule === 'cover' ? run.arriveFrom('roach', CONTENT.waves.arrive) : run.spawnPoint('roach');
    if (!at) continue;
    const e = spawn('roach', at, { hp: 1e7 });
    const f = step(30 * 60, () => flat(e.pos, P) < 0.16);
    out.push(f / 60);
    enemies.kill(e, true);
  }
  return out;
}
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

story('spawn/arrival-time-is-unchanged', {
  about: 'A Cockroach that comes in from cover takes about as long to reach a still jelly in the living room as one that appears in view today: the average of 12 of each is within 30% of today\'s, and every one arrives.',
  setup() {},
  play() {
    const cover = reachTimes('cover', 12), today = reachTimes('today', 12);
    const a = mean(cover), b = mean(today);
    return ok(cover.length === 12 && today.length === 12 && cover.every((t) => t < 30) && Math.abs(a / b - 1) <= 0.3, { cover: +a.toFixed(2), today: +b.toFixed(2), slowest: +Math.max(...cover).toFixed(1) });
  },
});

story('spawn/falls-back-in-an-open-room', {
  about: 'Where the floor map has nothing (no map, as in a duel or the dev kit, here taken away), wave bugs appear as today: in view, 35 to 85 cm from the jelly, growing in.',
  setup() {},
  play() {
    const { enemies } = G();
    fresh({ waves: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); holdJelly(); calm();
    stub(enemies, 'nav', null);
    const seen = [];
    const real = enemies.spawn.bind(enemies);
    stub(enemies, 'spawn', (type, pos, ...rest) => { const e = real(type, pos, ...rest); seen.push({ e, d: flat(pos, G().player.position), grow: null }); return e; });
    step(30 * 60, () => { for (const s of seen) if (s.grow === null) s.grow = s.e.spawnT; return seen.length >= 4; });   // (how grown it is the frame it came)
    return ok(seen.length >= 4 && seen.every((s) => s.d >= 0.34 && s.d <= 0.86 && s.grow < 0.5 && s.e.spawnT < 1 + 1e-9), { spawned: seen.length, dists: seen.map((s) => +s.d.toFixed(2)) });
  },
});

story('spawn/a-first-run-shows-its-first-bugs', {
  about: 'In a new player\'s first run the first wave bugs (arrive first-run= in content/waves.kdl) still appear in view, close by and growing in, so the first fight is easy to read. That in-view rule (run.spawnPoint) never puts a ground bug in a closed pocket the floor map knows of (BugNav.walledIn), even beside the room\'s most walled-in spot.',
  setup() {},
  play() {
    const { enemies } = G();
    fresh({ waves: true, elites: false, bubbles: false, lash: false, firstRun: true }); tp(3.2, 0.05, 3.0, 0); holdJelly(); calm();
    step(40);
    const seen = [], real = enemies.spawn.bind(enemies);
    stub(enemies, 'spawn', (type, pos, ...rest) => { const e = real(type, pos, ...rest); seen.push({ e, d: flat(pos, G().player.position), grow: null }); return e; });
    step(40 * 60, () => { for (const s of seen) if (s.grow === null) s.grow = s.e.spawnT; return seen.length >= 3; });
    // and that in-view rule never puts a bug in a closed pocket the floor map knows of: beside the room's most walled-in
    // spot (the most pocket squares 35 to 85 cm off), 300 of its spawn points, none walled in
    const N = enemies.nav, L = N.levels[0], r = CONTENT.enemies.roach.r;
    let best = null;
    for (let j = 2; j < L.nz - 2; j += 6) for (let i = 2; i < L.nx - 2; i += 6) {
      const x = L.x0 + (i + 0.5) * 0.05, z = L.z0 + (j + 0.5) * 0.05;
      if (N.distAt(x, L.y, z, r) === Infinity) continue;
      let n = 0;
      for (let a = 0; a < 48; a++) { const d = 0.35 + (a % 6) * 0.1, t = a * 0.7; if (N.walledIn(x + Math.cos(t) * d, L.floor[N.cellOf(L, x + Math.cos(t) * d, z + Math.sin(t) * d)] ?? L.y, z + Math.sin(t) * d, r)) n++; }
      if (!best || n > best.n) best = { x, z, n };
    }
    tp(best.x, 0.05, best.z, 0); holdJelly(); step(40);
    let walled = 0, points = 0;
    for (let k = 0; k < 300; k++) { const p = G().run.spawnPoint('roach'); if (!p) continue; points++; if (N.walledIn(p.x, p.y, p.z, r)) walled++; }
    return ok(seen.length >= 3 && seen.every((s) => s.grow < 0.5 && s.d <= 0.86) && best.n > 0 && points > 40 && walled === 0,
      { spawned: seen.length, grew: seen.map((s) => +s.grow.toFixed(2)), dists: seen.map((s) => +s.d.toFixed(2)), pocketSquaresNear: best.n, points, walled });
  },
});
