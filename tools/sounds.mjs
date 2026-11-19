// Builds the game's sound packs (docs/agents/sound.md): for each pack in tools/sounds.json, every
// take of every role is read from the sources folder, made mono 48 kHz, started 2 ms before its
// onset (the first sample at 10% of its peak), cut to the role's `cap`, faded over its last 80 ms,
// and joined with 300 ms of silence either side into one 96 kbps MP3, assets/audio/<pack>.mp3.
// assets/audio/packs.json says where each take starts, how long it is and when its peak comes
// (sfx.js lines a hit up by its peak, and re-finds each start after decoding: Safari may shift them).
// Needs ffmpeg. The sources stay out of git (the repository is public): keep them in project files.
//
//   node tools/sounds.mjs <sources folder> [--only=<pack>]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/audio');
const RATE = 48000, GAP = 0.3, LEAD = 0.002, FADE = 0.08, KBPS = 96;
const [src, ...flags] = process.argv.slice(2);
if (!src || !fs.existsSync(src)) { console.log('usage: node tools/sounds.mjs <sources folder> [--only=<pack>]'); process.exit(1); }
const only = flags.find((f) => f.startsWith('--only='))?.slice(7);

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/sounds.json'), 'utf8'));
const listPath = path.join(OUT, 'packs.json');
const packs = fs.existsSync(listPath) ? JSON.parse(fs.readFileSync(listPath, 'utf8')) : {};

const ffmpeg = (args, input) => {
  const r = spawnSync('ffmpeg', ['-v', 'error', ...args], { input, maxBuffer: 1 << 30 });
  if (r.status) throw new Error(`ffmpeg ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
};
const decode = (file) => { const b = ffmpeg(['-i', file, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-']); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };

// one take, ready to join: its samples and where its peak comes (s from its start)
function take(file, cap) {
  const pcm = decode(path.join(src, file));
  let top = 0;
  for (const v of pcm) top = Math.max(top, Math.abs(v));
  if (!top) throw new Error(`${file} is silent`);
  const onset = pcm.findIndex((v) => Math.abs(v) >= top * 0.1);
  const from = Math.max(0, onset - Math.round(LEAD * RATE));
  const out = pcm.slice(from, cap ? Math.min(pcm.length, from + Math.round(cap * RATE)) : pcm.length);
  const fade = Math.min(out.length, Math.round(FADE * RATE));
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= (i / fade) ** 2;
  let peak = 0;
  for (let i = 1; i < out.length; i++) if (Math.abs(out[i]) > Math.abs(out[peak])) peak = i;
  return { pcm: out, peak: peak / RATE };
}

for (const [name, pack] of Object.entries(manifest.packs)) {
  if (only && name !== only) continue;
  const parts = [new Float32Array(GAP * RATE)], roles = {};
  let at = GAP;
  for (const [role, r] of Object.entries(pack.roles)) {
    roles[role] = { cue: r.cue, vol: r.vol, mode: r.mode, takes: [] };
    for (const file of r.takes) {
      const t = take(file, r.cap);
      roles[role].takes.push({ start: +at.toFixed(4), length: +(t.pcm.length / RATE).toFixed(4), peak: +t.peak.toFixed(4) });
      parts.push(t.pcm, new Float32Array(GAP * RATE));
      at += t.pcm.length / RATE + GAP;
    }
  }
  const all = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  parts.reduce((o, p) => (all.set(p, o), o + p.length), 0);
  const file = `${name}.mp3`;
  fs.writeFileSync(path.join(OUT, file), ffmpeg(['-f', 'f32le', '-ar', String(RATE), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', `${KBPS}k`, '-f', 'mp3', '-'], Buffer.from(all.buffer)));
  const bytes = fs.statSync(path.join(OUT, file)).size;
  packs[name] = { file, for: pack.for, bytes, seconds: +(all.length / RATE).toFixed(2), roles };
  console.log(`${file}: ${Object.keys(roles).length} roles, ${Object.values(roles).reduce((n, r) => n + r.takes.length, 0)} takes, ${(all.length / RATE).toFixed(1)} s, ${(bytes / 1024).toFixed(1)} KB`);
}
for (const name of Object.keys(packs)) if (!manifest.packs[name]) delete packs[name];   // a pack taken out of the manifest
fs.writeFileSync(listPath, JSON.stringify(packs, null, 1) + '\n');
console.log(`wrote ${path.relative(ROOT, listPath)}`);
