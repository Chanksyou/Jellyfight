// Dendi, the apartment's cat: a rigged, skinned three.js model of Chandan's
// brown mackerel tabby — warm tawny agouti coat, dark charcoal dorsal stripe
// and mackerel flank bars, forehead M, golden-green eyes, black bow collar.
// One continuous sculpted SkinnedMesh (torso+neck loft, sculpted feline head,
// cupped ears, angulated feline limbs, tapering tail) plus rigid attachments
// (almond eyes with slit pupils, sculpted nose, curved whiskers, collar).
// Real scale, in metres: shoulder ~0.26 m. Faces +Z.
// In acts 1 and 4 he sleeps in his box by the cat scratcher (a stage's `cat`);
// elsewhere he exists hidden. Either way he gets up only to finish a boss
// (see addDendi below); the apartment exporter drops the source scene's own
// cat, so the game builds this one at runtime instead.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LOOK } from './look.js';

// ---------------------------------------------------------------- bones
// name, parent, local position (bind pose). Legs follow feline angulation
// (hind legs sweep back to the hock before descending to the paw).
const BONES = [
  ['hips', null, [0, 0.232, -0.125]],
  ['spine', 'hips', [0, 0.008, 0.085]],
  ['chest', 'spine', [0, 0.004, 0.095]],
  ['neck', 'chest', [0, 0.024, 0.058]],
  ['head', 'neck', [0, 0.034, 0.036]],
  ['earL', 'head', [0.027, 0.036, -0.004]],
  ['earR', 'head', [-0.027, 0.036, -0.004]],
  ['jaw', 'head', [0, -0.022, 0.020]],
  ['legFL0', 'chest', [0.038, -0.026, 0.024]],     // front-left shoulder
  ['legFL1', 'legFL0', [0, -0.096, -0.012]],       // front-left elbow
  ['legFL2', 'legFL1', [0, -0.098, 0.010]],        // front-left wrist/paw
  ['legFR0', 'chest', [-0.038, -0.026, 0.024]],
  ['legFR1', 'legFR0', [0, -0.096, -0.012]],
  ['legFR2', 'legFR1', [0, -0.098, 0.010]],
  ['legHL0', 'hips', [0.042, -0.012, -0.008]],     // hind-left hip
  ['legHL1', 'legHL0', [0.002, -0.118, -0.036]],   // hind-left hock (swept back)
  ['legHL2', 'legHL1', [0, -0.088, 0.018]],        // hind-left paw
  ['legHR0', 'hips', [-0.042, -0.012, -0.008]],
  ['legHR1', 'legHR0', [-0.002, -0.118, -0.036]],
  ['legHR2', 'legHR1', [0, -0.088, 0.018]],
  ['tail0', 'hips', [0, 0.018, -0.066]],
  ['tail1', 'tail0', [0, 0.006, -0.048]],
  ['tail2', 'tail1', [0, 0.012, -0.044]],
  ['tail3', 'tail2', [0, 0.020, -0.038]],
  ['tail4', 'tail3', [0, 0.026, -0.028]],
  ['tail5', 'tail4', [0, 0.026, -0.018]],
];
export const BONE_NAMES = BONES.map((b) => b[0]);

function buildSkeleton() {
  const bones = {}, list = [];
  for (const [name, parent, p] of BONES) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(p[0], p[1], p[2]);
    bones[name] = b;
    list.push(b);
    if (parent) bones[parent].add(b);
  }
  return { bones, list, root: bones.hips };
}

// ------------------------------------------------------- skin weights
const _idx = new Map(BONE_NAMES.map((n, i) => [n, i]));
function paintWeights(geo, fn) {
  const pos = geo.attributes.position, uv = geo.attributes.uv, n = pos.count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const u = uv ? uv.getX(i) : 0, v = uv ? uv.getY(i) : 0;
    const raw = fn(pos.getX(i), pos.getY(i), pos.getZ(i), u, v).filter(([, w]) => w > 0.001);
    raw.sort((a, b) => b[1] - a[1]);
    const top = raw.slice(0, 4);
    const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
    for (let k = 0; k < 4; k++) {
      const [name, w] = top[k] || ['hips', 0];
      si[i * 4 + k] = _idx.get(name);
      sw[i * 4 + k] = w / sum;
    }
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return geo;
}
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const blend = (a, b, t) => [[a, 1 - t], [b, t]];

function jointWorld(bones, name) {
  const v = new THREE.Vector3();
  bones[name].getWorldPosition(v);
  return v;
}

