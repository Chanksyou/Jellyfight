import * as THREE from 'three';

// Orbit camera that follows the player from a fixed angle and distance (look.css --camera-tilt,
// --camera-distance): it never tilts or snaps on its own, because a view that moves under you
// throws your aim off. The walls, floors and ceilings (userData.structural, tagged in the baked
// apartment: tools/exporter.js) are never faded: they seal the rooms, and a faded wall showed the
// night outside. Instead the camera keeps inside them by dollying in along the same view, at once
// when one would be in the way and easing back out once it's clear (clearTo, update). Whatever else
// would block the view fades out: furniture
// over the jelly (the coffee table, the media console) and anything
// between the camera and the jelly (a sofa back, a door), solid again once it's
// clear. Five rays to the camera, not one, so a wall at the frame's edge counts too, and each
// ray looks through a few layers (a shelf, then the cabinet behind it). A faded piece stays faded
// for HOLD s after it's last in the way, so pieces don't flicker in and out as the rays sweep past
// them. Small clutter (a mug, a teapot on a shelf, under SMALL m across) stays solid when a ray
// only grazes it (a shelf of cups fading in and out, or of half-transparent cups drawn over each
// other, looked broken, and a cup that vanishes is still there to bump into): only a cup the
// jelly-to-camera ray itself hits, one that really hides the jelly, goes part way see-through.
const SEE_THROUGH = 0.22;      // how solid a faded piece of furniture or wall looks
const SMALL_SEE = 0.5;         // how solid a small prop looks when it's right in front of the jelly: never gone
const HOLD = 0.4;
const SMALL = 0.15;
const LAYERS = 5;              // how many things one ray may look through
const UP = new THREE.Vector3(0, 1, 0);
const NONE = [];
const _sphere = new THREE.Sphere();
// how big a piece is across, in the world (its geometry's bounding sphere, scaled)
const sizeOf = (m) => {
  const g = m.geometry;
  if (!g) return Infinity;
  if (!g.boundingSphere) g.computeBoundingSphere();
  _sphere.copy(g.boundingSphere).applyMatrix4(m.matrixWorld);
  return _sphere.radius * 2;
};

// A see-through copy of a material. A faded piece is drawn over the room behind it, so every pixel
// of it is lit twice (it, then what's behind): a sofa back filling half a phone screen cost a fifth
// of the frame. So a lit (standard) material fades as a plain diffuse one, which side by side
// looks the same at that faintness at a fraction of the work per lamp, and it's drawn in one pass
// (three.js draws a see-through two-sided piece twice, back faces then front).
const LAMBERT = ['color', 'map', 'lightMap', 'lightMapIntensity', 'aoMap', 'aoMapIntensity', 'emissive', 'emissiveMap', 'emissiveIntensity',
  'bumpMap', 'bumpScale', 'normalMap', 'normalMapType', 'normalScale', 'displacementMap', 'displacementScale', 'displacementBias',
  'alphaMap', 'wireframe', 'flatShading', 'fog'];
