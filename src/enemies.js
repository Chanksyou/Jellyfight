// Enemies of The Dry. Placeholder shapes for now; each type is one entry in TYPES.
import * as THREE from 'three';

export const TYPES = {
  // drifts through the air, so high ledges aren't perfectly safe
  mote:  { name: 'Mote', hp: 4, speed: 0.17, dmg: 1, r: 0.007, dew: 1, fly: true },
  // rolls toward you, winds up, then charges
  bunny: { name: 'Dust bunny', hp: 12, speed: 0.2, dmg: 2, r: 0.013, dew: 2, charge: true },
  // slow; sticks to you and slows you down
  lint:  { name: 'Lint puff', hp: 8, speed: 0.13, dmg: 1, r: 0.01, dew: 1, slows: true },
  // shed by The Clog
  hair:  { name: 'Hair tangle', hp: 9, speed: 0.2, dmg: 2, r: 0.01, dew: 1 },
};

const DOWN = new THREE.Vector3(0, -1, 0);

// Angry eyes: white eyeballs with small red-rimmed pupils and thick brows slanted down toward
// the middle. Built in "radius units" (the body is about 1 across) facing +z. The face sits on the
// enemy's root, not its body, so it keeps glaring at you while the fuzz rolls and spins.
const EYE = {
  white: new THREE.MeshStandardMaterial({ color: 0xfffdf6, roughness: 0.25 }),
  iris: new THREE.MeshStandardMaterial({ color: 0xc8231c, roughness: 0.3, emissive: 0x6a0a06, emissiveIntensity: 0.4 }),
  pupil: new THREE.MeshStandardMaterial({ color: 0x0c0a0a, roughness: 0.2 }),
  brow: new THREE.MeshStandardMaterial({ color: 0x1c1512, roughness: 0.8 }),
  ball: new THREE.SphereGeometry(1, 16, 12),
  brow_: new THREE.BoxGeometry(1, 1, 1),
};
export function angryEyes({ y = 0.2, z = 0.78, size = 0.34, gap = 0.36, glow = false } = {}) {
  const face = new THREE.Group();
  const white = glow ? new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xffe28a, emissiveIntensity: 0.8 }) : EYE.white;
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(s * gap, y, z);
    eye.rotation.y = s * 0.25;
    face.add(eye);
    const ball = new THREE.Mesh(EYE.ball, white);
    ball.scale.set(size, size * 0.8, size * 0.55);
    eye.add(ball);
    const iris = new THREE.Mesh(EYE.ball, EYE.iris);
    iris.scale.set(size * 0.5, size * 0.45, size * 0.2);
    iris.position.set(-s * size * 0.12, -size * 0.12, size * 0.44);
    eye.add(iris);
    const pupil = new THREE.Mesh(EYE.ball, EYE.pupil);
    pupil.scale.set(size * 0.24, size * 0.24, size * 0.12);
    pupil.position.set(-s * size * 0.12, -size * 0.12, size * 0.58);
    eye.add(pupil);
    // the brow cuts across the top of the eye, low on the inside: the angry V
    const brow = new THREE.Mesh(EYE.brow_, EYE.brow);
    brow.scale.set(size * 2.3, size * 0.5, size * 0.5);
    brow.position.set(-s * size * 0.1, size * 0.62, size * 0.3);
    brow.rotation.z = s * 0.5;
    eye.add(brow);
  }
  return face;
}

function makeLooks() {
  const fuzz = (hex) => new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).convertSRGBToLinear(), roughness: 1 });
  const lumps = (mat, n, spread) => {
    const g = new THREE.Group();
    const geo = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, mat);
      const a = (i / n) * Math.PI * 2;
      m.position.set(i ? Math.cos(a) * spread : 0, i ? (Math.random() - 0.3) * spread : 0, i ? Math.sin(a) * spread : 0);
      m.scale.setScalar(i ? 0.55 + Math.random() * 0.2 : 0.85);
      m.castShadow = true;
      g.add(m);
    }
    return g;
  };
  // body: the fuzz (may spin and roll); face: where the angry eyes go
  return {
    mote: () => ({ body: lumps(fuzz('#d9d0c0'), 4, 0.45), face: angryEyes({ y: 0.15, z: 0.85, size: 0.4, gap: 0.38 }) }),
    bunny: () => ({ body: lumps(fuzz('#9c958b'), 7, 0.5), face: angryEyes({ y: 0.3, z: 0.95 }) }),
    lint: () => { const g = lumps(fuzz('#8fa3b8'), 5, 0.55); g.scale.y = 0.7; return { body: g, face: angryEyes({ y: 0.12, z: 0.85 }) }; },
    hair: () => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.TorusKnotGeometry(0.6, 0.12, 48, 6, 3, 5), fuzz('#3b2a20'));
      m.castShadow = true;
      g.add(m);
      return { body: g, face: angryEyes({ y: 0.2, z: 0.8 }) };
    },
  };
}

