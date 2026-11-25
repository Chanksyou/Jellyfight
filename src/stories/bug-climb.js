// The floor map's second level (src/bug-climb.js): the tops of furniture and the climb links that
// join them to the floor, and the climbers' flood that crosses them while the jelly is up.
import { CONTENT } from '../content.js';
import { G, V, holdJelly, ok, setupFight, spawn, step, story, stub, tp } from './kit.js';

// the jelly up on the coffee table (where its vent lands you), the climbers' flood finished
function onTable() {
  setupFight({ bubbles: false, lash: false });
  const v = G().run.traversal.vents.find((q) => /coffee table/.test(q.name));
  tp(v.land[0], v.land[1] + 0.05, v.land[2], 0); holdJelly();
  const C = G().enemies.nav.climb, n = C.floods;
  step(120, () => C.floods > n && !C.job);
  return { C, P: G().player.position.clone(), n };
}

story('nav/climb-links-join-floor-and-furniture', {
  about: 'The floor map finds the tops of furniture a small bug can stand on and the sides it can climb straight up. With the jelly up on the coffee table, the climbers\' flood reaches the floor round the table by those links: a floor square 40 cm off is reached, by a way no shorter than walking there and climbing the table\'s height. The floor map for bugs that don\'t climb is unchanged (it still floods from the floor under the jelly).',
  setup() {},
  play() {
    const { C, P } = onTable(), N = G().enemies.nav, counts = C.count();
    const T = C.tops[0], L = T.base;
    const k = Math.floor((P.z - T.z0) / 0.05) * T.nx + Math.floor((P.x - T.x0) / 0.05);
    const tableH = T.floor[k] - (Number.isNaN(L.floor[k]) ? L.y : L.floor[k]);
    // floor squares 40 cm out, all round: how many the flood reaches, and the shortest way among them
    const ways = [];
    for (let a = 0; a < 16; a++) {
      const x = P.x + Math.cos(a / 16 * Math.PI * 2) * 0.4, z = P.z + Math.sin(a / 16 * Math.PI * 2) * 0.4;
      const fk = Math.floor((z - L.z0) / 0.05) * L.nx + Math.floor((x - L.x0) / 0.05);
      if (Number.isNaN(L.floor[fk]) || !L.steps[0][fk]) continue;
      ways.push({ d: C.dist(x, L.floor[fk], z, 0.034), flat: Math.hypot(x - P.x, z - P.z) });
    }
    const reached = ways.filter((w) => w.d < Infinity), shortest = Math.min(...reached.map((w) => w.d));
    const floorFlood = N.distAt(P.x + 0.3, 0, P.z, 0.034);   // the first flood still runs from the floor under the jelly
    const info = { tops: counts.tops, links: counts.links, tableHeight: +tableH.toFixed(2), floorSquares: ways.length, reached: reached.length, shortest: +shortest.toFixed(2), onTableDist: C.dist(P.x, P.y, P.z, 0.034), floorFlood };
    return ok(counts.tops > 200 && counts.links[0] > 50 && tableH > 0.3 && reached.length >= ways.length * 0.75 && ways.length >= 8
      && shortest >= 0.3 + tableH - 0.1 && info.onTableDist < 0.1, info);
  },
});

story('nav/climb-flood-runs-only-with-the-jelly-up', {
  about: 'The climbers\' flood runs only while the jelly stands on a top, spread over frames (at most 1,200 squares a frame) like the floor\'s: on the floor it stops and nothing reads it.',
  setup() {},
  play() {
    const { C, n } = onTable();
    const up = C.floods > n && C.tops.some((T) => T.flooded);
    tp(3.2, 0.05, 3.0, 0); holdJelly(); step(30);
    const down = !C.tops.some((T) => T.flooded) && C.dist(3.5, 0, 3.0, 0.034) === Infinity;
    return ok(up && down, { up, down });
  },
});

