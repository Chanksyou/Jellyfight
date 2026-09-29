// Bubbles: the jelly's main attack. Every so often it squeezes its bell and blows a volley of
// bubbles, each at a different nearby enemy. Bubbles drift toward their target (steering a
// little, so they mostly land), pop on the first enemy they touch for damage plus a small
// splash, and pop harmlessly on walls or when they run out of range. Treasures hook in here.
import * as THREE from 'three';

const SPEED = 0.5;           // m/s
const RADIUS = 0.011;        // m, at bubble size 1
const SPLASH = 0.03;         // m, splash radius at bubble size 1

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
    this.shine = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
    this.goldMat = film(0xffe8a0, 0xffb020);
    this.onBlow = null;       // () => void, e.g. the bell's squeeze
  }

  reset() {
    this.list.forEach((b) => this.release(b));
    this.list = [];
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
  }

  volley(origin, stats, has) {
    const targets = this.inRange(origin, stats.range).slice(0, stats.bubbles);
    if (!targets.length) return false;
    this.volleys++;
    const golden = has.has('goldRing') && this.volleys % 10 === 0;
    const size = stats.bubbleSize;
    targets.forEach((t, i) => this.blow(origin, t, { size, dmg: stats.pop, golden, pierce: has.has('bobbyPin') ? 3 : 1, spread: (i - (targets.length - 1) / 2) * 0.25 }));
    // Reed Stick: every other volley adds one giant, slow bubble
    if (has.has('reedStick') && this.volleys % 2 === 0) this.blow(origin, targets[0], { size: size * 2.5, dmg: stats.pop * 2.5, golden, pierce: 1, speed: 0.6, big: true });
    this.onBlow?.();
    return true;
  }

  blow(origin, target, o) {
    const m = this.mesh(o.golden ? this.goldMat : this.mat);
    m.position.copy(origin);
    const dir = this.enemies.center(target).sub(origin).normalize();
    if (o.spread) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), o.spread);
    const b = {
      m, target, vel: dir.multiplyScalar(SPEED * (o.speed || 1)), r: RADIUS * o.size, dmg: o.dmg, golden: o.golden,
      pierce: o.pierce, hit: new Set(), travel: 0, t: 0, big: !!o.big, child: !!o.child, wobble: Math.random() * 6,
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
    this.enemies.damage(e, dmg, color);
  }

  pop(b, hitEnemy, stats, has) {
    if (b.done) return;
    b.done = true;
    const p = b.m.position;
    this.fx.puff(p, b.golden ? 0xffe8a0 : 0xdff4ff, b.r * 2.2, 0.25);
    if (!hitEnemy) return;
    // splash: a share of the damage to everything close by
    const splash = SPLASH * (b.r / RADIUS), E = this.enemies, c = new THREE.Vector3();
    this.fx.ring(p.clone().setY(p.y - b.r), 0xbfe8ff, splash, 0.3);
    for (const e of E.list) {
      if (e.dead || b.hit.has(e)) continue;
      if (E.center(e, c).distanceTo(p) < splash + e.r) E.damage(e, b.dmg * (b.big ? 0.8 : 0.4), '#bfe8ff');
    }
    // Hair Tie: a smaller bubble spins off toward another enemy, once
    if (has.has('hairTie') && !b.child) {
      const next = this.inRange(p, 0.15, b.hit)[0];
      if (next) { const k = this.blow(p, next, { size: b.r / RADIUS * 0.7, dmg: b.dmg * 0.7, golden: b.golden, pierce: 1 }); k.child = true; }
    }
  }
}
