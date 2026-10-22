// The glitter Element's own effect (Glitter), pooled: one instanced draw, no lights.
//   burst(pos, n, radius, floor)  a glitter bomb going off: real flakes thrown out to the splash's
//                                 edge, fluttering down, each glinting as it turns to face you, then
//                                 lying on the floor as a sparkly patch that fades
// Colours and timings in content/look.css (--glitter-*).
import * as THREE from 'three';
import { LOOK } from './look.js';

const FLAKES = 420;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color(), _n = new THREE.Vector3(), _to = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), NORMAL = new THREE.Vector3(0, 0, 1), _e = new THREE.Euler();

export class GlitterLooks {
  constructor(scene, camera) {
    this.camera = camera;
    // a flake: a little flat hexagon (a 6-sided disc), facing +z
    this.mesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 6), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), FLAKES);
    this.mesh.name = 'Glitter flakes'; this.mesh.frustumCulled = false; this.mesh.userData.noCollide = true;
    this.list = Array.from({ length: FLAKES }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), spin: new THREE.Vector3(), col: new THREE.Color(), size: 0, t: 0, life: 0, floor: 0, down: false, seed: 0 }));
    for (let i = 0; i < FLAKES; i++) { this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); this.mesh.setColorAt(i, _c.set(0)); }
    this.next = 0; this.busy = false;
    scene.add(this.mesh);
  }

  // n flakes from pos, spraying out to about `radius` m, settling on `floor`
  burst(pos, n, radius, floor = pos.y - 0.05) {
    const cols = LOOK.list('glitter-flakes', ['#ff2ab0', '#ffc81a', '#2ae0ff', '#b04aff', '#6aff6a', '#ffffff']), size = LOOK.num('glitter-flake-size', 0.0022);
    const life = LOOK.num('glitter-linger', 2.6);
    for (let k = 0; k < n; k++) {
      const f = this.list[this.next]; this.next = (this.next + 1) % FLAKES;
      f.p.copy(pos); f.v.randomDirection(); f.v.y = Math.abs(f.v.y) * 0.8 + 0.2;
      f.v.normalize().multiplyScalar(radius * (2 + Math.random() * 3));   // with the heavy drag below, they spread to about the splash's edge
      f.q.setFromEuler(_e.set(Math.random() * 6, Math.random() * 6, Math.random() * 6));
      f.spin.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30);
      f.col.set(cols[k % cols.length]); f.size = size * (0.7 + Math.random() * 0.6);
      f.t = 0; f.life = life * (0.8 + Math.random() * 0.4); f.floor = floor + 0.0008 + Math.random() * 0.0006; f.down = false; f.seed = Math.random() * 100;
    }
    this.busy = true;
  }

  update(dt) {
    if (!this.busy) return;
    let any = false;
    const cam = this.camera.position, t0 = performance.now() / 1000;
    this.list.forEach((f, i) => {
      if (!f.life) return;
      f.t += dt;
      if (f.t >= f.life) { f.life = 0; this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); return; }
      any = true;
      if (!f.down) {
        // flutter: heavy air drag, a gentle fall, tumbling as it goes
        f.v.multiplyScalar(Math.exp(-6 * dt)); f.v.y -= 0.6 * dt;
        f.v.x += Math.sin(f.seed + f.t * 9) * 0.02 * dt; f.v.z += Math.cos(f.seed + f.t * 7) * 0.02 * dt;
        f.p.addScaledVector(f.v, dt);
        _q.setFromEuler(_e.set(f.spin.x * dt, f.spin.y * dt, f.spin.z * dt)); f.q.multiply(_q);
        if (f.p.y <= f.floor) { f.p.y = f.floor; f.down = true; f.q.setFromUnitVectors(NORMAL, UP).multiply(_q.setFromAxisAngle(NORMAL, f.seed)); }   // lands flat
      }
      // the glint: bright when the flake faces you, dark edge-on, twinkling while it lies there
      _n.copy(NORMAL).applyQuaternion(f.q); _to.copy(cam).sub(f.p).normalize();
      // (lying flat they rarely face the camera, so on the floor each one twinkles now and then instead)
      const sparkle = f.down ? Math.max(0, Math.sin(t0 * 5 + f.seed * 7)) ** 16 : Math.abs(_n.dot(_to)) ** 10;
      const k = f.t / f.life, fade = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      const glint = (0.6 + 3 * sparkle) * fade;
      this.mesh.setMatrixAt(i, _m.compose(f.p, f.q, _s.setScalar(f.size)));
      this.mesh.setColorAt(i, _c.copy(f.col).multiplyScalar(glint));
    });
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
    this.busy = any;
  }

  // flakes showing (stories)
  get live() { return this.list.filter((f) => f.life).length; }

  clear() {
    for (const f of this.list) f.life = 0;
    for (let i = 0; i < FLAKES; i++) this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
    this.mesh.instanceMatrix.needsUpdate = true;
    this.busy = false;
  }
}
