import * as THREE from 'three';

// Orbit camera that follows the player from a fixed angle and distance (look.css --camera-tilt,
// --camera-distance): it never tilts, pulls in or snaps on its own, because a view that moves
// under you throws your aim off. Instead, whatever would block the view fades out: furniture
// over the jelly (the coffee table, the media console, the counter's overhang) and anything
// between the camera and the jelly (a wall behind you, a sofa back), solid again once it's
// clear. Five rays to the camera, not one, so a wall at the frame's edge counts too, and each
// ray looks through a few layers (a shelf, then the cabinet behind it).
const SEE_THROUGH = 0.22;      // how solid a faded piece of furniture or wall looks
const LAYERS = 3;              // how many things one ray may look through
const UP = new THREE.Vector3(0, 1, 0);
const NONE = [];

const faded = (mat) => {
  const c = mat.clone();
  c.transparent = true;
  c.depthWrite = false;
  c.userData.solid = mat.opacity;
  return c;
};

export class ThirdPersonCamera {
  constructor(camera, world, cfg) {
    this.camera = camera;
    this.world = world;
    this.cfg = cfg;
    this.yaw = 0;
    this.pitch = cfg.pitch ?? 0.35;   // the tilt (the player can change it with the mouse; nothing else does)
    this.viewPitch = this.pitch;
    this.distance = cfg.distance;
    this.currentDistance = cfg.distance;   // always this.distance: kept for readers of the old name
    this.focus = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._side = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._ray = new THREE.Vector3();
    this._end = new THREE.Vector3();
    this.over = new Set();     // what the camera sees through: over the jelly, or between it and the jelly
    this._fades = new Map();   // mesh -> { mats: its own material(s), see: the fading copies, k: opacity }
  }

  // What's right over the jelly, and what's between it and the camera: up to LAYERS things along
  // the ray straight up and along five rays to the camera (its centre and four points around it)
  findOver(camPos) {
    this.over.clear();
    if (this.cfg.seeThrough === false) return;
    this.look(UP, this.distance);
    const dir = this._dir.subVectors(camPos, this.focus), far = dir.length();
    if (far < 1e-6) return;
    dir.multiplyScalar(1 / far);
    this._side.crossVectors(dir, UP);
    if (this._side.lengthSq() < 1e-6) this._side.set(1, 0, 0);
    this._side.normalize();
    this._up.crossVectors(this._side, dir).normalize();
    const r = this.cfg.clearRadius ?? 0.015;
    this.look(dir, far + r);
    for (let i = 0; i < 4; i++) {
      this._end.copy(camPos).addScaledVector(this._side, i & 1 ? r : -r).addScaledVector(this._up, i & 2 ? r : -r);
      const len = this._ray.subVectors(this._end, this.focus).length();
      this.look(this._ray.multiplyScalar(1 / len), len + r);
    }
  }

  look(dir, far) {
    for (let i = 0; i < LAYERS; i++) {
      const h = this.world.cast(this.focus, dir, far, this.over);
      if (!h?.mesh) return;
      this.over.add(h.mesh);
      // and the instanced parts of the same piece (a sideboard's flutes): nothing collides with
      // instanced meshes, so no ray finds them
      const kin = h.mesh.parent && !h.mesh.parent.isScene ? h.mesh.parent.children : NONE;   // not the scene's: the bugs are instanced
      for (let k = 0; k < kin.length; k++) if (kin[k].isInstancedMesh && kin[k].visible) this.over.add(kin[k]);
    }
  }

  // Fade what's in the way out, and back in (on its own material again) once it's clear
  fade(dt) {
    for (const m of this.over) {
      if (this._fades.has(m)) continue;
      const mats = m.material, see = Array.isArray(mats) ? mats.map(faded) : faded(mats);
      this._fades.set(m, { mats, see, k: 1 });
      m.material = see;
    }
    for (const [m, f] of this._fades) {
      const goal = this.over.has(m) ? SEE_THROUGH : 1;
      f.k += (goal - f.k) * (1 - Math.exp(-10 * dt));
      if (goal === 1 && f.k > 0.98) { m.material = f.mats; this._fades.delete(m); continue; }
      for (const s of [].concat(f.see)) s.opacity = s.userData.solid * f.k;
    }
  }

  // Unit vector from the focus toward the camera at this tilt
  dirAt(pitch, out) {
    const cp = Math.cos(pitch);
    return out.set(Math.sin(this.yaw) * cp, Math.sin(pitch), Math.cos(this.yaw) * cp);
  }

  update(dt, mouse, target) {
    const c = this.cfg;
    this.yaw -= mouse.x * c.sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch + mouse.y * c.sensitivity, c.minPitch, c.maxPitch);
    this.distance = THREE.MathUtils.clamp(this.distance * (1 + mouse.wheel * 0.1), c.minDistance, c.maxDistance);
    this.viewPitch = this.pitch;
    this.currentDistance = this.distance;

    // Smooth follow on the focus point
    this._end.set(target.x, target.y + c.height, target.z);
    this.focus.lerp(this._end, 1 - Math.exp(-20 * dt));

    this.dirAt(this.pitch, this._dir);
    this.camera.position.copy(this.focus).addScaledVector(this._dir, this.distance);
    this.camera.lookAt(this.focus);
    this.findOver(this.camera.position);
    this.fade(dt);
  }

  // A see-through copy of everything solid (anything can end up between the camera and the
  // jelly), one per material, standing where the original is, so main.js can build their shaders
  // behind the Play button: building one the first time the camera sees through it stalled a
  // phone for a frame or more. `within`: only colliders inside this box (a newly loaded act's rooms)
  seeThroughWarmers(within = null) {
    const found = new Map(), box = new THREE.Box3();
    for (const m of this.world.colliders) {
      if (!m.isMesh) continue;
      if (within && !within.intersectsBox(box.setFromObject(m))) continue;
      if (!found.has(m.material)) found.set(m.material, m);
      // and the instanced parts that fade along with it (look)
      if (m.parent && !m.parent.isScene) for (const k of m.parent.children) if (k.isInstancedMesh && !found.has(k.material)) found.set(k.material, k);
    }
    return [...found.values()].map((m) => {
      const mat = Array.isArray(m.material) ? m.material.map(faded) : faded(m.material);
      const copy = m.isInstancedMesh ? new THREE.InstancedMesh(m.geometry, mat, 1) : new THREE.Mesh(m.geometry, mat);
      m.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale);
      return copy;
    });
  }

  snapTo(target) {
    this.focus.set(target.x, target.y + this.cfg.height, target.z);
    this.viewPitch = this.pitch;
  }
}
