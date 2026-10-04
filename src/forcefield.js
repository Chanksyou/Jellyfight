// What the invisible walls look like: a faint hex shimmer across the opening, brightest along
// the floor (where a jelly sees it) and fading out above, with a glowing line at its foot.
// Get close and it ripples and lights up around you, so it reads as "you can't go this way".
//   addForceField(scene, { min, max })  a field over a wall box (null for one that isn't a wall)
//   updateForceFields(playerPos)        once a frame
import * as THREE from 'three';
import { LOOK } from './look.js';

const LOGV_PARS = '#include <common>\n#include <logdepthbuf_pars_vertex>';
const LOGF_PARS = '#include <logdepthbuf_pars_fragment>';

let mat = null;
function material() {
  if (mat) return mat;
  mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(LOOK.color('force-field', '#6fd8ff')) },
      uTime: { value: 0 },
      uPlayer: { value: new THREE.Vector3(1e3, 1e3, 1e3) },
    },
    vertexShader: /* glsl */`
      ${LOGV_PARS}
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      ${LOGF_PARS}
      uniform vec3 uColor, uPlayer; uniform float uTime;
      varying vec3 vWorld;
      float hexd(vec2 p) { p = abs(p); return max(dot(p, vec2(0.5, 0.866)), p.x); }
      void main() {
        #include <logdepthbuf_fragment>
        // across the wall: one of x/z is constant on a wall, so their sum runs along it
        vec2 p = vec2(vWorld.x + vWorld.z, vWorld.y) / 0.05;
        vec2 r = vec2(1.0, 1.732), h = r * 0.5;
        vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
        vec2 g = dot(a, a) < dot(b, b) ? a : b;
        float d = 0.5 - hexd(g);
        float line = 1.0 - smoothstep(0.0, fwidth(d) * 1.5 + 0.02, d);
        float y = vWorld.y;
        float low = exp(-y / 0.16);                                   // strong at jelly height, gone up high
        float shimmer = 0.6 + 0.4 * sin(y * 40.0 - uTime * 2.5 + (vWorld.x + vWorld.z) * 9.0);
        float foot = 1.0 - smoothstep(0.0, 0.012, y);                 // the glowing line on the floor
        float dist = distance(vWorld, uPlayer);
        float near = 1.0 - smoothstep(0.05, 0.3, dist);
        float ripple = near * (0.5 + 0.5 * sin(dist * 90.0 - uTime * 9.0));
        float al = line * (0.05 + 0.45 * low) * shimmer + 0.06 * low + foot * 0.7 + near * (0.12 + line * 0.7) + ripple * 0.2;
        al = clamp(al, 0.0, 0.9);
        gl_FragColor = vec4(uColor * al * 1.6, al * 0.3);   // mostly adds light: glows, doesn't darken what's behind
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  mat.extensions = { derivatives: true };
  mat.onBeforeRender = () => { mat.uniforms.uTime.value = performance.now() / 1000; };
  return mat;
}

export function addForceField(scene, w) {
  const size = w.max.map((v, i) => v - w.min[i]);
  if (size[1] < 0.2 || Math.min(size[0], size[2]) > 0.1) return null;   // floors and thick blocks aren't fields
  const alongX = size[0] >= size[2];
  const geo = new THREE.PlaneGeometry(alongX ? size[0] : size[2], size[1]);
  if (!alongX) geo.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(geo, material());
  m.position.set(...w.min.map((v, i) => v + size[i] / 2));
  m.name = 'Force field';
  m.renderOrder = 3;
  m.userData.noCollide = true;
  scene.add(m);
  return m;
}

export function updateForceFields(playerPos) {
  if (mat) mat.uniforms.uPlayer.value.copy(playerPos).setY(playerPos.y + 0.03);
}
