// Runs inside the game page (tools/bake-ao.mjs opens it): bakes how open the space is around a
// grid of points over this act's rooms, for src/baked-ao.js. The game has already loaded the act's
// rooms and applied the furniture layout, so the grid matches what players see.
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { fingerprint } from '../src/baked-ao.js';
import { BAKED_LAYOUT } from '../src/layout-baked.js';

// step: grid spacing (m); top: height baked up to; reach: how far a corner's shadow reaches; rays per point
export async function bake(stageId, { step = 0.04, top = 1.6, reach = 0.3, rays = 48 } = {}) {
  const { APT } = window, root = APT.root;
  root.updateMatrixWorld(true);

  // everything solid the rays can hit, as one set of world-space triangles
  const tris = [], v = new THREE.Vector3(), m4 = new THREE.Matrix4(), shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  root.traverse((o) => {
    if (!o.isMesh || !shown(o)) return;
    const mats = [].concat(o.material);
    if (mats.every((m) => m.transparent || m.transmission > 0 || !m.visible)) return;   // glass and the soft-shadow cards don't block light
    const g = o.geometry, pos = g.attributes.position, idx = g.index;
    const n = idx ? idx.count : pos.count, count = o.isInstancedMesh ? o.count : 1;
    for (let k = 0; k < count; k++) {
      if (o.isInstancedMesh) o.getMatrixAt(k, m4).premultiply(o.matrixWorld); else m4.copy(o.matrixWorld);
      for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m4); tris.push(v.x, v.y, v.z); }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
  const bvh = new MeshBVH(geo);

  // over the rooms this act plays in
  const box = new THREE.Box3();
  for (const part of APT.loaded) for (const room of APT.meta.acts[part] || []) {
    const poly = APT.plan.find(([name]) => name === room)?.[1] || [];
    for (const [x, z] of poly) box.expandByPoint(v.set(x, 0, z));
  }
  box.min.y = -step / 2; box.max.y = top;   // no point lies exactly on the floor: the first row is under it, the next just above
  const dims = ['x', 'y', 'z'].map((a) => Math.ceil((box.max[a] - box.min[a]) / step) + 1);
  const [W, H, D] = dims, total = W * H * D;

  // ray directions spread evenly over a sphere, turned a little differently at each point
  const dirs = [];
  for (let i = 0; i < rays; i++) {
    const y = 1 - (2 * (i + 0.5)) / rays, r = Math.sqrt(1 - y * y), a = i * 2.399963;
    dirs.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  const open = new Float32Array(total), inside = new Uint8Array(total);
  const ray = new THREE.Ray(), p = new THREE.Vector3(), d = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(), near = {};
  let cast = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = x + W * (y + H * z);
    p.set(box.min.x + x * step, box.min.y + y * step, box.min.z + z * step);
    if (!bvh.closestPointToPoint(p, near, 0, reach)) { open[i] = 1; continue; }   // nothing near: wide open
    q.setFromEuler(e.set(i * 0.7071, i * 1.3, i * 0.4142));
    let shut = 0, back = 0;
    for (const dir of dirs) {
      ray.set(p, d.copy(dir).applyQuaternion(q));
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, reach);
      cast++;
      if (!hit) continue;
      shut += 1 - hit.distance / reach;
      if (hit.face.normal.dot(ray.direction) > 0) back++;
    }
    open[i] = 1 - shut / rays;
    inside[i] = back > rays * 0.4 ? 1 : 0;   // inside something solid: no one sees this point
  }

  // points inside solid things take the openness of the air beside them, so a surface reading the
  // grid between the two doesn't darken
  const nb = [1, -1, W, -W, W * H, -W * H];
  for (let pass = 0; pass < 4; pass++) {
    const fill = [];
    for (let i = 0; i < total; i++) {
      if (!inside[i]) continue;
      let s = 0, c = 0;
      for (const o of nb) { const j = i + o; if (j >= 0 && j < total && !inside[j]) { s += open[j]; c++; } }
      if (c) fill.push([i, s / c]);
    }
    for (const [i, val] of fill) { open[i] = val; inside[i] = 0; }
  }

  // how open a plain stretch of floor reads (the grid's point just above it): that much is no shadow
  const floor = [];
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    p.set(box.min.x + x * step, step / 2, box.min.z + z * step);
    const hit = bvh.raycastFirst(ray.set(p, d.set(0, -1, 0)), THREE.DoubleSide, 0, step);
    if (hit) floor.push(open[x + W * (1 + H * z)]);   // row 1 is half a step above the floor
  }
  floor.sort((a, b) => a - b);
  const openFloor = floor[Math.floor(floor.length * 0.9)] || 0.5;

  const bytes = new Uint8Array(total);
  for (let i = 0; i < total; i++) bytes[i] = Math.min(255, Math.round(Math.min(1, Math.max(0, open[i])) * 255 / 6) * 6);   // 43 shades: the download is half the size, and the texture's blending hides the steps
  let bin = '';
  for (let i = 0; i < total; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return {
    // min and size are the grid's outer edges (each point is the centre of its texel)
    meta: { min: box.min.toArray().map((n) => +(n - step / 2).toFixed(4)), size: dims.map((n) => +(n * step).toFixed(4)), dims, step, reach, rays, open: +openFloor.toFixed(3), parts: [...APT.loaded], made: await fingerprint([...APT.loaded], BAKED_LAYOUT[stageId]) },
    data: btoa(bin), triangles: tris.length / 9, cast,
  };
}
