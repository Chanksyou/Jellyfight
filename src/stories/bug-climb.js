// The floor map's second level (src/bug-climb.js): the tops of furniture and the climb links that
// join them to the floor, and the climbers' flood that crosses them while the jelly is up.
import { G, V, holdJelly, ok, setupFight, step, story, tp } from './kit.js';

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
