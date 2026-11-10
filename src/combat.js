// Lash: the jelly's close-range sting, next to its main attack (bubbles.js). Every so often a
// few of its tentacles whip out, each at a different enemy within reach, sting, and snap back.
// Only treasures improve it (run.js works out the tentacle stats and which treasures apply).
// The jelly's own tentacles (avatar.tentacles) do the striking; bounces between enemies (Hair
// Tie) and bodies without tentacles use a simple stretched cylinder instead.
import * as THREE from 'three';
import { sfx } from './sfx.js';
import { bus } from './events.js';
import { batcher } from './batch.js';
import { LOOK } from './look.js';
import { juice } from './juice.js';
import { knockFor } from './stats.js';

const EXTEND = 0.07, HOLD = 0.04, RETRACT = 0.12;   // seconds
const BLEED = { dps: 0.25, time: 3, stacks: 5 };   // a sweep's Bleed when the run has no venom word to set its own
const STOP = 0.04;   // m from the jelly's middle (plus the bug's own size) where a grabbed bug is reeled to
const DRAW = 0.025;   // the pullback fits inside the existing 70 ms strike; no extra attack delay

export class Lash {
  constructor(scene, enemies, fx) {
    this.scene = scene;
    this.enemies = enemies;
    this.fx = fx;
    this.timer = 0;
    this.count = 0;               // lashes so far (Gold Ring, nth-attack)
    this.stings = 0;              // stings landed since the last sting-count sweep
    this.flare = 0;               // reach-flare: the next lash reaches this many times as far (0 = no)
    this.reach = 0.1;             // m, your Tentacle reach as it stood on the last update (echo)
    this.reachNow = 0.1;          // m, the reach the lash being thrown has (a flare doubles it): reach-sweetspot's edge
    this.clock = 0;               // s, for pin-on-stings
    this.coil = new WeakMap();    // pin-on-stings: enemy -> when it was stung lately
    this.strikes = [];            // tentacles currently out
    this.pool = [];
    this.statePool = [];
    this.geo = new THREE.CylinderGeometry(1, 0.55, 1, 6, 1).translate(0, 0.5, 0); // base at 0, tip at 1
    this.mat = new THREE.MeshStandardMaterial({ color: 0xffb8e0, emissive: 0xff6fb5, emissiveIntensity: 0.6, roughness: 0.3 });
    this.goldMat = new THREE.MeshStandardMaterial({ color: 0xffe07a, emissive: 0xffc23a, emissiveIntensity: 1.2, roughness: 0.3 });
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this.getRig = () => null;     // main.js: () => player.avatar.tentacles
    this.onLash = null;           // () => void: the jelly's body answers as its tentacles whip out (run.js)
    this.venom = new Map();       // venom word (Box Jelly): enemy -> { stacks, perStack (dps), t, tick }
    enemies.statuses.bleeding = (e) => this.venom.get(e)?.stacks || 0;   // status-damage & co. (words.js STATUSES)
    this.venomColor = new THREE.Color(LOOK.color('venom', '#8dff5a'));
    this.traceColor = new THREE.Color(LOOK.color('lash-trace', '#2ee9ff'));
    this.impactColor = new THREE.Color(LOOK.color('lash-impact', '#5ff0ff'));
    this.strikeColor = new THREE.Color(LOOK.color('lash-strike', '#e9fdff'));
    this._c = new THREE.Vector3();
    this._d = new THREE.Vector3();
    this._e = new THREE.Vector3();
    this._tip = new THREE.Vector3();
  }

  reset() {
    this.timer = 0;
    this.count = this.stings = this.flare = 0;
    this.coil = new WeakMap();
    this.strikes.forEach((s) => this.release(s));
    this.strikes = [];
    this.venom.clear();
  }

  release(s) {
    if (s.mesh) { s.mesh.visible = false; this.pool.push(s.mesh); }
    if (s.rig) s.rig.aim(s.tent, null);
    s.target = s.rig = s.hits = null;
    if (this.statePool.length < 128) this.statePool.push(s);
  }

  // The free tentacle whose root points most toward the target
  pickTentacle(rig, from, target) {
    const busy = new Set(this.strikes.filter((s) => s.rig === rig).map((s) => s.tent));
    const want = this.enemies.center(target, this._b).sub(from).setY(0).normalize();
    let best = -1, bd = -Infinity;
    for (let i = 0; i < rig.count; i++) {
      if (busy.has(i)) continue;
      const d = rig.worldDir(i, this._a).dot(want);
      if (d > bd) { bd = d; best = i; }
    }
    return best;
  }

