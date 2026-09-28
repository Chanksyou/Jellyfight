// Close-up surface detail. At 5 cm tall the floor fills half the screen, and textures made
// for a person-sized view look flat and blurry. This adds fine tiling normal maps: grain,
// pores and scratches on floors; an orange-peel paint finish on walls, doors and furniture.
import * as THREE from 'three';

const TILE = 0.08; // meters per repeat of the detail texture

function detailNormalMap(size = 256, seed = 7, { octaves = [[8, 0.5, 4], [16, 0.3, 3], [32, 0.2, 2], [64, 0.12, 1], [128, 0.08, 1]], scratches = 14, strength = 2.2 } = {}) {
  let s = seed;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const h = new Float32Array(size * size);
  // tileable value noise, several octaves, stretched along x like grain
  for (const [cells, amp, stretch] of octaves) {
    const cx = Math.max(1, cells / stretch), cy = cells;
    const g = Array.from({ length: cx * cy }, rnd);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = (x / size) * cx, fy = (y / size) * cy;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const at = (i, j) => g[((j % cy) * cx) + (i % cx)];
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const v = (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
      h[y * size + x] += v * amp;
    }
  }
  // a few fine scratches
  for (let k = 0; k < scratches; k++) {
    let x = rnd() * size, y = rnd() * size;
    const a = rnd() * Math.PI, len = 20 + rnd() * 70, depth = 0.15 + rnd() * 0.2;
    for (let i = 0; i < len; i++) {
      const xi = ((Math.round(x) % size) + size) % size, yi = ((Math.round(y) % size) + size) % size;
      h[yi * size + xi] -= depth;
      x += Math.cos(a);
      y += Math.sin(a);
    }
  }
  const data = new Uint8Array(size * size * 4);
  const H = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  const k = strength;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * k, dy = (H(x, y + 1) - H(x, y - 1)) * k;
    const n = new THREE.Vector3(-dx, -dy, 1).normalize();
    const i = (y * size + x) * 4;
    data[i] = (n.x * 0.5 + 0.5) * 255;
    data[i + 1] = (n.y * 0.5 + 0.5) * 255;
    data[i + 2] = (n.z * 0.5 + 0.5) * 255;
    data[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// Meters of surface per unit of uv, along u and along v, read off one triangle
function uvScale(geo) {
  const P = geo.attributes.position, U = geo.attributes.uv, I = geo.index;
  const n = I ? I.count : P.count;
  const p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], t = [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()];
  for (let f = 0; f + 2 < n; f += 3) {
    for (let k = 0; k < 3; k++) { const v = I ? I.getX(f + k) : f + k; p[k].fromBufferAttribute(P, v); t[k].fromBufferAttribute(U, v); }
    const e1 = p[1].clone().sub(p[0]), e2 = p[2].clone().sub(p[0]);
    const du1 = t[1].x - t[0].x, dv1 = t[1].y - t[0].y, du2 = t[2].x - t[0].x, dv2 = t[2].y - t[0].y;
    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-9) continue;
    const T = e1.clone().multiplyScalar(dv2).addScaledVector(e2, -dv1).divideScalar(det);
    const B = e2.clone().multiplyScalar(du1).addScaledVector(e1, -du2).divideScalar(det);
    if (T.length() > 1e-6 && B.length() > 1e-6) return [T.length(), B.length()];
  }
  return null;
}

// Floors, rugs and mats get the grain; walls, doors, cabinets, porcelain and plastic get a fine
// paint/glaze texture. Skips glass, metal, things already bumpy and small bits.
export function addSurfaceDetail(meshes, { inside } = {}) {
  const grain = detailNormalMap();
  const paint = detailNormalMap(256, 11, { octaves: [[32, 0.4, 1], [64, 0.35, 1], [128, 0.25, 1]], scratches: 3, strength: 1.2 });
  const box = new THREE.Box3(), size = new THREE.Vector3(), c = new THREE.Vector3();
  const shared = new Map();   // one clone per (material, detail, repeat)
  let count = 0;
  for (const m of meshes) {
    const mat = m.material;
    if (Array.isArray(mat) || !mat?.isMeshStandardMaterial || mat.normalMap || mat.bumpMap || !m.geometry.attributes.uv) continue;
    if (mat.transparent || mat.metalness > 0.5 || m.isInstancedMesh) continue;
    box.setFromObject(m).getSize(size);
    if (inside && !inside(box.getCenter(c))) continue;
    if (Math.max(size.x, size.y, size.z) < 0.12) continue;
    const floor = size.y < 0.04 && box.max.y < 0.06 && size.x * size.z > 0.2;
    const sc = uvScale(m.geometry);
    if (!sc) continue;
    const s = m.getWorldScale(c);
    const tile = floor ? TILE : 0.05;
    const rx = +(sc[0] * Math.max(s.x, s.z) / tile).toFixed(1), ry = +(sc[1] * s.y / tile).toFixed(1);
    if (!(rx > 0 && ry > 0 && rx < 5000 && ry < 5000)) continue;
    const key = `${mat.uuid}|${floor}|${rx}|${ry}`;
    let out = shared.get(key);
    if (!out) {
      const tex = (floor ? grain : paint).clone();
      tex.needsUpdate = true;
      tex.repeat.set(rx, ry);
      out = mat.clone();
      out.normalMap = tex;
      const k = floor ? 0.45 : 0.3;
      out.normalScale = new THREE.Vector2(k, k);
      shared.set(key, out);
    }
    m.material = out;
    count++;
  }
  return count;
}
