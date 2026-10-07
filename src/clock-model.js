// The ornate wall clock in the hallway (a cartel clock in dark bronze): Victory standing in an
// arched niche on top, a laurel wreath raised in one hand and a horn in the other; a round dial
// with gilt Roman numerals and pierced gilt hands inside a laurel garland; a bearded mask with
// acanthus wings under the dial; a tapering lattice pedestal and an acanthus drop at the bottom;
// a ring to hang it by at the top. Built in meters facing +z, its back flat at z = 0 (the wall),
// its bottom at y = 0. About 1.07 m tall. The elite (elites.js, kind 'clock') animates its hands,
// the wreath and the horn; the mask is its face.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { angryEyes } from './enemies.js';

export const CLOCK = { H: 1.07, dialY: 0.36, dialR: 0.1, maskY: 0.205 };

const rand = (() => { let s = 7; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 >>> 0) / 4294967296); })();
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// dark bronze with a worn brown patina (lighter where hands rubbed it), and gilt for the dial work
function bronzeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2c241a'; g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 2200; k++) {
    const v = rand();
    g.fillStyle = v < 0.5 ? `rgba(18,14,10,${0.25 + rand() * 0.35})` : v < 0.85 ? `rgba(70,56,36,${0.2 + rand() * 0.3})` : `rgba(110,88,52,${0.25 + rand() * 0.3})`;
    g.beginPath(); g.arc(rand() * 256, rand() * 256, 0.5 + rand() * 2.4, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// the dial: an engraved chapter ring with gilt Roman numerals, a pierced rosette in the middle
function dialTexture() {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), C = S / 2;
  const bg = g.createRadialGradient(C, C, 20, C, C, C); bg.addColorStop(0, '#30261a'); bg.addColorStop(1, '#1a140e');
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  // engraved rings
  g.strokeStyle = 'rgba(150,120,70,.55)';
  for (const r of [0.97, 0.94, 0.66, 0.63, 0.3]) { g.lineWidth = 2; g.beginPath(); g.arc(C, C, r * C, 0, 7); g.stroke(); }
  // minute ticks between the two outer rings
  g.strokeStyle = 'rgba(200,160,80,.7)';
  for (let k = 0; k < 60; k++) { const a = k / 60 * Math.PI * 2, r0 = 0.94 * C, r1 = (k % 5 ? 0.9 : 0.87) * C; g.lineWidth = k % 5 ? 2 : 4; g.beginPath(); g.moveTo(C + Math.sin(a) * r0, C - Math.cos(a) * r0); g.lineTo(C + Math.sin(a) * r1, C - Math.cos(a) * r1); g.stroke(); }
  // Roman numerals, standing on the ring with their feet toward the middle
  const N = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  g.fillStyle = '#e8b84a'; g.font = 'bold 56px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  N.forEach((n, k) => { const a = k / 12 * Math.PI * 2; g.save(); g.translate(C + Math.sin(a) * 0.78 * C, C - Math.cos(a) * 0.78 * C); g.rotate(a); g.scale(0.62, 1); g.fillText(n, 0, 0); g.restore(); });
  // the pierced rosette: scrolls and leaves round the arbor
  g.strokeStyle = 'rgba(160,125,70,.7)'; g.lineWidth = 5;
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2;
    g.beginPath(); g.ellipse(C + Math.sin(a) * 0.36 * C, C - Math.cos(a) * 0.36 * C, 0.2 * C, 0.07 * C, a + Math.PI / 2, 0, 7); g.stroke();
  }
  g.fillStyle = 'rgba(160,125,70,.5)';
  for (let k = 0; k < 16; k++) { const a = (k + 0.5) / 16 * Math.PI * 2; g.beginPath(); g.arc(C + Math.sin(a) * 0.52 * C, C - Math.cos(a) * 0.52 * C, 7, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// the lattice behind Victory and on the pedestal: a pierced honeycomb
function latticeTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0c0907'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#4a3c28'; g.lineWidth = 3;
  const r = 10, w = r * Math.sqrt(3);
  for (let row = -1; row < 9; row++) for (let col = -1; col < 9; col++) {
    const x = col * w + (row % 2 ? w / 2 : 0), y = row * r * 1.5;
    g.beginPath();
    for (let k = 0; k <= 6; k++) { const a = k / 6 * Math.PI * 2 + Math.PI / 6; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// a leaf (laurel or acanthus) as a thin bent shape: length L along +y, width W
function leafGeo(L, W, curl = 0.2, lobes = 0) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  if (!lobes) { s.quadraticCurveTo(W, L * 0.45, 0, L); s.quadraticCurveTo(-W, L * 0.45, 0, 0); }
  else {
    // acanthus: a scalloped edge
    const n = lobes, pts = [];
    for (let k = 0; k <= n; k++) pts.push([W * (0.6 + 0.4 * Math.sin((k / n) * Math.PI)) * (k % 2 ? 0.75 : 1), L * k / n]);
    for (const [x, y] of pts) s.lineTo(x * Math.sin(Math.PI * (y / L) * 0.95 + 0.1), y);
    for (const [x, y] of pts.reverse()) s.lineTo(-x * Math.sin(Math.PI * (y / L) * 0.95 + 0.1), y);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.0012, bevelEnabled: false, curveSegments: 6 });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i); p.setZ(i, p.getZ(i) + Math.sin((y / L) * Math.PI) * curl * L - Math.abs(x) * 0.6); }
  g.computeVertexNormals();
  return g;
}
const place = (geo, at, rot = [0, 0, 0], s = 1) => geo.clone().scale(s, s, s).rotateX(rot[0]).rotateY(rot[1]).rotateZ(rot[2]).translate(at.x, at.y, at.z);
const scroll = (r, tube, arc, at, rot) => place(new THREE.TorusGeometry(r, tube, 8, 24, arc), at, rot);
const tube = (pts, r, n = 24) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, r, 6);
const lathe = (pts, at, seg = 20) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg).translate(at.x, at.y, at.z);
// a box tapering from width w0 at the bottom to w1 at the top
function taper(w0, w1, h, d) {
  const g = new THREE.BoxGeometry(1, h, d, 1, 1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = (p.getY(i) + h / 2) / h; p.setX(i, p.getX(i) * (w0 + (w1 - w0) * k)); }
  g.computeVertexNormals();
  return g;
}

