// Instanced drawing for the many small moving things: bug parts, bubbles, puffs, gut chunks,
// rings, XP drops, tentacles, spit. Each one stays an ordinary mesh in the scene graph, so
// the code that moves, animates, hides or re-colors it doesn't change, but the renderer no
// longer draws it (it's moved to a camera layer nobody renders). Once a frame, before the
// render, sync() gathers every visible tracked mesh, groups them by geometry + material, and
// draws each group as one InstancedMesh: a fight is a few dozen draw calls instead of 2,000.
//
// Per-instance color and opacity: a material marked `material.userData.perInstance = true`
// takes each mesh's `userData.color` (a THREE.Color) and `userData.opacity` (0..1), so pooled
// effects can share one material while every puff has its own tint and fade.
import * as THREE from 'three';

const HIDDEN = 31;          // the layer tracked meshes move to; the camera never enables it
const WHITE = new THREE.Color(1, 1, 1);

// instanced copy of a per-instance material: multiplies the output alpha by an instance attribute
function withInstanceOpacity(src) {
  const m = src.clone();
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float instanceOpacity;\nvarying float vInstanceOpacity;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstanceOpacity = instanceOpacity;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vInstanceOpacity;')
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a *= vInstanceOpacity;');
  };
  m.customProgramCacheKey = () => 'instanceOpacity';
  m.transparent = true;
  return m;
}

export class Batcher {
  constructor(scene = null) {
    this.scene = scene;
    this.roots = new Set();
    this.groups = new Map();     // geometry.id * 65536 + material.id -> group (a number: no string per mesh per frame)
    this.drawn = 0;              // instances drawn last sync (for the debug readout)
    this._visit = (o) => this.collect(o);
  }

  // Draw this object (and everything under it, including meshes added later) instanced.
  // Roots are dropped automatically once they're removed from the scene.
  track(root) { this.roots.add(root); return root; }

  group(geo, mat) {
    const key = geo.id * 65536 + mat.id;
    let g = this.groups.get(key);
    if (!g) {
      const per = !!mat.userData.perInstance;
      g = { geo, src: mat, per, mat: per ? withInstanceOpacity(mat) : mat, mesh: null, cap: 0, n: 0, list: [] };
      this.groups.set(key, g);
    }
    return g;
  }

  grow(g, need) {
    let cap = Math.max(16, g.cap);
    while (cap < need) cap *= 2;
    if (g.mesh) { this.scene.remove(g.mesh); g.mesh.dispose(); }
    const m = new THREE.InstancedMesh(g.geo, g.mat, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;           // instances move every frame; the GPU clips them
    m.matrixAutoUpdate = false;
    if (g.per) {
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
      m.geometry = g.geo.clone();      // the opacity attribute lives on this group's own copy
      m.geometry.setAttribute('instanceOpacity', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage));
      g.geo2?.dispose();
      g.geo2 = m.geometry;
    }
    m.count = 0;
    this.scene.add(m);
    g.mesh = m;
    g.cap = cap;
  }

  collect(o) {
    if (!o.isMesh || o.isInstancedMesh) return;
    if (o.layers.mask !== 1 << HIDDEN) o.layers.set(HIDDEN);
    const g = this.group(o.geometry, o.material);
    g.list[g.n++] = o;
  }

  // Gather this frame's instances. Call once per frame, right before rendering.
  sync() {
    for (const g of this.groups.values()) g.n = 0;
    for (const root of this.roots) {
      if (!root.parent) { this.roots.delete(root); continue; }
      if (!root.visible) continue;
      root.updateMatrixWorld();
      root.traverseVisible(this._visit);
    }
    let drawn = 0;
    for (const g of this.groups.values()) {
      if (g.n > g.cap || (g.n && !g.mesh)) this.grow(g, g.n);
      if (!g.mesh) continue;
      const m = g.mesh;
      m.count = g.n;
      m.visible = g.n > 0;
      if (!g.n) continue;
      const op = g.per ? m.geometry.attributes.instanceOpacity : null;
      for (let i = 0; i < g.n; i++) {
        const o = g.list[i];
        m.setMatrixAt(i, o.matrixWorld);
        if (g.per) {
          m.setColorAt(i, o.userData.color || WHITE);
          op.array[i] = o.userData.opacity ?? 1;
        }
      }
      m.instanceMatrix.clearUpdateRanges();
      m.instanceMatrix.addUpdateRange(0, g.n * 16);
      m.instanceMatrix.needsUpdate = true;
      if (g.per) { m.instanceColor.needsUpdate = true; op.needsUpdate = true; }
      drawn += g.n;
    }
    this.drawn = drawn;
  }
}

// The game's one batcher; main.js gives it the scene, anything can track meshes with it
export const batcher = new Batcher();
