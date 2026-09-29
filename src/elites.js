// High-ground elites: things on the furniture that came alive, one per raised area. Each
// stands in for a real object in the room (hidden while it's alive), has its own attack, and
// only fights when you come close, so you choose when to take it on. Beating one gives a
// treasure pick (run.js).
//
//   controller  Game controller on the media console. Fires spreads of colored button shots.
//   mug         Coffee mug on the standing desk. Lobs coffee where you stand; the puddles scald.
//   kettle      Kettle on the stove. Whistles as a warning, then blasts a cone of steam.
//
// To the rest of the game each elite is a "proxy" enemy (enemies.addProxy), so tentacles,
// treasures and the minimap treat it like any other target.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { angryEyes } from './enemies.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, ...o });

// ------------------------------------------------------------------ models (meters, facing +z)
function controllerModel() {
  const g = new THREE.Group();
  const shell = std(0x2a2a32, { roughness: 0.35 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.024, 0.055, 4, 0.011), shell);
  body.position.y = 0.014;
  g.add(body);
  for (const s of [-1, 1]) {                                   // grips
    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.03, 4, 12), shell);
    grip.rotation.x = Math.PI / 2 - 0.5;
    grip.rotation.z = s * 0.35;
    grip.position.set(s * 0.04, 0.012, -0.03);
    g.add(grip);
  }
  const btn = (c, x, z) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 10, 8), std(c, { emissive: c, emissiveIntensity: 0.5 })); b.position.set(x, 0.027, z); b.scale.y = 0.5; g.add(b); };
  btn(0x3ad86a, 0.03, 0.006); btn(0xd83a3a, 0.038, -0.002); btn(0x3a8ad8, 0.022, -0.002); btn(0xf2c81a, 0.03, -0.01);
  const pad = std(0x151518);
  for (const [w, d] of [[0.016, 0.005], [0.005, 0.016]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(w, 0.004, d), pad); p.position.set(-0.03, 0.027, -0.002); g.add(p); }
  for (const x of [-0.013, 0.013]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.007, 0.006, 14), pad);
    st.position.set(x, 0.028, -0.014);
    g.add(st);
  }
  const face = angryEyes({ y: 0, z: 0, size: 0.3, gap: 0.42, glow: true });
  face.scale.setScalar(0.03);
  face.position.set(0, 0.03, 0.02);
  face.rotation.x = -0.9;
  g.add(face);
  return { group: g, muzzle: new THREE.Vector3(0, 0.03, 0.03), r: 0.05 };
}

function mugModel() {
  const g = new THREE.Group();
  const glaze = std(0xd9a834, { roughness: 0.25 });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.033, 0.085, 32, 1, true), glaze);
  wall.material.side = THREE.DoubleSide;
  wall.position.y = 0.0425;
  g.add(wall);
  const base = new THREE.Mesh(new THREE.CircleGeometry(0.033, 32), glaze);
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.001;
  g.add(base);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.034, 32), std(0x3a2214, { roughness: 0.1 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.074;
  g.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0055, 10, 24, Math.PI * 1.2), glaze);
  handle.rotation.z = -Math.PI * 0.6;
  handle.position.set(-0.038, 0.045, 0);
  g.add(handle);
  const face = angryEyes({ y: 0, z: 0, size: 0.34, gap: 0.4 });
  face.scale.setScalar(0.03);
  face.position.set(0, 0.05, 0.036);
  g.add(face);
  return { group: g, muzzle: new THREE.Vector3(0, 0.08, 0), r: 0.045 };
}

function kettleModel() {
  const g = new THREE.Group();
  const steel = std(0xd8dcdf, { metalness: 0.85, roughness: 0.18 });
  const black = std(0x16161a, { roughness: 0.5 });
  const pts = [[0, 0], [0.06, 0], [0.068, 0.02], [0.066, 0.06], [0.055, 0.09], [0.035, 0.105], [0.03, 0.11]].map(([r, y]) => new THREE.Vector2(r, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 36), steel));
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.006, 24), steel);
  lid.position.y = 0.112;
  g.add(lid);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), black);
  knob.position.y = 0.12;
  g.add(knob);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.014, 0.06, 14), steel);
  spout.position.set(0, 0.07, 0.07);
  spout.rotation.x = 0.9;
  g.add(spout);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.007, 10, 24, Math.PI), black);
  handle.position.y = 0.105;
  handle.rotation.y = Math.PI / 2;
  g.add(handle);
  const face = angryEyes({ y: 0, z: 0, size: 0.34, gap: 0.42 });
  face.scale.setScalar(0.04);
  face.position.set(0, 0.05, 0.066);
  g.add(face);
  return { group: g, muzzle: new THREE.Vector3(0, 0.1, 0.1), r: 0.065, lid };
}

