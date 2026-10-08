// How often the game draws, and how sharp. Two small pieces the frame loop in main.js uses:
//
//  - FramePacer: skips animation frames to hold a frame-rate cap (phones: 60, so a 120 Hz Pixel
//    doesn't do twice the GPU work for no gameplay gain) and draws slowly behind a menu.
//  - FrameGovernor: watches how long frames really take and trades sharpness for smoothness:
//    lowers the pixel ratio when frames run long and raises it back with headroom. (The graphics
//    tier is the player's pick in the pause menu; the governor never changes it.)
//
// Frame times alone can't tell "the GPU is slow" from "the browser caps us" (Low Power Mode on an
// iPhone, or a claude.ai frame before its first tap, both run at a steady 30 fps). So every step
// down is a probe: if the frames didn't get faster, the slowness wasn't ours to fix, the step is
// undone and that frame time becomes the target. Pure logic, fed frame intervals, so stories can
// drive it with made-up numbers (stories.js: engine/governor-*).

export class FramePacer {
  constructor({ fps = 0, menuFps = 0 } = {}) {
    this.fps = fps;          // 0 = draw on every animation frame
    this.menuFps = menuFps;  // while a menu covers the game
    this.last = -Infinity;
  }
  // true when this animation frame should run the game. Up to a fifth of a frame early still
  // counts, so a 60 Hz screen whose timestamps jitter doesn't skip frames at a 60 cap.
  due(now, menu = false) {
    const fps = menu && this.menuFps ? this.menuFps : this.fps;
    if (fps && now - this.last < 800 / fps) return false;
    this.last = now;
    return true;
  }
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

export class FrameGovernor {
  constructor({
    fps = 60,            // the frame rate we want (the pacer's cap)
    scale = 1,           // pixel ratio now
    min = 1, max = 1,    // pixel ratio range (max = min turns resolution steps off)
    step = 0.125,
    window = 1000,       // ms of frames judged together
    slow = 1.2,          // a window's median frame this much over target counts as slow
    fast = 1.08,         // at or under this much of target counts as having headroom
  } = {}) {
    Object.assign(this, { scale, min, max, step, windowMs: window, slowF: slow, fastF: fast });
    this.base = 1000 / fps;
    this.target = this.base;   // learned: rises to a browser cap we can't beat, falls back when it lifts
    this.t = 0;                // ms of play the governor has seen
    this.frames = []; this.windowT = 0;
    this.slowN = 0; this.fastN = 0;
    this.probe = null;
    this.holdUp = 0;
    this.log = [];             // what it did and why (F3 readout, stories)
  }

  // one frame's interval in ms; returns a change to apply ({ scale }) or null
  sample(ms) {
    if (!(ms > 0) || ms > 250) return null;   // a hitch, a tab switch, a menu: not a frame time
    this.t += ms;
    this.frames.push(ms); this.windowT += ms;
    if (this.windowT < this.windowMs) return null;
    const m = median(this.frames);
    this.frames.length = 0; this.windowT = 0;
    this.lastMedian = m;
    return this._judge(m);
  }

  _do(change, why) { this.log.push({ t: Math.round(this.t), ...change, why }); if (this.log.length > 20) this.log.shift(); return change; }

  _judge(m) {
    const p = this.probe;
    if (p && ++p.windows >= 2) {
      this.probe = null;
      if (p.kind === 'down' && m > p.before * 0.9) {
        // not faster at a lower resolution: something else sets the pace (a frame-rate cap)
        this.scale = p.from; this.target = Math.max(this.base, p.before); this.holdUp = this.t + 10000;
        return this._do({ scale: this.scale }, 'capped');
      }
      if (p.kind === 'up' && m > this.target * this.slowF) {
        this.scale = p.from; this.holdUp = this.t + 20000;
        return this._do({ scale: this.scale }, 'no-headroom');
      }
      return null;
    }
    if (p) return null;
    // the cap lifted (Low Power Mode off, the frame was tapped): aim for full speed again
    if (m < this.target * 0.85) this.target = Math.max(this.base, m);
    if (m > this.target * this.slowF) {
      this.fastN = 0;
      if (++this.slowN < 2) return null;
      this.slowN = 0;
      if (this.scale > this.min) {
        const from = this.scale;
        this.scale = Math.max(this.min, +(this.scale - this.step).toFixed(3));
        this.probe = { kind: 'down', from, before: m, windows: 0 };
        return this._do({ scale: this.scale }, 'slow');
      }
      return null;
    }
    this.slowN = 0;
    if (m > this.target * this.fastF) { this.fastN = 0; return null; }
    if (++this.fastN < 3) return null;
    this.fastN = 0;
    if (this.scale < this.max && this.t >= this.holdUp) {
      const from = this.scale;
      this.scale = Math.min(this.max, +(this.scale + this.step).toFixed(3));
      this.probe = { kind: 'up', from, before: m, windows: 0 };
      return this._do({ scale: this.scale }, 'headroom');
    }
    return null;
  }
}
