// The combat visual language (think Returnal): everything that can hurt you, and everything you
// do, is lit from inside and impossible to mistake in the dark.
//
//   hostile vs friendly   enemy attacks are hot, saturated colours, each source its own hue
//                         (--hostile-* in content/look.css); the jelly's are cool (cyan, teal,
//                         white). They never share a colour.
//   projectiles           a white-hot core in a coloured glow, leaving a short glowing trail
//                         (Fx.orb / Fx.orbTick)
//   warnings              a flat shape on the floor (circle, wedge or strip) with a crisp bright
//                         outline, a fill that grows until the moment it hits, and stripes
//                         sweeping toward where it lands (TeleMaterial)
//                         and over it a faint hex shell of the space the attack will fill
//                         (VolumeMaterial), filling up from the floor with it
//   blasts                a hit is anything of the jelly inside a sphere round where it goes off
//                         (blastHits): half a sphere on a surface, a whole one in mid-air
//   impacts               a flash, sparks and a shockwave (Fx.impact)
//
// Every glow (halos, trails, sparks, flashes) is one particle in one GlowPoints draw call, so a
// screen full of bullets stays cheap on phones. Everything here is unlit and skips tone mapping:
// it reads at full strength whatever the room's lighting.
import * as THREE from 'three';
import { LOOK } from './look.js';

// The hostile palette (content/look.css), by the source of the attack
export const HOSTILE = {};
const DEFAULTS = { laser: '#ff2a4a', controller: '#ff3ad0', mug: '#ff8a1a', kettle: '#ffd23a', leap: '#ff3a2a', vacuum: '#b04aff', spit: '#ff2a4a', web: '#ff5ad8', fly: '#ff5a14', millipede: '#ffa000', soap: '#ff4a9a', clock: '#ffc23a', whipper: '#a65aff', missile: '#ff2020', clog: '#d8ff3a' };
export function hostile(name) {
  return (HOSTILE[name] ||= new THREE.Color(LOOK.color('hostile-' + name, DEFAULTS[name] || '#ff3a3a')));
}
export const FRIENDLY = () => new THREE.Color(LOOK.color('friendly', '#5ff0ff'));
// a critical hit: brighter than an ordinary friendly hit, still cool
export const CRIT = () => new THREE.Color(LOOK.color('crit', '#e6fbff'));

// logarithmic depth (desktop) needs these chunks in custom shaders, or depth comes out wrong
const LOGV_PARS = '#include <common>\n#include <logdepthbuf_pars_vertex>';
const LOGF_PARS = '#include <logdepthbuf_pars_fragment>';

