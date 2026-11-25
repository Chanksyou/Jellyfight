// The fire Element's richer looks, for the pick screen's stage only (fx.showcase, fx.js): in play the
// fireball, its hit and a burning bug look as bubble-looks.js draws them, with nothing added. No lights,
// no new draws in play: the fireball keeps its parts (only their materials churn) and the rest is the Fx's own
// glows, puffs and floor marks.
//   churn(material, o)            a fireball part's surface boiling: noise rising through it, its edge torn
//   tick(t)                       the churn's clock (once a frame a fireball flies)
//   hit(fx, F, pos, r, floorY)    the burst curls up into smoke; a scorch on the floor glows, then cools
//   burn(fx, F, pos, r)           a burning bug wears licking flames all round it
//   fly(fx, F, at, tail, dir, r, tick)   a fireball's wider heat haze and longer, thicker tail
//   tail(scene, camera, F, group, dir, r, t)   a fireball's flame tail
//   BurnFlames                    real flames licking up off a burning bug (one camera-facing quad each, at most MOST)
// Colours and sizes in content/look.css (--fire-*).
import * as THREE from 'three';
import { LOOK } from './look.js';

const TIME = { value: 0 };
const _p = new THREE.Vector3(), _v = new THREE.Vector3();

// value noise in 3D and two octaves of it (the part's own space, so it boils with the ball as it flies)
const NOISE = /* glsl */`
float fh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float fn(vec3 p) {
  vec3 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fh(i), fh(i + vec3(1, 0, 0)), u.x), mix(fh(i + vec3(0, 1, 0)), fh(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(fh(i + vec3(0, 0, 1)), fh(i + vec3(1, 0, 1)), u.x), mix(fh(i + vec3(0, 1, 1)), fh(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
float fbm2(vec3 p) { return fn(p) * 0.65 + fn(p * 2.1 + 7.0) * 0.35; }
`;

