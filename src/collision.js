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
      if (!m.geometry.boundsTree) m.geometry.boundsTree = new MeshBVH(m.geometry, BVH_OPTIONS);
      m.raycast = acceleratedRaycast;
    }
    this.raycaster = new THREE.Raycaster();
    this.raycaster.firstHitOnly = true;
    this._normal = new THREE.Vector3();
    this._sphere = new THREE.Sphere();
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
  addCollider(mesh) {
    mesh.updateMatrixWorld(true);
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
    this.raycaster.set(origin, dir);
    this.raycaster.near = 0;
    this.raycaster.far = far;
    for (const h of this.raycaster.intersectObjects(this.colliders, false)) {
      if (visibleChain(h.object)) return { distance: h.distance, point: h.point };
    }
    return null;
  }

  // Nearest hit along a ray, or null. Returned normal is in world space.
  cast(origin, dir, far) {
    this.raycaster.set(origin, dir);
    this.raycaster.near = 0;
    this.raycaster.far = far;
    const ray = this.raycaster.ray;
    const list = [];
    this.nearby.forEach((m, i) => {
      const sp = this.nearbySpheres[i];
      const r2 = sp.radius * sp.radius;
      if (ray.distanceSqToPoint(sp.center) > r2) return;
      // skip spheres entirely beyond `far`
      if (sp.center.distanceTo(origin) - sp.radius > far) return;
      list.push(m);
    });
    const hits = this.raycaster.intersectObjects(list, false);
    for (const h of hits) {
      if (!visibleChain(h.object)) continue; // hidden since we collected it
      const normal = h.face
        ? this._normal.copy(h.face.normal).transformDirection(h.object.matrixWorld).clone()
        : dir.clone().negate();
      return { distance: h.distance, point: h.point, normal };
    }
    return null;
  }
}

function isSolid(o) {
  if (!o.isMesh || o.isInstancedMesh || o.userData.noCollide) return false; // foliage is instanced: walk through leaves
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  return mats.some((m) => m && m.visible !== false && m.colorWrite !== false && !(m.transparent && m.opacity < 0.05));
}

function visibleChain(o) {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}
