// Turns a downloaded CC0 insect model (.glb, Draco/meshopt/plain) into a lightweight,
// Batcher-compatible hero bug shell in Jelly Run's radius units:
//   node tools/bug-import.mjs <download.glb> <out.glb> [--tris=1600] [--texture=512] [--length=2.2] [--face=+z]
//
// Preserves named rigid sub-parts (e.g. body, thorax, abdomen, head, elytraL, elytraR) so
// src/critters.js can attach them to procedural pivots and GaitRig 2-bone IK legs without
// SkinnedMesh draw-call overhead. Each part gets:
//  - triangles simplified proportionally to --tris via MeshoptSimplifier (preserving UVs & colors),
//  - crease-aware smooth normals (50 deg),
//  - raytraced hemisphere ambient occlusion baked into vertex colors against all parts + floor,
//  - base-color texture resized to --texture px mozjpeg (or baked into vertex colors with --texture=0),
//  - normalized to stand on y=0, centered in X/Z, facing +z, length = --length radius units,
//  - compressed with meshopt + quantization for tiny mobile downloads.
// Credit the source & license in README.md's Credits section when adding an imported bug asset.
import fs from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const [src, out] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
if (!src || !out) {
  console.error('usage: node tools/bug-import.mjs <download.glb> <out.glb> [--tris=1600] [--texture=512] [--length=2.2] [--face=+z|-z|+x|-x]');
  process.exit(1);
}
const TRIS = +(opt.tris || 1600);
const TEX_SIZE = opt.texture === undefined ? 512 : +opt.texture;
const LENGTH = +(opt.length || 2.2);
const FACE = opt.face || '+z';
const AO_RAYS = 40, AO_REACH = 0.8, AO_STRENGTH = 0.65, CREASE = Math.cos(50 * Math.PI / 180);

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});
const doc = await io.read(src);

// --- 1. collect triangles grouped by node/part name
const images = new Map();
async function pixels(tex) {
  if (!images.has(tex)) {
    const { data, info } = await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    images.set(tex, { data, w: info.width, h: info.height });
  }
  return images.get(tex);
}
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function sample(img, u, v, xf) {
  if (xf) { u = u * xf.scale[0] + xf.offset[0]; v = v * xf.scale[1] + xf.offset[1]; }
  u -= Math.floor(u); v -= Math.floor(v);
  const x = Math.min(img.w - 1, (u * img.w) | 0), y = Math.min(img.h - 1, (v * img.h) | 0), i = (y * img.w + x) * 3;
  return [srgbToLinear(img.data[i] / 255), srgbToLinear(img.data[i + 1] / 255), srgbToLinear(img.data[i + 2] / 255)];
}
const mul = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const yawFace = (p) => (FACE === '-z' ? [-p[0], p[1], -p[2]] : FACE === '+x' ? [-p[2], p[1], p[0]] : FACE === '-x' ? [p[2], p[1], -p[0]] : p);

const parts = new Map();   // partName -> { tris: [], tex: { tex, xf } | null }
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const partName = (node.getName() || mesh.getName() || 'shell').replace(/[^a-zA-Z0-9_-]/g, '_') || 'shell';
  if (!parts.has(partName)) parts.set(partName, { tris: [], tex: null });
  const bucket = parts.get(partName);
  const m = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'), col = prim.getAttribute('COLOR_0'), uv = prim.getAttribute('TEXCOORD_0');
    const mat = prim.getMaterial(), base = mat ? mat.getBaseColorFactor() : [1, 1, 1, 1];
    const tex = mat && mat.getBaseColorTexture(), info = mat && mat.getBaseColorTextureInfo();
    const xfExt = info && info.getExtension('KHR_texture_transform');
    const xf = xfExt && { offset: xfExt.getOffset(), scale: xfExt.getScale() };
    const img = tex && uv ? await pixels(tex) : null;
    const keepTex = TEX_SIZE > 0 && img;
    if (keepTex && !bucket.tex) bucket.tex = { tex, xf };
    const idx = prim.getIndices(), n = idx ? idx.getCount() : pos.getCount();
    const at = (k) => (idx ? idx.getScalar(k) : k);
    for (let k = 0; k < n; k += 3) {
      const t = { p: [], c: [], uv: keepTex ? [] : null };
      for (let j = 0; j < 3; j++) {
        const i = at(k + j);
        t.p.push(yawFace(mul(m, pos.getElement(i, []))));
        let c = [base[0], base[1], base[2]];
        if (col) { const v = col.getElement(i, []); c = [c[0] * v[0], c[1] * v[1], c[2] * v[2]]; }
        if (img && !keepTex) { const s = sample(img, ...uv.getElement(i, []), xf); c = [c[0] * s[0], c[1] * s[1], c[2] * s[2]]; }
        if (keepTex) t.uv.push(uv.getElement(i, []));
        t.c.push(c);
      }
      bucket.tris.push(t);
    }
  }
}