// ---------------------------------------------------------------- the climbs word (Cockroach, House spider)
const calm = () => { const { run } = G(); stub(run, 'hurt', () => {}); stub(run, 'hit', () => {}); run.health = 1e6; };
// a bug released on the floor 50 cm from the coffee table the jelly is up on; what it does for `secs`
function climbAfter(type, secs, before = null) {
  const { P } = onTable(); calm();
  const { enemies, run } = G(), L = enemies.nav.levels[0];
  let at = null;
  for (let a = 0; a < 32 && !at; a++) {
    const x = P.x + Math.cos(a * 0.7) * 0.5, z = P.z + Math.sin(a * 0.7) * 0.5;
    if (enemies.nav.climb.dist(x, L.y, z, CONTENT.enemies[type].r) < Infinity && run.world.cast(V(x, 0.1, z), V(0, -1, 0), 0.2)) at = V(x, 0, z);
  }
  const e = spawn(type, at, { hp: 1e7 });
  before?.(e);
  const log = { e, P, start: at, top: false, pitched: false, highest: 0, arrivedAt: null, near: Infinity, aimed: false, rate: 0, fell: false };
  let y0 = null, f0 = 0;
  step(secs * 60, (f) => {
    log.highest = Math.max(log.highest, e.pos.y);
    if (e.climb?.up) {   // the climb rate between 5 cm up and 5 cm under the top, and no wind-up meanwhile
      if (e.aimT > 0) log.aimed = true;
      if (y0 === null && e.pos.y > 0.05) { y0 = e.pos.y; f0 = f; }
      if (y0 !== null && e.pos.y < P.y - 0.05 && f > f0) log.rate = (e.pos.y - y0) / ((f - f0) / 60);
    }
    if (e.root.rotation.x < -1.2) log.pitched = true;
    if (log.top && e.pos.y < P.y - 0.1) log.fell = true;   // up top it stays: it doesn't walk, back or slide off
    if (Math.abs(e.pos.y - P.y) < 0.04 && !e.climb) { log.top = true; log.near = Math.min(log.near, Math.hypot(e.pos.x - P.x, e.pos.z - P.z)); if (log.arrivedAt === null) log.arrivedAt = f / 60; }
  });
  return log;
}
const report = (l) => ({ fell: l.fell, rate: +l.rate.toFixed(3), aimed: l.aimed, top: l.top, pitched: l.pitched, highest: +l.highest.toFixed(2), jellyAt: +l.P.y.toFixed(2), secs: l.arrivedAt, near: +l.near.toFixed(2) });

story('bugs/cockroach-climbs-after-the-jelly', {
  about: 'With the jelly up on the coffee table, a Cockroach released on the floor 50 cm off runs to a side, climbs straight up it with its body flat to the side (nose up), gets onto the top within 15 s and comes within 15 cm of the jelly.',
  setup() {},
  play() { const l = climbAfter('roach', 15); return ok(l.top && l.pitched && l.near < 0.15, report(l)); },
});

story('bugs/spider-climbs-after-the-jelly', {
  about: 'With the jelly up on the coffee table, a House spider released on the floor 50 cm off climbs up a side after it and gets onto the top within 20 s.',
  setup() {},
  play() { const l = climbAfter('spider', 20); return ok(l.top && l.pitched, report(l)); },
});

story('bugs/ground-locked-bugs-do-not-climb', {
  about: 'A ground-locked Cockroach (Hoarfrost\'s rule: a bug with the status can\'t leap, rise or climb) never climbs after a jelly up on the coffee table: in 12 s it stays on the floor.',
  setup() {},
  play() {
    const l = climbAfter('roach', 12, (e) => { stub(G().run.mods, 'groundLock', ['marked']); e.markT = 1e6; });
    return ok(!l.top && l.highest < l.start.y + 0.05, report(l));
  },
});

story('bugs/knocked-off-a-side-it-falls', {
  about: 'A Cockroach knocked away while it climbs a side lets go and falls back to the floor (it may climb again after).',
  setup() {},
  play() {
    const { P } = onTable(); calm();
    const { enemies } = G(), L = enemies.nav.levels[0];
    let e = null;
    for (let a = 0; a < 32 && !e; a++) {
      const x = P.x + Math.cos(a * 0.7) * 0.4, z = P.z + Math.sin(a * 0.7) * 0.4;
      if (enemies.nav.climb.dist(x, L.y, z, 0.034) < Infinity) e = spawn('roach', V(x, 0, z), { hp: 1e7 });
    }
    const up = step(12 * 60, () => e.climb && e.pos.y > 0.15) < 12 * 60;
    const was = e.pos.y;
    G().enemies.push(e, V(-e.climb.dx, 0, -e.climb.dz), 0.05);
    step(3);
    const letGo = !e.climb;
    const landed = step(120, () => e.grounded && e.pos.y < 0.03) < 120;
    return ok(up && letGo && landed, { up, from: +was.toFixed(2), letGo, landed, y: +e.pos.y.toFixed(3) });
  },
});

story('bugs/other-bugs-gather-beneath', {
  about: 'Bugs that don\'t climb (Ants) still gather on the floor under a jelly up on the coffee table: after 12 s every one is on the floor within 45 cm of it.',
  setup() {},
  play() {
    const { P } = onTable(); calm();
    const { enemies, run } = G(), ants = [];
    for (let a = 0; a < 40 && ants.length < 4; a++) {
      const x = P.x + Math.cos(a * 0.9) * 0.7, z = P.z + Math.sin(a * 0.9) * 0.7;
      if (enemies.nav.distAt(x, 0, z, 0.029) < Infinity && run.world.cast(V(x, 0.1, z), V(0, -1, 0), 0.2)) ants.push(spawn('ants', V(x, 0, z), { hp: 1e7 }));
    }
    step(12 * 60);
    const where = ants.map((e) => ({ y: +e.pos.y.toFixed(2), d: +Math.hypot(e.pos.x - P.x, e.pos.z - P.z).toFixed(2) }));
    return ok(ants.length === 4 && where.every((w) => w.y < 0.05 && w.d < 0.45), { where });
  },
});

