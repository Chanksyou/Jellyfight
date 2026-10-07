// The bugs: cockroaches, ant squads, mosquitoes, the lanternfly, the house spider and the house fly. Procedural models with moving legs and
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
  const add = (parent, geo, mat, at) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; if (at) m.position.copy(at); parent.add(m); return m; };
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

  let t = 0, k = 0, rearUp = 0, recoil = 0;
  const anim = (dt, e) => {
    t += dt;
    const speed = Math.hypot(e.vel.x, e.vel.z);
    k += (Math.min(1, speed * 7) - k) * (1 - Math.exp(-8 * dt));
    rearUp += ((e.aimT > 0 ? 1 : 0) - rearUp) * (1 - Math.exp(-10 * dt));
    recoil = e.firedT > 0 ? 1 : recoil * Math.exp(-7 * dt);
    const step = t * (3 + 11 * k) + e.phase;
    for (const L of legs) {
      const ph = step + L.phase, up = Math.max(0, Math.sin(ph));          // lifted while it swings forward
      L.swing.rotation.y = Math.cos(ph) * 0.28 * k * L.s;              // (forward while lifted, on both sides)
      // rearing: the front pair lifts high and reaches forward, the second pair a little
      const raise = L.pair === 0 ? rearUp * 0.55 : L.pair === 1 ? rearUp * 0.2 : 0;
      L.lift.rotation.z = L.e1 + up * 0.35 * k + raise;
      L.knee.rotation.z = L.k2 - up * 0.25 * k + raise * 0.6;
      L.ankle.rotation.z = L.k3 + raise * 0.4;
    }
    // the body: a slight bob with each step set, nose up when it rears, a kick back when it fires
    body.position.y = Math.abs(Math.sin(step)) * 0.02 * k;
    front.rotation.x = -rearUp * 0.16 + recoil * 0.08;
    rear.rotation.x = -rearUp * 0.35 - recoil * 0.15;                        // abdomen tipped up toward its target
    for (const p of palps) p.rotation.x = Math.sin(t * 6 + e.phase) * 0.15 + rearUp * -0.4;   // palps twitch, lift when it rears
  };
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
  const add = (parent, geo, mat, at) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; if (at) m.position.copy(at); parent.add(m); return m; };
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
    w.castShadow = false;
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

  let t = 0, rub = 0, lunge = 0, aim = 1.15;
  const anim = (dt, e) => {
    t += dt;
    rub += ((e.state === 'windup' ? 1 : 0) - rub) * (1 - Math.exp(-12 * dt));
    lunge += ((e.state === 'poke' ? 1 : 0) - lunge) * (1 - Math.exp(-20 * dt));
    // the straw: hanging down at rest, drawn back and curled in the windup, aimed and shot out in the poke
    const k = e.pokeK || 0;
    aim += ((e.state === 'windup' ? 1.45 : e.pokeK > 0 ? (e.pokePitch ?? 0.2) : 1.15) - aim) * (1 - Math.exp(-18 * dt));
    straw.rotation.x = aim;
    const len = THREE.MathUtils.lerp(e.state === 'windup' ? 0.14 : 0.22, e.pokeLen || 0.22, k);
    trunk.scale.set(1, 1, len);
    pad.position.z = len;
    for (const W of wings) W.flap.rotation.z = W.s * (0.15 + Math.sin(t * 85 + (W.s > 0 ? 0 : 0.4)) * 0.75);   // a blur of wings
    for (const L of legs) {
      const sway = Math.sin(t * 3 + L.pair + e.phase) * 0.08;
      if (L.pair === 0) {
        // the front pair: dangling, raised and rubbed together before a poke
        L.hip.rotation.x = sway * (1 - rub) - rub * (1.15 + Math.sin(t * 32) * L.s * 0.18) + lunge * 0.3;
        L.hip.rotation.z = -L.s * rub * (0.5 + Math.sin(t * 32 + 1) * 0.1);
      } else {
        L.hip.rotation.x = sway + (L.pair === 2 ? 0.35 : 0.1) + lunge * 0.15;   // trailing back
        L.hip.rotation.z = 0;
      }
    }
    // the body: a hovering bob; reared back in the windup, a jab forward with the poke
    body.position.y = Math.sin(t * 5 + e.phase) * 0.08 * (1 - rub);
    body.position.z = -rub * 0.12 + lunge * 0.18;
    body.rotation.x = 0.08 - rub * 0.2 + lunge * 0.12;
  };
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
  const coil = (G.coil ||= coilTable(N));
  const outer = new THREE.Group(), body = new THREE.Group();
  outer.add(body);
  const segs = [];
  for (let i = 0; i < N; i++) {
    const seg = new THREE.Group();
    const geo = i === 0 ? G.head : i === N - 1 ? G.tail : G.ringGeo;
    const shell = new THREE.Mesh(geo, i === 0 || i === N - 1 ? M.milPart : M.milRing);
    shell.castShadow = true;
    if (i === 0 || i === N - 1) shell.scale.setScalar(MIL.fat);
    seg.add(shell);
    let legs = null;
    if (i > 0 && i < N - 2) { legs = new THREE.Mesh(G.legs, M.milPart); seg.add(legs); }
    if (i === 0) { const face = angryEyes({ y: 0.14, z: 0.36, size: 0.12, gap: 0.16 }); seg.add(face); }
    body.add(seg);
    segs.push({ seg, legs });
  }

  // the body as a chain (world x, z per segment): each one follows the one in front at a fixed
  // gap, like a rope pulled by the head, and segments that aren't neighbours push each other apart
  // so the body never folds through itself
  const W = [];
  const qWalk = new THREE.Quaternion(), qBall = new THREE.Quaternion(), qSpin = new THREE.Quaternion(), Y = V(0, 1, 0), X = V(1, 0, 0);
  const pWalk = new THREE.Vector3(), pBall = new THREE.Vector3();
  let t = 0, move = 0;
  const anim = (dt, e) => {
    t += dt;
    const root = e.root, ry = root.rotation.y, sc = Math.max(1e-4, e.mesh.scale.x);
    const hx = e.pos.x, hz = e.pos.z, gap = MIL.gap * sc, wide = 0.92 * sc;   // wide: the body's thickness
    if (!W.length) for (let k = 0; k < N; k++) W.push([hx - Math.sin(ry) * k * gap, hz - Math.cos(ry) * k * gap]);
    W[0][0] = hx; W[0][1] = hz;
    const follow = () => {
      for (let k = 1; k < N; k++) {
        const a = W[k - 1], b = W[k], dx = b[0] - a[0], dz = b[1] - a[1], d = Math.hypot(dx, dz) || 1e-6;
        b[0] = a[0] + dx / d * gap; b[1] = a[1] + dz / d * gap;
      }
    };
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
    const curl = e.curlK || 0, spin = e.spinA || 0;
    qSpin.setFromAxisAngle(X, spin);
    for (let i = 0; i < N; i++) {
      const [wx, wz] = W[i];
      // each segment faces the one in front of it; the head faces away from the one behind (where it's going)
      const f = i === 0 ? W[0] : W[i - 1], b = i === 0 ? W[1] : W[i];
      const tx = f[0] - b[0], tz = f[1] - b[1];
      const dx = wx - hx, dz = wz - hz, c = Math.cos(ry), s = Math.sin(ry);
      pWalk.set((dx * c - dz * s) / sc, MIL.y, (dx * s + dz * c) / sc);
      qWalk.setFromAxisAngle(Y, Math.atan2(tx, tz) - ry);
      // the coil, spun about its axle
      const C = coil.at[i];
      pBall.copy(C.p).applyQuaternion(qSpin).add(coil.center);
      qBall.copy(qSpin).multiply(C.q);
      // the tail curls in first, the head last
      const ki = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(curl * 1.5 - (1 - i / N) * 0.5, 0, 1), 0, 1);
      const S = segs[i];
      S.seg.position.lerpVectors(pWalk, pBall, ki);
      S.seg.position.y += Math.sin(t * 9 - i * 0.7) * 0.015 * move * (1 - ki);   // a slight ripple as it goes
      S.seg.quaternion.slerpQuaternions(qWalk, qBall, ki);
      if (S.legs) {
        // the leg wave: each pair steps a little after the one in front of it
        S.legs.rotation.x = Math.sin(t * 14 - i * 0.9) * 0.5 * (0.3 + move) * (1 - ki);
        S.legs.scale.setScalar(MIL.fat * (1 - ki * 0.6));          // tucked in when coiled
      }
    }
  };
  return { body: outer, face: new THREE.Group(), anim, ballRadius: coil.radius };   // radius units: how big the rolling ball is
}

