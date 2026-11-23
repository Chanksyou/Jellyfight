// Baked corner shadows: how open the space is around every point of an act's rooms, worked out
// once by tools/bake-ao.mjs (rays cast from a grid of points) and kept as a small 3D texture. The
// apartment's lit materials look it up by world position, so corners, the floor under the sofa
// and the gaps between furniture darken the way screen-space AO (N8AO) made them, at the cost
// of one texture read per pixel instead of a whole extra pass. Low and Medium use it in place of
// N8AO; High keeps N8AO (and this stays off there, so corners don't darken twice).
//
// The grid matches one layout: moving furniture (the layout editor, src/layout-baked.js) or
// re-exporting the apartment means baking again; the story engine/baked-ao-is-current says so.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { BAKED_LIGHT, LIGHT_FRAGMENT } from './baked-light.js';
import { AMBIENT, AMBIENT_VERTEX } from './ambient.js';

const uniforms = {
  aoVolume: { value: null },
  aoMin: { value: new THREE.Vector3() },
  aoSize: { value: new THREE.Vector3(1, 1, 1) },
  aoStrength: { value: 0 },   // shadow = openness ^ this: 0 = off (High, or nothing baked), higher = darker
  aoOpen: { value: 0.5 },     // how open a plain floor or wall reads: that much counts as no shadow
  // a stage's sun (sunrise.js sets these): everything with world z below sunLine is sunlit; far off = none
  sunLine: { value: -1e4 }, sunColor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) },
  sunFill: { value: 0 }, sunSoft: { value: 0.03 }, sunWarm: { value: 0 }, sunRim: { value: 0.035 }, sunRimGlow: { value: 0 }, sunPulse: { value: 0 },
};
export const BAKED_AO = { uniforms, meta: null };

// assets/ao-<stage>.json (where the grid sits) and assets/ao-<stage>.bin.gz (one byte per point);
// false when this act has none
export async function loadBakedAO(stageId) {
  try {
    const meta = await fetch(`assets/ao-${stageId}.json`).then((r) => (r.ok ? r.json() : null));
    if (!meta) return false;
    const res = await fetch(`assets/ao-${stageId}.bin.gz`);
    if (!res.ok) return false;
    let bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {   // still gzipped (a host that didn't unpack it)
      bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    }
    const [w, h, d] = meta.dims;
    if (bytes.length !== w * h * d) return false;
    const tex = new THREE.Data3DTexture(bytes, w, h, d);
    tex.format = THREE.RedFormat;
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping;
    tex.unpackAlignment = 1;
    tex.needsUpdate = true;
    uniforms.aoVolume.value = tex;
    uniforms.aoMin.value.fromArray(meta.min);
    uniforms.aoSize.value.fromArray(meta.size);
    uniforms.aoOpen.value = meta.open;
    BAKED_AO.meta = meta;
    return true;
  } catch {
    return false;
  }
}

// how strongly the baked shadows show for a graphics tier
export function setBakedAOTier(quality) {
  uniforms.aoStrength.value = uniforms.aoVolume.value && quality !== 'high' ? LOOK.num('baked-ao', 1) : 0;
}

// Points a little off the surface (half a grid step along its normal) so a floor reads the air
// above it, not the inside of the floor; the top of the grid fades out, nothing is baked above it.
const AO_FRAGMENT = /* glsl */`
  uniform sampler3D aoVolume;
  uniform vec3 aoMin, aoSize;
  uniform float aoStrength, aoOpen;
  varying vec3 vAoPos, vAoNormal;
  uniform float sunLine, sunFill, sunSoft, sunWarm, sunRim, sunRimGlow, sunPulse;
  uniform vec3 sunColor, sunDir;
  float bakedAO() {
    if (aoStrength <= 0.0) return 1.0;   // (pow(x, 0) is 1 anyway; this skips the texture read)
    vec3 uvw = (vAoPos + normalize(vAoNormal) * 0.02 - aoMin) / aoSize;
    if (any(lessThan(uvw, vec3(0.0))) || any(greaterThan(uvw, vec3(1.0)))) return 1.0;
    float ao = clamp(texture(aoVolume, uvw).r / aoOpen, 0.0, 1.0);
    ao = mix(ao, 1.0, smoothstep(0.85, 1.0, uvw.y));
    return pow(ao, aoStrength);
  }`;

// three.js's light loop, where Low's plain (Lambert) materials skip the lamps on a baked shell point: the
// bake already holds their light, and they have no shine to draw (one texture read in place of the lamp maths)
let loops = null;
function lampLoops() {
  if (loops) return loops;
  loops = THREE.ShaderChunk.lights_fragment_begin;
  for (const kind of ['NUM_POINT_LIGHTS', 'NUM_SPOT_LIGHTS']) {
    const at = loops.indexOf(`#if ( ${kind} > 0 )`), a = loops.indexOf('#pragma unroll_loop_start', at), b = loops.indexOf('#pragma unroll_loop_end', a);
    if (at < 0 || a < 0 || b < 0) continue;   // (another three.js: every lamp stays drawn, which still looks right)
    const end = b + '#pragma unroll_loop_end'.length;
    loops = loops.slice(0, a) + '#ifdef LAMBERT\nif ( lb.w <= 0.0 ) {\n#else\n{\n#endif\n' + loops.slice(a, end) + '\n}\n' + loops.slice(end);
  }
  return loops;
}

