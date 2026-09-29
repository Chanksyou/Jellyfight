// Bubbles: the jelly's main attack. Every so often it squeezes its bell and blows a volley of
// bubbles, each at a different nearby enemy. Bubbles drift toward their target (steering a
// little, so they mostly land), pop on the first enemy they touch for damage plus a small
// splash, and pop harmlessly on walls or when they run out of range. Treasures hook in here.
//
// Element treasures infuse the bubbles (all of them stack; each bubble is tinted one of them):
//   fire (Birthday Candle)   sets enemies burning for 3 s. Fire on a frozen enemy shatters it: 3x.
//   lightning (AA Battery)   each pop arcs to 2 more enemies nearby.
//   ice (Freezer Pack)       chills; the 3rd chilled hit freezes the enemy for 1.5 s.
//   acid (Nail Polish)       pops leave a puddle of acid that eats at anything in it.
//   wind (Paper Fan)         blows what it hits backward.
//   glitter (Glitter)        a splash twice as wide and harder.
import * as THREE from 'three';

const SPEED = 0.5;           // m/s
const RADIUS = 0.011;        // m, at bubble size 1
const SPLASH = 0.03;         // m, splash radius at bubble size 1

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
    this.timer = 0;
    this.volleys = 0;
    this.geo = new THREE.SphereGeometry(1, 20, 14);
    const film = (tint, glow) => new THREE.MeshPhysicalMaterial({
      color: tint, transparent: true, opacity: 0.6, roughness: 0.02, metalness: 0, clearcoat: 1,
      iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessRange: [150, 600],
      emissive: glow, emissiveIntensity: 0.6, depthWrite: false,
    });
    this.mat = film(0xcfeeff, 0x4aa8ff);
    this.elemMats = Object.fromEntries(ELEMENTS.map((e) => [e.id, film(e.color, e.color)]));
    this.burning = new Map();          // enemy -> seconds of fire left
    this.zaps = [];
    this.puddles = [];
    this.zapMat = new THREE.LineBasicMaterial({ color: 0xfff27a, transparent: true });
    this.acidMat = new THREE.MeshBasicMaterial({ color: 0x7aff4a, transparent: true, opacity: 0.4, depthWrite: false });
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
    this.timer += dt * stats.blowRate;
    if (this.timer >= 1) {
      if (this.volley(origin, stats, has)) this.timer = 0;
      else this.timer = 1;            // ready, waiting for something in range
    }
    this.fly(dt, stats, has);
    this.effects(dt, stats);
  }

  // the elements you own, in the order of ELEMENTS
  elements(has) { return ELEMENTS.filter((e) => has.has(e.treasure)).map((e) => e.id); }

  volley(origin, stats, has) {
    const targets = this.inRange(origin, stats.range).slice(0, stats.bubbles);
    if (!targets.length) return false;
    this.volleys++;
    const golden = has.has('goldRing') && this.volleys % 10 === 0;
    const size = stats.bubbleSize, elems = this.elements(has);
    const tint = (i) => (elems.length ? elems[(this.volleys + i) % elems.length] : null);
    targets.forEach((t, i) => this.blow(origin, t, { size, dmg: stats.pop, golden, elems, tint: tint(i), pierce: has.has('bobbyPin') ? 3 : 1, spread: (i - (targets.length - 1) / 2) * 0.25 }));
    // Reed Stick: every other volley adds one giant, slow bubble
    if (has.has('reedStick') && this.volleys % 2 === 0) this.blow(origin, targets[0], { size: size * 2.5, dmg: stats.pop * 2.5, golden, elems, tint: tint(7), pierce: 1, speed: 0.6, big: true });
    this.onBlow?.();
    return true;
  }

  blow(origin, target, o) {
    const m = this.mesh(o.golden ? this.goldMat : o.tint ? this.elemMats[o.tint] : this.mat);
    m.position.copy(origin);
    const dir = this.enemies.center(target).sub(origin).normalize();
    if (o.spread) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), o.spread);
    const b = {
      m, target, vel: dir.multiplyScalar(SPEED * (o.speed || 1)), r: RADIUS * o.size, dmg: o.dmg, golden: o.golden,
      pierce: o.pierce, hit: new Set(), travel: 0, t: 0, big: !!o.big, child: !!o.child, wobble: Math.random() * 6,
      elems: new Set(o.elems || []), tint: o.tint,
    };
    m.scale.setScalar(0.001);
    this.list.push(b);
    return b;
  }

  fly(dt, stats, has) {
    const E = this.enemies, c = new THREE.Vector3();
    const maxTravel = stats.range * 1.4;
    for (const b of this.list) {
      b.t += dt;
      // steer gently toward the target while it lives
      if (b.target && !b.target.dead) {
        const want = E.center(b.target, c).sub(b.m.position).normalize().multiplyScalar(b.vel.length());
        b.vel.lerp(want, 1 - Math.exp(-3 * dt));
      }
      const step = b.vel.length() * dt;
      if (this.world.cast(b.m.position, b.vel.clone().normalize(), step + b.r)) { this.pop(b, null, stats, has); continue; }
      b.m.position.addScaledVector(b.vel, dt);
      b.m.position.y += Math.sin(b.t * 9 + b.wobble) * 0.004 * dt * 10;
      b.travel += step;
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
    if (has.has('qtip') && !e.proxy) e.slowT = 2;
    if (has.has('stickyNote') && !e.proxy) e.markT = 3;
    const el = b.elems, c = this.enemies.center(e);
    if (el.has('fire')) {
      // Shatter: fire on something frozen does triple damage and thaws it
      if (e.freezeT > 0) { dmg *= 3; e.freezeT = 0; color = '#ffffff'; this.fx.ring(c, 0xbff4ff, e.r * 3, 0.35); this.fx.number(c.clone().setY(c.y + e.r * 2), 'SHATTER', '#bff4ff', 15); }
      this.burning.set(e, { t: 3, dps: b.dmg * 0.35 });
    }
    if (el.has('ice') && !e.proxy) {
      e.slowT = Math.max(e.slowT || 0, 1.5);
      e.chill = (e.chill || 0) + 1;
      if (e.chill >= 3) { e.chill = 0; e.freezeT = 1.5; this.fx.ring(c, 0x9fe8ff, e.r * 2.5, 0.4); }
    }
    if (el.has('wind') && !e.proxy) e.pos.addScaledVector(b.vel.clone().setY(0).normalize(), 0.035);
    if (b.tint && color === '#bfe8ff') color = EL[b.tint].text;
    this.enemies.damage(e, dmg, color);
  }

  // Burning enemies, lightning arcs and acid puddles
  effects(dt, stats) {
    const E = this.enemies, c = new THREE.Vector3();
    for (const [e, f] of this.burning) {
      if (e.dead) { this.burning.delete(e); continue; }
      f.t -= dt;
      f.tick = (f.tick || 0) - dt;
      if (f.tick <= 0) {
        f.tick = 0.5;
        E.damage(e, f.dps * 0.5, '#ffa65a');
        this.fx.puff(E.center(e, c).setY(c.y + e.r * 0.6), 0xff7a2a, e.r * 0.9, 0.35);
      }
      if (f.t <= 0) this.burning.delete(e);
    }
    for (const z of this.zaps) { z.t -= dt; z.line.material.opacity = Math.max(0, z.t / 0.2); if (z.t <= 0) { this.scene.remove(z.line); z.line.geometry.dispose(); } }
    this.zaps = this.zaps.filter((z) => z.t > 0);
    for (const p of this.puddles) {
      p.t -= dt;
      p.m.scale.setScalar(p.r * Math.min(1, p.t * 2, (3 - p.t) * 6 + 0.3));
      p.tick -= dt;
      if (p.tick <= 0) {
        p.tick = 0.5;
        for (const e of E.list) {
          if (e.dead) continue;
          E.center(e, c);
          if (Math.hypot(c.x - p.m.position.x, c.z - p.m.position.z) < p.r + e.r && Math.abs(c.y - e.r - p.m.position.y) < e.r + 0.03) E.damage(e, p.dmg * 0.5, '#a8ff7a');
        }
      }
      if (p.t <= 0) this.scene.remove(p.m);
    }
    this.puddles = this.puddles.filter((p) => p.t > 0);
  }

  zap(from, to) {
    const pts = [from.clone()];
    for (let k = 1; k < 5; k++) pts.push(from.clone().lerp(to, k / 5).add(new THREE.Vector3().randomDirection().multiplyScalar(0.006)));
    pts.push(to.clone());
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), this.zapMat.clone());
    this.scene.add(line);
    this.zaps.push({ line, t: 0.2 });
  }

  pop(b, hitEnemy, stats, has) {
    if (b.done) return;
    b.done = true;
    const p = b.m.position;
    this.fx.puff(p, b.golden ? 0xffe8a0 : 0xdff4ff, b.r * 2.2, 0.25);
    if (!hitEnemy) return;
    // splash: a share of the damage to everything close by (Glitter: twice as wide, harder)
    const glitter = b.elems.has('glitter');
    const splash = SPLASH * (b.r / RADIUS) * (glitter ? 2 : 1), E = this.enemies, c = new THREE.Vector3();
    this.fx.ring(p.clone().setY(p.y - b.r), glitter ? 0xff9ae8 : b.tint ? EL[b.tint].color : 0xbfe8ff, splash, 0.3);
    for (const e of E.list) {
      if (e.dead || b.hit.has(e)) continue;
      if (E.center(e, c).distanceTo(p) < splash + e.r) E.damage(e, b.dmg * (b.big ? 0.8 : 0.4) * (glitter ? 1.5 : 1), glitter ? '#ffb0f0' : '#bfe8ff');
    }
    // Lightning: arc to 2 more enemies nearby
    if (b.elems.has('lightning')) {
      for (const e of this.inRange(p, 0.14, b.hit).slice(0, 2)) {
        this.zap(p, E.center(e, c));
        E.damage(e, b.dmg * 0.6, '#fff27a');
      }
    }
    // Acid: leave a puddle that eats at anything standing in it
    if (b.elems.has('acid') && this.puddles.length < 6) {
      const h = this.world.castAll(p.clone(), new THREE.Vector3(0, -1, 0), 0.4);
      const m = new THREE.Mesh(this.puddleGeo, this.acidMat);
      m.position.copy(h ? h.point : p).setY((h ? h.point.y : p.y) + 0.0015);
      this.scene.add(m);
      this.puddles.push({ m, t: 3, r: 0.035 * (b.r / RADIUS), dmg: b.dmg * 0.8, tick: 0.25 });
    }
    // Hair Tie: a smaller bubble spins off toward another enemy, once
    if (has.has('hairTie') && !b.child) {
      const next = this.inRange(p, 0.15, b.hit)[0];
      if (next) { const k = this.blow(p, next, { size: b.r / RADIUS * 0.7, dmg: b.dmg * 0.7, golden: b.golden, pierce: 1 }); k.child = true; }
    }
  }
}
