// Things you collect: dew (XP) and the Moon Drop.
import * as THREE from 'three';
import { batcher } from './batch.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const MAGNET = 0.09;          // meters: dew drifts to you from this far

// ---------------------------------------------------------------- dew
export class Dew {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.geo = new THREE.SphereGeometry(0.0035, 12, 8);
    this.mat = new THREE.MeshStandardMaterial({ color: 0x9fe2ff, emissive: 0x3aa8ff, emissiveIntensity: 0.5, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.9 });
    this.magnetAll = false;
    this._to = new THREE.Vector3();
  }

  drop(pos, value, count = 1) {
    for (let i = 0; i < count; i++) {
      if (this.list.length >= 220) {           // too many: fold into the nearest one
        const n = this.list.reduce((a, d) => (!a || d.m.position.distanceToSquared(pos) < a.m.position.distanceToSquared(pos) ? d : a), null);
        n.value += value;
        continue;
      }
      const m = batcher.track(new THREE.Mesh(this.geo, this.mat));   // drawn instanced (batch.js)
      m.position.copy(pos);
      this.scene.add(m);
      const a = Math.random() * Math.PI * 2, s = 0.04 + Math.random() * 0.05;
      const hit = this.world.cast(new THREE.Vector3(pos.x, pos.y + 0.01, pos.z), DOWN, 3);
      this.list.push({ m, value, vel: new THREE.Vector3(Math.cos(a) * s, 0.12, Math.sin(a) * s), floor: hit ? hit.point.y + 0.0035 : pos.y, pull: false, t: 0 });
    }
  }

  clear() {
    this.list.forEach((d) => this.scene.remove(d.m));
    this.list = [];
  }

  // returns dew collected this frame
  update(dt, target, magnetMul = 1) {
    let got = 0;
    for (const d of this.list) {
      d.t += dt;
      const p = d.m.position;
      const dist = p.distanceTo(target);
      if (d.pull || dist < MAGNET * magnetMul || this.magnetAll) d.pull = true;
      if (d.pull) {
        const sp = 0.25 + d.t * 0.4 + (this.magnetAll ? 1 : 0);
        p.addScaledVector(this._to.copy(target).sub(p).normalize(), Math.min(dist, sp * dt));
        if (dist < 0.012) { got += d.value; d.done = true; this.scene.remove(d.m); }
      } else {
        // pop out, fall, settle
        d.vel.y -= 1.2 * dt;
        p.addScaledVector(d.vel, dt);
        if (p.y <= d.floor) { p.y = d.floor; d.vel.set(0, 0, 0); }
        d.m.scale.setScalar(1 + Math.sin(d.t * 5) * 0.08);
      }
    }
    if (got || this.list.some((d) => d.done)) this.list = this.list.filter((d) => !d.done);
    this.magnetAll = false;
    return got;
  }
}

// ---------------------------------------------------------------- moon drop
export class MoonDrop {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.glow = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff0c0, emissiveIntensity: 3, roughness: 0.2 });
    this.orb = new THREE.Mesh(new THREE.SphereGeometry(0.008, 24, 16), this.glow);
    this.orb.scale.y = 1.25;
    this.group.add(this.orb);
    this.halo = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.group.add(this.halo);
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.012, 1.4, 12, 1, true).translate(0, 0.7, 0),
      new THREE.MeshBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    this.group.add(this.beam);
    this.spot = null;
    this.t = 0;
  }

  // full: the last drop of the stage (summons the boss), bigger and warmer
  show(spot, surfaceY, full = false) {
    this.spot = spot;
    this.full = full;
    this.glow.emissive.setHex(full ? 0xffb060 : 0xfff0c0);
    this.halo.material.color.setHex(full ? 0xffb060 : 0xfff0c0);
    this.base = new THREE.Vector3(spot.at[0], surfaceY + 0.018, spot.at[2]);
    this.group.position.copy(this.base);
    this.group.visible = true;
    this.t = 0;
  }

  hide() { this.group.visible = false; this.spot = null; }
  get active() { return this.group.visible; }
  get position() { return this.group.position; }

  update(dt) {
    if (!this.group.visible) return;
    this.t += dt;
    this.group.position.y = this.base.y + Math.sin(this.t * 2.2) * 0.004;
    this.orb.rotation.y += dt;
    const s = Math.min(1, this.t * 3) * (this.full ? 1.6 : 1);
    this.group.scale.setScalar(s);
    this.halo.scale.setScalar(1 + Math.sin(this.t * 4) * 0.15);
  }
}

// ---------------------------------------------------------------- lost things up high
// Little gift boxes on high spots that take some climbing to reach. A gold beam shows where
// each one is from across the room; touch one to pick a treasure.
export class LostThings {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.boxGeo = new THREE.BoxGeometry(0.02, 0.016, 0.02);
    this.boxMat = new THREE.MeshStandardMaterial({ color: 0xd8344a, roughness: 0.4, emissive: 0x5a0a14, emissiveIntensity: 0.6 });
    this.ribbonMat = new THREE.MeshStandardMaterial({ color: 0xffd23a, roughness: 0.3, metalness: 0.5, emissive: 0x8a6a10, emissiveIntensity: 0.8 });
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0xffd86a, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.beamGeo = new THREE.CylinderGeometry(0.006, 0.014, 0.8, 12, 1, true).translate(0, 0.4, 0);
  }

  place(spots) {
    this.clear();
    for (const s of spots) {
      const g = new THREE.Group();
      g.position.set(...s.at);
      const box = new THREE.Group();
      box.position.y = 0.008;
      box.add(new THREE.Mesh(this.boxGeo, this.boxMat));
      for (const [w, d] of [[0.022, 0.005], [0.005, 0.022]]) box.add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.017, d), this.ribbonMat));
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.004, 0.0015, 6, 12), this.ribbonMat);
      bow.position.y = 0.01;
      box.add(bow);
      box.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.add(box, new THREE.Mesh(this.beamGeo, this.beamMat));
      this.scene.add(g);
      this.list.push({ g, box, pos: g.position, label: s.label, taken: false, phase: Math.random() * 6 });
    }
  }

  clear() { this.list.forEach((s) => this.scene.remove(s.g)); this.list = []; }

  // returns the spot the player just touched, if any
  update(dt, t, feet) {
    let got = null;
    for (const s of this.list) {
      if (s.taken) continue;
      s.box.rotation.y += dt;
      s.box.position.y = 0.008 + Math.abs(Math.sin(t * 2 + s.phase)) * 0.004;
      if (!got && s.pos.distanceTo(feet) < 0.035) { got = s; s.taken = true; this.scene.remove(s.g); }
    }
    return got;
  }
}
