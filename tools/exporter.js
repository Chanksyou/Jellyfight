// Bakes the apartment's static physical space into a glTF binary plus a small JSON file:
//  - keeps meshes inside the apartment's rooms (walls, floors, furniture, decor, doors)
//  - drops everything outside (neighborhood, corridor, sky), Dendi, particles, sprites,
//    invisible helpers, and anything the layout has removed
//  - doors become their own nodes ("door-<id>"), exported closed, so a stage can swing them
//  - lighting is captured at the game's hour (midnight) and written to the JSON
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

function inPoly(x, z, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
function distToPoly(x, z, P) {
  let m = Infinity;
  for (let i = 0; i < P.length; i++) {
    const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    m = Math.min(m, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return m;
}
const visibleChain = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
const itemName = (o) => { for (let n = o; n; n = n.parent) if (n.userData.info?.name) return n.userData.info.name; return 'Shell'; };

export async function exportApartment({ mins = 0 } = {}) {
  const APT = window.APT, scene = APT.scene;
  // The viewer hides walls between its camera and the room; its game mode shows them all.
  // Give it a few frames to apply that before baking.
  APT.enterGame();
  for (let i = 0; i < 4; i++) await new Promise((r) => requestAnimationFrame(r));
  // lighting as the game shows it: midnight
  if (window._clk && window._applyClock) { window._clk.play = false; window._clk.mins = mins; window._applyClock(); }
  // doors closed, so each door node's rest pose is "closed"
  for (const d of Object.values(APT.doors)) { d.cur = d.target = 0; d.leaf.rotation.y = 0; }
  scene.updateMatrixWorld(true);

  const rooms = APT.plan.map(([, P]) => P);
  const inside = (x, z, margin = 0.4) => rooms.some((P) => inPoly(x, z, P) || distToPoly(x, z, P) < margin);
  const skip = new Set();
  APT.OUT.traverse((o) => skip.add(o));
  window._cat?.traverse((o) => skip.add(o));
  scene.traverse((o) => {
    const inf = o.userData.info;
    if (inf && (inf.cat || /dendi/i.test(inf.name || ''))) o.traverse((x) => skip.add(x));
  });

  const root = new THREE.Group();
  root.name = 'Apartment';
  const doorOf = new Map(), doors = {};
  for (const [id, d] of Object.entries(APT.doors)) {
    const g = new THREE.Group();
    g.name = 'door-' + id;
    d.leaf.matrixWorld.decompose(g.position, g.quaternion, g.scale);
    root.add(g);
    doors[id] = { node: g, inv: d.leaf.matrixWorld.clone().invert(), open: d.open };
    d.leaf.traverse((o) => doorOf.set(o, id));
  }
  const groups = new Map();
  const groupFor = (name) => {
    if (!groups.has(name)) { const g = new THREE.Group(); g.name = name; root.add(g); groups.set(name, g); }
    return groups.get(name);
  };

  const stats = { kept: 0, outside: 0, hidden: 0 };
  const box = new THREE.Box3(), c = new THREE.Vector3(), s = new THREE.Vector3();
  const mats = new Set();
  scene.traverse((o) => {
    if (!o.isMesh || skip.has(o)) return;
    if (!visibleChain(o)) { stats.hidden++; return; }
    const list = Array.isArray(o.material) ? o.material : [o.material];
    if (list.every((m) => !m || m.colorWrite === false || m.visible === false || (m.transparent && m.opacity < 0.01))) { stats.hidden++; return; }
    box.setFromObject(o);
    if (box.isEmpty()) return;
    box.getCenter(c); box.getSize(s);
    if (c.y < -0.3 || c.y > 3.3 || Math.max(s.x, s.z) > 14 || !inside(c.x, c.z)) { stats.outside++; return; }

    const door = doorOf.get(o);
    const matrix = door ? doors[door].inv.clone().multiply(o.matrixWorld) : o.matrixWorld.clone();
    let m;
    if (o.isInstancedMesh) {
      m = new THREE.InstancedMesh(o.geometry, o.material, o.count);
      m.instanceMatrix.copy(o.instanceMatrix);
      if (o.instanceColor) m.instanceColor = o.instanceColor;
    } else {
      m = new THREE.Mesh(o.geometry, o.material);
    }
    matrix.decompose(m.position, m.quaternion, m.scale);
    m.name = itemName(o);
    (door ? doors[door].node : groupFor(m.name)).add(m);
    list.forEach((x) => x && mats.add(x));
    stats.kept++;
  });

  // Opaque textures go in as JPEG (much smaller); anything with transparency stays PNG
  for (const m of mats) {
    for (const k of ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'bumpMap']) {
      const t = m[k];
      if (t && !t.userData.mimeType) t.userData.mimeType = m.transparent || m.alphaTest > 0 ? 'image/png' : 'image/jpeg';
    }
  }

  // Lights at this hour. Intensities are in the apartment's r128 "legacy" units;
  // the game renders them through src/legacy-lighting.js just like the apartment did.
  const lights = [];
  const wp = (o) => o.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(4));
  scene.traverse((o) => {
    if (!o.isLight || skip.has(o) || !visibleChain(o) || o.intensity <= 0) return;
    const L = { type: o.type, color: o.color.toArray(), intensity: o.intensity, position: wp(o) };
    if (o.isHemisphereLight) L.groundColor = o.groundColor.toArray();
    if (o.isPointLight || o.isSpotLight) { L.distance = o.distance; L.decay = o.decay; }
    if (o.isSpotLight) { L.angle = o.angle; L.penumbra = o.penumbra; }
    if (o.isSpotLight || o.isDirectionalLight) L.target = wp(o.target);
    lights.push(L);
  });
  const envI = [...mats].map((m) => m.envMapIntensity).filter((v) => v !== undefined).sort((a, b) => a - b);

  const glb = await new GLTFExporter().parseAsync(root, { binary: true, maxTextureSize: 2048 });
  let bin = '';
  const bytes = new Uint8Array(glb);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  const meta = {
    note: 'Generated by tools/export.mjs from tools/apartment-source.html. Do not edit by hand.',
    plan: APT.plan,
    doors: Object.fromEntries(Object.entries(doors).map(([id, d]) => [id, { open: d.open }])),
    lights,
    background: scene.background?.toArray?.() || [0.08, 0.1, 0.16],
    envMapIntensity: envI.length ? envI[envI.length >> 1] : 1,
    stats,
  };
  return { glb: btoa(bin), meta };
}
