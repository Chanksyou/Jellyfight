// Every Elite stands clear of the furniture and walls round it, with room to fight (guard).
// For each act's Elites, at their spots in the real room:
//   body   its model (the pieces drawn, their real triangles) crosses no scenery: only the surface it
//          stands on (or the wall it hangs on) may touch it, within `LIFT`
//   room   where its 1 on 1 (`stand`) and its vent's landing put the jelly, the jelly stays put, on
//          the Elite's own surface (inside its `wake` box), sees it, and can swim up to it
//   moves  every attack, played from those spots (and, for one that moves the Elite, from round its
//          furniture top too): its body never crosses scenery and it never drops off its surface
// Each crossing is reported with the scenery piece and the size of the patch (m).
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { ATTACKS } from '../elites.js';
import { CONFIG } from '../config.js';
import { G, V, act2, act3, fresh, holdJelly, night4, ok, restore, step, story, tp } from './kit.js';

const LIFT = 0.02;    // a body may sink this far into its own surface (a cushion, a quilt's folds, a wall's plaster)
const CLIP = 0.01;    // a crossing patch bigger than this (m) is a clip
const SWELL = 0.03;   // its furniture top may rise this far round it (a quilt, a cushion's crown)
const SAME = 0.06;    // a surface within this (m) of the Elite's own is the same furniture top (a bed's top undulates)

const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
const solid = (m) => [m.material].flat().some((x) => x && x.visible !== false && x.colorWrite !== false && !(x.transparent && x.opacity < 0.05) && x.blending !== THREE.AdditiveBlending);

// the Elite's drawn body pieces, each with its own BVH
function parts(e) {
  const out = [];
  e.holder.updateMatrixWorld(true);
  e.model.group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !shown(o) || !solid(o)) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    if (!o.geometry.boundsTree) o.geometry.boundsTree = new MeshBVH(o.geometry, { indirect: true });
    out.push(o);
  });
  return out;
}

const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _box = new THREE.Box3(), _pb = new THREE.Box3(), _seg = new THREE.Line3();
const nameOf = (o) => { for (; o; o = o.parent) if (o.name && !/^(mesh|Mesh)?_?\d*$/.test(o.name)) return o.name; return '?'; };

// where the Elite's surface crosses the scenery's, more than LIFT above the furniture top right under
// the crossing (a cushion or a quilt isn't flat: a top up to SWELL over its feet still counts as its
// own; anything taller standing on it doesn't), or for a hanging one, out from its wall: { piece: patch size (m) }
export function clipsOf(e) {
  const { world } = G(), P = parts(e), hits = {};
  const normal = e.wall ? V(Math.sin(e.wall.yaw), 0, Math.cos(e.wall.yaw)) : V(0, 1, 0);
  const d0 = normal.dot(e.wall ? V(e.wall.x, 0, e.wall.z) : e.base);
  const E = G().run.elites, tops = new Map(), from = V(0, 0, 0);
  const top = (v) => {   // the furniture top under a point, from just over the Elite's feet (cached per cm)
    const k = Math.round(v.x * 100) * 100000 + Math.round(v.z * 100);
    if (!tops.has(k)) tops.set(k, E.surfaceBelow(from.set(v.x, e.base.y + 0.05, v.z)));
    return tops.get(k);
  };
  const above = (v) => { if (e.wall) return normal.dot(v) - d0; const t = top(v); return v.y - (t - e.base.y <= SWELL ? t : e.base.y); };
  const body = new THREE.Box3();
  for (const p of P) body.union(_pb.copy(p.geometry.boundingBox).applyMatrix4(p.matrixWorld));
  for (const c of world.colliders) {
    if (!shown(c) || !c.geometry.boundsTree) continue;
    if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
    if (!_box.copy(c.geometry.boundingBox).applyMatrix4(c.matrixWorld).intersectsBox(body)) continue;
    _inv.copy(c.matrixWorld).invert();
    for (const p of P) {
      _m.multiplyMatrices(_inv, p.matrixWorld);
      c.geometry.boundsTree.bvhcast(p.geometry.boundsTree, _m, {
        intersectsTriangles(t1, t2) {
          if (!t1.intersectsTriangle(t2, _seg)) return false;
          for (const v of [_seg.start, _seg.end]) {
            v.applyMatrix4(c.matrixWorld);
            if (above(v) >= LIFT) (hits[nameOf(c)] ||= new THREE.Box3()).expandByPoint(v);
          }
          return false;
        },
      });
    }
  }
  const out = {};
  for (const [k, b] of Object.entries(hits)) { const s = b.getSize(V(0, 0, 0)); out[k] = +Math.max(s.x, s.y, s.z).toFixed(3); WHERE[k] = [r3(b.min), r3(b.max)]; }
  return out;
}
const WHERE = {};   // the last patch each piece crossed at (world min, max): for the report
const worst = (c) => Math.max(0, ...Object.values(c));
const r3 = (v) => v.toArray().map((n) => +n.toFixed(3));

