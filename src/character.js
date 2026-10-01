// Player-made jellyfish. A "look" is plain JSON (saved in localStorage) and buildCharacter(look)
// turns it into a model with procedural animation. `body` picks the species (SPECIES below):
// every species is the same kit of parts (a lathed bell, canals, a lobed rim with a fringe,
// oral arms, the six-ish hunting tentacles the Lash strikes with) with its own numbers.
//
// Anything with the same shape as buildCharacter's return value can be the player's
// avatar: { root: Object3D, update(dt, state), land(impact), dispose() }, plus optionally
// pulse() (a jump's bell squeeze) and tentacles (a TentacleRig the Lash strikes with). When we get a
// rigged model, a second builder can map the same look (colors, hat, eyes) onto it.
//
// Models are built in "units": 1 unit = the character's height, bottom at y = 0, facing +z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TentacleRig } from './tentacles.js';
import { squeeze, thrust } from './swim.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LOOK } from './look.js';

// The species. Bell: `R` its radius and `profile` its outline from rim to crown ([radius, height],
// in multiples of R); `square` makes it a rounded box; `lobes` scallops the rim (`lobeAmp` deep).
// `canals`: glowing lines down the inner bell; `crownSpots`: bright dots on top. `fringe`: fine
// marginal tentacles ([count, shortest, longest, thickness]); `organs`: the bright sense dots on
// the rim. `arms`: oral arms ({ n, len, width, frill, twist }). `tentacles`: the hunting tentacles
// ({ count, length, thickness, flare, corners: bundles at a box bell's corners }). `outer`: how
// see-through the bell is. `extra`: a species' own feature (built in jellyParts).
export const SPECIES = {
  nettle: {
    name: 'Sea Nettle', blurb: 'Tall bell, long frilly arms, six long stinging tentacles.',
    R: 0.27, profile: [[1, -0.07], [1.02, 0.11], [1, 0.37], [0.945, 0.63], [0.83, 0.89], [0.67, 1.15], [0.44, 1.33], [0.22, 1.44], [0, 1.48]],
    canals: 16, crownSpots: 26, lobes: 16, lobeAmp: 0.06, fringe: [40, 0.12, 0.24, 0.006], organs: 8,
    arms: { n: 4, len: 0.5, width: 0.09, frill: 0.02, twist: 2.4 },
    tentacles: { count: 6, length: 0.95, thickness: 0.024, flare: 0.1 }, outer: 0.28,
  },
  moon: {
    name: 'Moon Jelly', blurb: 'A wide, flat saucer with four glowing rings and a fine fringe.',
    R: 0.34, profile: [[1, -0.05], [1.03, 0.06], [0.98, 0.18], [0.86, 0.31], [0.64, 0.42], [0.35, 0.5], [0, 0.53]],
    canals: 32, crownSpots: 0, lobes: 8, lobeAmp: 0.03, fringe: [120, 0.035, 0.06, 0.003], organs: 8,
    arms: { n: 4, len: 0.22, width: 0.06, frill: 0.012, twist: 0.8 },
    tentacles: { count: 6, length: 0.6, thickness: 0.014, flare: 0.25 }, outer: 0.24, extra: 'rings',
  },
  lion: {
    name: "Lion's Mane", blurb: 'A lobed dome with a huge mane of hair and eight heavy arms.',
    R: 0.3, profile: [[1, -0.05], [1.02, 0.1], [0.97, 0.35], [0.85, 0.6], [0.62, 0.82], [0.33, 0.95], [0, 0.99]],
    canals: 16, crownSpots: 10, lobes: 8, lobeAmp: 0.12, fringe: [160, 0.25, 0.55, 0.0045], organs: 8,
    arms: { n: 8, len: 0.55, width: 0.13, frill: 0.035, twist: 3 },
    tentacles: { count: 6, length: 1.1, thickness: 0.02, flare: 0.15 }, outer: 0.3,
  },
  box: {
    name: 'Box Jelly', blurb: 'A clear, square bell, tentacles bundled at its four corners.',
    R: 0.27, square: true, profile: [[1, -0.04], [1, 0.3], [0.96, 0.75], [0.82, 1.05], [0.48, 1.24], [0, 1.28]],
    canals: 4, crownSpots: 6, lobes: 0, lobeAmp: 0, fringe: null, organs: 4,
    arms: { n: 1, len: 0.14, width: 0.05, frill: 0.006, twist: 0.4 },
    tentacles: { count: 8, length: 1.05, thickness: 0.016, flare: 0.05, corners: true }, outer: 0.2, extra: 'pedalia',
  },
  crystal: {
    name: 'Crystal Jelly', blurb: 'Almost invisible, with dozens of fine glowing canals.',
    R: 0.3, profile: [[1, -0.04], [1.02, 0.08], [0.97, 0.25], [0.85, 0.42], [0.62, 0.57], [0.33, 0.66], [0, 0.68]],
    canals: 64, crownSpots: 0, lobes: 0, lobeAmp: 0, fringe: [140, 0.14, 0.22, 0.002], organs: 0,
    arms: { n: 1, len: 0.16, width: 0.05, frill: 0.008, twist: 0.5 },
    tentacles: { count: 6, length: 0.85, thickness: 0.012, flare: 0.2 }, outer: 0.14,
  },
  egg: {
    name: 'Fried Egg', blurb: 'A flat dome with a golden yolk and eight short club arms.',
    R: 0.3, profile: [[1, -0.04], [1.02, 0.1], [0.95, 0.3], [0.78, 0.5], [0.5, 0.64], [0, 0.7]],
    canals: 16, crownSpots: 0, lobes: 16, lobeAmp: 0.04, fringe: [60, 0.06, 0.1, 0.005], organs: 8,
    arms: { n: 8, len: 0.28, width: 0.08, frill: 0.015, twist: 1 },
    tentacles: { count: 6, length: 0.75, thickness: 0.018, flare: 0.15 }, outer: 0.3, extra: 'yolk',
  },
};

