// The pick screen's elements round each jelly (pick-screen.js): the cards show the player's own jelly
// as it is, and its type's element moves round it (flames licking up, snow drifting, arcs crackling…),
// so every card reads as its type at a glance and nothing is drawn inside the jelly. A few marks a
// frame on a small 2D canvas over the card's portrait, added on (lighter), so they glow on the deep
// water and only the edges of the jelly. aura= in content/jellies.kdl names the kind; the colour is the
// type's own (--type-<id> in look.css). Each kind is a pure function of time: nothing to keep, nothing
// allocated past the gradients.
//
//   aura(ctx, S, t, colour, a)   S: the canvas's size in pixels, t: seconds, a: strength (0-1)

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

// light rising off the bottom of the card
function floorGlow(ctx, S, col, a, high = 0.34) {
  const g = ctx.createLinearGradient(0, S, 0, S * (1 - high));
  g.addColorStop(0, rgba(col, 0.55 * a)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.fillRect(0, S * (1 - high), S, S * high);
}

function dot(ctx, x, y, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }

// a mark that rises up one side of the jelly: [x, y, life 0-1]
function riser(S, i, t, speed) {
  const life = fract(t * speed * (0.8 + 0.4 * rnd(i, 1)) + rnd(i, 2));
  const side = i % 2 ? 1 : -1, spread = 0.06 + 0.2 * rnd(i, 3);
  return [S * (0.5 + side * (0.5 - spread) + Math.sin(t * 2 + i) * 0.01), S * (1.02 - life * (0.7 + 0.25 * rnd(i, 4))), life];
}

export const AURAS = {
  // Normal: plain bubbles rising up both sides
  bubbles(ctx, S, t, col, a) {
    halo(ctx, S, col, a * 0.5);
    ctx.lineWidth = S * 0.012;
    for (let i = 0; i < 12; i++) {
      const [x, y, life] = riser(S, i, t, 0.22), r = S * (0.018 + 0.03 * rnd(i, 5)) * (0.6 + life * 0.6), fade = Math.min(1, life * 6, (1 - life) * 4) * a;
      ctx.strokeStyle = rgba(col, 0.9 * fade); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      dot(ctx, x - r * 0.35, y - r * 0.35, r * 0.25, rgba('#ffffff', 0.8 * fade));
    }
  },

  // Fire: flames licking up round the bottom of the jelly, embers rising off them
  flames(ctx, S, t, col, a) {
    halo(ctx, S, col, a * 0.8);
    floorGlow(ctx, S, col, a);
    // tongues rising off the bottom edge, tallest at the sides so they climb round the jelly
    const tongue = (bx, by, w, h, sway, inner, outer) => {
      const g = ctx.createLinearGradient(bx, by, bx, by - h);
      g.addColorStop(0, inner); g.addColorStop(0.45, outer); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bx - w, by);
      ctx.bezierCurveTo(bx - w * 1.1, by - h * 0.35, bx - w * 0.3 + sway * 0.5, by - h * 0.7, bx + sway, by - h);
      ctx.bezierCurveTo(bx + w * 0.3 + sway * 0.5, by - h * 0.7, bx + w * 1.1, by - h * 0.35, bx + w, by);
      ctx.closePath(); ctx.fill();
    };
    for (let i = 0; i < 11; i++) {
      const u = (i + 0.5 * rnd(i, 3)) / 10.5, edge = Math.abs(u - 0.5) * 2, bx = S * u, by = S * 1.02;
      const flick = 0.72 + 0.28 * Math.sin(t * (8 + 4 * rnd(i)) + i * 2.3);
      const h = S * (0.14 + 0.36 * edge * edge + 0.06 * rnd(i, 1)) * flick, w = S * (0.05 + 0.03 * rnd(i, 2) + 0.03 * edge);
      const sway = Math.sin(t * 5 + i * 1.7) * w * 0.9 - (u - 0.5) * w * 0.8;   // leaning in toward the jelly
      tongue(bx, by, w, h, sway, rgba(col, 0.7 * a), rgba(col, 0.35 * a));
      tongue(bx, by, w * 0.5, h * 0.6, sway * 0.6, rgba('#fff1b0', 0.85 * a), rgba('#ffc45c', 0.4 * a));
    }
    for (let i = 0; i < 10; i++) {
      const [x, y, life] = riser(S, i + 20, t, 0.45);
      dot(ctx, x + Math.sin(t * 3 + i) * S * 0.02, y, S * 0.008 * (1.3 - life), rgba('#ffd27a', (1 - life) * a));
    }
  },

  // Ice: frost growing in from the card's corners, snow drifting down past the jelly
  frost(ctx, S, t, col, a) {
    halo(ctx, S, col, a * 0.6);
    ctx.lineCap = 'round';
    for (let c = 0; c < 4; c++) {
      const sx = c % 2 ? S : 0, sy = c < 2 ? 0 : S, dx = c % 2 ? -1 : 1, dy = c < 2 ? 1 : -1;
      const shine = 0.75 + 0.25 * Math.sin(t * 1.6 + c * 1.9);
      for (let b = 0; b < 3; b++) {
        const ang = (b + 1) / 4 * Math.PI / 2, len = S * (0.2 + 0.07 * rnd(c * 3 + b, 7)) * (b === 1 ? 1.25 : 1);
        const ux = Math.cos(ang) * dx, uy = Math.sin(ang) * dy;
        ctx.strokeStyle = rgba('#eaf9ff', 0.8 * shine * a); ctx.lineWidth = S * 0.011;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + ux * len, sy + uy * len);
        for (let k = 1; k <= 3; k++) {   // the side spikes
          const px = sx + ux * len * k / 4, py = sy + uy * len * k / 4, s = len * 0.22 * (1 - k / 5);
          ctx.moveTo(px, py); ctx.lineTo(px + (ux * 0.5 - uy * 0.85) * s, py + (uy * 0.5 + ux * 0.85) * s);
          ctx.moveTo(px, py); ctx.lineTo(px + (ux * 0.5 + uy * 0.85) * s, py + (uy * 0.5 - ux * 0.85) * s);
        }
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, S * 0.32);
      g.addColorStop(0, rgba(col, 0.5 * a)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.fillRect(Math.min(sx, sx + dx * S * 0.32), Math.min(sy, sy + dy * S * 0.32), S * 0.32, S * 0.32);
    }
    ctx.lineWidth = S * 0.007;
    for (let i = 0; i < 12; i++) {   // snowflakes: six little arms, turning as they fall
      const life = fract(t * 0.12 * (0.8 + 0.4 * rnd(i, 1)) + rnd(i, 2)), side = i % 2 ? 1 : -1;
      const x = S * (0.5 + side * (0.31 + 0.15 * rnd(i, 3))) + Math.sin(t * 1.3 + i) * S * 0.025, y = S * (life * 1.1 - 0.05);
      const r = S * (0.014 + 0.012 * rnd(i, 4)), spin = t * 0.8 + i;
      ctx.strokeStyle = rgba('#ffffff', 0.85 * Math.min(1, life * 8, (1 - life) * 8) * a);
      ctx.beginPath();
      for (let k = 0; k < 3; k++) { const q = spin + k * Math.PI / 3; ctx.moveTo(x - Math.cos(q) * r, y - Math.sin(q) * r); ctx.lineTo(x + Math.cos(q) * r, y + Math.sin(q) * r); }
      ctx.stroke();
    }
  },

  // Lightning: jagged arcs crackling round the jelly, a new set every few hundredths of a second
  sparks(ctx, S, t, col, a) {
    halo(ctx, S, col, a * (0.6 + 0.3 * rnd(Math.floor(t * 12), 9)));
    const seed = Math.floor(t / 0.09);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let b = 0; b < 3; b++) {
      if (rnd(seed, b + 40) < 0.2) continue;   // now and then one goes dark
      const from = TAU * rnd(Math.floor(t / 0.55) + b * 17, 41), span = 0.7 + 0.5 * rnd(seed, b + 42), pts = 8;
      ctx.beginPath();
      for (let k = 0; k <= pts; k++) {
        const out = 1.04 + (k % pts ? (rnd(seed * 9 + k, b) - 0.5) * 0.18 : 0);
        const [x, y] = ring(S, from + span * k / pts, out);
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = rgba(col, 0.45 * a); ctx.lineWidth = S * 0.035; ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', 0.95 * a); ctx.lineWidth = S * 0.011; ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {   // flecks thrown off
      const [x, y] = ring(S, TAU * rnd(seed + i, 43), 0.95 + 0.25 * rnd(seed + i, 44));
      dot(ctx, x, y, S * 0.008, rgba('#fff8c8', 0.9 * a));
    }
  },

  // Poison: a green mist pooled at the bottom, toxic bubbles rising out of it and popping
  toxic(ctx, S, t, col, a) {
    halo(ctx, S, col, a * 0.55);
    floorGlow(ctx, S, col, a * 0.9, 0.42);
    ctx.lineWidth = S * 0.01;
    for (let i = 0; i < 14; i++) {
      const [x, y, life] = riser(S, i + 60, t, 0.3), r = S * (0.02 + 0.035 * rnd(i, 5)) * (0.5 + life * 0.7);
      const pop = life > 0.88, fade = (pop ? (1 - life) * 8 : Math.min(1, life * 5)) * a;
      ctx.fillStyle = rgba(col, 0.35 * fade); ctx.strokeStyle = rgba(col, 0.95 * fade);
      ctx.beginPath(); ctx.arc(x, y, pop ? r * (1 + (life - 0.88) * 6) : r, 0, TAU); pop ? ctx.stroke() : (ctx.fill(), ctx.stroke());
      if (!pop) dot(ctx, x - r * 0.3, y - r * 0.35, r * 0.22, rgba('#eaffdc', 0.8 * fade));
    }
  },

  // Wind: streaks of air sweeping round the jelly, thick at the head and thinning to nothing
  gust(ctx, S, t, col, a) {
    halo(ctx, S, col, a * 0.45);
    ctx.lineCap = 'round';
    for (let s = 0; s < 6; s++) {
      const head = t * (2.4 + 0.5 * rnd(s, 1)) + s * TAU / 6, len = 1.1 + 0.5 * rnd(s, 2), out = 0.96 + 0.16 * rnd(s, 3);
      const tilt = (s % 2 ? 0.08 : -0.08);
      for (let k = 0; k < 10; k++) {
        const a0 = head - len * k / 10, a1 = head - len * (k + 1) / 10, f = 1 - k / 10;
        const [x0, y0] = ring(S, a0, out + tilt * Math.sin(a0)), [x1, y1] = ring(S, a1, out + tilt * Math.sin(a1));
        ctx.strokeStyle = rgba(k < 3 ? '#ffffff' : col, (0.4 + 0.6 * f) * a); ctx.lineWidth = S * 0.028 * f + 1;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
    }
  },

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

  // Tentacle: sting crescents flashing in the reach all round the jelly
  sting(ctx, S, t, col, a) {
    halo(ctx, S, col, a * 0.6);
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const period = 1.1, age = fract(t / period + i / 6), n = Math.floor(t / period + i / 6);
      if (age > 0.5) continue;
      const f = 1 - age / 0.5, angle = TAU * rnd(n * 7 + i, 50);
      const [x, y] = ring(S, angle, 0.98), r = S * (0.1 + 0.05 * rnd(n + i, 51)) * (1 + age * 0.5);
      ctx.strokeStyle = rgba(col, 0.7 * f * a); ctx.lineWidth = S * 0.05 * f;
      ctx.beginPath(); ctx.arc(x, y, r, angle + Math.PI - 1, angle + Math.PI + 1); ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', 0.95 * f * a); ctx.lineWidth = S * 0.016 * f;
      ctx.beginPath(); ctx.arc(x, y, r, angle + Math.PI - 0.8, angle + Math.PI + 0.8); ctx.stroke();
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
