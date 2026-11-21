// The apartment's furniture in fewer draws. An act's rooms are 900-odd meshes, and three.js
// pays the CPU for each one it draws every frame (a phone feels it). Pieces that share a
// material are drawn together as one BatchedMesh, which also skips the pieces out of view one by
// one (static-batch culls them itself, on a slower clock than the frame: see cull()). Each piece stays an ordinary mesh in the scene: solid (collision), moved by doors and the
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
import { LOOK } from './look.js';

const shape = (g) => Object.keys(g.attributes).sort().map((k) => { const a = g.attributes[k]; return `${k}${a.itemSize}${a.array.constructor.name}${a.normalized}`; }).join() + (g.index ? '|i' : '');
const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
const _v = new THREE.Vector3(), _sc = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Sphere(), _f = new THREE.Frustum();

// The furniture holds still, so its ~2,000 matrices needn't be recomputed every frame. freeze(root)
// stops the scene's frame update at the apartment's root; whatever moves a piece under it (a door,
// the layout editor, a boss set) calls markMoved(piece), which updates that piece's matrices and has
// the next sync() move its batch copy. The story runner fails any story that leaves a piece moved
// without it (stories/kit.js stillMismatch).
let moved = true;
export function markMoved(o) { o.updateMatrixWorld(true); moved = true; }
export function freeze(root) {
  root.updateMatrixWorld(true);
  root.userData.frozen = true;
  root.updateMatrixWorld = () => {};   // also skips an explicit scene.updateMatrixWorld(true): the pieces are already current
}

export class StaticBatches {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.batches = [];   // { batch, pieces: [{ mesh, id, material, matrix, inBatch, inView }] }
    this.move = LOOK.num('batch-cull-move', 0.05);
    this.turn = LOOK.num('batch-cull-turn', 4) * Math.PI / 180;
    this.at = { pos: new THREE.Vector3(Infinity, 0, 0), quat: new THREE.Quaternion(), proj: new THREE.Matrix4() };   // the camera at the last cull
    this.culls = 0;   // (stories)
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
      batch.frustumCulled = false;   // its pieces are culled one by one (cull()); its own bounds don't follow a door's swing
      // three would cull and sort every piece, and upload the draw list, every frame; with both off it reuses
      // the last list until a piece's visibility changes (cull() and sync() set it)
      batch.perObjectFrustumCulled = false;
      batch.sortObjects = false;   // opaque: a phone's GPU rejects hidden pixels itself (the see-through shadow cards sort on a cull frame)
      this.scene.add(batch);
      this.batches.push(b);
    }
  }

  place({ batch, pieces, ids }, o) {
    const id = batch.addInstance(ids.get(o.geometry));
    batch.setMatrixAt(id, o.matrixWorld);
    const vis = shown(o);
    batch.setVisibleAt(id, vis);
    pieces.push({ mesh: o, id, material: o.material, matrix: o.matrixWorld.clone(), inBatch: vis, inView: true });
    if (vis) o.layers.set(HIDDEN);
    this.at.pos.x = Infinity;   // a new piece: cull on the next frame
  }

  // a piece whose geometry is already in a batch of its material (a copy) goes in that batch
  join(o, key) {
    const b = this.batches.find((x) => x.key === key && x.ids.has(o.geometry));
    if (!b) return false;
    if (b.batch.instanceCount >= b.batch.maxInstanceCount) b.batch.setInstanceCount(b.batch.maxInstanceCount + 8);
    this.place(b, o);
    return true;
  }

  // once a frame, before drawing: a piece faded, hidden or shown again; a piece moved (markMoved);
  // and, when the camera has moved or turned enough, which pieces are in view
  sync() {
    const check = moved;
    moved = false;
    let changed = check;
    for (const { batch, pieces } of this.batches) {
      for (const p of pieces) {
        const o = p.mesh, inBatch = o.material === p.material && shown(o);
        const back = inBatch !== p.inBatch;
        if (back) {
          p.inBatch = inBatch;
          batch.setVisibleAt(p.id, inBatch && p.inView);
          o.layers.set(inBatch ? HIDDEN : 0);   // faded (or hidden): drawn by itself
          changed = true;
        }
        if ((check || back) && inBatch && !o.matrixWorld.equals(p.matrix)) {
          p.matrix.copy(o.matrixWorld);
          batch.setMatrixAt(p.id, p.matrix);
        }
      }
    }
    this.cull(changed);
  }

  // Which pieces are in view, worked out only when the camera has moved more than --batch-cull-move or
  // turned more than --batch-cull-turn since the last time (or its lens changed, or a piece moved or came
  // back): each piece is padded by both, so one the camera's view reaches before the next cull is already drawn.
  // A cut (a teleport, a cut scene) is just a big move: culled that frame.
  cull(force) {
    const cam = this.camera, at = this.at;
    if (!cam || !this.batches.length) return;
    cam.updateMatrixWorld();   // (the renderer does the same before it draws: the camera has no parent)
    cam.matrixWorld.decompose(_v, _q, _sc);
    if (!force && _v.distanceTo(at.pos) <= this.move && _q.angleTo(at.quat) <= this.turn && cam.projectionMatrix.equals(at.proj)) {
      for (const { batch } of this.batches) if (batch.sortObjects) batch.sortObjects = false;
      return;
    }
    at.pos.copy(_v); at.quat.copy(_q); at.proj.copy(cam.projectionMatrix);
    this.culls++;
    _f.setFromProjectionMatrix(_m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse), cam.coordinateSystem, cam.reversedDepth);
    const sway = 2 * Math.sin(this.turn / 2);   // how far a turn of that much can move a view plane, per meter from the camera
    for (const { batch, pieces } of this.batches) {   // (the batches sit at the origin: their pieces' matrices are world matrices)
      for (const p of pieces) {
        batch.getBoundingSphereAt(batch.getGeometryIdAt(p.id), _s).applyMatrix4(p.matrix);
        _s.radius += this.move + sway * (_s.center.distanceTo(_v) + this.move);   // the camera may move and turn that much before the next cull
        const inView = _f.intersectsSphere(_s);
        if (inView !== p.inView) { p.inView = inView; if (p.inBatch) batch.setVisibleAt(p.id, inView); }
      }
      batch.sortObjects = batch.material.transparent;   // the shadow cards: back to front, from here
    }
  }

  // pieces drawn in batches, and how many batches (the F3 readout, stories)
  get count() { return this.batches.reduce((n, b) => n + b.pieces.filter((p) => p.inBatch).length, 0); }
}