// ------------------------------------------------------- lofted mesh helper
function loftRings(rings, radSegs, { capStart = true, capEnd = true, curve = false } = {}) {
  const nR = rings.length;
  const cols = radSegs + 1;
  const positions = [];
  const uvs = [];
  const indices = [];

  const frames = [];
  if (curve) {
    let prevUp = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < nR; i++) {
      const p0 = new THREE.Vector3(...rings[Math.max(0, i - 1)].c);
      const p1 = new THREE.Vector3(...rings[Math.min(nR - 1, i + 1)].c);
      const t = p1.sub(p0).normalize();
      if (Math.abs(t.dot(prevUp)) > 0.96) prevUp = new THREE.Vector3(0, 0, 1);
      const right = new THREE.Vector3().crossVectors(prevUp, t).normalize();
      const up = new THREE.Vector3().crossVectors(t, right).normalize();
      prevUp = up;
      frames.push({ right, up, t });
    }
  }

  for (let i = 0; i < nR; i++) {
    const r = rings[i];
    const [cx, cy, cz] = r.c;
    const v = r.v !== undefined ? r.v : i / (nR - 1);
    for (let j = 0; j < cols; j++) {
      const u = j / radSegs;
      const th = u * Math.PI * 2;
      let lx = Math.sin(th) * r.rx;
      let ly = -Math.cos(th) * r.ry;
      if (r.fn) [lx, ly] = r.fn(th, lx, ly);
      let wx, wy, wz;
      if (curve) {
        const f = frames[i];
        wx = cx + f.right.x * lx + f.up.x * ly;
        wy = cy + f.right.y * lx + f.up.y * ly;
        wz = cz + f.right.z * lx + f.up.z * ly;
      } else if (r.axis === 'y') {
        wx = cx + lx;
        wy = cy + (r.dy ? r.dy(th) : 0);
        wz = cz - ly;
      } else {
        const tilt = r.tilt || 0;
        const ct = Math.cos(tilt), st = Math.sin(tilt);
        wx = cx + lx;
        wy = cy + ly * ct;
        wz = cz + ly * st;
      }
      positions.push(wx, wy, wz);
      uvs.push(u, v);
    }
  }

  for (let i = 0; i < nR - 1; i++) {
    for (let j = 0; j < radSegs; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = (i + 1) * cols + j;
      const d = c + 1;
      if (rings[0].axis === 'y') {
        indices.push(a, c, b, b, c, d);
      } else {
        indices.push(a, b, c, b, d, c);
      }
    }
  }

  if (capStart) {
    const ci = positions.length / 3;
    const r0 = rings[0];
    positions.push(r0.c[0], r0.c[1], r0.c[2]);
    uvs.push(0.5, r0.v ?? 0);
    for (let j = 0; j < radSegs; j++) {
      if (rings[0].axis === 'y') indices.push(ci, j, j + 1);
      else indices.push(ci, j + 1, j);
    }
  }
  if (capEnd) {
    const ci = positions.length / 3;
    const rn = rings[nR - 1];
    positions.push(rn.c[0], rn.c[1], rn.c[2]);
    uvs.push(0.5, rn.v ?? 1);
    const base = (nR - 1) * cols;
    for (let j = 0; j < radSegs; j++) {
      if (rings[0].axis === 'y') indices.push(ci, base + j + 1, base + j);
      else indices.push(ci, base + j, base + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ------------------------------------------------------------ geometry
function buildTorsoNeck() {
  // Continuous anatomical spine loft: rounded rump -> pelvis -> tucked waist ->
  // deep ribcage/chest -> muscular shoulders -> plush feline neck blending into skull.
  // [z, y, rx, ry, tilt, bellyTuck, spineFlat, v]
  const stations = [
    [-0.214, 0.232, 0.014, 0.014, 0.00, 0.00, 0.00, 0.00],
    [-0.198, 0.235, 0.044, 0.044, 0.00, 0.04, 0.12, 0.06],
    [-0.172, 0.239, 0.056, 0.058, 0.00, 0.08, 0.14, 0.14],
    [-0.132, 0.240, 0.059, 0.060, 0.00, 0.12, 0.14, 0.24],
    [-0.082, 0.236, 0.054, 0.056, 0.00, 0.18, 0.12, 0.36], // sleek feline waist
    [-0.025, 0.233, 0.056, 0.059, 0.00, 0.12, 0.10, 0.48], // ribcage
    [ 0.032, 0.232, 0.059, 0.065, 0.00, 0.04, 0.08, 0.60], // deep chest
    [ 0.080, 0.236, 0.056, 0.064, 0.14, 0.00, 0.06, 0.70], // shoulders & brisket
    [ 0.106, 0.248, 0.049, 0.054, 0.30, 0.00, 0.04, 0.79], // neck base
    [ 0.126, 0.266, 0.043, 0.046, 0.48, 0.00, 0.02, 0.87], // mid neck (plush feline neck)
    [ 0.144, 0.285, 0.041, 0.043, 0.60, 0.00, 0.02, 0.94], // upper neck
    [ 0.158, 0.300, 0.036, 0.036, 0.68, 0.00, 0.00, 1.00], // skull junction (tucked inside cranium)
  ];
  const rings = stations.map(([z, y, rx, ry, tilt, tuck, flat, v]) => ({
    c: [0, y, z],
    rx,
    ry,
    tilt,
    v,
    fn(th, lx, ly) {
      if (ly < 0) ly *= (1 - tuck * Math.pow(-Math.cos(th), 2));
      else ly *= (1 - flat * 0.32 * Math.pow(Math.cos(th), 4));
      return [lx, ly];
    },
  }));
  const geo = loftRings(rings, 28, { capStart: true, capEnd: true });
  paintWeights(geo, (x, y, z) => {
    if (z < -0.055) return blend('hips', 'spine', sstep(z, -0.105, -0.025));
    if (z < 0.045) return blend('spine', 'chest', sstep(z, -0.015, 0.065));
    if (z < 0.110 && y < 0.255) return blend('chest', 'neck', sstep(z, 0.065, 0.125));
    const tNeck = sstep(z, 0.072, 0.132) * sstep(y, 0.225, 0.275);
    const tHead = sstep(y, 0.282, 0.312) * sstep(z, 0.142, 0.175);
    if (tHead > 0.01) return blend('neck', 'head', tHead);
    return blend('chest', 'neck', tNeck);
  });
  geo.userData.group = 0;
  return geo;
}

function buildSculptedHead(bones) {
  // Single continuous sculpted domestic-shorthair feline head:
  // Rounded domed cranium, full cheekbones, steep forehead stop, SHORT wide
  // muzzle, puffy whisker pads, recessed eye sockets, neat chin.
  const headW = jointWorld(bones, 'head');
  const geo = new THREE.SphereGeometry(1, 32, 24);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  const gauss = (dx, dy, dz, sx, sy, sz) => Math.exp(-(dx * dx / (sx * sx) + dy * dy / (sy * sy) + dz * dz / (sz * sz)));

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i), ny = pos.getY(i), nz = pos.getZ(i);
    const ax = Math.abs(nx);

    // Base domestic cat skull: pleasantly rounded dome, slightly wider across cheeks
    let x = nx * 0.048;
    let y = ny * 0.045;
    let z = nz * 0.047;

    // 1. Full feline cheekbones / cheek ruff, gentle taper above brow
    const front = Math.max(0, nz);
    const cheekFull = gauss(ax - 0.72, ny + 0.22, nz - 0.12, 0.36, 0.36, 0.48);
    x *= (1.0 - 0.10 * front * Math.max(0, ny + 0.15) + 0.14 * cheekFull);

    // 2. Gentle crown dome (authentic shorthair forehead curve)
    if (ny > 0.35 && nz > 0.0) {
      y += gauss(ax, ny - 0.70, nz - 0.35, 0.65, 0.35, 0.55) * 0.004;
    }

    // 3. SHORT, soft domestic cat muzzle (NOT a long fox/mouse snout!)
    const snout = gauss(ax, ny + 0.22, nz - 0.90, 0.38, 0.28, 0.36);
    z += snout * 0.013;
    y -= snout * 0.002;

    // 4. Gentle nasal bridge slope between the eyes
    const bridge = gauss(ax, ny + 0.04, nz - 0.86, 0.18, 0.26, 0.32);
    z += bridge * 0.0055;

    // 5. Plush, rounded left & right whisker pads + subtle central philtrum cleft
    const pad = gauss(ax - 0.25, ny + 0.32, nz - 0.88, 0.24, 0.18, 0.30);
    z += pad * 0.011;
    x += Math.sign(nx) * pad * 0.0055;
    y -= pad * 0.002;
    const philtrum = gauss(ax, ny + 0.34, nz - 0.94, 0.08, 0.12, 0.22);
    z -= philtrum * 0.0028;

    // 6. Subtle recessed eye sockets + soft brow arches
    const eyeSocket = gauss(ax - 0.43, ny - 0.08, nz - 0.80, 0.22, 0.20, 0.28);
    z -= eyeSocket * 0.0055;
    const brow = gauss(ax - 0.38, ny - 0.32, nz - 0.76, 0.28, 0.16, 0.28);
    z += brow * 0.0038;
    y += brow * 0.0020;

    // 7. Neat rounded lower jaw & chin tucked under whisker pads
    const chin = gauss(ax, ny + 0.58, nz - 0.72, 0.26, 0.20, 0.34);
    z += chin * 0.008;
    y -= chin * 0.003;

    const wx = headW.x + x;
    const wy = headW.y + y + 0.003;
    const wz = headW.z + z + 0.010;
    pos.setXYZ(i, wx, wy, wz);

    // Front-centric equirectangular UVs: face center (+Z) at u=0.5, v=0.5
    const az = Math.atan2(nx, nz);
    const el = Math.asin(clamp(ny, -1, 1));
    uv.setXY(i, 0.5 + az / (Math.PI * 2), 0.5 + el / Math.PI);
  }
  geo.computeVertexNormals();

  paintWeights(geo, (x, y, z) => {
    const dy = y - headW.y, dz = z - headW.z;
    const tJaw = sstep(-dy, 0.020, 0.034) * sstep(dz, 0.016, 0.042);
    if (tJaw > 0.05) return blend('head', 'jaw', tJaw * 0.7);
    const tNeck = sstep(-dz, 0.016, 0.044) * sstep(-dy, 0.010, 0.038);
    if (tNeck > 0.02) return blend('head', 'neck', tNeck * 0.45);
    return [['head', 1]];
  });
  geo.userData.group = 1;
  return geo;
}

function buildCuppedEar(bones, side) {
  // Broad-based, softly rounded triangular tabby ear embedded cleanly into the skull.
  const name = side > 0 ? 'earL' : 'earR';
  const base = jointWorld(bones, name);
  const segH = 8, segU = 14;
  const cols = segU + 1;
  const positions = [], uvs = [], indices = [];

  for (let i = 0; i <= segH; i++) {
    const t = i / segH;
    const h = t * 0.050;
    // Wide base tapering smoothly to a softly rounded feline ear tip
    const w = 0.024 * Math.pow(1 - t * 0.84, 0.68);
    const d = 0.0125 * (1 - t * 0.76);
    const zCurve = Math.sin(t * Math.PI) * 0.003;

    for (let j = 0; j < cols; j++) {
      const u = j / segU;
      const th = u * Math.PI * 2;
      const sx = Math.sin(th) * w;
      const c = Math.cos(th);
      let sz = c * d;
      if (c > 0) {
        const cup = Math.sin(t * Math.PI) * 0.62;
        sz = c * d * (1 - cup * c);
      }
      const flare = (Math.sin(th) * side > 0) ? (1 - t) * 0.0035 : 0;
      positions.push(sx + side * flare, h, sz + zCurve);
      uvs.push(0.12 + u * 0.14, 0.78 + t * 0.20);
    }
  }
  for (let i = 0; i < segH; i++) {
    for (let j = 0; j < segU; j++) {
      const a = i * cols + j, b = a + 1, c = (i + 1) * cols + j, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const tipIdx = positions.length / 3;
  positions.push(0, 0.052, 0.001);
  uvs.push(0.19, 0.99);
  const topRow = segH * cols;
  for (let j = 0; j < segU; j++) indices.push(tipIdx, topRow + j + 1, topRow + j);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);

  // Seated deeper into the skull (-0.009 y) so the base blends seamlessly with no shelf
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(base.x, base.y - 0.009, base.z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, side * 0.22, side * -0.24)),
    new THREE.Vector3(1, 1, 1)
  );
  geo.applyMatrix4(m);
  geo.computeVertexNormals();
  paintWeights(geo, () => [[name, 1]]);
  geo.userData.group = 1;
  return geo;
}

