// The Pothos: act 3's boss, the trailing houseplant from the shelf over the bed grown huge, in its
// mossy terracotta pot on the pillows at the head of the bed (the prototype's look B, "Cascade"): a
// mound of variegated heart-shaped leaves with a hollow at the front, the glowing heart in that
// hollow, and nine leafy vines trailing out over the pot's lip, down its wall and across the bed,
// lying on its real surface. Only the heart can be hurt (its centre() and r are the heart's); the
// vines and leaves stop bubbles (blocks()). The fight has its own camera view (`camera`, look.css).
// Its attacks: ATTACKS below, and the dragonflies (swarm) once below 70%.
// Same interface as the Vacuum and the Clog: position, r, center(), damage(), dead, rise, shielded,
// angry, update() -> {push}, dispose().
import * as THREE from 'three';
import { LOOK } from './look.js';
import { bus, PLAYER } from './events.js';
import { sfx } from './sfx.js';
import { CONTENT } from './content.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { hostile, TeleMaterial, laneHits, arcHits, ARC_IN, ARC_STEP } from './vfx.js';
import { pothosLeaf, pothosLeafMat } from './critters.js';
import { IS_TOUCH } from './touch.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const DOWN = new THREE.Vector3(0, -1, 0);
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// state names are attack names (as in clog.js), taken in turn; 'idle' is the pause between them
//   whip      Vine Whips: two trailing vines (three angry) rear up while their curved lanes on the
//             bed fill (the first aimed half a second ahead of where you're swimming: change
//             direction; the others swung aside, with room between), then lash along them (jump
//             them); after it the leaves round its heart part for a moment: shoot then
//   sweep     a vine winds up at one side and sweeps low across the wedge in front of the plant
//             (jump it)
//   cutting   it drops Cuttings on the bed near you (content/enemies.kdl): kill them before they sprout
//   roots     Aerial roots drop on you and round you
//   swarm     once, the first time its Health drops below 70% (not in turn): dragonflies come out
//             of the plant and its leaves close over its heart, shielding it, till they're dead or 30 s
// and whatever the turn (`always`, not a state):
//   snap      the guarding vines: close to its heart, vines snap at you one after another, each on
//             a short lane with its own quick Warning (not while the leaves are parted)
export const ATTACKS = { calm: ['whip', 'cutting', 'sweep', 'whip', 'roots'], angry: ['whip', 'sweep', 'cutting', 'whip', 'sweep', 'roots'], always: ['snap'] };

const SCALE = 0.8;                       // how big it grew (the prototype's verdict: 1.5x read as too big)
const POT_H = 0.24, POT_R = 0.16, POT_RB = 0.11;   // the pot, before SCALE
const HEART = 0.055;                     // the heart's radius, before SCALE
const LIDS = 8;                          // the leaves that close over the heart while it's shielded

// The terracotta pot: tapered, a thick rim, moss creeping up and over the rim, dark cracks
function potGeometry(h, rb, rt) {
  const prof = [];
  for (let k = 0; k <= 18; k++) { const y = (k / 18) * h * 0.86; prof.push(new THREE.Vector2(rb + (rt - rb) * (y / (h * 0.86)), y)); }
  prof.push(new THREE.Vector2(rt * 1.08, h * 0.87), new THREE.Vector2(rt * 1.1, h), new THREE.Vector2(rt * 0.96, h), new THREE.Vector2(rt * 0.94, h * 0.9));
  const g = new THREE.LatheGeometry(prof, 64), p = g.attributes.position, col = [];
  const clay = new THREE.Color(LOOK.color('pothos-pot', '#b8653c')), dark = new THREE.Color(LOOK.color('pothos-pot-dark', '#7e3f22'));
  const moss = new THREE.Color(LOOK.color('pothos-pot-moss', '#58772c')), crackC = new THREE.Color(LOOK.color('pothos-pot-crack', '#2a1608')), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i)), yn = y / h;
    const mossy = smooth(0.15, 0.6, Math.sin(a * 3 + 1.3) * 0.4 + Math.sin(a * 7 + y * 30) * 0.25 + (1 - yn) * 0.55 + (yn > 0.86 ? 0.5 : 0) - 0.15);
    const crack = Math.abs(((a * 1.6 + yn * 2.2 + Math.sin(yn * 35) * 0.05) % 1 + 1) % 1 - 0.5) < 0.012 && yn < 0.85 ? 1 : 0;
    c.copy(clay).lerp(dark, 0.25 + 0.25 * Math.sin(a * 11 + yn * 6) ** 2).lerp(moss, mossy * 0.85).lerp(crackC, crack * 0.9);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// The heart: a lumpy glowing seed, green and gold, wrinkled, with pale gold veins running top to
// bottom, finer ones branching across them, and dark pits between (radius 1)
function heartGeometry() {
  const ico = new THREE.IcosahedronGeometry(1, 18);   // fine enough for its veins (3.6k corners)
  ico.deleteAttribute('normal'); ico.deleteAttribute('uv');
  const g = mergeVertices(ico), p = g.attributes.position, col = [], v = new THREE.Vector3(), c = new THREE.Color();   // shared corners: smooth, not faceted
  ico.dispose();
  const gold = new THREE.Color(LOOK.color('pothos-heart-gold', '#ffd34a')), green = new THREE.Color(LOOK.color('pothos-heart', '#7dff5a'));
  const vein = new THREE.Color(LOOK.color('pothos-heart-vein', '#ffe066')), pit = new THREE.Color(LOOK.color('pothos-heart-pit', '#1f5a10'));
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 5 + v.y * 3) * Math.sin(v.y * 6 - v.z * 4) * Math.sin(v.z * 5 + v.x * 2);
    const fine = Math.sin(v.x * 17 + v.y * 5) * Math.sin(v.y * 15 - v.z * 9) * Math.sin(v.z * 13 + v.x * 11);
    const a = Math.atan2(v.x, v.z);
    const main = smooth(0.3, 0.12, Math.abs(Math.sin(a * 6 + v.y * 4 + n * 1.5)));
    const twig = smooth(0.18, 0.06, Math.abs(Math.sin(v.y * 14 + a * 3 + fine * 2)));
    v.multiplyScalar(1 + n * 0.14 + fine * 0.02 + main * 0.025).multiply(V(0.85, 1.15, 0.8));   // the veins stand out a little
    p.setXYZ(i, v.x, v.y, v.z);
    // a darker body, so the bright veins over it read
    c.copy(gold).lerp(green, THREE.MathUtils.clamp(0.5 + n * 0.8, 0, 1)).lerp(pit, 0.5 + smooth(0.2, 0.8, -fine) * 0.4)
      .lerp(vein, Math.max(main, twig * 0.6));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// built once and shared by every Pothos (main.js warms one up behind Play, the fight builds another)
let PARTS = null;
function parts() {
  if (PARTS) return PARTS;
  PARTS = {
    leaf: pothosLeaf(10, 14), pot: potGeometry(POT_H, POT_RB, POT_R), heart: heartGeometry(),
    dirt: new THREE.CircleGeometry(POT_R * 0.93, 32).rotateX(-Math.PI / 2),
    leafMat: pothosLeafMat(),          // (its own: the fight recolours its glow, Pothos.calmLeaf)
    vineMat: new THREE.MeshStandardMaterial({ color: LOOK.color('pothos-vine', '#3f6a26'), roughness: 0.6, emissive: LOOK.color('pothos-vine-glow', '#0a1a06') }),
    potMat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }),
    dirtMat: new THREE.MeshStandardMaterial({ color: LOOK.color('pothos-soil', '#241509'), roughness: 1 }),
    heartMat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: LOOK.color('pothos-heart-glow', '#2f8a14'), emissiveIntensity: 0.35 }),
  };
  return PARTS;
}

const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _s = new THREE.Vector3(), UP = V(0, 1, 0);
// a leaf's matrix: petiole at `pos`, running toward `out`, roughly facing up, rolled by `tilt`
function leafMatrix(pos, out, size, tilt) {
  _y.copy(out).normalize();
  _z.copy(UP).addScaledVector(_y, -UP.dot(_y)).normalize();
  if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1);
  _z.applyAxisAngle(_y, (tilt - 0.5) * 0.9);
  _x.crossVectors(_y, _z).normalize();
  return _m.makeBasis(_x, _y, _z).scale(_s.setScalar(size)).setPosition(pos);
}

