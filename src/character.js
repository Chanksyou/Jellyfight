// Player-made characters. A "look" is plain JSON (saved in localStorage) and
// buildCharacter(look) turns it into a model with procedural animation.
//
// Anything with the same shape as buildCharacter's return value can be the player's
// avatar: { root: Object3D, update(dt, state), land(impact), dispose() }, plus optionally
// pulse() (a jump's bell squeeze) and tentacles (a TentacleRig the Lash strikes with). When we get a
// rigged model, a second builder can map the same look (colors, hat, eyes) onto it.
//
// Models are built in "units": 1 unit = the character's height, feet at y = 0, facing +z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TentacleRig } from './tentacles.js';
import { squeeze, thrust } from './swim.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const OPTIONS = {
  body: [['blob', 'Blob'], ['bean', 'Bean'], ['jellyfish', 'Jellyfish'], ['cube', 'Gummy'], ['mushroom', 'Mushroom']],
  finish: [['jelly', 'Jelly'], ['matte', 'Soft'], ['glow', 'Glow']],
  pattern: [['none', 'None'], ['spots', 'Spots'], ['belly', 'Belly']],
  eyes: [['round', 'Dots'], ['big', 'Big'], ['sleepy', 'Sleepy'], ['angry', 'Fierce'], ['cyclops', 'Cyclops']],
  mouth: [['smile', 'Smile'], ['open', 'Open'], ['fangs', 'Fangs'], ['none', 'None']],
  top: [['none', 'None'], ['antennae', 'Antennae'], ['sprout', 'Sprout'], ['partyhat', 'Party hat'], ['bow', 'Bow'], ['crown', 'Crown'], ['horns', 'Horns']],
};

export const SWATCHES = ['#ff6fb5', '#ff5a4e', '#ffa23a', '#ffd23a', '#8ee07a', '#37c6a8', '#4fb3ff', '#6b6bff', '#b77bff', '#f4efe6', '#6b5b4f', '#2a2a33'];

export const DEFAULT_LOOK = {
  name: 'Jelly',
  body: 'jellyfish',
  finish: 'glow',
  color: '#2ff0c4',
  accent: '#3d8cff',
  pattern: 'none',
  eyes: 'big',
  eyeColor: '#123a4a',
  mouth: 'smile',
  top: 'none',
  topColor: '#ffd23a',
  feet: true,
  size: 1,
};