// ------------------------------------------------------------------ homing missile
// A little guided missile, `L` long along +z: a white body with red bands, a dark ogive nose with a
// glowing seeker tip, four canards forward and four swept tail fins, a nozzle and a flame (two
// additive cones, flickered by whoever flies it). Used in flight (meters, enemies.js) and loaded
// on the ladybug's back (radius units).
const MISSILE_MAT = {};
export function buildMissile(L = 0.04) {
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
  flame.position.z = -0.44 * L;
  flame.add(new THREE.Mesh(new THREE.ConeGeometry(r * 0.85, 0.36 * L, 12, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.18 * L), M.flame));
  flame.add(new THREE.Mesh(new THREE.ConeGeometry(r * 0.45, 0.2 * L, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.1 * L), M.core));
  g.add(flame);
  return { group: g, flame, length: L };
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
  const add = (parent, geo, mat, at) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; if (at) m.position.copy(at); parent.add(m); return m; };
  add(body, G.under, M.lbLeg);
  // a disc lying on an ellipsoid (centre C, radii E) in direction d: the spots and patches
  const onShell = (parent, C, E, d, r, mat, lift = 0.012) => {
    const u = d.clone().normalize(), p = V(C.x + E.x * u.x, C.y + E.y * u.y, C.z + E.z * u.z);
    const n = V(u.x / E.x, u.y / E.y, u.z / E.z).normalize();
    const m = add(parent, new THREE.SphereGeometry(1, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(r, 0.035, r * 0.92), mat);
    m.position.copy(p).addScaledVector(n, lift);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), n);
    return m;
  };
  // pronotum and head
  const PC = V(0, -0.02, 0.74), PE = V(0.6, 0.4, 0.34);
  add(body, new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.62).scale(PE.x, PE.y, PE.z).translate(PC.x, PC.y, PC.z), M.lbBlack);
  for (const s of [-1, 1]) { onShell(body, PC, PE, V(s * 0.75, 0.42, 0.5), 0.16, M.lbCream); onShell(body, PC, PE, V(s * 0.25, 0.4, 0.88), 0.07, M.lbCream); }
  const HC = V(0, -0.1, 1.04), HE = V(0.32, 0.22, 0.2);
  add(body, new THREE.SphereGeometry(1, 24, 14).scale(HE.x, HE.y, HE.z).translate(HC.x, HC.y, HC.z), M.lbBlack);
  for (const s of [-1, 1]) onShell(body, HC, HE, V(s * 0.6, 0.35, 0.7), 0.07, M.lbCream);
  const antennae = [-1, 1].map((s) => { const a = add(body, G.antenna, M.lbLeg, V(s * 0.12, -0.04, 1.2)); a.scale.x = s; return a; });
  body.add(angryEyes({ y: -0.06, z: 1.22, size: 0.1, gap: 0.12 }));
  // the elytra: each a half dome on a hinge at its front inner corner, its spots riding on it
  const EC = V(0, -0.02, -0.16), EE = V(0.92, 0.78, 1.0);
  const elytra = [-1, 1].map((s) => {
    const pivot = new THREE.Group(), hinge = V(s * 0.04, EC.y + 0.66, EC.z + 0.58);
    pivot.position.copy(hinge);
    body.add(pivot);
    const shell = new THREE.Group();
    shell.position.copy(hinge).negate();
    pivot.add(shell);
    const half = (k) => new THREE.SphereGeometry(1, 40, 24, s > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI, 0, Math.PI * 0.58).scale(EE.x * k, EE.y * k, EE.z * k).translate(EC.x, EC.y, EC.z);
    add(shell, half(1), M.lbRed);
    add(shell, half(0.97), M.lbInside);
    for (const [d, r] of [[V(s * 0.08, 0.82, 0.58), 0.13], [V(s * 0.72, 0.5, 0.38), 0.13], [V(s * 0.46, 0.86, -0.05), 0.19], [V(s * 0.62, 0.42, -0.62), 0.14]]) onShell(shell, EC, EE, d, r, M.lbBlack);
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
    w.castShadow = false;
    w.scale.x = s;
    return { s, pivot, flap };
  });
  const legs = [];
  G.legs.forEach((L, pair) => [-1, 1].forEach((s, side) => {
    const hip = new THREE.Group();
    hip.position.set(s * 0.32, -0.24, L.z);
    add(hip, L.geo[side], M.lbLeg);
    body.add(hip);
    legs.push({ s, pair, hip });
  }));
  // the missile on its rail, between the raised elytra
  const pod = new THREE.Group();
  pod.position.set(0, 0.3, -0.2);
  body.add(pod);
  add(pod, new THREE.BoxGeometry(0.12, 0.05, 0.9), M.lbBlack).position.set(0, -0.03, 0);
  const loaded = buildMissile(1.25);
  loaded.group.rotation.x = -0.35;                                       // nose up over its head
  loaded.group.position.set(0, 0.08, 0.05);
  loaded.flame.visible = false;
  pod.add(loaded.group);

  let t = 0, shell = 0, fly = 0, flap = 0;
  const anim = (dt, e) => {
    t += dt;
    shell += ((e.shellK ?? 0) - shell) * (1 - Math.exp(-12 * dt));
    fly += ((e.flyK ?? 0) - fly) * (1 - Math.exp(-9 * dt));
    flap += ((e.wingK ?? 0) - flap) * (1 - Math.exp(-12 * dt));
    // elytra: the back lifts on the front hinge and the outer edges swing up and out
    for (const E of elytra) E.pivot.rotation.set(shell * 1.15, -E.s * shell * 0.2, E.s * shell * 0.7, 'YXZ');
    // hind wings: unfold sideways and back, beating as a blur
    for (const W of wings) {
      W.pivot.scale.setScalar(Math.max(0.001, flap));
      W.pivot.rotation.set(0.15, -W.s * (0.2 + 0.9 * flap), 0);
      W.flap.rotation.z = W.s * (0.2 + Math.sin(t * 90 + (W.s > 0 ? 0 : 0.5)) * 0.85) * flap;
    }
    // legs: a shuffle on the ground, tucked up in flight
    for (const L of legs) L.hip.rotation.set(fly * 0.9, Math.sin(t * 9 + L.pair * 2.1 + (L.s > 0 ? Math.PI : 0)) * 0.12 * (1 - fly) * (e.stepK ?? 0), L.s * fly * 0.5);
    for (const a of antennae) a.rotation.y = Math.sin(t * 5 + e.phase) * 0.15 + (e.state === 'aim' ? Math.sin(t * 30) * 0.1 : 0);
    // the body: nose up in flight with a wobble; a kick back as the missile goes
    const kick = Math.max(0, e.firedT || 0);
    body.rotation.x = -fly * 0.35 + Math.sin(t * 7 + e.phase) * 0.05 * fly - kick * 0.5;
    body.position.y = Math.sin(t * 6 + e.phase) * 0.06 * fly;
    pod.visible = shell > 0.55 && e.loaded !== false;
    pod.position.y = 0.3 + Math.max(0, shell - 0.4) * 0.3;
  };
  return { body: outer, face: new THREE.Group(), anim };
}