// A trailing vine: a tapering tube along a curve through its points (in the plant's frame).
// Built once where it lies; a vine that moves (a whip) is rebuilt in place, only while it moves.
class Vine {
  constructor(pts, r, mat, taper) {
    Object.assign(this, { pts, r, taper, leaves: [] });
    this.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.segs = Math.max(48, pts.length * 2);
    this.mesh = new THREE.Mesh(new THREE.TubeGeometry(this.curve, this.segs, r, 7), mat);
    this.shape();
  }
  // its radius a fraction u of the way along it
  radiusAt(u) { return this.r * (1 - this.taper * u); }
  // taper the tube toward its tip (TubeGeometry is one radius all along)
  shape() {
    const g = this.mesh.geometry, p = g.attributes.position, ring = 8, c = _x, v = _y;
    for (let i = 0; i <= this.segs; i++) {
      this.curve.getPointAt(i / this.segs, c);
      const k = 1 - this.taper * (i / this.segs);
      for (let j = 0; j < ring; j++) { const n = i * ring + j; v.fromBufferAttribute(p, n).sub(c).multiplyScalar(k).add(c); p.setXYZ(n, v.x, v.y, v.z); }
    }
    p.needsUpdate = true; g.computeBoundingSphere();
  }
  // lay the tube round its curve again, in place (no new geometry: it runs every frame while the
  // vine moves), tapered like shape()
  rebuild() {
    const g = this.mesh.geometry, p = g.attributes.position, nr = g.attributes.normal, c = this.curve, n = this.segs, T = _vt, N = _vn, B = _vb, O = _vo;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      c.getPointAt(Math.min(1, u + 0.004), _va); c.getPointAt(Math.max(0, u - 0.004), _vc);
      T.subVectors(_va, _vc).normalize();
      c.getPointAt(u, O);
      if (i === 0) N.set(Math.abs(T.y) > 0.9 ? 1 : 0, Math.abs(T.y) > 0.9 ? 0 : 1, 0);
      N.addScaledVector(T, -N.dot(T)).normalize();         // carried along the curve, so the rings don't twist
      B.crossVectors(T, N);
      const rad = this.radiusAt(u);
      for (let j = 0; j < 8; j++) {
        const v = (j / 7) * Math.PI * 2, s = Math.sin(v), co = -Math.cos(v), k = i * 8 + j;
        const x = co * N.x + s * B.x, y = co * N.y + s * B.y, z = co * N.z + s * B.z;
        nr.setXYZ(k, x, y, z); p.setXYZ(k, O.x + rad * x, O.y + rad * y, O.z + rad * z);
      }
    }
    p.needsUpdate = true; nr.needsUpdate = true;
    g.computeBoundingSphere();
  }
  // which way it runs `u` of the way along it (arc length), into `out` (no allocation)
  tangentAt(u, out) {
    this.curve.getPointAt(Math.min(1, u + 0.004), _va); this.curve.getPointAt(Math.max(0, u - 0.004), _vc);
    return out.subVectors(_va, _vc).normalize();
  }
}
const _va = new THREE.Vector3(), _vc = new THREE.Vector3(), _vt = new THREE.Vector3(), _vn = new THREE.Vector3(), _vb = new THREE.Vector3(), _vo = new THREE.Vector3();

// --- laying the trailing vines on the bed (once, as the fight starts): out of the soil, over the
// pot's lip, down the outside of its wall, then along the real surface under them: up over the
// pillows, down into the mattress's dips, never floating or clipping. World meters here.
const VINES = 9, VINE_R = 0.011, VINE_TAPER = 0.7, STEP = 0.02;   // (STEP: how far apart, in meters, it feels for the surface)
const _o = new THREE.Vector3();
// the height of the surface under (x, z), and how much thicker a vine lying there looks from
// above on its slope (1 when it's flat)
let slope = 1;
const surfaceAt = (world, x, z, top) => {
  const hit = world.castAll(_o.set(x, top, z), DOWN, 1.2);
  slope = 1 / Math.max(0.35, Math.abs(hit?.normal?.y ?? 1));
  return hit ? hit.point.y : null;
};

// A vine's points (in the plant's frame) leaving the pot at angle `a`: fanned out `len` toward the
// foot of the bed (wobbling by `k`), or along `given` (world points on the bed: where a Vine Whip
// lands it). Returns { pts, drapeFrom } (the first point lying on the bed).
function layVine(world, at, box, a, len, k, given = null) {
  const S = SCALE, soil = POT_H * 0.9, top = at.y + 0.5;
  const ring = (r, y) => V(Math.cos(a) * r, y, Math.sin(a) * r).multiplyScalar(S).add(at);   // in the world
  const wall = (f) => POT_RB + (POT_R - POT_RB) * (f / 0.86) + 0.013;   // the pot's outside at height f (of its height), plus the vine's thickness
  const r0 = VINE_R * S;
  // out of the soil and over the lip, then down the outside wall until it meets what the pot stands in
  const pts = [ring(POT_R * 0.5, soil - 0.005), ring(POT_R * 0.9, soil + 0.05), ring(POT_R * 1.14, soil + 0.012), ring(POT_R * 1.13, POT_H * 0.84)];
  for (const f of [0.62, 0.35, 0.1]) {
    const p = ring(wall(f), POT_H * f), h = surfaceAt(world, p.x, p.z, top);
    if (h != null && p.y - r0 < h) break;
    pts.push(p);
  }
  // then out across the bed: the path in plan, fanned toward the foot, sampled every STEP
  const plan = [pts[pts.length - 1].clone().setY(0)];
  if (given) for (const p of given) plan.push(p.clone().setY(0));
  else for (let s = 1; s <= 14; s++) {
    const d = 0.14 + (s / 14) * len, wob = Math.sin(s * 0.75 + k) * 0.08 * (s / 14);
    plan.push(V(Math.cos(a + wob) * d + Math.cos(a + Math.PI / 2) * wob * 0.6, 0, Math.sin(a + wob) * d).multiplyScalar(S).add(at).setY(0));
  }
  const path = new THREE.CatmullRomCurve3(plan, false, 'centripetal'), L = path.getLength(), n = Math.ceil(L / STEP);
  const bed = [];
  for (let i = 0; i <= n; i++) {
    const p = path.getPointAt(i / n);
    if (p.x < box.min.x || p.x > box.max.x || p.z < box.min.z || p.z > box.max.z) break;   // the arena's edge: it ends on the bed
    const h = surfaceAt(world, p.x, p.z, top);
    if (h == null || h > at.y + 0.25) break;                                              // nothing under it, or the headboard
    bed.push({ p, h, k: slope });
  }
  // how far along the whole vine each point is (for its thickness there)
  let potLen = 0;
  for (let i = 1; i < pts.length; i++) potLen += pts[i].distanceTo(pts[i - 1]);
  const total = potLen + (bed.length - 1) * (L / n), radius = (u) => r0 * (1 - VINE_TAPER * u);
  const drapeFrom = pts.length, dir = V(0, 0, 0);
  const rest = (S, u = S.u) => S.p.clone().setY(S.h + radius(u) * 0.9 * S.k);   // lying on the surface, by its own thickness there
  // from A on to B (both on the bed): where the surface between them bends (a pillow's rounded
  // edge, the step out of the dip), follow it closer; where it's a ledge even close up, go from its
  // top edge straight down to its foot instead of cutting through its corner
  const on = (A, B) => {
    const far = A.p.distanceTo(B.p);
    if (far > 0.005) {
      const p = A.p.clone().lerp(B.p, 0.5), h = surfaceAt(world, p.x, p.z, top);
      if (h != null && Math.abs(h - (A.h + B.h) / 2) > 0.002) { const M = { p, h, k: slope, u: (A.u + B.u) / 2 }; on(A, M); on(M, B); return; }
    }
    if (far > 0.005 || Math.abs(B.h - A.h) <= 0.008) { pts.push(rest(B)); return; }
    let lo = 0, hi = 1;
    for (let it = 0; it < 6; it++) {
      const m = (lo + hi) / 2, q = _x.lerpVectors(A.p, B.p, m), hm = surfaceAt(world, q.x, q.z, top);
      if (hm != null && Math.abs(hm - A.h) < Math.abs(hm - B.h)) lo = m; else hi = m;
    }
    dir.subVectors(B.p, A.p).normalize();
    const r = radius(B.u) * 0.9, top0 = A.p.clone().lerp(B.p, B.h > A.h ? hi : lo), foot = A.p.clone().lerp(B.p, B.h > A.h ? lo : hi);
    const out = radius(B.u) * 1.05;
    foot.addScaledVector(dir, B.h > A.h ? -out : out);   // the foot of the face, a vine's thickness out from it
    if (B.h > A.h) pts.push(rest({ ...A, p: foot }), rest({ ...B, p: top0 }));
    else pts.push(rest({ ...A, p: top0 }), rest({ ...B, p: foot }));
    pts.push(rest(B));
  };
  bed.forEach((b, i) => { b.u = (potLen + i * (L / n)) / total; });
  if (bed.length) pts.push(rest(bed[0]));
  for (let i = 1; i < bed.length; i++) on(bed[i - 1], bed[i]);
  // into the plant's own frame
  for (const p of pts) p.sub(at).divideScalar(S);
  return { pts, drapeFrom };
}

