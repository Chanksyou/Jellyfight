// Recorded songs with a measured beat grid, for attacks that land on the beat (the Encore's floor,
// encore-floor.js). A track loops on whole bars, so its beat counts on with no slip, and answers
// beatNow() like the synthesized songs in music.js.
//
// The owner's supplied track for the Encore (assets/audio/README.md). Measured from the file: 128 BPM,
// its first beat 0.052 s in, 159 whole bars before the end; the kick drops out for bars 75 to 79 (the
// breakdown), where the floor rests; bars 32 to 39 are its drop (64 beats into the fight), where the
// waves come two at a time. It starts (and loops back to) `start` beats in, skipping the intro; bars
// stay counted from the file's first beat.
export const TRACKS = {
  encore: { url: './assets/audio/encore-around-the-world.mp3', bpm: 128, offset: 0.052, bars: 159, start: 64, quiet: [75, 76, 77, 78, 79], drop: [32, 33, 34, 35, 36, 37, 38, 39] },
};

// a track's file, fetched once (it needs no audio yet, so an act can start on it as it loads)
const files = {};
export const fetchTrack = (track) => (files[track.url] ||= fetch(track.url).then((r) => { if (!r.ok) throw new Error(`${track.url}: ${r.status}`); return r.arrayBuffer(); }).catch((e) => { delete files[track.url]; throw e; }));

const latency = (c) => (c.outputLatency || 0) + (c.baseLatency || 0);

export class SongTrack {
  constructor(ctx, dest, track) {
    Object.assign(this, { ctx, track });
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(dest);
    this.buffer = null; this.src = null; this.t0 = 0; this.from = 0; this.ducked = false; this.volume = 0.9;
  }
  get bpm() { return this.track.bpm; }
  get loopBeats() { return this.track.bars * 4 - (this.track.start || 0); }   // from `start` to the end of its last whole bar
  // fetch and decode it; false if it can't (offline, a bad file). A decode that hasn't finished within
  // `wait` s (a phone could get stuck on the 5 minute file) is started again once; false if that sticks too
  async load() {
    if (this.buffer) return true;
    let bytes;
    try { bytes = await fetchTrack(this.track); } catch { return false; }
    for (let tries = 0; tries < 2 && !this.buffer; tries++) {
      const decoded = this.ctx.decodeAudioData(bytes.slice(0)).catch(() => null);   // decoding takes the bytes: decode a copy
      const late = new Promise((done) => setTimeout(() => done(null), (this.track.wait ?? 8) * 1000));
      this.buffer = await Promise.race([decoded, late]);
    }
    return !!this.buffer;
  }
  // from `start` beats in, looping on whole bars back to there; `at`: the beat to pick up on (a boss that
  // kept its own clock while the file loaded), so beatNow() carries on from it instead of jumping back to 0
  play(at = 0) {
    if (this.src || !this.buffer) return;
    const c = this.ctx, T = this.track, s = c.createBufferSource(), L = this.loopBeats;
    const p = 60 / T.bpm, lead = 0.08, loopStart = T.offset + (T.start || 0) * p;
    // (it sounds `lead` s from now, and the speakers lag `latency` more: pick up where that clock will be then)
    this.from = (Number.isFinite(at) ? at : 0) + (lead + latency(c)) / p;
    s.buffer = this.buffer; s.loop = true; s.loopStart = loopStart; s.loopEnd = T.offset + T.bars * 4 * p;
    s.connect(this.out); this.t0 = c.currentTime + lead; s.start(this.t0, loopStart + (((this.from % L) + L) % L) * p);
    this.out.gain.setValueAtTime(0, c.currentTime); this.out.gain.linearRampToValueAtTime(this.ducked ? this.volume * 0.3 : this.volume, this.t0 + 0.3);
    this.src = s;
  }
  stop() { if (!this.src) return; const t = this.ctx.currentTime; this.out.gain.setTargetAtTime(0, t, 0.1); this.src.stop(t + 0.5); this.src = null; }
  duck(on) { if (on === this.ducked) return; this.ducked = on; if (this.src) this.out.gain.setTargetAtTime(on ? this.volume * 0.3 : this.volume, this.ctx.currentTime, 0.2); }
  // beats since it started playing, as the speakers play it; counts on across loops (null until it plays)
  beatNow() { if (!this.src) return null; const c = this.ctx; return this.from + (c.currentTime - latency(c) - this.t0) * this.bpm / 60; }
  // the file's bar at this beat (counting on across loops)
  bar(beat) { const L = this.loopBeats; return Math.floor(((this.track.start || 0) + (((beat % L) + L) % L)) / 4); }
  // is the kick out at this beat (a breakdown): the floor rests
  quiet(beat) { return this.track.quiet.includes(this.bar(beat)); }
  // is this beat in a drop: the waves come two at a time
  drop(beat) { return !!this.track.drop?.includes(this.bar(beat)); }
}