export class Enemies {
  constructor(scene, world, fx) {
    this.scene = scene;
    this.world = world;
    this.fx = fx;
    this.list = [];
    this.looks = makeLooks();
    this.onKill = null;       // (enemy) => void
    this.frame = 0;
    this._o = new THREE.Vector3();
    this._d = new THREE.Vector3();
  }

  get alive() { return this.list.length; }

  spawn(type, pos, hpScale = 1) {
    const T = TYPES[type];
    const { body: mesh, face } = this.looks[type]();
    mesh.scale.multiplyScalar(T.r);
    const root = new THREE.Group();
    root.add(mesh, face);
    root.position.copy(pos);
    this.scene.add(root);
    const e = {
      type, T, root, mesh, face, pos: root.position, r: T.r,
      hp: T.hp * hpScale, maxHp: T.hp * hpScale,
      vel: new THREE.Vector3(), vy: 0, grounded: false,
      state: 'approach', stateT: 0, dashDir: new THREE.Vector3(),
      slowT: 0, pop: 0, spawnT: 0, phase: Math.random() * 10, baseScale: mesh.scale.x,
    };
    mesh.scale.setScalar(0.001); // grows in
    face.scale.setScalar(0.001);
    this.list.push(e);
    return e;
  }

  // Something else (a boss) that tentacles can target. obj needs position, r and damage(amount, color).
  addProxy(obj) {
    const e = { proxy: obj, T: { fly: false }, get pos() { return obj.position; }, get r() { return obj.r; }, dead: false };
    this.list.push(e);
    return e;
  }

  center(e, out = new THREE.Vector3()) {
    return out.copy(e.pos).setY(e.pos.y + (e.T.fly ? 0 : e.r));
  }

  damage(e, amount, color = '#fff') {
    if (e.dead) return false;
    if (e.proxy) {
      e.proxy.damage(amount, color);
      if (e.proxy.dead) e.dead = true;
      return e.dead;
    }
    e.hp -= amount;
    e.pop = 1;
    this.fx.number(this.center(e), Math.round(amount), color, color === '#fff' ? 13 : 17);
    if (e.hp <= 0) { this.kill(e); return true; }
    return false;
  }

  kill(e, silent = false) {
    if (e.dead) return;
    e.dead = true;
    this.fx.puff(this.center(e), 0xe6ded0, e.r * 1.6);
    this.scene.remove(e.root);
    if (!silent) this.onKill?.(e);
  }

  clear() {
    for (const e of this.list) { e.dead = true; if (e.root) this.scene.remove(e.root); }
    this.list = [];
  }

