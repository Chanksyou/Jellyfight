// Light maps for the big pieces of furniture: the sofa, the kitchen, the cabinets, the beds. The light grid
// (baked-light.js) lights every piece from points 10 cm apart, which is soft; a big piece gets its own patch of
// the act's baked light picture instead, at 2 cm a texel, so a shelf's shadow on the cabinet below it or the
// lamp's pool on a table top come out sharp.
//
// No second UV set ships with the models. The bake (tools/bake-light-page.js) cuts each big piece into charts:
// triangles that look mostly along the same axis, joined by their edges, never overlapping when projected along
// it. Each chart gets a rectangle beside the shell's planes in the picture. The act's light JSON keeps, per piece,
// which chart each triangle is in and where each chart sits; mapPieces() rebuilds the piece's vertices with a
// `lightUv` attribute from that (a world position projected along the chart's axis), at load.
//
// A piece is named by its layout key (layout.js movables / addedThings) and the index of the mesh inside it. If
// the piece no longer matches (another triangle count), it keeps the grid's light. Everything else of the
// same material gets a zero `lightUv`, so the furniture batches (static-batch.js) still join them: no new draws.
import * as THREE from 'three';
import { movables, addedThings } from './layout.js';

export const PIECE = { res: 0.02, pad: 3, minArea: 0.25, maxTris: 4000 };   // metres a texel; texels round a chart; which pieces get a map (m², triangles)
const AXES = [[2, 1], [0, 2], [0, 1]];   // a chart looking along axis a lays out on these two (as the shell's planes)

const solid = (m) => m && m.visible !== false && !m.transparent && !(m.transmission > 0);
const plain = (o) => o.isMesh && !o.isInstancedMesh && !o.isBatchedMesh && !o.isSkinnedMesh && !o.morphTargetInfluences;

// every plain mesh of the furniture, named "key/index"
export function lightPieces(root) {
  const out = [];
  for (const { key, node } of [...movables(root), ...addedThings(root)]) {
    let i = 0;
    node.traverse((o) => { if (o.isMesh) { const n = i++; if (plain(o)) out.push({ id: `${key}/${n}`, mesh: o }); } });
  }
  return out;
}

// the mesh's triangles in world space: 9 numbers a triangle, and the corners' vertex indices
function corners(mesh) {
  const g = mesh.geometry, pos = g.attributes.position, idx = g.index, n = (idx ? idx.count : pos.count) / 3;
  const P = new Float64Array(n * 9), V = new Uint32Array(n * 3), v = new THREE.Vector3();
  mesh.updateWorldMatrix(true, false);
  for (let c = 0; c < n * 3; c++) {
    const k = idx ? idx.getX(c) : c;
    V[c] = k;
    v.fromBufferAttribute(pos, k).applyMatrix4(mesh.matrixWorld);
    P[c * 3] = v.x; P[c * 3 + 1] = v.y; P[c * 3 + 2] = v.z;
  }
  return { P, V, n };
}

// how big a piece is: its area in m² (world), and its triangle count
export function pieceSize(mesh) {
  const { P, n } = corners(mesh);
  let area = 0;
  for (let t = 0; t < n; t++) area += cross(P, t * 9).len / 2;
  return { area, tris: n };
}

function cross(P, i) {
  const ax = P[i + 3] - P[i], ay = P[i + 4] - P[i + 1], az = P[i + 5] - P[i + 2];
  const bx = P[i + 6] - P[i], by = P[i + 7] - P[i + 1], bz = P[i + 8] - P[i + 2];
  const x = ay * bz - az * by, y = az * bx - ax * bz, z = ax * by - ay * bx;
  return { x, y, z, len: Math.hypot(x, y, z) };
}

// The bake's half: cut a piece into charts. Returns { chart (per triangle), charts: [{ a, lo, hi }] } in texels.
export function chartPiece(mesh, res = PIECE.res) {
  const { P, n } = corners(mesh);
  const dir = new Uint8Array(n);
  for (let t = 0; t < n; t++) {
    const c = cross(P, t * 9), m = [Math.abs(c.x), Math.abs(c.y), Math.abs(c.z)], a = m[0] >= m[1] && m[0] >= m[2] ? 0 : m[1] >= m[2] ? 1 : 2;
    dir[t] = a * 2 + ([c.x, c.y, c.z][a] < 0 ? 1 : 0);
  }
  // triangles meet along an edge when two corners sit at the same place (to 0.1 mm)
  const ids = new Map(), vid = new Int32Array(n * 3);
  for (let c = 0; c < n * 3; c++) {
    const key = `${Math.round(P[c * 3] * 1e4)},${Math.round(P[c * 3 + 1] * 1e4)},${Math.round(P[c * 3 + 2] * 1e4)}`;
    if (!ids.has(key)) ids.set(key, ids.size);
    vid[c] = ids.get(key);
  }
  const edges = new Map();
  for (let t = 0; t < n; t++) for (let e = 0; e < 3; e++) {
    const a = vid[t * 3 + e], b = vid[t * 3 + (e + 1) % 3], key = a < b ? a * 4194304 + b : b * 4194304 + a;
    if (!edges.has(key)) edges.set(key, []);
    edges.get(key).push(t);
  }
  const uvOf = (t, k, a) => [P[t * 9 + k * 3 + AXES[a][0]] / res, P[t * 9 + k * 3 + AXES[a][1]] / res];
  // the texel centres a triangle covers (strictly inside it), as keys
  const cells = (t, a) => {
    const [p, q, r] = [0, 1, 2].map((k) => uvOf(t, k, a));
    const out = [], d = (q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1]);
    if (Math.abs(d) < 1e-9) return out;
    const x0 = Math.floor(Math.min(p[0], q[0], r[0])), x1 = Math.ceil(Math.max(p[0], q[0], r[0]));
    const y0 = Math.floor(Math.min(p[1], q[1], r[1])), y1 = Math.ceil(Math.max(p[1], q[1], r[1]));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const sx = x + 0.5, sy = y + 0.5;
      const w1 = ((q[0] - sx) * (r[1] - sy) - (r[0] - sx) * (q[1] - sy)) / d, w2 = ((r[0] - sx) * (p[1] - sy) - (p[0] - sx) * (r[1] - sy)) / d, w3 = 1 - w1 - w2;
      if (w1 > 1e-6 && w2 > 1e-6 && w3 > 1e-6) out.push(x * 1048576 + y);
    }
    return out;
  };
  const chart = new Int32Array(n).fill(-1), charts = [];
  for (let s = 0; s < n; s++) {
    if (chart[s] >= 0) continue;
    const a = dir[s] >> 1, id = charts.length, taken = new Set(), lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
    const take = (t) => {
      const cs = cells(t, a);
      if (cs.some((c) => taken.has(c))) return false;   // it would fold over the chart: it starts or joins another
      cs.forEach((c) => taken.add(c));
      chart[t] = id;
      for (let k = 0; k < 3; k++) { const [u, v] = uvOf(t, k, a); lo[0] = Math.min(lo[0], u); lo[1] = Math.min(lo[1], v); hi[0] = Math.max(hi[0], u); hi[1] = Math.max(hi[1], v); }
      return true;
    };
    take(s);
    const queue = [s];
    while (queue.length) {
      const t = queue.shift();
      for (let e = 0; e < 3; e++) {
        const a0 = vid[t * 3 + e], b0 = vid[t * 3 + (e + 1) % 3], key = a0 < b0 ? a0 * 4194304 + b0 : b0 * 4194304 + a0;
        for (const u of edges.get(key)) if (chart[u] < 0 && dir[u] === dir[s] && take(u)) queue.push(u);
      }
    }
    charts.push({ a, lo, hi });
  }
  return { chart, charts };
}

