// The butterfly's prism ball (the prism word): a Shot of hot rainbow light lobbed in a slow arc at the
// floor under the jelly; while it flies, a Warning (floor circle + dome) fills where it will land. It
// spins as it goes, and on every beat of the song it fires a flat ring of bolts out all round, each
// ring turned half a gap from the last so the gaps spiral. The bolts settle to the floor volley height
// (vfx.js SHOT_HEIGHT.floor: the jelly's middle on the floor), so a jump clears a ring. It lands as a
// Blast with a last ring. Bolts are one instanced draw (batch.js perInstance), lit by bloom alone (no
// lights), at most `prism-bolts-max` alive (the oldest goes). Nothing allocates per frame.
import * as THREE from 'three';
import { bus, PLAYER } from './events.js';
import { batcher } from './batch.js';
import { LOOK } from './look.js';
import { sfx } from './sfx.js';
import { juice } from './juice.js';
import { hostile, TeleMaterial, blastHits, SHOT_HEIGHT } from './vfx.js';

const _v = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Color();
const Z = new THREE.Vector3(0, 0, 1);

export class PrismBalls {
  constructor(scene, fx, world) {
    this.scene = scene;
    this.fx = fx;
    this.world = world;
    this.lobs = [];     // in flight: { m (fx.orb), from, to, b0 (the beat it left on), beats, peak, r, ring, mark, … }
    this.bolts = [];    // flying out: { m, v, y (the height it settles to), t, dmg, id, source }
    this.spare = [];    // bolts not in use (kept whole: a ring allocates nothing once the pool has grown)
    this.marks = [];    // pooled Warnings: { floor, vol, busy }
    this.geo = new THREE.SphereGeometry(1, 8, 6);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.mat.userData.perInstance = true;
    this.circle = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
    this.colors = LOOK.list('prism-colors', ['#ff2a2a', '#ff7a1a', '#ffcc1a', '#ff4fa0', '#ff2ad4']).map((c) => new THREE.Color(c));
  }

  // the hot rainbow at `k` (any number: it wraps round the colours)
  rainbow(k, out) {
    const n = this.colors.length, q = ((k % n) + n) % n, i = q | 0;
    return out.copy(this.colors[i]).lerp(this.colors[(i + 1) % n], q - i);
  }
  flying() { return this.lobs.length; }

  mark() {
    let M = this.marks.find((x) => !x.busy);
    if (!M) {
      const floor = new THREE.Mesh(this.circle, new TeleMaterial(hostile('butterfly'), 'circle'));
      floor.renderOrder = 3;
      M = { floor, vol: this.fx.volume(hostile('butterfly'), 'dome', _v.set(0, 0, 0), 1) };
      this.marks.push(M);
    }
    M.busy = true;
    this.scene.add(M.floor, M.vol);
    return M;
  }
  unmark(M) { M.busy = false; this.scene.remove(M.floor, M.vol); }

  // the ball leaves the butterfly at `from` on beat `beat`, for the floor at `to` (p: the prism word's props)
  throw(from, to, p, id, source, beat) {
    const mark = this.mark();
    mark.floor.position.copy(to).setY(to.y + 0.003); mark.floor.scale.setScalar(p.radius);
    mark.vol.position.copy(to); mark.vol.scale.setScalar(p.radius);
    mark.floor.material.progress = mark.vol.material.progress = 0;
    const m = this.fx.orb(hostile(source), LOOK.num('prism-ball-size', 0.015));
    m.position.copy(from);
    this.lobs.push({ m, from: from.clone(), to: to.clone(), b0: beat, last: Math.floor(beat), beats: p.beats, peak: p.peak, r: p.radius, p, ring: 0, mark, id, source });
    this.fx.impact(from, this.rainbow(Math.random() * 5, _c), 0.014, 8);    // the release: a flash between its forelegs
    sfx.prismThrow();
  }

  // a ring of `count` bolts out flat from `at`, turned `turn` radians
  ring(L, at, turn) {
    const { count, speed, life, dmg } = L.p, max = LOOK.num('prism-bolts-max', 120), size = LOOK.num('prism-bolt-size', 0.007);
    const y = L.to.y + SHOT_HEIGHT.floor, glow = LOOK.num('prism-glow', 1.8);
    for (let i = 0; i < count; i++) {
      if (this.bolts.length >= max) this.retire(this.bolts.shift());           // the oldest goes
      const a = turn + (i / count) * Math.PI * 2;
      const B = this.spare.pop() || { m: new THREE.Mesh(this.geo, this.mat), v: new THREE.Vector3() }, m = B.m;
      m.userData.color ||= new THREE.Color();
      this.rainbow(L.ring + i * 5 / count, m.userData.color).multiplyScalar(glow);   // the ring runs round the rainbow
      m.userData.opacity = 1;
      m.position.copy(at);
      m.scale.set(size, size, size * 2.6);                                     // stretched along its flight: it reads as moving
      B.v.set(Math.sin(a), 0, Math.cos(a)).multiplyScalar(speed);
      m.quaternion.setFromUnitVectors(Z, _d.copy(B.v).normalize());
      this.scene.add(m);
      batcher.track(m);
      Object.assign(B, { y, t: life, dmg, id: L.id, source: L.source, done: false });
      this.bolts.push(B);
    }
    L.ring++;
    sfx.prismRing();
  }
  retire(B) { this.scene.remove(B.m); this.spare.push(B); }

