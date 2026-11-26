// Low that is really low: the plain look a phone's Low graphics draws (also ?lite=1 on any tier, experiments.js).
//  - The apartment's lit pieces (furniture, walls, props) draw with a plain diffuse material: the same colour,
//    texture, glow and baked corner shadows, but no shine (no roughness maths per lamp) and no bump.
//  - Shiny extras elsewhere (clearcoat, iridescence, sheen, see-through refraction) are switched off in place.
//  - The spotlights go dark and the room's fill light lifts to make up for them (--lite-fill in look.css).
// main.js runs it each time the graphics are prepared (load, a tier switch behind the menu, new rooms), so
// the light count and every shader are fixed before play. Attacks, Warnings and effects are never touched.
import * as THREE from 'three';
import { LOOK } from './look.js';

const COPY = new WeakMap(), ORIGINAL = new WeakMap(), EXTRAS = new WeakMap(), FILL = new WeakMap();
let on = false;

// What code may change on a piece's material after load (a lamp's glow, act 4's beat on the TV, a texture):
// the plain copy reads and writes these on its original, so it follows along. `version` too, so a
// needsUpdate on either rebuilds both.
const LINKED = ['color', 'emissive', 'emissiveIntensity', 'opacity', 'transparent', 'visible', 'map', 'emissiveMap', 'version'];
const KEPT = ['lightMap', 'lightMapIntensity', 'aoMap', 'aoMapIntensity', 'alphaMap', 'wireframe', 'flatShading', 'fog'];
const SHINE = ['clearcoat', 'iridescence', 'sheen', 'transmission'];

function plain(mat) {
  let c = COPY.get(mat);
  if (c) return c;
  c = THREE.Material.prototype.copy.call(new THREE.MeshLambertMaterial(), mat);
  for (const k of KEPT) c[k] = mat[k];
  c.onBeforeCompile = mat.onBeforeCompile;   // the baked corner shadows and a stage's sun (baked-ao.js)
  for (const k of LINKED) Object.defineProperty(c, k, { get: () => mat[k], set: (v) => { mat[k] = v; } });
  COPY.set(mat, c);
  ORIGINAL.set(c, mat);
  return c;
}

// the material a plain copy was made from (camera.js fades from it, so a faded piece looks and builds the same on every tier)
export const original = (m) => ORIGINAL.get(m) || m;
export const liteOn = () => on;

// A Physical material's shiny extras off while lite is on, back on when it isn't
function shine(o) {
  for (const m of [].concat(o.material || [])) {
    if (!m.isMeshPhysicalMaterial) continue;
    const had = EXTRAS.get(m);
    if (on && !had && SHINE.some((k) => m[k] > 0)) {
      EXTRAS.set(m, Object.fromEntries(SHINE.map((k) => [k, m[k]])));
      for (const k of SHINE) m[k] = 0;
    } else if (!on && had) {
      Object.assign(m, had);
      EXTRAS.delete(m);
    }
  }
}
// Something built after the graphics were prepared (an Elite made when its fight is set up) follows the lite
// state too: otherwise its shiny extras build a shader in play (the shelf's copy of it was prepared without them)
export const followLite = (root) => { if (on) root.traverse(shine); };

// apartment: the rooms' root; shelf: main.js's stand-ins; batches: static-batch.js's
export function setLite(lite, { scene, shelf, apartment, batches = [] }) {
  on = lite;
  const known = (m) => (on ? COPY.get(m) || m : original(m));
  const toPlain = (m) => (on && m.isMeshStandardMaterial ? plain(m) : known(m));
  const swap = (o, pick) => { if (o.material) o.material = Array.isArray(o.material) ? o.material.map(pick) : pick(o.material); };
  apartment?.traverse((o) => { if (o.isMesh) swap(o, toPlain); });
  shelf.traverse((o) => swap(o, known));
  for (const b of batches) {
    b.batch.material = toPlain(b.batch.material);
    for (const p of b.pieces) p.material = known(p.material);
  }
  let spots = false;
  for (const root of [scene, shelf]) root.traverse((o) => {
    shine(o);
    if (o.isSpotLight) { o.visible = !on; spots = true; }
  });
  if (spots) scene.traverse((o) => {   // (a scene without spots keeps its fill as it is: act 4's arena sets its own every frame)
    if (!o.isHemisphereLight) return;
    if (!FILL.has(o)) FILL.set(o, o.intensity);
    o.intensity = FILL.get(o) * (on ? LOOK.num('lite-fill', 1.6) : 1);
  });
}
