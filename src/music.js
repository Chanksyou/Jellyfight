// The soundtrack: adaptive music synthesized live with Web Audio (no files), in the spirit of Risk
// of Rain 2: odd time signatures, glassy arpeggios over warm pads, a chunky synth bass, and drums
// and a distorted "guitar" lead that build in as the fight heats up.
//
//   drift       "Puddle Drift", exploring, after Daft Punk's Tron: Legacy score: C minor, 4/4 at
//               100 BPM, dark and low. Layers come in with intensity: string pads, then the
//               sequenced analog bass, a slow arpeggio, deep drums, toms and booms, and a low
//               brass lead on top.
//   machinery   "Domestic Machinery", the Vacuum, after deadmau5's "HR 8938 Cephei" with a dubby
//               twist: F minor, 4/4 at 128 BPM, pumping supersaw chords, a wobbling reese bass,
//               risers, and a supersaw lead once the fight gets desperate.
//
// Intensity (0..1) is set by the game (run.js musicState: bugs close by, elites, how late the
// night is, the boss's health); each layer fades in or out at the start of a bar, so changes
// always land on the beat. The same code renders offline (tools/music.mjs) for previews.
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// --------------------------------------------------------------------------- the songs
// chords: { pad: [midi], arp: [midi], root: midi } each `per` bars; lead: [bar, step, midi, steps]
// Inspired by Daft Punk's Tron: Legacy score: dark, low and pulsing, the weight in the bass and
// nothing sharp up top. C minor, 4/4 at 100 BPM, through Cm, Ab, Eb, Bb. A sequenced analog bass
// in 16ths (root, octave, fifth; a sine sub under every note) carries it, its filter opening as
// things heat up; dark string pads, a slow mid arpeggio, deep half-time drums with toms, and a
// low swelling brass lead. The whole mix is rolled off above ~5 kHz (air).
const DRIFT = {
  name: 'Puddle Drift', bpm: 100, steps: 16, per: 2, brass: true, sub: 1, air: 5000, arpWave: 'triangle',
  layers: { pad: -1, bass: 0.08, arp: 0.3, drums: 0.42, full: 0.62, lead: 0.74 },
  chords: [
    { pad: [48, 55, 60, 63], arp: [60, 63, 67, 70], root: 36 },   // Cm
    { pad: [44, 51, 56, 60], arp: [56, 60, 63, 67], root: 32 },   // Ab
    { pad: [46, 51, 55, 58], arp: [58, 63, 67, 70], root: 39 },   // Eb
    { pad: [46, 50, 53, 58], arp: [58, 62, 65, 69], root: 34 },   // Bb
  ],
  seq: [0, 0, 12, 0, 7, 0, 12, 0, 0, 0, 12, 0, 7, 12, 10, 7],       // the bass sequence, 16ths
  arp: [0, 1, 2, 3, 2, 1, 2, 3],                                     // 8ths, up and down
  lead: [
    [0, 0, 67, 8], [0, 8, 72, 8],
    [1, 0, 70, 6], [1, 6, 68, 2], [1, 8, 67, 8],
    [2, 0, 68, 8], [2, 8, 72, 4], [2, 12, 75, 4],
    [3, 0, 72, 12], [3, 12, 70, 4],
    [4, 0, 70, 8], [4, 8, 75, 8],
    [5, 0, 74, 6], [5, 6, 72, 2], [5, 8, 70, 8],
    [6, 0, 65, 4], [6, 4, 70, 4], [6, 8, 74, 8],
    [7, 0, 72, 16],
  ],
  tick(m, s, bar, t, L) {
    const C = this.chords[Math.floor(bar / this.per) % this.chords.length], dur = m.stepDur;
    if (s === 0 && bar % this.per === 0) m.pad(C.pad, t, dur * this.steps * this.per + 0.4, 0.042, 420 + 650 * m.I);
    // the pulse: accents on the beat, the filter opening with intensity
    if (L.bass) m.bass(C.root + this.seq[s], t, dur * 0.85, (s % 4 === 0 ? 0.15 : 0.1) * L.bass, 0.08 + 0.3 * m.I);
    if (L.arp && s % 2 === 0) m.pluck(C.arp[this.arp[(s / 2) % 8]], t, 0.05 * L.arp, 0.05 + 0.12 * m.I, (s / 2) % 2 ? 0.3 : -0.3);
    if (L.drums) {
      if (s === 0 || (L.full && (s === 6 || s === 10))) m.kick(t, 0.6 * L.drums);
      if (s === 8) m.snare(t, 0.15 * L.drums, true);
      if (bar % 4 === 3 && (s === 12 || s === 14)) m.tom(t, s === 12 ? 98 : 73, 0.3 * L.drums);
    }
    if (L.full && s === 4) m.kick(t, 0.3 * L.full);
    if (L.full && s === 0 && bar % 8 === 0) m.drop(t, 0.1 * L.full);       // a deep boom at the top of each phrase
    if (L.lead) for (const [b, st, n, len] of this.lead) if (b === bar % 8 && st === s) m.lead(n, t, dur * len, 0.08 * L.lead);
  },
};

