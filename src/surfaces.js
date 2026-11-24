// Close-up surfaces. The jelly is 3.5 cm tall, so the camera sits about 30 cm from whatever it is near,
// and textures drawn for a person-sized view look soft and plain there. Two things fix that, both drawn
// by the rooms' one shader patch (baked-ao.js), so neither adds a draw, a light or a program:
//
//  - The grain: one 256 px tile drawn here at load, four grey patterns in its four channels (wood
//    pores, woven cloth, paint stipple, stone speckle), read by world position on the surface's main
//    axis (so walls and merged furniture without texture coordinates get it too) and multiplied into
//    the surface's colour, so the baked light shows it everywhere, not only in live light. Mipmaps fade
//    it to nothing with distance. Each material picks a pattern at load (detailOf) with its strength
//    from look.css (--detail-*); Low's plain materials leave it out of their shader.
//  - SURFACES: photo textures (CC0, assets/textures, credited in README) that replace a drawn one in the
//    apartment model, loaded as their own files and assigned here when a part loads. The model files stay
//    as they are, so nothing needs baking again (the baked light is multiplied by the surface's colour
//    live). Keep a new picture's average colour close to the drawn one's, so the bake's bounce light
//    still matches it.
import * as THREE from 'three';
import { LOOK } from './look.js';

// A photo texture in place of a drawn one. match(mesh, material) picks the materials it replaces (the
// model's materials have no names: match by what they have, like the texture's size or the piece's
// name); repeat is times the drawn texture's repeat; detail the grain pattern it takes.
export const SURFACES = [
  // Poly Haven laminate_floor_02, made paler to the drawn floor's colour (tools/textures.mjs). One floor
  // material runs through every room, so acts 1 to 4 change together. The drawn one tiles every 2 m with
  // 11 boards (18 cm); the photo has 8 boards, so it tiles every 1.5 m for 19 cm boards.
  { name: 'floor', file: 'floor-laminate.webp', repeat: 1.3, detail: 'wood',
    match: (mesh, m) => mesh.parent?.name === 'Shell' && m.map?.image?.width === 512 && m.map.image.height === 512 && m.map.repeat.x === 0.5 },

  // The corduroy sofa (act 1 and 4): ridges drawn in code (tools/textures.py corduroy; no CC0 fabric
  // set was reachable), the same 16 per tile as the drawn one, so the repeat is unchanged.
  { name: 'sofa', file: 'sofa-corduroy.webp', detail: 'cloth',
    match: (mesh, m) => mesh.parent?.name === 'Corduroy_sofa' && m.map?.image?.width === 128 },
  // Wood veneers (Poly Haven oak_veneer_03, oak_veneer_01, natural_walnut_veneer), each colour-matched
  // to the drawn wood it replaces. The kitchen's and the Media console's are one picture.
  { name: 'veneer-kitchen', file: 'veneer-kitchen.webp', detail: 'wood',
    match: (mesh, m) => isWood(m) && (['Kitchen', 'Refrigerator'].includes(mesh.parent?.name) || (mesh.parent?.name === 'Media_console' && m.map.repeat.x === 1)) },
  { name: 'veneer-oak', file: 'veneer-oak.webp', detail: 'wood',
    match: (mesh, m) => isWood(m) && ['Standing_desk', 'Cat_window_perches'].includes(mesh.parent?.name) },
  { name: 'veneer-walnut', file: 'veneer-walnut.webp', detail: 'wood',
    match: (mesh, m) => isWood(m) && ['Fluted_sideboard', 'Glass_coffee_table', 'Cubby_bench'].includes(mesh.parent?.name) },
  // Act 2's bathroom: white wall tile (Poly Haven long_white_tiles; 0.5 makes its tiles 5 by 7.5 cm like
  // the drawn ones) and the dark floor tile (granite_tile).
  { name: 'tile-white', file: 'tile-white.webp', repeat: 0.5,
    match: (mesh, m) => mesh.parent?.name === 'Shell' && isTexture(m, 256) && Math.abs(m.map.repeat.y - 4.58) < 0.01 },
  { name: 'tile-dark', file: 'tile-dark.webp',
    match: (mesh, m) => mesh.parent?.name === 'Shell' && isTexture(m, 256) && m.map.repeat.x === 3.5 },
  // The kitchen's counter (granite_tile_03, cropped and mirrored to tile) and glazed backsplash
  // (rounded_square_tiled_wall).
  { name: 'counter', file: 'counter-stone.webp', detail: 'stone',
    match: (mesh, m) => mesh.parent?.name === 'Kitchen' && isTexture(m, 256) && m.map.repeat.x === 6 },
  { name: 'backsplash', file: 'backsplash.webp', repeat: 0.4,
    match: (mesh, m) => mesh.parent?.name === 'Kitchen' && isTexture(m, 256) && m.map.repeat.x === 9 },
];