export const OPTIONS = {
  body: Object.entries(SPECIES).map(([id, s]) => [id, s.name]),
  finish: [['jelly', 'Jelly'], ['matte', 'Soft'], ['glow', 'Glow']],
  pattern: [['none', 'None'], ['spots', 'Spots']],
  eyes: [['round', 'Dots'], ['big', 'Big'], ['sleepy', 'Sleepy'], ['angry', 'Fierce'], ['cyclops', 'Cyclops']],
  mouth: [['smile', 'Smile'], ['open', 'Open'], ['fangs', 'Fangs'], ['none', 'None']],
  top: [['none', 'None'], ['antennae', 'Antennae'], ['sprout', 'Sprout'], ['partyhat', 'Party hat'], ['bow', 'Bow'], ['crown', 'Crown'], ['horns', 'Horns']],
};

export const SWATCHES = ['#ff6fb5', '#ff5a4e', '#ffa23a', '#ffd23a', '#8ee07a', '#37c6a8', '#4fb3ff', '#6b6bff', '#b77bff', '#f4efe6', '#6b5b4f', '#2a2a33'];

export const DEFAULT_LOOK = {
  name: 'Jelly',
  body: 'nettle',
  finish: 'glow',
  color: LOOK.color('jelly-color', '#2ff0c4'),     // content/look.css
  accent: LOOK.color('jelly-accent', '#3d8cff'),
  pattern: 'none',
  eyes: 'big',
  eyeColor: '#123a4a',
  mouth: 'smile',
  top: 'none',
  topColor: '#ffd23a',
  size: 1,
};

export function normalizeLook(look) {
  const out = { ...DEFAULT_LOOK };
  if (!look || typeof look !== 'object') return out;
  if (look.body === 'jellyfish') look = { ...look, body: 'nettle' };   // saved before there were species
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
    name: pick(['Blip', 'Wobble', 'Gloop', 'Pip', 'Mochi', 'Dot', 'Squish', 'Nib', 'Boba', 'Fizz', 'Medusa', 'Ripple']),
    body: pick(OPTIONS.body)[0],
    finish: pick(['jelly', 'glow', 'glow', 'matte']),
    color: hsl(h, 0.8, 0.6),
    accent: hsl((h + 0.08) % 1, 0.6, 0.85),
    pattern: pick(OPTIONS.pattern)[0],
    eyes: pick(OPTIONS.eyes)[0],
    eyeColor: hsl(Math.random(), 0.5, 0.25),
    mouth: pick(OPTIONS.mouth)[0],
    top: pick(OPTIONS.top)[0],
    topColor: hsl((h + 0.5) % 1, 0.8, 0.6),
    size: 0.9 + Math.random() * 0.2,
  });
}