// ------------------------------------------------------------------ floor warnings
// A warning shape on a surface. shape: 'circle' (a CircleGeometry: fills from the middle out),
// 'wedge' (a sector of one: half = its half-angle; fills from the apex out) or 'strip' (a plane
// along +z, uv.y 0 -> 1: fills from the near end). progress 0..1 is how close the hit is.
const SHAPE = { circle: 0, wedge: 1, strip: 2 };
export class TeleMaterial extends THREE.ShaderMaterial {
  constructor(color = '#ff3a3a', shape = 'circle', half = 0.45) {
    super({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uShape: { value: SHAPE[shape] ?? 0 },
        uHalf: { value: half },
        uOpacity: { value: 1 },
        uFlow: { value: shape === 'circle' ? 1 : -1 },   // stripes run in to the middle of a circle, out along a wedge or strip
      },
      vertexShader: /* glsl */`
        ${LOGV_PARS}
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        ${LOGF_PARS}
        uniform vec3 uColor; uniform float uProgress, uTime, uShape, uHalf, uOpacity, uFlow;
        varying vec2 vUv;
        void main() {
          #include <logdepthbuf_fragment>
          float r, edge;
          if (uShape < 1.5) {
            vec2 p = vUv * 2.0 - 1.0;
            r = length(p);
            float aa = fwidth(r) * 1.5;
            edge = smoothstep(0.86 - aa, 0.93, r) * (1.0 - smoothstep(0.97, 1.0 + aa, r));
            if (uShape > 0.5) {                              // the wedge's two straight sides
              float a = abs(atan(p.y, p.x)), side = (uHalf - a) * r;
              edge = max(edge * step(a, uHalf), (1.0 - smoothstep(0.0, 0.035, side)) * step(0.06, r));
            }
          } else {
            r = 1.0 - vUv.y;                                  // a strip plane's uv.y runs from its far end (0) to the start (1)
            float sx = min(vUv.x, 1.0 - vUv.x);
            edge = max(1.0 - smoothstep(0.0, 0.12, sx), smoothstep(0.96, 1.0, r));
          }
          float filled = step(r, uProgress);
          float front = smoothstep(0.08, 0.0, abs(r - uProgress)) * step(0.01, uProgress);   // the bright leading edge of the fill
          float stripes = smoothstep(0.55, 1.0, sin((r * 14.0 + uFlow * uTime * 5.0) * 3.14159)) * (1.0 - filled);
          float a = edge * 0.95 + filled * 0.5 + front * 0.9 + stripes * 0.4 + 0.14;
          vec3 col = uColor * (1.0 + edge * 0.6 + front * 0.6) + vec3(front * 0.25);   // over-bright edges bloom on desktop
          float al = clamp(a, 0.0, 1.0) * uOpacity;
          gl_FragColor = vec4(col * al * 1.7, al);   // premultiplied and boosted: lights up a dark stove, still covers a pale floor
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      // over-blending (premultiplied, boosted): adds light on dark surfaces like additive would,
      // but still covers what's underneath, so the colour stays saturated on a pale floor too
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.shape = shape;
    this.extensions = { derivatives: true };
  }
  // so code that fades a warning (material.opacity = …) keeps working
  get opacity() { return this.uniforms ? this.uniforms.uOpacity.value : 1; }
  set opacity(v) { if (this.uniforms) this.uniforms.uOpacity.value = v; }
  get progress() { return this.uniforms.uProgress.value; }
  set progress(v) { this.uniforms.uProgress.value = v; }
  clone() { const m = new TeleMaterial(this.uniforms.uColor.value, this.shape, this.uniforms.uHalf.value); m.opacity = this.opacity; return m; }
  onBeforeRender() { this.uniforms.uTime.value = performance.now() / 1000; }
}

// ------------------------------------------------------------------ warning volumes
// The space an attack will fill, drawn over its floor Warning as a faint hex shell in the same
// hostile colour, filling as a band rising from the floor to the moment of the hit (progress 0..1,
// set with the floor shape's). Every kind shares one shader and one set of flags, so all of them
// cost one GPU program, built behind Play (Elites.warm). A kind is a unit geometry plus where its
// bottom is and how tall it is in local units: to add one (a lane, a ring wall), add an entry here.
// A cone (a spray from a muzzle: the Kettle's steam, the Cream Whipper's cream) lies on the floor
// from its apex along +z to z = 1, as wide as its floor wedge (half-width z at z) and rising as it
// spreads: each cross-section is a half ellipse CONE_RISE times as tall as it is half wide. Scale it
// (w, w, length) with w = length * tan(the wedge's half-angle), so its sides follow the wedge's.
export const CONE_RISE = 1.5;
function coneGeometry(segZ = 8, segA = 16) {
  const pos = [], idx = [], row = segA + 1;
  const ring = (z) => { for (let j = 0; j <= segA; j++) { const a = Math.PI * j / segA; pos.push(Math.cos(a) * z, CONE_RISE * Math.sin(a) * z, z); } };
  for (let i = 0; i <= segZ; i++) ring(i / segZ);
  for (let i = 0; i < segZ; i++) for (let j = 0; j < segA; j++) { const a = i * row + j, b = a + row; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const cap = pos.length / 3;            // the far end: a half-ellipse fan round its floor centre (own vertices, own normals)
  ring(1); pos.push(0, 0, 1);
  for (let j = 0; j < segA; j++) idx.push(cap + row, cap + j, cap + j + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const VOLUME = {
  dome: { bottom: 0, height: 1, geo: () => new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2) },   // a floor Blast: half a sphere standing on y = 0; scale = radius
  sphere: { bottom: -1, height: 2, geo: () => new THREE.SphereGeometry(1, 28, 16) },                                // a mid-air Blast: centred; scale = radius
  cone: { bottom: 0, height: CONE_RISE, geo: () => coneGeometry() },   // a cone over a floor wedge: see coneGeometry; scale (half-width, half-width, length) at the far end
};
const VOLUME_GEO = {};
// the shared unit geometry of a kind of volume (scale and place the mesh, never the geometry)
export const volumeGeometry = (kind) => (VOLUME_GEO[kind] ||= VOLUME[kind].geo());
export class VolumeMaterial extends THREE.ShaderMaterial {
  constructor(color = '#ff3a3a', kind = 'dome') {
    const k = VOLUME[kind];
    super({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uProgress: { value: 0 },
        uOpacity: { value: 1 },
        uBottom: { value: k.bottom },
        uHeight: { value: k.height },
        uHex: { value: LOOK.num('warning-volume-hex', 90) },
        uGlow: { value: LOOK.num('warning-volume-glow', 1.5) },
      },
      vertexShader: /* glsl */`
        ${LOGV_PARS}
        varying vec3 vLocal, vWorld, vN;
        void main() {
          vLocal = position;                                 // unit-geometry coords: how far up the volume
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;                                    // the hex grid is in world space: cells keep their size at any scale
          vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        ${LOGF_PARS}
        uniform vec3 uColor; uniform float uProgress, uOpacity, uBottom, uHeight, uHex, uGlow;
        varying vec3 vLocal, vWorld, vN;
        float hex(vec2 p) {                                  // distance to the nearest hex cell edge (0 on the line)
          p *= vec2(1.0, 1.1547);
          vec2 a = mod(p, vec2(1.0, 1.732)) - vec2(0.5, 0.866), b = mod(p - vec2(0.5, 0.866), vec2(1.0, 1.732)) - vec2(0.5, 0.866);
          vec2 g = abs(dot(a, a) < dot(b, b) ? a : b);
          return 0.5 - max(dot(g, normalize(vec2(1.0, 1.732))), g.x);
        }
        void main() {
          #include <logdepthbuf_fragment>
          float h = (vLocal.y - uBottom) / uHeight;          // 0 at the bottom of the volume, 1 at the top
          vec3 view = normalize(cameraPosition - vWorld);
          float rim = pow(1.0 - abs(dot(normalize(vN), view)), 2.0);
          float lines = 1.0 - smoothstep(0.0, 0.07, hex(vWorld.xz * uHex + vec2(vWorld.y * uHex, 0.0)));
          float filled = step(h, uProgress), front = smoothstep(0.08, 0.0, abs(h - uProgress));
          float a = clamp(lines * (0.18 + filled * 0.55) + front * 0.8 + rim * 0.25 + filled * 0.08, 0.0, 1.0) * uOpacity;
          vec3 col = uColor * (1.0 + a * 0.6);
          gl_FragColor = vec4(col * a * uGlow, a);           // premultiplied and boosted, like the floor Warning
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,   // the floor Warning's over-blend
    });
    this.kind = kind;
  }
  get opacity() { return this.uniforms ? this.uniforms.uOpacity.value : 1; }
  set opacity(v) { if (this.uniforms) this.uniforms.uOpacity.value = v; }
  get progress() { return this.uniforms.uProgress.value; }
  set progress(v) { this.uniforms.uProgress.value = v; }
  clone() { const m = new VolumeMaterial(this.uniforms.uColor.value, this.kind); m.opacity = this.opacity; return m; }
}

// ------------------------------------------------------------------ blasts
// The one hit rule for a Blast: anything of the jelly inside a sphere of radius r round `centre`.
// On a surface (centre on it) that is a half sphere, in mid-air a whole one. The jelly is its
// collision capsule: `feet` (player.position) up to body.height, body.radius round (CONFIG.player).
const _spine = new THREE.Vector3();
export function blastHits(centre, r, feet, body) {
  const lo = feet.y + body.radius, hi = feet.y + Math.max(body.radius, body.height - body.radius);
  _spine.set(feet.x, Math.min(hi, Math.max(lo, centre.y)), feet.z);   // the capsule's spine point nearest the centre
  return _spine.distanceTo(centre) < r + body.radius;
}

// The hit rule for a cone (see CONE_RISE): anything of the jelly over its floor wedge (apex, unit
// `dir` along the floor, `len` long, `half` its half-angle), at any height up to the cone's top at
// the far end, so jumping doesn't clear it but stepping out of the wedge does.
export function coneHits(apex, dir, len, half, feet, body) {
  const dx = feet.x - apex.x, dz = feet.z - apex.z;
  const along = dx * dir.x + dz * dir.z, across = Math.abs(dx * dir.z - dz * dir.x);
  const top = apex.y + CONE_RISE * len * Math.tan(half);
  return along > 0 && along < len + body.radius && across < along * Math.tan(half) + body.radius / Math.cos(half)
    && feet.y > apex.y - body.height && feet.y < top;
}

// ------------------------------------------------------------------ glow particles
// Every soft light the combat makes, drawn as one THREE.Points: transient particles (trails,
// sparks, flashes) that move and fade on their own, plus "holds" submitted each frame (the halo
// around every bullet). Each has a colour, a size in meters and a strength.
export class GlowPoints {
  constructor(scene, cap = 900) {
    this.cap = cap;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3);
    this.size = new Float32Array(cap);
    this.alpha = new Float32Array(cap);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 500 } },
      vertexShader: /* glsl */`
        ${LOGV_PARS}
        attribute float size; attribute float alpha; attribute vec3 color;
        uniform float uScale;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vColor = color; vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(size * uScale / max(0.001, -mv.z), 1.0, 256.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        ${LOGF_PARS}
        varying vec3 vColor; varying float vAlpha;
        void main() {
          #include <logdepthbuf_fragment>
          float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard;
          float core = smoothstep(0.32, 0.0, d), glow = exp(-d * d * 3.5) * (1.0 - d);
          gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.85), (glow * 0.9 + core) * vAlpha);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    scene.add(this.points);
    this.parts = [];          // transient: { p, v, c, s0, s1, a, t, life, g }
    this.holds = [];          // this frame's held glows: [x, y, z, r, g, b, size, alpha]
    this.n = 0;
  }

  // a particle that lives `life` s: grows/shrinks from size s0 to s1, fades out, drifts with v
  emit(p, color, s0, s1, life, a = 1, v = null, gravity = 0) {
    if (this.parts.length > this.cap - 64) return;
    this.parts.push({ x: p.x, y: p.y, z: p.z, vx: v?.x || 0, vy: v?.y || 0, vz: v?.z || 0, c: color, s0, s1, a, t: 0, life, g: gravity });
  }
  // a glow drawn this frame only (a bullet's halo): call it every frame while it should show
  hold(p, color, size, a = 1) { this.holds.push(p.x, p.y, p.z, color.r, color.g, color.b, size, a); }

  update(dt, camera, renderer) {
    let n = 0;
    const P = this.pos, C = this.col, S = this.size, A = this.alpha;
    for (const q of this.parts) {
      q.t += dt;
      if (q.t >= q.life) { q.dead = true; continue; }
      q.vy -= q.g * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      const k = q.t / q.life;
      P[n * 3] = q.x; P[n * 3 + 1] = q.y; P[n * 3 + 2] = q.z;
      C[n * 3] = q.c.r; C[n * 3 + 1] = q.c.g; C[n * 3 + 2] = q.c.b;
      S[n] = q.s0 + (q.s1 - q.s0) * k;
      A[n] = q.a * (1 - k) * (1 - k * 0.3);
      n++;
    }
    if (this.parts.some((q) => q.dead)) this.parts = this.parts.filter((q) => !q.dead);
    const H = this.holds;
    for (let i = 0; i < H.length && n < this.cap; i += 8, n++) {
      P[n * 3] = H[i]; P[n * 3 + 1] = H[i + 1]; P[n * 3 + 2] = H[i + 2];
      C[n * 3] = H[i + 3]; C[n * 3 + 1] = H[i + 4]; C[n * 3 + 2] = H[i + 5];
      S[n] = H[i + 6]; A[n] = H[i + 7];
    }
    H.length = 0;
    this.n = n;
    const g = this.points.geometry;
    g.setDrawRange(0, n);
    for (const k of ['position', 'color', 'size', 'alpha']) g.attributes[k].needsUpdate = true;
    // sizes are in meters: pixels per meter at 1 m away
    if (renderer && camera) this.mat.uniforms.uScale.value = renderer.getDrawingBufferSize(_size).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }

  clear() { this.parts = []; this.holds.length = 0; }
}
const _size = new THREE.Vector2();
