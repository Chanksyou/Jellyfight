// The floor map's second level (bug-nav.js): the tops of furniture a small bug can stand on, and the
// climb links between the floor and those tops, where a bug can go straight up a side. A second
// flood, run only while the jelly is up on furniture, crosses the links (a climb costs its height
// like a walk), so a climbing bug knows its way: along the floor to a side, up it, across the top.
// Nothing reads it yet but the stories; non-climbers keep the first flood (bug-nav.js), unchanged.
//
// A top is a level-like object over the same squares as its floor (`floor` holds the top's height,
// NaN where there is none), so the floor map's own edge and step marking (markEdges, markSteps)
// mark it too. A link joins a floor square to one of its 4 neighbours' tops (`up` bits on the
// floor square, `down` bits on the top square, one byte each per body size).
//
// Costs: typed arrays made once; marked at load with the floor (a few rows a pause) and again round
// what moves. The flood is Dial's bucket queue with each square in at most one bucket (doubly linked,
// so a cheaper way just moves it), at most CLIMB_WORK squares a frame, at most 5 floods a second,
// and only when the jelly's top square changes. No allocation after load.
import * as THREE from 'three';
import { CELL, SIZES } from './bug-nav.js';

const TOP_MIN = 0.08;                     // m over the floor: lower than this is the floor's own (a rug)
const TOP_MAX = 1.0;                      // m over the floor: the highest top found (a desk, the stovetop)
const PROBE = 0.004;                      // the small ball that finds a top
const HEAD = 0.06;                        // m clear over a top for it to count (not the gap under a shelf)
const SIDE = 0.01;                        // the thin ball that checks a side can be climbed (nothing over it) and stepped off
const STRAIGHT = 5, DIAGONAL = 7;         // a step's cost, as bug-nav.js
const DX = [1, -1, 0, 0, 1, 1, -1, -1], DZ = [0, 0, 1, -1, 1, -1, 1, -1];
const COST = [STRAIGHT, STRAIGHT, STRAIGHT, STRAIGHT, DIAGONAL, DIAGONAL, DIAGONAL, DIAGONAL];
const RING = 256;                         // buckets (a power of two over the dearest link: 1 m up costs 100 + a step)
const NONE = 0xffff;
const CLIMB_WORK = 1200;                  // squares a flood settles in one frame
const FLOOD_EVERY = 0.2;                  // seconds: at most 5 floods a second
const UNDER = 0.08;                       // m: the top squares this close round the jelly start the flood

export class Climb {
  constructor(nav) {
    this.nav = nav;
    this.tops = [];   // one per floor level that is a room's floor (not a raised boss arena)
    this.floods = 0;  // (stories)
    this.job = null; this.since = Infinity; this.key = -2;
  }

  // Made with the floor map's levels (bug-nav.js build): marks every top, its edges and the links
  async build(pause) {
    const N = this.nav;
    for (const L of N.levels) {
      if (L.top !== Infinity) continue;   // a raised boss arena (the Clog's tub) has no furniture to climb
      const T = { y: L.y, x0: L.x0, z0: L.z0, nx: L.nx, nz: L.nz, n: L.n, region: L.region, floor: new Float32Array(L.n).fill(NaN), cover: new Uint8Array(L.n),
        pass: SIZES.map(() => new Uint8Array(L.n)), steps: SIZES.map(() => new Uint8Array(L.n)), up: SIZES.map(() => new Uint8Array(L.n)), down: SIZES.map(() => new Uint8Array(L.n)), base: L };
      const n2 = L.n * 2;
      T.dist = SIZES.map(() => new Uint16Array(n2).fill(NONE)); T.next = SIZES.map(() => new Uint16Array(n2).fill(NONE));
      T.flooded = false;
      this.tops.push(T);
      for (let j = 0; j < L.nz; j++) { for (let i = 0; i < L.nx; i++) this.markTop(T, j * L.nx + i); await pause(); }
      for (let j = 0; j < L.nz; j++) { for (let i = 0; i < L.nx; i++) N.markEdges(T, i, j); await pause(); }
      N.markSteps(T, 0, 0, L.nx - 1, L.nz - 1);
      this.markLinks(T, 0, 0, L.nx - 1, L.nz - 1);
    }
    const most = Math.max(1, ...this.tops.map((T) => T.n * 2));
    this.prev = new Int32Array(most); this.nextIn = new Int32Array(most); this.head = new Int32Array(RING); this.done = new Uint8Array(most);
  }

