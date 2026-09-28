// Lash: the jelly's automatic attack. Every so often each tentacle whips out at a
// different nearby enemy, stings, and snaps back. Treasures hook in here.
import * as THREE from 'three';

const EXTEND = 0.07, HOLD = 0.04, RETRACT = 0.12;   // seconds

export class Lash {
  constructor(scene, enemies, fx) {
    this.scene = scene;
    this.enemies = enemies;
    this.fx = fx;
    this.timer = 0;
    this.count = 0;               // lashes so far (Gold Ring)
    this.strikes = [];            // tentacles currently out
    this.pool = [];
    this.geo = new THREE.CylinderGeometry(1, 0.55, 1, 6, 1).translate(0, 0.5, 0); // base at 0, tip at 1
    this.mat = new THREE.MeshStandardMaterial({ color: 0xffb8e0, emissive: 0xff6fb5, emissiveIntensity: 0.6, roughness: 0.3 });
    this.goldMat = new THREE.MeshStandardMaterial({ color: 0xffe07a, emissive: 0xffc23a, emissiveIntensity: 1.2, roughness: 0.3 });
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
  }

  reset() {
    this.timer = 0;
    this.count = 0;
    this.strikes.forEach((s) => { s.mesh.visible = false; });
    this.strikes = [];
  }

  mesh() {
    const m = this.pool.pop() || new THREE.Mesh(this.geo, this.mat);
    if (!m.parent) this.scene.add(m);
    m.visible = true;
    return m;
  }

  // origin: world position tentacles come from. has: set of treasure ids.
  update(dt, origin, stats, has, mods) {
    const speed = stats.lashSpeed * (mods.lashSpeedMul || 1);
    this.timer += dt * speed;
    if (this.timer >= 1) {
      if (this.fire(origin, stats, has)) this.timer = 0;
      else this.timer = 1; // ready, waiting for something in reach
    }
    this.animate(dt, origin);
  }

  inReach(origin, reach, exclude) {
    const out = [];
    for (const e of this.enemies.list) {
      if (e.dead || exclude?.has(e)) continue;
      const d = this.enemies.center(e, this._a).distanceTo(origin) - e.r;
      if (d <= reach) out.push([d, e]);
    }
    return out.sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  }

  fire(origin, stats, has) {
    const lance = has.has('reedStick');
    const normal = lance ? Math.max(0, stats.tentacles - 1) : stats.tentacles;
    const targets = this.inReach(origin, stats.reach).slice(0, normal);
    let lanceTarget = null;
    if (lance && this.count % 2 === 0) {
      lanceTarget = this.inReach(origin, stats.reach * 2, new Set(targets))[0] || null;
    }
    if (!targets.length && !lanceTarget) return false;

    this.count++;
    const golden = has.has('goldRing') && this.count % 10 === 0;
    const dmg = stats.sting * (golden ? 5 : 1);
    for (const e of targets) this.strike(origin, e, dmg, golden, has, stats);
    if (lanceTarget) this.strike(origin, lanceTarget, dmg, golden, has, stats, true);
    return true;
  }

  strike(from, target, dmg, golden, has, stats, lance = false) {
    const m = this.mesh();
    m.material = golden ? this.goldMat : this.mat;
    this.strikes.push({ mesh: m, target, from: from.clone(), fixedFrom: null, t: 0, dmg, golden, hit: false, has, stats, lance, chained: false });
  }

  animate(dt, origin) {
    for (const s of this.strikes) {
      s.t += dt;
      const a = s.fixedFrom || origin;
      const b = this.enemies.center(s.target, this._b);
      if (!s.hit && s.t >= EXTEND) { s.hit = true; this.land(s, a, b); }
      const k = s.t < EXTEND ? s.t / EXTEND : s.t < EXTEND + HOLD ? 1 : 1 - (s.t - EXTEND - HOLD) / RETRACT;
      const dir = this._a.copy(b).sub(a);
      const full = dir.length();
      if (full < 1e-5 || k <= 0) { s.mesh.visible = false; continue; }
      dir.divideScalar(full);
      s.mesh.visible = true;
      s.mesh.position.copy(a);
      s.mesh.quaternion.setFromUnitVectors(UP, dir);
      const thick = s.lance ? 0.0022 : 0.0015;
      s.mesh.scale.set(thick, full * k, thick);
    }
    const done = this.strikes.filter((s) => s.t >= EXTEND + HOLD + RETRACT);
    for (const s of done) { s.mesh.visible = false; this.pool.push(s.mesh); }
    if (done.length) this.strikes = this.strikes.filter((s) => s.t < EXTEND + HOLD + RETRACT);
  }

  land(s, a, b) {
    const E = this.enemies, has = s.has;
    const color = s.golden ? '#ffd23a' : '#fff';
    this.fx.puff(b, s.golden ? 0xffd23a : 0xffc2e6, 0.006, 0.18);   // nematocyst sparkle
    if (s.target.dead) return;
    if (has.has('qtip')) s.target.slowT = 2;
    E.damage(s.target, s.dmg, color);

    // Bobby Pin: everything along the line out to full reach takes the hit too
    if (has.has('bobbyPin')) {
      const dir = b.clone().sub(a).normalize();
      const reach = s.stats.reach * (s.lance ? 2 : 1);
      for (const e of E.list) {
        if (e.dead || e === s.target) continue;
        const c = E.center(e, new THREE.Vector3()).sub(a);
        const along = c.dot(dir);
        if (along < 0 || along > reach) continue;
        if (c.addScaledVector(dir, -along).length() < e.r + 0.006) {
          if (has.has('qtip')) e.slowT = 2;
          E.damage(e, s.dmg, color);
        }
      }
    }
    // Hair Tie: bounce to one more enemy nearby, once
    if (has.has('hairTie') && !s.chained) {
      let best = null, bd = 0.07;
      for (const e of E.list) {
        if (e.dead || e === s.target) continue;
        const d = E.center(e, new THREE.Vector3()).distanceTo(b);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const m = this.mesh();
        m.material = s.golden ? this.goldMat : this.mat;
        this.strikes.push({ ...s, mesh: m, target: best, fixedFrom: b.clone(), t: 0, dmg: s.dmg * 0.7, hit: false, chained: true });
      }
    }
  }
}

const UP = new THREE.Vector3(0, 1, 0);
