// The bugs: cockroaches, ants with pushpins, mosquitoes, the lanternfly, the house spider, the house fly, the dragonfly, the mantis and the worm inside it, the stag beetle. Procedural models with moving legs and
// wings, so you can see them scuttle, curl up and fly at you.
//
// Each builder returns { body, face, anim(dt, e) } in "radius units" (the enemy's collision
// radius is 1), facing +z; Enemies.spawn scales `body` to size. Everything that moves (and the
// eyes) lives in an inner group, so animation offsets stay in radius units and the eyes stay
// on the head. Geometry is built once per type
// and shared, and parts of the same material are merged, to keep draw calls down on phones.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { angryEyes, standOut } from './enemies.js';
import { LOOK } from './look.js';
import { hostile } from './vfx.js';
import { coil, eyes, heavy, knobs, lockBeat, mixPose, quiver, settle, snap, stretch } from './attack-motion.js';
import { spring } from './swim.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Give a geometry one flat vertex color and make it mergeable with the others
function tint(geo, hex) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { a[k * 3] = c.r; a[k * 3 + 1] = c.g; a[k * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
const ellipsoid = (sx, sy, sz, at, hex, seg = 16) => tint(new THREE.SphereGeometry(1, seg, Math.max(6, seg * 0.6)).scale(sx, sy, sz).translate(at.x, at.y, at.z), hex);
const tube = (pts, r, hex, segs = 12) => tint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, r, 5), hex);
// a tapered rod from a to b
function rod(a, b, r0, r1, hex) {
  const d = b.clone().sub(a), len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, 6, 1).translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
  g.translate(a.x, a.y, a.z);
  return tint(g, hex);
}
const merge = (parts) => { const g = mergeGeometries(parts); g.computeVertexNormals(); g.computeBoundingSphere(); return g; };

const MAT = {};
function mats() {
  MAT.shell ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.1 });
  MAT.matte ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 });
  MAT.wing ||= new THREE.MeshStandardMaterial({ color: 0xdfe8f0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, roughness: 0.1, depthWrite: false });
  const lit = { base: LOOK.num('bug-glow', 0.35), rim: LOOK.num('bug-rim', 0.8) };   // content/look.css
  standOut(MAT.shell, lit);     // brighter bugs: readable in the dark room
  standOut(MAT.matte, lit);
  standOut(MAT.wing, { base: 0.3, rim: 0.5 });
  return MAT;
}

// ------------------------------------------------------------------ cockroach
const GEO = {};
function roachGeometry() {
  const brown = '#4a2210', edge = '#8a4a1c', tan = '#b27a40', dark = '#241008';
  const body = [
    ellipsoid(0.5, 0.26, 0.95, V(0, 0.34, -0.35), dark),                 // abdomen
    ellipsoid(0.27, 0.12, 0.92, V(-0.25, 0.5, -0.3), brown),              // wing covers
    ellipsoid(0.27, 0.12, 0.92, V(0.25, 0.5, -0.3), brown),
    ellipsoid(0.52, 0.16, 0.36, V(0, 0.46, 0.5), tan),                    // pronotum shield, pale rim
    ellipsoid(0.36, 0.14, 0.26, V(0, 0.52, 0.5), edge),                   // ...dark middle
    ellipsoid(0.24, 0.2, 0.2, V(0, 0.34, 0.8), dark),                     // head
    rod(V(-0.12, 0.25, -1.2), V(-0.25, 0.22, -1.45), 0.04, 0.01, brown),  // cerci
    rod(V(0.12, 0.25, -1.2), V(0.25, 0.22, -1.45), 0.04, 0.01, brown),
  ];
  for (const s of [-1, 1]) body.push(tube([V(s * 0.08, 0.4, 0.92), V(s * 0.4, 0.6, 1.4), V(s * 0.9, 0.5, 1.6), V(s * 1.4, 0.35, 1.2)], 0.018, brown, 16));
  // a leg: femur out and up, tibia down to the ground, with little spines. Built at the hip.
  const leg = (s, reach) => merge([
    rod(V(0, 0, 0), V(s * 0.45, 0.14, 0), 0.07, 0.05, brown),
    rod(V(s * 0.45, 0.14, 0), V(s * reach, -0.33, 0), 0.05, 0.02, brown),
    rod(V(s * 0.6, 0.02, 0), V(s * 0.66, 0.12, 0.03), 0.015, 0.002, dark),
    rod(V(s * 0.75, -0.1, 0), V(s * 0.82, 0.0, 0.03), 0.015, 0.002, dark),
  ]);
  return { body: merge(body), legL: [leg(-1, 0.85), leg(-1, 0.95), leg(-1, 1.05)], legR: [leg(1, 0.85), leg(1, 0.95), leg(1, 1.05)] };
}

export function buildRoach() {
  const G = (GEO.roach ||= roachGeometry()), M = mats();
  const outer = new THREE.Group(), body = new THREE.Group();
  outer.add(body);
  const shell = new THREE.Mesh(G.body, M.shell);
  body.add(shell);
  const legs = [];
  [[G.legL, -1], [G.legR, 1]].forEach(([set, s]) => set.forEach((geo, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.22, 0.33, 0.35 - i * 0.38);
    pivot.rotation.y = s * (i - 1) * -0.5;           // front legs point forward, back legs back
    pivot.add(new THREE.Mesh(geo, M.shell));
    body.add(pivot);
    legs.push({ pivot, base: pivot.rotation.y, phase: (i + (s > 0 ? 1 : 0)) % 2 ? Math.PI : 0 });   // tripod gait
  }));
  // the eyes sit on the front of the head
  const face = angryEyes({ y: 0.4, z: 0.9, size: 0.17, gap: 0.14 });
  body.add(face);
  // antennae sweep on their own
  let t = 0, k = 0;
  // its nip (attack-motion "nip", src/attack-motion.js): close to you it leans in, head low; its touch landing jabs
  // the head forward, then it hops back and rocks (it has no wind-up, so none is added)
  const anim = (dt, e) => {
    const speed = Math.hypot(e.vel.x, e.vel.z);
    k += (Math.min(1, speed * 6) - k) * (1 - Math.exp(-8 * dt));   // smoothed, so it never flickers
    t += dt * (3 + 14 * k);                                           // legs cycle ~2.5 steps/s at full run
    for (const L of legs) {
      L.pivot.rotation.y = L.base + Math.sin(t + L.phase) * 0.4 * k;
      L.pivot.rotation.z = Math.max(0, Math.cos(t + L.phase)) * 0.25 * k * Math.sign(L.pivot.position.x);
    }
    const A = e.atk, ph = A ? A.phase : 'idle';
    let head = 0, jab = 0, len = 1;
    if (ph === 'build') head = 0.2 * coil(A.k, A.style.hold, A.style.over) * A.vary;
    else if (ph === 'swing') {
      const s = snap(Math.min(1, A.pt / A.style.strike), A.tier.over);
      head = 0.2 * A.vary * (1 - s) + 0.07 * s; jab = 0.18 * A.vary * s; len = 1 + (A.tier.stretch - 1) * Math.min(1, s);
    } else if (ph === 'recoil') {
      const b = settle(A.k, A.style.bounces, A.style.damp) * Math.min(1, A.pt / 0.04);
      jab = -0.15 * b; head = -0.12 * b * A.side;
    }
    body.position.y = Math.abs(Math.sin(t)) * 0.02 * k;              // radius units: a tiny lift per step
    body.position.z = jab;
    body.rotation.x = head;
    body.rotation.z = Math.sin(t) * 0.03 * k;                         // and a small waddle
    stretch(body, len);
    if (A) eyes(face, A);
  };
  anim.reset = () => { t = 0; k = 0; stretch(body, 1); body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); face.children.forEach((c) => { c.scale.y = 1; c.rotation.x = 0; }); };
  return { body: outer, face: new THREE.Group(), anim, deathParts: legs.map(L => L.pivot) };
}

// ------------------------------------------------------------------ ant
// A red wood ant with a red pushpin in its jaws (the owner's character sheet): a dark heart-shaped
// head with black eyes, elbowed antennae, a ridged red thorax on a narrow waist, a big banded dark
// gaster, and six long jointed legs. It throws the pin (the spit word, shot="pin") and a new one
// appears in its jaws. Each ant's pins are one of the --pin-colors (content/look.css).
const PIN = { steel: '#d4d8dc', size: 1.35 };
const pinColors = () => LOOK.list('pin-colors', ['#e01a1a']);
// the pushpin in colour i of --pin-colors, in the ant's radius units, gripped at z=0 with the needle
// out along +z (one geometry per colour, built once)
function pinGeometry(i) {
  const col = pinColors()[i] || '#e01a1a', dark = '#' + new THREE.Color(col).multiplyScalar(0.72).getHexString();
  const part = (g, hex) => tint(g.rotateX(Math.PI / 2), hex);
  return merge([
    ellipsoid(0.1, 0.1, 0.05, V(0, 0, 0), dark, 12),                                             // the grip's end
    part(new THREE.CylinderGeometry(0.08, 0.07, 0.24, 12).translate(0, 0.12, 0), col),             // the grip
    part(new THREE.CylinderGeometry(0.2, 0.08, 0.1, 14).translate(0, 0.29, 0), col),               // the flare to the head
    ellipsoid(0.25, 0.25, 0.05, V(0, 0, 0.36), col, 16),                                           // the flat head
    part(new THREE.CylinderGeometry(0.004, 0.025, 0.58, 6).translate(0, 0.67, 0), PIN.steel),      // the needle
  ]).scale(PIN.size, PIN.size, PIN.size);
}
function antGeometry() {
  const red = '#6e200e', head = '#561a0a', dark = '#22100a', band = '#6a3e1e', leg = '#621e0c', jaw = '#2e0c04';
  const body = [
    ellipsoid(0.38, 0.32, 0.5, V(0, 0.58, -0.88), dark),           // gaster
    ellipsoid(0.09, 0.15, 0.09, V(0, 0.6, -0.36), red),             // petiole node
    ellipsoid(0.13, 0.13, 0.14, V(0, 0.6, -0.22), red),             // propodeum
    ellipsoid(0.15, 0.14, 0.2, V(0, 0.64, -0.02), red),             // mesonotum
    ellipsoid(0.2, 0.18, 0.22, V(0, 0.68, 0.2), red),               // pronotum
    ellipsoid(0.08, 0.08, 0.1, V(0, 0.7, 0.4), red),                // neck
    ellipsoid(0.29, 0.26, 0.3, V(0, 0.78, 0.62), head),             // head
    ellipsoid(0.08, 0.09, 0.08, V(-0.25, 0.85, 0.66), '#0a0505', 10),  // eyes
    ellipsoid(0.08, 0.09, 0.08, V(0.25, 0.85, 0.66), '#0a0505', 10),
    ...[-1, 1].map((s) => rod(V(s * 0.15, 0.64, 0.82), V(s * 0.05, 0.6, 0.96), 0.05, 0.022, jaw)),   // mandibles
  ];
  for (const dz of [-0.62, -0.84, -1.06]) {                        // pale bands round the gaster
    const k = Math.sqrt(1 - ((dz + 0.88) / 0.5) ** 2);
    body.push(ellipsoid(0.385 * k, 0.325 * k, 0.03, V(0, 0.58, dz), band, 16));
  }
  // an elbowed antenna, built at its base on the head: a long scape up and out, the rest bent forward
  const antenna = (s) => merge([rod(V(0, 0, 0), V(s * 0.24, 0.34, 0.08), 0.025, 0.02, leg), tube([V(s * 0.24, 0.34, 0.08), V(s * 0.34, 0.42, 0.32), V(s * 0.4, 0.36, 0.6)], 0.016, leg, 8)]);
  // a leg built at its hip: femur up and out to the knee, tibia down, tarsus along the floor
  const legGeo = (s, f) => merge([
    rod(V(0, 0, 0), V(s * 0.45, 0.32, f * 0.3), 0.04, 0.03, leg),
    rod(V(s * 0.45, 0.32, f * 0.3), V(s * 0.8, -0.44, f * 0.6), 0.03, 0.02, leg),
    rod(V(s * 0.8, -0.44, f * 0.6), V(s * 0.92, -0.55, f * 0.72), 0.018, 0.01, jaw),
  ]);
  return { body: merge(body), antL: antenna(-1), antR: antenna(1), legGeo };
}

// a pin on its own in colour i, for a thrown one (enemies.js spit): in the ant's radius units
const pinGeo = (i) => (GEO['pin' + i] ||= pinGeometry(i));
export function buildPushpin(i = 0) { return new THREE.Mesh(pinGeo(i), mats().shell); }

// legs: [hip z, how far forward the foot reaches]
const ANT_LEGS = [[0.2, 1], [0.02, 0], [-0.16, -1]];
export function buildAnts() {
  const G = (GEO.ant ||= antGeometry()), M = mats();
  const outer = new THREE.Group(), body = new THREE.Group();
  outer.add(body);
  body.add(new THREE.Mesh(G.body, M.shell));
  outer.userData.pin = Math.floor(Math.random() * pinColors().length);   // this ant's pin colour, for the ones it throws too
  const legs = [];
  for (const s of [-1, 1]) ANT_LEGS.forEach(([z, f], i) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.1, 0.55, z);
    pivot.add(new THREE.Mesh((GEO['antLeg' + s + i] ||= G.legGeo(s, f)), M.shell));
    body.add(pivot);
    legs.push({ pivot, s, phase: (i + (s > 0 ? 1 : 0)) % 2 ? Math.PI : 0 });   // tripod gait
  });
  const antennae = [G.antL, G.antR].map((geo, j) => {
    const p = new THREE.Group();
    p.position.set(j ? 0.11 : -0.11, 0.98, 0.78);
    p.add(new THREE.Mesh(geo, M.shell));
    body.add(p);
    return p;
  });
  const pin = new THREE.Group();
  pin.name = 'ant-pin';
  pin.position.set(0, 0.6, 0.94);                                  // gripped in the mandibles
  pin.add(new THREE.Mesh(pinGeo(outer.userData.pin), M.shell));
  body.add(pin);
  for (const L of legs) L.z0 = L.pivot.position.z;
  for (const a of antennae) a.sp = { x: 0, v: 0 };
  let t = 0, k = 0, fired = 0, since = 9;
  // its pin throw (attack-motion "throw", src/attack-motion.js): braces low and coils back with its pin trembling,
  // its head snapping to the line as the aim locks (antennae flicking forward), goes dead still, then drives head
  // and pin forward as the pin leaves (the same frame as ever) with its legs skidding; it rocks back past neutral
  // and settles, the antennae whipping a beat late
  const anim = (dt, e) => {
    const speed = Math.hypot(e.vel.x, e.vel.z);
    k += (Math.min(1, speed * 7) - k) * (1 - Math.exp(-8 * dt));
    t += dt * (3 + 16 * k);
    const A = e.atk, ph = A ? A.phase : 'idle';
    let brace = 0, coilK = 0, thrust = 0, dip = 0, shake = 0, len = 1;
    if (ph === 'build') {
      const c = coil(A.k, A.style.hold, A.style.over) * A.vary;
      brace = Math.min(1, c * 1.6); coilK = c;
      dip = lockBeat(A) ? 1 : 0;                                  // the lock: its head snaps to the line, the antennae flick forward
      shake = A.still ? 0 : quiver(A.k, A.t, e.phase) * A.quiet;   // the pin trembles, then dead still for the last 0.1 s
    } else if (ph === 'swing') {
      const s = snap(Math.min(1, A.pt / A.style.strike), A.tier.over);
      brace = Math.max(0, 1 - s); coilK = A.vary * Math.max(0, 1 - s); thrust = s;
      len = A.smear ? knobs().smear : 1 + (A.tier.stretch - 1) * Math.min(1, s);
    } else if (ph === 'recoil') thrust = (1 + A.tier.over) * settle(A.k, 1, 1);   // (one bounce: its recoil is a quarter second)
    // the throw (the spit word's firedT): the pin goes the frame it is thrown, then a new one swells into its jaws
    if ((e.firedT || 0) > fired) since = 0;
    fired = e.firedT || 0;
    since += dt;
    body.position.set(shake * 0.02, Math.abs(Math.sin(t)) * 0.02 * k - brace * 0.08 + coilK * 0.03, coilK * -0.16 + thrust * 0.26);
    body.rotation.x = coilK * -0.18 + thrust * 0.2 + dip * 0.1;      // rears back, then drives its head down
    body.rotation.z = Math.sin(t) * 0.03 * k + shake * 0.05;
    stretch(body, len);
    for (const L of legs) {
      L.pivot.rotation.y = Math.sin(t + L.phase) * 0.4 * k;
      L.pivot.rotation.z = (Math.max(0, Math.cos(t + L.phase)) * 0.25 * k + brace * 0.12) * L.s;   // lifts a foot; braced, splays out
      L.pivot.position.z = L.z0 - thrust * 0.1;                  // the feet skid: they stay while the body goes
    }
    for (let j = 0; j < antennae.length; j++) {
      const p = antennae[j];
      spring(p.sp, Math.sin(t * 0.7 + j) * 0.25 - brace * 0.3 + thrust * 0.4 - dip * 0.45, 0.06, 2.2, dt);   // lagging the head, a beat late
      p.rotation.x = p.sp.x;
      p.rotation.y = Math.sin(t * 0.9 + j * 2) * 0.2;
    }
    // the pin: gone as it's thrown, then a new one swells into its jaws
    const grow = THREE.MathUtils.clamp((since - 0.25) / 0.3, 0, 1);
    pin.scale.setScalar(since < 0.25 ? 0 : 1 + 2.7 * (grow - 1) ** 3 + 1.7 * (grow - 1) ** 2);   // with a little overshoot
    pin.rotation.x = coilK * 0.12;
    pin.rotation.z = shake * 0.6;
  };
  anim.reset = () => { t = 0; k = 0; fired = 0; since = 9; stretch(body, 1); body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); for (const L of legs) L.pivot.position.z = L.z0; for (const a of antennae) { a.sp.x = 0; a.sp.v = 0; } pin.rotation.z = 0; };   // (a pooled model killed mid-throw)
  return { body: outer, face: new THREE.Group(), anim, deathParts: legs.map((L) => L.pivot) };
}

// ------------------------------------------------------------------ mosquito
function mosquitoGeometry() {
  const black = '#15151a', white = '#f4f4f0', blood = '#b0202a', dark = '#0c0c10';
  const parts = [
    ellipsoid(0.26, 0.24, 0.3, V(0, 0, 0.1), black),                     // thorax
    ellipsoid(0.05, 0.2, 0.03, V(0, 0.2, 0.1), white, 8),                // white stripe down the back (tiger mosquito)
    ellipsoid(0.15, 0.15, 0.15, V(0, 0.02, 0.46), dark),                 // head
    ellipsoid(0.1, 0.1, 0.07, V(-0.1, 0.06, 0.52), '#8a1a1a', 10),       // big red compound eyes
    ellipsoid(0.1, 0.1, 0.07, V(0.1, 0.06, 0.52), '#8a1a1a', 10),
    rod(V(0, -0.02, 0.58), V(0, -0.36, 1.35), 0.03, 0.006, dark),        // long proboscis
    rod(V(-0.05, 0.04, 0.6), V(-0.2, 0.1, 1.0), 0.012, 0.004, dark),     // feathery antennae
    rod(V(0.05, 0.04, 0.6), V(0.2, 0.1, 1.0), 0.012, 0.004, dark),
  ];
  for (let k = 0; k < 7; k++) {                                          // striped abdomen, swollen and red with blood
    const z = -0.2 - k * 0.16;
    const w = 0.2 - Math.abs(k - 2.5) * 0.02;
    parts.push(ellipsoid(w, w * 0.85, 0.1, V(0, -0.06 - k * 0.045, z), k % 2 ? white : blood, 12));
  }
  // six long legs, each jointed at the hip and the knee so they can dangle and swing in flight:
  // a thigh from the hip to the knee, then the long white-banded shin to the foot (both sides built,
  // so nothing is drawn mirrored)
  const legs = [];
  for (const s of [-1, 1]) for (const z of [0.25, 0.1, -0.05]) {
    const hip = V(s * 0.12, -0.05, z), knee = V(s * 0.55, 0.2, z + 0.15), foot = V(s * 0.8, -1.0, z + 0.3 - (0.25 - z) * 1.8);
    const shin = foot.clone().sub(knee), bands = [];
    for (let b = 0; b < 4; b++) bands.push(rod(shin.clone().multiplyScalar(b / 4), shin.clone().multiplyScalar((b + 1) / 4), 0.02 - b * 0.003, 0.017 - b * 0.003, b % 2 ? white : black));
    legs.push({ s, z, hip, knee: knee.clone().sub(hip), thigh: rod(V(0, 0, 0), knee.clone().sub(hip), 0.03, 0.022, black), shin: merge(bands) });
  }
  const shape = new THREE.Shape().moveTo(0, 0).bezierCurveTo(0.3, 0.2, 1.1, 0.2, 1.3, 0).bezierCurveTo(1.1, -0.14, 0.3, -0.14, 0, 0);
  const wing = new THREE.ShapeGeometry(shape, 12);
  wing.rotateX(-Math.PI / 2).rotateY(Math.PI * 0.62);
  // wing veins: a few dark lines along the wing
  const veins = new THREE.BufferGeometry().setFromPoints([0.05, -0.03, 0.03].flatMap((o, i) => [V(0, 0, 0), V(1.15, 0, o * (i + 1))]).map((p) => p.applyAxisAngle(V(0, 1, 0), Math.PI * 0.62)));
  return { body: merge(parts), legs, wing, veins };
}

export function buildMosquito() {
  const G = (GEO.mosquito ||= mosquitoGeometry()), M = mats();
  M.wing.opacity = 0.55;
  M.wing.color.setHex(0xcfe0ee);
  M.vein ||= new THREE.LineBasicMaterial({ color: 0x3a3a48, transparent: true, opacity: 0.7 });
  const outer = new THREE.Group(), body = new THREE.Group();
  outer.add(body);
  body.add(new THREE.Mesh(G.body, M.shell));
  const legs = G.legs.map((L, i) => {
    const hip = new THREE.Group(), knee = new THREE.Group();
    hip.position.copy(L.hip);
    knee.position.copy(L.knee);
    hip.add(new THREE.Mesh(L.thigh, M.matte), knee);
    knee.add(new THREE.Mesh(L.shin, M.matte));
    body.add(hip);
    return { hip, knee, s: L.s, pair: i % 3, phase: i * 1.7, swing: 0, sway: 0 };   // pair 0 front, 2 hind
  });
  const wings = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.12, 0.2, 0.12);
    const w = new THREE.Group();
    w.add(new THREE.Mesh(G.wing, M.wing), new THREE.LineSegments(G.veins, M.vein));
    w.scale.set(s * -1, 1, 1);
    pivot.add(w);
    body.add(pivot);
    return { pivot, s };
  });
  // small angry brows over the compound eyes
  const face = angryEyes({ y: 0.1, z: 0.56, size: 0.12, gap: 0.12 });
  body.add(face);
  for (const L of legs) L.sp = { x: 0, v: 0 };
  let t = 0, fwd = 0, side = 0;
  // its bite (attack-motion "lunge", src/attack-motion.js): draws back and rears, holds quivering with the front
  // legs reaching for you, goes dead still, darts nose first stretched out; landed, it bounces back squashed and
  // bobs; missed, it overshoots and rolls, wobbling level
  const anim = (dt, e) => {
    t += dt;
    const k = 1 - Math.exp(-8 * dt);
    // how it's flying, in its own frame: forward and sideways speed (m/s)
    const ry = e.root?.rotation.y || 0, v = e.vel;
    const vf = v ? v.x * Math.sin(ry) + v.z * Math.cos(ry) : 0, vs = v ? v.x * Math.cos(ry) - v.z * Math.sin(ry) : 0;
    fwd += (vf - fwd) * k; side += (vs - side) * k;
    const A = e.atk, ph = A ? A.phase : 'idle';
    let back = 0, rear = 0, reach = 0, dart = 0, len = 1, roll = 0, shake = 0, still = 0;
    if (ph === 'build') {
      const c = coil(A.k, A.style.hold, A.style.over) * A.vary;
      back = -0.3 * c; rear = 0.35 * c; reach = Math.min(1, c);
      if (lockBeat(A)) rear -= 0.12;             // the lock: its head dips at you
      still = A.still ? 1 : 0;
      shake = (1 - still) * quiver(A.k, A.t, e.phase) * A.quiet;
    } else if (ph === 'swing') {
      const s = snap(Math.min(1, A.pt / A.style.strike), A.tier.over);
      back = -0.3 * A.vary * (1 - s) + 0.1 * s; rear = 0.35 * A.vary * (1 - s) + 0.25 * s; reach = 1 - s; dart = 1;
      len = A.smear ? knobs().smear : 1 + (A.tier.stretch - 1) * Math.min(1, s);
      still = 1;
    } else if (ph === 'recoil') {
      const b = settle(A.k, A.style.bounces, A.style.damp) * Math.min(1, A.pt / 0.05);
      if (A.hit) { back = -0.5 * b; len = 1 - 0.2 * Math.max(0, b); rear = -0.2 * b; }   // knocked back off you, squashed
      else { back = 0.2 * b; roll = A.side * 0.44 * b; rear = -0.15 * b; }               // carried on past, rolling
    }
    // wings: a blur of beats, each one sweeping forward and back as it goes up and down (a figure of eight),
    // faster as it draws back to bite
    const beat = t * (60 + reach * 25);
    for (const W of wings) {
      W.pivot.rotation.z = W.s * (0.25 + Math.sin(beat) * 0.5);
      W.pivot.rotation.y = W.s * Math.cos(beat) * 0.3;
    }
    // legs: hanging long under it, each swinging on its own like a pendulum (a spring, so they swing through
    // when it stops short), swept back by its speed and flung out sideways in a turn; the hind pair held up behind
    // (as mosquitoes do). Drawing back to bite the front legs reach for you; darting, they all stream behind.
    const trail = THREE.MathUtils.clamp(fwd * 1.2, -0.4, 0.9) * (1 - dart) + dart * 1.1;
    const free = (1 - reach * 0.6) * (1 - still);
    for (const L of legs) {
      const want = trail * (L.pair === 0 ? 0.7 : 1) + (L.pair === 2 ? 0.55 : L.pair === 1 ? 0.15 : -0.1) - reach * (L.pair === 0 ? 0.9 : L.pair === 1 ? 0.3 : -0.2);
      spring(L.sp, want, 0.07 + 0.02 * L.pair, 2.2, dt);              // the legs lag behind the body, hind last
      L.sway += (THREE.MathUtils.clamp(-side * 1.5, -0.5, 0.5) - L.sway) * (1 - Math.exp(-4 * dt));
      L.hip.rotation.x = L.sp.x + Math.sin(t * 2.6 + L.phase) * 0.12 * free;
      L.hip.rotation.z = L.sway * 0.6 + Math.sin(t * 2.1 + L.phase * 1.3) * 0.08 * free + L.s * reach * 0.15;
      L.knee.rotation.x = Math.sin(t * 3.4 + L.phase) * 0.18 * free + (L.pair === 2 ? 0.25 : 0) + reach * (L.pair === 0 ? -0.35 : 0.1);
    }
    // the body: a hovering bob, nose down into its speed, banked into turns; then the bite's own pose
    const calm = Math.max(reach, dart);
    body.position.y = Math.sin(t * 4 + e.phase) * 0.1 * (1 - calm);
    body.position.z = back;
    body.rotation.x = -0.15 + THREE.MathUtils.clamp(fwd * 0.5, -0.2, 0.35) * (1 - calm) - rear + shake * 0.06;
    body.rotation.z = THREE.MathUtils.clamp(side * 0.9, -0.45, 0.45) * (1 - calm) + roll + shake * 0.04;
    stretch(body, len);
    if (A) eyes(face, A);
  };
  anim.reset = () => { t = 0; fwd = 0; side = 0; legs.forEach(L => { L.sp.x = 0; L.sp.v = 0; L.sway = 0; }); stretch(body, 1); body.position.set(0, 0, 0); face.children.forEach((c) => { c.scale.y = 1; c.rotation.x = 0; }); };   // (a pooled model killed mid-bite)
  return { body: outer, face: new THREE.Group(), anim };
}

