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
import { hostile } from './vfx.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const DOWN = new THREE.Vector3(0, -1, 0);
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// state names are attack names (as in clog.js), taken in turn; 'idle' is the pause between them
//   cutting   it drops Cuttings on the bed near you (content/enemies.kdl): kill them before they sprout
//   roots     Aerial roots drop on you and round you
//   swarm     once, the first time its Health drops below 70% (not in turn): dragonflies come out
//             of the plant and its leaves close over its heart, shielding it, till they're dead or 30 s
export const ATTACKS = { calm: ['cutting', 'roots'], angry: ['cutting', 'roots'] };

const SCALE = 0.8;                       // how big it grew (the prototype's verdict: 1.5x read as too big)
const POT_H = 0.24, POT_R = 0.16, POT_RB = 0.11;   // the pot, before SCALE
const HEART = 0.055;                     // the heart's radius, before SCALE
const LIDS = 8;                          // the leaves that close over the heart while it's shielded

// A pothos leaf: heart-shaped, cupped, tip drooping, high-contrast gold streaks fanning out from a
// gold midrib over deep green (look.css --pothos-leaf-*). Its petiole is at the origin, it runs
// along +y to its tip (1 m: scaled per leaf) and faces +z.
function leafGeometry() {
  const g = new THREE.PlaneGeometry(1, 1, 10, 14), p = g.attributes.position, col = [];
  const deep = new THREE.Color(LOOK.color('pothos-leaf-deep', '#0a2a0c')), green = new THREE.Color(LOOK.color('pothos-leaf', '#164d18'));
  const cream = new THREE.Color(LOOK.color('pothos-leaf-gold', '#ffdf4a')), rib = new THREE.Color(LOOK.color('pothos-leaf-rib', '#e0c235')), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), t = p.getY(i) + 0.5;                      // u -0.5..0.5 across, t 0 base .. 1 tip
    const w = 0.62 * Math.pow(Math.sin(Math.PI * Math.min(1, (t + 0.14) / 1.14)), 0.8) * (1 - 0.12 * t);
    const x = u * 2 * w, y = t - 0.16 * Math.abs(u * 2) * Math.pow(1 - t, 3), z = -0.14 * t * t + 0.1 * (u * 2) * (u * 2) * w;
    p.setXYZ(i, x, y, z);
    const streak = Math.sin(Math.atan2(x, t + 0.06) * 15 + Math.sin(t * 9 + x * 7) * 1.4) * 0.5 + 0.5;
    const blotch = Math.sin(x * 23 + t * 17) * Math.sin(t * 29 - x * 11) * 0.5 + 0.5;
    c.copy(green).lerp(deep, Math.abs(u * 2) * 0.6);
    if (Math.abs(x) < 0.02) c.lerp(rib, 0.6);
    else c.lerp(cream, smooth(0.66, 0.9, streak * 0.75 + blotch * 0.35) * (0.45 + 0.55 * t));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// The terracotta pot: tapered, a thick rim, moss creeping up and over the rim, dark cracks
function potGeometry(h, rb, rt) {
  const prof = [];
  for (let k = 0; k <= 18; k++) { const y = (k / 18) * h * 0.86; prof.push(new THREE.Vector2(rb + (rt - rb) * (y / (h * 0.86)), y)); }
  prof.push(new THREE.Vector2(rt * 1.08, h * 0.87), new THREE.Vector2(rt * 1.1, h), new THREE.Vector2(rt * 0.96, h), new THREE.Vector2(rt * 0.94, h * 0.9));
  const g = new THREE.LatheGeometry(prof, 64), p = g.attributes.position, col = [];
  const clay = new THREE.Color('#b8653c'), dark = new THREE.Color('#7e3f22'), moss = new THREE.Color('#58772c'), crackC = new THREE.Color('#2a1608'), c = new THREE.Color();
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
  const vein = new THREE.Color(LOOK.color('pothos-heart-vein', '#fff3b0')), pit = new THREE.Color(LOOK.color('pothos-heart-pit', '#1f5a10'));
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
    leaf: leafGeometry(), pot: potGeometry(POT_H, POT_RB, POT_R), heart: heartGeometry(),
    dirt: new THREE.CircleGeometry(POT_R * 0.93, 32).rotateX(-Math.PI / 2),
    leafMat: new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.38, emissive: '#071405' }),
    vineMat: new THREE.MeshStandardMaterial({ color: LOOK.color('pothos-vine', '#3f6a26'), roughness: 0.6, emissive: '#0a1a06' }),
    potMat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }),
    dirtMat: new THREE.MeshStandardMaterial({ color: '#241509', roughness: 1 }),
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
  rebuild() {
    const t = new THREE.TubeGeometry(this.curve, this.segs, this.r, 7), g = this.mesh.geometry;
    g.attributes.position.array.set(t.attributes.position.array); g.attributes.normal.array.set(t.attributes.normal.array);
    g.attributes.normal.needsUpdate = true; t.dispose();
    this.shape();
  }
}

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