  update(dt, player, beat) {
    if (!this.lobs.length && !this.bolts.length) return;
    // in flight: across steadily, up and down in an arc `peak` over the line, on the song's beats; a ring on each new beat
    for (const L of this.lobs) {
      const f = Math.min(1, Math.max(0, (beat - L.b0) / L.beats));
      L.m.position.lerpVectors(L.from, L.to, f);
      L.m.position.y += 4 * L.peak * f * (1 - f);
      const O = L.m.userData.orb;
      this.rainbow(beat * 2.5, O.c); L.m.userData.color.copy(O.c).lerp(_c.setRGB(1, 1, 1), 0.35);   // its colours turn as it spins
      this.fx.orbTick(L.m, dt, 1.2);
      L.mark.floor.material.progress = L.mark.vol.material.progress = f;
      const k = 0.85 + 0.15 * Math.abs(Math.sin(beat * Math.PI * (f > 0.7 ? 4 : 2)));
      L.mark.floor.material.opacity = k * LOOK.num('prism-warning-opacity', 0.32);
      L.mark.vol.material.opacity = k * LOOK.num('prism-dome-opacity', 0.26);
      const n = Math.floor(beat);
      if (n > L.last && f < 1) { L.last = n; this.ring(L, L.m.position, L.ring * Math.PI / L.p.count); }
      if (f >= 1) this.land(L, player);
    }
    if (this.lobs.some((L) => L.done)) this.lobs = this.lobs.filter((L) => !L.done);

    // the bolts: out flat, settling to their height; stopped by a wall or furniture; a hit on the jelly's body
    for (const B of this.bolts) {
      const P = B.m.position, step = B.v.length() * dt;
      B.t -= dt;
      P.y += (B.y - P.y) * (1 - Math.exp(-18 * dt));                          // settles within a few cm of leaving the ball
      const wall = this.world.cast(P, _d.copy(B.v).normalize(), step + 0.003);
      P.addScaledVector(B.v, dt);
      if (blastHits(P, B.m.scale.x, player.position, player)) {
        B.done = true;
        this.fx.impact(P, B.m.userData.color, 0.016, 6);
        bus.emit('damage_taken', { targetId: PLAYER, amount: B.dmg, source: B.source, from: B.id, at: P.clone() });
      } else if (wall) { B.done = true; this.fx.impact(P, B.m.userData.color, 0.008, 3); }
      else if (B.t <= 0) B.done = true;
      else B.m.userData.opacity = Math.min(1, B.t / 0.15);                      // fades in its last moment
      if (B.done) this.retire(B);
    }
    if (this.bolts.some((B) => B.done)) this.bolts = this.bolts.filter((B) => !B.done);
  }

  // it lands: a Blast where it comes down, and a last ring
  land(L, player) {
    L.done = true;
    this.fx.free(L.m);
    this.unmark(L.mark);
    const at = L.to, R = L.r, col = hostile(L.source), hurt = blastHits(at, R, player.position, player);
    this.ring(L, _p.copy(at).setY(at.y + SHOT_HEIGHT.floor), L.ring * Math.PI / L.p.count);
    this.fx.impact(_p.copy(at).setY(at.y + 0.012), col, R * 0.3, 14);
    this.fx.ring(_p.copy(at).setY(at.y + 0.003), col, R, 0.35);              // the Blast's real reach
    this.fx.splat(_p.copy(at), this.rainbow(Math.random() * 5, _c), R * 0.45, 'scorch');   // a scorch where it burst (fades)
    for (let k = 0; k < 10; k++) {                                           // sparks of every colour thrown up
      const a = k * 0.63 + Math.random() * 0.4;
      this.fx.glow.emit(_p.copy(at).setY(at.y + 0.006), this.rainbow(k / 2, _c), 0.012, 0.003, 0.5 + Math.random() * 0.3, 1, _v.set(Math.cos(a) * 0.25, 0.3 + Math.random() * 0.2, Math.sin(a) * 0.25), 1.6);
    }
    sfx.prismBurst(hurt);
    juice.feel(hurt ? 'impact' : 'hit');
    if (hurt) bus.emit('damage_taken', { targetId: PLAYER, amount: L.p.burst, source: L.source, from: L.id, at: at.clone() });
  }

  // shown once while the game builds its shaders (main.js warmUp), so the first throw doesn't stall a phone
  warm(on, at) {
    if (!on) { this.clear(); return; }
    const M = this.mark();
    M.floor.position.copy(at); M.vol.position.copy(at); M.vol.scale.setScalar(0.05);
    const m = new THREE.Mesh(this.geo, this.mat);
    m.userData.color = new THREE.Color(1, 1, 1); m.userData.opacity = 1;
    m.position.copy(at); m.scale.setScalar(0.005);
    this.scene.add(m); batcher.track(m);
    this.bolts.push({ m, v: new THREE.Vector3(), y: at.y, t: 0, dmg: 0, id: -1, source: 'butterfly' });
  }

  clear() {
    for (const L of this.lobs) { this.fx.free(L.m); this.unmark(L.mark); }
    for (const M of this.marks) if (M.busy) this.unmark(M);
    for (const B of this.bolts) this.retire(B);
    this.lobs = []; this.bolts = [];
  }
}