// ------------------------------------------------------------------ spotted lanternfly
// The adult planthopper, in detail: a tent of pinkish-tan forewings with black spots and a
// black-and-grey brick pattern at the tips, over red hindwings (black spots, a white band, a
// black edge) that only show when it opens up to leap. A black head with a short beak and red
// antennae, a yellow abdomen banded black, and six black legs, the back pair long for jumping.
// It crawls with a tripod gait; to attack it crouches, then springs high, wings flared, and
// slams down. About 2.6 radii long.
function wingTexture(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function seeded(seed) { let s = seed; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 >>> 0) / 4294967296); }

// a wing outline from its base (0, 0) back to the tip at (len, 0), `width` across at its widest;
// laid flat with the base at the origin, pointing back (-z), spreading out to +x. UVs run base->tip
function wingGeometry(len, width, tipRound, segs = 48) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(len * 0.3, -0.02, len * 0.75, -0.03, len * (1 - tipRound * 0.5), 0);   // the inner edge along the back
  s.bezierCurveTo(len * 1.02, width * 0.15, len * 1.02, width * 0.75, len * (1 - tipRound), width * 0.95);   // the round tip
  s.bezierCurveTo(len * 0.6, width * 1.05, len * 0.25, width * 0.85, 0.02, width * 0.25);   // the outer edge back to the base
  s.closePath();
  const g = new THREE.ShapeGeometry(s, segs);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), v = p.getY(i);
    uv.setXY(i, u / len, v / width);
    // a gentle curve across the wing, like a real one draped over the body
    p.setXYZ(i, v, -Math.pow(v / width, 2) * width * 0.18 + Math.sin((u / len) * Math.PI) * 0.04, -u);
  }
  g.computeVertexNormals();
  return g;
}

function lanternflyParts() {
  const black = '#16141a', dark = '#2a2228', yellow = '#e6b81e', red = '#c8202a';
  const body = [
    ellipsoid(0.34, 0.26, 0.42, V(0, 0.42, 0.35), dark, 32),                // thorax
    ellipsoid(0.36, 0.08, 0.3, V(0, 0.6, 0.38), '#3a3036', 24),             // its shield
    ellipsoid(0.24, 0.2, 0.2, V(0, 0.4, 0.82), black, 28),                   // head
    ellipsoid(0.07, 0.07, 0.05, V(-0.17, 0.46, 0.88), '#5a2a2a', 16),       // eyes
    ellipsoid(0.07, 0.07, 0.05, V(0.17, 0.46, 0.88), '#5a2a2a', 16),
    rod(V(0, 0.3, 0.92), V(0, 0.05, 0.98), 0.035, 0.015, black),           // the beak, pointing down
    rod(V(-0.1, 0.48, 0.97), V(-0.2, 0.58, 1.12), 0.035, 0.03, red),       // short red antennae
    rod(V(0.1, 0.48, 0.97), V(0.2, 0.58, 1.12), 0.035, 0.03, red),
    ellipsoid(0.03, 0.03, 0.03, V(-0.2, 0.58, 1.12), black, 10),
    ellipsoid(0.03, 0.03, 0.03, V(0.2, 0.58, 1.12), black, 10),
  ];
  // the abdomen: segments, yellow and black, tapering back under the wings
  for (let k = 0; k < 8; k++) {
    const z = 0.0 - k * 0.15, w = 0.3 - k * 0.026;
    body.push(ellipsoid(w, w * 0.78, 0.1, V(0, 0.36 - k * 0.012, z), k % 2 ? black : yellow, 24));
  }
  // a leg built at its hip: femur out and down, tibia to the floor, a little foot
  const leg = (s, reach, back, long) => merge([
    rod(V(0, 0, 0), V(s * 0.38, 0.12, back * 0.3), 0.055, 0.045, black),
    rod(V(s * 0.38, 0.12, back * 0.3), V(s * reach, -0.4, back * (long ? 0.9 : 0.5)), 0.04, 0.025, black),
    rod(V(s * reach, -0.4, back * (long ? 0.9 : 0.5)), V(s * (reach + 0.08), -0.42, back * (long ? 1.05 : 0.6)), 0.025, 0.015, '#3a3036'),
    ...(long ? [0.3, 0.5, 0.7].map((f) => ellipsoid(0.028, 0.028, 0.028, V(s * (0.38 + (reach - 0.38) * f) + s * 0.03, 0.12 - 0.52 * f, back * (0.3 + 0.6 * f)), '#3a3036', 8)) : []),   // spines on the jumping legs
  ]);
  const legs = [];
  for (const s of [-1, 1]) legs.push({ s, i: 0, geo: leg(s, 0.62, 0.6, false), at: V(s * 0.16, 0.36, 0.55) }, { s, i: 1, geo: leg(s, 0.7, -0.1, false), at: V(s * 0.18, 0.34, 0.32) }, { s, i: 2, geo: leg(s, 0.78, -1, true), at: V(s * 0.18, 0.33, 0.1) });

  // wing paintings (high resolution): u runs base -> tip, v the inner edge -> the outer edge
  const R = seeded(7);
  const fore = wingTexture(1024, 384, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#cdb6a6'); grad.addColorStop(0.6, '#bfa797'); grad.addColorStop(1, '#a8907f');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    // fine dark veins along the wing
    g.strokeStyle = 'rgba(60,40,40,.35)'; g.lineWidth = 2;
    for (let k = 1; k < 7; k++) { g.beginPath(); g.moveTo(0, h * k / 7); g.bezierCurveTo(w * 0.3, h * (k / 7 + 0.03), w * 0.5, h * (k / 7 - 0.02), w * 0.62, h * k / 7); g.stroke(); }
    // black spots on the front two thirds
    g.fillStyle = '#121014';
    for (let k = 0; k < 16; k++) { const x = (0.06 + R() * 0.52) * w, y = (0.12 + R() * 0.76) * h, r = (0.022 + R() * 0.02) * w; g.beginPath(); g.ellipse(x, y, r, r * (0.8 + R() * 0.3), R() * 3, 0, 7); g.fill(); }
    // the tips: a black net over grey "bricks"
    const x0 = 0.63 * w;
    g.fillStyle = '#141216'; g.fillRect(x0, 0, w - x0, h);
    for (let row = 0; row < 7; row++) for (let col = 0; col < 9; col++) {
      const cw = (w - x0) / 8.5, ch = h / 7, x = x0 + col * cw + (row % 2 ? cw / 2 : 0) + 3, y = row * ch + 3;
      if (x > w) continue;
      g.fillStyle = R() < 0.5 ? '#6e625a' : '#857870';
      g.beginPath(); g.roundRect(x, y, cw - 7, ch - 7, 6); g.fill();
    }
    const fade = g.createLinearGradient(x0 - 30, 0, x0 + 20, 0);   // soft border into the spotted part
    fade.addColorStop(0, 'rgba(18,16,20,0)'); fade.addColorStop(1, 'rgba(18,16,20,1)');
    g.fillStyle = fade; g.fillRect(x0 - 30, 0, 50, h);
  });
  const hind = wingTexture(1024, 384, (g, w, h) => {
    g.fillStyle = '#d01e2a'; g.fillRect(0, 0, w * 0.56, h);
    const shade = g.createLinearGradient(0, 0, w * 0.56, 0); shade.addColorStop(0, 'rgba(120,0,10,.35)'); shade.addColorStop(1, 'rgba(255,60,60,0)');
    g.fillStyle = shade; g.fillRect(0, 0, w * 0.56, h);
    g.fillStyle = '#121014';
    for (let k = 0; k < 8; k++) { const x = (0.08 + R() * 0.4) * w, y = (0.15 + R() * 0.7) * h, r = (0.03 + R() * 0.022) * w; g.beginPath(); g.ellipse(x, y, r, r, 0, 0, 7); g.fill(); }
    g.fillStyle = '#f1ede4'; g.fillRect(w * 0.56, 0, w * 0.12, h);          // the white band
    g.fillStyle = '#121014'; g.fillRect(w * 0.68, 0, w * 0.32, h);          // the black edge
  });
  return { body: merge(body), legs, foreGeo: wingGeometry(1.95, 0.62, 0.25), hindGeo: wingGeometry(1.35, 0.8, 0.4), fore, hind };
}

export function buildLanternfly() {
  const G = (GEO.lanternfly ||= lanternflyParts()), M = mats();
  const wingMat = (map) => {
    const m = new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.05 });
    standOut(m, { base: 0.25, rim: 0.6 });
    return m;
  };
  M.lfFore ||= wingMat(G.fore);
  M.lfHind ||= wingMat(G.hind);
  const outer = new THREE.Group(), body = new THREE.Group();
  outer.add(body);
  const shell = new THREE.Mesh(G.body, M.shell);
  body.add(shell);
  const legs = G.legs.map((L) => {
    const pivot = new THREE.Group();
    pivot.position.copy(L.at);
    pivot.add(new THREE.Mesh(L.geo, M.shell));
    body.add(pivot);
    return { ...L, pivot, phase: (L.i + (L.s > 0 ? 1 : 0)) % 2 ? Math.PI : 0 };   // tripod gait
  });
  // wings hinge at the shoulders; at rest they make a roof over the back, the hindwings tucked under
  const wing = (geo, mat, s, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.06, y, 0.55);
    const m = new THREE.Mesh(geo, mat);
    m.scale.x = s;
    pivot.add(m);
    body.add(pivot);
    return { pivot, s };
  };
  const hindW = [-1, 1].map((s) => wing(G.hindGeo, M.lfHind, s, 0.6));
  const foreW = [-1, 1].map((s) => wing(G.foreGeo, M.lfFore, s, 0.66));
  const face = angryEyes({ y: 0.48, z: 0.96, size: 0.13, gap: 0.12 });
  body.add(face);

  let t = 0, k = 0;
  // its pounce (attack-motion "pounce", src/attack-motion.js): crouches deep and holds, flicks its forewings open
  // to flash the red as its spot locks, dips once more, then springs off stretched, wings flared and beating,
  // hangs with its legs trailing and swings them forward, nose down, to land. It hits the floor squashed and
  // bounces twice, its legs splayed then gathered, its wings folding late (hind first). Landed on you, it shakes
  // itself off; missed, it looks round for you. It squares up for the last of its rest.
  const anim = (dt, e) => {
    t += dt;
    const speed = Math.hypot(e.vel.x, e.vel.z);
    k += (Math.min(1, speed * 7) - k) * (1 - Math.exp(-8 * dt));
    const A = e.atk, ph = A ? A.phase : 'idle', S = THREE.MathUtils.smoothstep;
    let crouch = 0, fore = 0, hind = 0, beat = 0, trail = 0, ahead = 0, nose = 0, squash = 0, len = 1, splay = 0, turn = 0, roll = 0;
    if (ph === 'build') {
      crouch = coil(A.k, A.style.hold, A.style.over) * A.vary + (A.still ? 0.35 : 0);   // the last 0.1 s: a second, deeper dip
      if (lockBeat(A)) fore = 0.6;                                                      // the lock: a flash of red
      roll = (A.still ? 0 : quiver(A.k, A.t, e.phase)) * 0.04 * A.quiet;
    } else if (ph === 'swing') {
      const down = S(A.k, 0.45, 0.85);           // through the leap: up with its legs trailing, then legs forward to land
      fore = hind = 1; beat = 1; trail = 1 - down; ahead = down;
      nose = -0.35 * (1 - down) + 0.3 * down;
      len = A.smear ? knobs().smear : 1 + (A.tier.stretch - 1) * Math.max(0, 1 - A.pt / 0.1);   // launched stretched
    } else if (ph === 'recoil') {
      const p = A.pt;
      squash = 0.2 * settle(Math.min(1, p / 0.4), A.style.bounces, A.style.damp);
      hind = 1 - S(p, 0.3, 0.5); fore = 1 - S(p, 0.4, 0.6); beat = fore * 0.5;     // the wings fold late, hind first
      splay = heavy(Math.min(1, p / 0.5));
      if (A.hit) roll = Math.sin((p - 0.5) * 50) * 0.15 * (p > 0.5 && p < 0.75 ? (0.75 - p) * 4 : 0);   // shakes itself off
      else turn = A.side * 0.35 * Math.sin(Math.PI * S(p, 0.25, 0.75));                                   // where did you go?
    }
    const walk = 1 - Math.min(1, crouch + fore);
    const step = t * (4 + 14 * k);
    for (const L of legs) {
      const sw = Math.sin(step + L.phase) * 0.35 * k * walk;
      // crouching folds the jumping legs; in the air every leg trails back, then swings forward to land
      // (one set() per joint: each rotation write rebuilds its quaternion)
      L.pivot.rotation.set((L.i === 2 ? -0.5 : -0.15) * crouch + (L.i === 2 ? 0.9 : 0.5) * trail - 0.4 * ahead, sw * -L.s, (Math.max(0, Math.cos(step + L.phase)) * 0.25 * k * walk + 0.45 * splay) * L.s);
    }
    body.position.y = Math.abs(Math.sin(step)) * 0.02 * k * walk - crouch * 0.14 - squash * 0.1;
    body.rotation.set(-crouch * 0.18 + nose, turn, Math.sin(step * 0.5) * 0.03 * k * walk + roll);
    if (squash) { const y = 1 - squash, w = 1 / Math.sqrt(y); body.scale.set(w, y, w); } else stretch(body, len);
    // wings: a roof at rest, lifted a little in the crouch, flared and beating mid-leap to flash the red
    const flap = beat * Math.sin(t * 38) * 0.35;
    // (roll: negative drapes a wing down over the side, positive lifts it up and out)
    for (const W of foreW) W.pivot.rotation.set(0, W.s * (0.04 + fore * 0.5), W.s * (-0.62 + crouch * 0.2 + fore * 1.5 + flap));
    for (const W of hindW) W.pivot.rotation.set(0, W.s * (0.02 + hind * 0.9), W.s * (-0.72 + crouch * 0.15 + hind * 1.45 - flap));
    if (A) eyes(face, A);
  };
  anim.reset = () => { t = 0; k = 0; stretch(body, 1); body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); face.children.forEach((c) => { c.scale.y = 1; c.rotation.x = 0; }); };
  return { body: outer, face: new THREE.Group(), anim };
}

// ------------------------------------------------------------------ giant house spider
// After a giant house spider: a glossy brown carapace with dark marks radiating from a pale
// middle stripe, a big mottled tan-and-black abdomen, dark hairy chelicerae with fangs, a cluster
// of eyes, pedipalps, and eight long, hairy, banded legs (the front and back pairs longest).
// It walks with a real spider's gait: two alternating sets of four legs (front left, second
// right, third left, back right, then the others), each leg lifting at the hip and folding at
// the knee as it swings forward. To shoot it rears up, front legs raised and the abdomen tipped
// up, then flicks a web ball at you. About 2.4 radii long, legs spanning about 5.
function spiderTexture(paint, w = 512, h = 256) { return wingTexture(w, h, paint); }

function spiderParts() {
  const R = seeded(11), dark = '#1e120c', leg = '#2e1a10', legDark = '#120a06', hair = '#0a0604';
  // the carapace (u around, v from the top down): warm brown, dark marks radiating down from the
  // middle, a pale stripe front to back, a pale rim low on the sides
  const carapace = spiderTexture((g, w, h) => {
    g.fillStyle = '#5e3820'; g.fillRect(0, 0, w, h);
    const rim = g.createLinearGradient(0, h * 0.35, 0, h * 0.6); rim.addColorStop(0, 'rgba(0,0,0,0)'); rim.addColorStop(1, 'rgba(150,100,60,.8)');
    g.fillStyle = rim; g.fillRect(0, h * 0.35, w, h * 0.3);
    g.strokeStyle = 'rgba(40,20,10,.85)'; g.lineCap = 'round';
    for (let k = 0; k < 10; k++) { const x = (k + 0.5) / 10 * w; g.lineWidth = 10 + R() * 8; g.beginPath(); g.moveTo(x, h * 0.08); g.lineTo(x + (R() - 0.5) * 20, h * 0.42); g.stroke(); }
    g.fillStyle = 'rgba(200,150,95,.9)';                        // the pale middle stripe (front and back are u = 0.25 / 0.75)
    for (const u of [0.25, 0.75]) { g.beginPath(); g.ellipse(u * w, h * 0.12, 16, h * 0.14, 0, 0, 7); g.fill(); }
    g.fillStyle = '#2a160c'; g.beginPath(); g.ellipse(w / 2, 0, w, h * 0.06, 0, 0, 7); g.fill();   // the dark top
  });
  // the abdomen: tan with dark blotches, a dark chevron band down the back, darker underneath
  const abdomen = spiderTexture((g, w, h) => {
    g.fillStyle = '#3a2416'; g.fillRect(0, 0, w, h);             // dark brown, blotched tan like the real thing
    for (let k = 0; k < 160; k++) {
      const x = R() * w, y = R() * h * 0.8, r = 4 + R() * 15;
      g.fillStyle = R() < 0.6 ? 'rgba(176,138,88,.85)' : 'rgba(18,10,6,.85)';
      g.beginPath(); g.ellipse(x, y, r, r * (0.5 + R() * 0.6), R() * 3, 0, 7); g.fill();
    }
    g.fillStyle = 'rgba(12,7,4,.8)';                            // chevrons along the back (u = 0.75 faces up/back)
    for (let k = 0; k < 6; k++) { const y = h * (0.12 + k * 0.1), x = w * 0.75; g.beginPath(); g.moveTo(x - 40, y); g.lineTo(x, y + 22); g.lineTo(x + 40, y); g.lineTo(x, y + 10); g.closePath(); g.fill(); }
    const under = g.createLinearGradient(0, h * 0.65, 0, h); under.addColorStop(0, 'rgba(30,18,10,0)'); under.addColorStop(1, 'rgba(30,18,10,.95)');
    g.fillStyle = under; g.fillRect(0, h * 0.65, w, h * 0.35);
  });
  // hairs: fine dark spines sticking out of a part, merged in with it
  const hairs = (n, center, radius, len, spread = 1) => {
    const out = [];
    for (let k = 0; k < n; k++) {
      const d = new THREE.Vector3(R() - 0.5, R() * spread, R() - 0.5).normalize();
      const a = center.clone().add(d.clone().multiply(radius));
      out.push(rod(a, a.clone().addScaledVector(d, len * (0.6 + R() * 0.6)), 0.008, 0.002, hair));
    }
    return out;
  };
  const head = [
    // the stalk to the abdomen
    rod(V(0, 0.58, -0.12), V(0, 0.62, -0.3), 0.1, 0.1, dark),
    // chelicerae: two dark, hairy jaws hanging below the front, glossy fangs at their tips
    ...[-1, 1].flatMap((s) => [
      ellipsoid(0.12, 0.2, 0.12, V(s * 0.1, 0.42, 0.72), '#1c100a', 18),
      rod(V(s * 0.1, 0.24, 0.76), V(s * 0.05, 0.16, 0.72), 0.03, 0.006, '#0a0604'),
      ...hairs(10, V(s * 0.1, 0.44, 0.74), V(0.1, 0.16, 0.1), 0.08),
    ]),
    // the eye cluster on the front of the carapace: six small glossy black eyes around the big pair
    ...[[-0.13, 0.84, 0.62], [0.13, 0.84, 0.62], [-0.2, 0.8, 0.56], [0.2, 0.8, 0.56], [-0.07, 0.88, 0.58], [0.07, 0.88, 0.58]].map(([x, y, z]) => ellipsoid(0.035, 0.035, 0.03, V(x, y, z), '#050304', 10)),
    // spinnerets at the tip of the abdomen
    rod(V(-0.05, 0.62, -1.38), V(-0.07, 0.6, -1.5), 0.04, 0.02, dark),
    rod(V(0.05, 0.62, -1.38), V(0.07, 0.6, -1.5), 0.04, 0.02, dark),
    ...hairs(26, V(0, 0.62, 0.25), V(0.42, 0.22, 0.52), 0.06, 1.2),       // bristles on the carapace
    ...hairs(60, V(0, 0.72, -0.78), V(0.48, 0.44, 0.7), 0.07, 1.2),       // and the abdomen
  ];
  // a leg segment along +x, `len` long, tapering, with a darker band at its end and bristles
  const segment = (len, r0, r1, nHair) => {
    const parts = [rod(V(0, 0, 0), V(len, 0, 0), r0, r1, leg), rod(V(len * 0.82, 0, 0), V(len, 0, 0), r1 * 1.08, r1 * 1.05, legDark)];
    for (let k = 0; k < nHair; k++) {
      const x = len * (0.1 + R() * 0.85), a = R() * Math.PI * 2, d = V(0.35, Math.cos(a), Math.sin(a)).normalize();
      const at = V(x, Math.cos(a) * r0 * 0.9, Math.sin(a) * r0 * 0.9);
      parts.push(rod(at, at.clone().addScaledVector(d, 0.06 + R() * 0.05), 0.006, 0.0015, hair));
    }
    return merge(parts);
  };
  // the four leg pairs: [angle from straight ahead, length scale]; front and back pairs longest
  const pairs = [[38, 1.18], [72, 1.0], [108, 0.92], [142, 1.12]];
  const legs = pairs.map(([deg, sc]) => ({ deg, sc, femur: segment(0.75 * sc, 0.065, 0.05, 14), tibia: segment(0.85 * sc, 0.05, 0.035, 16), tarsus: segment(0.75 * sc, 0.034, 0.015, 10) }));
  const palp = merge([rod(V(0, 0, 0), V(0.18, 0.12, 0.2), 0.04, 0.035, leg), rod(V(0.18, 0.12, 0.2), V(0.2, -0.12, 0.38), 0.035, 0.03, legDark), ...hairs(8, V(0.18, 0.05, 0.25), V(0.04, 0.1, 0.06), 0.06)]);
  return {
    head: merge(head), palp, legs, carapace, abdomen,
    carapaceGeo: new THREE.SphereGeometry(1, 40, 24).scale(0.42, 0.22, 0.5).translate(0, 0.62, 0.25),
    abdomenGeo: new THREE.SphereGeometry(1, 40, 28).scale(0.48, 0.42, 0.7).translate(0, 0.72, -0.78),
  };
}

export function buildSpider() {
  const G = (GEO.spider ||= spiderParts()), M = mats();
  const skin = (map, rough) => { const m = new THREE.MeshStandardMaterial({ map, roughness: rough, metalness: 0.05 }); standOut(m, { base: 0.25, rim: 0.7 }); return m; };
  M.spCarapace ||= skin(G.carapace, 0.3);
  M.spAbdomen ||= skin(G.abdomen, 0.55);
  // the legs and head: dark brown and a little glossy, with less of the other bugs' glow so they stay dark
  // (thin legs are nearly all rim, so a big rim light would wash them tan)
  if (!M.spLeg) { M.spLeg = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.05 }); standOut(M.spLeg, { base: 0.06, rim: 0.16 }); }
  const outer = new THREE.Group(), body = new THREE.Group();
  outer.add(body);
  const front = new THREE.Group();                 // the carapace end: everything pitches about the waist
  front.position.set(0, 0.6, -0.2);
  body.add(front);
  const rear = new THREE.Group();                  // the abdomen tips up separately when it shoots
  rear.position.set(0, 0.62, -0.25);
  body.add(rear);
  const add = (parent, geo, mat, at) => { const m = new THREE.Mesh(geo, mat); if (at) m.position.copy(at); parent.add(m); return m; };
  add(front, G.carapaceGeo, M.spCarapace, V(0, -0.6, 0.2));
  add(front, G.head, M.spLeg, V(0, -0.6, 0.2));
  add(rear, G.abdomenGeo, M.spAbdomen, V(0, -0.62, 0.25));
  const face = angryEyes({ y: 0.82, z: 0.66, size: 0.11, gap: 0.08 });   // the big front pair of eyes, glaring
  face.position.add(V(0, -0.6, 0.2));
  front.add(face);
  const palps = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.12, -0.12, 0.85); p.scale.x = s; add(p, G.palp, M.spLeg); front.add(p); return p; });

  // legs: hip (yaw outward, then swing and lift) -> femur -> knee -> tibia -> ankle -> tarsus
  const legs = [];
  G.legs.forEach((P, pair) => {
    for (const s of [-1, 1]) {
      const a = THREE.MathUtils.degToRad(P.deg);
      const hip = new THREE.Group();
      hip.position.set(s * 0.34 * Math.sin(a), -0.04, 0.45 + 0.4 * Math.cos(a));
      hip.rotation.y = Math.atan2(-Math.cos(a), s * Math.sin(a));
      front.add(hip);
      const swing = new THREE.Group(); hip.add(swing);
      const lift = new THREE.Group(); swing.add(lift);
      add(lift, P.femur, M.spLeg);
      const knee = new THREE.Group(); knee.position.x = 0.75 * P.sc; lift.add(knee);
      add(knee, P.tibia, M.spLeg);
      const ankle = new THREE.Group(); ankle.position.x = 0.85 * P.sc; knee.add(ankle);
      add(ankle, P.tarsus, M.spLeg);
      // the rest pose: femur up, tibia down and out, the tarsus angled so the foot meets the floor
      const e1 = 0.9, e2 = e1 - 1.55;
      const reach = 0.75 * P.sc * Math.sin(e1) + 0.85 * P.sc * Math.sin(e2);
      const e3 = Math.asin(THREE.MathUtils.clamp((-0.56 - reach) / (0.75 * P.sc), -1, 1));
      // two alternating sets of four: front left, second right, third left, back right
      const set = (pair % 2 === 0) === (s < 0) ? 0 : 1;
      legs.push({ s, pair, swing, lift, knee, ankle, e1, k2: e2 - e1, k3: e3 - e2, phase: set ? Math.PI : 0 });
    }
  });

  const frontUp = { x: 0, v: 0 }, spread = { x: 0, v: 0 };     // the front legs: how high they are raised, how far apart they are spread
  let t = 0, k = 0, drum = 0;
  // its web lob (attack-motion "throw", src/attack-motion.js): rears in a quarter second with a small overshoot,
  // front legs high and the abdomen tucked, palps drumming; the front legs spread as the aim locks; then they
  // flick down and forward as the abdomen whips round to aim and the web goes; it rocks back, its knees bending
  // to take it, and settles, the front legs coming down last
  const anim = (dt, e) => {
    t += dt;
    const speed = Math.hypot(e.vel.x, e.vel.z);
    k += (Math.min(1, speed * 7) - k) * (1 - Math.exp(-8 * dt));
    const A = e.atk, ph = A ? A.phase : 'idle';
    let rearUp = 0, flick = 0, rock = 0, bend = 0, len = 1, shake = 0, dip = 0;
    if (ph === 'build') {
      rearUp = coil(A.k, A.style.hold, A.style.over) * A.vary;
      dip = lockBeat(A) ? 1 : 0;
      shake = A.still ? 0 : quiver(A.k, A.t, e.phase) * A.quiet;
    } else if (ph === 'swing') {
      const s = snap(Math.min(1, A.pt / A.style.strike), A.tier.over);
      rearUp = A.vary * Math.max(0, 1 - s); flick = s; rock = s;
      len = A.smear ? knobs().smear : 1 + (A.tier.stretch - 1) * Math.min(1, s);
    } else if (ph === 'recoil') {
      const b = settle(A.k, 1, 1);                      // (one bounce: its recoil is a quarter second)
      flick = rock = (1 + A.tier.over) * b;
      bend = 1 - A.k;                                              // its knees bend to take the throw, then straighten
    }
    drum += dt * (6 + 14 * rearUp);
    spring(frontUp, ph === 'build' || !A ? 0.55 * rearUp : -0.25 * flick, 0.07, 2.4, dt);   // the front legs lead in, flick down, and are last up or down
    spring(spread, dip, 0.05, 2, dt);
    const step = t * (3 + 11 * k) + e.phase;
    for (const L of legs) {
      const ph2 = step + L.phase, up = Math.max(0, Math.sin(ph2));          // lifted while it swings forward
      L.swing.rotation.y = Math.cos(ph2) * 0.28 * k * L.s + (L.pair === 0 ? L.s * spread.x * 0.35 : 0);   // (forward while lifted, on both sides)
      // rearing: the front pair lifts high and reaches forward, the second pair a little
      const raise = L.pair === 0 ? frontUp.x : L.pair === 1 ? rearUp * 0.2 : 0;
      L.lift.rotation.z = L.e1 + up * 0.35 * k + raise - bend * 0.12;
      L.knee.rotation.z = L.k2 - up * 0.25 * k + raise * 0.6 + bend * 0.18;
      L.ankle.rotation.z = L.k3 + raise * 0.4;
    }
    // the body: a slight bob with each step set, nose up and drawn back when it rears, a kick back when it throws
    body.position.set(shake * 0.02, Math.abs(Math.sin(step)) * 0.02 * k * (A?.still ? 0 : 1) - bend * 0.03, -0.14 * rearUp + 0.1 * rock);
    body.rotation.z = shake * 0.04;
    stretch(body, len);
    front.rotation.x = -rearUp * 0.16 + rock * 0.1 + dip * 0.05;
    rear.rotation.x = -rearUp * 0.35 - flick * 0.3;                          // abdomen tucked, then whipped to aim
    for (const p of palps) p.rotation.x = Math.sin(drum + e.phase) * 0.15 + rearUp * -0.4;   // palps drum, lift when it rears
    if (A) eyes(face, A);
  };
  anim.reset = () => { t = 0; k = 0; drum = 0; frontUp.x = frontUp.v = spread.x = spread.v = 0; stretch(body, 1); body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); face.children.forEach((c) => { c.scale.y = 1; c.rotation.x = 0; }); };   // (a pooled model killed mid-throw)
  return { body: outer, face: new THREE.Group(), anim };
}

