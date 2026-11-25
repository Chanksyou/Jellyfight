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

export const HIDDEN = 31;          // the layer tracked meshes move to; the camera never enables it
const WHITE = new THREE.Color(1, 1, 1);

// instanced copy of a per-instance material: multiplies the output alpha by an instance attribute
// (a material with userData.soft also fades toward its silhouette: a soft puff, not a ball)
function withInstanceOpacity(src) {
  const m = src.clone(), soft = src.userData.soft;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float instanceOpacity;\nvarying float vInstanceOpacity;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstanceOpacity = instanceOpacity;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vInstanceOpacity;')
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a *= vInstanceOpacity;');
    if (soft) {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vFacing;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFacing = abs(dot(normalize(mat3(modelViewMatrix * instanceMatrix) * normal), normalize(-(modelViewMatrix * instanceMatrix * vec4(position, 1.0)).xyz)));');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFacing;')
        .replace('gl_FragColor.a *= vInstanceOpacity;', `gl_FragColor.a *= vInstanceOpacity * smoothstep(0.0, ${Math.max(0.01, soft).toFixed(2)}, vFacing);`);
    }
  };
  m.customProgramCacheKey = () => 'instanceOpacity' + (soft ? `Soft${soft}` : '');
  m.transparent = true;
  return m;
}

export class Batcher {
  constructor(scene = null) {
    this.scene = scene;
    this.roots = new Set();
    this.groups = new Map();     // geometry.id -> Map(material.id -> group): no arithmetic key, so no collision however large the ids grow (material clones mint new ids all session)
    this.all = [];               // every group in one list, so a frame walks an array, not two Maps' iterators
    this.drawn = 0;              // instances drawn last sync (for the debug readout)
    this._visit = (o) => this.collect(o);
  }

  // Draw this object (and everything under it, including meshes added later) instanced.
  // Roots are dropped automatically once they're removed from the scene.
  track(root) { this.roots.add(root); return root; }

  group(geo, mat) {
    let byMat = this.groups.get(geo.id);
    if (!byMat) { byMat = new Map(); this.groups.set(geo.id, byMat); }
    let g = byMat.get(mat.id);
    if (!g) {
      const per = !!mat.userData.perInstance;
      g = { geo, src: mat, per, mat: per ? withInstanceOpacity(mat) : mat, mesh: null, cap: 0, n: 0, list: [] };
      byMat.set(mat.id, g); this.all.push(g);
    }
    return g;
  }

  grow(g, need) {
    let cap = Math.max(16, g.cap);
    while (cap < need) cap *= 2;
    if (g.mesh) { this.scene.remove(g.mesh); g.mesh.dispose(); }
    const m = new THREE.InstancedMesh(g.geo, g.mat, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.renderOrder = g.src.userData.renderOrder || 0;   // a material can say where it draws among the transparent things
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
    if (!o.isMesh || o.isInstancedMesh || o.userData.ownDraw) return;   // ownDraw: a mesh with uniforms of its own (a Treasure's floor glow) draws itself
    if (o.layers.mask !== 1 << HIDDEN) o.layers.set(HIDDEN);
    const g = this.group(o.geometry, o.material);
    g.list[g.n++] = o;
  }

  // Gather this frame's instances. Call once per frame, right before rendering.
  // current: this.scene's matrices are already this frame's (updateShown just ran), so a root in it isn't walked again
  sync(current = false) {
    for (let i = 0; i < this.all.length; i++) this.all[i].n = 0;
    for (const root of this.roots) {
      if (!root.parent) { this.roots.delete(root); continue; }
      if (!root.visible) continue;
      if (!current || top(root) !== this.scene) root.updateMatrixWorld();
      root.traverseVisible(this._visit);
    }
    let drawn = 0;
    for (let k = 0; k < this.all.length; k++) {
      const g = this.all[k];
      g.list.length = g.n; // release removed model subtrees; retain the reusable GPU batch
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
      if (g.per) {
        m.instanceColor.clearUpdateRanges();
        m.instanceColor.addUpdateRange(0, g.n * 3);
        m.instanceColor.needsUpdate = true;
        op.clearUpdateRanges();
        op.addUpdateRange(0, g.n);
        op.needsUpdate = true;
      }
      drawn += g.n;
    }
    this.drawn = drawn;
  }
}

const top = (o) => { while (o.parent) o = o.parent; return o; };

// The frame's one matrix pass (systems.js RenderSystem), in place of the renderer's own scene.updateMatrixWorld():
// the same, except a hidden piece one or two levels down (a pooled effect, shot or Warning not in use, a hidden
// group's parts) is left as it was while it's hidden. Nobody draws it, and the frame it shows it's brought current.
const PLAIN = THREE.Object3D.prototype.updateMatrixWorld;
export function updateShown(o, force = false, depth = 0) {
  if (o.matrixAutoUpdate) o.updateMatrix();
  if (o.matrixWorldNeedsUpdate || force) {
    if (o.matrixWorldAutoUpdate) { if (o.parent) o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix); else o.matrixWorld.copy(o.matrix); }
    o.matrixWorldNeedsUpdate = false;
    force = true;
  }
  const kids = o.children;
  for (let i = 0; i < kids.length; i++) {
    const c = kids[i];
    if (!c.visible) { c.staleWhileHidden = true; continue; }
    const f = force || c.staleWhileHidden === true;
    c.staleWhileHidden = false;
    if (depth > 0 || c.updateMatrixWorld !== PLAIN) c.updateMatrixWorld(f);   // deeper down (a bug's own parts, the jelly's rig), and anything with its own (a frozen apartment, a camera): as three does it
    else updateShown(c, f, 1);
  }
}

// The game's one batcher; main.js gives it the scene, anything can track meshes with it
export const batcher = new Batcher();

// Run fn with what it tracks going to `other` instead (a menu's own little scene: the pick screen's
// attack preview, attack-preview.js), so the game's systems can be run there unchanged. other.sync()
// draws them.
export function batchingInto(other, fn) {
  const { scene, roots, groups } = batcher;
  Object.assign(batcher, { scene: other.scene, roots: other.roots, groups: other.groups });
  try { return fn(); } finally { Object.assign(batcher, { scene, roots, groups }); }
}
