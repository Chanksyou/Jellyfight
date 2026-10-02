// The soundtrack: adaptive music synthesized live with Web Audio (no files), in the spirit of Risk
// of Rain 2: odd time signatures, glassy arpeggios over warm pads, a chunky synth bass, and drums
// and a distorted "guitar" lead that build in as the fight heats up.
//
//   drift       "Puddle Drift", exploring, after Shpongle's "Nothing Is Something Worth Doing".
//               D Phrygian dominant, 4/4 at 124 BPM. Layers come in with intensity: drone, then a
//               plucked guitar, hand drums, the rolling psy bass, kick and hats, the full groove
//               with laser zaps, and a flute on top.
//   machinery   "Domestic Machinery", the Vacuum. E Phrygian, 5/4 at 150 BPM: a chugging bass in
//               3+3+4 accents, driving drums, and the lead once the fight gets desperate.
//
// Intensity (0..1) is set by the game (run.js musicState: bugs close by, elites, how late the
// night is, the boss's health); each layer fades in or out at the start of a bar, so changes
// always land on the beat. The same code renders offline (tools/music.mjs) for previews.
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// --------------------------------------------------------------------------- the songs
// chords: { pad: [midi], arp: [midi], root: midi } each `per` bars; lead: [bar, step, midi, steps]
// Inspired by Shpongle's "Nothing Is Something Worth Doing": psychedelic, a little Middle-Eastern.
// D Phrygian dominant (Hijaz: D Eb F# G A Bb C), 4/4 at 124 BPM. Over a deep drone, a flamenco-ish
// plucked guitar, tabla-style hand drums, a rolling psytrance bass (kick on the beat, bass on the
// three 16ths after it), swirling laser zaps through the delay, and an airy flute that slides
// between notes.
const DRIFT = {
  name: 'Puddle Drift', bpm: 124, steps: 16, per: 2, flute: true, arpWave: 'sawtooth',
  layers: { pad: -1, arp: 0.1, perc: 0.22, bass: 0.36, drums: 0.5, full: 0.66, lead: 0.74 },
  chords: [
    { pad: [38, 50, 57, 62], arp: [62, 66, 69, 74, 75], root: 38 },   // D (Hijaz home)
    { pad: [39, 51, 58, 63], arp: [63, 67, 70, 75, 74], root: 39 },   // Eb (the b2 lean)
    { pad: [38, 50, 57, 62], arp: [62, 66, 69, 74, 78], root: 38 },   // D
    { pad: [36, 48, 55, 63], arp: [60, 63, 67, 72, 74], root: 36 },   // Cm (bVII minor, back down)
  ],
  arp: [0, 3, 2, 3, 1, 3, 2, 3, 0, 3, 2, 3, 4, 3, 2, 1],                 // a flamenco-ish tremolo figure
  // tabla: [step, 'dha' (low) | 'tin' (high) | 'ta' (sharp)]
  tabla: [[0, 'dha'], [3, 'tin'], [6, 'tin'], [8, 'dha'], [10, 'ta'], [11, 'tin'], [14, 'tin']],
  lead: [
    [0, 0, 81, 6], [0, 6, 82, 2], [0, 8, 81, 4], [0, 12, 79, 2], [0, 14, 78, 2],
    [1, 0, 79, 4], [1, 4, 78, 2], [1, 6, 75, 2], [1, 8, 74, 8],
    [2, 0, 75, 2], [2, 2, 78, 2], [2, 4, 79, 4], [2, 8, 81, 6], [2, 14, 82, 2],
    [3, 0, 81, 10], [3, 10, 79, 2], [3, 12, 78, 4],
    [4, 0, 86, 6], [4, 6, 84, 2], [4, 8, 82, 4], [4, 12, 81, 4],
    [5, 0, 82, 3], [5, 3, 81, 3], [5, 6, 79, 2], [5, 8, 78, 8],
    [6, 0, 79, 2], [6, 2, 81, 2], [6, 4, 82, 2], [6, 6, 84, 2], [6, 8, 86, 4], [6, 12, 87, 4],
    [7, 0, 86, 12], [7, 12, 81, 4],
  ],
  tick(m, s, bar, t, L) {
    const C = this.chords[Math.floor(bar / this.per) % this.chords.length], dur = m.stepDur;
    if (s === 0 && bar % this.per === 0) m.pad(C.pad, t, dur * this.steps * this.per + 0.4, 0.03, 380 + 1500 * m.I);
    if (L.arp) m.pluck(C.arp[this.arp[s]], t, 0.045 * L.arp, 0.35 + 0.5 * m.I, s % 4 < 2 ? -0.35 : 0.35);
    if (L.perc) for (const [st, k] of this.tabla) if (st === s) m.tabla(k, t, 0.16 * L.perc);
    // the psy gallop: kick on the beat, the bass on the three 16ths after it
    if (L.bass && s % 4) m.bass(C.root + (s % 16 === 15 && bar % 2 ? 12 : 0), t, dur * 0.7, 0.15 * L.bass, 0.3 + 0.45 * m.I);
    if (L.drums && s % 4 === 0) m.kick(t, 0.55 * L.drums);
    // the offbeat open hat, and with the full groove a shaker on every 16th (one hit a step)
    const open = s % 4 === 2;
    const hat = Math.max(open ? 0.05 * L.drums : 0, L.full ? (s % 2 ? 0.018 : 0.012) * L.full : 0);
    if (hat > 0.008) m.hat(t, hat, open && L.drums > 0);
    if (L.full) {
      if (s === 4 || s === 12) m.snare(t, 0.13 * L.full);
      if (s === 0 && bar % 8 === 0) m.crash(t, 0.1 * L.full);
      if (s === 10 && bar % 4 === 3) m.zap(t, 0.05 * L.full);                  // psychedelic lasers
    }
    if (L.lead) for (const [b, st, n, len] of this.lead) if (b === bar % 8 && st === s) m.lead(n, t, dur * len, 0.085 * L.lead);
  },
};