// ------------------------------------------------------------------ house fly
// A common house fly: a bristly black thorax dusted grey, a big pair of glossy red-brown
// compound eyes, a sponge-tipped proboscis, a short dark abdomen with tan sides, two clear
// amber-veined wings and six spiny reddish-brown legs. It flies with its wings a blur and its
// legs dangling; to attack it hangs beside you rubbing its front legs, draws its head back, then
// shoots its straw of a mouth out at you (the proboscis telescopes to several times its length).
// About 2.4 radii long.
function flyParts() {
  const R = seeded(29), hair = '#070606', leg = '#4e1c10', legDark = '#220a06';
  const hairs = (n, center, radius, len, up = 0.6) => {
    const out = [];
    for (let k = 0; k < n; k++) {
      const d = new THREE.Vector3(R() - 0.5, R() * up + (1 - up) * (R() - 0.5), R() - 0.5).normalize();
      const a = center.clone().add(d.clone().multiply(radius));
      out.push(rod(a, a.clone().addScaledVector(d, len * (0.5 + R() * 0.8)), 0.009, 0.002, hair));
    }
    return out;
  };
  // the thorax: black, dusted grey, with the house fly's dark stripes down the back (front u = 0.25)
  const thorax = wingTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#16161a'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${120 + R() * 60 | 0},${120 + R() * 60 | 0},${125 + R() * 60 | 0},${0.15 + R() * 0.25})`; g.fillRect(R() * w, R() * h * 0.7, 1.5, 1.5); }
    g.fillStyle = 'rgba(95,95,104,.55)';                         // grey bands between the dark stripes
    for (const u of [0.25, 0.75]) for (const off of [-0.07, 0.07]) { g.beginPath(); g.ellipse((u + off) * w, h * 0.22, 6, h * 0.24, 0, 0, 7); g.fill(); }
  });
  // the abdomen (its pole runs front to back: v = 0 at the waist): dark segments with a grey
  // checkered sheen, tan patches on the sides (u = 0 / 0.5), darker on top (u = 0.75)
  const abdomen = wingTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#1c1a1a'; g.fillRect(0, 0, w, h);
    for (const u of [0, 0.5, 1]) { const gr = g.createRadialGradient(u * w, h * 0.35, 2, u * w, h * 0.35, w * 0.16); gr.addColorStop(0, 'rgba(176,132,70,.85)'); gr.addColorStop(1, 'rgba(176,132,70,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    for (let k = 0; k < 4; k++) {                                 // segments, each a checker of grey dust
      const y = h * (0.12 + k * 0.2);
      for (let i = 0; i < 16; i++) { g.fillStyle = (i + k) % 2 ? 'rgba(130,130,140,.35)' : 'rgba(0,0,0,.25)'; g.fillRect(i * w / 16, y, w / 16, h * 0.14); }
      g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(0, y + h * 0.14, w, h * 0.04);
    }
  });
  // compound eyes: hundreds of tiny glossy facets in deep red-brown
  const eye = wingTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#5a1408'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < w; x += 4) {
      g.fillStyle = `rgb(${150 + R() * 40 | 0},${48 + R() * 20 | 0},${18 + R() * 10 | 0})`;
      g.beginPath(); g.arc(x + 2, y + 2, 1.5, 0, 7); g.fill();
    }
  });
  // a wing: clear amber membrane, smoky at the base, with dark veins fanning to the tip
  const wing = wingTexture(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const m = g.createLinearGradient(0, 0, w, 0); m.addColorStop(0, 'rgba(120,96,60,.75)'); m.addColorStop(0.35, 'rgba(210,190,140,.45)'); m.addColorStop(1, 'rgba(225,215,180,.35)');
    g.fillStyle = m; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(70,46,22,.9)'; g.lineCap = 'round';
    for (const [y0, y1, lw] of [[0.04, 0.06, 3], [0.1, 0.3, 2.2], [0.14, 0.55, 2], [0.18, 0.78, 1.8], [0.2, 0.95, 1.5]]) {
      g.lineWidth = lw; g.beginPath(); g.moveTo(2, h * y0); g.bezierCurveTo(w * 0.4, h * y0, w * 0.7, h * (y0 + y1) / 2, w * 0.98, h * y1); g.stroke();
    }
    g.lineWidth = 1.4;                                           // two cross veins
    for (const x of [0.38, 0.62]) { g.beginPath(); g.moveTo(w * x, h * 0.12); g.lineTo(w * (x + 0.04), h * 0.6); g.stroke(); }
  });
  const body = [
    // the head: a dark capsule between the eyes, the face plate and antennae
    ellipsoid(0.3, 0.28, 0.2, V(0, 0.04, 0.66), '#18181c', 18),
    ellipsoid(0.12, 0.16, 0.06, V(0, -0.02, 0.84), '#3a3a40', 12),
    ...[-1, 1].flatMap((s) => [rod(V(s * 0.05, 0.1, 0.84), V(s * 0.07, 0.14, 0.92), 0.025, 0.02, '#2a2a2e'), rod(V(s * 0.07, 0.14, 0.92), V(s * 0.12, 0.2, 0.97), 0.01, 0.003, hair)]),
    // the neck and waist
    ellipsoid(0.14, 0.13, 0.12, V(0, 0.03, 0.52), '#101012', 10),
    ellipsoid(0.16, 0.14, 0.1, V(0, 0.0, -0.14), '#101012', 10),
    // the halteres: little knobbed balancers behind the wings
    ...[-1, 1].flatMap((s) => [rod(V(s * 0.16, 0.12, -0.08), V(s * 0.24, 0.12, -0.18), 0.012, 0.01, '#3a3020'), ellipsoid(0.03, 0.03, 0.03, V(s * 0.25, 0.12, -0.19), '#c8b080', 8)]),
    ...hairs(46, V(0, 0.08, 0.16), V(0.36, 0.3, 0.4), 0.13),      // the thorax's bristles
    ...hairs(30, V(0, 0.0, -0.46), V(0.32, 0.26, 0.42), 0.09, 0.3),   // and the abdomen's, finer
    ...hairs(14, V(0, 0.08, 0.66), V(0.24, 0.24, 0.14), 0.07),    // the head's
  ];
  // a leg, hanging down and out on the +x side from its hip; fwd tilts it toward the front (+z)
  const legGeo = (fwd, sc) => {
    const a = V(0, 0, 0), b = V(0.26 * sc, -0.1, fwd * 0.08), c = V(0.38 * sc, -0.42 * sc, fwd * 0.16), d = V(0.42 * sc, -0.7 * sc, fwd * 0.28);
    const parts = [rod(a, b, 0.05, 0.042, leg), rod(b, c, 0.04, 0.03, leg), rod(c, d, 0.026, 0.014, legDark),
      ellipsoid(0.045, 0.045, 0.045, b, legDark, 8), ellipsoid(0.034, 0.034, 0.034, c, legDark, 8),
      ...[-1, 1].map((k) => rod(d, d.clone().add(V(k * 0.03, -0.03, 0.04)), 0.01, 0.003, legDark))];   // the claws
    for (const [p, q, n] of [[a, b, 4], [b, c, 7], [c, d, 6]]) {   // spines along each segment
      for (let k = 0; k < n; k++) {
        const at = p.clone().lerp(q, 0.15 + R() * 0.8), dir = new THREE.Vector3(R() - 0.3, R() - 0.2, R() - 0.5).normalize();
        parts.push(rod(at, at.clone().addScaledVector(dir, 0.05 + R() * 0.04), 0.006, 0.0015, hair));
      }
    }
    return merge(parts);
  };
  return {
    body: merge(body), thorax, abdomen, eye, wing,
    // the proboscis: a unit-long trunk along +z (stretched to length) and the spongy pad at its tip
    trunk: merge([rod(V(0, 0, 0), V(0, 0, 1), 0.065, 0.045, '#5a3220'), rod(V(0, 0, 0.3), V(0, 0, 0.32), 0.072, 0.072, '#7a4a2c'), rod(V(0, 0, 0.65), V(0, 0, 0.67), 0.058, 0.058, '#7a4a2c')]),
    pad: merge([ellipsoid(0.075, 0.04, 0.065, V(0, 0, 0.02), '#4a2c1c', 12), ellipsoid(0.05, 0.02, 0.045, V(0, -0.02, 0.03), '#6a3a24', 10)]),
    thoraxGeo: new THREE.SphereGeometry(1, 36, 24).scale(0.36, 0.32, 0.42).translate(0, 0.07, 0.16),
    abdomenGeo: new THREE.SphereGeometry(1, 36, 24).rotateX(Math.PI / 2).scale(0.32, 0.26, 0.46).translate(0, -0.02, -0.5),
    eyeGeo: new THREE.SphereGeometry(1, 28, 20).scale(0.19, 0.25, 0.2),
    wingGeo: wingGeometry(1.25, 0.46, 0.55),
    legs: [[0.22, 1, 1.05], [0.08, 0, 1], [-0.08, -1, 1.1]].map(([z, fwd, sc]) => ({ z, geo: legGeo(fwd, sc) })),
  };
}

export function buildHouseFly() {
  const G = (GEO.housefly ||= flyParts()), M = mats();
  const skin = (map, rough, lit = { base: 0.2, rim: 0.55 }) => { const m = new THREE.MeshStandardMaterial({ map, roughness: rough, metalness: 0.05 }); standOut(m, lit); return m; };
  M.flyThorax ||= skin(G.thorax, 0.45);
  M.flyAbdomen ||= skin(G.abdomen, 0.3);
  if (!M.flyEye) { M.flyEye = skin(G.eye, 0.18, { base: 0.35, rim: 0.5 }); M.flyEye.emissive = new THREE.Color(0x3a0a02); }
  M.flyWing ||= new THREE.MeshStandardMaterial({ map: G.wing, transparent: true, side: THREE.DoubleSide, roughness: 0.15, depthWrite: false });
  if (!M.flyLeg) { M.flyLeg = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.05 }); standOut(M.flyLeg, { base: 0.1, rim: 0.25 }); }
  const outer = new THREE.Group(), body = new THREE.Group();
  outer.add(body);
  const add = (parent, geo, mat, at) => { const m = new THREE.Mesh(geo, mat); if (at) m.position.copy(at); parent.add(m); return m; };
  add(body, G.thoraxGeo, M.flyThorax);
  add(body, G.abdomenGeo, M.flyAbdomen);
  add(body, G.body, M.flyLeg);
  for (const s of [-1, 1]) { const e = add(body, G.eyeGeo, M.flyEye, V(s * 0.19, 0.08, 0.7)); e.rotation.y = s * 0.35; }
  const face = angryEyes({ y: 0.12, z: 0.88, size: 0.1, gap: 0.21 });   // glaring out of the big red eyes
  body.add(face);
  // the proboscis hangs from under the head; it swings up to aim and telescopes out to poke
  const straw = new THREE.Group();
  straw.position.set(0, -0.14, 0.74);
  body.add(straw);
  const trunk = add(straw, G.trunk, M.flyLeg), pad = add(straw, G.pad, M.flyLeg);
  // wings: a sweep group at the root (spread into a V), and inside it the flap about the body's length
  const wings = [-1, 1].map((s) => {
    const sweep = new THREE.Group();
    sweep.position.set(s * 0.12, 0.3, 0.26);
    sweep.rotation.y = -s * 0.42;
    const flap = new THREE.Group();
    sweep.add(flap);
    const w = add(flap, G.wingGeo, M.flyWing);
    w.scale.x = s;
    body.add(sweep);
    return { s, sweep, flap };
  });
  // legs: three a side under the thorax, mirrored for the left
  const legs = [];
  G.legs.forEach((L, pair) => {
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.14, -0.14, L.z);
      hip.scale.x = s;
      add(hip, L.geo, M.flyLeg);
      body.add(hip);
      legs.push({ s, pair, hip });
    }
  });

  pad.name = 'tip';                              // (the stories look for where the straw ends)
  straw.rotation.order = 'YXZ';                  // aimed sideways first, then up or down
  let t = 0;
  const BASE_Y = -0.14, BASE_Z = 0.74, AIM = 1.15, LEN = 0.22;   // where the straw hangs from (under its head), how it hangs at rest
  // its poke (attack-motion "lunge", src/attack-motion.js): rubs its front legs, head drawing back and straw curling
  // up; the rubbing stops dead and the legs spread (the tell); the straw shoots out on the word's own clock, the body
  // following a frame late, stretched; held out its tip buzzes, dying away. Then the straw whips back and curls past
  // its rest pose; landed, the head rocks back, missed it tips forward off balance; it wipes its face and squares up.
  // The straw's tip is always drawn on the spot the poke tests (e.pokeAt), whatever the body is doing.
  const anim = (dt, e) => {
    t += dt;
    const A = e.atk, ph = A ? A.phase : 'idle', S = THREE.MathUtils.smoothstep, clamp = THREE.MathUtils.clamp;
    let back = 0, rear = 0, len = 1, roll = 0, shake = 0, rub = 0, spread = 0, tuck = 0, bob = 1, aim = AIM, slen = LEN, hit = 0, ext = 0, nod = 0;
    if (ph === 'build') {
      const c = coil(A.k, A.style.hold, A.style.over) * A.vary, k = Math.min(1, c);
      back = -0.25 * c; rear = 0.2 * c;
      if (lockBeat(A)) rear -= 0.1;              // the lock: its head dips at you
      aim = AIM + 0.3 * k; slen = LEN - 0.08 * k;
      rub = A.still ? 0 : S(A.pt, 0, 0.06); spread = A.still ? 1 : 0;   // the rubbing stops dead, the legs spread: that is the tell
      shake = (A.still ? 0 : quiver(A.k, A.t, e.phase)) * A.quiet;
      bob = 0;                                   // it hangs in the air, still
    } else if (ph === 'swing') {
      ext = e.state === 'poke' ? e.pokeK : 1;    // the straw, on the word's own clock (held out through the hold)
      const k = ext * ext * ext, bk = k * ext;   // the body follows a frame late: a steeper curve
      back = -0.25 * A.vary * (1 - bk) + 0.15 * bk; rear = 0.2 * A.vary * (1 - bk);
      len = A.smear ? 1 + (knobs().smear - 1) * 0.5 : 1 + (A.tier.stretch - 1) * bk;
      tuck = 1; bob = 0; hit = k;
      aim = AIM + 0.3 * Math.min(1, A.vary); slen = LEN - 0.08 * Math.min(1, A.vary);
    } else if (ph === 'recoil') {
      const p = A.pt, b = settle(Math.min(1, p / 0.55), A.style.bounces, A.style.damp) * Math.min(1, p / 0.05), u = 1 - S(p, 0, 0.12);
      back = 0.15 * u + (A.hit ? -0.3 : 0.12) * b; rear = (A.hit ? 0.45 : -0.35) * b;   // landed: head rocks back; missed: tips forward
      roll = A.hit ? 0 : A.side * 0.2 * b;
      len = 1 + (A.tier.stretch - 1) * u;
      tuck = 1 - S(p, 0, 0.25); bob = S(p, 0.3, 0.7);
      rub = S(p, 0.25, 0.3) * (1 - S(p, 0.65, 0.7));   // wipes its face with its front legs
      nod = Math.sin(Math.PI * clamp((A.k - 0.9) * 10, 0, 1)) * 0.12;   // and squares up in the last 0.2 s
      aim = AIM + 0.35 * settle(clamp((p - 0.1) / 0.55, 0, 1), 2, 2);   // curls past its rest pose and settles
      hit = 1 - S(p, 0, 0.1);
    }
    const w = 1 / Math.sqrt(len), by = bob ? Math.sin(t * 5 + e.phase) * 0.08 * bob : 0, rx = 0.08 - rear + nod + shake * 0.04;
    // the straw: from curled up to the spot it tests, as far as the strike has gone; the tip is solved in the body's
    // own frame (its offset, tilt and stretch) so that at full reach it is on e.pokeAt
    let sx = 0, sy = BASE_Y + slen * -Math.sin(aim), sz = BASE_Z + slen * Math.cos(aim);   // where the tip is without a strike
    if (hit > 0 && e.pokeAt) {
      const ry = e.root.rotation.y, dx = e.pokeAt.x - e.pos.x, dz = e.pokeAt.z - e.pos.z, sc = e.mesh.scale, cy = Math.cos(ry), sy0 = Math.sin(ry);
      let ty = (e.pokeAt.y - e.pos.y) / sc.y - by, tz = (dx * sy0 + dz * cy) / sc.z - back;   // its frame, minus the body's offset
      const tx = (dx * cy - dz * sy0) / sc.x / w, cs = Math.cos(rx), sn = Math.sin(rx), y2 = ty * cs + tz * sn;
      tz = (-ty * sn + tz * cs) / len; ty = y2 / w;                                       // un-tilt, un-stretch
      sx = tx * hit; sy += (ty - sy) * hit; sz += (tz - sz) * hit;
    }
    const dy = sy - BASE_Y, dz = sz - BASE_Z, h = Math.hypot(sx, dz), buzz = A && ph === 'swing' && ext >= 1 ? Math.sin(t * 90) * 0.04 * S(A.pt, 0.09, 0.1) * (1 - S(A.pt, 0.1, 0.25)) : 0;
    straw.rotation.set(Math.atan2(-dy, h) + buzz, Math.atan2(sx, dz), 0);   // (the jelly may have strafed since it locked on)
    const reach = Math.hypot(h, dy);
    trunk.scale.set(1, 1, reach);
    pad.position.z = reach;
    for (const W of wings) W.flap.rotation.z = W.s * (0.15 + Math.sin(t * 85 + (W.s > 0 ? 0 : 0.4)) * 0.75);   // a blur of wings
    for (const L of legs) {
      const sway = Math.sin(t * 3 + L.pair + e.phase) * 0.08;
      if (L.pair === 0) {
        // the front pair: dangling, raised and rubbed together before a poke (spread wide as it locks), and to wipe its face
        L.hip.rotation.x = sway * (1 - rub) - rub * (1.15 + Math.sin(t * 32) * L.s * 0.18) + tuck * 0.3;
        L.hip.rotation.z = -L.s * (rub * (0.5 + Math.sin(t * 32 + 1) * 0.1) + spread * 0.45);
      } else {
        L.hip.rotation.x = sway + (L.pair === 2 ? 0.35 : 0.1) + tuck * 0.15;   // trailing back
        L.hip.rotation.z = 0;
      }
    }
    // the body: a hovering bob; reared back and drawn in for the poke, a jab forward with it
    body.position.set(0, by, back);
    body.rotation.set(rx, 0, roll + shake * 0.03);
    stretch(body, len);
    if (A) eyes(face, A);
  };
  anim.reset = () => { t = 0; stretch(body, 1); body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); straw.rotation.set(AIM, 0, 0); trunk.scale.set(1, 1, LEN); pad.position.z = LEN; for (const W of wings) W.flap.rotation.z = 0; for (const L of legs) { L.hip.rotation.x = 0; L.hip.rotation.z = 0; } face.children.forEach((c) => { c.scale.y = 1; c.rotation.x = 0; }); };
  return { body: outer, face: new THREE.Group(), anim };
}

// ------------------------------------------------------------------ millipede
// A giant millipede: a head with feelers, 22 thick glossy olive-black rings, each with an orange band at
// its back edge, a pale belly and two pairs of little orange legs, and a pointed tail. Its body
// follows the path its head took, so it slithers like a snake while the legs ripple down it in
// waves. To attack it coils into a tight spiral standing on its edge like a wheel (head in the
// middle, like the real thing), spins it up and rolls at you. The head is the enemy's middle; the
// body trails about 9 radii behind it, and the coiled ball is about 4 radii across.
const MIL = { rings: 22, gap: 0.36, a: 0.42, b: 0.9 / (Math.PI * 2), y: 0.5, fat: 1.35 };   // fat: how much thicker than the base parts   // spacing and the coil's spiral (radius units)
function millipedeParts() {
  const R = seeded(41);
  // a ring (u around the body: 0.25 belly, 0.75 back; v front 0 -> back 1)
  const ring = wingTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#12160c'; g.fillRect(0, 0, w, h);
    for (const u of [0, 0.5, 1]) { const gr = g.createRadialGradient(u * w, h * 0.42, 2, u * w, h * 0.42, w * 0.2); gr.addColorStop(0, 'rgba(84,96,40,.9)'); gr.addColorStop(1, 'rgba(84,96,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    const belly = g.createRadialGradient(w * 0.25, h * 0.45, 2, w * 0.25, h * 0.45, w * 0.16); belly.addColorStop(0, 'rgba(214,160,116,.95)'); belly.addColorStop(1, 'rgba(214,160,116,0)');
    g.fillStyle = belly; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(225,232,215,.45)';                       // the glossy highlight along the back
    g.beginPath(); g.ellipse(w * 0.7, h * 0.4, w * 0.035, h * 0.22, 0, 0, 7); g.fill();
    g.fillStyle = '#d0581c'; g.fillRect(0, h * 0.76, w, h * 0.1);  // the orange band at the back edge
    g.fillStyle = '#2a0e06'; g.fillRect(0, h * 0.86, w, h * 0.14);
    for (let k = 0; k < 120; k++) { g.fillStyle = `rgba(220,230,200,${0.1 + R() * 0.2})`; g.fillRect(R() * w, R() * h * 0.75, 1, 1); }   // a dusting of specks
  });
  const ringGeo = new THREE.SphereGeometry(1, 22, 14).rotateX(Math.PI / 2).scale(0.46, 0.42, 0.42);
  // the legs under one ring: two pairs, splayed out and down to the floor
  const leg = '#c06a2c', legTip = '#8a3a14', legs = [];
  for (const s of [-1, 1]) for (const z of [-0.07, 0.08]) {
    const a = V(s * 0.2, -0.17, z), b = V(s * 0.36, -0.2, z + 0.03), c = V(s * 0.42, -0.36, z + 0.06);
    legs.push(rod(a, b, 0.032, 0.026, leg), rod(b, c, 0.026, 0.012, legTip));
  }
  // the head: a dark glossy dome, the orange collar behind it, jaws and segmented feelers
  const head = [
    ellipsoid(0.32, 0.27, 0.3, V(0, 0, 0.02), '#161a10', 18),
    ellipsoid(0.36, 0.3, 0.1, V(0, 0.01, -0.2), '#c8541c', 16),
    ellipsoid(0.12, 0.08, 0.08, V(-0.09, -0.16, 0.24), '#2a1a10', 10),
    ellipsoid(0.12, 0.08, 0.08, V(0.09, -0.16, 0.24), '#2a1a10', 10),
  ];
  for (const s of [-1, 1]) {
    const pts = [V(s * 0.12, 0.08, 0.26), V(s * 0.22, 0.2, 0.42), V(s * 0.3, 0.24, 0.6), V(s * 0.42, 0.2, 0.74)];
    for (let k = 0; k < pts.length - 1; k++) head.push(rod(pts[k], pts[k + 1], 0.028 - k * 0.006, 0.022 - k * 0.006, '#2a1a10'), ellipsoid(0.03, 0.03, 0.03, pts[k + 1], '#5a3a20', 8));
  }
  // the tail: the last ring tapering to a point
  const tail = [ellipsoid(0.27, 0.25, 0.28, V(0, 0, 0), '#161a10', 16), rod(V(0, 0.02, -0.22), V(0, 0.04, -0.46), 0.08, 0.008, '#2a2416')];
  return { ring, ringGeo, legs: merge(legs), head: merge(head), tail: merge(tail) };
}

// the coil: where segment i sits (radius units) on a spiral in the y-z plane, head in the middle,
// and which way it faces (toward the head) with its back turned outward
function coilTable(n) {
  const out = [], C = new THREE.Vector3(), P = new THREE.Vector3(), F = new THREE.Vector3(), U = new THREE.Vector3(), X = new THREE.Vector3(), M4 = new THREE.Matrix4();
  const at = (th) => MIL.a + MIL.b * th;
  // arc length for each segment, then the angle there (stepping along the spiral)
  let th = 0, s = 0;
  const ths = [];
  for (let i = 0; i < n; i++) {
    const want = 0.45 + i * MIL.gap;
    while (s < want) { const d = 0.01; s += at(th) * d; th += d; }
    ths.push(th);
  }
  const top = at(th) + 0.43;                     // the coil's outer edge rests on the floor
  C.set(0, top, 0);
  for (const t of ths) {
    const r = at(t);
    P.set(0, r * Math.sin(t), r * Math.cos(t));
    F.set(0, -(MIL.b * Math.sin(t) + r * Math.cos(t)), -(MIL.b * Math.cos(t) - r * Math.sin(t))).normalize();   // toward smaller t: toward the head
    U.copy(P).normalize();
    U.addScaledVector(F, -U.dot(F)).normalize();
    X.crossVectors(U, F);
    out.push({ p: P.clone(), q: new THREE.Quaternion().setFromRotationMatrix(M4.makeBasis(X, U, F)) });
  }
  return { at: out, center: C.clone(), radius: top };
}