  // player: { position, radius, height }
  update(dt, player, t) {
    this.frame++;
    const pc = this._o.copy(player.position).setY(player.position.y + player.height * 0.5);
    const list = this.list;

    for (const e of list) {
      if (e.dead || e.proxy) continue;
      e.spawnT = Math.min(1, e.spawnT + dt * 4);
      e.slowT = Math.max(0, e.slowT - dt);
      const slow = e.slowT > 0 ? 0.55 : 1;
      const toP = this._d.copy(pc).sub(this.center(e, tmp));
      const dist = toP.length();
      const near = dist < 1.4;

      if (e.T.fly) {
        // drift toward the player's middle with a lazy wobble
        const s = e.T.speed * slow;
        const wob = Math.sin(t * 3 + e.phase) * 0.35;
        toP.normalize();
        e.vel.lerp(new THREE.Vector3(toP.x + wob * toP.z, toP.y + Math.sin(t * 2 + e.phase) * 0.3, toP.z - wob * toP.x).multiplyScalar(s), 1 - Math.exp(-3 * dt));
        e.pos.addScaledVector(e.vel, dt);
      } else {
        toP.y = 0;
        const flat = toP.length();
        toP.normalize();
        let speed = e.T.speed * slow;
        if (e.T.charge) {
          e.stateT -= dt;
          if (e.state === 'approach' && flat < 0.2 && e.grounded) { e.state = 'windup'; e.stateT = 0.45; }
          else if (e.state === 'windup') {
            speed = 0;
            if (e.stateT <= 0) { e.state = 'dash'; e.stateT = 0.45; e.dashDir.copy(toP); }
          } else if (e.state === 'dash') {
            speed = 0.55 * slow;
            toP.copy(e.dashDir);
            if (e.stateT <= 0) { e.state = 'rest'; e.stateT = 0.6; }
          } else if (e.state === 'rest') {
            speed *= 0.3;
            if (e.stateT <= 0) e.state = 'approach';
          }
        }
        const want = toP.multiplyScalar(speed);
        e.vel.x += (want.x - e.vel.x) * (1 - Math.exp(-8 * dt));
        e.vel.z += (want.z - e.vel.z) * (1 - Math.exp(-8 * dt));
        this.moveGround(e, dt, near);
      }

      // look at the player, pop when hit, grow in when spawned
      e.root.rotation.y = Math.atan2(pc.x - e.pos.x, pc.z - e.pos.z);
      e.pop = Math.max(0, e.pop - dt * 6);
      let sc = e.baseScale * e.spawnT * (1 + e.pop * 0.35);
      if (e.state === 'windup') sc *= 1 + Math.sin(t * 60) * 0.08;
      e.mesh.scale.setScalar(sc);
      e.face.scale.setScalar(sc);
      if (e.T.fly) e.mesh.rotation.x += dt * 2;
      else if (e.type === 'bunny' || e.type === 'hair') e.mesh.rotation.x += Math.hypot(e.vel.x, e.vel.z) * dt / e.r;
    }

    // keep them from stacking into one blob
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead || a.proxy) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dead || b.proxy) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const min = (a.r + b.r) * 1.05;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-10 || Math.abs(a.pos.y - b.pos.y) > min) continue;
        const d = Math.sqrt(d2), push = (min - d) * 0.5 / d;
        a.pos.x -= dx * push; a.pos.z -= dz * push;
        b.pos.x += dx * push; b.pos.z += dz * push;
      }
    }

    if (this.frame % 30 === 0) this.list = list.filter((e) => !e.dead);
  }

  moveGround(e, dt, near) {
    const w = this.world;
    const step = new THREE.Vector3(e.vel.x * dt, 0, e.vel.z * dt);
    const len = step.length();
    if (near && len > 1e-6) {
      const dir = step.clone().divideScalar(len);
      const o = new THREE.Vector3(e.pos.x, e.pos.y + e.r, e.pos.z);
      const hit = w.cast(o, dir, e.r + len);
      if (hit) {
        const n = hit.normal; n.y = 0;
        if (n.lengthSq() > 1e-6) {
          n.normalize();
          step.addScaledVector(n, -step.dot(n));
          e.vel.addScaledVector(n, -e.vel.dot(n));
        }
        if (e.state === 'dash') { e.state = 'rest'; e.stateT = 0.6; }
      }
    }
    e.pos.add(step);

    // gravity and ground (every other frame per enemy to save rays)
    if (!near) return;
    e.vy = Math.max(-1, e.vy - 1.0 * dt);
    if ((this.frame + e.phase * 10) % 2 < 1 || !e.grounded) {
      const o = new THREE.Vector3(e.pos.x, e.pos.y + e.r, e.pos.z);
      const hit = w.cast(o, DOWN, e.r + Math.max(0.004, -e.vy * dt * 2));
      if (hit) { e.pos.y = hit.point.y; e.vy = 0; e.grounded = true; return; }
      e.grounded = false;
    }
    if (!e.grounded) e.pos.y += e.vy * dt;
  }
}

const tmp = new THREE.Vector3();
