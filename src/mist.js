// Ground mist: a low, uneven fog that hugs the floor of every room, tinted by the baked light where it lies.
// Pure shader maths, no draw, pass or program of its own: the room's one shader patch (baked-ao.js) and the
// jelly's and bugs' tint (baked-light.js tintShader) call mistAt() after three.js's own fog, so the numbers
// here are the whole cost (uniforms; the clock is the only one that changes). The height fog is the closed-form
// integral of a density that falls off as exp(-height / --mist-height) along the eye ray (Inigo Quilez's formula),
// so a table top or the sofa seat stands clear of it and the floor sits in it. Patches (a few sines on x,z, no
// texture, blended, never clipped) swing the thickness at most between 1 - patch and 1 + patch times the mean, drifting with the clock.
// The jelly parts it (F2): density falls round the jelly and along the trail it leaves (TRAIL remembered spots,
// refilling over --mist-part-refill s), a counter-rotating vortex pair at each spot bends the patches' lookup into
// curls (a Lamb-Oseen shaped spin that grows and fades with the spot's age), the patches slide round the jelly as
// in potential flow past a circle, and vents and big hits (fx.impact's 'impact') thin it where they are. All a fixed
// small loop over uniforms: no simulation, render target or draw. Low parts it without the curl maths; Reduce
// effects keeps the parting and holds the curls still.
// Numbers: content/look.css (--mist*, each with an -act<n> mood; act 4's follow its dawn); ?mist=0 turns it off.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { bus } from './events.js';
import { AMBIENT } from './ambient.js';

const TRAIL = 6;   // remembered spots behind the jelly (the 7th slot is the jelly now)
const v4 = (n) => Array.from({ length: n }, () => new THREE.Vector4());

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
    mistJ: { value: new THREE.Vector4() },     // the jelly: x, z, and its heading (cos, sin)
    mistJk: { value: new THREE.Vector4() },    // how much it parts round itself, how hard the mist flows round it, its radius (m), the oldest trail piece's fade
    mistPartP: { value: new THREE.Vector4() }, // the trail's half-width (m), how long it takes to refill (s)
    mistCurlP: { value: new THREE.Vector4() }, // a vortex's core radius squared, how fast that grows (m2/s), the flow-round radius squared
    mistTrail: { value: v4(TRAIL + 1) },       // oldest first: x, z, age (s), strength; the last is the jelly now
    mistHoles: { value: v4(6) },               // the three vents nearest the jelly, then the last three big hits: x, z, radius, strength
    mistBound: { value: 0 },                   // the jelly's trail and curls lie within this squared distance of it
    mistCurl: { value: 0 },                    // how far a vortex turns the patches at its core (rad); 0 in Reduce effects
    mistWisp: { value: 0 },                    // fine wisps on a parted edge (0 = a smooth edge)
  },
  drift: 1,
  on: true,
  part: { every: 0.5, step: 0.3, hit: 0, hitSize: 3, refill: 2.5, vent: 0.6, ventR: 0.12, ventGust: 1.5, curl: 2 },
};

const S = { at: null, x: 0, z: 0, hx: 1, hz: 0, since: 0, moved: 0, hits: [0, 0, 0], next: 0, flow: 0, vents: [null, null, null] };   // the trail's own clock and the last place it was seen

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
  const P = MIST.part, refill = num('mist-part-refill', 2.5), core = num('mist-curl-core', 0.08), flowR = num('mist-curl-flow-radius', 0.2);
  Object.assign(P, { refill, every: refill / (TRAIL - 1), step: num('mist-part-step', 0.3), hit: num('mist-hole', 0.9), hitSize: num('mist-hole-size', 3),
    vent: num('mist-vent', 0.6), ventR: num('mist-vent-radius', 0.12), ventGust: num('mist-vent-gust', 1.5), curl: num('mist-curl', 2),
    part: num('mist-part', 0.85), flow: num('mist-curl-flow', 1), ease: Math.max(0.01, num('mist-curl-ease', 0.5)), lift: num('mist-part-lift', 0.3) });
  U.mistJk.value.z = num('mist-part-radius', 0.14);
  U.mistPartP.value.set(num('mist-part-trail', 0.1), refill, 0, 0);
  U.mistCurlP.value.set(core * core, num('mist-curl-spread', 0.004), flowR * flowR, 0);
  U.mistWisp.value = num('mist-wisp', 0.8);
  for (const h of U.mistHoles.value) h.w = 0;
  S.at = null;
}

