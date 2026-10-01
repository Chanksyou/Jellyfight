// The bugs: cockroaches, ant squads and mosquitoes. Procedural models with moving legs and
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
  standOut(MAT.shell, { base: 0.35, rim: 0.8 });     // brighter bugs: readable in the dark room
  standOut(MAT.matte, { base: 0.35, rim: 0.8 });
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