export function buildMillipede() {
  const G = (GEO.millipede ||= millipedeParts()), M = mats();
  if (!M.milRing) { M.milRing = new THREE.MeshStandardMaterial({ map: G.ring, roughness: 0.18, metalness: 0.1 }); standOut(M.milRing, { base: 0.18, rim: 0.55 }); }
  if (!M.milPart) { M.milPart = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.08 }); standOut(M.milPart, { base: 0.16, rim: 0.4 }); }
  const N = MIL.rings + 2;                       // head, rings, tail
  const spiral = (G.coil ||= coilTable(N));
  const outer = new THREE.Group(), body = new THREE.Group();
  outer.add(body);
  const segs = [];
  let face = null;
  for (let i = 0; i < N; i++) {
    const seg = new THREE.Group();
    const geo = i === 0 ? G.head : i === N - 1 ? G.tail : G.ringGeo;
    const shell = new THREE.Mesh(geo, i === 0 || i === N - 1 ? M.milPart : M.milRing);
    if (i === 0 || i === N - 1) shell.scale.setScalar(MIL.fat);
    seg.add(shell);
    let legs = null;
    if (i > 0 && i < N - 2) { legs = new THREE.Mesh(G.legs, M.milPart); seg.add(legs); }
    if (i === 0) { face = angryEyes({ y: 0.14, z: 0.36, size: 0.12, gap: 0.16 }); seg.add(face); }
    body.add(seg);
    segs.push({ seg, legs, shell });
  }

  // the body as a chain (world x, z per segment): each one follows the one in front at a fixed
  // gap, like a rope pulled by the head, and segments that aren't neighbours push each other apart
  // so the body never folds through itself
  const W = [];
  const qWalk = new THREE.Quaternion(), qBall = new THREE.Quaternion(), qSpin = new THREE.Quaternion(), qSway = new THREE.Quaternion(), Y = V(0, 1, 0), X = V(1, 0, 0);
  const pWalk = new THREE.Vector3(), pBall = new THREE.Vector3();
  let t = 0, move = 0, gap = 0;
  const follow = () => {
    for (let k = 1; k < N; k++) {
      const a = W[k - 1], b = W[k], dx = b[0] - a[0], dz = b[1] - a[1], d = Math.hypot(dx, dz) || 1e-6;
      b[0] = a[0] + dx / d * gap; b[1] = a[1] + dz / d * gap;
    }
  };
  const smooth = (u) => { u = u < 0 ? 0 : u > 1 ? 1 : u; return u * u * (3 - 2 * u); };
  // its roll (attack-motion "roll", src/attack-motion.js), on top of the word's own curl and spin (curlK, spinA):
  // spinning up it leans back against its lane and squats, rocking harder as it revs, and tips forward at the
  // end; rolling, it leans in, stretched along the lane; stopping, it skids on, over-rotates a quarter turn and
  // topples as it unrolls, tail first and head last, a ripple down the body; resting, its head sways, dizzy,
  // steadying over the last 0.3 s
  const anim = (dt, e) => {
    t += dt;
    const root = e.root, ry = root.rotation.y, sc = Math.max(1e-4, e.mesh.scale.x);
    const hx = e.pos.x, hz = e.pos.z, wide = 0.92 * sc;   // wide: the body's thickness
    gap = MIL.gap * sc;
    if (!W.length) for (let k = 0; k < N; k++) W.push([hx - Math.sin(ry) * k * gap, hz - Math.cos(ry) * k * gap]);
    W[0][0] = hx; W[0][1] = hz;
    follow();
    for (let pass = 0; pass < 2; pass++) {
      let pushed = false;
      for (let a = 0; a < N; a++) for (let b = a + 3; b < N; b++) {
        const A = W[a], B = W[b], dx = B[0] - A[0], dz = B[1] - A[1], d = Math.hypot(dx, dz);
        if (d >= wide || d < 1e-7) continue;
        const k = (wide - d) / d * 0.5;
        if (a > 0) { A[0] -= dx * k; A[1] -= dz * k; B[0] += dx * k; B[1] += dz * k; }
        else { B[0] += dx * k * 2; B[1] += dz * k * 2; }        // the head goes where it goes: the body gives way
        pushed = true;
      }
      if (!pushed) break;
      W[0][0] = hx; W[0][1] = hz;
      follow();
    }
    move += (Math.min(1, Math.hypot(e.vel.x, e.vel.z) * 8) - move) * (1 - Math.exp(-8 * dt));
    const curl = e.curlK || 0, K = e.atk, ph = K ? K.phase : 'idle';
    let lean = 0, squat = 0, len = 1, tilt = 0, skid = 0, over = 0, wave = 0, sway = 0;
    const u = K && K.len > 0 ? Math.min(1, K.st / K.len) : 0;          // through this step of the attack
    if (ph === 'build' && K.key === 'spin') {
      const c = coil(u, K.style.hold, K.style.over) * K.vary, end = smooth(1 - (K.len - K.st) / 0.15);
      lean = -0.21 * c * (1 - end) + 0.1 * end; squat = 0.06 * c;
      lean += (K.still ? 0 : 1) * quiver(u, K.t, e.phase, 18) * 0.08 * K.quiet;   // rocking harder as it revs
    } else if (ph === 'swing') {
      const s = snap(Math.min(1, K.pt / K.style.strike), K.tier.over);
      lean = 0.1 + 0.16 * s * K.vary; len = 1 + (K.tier.stretch - 1) * 0.5 * s * (K.smear ? 1.5 : 1);
      squat = 0.06 * K.vary * (1 - s);                                  // (from the spin's squat, not a pop)
    } else if (ph === 'recoil' && K.key !== 'rest') {
      const q = Math.min(1, K.k * 2);                                   // (the uncurl fills the first half of the recoil)
      skid = 0.25 * Math.sin(Math.PI * q); over = Math.PI / 2 * (1 - (1 - q) * (1 - q));
      tilt = K.side * 0.6 * Math.sin(Math.PI * q); wave = 0.05 * Math.sin(Math.PI * q);
      const ease = 1 - smooth(q * 3);                                   // the roll's lean and stretch, let go
      lean = 0.26 * K.vary * ease; len = 1 + (K.tier.stretch - 1) * 0.5 * ease;
    } else if (ph === 'recoil') sway = Math.sin(K.t * 7 + e.phase) * 0.4 * K.vary * Math.min(1, (1 - u) * K.len / 0.3, K.st / 0.1);
    const spin = (e.spinA || 0) + over, unroll = ph === 'recoil';
    qSpin.setFromAxisAngle(X, spin);
    for (let i = 0; i < N; i++) {
      const wx = W[i][0], wz = W[i][1];
      // each segment faces the one in front of it; the head faces away from the one behind (where it's going)
      const f = i === 0 ? W[0] : W[i - 1], b = i === 0 ? W[1] : W[i];
      const tx = f[0] - b[0], tz = f[1] - b[1];
      const dx = wx - hx, dz = wz - hz, c = Math.cos(ry), s = Math.sin(ry);
      pWalk.set((dx * c - dz * s) / sc, MIL.y, (dx * s + dz * c) / sc);
      qWalk.setFromAxisAngle(Y, Math.atan2(tx, tz) - ry);
      // the coil, spun about its axle
      const C = spiral.at[i];
      pBall.copy(C.p).applyQuaternion(qSpin).add(spiral.center);
      qBall.copy(qSpin).multiply(C.q);
      // the tail curls in first, the head last
      const ki = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(curl * 1.5 - (unroll ? i / N : 1 - i / N) * 0.5, 0, 1), 0, 1);   // and uncurls tail first, head last
      const S = segs[i];
      S.seg.position.lerpVectors(pWalk, pBall, ki);
      S.seg.position.y += Math.sin(t * 9 - i * 0.7) * (0.015 * move + wave) * (1 - ki);   // a slight ripple as it goes
      S.seg.quaternion.slerpQuaternions(qWalk, qBall, ki);
      if (i === 0 && sway) S.seg.quaternion.multiply(qSway.setFromAxisAngle(Y, sway));
      if (S.legs) {
        // the leg wave: each pair steps a little after the one in front of it
        S.legs.rotation.x = Math.sin(t * 14 - i * 0.9) * 0.5 * (0.3 + move) * (1 - ki);
        S.legs.scale.setScalar(MIL.fat * (1 - ki * 0.6));          // tucked in when coiled
      }
    }
    body.rotation.set(lean, 0, tilt);
    body.position.set(0, 0, skid);
    const w = 1 / Math.sqrt(len) * (1 + squat * 0.5);
    body.scale.set(w, (1 - squat) / Math.sqrt(len), len);
    if (K) eyes(face, K);
  };
  anim.reset = () => { t = 0; move = 0; W.length = 0; body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); body.scale.set(1, 1, 1); face.children.forEach((c) => { c.scale.y = 1; c.rotation.x = 0; }); };
  return { body: outer, face: new THREE.Group(), anim, ballRadius: spiral.radius, deathParts: [segs[3].shell] };   // radius units: how big the rolling ball is
}

// ------------------------------------------------------------------ homing missile
// A little guided missile, `L` long along +z: a white body with red bands, a dark ogive nose with a
// glowing seeker tip, four canards forward and four swept tail fins, a nozzle and a flame (two
// additive cones, flickered by whoever flies it). Used in flight (meters, enemies.js) and loaded
// on the ladybug's back (radius units).
const MISSILE_MAT = {};
function missileModel(L) {
  const M = MISSILE_MAT;
  M.body ||= new THREE.MeshStandardMaterial({ color: 0xf2f3f5, metalness: 0.35, roughness: 0.3 });
  M.nose ||= new THREE.MeshStandardMaterial({ color: 0x2a2e36, metalness: 0.5, roughness: 0.25 });
  M.band ||= new THREE.MeshStandardMaterial({ color: 0xd8261a, metalness: 0.2, roughness: 0.3, emissive: 0x5a0800, emissiveIntensity: 0.6 });
  M.fin ||= new THREE.MeshStandardMaterial({ color: 0x4a4f58, metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide });
  M.glass ||= new THREE.MeshStandardMaterial({ color: 0x1a0a0a, metalness: 0.2, roughness: 0.05, emissive: 0xff3a2a, emissiveIntensity: 1.4 });
  M.flame ||= new THREE.MeshBasicMaterial({ color: 0xff8a30, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  M.core ||= new THREE.MeshBasicMaterial({ color: 0xfff4c8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const r = 0.085 * L, g = new THREE.Group();
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); g.add(m); return m; };
  const alongZ = (geo) => geo.rotateX(Math.PI / 2);
  add(alongZ(new THREE.CylinderGeometry(r, r, 0.6 * L, 20)).translate(0, 0, -0.08 * L), M.body);                    // fuselage
  add(alongZ(new THREE.CylinderGeometry(r * 1.04, r * 1.04, 0.07 * L, 20)).translate(0, 0, 0.16 * L), M.band);       // red bands
  add(alongZ(new THREE.CylinderGeometry(r * 1.04, r * 1.04, 0.03 * L, 20)).translate(0, 0, -0.3 * L), M.band);
  const ogive = [[r, 0], [r * 0.96, 0.06 * L], [r * 0.82, 0.13 * L], [r * 0.58, 0.2 * L], [r * 0.3, 0.25 * L], [0.0001, 0.27 * L]].map(([x, y]) => new THREE.Vector2(x, y));
  add(new THREE.LatheGeometry(ogive, 20).rotateX(Math.PI / 2).translate(0, 0, 0.22 * L), M.nose);                    // nose cone
  add(new THREE.SphereGeometry(r * 0.38, 12, 8).translate(0, 0, 0.475 * L), M.glass);                                 // seeker
  add(alongZ(new THREE.CylinderGeometry(r * 0.72, r * 0.86, 0.06 * L, 16)).translate(0, 0, -0.41 * L), M.fin);       // nozzle
  const fin = (len, span, sweep, z) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(span, -sweep); s.lineTo(span, -sweep - len * 0.35); s.lineTo(0, -len); s.closePath();
    // shape in x (span) / y (length): lay its length along -z
    return new THREE.ShapeGeometry(s).rotateX(Math.PI / 2).translate(r * 0.9, 0, z);
  };
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    add(fin(0.2 * L, 0.17 * L, 0.06 * L, -0.2 * L).rotateZ(a), M.fin);                                                 // swept tail fins
    add(fin(0.07 * L, 0.07 * L, 0.02 * L, 0.13 * L).rotateZ(a), M.fin);                                                // canards
  }
  const flame = new THREE.Group();
  flame.name = 'flame';
  flame.position.z = -0.44 * L;
  flame.add(new THREE.Mesh(new THREE.ConeGeometry(r * 0.85, 0.36 * L, 12, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.18 * L), M.flame));
  flame.add(new THREE.Mesh(new THREE.ConeGeometry(r * 0.45, 0.2 * L, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.1 * L), M.core));
  g.add(flame);
  return { group: g, flame, length: L };
}

// Only the two model sizes used by the game are retained; meshes animate independently.
const MISSILE_MODELS = new Map();
export function buildMissile(L = 0.04) {
  if (!MISSILE_MODELS.has(L)) MISSILE_MODELS.set(L, missileModel(L).group);
  const group = MISSILE_MODELS.get(L).clone();
  return { group, flame: group.getObjectByName('flame'), length: L };
}

// ------------------------------------------------------------------ ladybug
// A seven-spot ladybird: two glossy clear-coated red elytra (the wing cases) hinged at the front,
// each with three black spots and half of the shared one by the scutellum; a black pronotum with
// cream corner patches; a small black head with cream eye-spots and clubbed feelers; six jointed
// black legs; and smoky veined hind wings folded away under the elytra. It flies with the elytra
// half raised and the hind wings a blur (like the photo); landed, it lifts its red carapace high
// to show the missile on a rail on its back, and fires it. About 2.3 radii long; landed, its feet
// are 0.76 radii below its middle.
function ladybugParts() {
  const wing = wingTexture(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const m = g.createLinearGradient(0, 0, w, 0); m.addColorStop(0, 'rgba(60,50,46,.75)'); m.addColorStop(0.5, 'rgba(110,96,88,.45)'); m.addColorStop(1, 'rgba(150,140,130,.3)');
    g.fillStyle = m; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(30,22,18,.9)'; g.lineCap = 'round';
    for (const [y0, y1, lw] of [[0.06, 0.1, 3], [0.12, 0.4, 2.2], [0.18, 0.62, 1.8], [0.24, 0.85, 1.5]]) { g.lineWidth = lw; g.beginPath(); g.moveTo(2, h * y0); g.bezierCurveTo(w * 0.35, h * y0, w * 0.7, h * (y0 + y1) / 2, w * 0.97, h * y1); g.stroke(); }
    g.fillStyle = 'rgba(30,22,18,.85)'; g.beginPath(); g.ellipse(w * 0.55, h * 0.12, w * 0.05, h * 0.05, 0, 0, 7); g.fill();   // the dark stigma
  });
  const leg = (s, fwd) => {
    const a = V(0, 0, 0), b = V(s * 0.45, -0.12, fwd * 0.1), c = V(s * 0.7, -0.42, fwd * 0.18), d = V(s * 0.82, -0.52, fwd * 0.34);
    const parts = [rod(a, b, 0.07, 0.06, '#0e0e10'), rod(b, c, 0.055, 0.04, '#141416'), rod(c, d, 0.035, 0.022, '#2a1c14'), ellipsoid(0.06, 0.06, 0.06, b, '#0e0e10', 8)];
    for (const k of [-1, 1]) parts.push(rod(d, d.clone().add(V(k * 0.03, -0.04, 0.05)), 0.012, 0.004, '#2a1c14'));
    for (let k = 0; k < 4; k++) { const at = b.clone().lerp(c, 0.2 + k * 0.2); parts.push(rod(at, at.clone().add(V(s * 0.04, 0.01, 0.03)), 0.008, 0.002, '#3a2a20')); }   // fine spines
    return merge(parts);
  };
  return {
    wing, wingGeo: wingGeometry(1.7, 0.7, 0.55),
    legs: [[0.42, 1], [0.12, 0], [-0.2, -1]].map(([z, fwd]) => ({ z, geo: [leg(-1, fwd), leg(1, fwd)] })),
    under: merge([ellipsoid(0.72, 0.32, 0.9, V(0, -0.14, -0.12), '#121214', 20), ellipsoid(0.5, 0.2, 0.4, V(0, -0.2, 0.42), '#1a1a1c', 14)]),
    antenna: merge([rod(V(0, 0, 0), V(0.08, 0.06, 0.16), 0.022, 0.018, '#5a2a14'), rod(V(0.08, 0.06, 0.16), V(0.16, 0.1, 0.3), 0.018, 0.016, '#8a3a18'), ellipsoid(0.04, 0.035, 0.07, V(0.18, 0.11, 0.34), '#7a3214', 8)]),
  };
}

export function buildLadybug() {
  const G = (GEO.ladybug ||= ladybugParts()), M = mats();
  if (!M.lbRed) {
    M.lbRed = new THREE.MeshPhysicalMaterial({ color: 0xe8260e, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 });
    M.lbBlack = new THREE.MeshPhysicalMaterial({ color: 0x0a0a0c, roughness: 0.25, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1 });
    M.lbInside = new THREE.MeshStandardMaterial({ color: 0x2a0c08, side: THREE.BackSide, roughness: 0.6 });
    M.lbCream = new THREE.MeshStandardMaterial({ color: 0xf4e8c8, roughness: 0.4 });
    M.lbLeg = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.1 });
    M.lbWing = new THREE.MeshStandardMaterial({ map: G.wing, transparent: true, side: THREE.DoubleSide, roughness: 0.2, depthWrite: false });
    standOut(M.lbRed, { base: 0.22, rim: 0.5 }); standOut(M.lbBlack, { base: 0.08, rim: 0.35 }); standOut(M.lbCream, { base: 0.2, rim: 0.3 }); standOut(M.lbLeg, { base: 0.06, rim: 0.25 });
  }
  const outer = new THREE.Group(), body = new THREE.Group();
  outer.add(body);
  const add = (parent, geo, mat, at) => { const m = new THREE.Mesh(geo, mat); if (at) m.position.copy(at); parent.add(m); return m; };
  add(body, G.under, M.lbLeg);
  // a disc lying on an ellipsoid (centre C, radii E) in direction d: the spots and patches
  G.spot ||= new THREE.SphereGeometry(1, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const onShell = (parent, C, E, d, r, mat, lift = 0.012) => {
    const u = d.clone().normalize(), p = V(C.x + E.x * u.x, C.y + E.y * u.y, C.z + E.z * u.z);
    const n = V(u.x / E.x, u.y / E.y, u.z / E.z).normalize();
    const m = add(parent, G.spot, mat);
    m.scale.set(r, 0.035, r * 0.92);
    m.position.copy(p).addScaledVector(n, lift);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), n);
    return m;
  };
  // pronotum and head
  const PC = V(0, -0.02, 0.74), PE = V(0.6, 0.4, 0.34);
  add(body, G.pronotum ||= new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.62).scale(PE.x, PE.y, PE.z).translate(PC.x, PC.y, PC.z), M.lbBlack);
  for (const s of [-1, 1]) { onShell(body, PC, PE, V(s * 0.75, 0.42, 0.5), 0.16, M.lbCream); onShell(body, PC, PE, V(s * 0.25, 0.4, 0.88), 0.07, M.lbCream); }
  const HC = V(0, -0.1, 1.04), HE = V(0.32, 0.22, 0.2);
  add(body, G.head ||= new THREE.SphereGeometry(1, 24, 14).scale(HE.x, HE.y, HE.z).translate(HC.x, HC.y, HC.z), M.lbBlack);
  for (const s of [-1, 1]) onShell(body, HC, HE, V(s * 0.6, 0.35, 0.7), 0.07, M.lbCream);
  const antennae = [-1, 1].map((s) => { const a = add(body, G.antenna, M.lbLeg, V(s * 0.12, -0.04, 1.2)); a.scale.x = s; return a; });
  const face = angryEyes({ y: -0.06, z: 1.22, size: 0.1, gap: 0.12 });
  body.add(face);
  // the elytra: each a half dome on a hinge at its front inner corner, its spots riding on it
  const EC = V(0, -0.02, -0.16), EE = V(0.92, 0.78, 1.0);
  G.halves ||= {};
  const elytra = [-1, 1].map((s) => {
    const pivot = new THREE.Group(), hinge = V(s * 0.04, EC.y + 0.66, EC.z + 0.58);
    pivot.position.copy(hinge);
    body.add(pivot);
    const shell = new THREE.Group();
    shell.position.copy(hinge).negate();
    pivot.add(shell);
    const half = (k) => G.halves[`${s}:${k}`] ||= new THREE.SphereGeometry(1, 40, 24, s > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI, 0, Math.PI * 0.58).scale(EE.x * k, EE.y * k, EE.z * k).translate(EC.x, EC.y, EC.z);
    add(shell, half(1), M.lbRed);
    add(shell, half(0.97), M.lbInside);
    for (const [d, r] of [[V(s * 0.08, 0.82, 0.58), 0.13], [V(s * 0.72, 0.5, 0.38), 0.13], [V(s * 0.46, 0.86, -0.05), 0.19], [V(s * 0.62, 0.42, -0.62), 0.14]]) onShell(shell, EC, EE, d, r, M.lbBlack);
    pivot.name = 'elytron';
    return { s, pivot };
  });
  // the hind wings, folded under the elytra until it flies
  const wings = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.12, 0.38, 0.36);
    body.add(pivot);
    const flap = new THREE.Group();
    pivot.add(flap);
    const w = add(flap, G.wingGeo, M.lbWing);
    w.scale.x = s;
    return { s, pivot, flap };
  });
  const legs = [];
  G.legs.forEach((L, pair) => [-1, 1].forEach((s, side) => {
    const hip = new THREE.Group();
    hip.position.set(s * 0.32, -0.24, L.z);
    add(hip, L.geo[side], M.lbLeg);
    body.add(hip);
    legs.push({ s, pair, hip, z0: L.z });
  }));
  // the missile on its rail, between the raised elytra
  const pod = new THREE.Group();
  pod.position.set(0, 0.3, -0.2);
  body.add(pod);
  add(pod, G.rail ||= new THREE.BoxGeometry(0.12, 0.05, 0.9), M.lbBlack).position.set(0, -0.03, 0);
  const loaded = buildMissile(1.25);
  loaded.group.rotation.x = -0.35;                                       // nose up over its head
  loaded.group.position.set(0, 0.08, 0.05);
  loaded.flame.visible = false;
  pod.add(loaded.group);

  const shellSp = { x: 0, v: 0 }, tilt = { x: 0, v: 0 };      // the wing cases (a spring: they open past full and snap shut), the pod's lean at you
  let t = 0, shell = 0, fly = 0, flap = 0;
  // its sortie (attack-motion "throw", src/attack-motion.js; the word's own clocks still say when it lands, opens
  // and flies): touching down it squashes and springs, the wing cases opening a little past full; aiming it braces
  // low with its legs wide, its antennae quivering with the beeps and the pod leaning to you in the last 0.1 s;
  // the missile goes with the pod jumping and the wing cases flaring wider; it slides back with its legs
  // dragging and settles, the wing cases snap shut with a small hop, and it crouches before it takes off
  const anim = (dt, e) => {
    t += dt;
    spring(shellSp, e.shellK ?? 0, 0.08, 3.8, dt);
    shell = Math.max(0, shellSp.x);
    fly += ((e.flyK ?? 0) - fly) * (1 - Math.exp(-9 * dt));
    flap += ((e.wingK ?? 0) - flap) * (1 - Math.exp(-12 * dt));
    const A = e.atk, ph = A ? A.phase : 'idle', key = A ? A.key : '';
    let squash = 0, brace = 0, shake = 0, flare = 0, jump = 0, shove = 0, hop = 0, crouch = 0, len = 1;
    if (A) {
      if (ph === 'build') {
        if (key === 'raise') squash = 0.15 * settle(Math.min(1, A.st / 0.4), 1, 2);   // touching down: squashed, then springing up
        else if (key === 'aim') { brace = THREE.MathUtils.smoothstep(A.st / 0.1, 0, 1); shake = A.still ? 0 : quiver(A.st / A.len, A.t, e.phase) * A.quiet; }   // (the beeps quicken through the aim itself)
      } else if (ph === 'swing') {
        const s = snap(Math.min(1, A.pt / A.style.strike), A.tier.over);
        brace = Math.max(0, 1 - s); flare = s; jump = s; shove = s;
        len = A.smear ? knobs().smear : 1 + (A.tier.stretch - 1) * Math.min(1, s);
      } else if (ph === 'recoil') {
        const u = Math.min(1, Math.max(0, A.pt - A.style.follow) / 0.36);        // the kick: 0.36 s after the follow-through hold
        shove = (1 + A.tier.over) * settle(u, A.style.bounces, A.style.damp);
        if (key === 'close') hop = Math.sin(Math.PI * Math.min(1, Math.max(0, A.st - 0.2) / 0.2)) * 0.07;   // the cases snap shut: a small hop
        else if (key === 'rest') crouch = THREE.MathUtils.smoothstep(1 - (A.len - A.st) / 0.15, 0, 1);       // the last 0.15 s: down before it takes off
      }
    }
    spring(tilt, A && A.still ? 1 : 0, 0.05, 2, dt);
    // elytra: the back lifts on the front hinge and the outer edges swing up and out
    for (const E of elytra) E.pivot.rotation.set(shell * 1.15, -E.s * shell * 0.2, E.s * (shell * 0.7 + flare * 0.26), 'YXZ');
    // hind wings: unfold sideways and back, beating as a blur
    for (const W of wings) {
      W.pivot.scale.setScalar(Math.max(0.001, flap));
      W.pivot.rotation.set(0.15, -W.s * (0.2 + 0.9 * flap), 0);
      W.flap.rotation.z = W.s * (0.2 + Math.sin(t * 90 + (W.s > 0 ? 0 : 0.5)) * 0.85) * flap;
    }
    const slide = -0.2 * shove;
    // legs: a shuffle on the ground, tucked up in flight, wide when it braces, dragging as it slides back
    for (const L of legs) {
      L.hip.rotation.set(fly * 0.9, Math.sin(t * 9 + L.pair * 2.1 + (L.s > 0 ? Math.PI : 0)) * 0.12 * (1 - fly) * (e.stepK ?? 0), L.s * (fly * 0.5 + brace * 0.3));
      L.hip.position.z = L.z0 - slide * 0.7;
    }
    for (const a of antennae) a.rotation.y = Math.sin(t * 5 + e.phase) * 0.15 + (A ? shake * 0.3 : e.state === 'aim' ? Math.sin(t * 30) * 0.1 : 0);
    // the body: nose up in flight with a wobble; a kick back as the missile goes
    body.rotation.x = -fly * 0.35 + Math.sin(t * 7 + e.phase) * 0.05 * fly - (A ? 0.17 * shove : 0.5 * Math.max(0, e.firedT || 0)) + 0.08 * brace + 0.1 * crouch;
    body.position.set(0, Math.sin(t * 6 + e.phase) * 0.06 * fly - 0.1 * brace - 0.1 * crouch + hop, slide);
    stretch(body, len);
    if (squash) { body.scale.x *= 1 + squash * 0.5; body.scale.y *= 1 - squash; body.scale.z *= 1 + squash * 0.5; }
    pod.visible = shell > 0.55 && e.loaded !== false;
    pod.position.y = 0.3 + Math.max(0, shell - 0.4) * 0.3 + jump * 0.1;
    pod.rotation.x = -0.25 * tilt.x;
    if (A) eyes(face, A);
  };
  anim.reset = () => { t = 0; shell = 0; fly = 0; flap = 0; shellSp.x = shellSp.v = tilt.x = tilt.v = 0; stretch(body, 1); body.position.set(0, 0, 0); pod.rotation.x = 0; for (const L of legs) L.hip.position.z = L.z0; face.children.forEach((c) => { c.scale.y = 1; c.rotation.x = 0; }); };   // (a pooled model killed mid-sortie)
  return { body: outer, face: new THREE.Group(), anim, deathParts: [elytra[1].pivot] };
}