// Where the face, the hat and the spots go on a species' bell (in units)
function placement(sp) {
  const P = sp.profile, top = P[P.length - 1][1], R = sp.R;
  const h = top * 0.4;                                     // the face sits 40% of the way up the bell
  let r = P[0][0];
  for (let i = 1; i < P.length; i++) if (P[i][1] >= h) { const [r0, y0] = P[i - 1], [r1, y1] = P[i]; r = r0 + (r1 - r0) * (h - y0) / (y1 - y0); break; }
  const front = sp.square ? 0.8 : 1;                        // a box bell's flat side is nearer than its corners
  return {
    faceY: BELL_Y + h * R, faceZ: r * R * front * 0.97, spread: 0.1 * R / 0.27, faceScale: 0.7 * Math.min(1.15, R / 0.27),
    topY: BELL_Y + top * R + (sp.extra === 'yolk' ? 0.06 : 0) - 0.02,
    spots: { c: [0, BELL_Y + top * R * 0.3, 0], r: [R, top * R * 0.7, R], upper: true },
    halo: BELL_Y + top * R * 0.4,
  };
}

// a round outline pushed out toward a rounded square (box jellies), on the x/z (or x/y) plane
function squarish(geo, b = 'z') {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = b === 'z' ? p.getZ(i) : p.getY(i), a = Math.atan2(z, x);   // flat sides face the axes
    const k = 1 / Math.pow(Math.abs(Math.cos(a)) ** 4 + Math.abs(Math.sin(a)) ** 4, 0.25) * 0.8;
    p.setX(i, x * k);
    if (b === 'z') p.setZ(i, z * k); else p.setY(i, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

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
const BELL_Y = 0.56;

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
  const sp = SPECIES[look.body], shape = placement(sp);
  const M = makeMaterials(look);
  const root = new THREE.Group();
  root.name = 'Character';
  const scaler = new THREE.Group();          // units -> meters
  scaler.scale.setScalar(heightMeters * look.size);
  root.add(scaler);
  const squash = new THREE.Group();          // squash & stretch, pivot at the bottom
  scaler.add(squash);
  const lean = new THREE.Group();            // leans forward when running
  squash.add(lean);

  const wobblers = [];                       // things that sway: [object, axis, phase, amount]
  let bell = null, rig = null;               // jellyfish only: the pulsing bell and its tentacles

  // --- Body: the jellyfish -------------------------------------------------
  // A fluorescent jelly in the dark: a clear bell over a glowing inner bell (radial canals,
  // bright spots on the crown), a luminous rim with a fringe of fine marginal tentacles, oral
  // arms twisting down from the middle, and long glowing hunting tentacles that trail behind it.
  // The bell pulses from its rim (see update). The species (SPECIES) sets the numbers.
  bell = new THREE.Group();
  bell.position.y = BELL_Y;
  lean.add(bell);
  const base = new THREE.Color(look.color), acc = new THREE.Color(look.accent);
  const rimCol = base.clone().lerp(new THREE.Color('#f4ff8a'), 0.55);
  const glow = (look.finish === 'glow' ? 1 : look.finish === 'jelly' ? 0.65 : 0.3) * LOOK.num('jelly-glow', 1);
  const R = sp.R, box = !!sp.square;
  const lathe = (k) => {
    const g = new THREE.LatheGeometry(sp.profile.map(([r, y]) => new THREE.Vector2(r * R * k, y * R * k)), 48, 0, Math.PI * 2);
    return box ? squarish(g) : g;
  };
  // inner bell (u runs around the bell, canvas top = the crown): dark, with glowing canals,
  // a glowing ring at the rim and bright spots on the crown, used as color and glow map
  const css = (c) => '#' + c.getHexString();
  const innerTex = canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = css(base.clone().multiplyScalar(0.18)); g.fillRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, css(base.clone().multiplyScalar(0.35))); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.strokeStyle = css(base); g.globalAlpha = 0.95;
    const n = sp.canals, thin = n > 24;
    for (let k = 0; k < n; k++) { const x = (k + 0.5) / n * w; g.lineWidth = thin ? 1.5 : k % 2 ? 2 : 4; g.beginPath(); g.moveTo(x, h * 0.12); g.bezierCurveTo(x + 3, h * 0.4, x - 3, h * 0.65, x, h); g.stroke(); }
    g.globalAlpha = 1;
    g.fillStyle = css(rimCol); g.fillRect(0, h * 0.9, w, h * 0.1);                         // the glowing rim band
    const rnd = rng(hash(look.body));
    for (let k = 0; k < sp.crownSpots; k++) {                                              // spots on the crown
      g.fillStyle = k % 3 ? '#fff6b0' : css(rimCol);
      g.beginPath(); g.ellipse(rnd() * w, h * (0.04 + rnd() * 0.32), 2.5 + rnd() * 4, 2 + rnd() * 3, 0, 0, 7); g.fill();
    }
  });
  const inner = new THREE.MeshStandardMaterial({ map: innerTex, emissiveMap: innerTex, emissive: 0xffffff, emissiveIntensity: 1.6 * glow, roughness: 0.3 });
  mesh(lathe(0.9), inner, bell);
  // outer bell: clear and glossy, a tint of the body color
  const outer = new THREE.MeshPhysicalMaterial({ color: base, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: look.finish === 'matte' ? Math.max(0.5, sp.outer * 2) : sp.outer, depthWrite: false, emissive: base, emissiveIntensity: 0.25 * glow });
  const shell = mesh(lathe(1), outer, bell);
  shell.castShadow = false;
  shell.renderOrder = 2;
  // underside (the subumbrella), seen when it jumps
  const underGeo = new THREE.CircleGeometry(R * 0.95, 40);
  const under = mesh(box ? squarish(underGeo, 'y') : underGeo, inner, bell, 0, 0.005, 0);
  under.rotation.x = Math.PI / 2;
  // the edge of the bell: how far out the rim is at angle a (a box bell is a rounded square)
  const edge = (a) => (box ? 0.8 / Math.pow(Math.abs(Math.cos(a)) ** 4 + Math.abs(Math.sin(a)) ** 4, 0.25) : 1) * R;
  // luminous rim, scalloped into lobes
  const lit = (c, k) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k * glow, roughness: 0.3 });
  const rimGeo = new THREE.TorusGeometry(R, 0.016, 8, 96);
  { const p = rimGeo.attributes.position, v = new THREE.Vector3();
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k);
      const a = Math.atan2(v.y, v.x), w = (1 + sp.lobeAmp * Math.sin(a * sp.lobes)) * edge(a) / R;
      p.setXY(k, v.x * w, v.y * w);
      if (sp.lobes) p.setZ(k, v.z + 0.012 * Math.sin(a * sp.lobes * 2));
    }
    rimGeo.computeVertexNormals(); }
  const rim = mesh(rimGeo, lit(rimCol, 2.2), bell);
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = false;
  // around the rim (angle a, measured like the rim: x = cos, z = sin) and a little in
  const onRim = (a, k = 1) => [Math.cos(a) * edge(a) * k, Math.sin(a) * edge(a) * k];
  // a fringe of fine glowing marginal tentacles
  if (sp.fringe) {
    const [n, short, long, thick] = sp.fringe, rnd = rng(hash(look.body + 'fringe')), parts = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, len = short + (long - short) * rnd(), [x, z] = onRim(a);
      parts.push(new THREE.CylinderGeometry(thick * 0.5, thick, len, 4, 1).translate(0, -len / 2, 0).rotateX(0.18).rotateY(Math.PI / 2 - a).translate(x, -0.01, z));
    }
    mesh(mergeGeometries(parts), lit(base, 1.4), bell).castShadow = false;
  }
  // bright sense organs around the rim
  const dot = lit(new THREE.Color('#fff6b0'), 3);
  for (let k = 0; k < sp.organs; k++) {
    const a = (k / sp.organs) * Math.PI * 2 + (box ? 0 : Math.PI / 16), [x, z] = onRim(a, 0.98);
    mesh(new THREE.SphereGeometry(box ? 0.02 : 0.012, 8, 6), dot, bell, x, box ? 0.03 : -0.015, z).castShadow = false;
  }
  // oral arms twisting down from the middle
  const armMat = new THREE.MeshStandardMaterial({ color: acc, emissive: acc, emissiveIntensity: 0.9 * glow, roughness: 0.4, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
  const A = sp.arms;
  for (let k = 0; k < A.n; k++) {
    const a = (k / A.n) * Math.PI * 2 + Math.PI / 4;
    const pivot = new THREE.Group();
    const off = A.n > 1 ? 0.035 * Math.min(1.6, A.n / 4) : 0;
    pivot.position.set(Math.sin(a) * off, 0, Math.cos(a) * off);
    pivot.rotation.y = a;
    bell.add(pivot);
    const L = A.len, half = A.width / 2, armGeo = new THREE.PlaneGeometry(A.width, L, 6, 28).translate(0, -L / 2, 0);
    const ap = armGeo.attributes.position;
    for (let q = 0; q < ap.count; q++) {
      const x = ap.getX(q), y = ap.getY(q), e = Math.abs(x) / half, f = -y / L;
      const ruffle = Math.sin(y * 70) * A.frill * e, tw = f * A.twist + k;            // frilly edges, and a slow twist
      const xx = x * (1 - f * 0.35), zz = ruffle + Math.sin(-y * 8) * 0.02;
      ap.setXYZ(q, xx * Math.cos(tw) - zz * Math.sin(tw), y, xx * Math.sin(tw) + zz * Math.cos(tw));
    }
    armGeo.computeVertexNormals();
    mesh(armGeo, armMat, pivot).castShadow = false;
    wobblers.push([pivot, 'x', k * 1.3, 0.16], [pivot, 'z', k * 2.1, 0.1]);
  }
  // the species' own feature
  const crownH = sp.profile[sp.profile.length - 1][1] * R;
  if (sp.extra === 'rings') {
    // moon jelly: four glowing horseshoe-shaped rings seen through the crown
    const ringMat = lit(acc, 1.6);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4, r = mesh(new THREE.TorusGeometry(R * 0.2, 0.012, 6, 24, Math.PI * 1.6), ringMat, bell, Math.sin(a) * R * 0.32, crownH * 0.9, Math.cos(a) * R * 0.32);   // between the inner and outer bell
      r.rotation.set(-Math.PI / 2 + 0.25, 0, a + Math.PI * 0.7);
      r.castShadow = false;
    }
  } else if (sp.extra === 'yolk') {
    // fried egg jelly: a raised golden yolk on the crown
    const yolk = mesh(new THREE.SphereGeometry(R * 0.45, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), lit(new THREE.Color('#ffb21a'), 1.1), bell, 0, crownH * 0.82, 0);
    yolk.scale.y = 0.55;
  } else if (sp.extra === 'pedalia') {
    // box jelly: a fleshy pad at each corner that the tentacles hang from
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2, [x, z] = onRim(a, 0.95);
      const pad = mesh(new THREE.SphereGeometry(0.03, 10, 8), lit(rimCol, 1.4), bell, x, -0.02, z);
      pad.scale.set(0.8, 1.5, 0.8);
      pad.castShadow = false;
    }
  }
  // the long, glowing hunting tentacles the Lash strikes with (see tentacles.js); a box jelly's
  // hang in bundles from its corners
  const T = sp.tentacles, corners = T.corners ? Array.from({ length: T.count }, (_, i) => Math.PI / 4 + Math.floor(i / 2) * Math.PI / 2 + (i % 2 ? 0.12 : -0.12)) : null;
  rig = new TentacleRig(lean, {
    count: T.count, radius: (box ? edge(Math.PI / 4) * 0.92 : R * 0.92), y: BELL_Y, length: T.length, thickness: T.thickness, flare: T.flare, drag: 0.1,
    angles: corners && corners.map((a) => Math.PI / 2 - a),   // rig angles: x = sin, z = cos
    material: lit(base.clone().lerp(rimCol, 0.3), 1.3),
  });
  // a soft fluorescent halo, so it glows even without the bloom pass (phones)
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: base, transparent: true, opacity: LOOK.num('jelly-halo', 0.37) * (glow + 0.15) / 1.15, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(1.05 * R / 0.27);
  halo.position.y = shape.halo;
  lean.add(halo);

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
  const k = 1;
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
      const lid = mesh(new THREE.SphereGeometry(R * 1.08, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), M.body, g);
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
    sy += THREE.MathUtils.clamp(s.vy * 0.25, -0.12, 0.2);           // stretch in the air
    sy -= impact;
    const sxz = 1 / Math.sqrt(Math.max(0.5, sy));
    squash.scale.set(sxz, sy, sxz);
    lean.rotation.x = move * (bell ? 0.16 : 0.14) * (s.grounded ? 1 : 0.4) + surge * 0.3;


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
