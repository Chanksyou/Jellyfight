// The bodies Treasures show (a glow stick, a duck, an alarm clock…): each built once at load, hidden,
// and shown for a frame by the warm-up (Gadgets.warm) so its shaders are built before play.
// prop(name, build) gives the one body of that name; pool(name, n, build) gives n of them. Build with
// the kit's pieces (fx.piece + GadgetLooks.mat) so a body adds no material or program of its own.
export class TreasureProps {
  constructor() { this.all = new Map(); }
  prop(name, build) { return this.pool(name, 1, build)[0]; }
  pool(name, n, build) {
    let list = this.all.get(name);
    if (!list) {
      list = Array.from({ length: n }, (_, i) => { const o = build(i); o.visible = false; o.userData.size ??= o.scale.x || 0.001; return o; });
      this.all.set(name, list);
    }
    return list;
  }
  // on: every body visible at `at` at its built size (an fx.piece starts at size 0); off: hidden again
  warm(on, at) {
    for (const list of this.all.values()) for (const o of list) {
      o.visible = on;
      if (on) { o.position.copy(at); o.scale.setScalar(o.userData.size); }
    }
  }
  reset() { for (const list of this.all.values()) for (const o of list) o.visible = false; }
}
