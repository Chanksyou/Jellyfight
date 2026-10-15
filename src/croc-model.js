// The plush alligator on the pillows (act 3's Elite, elites.js kind 'croc'), after the owner's photo:
// soft green minky with an embossed scaly back, a row of soft triangular felt ridges down the spine
// and the tail, a tan belly and jaw underside, a long snout with an open mouth (pink inside, white
// felt zigzag teeth), raised eyes with yellow rings and black pupils, four stubby legs with toes, a
// long tapering tail. Built in meters facing +z, belly on y = 0; about 52 cm long at scale 1 (the
// elite shows it at KINDS scale, about 33 cm). Every part shares ONE vertex-coloured plush material
// and is merged into a few meshes (the body with its legs, the upper jaw, the eyes, the lower jaw,
// three tail pieces): seven draw calls. The elite opens the jaws (upper / lower, pivots at the
// hinge), closes the eyes while it sleeps (eyes.scale.y), and curls the tail (tail[i] pivots).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const GREEN = 0x4f8c14, GREEN_DARK = 0x3d6e0f, TAN = 0xc9b07a, PINK = 0xf2a99a, WHITE = 0xfbfaf4, YELLOW = 0xe2d23a, BLACK = 0x15130f;
const _c = new THREE.Color(), _g = new THREE.Color(), _t = new THREE.Color();
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

// a part ready to merge: non-indexed, with a colour per vertex from `paint(x, y, z, out)` (its final
// position in the piece it belongs to); `flat` parts (felt teeth, eyes) get no scale relief (uv 0)
function part(geo, paint, flat = false) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const p = geo.attributes.position, n = p.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { paint(p.getX(i), p.getY(i), p.getZ(i), _c); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (flat) geo.attributes.uv.array.fill(0);
  return geo;
}
const solid = (hex) => (x, y, z, out) => out.setHex(hex);
// green on top, tan underneath: the belly line at `belly` (m), soft over `soft`
const plush = (belly, soft = 0.006) => (x, y, z, out) => {
  _g.setHex(GREEN).lerp(_t.setHex(GREEN_DARK), 0.25 + 0.25 * Math.sin(x * 210 + z * 170) * Math.sin(z * 90));   // the minky's light and dark nap
  return out.setHex(TAN).lerp(_g, smooth(belly - soft, belly + soft, y));
};
const ellipsoid = (rx, ry, rz, x, y, z, seg = 20) => new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)).scale(rx, ry, rz).translate(x, y, z);
// an ellipsoid lying along z (its poles at the ends), so the scale plates run in bands round it
const lying = (rx, ry, rz, x, y, z, seg = 22) => new THREE.SphereGeometry(1, seg, Math.round(seg * 0.8)).rotateX(Math.PI / 2).scale(rx, ry, rz).translate(x, y, z);
// a soft felt ridge: a flattened cone standing on the back, pointing up (or `tip` down for teeth)
const cone = (r, h, x, y, z, { thin = 0.45, down = false, tilt = 0 } = {}) => {
  const g = new THREE.ConeGeometry(r, h, 8).translate(0, h / 2, 0);
  if (down) g.rotateX(Math.PI);
  g.scale(thin, 1, 1).rotateZ(tilt);
  return g.translate(x, y, z);
};