function buildLimb(bones, tag) {
  // Continuous lofted limb tucked cleanly INSIDE the torso at the top so there is
  // never a boxy shelf, with v=1 at shoulder/hip and v=0 at the paw (matching canvas flipY=true!).
  const front = tag[0] === 'F';
  const side = tag[1] === 'L' ? 1 : -1;
  const b0 = `leg${tag}0`, b1 = `leg${tag}1`, b2 = `leg${tag}2`;
  const p0 = jointWorld(bones, b0), p1 = jointWorld(bones, b1), p2 = jointWorld(bones, b2);

  // [x, y, z, rx, ry, v, pawFactor] — v=1 at top (dark tabby), v=0 at bottom (buff paw)
  let pts;
  if (front) {
    pts = [
      [p0.x - side * 0.026, p0.y + 0.036, p0.z + 0.000, 0.012, 0.020, 1.00, 0], // buried deep inside torso
      [p0.x - side * 0.012, p0.y + 0.014, p0.z + 0.003, 0.019, 0.026, 0.90, 0], // smooth shoulder blend
      [p0.x - side * 0.002, p0.y - 0.024, p0.z - 0.002, 0.019, 0.022, 0.76, 0], // upper arm
      [p1.x,                p1.y + 0.014, p1.z - 0.003, 0.016, 0.018, 0.58, 0], // elbow
      [p1.x,                p1.y - 0.028, p1.z + 0.003, 0.014, 0.015, 0.42, 0], // forearm
      [p1.x,                p1.y - 0.068, p1.z + 0.007, 0.0125, 0.013, 0.26, 0], // lower forearm
      [p2.x,                p2.y + 0.008, p2.z + 0.002, 0.012, 0.0125, 0.16, 0], // wrist
      [p2.x,                0.015,        p2.z + 0.010, 0.0155, 0.020, 0.08, 0.6], // paw arch
      [p2.x,                0.006,        p2.z + 0.013, 0.0165, 0.022, 0.03, 1.0], // toes
      [p2.x,                0.001,        p2.z + 0.010, 0.011, 0.015, 0.00, 0.3], // sole
    ];
  } else {
    pts = [
      [p0.x - side * 0.028, p0.y + 0.036, p0.z + 0.002, 0.014, 0.026, 1.00, 0], // buried deep inside pelvis
      [p0.x - side * 0.012, p0.y + 0.012, p0.z + 0.007, 0.023, 0.038, 0.88, 0], // smooth haunch curve
      [p0.x - side * 0.002, p0.y - 0.038, p0.z + 0.014, 0.022, 0.031, 0.72, 0], // stifle (knee forward)
      [p1.x,                p1.y + 0.036, p1.z + 0.011, 0.017, 0.022, 0.56, 0], // lower thigh sweeping back
      [p1.x,                p1.y + 0.002, p1.z - 0.004, 0.014, 0.017, 0.44, 0], // hock
      [p1.x,                p1.y - 0.034, p1.z + 0.006, 0.0125, 0.014, 0.30, 0], // metatarsus
      [p2.x,                p2.y + 0.010, p2.z + 0.002, 0.012, 0.013, 0.17, 0], // ankle
      [p2.x,                0.015,        p2.z + 0.011, 0.015, 0.021, 0.08, 0.6], // paw arch
      [p2.x,                0.006,        p2.z + 0.014, 0.016, 0.023, 0.03, 1.0], // toes
      [p2.x,                0.001,        p2.z + 0.010, 0.0105, 0.015, 0.00, 0.3], // sole
    ];
  }

  const rings = pts.map(([x, y, z, rx, ry, v, paw]) => ({
    c: [x, y, z],
    rx,
    ry,
    v,
    axis: 'y',
    fn(th, lx, ly) {
      if (paw > 0) {
        const frontFace = Math.max(0, Math.cos(th));
        if (frontFace > 0.15) {
          const toeRip = 0.0014 * paw * frontFace * Math.cos(th * 6);
          ly -= toeRip;
          lx += Math.sin(th) * toeRip * 0.5;
        }
      }
      return [lx, ly];
    },
  }));

  const geo = loftRings(rings, 18, { capStart: true, capEnd: true });
  const rootBone = front ? 'chest' : 'hips';
  const y0 = p0.y, y1 = p1.y, y2 = p2.y;
  paintWeights(geo, (x, y) => {
    if (y > y0 - 0.012) {
      const t = sstep(y, y0 - 0.012, y0 + 0.024);
      return blend(b0, rootBone, t * 0.65);
    }
    if (y > y1) return blend(b0, b1, sstep(y1 + 0.022 - y, 0, 0.044));
    if (y > y2) return blend(b1, b2, sstep(y2 + 0.018 - y, 0, 0.036));
    return [[b2, 1]];
  });
  geo.userData.group = 2;
  return geo;
}

function buildTail(bones) {
  const ctrl = [];
  for (let i = 0; i < 6; i++) ctrl.push(jointWorld(bones, `tail${i}`));
  const tipDir = ctrl[5].clone().sub(ctrl[4]).normalize();
  ctrl.push(ctrl[5].clone().addScaledVector(tipDir, 0.036));

  const spline = new THREE.CatmullRomCurve3(ctrl);
  const segs = 24;
  const rings = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = spline.getPoint(t);
    const r = 0.0165 * (1 - 0.42 * t) * (t > 0.92 ? Math.cos(((t - 0.92) / 0.08) * Math.PI * 0.44) : 1);
    rings.push({ c: [p.x, p.y, p.z], rx: r, ry: r, v: t });
  }
  const geo = loftRings(rings, 14, { capStart: true, capEnd: true, curve: true });
  paintWeights(geo, (x, y, z, u, v) => {
    const f = clamp(v * 5.2, 0, 5);
    const i0 = Math.min(5, Math.floor(f));
    const i1 = Math.min(5, i0 + 1);
    const frac = f - i0;
    if (i0 === 0 && v < 0.08) return blend('hips', 'tail0', sstep(v, 0, 0.08));
    if (i0 === i1) return [[`tail${i0}`, 1]];
    return blend(`tail${i0}`, `tail${i1}`, frac);
  });
  geo.userData.group = 3;
  return geo;
}

function buildBodyGeometry(bones) {
  return [
    buildTorsoNeck(),
    buildSculptedHead(bones),
    buildCuppedEar(bones, 1),
    buildCuppedEar(bones, -1),
    buildLimb(bones, 'FL'),
    buildLimb(bones, 'FR'),
    buildLimb(bones, 'HL'),
    buildLimb(bones, 'HR'),
    buildTail(bones),
  ];
}

// ------------------------------------------------------------- assembly
function buildSlitPupilGeo(r = 0.0080) {
  const shape = new THREE.Shape();
  shape.moveTo(0, r);
  shape.quadraticCurveTo(r * 0.96, 0, 0, -r);
  shape.quadraticCurveTo(-r * 0.96, 0, 0, r);
  const geo = new THREE.ShapeGeometry(shape, 14);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, Math.sqrt(Math.max(0, 0.0132 * 0.0132 - x * x - y * y)) - 0.0118);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildEyelidRimGeo(rx = 0.0122, ry = 0.0098) {
  const pts = [];
  const segs = 28;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry * (1 - 0.14 * Math.pow(Math.cos(a), 2));
    const z = Math.sqrt(Math.max(0, 0.0148 * 0.0148 - x * x * 0.7 - y * y * 0.7)) - 0.0122;
    pts.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true);
  return new THREE.TubeGeometry(curve, 28, 0.0013, 6, true);
}

