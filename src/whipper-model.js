// The cream whipper by the front door: a black N2O cylinder (seam band, ribbed rubber boot, "N2O"
// on it) with a brass valve and a chrome regulator carrying two pressure gauges, a braided clear
// hose looping over to a brushed-steel cream whipper with a black collar, its head with the lever,
// the hose connector and the tall chrome charger holder topped by a brass fitting and a nozzle.
// Built in meters facing +z, standing on y = 0; about 38 cm tall. The elite (elites.js, kind
// 'whipper') blows balloons up on the nozzle and swings the gauge needles; the cylinder has the face.
import * as THREE from 'three';
import { angryEyes } from './enemies.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function canvasTex(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// brushed steel: fine streaks down the length
const brushed = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#d4d6da'; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 700; k++) { g.fillStyle = `rgba(${Math.random() < 0.35 ? '90,92,96' : '250,251,253'},${0.04 + Math.random() * 0.08})`; g.fillRect(Math.random() * w, 0, 1, h); }
});
// a pressure gauge face: white dial, a green arc and a red arc, ticks and numbers
const gaugeFace = () => canvasTex(128, 128, (g, w, h) => {
  const C = w / 2;
  g.fillStyle = '#f4f2ec'; g.beginPath(); g.arc(C, C, C, 0, 7); g.fill();
  const arc = (a0, a1, col) => { g.strokeStyle = col; g.lineWidth = 9; g.beginPath(); g.arc(C, C, C * 0.72, a0, a1); g.stroke(); };
  arc(Math.PI * 0.75, Math.PI * 1.45, '#3aa84a'); arc(Math.PI * 1.45, Math.PI * 1.85, '#e8b81a'); arc(Math.PI * 1.85, Math.PI * 2.25, '#d8302a');
  g.strokeStyle = '#1a1a1a'; g.lineWidth = 2;
  for (let k = 0; k <= 20; k++) { const a = Math.PI * 0.75 + k / 20 * Math.PI * 1.5, r0 = C * 0.84, r1 = C * (k % 5 ? 0.78 : 0.7); g.beginPath(); g.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0); g.lineTo(C + Math.cos(a) * r1, C + Math.sin(a) * r1); g.stroke(); }
  g.fillStyle = '#1a1a1a'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  [0, 1, 2, 3, 4].forEach((n, k) => { const a = Math.PI * 0.75 + k / 4 * Math.PI * 1.5; g.fillText(n * 50, C + Math.cos(a) * C * 0.5, C + Math.sin(a) * C * 0.5); });
});
// the cylinder's label: N2O in white
const label = () => canvasTex(128, 64, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#ffffff'; g.font = 'bold 34px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('N2O', w / 2, h / 2);
});
// the braided hose: a clear tube with a white braid crossing it
const braid = () => canvasTex(64, 64, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(240,244,248,.35)'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 3;
  for (let k = -2; k < 4; k++) { g.beginPath(); g.moveTo(k * 22, 0); g.lineTo(k * 22 + 64, 64); g.stroke(); g.beginPath(); g.moveTo(k * 22 + 64, 0); g.lineTo(k * 22, 64); g.stroke(); }
});