// a big hit punches a hole in it that refills (the oldest of three)
bus.on('impact', ({ pos, size }) => {
  const P = MIST.part, h = MIST.uniforms.mistHoles.value[3 + S.next];
  h.set(pos.x, pos.z, THREE.MathUtils.clamp(size * P.hitSize, 0.1, 0.4), P.hit * lift(pos.y));
  S.hits[S.next] = 0;
  S.next = (S.next + 1) % 3;
});

// how much of the mist something at height y moves: all of it on the floor, none from a table top
function lift(y) { return 1 - THREE.MathUtils.smoothstep(y, 0.05, MIST.part.lift); }

// a stage with a dawn: its own thickness and colour at this moment of the night
export function setMist(k, colour) {
  if (!MIST.on) return;
  MIST.uniforms.mistK.value = k;
  MIST.uniforms.mistBase.value.copy(colour);
}

// once a frame, after ambient.update (the jelly is its wake, gust 0); Reduce effects holds the patches and curls still.
// vents: the act's (traversal.js), air: their VentAir (how hard each blows now, and which was last ridden)
export function updateMist(dt, calm, vents = [], air = null) {
  const U = MIST.uniforms, P = MIST.part;
  if (!calm) U.mistT.value = (U.mistT.value + dt * MIST.drift) % 600;
  U.mistCurl.value = calm ? 0 : P.curl;
  if (U.mistK.value <= 0) return;
  const wake = AMBIENT.uniforms.ambientGust.value[0], trail = U.mistTrail.value, now = trail[TRAIL];
  const dx = wake.x - S.x, dz = wake.z - S.z, d = Math.hypot(dx, dz), k = lift(wake.y);
  if (!S.at || d > 1) {   // a first frame or a jump (a new act, a teleport): no trail across the room
    for (const t of trail) t.set(wake.x, wake.z, P.refill, 0);
    S.at = true; S.since = 0; S.moved = 0;
  } else if (d > 1e-4) { const a = 1 - Math.exp(-dt / P.ease); S.hx += (dx / d - S.hx) * a; S.hz += (dz / d - S.hz) * a; }
  S.flow += (wake.w - S.flow) * (1 - Math.exp(-dt / P.ease));   // starts and stops ease in and out over --mist-curl-ease s
  S.x = wake.x; S.z = wake.z; S.moved += d; S.since += dt;
  for (let i = 0; i < TRAIL; i++) trail[i].z += dt;
  now.set(wake.x, wake.z, 0, k * (0.5 + 0.5 * S.flow));
  if (S.since >= P.every || S.moved >= P.step) {   // drop a spot: the oldest slot becomes the newest (no allocation)
    const old = trail[0];
    for (let i = 0; i < TRAIL - 1; i++) trail[i] = trail[i + 1];
    trail[TRAIL - 1] = old.copy(now);
    S.since = 0; S.moved = 0;
  }
  const hl = Math.hypot(S.hx, S.hz) || 1;
  U.mistJ.value.set(wake.x, wake.z, S.hx / hl, S.hz / hl);
  U.mistJk.value.x = P.part * k;
  U.mistJk.value.y = P.flow * k * S.flow * Math.min(1, hl);   // (a quick turn back shrinks the heading first, so the flow fades through it instead of flipping)
  U.mistJk.value.w = 1 - Math.min(1, Math.max(S.since / P.every, S.moved / P.step));   // the oldest piece fades out before its slot is reused
  let far = 0;
  for (const t of trail) far = Math.max(far, Math.hypot(t.x - wake.x, t.y - wake.z));
  far += 2 * U.mistPartP.value.x + 3 * Math.sqrt(U.mistCurlP.value.x + U.mistCurlP.value.y * P.refill) + 4 * U.mistJk.value.z;
  U.mistBound.value = far * far;
  // the three vents nearest the jelly thin the mist over themselves; a ride's gust pushes it further out
  const holes = U.mistHoles.value, flow = air ? air.look.uniforms.uFlow.value : 1, gust = air ? air.gustNow() : 0, picked = S.vents;
  for (let j = 0; j < 3; j++) {
    let best = null, bd = Infinity;
    for (const v of vents) {
      const vd = (v.x - wake.x) ** 2 + (v.z - wake.z) ** 2;
      if (vd < bd && !picked.includes(v, 3 - j)) { bd = vd; best = v; }
    }
    picked[2 - j] = best;
    const h = holes[j], g = best && air?.ridden === best ? gust : 0;
    if (best) h.set(best.x, best.z, P.ventR * (1 + P.ventGust * g), Math.max(P.vent * flow, g));
    else h.w = 0;
  }
  picked.fill(null);
  for (let j = 0; j < 3; j++) {   // the big hits refill
    S.hits[j] += dt;
    const h = holes[3 + j];
    if (h.w > 0) h.w = S.hits[j] >= P.refill ? 0 : h.w * Math.max(0, 1 - dt / Math.max(1e-3, P.refill - S.hits[j] + dt));
  }
}

