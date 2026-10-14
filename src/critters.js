// The bugs: cockroaches, ant squads, mosquitoes, the lanternfly, the house spider, the house fly, the dragonfly, the mantis and the worm inside it. Procedural models with moving legs and
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
  const add = (parent, geo, mat, at) => { const m = new THREE.Mesh(geo, mat); if (at) m.position.copy(at); parent.add(m); return m; };
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
  body.add(angryEyes({ y: 0.14, z: 1.02, size: 0.09, gap: 0.14 }));
  const legs = add(body, G.legs, M.dfLeg);
  // the abdomen hangs from the back of the thorax and sways a little
  const tail = new THREE.Group();
  tail.position.set(0, -0.02, 0.12);
  body.add(tail);
  add(tail, G.abdomenGeo, M.dfAbdomen, V(0, 0, -0.12));
  add(tail, G.claspers, M.dfLeg, V(0, 0, -0.12));
  // four wings, each on a hinge at its root: the forewings ahead of the hind ones
  const wings = [];
  for (const [geo, z, fore] of [[G.foreGeo, 0.52, true], [G.hindGeo, 0.28, false]]) for (const s of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(s * 0.08, 0.27, z);
    hinge.rotation.y = s * (fore ? -0.1 : 0.14);                       // the forewings sweep forward a touch, the hind ones back
    const m = add(hinge, geo, M.dfWing);
    m.scale.x = s;
    body.add(hinge);
    wings.push({ s, fore, hinge });
  }

  let t = 0, dart = 0, glide = 0;
  const anim = (dt, e) => {
    t += dt;
    const speed = Math.hypot(e.vel.x, e.vel.z);
    dart += (Math.min(1, speed * 4) - dart) * (1 - Math.exp(-6 * dt));
    // every few seconds it holds its wings out flat and glides for a moment
    const g = Math.sin(t * 0.9 + e.phase) > 0.8 ? 1 : 0;
    glide += (g - glide) * (1 - Math.exp(-10 * dt));
    const beat = 1 - glide;
    for (const W of wings) {
      // fore and hind beat out of step, a quarter turn apart; a dragonfly's wings are a blur
      const a = Math.sin(t * 70 + (W.fore ? 0 : Math.PI * 0.6));
      W.hinge.rotation.z = W.s * (0.05 + a * 0.55 * beat);
      W.hinge.rotation.x = a * 0.25 * beat * (W.fore ? 1 : -1);        // the wings twist through the stroke
    }
    legs.rotation.x = -0.1 + Math.sin(t * 2.1 + e.phase) * 0.05;
    tail.rotation.x = Math.sin(t * 1.7 + e.phase) * 0.05 + dart * 0.08;
    tail.rotation.y = Math.sin(t * 1.3 + e.phase) * 0.04;
    body.position.y = Math.sin(t * 3 + e.phase) * 0.06 * (1 - dart * 0.5);
    body.rotation.x = 0.1 * dart + Math.sin(t * 2.3 + e.phase) * 0.03;   // nose down to dart
    body.rotation.z = Math.sin(t * 1.1 + e.phase) * 0.04;
  };
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
  if (!dead) body.add(angryEyes({ y: 1.28, z: 1.22, size: 0.075, gap: 0.19 }));
  const tail = new THREE.Object3D();                                   // the tip of the abdomen (the worm comes out here)
  tail.position.copy(MANTIS.tail);
  body.add(tail);
  const fore = [-1, 1].map((s) => {
    const shoulder = new THREE.Group(), femur = new THREE.Group(), tibia = new THREE.Group();
    shoulder.position.set(s * MANTIS.shoulder.x, MANTIS.shoulder.y, MANTIS.shoulder.z);
    shoulder.rotation.y = s * 0.08;
    add(shoulder, G.coxa, M.mtBody);
    femur.position.z = 0.38; shoulder.add(femur); add(femur, G.femur, M.mtBody);
    tibia.position.z = 0.5; femur.add(tibia); add(tibia, G.tibia, M.mtBody);
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
  const mix = (A, B, k, out = [0, 0, 0]) => { for (let i = 0; i < 3; i++) out[i] = A[i] + (B[i] - A[i]) * k; return out; };
  if (dead) {
    // a carcass: rolled onto its side, the legs crumpled, the forelegs limp
    pose(LIMP);
    for (const L of legs) { L.hip.rotation.z = L.s * -0.9; L.hip.rotation.x = 0.4 * (L.pair ? -1 : 1); }
    body.rotation.z = -1.3;
    body.position.y = 0.12;
    return { body: outer, face: new THREE.Group(), anim: null, rig: { body, tail } };
  }
  pose(PRAY);
  let t = 0, k = 0, raise = 0, strike = 0;
  const P = [0, 0, 0];
  const anim = (dt, e) => {
    t += dt;
    const speed = Math.hypot(e.vel.x, e.vel.z);
    k += (Math.min(1, speed * 6) - k) * (1 - Math.exp(-8 * dt));
    raise += ((e.state === 'windup' ? 1 : 0) - raise) * (1 - Math.exp(-10 * dt));
    strike += ((e.state === 'swat' ? 1 : 0) - strike) * (1 - Math.exp(-(e.state === 'swat' ? 40 : 6) * dt));
    // forelegs: folded in prayer, raised and opened in the windup, lunging and snapping shut in the swat
    mix(PRAY, RAISED, raise, P);
    mix(P, STRUCK, strike, P);
    pose(P);
    for (const F of fore) F.shoulder.rotation.x += Math.sin(t * 1.6 + e.phase) * 0.04 * (1 - raise);   // a slow sway as it watches you
    const step = t * (3 + 10 * k), walk = 1 - Math.max(raise, strike);
    for (const L of legs) {
      L.hip.rotation.y = Math.sin(step + L.phase) * 0.35 * k * walk;
      L.hip.rotation.z = Math.max(0, Math.cos(step + L.phase)) * 0.2 * k * walk;
    }
    // the body: a stalking sway, reared back in the windup, thrown forward in the swat
    body.rotation.x = -raise * 0.22 + strike * 0.2;
    body.position.z = -raise * 0.1 + strike * 0.35;
    body.position.y = raise * 0.06;
    body.rotation.z = Math.sin(step * 0.5) * 0.03 * k;
  };
  return { body: outer, face: new THREE.Group(), anim };
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
  const pts = Array.from({ length: WORM.n + 1 }, () => new THREE.Vector3()), tmp = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3();
  const UPV = V(0, 1, 0), FWD = V(0, 0, 1), q = new THREE.Quaternion(), dir = new THREE.Vector3();
  // the poses, s from 0 (in the head) to 1 (the tip); d: the way it lashes (local, flat)
  const idle = (s, t, out) => {
    const a = s * 4.2 * Math.PI + t * 1.6, rho = 0.3 + 0.35 * s;
    return out.set(base.x + rho * Math.cos(a) - rho * 0.6, base.y + s * 1.8 + Math.sin(s * 9 + t * 3) * 0.08, base.z + rho * Math.sin(a));
  };
  const back = (s, t, d, out) => {
    const lift = Math.sin(s * Math.PI * 0.9);
    return out.set(base.x - d.x * lift * 1.3 + Math.sin(s * 12 + t * 8) * 0.06, base.y + s * 2.8 - Math.max(0, s - 0.75) * 2.4, base.z - d.z * lift * 1.3);
  };
  const lash = (s, len, d, out) => out.set(base.x + d.x * s * len, 0.06 + base.y * (1 - s) * (1 - s), base.z + d.z * s * len);
  let t = 0, wind = 0, out = 0, grow = 0;
  const anim = (dt, e) => {
    t += dt;
    // where it lashes, in the body's own space (the body never turns: it's rooted)
    const a = Math.atan2(e.whipDir?.x ?? 0, e.whipDir?.z ?? 1) - e.root.rotation.y;
    dir.set(Math.sin(a), 0, Math.cos(a));
    const len = (e.whipReach ?? 0.25) / e.r;
    const emerging = e.state === 'emerge';
    grow = emerging ? 0 : Math.min(1, grow + dt * 3);
    wind += ((e.state === 'windup' ? 1 : 0) - wind) * (1 - Math.exp(-8 * dt));
    out = e.state === 'lash' ? Math.min(1, out + dt / 0.12) : e.state === 'down' ? 1 : Math.max(0, out - dt * 2.5);
    // the carcass twitches while the worm is coming
    body.rotation.x = emerging ? Math.sin(t * 40) * 0.05 * Math.min(1, t) : 0;
    for (let i = 0; i <= WORM.n; i++) {
      const s = (i / WORM.n) * grow;
      idle(s, t, A);
      back(s, t, dir, B);
      A.lerp(B, wind);
      if (out > 0) { const u = THREE.MathUtils.clamp(out * 1.6 - s * 0.6, 0, 1); A.lerp(lash(s, len, dir, B), u * u * (3 - 2 * u)); }   // the tip arrives last: a whip's crack
      pts[i].copy(A);
    }
    // the pieces, each from one point to the next (a little longer, so the joins close), thinning to the tip
    for (let i = 0; i < WORM.n; i++) {
      const b = beads[i], p = pts[i], n = pts[i + 1];
      const l = tmp.copy(n).sub(p).length(), th = WORM.thick * (1 - 0.55 * i / WORM.n);
      b.visible = grow > 0.02;
      b.position.copy(p).add(n).multiplyScalar(0.5);
      if (l > 1e-5) b.quaternion.copy(q.setFromUnitVectors(FWD, tmp.divideScalar(l)));
      b.scale.set(th, th, l * 1.15 + th * 0.5);
    }
    // where the worm comes out, in the world: the burst and whip words read it
    (e.emergeAt ||= new THREE.Vector3()).copy(base).applyAxisAngle(UPV, e.root.rotation.y).multiplyScalar(e.r).add(e.pos);
  };
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
  body.add(angryEyes({ y: 0.16, z: 1.02, size: 0.09, gap: 0.17 }));
  // the abdomen hangs from the waist, a little low, and pumps as it flies
  const tail = new THREE.Group();
  tail.position.set(0, -0.04, 0.02);
  tail.rotation.x = -0.35;
  body.add(tail);
  add(tail, G.gasterGeo, M.wpGaster, V(0, 0, -0.02));
  add(tail, G.sting, M.wpBody);
  const wings = [];
  for (const [geo, z, fore] of [[G.foreGeo, 0.52, true], [G.hindGeo, 0.36, false]]) for (const s of [-1, 1]) {
    const hinge = new THREE.Group(), flap = new THREE.Group();
    hinge.position.set(s * 0.14, 0.26, z);
    hinge.rotation.y = s * (fore ? 0.55 : 0.7);                           // swept back over the abdomen
    hinge.add(flap);
    const m = add(flap, geo, M.wpWing);
    m.scale.x = s;
    body.add(hinge);
    wings.push({ s, fore, flap });
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
  let t = 0, wind = 0;
  const anim = (dt, e) => {
    t += dt;
    const ph = e?.phase || 0, speed = e?.vel ? Math.hypot(e.vel.x, e.vel.z) : 0;
    for (const W of wings) W.flap.rotation.z = W.s * (0.1 + Math.sin(t * 80 + (W.fore ? 0 : 0.5)) * 0.7);   // a blur of wings
    for (const L of legs) L.hip.rotation.x = 0.4 + L.pair * 0.15 + Math.sin(t * 3 + L.pair + ph) * 0.06;   // hanging, trailing back
    // winding up to sting: it rears, abdomen curled forward under it; diving: nose down along its line
    wind += (((e?.state === 'windup') ? 1 : 0) - wind) * (1 - Math.exp(-10 * dt));
    const diving = e?.state === 'dive' && e.diveDir;
    tail.rotation.x = -0.35 - wind * 0.9 + Math.sin(t * (6 + wind * 20) + ph) * 0.06;   // the abdomen pumps, faster as it winds up
    body.position.y = Math.sin(t * 5 + ph) * 0.08 * (1 - wind);
    body.rotation.x = diving ? Math.asin(THREE.MathUtils.clamp(-e.diveDir.y, -1, 1)) + 0.3 : 0.05 + Math.min(1, speed * 4) * 0.15 - wind * 0.5;
  };
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
  const anim = (dt, e) => {
    t += dt;
    if (e.hatchedT > 0) { shake = 1; e.hatchedT = 0; }                   // a wasp just crawled out: it trembles
    shake *= Math.exp(-6 * dt);
    body.rotation.z = Math.sin(t * 30) * 0.03 * shake;
    // where wasps come out, in the world: the brood word reads it
    (e.emergeAt ||= new THREE.Vector3()).copy(door).applyAxisAngle(UPV, e.root.rotation.y).multiplyScalar(e.r).add(e.pos);
  };
  return { body: outer, face: new THREE.Group(), anim };
}

// ------------------------------------------------------------------ Aerial root (the Pothos's)
// A woody aerial root: a knobbly brown cord, ringed with bark and darker grooves, that thins to a
// pale, waxy growing tip, with a few fine rootlets. It lies along the floor, tip forward (+z), and
// creeps by wriggling; falling, it hangs tip down; holding on, it rears and coils.
function rootGeometry() {
  const n = 28, rad = 6, len = 2.6;
  const pts = [];
  for (let i = 0; i <= 8; i++) { const s = i / 8; pts.push(V(Math.sin(s * 5.5) * 0.18, 0.22 + 0.12 * Math.sin(s * Math.PI), -len / 2 + s * len)); }
  const curve = new THREE.CatmullRomCurve3(pts), g = new THREE.TubeGeometry(curve, n, 1, rad, false).toNonIndexed();
  // taper each vertex toward the curve: thick at the back, thinning to the tip, knobbly with bark rings
  const p = g.attributes.position, col = [], c = new THREE.Color(), C = new THREE.Vector3(), v = new THREE.Vector3();
  const bark = new THREE.Color('#5a3a20'), dark = new THREE.Color('#2e1b0d'), pale = new THREE.Color('#efe6c4'), green = new THREE.Color('#c9dc8e');
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // the nearest point on the curve (the tube is straight enough to find it by z)
    const s = THREE.MathUtils.clamp((v.z + len / 2) / len, 0, 1);
    curve.getPointAt(s, C);
    const a = Math.atan2(v.y - C.y, v.x - C.x);
    const ring = 0.5 + 0.5 * Math.cos(s * 70);                       // bark rings
    const r = 0.2 * (1 - 0.72 * s) * (1 + 0.1 * ring + 0.06 * Math.sin(a * 3 + s * 20));
    v.sub(C).normalize().multiplyScalar(r).add(C);
    p.setXYZ(i, v.x, v.y, v.z);
    const groove = Math.abs(Math.sin(a * 2.5 + s * 9)) < 0.25 ? 1 : 0;
    c.copy(bark).lerp(dark, 0.35 * ring + 0.5 * groove).lerp(green, THREE.MathUtils.smoothstep(s, 0.68, 0.8) * 0.7).lerp(pale, THREE.MathUtils.smoothstep(s, 0.78, 0.95));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  // a few fine rootlets off the woody part, and a rounded cap on the tip
  const parts = [g];
  for (let k = 0; k < 7; k++) {
    const s = 0.1 + k * 0.09, at = curve.getPointAt(s), side = k % 2 ? 1 : -1;
    parts.push(rod(at, at.clone().add(V(side * (0.3 + 0.1 * (k % 3)), -0.12 - 0.05 * (k % 2), 0.1)), 0.035, 0.008, k % 3 ? '#4a2e18' : '#8a6a48'));
  }
  const tip = curve.getPointAt(1);
  parts.push(ellipsoid(0.07, 0.07, 0.1, tip, '#f4eccf', 8));
  return merge(parts);
}

export function buildRoot() {
  const geo = (GEO.root ||= rootGeometry()), M = mats();
  const outer = new THREE.Group(), body = new THREE.Group();
  outer.add(body);
  body.add(new THREE.Mesh(geo, M.matte));
  let t = Math.random() * 10;
  const anim = (dt, e) => {
    t += dt;
    const falling = e.state === 'drop', holding = e.state === 'hold';
    // falling: tip down; creeping: lying flat, wriggling side to side; holding: reared up, writhing
    const pitch = falling ? -1.3 : holding ? -0.6 : 0;
    body.rotation.x += (pitch - body.rotation.x) * (1 - Math.exp(-10 * dt));
    body.rotation.y = Math.sin(t * (holding ? 9 : 6)) * (holding ? 0.35 : 0.22);
    body.rotation.z = holding ? Math.sin(t * 5) * 0.25 : 0;
    body.position.y = falling ? 1.2 : 0;
  };
  return { body: outer, face: new THREE.Group(), anim };
}