// Where the pot's base rests at `at` (x, z; y is where to look down from): on the lowest of the
// surface under its base (sunk into the pillows round it, never over a gap between them)
function seat(world, at) {
  if (!world) return at;
  const rb = POT_RB * SCALE, top = at.y + 0.3;
  let y = Infinity;
  for (let k = 0; k < 17; k++) {
    const r = k === 0 ? 0 : k <= 8 ? rb * 0.5 : rb * 0.9, a = (k * Math.PI) / 4;
    const h = surfaceAt(world, at.x + Math.cos(a) * r, at.z + Math.sin(a) * r, top);
    if (h != null) y = Math.min(y, h);
  }
  return y < Infinity ? at.setY(y) : at;
}

// the plant in its own frame: the pot's base at the origin, facing -z (the foot of the bed).
// world/at/arena: where it stands, to lay its vines on the real bed (none without a world)
function buildPothos(world, at, arena) {
  const P = parts(), R = rng(7), root = new THREE.Group();
  const soil = POT_H * 0.9;
  root.add(new THREE.Mesh(P.pot, P.potMat));
  const dirt = new THREE.Mesh(P.dirt, P.dirtMat);
  dirt.position.y = soil;
  root.add(dirt);
  const heart = new THREE.Mesh(P.heart, P.heartMat);
  heart.position.set(0, soil + 0.12, -0.13);
  heart.scale.setScalar(HEART);
  root.add(heart);
  // a mound of leaves over the pot, a hollow at the front for the heart (`frame`: the leaves round
  // the hollow, that part to open it)
  const mound = [];
  for (let k = 0; k < 140; k++) {
    const u = R(), w = R() * Math.PI * 2, el = Math.acos(1 - u * 0.95);
    const dir = V(Math.sin(el) * Math.cos(w), Math.cos(el), Math.sin(el) * Math.sin(w));
    if (dir.z < -0.55 && dir.y < 0.75 && Math.abs(dir.x) < 0.5) continue;
    mound.push({ pos: V(0, soil + 0.06, 0).addScaledVector(dir, 0.1 + R() * 0.12), out: dir.clone().setY(dir.y * 0.6 + 0.2).normalize(), size: 0.09 + R() * 0.06, tilt: R(), frame: dir.z < -0.2 });
  }
  // the lids: the leaves nearest the hollow, and where each one folds to when they close over the
  // heart (shutAt, shut): hanging side by side from just above it, a curtain of leaves in front of it
  const lids = mound.filter((L) => L.frame).sort((p, q) => p.pos.distanceTo(heart.position) - q.pos.distanceTo(heart.position)).slice(0, LIDS);
  lids.sort((p, q) => p.pos.x - q.pos.x).forEach((L, k) => {
    const x = (k / (LIDS - 1) - 0.5) * HEART * 2.6;
    L.shutAt = heart.position.clone().add(V(x, HEART * (1 + (k % 2) * 0.3), -HEART * (1.3 + (k % 2) * 0.25)));
    L.shut = V(x * 2, -1, -0.3).normalize();
  });
  // nine trailing vines fanned toward the foot of the bed, lying on it
  const vines = [];
  if (world) {
    const box = new THREE.Box3(V(...arena.arenaMin), V(...arena.arenaMax)).expandByVector(V(-0.04, 0, -0.04));
    for (let k = 0; k < VINES; k++) {
      const a = -Math.PI / 2 + (k - (VINES - 1) / 2) * 0.42 + (R() - 0.5) * 0.15, len = 1.35 * (0.75 + R() * 0.5);
      const { pts, drapeFrom } = layVine(world, at, box, a, len, k);
      const v = new Vine(pts, VINE_R, P.vineMat, VINE_TAPER);
      v.drapeFrom = drapeFrom; v.angle = a;
      for (let j = 0; j < 11; j++) v.leaves.push({ t: 0.08 + 0.92 * (j + R() * 0.6) / 11,   // (from just past the lip: leafy over it, not a bare cage)
        side: j % 2 ? 1 : -1, size: 0.07 * (0.7 + R() * 0.5), tilt: R() });
      vines.push(v);
      root.add(v.mesh);
    }
  }
  // the veil: leaves hanging from the top of the hollow over its mouth, hiding the heart from in
  // front until they push aside after a Vine Whip (the opening)
  // (its mouth: a little below and in front of the heart, where a shot from the bed comes in)
  const mouth = heart.position.clone().add(V(0, -0.054, -0.107)), veil = [];
  for (let k = 0; k < VEIL; k++) {
    const x = (k - (VEIL - 1) / 2) * 0.03, pos = mouth.clone().add(V(x * 1.2, 0.1 - Math.abs(x) * 0.5, 0));
    veil.push({ pos, shut: V(-x * 2, -1, -0.15).normalize(), aside: V(x ? Math.sign(x) : 1, 0.7, 0.4).normalize(), size: 0.15 + R() * 0.02, tilt: 0.4 + R() * 0.2 });
  }
  // every leaf (the mound's, the veil's and the vines') as one instance of one mesh: one draw
  const count = mound.length + VEIL + vines.reduce((n, v) => n + v.leaves.length, 0);
  const leaves = new THREE.InstancedMesh(P.leaf, P.leafMat, count), tint = new THREE.Color();
  for (let i = 0; i < count; i++) leaves.setColorAt(i, tint.setRGB(0.82 + R() * 0.12, 0.88 + R() * 0.12, 0.8 + R() * 0.1));   // a slight shade per leaf
  root.add(leaves);
  // (room for the vines' points however a Vine Whip re-lays them)
  return { root, heart, leaves, mound, veil, vines, heartAt: heart.position.clone(), heartRest: heart.position.clone(), sway: new THREE.Vector3(), motion: 0, flutter: 0, close: 0, blockers: new Float32Array((count + VINES * 240) * 4), nBlock: 0 };
}
const VEIL = 5;

// Lay every leaf (the mound's, the veil's, then each vine's along it), and note what blocks
// bubbles: a ball round each leaf and along each vine (in the plant's frame), none over the heart's
// hollow but the veil's while it's shut. `open` 0..1: how far the leaves round the hollow have
// pushed aside. `bound`: also refit the one ball round all of it (when a vine has landed somewhere
// new). Runs every frame while the plant moves: allocates nothing. (M.close: how far the lids have
// closed over the heart while it's shielded, 0 open .. 1 shut)
const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _c = new THREE.Vector3(), _w = new THREE.Vector3(), _v = new THREE.Vector3();
let LM = null, LI = 0, LOPEN = 0;
function keep(c, r, always = false) {
  const B = LM.blockers;
  // the hollow stays open: the way to the heart; wider while its leaves are parted (the opening), so
  // nothing over the pot's lip in front of it (a vine draped there) stops a shot in then
  if (!always && c.distanceTo(LM.heartAt) < r + HEART * (1.4 + LOPEN)) return;
  if (LM.nBlock * 4 >= B.length) return;
  B[LM.nBlock * 4] = c.x; B[LM.nBlock * 4 + 1] = c.y; B[LM.nBlock * 4 + 2] = c.z; B[LM.nBlock * 4 + 3] = r; LM.nBlock++;
}
function leaf(m, size, block = 1) {
  LM.leaves.setMatrixAt(LI++, m);
  if (block) keep(_c.set(0, 0.5, 0).applyMatrix4(m), size * 0.42, block === 2);
}
const _canopy = new THREE.Vector3(), _flutter = new THREE.Vector3();
function canopyLeaf(pos, dir, L, block = 1) {
  _canopy.copy(pos).add(LM.sway);
  _flutter.copy(dir); _flutter.x += Math.sin(LM.motion + L.tilt * 12) * LM.flutter;
  leaf(leafMatrix(_canopy, _flutter, L.size, L.tilt), L.size, block);
}
function placeLeaves(M, open = 0, bound = true) {
  LM = M; LI = 0; LOPEN = open; M.nBlock = 0;
  for (const L of M.mound) {
    if (L.shut && M.close) { canopyLeaf(_v.copy(L.pos).lerp(L.shutAt, M.close), _w.copy(L.out).lerp(L.shut, M.close), L); continue; }
    if (!L.frame || !open) { canopyLeaf(L.pos, L.out, L); continue; }
    // round the hollow: pushed out from it (away from its axis) and drooping
    _q.subVectors(L.pos, M.heartRest).setZ(0);
    if (_q.lengthSq() < 1e-6) _q.set(0, 1, 0);
    _p.copy(L.pos).addScaledVector(_q.normalize(), open * 0.06);
    _q.copy(L.out); _q.y -= open * 0.4;
    canopyLeaf(_p, _q, L);
  }
  for (const L of M.veil) {
    _q.copy(L.shut).lerp(L.aside, open);
    _canopy.copy(L.pos).add(M.sway);
    leaf(leafMatrix(_canopy, _q, L.size * (1 - open * 0.2), L.tilt), L.size, open < 0.5 ? 2 : 0);
  }
  for (const v of M.vines) {
    for (const L of v.leaves) {
      v.curve.getPointAt(L.t, _p); v.tangentAt(L.t, _q);
      _x.crossVectors(_q, UP).normalize().multiplyScalar(L.side);
      _y.copy(_x).addScaledVector(_q, 0.5).addScaledVector(UP, 0.3 + L.tilt * 0.3 + Math.sin(M.motion - L.t * 8 + v.angle) * M.flutter);
      leaf(leafMatrix(_p, _y, L.size, L.tilt), L.size);
    }
    for (let k = 0; k < v.pts.length; k++) keep(v.pts[k], v.radiusAt(k / (v.pts.length - 1)));
  }
  M.leaves.instanceMatrix.needsUpdate = true;
  if (!bound) return;
  M.leaves.computeBoundingSphere();
  // one ball round all of it, to skip the rest at once
  const B = M.blockers;
  M.bound = new THREE.Sphere().setFromPoints(Array.from({ length: M.nBlock }, (_, k) => V(B[k * 4], B[k * 4 + 1], B[k * 4 + 2])));
  M.bound.radius += 0.1;
}

