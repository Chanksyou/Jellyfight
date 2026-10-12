// PROTOTYPE (throwaway, lives on the prototype/pothos-look branch, never main): three looks for act
// 3's Boss, the Pothos, standing in its pot on the pillows at the head of the bed, its vines
// trailing over the bed. Open index.html?story=prototype/pothos-look&variant=A|B|C; the bar at the
// bottom (or ← →) flips the look, its second button flips between the play camera and a showcase orbit.
//   A  Tangle cage:  a cage of thick braided vines round the glowing heart, rising out of a mossy
//                    cracked pot, big variegated leaves on tendrils reaching out (the reference image)
//   B  Cascade:      a real pothos gone huge: a mound of leaves spilling over the pot, the heart in a
//                    hollow at the front, long leafy vines draping over the pillows across the bed
//   C  Rising titan: a twisted trunk climbing out of a split pot like a neck, a crown of leaves
//                    round the heart, aerial roots dangling, roots spilling out of the split
// Every 4 s it lashes a vine across the bed, then its vines part for 1.5 s and the heart flares:
// the opening to shoot at (the interview's Q16).
import * as THREE from 'three';

const VARIANTS = { A: 'Tangle cage', B: 'Cascade', C: 'Rising titan' };
const CYCLE = 4;
const SCALE = 0.8;                                 // how big it grew: a big boss, still a houseplant in a real bedroom (the owner: 1.5 was too big)
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ the pieces
// A pothos leaf: heart-shaped, cupped, its tip drooping, variegated cream-gold streaks fanning
// out from the midrib over deep green. In its own frame the petiole is at the origin, the leaf
// runs along +y to its tip (1 m: scaled per leaf) and faces +z.
function leafGeometry() {
  const g = new THREE.PlaneGeometry(1, 1, 10, 14), p = g.attributes.position, col = [];
  const deep = new THREE.Color('#123814'), green = new THREE.Color('#1f5e1f'), cream = new THREE.Color('#f0e27a'), gold = new THREE.Color('#d9c43a'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), t = p.getY(i) + 0.5;                      // u -0.5..0.5 across, t 0 base .. 1 tip
    const w = 0.62 * Math.pow(Math.sin(Math.PI * Math.min(1, (t + 0.14) / 1.14)), 0.8) * (1 - 0.12 * t);
    const x = u * 2 * w;
    let y = t - 0.16 * Math.abs(u * 2) * Math.pow(1 - t, 3);        // the two lobes either side of the petiole
    const z = -0.14 * t * t + 0.1 * (u * 2) * (u * 2) * w;          // tip droops, sides cup up
    p.setXYZ(i, x, y, z);
    const a = Math.atan2(x, t + 0.06);
    const streak = Math.sin(a * 15 + Math.sin(t * 9 + x * 7) * 1.4) * 0.5 + 0.5;
    const blotch = Math.sin(x * 23 + t * 17) * Math.sin(t * 29 - x * 11) * 0.5 + 0.5;
    const cream_k = smooth(0.62, 0.95, streak * 0.75 + blotch * 0.35) * (0.35 + 0.65 * t);
    c.copy(green).lerp(deep, Math.abs(u * 2) * 0.55).lerp(Math.abs(x) < 0.02 ? gold : cream, Math.abs(x) < 0.02 ? 0.55 : cream_k);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// The terracotta pot: tapered, a thick rim, moss creeping up from below and over the rim, dark
// cracks. gap: leave a wedge out of it (radians, facing -z) for a pot that's split open.
function potGeometry(h, rb, rt, gap = 0) {
  const prof = [];
  for (let k = 0; k <= 18; k++) { const y = (k / 18) * h * 0.86; prof.push(new THREE.Vector2(rb + (rt - rb) * (y / (h * 0.86)), y)); }
  prof.push(new THREE.Vector2(rt * 1.08, h * 0.87), new THREE.Vector2(rt * 1.1, h), new THREE.Vector2(rt * 0.96, h), new THREE.Vector2(rt * 0.94, h * 0.9));
  const g = new THREE.LatheGeometry(prof, 64, gap ? -Math.PI / 2 + gap / 2 : 0, Math.PI * 2 - gap);
  const p = g.attributes.position, col = [], clay = new THREE.Color('#b8653c'), dark = new THREE.Color('#7e3f22'), moss = new THREE.Color('#58772c'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), yn = y / h;
    const mossy = smooth(0.15, 0.6, Math.sin(a * 3 + 1.3) * 0.4 + Math.sin(a * 7 + y * 30) * 0.25 + (1 - yn) * 0.55 + (yn > 0.86 ? 0.5 : 0) - 0.15);
    const crack = Math.abs(((a * 1.6 + yn * 2.2 + Math.sin(yn * 35) * 0.05) % 1 + 1) % 1 - 0.5) < 0.012 && yn < 0.85 ? 1 : 0;
    c.copy(clay).lerp(dark, 0.25 + 0.25 * Math.sin(a * 11 + yn * 6) ** 2).lerp(moss, mossy * 0.85).lerp(new THREE.Color('#2a1608'), crack * 0.9);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// The heart: a lumpy, glowing seed in green and gold, veined
function heartGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 4), p = g.attributes.position, col = [], gold = new THREE.Color('#ffd34a'), green = new THREE.Color('#7dff5a'), c = new THREE.Color(), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 5 + v.y * 3) * Math.sin(v.y * 6 - v.z * 4) * Math.sin(v.z * 5 + v.x * 2);
    v.multiplyScalar(1 + n * 0.14).multiply(V(0.85, 1.15, 0.8));
    p.setXYZ(i, v.x, v.y, v.z);
    const vein = Math.abs(Math.sin(Math.atan2(v.x, v.z) * 6 + v.y * 4)) < 0.18 ? 1 : 0;
    c.copy(gold).lerp(green, 0.5 + n * 0.8).lerp(new THREE.Color('#fffbe0'), vein * 0.7);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// A vine: a tapering tube along a curve through its points, rebuilt in place when it moves.
