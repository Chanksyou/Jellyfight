// The bugs' floor map: 5 cm squares over the act's floor (the stage's rooms) and over a boss arena
// that stands higher (the Clog's tub), marking where a ground bug's body can stand and which way it
// can step. It is found at load with the collision world's own body sweep (collision.js
// sweepSphere), the test a walking bug's step makes, so the map and the walk agree. A flood from the
// jelly's square then gives every square it reaches its walking distance to the jelly, going round
// furniture (the chase word steers by it).
//
// Two body sizes (SIZES): every ground bug up to 3.5 cm in radius walks the small map, anything
// wider the Stag beetle's (6.9 cm), so a mid-sized bug is never sent through a gap it can't pass.
// A square is cover when something stands less than COVER over it (under the sofa).
//
// Costs: the map is typed arrays made once; a flood is a bucket queue over them (no allocation),
// run only when the jelly's square changes and at most 5 times a second. A piece moved with
// markMoved (static-batch.js) has the squares round where it was and where it is marked again.
import * as THREE from 'three';
import { moves } from './static-batch.js';
import { inPoly } from './hud.js';
import { LOOK } from './look.js';

export const CELL = 0.05;                 // a square's side (m)
export const SIZES = [0.035, 0.069];      // body radii the map is marked for (a bug takes the first that fits it)
const LIFT = 0.012;                       // the body is swept this far off the floor: a rug's edge doesn't stop it
const CLIMB = 0.025;                      // the most two neighbouring squares' floors may differ (a bug walks up a rug, not onto a shelf)
const COVER = 0.12;                       // something lower than this over a square makes it cover
const EDGE = 1;                           // squares: a spawn spot this close to cover is at its edge (spot)
const PROBE = 0.004;                      // the small ball that finds the floor and what is over it
const FLOOD_EVERY = 0.2;                  // seconds: at most 5 floods a second
const FLOOD_WORK = 1200;                  // squares a flood settles in one frame (a room's floor is about 8,000)
const NONE = 0xffff;
const STRAIGHT = 5, DIAGONAL = 7;         // a step's cost (5:7 is close to 1:√2, and whole numbers keep the queue a ring)
const DX = [1, -1, 0, 0, 1, 1, -1, -1], DZ = [0, 0, 1, -1, 1, -1, 1, -1];
const COST = [STRAIGHT, STRAIGHT, STRAIGHT, STRAIGHT, DIAGONAL, DIAGONAL, DIAGONAL, DIAGONAL];
const UX = DX.map((x, m) => x / Math.hypot(x, DZ[m])), UZ = DZ.map((z, m) => z / Math.hypot(DX[m], z));   // each way as a unit vector
const AVOID = 0.06;                       // m past touching: another bug closer than this that way is in the way
const NEAR = 3 * STRAIGHT;
const OPEN = 1.1;   // a flood way at most this much longer than the straight line (eight ways on squares run up to 8% long) counts as open
const UNDER = 0.15;                       // m: with the jelly up on furniture, the floor this close under it is where the flood starts                // the last 15 cm by foot: steer by the straight line to the jelly
const HUG_FAR = 0.5;                      // m of walking from the jelly: farther than this a bug that hugs edges does
const SPREAD = 1;                       // how hard bugs that close push each other aside, against the pull of the way on
const _danger = new Float32Array(8);
const E = 1, N = 2;                       // a square's open edges: to +x, to +z

const DOORWAY = 0.25;                     // how far past a room's edge the map reaches (a wall's thickness, and then some)
const edgeGap = (x, z, [ax, az], [bx, bz]) => {   // distance from (x, z) to the segment a-b
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
};
const _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _hit = { normal: new THREE.Vector3(), point: new THREE.Vector3(), distance: 0 };

