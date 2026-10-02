// Things you collect: dew (XP) and golden gifts.
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

// ---------------------------------------------------------------- golden gift
// A treasure that turns up on a schedule (stage.gifts) somewhere in the room and waits `stay`
// seconds: a bright gold gift box under a tall beam of light, with a ring on the floor that
// drains as its time runs out (it blinks for the last few seconds). Touch it for a treasure pick.
export class GoldGift {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.gold = new THREE.Color(0xffc93a);
    const lit = (c, k) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.25, metalness: 0.6, toneMapped: false });
    this.g = new THREE.Group();
    this.box = new THREE.Group();
    // deep gold that glows without blowing out to white, under paler ribbons
    this.box.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.024, 0.03), lit(0xff9a00, 0.85)));
    const ribbon = lit(0xffe08a, 1.1);
    for (const [w, d] of [[0.032, 0.007], [0.007, 0.032]]) this.box.add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, d), ribbon));
    for (const s of [-1, 1]) {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.0055, 0.0018, 8, 16), ribbon);
      loop.position.set(s * 0.005, 0.015, 0);
      loop.rotation.set(0, Math.PI / 2, s * 0.6);
      this.box.add(loop);
    }
    this.box.scale.setScalar(1.4);
    this.box.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    // a tall column of gold light, so you can spot it from across the room
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 1.6, 16, 1, true).translate(0, 0.8, 0),
      new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
    // the countdown on the floor: full when it appears, draining to nothing as it's about to go
    this.ring = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), fx.tele(this.gold, 'circle'));
    this.ring.material.uniforms.uFlow.value = -1;   // its stripes run outward: something good, not an incoming hit
    this.ring.scale.setScalar(0.055);
    this.ring.position.y = 0.002;
    this.ring.renderOrder = 3;
    this.g.add(this.box, this.beam, this.ring);
    this.g.visible = false;
    scene.add(this.g);
    this.active = false;
    this.spot = null;
    this.sparkT = 0;
  }

  get pos() { return this.g.position; }

  show(spot, stay) {
    this.spot = spot;
    this.stay = stay;
    this.left = stay;
    this.active = true;
    this.g.position.set(spot.at[0], spot.y, spot.at[2]);
    this.g.visible = true;
    this.g.updateMatrixWorld(true);
    this.fx.impact(this.g.position.clone().setY(spot.y + 0.02), this.gold, 0.04, 16);
  }

  hide() { this.active = false; this.g.visible = false; }

  // 'taken', 'gone' (time ran out) or null
  update(dt, t, feet) {
    if (!this.active) return null;
    this.left -= dt;
    const p = this.g.position;
    this.box.rotation.y += dt * 1.5;
    this.box.position.y = 0.014 + Math.abs(Math.sin(t * 2.5)) * 0.006;
    const k = Math.max(0, this.left / this.stay);
    this.ring.material.progress = k;
    // blink for the last 4 seconds, faster as it goes
    const blink = this.left < 4 ? (Math.sin(t * (10 + (4 - this.left) * 6)) > 0 ? 1 : 0.25) : 1;
    this.beam.material.opacity = 0.4 * blink;
    this.ring.material.opacity = blink;
    // a warm halo, and sparkles rising up the beam
    this.fx.glow.hold(_v.copy(p).setY(p.y + 0.02), this.gold, 0.16 * (0.6 + 0.4 * blink), 0.9);
    if ((this.sparkT -= dt) <= 0) {
      this.sparkT = 0.06;
      _w.set((Math.random() - 0.5) * 0.04, 0.05 + Math.random() * 0.12, (Math.random() - 0.5) * 0.04);
      this.fx.glow.emit(_v.copy(p).setY(p.y + 0.02), this.gold, 0.012, 0.002, 0.9, 0.9, _w, -0.05);
    }
    if (_v.copy(p).setY(p.y + 0.015).distanceTo(feet) < 0.045 || p.distanceTo(feet) < 0.04) {
      this.fx.impact(_v.copy(p).setY(p.y + 0.02), this.gold, 0.05, 24);
      this.hide();
      return 'taken';
    }
    if (this.left <= 0) {
      this.fx.puff(_v.copy(p).setY(p.y + 0.015), 0xffe7a0, 0.04, 0.5);
      this.hide();
      return 'gone';
    }
    return null;
  }
}
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
