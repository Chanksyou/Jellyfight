// Close-up surface detail. At 3.5 cm tall the floor fills half the screen, and its
// texture (made for a person-sized view) looks flat and blurry. This adds a fine,
// tiling bump texture (grain, pores, a few scratches) to large flat surfaces near the floor.
import * as THREE from 'three';

const TILE = 0.08; // meters per repeat of the detail texture

function detailNormalMap(size = 256, seed = 7) {
  let s = seed;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const h = new Float32Array(size * size);
  // tileable value noise, several octaves, stretched along x like grain
  for (const [cells, amp, stretch] of [[8, 0.5, 4], [16, 0.3, 3], [32, 0.2, 2], [64, 0.12, 1], [128, 0.08, 1]]) {
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
  for (let k = 0; k < 14; k++) {
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
  const k = 2.2;
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

// Adds detail to meshes that are big, flat and at floor level (floors, rugs, mats).
export function addFloorDetail(meshes) {
  const base = detailNormalMap();
  const box = new THREE.Box3(), size = new THREE.Vector3();
  let count = 0;
  for (const m of meshes) {
    const mat = m.material;
    if (Array.isArray(mat) || !mat?.isMeshStandardMaterial || mat.normalMap || !m.geometry.attributes.uv) continue;
    box.setFromObject(m).getSize(size);
    if (size.y > 0.04 || box.max.y > 0.06 || size.x * size.z < 0.4) continue;
    // how many uv units per meter on this mesh
    const uv = m.geometry.attributes.uv;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
    }
    const uvPerMeter = Math.sqrt(((u1 - u0) * (v1 - v0)) / (size.x * size.z));
    if (!isFinite(uvPerMeter) || uvPerMeter <= 0) continue;
    const tex = base.clone();
    tex.needsUpdate = true;
    tex.repeat.setScalar(1 / (uvPerMeter * TILE));
    m.material = mat.clone();
    m.material.normalMap = tex;
    m.material.normalScale = new THREE.Vector2(0.45, 0.45);
    count++;
  }
  return count;
}
