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

function makeLooks() {
  const fuzz = (hex) => new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).convertSRGBToLinear(), roughness: 1 });
  const eye = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
  const eyeGeo = new THREE.SphereGeometry(0.16, 8, 6);
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
  const withEyes = (g, y = 0.25, z = 0.8) => {
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(eyeGeo, eye);
      e.position.set(s * 0.28, y, z);
      g.add(e);
    }
    return g;
  };
  return {
    mote: () => lumps(fuzz('#d9d0c0'), 4, 0.45),
    bunny: () => withEyes(lumps(fuzz('#9c958b'), 7, 0.5)),
    lint: () => { const g = withEyes(lumps(fuzz('#8fa3b8'), 5, 0.55), 0.15, 0.75); g.scale.y = 0.7; return g; },
    hair: () => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.TorusKnotGeometry(0.6, 0.12, 48, 6, 3, 5), fuzz('#3b2a20'));
      m.castShadow = true;
      g.add(m);
      return withEyes(g, 0.2, 0.75);
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
    const mesh = this.looks[type]();
    mesh.scale.multiplyScalar(T.r);
    const root = new THREE.Group();
    root.add(mesh);
    root.position.copy(pos);
    this.scene.add(root);
    const e = {
      type, T, root, mesh, pos: root.position, r: T.r,
      hp: T.hp * hpScale, maxHp: T.hp * hpScale,
      vel: new THREE.Vector3(), vy: 0, grounded: false,
      state: 'approach', stateT: 0, dashDir: new THREE.Vector3(),
      slowT: 0, pop: 0, spawnT: 0, phase: Math.random() * 10, baseScale: mesh.scale.x,
    };
    mesh.scale.setScalar(0.001); // grows in
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
