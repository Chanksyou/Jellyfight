// Ground mist: a low, uneven fog that hugs the floor of every room, tinted by the baked light where it lies.
// The room's one shader patch (baked-ao.js) and the jelly's and bugs' tint (baked-light.js tintShader) call
// mistAt() after three.js's own fog. The height fog is the closed-form integral of a density that falls off
// as exp(-height / --mist-height) along the eye ray (Inigo Quilez's formula), so a table top or the sofa seat
// stands clear of it and the floor sits in it. Patches (a few sines on x,z, blended, never clipped) swing the
// thickness at most between 1 - patch and 1 + patch times the mean, drifting with the clock.
// The jelly's parting, trail, curls, vents and big hits (fx.impact's 'impact') are accumulated once per frame
// into a 128x128 scrolling 2D ping-pong GPU wake buffer (3.2 m x 3.2 m centered on the jelly), so mistAt()
// replaces the per-fragment multi-loop analytical wake with a single bilinear texture fetch. Low parts it
// without the curl UV bend; Reduce effects keeps the parting and holds the patches and curls still.
// Numbers: content/look.css (--mist*, each with an -act<n> mood; act 4's follow its dawn); ?mist=0 turns it off.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { bus } from './events.js';
import { AMBIENT } from './ambient.js';

const TRAIL = 6;   // remembered spots behind the jelly (the 7th slot is the jelly now)
const FIELD_RES = 128;
const FIELD_SPAN = 3.2;
const FIELD_INV_SPAN = 1 / FIELD_SPAN;
const CURL_AMP = 0.36;
const v4 = (n) => Array.from({ length: n }, () => new THREE.Vector4());

// neutral wake texel: part=0, curl=(0,0) encoded at 128/255, wisp=0
const blankField = new THREE.DataTexture(new Uint8Array([0, 128, 128, 0]), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
blankField.minFilter = THREE.LinearFilter;
blankField.magFilter = THREE.LinearFilter;
blankField.wrapS = THREE.ClampToEdgeWrapping;
blankField.wrapT = THREE.ClampToEdgeWrapping;
blankField.generateMipmaps = false;
blankField.needsUpdate = true;

const field = {
  rts: null,
  cur: 0,
  tex: blankField,
  needsClear: true,
  prevOrigin: new THREE.Vector2(),
  scene: null,
  camera: null,
  mat: null,
  quad: null,
};

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
    mistOrigin: { value: new THREE.Vector2() }, // center of the 2D wake window (world x, z)
    mistInvSpan: { value: FIELD_INV_SPAN },    // 1 / window span (m^-1)
    mistCurlAmp: { value: CURL_AMP },          // world-space UV bend amplitude for stored curl
    mistField: {
      get value() {
        const U = MIST.uniforms;
        if (U.mistJk.value.x === 0 && U.mistTrail.value.every((t) => t.w === 0) && U.mistHoles.value.every((h) => h.w === 0)) {
          return blankField;
        }
        return field.tex;
      },
    },
  },
  drift: 1,
  on: true,
  part: { every: 0.5, step: 0.3, hit: 0, hitSize: 3, refill: 2.5, vent: 0.6, ventR: 0.12, ventGust: 1.5, curl: 2 },
};

const S = { at: null, x: 0, z: 0, hx: 1, hz: 0, since: 0, moved: 0, hits: [0, 0, 0], next: 0, flow: 0, vents: [null, null, null] };   // the trail's own clock and the last place it was seen

