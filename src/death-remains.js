// Short, harmless death poses. Reuse the actual model and its prepared materials/batches.
import * as THREE from 'three';
import { batcher } from './batch.js';
import { LOOK } from './look.js';
import { juice } from './juice.js';

export class DeathRemains {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.box = new THREE.Box3();
    this.partBox = new THREE.Box3();
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this.cap = LOOK.num('death-body-cap', 12);
    this.life = LOOK.num('death-body-life', 1.1);
  }

  add({ root, mesh, parts = [], style, r, velocity, floor }) {
    if (juice.calm || this.reducedMotion.matches) return false;
    if (this.list.length >= this.cap) this.free(this.list.shift());
    // A previous hit may have left the model using the shared white flash material.
    root.traverse(o => { if (o.isMesh && o.userData.mat) o.material = o.userData.mat; });
    for (const child of root.children) if (child !== mesh) child.visible = false;
    mesh.scale.setScalar(r);
    this.scene.add(root);
    batcher.track(root);
    const dir = velocity.clone().setY(0);
    if (dir.lengthSq() < 0.0001) dir.set(Math.sin(root.rotation.y), 0, Math.cos(root.rotation.y));
    dir.normalize();
    const c = { root, mesh, style, r, floor, t: 0, origin: root.position.clone(), dir, yaw: root.rotation.y,
      parts: parts.map(p => ({ mesh: p, pos: p.position.clone(), rotation: p.rotation.clone() })), fragment: null };
    if (style === 'shell' && parts.length) {
      const piece = parts[0];
      root.updateMatrixWorld(true);
      this.scene.attach(piece);             // the original spotted wing case / ring / iridescent back
      batcher.track(piece);
      c.fragment = { mesh: piece, origin: piece.position.clone(), scale: piece.scale.clone(), rotation: piece.rotation.clone() };
    }
    this.list.push(c);
    return true;
  }

  ground(mesh, floor) {
    mesh.updateMatrixWorld(true);
    this.box.makeEmpty();
    mesh.traverseVisible(o => {
      if (!o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      this.box.union(this.partBox.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
    });
    if (!this.box.isEmpty() && this.box.min.y < floor + 0.001) mesh.position.y += floor + 0.001 - this.box.min.y;
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i]; c.t += dt;
      if (juice.calm || this.reducedMotion.matches || c.t >= this.life) { this.free(c); this.list.splice(i, 1); continue; }
      const { root, mesh, style, r, t } = c, u = Math.max(0, t - 0.035);
      const move = 1 - Math.exp(-u * 7), shrink = 1 - THREE.MathUtils.smoothstep(t, this.life * 0.7, this.life);
      root.position.copy(c.origin).addScaledVector(c.dir, move * LOOK.num('death-skid', 0.055));
      root.rotation.set(0, c.yaw, 0);
      mesh.scale.setScalar(r * shrink);
      if (style === 'crumple') {
        mesh.scale.y *= 1 - move * 0.7;
        root.rotation.z = Math.sin(u * 14) * 0.18 * (1 - move);
        for (const p of c.parts) p.mesh.rotation.z = p.rotation.z - Math.sign(p.pos.x) * move * 1.25;
      } else if (style === 'flutter') {
        root.position.y -= LOOK.num('death-fall-gravity', 1.2) * u * u * 0.5;
        root.position.x += Math.sin(u * 16) * move * r * 0.7;
        root.rotation.y += u * LOOK.num('death-fly-spin', 7);
        root.rotation.z = Math.sin(u * 19) * 0.65;
        root.rotation.x = move * 1.2;
      } else if (style === 'shell') {
        mesh.scale.y *= 1 - move * 0.55;
        const f = c.fragment;
        if (f) {
          f.mesh.position.copy(f.origin).addScaledVector(c.dir, move * r * 1.4);
          f.mesh.position.x += move * r * 1.2;
          f.mesh.position.y += LOOK.num('death-shell-lift', 0.28) * u - LOOK.num('death-fall-gravity', 1.2) * u * u * 0.5;
          f.mesh.rotation.set(f.rotation.x + move * 3, f.rotation.y + move * 1.5, f.rotation.z + move * 2);
          f.mesh.scale.copy(f.scale).multiplyScalar(shrink);
          this.ground(f.mesh, c.floor);
        }
      }
      this.ground(root, c.floor);
    }
  }

  free(c) {
    this.scene.remove(c.root);
    if (c.fragment) this.scene.remove(c.fragment.mesh);
  }

  clear() { this.list.forEach(c => this.free(c)); this.list.length = 0; }
}