function layVine(world, at, box, a, len, R, k) {
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
  for (let s = 1; s <= 14; s++) {
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
  const v = new Vine(pts, VINE_R, parts().vineMat, VINE_TAPER);
  v.drapeFrom = drapeFrom; v.angle = a;
  for (let j = 0; j < 11; j++) v.leaves.push({ t: 0.2 + 0.8 * (j + R() * 0.6) / 11, side: j % 2 ? 1 : -1, size: 0.07 * (0.7 + R() * 0.5), tilt: R() });
  return v;
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
      const v = layVine(world, at, box, a, len, R, k);
      vines.push(v);
      root.add(v.mesh);
    }
  }
  // every leaf (the mound's and the vines') as one instance of one mesh: one draw
  const count = mound.length + vines.reduce((n, v) => n + v.leaves.length, 0);
  const leaves = new THREE.InstancedMesh(P.leaf, P.leafMat, count), tint = new THREE.Color();
  for (let i = 0; i < count; i++) leaves.setColorAt(i, tint.setRGB(0.82 + R() * 0.12, 0.88 + R() * 0.12, 0.8 + R() * 0.1));   // a slight shade per leaf
  root.add(leaves);
  return { root, heart, leaves, mound, vines, heartAt: heart.position.clone(), close: 0, blockers: new Float32Array(count * 4 + vines.reduce((n, v) => n + v.pts.length, 0) * 4), nBlock: 0 };
}

