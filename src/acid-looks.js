// The acid Element's own effects (Nail Polish), pooled: one instanced draw of droplets, no lights.
//   drops(pos, n, speed, floor, size)  glossy drops of acid arcing out and falling; each lands with a
//                                      tiny fizz and a green spot that fades (fx.splat)
//   melt(root)                         a bug finished by acid melts: its model turns to glowing goo and
//                                      slumps into the floor, spreading as it sinks (the fire corpse's
//                                      way, a material swap on the real model; at most 8 at once)
// Colours and timings in content/look.css (--acid-*).
import * as THREE from 'three';
import { LOOK } from './look.js';
import { batcher } from './batch.js';

const DROPS = 140, MELTS = 8;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

export class AcidLooks {
  constructor(scene, fx) {
    Object.assign(this, { scene, fx });
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({
      color: LOOK.color('acid-drop', '#7aff2a'), emissive: LOOK.color('acid-drop-glow', '#2aa800'), emissiveIntensity: 0.9,
      roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.9,
    }), DROPS);
    this.mesh.name = 'Acid drops'; this.mesh.frustumCulled = false; this.mesh.userData.noCollide = true;
    this.list = Array.from({ length: DROPS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), size: 0, life: 0, floor: 0 }));
    for (let i = 0; i < DROPS; i++) this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
    this.next = 0; this.busy = false;
    scene.add(this.mesh);
    // the goo a melting bug turns into: one shared material, the real ones put back after
    this.gooMat = new THREE.MeshStandardMaterial({ color: LOOK.color('acid-goo', '#5aff1a'), emissive: LOOK.color('acid-drop-glow', '#2aa800'), emissiveIntensity: 1, roughness: 0.1, transparent: true, opacity: 0.85 });
    this.melts = [];
    this.spot = LOOK.color('acid-spot', '#3aff00');
  }

  // n drops from pos at about `speed` m/s, up and out, falling onto `floor`, each about `size` m across
  drops(pos, n, speed, floor = pos.y - 0.05, size = 0.0016) {
    for (let k = 0; k < n; k++) {
      const d = this.list[this.next]; this.next = (this.next + 1) % DROPS;
      d.p.copy(pos); d.v.randomDirection(); d.v.y = Math.abs(d.v.y) * 0.9 + 0.3; d.v.normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      d.size = size * (0.6 + Math.random() * 0.8); d.life = 2; d.floor = floor;
    }
    this.busy = true;
  }

  melt(root) {
    if (this.melts.length >= MELTS) this.free(this.melts.shift());
    root.visible = true;
    this.scene.add(root);
    batcher.track(root);
    root.traverse((o) => { if (!o.isMesh) return; o.userData.acidMat = o.userData.mat || o.material; o.material = this.gooMat; });
    this.melts.push({ root, t: 0, scale: root.scale.clone(), y: root.position.y, fizz: 0 });
  }
  free(c) {
    this.scene.remove(c.root);
    c.root.scale.copy(c.scale); c.root.position.y = c.y;
    c.root.traverse((o) => { if (o.userData.acidMat) { o.material = o.userData.acidMat; delete o.userData.acidMat; } });
  }

  update(dt) {
    if (this.busy) {
      let any = false;
      this.list.forEach((d, i) => {
        if (!d.life) return;
        any = true;
        d.life -= dt; d.v.y -= 2.4 * dt; d.p.addScaledVector(d.v, dt);
        if (d.p.y <= d.floor || d.life <= 0) {
          // it lands: a fizz and a little green spot that fades
          if (d.life > 0) { this.fx.splat(_v.set(d.p.x, d.floor, d.p.z), this.spot, d.size * 3.5); this.fx.glow.emit(_v, this.spotColor(), d.size * 4, d.size * 2, 0.25, 0.6); }
          d.life = 0; this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); return;
        }
        // stretched along its fall, a teardrop
        const sp = d.v.length();
        this.mesh.setMatrixAt(i, _m.compose(d.p, _q.setFromUnitVectors(UP, _v.copy(d.v).divideScalar(sp || 1)), _s.set(d.size, d.size * (1 + Math.min(1.5, sp * 3)), d.size)));
      });
      this.mesh.instanceMatrix.needsUpdate = true;
      this.busy = any;
    }
    // melting bugs: they slump and spread into the floor over --acid-melt-time, fizzing
    const time = LOOK.num('acid-melt-time', 0.8);
    for (let i = this.melts.length - 1; i >= 0; i--) {
      const c = this.melts[i]; c.t += dt;
      const k = Math.min(1, c.t / time), e = k * k;
      c.root.scale.set(c.scale.x * (1 + 0.5 * e), c.scale.y * Math.max(0.04, 1 - e), c.scale.z * (1 + 0.5 * e));
      c.root.position.y = c.y - 0.002 * e;
      if ((c.fizz -= dt) <= 0) { c.fizz = 0.05; this.fx.glow.emit(_v.copy(c.root.position).add(_s.set((Math.random() - 0.5) * 0.02, 0.004 + 0.01 * (1 - e), (Math.random() - 0.5) * 0.02)), this.spotColor(), 0.004, 0.002, 0.35, 0.9, _s.set(0, 0.03, 0)); }
      if (k === 1) { this.free(c); this.melts.splice(i, 1); }
    }
  }
  spotColor() { return (this._sc ||= new THREE.Color(LOOK.color('acid-fizz', '#b8ff6a'))); }

  get live() { return this.list.filter((d) => d.life).length + this.melts.length; }

  clear() {
    for (const d of this.list) d.life = 0;
    for (let i = 0; i < DROPS; i++) this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
    this.mesh.instanceMatrix.needsUpdate = true;
    for (const c of this.melts) this.free(c);
    this.melts.length = 0;
    this.busy = false;
  }
}
