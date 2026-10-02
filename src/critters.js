// The bugs: cockroaches, ant squads, mosquitoes and the standing stapler. Procedural models with moving legs and
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
  shell.castShadow = true;
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
  const anim = (dt, e) => {
    const speed = Math.hypot(e.vel.x, e.vel.z);
    k += (Math.min(1, speed * 6) - k) * (1 - Math.exp(-8 * dt));   // smoothed, so it never flickers
    t += dt * (3 + 14 * k);                                           // legs cycle ~2.5 steps/s at full run
    for (const L of legs) {
      L.pivot.rotation.y = L.base + Math.sin(t + L.phase) * 0.4 * k;
      L.pivot.rotation.z = Math.max(0, Math.cos(t + L.phase)) * 0.25 * k * Math.sign(L.pivot.position.x);
    }
    body.position.y = Math.abs(Math.sin(t)) * 0.02 * k;              // radius units: a tiny lift per step
    body.rotation.z = Math.sin(t) * 0.03 * k;                         // and a small waddle
  };
  return { body: outer, face: new THREE.Group(), anim };
}

// ------------------------------------------------------------------ ant squad
function antGeometry() {
  const black = '#1c0a06', red = '#5a1a0c', white = '#ffffff', shine = '#3a1a10';
  const body = merge([
    ellipsoid(0.16, 0.13, 0.2, V(0, 0.2, 0.28), black),      // head
    ellipsoid(0.07, 0.04, 0.05, V(-0.08, 0.14, 0.44), red),  // mandibles
    ellipsoid(0.07, 0.04, 0.05, V(0.08, 0.14, 0.44), red),
    ellipsoid(0.1, 0.09, 0.16, V(0, 0.19, 0.02), red),       // thorax
    ellipsoid(0.05, 0.05, 0.05, V(0, 0.18, -0.13), black),   // petiole
    ellipsoid(0.17, 0.15, 0.22, V(0, 0.22, -0.33), black),   // gaster
    ellipsoid(0.08, 0.04, 0.1, V(0, 0.33, -0.3), shine),     // glossy highlight band
    ellipsoid(0.05, 0.05, 0.03, V(-0.07, 0.25, 0.46), white, 8),   // angry little eyes
    ellipsoid(0.05, 0.05, 0.03, V(0.07, 0.25, 0.46), white, 8),
    ellipsoid(0.025, 0.025, 0.02, V(-0.065, 0.24, 0.485), '#c8231c', 6),
    ellipsoid(0.025, 0.025, 0.02, V(0.065, 0.24, 0.485), '#c8231c', 6),
    tint(new THREE.BoxGeometry(0.1, 0.02, 0.02).rotateZ(-0.45).translate(-0.07, 0.3, 0.47), black),
    tint(new THREE.BoxGeometry(0.1, 0.02, 0.02).rotateZ(0.45).translate(0.07, 0.3, 0.47), black),
  ]);
  // antennae, built at their base on the head
  const antenna = (s) => merge([rod(V(0, 0, 0), V(s * 0.12, 0.14, 0.12), 0.015, 0.01, black), rod(V(s * 0.12, 0.14, 0.12), V(s * 0.16, 0.08, 0.28), 0.01, 0.006, black)]);
  // one leg built at its hip
  const leg = (s, z) => merge([rod(V(0, 0, 0), V(s * 0.14, 0.08, z * 1.5), 0.02, 0.015, black), rod(V(s * 0.14, 0.08, z * 1.5), V(s * 0.24, -0.18, z * 3), 0.015, 0.008, black)]);
  return { body, antL: antenna(-1), antR: antenna(1), leg };
}

