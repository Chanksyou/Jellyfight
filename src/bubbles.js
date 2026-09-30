// Bubbles: the jelly's main attack. It blows a steady stream of small bubbles, one after
// another (shots per second = blow rate x bubbles), each at the next of the nearest enemies. Bubbles drift toward their target (steering a
// little, so they mostly land), pop on the first enemy they touch for damage plus a small
// splash, and pop harmlessly on walls or when they run out of range. Treasures hook in here.
//
// Element treasures infuse the bubbles (all of them stack; each bubble is tinted one of them):
//   fire (Birthday Candle)   bursts into flame and sets enemies burning; burning enemies that die
//                            set their neighbors alight. Fire on a frozen enemy shatters it: 3x.
//   lightning (AA Battery)   each pop chains a bolt to 3 more enemies and stuns them briefly.
//   ice (Freezer Pack)       chills and slows; the 2nd chilled hit freezes the enemy solid for 2 s.
//   acid (Nail Polish)       pops leave a bubbling puddle that eats at enemies and softens them
//                            (they take 50% more damage while in it).
//   wind (Paper Fan)         faster bubbles that pierce once more and blast what they hit away.
//   glitter (Glitter)        a sparkling burst: splash over twice as wide and much harder.
// Every element bubble leaves a trail of its color, so you can tell them apart in flight.
// Element damage scales with "power" (pop damage x 4.5), so it stays strong with fast, light bubbles.
import * as THREE from 'three';
import { sfx } from './sfx.js';
import { juice } from './juice.js';
import { bus } from './events.js';
import { batcher } from './batch.js';

const SPEED = 0.38;          // m/s: slow enough that you see a stream of them in the air
const RADIUS = 0.0065;       // m, at bubble size 1
const SPLASH = 0.026;        // m, splash radius at bubble size 1

export const ELEMENTS = [
  { id: 'fire', treasure: 'candle', color: 0xff8a3a, text: '#ffa65a' },
  { id: 'lightning', treasure: 'battery', color: 0xfff06a, text: '#fff27a' },
  { id: 'ice', treasure: 'freezerPack', color: 0x9fe8ff, text: '#bff4ff' },
  { id: 'acid', treasure: 'nailPolish', color: 0x8aff5a, text: '#a8ff7a' },
  { id: 'wind', treasure: 'paperFan', color: 0xeef2ff, text: '#ffffff' },
  { id: 'glitter', treasure: 'glitter', color: 0xff9ae8, text: '#ffb0f0' },
];
const EL = Object.fromEntries(ELEMENTS.map((e) => [e.id, e]));

export class Bubbles {
  constructor(scene, enemies, fx, world) {
    Object.assign(this, { scene, enemies, fx, world });
    this.list = [];
    this.pool = [];
    this._dir = new THREE.Vector3();   // scratch for fly(): no garbage per bubble per frame
    this._c = new THREE.Vector3();
    this.timer = 0;
    this.volleys = 0;
    this.geo = new THREE.SphereGeometry(1, 20, 14);
    const film = (tint, glow) => new THREE.MeshPhysicalMaterial({
      color: tint, transparent: true, opacity: 0.6, roughness: 0.02, metalness: 0, clearcoat: 1,
      iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessRange: [150, 600],
      emissive: glow, emissiveIntensity: 0.6, depthWrite: false,
    });
    this.mat = film(0xcfeeff, 0x4aa8ff);
    this.elemMats = Object.fromEntries(ELEMENTS.map((e) => { const m = film(e.color, e.color); m.emissiveIntensity = 1.6; m.opacity = 0.75; return [e.id, m]; }));
    this.burning = new Map();          // enemy -> seconds of fire left
    this.zaps = [];
    this.puddles = [];
    this.zapMat = new THREE.LineBasicMaterial({ color: 0xfff27a, transparent: true });
    this.acidMat = new THREE.MeshBasicMaterial({ color: 0x7aff4a, transparent: true, opacity: 0.55, depthWrite: false });
    this.puddleGeo = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
    this.shine = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
    this.goldMat = film(0xffe8a0, 0xffb020);
    this.onBlow = null;       // () => void, e.g. the bell's squeeze
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
    this.volleys = 0;
  }

