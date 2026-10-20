// Dendi, the apartment's cat: a rigged, skinned three.js model of Chandan's
// brown mackerel tabby — bold black dorsal stripe, green eyes, black bow
// collar — painted procedurally from photos of the real cat. One SkinnedMesh
// (procedurally built and weighted), rigid attachments (eyes, nose, whiskers,
// collar) parented to bones, procedural poses for idle / curious / walk /
// trot / sit / loaf / stretch. Real scale, in metres: shoulder ~0.26 m.
// Faces +Z. In the game he is never seen during a run — he exists hidden
// and shows up only to finish a boss (see addDendi below); the apartment
// exporter drops the source scene's own cat, so the game builds this one
// at runtime instead.

import * as THREE from 'three';

// ---------------------------------------------------------------- bones
// name, parent, local position (bind pose). Legs hang down (-Y) from their
// joints; the tail chain curves up behind the hips.
const BONES = [
  ['hips', null, [0, 0.238, -0.125]],
  ['spine', 'hips', [0, 0.008, 0.085]],
  ['chest', 'spine', [0, 0.006, 0.095]],
  ['neck', 'chest', [0, 0.027, 0.062]],
  ['head', 'neck', [0, 0.038, 0.042]],
  ['earL', 'head', [0.033, 0.042, -0.006]],
  ['earR', 'head', [-0.033, 0.042, -0.006]],
  ['jaw', 'head', [0, -0.026, 0.018]],
  ['legFL0', 'chest', [0.05, -0.038, 0.048]],   // front-left upper
  ['legFL1', 'legFL0', [0, -0.112, 0.004]],     // front-left lower
  ['legFL2', 'legFL1', [0, -0.1, 0.006]],       // front-left paw
  ['legFR0', 'chest', [-0.05, -0.038, 0.048]],
  ['legFR1', 'legFR0', [0, -0.112, 0.004]],
  ['legFR2', 'legFR1', [0, -0.1, 0.006]],
  ['legHL0', 'hips', [0.056, -0.02, -0.018]],   // hind-left thigh
  ['legHL1', 'legHL0', [0.002, -0.108, 0.012]], // hind-left shin
  ['legHL2', 'legHL1', [0, -0.1, 0.014]],       // hind-left paw
  ['legHR0', 'hips', [-0.056, -0.02, -0.018]],
  ['legHR1', 'legHR0', [-0.002, -0.108, 0.012]],
  ['legHR2', 'legHR1', [0, -0.1, 0.014]],
  ['tail0', 'hips', [0, 0.028, -0.052]],
  ['tail1', 'tail0', [0, 0.026, -0.046]],
  ['tail2', 'tail1', [0, 0.032, -0.04]],
  ['tail3', 'tail2', [0, 0.036, -0.03]],
  ['tail4', 'tail3', [0, 0.036, -0.02]],
  ['tail5', 'tail4', [0, 0.034, -0.01]],
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
// Each part geometry is painted with weights by a function of bind position,
// then merged. fn(x, y, z) returns [[boneName, weight], ...]; the result is
// normalised and capped at 4 influences.
const _idx = new Map(BONE_NAMES.map((n, i) => [n, i]));
function paintWeights(geo, fn) {
  const pos = geo.attributes.position, n = pos.count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const raw = fn(pos.getX(i), pos.getY(i), pos.getZ(i)).filter(([, w]) => w > 0.001);
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
const blend = (a, b, t) => [[a, 1 - t], [b, t]];
const sstep = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Torso weights run along Z: hips at the rear, chest at the front, the neck
// taking over as the body rises into it.
function torsoWeights(x, y, z) {
  if (z < -0.045) return blend('hips', 'spine', sstep(z, -0.085, -0.02));
  if (z < 0.045) return blend('spine', 'chest', sstep(z, -0.01, 0.07));
  return blend('chest', 'neck', sstep(z, 0.075, 0.14) * sstep(y, 0.21, 0.27));
}
// A leg: upper bone above the joint, lower below it, paw at the foot, with
// 2 cm smooth bands across each joint.
function legWeights(joint1Y, joint2Y, b0, b1, b2) {
  return (x, y) => {
    if (y > joint1Y) return blend(b0, b1, sstep(joint1Y + 0.012 - y, 0, 0.024));
    if (y > joint2Y) return blend(b1, b2, sstep(joint2Y + 0.012 - y, 0, 0.024));
    return [[b2, 1]];
  };
}
// Tail segment i of 6: blends bone i into i+1 along its length.
function tailWeights(seg) {
  return (x, y, z) => blend(`tail${seg}`, `tail${Math.min(5, seg + 1)}`, 0.5);
}

// ------------------------------------------------------------ geometry
// A part: geometry built in bind (world) space, transformed, weighted, kept
// for the merge. All primitives are built non-indexed-friendly via toNonIndexed
// only when merging demands it — mergeGeometries handles indexed if all are.
function part(geo, matrix, weights, group = 0) {
  geo.applyMatrix4(matrix);
  if (weights) paintWeights(geo, weights);
  geo.userData.group = group;
  return geo;
}
const M4 = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz));
  return m;
};
// world positions of the joints, for building parts in bind space
function jointWorld(bones, name) {
  const v = new THREE.Vector3();
  bones[name].getWorldPosition(v);
  return v;
}