function buildCatNoseGeo() {
  const geo = new THREE.SphereGeometry(0.0066, 16, 12);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = clamp((y + 0.0066) / 0.0132, 0, 1);
    x *= (0.46 + 0.80 * Math.pow(t, 0.65));
    y *= 0.72;
    z *= 0.58;
    if (z > 0 && Math.abs(x) > 0.0022 && y < 0.001 && y > -0.0035) z -= 0.0007;
    if (y > 0.0030) y = 0.0030 + (y - 0.0030) * 0.4;
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildAttachments(bones, mats) {
  const head = bones.head, neck = bones.neck;
  const out = {};

  // ---- Eyes: merge dark eyeball + almond eyelid rim into 1 mesh per eye (saves 2 draws!)
  const pupilGeo = buildSlitPupilGeo(0.0080);
  const rimGeo = buildEyelidRimGeo(0.0120, 0.0098);
  rimGeo.translate(0, 0, 0.0054);
  const ballGeo = new THREE.SphereGeometry(0.0120, 16, 12);
  ballGeo.scale(1.0, 0.90, 0.58);
  const eyeSocketGeo = mergeGeometries([ballGeo, rimGeo]);

  const irisGeo = new THREE.SphereGeometry(0.0115, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.44);
  irisGeo.rotateX(Math.PI / 2);
  {
    const p = irisGeo.attributes.position, uv = irisGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      uv.setXY(i, 0.5 + p.getX(i) / 0.0230, 0.5 + p.getY(i) / 0.0230);
    }
  }

  for (const s of [1, -1]) {
    const g = new THREE.Group();
    // Large, expressive forward-facing domestic cat eyes nestled in the sculpted sockets
    g.position.set(s * 0.0205, 0.0075, 0.0490);
    g.rotation.set(-0.04, s * 0.24, s * 0.10);

    const ballAndRim = new THREE.Mesh(eyeSocketGeo, mats.eyeBall);

    const iris = new THREE.Mesh(irisGeo, mats.iris);
    iris.scale.set(0.96, 0.88, 0.65);
    iris.position.z = 0.0006;

    const pupil = new THREE.Mesh(pupilGeo, mats.pupil);
    pupil.position.z = 0.0070;
    pupil.scale.set(0.28, 0.94, 1);

    const g1 = new THREE.CircleGeometry(0.0022, 10);
    g1.translate(-0.0032, 0.0030, 0.0088);
    const g2 = new THREE.CircleGeometry(0.0009, 8);
    g2.translate(0.0028, -0.0022, 0.0086);
    const glint = new THREE.Mesh(mergeGeometries([g1, g2]), mats.glint);

    g.add(ballAndRim, iris, pupil, glint);
    head.add(g);
    out[s > 0 ? 'eyeL' : 'eyeR'] = g;
    out[s > 0 ? 'pupilL' : 'pupilR'] = pupil;
  }

  // ---- Inner ears
  for (const s of [1, -1]) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.0125, 0.004);
    shape.quadraticCurveTo(-0.010, 0.026, 0, 0.042);
    shape.quadraticCurveTo(0.010, 0.026, 0.0125, 0.004);
    shape.quadraticCurveTo(0, 0.0, -0.0125, 0.004);
    const ig = new THREE.ShapeGeometry(shape, 10);
    const p = ig.attributes.position, uv = ig.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const t = clamp(y / 0.042, 0, 1);
      const nx = x / 0.0125;
      p.setZ(i, 0.0040 + (nx * nx) * 0.0022 * Math.sin(t * Math.PI));
      uv.setXY(i, 0.5 + nx * 0.5, t);
    }
    ig.computeVertexNormals();
    const inner = new THREE.Mesh(ig, mats.innerEar);
    inner.position.set(0, -0.007, 0.0020);
    inner.rotation.set(0.12, s * 0.22, s * -0.24);
    bones[s > 0 ? 'earL' : 'earR'].add(inner);
  }

  // ---- Nose: proudly seated on the tip of the short feline muzzle
  const nose = new THREE.Mesh(buildCatNoseGeo(), mats.nose);
  nose.position.set(0, -0.0055, 0.0705);
  head.add(nose);

  // ---- Whiskers: 6 curving fine whiskers per side + 2 brow vibrissae per side
  const whiskerGeos = [];
  const addWhisker = (root, mid, tip, r0 = 0.00032) => {
    const curve = new THREE.QuadraticBezierCurve3(root, mid, tip);
    const geo = new THREE.TubeGeometry(curve, 5, r0, 4, false);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const ring = Math.floor(i / 5);
      const t = ring / 5;
      const c = curve.getPoint(t);
      const scale = 1 - 0.78 * t;
      p.setXYZ(i,
        c.x + (p.getX(i) - c.x) * scale,
        c.y + (p.getY(i) - c.y) * scale,
        c.z + (p.getZ(i) - c.z) * scale);
    }
    whiskerGeos.push(geo);
  };
  for (const s of [1, -1]) {
    const padRows = [
      { y: -0.0095, z: 0.060, spread: 0.013, len: 0.060, dy: 0.005, dz: 0.016 },
      { y: -0.0115, z: 0.062, spread: 0.015, len: 0.070, dy: -0.002, dz: 0.011 },
      { y: -0.0135, z: 0.060, spread: 0.014, len: 0.066, dy: -0.011, dz: 0.005 },
      { y: -0.0155, z: 0.058, spread: 0.012, len: 0.054, dy: -0.018, dz: 0.009 },
      { y: -0.0125, z: 0.056, spread: 0.017, len: 0.058, dy: -0.006, dz: -0.004 },
      { y: -0.0160, z: 0.055, spread: 0.015, len: 0.048, dy: -0.019, dz: 0.002 },
    ];
    for (const w of padRows) {
      const root = new THREE.Vector3(s * w.spread, w.y, w.z);
      const mid = new THREE.Vector3(s * (w.spread + w.len * 0.54), w.y + w.dy * 0.35 + 0.002, w.z + w.dz * 0.6);
      const tip = new THREE.Vector3(s * (w.spread + w.len), w.y + w.dy - 0.006, w.z + w.dz);
      addWhisker(root, mid, tip, 0.00030);
    }
    for (let b = 0; b < 2; b++) {
      const root = new THREE.Vector3(s * (0.015 + b * 0.005), 0.022 + b * 0.002, 0.047);
      const mid = new THREE.Vector3(s * (0.025 + b * 0.007), 0.036 + b * 0.002, 0.056);
      const tip = new THREE.Vector3(s * (0.036 + b * 0.008), 0.043 - b * 0.003, 0.060);
      addWhisker(root, mid, tip, 0.00022);
    }
  }
  head.add(new THREE.Mesh(mergeGeometries(whiskerGeos), mats.whisker));

  // ---- Collar + bow: fitted cleanly around the sculpted plush neck
  const collar = new THREE.Group();
  collar.position.set(0, 0.006, 0.015);
  collar.rotation.x = -0.78;
  const dummy = new THREE.Object3D();
  const bowM = new THREE.Matrix4().makeRotationX(0.78).setPosition(0, -0.043, 0.004);
  const collarGeos = [new THREE.TorusGeometry(0.0445, 0.0038, 10, 32)];
  for (const s of [1, -1]) {
    const wing = new THREE.ConeGeometry(0.0068, 0.018, 10);
    dummy.position.set(s * 0.0095, 0, 0);
    dummy.rotation.set(0, 0, s * (Math.PI / 2 + 0.32));
    dummy.scale.set(1, 1, 0.42);
    dummy.updateMatrix();
    wing.applyMatrix4(new THREE.Matrix4().multiplyMatrices(bowM, dummy.matrix));
    collarGeos.push(wing);
  }
  const knot = new THREE.SphereGeometry(0.0044, 10, 8);
  knot.applyMatrix4(bowM);
  collarGeos.push(knot);
  collar.add(new THREE.Mesh(mergeGeometries(collarGeos), mats.collar));
  neck.add(collar);
  out.collar = collar;
  return out;
}

export function greyMaterials() {
  const std = (color, roughness = 0.92) => new THREE.MeshStandardMaterial({ color, roughness });
  return {
    groups: [std(0x9a8f83), std(0xa39a8d), std(0x95897c), std(0x9a8f83)],
    eyeBall: std(0x16120e, 0.25),
    iris: std(0x8ea244, 0.16),
    pupil: new THREE.MeshBasicMaterial({ color: 0x040404 }),
    glint: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    nose: std(0xb86e5c, 0.44),
    whisker: std(0xf2efe8, 0.50),
    collar: std(0x17171a, 0.48),
    innerEar: std(0xc89a8c, 0.85),
  };
}

export function buildCat(mats = greyMaterials()) {
  const { bones, list, root } = buildSkeleton();
  const group = new THREE.Group();
  group.add(root);
  group.updateMatrixWorld(true);
  const geos = buildBodyGeometry(bones);
  const buckets = [[], [], [], []];
  for (const g of geos) buckets[g.userData.group].push(g);
  const merged = mergeGeometries(buckets.map((b) => mergeGeometries(b, false)), true);
  const mesh = new THREE.SkinnedMesh(merged, mats.groups);
  mesh.frustumCulled = false;
  group.add(mesh);
  mesh.add(root);
  group.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(list));
  mesh.normalizeSkinWeights();
  const attachments = buildAttachments(bones, mats);
  return { group, mesh, bones, attachments, mats };
}