  release(b) { b.m.visible = false; this.pool.push(b.m); }

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
      if (e.dead || exclude?.has(e)) continue;
      const d = E.center(e, c).distanceTo(origin) - e.r;
      if (d <= range) out.push([d, e]);
    }
    return out.sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  }

  // origin: where bubbles leave the bell. has: owned treasure ids.
  update(dt, origin, stats, has) {
    // one bubble at a time: more bubbles or a faster blow rate = a faster stream
    this.timer += dt * stats.blowRate * stats.bubbles;
    if (this.timer >= 1) {
      if (this.volley(origin, stats, has)) this.timer -= 1;
      else this.timer = 1;            // ready, waiting for something in range
      this.timer = Math.min(this.timer, 1);
    }
    this.fly(dt, stats, has);
    this.effects(dt, stats);
  }

  // the elements you own, in the order of ELEMENTS
  elements(has) { return ELEMENTS.filter((e) => has.has(e.treasure)).map((e) => e.id); }

  volley(origin, stats, has) {
    const near = this.inRange(origin, stats.range);
    if (!near.length) return false;
    // the next of the nearest `bubbles` enemies, in turn
    const target = near[this.volleys % Math.min(near.length, stats.bubbles)];
    this.volleys++;
    const n = this.volleys;
    const golden = has.has('goldRing') && n % 10 === 0;
    const size = stats.bubbleSize, elems = this.elements(has);
    const tint = elems.length ? elems[n % elems.length] : null;
    this.blow(origin, target, { size, dmg: stats.pop, golden, elems, tint, pierce: has.has('bobbyPin') ? 3 : 1, spread: (Math.random() - 0.5) * 0.12 });
    // Reed Stick: every 6th bubble is a giant, slow one
    if (has.has('reedStick') && n % 6 === 0) this.blow(origin, target, { size: size * 2.5, dmg: stats.pop * 4, golden, elems, tint, pierce: 1, speed: 0.6, big: true });
    this.onBlow?.();
    return true;
  }

  blow(origin, target, o) {
    const m = this.mesh(o.golden ? this.goldMat : o.tint ? this.elemMats[o.tint] : this.mat);
    m.position.copy(origin);
    const dir = this.enemies.center(target).sub(origin).normalize();
    if (o.spread) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), o.spread);
    const b = {
      m, target, r: RADIUS * o.size, dmg: o.dmg, pw: o.dmg * 4.5, golden: o.golden,
      pierce: o.pierce, hit: new Set(), travel: 0, t: 0, big: !!o.big, child: !!o.child, wobble: Math.random() * 6,
      elems: new Set(o.elems || []), tint: o.tint, trailT: 0,
    };
    const wind = b.elems.has('wind');
    b.vel = dir.multiplyScalar(SPEED * (o.speed || 1) * (wind ? 1.4 : 1));
    if (wind) b.pierce += 1;
    m.scale.setScalar(0.001);
    this.list.push(b);
    return b;
  }

  fly(dt, stats, has) {
    const E = this.enemies, c = this._c;
    const maxTravel = stats.range * 1.4;
    for (const b of this.list) {
      b.t += dt;
      // steer gently toward the target while it lives
      if (b.target && !b.target.dead) {
        const want = E.center(b.target, c).sub(b.m.position).normalize().multiplyScalar(b.vel.length());
        b.vel.lerp(want, 1 - Math.exp(-3 * dt));
      }
      const step = b.vel.length() * dt;
      if (this.world.cast(b.m.position, this._dir.copy(b.vel).normalize(), step + b.r)) { this.pop(b, null, stats, has); continue; }
      b.m.position.addScaledVector(b.vel, dt);
      b.m.position.y += Math.sin(b.t * 9 + b.wobble) * 0.004 * dt * 10;
      b.travel += step;
      // a trail in the element's color
      if (b.tint && (b.trailT -= dt) <= 0) {
        b.trailT = 0.06;
        this.fx.puff(b.m.position.clone().addScaledVector(b.vel, -0.03), EL[b.tint].color, b.r * (b.tint === 'fire' ? 0.9 : 0.6), b.tint === 'fire' ? 0.35 : 0.25);
      }
      if (b.tint === 'lightning') b.m.material.emissiveIntensity = 1 + Math.random() * 2;   // crackles
      const grow = Math.min(1, b.t * 8);
      b.m.scale.set(b.r * grow * (1 + Math.sin(b.t * 14) * 0.06), b.r * grow * (1 - Math.sin(b.t * 14) * 0.06), b.r * grow);
      // touching an enemy?
      for (const e of E.list) {
        if (e.dead || b.hit.has(e)) continue;
        if (E.center(e, c).distanceTo(b.m.position) < e.r + b.r) {
          b.hit.add(e);
          this.strike(b, e, has);
          if (b.hit.size >= b.pierce) { this.pop(b, e, stats, has); break; }
        }
      }
      if (!b.done && b.travel > maxTravel) this.pop(b, null, stats, has);
    }
    const done = this.list.filter((b) => b.done);
    done.forEach((b) => this.release(b));
    if (done.length) this.list = this.list.filter((b) => !b.done);
  }

  // damage one enemy
  strike(b, e, has) {
    let dmg = b.dmg * (b.golden ? 5 : 1), color = b.golden ? '#ffd23a' : '#bfe8ff';
    if (has.has('nailClipper') && Math.random() < 0.2) { dmg *= 3; color = '#ff6b6b'; }
    if (has.has('qtip')) bus.emit('status_applied', { targetId: e.id, status: 'slow', duration: 2 });
    if (has.has('stickyNote')) bus.emit('status_applied', { targetId: e.id, status: 'mark', duration: 3 });
    const el = b.elems, c = this.enemies.center(e), dir = b.vel.clone().setY(0).normalize();
    if (el.has('fire')) {
      // Shatter: fire on something frozen does triple damage and thaws it
      if (e.freezeT > 0) { sfx.shatter(); juice.shake(0.25); dmg *= 3; bus.emit('status_applied', { targetId: e.id, status: 'thaw' }); color = '#ffffff'; this.fx.ring(c, 0xbff4ff, e.r * 3.5, 0.4); this.fx.number(c.clone().setY(c.y + e.r * 2), 'SHATTER!', '#bff4ff', 18); }
      this.ignite(e, b.pw);
    }
    if (el.has('ice') && !e.proxy) {
      this.fx.puff(c, 0xdff8ff, e.r * 1.6, 0.4);
      bus.emit('status_applied', { targetId: e.id, status: 'slow', duration: 2 });
      bus.emit('status_applied', { targetId: e.id, status: 'chill', duration: 2 });   // the 2nd chill freezes
    }
    if (el.has('wind') && !e.proxy) {
      bus.emit('knockback', { targetId: e.id, dir, force: 0.07 });
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
        if (!e.proxy) for (const n of this.inRange(E.center(e, c), 0.06)) if (!this.burning.has(n)) { this.ignite(n, f.dps / 0.5); }
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
      p.m.scale.setScalar(p.r * Math.min(1, p.t * 2, (3 - p.t) * 6 + 0.3));
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

  ignite(e, pw) {
    const had = this.burning.get(e);
    this.burning.set(e, { t: 3, dps: pw * 0.5, tick: had?.tick ?? 0.25, flame: 0 });
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

  pop(b, hitEnemy, stats, has) {
    if (b.done) return;
    b.done = true;
    const p = b.m.position;
    this.fx.puff(p, b.golden ? 0xffe8a0 : 0xdff4ff, b.r * 2.2, 0.25);
    if (!hitEnemy) return;
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
    const splash = SPLASH * (b.r / RADIUS) * (glitter ? 2.2 : 1), E = this.enemies, c = new THREE.Vector3();
    if (glitter) for (let k = 0; k < 6; k++) this.fx.puff(p.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(splash * 0.7)), [0xff9ae8, 0xffffff, 0xffe07a][k % 3], 0.005, 0.4);
    if (b.elems.has('fire')) { this.fx.puff(p, 0xff7a2a, b.r * 3, 0.35); this.fx.puff(p, 0xffd23a, b.r * 1.8, 0.25); }
    this.fx.ring(p.clone().setY(p.y - b.r), glitter ? 0xff9ae8 : b.tint ? EL[b.tint].color : 0xbfe8ff, splash, 0.3);
    for (const e of E.list) {
      if (e.dead || b.hit.has(e)) continue;
      if (E.center(e, c).distanceTo(p) < splash + e.r) bus.emit('damage_taken', { targetId: e.id, amount: glitter ? b.pw * 0.45 : b.dmg * (b.big ? 0.8 : 0.4), color: glitter ? '#ffb0f0' : '#bfe8ff', source: 'splash' });
    }
    // Lightning: a bolt chains to 3 more enemies, stunning each
    if (b.elems.has('lightning')) {
      let from = p.clone();
      const hit = new Set(b.hit);
      for (let k = 0; k < 3; k++) {
        const e = this.inRange(from, 0.16, hit)[0];
        if (!e) break;
        hit.add(e);
        const to = E.center(e, c).clone();
        this.zap(from, to);
        bus.emit('damage_taken', { targetId: e.id, amount: b.pw * 0.5, color: '#fff27a', source: 'lightning' });
        bus.emit('status_applied', { targetId: e.id, status: 'stun', duration: 0.5 });
        from = to;
      }
    }
    // Acid: leave a puddle that eats at anything standing in it
    if (b.elems.has('acid') && this.puddles.length < 6) {
      const h = this.world.castAll(p.clone(), new THREE.Vector3(0, -1, 0), 0.4);
      const m = new THREE.Mesh(this.puddleGeo, this.acidMat);
      m.position.copy(h ? h.point : p).setY((h ? h.point.y : p.y) + 0.0015);
      this.scene.add(m);
      this.puddles.push({ m, t: 3.5, r: 0.05 * (b.r / RADIUS), dmg: b.pw * 0.35, tick: 0.25 });
      this.fx.puff(p, 0x7aff4a, b.r * 2.5, 0.3);
    }
    // Hair Tie: a smaller bubble spins off toward another enemy, once
    if (has.has('hairTie') && !b.child) {
      const next = this.inRange(p, 0.15, b.hit)[0];
      if (next) { const k = this.blow(p, next, { size: b.r / RADIUS * 0.7, dmg: b.dmg * 0.7, golden: b.golden, pierce: 1 }); k.child = true; }
    }
  }
}
