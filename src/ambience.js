// Room tone: the sound an act's room makes by itself, under the music. One quiet bed per act
// (a few looping layers: a fridge hum, the city far below, tile-room air, a humidifier's hiss),
// and a few one-shots on a slow random timer, placed in the room near the thing that makes them
// (a wall clock's tick, a wind chime, a drip) and faded by how far the jelly is from it.
//
// All of it is synthesized: nothing downloads, nothing loops audibly (the beds are filtered noise
// and sines), and a muted or not-yet-unlocked page makes no sound at all. It plays through the
// same master as the effects, so the Sound setting is its volume. Act 4's Encore plays only its
// own recording, so the room goes silent there.
//
// To change what an act sounds like, edit BEDS (looping layers) or ONCE (one-shots) below.
// Levels and fades are in content/look.css, `--ambience-*`. Stories: sound/ambience-*.
import { LOOK } from './look.js';

// ---- the beds -------------------------------------------------------------------------------
// A layer builds its nodes into `out` and returns { stop(at), gain? }. `n` is the shared noise.
// air(): noise through a filter, its level breathing slowly (lfo: Hz, depth 0..1 of its level).
const air = (type, freq, q, level, lfo = 0, depth = 0) => (c, out, n) => {
  const src = c.createBufferSource(); src.buffer = n; src.loop = true;
  src.loopStart = 0; src.loopEnd = n.duration; src.playbackRate.value = 1;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.value = level;
  src.connect(f).connect(g).connect(out);
  const stops = [src];
  if (lfo) {
    const o = c.createOscillator(), d = c.createGain();
    o.frequency.value = lfo; d.gain.value = level * depth;
    o.connect(d).connect(g.gain); stops.push(o); o.start();
  }
  src.start(0, Math.random() * (n.duration - 0.1));
  return { stop: (at) => stops.forEach((s) => s.stop(at)), gain: g.gain, level };
};
// hum(): sines at a base pitch and its harmonics, each a little quieter than the one below
const hum = (base, level, harmonics = [1, 2, 3], wobble = 0.05) => (c, out) => {
  const g = c.createGain(); g.gain.value = level; g.connect(out);
  const stops = [];
  harmonics.forEach((h, i) => {
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = base * h;
    const hg = c.createGain(); hg.gain.value = 1 / (1 + i * 1.6);
    o.connect(hg).connect(g); o.start(); stops.push(o);
  });
  const l = c.createOscillator(), d = c.createGain();   // the motor's load wandering a little
  l.frequency.value = 0.11; d.gain.value = level * wobble; l.connect(d).connect(g.gain); l.start(); stops.push(l);
  return { stop: (at) => stops.forEach((s) => s.stop(at)), gain: g.gain, level };
};

const FRIDGE = hum(54, 0.05, [1, 2, 3, 5], 0.12);
const CITY = air('lowpass', 420, 0.4, 0.08, 0.07, 0.35);
const TRAFFIC = air('bandpass', 1500, 0.5, 0.012, 0.043, 0.5);
// act 1 and act 4 are the same room: one list. Act 1 adds its rain on the glass (rain.js; act 4 is dry).
const LIVING_ROOM = [FRIDGE, CITY, TRAFFIC];
const RAIN = [air('bandpass', 3200, 0.35, 0.03, 0.06, 0.3), air('lowpass', 900, 0.5, 0.035, 0.03, 0.25)];   // the patter on the glass, its softer body
export const BEDS = {
  1: [...LIVING_ROOM, ...RAIN],
  2: [air('bandpass', 700, 0.6, 0.05, 0.05, 0.3), hum(120, 0.012, [1, 2], 0.2), air('lowpass', 300, 0.5, 0.05, 0.03, 0.4)],   // tile-room air, a pipe's hum
  3: [air('bandpass', 5200, 0.7, 0.05, 0.14, 0.3), air('lowpass', 230, 0.5, 0.1, 0.02, 0.2), hum(96, 0.012, [1, 2], 0.1)],   // the humidifier's hiss, the air purifier's fan
  4: LIVING_ROOM,
};