// five ants: marching in a tight 2-1-2 block, or curled up together into a ball made of
// their own bodies (backs out, heads and legs tucked in; no shell, just ants)
const FORMATION = [[-0.3, 0.38], [0.3, 0.38], [0, -0.02], [-0.3, -0.42], [0.3, -0.42]];
// a trigonal bipyramid: five ants cover a ball evenly
const BALL = [V(0, 1, 0), V(0, -1, 0), V(1, 0, 0), V(-0.5, 0, 0.866), V(-0.5, 0, -0.866)];
export function buildAnts() {
  const G = (GEO.ants ||= antGeometry()), M = mats();
  const LEGS = (GEO.antLegs ||= [-1, 1].flatMap((s) => [0.08, 0, -0.08].map((z) => ({ s, z, geo: G.leg(s, z) }))));
  const body = new THREE.Group();
  const ball = new THREE.Group();          // rolls as one while curled
  ball.position.y = 0.42;
  body.add(ball);
  const q0 = new THREE.Quaternion();
  const ants = FORMATION.map(([x, z], i) => {
    const a = new THREE.Group();
    const shell = new THREE.Mesh(G.body, M.shell);
    shell.castShadow = true;
    a.add(shell);
    const legs = LEGS.map((L, j) => {
      const pivot = new THREE.Group();
      pivot.position.set(L.s * 0.06, 0.18, L.z);
      pivot.add(new THREE.Mesh(L.geo, M.shell));
      a.add(pivot);
      return { pivot, phase: (j % 2) ^ (L.s > 0 ? 1 : 0) ? Math.PI : 0 };   // tripod gait
    });
    const ants2 = [G.antL, G.antR].map((geo, j) => {
      const p = new THREE.Group();
      p.position.set(j ? 0.08 : -0.08, 0.28, 0.4);
      p.add(new THREE.Mesh(geo, M.shell));
      a.add(p);
      return p;
    });
    ball.add(a);
    // curled: back out along its ball direction, each twisted a different way so the bodies
    // interlock into a round clump
    const dir = BALL[i];
    const curlQ = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), i * 1.26 + 0.4));
    return { a, legs, ants: ants2, phase: i * 1.7, walkPos: V(x, -0.42, z), curlPos: dir.clone().multiplyScalar(0.12).add(V(0, -0.2, 0)), curlQ };
  });
  let t = 0, curl = 0, k = 0;
  const anim = (dt, e) => {
    const want = e.state === 'windup' || e.state === 'dash' ? 1 : 0;
    curl += (want - curl) * (1 - Math.exp(-(want ? 12 : 5) * dt));
    const speed = Math.hypot(e.vel.x, e.vel.z);
    k += (Math.min(1, speed * 7) - k) * (1 - Math.exp(-8 * dt));
    t += dt * (3 + 16 * k);
    const walk = 1 - curl;
    for (const A of ants) {
      A.a.position.lerpVectors(A.walkPos, A.curlPos, curl);
      A.a.quaternion.slerpQuaternions(q0, A.curlQ, curl);
      A.a.scale.setScalar(1 + curl * 0.1);
      // marching: a little bob and sway each, legs in a tripod gait, antennae feeling around
      A.a.position.y += walk * Math.abs(Math.sin(t + A.phase)) * 0.025 * k;
      A.a.rotation.z += walk * Math.sin(t * 0.5 + A.phase) * 0.06;
      for (const L of A.legs) {
        L.pivot.rotation.y = walk * Math.sin(t + A.phase + L.phase) * 0.45 * k;
        L.pivot.rotation.x = walk * Math.max(0, Math.cos(t + A.phase + L.phase)) * -0.3 * k;
        L.pivot.scale.setScalar(1 - curl * 0.7);        // legs tuck in when curled
      }
      A.ants.forEach((p, j) => { p.rotation.x = Math.sin(t * 0.7 + A.phase + j) * 0.4; p.rotation.y = Math.sin(t * 0.9 + A.phase * 2 + j * 2) * 0.35; p.scale.setScalar(1 - curl * 0.8); });
    }
    if (e.state === 'dash') ball.rotation.x += speed * dt / 0.42;
    else ball.rotation.x *= Math.exp(-6 * dt);
    ball.rotation.z = e.state === 'windup' ? Math.sin(t * 5) * 0.12 : 0;   // a quick shiver: it's about to roll
    ball.position.y = 0.42 - curl * 0.06;
  };
  return { body, face: new THREE.Group(), anim };
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
  const legs = [];
  for (const s of [-1, 1]) for (const z of [0.25, 0.1, -0.05]) {
    const knee = V(s * 0.55, 0.2, z + 0.15), foot = V(s * 0.8, -1.0, z + 0.3 - (0.25 - z) * 1.8);
    legs.push(rod(V(s * 0.12, -0.05, z), knee, 0.03, 0.022, black));
    // white bands down the long shins
    for (let b = 0; b < 4; b++) legs.push(rod(knee.clone().lerp(foot, b / 4), knee.clone().lerp(foot, (b + 1) / 4), 0.02 - b * 0.003, 0.017 - b * 0.003, b % 2 ? white : black));
  }
  const shape = new THREE.Shape().moveTo(0, 0).bezierCurveTo(0.3, 0.2, 1.1, 0.2, 1.3, 0).bezierCurveTo(1.1, -0.14, 0.3, -0.14, 0, 0);
  const wing = new THREE.ShapeGeometry(shape, 12);
  wing.rotateX(-Math.PI / 2).rotateY(Math.PI * 0.62);
  // wing veins: a few dark lines along the wing
  const veins = new THREE.BufferGeometry().setFromPoints([0.05, -0.03, 0.03].flatMap((o, i) => [V(0, 0, 0), V(1.15, 0, o * (i + 1))]).map((p) => p.applyAxisAngle(V(0, 1, 0), Math.PI * 0.62)));
  return { body: merge(parts), legs: merge(legs), wing, veins };
}

