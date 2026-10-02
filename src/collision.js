import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';

import * as THREE from 'three';

// indirect: the BVH keeps its own triangle order instead of reordering the geometry's index.
// The compressed apartment shares index buffers between meshes, and reordering one in place
// scrambled the others (holes in furniture).
const BVH_OPTIONS = { indirect: true };

// Raycast-based collision against the apartment meshes. Rays use each mesh's
// current transform, so things that move (doors, the cat) still collide.
// Each collider gets a BVH so a ray only tests the few triangles near it.
export class World {
  constructor(scene, { exclude = [] } = {}) {
    this.colliders = [];
    scene.updateMatrixWorld(true);
    const skip = new Set(exclude);
    // Include hidden objects too: the apartment viewer hides walls between its camera
    // and the room. cast() skips whatever is hidden at the moment of the ray.
    const walk = (o) => {
      if (skip.has(o)) return;
      if (isSolid(o)) this.colliders.push(o);
      for (const c of o.children) walk(c);
    };
    walk(scene);
    for (const m of this.colliders) {
      plainPositions(m.geometry);
      if (!m.geometry.boundsTree) m.geometry.boundsTree = new MeshBVH(m.geometry, BVH_OPTIONS);
      m.raycast = acceleratedRaycast;
    }
    this.raycaster = new THREE.Raycaster();
    this.raycaster.firstHitOnly = true;
    this._normal = new THREE.Vector3();
    this._sphere = new THREE.Sphere();
    // cast() scratch: it runs 100+ times a frame in a fight, so it allocates nothing on a miss
    this._ray = new THREE.Ray();
    this._lray = new THREE.Ray();
    this._inv = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._hitN = new THREE.Vector3();
    this._ta = new THREE.Vector3(); this._tb = new THREE.Vector3(); this._tc = new THREE.Vector3();
    this._tri = new THREE.Triangle();
    this._stack = new Int32Array(128);
    this._views = new WeakMap();       // BVH node buffer -> its typed-array views, made once
    this.spheres = this.colliders.map((m) => {
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      return new THREE.Sphere();
    });
    this.nearby = this.colliders;
    this.nearbySpheres = this.spheres;
    this._focus = new THREE.Vector3(Infinity, 0, 0);
    this._focusAge = 0;
  }

  // Add a mesh that isn't part of the apartment (invisible walls, props)
  // Everything solid under these objects (an act's rooms arriving: apartment.js)
  addObjects(roots) {
    for (const r of roots) r.traverse((o) => { if (isSolid(o)) this.addCollider(o); });
  }

  addCollider(mesh) {
    mesh.updateMatrixWorld(true);
    plainPositions(mesh.geometry);
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    if (!mesh.geometry.boundsTree) mesh.geometry.boundsTree = new MeshBVH(mesh.geometry, BVH_OPTIONS);
    mesh.raycast = acceleratedRaycast;
    this.colliders.push(mesh);
    this.spheres.push(new THREE.Sphere());
    this._focusAge = Infinity; // rebuild the nearby list next frame
  }

  // Keep a short list of colliders around the player so each ray only checks those.
  // Rebuilt when the player moves or every quarter second (doors swing, the cat walks).
  focus(center, dt, radius = 1.6) {
    this._focusAge += dt;
    if (this._focus.distanceToSquared(center) < 0.04 && this._focusAge < 0.25) return;
    this._focus.copy(center);
    this._focusAge = 0;
    this.nearby = [];
    this.nearbySpheres = [];
    this.colliders.forEach((m, i) => {
      const s = this.spheres[i].copy(m.geometry.boundingSphere).applyMatrix4(m.matrixWorld);
      if (s.center.distanceTo(center) - s.radius < radius) {
        this.nearby.push(m);
        this.nearbySpheres.push(s);
      }
    });
  }

  // Like cast(), but checks every collider (slow; for rare lookups far from the player)
  castAll(origin, dir, far) {
    if (!this.allSpheres || this.allSpheres.length !== this.colliders.length) {
      this.allSpheres = this.colliders.map((m) => m.geometry.boundingSphere.clone().applyMatrix4(m.matrixWorld));
    }
    this.raycaster.set(origin, dir);
    this.raycaster.near = 0;
    this.raycaster.far = far;
    const ray = this.raycaster.ray;
    const list = this.colliders.filter((m, i) => {
      const s = this.allSpheres[i];
      return ray.distanceSqToPoint(s.center) <= s.radius * s.radius && s.center.distanceTo(origin) - s.radius <= far;
    });
    for (const h of this.raycaster.intersectObjects(list, false)) {
      if (visibleChain(h.object)) return { distance: h.distance, point: h.point };
    }
    return null;
  }

  // Nearest hit along a ray, or null. Returned normal is in world space.
  // Walks each nearby collider's BVH itself instead of going through Raycaster (which built and
  // sorted hit objects for every mesh a ray touched) or the BVH's shapecast (which wraps its
  // node buffer in three new typed arrays per call). A miss allocates nothing; a hit, the result.
  cast(origin, dir, far) {
    const ray = this._ray.set(origin, dir);
    this._best = far;
    this._hit = false;
    for (let i = 0; i < this.nearby.length; i++) {
      const m = this.nearby[i], sp = this.nearbySpheres[i];
      if (ray.distanceSqToPoint(sp.center) > sp.radius * sp.radius) continue;
      if (sp.center.distanceTo(origin) - sp.radius > this._best) continue;   // entirely beyond the best hit
      if (!visibleChain(m)) continue;                                          // hidden since we collected it
      this.castMesh(m, origin);
    }
    if (!this._hit) return null;
    return { distance: this._best, point: dir.clone().multiplyScalar(this._best).add(origin), normal: this._hitN.clone() };
  }

