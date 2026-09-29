// Enemies. The bugs of the living room (critters.js) are the waves: cockroaches, ant squads
// that curl into a ball and roll at you, and mosquitoes that hover out of reach and spit. The
// dust types (motes, bunnies, lint, hair) belong to the bathroom stage and the bosses.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildRoach, buildAnts, buildMosquito } from './critters.js';

export const TYPES = {
  // scuttles straight at you; the basic enemy
  roach:    { name: 'Cockroach', hp: 16, speed: 0.24, dmg: 1, r: 0.016, dew: 4 },
  // five ants in a block; up close they curl into a ball and roll into you
  ants:     { name: 'Ant squad', hp: 36, speed: 0.15, dmg: 1, rollDmg: 3, r: 0.024, dew: 8, charge: true, windup: 0.6, dashTime: 0.7, dashSpeed: 0.5, rest: 0.8 },
  // hovers out of reach and spits at you
  mosquito: { name: 'Mosquito', hp: 12, speed: 0.22, dmg: 1, r: 0.02, dew: 5, fly: true, shoots: true },
  // drifts through the air, so high ledges aren't perfectly safe
  mote:  { name: 'Mote', hp: 6, speed: 0.17, dmg: 1, r: 0.01, dew: 3, fly: true },
  // rolls toward you, winds up, then charges
  bunny: { name: 'Dust bunny', hp: 20, speed: 0.2, dmg: 2, r: 0.02, dew: 6, charge: true },
  // slow; sticks to you and slows you down
  lint:  { name: 'Lint puff', hp: 14, speed: 0.13, dmg: 1, r: 0.016, dew: 4, slows: true },
  // shed by The Clog
  hair:  { name: 'Hair tangle', hp: 12, speed: 0.2, dmg: 2, r: 0.015, dew: 3 },
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
  glow: new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xffc23a, emissiveIntensity: 1.2 }),
  halo: new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffb020, emissiveIntensity: 1.6, roughness: 0.3 }),
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

// --- Fuzz: every enemy is built from a lumpy core, hundreds of fine fibers and a few bits
// caught in it (a thread, a crumb). Built once per type and merged into one mesh.
function rng(seed) { let x = seed >>> 0; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296); }
function paint(geo, color) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  geo.deleteAttribute('uv');
  const n = geo.attributes.position.count, c = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { c[k * 3] = color.r; c[k * 3 + 1] = color.g; c[k * 3 + 2] = color.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
// A bumpy ball whose shading varies with the bumps
function core(r, bump, dark, light, seed) {
  const g = new THREE.IcosahedronGeometry(r, 3), p = g.attributes.position, v = new THREE.Vector3();
  const n = (x, y, z) => Math.sin(x * 7.1 + seed) * Math.sin(y * 6.3 + seed * 2) * Math.sin(z * 8.7 + seed * 3) + 0.5 * Math.sin(x * 17 + y * 13 + z * 11 + seed);
  const c = new Float32Array(p.count * 3), a = new THREE.Color(dark), b = new THREE.Color(light), t = new THREE.Color();
  for (let k = 0; k < p.count; k++) {
    v.fromBufferAttribute(p, k).normalize();
    const h = n(v.x, v.y, v.z);
    p.setXYZ(k, v.x * r * (1 + bump * h), v.y * r * (1 + bump * h), v.z * r * (1 + bump * h));
    t.copy(a).lerp(b, THREE.MathUtils.clamp(0.5 + h * 0.6, 0, 1));
    c[k * 3] = t.r; c[k * 3 + 1] = t.g; c[k * 3 + 2] = t.b;
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
// Fine fibers sticking out of a ball of radius r. lie: 0 = straight out, 1 = lying flat on it.
function fibers(count, r, len, thick, colors, rand, lie = 0.3) {
  const out = [], up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3(), tan = new THREE.Vector3(), q = new THREE.Quaternion();
  for (let k = 0; k < count; k++) {
    d.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
    tan.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).cross(d).normalize();
    const dir = d.clone().lerp(tan, lie * (0.5 + rand() * 0.5)).normalize();
    const L = len * (0.5 + rand() * 0.7);
    const g = new THREE.CylinderGeometry(thick * 0.25, thick, L, 3, 1).translate(0, L / 2, 0);
    g.applyQuaternion(q.setFromUnitVectors(up, dir));
    g.translate(d.x * r * 0.9, d.y * r * 0.9, d.z * r * 0.9);
    out.push(paint(g, new THREE.Color(colors[(rand() * colors.length) | 0]).offsetHSL(0, 0, (rand() - 0.5) * 0.08)));
  }
  return out;
}
// A thread or hair: a thin tube along a wandering curve
function strand(points, thick, color, segs = 40) {
  return paint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segs, thick, 4), new THREE.Color(color));
}
function curl(rand, r, turns, spread) {
  const pts = [], a0 = rand() * 6.3, tilt = rand() * 3.1;
  for (let k = 0; k <= 24; k++) {
    const t = k / 24, a = a0 + t * turns * Math.PI * 2, rr = r * (0.7 + 0.5 * Math.sin(t * 5 + a0));
    const p = new THREE.Vector3(Math.cos(a) * rr, (t - 0.5) * spread, Math.sin(a) * rr);
    pts.push(p.applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt));
  }
  return pts;
}