// Inspired by deadmau5's "HR 8938 Cephei", made dubbier for a vacuum that sucks: F minor, 4/4 at
// 128 BPM. Supersaw chords that pump against the kick (sidechain), a bright pluck arpeggio whose
// filter opens as the fight goes on, a reese bass that wobbles (8ths, then 8th triplets, then
// 16ths as the Vacuum weakens), four on the floor with claps and offbeat hats, a noise riser into
// every 8th bar, and a supersaw lead for the last stretch. While it sucks, the whole mix is
// dragged through a dub filter (music.suck).
const MACHINERY = {
  name: 'Domestic Machinery', bpm: 128, steps: 16, per: 2, hardBass: true, wobble: true, pump: true, supersaw: true, arpWave: 'sawtooth',
  layers: { pad: -1, arp: -1, bass: -1, drums: -1, full: 0.7, lead: 0.8 },
  chords: [
    { pad: [53, 56, 60, 65, 68], arp: [65, 68, 72, 77, 80], root: 29 },   // Fm
    { pad: [49, 53, 56, 60, 65], arp: [61, 65, 68, 72, 77], root: 25 },   // Dbmaj7
    { pad: [48, 51, 56, 60, 63], arp: [60, 63, 68, 72, 75], root: 32 },   // Ab
    { pad: [46, 51, 55, 58, 63], arp: [63, 67, 70, 75, 79], root: 27 },   // Eb
  ],
  arp: [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 2, 3, 1, 2, 4],
  lead: [
    [0, 0, 72, 4], [0, 4, 68, 2], [0, 6, 72, 2], [0, 8, 77, 6], [0, 14, 75, 2],
    [1, 0, 77, 3], [1, 3, 79, 3], [1, 6, 80, 4], [1, 10, 79, 3], [1, 13, 75, 3],
    [2, 0, 77, 4], [2, 4, 73, 2], [2, 6, 77, 2], [2, 8, 80, 6], [2, 14, 79, 2],
    [3, 0, 80, 3], [3, 3, 82, 3], [3, 6, 84, 6], [3, 12, 82, 2], [3, 14, 80, 2],
    [4, 0, 75, 4], [4, 4, 72, 2], [4, 6, 75, 2], [4, 8, 80, 6], [4, 14, 79, 2],
    [5, 0, 77, 3], [5, 3, 75, 3], [5, 6, 72, 4], [5, 10, 75, 6],
    [6, 0, 79, 4], [6, 4, 75, 2], [6, 6, 79, 2], [6, 8, 82, 4], [6, 12, 84, 4],
    [7, 0, 85, 8], [7, 8, 84, 4], [7, 12, 80, 4],
  ],
  tick(m, s, bar, t, L) {
    const C = this.chords[Math.floor(bar / this.per) % this.chords.length], dur = m.stepDur, beat = dur * 4;
    if (s === 0 && bar % this.per === 0) m.pad(C.pad, t, dur * this.steps * this.per + 0.3, 0.036, 700 + 2600 * m.I, true);
    if (s % 4 === 0) m.pumpAt(t, beat);                                      // everything but the drums ducks under the kick
    // the pluck arp, its filter opening as the boss weakens
    m.pluck(C.arp[this.arp[s]] + (bar % 4 === 3 && s > 11 ? 12 : 0), t, 0.04, 0.2 + 0.8 * m.I, s % 2 ? 0.4 : -0.4);
    // the wobble bass: a long reese note every half bar, wobbling faster with intensity
    if (s % 8 === 0) m.bass(C.root + 12 + (s === 8 && bar % 2 ? 7 : 0), t, dur * 7.6, 0.2, 0.35 + 0.3 * m.I, m.I < 0.78 ? 2 : m.I < 0.9 ? 3 : 4);
    if (s % 4 === 0) m.kick(t, 0.6);
    if (s === 4 || s === 12) { m.snare(t, 0.2); m.clap(t, 0.16); }
    const open = s % 4 === 2;
    m.hat(t, open ? 0.055 : L.full ? (s % 2 ? 0.02 : 0.03) : 0, open);
    if (L.full && s % 4 === 0) m.hat(t, 0.025, false);                       // a ride on the beat
    if (s === 0 && bar % 8 === 0) { m.crash(t, 0.14); m.drop(t, 0.12); }
    if (s === 0 && bar % 8 === 7) m.riser(t, dur * 16, 0.07 + 0.05 * m.I);   // a noise riser into the next phrase
    if (L.full && bar % 8 === 7 && s >= 8) m.snare(t, 0.04 + 0.02 * (s - 8));  // and a snare roll building into it
    if (L.lead) for (const [b, st, n, len] of this.lead) if (b === bar % 8 && st === s) m.lead(n, t, dur * len, 0.07 * L.lead);
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
    this.bus = ctx.createGain();                         // everything but the drums: pumps under the kick (pumpAt)
    this.pump = ctx.createGain();
    this.bus.connect(this.pump).connect(this.tone);
    this.drumBus = ctx.createGain();
    this.drumBus.connect(this.tone);
    this.suckOn = false;
    this.air = 18000;
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
    this.air = song.air || 18000;                   // the song's top end
    this.tone.frequency.setTargetAtTime(this.ducked ? 700 : this.air, now, 0.3);
    this.pump.gain.cancelScheduledValues(now);
    this.pump.gain.setValueAtTime(1, now);
    this.song = song;
    this.step = 0;
    this.nextT = now + (swap ? 0.55 : 0.08);
    this.out.gain.linearRampToValueAtTime(this.volume, this.nextT + (swap ? 0.3 : fade));
  }

  // behind a menu: muffled and quieter
  duck(on) { if (on !== this.ducked) { this.ducked = on; this.filter(); } }
  // while the Vacuum sucks: the whole mix dragged through a resonant dub filter (at: when, for
  // offline previews)
  suck(on, at) { if (on !== this.suckOn) { this.suckOn = on; this.filter(at); } }
  filter(at) {
    const now = at ?? this.ctx.currentTime, T = this.tone;
    const f = this.ducked ? 700 : this.suckOn ? 480 : this.air;
    T.frequency.cancelScheduledValues(now);
    T.frequency.setTargetAtTime(f, now, this.suckOn && !this.ducked ? 0.35 : 0.25);
    T.Q.setTargetAtTime(this.suckOn && !this.ducked ? 7 : 0.7, now, 0.2);
  }

  // sidechain: duck the music (not the drums) on the kick and swell back over the beat
  pumpAt(t, beat) {
    const g = this.pump.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.25, t + 0.005);
    g.linearRampToValueAtTime(1, t + beat * 0.7);
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
  pad(notes, t, dur, vol, cutoff, saws = false) {
    const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.6;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 1.2);
    g.gain.setValueAtTime(vol, t + dur - 1.2);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.8);
    f.connect(g); g.connect(this.bus); g.connect(this.rev);
    notes.forEach((n, i) => {
      // spread across the chord: wide without doubling every voice; a supersaw stacks three
      for (const det of saws ? [-16, 0, 16] : [i % 2 ? 9 : -9]) {
        const o = c.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = det + (saws ? (i % 2 ? 4 : -4) : 0);
        o.connect(f); o.start(t); o.stop(t + dur + 0.9);
      }
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
    const c = this.ctx, t = c.currentTime, hard = !!song.hardBass, flute = !!song.flute, brass = !!song.brass, saws = !!song.supersaw || brass;
    const bass = { f: c.createBiquadFilter(), g: c.createGain(), o: [] };
    bass.f.type = 'lowpass'; bass.f.Q.value = 3;
    bass.g.gain.value = 0;
    let head = bass.f;
    if (hard) { const w = c.createWaveShaper(); w.curve = this.drive; bass.f.connect(w); head = w; }
    head.connect(bass.g).connect(this.bus);
    // a reese (two saws beating against each other) for the wobble bass, else one saw; a sine sub under both
    for (const [type, mul, v, det] of song.wobble ? [['sawtooth', 1, 0.8, -18], ['sawtooth', 1, 0.8, 18], ['sine', 0.5, 1.5, 0]] : [['sawtooth', 1, 1, 0], ['sine', song.sub || 0.5, 1.4, 0]]) {
      const o = c.createOscillator(), og = c.createGain();
      o.type = type; o.detune.value = det; og.gain.value = v; o.connect(og).connect(bass.f); o.start(t);
      bass.o.push([o, mul]);
    }
    if (song.wobble) {                                   // the wobble: an LFO on the bass filter, synced to the beat
      bass.lfo = c.createOscillator(); bass.lfoGain = c.createGain();
      bass.lfo.type = 'sine'; bass.lfoGain.gain.value = 0;
      bass.lfo.connect(bass.lfoGain).connect(bass.f.frequency); bass.lfo.start(t);
      bass.o.push([bass.lfo, 0]);
    }
    const lead = { f: c.createBiquadFilter(), g: c.createGain(), o: [], depth: c.createGain(), lfo: c.createOscillator() };
    // the guitar goes through the distortion; the flute is clean, with breath noise in it
    const w = flute || saws ? c.createGain() : c.createWaveShaper();
    if (!flute && !saws) w.curve = this.drive;
    lead.f.type = 'lowpass'; lead.f.frequency.value = flute ? 5000 : brass ? 1500 : saws ? 4500 : 3000; lead.f.Q.value = 1;
    lead.g.gain.value = 0;
    w.connect(lead.f).connect(lead.g);
    lead.g.connect(this.bus); lead.g.connect(this.dly); lead.g.connect(this.rev);
    lead.vib = flute ? 18 : brass ? 5 : saws ? 6 : 14;
    lead.attack = brass ? 0.09 : 0.01;              // brass swells in
    lead.glide = flute ? 0.035 : 0.012;
    lead.lfo.frequency.value = flute ? 5 : 5.5; lead.lfo.connect(lead.depth); lead.depth.gain.value = 0; lead.lfo.start(t);
    const leadOsc = flute ? [['triangle', -4, 0.7], ['sine', 4, 0.9]] : saws ? [['sawtooth', -14, 0.6], ['sawtooth', 0, 0.6], ['sawtooth', 14, 0.6]] : [['sawtooth', -9, 1], ['sawtooth', 9, 1]];
    for (const [type, det, v] of leadOsc) {
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
  // wob: wobbles per beat (2 = 8ths, 3 = 8th triplets, 4 = 16ths) for a wobble bass
  bass(n, t, dur, vol, dirt, wob = 0) {
    if (vol <= 0.0005 || !this.v) return;
    const B = this.v.bass;
    for (const [o, mul] of B.o) if (mul) o.frequency.setValueAtTime(mtof(n) * mul, t);
    B.f.frequency.cancelScheduledValues(t);
    if (wob && B.lfo) {
      B.lfo.frequency.setValueAtTime(this.song.bpm / 60 * wob, t);
      B.lfoGain.gain.setValueAtTime(350 + 900 * dirt, t);
      B.f.frequency.setValueAtTime(420 + 500 * dirt, t);
    } else {
      B.f.frequency.setValueAtTime(250 + 1600 * dirt, t);
      B.f.frequency.exponentialRampToValueAtTime(160 + 300 * dirt, t + Math.min(dur, 0.25));
    }
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
    L.g.gain.setTargetAtTime(vol, t, L.attack);
    L.g.gain.setTargetAtTime(0.0001, t + dur, 0.05);
  }

  noiseHit(t, type, freq, q, dur, vol, rev = 0) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    this.env(g, t, 0.002, vol, 0.002, t + dur);
    s.connect(f).connect(g).connect(this.drumBus);
    if (rev) { const r = c.createGain(); r.gain.value = rev; g.connect(r).connect(this.rev); }
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  kick(t, vol) {
    if (vol <= 0.0005) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this.env(g, t, 0.002, vol, 0.03, t + 0.38);
    o.connect(g).connect(this.drumBus);
    o.start(t); o.stop(t + 0.4);
    this.noiseHit(t, 'highpass', 3000, 0.7, 0.012, vol * 0.25);
  }

  snare(t, vol, dark = false) {
    if (vol <= 0.0005) return;
    this.noiseHit(t, 'bandpass', dark ? 800 : 1900, 0.8, dark ? 0.32 : 0.2, vol, dark ? 0.45 : 0.25);
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    this.env(g, t, 0.002, vol * 0.6, 0.01, t + 0.1);
    o.connect(g).connect(this.drumBus);
    o.start(t); o.stop(t + 0.12);
  }





  // a deep tom: a tuned skin falling in pitch, with a soft thud of noise
  tom(t, f, vol) {
    if (vol <= 0.0005) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.35);
    this.env(g, t, 0.003, vol, 0.02, t + 0.5);
    o.connect(g).connect(this.drumBus);
    const r = c.createGain(); r.gain.value = 0.3; g.connect(r).connect(this.rev);
    o.start(t); o.stop(t + 0.55);
    this.noiseHit(t, 'lowpass', 600, 0.7, 0.08, vol * 0.4);
  }

  clap(t, vol) {
    if (vol <= 0.0005) return;
    for (let k = 0; k < 3; k++) this.noiseHit(t + k * 0.011, 'bandpass', 1300, 1.1, 0.03, vol * 0.7);
    this.noiseHit(t + 0.033, 'bandpass', 1200, 0.9, 0.22, vol, 0.35);
  }

  // a noise riser: white noise sweeping up and swelling over `dur`, into the next phrase
  riser(t, dur, vol) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true;
    f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(9000, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    s.connect(f).connect(g).connect(this.drumBus);
    g.connect(this.rev);
    s.start(t); s.stop(t + dur + 0.1);
  }

  // a downlifter on the drop: a sub boom sliding down under a falling sweep
  drop(t, vol) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 1.1);
    this.env(g, t, 0.005, vol * 2, 0.1, t + 1.2);
    o.connect(g).connect(this.drumBus);
    o.start(t); o.stop(t + 1.25);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), ng = c.createGain();
    s.buffer = this.noise; s.loop = true;
    f.type = 'lowpass'; f.frequency.setValueAtTime(8000, t); f.frequency.exponentialRampToValueAtTime(200, t + 1.2);
    this.env(ng, t, 0.005, vol * 0.6, 0.05, t + 1.2);
    s.connect(f).connect(ng).connect(this.drumBus); ng.connect(this.rev);
    s.start(t); s.stop(t + 1.25);
  }

  hat(t, vol, open) { if (vol > 0.0005) this.noiseHit(t, 'highpass', 7500, 0.8, open ? 0.25 : 0.04, vol); }
  crash(t, vol) { if (vol > 0.0005) this.noiseHit(t, 'highpass', 4200, 0.5, 1.8, vol, 0.5); }
}