  // the highest top over a square (between TOP_MIN and TOP_MAX over its floor, with HEAD clear over it)
  markTop(T, k) {
    T.floor[k] = NaN;
    const L = T.base, f = Number.isNaN(L.floor[k]) ? L.y : L.floor[k];   // (a cabinet standing on the floor hides it: its top is over the room's floor)
    if (!L.region[k]) return;
    const W = this.nav.world, x = L.x0 + (k % L.nx + 0.5) * CELL, z = L.z0 + (((k / L.nx) | 0) + 0.5) * CELL, from = f + TOP_MAX + PROBE;
    if (!W.sweepSphere(v(x, from, z), d(0, -(TOP_MAX - TOP_MIN), 0), PROBE, HIT)) return;
    const y = from - HIT.distance - PROBE;
    if (W.sweepSphere(v(x, y + 0.01 + PROBE, z), d(0, HEAD, 0), PROBE, HIT)) return;   // under something: a shelf's inside, not a top
    T.floor[k] = y;
  }

  // links in the squares i0..i1, j0..j1: a floor square to a neighbour's top it can go straight up to
  markLinks(T, i0, j0, i1, j1) {
    const L = T.base, W = this.nav.world, nx = L.nx;
    for (let s = 0; s < SIZES.length; s++) {
      const U = T.up[s], Dn = T.down[s], FS = L.steps[s], TS = T.steps[s];
      for (let j = Math.max(0, j0 - 1); j <= Math.min(L.nz - 1, j1 + 1); j++) for (let i = Math.max(0, i0 - 1); i <= Math.min(nx - 1, i1 + 1); i++) { U[j * nx + i] = 0; Dn[j * nx + i] = 0; }
      for (let j = Math.max(0, j0 - 1); j <= Math.min(L.nz - 1, j1 + 1); j++) for (let i = Math.max(0, i0 - 1); i <= Math.min(nx - 1, i1 + 1); i++) {
        const f = j * nx + i;
        if (!FS[f]) continue;
        const fy = L.floor[f], fx = L.x0 + (i + 0.5) * CELL, fz = L.z0 + (j + 0.5) * CELL;
        for (let m = 0; m < 4; m++) {
          const ti = i + DX[m], tj = j + DZ[m];
          if (ti < 0 || tj < 0 || ti >= nx || tj >= L.nz) continue;
          const t = tj * nx + ti, ty = T.floor[t];
          if (!TS[t] || !(ty - fy > TOP_MIN)) continue;
          // straight up its side with nothing over the floor square, then over onto the top
          if (W.sweepSphere(v(fx, fy + SIDE + 0.005, fz), d(0, ty - fy, 0), SIDE, HIT)) continue;
          if (W.sweepSphere(v(fx, ty + SIDE + 0.005, fz), d(DX[m] * CELL, 0, DZ[m] * CELL), SIDE, HIT)) continue;
          U[f] |= 1 << m; Dn[t] |= 1 << (m ^ 1);   // (m ^ 1 is the way back)
        }
      }
    }
  }

  // again round a moved piece (bug-nav.js markBox: the same squares)
  markBox(T, i0, j0, i1, j1) {
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.markTop(T, j * T.nx + i);
    for (let j = Math.max(0, j0 - 1); j <= j1; j++) for (let i = Math.max(0, i0 - 1); i <= i1; i++) this.nav.markEdges(T, i, j);
    this.nav.markSteps(T, i0 - 2, j0 - 2, i1 + 1, j1 + 1);
    this.markLinks(T, i0 - 2, j0 - 2, i1 + 1, j1 + 1);
    this.key = -2;
  }

  reset() { this.job = null; this.since = Infinity; this.key = -2; for (const T of this.tops) T.flooded = false; }

  // Once a frame (bug-nav.js update): with the jelly up on a top, flood from it when its square changes
  update(dt, P) {
    this.since += dt;
    if (this.job) { this.floodOn(CLIMB_WORK); return; }
    let T = null, k = -1;
    for (const o of this.tops) {
      const c = cell(o, P.x, P.z);
      if (c >= 0 && Math.abs(o.floor[c] - P.y) < 0.05) { T = o; k = c; break; }
    }
    const key = T ? this.tops.indexOf(T) * 1e7 + k : -1;
    if (key === this.key || this.since < FLOOD_EVERY) return;
    this.since = 0; this.key = key;
    if (!T) { for (const o of this.tops) o.flooded = false; return; }   // on the floor (the first flood does), or somewhere no top is
    this.job = { T, s: 0, cur: 0, left: 0, x: P.x, y: P.y, z: P.z };
    this.floodStart();
    this.floodOn(CLIMB_WORK);
  }

