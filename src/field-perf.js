// Frame numbers from real play, sent with the act summary (run.js recordRun → details.perf).
// Counts the same frames the governor judges (played, not paused, not behind a menu) in a fixed
// 64-bucket histogram (0 to 128 ms, 2 ms each), so a long act costs no memory and no per-frame allocation.
// Frame times and screen size only: nothing typed, no location.
// Also, to tell our work from the browser's pacing: the script time of a drawn frame (`work`, 1 ms buckets),
// the gaps between browser callbacks before the pacer (`raf`) and the share it held back (`held`), the longest
// counted interval, how many hitches (over 250 ms) were thrown away, and how the load went (`load`).
const BUCKETS = 64, BUCKET_MS = 2, MIN_FRAMES = 30, FINE = 64;
const median = (hist, n, q, step = 1, mid = 0.5) => {   // the bucket middle below which this share fell (`mid` 0: the bucket's own value)
  let seen = 0;
  const want = Math.ceil(n * q);
  for (let i = 0; i < hist.length; i++) if ((seen += hist[i]) >= want) return (i + mid) * step;
  return hist.length * step;
};

// How the load went, from what main.js knows: when each step began (`JF_LOAD.steps` third values), how long the page
// was hidden meanwhile, whether this BUILD had loaded here before, and the game files that came over the network
// against from cache (Resource Timing: a cached file reports no transfer). Numbers only.
export function loadFacts(steps, hiddenMs, first, entries) {
  let net = 0, cache = 0, bytes = 0;
  for (const e of entries) {
    if (e.transferSize > 0) { net++; bytes += e.transferSize; } else cache++;
  }
  return { steps: steps.map((s) => Math.round(s[2] || 0)), hiddenMs: Math.round(hiddenMs), first, net, cache, bytes };
}

export class FieldPerf {
  constructor() {
    this.hist = new Uint32Array(BUCKETS);
    this.n = 0; this.over = 0;       // frames counted; frames over 1.5x the target interval
    this.minRatio = Infinity;        // lowest pixel ratio the governor reached
    this.workHist = new Uint32Array(FINE); this.rafHist = new Uint32Array(FINE);
    this.works = this.calls = this.heldN = 0; this.lastRaf = 0;
    this.longest = this.gaps = 0;
    this.load = null;                // loadFacts(), set by main.js once Play worked
    this.loadMs = 0;                 // navigation start to Play enabled (set by main.js)
  }

  // one played frame: its interval, the governor's target interval and pixel ratio now
  // a new run or a changed tier or cap starts the count over, so one row never mixes settings
  reset() {
    this.hist.fill(0); this.workHist.fill(0); this.rafHist.fill(0);
    this.n = this.over = this.works = this.calls = this.heldN = this.longest = this.gaps = 0; this.lastRaf = 0; this.minRatio = Infinity;
  }

  // a browser callback while playing, and whether the pacer held its frame back
  callback(now, held) {
    const d = now - this.lastRaf;
    this.lastRaf = now;
    if (!(d > 0) || d > 250) return;
    this.rafHist[Math.min(FINE - 1, Math.round(d))]++;
    this.calls++;
    if (held) this.heldN++;
  }

  // the script time of a drawn frame: the start of GAME.frame to the end of GAME.render
  work(ms) {
    if (!(ms >= 0)) return;
    this.workHist[Math.min(FINE - 1, Math.round(ms))]++;
    this.works++;
  }

  sample(ms, target, ratio) {
    if (ms > 250) this.gaps++;
    if (!(ms > 0) || ms > 250) return;
    if (ms > this.longest) this.longest = ms;   // a hitch or a pause coming back: not a frame time (the governor skips these too)
    this.hist[Math.min(BUCKETS - 1, (ms / BUCKET_MS) | 0)]++;
    this.n++;
    if (ms > 1.5 * target) this.over++;
    if (ratio < this.minRatio) this.minRatio = ratio;
  }

  // the interval below which this share of frames fell, in ms (bucket middle)
  quantile(q) {
    return median(this.hist, this.n, q, BUCKET_MS);
  }

  // null until there are enough frames to mean something; `env` is what main.js knows (tier, cap, dpr, size, lost)
  summary(env) {
    if (this.n < MIN_FRAMES) return null;
    return {
      ms: this.quantile(0.5), p95: this.quantile(0.95), slow: Math.round((1000 * this.over) / this.n) / 1000, n: this.n,
      minRatio: Math.round(this.minRatio * 1000) / 1000, loadMs: Math.round(this.loadMs),
      ...(this.works >= MIN_FRAMES ? { work: median(this.workHist, this.works, 0.5, 1, 0), workP95: median(this.workHist, this.works, 0.95, 1, 0) } : {}),
      ...(this.calls >= MIN_FRAMES ? { raf: median(this.rafHist, this.calls, 0.5, 1, 0), held: Math.round((1000 * this.heldN) / this.calls) / 1000 } : {}),
      longest: Math.round(this.longest), gaps: this.gaps, ...(this.load ? { load: this.load } : {}), ...env,
    };
  }
}
