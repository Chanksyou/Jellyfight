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
  const [buffer, meta] = await Promise.all([
    fetchModel(file, onProgress),
    fetch('assets/apartment.json').then((r) => r.json()),
  ]);
  // Textures inside the model are unpacked from blob: URLs. On Chrome, three.js fetch()es those,
  // and pages with a strict security policy (claude.ai artifacts) refuse that, so every texture
  // silently went missing. Hiding createImageBitmap for the parse makes it use <img> instead,
  // which those pages allow.
  const bitmap = window.createImageBitmap;
  let gltf;
  try {
    window.createImageBitmap = undefined;
    gltf = await loader.parseAsync(buffer, '');
  } finally {
    window.createImageBitmap = bitmap;
  }
  const root = gltf.scene;
  scene.add(root);
  const unpacked = new Set();
  const aniso = Math.min(renderer.capabilities.getMaxAnisotropy(), matchMedia('(pointer: coarse)').matches ? 4 : 8);
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
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if ('envMapIntensity' in m) m.envMapIntensity = meta.envMapIntensity;
      // Sharp textures at grazing angles: the jelly looks along the floor, and without
      // anisotropic filtering floor tiles and wood grain blur away. glTF doesn't store it.
      for (const k of ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'normalMap']) if (m[k]) m[k].anisotropy = aniso;
      // Wood grain bump (tagged by tools/exporter.js)
      const bump = /bump:([\d.]+)/.exec(m.name);
      if (bump && m.map) { m.bumpMap = m.map; m.bumpScale = parseFloat(bump[1]); m.needsUpdate = true; }
    }
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
  // Say so if textures failed to load, instead of showing plain white surfaces
  let missing = 0;
  root.traverse((o) => { if (o.isMesh && o.material.map && !o.material.map.image) missing++; });
  if (missing) window._jfError?.(new Error(`${missing} apartment surfaces are missing their textures`), 'loading');

  return { root, plan: meta.plan, doors };
}

// Downloads the model with progress. Some hosts (claude.ai artifacts) don't serve .glb files,
// so a base64 text copy next to it (<name>.b64.txt) is used when the .glb isn't there.
async function fetchModel(file, onProgress) {
  const res = await fetch(file);
  if (res.ok) return new Uint8Array(await readAll(res, onProgress)).buffer;
  const alt = await fetch(file + '.b64.txt');
  if (!alt.ok) throw new Error(`Couldn't download ${file} (${res.status})`);
  const text = new TextDecoder().decode(await readAll(alt, onProgress));
  const bin = atob(text.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function readAll(res, onProgress) {
  const total = +res.headers.get('content-length') || 0;
  if (!res.body || !total) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader(), parts = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    onProgress?.(Math.min(1, got / total));
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
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