const allIn = [...parts.values()].flatMap((b) => b.tris);
if (!allIn.length) { console.error('no triangles found in', src); process.exit(1); }

// --- 2. normalize to stand on y=0, centered in X/Z, length along Z = LENGTH radius units
{
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const t of allIn) for (const p of t.p) for (let q = 0; q < 3; q++) { lo[q] = Math.min(lo[q], p[q]); hi[q] = Math.max(hi[q], p[q]); }
  const spanZ = Math.max(1e-5, hi[2] - lo[2]);
  const s = LENGTH / spanZ, cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2;
  for (const t of allIn) for (const p of t.p) { p[0] = (p[0] - cx) * s; p[1] = (p[1] - lo[1]) * s; p[2] = (p[2] - cz) * s; }
}

// --- 3. weld & simplify each part proportionally to TRIS
function weldAndCut(list, target) {
  const key = new Map(), P = [], A = [], I = [], W = [];
  const hasUv = list.length && !!list[0].uv;
  for (const t of list) for (let j = 0; j < 3; j++) {
    const p = t.p[j], c = t.c[j], uv = hasUv ? t.uv[j] : [0, 0];
    const k = [...p, ...uv.map((x) => x * 5)].map((x) => Math.round(x * 1e4)).join(',');
    let i = key.get(k);
    if (i === undefined) { i = P.length / 3; key.set(k, i); P.push(...p); A.push(0, 0, 0, ...uv); W.push(0); }
    A[i * 5] += c[0]; A[i * 5 + 1] += c[1]; A[i * 5 + 2] += c[2]; W[i]++;
    I.push(i);
  }
  for (let i = 0; i < W.length; i++) for (let q = 0; q < 3; q++) A[i * 5 + q] /= W[i];
  const stride = 5;
  let idx = new Uint32Array(I);
  if (idx.length / 3 > target) {
    const [cut] = MeshoptSimplifier.simplifyWithAttributes(idx, new Float32Array(P), 3, new Float32Array(A), stride, [0.6, 0.6, 0.6, hasUv ? 1 : 0, hasUv ? 1 : 0], null, Math.max(12, target) * 3, 0.25, hasUv ? ['LockBorder'] : []);
    idx = cut;
  }
  const outT = [];
  for (let k = 0; k < idx.length; k += 3) {
    const v = [idx[k], idx[k + 1], idx[k + 2]];
    outT.push({ p: v.map((i) => P.slice(i * 3, i * 3 + 3)), c: v.map((i) => A.slice(i * stride, i * stride + 3)), uv: hasUv ? v.map((i) => A.slice(i * stride + 3, i * stride + 5)) : null });
  }
  return outT;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function computeNormals(list) {
  const around = new Map(), pk = (p) => p.map((x) => Math.round(x * 1e4)).join(',');
  for (const t of list) {
    t.fn = cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0]));
    t.p.forEach((p) => { const k = pk(p); if (!around.has(k)) around.set(k, []); around.get(k).push(t); });
  }
  for (const t of list) {
    const own = unit(t.fn);
    t.n = t.p.map((p) => {
      const s = [0, 0, 0];
      for (const o of around.get(pk(p))) if (dot(unit(o.fn), own) > CREASE) { s[0] += o.fn[0]; s[1] += o.fn[1]; s[2] += o.fn[2]; }
      return unit(s);
    });
  }
}

const simplified = new Map();
for (const [name, b] of parts) {
  if (!b.tris.length) continue;
  const share = b.tris.length / allIn.length;
  const cut = weldAndCut(b.tris, Math.round(TRIS * share));
  computeNormals(cut);
  simplified.set(name, { tris: cut, tex: b.tex });
}