  mesh() {
    const m = this.pool.pop() || batcher.track(new THREE.Mesh(this.geo, this.mat));
    if (!m.parent) this.scene.add(m);
    m.visible = true;
    return m;
  }

  // origin: world position tentacles come from. hits: what your treasures add to a sting
  // (mods.hits.tentacles: mark, crit; see words.js)
  update(dt, origin, stats, hits, opts) {
    const speed = stats.tentacleSpeed * (opts.lashSpeedMul || 1);
    this.timer += dt * speed;
    this.reach = stats.reach;
    if (this.timer >= 1) {
      if (this.fire(origin, stats, hits, opts)) this.timer = 0;
      else this.timer = 1; // ready, waiting for something in reach
    }
    this.animate(dt, origin);
  }

  inReach(origin, reach, exclude) {
    const out = [];
    for (const e of this.enemies.list) {
      if (e.dead || exclude?.has(e) || e.proxy?.immune) continue;   // a boss that can't be hurt right now (shielded, rising, doomed): don't spend a tentacle on it
      const d = this.enemies.center(e, this._a).distanceTo(origin) - e.r;
      if (d <= reach) out.push([d, e]);
    }
    // nearest first, but an armoured bug (a curled millipede: hits do 75% less) only once nothing
    // unarmoured is in reach — it's the fallback, not the target
    return out.sort((a, b) => (a[1].armor ? 1 : 0) - (b[1].armor ? 1 : 0) || a[0] - b[0]).map((x) => x[1]);
  }

  // opts.nth, opts.stingCount: the run's nth-attack and sting-count words (words.js), which can make this lash a sweep
  fire(origin, stats, hits, opts = {}) {
    const reach = this.reachNow = stats.reach * (this.flare || 1);
    const all = this.inReach(origin, reach);
    const sweep = this.sweepFor(this.count + 1, opts);
    const targets = sweep ? all : all.slice(0, stats.tentacles);
    if (!targets.length) return false;
    this.count++;
    this.flare = 0;
    if (sweep?.sting) this.stings = 0;
    const X = sweep && { sweep: true, bleed: sweep.bleed };
    for (const e of targets) this.strike(origin, e, stats.tentacleDamage * (sweep?.dmg ?? 1), hits, X);
    this.onLash?.();
    return true;
  }

  // sweep words (words.js ATTACK_WORDS) that make lash number n one: an nth-attack it falls on, a sting-count that's full
  sweepFor(n, { nth = [], stingCount = [] }) {
    let out = null;
    const add = (ef, sting) => { out ||= { dmg: 1, bleed: 0, sting: false }; out.dmg *= ef.dmg; out.bleed = Math.max(out.bleed, ef.bleed); out.sting ||= sting; };
    for (const N of nth) if (N.random ? Math.random() < 1 / N.every : n % N.every === 0) for (const ef of N.effects) if (ef.kind === 'sweep') add(ef, false);
    for (const S of stingCount) if (this.stings >= S.every) for (const ef of S.effects) if (ef.kind === 'sweep') add(ef, true);
    return out;
  }

  // Toaster Cord's lash back: every bug within reach is stung at k times the damage
  sweepNow(origin, stats, hits, k) {
    this.reachNow = stats.reach;
    for (const e of this.inReach(origin, stats.reach)) this.strike(origin, e, stats.tentacleDamage * k, hits, { sweep: true });
  }

  // Tape Measure's grab (words.js): the toughest bug in range is stung, then reeled in to the jelly and slammed
  grab(origin, stats, hits, ef) {
    let best = null;
    for (const e of this.inReach(origin, ef.range)) if (!e.proxy && !e.T.rooted && (!best || e.hp > best.hp)) best = e;   // a rooted bug can't be reeled in
    if (!best) return false;
    this.strike(origin, best, stats.tentacleDamage * ef.dmg, hits, { grab: true });
    this.onLash?.();
    return true;
  }