// does the moving ball SEG (from o, `len` along unit d, radius r) touch the ball at c of radius cr?
const SEG = { ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 0, len: 0, r: 0 };
function touchesBall(cx, cy, cz, cr) {
  const S = SEG, t = Math.min(S.len, Math.max(0, (cx - S.ox) * S.dx + (cy - S.oy) * S.dy + (cz - S.oz) * S.dz));
  const x = S.ox + S.dx * t - cx, y = S.oy + S.dy * t - cy, z = S.oz + S.dz * t - cz, q = cr + S.r;
  return x * x + y * y + z * z <= q * q;
}

// --- the Vine Whip's lane: a curved floor strip on the bed (one TeleMaterial 'strip', bent, its
// uvs kept) with a chain of low lane volumes along it (vfx.js 'lane', one per segment, each on the
// surface where it starts), both in the Pothos's hostile colour, filling together. The hit is the
// shared lane rule per segment. Built once per lane and re-laid for each whip.
const LANE_SEGS = 8, LANE_ROWS = LANE_SEGS * 4 + 1;
const _lt = new THREE.Vector3(), _ld = new THREE.Vector3(), _ls = new THREE.Vector3(), _ln = new THREE.Vector3();
function makeLane(scene, fx) {
  const col = hostile('pothos'), g = new THREE.BufferGeometry(), uv = [], idx = [];
  for (let j = 0; j < LANE_ROWS; j++) {
    const v = 1 - j / (LANE_ROWS - 1);                    // (a strip's uv.y runs from its far end, 0, to its start, 1)
    uv.push(0, v, 1, v);
    if (j) { const a = 2 * j - 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LANE_ROWS * 6), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(LANE_ROWS * 6).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));   // (as every floor Warning has: the same shader program)
  g.setIndex(idx);
  const strip = new THREE.Mesh(g, new TeleMaterial(col, 'strip'));
  strip.renderOrder = 3; strip.visible = false;
  scene.add(strip);
  const vols = Array.from({ length: LANE_SEGS }, () => { const m = fx.volume(col, 'lane', strip.position, 1); m.visible = false; return m; });
  return {
    strip, vols, on: false, side: 1, bearing: 0, vine: null, t: 0, SK: null, struck: false, kind: '',
    rows: Array.from({ length: LANE_ROWS }, () => new THREE.Vector3()),
    segs: vols.map(() => ({ start: new THREE.Vector3(), dir: new THREE.Vector3(), len: 0 })),
  };
}
function showLane(L, on, progress = 0, opacity = 1) {
  L.strip.visible = on;
  L.strip.material.progress = progress; L.strip.material.opacity = opacity;
  for (const v of L.vols) { v.visible = on; v.material.progress = progress; v.material.opacity = opacity; }
}
// Lay lane L from the foot of the pot (at `h`) through T, bowed to `side`, out to SK.reach (or the
// arena's edge; a guarding vine's snap: `over` m past T), on the bed's real surface
function aimLane(L, T, side, SK, h, A, world) {
  const m = 0.03, top = h.y + 0.5, w = SK.width, R = L.rows;
  const d = _ld.set(T.x - h.x, 0, T.z - h.z);
  if (d.lengthSq() < 1e-6) d.set(0, 0, -1);
  d.normalize();
  const S = _ls.copy(h).addScaledVector(d, POT_R * SCALE + 0.02);
  const D = Math.max(0.12, Math.hypot(T.x - S.x, T.z - S.z)), n = _ln.set(-d.z, 0, d.x), bow = side * Math.min(0.08, 0.25 * D);
  let len = Math.min(SK.reach, D + (SK.over ?? 0.2));
  const lay = () => { for (let j = 0; j < LANE_ROWS; j++) { const s = (len * j) / (LANE_ROWS - 1), q = s / D; R[j].copy(S).addScaledVector(d, s).addScaledVector(n, bow * 4 * q * (1 - q)); } };
  lay();
  const inside = (p) => p.x > A.arenaMin[0] + m && p.x < A.arenaMax[0] - m && p.z > A.arenaMin[2] + m && p.z < A.arenaMax[2] - m;
  let last = 0;
  while (last + 1 < LANE_ROWS && inside(R[last + 1])) last++;
  if (last < LANE_ROWS - 1) { len *= Math.max(1, last) / (LANE_ROWS - 1); lay(); }   // it ends at the arena's edge
  let y = h.y;
  for (const p of R) { const s = surfaceAt(world, p.x, p.z, top); if (s != null && s < h.y + 0.25) y = s; p.y = y; }
  L.side = side; L.bearing = Math.atan2(d.z, d.x);
  // the floor strip: two corners per row, across the way it runs there
  const pos = L.strip.geometry.attributes.position, o = L.strip.position.copy(R[0]);
  for (let j = 0; j < LANE_ROWS; j++) {
    const a = R[Math.max(0, j - 1)], b = R[Math.min(LANE_ROWS - 1, j + 1)], r = R[j];
    _lt.set(b.x - a.x, 0, b.z - a.z).normalize();
    const px = -_lt.z * w / 2, pz = _lt.x * w / 2;
    pos.setXYZ(2 * j, r.x - px - o.x, r.y + 0.004 - o.y, r.z - pz - o.z);
    pos.setXYZ(2 * j + 1, r.x + px - o.x, r.y + 0.004 - o.y, r.z + pz - o.z);
  }
  pos.needsUpdate = true;
  L.strip.geometry.computeBoundingSphere();
  // the lane volumes over it, segment by segment (and what the hit tests)
  L.segs.forEach((g, i) => {
    const a = R[i * 4], b = R[i * 4 + 4], v = L.vols[i];
    g.start.copy(a); g.dir.set(b.x - a.x, 0, b.z - a.z); g.len = g.dir.length();
    if (g.len > 1e-6) g.dir.divideScalar(g.len); else g.dir.copy(d);
    v.position.copy(a); v.rotation.y = Math.atan2(g.dir.x, g.dir.z); v.scale.set(w, SK.height, Math.max(1e-3, g.len));
  });
}
// The whipping vine's pose (into its work points, then its tube): `rear` 0..1 wound up and back
// off the bed, then `lash` 0..1 swept across onto where it lands. Round the pot's axis, so it
// never cuts through the pot. Allocates nothing.
const _pa = new THREE.Vector3(), _pb = new THREE.Vector3();
function poseVine(L, rear, lash) {
  const v = L.vine, W = v.work.length, e = smooth(0, 1, lash);
  for (let j = 0; j < W; j++) {
    const u = j / (W - 1), f = smooth(0.12, 1, u);
    L.from.getPointAt(u, _pa); L.to.getPointAt(u, _pb);
    const ra = Math.hypot(_pa.x, _pa.z), rb = Math.hypot(_pb.x, _pb.z), tb = Math.atan2(_pb.z, _pb.x);
    const t1 = Math.atan2(_pa.z, _pa.x) - L.side * 0.6 * f * rear, y1 = _pa.y + rear * 0.16 * Math.sin(Math.PI * f);
    const turn = Math.atan2(Math.sin(tb - t1), Math.cos(tb - t1));
    const th = t1 + turn * e, r = ra + (rb - ra) * e, y = y1 + (_pb.y - y1) * e + 0.05 * Math.sin(Math.PI * lash) * f;
    v.work[j].set(Math.cos(th) * r, y, Math.sin(th) * r);
  }
  v.rebuild();
}

