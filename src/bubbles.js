// Bubbles: the jelly's main attack. It blows a steady stream of small bubbles at the nearest
// enemy (blows per second = fire rate). With more than one bubble, each blow is that many
// bubbles side by side, leaving at the same moment and flying parallel (every bubble a little
// weaker: stats.js bubbleShare). Bubbles drift toward their target (steering a
// little, so they mostly land), pop on the first enemy they touch for damage plus a small
// splash, and pop harmlessly on walls or when they run out of range. Treasures hook in here.
//
// Element treasures are attacks of their own (elementVolley): each element you own fires its own
// projectile on its own timer, at the nearest enemy, separate from the bubbles:
//   fire (Birthday Candle)   a fireball: sets enemies burning; burning enemies that die set their
//                            neighbors alight. Fire on a frozen enemy shatters it: 3x.
//   lightning (AA Battery)   ball lightning: each pop chains a bolt to 3 more enemies, stunning them.
//   ice (Freezer Pack)       an ice shard: chills and slows; the 2nd chilled hit freezes it solid.
//   acid (Nail Polish)       an acid glob: leaves a bubbling puddle that eats at enemies and softens
//                            them (they take 50% more damage while in it).
//   wind (Paper Fan)         a fast crescent wind blade that hits across its whole width, pierces
//                            once more and blasts what it hits away.
//   glitter (Glitter)        a glitter bomb: a splash over twice as wide and much harder.
// Each element's numbers (rate, damage, burn, chain…) come from mods.element (ELEMENT_BASE in
// words.js, raised by its upgrade treasures), and scale with your stats: Bubble damage, Fire rate,
// Range, Bubble size and extra Bubbles all apply to them as they do to bubbles.
// Effect damage scales with "power" (bubble damage x 4.5); ELEMENT says each element's share of it.
import * as THREE from 'three';
import { sfx } from './sfx.js';
import { juice } from './juice.js';
import { bus } from './events.js';
import { batcher } from './batch.js';
import { FRIENDLY } from './vfx.js';
import { bubbleShare, BASE_STATS } from './stats.js';
import { BubbleLooks, WIND_ARC } from './bubble-looks.js';

const SPEED = 0.57;          // m/s: faster than you swim (0.42), slow enough to see them in the air
const RADIUS = 0.0065;       // m, at bubble size 1
const SPLASH = 0.026;        // m, splash radius at bubble size 1

export const ELEMENTS = [
  { id: 'fire', color: 0xff8a3a, text: '#ffa65a' },
  { id: 'lightning', color: 0xfff06a, text: '#fff27a' },
  { id: 'ice', color: 0x9fe8ff, text: '#bff4ff' },
  { id: 'acid', color: 0x8aff5a, text: '#a8ff7a' },
  { id: 'wind', color: 0xeef2ff, text: '#ffffff' },
  { id: 'glitter', color: 0xff9ae8, text: '#ffb0f0' },
];
const EL = Object.fromEntries(ELEMENTS.map((e) => [e.id, { ...e, glow: new THREE.Color(e.color) }]));
const GOLD = new THREE.Color(0xffd86a);
const _zero = new THREE.Vector3();
// share of power each element deals (see the top of the file)
export const ELEMENT = {
  burn: 0.17,       // fire: damage a second while burning (3 s)
  bolt: 0.09,       // lightning: each arc
  puddle: 0.012,    // acid: each tick of the puddle (every 0.5 s, halved)
  glitter: 0.08,    // glitter: the wide splash
};

// your starting Fire rate: element attacks fire faster as yours goes up
const BASE_FIRE_RATE = BASE_STATS.fireRate;