const KINDS = {
  controller: { name: 'The Controller', hp: 110, aggro: 0.7, scale: 1.5, build: controllerModel },
  mug: { name: 'The Mug', hp: 130, aggro: 0.8, build: mugModel },
  kettle: { name: 'The Kettle', hp: 160, aggro: 0.55, scale: 1.2, build: kettleModel },
};

// ------------------------------------------------------------------ one elite
class Elite {
  constructor(owner, spec) {
    const K = KINDS[spec.kind];
    Object.assign(this, { owner, spec, kind: spec.kind, name: K.name, aggro: K.aggro });
    this.maxHp = this.hp = K.hp;
    this.dead = false;
    this.base = new THREE.Vector3(...spec.at);
    const m = K.build();
    this.size = K.scale || 1;             // a bit bigger than life, so it reads from the game camera
    m.r *= this.size;
    m.muzzle.multiplyScalar(this.size);
    this.model = m;
    this.r = m.r;
    this.holder = new THREE.Group();
    this.holder.position.copy(this.base);
    this.holder.add(m.group);
    m.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    owner.scene.add(this.holder);
    // a little health bar that faces the camera
    this.bar = new THREE.Group();
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.008), new THREE.MeshBasicMaterial({ color: 0x1a1a22, transparent: true, opacity: 0.7, depthTest: false }));
    this.fill = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.005).translate(0.033, 0, 0), new THREE.MeshBasicMaterial({ color: 0xffc23a, depthTest: false }));
    this.fill.position.set(-0.033, 0, 0.0005);
    back.renderOrder = this.fill.renderOrder = 10;
    this.bar.add(back, this.fill);
    this.bar.position.y = m.r * 2.2 + 0.03;
    this.holder.add(this.bar);
    this.t = 0;
    this.cool = 1.5;
    this.state = 'idle';
    this.hitPop = 0;
    // stand in for the real object while alive
    this.hidden = spec.hide ? owner.findObject(spec.hide) : null;
    if (this.hidden) { this.hiddenWas = this.hidden.visible; this.hidden.visible = false; }
  }

  get position() { return this.base; }

  damage(amount, color = '#fff') {
    if (this.dead) return;
    this.hp -= amount;
    this.hitPop = 1;
    this.owner.fx.number(this.base.clone().setY(this.base.y + this.r * 1.6), Math.round(amount), color, 16);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  remove() {
    this.owner.scene.remove(this.holder);
    if (this.hidden) this.hidden.visible = this.hiddenWas;   // back as it was (it may be hidden in the layout)
  }
}