// ---- the one-shots ---------------------------------------------------------------------------
// ONCE[act] is a list of { name, every: [min, max] seconds, at: [x, y, z] | null, reach, level,
// when(state) -> 0..1 (how likely/loud now; default 1), play(c, out, t, rate) }. `at` null: from
// outside (a siren); its reach is how far it carries into the room, so it never fades by distance.
const tone = (c, out, t, f0, f1, dur, level, type = 'sine') => {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level, t + Math.min(0.01, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
};
const burst = (c, out, n, t, freq, q, dur, level, type = 'bandpass') => {
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = n; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
};

let tock = 0;
const CLOCK = { name: 'clock-tick', every: [1, 1], at: [1.8, 1.1, 7.4], reach: 2.6, level: 0.05, play(c, out, t, n) {   // tick, a slightly lower tock
  tock ^= 1; burst(c, out, n, t, tock ? 2400 : 2000, 4, 0.018, 1, 'bandpass'); tone(c, out, t, tock ? 1500 : 1250, 900, 0.03, 0.5);
} };
const CHIME = { name: 'wind-chime', every: [40, 80], at: [3.2, 1.4, 0.2], reach: 5, level: 0.045, play(c, out, t) {   // a few soft, ringing notes
  const notes = [1046.5, 1174.7, 1318.5, 1568, 1760];
  for (let i = 0, k = 2 + Math.floor(Math.random() * 3); i < k; i++) {
    const f = notes[Math.floor(Math.random() * notes.length)], at = t + i * (0.18 + Math.random() * 0.25);
    tone(c, out, at, f, f * 0.998, 2.2, 0.55); tone(c, out, at, f * 2.76, f * 2.76, 0.7, 0.12);
  }
} };
const SIREN = { name: 'far-siren', every: [70, 140], at: null, reach: 1, level: 0.03, play(c, out, t) {   // far below, two slow wails
  const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 900;
  o.type = 'sawtooth'; for (let i = 0; i < 4; i++) o.frequency.linearRampToValueAtTime(i % 2 ? 640 : 880, t + 1 + i * 2);
  o.frequency.setValueAtTime(640, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + 2); g.gain.linearRampToValueAtTime(0.0001, t + 9);
  o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + 9.1);
} };
const FRIDGE_KICK = { name: 'fridge-kick', every: [45, 90], at: [4.8, 0.9, 2.2], reach: 6, level: 0.09, play(c, out, t) {   // the compressor clunking on
  tone(c, out, t, 120, 70, 0.22, 0.7); tone(c, out, t, 54, 54, 6, 0.35);
} };
const PIPE = { name: 'pipe-knock', every: [60, 120], at: [1.4, 1.2, 5.6], reach: 8, level: 0.08, play(c, out, t, n) {   // two knocks in the wall
  for (let i = 0; i < 2; i++) { tone(c, out, t + i * 0.34, 170, 110, 0.18, 0.8); burst(c, out, n, t + i * 0.34, 420, 1.2, 0.08, 0.6, 'lowpass'); }
} };
const DRIP = { name: 'tub-drip', every: [3.5, 8], at: [0.8, 0.5, 7.3], reach: 4.5, level: 0.07, play(c, out, t) {   // one drop into the tub
  tone(c, out, t, 1500, 650, 0.07, 0.8); tone(c, out, t + 0.012, 3100, 1500, 0.04, 0.2);
} };
const CREAK = { name: 'house-creak', every: [50, 110], at: null, reach: 1, level: 0.04, play(c, out, t, n) {   // the building settling
  const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 180; f.Q.value = 6;
  o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(48, t + 0.9);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.8, t + 0.25); g.gain.linearRampToValueAtTime(0.0001, t + 1);
  o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + 1.05);
} };
// act 4's birds arrive as the sun rises: none at first, a busy dawn chorus by the end of the night
const BIRDS = { name: 'dawn-birds', every: [3, 14], at: [2.4, 1.4, 0.15], reach: 9, level: 0.035,
  when: (s) => Math.max(0, (s.dawn - 0.25) / 0.75),
  play(c, out, t) {
    const base = 3200 + Math.random() * 1800;
    for (let i = 0, k = 2 + Math.floor(Math.random() * 4); i < k; i++) { const at = t + i * 0.13; tone(c, out, at, base, base * (1.15 + Math.random() * 0.3), 0.09, 0.7); tone(c, out, at + 0.045, base * 1.3, base * 0.9, 0.06, 0.3); }
  } };
// far thunder in act 1's rain: a long low roll, no flash
const THUNDER = { name: 'far-thunder', every: [50, 110], at: null, reach: 1, level: 0.05, play(c, out, t, n) {
  burst(c, out, n, t, 90, 0.7, 3.5, 1, 'lowpass'); burst(c, out, n, t + 0.4, 160, 0.9, 2.2, 0.6, 'lowpass');
} };
export const ONCE = {
  1: [CHIME, FRIDGE_KICK, SIREN, PIPE, THUNDER],
  2: [CLOCK, DRIP, PIPE, CREAK],
  3: [CREAK, { ...SIREN, every: [110, 200], level: 0.02 }],
  4: [CHIME, FRIDGE_KICK, { ...SIREN, when: (s) => (s.dawn > 0.6 ? 0.5 : 1) }, BIRDS],
};

