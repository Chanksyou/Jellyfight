// The Latticework Coffer (act 3's third Elite, elites.js kind 'coffer'), after the owner's concept
// art: a flat dark-brown wooden box, a lighter raised frame round its lid and a stepped slab under
// its base; the lid studded with a grid of round amber cabochons, three of them big glowing amber
// eyes with slit pupils that open when it wakes; black pleated accordion bellows round its sides and
// back between lid and base; inside, a wet red maw with rows of long yellow fangs and drool; it
// stands on six gnarled, splintered wooden legs (root-like pseudopods) with small whipping tendrils.
// Built in meters facing +z (its mouth), feet on y = 0, about 22 cm wide. Asleep it is just a box
// (the bellows shut, the fangs inside the lid and base, no eyes, no legs).
//
// Every part shares ONE vertex-coloured wood material except the eyes (unlit, they glow), the
// tongue and the jewels: base, lid, bellows, legs and tendrils are one mesh each; the arm (the
// bellows stretched out for its accordion strike) one more while it strikes. pose() and reach()
// move it; nothing here allocates per frame. `loose` are meshes for the scene, not the model (the
// tongue between its mouth and the jelly, the jewels it fires): elites.js adds them.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const WOOD = 0x2c1a0e, WOOD_DARK = 0x1a0f07, RIM = 0x5c3820, AMBER = 0xd8902a, BELLOWS = 0x161312, PLEAT = 0x2e2824;
const MAW = 0x4a0a10, FLESH = 0x8c1c26, FANG = 0xe6cf7c, FANG_TIP = 0xb8862c, DROOL = 0xe8e2c4, LEG = 0x6a4a2e, SPLINTER = 0xa8814e, TENDRIL = 0x4a2e1c;
const _c = new THREE.Color(), _a = new THREE.Color();

// a part ready to merge: non-indexed, with a colour per vertex from `paint(x, y, z, out)`
function part(geo, paint) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  const p = geo.attributes.position, n = p.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { paint(p.getX(i), p.getY(i), p.getZ(i), _c); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
const solid = (hex) => (x, y, z, out) => out.setHex(hex);
// dark wood with a grain running along x
const grain = (x, y, z, out) => out.setHex(WOOD).lerp(_a.setHex(WOOD_DARK), 0.5 + 0.5 * Math.sin(z * 260 + Math.sin(x * 40) * 3));
// a stick from a to b, radius r0 at a to r1 at b
function stick(a, b, r0, r1, seg = 6) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}

// its size (m): W wide, D deep; base and lid slabs; LIFT: how high its legs hold it awake
export const COFFER = { W: 0.22, D: 0.17, base: 0.016, lid: 0.018, LIFT: 0.035 };
const { W, D } = COFFER;
const SHOT_LID = 0.6;                     // the lid's size shot out on its arm (reach)
const FOLDS = 7, INSET = 0.007;          // the bellows' pleats, and how deep each fold goes in
const inset = (t) => (Math.round(t * FOLDS * 2) % 2 ? INSET : 0.0015);