export function buildWhipper() {
  const black = new THREE.MeshPhysicalMaterial({ color: 0x18191c, roughness: 0.28, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.15 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1e1f22, roughness: 0.85 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe8eaee, metalness: 1, roughness: 0.12 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 1, roughness: 0.25 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc8cace, map: brushed(), metalness: 0.9, roughness: 0.32 });
  const g = new THREE.Group();
  const add = (geo, mat, parent = g) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; parent.add(m); return m; };

  // --- the N2O cylinder, on the left
  const tank = new THREE.Group();
  tank.position.set(-0.062, 0, 0);
  g.add(tank);
  const R = 0.048;
  add(new THREE.CylinderGeometry(R * 1.06, R * 1.08, 0.045, 32).translate(0, 0.0225, 0), rubber, tank);               // the rubber boot
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; add(new THREE.BoxGeometry(0.012, 0.016, 0.01).translate(Math.sin(a) * R * 1.02, 0.008, Math.cos(a) * R * 1.02).rotateY(0), rubber, tank).rotation.y = a; }   // its feet
  add(new THREE.CylinderGeometry(R, R, 0.2, 40).translate(0, 0.145, 0), black, tank);                                  // the body
  add(new THREE.SphereGeometry(R, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1).translate(0, 0.245, 0), black, tank);   // the shoulder
  add(new THREE.TorusGeometry(R * 1.003, 0.0018, 6, 48).rotateX(Math.PI / 2).translate(0, 0.15, 0), black, tank);       // the seam band
  add(new THREE.TorusGeometry(R * 1.003, 0.0018, 6, 48).rotateX(Math.PI / 2).translate(0, 0.156, 0), black, tank);
  const lab = add(new THREE.CylinderGeometry(R * 1.004, R * 1.004, 0.03, 24, 1, true, -0.55, 1.1).translate(0, 0.075, 0), new THREE.MeshBasicMaterial({ map: label(), transparent: true }), tank);
  lab.rotation.y = 0;
  add(new THREE.CylinderGeometry(0.011, 0.012, 0.022, 16).translate(0, 0.289, 0), brass, tank);                         // the brass valve
  // the regulator: a chrome block, a knob on top, a gauge on each side
  add(new THREE.BoxGeometry(0.03, 0.034, 0.028).translate(0, 0.316, 0), chrome, tank);
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 20).translate(0, 0.343, 0), chrome, tank);
  const faceTex = gaugeFace(), needles = [];
  for (const s of [-1, 1]) {
    const gauge = new THREE.Group();
    gauge.position.set(s * 0.036, 0.322, 0.006);
    gauge.rotation.y = s * 0.5;
    tank.add(gauge);
    add(new THREE.CylinderGeometry(0.006, 0.006, 0.012, 12).rotateZ(Math.PI / 2).translate(-s * 0.008, 0, 0), chrome, tank).position.copy(gauge.position);   // its stem
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 32).rotateX(Math.PI / 2), chrome, gauge);                         // the case
    add(new THREE.TorusGeometry(0.02, 0.0025, 8, 32).translate(0, 0, 0.005), chrome, gauge);                            // the bezel
    add(new THREE.CircleGeometry(0.018, 32).translate(0, 0, 0.0052), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.4 }), gauge);
    add(new THREE.CircleGeometry(0.018, 32).translate(0, 0, 0.0058), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0, clearcoat: 1 }), gauge);   // the glass
    const needle = new THREE.Group();
    needle.position.z = 0.0056;
    add(new THREE.BoxGeometry(0.0014, 0.015, 0.0006).translate(0, 0.006, 0), new THREE.MeshBasicMaterial({ color: 0x1a1a1a }), needle);
    add(new THREE.CircleGeometry(0.002, 12), new THREE.MeshBasicMaterial({ color: 0x1a1a1a }), needle);
    gauge.add(needle);
    needles.push(needle);
  }
  // the face, on the cylinder
  const face = angryEyes({ y: 0, z: 0, size: 0.34, gap: 0.42 });
  face.scale.setScalar(0.04);
  face.position.set(0, 0.2, R + 0.002);
  tank.add(face);

  // --- the cream whipper, on the right
  const whip = new THREE.Group();
  whip.position.set(0.062, 0, 0.01);
  g.add(whip);
  const prof = [[0, 0], [0.04, 0], [0.042, 0.004], [0.044, 0.06], [0.047, 0.15], [0.05, 0.2], [0.048, 0.205], [0, 0.205]].map(([x, y]) => new THREE.Vector2(x, y));
  add(new THREE.LatheGeometry(prof, 40), steel, whip);
  add(new THREE.CylinderGeometry(0.053, 0.053, 0.028, 40).translate(0, 0.218, 0), black, whip);                         // the black collar
  add(new THREE.CylinderGeometry(0.044, 0.05, 0.012, 32).translate(0, 0.238, 0), chrome, whip);                         // the head
  add(new THREE.SphereGeometry(0.03, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1).translate(0, 0.244, 0), chrome, whip);
  // the lever: a curved handle over the head and down the side
  const lever = new THREE.Shape();
  lever.moveTo(0, 0); lever.quadraticCurveTo(0.03, 0.03, 0.06, 0.012); lever.lineTo(0.07, -0.06); lever.lineTo(0.062, -0.062); lever.lineTo(0.052, 0.004); lever.quadraticCurveTo(0.03, 0.018, 0, -0.008); lever.closePath();
  const lv = add(new THREE.ExtrudeGeometry(lever, { depth: 0.008, bevelEnabled: true, bevelSize: 0.001, bevelThickness: 0.001, bevelSegments: 1 }).translate(0, 0, -0.004), chrome, whip);
  lv.position.set(0.004, 0.262, 0);
  // the hose connector, angled up on the left side of the head
  const conn = new THREE.Group();
  conn.position.set(-0.022, 0.256, 0);
  conn.rotation.z = 0.55;
  whip.add(conn);
  add(new THREE.CylinderGeometry(0.008, 0.009, 0.03, 16).translate(0, 0.015, 0), chrome, conn);
  add(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 6).translate(0, 0.006, 0), black, conn);
  // the tall charger holder going up to the right, with a brass fitting and the nozzle on top
  const holder = new THREE.Group();
  holder.position.set(0.018, 0.262, 0);
  holder.rotation.z = -0.38;
  whip.add(holder);
  add(new THREE.CylinderGeometry(0.0055, 0.0055, 0.03, 12).translate(0, 0.015, 0), brass, holder);
  add(new THREE.CylinderGeometry(0.017, 0.017, 0.055, 28).translate(0, 0.055, 0), chrome, holder);
  add(new THREE.CylinderGeometry(0.017, 0.012, 0.01, 28).translate(0, 0.087, 0), chrome, holder);
  add(new THREE.CylinderGeometry(0.009, 0.009, 0.016, 6).translate(0, 0.099, 0), brass, holder);
  add(new THREE.CylinderGeometry(0.003, 0.0075, 0.03, 16).translate(0, 0.122, 0), chrome, holder);                      // the nozzle
  const tip = new THREE.Object3D();
  tip.position.y = 0.137;
  holder.add(tip);

  // --- the braided hose: from the regulator, up in a loop, down into the connector
  const hosePts = [V(-0.03, 0.33, 0.01), V(0.0, 0.37, 0.03), V(0.05, 0.4, 0.02), V(0.07, 0.38, -0.01), V(0.02, 0.34, -0.02), V(-0.01, 0.31, 0.0), V(0.02, 0.29, 0.01), V(0.035, 0.28, 0.01)];
  const bt = braid();
  bt.wrapS = bt.wrapT = THREE.RepeatWrapping;
  bt.repeat.set(24, 2);
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hosePts), 64, 0.0065, 10), new THREE.MeshPhysicalMaterial({ map: bt, transparent: true, roughness: 0.25, clearcoat: 1, depthWrite: false }));
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hosePts), 64, 0.0028, 6), new THREE.MeshStandardMaterial({ color: 0xd8dde4, transparent: true, opacity: 0.5 }));   // the inner line

  return { group: g, tip, needles, face, lever: lv, whip, tank };
}