  // extra: what makes this sting special: { sweep, bleed } (a sweep's), { grab } (reeled in)
  strike(from, target, dmg, hits, extra = null) {
    const rig = this.getRig();
    const tent = rig ? this.pickTentacle(rig, from, target) : -1;
    let m = null;
    if (tent < 0) {
      m = this.mesh();
      m.material = this.mat;
    }
    const s = this.statePool.pop() || { from: new THREE.Vector3(), tip: new THREE.Vector3() };
    s.from.copy(from); s.tip.copy(from);
    Object.assign(s, { mesh: m, rig: tent < 0 ? null : rig, tent, target, fixedFrom: null, t: 0, dmg, golden: false, hit: false, hits, released: false, landed: false, extra, reel: null, reach: this.reachNow });
    this.strikes.push(s);
    sfx.lashDraw();
  }

  // venom: each stack burns its share every 0.25 s until the stacks run out
  // Bleed (the venom word's): n more stacks on e, each bleeding V.dps of the sting's damage a second
  bleed(e, n, V, dmg) {
    const B = this.venom.get(e) || { stacks: 0, tick: 0.25 };
    B.stacks = Math.min(V.stacks, B.stacks + n);
    B.perStack = V.dps * dmg;
    B.t = V.time;
    this.venom.set(e, B);
  }

  tickVenom(dt) {
    for (const [e, V] of this.venom) {
      if (e.dead || (V.t -= dt) <= 0) { this.venom.delete(e); continue; }
      if ((V.tick -= dt) > 0) continue;
      V.tick += 0.25;
      const c = this.enemies.center(e, this._b);
      bus.emit('damage_taken', { targetId: e.id, amount: V.stacks * V.perStack * 0.25, color: '#b8ff8a', source: 'venom' });
      this.fx.puff(c, this.venomColor.getHex(), 0.004 + V.stacks * 0.0012, 0.3);
    }
  }

  // Where a tentacle meets its target: the side of the bug facing the jelly, a little up its back,
  // so the tip stays in sight from above instead of vanishing into the body's middle
  contact(target, a, out) {
    const c = this.enemies.center(target, out), r = target.r || 0;
    const dx = a.x - c.x, dz = a.z - c.z, d = Math.hypot(dx, dz) || 1, k = r * LOOK.num('lash-contact-in', 0.3) / d;
    return out.set(c.x + dx * k, c.y + r * LOOK.num('lash-contact-up', 1), c.z + dz * k);
  }

