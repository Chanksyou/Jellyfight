// Frame numbers from real play, sent with the act summary (run.js recordRun → details.perf).
// Counts the same frames the governor judges (played, not paused, not behind a menu) in a fixed
// 64-bucket histogram (0 to 128 ms, 2 ms each), so a long act costs no memory and no per-frame allocation.
// Frame times and screen size only: nothing typed, no location.
const BUCKETS = 64, BUCKET_MS = 2, MIN_FRAMES = 30;

export class FieldPerf {
  constructor() {
    this.hist = new Uint32Array(BUCKETS);
    this.n = 0; this.over = 0;       // frames counted; frames over 1.5x the target interval
    this.minRatio = Infinity;        // lowest pixel ratio the governor reached
    this.loadMs = 0;                 // navigation start to Play enabled (set by main.js)
  }

  // one played frame: its interval, the governor's target interval and pixel ratio now
  // a new run or a changed tier or cap starts the count over, so one row never mixes settings
  reset() { this.hist.fill(0); this.n = this.over = 0; this.minRatio = Infinity; }

  sample(ms, target, ratio) {
    if (!(ms > 0) || ms > 250) return;   // a hitch or a pause coming back: not a frame time (the governor skips these too)
    this.hist[Math.min(BUCKETS - 1, (ms / BUCKET_MS) | 0)]++;
    this.n++;
    if (ms > 1.5 * target) this.over++;
    if (ratio < this.minRatio) this.minRatio = ratio;
  }

  // the interval below which this share of frames fell, in ms (bucket middle)
  quantile(q) {
    let seen = 0;
    const want = Math.ceil(this.n * q);
    for (let i = 0; i < BUCKETS; i++) if ((seen += this.hist[i]) >= want) return (i + 0.5) * BUCKET_MS;
    return BUCKETS * BUCKET_MS;
  }

  // null until there are enough frames to mean something; `env` is what main.js knows (tier, cap, dpr, size, lost)
  summary(env) {
    if (this.n < MIN_FRAMES) return null;
    return {
      ms: this.quantile(0.5), p95: this.quantile(0.95), slow: Math.round((1000 * this.over) / this.n) / 1000, n: this.n,
      minRatio: Math.round(this.minRatio * 1000) / 1000, loadMs: Math.round(this.loadMs), ...env,
    };
  }
}