const MACHINERY = {
  name: 'Domestic Machinery', bpm: 150, steps: 20, per: 2, hardBass: true,
  layers: { pad: -1, arp: -1, bass: -1, drums: -1, full: 0.72, lead: 0.8 },
  chords: [
    { pad: [52, 59, 64, 67], arp: [76, 79, 83, 88], root: 28 },   // Em
    { pad: [53, 60, 65, 69], arp: [77, 81, 84, 89], root: 29 },   // F (the Phrygian b2)
    { pad: [48, 55, 60, 64], arp: [72, 76, 79, 84], root: 24 },   // C
    { pad: [47, 54, 59, 63], arp: [71, 75, 78, 83], root: 23 },   // B (the sharp turn home)
  ],
  accents: new Set([0, 3, 6, 10, 13, 16]),                          // 3+3+4+3+3+4
  lead: [
    [0, 0, 76, 3], [0, 3, 77, 3], [0, 6, 79, 4], [0, 10, 77, 3], [0, 13, 76, 3], [0, 16, 71, 4],
    [1, 0, 76, 10], [1, 10, 74, 3], [1, 13, 72, 3], [1, 16, 71, 4],
    [2, 0, 77, 3], [2, 3, 79, 3], [2, 6, 81, 4], [2, 10, 79, 3], [2, 13, 77, 3], [2, 16, 72, 4],
    [3, 0, 81, 10], [3, 10, 79, 6], [3, 16, 77, 4],
    [4, 0, 79, 6], [4, 6, 81, 4], [4, 10, 83, 6], [4, 16, 84, 4],
    [5, 0, 83, 10], [5, 10, 81, 5], [5, 15, 79, 5],
    [6, 0, 78, 6], [6, 6, 81, 4], [6, 10, 83, 6], [6, 16, 87, 4],
    [7, 0, 83, 12], [7, 12, 78, 4], [7, 16, 75, 4],
  ],
  tick(m, s, bar, t, L) {
    const C = this.chords[Math.floor(bar / this.per) % this.chords.length], dur = m.stepDur;
    if (s === 0 && bar % this.per === 0) m.pad(C.pad, t, dur * this.steps * this.per + 0.3, 0.03, 500 + 1500 * m.I);
    // the chug: accents on the root, the 16ths between muted and low
    const acc = this.accents.has(s);
    if (acc || L.full) m.bass(C.root + 12, t, dur * (acc ? 1.6 : 0.7), (acc ? 0.2 : 0.07) * L.bass, acc ? 0.9 : 0.35);
    if (s % 2 === 0) m.pluck(C.arp[(s / 2) % 4] + (bar % 2 ? 0 : -12), t, 0.035 * L.arp, 0.8, (s / 2) % 2 ? 0.5 : -0.5);
    if (acc) m.kick(t, 0.55 * L.drums);
    if (s === 4 || s === 12 || (L.full && s === 18)) m.snare(t, (s === 18 ? 0.12 : 0.26) * L.drums);
    m.hat(t, (s % 4 === 0 ? 0.05 : 0.03) * L.drums, s === 8 && L.full > 0);
    if (s === 0 && bar % 4 === 0) m.crash(t, 0.13 * L.drums);
    if (L.lead) for (const [b, st, n, len] of this.lead) if (b === bar % 8 && st === s) m.lead(n, t, m.stepDur * len, 0.075 * L.lead);
  },
};