function buildBodyGeometry(bones) {
  const parts = [];
  // Torso: a lathe profile (rear -> chest) rotated to lie along Z. The
  // profile gives the cat a deep chest, a slight waist and round hips.
  const profile = [
    [0.0, -0.215], [0.034, -0.208], [0.055, -0.19], [0.064, -0.16],
    [0.066, -0.11], [0.06, -0.05], [0.058, 0.0], [0.062, 0.045],
    [0.068, 0.08], [0.066, 0.105], [0.052, 0.128], [0.03, 0.142], [0.0, 0.146],
  ].map(([r, z]) => new THREE.Vector2(r, z));
  const lathe = new THREE.LatheGeometry(profile, 40);
  // lathe turns around Y with the profile as height: rotateX(+90deg) sends
  // that height to +Z (chest end forward), ring radius to X/Y. No flip.
  lathe.rotateX(Math.PI / 2);
  lathe.translate(0, 0.238, 0);
  // Belly tuck: a lathe is radially symmetric, but a cat's belly rises
  // toward the rear while the chest stays deep. Pull lower verts up.
  {
    const p = lathe.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), z = p.getZ(i);
      if (y < 0.238) p.setY(i, 0.238 - (0.238 - y) * (0.8 + 0.2 * sstep(z, -0.16, 0.1)));
    }
    lathe.computeVertexNormals();
  }
  parts.push(part(lathe, new THREE.Matrix4(), torsoWeights, 0));

  // Chest/brisket fullness low at the front, and a neck wedge up to the head.
  parts.push(part(new THREE.SphereGeometry(0.058, 24, 18),
    M4(0, 0.222, 0.075, 0.92, 1.0, 1.05), torsoWeights, 0));
  parts.push(part(new THREE.CylinderGeometry(0.031, 0.044, 0.09, 20),
    M4(0, 0.27, 0.124, 1, 1, 1, 0.6), (x, y, z) => blend('neck', 'head', sstep(z, 0.14, 0.185)), 0));

  // Head: skull, cheeks, muzzle, jaw. Group 1 (face texture).
  const headW = () => [['head', 1]];
  parts.push(part(new THREE.SphereGeometry(0.052, 28, 22),
    M4(0, 0.318, 0.185, 1.0, 0.94, 1.04), headW, 1));
  parts.push(part(new THREE.SphereGeometry(0.039, 22, 16),
    M4(0, 0.302, 0.192, 1.14, 0.74, 0.92), headW, 1)); // cheeks
  parts.push(part(new THREE.SphereGeometry(0.023, 20, 14),
    M4(0, 0.296, 0.22, 1.08, 0.7, 0.88), headW, 1)); // muzzle
  parts.push(part(new THREE.SphereGeometry(0.0145, 16, 12),
    M4(0, 0.2845, 0.212, 1.0, 0.55, 0.85), () => [['jaw', 1]], 1)); // jaw/chin

  // Ears: flattened cones, skinned to their own bones so they can swivel.
  for (const s of [1, -1]) {
    const earW = () => [[s > 0 ? 'earL' : 'earR', 1]];
    const base = jointWorld(bones, s > 0 ? 'earL' : 'earR');
    parts.push(part(new THREE.ConeGeometry(0.023, 0.046, 14),
      M4(base.x, base.y + 0.018, base.z, 1, 1, 0.52, -0.1, 0, s * -0.22), earW, 1));
  }

  // Legs: upper capsule, lower capsule, paw with toes.
  const legs = [
    ['FL', 0.05, 0.048], ['FR', -0.05, 0.048], ['HL', 0.056, -0.143], ['HR', -0.056, -0.143],
  ];
  for (const [tag, lx, lz] of legs) {
    const front = tag[0] === 'F';
    const b0 = `leg${tag}0`, b1 = `leg${tag}1`, b2 = `leg${tag}2`;
    const top = jointWorld(bones, b0), mid = jointWorld(bones, b1), low = jointWorld(bones, b2);
    const w = legWeights(mid.y, low.y, b0, b1, b2);
    const rUp = front ? 0.0185 : 0.028;
    // The hind thigh slants to meet its shin joint (which sits forward of
    // the hip); a straight vertical capsule leaves a visible step there.
    parts.push(part(new THREE.CapsuleGeometry(rUp, front ? 0.075 : 0.085, 6, 14),
      M4(top.x, (top.y + mid.y) / 2 + (front ? 0.012 : 0.014), (top.z + mid.z) / 2,
        front ? 1 : 1.1, 1, front ? 1 : 1.3, front ? 0 : -0.11), w, 2));
    parts.push(part(new THREE.CapsuleGeometry(front ? 0.0135 : 0.015, 0.07, 6, 12),
      M4(mid.x, (mid.y + low.y) / 2 + 0.01, mid.z), w, 2));
    // Elbow/hock ball: fills the pinched waist where the thin lower leg
    // meets the upper, so the joint reads as one limb from any angle.
    parts.push(part(new THREE.SphereGeometry(front ? 0.0165 : 0.02, 14, 10),
      M4(mid.x, mid.y + 0.004, mid.z, 1, 0.92, 1), (x, y) => blend(b0, b1, 0.45), 2));
    // paw: a rounded, slightly forward foot + three toe bumps
    parts.push(part(new THREE.SphereGeometry(0.0165, 16, 12),
      M4(low.x, 0.013, low.z + 0.008, 1.05, 0.62, 1.45), w, 2));
    for (let tI = -1; tI <= 1; tI++)
      parts.push(part(new THREE.SphereGeometry(0.0058, 10, 8),
        M4(low.x + tI * 0.0095, 0.010, low.z + 0.026), w, 2));
  }

  // Tail: six tapered segments following the bind curve of the tail bones.
  for (let i = 0; i < 6; i++) {
    const a = jointWorld(bones, `tail${i}`);
    const b = i < 5 ? jointWorld(bones, `tail${i + 1}`) : a.clone().add(new THREE.Vector3(0, 0.036, -0.008));
    const midP = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a);
    const len = dir.length();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const m = new THREE.Matrix4().compose(midP, quat, new THREE.Vector3(1, 1, 1));
    const r = 0.0155 - i * 0.0013;
    parts.push(part(new THREE.CylinderGeometry(r * 0.86, r, len + 0.012, 12), m, tailWeights(i), 3));
  }
  return parts;
}


