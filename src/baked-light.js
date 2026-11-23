// Baked light on the room's shell: Blender (Cycles) works out once how the act's lamps and windows light
// its walls, floors and ceilings, soft shadows and bounce included (tools/bake-light.mjs), and keeps it as one
// picture an act (assets/light-<act>.webp). Each wall, floor or ceiling plane has a rectangle in it; the
// game finds a surface's texel from its world position and the way its face looks (an index of planes,
// assets/light-<act>.json), so the shell needs no second UV set.
//
// The furniture reads a coarser light grid baked in the same pass: at points every 10 cm through the rooms, the light
// arriving from each of 6 directions (assets/light-<act>-grid.webp), blended by the surface's normal.
//
// In the room's shader patch (baked-ao.js) the baked light replaces the lamp diffuse. Live light
// stays on top for what moves (the jelly's glow); lamp shine stays live, so do the fill, the corner shadows
// on it and act 4's sun line. Act 4 has a second picture, its daylight, faded in with the dawn clock.
//
// The picture matches one layout and one light list (src/bake-lights.js): moving furniture or changing a lamp
// means baking again; the story engine/baked-light-is-current says so.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { fingerprint } from './baked-ao.js';
import { BAKE_LIGHTS } from './bake-lights.js';

const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1);
blank.needsUpdate = true;
const blank3 = new THREE.Data3DTexture(new Uint8Array(4), 1, 1, 1);
blank3.needsUpdate = true;
const glowColor = new THREE.Color();
let glow = null;
const uniforms = {
  lbAtlas: { value: blank }, lbDay: { value: blank }, lbIndex: { value: blank },
  lbGrid: { value: blank3 }, lbGridDay: { value: blank3 },   // the furniture's light grid (and act 4's daylight one)
  lbGridMin: { value: new THREE.Vector3() }, lbGridDims: { value: new THREE.Vector3(1, 1, 1) }, lbGridStep: { value: 0.1 },
  lbGridGain: { value: 0 },
  lbKmin: { value: new THREE.Vector3() },
  lbAtlasSize: { value: new THREE.Vector2(1, 1) },
  lbGain: { value: 0 },        // 0 = no bake here (live lamps), else the picture's top value times --baked-light
  lbDayK: { value: 0 },        // act 4: how much of the daylight picture is added (main.js, the dawn clock)
  // the jelly's glow, drawn live on top of the bake (follow() hands it over)
  lbGlowPos: { get value() { return glow ? glow.position : _zero; } },
  lbGlowColor: { get value() { return glow && glow.visible ? glowColor.copy(glow.color).multiplyScalar(glow.intensity) : glowColor.setRGB(0, 0, 0); } },
  lbGlowDist: { get value() { return glow ? glow.distance : 1; } },
  lbGlowDecay: { get value() { return glow ? glow.decay : 2; } },
};
const _zero = new THREE.Vector3();
export const BAKED_LIGHT = { uniforms, meta: null, on: true };

// the jelly's light (systems.js ShadowSystem): the one light that moves across the baked shell
export const followGlow = (light) => { glow = light; };

async function picture(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const tex = new THREE.Texture(bmp);
  tex.colorSpace = THREE.SRGBColorSpace;   // stored sRGB-encoded: the GPU turns it back into linear light
  tex.flipY = false;
  tex.generateMipmaps = false;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// The grid picture (tools/bake-light.py: column f * W + x, row z * H + y, each texel the square root of the
// light from direction f) as a 3D texture: x, y, then the 6 directions' z blocks one after another.
async function gridTexture(url, [W, H, D]) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const cv = new OffscreenCanvas(bmp.width, bmp.height), cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(bmp, 0, 0);
  const px = cx.getImageData(0, 0, bmp.width, bmp.height).data, out = new Uint8Array(W * H * D * 6 * 4);
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let f = 0; f < 6; f++) {
    const from = ((z * H + y) * bmp.width + f * W) * 4, to = (W * (y + H * (f * D + z))) * 4;
    out.set(px.subarray(from, from + W * 4), to);
  }
  const tex = new THREE.Data3DTexture(out, W, H, D * 6);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// The planes' index: a row per face direction (axis * 2, +1 when it looks down the axis), two texels per