  // Travel: the tentacle is only millimetres wide from the play camera, so a glow follows its arc
  // at full brightness from the release (the snap is too quick to fade in) and dims as it pulls back;
  // a streak of dots trails the tip as it snaps out and stays a moment after
  glowLash(s, a, b, k, bright, snapping) {
    if (k <= 0) { s.tip.copy(a); return; }
    const tip = this._tip.copy(a).lerp(b, k), P = this._c, glow = this.fx.glow, lift = a.distanceTo(tip) * LOOK.num('lash-arc', 0.3);
    const n = LOOK.num('lash-glow-dots', 6), size = LOOK.num('lash-glow-size', 0.03);
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      P.copy(a).lerp(tip, u); P.y += Math.sin(u * Math.PI) * lift;
      glow.hold(P, this.traceColor, size * (0.5 + 0.5 * u), 0.7 * bright);
    }
    glow.hold(tip, this.strikeColor, size * 2 * bright, bright);   // the tip: the bright point the eye follows
    if (snapping) {
      const m = LOOK.num('lash-streak-dots', 4), ss = LOOK.num('lash-streak-size', 0.018);
      for (let i = 1; i <= m; i++) glow.emit(P.copy(s.tip).lerp(tip, i / m), this.traceColor, ss, ss * 0.3, LOOK.num('lash-streak-life', 0.2), 0.8);
    }
    s.tip.copy(tip);
  }

  // Impact: a crescent of glow swept across the bug, wider than its body, so the sting reads as a
  // whip crack even while the bug itself flashes white
  slash(target, a, b) {
    const c = this.enemies.center(target, this._c), R = Math.max(0.012, target.r * LOOK.num('lash-slash-width', 2));
    const dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz) || 1, fx = dx / d, fz = dz / d;
    const n = LOOK.num('lash-slash-dots', 15), size = LOOK.num('lash-slash-size', 0.035), life = LOOK.num('lash-slash-life', 0.18);
    const P = this._tip, v = this._a;
    for (let i = 0; i < n; i++) {
      const th = (i / (n - 1) - 0.5) * 2.2, side = Math.sin(th), ahead = (Math.cos(th) - 0.7) * 0.6;
      P.set(b.x + (-fz * side + fx * ahead) * R, b.y, b.z + (fx * side + fz * ahead) * R);
      v.set(fx, 0, fz).multiplyScalar(0.12);
      const mid = 1 - Math.abs(i / (n - 1) - 0.5);
      this.fx.glow.emit(P, this.traceColor, size * (0.5 + mid), size * 0.2, life, 0.9, v);
    }
  }

  animate(dt, origin) {
    this.clock += dt;
    this.tickVenom(dt);
    for (const s of this.strikes) if (s.reel) this.reelIn(s, dt, s.fixedFrom || origin);
    for (const s of this.strikes) {
      s.t += dt;
      const a = s.fixedFrom || origin;
      const b = this.contact(s.target, a, this._b);
      if (!s.released && s.t >= DRAW) { s.released = true; sfx.lashRelease(); }
      if (!s.hit && s.t >= EXTEND) { s.hit = true; s.landed = this.land(s, a, b); }
      const out = THREE.MathUtils.clamp((s.t - DRAW) / (EXTEND - DRAW), 0, 1);
      const back = THREE.MathUtils.clamp((s.t - EXTEND - HOLD) / RETRACT, 0, 1);
      const k = s.t < DRAW ? -LOOK.num('lash-coil', 0.18) * Math.sin(s.t / DRAW * Math.PI / 2)
        : s.t < EXTEND ? out * out : s.t < EXTEND + HOLD ? 1 : (1 - back) ** 2;
      const impact = s.landed ? Math.max(0, 1 - (s.t - EXTEND) / HOLD) : 0;
      this.glowLash(s, a, b, k, s.t <= EXTEND + HOLD ? 1 : k, s.t <= EXTEND);
      if (s.rig) { s.rig.aim(s.tent, b, k, s.golden, impact); continue; }
      const dir = this._a.copy(b).sub(a);
      const full = dir.length();
      if (full < 1e-5 || k <= 0) { s.mesh.visible = false; continue; }
      dir.divideScalar(full);
      s.mesh.visible = true;
      s.mesh.position.copy(a);
      s.mesh.quaternion.setFromUnitVectors(UP, dir);
      s.mesh.scale.set(0.0015, full * k, 0.0015);
    }
    const done = this.strikes.filter((s) => s.t >= EXTEND + HOLD + RETRACT);
    for (const s of done) { if (s.reel) this.reelIn(s, 1, s.fixedFrom || origin); this.release(s); }
    if (done.length) this.strikes = this.strikes.filter((s) => s.t < EXTEND + HOLD + RETRACT);
  }

  land(s, a, b) {
    if (s.target.dead || s.target.proxy?.immune) return false;
    const H = s.hits, X = s.extra, E = this.enemies;
    // Whip Crack (reach-sweetspot): a bug right at the edge of reach takes more
    // (against the reach this lash had: a Bell Pulse flare moves the edge out; a grab has no edge)
    const edge = H.edge && !X?.grab && E.center(s.target, this._c).distanceTo(a) - s.target.r >= H.edge.from * s.reach;
    this.fx.puff(b, this.impactColor, 0.008, 0.18);   // nematocyst sparkle
    this.fx.impact(b, this.impactColor, LOOK.num('lash-impact-size', 0.016) * (edge ? 1.6 : 1), edge ? 10 : 6);   // the flash, sparks and ring where it lands
    sfx.sting();
    juice.feel('hit');
    const id = s.target.id;
    if (H.mark) bus.emit('status_applied', { targetId: id, status: 'mark', duration: H.mark, more: H.markMore });
    let dmg = s.dmg, color = '#fff', crit = false;
    if (edge) { dmg *= H.edge.mult; color = '#ffe9a8'; }
    if (H.crit && Math.random() < H.crit.chance) {
      dmg *= H.crit.mult; color = '#e6fbff'; this.fx.crit(b, s.target.r); sfx.crit();
      crit = true;
      if (H.pin) bus.emit('status_applied', { targetId: id, status: 'pin', duration: H.pin });   // pin-on-crit
    }
    // a shove away from the jelly: the harder the sting, the further (a grabbed bug is reeled in instead)
    if (!s.target.T.fly && !X?.grab) bus.emit('knockback', { targetId: id, dir: E.center(s.target, this._c).sub(a).setY(0).normalize(), force: knockFor(dmg * E.statusMore(s.target, 'tentacle')) });
    bus.emit('damage_taken', { targetId: id, amount: dmg, color, source: 'tentacle', feedback: { crit } });
    this.slash(s.target, a, b);
    // the streak (glowLash) fades behind it; floor droplets stay a moment longer
    this.fx.splat(b.clone().setY(E.floorBelow(b, s.target.pos.y)), null, LOOK.num('lash-splat-size', 0.006));
    // Bleed (venom, or a sweep's): another stack, and they all last a while longer
    const Vn = H.venom, bleeds = (Vn ? 1 : 0) + (X?.bleed || 0);
    if (bleeds && !s.target.dead) this.bleed(s.target, bleeds, Vn || BLEED, s.dmg);
    if (!X) this.stings++;   // sting-count counts the ordinary ones
    // pin-on-stings: enough stings close together hold the bug in place
    if (H.coil && !s.target.dead) {
      const C = H.coil, t = (this.coil.get(s.target) || []).filter((x) => this.clock - x <= C.within);
      t.push(this.clock);
      if (t.length >= C.hits) { bus.emit('status_applied', { targetId: id, status: 'pin', duration: C.seconds }); t.length = 0; }
      this.coil.set(s.target, t);
    }
    if (H.echo && !X) this.echo(s, a, b, H.echo);
    if (X?.grab) this.drag(s, a);
    return true;
  }

  // echo-bubble by="tentacles": the sting jumps to the nearest other bug in reach for a share of the damage
  echo(s, a, b, Ec) {
    const other = this.inReach(a, this.reach, new Set([s.target]))[0];
    if (!other) return;
    const to = this.contact(other, b, this._c), size = LOOK.num('lash-glow-size', 0.03) * 0.5;
    for (let i = 1; i <= 5; i++) this.fx.glow.emit(this._tip.copy(b).lerp(to, i / 5), this.traceColor, size, size * 0.3, 0.2, 0.8);
    this.fx.impact(to, this.impactColor, LOOK.num('lash-impact-size', 0.016) * 0.7, 5);
    bus.emit('damage_taken', { targetId: other.id, amount: s.dmg * Ec.dmg, color: '#fff', source: 'tentacle', feedback: { crit: false } });
  }

  // the grab (Tape Measure) has landed: every other bug on the way to the jelly takes the sting too,
  // and the bug starts being reeled in (reelIn)
  drag(s, a) {
    const E = this.enemies, e = s.target, c = E.center(e, this._c), seg = this._d.copy(a).sub(c), len2 = seg.lengthSq();
    s.reel = { total: Math.max(0, Math.sqrt(len2) - e.r - STOP) };
    for (const o of E.list) {
      if (o === e || o.dead || o.proxy) continue;
      const p = E.center(o, this._tip), t = len2 > 0 ? THREE.MathUtils.clamp(this._e.copy(p).sub(c).dot(seg) / len2, 0, 1) : 0;
      if (this._e.copy(c).addScaledVector(seg, t).distanceTo(p) > o.r + e.r) continue;
      this.fx.impact(p, this.impactColor, LOOK.num('lash-impact-size', 0.016) * 0.8, 6);
      bus.emit('damage_taken', { targetId: o.id, amount: s.dmg, color: '#fff', source: 'tentacle', feedback: { crit: false } });
    }
  }

  // hauls the grabbed bug toward the jelly over the hold and retract (dt >= 1: all the way, now); where it
  // arrives, the slam: a flash, a thump and a shake
  reelIn(s, dt, a) {
    const R = s.reel, e = s.target;
    if (e.dead) { s.reel = null; return; }
    const c = this.enemies.center(e, this._c), left = Math.max(0, c.distanceTo(a) - e.r - STOP);
    const step = dt >= 1 ? left : Math.min(left, R.total * dt / (HOLD + RETRACT));
    if (step > 0) bus.emit('knockback', { targetId: e.id, dir: this._d.copy(a).sub(c).setY(0).normalize().clone(), force: step });
    if (step < left) return;
    s.reel = null;
    this.fx.impact(this.enemies.center(e, this._c), this.impactColor, LOOK.num('lash-impact-size', 0.016) * 1.6, 10);
    sfx.sting();
    juice.feel('hit-big');
  }
}

const UP = new THREE.Vector3(0, 1, 0);
