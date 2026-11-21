// The floor glow under a Treasure's area (Glow Stick's aura, a Night-Light's pool, an Ice Cube puddle,
// the Disco Ball's spot, a Bath Bomb's reach): one shader program for every kind. Each pool mesh owns a
// clone of the material (same program, its own uniforms), made at load. A soft radial falloff, two
// octaves of drifting noise bands, a rim line at the area's real reach, a flash when it stings
// (uPulse 0..1, -1 off), one ripple (uRipple: x, z in the disc's own units, its age; age < 0 off), and
// uCharge (how charged it is). uTime is the caller's own clock: it stops still when looks are quiet.
// Premultiplied over-blending: kinds that add light leave alpha near 0, the wet puddle covers the floor.
import * as THREE from 'three';

export const GLOW_KIND = { glow: 0, lamp: 1, wet: 2, spot: 3, fizz: 4 };
const DISC = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);

const base = new THREE.ShaderMaterial({
  uniforms: {
    uColor: { value: new THREE.Color() }, uOpacity: { value: 1 }, uTime: { value: 0 }, uKind: { value: 0 },
    uPulse: { value: -1 }, uCharge: { value: 0 }, uRipple: { value: new THREE.Vector3(0, 0, -1) },
  },
  vertexShader: /* glsl */`
    #include <common>
    #include <logdepthbuf_pars_vertex>
    varying vec2 vP;
    void main() {
      vP = position.xz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */`
    #include <logdepthbuf_pars_fragment>
    uniform vec3 uColor; uniform float uOpacity, uTime, uKind, uPulse, uCharge; uniform vec3 uRipple;
    varying vec2 vP;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    void main() {
      #include <logdepthbuf_fragment>
      float r = length(vP), aa = fwidth(r) * 1.5;
      float n = noise(vP * 3.0 + vec2(uTime * 0.6, -uTime * 0.4)) * 0.65 + noise(vP * 7.0 - vec2(uTime * 0.9, uTime * 0.7)) * 0.35;
      float bands = smoothstep(0.55, 0.95, sin((r * 5.0 - uTime) * 6.2832 + n * 4.0) * 0.5 + 0.5);
      float rim = smoothstep(0.9 - aa, 0.955, r) * (1.0 - smoothstep(0.975, 1.0, r));   // the area's real reach
      float fall = 1.0 - smoothstep(0.0, 1.0, r);
      float pulse = uPulse < 0.0 ? 0.0 : (1.0 - uPulse) * (1.0 - uPulse);   // a sting: the whole area flashes at once
      float d = distance(vP, uRipple.xy), age = uRipple.z;
      float ripple = age < 0.0 ? 0.0 : smoothstep(0.06, 0.0, abs(d - age * 0.9)) * max(0.0, 1.0 - age / 0.6);
      vec3 col = uColor; float a, cover = 0.0;
      if (uKind < 0.5) {            // glow: a living green glow, its bands quicker and brighter with charge
        a = fall * 0.12 + 0.05 + bands * (0.06 + 0.16 * uCharge) + rim * (0.5 + 0.3 * uCharge) + pulse * (0.14 + rim * 0.4);
        col += vec3(rim * 0.1); cover = 1.0;   // covers: stays green on a pale floor
      } else if (uKind < 1.5) {     // lamp: a soft pool of light, brightest under the lamp, a faint edge where it helps
        a = pow(fall, 2.0) * 0.7 + n * fall * 0.2 + 0.03 + rim * 0.12; cover = 0.3;
      } else if (uKind < 2.5) {     // wet: a puddle; a sheen that drifts over it, a frosty rim, ripples where bugs skid
        float sheen = smoothstep(0.62, 0.92, noise(vP * 2.2 + vec2(uTime * 0.35, 0.0)) * 0.6 + noise(vP * 5.0 - uTime * 0.2) * 0.4);
        float frost = rim * (0.6 + 0.4 * noise(vP * 18.0));
        col = mix(uColor * 0.8, vec3(1.0), sheen * 0.15 + frost * 0.5 + ripple * 0.5);
        a = 0.16 + sheen * 0.14 + frost * 0.4 + ripple * 0.4; cover = 1.0;
      } else if (uKind < 3.5) {     // spot: a stage light's pool, glittering
        float glint = step(0.93, noise(vP * 14.0 + uTime * 1.5));
        a = fall * 0.35 + 0.1 + rim * 0.45 + glint * fall * 0.5; col += vec3(glint * 0.3); cover = 0.3;
      } else {                      // fizz: a bath bomb's reach filling as it fizzes, bubbles popping across it
        float bub = smoothstep(0.78, 0.95, noise(vP * 11.0 + vec2(0.0, uTime * 2.0)));
        a = 0.08 + fall * 0.2 * uCharge + bub * 0.35 * (0.4 + uCharge) + rim * (0.4 + 0.5 * uCharge); cover = 0.3;
      }
      a = clamp(a, 0.0, 1.0) * uOpacity;
      gl_FragColor = vec4(col * a, a * cover);
    }`,
  transparent: true, depthWrite: false, toneMapped: false, forceSinglePass: true,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  polygonOffset: true, polygonOffsetFactor: -1,
});
base.extensions = { derivatives: true };

// A floor pool of this kind, 1 m across (scale it to the area's radius), hidden. It draws itself, not
// through the batcher (userData.ownDraw): each pool has its own uniforms. Every clone shares the one program.
export function glowPool(kind, color) {
  const mat = base.clone();
  mat.isTreasureGlow = true;
  mat.uniforms.uKind.value = GLOW_KIND[kind];
  mat.uniforms.uColor.value.set(color);
  const m = new THREE.Mesh(DISC, mat);
  m.visible = false; m.userData.ownDraw = true;
  return m;
}