// A latex party balloon, `R` across at its widest, its knot at the origin and the balloon above
// it, a curled ribbon hanging below. The colour is set per balloon.
const BALLOON_GEO = {};
export function buildBalloon(color = 0xb05aff) {
  BALLOON_GEO.body ||= (() => {
    const pts = [];
    for (let k = 0; k <= 24; k++) { const t = k / 24, a = t * Math.PI; pts.push(new THREE.Vector2(Math.sin(a) * (0.5 + 0.5 * Math.sin(a * 0.5 + 0.5)) * 0.5 + 0.0001, (1 - Math.cos(a)) * 0.6)); }
    return new THREE.LatheGeometry(pts, 32);
  })();
  BALLOON_GEO.knot ||= new THREE.ConeGeometry(0.08, 0.1, 12).rotateX(Math.PI).translate(0, -0.02, 0);
  BALLOON_GEO.ribbon ||= new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, -0.05, 0), V(0.06, -0.3, 0.02), V(-0.05, -0.55, -0.02), V(0.04, -0.8, 0.01), V(0, -1.05, 0)]), 32, 0.008, 4);
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true, opacity: 0.9, emissive: color, emissiveIntensity: 0.25 });
  const g = new THREE.Group();
  const body = new THREE.Mesh(BALLOON_GEO.body, mat);
  const knot = new THREE.Mesh(BALLOON_GEO.knot, mat);
  const ribbon = new THREE.Mesh(BALLOON_GEO.ribbon, new THREE.MeshStandardMaterial({ color: 0xf4f0ff, roughness: 0.5 }));
  g.add(body, knot, ribbon);
  return { group: g, body, ribbon, mat };
}