// --- the sweeping vine's Warning: a wedge on the bed in front of the plant (one TeleMaterial
// 'wedge' mesh, draped over the bed's real surface: built once, as the plant never moves), with a
// row of low arc volumes (vfx.js 'arc', ARC_STEP wide each) over its outer band, each at the bed's
// highest under it, in the Pothos's hostile colour, filling together. Bearings (rad, as rotation.y:
// atan2(dx, dz)) are counted from straight ahead (the foot of the bed, PI); `at` is the pot's foot.
// Its size (reach, arc) is read as the fight starts.
function makeSweep(scene, fx, at, SK, world) {
  const col = hostile('pothos'), reach = SK.reach, inner = ARC_IN * reach, K = Math.max(1, Math.round((SK.arc * Math.PI) / 180 / ARC_STEP)), half = (K * ARC_STEP) / 2;
  const NA = K * 4, NR = 6, top = at.y + 0.5;
  const ground = (f, r) => { const b = Math.PI + f; return surfaceAt(world, at.x + Math.sin(b) * r, at.z + Math.cos(b) * r, top) ?? at.y; };
  // the floor wedge: a grid over its band, its corners on the bed; uv laid so the wedge shape's
  // apex (uv 0.5, 0.5) is the pot and its fill runs out from `inner` to `reach`
  const pos = [], uv = [], nor = [], idx = [], ys = [];
  for (let i = 0; i <= NA; i++) for (let j = 0; j <= NR; j++) {
    const f = -half + (i / NA) * 2 * half, r = inner + (j / NR) * (reach - inner), b = Math.PI + f, q = j / NR, y = ground(f, r);
    ys.push(y);
    pos.push(Math.sin(b) * r, y + 0.004, Math.cos(b) * r);
    uv.push(0.5 + 0.5 * q * Math.cos(f), 0.5 + 0.5 * q * Math.sin(f));
    nor.push(0, 1, 0);
    if (i && j) { const a = (i - 1) * (NR + 1) + j - 1, c = i * (NR + 1) + j - 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
  }
  const base = Math.min(...ys);
  for (let k = 1; k < pos.length; k += 3) pos[k] -= base;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));   // (as every floor Warning has: the same shader program)
  g.setIndex(idx);
  const floor = new THREE.Mesh(g, new TeleMaterial(col, 'wedge', half));
  floor.position.set(at.x, base, at.z); floor.renderOrder = 3; floor.visible = false;
  scene.add(floor);
  // the arc volumes, each at the bed's highest under it
  const pieceY = new Float32Array(K), vols = [];
  for (let k = 0; k < K; k++) {
    let y = -Infinity;
    for (let i = k * 4; i <= k * 4 + 4; i++) for (let j = 0; j <= NR; j++) y = Math.max(y, ys[i * (NR + 1) + j]);
    pieceY[k] = y;
    const m = fx.volume(col, 'arc', _lt.set(at.x, y, at.z), _ls.set(reach, SK.height, reach));
    m.rotation.y = Math.PI - half + (k + 0.5) * ARC_STEP; m.visible = false;
    vols.push(m);
  }
  // the bed's height along the sweep, from the pot's foot out (where the vine lies as it sweeps)
  const VR = 10, r0 = POT_R * SCALE * 1.15, bed = new Float32Array((NA + 1) * (VR + 1));
  for (let i = 0; i <= NA; i++) for (let j = 0; j <= VR; j++) bed[i * (VR + 1) + j] = ground(-half + (i / NA) * 2 * half, r0 + (j / VR) * (reach - r0));
  const column = (f) => Math.round(THREE.MathUtils.clamp((f + half) / (2 * half), 0, 1) * NA);
  return {
    floor, vols, reach, inner, half, vine: null, r0, VR, bed, column,
    // the bottom of the arc volume `f` rad round from straight ahead (what the hit tests)
    floorAt: (f) => pieceY[Math.min(K - 1, Math.max(0, Math.floor((Math.atan2(Math.sin(f), Math.cos(f)) + half) / ARC_STEP)))],
  };
}
function showSweep(W, on, progress = 0, opacity = 1) {
  W.floor.visible = on; W.floor.material.progress = progress; W.floor.material.opacity = opacity;
  for (const v of W.vols) { v.visible = on; v.material.progress = progress; v.material.opacity = opacity; }
}
// The sweeping vine's pose at bearing b: out of the soil, over the pot's lip, then straight out
// along the bed to the sweep's reach, `lift` m off it (more toward its tip). Allocates nothing.
function poseSweep(W, at, b, lift) {
  const v = W.vine, n = v.work.length, S = SCALE, sa = Math.sin(b), ca = Math.cos(b), col = W.column(b - Math.PI) * (W.VR + 1);
  for (let j = 0; j < n; j++) {
    const u = j / (n - 1);
    let r, y;
    if (u < 0.15) { const k = u / 0.15; r = POT_R * (0.5 + 0.65 * k); y = POT_H * 0.9 + 0.05 * Math.sin(Math.PI * k); }
    else {
      const k = (u - 0.15) / 0.85, rad = W.r0 + k * (W.reach - W.r0);
      r = rad / S; y = (W.bed[col + Math.round(k * W.VR)] + VINE_R * S + lift * (0.3 + 0.7 * k) - at.y) / S;
    }
    v.work[j].set(sa * r, y, ca * r);
  }
  v.rebuild();
}

export class Pothos {
  // arena: the stage's boss block (stage3.js): `pot` is where the pot stands, on the pillows
  constructor(scene, enemies, fx, arena, world) {
    Object.assign(this, { scene, enemies, fx, arena, world });
    this.kind = 'pothos';
    this.r = HEART * SCALE * 1.1;        // what bubbles must touch: the heart
    this.def = CONTENT.bosses.pothos;    // its numbers (content/bosses.kdl), read fresh so the Tuner's edits land mid-fight
    this.maxHp = this.hp = this.def.hp;
    this.dead = false;
    this.dying = false;   // doomed at 0 hp: held for Dendi's finishing smack (die(), main.js)
    this.t = 0;
    this.rise = 0;
    this.state = 'idle';
    this.stateT = 3;                     // the first attack comes a moment after it rises
    this.next = 0;
    this.guards = [];                    // the dragonflies it let out (the swarm): its heart is shielded while they live
    this.swarmed = false;
    this.guardT = 0;
    this.wither = 0;
    this.glowColor = new THREE.Color(LOOK.color('pothos-heart-halo', '#5ee83a'));
    // angry (below enrage at), its heart burns hot and beats faster: the same material, recoloured
    this.calmGlow = this.glowColor.clone(); this.calmEmissive = new THREE.Color(LOOK.color('pothos-heart-glow', '#2f8a14'));
    this.angryGlow = new THREE.Color(LOOK.color('pothos-heart-angry-halo', '#ff8a2a')); this.angryEmissive = new THREE.Color(LOOK.color('pothos-heart-angry', '#c8460e'));
    this.calmLeaf = new THREE.Color(LOOK.color('pothos-leaf-glow', '#071405')); this.angryLeaf = new THREE.Color(LOOK.color('pothos-leaf-angry', '#220902'));   // and its leaves smoulder with each beat
    this.rage = 0; this.beatT = 0; this.wasAngry = false;
    this.swaySize = LOOK.num('pothos-sway', 0.025);
    this.swayRate = LOOK.num('pothos-sway-rate', 1.8);
    this.flutter = LOOK.num('pothos-flutter', 0.18);
    // the opening, made to read from the fight camera (look.css): the heart swells and its glow
    // spreads, and the leaves round it light up with it
    this.openLeaf = new THREE.Color(LOOK.color('pothos-leaf-open', '#3b5a0a'));
    this.openGrow = LOOK.num('pothos-open-grow', 0.4); this.openHalo = LOOK.num('pothos-open-halo', 0.5);
    const at = seat(world, V(...arena.pot));
    this.model = buildPothos(world, at, arena);
    this.model.heart.material.emissive.copy(this.calmEmissive);   // (shared: a past fight may have left it angry)
    this.model.leaves.material.emissive.copy(this.calmLeaf);
    placeLeaves(this.model);
    // the fight view (camera.js, run.js): back and up from the jelly's, to keep the heart in frame
    // below the boss bar; a phone's short, wide screen has its own (look.css --pothos-camera-*-phone)
    this.camera = IS_TOUCH
      ? { distance: LOOK.num('pothos-camera-distance-phone', 1.1), pitch: LOOK.num('pothos-camera-tilt-phone', 0.6), ahead: LOOK.num('pothos-camera-ahead-phone', 1.5) }
      : { distance: LOOK.num('pothos-camera-distance', 0.95), pitch: LOOK.num('pothos-camera-tilt', 0.785), ahead: LOOK.num('pothos-camera-ahead', 1.0) };
    this.holder = new THREE.Group();
    this.holder.position.copy(at);
    this.holder.add(this.model.root);
    this.model.root.scale.setScalar(0.001);
    scene.add(this.holder);
    this._heart = new THREE.Vector3(); this._drop = new THREE.Vector3(); this._knockDir = new THREE.Vector3(); this._push = new THREE.Vector3();
    this.knock = 0;
    // the Vine Whips: their Warnings (a lane per vine: two at once calm, three angry), straight in
    // the scene; whipT is how long since the current whip began (-1: none)
    this.lanes = [0, 1, 2].map(() => makeLane(scene, fx));
    // the guarding vines' snaps at a jelly close to the heart: lanes of their own, a few at once
    this.snaps = [0, 1].map(() => makeLane(scene, fx));
    this.snapT = 0;
    this.box = new THREE.Box3(V(...arena.arenaMin), V(...arena.arenaMax)).expandByVector(V(-0.04, 0, -0.04));
    this.whipT = -1; this.struck = false; this.whipSide = 1;
    this._aim = new THREE.Vector3(); this._whipKnock = new THREE.Vector3();
    this.knockForce = 0; this.knockLaunch = 0;
    // the sweeping vine: its Warning (a wedge on the bed with low arc volumes over it), built once
    this.sweeper = world ? makeSweep(scene, fx, seat(world, V(...arena.pot)), this.def.skills.sweep, world) : null;
    this.sweepT = -1; this.sweepDir = 1;
    // the opening: how far the leaves round the heart have parted (0..1), and for how long more
    this.open = 0; this.openT = 0;
  }

