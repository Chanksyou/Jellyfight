// The jelly's bell bends like a real one (Lucas et al. 2014): the crown stays nearly still and the
// lower bell, past a flexion line about two thirds of the way down, squeezes in on the power stroke
// and flares open as it relaxes, the bend running from crown to rim so the rim lags a little.
//
// Every material drawn on the bell gets the same vertex patch (patchBell), reading one small uniform
// per jelly: { x: crown's contract, y: rim's contract, z: the crown's height } in bell space. Its
// meshes have their placement baked into their geometry, so object space is bell space.
// bellFlex is the same sum on the CPU, for what isn't drawn by the patch (the face, the hat, the
// arm roots): keep the two identical. At rest (contract 0) nothing moves at all.
import { LOOK } from './look.js';

const SQUEEZE = LOOK.num('jelly-motion-squeeze', 0.3);    // how far in the rim pulls at a full stroke, of its radius
const STRETCH = LOOK.num('jelly-motion-stretch', 0.24);   // how far down the rim drops at a full stroke, of the bell's height
const FLEX = LOOK.num('jelly-motion-flex-at', 0.65);      // where the bell bends, down from the crown (0 crown, 1 rim)
const CROWN = LOOK.num('jelly-motion-crown-give', 0.12);  // how much of the squeeze the upper bell still takes
const CURL = LOOK.num('jelly-motion-curl', 0.08);         // the margin curling in further on the power stroke
export const RIM_LAG = LOOK.num('jelly-motion-rim-lag', 0.06);   // the rim's stroke behind the crown's, in cycles

const f = (x) => x.toFixed(6);   // (the CPU mirror uses the full numbers: keep enough places that they agree)
const GLSL = /* glsl */ `{
  float bfS = 1.0 - clamp(transformed.y / bellFlex.z, 0.0, 1.0);
  float bfC = mix(bellFlex.x, bellFlex.y, bfS);
  float bfW = ${f(CROWN)} * bfS * bfS + ${f(1 - CROWN)} * smoothstep(${f(FLEX - 0.15)}, 1.0, bfS);
  float bfT = clamp((bfS - ${f(FLEX)}) / ${f(1 - FLEX)}, 0.0, 1.0);
  transformed.xz *= 1.0 - ${f(SQUEEZE)} * bfC * bfW - ${f(CURL)} * max(bfC, 0.0) * bfT * bfT * bfT;
  transformed.y -= ${f(STRETCH)} * bellFlex.z * bfC * bfW;
}`;

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// the CPU mirror: at bell-space height y, how much the bell's radius is scaled (k) and how far it drops (dy)
export function bellFlex(y, u, out = { k: 1, dy: 0 }) {
  flexWeights(y, u.z, out);
  return bend(out.s, out.w, out.t3, u, out);
}
// what bellFlex needs of a height that doesn't change while the bell moves (a point that rides on it
// can keep these): s (0 crown, 1 rim), the squeeze's weight w and the curl's t3
export function flexWeights(y, crownH, out = {}) {
  const s = 1 - Math.min(1, Math.max(0, y / crownH)), t = Math.min(1, Math.max(0, (s - FLEX) / (1 - FLEX)));
  out.s = s; out.w = CROWN * s * s + (1 - CROWN) * smooth(FLEX - 0.15, 1, s); out.t3 = t * t * t;
  return out;
}
export const FLEXK = { squeeze: SQUEEZE, stretch: STRETCH, curl: CURL };   // (character.js bendFace writes bend out for speed)
export function bend(s, w, t3, u, out) {
  const c = u.x + (u.y - u.x) * s;
  out.k = 1 - SQUEEZE * c * w - CURL * Math.max(c, 0) * t3;
  out.dy = -STRETCH * u.z * c * w;
  return out;
}

// one jelly's uniform, shared by every material on its bell
const owner = new WeakMap(), still = { value: { x: 0, y: 0, z: 1 } };
function onBeforeCompile(shader) {
  shader.uniforms.bellFlex = owner.get(this) || still;   // (a copy of a patched material keeps the rest shape)
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform vec3 bellFlex;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + GLSL);
}
const cacheKey = () => 'bell-flex';

// bake a mesh's placement under the bell into its geometry (it then sits at the bell's origin) and patch its material
export function patchBell(mesh, uniform) {
  mesh.updateMatrix();
  mesh.geometry.applyMatrix4(mesh.matrix);
  mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0); mesh.scale.set(1, 1, 1);
  const m = mesh.material;
  if (m.onBeforeCompile !== onBeforeCompile) { m.onBeforeCompile = onBeforeCompile; m.customProgramCacheKey = cacheKey; owner.set(m, uniform); }
}