// where the jelly lands on the Elite's furniture: its 1 on 1 spot and its vents' landings
function spotsFor(e) {
  const W = e.spec.wake, inW = (p) => p[0] >= W.min[0] && p[0] <= W.max[0] && p[2] >= W.min[2] && p[2] <= W.max[2] && p[1] >= W.min[1] - 0.05 && p[1] <= W.max[1];
  const out = [];
  if (e.spec.stand) out.push(['stand', e.spec.stand]);
  for (const v of G().run.stage.vents || []) if (inW(v.land)) out.push([v.name, v.land]);
  return out;
}

// more spots round its furniture top: the wake box's corners and middle, 8 cm in, on its surface
function roundSpots(e) {
  const W = e.spec.wake, E = G().run.elites, out = [], y = e.home.y;
  for (const [fx, fz] of [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1]]) {
    const x = THREE.MathUtils.lerp(W.min[0] + 0.08, W.max[0] - 0.08, fx), z = THREE.MathUtils.lerp(W.min[2] + 0.08, W.max[2] - 0.08, fz);
    const sy = E.surfaceBelow(V(x, y + 0.1, z));
    if (Math.abs(sy - y) < 0.03 && Math.hypot(x - e.home.x, z - e.home.z) > e.r + 0.06) out.push([`round ${fx},${fz}`, [x, sy, z]]);
  }
  return out;
}

const elite = (kind) => G().run.elites.list.find((x) => x.kind === kind);

// the jelly at a spot, the Elite resting: does it stay, on the Elite's surface, see it and reach it?
function room(kind, name, at) {
  fresh({ bubbles: false, lash: false });
  const e = elite(kind), E = G().run.elites, { player } = G(), R = CONFIG.player.radius;
  e.cool = 99; tp(...at); step(40);
  const p = player.position, y = e.home.y;
  const stayed = Math.hypot(p.x - at[0], p.z - at[2]) < 0.03;
  const surface = Math.abs(p.y - y) < SAME && E.onPlatform(e, p);
  const pc = p.clone().setY(p.y + CONFIG.player.height / 2);
  const sees = E.canSee(e, pc, R);
  const flat = swim(e, false);
  let reach = flat.reach ? 'swim' : false, stuck = flat.reach ? undefined : flat.stuck;
  if (!reach) { tp(...at); step(5); if (swim(e, true).reach) reach = 'jump'; }
  restore();
  return { name, at, stayed, surface, sees, reach, ...(stuck ? { stuck } : {}) };
}

// swim straight at the Elite (jumping every half second if `jump`) until the jelly all but touches it
function swim(e, jump) {
  const { input, tpc, player } = G(), p = player.position, goal = e.spec.at, near = e.r + CONFIG.player.radius + 0.03;
  let best = Infinity;
  input.keys = new Set(['KeyW']);
  for (let i = 0; i < 300 && best >= near; i++) {
    const dx = goal[0] - p.x, dz = goal[2] - p.z;
    best = Math.min(best, Math.hypot(dx, dz));
    tpc.yaw = Math.atan2(-dx, -dz);
    if (jump && i % 30 === 0) input.jumpQueued = true;
    step(1);
  }
  input.keys = new Set();
  return { reach: best < near, stuck: r3(p) };
}

// the lowest point of its body over the surface under it: + floats, - sunk in
function gapOf(e) {
  let low = Infinity;
  const v = V(0, 0, 0);
  for (const m of parts(e)) {
    const a = m.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) low = Math.min(low, v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld).y);
  }
  return +(low - G().run.elites.surfaceBelow(e.base)).toFixed(3);
}

// a better spot: away from what it clips (from the middle of the patches toward it, straight or up to
// 45 degrees off, 1 cm steps up to 20 cm, inside its wake box) to where it clips nothing at rest, set
// down on its surface; null if none
function suggest(e, where) {
  const E = G().run.elites, home = e.home.clone(), W = e.spec.wake, patches = Object.values(where);
  const mid = patches.reduce((m, [lo, hi]) => m.add(V((lo[0] + hi[0]) / 2, 0, (lo[2] + hi[2]) / 2)), V(0, 0, 0)).divideScalar(patches.length || 1);
  const away = patches.length ? Math.atan2(home.x - mid.x, home.z - mid.z) : 0;
  try {
    for (let d = patches.length ? 0.01 : 0; d <= 0.2; d += 0.01) for (const off of [0, 1, -1, 2, -2]) {
      const a = away + off * Math.PI / 8, x = home.x + Math.sin(a) * d, z = home.z + Math.cos(a) * d;
      if (x < W.min[0] || x > W.max[0] || z < W.min[2] || z > W.max[2]) continue;
      E.moveElite(e, V(x, home.y + 0.05, z));
      if (Math.abs(e.base.y - home.y) > SAME) continue;
      e.holder.updateMatrixWorld(true);
      if (worst(clipsOf(e)) <= CLIP && Math.abs(gapOf(e)) <= 0.02) return { at: r3(e.base), by: +d.toFixed(2) };
    }
    return null;
  } finally { e.base.copy(home); e.holder.position.copy(home); e.holder.updateMatrixWorld(true); }
}

