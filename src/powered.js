// The powered apartment: the little lights on what is plugged in, and the smoke and mist that drift off what burns
// or steams. A stage lists them as plain data (`status` and `smoke`); both are plain look, never a threat
// (rule 3: nothing here is hot, hard-edged or fast), and both sit in the room (added to the apartment), so the
// overdraw budget counts them with the room's own pieces.
//
//  - A status light is { at: [x, y, z], colour, pattern, period, phase }. All of an act's lights are ONE `Points`
//    draw whose colour, blink pattern and phase are worked out in its vertex shader from the clock: nothing is
//    uploaded after the build. Colours are `--status-<colour>` in content/look.css. Patterns: steady, blink (a short
//    flash once each period), pulse (a slow breath), flicker (a busy light). Periods divide the clock's 600 s wrap.
//  - A smoke thread is { at: [x, y, z], h, kind }. All of an act's threads are ONE draw of the vent wisps' own shader
//    (vent-air.js `wispMesh`, no new program) in a grey-white, normal blending, never additive. Kinds are rows of
//    `--smoke-*` (thread: a thin curl; mist: a wide soft plume; steam: a low sheet; wisp: a short flicker of it).
//  - Reduce effects holds the lights steady and slows the smoke to a crawl; Low draws no smoke (the lights are
//    small enough to keep). `?ambient=0` builds neither.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { airLook, wispMesh } from './vent-air.js';

const WRAP = 600;   // s: the clock wraps here, so a period must divide it (a blink never jumps)

const KIND = { steady: 0, blink: 1, pulse: 2, flicker: 3 };

function lightMesh(spots) {
  const P = [], C = [], T = [];
  for (const s of spots) {
    P.push(...s.at);
    C.push(...new THREE.Color(LOOK.color(`status-${s.colour}`, '#7be0a0')).toArray());
    T.push(KIND[s.pattern ?? 'steady'] ?? 0, s.period ?? 4, s.phase ?? 0, s.size ?? 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('col', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('pat', new THREE.Float32BufferAttribute(T, 4));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCalm: { value: 0 }, uPx: { value: 3 }, uPr: { value: 1 }, uLevel: { value: LOOK.num('status-level', 1) }, uMin: { value: LOOK.num('status-min', 2.5) } },
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      attribute vec3 col; attribute vec4 pat; varying vec3 vCol; varying float vA;
      uniform float uTime, uCalm, uPx, uPr, uLevel, uMin;
      float hash(float n) { return fract(sin(n * 91.3458) * 47453.5453); }
      void main() {
        float t = fract(uTime / pat.y + pat.z);
        float on = 1.0;                                                             // steady
        if (pat.x > 0.5 && pat.x < 1.5) on = 1.0 - step(0.12, t);                   // blink: a short flash, then dark
        else if (pat.x < 2.5 && pat.x > 1.5) on = 0.55 + 0.45 * sin(6.2831853 * t); // pulse: a slow breath
        else if (pat.x > 2.5) on = 0.3 + 0.7 * step(0.45, hash(floor(uTime * 6.0 + pat.z * 50.0) + pat.z));   // flicker
        on = mix(on, 1.0, uCalm);                                                   // Reduce effects: on, no blinking
        vec4 mv = viewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uPx * pat.w / -mv.z, uMin * uPr, 9.0 * uPr);
        vCol = col * uLevel;
        vA = (0.12 + 0.88 * on) * smoothstep(0.03, 0.09, -mv.z);                    // (never a blob over the lens)
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float core = 1.0 - smoothstep(0.25, 0.55, d), halo = (1.0 - smoothstep(0.0, 1.0, d)) * 0.35;
        gl_FragColor = vec4(vCol * (1.0 + core * 0.6), (core + halo) * vA);
      }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false; pts.renderOrder = 2; pts.name = 'Status lights';
  return pts;
}

export class Powered {
  constructor(group, stage, { calm = () => false, low = () => false } = {}) {
    this.calm = calm; this.low = low;
    this.time = 0;
    this.parts = [];
    if (stage.status?.length) { this.lights = lightMesh(stage.status); this.parts.push(this.lights); }
    if (stage.smoke?.length) {
      const look = airLook(stage.id);
      const U = look.uniforms;
      U.uColor.value.set(LOOK.color('smoke-colour', '#d9d9dc'));
      U.uWisp.value = LOOK.num('smoke-opacity', 0.2);
      U.uSpread.value = LOOK.num('smoke-spread', 2.4);
      this.look = look;
      const row = (kind) => ({ r: LOOK.num(`smoke-${kind}-radius`, 0.012) });
      // one pseudo-vent a thread: the wisp shader wants a base, a radius and a height to climb (`land`)
      const sources = stage.smoke.map((s) => ({ x: s.at[0], y: s.at[1], z: s.at[2], radius: row(s.kind || 'thread').r, land: [0, s.at[1] + s.h - 0.01] }));
      this.smoke = wispMesh(sources, look, { wisps: LOOK.num('smoke-wisps', 2), puffs: LOOK.num('smoke-puffs', 2) });
      this.smoke.name = 'Smoke';
      this.parts.push(this.smoke);
    }
    for (const o of this.parts) { group.add(o); o.updateMatrixWorld(true); }   // (the apartment is frozen: nothing updates a piece added to it later)
  }
  update(dt, { pixelRatio = 1 } = {}) {
    if (!this.parts.length) return;
    const calm = this.calm();
    this.time = (this.time + dt * (calm ? LOOK.num('smoke-calm-speed', 0.3) : 1)) % WRAP;
    if (this.lights) {
      const u = this.lights.material.uniforms;
      u.uTime.value = calm ? 0 : (this.time % WRAP);
      u.uCalm.value = calm ? 1 : 0;
      u.uPr.value = pixelRatio; u.uPx.value = LOOK.num('status-size', 3) * pixelRatio;
    }
    if (this.smoke) {
      this.look.uniforms.uTime.value = this.time;
      this.look.uniforms.uPr.value = pixelRatio;
      this.smoke.visible = !this.low();
    }
  }
}
