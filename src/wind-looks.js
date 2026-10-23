// The wind Element's own effects (Paper Fan), pooled: no lights, two instanced draws in all.
//   streaks(pos, dir, n, speed, len)          speed lines: thin bright streaks of air rushing along
//                                             dir, stretching out and fading (the gust leaving the
//                                             bell, flying, blowing past a bug it hits)
//   debris(pos, dir, n, speed, floor, size)   dust and lint kicked up and blown along dir: real little
//                                             flecks that tumble, flutter down and lie on the floor a
//                                             moment before they fade
//   skid(from, to, floor, r)                  a shoved bug's skid: dust kicked up along the way it slid
//   swirl(pos, r)                             a little whirlwind where it hits: wisps curling up a spiral
//   blowAway(root, dir, r)                     a bug finished by wind is blown away: its own body tumbles
//                                             off along the gust, up and spinning, shrinking, then puffs
//                                             into dust (a transform on the real model; at most 8 at once)
// Colours and timings in content/look.css (--wind-*).
import * as THREE from 'three';
import { LOOK } from './look.js';
import { batcher } from './batch.js';

const STREAKS = 120, FLECKS = 160, SWIRLS = 12, BLOWN = 8;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _c = new THREE.Color();
const FWD = new THREE.Vector3(0, 0, 1), UP = new THREE.Vector3(0, 1, 0);