// the embossed scales: raised plates in rows, softly rounded, as a bump map
function scaleBump() {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#404040'; g.fillRect(0, 0, S, S);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rows = 5, cols = 6;                                        // plates of uneven sizes, staggered row to row
  for (let r = 0; r < rows; r++) for (let k = -1; k < cols + 1; k++) {
    const w = S / cols * (0.85 + rnd() * 0.3), h = S / rows, x = (k + (r % 2) * 0.5) * (S / cols) + (rnd() - 0.5) * 8, y = r * h + (rnd() - 0.5) * 6;
    const grd = g.createRadialGradient(x + w / 2, y + h * 0.4, 2, x + w / 2, y + h / 2, w * 0.65);
    grd.addColorStop(0, '#e8e8e8'); grd.addColorStop(0.7, '#b0b0b0'); grd.addColorStop(1, '#585858');
    g.fillStyle = grd;
    for (const dy of [-S, 0, S]) { g.beginPath(); g.roundRect(x + 4, y + 4 + dy, w - 8, h - 8, 12); g.fill(); }   // (wrapping top to bottom)
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// the body's back top (y) at z: for laying the ridges along it
const BODY = { y: 0.032, rx: 0.045, ry: 0.032, rz: 0.1 };
const backY = (z) => BODY.y + BODY.ry * Math.sqrt(Math.max(0, 1 - (z / BODY.rz) ** 2));
// the tail: three pieces, each pivoting at its root (m): root z, half width, half height, length
const TAIL = [{ z: -0.078, w: 0.032, h: 0.025, len: 0.09 }, { w: 0.022, h: 0.018, len: 0.08 }, { w: 0.013, h: 0.011, len: 0.075 }];
const HINGE = new THREE.Vector3(0, 0.036, 0.098);   // where the jaws meet: both pivot here

export function buildCroc() {
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.92, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xb8e08a), bumpMap: scaleBump(), bumpScale: 0.7 });
  mat.bumpMap.repeat.set(2, 1.6);
  const g = new THREE.Group();
  const mesh = (parts, parent = g) => { const m = new THREE.Mesh(mergeGeometries(parts), mat); parent.add(m); return m; };

  // --- the body, shoulders and four stubby legs, one mesh
  const body = [part(lying(BODY.rx, BODY.ry, BODY.rz, 0, BODY.y, 0), plush(0.022)),
    part(ellipsoid(0.038, 0.03, 0.04, 0, 0.037, 0.088), plush(0.02), true)];       // the neck into the head
  for (const s of [-1, 1]) {
    for (const [z, k] of [[0.062, 1], [-0.052, 1.1]]) {
      const up = ellipsoid(0.014 * k, 0.022 * k, 0.017 * k, 0, 0, 0).rotateZ(s * 0.75).translate(s * 0.046, 0.017, z);   // the leg, splayed out
      body.push(part(up, plush(0.008), true));
      const fx = s * 0.062, fz = z + 0.006;
      body.push(part(ellipsoid(0.016 * k, 0.008, 0.02 * k, fx, 0.007, fz), plush(0.004, 0.003), true));   // the foot, flat on the bed
      for (const t of [-1, 0, 1]) body.push(part(ellipsoid(0.0055, 0.0045, 0.006, fx + t * 0.008 * k, 0.005, fz + 0.016 * k - Math.abs(t) * 0.003), solid(GREEN), true));   // its toes
    }
  }
  // the ridge row down the back: soft felt triangles, biggest over the hips
  for (let z = 0.07; z > -0.095; z -= 0.017) body.push(part(cone(0.0075, 0.009 + 0.005 * (1 - Math.abs(z + 0.02) / 0.09), 0, backY(z) - 0.002, z), solid(GREEN_DARK), true));
  // and the softer rows of bumps either side of it
  for (const s of [-1, 1]) for (let z = 0.06; z > -0.085; z -= 0.022) body.push(part(cone(0.005, 0.005, s * 0.02, backY(z) - 0.007, z, { tilt: -s * 0.5 }), solid(GREEN_DARK), true));
  const bodyMesh = mesh(body);

  // --- the head: the upper jaw (cranium, snout, palate, nostrils, teeth) pivoting at the hinge
  const upper = new THREE.Group();
  upper.position.copy(HINGE);
  g.add(upper);
  const top = [part(ellipsoid(0.034, 0.025, 0.036, 0, 0.01, 0.014), plush(-0.004), true),
    part(lying(0.028, 0.017, 0.068, 0, 0.005, 0.068), plush(-0.006, 0.003), true),
    part(lying(0.022, 0.005, 0.06, 0, -0.006, 0.064), solid(PINK), true)];       // the pink inside
  for (const s of [-1, 1]) {
    top.push(part(ellipsoid(0.013, 0.011, 0.013, s * 0.019, 0.026, 0.006), plush(0), true));    // the eye bumps
    top.push(part(ellipsoid(0.0045, 0.003, 0.005, s * 0.009, 0.015, 0.117), solid(GREEN), true));   // the nostril bumps
  }
  // white felt zigzag teeth round the rim of the upper jaw, pointing down
  const teeth = (y, down, inset) => {
    const out = [];
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI * 0.94 + (i / 25) * Math.PI * 1.88;          // round the snout from one hinge to the other
      const zc = 0.064, x = Math.sin(a) * (0.024 - inset), z = zc - Math.cos(a) * (0.064 - inset);
      if (z < 0.012) continue;
      out.push(part(cone(0.0045, 0.008, x, y, z, { thin: 0.3, down }), solid(WHITE), true));
    }
    return out;
  };
  top.push(...teeth(-0.006, true, 0.002));
  mesh(top, upper);
  // the eyes: yellow rings, black pupils and a white glint, one mesh round their own middle (scale.y closes them)
  const eyes = new THREE.Mesh(mergeGeometries([-1, 1].flatMap((s) => [
    part(ellipsoid(0.0082, 0.0082, 0.0035, 0, 0, 0).rotateY(s * 1.1).translate(s * 0.026, 0, 0.012), solid(YELLOW), true),
    part(ellipsoid(0.0048, 0.0052, 0.0022, 0, 0, 0).rotateY(s * 1.1).translate(s * 0.0285, 0, 0.0134), solid(BLACK), true),
    part(ellipsoid(0.0014, 0.0014, 0.001, 0, 0, 0).rotateY(s * 1.1).translate(s * 0.0293, 0.0018, 0.0146), solid(WHITE), true),
  ])), mat);
  eyes.position.set(0, 0.028, 0);
  upper.add(eyes);

  // --- the lower jaw: tan underneath, green sides, a pink tongue, teeth pointing up
  const lower = new THREE.Group();
  lower.position.copy(HINGE);
  g.add(lower);
  const jaw = [part(lying(0.027, 0.014, 0.064, 0, -0.013, 0.06), plush(-0.008, 0.004), true),
    part(ellipsoid(0.03, 0.017, 0.03, 0, -0.012, 0.008), plush(-0.012), true),         // the throat
    part(lying(0.019, 0.0045, 0.05, 0, -0.004, 0.058), solid(PINK), true)];
  jaw.push(...teeth(-0.003, false, 0.004));
  mesh(jaw, lower);

  // --- the tail: three pieces, each pivoting at its root, tapering to a point, its ridges on top
  const tail = [];
  let parent = g, root = new THREE.Vector3(0, 0.027, TAIL[0].z);
  for (let i = 0; i < TAIL.length; i++) {
    const T = TAIL[i], pv = new THREE.Group();
    pv.position.copy(root);
    parent.add(pv);
    const parts = [part(lying(T.w, T.h, T.len * 0.62, 0, 0, -T.len * 0.45), plush(-T.h * 0.45, 0.004))];
    if (i === TAIL.length - 1) parts.push(part(new THREE.ConeGeometry(T.w * 0.75, T.len * 0.5, 12).rotateX(-Math.PI / 2).scale(1, T.h / T.w, 1).translate(0, -0.001, -T.len * 0.95), plush(-T.h * 0.4, 0.003)));
    const n = Math.round(T.len / 0.016);
    for (let k = 0; k < n; k++) {
      const z = -T.len * (0.1 + 0.85 * k / n), along = Math.sqrt(Math.max(0, 1 - ((z + T.len * 0.45) / (T.len * 0.62)) ** 2));
      parts.push(part(cone(0.006 * (1 - i * 0.2), 0.008 * (1 - i * 0.22), 0, T.h * along - 0.002, z), solid(GREEN_DARK), true));
    }
    mesh(parts, pv);
    tail.push(pv);
    parent = pv;
    root = new THREE.Vector3(0, 0.001, -T.len * 0.92);
  }
  const tip = new THREE.Object3D();
  tip.position.set(0, 0, -TAIL[2].len * 1.15);
  tail[2].add(tip);
  const mouth = new THREE.Object3D();                 // where its frost balls come from
  mouth.position.set(0, -0.002, 0.07);
  upper.add(mouth);
  g.updateMatrixWorld(true);
  const tailReach = -tip.getWorldPosition(new THREE.Vector3()).z;   // how far behind its middle the tail lands (m, at scale 1)
  return { group: g, body: bodyMesh, upper, lower, eyes, tail, tip, mouth, mat, tailReach };
}