// ------------------------------------------------------------------ dragonfly
// A blue darner, after the reference sheet (act 3): huge glossy blue compound eyes meeting on top
// of the head over a pale blue face, a stout hairy thorax in sky blue with black and lime-yellow
// stripes slanting back down its sides, a long thin abdomen of ten black segments each with pairs
// of bright blue spots (a little swollen at the waist and the tip, two claspers at the end), four
// clear wings held straight out, every one a net of fine veins with a dark amber pterostigma near
// the tip, and six black spiny legs held forward under the thorax like a basket. It hovers with
// the fore and hind wings beating out of step, now and then holding them flat to glide, and tips
// its nose down to dart. About 3.2 radii long and 4.2 across the wings.
function dragonflyParts() {
  const R = seeded(53), blue = '#3a9ee0', black = '#0b0d10', hair = '#c8d0d4';
  // the eyes: deep blue, a lighter facet in every cell, a few dark flecks, a bright crown on top
  const eye = wingTexture(512, 256, (g, w, h) => {
    const base = g.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, '#4ab4f4'); base.addColorStop(0.45, '#1866c0'); base.addColorStop(1, '#082a64');
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) for (let x = (y / 3) % 2 ? 1.5 : 0; x < w; x += 3) {
      const l = 40 + R() * 22;
      g.fillStyle = `hsla(${198 + R() * 16},90%,${l}%,.6)`;
      g.beginPath(); g.arc(x + 1.5, y + 1.5, 1.1, 0, 7); g.fill();
    }
    g.fillStyle = 'rgba(5,15,40,.55)';
    for (let k = 0; k < 14; k++) { g.beginPath(); g.arc(R() * w, h * (0.3 + R() * 0.55), 3 + R() * 6, 0, 7); g.fill(); }
  });
  // the thorax (a sphere: u around from +z, v top 0 -> bottom 1): sky blue with lime patches and
  // black stripes slanting back down the sides, darker on the back
  const thorax = wingTexture(512, 256, (g, w, h) => {
    g.fillStyle = '#4aa6d8'; g.fillRect(0, 0, w, h);
    // each side's middle is at u = 0 (+x) or 0.5 (-x); `back` runs from the front of the side to its back
    const band = (c, dir, back, wd, col) => {
      g.fillStyle = col;
      for (const cc of c === 0 ? [0, 1] : [c]) {
        g.beginPath();
        const at = (b, v) => (cc + dir * (b - v * 0.07)) * w;          // slanting forward as it goes down, toward the legs
        g.moveTo(at(back - wd, 0), 0); g.lineTo(at(back + wd, 0), 0); g.lineTo(at(back + wd, 1), h); g.lineTo(at(back - wd, 1), h); g.fill();
      }
    };
    for (const [c, dir] of [[0, 1], [0.5, -1]]) {
      for (const [back, wd, col] of [[-0.21, 0.035, '#0b0d10'], [-0.15, 0.025, '#c9d84a'], [-0.06, 0.022, '#0b0d10'], [0.0, 0.03, '#b8dc48'], [0.07, 0.018, '#0b0d10'], [0.13, 0.03, '#d6dc5a'], [0.2, 0.03, '#0b0d10']]) band(c, dir, back, wd, col);
    }
    g.fillStyle = '#0b0d10'; g.fillRect(0, 0, w, h * 0.07);             // a dark collar round the top
    g.fillStyle = 'rgba(10,20,30,.6)'; g.fillRect(0, h * 0.82, w, h * 0.18);   // and a dark underside
    for (let k = 0; k < 700; k++) { g.fillStyle = `rgba(255,255,255,${R() * 0.1})`; g.fillRect(R() * w, R() * h, 2, 2); }
  });
  // the abdomen (a lathe: u around, 0 = the top, 0.25 = +x; v front 0 -> back 1): ten black
  // segments, each with a pair of blue spots on top, a smaller pair behind, blue on the sides,
  // and a thin pale ring at each joint
  const segs = 10, segAt = (k) => [0, 0.06, 0.13, 0.24, 0.35, 0.46, 0.57, 0.68, 0.79, 0.89, 1][k];
  const abdomen = wingTexture(256, 1024, (g, w, h) => {
    g.fillStyle = black; g.fillRect(0, 0, w, h);
    const spot = (u, v, rx, ry) => { for (const uu of [u, 1 - u]) { g.beginPath(); g.ellipse(uu * w, v * h, rx * w, ry * h, 0, 0, 7); g.fill(); } };
    for (let k = 0; k < segs; k++) {
      const a = segAt(k), b = segAt(k + 1), L = b - a;
      g.fillStyle = blue;
      if (k < 2) { g.fillRect(0, a * h, w, L * h * 0.85); g.fillStyle = black; g.fillRect(w * 0.42, a * h, w * 0.16, L * h); continue; }   // the waist: mostly blue
      spot(0.07, a + L * 0.3, 0.06, L * 0.24);                        // the big pair on top
      spot(0.05, a + L * 0.75, 0.035, L * 0.12);                      // a small pair behind
      spot(0.25, a + L * 0.45, 0.07, L * 0.3);                        // the sides
      g.fillStyle = 'rgba(140,200,240,.5)'; g.fillRect(0, b * h - 3, w, 2);   // the joint
    }
  });
  // a wing (span along +x from the hinge, the leading edge along z = 0, the trailing edge behind):
  // a clear membrane, amber at the root, the costa along the front, longitudinal veins fanning out,
  // cross veins between them, a fine net of cells toward the trailing edge and the pterostigma
  const wing = wingTexture(1024, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const m = g.createLinearGradient(0, 0, w, 0);
    m.addColorStop(0, 'rgba(190,150,70,.5)'); m.addColorStop(0.12, 'rgba(210,225,235,.2)'); m.addColorStop(1, 'rgba(220,232,240,.16)');
    g.fillStyle = m; g.fillRect(0, 0, w, h);
    const line = (pts, lw, col) => { g.lineWidth = lw; g.strokeStyle = col; g.beginPath(); g.moveTo(pts[0][0] * w, pts[0][1] * h); for (const [x, y] of pts.slice(1)) g.lineTo(x * w, y * h); g.stroke(); };
    // the longitudinal veins: v(x) for each, fanning back from the root
    const veins = [0.02, 0.07, 0.13, 0.22, 0.34, 0.48, 0.62, 0.78].map((v, i) => (x) => 0.02 + (v - 0.02) * (0.25 + 0.75 * Math.pow(Math.min(1, x / 0.35), 0.5)) + (i ? Math.sin(x * 3 + i) * 0.015 : 0));
    const vc = 'rgba(30,34,40,.85)';
    veins.forEach((f, i) => line(Array.from({ length: 33 }, (_, k) => [k / 32, f(k / 32)]), i === 0 ? 5 : i < 3 ? 2.6 : 1.8, vc));
    line([[0, 0.012], [1, 0.012]], 6, 'rgba(20,22,26,.95)');          // the costa, heavy along the front
    g.lineCap = 'round';
    for (let i = 0; i < veins.length - 1; i++) {                       // the cross veins, closer toward the tip
      for (let x = 0.04 + R() * 0.02; x < 0.98; x += 0.012 + R() * 0.012) {
        const x2 = x + (R() - 0.5) * 0.008;
        line([[x, veins[i](x)], [x2, veins[i + 1](x2)]], 1, 'rgba(30,34,40,.7)');
      }
    }
    // the net behind the last vein: a jittered grid joined into little polygons
    const cols = 90, rows = 9, P = [];
    for (let r = 0; r <= rows; r++) { P[r] = []; for (let c = 0; c <= cols; c++) { const x = c / cols; P[r][c] = [x + (R() - 0.5) * 0.006, veins[7](x) + (r / rows) * (1 - veins[7](x)) + (R() - 0.5) * 0.02]; } }
    for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
      if (c < cols) line([P[r][c], P[r][c + 1]], 0.9, 'rgba(30,34,40,.6)');
      if (r < rows) line([P[r][c], P[r + 1][c]], 0.9, 'rgba(30,34,40,.6)');
    }
    g.fillStyle = 'rgba(30,18,8,1)'; g.beginPath(); g.roundRect(w * 0.8, 0, w * 0.09, h * 0.1, 5); g.fill();   // the pterostigma
    g.fillStyle = 'rgba(190,120,30,1)'; g.beginPath(); g.roundRect(w * 0.806, h * 0.018, w * 0.078, h * 0.06, 4); g.fill();
  });
  // a wing outline: span `len`, `chord` deep; `hind` gives the broad rounded base of a hind wing
  const wingGeo = (len, chord, hind) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(len * 0.4, 0.02, len * 0.85, 0.02, len * 0.97, -chord * 0.12);           // the leading edge
    s.bezierCurveTo(len * 1.01, -chord * 0.35, len * 0.97, -chord * 0.75, len * 0.86, -chord * 0.82);   // the round tip
    if (hind) s.bezierCurveTo(len * 0.55, -chord * 0.95, len * 0.3, -chord * 1.0, len * 0.12, -chord * 0.95).bezierCurveTo(len * 0.04, -chord * 0.85, 0, -chord * 0.45, 0, -chord * 0.12);
    else s.bezierCurveTo(len * 0.55, -chord * 0.95, len * 0.2, -chord * 0.7, len * 0.05, -chord * 0.32).lineTo(0, -chord * 0.12);
    s.closePath();
    const geo = new THREE.ShapeGeometry(s, 40), p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      uv.setXY(i, x / len, 1 + y / chord);                             // canvas y runs down: the front is v = 1
      p.setXYZ(i, x, Math.sin((x / len) * Math.PI) * 0.03 - (y / chord) * (y / chord) * 0.03, y);   // a slight camber
    }
    geo.computeVertexNormals();
    return geo;
  };
  // the abdomen's profile: radius along its length, swollen at the waist, pinched, clubbed at the tip
  const LEN = 2.15, prof = [[0, 0.01], [0.03, 0.12], [0.1, 0.14], [0.2, 0.12], [0.3, 0.075], [0.5, 0.072], [0.75, 0.078], [0.88, 0.09], [0.95, 0.08], [0.99, 0.05], [1, 0.005]];
  const curve = new THREE.CatmullRomCurve3(prof.map(([v, r]) => V(r, v, 0)));
  const abdomenGeo = new THREE.LatheGeometry(curve.getPoints(80).map((p) => new THREE.Vector2(Math.max(0.004, p.x), p.y * LEN)), 24)
    .rotateX(-Math.PI / 2).scale(1, 0.92, 1);                          // runs back along -z, u = 0 on top
  // a leg on the +x side, built at its hip: femur forward and down, tibia folded back, a clawed foot, spines
  const legGeo = (fwd, sc) => {
    const a = V(0, 0, 0), b = V(0.14 * sc, -0.2 * sc, (0.05 + fwd * 0.1) * sc), c = V(0.2 * sc, -0.36 * sc, (0.22 + fwd * 0.12) * sc), d = V(0.15 * sc, -0.42 * sc, (0.38 + fwd * 0.1) * sc);
    const parts = [rod(a, b, 0.035, 0.03, black), rod(b, c, 0.028, 0.02, black), rod(c, d, 0.018, 0.01, '#1a1d22'), ellipsoid(0.032, 0.032, 0.032, b, black, 8),
      ...[-1, 1].map((k) => rod(d, d.clone().add(V(k * 0.02, -0.035, 0.03)), 0.008, 0.002, black))];
    for (const [p, q, n] of [[a, b, 5], [b, c, 9]]) for (let k = 0; k < n; k++) {   // two rows of spines
      const at = p.clone().lerp(q, 0.1 + 0.85 * k / n), dir = V((k % 2 ? 1 : -0.3), -0.2, 0.8).normalize();
      parts.push(rod(at, at.clone().addScaledVector(dir, 0.05 + R() * 0.02), 0.006, 0.0015, black));
    }
    return merge(parts);
  };
  const legs = [];
  [[0.58, 1, 0.75], [0.46, 0.5, 0.85], [0.34, 0, 0.95]].forEach(([z, fwd, sc]) => { for (const s of [-1, 1]) legs.push([s, z, fwd, sc]); });
  const parts = [
    ellipsoid(0.12, 0.09, 0.08, V(0, -0.04, 1.0), '#7cc0e4', 16),      // the face (frons), pale blue
    ellipsoid(0.1, 0.06, 0.06, V(0, -0.14, 0.98), '#c8d890', 14),       // the lip below, a little yellow
    ellipsoid(0.08, 0.035, 0.05, V(0, -0.2, 0.95), '#2a3030', 12),      // the jaws
    ellipsoid(0.035, 0.03, 0.03, V(0, 0.08, 1.04), black, 10),          // the vertex between the eyes
    ellipsoid(0.16, 0.14, 0.1, V(0, 0.02, 0.78), black, 14),            // the back of the head
    ellipsoid(0.13, 0.12, 0.1, V(0, -0.02, 0.68), '#24303a', 12),       // the neck (prothorax)
    ...[-1, 1].map((s) => rod(V(s * 0.04, 0.12, 1.0), V(s * 0.09, 0.2, 1.1), 0.012, 0.004, black)),   // tiny bristle antennae
    ellipsoid(0.07, 0.035, 0.04, V(0, 0.27, 0.46), black, 8),          // the wing roots
    ellipsoid(0.07, 0.035, 0.04, V(0, 0.27, 0.26), black, 8),
  ];
  for (let k = 0; k < 60; k++) {                                       // pale hairs on the thorax
    const d = V(R() - 0.5, R() * 0.8 - 0.3, R() - 0.5).normalize(), at = V(0, 0, 0.38).add(d.clone().multiply(V(0.24, 0.27, 0.3)));
    parts.push(rod(at, at.clone().addScaledVector(d, 0.04 + R() * 0.04), 0.006, 0.0015, hair));
  }
  return {
    eye, thorax, abdomen, wing,
    eyeGeo: new THREE.SphereGeometry(1, 40, 28).scale(0.22, 0.22, 0.2),
    thoraxGeo: new THREE.SphereGeometry(1, 36, 24).rotateY(Math.PI).scale(0.24, 0.27, 0.3).rotateX(-0.35).translate(0, 0, 0.38),
    abdomenGeo: abdomenGeo.translate(0, 0.0, 0.1),
    foreGeo: wingGeo(2.0, 0.42, false), hindGeo: wingGeo(1.9, 0.56, true),
    // the claspers at the tip of the abdomen (they ride on it)
    claspers: merge([...[-1, 1].map((s) => rod(V(s * 0.02, 0.02, -0.04), V(s * 0.05, 0.0, -0.18), 0.02, 0.006, black)), rod(V(0, -0.02, -0.04), V(0, -0.05, -0.12), 0.015, 0.005, black)]).translate(0, 0, 0.1 - LEN),
    body: merge(parts), legs: merge(legs.map(([s, z, fwd, sc]) => { const g = legGeo(fwd, sc); if (s < 0) g.scale(-1, 1, 1); return g.translate(s * 0.07, -0.2, z); })),
  };
}

export function buildDragonfly() {
  const G = (GEO.dragonfly ||= dragonflyParts()), M = mats();
  if (!M.dfEye) {
    M.dfEye = new THREE.MeshPhysicalMaterial({ map: G.eye, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 });
    M.dfThorax = new THREE.MeshStandardMaterial({ map: G.thorax, roughness: 0.5 });
    M.dfAbdomen = new THREE.MeshStandardMaterial({ map: G.abdomen, roughness: 0.3, metalness: 0.1 });
    M.dfWing = new THREE.MeshStandardMaterial({ map: G.wing, transparent: true, side: THREE.DoubleSide, roughness: 0.12, metalness: 0.2, depthWrite: false });
    M.dfLeg = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.05 });
    standOut(M.dfEye, { base: 0.3, rim: 0.5 }); standOut(M.dfThorax, { base: 0.2, rim: 0.45 }); standOut(M.dfAbdomen, { base: 0.25, rim: 0.45 });
    standOut(M.dfWing, { base: 0.25, rim: 0.4 }); standOut(M.dfLeg, { base: 0.12, rim: 0.3 });
  }
  const outer = new THREE.Group(), body = new THREE.Group();
  outer.add(body);
  const add = (parent, geo, mat, at) => { const m = new THREE.Mesh(geo, mat); if (at) m.position.copy(at); parent.add(m); return m; };
  add(body, G.body, M.dfLeg);
  add(body, G.thoraxGeo, M.dfThorax);
  for (const s of [-1, 1]) { const e = add(body, G.eyeGeo, M.dfEye, V(s * 0.13, 0.1, 0.86)); e.rotation.set(0, s * 0.4, -s * 0.25); }
  const face = angryEyes({ y: 0.14, z: 1.02, size: 0.09, gap: 0.14 });
  body.add(face);
  const legs = add(body, G.legs, M.dfLeg);
  // the abdomen hangs from the back of the thorax and sways a little
  const tail = new THREE.Group();
  tail.position.set(0, -0.02, 0.12);
  tail.name = 'tail';
  body.add(tail);
  add(tail, G.abdomenGeo, M.dfAbdomen, V(0, 0, -0.12));
  add(tail, G.claspers, M.dfLeg, V(0, 0, -0.12));
  // four wings, each on a hinge at its root: the forewings ahead of the hind ones
  const wings = [];
  for (const [geo, z, fore] of [[G.foreGeo, 0.52, true], [G.hindGeo, 0.28, false]]) for (const s of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(s * 0.08, 0.27, z);
    hinge.rotation.y = s * (fore ? -0.1 : 0.14);                       // the forewings sweep forward a touch, the hind ones back
    hinge.name = 'wing';
    const m = add(hinge, geo, M.dfWing);
    m.scale.x = s;
    body.add(hinge);
    wings.push({ s, fore, hinge });
  }

  let t = 0, dart = 0, glide = 0;
  // its beam and whirlwind (attack-motion "throw", src/attack-motion.js). Charging the beam it draws back, its wings
  // stop dead and its tail curls up and forward over its back, holding quivering; the beam snaps the tail straight,
  // stretched along it, then it rocks back (knocked back if it hit, nose dipping if it missed) and the wings restart,
  // fore pair first. Winding up the whirlwind its wings beat faster and sweep forward as it leans back, freezing
  // there when the aim locks; flinging it they clap back and it lunges, then it is thrown back and up and bobs.
  const anim = (dt, e) => {
    t += dt;
    const A = e.atk, ph = A ? A.phase : 'idle', whirl = A && (A.key === 'whirl' || A.key === 'whirl-rest');
    let back = 0, lean = 0, curl = 0, sweep = 0, up = 0, len = 1, held = 0, shake = 0, fast = 0, restart = 1, hindRestart = 1;
    if (ph === 'build') {
      const c = coil(A.k, A.style.hold, A.style.over) * A.vary;
      held = Math.min(1, c);
      shake = A.still ? 0 : quiver(A.k, A.t, e.phase) * A.quiet;
      if (whirl) { lean = -0.26 * c; sweep = 0.6 * c; fast = held; restart = A.lockT >= 0 ? 0 : 1; hindRestart = restart; }
      else { back = -0.15 * c; curl = 1.1 * c; restart = hindRestart = 1 - Math.min(1, A.pt / 0.08); }
    } else if (ph === 'swing') {
      const s = snap(Math.min(1, A.pt / A.style.strike), A.tier.over);
      held = 1; restart = hindRestart = 0;
      len = A.smear ? knobs().smear : 1 + (A.tier.stretch - 1) * Math.min(1, s);
      if (whirl) { sweep = 0.6 * (1 - s) - 0.8 * s; back = 0.2 * s * A.vary; lean = -0.26 * (1 - s) * A.vary; }
      else { back = -0.15 * (1 - s) * A.vary; curl = 1.1 * (1 - s) * A.vary; }
    } else if (ph === 'recoil') {
      const b = settle(A.k, A.style.bounces, A.style.damp) * Math.min(1, A.pt / 0.05);
      restart = Math.min(1, A.k * 2.5); hindRestart = Math.min(1, Math.max(0, A.k * 2.5 - 0.4)); held = 1 - restart;
      if (whirl) { back = -0.25 * b; up = 0.25 * b; lean = -0.3 * b; curl = 0.3 * b; sweep = -0.5 * b; }
      else if (A.hit) { back = -0.2 * b; lean = -0.35 * b; curl = 0.3 * b; }
      else { lean = 0.2 * b; curl = 0.3 * b; back = 0.1 * b; }
    }
    const g = ph === 'idle' && Math.sin(t * 0.9 + e.phase) > 0.8 ? 1 : 0;   // every few seconds it holds its wings out flat and glides for a moment
    glide += (g - glide) * (1 - Math.exp(-10 * dt));
    const speed = Math.hypot(e.vel.x, e.vel.z);
    dart += (Math.min(1, speed * 4) - dart) * (1 - Math.exp(-6 * dt));
    const idle = 1 - held;
    for (const W of wings) {
      // fore and hind beat out of step, a quarter turn apart; a dragonfly's wings are a blur
      const a = Math.sin(t * (70 + 40 * fast) + (W.fore ? 0 : Math.PI * 0.6)), amp = (W.fore ? restart : hindRestart) * (1 - glide);
      W.hinge.rotation.z = W.s * (0.05 + a * 0.55 * amp);
      W.hinge.rotation.x = a * 0.25 * amp * (W.fore ? 1 : -1);        // the wings twist through the stroke
      W.hinge.rotation.y = W.s * ((W.fore ? -0.1 : 0.14) - sweep);
    }
    legs.rotation.x = -0.1 + Math.sin(t * 2.1 + e.phase) * 0.05;
    tail.rotation.x = (Math.sin(t * 1.7 + e.phase) * 0.05 + dart * 0.08) * idle + curl + shake * 0.1;
    tail.rotation.y = Math.sin(t * 1.3 + e.phase) * 0.04 * idle;
    body.position.y = Math.sin(t * 3 + e.phase) * 0.06 * (1 - dart * 0.5) * idle + up;
    body.position.z = back;
    const kick = A ? 0 : Math.max(0, e.firedT || 0, e.whirlKick || 0) * 1.6;   // (a model with no attack clock, a preview: its beam or whirlwind fired, it rocks back, tail flicking)
    body.rotation.x = 0.1 * dart * idle + Math.sin(t * 2.3 + e.phase) * 0.03 * idle + lean - kick + shake * 0.04;   // nose down to dart
    tail.rotation.x += kick * 0.8;
    body.rotation.z = Math.sin(t * 1.1 + e.phase) * 0.04 * idle + shake * 0.03;
    stretch(body, len);
    if (A) eyes(face, A);
  };
  anim.reset = () => { t = 0; dart = 0; glide = 0; stretch(body, 1); body.position.set(0, 0, 0); face.children.forEach((c) => { c.scale.y = 1; c.rotation.x = 0; }); };
  return { body: outer, face: new THREE.Group(), anim };
}

// ------------------------------------------------------------------ praying mantis
// A green praying mantis, after the reference sheet (act 3): a long neck (the prothorax) rising
// from a short thorax to a triangular head with two big yellow-green eyes (each with its dark
// pseudopupil), brown-tipped jaws and long thin antennae; raptorial forelegs (a long coxa, a thick
// femur with two rows of brown-tipped spines and a spined tibia folding back against it, ending in a
// hook) held up in prayer; four long thin walking legs; and a long, broad, segmented abdomen under
// two leaf-green wings veined like a leaf, its tip curling up. It stalks on its four legs; to swat
// it rears up with its forelegs raised and opened wide, then lunges and snaps them shut.
// About 3.2 radii long, its head 1.2 radii up; its feet are at its origin.
const MANTIS = { head: V(0, 1.2, 1.15), tail: V(0, 0.8, -1.93), shoulder: V(0.1, 0.98, 0.9) };
function mantisParts() {
  const R = seeded(71), green = '#6aa826', dark = '#4a7c1c', pale = '#94c440', spine = '#9a6a2a';
  const bend = (z) => { const t = Math.max(0, -z / 1.9); return 0.22 * t * t; };   // the abdomen's tip curls up
  // the abdomen (a lathe: u around, 0 = the top; v front 0 -> back 1): green segments with darker
  // joints, a paler belly stripe and fine speckles
  const abdomen = wingTexture(256, 1024, (g, w, h) => {
    g.fillStyle = green; g.fillRect(0, 0, w, h);
    const belly = g.createLinearGradient(0, 0, w, 0);
    belly.addColorStop(0.3, 'rgba(200,228,120,0)'); belly.addColorStop(0.5, 'rgba(200,228,120,.75)'); belly.addColorStop(0.7, 'rgba(200,228,120,0)');
    g.fillStyle = belly; g.fillRect(0, 0, w, h);
    for (let k = 1; k < 9; k++) {
      const y = h * (0.04 + k * 0.105);
      g.fillStyle = 'rgba(60,96,24,.8)'; g.fillRect(0, y, w, 5);
      g.fillStyle = 'rgba(210,236,140,.45)'; g.fillRect(0, y + 5, w, 3);
    }
    for (let k = 0; k < 1400; k++) { g.fillStyle = `rgba(${40 + R() * 40 | 0},${80 + R() * 40 | 0},20,${R() * 0.25})`; g.fillRect(R() * w, R() * h, 2, 2); }
  });
  // a wing (u along it from the shoulder, v across): translucent leaf green, a stout midrib, side veins
  // branching off it and a net of fine cells, the leading edge a little brighter
  const wing = wingTexture(1024, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const m = g.createLinearGradient(0, 0, 0, h);
    m.addColorStop(0, 'rgba(176,220,96,.95)'); m.addColorStop(0.5, 'rgba(140,196,70,.85)'); m.addColorStop(1, 'rgba(120,180,60,.7)');
    g.fillStyle = m; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(70,110,30,.8)'; g.lineCap = 'round';
    g.lineWidth = 5; g.beginPath(); g.moveTo(0, h * 0.32); g.bezierCurveTo(w * 0.4, h * 0.36, w * 0.75, h * 0.42, w, h * 0.5); g.stroke();
    g.lineWidth = 2;
    for (let k = 1; k < 14; k++) {                                   // side veins off the midrib, both ways
      const x = w * k / 14, y = h * (0.32 + 0.18 * k / 14);
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w * 0.04, y + s * h * 0.2, x + w * 0.09, y + s * h * 0.45); g.stroke(); }
    }
    g.strokeStyle = 'rgba(70,110,30,.35)'; g.lineWidth = 1;
    for (let x = 0; x < w; x += 9 + R() * 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (R() - 0.5) * 8, h); g.stroke(); }
    g.fillStyle = 'rgba(230,250,170,.5)'; g.fillRect(0, 0, w, 6);
  });
  // an eye: yellow-green, brighter at the front, fine facets and the dark pseudopupil looking at you (+z: u = 0.25)
  const eye = wingTexture(512, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w * 0.25, h * 0.5, 4, w * 0.25, h * 0.5, w * 0.4);
    gr.addColorStop(0, '#e8f070'); gr.addColorStop(0.6, '#b4d040'); gr.addColorStop(1, '#6a9a28');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) for (let x = (y / 3) % 2 ? 1.5 : 0; x < w; x += 3) { g.fillStyle = `rgba(255,255,200,${0.08 + R() * 0.12})`; g.fillRect(x, y, 1.4, 1.4); }
    g.fillStyle = '#100c08'; g.beginPath(); g.ellipse(w * 0.25, h * 0.5, 9, 12, 0, 0, 7); g.fill();
  });
  // the abdomen's profile, front to back: narrow at the waist, broad in the middle, tapering to the tip
  const LEN = 1.95, prof = [[0, 0.04], [0.04, 0.12], [0.15, 0.18], [0.4, 0.22], [0.65, 0.2], [0.85, 0.13], [0.97, 0.06], [1, 0.01]];
  const curve = new THREE.CatmullRomCurve3(prof.map(([v, r]) => V(r, v, 0)));
  const abdomenGeo = new THREE.LatheGeometry(curve.getPoints(60).map((p) => new THREE.Vector2(Math.max(0.006, p.x), p.y * LEN)), 20).rotateX(-Math.PI / 2).scale(1.15, 0.85, 1);
  const ap = abdomenGeo.attributes.position;
  for (let i = 0; i < ap.count; i++) ap.setY(i, ap.getY(i) + 0.58 + bend(ap.getZ(i)));
  abdomenGeo.translate(0, 0, 0.02).computeVertexNormals();
  // the wings: a long leaf each, lying over the abdomen, overlapping down the middle
  const leaf = new THREE.Shape().moveTo(0, 0).bezierCurveTo(0.5, 0.2, 1.3, 0.24, 1.75, 0.05).bezierCurveTo(1.3, -0.02, 0.5, -0.04, 0, 0);
  const wingGeo = new THREE.ShapeGeometry(leaf, 24);
  { const p = wingGeo.attributes.position, uv = wingGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i), v = p.getY(i), z = 0.3 - u;
      uv.setXY(i, u / 1.75, 1 - v / 0.24);
      p.setXYZ(i, 0.02 + v * 0.9, 0.79 + bend(z) - v * v * 1.2 + Math.sin((u / 1.75) * Math.PI) * 0.03, z);
    }
    wingGeo.computeVertexNormals(); }
  const body = [
    ellipsoid(0.17, 0.15, 0.3, V(0, 0.62, 0.18), green, 16),           // the thorax
    tube([V(0, 0.64, 0.36), V(0, 0.8, 0.6), V(0, 0.98, 0.86), V(0, 1.1, 1.04)], 0.075, green, 16),   // the neck (prothorax)
    ellipsoid(0.1, 0.07, 0.15, V(0, 0.98, 0.86), green, 14),            // its collar, where the forelegs join
    ellipsoid(0.2, 0.1, 0.07, V(0, 1.25, 1.13), green, 18),             // the head: a triangle, broad across the top...
    ellipsoid(0.12, 0.08, 0.06, V(0, 1.15, 1.15), green, 14),
    ellipsoid(0.06, 0.07, 0.05, V(0, 1.06, 1.16), pale, 12),            // ...narrowing to the mouth
    ellipsoid(0.04, 0.035, 0.035, V(0, 0.99, 1.17), '#b08038', 10),     // jaws
    ...[-1, 1].map((s) => rod(V(s * 0.015, 0.99, 1.18), V(s * 0.035, 0.95, 1.2), 0.016, 0.004, '#7a4a1c')),
    ...[-1, 1].map((s) => tube([V(s * 0.05, 1.3, 1.2), V(s * 0.12, 1.6, 1.32), V(s * 0.28, 1.95, 1.3), V(s * 0.46, 2.2, 1.12)], 0.012, '#9cb84a', 14)),   // antennae
    ...[0, 1, 2].map((k) => ellipsoid(0.02, 0.02, 0.02, V((k - 1) * 0.04, 1.33, 1.16), '#dfe890', 6)),                // the three little ocelli
    rod(V(-0.04, 0.6 + bend(-1.95), -1.9), V(-0.08, 0.66 + bend(-2.1), -2.05), 0.025, 0.008, dark),   // cerci at the tip
    rod(V(0.04, 0.6 + bend(-1.95), -1.9), V(0.08, 0.66 + bend(-2.1), -2.05), 0.025, 0.008, dark),
  ];
  for (let k = 0; k < 24; k++) {                                        // little bumps down the neck
    const t = R(), at = V(0, 0.64, 0.36).lerp(V(0, 1.1, 1.04), t).add(V((R() - 0.5) * 0.1, 0.06, 0));
    body.push(rod(at, at.clone().add(V(0, 0.03, 0.01)), 0.008, 0.002, dark));
  }
  // a walking leg on the +x side, built at its hip: the femur up and out to the knee, the tibia down to the floor
  const walkLeg = (fwd, hipY) => {
    const a = V(0, 0, 0), b = V(0.42, 0.24, fwd * 0.12), c = V(0.72, -hipY + 0.04, fwd * 0.4), d = V(0.82, -hipY, fwd * 0.5);
    const parts = [rod(a, b, 0.035, 0.03, green), rod(b, c, 0.026, 0.02, green), rod(c, d, 0.016, 0.012, '#a8c858'), ellipsoid(0.03, 0.03, 0.03, b, dark, 8)];
    for (let k = 0; k < 5; k++) { const at = b.clone().lerp(c, 0.15 + k * 0.17); parts.push(rod(at, at.clone().add(V(0.02, 0.02, 0.03)), 0.006, 0.0015, spine)); }
    parts.push(rod(d, d.clone().add(V(0.03, -0.01, 0.05)), 0.008, 0.003, '#6a4a1c'));
    return merge(parts);
  };
  // the raptorial foreleg on the +x side, three segments each built along +z from its own joint
  const coxa = merge([rod(V(0, 0, 0), V(0, 0, 0.38), 0.05, 0.045, green), ellipsoid(0.05, 0.05, 0.05, V(0, 0, 0.38), pale, 8)]);
  const femurParts = [ellipsoid(0.055, 0.075, 0.27, V(0, -0.01, 0.25), green, 14)];
  for (let k = 0; k < 9; k++) for (const s of [-1, 1]) {               // two rows of spines along its inner edge
    const z = 0.08 + k * 0.045, at = V(s * 0.025, -0.07, z), len = 0.05 + (k % 3 === 1 ? 0.04 : 0) + R() * 0.015;
    femurParts.push(rod(at, at.clone().add(V(s * 0.01, -len, 0.015)), 0.011, 0.002, k % 2 ? spine : '#c09040'));
  }
  const tibiaParts = [ellipsoid(0.035, 0.045, 0.2, V(0, 0, 0.19), pale, 12), rod(V(0, 0, 0.36), V(0, -0.06, 0.44), 0.02, 0.004, '#7a4a1c')];   // ...and its hook
  for (let k = 0; k < 7; k++) { const at = V(0, -0.035, 0.06 + k * 0.045); tibiaParts.push(rod(at, at.clone().add(V(0, -0.045, -0.01)), 0.009, 0.0015, spine)); }
  return {
    abdomen, wing, eye, abdomenGeo, wingGeo, body: merge(body), coxa, femur: merge(femurParts), tibia: merge(tibiaParts),
    eyeGeo: new THREE.SphereGeometry(1, 28, 20).scale(0.1, 0.11, 0.1),
    legs: [{ z: 0.26, fwd: 1, y: 0.58 }, { z: 0.06, fwd: -1, y: 0.56 }].map((L) => ({ ...L, geo: walkLeg(L.fwd, L.y) })),
  };
}

