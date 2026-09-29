// The bugs: cockroaches, ant squads and mosquitoes. Procedural models with moving legs and
// wings, so you can see them scuttle, curl up and fly at you.
//
// Each builder returns { body, face, anim(dt, e) } in "radius units" (the enemy's collision
// radius is 1), facing +z; Enemies.spawn scales them to size. Geometry is built once per type
// and shared, and parts of the same material are merged, to keep draw calls down on phones.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { angryEyes } from './enemies.js';

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
  const body = new THREE.Group();
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
  const face = angryEyes({ y: 0.42, z: 0.98, size: 0.2, gap: 0.2 });
  let t = 0;
  const anim = (dt, e) => {
    const speed = Math.hypot(e.vel.x, e.vel.z);
    t += dt * (4 + speed * 120);
    const k = Math.min(1, speed * 12);
    for (const L of legs) {
      L.pivot.rotation.y = L.base + Math.sin(t + L.phase) * 0.45 * k;
      L.pivot.rotation.z = Math.max(0, Math.cos(t + L.phase)) * 0.35 * k * Math.sign(L.pivot.position.x);
    }
    body.position.y = Math.abs(Math.sin(t * 2)) * 0.03 * k;
    shell.rotation.z = Math.sin(t) * 0.04 * k;          // a little waddle
  };
  return { body, face, anim };
}

// ------------------------------------------------------------------ ant squad
function antGeometry() {
  const black = '#1c0a06', red = '#5a1a0c', white = '#ffffff';
  const body = merge([
    ellipsoid(0.16, 0.13, 0.2, V(0, 0.2, 0.28), black),      // head
    ellipsoid(0.1, 0.09, 0.16, V(0, 0.19, 0.02), red),       // thorax
    ellipsoid(0.05, 0.05, 0.05, V(0, 0.18, -0.13), black),   // petiole
    ellipsoid(0.17, 0.15, 0.22, V(0, 0.22, -0.33), black),   // gaster
    rod(V(-0.08, 0.28, 0.4), V(-0.2, 0.42, 0.52), 0.015, 0.01, black),   // antennae
    rod(V(-0.2, 0.42, 0.52), V(-0.24, 0.36, 0.68), 0.01, 0.006, black),
    rod(V(0.08, 0.28, 0.4), V(0.2, 0.42, 0.52), 0.015, 0.01, black),
    rod(V(0.2, 0.42, 0.52), V(0.24, 0.36, 0.68), 0.01, 0.006, black),
    ellipsoid(0.05, 0.05, 0.03, V(-0.07, 0.25, 0.46), white, 8),   // angry little eyes
    ellipsoid(0.05, 0.05, 0.03, V(0.07, 0.25, 0.46), white, 8),
    ellipsoid(0.025, 0.025, 0.02, V(-0.065, 0.24, 0.485), '#c8231c', 6),
    ellipsoid(0.025, 0.025, 0.02, V(0.065, 0.24, 0.485), '#c8231c', 6),
    tint(new THREE.BoxGeometry(0.1, 0.02, 0.02).rotateZ(-0.45).translate(-0.07, 0.3, 0.47), black),
    tint(new THREE.BoxGeometry(0.1, 0.02, 0.02).rotateZ(0.45).translate(0.07, 0.3, 0.47), black),
  ]);
  const legs = [];
  for (const s of [-1, 1]) for (const z of [0.1, 0.02, -0.06]) legs.push(rod(V(s * 0.06, 0.18, z), V(s * 0.2, 0.26, z + (z - 0.02) * 1.5), 0.02, 0.015, black), rod(V(s * 0.2, 0.26, z + (z - 0.02) * 1.5), V(s * 0.3, 0.0, z + (z - 0.02) * 3), 0.015, 0.008, black));
  return { body, legs: merge(legs) };
}