// -------------------------------------------------------------- painting
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(w, h, draw, { srgb = true, repeatX = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = repeatX ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  return t;
}

function furStrokes(ctx, w, h, rand, palette, count, len, baseAng, spread = 0.22, lineW = 1.1) {
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = rand() * w, y = rand() * h;
    const a = baseAng + (rand() - 0.5) * spread;
    const l = len * (0.55 + rand() * 0.9);
    ctx.strokeStyle = palette[Math.floor(rand() * palette.length)];
    ctx.lineWidth = lineW * (0.7 + rand() * 0.6);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
}

function makeFurBump() {
  return canvasTex(256, 256, (ctx, w, h) => {
    const r = rng(404);
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    furStrokes(ctx, w, h, r,
      ['rgba(215,215,215,0.22)', 'rgba(45,45,45,0.22)', 'rgba(170,170,170,0.18)', 'rgba(90,90,90,0.18)'],
      4200, 7, Math.PI / 2, 0.22, 1.0);
  }, { srgb: false });
}

const AGOUTI_WARM = [
  'rgba(32,23,15,0.40)',
  'rgba(186,144,96,0.36)',
  'rgba(132,96,60,0.40)',
  'rgba(216,184,138,0.30)',
  'rgba(72,52,34,0.38)',
];

const softStroke = (ctx, pts, width, color, alpha) => {
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.globalAlpha = 1;
};

export function paintMaterials() {
  const furBump = makeFurBump();

  // ---- 1. Torso + neck
  const torsoTex = canvasTex(1024, 512, (ctx, w, h) => {
    const r = rng(101);
    const U = (u) => u * w, V = (v) => (1 - v) * h;

    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0.00, '#c6ac84');
    g.addColorStop(0.14, '#a27f55');
    g.addColorStop(0.28, '#876642');
    g.addColorStop(0.44, '#5e452d');
    g.addColorStop(0.50, '#463321');
    g.addColorStop(0.56, '#5e452d');
    g.addColorStop(0.72, '#876642');
    g.addColorStop(0.86, '#a27f55');
    g.addColorStop(1.00, '#c6ac84');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    furStrokes(ctx, w, h, r, AGOUTI_WARM, 7500, 10, Math.PI / 2, 0.24, 1.1);

    // Organic, softly broken, slightly backward-sweeping mackerel tabby bars
    for (const side of [1, -1]) {
      for (let i = 0; i < 12; i++) {
        const v0 = 0.08 + i * 0.064 + (r() - 0.5) * 0.018;
        const reach = 0.26 + r() * 0.09;
        // Break each mackerel stripe into 2-3 slightly offset organic segments (looks like real tabby fur!)
        const segs = 2 + Math.floor(r() * 2);
        for (let sg = 0; sg < segs; sg++) {
          const f0 = sg / segs + (sg > 0 ? 0.04 : 0);
          const f1 = (sg + 1) / segs - (sg < segs - 1 ? 0.03 : 0);
          const pts = [];
          for (let k = 0; k <= 4; k++) {
            const f = f0 + (f1 - f0) * (k / 4);
            const u = 0.5 + side * (0.045 + f * reach);
            const v = v0 - f * 0.045 + Math.sin(f * 5.2 + i * 1.7) * 0.010;
            pts.push([U(u), V(v)]);
          }
          const fade = (v0 < 0.14 ? 0.55 : v0 > 0.76 ? 0.58 : 0.92) * (1 - 0.25 * sg);
          softStroke(ctx, pts, 14 + r() * 5, '#332418', 0.28 * fade);
          softStroke(ctx, pts, 7 + r() * 3.5, '#1d150f', 0.42 * fade);
        }
      }
      // Subtle broken tabby necklace arcs on chest
      for (let n = 0; n < 2; n++) {
        const vN = 0.77 + n * 0.062;
        const pts = [
          [U(0.5 + side * 0.28), V(vN + 0.018)],
          [U(0.5 + side * 0.39), V(vN)],
          [U(0.5 + side * 0.47), V(vN - 0.012)],
        ];
        softStroke(ctx, pts, 8, '#261c14', 0.36);
      }
    }

    // Feathered charcoal dorsal stripe along the spine
    const dg = ctx.createLinearGradient(U(0.43), 0, U(0.57), 0);
    dg.addColorStop(0.00, 'rgba(22,16,12,0)');
    dg.addColorStop(0.26, 'rgba(22,16,12,0.68)');
    dg.addColorStop(0.50, 'rgba(16,12,9,0.88)');
    dg.addColorStop(0.74, 'rgba(22,16,12,0.68)');
    dg.addColorStop(1.00, 'rgba(22,16,12,0)');
    ctx.fillStyle = dg;
    ctx.fillRect(U(0.43), V(0.95), U(0.14), V(0.04) - V(0.95));

    // Soft cream chest/throat bib
    for (const uCenter of [0.0, 1.0]) {
      const cg = ctx.createRadialGradient(U(uCenter), V(0.87), 8, U(uCenter), V(0.87), 135);
      cg.addColorStop(0, 'rgba(224,206,176,0.74)');
      cg.addColorStop(0.6, 'rgba(208,186,152,0.32)');
      cg.addColorStop(1, 'rgba(208,186,152,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(0, V(1.0), w, V(0.68) - V(1.0));
    }

    // Dense agouti ticking OVER the stripes so they look woven into shorthair fur
    furStrokes(ctx, w, h, r,
      ['rgba(216,180,132,0.28)', 'rgba(150,114,74,0.30)', 'rgba(30,22,15,0.24)', 'rgba(235,212,174,0.18)'],
      8000, 7, Math.PI / 2, 0.28, 0.85);
  });

  // ---- 2. Face & head
  const faceTex = canvasTex(512, 512, (ctx, w, h) => {
    const r = rng(202);
    const U = (u) => u * w, V = (v) => (1 - v) * h;

    ctx.fillStyle = '#906e49';
    ctx.fillRect(0, 0, w, h);

    // Darker crown & back of skull
    const crown = ctx.createRadialGradient(U(0.5), V(0.78), 10, U(0.5), V(0.78), 175);
    crown.addColorStop(0, 'rgba(66,48,32,0.58)');
    crown.addColorStop(1, 'rgba(66,48,32,0)');
    ctx.fillStyle = crown;
    ctx.fillRect(0, 0, w, h);

    // Warm golden-amber nose bridge (matches reference face close-up!)
    const bridge = ctx.createRadialGradient(U(0.5), V(0.49), 4, U(0.5), V(0.49), 62);
    bridge.addColorStop(0, 'rgba(190,138,84,0.88)');
    bridge.addColorStop(0.65, 'rgba(164,116,70,0.45)');
    bridge.addColorStop(1, 'rgba(164,116,70,0)');
    ctx.fillStyle = bridge;
    ctx.fillRect(0, 0, w, h);

    // Pale cream/ivory whisker pads & chin
    for (const s of [1, -1]) {
      const pad = ctx.createRadialGradient(U(0.5 + s * 0.044), V(0.39), 4, U(0.5 + s * 0.044), V(0.39), 46);
      pad.addColorStop(0, 'rgba(240,226,204,0.95)');
      pad.addColorStop(0.6, 'rgba(222,202,172,0.62)');
      pad.addColorStop(1, 'rgba(222,202,172,0)');
      ctx.fillStyle = pad;
      ctx.fillRect(0, 0, w, h);
    }
    const chin = ctx.createRadialGradient(U(0.5), V(0.27), 6, U(0.5), V(0.27), 56);
    chin.addColorStop(0, 'rgba(240,228,206,0.94)');
    chin.addColorStop(1, 'rgba(240,228,206,0)');
    ctx.fillStyle = chin;
    ctx.fillRect(0, 0, w, h);

    // Pale cream spectacles around each eye
    for (const s of [1, -1]) {
      const ex = U(0.5 + s * 0.086), ey = V(0.53);
      const eg = ctx.createRadialGradient(ex, ey, 6, ex, ey, 34);
      eg.addColorStop(0, 'rgba(238,224,196,0.84)');
      eg.addColorStop(0.6, 'rgba(218,194,158,0.44)');
      eg.addColorStop(1, 'rgba(218,194,158,0)');
      ctx.fillStyle = eg;
      ctx.fillRect(0, 0, w, h);
    }

    furStrokes(ctx, w, h, r, AGOUTI_WARM, 5600, 6, Math.PI / 2, 0.35, 0.85);

    // Authentic single centered tabby forehead 'M' + crown stripes + cheek mascara lines
    softStroke(ctx, [
      [U(0.482), V(0.675)],
      [U(0.500), V(0.625)],
      [U(0.518), V(0.675)],
    ], 3.8, '#231912', 0.72);
    for (const s of [1, -1]) {
      // Inner crown line flowing back from the M's peaks
      softStroke(ctx, [
        [U(0.5 + s * 0.018), V(0.665)],
        [U(0.5 + s * 0.020), V(0.735)],
        [U(0.5 + s * 0.014), V(0.83)],
      ], 4.4, '#231912', 0.74);
      // Outer M arch sweeping up from inner brow toward ear
      softStroke(ctx, [
        [U(0.5 + s * 0.050), V(0.595)],
        [U(0.5 + s * 0.044), V(0.685)],
        [U(0.5 + s * 0.036), V(0.79)],
      ], 4.8, '#231912', 0.70);
      // Connecting arch from outer M to inner peak
      softStroke(ctx, [
        [U(0.5 + s * 0.018), V(0.672)],
        [U(0.5 + s * 0.032), V(0.695)],
        [U(0.5 + s * 0.044), V(0.665)],
      ], 3.4, '#231912', 0.58);

      // Sweeping dark mascara lines from outer eye corners
      softStroke(ctx, [
        [U(0.5 + s * 0.118), V(0.535)],
        [U(0.5 + s * 0.168), V(0.545)],
        [U(0.5 + s * 0.225), V(0.568)],
      ], 5.0, '#1e1610', 0.78);
      softStroke(ctx, [
        [U(0.5 + s * 0.112), V(0.490)],
        [U(0.5 + s * 0.165), V(0.475)],
        [U(0.5 + s * 0.226), V(0.485)],
      ], 4.8, '#221912', 0.68);
      softStroke(ctx, [
        [U(0.5 + s * 0.095), V(0.435)],
        [U(0.5 + s * 0.155), V(0.415)],
        [U(0.5 + s * 0.212), V(0.420)],
      ], 4.2, '#281e15', 0.52);

      // Subtle whisker-follicle dots on whisker pads
      ctx.fillStyle = 'rgba(42,30,20,0.48)';
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
          ctx.beginPath();
          ctx.arc(U(0.5 + s * (0.025 + col * 0.013)), V(0.412 - row * 0.018), 1.15, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Ear UV patch (u=0.08..0.32, v=0.76..1.0)
    const eg = ctx.createLinearGradient(0, V(0.76), 0, V(1.0));
    eg.addColorStop(0.0, '#8d6c47');
    eg.addColorStop(0.55, '#5a432d');
    eg.addColorStop(1.0, '#2a1f16');
    ctx.fillStyle = eg;
    ctx.fillRect(U(0.08), V(1.0), U(0.24), V(0.76) - V(1.0));
    furStrokes(ctx, w, h, r, ['rgba(205,168,122,0.24)', 'rgba(30,22,16,0.22)'], 2800, 5, Math.PI / 2, 0.3, 0.8);
  });

  // ---- 3. Legs (v=1 at top -> canvas y=0 is dark warm tabby matching torso; v=0 at bottom -> canvas y=h is warm buff paw!)
  const legTex = canvasTex(512, 256, (ctx, w, h) => {
    const r = rng(303);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.00, '#785a3a'); // matches torso flank seamlessly!
    g.addColorStop(0.48, '#8d6c47');
    g.addColorStop(0.80, '#b39066');
    g.addColorStop(1.00, '#cbb088'); // warm sandy-buff paws
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    furStrokes(ctx, w, h, r, AGOUTI_WARM, 3800, 8, Math.PI / 2, 0.20, 1.0);

    // Organic dark charcoal horizontal tabby bars along thigh/arm & lower leg
    const bars = [0.16, 0.30, 0.44, 0.58, 0.70, 0.81];
    for (let i = 0; i < bars.length; i++) {
      const y = h * bars[i];
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        pts.push([(k / 12) * w, y + Math.sin(k * 0.9 + i * 1.7) * 2.5]);
      }
      softStroke(ctx, pts, 11 - i * 0.6, '#2d2117', 0.38);
      softStroke(ctx, pts, 6.2 - i * 0.35, '#1c140e', 0.56);
    }

    // Subtle dark toe-cleft accents near paw bottom
    for (let t = 0; t < 3; t++) {
      const x = w * (0.04 + t * 0.08);
      softStroke(ctx, [[x, h * 0.92], [x, h * 0.99]], 3, '#3b2b1d', 0.32);
    }

    furStrokes(ctx, w, h, r, ['rgba(218,186,142,0.26)', 'rgba(34,25,18,0.22)'], 2800, 6, Math.PI / 2, 0.24, 0.8);
  });

  // ---- 4. Tail: warm agouti with 7 charcoal rings + dark charcoal tip
  const tailTex = canvasTex(256, 256, (ctx, w, h) => {
    const r = rng(404);
    ctx.fillStyle = '#7b5d3d';
    ctx.fillRect(0, 0, w, h);
    furStrokes(ctx, w, h, r, AGOUTI_WARM, 2600, 8, Math.PI / 2, 0.18, 1.0);

    for (let i = 0; i < 7; i++) {
      const y = h * (0.86 - i * 0.112);
      const pts = [];
      for (let k = 0; k <= 10; k++) pts.push([(k / 10) * w, y + Math.sin(k + i) * 1.6]);
      softStroke(ctx, pts, 13, '#2d2117', 0.42);
      softStroke(ctx, pts, 8, '#1a130d', 0.68);
    }
    const tipG = ctx.createLinearGradient(0, 0, 0, h * 0.16);
    tipG.addColorStop(0.0, 'rgba(20,15,11,0.96)');
    tipG.addColorStop(0.65, 'rgba(24,18,13,0.82)');
    tipG.addColorStop(1.0, 'rgba(24,18,13,0)');
    ctx.fillStyle = tipG;
    ctx.fillRect(0, 0, w, h * 0.16);
  });

  // ---- 5. Golden-green / yellow-amber feline iris (256x256)
  const irisTex = canvasTex(256, 256, (ctx, w, h) => {
    const r = rng(505);
    const cx = w / 2, cy = h / 2, rad = w * 0.48;
    const g = ctx.createRadialGradient(cx, cy, rad * 0.08, cx, cy, rad);
    g.addColorStop(0.00, '#c29e3c');
    g.addColorStop(0.32, '#c8b44c');
    g.addColorStop(0.68, '#959d42');
    g.addColorStop(0.88, '#4e5224');
    g.addColorStop(0.95, '#1b180e');
    g.addColorStop(1.00, '#0a0806');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 240; i++) {
      const a = (i / 240) * Math.PI * 2 + (r() - 0.5) * 0.02;
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(245,234,148,0.28)' : i % 3 === 1 ? 'rgba(62,68,24,0.32)' : 'rgba(182,146,56,0.22)';
      ctx.lineWidth = 1.1 + r() * 0.9;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rad * (0.14 + r() * 0.1), cy + Math.sin(a) * rad * (0.14 + r() * 0.1));
      ctx.lineTo(cx + Math.cos(a) * rad * (0.86 + r() * 0.08), cy + Math.sin(a) * rad * (0.86 + r() * 0.08));
      ctx.stroke();
    }
    const sh = ctx.createLinearGradient(0, cy - rad, 0, cy - rad * 0.15);
    sh.addColorStop(0, 'rgba(12,10,8,0.58)');
    sh.addColorStop(1, 'rgba(12,10,8,0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }, { repeatX: false });

  // ---- 6. Inner ear texture
  const innerEarTex = canvasTex(128, 128, (ctx, w, h) => {
    const r = rng(606);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.62, 6, w * 0.5, h * 0.52, w * 0.56);
    g.addColorStop(0.0, '#c48e82');
    g.addColorStop(0.55, '#d4a798');
    g.addColorStop(0.85, '#d8c2a8');
    g.addColorStop(1.0, '#a88a68');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    furStrokes(ctx, w, h, r, ['rgba(242,232,216,0.45)', 'rgba(220,200,175,0.35)'], 450, 9, -Math.PI / 2, 0.55, 0.9);
  }, { repeatX: false });

  // ---- 7. Nose leather texture (terracotta pink center with dark charcoal outline)
  const noseTex = canvasTex(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#36241d';
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.48, 4, w * 0.5, h * 0.48, w * 0.42);
    g.addColorStop(0.0, '#cc7e6a');
    g.addColorStop(0.68, '#b46956');
    g.addColorStop(0.92, '#4a3026');
    g.addColorStop(1.0, '#2a1c16');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { repeatX: false });

  const fur = (map) => new THREE.MeshStandardMaterial({
    map,
    bumpMap: furBump,
    bumpScale: 0.008,
    roughness: 0.88,
    metalness: 0.0,
  });
  const std = (color, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, roughness });

  return {
    groups: [fur(torsoTex), fur(faceTex), fur(legTex), fur(tailTex)],
    eyeBall: std(0x16120e, 0.65),
    iris: new THREE.MeshStandardMaterial({ map: irisTex, roughness: 0.14, metalness: 0.04 }),
    pupil: new THREE.MeshBasicMaterial({ color: 0x040404 }),
    glint: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    nose: new THREE.MeshStandardMaterial({ map: noseTex, roughness: 0.42 }),
    whisker: new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.45, transparent: true, opacity: 0.86 }),
    collar: std(0x17171a, 0.48),
    innerEar: new THREE.MeshStandardMaterial({ map: innerEarTex, roughness: 0.86, side: THREE.DoubleSide }),
  };
}