export class Bubbles {
  constructor(scene, enemies, fx, world) {
    Object.assign(this, { scene, enemies, fx, world });
    this.list = [];
    this.pool = [];
    this._dir = new THREE.Vector3();   // scratch for fly(): no garbage per bubble per frame
    this.grace = 0.03;                 // run.js: the jelly's radius
    this._c = new THREE.Vector3();
    this._t = new THREE.Vector3();     // scratch for touches()
    this.timer = 0;
    this.elTimers = {};               // each element attack's own firing timer
    this.volleys = 0;
    this.geo = new THREE.SphereGeometry(1, 20, 14);
    const film = (tint, glow) => new THREE.MeshPhysicalMaterial({
      color: tint, transparent: true, opacity: 0.6, roughness: 0.02, metalness: 0, clearcoat: 1,
      iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessRange: [150, 600],
      emissive: glow, emissiveIntensity: 0.6, depthWrite: false,
    });
    this.mat = film(0xcfeeff, 0x4aa8ff);
    this.looks = new BubbleLooks(scene, fx);   // the element projectiles
    this.clock = 0;
    this.burning = new Map();          // enemy -> seconds of fire left
    this.zaps = [];
    this.puddles = [];
    this.zapMat = new THREE.LineBasicMaterial({ color: 0xfff27a, transparent: true });
    this.acidMat = new THREE.MeshBasicMaterial({ color: 0x7aff4a, transparent: true, opacity: 0.55, depthWrite: false });
    this.puddleGeo = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
    this.shine = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
    this.goldMat = film(0xffe8a0, 0xffb020);
    this.onBlow = null;       // () => void, e.g. the bell's squeeze
    this.friendly = FRIENDLY();
  }

  reset() {
    this.list.forEach((b) => this.release(b));
    this.list = [];
    this.burning.clear();
    this.zaps.forEach((z) => this.scene.remove(z.line));
    this.puddles.forEach((p) => this.scene.remove(p.m));
    this.zaps = [];
    this.puddles = [];
    this.timer = 0;
    this.elTimers = {};
    this.volleys = 0;
  }

  release(b) {
    if (b.m.userData.look) { this.looks.release(b.m); return; }
    b.m.visible = false;
    this.pool.push(b.m);
  }

  mesh(mat) {
    let m = this.pool.pop();
    if (!m) {
      m = new THREE.Mesh(this.geo, mat);
      const glint = new THREE.Mesh(this.geo, this.shine);     // the white highlight that says "bubble"
      glint.scale.setScalar(0.22);
      glint.position.set(-0.4, 0.45, 0.4);
      m.add(glint);
      batcher.track(m);                // drawn instanced, glint and all (batch.js)
    }
    if (!m.parent) this.scene.add(m);
    m.material = mat;
    m.visible = true;
    return m;
  }

  inRange(origin, range, exclude) {
    const E = this.enemies, c = new THREE.Vector3(), out = [];
    for (const e of E.list) {
      if (e.dead || exclude?.has(e) || e.proxy?.shielded) continue;   // a shielded boss isn't worth a bubble
      const d = E.center(e, c).distanceTo(origin) - e.r;
      if (d <= range) out.push([d, e]);
    }
    return out.sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  }

  // origin: where bubbles leave the bell. mods: the combined effects of your treasures (words.js)
  // paused: a polyp (rebirth) doesn't shoot; what's already flying carries on
  update(dt, origin, stats, mods, paused = false) {
    this.origin = origin;              // where the polyps (adornments.js) circle
    if (paused) { this.fly(dt, stats, mods); this.effects(dt, stats); return; }
    // one blow at a time: a faster fire rate = a faster stream
    this.timer += dt * stats.fireRate;
    if (this.timer >= 1) {
      if (this.volley(origin, stats, mods)) this.timer -= 1;
      else this.timer = 1;            // ready, waiting for something in range
      this.timer = Math.min(this.timer, 1);
    }
    // each element you own fires on its own timer, at its own rate (scaled by your Fire rate)
    for (const id of this.elements(mods)) {
      const P = mods.element[id];
      if (!P) continue;
      let t = (this.elTimers[id] ??= Math.random() * 0.5) + dt * P.rate * stats.fireRate / BASE_FIRE_RATE;
      if (t >= 1) t = this.elementVolley(id, P, origin, stats, mods) ? t - 1 : 1;
      this.elTimers[id] = Math.min(t, 1);
    }
    this.fly(dt, stats, mods);
    this.effects(dt, stats);
  }

  // the elements you own, in the order of ELEMENTS
  elements(mods) { return ELEMENTS.filter((e) => mods.elements.has(e.id)).map((e) => e.id); }