const faded = (mat) => {
  let c;
  if (mat.isMeshStandardMaterial) {
    c = THREE.Material.prototype.copy.call(new THREE.MeshLambertMaterial(), mat);
    for (const k of LAMBERT) c[k] = mat[k]?.isColor || mat[k]?.isVector2 ? mat[k].clone() : mat[k];
    c.forceSinglePass = true;   // (only these: any other copy keeps its own shaders, which a boss's warm-up may have built already)
  } else c = mat.clone();
  c.onBeforeCompile = mat.onBeforeCompile;   // clone() leaves it out: the baked corner shadows (baked-ao.js) stay on
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
    this.currentDistance = cfg.distance;   // the distance it's at now (this.distance, unless a fight view is easing in)
    // A boss's fight view ({ distance, pitch, ahead }: the shark's, look.css): while it's set the
    // view eases to it, and back to the player's own once it's cleared (run.js sets it for the
    // fight). `ahead`: it aims that far ahead of the jelly instead of at it, so what's in front (a
    // boss standing taller than you) is in frame with the jelly low in it
    this.fight = null;
    this.fightK = 0;           // 0: the player's view .. 1: the fight's
    this._fightView = null;    // the last fight view, to ease back out of
    this.focus = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._side = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._ray = new THREE.Vector3();
    this._end = new THREE.Vector3();
    this.over = new Set();     // what the rays found: over the jelly, or between it and the jelly
    this.solid = new Set();    // ...of which these stay solid: small props only grazed by a ray, and their instanced parts
    this.partly = new Set();   // ...and these small props fade part way: the jelly-to-camera ray hits them
    this._jelly = new THREE.Vector3();   // where the jelly is now (the focus follows a little behind it)
    this.keep = new Map();     // mesh -> how solid: kept faint whether in the way or not (a boss fight's seeThrough: the Clog's curtain and door)
    this._fades = new Map();   // mesh -> { mats: its own material(s), see: the fading copies, k: opacity }
    // true while the jelly rides a vent (systems.js): nothing new starts fading, what's faded stays
    // faded while it's in the way. The ride sweeps the jelly up through a whole cabinet in a second,
    // and on a phone the 20 to 30 see-through copies that started at once dropped frames
    this.holdFades = false;
    this.pull = 0;             // m the clearance has dollied the camera in by (0: the view as asked for)
    this._hold = 0;            // s left before the camera starts easing back out
    this._rayEnd = new THREE.Vector3();
  }

  // How far out along dir (unit, from the focus) the lens can sit with a wall, floor or ceiling in the
  // way: `want`, or less. Five rays, the lens' centre and four points round it, reach past the lens
  // by the approach band: the dolly eases in over that band (so it is under way when the lens gets to
  // the wall) and is cut off at the wall less the margin (near plane and shake). Never closer than clearMin.
  clearTo(dir, want) {
    const c = this.cfg, m = c.clearMargin;
    if (!m) return want;
    this._side.crossVectors(dir, UP);
    if (this._side.lengthSq() < 1e-6) this._side.set(1, 0, 0);
    this._side.normalize();
    this._up.crossVectors(this._side, dir).normalize();
    const reach = want + c.clearBand + m;
    let room = Infinity;
    for (let i = 0; i < 5; i++) {
      const end = this._rayEnd.copy(this.focus).addScaledVector(dir, reach);
      if (i) end.addScaledVector(this._side, i & 1 ? m : -m).addScaledVector(this._up, i & 2 ? m : -m);
      const len = this._ray.subVectors(end, this.focus).length();
      this._ray.multiplyScalar(1 / len);
      const h = this.world.cast(this.focus, this._ray, len, null, true);
      if (h) room = Math.min(room, h.distance * this._ray.dot(dir));
    }
    if (room === Infinity) return want;
    const spare = room - m - want, k = THREE.MathUtils.clamp(spare / c.clearBand, 0, 1);
    const eased = want - c.clearEase * (1 - k * k * (3 - 2 * k));
    return Math.max(Math.min(eased, room - m), Math.min(want, c.clearMin));
  }

  // What's right over the jelly, and what's between it and the camera: up to LAYERS things along
  // the ray from the jelly to the camera, along the ray straight up and along four more to the
  // camera's corners. The jelly-to-camera ray goes first and starts at the jelly itself (the focus
  // lags it in a jump), so what it hits is a direct blocker whatever the other rays skip after
  findOver(camPos) {
    this.over.clear(); this.solid.clear(); this.partly.clear();
    if (this.cfg.seeThrough === false) return;
    const dir = this._dir.subVectors(camPos, this._jelly), far = dir.length();
    if (far < 1e-6) return;
    dir.multiplyScalar(1 / far);
    const r = this.cfg.clearRadius ?? 0.015;
    this.look(this._jelly, dir, far + r, true);
    this.look(this.focus, UP, this.currentDistance);
    this._side.crossVectors(dir, UP);
    if (this._side.lengthSq() < 1e-6) this._side.set(1, 0, 0);
    this._side.normalize();
    this._up.crossVectors(this._side, dir).normalize();
    for (let i = 0; i < 4; i++) {
      this._end.copy(camPos).addScaledVector(this._side, i & 1 ? r : -r).addScaledVector(this._up, i & 2 ? r : -r);
      const len = this._ray.subVectors(this._end, this.focus).length();
      this.look(this.focus, this._ray.multiplyScalar(1 / len), len + r);
    }
  }

  // `direct`: the jelly-to-camera ray, the only one that says a small prop really hides the jelly.
  // (It goes first, so the other rays skip what it found: that's why it's told apart here.)
  look(from, dir, far, direct = false) {
    for (let i = 0; i < LAYERS; i++) {
      const h = this.world.cast(from, dir, far, this.over);
      if (!h?.mesh) return;
      const m = h.mesh, small = sizeOf(m) < SMALL;
      this.over.add(m);
      if (small) (direct ? this.partly : this.solid).add(m);
      // and the instanced parts of the same piece (a sideboard's flutes): nothing collides with
      // instanced meshes, so no ray finds them. They fade like the piece they're part of
      const kin = m.parent && !m.parent.isScene ? m.parent.children : NONE;   // not the scene's: the bugs are instanced
      for (let k = 0; k < kin.length; k++) {
        if (!kin[k].isInstancedMesh || !kin[k].visible) continue;
        this.over.add(kin[k]);
        if (small) (direct ? this.partly : this.solid).add(kin[k]);
      }
    }
  }

  // Fade what's in the way out, and back in (on its own material again) once it's clear
  fade(dt) {
    if (!this.holdFades) for (const m of this.over) if (!this.solid.has(m)) this.startFade(m);
    for (const m of this.keep.keys()) this.startFade(m);
    for (const [m, f] of this._fades) {
      if ((this.over.has(m) && !this.solid.has(m)) || this.keep.has(m)) f.hold = HOLD; else f.hold -= dt;
      const goal = f.hold > 0 ? this.keep.get(m) ?? f.low : 1;
      f.k += (goal - f.k) * (1 - Math.exp(-10 * dt));
      if (goal === 1 && f.k > 0.98) { this.unfade(m, f); continue; }
      for (const s of [].concat(f.see)) s.opacity = s.userData.solid * f.k;
    }
  }

  startFade(m) {
    if (m.userData.structural || (m.userData.noCameraFade && !this.keep.has(m)) || this._fades.has(m)) return;
    const mats = m.material, see = Array.isArray(mats) ? mats.map(faded) : faded(mats);
    this._fades.set(m, { mats, see, k: 1, hold: 0, low: this.partly.has(m) ? SMALL_SEE : SEE_THROUGH });
    m.material = see;
    // High's N8AO draws every see-through thing again to keep its shading off them; a faded piece
    // is mostly the room behind it, so that room's shading may show through it, and it's drawn once
    m.userData.treatAsOpaque = true;
  }

  // the piece on its own material again; the clones are this fade's alone: free them, or every fade leaks materials
  unfade(m, f) {
    m.material = f.mats;
    delete m.userData.treatAsOpaque;
    for (const c of [].concat(f.see)) c.dispose();
    this._fades.delete(m);
  }

  // Everything faded back on its own material at once (the layout editor opening)
  unfadeAll() { for (const [m, f] of this._fades) this.unfade(m, f); }

  // Keep these meshes faint (opacity: how solid) until dropKeep: they fade like anything in the way
  keepFaint(meshes, opacity) { for (const m of meshes) this.keep.set(m, opacity); }

  // Kept pieces solid again at once (a new run), on their own materials
  dropKeep() {
    for (const m of this.keep.keys()) {
      const f = this._fades.get(m);
      if (f) this.unfade(m, f);
    }
    this.keep.clear();
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
    if (this.fight) this._fightView = this.fight;
    this.fightK += ((this.fight ? 1 : 0) - this.fightK) * (1 - Math.exp(-2.5 * dt));
    if (!this.fight && this.fightK < 1e-3) this.fightK = 0;
    const F = this._fightView, k = F ? this.fightK : 0;
    this.viewPitch = k ? this.pitch + (F.pitch - this.pitch) * k : this.pitch;
    this.currentDistance = k ? this.distance + (F.distance - this.distance) * k : this.distance;

    // Smooth follow on the focus point
    this._jelly.set(target.x, target.y + c.height, target.z);
    this.focus.lerp(this._jelly, 1 - Math.exp(-20 * dt));

    this.dirAt(this.viewPitch, this._dir);
    // Clearance: in at once where a wall would be in the way, back out after a pause (the view's
    // yaw and tilt are never touched: only how far along them the camera sits)
    const need = this.currentDistance - this.clearTo(this._dir, this.currentDistance);
    if (need >= this.pull) { this.pull = need; this._hold = c.clearHold; }
    else if ((this._hold -= dt) <= 0) this.pull = need + (this.pull - need) * Math.exp(-c.clearRecover * dt);
    const dist = Math.max(this.currentDistance - this.pull, Math.min(this.currentDistance, c.clearMin));
    this.camera.position.copy(this.focus).addScaledVector(this._dir, dist);
    const ahead = k ? (F.ahead || 0) * k : 0;
    if (ahead) this.camera.lookAt(this._ray.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).multiplyScalar(ahead).add(this.focus));
    else this.camera.lookAt(this.focus);
    this.findOver(this.camera.position);
    this.fade(dt);
  }

  // A see-through copy of everything solid (anything can end up between the camera and the
  // jelly), one per material, standing where the original is, so main.js can build their shaders
  // behind the Play button: building one the first time the camera sees through it stalled a
  // phone for a frame or more. `within`: only colliders inside this box (a newly loaded act's rooms);
  // `also`: pieces the fight keeps faint, including fixtures that normally never fade
  seeThroughWarmers(within = null, also = []) {
    const found = new Map(), box = new THREE.Box3(), kept = new Set(also);
    for (const m of [...this.world.colliders, ...also]) {
      if (!m.isMesh || m.userData.structural || (m.userData.noCameraFade && !kept.has(m))) continue;
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
    this._jelly.copy(this.focus);
    this.pull = 0;   // somewhere new: clearance starts over
  }

  // Back to the player's own view at once (a new run)
  endFight() { this.fight = null; this.fightK = 0; this.pull = 0; this.dropKeep(); }
}
