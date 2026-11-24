// The stag beetle's ball in flight (the charge-shot word): a lit-looking sphere of hot energy, not a flat
// disc. One unlit material (a MeshBasicMaterial with a patched fragment, so bloom and logarithmic depth work
// as everywhere else): a white-blue rim (fresnel) round a hot orange body, spiral bands turning round the
// line of flight, a quick pulse. Plain meshes, one draw each while a ball flies, no lights and no
// per-frame allocation. Numbers in content/look.css (--beetle-ball-*).
import * as THREE from 'three';
import { LOOK } from './look.js';
import { juice } from './juice.js';

const Z = new THREE.Vector3(0, 0, 1), _d = new THREE.Vector3();

export class EnergyBalls {
  constructor(scene, reducedMotion) {
    this.scene = scene;
    this.reduced = reducedMotion;
    this.geo = new THREE.SphereGeometry(1, 24, 16);
    this.t = 0;
    this.pool = [];
    const U = this.uniforms = {
      uTime: { value: 0 },
      uBody: { value: new THREE.Color(LOOK.color('hostile-beetle', '#ff9a1f')) },
      uDeep: { value: new THREE.Color(LOOK.color('beetle-ball-deep', '#c41a00')) },
      uHot: { value: new THREE.Color(LOOK.color('beetle-fire', '#ffd060')) },
      uRim: { value: new THREE.Color(LOOK.color('beetle-arc', '#eef2ff')) },
      uSpin: { value: LOOK.num('beetle-ball-spin', 7) },
      uTwist: { value: LOOK.num('beetle-ball-twist', 5) },
      uRimPow: { value: LOOK.num('beetle-ball-rim', 4.5) },
      uGlow: { value: LOOK.num('beetle-ball-glow', 0.6) },
    };
    this.mat = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vBP; varying vec3 vBN; varying vec3 vBV;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vBP = position; vBN = normalize(normalMatrix * normal);
          vBV = -(modelViewMatrix * vec4(position, 1.0)).xyz;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vBP; varying vec3 vBN; varying vec3 vBV;
          uniform float uTime, uSpin, uTwist, uRimPow, uGlow;
          uniform vec3 uBody, uHot, uRim, uDeep;`)
        .replace('#include <opaque_fragment>', `
          float fres = pow(1.0 - abs(dot(normalize(vBN), normalize(vBV))), uRimPow);
          float a = atan(vBP.y, vBP.x) + vBP.z * uTwist - uTime * uSpin;
          float w = sin(a * 3.0 + sin(vBP.z * 4.0 - uTime * 3.0)) * 0.6 + sin(a * 5.0 - vBP.z * 7.0 + uTime * 4.0) * 0.4;
          float band = smoothstep(-0.5, 0.7, w);
          float core = pow(1.0 - fres, 4.0);
          vec3 col = mix(uDeep, uBody, band);                              // a red-orange swirl winding round the line of flight
          col = mix(col, uHot, core * (0.1 + 0.4 * band));               // hotter toward the middle
          col = mix(col, uRim, clamp(fres * 1.2, 0.0, 1.0));               // a pale rim at the edge
          outgoingLight = col * uGlow * (0.9 + 0.1 * sin(uTime * 24.0));
          #include <opaque_fragment>`);
    };
  }

  // a ball of radius `size` at `at`, its bands turning round the line of flight `dir`
  spawn(at, dir, size) {
    const m = this.pool.pop() || new THREE.Mesh(this.geo, this.mat);
    m.frustumCulled = false;
    m.position.copy(at);
    m.quaternion.setFromUnitVectors(Z, _d.copy(dir).normalize());
    m.userData.size = size;
    m.scale.setScalar(size);
    this.scene.add(m);
    return m;
  }
  free(m) { this.scene.remove(m); this.pool.push(m); }
  // shown once while the game builds its shaders (main.js warmUp), so the first ball doesn't stall a phone
  warm(on, at) {
    if (on) this.warmBall = this.spawn(at, Z, 0.005);
    else if (this.warmBall) { this.free(this.warmBall); this.warmBall = null; }
  }

  // the clock and the pulse; Reduce effects holds the swirl and the pulse still
  tick(dt, shots) {
    const calm = juice.calm || this.reduced?.matches;
    if (!calm) this.uniforms.uTime.value = (this.t += dt);
    const pulse = calm ? 0 : LOOK.num('beetle-ball-pulse', 0.07);
    for (const s of shots) s.ball.scale.setScalar(s.ball.userData.size * (1 + pulse * Math.sin(this.t * 18)));
  }
}