// ------------------------------------------------------------- assembly
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Attachments are rigid meshes parented to bones: positions are given in
// head/neck bone space (computed from the bind-pose world offsets above).
function buildAttachments(bones, mats) {
  const head = bones.head, neck = bones.neck;
  const out = {};
  // Eyes: a glossy dark ball, an iris disc, a pupil ellipse whose width the
  // caller can drive (slit <-> round "boba"), and a painted-on highlight.
  for (const s of [1, -1]) {
    const g = new THREE.Group();
    g.position.set(s * 0.0238, 0.005, 0.0675);
    g.rotation.y = s * 0.18;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0122, 18, 14), mats.eyeBall);
    ball.scale.set(1, 1, 0.62);
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0098, 24), mats.iris);
    iris.position.z = 0.0072;
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.0082, 24), mats.pupil);
    pupil.position.z = 0.0079;
    pupil.scale.set(0.3, 1, 1);
    const glint = new THREE.Mesh(new THREE.CircleGeometry(0.0024, 10), mats.glint);
    glint.position.set(-0.003, 0.0035, 0.0086);
    g.add(ball, iris, pupil, glint);
    head.add(g);
    out[s > 0 ? 'eyeL' : 'eyeR'] = g;
    out[s > 0 ? 'pupilL' : 'pupilR'] = pupil;
  }
  // Inner ears: small pale-pink cones inset in the ear cones.
  for (const s of [1, -1]) {
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.0115, 0.03, 10), mats.innerEar);
    inner.position.set(0, 0.017, 0.0042);
    inner.scale.set(1, 1, 0.4);
    inner.rotation.x = -0.1;
    bones[s > 0 ? 'earL' : 'earR'].add(inner);
  }
  // Nose: a soft pink-brown triangle-ish pad on the muzzle front.
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.0062, 12, 10), mats.nose);
  nose.position.set(0, -0.008, 0.079);
  nose.scale.set(1.15, 0.62, 0.62);
  head.add(nose);
  // Whiskers: four per side, fanning from the whisker pad. Roots are placed
  // ON the muzzle ellipsoid's surface (centre (0,-0.008,0.059), radii
  // (0.0248, 0.0161, 0.0202) in head space) and pushed 4 mm in along the
  // whisker's own direction, so every root is buried in fur — the earlier
  // fixed grid left the lower roots floating off the muzzle's curve.
  const whiskerMat = mats.whisker;
  const MUZ = { c: new THREE.Vector3(0, -0.008, 0.059), r: new THREE.Vector3(0.0248, 0.0161, 0.0202) };
  const FAN = [ // per-whisker fan direction (before the side mirror) + length
    { d: [0.90, 0.14, 0.40], len: 0.058 },
    { d: [0.96, 0.04, 0.26], len: 0.070 },
    { d: [0.98, -0.07, 0.17], len: 0.074 },
    { d: [0.93, -0.20, 0.28], len: 0.062 },
  ];
  const PAD_Y = [0.006, 0.001, -0.004, -0.009]; // root heights on the pad
  const whiskerGeos = []; // all eight whiskers merge into one mesh (one draw call)
  for (const s of [1, -1]) for (let i = 0; i < 4; i++) {
    const dir = new THREE.Vector3(s * FAN[i].d[0], FAN[i].d[1], FAN[i].d[2]).normalize();
    // root: exact point on the muzzle ellipsoid at this row's height, on
    // the front-side corner (52° around from the nose) where the pad sits
    const dy = PAD_Y[i], shrink = Math.sqrt(1 - (dy / MUZ.r.y) ** 2), th = 0.91;
    const root = new THREE.Vector3(
      MUZ.c.x + s * MUZ.r.x * shrink * Math.sin(th),
      MUZ.c.y + dy,
      MUZ.c.z + MUZ.r.z * shrink * Math.cos(th));
    root.sub(dir.clone().multiplyScalar(0.004)); // bury the root
    const len = FAN[i].len;
    const g = new THREE.CylinderGeometry(0.0005, 0.00015, len, 5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const mid = root.clone().add(dir.clone().multiplyScalar(len / 2));
    g.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
    whiskerGeos.push(g);
  }
  head.add(new THREE.Mesh(mergeGeometries(whiskerGeos), whiskerMat));
  // Collar + bow (from the bed photo): a black band, two bow wings, a knot —
  // one material, so the four pieces merge into a single mesh.
  const collar = new THREE.Group();
  collar.position.set(0, 0.01, 0.004);
  collar.rotation.x = 1.02;
  const dummy = new THREE.Object3D();
  const bowM = new THREE.Matrix4().makeRotationX(-1.02).setPosition(0, -0.0405, 0.008);
  const collarGeos = [new THREE.TorusGeometry(0.039, 0.0052, 10, 32)];
  for (const s of [1, -1]) {
    const wing = new THREE.ConeGeometry(0.0075, 0.02, 10);
    dummy.position.set(s * 0.0105, 0, 0);
    dummy.rotation.set(0, 0, s * (Math.PI / 2 + 0.35));
    dummy.scale.set(1, 1, 0.45);
    dummy.updateMatrix();
    wing.applyMatrix4(new THREE.Matrix4().multiplyMatrices(bowM, dummy.matrix));
    collarGeos.push(wing);
  }
  const knot = new THREE.SphereGeometry(0.0048, 10, 8);
  knot.applyMatrix4(bowM);
  collarGeos.push(knot);
  collar.add(new THREE.Mesh(mergeGeometries(collarGeos), mats.collar));
  neck.add(collar);
  out.collar = collar;
  return out;
}