// The game's half: the piece's vertices again, each with its light map texel (a vertex on two charts is split),
// from its entry in the act's light JSON: { id, tris, chart (base64 Uint16, per triangle), at: [a, du, dv, ...] per chart }
// where a texel is (world along the chart's axes) / res + (du, dv). Returns false when the piece no longer matches.
export function mapPiece(mesh, entry, atlas, res = PIECE.res) {
  const { P, V, n } = corners(mesh);
  if (n !== entry.tris) return false;
  const bin = atob(entry.chart), chart = new Uint16Array(n);
  for (let t = 0; t < n; t++) chart[t] = bin.charCodeAt(t * 2) | (bin.charCodeAt(t * 2 + 1) << 8);
  const at = entry.at, g = mesh.geometry, made = new Map(), index = new Uint32Array(n * 3), from = [], uv = [];
  for (let c = 0; c < n * 3; c++) {
    const t = (c / 3) | 0, ch = chart[t];
    if (ch * 3 + 2 >= at.length) return false;
    const key = V[c] * 65536 + ch;
    let k = made.get(key);
    if (k === undefined) {
      made.set(key, (k = from.length));
      from.push(V[c]);
      const a = at[ch * 3];
      uv.push((P[c * 3 + AXES[a][0]] / res + at[ch * 3 + 1]) / atlas[0], (P[c * 3 + AXES[a][1]] / res + at[ch * 3 + 2]) / atlas[1]);
    }
    index[c] = k;
  }
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(g.attributes)) {
    // raw values (a packed normal or colour stays packed): an interleaved one reads through its stride
    const size = attr.itemSize, il = attr.isInterleavedBufferAttribute, src = il ? attr.data.array : attr.array;
    const stride = il ? attr.data.stride : size, off = il ? attr.offset : 0, arr = new src.constructor(from.length * size);
    for (let i = 0; i < from.length; i++) for (let j = 0; j < size; j++) arr[i * size + j] = src[from[i] * stride + off + j];
    out.setAttribute(name, new THREE.BufferAttribute(arr, size, attr.normalized));
  }
  out.setAttribute('lightUv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  for (const gr of g.groups) out.addGroup(gr.start, gr.count, gr.materialIndex);
  out.name = g.name;
  mesh.geometry = out;
  return true;
}

// Give the act's big pieces their light maps (meta.pieces, from the bake), and every other mesh under root a zero
// lightUv (the shader reads zero as "no map": the grid lights it). Returns how many pieces were mapped.
export function mapPieces(root, meta) {
  const byId = new Map((meta?.pieces || []).map((p) => [p.id, p]));
  let mapped = 0;
  if (byId.size) for (const { id, mesh } of lightPieces(root)) {
    const e = byId.get(id);
    if (e && !mesh.geometry.attributes.lightUv && mapPiece(mesh, e, meta.atlas)) mapped++;
  }
  const furniture = new Set(lightPieces(root).map((p) => p.mesh));
  root.traverse((o) => {
    const g = o.isMesh && o.geometry;
    if (!g || g.attributes.lightUv || !g.attributes.position) return;
    const arr = new Float32Array(g.attributes.position.count * 2);
    if (furniture.has(o)) arr.fill(-1);   // -1 tells baked-ao.js to jump straight to gridLight() instead of testing shell planes
    g.setAttribute('lightUv', new THREE.BufferAttribute(arr, 2));
  });
  return mapped;
}

// (the bake) which pieces get a map: solid, big enough, not too finely made
export function wantsMap(mesh) {
  if (![].concat(mesh.material).every(solid)) return false;
  const { area, tris } = pieceSize(mesh);
  return area >= PIECE.minArea && tris <= PIECE.maxTris;
}