// centimetre slot along that axis: (u0 - lo.u / res, v0 - lo.v / res, 1 / res, 1) then the plane's
// rectangle (u0, v0, u1, v1), in texels. A plane also takes the slots beside its own, so a point a hair off
// its centimetre still finds it.
export function planeIndex(planes) {
  const kmin = [Infinity, Infinity, Infinity], kmax = [-Infinity, -Infinity, -Infinity];
  for (const p of planes) { const a = p.o >> 1; kmin[a] = Math.min(kmin[a], p.k - 1); kmax[a] = Math.max(kmax[a], p.k + 1); }
  for (let a = 0; a < 3; a++) if (!Number.isFinite(kmin[a])) kmin[a] = kmax[a] = 0;
  const W = 2 * Math.max(...kmax.map((m, a) => m - kmin[a] + 1)), data = new Float32Array(W * 6 * 4);
  const put = (p, k, own) => {
    const a = p.o >> 1, i = ((p.o * W) + 2 * (k - kmin[a])) * 4;
    if (!own && data[i + 3]) return;
    const inv = 1 / p.res;
    data.set([p.u0 - p.lo[0] * inv, p.v0 - p.lo[1] * inv, inv, 1, p.u0, p.v0, p.u0 + p.w, p.v0 + p.h], i);
  };
  for (const p of planes) { put(p, p.k - 1, false); put(p, p.k + 1, false); }
  for (const p of planes) put(p, p.k, true);
  const tex = new THREE.DataTexture(data, W, 6, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return { tex, kmin };
}

// assets/light-<stage>.json and its pictures; false when this act has none
export async function loadBakedLight(stageId) {
  try {
    const meta = await fetch(`assets/light-${stageId}.json`).then((r) => (r.ok ? r.json() : null));
    if (!meta) return false;
    const day4 = meta.sets.includes('day'), g = meta.grid;
    const [atlas, day, grid, gridDay] = await Promise.all([
      picture(`assets/light-${stageId}.webp`), day4 ? picture(`assets/light-${stageId}-day.webp`) : null,
      g ? gridTexture(`assets/light-${stageId}-grid.webp`, g.dims) : null, g && day4 ? gridTexture(`assets/light-${stageId}-day-grid.webp`, g.dims) : null,
    ]);
    if (!atlas) return false;
    const { tex, kmin } = planeIndex(meta.planes);
    uniforms.lbAtlas.value = atlas;
    if (day) uniforms.lbDay.value = day;
    uniforms.lbIndex.value = tex;
    if (grid) {
      uniforms.lbGrid.value = grid;
      if (gridDay) uniforms.lbGridDay.value = gridDay;
      uniforms.lbGridMin.value.fromArray(g.min);
      uniforms.lbGridDims.value.fromArray(g.dims);
      uniforms.lbGridStep.value = g.step;
    }
    uniforms.lbKmin.value.fromArray(kmin);
    uniforms.lbAtlasSize.value.fromArray(meta.atlas);
    BAKED_LIGHT.meta = meta;
    setBakedLight(true);
    return true;
  } catch {
    return false;
  }
}

// the dev panel's switch: the bake, or every lamp live as before
export function setBakedLight(on) {
  BAKED_LIGHT.on = on;
  const m = BAKED_LIGHT.meta, gain = on && m ? LOOK.num('baked-light', 1) : 0;
  uniforms.lbGain.value = m ? m.top * gain : 0;
  uniforms.lbGridGain.value = m?.gridTop && uniforms.lbGrid.value !== blank3 ? m.gridTop * gain * LOOK.num('baked-light-furniture', 1) : 0;
  return on;
}

// What a bake was made from: the act's apartment files, its furniture layout, its lamps and its light list
// (src/bake-lights.js). A bake whose fingerprint differs is out of date (story engine/baked-light-is-current).
export async function bakeFingerprint(stageId, parts, layout) {
  const made = await fingerprint(parts, layout);
  const lamps = (await fetch('assets/apartment.json').then((r) => r.json())).lights.filter((L) => parts.includes(L.act || 'act1'));
  const buf = new TextEncoder().encode(JSON.stringify([lamps, BAKE_LIGHTS[stageId] || null]));
  made.lights = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
  return made;
}

// Read by the room's shader patch (baked-ao.js). bakedLight: the light reaching a shell point per unit of
// albedo, w = 1 where the bake covers it. The face's own direction comes from the screen derivatives of
// its position (exact on a flat face), so smoothed normals at a wall's corner never pick the wrong plane.
export const LIGHT_FRAGMENT = /* glsl */`
  uniform sampler2D lbAtlas, lbDay, lbIndex;
  uniform vec3 lbKmin, lbGlowPos, lbGlowColor;
  uniform vec2 lbAtlasSize;
  uniform float lbGain, lbDayK, lbGlowDist, lbGlowDecay;
  vec4 bakedLight(vec3 pos, vec3 nrm) {
    vec3 g = cross(dFdx(pos), dFdy(pos));
    if (lbGain <= 0.0) return vec4(0.0);
    g = normalize(g);
    if (dot(g, nrm) < 0.0) g = -g;
    vec3 ag = abs(g);
    int a = ag.x > 0.999 ? 0 : ag.y > 0.999 ? 1 : ag.z > 0.999 ? 2 : -1;
    if (a < 0) return vec4(0.0);
    float c = a == 0 ? pos.x : a == 1 ? pos.y : pos.z;
    int k = int(floor(c * 100.0 + 0.5)) - int(lbKmin[a]);
    if (k < 0 || 2 * k + 1 >= textureSize(lbIndex, 0).x) return vec4(0.0);
    int row = a * 2 + (g[a] > 0.0 ? 0 : 1);
    vec4 e = texelFetch(lbIndex, ivec2(2 * k, row), 0);
    if (e.w <= 0.0) return vec4(0.0);
    vec4 r = texelFetch(lbIndex, ivec2(2 * k + 1, row), 0);
    vec2 t = (a == 0 ? pos.zy : a == 1 ? pos.xz : pos.xy) * e.z + e.xy;
    if (any(lessThan(t, r.xy - 0.5)) || any(greaterThan(t, r.zw + 0.5))) return vec4(0.0);
    vec2 uv = t / lbAtlasSize;
    vec3 L = textureLod(lbAtlas, uv, 0.0).rgb;
    if (lbDayK > 0.0) L += textureLod(lbDay, uv, 0.0).rgb * lbDayK;
    return vec4(L * lbGain, 1.0);
  }
  // a big piece's own light map (piece-light.js): its texel in the same picture, read from its lightUv
  varying vec2 vLightUv;
  vec4 pieceLight(vec2 uv) {
    if (lbGain <= 0.0) return vec4(0.0);
    vec3 L = textureLod(lbAtlas, uv, 0.0).rgb;
    if (lbDayK > 0.0) L += textureLod(lbDay, uv, 0.0).rgb * lbDayK;
    return vec4(L * lbGain, 1.0);
  }
  // the furniture's light grid: the light arriving from the 6 directions round each point, blended by the
  // surface's normal (read half a step out from the surface, so a table top reads the air above it). w = 2:
  // the grid is coarse, so the corner shadows still darken it
  uniform sampler3D lbGrid, lbGridDay;
  uniform vec3 lbGridMin, lbGridDims;
  uniform float lbGridStep, lbGridGain;
  vec3 lbGridDir(vec3 g, float f) {
    vec3 uvw = vec3(g.xy / lbGridDims.xy, (clamp(g.z, 0.5, lbGridDims.z - 0.5) + f * lbGridDims.z) / (6.0 * lbGridDims.z));
    vec3 t = textureLod(lbGrid, uvw, 0.0).rgb;
    vec3 L = t * t;
    if (lbDayK > 0.0) { vec3 d = textureLod(lbGridDay, uvw, 0.0).rgb; L += d * d * lbDayK; }
    return L;
  }
  vec4 gridLight(vec3 pos, vec3 n) {
    if (lbGridGain <= 0.0) return vec4(0.0);
    vec3 g = (pos + n * lbGridStep * 0.5 - lbGridMin) / lbGridStep + 0.5;
    if (any(lessThan(g, vec3(0.0))) || any(greaterThan(g, lbGridDims))) return vec4(0.0);
    vec3 w = n * n;
    vec3 L = w.x * lbGridDir(g, n.x > 0.0 ? 0.0 : 1.0) + w.y * lbGridDir(g, n.y > 0.0 ? 2.0 : 3.0) + w.z * lbGridDir(g, n.z > 0.0 ? 4.0 : 5.0);
    return vec4(L * lbGridGain, 2.0);
  }
  // the jelly's glow as three.js draws a point light, legacy falloff (legacy-lighting.js)
  vec3 lbGlow(vec3 pos, vec3 nrm, vec3 diffuse) {
    vec3 l = lbGlowPos - pos;
    float d = length(l);
    float att = (lbGlowDist > 0.0 && lbGlowDecay > 0.0) ? pow(saturate(1.0 - d / lbGlowDist), lbGlowDecay) : 1.0;
    return lbGlowColor * att * saturate(dot(nrm, l / max(d, 1e-4))) * BRDF_Lambert(diffuse);
  }`;