// Placeholder materials: flat greys until the paint step. The texture step
// replaces fur/face/legs/tail and iris with canvas-painted versions.
export function greyMaterials() {
  const std = (color, roughness = 0.95) => new THREE.MeshStandardMaterial({ color, roughness });
  return {
    groups: [std(0x9a8f83), std(0xa39a8d), std(0x95897c), std(0x9a8f83)],
    eyeBall: std(0x1a1512, 0.25),
    iris: std(0x5a7038, 0.3),
    pupil: new THREE.MeshBasicMaterial({ color: 0x050505 }),
    glint: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    nose: std(0x9c6a62, 0.6),
    whisker: std(0xe8e4da, 0.6),
    collar: std(0x17171a, 0.5),
    innerEar: std(0x8a6f66, 0.85),
  };
}

export function buildCat(mats = greyMaterials()) {
  const { bones, list, root } = buildSkeleton();
  const group = new THREE.Group();
  group.add(root);
  group.updateMatrixWorld(true);
  const geos = buildBodyGeometry(bones);
  // Merge per material class first (mergeGeometries makes one group per
  // input geometry, so a single merge would invent 39 materials), then
  // merge the four class results with groups for the material array.
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
// His markings, from the photos: warm brown-grey agouti coat, pale belly and
// chin, a bold jet-black dorsal stripe (rear photo), mackerel flank bars,
// banded legs, a ringed tail with a dark tip, green eyes. Textures are
// painted in each part class's own UV space:
//   torso lathe: u goes belly(0) -> left flank(.25) -> back(.5) -> right
//     flank(.75) -> belly(1); v runs rear(0) -> chest(1).
//   skull sphere: the face looks out of u=.25, v=.5.
//   legs: v runs along the capsule; bands are constant-v stripes.
//   tail cylinders: v runs along each segment; two rings per segment.
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
// agouti hair: thousands of short strokes in ticked colours over a base
function hair(ctx, w, h, base, palette, n = 9000, len = 9) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const a = Math.PI / 2 + (Math.random() - 0.5) * 0.5;
    const l = len * (0.6 + Math.random() * 0.8);
    ctx.strokeStyle = palette[i % palette.length];
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
}
const AGOUTI = ['rgba(30,24,18,0.5)', 'rgba(190,160,120,0.42)', 'rgba(120,100,74,0.45)', 'rgba(224,206,172,0.3)'];
const softBar = (ctx, x0, y0, x1, y1, width, color, alpha) => {
  ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.globalAlpha = 1;
};