  get position() { return this.holder.position; }
  // the heart, where it is now (it grows with the rise, and beats)
  center(out = new THREE.Vector3()) {
    const h = this.model.heart.position, s = this.model.root.scale.x;
    return out.set(h.x * s, h.y * s, h.z * s).add(this.holder.position);
  }
  // Does its body (the vines and leaves) stop a bubble moving `len` along `dir` from `pos`?
  // (bubbles.js asks every boss that has this) Only the heart can be hurt: the rest is in the way.
  blocks(pos, dir, len, r = 0) {
    const M = this.model, s = M.root.scale.x;
    if (s < 0.05) return false;
    const h = this.holder.position, B = M.blockers, b = M.bound;
    // into the plant's frame (no allocation: this runs per bubble per frame)
    SEG.ox = (pos.x - h.x) / s; SEG.oy = (pos.y - h.y) / s; SEG.oz = (pos.z - h.z) / s;
    SEG.dx = dir.x; SEG.dy = dir.y; SEG.dz = dir.z; SEG.len = len / s; SEG.r = r / s;
    if (!touchesBall(b.center.x, b.center.y, b.center.z, b.radius)) return false;
    for (let k = 0; k < M.nBlock; k++) if (touchesBall(B[k * 4], B[k * 4 + 1], B[k * 4 + 2], B[k * 4 + 3])) return true;
    return false;
  }

  get shielded() { return this.guards.length > 0; }
  get angry() { return this.hp < this.maxHp * this.def.skills.enrage.at; }

  damage(amount, color = '#fff') {
    if (this.dead || this.dying || this.rise < 1) return;
    if (this.shielded) { this.fx.number(this.center().setY(this.center().y + 0.05), 'SHIELDED', '#cfe6ff', 12); return; }
    this.hp -= amount;
    this.hitPop = 1;
    this.fx.number(this.center().setY(this.center().y + 0.06), Math.round(amount), color, 16);
    if (this.hp <= 0) { this.hp = 0; this.dying = true; }   // doomed, not dead: the cat finishes it (main.js)
  }
  die() { if (this.dying) { this.dying = false; this.dead = true; } }

  update(dt, player) {
    const out = this.tick(dt, player);
    if (out.hit) bus.emit('damage_taken', { targetId: PLAYER, amount: out.hit, source: 'boss' });
    if (out.knock) bus.emit('knockback', { targetId: PLAYER, dir: out.knock, force: this.knockForce, launch: this.knockLaunch });
    bus.emit('boss_health', { name: this.arena.name, hp: this.hp, maxHp: this.maxHp, shielded: this.shielded, shieldText: 'SHIELDED' });
    return { push: out.push };
  }

  tick(dt, player) {
    this.t += dt;
    this.player = player;
    const out = { push: null, hit: 0 };
    const M = this.model, s = SCALE;
    if (this.dead) {
      // it wilts back down into its pot
      if (!this.wither) sfx.clogDeath?.();
      this.wither = Math.min(1, this.wither + dt * 0.6);
      M.root.scale.setScalar(s * (1 - this.wither * 0.7));
      M.heart.material.emissiveIntensity = 0.35 * (1 - this.wither);
      for (const L of this.lanes) showLane(L, false);
      for (const L of this.snaps) showLane(L, false);
      if (this.sweeper) showSweep(this.sweeper, false);
      return out;
    }
    // doomed: its attacks drop and it waits for the cat
    if (this.dying) {
      for (const L of this.lanes) showLane(L, false);
      for (const L of this.snaps) showLane(L, false);
      if (this.sweeper) showSweep(this.sweeper, false);
      return out;
    }
    // it grows up out of the pillows
    if (this.rise < 1) {
      if (this.rise === 0) sfx.clogRise?.();
      this.rise = Math.min(1, this.rise + dt * this.def.skills.rise.rate);
      M.root.scale.setScalar(s * Math.max(0.001, smooth(0, 1, this.rise)));
    } else M.root.scale.setScalar(s);
    // the heart beats and glows in its hollow (kept below white so its colour reads), flaring while
    // the leaves round it are parted
    // angry, it roars once in a puff of hot glow, and its heart turns hot and quickens
    const angry = this.angry;
    if (angry && !this.wasAngry) { sfx.clogRoar?.(); this.fx.puff(this.center(this._heart), this.angryGlow, 0.08, 0.6); }
    this.wasAngry = angry;
    this.rage += ((angry ? 1 : 0) - this.rage) * Math.min(1, dt * 3);
    // The pot stays seated; the living canopy moves together with its real hit target/blockers.
    M.motion += dt * this.swayRate * (1 + this.rage * 0.5);
    M.flutter = this.flutter * this.rise;
    const sway = this.swaySize * this.rise * (1 + this.rage * 0.35);
    M.sway.set(Math.sin(M.motion) * sway, Math.sin(M.motion * 2) * sway * 0.3, Math.sin(M.motion * 0.7) * sway * 0.35);
    M.heart.position.copy(M.heartRest).add(M.sway); M.heartAt.copy(M.heart.position);
    this.glowColor.copy(this.calmGlow).lerp(this.angryGlow, this.rage);
    M.heart.material.emissive.copy(this.calmEmissive).lerp(this.angryEmissive, this.rage);
    this.beatT += dt * (4 + this.rage * 3);
    const beat = Math.max(0, Math.sin(this.beatT)) ** 4, open = this.open;
    M.leaves.material.emissive.copy(this.calmLeaf).lerp(this.angryLeaf, this.rage * (0.4 + beat * 0.6)).lerp(this.openLeaf, open * (0.75 + beat * 0.25));
    this.hitPop = Math.max(0, (this.hitPop || 0) - dt * 5);
    // shielded, the lids fold shut over the heart and it dims behind them; they open again after
    const shut = this.shielded ? 1 : 0;
    if (M.close !== shut) {
      M.close += (shut - M.close) * Math.min(1, dt * 6);
      if (Math.abs(shut - M.close) < 0.01) M.close = shut;
    }
    M.heart.scale.setScalar(HEART * (1 + beat * 0.05 + this.hitPop * 0.12 + open * this.openGrow));
    M.heart.material.emissiveIntensity = (0.3 + beat * 0.15 + open * 0.8) * (1 - M.close * 0.75);
    this.fx.glow.hold(this.center(this._heart), this.glowColor, (0.14 * (0.8 + beat * 0.3) + open * this.openHalo) * (1 - M.close * 0.6), (0.6 + open * 0.4) * (1 - M.close * 0.7));
    // its attacks, in turn
    const SW = this.def.skills.swarm;
    if (this.rise >= 1 && SW && !this.swarmed && this.state === 'idle' && this.hp < this.maxHp * SW.at) this.begin('swarm');
    if (this.guards.length) {
      // The shield has its own lifetime; summoning it no longer freezes the attack rotation.
      this.guards = this.guards.filter((e) => !e.dead);
      if ((this.guardT -= dt) <= 0) this.guards = [];
    }
    if (this.rise >= 1) {
      this.stateT -= dt;
      if (this.stateT <= 0) {
        if (this.state === 'idle') { const order = this.angry ? ATTACKS.angry : ATTACKS.calm; this.begin(order[this.next++ % order.length]); }
        else { const SK = this.def.skills[this.state]; this.state = 'idle'; this.stateT = this.angry ? (SK.angryRest ?? SK.rest) : SK.rest; }
      }
    }
    // the guarding vines: a jelly close to the heart gets snapped at, again and again while it
    // stays (not while the leaves are parted: the opening is the way in)
    if (this.rise >= 1) this.guard(dt, player);
    // the vines under way (whips, snaps, the sweep), and the opening after a whip
    let whipping = false;
    for (const L of this.lanes) if (L.on) { this.laneTick(L, dt, out); whipping = true; }
    for (const L of this.snaps) if (L.on) this.laneTick(L, dt, out);
    if (this.whipT >= 0) this.whipT = whipping ? this.whipT + dt : -1;
    if (this.sweepT >= 0) this.sweepTick(dt, out);
    this.openT = Math.max(0, this.openT - dt);
    this.open = this.openT > 0 ? Math.min(1, this.open + dt * 6) : Math.max(0, this.open - dt * 4);
    placeLeaves(M, this.open, false);
    // bumping into the pot hurts and knocks you back off it
    const P = player.position, h = this.holder.position, dx = P.x - h.x, dz = P.z - h.z, d = Math.hypot(dx, dz);
    this.knock = Math.max(0, this.knock - dt);
    const BU = this.def.skills.bump;
    if (this.knock <= 0 && d < POT_R * SCALE + player.cfg.radius && P.y < h.y + POT_H * SCALE) {
      out.hit = this.def.contact;
      this.knock = BU.every;
      if (d) this._knockDir.set(dx / d, 0, dz / d); else this._knockDir.set(0, 0, -1);
    }
    if (this.knock > 0) out.push = this._push.copy(this._knockDir).multiplyScalar(BU.push);
    return out;
  }

