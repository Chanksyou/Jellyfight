// The soundtrack: adaptive music synthesized live with Web Audio (no files), in the spirit of Risk
// of Rain 2: odd time signatures, glassy arpeggios over warm pads, a chunky synth bass, and drums
// and a distorted "guitar" lead that build in as the fight heats up.
//
//   drift       "Puddle Drift", exploring. D Dorian, 7/8 (2+2+3) at 104 BPM. Layers come in with
//               intensity: pad, then arpeggio, bass, drums, full drums, and the lead on top.
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
const DRIFT = {
  name: 'Puddle Drift', bpm: 104, steps: 14, per: 2,
  layers: { pad: -1, arp: 0.12, bass: 0.32, drums: 0.48, full: 0.68, lead: 0.8 },
  chords: [
    { pad: [50, 53, 57, 60, 64], arp: [62, 65, 69, 72, 76], root: 38 },   // Dm9
    { pad: [46, 53, 57, 62, 64], arp: [62, 65, 69, 70, 76], root: 34 },   // Bbmaj7(#11)
    { pad: [48, 53, 57, 60, 64], arp: [60, 65, 69, 72, 77], root: 41 },   // Fmaj7
    { pad: [43, 50, 57, 60, 64], arp: [62, 67, 69, 72, 74], root: 43 },   // G6sus (Dorian's bright IV)
  ],
  arp: [0, 2, 4, 1, 3, 0, 2, 4, 1, 3, 0, 2, 4, 3],                         // which chord tone, each 16th
  lead: [
    [0, 0, 69, 6], [0, 6, 72, 2], [0, 8, 74, 6],
    [1, 0, 76, 4], [1, 4, 74, 2], [1, 6, 72, 2], [1, 8, 69, 6],
    [2, 0, 77, 6], [2, 6, 76, 2], [2, 8, 74, 3], [2, 11, 72, 3],
    [3, 0, 74, 10], [3, 10, 69, 4],
    [4, 0, 72, 4], [4, 4, 74, 2], [4, 6, 76, 2], [4, 8, 77, 6],
    [5, 0, 79, 6], [5, 6, 77, 2], [5, 8, 76, 6],
    [6, 0, 74, 4], [6, 4, 76, 4], [6, 8, 79, 3], [6, 11, 81, 3],
    [7, 0, 81, 8], [7, 8, 79, 3], [7, 11, 76, 3],
  ],
  tick(m, s, bar, t, L) {
    const C = this.chords[Math.floor(bar / this.per) % this.chords.length], dur = m.stepDur;
    if (s === 0 && bar % this.per === 0) m.pad(C.pad, t, dur * this.steps * this.per + 0.4, 0.034, 600 + 1700 * m.I);
    if (L.arp) m.pluck(C.arp[this.arp[s]] + (s % 7 === 6 ? 12 : 0), t, 0.05 * L.arp, 0.5 + 0.5 * m.I, s % 2 ? 0.45 : -0.45);
    if (L.bass) {
      const B = { 0: [0, 3], 4: [0, 3], 8: [0, 2], 10: [7, 2], 12: [12, 2] }[s];
      if (B) m.bass(C.root + B[0], t, dur * B[1] * 0.9, 0.16 * L.bass, 0.25 + 0.4 * m.I);
    }
    if (L.drums) {
      if (s === 0 || s === 8 || (L.full && s === 6)) m.kick(t, 0.5 * L.drums);
      if (s === 4 || s === 11) m.snare(t, 0.22 * L.drums);
      if (s % 2 === 0) m.hat(t, (s === 0 ? 0.05 : 0.035) * L.drums, false);
      if (L.full && s % 2 === 1) m.hat(t, 0.02 * L.full, false);
      if (L.full && s === 13) m.snare(t, 0.07 * L.full);
      if (L.full && s === 0 && bar % 8 === 0) m.crash(t, 0.12 * L.full);
    }
    if (L.lead) for (const [b, st, n, len] of this.lead) if (b === bar % 8 && st === s) m.lead(n, t, dur * len, 0.07 * L.lead);
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
    this.v = this.voices(!!song.hardBass);
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
  voices(hard) {
    const c = this.ctx, t = c.currentTime;
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
    const w = c.createWaveShaper();
    w.curve = this.drive;
    lead.f.type = 'lowpass'; lead.f.frequency.value = 3000; lead.f.Q.value = 1;
    lead.g.gain.value = 0;
    w.connect(lead.f).connect(lead.g);
    lead.g.connect(this.bus); lead.g.connect(this.dly); lead.g.connect(this.rev);
    lead.lfo.frequency.value = 5.5; lead.lfo.connect(lead.depth); lead.depth.gain.value = 0; lead.lfo.start(t);
    for (const det of [-9, 9]) {
      const o = c.createOscillator();
      o.type = 'sawtooth'; o.detune.value = det; lead.depth.connect(o.detune); o.connect(w); o.start(t);
      lead.o.push(o);
    }
    const arp = { o: c.createOscillator(), f: c.createBiquadFilter(), g: c.createGain(), p: c.createStereoPanner() };
    arp.o.type = 'square'; arp.f.type = 'lowpass'; arp.f.Q.value = 4; arp.g.gain.value = 0;
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
    for (const o of L.o) { o.frequency.cancelScheduledValues(t); o.frequency.setTargetAtTime(f, t, 0.012); }
    L.depth.gain.cancelScheduledValues(t);
    L.depth.gain.setValueAtTime(0, t);
    L.depth.gain.linearRampToValueAtTime(14, t + Math.min(0.5, dur));
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

  hat(t, vol, open) { if (vol > 0.0005) this.noiseHit(t, 'highpass', 7500, 0.8, open ? 0.25 : 0.04, vol); }
  crash(t, vol) { if (vol > 0.0005) this.noiseHit(t, 'highpass', 4200, 0.5, 1.8, vol, 0.5); }
}