export function paintMaterials() {
  // ---- torso
  const torsoTex = canvasTex(1024, 512, (ctx, w, h) => {
    const U = (u) => u * w, V = (v) => (1 - v) * h;
    // base gradient around the body: belly cream -> flank -> darker back
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0.0, '#c9b696'); g.addColorStop(0.25, '#7c6247');
    g.addColorStop(0.5, '#5f4a35'); g.addColorStop(0.75, '#7c6247'); g.addColorStop(1.0, '#c9b696');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    hair(ctx, w, h, 'rgba(0,0,0,0)', AGOUTI, 3200, 7);
    // mackerel flank bars: strokes running from the back down each side,
    // at stations along the body (v), wavering as they descend
    for (const side of [1, -1]) {
      for (let i = 0; i < 8; i++) {
        const v = 0.10 + i * 0.105 + (Math.random() - 0.5) * 0.02;
        const uTop = 0.5 + side * 0.035, uBot = 0.5 + side * (0.30 + Math.random() * 0.06);
        ctx.strokeStyle = '#2e2620'; ctx.globalAlpha = 0.5 * (v < 0.25 ? 0.45 + v * 2.2 : v > 0.8 ? 0.6 : 1); ctx.lineWidth = 13 + Math.random() * 7; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(U(uTop), V(v));
        ctx.quadraticCurveTo(U((uTop + uBot) / 2 + side * 0.012), V(v - 0.012), U(uBot), V(v + 0.008));
        ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
    // the dorsal stripe: a bold black band down the spine
    const dg = ctx.createLinearGradient(U(0.44), 0, U(0.56), 0);
    dg.addColorStop(0, 'rgba(18,14,11,0)'); dg.addColorStop(0.2, 'rgba(18,14,11,0.94)');
    dg.addColorStop(0.8, 'rgba(18,14,11,0.94)'); dg.addColorStop(1, 'rgba(18,14,11,0)');
    ctx.fillStyle = dg;
    ctx.fillRect(U(0.44), V(0.97), U(0.56) - U(0.44), V(0.03) - V(0.97));
    // chest bib: pale, stripeless, toward the front-bottom of the neck end
    const cg = ctx.createRadialGradient(U(0.0), V(0.93), 10, U(0.0), V(0.93), 190);
    cg.addColorStop(0, 'rgba(216,200,168,0.85)'); cg.addColorStop(1, 'rgba(216,200,168,0)');
    ctx.fillStyle = cg; ctx.fillRect(0, V(1.0), w, V(0.78) - V(1.0));
  });
  // ---- face (skull sphere space: face centre u=.25, v=.5)
  const faceTex = canvasTex(512, 512, (ctx, w, h) => {
    const U = (u) => u * w, V = (v) => (1 - v) * h;
    hair(ctx, w, h, '#8a755c', AGOUTI, 7000, 8);
    // paler muzzle + chin zone
    let g = ctx.createRadialGradient(U(0.25), V(0.44), 8, U(0.25), V(0.44), 120);
    g.addColorStop(0, 'rgba(226,212,186,0.95)'); g.addColorStop(1, 'rgba(226,212,186,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // forehead M: four short bars above the eyes, splayed
    for (let i = -1.5; i <= 1.5; i++) {
      const u = 0.25 + i * 0.028;
      softBar(ctx, U(u - i * 0.004), V(0.755), U(u + i * 0.006), V(0.665), 9, '#241c14', 0.75);
    }
    // stripes sweeping back from the outer eye corners + cheek bars
    for (const s of [1, -1]) {
      softBar(ctx, U(0.25 + s * 0.052), V(0.565), U(0.25 + s * 0.115), V(0.60), 7, '#241c14', 0.6);
      softBar(ctx, U(0.25 + s * 0.058), V(0.50), U(0.25 + s * 0.125), V(0.505), 7, '#241c14', 0.55);
      softBar(ctx, U(0.25 + s * 0.05), V(0.435), U(0.25 + s * 0.115), V(0.45), 6, '#241c14', 0.45);
    }
    // faint tabby bars on the ears' share of the map (top region)
    for (let i = 0; i < 5; i++) softBar(ctx, U(0.55 + i * 0.001), V(0.97 - i * 0.055), U(0.72), V(0.955 - i * 0.055), 8, '#241c14', 0.4);
  });
  // ---- legs: bands around the lower leg, paler paw
  const legTex = canvasTex(256, 256, (ctx, w, h) => {
    hair(ctx, w, h, '#79644c', AGOUTI, 2600, 7);
    for (let i = 0; i < 4; i++) {
      const y = h * (0.52 + i * 0.115);
      ctx.fillStyle = 'rgba(34,27,20,0.62)';
      ctx.fillRect(0, y, w, h * 0.052);
    }
    const g = ctx.createLinearGradient(0, h * 0.86, 0, h);
    g.addColorStop(0, 'rgba(216,200,168,0)'); g.addColorStop(1, 'rgba(216,200,168,0.75)');
    ctx.fillStyle = g; ctx.fillRect(0, h * 0.86, w, h * 0.14);
  });
  // ---- tail: two rings per segment, darkening toward the tip of the map
  const tailTex = canvasTex(256, 256, (ctx, w, h) => {
    hair(ctx, w, h, '#715c46', AGOUTI, 2600, 7);
    for (const v of [0.30, 0.68]) {
      ctx.fillStyle = 'rgba(26,20,15,0.66)';
      ctx.fillRect(0, h * v, w, h * 0.13);
    }
  });
  const irisTex = canvasTex(128, 128, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2, r = w * 0.48;
    const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#8fae4e'); g.addColorStop(0.45, '#a9bc5e');
    g.addColorStop(0.8, '#77662f'); g.addColorStop(0.96, '#221a10'); g.addColorStop(1, '#0d0a06');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 150; i++) {
      const a = (i / 150) * Math.PI * 2;
      ctx.strokeStyle = i % 2 ? 'rgba(50,66,22,0.35)' : 'rgba(226,236,150,0.28)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.18, cy + Math.sin(a) * r * 0.18);
      ctx.lineTo(cx + Math.cos(a) * r * 0.94, cy + Math.sin(a) * r * 0.94); ctx.stroke();
    }
  });
  const fur = (map) => new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.25, roughness: 0.94 });
  const std = (color, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, roughness });
  return {
    groups: [fur(torsoTex), fur(faceTex), fur(legTex), fur(tailTex)],
    eyeBall: std(0x17120e, 0.18),
    iris: new THREE.MeshStandardMaterial({ map: irisTex, roughness: 0.25 }),
    pupil: new THREE.MeshBasicMaterial({ color: 0x050505 }),
    glint: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    nose: std(0x96625c, 0.55),
    whisker: std(0xe9e5db, 0.6),
    collar: std(0x17171a, 0.45),
    innerEar: std(0xb08276, 0.85),
  };
}


