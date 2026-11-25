// Set dressing: detailed replacements for baked apartment pieces that read as flat
// cutouts at jelly height (the TV was 14 triangles, the shower curtain 120). Each
// replacement is built to the baked piece's measured box, the baked piece is hidden,
// and the replacement takes its place in the scene before the collision world is
// built, so it collides and camera-fades exactly like the original — and the stage's
// name-based treatments (traversal.js: the curtain's noCollide and half-fade) find it
// by the same name. Geometry only, merged per material: triangles are cheap at this
// scale, draw calls are not (see the v147 Mug for the same treatment on an elite).
import * as THREE from 'three';
import { LOOK } from './look.js';
import { AMBIENT } from './ambient.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const paint = (geo, hex) => {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
};
const std = (opts) => new THREE.MeshStandardMaterial({ vertexColors: true, ...opts });
// RoundedBoxGeometry is non-indexed, the primitives it merges with are indexed;
// mergeGeometries refuses a mix, so bring every part to the same (non-indexed) form
const merge = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));

// The wall TV and its soundbar, after the real ones: a near-frameless glossy panel
// on a wall mount, and a slim fabric-fronted bar under it. The front faces -z (the
// room), the wall is at the box's +z face.
function buildTV(box, { screensaver = false } = {}) {
  const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const g = new THREE.Group();
  const panel = new RoundedBoxGeometry(s.x, s.y, 0.03, 3, 0.008).translate(0, 0, 0.012);
  const mount = new THREE.BoxGeometry(s.x * 0.42, s.y * 0.52, 0.022).translate(0, 0, 0.038);
  const body = new THREE.Mesh(merge([paint(panel, 0x0b0b0d), paint(mount, 0x17181a)]),
    std({ roughness: 0.55, metalness: 0.35 }));
  const screen = new THREE.Mesh(new THREE.BoxGeometry(s.x - 0.014, s.y - 0.014, 0.003),
    new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.08, metalness: 0.25, envMapIntensity: 1.6 }));
  screen.position.z = -0.0045;
  if (screensaver) idleScreen(screen.material);
  screen.name = 'TV screen';              // act 4's concert dressing lights it (concert-dressing.js)
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.0025, 0.001),
    new THREE.MeshStandardMaterial({ color: 0x1a0505, emissive: 0xff2d1e, emissiveIntensity: 1.6 }));
  led.position.set(s.x / 2 - 0.03, -s.y / 2 + 0.004, -0.006);
  g.add(body, screen, led);
  g.position.copy(c);
  g.position.z -= 0.008;                 // screen front on the baked panel's plane; the mount sinks into the wall
  return g;
}