// mistAt(pos): rgb = the mist's colour there, a = how much of a pixel at pos it hides, seen from the camera.
// Needs GRID_GLSL (baked-light.js) before it. Low's plain (Lambert) materials skip the light grid: a flat colour.
export const MIST_GLSL = /* glsl */`
  uniform float mistK, mistH, mistLit, mistMax, mistPatch, mistT;
  uniform vec3 mistBase;
  uniform vec4 mistJ, mistJk, mistPartP, mistCurlP, mistTrail[${TRAIL + 1}], mistHoles[6];
  uniform float mistBound, mistCurl, mistWisp;
  vec2 mistSpin(vec2 q, vec2 c, float a) { vec2 d = q - c; float s = sin(a), k = cos(a); return c + vec2(k * d.x - s * d.y, s * d.x + k * d.y); }
  // how much of the mist is left at p (1 = all) after the vents, the big hits, the jelly and its trail;
  // q comes back as where to read the patches there, bent by the trail's vortex pairs and the flow round the jelly
  float mistWake(vec2 p, out vec2 q) {
    q = p;
    float keep = 1.0;
    for (int i = 0; i < 6; i++) { vec4 h = mistHoles[i]; vec2 d = p - h.xy; keep *= 1.0 - h.w * exp(-dot(d, d) / (h.z * h.z)); }
    vec2 dj = p - mistJ.xy;
    float rj = dot(dj, dj);
    if (rj > mistBound) return keep;
    keep *= 1.0 - mistJk.x * exp(-rj / (mistJk.z * mistJk.z));
    float R = mistPartP.x, refill = mistPartP.y;
    #ifndef LAMBERT
      if (mistCurl > 0.0) {
        for (int i = 0; i < ${TRAIL}; i++) {   // a counter-rotating pair at each spot, one each side of the path (Lamb-Oseen: the core widens with age)
          vec4 a = mistTrail[i];
          vec2 ab = mistTrail[i + 1].xy - a.xy;
          float L = length(ab);
          if (L < 1e-3 || a.w <= 0.0) continue;
          vec2 n = vec2(-ab.y, ab.x) * (R / L);
          float R2 = mistCurlP.x + mistCurlP.y * a.z;
          float ang = mistCurl * a.w * smoothstep(0.0, 0.35, a.z) * (1.0 - smoothstep(0.3 * refill, refill, a.z)) * mistCurlP.x / R2;
          vec2 c = a.xy + n, d = q - c;
          q = mistSpin(q, c, ang * exp(-dot(d, d) / R2));
          c = a.xy - n; d = q - c;
          q = mistSpin(q, c, -ang * exp(-dot(d, d) / R2));
        }
      }
    #endif
    vec2 qv = q;
    for (int i = 0; i < ${TRAIL}; i++) {   // the trail: a soft band along each piece, refilling (and widening a little) with age
      vec4 a = mistTrail[i], b = mistTrail[i + 1];
      vec2 ab = b.xy - a.xy, e = qv - a.xy;
      float t = clamp(dot(e, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
      e -= ab * t;
      float age = mix(a.z, b.z, t), s = mix(a.w, b.w, t) * (i == 0 ? mistJk.w : 1.0), rr = R * (1.0 + 0.6 * age / refill);
      keep *= 1.0 - s * (1.0 - smoothstep(0.0, refill, age)) * exp(-dot(e, e) / (rr * rr));
    }
    #ifndef LAMBERT
      if (mistCurl > 0.0) {   // potential flow past a circle round the jelly (z + a2/z, in its own frame): the patches slide round it
        vec2 z = vec2(dot(dj, mistJ.zw), dot(dj, vec2(-mistJ.w, mistJ.z)));
        vec2 bend = mistJk.y * mistCurlP.z / max(rj, mistCurlP.z) * vec2(z.x, -z.y);
        q += vec2(bend.x * mistJ.z - bend.y * mistJ.w, bend.x * mistJ.w + bend.y * mistJ.z);
      }
    #endif
    return keep;
  }
  // fine wisps along a parted edge
  float mistFine(vec2 q) {
    float ph = mistT * 0.010471976;
    return sin(q.x * 38.0 + 2.0 * sin(q.y * 23.0 + ph * 17.0)) * sin(q.y * 34.0 + 2.0 * sin(q.x * 27.0 - ph * 19.0));
  }
  float mistPatches(vec2 p) {
    float ph = mistT * 0.010471976;   // 2 pi / 600: every term below goes round a whole number of times in 600 s
    float a = sin(p.x * 5.0 + 1.3 * sin(p.y * 3.2 + ph * 5.0) + ph * 7.0);
    float b = sin(p.y * 7.5 + 1.1 * sin(p.x * 5.8 - ph * 4.0) - ph * 11.0 + 1.7);
    float c = sin((p.x + p.y) * 11.0 + sin((p.x - p.y) * 9.0 + ph * 9.0) + ph * 13.0);
    return 0.55 * a + 0.3 * b + 0.15 * c;   // soft, never clipped: thin spots fade into thick ones
  }
  vec4 mistAt(vec3 pos) {
    if (mistK <= 0.0) return vec4(0.0);
    vec3 rv = pos - cameraPosition;
    float T = max(length(rv), 1e-3), b = 1.0 / mistH;
    float py = max(pos.y, 0.0), dy = (py - cameraPosition.y) / T;
    float ray = abs(py - cameraPosition.y) < 0.01 ? exp(-b * py) * T   // (a level eye ray: the limit of the line below)
      : (exp(-b * cameraPosition.y) - exp(-b * py)) / (b * dy);
    if (mistK * (1.0 + mistPatch) * ray < 0.004) return vec4(0.0);   // (above the mist: a table top, a wall)
    vec2 q;
    float keep = mistWake(pos.xz, q);
    float k = mistK * (1.0 + mistPatch * mistPatches(q)) * keep;
    if (keep < 0.98) k *= 1.0 + mistWisp * 4.0 * keep * (1.0 - keep) * mistFine(q);
    float f = min(1.0 - exp(-max(k * ray, 0.0)), mistMax);
    vec3 col = mistBase;
    #ifndef LAMBERT
      vec3 g = (vec3(pos.x, 0.1, pos.z) - lbGridMin) / lbGridStep + 0.5;
      if (lbGridGain > 0.0 && all(greaterThanEqual(g, vec3(0.0))) && all(lessThanEqual(g, lbGridDims))) col += lbGridDir(g, 2.0) * lbGridGain * mistLit;
    #endif
    return vec4(col, f);
  }`;