// the bellows round its sides and back: a pleated ribbon going round the U (left, back, right),
// FOLDS folds high. Each row of four corners is one height t (0 at the base, 1 under the lid);
// pose() moves the rows up (shape()).
function bellowsGeometry() {
  const rows = FOLDS * 2 + 1, hw = W / 2 - 0.004, hd = D / 2 - 0.004, pos = [], col = [], idx = [];
  for (let j = 0; j < rows; j++) {
    const t = j / (rows - 1), i = inset(t), c = _c.setHex(j % 2 ? BELLOWS : PLEAT);
    for (const [x, z] of [[-hw + i, hd], [-hw + i, -hd + i], [hw - i, -hd + i], [hw - i, hd]]) { pos.push(x, t, z); col.push(c.r, c.g, c.b); }
  }
  for (let j = 0; j < rows - 1; j++) for (let k = 0; k < 3; k++) { const a = j * 4 + k, b = a + 1, c = a + 4, d = a + 5; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData.t = pos.filter((_, n) => n % 3 === 1);   // each vertex's height in the stack (0..1)
  return g;
}

// the arm: the bellows pulled out into a long pleated tube, unit length along +z, 12 cm by 3 cm
function armGeometry() {
  const rows = 25, hw = 0.06, hh = 0.016, pos = [], col = [], idx = [];
  for (let j = 0; j < rows; j++) {
    const t = j / (rows - 1), i = j % 2 ? 0.006 : 0, c = _c.setHex(j % 2 ? BELLOWS : PLEAT);
    for (const [x, y] of [[-hw + i, -hh + i], [hw - i, -hh + i], [hw - i, hh - i], [-hw + i, hh - i]]) { pos.push(x, y, t); col.push(c.r, c.g, c.b); }
  }
  for (let j = 0; j < rows - 1; j++) for (let k = 0; k < 4; k++) { const a = j * 4 + k, b = j * 4 + ((k + 1) % 4), c = a + 4, d = b + 4; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// fangs along the front edge: n cones, pointing down (from the lid) or up (from the base)
function fangs(n, y, z, dir, len) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const x = (k / (n - 1) - 0.5) * (W - 0.04), l = len * (0.7 + 0.3 * Math.abs(Math.sin(k * 2.3))) * (k % 3 === 1 ? 1.25 : 1);
    const g = new THREE.ConeGeometry(0.0042, l, 6).translate(0, l / 2, 0);
    if (dir < 0) g.rotateX(Math.PI);
    g.rotateZ((k % 2 ? 1 : -1) * 0.12).translate(x, y, z);
    out.push(part(g, (px, py, pz, o) => o.setHex(Math.abs(py - y) > l * 0.7 ? FANG_TIP : FANG)));   // darker towards the tip
  }
  return out;
}

export function buildCoffer() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide });
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const B = COFFER.base;

  // the base: a stepped slab under it, the box's bottom with its frame, the red maw floor inside
  // with the tongue coiled on it, and the lower fangs along the front (inside the closed lid asleep)
  const base = [
    part(new RoundedBoxGeometry(W + 0.008, 0.006, D + 0.008, 2, 0.002).translate(0, 0.003, 0), solid(RIM)),
    part(new RoundedBoxGeometry(W, B - 0.006, D, 2, 0.002).translate(0, 0.006 + (B - 0.006) / 2, 0), grain),
    part(new THREE.BoxGeometry(W - 0.02, 0.002, D - 0.02).translate(0, B + 0.001, 0), solid(MAW)),
    part(new THREE.SphereGeometry(1, 12, 8).scale(0.045, 0.006, 0.035).translate(0, B + 0.002, -0.01), solid(FLESH)),
  ];
  for (const [w, d, x, z] of [[W, 0.006, 0, D / 2 - 0.003], [W, 0.006, 0, -D / 2 + 0.003], [0.006, D, W / 2 - 0.003, 0], [0.006, D, -W / 2 + 0.003, 0]]) base.push(part(new THREE.BoxGeometry(w, 0.003, d).translate(x, B - 0.0015, z), solid(RIM)));
  base.push(...fangs(9, B, D / 2 - 0.009, 1, 0.016));
  const baseMesh = new THREE.Mesh(mergeGeometries(base), mat);
  body.add(baseMesh);

  // the bellows (pose() sets their height and slope), and the arm they become when it strikes
  const bellows = new THREE.Mesh(bellowsGeometry(), mat);
  bellows.position.y = B;
  body.add(bellows);
  const arm = new THREE.Mesh(armGeometry(), mat);
  arm.rotation.order = 'YXZ';
  arm.visible = false;
  body.add(arm);

  // the lid, hinged at the back (lidPivot): the slab, its raised frame, the grid of amber
  // cabochons, the red roof of the maw and the upper fangs with drool hanging off them
  const L = COFFER.lid, lid = [part(new RoundedBoxGeometry(W, L, D, 2, 0.002).translate(0, L / 2, D / 2), grain)];
  for (const [w, d, x, z] of [[W, 0.012, 0, D - 0.006], [W, 0.012, 0, 0.006], [0.012, D, W / 2 - 0.006, D / 2], [0.012, D, -W / 2 + 0.006, D / 2]]) lid.push(part(new RoundedBoxGeometry(w, 0.006, d, 1, 0.0015).translate(x, L + 0.002, z), solid(RIM)));
  const EYES = [[1, 1], [3, 2], [4, 0]];       // which grid spots are its big eyes (column, row)
  const eyeAt = [];
  for (let c = 0; c < 6; c++) for (let r = 0; r < 4; r++) {
    const x = (c - 2.5) * 0.031, z = D / 2 + (r - 1.5) * 0.033, k = (c * 7 + r * 3) % 5;
    lid.push(part(new THREE.SphereGeometry(0.0072, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1).translate(x, L, z), solid(k ? AMBER : 0xc07a20)));
    lid.push(part(new THREE.TorusGeometry(0.0074, 0.0013, 4, 12).rotateX(Math.PI / 2).translate(x, L + 0.0005, z), solid(RIM)));   // its bezel
    if (EYES.some(([ec, er]) => ec === c && er === r)) eyeAt.push([x, z]);
  }
  lid.push(part(new THREE.BoxGeometry(W - 0.02, 0.002, D - 0.02).translate(0, -0.001, D / 2), solid(MAW)));
  lid.push(...fangs(10, 0, D - 0.009, -1, 0.017));
  for (const [x, l] of [[-0.062, 0.016], [0.018, 0.012], [0.071, 0.017]]) lid.push(part(new THREE.CylinderGeometry(0.0011, 0.0019, l, 5).translate(x, -l / 2, D - 0.012), solid(DROOL)));
  const lidPivot = new THREE.Group();
  const lidMesh = new THREE.Mesh(mergeGeometries(lid), mat);
  lidPivot.add(lidMesh);
  body.add(lidPivot);

  // its big eyes: glowing amber domes with black slit pupils (unlit: they glow in the dark room),
  // on the lid over three of the cabochons. Hidden asleep; scale opens them (0 to 1)
  const eyeParts = [];
  for (const [x, z] of eyeAt) {
    eyeParts.push(part(new THREE.SphereGeometry(0.0125, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.25, 0.75, 0.85).translate(x, 0, z), (px, py, pz, out) => out.setHex(0xffb22a).lerp(_a.setHex(0xff6a00), Math.min(1, Math.hypot(px - x, pz - z) / 0.014))));
    eyeParts.push(part(new THREE.BoxGeometry(0.0028, 0.002, 0.016).translate(x, 0.0094, z), solid(0x0a0604)));
    eyeParts.push(part(new THREE.TorusGeometry(0.0128, 0.0022, 5, 16).rotateX(Math.PI / 2).scale(1.25, 1, 0.85).translate(x, 0.0005, z), solid(0x4a2a14)));
  }
  const eyes = new THREE.Mesh(mergeGeometries(eyeParts), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  eyes.position.y = L;
  eyes.visible = false;
  lidMesh.add(eyes);

  // six gnarled legs, each a crooked root from under the box out and down to the desk, a splinter
  // or two off it; built for the box held LIFT up, and scaled down to nothing under it asleep
  const legParts = [], LIFT = COFFER.LIFT;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.5, cx = Math.sin(a), cz = Math.cos(a);
    const top = new THREE.Vector3(cx * W * 0.32, LIFT + 0.004, cz * D * 0.32);
    const knee = new THREE.Vector3(cx * W * 0.55, LIFT * 0.75 + 0.012, cz * D * 0.62);
    const foot = new THREE.Vector3(cx * W * 0.72, 0, cz * D * 0.82);
    legParts.push(part(stick(top, knee, 0.0065, 0.005), solid(LEG)), part(stick(knee, foot, 0.005, 0.0022), solid(LEG)));
    legParts.push(part(new THREE.SphereGeometry(0.0062, 6, 4).translate(knee.x, knee.y, knee.z), solid(LEG)));
    const sp = knee.clone().lerp(foot, 0.4), tip = sp.clone().add(new THREE.Vector3(cx * 0.012, 0.016, cz * 0.012));
    legParts.push(part(stick(sp, tip, 0.0022, 0.0004, 4), solid(SPLINTER)));
    legParts.push(part(stick(foot, foot.clone().add(new THREE.Vector3(-cz * 0.012, 0, cx * 0.012)), 0.0018, 0.0005, 4), solid(SPLINTER)));   // a root toe
  }
  const legs = new THREE.Mesh(mergeGeometries(legParts), mat);
  legs.visible = false;
  g.add(legs);

  // small tendrils curling out from under the base at the corners (they whip: rotation)
  const tendrilParts = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1], [0, 1]]) {
    const o = new THREE.Vector3(sx * W * 0.42, 0.004, sz * D * 0.45), out = new THREE.Vector3(sx || 0.3, 0, sz * 0.6).normalize();
    const pts = [o, o.clone().addScaledVector(out, 0.02).setY(0.012), o.clone().addScaledVector(out, 0.035).setY(0.004), o.clone().addScaledVector(out, 0.045).add(new THREE.Vector3(-out.z * 0.01, 0.018, out.x * 0.01))];
    tendrilParts.push(part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.0016, 4), solid(TENDRIL)));
  }
  const tendrils = new THREE.Mesh(mergeGeometries(tendrilParts), mat);
  tendrils.visible = false;
  body.add(tendrils);

  // the tongue: a fleshy tube, unit length along +z, glowing in the Coffer's hostile colour (set by
  // elites.js); the jewels: amber gems, up to 16 at once
  const tongue = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.8, 1, 10, 6, true).rotateX(Math.PI / 2).translate(0, 0, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xd8506a, roughness: 0.25, emissive: 0xff2a6a, emissiveIntensity: 0.6 }));
  tongue.visible = false;
  tongue.frustumCulled = false;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), tongue.material);   // its tip, the cup that latches on (elites.js sets its size)
  tip.visible = false;
  const jewels = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0).scale(1, 1.4, 1),
    new THREE.MeshStandardMaterial({ color: 0xffa020, emissive: 0xff7a00, emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.2, flatShading: true }), 16);
  jewels.count = 0;
  jewels.frustumCulled = false;

  const state = { lift: 0, gap: 0, jaw: 0 };
  const bpos = bellows.geometry.attributes.position, bt = bellows.geometry.userData.t;
  // where it stands: the box held `lift` up on its legs, the bellows `gap` tall at the back, the lid
  // opened `jaw` rad up from the back hinge (its front edge rises; the bellows follow it)
  function pose(lift, gap, jaw) {
    state.lift = lift; state.gap = gap; state.jaw = jaw;
    body.position.y = lift;
    const k = lift / LIFT;
    legs.visible = k > 0.05;
    legs.scale.setScalar(Math.max(0.001, k));
    tendrils.visible = legs.visible;
    lidPivot.position.set(0, B + gap, -D / 2);
    lidPivot.rotation.set(-jaw, 0, 0);
    lidPivot.scale.setScalar(1);
    lidMesh.position.set(0, 0, 0);
    lidMesh.rotation.set(0, 0, 0);
    arm.visible = false;
    const rise = Math.tan(jaw);
    for (let i = 0; i < bpos.count; i++) bpos.setY(i, bt[i] * (gap + (bpos.getZ(i) + D / 2) * rise));
    bpos.needsUpdate = true;
  }
  // the lid shot out on the arm: its middle at (x, y, z) in the model's frame (y: under the lid),
  // the arm stretching to it from inside the box. Out there it draws in to SHOT_LID of its size,
  // about the size of the Blast it slams down as
  function reach(x, y, z) {
    lidPivot.scale.setScalar(SHOT_LID);
    lidPivot.position.set(x, y - state.lift, z - (D / 2) * SHOT_LID);
    lidPivot.rotation.set(0, 0, 0);
    const sx = 0, sy = B + state.gap * 0.5, sz = 0, dx = x - sx, dy = y - state.lift + L * 0.5 - sy, dz = z - sz, len = Math.hypot(dx, dy, dz);
    arm.visible = len > 0.02;
    arm.position.set(sx, sy, sz);
    arm.rotation.set(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0);
    arm.scale.set(1, 1, Math.max(0.001, len));
  }
  pose(0, 0.002, 0);
  return {
    group: g, body, base: baseMesh, lid: lidMesh, lidPivot, bellows, arm, eyes, legs, tendrils, tongue, tip, jewels, loose: [tongue, tip, jewels], mat,
    pose, reach, gap: () => state.gap, lift: () => state.lift, jaw: () => state.jaw,
    size: { w: W, d: D },
    mouthY: () => state.lift + B + state.gap * 0.5,   // the middle of its mouth, at its front (z = D / 2)
  };
}