export function normalizeLook(look) {
  const out = { ...DEFAULT_LOOK };
  if (!look || typeof look !== 'object') return out;
  for (const k of Object.keys(DEFAULT_LOOK)) {
    const v = look[k];
    if (v === undefined) continue;
    if (OPTIONS[k] && !OPTIONS[k].some(([id]) => id === v)) continue;
    if (typeof v !== typeof DEFAULT_LOOK[k]) continue;
    out[k] = v;
  }
  out.name = String(out.name).slice(0, 16) || DEFAULT_LOOK.name;
  out.size = THREE.MathUtils.clamp(out.size, 0.8, 1.2);
  for (const k of ['color', 'accent', 'eyeColor', 'topColor']) if (!/^#[0-9a-f]{6}$/i.test(out[k])) out[k] = DEFAULT_LOOK[k];
  return out;
}

export function randomLook() {
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const hsl = (h, s, l) => '#' + new THREE.Color().setHSL(h, s, l).getHexString();
  const h = Math.random();
  return normalizeLook({
    name: pick(['Blip', 'Wobble', 'Gloop', 'Pip', 'Mochi', 'Dot', 'Squish', 'Nib', 'Boba', 'Fizz']),
    body: pick(OPTIONS.body)[0],
    finish: pick(['jelly', 'jelly', 'matte', 'glow']),
    color: hsl(h, 0.75, 0.62),
    accent: hsl((h + 0.08) % 1, 0.6, 0.85),
    pattern: pick(OPTIONS.pattern)[0],
    eyes: pick(OPTIONS.eyes)[0],
    eyeColor: hsl(Math.random(), 0.5, 0.25),
    mouth: pick(OPTIONS.mouth)[0],
    top: pick(OPTIONS.top)[0],
    topColor: hsl((h + 0.5) % 1, 0.8, 0.6),
    feet: Math.random() < 0.7,
    size: 0.9 + Math.random() * 0.2,
  });
}

// Where the face and the top of the head sit for each body shape (in units)
const SHAPES = {
  blob:      { faceY: 0.56, faceZ: 0.42, spread: 0.15, topY: 0.93, spots: { c: [0, 0.47, 0], r: [0.45, 0.47, 0.43] } },
  bean:      { faceY: 0.64, faceZ: 0.33, spread: 0.13, topY: 0.99, spots: { c: [0, 0.5, 0], r: [0.34, 0.48, 0.34] } },
  jellyfish: { faceY: 0.72, faceZ: 0.255, spread: 0.1, topY: 0.98, spots: { c: [0, 0.6, 0], r: [0.27, 0.38, 0.27], upper: true }, noFeet: true, faceScale: 0.7 },
  cube:      { faceY: 0.56, faceZ: 0.375, spread: 0.15, topY: 0.88, spots: null },
  mushroom:  { faceY: 0.3,  faceZ: 0.25, spread: 0.09, topY: 0.84, spots: { c: [0, 0.45, 0], r: [0.52, 0.4, 0.52], upper: true }, small: true, faceSkin: 'accent' },
};

function makeMaterials(look) {
  const body = (hex) => {
    const c = new THREE.Color(hex).convertSRGBToLinear();
    if (look.finish === 'matte') return new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
    const m = new THREE.MeshPhysicalMaterial({
      color: c, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4, sheenColor: c.clone(),
      emissive: c.clone(), emissiveIntensity: look.finish === 'glow' ? 0.9 : 0.12,
    });
    return m;
  };
  const std = (hex, o = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).convertSRGBToLinear(), roughness: 0.4, ...o });
  return {
    body: body(look.color),
    accent: body(look.accent),
    top: std(look.topColor, { roughness: 0.35, metalness: look.top === 'crown' ? 0.8 : 0 }),
    white: std('#ffffff', { roughness: 0.15 }),
    iris: std(look.eyeColor, { roughness: 0.2 }),
    black: std('#121018', { roughness: 0.15 }),
    mouth: std('#3a1020', { roughness: 0.6 }),
    tongue: std('#ff7a9a', { roughness: 0.6 }),
    leaf: std('#5fbf4a', { roughness: 0.6 }),
    stem: std('#3f8a34', { roughness: 0.6 }),
  };
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// Seeded RNG so a look always builds the same spots
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296;
}
function hash(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

// The jellyfish's proportions (in units): a tall, lean bell sitting high, things hanging below
const BELL_Y = 0.56, BELL_R = 0.27, ARM_LEN = 0.5;

// A soft round glow for the jelly's halo (additive, so black = nothing)
let HALO = null;
function haloTexture() {
  return HALO ||= canvasTexture(64, 64, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
}

export function buildCharacter(look, heightMeters) {
  look = normalizeLook(look);
  const shape = SHAPES[look.body];
  const M = makeMaterials(look);
  const root = new THREE.Group();
  root.name = 'Character';
  const scaler = new THREE.Group();          // units -> meters
  scaler.scale.setScalar(heightMeters * look.size);
  root.add(scaler);
  const squash = new THREE.Group();          // squash & stretch, pivot at the feet
  scaler.add(squash);
  const lean = new THREE.Group();            // leans forward when running
  squash.add(lean);

  const wobblers = [];                       // things that sway: [object, axis, phase, amount]
  let bell = null, rig = null;               // jellyfish only: the pulsing bell and its tentacles

  // --- Body ---------------------------------------------------------------
  const bellyOn = look.pattern === 'belly';
  switch (look.body) {
    case 'blob': {
      const b = mesh(new THREE.SphereGeometry(0.45, 40, 28), M.body, lean, 0, 0.47, 0);
      b.scale.set(1, 1.04, 0.96);
      if (bellyOn) mesh(new THREE.SphereGeometry(0.3, 32, 20), M.accent, lean, 0, 0.36, 0.2).scale.set(1, 1.05, 0.7);
      break;
    }
    case 'bean': {
      mesh(new THREE.CapsuleGeometry(0.34, 0.3, 12, 32), M.body, lean, 0, 0.5, 0);
      if (bellyOn) mesh(new THREE.SphereGeometry(0.26, 32, 20), M.accent, lean, 0, 0.36, 0.16).scale.set(1, 1.25, 0.72);
      break;
    }
    case 'jellyfish': {
      // A fluorescent jelly in the dark: a tall clear bell over a glowing inner bell (radial
      // canals, bright spots on the crown), a luminous rim with a fringe of fine marginal
      // tentacles, long frilly oral arms twisting down from the middle, and six long glowing
      // hunting tentacles that trail behind it. The bell pulses from its rim (see update).
      bell = new THREE.Group();
      bell.position.y = BELL_Y;
      lean.add(bell);
      const base = new THREE.Color(look.color), acc = new THREE.Color(look.accent);
      const rimCol = base.clone().lerp(new THREE.Color('#f4ff8a'), 0.55);
      const glow = look.finish === 'glow' ? 1 : look.finish === 'jelly' ? 0.65 : 0.3;
      const R = BELL_R;
      const profile = [[1, -0.07], [1.02, 0.11], [1, 0.37], [0.945, 0.63], [0.83, 0.89], [0.67, 1.15], [0.44, 1.33], [0.22, 1.44], [0, 1.48]];
      const lathe = (k) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r * R * k, y * R * k)), 48, 0, Math.PI * 2);
      // inner bell (u runs around the bell, canvas top = the crown): dark, with glowing canals,
      // a glowing ring at the rim and bright spots on the crown, used as color and glow map
      const css = (c) => '#' + c.getHexString();
      const innerTex = canvasTexture(256, 128, (g, w, h) => {
        g.fillStyle = css(base.clone().multiplyScalar(0.18)); g.fillRect(0, 0, w, h);
        const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, css(base.clone().multiplyScalar(0.35))); grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad; g.fillRect(0, 0, w, h);
        g.strokeStyle = css(base); g.globalAlpha = 0.95;
        for (let k = 0; k < 16; k++) { const x = (k + 0.5) / 16 * w; g.lineWidth = k % 2 ? 2 : 4; g.beginPath(); g.moveTo(x, h * 0.12); g.bezierCurveTo(x + 3, h * 0.4, x - 3, h * 0.65, x, h); g.stroke(); }
        g.globalAlpha = 1;
        g.fillStyle = css(rimCol); g.fillRect(0, h * 0.9, w, h * 0.1);                         // the glowing rim band
        for (let k = 0; k < 26; k++) {                                                         // spots on the crown
          g.fillStyle = k % 3 ? '#fff6b0' : css(rimCol);
          g.beginPath(); g.ellipse(Math.random() * w, h * (0.04 + Math.random() * 0.32), 2.5 + Math.random() * 4, 2 + Math.random() * 3, 0, 0, 7); g.fill();
        }
      });
      const inner = new THREE.MeshStandardMaterial({ map: innerTex, emissiveMap: innerTex, emissive: 0xffffff, emissiveIntensity: 1.6 * glow, roughness: 0.3 });
      mesh(lathe(0.9), inner, bell);
      // outer bell: clear and glossy, a tint of the body color
      const outer = new THREE.MeshPhysicalMaterial({ color: base, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: look.finish === 'matte' ? 0.6 : 0.28, depthWrite: false, emissive: base, emissiveIntensity: 0.25 * glow });
      const shell = mesh(lathe(1), outer, bell);
      shell.castShadow = false;
      shell.renderOrder = 2;
      // underside (the subumbrella), seen when it jumps
      const under = mesh(new THREE.CircleGeometry(R * 0.95, 40), inner, bell, 0, 0.005, 0);
      under.rotation.x = Math.PI / 2;
      // luminous ruffled rim: a torus whose tube wobbles in and out 16 times around
      const lit = (c, k) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k * glow, roughness: 0.3 });
      const rimGeo = new THREE.TorusGeometry(R, 0.016, 8, 96);
      { const p = rimGeo.attributes.position, v = new THREE.Vector3();
        for (let k = 0; k < p.count; k++) { v.fromBufferAttribute(p, k); const a = Math.atan2(v.y, v.x), w = 1 + 0.06 * Math.sin(a * 16); p.setXY(k, v.x * w, v.y * w); p.setZ(k, v.z + 0.012 * Math.sin(a * 32)); }
        rimGeo.computeVertexNormals(); }
      const rim = mesh(rimGeo, lit(rimCol, 2.2), bell);
      rim.rotation.x = Math.PI / 2;
      rim.castShadow = false;
      // a fringe of fine glowing marginal tentacles, and 8 bright sense organs between them
      const fringe = [];
      for (let k = 0; k < 40; k++) {
        const a = (k / 40) * Math.PI * 2, len = 0.12 + (k % 3) * 0.06;
        fringe.push(new THREE.CylinderGeometry(0.003, 0.006, len, 4, 1).translate(0, -len / 2, 0).rotateX(0.18).rotateY(a).translate(Math.sin(a) * R, -0.01, Math.cos(a) * R));
      }
      mesh(mergeGeometries(fringe), lit(base, 1.4), bell).castShadow = false;
      const dot = lit(new THREE.Color('#fff6b0'), 3);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 16; mesh(new THREE.SphereGeometry(0.012, 8, 6), dot, bell, Math.sin(a) * R, -0.015, Math.cos(a) * R).castShadow = false; }
      // four long frilly oral arms twisting down from the middle
      const armMat = new THREE.MeshStandardMaterial({ color: acc, emissive: acc, emissiveIntensity: 0.9 * glow, roughness: 0.4, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        const pivot = new THREE.Group();
        pivot.position.set(Math.sin(a) * 0.035, 0, Math.cos(a) * 0.035);
        pivot.rotation.y = a;
        bell.add(pivot);
        const L = ARM_LEN, armGeo = new THREE.PlaneGeometry(0.09, L, 6, 28).translate(0, -L / 2, 0);
        const ap = armGeo.attributes.position;
        for (let q = 0; q < ap.count; q++) {
          const x = ap.getX(q), y = ap.getY(q), edge = Math.abs(x) / 0.045, f = -y / L;
          const ruffle = Math.sin(y * 70) * 0.02 * edge, tw = f * 2.4 + k;          // frilly edges, and a slow twist
          const xx = x * (1 - f * 0.35), zz = ruffle + Math.sin(-y * 8) * 0.02;
          ap.setXYZ(q, xx * Math.cos(tw) - zz * Math.sin(tw), y, xx * Math.sin(tw) + zz * Math.cos(tw));
        }
        armGeo.computeVertexNormals();
        mesh(armGeo, armMat, pivot).castShadow = false;
        wobblers.push([pivot, 'x', k * 1.3, 0.16], [pivot, 'z', k * 2.1, 0.1]);
      }
      // six long, glowing hunting tentacles (see tentacles.js)
      rig = new TentacleRig(lean, { count: 6, radius: R * 0.92, y: BELL_Y, length: 0.95, thickness: 0.024, flare: 0.1, drag: 0.1, material: lit(base.clone().lerp(rimCol, 0.3), 1.3) });
      // a soft fluorescent halo, so it glows even without the bloom pass (phones)
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: base, transparent: true, opacity: 0.32 * glow + 0.05, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(1.05);
      halo.position.y = BELL_Y + R * 0.6;
      lean.add(halo);
      break;
    }
    case 'cube': {
      mesh(new RoundedBoxGeometry(0.78, 0.86, 0.74, 5, 0.17), M.body, lean, 0, 0.45, 0);
      if (bellyOn) mesh(new RoundedBoxGeometry(0.5, 0.42, 0.06, 3, 0.03), M.accent, lean, 0, 0.3, 0.36);
      break;
    }
    case 'mushroom': {
      mesh(new THREE.CylinderGeometry(0.22, 0.27, 0.5, 28), M.accent, lean, 0, 0.25, 0);
      const cap = mesh(new THREE.SphereGeometry(0.52, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), M.body, lean, 0, 0.45, 0);
      cap.scale.y = 0.78;
      const under = mesh(new THREE.CircleGeometry(0.52, 40), M.accent, lean, 0, 0.45, 0);
      under.rotation.x = Math.PI / 2;
      break;
    }
  }

  // --- Spots ----------------------------------------------------------------
  if (look.pattern === 'spots' && shape.spots) {
    const r = rng(hash(look.body + look.color));
    const { c, r: rad, upper } = shape.spots;
    for (let i = 0, placed = 0; i < 80 && placed < 11; i++) {
      const d = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
      if (d.lengthSq() > 1 || d.lengthSq() < 0.05) continue;
      d.normalize();
      if (upper ? d.y < 0.15 : d.y < -0.5) continue;
      if (d.z > 0.55 && d.y < 0.55) continue; // keep the face clear
      const s = mesh(new THREE.SphereGeometry(0.075 + r() * 0.05, 14, 8), M.accent, lean,
        c[0] + d.x * rad[0] * 0.97, c[1] + d.y * rad[1] * 0.97, c[2] + d.z * rad[2] * 0.97);
      s.lookAt(s.position.clone().add(d));
      s.scale.z = 0.3;
      placed++;
    }
  }

  // --- Face -----------------------------------------------------------------
  const face = new THREE.Group();
  face.position.set(0, shape.faceY, shape.faceZ);
  if (shape.faceScale) face.scale.setScalar(shape.faceScale);
  lean.add(face);
  const k = shape.small ? 0.7 : 1;             // mushroom faces are smaller
  const eyes = [];
  const eyeAt = (x, big) => {
    const g = new THREE.Group();
    g.position.x = x;
    face.add(g);
    eyes.push(g);
    const R = (big ? 0.13 : 0.075) * k;
    if (look.eyes === 'round' && !big) {
      mesh(new THREE.SphereGeometry(R, 16, 12), M.black, g);
      mesh(new THREE.SphereGeometry(R * 0.32, 8, 6), M.white, g, R * 0.35, R * 0.4, R * 0.8);
      return g;
    }
    mesh(new THREE.SphereGeometry(R, 20, 14), M.white, g).scale.z = 0.6;
    mesh(new THREE.SphereGeometry(R * 0.66, 16, 12), M.iris, g, 0, 0, R * 0.42).scale.z = 0.5;
    mesh(new THREE.SphereGeometry(R * 0.36, 12, 8), M.black, g, 0, 0, R * 0.6).scale.z = 0.5;
    mesh(new THREE.SphereGeometry(R * 0.2, 8, 6), M.white, g, R * 0.3, R * 0.32, R * 0.72);
    if (look.eyes === 'sleepy') {
      const lid = mesh(new THREE.SphereGeometry(R * 1.08, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), shape.faceSkin === 'accent' ? M.accent : M.body, g);
      lid.rotation.x = 0.5;
      lid.scale.z = 0.7;
    }
    if (look.eyes === 'angry') {
      const brow = mesh(new THREE.BoxGeometry(R * 1.9, R * 0.45, R * 0.4), M.black, g, 0, R * 1.05, R * 0.3);
      brow.rotation.z = x < 0 ? -0.45 : 0.45;
    }
    return g;
  };
  if (look.eyes === 'cyclops') {
    const g = eyeAt(0, true);
    g.scale.setScalar(1.45);
  } else {
    eyeAt(-shape.spread * k, look.eyes !== 'round');
    eyeAt(shape.spread * k, look.eyes !== 'round');
  }

  const mouthY = (look.eyes === 'cyclops' ? -0.2 : -0.15) * k;
  if (look.mouth === 'smile' || look.mouth === 'fangs') {
    const m = mesh(new THREE.TorusGeometry(0.06 * k, 0.014 * k, 6, 16, Math.PI), M.mouth, face, 0, mouthY + 0.03 * k, 0.005);
    m.rotation.z = Math.PI;
    if (look.mouth === 'fangs') {
      for (const s of [-1, 1]) {
        const f = mesh(new THREE.ConeGeometry(0.018 * k, 0.05 * k, 8), M.white, face, s * 0.045 * k, mouthY - 0.03 * k, 0.01);
        f.rotation.x = Math.PI;
      }
    }
  } else if (look.mouth === 'open') {
    mesh(new THREE.SphereGeometry(0.06 * k, 16, 10), M.mouth, face, 0, mouthY, 0).scale.set(1, 0.75, 0.35);
    mesh(new THREE.SphereGeometry(0.035 * k, 12, 8), M.tongue, face, 0, mouthY - 0.02 * k, 0.012).scale.set(1, 0.6, 0.4);
  }

  // --- Top ------------------------------------------------------------------
  const top = new THREE.Group();
  top.position.y = shape.topY;
  lean.add(top);
  switch (look.top) {
    case 'antennae':
      for (const s of [-1, 1]) {
        const p = new THREE.Group();
        p.position.x = s * 0.12;
        p.rotation.z = -s * 0.35;
        top.add(p);
        mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.28, 8), M.black, p, 0, 0.12, 0);
        mesh(new THREE.SphereGeometry(0.055, 14, 10), M.top, p, 0, 0.27, 0);
        wobblers.push([p, 'x', s, 0.18]);
      }
      break;
    case 'sprout': {
      const p = new THREE.Group();
      top.add(p);
      mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.16, 8), M.stem, p, 0, 0.06, 0);
      for (const s of [-1, 1]) {
        const leaf = mesh(new THREE.SphereGeometry(0.085, 14, 8), M.leaf, p, s * 0.07, 0.15, 0);
        leaf.scale.set(1, 0.22, 0.5);
        leaf.rotation.z = s * 0.45;
      }
      wobblers.push([p, 'z', 0, 0.2]);
      break;
    }
    case 'partyhat': {
      const hat = mesh(new THREE.ConeGeometry(0.15, 0.36, 24), M.top, top, 0.04, 0.14, 0);
      hat.rotation.z = -0.18;
      mesh(new THREE.SphereGeometry(0.05, 12, 8), M.white, hat, 0, 0.19, 0);
      break;
    }
    case 'bow':
      for (const s of [-1, 1]) {
        const lobe = mesh(new THREE.ConeGeometry(0.08, 0.15, 16), M.top, top, 0.14 + s * 0.08, -0.02, 0.05);
        lobe.rotation.z = s * Math.PI / 2;
      }
      mesh(new THREE.SphereGeometry(0.045, 12, 8), M.top, top, 0.14, -0.02, 0.05);
      break;
    case 'crown': {
      mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.09, 24, 1, true), M.top, top, 0, 0.02, 0).material.side = THREE.DoubleSide;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        mesh(new THREE.ConeGeometry(0.03, 0.08, 8), M.top, top, Math.sin(a) * 0.155, 0.1, Math.cos(a) * 0.155);
      }
      break;
    }
    case 'horns':
      for (const s of [-1, 1]) {
        const h = mesh(new THREE.ConeGeometry(0.055, 0.2, 12), M.top, top, s * 0.17, 0.02, 0);
        h.rotation.z = -s * 0.55;
      }
      break;
  }

  // --- Feet -----------------------------------------------------------------
  const feet = [];
  if (look.feet && !shape.noFeet) {
    for (const s of [-1, 1]) {
      const f = mesh(new THREE.SphereGeometry(0.12, 16, 10), look.pattern === 'none' ? M.body : M.accent, scaler, s * 0.17, 0.055, 0.04);
      f.scale.set(1, 0.5, 1.3);
      feet.push(f);
    }
  }

  // --- Animation --------------------------------------------------------------
  let t = 0, phase = 0, impact = 0, impactV = 0, blinkIn = 1 + Math.random() * 2;
  let kick = 0, roll = 0, idleSwim = 0, surge = 0;
  const baseRot = wobblers.map(([o, ax]) => o.rotation[ax]);
  const toUnits = 1 / (heightMeters * look.size);
  const localVel = new THREE.Vector3(), q = new THREE.Quaternion();

  function update(dt, s) {
    t += dt;
    const move = Math.min(1, s.speed / (s.walkSpeed || 0.35));
    phase += dt * s.speed * 60;

    if (bell) {
      // the swim cycle comes from the player (so the surge and the squeeze line up); menus and
      // the creator don't pass one, so keep a slow idle pulse going there
      let swim = s.swim;
      if (swim == null) swim = idleSwim = (idleSwim + dt * 0.6) % 1;
      kick = Math.max(0, kick - dt * 3);
      // power stroke: the bell squeezes narrow and tall; glide: it relaxes open, wide and flat
      const contract = kick > 0.05 ? Math.max(kick, squeeze(swim)) : squeeze(swim) * (0.45 + 0.55 * move);
      bell.scale.set(1 - 0.3 * contract, 1 + 0.24 * contract, 1 - 0.3 * contract);
      bell.position.y = BELL_Y + 0.05 * Math.max(0, contract);
      // the thrust lifts the body and tips it into the swim; it sinks back as it glides
      surge = thrust(swim) / 4.7 * move;
      lean.position.y = 0.035 + Math.sin(t * 1.8) * 0.012 * (1 - move) + 0.07 * surge;
      // lean into the swim, and bank into turns (sideways speed, since facing lags behind)
      localVel.set(0, 0, 0);
      if (s.vel) {
        root.getWorldQuaternion(q);
        localVel.copy(s.vel).applyQuaternion(q.invert()).multiplyScalar(toUnits);
      }
      roll += (THREE.MathUtils.clamp(-localVel.x * 0.05, -0.35, 0.35) - roll) * (1 - Math.exp(-8 * dt));
      lean.rotation.z = roll;
      rig.update(dt, { localVel, contract, vy: s.vy || 0 });
    }

    // landing squash as a damped spring
    impactV += (-impact * 180 - impactV * 14) * dt;
    impact += impactV * dt;

    let sy = 1 + Math.sin(t * 2.4) * 0.02 * (1 - move);           // breathing
    if (s.grounded && !bell) sy += Math.abs(Math.sin(phase)) * 0.07 * move;   // bounce with each step
    else sy += THREE.MathUtils.clamp(s.vy * 0.25, -0.12, 0.2);      // stretch in the air
    sy -= impact;
    const sxz = 1 / Math.sqrt(Math.max(0.5, sy));
    squash.scale.set(sxz, sy, sxz);
    lean.rotation.x = move * (bell ? 0.16 : 0.14) * (s.grounded ? 1 : 0.4) + surge * 0.3;

    feet.forEach((f, i) => {
      const p = phase + i * Math.PI;
      const stride = s.grounded ? move : 0;
      f.position.z = 0.04 + Math.sin(p) * 0.12 * stride;
      f.position.y = 0.055 + Math.max(0, Math.cos(p)) * 0.07 * stride + (s.grounded ? 0 : 0.03);
    });

    wobblers.forEach(([o, ax, ph, amt], i) => {
      const drive = 0.3 + move * 0.7 + (s.grounded ? 0 : 0.6);
      o.rotation[ax] = baseRot[i] + Math.sin(t * 6 + ph) * amt * drive - (ax === 'x' ? move * amt : 0);
    });

    blinkIn -= dt;
    const closing = blinkIn < 0 && blinkIn > -0.12;
    if (blinkIn < -0.12) blinkIn = 2 + Math.random() * 3.5;
    eyes.forEach((e) => { e.scale.y = closing ? 0.12 : 1; });
  }

  function land(strength) {
    impactV -= Math.min(4, strength) * 1.2;
  }

  function pulse(k = 1) { kick = Math.max(kick, k); }

  function dispose() {
    rig?.dispose();
    root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.map?.dispose(); o.material.dispose(); } });
    Object.values(M).forEach((m) => m.dispose());
  }

  return { root, update, land, pulse, dispose, look, tentacles: rig };
}