  // squares: floor k is node k, top k is node n + k
  floodStart() {
    const J = this.job, T = J.T, s = J.s, D = T.next[s], n = T.n, R = Math.ceil(UNDER / CELL);
    D.fill(NONE); this.head.fill(-1); this.done.fill(0, 0, n * 2);
    J.cur = 0; J.left = 0;
    const ci = Math.floor((J.x - T.x0) / CELL), cj = Math.floor((J.z - T.z0) / CELL);
    for (let j = Math.max(0, cj - R); j <= Math.min(T.nz - 1, cj + R); j++) for (let i = Math.max(0, ci - R); i <= Math.min(T.nx - 1, ci + R); i++) {
      const k = j * T.nx + i;
      if (T.steps[s][k] && Math.abs(T.floor[k] - J.y) < 0.05 && (i - ci) ** 2 + (j - cj) ** 2 <= R * R) this.put(D, n + k, 0);
    }
  }

  put(D, q, nd) {
    const P = this.prev, X = this.nextIn, H = this.head, J = this.job;
    if (D[q] !== NONE) {   // already waiting at a dearer cost: out of that bucket
      const b = D[q] & (RING - 1);
      if (P[q] >= 0) X[P[q]] = X[q]; else H[b] = X[q];
      if (X[q] >= 0) P[X[q]] = P[q];
      J.left--;
    }
    D[q] = nd;
    const b = nd & (RING - 1);
    P[q] = -1; X[q] = H[b]; if (H[b] >= 0) P[H[b]] = q; H[b] = q;
    J.left++;
  }

  floodOn(work) {
    const J = this.job, T = J.T, s = J.s, D = T.next[s], n = T.n, nx = T.nx, L = T.base;
    const FS = L.steps[s], TS = T.steps[s], U = T.up[s], Dn = T.down[s], H = this.head, X = this.nextIn, done = this.done;
    while (J.left > 0 && work > 0) {
      const b = J.cur & (RING - 1);
      const q = H[b];
      if (q < 0) { J.cur++; continue; }
      H[b] = X[q]; if (X[q] >= 0) this.prev[X[q]] = -1;
      J.left--; done[q] = 1; work--;
      const cur = D[q], top = q >= n, k = top ? q - n : q, ways = top ? TS[k] : FS[k];
      for (let m = 0; m < 8; m++) {
        if (!(ways & (1 << m))) continue;
        const t = (top ? n : 0) + k + DX[m] + DZ[m] * nx, nd = cur + COST[m];
        if (!done[t] && nd < D[t]) this.put(D, t, nd);
      }
      const links = top ? Dn[k] : U[k];   // up or down a side: a step and the climb
      for (let m = 0; m < 4; m++) {
        if (!(links & (1 << m))) continue;
        const o = k + DX[m] + DZ[m] * nx, t = top ? o : n + o;
        const h = Math.abs((top ? T.floor[k] : T.floor[o]) - (top ? L.floor[o] : L.floor[k]));
        const nd = cur + STRAIGHT + Math.round(h / CELL * STRAIGHT);
        if (nd < NONE && !done[t] && nd < D[t]) this.put(D, t, nd);
      }
    }
    if (J.left > 0) return;
    T.next[s] = T.dist[s]; T.dist[s] = D;
    if (s + 1 < SIZES.length) { J.s++; this.floodStart(); return; }
    this.job = null;
    for (const o of this.tops) o.flooded = o === T;
    this.floods++;
  }

  // The way (m) for a body of radius r from a point on the floor or on a top to the jelly up on
  // furniture, climbing as it must, or Infinity: no climb flood, or none reaches it
  dist(x, y, z, r) {
    const s = this.nav.sizeOf(r);
    for (const T of this.tops) {
      if (!T.flooded) continue;
      const k = cell(T, x, z);
      if (k < 0) continue;
      const D = T.dist[s];
      const q = Math.abs(y - T.floor[k]) < 0.03 ? T.n + k : Math.abs(y - T.base.floor[k]) < 0.03 ? k : -1;
      if (q >= 0 && D[q] !== NONE) return D[q] / STRAIGHT * CELL;
    }
    return Infinity;
  }

  // (stories, dev) how many links each size has, and how many top squares
  count() {
    let tops = 0; const links = SIZES.map(() => 0);
    for (const T of this.tops) for (let k = 0; k < T.n; k++) {
      if (!Number.isNaN(T.floor[k])) tops++;
      for (let s = 0; s < SIZES.length; s++) for (let m = 0; m < 4; m++) if (T.up[s][k] & (1 << m)) links[s]++;
    }
    return { tops, links };
  }
}

const cell = (T, x, z) => {
  const i = Math.floor((x - T.x0) / CELL), j = Math.floor((z - T.z0) / CELL);
  return i < 0 || j < 0 || i >= T.nx || j >= T.nz ? -1 : j * T.nx + i;
};
const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), HIT = { normal: new THREE.Vector3(), point: new THREE.Vector3(), distance: 0 };
const v = (x, y, z) => V1.set(x, y, z), d = (x, y, z) => V2.set(x, y, z);