// the pose of the forelegs: shoulder pitch, femur and tibia folds (radians; see buildMantis)
const PRAY = [1.1, -2.0, 2.75], RAISED = [0.1, -1.4, 1.1], STRUCK = [1.35, -1.15, 2.95], LIMP = [1.5, -0.6, 2.2];
export function buildMantis({ dead = false } = {}) {
  const G = (GEO.mantis ||= mantisParts()), M = mats();
  if (!M.mtAbdomen) {
    M.mtAbdomen = new THREE.MeshStandardMaterial({ map: G.abdomen, roughness: 0.4 });
    M.mtWing = new THREE.MeshStandardMaterial({ map: G.wing, transparent: true, side: THREE.DoubleSide, roughness: 0.35, depthWrite: false });
    M.mtEye = new THREE.MeshPhysicalMaterial({ map: G.eye, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
    M.mtBody = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 });
    standOut(M.mtAbdomen, { base: 0.25, rim: 0.5 }); standOut(M.mtWing, { base: 0.25, rim: 0.4 }); standOut(M.mtEye, { base: 0.3, rim: 0.4 }); standOut(M.mtBody, { base: 0.2, rim: 0.45 });
  }
  const outer = new THREE.Group(), body = new THREE.Group();
  outer.add(body);
  const add = (parent, geo, mat, at) => { const m = new THREE.Mesh(geo, mat); if (at) m.position.copy(at); parent.add(m); return m; };
  add(body, G.body, M.mtBody);
  add(body, G.abdomenGeo, M.mtAbdomen);
  for (const s of [-1, 1]) { const w = add(body, G.wingGeo, M.mtWing); w.scale.x = s; w.position.y = s * 0.004; }
  for (const s of [-1, 1]) { const e = add(body, G.eyeGeo, M.mtEye, V(s * 0.19, 1.24, 1.13)); e.rotation.y = s * 0.55; }
  const face = dead ? null : angryEyes({ y: 1.28, z: 1.22, size: 0.075, gap: 0.19 });
  if (face) body.add(face);
  const tail = new THREE.Object3D();                                   // the tip of the abdomen (the worm comes out here)
  tail.position.copy(MANTIS.tail);
  body.add(tail);
  const fore = [-1, 1].map((s) => {
    const shoulder = new THREE.Group(), femur = new THREE.Group(), tibia = new THREE.Group();
    shoulder.position.set(s * MANTIS.shoulder.x, MANTIS.shoulder.y, MANTIS.shoulder.z);
    shoulder.rotation.y = s * 0.08;
    add(shoulder, G.coxa, M.mtBody);
    femur.position.z = 0.38; shoulder.add(femur); add(femur, G.femur, M.mtBody);
    tibia.position.z = 0.5; tibia.name = 'foreleg'; femur.add(tibia); add(tibia, G.tibia, M.mtBody);   // (named: its hook is the striking part, motion/contact-pose-is-on-the-hit)
    body.add(shoulder);
    return { s, shoulder, femur, tibia };
  });
  const legs = [];
  G.legs.forEach((L, pair) => [-1, 1].forEach((s) => {
    const hip = new THREE.Group();
    hip.position.set(s * 0.1, L.y, L.z);
    hip.scale.x = s;
    add(hip, L.geo, M.mtBody);
    body.add(hip);
    legs.push({ s, pair, hip, phase: (pair + (s > 0 ? 1 : 0)) % 2 ? Math.PI : 0 });
  }));
  const pose = (P) => { for (const F of fore) { F.shoulder.rotation.x = P[0]; F.femur.rotation.x = P[1]; F.tibia.rotation.x = P[2]; } };
  if (dead) {
    // a carcass: rolled onto its side, the legs crumpled, the forelegs limp
    pose(LIMP);
    for (const L of legs) { L.hip.rotation.z = L.s * -0.9; L.hip.rotation.x = 0.4 * (L.pair ? -1 : 1); }
    body.rotation.z = -1.3;
    body.position.y = 0.12;
    return { body: outer, face: new THREE.Group(), anim: null, rig: { body, tail } };
  }
  pose(PRAY);
  const stuck = LOOK.num('bug-attack-mantis-stuck', 0.15);   // s a missed swat leaves its forelegs out, crossed
  let t = 0, k = 0, walk = 1;
  const P = [0, 0, 0];
  // its swat (attack-motion "swipe", src/attack-motion.js): rears and throws its forelegs open past raised, holds
  // them quivering, goes dead still; the forelegs lead, snapping shut crossed (shoulder, then knee, then hook, a
  // frame apart) and the body lunges after them; landed, the forelegs pull back in an arc to prayer as the body
  // rocks back past upright; missed, they stay crossed and stuck out, head down, before it recovers
  const anim = (dt, e) => {
    t += dt;
    const speed = Math.hypot(e.vel.x, e.vel.z);
    k += (Math.min(1, speed * 6) - k) * (1 - Math.exp(-8 * dt));
    const A = e.atk, ph = A ? A.phase : 'idle';
    let z = 0, y = 0, rx = 0, cross = 0, len = 1, shake = 0;
    if (ph === 'build') {
      const c = coil(A.k, A.style.hold, A.style.over) * A.vary;      // open by 40% (0.12 s), past raised, then held
      for (let i = 0; i < 3; i++) P[i] = PRAY[i] + (RAISED[i] - PRAY[i]) * c;
      shake = (A.still ? 0 : 1) * quiver(A.k, A.t, e.phase) * A.quiet;
      z = -0.1 * c; y = 0.06 * c; rx = -0.22 * c + (lockBeat(A) ? 0.08 : 0);   // the lock: its head dips at you
    } else if (ph === 'swing') {
      const u = A.pt / A.style.strike;
      for (let i = 0; i < 3; i++) P[i] = RAISED[i] + (STRUCK[i] - RAISED[i]) * snap(u - i * 0.35, A.tier.over);
      const b = snap(u - 0.7, A.tier.over);                            // the body two frames behind the forelegs
      cross = snap(u - 0.35, A.tier.over);
      z = -0.1 * A.vary + (0.45 * A.vary) * b; y = 0.06 * A.vary * (1 - b); rx = -0.22 * A.vary + 0.42 * b;
      len = 1 + (A.tier.stretch - 1) * 0.5 * b;
    } else if (ph === 'recoil') {
      // a miss leaves the forelegs out, crossed, `stuck` s longer (the punish window), its head down
      const span = Math.max(1e-3, A.len - A.style.follow), miss = !A.hit;
      const q = miss ? Math.max(0, Math.min(1, (A.k * span - stuck) / Math.max(1e-3, span - stuck))) : A.k;
      const h = heavy(q), u = 1 - h, rock = Math.sin(Math.PI * q) * 0.14;
      mixPose(STRUCK, PRAY, u * 1.3, P, 0.15);                         // back to prayer, shoulder first, hook last
      P[0] += (RAISED[0] - PRAY[0]) * Math.sin(Math.PI * u) * 0.35;    // up and round in an arc
      cross = h;
      z = 0.35 * A.vary * h; rx = 0.2 * h - rock * (miss ? 0.4 : 1) + (miss ? 0.18 * h : 0);
    } else for (let i = 0; i < 3; i++) P[i] = PRAY[i];
    pose(P);
    for (const F of fore) {
      F.shoulder.rotation.x += Math.sin(t * 1.6 + e.phase) * 0.04 * walk + shake * 0.08;   // a slow sway as it watches you; tension in the hold
      F.tibia.rotation.x += shake * 0.1;
      F.shoulder.rotation.y = F.s * (0.08 - 0.3 * cross);              // snapped shut past the middle: crossed
      F.tibia.scale.z = A?.smear ? knobs().smear : 1;
    }
    const step = t * (3 + 10 * k);
    walk += ((ph === 'idle' ? 1 : 0) - walk) * (1 - Math.exp(-12 * dt));   // its walk eases out as it attacks
    for (const L of legs) {
      L.hip.rotation.y = Math.sin(step + L.phase) * 0.35 * k * walk;
      L.hip.rotation.z = Math.max(0, Math.cos(step + L.phase)) * 0.2 * k * walk;
    }
    body.rotation.x = rx;
    body.position.set(0, y, z);
    body.rotation.z = Math.sin(step * 0.5) * 0.03 * k * walk;
    stretch(body, len);
    if (A && face) eyes(face, A);
  };
  anim.reset = () => { t = 0; k = 0; walk = 1; P.fill(0); stretch(body, 1); body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); for (const F of fore) { F.shoulder.rotation.y = F.s * 0.08; F.tibia.scale.z = 1; } face?.children.forEach((c) => { c.scale.y = 1; c.rotation.x = 0; }); };
  return { body: outer, face: new THREE.Group(), anim };
}

// ------------------------------------------------------------------ stag beetle
// The stag beetle (act 3), after the character sheet, in an iridescent green-black: long glossy wing
// cases (elytra) with a seam down the middle, fine ridges along them and a paler rim; an armoured
// pronotum with a groove down its middle and a tooth at each side corner, and a head with a raised
// crest and bulging compound eyes, thin metallic-green lines between the segments; big branched
// mandibles like antlers, curving up and in, prongs and a row of small teeth along the inside;
// elbowed antennae with comb tips; six long jointed legs with spiny tibiae and beaded feet ending in
// hooks; a low, long body. The shell shimmers through greens, blues and violets as it turns (the
// material's iridescence). Its mandibles part as it charges its electric ball between them (the
// charge-shot word: enemies.js draws the ball there, BALL_AT) and snap wide as it fires.
// About 3.3 radii long, mandible tips to wing tips (3x the jelly); its feet are at its origin.
// a sphere pushed toward a box (e < 1: boxier), for armour plates that meet edge to edge; lighter on top
function plate(sx, sy, sz, at, dark, light, e = 0.6, seg = 24) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.6)), p = g.attributes.position;
  const a = new THREE.Color(dark), b = new THREE.Color(light), c = new THREE.Color(), col = new Float32Array(p.count * 3);
  const f = (v) => Math.sign(v) * Math.pow(Math.abs(v), e);
  for (let i = 0; i < p.count; i++) {
    const x = f(p.getX(i)), y = f(p.getY(i)), z = f(p.getZ(i));
    c.copy(a).lerp(b, Math.max(0, y) * 0.9);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    p.setXYZ(i, x * sx + at.x, y * sy + at.y, z * sz + at.z);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g.toNonIndexed();
}
const STAG = { dark: '#030805', red: '#1a5a2c', armour: '#030604', armourLit: '#1a4a2a', gold: '#4f9a4a', ridge: '#1a4426', rim: '#2c6a3a', leg: '#0a1a10', mandible: '#123a20', tip: '#010302' };
// a gold edge line round the top and sides of a plate's cross-section (half-width w, height h) at z
const edge = (w, h, y, z) => tube(Array.from({ length: 13 }, (_, i) => { const a = -0.15 + (Math.PI + 0.3) * i / 12; return V(Math.cos(a) * w, y + Math.sin(a) * h, z); }), 0.012, STAG.gold, 24);
function beetleParts() {
  const C = STAG, elyY = (z) => 0.42 + 0.3 * Math.sqrt(Math.max(0, 1 - ((z + 0.32) / 0.8) ** 2));
  // the top of the wing cases' plate at (x, z): |x|^p + |y|^p + |z|^p = 1 with p = 2 / e
  const elytra = (x, z) => 0.42 + 0.3 * Math.max(0, 1 - Math.abs(x / 0.54) ** (2 / 0.78) - Math.abs((z + 0.32) / 0.8) ** (2 / 0.78)) ** (0.78 / 2);
  const shell = [
    plate(0.54, 0.3, 0.8, V(0, 0.42, -0.32), C.dark, C.red, 0.78),          // the wing cases
    tube(Array.from({ length: 10 }, (_, i) => { const z = 0.42 - i * 0.16; return V(0, elyY(z) + 0.004, z); }), 0.01, C.tip, 20),   // the seam down the middle
    // fine ridges along each wing case, then the paler rim round its edge
    ...[0.12, 0.24, 0.35].flatMap((x) => [-1, 1].map((s) => tube(Array.from({ length: 12 }, (_, i) => { const z = 0.36 - i * 0.135; return V(s * x * (1 - 0.18 * ((z + 0.32) / 0.8) ** 2), elytra(x, z) + 0.003, z); }), 0.007, C.ridge, 22))),
    tube(Array.from({ length: 33 }, (_, i) => { const a = Math.PI * 2 * i / 32, c = Math.cos(a), sn = Math.sin(a); return V(Math.sign(sn) * 0.545 * Math.abs(sn) ** 0.78, 0.43, -0.32 + Math.sign(c) * 0.805 * Math.abs(c) ** 0.78); }), 0.012, C.rim, 64),
  ];
  const body = [
    plate(0.48, 0.16, 0.84, V(0, 0.32, -0.28), '#030604', '#08120c', 0.7),   // the belly under them
    plate(0.012, 0.012, 0.22, V(0, 0.665, 0.7), C.armour, C.tip, 0.8, 10),  // the groove down the pronotum
    ...[-1, 1].map((s) => rod(V(s * 0.42, 0.47, 0.62), V(s * 0.53, 0.46, 0.6), 0.03, 0.004, C.armourLit)),   // a tooth at each side corner of the pronotum
    plate(0.08, 0.04, 0.07, V(0, 0.7, 0.36), C.armour, C.armourLit, 0.7, 12),   // the little shield where they meet the pronotum
    plate(0.47, 0.22, 0.25, V(0, 0.45, 0.7), C.armour, C.armourLit, 0.5),    // the pronotum
    plate(0.38, 0.16, 0.19, V(0, 0.43, 1.12), C.armour, C.armourLit, 0.6),   // the head
    plate(0.08, 0.05, 0.06, V(0, 0.35, 1.32), C.tip, C.mandible, 0.7, 12),   // the mouth
    plate(0.3, 0.035, 0.05, V(0, 0.57, 1.2), C.armour, C.armourLit, 0.6, 14),   // the crest across the front of the head
    ...[-1, 1].map((s) => ellipsoid(0.07, 0.06, 0.08, V(s * 0.36, 0.46, 1.08), C.tip, 10)),   // the bulging compound eyes
    ...[-1, 1].map((s) => plate(0.05, 0.03, 0.09, V(s * 0.34, 0.52, 1.0), C.armour, C.armourLit, 0.7, 10)),   // the ridge over each eye
    edge(0.44, 0.2, 0.45, 0.47), edge(0.37, 0.16, 0.44, 0.94),               // metallic lines between the segments
  ];
  // the elbowed antennae: a long scape out to the side, the rest bent forward, a comb at the tip
  for (const s of [-1, 1]) {
    const a = V(s * 0.3, 0.46, 1.24), b = V(s * 0.5, 0.62, 1.4), c = V(s * 0.6, 0.58, 1.62);
    body.push(rod(a, b, 0.022, 0.016, C.leg), rod(b, c, 0.016, 0.014, C.leg));
    for (let k = 0; k < 4; k++) { const at = c.clone().add(V(s * 0.01 * k, -0.005 * k, -0.025 * k)); body.push(rod(at, at.clone().add(V(s * 0.07, 0.01, 0.03)), 0.01, 0.006, C.tip)); }
  }
  // a mandible on side s, built at its hinge: out and forward, then up and curving in, with prongs on the inside
  const mandible = (s) => {
    const pts = [V(0, 0, 0), V(0.16, 0.08, 0.24), V(0.28, 0.24, 0.5), V(0.28, 0.46, 0.7), V(0.15, 0.66, 0.84), V(-0.04, 0.74, 0.86)].map((p) => p.setX(p.x * s));
    const parts = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const r0 = 0.09 - i * 0.014, col = new THREE.Color(C.mandible).lerp(new THREE.Color(C.tip), i / (pts.length - 1)).getHex();
      parts.push(rod(pts[i], pts[i + 1], r0, r0 - 0.014, col), ellipsoid(r0 - 0.01, r0 - 0.01, r0 - 0.01, pts[i + 1], col, 8));
    }
    for (const [i, d] of [[2, V(-0.18, 0.05, 0.06)], [3, V(-0.15, 0.1, 0.03)], [4, V(0.03, 0.18, 0.04)]]) {   // prongs: two on the inside, a fork at the tip
      const at = pts[i], to = at.clone().add(d.setX(d.x * s));
      parts.push(rod(at, to, 0.038, 0.007, C.tip));
    }
    for (let k = 0; k < 7; k++) {   // a row of small teeth along the inside, from the base to the first prong
      const i = Math.min(3, Math.floor(k / 2.4)), f = (k / 2.4) % 1, at = pts[i].clone().lerp(pts[i + 1], f);
      parts.push(rod(at, at.clone().add(V(-s * 0.05, 0.015, 0.02)), 0.016, 0.003, C.tip));
    }
    return merge(parts);
  };
  // a leg on side s, built at its hip: the femur up and out to the knee, the spiny tibia down to the
  // floor, the tarsus in short segments to a hooked foot
  const leg = (s, len) => {
    const P = (x, y, z) => V(x * s * len, y, z * len);
    const a = V(0, 0, 0), b = P(0.42, 0.2, 0), c = P(0.82, -0.26, 0), d = P(1.02, -0.3, 0), f = P(1.08, -0.28, 0);
    const parts = [rod(a, b, 0.05, 0.04, C.leg), ellipsoid(0.045, 0.045, 0.045, b, C.leg, 8), rod(b, c, 0.035, 0.028, C.leg), ellipsoid(0.03, 0.03, 0.03, c, C.leg, 8), rod(c, d, 0.016, 0.014, C.leg), rod(d, f, 0.012, 0.006, C.tip)];
    for (let k = 0; k < 4; k++) parts.push(ellipsoid(0.022 - k * 0.002, 0.018 - k * 0.002, 0.018 - k * 0.002, c.clone().lerp(d, (k + 0.5) / 4), C.leg, 6));   // the beaded foot
    for (let k = 0; k < 4; k++) { const at = b.clone().lerp(c, 0.25 + k * 0.2); parts.push(rod(at, at.clone().add(V(s * 0.03, 0.045, 0.02)), 0.01, 0.002, C.tip)); }   // tibial spines
    for (const z of [-1, 1]) parts.push(rod(f, f.clone().add(V(s * 0.03, -0.03, z * 0.025)), 0.008, 0.002, C.tip));                                  // the hooked claws
    return merge(parts);
  };
  return {
    body: merge(body),
    shell: merge(shell),
    mandibles: [-1, 1].map((s) => mandible(s)),
    legs: [[0.74, 1.05], [0.3, 0.95], [-0.12, 1.05]].map(([z, len], i) => ({ z, i, geo: [-1, 1].map((s) => leg(s, len)) })),
  };
}
export function buildBeetle() {
  const G = (GEO.beetle ||= beetleParts()), M = mats();
  // a glossy clear coat over an iridescent shell (shimmering green to blue and violet as it turns), and big enough to read without the small bugs' glow
  if (!M.stag) standOut(M.stag = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.85, clearcoat: 1, clearcoatRoughness: 0.1,
    iridescence: LOOK.num('beetle-iridescence', 1), iridescenceIOR: 1.8, iridescenceThicknessRange: LOOK.list('beetle-film', [260, 620]).map(Number) }), { base: 0.1, rim: 0.2 });
  const outer = new THREE.Group(), body = new THREE.Group();
  outer.add(body);
  body.add(new THREE.Mesh(G.body, M.stag));
  const shell = new THREE.Mesh(G.shell, M.stag);
  body.add(shell);
  const face = angryEyes({ y: 0.5, z: 1.26, size: 0.085, gap: 0.27 });
  body.add(face);
  const jaws = G.mandibles.map((geo, i) => {
    const s = i ? 1 : -1, hinge = new THREE.Group();
    hinge.position.set(s * 0.17, 0.38, 1.3);
    hinge.add(new THREE.Mesh(geo, M.stag));
    body.add(hinge);
    return { s, hinge };
  });
  const legs = [];
  for (const L of G.legs) [-1, 1].forEach((s, j) => {
    const hip = new THREE.Group();
    hip.name = 'leg';
    hip.position.set(s * 0.28, 0.3, L.z);
    hip.add(new THREE.Mesh(L.geo[j], M.stag));
    body.add(hip);
    legs.push({ hip, z0: L.z, base: s * (L.i - 1) * 0.55, s, phase: (L.i + j) % 2 ? Math.PI : 0 });   // front legs reach forward, back legs back; a tripod gait
  });
  let t = 0, k = 0, open = 0, pump = 0;
  // its charge-shot (attack-motion "throw", tier heavy, src/attack-motion.js): plants itself (legs splayed, body
  // dropped), jaws parting and trembling round the growing ball, a pump in its shell quickening with it; the aim
  // locks with the jaws clamping in a little and its head dipping; then dead still, the jaws snapping wide and the head
  // throwing up as the shot goes. It is a tank: the whole body is shoved back with its feet dragging, and
  // eases home with no bounce, the jaws closing slowly
  const anim = (dt, e) => {
    const speed = Math.hypot(e.vel.x, e.vel.z);
    k += (Math.min(1, speed * 8) - k) * (1 - Math.exp(-8 * dt));
    t += dt * (2.5 + 9 * k);
    const A = e.atk, ph = A ? A.phase : 'idle';
    const charge = e.state === 'charge' ? e.ballK || 0 : 0;
    let plant = 0, dip = 0, shove = 0, len = 1, still = 0, kick = A ? 0 : Math.max(0, (e.firedT || 0) / 0.3);
    if (ph === 'build') {
      plant = THREE.MathUtils.smoothstep(A.pt / 0.2, 0, 1);
      dip = lockBeat(A) ? 1 : 0;
      still = A.still ? 1 : 0;
    } else if (ph === 'swing') {
      const s = snap(Math.min(1, A.pt / A.style.strike), A.tier.over);
      plant = 1; shove = kick = s;
      len = A.smear ? knobs().smear : 1 + (A.tier.stretch - 1) * Math.min(1, s);
    } else if (ph === 'recoil') { plant = 1 - A.k; shove = kick = heavy(A.k); }   // (it stands up as it eases home)
    const slide = A ? -0.15 * shove : -0.12 * kick;
    for (const L of legs) {
      L.hip.rotation.y = L.base + Math.sin(t + L.phase) * 0.3 * k;
      L.hip.rotation.z = -L.s * (Math.max(0, Math.cos(t + L.phase)) * 0.18 * k + plant * 0.14);   // lifts the leg as it swings forward; planted, they splay
      L.hip.position.z = L.z0 - slide * 0.7;                      // the feet drag: they stay put as the body is shoved back
    }
    // the charge: its jaws part and tremble round the growing ball, its head rearing a little; the
    // shot: they snap wide and it rocks back
    open += (charge * 0.22 - open) * (1 - Math.exp(-10 * dt));
    pump += dt * (8 + charge * 24);
    const tremble = charge > 0 && !still ? Math.sin(t * 50 + e.phase) * 0.03 * charge * (A ? A.quiet : 1) : 0;
    for (const J of jaws) J.hinge.rotation.y = J.s * (open * (1 - 0.1 * dip) + tremble + kick * 0.35 + Math.sin(t * 0.8) * 0.02);
    shell.scale.y = 1 + Math.sin(pump) * 0.012 * charge;
    body.rotation.x = -0.06 * charge + dip * 0.06 - (A ? 0.14 * kick : 0.1 * kick);
    body.position.set(0, Math.abs(Math.sin(t)) * 0.012 * k * (1 - still) - 0.08 * plant, slide);
    body.rotation.z = Math.sin(t) * 0.02 * k;
    stretch(body, len);
    if (A) eyes(face, A);
  };
  anim.reset = () => { t = 0; k = 0; open = 0; pump = 0; stretch(body, 1); shell.scale.y = 1; body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); for (const L of legs) L.hip.position.z = L.z0; face.children.forEach((c) => { c.scale.y = 1; c.rotation.x = 0; }); };   // (a pooled model killed mid-shot)
  return { body: outer, face: new THREE.Group(), anim, deathParts: [shell] };
}