// --- 4. bake hemisphere ambient occlusion into vertex colors against all parts + floor
const allOut = [...simplified.values()].flatMap((b) => b.tris);
const grid = new Map(), CELL = 0.15, ck = (x, y, z) => `${x},${y},${z}`;
for (const t of allOut) {
  const lo = [0, 1, 2].map((q) => Math.floor(Math.min(t.p[0][q], t.p[1][q], t.p[2][q]) / CELL));
  const hi = [0, 1, 2].map((q) => Math.floor(Math.max(t.p[0][q], t.p[1][q], t.p[2][q]) / CELL));
  for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) {
    const k = ck(x, y, z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(t);
  }
}
function hit(o, d, tested) {
  if (d[1] < 0 && o[1] + d[1] * AO_REACH < 0) return true;
  for (let s = 0; s <= AO_REACH; s += CELL * 0.5) {
    const k = ck(...[0, 1, 2].map((q) => Math.floor((o[q] + d[q] * s) / CELL)));
    for (const t of grid.get(k) || []) {
      if (tested.has(t)) continue; tested.add(t);
      const e1 = sub(t.p[1], t.p[0]), e2 = sub(t.p[2], t.p[0]), h = cross(d, e2), a = dot(e1, h);
      if (Math.abs(a) < 1e-9) continue;
      const f = 1 / a, q0 = sub(o, t.p[0]), u = f * dot(q0, h);
      if (u < 0 || u > 1) continue;
      const qv = cross(q0, e1), v = f * dot(d, qv);
      if (v < 0 || u + v > 1) continue;
      const dist = f * dot(e2, qv);
      if (dist > 1e-4 && dist < AO_REACH) return true;
    }
  }
  return false;
}
let seed = 20261124;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const memo = new Map();
for (const t of allOut) {
  t.c = t.c.map((c, j) => {
    const p = t.p[j], n = t.n[j], k = [...p, ...n].map((x) => Math.round(x * 1e3)).join(',');
    if (!memo.has(k)) {
      const tx = unit(Math.abs(n[1]) < 0.9 ? cross(n, [0, 1, 0]) : cross(n, [1, 0, 0])), ty = cross(n, tx);
      const o = [p[0] + n[0] * 0.005, p[1] + n[1] * 0.005, p[2] + n[2] * 0.005];
      let open = 0;
      for (let r = 0; r < AO_RAYS; r++) {
        const a = rnd() * Math.PI * 2, s = Math.sqrt(rnd()), z = Math.sqrt(1 - s * s);
        const d = [0, 1, 2].map((q) => tx[q] * Math.cos(a) * s + ty[q] * Math.sin(a) * s + n[q] * z);
        if (!hit(o, d, new Set())) open++;
      }
      memo.set(k, 1 - AO_STRENGTH * (1 - open / AO_RAYS));
    }
    const ao = memo.get(k);
    return c.map((x) => x * ao);
  });
}

// --- 5. write compressed GLB with named rigid sub-parts
const outDoc = new Document(), buf = outDoc.createBuffer(), scene = outDoc.createScene();
const bakedTex = new Map();
for (const [name, { tris, tex }] of simplified) {
  if (!tris.length) continue;
  const f = (k, w) => new Float32Array(tris.flatMap((t) => t[k].flat())).subarray(0, tris.length * 3 * w);
  const prim = outDoc.createPrimitive()
    .setAttribute('POSITION', outDoc.createAccessor().setType('VEC3').setArray(f('p', 3)).setBuffer(buf))
    .setAttribute('NORMAL', outDoc.createAccessor().setType('VEC3').setArray(f('n', 3)).setBuffer(buf))
    .setAttribute('COLOR_0', outDoc.createAccessor().setType('VEC3').setArray(f('c', 3)).setBuffer(buf));
  const mat = outDoc.createMaterial(name).setRoughnessFactor(0.28).setMetallicFactor(0.08);
  if (tris[0].uv && tex) {
    const xf = tex.xf;
    const uvs = new Float32Array(tris.flatMap((t) => t.uv.map(([u, v]) => (xf ? [u * xf.scale[0] + xf.offset[0], v * xf.scale[1] + xf.offset[1]] : [u, v])).flat()));
    prim.setAttribute('TEXCOORD_0', outDoc.createAccessor().setType('VEC2').setArray(uvs).setBuffer(buf));
    if (!bakedTex.has(tex.tex)) {
      const jpg = await sharp(Buffer.from(tex.tex.getImage())).resize(TEX_SIZE, TEX_SIZE, { fit: 'inside' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      bakedTex.set(tex.tex, outDoc.createTexture(name).setImage(new Uint8Array(jpg)).setMimeType('image/jpeg'));
    }
    mat.setBaseColorTexture(bakedTex.get(tex.tex));
  }
  prim.setMaterial(mat);
  scene.addChild(outDoc.createNode(name).setMesh(outDoc.createMesh(name).addPrimitive(prim)));
}
await outDoc.transform(quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(out, outDoc);
console.log(`${out}: ${allOut.length} tris across ${simplified.size} part(s) [${[...simplified.keys()].join(', ')}], ${(fs.statSync(out).size / 1e3).toFixed(1)} kB`);