// Lay every leaf (the mound's, then each vine's along it), and note what blocks bubbles: a ball
// round each leaf and along each vine (in the plant's frame), none over the heart's hollow
const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _c = new THREE.Vector3(), _w = new THREE.Vector3(), _v = new THREE.Vector3();
function placeLeaves(M) {
  const B = M.blockers, keep = (c, r) => {
    if (c.distanceTo(M.heartAt) < r + HEART * 1.4) return;     // the hollow stays open: the way to the heart
    B[M.nBlock * 4] = c.x; B[M.nBlock * 4 + 1] = c.y; B[M.nBlock * 4 + 2] = c.z; B[M.nBlock * 4 + 3] = r; M.nBlock++;
  };
  M.nBlock = 0;
  let i = 0;
  const leaf = (m, size) => { M.leaves.setMatrixAt(i++, m); keep(_c.set(0, 0.5, 0).applyMatrix4(m), size * 0.42); };
  // (M.close: how far the lids have closed over the heart, 0 open .. 1 shut)
  for (const L of M.mound) {
    if (L.shut && M.close) leaf(leafMatrix(_v.copy(L.pos).lerp(L.shutAt, M.close), _w.copy(L.out).lerp(L.shut, M.close), L.size, L.tilt), L.size);
    else leaf(leafMatrix(L.pos, L.out, L.size, L.tilt), L.size);
  }
  for (const v of M.vines) {
    for (const L of v.leaves) {
      v.curve.getPointAt(L.t, _p); v.curve.getTangentAt(L.t, _q);
      _x.crossVectors(_q, UP).normalize().multiplyScalar(L.side);
      const out = _y.copy(_x).addScaledVector(_q, 0.5).addScaledVector(UP, 0.3 + L.tilt * 0.3);
      leaf(leafMatrix(_p, out.clone(), L.size, L.tilt), L.size);
    }
    for (let k = 0; k < v.pts.length; k++) keep(v.pts[k], v.radiusAt(k / (v.pts.length - 1)));
  }
  M.leaves.instanceMatrix.needsUpdate = true;
  M.leaves.computeBoundingSphere();
  // one ball round all of it, to skip the rest at once
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

export class Pothos {
  // arena: the stage's boss block (stage3.js): `pot` is where the pot stands, on the pillows
  constructor(scene, enemies, fx, arena, world) {
    Object.assign(this, { scene, enemies, fx, arena, world });
    this.kind = 'pothos';
    this.r = HEART * SCALE * 1.1;        // what bubbles must touch: the heart
    this.def = CONTENT.bosses.pothos;    // its numbers (content/bosses.kdl), read fresh so the Tuner's edits land mid-fight
    this.maxHp = this.hp = this.def.hp;
    this.dead = false;
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
    this.model = buildPothos(world, V(...arena.pot), arena);
    placeLeaves(this.model);
    // the fight view (camera.js, run.js): back and up from the jelly's, to keep the heart in frame
    this.camera = { distance: LOOK.num('pothos-camera-distance', 0.85), pitch: LOOK.num('pothos-camera-tilt', 0.785), ahead: LOOK.num('pothos-camera-ahead', 0.65) };
    this.holder = new THREE.Group();
    this.holder.position.set(...arena.pot);
    this.holder.add(this.model.root);
    this.model.root.scale.setScalar(0.001);
    scene.add(this.holder);
    this._heart = new THREE.Vector3(); this._drop = new THREE.Vector3(); this._knockDir = new THREE.Vector3(); this._push = new THREE.Vector3();
    this.knock = 0;
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
    if (this.dead || this.rise < 1) return;
    if (this.shielded) { this.fx.number(this.center().setY(this.center().y + 0.05), 'SHIELDED', '#cfe6ff', 12); return; }
    this.hp -= amount;
    this.hitPop = 1;
    this.fx.number(this.center().setY(this.center().y + 0.06), Math.round(amount), color, 16);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  update(dt, player) {
    const out = this.tick(dt, player);
    if (out.hit) bus.emit('damage_taken', { targetId: PLAYER, amount: out.hit, source: 'boss' });
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
      return out;
    }
    // it grows up out of the pillows
    if (this.rise < 1) {
      if (this.rise === 0) sfx.clogRise?.();
      this.rise = Math.min(1, this.rise + dt * 0.55);
      M.root.scale.setScalar(s * Math.max(0.001, smooth(0, 1, this.rise)));
    } else M.root.scale.setScalar(s);
    // the heart beats and glows in its hollow (kept below white so its colour reads)
    const beat = Math.max(0, Math.sin(this.t * 4)) ** 4;
    this.hitPop = Math.max(0, (this.hitPop || 0) - dt * 5);
    M.heart.scale.setScalar(HEART * (1 + beat * 0.05 + this.hitPop * 0.12));
    // shielded, the lids fold shut over the heart and it dims behind them; they open again after
    const shut = this.shielded ? 1 : 0;
    if (M.close !== shut) {
      M.close += (shut - M.close) * Math.min(1, dt * 6);
      if (Math.abs(shut - M.close) < 0.01) M.close = shut;
      placeLeaves(M);                    // only while they move
    }
    M.heart.material.emissiveIntensity = (0.3 + beat * 0.15) * (1 - M.close * 0.75);
    this.fx.glow.hold(this.center(this._heart), this.glowColor, 0.14 * (0.8 + beat * 0.3) * (1 - M.close * 0.6), 0.6 * (1 - M.close * 0.7));
    M.root.rotation.z = this.state === 'cutting' ? Math.sin(this.t * 40) * 0.02 : 0;   // shivering, flinging Cuttings
    // its attacks, in turn
    const SW = this.def.skills.swarm;
    if (this.rise >= 1 && SW && !this.swarmed && this.state === 'idle' && this.hp < this.maxHp * SW.at) this.begin('swarm');
    if (this.state === 'swarm') {
      // shielded till its dragonflies are dead, or for `shield` s at most
      this.guards = this.guards.filter((e) => !e.dead);
      if ((this.guardT -= dt) <= 0) this.guards = [];
      if (!this.shielded) { this.state = 'idle'; this.stateT = SW.rest; }
    } else if (this.rise >= 1) {
      this.stateT -= dt;
      if (this.stateT <= 0) {
        if (this.state === 'idle') { const order = this.angry ? ATTACKS.angry : ATTACKS.calm; this.begin(order[this.next++ % order.length]); }
        else { const SK = this.def.skills[this.state]; this.state = 'idle'; this.stateT = this.angry ? SK.angryRest : SK.rest; }
      }
    }
    // bumping into the pot hurts and knocks you back off it
    const P = player.position, h = this.holder.position, dx = P.x - h.x, dz = P.z - h.z, d = Math.hypot(dx, dz);
    this.knock = Math.max(0, this.knock - dt);
    if (this.knock <= 0 && d < POT_R * SCALE + player.cfg.radius && P.y < h.y + POT_H * SCALE) {
      out.hit = this.def.contact;
      this.knock = 0.3;
      if (d) this._knockDir.set(dx / d, 0, dz / d); else this._knockDir.set(0, 0, -1);
    }
    if (this.knock > 0) out.push = this._push.copy(this._knockDir).multiplyScalar(0.6);
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
    this.guardT = this.stateT = shield;
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
    const P = this.player.position;
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, d = k ? spread * (0.5 + 0.5 * Math.random()) : 0;
      const at = this._drop.set(P.x + Math.sin(a) * d, P.y + 0.1, P.z + Math.cos(a) * d);
      at.y = this.enemies.floorBelow(at, P.y);
      this.enemies.spawn('root', at);
    }
  }

  dispose() {
    this.scene.remove(this.holder);
    this.model.leaves.dispose();         // its instance buffers; the shared geometry and materials stay
    for (const v of this.model.vines) v.mesh.geometry.dispose();
  }
}