// ------------------------------------------------------------------ manager
export class Elites {
  constructor(scene, enemies, fx, world, camera, apartmentRoot) {
    Object.assign(this, { scene, enemies, fx, world, camera, root: apartmentRoot });
    this.list = [];
    this.bullets = [];
    this.blobs = [];
    this.puddles = [];
    this.bulletGeo = new THREE.SphereGeometry(0.0055, 10, 8);
    this.bulletMats = [0x3ad86a, 0xd83a3a, 0x3a8ad8, 0xf2c81a].map((c) => std(c, { emissive: c, emissiveIntensity: 1.2 }));
    this.coffeeMat = std(0x3a2214, { roughness: 0.08 });
    this.blobGeo = new THREE.SphereGeometry(0.008, 12, 8);
    this.puddleGeo = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);
    this.warnMat = new THREE.MeshBasicMaterial({ color: 0x8a5a2a, transparent: true, opacity: 0.35, depthWrite: false });
  }

  // Apartment objects are named after what they are; three.js's loader swaps spaces for underscores
  findObject(name) {
    const want = THREE.PropertyBinding.sanitizeNodeName(name);
    let found = null;
    this.root.traverse((o) => { if (!found && o.name === want) found = o; });
    return found;
  }

  // specs: stage.elites
  start(specs = []) {
    this.clear();
    for (const s of specs) {
      const e = new Elite(this, s);
      e.entry = this.enemies.addProxy(e);
      this.list.push(e);
    }
  }

  clear() {
    this.list.forEach((e) => { e.remove(); if (e.entry) e.entry.dead = true; });
    this.list = [];
    for (const b of this.bullets) this.scene.remove(b.m);
    for (const b of this.blobs) this.scene.remove(b.m);
    for (const p of this.puddles) this.scene.remove(p.m);
    this.bullets = []; this.blobs = []; this.puddles = [];
  }

  get alive() { return this.list.filter((e) => !e.dead); }

  // Show one of each projectile so their shaders compile before play (main.js warmUp)
  warm(on, at) {
    if (on) {
      this._warm = [...this.bulletMats.map((m) => new THREE.Mesh(this.bulletGeo, m)), new THREE.Mesh(this.blobGeo, this.coffeeMat), new THREE.Mesh(this.puddleGeo, this.warnMat), new THREE.Mesh(this.puddleGeo, this.coffeeMat)];
      this._warm.forEach((m) => { m.position.copy(at); m.scale.setScalar(m.geometry === this.puddleGeo ? 0.01 : 1); this.scene.add(m); });
    } else (this._warm || []).forEach((m) => this.scene.remove(m));
  }

  surfaceBelow(p) {
    const h = this.world.castAll(p.clone().setY(p.y + 0.05), DOWN, 1.5);
    return h ? h.point.y : p.y;
  }

  // hooks: { hit(amount), hurt(amount), slow(), defeated(elite) }
  update(dt, player, cfg, hooks) {
    const P = player.position, pc = P.clone().setY(P.y + cfg.height * 0.5);
    const camQ = this.camera.quaternion;

    for (const e of this.list) {
      if (e.dead) {
        if (!e.done) {
          e.done = true;
          this.fx.puff(e.base.clone().setY(e.base.y + e.r), 0xffd23a, e.r * 2.5, 0.6);
          this.fx.ring(e.base.clone().setY(e.base.y + 0.004), 0xffd23a, e.r * 3, 0.6);
          e.remove();
          hooks.defeated(e);
        }
        continue;
      }
      e.t += dt;
      e.hitPop = Math.max(0, e.hitPop - dt * 6);
      const g = e.model.group;
      g.scale.setScalar(e.size * (1 + e.hitPop * 0.08));
      e.bar.quaternion.copy(camQ);
      e.fill.scale.x = Math.max(0.001, e.hp / e.maxHp);
      const to = pc.clone().sub(e.base);
      const dist = to.length();
      const awake = dist < e.aggro;
      // turn to face you, and bob a little so it reads as alive
      const want = Math.atan2(to.x, to.z);
      let d = want - e.holder.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      e.holder.rotation.y += d * (1 - Math.exp(-(awake ? 6 : 1.5) * dt));
      g.position.y = Math.abs(Math.sin(e.t * (awake ? 4 : 1.5))) * 0.004;
      e.cool -= dt;
      if (!awake) { e.state = 'idle'; continue; }
      const muzzle = e.model.muzzle.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), e.holder.rotation.y).add(e.base);

      if (e.kind === 'controller' && e.cool <= 0) {
        // a spread of three button shots at you
        e.cool = 2.2;
        const dir = pc.clone().sub(muzzle).normalize();
        for (const a of [-0.22, 0, 0.22]) {
          const m = new THREE.Mesh(this.bulletGeo, this.bulletMats[(Math.random() * 4) | 0]);
          m.position.copy(muzzle);
          this.scene.add(m);
          this.bullets.push({ m, v: dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a).multiplyScalar(0.42), t: 2 });
        }
        e.hitPop = 0.6;
      }

      if (e.kind === 'mug' && e.cool <= 0 && this.puddles.length < 4) {
        // lob coffee at where you are standing; a brown circle warns where it will land
        e.cool = 3;
        const target = P.clone();
        target.y = this.surfaceBelow(P);
        const warn = new THREE.Mesh(this.puddleGeo, this.warnMat);
        warn.position.copy(target).setY(target.y + 0.002);
        warn.scale.setScalar(0.045);
        this.scene.add(warn);
        const m = new THREE.Mesh(this.blobGeo, this.coffeeMat);
        this.scene.add(m);
        this.blobs.push({ m, warn, from: muzzle.clone(), to: target, t: 0, T: 0.9 });
        e.hitPop = 0.6;
      }

      if (e.kind === 'kettle') {
        // idle -> whistle (the warning: it shakes and puffs) -> steam blast in a cone
        if (e.state === 'idle' && e.cool <= 0) { e.state = 'whistle'; e.stateT = 1.0; }
        if (e.state === 'whistle') {
          e.stateT -= dt;
          g.rotation.z = Math.sin(e.t * 50) * 0.05;
          if (e.model.lid) e.model.lid.position.y = 0.112 + Math.abs(Math.sin(e.t * 40)) * 0.004;   // in model units, scaled with it
          if (Math.random() < dt * 20) this.fx.puff(muzzle, 0xffffff, 0.006, 0.3);
          if (e.stateT <= 0) { e.state = 'blast'; e.stateT = 1.2; e.blastDir = to.clone().setY(0).normalize(); g.rotation.z = 0; }
        } else if (e.state === 'blast') {
          e.stateT -= dt;
          const dir = e.blastDir;
          if (Math.random() < dt * 40) {
            const k = Math.random();
            const spread = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar((Math.random() - 0.5) * 0.25 * k);
            this.fx.puff(muzzle.clone().addScaledVector(dir, 0.05 + k * 0.42).add(spread).setY(muzzle.y - k * 0.06), 0xf2f6ff, 0.015 + k * 0.03, 0.45);
          }
          const rel = pc.clone().sub(muzzle);
          const along = rel.dot(dir);
          const flat = rel.clone().setY(0);
          const ang = flat.length() > 1e-4 ? Math.acos(THREE.MathUtils.clamp(flat.normalize().dot(dir), -1, 1)) : 0;
          if (along > 0 && along < 0.5 && ang < 0.45 && Math.abs(rel.y) < 0.15) {
            hooks.hit(2);
            player.velocity.addScaledVector(dir, 0.5 * dt * 60 * 0.05);
          }
          if (e.stateT <= 0) { e.state = 'idle'; e.cool = 2.5; }
        }
      }
    }

    // button shots
    for (const b of this.bullets) {
      b.t -= dt;
      const step = b.v.length() * dt;
      if (this.world.cast(b.m.position, b.v.clone().normalize(), step + 0.004)) b.t = 0;
      b.m.position.addScaledVector(b.v, dt);
      if (b.m.position.distanceTo(pc) < cfg.radius + 0.006) { hooks.hit(2); b.t = 0; this.fx.puff(b.m.position, 0xffffff, 0.01, 0.2); }
      if (b.t <= 0) this.scene.remove(b.m);
    }
    this.bullets = this.bullets.filter((b) => b.t > 0);

    // coffee in flight, then puddles
    for (const b of this.blobs) {
      b.t += dt;
      const k = Math.min(1, b.t / b.T);
      b.m.position.lerpVectors(b.from, b.to, k);
      b.m.position.y += Math.sin(k * Math.PI) * 0.12;
      b.warn.material.opacity = 0.2 + k * 0.3;
      if (k >= 1) {
        this.scene.remove(b.m);
        this.scene.remove(b.warn);
        const m = new THREE.Mesh(this.puddleGeo, this.coffeeMat);
        m.position.copy(b.to).setY(b.to.y + 0.0015);
        m.scale.setScalar(0.045);
        this.scene.add(m);
        this.puddles.push({ m, t: 3.5 });
        this.fx.puff(b.to, 0x3a2214, 0.03, 0.3);
        b.done = true;
      }
    }
    this.blobs = this.blobs.filter((b) => !b.done);
    for (const p of this.puddles) {
      p.t -= dt;
      p.m.scale.setScalar(0.045 * Math.min(1, p.t * 2));
      const d = Math.hypot(P.x - p.m.position.x, P.z - p.m.position.z);
      if (d < 0.045 && Math.abs(P.y - p.m.position.y) < 0.02 && player.grounded) { hooks.hurt(1.5 * dt); hooks.slow(); }
      if (p.t <= 0) this.scene.remove(p.m);
    }
    this.puddles = this.puddles.filter((p) => p.t > 0);
  }
}