export class WindLooks {
  constructor(scene, fx) {
    Object.assign(this, { scene, fx });
    // speed lines: a thin box along +z, additive, faded by its instance colour
    this.lines = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), STREAKS);
    this.lines.name = 'Wind streaks'; this.lines.frustumCulled = false; this.lines.userData.noCollide = true; this.lines.renderOrder = 2;
    this.streakList = Array.from({ length: STREAKS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), len: 0, w: 0, t: 0, life: 0 }));
    // flecks of dust and lint: little flat squares, matte
    this.flecks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide }), FLECKS);
    this.flecks.name = 'Wind debris'; this.flecks.frustumCulled = false; this.flecks.userData.noCollide = true;
    this.fleckList = Array.from({ length: FLECKS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), size: 0, t: 0, life: 0, floor: 0, down: false }));
    for (let i = 0; i < STREAKS; i++) { this.lines.setMatrixAt(i, _m.makeScale(0, 0, 0)); this.lines.setColorAt(i, _c.set(0)); }
    for (let i = 0; i < FLECKS; i++) { this.flecks.setMatrixAt(i, _m.makeScale(0, 0, 0)); this.flecks.setColorAt(i, _c.set(0xffffff)); }
    this.swirls = Array.from({ length: SWIRLS }, () => ({ p: new THREE.Vector3(), r: 0, t: 0, life: 0, turn: 0 }));
    this.blown = [];
    this.nextStreak = this.nextFleck = this.nextSwirl = 0; this.busy = false;
    this.streakColor = new THREE.Color(LOOK.color('wind-streak', '#e6f8ff'));
    this.wisps = [new THREE.Color(LOOK.color('wind-core', '#d9f6ff')), new THREE.Color('#ffffff'), new THREE.Color('#bfe6ff')];
    this.dust = new THREE.Color(LOOK.color('wind-dust', '#d8d0c2'));
    scene.add(this.lines, this.flecks);
  }

  // n streaks from about pos, rushing along dir at about `speed` m/s, each up to `len` m long
  streaks(pos, dir, n, speed, len) {
    _q.setFromUnitVectors(FWD, _v.copy(dir).normalize());
    for (let k = 0; k < n; k++) {
      const s = this.streakList[this.nextStreak]; this.nextStreak = (this.nextStreak + 1) % STREAKS;
      s.p.copy(pos).add(_w.randomDirection().multiplyScalar(len * 0.35));
      s.v.copy(_v).multiplyScalar(speed * (0.7 + Math.random() * 0.6));
      s.q.copy(_q); s.len = len * (0.5 + Math.random() * 0.6); s.w = len * 0.025; s.t = 0; s.life = 0.18 + Math.random() * 0.14;
    }
    this.busy = true;
  }

  // n flecks from pos, blown along dir at about `speed` m/s, settling on `floor`
  debris(pos, dir, n, speed, floor = pos.y - 0.02, size = LOOK.num('wind-fleck-size', 0.0028)) {
    const cols = LOOK.list('wind-debris', ['#d8cfc0', '#b9b2a6', '#f2efe8', '#8d877c']);
    for (let k = 0; k < n; k++) {
      const f = this.fleckList[this.nextFleck], i = this.nextFleck; this.nextFleck = (this.nextFleck + 1) % FLECKS;
      f.p.copy(pos).add(_w.set((Math.random() - 0.5) * 0.01, Math.random() * 0.004, (Math.random() - 0.5) * 0.01));
      f.v.copy(dir).setY(0).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.9)).add(_w.randomDirection().multiplyScalar(speed * 0.35));
      f.v.y = Math.abs(f.v.y) + speed * (0.3 + Math.random() * 0.5);
      f.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      f.spin.set((Math.random() - 0.5) * 26, (Math.random() - 0.5) * 26, (Math.random() - 0.5) * 26);
      f.size = size * (0.5 + Math.random()); f.t = 0; f.life = 1.1 + Math.random() * 0.9; f.floor = floor + 0.0006; f.down = false;
      this.flecks.setColorAt(i, _c.set(cols[k % cols.length]));
    }
    this.flecks.instanceColor.needsUpdate = true;
    this.busy = true;
  }

  // dust kicked up along a shoved bug's slide, from `from` to `to`
  skid(from, to, floor, r) {
    const n = Math.min(6, 2 + Math.round(from.distanceTo(to) / 0.01));
    _s.subVectors(to, from);
    for (let k = 0; k < n; k++) this.debris(_v.copy(from).addScaledVector(_s, k / n).setY(floor + 0.002), _s, 1, 0.12, floor, r * 0.12);
    this.fx.glow.emit(_v.copy(to).setY(floor + r * 0.3), this.dust, r * 0.8, r * 1.8, 0.4, 0.35, _w.copy(_s).setY(0).normalize().multiplyScalar(0.03));
  }

  // a little whirlwind `r` m across at pos: wisps curling up a spiral for a moment
  swirl(pos, r) {
    const w = this.swirls[this.nextSwirl]; this.nextSwirl = (this.nextSwirl + 1) % SWIRLS;
    w.p.copy(pos); w.r = r; w.t = 0; w.life = LOOK.num('wind-swirl-time', 0.45); w.turn = Math.random() * 6;
    this.busy = true;
  }

  blowAway(root, dir, r = 0.02) {
    if (this.blown.length >= BLOWN) this.free(this.blown.shift());
    root.visible = true;
    this.scene.add(root);
    batcher.track(root);
    const d = new THREE.Vector3().copy(dir).setY(0);
    if (d.lengthSq() < 1e-8) d.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    d.normalize();
    this.blown.push({ root, t: 0, dir: d, r, pos: root.position.clone(), quat: root.quaternion.clone(), scale: root.scale.clone(), spin: new THREE.Vector3(Math.random() - 0.5, 1, Math.random() - 0.5).normalize(), wisp: 0 });
  }
  free(c) {
    this.scene.remove(c.root);
    c.root.position.copy(c.pos); c.root.quaternion.copy(c.quat); c.root.scale.copy(c.scale);
  }

  update(dt) {
    if (this.busy) {
      let any = false;
      this.streakList.forEach((s, i) => {
        if (!s.life) return;
        s.t += dt;
        if (s.t >= s.life) { s.life = 0; this.lines.setMatrixAt(i, _m.makeScale(0, 0, 0)); return; }
        any = true;
        s.p.addScaledVector(s.v, dt);
        const k = s.t / s.life, grow = Math.min(1, k * 4);   // stretches out, then thins and fades
        this.lines.setMatrixAt(i, _m.compose(s.p, s.q, _s.set(s.w * (1 - k * 0.6), s.w * (1 - k * 0.6), s.len * grow)));
        this.lines.setColorAt(i, _c.copy(this.streakColor).multiplyScalar(0.9 * (1 - k) ** 1.5));
      });
      this.fleckList.forEach((f, i) => {
        if (!f.life) return;
        f.t += dt;
        if (f.t >= f.life) { f.life = 0; this.flecks.setMatrixAt(i, _m.makeScale(0, 0, 0)); return; }
        any = true;
        if (!f.down) {
          f.v.multiplyScalar(Math.exp(-3 * dt)); f.v.y -= 0.9 * dt;         // air drag, a gentle fall
          f.p.addScaledVector(f.v, dt);
          f.rot.x += f.spin.x * dt; f.rot.y += f.spin.y * dt; f.rot.z += f.spin.z * dt;
          if (f.p.y <= f.floor) { f.p.y = f.floor; f.down = true; f.rot.set(-Math.PI / 2, 0, f.rot.z); }   // lies flat
        }
        const k = f.t / f.life, fade = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        this.flecks.setMatrixAt(i, _m.compose(f.p, _q.setFromEuler(f.rot), _s.setScalar(f.size * fade)));
      });
      const glow = this.fx.glow;
      for (const w of this.swirls) {
        if (!w.life) continue;
        w.t += dt;
        if (w.t >= w.life) { w.life = 0; continue; }
        any = true;
        // three wisps climbing a spiral that widens as it rises
        const k = w.t / w.life;
        for (let a = 0; a < 3; a++) {
          const ang = w.turn + a * 2.094 + k * 9, rad = w.r * (0.35 + k * 0.65);
          glow.emit(_v.set(w.p.x + Math.cos(ang) * rad, w.p.y + w.r * k * 1.4, w.p.z + Math.sin(ang) * rad), this.wisps[a], w.r * 0.28, w.r * 0.1, 0.16, 0.7 * (1 - k));
        }
      }
      this.lines.instanceMatrix.needsUpdate = true; this.lines.instanceColor.needsUpdate = true;
      this.flecks.instanceMatrix.needsUpdate = true;
      this.busy = any;
    }
    // bugs blown away: tumbling up and off along the gust, shrinking to nothing, then a puff of dust
    const time = LOOK.num('wind-blow-time', 0.7);
    for (let i = this.blown.length - 1; i >= 0; i--) {
      const c = this.blown[i]; c.t += dt;
      const k = Math.min(1, c.t / time), e = 1 - (1 - k) ** 2;
      c.root.position.copy(c.pos).addScaledVector(c.dir, c.r * 7 * e).addScaledVector(UP, c.r * 3 * Math.sin(k * Math.PI * 0.8));   // about 7 of its own sizes off, 3 up
      c.root.quaternion.copy(c.quat).premultiply(_q.setFromAxisAngle(c.spin, k * 14));
      c.root.scale.copy(c.scale).multiplyScalar(Math.max(0.001, 1 - k * k));
      if ((c.wisp -= dt) <= 0) { c.wisp = 0.04; this.fx.glow.emit(c.root.position, this.wisps[(Math.random() * 3) | 0], 0.006, 0.002, 0.25, 0.6); }
      if (k === 1) {
        this.fx.puff(c.root.position, 0xd8d0c2, 0.02, 0.4);
        this.debris(c.root.position, c.dir, 5, 0.2, c.pos.y);
        this.free(c); this.blown.splice(i, 1);
      }
    }
  }

  // how many streaks, flecks and blown-away bugs are showing (stories)
  get live() { return this.streakList.filter((s) => s.life).length + this.fleckList.filter((f) => f.life).length + this.blown.length; }

  clear() {
    for (const s of this.streakList) s.life = 0;
    for (const f of this.fleckList) f.life = 0;
    for (const w of this.swirls) w.life = 0;
    for (let i = 0; i < STREAKS; i++) this.lines.setMatrixAt(i, _m.makeScale(0, 0, 0));
    for (let i = 0; i < FLECKS; i++) this.flecks.setMatrixAt(i, _m.makeScale(0, 0, 0));
    this.lines.instanceMatrix.needsUpdate = this.flecks.instanceMatrix.needsUpdate = true;
    for (const c of this.blown) this.free(c);
    this.blown.length = 0;
    this.busy = false;
  }
}