const GEO = {};
// The shared fuzz geometry for an enemy type (the Dust King borrows the dust bunny's)
export function fuzzGeometry(type) { return (GEO[type] ||= buildGeometry(type)); }
function buildGeometry(type) {
  const rand = rng({ mote: 11, bunny: 23, lint: 37, hair: 51 }[type]);
  const parts = [];
  if (type === 'mote') {          // a pale wisp of dust
    parts.push(core(0.5, 0.25, '#b9ae9c', '#efe8da', 1));
    parts.push(...fibers(70, 0.5, 0.75, 0.035, ['#e9e1d2', '#d4cab8', '#fff8ea'], rand, 0.2));
  } else if (type === 'bunny') {  // a grey dust bunny with a red thread and a crumb caught in it
    parts.push(core(0.72, 0.3, '#6e6760', '#aaa399', 2));
    parts.push(...fibers(260, 0.72, 0.7, 0.04, ['#8f887e', '#a59e94', '#7a746c', '#bdb6ab'], rand, 0.35));
    parts.push(strand(curl(rand, 0.75, 1.3, 0.5), 0.025, '#c0392b'));
    parts.push(paint(new THREE.DodecahedronGeometry(0.14, 0).translate(0.45, 0.45, 0.35), new THREE.Color('#b08858')));
  } else if (type === 'lint') {   // a flat, pilled puff of dryer lint with a thread loop
    const c = core(0.8, 0.18, '#6f8296', '#a9b8c8', 3);
    c.scale(1, 0.55, 1);
    parts.push(c);
    for (let k = 0; k < 14; k++) {
      const a = rand() * 6.3, y = (rand() - 0.3) * 0.35;
      parts.push(paint(new THREE.IcosahedronGeometry(0.1 + rand() * 0.06, 1).translate(Math.cos(a) * 0.72, y, Math.sin(a) * 0.72), new THREE.Color('#c6d0dc').offsetHSL(0, 0, (rand() - 0.5) * 0.1)));
    }
    const f = fibers(160, 0.8, 0.55, 0.035, ['#8a9bb0', '#b4c2d2', '#76889c'], rand, 0.75);
    f.forEach((g) => g.scale(1, 0.6, 1));
    parts.push(...f);
    parts.push(strand(curl(rand, 0.6, 0.8, 0.2).map((p) => p.add(new THREE.Vector3(0.5, 0.15, 0))), 0.03, '#e7b73a'));
  } else {                        // hair: curly strands wrapped round a small clump
    parts.push(core(0.4, 0.3, '#2a1c14', '#4a3222', 4));
    for (let k = 0; k < 9; k++) parts.push(strand(curl(rand, 0.55 + rand() * 0.3, 1.5 + rand(), 0.8), 0.022, k < 7 ? (k % 2 ? '#3b2618' : '#5a3a24') : '#9a948e', 60));
    parts.push(...fibers(40, 0.4, 0.5, 0.03, ['#3b2618', '#5a3a24'], rand, 0.5));
  }
  const g = mergeGeometries(parts);
  g.computeBoundingSphere();
  return g;
}

function makeLooks() {
  const fuzz = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const glowFuzz = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: 0x3a3426, emissiveIntensity: 1 });
  const hairMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 });
  const body = (type, mat) => {
    const m = new THREE.Mesh(fuzzGeometry(type), mat);
    m.castShadow = true;
    const g = new THREE.Group();
    g.add(m);
    return g;
  };
  // body: the fuzz (may spin and roll); face: where the angry eyes go
  return {
    mote: () => ({ body: body('mote', glowFuzz), face: angryEyes({ y: 0.15, z: 0.75, size: 0.4, gap: 0.38 }) }),
    bunny: () => ({ body: body('bunny', fuzz), face: angryEyes({ y: 0.3, z: 0.95 }) }),
    lint: () => ({ body: body('lint', fuzz), face: angryEyes({ y: 0.12, z: 0.85 }) }),
    hair: () => ({ body: body('hair', hairMat), face: angryEyes({ y: 0.2, z: 0.75 }) }),
    roach: buildRoach,
    ants: buildAnts,
    mosquito: buildMosquito,
    fuzz, glowFuzz, hairMat,
  };
}