  // start an attack (the stories start them directly too)
  begin(name) {
    const SK = this.def.skills[name];
    this.state = name;
    this.stateT = SK.time;
    if (name === 'roots') this.roots(SK);
    if (name === 'cutting') this.cuttings(SK);
    if (name === 'swarm') this.swarm(SK);
    if (name === 'whip') this.whip(SK);
    if (name === 'sweep') this.sweep(SK);
  }

  // Vine Whips: several vines at once (`count`, `angryCount` angry), each along its own curved lane
  // from the pot's foot across the bed. The first is aimed `lead` s ahead of where you're swimming
  // (the lead is the Pothos's one exception to never leading: change direction to dodge; its Warning
  // runs as long as any Boss attack's); the others swing `swing` radians round the pot to either
  // side of it, all bowed the same way, so between two lanes there is always room to slip through.
  // The trailing vine nearest each lane rears up while its Warning fills, then lashes along it
  whip(SK) {
    for (const L of this.lanes) if (L.on) this.landLane(L);
    const P = this.player.position, v = this.player.velocity, b = this.box, h = this.holder.position;
    const n = Math.min(this.angry ? SK.angryCount : SK.count, this.lanes.length), side = this.whipSide = -this.whipSide;
    const ax = P.x + v.x * SK.lead - h.x, az = P.z + v.z * SK.lead - h.z, T = this._aim;
    for (let k = 0; k < n; k++) {
      const a = SK.swing * (k === 0 ? 0 : k % 2 ? side : -side) * Math.ceil(k / 2);   // 0, then one side, then the other
      T.set(h.x + ax * Math.cos(a) - az * Math.sin(a), P.y, h.z + ax * Math.sin(a) + az * Math.cos(a));
      T.x = THREE.MathUtils.clamp(T.x, b.min.x, b.max.x); T.z = THREE.MathUtils.clamp(T.z, b.min.z, b.max.z);
      this.startLane(this.lanes[k], 'whip', SK, T, side);
    }
    this.whipT = 0; this.struck = false;
    sfx.clogLashWind?.();
  }

  // The guarding vines: while the jelly is within `radius` m (flat) of the heart, a vine snaps at
  // where it is every `every` s (the first `first` s after it comes close), each a short straight
  // lane with its own quick Warning (`windup` s): walking straight in is punished; weave in during
  // the opening after a whip (they hold still then), or bait a snap and dash.
  guard(dt, player) {
    const GU = this.def.skills.guard, P = player.position, c = this.center(this._heart);
    if (!GU || Math.hypot(P.x - c.x, P.z - c.z) > GU.radius) { this.snapT = GU ? GU.first : 0; return; }
    if ((this.snapT -= dt) > 0 || this.openT > 0) return;
    const L = this.snaps.find((s) => !s.on);   // (only when one starts: a few times a second at most)
    if (!L) return;
    this.snapT = GU.every;
    this.startLane(L, 'snap', GU, P, 0);
    sfx.clogLashWind?.();
  }

  // start lane L: its Warning aimed through T (bowed to `side`), and the free trailing vine nearest
  // its way, to lash along it
  startLane(L, kind, SK, T, side) {
    const h = this.holder.position, b = this.box;
    aimLane(L, T, side, SK, h, this.arena, this.world);
    Object.assign(L, { on: true, kind, SK, t: 0, struck: false, vine: null });
    let best = null, far = Infinity;
    for (const vine of this.model.vines) {
      if (this.vineBusy(vine)) continue;
      const d = Math.abs(Math.atan2(Math.sin(vine.angle - L.bearing), Math.cos(vine.angle - L.bearing)));
      if (d < far) { far = d; best = vine; }
    }
    if (!best) return;                           // (a plant built without a world has no vines)
    const given = L.rows.filter((_, j) => j % 2 === 0);
    const { pts, drapeFrom } = layVine(this.world, h, b, L.bearing, 0, 0, given);
    Object.assign(L, { vine: best, from: best.curve, fromPts: best.pts, fromDrape: best.drapeFrom, to: new THREE.CatmullRomCurve3(pts, false, 'centripetal'), toPts: pts, toDrape: drapeFrom });
    if (!best.work) { best.work = Array.from({ length: 48 }, () => new THREE.Vector3()); best.workCurve = new THREE.CatmullRomCurve3(best.work, false, 'centripetal'); }
    best.pts = best.work; best.curve = best.workCurve; best.workCurve.needsUpdate = true;
  }
  // is this vine whipping, snapping or sweeping now?
  vineBusy(v) {
    for (const L of this.lanes) if (L.on && L.vine === v) return true;
    for (const L of this.snaps) if (L.on && L.vine === v) return true;
    return this.sweepT >= 0 && this.sweeper?.vine === v;
  }

  // a lane under way: its Warning fills, the strike, the vine lashing onto it, then lying there
  laneTick(L, dt, out) {
    const SK = L.SK, u = Math.min(1, (L.t += dt) / SK.windup);
    if (!L.struck) {
      showLane(L, true, u, 0.8 + Math.sin(this.t * 26) * 0.2);
      if (u >= 1) this.strike(L, out);
    }
    const lash = L.struck ? Math.min(1, (L.t - SK.windup) / SK.lash) : 0;
    if (L.kind === 'snap' && lash >= 1) {
      // a snap recoils: the vine whips back to where it lay (not left between you and the heart)
      const back = Math.min(1, (L.t - SK.windup - SK.lash) / (SK.lash * 2));
      if (L.vine) poseVine(L, 0, 1 - back);
      if (back >= 1) this.landLane(L);
      return;
    }
    if (L.vine) poseVine(L, smooth(0, 1, u), lash);
    if (lash >= 1) this.landLane(L);
  }

  // the strike: anything of the jelly in the lane's low box, segment by segment, is hit and knocked
  // (a whip: aside, out of the lane; a snap: away from the heart); the Warning goes, and after a
  // whip the leaves round the heart part (the opening)
  strike(L, out) {
    const SK = L.SK;
    L.struck = true;
    showLane(L, false);
    if (L.vine) L.vine.workCurve.needsUpdate = true;
    if (L.kind === 'whip') { this.struck = true; this.openT = SK.open; sfx.clogLash?.(); }
    else sfx.clogLash?.();
    const P = this.player.position, cfg = this.player.cfg, end = L.rows[LANE_ROWS - 1];
    this.fx.impact(_lt.copy(end).setY(end.y + 0.01), hostile('pothos'), L.kind === 'whip' ? 0.03 : 0.02, L.kind === 'whip' ? 12 : 8);
    if (out.knock) return;
    for (const g of L.segs) {
      if (g.len < 1e-3 || !laneHits(g.start, g.dir, g.len, SK.width, SK.height, P, cfg)) continue;
      if (L.kind === 'whip') {
        const cross = g.dir.x * (P.z - g.start.z) - g.dir.z * (P.x - g.start.x), s = Math.abs(cross) > 1e-4 ? Math.sign(cross) : L.side;
        out.knock = this._whipKnock.set(-g.dir.z * s, 0, g.dir.x * s);
      } else out.knock = this._whipKnock.set(g.dir.x, 0, g.dir.z);
      out.hit = Math.max(out.hit, SK.dmg);
      this.knockForce = SK.knock; this.knockLaunch = SK.launch ?? 0;
      break;
    }
  }

  // a whipped vine comes to rest along its lane, lying on the bed under it; a snapping one where it was
  landLane(L) {
    const v = L.vine;
    if (v && L.kind === 'snap') { Object.assign(v, { pts: L.fromPts, curve: L.from, drapeFrom: L.fromDrape }); v.rebuild(); }
    else if (v) { Object.assign(v, { pts: L.toPts, curve: L.to, drapeFrom: L.toDrape, angle: L.bearing }); v.rebuild(); }
    showLane(L, false);
    L.on = false; L.vine = null;
    placeLeaves(this.model, this.open, true);
  }

