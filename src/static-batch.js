// The apartment's furniture in fewer draws. An act's rooms are 900-odd meshes, and three.js
// pays the CPU for each one it draws every frame (a phone feels it). Pieces that share a
// material are drawn together as one BatchedMesh, which also skips the pieces out of view one by
// one. Each piece stays an ordinary mesh in the scene: solid (collision), moved by doors and the
// layout editor, faded by the camera. It's only moved to a camera layer nobody draws (batch.js's,
// so raycasters that look at the apartment enable it), and sync() keeps the batch in step: a piece
// the camera fades (its own see-through material) or hides drops out of the batch and is drawn
// by itself; a piece that moves takes its place in the batch with it.
//
// Left out: see-through lit pieces (glass, sheer fabric: drawn back to front among everything
// else), instanced ones, pieces with several materials, and materials only one piece uses. The
// soft-shadow cards under furniture are see-through too, but flat on the floor: their batch
// sorts them among themselves.
import * as THREE from 'three';
import { HIDDEN } from './batch.js';

const shape = (g) => Object.keys(g.attributes).sort().map((k) => { const a = g.attributes[k]; return `${k}${a.itemSize}${a.array.constructor.name}${a.normalized}`; }).join() + (g.index ? '|i' : '');
const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };

// The furniture holds still, so its ~2,000 matrices needn't be recomputed every frame. freeze(root)
// stops the scene's frame update at the apartment's root; whatever moves a piece under it (a door,
// the layout editor, a boss set) calls markMoved(piece), which updates that piece's matrices and has
// the next sync() move its batch copy. The story runner fails any story that leaves a piece moved
// without it (stories/kit.js stillMismatch).
let moved = true;
export let moves = 0;   // counts markMoved and freeze calls: the collision world re-checks a frozen piece's bounds only when it changes (collision.js focus)
export function markMoved(o) { o.updateMatrixWorld(true); moved = true; moves++; }
export function freeze(root) {
  moves++;
  root.updateMatrixWorld(true);
  root.userData.frozen = true;
  root.updateMatrixWorld = () => {};   // also skips an explicit scene.updateMatrixWorld(true): the pieces are already current
}

export class StaticBatches {
  constructor(scene) {
    this.scene = scene;
    this.batches = [];   // { batch, pieces: [{ mesh, id, material, matrix }] }
  }

  // batch the pieces under root (an act's rooms; called again for rooms loaded later, and for a
  // copy the layout editor drops in, whose pieces join their source's batches: no new draw)
  add(root) {
    const groups = new Map();
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.isBatchedMesh || Array.isArray(o.material) || o.layers.mask !== 1) return;
      const m = o.material;
      if ((m.transparent && !m.isMeshBasicMaterial) || m.transmission > 0 || o.morphTargetInfluences || o.userData.noBatch) return;   // the see-through soft-shadow cards are fine: the batch sorts them
      const key = m.uuid + '|' + shape(o.geometry);
      if (this.join(o, key)) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(o);
    });
    for (const [key, meshes] of groups) {
      if (meshes.length < 2) continue;
      let verts = 0, index = 0;
      for (const o of meshes) { verts += o.geometry.attributes.position.count; index += o.geometry.index?.count || 0; }
      const batch = new THREE.BatchedMesh(meshes.length, verts, index, meshes[0].material);
      batch.name = 'batch:' + meshes[0].material.name;
      const b = { batch, pieces: [], ids: new Map(), key };   // ids: a geometry shared by several pieces goes in once
      for (const o of meshes) {
        if (!b.ids.has(o.geometry)) b.ids.set(o.geometry, batch.addGeometry(o.geometry));
        this.place(b, o);
      }
      batch.frustumCulled = false;   // its pieces are culled one by one (perObjectFrustumCulled); its own bounds don't follow a door's swing
      this.scene.add(batch);
      this.batches.push(b);
    }
  }

  place({ batch, pieces, ids }, o) {
    const id = batch.addInstance(ids.get(o.geometry));
    batch.setMatrixAt(id, o.matrixWorld);
    const vis = shown(o);
    batch.setVisibleAt(id, vis);
    pieces.push({ mesh: o, id, material: o.material, matrix: o.matrixWorld.clone(), inBatch: vis });
    if (vis) o.layers.set(HIDDEN);
  }

  // a piece whose geometry is already in a batch of its material (a copy) goes in that batch
  join(o, key) {
    const b = this.batches.find((x) => x.key === key && x.ids.has(o.geometry));
    if (!b) return false;
    if (b.batch.instanceCount >= b.batch.maxInstanceCount) b.batch.setInstanceCount(b.batch.maxInstanceCount + 8);
    this.place(b, o);
    return true;
  }

  // once a frame, before drawing: a piece faded, hidden or shown again; a piece moved (markMoved)
  sync() {
    const check = moved;
    moved = false;
    for (const { batch, pieces } of this.batches) {
      for (const p of pieces) {
        const o = p.mesh, inBatch = o.material === p.material && shown(o);
        const back = inBatch !== p.inBatch;
        if (back) {
          p.inBatch = inBatch;
          batch.setVisibleAt(p.id, inBatch);
          o.layers.set(inBatch ? HIDDEN : 0);   // faded (or hidden): drawn by itself
        }
        if ((check || back) && inBatch && !o.matrixWorld.equals(p.matrix)) {
          p.matrix.copy(o.matrixWorld);
          batch.setMatrixAt(p.id, p.matrix);
        }
      }
    }
  }

  // pieces drawn in batches, and how many batches (the F3 readout, stories)
  get count() { return this.batches.reduce((n, b) => n + b.pieces.filter((p) => p.inBatch).length, 0); }
}