export class Enemies {
  constructor(scene, world, fx) {
    this.scene = scene;
    this.world = world;
    this.fx = fx;
    this.list = [];
    this.looks = makeLooks();
    this.eliteMats = {};
    this.haloGeo = new THREE.TorusGeometry(0.7, 0.08, 6, 24);
    this.onKill = null;       // (enemy) => void
    this.shots = [];          // mosquito spit
    this.shotGeo = new THREE.SphereGeometry(0.004, 10, 8);
    this.shotMat = new THREE.MeshStandardMaterial({ color: 0xc8202a, emissive: 0x8a0a10, emissiveIntensity: 1.2, roughness: 0.2 });
    this.frame = 0;
    this._o = new THREE.Vector3();
    this._d = new THREE.Vector3();
  }

  get alive() { return this.list.length; }

  // elite: 35% bigger, 2.2x health, 4x dew, gold, with a spinning halo and glowing eyes
  spawn(type, pos, hpScale = 1, elite = false) {
    let T = TYPES[type];
    const { body: mesh, face, anim } = this.looks[type]();
    const root = new THREE.Group();
    if (elite && !anim) {
      T = { ...T, dew: T.dew * 4, r: T.r * 1.35, dmg: T.dmg + 1 };
      hpScale *= 2.2;
      const m = mesh.children[0];
      this.eliteMats[type] ||= Object.assign(m.material.clone(), { emissive: new THREE.Color(0xffb020), emissiveIntensity: 0.35 });
      m.material = this.eliteMats[type];
      face.traverse((o) => { if (o.isMesh && o.material === EYE.white) o.material = EYE.glow; });
      const halo = new THREE.Mesh(this.haloGeo, EYE.halo);
      halo.name = 'halo';
      halo.rotation.x = Math.PI / 2;
      halo.position.y = T.r * 1.35;
      halo.scale.setScalar(T.r);
      root.add(halo);
    }
    mesh.scale.multiplyScalar(T.r);
    root.add(mesh, face);
    root.position.copy(pos);
    this.scene.add(root);
    const e = {
      type, T, root, mesh, face, anim, elite, pos: root.position, r: T.r, shootT: 1 + Math.random() * 1.5, aimT: 0,
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

  // Sticky Note mark: a little yellow note above the enemy while it lasts; Ice Cube frost: a
  // pale blue tint on the eyes' whites is enough to read "frozen"
  markLook(e, dt) {
    e.markT = Math.max(0, (e.markT || 0) - dt);
    if (e.markT > 0 && !e.note) {
      this.noteGeo ||= new THREE.PlaneGeometry(1, 1);
      this.noteMat ||= new THREE.MeshStandardMaterial({ color: 0xffe45a, emissive: 0x6a5a00, side: THREE.DoubleSide, roughness: 0.8 });
      e.note = new THREE.Mesh(this.noteGeo, this.noteMat);
      e.note.scale.setScalar(e.r * 0.9);
      e.note.position.y = e.r * 2.3;
      e.note.rotation.z = 0.2;
      e.root.add(e.note);
    }
    if (e.note) e.note.visible = e.markT > 0;
    if (e.freezeT > 0 && !e.frost) {
      this.frostMat ||= new THREE.MeshStandardMaterial({ color: 0xcff6ff, emissive: 0x3a8aa8, emissiveIntensity: 0.6, transparent: true, opacity: 0.45, roughness: 0.1 });
      e.frost = new THREE.Mesh(new THREE.IcosahedronGeometry(e.r * 1.25, 1), this.frostMat);
      e.frost.position.y = e.T.fly ? 0 : e.r;
      e.root.add(e.frost);
    }
    if (e.frost) e.frost.visible = e.freezeT > 0;
  }

  // Something else (a boss) that tentacles can target. obj needs position, r and damage(amount, color).
  addProxy(obj) {
    const e = { proxy: obj, T: { fly: false }, get pos() { return obj.position; }, get r() { return obj.r; }, dead: false };
    this.list.push(e);
    return e;
  }

  center(e, out = new THREE.Vector3()) {
    if (e.proxy?.center) return e.proxy.center(out);     // bosses know where their middle is
    return out.copy(e.pos).setY(e.pos.y + (e.T.fly ? 0 : e.r));
  }

  damage(e, amount, color = '#fff') {
    if (e.dead) return false;
    if (e.proxy) {
      e.proxy.damage(amount, color);
      if (e.proxy.dead) e.dead = true;
      return e.dead;
    }
    if (e.markT > 0) amount *= 1.5;       // Sticky Note
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
    this.shots.forEach((s) => this.scene.remove(s.m));
    this.shots = [];
  }

  // Mosquito spit that reached the player this frame: returns the damage (run.js applies it)
  shotHits(pc, radius) {
    let dmg = 0;
    for (const s of this.shots) if (!s.done && s.m.position.distanceTo(pc) < radius + 0.005) { s.done = true; dmg += 1; this.fx.puff(s.m.position, 0xc8202a, 0.01, 0.2); }
    return dmg;
  }

  updateShots(dt) {
    for (const s of this.shots) {
      s.t -= dt;
      const step = s.v.length() * dt;
      if (this.world.cast(s.m.position, s.v.clone().normalize(), step + 0.004)) s.done = true;
      s.m.position.addScaledVector(s.v, dt);
      if (s.t <= 0) s.done = true;
      if (s.done) this.scene.remove(s.m);
    }
    this.shots = this.shots.filter((s) => !s.done);
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
      e.freezeT = Math.max(0, (e.freezeT || 0) - dt);
      this.markLook(e, dt);
      e.stunT = Math.max(0, (e.stunT || 0) - dt);                    // lightning
      const slow = e.freezeT > 0 || e.stunT > 0 ? 0 : e.slowT > 0 ? 0.55 : 1;
      const toP = this._d.copy(pc).sub(this.center(e, tmp));
      const dist = toP.length();
      const near = dist < 1.4;

      if (e.T.shoots) {
        // hover at a distance, a little above you, circling slowly; every couple of seconds
        // dip and spit at you
        const away = e.pos.clone().sub(pc).setY(0);
        if (away.lengthSq() < 1e-6) away.set(1, 0, 0);
        away.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.4);
        const spot = pc.clone().addScaledVector(away, 0.2).setY(pc.y + 0.07);
        const to = spot.sub(e.pos);
        const s = e.T.speed * slow;
        e.vel.lerp(to.clampLength(0, 1).multiplyScalar(s * 6).clampLength(0, s), 1 - Math.exp(-3 * dt));
        e.pos.addScaledVector(e.vel, dt);
        e.shootT -= dt * (slow > 0 ? 1 : 0);
        e.aimT = Math.max(0, e.aimT - dt);
        if (e.shootT <= 0.35 && e.aimT <= 0 && e.shootT > 0) e.aimT = 0.35;
        if (e.shootT <= 0 && dist < 0.45) {
          e.shootT = 2.4;
          const m = new THREE.Mesh(this.shotGeo, this.shotMat);
          m.position.copy(e.pos);
          this.scene.add(m);
          this.shots.push({ m, v: pc.clone().sub(e.pos).normalize().multiplyScalar(0.32), t: 2.2 });
        } else if (e.shootT <= 0) e.shootT = 0.5;
      } else if (e.T.fly) {
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
          if (e.state === 'approach' && flat < 0.2 && e.grounded) { e.state = 'windup'; e.stateT = e.T.windup ?? 0.45; }
          else if (e.state === 'windup') {
            speed = 0;
            if (e.stateT <= 0) { e.state = 'dash'; e.stateT = e.T.dashTime ?? 0.45; e.dashDir.copy(toP); }
          } else if (e.state === 'dash') {
            speed = (e.T.dashSpeed ?? 0.55) * slow;
            toP.copy(e.dashDir);
            if (e.stateT <= 0) { e.state = 'rest'; e.stateT = e.T.rest ?? 0.6; }
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
      // turn smoothly toward the player (snapping every frame made them twitch up close)
      if (dist > e.r * 0.5) {
        let d = Math.atan2(pc.x - e.pos.x, pc.z - e.pos.z) - e.root.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        e.root.rotation.y += THREE.MathUtils.clamp(d * (1 - Math.exp(-10 * dt)), -6 * dt, 6 * dt);
      }
      e.pop = Math.max(0, e.pop - dt * 6);
      let sc = e.baseScale * e.spawnT * (1 + e.pop * 0.35);
      if (e.state === 'windup') sc *= 1 + Math.sin(t * 60) * 0.08;
      e.mesh.scale.setScalar(sc);
      e.face.scale.setScalar(sc);
      if (e.elite) { const h = e.root.getObjectByName('halo'); if (h) h.rotation.z += dt * 3; }
      if (e.anim) e.anim(dt, e);
      else if (e.T.fly) e.mesh.rotation.x += dt * 2;
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

    this.updateShots(dt);
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