// ------------------------------------------------------------ animation
// Procedural states. Every frame starts from the bind pose, then the state
// function adds its motion — the same function drives the live preview and
// the baked GLB clips, so what you see is what exports. Root motion goes
// through the hips bone (never the group) so clips carry it.
const BIND_HIPS = new THREE.Vector3(0, 0.238, -0.125);
function resetPose(cat) {
  for (const b of Object.values(cat.bones)) b.rotation.set(0, 0, 0);
  cat.bones.hips.position.copy(BIND_HIPS);
}
const R = (b, x = 0, y = 0, z = 0) => { b.rotation.x += x; b.rotation.y += y; b.rotation.z += z; };
// deterministic little wander for idle head motion
const wander = (t, a, b) => Math.sin(t * a) * 0.6 + Math.sin(t * b + 1.7) * 0.4;

function tailWave(cat, t, amp = 0.06, freq = 1.6, lift = 0) {
  const B = cat.bones;
  for (let i = 0; i < 6; i++) {
    R(B[`tail${i}`], lift * (i === 0 ? 1 : 0.35), 0, Math.sin(t * freq - i * 0.55) * amp * (0.4 + i * 0.16));
  }
}
// The tail in sit/loaf: hang it down behind the hips, then curl it forward
// along the ground around the cat's right side (side = how strong the
// sideways curl is). Yawing the chain does nothing — it points up — so the
// wrap is built from pitch (x) plus a sideways bend (z) per segment.
function tailHangCurl(cat, side = 0.3) {
  const B = cat.bones;
  R(B.tail0, -1.5, 0, -0.15 * side);
  R(B.tail1, -0.55, 0, -0.85 * side);
  R(B.tail2, -0.5, 0, -0.9 * side);
  R(B.tail3, -0.45, 0, -0.5 * side);
  R(B.tail4, -0.3, 0, -0.2 * side);
  R(B.tail5, -0.2, 0, 0);
}
function blinkAndPupils(cat, t, pupil = 0.45, lid = 1) {
  const cyc = t % 3.7;
  const b = cyc < 0.13 ? Math.sin((cyc / 0.13) * Math.PI) : 0; // 0..1 blink
  for (const e of [cat.attachments.eyeL, cat.attachments.eyeR]) e.scale.y = lid * (1 - 0.92 * b);
  for (const p of [cat.attachments.pupilL, cat.attachments.pupilR]) p.scale.x = pupil;
}
// one leg's gait: phase-offset swings for upper/lower/paw
function gaitLeg(cat, tag, ph, amp, liftAmp) {
  const B = cat.bones;
  R(B[`leg${tag}0`], amp * Math.sin(ph));
  R(B[`leg${tag}1`], liftAmp * Math.max(0, Math.sin(ph - 0.7)) + 0.08 * Math.sin(ph));
  R(B[`leg${tag}2`], -amp * 0.55 * Math.sin(ph) - liftAmp * 0.5 * Math.max(0, Math.sin(ph - 0.7)));
}

