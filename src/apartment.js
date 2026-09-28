// Loads the baked apartment (assets/apartment.glb + assets/apartment.json, made by
// tools/export.mjs) and sets up its lighting. The apartment is static: geometry,
// materials and textures, plus door nodes a stage can swing open or shut.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function loadApartment(scene, renderer, onProgress) {
  // The small file needs a WebAssembly decoder; if WebAssembly is blocked, load the plain one
  let file = 'assets/apartment.glb', decoder = null;
  try {
    ({ MeshoptDecoder: decoder } = await import('three/addons/libs/meshopt_decoder.module.js'));
    await decoder.ready;
  } catch {
    file = 'assets/apartment-q.glb';
    decoder = null;
  }
  const loader = new GLTFLoader();
  if (decoder) loader.setMeshoptDecoder(decoder);
  const [gltf, meta] = await Promise.all([
    loader.loadAsync(file, (e) => e.total && onProgress?.(e.loaded / e.total)),
    fetch('assets/apartment.json').then((r) => r.json()),
  ]);
  const root = gltf.scene;
  scene.add(root);
  const unpacked = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    // The file stores positions as packed integers (smaller download). The collision BVH
    // needs plain floats, so unpack them once here (shared geometry only once).
    const pos = o.geometry.attributes.position;
    if (pos && !(pos.array instanceof Float32Array) && !unpacked.has(o.geometry)) {
      const f = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { f[i * 3] = pos.getX(i); f[i * 3 + 1] = pos.getY(i); f[i * 3 + 2] = pos.getZ(i); }
      o.geometry.setAttribute('position', new THREE.BufferAttribute(f, 3));
      o.geometry.computeBoundingBox();
      o.geometry.computeBoundingSphere();
      unpacked.add(o.geometry);
    }
    o.receiveShadow = true;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if ('envMapIntensity' in m) m.envMapIntensity = meta.envMapIntensity;
  });

  // Lights, as captured at midnight. Intensities are in the apartment's legacy units;
  // src/legacy-lighting.js renders them the way the apartment did.
  const color = (c) => new THREE.Color().fromArray(c);
  for (const L of meta.lights) {
    let light;
    if (L.type === 'HemisphereLight') light = new THREE.HemisphereLight(color(L.color), color(L.groundColor), L.intensity);
    else if (L.type === 'PointLight') light = new THREE.PointLight(color(L.color), L.intensity, L.distance, L.decay);
    else if (L.type === 'SpotLight') light = new THREE.SpotLight(color(L.color), L.intensity, L.distance, L.angle, L.penumbra, L.decay);
    else if (L.type === 'DirectionalLight') light = new THREE.DirectionalLight(color(L.color), L.intensity);
    else if (L.type === 'AmbientLight') light = new THREE.AmbientLight(color(L.color), L.intensity);
    if (!light) continue;
    light.position.fromArray(L.position);
    if (L.target) { light.target.position.fromArray(L.target); scene.add(light.target); }
    scene.add(light);
  }
  scene.background = color(meta.background);
  scene.environment = roomEnvironment(renderer);

  // Doors: node rotated about its own Y from the closed pose
  const doors = {};
  root.traverse((o) => {
    if (!o.name.startsWith('door-')) return;
    const id = o.name.slice(5);
    const base = o.quaternion.clone();
    doors[id] = {
      node: o,
      open: meta.doors[id]?.open ?? 1.5,
      set(angle) { o.quaternion.copy(base).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle)); o.updateMatrixWorld(true); },
    };
  });
  return { root, plan: meta.plan, doors };
}

// The soft reflections the apartment used: a warm room gradient, two bright windows and two lamps
function roomEnvironment(renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  const es = new THREE.Scene();
  const tex = (draw, w = 64, h = 256) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const room = tex((q, w, h) => {
    const g = q.createLinearGradient(0, 0, 0, h);
    [[0, '#f2eee6'], [0.45, '#b9b2a8'], [0.6, '#8a7e70'], [1, '#5a4c3e']].forEach(([s, c]) => g.addColorStop(s, c));
    q.fillStyle = g; q.fillRect(0, 0, w, h);
  });
  es.add(new THREE.Mesh(new THREE.SphereGeometry(6, 24, 16), new THREE.MeshBasicMaterial({ map: room, side: THREE.BackSide })));
  const win = tex((q, w, h) => {
    const g = q.createLinearGradient(0, 0, 0, h);
    [[0, '#bcd8f2'], [0.55, '#f4f8fb'], [0.62, '#9aa6ae'], [1, '#6e7a70']].forEach(([s, c]) => g.addColorStop(s, c));
    q.fillStyle = g; q.fillRect(0, 0, w, h);
    q.fillStyle = 'rgba(20,22,26,.85)';
    [0, 0.33, 0.66].forEach((x) => q.fillRect(x * w, 0, 2, h));
  }, 128, 128);
  const wl = new THREE.MeshBasicMaterial({ map: win });
  const w1 = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.6), wl); w1.position.set(0, 0.4, -4.8); es.add(w1);
  const w2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.6), wl); w2.position.set(-4.8, 0.4, 0); w2.rotation.y = Math.PI / 2; es.add(w2);
  const warm = new THREE.MeshBasicMaterial({ color: 0xffd7a8 });
  for (const [x, y, z] of [[3, 1.2, 2], [1.5, 1.6, -3]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), warm); b.position.set(x, y, z); es.add(b); }
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ color: 0x9a8c7c }));
  fl.rotation.x = -Math.PI / 2; fl.position.y = -1.95; es.add(fl);
  const env = pm.fromScene(es, 0.04).texture;
  pm.dispose();
  return env;
}
