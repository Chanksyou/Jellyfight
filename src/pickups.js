// Things you collect: XP and treasures (each waiting in the room as a golden chest).
import * as THREE from 'three';
import { batcher } from './batch.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const MAGNET = 0.09;          // meters: XP drifts to you from this far
const BIG = 5;                // XP a big drop is worth: every 5 XP comes as one big drop, easier to read

// ---------------------------------------------------------------- XP
export class XpDrops {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.geo = new THREE.SphereGeometry(0.0035, 12, 8);
    this.mat = new THREE.MeshStandardMaterial({ color: 0x9fe2ff, emissive: 0x3aa8ff, emissiveIntensity: 0.5, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.9 });
    // a big drop (worth BIG): about twice as wide and brighter, so a 5-XP drop reads as one thing
    this.bigGeo = new THREE.SphereGeometry(0.0035 * 1.9, 16, 12);
    this.bigMat = new THREE.MeshStandardMaterial({ color: 0xc8f0ff, emissive: 0x5ac8ff, emissiveIntensity: 0.9, roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.95 });
    this.magnetAll = false;
    this._to = new THREE.Vector3();
  }

  // `count` drops worth `value` each, paid out as big drops (worth BIG each) and small ones for the rest
  drop(pos, value, count = 1) {
    const total = value * count, bigs = Math.floor(total / BIG), smalls = total - bigs * BIG;
    for (let i = 0; i < bigs + smalls; i++) {
      const big = i < bigs, worth = big ? BIG : 1;
      if (this.list.length >= 220) {           // too many: fold into the nearest one
        const n = this.list.reduce((a, d) => (!a || d.m.position.distanceToSquared(pos) < a.m.position.distanceToSquared(pos) ? d : a), null);
        n.value += worth;
        continue;
      }
      const m = batcher.track(new THREE.Mesh(big ? this.bigGeo : this.geo, big ? this.bigMat : this.mat));   // drawn instanced (batch.js)
      m.position.copy(pos);
      this.scene.add(m);
      const a = Math.random() * Math.PI * 2, s = 0.04 + Math.random() * 0.05;
      const hit = this.world.cast(new THREE.Vector3(pos.x, pos.y + 0.01, pos.z), DOWN, 3);
      this.list.push({ m, value: worth, big, vel: new THREE.Vector3(Math.cos(a) * s, 0.12, Math.sin(a) * s), floor: hit ? hit.point.y + 0.0035 * (big ? 1.9 : 1) : pos.y, pull: false, t: 0 });
    }
  }

  clear() {
    this.list.forEach((d) => this.scene.remove(d.m));
    this.list = [];
  }

  // returns XP collected this frame
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

// ---------------------------------------------------------------- treasure
// A treasure waiting in the room, shown as a small golden chest that glows softly and twinkles.
// Touch it for a treasure pick. One that turns up on the schedule (stage.treasures) waits `stay`
// seconds, with a gold ring on the floor that drains as its time runs out (blinking for the last
// few seconds); one an elite drops waits for good (stay = Infinity, no ring).
// The chest's materials and shapes are shared by every chest, so a second one needs no new shaders.
let CHEST = null;
function chestParts(fx) {
  if (CHEST) return CHEST;
  const lit = (c, k, metal = 0.6) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.3, metalness: metal, toneMapped: false });
  const gold = new THREE.Color(0xffc93a);
  CHEST = {
    gold,
    body: lit(0xf0a018, 0.7),                  // deep gold that glows without blowing out to white
    trim: lit(0xffe08a, 1.0),                  // paler bands, rim and lock
    dark: lit(0x5a3208, 0.25, 0.3),            // the seam under the lid
    box: new THREE.BoxGeometry(0.036, 0.018, 0.024),
    lid: new THREE.CylinderGeometry(0.012, 0.012, 0.036, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2),
    band: new THREE.BoxGeometry(0.004, 0.0185, 0.0248),
    lidBand: new THREE.CylinderGeometry(0.0124, 0.0124, 0.004, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2),
    seam: new THREE.BoxGeometry(0.0365, 0.0015, 0.0245),
    lock: new THREE.BoxGeometry(0.007, 0.008, 0.002),
    ring: new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
  };
  return CHEST;
}

export class RoomTreasure {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    const C = chestParts(fx);
    this.gold = C.gold;
    this.g = new THREE.Group();
    this.chest = new THREE.Group();
    const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); this.chest.add(m); return m; };
    add(C.box, C.body, 0, 0.009, 0);
    add(C.lid, C.body, 0, 0.018, 0);
    add(C.seam, C.dark, 0, 0.018, 0);
    for (const x of [-0.012, 0.012]) { add(C.band, C.trim, x, 0.009, 0); add(C.lidBand, C.trim, x, 0.018, 0); }
    add(C.lock, C.trim, 0, 0.016, 0.0125);
    this.chest.scale.setScalar(1.25);
    this.ring = new THREE.Mesh(C.ring, fx.tele(this.gold, 'circle'));   // each chest's own timer (same shader)
    this.ring.material.uniforms.uFlow.value = -1;   // its stripes run outward: something good, not an incoming hit
    this.ring.scale.setScalar(0.055);
    this.ring.position.y = 0.002;
    this.ring.renderOrder = 3;
    this.g.add(this.chest, this.ring);
    this.g.visible = false;
    scene.add(this.g);
    this.active = false;
    this.spot = null;
    this.sparkT = 0;
  }

  get pos() { return this.g.position; }
  get timed() { return Number.isFinite(this.stay); }

  // at: { at: [x, y, z], y, label } (a spot) or a Vector3; stay: seconds, or Infinity
  show(at, stay = Infinity, facing = 0) {
    this.spot = at.isVector3 ? null : at;
    this.stay = stay;
    this.left = stay;
    this.active = true;
    if (at.isVector3) this.g.position.copy(at); else this.g.position.set(at.at[0], at.y, at.at[2]);
    this.chest.rotation.y = facing;
    this.ring.visible = this.timed;
    this.g.visible = true;
    this.g.updateMatrixWorld(true);
    this.fx.impact(_v.copy(this.g.position).setY(this.g.position.y + 0.02), this.gold, 0.04, 16);
  }

  hide() { this.active = false; this.g.visible = false; }

  // 'taken', 'gone' (its time ran out) or null
  update(dt, t, feet) {
    if (!this.active) return null;
    this.left -= dt;
    const p = this.g.position;
    // blink for the last 4 seconds, faster as it goes
    const blink = this.timed && this.left < 4 ? (Math.sin(t * (10 + (4 - this.left) * 6)) > 0 ? 1 : 0.25) : 1;
    if (this.timed) { this.ring.material.progress = Math.max(0, this.left / this.stay); this.ring.material.opacity = blink; }
    // a soft gold glow that breathes, and a twinkle now and then on the chest
    const breathe = 0.75 + 0.25 * Math.sin(t * 2.2);
    this.fx.glow.hold(_v.copy(p).setY(p.y + 0.018), this.gold, 0.09 * breathe * (0.6 + 0.4 * blink), 0.9);
    if ((this.sparkT -= dt) <= 0) {
      this.sparkT = 0.18 + Math.random() * 0.2;
      _w.set((Math.random() - 0.5) * 0.008, 0.01 + Math.random() * 0.012, (Math.random() - 0.5) * 0.008);
      this.fx.glow.emit(_v.set(p.x + (Math.random() - 0.5) * 0.04, p.y + 0.012 + Math.random() * 0.02, p.z + (Math.random() - 0.5) * 0.03), this.gold, 0.007, 0.001, 0.5, 1, _w, -0.02);
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
