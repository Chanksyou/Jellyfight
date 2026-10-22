// The ice Element's own effects (Freezer Pack), pooled: no lights, two instanced draws in all.
//   shatter(pos, n, size, speed, floor)  real 3D ice shards burst out, tumbling, glinting; they skip
//                                        off the floor and melt away (a hit, and a chilled bug's death)
//   bloom(pos, r, life)                  a frost flower spreads on the floor where it struck and fades
// Colours and sizes in content/look.css (--ice-*).
import * as THREE from 'three';
import { LOOK } from './look.js';

const SHARDS = 160, FLOWERS = 24;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _c = new THREE.Color();

// a six-armed frost crystal, drawn once, white on clear (tinted per flower)
function frostTexture() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.translate(S / 2, S / 2); g.strokeStyle = '#fff'; g.lineCap = 'round';
  const glow = g.createRadialGradient(0, 0, 0, 0, 0, S / 2);
  glow.addColorStop(0, 'rgba(255,255,255,0.55)'); glow.addColorStop(0.35, 'rgba(255,255,255,0.12)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow; g.fillRect(-S / 2, -S / 2, S, S);
  for (let a = 0; a < 6; a++) {
    g.save(); g.rotate(a * Math.PI / 3);
    g.lineWidth = 3.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -S * 0.46); g.stroke();
    g.lineWidth = 2;
    for (const [at, len] of [[0.16, 0.12], [0.27, 0.1], [0.37, 0.07]]) {   // the branches, shorter toward the tip
      g.beginPath(); g.moveTo(0, -S * at); g.lineTo(-S * len, -S * (at + len * 0.9)); g.moveTo(0, -S * at); g.lineTo(S * len, -S * (at + len * 0.9)); g.stroke();
    }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class IceLooks {
  constructor(scene) {
    // shards: a long thin crystal (an octahedron drawn out to a point at each end)
    const geo = new THREE.OctahedronGeometry(1, 0); geo.scale(0.45, 1.6, 0.45);
    this.shards = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({
      color: LOOK.color('ice-shard', '#cfefff'), emissive: LOOK.color('ice-shard-glow', '#3aa8ff'), emissiveIntensity: 0.9,
      roughness: 0.05, metalness: 0.35, flatShading: true, transparent: true, opacity: 0.92,
    }), SHARDS);
    this.shards.name = 'Ice shards'; this.shards.frustumCulled = false; this.shards.userData.noCollide = true;
    this.list = Array.from({ length: SHARDS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), spin: new THREE.Vector3(), rot: new THREE.Euler(), size: 0, t: 0, life: 0, floor: 0 }));
    // frost flowers: flat on the floor, additive
    this.flowers = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      map: frostTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    }), FLOWERS);
    this.flowers.name = 'Frost flowers'; this.flowers.frustumCulled = false; this.flowers.userData.noCollide = true; this.flowers.renderOrder = 2;
    this.blooms = Array.from({ length: FLOWERS }, () => ({ p: new THREE.Vector3(), r: 0, t: 0, life: 0, turn: 0 }));
    this.frost = new THREE.Color(LOOK.color('ice-frost', '#9fe4ff'));
    for (let i = 0; i < SHARDS; i++) { this.shards.setMatrixAt(i, _m.makeScale(0, 0, 0)); this.shards.setColorAt(i, _c.set(0xffffff)); }
    for (let i = 0; i < FLOWERS; i++) { this.flowers.setMatrixAt(i, _m.makeScale(0, 0, 0)); this.flowers.setColorAt(i, _c.set(0)); }
    this.nextShard = this.nextFlower = 0; this.busy = false;
    scene.add(this.shards, this.flowers);
  }

  // n shards from pos, `size` m long-ish, out at about `speed` m/s (up and away), landing on `floor`
  shatter(pos, n, size, speed, floor = pos.y - 0.05) {
    const tints = LOOK.list('ice-shard-tints', ['#ffffff', '#cfefff', '#8fd8ff']);
    for (let k = 0; k < n; k++) {
      const s = this.list[this.nextShard], i = this.nextShard; this.nextShard = (this.nextShard + 1) % SHARDS;
      s.p.copy(pos); s.v.randomDirection(); s.v.y = Math.abs(s.v.y) * 0.9 + 0.25; s.v.normalize().multiplyScalar(speed * (0.45 + Math.random() * 0.75));
      s.spin.set((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24);
      s.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      s.size = size * (0.45 + Math.random() * 0.75); s.t = 0; s.life = 0.6 + Math.random() * 0.6; s.floor = floor;
      this.shards.setColorAt(i, _c.set(tints[k % tints.length]));
    }
    this.shards.instanceColor.needsUpdate = true;
    this.busy = true;
  }

  // a frost flower `r` m across on the floor at pos, spreading fast and fading over `life` s
  bloom(pos, r, life = 1.6) {
    const f = this.blooms[this.nextFlower]; this.nextFlower = (this.nextFlower + 1) % FLOWERS;
    f.p.copy(pos); f.p.y += 0.0015; f.r = r; f.t = 0; f.life = life; f.turn = Math.random() * Math.PI;
    this.busy = true;
  }

  update(dt) {
    if (!this.busy) return;
    let any = false;
    this.list.forEach((s, i) => {
      if (!s.life) return;
      s.t += dt;
      if (s.t >= s.life) { s.life = 0; this.shards.setMatrixAt(i, _m.makeScale(0, 0, 0)); return; }
      any = true;
      s.v.y -= 2.2 * dt; s.p.addScaledVector(s.v, dt);
      if (s.p.y < s.floor + s.size * 0.3 && s.v.y < 0) { s.p.y = s.floor + s.size * 0.3; s.v.y *= -0.3; s.v.x *= 0.5; s.v.z *= 0.5; s.spin.multiplyScalar(0.5); }   // skips off the floor
      s.rot.x += s.spin.x * dt; s.rot.y += s.spin.y * dt; s.rot.z += s.spin.z * dt;
      const k = s.t / s.life, melt = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;   // whole, then melting away
      this.shards.setMatrixAt(i, _m.compose(s.p, _q.setFromEuler(s.rot), _s.setScalar(s.size * melt)));
    });
    this.blooms.forEach((f, i) => {
      if (!f.life) return;
      f.t += dt;
      if (f.t >= f.life) { f.life = 0; this.flowers.setMatrixAt(i, _m.makeScale(0, 0, 0)); return; }
      any = true;
      const k = f.t / f.life, grow = 1 - (1 - Math.min(1, f.t / 0.18)) ** 3;   // spreads in a blink, then fades
      this.flowers.setMatrixAt(i, _m.compose(f.p, _q.setFromEuler(_e.set(0, f.turn, 0)), _s.setScalar(f.r * grow)));
      this.flowers.setColorAt(i, _c.copy(this.frost).multiplyScalar(1.4 * (1 - k) ** 1.5));
    });
    this.shards.instanceMatrix.needsUpdate = true;
    this.flowers.instanceMatrix.needsUpdate = true; this.flowers.instanceColor.needsUpdate = true;
    this.busy = any;
  }

  // how many shards and flowers are showing (stories)
  get live() { return this.list.filter((s) => s.life).length + this.blooms.filter((f) => f.life).length; }

  clear() {
    for (const s of this.list) s.life = 0;
    for (const f of this.blooms) f.life = 0;
    for (let i = 0; i < SHARDS; i++) this.shards.setMatrixAt(i, _m.makeScale(0, 0, 0));
    for (let i = 0; i < FLOWERS; i++) this.flowers.setMatrixAt(i, _m.makeScale(0, 0, 0));
    this.shards.instanceMatrix.needsUpdate = this.flowers.instanceMatrix.needsUpdate = true;
    this.busy = false;
  }
}