// ---- the level -------------------------------------------------------------------------------
// How loud the bed is now, 0..1 of its level: quiet under a fight, quieter under a Boss, silent in
// the Encore's arena. `s`: { off, boss, intensity, paused } (run.ambienceState()).
export function ambienceLevel(s) {
  if (!s || s.off) return 0;
  const duck = LOOK.num('ambience-duck', 0.45), boss = LOOK.num('ambience-boss', 0.25), hold = LOOK.num('ambience-hold', 0.6);
  if (s.boss) return boss;
  const fight = Math.min(1, Math.max(0, ((s.intensity ?? 0) - 0.25) / 0.5));   // the bugs close in: the room tone steps back
  return (s.paused ? hold : 1) * (1 - (1 - duck) * fight);
}

// a small seeded generator of its own: the rolls are never Math.random's, so a story's seeded run is the same
let seed = 0x1b873593;
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ---- the player -------------------------------------------------------------------------------
export class Ambience {
  // ctx: the audio context; master: where it plays (the Sound setting is its volume)
  constructor(ctx, master) {
    this.ctx = ctx;
    this.bus = ctx.createGain(); this.bus.gain.value = 0; this.bus.connect(master);
    this.noise = null;       // a few seconds of brown noise the layers share
    this.act = 0;            // the act whose bed is built now (0: none)
    this.layers = [];
    this.level = 0;          // the level asked for
    this.quiet = 0;          // seconds the room has been off
    this.next = [];          // when each one-shot of this act is next due (audio time)
    this.fired = [];         // the log of one-shots played (stories)
  }

  // brown noise (each sample drifts from the last): warm, with no ticks, 4 s so it never reads as a loop
  makeNoise() {
    const c = this.ctx, n = c.createBuffer(1, Math.floor(c.sampleRate * 4), c.sampleRate), d = n.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (rnd() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const lean = d[d.length - 1] - d[0];   // the ends meet: no click at the loop point
    for (let i = 0; i < d.length; i++) d[i] -= lean * i / d.length;
    return n;
  }

  // build an act's bed (fading the last one out); act 0 puts the room away
  setAct(act) {
    if (act === this.act) return;
    const c = this.ctx, t = c.currentTime;
    for (const L of this.layers) L.stop(t + 0.1);
    this.layers = []; this.act = act; this.next = [];
    if (!act || !BEDS[act]) return;
    this.noise ||= this.makeNoise();
    for (const make of BEDS[act]) this.layers.push(make(c, this.bus, this.noise));
    // an 'every' that starts a little in: no one-shot lands the instant an act begins
    this.next = (ONCE[act] || []).map((e) => t + 1 + e.every[0] * (0.3 + 0.7 * rnd()));
  }

  // each frame. state: { act, dawn (0..1), off, boss, intensity, paused }; listener: { x, z, rx, rz }
  // (where the jelly is, and the camera's right in the floor plane, for left/right).
  update(dt, state, listener, muted = false) {
    const c = this.ctx;
    const fade = LOOK.num('ambience-fade', 1.5), on = !!state && !state.off && !muted;
    this.level = on ? ambienceLevel(state) * LOOK.num('ambience-level', 1) : 0;
    this.bus.gain.setTargetAtTime(this.level, c.currentTime, fade / 3);
    if (!on) {   // faded out: put the layers away (a room with no sound costs no audio work)
      this.quiet += dt;
      if (this.quiet > fade * 1.5) this.setAct(0);
      return;
    }
    this.quiet = 0;
    this.setAct(state.act);
    if (this.level < 0.01) return;
    const t = c.currentTime, list = ONCE[this.act] || [];
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (t < this.next[i]) continue;
      this.next[i] = t + e.every[0] + (e.every[1] - e.every[0]) * rnd();
      const k = e.when ? e.when(state) : 1;
      if (k > 0 && (k >= 1 || rnd() < k)) this.once(e, listener, k);
    }
  }

  // play one one-shot now (stories call it directly): placed at e.at, quieter the further the jelly is
  once(e, listener = null, k = 1) {
    if (typeof e === 'string') e = (ONCE[this.act] || []).find((x) => x.name === e);
    if (!e) return false;
    const c = this.ctx;
    let near = 1, pan = 0;
    if (e.at && listener) {
      const dx = e.at[0] - listener.x, dz = e.at[2] - listener.z, d = Math.hypot(dx, dz);
      near = Math.max(0, 1 - d / e.reach); near *= near;
      pan = d > 0.05 ? Math.max(-0.8, Math.min(0.8, (dx * listener.rx + dz * listener.rz) / Math.max(d, 1) * 0.9)) : 0;
    }
    if (near < 0.01) return false;   // too far to hear: make nothing
    const g = c.createGain(); g.gain.value = e.level * near * k * LOOK.num('ambience-once', 1);
    let tail = g;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); tail = p; }
    tail.connect(this.bus);
    this.noise ||= this.makeNoise();
    e.play(c, g, c.currentTime + 0.02, this.noise);
    this.fired.push({ name: e.name, near, pan });
    if (this.fired.length > 64) this.fired.shift();
    return true;
  }
}
