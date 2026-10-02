// Renders the soundtrack (src/music.js) to WAV files to listen to outside the game, each with
// the intensity rising through the take so every layer comes in:
//   node tools/music.mjs [out-folder] [seconds]
// writes drift.wav ("Puddle Drift", exploring: intensity 0 -> 1) and machinery.wav ("Domestic
// Machinery", the Vacuum: 0.6 -> 1).
import fs from 'node:fs';
import path from 'node:path';
import { start } from '../tests/lib.mjs';

const out = path.resolve(process.argv[2] || 'music');
const secs = +(process.argv[3] || 90);
fs.mkdirSync(out, { recursive: true });
const env = await start();
const page = await env.browser.newPage();
await page.goto(env.url);   // any page on the server, so modules load from it

for (const [name, from, to] of [['drift', 0, 1], ['machinery', 0.6, 1]]) {
  const b64 = await page.evaluate(async ({ name, from, to, secs }) => {
    const { Music } = await import('/src/music.js');
    const rate = 32000, ctx = new OfflineAudioContext(2, rate * secs, rate);
    const comp = ctx.createDynamicsCompressor();
    comp.connect(ctx.destination);
    const m = new Music(ctx, comp);
    m.volume = 0.9;
    m.play(name, 1);
    // intensity rises through the take, held at the top for the last fifth
    for (let t = 0; t < secs; t += 0.25) {
      m.I = from + (to - from) * Math.min(1, t / (secs * 0.8));
      m.schedule(t + 0.25);
    }
    const buf = await ctx.startRendering();
    // 16-bit stereo WAV
    const n = buf.length, data = new DataView(new ArrayBuffer(44 + n * 4));
    const str = (o, s) => [...s].forEach((ch, i) => data.setUint8(o + i, ch.charCodeAt(0)));
    str(0, 'RIFF'); data.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
    data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
    data.setUint32(24, rate, true); data.setUint32(28, rate * 4, true); data.setUint16(32, 4, true); data.setUint16(34, 16, true);
    str(36, 'data'); data.setUint32(40, n * 4, true);
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    let peak = 0;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    const k = peak > 0.98 ? 0.98 / peak : 1;
    for (let i = 0; i < n; i++) {
      data.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i] * k)) * 32767, true);
      data.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i] * k)) * 32767, true);
    }
    let s = '';
    const u8 = new Uint8Array(data.buffer);
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { b64: btoa(s), peak };
  }, { name, from, to, secs });
  fs.writeFileSync(path.join(out, `${name}.wav`), Buffer.from(b64.b64, 'base64'));
  console.log(`${name}.wav  peak ${b64.peak.toFixed(2)}`);
}
await env.close();