// ------------------------------------------------------------ animation
const BIND_HIPS = new THREE.Vector3(0, 0.232, -0.125);
function resetPose(cat) {
  for (const b of Object.values(cat.bones)) b.rotation.set(0, 0, 0);
  cat.bones.hips.position.copy(BIND_HIPS);
}
const R = (b, x = 0, y = 0, z = 0) => { b.rotation.x += x; b.rotation.y += y; b.rotation.z += z; };
const wander = (t, a, b) => Math.sin(t * a) * 0.6 + Math.sin(t * b + 1.7) * 0.4;

function tailWave(cat, t, amp = 0.06, freq = 1.6, lift = 0) {
  const B = cat.bones;
  for (let i = 0; i < 6; i++) {
    R(B[`tail${i}`], lift * (i === 0 ? 1 : 0.35), 0, Math.sin(t * freq - i * 0.55) * amp * (0.4 + i * 0.16));
  }
}
function tailHangCurl(cat, side = 0.3) {
  const B = cat.bones;
  R(B.tail0, -0.78, 0, -0.22 * side);
  R(B.tail1, -0.28, 0, -0.82 * side);
  R(B.tail2, -0.22, 0, -0.88 * side);
  R(B.tail3, -0.18, 0, -0.58 * side);
  R(B.tail4, -0.12, 0, -0.32 * side);
  R(B.tail5, -0.08, 0, -0.12 * side);
}
function blinkAndPupils(cat, t, pupil = 0.38, lid = 1) {
  const cyc = t % 3.7;
  const b = cyc < 0.13 ? Math.sin((cyc / 0.13) * Math.PI) : 0;
  for (const e of [cat.attachments.eyeL, cat.attachments.eyeR]) {
    e.scale.y = lid * (1 - 0.92 * b);
    for (let i = 1; i < e.children.length; i++) e.children[i].visible = lid > 0.1;
  }
  for (const p of [cat.attachments.pupilL, cat.attachments.pupilR]) p.scale.x = pupil;
}
function gaitLeg(cat, tag, ph, amp, liftAmp) {
  const B = cat.bones;
  R(B[`leg${tag}0`], amp * Math.sin(ph));
  R(B[`leg${tag}1`], liftAmp * Math.max(0, Math.sin(ph - 0.7)) + 0.08 * Math.sin(ph));
  R(B[`leg${tag}2`], -amp * 0.55 * Math.sin(ph) - liftAmp * 0.5 * Math.max(0, Math.sin(ph - 0.7)));
}