// leaves: [{ t (0..1 along it), side (-1|1), size, tilt }], placed on the shared leaf instances.
class Vine {
  constructor(pts, r, mat, { segs = 40, taper = 0.75, dynamic = false } = {}) {
    this.base = pts.map((p) => p.clone()); this.pts = pts.map((p) => p.clone());
    this.r = r; this.segs = segs; this.taper = taper; this.dynamic = dynamic; this.leaves = [];
    this.curve = new THREE.CatmullRomCurve3(this.pts, false, 'centripetal');
    this.mesh = new THREE.Mesh(new THREE.TubeGeometry(this.curve, segs, r, 7), mat);
    this.mesh.castShadow = false;
    this.shape();
  }
  // taper the tube toward its tip (TubeGeometry is one radius all along)
  shape() {
    const g = this.mesh.geometry, p = g.attributes.position, ring = 8, c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i <= this.segs; i++) {
      this.curve.getPointAt(i / this.segs, c);
      const k = 1 - this.taper * (i / this.segs);
      for (let j = 0; j < ring; j++) { const n = i * ring + j; v.fromBufferAttribute(p, n).sub(c).multiplyScalar(k).add(c); p.setXYZ(n, v.x, v.y, v.z); }
    }
    p.needsUpdate = true; g.computeBoundingSphere();
  }
  rebuild() {
    this.curve.points = this.pts;
    const t = new THREE.TubeGeometry(this.curve, this.segs, this.r, 7), g = this.mesh.geometry;
    g.attributes.position.array.set(t.attributes.position.array); g.attributes.normal.array.set(t.attributes.normal.array);
    g.attributes.normal.needsUpdate = true; t.dispose();
    this.shape();
  }
}

