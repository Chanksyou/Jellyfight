// The shapes of the harmless marks left on the floor (fx.splat): painted once at startup on a
// 256 px canvas, four 128 px cells, white with alpha so each mark's own colour tints it.
//   splash  a lobed wet pool with a paler middle and flung droplets (bubbles, goo, steam, cream, gunk)
//   scorch  a soot stain with a ragged edge and burnt streaks out from it
//   ink     a dense blot with tendrils and spatter (the Ink Cloud)
//   dust    grainy speckle, thicker in the middle (scuffs, Vacuum dust, grit)
// Each shape reaches the edge of its cell at most, so a mark's radius is the reach of its spatter.
export const MARKS = ['splash', 'scorch', 'ink', 'dust'];   // cell order: top left, top right, bottom left, bottom right

export function paintFloorMarks() {
  const S = 256, H = S / 2, C = H / 2, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true });   // a CPU canvas: the dust pass reads it back, which stalls a GPU one
  let seed = 7;   // the same marks every load
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const blob = (x, y, rad, wob, n) => {
    g.beginPath();
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, k = rad * (1 - wob / 2 + wob * r()); g.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); }
    g.closePath(); g.fill();
  };
  const soft = (rad, a0, a1) => { const s = g.createRadialGradient(C, C, 0, C, C, rad); s.addColorStop(0, `rgba(255,255,255,${a0})`); s.addColorStop(1, `rgba(255,255,255,${a1})`); return s; };
  const cell = (i, paint) => { g.save(); g.translate((i % 2) * H, (i >> 1) * H); paint(); g.restore(); };
  cell(0, () => {
    g.fillStyle = soft(56, 1, 0.8); blob(C, C, 50, 0.3, 18);
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,0.25)'; blob(C - 2, C - 2, 28, 0.3, 14);
    g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 14; i++) { const a = r() * 6.28, d = 54 + r() * 7; blob(C + Math.cos(a) * d, C + Math.sin(a) * d, 2 + r() * 2.5, 0.3, 8); }
  });
  cell(1, () => {
    g.lineCap = 'round';
    for (let i = 0; i < 40; i++) {
      const a = r() * 6.28, d = 50 + r() * 12;
      g.strokeStyle = `rgba(255,255,255,${0.35 + r() * 0.4})`; g.lineWidth = 1 + r() * 3;
      g.beginPath(); g.moveTo(C + Math.cos(a) * 14, C + Math.sin(a) * 14); g.lineTo(C + Math.cos(a) * d, C + Math.sin(a) * d); g.stroke();
    }
    g.fillStyle = soft(54, 1, 0.55); blob(C, C, 48, 0.25, 30);
  });
  cell(2, () => {
    g.fillStyle = g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineCap = 'round';
    blob(C, C, 40, 0.35, 20);
    for (let i = 0; i < 7; i++) {
      const a = r() * 6.28, d = 50 + r() * 10;
      g.lineWidth = 3 + r() * 4;
      g.beginPath(); g.moveTo(C, C); g.quadraticCurveTo(C + Math.cos(a + 0.4) * 34, C + Math.sin(a + 0.4) * 34, C + Math.cos(a) * d, C + Math.sin(a) * d); g.stroke();
    }
    for (let i = 0; i < 30; i++) { const a = r() * 6.28, d = 44 + r() * 16; blob(C + Math.cos(a) * d, C + Math.sin(a) * d, 1 + r() * 3.5, 0.3, 8); }
  });
  const img = g.getImageData(H, H, H, H), d = img.data;   // dust: one pass over the cell's pixels
  for (let y = 0; y < H; y++) for (let x = 0; x < H; x++) {
    const q = Math.hypot(x - C, y - C) / (C - 2), a = Math.max(0, 1 - q * q) * (r() < 0.6 ? 0.6 + r() * 0.4 : 0.25), i = (y * H + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = a * 255;
  }
  g.putImageData(img, H, H);
  return c;
}