export function buildMosquito() {
  const G = (GEO.mosquito ||= mosquitoGeometry()), M = mats();
  M.wing.opacity = 0.55;
  M.wing.color.setHex(0xcfe0ee);
  M.vein ||= new THREE.LineBasicMaterial({ color: 0x3a3a48, transparent: true, opacity: 0.7 });
  const outer = new THREE.Group(), body = new THREE.Group();
  outer.add(body);
  const shell = new THREE.Mesh(G.body, M.shell);
  shell.castShadow = true;
  const legs = new THREE.Mesh(G.legs, M.matte);
  body.add(shell, legs);
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
  let t = 0;
  const anim = (dt, e) => {
    t += dt;
    for (const W of wings) W.pivot.rotation.z = W.s * (0.25 + Math.sin(t * 60) * 0.5);   // a blur of wings
    legs.rotation.x = Math.sin(t * 2.3) * 0.08;
    body.position.y = Math.sin(t * 4 + e.phase) * 0.1;                  // radius units: a gentle hover bob
    body.rotation.x = -0.15 + (e.aimT > 0 ? -0.35 : 0);                 // dips its nose to shoot
  };
  return { body: outer, face: new THREE.Group(), anim };
}

// ------------------------------------------------------------------ standing stapler
// An office stapler opened all the way out and stood on its hinge: the black base rises at the
// back, the red top arm rises in front with the chrome head at its tip, the eyes just under it.
// It hops toward you; to shoot it rocks its arm forward like an open mouth, then snaps it shut
// as the staples fly. About 3 radii (12 cm) tall.
function staplerGeometry() {
  const black = '#3a3a44', red = '#d0242e', redDark = '#7a1218', chrome = '#c8ccd4', steel = '#8a909a';
  const box = (w, h, d, x, y, z, hex, bevel = 0) => tint(new THREE.BoxGeometry(w, h, d, 1, 1, 1).translate(x, y, z), hex);
  // the hinge: a chunky barrel at the bottom, its feet
  const hinge = [
    tint(new THREE.CylinderGeometry(0.2, 0.2, 0.86, 14).rotateZ(Math.PI / 2).translate(0, 0.22, 0), steel),
    box(0.9, 0.12, 0.7, 0, 0.06, 0, black),                                  // a little rubber foot
  ];
  // the base, standing at the back: black plastic with the steel anvil plate on its front
  const base = [
    box(0.78, 2.2, 0.2, 0, 1.1, 0, black),
    box(0.3, 0.5, 0.04, 0, 1.9, 0.12, chrome),                                // the anvil, where staples fold
    box(0.8, 0.1, 0.24, 0, 2.2, 0, black),
  ];
  // the top arm, standing in front: red cover over a steel magazine, the chrome head at the top
  const arm = [
    box(0.74, 2.3, 0.3, 0, 1.15, 0, red),
    box(0.62, 2.1, 0.08, 0, 1.1, -0.18, steel),                               // the magazine rail
    box(0.76, 0.06, 0.32, 0, 0.5, 0, redDark),                                // a seam in the cover
    box(0.8, 0.42, 0.42, 0, 2.38, 0.02, chrome),                              // the head
    box(0.5, 0.06, 0.08, 0, 2.2, 0.24, '#1a1a1e'),                            // the slot the staples come out of
  ];
  return { hinge: merge(hinge), base: merge(base), arm: merge(arm) };
}