// ------------------------------------------------------------------ the three looks
// at: the pot's base on the pillows; front: toward the foot of the bed (-z)
function build(variant, at, seed = 7) {
  const R = rng(seed), group = new THREE.Group(), vines = [], leaves = [], roots = [];
  const vineMat = new THREE.MeshStandardMaterial({ color: '#3f6a26', roughness: 0.6, emissive: '#0a1a06' });
  const darkVine = new THREE.MeshStandardMaterial({ color: '#2c4a1a', roughness: 0.65, emissive: '#061204' });
  const rootMat = new THREE.MeshStandardMaterial({ color: '#7a5434', roughness: 0.8, emissive: '#140a03' });
  const potH = variant === 'C' ? 0.26 : 0.24, potR = 0.16, soil = at.y + potH * 0.9;
  const pot = new THREE.Mesh(potGeometry(potH, 0.11, potR, variant === 'C' ? 0.9 : 0), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
  pot.position.copy(at); group.add(pot);
  const dirt = new THREE.Mesh(new THREE.CircleGeometry(potR * 0.93, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#241509', roughness: 1 }));
  dirt.position.set(at.x, soil, at.z); group.add(dirt);
  const heartY = { A: soil + 0.26, B: soil + 0.12, C: soil + 0.42 }[variant];
  const heartPos = V(at.x, heartY, at.z - (variant === 'B' ? 0.13 : variant === 'C' ? 0.04 : 0));
  const heart = new THREE.Mesh(heartGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: '#2f8a14', emissiveIntensity: 0.35 }));
  heart.scale.setScalar(variant === 'B' ? 0.055 : 0.07); heart.position.copy(heartPos); group.add(heart);
  const addVine = (pts, r, mat, opts) => { const v = new Vine(pts, r, mat, opts); vines.push(v); group.add(v.mesh); return v; };
  const leafOn = (v, n, size, from = 0.15) => { for (let k = 0; k < n; k++) v.leaves.push({ t: from + (1 - from) * (k + R() * 0.6) / n, side: k % 2 ? 1 : -1, size: size * (0.7 + R() * 0.5), tilt: R() }); };

  // trailing vines over the bed (every look has them; the first is the one that lashes)
  const trail = (count, len0, leafN, leafS) => {
    for (let k = 0; k < count; k++) {
      const a = -Math.PI / 2 + (k - (count - 1) / 2) * 0.42 + (R() - 0.5) * 0.15;   // fanned toward the foot of the bed
      const len = len0 * (0.75 + R() * 0.5), pts = [];
      // out of the soil, up over the pot's lip, down the outside of its wall, onto the bed (never through the pot)
      const ring = (r, y) => V(at.x + Math.cos(a) * r, y, at.z + Math.sin(a) * r);
      const wall = (f) => 0.11 + (potR - 0.11) * (f / 0.86) + 0.013;   // the pot's outside at height f (of its height), plus the vine's thickness
      pts.push(ring(potR * 0.5, soil - 0.01), ring(potR * 0.9, soil + 0.05), ring(potR * 1.14, soil + 0.012), ring(potR * 1.13, at.y + potH * 0.84), ring(wall(0.62), at.y + potH * 0.62), ring(wall(0.35), at.y + potH * 0.35), ring(wall(0.1), at.y + potH * 0.1));
      for (let s = 1; s <= 14; s++) {
        const d = 0.14 + (s / 14) * len, wob = Math.sin(s * 0.75 + k) * 0.08 * (s / 14);
        pts.push(V(at.x + Math.cos(a + wob) * d + Math.cos(a + Math.PI / 2) * wob * 0.6, at.y + 0.012, at.z + Math.sin(a + wob) * d));
      }
      const v = addVine(pts, 0.011, vineMat, { dynamic: true, taper: 0.7, segs: 72 });
      v.drapeFrom = 6;   // from here on it lies on whatever is under it (drape)
      v.trail = true; v.angle = a;
      leafOn(v, leafN, leafS, 0.2);
    }
  };

  if (variant === 'A') {
    // the cage: thick vines spiralling up from the soil round the heart, closing over it, their
    // tips curling out into tendrils with big leaves
    for (let k = 0; k < 14; k++) {
      const a0 = (k / 14) * Math.PI * 2, tw = (R() - 0.5) * 0.8, pts = [], r0 = potR * 0.7;
      for (let s = 0; s <= 8; s++) {
        const f = s / 8, a = a0 + tw * f + f * 1.2;
        const r = r0 + Math.sin(f * Math.PI) * 0.06 - f * f * 0.09 + (s === 8 ? 0.12 : 0);
        pts.push(V(at.x + Math.cos(a) * r, soil + f * 0.48 + (s === 8 ? -0.05 : 0), at.z + Math.sin(a) * r));
      }
      const v = addVine(pts, 0.012 + R() * 0.006, k % 3 ? vineMat : darkVine, { dynamic: true, taper: 0.6 });
      v.cage = true;
      leafOn(v, 3, 0.07, 0.55);
    }
    // tendrils reaching out sideways and up, like arms
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + 0.3, pts = [];
      for (let s = 0; s <= 6; s++) { const f = s / 6; pts.push(V(at.x + Math.cos(a) * (0.1 + f * 0.42), soil + 0.2 + Math.sin(f * Math.PI) * 0.22 - f * 0.1, at.z + Math.sin(a) * (0.1 + f * 0.42) + Math.sin(f * 6 + k) * 0.03)); }
      const v = addVine(pts, 0.01, vineMat, { dynamic: true });
      leafOn(v, 5, 0.12, 0.3);
    }
    trail(6, 1.1, 7, 0.08);
  } else if (variant === 'B') {
    // a mound of big leaves over the pot, a hollow at the front where the heart sits
    for (let k = 0; k < 140; k++) {
      const u = R(), w = R() * Math.PI * 2, el = Math.acos(1 - u * 0.95);       // over the upper sphere
      const dir = V(Math.sin(el) * Math.cos(w), Math.cos(el), Math.sin(el) * Math.sin(w));
      const front = dir.z < -0.55 && dir.y < 0.75 && Math.abs(dir.x) < 0.5;     // the hollow
      if (front) continue;
      const base = V(at.x, soil + 0.06, at.z).addScaledVector(dir, 0.1 + R() * 0.12);
      leaves.push({ pos: base, out: dir.clone().setY(dir.y * 0.6 + 0.2).normalize(), size: 0.09 + R() * 0.06, tilt: R(), frame: dir.z < -0.2 });
    }
    trail(9, 1.35, 11, 0.07);
  } else {
    // the trunk: four thick vines braided upward like a neck
    for (let k = 0; k < 4; k++) {
      const pts = [];
      for (let s = 0; s <= 8; s++) { const f = s / 8, a = k * Math.PI / 2 + f * 5; pts.push(V(at.x + Math.cos(a) * 0.035 * (1 - f * 0.3), soil - 0.02 + f * 0.4, at.z - f * 0.04 + Math.sin(a) * 0.035 * (1 - f * 0.3))); }
      const v = addVine(pts, 0.022, k % 2 ? vineMat : darkVine, { dynamic: false, taper: 0.35 });
      v.trunk = true;
    }
    // the crown: big leaves radiating round the heart, facing the bed
    for (let k = 0; k < 34; k++) {
      const a = (k / 34) * Math.PI * 2, ring = k % 2 ? 0.07 : 0.05;
      const out = V(Math.cos(a), Math.sin(a) * 0.9, -0.35).normalize();
      leaves.push({ pos: heartPos.clone().add(V(Math.cos(a) * ring, Math.sin(a) * ring, 0.02)), out, size: 0.11 + R() * 0.05, tilt: R(), crown: true });
    }
    // aerial roots dangling from the crown like tentacles
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2, top = heartPos.clone().add(V(Math.cos(a) * 0.1, -0.02, Math.sin(a) * 0.08)), pts = [];
      for (let s = 0; s <= 5; s++) pts.push(top.clone().add(V(Math.cos(a) * s * 0.015, -s * 0.07, Math.sin(a) * s * 0.012)));
      const v = addVine(pts, 0.004, rootMat, { dynamic: true, taper: 0.8, segs: 20 });
      v.aerial = true; v.phase = R() * 6;
    }
    // roots spilling out of the split in the pot onto the bed
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.13, pts = [];
      for (let s = 0; s <= 5; s++) { const f = s / 5; pts.push(V(at.x + Math.cos(a) * (0.05 + f * 0.3), at.y + 0.1 * (1 - f) + 0.008, at.z + Math.sin(a) * (0.05 + f * 0.3) + Math.sin(f * 7 + k) * 0.02)); }
      addVine(pts, 0.008, rootMat, { taper: 0.85 });
    }
    trail(4, 1.0, 6, 0.08);
  }

  // every leaf as one instance of one mesh
  const count = leaves.length + vines.reduce((n, v) => n + v.leaves.length, 0);
  const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.38, emissive: '#071405' });
  const inst = new THREE.InstancedMesh(leafGeometry(), leafMat, count);
  inst.frustumCulled = false;
  const tint = new THREE.Color();
  for (let i = 0; i < count; i++) inst.setColorAt(i, tint.setRGB(0.82 + R() * 0.12, 0.88 + R() * 0.12, 0.8 + R() * 0.1));   // a slight shade per leaf: the leaf's own greens and gold show
  group.add(inst);
  return { group, vines, leaves, inst, heart, heartPos, soil, at, potR, variant };
}

