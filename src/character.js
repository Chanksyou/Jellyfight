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
  eyes: [['round', 'Dots'], ['big', 'Big'], ['sleepy', 'Sleepy'], ['angry', 'Fierce'], ['cyclops', 'Cyclops'], ['goldmask', 'Golden mask'], ['shades', 'Gold shades']],
  mouth: [['smile', 'Smile'], ['open', 'Open'], ['fangs', 'Fangs'], ['none', 'None'], ['goldtooth', 'Gold tooth']],
  top: [['none', 'None'], ['antennae', 'Antennae'], ['sprout', 'Sprout'], ['partyhat', 'Party hat'], ['bow', 'Bow'], ['crown', 'Crown'], ['horns', 'Horns'],
    ['tophat', 'Top hat'], ['beanie', 'Beanie'], ['witch', 'Witch hat'], ['cowboy', 'Cowboy hat'], ['halo', 'Halo'], ['flower', 'Flower'],
    ['propeller', 'Propeller cap'], ['chef', 'Chef hat'], ['catears', 'Cat ears'], ['unicorn', 'Unicorn horn'],
    ['goldcrown', 'Golden crown'], ['laurel', 'Golden laurel'], ['goldantlers', 'Golden antlers']],   // the golden ones are earned (cosmetics.js)
};
// tops that keep their own colour (the Hat colour row is hidden for them)
export const OWN_COLOR_TOPS = ['none', 'sprout', 'chef', 'goldcrown', 'laurel', 'goldantlers'];

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
  // no longer chosen in the creator: every jelly glows, has no spots and is the same size
  out.finish = DEFAULT_LOOK.finish;
  out.pattern = DEFAULT_LOOK.pattern;
  out.size = DEFAULT_LOOK.size;
  for (const k of ['color', 'accent', 'eyeColor', 'topColor']) if (!/^#[0-9a-f]{6}$/i.test(out[k])) out[k] = DEFAULT_LOOK[k];
  return out;
}

// isOpen(key, id): may this option be picked (the creator passes cosmetics.js unlocked, so a random
// look never hands out an award not yet earned)
export function randomLook(isOpen = () => true) {
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const option = (key) => pick(OPTIONS[key].filter(([id]) => isOpen(key, id)))[0];
  const hsl = (h, s, l) => '#' + new THREE.Color().setHSL(h, s, l).getHexString();
  const h = Math.random();
  return normalizeLook({
    name: pick(['Blip', 'Wobble', 'Gloop', 'Pip', 'Mochi', 'Dot', 'Squish', 'Nib', 'Boba', 'Fizz', 'Medusa', 'Ripple']),
    body: option('body'),
    color: hsl(h, 0.8, 0.6),
    accent: hsl((h + 0.08) % 1, 0.6, 0.85),
    eyes: option('eyes'),
    eyeColor: hsl(Math.random(), 0.5, 0.25),
    mouth: option('mouth'),
    top: option('top'),
    topColor: hsl((h + 0.5) % 1, 0.8, 0.6),
  });
}