export const STATE_NAMES = ['idle', 'curious', 'walk', 'trot', 'sit', 'loaf', 'stretch', 'smack', 'sleep'];
export function applyState(cat, state, t, opts = {}) {
  const B = cat.bones;
  resetPose(cat);
  const breathe = Math.sin(t * 1.9) * 0.012;
  switch (state) {
    case 'idle': {
      R(B.spine, breathe, 0, 0); R(B.chest, -breathe * 0.7, 0, 0);
      R(B.neck, wander(t, 0.23, 0.11) * 0.05, wander(t, 0.17, 0.31) * 0.16, 0);
      R(B.head, -wander(t, 0.23, 0.11) * 0.03, wander(t, 0.13, 0.29) * 0.10, wander(t, 0.07, 0.19) * 0.05);
      if (Math.sin(t * 0.43) > 0.965) R(B.earL, -0.3, 0, 0.15);
      tailWave(cat, t, 0.055, 1.4);
      blinkAndPupils(cat, t, 0.34);
      break;
    }
    case 'curious': {
      R(B.neck, -0.22, 0, 0); R(B.head, -0.18, 0, 0.12);
      R(B.earL, -0.14, 0, 0.05); R(B.earR, -0.14, 0, -0.05);
      R(B.chest, -0.04 + breathe, 0, 0);
      tailWave(cat, t, 0.04, 1.8, -0.06);
      blinkAndPupils(cat, t, 0.78);
      break;
    }
    case 'walk': case 'trot': {
      const trot = state === 'trot';
      const f = trot ? 2.6 : 1.6, ph = t * Math.PI * 2 * f;
      const amp = trot ? 0.46 : 0.34, lift = trot ? 0.6 : 0.46;
      gaitLeg(cat, 'FL', ph, amp, lift); gaitLeg(cat, 'HR', ph, amp * 0.88, lift * 0.85);
      gaitLeg(cat, 'FR', ph + Math.PI, amp, lift); gaitLeg(cat, 'HL', ph + Math.PI, amp * 0.88, lift * 0.85);
      B.hips.position.y += Math.sin(ph * 2) * (trot ? 0.007 : 0.004);
      R(B.spine, Math.sin(ph * 2) * 0.02, 0, Math.sin(ph) * 0.018);
      R(B.chest, -Math.sin(ph * 2) * 0.015, 0, -Math.sin(ph) * 0.014);
      R(B.neck, -0.05 + Math.sin(ph * 2 + 0.6) * 0.02, 0, 0);
      R(B.head, 0.04, 0, 0);
      tailWave(cat, t, 0.05, f * 1.6, -0.10);
      blinkAndPupils(cat, t, 0.42);
      break;
    }
    case 'sit': {
      B.hips.position.y -= 0.178; B.hips.position.z -= 0.015;
      R(B.hips, -0.38, 0, 0);
      R(B.spine, -0.16, 0, 0); R(B.chest, -0.12, 0, 0);
      R(B.neck, 0.36, 0, 0); R(B.head, 0.28 + breathe * 2, wander(t, 0.17, 0.31) * 0.07, 0.03);
      for (const s of ['L', 'R']) {
        R(B[`legH${s}0`], -0.78, 0, s === 'L' ? 0.05 : -0.05);
        R(B[`legH${s}1`], 1.75, 0, 0);
        R(B[`legH${s}2`], -0.82, 0, 0);
        R(B[`legF${s}0`], 0.62, 0, 0); R(B[`legF${s}1`], 0.04, 0, 0);
      }
      tailHangCurl(cat, 0.32);
      blinkAndPupils(cat, t, 0.42);
      break;
    }
    case 'loaf': {
      B.hips.position.y -= 0.172;
      R(B.hips, 0.05, 0, 0); R(B.spine, 0.06 + breathe, 0, 0); R(B.chest, 0.04, 0, 0);
      R(B.neck, -0.02, 0, 0); R(B.head, 0.04, wander(t, 0.13, 0.27) * 0.06, 0);
      for (const s of ['L', 'R']) {
        const sg = s === 'L' ? 1 : -1;
        R(B[`legF${s}0`], -1.08, 0, -sg * 0.22); R(B[`legF${s}1`], 2.68, 0, 0); R(B[`legF${s}2`], -0.4, 0, 0);
        R(B[`legH${s}0`], -1.28, 0, sg * 0.08); R(B[`legH${s}1`], 2.35, 0, 0); R(B[`legH${s}2`], -0.9, 0, 0);
      }
      tailHangCurl(cat, 0.52);
      blinkAndPupils(cat, t, 0.30, 0.82);
      break;
    }
    case 'sleep': {
      // Cozy curled/tucked sleeping loaf: body settled low, paws tucked under chest,
      // head resting gently forward-and-sideways, slow deep breathing.
      const deep = Math.sin(t * 2.3);
      B.hips.position.y -= 0.176 - deep * 0.0025;
      R(B.hips, 0.05, 0, 0); R(B.spine, 0.07 + deep * 0.03, 0.12, 0); R(B.chest, 0.05 - deep * 0.02, 0.16, 0);
      R(B.neck, 0.22, 0.26, 0.06); R(B.head, 0.18, 0.18, 0.22);
      for (const s of ['L', 'R']) {
        const sg = s === 'L' ? 1 : -1;
        R(B[`legF${s}0`], -1.12, 0, -sg * 0.24); R(B[`legF${s}1`], 2.72, 0, 0); R(B[`legF${s}2`], -0.4, 0, 0);
        R(B[`legH${s}0`], -1.30, 0, sg * 0.08); R(B[`legH${s}1`], 2.38, 0, 0); R(B[`legH${s}2`], -0.9, 0, 0);
      }
      const pulse = (c, len) => (c < len ? Math.sin((c / len) * Math.PI) : 0);
      R(B.earL, -0.40 * pulse(t % 9.3, 0.3), 0, 0.18 * pulse(t % 9.3, 0.3));
      tailHangCurl(cat, 0.65);
      const flick = pulse((t + 4.1) % 13.7, 0.7);
      R(B.tail4, 0, 0, 0.5 * flick); R(B.tail5, 0, 0, 0.7 * flick);
      blinkAndPupils(cat, 0.5, 0.30, 0.07);
      break;
    }
    case 'smack': {
      const up = sstep(t, 0, 0.16), down = sstep(t, 0.16, 0.27), back = sstep(t, 0.36, 0.85);
      const live = 1 - back;
      R(B.legFR0, (-1.12 * up + 0.62 * down) * live, 0, -0.1 * live);
      R(B.legFR1, (0.55 * up - 0.7 * down) * live, 0, 0);
      R(B.legFR2, (-0.35 * up + 0.25 * down) * live, 0, 0);
      R(B.legFL0, 0.08 * live, 0, 0);
      R(B.chest, (0.04 * up + 0.09 * down) * live + breathe, 0, 0);
      R(B.neck, -0.14 * live, 0, 0); R(B.head, -0.08 * live, 0, 0.05 * live);
      R(B.earL, 0.3 * live, 0, 0.1); R(B.earR, 0.3 * live, 0, -0.1);
      tailWave(cat, t, 0.13, 9, -0.25);
      blinkAndPupils(cat, t, 0.88);
      break;
    }
    case 'stretch': {
      const cyc = (t % 3.2) / 3.2;
      const k = cyc < 0.3 ? sstep(cyc, 0, 0.3) : cyc < 0.72 ? 1 : 1 - sstep(cyc, 0.72, 1);
      B.hips.position.y -= 0.052 * k; B.hips.position.z -= 0.01 * k;
      R(B.hips, 0.30 * k, 0, 0); R(B.spine, 0.22 * k, 0, 0); R(B.chest, 0.16 * k, 0, 0);
      R(B.neck, -0.18 * k, 0, 0); R(B.head, -0.06 * k, 0, 0);
      for (const s of ['L', 'R']) {
        R(B[`legF${s}0`], -0.95 * k, 0, 0); R(B[`legF${s}1`], -0.12 * k, 0, 0); R(B[`legF${s}2`], 0.35 * k, 0, 0);
        R(B[`legH${s}0`], 0.34 * k, 0, 0); R(B[`legH${s}1`], 0.18 * k, 0, 0); R(B[`legH${s}2`], -0.25 * k, 0, 0);
      }
      tailWave(cat, t, 0.03, 1.2, -0.35 * k);
      blinkAndPupils(cat, t, 0.38);
      break;
    }
  }
  if (opts.gaze && (state === 'idle' || state === 'curious' || state === 'sit')) {
    const headW = new THREE.Vector3();
    B.head.getWorldPosition(headW);
    const d = opts.gaze.clone().sub(headW);
    const yaw = Math.max(-0.6, Math.min(0.6, Math.atan2(d.x, d.z)));
    const pitch = Math.max(-0.45, Math.min(0.35, -Math.atan2(d.y, Math.hypot(d.x, d.z))));
    R(B.neck, pitch * 0.4, yaw * 0.45, 0);
    R(B.head, pitch * 0.6, yaw * 0.55, 0);
  }
  cat.group.updateMatrixWorld(true);
}