export const SONGS = { drift: DRIFT, machinery: MACHINERY };

// --------------------------------------------------------------------------- the engine
export class Music {
  // ctx: an AudioContext (or OfflineAudioContext); dest: where the music goes
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);
    this.tone = ctx.createBiquadFilter();               // the duck: muffles the music behind menus
    this.tone.type = 'lowpass';
    this.tone.frequency.value = 18000;
    this.tone.connect(this.out);
    this.bus = ctx.createGain();
    this.bus.connect(this.tone);
    // a hall reverb (a generated impulse) and a ping-pong delay, shared by everything
    this.rev = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.buffer = this.impulse(1.8);
    this.rev.connect(conv).connect(this.tone);
    this.dly = ctx.createGain();
    for (const [time, pan] of [[0.43, -0.6], [0.29, 0.6]]) {
      const d = ctx.createDelay(1), fb = ctx.createGain(), f = ctx.createBiquadFilter(), p = ctx.createStereoPanner();
      d.delayTime.value = time; fb.gain.value = 0.38; f.type = 'lowpass'; f.frequency.value = 2800; p.pan.value = pan;
      this.dly.connect(d); d.connect(f).connect(fb).connect(d); f.connect(p).connect(this.tone); f.connect(this.rev);
    }
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const n = this.noise.getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
    this.drive = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; this.drive[i] = Math.tanh(x * 3.2) * 0.8; }
    this.song = null;
    this.I = 0;                // intensity now (smoothed)
    this.target = 0;
    this.L = {};
    this.volume = 0.32;
  }

  impulse(sec) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    return b;
  }

  get stepDur() { return 60 / this.song.bpm / 4; }

  // start a song (or null for silence), fading over `fade` s; a new song starts on its first bar
  play(name, fade = 1.5) {
    const now = this.ctx.currentTime, song = name ? SONGS[name] : null;
    if (song === this.song) return;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    if (!song) { this.out.gain.linearRampToValueAtTime(0, now + fade); this.v?.stop(now + fade + 0.1); this.v = null; this.song = null; return; }
    const swap = !!this.song;
    if (swap) this.out.gain.linearRampToValueAtTime(0, now + 0.5);
    this.v?.stop(now + (swap ? 0.55 : 0.05));
    this.v = this.voices(song);
    this.song = song;
    this.step = 0;
    this.nextT = now + (swap ? 0.55 : 0.08);
    this.out.gain.linearRampToValueAtTime(this.volume, this.nextT + (swap ? 0.3 : fade));
  }

  // behind a menu: muffled and quieter
  duck(on) {
    const now = this.ctx.currentTime;
    this.tone.frequency.setTargetAtTime(on ? 700 : 18000, now, 0.25);
  }

  // schedule every step that starts before `until` (seconds, on the audio clock)
  schedule(until) {
    if (!this.song) return;
    const S = this.song;
    while (this.nextT < until) {
      const s = this.step % S.steps, bar = Math.floor(this.step / S.steps);
      if (s === 0) for (const [k, th] of Object.entries(S.layers)) this.L[k] = th < 0 ? 1 : clamp01((this.I - th) / 0.1);   // layers change on the bar
      S.tick(this, s, bar, this.nextT, this.L);
      this.nextT += this.stepDur;
      this.step++;
    }
  }

  // realtime: called every frame with the intensity the game wants
  update(dt, target) {
    if (target != null) this.target = target;
    this.I += (this.target - this.I) * (1 - Math.exp(-dt / 3));       // eases over a few seconds
    this.schedule(this.ctx.currentTime + 0.3);
  }

  // ------------------------------------------------------------------------- instruments
  env(g, t, a, peak, d, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.setValueAtTime(Math.max(0.0002, peak), t + Math.max(a, d));
    g.gain.exponentialRampToValueAtTime(0.0001, end);
  }

  // warm pad: detuned saws through a soft lowpass, slow in and out
  pad(notes, t, dur, vol, cutoff) {
    const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.6;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 1.2);
    g.gain.setValueAtTime(vol, t + dur - 1.2);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.8);
    f.connect(g); g.connect(this.bus); g.connect(this.rev);
    notes.forEach((n, i) => {
      const o = c.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = i % 2 ? 9 : -9;   // spread across the chord: wide without doubling every voice
      o.connect(f); o.start(t); o.stop(t + dur + 0.9);
    });
  }

  // glassy pluck (the arpeggio): a square through a closing filter, bouncing left and right into
  // the delay; one voice, retriggered every note like a hardware arpeggiator
  pluck(n, t, vol, bright, pan = 0) {
    if (vol <= 0.0005 || !this.v) return;
    const A = this.v.arp;
    A.o.frequency.setValueAtTime(mtof(n), t);
    A.p.pan.setValueAtTime(pan, t);
    A.f.frequency.cancelScheduledValues(t);
    A.f.frequency.setValueAtTime(900 + 4200 * bright, t);
    A.f.frequency.exponentialRampToValueAtTime(500, t + 0.2);
    A.g.gain.cancelScheduledValues(t);
    A.g.gain.setValueAtTime(0.0001, t);
    A.g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    A.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  }

  // The bass and the lead are monophonic, like a player on one string: one voice each that runs
  // the whole song, its pitch and envelopes moved for every note (far cheaper than new
  // oscillators per note, and the lead slides between notes)
  // song.hardBass: drive the bass (the boss); song.flute: the lead is a breathy flute, not a
  // distorted guitar; song.arpWave: the arpeggio's waveform
  voices(song) {
    const c = this.ctx, t = c.currentTime, hard = !!song.hardBass, flute = !!song.flute;
    const bass = { f: c.createBiquadFilter(), g: c.createGain(), o: [] };
    bass.f.type = 'lowpass'; bass.f.Q.value = 3;
    bass.g.gain.value = 0;
    let head = bass.f;
    if (hard) { const w = c.createWaveShaper(); w.curve = this.drive; bass.f.connect(w); head = w; }
    head.connect(bass.g).connect(this.bus);
    for (const [type, mul, v] of [['sawtooth', 1, 1], ['sine', 0.5, 1.4]]) {
      const o = c.createOscillator(), og = c.createGain();
      o.type = type; og.gain.value = v; o.connect(og).connect(bass.f); o.start(t);
      bass.o.push([o, mul]);
    }
    const lead = { f: c.createBiquadFilter(), g: c.createGain(), o: [], depth: c.createGain(), lfo: c.createOscillator() };
    // the guitar goes through the distortion; the flute is clean, with breath noise in it
    const w = flute ? c.createGain() : c.createWaveShaper();
    if (!flute) w.curve = this.drive;
    lead.f.type = 'lowpass'; lead.f.frequency.value = flute ? 5000 : 3000; lead.f.Q.value = 1;
    lead.g.gain.value = 0;
    w.connect(lead.f).connect(lead.g);
    lead.g.connect(this.bus); lead.g.connect(this.dly); lead.g.connect(this.rev);
    lead.vib = flute ? 18 : 14;
    lead.glide = flute ? 0.035 : 0.012;
    lead.lfo.frequency.value = flute ? 5 : 5.5; lead.lfo.connect(lead.depth); lead.depth.gain.value = 0; lead.lfo.start(t);
    for (const [type, det, v] of flute ? [['triangle', -4, 0.7], ['sine', 4, 0.9]] : [['sawtooth', -9, 1], ['sawtooth', 9, 1]]) {
      const o = c.createOscillator(), og = c.createGain();
      o.type = type; o.detune.value = det; og.gain.value = v; lead.depth.connect(o.detune); o.connect(og).connect(w); o.start(t);
      lead.o.push(o);
    }
    if (flute) {
      const br = c.createBufferSource(), bf = c.createBiquadFilter(), bg = c.createGain();
      br.buffer = this.noise; br.loop = true;
      bf.type = 'bandpass'; bf.frequency.value = 2200; bf.Q.value = 0.8; bg.gain.value = 0.25;
      br.connect(bf).connect(bg).connect(w); br.start(t);
      lead.o.push(br);
    }
    const arp = { o: c.createOscillator(), f: c.createBiquadFilter(), g: c.createGain(), p: c.createStereoPanner() };
    arp.o.type = song.arpWave || 'square'; arp.f.type = 'lowpass'; arp.f.Q.value = song.arpWave ? 1.2 : 4; arp.g.gain.value = 0;
    arp.o.connect(arp.f).connect(arp.g).connect(arp.p);
    arp.p.connect(this.bus); arp.p.connect(this.dly);
    arp.o.start(t);
    return { bass, lead, arp, stop: (at) => { for (const [o] of bass.o) o.stop(at); for (const o of lead.o) o.stop(at); lead.lfo.stop(at); arp.o.stop(at); } };
  }

  // synth bass: saw + sine sub; dirt opens the filter
  bass(n, t, dur, vol, dirt) {
    if (vol <= 0.0005 || !this.v) return;
    const B = this.v.bass;
    for (const [o, mul] of B.o) o.frequency.setValueAtTime(mtof(n) * mul, t);
    B.f.frequency.cancelScheduledValues(t);
    B.f.frequency.setValueAtTime(250 + 1600 * dirt, t);
    B.f.frequency.exponentialRampToValueAtTime(160 + 300 * dirt, t + Math.min(dur, 0.25));
    B.g.gain.cancelScheduledValues(t);
    B.g.gain.setValueAtTime(0.0001, t);
    B.g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    B.g.gain.setValueAtTime(vol, t + dur * 0.8);
    B.g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
  }

  // the lead: two detuned saws, distorted like a guitar, sliding into each note, vibrato swelling
  // in on held ones, into the delay and reverb
  lead(n, t, dur, vol) {
    if (!this.v) return;
    const L = this.v.lead, f = mtof(n);
    for (const o of L.o) if (o.frequency) { o.frequency.cancelScheduledValues(t); o.frequency.setTargetAtTime(f, t, L.glide); }
    L.depth.gain.cancelScheduledValues(t);
    L.depth.gain.setValueAtTime(0, t);
    L.depth.gain.linearRampToValueAtTime(L.vib, t + Math.min(0.5, dur));
    L.g.gain.cancelScheduledValues(t);
    L.g.gain.setTargetAtTime(vol, t, 0.01);
    L.g.gain.setTargetAtTime(0.0001, t + dur, 0.05);
  }

  noiseHit(t, type, freq, q, dur, vol, rev = 0) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    this.env(g, t, 0.002, vol, 0.002, t + dur);
    s.connect(f).connect(g).connect(this.bus);
    if (rev) { const r = c.createGain(); r.gain.value = rev; g.connect(r).connect(this.rev); }
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  kick(t, vol) {
    if (vol <= 0.0005) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this.env(g, t, 0.002, vol, 0.03, t + 0.38);
    o.connect(g).connect(this.bus);
    o.start(t); o.stop(t + 0.4);
    this.noiseHit(t, 'highpass', 3000, 0.7, 0.012, vol * 0.25);
  }

  snare(t, vol) {
    if (vol <= 0.0005) return;
    this.noiseHit(t, 'bandpass', 1900, 0.8, 0.2, vol, 0.25);
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    this.env(g, t, 0.002, vol * 0.6, 0.01, t + 0.1);
    o.connect(g).connect(this.bus);
    o.start(t); o.stop(t + 0.12);
  }

  // hand drums: a tuned skin that bends down as it rings: dha (low, bassy), tin (high, ringing), ta (sharp)
  tabla(kind, t, vol) {
    if (vol <= 0.0005) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    const [f0, f1, dur] = { dha: [190, 95, 0.32], tin: [620, 560, 0.22], ta: [880, 700, 0.07] }[kind];
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
    this.env(g, t, 0.002, vol, 0.004, t + dur);
    o.connect(g).connect(this.bus);
    o.start(t); o.stop(t + dur + 0.02);
    this.noiseHit(t, 'bandpass', kind === 'dha' ? 900 : 3200, 1.5, 0.025, vol * 0.5, 0.1);   // the slap of the fingers
  }

  // a psychedelic laser: a resonant saw diving from high to low, panning across, into the delay
  zap(t, vol) {
    const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), p = c.createStereoPanner();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(1400, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.9);
    f.type = 'bandpass'; f.Q.value = 9;
    f.frequency.setValueAtTime(4000, t);
    f.frequency.exponentialRampToValueAtTime(250, t + 0.9);
    p.pan.setValueAtTime(-0.8, t);
    p.pan.linearRampToValueAtTime(0.8, t + 0.9);
    this.env(g, t, 0.01, vol, 0.3, t + 0.95);
    o.connect(f).connect(g).connect(p);
    p.connect(this.bus); p.connect(this.dly);
    o.start(t); o.stop(t + 1);
  }

  hat(t, vol, open) { if (vol > 0.0005) this.noiseHit(t, 'highpass', 7500, 0.8, open ? 0.25 : 0.04, vol); }
  crash(t, vol) { if (vol > 0.0005) this.noiseHit(t, 'highpass', 4200, 0.5, 1.8, vol, 0.5); }
}
