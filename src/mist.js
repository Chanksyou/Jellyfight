// Ground mist: a low, uneven fog that hugs the floor of every room, tinted by the baked light where it lies.
// Pure shader maths, no draw, pass or program of its own: the room's one shader patch (baked-ao.js) and the
// jelly's and bugs' tint (baked-light.js tintShader) call mistAt() after three.js's own fog, so the numbers
// here are the whole cost (uniforms; the clock is the only one that changes). The height fog is the closed-form
// integral of a density that falls off as exp(-height / --mist-height) along the eye ray (Inigo Quilez's formula),
// so a table top or the sofa seat stands clear of it and the floor sits in it. Patches (a few sines on x,z, no
// texture) swing the thickness between 1 - patch and 1 + patch times the mean, drifting with the clock.
// Numbers: content/look.css (--mist*, each with an -act<n> mood; act 4's follow its dawn); ?mist=0 turns it off.
import * as THREE from 'three';
import { LOOK } from './look.js';

export const MIST = {
  uniforms: {
    mistK: { value: 0 },                       // thickness (0 = none)
    mistH: { value: 0.1 },                     // how high it reaches (m)
    mistLit: { value: 1 },                     // how much of the baked light it shows
    mistBase: { value: new THREE.Color() },    // its own colour in the dark
    mistMax: { value: 0.7 },                   // never more than this much of a pixel
    mistPatch: { value: 0.7 },                 // how uneven (0 = even)
    mistActors: { value: 0.35 },               // how much the jelly and the bugs sit in it
    mistT: { value: 0 },                       // the drift clock (wraps every 600: the patterns repeat there)
  },
  drift: 1,
  on: true,
};

// act: (name, fallback) readers with the act's own mood (main.js actNum / actColor)
export function readMist(num, color, off) {
  const U = MIST.uniforms;
  MIST.on = !off;
  U.mistK.value = off ? 0 : num('mist', 0);
  U.mistH.value = num('mist-height', 0.1);
  U.mistLit.value = num('mist-light', 1);
  U.mistBase.value.set(color('mist-color', '#202838'));
  U.mistMax.value = num('mist-max', 0.7);
  U.mistPatch.value = num('mist-patch', 0.7);
  U.mistActors.value = num('mist-actors', 0.35);
  MIST.drift = num('mist-drift', 2);
}

// a stage with a dawn: its own thickness and colour at this moment of the night
export function setMist(k, colour) {
  if (!MIST.on) return;
  MIST.uniforms.mistK.value = k;
  MIST.uniforms.mistBase.value.copy(colour);
}

// once a frame; Reduce effects holds the patches still
export function updateMist(dt, calm) {
  if (!calm) MIST.uniforms.mistT.value = (MIST.uniforms.mistT.value + dt * MIST.drift) % 600;
}

// mistAt(pos): rgb = the mist's colour there, a = how much of a pixel at pos it hides, seen from the camera.
// Needs GRID_GLSL (baked-light.js) before it. Low's plain (Lambert) materials skip the light grid: a flat colour.
export const MIST_GLSL = /* glsl */`
  uniform float mistK, mistH, mistLit, mistMax, mistPatch, mistT;
  uniform vec3 mistBase;
  float mistPatches(vec2 p) {
    float ph = mistT * 0.010471976;   // 2 pi / 600: every term below goes round a whole number of times in 600 s
    float a = sin(p.x * 5.0 + 1.3 * sin(p.y * 3.2 + ph * 5.0) + ph * 7.0);
    float b = sin(p.y * 7.5 + 1.1 * sin(p.x * 5.8 - ph * 4.0) - ph * 11.0 + 1.7);
    float c = sin((p.x + p.y) * 11.0 + sin((p.x - p.y) * 9.0 + ph * 9.0) + ph * 13.0);
    return clamp((0.55 * a + 0.3 * b + 0.15 * c) * 2.2, -1.0, 1.0);
  }
  vec4 mistAt(vec3 pos) {
    if (mistK <= 0.0) return vec4(0.0);
    vec3 rv = pos - cameraPosition;
    float T = max(length(rv), 1e-3), b = 1.0 / mistH;
    float py = max(pos.y, 0.0), dy = (py - cameraPosition.y) / T;
    float k = mistK * (1.0 + mistPatch * mistPatches(pos.xz));
    float amt = abs(py - cameraPosition.y) < 0.01 ? k * exp(-b * py) * T   // (a level eye ray: the limit of the line below)
      : k * (exp(-b * cameraPosition.y) - exp(-b * py)) / (b * dy);
    float f = min(1.0 - exp(-max(amt, 0.0)), mistMax);
    vec3 col = mistBase;
    #ifndef LAMBERT
      vec3 g = (vec3(pos.x, 0.1, pos.z) - lbGridMin) / lbGridStep + 0.5;
      if (lbGridGain > 0.0 && all(greaterThanEqual(g, vec3(0.0))) && all(lessThanEqual(g, lbGridDims))) col += lbGridDir(g, 2.0) * lbGridGain * mistLit;
    #endif
    return vec4(col, f);
  }`;