// ------------------------------------------------------------ in the game
const ROUTINE = [['loaf', 26], ['idle', 9], ['sit', 14], ['idle', 7], ['loaf', 20], ['stretch', 6.4], ['sit', 11]];
const _gazeD = new THREE.Vector3(), _gazeH = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
export function addDendi(scene, at, yaw = 0, opts = {}) {
  const cat = buildCat(paintMaterials());
  cat.group.position.copy(at);
  cat.group.rotation.y = yaw;
  cat.group.traverse((o) => { o.userData.noCollide = true; });
  if (opts.hidden) cat.group.visible = false;
  scene.add(cat.group);
  const asleep = !!opts.asleep, calm = opts.calm || (() => false), rate = LOOK.num('dendi-sleep-fps', 12);
  cat.mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.17, -0.05), 0.42);
  cat.mesh.frustumCulled = true;
  let frame = 0, seen = -9, wait = 0, held = false;
  cat.mesh.onBeforeRender = () => { seen = frame; };
  if (asleep) applyState(cat, 'sleep', 0);
  let t = Math.random() * 10, step = 0, left = ROUTINE[0][1], state = asleep ? 'sleep' : ROUTINE[0][0], pose = state;
  let sceneMode = null, sceneT = 0, smackRate = 1, walkTime = 0;
  let walkPath = [];
  const placeForSmack = (pos, faceYaw) => {
    cat.group.visible = true;
    cat.group.position.copy(pos);
    cat.group.rotation.y = faceYaw;
    sceneMode = 'await'; sceneT = 0;
  };
  const approach = (path, duration) => {
    walkPath = path; walkTime = duration;
    cat.group.position.copy(path[0]); sceneMode = 'walk'; sceneT = 0;
  };
  const beginSmack = (rate = 1) => { if (sceneMode === 'await') { sceneMode = 'smack'; sceneT = 0; smackRate = rate; } };
  const home = { pos: at.clone(), yaw, hidden: !!opts.hidden };
  const endScene = () => {
    sceneMode = null;
    cat.group.position.copy(home.pos);
    cat.group.rotation.y = home.yaw;
    cat.group.visible = !home.hidden;
    pose = state; wait = 0; held = false; seen = frame;
  };
  const atHome = () => !sceneMode && cat.group.visible === !home.hidden && cat.group.position.distanceTo(home.pos) < 1e-6;
  const tick = (dt, jellyPos) => {
    if (sceneMode) {
      sceneT += dt * (sceneMode === 'smack' ? smackRate : 1);
      if (sceneMode === 'walk') {
        const k = Math.min(1, sceneT / Math.max(.001, walkTime));
        const f = k * (walkPath.length - 1), i = Math.min(walkPath.length - 2, Math.floor(f));
        cat.group.position.lerpVectors(walkPath[i], walkPath[i + 1], f - i);
        if (k === 1) { sceneMode = 'await'; sceneT = 0; }
      }
      pose = sceneMode === 'smack' ? 'smack' : sceneMode === 'walk' ? 'walk' : 'curious';
      applyState(cat, pose, sceneMode === 'await' ? t + sceneT : sceneT);
      return pose;
    }
    if (!cat.group.visible) return pose;
    frame++;
    if (asleep) {
      t += dt;
      if (calm()) { if (!held) { applyState(cat, 'sleep', 0); held = true; } return pose; }
      held = false;
      wait -= dt;
      if (frame - seen > 2 || wait > 0) return pose;
      wait = 1 / rate;
      applyState(cat, 'sleep', t);
      return pose;
    }
    t += dt; left -= dt;
    const gp = cat.group.position;
    const near = jellyPos ? Math.hypot(jellyPos.x - gp.x, jellyPos.z - gp.z) : 99;
    if (near < 0.5) {
      state = state === 'loaf' ? 'sit' : 'curious';
    } else {
      if (left <= 0) { step = (step + 1) % ROUTINE.length; left = ROUTINE[step][1]; }
      state = ROUTINE[step][0];
    }
    let gaze = null;
    if (jellyPos && near < 1.4 && state !== 'loaf' && state !== 'stretch') {
      cat.bones.head.getWorldPosition(_gazeH);
      gaze = _gazeD.copy(jellyPos).sub(_gazeH).applyAxisAngle(UP, -cat.group.rotation.y).add(_gazeH);
    }
    applyState(cat, state, t, gaze ? { gaze } : {});
    pose = state;
    return pose;
  };
  return { ...cat, tick, state: () => pose, placeForSmack, approach, beginSmack, endScene, atHome, asleep, home };
}
