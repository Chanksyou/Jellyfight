// Lash: the jelly's close-range sting, next to its main attack (bubbles.js). Every so often a
// few of its tentacles whip out, each at a different enemy within reach, sting, and snap back.
// Only treasures improve it (run.js works out the tentacle stats and which treasures apply).
// The jelly's own tentacles (avatar.tentacles) do the striking; bounces between enemies (Hair
// Tie) and bodies without tentacles use a simple stretched cylinder instead.
import * as THREE from 'three';
import { sfx } from './sfx.js';
import { bus } from './events.js';
import { batcher } from './batch.js';

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
    this.getRig = () => null;     // main.js: () => player.avatar.tentacles
  }

  reset() {
    this.timer = 0;
    this.count = 0;
    this.strikes.forEach((s) => this.release(s));
    this.strikes = [];
  }

  release(s) {
    if (s.mesh) { s.mesh.visible = false; this.pool.push(s.mesh); }
    if (s.rig) s.rig.aim(s.tent, null);
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
    if (this.timer >= 1) {
      if (this.fire(origin, stats, hits)) this.timer = 0;
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

  fire(origin, stats, hits) {
    const targets = this.inReach(origin, stats.reach).slice(0, stats.tentacles);
    if (!targets.length) return false;
    this.count++;
    for (const e of targets) this.strike(origin, e, stats.tentacleDamage, hits);
    return true;
  }

  strike(from, target, dmg, hits) {
    const rig = this.getRig();
    const tent = rig ? this.pickTentacle(rig, from, target) : -1;
    let m = null;
    if (tent < 0) {
      m = this.mesh();
      m.material = this.mat;
    }
    this.strikes.push({ mesh: m, rig: tent < 0 ? null : rig, tent, target, from: from.clone(), fixedFrom: null, t: 0, dmg, golden: false, hit: false, hits });
  }

  animate(dt, origin) {
    for (const s of this.strikes) {
      s.t += dt;
      const a = s.fixedFrom || origin;
      const b = this.enemies.center(s.target, this._b);
      if (!s.hit && s.t >= EXTEND) { s.hit = true; this.land(s, a, b); }
      const k = s.t < EXTEND ? s.t / EXTEND : s.t < EXTEND + HOLD ? 1 : 1 - (s.t - EXTEND - HOLD) / RETRACT;
      if (s.rig) { s.rig.aim(s.tent, b, Math.max(0, k), s.golden); continue; }
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
    for (const s of done) this.release(s);
    if (done.length) this.strikes = this.strikes.filter((s) => s.t < EXTEND + HOLD + RETRACT);
  }

  land(s, a, b) {
    const H = s.hits;
    this.fx.puff(b, 0xffc2e6, 0.006, 0.18);   // nematocyst sparkle
    sfx.sting();
    const id = s.target.id;
    if (!s.target.T.fly) bus.emit('knockback', { targetId: id, dir: b.clone().sub(a).setY(0).normalize(), force: 0.008 });
    if (s.target.dead) return;
    if (H.mark) bus.emit('status_applied', { targetId: id, status: 'mark', duration: H.mark });
    let dmg = s.dmg, color = '#fff';
    if (H.crit && Math.random() < H.crit.chance) {
      dmg *= H.crit.mult; color = '#ff6b6b'; this.fx.puff(b, 0xff6b6b, 0.01, 0.2);
      if (H.pin) bus.emit('status_applied', { targetId: id, status: 'pin', duration: H.pin });   // pin-on-crit
    }
    bus.emit('damage_taken', { targetId: id, amount: dmg, color, source: 'tentacle' });
  }
}

const UP = new THREE.Vector3(0, 1, 0);