// Where the face, the hat and the spots go on a species' bell (in units)
function placement(sp) {
  const P = sp.profile, top = P[P.length - 1][1], R = sp.R;
  const h = top * 0.4;                                     // initial eye sizing; the whole expression is fitted below
  return {
    faceY: BELL_Y + h * R, spread: 0.1 * R / 0.27, faceScale: 0.7 * Math.min(1.15, R / 0.27),
    topY: BELL_Y + top * R + (sp.extra === 'yolk' ? 0.06 : 0) - 0.02, bellTop: BELL_Y + top * R,
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
    eyeWhite: std('#ffffff', { roughness: 0.2, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.35 }),   // reads white in a warm room
    iris: std(look.eyeColor, { roughness: 0.2, emissive: new THREE.Color(look.eyeColor), emissiveIntensity: 0.15 }),
    lid: std('#' + new THREE.Color(look.color).lerp(new THREE.Color('#000000'), 0.35).getHexString(), { roughness: 0.5 }),
    gold: std('#ffd23a', { roughness: 0.3, metalness: 0.6 }),
    // the earned golden pieces: polished, with a warm glow of their own so they read in a dark room
    award: std('#ffc93a', { roughness: 0.2, metalness: 0.9, emissive: new THREE.Color('#6a4300'), emissiveIntensity: 0.6 }),
    ruby: std('#ff2a4a', { roughness: 0.1, emissive: new THREE.Color('#ff2a4a'), emissiveIntensity: 0.5 }),
    sapphire: std('#2a7aff', { roughness: 0.1, emissive: new THREE.Color('#2a7aff'), emissiveIntensity: 0.5 }),
    pink: std('#ff9ab8', { roughness: 0.6 }),
    halo: new THREE.MeshBasicMaterial({ color: new THREE.Color(look.topColor), toneMapped: false }),
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
  const spinners = [];                       // things that turn: [object, axis, speed]
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
  // around the rim (angle a, measured like the rim: x = cos, z = sin) and a little in
  const onRim = (a, k = 1) => [Math.cos(a) * edge(a) * k, Math.sin(a) * edge(a) * k];
  // a fringe of fine glowing marginal tentacles
  if (sp.fringe) {
    const [n, short, long, thick] = sp.fringe, rnd = rng(hash(look.body + 'fringe')), parts = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, len = short + (long - short) * rnd(), [x, z] = onRim(a);
      parts.push(new THREE.CylinderGeometry(thick * 0.5, thick, len, 4, 1).translate(0, -len / 2, 0).rotateX(0.18).rotateY(Math.PI / 2 - a).translate(x, -0.01, z));
    }
    mesh(mergeGeometries(parts), lit(base, 1.4), bell);
  }
  // bright sense organs around the rim
  const dot = lit(new THREE.Color('#fff6b0'), 3);
  for (let k = 0; k < sp.organs; k++) {
    const a = (k / sp.organs) * Math.PI * 2 + (box ? 0 : Math.PI / 16), [x, z] = onRim(a, 0.98);
    mesh(new THREE.SphereGeometry(box ? 0.02 : 0.012, 8, 6), dot, bell, x, box ? 0.03 : -0.015, z);
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
    mesh(armGeo, armMat, pivot);
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
    }
  }
  // the long, glowing hunting tentacles the Lash strikes with (see tentacles.js); a box jelly's
  // hang in bundles from its corners
  const T = sp.tentacles, corners = T.corners ? Array.from({ length: T.count }, (_, i) => Math.PI / 4 + Math.floor(i / 2) * Math.PI / 2 + (i % 2 ? 0.12 : -0.12)) : null;
  rig = new TentacleRig(lean, {
    count: T.count, radius: (box ? edge(Math.PI / 4) * 0.92 : R * 0.92), y: BELL_Y, length: T.length, thickness: T.thickness, flare: T.flare, floorRoot: root,
    angles: corners && corners.map((a) => Math.PI / 2 - a),   // rig angles: x = sin, z = cos
    material: lit(base.clone().lerp(rimCol, 0.3), 1.3),
  });
  // a soft fluorescent halo, so it glows even without the bloom pass (phones)
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: base, transparent: true, opacity: LOOK.num('jelly-halo', 0.37) * (glow + 0.15) / 1.15, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(1.05 * R / 0.27);
  halo.position.y = shape.halo;
  lean.add(halo);

  // --- Face -----------------------------------------------------------------
  const face = new THREE.Group();
  face.name = 'Face';
  if (shape.faceScale) face.scale.setScalar(shape.faceScale);
  bell.add(face);
  const k = 1;
  const eyes = [];
  // Each eye is a flat disc pressed onto the bell (not a ball sticking out), sized per style and
  // spaced so a pair never overlaps
  // (on a flat bell, like a moon jelly's, they shrink so they stay below its top; a fierce eye
  // leaves room for its brow)
  const room = (shape.bellTop - shape.faceY) / (shape.faceScale || 1);
  const eyeR = Math.min({ round: 0.075, big: 0.12, sleepy: 0.11, angry: 0.11, cyclops: 0.17, goldmask: 0.11, shades: 0.12 }[look.eyes] ?? 0.11, room * (look.eyes === 'angry' ? 0.5 : 0.68));
  const eyeAt = (x) => {
    const g = new THREE.Group(), R = eyeR;
    g.position.set(x, 0, -R * 0.12);
    face.add(g);
    eyes.push(g);
    if (look.eyes === 'shades') {
      // gold-rimmed shades: a dark glossy lens in a gold rim, a bright glint across it
      mesh(new THREE.SphereGeometry(R, 24, 16), M.black, g).scale.z = 0.3;
      mesh(new THREE.TorusGeometry(R, R * 0.13, 8, 28), M.award, g, 0, 0, R * 0.08);
      const glint = mesh(new THREE.BoxGeometry(R * 1.1, R * 0.12, R * 0.05), M.white, g, -R * 0.1, R * 0.3, R * 0.3);
      glint.rotation.z = 0.5;
      return g;
    }
    if (look.eyes === 'round') {
      mesh(new THREE.SphereGeometry(R, 16, 12), M.black, g).scale.z = 0.5;
      mesh(new THREE.SphereGeometry(R * 0.3, 8, 6), M.eyeWhite, g, R * 0.32, R * 0.36, R * 0.42);
      return g;
    }
    mesh(new THREE.SphereGeometry(R, 24, 16), M.eyeWhite, g).scale.z = 0.38;
    mesh(new THREE.SphereGeometry(R * 0.62, 20, 12), M.iris, g, 0, -R * 0.05, R * 0.24).scale.z = 0.3;
    mesh(new THREE.SphereGeometry(R * 0.33, 14, 10), M.black, g, 0, -R * 0.05, R * 0.36).scale.z = 0.3;
    if (look.eyes !== 'sleepy') mesh(new THREE.SphereGeometry(R * 0.17, 8, 6), M.eyeWhite, g, R * 0.26, R * 0.24, R * 0.46);
    if (look.eyes === 'sleepy') {
      // a heavy lid over the top half, in a darker shade of the bell, the same flat shape as the eye
      const lid = mesh(new THREE.SphereGeometry(R * 1.06, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), M.lid, g, 0, 0, R * 0.02);
      lid.scale.z = 0.44;
      const lash = mesh(new THREE.TorusGeometry(R * 1.04, R * 0.07, 6, 24, Math.PI), M.black, g, 0, -R * 0.2, R * 0.38);
      lash.rotation.z = Math.PI;
      lash.scale.y = 0.25;
    }
    if (look.eyes === 'angry') {
      const brow = mesh(new THREE.BoxGeometry(R * 1.7, R * 0.32, R * 0.25), M.black, g, x < 0 ? R * 0.1 : -R * 0.1, R * 1.02, R * 0.25);
      brow.rotation.z = x < 0 ? -0.4 : 0.4;
    }
    if (look.eyes === 'goldmask') {
      // a golden masquerade mask: a gold plate behind each eye, swept up and out to a point at the
      // side like a cat's eye, a rim round the eye and a ruby above it
      const side = x < 0 ? -1 : 1;
      const plate = mesh(new THREE.SphereGeometry(R * 1.45, 24, 12), M.award, g, side * R * 0.25, R * 0.1, -R * 0.12);
      plate.scale.set(1.15, 0.85, 0.22);
      const tip = mesh(new THREE.SphereGeometry(R * 0.8, 16, 10), M.award, g, side * R * 1.45, R * 0.75, -R * 0.1);
      tip.scale.set(1.1, 0.45, 0.2); tip.rotation.z = side * 0.6;
      mesh(new THREE.TorusGeometry(R * 1.05, R * 0.14, 8, 28), M.award, g, 0, 0, R * 0.14).scale.z = 0.5;
      mesh(new THREE.SphereGeometry(R * 0.2, 10, 8), M.ruby, g, side * R * 0.2, R * 1.2, R * 0.12);
    }
    return g;
  };
  if (look.eyes === 'cyclops') eyeAt(0);
  else {
    const gap = Math.max(shape.spread * k, eyeR * (look.eyes === 'goldmask' ? 1.45 : 1.2));
    eyeAt(-gap);
    eyeAt(gap);
    // the mask and the shades join across the middle
    if (look.eyes === 'goldmask' || look.eyes === 'shades') mesh(new THREE.BoxGeometry(gap * 0.9, eyeR * 0.22, eyeR * 0.2), M.award, face, 0, eyeR * 0.15, eyeR * 0.05);
  }

  const mouthY = (look.eyes === 'cyclops' ? -0.23 : -0.16) * k;
  if (look.mouth === 'smile' || look.mouth === 'fangs' || look.mouth === 'goldtooth') {
    const m = mesh(new THREE.TorusGeometry(0.06 * k, 0.014 * k, 6, 16, Math.PI), M.mouth, face, 0, mouthY + 0.03 * k, 0.005);
    m.rotation.z = Math.PI;
    if (look.mouth === 'goldtooth') mesh(new THREE.BoxGeometry(0.036 * k, 0.042 * k, 0.014 * k), M.award, face, 0.03 * k, mouthY - 0.028 * k, 0.014);   // one shining gold tooth, hanging from the smile
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

  // Fit the entire expression inside the head, then wrap it onto the bell, including its pulse.
  face.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(face);
  const inverseFace = face.matrixWorld.clone().invert();
  bounds.applyMatrix4(inverseFace);
  const headHeight = shape.bellTop - BELL_Y;
  const fit = Math.min(face.scale.x, headHeight * LOOK.num('jelly-face-height', 0.82) / (bounds.max.y - bounds.min.y), R * LOOK.num('jelly-face-width', 1.45) / (bounds.max.x - bounds.min.x));
  face.scale.setScalar(fit);
  face.position.y = headHeight * 0.5 - (bounds.min.y + bounds.max.y) * 0.5 * fit;
  const point = new THREE.Vector3();
  const faceVertices = new Map();
  const faceOffset = LOOK.num('jelly-face-offset', 0.004), faceLayer = LOOK.num('jelly-face-layer', 0.003);
  let faceFits;
  face.traverse((o) => { if (o.isMesh) faceVertices.set(o, o.geometry.attributes.position.array.slice()); });
  function wrapFace() {
    faceFits = true;
    face.updateWorldMatrix(true, true);
    face.traverse((o) => {
      if (!o.isMesh) return;
      o.renderOrder = 3;
      const toBell = new THREE.Matrix4().multiplyMatrices(bell.matrixWorld.clone().invert(), o.matrixWorld);
      const fromBell = toBell.clone().invert();
      const positions = o.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        point.fromArray(faceVertices.get(o), i * 3).applyMatrix4(toBell);
        const y = point.y / R;
        const upper = sp.profile.findIndex((p) => p[1] >= y);
        const [r0, y0] = sp.profile[Math.max(0, upper - 1)];
        const [r1, y1] = sp.profile[Math.max(1, upper)];
        const radius = R * (r0 + (r1 - r0) * (y - y0) / (y1 - y0));
        if (Math.abs(point.x) >= radius * (sp.square ? 0.8 : 1) * 0.98) faceFits = false;
        const z = sp.square
          ? Math.pow(Math.max(0, (radius * 0.8) ** 4 - point.x ** 4), 0.25)
          : Math.sqrt(Math.max(0, radius * radius - point.x * point.x));
        point.z = z + faceOffset + o.parent.children.indexOf(o) * faceLayer;
        point.applyMatrix4(fromBell);
        positions.setXYZ(i, point.x, point.y, point.z);
      }
      positions.needsUpdate = true;
      o.geometry.computeVertexNormals();
    });
  }
  wrapFace();
  for (let i = 0; !faceFits && i < 32; i++) {
    face.scale.multiplyScalar(0.97);
    face.position.y = headHeight * 0.5 - (bounds.min.y + bounds.max.y) * 0.5 * face.scale.y;
    wrapFace();
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
    case 'tophat': {
      const hat = new THREE.Group();
      hat.rotation.z = -0.12;
      top.add(hat);
      mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.016, 28), M.top, hat, 0, 0.008, 0);
      mesh(new THREE.CylinderGeometry(0.105, 0.11, 0.22, 24), M.top, hat, 0, 0.12, 0);
      mesh(new THREE.CylinderGeometry(0.112, 0.112, 0.035, 24), M.black, hat, 0, 0.035, 0);
      break;
    }
    case 'beanie': {
      const cap = mesh(new THREE.SphereGeometry(0.15, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.top, top, 0, -0.03, 0);
      cap.scale.y = 0.9;
      const rim = mesh(new THREE.TorusGeometry(0.148, 0.028, 8, 28), M.top, top, 0, -0.025, 0);
      rim.rotation.x = Math.PI / 2;
      mesh(new THREE.SphereGeometry(0.048, 12, 10), M.white, top, 0, 0.12, 0);
      break;
    }
    case 'witch': {
      const hat = new THREE.Group();
      hat.rotation.z = 0.1;
      top.add(hat);
      mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.012, 28), M.top, hat, 0, 0.006, 0);
      mesh(new THREE.CylinderGeometry(0.06, 0.115, 0.18, 20), M.top, hat, 0, 0.1, 0);
      const bend = new THREE.Group();                                     // the floppy tip, hinged where the crown ends
      bend.position.y = 0.19;
      bend.rotation.z = -0.55;
      hat.add(bend);
      mesh(new THREE.ConeGeometry(0.06, 0.17, 16).translate(0, 0.085, 0), M.top, bend);
      mesh(new THREE.CylinderGeometry(0.117, 0.117, 0.03, 20), M.black, hat, 0, 0.025, 0);
      mesh(new THREE.BoxGeometry(0.04, 0.035, 0.01), M.gold, hat, 0, 0.025, 0.117);
      break;
    }
    case 'cowboy': {
      const hat = new THREE.Group();
      hat.rotation.x = -0.12;
      top.add(hat);
      // a wide brim bent up at the sides (a shallow bowl), and a tall pinched crown
      // (a band from the bottom of a sphere: its inner edge at the crown, its outer edge higher)
      const brim = mesh(new THREE.SphereGeometry(0.3, 32, 6, 0, Math.PI * 2, 2.32, 0.52), M.top, hat, 0, 0.31, 0);
      brim.scale.z = 0.8;
      brim.material.side = THREE.DoubleSide;
      const crown = mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.2, 20), M.top, hat, 0, 0.1, 0);
      crown.scale.z = 0.8;
      mesh(new THREE.BoxGeometry(0.03, 0.02, 0.16), M.lid, hat, 0, 0.2, 0);   // the pinch on top
      mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.025, 20), M.black, hat, 0, 0.022, 0).scale.z = 0.85;
      break;
    }
    case 'halo': {
      const ring = mesh(new THREE.TorusGeometry(0.13, 0.018, 10, 40), M.halo, top, 0, 0.1, 0);
      ring.rotation.x = Math.PI / 2 - 0.4;                                  // tipped toward the front so it reads as a ring
      spinners.push([ring, 'z', 0.8]);
      wobblers.push([ring, 'y', 0, 0.12]);
      break;
    }
    case 'flower': {
      const f = new THREE.Group();
      f.position.set(0.11, -0.02, 0.06);
      f.rotation.set(-0.4, 0.5, -0.3);
      top.add(f);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const petal = mesh(new THREE.SphereGeometry(0.05, 12, 8), M.top, f, Math.cos(a) * 0.055, Math.sin(a) * 0.055, 0);
        petal.scale.set(1, 0.55, 0.25);
        petal.rotation.z = a;
      }
      mesh(new THREE.SphereGeometry(0.032, 12, 8), M.gold, f, 0, 0, 0.012).scale.z = 0.5;
      wobblers.push([f, 'z', 1, 0.1]);
      break;
    }
    case 'propeller': {
      const cap = mesh(new THREE.SphereGeometry(0.13, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.top, top, 0, -0.03, 0);
      cap.scale.y = 0.75;
      const visor = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.01, 20, 1, false, -Math.PI / 2, Math.PI), M.top, top, 0, -0.02, 0.1);
      visor.scale.z = 0.8;
      mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 8), M.black, top, 0, 0.1, 0);
      const prop = new THREE.Group();
      prop.position.y = 0.135;
      top.add(prop);
      for (const [s, mat] of [[1, M.top], [-1, M.gold]]) {
        const blade = mesh(new THREE.BoxGeometry(0.17, 0.008, 0.045), mat, prop, s * 0.09, 0, 0);
        blade.rotation.x = s * 0.35;
      }
      mesh(new THREE.SphereGeometry(0.014, 8, 6), M.black, prop, 0, 0.004, 0);
      spinners.push([prop, 'y', 14]);
      break;
    }
    case 'chef': {
      mesh(new THREE.CylinderGeometry(0.11, 0.115, 0.1, 24), M.white, top, 0, 0.04, 0);
      for (const [x, z] of [[0, 0], [-0.07, 0.03], [0.07, 0.03], [0, -0.07], [0.05, -0.05], [-0.05, -0.05]]) {
        mesh(new THREE.SphereGeometry(0.075, 14, 10), M.white, top, x, 0.13, z).scale.y = 0.8;
      }
      break;
    }
    case 'catears':
      for (const s of [-1, 1]) {
        const ear = mesh(new THREE.ConeGeometry(0.065, 0.13, 4), M.top, top, s * 0.12, 0.02, 0);
        ear.rotation.set(0, Math.PI / 4, -s * 0.35);
        ear.scale.z = 0.45;
        const inner = mesh(new THREE.ConeGeometry(0.04, 0.085, 4), M.pink, ear, 0, -0.012, 0.03);
        inner.scale.z = 0.4;
      }
      break;
    case 'unicorn': {
      const horn = new THREE.Group();
      horn.rotation.x = 0.35;
      top.add(horn);
      mesh(new THREE.ConeGeometry(0.035, 0.24, 16), M.top, horn, 0, 0.11, 0);
      for (let i = 0; i < 4; i++) {                                       // the spiral ridge
        const r = mesh(new THREE.TorusGeometry(0.03 - i * 0.006, 0.005, 6, 16), M.gold, horn, 0, 0.03 + i * 0.045, 0);
        r.rotation.set(Math.PI / 2 + 0.3, 0, 0);
      }
      break;
    }
    // --- earned (cosmetics.js): polished gold that glows a little
    case 'goldcrown': {
      // a tall jewelled crown: a band with a ruby and sapphires, five points topped with pearls
      mesh(new THREE.CylinderGeometry(0.17, 0.16, 0.08, 28, 1, true), M.award, top, 0, 0.03, 0).material.side = THREE.DoubleSide;
      mesh(new THREE.TorusGeometry(0.165, 0.012, 8, 32), M.award, top, 0, -0.01, 0).rotation.x = Math.PI / 2;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const p = mesh(new THREE.ConeGeometry(0.038, 0.13, 4), M.award, top, Math.sin(a) * 0.16, 0.13, Math.cos(a) * 0.16);
        p.rotation.y = a;
        mesh(new THREE.SphereGeometry(0.018, 10, 8), M.white, top, Math.sin(a) * 0.16, 0.205, Math.cos(a) * 0.16);
        mesh(new THREE.SphereGeometry(0.02, 10, 8), i ? M.sapphire : M.ruby, top, Math.sin(a) * 0.172, 0.03, Math.cos(a) * 0.172).scale.z = 0.5;
      }
      break;
    }
    case 'laurel':
      // a victor's laurel wreath: a gold band round the bell with two rows of big golden leaves
      // standing up along it, from the back to either side of the front
      mesh(new THREE.TorusGeometry(0.17, 0.012, 8, 32), M.award, top, 0, -0.01, 0).rotation.x = Math.PI / 2;
      for (const s of [-1, 1]) for (let i = 0; i < 6; i++) {
        const a = s * (0.55 + i * 0.42), x = Math.sin(a) * 0.17, z = Math.cos(a) * 0.17;
        for (const lift of [0, 1]) {
          const leaf = mesh(new THREE.SphereGeometry(0.05, 10, 6), M.award, top, x, 0.03 + lift * 0.035, z);
          leaf.scale.set(0.42, 1, 0.16);
          leaf.rotation.set(0, a, s * (lift ? -0.5 : 0.5) + s * 0.4);
        }
      }
      break;
    case 'goldantlers':
      // golden antlers: a curved beam each side with two tines
      for (const s of [-1, 1]) {
        const beam = new THREE.Group();
        beam.position.set(s * 0.1, 0.02, 0);
        beam.rotation.z = -s * 0.45;
        top.add(beam);
        mesh(new THREE.CylinderGeometry(0.014, 0.022, 0.24, 8), M.award, beam, 0, 0.12, 0);
        for (const [y, t] of [[0.1, 0.9], [0.18, 0.7]]) {
          const tine = mesh(new THREE.CylinderGeometry(0.009, 0.014, 0.1, 6), M.award, beam, s * 0.03, y + 0.03, 0);
          tine.rotation.z = -s * t;
        }
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
    let contract = 0;

    if (bell) {
      // the swim cycle comes from the player (so the surge and the squeeze line up); menus and
      // the creator don't pass one, so keep a slow idle pulse going there
      let swim = s.swim;
      if (swim == null) swim = idleSwim = (idleSwim + dt * 0.6) % 1;
      kick = Math.max(0, kick - dt * 3);
      // power stroke: the bell squeezes narrow and tall; glide: it relaxes open, wide and flat
      contract = kick > 0.05 ? Math.max(kick, squeeze(swim)) : squeeze(swim) * (0.45 + 0.55 * move);
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
    rig?.update(dt, { localVel, contract, vy: s.vy || 0 });


    spinners.forEach(([o, ax, sp]) => { o.rotation[ax] += dt * sp; });
    wobblers.forEach(([o, ax, ph, amt], i) => {
      const drive = 0.3 + move * 0.7 + (s.grounded ? 0 : 0.6);
      o.rotation[ax] = baseRot[i] + Math.sin(t * 6 + ph) * amt * drive - (ax === 'x' ? move * amt : 0);
    });

    blinkIn -= dt;
    const closing = blinkIn < 0 && blinkIn > -0.12;
    if (blinkIn < -0.12) blinkIn = 2 + Math.random() * 3.5;
    const eyeHeight = closing ? 0.12 : 1;
    if (eyes[0].scale.y !== eyeHeight) {
      eyes.forEach((e) => { e.scale.y = eyeHeight; });
      wrapFace();
    }
  }

  // landing: squash flat (impact > 0), harder the faster it came down; the spring overshoots
  // into a little stretch and settles. (It used to push the other way: a landing stretched.)
  function land(strength) {
    impactV += Math.min(1.6, strength) * 4.2;
  }
  // takeoff: a stretch up out of the squeeze, on the same spring
  function takeoff(k = 1) {
    impactV -= 2.2 * k;
  }

  function pulse(k = 1) { kick = Math.max(kick, k); }

  function dispose() {
    rig?.dispose();
    root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.map?.dispose(); o.material.dispose(); } });
    Object.values(M).forEach((m) => m.dispose());
  }

  return { root, update, land, takeoff, pulse, dispose, look, tentacles: rig, squash };
}