export function buildStapler() {
  const G = (GEO.stapler ||= staplerGeometry()), M = mats();
  const outer = new THREE.Group(), body = new THREE.Group();
  outer.add(body);
  const hinge = new THREE.Mesh(G.hinge, M.shell);
  // base and arm swing about the hinge barrel
  const basePivot = new THREE.Group(), armPivot = new THREE.Group();
  basePivot.position.set(0, 0.22, -0.18);
  armPivot.position.set(0, 0.22, 0.2);
  const base = new THREE.Mesh(G.base, M.shell), arm = new THREE.Mesh(G.arm, M.shell);
  base.position.y = -0.1; arm.position.y = -0.1;
  basePivot.add(base); armPivot.add(arm);
  for (const m of [hinge, base, arm]) m.castShadow = true;
  body.add(hinge, basePivot, armPivot);
  // angry eyes on the front of the arm, just under the head
  const face = angryEyes({ y: 1.85, z: 0.18, size: 0.26, gap: 0.2 });
  armPivot.add(face);
  let t = 0, hop = 0, open = 0, snap = 0;
  const anim = (dt, e) => {
    t += dt;
    const speed = Math.hypot(e.vel.x, e.vel.z);
    hop += (Math.min(1, speed * 8) - hop) * (1 - Math.exp(-6 * dt));
    // hopping: up off the floor and a squash on landing, about 2.5 hops a second
    const ph = (t * 2.5 + e.phase) % 1, air = Math.sin(ph * Math.PI);
    body.position.y = air * 0.35 * hop;
    body.scale.y = 1 - (1 - air) * 0.12 * hop;
    // aiming: the arm rocks forward like an opening jaw; firing snaps it back past upright
    open += ((e.aimT > 0 ? 1 : 0) - open) * (1 - Math.exp(-10 * dt));
    snap = e.firedT > 0 ? 1 : snap * Math.exp(-8 * dt);
    armPivot.rotation.x = 0.22 + open * 0.5 - snap * 0.4;      // splayed open: a clear V from the side
    basePivot.rotation.x = -0.45 - open * 0.15;
    body.rotation.z = Math.sin(t * 5 + e.phase) * 0.04 * hop;                 // a little wobble as it hops
  };
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
  shell.castShadow = true;
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
    m.castShadow = true;
    m.scale.x = s;
    pivot.add(m);
    body.add(pivot);
    return { pivot, s };
  };
  const hindW = [-1, 1].map((s) => wing(G.hindGeo, M.lfHind, s, 0.6));
  const foreW = [-1, 1].map((s) => wing(G.foreGeo, M.lfFore, s, 0.66));
  const face = angryEyes({ y: 0.48, z: 0.96, size: 0.13, gap: 0.12 });
  body.add(face);

  let t = 0, k = 0, crouch = 0, open = 0, squash = 0;
  const anim = (dt, e) => {
    t += dt;
    const speed = Math.hypot(e.vel.x, e.vel.z);
    k += (Math.min(1, speed * 7) - k) * (1 - Math.exp(-8 * dt));
    const air = e.state === 'leap';
    crouch += ((e.state === 'crouch' ? 1 : 0) - crouch) * (1 - Math.exp(-12 * dt));
    open += ((air ? 1 : 0) - open) * (1 - Math.exp(-(air ? 18 : 6) * dt));
    if (e.landT > 0) { squash = 1; e.landT = 0; }
    squash *= Math.exp(-7 * dt);
    const walk = (1 - crouch) * (1 - open);
    const step = t * (4 + 14 * k);
    for (const L of legs) {
      const sw = Math.sin(step + L.phase) * 0.35 * k * walk;
      L.pivot.rotation.y = sw * -L.s;
      L.pivot.rotation.z = Math.max(0, Math.cos(step + L.phase)) * 0.25 * k * walk * L.s;
      // crouching folds the jumping legs; in the air every leg trails back
      L.pivot.rotation.x = (L.i === 2 ? -0.5 : -0.15) * crouch + (L.i === 2 ? 0.9 : 0.5) * open;
    }
    // the body: a crawl's sway, a crouch down and back, nose up in the air, a squash on landing
    body.position.y = Math.abs(Math.sin(step)) * 0.02 * k * walk - crouch * 0.14 - squash * 0.1;
    body.rotation.x = -crouch * 0.18 + open * (e.leapK < 0.5 ? -0.35 : 0.25);
    body.rotation.z = Math.sin(step * 0.5) * 0.03 * k * walk;
    body.scale.set(1 + squash * 0.12, 1 - squash * 0.2, 1 + squash * 0.06);
    // wings: a roof at rest, lifted a little in the crouch, flared and beating mid-leap to flash the red
    const flap = open * Math.sin(t * 38) * 0.35;
    // (roll: negative drapes a wing down over the side, positive lifts it up and out)
    for (const W of foreW) { W.pivot.rotation.z = W.s * (-0.62 + crouch * 0.2 + open * 1.5 + flap); W.pivot.rotation.y = W.s * (0.04 + open * 0.5); }
    for (const W of hindW) { W.pivot.rotation.z = W.s * (-0.72 + crouch * 0.15 + open * 1.45 - flap); W.pivot.rotation.y = W.s * (0.02 + open * 0.9); }
  };
  return { body: outer, face: new THREE.Group(), anim };
}
