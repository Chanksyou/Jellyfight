// Sound effects, synthesized with Web Audio (no files to load). Every sound is a few oscillators
// or a burst of filtered noise with a quick envelope, with a little random pitch so repeats
// don't sound robotic. Browsers only allow audio after a tap or click: main.js calls unlock()
// from the Play button.
let ctx = null, master = null, noiseBuf = null, deep = null;   // deep: a lowpass in the master chain (deepen)
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
      deep = ctx.createBiquadFilter();                  // wide open until something deepens the sound
      deep.type = 'lowpass'; deep.frequency.value = 20000; deep.Q.value = 0.9;
      master.connect(deep).connect(comp).connect(ctx.destination);
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

// Deepened sound (the Cream Whipper's balloon): for `hold` s everything (music and sound effects)
// plays low and muffled, then eases back to normal over `ease` s. pitch() is the factor every
// new note is played at right now (music.js and the sounds here use it).
const daze = { from: 0, until: 0, back: 0 };
const LOW = 0.6;
export function pitch() {
  const n = performance.now();
  if (n < daze.from || n >= daze.back) return 1;
  if (n < daze.from + 300) return 1 - (1 - LOW) * (n - daze.from) / 300;     // a quick dive down
  if (n < daze.until) return LOW;
  return LOW + (1 - LOW) * (n - daze.until) / (daze.back - daze.until);
}
export function deepen(hold = 5, ease = 3) {
  const n = performance.now();
  daze.from = pitch() < 1 ? n - 300 : n;                                   // already deep: stay down, start the clock again
  daze.until = n + hold * 1000;
  daze.back = daze.until + ease * 1000;
  if (!deep) return;
  const t = ctx.currentTime, f = deep.frequency;
  f.cancelScheduledValues(t);
  f.setValueAtTime(f.value, t);
  f.exponentialRampToValueAtTime(650, t + 0.3);
  f.setValueAtTime(650, t + hold);
  f.exponentialRampToValueAtTime(20000, t + hold + ease);
}
export const isDeep = () => { const n = performance.now(); return n >= daze.from && n < daze.back; };
// back to normal at once (a new run)
export function calm() {
  daze.from = daze.until = daze.back = 0;
  if (deep) { deep.frequency.cancelScheduledValues(ctx.currentTime); deep.frequency.value = 20000; }
}
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
  const k = pitch();
  o.frequency.setValueAtTime(f0 * k, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * k), t + dur);
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
  const k = pitch();
  f.frequency.setValueAtTime(freq * k, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo * k, t + dur);
  s.playbackRate.value = k;                          // slowed noise sounds lower too
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
  // ---------------------------------------------------------- the Vacuum (vacuum.js)
  // booting up: a rising motor and a three-note startup chime
  vacPowerOn() {
    if (!ready()) return;
    tone('sawtooth', 50, 220, 1.3, 0.12); tone('sine', 80, 330, 1.3, 0.14);
    [660, 880, 1320].forEach((f, i) => tone('triangle', f, f, 0.16, 0.1, 0.9 + i * 0.13));
  },
  // the charge wind-up: a two-tone alarm over a motor revving up
  vacChargeWind(dur) {
    if (!ready()) return;
    for (let k = 0; k * 0.12 < dur; k++) tone('square', k % 2 ? 900 : 1250, k % 2 ? 900 : 1250, 0.09, 0.05, k * 0.12);
    tone('sawtooth', 90, 520, dur, 0.1);
  },
  // the ram itself: a roaring whoosh
  vacRam() {
    if (!ready()) return;
    noise(300, 0.8, 0.8, 0.3, 'lowpass', 0, 3500);
    tone('sawtooth', 70, 190, 0.8, 0.14); tone('square', 140, 300, 0.6, 0.05);
  },
  // slamming into a wall (or stopping hard): a boom, a crunch and a metal clang
  vacImpact(hard = true) {
    if (!ready() || !gap('vacImpact', 200)) return;
    tone('sine', 130, 32, 0.5, hard ? 0.5 : 0.3);
    noise(900, 0.7, 0.35, hard ? 0.35 : 0.2, 'lowpass', 0, 120);
    if (hard) { tone('triangle', 1830, 1790, 0.5, 0.07); tone('triangle', 2470, 2400, 0.4, 0.05); tone('triangle', 3610, 3500, 0.3, 0.03); }
  },
  // suction: a dub-wobbling roar that swells in, a sub that breathes in, and a rising whistle
  vacSuction(dur) {
    if (!ready()) return;
    const t = now(), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = 'lowpass'; f.Q.value = 9;
    f.frequency.setValueAtTime(700, t);
    lfo.frequency.setValueAtTime(7, t); lfo.frequency.linearRampToValueAtTime(2.5, t + dur);   // the wobble slows as it pulls harder
    lg.gain.value = 600;
    lfo.connect(lg).connect(f.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.5);
    g.gain.setValueAtTime(0.3, t + dur - 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + dur + 0.25); lfo.start(t); lfo.stop(t + dur + 0.25);
    const sub = ctx.createOscillator(), sg = ctx.createGain(), sl = ctx.createOscillator(), slg = ctx.createGain();
    sub.frequency.setValueAtTime(55, t); sub.frequency.exponentialRampToValueAtTime(38, t + dur);
    sl.frequency.value = 3.5; slg.gain.value = 0.12; sl.connect(slg).connect(sg.gain);
    sg.gain.setValueAtTime(0.0001, t); sg.gain.linearRampToValueAtTime(0.22, t + 0.6); sg.gain.setValueAtTime(0.22, t + dur - 0.3); sg.gain.linearRampToValueAtTime(0, t + dur + 0.2);
    sub.connect(sg).connect(master);
    sub.start(t); sub.stop(t + dur + 0.25); sl.start(t); sl.stop(t + dur + 0.25);
    tone('sawtooth', 180, 720, dur, 0.035);
  },
  // the side brushes whirring up (a rising, fluttering whine), and each sweep (a swish and a thump)
  vacBrushes(dur) {
    if (!ready()) return;
    const t = now(), o = ctx.createOscillator(), g = ctx.createGain(), trem = ctx.createOscillator(), tg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(1400, t + dur * 0.6);
    trem.frequency.value = 32; tg.gain.value = 0.05; trem.connect(tg).connect(g.gain);
    g.gain.setValueAtTime(0.06, t); g.gain.setValueAtTime(0.06, t + dur - 0.1); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.05); trem.start(t); trem.stop(t + dur + 0.05);
  },
  vacSweep() {
    if (!ready() || !gap('vacSweep', 120)) return;
    noise(5000, 1.2, 0.28, 0.3, 'bandpass', 0, 700);
    tone('sine', 160, 60, 0.18, 0.25);
  },
  // the bin dropping roaches: a clunk, the hatch hissing, a scatter of tiny legs
  vacDump() {
    if (!ready()) return;
    tone('triangle', 320, 110, 0.16, 0.22);
    noise(2500, 1, 0.3, 0.12, 'highpass', 0.05);
    for (let k = 0; k < 8; k++) noise(4000 + Math.random() * 3000, 6, 0.01, 0.07, 'bandpass', 0.15 + k * 0.035 + Math.random() * 0.02);
  },
  // spinning: a whirling siren with a whoosh going round, and a pft for every dust clump
  vacSpin(dur) {
    if (!ready()) return;
    const t = now(), o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 600;
    lfo.frequency.value = 4.5; lg.gain.value = 260; lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.2); g.gain.setValueAtTime(0.06, t + dur - 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.05); lfo.start(t); lfo.stop(t + dur + 0.05);
    for (let k = 0; k * 0.22 < dur; k++) noise(800, 0.7, 0.2, 0.12, 'bandpass', k * 0.22, 2400);
  },
  vacSpray() { if (!ready() || !gap('vacSpray', 90)) return; noise(1400 * jitter(0.2), 1, 0.08, 0.12, 'bandpass', 0, 500); },
  // launching the lanternflies: a rising alarm wail, then four pops out of the bin
  vacFliesWind() {
    if (!ready()) return;
    tone('square', 420, 980, 0.32, 0.06); tone('square', 420, 980, 0.32, 0.06, 0.36);
  },
  vacFliesLaunch() {
    if (!ready()) return;
    for (let k = 0; k < 4; k++) { tone('sine', 260, 900, 0.09, 0.2, k * 0.07); noise(1800, 1, 0.06, 0.15, 'bandpass', k * 0.07); }
  },
  // the shield: up (a shimmering chord swelling in), hit (a ringing deflect), broken (shattering glass)
  shieldUp() {
    if (!ready()) return;
    [880, 1108.7, 1318.5, 1760].forEach((f, i) => tone('sine', f * 0.98, f, 0.9, 0.06, i * 0.05));
    noise(3000, 0.7, 0.6, 0.12, 'bandpass', 0, 9000);
  },
  shieldHit() {
    if (!ready() || !gap('shieldHit', 90)) return;
    const j = jitter(0.05);
    tone('sine', 2640 * j, 2600 * j, 0.22, 0.07); tone('sine', 3960 * j, 3900 * j, 0.14, 0.04);
  },
  shieldBreak() {
    if (!ready()) return;
    noise(6000, 0.8, 0.6, 0.35, 'highpass');
    [2400, 1800, 1300, 900].forEach((f, i) => tone('triangle', f, f * 0.7, 0.3, 0.07, i * 0.05));
    tone('sine', 140, 40, 0.5, 0.3);
  },
  // below 45%: an angry two-tone siren
  vacAngry() {
    if (!ready()) return;
    for (let k = 0; k < 6; k++) tone('sawtooth', k % 2 ? 620 : 830, k % 2 ? 620 : 830, 0.22, 0.07, k * 0.24);
  },
  // down: the motor winding down to nothing, crackles, a boom
  vacDeath() {
    if (!ready()) return;
    tone('sawtooth', 420, 28, 1.8, 0.16); tone('square', 210, 20, 1.8, 0.06);
    for (let k = 0; k < 10; k++) noise(3000 + Math.random() * 4000, 3, 0.02, 0.12, 'bandpass', 0.2 + Math.random() * 1.4);
    noise(300, 0.7, 0.9, 0.4, 'lowpass', 1.6, 60); tone('sine', 110, 30, 0.8, 0.4, 1.6);
  },
  // the combo ticking up at milestones
  // a house fly's poke: a buzzy chirp up as the straw shoots out, and a wet little tick at the end
  flyPoke() {
    if (!ready() || !gap('flyPoke', 90)) return;
    const j = jitter(0.1);
    tone('sawtooth', 240 * j, 520 * j, 0.09, 0.05); tone('sawtooth', 248 * j, 540 * j, 0.09, 0.035);
    noise(3200 * j, 4, 0.04, 0.08, 'bandpass', 0.07);
  },
  // the millipede: a clicking rattle as it coils (all those plates), a whirr that revs up, a rolling rumble
  milliCurl() {
    if (!ready()) return;
    for (let k = 0; k < 10; k++) noise(3500 + Math.random() * 2500, 5, 0.012, 0.07, 'bandpass', k * 0.035 + Math.random() * 0.01);
  },
  milliRev(dur) {
    if (!ready()) return;
    const t = now(), o = ctx.createOscillator(), g = ctx.createGain(), trem = ctx.createOscillator(), tg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(420, t + dur);
    trem.frequency.setValueAtTime(8, t); trem.frequency.exponentialRampToValueAtTime(40, t + dur); tg.gain.value = 0.03; trem.connect(tg).connect(g.gain);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.1); trem.start(t); trem.stop(t + dur + 0.1);
  },
  milliRoll(dur) {
    if (!ready()) return;
    noise(260, 0.8, dur, 0.22, 'lowpass', 0, 520); tone('sine', 90, 60, dur, 0.12);
  },
  // the Clog: a deep gurgle rising out of the drain, a wet growl of a roar, hair ropes creaking
  // taut then cracking down, a squelching roll, rustling hair, the drain glugging, a splat, death
  clogRise() {
    if (!ready()) return;
    for (let k = 0; k < 10; k++) { const f = 90 + Math.random() * 160; tone('sine', f, f * 1.8, 0.09, 0.12, k * 0.12 + Math.random() * 0.05); }
    noise(300, 0.8, 1.4, 0.18, 'lowpass', 0, 900);
  },
  clogRoar() {
    if (!ready()) return;
    tone('sawtooth', 75, 52, 1.0, 0.16); tone('square', 112, 70, 0.9, 0.06);
    noise(500, 0.7, 1.0, 0.2, 'lowpass', 0, 200);
    for (let k = 0; k < 6; k++) { const f = 120 + Math.random() * 120; tone('sine', f, f * 1.6, 0.06, 0.07, 0.1 + k * 0.14); }   // gurgling in it
  },
  clogLashWind() { if (!ready()) return; tone('sawtooth', 160, 420, 0.8, 0.04); noise(2200, 3, 0.8, 0.05, 'bandpass', 0, 4000); },
  clogLash() { if (!ready()) return; noise(6000, 0.6, 0.06, 0.4, 'highpass'); noise(700, 0.9, 0.25, 0.3, 'lowpass', 0.03, 150); tone('sine', 160, 50, 0.25, 0.25, 0.03); },
  clogRollWind() { if (!ready()) return; tone('sawtooth', 80, 300, 1.0, 0.06); noise(900, 1, 1.0, 0.08, 'bandpass', 0, 2500); },
  clogRoll() { if (!ready()) return; noise(250, 0.7, 1.1, 0.28, 'lowpass', 0, 600); for (let k = 0; k < 8; k++) noise(500, 2, 0.06, 0.1, 'lowpass', k * 0.13); },
  clogRustle() { if (!ready()) return; for (let k = 0; k < 8; k++) noise(3000 + Math.random() * 2000, 2, 0.08, 0.05, 'bandpass', k * 0.1); },
  clogSnare() { if (!ready()) return; noise(4500, 0.8, 0.15, 0.3, 'highpass'); noise(1200, 1.5, 0.3, 0.15, 'bandpass', 0.03, 400); },
  clogGurgle(dur = 3) {
    if (!ready()) return;
    noise(200, 0.8, dur, 0.22, 'lowpass', 0, 120);
    for (let k = 0; k * 0.14 < dur; k++) { const f = 70 + Math.random() * 130; tone('sine', f, f * 2, 0.08, 0.1, k * 0.14 + Math.random() * 0.06); }
  },
  clogSplat() { if (!ready() || !gap('clogSplat', 70)) return; noise(900 * jitter(), 1, 0.12, 0.22, 'lowpass', 0, 250); tone('sine', 140, 60, 0.1, 0.12); },
  clogDeath() {
    if (!ready()) return;
    tone('sawtooth', 120, 30, 2.2, 0.15); noise(300, 0.7, 2.2, 0.25, 'lowpass', 0, 60);
    for (let k = 0; k < 16; k++) { const f = 60 + Math.random() * 150; tone('sine', f, f * 1.5, 0.1, 0.1, k * 0.13 + Math.random() * 0.06); }
  },
  // the ladybug and its missile: a buzz on take-off, a tap as it lands, the lock-on beeps (higher
  // as it closes in), the ignition roar, the rocket's hiss, the engine coughing out, the clink of
  // a spent one landing, the explosion
  ladyBuzz() { if (!ready()) return; tone('sawtooth', 170, 230, 0.35, 0.035); tone('sawtooth', 176, 238, 0.35, 0.025); },
  ladyLand() { if (!ready() || !gap('ladyLand', 80)) return; tone('triangle', 600, 300, 0.05, 0.05); },
  lockBeep(k = 0) { if (!ready()) return; const f = 1500 + k * 900; tone('square', f, f, 0.045, 0.035); },
  missileLaunch() {
    if (!ready()) return;
    noise(5000, 0.7, 0.08, 0.25, 'highpass');                         // the crack of ignition
    noise(400, 0.7, 0.6, 0.3, 'lowpass', 0.02, 2600);                 // the roar, rising
    tone('sawtooth', 110, 380, 0.5, 0.07, 0.02);
  },
  missileHiss() { if (!ready() || !gap('missileHiss', 150)) return; noise(3800 * jitter(), 1.4, 0.24, 0.035, 'bandpass'); },
  missileSputter() { if (!ready()) return; tone('sawtooth', 300, 70, 0.7, 0.06); for (let k = 0; k < 5; k++) noise(700, 1, 0.05, 0.12, 'lowpass', 0.05 + k * 0.11 + Math.random() * 0.05); },
  missileCough() { if (!ready() || !gap('missileCough', 90)) return; noise(500 * jitter(0.2), 1, 0.06, 0.1, 'lowpass'); },
  missileClink() { if (!ready()) return; tone('triangle', 2300, 2200, 0.09, 0.05); tone('triangle', 3400, 3300, 0.06, 0.03, 0.05); noise(1500, 1, 0.3, 0.06, 'bandpass', 0.05, 600); },
  missileBoom() {
    if (!ready()) return;
    noise(3000, 0.6, 0.15, 0.35, 'highpass');
    noise(500, 0.7, 0.7, 0.45, 'lowpass', 0, 60);
    tone('sine', 120, 35, 0.6, 0.4);
    for (let k = 0; k < 6; k++) noise(2500 + Math.random() * 3000, 3, 0.02, 0.08, 'bandpass', 0.08 + Math.random() * 0.35);   // crackle
  },
  // the Cream Whipper: the regulator hissing as a balloon fills (rubber creaking as it stretches),
  // the squeak as it lets go, the bang when it bursts, the cream spraying
  balloonFill(dur = 1) {
    if (!ready()) return;
    noise(3500, 1.5, dur, 0.08, 'bandpass', 0, 5500);
    for (let k = 0; k < 4; k++) tone('triangle', 300 + k * 90, 380 + k * 120, 0.08, 0.035, k * dur / 4 + 0.05);
  },
  balloonLoose() { if (!ready()) return; tone('square', 900, 1400, 0.12, 0.03); tone('sine', 600, 1100, 0.15, 0.04); },
  balloonTick() { if (!ready() || !gap('balloonTick', 80)) return; tone('sine', 1800, 1700, 0.03, 0.03); },
  balloonPop() {
    if (!ready()) return;
    noise(2500, 0.6, 0.18, 0.5, 'highpass'); noise(400, 0.8, 0.35, 0.35, 'lowpass', 0, 90);
    tone('sine', 140, 40, 0.4, 0.35);
    for (let k = 0; k < 5; k++) noise(5000 + Math.random() * 3000, 4, 0.015, 0.06, 'bandpass', 0.05 + k * 0.04);   // scraps of rubber
  },
  // your ears going funny: a long slide down
  daze() { if (!ready()) return; tone('sine', 520, 180, 0.9, 0.08); tone('triangle', 260, 90, 1.1, 0.06); },
  creamSpray(dur = 0.8) { if (!ready()) return; noise(2600, 0.9, dur, 0.18, 'bandpass', 0, 1600); noise(700, 1, dur * 0.6, 0.1, 'lowpass'); },
  // the Wall Clock: a tick, a whoosh as its hand sweeps, a bronze bell for each chime (k: which, a
  // little lower each time), the wreath whirring through the air
  clockTick() { if (!ready() || !gap('clockTick', 70)) return; tone('square', 2400, 2200, 0.012, 0.03); noise(5000, 6, 0.01, 0.04, 'bandpass'); },
  clockSweep() { if (!ready()) return; noise(900, 0.8, 0.5, 0.2, 'bandpass', 0, 3000); tone('sawtooth', 160, 420, 0.45, 0.05); },
  clockChime(k = 0) {
    if (!ready()) return;
    const f = 392 * Math.pow(2, -k * 2 / 12);
    for (const [m, v, d] of [[1, 0.16, 1.6], [2.01, 0.07, 1.1], [2.76, 0.05, 0.8], [5.4, 0.025, 0.4]]) tone('sine', f * m, f * m * 0.998, d, v);
    noise(3000, 2, 0.03, 0.08, 'bandpass');                              // the strike
  },
  wreathWhirr() { if (!ready()) return; for (let k = 0; k < 6; k++) noise(1600 + k * 100, 3, 0.09, 0.07, 'bandpass', k * 0.09, 800); },
  // the Soap Dispenser: a wet pump squelch, a squirt landing, a burst of bubbles let go, one popping
  soapPump() {
    if (!ready()) return;
    const j = jitter(0.08);
    noise(700 * j, 1.5, 0.14, 0.18, 'lowpass', 0, 180); tone('sine', 320 * j, 140 * j, 0.12, 0.12);
  },
  soapSplat() { if (!ready() || !gap('soapSplat', 60)) return; noise(1400 * jitter(), 1.2, 0.1, 0.16, 'bandpass', 0, 500); tone('sine', 220, 110, 0.08, 0.08); },
  soapBubbles() {
    if (!ready()) return;
    for (let k = 0; k < 9; k++) { const f = 500 + Math.random() * 700; tone('sine', f, f * 1.8, 0.05, 0.05, k * 0.025 + Math.random() * 0.02); }
  },
  bubblePop() { if (!ready() || !gap('bubblePop', 40)) return; const f = 900 * jitter(0.2); tone('sine', f, f * 2.2, 0.04, 0.05); noise(6000, 3, 0.02, 0.04, 'highpass'); },
  // a hit glancing off armour: a short metallic tink
  clink() { if (!ready() || !gap('clink', 80)) return; const j = jitter(0.06); tone('triangle', 2600 * j, 2400 * j, 0.08, 0.05); tone('sine', 3900 * j, 3700 * j, 0.05, 0.03); },
  combo(n) { if (!ready()) return; const f = 440 * Math.pow(2, Math.min(24, n / 5) / 12); tone('square', f, f * 1.5, 0.12, 0.05); },
};
