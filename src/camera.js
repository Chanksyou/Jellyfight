import * as THREE from 'three';

// Orbit camera that follows the player and keeps the view clear of the furniture.
// When something is in the way (the jelly backed against a wall, up on the vanity, in the
// sink), it tilts up toward top-down to look over it. Furniture the jelly is underneath (the
// coffee table, the media console, the kitchen counter's overhang) it sees through instead,
// fading it out while you're under it. Only when all that still leaves something in the way
// does it pull in closer. Several rays, not one, so walls beside the camera count too, not
// just ones straight behind it.
const PITCH_STEP = 0.1;        // how finely it searches upward for a clear tilt
const HOLD = 0.3;              // seconds a pull-in or tilt-up holds before easing back
const SEE_THROUGH = 0.22;      // how solid furniture over the jelly looks while the camera sees through it
const UP = new THREE.Vector3(0, 1, 0);

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
    this.pitch = cfg.pitch ?? 0.35;   // the tilt the player chose
    this.viewPitch = this.pitch;      // the tilt in use (higher while looking over something)
    this.distance = cfg.distance;
    this.currentDistance = cfg.distance;
    this.focus = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._side = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._ray = new THREE.Vector3();
    this._end = new THREE.Vector3();
    this._holdD = 0;
    this._holdP = 0;
    this.over = new Set();     // furniture over the jelly, which the camera sees through
    this._fades = new Map();   // mesh -> { mats: its own material(s), see: the fading copies, k: opacity }
  }

  // What's right over the jelly, within the camera's reach (up to 3 layers: a shelf, then a top)
  findOver() {
    this.over.clear();
    if (this.cfg.seeThrough === false) return;
    for (let i = 0; i < 3; i++) {
      const h = this.world.cast(this.focus, UP, this.distance, this.over);
      if (!h?.mesh) break;
      this.over.add(h.mesh);
    }
  }

  // Fade what's over the jelly out, and back in (on its own material again) once you leave
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

  // How far the camera can sit along `dir` before it, or the space around it, touches
  // something: the centre ray plus four rays to points around the camera's spot
  clearance(dir, far, r = this.cfg.clearRadius ?? 0.015) {
    let best = far;
    const h = this.world.cast(this.focus, dir, far, this.over);
    if (h) best = h.distance;
    this._side.crossVectors(dir, UP);
    if (this._side.lengthSq() < 1e-6) this._side.set(1, 0, 0);
    this._side.normalize();
    this._up.crossVectors(this._side, dir).normalize();
    for (let i = 0; i < 4; i++) {
      const sx = i & 1 ? r : -r, sy = i & 2 ? r : -r;
      this._end.copy(this.focus).addScaledVector(dir, far).addScaledVector(this._side, sx).addScaledVector(this._up, sy);
      const len = this._ray.subVectors(this._end, this.focus).length();
      this._ray.multiplyScalar(1 / len);
      const s = this.world.cast(this.focus, this._ray, len, this.over);
      if (s) best = Math.min(best, (s.distance / len) * far);
    }
    return Math.max(0, best - 0.008);
  }

  update(dt, mouse, target) {
    const c = this.cfg;
    this.yaw -= mouse.x * c.sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch + mouse.y * c.sensitivity, c.minPitch, c.maxPitch);
    this.distance = THREE.MathUtils.clamp(this.distance * (1 + mouse.wheel * 0.1), c.minDistance, c.maxDistance);

    // Smooth follow on the focus point
    const goal = new THREE.Vector3(target.x, target.y + c.height, target.z);
    this.focus.lerp(goal, 1 - Math.exp(-20 * dt));

    // The tilt that gives a clear view: the player's own if nothing is in the way, else the
    // first tilt up from it that is clear to at least `minClear`, else the clearest one. It looks
    // with a wider margin first (so it starts tilting a few frames before a wall edge swinging
    // into view would block it, instead of popping in when it does), and settles for the tight
    // one where the jelly is hugging a wall and the wide margin never fits
    this.findOver();
    const floor = Math.min(c.minClear ?? 0.3, this.distance);
    const top = Math.max(this.pitch, c.maxAutoPitch ?? 1.5);
    let goalPitch = this.pitch, tight = null, most = -1;
    for (let p = this.pitch; ; p = Math.min(top, p + PITCH_STEP)) {
      this.dirAt(p, this._dir);
      const d = this.clearance(this._dir, this.distance, c.lookAhead ?? 0.06);
      if (d >= floor) { goalPitch = p; tight = null; break; }
      if (tight === null) {
        const h = this.clearance(this._dir, this.distance);
        if (h >= floor) tight = p;
        else if (h > most + 0.01) { most = h; goalPitch = p; }
      }
      if (p >= top) break;
    }
    if (tight !== null) goalPitch = tight;

    // Tilt up quickly, and only ease back down once the view has been clear for a moment
    if (goalPitch > this.viewPitch) { this._holdP = HOLD; this.viewPitch += (goalPitch - this.viewPitch) * (1 - Math.exp(-14 * dt)); }
    else if ((this._holdP -= dt) <= 0) this.viewPitch += (goalPitch - this.viewPitch) * (1 - Math.exp(-4 * dt));

    // At the tilt actually in use: glide in (at most pullSpeed) as a wall comes near, so it
    // doesn't pop; jump in only if the wall would otherwise cover the jelly. Ease back out after
    // a short hold so it doesn't pump in and out
    this.dirAt(this.viewPitch, this._dir);
    const hard = Math.max(c.near * 2, this.clearance(this._dir, this.distance));
    // where it would like to sit: clear by the wide margin, or at least `floor` out if the tight one allows
    const soft = Math.max(Math.min(hard, this.clearance(this._dir, this.distance, c.lookAhead ?? 0.06)), Math.min(hard, floor));
    if (hard < this.currentDistance) { this.currentDistance = hard; this._holdD = HOLD; }
    else if (soft < this.currentDistance) { this.currentDistance = Math.max(soft, this.currentDistance - (c.pullSpeed ?? 2.5) * dt); this._holdD = HOLD; }
    else if ((this._holdD -= dt) <= 0) this.currentDistance += (soft - this.currentDistance) * (1 - Math.exp(-6 * dt));

    this.camera.position.copy(this.focus).addScaledVector(this._dir, this.currentDistance);
    this.camera.lookAt(this.focus);
    this.fade(dt);
  }

  snapTo(target) {
    this.focus.set(target.x, target.y + this.cfg.height, target.z);
    this.viewPitch = this.pitch;
    this._holdD = this._holdP = 0;
  }
}