// four ants: marching in a tight 2x2 block, or curled into a ball
const FORMATION = [[-0.3, 0.3], [0.3, 0.3], [-0.3, -0.45], [0.3, -0.45]];
export function buildAnts() {
  const G = (GEO.ants ||= antGeometry()), M = mats();
  const body = new THREE.Group();
  const ball = new THREE.Group();          // rolls as one while curled
  ball.position.y = 0.45;
  body.add(ball);
  const ants = FORMATION.map(([x, z], i) => {
    const a = new THREE.Group();
    const shell = new THREE.Mesh(G.body, M.shell);
    shell.castShadow = true;
    const legs = new THREE.Mesh(G.legs, M.shell);
    a.add(shell, legs);
    ball.add(a);
    // curled: each ant hugs the ball with its back outward
    const dir = V(Math.sin(i * 1.57 + 0.4), (i % 2 ? 0.5 : -0.5), Math.cos(i * 1.57 + 0.4)).normalize();
    const curlQ = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir);
    return { a, legs, phase: i * 1.3, walkPos: V(x, -0.45, z), curlPos: dir.clone().multiplyScalar(0.22).add(V(0, -0.2, 0)), curlQ };
  });
  let t = 0, curl = 0;
  const q0 = new THREE.Quaternion();
  const anim = (dt, e) => {
    const want = e.state === 'windup' || e.state === 'dash' ? 1 : 0;
    curl += (want - curl) * (1 - Math.exp(-(want ? 10 : 5) * dt));
    const speed = Math.hypot(e.vel.x, e.vel.z);
    t += dt * (5 + speed * 150);
    for (const A of ants) {
      A.a.position.lerpVectors(A.walkPos, A.curlPos, curl);
      A.a.quaternion.slerpQuaternions(q0, A.curlQ, curl);
      A.a.position.y += (1 - curl) * Math.abs(Math.sin(t + A.phase)) * 0.03;
      A.legs.rotation.y = (1 - curl) * Math.sin(t * 1.5 + A.phase) * 0.35;
      A.legs.scale.setScalar(1 - curl * 0.6);         // legs tuck in when curled
    }
    if (e.state === 'dash') ball.rotation.x += speed * dt / 0.45 * 2.2;
    else ball.rotation.x *= Math.exp(-6 * dt);
    if (e.state === 'windup') ball.rotation.z = Math.sin(t * 6) * 0.15;   // a quick shiver: it's about to roll
    else ball.rotation.z = 0;
  };
  return { body, face: new THREE.Group(), anim };
}

// ------------------------------------------------------------------ mosquito
function mosquitoGeometry() {
  const gray = '#3a3a42', white = '#e8e8ec', dark = '#1a1a20';
  const parts = [
    ellipsoid(0.28, 0.26, 0.32, V(0, 0, 0.1), gray),                     // thorax
    ellipsoid(0.16, 0.16, 0.16, V(0, 0.02, 0.48), dark),                 // head
    rod(V(0, -0.02, 0.6), V(0, -0.32, 1.25), 0.025, 0.006, dark),        // proboscis
  ];
  for (let k = 0; k < 6; k++) {                                          // striped abdomen
    const z = -0.2 - k * 0.17;
    parts.push(ellipsoid(0.17 - k * 0.018, 0.14 - k * 0.015, 0.1, V(0, -0.06 - k * 0.04, z), k % 2 ? white : gray, 10));
  }
  const legs = [];
  for (const s of [-1, 1]) for (const z of [0.25, 0.1, -0.05]) {
    const knee = V(s * 0.5, 0.15, z + 0.15), foot = V(s * 0.75, -0.9, z + 0.3 - (0.25 - z) * 1.5);
    legs.push(rod(V(s * 0.12, -0.05, z), knee, 0.025, 0.018, dark), rod(knee, foot, 0.018, 0.006, dark));
  }
  const wing = new THREE.ShapeGeometry(new THREE.Shape().moveTo(0, 0).bezierCurveTo(0.3, 0.18, 1.0, 0.16, 1.15, 0).bezierCurveTo(1.0, -0.12, 0.3, -0.12, 0, 0));
  wing.rotateX(-Math.PI / 2).rotateY(Math.PI * 0.62);
  return { body: merge(parts), legs: merge(legs), wing };
}

export function buildMosquito() {
  const G = (GEO.mosquito ||= mosquitoGeometry()), M = mats();
  const body = new THREE.Group();
  const shell = new THREE.Mesh(G.body, M.matte);
  shell.castShadow = true;
  const legs = new THREE.Mesh(G.legs, M.matte);
  body.add(shell, legs);
  const wings = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.12, 0.2, 0.12);
    const w = new THREE.Mesh(G.wing, M.wing);
    w.scale.set(s * -1, 1, 1);
    pivot.add(w);
    body.add(pivot);
    return { pivot, s };
  });
  const face = angryEyes({ y: 0.12, z: 0.62, size: 0.28, gap: 0.26 });
  let t = 0;
  const anim = (dt, e) => {
    t += dt;
    for (const W of wings) W.pivot.rotation.z = W.s * (0.2 + Math.sin(t * 70) * 0.55);   // a blur of wings
    legs.rotation.x = Math.sin(t * 2.3) * 0.08;
    body.position.y = Math.sin(t * 5 + e.phase) * 0.12;
    body.rotation.x = -0.15 + (e.aimT > 0 ? -0.35 : 0);                 // dips its nose to shoot
  };
  return { body, face, anim };
}