export function buildClock() {
  const tex = bronzeTexture();
  const bronze = new THREE.MeshStandardMaterial({ color: 0xc09a70, map: tex, metalness: 0.5, roughness: 0.45 });
  const darkBronze = new THREE.MeshStandardMaterial({ color: 0x8a7054, map: tex, metalness: 0.45, roughness: 0.55 });
  const statueBronze = new THREE.MeshStandardMaterial({ color: 0xd8a878, map: tex, metalness: 0.55, roughness: 0.32 });
  const gilt = new THREE.MeshStandardMaterial({ color: 0xe0b048, metalness: 0.95, roughness: 0.28, emissive: 0x3a2400, emissiveIntensity: 0.6 });
  const lattice = latticeTexture();
  const latticeMat = (rx, ry) => { const t = lattice.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, metalness: 0.4, roughness: 0.6, color: 0xbba080 }); };

  const g = new THREE.Group();
  const add = (geo, mat, parent = g) => { const m = new THREE.Mesh(geo, mat); parent.add(m); return m; };
  const B = [], D = [];      // merged bronze / dark bronze parts

  // --- the acanthus drop at the bottom
  B.push(lathe([[0, 0], [0.005, 0.006], [0.012, 0.016], [0.015, 0.03], [0.011, 0.042], [0.016, 0.05], [0.02, 0.056], [0, 0.058]], V(0, 0, 0.022)));
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; B.push(place(leafGeo(0.04, 0.012, 0.3, 5), V(Math.sin(a) * 0.012, 0.012, 0.022 + Math.cos(a) * 0.012), [-0.3, a, 0])); }
  // --- the tapering pedestal with its lattice front and a scroll cartouche at the foot
  D.push(taper(0.065, 0.115, 0.1, 0.03).translate(0, 0.108, 0.015));
  add(new THREE.PlaneGeometry(1, 1).scale(0.075, 0.08, 1).translate(0, 0.108, 0.0305), latticeMat(1.2, 1.3));
  B.push(scroll(0.012, 0.0045, Math.PI * 1.6, V(-0.03, 0.068, 0.034), [0, 0, 0.6]), scroll(0.012, 0.0045, Math.PI * 1.6, V(0.03, 0.068, 0.034), [0, Math.PI, 0.6]));
  B.push(new THREE.BoxGeometry(0.1, 0.008, 0.036).translate(0, 0.06, 0.018), new THREE.BoxGeometry(0.125, 0.01, 0.038).translate(0, 0.158, 0.019));
  // --- the mask: a bearded face between acanthus wings (the elite's face: angry eyes go on it)
  B.push(new THREE.SphereGeometry(1, 24, 18).scale(0.033, 0.042, 0.022).translate(0, CLOCK.maskY, 0.04));             // the face
  B.push(new THREE.SphereGeometry(1, 16, 10).scale(0.03, 0.009, 0.012).translate(0, CLOCK.maskY + 0.018, 0.058));      // the heavy brow
  B.push(new THREE.ConeGeometry(0.007, 0.022, 10).rotateX(-0.25).translate(0, CLOCK.maskY + 0.002, 0.064));               // the nose
  for (let k = 0; k < 9; k++) {                                                                                         // beard and moustache curls
    const x = (k - 4) * 0.0075, y = CLOCK.maskY - 0.02 - Math.abs(k - 4) * -0.002;
    B.push(tube([V(x, y + 0.008, 0.058), V(x * 1.2, y - 0.01, 0.06), V(x * 0.8, y - 0.03 - (4 - Math.abs(k - 4)) * 0.004, 0.052)], 0.0035, 10));
  }
  for (const s of [-1, 1]) {
    B.push(tube([V(s * 0.004, CLOCK.maskY - 0.008, 0.062), V(s * 0.02, CLOCK.maskY - 0.012, 0.06), V(s * 0.03, CLOCK.maskY - 0.002, 0.052)], 0.0035, 10));   // moustache
    for (let k = 0; k < 4; k++) B.push(place(leafGeo(0.07 - k * 0.008, 0.016, 0.3, 7), V(s * 0.03, CLOCK.maskY + 0.01, 0.035), [0.2, 0, s * (-1.1 - k * 0.35)]));   // acanthus wings
    B.push(scroll(0.022, 0.006, Math.PI * 1.5, V(s * 0.09, 0.245, 0.03), [0, s > 0 ? Math.PI : 0, -0.4]));             // the big scroll brackets under the dial
  }
  // --- the dial: a deep round case in a laurel garland, the engraved dial and pierced gilt hands
  D.push(new THREE.CylinderGeometry(0.118, 0.118, 0.03, 48).rotateX(Math.PI / 2).translate(0, CLOCK.dialY, 0.015));
  B.push(new THREE.TorusGeometry(0.106, 0.009, 10, 64).translate(0, CLOCK.dialY, 0.032));                             // the bezel
  B.push(new THREE.TorusGeometry(0.1, 0.004, 8, 64).translate(0, CLOCK.dialY, 0.036));
  for (let k = 0; k < 64; k++) B.push(new THREE.SphereGeometry(0.0028, 6, 4).translate(Math.sin(k / 64 * Math.PI * 2) * 0.115, CLOCK.dialY + Math.cos(k / 64 * Math.PI * 2) * 0.115, 0.03));   // beading
  const leaf = leafGeo(0.03, 0.011, 0.25);
  for (const [r, n, z] of [[0.122, 64, 0.024], [0.134, 56, 0.02]]) for (let k = 0; k < n; k++) {   // the garland: two rows of laurel leaves lying along it, berries
    const a = (k / n) * Math.PI * 2, side = k % 2 ? 1 : -1;
    const at = V(Math.sin(a) * r, CLOCK.dialY + Math.cos(a) * r, z);
    B.push(place(leaf, at, [0.25, 0, -a - Math.PI / 2 + side * 0.45], 1));
    if (k % 4 === 0 && r < 0.13) B.push(new THREE.SphereGeometry(0.004, 6, 5).translate(Math.sin(a + 0.04) * (r + 0.006), CLOCK.dialY + Math.cos(a + 0.04) * (r + 0.006), z + 0.008));
  }
  add(new THREE.CircleGeometry(CLOCK.dialR, 64).translate(0, CLOCK.dialY, 0.0335), new THREE.MeshStandardMaterial({ map: dialTexture(), metalness: 0.5, roughness: 0.45 }));
  // the crest on top of the dial (a shell and scrolls) that Victory stands on
  B.push(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.04, 0.025, 0.018).translate(0, 0.468, 0.022));
  for (const s of [-1, 1]) B.push(scroll(0.014, 0.005, Math.PI * 1.4, V(s * 0.045, 0.47, 0.026), [0, s > 0 ? Math.PI : 0, 0.3]));
  // hands: the hour and minute hands, pierced and scrolled, gilt; pivots at the dial centre
  const handShape = (len, w) => {
    const s = new THREE.Shape();
    s.moveTo(-w * 0.4, -len * 0.18); s.lineTo(w * 0.4, -len * 0.18); s.lineTo(w * 0.35, len * 0.35);
    s.absarc(0, len * 0.45, w * 1.1, -0.4, Math.PI + 0.4, false);        // the scrolled loop
    s.lineTo(-w * 0.35, len * 0.35); s.closePath();
    const tip = new THREE.Shape(); tip.moveTo(-w * 0.35, len * 0.55); tip.lineTo(w * 0.35, len * 0.55); tip.lineTo(0, len); tip.closePath();
    return mergeGeometries([new THREE.ExtrudeGeometry(s, { depth: 0.0015, bevelEnabled: false }), new THREE.ExtrudeGeometry(tip, { depth: 0.0015, bevelEnabled: false })]);
  };
  const hourHand = add(handShape(0.058, 0.008), gilt); hourHand.position.set(0, CLOCK.dialY, 0.036);
  const minuteHand = add(handShape(0.088, 0.0065), gilt); minuteHand.position.set(0, CLOCK.dialY, 0.0378);
  add(new THREE.CylinderGeometry(0.006, 0.006, 0.006, 16).rotateX(Math.PI / 2).translate(0, CLOCK.dialY, 0.04), gilt);   // the arbor

  // --- the upper column: a back plate, the lattice niche with an arched head, fluted pilasters
  D.push(new THREE.BoxGeometry(0.13, 0.4, 0.022).translate(0, 0.67, 0.011));
  add(new THREE.PlaneGeometry(0.086, 0.34).translate(0, 0.66, 0.0225), latticeMat(1.2, 4.5));
  B.push(new THREE.TorusGeometry(0.043, 0.005, 8, 24, Math.PI).translate(0, 0.83, 0.024));                         // the niche's arch
  for (const s of [-1, 1]) {
    B.push(new THREE.BoxGeometry(0.018, 0.37, 0.03).translate(s * 0.057, 0.66, 0.015));                              // pilaster
    for (let f = -1; f <= 1; f++) B.push(new THREE.CylinderGeometry(0.0018, 0.0018, 0.33, 6).translate(s * 0.057 + f * 0.005, 0.66, 0.031));   // fluting
    for (let k = 0; k < 22; k++) B.push(new THREE.SphereGeometry(0.002, 5, 4).translate(s * 0.045, 0.49 + k * 0.016, 0.024));   // bead moulding
    B.push(scroll(0.016, 0.006, Math.PI * 1.5, V(s * 0.072, 0.495, 0.026), [0, s > 0 ? Math.PI : 0, 0.8]));          // volutes at the column's foot
    B.push(scroll(0.012, 0.005, Math.PI * 1.5, V(s * 0.06, 0.84, 0.03), [0, s > 0 ? Math.PI : 0, -0.6]));             // capitals
  }
  // the cornice: stepped mouldings with dentils, an arched pediment, the ribbon bow and the ring
  B.push(new THREE.BoxGeometry(0.16, 0.012, 0.036).translate(0, 0.86, 0.018), new THREE.BoxGeometry(0.15, 0.008, 0.04).translate(0, 0.872, 0.02));
  for (let k = 0; k < 14; k++) B.push(new THREE.BoxGeometry(0.006, 0.006, 0.006).translate(-0.065 + k * 0.01, 0.851, 0.036));
  D.push(new THREE.CylinderGeometry(0.06, 0.06, 0.024, 32, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).rotateZ(-Math.PI / 2).translate(0, 0.876, 0.012));
  B.push(new THREE.TorusGeometry(0.06, 0.006, 8, 32, Math.PI).translate(0, 0.876, 0.026));
  for (const s of [-1, 1]) {
    B.push(tube([V(0, 0.93, 0.03), V(s * 0.02, 0.945, 0.034), V(s * 0.04, 0.925, 0.03), V(s * 0.05, 0.9, 0.026)], 0.005));   // ribbon
    for (let k = 0; k < 3; k++) B.push(place(leafGeo(0.03, 0.01, 0.3, 4), V(s * 0.03, 0.905, 0.03), [0.3, 0, s * (-0.5 - k * 0.5)]));
    B.push(lathe([[0, 0], [0.009, 0.004], [0.012, 0.012], [0.006, 0.02], [0, 0.022]], V(s * 0.07, 0.885, 0.02), 12));   // urn finials
  }
  B.push(new THREE.BoxGeometry(0.024, 0.026, 0.02).translate(0, 0.94, 0.02));                                         // the knot under the ring
  B.push(new THREE.TorusGeometry(0.034, 0.008, 12, 40).translate(0, 1.0, 0.012));                                     // the hanging ring

  // --- Victory in the niche: draped robe, raised arm with the laurel wreath, the horn in her other hand
  const vic = new THREE.Group();
  vic.position.set(0, 0.48, 0.04);
  g.add(vic);
  // the robe: full at the hem, gathered at the waist, over the hips and bust; one leg forward
  const robe = lathe([[0.024, 0], [0.03, 0.012], [0.028, 0.06], [0.024, 0.13], [0.022, 0.18], [0.017, 0.21], [0.022, 0.25], [0.02, 0.275], [0.012, 0.292], [0, 0.296]], V(0, 0, 0), 28);
  const rp = robe.attributes.position;
  for (let i = 0; i < rp.count; i++) {                                                                                 // drapery folds, deeper toward the hem
    const x = rp.getX(i), z = rp.getZ(i), y = rp.getY(i), a = Math.atan2(z, x), k = 1 + Math.sin(a * 7 + y * 40) * 0.1 * (1 - y / 0.3);
    rp.setXYZ(i, x * k * 1.1, y, z * k * 0.7);
  }
  robe.computeVertexNormals();
  const parts = [robe];
  parts.push(new THREE.SphereGeometry(1, 16, 12).scale(0.026, 0.012, 0.016).translate(0, 0.288, 0.002));              // shoulders
  parts.push(new THREE.CylinderGeometry(0.006, 0.007, 0.016, 10).translate(0, 0.303, 0));                              // neck
  parts.push(new THREE.SphereGeometry(1, 16, 12).scale(0.012, 0.014, 0.013).translate(0.002, 0.322, 0.003));           // head, turned a little up
  parts.push(new THREE.SphereGeometry(0.008, 10, 8).translate(0, 0.33, -0.008));                                       // hair bun
  parts.push(new THREE.TorusGeometry(0.011, 0.002, 6, 16).rotateX(Math.PI / 2).translate(0.001, 0.33, 0.002));         // a fillet in her hair
  parts.push(tube([V(-0.022, 0.29, 0.002), V(-0.034, 0.34, 0.006), V(-0.044, 0.4, 0.01), V(-0.054, 0.46, 0.012)], 0.0058));   // the raised right arm
  parts.push(new THREE.SphereGeometry(0.0055, 8, 6).translate(-0.055, 0.465, 0.012));                                  // her hand
  parts.push(tube([V(0.022, 0.29, 0.002), V(0.032, 0.25, 0.008), V(0.036, 0.205, 0.016)], 0.0055));                     // the left arm, down
  parts.push(tube([V(0.02, 0.27, 0.014), V(0.036, 0.19, 0.02), V(0.03, 0.1, 0.016), V(0.04, 0.02, 0.012)], 0.0045));    // a fold of drapery falling from her arm
  parts.push(tube([V(-0.02, 0.24, 0.012), V(-0.032, 0.15, 0.02), V(-0.026, 0.05, 0.018)], 0.004));
  parts.push(tube([V(-0.012, 0.21, 0.02), V(-0.004, 0.12, 0.026), V(0.008, 0.03, 0.024)], 0.0035));                   // the forward leg under the drapery
  add(mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p))), statueBronze, vic);
  const wreath = new THREE.Group();                                                                                   // the wreath she holds up (thrown as an attack)
  wreath.position.set(-0.058, 0.49, 0.012);
  const W = [new THREE.TorusGeometry(0.024, 0.003, 6, 24)];
  for (let k = 0; k < 26; k++) { const a = (k / 26) * Math.PI * 2; W.push(place(leafGeo(0.014, 0.005, 0.2), V(Math.sin(a) * 0.025, Math.cos(a) * 0.025, 0), [0, 0, -a - Math.PI / 2 + (k % 2 ? 0.5 : -0.5)])); }
  add(mergeGeometries(W.map((p) => (p.index ? p.toNonIndexed() : p))), statueBronze, wreath);
  vic.add(wreath);
  const horn = new THREE.Group();
  horn.position.set(0.037, 0.2, 0.018);
  add(lathe([[0.002, 0], [0.0025, 0.05], [0.005, 0.1], [0.011, 0.125], [0.018, 0.132], [0.016, 0.134]], V(0, 0, 0), 16), statueBronze, horn).rotation.z = -0.35;   // a long herald's trumpet
  vic.add(horn);

  add(mergeGeometries(B.map((p) => { const q = p.index ? p.toNonIndexed() : p; if (q.attributes.uv === undefined) q.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2)); return q; })), bronze);
  add(mergeGeometries(D.map((p) => (p.index ? p.toNonIndexed() : p))), darkBronze);

  // the elite's face: angry eyes in the mask
  const face = angryEyes({ y: 0, z: 0, size: 0.34, gap: 0.42 });
  face.scale.setScalar(0.034);
  face.position.set(0, CLOCK.maskY + 0.008, 0.062);
  g.add(face);
  return { group: g, hourHand, minuteHand, wreath, horn, face, gilt };
}
