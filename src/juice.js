// Game feel: screen shake, hit-stop and the kill combo. Small, global, and called from anywhere
// something should land with weight.
//   shake(k)    k ~0.2 for a pop, 1 for a big hit; stacks up to a cap and decays fast
//   hitstop(s)  freeze the game (not the rendering) for s seconds: a kill "lands"
//   combo       kills within 2.5 s of each other chain; more dew as it grows
export const juice = {
  trauma: 0,
  stop: 0,
  combo: 0,
  comboT: 0,
  best: 0,

  shake(k) { this.trauma = Math.min(1, this.trauma + k); },
  hitstop(s) { this.stop = Math.max(this.stop, s); },

  // a kill: returns the new combo count
  kill() {
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = 2.5;
    this.best = Math.max(this.best, this.combo);
    return this.combo;
  },
  // dew bonus from the combo: +2% per kill in the chain, up to +60%
  get bonus() { return 1 + Math.min(0.6, Math.max(0, this.combo - 1) * 0.02); },

  update(dt) {
    this.trauma = Math.max(0, this.trauma - dt * 2.2);
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT === 0) this.combo = 0;
  },
  reset() { this.trauma = this.stop = this.combo = this.comboT = 0; this.best = 0; },

  // camera offset for this frame (meters): shake grows with the square of trauma
  offset(out, scale = 0.012) {
    const s = this.trauma * this.trauma * scale;
    return out.set((Math.random() - 0.5) * 2 * s, (Math.random() - 0.5) * 2 * s, (Math.random() - 0.5) * 2 * s);
  },
};
