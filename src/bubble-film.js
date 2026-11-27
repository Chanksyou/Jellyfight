// The plain bubble's soap film (bubbles.js): one small unlit shader for plain, golden and trap bubbles,
// drawn instanced as one batch. A soap bubble is read from five cues, none of which needs a lamp: a clear
// middle and a solid rim (opacity by view angle), rainbow bands that follow the rim and drift (a cosine
// palette of film thickness and angle: no texture), two window highlights, a faint back wall inside the
// rim, and a thin darker line just inside the rim so it still reads on act 2's white tile and act 4's day.
// Each bubble's tint and fade are its mesh's userData.color / userData.opacity (batch.js perInstance);
// userData.extra (0..1) opens the film from the bubble's front (its local +Z, the way it flies) for the pop.
// Numbers: --bubble-film-*, --bubble-rim*, --bubble-highlight in content/look.css.
import * as THREE from 'three';
import { LOOK } from './look.js';

export function bubbleFilm() {
  const uniforms = {
    uTime: { value: 0 },
    uCore: { value: LOOK.num('bubble-film-core', 0.05) },       // how solid the middle is
    uRim: { value: LOOK.num('bubble-film-rim', 0.85) },         // how solid the very edge is
    uRimPow: { value: LOOK.num('bubble-film-rim-power', 2.6) }, // higher keeps the clear middle wider
    uBands: { value: LOOK.num('bubble-film-bands', 1.6) },      // how many rainbow bands across the film
    uFilm: { value: LOOK.num('bubble-film-color', 0.85) },      // 0 a white film .. 1 full rainbow (still pastel)
    uDrift: { value: LOOK.num('bubble-film-drift', 1) },        // how fast the bands drift (0 holds them: Reduce effects)
    uLine: { value: LOOK.num('bubble-rim', 0.55) },             // the darker line inside the rim (reads on bright floors)
    uHi: { value: LOOK.num('bubble-highlight', 1.1) },          // the window highlights' brightness
  };
  const m = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, toneMapped: false,
    side: THREE.FrontSide, forceSinglePass: true,
    // premultiplied: the dark line can darken what is behind, the highlights add light
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: /* glsl */`
      #include <logdepthbuf_pars_vertex>
      #ifdef USE_INSTANCING
      attribute float instanceOpacity;
      attribute float instanceExtra;
      #endif
      varying vec3 vN; varying vec3 vV; varying vec3 vL; varying vec3 vTint; varying float vOp; varying float vSweep;
      void main() {
        mat4 mv = modelViewMatrix;
        vTint = vec3(1.0); vOp = 1.0; vSweep = 0.0;
        #ifdef USE_INSTANCING
        mv = modelViewMatrix * instanceMatrix;
        vOp = instanceOpacity; vSweep = instanceExtra;
        #endif
        #ifdef USE_INSTANCING_COLOR
        vTint = instanceColor;
        #endif
        vec4 p = mv * vec4(position, 1.0);
        vN = normalize(mat3(mv) * normal);
        vV = normalize(-p.xyz);
        vL = position;
        gl_Position = projectionMatrix * p;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <logdepthbuf_pars_fragment>
      uniform float uTime, uCore, uRim, uRimPow, uBands, uFilm, uDrift, uLine, uHi;
      varying vec3 vN; varying vec3 vV; varying vec3 vL; varying vec3 vTint; varying float vOp; varying float vSweep;
      void main() {
        #include <logdepthbuf_fragment>
        vec3 n = normalize(vN), v = normalize(vV);
        float f = 1.0 - clamp(dot(n, v), 0.0, 1.0);          // 0 the middle .. 1 the edge
        float fres = pow(f, uRimPow);
        // film thickness: thicker low on the bubble (it drains down), bent by two drifting waves
        float t = uTime * uDrift;
        float thick = 0.55 - 0.3 * n.y + 0.09 * sin(vL.x * 5.0 + vL.y * 3.0 + t * 1.3) + 0.07 * sin(vL.z * 6.0 - vL.y * 4.0 - t * 0.9);
        vec3 film = 0.5 + 0.5 * cos(6.2832 * (thick * uBands + f * 0.7 + vec3(0.0, 0.33, 0.67)));
        film = mix(vec3(1.0), film, uFilm);
        float back = smoothstep(0.45, 0.7, f) * (1.0 - smoothstep(0.7, 0.86, f)) * 0.18;   // the far wall, seen through
        float line = smoothstep(0.8, 0.9, f) * (1.0 - smoothstep(0.93, 0.99, f)) * uLine;
        float a = mix(uCore, uRim, fres) + back;
        vec3 col = vTint * film * (0.35 + 0.9 * fres + back);
        // a strongly coloured tint (a golden bubble) fills the film with its colour, so it reads at a glance
        float sat = smoothstep(0.4, 0.8, max(vTint.r, max(vTint.g, vTint.b)) - min(vTint.r, min(vTint.g, vTint.b)));
        col = mix(col, vTint * (0.8 + 0.8 * fres), sat * 0.7); a += sat * (0.12 + 0.2 * fres);
        // two windows: a soft bright patch up and to the left, a smaller one low on the right
        float h1 = smoothstep(0.9, 0.97, dot(n, normalize(vec3(-0.45, 0.55, 0.7))));
        float h2 = smoothstep(0.95, 0.99, dot(n, normalize(vec3(0.5, -0.45, 0.74)))) * 0.55;
        float hi = (h1 + h2) * uHi;
        // the pop: the film opens from the front and its torn edge races to the back
        if (vSweep > 0.0) {
          float s = dot(normalize(vL), vec3(0.0, 0.0, 1.0)) * 0.5 + 0.5;   // 1 the front .. 0 the back
          float edge = 1.0 - vSweep * 1.15;
          if (s > edge + 0.04) discard;
          float torn = smoothstep(edge - 0.12, edge + 0.04, s);
          a += torn * 0.5; col += vTint * torn * 0.8;
        }
        vec3 rgb = col * a * (1.0 - line * 0.8) + vec3(hi);
        a = clamp(a + line * 0.3 + hi * 0.6, 0.0, 1.0);
        gl_FragColor = vec4(rgb * vOp, a * vOp);
      }`,
  });
  m.userData.perInstance = true;
  m.userData.extra = true;   // batch.js: an instanceExtra float, from each mesh's userData.extra (the pop sweep)
  return m;
}
