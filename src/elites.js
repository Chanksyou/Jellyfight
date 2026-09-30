// High-ground elites: things on the furniture that came alive, one per raised area. Each
// stands in for a real object in the room (hidden while it's alive), only fights when you come
// close, and alternates two attacks. Every attack is telegraphed on the surface first, so you
// can read it and dodge. Beating one gives a treasure pick (run.js).
//
//   controller  on the media console.
//     Button barrage: the buttons glow and three colored aim lines sweep toward you, then lock;
//                     a shot flies down each line.
//     Rumble:         it buzzes while a red circle fills around it, then a shockwave knocks
//                     you back off the console if you're inside.
//   mug         on the standing desk.
//     Coffee lob:     a brown circle fills where you stand; hot coffee lands there and scalds.
//     Spill:          it tips toward you and a brown arrow shows the line; then it pours a
//                     wave of scalding puddles along it.
//   kettle      on the stove.
//     Steam blast:    it whistles and rattles while a steam cone is drawn on the counter where
//                     the blast will go (it's locked in: step out of it), then blasts.
//     Boil over:      the lid pops and orange circles fill around you; boiling drops land in
//                     each one.
//
// To the rest of the game each elite is a "proxy" enemy (enemies.addProxy), so bubbles,
// tentacles, treasures and the minimap treat it like any other target.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { angryEyes } from './enemies.js';
import { juice } from './juice.js';
import { sfx } from './sfx.js';
import { bus, PLAYER } from './events.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, ...o });
const glow = (color, k = 1.5) => std(color, { emissive: color, emissiveIntensity: k });
const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

// ------------------------------------------------------------------ models (meters, facing +z)
function controllerModel() {
  const g = new THREE.Group();
  const shell = std(0x2a2a32, { roughness: 0.35 }), dark = std(0x151518), grip = std(0x1c1c22, { roughness: 0.9 });
  add(g, new RoundedBoxGeometry(0.11, 0.024, 0.055, 4, 0.011), shell, 0, 0.014, 0);
  for (const s of [-1, 1]) {
    const gp = add(g, new THREE.CapsuleGeometry(0.013, 0.03, 4, 12), grip, s * 0.04, 0.012, -0.03);   // textured grips
    gp.rotation.x = Math.PI / 2 - 0.5; gp.rotation.z = s * 0.35;
    add(g, new RoundedBoxGeometry(0.026, 0.008, 0.01, 2, 0.003), dark, s * 0.034, 0.024, 0.029);        // bumpers
    const tr = add(g, new RoundedBoxGeometry(0.022, 0.012, 0.014, 2, 0.004), dark, s * 0.034, 0.018, 0.036); // triggers
    tr.rotation.x = -0.4;
  }
  const buttons = [];
  const btn = (c, x, z) => { const b = add(g, new THREE.SphereGeometry(0.0045, 12, 8), glow(c, 0.5), x, 0.027, z); b.scale.y = 0.5; buttons.push(b); };
  btn(0x3ad86a, 0.03, 0.006); btn(0xd83a3a, 0.038, -0.002); btn(0x3a8ad8, 0.022, -0.002); btn(0xf2c81a, 0.03, -0.01);
  for (const [w, d] of [[0.016, 0.005], [0.005, 0.016]]) add(g, new THREE.BoxGeometry(w, 0.004, d), dark, -0.03, 0.027, -0.002);
  for (const x of [-0.013, 0.013]) {
    add(g, new THREE.CylinderGeometry(0.006, 0.007, 0.006, 14), dark, x, 0.028, -0.014);
    add(g, new THREE.TorusGeometry(0.0055, 0.0012, 6, 16), std(0x3a3a44), x, 0.0315, -0.014).rotation.x = Math.PI / 2;
  }
  add(g, new THREE.CylinderGeometry(0.004, 0.004, 0.002, 16), glow(0xffffff, 1), 0, 0.0265, 0.008);    // home button
  // light bar along the front edge: blue at rest, flashing red when it's about to rumble
  const barMat = glow(0x3a8aff, 2);
  add(g, new THREE.BoxGeometry(0.05, 0.004, 0.004), barMat, 0, 0.02, 0.029);
  // the cable trailing off the back
  add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.02, -0.03), new THREE.Vector3(0.01, 0.01, -0.07), new THREE.Vector3(-0.02, 0.003, -0.12), new THREE.Vector3(0.03, 0.002, -0.17)]), 16, 0.002, 5), dark);
  const face = angryEyes({ y: 0, z: 0, size: 0.3, gap: 0.42, glow: true });
  face.scale.setScalar(0.03);
  face.position.set(0, 0.03, -0.02);
  face.rotation.x = -0.9;
  g.add(face);
  return { group: g, muzzle: new THREE.Vector3(0, 0.03, 0.03), r: 0.05, buttons, barMat };
}