// ------------------------------------------------------------------ moving it
const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Vector3(), _s = new THREE.Vector3(), UP = V(0, 1, 0);
// a leaf's matrix: petiole at `pos`, running toward `out`, roughly facing up, rolled by `tilt`
function leafMatrix(pos, out, size, tilt) {
  _y.copy(out).normalize();
  _z.copy(UP).addScaledVector(_y, -UP.dot(_y)).normalize();
  if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1);
  _z.applyAxisAngle(_y, (tilt - 0.5) * 0.9);
  _x.crossVectors(_y, _z).normalize();
  _m.makeBasis(_x, _y, _z).scale(_s.setScalar(size)).setPosition(pos);
  return _m;
}

function animate(P, time, fx) {
  const c = (time % CYCLE) / CYCLE * CYCLE;               // seconds into the cycle
  const wind = smooth(0, 0.8, c) * (1 - smooth(0.8, 1.0, c));
  const lash = c > 0.8 && c < 1.2 ? (c - 0.8) / 0.4 : c >= 1.2 ? 1 : 0;
  const open = smooth(1.15, 1.45, c) * (1 - smooth(2.4, 2.75, c));   // the vines part, ~1.5 s
  P.open = open;
  let i = 0;
  for (const v of P.vines) {
    if (v.dynamic) {
      for (let k = 0; k < v.pts.length; k++) {
        const b = v.base[k], f = k / (v.pts.length - 1), p = v.pts[k].copy(b);
        const sway = Math.sin(time * 1.3 + k * 0.6 + (v.angle || 0) * 3) * 0.008 * f;
        p.x += sway; p.z += Math.cos(time * 1.1 + k) * 0.006 * f;
        if (v.cage) {                                       // the cage parts round the heart
          _p.set(p.x - P.at.x, 0, p.z - P.at.z);
          p.x += _p.x * open * 0.55 * Math.sin(f * Math.PI); p.z += _p.z * open * 0.55 * Math.sin(f * Math.PI);
        }
        if (v.aerial) { p.x += Math.sin(time * 1.7 + v.phase + k) * 0.012 * f; p.z += Math.cos(time * 1.4 + v.phase) * 0.01 * f; }
        if (v === P.whip && k > 2) {                       // wind up: rear back off the bed; lash: sweep across it
          p.y += wind * 0.16 * Math.sin(f * Math.PI) + (lash > 0 && lash < 1 ? 0.05 * Math.sin(lash * Math.PI) : 0);
          const swing = (lash < 1 ? -0.6 + 1.2 * lash : 0.6 * (1 - smooth(1.2, 3.5, c))) * f, dx = p.x - P.at.x, dz = p.z - P.at.z;
          const cs = Math.cos(swing), sn = Math.sin(swing);
          p.x = P.at.x + dx * cs - dz * sn; p.z = P.at.z + dx * sn + dz * cs;
        }
      }
      v.rebuild();
    }
    for (const L of v.leaves) {
      v.curve.getPointAt(Math.min(1, L.t), _p); v.curve.getTangentAt(Math.min(1, L.t), _q);
      _x.crossVectors(_q, UP).normalize().multiplyScalar(L.side);
      _y.copy(_x).addScaledVector(_q, 0.5).addScaledVector(UP, 0.3 + L.tilt * 0.3);
      P.inst.setMatrixAt(i++, leafMatrix(_p, _y, L.size, L.tilt));
    }
  }
  for (const L of P.leaves) {
    _y.copy(L.out);
    _p.copy(L.pos);
    if (L.frame || L.crown) { _p.addScaledVector(_q.copy(L.out).setY(0).normalize(), open * (L.crown ? 0.04 : 0.06)); _y.addScaledVector(UP, -open * 0.4); }
    _y.x += Math.sin(time * 1.2 + L.tilt * 9) * 0.05;
    P.inst.setMatrixAt(i++, leafMatrix(_p, _y, L.size, L.tilt));
  }
  P.inst.instanceMatrix.needsUpdate = true;
  // the heart: a slow pulse, flaring while it's open
  const beat = 0.5 + 0.5 * Math.sin(time * 3.2);
  P.heart.material.emissiveIntensity = 0.25 + beat * 0.15 + open * 0.6;   // kept under white: the colour must still read
  P.heart.scale.setScalar((P.variant === 'B' ? 0.055 : 0.07) * (1 + beat * 0.04 + open * 0.12));
  P.heart.rotation.y = time * 0.3;
  fx.glow.hold(P.heartPos, P.glowColor, 0.14 + open * 0.2 + beat * 0.03, 0.3 + open * 0.45);
  if (lash >= 1 && !P.slammed) { P.slammed = true; const tip = P.group.localToWorld(P.whip.curve.getPointAt(0.85)); fx.impact(tip, P.glowColor, 0.03, 10); }
  if (c < 0.8) P.slammed = false;
}

