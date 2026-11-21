// The pick screen's elements round each jelly (pick-screen.js): the cards show the player's own jelly
// as it is, and its type's element moves round it (flames licking up, snow drifting, arcs crackling…),
// so every card reads as its type at a glance and nothing is drawn inside the jelly. A few marks a
// frame on a small 2D canvas over the card's portrait, added on (lighter), so they glow on the deep
// water and only the edges of the jelly. aura= in content/jellies.kdl names the kind; the colour is the
// type's own (--type-<id> in look.css). Each kind is a pure function of time: nothing to keep, nothing
// allocated past the gradients.
//
//   aura(ctx, S, t, colour, a)   S: the canvas's size in pixels, t: seconds, a: strength (0-1)
//
// A kind with a shader (SHADERS below, src/pick-auras/<kind>.js) is drawn by AuraPainter (pick-auras/painter.js) instead: the
// whole card picture (water, the jelly relit, the element behind and in front of it) in one full-card
// shader by the game's renderer, then copied onto the card's canvas. The 2D kinds are going one by one.
//
// How to add a shader kind (the type tasks):
//   1. src/pick-auras/<kind>.js exports PAINT (GLSL with `vec3 paint(vec2 uv)`: the card's colour at
//      uv, linear, before tone mapping; kit.js lists what it can call), RAMP (its look.css colour ramp,
//      four colours hot to deep) and RAMP_FALLBACK.
//   2. Import it into SHADERS here, and delete its 2D function from AURAS.
//   3. Its numbers and colours go in content/look.css (--aura-<kind>-*); shoot it with
//      node tools/pick-shots.mjs --only=<type> and compare against the plan's row.

import * as bubbles from './pick-auras/bubbles.js';
import * as flames from './pick-auras/flames.js';
import * as frost from './pick-auras/frost.js';
import * as sparks from './pick-auras/sparks.js';
import * as gust from './pick-auras/gust.js';
import * as sting from './pick-auras/sting.js';
import * as toxic from './pick-auras/toxic.js';

export const SHADERS = { flames, sparks, frost, gust, bubbles, toxic, sting };

const TAU = Math.PI * 2;
const fract = (x) => x - Math.floor(x);
const rnd = (i, k = 0) => fract(Math.sin(i * 127.1 + k * 311.7) * 43758.5453);   // a fixed 0-1 number per mark
// where the jelly is in the portrait (jelly-portrait.js frames it close): the marks go round this oval
const CX = 0.5, CY = 0.5, RX = 0.4, RY = 0.43;
const ring = (S, angle, out = 1) => [S * (CX + RX * out * Math.cos(angle)), S * (CY + RY * out * Math.sin(angle))];

// '#ff8a3d' -> 'rgba(255,138,61,a)'
function rgba(hex, a) {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

// a soft glow in a band round the jelly, clear in the middle
function halo(ctx, S, col, a) {
  const g = ctx.createRadialGradient(S * CX, S * CY, S * 0.28, S * CX, S * CY, S * 0.72);
  g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.45, rgba(col, 0.32 * a)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
}

function dot(ctx, x, y, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }

// a mark that rises up one side of the jelly: [x, y, life 0-1]
function riser(S, i, t, speed) {
  const life = fract(t * speed * (0.8 + 0.4 * rnd(i, 1)) + rnd(i, 2));
  const side = i % 2 ? 1 : -1, spread = 0.06 + 0.2 * rnd(i, 3);
  return [S * (0.5 + side * (0.5 - spread) + Math.sin(t * 2 + i) * 0.01), S * (1.02 - life * (0.7 + 0.25 * rnd(i, 4))), life];
}

export const AURAS = {
  // Glitter: rainbow stars winking on and off round the jelly
  glitter(ctx, S, t, col, a) {
    halo(ctx, S, col, a * 0.55);
    for (let i = 0; i < 22; i++) {
      const wink = Math.max(0, Math.sin(t * (2.4 + rnd(i, 1)) + i * 1.9));
      if (!wink) continue;
      const [x, y] = ring(S, TAU * rnd(i, 2), 0.88 + 0.3 * rnd(i, 3)), r = S * (0.03 + 0.045 * rnd(i, 4)) * wink;
      ctx.fillStyle = `hsla(${(i * 47 + t * 60) % 360},100%,78%,${(0.95 * wink * a).toFixed(3)})`;
      ctx.beginPath();   // a four-point star
      for (let k = 0; k < 8; k++) { const q = k * Math.PI / 4, d = k % 2 ? r * 0.22 : r; ctx.lineTo(x + Math.cos(q) * d, y + Math.sin(q) * d); }
      ctx.closePath(); ctx.fill();
      dot(ctx, x, y, r * 0.18, rgba('#ffffff', wink * a));
    }
  },
};

// draw `kind` onto a canvas (cleared first), its size in pixels; false if there is no such kind
export function drawAura(canvas, kind, t, colour, strength = 1) {
  const fn = AURAS[kind], ctx = canvas.getContext('2d'), S = canvas.width;
  if (!ctx) return false;
  ctx.clearRect(0, 0, S, canvas.height);
  if (!fn || !S) return false;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  fn(ctx, S, t, colour, strength);
  ctx.restore();
  return true;
}

// every kind aura= can name (content/jellies.kdl)
export const KINDS = () => [...Object.keys(SHADERS), ...Object.keys(AURAS)];
