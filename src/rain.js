// Rain on the windows (act 1 only: a stage's `rain`). Drops and running streaks are painted on the
// window glass in its own shader, from where each pixel is on the pane, so no draw, light or frame
// copy is added; the city behind goes a little hazy (skyline.js `haze`). Still drops stay put; a few
// streaks run down on the ambient clock (ambient.js), and stop under Reduce effects (ambientOn 0).
// Numbers are --rain-* in content/look.css. The sound is a layer of act 1's room tone (ambience.js).
// Act 4 is the same room at dawn and stays dry: it has no `rain`.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { AMBIENT } from './ambient.js';

const RAIN_FRAGMENT = /* glsl */`
  uniform float ambientOn, ambientTime;
  uniform vec4 rainDrops;     // cell (m), share of cells with a drop, drop size (share of a cell), glint
  uniform vec4 rainStreaks;   // column (m), share of columns running, speed (m/s), trail (m)
  uniform vec4 rainTint;      // rgb, how opaque a drop is
  float rainHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // how much of this pixel is water (x) and how much a drop's glint (y); p: along the pane and up (m)
  vec2 rainOn(vec2 p) {
    vec2 c = p / rainDrops.x, id = floor(c), f = fract(c) - 0.5;
    vec2 off = vec2(rainHash(id + 1.3), rainHash(id + 2.7)) - 0.5;
    float r = rainDrops.z * mix(0.45, 1.0, rainHash(id + 4.1));
    vec2 d = (f - off * 0.45) * vec2(1.0, 0.85);
    float has = step(rainHash(id), rainDrops.y);
    float water = has * smoothstep(r, r * 0.55, length(d));
    float glint = has * smoothstep(r * 0.4, 0.0, length(d - vec2(-0.3, 0.35) * r));
    // a running drop in some columns, with its thin trail above it
    float col = floor(p.x / rainStreaks.x), fx = fract(p.x / rainStreaks.x) - 0.5;
    float runs = step(rainHash(vec2(col, 9.1)), rainStreaks.y) * step(0.5, ambientOn);
    if (runs > 0.5) {
      float speed = rainStreaks.z * mix(0.6, 1.4, rainHash(vec2(col, 3.3)));
      float head = 2.6 - mod(ambientTime * speed + rainHash(vec2(col, 5.7)) * 3.0, 3.0);
      float wob = (rainHash(vec2(col, 7.7)) - 0.5) * 0.4 + sin(p.y * 37.0 + col) * 0.06;
      float hx = (fx - wob) * rainStreaks.x, hy = p.y - head, hr = rainDrops.x * rainDrops.z * 0.8;
      float drop = smoothstep(hr, hr * 0.55, length(vec2(hx, hy * 0.75)));
      float trail = step(0.0, hy) * smoothstep(rainStreaks.w, 0.0, hy) * smoothstep(hr * 0.35, hr * 0.12, abs(hx));
      water = max(water, max(drop, trail * 0.6));
      glint = max(glint, drop * smoothstep(hr * 0.5, 0.0, length(vec2(hx + hr * 0.3, hy - hr * 0.4))));
    }
    return vec2(water, glint * rainDrops.w);
  }
`;

// the window panes: the Shell's tall see-through glass
export function windowPanes(root) {
  const out = [], box = new THREE.Box3();
  root.getObjectByName('Shell')?.traverse((o) => {
    const m = o.isMesh && o.material;
    if (!m || Array.isArray(m) || !m.transparent || !m.isMeshStandardMaterial || m.opacity > 0.3) return;
    box.setFromObject(o);
    if (box.max.y - box.min.y > 1.5) out.push(o);
  });
  return out;
}

// paint rain on the panes. Returns them.
export function addRain(root) {
  // (after shadeWithBakedAO, if the room has one: this wraps its patch)
  const panes = windowPanes(root);
  const uniforms = {
    rainDrops: { value: new THREE.Vector4(LOOK.num('rain-cell', 0.02), LOOK.num('rain-drops', 0.4), LOOK.num('rain-drop-size', 0.3), LOOK.num('rain-glint', 0.5)) },
    rainStreaks: { value: new THREE.Vector4(LOOK.num('rain-column', 0.035), LOOK.num('rain-streaks', 0.3), LOOK.num('rain-speed', 0.09), LOOK.num('rain-trail', 0.2)) },
    rainTint: { value: new THREE.Vector4(...new THREE.Color(LOOK.color('rain-tint', '#25303d')).toArray(), LOOK.num('rain-opacity', 0.4)) },
  };
  const glints = new THREE.Color(LOOK.color('rain-glint-color', '#d8e6ff'));
  for (const pane of panes) {
    const m = pane.material = pane.material.clone();   // its own: anything else of this glass stays dry
    const before = m.onBeforeCompile;
    m.onBeforeCompile = (shader, r) => {
      before.call(m, shader, r);
      Object.assign(shader.uniforms, uniforms, { ambientOn: AMBIENT.uniforms.ambientOn, ambientTime: AMBIENT.uniforms.ambientTime });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRainP, vRainN;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvRainP = (modelMatrix * vec4(transformed, 1.0)).xyz; vRainN = mat3(modelMatrix) * objectNormal;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRainP, vRainN;\n' + RAIN_FRAGMENT)
        .replace('#include <colorspace_fragment>', `{
          vec3 rn = normalize(vRainN);
          vec2 rw = rainOn(vec2(abs(rn.x) > abs(rn.z) ? vRainP.z : vRainP.x, vRainP.y));
          float k = rw.x * rainTint.a;
          gl_FragColor.rgb = mix(gl_FragColor.rgb, rainTint.rgb, k / max(0.001, max(gl_FragColor.a, k))) + vec3(${glints.r.toFixed(3)}, ${glints.g.toFixed(3)}, ${glints.b.toFixed(3)}) * rw.y;
          gl_FragColor.a = max(gl_FragColor.a, max(k, rw.y));
        }
        #include <colorspace_fragment>`);
    };
    m.customProgramCacheKey = () => 'rain';
    m.userData.rain = uniforms;
    m.needsUpdate = true;
  }
  return panes;
}