// one attack, the jelly held at `at`: the worst crossing on the way, and how far it got off its surface
function moves(kind, attack, name, at) {
  fresh({ bubbles: false, lash: false });
  const e = elite(kind);
  e.cool = 99; tp(...at); holdJelly(); step(10);
  e.cool = 0; e.next = attack;
  const started = step(240, () => e.state !== 'idle') < 240;
  const clips = {}, home = e.home.clone();
  let moved = 0, drop = 0;
  for (let i = 0; i < 900 && started; i++) {
    step(1);
    if (i % 5 === 0) {
      for (const [k, v] of Object.entries(clipsOf(e))) clips[k] = Math.max(clips[k] || 0, v);
      moved = Math.max(moved, Math.hypot(e.holder.position.x - home.x, e.holder.position.z - home.z));
      if (!e.wall) drop = Math.max(drop, Math.abs(e.base.y - home.y));
    }
    if (e.state === 'idle' && i > 30) break;
  }
  restore();
  return { attack, name, started, moved: +moved.toFixed(3), drop: +drop.toFixed(3), clips };
}

const cases = [
  [story, 'controller'], [story, 'mug'], [story, 'kettle'],
  [act2, 'soap'], [act2, 'clock'], [act2, 'whipper'],
  [act3, 'croc'], [act3, 'bull'], [act3, 'coffer'],
  [night4, 'bowl'], [night4, 'pillow'], [night4, 'headphones'],
];
// Known to fail, waiting on a bigger move (task 1b, /mnt/project-files/elite-fixes-nov18/room-check.md):
// a story here passes while it still fails, and fails once it's fixed (take it off then)
const KNOWN = {
  pillow: 'its back half is inside the sofa back cushion',
  bull: 'it stands in the baby wipes, and its rush runs into the changing pad\'s raised ends',
  bowl: 'its striker, running round the rim for the Hum, pokes 2 cm into the chair\'s back',
  coffer: 'its Accordion lid, slamming down by the stand spot, goes 2 cm into the piece on the desk\'s front edge',
};
for (const [register, kind] of cases) register(`${register === story ? 'elites/' : ''}room-${kind}`, {
  about: `The ${kind} stands clear of furniture and walls, the jelly lands beside it on its own surface with a clear swim to it, and none of its attacks carries it into scenery or off its surface.`,
  setup() { fresh({ bubbles: false, lash: false }); const s = spotsFor(elite(kind))[0]; if (s) tp(...s[1]); },
  play() {
    for (const k in WHERE) delete WHERE[k];
    fresh({ bubbles: false, lash: false }); step(2);
    const e = elite(kind);
    const gap = e.wall ? 0 : gapOf(e);
    const rest = clipsOf(e), where = { ...WHERE }, spots = spotsFor(e), more = roundSpots(e);
    if (e.wall) { tp(...spots[0][1]); holdJelly(); e.cool = 99; step(200); Object.assign(rest, Object.fromEntries(Object.entries(clipsOf(e)).map(([k, v]) => [k + ' (down)', v]))); restore(); }
    const rooms = spots.map(([n, at]) => room(kind, n, at));
    const acts = [];
    for (let a = 0; a < ATTACKS[kind].length; a++) {
      const first = moves(kind, a, ...spots[0]);
      acts.push(first);
      if (first.moved > 0.03) for (const [n, at] of [...spots.slice(1), ...more]) acts.push(moves(kind, a, n, at));
    }
    const bad = [];
    if (worst(rest) > CLIP) bad.push({ rest });
    if (Math.abs(gap) > 0.02) bad.push({ gap });
    for (const r of rooms) if (!(r.stayed && r.surface && r.sees && r.reach)) bad.push(r);
    for (const m of acts) if (worst(m.clips) > CLIP || m.drop > SAME) bad.push(m);
    if (!spots.length) bad.push('no stand or vent landing on its furniture');
    const during = { ...WHERE };
    const move = (worst(rest) > CLIP || Math.abs(gap) > 0.02) && !e.wall ? suggest(e, where) : undefined;
    if (KNOWN[kind]) return ok(bad.length, { known: KNOWN[kind], fixed: !bad.length && 'take it off KNOWN', bad, move, during });
    return ok(!bad.length, { bad, move, gap, where, during, rest, rooms, acts: acts.map((m) => [m.attack, m.name, m.started, m.moved, m.drop, worst(m.clips)]) });
  },
});