  volley(origin, stats, mods) {
    const near = this.inRange(origin, stats.range);
    if (!near.length) return false;
    const target = near[0];
    this.volleys++;
    const n = this.volleys;
    const B = mods.bubbles;
    const golden = B.golden && n % B.golden.every === 0 ? B.golden.mult : 0;   // golden: its damage multiplier
    const size = stats.bubbleSize, elems = [], tint = null;   // bubbles are plain: elements fire their own shots
    // `bubbles` of them side by side, across the line to the target, all leaving now
    const count = Math.max(1, Math.round(stats.bubbles)), dmg = stats.bubbleDamage * bubbleShare(count);
    const spread = (Math.random() - 0.5) * 0.12, gap = Math.max(0.014, RADIUS * size * 2.6);
    const dir = this.enemies.center(target).sub(origin).setY(0);
    if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
    const across = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const pierce = B.pierce + Math.round(stats.pierce || 0);
    for (let k = 0; k < count; k++) {
      const off = across.clone().multiplyScalar((k - (count - 1) / 2) * gap);
      this.blow(origin.clone().add(off), target, { size, dmg, golden, elems, tint, pierce, spread, off });
    }
    // polyps (Man o' War): each blows one of the same at the enemy nearest it
    this.forPolyps(mods, origin, stats.range, (from, t, k) => this.blow(from, t, { size: size * 0.75, dmg: dmg * k, golden, elems, tint, pierce }));
    // Reed Stick: every 6th bubble is a giant, slow one
    const G = B.giant;
    if (G && n % G.every === 0) this.blow(origin, target, { size: size * G.size, dmg: stats.bubbleDamage * G.dmg, golden, elems, tint, pierce: 1, speed: G.speed, big: true });
    this.onBlow?.();
    return true;
  }

  // One shot of an element attack: `count` of its projectiles side by side (your extra Bubbles
  // plus its own), at the nearest enemy in its range
  elementVolley(id, P, origin, stats, mods) {
    const near = this.inRange(origin, stats.range * P.range);
    if (!near.length) return false;
    const target = near[0];
    const n = Math.max(1, Math.round(stats.bubbles)), count = n + Math.round(P.count), each = stats.bubbleDamage * bubbleShare(n);
    const dir = this.enemies.center(target).sub(origin).setY(0);
    if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
    const across = new THREE.Vector3(-dir.z, 0, dir.x).normalize(), gap = Math.max(0.016, RADIUS * stats.bubbleSize * 3);
    const spread = (Math.random() - 0.5) * 0.12;
    for (let k = 0; k < count; k++) {
      const off = across.clone().multiplyScalar((k - (count - 1) / 2) * gap);
      this.blow(origin.clone().add(off), target, { size: stats.bubbleSize, dmg: each * P.dmg, pw: each * 4.5, elems: [id], tint: id, ep: P, pierce: 1 + P.pierce, speed: P.speed, range: stats.range * P.range, spread, off });
    }
    this.forPolyps(mods, origin, stats.range * P.range, (from, t, k) => this.blow(from, t, { size: stats.bubbleSize * 0.75, dmg: each * P.dmg * k, pw: each * 4.5 * k, elems: [id], tint: id, ep: P, pierce: 1 + P.pierce, speed: P.speed, range: stats.range * P.range }));
    return true;
  }

  // Where polyp i of n circles (polyps word): around the bell, a little above it
  polypPos(i, n, origin, out = new THREE.Vector3()) {
    const a = this.clock * 1.8 + (i / n) * Math.PI * 2;
    return out.set(origin.x + Math.cos(a) * 0.055, origin.y + 0.012 + Math.sin(this.clock * 3 + i) * 0.004, origin.z + Math.sin(a) * 0.055);
  }
  // each polyp, with the enemy nearest it in `range` and its share of the damage
  forPolyps(mods, origin, range, shoot) {
    const Pl = mods.polyps;
    if (!Pl) return;
    for (let i = 0; i < Pl.count; i++) {
      const from = this.polypPos(i, Pl.count, origin), t = this.inRange(from, range)[0];
      if (t) shoot(from, t, Pl.dmg);
    }
  }

