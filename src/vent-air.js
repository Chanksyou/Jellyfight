// How a floor vent looks: a real grille (frame, louvres, a dark duct), and air you can see only by
// what it carries: thin wisps that rise and spread, dust motes, and tell-tale ribbons tied to the
// louvres. Four draws for every vent in the act together (grille, ribbons, wisps, motes), all motion
// in the vertex shaders: nothing is moved or uploaded per frame but the clock. Colours and sizes are
// `--vent-*` in content/look.css. Traversal hands its vents here and calls build() when one is moved.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { bus } from './events.js';
import { BAKED_LIGHT, GRID_GLSL } from './baked-light.js';

const SEG = 20, TAIL_SEG = 10;
// the stream's top: the surface the ride lands on, where the air fades out
const topOf = (v) => Math.max(0.05, v.land[1] + 0.01 - v.y);

function box(out, cx, cy, cz, sx, sy, sz, tilt, col) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  if (tilt) g.rotateX(tilt);
  g.translate(cx, cy, cz);
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set(col, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  out.push(g.toNonIndexed());
}
function merge(list) {
  const g = new THREE.BufferGeometry();
  for (const name of Object.keys(list[0].attributes)) {
    const size = list[0].attributes[name].itemSize, arr = new Float32Array(list.reduce((s, x) => s + x.attributes[name].count, 0) * size);
    let o = 0;
    for (const x of list) { arr.set(x.attributes[name].array, o); o += x.attributes[name].array.length; }
    g.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  return g;
}

const rgb = (name, fallback) => new THREE.Color(LOOK.color(name, fallback)).toArray();

// one grille: w along x, d along z, 3 mm tall, its foot at y = 0
function grilleParts(out, v) {
  const w = v.radius * 2.2, d = v.radius * 1.6, t = 0.0032, b = 0.007;
  const paint = rgb('vent-grille', '#5c5f64'), slat = rgb('vent-grille-slat', '#45484d'), duct = [0.012, 0.012, 0.014];
  const at = (g0) => { for (let i = g0; i < out.length; i++) out[i].translate(v.x, v.y, v.z); };
  const g0 = out.length;
  box(out, 0, 0.0004, 0, w - b, 0.0006, d - b, 0, duct);                       // the dark of the duct
  box(out, 0, t / 2, -d / 2 + b / 2, w, t, b, 0, paint); box(out, 0, t / 2, d / 2 - b / 2, w, t, b, 0, paint);
  box(out, -w / 2 + b / 2, t / 2, 0, b, t, d - 2 * b, 0, paint); box(out, w / 2 - b / 2, t / 2, 0, b, t, d - 2 * b, 0, paint);
  const n = 7, span = d - 2 * b;
  for (let i = 0; i < n; i++) box(out, 0, t * 0.55, -span / 2 + (i + 0.5) * span / n, w - 2 * b, 0.0011, span / n * 0.78, -0.62, slat);   // angled louvres
  box(out, 0, t * 0.6, 0, 0.0016, t, span, 0, slat);                           // the centre rib
  at(g0);
}

const COMMON = /* glsl */`
  uniform float uTime; uniform float uCalm; uniform float uSpread; uniform float uFlow;
  uniform vec4 uGust;        // the vent last ridden: xy its x and z, z its radius, w how hard it gusts now (0..1)
  uniform float uGustClock;  // that vent's extra time since its ride began, so its streaks run fast without jumping
  float inGust(vec3 p) { return step(distance(p.xz, uGust.xy), uGust.z + 0.005); }
`;
// The room's baked light where the air is (the furniture's light grid, baked-light.js), so the air shows in the
// room's own light: rgb its hue (--vent-light-tint of the way to the light's colour), a how bright it is there
// (--vent-light of the way from 1 to the light's level over --vent-light-ref, kept within --vent-light-min..max).
// White and 1 where there is no bake. Vertex shaders only, a few reads a vertex.
const LIT = GRID_GLSL + /* glsl */`
  uniform float uLit, uLitRef, uLitMin, uLitMax, uLitTint;
  vec4 airLight(vec3 p) {
    if (lbGridGain <= 0.0) return vec4(1.0);
    vec3 g = (p - lbGridMin) / lbGridStep + 0.5;
    if (any(lessThan(g, vec3(0.0))) || any(greaterThan(g, lbGridDims))) return vec4(1.0);
    vec3 L = (lbGridDir(g, 0.0) + lbGridDir(g, 1.0) + lbGridDir(g, 2.0) + lbGridDir(g, 3.0) + lbGridDir(g, 4.0) + lbGridDir(g, 5.0)) * (lbGridGain / 6.0);
    float lum = dot(L, vec3(0.3, 0.55, 0.15));
    vec3 hue = mix(vec3(1.0), L / max(lum, 1e-4), uLitTint);
    return vec4(hue / max(max(hue.r, hue.g), max(hue.b, 1e-4)), mix(1.0, clamp(lum / uLitRef, uLitMin, uLitMax), uLit));
  }
`;

// Wisps: flat ribbons that always face the camera, static; only the streak pattern and a sway move
function wispMesh(vents, look) {
  const WISPS = LOOK.num('vent-wisps', 6), PUFFS = LOOK.num('vent-puffs', 4), spread = LOOK.num('vent-spread', 1.6);
  const X = [], P = [], B = [], A = [];   // X: where the ribbon stands at rest (the shape the Overdraw view draws) | P: side, t, seed | B: base xyz + height | A: angle, radius, reach, speed
  const idx = [];
  let n = 0;
  for (const v of vents) for (let k = 0; k < WISPS + PUFFS; k++) {
    const puff = k >= WISPS, seed = Math.random(), ang = (k / (puff ? PUFFS : WISPS)) * Math.PI * 2 + Math.random();
    const top = topOf(v), h = puff ? Math.min(top, 0.07 + Math.random() * 0.05) : top * (0.85 + Math.random() * 0.15);
    const rad = v.radius * (0.2 + Math.random() * 0.5), speed = 0.7 + Math.random() * 0.6;
    for (let s = 0; s <= SEG; s++) for (const side of [-1, 1]) {
      P.push(side, s / SEG, seed);
      X.push(v.x + Math.cos(ang) * rad + side * 0.01, v.y + (s / SEG) * h, v.z + Math.sin(ang) * rad);
      B.push(v.x, v.y, v.z, h);
      A.push(ang, rad, puff ? 1 : 0, speed);
    }
    for (let s = 0; s < SEG; s++) { const a = n + s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    n += (SEG + 1) * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(X, 3));
  g.setAttribute('wp', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('base', new THREE.Float32BufferAttribute(B, 4));
  g.setAttribute('shape', new THREE.Float32BufferAttribute(A, 4));
  g.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    uniforms: look.uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true,   // (always facing the camera: one layer, not two)
    vertexShader: WISP_VERTEX,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uWisp;
      varying vec3 vUv; varying float vPuff; varying float vGust; varying float vNear; varying float vClock; varying vec4 vLit;
      ${COMMON}
      void main() {
        float t = vUv.y, across = 1.0 - vUv.x * vUv.x;
        float run = fract(t * mix(1.6, 1.0, vPuff) - vClock * mix(0.55, 0.9, vPuff) + vUv.z * 7.0);
        float streak = smoothstep(0.0, 0.5, run) * (1.0 - smoothstep(0.62, 1.0, run));   // a soft dash with a long tail
        float ends = smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.55, 1.0, t));
        float a = across * across * streak * ends * uWisp * mix(1.0, 1.5, vPuff) * (1.0 + 0.6 * vGust);
        a *= smoothstep(0.03, 0.09, vNear) * uFlow;                                   // a ride through the stream never fills the screen
        gl_FragColor = vec4(uColor * vLit.rgb, a * vLit.a);
      }`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false; mesh.renderOrder = 2;
  return mesh;
}
const WISP_VERTEX = /* glsl */`
      attribute vec3 wp; attribute vec4 base; attribute vec4 shape;
      varying vec3 vUv; varying float vPuff; varying float vGust; varying float vNear; varying float vClock; varying vec4 vLit; varying float vView;
      uniform float uWide;
      ${COMMON}
      ${LIT}
      vec3 path(float t, float g) {
        float spread = 1.0 + uSpread * t * t;                                    // the air fans out as it slows
        float a = shape.x + t * 2.2 + sin(uTime * 0.6 + shape.x * 3.0) * 0.35 * t;
        float r = shape.y * spread + sin(uTime * 1.7 * shape.w + t * 9.0 + shape.x) * 0.006 * t * (1.0 - 0.7 * g);
        return base.xyz + vec3(cos(a) * r, t * base.w, sin(a) * r);
      }
      void main() {
        float t = wp.y, m = inGust(base.xyz), g = uGust.w * m;
        vec3 c = path(t, g), tan = normalize(path(t + 0.02, g) - c);
        vec3 right = normalize(cross(tan, cameraPosition - c));
        float width = mix(0.005, 0.016, t) * (shape.z > 0.5 ? 0.9 : 1.0) * (1.0 + 0.35 * g) * uWide;
        vUv = vec3(wp.x, t, wp.z); vPuff = shape.z; vGust = g; vClock = uTime + m * uGustClock;
        vNear = distance(c, cameraPosition);
        vLit = airLight(c);
        vec4 mv = viewMatrix * vec4(c + right * wp.x * width, 1.0);
        vView = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`;

// Heat shimmer's bend map (src/heat-shimmer.js, the ?shimmer=1 experiment): the wisps again, wider, each pixel
// writing which way to nudge the picture behind it, and nothing where the room stands in front of the air
function heatMesh(wisps, look) {
  const m = new THREE.ShaderMaterial({
    uniforms: { ...look.uniforms, uWide: { value: LOOK.num('vent-shimmer-width', 3) }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
      depthMode: { value: 0 }, near: { value: 0.005 }, far: { value: 560 }, logFar: { value: Math.log2(561) } },
    vertexShader: WISP_VERTEX,
    fragmentShader: /* glsl */`
      uniform sampler2D tDepth; uniform vec2 uRes; uniform float depthMode, near, far, logFar;
      varying vec3 vUv; varying float vNear; varying float vView;
      ${COMMON}
      float sceneDist(vec2 uv) {   // as the depth of field reads it (graphics.js)
        float d = texture2D(tDepth, uv).x;
        if (depthMode > 1.5) return (near * far) / (d * (far - near) + near);
        if (depthMode > 0.5) return exp2(d * logFar) - 1.0;
        return (near * far) / ((far - near) * d - far) * -1.0;
      }
      void main() {
        float t = vUv.y, across = 1.0 - vUv.x * vUv.x;
        float ends = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.35, 0.9, t));   // strongest just over the grille
        float a = across * ends * smoothstep(0.03, 0.09, vNear) * step(vView, sceneDist(gl_FragCoord.xy / uRes) + 0.01);
        float ph = t * 38.0 - uTime * 4.5 + vUv.z * 20.0;
        gl_FragColor = vec4(vec2(sin(ph), cos(ph * 0.73 + 1.3)) * a * (1.0 - uCalm) * uFlow, 0.0, 1.0);
      }`,
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,   // bends add up, either way
  });
  const mesh = new THREE.Mesh(wisps.geometry, m);
  mesh.frustumCulled = false;
  return mesh;
}

// Dust motes: points whose whole path is worked out from a seed and the clock
function moteMesh(vents, look) {
  const MOTES = LOOK.num('vent-motes', 28);
  const B = [], S = [];
  for (const v of vents) for (let i = 0; i < MOTES; i++) { B.push(v.x, v.y, v.z); S.push(Math.random() * 6.283, Math.sqrt(Math.random()) * v.radius, Math.random(), topOf(v)); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(B, 3));
  g.setAttribute('seed', new THREE.Float32BufferAttribute(S, 4));
  const m = new THREE.ShaderMaterial({
    uniforms: look.uniforms, transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      attribute vec4 seed; varying float vA; varying vec3 vHue;
      uniform float uPx; uniform float uPr;
      ${COMMON}
      ${LIT}
      void main() {
        float clock = uTime + inGust(position) * uGustClock;
        float life = fract(seed.z + clock * (0.16 + 0.1 * fract(seed.x * 3.7)) * 0.8 / max(seed.w, 0.3));
        float rise = 1.0 - (1.0 - life) * (1.0 - life);                       // fast off the grille, slowing as it tops out
        float a = seed.x + uTime * 0.9 + life * 4.0, r = seed.y * (0.5 + 1.9 * life);
        vec3 p = position + vec3(cos(a) * r, rise * seed.w, sin(a) * r);
        p.xz += vec2(sin(uTime * 2.3 + seed.x * 9.0), cos(uTime * 1.9 + seed.x * 5.0)) * 0.004 * life;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uPx * (0.6 + fract(seed.x * 7.3)) / -mv.z, uPr, 9.0 * uPr);
        vA = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.7, 1.0, life)) * smoothstep(0.03, 0.09, -mv.z) * uFlow;   // (off: the dust stops coming)
        vec4 lit = airLight(p); vA *= lit.a; vHue = lit.rgb;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uMote; varying float vA; varying vec3 vHue;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        gl_FragColor = vec4(uColor * vHue, (1.0 - smoothstep(0.3, 1.0, d)) * vA * uMote);
      }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false; pts.renderOrder = 2;
  return pts;
}

// Tell-tale ribbons tied to the louvres: the way people check a real vent is blowing
function tailMesh(vents, look) {
  const TAILS = LOOK.num('vent-ribbons', 3);
  const X = [], P = [], B = [], idx = [];   // X: the ribbon at rest (what the Overdraw view draws) | P: side, u, seed | B: root xyz + length
  let n = 0;
  for (const v of vents) for (let k = 0; k < TAILS; k++) {
    const ox = (k - (TAILS - 1) / 2) * v.radius * 0.55, oz = (Math.random() - 0.5) * v.radius * 0.5, seed = Math.random() * 6.283, len = 0.035 + Math.random() * 0.02;
    for (let s = 0; s <= TAIL_SEG; s++) for (const side of [-1, 1]) { P.push(side, s / TAIL_SEG, seed); X.push(v.x + ox + side * 0.0017, v.y + 0.003 + (s / TAIL_SEG) * len, v.z + oz); B.push(v.x + ox, v.y + 0.003, v.z + oz, len); }
    for (let s = 0; s < TAIL_SEG; s++) { const a = n + s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    n += (TAIL_SEG + 1) * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(X, 3));
  g.setAttribute('wp', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('base', new THREE.Float32BufferAttribute(B, 4));
  g.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    uniforms: look.uniforms, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute vec3 wp; attribute vec4 base; varying float vShade; varying float vU; varying vec3 vLit;
      ${COMMON}
      ${LIT}
      // up: standing in the air, fluttering (a gust pulls it straight); limp: lying across the grille when the air is off
      vec3 path(float u, float s, float g) {
        float live = uFlow * (1.0 - uCalm), amp = 0.007 * u * (1.0 - 0.85 * g) * live;
        vec3 up = vec3(sin(u * 5.0 - uTime * 9.0 + s) * amp + sin(uTime * 1.3 + s) * 0.006 * u * (1.0 - g) * live, u * base.w, cos(u * 4.0 - uTime * 7.2 + s * 1.7) * amp);
        vec3 limp = vec3(sin(s), 0.0, cos(s)) * u * base.w * 0.8 + vec3(0.0, 0.002 * u * (1.0 - u), 0.0);
        return base.xyz + mix(limp, up, uFlow);
      }
      void main() {
        float u = wp.y, s = wp.z, g = uGust.w * inGust(base.xyz);
        vec3 c = path(u, s, g), tan = normalize(path(u + 0.05, s, g) - c);
        vec3 face = mix(vec3(0.0, 1.0, 0.0), vec3(sin(s), 0.0, cos(s)) + vec3(0.0, 0.0, 0.3 * sin(u * 6.0 - uTime * 7.0 + s) * uFlow * (1.0 - uCalm)), uFlow);
        vec3 right = normalize(cross(tan, face));
        vec3 nrm = normalize(cross(right, tan));
        vShade = 0.55 + 0.45 * abs(dot(nrm, normalize(cameraPosition - c)));
        vU = u;
        vec4 lit = airLight(c); vLit = lit.rgb * mix(1.0, lit.a, 0.5);   // (a ribbon is a thing in the room, but small and bright-dyed: half the dimming)
        gl_Position = projectionMatrix * viewMatrix * vec4(c + right * wp.x * 0.0017, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTail; uniform float uRoom; varying float vShade; varying float vU; varying vec3 vLit;
      void main() { gl_FragColor = vec4(uTail * vLit * vShade * uRoom * mix(0.7, 1.0, vU), 1.0); }`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}