// The TV's idle screen: slow drifting colour blobs, a screensaver (the same drift as the pool of light it throws
// on the floor, floor-light.js screenColor). All in the screen's own shader; the clock is the ambient one, so it
// holds still under Reduce effects.
function idleScreen(mat) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { ambientOn: AMBIENT.uniforms.ambientOn, ambientTime: AMBIENT.uniforms.ambientTime,
      idleRate: { value: LOOK.num('floor-light-rate', 0.2094) }, idleGlow: { value: LOOK.num('floor-light-screen', 0.32) } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vScr;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvScr = position.xy;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vScr; uniform float ambientOn, ambientTime, idleRate, idleGlow;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float idleT = ambientOn > 0.5 ? ambientTime : 0.0;
        vec2 idleP = vScr * 2.2;
        float idleBlob = 0.5 + 0.5 * sin(idleP.x * 3.0 + idleT * idleRate * 1.5) * sin(idleP.y * 4.0 - idleT * idleRate);
        vec3 idleCol = 0.5 + 0.5 * cos(idleT * idleRate + vec3(0.0, 2.0, 4.0) + idleP.x + idleP.y * 0.7);
        totalEmissiveRadiance += idleCol * idleBlob * idleGlow;`);
  };
  mat.needsUpdate = true;
}

function buildSoundbar(box) {
  const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const r = Math.min(s.y, s.z) * 0.42;
  const bar = new RoundedBoxGeometry(s.x, s.y, s.z, 4, r);
  const strip = new THREE.BoxGeometry(s.x * 0.96, 0.0015, s.z * 0.4).translate(0, s.y / 2 + 0.0004, 0);
  const mesh = new THREE.Mesh(merge([paint(bar, 0x0f0f12), paint(strip, 0x08080a)]),
    std({ roughness: 0.9, metalness: 0.05 }));
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.002, 0.001),
    new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0xbfd9ff, emissiveIntensity: 1.2 }));
  led.position.set(s.x * 0.32, 0, -s.z / 2 - 0.0006);
  const g = new THREE.Group();
  g.add(mesh, led);
  g.position.copy(c);
  return g;
}

// A woven-fabric normal map for the curtain cloth: fine crosshatch weave plus the
// horizontal slub streaks the real curtain has. Procedural, like the grain in surfaces.js.
function weaveNormalMap() {
  const S = 256, h = new Float32Array(S * S);
  let s = 11;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const slub = Array.from({ length: S }, () => rnd());
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    h[y * S + x] = Math.sin(x * Math.PI / 1.5) * Math.sin(y * Math.PI / 1.5) * 0.5   // the weave
      + (slub[y] - 0.5) * 0.55                                                     // horizontal slub streaks
      + (rnd() - 0.5) * 0.12;                                                      // fibre noise
  }
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = h[y * S + ((x + 1) % S)] - h[y * S + ((x - 1 + S) % S)];
    const dy = h[((y + 1) % S) * S + x] - h[((y - 1 + S) % S) * S + x];
    const i = (y * S + x) * 4, inv = 1 / Math.hypot(dx, dy, 1);
    data[i] = (-dx * inv * 0.5 + 0.5) * 255; data[i + 1] = (-dy * inv * 0.5 + 0.5) * 255; data[i + 2] = inv * 255; data[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, S, S);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// The shower curtain, after the real one: a cream woven sheet gathered on rings,
// deep folds at the top relaxing downward, shading baked into the fold valleys and
// a fringe along the bottom hem. A chrome rod with rings and clips above it.
// The cloth stays see-through so the tub is visible; the chrome hardware stays solid.
function buildCurtain(box) {
  const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const W = s.x, H = s.y, FOLDS = 9, RINGS = 12;
  const fold = (u, v) => {   // z displacement of the sheet at (u across, v down from top)
    const gather = 0.72 + 0.28 * Math.cos(u * RINGS * Math.PI * 2);        // bunched between rings
    const amp = 0.019 * (1 - v * 0.45) * gather;                           // folds relax downward
    return Math.sin(u * FOLDS * Math.PI * 2 + 0.7) * amp + Math.sin(u * 41 + 1.3) * amp * 0.18;
  };
  const cloth = new THREE.PlaneGeometry(W, H, 128, 40);
  {
    const p = cloth.attributes.position, colors = new Float32Array(p.count * 3);
    const base = new THREE.Color(0xefe8d8);
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / W + 0.5, v = 0.5 - p.getY(i) / H;
      const z = fold(u, v);
      p.setZ(i, z);
      const shade = (0.76 + 0.24 * (0.5 + 0.5 * Math.sin(u * FOLDS * Math.PI * 2 + 0.7))) * (1 - v * 0.04);
      colors[i * 3] = base.r * shade; colors[i * 3 + 1] = base.g * shade; colors[i * 3 + 2] = base.b * shade;
    }
    cloth.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    cloth.computeVertexNormals();
  }
  const parts = [cloth];
  // the fringe hem: short strands hanging off the bottom edge, following its folds
  const strand = new THREE.BoxGeometry(0.0016, 1, 0.0008);
  const fringes = [];
  for (let i = 0; i < 110; i++) {
    const u = i / 109, len = 0.02 + 0.013 * ((i * 37 % 10) / 10);
    const f = strand.clone();
    f.scale(1, len, 1);
    f.translate(-W / 2 + u * W, -H / 2 - len / 2 + 0.002, fold(u, 1));
    fringes.push(paint(f, 0xe9e2cf));
  }
  parts.push(...fringes);
  const weave = weaveNormalMap();
  weave.repeat.set(W / 0.15, H / 0.15);   // one weave tile ≈ 15 cm of cloth
  const clothMesh = new THREE.Mesh(merge(parts),
    std({ roughness: 0.95, metalness: 0, side: THREE.DoubleSide, normalMap: weave, normalScale: new THREE.Vector2(0.55, 0.55),
      transparent: true, opacity: LOOK.num('shower-curtain-opacity', 0.25), depthWrite: false }));
  clothMesh.position.set(c.x, c.y, c.z);

  // rod, finials, rings and clips in one chrome mesh
  const chrome = [];
  const rodY = box.max.y + 0.055, rodZ = c.z;
  chrome.push(new THREE.CylinderGeometry(0.0105, 0.0105, W + 0.3, 20).rotateZ(Math.PI / 2).translate(c.x, rodY, rodZ));
  for (const e of [-1, 1]) chrome.push(new THREE.SphereGeometry(0.019, 16, 12).translate(c.x + e * (W / 2 + 0.15), rodY, rodZ));
  for (let i = 0; i < RINGS; i++) {
    const x = c.x - W / 2 + (i + 0.5) * (W / RINGS);
    chrome.push(new THREE.TorusGeometry(0.017, 0.0023, 8, 20).rotateY(Math.PI / 2).translate(x, rodY, rodZ));
    chrome.push(new THREE.CylinderGeometry(0.0016, 0.0016, rodY - box.max.y + 0.012, 6).translate(x, (rodY + box.max.y) / 2 - 0.004, rodZ + fold((i + 0.5) / RINGS, 0) * 0.4));
  }
  const rodMesh = new THREE.Mesh(merge(chrome.map((geo) => paint(geo, 0xd8dde2))),
    std({ roughness: 0.28, metalness: 1.0 }));

  const g = new THREE.Group();
  g.add(clothMesh, rodMesh);
  return g;
}

// The candles (act 1's and act 2's toilet-tank one), opened: the baked ones were closed black tins, so the smoke curling off a wick made no sense.
// An open black glass tumbler with white wax inside, a wick and a small flame (the flame's glow is a status light,
// powered.js, and its smoke a thread: stage1.js). The label (facing -z or +z, as the baked one did) and the soft shadow are drawn here.
const buildCandle = (face, label) => (box, { baked }) => {
  const body = baked.children[0];
  const b = new THREE.Box3().setFromObject(body, true), c = b.getCenter(new THREE.Vector3());
  const r = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2, h = b.max.y - b.min.y, wall = 0.0025, floor = 0.006;
  const waxTop = h - 0.012, wickTop = waxTop + 0.008, flame = 0.016;
  const lathe = (pts, seg = 24) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  const glass = [   // outside up, over the rim, inside down: one open shell
    paint(lathe([[0, 0], [r, 0], [r, h], [r - wall, h], [r - wall, floor], [0, floor]]), 0x0a0a0c),
  ];
  const wax = [paint(lathe([[0, waxTop - 0.006], [r - wall - 0.0004, waxTop - 0.006], [r - wall - 0.0004, waxTop], [0.0035, waxTop], [0.0012, waxTop - 0.0012], [0, waxTop - 0.0012]]), 0xf3eee2)];
  wax.push(paint(new THREE.CylinderGeometry(0.0006, 0.0006, wickTop - waxTop + 0.0015, 6).translate(0, (wickTop + waxTop) / 2 - 0.00075, 0), 0x2a2420));
  const g = new THREE.Group();
  const tumbler = new THREE.Mesh(merge(glass), std({ roughness: 0.55, metalness: 0, side: THREE.DoubleSide }));
  const waxMesh = new THREE.Mesh(merge(wax), std({ roughness: 0.6, metalness: 0 }));
  const fl = new THREE.Mesh(lathe([[0, 0], [0.0035, 0.004], [0.0028, 0.009], [0.0009, 0.0145], [0, flame]], 10),
    new THREE.MeshBasicMaterial({ color: LOOK.color('candle-flame', '#ff8f33'), toneMapped: false }));
  fl.position.y = wickTop - 0.0005;
  g.add(tumbler, waxMesh, fl);
  g.position.set(c.x, b.min.y, c.z);
  // a label on the front and a soft shadow on the surface it stands on, drawn here (the baked ones go with the baked
  // candle; moving or cloning them upset the cat's in-view check, ambient/dendi-breathes)
  const labelH = 1.5 * r, labelW = labelH * 0.8;
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 80;
  const x = cv.getContext('2d'); x.fillStyle = '#f4f2ec'; x.fillRect(0, 0, 64, 80); x.fillStyle = '#111'; x.textAlign = 'center';
  if (label) { x.font = 'bold 12px serif'; x.fillText(label[0], 32, 24); x.font = '6px sans-serif'; x.fillText(label[1], 32, 34); x.font = 'bold 8px sans-serif'; x.fillText(label[2], 32, 64); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(labelW, labelH), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
  lab.position.set(0, h / 2, face * (r + 0.0004)); if (face < 0) lab.rotation.y = Math.PI;
  const sc = document.createElement('canvas'); sc.width = sc.height = 64;
  const sx = sc.getContext('2d'), gr = sx.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  sx.fillStyle = gr; sx.fillRect(0, 0, 64, 64);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(r * 5, r * 5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  sh.position.y = 0.0005;
  g.add(lab, sh);
  return g;
};

// Desktop PC tower on a rolling stand: casters, rounded chassis, front intake louvers,
// side glass window with glowing cooling fans, top power button & front LED strip (3 draws).
function buildPC(box) {
  const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const g = new THREE.Group();
  const baseH = 0.035, towerW = Math.min(s.x * 0.76, 0.22), towerH = Math.max(0.28, s.y - baseH - 0.04), towerD = Math.min(s.z * 0.92, 0.46);
  const baseY = -s.y / 2 + 0.018;
  const parts = [
    paint(new RoundedBoxGeometry(s.x * 0.96, 0.024, s.z * 0.98, 2, 0.005).translate(0, baseY + 0.014, 0), 0x16171b),
    paint(new RoundedBoxGeometry(towerW, towerH, towerD, 3, 0.008).translate(0, baseY + 0.026 + towerH / 2, 0), 0x1e2026),
    paint(new RoundedBoxGeometry(0.09, 0.024, 0.048, 2, 0.004).translate(0, baseY + 0.026 + towerH + 0.012, 0), 0x141519),
  ];
  // 4 rolling casters under stand
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    parts.push(paint(new THREE.CylinderGeometry(0.012, 0.012, 0.014, 10).rotateZ(Math.PI / 2).translate(sx * (s.x * 0.38), baseY - 0.006, sz * (s.z * 0.38)), 0x2c2e34));
  // front horizontal intake louvers (+z and -z so either facing reads cleanly)
  for (let i = 0; i < 6; i++)
    parts.push(paint(new THREE.BoxGeometry(towerW * 0.72, 0.006, towerD + 0.004).translate(0, baseY + 0.1 + i * 0.042, 0), 0x101115));
  // top power button ring
  parts.push(paint(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 12).translate(0, baseY + 0.028 + towerH, towerD * 0.34), 0x4a505e));
  g.add(new THREE.Mesh(merge(parts), std({ roughness: 0.45, metalness: 0.35 })));
  // tinted side glass panel (+x faces room)
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(towerD * 0.78, towerH * 0.78).rotateY(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x0a1018, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.65 }));
  glass.position.set(towerW / 2 + 0.001, baseY + 0.026 + towerH * 0.52, 0);
  // glowing front LED strip + 3 faint internal fan rings visible behind the glass
  const ledParts = [
    new THREE.BoxGeometry(0.005, towerH * 0.65, 0.009).translate(towerW / 2 + 0.002, baseY + 0.026 + towerH * 0.45, -towerD * 0.44),
  ];
  for (let i = 0; i < 3; i++)
    ledParts.push(new THREE.TorusGeometry(0.036, 0.0035, 6, 18).rotateY(Math.PI / 2).translate(towerW / 2 - 0.002, baseY + 0.11 + i * 0.095, -towerD * 0.24));
  const glow = new THREE.Mesh(merge(ledParts), new THREE.MeshStandardMaterial({ color: 0x3a7bff, emissive: 0x3a7bff, emissiveIntensity: 1.5, roughness: 0.2 }));
  g.add(glass, glow);
  g.position.copy(c);
  return g;
}

// Round glass side table: 3 tapered splayed oak legs, brass mounting collars, beveled glass disc (2 draws).
function buildSideTable(box) {
  const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const g = new THREE.Group();
  const r = Math.min(s.x, s.z) / 2, h = s.y, bot = -h / 2;
  const parts = [];
  for (const a of [0, 2.094, 4.189]) {
    const leg = new THREE.CylinderGeometry(0.01, 0.015, h - 0.016, 10);
    leg.rotateZ(-Math.cos(a) * 0.12); leg.rotateX(Math.sin(a) * 0.12);
    leg.translate(Math.cos(a) * r * 0.62, bot + (h - 0.016) / 2, Math.sin(a) * r * 0.62);
    parts.push(paint(leg, 0xb88f60));
    parts.push(paint(new THREE.CylinderGeometry(0.018, 0.014, 0.014, 12).translate(Math.cos(a) * r * 0.56, bot + h - 0.02, Math.sin(a) * r * 0.56), 0xc8a454));
  }
  // subtle cross-brace ring tying legs together
  parts.push(paint(new THREE.TorusGeometry(r * 0.58, 0.006, 6, 24).rotateX(Math.PI / 2).translate(0, bot + h * 0.45, 0), 0x9e784c));
  g.add(new THREE.Mesh(merge(parts), std({ roughness: 0.55, metalness: 0.15 })));
  const topPts = [[0, 0], [r - 0.006, 0], [r, 0.004], [r, 0.01], [r - 0.006, 0.014], [0, 0.014]].map(([x, y]) => new THREE.Vector2(x, y));
  const glass = new THREE.Mesh(new THREE.LatheGeometry(topPts, 32),
    new THREE.MeshStandardMaterial({ color: 0xdceae8, roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.45 }));
  glass.position.y = bot + h - 0.014;
  g.add(glass);
  g.position.copy(c);
  return g;
}

// Double stainless step trash & recycling can: rounded body, recessed base trim, hinged dual lids & foot pedals (1 draw).
function buildTrashCan(box) {
  const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const g = new THREE.Group();
  const w = s.x * 0.88, h = s.y, d = s.z * 0.96, bot = -h / 2;
  const parts = [
    paint(new RoundedBoxGeometry(w, h - 0.045, d, 3, 0.025).translate(0, bot + 0.015 + (h - 0.045) / 2, 0), 0xb8bec4),
    paint(new RoundedBoxGeometry(w + 0.008, 0.022, d + 0.008, 2, 0.006).translate(0, bot + 0.011, 0), 0x222428),
    paint(new RoundedBoxGeometry(w + 0.01, 0.014, d + 0.01, 2, 0.004).translate(0, bot + h - 0.036, 0), 0x2c2e34),
  ];
  for (const sz of [-1, 1]) {
    parts.push(paint(new RoundedBoxGeometry(w * 0.9, 0.028, d * 0.45, 2, 0.012).translate(0, bot + h - 0.016, sz * d * 0.24), 0x383a40));
    parts.push(paint(new THREE.BoxGeometry(0.018, 0.026, 0.095).translate(-w / 2 - 0.002, bot + 0.026, sz * d * 0.24), 0x16171a));
    parts.push(paint(new RoundedBoxGeometry(0.052, 0.016, 0.082, 2, 0.004).rotateZ(0.18).translate(-w / 2 - 0.024, bot + 0.02, sz * d * 0.24), 0xc8ced4));
  }
  g.add(new THREE.Mesh(merge(parts), std({ roughness: 0.34, metalness: 0.65 })));
  g.position.copy(c);
  return g;
}

// Hollow walnut cubby bench: real open cubby cavity with divider, upholstered cream seat pad & tapered legs (1 draw).
function buildCubbyBench(box) {
  const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const g = new THREE.Group();
  const w = s.x, h = s.y, d = s.z, bot = -h / 2, legH = 0.09, bodyH = Math.max(0.2, h - legH - 0.04), t = 0.024;
  const W = 0x5c3c24, W2 = 0x442a18, PAD = 0xe8dfd0;
  const parts = [
    paint(new RoundedBoxGeometry(w, t, d, 2, 0.005).translate(0, bot + legH + bodyH - t / 2, 0), W),            // top board
    paint(new RoundedBoxGeometry(w, t, d, 2, 0.005).translate(0, bot + legH + t / 2, 0), W),                    // bottom board
    paint(new THREE.BoxGeometry(w - 0.01, bodyH - t, t).translate(0, bot + legH + bodyH / 2, -d / 2 + t / 2), W2), // back panel
    paint(new THREE.BoxGeometry(t, bodyH - t, d - 0.005).translate(-w / 2 + t / 2, bot + legH + bodyH / 2, 0), W), // left side
    paint(new THREE.BoxGeometry(t, bodyH - t, d - 0.005).translate(w / 2 - t / 2, bot + legH + bodyH / 2, 0), W),  // right side
    paint(new THREE.BoxGeometry(t * 0.8, bodyH - t, d - 0.02).translate(0, bot + legH + bodyH / 2, -0.005), W2),   // center divider
    paint(new RoundedBoxGeometry(w * 0.96, 0.042, d * 0.94, 3, 0.014).translate(0, bot + legH + bodyH + 0.02, 0), PAD), // seat cushion
  ];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.CylinderGeometry(0.015, 0.01, legH + 0.01, 10);
    leg.rotateZ(-sx * 0.1); leg.rotateX(sz * 0.08);
    leg.translate(sx * (w / 2 - 0.045), bot + legH / 2, sz * (d / 2 - 0.045));
    parts.push(paint(leg, W2));
  }
  g.add(new THREE.Mesh(merge(parts), std({ roughness: 0.62 })));
  g.position.copy(c);
  return g;
}

// Walnut nightstand: overhanging beveled top, proud drawer front with shadow reveal, brass pull & splayed legs (1 draw).
function buildNightstand(box) {
  const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const g = new THREE.Group();
  const w = s.x, h = s.y, d = s.z, bot = -h / 2, legH = 0.09, bodyH = h - legH - 0.022;
  const W = 0x624028, W2 = 0x482d1a, BRASS = 0xd2a84e;
  const parts = [
    paint(new RoundedBoxGeometry(w * 1.04, 0.024, d * 1.04, 2, 0.005).translate(0, bot + h - 0.012, 0), W),          // overhanging top
    paint(new RoundedBoxGeometry(w * 0.96, bodyH, d * 0.94, 2, 0.006).translate(0, bot + legH + bodyH / 2, 0), W),    // carcass
    paint(new RoundedBoxGeometry(w * 0.88, bodyH * 0.34, 0.016, 2, 0.004).translate(0, bot + legH + bodyH * 0.78, d * 0.47), W), // upper drawer
    paint(new RoundedBoxGeometry(w * 0.88, bodyH * 0.52, 0.016, 2, 0.004).translate(0, bot + legH + bodyH * 0.3, d * 0.47), W),  // lower drawer
    paint(new THREE.CylinderGeometry(0.0045, 0.0045, 0.085, 8).rotateZ(Math.PI / 2).translate(0, bot + legH + bodyH * 0.78, d * 0.495), BRASS),
    paint(new THREE.CylinderGeometry(0.0045, 0.0045, 0.085, 8).rotateZ(Math.PI / 2).translate(0, bot + legH + bodyH * 0.36, d * 0.495), BRASS),
  ];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.CylinderGeometry(0.014, 0.009, legH + 0.008, 10);
    leg.rotateZ(-sx * 0.08); leg.rotateX(sz * 0.08);
    leg.translate(sx * (w * 0.4), bot + legH / 2, sz * (d * 0.38));
    parts.push(paint(leg, W2));
  }
  g.add(new THREE.Mesh(merge(parts), std({ roughness: 0.52, metalness: 0.12 })));
  g.position.copy(c);
  return g;
}

// Round bedroom air purifier: tapered lathe body, lower intake grille band, concentric top louvers & status LED (2 draws).
function buildAirPurifier(box) {
  const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const g = new THREE.Group();
  const r = Math.min(s.x, s.z) / 2, h = s.y, bot = -h / 2;
  const pts = [[0, 0], [r * 0.92, 0], [r, 0.015], [r, h * 0.5], [r * 0.94, h * 0.94], [r * 0.86, h], [r * 0.72, h], [r * 0.7, h - 0.02], [0, h - 0.02]].map(([x, y]) => new THREE.Vector2(x, y));
  const parts = [
    paint(new THREE.LatheGeometry(pts, 32).translate(0, bot, 0), 0xf2f0ec),
    paint(new THREE.CylinderGeometry(r * 1.006, r * 1.006, h * 0.42, 32, 1, true).translate(0, bot + h * 0.25, 0), 0x3c3e44),
  ];
  for (const k of [0.22, 0.44, 0.66])
    parts.push(paint(new THREE.TorusGeometry(r * k, 0.005, 6, 24).rotateX(Math.PI / 2).translate(0, bot + h - 0.01, 0), 0x303238));
  g.add(new THREE.Mesh(merge(parts), std({ roughness: 0.42 })));
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshStandardMaterial({ color: 0x48e090, emissive: 0x48e090, emissiveIntensity: 1.8 }));
  led.position.set(0, bot + h - 0.003, r * 0.8);
  g.add(led);
  g.position.copy(c);
  return g;
}

// Tripod bedside floor lamp: tapered walnut legs, brass collar hub, inner bulb/socket/spokes & warm linen drum shade (2 draws).
function buildBedsideLamp(box) {
  const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const g = new THREE.Group();
  const r = Math.min(s.x, s.z) / 2, h = s.y, bot = -h / 2;
  const shadeH = Math.min(0.28, h * 0.26), shadeR = r * 0.76, hubY = bot + h - shadeH - 0.03;
  const parts = [
    paint(new THREE.CylinderGeometry(0.022, 0.026, 0.035, 14).translate(0, hubY, 0), 0xc8a454),                 // brass hub collar
    paint(new THREE.CylinderGeometry(0.012, 0.014, 0.055, 12).translate(0, hubY + 0.04, 0), 0x2a2a2e),          // bulb socket
    paint(new THREE.SphereGeometry(0.028, 12, 8).translate(0, hubY + 0.09, 0), 0xfff4d8),                       // inner bulb
  ];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const legLen = Math.hypot(r * 0.72, hubY - bot);
    const leg = new THREE.CylinderGeometry(0.009, 0.014, legLen, 10);
    const dir = new THREE.Vector3(-Math.cos(a) * r * 0.72, hubY - bot, -Math.sin(a) * r * 0.72).normalize();
    leg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    leg.translate(Math.cos(a) * r * 0.36, (bot + hubY) / 2, Math.sin(a) * r * 0.36);
    parts.push(paint(leg, 0x6b482c));
    // spider spoke holding the drum shade
    const spoke = new THREE.CylinderGeometry(0.0025, 0.0025, shadeR, 6).rotateZ(Math.PI / 2).rotateY(a).translate(Math.cos(a) * shadeR / 2, hubY + 0.04, -Math.sin(a) * shadeR / 2);
    parts.push(paint(spoke, 0xc8a454));
  }
  g.add(new THREE.Mesh(merge(parts), std({ roughness: 0.45, metalness: 0.25 })));
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(shadeR * 0.92, shadeR, shadeH, 32, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xf4ead8, emissive: 0xffe0a8, emissiveIntensity: 0.18, roughness: 0.92, side: THREE.DoubleSide }));
  shade.position.y = bot + h - shadeH / 2;
  g.add(shade);
  g.position.copy(c);
  return g;
}

// Tall leaning floor mirror: 4-piece recessed mitered black frame, rear easel strut & reflective glass (2 draws).
function buildFloorMirror(box) {
  const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const g = new THREE.Group();
  const w = Math.min(s.x, 0.54), h = Math.min(s.y, 1.5), t = 0.028, d = 0.032;
  const parts = [
    paint(new RoundedBoxGeometry(t, h, d, 2, 0.004).translate(-w / 2 + t / 2, 0, 0), 0x16171a),
    paint(new RoundedBoxGeometry(t, h, d, 2, 0.004).translate(w / 2 - t / 2, 0, 0), 0x16171a),
    paint(new RoundedBoxGeometry(w, t, d, 2, 0.004).translate(0, h / 2 - t / 2, 0), 0x16171a),
    paint(new RoundedBoxGeometry(w, t, d, 2, 0.004).translate(0, -h / 2 + t / 2, 0), 0x16171a),
    paint(new THREE.BoxGeometry(w - t * 1.4, h - t * 1.4, 0.008).translate(0, 0, 0.008), 0x202226),
  ];
  const frame = new THREE.Mesh(merge(parts), std({ roughness: 0.42, metalness: 0.35 }));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - t * 2, h - t * 2), new THREE.MeshStandardMaterial({ color: 0xdce4ea, metalness: 0.94, roughness: 0.05 }));
  glass.position.z = -0.008; glass.rotation.y = Math.PI;
  const inner = new THREE.Group(); inner.rotation.x = 0.12; inner.add(frame, glass);
  g.add(inner);
  g.position.copy(c);
  return g;
}

const BUILDERS = [
  ['Candle', buildCandle(-1, ['EMME', 'NEW YORK CITY', 'LYCHEE'])],
  ['Black candle', buildCandle(1, null)],
  ['TV', buildTV],
  ['Soundbar', buildSoundbar],
  ['Shower curtain', buildCurtain],
  ['PC tower', buildPC],
  ['Glass side table', buildSideTable],
  ['Trash and recycling', buildTrashCan],
  ['Cubby bench', buildCubbyBench],
  ['Nightstand', buildNightstand],
  ['Air purifier', buildAirPurifier],
  ['Bedside floor lamp', buildBedsideLamp],
  ['Floor mirror', buildFloorMirror],
];

// the baked pieces it replaces, by node name (the layout editor can't copy these: a copy would be the flat baked one)
export const DRESSED = BUILDERS.map(([name]) => THREE.PropertyBinding.sanitizeNodeName(name));

// Hide each baked piece we have a builder for and put the detailed one in its place.
// Call after the layout is applied and before the collision world is built (boot:
// every loaded act is present, since acts reload the page rather than stream in).
// Returns nothing; safe to call again (already-dressed pieces are skipped).
export function dressSet(scene, root, { tvScreensaver = false } = {}) {
  const app = root.getObjectByName('Apartment') || root;
  // The knit throw's 6 cm fold catches the jelly; keep its texture and hanging sides,
  // but compress the fold above the sheet before the same geometry becomes collision.
  app.traverse((m) => {
    if (!m.isMesh || !/^Bed(?:_\d+)?$/.test(m.parent.name) || !m.material.map || m.userData.smoothedThrow) return;
    m.geometry = m.geometry.clone();
    m.updateMatrix();
    const inverse = m.matrix.clone().invert(), p = new THREE.Vector3();
    const positions = m.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      p.fromBufferAttribute(positions, i).applyMatrix4(m.matrix);
      if (p.y > 0.58) p.y = 0.58 + (p.y - 0.58) * 0.3;
      p.applyMatrix4(inverse);
      positions.setXYZ(i, p.x, p.y, p.z);
    }
    positions.needsUpdate = true;
    m.geometry.computeVertexNormals();
    m.geometry.computeBoundingBox();
    m.geometry.computeBoundingSphere();
    m.userData.smoothedThrow = true;
  });
  for (const [name, build] of BUILDERS) {
    const want = THREE.PropertyBinding.sanitizeNodeName(name);
    const baked = [...app.children].find((o) => o.name === want);
    if (!baked || baked.userData.dressed) continue;
    const box = new THREE.Box3().setFromObject(baked, true);
    if (box.isEmpty()) continue;
    baked.visible = false;
    baked.userData.dressed = true;
    baked.traverse((m) => { if (m.isMesh) m.userData.noCollide = true; });   // not shown, not solid: the replacement is
    const g = build(box, { screensaver: tvScreensaver, baked });
    g.name = want;                       // stage treatments look pieces up by this name (traversal.js)
    scene.add(g);
  }
}