export const STATE_NAMES = ['idle', 'curious', 'walk', 'trot', 'sit', 'loaf', 'stretch', 'smack'];
export function applyState(cat, state, t, opts = {}) {
  const B = cat.bones;
  resetPose(cat);
  const breathe = Math.sin(t * 1.9) * 0.012;
  switch (state) {
    case 'idle': {
      R(B.spine, breathe, 0, 0); R(B.chest, -breathe * 0.7, 0, 0);
      R(B.neck, wander(t, 0.23, 0.11) * 0.05, wander(t, 0.17, 0.31) * 0.16, 0);
      R(B.head, -wander(t, 0.23, 0.11) * 0.03, wander(t, 0.13, 0.29) * 0.10, wander(t, 0.07, 0.19) * 0.05);
      if (Math.sin(t * 0.43) > 0.965) R(B.earL, -0.3, 0, 0.15); // ear twitch, now and then
      tailWave(cat, t, 0.055, 1.4);
      blinkAndPupils(cat, t, 0.45);
      break;
    }
    case 'curious': {
      R(B.neck, -0.26, 0, 0); R(B.head, -0.22, 0, 0.13); // head up, tilted — his photo face
      R(B.earL, -0.28, 0, 0.06); R(B.earR, -0.28, 0, -0.06);
      R(B.chest, -0.05 + breathe, 0, 0);
      tailWave(cat, t, 0.04, 1.8, -0.06);
      blinkAndPupils(cat, t, 0.8);
      break;
    }
    case 'walk': case 'trot': {
      const trot = state === 'trot';
      const f = trot ? 2.6 : 1.6, ph = t * Math.PI * 2 * f;
      const amp = trot ? 0.5 : 0.38, lift = trot ? 0.65 : 0.5;
      gaitLeg(cat, 'FL', ph, amp, lift); gaitLeg(cat, 'HR', ph, amp * 0.92, lift * 0.9);
      gaitLeg(cat, 'FR', ph + Math.PI, amp, lift); gaitLeg(cat, 'HL', ph + Math.PI, amp * 0.92, lift * 0.9);
      B.hips.position.y += Math.sin(ph * 2) * (trot ? 0.0075 : 0.0045);
      R(B.spine, Math.sin(ph * 2) * 0.02, 0, Math.sin(ph) * 0.018);
      R(B.chest, -Math.sin(ph * 2) * 0.015, 0, -Math.sin(ph) * 0.014);
      R(B.neck, -0.06 + Math.sin(ph * 2 + 0.6) * 0.02, 0, 0);
      R(B.head, 0.05, 0, 0);
      tailWave(cat, t, 0.05, f * 1.6, -0.12);
      blinkAndPupils(cat, t, 0.5);
      break;
    }
    case 'sit': {
      B.hips.position.y -= 0.188; B.hips.position.z -= 0.015;
      // the upright sit comes from pitching the hips themselves; the spine
      // adds a little, the neck/head level out, the front legs counter-pitch
      R(B.hips, -0.40, 0, 0);
      R(B.spine, -0.18, 0, 0); R(B.chest, -0.14, 0, 0);
      R(B.neck, 0.40, 0, 0); R(B.head, 0.30 + breathe * 2, wander(t, 0.17, 0.31) * 0.07, 0.03);
      for (const s of ['L', 'R']) {
        R(B[`legH${s}0`], -0.95, 0, s === 'L' ? 0.06 : -0.06);
        R(B[`legH${s}1`], 2.15, 0, 0);
        R(B[`legH${s}2`], -1.05, 0, 0);
        R(B[`legF${s}0`], 0.66, 0, 0); R(B[`legF${s}1`], 0.05, 0, 0);
      }
      tailHangCurl(cat, 0.3);
      blinkAndPupils(cat, t, 0.5);
      break;
    }
    case 'loaf': {
      B.hips.position.y -= 0.138;
      R(B.hips, 0.03, 0, 0); R(B.spine, 0.05 + breathe, 0, 0); R(B.chest, 0.03, 0, 0);
      R(B.neck, -0.04, 0, 0); R(B.head, 0.03, wander(t, 0.13, 0.27) * 0.06, 0);
      for (const s of ['L', 'R']) {
        // everything folds under the settled body: front shins tuck back
        // under the chest, hind feet fold under their thighs
        R(B[`legF${s}0`], -0.12, 0, 0); R(B[`legF${s}1`], 2.85, 0, 0); R(B[`legF${s}2`], -0.5, 0, 0);
        R(B[`legH${s}0`], -1.30, 0, s === 'L' ? 0.05 : -0.05); R(B[`legH${s}1`], 2.75, 0, 0); R(B[`legH${s}2`], -1.1, 0, 0);
      }
      tailHangCurl(cat, 0.45);
      blinkAndPupils(cat, t, 0.34, 0.82); // sleepy loaf
      break;
    }
    case 'smack': {
      // one decisive paw chop (the boss finish): cock the right paw up
      // beside his head, slam it down-forward — contact at ~0.25 s — then
      // settle. Ears back, tail lashing, the other front leg braced.
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
      blinkAndPupils(cat, t, 0.92);
      break;
    }
    case 'stretch': {
      // a slow in-and-out envelope over the loop: down, hold, release
      const cyc = (t % 3.2) / 3.2;
      const k = cyc < 0.3 ? sstep(cyc, 0, 0.3) : cyc < 0.72 ? 1 : 1 - sstep(cyc, 0.72, 1);
      B.hips.position.y -= 0.052 * k; B.hips.position.z -= 0.01 * k;
      R(B.hips, 0.30 * k, 0, 0); R(B.spine, 0.22 * k, 0, 0); R(B.chest, 0.16 * k, 0, 0);
      R(B.neck, -0.18 * k, 0, 0); R(B.head, -0.06 * k, 0, 0);
      for (const s of ['L', 'R']) {
        R(B[`legF${s}0`], -0.95 * k, 0, 0); R(B[`legF${s}1`], -0.12 * k, 0, 0); R(B[`legF${s}2`], 0.35 * k, 0, 0);
        R(B[`legH${s}0`], 0.38 * k, 0, 0); R(B[`legH${s}1`], 0.22 * k, 0, 0); R(B[`legH${s}2`], -0.3 * k, 0, 0);
      }
      tailWave(cat, t, 0.03, 1.2, -0.35 * k);
      blinkAndPupils(cat, t, 0.42);
      break;
    }
  }
  // gaze: turn the head (and a little neck) toward a world point, clamped
  // (the game also lets a sitting cat track the jelly — see addDendi)
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
// addDendi builds him hidden (both boss stages): the boss finish is the
// only time he is ever seen — main.js places him beside the doomed boss
// (placeForSmack), the paw lands (beginSmack), and endScene hides him
// again and puts him back. A slow pose routine (loaf / idle / sit /
// curious, watching a near jelly) is kept for if he is ever placed
// visibly; while hidden his tick costs nothing. Nothing he is made of
// collides (noCollide throughout), and the camera fade ignores him.
const ROUTINE = [['loaf', 26], ['idle', 9], ['sit', 14], ['idle', 7], ['loaf', 20], ['stretch', 6.4], ['sit', 11]];
const _gazeD = new THREE.Vector3(), _gazeH = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
export function addDendi(scene, at, yaw = 0, opts = {}) {
  const cat = buildCat(paintMaterials());
  cat.group.position.copy(at);
  cat.group.rotation.y = yaw;
  cat.group.traverse((o) => { o.userData.noCollide = true; });
  if (opts.hidden) cat.group.visible = false;   // Act 2: he exists only for the boss finish
  scene.add(cat.group);
  let t = Math.random() * 10, step = 0, left = ROUTINE[0][1], state = ROUTINE[0][0], pose = state;
  // The boss finish (main.js runs the scene): placeForSmack puts him beside
  // the doomed boss, beginSmack starts the chop, endScene hands him back.
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
  // the scene over: back to his creation transform and visibility (in the
  // game: hidden — he only ever showed up for the smack)
  const endScene = () => {
    sceneMode = null;
    cat.group.position.copy(home.pos);
    cat.group.rotation.y = home.yaw;
    cat.group.visible = !home.hidden;
  };
  const tick = (dt, jellyPos) => {
    if (sceneMode) {
      sceneT += dt * (sceneMode === 'smack' ? smackRate : 1);
      if (sceneMode === 'walk') {
        const k = Math.min(1, sceneT / Math.max(.001, walkTime));
        const f = k * (walkPath.length-1), i = Math.min(walkPath.length-2,Math.floor(f));
        cat.group.position.lerpVectors(walkPath[i], walkPath[i+1], f-i);
        if (k === 1) { sceneMode = 'await'; sceneT = 0; }
      }
      pose = sceneMode === 'smack' ? 'smack' : sceneMode === 'walk' ? 'walk' : 'curious';
      applyState(cat, pose, sceneMode === 'await' ? t + sceneT : sceneT);
      return pose;
    }
    if (!cat.group.visible) return pose;
    t += dt; left -= dt;
    const gp = cat.group.position;
    const near = jellyPos ? Math.hypot(jellyPos.x - gp.x, jellyPos.z - gp.z) : 99;
    if (near < 0.5) {
      // a jelly at his feet: he sits up from a loaf first, then stands
      // curious if it stays — a one-frame loaf-to-standing pop reads wrong
      state = state === 'loaf' ? 'sit' : 'curious';
    } else {
      if (left <= 0) { step = (step + 1) % ROUTINE.length; left = ROUTINE[step][1]; }
      state = ROUTINE[step][0];
    }
    let gaze = null;
    if (jellyPos && near < 1.4 && state !== 'loaf' && state !== 'stretch') {
      // applyState aims the head in world directions; pre-rotate the target
      // by the group's own yaw so the local neck/head turns land on the jelly
      cat.bones.head.getWorldPosition(_gazeH);
      gaze = _gazeD.copy(jellyPos).sub(_gazeH).applyAxisAngle(UP, -cat.group.rotation.y).add(_gazeH);
    }
    applyState(cat, state, t, gaze ? { gaze } : {});
    pose = state;
    return pose;
  };
  return { ...cat, tick, state: () => pose, placeForSmack, approach, beginSmack, endScene };
}