  castMesh(m, origin) {
    const mw = m.matrixWorld, lray = this._lray, g = m.geometry, bvh = g.boundsTree;
    lray.copy(this._ray).applyMatrix4(this._inv.copy(mw).invert());
    // world meters per local unit along this ray (meshes can be scaled)
    const k = this._p.copy(lray.direction).add(lray.origin).applyMatrix4(mw).distanceTo(origin);
    const mat = Array.isArray(m.material) ? null : m.material;
    const side = mat ? mat.side : THREE.DoubleSide;
    const cull = side === THREE.FrontSide, flip = side === THREE.BackSide;
    const pos = g.attributes.position.array, idx = g.index ? g.index.array : null;
    R.ox = lray.origin.x; R.oy = lray.origin.y; R.oz = lray.origin.z;
    R.dx = lray.direction.x; R.dy = lray.direction.y; R.dz = lray.direction.z;
    const A = this._ta, B = this._tb, C = this._tc, P = this._p, stack = this._stack;
    let bestT = this._best / k;
    for (let ri = 0; ri < bvh._roots.length; ri++) {
      const root = bvh._roots[ri];
      let v = this._views.get(root);
      if (!v) this._views.set(root, v = { f: new Float32Array(root), u16: new Uint16Array(root), u32: new Uint32Array(root) });
      const { f, u16, u32 } = v;
      let sp = 0;
      stack[sp++] = 0;
      while (sp) {
        const n = stack[--sp];
        if (enter(f, n) > bestT) continue;
        if (u16[n * 2 + 15] === 0xFFFF) {
          // a leaf: test its triangles, straight from the typed arrays
          const off = u32[n + 6], count = u16[n * 2 + 14];
          for (let i = off, end = off + count; i < end; i++) {
            const t = bvh.resolveTriangleIndex(i) * 3;
            const a = (idx ? idx[t] : t) * 3, b = (idx ? idx[t + 1] : t + 1) * 3, c = (idx ? idx[t + 2] : t + 2) * 3;
            A.set(pos[a], pos[a + 1], pos[a + 2]);
            B.set(pos[b], pos[b + 1], pos[b + 2]);
            C.set(pos[c], pos[c + 1], pos[c + 2]);
            if (!(flip ? lray.intersectTriangle(C, B, A, true, P) : lray.intersectTriangle(A, B, C, cull, P))) continue;
            const tl = P.distanceTo(lray.origin);
            if (tl < bestT) {
              bestT = tl;
              this._hit = true;
              this._tri.set(A, B, C).getNormal(this._hitN).transformDirection(mw);
            }
          }
        } else {
          // visit the nearer child first so the best hit shrinks early and prunes more
          const l = n + 8, r = u32[n + 6];
          if (enter(f, l) <= enter(f, r)) { stack[sp++] = r; stack[sp++] = l; } else { stack[sp++] = l; stack[sp++] = r; }
        }
      }
    }
    this._best = Math.min(this._best, bestT * k);
  }
}

function isSolid(o) {
  if (!o.isMesh || o.isInstancedMesh || o.userData.noCollide) return false; // foliage is instanced: walk through leaves
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  return mats.some((m) => m && m.visible !== false && m.colorWrite !== false && !(m.transparent && m.opacity < 0.05));
}

// cast() reads positions straight from a Float32Array; give any interleaved or quantized
// position attribute a plain float copy once, up front
function plainPositions(geo) {
  const p = geo.attributes.position;
  if (!p.isInterleavedBufferAttribute && !p.normalized && p.array instanceof Float32Array) return;
  const a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { a[i * 3] = p.getX(i); a[i * 3 + 1] = p.getY(i); a[i * 3 + 2] = p.getZ(i); }
  geo.setAttribute('position', new THREE.BufferAttribute(a, 3));
}

// The local ray for the BVH walk (module scratch: no closure or object per call)
const R = { ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 0 };
// Entry distance of the ray into BVH node n's box (min xyz at f[n..n+2], max at f[n+3..n+5]),
// clamped to 0 when it starts inside; Infinity when it misses.
function enter(f, n) {
  let lo = 0, hi = Infinity;
  for (let a = 0; a < 3; a++) {
    const o = a === 0 ? R.ox : a === 1 ? R.oy : R.oz, d = a === 0 ? R.dx : a === 1 ? R.dy : R.dz;
    const min = f[n + a], max = f[n + 3 + a];
    if (d === 0) {                       // parallel to this slab: inside it or a miss
      if (o < min || o > max) return Infinity;
      continue;
    }
    let t1 = (min - o) / d, t2 = (max - o) / d;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    if (t1 > lo) lo = t1;
    if (t2 < hi) hi = t2;
    if (lo > hi) return Infinity;
  }
  return lo;
}

function visibleChain(o) {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}