// ------------------------------------------------------------------ cicada
// The cicada (act 4): a stocky dark-green body with pale green collar and rim lines, a wide blunt
// head with big red eyes set far apart on its sides and three red dots between them, a thick thorax,
// a tapering banded abdomen, six short thick legs, and four clear wings veined in green that lie
// folded like a roof over its back. Under the burrow word it digs into the floor and sinks out of
// sight, leaving a mound of grit with a glowing rim that trails after you, shakes as it locks and
// is left behind when it bursts up; dazed, it sways with its wings buzzing. About 2.8 radii long; feet at its origin.
function cicadaParts() {
  const body = '#1a2616', thorax = '#243a1c', pale = '#9ab85a', band = '#34502a', eye = '#c4301c', leg = '#2a3a1e', dark = '#0c140a';
  const bodyParts = [
    ellipsoid(0.62, 0.52, 0.78, V(0, 0.78, 0.15), thorax),                   // the thick thorax
    ellipsoid(0.5, 0.18, 0.2, V(0, 1.05, 0.5), pale),                         // the pale collar
    ellipsoid(0.7, 0.34, 0.26, V(0, 0.75, 0.8), body),                        // the wide blunt head
    ellipsoid(0.26, 0.28, 0.26, V(-0.68, 0.82, 0.82), eye, 14),               // the big red eyes, far apart on its sides
    ellipsoid(0.26, 0.28, 0.26, V(0.68, 0.82, 0.82), eye, 14),
    ellipsoid(0.05, 0.05, 0.05, V(-0.14, 1.0, 0.98), eye, 8), ellipsoid(0.05, 0.05, 0.05, V(0.14, 1.0, 0.98), eye, 8), ellipsoid(0.05, 0.05, 0.05, V(0, 1.06, 0.92), eye, 8),   // three simple eyes
  ];
  for (let i = 0; i < 5; i++) bodyParts.push(ellipsoid(0.5 - i * 0.045, 0.4 - i * 0.035, 0.22, V(0, 0.66, -0.35 - i * 0.3), i % 2 ? band : body));   // the tapering banded abdomen
  for (const s of [-1, 1]) {
    bodyParts.push(tube([V(s * 0.1, 1.2, 0.35), V(s * 0.45, 1.1, -0.2), V(s * 0.5, 0.95, -0.9)], 0.02, pale, 10));   // pale lines along its back
    bodyParts.push(rod(V(s * 0.28, 0.52, 0.4), V(s * 0.45, 0.86, 0.65), 0.03, 0.01, dark));   // short antennae
  }
  // a leg: thick femur out and down, short tibia to the ground, built at the hip
  const legGeo = (s, reach) => merge([rod(V(0, 0, 0), V(s * 0.4, 0.05, 0), 0.1, 0.07, leg), rod(V(s * 0.4, 0.05, 0), V(s * reach, -0.52, 0), 0.07, 0.02, leg), rod(V(s * 0.55, -0.12, 0), V(s * 0.6, 0.0, 0.03), 0.015, 0.002, dark)]);
  // a wing out from its root along +z' (turned backwards when hung), clear with a green rim and veins
  const wing = (len, wid) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.bezierCurveTo(wid * 0.9, len * 0.1, wid * 1.1, len * 0.7, 0, len); sh.bezierCurveTo(-wid * 0.3, len * 0.7, -wid * 0.2, len * 0.15, 0, 0);
    const veins = merge([0, 0.35, 0.7].map((u) => tube([V(0, 0.003, 0.02), V(wid * (0.1 + 0.55 * u), 0.003, len * 0.5), V(wid * (0.05 + 0.2 * u), 0.003, len * 0.9)], 0.012, pale, 8)));
    return { sheet: new THREE.ShapeGeometry(sh).rotateX(Math.PI / 2), veins };
  };
  return { body: merge(bodyParts), legs: [[0.55, 0.85], [0.1, 0.95], [-0.35, 1.05]].map(([z, reach]) => ({ z, geo: [-1, 1].map((s) => legGeo(s, reach)) })), fore: wing(2.0, 0.6), hind: wing(1.5, 0.5) };
}
export function buildCicada() {
  const G = (GEO.cicada ||= cicadaParts()), M = mats();
  const outer = new THREE.Group(), body = new THREE.Group();
  outer.add(body);
  body.add(new THREE.Mesh(G.body, M.matte));
  const legs = [];
  for (const L of G.legs) [-1, 1].forEach((s, j) => {
    const hip = new THREE.Group();
    hip.position.set(s * 0.45, 0.48, L.z);
    hip.add(new THREE.Mesh(L.geo[j], M.matte));
    body.add(hip);
    legs.push({ hip, base: s * (L.z - 0.1) * 0.5, s, front: L.z > 0.3, phase: (L.z > 0.3) !== (s > 0) ? Math.PI : 0 });
  });
  // the four wings: hinged on its back, each a (left, right) pair lying along its sides like a roof
  const wings = [[G.fore, 0.2], [G.hind, 0.05]].flatMap(([geo, z]) => [-1, 1].map((s) => {
    const hinge = new THREE.Group();
    hinge.position.set(s * 0.22, 1.12, z);
    const m = new THREE.Group();   // wing lies back along -z, tilted down at its outer edge
    m.rotation.set(0, Math.PI, 0);
    m.scale.x = -s;
    m.add(new THREE.Mesh(geo.sheet, M.wing), new THREE.Mesh(geo.veins, M.matte));
    hinge.add(m); body.add(hinge);
    return { hinge, s };
  }));
  // the mound it leaves on the floor while it is under (one shared dome and rim, drawn instanced with the rest)
  const D = (GEO.cicadaMound ||= { dome: new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), rim: new THREE.RingGeometry(0.8, 1.2, 28).rotateX(-Math.PI / 2).translate(0, 0.02, 0) });
  const glow = hostile('cicada');
  M.mound ||= new THREE.MeshStandardMaterial({ color: 0x2a2018, emissive: glow, emissiveIntensity: 0.08, roughness: 1 });
  M.moundRim ||= new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: LOOK.num('burrow-mound-rim', 0.25), depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 });   // dim: only the locked Warning is bright
  const mound = new THREE.Group();
  mound.add(new THREE.Mesh(D.dome, M.mound), new THREE.Mesh(D.rim, M.moundRim));
  mound.visible = false;
  outer.add(mound);
  let t = 0, k = 0, mt = 0;
  // its burrow (attack-motion "pounce" tier="heavy", src/attack-motion.js): digging in, its forelegs scoop in turn
  // and it shimmies down in three pulses; under, the mound heaves after you. On the beat it bursts up stretched,
  // wings thrown open, and hangs there a moment, then lands squashed and heavy and sways dazed, wings drooped and
  // buzzing. For the last 0.25 s it shakes its head and snaps its wings shut: the window to hit it is closing.
  const anim = (dt, e) => {
    const speed = Math.hypot(e.vel.x, e.vel.z);
    k += (Math.min(1, speed * 10) - k) * (1 - Math.exp(-8 * dt));
    t += dt * (2 + 8 * k);
    mt += dt;
    const A = e.atk, ph = A ? A.phase : 'idle', S = THREE.MathUtils.smoothstep;
    const dig = e.state === 'dig' ? e.digK || 0 : 0, P = Math.PI * 6;   // (three pulses: 6π)
    let sink = e.under ? 1 : dig - Math.sin(dig * P) / P, up = 0, len = 1, open = 0, daze = 0, shut = 0, squash = 0, shake = 0, lean = 0;
    if (ph === 'swing') { up = 1; open = 1; len = A.smear ? knobs().smear : A.tier.stretch; }
    else if (ph === 'recoil') {
      const p = A.pt, left = e.state === 'dazed' ? Math.max(0, e.stateT) : 0;
      up = 1 - S(p, 0, 0.1);                                    // down it comes
      squash = 0.3 * heavy(Math.min(1, p / 0.6)) * S(p, 0, 0.1);
      daze = S(left, 0, 0.1);                                   // dazed until the very end (its wings shut first)
      open = 1 - S(p, 0, 0.15);
      shut = left < 0.25 ? 1 - left / 0.25 : 0;
      shake = Math.sin(A.t * 45) * 0.25 * shut * (1 - shut) * 4;
      if (!A.hit) lean = A.side * 0.3 * daze * (1 - shut) * S(p, 0.05, 0.2);   // a burst that missed lands lopsided, tipped onto one side
    }
    for (const L of legs) {
      // digging: the forelegs scoop in turn
      const scoop = L.front && dig > 0 ? Math.max(0, Math.sin(dig * P + (L.s > 0 ? Math.PI : 0))) * 0.7 : 0;
      L.hip.rotation.set(0, L.base + Math.sin(t + L.phase) * 0.3 * k - L.s * scoop, -L.s * (Math.max(0, Math.cos(t + L.phase)) * 0.2 * k + scoop * 0.5));
    }
    const buzz = Math.sin((A ? A.t : mt) * 120) * 0.08 * daze * (1 - shut);
    for (const W of wings) W.hinge.rotation.set(0, 0, W.s * (-0.35 - 0.2 * daze * (1 - shut) + buzz + open * 1.2));
    body.visible = sink < 0.97;
    body.position.y = -sink * 1.5 + up * 0.2 - squash * 0.15 + Math.abs(Math.sin(t)) * 0.015 * k;
    body.rotation.set(0.18 * daze, shake, lean + Math.sin(t) * 0.025 * k + Math.sin(mt * 5) * 0.16 * daze * (1 - shut) + (dig > 0 ? Math.sin(dig * P) * 0.08 : 0));
    { const y = squash ? 1 - squash : len, w = 1 / Math.sqrt(y); body.scale.set(w, y, w); }   // stretched up, squashed down
    // the mound: swells as it digs, heaves as it travels, shakes harder as it locks over its spot
    const rise = Math.min(1, sink * 1.6), lock = e.under && e.burrowLocked ? e.burrowK || 0 : 0, move = e.under && !e.burrowLocked ? 1 : 0;
    mound.visible = rise > 0.02;
    mound.scale.set(1.3 * rise * (1 + 0.1 * lock * Math.sin(mt * 40)), rise * (0.55 + 0.12 * move * Math.sin(mt * 9) + 0.25 * lock), 1.3 * rise * (1 + 0.1 * lock * Math.sin(mt * 40)));
    mound.position.x = Math.sin(mt * 55) * 0.05 * lock;
  };
  anim.reset = () => { t = 0; k = 0; mt = 0; body.visible = true; mound.visible = false; body.scale.set(1, 1, 1); body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); };
  return { body: outer, face: new THREE.Group(), anim, deathParts: wings.map((W) => W.hinge) };
}

// ------------------------------------------------------------------ horsehair worm
// What was inside the mantis: its carcass lies rolled on its side and a long, thin, glossy
// dark-brown worm writhes up out of the tip of its abdomen in loose coils. It can't leave the body. To attack
// it rears up and back, coiling, then cracks down along the floor like a whip, tip last.
// The worm is a chain of short tube pieces (one geometry: drawn as one instanced batch) laid along
// a curve that blends between its poses every frame.
const WORM = { n: 64, thick: 0.085 };
export function buildWorm() {
  const carcass = buildMantis({ dead: true }), M = mats();
  if (!M.worm) {
    M.worm = new THREE.MeshStandardMaterial({ color: 0x1e130c, roughness: 0.22, metalness: 0.1 });
    standOut(M.worm, { base: 0.15, rim: 0.7 });
    GEO.wormBead ||= new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).rotateX(Math.PI / 2);   // a unit piece along +z
  }
  const outer = new THREE.Group(), body = carcass.body;
  outer.add(body);
  body.updateMatrixWorld(true);
  const base = carcass.rig.tail.getWorldPosition(new THREE.Vector3());   // in the outer group's space (radius units)
  const beads = [];
  for (let i = 0; i < WORM.n; i++) { const b = new THREE.Mesh(GEO.wormBead, M.worm); b.visible = false; outer.add(b); beads.push(b); }
  const pts = Array.from({ length: WORM.n + 1 }, () => new THREE.Vector3()), tmp = new THREE.Vector3(), PA = new THREE.Vector3(), PB = new THREE.Vector3();
  const UPV = V(0, 1, 0), FWD = V(0, 0, 1), q = new THREE.Quaternion(), dir = new THREE.Vector3();
  // the poses, s from 0 (in the head) to 1 (the tip); d: the way it lashes (local, flat)
  const idle = (s, t, out) => {
    const a = s * 4.2 * Math.PI + t * 1.6, rho = 0.3 + 0.35 * s;
    return out.set(base.x + rho * Math.cos(a) - rho * 0.6, base.y + s * 1.8 + Math.sin(s * 9 + t * 3) * 0.08, base.z + rho * Math.sin(a));
  };
  const back = (s, t, d, wig, out) => {
    const lift = Math.sin(s * Math.PI * 0.9);
    return out.set(base.x - d.x * lift * 1.3 + Math.sin(s * 12 + t * 8) * 0.06 * wig, base.y + s * 2.8 - Math.max(0, s - 0.75) * 2.4, base.z - d.z * lift * 1.3);
  };
  const lash = (s, len, d, out) => out.set(base.x + d.x * s * len, 0.06 + base.y * (1 - s) * (1 - s), base.z + d.z * s * len);
  const smooth = (u) => { u = u < 0 ? 0 : u > 1 ? 1 : u; return u * u * (3 - 2 * u); };
  let t = 0, grow = 0;
  // its whip (attack-motion "swipe", src/attack-motion.js): rears back into an S, holds it with the tip quivering,
  // goes dead still; cracks down tip last, thinning as it stretches, and a ripple runs base to tip along the floor;
  // then it lifts off base first, a wave running out to the tip, and sways back to idle
  const anim = (dt, e) => {
    t += dt;
    // where it lashes, in the body's own space (the body never turns: it's rooted)
    const a = Math.atan2(e.whipDir?.x ?? 0, e.whipDir?.z ?? 1) - e.root.rotation.y;
    dir.set(Math.sin(a), 0, Math.cos(a));
    const len = (e.whipReach ?? 0.25) / e.r;
    const emerging = e.state === 'emerge';
    grow = emerging ? 0 : Math.min(1, grow + dt * 3);
    const K = e.atk, ph = K ? K.phase : 'idle';
    let wind = 0, out = 0, rise = -1, wig = 1, tipQ = 0, thin = 0, rip = 0, at = 0, sway = 0;
    if (ph === 'build') {
      wind = coil(K.k, K.style.hold, K.style.over) * K.vary;           // reared back by 40%, past, then held
      wig = K.still ? 0 : 1;
      tipQ = wig * quiver(Math.max(0, (K.k - 0.57) / 0.43), K.t, e.phase) * K.quiet;   // the tip, over the last 0.3 s
    } else if (ph === 'swing') {
      // the lash (its step's own clock), then lying along its line (down); held as it was after that (the contact)
      const lashing = K.key === 'lash', d = K.key === 'down' ? Math.min(1, K.st / Math.max(1e-3, K.len)) : lashing ? 0 : 1;
      wind = K.vary; out = lashing ? Math.min(1, K.st / Math.max(1e-3, K.len)) : 1;
      thin = 0.15 * (out < 1 ? out : 1 - d);
      rip = 0.16 * (1 - d) * Math.min(1, d * 8); at = d * 1.2;            // a ripple running base to tip, dying away
    } else if (ph === 'recoil') {
      rise = K.k;
      sway = settle(K.k, K.style.bounces, K.style.damp) * Math.min(1, K.pt / 0.15) * 0.35 * K.side;
    }
    // the carcass twitches while the worm is coming
    body.rotation.x = emerging ? Math.sin(t * 40) * 0.05 * Math.min(1, t) : 0;
    for (let i = 0; i <= WORM.n; i++) {
      const s = (i / WORM.n) * grow;
      idle(s, t, PA);
      if (wind) PA.lerp(back(s, t, dir, wig, PB), wind);
      if (tipQ) { const w = tipQ * 0.3 * s * s * s; PA.x += dir.z * w; PA.z -= dir.x * w; }
      // on the floor along its line: lashing, the tip arrives last (a whip's crack); lifting off, the base goes first
      const u = ph === 'swing' ? smooth(out * 1.6 - s * 0.6) : rise >= 0 ? 1 - smooth(rise * 1.8 - s * 0.8) : 0;
      if (u > 0) PA.lerp(lash(s, len, dir, PB), u);
      if (rip) { const g = (s - at) / 0.12; PA.y += rip * Math.exp(-g * g); }
      if (sway) { const w = sway * s * (1 - u); PA.x += dir.z * w; PA.z -= dir.x * w; }
      pts[i].copy(PA);
    }
    // the pieces, each from one point to the next (a little longer, so the joins close), thinning to the tip
    for (let i = 0; i < WORM.n; i++) {
      const b = beads[i], p = pts[i], n = pts[i + 1];
      const l = tmp.copy(n).sub(p).length(), th = WORM.thick * (1 - 0.55 * i / WORM.n) * (1 - thin);
      b.visible = grow > 0.02;
      b.position.copy(p).add(n).multiplyScalar(0.5);
      if (l > 1e-5) b.quaternion.copy(q.setFromUnitVectors(FWD, tmp.divideScalar(l)));
      b.scale.set(th, th, (l * 1.15 + th * 0.5) * (K?.smear && i > WORM.n - 8 ? knobs().smear : 1));   // the smear frame: the tip stretched
    }
    // where the worm comes out, in the world: the burst and whip words read it
    (e.emergeAt ||= new THREE.Vector3()).copy(base).applyAxisAngle(UPV, e.root.rotation.y).multiplyScalar(e.r).add(e.pos);
  };
  anim.reset = () => { t = 0; grow = 0; };
  return { body: outer, face: new THREE.Group(), anim };
}

// ------------------------------------------------------------------ wasp
// A yellowjacket, after the photo: a black head with big kidney-shaped compound eyes notched
// with yellow, a yellow face with a black mark and orange jaws, long black elbowed antennae; a
// fuzzy black thorax with yellow edges and spots; a thin waist; a plump abdomen in yellow and
// black bands (a black dot on each yellow band) tapering to its sting; two pairs of clear,
// amber-veined wings with an orange leading edge; and six yellow legs with orange feet, black at
// the hips. It flies with its wings a blur, legs hanging and abdomen pumping. Facing +z, centred
// on its thorax; about 3 radii long, antennae to sting.
function waspParts() {
  const R = seeded(83), black = '#121010', yellow = '#f2d21a', orange = '#e08a1c', hair = '#3a3228';
  // the abdomen (a lathe: u around, 0 = the top; v front 0 -> back 1): black at the waist, then
  // yellow bands with black between, each band dipping to a point in the middle of the back and
  // carrying a black dot each side, a black tip
  const gaster = wingTexture(512, 512, (g, w, h) => {
    g.fillStyle = black; g.fillRect(0, 0, w, h);
    const bands = [[0.12, 0.25], [0.3, 0.42], [0.47, 0.58], [0.63, 0.73], [0.78, 0.86]];
    for (const [a, b] of bands) {
      g.fillStyle = yellow; g.beginPath();
      g.moveTo(0, h * a);
      for (let x = 0; x <= w; x += 4) {                              // the band's front edge dips at the top (u = 0 / 1)
        const u = x / w, top = Math.min(u, 1 - u);
        g.lineTo(x, h * (a + Math.max(0, 0.06 - top * 0.3)));
      }
      g.lineTo(w, h * b); g.lineTo(0, h * b); g.closePath(); g.fill();
      g.fillStyle = black;
      for (const u of [0.12, 0.88]) { g.beginPath(); g.ellipse(u * w, h * (a + b) / 2 + 2, w * 0.035, h * (b - a) * 0.28, 0, 0, 7); g.fill(); }
    }
    for (let k = 0; k < 1500; k++) { g.fillStyle = `rgba(255,255,255,${R() * 0.06})`; g.fillRect(R() * w, R() * h, 2, 1); }
  });
  // the thorax (a sphere: u around from -x, v top -> bottom): fuzzy black, a yellow collar at the
  // front, two yellow spots behind, yellow side patches
  const thorax = wingTexture(512, 256, (g, w, h) => {
    g.fillStyle = black; g.fillRect(0, 0, w, h);
    g.fillStyle = yellow;
    g.beginPath(); g.ellipse(w * 0.75, h * 0.28, w * 0.2, h * 0.05, 0, 0, 7); g.fill();       // the collar along the front
    for (const u of [0.18, 0.32]) { g.beginPath(); g.ellipse(u * w, h * 0.28, w * 0.025, h * 0.04, 0, 0, 7); g.fill(); }   // two spots behind
    for (const u of [0, 0.5, 1]) { g.beginPath(); g.ellipse(u * w, h * 0.55, w * 0.06, h * 0.1, 0.4, 0, 7); g.fill(); }  // the side patches
    for (let k = 0; k < 2500; k++) { g.fillStyle = `rgba(${90 + R() * 60 | 0},${70 + R() * 40 | 0},40,${R() * 0.25})`; g.fillRect(R() * w, R() * h, 1, 2); }
  });
  // an eye: glossy black-brown with faint facets
  const eye = wingTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#1a1614'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) for (let x = (y / 3) % 2 ? 1.5 : 0; x < w; x += 3) { g.fillStyle = `rgba(120,100,80,${R() * 0.18})`; g.fillRect(x, y, 1.2, 1.2); }
  });
  // a wing (u along the span, v from the leading edge): clear with an amber tint, an orange-brown
  // leading edge, dark veins making a few big cells, smoky near the root
  const wing = wingTexture(1024, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const m = g.createLinearGradient(0, 0, w, 0);
    m.addColorStop(0, 'rgba(160,110,50,.7)'); m.addColorStop(0.3, 'rgba(225,215,190,.42)'); m.addColorStop(1, 'rgba(235,230,215,.36)');
    g.fillStyle = m; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(200,110,30,.9)'; g.fillRect(0, 0, w * 0.62, h * 0.07);              // the leading edge
    g.fillStyle = 'rgba(150,80,20,.95)'; g.beginPath(); g.ellipse(w * 0.6, h * 0.06, w * 0.05, h * 0.05, 0, 0, 7); g.fill();   // the stigma
    g.strokeStyle = 'rgba(90,60,30,.95)'; g.lineCap = 'round'; g.lineWidth = 4;
    const vein = (pts) => { g.beginPath(); g.moveTo(pts[0][0] * w, pts[0][1] * h); for (const [x, y] of pts.slice(1)) g.lineTo(x * w, y * h); g.stroke(); };
    vein([[0, 0.2], [0.35, 0.22], [0.6, 0.12]]); vein([[0, 0.38], [0.3, 0.4], [0.55, 0.42], [0.85, 0.3]]); vein([[0, 0.55], [0.28, 0.6], [0.5, 0.65], [0.75, 0.62]]);
    g.lineWidth = 2;
    vein([[0.35, 0.22], [0.3, 0.4]]); vein([[0.55, 0.42], [0.6, 0.12]]); vein([[0.45, 0.17], [0.42, 0.41]]); vein([[0.5, 0.65], [0.55, 0.42]]); vein([[0.28, 0.6], [0.3, 0.4]]);
    vein([[0.6, 0.12], [0.75, 0.1], [0.85, 0.3]]); vein([[0.75, 0.62], [0.85, 0.3]]);
  });
  const wingGeo = (len, chord) => {
    const s = new THREE.Shape().moveTo(0, 0)
      .bezierCurveTo(len * 0.4, 0.01, len * 0.8, 0.0, len * 0.97, -chord * 0.25)
      .bezierCurveTo(len * 1.02, -chord * 0.55, len * 0.9, -chord * 0.85, len * 0.7, -chord * 0.85)
      .bezierCurveTo(len * 0.4, -chord * 0.8, len * 0.15, -chord * 0.55, 0, -chord * 0.15).closePath();
    const geo = new THREE.ShapeGeometry(s, 32), p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      uv.setXY(i, x / len, 1 + y / chord);
      p.setXYZ(i, x, Math.sin((x / len) * Math.PI) * 0.03, y);
    }
    geo.computeVertexNormals();
    return geo;
  };
  // the abdomen: plump, widest a third of the way back, tapering to the sting
  const LEN = 1.45, prof = [[0, 0.06], [0.05, 0.2], [0.18, 0.36], [0.38, 0.42], [0.6, 0.38], [0.8, 0.26], [0.93, 0.12], [1, 0.02]];
  const curve = new THREE.CatmullRomCurve3(prof.map(([v, r]) => V(r, v, 0)));
  const gasterGeo = new THREE.LatheGeometry(curve.getPoints(60).map((p) => new THREE.Vector2(Math.max(0.006, p.x), p.y * LEN)), 28)
    .rotateX(-Math.PI / 2).scale(1, 0.95, 1);
  const hairs = (n, c, rad, len, col = hair) => {
    const out = [];
    for (let k = 0; k < n; k++) {
      const d = V(R() - 0.5, R() * 0.9 - 0.2, R() - 0.5).normalize(), a = c.clone().add(d.clone().multiply(rad));
      out.push(rod(a, a.clone().addScaledVector(d, len * (0.6 + R() * 0.7)), 0.007, 0.0015, col));
    }
    return out;
  };
  // a leg on the +x side from its hip: black coxa, yellow femur and tibia, orange tarsus in segments
  const legGeo = (fwd, sc) => {
    const a = V(0, 0, 0), b = V(0.12, -0.08, fwd * 0.05), c = V(0.3 * sc, -0.42 * sc, fwd * 0.18), d = V(0.34 * sc, -0.85 * sc, fwd * 0.12 - 0.05), f = V(0.36 * sc, -1.15 * sc, fwd * 0.1 - 0.1);
    const parts = [rod(a, b, 0.05, 0.045, black), rod(b, c, 0.042, 0.035, yellow), rod(c, d, 0.032, 0.026, yellow), ellipsoid(0.038, 0.038, 0.038, c, orange, 8)];
    for (let k = 0; k < 5; k++) { const p = d.clone().lerp(f, k / 5), q = d.clone().lerp(f, (k + 0.85) / 5); parts.push(rod(p, q, 0.022, 0.016, orange), ellipsoid(0.02, 0.02, 0.02, q, '#c86a14', 6)); }
    parts.push(...[-1, 1].map((k) => rod(f, f.clone().add(V(k * 0.02, -0.04, 0.03)), 0.008, 0.002, '#5a2a0c')));
    return merge(parts);
  };
  const body = [
    ellipsoid(0.3, 0.27, 0.16, V(0, 0.05, 0.86), black, 24),             // the head, wide and flat-fronted
    ellipsoid(0.14, 0.13, 0.05, V(0, -0.06, 0.99), yellow, 18),           // the face (clypeus)...
    ellipsoid(0.03, 0.06, 0.02, V(0, -0.04, 1.04), black, 8),             // ...with its black mark
    ellipsoid(0.09, 0.05, 0.03, V(0, 0.14, 0.98), yellow, 12),            // yellow brow between the antennae
    ...[-1, 1].flatMap((s) => [rod(V(s * 0.03, -0.17, 1.0), V(s * 0.07, -0.26, 1.06), 0.04, 0.015, orange), ellipsoid(0.03, 0.06, 0.03, V(s * 0.2, 0.06, 0.95), yellow, 8)]),   // jaws, the yellow eye notches
    ...[-1, 1].map((s) => tube([V(s * 0.06, 0.12, 1.0), V(s * 0.1, 0.32, 1.12), V(s * 0.16, 0.36, 1.22), V(s * 0.22, 0.12, 1.42), V(s * 0.26, -0.2, 1.52)], 0.026, black, 18)),   // elbowed antennae
    ellipsoid(0.15, 0.15, 0.12, V(0, 0.0, 0.7), black, 14),               // the neck
    ellipsoid(0.13, 0.12, 0.14, V(0, -0.02, 0.07), black, 14),            // the waist (petiole)
    ...hairs(70, V(0, 0.05, 0.42), V(0.3, 0.3, 0.38), 0.07),               // fuzz on the thorax
    ...hairs(30, V(0, 0.05, 0.86), V(0.28, 0.25, 0.14), 0.05),             // and the head
  ];
  return {
    gaster, thorax, eye, wing,
    gasterGeo: gasterGeo.translate(0, 0, 0.02),
    sting: merge([rod(V(0, 0, -LEN + 0.04), V(0, -0.03, -LEN - 0.1), 0.024, 0.003, '#3a2210')]),
    thoraxGeo: new THREE.SphereGeometry(1, 32, 22).scale(0.3, 0.3, 0.4).translate(0, 0.02, 0.42),
    eyeGeo: new THREE.SphereGeometry(1, 24, 16).scale(0.1, 0.2, 0.13),
    foreGeo: wingGeo(1.55, 0.36), hindGeo: wingGeo(1.05, 0.28),
    body: merge(body),
    legs: [[0.55, 1, 0.9], [0.4, 0, 1], [0.27, -1, 1.1]].map(([z, fwd, sc]) => ({ z, geo: legGeo(fwd, sc) })),
  };
}