export class BugNav {
  // rooms: the act's floor plan ([name, polygon] pairs: run.rooms); stage: its boss arena, if it stands off the floor
  constructor(world, rooms, stage) {
    this.world = world;
    this.levels = [];
    this.ready = false;
    this.floods = 0;            // (stories) how many floods have run
    this.view = false;          // the dev panel's Bug map switch
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [, poly] of rooms) for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const y = stage.start?.[1] || 0;
    // in a room, or in the doorway between two (the plan's rooms stop at the wall's faces): the walls themselves stop the body
    const inRoom = (x, z) => rooms.some(([, poly]) => inPoly(x, z, poly)) ? 2 : rooms.some(([, poly]) => poly.some((p, i) => edgeGap(x, z, p, poly[(i + 1) % poly.length]) < DOORWAY)) ? 1 : 0;
    if (rooms.length) this.addLevel(y, x0 - DOORWAY, x1 + DOORWAY, z0 - DOORWAY, z1 + DOORWAY, Infinity, inRoom);
    const b = stage.boss;
    if (b?.arenaMin && b.arenaMin[1] > y + 0.05) this.addLevel(b.arenaMin[1], b.arenaMin[0], b.arenaMax[0], b.arenaMin[2], b.arenaMax[2], b.arenaMax[1], () => 2);
    const most = Math.max(1, ...this.levels.map((L) => L.n));
    this.buckets = new Int32Array(8 * most);   // the flood's ring of 8 buckets (a square sits in one bucket at most once at a time)
    this.blen = new Int32Array(8);
    this.jl = -1; this.jk = -1; this.since = Infinity; this.dirty = true; this.frame = 0; this.born = 0;
    this.job = { L: null, s: 0, cur: 0, left: 0, x: 0, z: 0, up: false };   // the flood under way (floodOn)
    this.moves = moves; this.seen = 0; this.boxes = new Float64Array(0);
  }

  addLevel(y, x0, x1, z0, z1, top, inside) {
    const nx = Math.max(1, Math.ceil((x1 - x0) / CELL)), nz = Math.max(1, Math.ceil((z1 - z0) / CELL)), n = nx * nz;
    // region: 2 in a room, 1 in the band round it (doorways), 0 out
    const L = { y, x0, z0, nx, nz, n, top, region: new Uint8Array(n), floor: new Float32Array(n).fill(NaN), cover: new Uint8Array(n),
      pass: SIZES.map(() => new Uint8Array(n)), steps: SIZES.map(() => new Uint8Array(n)), dist: SIZES.map(() => new Uint16Array(n).fill(NONE)), next: SIZES.map(() => new Uint16Array(n)), flooded: false };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) L.region[j * nx + i] = inside(x0 + (i + 0.5) * CELL, z0 + (j + 0.5) * CELL);
    this.levels.push(L);
  }

  // Mark every square, a few rows at a time, handing the page back through `pause` (main.js's warm-up:
  // the loading screen keeps moving, and the shaders building meanwhile leave the CPU free)
  async build(pause = null) {
    let until = performance.now() + 12;
    const breathe = async () => { if (pause && performance.now() > until) { await pause(); until = performance.now() + 12; } };
    for (const L of this.levels) {
      for (let j = 0; j < L.nz; j++) { for (let i = 0; i < L.nx; i++) this.markFloor(L, j * L.nx + i); await breathe(); }
      for (let j = 0; j < L.nz; j++) { for (let i = 0; i < L.nx; i++) this.markEdges(L, i, j); await breathe(); }
      this.markSteps(L, 0, 0, L.nx - 1, L.nz - 1);
    }
    this.snapshot();
    this.ready = true;
    this.dirty = true;
  }

  // the floor under a square (NaN: none a bug can stand on) and whether something low covers it
  markFloor(L, k) {
    L.floor[k] = NaN; L.cover[k] = 0;
    if (!L.region[k]) return;
    const x = L.x0 + (k % L.nx + 0.5) * CELL, z = L.z0 + (((k / L.nx) | 0) + 0.5) * CELL, W = this.world;
    if (!W.sweepSphere(_c.set(x, L.y + 0.06, z), _d.set(0, -0.09, 0), PROBE, _hit)) return;
    const fy = L.y + 0.06 - _hit.distance - PROBE;
    L.floor[k] = fy;
    L.cover[k] = W.sweepSphere(_c.set(x, fy + 0.01 + PROBE, z), _d.set(0, COVER - 0.01 - 2 * PROBE, 0), PROBE, _hit) ? 1 : 0;
  }

  // which of a square's edges (to +x, to +z) each body size can step over
  markEdges(L, i, j) {
    const k = j * L.nx + i;
    for (let s = 0; s < SIZES.length; s++) L.pass[s][k] = 0;
    if (Number.isNaN(L.floor[k])) return;
    if (i + 1 < L.nx) this.markEdge(L, k, k + 1, CELL, 0, E);
    if (j + 1 < L.nz) this.markEdge(L, k, k + L.nx, 0, CELL, N);
  }

  markEdge(L, a, b, dx, dz, bit) {
    const fa = L.floor[a], fb = L.floor[b];
    if (Number.isNaN(fb) || Math.abs(fa - fb) > CLIMB) return;
    const x = L.x0 + (a % L.nx + 0.5) * CELL, z = L.z0 + (((a / L.nx) | 0) + 0.5) * CELL;
    // widest first: a wide body that passes means every narrower one does (it fits inside it, along the same line)
    for (let s = SIZES.length - 1; s >= 0; s--) {
      const r = SIZES[s];
      if (!this.world.sweepSphere(_c.set(x, fa + r + LIFT, z), _d.set(dx, fb - fa, dz), r, _hit)) {
        for (let t = s; t >= 0; t--) L.pass[t][a] |= bit;
        return;
      }
    }
  }

  // can a body of size s step from square k (at i, j) one square along (dx, dz)? A diagonal needs both of its sides open
  canStep(L, s, k, i, j, dx, dz) {
    const P = L.pass[s], nx = L.nx;
    if (dz === 0) return dx > 0 ? (P[k] & E) !== 0 : i > 0 && (P[k - 1] & E) !== 0;
    if (dx === 0) return dz > 0 ? (P[k] & N) !== 0 : j > 0 && (P[k - nx] & N) !== 0;
    return this.canStep(L, s, k, i, j, dx, 0) && this.canStep(L, s, k, i, j, 0, dz)
      && this.canStep(L, s, k + dx, i + dx, j, 0, dz) && this.canStep(L, s, k + dz * nx, i, j + dz, dx, 0);
  }

  // each square's 8 ways out (bit m: DX[m], DZ[m]) for each size, so a flood reads one byte a square
  markSteps(L, i0, j0, i1, j1) {
    for (let s = 0; s < SIZES.length; s++) {
      const S = L.steps[s];
      for (let j = Math.max(0, j0); j <= Math.min(L.nz - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(L.nx - 1, i1); i++) {
        const k = j * L.nx + i;
        let bits = 0;
        for (let m = 0; m < 8; m++) if (this.canStep(L, s, k, i, j, DX[m], DZ[m])) bits |= 1 << m;
        S[k] = bits;
      }
    }
  }

  sizeOf(r) { for (let s = 0; s < SIZES.length; s++) if (r <= SIZES[s] + 1e-6) return s; return SIZES.length - 1; }

  // the level a point stands on or over (the highest floor at or under it), or -1
  levelAt(x, y, z) {
    let best = -1;
    for (let l = 0; l < this.levels.length; l++) {
      const L = this.levels[l];
      if (y < L.y - 0.03 || y >= L.top || x < L.x0 || z < L.z0 || x >= L.x0 + L.nx * CELL || z >= L.z0 + L.nz * CELL) continue;
      if (best < 0 || L.y > this.levels[best].y) best = l;
    }
    return best;
  }
  cellOf(L, x, z) {
    const i = Math.floor((x - L.x0) / CELL), j = Math.floor((z - L.z0) / CELL);
    return i < 0 || j < 0 || i >= L.nx || j >= L.nz ? -1 : j * L.nx + i;
  }

  // The walking distance (m) for a body of radius r from a point on the floor to the jelly, or
  // Infinity: no flood reaches it (another level, off the floor on furniture, walled in)
  distAt(x, y, z, r) {
    const l = this.levelAt(x, y, z);
    if (l < 0) return Infinity;
    const L = this.levels[l], k = this.cellOf(L, x, z);
    if (!L.flooded || k < 0 || Math.abs(y - L.floor[k]) > 0.03) return Infinity;
    const d = L.dist[this.sizeOf(r)][k];
    return d === NONE ? Infinity : d / STRAIGHT * CELL;
  }

  // Which way a ground bug should walk (context steering, the chase word): each of the 8 ways out of
  // its square scores how far downhill on the flood the next square is (interest), less how close
  // another bug on the floor is that way (danger); a way the map closes scores nothing. The good ways
  // are summed, weighted by their score squared, plus a push away from the bugs that close (SPREAD),
  // into `out` (flat, unit length). Over the last
  // stretch (NEAR) they walk the straight line (with the jelly up on furniture, interest is the line to it). Returns false, leaving `out`
  // alone, when the map has nothing for it (not built, another level, off the floor, no flood there)
  // or when the straight line will do: no bug close, and the way round no longer than the line (OPEN).
  // `hug` (the chase word) adds that to the score of a way that ends beside furniture or a wall, while it is far from the jelly.
  // Each bug works it out every other frame (half the bugs each frame) and keeps the answer between.
  steer(e, list, toward, out, hug = 0) {
    const n = e.nav || (e.nav = { at: -9, odd: (this.born++ & 1) === 1, ok: false, dir: out.clone() });   // (its own count, not the bug's id: a replay walks the same; every other bug born works on the other frames)
    if ((n.at === this.frame - 1 || n.at === -9) && !n.odd) { n.odd = true; n.at = this.frame; if (n.ok) out.copy(n.dir); return n.ok; }
    n.odd = false; n.at = this.frame; n.ok = this.way(e, list, toward, out, hug);
    if (n.ok) n.dir.copy(out);
    return n.ok;
  }

  way(e, list, toward, out, hug) {
    const p = e.pos, l = this.ready ? this.levelAt(p.x, p.y, p.z) : -1;
    if (l < 0) return false;
    const L = this.levels[l], k = this.cellOf(L, p.x, p.z);
    if (!L.flooded || k < 0 || !(Math.abs(p.y - L.floor[k]) <= 0.03)) return false;
    const s = this.sizeOf(e.r), D = L.dist[s], here = D[k];
    if (here === NONE) return this.backOn(L, D, k, p, out);
    const near = here <= NEAR || this.close(L, p);
    if (near && !L.up) return false;   // the last stretch: they close in on the straight line, as before (pushed apart there, a ring of them would circle you)
    const danger = _danger.fill(0);
    let sx = 0, sz = 0;   // and a push away from them, so a crowd walking in widens instead of filing on top of itself
    for (let n = 0; n < list.length; n++) {
      const o = list[n];
      if (o === e || o.dead || o.proxy || o.under || o.T.fly) continue;
      const dx = o.pos.x - p.x, dz = o.pos.z - p.z, reach = AVOID + o.r + e.r, d2 = dx * dx + dz * dz;   // (sqrt, not hypot: this runs for every pair)
      if (d2 >= reach * reach || d2 < 1e-12 || Math.abs(o.pos.y - p.y) > 0.1) continue;
      const d = Math.sqrt(d2);
      const w = 1 - d / reach;
      sx -= dx / d * w; sz -= dz / d * w;
      for (let m = 0; m < 8; m++) { const a = (UX[m] * dx + UZ[m] * dz) / d; if (a > 0 && a * w > danger[m]) danger[m] = a * w; }
    }
    const ways = L.steps[s][k], cx = L.x0 + (k % L.nx + 0.5) * CELL, cz = L.z0 + (((k / L.nx) | 0) + 0.5) * CELL;
    // alone, with nothing much in the way (the flood's way is about as long as the straight line), the jelly not up on furniture: the straight line, exactly as before the map
    const edging = hug > 0 && !near && here * CELL / STRAIGHT > HUG_FAR;   // far off, a bug that hugs keeps to the edges of furniture and walls
    if (!edging && sx === 0 && sz === 0 && !L.up && (here / STRAIGHT * CELL <= Math.sqrt((p.x - L.sx) ** 2 + (p.z - L.sz) ** 2) * OPEN + 2 * CELL)) return false;
    let bx = 0, bz = 0;
    for (let m = 0; m < 8; m++) {
      if (!(ways & (1 << m))) continue;
      const t = D[k + DX[m] + DZ[m] * L.nx];
      if (t === NONE) continue;
      const interest = near ? UX[m] * toward.x + UZ[m] * toward.z : (here - t) / COST[m];
      const score = interest - danger[m] + (edging && L.steps[s][k + DX[m] + DZ[m] * L.nx] !== 255 ? hug : 0);
      if (score <= 0) continue;
      // toward the middle of that square, not just its way: off the middle line a body clips the corner of a leg the map stepped past
      const vx = cx + DX[m] * CELL - p.x, vz = cz + DZ[m] * CELL - p.z, vl = Math.sqrt(vx * vx + vz * vz) || 1, w = score * score / vl;
      bx += vx * w; bz += vz * w;
    }
    if (bx === 0 && bz === 0) return false;
    const len = Math.hypot(bx, bz);
    const spread = near ? 0 : SPREAD;   // (not under a jelly up on furniture: there they gather)
    out.set(bx / len + sx * spread, 0, bz / len + sz * spread);
    // never pushed aside into a way the map closes (a pocket by the wall): then just the way on
    let m = 0, best = -2;
    for (let q = 0; q < 8; q++) { const a = UX[q] * out.x + UZ[q] * out.z; if (a > best) { best = a; m = q; } }
    if (out.lengthSq() < 1e-8 || !(ways & (1 << m))) out.set(bx, 0, bz);
    out.normalize();
    return true;
  }

  // A spawn spot for a ground bug of radius r (run.js arriveFrom): a square the flood reaches, a walk
  // of near..far m from the jelly, that pass(x, y, z) accepts (out of view) and, with `under`, at the
  // edge of cover (a cover square within EDGE: most of the floor under a sofa is too low to stand on,
  // so a bug comes out from its edge). Picked at random from up to `tries` squares round the jelly,
  // into `out`; false if none
  spot(r, near, far, under, pass, out, tries = 500) {
    for (const L of this.levels) {
      if (!this.ready || !L.flooded) continue;
      const D = L.dist[this.sizeOf(r)], lo = near / CELL * STRAIGHT, hi = far / CELL * STRAIGHT, R = Math.ceil(far / CELL);
      const ci = Math.floor((L.sx - L.x0) / CELL), cj = Math.floor((L.sz - L.z0) / CELL);
      for (let t = 0; t < tries; t++) {
        const i = ci + Math.floor((Math.random() * 2 - 1) * R), j = cj + Math.floor((Math.random() * 2 - 1) * R);
        if (i < 0 || j < 0 || i >= L.nx || j >= L.nz) continue;
        const k = j * L.nx + i, d = D[k];
        if (d === NONE || d < lo || d > hi || (under && !this.byCover(L, i, j))) continue;
        const x = L.x0 + (i + 0.5) * CELL, z = L.z0 + (j + 0.5) * CELL;
        if (pass(x, L.floor[k], z)) { out.set(x, L.floor[k], z); return true; }
      }
    }
    return false;
  }
  byCover(L, i, j) {
    for (let b = Math.max(0, j - EDGE); b <= Math.min(L.nz - 1, j + EDGE); b++) for (let a = Math.max(0, i - EDGE); a <= Math.min(L.nx - 1, i + EDGE); a++) if (L.cover[b * L.nx + a]) return true;
    return false;
  }

  // a bug on a square the flood doesn't reach (pressed against a leg or into a corner the map calls
  // closed): head for the nearest square it does reach within 20 cm, or give up (false: the straight line)
  backOn(L, D, k, p, out) {
    const i0 = k % L.nx, j0 = (k / L.nx) | 0;
    let best = Infinity, bi = 0, bj = 0;
    for (let j = Math.max(0, j0 - 4); j <= Math.min(L.nz - 1, j0 + 4); j++) for (let i = Math.max(0, i0 - 4); i <= Math.min(L.nx - 1, i0 + 4); i++) {
      const d = D[j * L.nx + i];
      if (d === NONE) continue;
      const score = (i - i0) ** 2 + (j - j0) ** 2 + d * 1e-4;   // the nearest (likeliest the open side of what it's pressed against), then the nearer the jelly
      if (score < best) { best = score; bi = i; bj = j; }
    }
    if (best === Infinity) return false;
    out.set(L.x0 + (bi + 0.5) * CELL - p.x, 0, L.z0 + (bj + 0.5) * CELL - p.z);
    if (out.lengthSq() < 1e-8) return false;
    out.normalize();
    return true;
  }

  // Once a frame (enemies.update): marks again what moved; when the jelly's square has changed, a
  // new flood from it starts, and a flood under way goes on for at most FLOOD_WORK squares, so no
  // frame pays for a whole one (bugs read the last finished flood meanwhile)
  // within the last stretch of the jelly by the straight line, counting how far it has gone since the flood began (the flood
  // shows where it was: a bug close to where it is now walks the straight line, not back to where it stood)
  close(L, p) {
    const P = this.P;
    return Math.sqrt((p.x - P.x) ** 2 + (p.z - P.z) ** 2) <= NEAR / STRAIGHT * CELL + Math.sqrt((P.x - L.sx) ** 2 + (P.z - L.sz) ** 2);
  }

  // forget the flood (a new fight, run or story): the next update floods afresh, so a replay from the same state walks the same
  reset() {
    this.job.L = null; this.frame = 0; this.born = 0; this.jl = -1; this.jk = -1; this.since = Infinity; this.dirty = true;
    for (const L of this.levels) L.flooded = false;
  }

  update(dt, P) {
    if (!this.ready) return;
    this.P = P; this.frame++;
    if (this.moves !== moves || this.seen !== this.world.colliders.length) this.remark();
    this.since += dt;
    const J = this.job;
    if (J.L) { this.floodOn(FLOOD_WORK); return; }
    const l = this.levelAt(P.x, P.y, P.z), k = l < 0 ? -1 : this.cellOf(this.levels[l], P.x, P.z);
    if ((l === this.jl && k === this.jk && !this.dirty) || this.since < FLOOD_EVERY) return;
    this.since = 0; this.jl = l; this.jk = k; this.dirty = false;
    if (l < 0) { for (const L of this.levels) L.flooded = false; return; }
    J.x = P.x; J.z = P.z; J.up = P.y > this.levels[l].y + 0.1;
    this.floodStart(this.levels[l], 0);
    this.floodOn(FLOOD_WORK);
  }

  // the square nearest (x, z) a body of size s can stand on and step from, within a metre: under the
  // jelly when it is on the floor, the floor beside the furniture it is on otherwise. -1 if none
  nearestOpen(L, s, x, z) {
    const ci = Math.floor((x - L.x0) / CELL), cj = Math.floor((z - L.z0) / CELL), S = L.steps[s], nx = L.nx;
    let best = -1, bd = Infinity;
    for (let ring = 0; ring <= 20 && best < 0; ring++) {
      for (let j = cj - ring; j <= cj + ring; j++) for (let i = ci - ring; i <= ci + ring; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== ring || i < 0 || j < 0 || i >= nx || j >= L.nz) continue;
        const k = j * nx + i;
        if (!S[k]) continue;   // no way out of it
        const d = (i - ci) ** 2 + (j - cj) ** 2;
        if (d < bd) { bd = d; best = k; }
      }
    }
    return best;
  }

  // Walking distances from the jelly's square to every square it reaches, one size after the other,
  // written into `next` and swapped in when done (Dial's algorithm: a ring of 8 buckets by cost)
  floodStart(L, s) {
    const J = this.job, D = L.next[s], S = L.steps[s], B = this.buckets;
    J.L = L; J.s = s; J.cur = 0; J.left = 0;
    D.fill(NONE);
    this.blen.fill(0);
    if (J.up) {
      // up on furniture: the whole floor under it starts the flood (its nearest square alone may be a pocket among a chair's legs)
      const ci = Math.floor((J.x - L.x0) / CELL), cj = Math.floor((J.z - L.z0) / CELL), R = Math.ceil(UNDER / CELL);
      for (let j = Math.max(0, cj - R); j <= Math.min(L.nz - 1, cj + R); j++) for (let i = Math.max(0, ci - R); i <= Math.min(L.nx - 1, ci + R); i++) {
        const k = j * L.nx + i;
        if (S[k] && (i - ci) ** 2 + (j - cj) ** 2 <= R * R) { D[k] = 0; B[this.blen[0]++] = k; J.left++; }
      }
      if (J.left) return;
    }
    const start = this.nearestOpen(L, s, J.x, J.z);
    if (start < 0) return;
    D[start] = 0; B[0] = start; this.blen[0] = 1; J.left = 1;
  }

  floodOn(work) {
    const J = this.job, L = J.L, s = J.s, D = L.next[s], S = L.steps[s], B = this.buckets, len = this.blen, cap = B.length / 8, nx = L.nx;
    let cur = J.cur, left = J.left;
    while (left > 0 && work > 0) {
      const b = cur & 7;
      while (len[b] > 0 && work > 0) {
        const k = B[b * cap + --len[b]]; left--;
        if (D[k] !== cur) continue;   // reached more cheaply since it went in
        work--;
        const ways = S[k];
        for (let m = 0; m < 8; m++) {
          if (!(ways & (1 << m))) continue;
          const t = k + DX[m] + DZ[m] * nx, nd = cur + COST[m];
          if (nd < D[t]) { D[t] = nd; const bb = nd & 7; B[bb * cap + len[bb]++] = t; left++; }
        }
      }
      if (len[b] === 0) cur++;
    }
    J.cur = cur; J.left = left;
    if (left > 0) return;
    L.next[s] = L.dist[s]; L.dist[s] = D;   // this size's flood is done: bugs read it from now
    if (s + 1 < SIZES.length) { this.floodStart(L, s + 1); return; }
    J.L = null; L.sx = J.x; L.sz = J.z; L.up = J.up;   // where the jelly was when this flood began
    for (const o of this.levels) o.flooded = o === L;
    this.floods++;
    if (this.view) this.paint();
  }

  // What moved since the last look (markMoved, or a piece added to the world): mark the squares
  // round where it was and where it is now again, and flood again
  remark() {
    this.moves = moves;
    const W = this.world, C = W.colliders, old = this.boxes;
    for (let i = 0; i < C.length; i++) {
      W.refreshCollider(i);
      const b = W.sweepBounds[i].box, o = i * 6;
      if (i < this.seen && old[o] === b.min.x && old[o + 1] === b.min.z && old[o + 2] === b.max.x && old[o + 3] === b.max.z && old[o + 4] === b.min.y && old[o + 5] === b.max.y) continue;
      if (i < this.seen) this.markBox(old[o], old[o + 1], old[o + 2], old[o + 3]);
      this.markBox(b.min.x, b.min.z, b.max.x, b.max.z);
    }
    this.snapshot();
    this.dirty = true;
  }

  markBox(x0, z0, x1, z1) {
    const pad = SIZES[SIZES.length - 1] + CELL;
    for (const L of this.levels) {
      const i0 = Math.max(0, Math.floor((x0 - pad - L.x0) / CELL)), i1 = Math.min(L.nx - 1, Math.floor((x1 + pad - L.x0) / CELL));
      const j0 = Math.max(0, Math.floor((z0 - pad - L.z0) / CELL)), j1 = Math.min(L.nz - 1, Math.floor((z1 + pad - L.z0) / CELL));
      if (i0 > i1 || j0 > j1) continue;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.markFloor(L, j * L.nx + i);
      for (let j = Math.max(0, j0 - 1); j <= j1; j++) for (let i = Math.max(0, i0 - 1); i <= i1; i++) this.markEdges(L, i, j);
      this.markSteps(L, i0 - 2, j0 - 2, i1 + 1, j1 + 1);
    }
  }

  snapshot() {
    const W = this.world, n = W.colliders.length;
    if (this.boxes.length < n * 6) this.boxes = new Float64Array(n * 6 + 60);
    for (let i = 0; i < n; i++) {
      const b = W.sweepBounds[i].box, o = i * 6;
      this.boxes[o] = b.min.x; this.boxes[o + 1] = b.min.z; this.boxes[o + 2] = b.max.x; this.boxes[o + 3] = b.max.z; this.boxes[o + 4] = b.min.y; this.boxes[o + 5] = b.max.y;
    }
    this.seen = n;
  }

  // ---------------------------------------------------------------- the dev view (dev panel: Bug map)
  // A dot on every square a small bug can stand on, coloured by its walking distance to the jelly:
  // near to far, cover, out of reach. Made the first time it's switched on (no draw until then).
  show(scene, on) {
    this.view = on;
    if (on && !this.points) {
      let n = 0;
      for (const L of this.levels) for (let k = 0; k < L.n; k++) if (!Number.isNaN(L.floor[k])) n++;
      const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
      this.dots = [];
      let v = 0;
      for (const L of this.levels) for (let k = 0; k < L.n; k++) {
        if (Number.isNaN(L.floor[k])) continue;
        pos[v * 3] = L.x0 + (k % L.nx + 0.5) * CELL; pos[v * 3 + 1] = L.floor[k] + 0.004; pos[v * 3 + 2] = L.z0 + (((k / L.nx) | 0) + 0.5) * CELL;
        this.dots.push(L, k); v++;
      }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: CELL * 0.6, vertexColors: true, depthWrite: false, depthTest: false, fog: false }));
      this.points.name = 'bug-map';
      this.points.frustumCulled = false;
      this.points.renderOrder = 10;   // over the furniture: the squares under the sofa show too
      scene.add(this.points);
    }
    if (this.points) { this.points.visible = on; if (on) this.paint(); }
  }

  paint() {
    if (!this.points) return;
    const col = this.points.geometry.attributes.color, a = col.array, c = new THREE.Color();
    const C = (name, hex) => new THREE.Color(LOOK.color(name, hex));
    const near = C('bug-map-near', '#1f8a4c'), far = C('bug-map-far', '#1f3a8a'), cover = C('bug-map-cover', '#8a5a1f'), cut = C('bug-map-cut', '#303030');
    const span = LOOK.num('bug-map-span', 3) / CELL * STRAIGHT;
    for (let v = 0; v < this.dots.length / 2; v++) {
      const L = this.dots[v * 2], k = this.dots[v * 2 + 1], d = L.flooded ? L.dist[0][k] : NONE;
      if (d === NONE) c.copy(cut); else c.lerpColors(near, far, Math.min(1, d / span));
      if (L.cover[k]) c.lerp(cover, 0.6);
      a[v * 3] = c.r; a[v * 3 + 1] = c.g; a[v * 3 + 2] = c.b;
    }
    col.needsUpdate = true;
  }
}