// ------------------------------------------------------------------ the story's entry point
// Lay every trailing vine on the bed as it really is: each point sits just on the surface under it
// (the pillows by the pot are higher, the mattress dips toward its edges and foot). Points are in
// the plant's own frame (scaled by SCALE round the pot's base `at`), the ray in the world's.
const DOWN = V(0, -1, 0), _w = new THREE.Vector3();
function drape(P, world, at) {
  for (const v of P.vines) {
    if (v.drapeFrom == null) continue;
    for (let k = v.drapeFrom; k < v.base.length; k++) {
      const b = v.base[k];
      _w.copy(b).sub(at).multiplyScalar(SCALE).add(at);                 // where it is in the world
      const hit = world.castAll(_w.set(_w.x, at.y + 0.5, _w.z), DOWN, 1.2);
      if (!hit) continue;
      const y = hit.point.y + v.r * SCALE * (1 - v.taper * k / (v.base.length - 1)) * 0.9;   // resting on it, by its own thickness there
      b.y = at.y + (y - at.y) / SCALE;
    }
    v.pts.forEach((p, k) => p.copy(v.base[k]));
    v.rebuild();
  }
}

export async function start({ GAME, APT, scene, player, tpc, fx, tp, step, world }) {
  await GAME.loadRooms(['act3']);
  const find = (n) => APT.root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n));
  const box = new THREE.Box3().setFromObject(find('Left pillow')).union(new THREE.Box3().setFromObject(find('Right pillow')));
  const at = V((box.min.x + box.max.x) / 2, 0.795, (box.min.z + box.max.z) / 2 + 0.05);   // on the pillows, at the head of the bed
  const shelfPlant = find('Pothos planter');
  APT.root.traverse((o) => { if (o.name.startsWith('Pothos')) o.visible = false; });   // it came alive: the one on the shelf (pot and vines) is gone
  const offBed = ['Plush_crocodile', 'Yellow_plush', 'Red_plush'];   // off the bed: it's the arena (every part of each)
  APT.root.traverse((o) => { if (offBed.some((n) => o.name.startsWith(n))) o.visible = false; });
  const params = new URLSearchParams(location.search);
  let variant = VARIANTS[params.get('variant')] ? params.get('variant') : 'A', view = 'play', P = null;
  const glowColor = new THREE.Color('#5ee83a');
  const make = () => {
    if (P) { scene.remove(P.group); P.group.traverse((o) => { o.geometry?.dispose(); }); }
    P = build(variant, at);
    // a boss, not a houseplant: everything 1.5x bigger, grown from the pot's base
    P.group.scale.setScalar(SCALE); P.group.position.copy(at).multiplyScalar(1 - SCALE);
    P.heartPos.sub(at).multiplyScalar(SCALE).add(at);
    P.glowColor = glowColor;
    P.whip = P.vines.find((v) => v.trail);
    scene.add(P.group);
    drape(P, world, at);
  };
  make();
  const place = () => {
    // play: the game's own camera (tilted 60° down); showcase: low and back, to see the whole plant
    if (view === 'play') { tp(at.x, 0.82, at.z - 0.95, Math.PI); tpc.distance = 0.68; tpc.pitch = 1.05; }
    else { tp(at.x, 0.82, at.z - 0.5, Math.PI); tpc.distance = 0.9; tpc.pitch = 0.45; }
  };
  place();

  // the switcher: obviously not part of the game (prototype only)
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:40;display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:999px;background:#fff;color:#111;font:600 15px system-ui;box-shadow:0 4px 18px #000a;user-select:none;white-space:nowrap';
  bar.innerHTML = '<button data-d="-1">◀</button><span></span><button data-d="1">▶</button><button data-v="1">🎥</button>';
  bar.querySelectorAll('button').forEach((b) => { b.style.cssText = 'border:0;background:#111;color:#fff;border-radius:999px;width:40px;height:40px;font-size:16px;cursor:pointer'; });
  const label = bar.querySelector('span');
  const show = () => { label.textContent = `${variant} (${VARIANTS[variant]}) · ${view}`; params.set('variant', variant); history.replaceState(null, '', '?' + params); };
  const go = (d) => { const k = Object.keys(VARIANTS); variant = k[(k.indexOf(variant) + d + k.length) % k.length]; make(); show(); };
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.v) { view = view === 'play' ? 'showcase' : 'play'; place(); show(); } else go(+b.dataset.d);
  });
  addEventListener('keydown', (e) => { if (e.target.closest?.('input, textarea, [contenteditable]')) return; if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1); });
  document.body.appendChild(bar);
  show();

  // showcase: the camera orbits the plant itself, low, looking at its heart (after the game's own camera)
  const follow = tpc.update.bind(tpc), cam = tpc.camera;
  tpc.update = (...a) => {
    follow(...a);
    if (view !== 'showcase') return;
    const r = 0.75, h = P.heartPos.y + 0.03;
    cam.position.set(at.x + Math.sin(tpc.yaw) * r, h + 0.1, at.z + Math.cos(tpc.yaw) * r);
    cam.lookAt(at.x, h - 0.1, at.z);
  };
  let last = performance.now();
  const tick = () => {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (view === 'showcase') tpc.yaw += dt * 0.25;           // a slow orbit round the plant
    animate(P, now / 1000, fx);
    requestAnimationFrame(tick);
  };
  tick();
  return (window.__pothos = { at, get P() { return P; }, setVariant: (v) => { variant = v; make(); show(); }, setView: (v) => { view = v; place(); show(); }, animate: (t) => animate(P, t, fx) });
}
