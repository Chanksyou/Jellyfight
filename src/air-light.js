// Light you see in the air: a soft glow round each lit lamp's bulb, and dust drifting where act 3's moonlight
// and act 4's sun come in. Both are one draw each (points), made at load and never added mid-play.
//
// Halos: one point a lamp (apartment.js userData.lamp), at the lamp, in its colour, as bright as the lamp is now
// (a flicker or a dimmed lamp follows; the dev panel's lamps switch turns them off). Sized in metres (--lamp-halo-*).
// Motes: a stage with `motes` ({ min, max, face, sun }) fills that box with slow dust; each mote shows as bright as the
// baked light grid (baked-light.js) says light passes there, read from the side the beam comes in (`face`, the grid's
// direction index), so it glows in the beam and is gone in the shadow of a curtain or the bed. `sun`: only on the
// window side of act 4's sun line (sunrise.js). Low graphics draws no motes; Reduce effects holds them still.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { BAKED_LIGHT, GRID_GLSL } from './baked-light.js';
import { BAKED_AO } from './baked-ao.js';

const HALO_VERT = /* glsl */`
  attribute vec3 tint;
  uniform float uSize, uScale;
  varying vec3 vTint;
  void main() {
    vTint = tint;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = dot(tint, vec3(1.0)) > 0.0 ? min(uSize * uScale / max(-mv.z, 0.05), 384.0) : 0.0;
  }`;
const HALO_FRAG = /* glsl */`
  varying vec3 vTint;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float a = exp(-r * r * 5.0) * (1.0 - smoothstep(0.75, 1.0, r));
    gl_FragColor = vec4(vTint * a, 1.0);
  }`;

const MOTE_VERT = GRID_GLSL + /* glsl */`
  attribute vec4 seed;
  uniform vec3 uMin, uBox;
  uniform float uTime, uSize, uScale, uFace, uLo, uHi, uGain, uSunLine;
  varying vec3 vCol;
  void main() {
    vec3 drift = vec3(sin(seed.w * 6.3), 0.35 * cos(seed.w * 4.1) - 0.25, cos(seed.w * 5.7)) * 0.012;   // a few mm a second, mostly down
    vec3 p = uMin + uBox * fract(seed.xyz + drift * uTime / uBox);
    p += vec3(sin(uTime * 0.7 + seed.w * 20.0), sin(uTime * 0.5 + seed.w * 13.0), cos(uTime * 0.6 + seed.w * 17.0)) * 0.01;
    vec3 L = vec3(0.0);
    if (lbGridGain > 0.0 && p.z < uSunLine) {
      vec3 g = (p - lbGridMin) / lbGridStep + 0.5;
      if (all(greaterThanEqual(g, vec3(0.0))) && all(lessThanEqual(g, lbGridDims))) L = lbGridDir(g, uFace) * lbGridGain;
    }
    float lum = dot(L, vec3(0.3, 0.55, 0.15));
    float twinkle = 0.65 + 0.35 * sin(uTime * (1.0 + seed.w) + seed.w * 40.0);
    vCol = L / max(lum, 1e-3) * smoothstep(uLo, uHi, lum) * uGain * twinkle;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = lum > uLo ? clamp(uSize * uScale / max(-mv.z, 0.05), 1.0, 12.0) : 0.0;
  }`;
const MOTE_FRAG = /* glsl */`
  varying vec3 vCol;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    gl_FragColor = vec4(vCol * (1.0 - smoothstep(0.3, 1.0, r)), 1.0);
  }`;

const additive = (vertexShader, fragmentShader, uniforms) => new THREE.ShaderMaterial({
  vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
});

export class AirLight {
  constructor(scene, stage, { low = () => false, calm = () => false } = {}) {
    Object.assign(this, { scene, low, calm });
    this.on = true;                      // the dev panel's lamps switch (main.js toggleLamps)
    this.lamps = [];
    this.halos = null;
    this.haloGain = LOOK.num('lamp-halo', 0.22);
    this.haloUniforms = { uSize: { value: LOOK.num('lamp-halo-size', 0.32) }, uScale: { value: 1 } };
    this.rescan();
    const M = stage.motes;
    if (M) {
      const n = LOOK.num('motes-count', 360), seed = new Float32Array(n * 4);
      for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));   // (placed in the shader)
      g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
      const min = new THREE.Vector3().fromArray(M.min), box = new THREE.Vector3().fromArray(M.max).sub(min);
      this.moteUniforms = {
        ...BAKED_LIGHT.uniforms,
        uMin: { value: min }, uBox: { value: box }, uTime: { value: 0 }, uFace: { value: M.face },
        uSize: { value: LOOK.num('motes-size', 0.007) }, uScale: this.haloUniforms.uScale,
        uLo: { value: LOOK.num('motes-from', 0.12) }, uHi: { value: LOOK.num('motes-full', 0.45) }, uGain: { value: LOOK.num('motes', 0.8) },
        uSunLine: M.sun ? BAKED_AO.uniforms.sunLine : { value: 1e4 },
      };
      this.motes = new THREE.Points(g, additive(MOTE_VERT, MOTE_FRAG, this.moteUniforms));
      this.motes.name = 'motes';
      this.motes.frustumCulled = false;
      this.motes.renderOrder = 2;
      scene.add(this.motes);
    }
  }

  // the lamps in the scene now (an act's rooms loading adds some: main.js loadRooms)
  rescan() {
    this.lamps = [];
    this.scene.traverse((o) => { if (o.isPointLight && o.userData.lamp) this.lamps.push(o); });
    if (this.halos) { this.scene.remove(this.halos); this.halos.geometry.dispose(); }
    const n = Math.max(1, this.lamps.length), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    if (this.halos) this.halos.geometry = g;
    else {
      this.halos = new THREE.Points(g, additive(HALO_VERT, HALO_FRAG, this.haloUniforms));
      this.halos.name = 'lamp-halos';
      this.halos.frustumCulled = false;
      this.halos.renderOrder = 2;
    }
    this.scene.add(this.halos);
  }

  update(dt, renderer, camera) {
    const size = renderer.getDrawingBufferSize(_size);
    this.haloUniforms.uScale.value = size.y * 0.5 * camera.projectionMatrix.elements[5];   // metres at 1 m into pixels
    const pos = this.halos.geometry.attributes.position, tint = this.halos.geometry.attributes.tint;
    let posDirty = false, tintDirty = false;
    for (let i = 0; i < this.lamps.length; i++) {
      const L = this.lamps[i];
      _p.setFromMatrixPosition(L.matrixWorld);
      if (pos.getX(i) !== _p.x || pos.getY(i) !== _p.y || pos.getZ(i) !== _p.z) { pos.setXYZ(i, _p.x, _p.y, _p.z); posDirty = true; }
      const k = this.on ? L.intensity * this.haloGain : 0, r = L.color.r * k, g = L.color.g * k, b = L.color.b * k;
      if (tint.getX(i) !== r || tint.getY(i) !== g || tint.getZ(i) !== b) { tint.setXYZ(i, r, g, b); tintDirty = true; }
    }
    if (posDirty) pos.needsUpdate = true;
    if (tintDirty) tint.needsUpdate = true;
    if (this.motes) {
      this.motes.visible = !this.low();
      if (!this.calm()) this.moteUniforms.uTime.value += dt;
    }
  }
}
const _p = new THREE.Vector3(), _size = new THREE.Vector2();