const FIELD_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FIELD_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev;
  uniform vec2 uOrigin, uPrevOrigin;
  uniform float uSpan, uInvSpan, uDt, uRefill, uCurl, uCalm, uTime;
  uniform vec4 uJ, uJk, uPartP, uCurlP, uHoles[6];

  const float ZERO = 128.0 / 255.0;

  vec4 samplePrev(vec2 uv) {
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0, ZERO, ZERO, 0.0);
    return texture2D(uPrev, uv);
  }

  void main() {
    vec2 worldPos = uOrigin + (vUv - 0.5) * uSpan;
    vec2 prevUv = vUv + (uOrigin - uPrevOrigin) * uInvSpan;
    vec4 prev0 = samplePrev(prevUv);
    vec2 flow0 = (prev0.gb - ZERO) * 2.0;

    vec4 prev = prev0;
    if (uCalm < 0.5 && uCurl > 0.0) {
      vec2 advUv = prevUv - flow0 * (0.22 * uDt * uInvSpan);
      prev = samplePrev(advUv);
    }

    // exponential + linear floor decay so RGBA8 cleanly reaches exact neutral (0, 128/255, 128/255, 0)
    float refill = max(uRefill, 0.1);
    float partDecay = exp(-uDt / (refill * 0.45));
    float part = max(0.0, prev.r * partDecay - uDt * (0.35 / refill));

    vec2 curl = vec2(0.0);
    if (uCalm < 0.5 && uCurl > 0.0) {
      curl = (prev.gb - ZERO) * 2.0;
      float cLen = length(curl);
      if (cLen > 1e-4) {
        float cDecay = exp(-uDt / (refill * 0.4));
        curl *= max(0.0, cLen * cDecay - uDt * (0.35 / refill)) / cLen;
      } else {
        curl = vec2(0.0);
      }
    }

    float wispDecay = exp(-uDt / (refill * 0.35));
    float wisp = max(0.0, prev.a * wispDecay - uDt * (0.4 / refill));

    // splat up to 6 holes (3 nearest vents + 3 recent big hits)
    for (int i = 0; i < 6; i++) {
      vec4 h = uHoles[i];
      if (h.w <= 0.0 || h.z <= 0.0) continue;
      vec2 dh = worldPos - h.xy;
      float rr = h.z * h.z, d2 = dot(dh, dh);
      if (d2 < rr * 6.0) {
        part = max(part, h.w * exp(-d2 / rr));
      }
    }

    // splat jelly body parting
    vec2 dj = worldPos - uJ.xy;
    float rj = dot(dj, dj);
    float jr2 = max(uJk.z * uJk.z, 1e-4);
    if (uJk.x > 0.0 && rj < jr2 * 8.0) {
      part = max(part, uJk.x * exp(-rj / jr2));
    }

    // splat potential-flow dipole + counter-rotating vortex pair when moving and not calm
    if (uCalm < 0.5 && uCurl > 0.0 && uJk.y > 0.001) {
      float flowR2 = max(uCurlP.z, 1e-4);
      if (rj < flowR2 * 9.0) {
        vec2 z = vec2(dot(dj, uJ.zw), dot(dj, vec2(-uJ.w, uJ.z)));
        vec2 bend = uJk.y * flowR2 / max(rj, flowR2) * vec2(z.x, -z.y);
        vec2 dipole = vec2(bend.x * uJ.z - bend.y * uJ.w, bend.x * uJ.w + bend.y * uJ.z);
        float wDip = exp(-rj / (flowR2 * 2.5));
        curl = mix(curl, clamp(dipole * 2.0, -0.95, 0.95), min(1.0, wDip * uDt * 8.0));
      }
      vec2 back = uJ.xy - uJ.zw * (uJk.z * 1.1);
      vec2 side = vec2(-uJ.w, uJ.z) * max(uPartP.x * 1.1, 0.05);
      float coreR2 = max(uCurlP.x, 1e-4);
      vec2 dL = worldPos - (back + side);
      vec2 dR = worldPos - (back - side);
      float wL = exp(-dot(dL, dL) / (coreR2 * 2.5));
      float wR = exp(-dot(dR, dR) / (coreR2 * 2.5));
      vec2 vort = (vec2(-dL.y, dL.x) * wL - vec2(-dR.y, dR.x) * wR) * (uCurl * uJk.y * 2.4 * uDt);
      curl += vort;
      float cl = length(curl);
      if (cl > 0.95) curl *= 0.95 / cl;
    }

    // lightweight edge wisp energy computed once per 128x128 texel instead of per screen fragment
    float edge = 4.0 * part * (1.0 - part);
    if (edge > 0.02) {
      float ph = uTime * 0.010471976;
      float rip = 0.5 + 0.5 * sin(worldPos.x * 32.0 + 1.5 * sin(worldPos.y * 21.0 + ph * 17.0))
        * sin(worldPos.y * 29.0 + 1.5 * sin(worldPos.x * 25.0 - ph * 19.0));
      wisp = max(wisp, edge * rip);
    }

    gl_FragColor = vec4(clamp(part, 0.0, 1.0), clamp(ZERO + curl.x * 0.5, 0.0, 1.0), clamp(ZERO + curl.y * 0.5, 0.0, 1.0), clamp(wisp, 0.0, 1.0));
  }