function mugModel() {
  const g = new THREE.Group();
  const glaze = std(0xd9a834, { roughness: 0.25 });
  const wall = add(g, new THREE.CylinderGeometry(0.036, 0.033, 0.085, 32, 1, true), glaze, 0, 0.0425, 0);
  wall.material.side = THREE.DoubleSide;
  add(g, new THREE.CircleGeometry(0.033, 32), glaze, 0, 0.001, 0).rotation.x = -Math.PI / 2;
  add(g, new THREE.TorusGeometry(0.036, 0.0025, 8, 40), glaze, 0, 0.085, 0).rotation.x = Math.PI / 2;           // rolled rim
  add(g, new THREE.CylinderGeometry(0.0365, 0.0355, 0.014, 32, 1, true), std(0x8a3a1a, { roughness: 0.3, side: THREE.DoubleSide }), 0, 0.02, 0);   // a band
  add(g, new THREE.CylinderGeometry(0.0366, 0.0366, 0.003, 32, 1, true), std(0xfff4d8, { side: THREE.DoubleSide }), 0, 0.03, 0);
  const coffee = add(g, new THREE.CircleGeometry(0.034, 32), std(0x3a2214, { roughness: 0.08 }), 0, 0.074, 0);
  coffee.rotation.x = -Math.PI / 2;
  // the handle: a C on the outside of the wall (the old one sat inside the mug)
  const handle = add(g, new THREE.TorusGeometry(0.02, 0.006, 10, 24, Math.PI), glaze, -0.036, 0.045, 0);
  handle.rotation.z = Math.PI / 2;
  // a spoon left in it
  const spoon = new THREE.Group();
  spoon.position.set(0.012, 0.07, -0.01);
  spoon.rotation.z = -0.35;
  add(spoon, new THREE.CylinderGeometry(0.0022, 0.0028, 0.07, 8), std(0xc8ccd0, { metalness: 0.9, roughness: 0.2 }), 0, 0.035, 0);
  g.add(spoon);
  const face = angryEyes({ y: 0, z: 0, size: 0.34, gap: 0.4 });
  face.scale.setScalar(0.03);
  face.position.set(0, 0.05, 0.036);
  g.add(face);
  return { group: g, muzzle: new THREE.Vector3(0, 0.08, 0), r: 0.045 };
}

function kettleModel() {
  const g = new THREE.Group();
  const steel = std(0xd8dcdf, { metalness: 0.85, roughness: 0.18 }), black = std(0x16161a, { roughness: 0.5 });
  const pts = [[0, 0], [0.06, 0], [0.068, 0.02], [0.066, 0.06], [0.055, 0.09], [0.035, 0.105], [0.03, 0.11]].map(([r, y]) => new THREE.Vector2(r, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 36), steel));
  add(g, new THREE.CylinderGeometry(0.062, 0.064, 0.008, 36), black, 0, 0.004, 0);                         // base ring
  // water gauge window
  add(g, new RoundedBoxGeometry(0.012, 0.05, 0.004, 2, 0.002), std(0x9fd8ff, { transparent: true, opacity: 0.6, roughness: 0.05 }), 0.05, 0.045, 0.042).rotation.y = 0.9;
  const lid = new THREE.Group();
  lid.position.y = 0.112;
  add(lid, new THREE.CylinderGeometry(0.031, 0.031, 0.006, 24), steel);
  add(lid, new THREE.SphereGeometry(0.009, 12, 8), black, 0, 0.008, 0);
  g.add(lid);
  const spout = add(g, new THREE.CylinderGeometry(0.007, 0.014, 0.06, 14), steel, 0, 0.07, 0.07);
  spout.rotation.x = 0.9;
  add(g, new THREE.TorusGeometry(0.0075, 0.002, 6, 14), black, 0, 0.09, 0.093).rotation.x = 0.9 - Math.PI / 2;   // spout tip
  const handle = add(g, new THREE.TorusGeometry(0.045, 0.007, 10, 24, Math.PI), black, 0, 0.105, 0);
  handle.rotation.y = Math.PI / 2;
  const led = add(g, new THREE.SphereGeometry(0.004, 8, 6), glow(0xff3a2a, 2), -0.05, 0.02, 0.04);
  const face = angryEyes({ y: 0, z: 0, size: 0.34, gap: 0.42 });
  face.scale.setScalar(0.04);
  face.position.set(0, 0.05, 0.066);
  g.add(face);
  return { group: g, muzzle: new THREE.Vector3(0, 0.1, 0.1), r: 0.065, lid, led };
}