function patch(shader) {
  Object.assign(shader.uniforms, uniforms, BAKED_LIGHT.uniforms, AMBIENT.uniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vAoPos, vAoNormal;\nattribute vec2 lightUv;\nvarying vec2 vLightUv;' + AMBIENT_VERTEX)
    .replace('#include <project_vertex>', `#include <project_vertex>
      vec4 aoWorld = vec4(transformed, 1.0);
      vec3 aoNormal = objectNormal;
      #ifdef USE_INSTANCING
        aoWorld = instanceMatrix * aoWorld;
        aoNormal = mat3(instanceMatrix) * aoNormal;
      #endif
      #ifdef USE_BATCHING
        aoWorld = batchingMatrix * aoWorld;
        aoNormal = mat3(batchingMatrix) * aoNormal;
      #endif
      vAoPos = (modelMatrix * aoWorld).xyz;
      vec3 ambOff = ambientOffset(vAoPos);   // a plant's sway, a glass's shiver (ambient.js); zero at rest
      if (ambOff != vec3(0.0)) { mvPosition.xyz += mat3(viewMatrix) * ambOff; gl_Position = projectionMatrix * mvPosition; vAoPos += ambOff; }
      vLightUv = lightUv;
      vAoNormal = mat3(modelMatrix) * aoNormal;`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + AO_FRAGMENT + LIGHT_FRAGMENT)
    .replace('#include <lights_fragment_begin>', `vec3 lbN = normalize(vAoNormal);
      vec4 lb = vLightUv.x > 0.0 ? pieceLight(vLightUv) : bakedLight(vAoPos, lbN);
      if (lb.w <= 0.0) lb = gridLight(vAoPos, lbN);
      ${lampLoops()}`)
    .replace('#include <aomap_fragment>', `{
        // the shell's baked light (baked-light.js) in place of its lamps' diffuse; the jelly's glow stays live on top
        vec3 lbKeep = vec3(0.0);
        if (lb.w > 0.0) {
          lbKeep = lb.rgb * material.diffuseColor;
          reflectedLight.directDiffuse = lbGlow(vAoPos, lbN, material.diffuseColor);
        }
        // a stage's sun: light on the window side of the line, warming the surface's own colour, more
        // on what faces the window (wrapped, so floors and tops still read lit at a low sun), a soft
        // edge, and the hot rim on the line as glow (before the corner shadows, so they darken it too)
        float sunD = sunLine - vAoPos.z;
        if (sunD > 0.0) {
          float sunK = smoothstep(0.0, sunSoft, sunD);
          float ndl = clamp((dot(normalize(vAoNormal), sunDir) + 0.3) / 1.3, 0.0, 1.0);
          reflectedLight.directDiffuse += sunColor * diffuseColor.rgb * (sunFill * sunK * ndl);
          reflectedLight.indirectDiffuse *= 1.0 + sunWarm * sunK;
          float rim = (1.0 - smoothstep(sunRim * 0.5, sunRim, sunD)) * smoothstep(0.0, sunSoft * 0.5, sunD);
          totalEmissiveRadiance += sunColor * rim * (sunRimGlow + sunPulse);
        }
        float baked = bakedAO();
        if (lb.w > 1.5) reflectedLight.directDiffuse += lbKeep;   // the furniture's grid is coarse: the corner shadows darken it
        reflectedLight.directDiffuse *= baked;
        reflectedLight.indirectDiffuse *= baked;
        reflectedLight.indirectSpecular *= baked;
        if (lb.w < 1.5) reflectedLight.directDiffuse += lbKeep;   // (the shell's bake has its own shadows)
      }
      #include <aomap_fragment>`);
}

// the apartment's lit materials read the baked shadows and a stage's sun (one shared patch, so one program each)
export function shadeWithBakedAO(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (!(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial) || m.onBeforeCompile === patch) continue;
      m.onBeforeCompile = patch;
      m.defaultAttributeValues = { ...m.defaultAttributeValues, lightUv: [0, 0], ambient: [0, 0] };   // a mesh without a light map reads zero (piece-light.js), one that never moves zero (ambient.js)
      m.needsUpdate = true;
    }
  });
}

// What a bake was made from: the act's apartment files and its furniture layout. A bake whose
// fingerprint differs from the game's now is out of date (story engine/baked-ao-is-current).
export async function fingerprint(parts, layout) {
  const hex = async (buf) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
  const files = {};
  for (const part of parts) files[part] = await hex(await fetch(`assets/apartment-${part}.glb`).then((r) => r.arrayBuffer()));
  return { files, layout: await hex(new TextEncoder().encode(JSON.stringify(layout || {}))) };
}
