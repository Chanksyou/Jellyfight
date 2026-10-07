import * as THREE from 'three';
import { strokeRate } from './swim.js';

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

// position = the player's feet. The mesh is built so its origin is at the feet too.
export class Player {
  constructor(world, cfg) {
    this.world = world;
    this.cfg = cfg;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.grounded = false;
    this.facing = 0;
    this.time = 0;

    this.mesh = new THREE.Group();
    this.mesh.name = 'Player';
    this.avatar = null;
    this.peakY = 0;          // highest point since leaving the ground
    this.onLand = null;      // (dropMeters) => void
    this.climbing = false;
    this.flight = null;      // a vent launch in progress (scripted arc, see launch())
    this.airJumps = 0;       // mid-air jumps left
    this.swim = 0;           // bell pulse phase, 0..1; each pulse gives a little surge forward
    this.speed = 0;

    // Ray origins for horizontal collision: just above step height, middle, near top
    this.probeHeights = [cfg.stepHeight + 0.002, cfg.height * 0.5, cfg.height * 0.9];
    // Ground probes: center plus 4 points around the footprint so we don't slip into gaps
    const r = cfg.radius * 0.7;
    this.groundOffsets = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]];
    this.pushDirs = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    });

    this._o = new THREE.Vector3();
    this._d = new THREE.Vector3();
  }

  // Swap the model (see character.js for the avatar interface)
  setAvatar(avatar) {
    if (this.avatar) {
      this.mesh.remove(this.avatar.root);
      this.avatar.dispose();
    }
    this.avatar = avatar;
    this.mesh.add(avatar.root);
  }

  // Put the feet on whatever is below (used right after spawning)
  snapToGround(maxDrop = 1) {
    this._o.set(this.position.x, this.position.y + this.cfg.height * 0.5, this.position.z);
    const hit = this.world.cast(this._o, DOWN, this.cfg.height * 0.5 + maxDrop);
    if (!hit) return;
    this.position.y = hit.point.y;
    this.peakY = hit.point.y;
    this.grounded = true;
    this.syncMesh();
  }

  spawn(p) {
    this.position.copy(p);
    this.velocity.set(0, 0, 0);
    this.flight = null;
    this.avatar?.tentacles?.reset();     // tentacles start on their pose, not dragged from the old spot
    this.peakY = p.y;
    this.grounded = false;
    this.syncMesh();
  }

  // Ride the air from a vent to `to` (a surface point). The arc is scripted, not simulated,
  // so it always lands: straight up first, then over and down onto the surface.
  launch(to) {
    const from = this.position.clone();
    to = new THREE.Vector3(...to);
    const apex = Math.max(from.y, to.y) + 0.06;
    const T = 0.8 + (apex - from.y) * 0.35 + Math.hypot(to.x - from.x, to.z - from.z) * 0.8;
    this.flight = { from, to, apex, T, t: 0 };
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this.avatar?.pulse?.();
  }

  updateFlight(dt) {
    const f = this.flight;
    f.t += dt;
    const u = Math.min(1, f.t / f.T);
    const rise = 0.55;
    const sm = (a, b, x) => { const k = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
    const xz = sm(0.5, 1, u);                                    // move over only once clear of the edge
    const y = u < rise
      ? f.from.y + (f.apex - f.from.y) * (1 - (1 - u / rise) ** 2)
      : f.apex + (f.to.y - f.apex) * ((u - rise) / (1 - rise)) ** 2;
    const prev = this.position.clone();
    this.position.set(f.from.x + (f.to.x - f.from.x) * xz, y, f.from.z + (f.to.z - f.from.z) * xz);
    this.velocity.copy(this.position).sub(prev).divideScalar(Math.max(dt, 1e-4));
    if (u >= 1) {
      this.flight = null;
      this.velocity.set(0, 0, 0);
      this.snapToGround(0.05);
      this.airJumps = this.maxAirJumps ?? 0;
      this.avatar?.land(0.6);
      this.onLand?.(0);
    }
  }

  // env (all optional): speedMul, jumpMul, airJumps (mid-air jumps), vent (a vent underfoot),
  // climb (inside climbable fabric), push (THREE.Vector3 m/s added to movement, e.g. a drain's
  // pull), slow (0..1 speed penalty)
  update(dt, input, cameraYaw, env = {}) {
    const c = this.cfg;
    this.time += dt;
    this.maxAirJumps = env.airJumps ?? 0;

    if (!this.flight && env.vent) this.launch(env.vent.land);
    if (this.flight) {
      input.consumeJump();
      this.updateFlight(dt);
      this.swim = (this.swim + dt * 1.6) % 1;
      this.syncMesh();
      this.avatar?.update(dt, { speed: 0.1, walkSpeed: c.walkSpeed, grounded: false, vy: this.velocity.y, swim: this.swim, vel: this.velocity });
      return;
    }

    // --- Desired horizontal velocity, relative to the camera --------------
    const axes = input.moveAxes();
    const fwd = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    const wish = fwd.multiplyScalar(axes.y).add(right.multiplyScalar(axes.x));
    if (wish.lengthSq() > 1) wish.normalize();
    // Swimming: each stroke of the bell (swim.js) is a surge and then a glide, and the avatar
    // squeezes its bell in time with it. Strokes come faster the harder you push and the higher
    // your move speed. Averages out to walk speed.
    const push = Math.min(1, wish.length());
    const before = this.swim;
    this.swim = (this.swim + dt * strokeRate(push, env.speedMul ?? 1)) % 1;
    if (this.swim < before && push > 0.3) this.onStroke?.();
    const walk = c.walkSpeed * (env.speedMul ?? 1) * (1 - (env.slow ?? 0));   // steady: the bell still pulses, the speed doesn't
    wish.multiplyScalar(walk);

    // slipping (soap underfoot): almost no grip, so you keep sliding the way you were going
    const accel = this.grounded ? c.groundAccel * (1 - 0.88 * (env.slip ?? 0)) : c.airAccel;
    const t = 1 - Math.exp(-accel * dt);
    this.velocity.x += (wish.x - this.velocity.x) * t;
    this.velocity.z += (wish.z - this.velocity.z) * t;

    // --- Jump, climbing, updrafts, gravity --------------------------------
    // Jump from the ground, or pulse the bell for a mid-air jump (only with Pen Spring: one per copy)
    if (this.grounded) { this.airJumps = this.maxAirJumps; this.coyote = 0.1; }
    else this.coyote = Math.max(0, (this.coyote ?? 0) - dt);
    if (input.consumeJump()) {
      const v = Math.sqrt(2 * c.gravity * c.jumpHeight * (env.jumpMul ?? 1));
      if (this.grounded || this.coyote > 0) {
        this.velocity.y = v;
        this.coyote = 0;
        this.avatar?.pulse?.();
      } else if (this.airJumps > 0 && !env.climb) {
        this.airJumps--;
        this.velocity.y = Math.max(this.velocity.y, v * c.airJumpMul);
        this.swim = 0;                                   // a big squeeze of the bell
        this.avatar?.pulse?.();
      }
      this.grounded = false;
    }
    this.climbing = !!env.climb && input.jumpHeld;
    if (this.climbing) {
      this.velocity.y = c.climbSpeed;
      this.airJumps = this.maxAirJumps;
    } else {
      this.velocity.y = Math.max(-c.maxFall, this.velocity.y - c.gravity * dt);
    }

    // --- Move -------------------------------------------------------------
    const px = env.push ? env.push.x : 0, pz = env.push ? env.push.z : 0;
    this.moveHorizontal((this.velocity.x + px) * dt, (this.velocity.z + pz) * dt);
    this.depenetrate();
    const wasGrounded = this.grounded;
    const vyBefore = this.velocity.y;
    this.moveVertical(dt, this.climbing);
    if (!this.grounded) this.peakY = wasGrounded ? this.position.y : Math.max(this.peakY, this.position.y);
    else if (!wasGrounded) {
      this.avatar?.land(-vyBefore);
      this.onLand?.(this.peakY - this.position.y);
    }

    // --- Face movement direction -----------------------------------------
    const hv = Math.hypot(this.velocity.x, this.velocity.z);
    this.speed = hv;
    if (hv > 0.02) {
      const target = Math.atan2(this.velocity.x, this.velocity.z);
      let diff = target - this.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.facing += diff * (1 - Math.exp(-c.turnSpeed * dt));
    }

    this.syncMesh();
    this.avatar?.update(dt, { speed: hv, walkSpeed: c.walkSpeed, grounded: this.grounded || this.climbing, vy: this.climbing ? 0 : this.velocity.y, swim: this.swim, vel: this.velocity, push });
  }

  moveHorizontal(dx, dz) {
    const len = Math.hypot(dx, dz);
    if (len < 1e-8) return;
    // Sub-step so we never move more than half a radius per step (no tunneling)
    const steps = Math.max(1, Math.ceil(len / (this.cfg.radius * 0.5)));
    const step = new THREE.Vector3(dx / steps, 0, dz / steps);
    for (let i = 0; i < steps; i++) this.tryMove(step.clone());
  }

  // Move by v, sliding along whatever we hit.
  tryMove(v) {
    const r = this.cfg.radius;
    for (let iter = 0; iter < 3; iter++) {
      const len = v.length();
      if (len < 1e-8) return;
      const dir = this._d.copy(v).divideScalar(len);

      let nearest = null;
      for (const h of this.probeHeights) {
        this._o.set(this.position.x, this.position.y + h, this.position.z);
        const hit = this.world.cast(this._o, dir, r + len);
        if (hit && (!nearest || hit.distance < nearest.distance)) nearest = hit;
      }

      if (!nearest) { this.position.add(v); return; }

      const allowed = Math.max(0, nearest.distance - r);
      this.position.addScaledVector(dir, allowed);

      const n = nearest.normal;
      n.y = 0;
      if (n.lengthSq() < 1e-8) return;
      n.normalize();
      v.multiplyScalar(1 - allowed / len);
      v.addScaledVector(n, -v.dot(n));
    }
  }

  // Push out of walls we've ended up too close to (corners, diagonal slides).
  depenetrate() {
    const r = this.cfg.radius;
    this._o.set(this.position.x, this.position.y + this.cfg.height * 0.5, this.position.z);
    for (const d of this.pushDirs) {
      const hit = this.world.cast(this._o, d, r);
      if (hit) this.position.addScaledVector(d, -(r - hit.distance));
    }
  }

  moveVertical(dt, ignoreCeiling = false) {
    const c = this.cfg;
    const vy = this.velocity.y;
    const half = c.height * 0.5;

    if (vy > 0 && ignoreCeiling) {       // climbing: you're gripping fabric, not bumping into it
      this.position.y += vy * dt;
      this.grounded = false;
      return;
    }
    if (vy > 0) {
      // Ceiling check
      this._o.set(this.position.x, this.position.y + half, this.position.z);
      const hit = this.world.cast(this._o, UP, half + vy * dt);
      if (hit) {
        this.position.y += Math.max(0, hit.distance - half);
        this.velocity.y = 0;
      } else {
        this.position.y += vy * dt;
      }
      this.grounded = false;
      return;
    }

    // Falling or standing: find the highest ground under our footprint
    const snap = this.grounded ? c.stepHeight : 0;
    const far = half + Math.max(0, -vy * dt) + snap;
    let groundY = -Infinity;
    for (const [ox, oz] of this.groundOffsets) {
      this._o.set(this.position.x + ox, this.position.y + half, this.position.z + oz);
      const hit = this.world.cast(this._o, DOWN, far);
      if (hit) groundY = Math.max(groundY, this._o.y - hit.distance);
    }

    if (groundY > -Infinity) {
      this.position.y = groundY;
      this.velocity.y = 0;
      this.grounded = true;
    } else {
      this.position.y += vy * dt;
      this.grounded = false;
    }
  }

  syncMesh() {
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.facing;
  }
}