// A fireball part's material boiling. part: its look.css line (--fire-churn-<part>: scale flow dark tear
// hot): noise cells across the part; how fast it streams back (toward the tail, local -z); how dark the
// cooler patches go (0-1); how much of its edge burns away (0: none); how far past white its hot patches
// go (so they bloom). Its colour is the material's own. Each fireball boils on its own (the noise is
// offset by where it is, --fire-churn-spread), never in step with the others.
export function churn(material, part) {
  const [scale, flow, dark, tear, hot] = LOOK.nums(`fire-churn-${part}`, [2.5, 3, 0.5, 0, 1.6]), spread = LOOK.num('fire-churn-spread', 10);
  const p4 = new THREE.Vector4(scale, flow, dark, tear), hs = new THREE.Vector2(hot, spread);
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uFireT = TIME;
    sh.uniforms.uFireP = { value: p4 };
    sh.uniforms.uFireHS = { value: hs };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uFireHS;\nvarying vec3 vFireP;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvFireP = position;\n#ifdef USE_INSTANCING\nvFireP += instanceMatrix[3].xyz * uFireHS.y;\n#endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vFireP;\nuniform float uFireT;\nuniform vec4 uFireP;\nuniform vec2 uFireHS;\n${NOISE}`)
      .replace('#include <opaque_fragment>', `
        float fireN = fbm2(vFireP * uFireP.x + vec3(0.0, uFireT * 0.7, uFireT * uFireP.y));
        outgoingLight *= mix(1.0 - uFireP.z, uFireHS.x, smoothstep(0.3, 0.75, fireN));
        diffuseColor.a *= 1.0 - uFireP.w * (1.0 - smoothstep(0.25, 0.6, fireN));
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'fireChurn';
  return material;
}

export function tick(t) { TIME.value = t; }

// a hit on the stage: the burst curls up into a column of smoke, and the floor under it scorches,
// glowing ember-hot, then cooling
export function hit(fx, F, pos, r, floorY) {
  const glow = fx.glow, smoke = LOOK.color('fire-smoke-dark', '#2a201c');
  // the burst's light rises and spreads as it cools, and thin smoke curls up out of it
  for (let k = 0; k < 4; k++) {
    _p.copy(pos).add(_v.set(Math.sin(k * 2.3) * r * 0.5, r * 0.4, Math.cos(k * 2.3) * r * 0.5));
    _v.set(Math.sin(k * 2.3) * 0.01, 0.045 + k * 0.012, Math.cos(k * 2.3) * 0.01);
    glow.emit(_p, k % 2 ? F.edge : F.flame, r * 1.1, r * (2.5 + k), 0.45 + k * 0.1, 0.3, _v, -0.06);
  }
  for (let k = 0; k < 3; k++) {
    _p.copy(pos).add(_v.set(Math.sin(k * 1.9 + 1) * r * 0.4, r * (0.9 + k * 0.9), Math.cos(k * 1.9 + 1) * r * 0.4));
    fx.puff(_p, k ? smoke : F.smoke, r * (0.7 + k * 0.25), 0.5 + k * 0.2, 0.3 - k * 0.06);
  }
  if (floorY === undefined) return;
  _p.set(pos.x, floorY, pos.z);
  fx.splat(_p, LOOK.color('fire-scorch', '#1c1410'), r * LOOK.num('fire-scorch-size', 3), 'scorch');
  _p.y += 0.002;
  glow.emit(_p, F.edge, r * 3.4, r * 0.6, LOOK.num('fire-scorch-glow', 0.9), 0.55);
  glow.emit(_p, F.flame, r * 1.6, 0, LOOK.num('fire-scorch-glow', 0.9) * 0.6, 0.7);
}

// a burning bug on the stage: tongues of flame lick up all round its body, shrinking as they rise, over a glow
export function burn(fx, F, pos, r) {
  const glow = fx.glow;
  for (let k = 0; k < 6; k++) {
    const a = Math.random() * Math.PI * 2, d = r * (0.3 + Math.random() * 0.6);
    _p.copy(pos).add(_v.set(Math.cos(a) * d, -r * (0.2 + Math.random() * 0.4), Math.sin(a) * d));
    _v.set(Math.cos(a) * 0.012, 0.08 + Math.random() * 0.07, Math.sin(a) * 0.012);
    glow.emit(_p, k % 3 === 2 ? F.flame : F.edge, r * (0.7 + Math.random() * 0.5), r * 0.1, F.life * (1.3 + Math.random()), 0.45, _v, -0.15);   // (mostly deep orange: added up they run hot)
  }
  glow.emit(_v.copy(pos).setY(pos.y + r * 0.1), F.edge, r * 1.6, r * 1.2, F.life, 0.3);
  glow.emit(_p.copy(pos).setY(pos.y + r * 0.1), F.core, r * 0.6, r * 0.3, F.life * 0.8, 0.6);
}

// a fireball in flight on the stage: a wider heat haze round it and a longer, thicker flame tail
export function fly(fx, F, at, tail, dir, r, tick) {
  const glow = fx.glow;
  glow.hold(at, F.edge, r * LOOK.num('fire-haze', 5.5), 0.22);
  if (!tick) return;
  for (let k = 0; k < 3; k++) {
    _v.copy(dir).multiplyScalar(-0.06).add(_p.set(0, 0.03, 0));
    glow.emit(_p.copy(tail).addScaledVector(dir, -r * k * 0.8), k ? F.edge : F.flame, r * (2.4 - k * 0.5), r * 0.3, F.life * 1.6, 0.5, _v, -0.1);
  }
}

// Real flames on the burning bugs: a quad turned to the camera over each, painted with noise rising
// through a flame's shape (the side card's fire, flames.js, in small), torn at its tips. At most MOST at once.
const MOST = 6;
const FLAME_VERT = /* glsl */`
uniform float uSize;
uniform vec2 uAxis;   // the way the flame rises on screen (view space; up for a burning bug, behind a fireball)
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += (vec2(uAxis.y, -uAxis.x) * position.x + uAxis * position.y) * uSize;
  gl_Position = projectionMatrix * mv;
}`;
const FLAME_FRAG = /* glsl */`
uniform float uTime, uSeed, uFade;
uniform vec3 uCore, uFlame, uEdge, uDeep;
varying vec2 vUv;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), u.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), u.x), u.y); }
void main() {
  vec2 uv = vUv;
  float t = uTime + uSeed;
  vec2 q = uv + (vec2(n2(uv * vec2(3.0, 2.0) - vec2(0.0, t * 2.0) + uSeed), 0.0) - 0.5) * vec2(0.25, 0.0) * uv.y;
  float side = abs(q.x - 0.5) * 2.0;
  float body = n2(vec2(q.x * 5.0 + uSeed, q.y * 2.2 - t * 3.2)) * 0.65 + n2(vec2(q.x * 11.0 - uSeed, q.y * 5.0 - t * 5.0)) * 0.35;
  float f = (1.0 - q.y) * 1.25 - side * (1.1 - 0.5 * q.y) + (body - 0.5) * 1.1 - 0.15;
  f *= smoothstep(0.0, 0.12, uv.y) * (1.0 - smoothstep(0.85, 1.0, side));
  float a = smoothstep(0.0, 0.08, f) * uFade;
  if (a <= 0.003) discard;
  float k = clamp(f / 0.6, 0.0, 1.0);
  // (a thin deep edge only: over the stage's teal water a wide red one reads pink)
  vec3 c = k < 0.2 ? mix(mix(uDeep, uEdge, 0.6), uEdge, k / 0.2) : k < 0.55 ? mix(uEdge, uFlame, (k - 0.2) / 0.35) : mix(uFlame, uCore, (k - 0.55) / 0.45);
  gl_FragColor = vec4(c * (0.6 + 0.8 * k * k * k), a);
}`;

// one quad painted with flame (FLAME_*), turned to the camera; its own copy of the material (one shader)
function flameMaterial(F) {
  const lin = (c) => new THREE.Color(c).convertSRGBToLinear();   // (the game's colours are sRGB; this works in linear light)
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSeed: { value: Math.random() * 20 }, uFade: { value: 1 }, uSize: { value: 0.05 }, uAxis: { value: new THREE.Vector2(0, 1) },
      uCore: { value: lin(F.core) }, uFlame: { value: lin(F.flame) }, uEdge: { value: lin(F.edge) }, uDeep: { value: lin(LOOK.color('fire-deep', '#8a1a0a')) } },
    vertexShader: FLAME_VERT, fragmentShader: FLAME_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
}
const QUAD = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
function flameQuad(scene, F) { const m = new THREE.Mesh(QUAD, flameMaterial(F)); m.frustumCulled = false; m.renderOrder = 2; scene.add(m); return m; }

// a fireball's flame tail on the stage: streaming back from it on screen, the way it came.
// group: the fireball (bubble-looks.js; the tail is kept on it, hidden with it); camera: the stage's
export function tail(scene, camera, F, group, dir, r, t) {
  const q = (group.userData.tail ||= flameQuad(scene, F)), U = q.material.uniforms;
  q.visible = true;
  q.position.copy(group.position);
  _v.copy(dir).transformDirection(camera.matrixWorldInverse);
  U.uAxis.value.set(-_v.x, -_v.y);
  if (U.uAxis.value.lengthSq() < 1e-4) U.uAxis.value.set(0, 1); else U.uAxis.value.normalize();
  U.uTime.value = t * 1.6; U.uSize.value = r * LOOK.num('fire-tail-flame', 6); U.uFade.value = 0.6;
}

export class BurnFlames {
  constructor(scene, F) { this.scene = scene; this.F = F; this.on = new Map(); this.free = []; }

  // `burning`: bubbles.js's map of burning bugs; E: the bugs (for their centres); t: seconds
  show(burning, E, t) {
    for (const [e, m] of this.on) if (e.dead || !(burning.get(e)?.t > 0)) { m.visible = false; this.free.push(m); this.on.delete(e); }
    for (const [e, f] of burning) {
      if (e.dead || f.t <= 0) continue;
      let m = this.on.get(e);
      if (!m) {
        if (this.on.size >= MOST) continue;
        m = this.free.pop();
        if (!m) m = flameQuad(this.scene, this.F);
        m.material.uniforms.uSeed.value = Math.random() * 20;
        m.visible = true; this.on.set(e, m);
      }
      const U = m.material.uniforms;
      E.center(e, m.position).y -= e.r * 0.7;
      U.uTime.value = t; U.uSize.value = e.r * LOOK.num('fire-burn-flame', 2.6);
      U.uFade.value = 0.8 * Math.min(1, (f.age + 0.05) * 5, f.t * 3);
    }
  }

  clear() { for (const m of this.on.values()) { m.visible = false; this.free.push(m); } this.on.clear(); }
}