  // bubble-ring: `count` bubbles at once, evenly around you, flying straight out
  ring(origin, count, dmg, stats, mods) {
    const a0 = Math.random() * Math.PI * 2;
    for (let k = 0; k < count; k++) {
      const a = a0 + (k / count) * Math.PI * 2;
      this.blow(origin, null, { size: stats.bubbleSize, dmg, pierce: mods.bubbles.pierce, dir: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)) });
    }
    this.onBlow?.();
  }

  blow(origin, target, o) {
    const m = !o.golden && o.tint ? this.looks.get(o.tint) : this.mesh(o.golden ? this.goldMat : this.mat);
    m.position.copy(origin);
    const dir = o.dir ? o.dir.clone().normalize() : this.enemies.center(target).add(o.off || _zero).sub(origin).normalize();
    if (o.spread) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), o.spread);
    const b = {
      m, target, r: RADIUS * o.size, dmg: o.dmg, pw: o.pw ?? o.dmg * 4.5, golden: o.golden, ep: o.ep || null, range: o.range || 0,
      pierce: o.pierce, hit: new Set(), travel: 0, t: 0, big: !!o.big, child: !!o.child, wobble: Math.random() * 6,
      elems: new Set(o.elems || []), tint: o.tint, trailT: 0,
      off: o.off || null,               // its place beside the others in its blow: it aims that far to the side of the target
    };
    // a wind blade (bubble-looks.js) hits across its whole arc: this far to each side of its middle
    b.side = o.tint === 'wind' ? b.r * 1.3 * WIND_ARC : 0;
    b.speed = SPEED * (o.speed || 1);
    b.vel = dir.multiplyScalar(b.speed);
    b.homing = true;
    m.scale.setScalar(0.001);
    this.list.push(b);
    return b;
  }

  fly(dt, stats, mods) {
    this.clock += dt;
    this.looks.frame();
    const E = this.enemies, c = this._c;
    const maxTravel = stats.range * 1.4;
    for (const b of this.list) {
      b.t += dt;
      // steer gently toward the target while it lives, until the bubble has hit it (a piercing
      // bubble then flies straight on instead of turning back to it). Once it reaches its aim point
      // or flies past it, it stops steering and carries straight on: an outside bubble aims to the
      // side of the target, and circling back to that point it used to slow to a stop and hang
      // there for good. Steering only turns it: it keeps its speed.
      if (b.homing && b.target && !b.target.dead && !b.hit.has(b.target)) {
        E.center(b.target, c);
        if (b.off) c.add(b.off);                                       // side by side: keep its lane
        const to = c.sub(b.m.position), d = to.length();
        if (d < b.r * 2 || to.dot(b.vel) <= 0) b.homing = false;
        else b.vel.lerp(to.multiplyScalar(b.speed / d), 1 - Math.exp(-3 * dt)).setLength(b.speed);
      }
      const step = b.vel.length() * dt;
      // walls only count once the bubble has left the jelly's own body: blown from the top of the
      // bell while you're pressed under or against something, it would otherwise pop at once
      if (b.travel > this.grace && this.world.cast(b.m.position, this._dir.copy(b.vel).normalize(), step + b.r)) { this.pop(b, null, stats, mods); continue; }
      b.m.position.addScaledVector(b.vel, dt);
      b.m.position.y += Math.sin(b.t * 9 + b.wobble) * 0.004 * dt * 10;
      b.travel += step;
      if (b.m.userData.look) this.looks.update(b, dt, this.clock);   // an element projectile: its own look and particles
      else {
        // friendly fire glows cool (vfx.js): a soft halo in the bubble's colour, never an enemy's
        this.fx.glow.hold(b.m.position, b.golden ? GOLD : this.friendly, b.r * (b.big ? 6 : 5), b.golden ? 0.55 : 0.4);
        const grow = Math.min(1, b.t * 8);
        b.m.scale.set(b.r * grow * (1 + Math.sin(b.t * 14) * 0.06), b.r * grow * (1 - Math.sin(b.t * 14) * 0.06), b.r * grow);
      }
      // touching an enemy?
      for (const e of E.list) {
        if (e.dead || b.hit.has(e)) continue;
        if (this.touches(b, E.center(e, c), e.hitR || e.r)) {   // hitR: a millipede's ball
          b.hit.add(e);
          this.strike(b, e, mods);
          if (b.hit.size >= b.pierce) { this.pop(b, e, stats, mods); break; }
        }
      }
      const reach = b.range ? b.range * 1.4 : maxTravel;
      if (!b.done && (b.travel > reach || b.t > reach / b.speed + 0.5)) this.pop(b, null, stats, mods);   // out of range, or (whatever happened) too long in the air
    }
    this.looks.endFrame();
    const done = this.list.filter((b) => b.done);
    done.forEach((b) => this.release(b));
    if (done.length) this.list = this.list.filter((b) => !b.done);
  }

  // does bubble b touch an enemy at c with radius er? A plain bubble is a ball; a wind blade is a
  // flat bar across its flight, b.side to each side of its middle
  touches(b, c, er) {
    const p = b.m.position;
    if (!b.side) return c.distanceTo(p) < er + b.r;
    const d = this._t.copy(c).sub(p), v = b.vel, s = v.length();
    const along = (d.x * v.x + d.y * v.y + d.z * v.z) / s;
    const across = Math.sqrt(Math.max(0, d.lengthSq() - along * along));
    return Math.abs(along) < er + b.r && across < er + b.side;
  }

  // damage one enemy
  strike(b, e, mods) {
    const H = mods.hits.bubbles;
    let dmg = b.dmg * (b.golden || 1), color = b.golden ? '#ffd23a' : '#bfe8ff';
    if (H.crit && Math.random() < H.crit.chance) {
      dmg *= H.crit.mult; color = '#e6fbff';
      this.fx.crit(this.enemies.center(e), e.r);
      if (H.pin) bus.emit('status_applied', { targetId: e.id, status: 'pin', duration: H.pin });   // pin-on-crit
    }
    if (H.mark) bus.emit('status_applied', { targetId: e.id, status: 'mark', duration: H.mark });
    const el = b.elems, c = this.enemies.center(e), dir = b.vel.clone().setY(0).normalize();
    if (el.has('fire')) {
      // Shatter: fire on something frozen does triple damage and thaws it
      if (e.freezeT > 0) { sfx.shatter(); juice.shake(0.25); dmg *= 3; bus.emit('status_applied', { targetId: e.id, status: 'thaw' }); color = '#ffffff'; this.fx.ring(c, 0xbff4ff, e.r * 3.5, 0.4); this.fx.number(c.clone().setY(c.y + e.r * 2), 'SHATTER!', '#bff4ff', 18); }
      this.ignite(e, b.pw, b.ep);
    }
    if (el.has('ice') && !e.proxy) {
      this.fx.puff(c, 0xdff8ff, e.r * 1.6, 0.4);
      const t = b.ep?.chill ?? 2;
      if (e.freezeT > 0) dmg *= b.ep?.frozenMul ?? 1;      // Freezer Burn
      bus.emit('status_applied', { targetId: e.id, status: 'slow', duration: t });
      bus.emit('status_applied', { targetId: e.id, status: 'chill', duration: t });   // the 2nd chill freezes
    }
    if (el.has('wind') && !e.proxy) {
      bus.emit('knockback', { targetId: e.id, dir, force: 0.07 * (b.ep?.push ?? 1) });
      this.fx.ring(c.clone().setY(c.y - e.r), 0xffffff, e.r * 2.5, 0.25);
    }
    if (b.tint && color === '#bfe8ff') color = EL[b.tint].text;
    // a little shove in the direction the bubble was going
    if (!e.T.fly) bus.emit('knockback', { targetId: e.id, dir, force: 0.006 * (b.big ? 3 : 1) });
    bus.emit('damage_taken', { targetId: e.id, amount: dmg, color, source: 'bubble' });
  }

  // Burning enemies, lightning arcs and acid puddles
  effects(dt, stats) {
    const E = this.enemies, c = new THREE.Vector3();
    for (const [e, f] of this.burning) {
      if (e.dead) {
        // burning things that die set their neighbors alight
        this.burning.delete(e);
        if (!e.proxy) for (const n of this.inRange(E.center(e, c), f.ep?.spread ?? 0.06)) if (!this.burning.has(n)) { this.ignite(n, f.pw, f.ep); }
        continue;
      }
      f.t -= dt;
      f.tick = (f.tick || 0) - dt;
      f.flame = (f.flame || 0) - dt;
      if (f.flame <= 0) {                 // licking flames
        f.flame = 0.12;
        E.center(e, c);
        this.fx.puff(c.add(new THREE.Vector3((Math.random() - 0.5) * e.r, e.r * (0.4 + Math.random() * 0.6), (Math.random() - 0.5) * e.r)), Math.random() < 0.5 ? 0xff7a2a : 0xffc23a, e.r * 0.8, 0.3);
      }
      if (f.tick <= 0) { f.tick = 0.5; bus.emit('damage_taken', { targetId: e.id, amount: f.dps * 0.5, color: '#ffa65a', source: 'fire' }); }
      if (f.t <= 0) this.burning.delete(e);
    }
    for (const z of this.zaps) { z.t -= dt; z.line.material.opacity = Math.max(0, z.t / 0.2); if (z.t <= 0) { this.scene.remove(z.line); z.line.geometry.dispose(); } }
    this.zaps = this.zaps.filter((z) => z.t > 0);
    for (const p of this.puddles) {
      p.t -= dt;
      p.m.scale.setScalar(p.r * Math.min(1, p.t * 2, (p.life - 0.5 - p.t) * 6 + 0.3));
      p.tick -= dt;
      if (Math.random() < dt * 12) {       // it bubbles
        const a = Math.random() * 6.3, rr = Math.random() * p.r * 0.8;
        this.fx.puff(p.m.position.clone().add(new THREE.Vector3(Math.cos(a) * rr, 0.003, Math.sin(a) * rr)), 0x9aff6a, 0.005, 0.35);
      }
      if (p.tick <= 0) {
        p.tick = 0.5;
        for (const e of E.list) {
          if (e.dead) continue;
          E.center(e, c);
          if (Math.hypot(c.x - p.m.position.x, c.z - p.m.position.z) < p.r + e.r && Math.abs(c.y - e.r - p.m.position.y) < e.r + 0.03) {
            bus.emit('status_applied', { targetId: e.id, status: 'mark', duration: 0.6 });   // softened: +50% damage from everything
            bus.emit('damage_taken', { targetId: e.id, amount: p.dmg * 0.5, color: '#a8ff7a', source: 'acid' });
          }
        }
      }
      if (p.t <= 0) this.scene.remove(p.m);
    }
    this.puddles = this.puddles.filter((p) => p.t > 0);
  }

  // set an enemy burning: pw the power it was lit with, ep the fire attack's numbers
  ignite(e, pw, ep = null) {
    const had = this.burning.get(e);
    this.burning.set(e, { t: ep?.burnTime ?? 3, dps: pw * ELEMENT.burn * (ep?.burn ?? 1), pw, ep, tick: had?.tick ?? 0.25, flame: 0 });
  }

  zap(from, to) {
    const pts = [from.clone()];
    for (let k = 1; k < 5; k++) pts.push(from.clone().lerp(to, k / 5).add(new THREE.Vector3().randomDirection().multiplyScalar(0.006)));
    pts.push(to.clone());
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), this.zapMat.clone());
    this.scene.add(line);
    this.zaps.push({ line, t: 0.25 });
    const line2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((q, i) => (i && i < pts.length - 1 ? q.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(0.004)) : q))), this.zapMat.clone());
    this.scene.add(line2);
    this.zaps.push({ line: line2, t: 0.18 });
    this.fx.puff(to, 0xfff6a0, 0.012, 0.15);
  }

  pop(b, hitEnemy, stats, mods) {
    if (b.done) return;
    b.done = true;
    const p = b.m.position;
    this.fx.puff(p, b.golden ? 0xffe8a0 : 0xdff4ff, b.r * 2.2, 0.25);
    if (!hitEnemy) return;
    this.fx.impact(p, b.golden ? GOLD : b.tint ? EL[b.tint].glow : this.friendly, b.r * (b.big ? 2.6 : 1.8), b.big ? 12 : 6);   // a cool flash and sparks
    // pop: a splash of droplets, a plip, a tiny kick
    this.fx.burst(p, b.tint ? ['#ffffff', '#' + EL[b.tint].color.toString(16).padStart(6, '0')] : ['#dff4ff', '#9fd8ff', '#ffffff'], b.big ? 10 : 4, b.r * 0.35, 0.25, p.y - 0.03);
    sfx.pop(b.big);
    juice.shake(b.big ? 0.12 : 0.03);
    const el = b.elems;
    if (el.has('fire')) sfx.fire();
    if (el.has('lightning')) sfx.zap();
    if (el.has('acid')) sfx.acid();
    if (el.has('wind')) sfx.wind();
    // splash: a share of the damage to everything close by (Glitter: twice as wide, harder)
    const glitter = b.elems.has('glitter');
    const splash = SPLASH * (b.r / RADIUS) * (glitter ? b.ep?.width ?? 2.2 : 1), E = this.enemies, c = new THREE.Vector3();
    if (glitter) for (let k = 0; k < 6; k++) this.fx.puff(p.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(splash * 0.7)), [0xff9ae8, 0xffffff, 0xffe07a][k % 3], 0.005, 0.4);
    if (b.elems.has('fire')) { this.fx.puff(p, 0xff7a2a, b.r * 3, 0.35); this.fx.puff(p, 0xffd23a, b.r * 1.8, 0.25); }
    this.fx.ring(p.clone().setY(p.y - b.r), glitter ? 0xff9ae8 : b.tint ? EL[b.tint].color : 0xbfe8ff, splash, 0.3);
    for (const e of E.list) {
      if (e.dead || b.hit.has(e)) continue;
      if (E.center(e, c).distanceTo(p) >= splash + e.r) continue;
      if (glitter && b.ep?.slow) bus.emit('status_applied', { targetId: e.id, status: 'slow', duration: b.ep.slow });          // Glitter Glue
      if (b.ep?.frost && !e.proxy) bus.emit('status_applied', { targetId: e.id, status: 'chill', duration: b.ep.chill });     // Snow Globe
      bus.emit('damage_taken', { targetId: e.id, amount: glitter ? b.pw * ELEMENT.glitter * (b.ep?.splash ?? 1) : b.dmg * (b.big ? 0.8 : 0.4), color: glitter ? '#ffb0f0' : '#bfe8ff', source: 'splash' });
    }
    // Lightning: a bolt chains to 3 more enemies, stunning each
    if (b.elems.has('lightning')) {
      let from = p.clone();
      const hit = new Set(b.hit);
      for (let k = 0, n = b.ep?.chain ?? 3; k < n; k++) {
        const e = this.inRange(from, b.ep?.chainRange ?? 0.16, hit)[0];
        if (!e) break;
        hit.add(e);
        const to = E.center(e, c).clone();
        this.zap(from, to);
        bus.emit('damage_taken', { targetId: e.id, amount: b.pw * ELEMENT.bolt * (b.ep?.bolt ?? 1), color: '#fff27a', source: 'lightning' });
        bus.emit('status_applied', { targetId: e.id, status: 'stun', duration: b.ep?.stun ?? 0.5 });
        from = to;
      }
    }
    // Acid: leave a puddle that eats at anything standing in it
    if (b.elems.has('acid') && this.puddles.length < (b.ep?.puddles ?? 6)) {
      const h = this.world.castAll(p.clone(), new THREE.Vector3(0, -1, 0), 0.4);
      const m = new THREE.Mesh(this.puddleGeo, this.acidMat);
      m.position.copy(h ? h.point : p).setY((h ? h.point.y : p.y) + 0.0015);
      this.scene.add(m);
      const life = b.ep?.puddleTime ?? 3.5;
      this.puddles.push({ m, t: life, life, r: 0.05 * (b.r / RADIUS) * (b.ep?.puddleSize ?? 1), dmg: b.pw * ELEMENT.puddle * (b.ep?.puddleDmg ?? 1), tick: 0.25 });
      this.fx.puff(p, 0x7aff4a, b.r * 2.5, 0.3);
    }
    // zap-on-pop: now and then the pop snaps static to enemies close by, stunning them
    const Z = mods.popZap;
    if (Z && Math.random() < Z.chance) {
      for (const e of this.inRange(p, Z.range, b.hit).slice(0, Z.count)) {
        this.zap(p, E.center(e, c));
        bus.emit('status_applied', { targetId: e.id, status: 'stun', duration: Z.stun });
        if (Z.dmg) bus.emit('damage_taken', { targetId: e.id, amount: b.pw * Z.dmg, color: '#cfe8ff', source: 'static' });
      }
    }
    // echo-bubble: the pop fires again at the next enemy close by (once), at a share of its damage
    // (it starts inside the enemy it popped on: it skips the ones its parent already hit)
    const echo = mods.bubbles.echo;
    if (echo && !b.child) {
      const next = this.inRange(p, 0.2, b.hit)[0];
      if (next) { const k = this.blow(p, next, { size: b.r / RADIUS, dmg: b.dmg * echo.dmg, golden: b.golden, pierce: 1 }); k.child = true; k.hit = new Set(b.hit); k.pierce += b.hit.size; }
    }
  }
}