const KINDS = {
  controller: { name: 'The Controller', hp: 150, aggro: 0.7, scale: 1.5, build: controllerModel },
  mug: { name: 'The Mug', hp: 170, aggro: 0.8, build: mugModel },
  kettle: { name: 'The Kettle', hp: 210, aggro: 0.6, scale: 1.2, build: kettleModel },
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
    this.next = 0;                       // which attack comes next (they alternate)
    this.hitPop = 0;
    this.tele = [];                      // telegraph meshes for the current attack
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

  clearTele() { this.tele.forEach((m) => this.owner.scene.remove(m)); this.tele = []; }

  remove() {
    this.clearTele();
    this.owner.scene.remove(this.holder);
    if (this.hidden) this.hidden.visible = this.hiddenWas;   // back as it was (it may be hidden in the layout)
  }
}

// ------------------------------------------------------------------ manager
export class Elites {
  constructor(scene, enemies, fx, world, camera, apartmentRoot) {
    this._dir = new THREE.Vector3();   // scratch for the shot raycasts
    Object.assign(this, { scene, enemies, fx, world, camera, root: apartmentRoot });
    this.list = [];
    this.bullets = [];
    this.blobs = [];
    this.puddles = [];
    this.bulletGeo = new THREE.SphereGeometry(0.0055, 10, 8);
    this.bulletColors = [0x3ad86a, 0xd83a3a, 0x3a8ad8, 0xf2c81a];
    this.bulletMats = this.bulletColors.map((c) => glow(c, 1.2));
    this.coffeeMat = std(0x3a2214, { roughness: 0.08 });
    this.dropMat = glow(0xff8a3a, 1.2);
    this.blobGeo = new THREE.SphereGeometry(0.008, 12, 8);
    this.flat = new THREE.CircleGeometry(1, 36).rotateX(-Math.PI / 2);
    this.ringGeo = new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2);
    this.stripGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
    // a 50° wedge pointing +z (Circle geometry's sector starts at +x, so rotate it round)
    this.coneGeo = new THREE.CircleGeometry(1, 24, -0.45, 0.9).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2);
    this.arrowGeo = (() => { const s = new THREE.Shape().moveTo(-0.3, 0).lineTo(0.3, 0).lineTo(0.3, 0.75).lineTo(0.7, 0.75).lineTo(0, 1).lineTo(-0.7, 0.75).lineTo(-0.3, 0.75).lineTo(-0.3, 0); const g = new THREE.ShapeGeometry(s); g.rotateX(Math.PI / 2); return g; })();
    const tele = (c, o = 0.35) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide });
    this.T = { brown: tele(0x8a5a2a), red: tele(0xff3a3a), orange: tele(0xff8a3a), steam: tele(0x7cc8ff, 0.4), aim: this.bulletColors.map((c) => tele(c, 0.5)) };
  }

  // Apartment objects are named after what they are; three.js's loader swaps spaces for underscores
  findObject(name) {
    const want = THREE.PropertyBinding.sanitizeNodeName(name);
    let found = null;
    this.root.traverse((o) => { if (!found && o.name === want) found = o; });
    return found;
  }

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
    for (const b of [...this.bullets, ...this.blobs, ...this.puddles]) { this.scene.remove(b.m); if (b.warn) this.scene.remove(b.warn); }
    this.bullets = []; this.blobs = []; this.puddles = [];
  }

  get alive() { return this.list.filter((e) => !e.dead); }

  // Show one of each projectile and telegraph so their shaders compile before play (main.js warmUp)
  warm(on, at) {
    if (on) {
      this._warm = [...this.bulletMats.map((m) => new THREE.Mesh(this.bulletGeo, m)), new THREE.Mesh(this.blobGeo, this.coffeeMat), new THREE.Mesh(this.blobGeo, this.dropMat),
        ...[this.T.brown, this.T.red, this.T.orange, this.T.steam, ...this.T.aim].map((m) => new THREE.Mesh(this.flat, m)), new THREE.Mesh(this.flat, this.coffeeMat)];
      this._warm.forEach((m) => { m.position.copy(at); m.scale.setScalar(m.geometry === this.flat ? 0.01 : 1); this.scene.add(m); });
    } else (this._warm || []).forEach((m) => this.scene.remove(m));
  }

  surfaceBelow(p) {
    const h = this.world.castAll(p.clone().setY(p.y + 0.05), DOWN, 1.5);
    return h ? h.point.y : p.y;
  }

  // a flat telegraph mesh on a surface
  mark(e, geo, mat, pos, scale, rotY = 0) {
    const m = new THREE.Mesh(geo, mat.clone());
    m.position.copy(pos);
    m.scale.copy(scale);
    m.rotation.y = rotY;
    m.renderOrder = 3;
    this.scene.add(m);
    if (e) e.tele.push(m);
    return m;
  }

  // a warning circle that fills from the middle as the hit gets closer (k 0..1)
  warnCircle(pos, r, mat) {
    const ring = new THREE.Mesh(this.ringGeo, mat.clone());
    const fill = new THREE.Mesh(this.flat, mat.clone());
    ring.scale.setScalar(r);
    fill.scale.setScalar(0.001);
    ring.renderOrder = fill.renderOrder = 3;
    const g = new THREE.Group();
    g.position.copy(pos).setY(pos.y + 0.002);
    g.add(ring, fill);
    g.updateMatrixWorld(true);
    this.scene.add(g);
    g.userData.fill = (k) => { fill.scale.setScalar(Math.max(0.001, r * k)); fill.material.opacity = 0.2 + k * 0.25; ring.material.opacity = 0.5 + Math.sin(performance.now() / 60) * 0.2; };
    return g;
  }

  // lob something in an arc to `to`; a warning circle fills until it lands
  lob(from, to, T, mat, warnMat, r, onLand) {
    const m = new THREE.Mesh(this.blobGeo, mat);
    m.position.copy(from);
    this.scene.add(m);
    this.blobs.push({ m, warn: this.warnCircle(to, r, warnMat), from: from.clone(), to: to.clone(), t: 0, T, onLand });
  }

  puddle(at, r = 0.045, life = 3.5) {
    const m = new THREE.Mesh(this.flat, this.coffeeMat);
    m.position.copy(at).setY(at.y + 0.0015);
    m.scale.setScalar(r);
    this.scene.add(m);
    this.puddles.push({ m, r, t: life });
  }

  // What they do to you goes out as events (damage_taken, knockback, status_applied); a beaten
  // elite sends elite_defeated
  update(dt, player, cfg) {
    const P = player.position, pc = P.clone().setY(P.y + cfg.height * 0.5);
    const camQ = this.camera.quaternion;
    const sameLevel = (y) => Math.abs(P.y - y) < 0.1;
    const hit = (amount, source) => bus.emit('damage_taken', { targetId: PLAYER, amount, source });
    const knock = (from, force) => bus.emit('knockback', { targetId: PLAYER, dir: P.clone().sub(from).setY(0).normalize(), force, launch: 0.25 });

    for (const e of this.list) {
      if (e.dead) {
        if (!e.done) {
          e.done = true;
          this.fx.puff(e.base.clone().setY(e.base.y + e.r), 0xffd23a, e.r * 2.5, 0.6);
          this.fx.ring(e.base.clone().setY(e.base.y + 0.004), 0xffd23a, e.r * 3, 0.6);
          e.remove();
          bus.emit('elite_defeated', { elite: e });
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
      const awake = to.length() < e.aggro;
      // face you (unless an attack has locked its aim), and bob so it reads as alive
      if (!e.locked) {
        let d = Math.atan2(to.x, to.z) - e.holder.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        e.holder.rotation.y += d * (1 - Math.exp(-(awake ? 6 : 1.5) * dt));
      }
      g.position.set(0, Math.abs(Math.sin(e.t * (awake ? 4 : 1.5))) * 0.004, 0);
      g.rotation.set(0, 0, 0);
      e.cool -= dt;
      const muzzle = e.model.muzzle.clone().applyAxisAngle(UP, e.holder.rotation.y).add(e.base);
      const heading = e.holder.rotation.y, fwd = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
      const surf = e.base.clone().setY(e.base.y + 0.002);

      // start the next attack
      if (e.state === 'idle') {
        if (!awake || e.cool > 0) continue;
        // finish turning to face you first, so the telegraph points where you are
        const off = Math.atan2(Math.sin(Math.atan2(to.x, to.z) - heading), Math.cos(Math.atan2(to.x, to.z) - heading));
        if (Math.abs(off) > 0.15) continue;
        e.attack = e.next++ % 2;
        e.state = 'windup';
        e.stateT = 0;
        e.locked = false;
      }
      e.stateT += dt;
      const s = e.stateT;

      // ---------------------------------------------------------- controller
      if (e.kind === 'controller') {
        const M = e.model;
        if (e.attack === 0) {
          // Button barrage: aim lines sweep toward you for 0.6 s, lock for 0.25 s, then fire
          if (s < 0.85) {
            M.buttons.forEach((b, i) => { b.material.emissiveIntensity = 0.5 + (Math.sin(e.t * 30 + i) * 0.5 + 0.5) * 3; });
            if (!e.tele.length) [-0.22, 0, 0.22].forEach((a, i) => this.mark(e, this.stripGeo, this.T.aim[i], surf, new THREE.Vector3(0.008, 1, 0.45), heading + a));
            if (s > 0.6) e.locked = true;
            e.tele.forEach((m, i) => { m.position.copy(surf); m.rotation.y = e.holder.rotation.y + [-0.22, 0, 0.22][i]; m.material.opacity = e.locked ? 0.85 : 0.35 + Math.sin(e.t * 20) * 0.15; });
          } else {
            e.tele.forEach((m, i) => {
              const dir = new THREE.Vector3(Math.sin(m.rotation.y), 0, Math.cos(m.rotation.y));
              const b = new THREE.Mesh(this.bulletGeo, this.bulletMats[i]);
              b.position.copy(muzzle);
              this.scene.add(b);
              this.bullets.push({ m: b, v: dir.multiplyScalar(0.6), t: 1.5 });
            });
            M.buttons.forEach((b) => { b.material.emissiveIntensity = 0.5; });
            e.clearTele(); e.hitPop = 0.8; sfx.zap();
            e.state = 'idle'; e.cool = 1.6; e.locked = false;
          }
        } else {
          // Rumble: buzz while a red circle fills around it, then a shockwave
          const R = 0.22, wind = 1.1;
          if (s < wind) {
            if (!e.tele.length) e.tele.push(this.warnCircle(surf, R, this.T.red));
            e.tele[0].userData.fill(s / wind);
            g.position.x = (Math.random() - 0.5) * 0.004; g.position.z = (Math.random() - 0.5) * 0.004;
            M.barMat.emissive.setHex(Math.sin(e.t * 25) > 0 ? 0xff2a2a : 0x3a8aff);
          } else {
            e.clearTele();
            M.barMat.emissive.setHex(0x3a8aff);
            this.fx.ring(surf, 0xff5a5a, R, 0.4);
            this.fx.burst(surf.clone().setY(surf.y + 0.02), ['#ff5a5a', '#ffffff'], 10, 0.004, 0.4, surf.y);
            juice.shake(0.35); sfx.kill(1.6);
            if (Math.hypot(P.x - e.base.x, P.z - e.base.z) < R + cfg.radius && sameLevel(e.base.y)) { hit(3, 'controller'); knock(e.base, 0.9); }
            e.state = 'idle'; e.cool = 1.8;
          }
        }
      }

      // ---------------------------------------------------------- mug
      if (e.kind === 'mug') {
        if (e.attack === 0) {
          // Coffee lob: two lobs, a beat apart, each at where you're standing then
          const throwAt = () => { const target = P.clone(); target.y = this.surfaceBelow(P); this.lob(muzzle, target, 1.0, this.coffeeMat, this.T.brown, 0.045, (at) => { this.puddle(at); sfx.acid(); }); e.hitPop = 0.6; };
          if (!e.thrown) { e.thrown = 1; throwAt(); }
          if (s > 0.6 && e.thrown === 1) { e.thrown = 2; throwAt(); }
          if (s > 1.2) { e.state = 'idle'; e.cool = 1.6; e.thrown = 0; }
        } else {
          // Spill: tips toward you (arrow on the surface shows the line), then pours a wave
          const wind = 0.9;
          if (s < wind) {
            if (!e.tele.length) { e.locked = true; e.poured = -1; this.mark(e, this.arrowGeo, this.T.brown, surf.clone().addScaledVector(fwd, e.r), new THREE.Vector3(0.06, 1, 0.34), heading); }
            e.tele[0].material.opacity = 0.3 + Math.sin(e.t * 18) * 0.15;
            g.rotation.x = (s / wind) * 0.7;                                  // tipping over
          } else if (s < wind + 0.5) {
            g.rotation.x = 0.9;
            const k = Math.floor((s - wind) / 0.12);
            if (k !== e.poured && k < 4) {
              e.poured = k;
              const at = e.base.clone().addScaledVector(fwd, e.r + 0.05 + k * 0.075);
              at.y = this.surfaceBelow(at);
              this.puddle(at, 0.04, 3);
              this.fx.burst(at.clone().setY(at.y + 0.01), ['#3a2214', '#6a4a2a'], 5, 0.003, 0.25, at.y);
              sfx.acid();
            }
          } else { e.clearTele(); e.locked = false; e.state = 'idle'; e.cool = 1.8; }
        }
        if (Math.random() < dt * 3) this.fx.puff(e.base.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.02, 0.1, (Math.random() - 0.5) * 0.02)), 0xffffff, 0.008, 0.8);   // steam wisps
      }

      // ---------------------------------------------------------- kettle
      if (e.kind === 'kettle') {
        const M = e.model;
        if (e.attack === 0) {
          // Steam blast: whistle for 1.1 s with the cone drawn where it'll go, then blast
          const wind = 1.1, len = 0.5;
          if (s < wind) {
            if (!e.tele.length) { e.locked = true; this.mark(e, this.coneGeo, this.T.steam, surf.clone().addScaledVector(fwd, e.r * 0.8), new THREE.Vector3(len, 1, len), heading); }
            e.tele[0].material.opacity = 0.3 + (s / wind) * 0.35 + Math.sin(e.t * 25) * 0.08;
            g.rotation.z = Math.sin(e.t * 50) * 0.05;
            M.lid.position.y = 0.112 + Math.abs(Math.sin(e.t * 40)) * 0.004;
            if (Math.random() < dt * 20) this.fx.puff(muzzle, 0xffffff, 0.006, 0.3);
            if (Math.random() < dt * 6) sfx.wind();
          } else if (s < wind + 1.0) {
            if (e.tele[0]) e.tele[0].material.opacity = 0.1;
            if (Math.random() < dt * 40) {
              const k = Math.random();
              const side = new THREE.Vector3(fwd.z, 0, -fwd.x).multiplyScalar((Math.random() - 0.5) * 0.5 * k);
              this.fx.puff(muzzle.clone().addScaledVector(fwd, 0.05 + k * len * 0.9).add(side).setY(muzzle.y - k * 0.06), 0xf2f6ff, 0.015 + k * 0.03, 0.45);
            }
            const rel = pc.clone().sub(muzzle).setY(0);
            const along = rel.dot(fwd), ang = Math.acos(THREE.MathUtils.clamp(rel.clone().normalize().dot(fwd), -1, 1));
            if (along > 0 && along < len + 0.04 && ang < 0.47 && Math.abs(pc.y - muzzle.y) < 0.15) { hit(2, 'kettle'); bus.emit('knockback', { targetId: PLAYER, dir: fwd, force: 1.5 * dt }); }
          } else { e.clearTele(); e.locked = false; e.state = 'idle'; e.cool = 1.6; M.lid.position.y = 0.112; }
        } else {
          // Boil over: the lid pops, four boiling drops fall on filling orange circles around you
          if (!e.popped) {
            e.popped = true;
            M.led.material.emissiveIntensity = 4;
            sfx.fire();
            const center = P.clone(); center.y = this.surfaceBelow(P);
            for (let k = 0; k < 4; k++) {
              const at = k === 0 ? center.clone() : center.clone().add(new THREE.Vector3(Math.cos(k * 2.1) * 0.09, 0, Math.sin(k * 2.1) * 0.09));
              at.y = this.surfaceBelow(at);
              this.lob(muzzle, at, 1.0 + k * 0.15, this.dropMat, this.T.orange, 0.035, (p) => {
                this.fx.burst(p.clone().setY(p.y + 0.01), ['#ff8a3a', '#ffd23a', '#ffffff'], 6, 0.003, 0.3, p.y);
                this.fx.puff(p, 0xffffff, 0.03, 0.4);
                if (Math.hypot(P.x - p.x, P.z - p.z) < 0.035 + cfg.radius && Math.abs(P.y - p.y) < 0.06) hit(2, 'kettle');
              });
            }
          }
          M.lid.position.y = 0.112 + Math.max(0, Math.sin(Math.min(1, s * 2) * Math.PI)) * 0.04;
          if (s > 1.6) { e.popped = false; M.led.material.emissiveIntensity = 2; M.lid.position.y = 0.112; e.state = 'idle'; e.cool = 1.8; }
        }
      }
    }

    // button shots
    for (const b of this.bullets) {
      b.t -= dt;
      const step = b.v.length() * dt;
      if (this.world.cast(b.m.position, this._dir.copy(b.v).normalize(), step + 0.004)) b.t = 0;
      b.m.position.addScaledVector(b.v, dt);
      if (b.m.position.distanceTo(pc) < cfg.radius + 0.006) { hit(2, 'controller'); b.t = 0; this.fx.puff(b.m.position, 0xffffff, 0.01, 0.2); }
      if (b.t <= 0) this.scene.remove(b.m);
    }
    this.bullets = this.bullets.filter((b) => b.t > 0);

    // lobbed things in flight, with their warning circles filling
    for (const b of this.blobs) {
      b.t += dt;
      const k = Math.min(1, b.t / b.T);
      b.m.position.lerpVectors(b.from, b.to, k);
      b.m.position.y += Math.sin(k * Math.PI) * 0.12;
      b.warn.userData.fill(k);
      if (k >= 1) {
        this.scene.remove(b.m);
        this.scene.remove(b.warn);
        b.onLand?.(b.to);
        b.done = true;
      }
    }
    this.blobs = this.blobs.filter((b) => !b.done);

    // scalding puddles
    for (const p of this.puddles) {
      p.t -= dt;
      p.m.scale.setScalar(p.r * Math.min(1, p.t * 2));
      const d = Math.hypot(P.x - p.m.position.x, P.z - p.m.position.z);
      if (d < p.r && Math.abs(P.y - p.m.position.y) < 0.02 && player.grounded) { bus.emit('damage_taken', { targetId: PLAYER, amount: 1.5 * dt, source: 'coffee', drain: true }); bus.emit('status_applied', { targetId: PLAYER, status: 'slow', duration: 0.3 }); }
      if (p.t <= 0) this.scene.remove(p.m);
    }
    this.puddles = this.puddles.filter((p) => p.t > 0);
  }
}