function isTexture(m, size) { return m.map?.image?.width === size && m.map.image.height === size; }
// a drawn wood: the bump-tagged 256 px texture (the Media console's is the same picture, tinted)
function isWood(m) { return isTexture(m, 256) && (/bump:/.test(m.name) || m.map.repeat.x === 1); }

const KINDS = ['wood', 'cloth', 'paint', 'stone'];
const uniforms = { detailTile: { value: null }, detailSize: { value: 0.25 } };

// The grain's uniforms for a material's shader (baked-ao.js's patch): the shared tile, drawn the first
// time, and this material's pattern at its strength
export function detailUniforms(kind) {
  if (!uniforms.detailTile.value) {
    uniforms.detailTile.value = grainTile();
    uniforms.detailSize.value = LOOK.num('detail-size', 0.25);
  }
  return { ...uniforms, detailMix: { value: new THREE.Vector4().fromArray(KINDS.map((k) => (k === kind ? LOOK.num(`detail-${k}`, 0) : 0))) } };
}

// Which grain a material takes (null: none): drawn wood (the bump-tagged textures) pores; the rooms'
// plain paint (walls, ceilings, trim, doors) and matt flat colours a stipple; very rough flat colours
// (bedding, upholstery, rugs) a weave. Glass, metal, glowing and see-through things, and drawn
// pictures (posters, prints) none.
export function detailOf(mesh, m, surface) {
  if (surface) return surface.detail || null;
  if (!m.isMeshStandardMaterial || m.transparent || m.transmission > 0 || m.metalness > 0.3 || m.emissiveMap) return null;
  if (/bump:/.test(m.name)) return 'wood';
  if (m.map) return null;
  for (let o = mesh; o; o = o.parent) if (o.name === 'Shell' || o.name.startsWith('door-')) return 'paint';
  if (m.roughness >= 0.9) return 'cloth';
  return m.roughness >= 0.6 ? 'paint' : null;
}

const pictures = new Map();
function picture(file) {
  if (!pictures.has(file)) pictures.set(file, new THREE.TextureLoader().loadAsync(new URL(`../assets/textures/${file}`, import.meta.url).href)
    .catch((e) => { console.warn(`texture ${file} did not load: the drawn one stays`, e); return null; }));
  return pictures.get(file);
}

// Dress a freshly loaded part of the apartment: photo textures in place of the drawn ones, and each
// material's grain (its kind in userData.detail; the numbers are read when its shader is built, since
// look.css loads after the rooms). Before it is drawn, so a replaced texture is never uploaded.
export async function dressSurfaces(root) {
  const found = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if ('detail' in m.userData) continue;
      const surface = SURFACES.find((s) => s.match(o, m));
      m.userData.detail = detailOf(o, m, surface);
      if (surface) found.push([surface, m]);
    }
  });
  const copies = new Map();
  for (const [surface, m] of found) {
    const image = await picture(surface.file);
    if (!image) continue;
    const old = m.map, key = `${surface.file}|${old.repeat.x},${old.repeat.y}`;
    if (!copies.has(key)) {
      const t = image.clone();   // (copies share one image and one upload)
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.copy(old.repeat).multiplyScalar(surface.repeat || 1);
      for (const k of ['offset', 'center']) t[k].copy(old[k]);
      for (const k of ['rotation', 'flipY', 'channel', 'anisotropy']) t[k] = old[k];
      t.needsUpdate = true;
      copies.set(key, t);
    }
    m.map = copies.get(key);
    m.userData.surface = surface.name;
  }
  return found.length;
}