story('words/climbs', {
  about: 'climbs: a House spider (climbs 0.15) goes up a side of the coffee table at its climbing speed (within 20% of 0.15 m/s), starts no attack (no spit wind-up) while it is on the side, and gets onto the top and stays there (its web throw\'s recoil stops at the edge).',
  setup() {},
  play() {
    const l = climbAfter('spider', 20);
    return ok(l.top && !l.fell && Math.abs(l.rate - 0.15) < 0.03 && !l.aimed, report(l));
  },
});

// Up on a top (act 1: the coffee table; elsewhere the widest top the map found 25 to 70 cm up) with 4 Cockroaches and
// 2 House spiders after the jelly for 25 s; then the jelly goes back to the floor and swims off 1.2 m. How many climbed, and
// how many are still up top 20 s later (a stuck one would count against the wave's bug cap)
function upThenDown() {
  const { enemies, run } = G(), C = enemies.nav.climb, L = enemies.nav.levels[0];
  setupFight({ bubbles: false, lash: false });
  const v = run.traversal.vents.find((q) => /coffee table/.test(q.name));
  let at = v ? V(v.land[0], v.land[1], v.land[2]) : null;
  if (!at) {   // the top square with the most top round it, at one height
    let most = 0;
    for (const T of C.tops) for (let k = 0; k < T.n; k++) {
      const h = T.floor[k] - (Number.isNaN(T.base.floor[k]) ? L.y : T.base.floor[k]);
      if (!(h > 0.25 && h < 0.7)) continue;
      let n = 0;
      for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) if (Math.abs(T.floor[k + di + dj * T.nx] - T.floor[k]) < 0.01) n++;
      if (n > most) { most = n; at = V(T.x0 + (k % T.nx + 0.5) * 0.05, T.floor[k], T.z0 + (((k / T.nx) | 0) + 0.5) * 0.05); }
    }
  }
  tp(at.x, at.y + 0.05, at.z, 0); holdJelly(); calm();
  const n = C.floods; step(120, () => C.floods > n && !C.job);
  const P = G().player.position.clone(), bugs = [];
  for (let a = 0; a < 64 && bugs.length < 6; a++) {
    const type = bugs.length < 4 ? 'roach' : 'spider', d = 0.45 + (a % 4) * 0.1;
    const x = P.x + Math.cos(a * 0.9) * d, z = P.z + Math.sin(a * 0.9) * d;
    if (C.dist(x, L.y, z, CONTENT.enemies[type].r) < Infinity && run.world.cast(V(x, 0.1, z), V(0, -1, 0), 0.2)) bugs.push(spawn(type, V(x, 0, z), { hp: 1e7 }));
  }
  const up = new Set(), was = new Map(); let climbs = 0;
  step(25 * 60, () => { for (const e of bugs) { if (!e.climb && e.pos.y > P.y - 0.04) up.add(e); if (e.climb && !was.get(e)) climbs++; was.set(e, !!e.climb); } });
  // back down to the floor, 1.2 m off
  let floor = null;
  for (let a = 0; a < 32 && !floor; a++) { const x = P.x + Math.cos(a * 0.4) * 1.2, z = P.z + Math.sin(a * 0.4) * 1.2; const h = run.world.cast(V(x, 0.1, z), V(0, -1, 0), 0.2); if (h) floor = V(x, h.point.y, z); }
  tp(floor.x, floor.y + 0.05, floor.z, 0); holdJelly();
  step(20 * 60);
  const stuck = bugs.filter((e) => !e.dead && e.pos.y > P.y - 0.06);
  return { climbed: up.size, of: bugs.length, climbs, stuck: stuck.length, tableAt: +P.y.toFixed(2) };
}
story('bugs/climbers-come-down-when-the-jelly-leaves', {
  about: 'Climbers keep to the top only while the jelly is up there with them: with the jelly back on the floor 1.2 m off, every Cockroach and House spider that climbed the coffee table after it walks off the edge and drops within 20 s (none stays up, holding a place under the wave\'s bug cap).',
  setup() {},
  play() { const r = upThenDown(); return ok(r.climbed >= 2 && r.stuck === 0, r); },
});
story('bugs/climbers-come-down-when-the-jelly-leaves-act-2', {
  about: 'The same in act 2, on the widest top the floor map found 25 to 70 cm up: once the jelly has gone back to the floor, none of the climbers stays up.',
  act: 2,
  setup() {},
  play() { const r = upThenDown(); return ok(r.climbed >= 2 && r.stuck === 0, r); },
});