export class VentAir {
  // act: the stage's id, for an act's own --vent-*-act<n> over --vent-* (wisp, air, mote, ribbon-glow)
  constructor(group, vents, act = 0) {
    this.group = group;
    const own = (name) => (LOOK.has(`${name}-act${act}`) ? `${name}-act${act}` : name);
    const U = (value) => ({ value });
    this.look = { uniforms: {
      uTime: U(0), uCalm: U(0), uFlow: U(1), uGust: U(new THREE.Vector4(0, 0, 0, 0)), uGustClock: U(0), uPx: U(2.2),
      uPr: U(1), uWide: U(1), uSpread: U(LOOK.num('vent-spread', 1.6)),
      uColor: U(new THREE.Color(LOOK.color(own('vent-air'), '#eaf6ff'))), uWisp: U(LOOK.num(own('vent-wisp'), 0.26)), uMote: U(LOOK.num(own('vent-mote'), 0.75)),
      uLit: U(LOOK.num('vent-light', 1)), uLitRef: U(LOOK.num('vent-light-ref', 0.35)), uLitMin: U(LOOK.num('vent-light-min', 0.3)),
      uLitMax: U(LOOK.num('vent-light-max', 1.2)), uLitTint: U(LOOK.num('vent-light-tint', 0.5)), ...BAKED_LIGHT.uniforms,
      uTail: U(new THREE.Color(LOOK.color('vent-ribbon', '#8fd6d0'))), uRoom: U(LOOK.num(own('vent-ribbon-glow'), 0.8)),
    } };
    // Lambert, not Standard: no per-lamp shine maths, and one material on every graphics tier
    this.grilleMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.heatScene = new THREE.Scene();   // drawn only by the heat shimmer experiment (src/heat-shimmer.js), into its own small map
    this.heatScene.matrixWorldAutoUpdate = false;
    this.gustT = -1;     // s since the last ride began (-1: none blowing)
    this.ridden = null;
    bus.on('vent_ride', ({ vent }) => this.ride(vent));
    this.build(vents);
  }
  build(vents) {
    for (const o of this.parts || []) { this.group.remove(o); o.geometry.dispose(); }
    if (this.heat) { this.heatScene.remove(this.heat); this.heat.material.dispose(); this.heat = null; }
    this.parts = []; this.motes = null;   // (the arena has no vents)
    if (!vents.length) return;
    const boxes = [];
    for (const v of vents) grilleParts(boxes, v);
    this.parts = [new THREE.Mesh(merge(boxes), this.grilleMat), tailMesh(vents, this.look), wispMesh(vents, this.look), moteMesh(vents, this.look)];
    this.motes = this.parts[3];
    for (const o of this.parts) this.group.add(o);
    this.heat = heatMesh(this.parts[2], this.look);   // shares the wisps' shape: nothing more uploaded
    this.heatScene.add(this.heat);
  }
  // A ride starts (the vent_ride event): that vent gusts, then settles (--vent-gust-*)
  ride(v) {
    const U = this.look.uniforms;
    if (this.ridden !== v) U.uGustClock.value = 0;   // (a new vent starts its own extra time, so nothing jumps)
    this.ridden = v;
    U.uGust.value.set(v.x, v.z, v.radius, 1);
    this.gustT = 0;
  }
  // how hard the ridden vent gusts now: full for --vent-gust-hold s, then easing back over --vent-gust-ease s
  gustNow() {
    if (this.gustT < 0) return 0;
    const hold = LOOK.num('vent-gust-hold', 0.4), ease = LOOK.num('vent-gust-ease', 0.8), x = Math.max(0, this.gustT - hold) / ease;
    return x >= 1 ? 0 : 1 - x * x * (3 - 2 * x);
  }
  // env: { pixelRatio, low, calm, on }. Low draws no motes; Reduce effects stills the ribbons and slows the streaks;
  // on: false (vents off in a Boss fight) stops the air over --vent-off-time s, true brings it back the same way.
  update(dt, env = {}) {
    const U = this.look.uniforms, calm = env.calm ? 1 : 0, pace = calm ? LOOK.num('vent-calm-speed', 0.3) : 1;
    U.uTime.value += dt * pace;
    if (this.gustT >= 0) {
      this.gustT += dt;
      const k = this.gustNow();
      U.uGust.value.w = k;
      U.uGustClock.value += dt * pace * k * LOOK.num('vent-gust-speed', 2);   // the ridden vent's streaks run this much faster on top
      if (k === 0) this.gustT = -1;
    }
    const off = LOOK.num('vent-off-time', 0.5);
    U.uFlow.value = THREE.MathUtils.clamp(U.uFlow.value + (env.on === false ? -dt : dt) / off, 0, 1);
    U.uCalm.value = calm;
    U.uPr.value = env.pixelRatio || 1;
    U.uPx.value = LOOK.num('vent-mote-size', 2.2) * U.uPr.value;
    this.motes?.geometry.setDrawRange(0, env.low ? 0 : Infinity);
  }
}
