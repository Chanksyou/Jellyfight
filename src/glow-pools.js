// The firefly's glow (the lob word): a glowing Shot thrown from its tail in a slow, high arc; while
// it flies, a Warning (floor circle + dome) fills where it will land; it lands as a Blast and lies
// there as a glowing pool that drains the jelly's Health while it stands in it (overlapping pools
// add up; a jump over one is safe). Pools are one instanced draw (batch.js perInstance), lit by
// bloom alone (no lights), at most `most` at once: the oldest fades first. Nothing allocates per frame.
import * as THREE from 'three';
import { bus, PLAYER } from './events.js';
import { batcher } from './batch.js';
import { LOOK } from './look.js';
import { sfx } from './sfx.js';
import { juice } from './juice.js';
import { hostile, TeleMaterial, blastHits } from './vfx.js';

const FADE = 0.4;   // s a pool takes to fade out (at the end of its time, or retired early by a newer one)
const _v = new THREE.Vector3(), _p = new THREE.Vector3();

// the pool: a soft acid-yellow glow with a brighter rim, so its edge (where it stops hurting) reads
function poolTexture() {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  c.width = c.height = 128;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,0.4)'); r.addColorStop(0.6, 'rgba(255,255,255,0.25)');
  r.addColorStop(0.86, 'rgba(255,255,255,0.95)'); r.addColorStop(0.97, 'rgba(255,255,255,0.3)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class GlowPools {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.lobs = [];     // in flight: { m (fx.orb), from, to, t, T, peak, r, dmg, drain, last, most, mark, from id }
    this.pools = [];    // on the floor: { m, at, r, t, drain, live }
    this.spare = [];    // pool meshes not in use
    this.marks = [];    // pooled Warnings: { floor, vol, busy }
    this.geo = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
    this.mat = new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.mat.userData.perInstance = true;
    this.color = new THREE.Color();
    this.sizzleT = 0;
  }

  // a pooled Warning: the floor circle and the dome over it, in the firefly's colour
  mark() {
    let M = this.marks.find((x) => !x.busy);
    if (!M) {
      const floor = new THREE.Mesh(this.geo, new TeleMaterial(hostile('firefly'), 'circle'));
      floor.renderOrder = 3;
      M = { floor, vol: this.fx.volume(hostile('firefly'), 'dome', _v.set(0, 0, 0), 1) };
      this.marks.push(M);
    }
    M.busy = true;
    this.scene.add(M.floor, M.vol);
    return M;
  }
  unmark(M) { M.busy = false; this.scene.remove(M.floor, M.vol); }

  // the Shot leaves its tail at `from`, for the floor at `to` (p: the lob word's props, from: the bug's id)
  throw(from, to, p, id, source) {
    const color = hostile(source), mark = this.mark();
    mark.floor.position.copy(to).setY(to.y + 0.003); mark.floor.scale.setScalar(p.radius);
    mark.vol.position.copy(to); mark.vol.scale.setScalar(p.radius);
    mark.floor.material.progress = mark.vol.material.progress = 0;
    const m = this.fx.orb(color, LOOK.num('firefly-lob-size', 0.007));
    m.position.copy(from);
    this.lobs.push({ m, from: from.clone(), to: to.clone(), t: 0, T: p.flight, peak: p.peak, r: p.radius, dmg: p.dmg, drain: p.drain, last: p.last, most: p.most, mark, id, source, color, dripT: 0 });
    this.fx.impact(from, color, 0.012, 6);                                     // the release: a flash at its tail
    sfx.glowLob(p.flight);
  }

  update(dt, player, t) {
    if (!this.lobs.length && !this.pools.length) return;
    const glow = this.fx.glow, P = player.position;
    // in flight: across steadily, up and down in an arc `peak` over the line, Warning filling
    for (const L of this.lobs) {
      L.t += dt;
      const f = Math.min(1, L.t / L.T);
      L.m.position.lerpVectors(L.from, L.to, f);
      L.m.position.y += 4 * L.peak * f * (1 - f);
      this.fx.orbTick(L.m, dt, 1.3);
      if ((L.dripT -= dt) <= 0) { L.dripT = 0.07; glow.emit(L.m.position, L.color, 0.012, 0.003, 0.5, 0.9, _v.set(0, -0.06, 0), 0.6); }   // glow dripping off it as it goes
      const k = 0.85 + 0.15 * Math.abs(Math.sin(t * (f > 0.7 ? 22 : 12)));
      L.mark.floor.material.progress = L.mark.vol.material.progress = f;
      L.mark.floor.material.opacity = k * LOOK.num('firefly-warning-opacity', 0.32);
      L.mark.vol.material.opacity = k * LOOK.num('firefly-dome-opacity', 0.26);
      if (f >= 1) this.land(L, player);
    }
    if (this.lobs.some((L) => L.done)) this.lobs = this.lobs.filter((L) => !L.done);

    // on the floor: each one drains while the jelly stands in it (feet on its surface); they add up
    const base = LOOK.num('firefly-pool-opacity', 0.4);
    this.color.copy(hostile('firefly')).multiplyScalar(LOOK.num('firefly-pool-glow', 1.4));
    let drain = 0, from = null;
    for (const D of this.pools) {
      D.t -= dt;
      const fade = Math.min(1, Math.max(0, D.t) / FADE);   // full size from the splash: where it shows is where it hurts
      D.m.userData.color.copy(this.color);
      D.m.userData.opacity = base * fade * (0.85 + 0.15 * Math.sin(t * 3 + D.phase));   // a slow throb: it's still live
      if (D.live && D.t > FADE && player.grounded && Math.abs(P.y - D.at.y) < 0.02 && Math.hypot(P.x - D.at.x, P.z - D.at.z) < D.r) { drain += D.drain; from = D; }
      if (D.live && Math.random() < dt * 3) glow.emit(_p.set(D.at.x + (Math.random() - 0.5) * D.r, D.at.y + 0.004, D.at.z + (Math.random() - 0.5) * D.r), this.color, 0.008, 0.002, 0.9, 0.8, _v.set(0, 0.025, 0), 0);   // motes rising off it
      if (D.t <= 0) { this.scene.remove(D.m); this.spare.push(D.m); D.done = true; }
    }
    if (this.pools.some((D) => D.done)) this.pools = this.pools.filter((D) => !D.done);
    if (drain > 0) {
      bus.emit('damage_taken', { targetId: PLAYER, amount: drain * dt, source: from.source, drain: true });
      if ((this.sizzleT -= dt) <= 0) { this.sizzleT = 0.25; this.fx.impact(_p.copy(P).setY(P.y + 0.01), this.color, 0.008, 3); sfx.glowSizzle(); }   // the jelly answers: it fizzes where it stands
    } else this.sizzleT = 0;
  }

  // it lands: a Blast where it comes down, then the pool (the oldest goes if there are too many)
  land(L, player) {
    L.done = true;
    this.fx.free(L.m);
    this.unmark(L.mark);
    const at = L.to, R = L.r, hurt = blastHits(at, R, player.position, player);
    this.fx.impact(_p.copy(at).setY(at.y + 0.01), L.color, R * 0.3, 14);
    this.fx.ring(_p.copy(at).setY(at.y + 0.003), L.color, R, 0.35);          // the Blast's real reach
    for (let k = 0; k < 10; k++) {                                             // glow splashed up and falling back
      const a = k * 0.63 + Math.random() * 0.4;
      this.fx.glow.emit(_p.copy(at).setY(at.y + 0.005), L.color, 0.012, 0.003, 0.5 + Math.random() * 0.3, 1, _v.set(Math.cos(a) * 0.25, 0.3 + Math.random() * 0.2, Math.sin(a) * 0.25), 1.6);
    }
    sfx.glowLand(hurt);
    juice.feel(hurt ? 'impact' : 'hit');
    if (hurt) bus.emit('damage_taken', { targetId: PLAYER, amount: L.dmg, source: L.source, from: L.id, at: at.clone() });
    const live = this.pools.filter((D) => D.live);
    for (let i = 0; i <= live.length - L.most; i++) { live[i].live = false; live[i].t = Math.min(live[i].t, FADE); }   // the oldest fade first
    const m = this.pool(at, R);
    this.pools.push({ m, at: at.clone(), r: R, t: L.last, drain: L.drain, live: true, source: L.source, phase: Math.random() * 6 });
  }

  // a pool's mesh, shown at `at` (drawn instanced with the others: batch.js tracks it while it's in the scene)
  pool(at, R) {
    const m = this.spare.pop() || new THREE.Mesh(this.geo, this.mat);
    m.userData.color ||= new THREE.Color();
    m.position.copy(at).setY(at.y + 0.0012);
    m.scale.setScalar(R);
    m.userData.opacity = 0;
    this.scene.add(m);
    batcher.track(m);
    return m;
  }

  // the jelly's pools still drain this much a second where it stands (stories)
  drainAt(pos) { return this.pools.reduce((s, D) => s + (D.live && D.t > FADE && Math.hypot(pos.x - D.at.x, pos.z - D.at.z) < D.r ? D.drain : 0), 0); }

  // shown once while the game builds its shaders (main.js warmUp), so the first lob doesn't stall a phone
  warm(on, at) {
    if (!on) { this.clear(); return; }
    const M = this.mark(), m = this.pool(at, 0.05);
    M.floor.position.copy(at); M.vol.position.copy(at); M.vol.scale.setScalar(0.05);
    m.userData.color.set(1, 1, 1); m.userData.opacity = 1;
    this.pools.push({ m, at: at.clone(), r: 0.05, t: 0, drain: 0, live: false, phase: 0 });
  }

  clear() {
    for (const L of this.lobs) { this.fx.free(L.m); this.unmark(L.mark); }
    for (const M of this.marks) if (M.busy) this.unmark(M);
    for (const D of this.pools) { this.scene.remove(D.m); this.spare.push(D.m); }
    this.lobs = []; this.pools = [];
  }
}