`;

function ensureField() {
  if (field.rts) return;
  const opts = {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  };
  field.rts = [new THREE.WebGLRenderTarget(FIELD_RES, FIELD_RES, opts), new THREE.WebGLRenderTarget(FIELD_RES, FIELD_RES, opts)];
  field.cur = 0;
  field.needsClear = true;
  if (!field.scene) {
    const U = MIST.uniforms;
    field.mat = new THREE.ShaderMaterial({
      vertexShader: FIELD_VERT,
      fragmentShader: FIELD_FRAG,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
      uniforms: {
        uPrev: { value: blankField },
        uOrigin: { value: U.mistOrigin.value },
        uPrevOrigin: { value: field.prevOrigin },
        uSpan: { value: FIELD_SPAN },
        uInvSpan: { value: FIELD_INV_SPAN },
        uDt: { value: 0 },
        uRefill: { value: 2.5 },
        uCurl: { value: 0 },
        uCalm: { value: 0 },
        uTime: { value: 0 },
        uJ: { value: U.mistJ.value },
        uJk: { value: U.mistJk.value },
        uPartP: { value: U.mistPartP.value },
        uCurlP: { value: U.mistCurlP.value },
        uHoles: { value: U.mistHoles.value },
      },
    });
    field.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), field.mat);
    field.quad.frustumCulled = false;
    field.scene = new THREE.Scene();
    field.scene.add(field.quad);
    field.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
}

export function resetMistField() {
  if (field.rts) {
    field.rts[0].dispose();
    field.rts[1].dispose();
    field.rts = null;
  }
  field.cur = 0;
  field.tex = blankField;
  field.needsClear = true;
}

export function stepMistField(renderer, dt, calm) {
  const U = MIST.uniforms;
  if (!renderer || dt <= 0 || U.mistK.value <= 0) return;
  ensureField();
  const src = field.needsClear ? blankField : field.rts[field.cur].texture;
  const dstIdx = 1 - field.cur;
  const dst = field.rts[dstIdx];
  const fu = field.mat.uniforms;
  fu.uPrev.value = src;
  fu.uDt.value = Math.min(dt, 0.25);
  fu.uRefill.value = MIST.part.refill;
  fu.uCurl.value = U.mistCurl.value;
  fu.uCalm.value = calm ? 1 : 0;
  fu.uTime.value = U.mistT.value;

  const prevTarget = renderer.getRenderTarget();
  const prevAutoClear = renderer.autoClear;
  const prevXr = renderer.xr.enabled;
  renderer.autoClear = false;
  renderer.xr.enabled = false;
  renderer.setRenderTarget(dst);
  renderer.render(field.scene, field.camera);
  renderer.setRenderTarget(prevTarget);
  renderer.autoClear = prevAutoClear;
  renderer.xr.enabled = prevXr;

  field.cur = dstIdx;
  field.tex = dst.texture;
  field.needsClear = false;
  field.prevOrigin.copy(U.mistOrigin.value);
}

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
  field.needsClear = true;
  field.tex = blankField;
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
export function updateMist(dt, calm, vents = [], air = null, renderer = null) {
  const U = MIST.uniforms, P = MIST.part;
  if (!calm) U.mistT.value = (U.mistT.value + dt * MIST.drift) % 600;
  U.mistCurl.value = calm ? 0 : P.curl;
  if (U.mistK.value <= 0) return;
  const wake = AMBIENT.uniforms.ambientGust.value[0], trail = U.mistTrail.value, now = trail[TRAIL];
  const dx = wake.x - S.x, dz = wake.z - S.z, d = Math.hypot(dx, dz), k = lift(wake.y);
  if (!S.at || d > 1) {   // a first frame or a jump (a new act, a teleport): no trail across the room
    for (const t of trail) t.set(wake.x, wake.z, P.refill, 0);
    S.at = true; S.since = 0; S.moved = 0;
    field.needsClear = true;
    field.prevOrigin.set(wake.x, wake.z);
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
  U.mistOrigin.value.set(wake.x, wake.z);
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
  if (renderer) stepMistField(renderer, dt, calm);
}

// mistAt(pos, liteLight): rgb = the mist's colour there, a = how much of a pixel at pos it hides, seen from the camera.
// Needs GRID_GLSL (baked-light.js) before it. Low's plain (Lambert) materials reuse the room's already-sampled baked light instead of reading the light grid again.
export const MIST_GLSL = /* glsl */`
  uniform float mistK, mistH, mistLit, mistMax, mistPatch, mistT, mistWisp, mistInvSpan, mistCurlAmp;
  uniform vec3 mistBase;
  uniform vec2 mistOrigin;
  uniform sampler2D mistField;
  float mistPatches(vec2 p) {
    float ph = mistT * 0.010471976;   // 2 pi / 600: every term below goes round a whole number of times in 600 s
    float a = sin(p.x * 5.0 + 1.3 * sin(p.y * 3.2 + ph * 5.0) + ph * 7.0);
    float b = sin(p.y * 7.5 + 1.1 * sin(p.x * 5.8 - ph * 4.0) - ph * 11.0 + 1.7);
    float c = sin((p.x + p.y) * 11.0 + sin((p.x - p.y) * 9.0 + ph * 9.0) + ph * 13.0);
    return 0.55 * a + 0.3 * b + 0.15 * c;   // soft, never clipped: thin spots fade into thick ones
  }
  vec4 mistAt(vec3 pos, vec3 liteLight, bool useLite) {
    if (mistK <= 0.0) return vec4(0.0);
    vec3 rv = pos - cameraPosition;
    float T = max(length(rv), 1e-3), b = 1.0 / mistH;
    float py = max(pos.y, 0.0), dy = (py - cameraPosition.y) / T;
    float ray = abs(py - cameraPosition.y) < 0.01 ? exp(-b * py) * T   // (a level eye ray: the limit of the line below)
      : (exp(-b * cameraPosition.y) - exp(-b * py)) / (b * dy);
    if (mistK * (1.0 + mistPatch) * ray < 0.004) return vec4(0.0);   // (above the mist: a table top, a wall)
    vec2 wuv = (pos.xz - mistOrigin) * mistInvSpan + 0.5;
    vec4 wake = (all(greaterThanEqual(wuv, vec2(0.0))) && all(lessThanEqual(wuv, vec2(1.0))))
      ? texture2D(mistField, wuv) : vec4(0.0, 0.5019608, 0.5019608, 0.0);
    float keep = 1.0 - wake.r;
    #ifndef LAMBERT
      vec2 q = pos.xz + (wake.gb - 0.5019608) * mistCurlAmp;
    #else
      vec2 q = pos.xz;
    #endif
    float k = mistK * (1.0 + mistPatch * mistPatches(q)) * keep;
    if (keep < 0.98) k *= 1.0 + mistWisp * (wake.a * 2.0 - 1.0) * 2.0 * keep * (1.0 - keep);
    float f = min(1.0 - exp(-max(k * ray, 0.0)), mistMax);
    vec3 col = mistBase;
    #ifndef LAMBERT
      if (useLite) {
        col += liteLight * mistLit;
      } else {
        vec3 g = (vec3(pos.x, 0.1, pos.z) - lbGridMin) / lbGridStep + 0.5;
        if (lbGridGain > 0.0 && all(greaterThanEqual(g, vec3(0.0))) && all(lessThanEqual(g, lbGridDims))) col += lbGridDir(g, 2.0) * lbGridGain * mistLit;
      }
    #else
      col += liteLight * mistLit;
    #endif
    return vec4(col, f);
  }
  vec4 mistAt(vec3 pos) { return mistAt(pos, vec3(0.0), false); }`;