export function buildWasp() {
  const G = (GEO.wasp ||= waspParts()), M = mats();
  if (!M.wpGaster) {
    M.wpGaster = new THREE.MeshPhysicalMaterial({ map: G.gaster, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    M.wpThorax = new THREE.MeshStandardMaterial({ map: G.thorax, roughness: 0.6 });
    M.wpEye = new THREE.MeshPhysicalMaterial({ map: G.eye, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
    M.wpWing = new THREE.MeshStandardMaterial({ map: G.wing, transparent: true, side: THREE.DoubleSide, roughness: 0.15, depthWrite: false });
    M.wpBody = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 });
    for (const [m, l] of [[M.wpGaster, { base: 0.25, rim: 0.5 }], [M.wpThorax, { base: 0.2, rim: 0.5 }], [M.wpEye, { base: 0.15, rim: 0.4 }], [M.wpWing, { base: 0.25, rim: 0.4 }], [M.wpBody, { base: 0.2, rim: 0.45 }]]) standOut(m, l);
  }
  const outer = new THREE.Group(), body = new THREE.Group();
  outer.add(body);
  const add = (parent, geo, mat, at) => { const m = new THREE.Mesh(geo, mat); if (at) m.position.copy(at); parent.add(m); return m; };
  add(body, G.body, M.wpBody);
  add(body, G.thoraxGeo, M.wpThorax);
  for (const s of [-1, 1]) { const e = add(body, G.eyeGeo, M.wpEye, V(s * 0.24, 0.04, 0.88)); e.rotation.set(0.15, s * 0.5, 0); }
  const face = angryEyes({ y: 0.16, z: 1.02, size: 0.09, gap: 0.17 });
  body.add(face);
  // the abdomen hangs from the waist, a little low, and pumps as it flies
  const tail = new THREE.Group();
  tail.position.set(0, -0.04, 0.02);
  tail.rotation.x = -0.35;
  body.add(tail);
  add(tail, G.gasterGeo, M.wpGaster, V(0, 0, -0.02));
  add(tail, G.sting, M.wpBody);
  G.sting.computeBoundingBox();
  const tip = new THREE.Object3D();                // where the sting ends (the stories look for it)
  tip.name = 'tip';
  tip.position.set(0, -0.03, G.sting.boundingBox.min.z);
  tail.add(tip);
  const wings = [];
  for (const [geo, z, fore] of [[G.foreGeo, 0.52, true], [G.hindGeo, 0.36, false]]) for (const s of [-1, 1]) {
    const hinge = new THREE.Group(), flap = new THREE.Group();
    hinge.position.set(s * 0.14, 0.26, z);
    hinge.rotation.y = s * (fore ? 0.55 : 0.7);                           // swept back over the abdomen
    hinge.add(flap);
    const m = add(flap, geo, M.wpWing);
    m.scale.x = s;
    body.add(hinge);
    wings.push({ s, fore, flap, hinge, sweep: hinge.rotation.y });
  }
  const legs = [];
  G.legs.forEach((L, pair) => [-1, 1].forEach((s) => {
    const hip = new THREE.Group();
    hip.position.set(s * 0.12, -0.2, L.z);
    hip.scale.x = s;
    add(hip, L.geo, M.wpBody);
    body.add(hip);
    legs.push({ s, pair, hip });
  }));
  let t = 0;
  const CURL = 2.25;   // how far the abdomen curls under to point its sting ahead (radians, past its rest angle)
  // its dive (attack-motion "lunge", src/attack-motion.js): rears, the abdomen curling under to point the sting at
  // you, pumping faster; the pumping stops and the wings sweep half back; it darts nose-down along its line, wings
  // held swept back, stretched, legs tucked, the sting ahead. A miss pulls up (a landed sting kills it): its nose
  // swings through level, it banks, and its wings start up again, fore then hind.
  const anim = (dt, e) => {
    t += dt;
    const ph0 = e?.phase || 0, speed = e?.vel ? Math.hypot(e.vel.x, e.vel.z) : 0, A = e?.atk, ph = A ? A.phase : 'idle', S = THREE.MathUtils.smoothstep;
    let rear = 0, curl = 0, pump = 6, still = 0, sweep = 0, foreAmp = 1, hindAmp = 1, tuck = 0, len = 1, roll = 0, bob = 1, pitch = 0.05, dive = 0;
    const down = e?.diveDir ? Math.asin(THREE.MathUtils.clamp(-e.diveDir.y, -1, 1)) : 0;   // its nose-down angle along the dive line
    if (ph === 'build') {
      const c = Math.min(1.1, coil(A.k, A.style.hold, A.style.over) * A.vary);
      rear = 0.52 * c; curl = c; pump = 6 + 20 * A.k;
      if (lockBeat(A)) rear -= 0.1;              // the lock: its nose dips at you
      still = A.still ? 1 : 0; sweep = still * 0.5;   // the last 0.1 s: the pumping stops, the wings sweep half back
      roll = (1 - still) * quiver(A.k, A.t, ph0) * 0.05 * A.quiet;
      bob = 1 - S(A.pt, 0, 0.1);
    } else if (ph === 'swing') {
      dive = S(A.pt, 0, 0.06);                   // tips over, not jumps, to nose-down
      rear = 0.52 * Math.min(1.1, A.vary) * (1 - dive); curl = Math.min(1.1, A.vary); pitch = 0.05 + (down - 0.05) * dive; sweep = 1; still = 1; tuck = 1;
      foreAmp = hindAmp = 0;                     // no flapping: a dart silhouette
      len = A.smear ? knobs().smear : 1 + (A.tier.stretch - 1) * dive;
      bob = 0;
    } else if (ph === 'recoil') {
      const u = settle(A.k, A.style.bounces, A.style.damp), p = A.pt;
      pitch = 0.05 + (down - 0.05) * u; curl = S(1 - p / 0.4, 0, 1); sweep = 1 - S(p, 0.05, 0.3); tuck = 1 - S(p, 0, 0.3);
      roll = A.side * 0.52 * Math.sin(Math.PI * Math.min(1, p / 0.6));   // banks past level
      foreAmp = S(p, 0.1, 0.25); hindAmp = S(p, 0.2, 0.35);              // the wings restart, fore then hind
      len = 1 + (A.tier.stretch - 1) * Math.max(0, u);
      bob = S(p, 0.3, 0.6);
    } else pitch += Math.min(1, speed * 4) * 0.15;
    for (const W of wings) {
      const amp = W.fore ? foreAmp : hindAmp;
      W.flap.rotation.z = W.s * (0.1 + Math.sin(t * 80 + (W.fore ? 0 : 0.5)) * 0.7 * amp);   // a blur of wings
      W.hinge.rotation.y = W.sweep + W.s * sweep * 0.45;
    }
    for (const L of legs) L.hip.rotation.x = 0.4 + L.pair * 0.15 + Math.sin(t * 3 + L.pair + ph0) * 0.06 * (1 - tuck) + tuck * 0.5;   // hanging, trailing back (tucked in a dive)
    tail.rotation.x = -0.35 - curl * CURL + Math.sin(t * pump + ph0) * 0.06 * (1 - still);   // the abdomen pumps, faster as it winds up
    body.position.y = Math.sin(t * 5 + ph0) * 0.08 * bob;
    body.rotation.set(pitch - rear, 0, roll);
    stretch(body, len);
    if (A) eyes(face, A);
  };
  anim.reset = () => {
    t = 0; stretch(body, 1); body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); tail.rotation.x = -0.35;
    for (const W of wings) { W.flap.rotation.z = 0; W.hinge.rotation.y = W.sweep; }
    for (const L of legs) L.hip.rotation.x = 0.4 + L.pair * 0.15;
    face.children.forEach((c) => { c.scale.y = 1; c.rotation.x = 0; });
  };
  return { body: outer, face: new THREE.Group(), anim };
}

// ------------------------------------------------------------------ moth
// A dusty house moth: a furry cream thorax and tapering abdomen, a small head with long feathered
// antennae, tucked legs, and two pairs of broad pale wings, powdery grey-brown toward their edges
// with a dark band and a dark eye-spot on each. Wings beat slowly (a moth, not a wasp); climbing over you it flares them wide and holds them quivering, plunging it sweeps them back. Facing +z,
// centred on its thorax; about 2.6 radii long, wings out about 3.4 across.
function mothParts() {
  const cream = '#e4d9bf', fur = '#cfc2a4', dust = '#8b7d63';
  const body = merge([
    ellipsoid(0.34, 0.3, 0.42, V(0, 0, 0.1), cream),                 // thorax
    ellipsoid(0.25, 0.23, 0.78, V(0, -0.04, -0.7), fur),             // abdomen
    ellipsoid(0.2, 0.18, 0.2, V(0, 0.02, 0.62), cream),              // head
    ...[-1, 1].map((s) => tube([V(s * 0.07, 0.14, 0.72), V(s * 0.22, 0.45, 1.0), V(s * 0.4, 0.62, 1.2)], 0.018, dust, 6)),   // antennae
    ...[-1, 1].flatMap((s) => [0.35, 0.05, -0.2].map((z) => rod(V(s * 0.12, -0.2, z), V(s * 0.2, -0.55, z - 0.18), 0.03, 0.012, dust))),   // legs
  ]);
  // a wing out along +x from its hinge, flat; front edge toward -y here, which rotateX turns to +z
  const wing = (w, d) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, -0.1); sh.bezierCurveTo(0.5, -0.75 * d, 1.3, -0.7 * d, w, -0.3 * d); sh.bezierCurveTo(w * 1.02, 0.2 * d, w * 0.8, 0.75 * d, 0.5, 0.7 * d); sh.bezierCurveTo(0.2, 0.55 * d, 0.05, 0.35 * d, 0, 0.2);
    const g = new THREE.ShapeGeometry(sh, 10).rotateX(-Math.PI / 2), pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / w, band = Math.abs(u - 0.62) < 0.07 ? 0.5 : 0;     // a dark band across
      c.set(cream).lerp(new THREE.Color(dust), Math.min(1, u * u * 0.85 + band));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  };
  const spot = merge([ellipsoid(0.16, 0.012, 0.16, V(0.95, 0.01, 0.0), '#3b3226'), ellipsoid(0.16, 0.012, 0.16, V(0.95, -0.01, 0.0), '#3b3226')]);
  return { body, fore: wing(1.7, 1), hind: wing(1.2, 0.9), spot };
}

export function buildMoth() {
  const G = (GEO.moth ||= mothParts()), M = mats();
  if (!M.moWing) {
    M.moWing = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.95 });
    standOut(M.moWing, { base: 0.3, rim: 0.55 });
  }
  const outer = new THREE.Group(), body = new THREE.Group();
  outer.add(body);
  body.add(new THREE.Mesh(G.body, M.matte));
  const face = angryEyes({ y: 0.1, z: 0.8, size: 0.08, gap: 0.12 });
  body.add(face);
  const wings = [];
  for (const [geo, z, hind] of [[G.fore, 0.3, false], [G.hind, -0.05, true]]) for (const s of [-1, 1]) {
    const hinge = new THREE.Group(), flap = new THREE.Group();
    hinge.position.set(s * 0.18, 0.22, z);
    hinge.add(flap);
    const m = new THREE.Mesh(geo, M.moWing);
    m.scale.x = s;
    flap.add(m);
    if (!hind) { const sp = new THREE.Mesh(G.spot, M.matte); sp.scale.x = s; flap.add(sp); }
    body.add(hinge);
    wings.push({ s, hind, hinge, flap });
  }
  let t = 0;
  // its plunge (attack-motion "pounce", src/attack-motion.js): climbing over you it rears back, wings flared wide
  // and quivering, until its spot locks: then they clap together above its back and stay. It tips nose-down
  // over 0.08 s and drops stretched, wings swept back; it hits the floor squashed with its wings slapped flat,
  // lifts them late and fans them twice, and crouches just before it takes off again. Missed, it lands rocking.
  const anim = (dt, e) => {
    t += dt;
    const ph0 = e?.phase || 0, A = e?.atk, ph = A ? A.phase : 'idle', S = THREE.MathUtils.smoothstep;
    const DOWN = Math.PI / 2 + 0.2, REAR = 0.1 - 0.55;
    let wind = 0, clap = 0, sweep = 0, nose = 0.1, len = 1, squash = 0, slap = 0, fan = 0, crouch = 0, bob = 1, roll = 0;
    if (ph === 'build') {
      wind = coil(A.k, A.style.hold, A.style.over) * A.vary;
      if (A.lockT >= 0) clap = Math.min(1, A.lockT / knobs().beat);
      nose = 0.1 - wind * 0.55 + quiver(A.k, A.t, ph0) * 0.05 * A.quiet * (1 - clap);
      bob = 1 - S(A.t, 0, 0.15);
    } else if (ph === 'swing') {
      const tip = S(A.pt, 0, 0.08);              // tips over, not jumps, to nose-down
      nose = REAR + (DOWN - REAR) * tip; sweep = tip; clap = 1 - tip; bob = 0;
      len = A.smear ? knobs().smear : 1 + (A.tier.stretch - 1) * tip;
    } else if (ph === 'recoil') {
      const p = A.pt;
      nose = DOWN + (0.1 - DOWN) * S(p, 0, 0.08);                            // down flat on the floor
      squash = (A.hit ? 0.25 : 0.15) * settle(Math.min(1, p / 0.4), A.style.bounces, A.style.damp);
      slap = 1 - S(p, 0.6, 0.8);                                             // wings flat, then back to the flutter
      fan = p > 0.2 && p < 0.6 ? Math.abs(Math.sin((p - 0.2) * Math.PI * 5)) : 0;   // lifted 0.2 s late, fanned twice
      if (!A.hit) roll = A.side * 0.3 * settle(Math.min(1, p / 0.5), 2, 1);
      bob = S(p, 0.4, 0.8);
      if (e.state === 'rest' && e.stateT < 0.15) crouch = 1 - Math.max(0, e.stateT) / 0.15;   // gathers itself to lift off
    }
    for (const W of wings) {
      const beat = Math.sin(t * (22 + wind * 14) + ph0 + (W.hind ? 0.6 : 0));
      // fluttering: wings up and down; rearing: held wide and high, quivering; clapped: still over its back;
      // swooping: swept back; landed: flat on the floor
      let z = 0.2 + beat * (0.55 - 0.45 * Math.min(1, wind)) + wind * 0.75 + sweep * 0.9;
      z += (1.5 - z) * clap;
      z += (-0.1 + fan * 0.7 - z) * slap;
      W.flap.rotation.z = W.s * z;
      W.hinge.rotation.y = W.s * (-0.15 - sweep * 0.7 + wind * 0.3 * (1 - clap));
    }
    body.position.y = Math.sin(t * 4 + ph0) * 0.1 * bob - squash * 0.1 - crouch * 0.08;
    body.rotation.set(nose + crouch * 0.15, 0, roll);
    if (squash) { const y = 1 - squash, w = 1 / Math.sqrt(y); body.scale.set(w, y, w); } else stretch(body, len);
    if (A) eyes(face, A);
  };
  anim.reset = () => { t = 0; stretch(body, 1); body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); face.children.forEach((c) => { c.scale.y = 1; c.rotation.x = 0; }); };
  return { body: outer, face: new THREE.Group(), anim };
}

// ------------------------------------------------------------------ firefly
// A firefly beetle, soft dark wing covers over a flat orange-red shield behind a tucked head, long
// beaded antennae, six thin legs and a pair of pale gauzy wings. Its last two body segments are the
// lantern: a glowing mesh (not a light) that blinks on every beat of the song in the hostile colour
// (--hostile-firefly) and stays lit while it draws back to dart. Facing +z, centred on its thorax;
// about 2.6 radii long.
function fireflyParts() {
  const dark = '#2a1a12', cover = '#3a2616', shield = '#d8431a', band = '#1a0e08', ink = '#120a06';
  const body = merge([
    ellipsoid(0.4, 0.22, 0.95, V(0, 0.05, -0.35), cover),               // wing covers
    ellipsoid(0.03, 0.04, 0.8, V(0, 0.27, -0.35), band, 8),             // the seam down them
    ellipsoid(0.42, 0.16, 0.34, V(0, 0.1, 0.55), shield),               // the flat shield behind the head
    ellipsoid(0.06, 0.04, 0.26, V(0, 0.26, 0.55), band, 8),             // its dark stripe
    ellipsoid(0.18, 0.15, 0.18, V(0, 0.02, 0.9), dark),                 // head, tucked under the shield
    ...[-1, 1].map((s) => tube([V(s * 0.08, 0.08, 1.0), V(s * 0.2, 0.3, 1.3), V(s * 0.36, 0.38, 1.6)], 0.022, ink, 6)),   // antennae
    ...[-1, 1].flatMap((s) => [0.6, 0.15, -0.3].map((z) => rod(V(s * 0.25, -0.05, z), V(s * 0.55, -0.4, z + (z > 0.3 ? 0.15 : z < 0 ? -0.2 : 0)), 0.045, 0.02, ink))),   // legs
  ]);
  const wing = new THREE.ShapeGeometry(new THREE.Shape().moveTo(0, 0).bezierCurveTo(0.4, 0.22, 1.2, 0.2, 1.5, 0).bezierCurveTo(1.2, -0.14, 0.4, -0.12, 0, 0), 10).rotateX(-Math.PI / 2).rotateY(Math.PI * 0.55);
  return { body, wing, lamp: ellipsoid(0.34, 0.19, 0.42, V(0, 0.02, -1.22), '#ffffff') };
}

export function buildFirefly() {
  const G = (GEO.firefly ||= fireflyParts()), M = mats();
  if (!M.ffLamp) {   // one shared glow, tinted per bug (batch.js perInstance); unlit, so bloom lifts it
    M.ffLamp = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    M.ffLamp.userData.perInstance = true;
  }
  const outer = new THREE.Group(), body = new THREE.Group();
  outer.add(body);
  body.add(new THREE.Mesh(G.body, M.matte));
  const lamp = new THREE.Mesh(G.lamp, M.ffLamp);
  lamp.userData.color = new THREE.Color();
  body.add(lamp);
  const wings = [-1, 1].map((s) => {
    const pivot = new THREE.Group(), w = new THREE.Mesh(G.wing, M.wing);
    pivot.position.set(s * 0.2, 0.26, 0.2);
    w.scale.x = -s;
    pivot.add(w);
    body.add(pivot);
    return { pivot, s };
  });
  const face = angryEyes({ y: 0.1, z: 0.98, size: 0.07, gap: 0.1 });
  body.add(face);
  const dim = new THREE.Color(LOOK.color('firefly-dim', '#3a2208')), hot = new THREE.Color();
  let t = 0, wind = 0, held = 0;
  // its lob (attack-motion "throw", src/attack-motion.js): its tail lifts (nose down) with a quiver, dips a
  // little more in the last 0.1 s as it winds back, then the tail flicks up and over, stretched along the throw;
  // it tumbles nose up and corrects. The lamp is the word's own: lit and swelling as it aims, squeezed as it throws
  const anim = (dt, e) => {
    t += dt;
    wind += (((e?.state === 'windup') ? 1 : 0) - wind) * (1 - Math.exp(-14 * dt));
    const kick = Math.max(0, e?.firedT || 0) / 0.3;     // the lob word: 0.3 s after the throw
    // the lamp: a flash on every beat, held lit while it lifts its tail and throws
    const k = Math.max(e?.beatPulse || 0, wind, kick);
    hot.copy(hostile('firefly')).multiplyScalar(LOOK.num('firefly-glow', 1.8));
    lamp.userData.color.copy(dim).lerp(hot, k * k);
    const flap = Math.sin(t * (50 + wind * 20));
    for (const W of wings) { W.pivot.rotation.z = W.s * (0.3 + flap * 0.55); W.pivot.rotation.y = W.s * (0.25 + 0.15 * Math.cos(t * 50)); }
    const A = e?.atk, ph = A ? A.phase : 'idle';
    let lift = wind, jolt = kick * kick, tumble = kick * 0.54, len = 1, shake = 0;   // (without an attack clock: the word's own blends)
    if (A) {
      lift = jolt = tumble = 0;
      if (ph === 'build') {
        lift = coil(A.k, A.style.hold, A.style.over) * A.vary + 0.17 * THREE.MathUtils.smoothstep(A.k, 0.78, 0.92);   // (10 degrees more, winding back)
        shake = A.still ? 0 : quiver(A.k, A.t, e.phase) * A.quiet;
      } else if (ph === 'swing') {
        const s = snap(Math.min(1, A.pt / A.style.strike), A.tier.over);
        lift = (A.vary + 0.17) * Math.max(0, 1 - s); jolt = s; tumble = s;
        len = A.smear ? knobs().smear : 1 + (A.tier.stretch - 1) * Math.min(1, s);
      } else if (ph === 'recoil') jolt = tumble = (1 + A.tier.over) * settle(A.k, A.style.bounces, A.style.damp);
      if (ph === 'idle') lift = held *= Math.exp(-14 * dt);   // broken off (frozen, stunned): the tail comes down, not pops
      else held = lift;
    }
    body.position.set(shake * 0.03, Math.sin(t * 3 + (e?.phase || 0)) * 0.1 * (1 - Math.max(wind, A?.still ? 1 : 0)), jolt * 0.3);   // the throw jolts it forward, off its tail
    body.rotation.x = 0.05 + lift * 0.55 - tumble * 0.65;        // lifting its tail (nose down) to throw; the throw flicks it up and over
    body.rotation.z = shake * 0.06;
    stretch(body, len);
    lamp.scale.setScalar(1 + wind * 0.25 - kick * 0.15);  // the lamp swells as it aims, and squeezes as the glow leaves it
    if (A) eyes(face, A);
  };
  anim.reset = () => { t = 0; wind = 0; held = 0; stretch(body, 1); body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); face.children.forEach((c) => { c.scale.y = 1; c.rotation.x = 0; }); };   // (a pooled model killed mid-throw)
  return { body: outer, face: new THREE.Group(), anim };
}

// ------------------------------------------------------------------ wasp nest
// A paper wasp nest, after the photo: a grey teardrop of chewed-wood paper, hung from its broad
// flat top, built of overlapping shell layers whose lips run in wavy bands round it, streaked in
// a dozen greys, narrowing to a rounded bottom with the entrance: a lipped hole going up inside.
// In the wasp's radius units (scale both by the same r): it's NEST.height tall, four times the
// wasp's length, NEST.width across at its widest, and its origin is its middle (its top, where it
// hangs, is NEST.height / 2 above). Wasps come out of the entrance at the bottom (e.emergeAt).
export const NEST = { height: 12, width: 5.3 };
function nestParts() {
  const R = seeded(97), H = NEST.height, W = NEST.width;
  // the paper: fine streaks running round it (u around, v down), in many greys
  const paper = wingTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = '#9a9a96'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 2600; k++) {
      const y = R() * h, x = R() * w, l = 30 + R() * 160, v = 100 + R() * 90 | 0;
      g.strokeStyle = `rgba(${v},${v},${v - 4},${0.25 + R() * 0.4})`; g.lineWidth = 1 + R() * 2.5;
      g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + l * 0.3, y + (R() - 0.5) * 6, x + l * 0.6, y + (R() - 0.5) * 6, x + l, y + (R() - 0.5) * 4); g.stroke();
    }
    for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(60,58,54,${R() * 0.25})`; g.fillRect(R() * w, R() * h, 1 + R() * 3, 1); }
  });
  // the outline, top (hanging) to bottom: broad and flat at the top, widest a third of the way down,
  // tapering to the entrance, its lip, then up inside it
  const out = [[0.02, 0], [W * 0.7, 0], [W * 0.88, -H * 0.06], [W * 0.98, -H * 0.2], [W, -H * 0.35], [W * 0.93, -H * 0.55], [W * 0.75, -H * 0.73], [W * 0.5, -H * 0.86], [W * 0.27, -H * 0.95], [W * 0.17, -H * 0.985]];
  const curve = new THREE.CatmullRomCurve3(out.map(([r, y]) => V(r, y, 0)));
  const pts = curve.getPoints(150).map((p) => new THREE.Vector2(p.x, p.y));
  // the entrance: a rounded lip, then a dark tube up inside
  for (const [r, y] of [[W * 0.15, -H * 0.995], [W * 0.12, -H * 0.998], [W * 0.1, -H * 0.99], [W * 0.09, -H * 0.96], [W * 0.085, -H * 0.9], [W * 0.05, -H * 0.86], [0.01, -H * 0.85]]) pts.push(new THREE.Vector2(r, y));
  const seg = 96, geo = new THREE.LatheGeometry(pts, seg);
  const p = geo.attributes.position, n = p.count, col = new Float32Array(n * 3), uv = geo.attributes.uv;
  const inside = pts.length - 6;                                        // points from here on are the entrance's inside
  const band = H * 0.085;
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), th = Math.atan2(z, x), j = i % pts.length;
    let shade = 0.95;
    if (j > 4 && j < inside - 2) {
      // the shell layers: wavy bands; each layer bulges out toward its lower lip, the next starts tucked in under it
      const f = -y / band + 0.5 * Math.sin(th * 1 + 1.3) + 0.25 * Math.sin(th * 3 - y * 0.4) + 0.12 * Math.sin(th * 7 + y);
      const t = f - Math.floor(f), lip = Math.pow(t, 1.6);
      const k = 1 + 0.055 * lip - 0.03 + (R() - 0.5) * 0.004;
      p.setXYZ(i, x * k, y, z * k);
      shade = (0.66 + 0.36 * lip + 0.07 * Math.sin(Math.floor(f) * 2.7)) * (t < 0.07 ? 0.5 : 1);   // a dark groove just under each lip
    }
    if (j >= inside) shade = 0.18 * Math.max(0, 1 - (j - inside) / 5) + 0.04;   // the dark entrance
    const grey = shade * (0.94 + R() * 0.08);
    col[i * 3] = grey; col[i * 3 + 1] = grey; col[i * 3 + 2] = grey * 0.97;
    uv.setXY(i, uv.getX(i) * 3, -y / H * 2.2);                            // the streaks run round it, repeated
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return { paper, geo };
}

export function buildNest() {
  const G = (GEO.nest ||= nestParts()), M = mats();
  if (!M.nest) {
    G.paper.wrapS = G.paper.wrapT = THREE.RepeatWrapping;
    M.nest = new THREE.MeshStandardMaterial({ map: G.paper, vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
    standOut(M.nest, { base: 0.2, rim: 0.35 });
  }
  const outer = new THREE.Group(), body = new THREE.Group();
  outer.add(body);
  const mesh = new THREE.Mesh(G.geo, M.nest);
  mesh.position.y = NEST.height / 2;                                     // its middle at the origin
  body.add(mesh);
  const UPV = V(0, 1, 0), door = V(0, -NEST.height / 2, 0);
  let t = 0, shake = 0;
  // 0.3 s before each wasp crawls out (the brood word's timer, only if one will) it squeezes across and bulges down
  // at its entrance, hung from its top, then relaxes as the wasp comes out
  const anim = (dt, e) => {
    t += dt;
    if (e.hatchedT > 0) { shake = 1; e.hatchedT = 0; }                   // a wasp just crawled out: it trembles
    shake *= Math.exp(-6 * dt);
    const N = knobs().nest, q = e.broodT > 0 && e.broodT < N.lead && !e.broodFull ? 1 - e.broodT / N.lead : 0, w = 1 - N.squeeze * q;
    body.scale.set(w, 1 + N.bulge * q, w);
    body.position.y = -N.bulge * q * NEST.height / 2;
    body.rotation.z = Math.sin(t * 30) * 0.03 * shake;
    // where wasps come out, in the world: the brood word reads it
    (e.emergeAt ||= new THREE.Vector3()).copy(door).applyAxisAngle(UPV, e.root.rotation.y).multiplyScalar(e.r).add(e.pos);
  };
  anim.reset = () => { t = 0; shake = 0; body.scale.set(1, 1, 1); body.position.y = 0; };
  return { body: outer, face: new THREE.Group(), anim };
}
