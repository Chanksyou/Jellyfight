// Sound effects, synthesized with Web Audio (no files to load). Every sound is a few oscillators
// or a burst of filtered noise with a quick envelope, with a little random pitch so repeats
// don't sound robotic. Browsers only allow audio after a tap or click: main.js calls unlock()
// from the Play button.
let ctx = null, master = null, noiseBuf = null;
const last = {};                 // throttle: the last time each sound played
let muted = false;
let at = null;                   // previews (tools/music.mjs): a fixed time to play sounds at, on an offline context

// Previews: play the sounds into another (offline) context, each at the time given by when(t)
export function preview(c, dest) {
  ctx = c;
  master = c.createGain();
  master.gain.value = 0.55;
  master.connect(dest);
  noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return { when: (t) => { at = t; for (const k in last) delete last[k]; } };
}
const now = () => (at ?? ctx.currentTime);

export function unlock() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor();     // keeps a big fight from clipping
      master.connect(comp).connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* no audio: the game still works */ }
}

// the audio context and master volume, for the music (music.js); null until unlocked
export const audio = () => (ctx ? { ctx, master } : null);

export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.55; }
export const isMuted = () => muted;

const ready = () => ctx && (at !== null || ctx.state === 'running') && !muted;
const jitter = (k = 0.08) => 1 + (Math.random() - 0.5) * 2 * k;
function gap(name, ms) {
  const now = performance.now();
  if (last[name] && now - last[name] < ms) return false;
  last[name] = now;
  return true;
}

// one tone: type, start/end frequency, duration, volume
function tone(type, f0, f1, dur, vol, delay = 0) {
  const t = now() + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// a burst of noise through a filter
function noise(freq, q, dur, vol, type = 'bandpass', delay = 0, sweepTo = null) {
  const t = now() + delay;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf;
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 0.3);
  s.stop(t + dur + 0.02);
}

export const sfx = {
  // blowing a bubble: a soft rising bloop
  blow() { if (!ready() || !gap('blow', 60)) return; const j = jitter(0.12); tone('sine', 260 * j, 520 * j, 0.09, 0.07); },
  // a bubble bursting on an enemy: a water-drop plink that rises (the music's drums and plucks all
  // fall in pitch, so this one never blends in), then a carbonated fizz of tiny crackles
  pop(big = false) {
    if (!ready() || !gap('pop', 25)) return;
    const j = jitter(0.12);
    tone('sine', (big ? 380 : 900) * j, (big ? 1300 : 2600) * j, big ? 0.07 : 0.035, big ? 0.2 : 0.13);
    if (big) tone('sine', 120 * j, 260 * j, 0.12, 0.18);            // a deep glorp under the big ones
    for (let k = 0; k < (big ? 6 : 3); k++) noise(7000 + Math.random() * 4000, 4, 0.012, (big ? 0.06 : 0.045) * (1 - k * 0.15), 'bandpass', 0.02 + k * 0.016 + Math.random() * 0.01);
  },
  // a tentacle sting: a quick zip
  sting() { if (!ready() || !gap('sting', 40)) return; noise(2500 * jitter(), 6, 0.06, 0.08, 'bandpass', 0, 6000); },
  // an enemy hit: a short thud
  hit() { if (!ready() || !gap('hit', 30)) return; tone('triangle', 200 * jitter(), 90, 0.06, 0.12); },
  // an enemy dies: a crunchy squish; bigger for bigger things
  kill(size = 1) {
    if (!ready() || !gap('kill', 35)) return;
    const j = jitter(0.1);
    noise(900 * j, 1.2, 0.12 + size * 0.05, 0.28, 'lowpass', 0, 200);
    tone('square', 180 * j / size, 50, 0.1 + size * 0.04, 0.08);
    tone('sine', 520 * j, 1040 * j, 0.08, 0.06, 0.03);
  },
  // dew collected: a chime that climbs with the combo
  dew(combo = 0) {
    if (!ready() || !gap('dew', 45)) return;
    const step = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24][Math.min(10, Math.floor(combo / 3))];
    const f = 880 * Math.pow(2, step / 12);
    tone('sine', f, f, 0.12, 0.08);
    tone('triangle', f * 2, f * 2, 0.06, 0.03, 0.01);
  },
  // you get hurt: a low wobbly bonk
  hurt() { if (!ready() || !gap('hurt', 150)) return; tone('sawtooth', 220, 70, 0.22, 0.14); noise(400, 1, 0.15, 0.15, 'lowpass'); },
  // level up / treasure: a bright arpeggio
  levelUp() { if (!ready()) return; [0, 4, 7, 12].forEach((s, i) => tone('triangle', 523 * Math.pow(2, s / 12), 523 * Math.pow(2, s / 12), 0.18, 0.12, i * 0.07)); },
  treasure() { if (!ready()) return; [0, 7, 12, 16, 19].forEach((s, i) => tone('sine', 660 * Math.pow(2, s / 12), 660 * Math.pow(2, s / 12), 0.25, 0.1, i * 0.06)); },
  // elements
  fire() { if (!ready() || !gap('fire', 70)) return; noise(700, 0.8, 0.25, 0.14, 'lowpass', 0, 2500); },
  zap() { if (!ready() || !gap('zap', 60)) return; tone('sawtooth', 1800 * jitter(), 300, 0.12, 0.07); noise(5000, 3, 0.08, 0.08, 'highpass'); },
  freeze() { if (!ready() || !gap('freeze', 80)) return; [0, 5, 9].forEach((s, i) => tone('sine', 1760 * Math.pow(2, s / 12), 1760 * Math.pow(2, s / 12), 0.2, 0.05, i * 0.03)); },
  shatter() { if (!ready() || !gap('shatter', 60)) return; noise(6000, 1, 0.3, 0.25, 'highpass'); tone('triangle', 2400, 800, 0.2, 0.08); },
  acid() { if (!ready() || !gap('acid', 90)) return; tone('sine', 300 * jitter(), 180, 0.1, 0.07); tone('sine', 420 * jitter(), 250, 0.08, 0.05, 0.05); },
  wind() { if (!ready() || !gap('wind', 80)) return; noise(1200, 0.7, 0.2, 0.12, 'bandpass', 0, 400); },
  // a big moment: boss or elite down
  boom() { if (!ready()) return; noise(300, 0.7, 0.6, 0.4, 'lowpass', 0, 60); tone('sine', 120, 40, 0.5, 0.3); },
  // the combo ticking up at milestones
  combo(n) { if (!ready()) return; const f = 440 * Math.pow(2, Math.min(24, n / 5) / 12); tone('square', f, f * 1.5, 0.12, 0.05); },
};
