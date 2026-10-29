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
  eyes: [['round', 'Dots'], ['big', 'Big'], ['sleepy', 'Sleepy'], ['angry', 'Fierce'], ['cyclops', 'Cyclops'],
    ['googly', 'Googly eyes'], ['hearts', 'Heart eyes'], ['stars', 'Star eyes'], ['snorkel', 'Snorkel mask'], ['monocle', 'Monocle'], ['glasses3d', '3D glasses'],
    ['goldmask', 'Golden mask'], ['shades', 'Gold shades'], ['goldspecs', 'Bookworm specs'], ['pixelshades', 'Pixel shades']],
  mouth: [['smile', 'Smile'], ['open', 'Open'], ['fangs', 'Fangs'], ['none', 'None'], ['moustache', 'Moustache'], ['tongue', 'Tongue out'], ['bubblegum', 'Bubble gum'], ['goldtooth', 'Gold tooth']],
  top: [['none', 'None'], ['antennae', 'Antennae'], ['sprout', 'Sprout'], ['partyhat', 'Party hat'], ['bow', 'Bow'], ['crown', 'Crown'], ['horns', 'Horns'],
    ['tophat', 'Top hat'], ['beanie', 'Beanie'], ['witch', 'Witch hat'], ['cowboy', 'Cowboy hat'], ['halo', 'Halo'], ['flower', 'Flower'],
    ['propeller', 'Propeller cap'], ['chef', 'Chef hat'], ['catears', 'Cat ears'], ['unicorn', 'Unicorn horn'],
    // the shop's (bought with Pearls, cosmetics.js PRICES)
    ['bottlecap', 'Bottle cap'], ['thimble', 'Thimble helm'], ['paperboat', 'Paper boat'], ['stickynote', 'Sticky note'], ['showercap', 'Shower cap'],
    ['shell', 'Hermit shell'], ['starfish', 'Starfish'], ['sock', 'Odd sock'], ['lampshade', 'Lampshade'], ['fishbowl', 'Fishbowl'], ['coral', 'Coral crown'],
    // the golden ones are earned (cosmetics.js NEEDS)
    ['goldcrown', 'Golden crown'], ['laurel', 'Golden laurel'], ['goldantlers', 'Golden antlers'],
    ['earmuffs', 'Dust-bunny earmuffs'], ['duck', 'Golden duck'], ['sharkfin', 'Golden fin'], ['headset', 'Encore headset'],
    ['goldbook', 'Golden book'], ['goldkettle', 'Golden kettle'], ['tiara', 'Diamond tiara'],
    ['crown_nettle', 'Nettle crown'], ['crown_moon', 'Moon crown'], ['crown_lion', 'Mane crown'], ['crown_box', 'Box crown'], ['crown_crystal', 'Crystal crown'], ['crown_egg', 'Yolk crown']],
  pattern: [['none', 'None'], ['rings', 'Rings'], ['stripes', 'Stripes'], ['freckles', 'Freckles']],   // drawn on the inner bell in the arm color
  finish: [['glow', 'Glow'], ['gilded', 'Gilded']],
};
// tops that keep their own colour (the Hat colour row is hidden for them)
export const OWN_COLOR_TOPS = ['none', 'sprout', 'chef', 'goldcrown', 'laurel', 'goldantlers', 'thimble', 'shell', 'fishbowl', 'coral',
  'earmuffs', 'duck', 'sharkfin', 'headset', 'goldbook', 'goldkettle', 'tiara', 'crown_nettle', 'crown_moon', 'crown_lion', 'crown_box', 'crown_crystal', 'crown_egg'];

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
  // every jelly is the same size (a finish and a pattern not in OPTIONS, from an older save, went above)
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
    pattern: option('pattern'),
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
    // the shop's household bits, and the golden awards' gems and trims
    silver: std('#d4d9e0', { roughness: 0.3, metalness: 0.7, emissive: new THREE.Color('#5a606a'), emissiveIntensity: 0.5 }),
    paper: std('#f2eee4', { roughness: 0.9, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ color: new THREE.Color('#dff6ff'), roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
    water: new THREE.MeshStandardMaterial({ color: new THREE.Color('#5fc8ff').convertSRGBToLinear(), roughness: 0.1, transparent: true, opacity: 0.45, depthWrite: false, emissive: new THREE.Color('#0a3550'), emissiveIntensity: 0.6 }),
    fish: std('#ff8a1e', { roughness: 0.35, emissive: new THREE.Color('#ff5a00'), emissiveIntensity: 0.35 }),
    diamond: std('#f4fbff', { roughness: 0.02, metalness: 0.3, emissive: new THREE.Color('#bfe6ff'), emissiveIntensity: 0.8, flatShading: true }),
    emerald: std('#20d68a', { roughness: 0.1, emissive: new THREE.Color('#20d68a'), emissiveIntensity: 0.5 }),
    amber: std('#ffa21a', { roughness: 0.1, emissive: new THREE.Color('#ff8a00'), emissiveIntensity: 0.6 }),
    moonstone: std('#eaf2ff', { roughness: 0.15, emissive: new THREE.Color('#bcd4ff'), emissiveIntensity: 0.9 }),
    ice: new THREE.MeshStandardMaterial({ color: new THREE.Color('#d8f4ff'), roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.7, emissive: new THREE.Color('#7fd0ff'), emissiveIntensity: 0.5, flatShading: true }),
    fluff: std('#cfc8c2', { roughness: 1 }),
    enamel: std('#fffdf4', { roughness: 0.2, side: THREE.DoubleSide, emissive: new THREE.Color('#fff4d0'), emissiveIntensity: 0.3 }),
    coral: std('#ff6f7d', { roughness: 0.75 }),
    coralTip: std('#ffd3c4', { roughness: 0.7, emissive: new THREE.Color('#ff9a8a'), emissiveIntensity: 0.25 }),
    shell: look.top === 'shell' && new THREE.MeshStandardMaterial({ map: shellBands(), roughness: 0.4 }),
    shellLip: std('#ffb8a8', { roughness: 0.3 }),
    heart: std('#ff3f78', { roughness: 0.25, emissive: new THREE.Color('#ff2a6a'), emissiveIntensity: 0.55 }),
    star: std('#ffe14a', { roughness: 0.25, emissive: new THREE.Color('#ffc21a'), emissiveIntensity: 0.8 }),
    brown: std('#4a2c1c', { roughness: 0.6 }),
    gum: std('#ff8ac4', { roughness: 0.3, transparent: true, opacity: 0.88, emissive: new THREE.Color('#ff5aa8'), emissiveIntensity: 0.25 }),
    red3d: std('#ff2a3a', { roughness: 0.1, transparent: true, opacity: 0.85, emissive: new THREE.Color('#ff2a3a'), emissiveIntensity: 0.4 }),
    cyan3d: std('#2ad8ff', { roughness: 0.1, transparent: true, opacity: 0.85, emissive: new THREE.Color('#2ad8ff'), emissiveIntensity: 0.4 }),
    lens: std('#9fe8ff', { roughness: 0.05, transparent: true, opacity: 0.35 }),
    snorkel: std('#ffb21a', { roughness: 0.5 }),
    snorkelTip: std('#ff5a2a', { roughness: 0.4 }),
    pebble: std('#8a7f9a', { roughness: 0.7 }),
    steam: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff'), transparent: true, opacity: 0.55, depthWrite: false }),
    // (the printed ones only for the hat that wears them: each draws a canvas)
    thimble: look.top === 'thimble' && std('#d4d9e0', { roughness: 0.3, metalness: 0.7, emissive: new THREE.Color('#5a606a'), emissiveIntensity: 0.5, bumpMap: dimples(), bumpScale: 2 }),
    origami: std(look.topColor, { roughness: 0.85, side: THREE.DoubleSide, flatShading: true }),
    note: look.top === 'stickynote' && new THREE.MeshStandardMaterial({ map: stickyNote(look.topColor), roughness: 0.85, side: THREE.DoubleSide }),
    showercap: look.top === 'showercap' && new THREE.MeshStandardMaterial({ map: dotted(look.topColor), roughness: 0.25, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
    sock: look.top === 'sock' && new THREE.MeshStandardMaterial({ map: striped(look.topColor), roughness: 0.95 }),
    sockCuff: std('#f4efe6', { roughness: 0.95 }),
    sockToe: std('#' + new THREE.Color(look.topColor).lerp(new THREE.Color('#000000'), 0.35).getHexString(), { roughness: 0.95 }),
    fabric: std(look.topColor, { roughness: 0.9, side: THREE.DoubleSide, emissive: new THREE.Color(look.topColor), emissiveIntensity: 0.25 }),
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

// the shop's printed and woven looks (character.js tops): drawn once per look
function dimples() {
  return canvasTexture(128, 64, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#6a6a6a';
    for (let y = 6; y < h * 0.8; y += 7) for (let x = (y / 7) % 2 ? 3.5 : 0; x < w; x += 7) { g.beginPath(); g.arc(x, h - y, 2.2, 0, 7); g.fill(); }
  });
}
function stickyNote(hex) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = hex; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, 0, w, 16);                       // the sticky strip
    g.strokeStyle = 'rgba(30,20,60,0.75)'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(64, 98); g.bezierCurveTo(20, 70, 30, 30, 64, 52); g.bezierCurveTo(98, 30, 108, 70, 64, 98); g.stroke();   // a doodled heart
  });
}
function shellBands() {
  return canvasTexture(16, 256, (g, w, h) => {
    g.fillStyle = '#f3e2c8'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 5; k++) { const y = h * (1 - (k + 0.1) / 5); g.fillStyle = '#c9805a'; g.fillRect(0, y - 9, w, 9); g.fillStyle = '#8a4a30'; g.fillRect(0, y - 2, w, 2); }
  });
}
function dotted(hex) {
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = hex; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (let y = 10; y < h; y += 22) for (let x = (y / 22) % 2 ? 11 : 0; x < w + 11; x += 22) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
  });
}
function striped(hex) {
  return canvasTexture(256, 32, (g, w, h) => {
    g.fillStyle = hex; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4efe6';
    for (let x = 40; x < w * 0.85; x += 36) g.fillRect(x, 0, 13, h);                      // stripes down the leg
  });
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
  const gilded = look.finish === 'gilded';
  const bellCol = gilded ? base.clone().lerp(new THREE.Color('#ffc93a'), 0.8) : base;   // the inner bell's glow (a gilded bell's runs gold)
  const rimCol = gilded ? new THREE.Color('#ffd76a') : base.clone().lerp(new THREE.Color('#f4ff8a'), 0.55);
  const glow = LOOK.num('jelly-glow', 1);
  const R = sp.R, box = !!sp.square;
  const lathe = (k) => {
    const g = new THREE.LatheGeometry(sp.profile.map(([r, y]) => new THREE.Vector2(r * R * k, y * R * k)), 48, 0, Math.PI * 2);
    return box ? squarish(g) : g;
  };
  // inner bell (u runs around the bell, canvas top = the crown): dark, with glowing canals,
  // a glowing ring at the rim and bright spots on the crown, used as color and glow map
  const css = (c) => '#' + c.getHexString();
  const innerTex = canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = css(bellCol.clone().multiplyScalar(0.18)); g.fillRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, css(bellCol.clone().multiplyScalar(0.35))); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.strokeStyle = css(bellCol); g.globalAlpha = 0.95;
    const n = sp.canals, thin = n > 24;
    for (let k = 0; k < n; k++) { const x = (k + 0.5) / n * w; g.lineWidth = thin ? 1.5 : k % 2 ? 2 : 4; g.beginPath(); g.moveTo(x, h * 0.12); g.bezierCurveTo(x + 3, h * 0.4, x - 3, h * 0.65, x, h); g.stroke(); }
    g.globalAlpha = 1;
    g.fillStyle = css(rimCol); g.fillRect(0, h * 0.9, w, h * 0.1);                         // the glowing rim band
    const rnd = rng(hash(look.body));
    for (let k = 0; k < sp.crownSpots; k++) {                                              // spots on the crown
      g.fillStyle = k % 3 ? '#fff6b0' : css(rimCol);
      g.beginPath(); g.ellipse(rnd() * w, h * (0.04 + rnd() * 0.32), 2.5 + rnd() * 4, 2 + rnd() * 3, 0, 0, 7); g.fill();
    }
    // the bell pattern, in the arm color, glowing through the clear outer bell (the texture wraps
    // round the bell, so a shape near an edge is drawn again on the other side)
    g.fillStyle = css(acc.clone().lerp(new THREE.Color('#ffffff'), 0.25)); g.globalAlpha = 1;
    if (look.pattern === 'rings') for (const [y, t] of [[0.3, 7], [0.5, 9], [0.7, 11]]) g.fillRect(0, h * y - t / 2, w, t);
    if (look.pattern === 'stripes') for (let k = 0; k < 12; k++) {
      const x = (k + 0.5) / 12 * w;
      g.beginPath(); g.moveTo(x - 2.5, h * 0.06); g.lineTo(x + 2.5, h * 0.06); g.lineTo(x + 8, h * 0.88); g.lineTo(x - 8, h * 0.88); g.fill();
    }
    if (look.pattern === 'freckles') {
      const fr = rng(hash(look.body + 'freckles'));
      for (let k = 0; k < 46; k++) {
        const x = fr() * w, y = h * (0.12 + fr() * 0.72), r = 3 + fr() * 4;
        for (const dx of [-w, 0, w]) { g.beginPath(); g.arc(x + dx, y, r, 0, 7); g.fill(); }
      }
    }
    g.globalAlpha = 1;
  });
  const inner = new THREE.MeshStandardMaterial({ map: innerTex, emissiveMap: innerTex, emissive: 0xffffff, emissiveIntensity: 1.6 * glow, roughness: 0.3 });
  mesh(lathe(0.9), inner, bell);
  // outer bell: clear and glossy, a tint of the body color
  // (gilded: an earned finish, cosmetics.js: a thin shell of polished gold the glow shows through)
  const outer = gilded
    ? new THREE.MeshPhysicalMaterial({ color: M.award.color.clone(), metalness: 1, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.62, depthWrite: false, emissive: new THREE.Color('#a86c00'), emissiveIntensity: 0.9 })
    : new THREE.MeshPhysicalMaterial({ color: base, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: sp.outer, depthWrite: false, emissive: base, emissiveIntensity: 0.25 * glow });
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
  const eyeR = Math.min({ round: 0.075, big: 0.12, sleepy: 0.11, angry: 0.11, cyclops: 0.17, goldmask: 0.11, shades: 0.12, googly: 0.13, hearts: 0.12, stars: 0.12, pixelshades: 0.12 }[look.eyes] ?? 0.11, room * (look.eyes === 'angry' ? 0.5 : 0.68));
  const googly = [];                         // googly eyes' pupils, which roll as the jelly moves
  const twinkle = [];                        // heart and star eyes: a beat or a twinkle
  // eyewear doesn't blink (the eyes behind it do, but you can't see them through the frames)
  const blinks = !['googly', 'snorkel', 'monocle', 'glasses3d', 'goldspecs', 'pixelshades', 'shades'].includes(look.eyes);
  // a flat shape for the face, from a THREE.Shape (the face is pressed onto the bell)
  const flat = (shape, mat, parent, x = 0, y = 0, z = 0) => mesh(new THREE.ShapeGeometry(shape, 12), mat, parent, x, y, z);
  const roundRect = (w, h, r, path = new THREE.Shape()) => {
    const x = -w / 2, y = -h / 2;
    path.moveTo(x + r, y); path.lineTo(x + w - r, y); path.quadraticCurveTo(x + w, y, x + w, y + r); path.lineTo(x + w, y + h - r);
    path.quadraticCurveTo(x + w, y + h, x + w - r, y + h); path.lineTo(x + r, y + h); path.quadraticCurveTo(x, y + h, x, y + h - r);
    path.lineTo(x, y + r); path.quadraticCurveTo(x, y, x + r, y);
    return path;
  };
  const frame = (w, h, r, t) => { const f = roundRect(w, h, r); f.holes.push(roundRect(w - 2 * t, h - 2 * t, Math.max(0.001, r - t), new THREE.Path())); return f; };
  const starShape = (ro, ri, n = 5) => {
    const st = new THREE.Shape();
    for (let i = 0; i <= n * 2; i++) { const a = Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? ri : ro; i ? st.lineTo(Math.cos(a) * r, Math.sin(a) * r) : st.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    return st;
  };
  const eyeAt = (x) => {
    const g = new THREE.Group(), R = eyeR;
    g.position.set(x, 0, -R * 0.12);
    face.add(g);
    eyes.push(g);
    if (look.eyes === 'googly') {
      // craft-box googly eyes: a white dome with a dark rim, its loose pupil rolling round inside
      mesh(new THREE.SphereGeometry(R, 28, 16), M.eyeWhite, g).scale.z = 0.4;
      mesh(new THREE.TorusGeometry(R * 0.98, R * 0.07, 6, 32), M.black, g, 0, 0, R * 0.04).scale.z = 0.4;
      const pupil = mesh(new THREE.SphereGeometry(R * 0.5, 20, 12), M.black, g, 0, -R * 0.4, R * 0.3);
      pupil.scale.z = 0.3;
      googly.push({ pupil, R, x: 0, y: -R * 0.4, vx: 0, vy: 0 });
      return g;
    }
    if (look.eyes === 'hearts' || look.eyes === 'stars') {
      let shape;
      if (look.eyes === 'hearts') {
        shape = new THREE.Shape();
        shape.moveTo(0, -R); shape.bezierCurveTo(-R * 0.45, -R * 0.55, -R * 1.15, -R * 0.15, -R * 1.05, R * 0.38);
        shape.bezierCurveTo(-R * 0.98, R * 0.95, -R * 0.2, R * 1.05, 0, R * 0.48);
        shape.bezierCurveTo(R * 0.2, R * 1.05, R * 0.98, R * 0.95, R * 1.05, R * 0.38);
        shape.bezierCurveTo(R * 1.15, -R * 0.15, R * 0.45, -R * 0.55, 0, -R);
      } else {
        shape = starShape(R * 1.15, R * 0.5);
        flat(starShape(R * 1.32, R * 0.62), M.black, g, 0, 0, -0.001);   // a dark edge, so the star reads on any bell
      }
      const s = flat(shape, look.eyes === 'hearts' ? M.heart : M.star, g);
      const shine = mesh(new THREE.CircleGeometry(R * 0.2, 12), M.eyeWhite, g, -R * 0.4, R * 0.35, 0.002);
      shine.scale.y = 0.7;
      if (look.eyes === 'stars') mesh(new THREE.ShapeGeometry(starShape(R * 0.32, R * 0.08, 4)), M.eyeWhite, g, R * 0.3, -R * 0.25, 0.002);
      twinkle.push([s, x]);
      return g;
    }
    if (look.eyes === 'pixelshades') {
      // pixel-art shades, a step at a time: black pixels, two white glints, a gold bar across the top
      const P = R * 0.3, rows = [[-3, 3], [-3, 3], [-2, 2], [-1, 1]];
      rows.forEach(([a, b], r) => {
        for (let c = a; c <= b; c++) {
          const glint = (r === 1 && c === -2) || (r === 2 && c === -1);
          mesh(new THREE.PlaneGeometry(P * 1.18, P * 1.18), glint ? M.eyeWhite : M.black, g, (c + 0.5) * P - P * 0.5, R * 0.5 - r * P, glint ? 0.001 : 0);
        }
      });
      mesh(new THREE.PlaneGeometry(P * 8.5, P * 0.7), M.award, g, 0, R * 0.5 + P * 0.75, 0.001);
      return g;
    }
    if (look.eyes === 'goldmask') {
      // the mask's gold plate behind the eye, swept up and out to a point like a cat's eye (the face
      // is pressed flat onto the bell and layered in the order it's built, so it goes in first)
      const side = x < 0 ? -1 : 1;
      const plate = mesh(new THREE.SphereGeometry(R * 1.45, 24, 12), M.award, g, side * R * 0.25, R * 0.1, 0);
      plate.scale.set(1.15, 0.85, 0.15);
      const tip = mesh(new THREE.SphereGeometry(R * 0.8, 16, 10), M.award, g, side * R * 1.45, R * 0.75, 0);
      tip.scale.set(1.1, 0.45, 0.2); tip.rotation.z = side * 0.6;
    }
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
      // a golden masquerade mask: a rim round the eye and a ruby above it, on the plate added first
      const side = x < 0 ? -1 : 1;
      mesh(new THREE.TorusGeometry(R * 1.05, R * 0.14, 8, 28), M.award, g, 0, 0, R * 0.14).scale.z = 0.5;
      mesh(new THREE.SphereGeometry(R * 0.2, 10, 8), M.ruby, g, side * R * 0.2, R * 1.2, R * 0.12);
    }
    // eyewear over the eye
    if (look.eyes === 'glasses3d') {
      // cardboard 3D glasses: a white frame, red lens on the left, cyan on the right
      flat(roundRect(R * 2.5, R * 2.1, R * 0.25), x < 0 ? M.red3d : M.cyan3d, g, 0, 0, 0.002);
      flat(frame(R * 2.7, R * 2.3, R * 0.3, R * 0.22), M.paper, g, 0, 0, 0.003);
    }
    if (look.eyes === 'monocle' && x > 0) {
      // a gold-rimmed monocle on the right eye, on a fine gold chain that loops down and away
      mesh(new THREE.CircleGeometry(R * 1.15, 28), M.lens, g, 0, 0, 0.003);
      mesh(new THREE.TorusGeometry(R * 1.18, R * 0.12, 8, 32), M.gold, g, 0, 0, R * 0.06).scale.z = 0.4;
      for (let i = 0; i < 9; i++) {
        const a = -0.9 - i * 0.2, rr = R * (1.35 + i * 0.12);
        const link = mesh(new THREE.TorusGeometry(R * 0.07, R * 0.025, 4, 10), M.gold, g, Math.cos(a) * rr * 0.55 + R * 0.6, Math.sin(a) * rr - R * 0.05 * i, 0.002);
        link.rotation.z = a + (i % 2) * 1.2;
      }
    }
    if (look.eyes === 'goldspecs') {
      // half-moon reading glasses in gold, perched low on the eye
      const lens = new THREE.Shape(); lens.absarc(0, 0, R * 1.05, Math.PI, 0, false); lens.lineTo(-R * 1.05, 0);
      flat(lens, M.lens, g, 0, -R * 0.15, 0.002).rotation.z = Math.PI;
      const rim = mesh(new THREE.TorusGeometry(R * 1.08, R * 0.11, 8, 28, Math.PI), M.award, g, 0, -R * 0.15, R * 0.04);
      rim.rotation.z = Math.PI; rim.scale.z = 0.4;
      mesh(new THREE.PlaneGeometry(R * 2.3, R * 0.16), M.award, g, 0, -R * 0.12, 0.004);
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
    if (look.eyes === 'goldspecs') mesh(new THREE.TorusGeometry(gap * 0.32, eyeR * 0.09, 6, 16, Math.PI), M.award, face, 0, -eyeR * 0.1, eyeR * 0.05).scale.z = 0.4;
    if (look.eyes === 'glasses3d') mesh(new THREE.PlaneGeometry(gap * 0.5, eyeR * 0.45), M.paper, face, 0, eyeR * 0.3, 0.002);
    if (look.eyes === 'pixelshades') mesh(new THREE.PlaneGeometry(gap * 0.7, eyeR * 0.3), M.black, face, 0, eyeR * 0.5, 0);
    if (look.eyes === 'snorkel') {
      // a dive mask: one wide tinted lens over both eyes in a rubber frame
      const w = gap * 2 + eyeR * 2.9, h = eyeR * 2.7;
      flat(roundRect(w, h, eyeR * 0.9), M.lens, face, 0, 0, 0.004);
      flat(frame(w + eyeR * 0.5, h + eyeR * 0.5, eyeR * 1.1, eyeR * 0.36), M.snorkel, face, 0, 0, 0.005);
    }
  }

  const mouthY = (look.eyes === 'cyclops' ? -0.23 : -0.16) * k;
  if (look.mouth === 'smile' || look.mouth === 'fangs' || look.mouth === 'goldtooth') {
    const m = mesh(new THREE.TorusGeometry(0.06 * k, 0.014 * k, 6, 16, Math.PI), M.mouth, face, 0, mouthY + 0.03 * k, 0.005);
    m.rotation.z = Math.PI;
    if (look.mouth === 'goldtooth') mesh(new THREE.BoxGeometry(0.042 * k, 0.05 * k, 0.016 * k), M.award, face, 0.03 * k, mouthY - 0.032 * k, 0.014);   // one shining gold tooth, hanging from the smile
    if (look.mouth === 'fangs') {
      for (const s of [-1, 1]) {
        const f = mesh(new THREE.ConeGeometry(0.018 * k, 0.05 * k, 8), M.white, face, s * 0.045 * k, mouthY - 0.03 * k, 0.01);
        f.rotation.x = Math.PI;
      }
    }
  } else if (look.mouth === 'open') {
    mesh(new THREE.SphereGeometry(0.06 * k, 16, 10), M.mouth, face, 0, mouthY, 0).scale.set(1, 0.75, 0.35);
    mesh(new THREE.SphereGeometry(0.035 * k, 12, 8), M.tongue, face, 0, mouthY - 0.02 * k, 0.012).scale.set(1, 0.6, 0.4);
  } else if (look.mouth === 'moustache') {
    // a curly handlebar moustache over a little smile
    const m = mesh(new THREE.TorusGeometry(0.04, 0.011, 6, 16, Math.PI), M.mouth, face, 0, mouthY - 0.005, 0.004);
    m.rotation.z = Math.PI;
    for (const s of [-1, 1]) {
      const lobe = mesh(new THREE.CircleGeometry(0.06, 24), M.brown, face, s * 0.05, mouthY + 0.03, 0.006);
      lobe.scale.set(1, 0.42, 1); lobe.rotation.z = s * 0.22;
      const curl = mesh(new THREE.TorusGeometry(0.02, 0.009, 6, 18, Math.PI * 1.25), M.brown, face, s * 0.105, mouthY + 0.04, 0.006);
      curl.rotation.z = s > 0 ? -Math.PI * 0.55 : Math.PI * 1.55 - Math.PI * 1.25 + Math.PI;
      curl.scale.x = s;
    }
  } else if (look.mouth === 'tongue') {
    // a cheeky grin with the tongue poking out, a line down its middle
    const m = mesh(new THREE.TorusGeometry(0.065, 0.013, 6, 16, Math.PI), M.mouth, face, 0, mouthY + 0.03, 0.004);
    m.rotation.z = Math.PI;
    const t = new THREE.Shape();
    t.moveTo(-0.032, 0); t.lineTo(-0.032, -0.03); t.absarc(0, -0.03, 0.032, Math.PI, 0, false); t.lineTo(0.032, 0);
    flat(t, M.tongue, face, 0.012, mouthY - 0.03, 0.005);
    mesh(new THREE.PlaneGeometry(0.005, 0.035), M.mouth, face, 0.012, mouthY - 0.05, 0.006);
  } else if (look.mouth === 'bubblegum') {
    // pursed lips; the bubble itself is blown out in front of the bell (below, once the face is on)
    mesh(new THREE.CircleGeometry(0.026, 16), M.mouth, face, 0, mouthY + 0.01, 0.004).scale.x = 0.8;
    mesh(new THREE.TorusGeometry(0.028, 0.008, 6, 18), M.tongue, face, 0, mouthY + 0.01, 0.005).scale.x = 0.8;
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

  // --- Fitting things to the bell -------------------------------------------
  // the bell's radius at height y (in the bell's frame, at rest); a box bell's at its corners
  const bellR = (y) => {
    const v = y / R, P = sp.profile;
    let i = P.findIndex((q) => q[1] >= v);
    if (i < 1) i = i === 0 ? 1 : P.length - 1;
    const [r0, y0] = P[i - 1], [r1, y1] = P[i];
    return R * Math.max(0, r0 + (r1 - r0) * THREE.MathUtils.clamp((v - y0) / (y1 - y0), 0, 1)) * (box ? 0.95 : 1);
  };
  const toTop = shape.topY - BELL_Y;          // from the bell's frame to the top's
  // where a round thing of radius r rests on the bell, in the top's frame: the highest point where
  // the bell is that wide (the very top, for anything narrower than the crown)
  // (a fried egg's yolk stands up off its crown, so it counts too)
  const yolk = sp.extra === 'yolk' ? { y: crownH * 0.82, r: R * 0.45, h: R * 0.45 * 0.55 } : null;
  const seat = (r) => {
    let y = crownH;
    while (y > 0 && bellR(y) < r) y -= 0.002;
    if (yolk && r < yolk.r) y = Math.max(y, yolk.y + yolk.h * Math.sqrt(1 - (r / yolk.r) ** 2));
    return y - toTop;
  };
  // the bell's own outline from depth D below its crown up to the crown, pushed out a little: a
  // cap that hugs any species' bell (in the bell's frame)
  const capProfile = (D, k, add) => Array.from({ length: 13 }, (_, i) => { const y = crownH - D + (D * i) / 12; return new THREE.Vector2(i === 12 ? 0.001 : bellR(y) * k + add, y + add * (i / 12)); });
  // lay a flat piece (built round y = 0) over the crown: each point drops to the bell beneath it
  const drape = (geo, lift) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + seat(Math.hypot(p.getX(i), p.getZ(i))) + lift);
    geo.computeVertexNormals();
  };
  // a band over the bell from side to side, radius r out at height y (the top's frame)
  const band = (r, y, t, mat) => {
    const peak = seat(0.001) + 0.012 - y;
    const arc = new THREE.CatmullRomCurve3(Array.from({ length: 17 }, (_, i) => { const a = (i / 16) * Math.PI; return new THREE.Vector3(Math.cos(a) * r, y + Math.sin(a) * Math.max(peak, 0.02), 0); }));
    mesh(new THREE.TubeGeometry(arc, 40, t, 8, false), mat, top);
  };
  // a tube that narrows along its curve, from k0 to k1 of its radius
  const taper = (geo, curve, k0, k1, mat) => {
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) { const u = Math.min(1, uv.getX(i)), pt = curve.getPointAt(u), k = k0 + (k1 - k0) * u; p.setXYZ(i, pt.x + (p.getX(i) - pt.x) * k, pt.y + (p.getY(i) - pt.y) * k, pt.z + (p.getZ(i) - pt.z) * k); }
    geo.computeVertexNormals();
    return mesh(geo, mat, top);
  };
  const faceTop = face.position.y + bounds.max.y * face.scale.y;   // the top of the face (eyes, brows, frames), in the bell's frame
  const floaters = [], steam = [];           // things that bob in the air; steam puffs from a spout
  let soft = false;                          // a soft hat squeezes with the bell's pulse; a hard one rides on it

  // the face's pieces that stand off the bell: bubble gum's bubble, the snorkel's tube (both in the
  // bell's frame, so they pulse with it)
  let gum = null;
  if (look.mouth === 'bubblegum') {
    const my = face.position.y + (mouthY + 0.01) * face.scale.y;
    gum = mesh(new THREE.SphereGeometry(0.05, 24, 16), M.gum, bell, 0, my, bellR(my));
    gum.renderOrder = 4;
  }
  if (look.eyes === 'snorkel') {
    const fy = face.position.y, a = 0.75, c = (y, k = 1.04) => { const r = bellR(y) * k; return new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r); };
    const curve = new THREE.CatmullRomCurve3([c(fy), c((fy + crownH) / 2), c(crownH * 0.95, 1.15).add(new THREE.Vector3(0, 0.02, 0)), c(crownH * 0.95, 1.15).add(new THREE.Vector3(0, 0.12, 0))]);
    mesh(new THREE.TubeGeometry(curve, 32, 0.014, 10, false), M.snorkel, bell);
    const tip = curve.getPointAt(1);
    mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.03, 12), M.snorkelTip, bell, tip.x, tip.y, tip.z);
    const clip = c(fy, 1.0);
    mesh(new THREE.SphereGeometry(0.016, 10, 8), M.snorkel, bell, clip.x, clip.y, clip.z);
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
    // --- the shop's (cosmetics.js PRICES): household bits at jelly scale. Each rests where the bell
    // is as wide as it is (seat), so it sits on any species' bell, tall or flat
    case 'bottlecap': {
      // a crown bottle cap, crimped skirt in steel, its top painted in the hat color
      const r = 0.14, cap = new THREE.Group();
      cap.position.y = seat(r * 0.9) - 0.012;
      cap.rotation.set(0.1, 0, -0.16);
      top.add(cap);
      const skirt = new THREE.CylinderGeometry(r, r * 1.08, 0.05, 84, 2, true).translate(0, 0.025, 0);
      { const p = skirt.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(z, x), k = 1 + 0.07 * Math.max(0, Math.cos(a * 21)) * (1 - y / 0.05);
          p.setX(i, x * k); p.setZ(i, z * k);
        }
        skirt.computeVertexNormals(); }
      mesh(skirt, M.silver, cap).material.side = THREE.DoubleSide;
      mesh(new THREE.CylinderGeometry(r * 0.97, r, 0.012, 48), M.top, cap, 0, 0.054, 0);
      mesh(new THREE.TorusGeometry(r * 0.97, 0.007, 6, 48), M.silver, cap, 0, 0.056, 0).rotation.x = Math.PI / 2;
      mesh(new THREE.TorusGeometry(r * 0.62, 0.006, 6, 40), M.white, cap, 0, 0.061, 0).rotation.x = Math.PI / 2;
      const logo = mesh(new THREE.ShapeGeometry(starShape(r * 0.32, r * 0.14)), M.white, cap, 0, 0.0605, 0);
      logo.rotation.x = -Math.PI / 2;
      break;
    }
    case 'thimble': {
      // a silver thimble worn as a knight's helm, dimpled all over, a rolled rim at the bottom
      const r = 0.13, h = 0.2, pts = [[r * 1.05, 0], [r * 1.12, 0.008], [r * 1.12, 0.022], [r * 1.02, 0.03], [r, 0.04], [r * 0.95, 0.12], [r * 0.86, 0.16], [r * 0.68, 0.188], [r * 0.38, 0.2], [0.001, h]];
      const helm = mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 48), M.thimble, top, 0, seat(r * 0.95) - 0.03, 0);
      helm.rotation.z = -0.1;
      break;
    }
    case 'paperboat': {
      // a paper boat folded from a sheet in the hat color, worn crosswise like a bicorne
      const L = 0.2, Lb = 0.12, H = 0.075, D = 0.04, S = 0.2, v = [];
      const tri = (a, b, c) => v.push(...a, ...b, ...c);
      for (const s of [-1, 1]) {
        const tl = [-L, H, s * D], tr = [L, H, s * D], bl = [-Lb, 0, 0], br = [Lb, 0, 0];
        tri(bl, br, tr); tri(bl, tr, tl);                                   // a side of the hull
        tri([-L * 0.62, H, s * D * 0.9], [L * 0.62, H, s * D * 0.9], [0, S, s * 0.004]);   // the sail, folded up from it
      }
      for (const e of [-1, 1]) tri([e * L, H, D], [e * L, H, -D], [e * Lb, 0, 0]);   // the ends
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      g.computeVertexNormals();
      const boat = mesh(g, M.origami, top, 0, seat(0.05) - 0.01, 0);
      boat.rotation.y = 0.15;
      wobblers.push([boat, 'z', 0.4, 0.06]);
      break;
    }
    case 'stickynote': {
      // a sticky note slapped on the brow, a corner curling up, a doodled heart on it
      const n = 0.19, g = new THREE.PlaneGeometry(n, n, 10, 10), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), c = Math.max(0, (x - y) / n - 0.35);
        p.setZ(i, c * c * 0.12 + Math.max(0, -y / n + 0.2) * 0.0);
      }
      g.computeVertexNormals();
      const yb = seat(0.09), r = bellR(yb + toTop);
      const note = mesh(g, M.note, top, 0.02, yb + 0.045, r * 0.4);
      note.rotation.set(-0.95, 0.1, 0.18);
      break;
    }
    case 'showercap': {
      // a puffy shower cap in the hat color, white polka dots, gathered into a frilly elastic round the
      // crown above the eyes; it pulses with the bell
      const yb = Math.max(faceTop + 0.004, crownH - 0.13), rb = bellR(yb) * 1.04 + 0.006, peak = Math.max(crownH, yolk ? yolk.y + yolk.h : 0) + 0.07 - yb;
      const prof = Array.from({ length: 15 }, (_, i) => { const a = (i / 14) * Math.PI / 2; return new THREE.Vector2(i === 14 ? 0.001 : rb * (1.08 + 0.06 * Math.sin(a * 2)) * Math.cos(a), 0.012 + peak * Math.sin(a)); });
      const cap = new THREE.LatheGeometry(prof, 64), p = cap.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.03 * Math.sin(a * 14) * Math.min(1, Math.hypot(x, z) * 6); p.setX(i, x * k); p.setZ(i, z * k); }
      cap.computeVertexNormals();
      const y0 = yb - toTop;
      mesh(cap, M.showercap, top, 0, y0, 0);
      const frill = new THREE.CylinderGeometry(rb * 1.12, rb, 0.03, 120, 1, true), q = frill.attributes.position;
      for (let i = 0; i < q.count; i++) { const x = q.getX(i), z = q.getZ(i), a = Math.atan2(z, x), y = q.getY(i), k = y < 0 ? 1 : 1 + 0.05 * Math.sin(a * 36); q.setX(i, x * k); q.setZ(i, z * k); }
      frill.computeVertexNormals();
      mesh(frill, M.showercap, top, 0, y0 + 0.012, 0);
      soft = true;
      break;
    }
    case 'shell': {
      // a hermit's turret shell, whorl on whorl narrowing to a point, banded in brown, a pink lip
      // round its mouth; worn lying back on the crown, the mouth to the front
      const H = 0.25, base = 0.09, whorls = 5, prof = [new THREE.Vector2(0.001, -0.01)];
      for (let i = 0; i <= 80; i++) {
        const u = i / 80, w = (u * whorls) % 1;
        prof.push(new THREE.Vector2(Math.max(0.002, base * (1 - u) ** 0.85 * (0.74 + 0.26 * Math.sin(w * Math.PI))), u * H));
      }
      const sh = new THREE.Group();
      sh.position.set(0.01, seat(0.07) + 0.04, 0.0);
      sh.rotation.set(-1.0, 0, -0.45);
      top.add(sh);
      mesh(new THREE.LatheGeometry(prof, 40), M.shell, sh);
      const lip = mesh(new THREE.TorusGeometry(0.07, 0.014, 10, 32), M.shellLip, sh, 0, -0.004, 0.01);
      lip.rotation.x = Math.PI / 2; lip.scale.set(1, 1.2, 1);
      break;
    }
    case 'starfish': {
      // a starfish in the hat color draped over the crown, its arms following the bell down, bumps along each
      const star = new THREE.Shape(), ro = 0.15, ri = 0.055;
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? ri : ro;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (!i) star.moveTo(x, y);
        else if (i % 2) star.quadraticCurveTo(Math.cos(a - Math.PI / 10) * (ro + ri) * 0.45, Math.sin(a - Math.PI / 10) * (ro + ri) * 0.45, x, y);
        else star.quadraticCurveTo(Math.cos(a - Math.PI / 10) * (ro + ri) * 0.45, Math.sin(a - Math.PI / 10) * (ro + ri) * 0.45, x, y);
      }
      const g = new THREE.ExtrudeGeometry(star, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.014, bevelSegments: 3, curveSegments: 6 }).rotateX(-Math.PI / 2);
      const bumps = [];
      for (let i = 0; i < 5; i++) for (let j = 1; j < 5; j++) {
        const a = Math.PI / 2 + (i * 2 * Math.PI) / 5, r = j * 0.03;
        bumps.push(new THREE.SphereGeometry(0.009 - j * 0.0012, 8, 6).translate(Math.cos(a) * r, 0.028, -Math.sin(a) * r));
      }
      bumps.push(new THREE.SphereGeometry(0.011, 8, 6).translate(0, 0.028, 0));
      const b = mergeGeometries(bumps);
      for (const geo of [g, b]) drape(geo, 0.004);
      const sf = new THREE.Group();
      sf.rotation.y = 0.3;
      top.add(sf);
      mesh(g, M.top, sf);
      mesh(b, M.coralTip, sf);
      break;
    }
    case 'sock': {
      // an odd sock pulled on like a cap: a ribbed cuff round the crown, the leg flopped over to the
      // side, the heel at the bend and the toe hanging down
      const rc = 0.105, yc = seat(rc) + 0.005, c = (x, y, z) => new THREE.Vector3(x, y, z);
      const cuff = new THREE.CylinderGeometry(rc + 0.008, rc + 0.012, 0.045, 64, 1, true), q = cuff.attributes.position;
      for (let i = 0; i < q.count; i++) { const x = q.getX(i), z = q.getZ(i), k = 1 + 0.03 * Math.cos(Math.atan2(z, x) * 32); q.setX(i, x * k); q.setZ(i, z * k); }
      cuff.computeVertexNormals();
      mesh(cuff, M.sockCuff, top, 0, yc + 0.02, 0);
      const path = new THREE.CatmullRomCurve3([c(0, yc + 0.03, 0), c(0, yc + 0.1, 0), c(-0.035, yc + 0.15, 0.005), c(-0.1, yc + 0.155, 0.01), c(-0.145, yc + 0.1, 0.02), c(-0.15, yc + 0.03, 0.035)]);
      const tube = new THREE.TubeGeometry(path, 60, 0.042, 20, false);
      mesh(tube, M.sock, top);
      { const p = tube.attributes.position, uv = tube.attributes.uv;   // wide at the cuff, the leg narrowing to the foot
        for (let i = 0; i < p.count; i++) { const u = Math.min(1, uv.getX(i)), pt = path.getPointAt(u), k = u < 0.3 ? 1 + ((0.3 - u) / 0.3) ** 1.5 * (rc / 0.042 - 1) : 1 - Math.max(0, u - 0.7) * 0.4; p.setXYZ(i, pt.x + (p.getX(i) - pt.x) * k, pt.y + (p.getY(i) - pt.y) * k, pt.z + (p.getZ(i) - pt.z) * k); }
        tube.computeVertexNormals(); }
      const toe = path.getPointAt(1);
      mesh(new THREE.SphereGeometry(0.037, 16, 12), M.sockToe, top, toe.x, toe.y, toe.z).scale.set(1, 0.8, 1);
      const heel = path.getPointAt(0.62);
      mesh(new THREE.SphereGeometry(0.036, 14, 10), M.sockToe, top, heel.x - 0.006, heel.y + 0.014, heel.z - 0.004);
      soft = true;
      break;
    }
    case 'lampshade': {
      // the party classic: a pleated lampshade in the hat color, gold trims, a fringe of gold bobbles
      const rb = 0.19, rt = 0.1, h = 0.17, g = new THREE.CylinderGeometry(rt, rb, h, 96, 1, true), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.035 * Math.abs(Math.sin(a * 18)); p.setX(i, x * k); p.setZ(i, z * k); }
      g.computeVertexNormals();
      const shade = new THREE.Group();
      shade.position.y = Math.max(seat(rb * 0.85) + h / 2 - 0.02, faceTop - toTop + h / 2 + 0.035);   // clear of the eyes
      shade.rotation.z = -0.22;
      top.add(shade);
      mesh(g, M.fabric, shade);
      for (const [y, r] of [[h / 2, rt * 1.03], [-h / 2, rb * 1.03]]) mesh(new THREE.TorusGeometry(r, 0.008, 6, 64), M.gold, shade, 0, y, 0).rotation.x = Math.PI / 2;
      const bob = [];
      for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; bob.push(new THREE.SphereGeometry(0.011, 8, 6).translate(Math.cos(a) * rb * 1.04, -h / 2 - 0.022, Math.sin(a) * rb * 1.04), new THREE.CylinderGeometry(0.002, 0.002, 0.018, 4).translate(Math.cos(a) * rb * 1.04, -h / 2 - 0.01, Math.sin(a) * rb * 1.04)); }
      mesh(mergeGeometries(bob), M.gold, shade);
      break;
    }
    case 'fishbowl': {
      // a little round fishbowl balanced on top: pebbles, water, and a goldfish swimming laps
      const r = 0.12, bowl = new THREE.Group();
      bowl.position.y = seat(0.05) - 0.01 + r * Math.cos(0.42);
      top.add(bowl);
      const water = mesh(new THREE.SphereGeometry(r * 0.95, 32, 16, 0, Math.PI * 2, 1.05, Math.PI - 1.05 - 0.42), M.water, bowl);
      water.renderOrder = 4;
      const surface = mesh(new THREE.CircleGeometry(r * 0.95 * Math.sin(1.05), 32), M.water, bowl, 0, r * 0.95 * Math.cos(1.05), 0);
      surface.rotation.x = -Math.PI / 2; surface.renderOrder = 4;
      const pebbles = [], rnd = rng(7);
      for (let i = 0; i < 14; i++) { const a = rnd() * Math.PI * 2, d = rnd() * r * 0.42; pebbles.push(new THREE.SphereGeometry(0.012 + rnd() * 0.008, 8, 6).scale(1, 0.6, 1).translate(Math.cos(a) * d, -r * Math.cos(0.42) + 0.012, Math.sin(a) * d)); }
      mesh(mergeGeometries(pebbles), M.pebble, bowl);
      const swim = new THREE.Group();
      bowl.add(swim);
      spinners.push([swim, 'y', -1.3]);
      const fish = new THREE.Group();
      fish.position.set(r * 0.42, -0.01, 0);
      swim.add(fish);
      mesh(new THREE.SphereGeometry(0.026, 16, 10), M.fish, fish).scale.set(0.7, 0.85, 1.3);
      const tail = new THREE.Group();
      tail.position.z = -0.03;
      fish.add(tail);
      const fin = mesh(new THREE.ConeGeometry(0.022, 0.035, 3), M.fish, tail, 0, 0, -0.012);
      fin.rotation.x = Math.PI / 2; fin.scale.x = 0.3;
      wobblers.push([tail, 'y', 0, 0.5]);
      for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.005, 6, 4), M.black, fish, s * 0.016, 0.006, 0.022);
      const glass = mesh(new THREE.SphereGeometry(r, 40, 20, 0, Math.PI * 2, 0.62, Math.PI - 0.62 - 0.42), M.glass, bowl);
      glass.renderOrder = 5;
      const lip = mesh(new THREE.TorusGeometry(r * Math.sin(0.62), 0.006, 8, 40), M.glass, bowl, 0, r * Math.cos(0.62), 0);
      lip.rotation.x = Math.PI / 2; lip.renderOrder = 5;
      break;
    }
    case 'coral': {
      // a crown of branching pink coral on a band, pale glowing tips
      const rc = 0.14, y0 = seat(rc), branch = [], tips = [];
      branch.push(new THREE.TorusGeometry(rc, 0.016, 8, 40).rotateX(Math.PI / 2).translate(0, y0, 0));
      const limb = (a, b, r0, r1) => {
        const d = new THREE.Vector3().subVectors(b, a), len = d.length();
        const g = new THREE.CylinderGeometry(r1, r0, len, 8).translate(0, len / 2, 0);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())).translate(a.x, a.y, a.z);
        branch.push(g);
        tips.push(new THREE.SphereGeometry(r1 * 1.5, 8, 6).translate(b.x, b.y, b.z));
      };
      const rnd = rng(11);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2, out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        const base = out.clone().multiplyScalar(rc).setY(y0), tall = 0.09 + rnd() * 0.06;
        const mid = base.clone().addScaledVector(out, 0.02).setY(y0 + tall * 0.55);
        const tipA = mid.clone().addScaledVector(out, 0.035).add(new THREE.Vector3(0, tall * 0.5, 0)).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.0);
        const side = new THREE.Vector3(-out.z, 0, out.x).multiplyScalar(0.03 * (i % 2 ? 1 : -1));
        limb(base, mid, 0.014, 0.011);
        limb(mid, tipA, 0.011, 0.007);
        limb(mid, mid.clone().add(side).add(new THREE.Vector3(0, tall * 0.35, 0)).addScaledVector(out, 0.015), 0.009, 0.006);
      }
      mesh(mergeGeometries(branch), M.coral, top);
      mesh(mergeGeometries(tips), M.coralTip, top);
      break;
    }
    // --- earned (cosmetics.js NEEDS): polished gold that glows a little
    case 'earmuffs': {
      // the Vacuum's: two fluffy dust bunnies on a gold band over the bell, gold caps behind them
      const yb = crownH * 0.55, ys = yb - (shape.topY - BELL_Y), rs = bellR(yb);
      band(rs + 0.012, ys, 0.012, M.award);
      for (const s of [-1, 1]) {
        const cup = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.016, 24), M.award, top, s * (rs + 0.012), ys, 0);
        cup.rotation.z = Math.PI / 2;
        // a dust bunny: a soft grey puff, tufted, with two little eyes looking forward
        const fluff = new THREE.IcosahedronGeometry(0.07, 5), p = fluff.attributes.position, v = new THREE.Vector3();
        for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + 0.1 * Math.sin(v.x * 140 + s) * Math.sin(v.y * 130) * Math.sin(v.z * 150); p.setXYZ(i, v.x * k, v.y * k, v.z * k); }
        fluff.computeVertexNormals();
        const muff = new THREE.Group();
        muff.position.set(s * (rs + 0.055), ys, 0);
        top.add(muff);
        mesh(fluff, M.fluff, muff).scale.set(0.7, 1, 1);
        for (const e of [-1, 1]) mesh(new THREE.SphereGeometry(0.009, 8, 6), M.black, muff, e * 0.016, 0.012, 0.066);
        wobblers.push([muff, 'z', s, 0.06]);
      }
      break;
    }
    case 'duck': {
      // the Clog's: a golden rubber duck riding on top, amber beak, bobbing along
      const d = new THREE.Group();
      d.position.y = seat(0.08) + 0.045;
      d.scale.setScalar(1.3);
      top.add(d);
      mesh(new THREE.SphereGeometry(0.075, 24, 16), M.award, d).scale.set(1, 0.72, 1.25);
      const tail = mesh(new THREE.ConeGeometry(0.035, 0.07, 12), M.award, d, 0, 0.035, -0.085);
      tail.rotation.x = -1.0;
      mesh(new THREE.SphereGeometry(0.052, 20, 14), M.award, d, 0, 0.075, 0.055);
      const beak = mesh(new THREE.SphereGeometry(0.026, 14, 10), M.amber, d, 0, 0.065, 0.105);
      beak.scale.set(1.2, 0.45, 1.1);
      for (const s of [-1, 1]) {
        mesh(new THREE.SphereGeometry(0.009, 8, 6), M.black, d, s * 0.026, 0.09, 0.093);
        const wing = mesh(new THREE.SphereGeometry(0.04, 14, 10), M.award, d, s * 0.06, 0.012, -0.01);
        wing.scale.set(0.35, 0.6, 1);
      }
      wobblers.push([d, 'z', 0, 0.12], [d, 'x', 1.4, 0.06]);
      break;
    }
    case 'sharkfin': {
      // the Great White One's: a golden dorsal fin, swept back, standing fore and aft
      const f = new THREE.Shape();
      f.moveTo(-0.08, 0); f.quadraticCurveTo(-0.03, 0.06, -0.005, 0.2); f.quadraticCurveTo(0.03, 0.09, 0.08, 0); f.lineTo(-0.08, 0);
      const g = new THREE.ExtrudeGeometry(f, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 3, curveSegments: 12 }).translate(0, 0, -0.008);
      const fin = mesh(g, M.award, top, 0, seat(0.06) - 0.03, 0);
      fin.rotation.y = Math.PI / 2 - 0.6;     // the leading edge forward, turned a little so its shape shows from in front and behind
      break;
    }
    case 'headset': {
      // the Encore's: a gold stage headset, cushioned cups, a mic on a boom swung round to the mouth
      const yb = crownH * 0.6, ys = yb - (shape.topY - BELL_Y), rs = bellR(yb);
      band(rs + 0.01, ys, 0.011, M.award);
      for (const s of [-1, 1]) {
        const cup = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 24), M.award, top, s * (rs + 0.022), ys, 0);
        cup.rotation.z = Math.PI / 2;
        const pad = mesh(new THREE.TorusGeometry(0.038, 0.01, 8, 24), M.black, top, s * (rs + 0.006), ys, 0);
        pad.rotation.y = Math.PI / 2;
      }
      // the mouth, from where the face ended up on the bell
      const my = face.position.y + mouthY * face.scale.y + 0.01, mz = bellR(my) + 0.025, myTop = my - (shape.topY - BELL_Y);
      const c = (x, y, z) => new THREE.Vector3(x, y, z);
      const mx = look.mouth === 'bubblegum' ? -0.11 : -0.06;   // beside a bubble, not in it
      const boom = new THREE.CatmullRomCurve3([c(-(rs + 0.035), ys, 0), c(-(rs + 0.03), (ys + myTop) / 2, mz * 0.6), c(mx, myTop, mz)]);
      mesh(new THREE.TubeGeometry(boom, 24, 0.006, 8, false), M.award, top);
      mesh(new THREE.SphereGeometry(0.018, 14, 10), M.black, top, mx + 0.01, myTop, mz + 0.004);
      break;
    }
    case 'goldbook': {
      // for a full Treasure book: an open golden book floating over the bell, turning slowly, a ruby ribbon
      const b = new THREE.Group();
      b.position.y = Math.max(0.12, seat(0.02) + 0.13);
      b.scale.setScalar(1.6);
      top.add(b);
      spinners.push([b, 'y', 0.6]);
      floaters.push([b, b.position.y, 0.012]);
      for (const s of [-1, 1]) {
        const half = new THREE.Group();
        half.rotation.z = s * 0.32;
        b.add(half);
        mesh(new THREE.BoxGeometry(0.1, 0.006, 0.14), M.award, half, s * 0.05, 0, 0);
        const pages = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 16, 1, false, 0, Math.PI), M.white, half, s * 0.048, 0.004, 0);
        pages.rotation.set(Math.PI / 2, 0, s < 0 ? 0 : Math.PI); pages.scale.set(1, 1, 0.18);
      }
      mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 8), M.award, b, 0, -0.002, 0).rotation.x = Math.PI / 2;
      const ribbon = mesh(new THREE.PlaneGeometry(0.012, 0.04), M.ruby, b, 0.004, -0.018, 0.072);
      ribbon.material.side = THREE.DoubleSide;
      break;
    }
    case 'goldkettle': {
      // for 10 Kettles: a little golden kettle on top, a ruby knob, puffs of steam from the spout
      const k = new THREE.Group();
      k.position.y = seat(0.075) - 0.012;
      k.scale.setScalar(1.25);
      top.add(k);
      const body = [[0.001, 0], [0.065, 0], [0.078, 0.02], [0.078, 0.045], [0.066, 0.075], [0.045, 0.09], [0.02, 0.095], [0.001, 0.095]];
      mesh(new THREE.LatheGeometry(body.map(([x, y]) => new THREE.Vector2(x, y)), 32), M.award, k);
      mesh(new THREE.SphereGeometry(0.012, 10, 8), M.ruby, k, 0, 0.105, 0);
      const c = (x, y, z) => new THREE.Vector3(x, y, z);
      const spout = new THREE.CatmullRomCurve3([c(0, 0.03, 0.06), c(0, 0.05, 0.1), c(0, 0.08, 0.125)]);
      const sg = new THREE.TubeGeometry(spout, 12, 0.012, 10, false), sp2 = sg.attributes.position, su = sg.attributes.uv;
      for (let i = 0; i < sp2.count; i++) { const pt = spout.getPointAt(Math.min(1, su.getX(i))), t = 1.4 - su.getX(i) * 0.7; sp2.setXYZ(i, pt.x + (sp2.getX(i) - pt.x) * t, pt.y + (sp2.getY(i) - pt.y) * t, pt.z + (sp2.getZ(i) - pt.z) * t); }
      sg.computeVertexNormals();
      mesh(sg, M.award, k);
      const handle = mesh(new THREE.TorusGeometry(0.05, 0.007, 8, 24, Math.PI), M.award, k, 0, 0.09, 0);
      handle.rotation.y = Math.PI / 2;
      for (let i = 0; i < 3; i++) {
        const puff = mesh(new THREE.SphereGeometry(0.014, 10, 8), M.steam, k, 0, 0.09, 0.13);
        steam.push([puff, i / 3, k]);
      }
      break;
    }
    case 'tiara': {
      // for a boss beaten without losing Health: a diamond tiara across the front of the bell
      const yb = seat(0.13) + (shape.topY - BELL_Y) - 0.02, r = bellR(yb) + 0.008, y = yb - (shape.topY - BELL_Y);
      const arc = new THREE.CatmullRomCurve3(Array.from({ length: 13 }, (_, i) => { const a = -1.9 + (i / 12) * 3.8; return new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r); }));
      mesh(new THREE.TubeGeometry(arc, 48, 0.008, 8, false), M.award, top);
      for (let i = -3; i <= 3; i++) {
        const a = i * 0.36, h = 0.075 - Math.abs(i) * 0.016, x = Math.sin(a) * r, z = Math.cos(a) * r;
        const peak = new THREE.CatmullRomCurve3([new THREE.Vector3(x - Math.cos(a) * 0.02, y, z + Math.sin(a) * 0.02), new THREE.Vector3(x, y + h, z + 0.004), new THREE.Vector3(x + Math.cos(a) * 0.02, y, z - Math.sin(a) * 0.02)]);
        mesh(new THREE.TubeGeometry(peak, 12, 0.0045, 6, false), M.award, top);
        const gem = mesh(new THREE.OctahedronGeometry(i ? 0.012 : 0.022), M.diamond, top, x, y + h + (i ? 0.012 : 0.02), z + 0.004);
        gem.scale.y = 1.4;
        spinners.push([gem, 'y', 1.2 + Math.abs(i) * 0.3]);
        if (i) mesh(new THREE.OctahedronGeometry(0.007), M.diamond, top, x, y + 0.012, z + 0.006);
      }
      break;
    }
    case 'crown_nettle': case 'crown_moon': case 'crown_lion': case 'crown_box': case 'crown_crystal': case 'crown_egg': {
      // for winning as each species: a gold crown made in that jelly's image
      const kind = look.top.slice(6), rc = 0.14, y0 = seat(rc) - 0.01, out = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
      if (kind === 'box') {
        // a square crown, battlements along each wall, a sapphire on each corner post
        const w = rc * 1.6;
        for (let i = 0; i < 4; i++) {
          const wall = new THREE.Group();
          wall.rotation.y = (i * Math.PI) / 2;
          top.add(wall);
          mesh(new THREE.BoxGeometry(w, 0.05, 0.01), M.award, wall, 0, y0 + 0.025, w / 2);
          for (let j = -1; j <= 1; j++) mesh(new THREE.BoxGeometry(0.03, 0.025, 0.012), M.award, wall, j * w * 0.3, y0 + 0.062, w / 2);
          const [x, z] = out(Math.PI / 4 + (i * Math.PI) / 2, w * Math.SQRT1_2);
          mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.08, 10), M.award, top, x, y0 + 0.04, z);
          mesh(new THREE.SphereGeometry(0.014, 10, 8), M.sapphire, top, x, y0 + 0.088, z);
        }
        break;
      }
      const ring = mesh(new THREE.CylinderGeometry(rc * 1.02, rc, 0.045, 40, 1, true), M.award, top, 0, y0 + 0.022, 0);
      ring.material.side = THREE.DoubleSide;
      mesh(new THREE.TorusGeometry(rc, 0.009, 8, 40), M.award, top, 0, y0, 0).rotation.x = Math.PI / 2;
      if (kind === 'nettle') {
        // seven tall curling points, like a nettle's tentacles, pearls at their tips
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2, [x, z] = out(a, rc), [ox, oz] = out(a, 1), c = (dx, y, dz) => new THREE.Vector3(x + ox * dx, y, z + oz * dz);
          const curl = new THREE.CatmullRomCurve3([c(0, y0 + 0.04, 0), c(0.012, y0 + 0.09, 0.012), c(-0.008, y0 + 0.13, -0.008), c(0.02, y0 + 0.16, 0.02)]);
          taper(new THREE.TubeGeometry(curl, 16, 0.012, 6, false), curl, 1, 0.35, M.award);
          const tip = curl.getPointAt(1);
          mesh(new THREE.SphereGeometry(0.011, 10, 8), M.white, top, tip.x, tip.y, tip.z);
        }
      } else if (kind === 'moon') {
        // four gold rings stood round the band, a glowing moonstone in each
        for (let i = 0; i < 4; i++) {
          const a = Math.PI / 4 + (i / 4) * Math.PI * 2 + Math.PI / 4, [x, z] = out(a, rc * 1.02);
          const loop = mesh(new THREE.TorusGeometry(0.035, 0.008, 8, 24), M.award, top, x, y0 + 0.08, z);
          loop.rotation.y = -a + Math.PI / 2;
          mesh(new THREE.SphereGeometry(0.018, 12, 10), M.moonstone, top, x, y0 + 0.08, z);
        }
        for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4 + Math.PI / 4 + Math.PI / 4, [x, z] = out(a, rc * 1.03); mesh(new THREE.SphereGeometry(0.009, 8, 6), M.moonstone, top, x, y0 + 0.022, z); }
      } else if (kind === 'lion') {
        // a sunburst mane of golden rays, long and short, amber stones round the band
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2, long = i % 2 === 0, len = long ? 0.11 : 0.07, [x, z] = out(a, rc);
          const ray = mesh(new THREE.ConeGeometry(0.014, len, 6), M.award, top, x * 1.06, y0 + 0.04 + len * 0.4, z * 1.06);
          ray.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
          if (long) mesh(new THREE.SphereGeometry(0.01, 8, 6), M.amber, top, x * 1.04, y0 + 0.022, z * 1.04);
        }
      } else if (kind === 'crystal') {
        // clear crystal spires of different heights rising from a gold band
        const rnd = rng(5);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2, [x, z] = out(a, rc * 0.92), h = 0.07 + rnd() * 0.07;
          const spire = mesh(new THREE.OctahedronGeometry(0.03), M.ice, top, x, y0 + 0.04 + h * 0.45, z);
          spire.scale.set(0.55, h / 0.05, 0.55);
          spire.rotation.y = a;
        }
      } else if (kind === 'egg') {
        // white enamel scallops round the top, like the white of an egg, and a big amber yolk at the front
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2, [x, z] = out(a, rc * 1.03);
          const sc = mesh(new THREE.CircleGeometry(0.034, 16, 0, Math.PI), M.enamel, top, x, y0 + 0.042, z);
          sc.rotation.y = Math.PI / 2 - a;
        }
        mesh(new THREE.SphereGeometry(0.03, 20, 14), M.amber, top, 0, y0 + 0.035, rc * 1.06).scale.z = 0.5;
        for (const s of [-1, 1]) { const [x, z] = out(Math.PI / 2 + s * 0.9, rc * 1.04); mesh(new THREE.SphereGeometry(0.014, 12, 8), M.amber, top, x, y0 + 0.025, z).scale.z = 0.6; }
      }
      break;
    }
  }

  // A hat of many parts is drawn as one mesh per material: every part that doesn't move on its own
  // (or sit on something that does) is baked into the top's frame and merged
  {
    const moving = new Set([...wobblers.map(([o]) => o), ...spinners.map(([o]) => o), ...floaters.map(([o]) => o), ...steam.map(([o]) => o)]);
    const still = (o) => { for (let q = o; q && q !== top; q = q.parent) if (moving.has(q)) return false; return true; };
    const byMat = new Map();
    top.updateMatrixWorld(true);
    const inv = top.matrixWorld.clone().invert();
    top.traverse((o) => { if (o.isMesh && still(o)) (byMat.get(o.material) || byMat.set(o.material, []).get(o.material)).push(o); });
    for (const [mat, list] of byMat) {
      if (list.length < 2) continue;
      const geos = list.map((o) => { const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; });
      const merged = mergeGeometries(geos);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const m = mesh(merged, mat, top);
      m.renderOrder = Math.max(...list.map((o) => o.renderOrder));
      for (const o of list) { o.parent.remove(o); o.geometry.dispose(); }
    }
  }

  // how high the hat reaches, in shares of the jelly's height (adornments.js keeps the halo above it)
  root.updateMatrixWorld(true);
  const hatTop = top.children.length ? new THREE.Box3().setFromObject(top).max.y / (heightMeters * look.size) : 0;

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
      // the hat rides on the crown as the bell squeezes and relaxes (a soft one squeezes with it)
      top.position.y = shape.topY + (bell.position.y - BELL_Y) + crownH * (bell.scale.y - 1);
      if (soft) top.scale.set(bell.scale.x, 1, bell.scale.z);
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
    floaters.forEach(([o, y, amt], i) => { o.position.y = y + Math.sin(t * 1.6 + i) * amt; });
    // steam from the golden kettle: puffs rise from the spout, swelling and thinning out
    steam.forEach(([o, ph]) => { const u = (t * 0.6 + ph) % 1; o.position.set(0, 0.09 + u * 0.1, 0.13 + u * 0.03); o.scale.setScalar(0.4 + u * 1.4 - (u > 0.8 ? (u - 0.8) * 7 : 0)); });
    // heart eyes beat; star eyes twinkle
    twinkle.forEach(([o, x]) => { const b = look.eyes === 'hearts' ? 1 + 0.08 * Math.max(0, Math.sin(t * 7)) ** 8 : 1 + 0.06 * Math.sin(t * 3 + x * 20); o.scale.set(b, b, 1); });
    // googly pupils: loose, they lag behind the jelly's moves and fall back to the bottom
    for (const G of googly) {
      const ax = -localVel.x * 0.4, ay = -1 - (s.vy || 0) * 0.5;
      G.vx += (ax * G.R - G.x * 30) * dt - G.vx * 4 * dt; G.vy += (ay * G.R * 3 - G.y * 10) * dt - G.vy * 4 * dt;
      G.x += G.vx * dt * 6; G.y += G.vy * dt * 6;
      const d = Math.hypot(G.x, G.y), lim = G.R * 0.45;
      if (d > lim) { G.x *= lim / d; G.y *= lim / d; G.vx *= -0.3; G.vy *= -0.3; }
      G.pupil.position.x = G.x; G.pupil.position.y = G.y;
    }
    // bubble gum: blown up slowly, held a moment, then it pops and starts again
    if (gum) { const u = (t / 4) % 1; gum.scale.setScalar(u < 0.75 ? 0.15 + u * 1.1 : u < 0.8 ? 1 : 0.001); }
    wobblers.forEach(([o, ax, ph, amt], i) => {
      const drive = 0.3 + move * 0.7 + (s.grounded ? 0 : 0.6);
      o.rotation[ax] = baseRot[i] + Math.sin(t * 6 + ph) * amt * drive - (ax === 'x' ? move * amt : 0);
    });

    blinkIn -= dt;
    const closing = blinkIn < 0 && blinkIn > -0.12;
    if (blinkIn < -0.12) blinkIn = 2 + Math.random() * 3.5;
    const eyeHeight = closing && blinks ? 0.12 : 1;
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
    root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.map?.dispose(); o.material.bumpMap?.dispose(); o.material.dispose(); } });
    Object.values(M).forEach((m) => { if (!m) return; m.map?.dispose(); m.bumpMap?.dispose(); m.dispose(); });
  }

  return { root, update, land, takeoff, pulse, dispose, look, tentacles: rig, squash, hatTop };
}