  // The sweeping vine: a vine winds up at one end of the wedge in front of the plant while its
  // Warning fills (`windup` s), then sweeps across it in `swing` s, low over the bed (`height` m:
  // jump it), from `inner` (ARC_IN of `reach`) out to `reach` m from the pot; it alternates sides
  sweep(SK) {
    const W = this.sweeper;
    if (!W) return;
    if (this.sweepT >= 0) this.endSweep();
    this.sweepDir = -this.sweepDir;
    this.sweepT = 0; this.swept = false; this.sweepAt = W.half * -this.sweepDir;
    // the vine nearest where it starts
    const b = Math.PI + this.sweepAt, a = Math.PI / 2 - b;
    let best = null, far = Infinity;
    for (const vine of this.model.vines) {
      if (this.vineBusy(vine)) continue;
      const d = Math.abs(Math.atan2(Math.sin(vine.angle - a), Math.cos(vine.angle - a)));
      if (d < far) { far = d; best = vine; }
    }
    W.vine = best;
    if (best) {
      if (!best.work) { best.work = Array.from({ length: 48 }, () => new THREE.Vector3()); best.workCurve = new THREE.CatmullRomCurve3(best.work, false, 'centripetal'); }
      best.pts = best.work; best.curve = best.workCurve; best.workCurve.needsUpdate = true;
    }
    sfx.vacBrushes?.(SK.windup + SK.swing);
  }

  sweepTick(dt, out) {
    const W = this.sweeper, SK = this.def.skills.sweep, t = (this.sweepT += dt);
    const u = Math.min(1, t / SK.windup), k = smooth(0, 1, (t - SK.windup) / SK.swing);
    const was = this.sweepAt;
    this.sweepAt = W.half * this.sweepDir * (2 * k - 1);
    // the Warning fills to the moment it starts across, and holds, fading, while it sweeps
    // (a big area: held a little dimmer than a lane, so the vine reads through it), and as the vine
    // sweeps, the arcs it has passed go
    showSweep(W, true, u, t < SK.windup ? 0.65 + Math.sin(this.t * 26) * 0.15 : 0.5 * (1 - k));
    if (t >= SK.windup) for (let i = 0; i < W.vols.length; i++) W.vols[i].visible = (-W.half + (i + 0.5) * ARC_STEP - this.sweepAt) * this.sweepDir > -ARC_STEP / 2;
    if (t >= SK.windup && !this.swept) {
      if (k > 0 && !this.sweepCracked) { this.sweepCracked = true; sfx.clogLash?.(); }
      const P = this.player.position, cfg = this.player.cfg, c = _lt.copy(this.holder.position);
      c.y = W.floorAt(Math.atan2(P.x - c.x, P.z - c.z) - Math.PI);
      if (arcHits(c, W.inner, W.reach, Math.PI + was, Math.PI + this.sweepAt, SK.height, P, cfg)) {
        this.swept = true;
        this.fx.impact(this._heart.copy(P).setY(P.y + 0.01), hostile('pothos'), LOOK.num('pothos-sweep-impact', 0.025), 8);
        out.hit = Math.max(out.hit, SK.dmg);
        // knocked on the way it sweeps, and away from the pot
        const b = Math.PI + this.sweepAt, s = this.sweepDir;
        out.knock = this._whipKnock.set(Math.cos(b) * s + Math.sin(b) * 0.5, 0, -Math.sin(b) * s + Math.cos(b) * 0.5).normalize();
        this.knockForce = SK.knock; this.knockLaunch = 0;
      }
    }
    if (W.vine) poseSweep(W, this.holder.position, Math.PI + (t < SK.windup ? W.half * -this.sweepDir : this.sweepAt), t < SK.windup ? smooth(0, 1, u) * 0.06 : 0.012);
    if (t >= SK.windup + SK.swing) this.endSweep();
  }

  // the sweeping vine comes to rest where it stopped, lying on the bed
  endSweep() {
    const W = this.sweeper, v = W.vine;
    showSweep(W, false);
    this.sweepT = -1; this.sweepCracked = false;
    if (v) {
      const h = this.holder.position, b = Math.PI + this.sweepAt, a = Math.PI / 2 - b, given = [];
      for (let k = 1; k <= 6; k++) { const r = POT_R * SCALE + (k / 6) * (W.reach - POT_R * SCALE); given.push(V(h.x + Math.sin(b) * r, 0, h.z + Math.cos(b) * r)); }
      const { pts, drapeFrom } = layVine(this.world, h, this.box, a, 0, 0, given);
      Object.assign(v, { pts, curve: new THREE.CatmullRomCurve3(pts, false, 'centripetal'), drapeFrom, angle: a });
      v.rebuild();
    }
    W.vine = null;
    placeLeaves(this.model, this.open, true);
  }

  // the swarm: `count` dragonflies (content/enemies.kdl, as they are anywhere) burst out of the
  // leaves round the heart, fanned out toward the foot of the bed
  swarm({ count, shield }) {
    this.swarmed = true;
    const c = this.center(this._heart);
    for (let k = 0; k < count; k++) {
      const a = (k - (count - 1) / 2) * 0.7, q = this._drop.set(c.x + Math.sin(a) * 0.06, c.y + 0.04, c.z - Math.cos(a) * 0.06);
      const e = this.enemies.spawn('dragonfly', q);
      e.spawnT = 0.5;
      this.guards.push(e);
    }
    this.guardT = shield;
    this.fx.impact(c, hostile('pothos'), 0.05, 16);
    sfx.ladyBuzz?.();
  }

  // Cuttings: flung onto the bed `near` m round you, in pairs when it's angry; each is an enemy
  // (content/enemies.kdl "cutting") that sprouts if it's left alone
  cuttings({ count, angryCount, near }) {
    const P = this.player.position, A = this.arena, h = this.holder.position, m = 0.05, keep = POT_R * SCALE + 0.06;
    const n = this.angry ? angryCount : count, a0 = Math.random() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      const a = a0 + (k * Math.PI * 2) / n, at = this._drop.set(P.x + Math.cos(a) * near, 0, P.z + Math.sin(a) * near);
      const dx = at.x - h.x, dz = at.z - h.z, d = Math.hypot(dx, dz);
      if (d < keep) { at.x = h.x + (d ? dx / d : 0) * keep; at.z = h.z + (d ? dz / d : -1) * keep; }   // clear of the pot
      at.x = THREE.MathUtils.clamp(at.x, A.arenaMin[0] + m, A.arenaMax[0] - m);
      at.z = THREE.MathUtils.clamp(at.z, A.arenaMin[2] + m, A.arenaMax[2] - m);
      const hit = this.world.castAll(at.setY(A.arenaMax[1]), DOWN, A.arenaMax[1] - A.arenaMin[1] + 0.3);
      at.y = hit ? hit.point.y : P.y;
      const e = this.enemies.spawn('cutting', at);
      e.root.rotation.y = Math.random() * Math.PI * 2;
      e.grounded = true;
      this.fx.impact(at.clone().setY(at.y + 0.01), hostile('pothos'), 0.02, 8);
    }
    sfx.clogRustle?.();
  }

  // Aerial roots: they drop from the canopy and the shelf over the bed, one onto where you are and the
  // rest round you; each is an enemy (content/enemies.kdl "root") that falls on its own Warning
  roots({ count, spread }) {
    const P = this.player.position, base = Math.random() * Math.PI * 2;
    for (let k = 0; k < count; k++) {
      // the ones round you spaced evenly (with a little jitter): two side by side pushed each other off their Warnings
      const a = base + (k - 1) * Math.PI * 2 / Math.max(1, count - 1) + (Math.random() - 0.5) * 0.6, d = k ? spread * (0.5 + 0.5 * Math.random()) : 0;
      const at = this._drop.set(P.x + Math.sin(a) * d, P.y + 0.1, P.z + Math.cos(a) * d);
      at.y = this.enemies.floorBelow(at, P.y);
      this.enemies.spawn('root', at);
    }
  }

  dispose() {
    this.scene.remove(this.holder);
    this.model.leaves.dispose();         // its instance buffers; the shared geometry and materials stay
    for (const v of this.model.vines) v.mesh.geometry.dispose();
    for (const L of [...this.lanes, ...this.snaps]) {
      for (const m of [L.strip, ...L.vols]) { this.scene.remove(m); m.material.dispose(); }
      L.strip.geometry.dispose();          // (the volumes share vfx.js's unit geometry)
    }
    if (this.sweeper) {
      for (const m of [this.sweeper.floor, ...this.sweeper.vols]) { this.scene.remove(m); m.material.dispose(); }
      this.sweeper.floor.geometry.dispose();
    }
  }
}
