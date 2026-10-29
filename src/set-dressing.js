// Set dressing: detailed replacements for baked apartment pieces that read as flat
// cutouts at jelly height (the TV was 14 triangles, the shower curtain 120). Each
// replacement is built to the baked piece's measured box, the baked piece is hidden,
// and the replacement takes its place in the scene before the collision world is
// built, so it collides and camera-fades exactly like the original — and the stage's
// name-based treatments (traversal.js: the curtain's noCollide and half-fade) find it
// by the same name. Geometry only, merged per material: triangles are cheap at this
// scale, draw calls are not (see the v147 Mug for the same treatment on an elite).
import * as THREE from 'three';
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
function buildTV(box) {
  const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const g = new THREE.Group();
  const panel = new RoundedBoxGeometry(s.x, s.y, 0.03, 3, 0.008).translate(0, 0, 0.012);
  const mount = new THREE.BoxGeometry(s.x * 0.42, s.y * 0.52, 0.022).translate(0, 0, 0.038);
  const body = new THREE.Mesh(merge([paint(panel, 0x0b0b0d), paint(mount, 0x17181a)]),
    std({ roughness: 0.55, metalness: 0.35 }));
  const screen = new THREE.Mesh(new THREE.BoxGeometry(s.x - 0.014, s.y - 0.014, 0.003),
    new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.08, metalness: 0.25, envMapIntensity: 1.6 }));
  screen.position.z = -0.0045;
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.0025, 0.001),
    new THREE.MeshStandardMaterial({ color: 0x1a0505, emissive: 0xff2d1e, emissiveIntensity: 1.6 }));
  led.position.set(s.x / 2 - 0.03, -s.y / 2 + 0.004, -0.006);
  g.add(body, screen, led);
  g.position.copy(c);
  g.position.z -= 0.008;                 // screen front on the baked panel's plane; the mount sinks into the wall
  return g;
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
// horizontal slub streaks the real curtain has. Procedural, like detail.js's maps.
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
// Opaque, like the real fabric: stage2.js used to keep it half see-through, which
// read as a ghost sheet over the tub.
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
    std({ roughness: 0.95, metalness: 0, side: THREE.DoubleSide, normalMap: weave, normalScale: new THREE.Vector2(0.55, 0.55) }));
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

const BUILDERS = [
  ['TV', buildTV],
  ['Soundbar', buildSoundbar],
  ['Shower curtain', buildCurtain],
];

// Hide each baked piece we have a builder for and put the detailed one in its place.
// Call after the layout is applied and before the collision world is built (boot:
// every loaded act is present, since acts reload the page rather than stream in).
// Returns nothing; safe to call again (already-dressed pieces are skipped).
export function dressSet(scene, root) {
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
    const g = build(box);
    g.name = want;                       // stage treatments look pieces up by this name (traversal.js)
    scene.add(g);
  }
}