// The grain tile: 256 px, every pattern tiling, each channel's average 0.5 (no change) and the same
// spread, so --detail-* alone sets how strong each is.
function grainTile(S = 256) {
  let seed = 7;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const wrap = (v) => ((v % S) + S) % S;
  // tileable value noise: cx by cy cells over the tile, added into h
  const noise = (h, cx, cy, amp) => {
    const g = Array.from({ length: cx * cy }, rnd), at = (i, j) => g[(j % cy) * cx + (i % cx)];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const fx = (x / S) * cx, fy = (y / S) * cy, x0 = Math.floor(fx), y0 = Math.floor(fy);
      let tx = fx - x0, ty = fy - y0;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      h[y * S + x] += amp * ((at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty);
    }
  };
  const ch = KINDS.map(() => new Float32Array(S * S));
  const [wood, cloth, paint, stone] = ch;
  // wood: grain streaks along u (noise stretched 16 to 1), then pores, short dark dashes along the grain
  noise(wood, 4, 64, 0.6); noise(wood, 8, 128, 0.4);
  for (let k = 0; k < 2200; k++) {
    const x = Math.floor(rnd() * S), y = Math.floor(rnd() * S), len = 2 + Math.floor(rnd() * 6), d = 0.25 + rnd() * 0.35;
    for (let i = 0; i < len; i++) wood[y * S + wrap(x + i)] -= d;
  }
  // cloth: a plain weave, threads 4 px (about 4 mm) apart, each thread a little lighter or darker
  const warp = Array.from({ length: S / 4 }, rnd), weft = Array.from({ length: S / 4 }, rnd);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = x >> 2, j = y >> 2, u = Math.sin(Math.PI * ((x % 4) + 0.5) / 4), v = Math.sin(Math.PI * ((y % 4) + 0.5) / 4);
    cloth[y * S + x] = (i + j) & 1 ? u * (0.55 + 0.45 * v) + 0.3 * warp[i] : v * (0.55 + 0.45 * u) + 0.3 * weft[j];
  }
  // paint: a roller's stipple, mostly 2 to 8 px bumps over a faint unevenness
  noise(paint, 16, 16, 0.15); noise(paint, 64, 64, 0.4); noise(paint, 128, 128, 0.45);
  // stone: a little cloudiness and speckles, light and dark, 1 to 4 px
  noise(stone, 8, 8, 0.3); noise(stone, 32, 32, 0.2);
  for (let k = 0; k < 1800; k++) {
    const cx = rnd() * S, cy = rnd() * S, r = 0.6 + rnd() * 1.6, d = (rnd() < 0.6 ? -1 : 1) * (0.3 + rnd() * 0.5);
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) stone[wrap(y) * S + wrap(x)] += d;
    }
  }
  const data = new Uint8Array(S * S * 4);
  ch.forEach((h, c) => {
    let mean = 0, sq = 0;
    for (const v of h) { mean += v; sq += v * v; }
    mean /= h.length;
    const sd = Math.sqrt(sq / h.length - mean * mean) || 1;
    for (let i = 0; i < h.length; i++) data[i * 4 + c] = Math.max(0, Math.min(255, Math.round(127.5 + ((h[i] - mean) / sd) * 0.17 * 255)));
  });
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// The shader's side (baked-ao.js puts it in the rooms' patch): a factor round 1 for the surface's colour,
// read on the world plane the surface faces most. Not in Low's plain (Lambert) materials.
export const DETAIL_FRAGMENT = /* glsl */`
  uniform sampler2D detailTile;
  uniform float detailSize;
  uniform vec4 detailMix;
  float surfaceDetail() {
    vec3 n = abs(vAoNormal);
    vec2 p = n.y >= max(n.x, n.z) ? vAoPos.xz : (n.x >= n.z ? vAoPos.zy : vAoPos.xy);
    return 1.0 + dot(texture(detailTile, p / detailSize) - 0.5, detailMix) * 2.0;
  }`;
