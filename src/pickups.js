// Things you collect: XP and treasures (each waiting in the room as a golden chest).
import * as THREE from 'three';
import { batcher } from './batch.js';
import { LOOK } from './look.js';
import { TREASURE_RARITY } from './stats.js';
import { sfx } from './sfx.js';
import { juice } from './juice.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const MAGNET = 0.09;          // meters: XP drifts to you from this far
const BIG = 5;                // XP a big drop is worth: every 5 XP comes as one big drop, easier to read

// ---------------------------------------------------------------- XP
// Health crumbs (the crumb-on-kill word) are the same pickups in another colour: `look` picks it
export class XpDrops {
  constructor(scene, world, look = null) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.geo = new THREE.SphereGeometry(0.0035, 12, 8);
    this.mat = look
      ? new THREE.MeshStandardMaterial({ color: LOOK.color(look, '#ffb47a'), emissive: LOOK.color(look, '#ffb47a'), emissiveIntensity: 0.35, roughness: 0.6 })
      : new THREE.MeshStandardMaterial({ color: LOOK.color('xp-color', '#ffd25a'), emissive: LOOK.color('xp-glow', '#e8a21b'), emissiveIntensity: 0.5, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.9 });
    // a big drop (worth BIG): about twice as wide and brighter, so a 5-XP drop reads as one thing
    this.bigGeo = new THREE.SphereGeometry(0.0035 * 1.9, 16, 12);
    this.bigMat = new THREE.MeshStandardMaterial({ color: LOOK.color('xp-big-color', '#ffe27a'), emissive: LOOK.color('xp-big-glow', '#ffc43a'), emissiveIntensity: 0.9, roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.95 });
    this.magnetAll = false;
    this._to = new THREE.Vector3();
    this.xpLook = !look;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  }

  // `count` drops worth `value` each, paid out as big drops (worth BIG each) and small ones for the rest
  drop(pos, value, count = 1) {
    const total = value * count, bigs = Math.floor(total / BIG), smalls = total - bigs * BIG;
    for (let i = 0; i < bigs + smalls; i++) {
      const big = i < bigs, worth = big ? BIG : 1;
      if (this.list.length >= 220) {           // too many: fold into the nearest one
        const n = this.list.reduce((a, d) => (!a || d.pos.distanceToSquared(pos) < a.pos.distanceToSquared(pos) ? d : a), null);
        n.value += worth;
        continue;
      }
      const m = batcher.track(new THREE.Mesh(big ? this.bigGeo : this.geo, big ? this.bigMat : this.mat));   // drawn instanced (batch.js)
      m.position.copy(pos);
      this.scene.add(m);
      const a = Math.random() * Math.PI * 2, s = 0.04 + Math.random() * 0.05;
      const hit = this.world.cast(new THREE.Vector3(pos.x, pos.y + 0.01, pos.z), DOWN, 3);
      this.list.push({ m, pos: pos.clone(), value: worth, big, vel: new THREE.Vector3(Math.cos(a) * s, 0.12, Math.sin(a) * s), floor: hit ? hit.point.y + 0.0035 * (big ? 1.9 : 1) : pos.y, pull: false, pullT: 0, t: 0 });
    }
  }

  clear() {
    this.list.forEach((d) => this.scene.remove(d.m));
    this.list = [];
  }

  // returns XP collected this frame
  update(dt, target, magnetMul = 1) {
    let got = 0;
    const quiet = juice.calm || this.reducedMotion.matches;
    for (const d of this.list) {
      d.t += dt;
      const p = d.pos;
      const dist = p.distanceTo(target);
      if (d.pull || dist < MAGNET * magnetMul || this.magnetAll) d.pull = true;
      if (d.pull) {
        d.pullT += dt;
        const sp = 0.25 + d.t * 0.4 + (this.magnetAll ? 1 : 0);
        p.addScaledVector(this._to.copy(target).sub(p).normalize(), Math.min(dist, sp * dt));
        if (dist < 0.012) { got += d.value; d.done = true; this.scene.remove(d.m); }
        // The bend and stretch are cosmetic; magnet range, speed and collection stay unchanged.
        d.m.position.copy(p);
        if (this.xpLook && !quiet) {
          const bend = Math.sin(d.pullT * Math.PI / 0.18) * Math.max(0, 1 - d.pullT / 0.18) * Math.min(1, dist / 0.04) * LOOK.num('xp-pull-bend', 0.008);
          d.m.position.x += this._to.z * bend; d.m.position.z -= this._to.x * bend;
          d.m.quaternion.setFromUnitVectors(UP, this._to);
          const stretch = LOOK.num('xp-pull-stretch', 0.8) * Math.min(1, d.pullT / 0.08);
          d.m.scale.set(1 / Math.sqrt(1 + stretch), 1 + stretch, 1 / Math.sqrt(1 + stretch));
        } else d.m.scale.setScalar(1);
      } else {
        // pop out, fall, settle
        d.vel.y -= 1.2 * dt;
        p.addScaledVector(d.vel, dt);
        if (p.y <= d.floor) { p.y = d.floor; d.vel.set(0, 0, 0); }
        d.m.scale.setScalar(1 + Math.sin(d.t * 5) * 0.08);
        d.m.position.copy(p);
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
// A chest's light tells the best rarity its pick holds (the TREASURE_RARITY colours): a room
// chest's pick holds a Rare, an Elite's an Epic — and the pick keeps the promise (run.js
// pickTreasure). The chest itself stays gold; only its glow, ring and burst change colour.
const TIER_COLOR = Object.fromEntries(TREASURE_RARITY.map((r) => [r.id, new THREE.Color(r.color)]));
let CHEST = null;
function chestParts(fx) {
  if (CHEST) return CHEST;
  const lit = (c, k, metal = 0.6) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.3, metalness: metal, toneMapped: false });
  const gold = new THREE.Color(0xffc93a);
  CHEST = {
    gold,
    body: lit(0xffc23a, 1.05),                 // bright gold that glows without blowing out to white
    trim: lit(0x9a5a10, 0.45, 0.8),            // dark brass straps and lock, so it reads as a chest
    dark: lit(0x5a3208, 0.25, 0.3),            // the seam under the lid
    box: new THREE.BoxGeometry(0.036, 0.018, 0.024),
    lid: new THREE.CylinderGeometry(0.0122, 0.0122, 0.0362, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2),   // a half-round lid along x, domed up
    band: new THREE.BoxGeometry(0.004, 0.0185, 0.0248),
    lidBand: new THREE.CylinderGeometry(0.0124, 0.0124, 0.004, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2),   // a half-round lid along x, domed up
    seam: new THREE.BoxGeometry(0.0365, 0.0015, 0.0245),
    lock: new THREE.BoxGeometry(0.008, 0.009, 0.003),
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
    // the lid and its bands ride on a hinge at the back edge, so opening can pop it
    this.lidPivot = new THREE.Group();
    this.lidPivot.position.set(0, 0.018, -0.012);
    this.chest.add(this.lidPivot);
    const addLid = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z + 0.012); this.lidPivot.add(m); return m; };
    add(C.box, C.body, 0, 0.009, 0);
    addLid(C.lid, C.body);
    add(C.seam, C.dark, 0, 0.018, 0);
    for (const x of [-0.012, 0.012]) { add(C.band, C.trim, x, 0.009, 0); addLid(C.lidBand, C.trim, x); }
    add(C.lock, C.trim, 0, 0.016, 0.0125);
    this.chest.scale.setScalar(1.5);
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
    this.opening = null;          // seconds into the open sequence, once touched
    this.snapped = false;
    this.tierColor = C.gold;
  }

  get pos() { return this.g.position; }
  get timed() { return Number.isFinite(this.stay); }
  // the best rarity this chest's pick holds: a timed (room) chest's pick holds a Rare,
  // one an Elite left (it waits for good) holds an Epic (run.js PICK_TIERS)
  get tier() { return this.timed ? 'rare' : 'epic'; }

  // at: { at: [x, y, z], y, label } (a spot) or a Vector3; stay: seconds, or Infinity
  show(at, stay = Infinity, facing = 0) {
    this.spot = at.isVector3 ? null : at;
    this.stay = stay;
    this.left = stay;
    this.active = true;
    this.tierColor = TIER_COLOR[this.tier];
    this.ring.material.uniforms.uColor.value.copy(this.tierColor);
    this.opening = null;
    this.lidPivot.rotation.x = 0;
    this.chest.scale.setScalar(1.5);
    this.chest.position.set(0, 0, 0);
    if (at.isVector3) this.g.position.copy(at); else this.g.position.set(at.at[0], at.y, at.at[2]);
    this.chest.rotation.y = facing;
    this.ring.visible = this.timed;
    this.g.visible = true;
    this.g.updateMatrixWorld(true);
    this.fx.impact(_v.copy(this.g.position).setY(this.g.position.y + 0.02), this.tierColor, 0.04, 16);
  }

  hide() {
    this.active = false;
    this.g.visible = false;
    this.opening = null;
    this.lidPivot.rotation.x = 0;
    this.chest.scale.setScalar(1.5);
    this.chest.position.set(0, 0, 0);
  }

  // 'taken', 'gone' (its time ran out) or null
  update(dt, t, feet) {
    if (!this.active) return null;
    const p = this.g.position;
    if (this.opening !== null) return this.stepOpening(dt);
    this.left -= dt;
    // blink for the last 4 seconds, faster as it goes
    const blink = this.timed && this.left < 4 ? (Math.sin(t * (10 + (4 - this.left) * 6)) > 0 ? 1 : 0.25) : 1;
    if (this.timed) { this.ring.material.progress = Math.max(0, this.left / this.stay); this.ring.material.opacity = blink; }
    // a soft glow that breathes, in the chest's tier colour, and a twinkle now and then
    const breathe = 0.75 + 0.25 * Math.sin(t * 2.2);
    this.fx.glow.hold(_v.copy(p).setY(p.y + 0.018), this.tierColor, 0.09 * breathe * (0.6 + 0.4 * blink), 0.9);
    if ((this.sparkT -= dt) <= 0) {
      this.sparkT = 0.18 + Math.random() * 0.2;
      _w.set((Math.random() - 0.5) * 0.008, 0.01 + Math.random() * 0.012, (Math.random() - 0.5) * 0.008);
      this.fx.glow.emit(_v.set(p.x + (Math.random() - 0.5) * 0.04, p.y + 0.012 + Math.random() * 0.02, p.z + (Math.random() - 0.5) * 0.03), this.tierColor, 0.007, 0.001, 0.5, 1, _w, -0.02);
    }
    // touched: close to it, or right over it (standing on something beside it, up to 12 cm up).
    // Touching starts the open sequence; the pick is offered when the lid has popped (stepOpening)
    const flat = Math.hypot(feet.x - p.x, feet.z - p.z), up = feet.y - p.y;
    if (_v.copy(p).setY(p.y + 0.015).distanceTo(feet) < 0.045 || p.distanceTo(feet) < 0.04 || (flat < 0.04 && up > -0.02 && up < 0.12)) {
      this.opening = 0;
      this.snapped = false;
      sfx.chestCreak(this.timed ? 0 : 1);
      return null;
    }
    if (this.left <= 0) {
      this.fx.puff(_v.copy(p).setY(p.y + 0.015), 0xffe7a0, 0.04, 0.5);
      this.hide();
      return 'gone';
    }
    return null;
  }

  // The open itself: the chest strains first (trembling, squashing down, its glow swelling
  // in the tier colour), then the lid pops and the treasure bursts out in that colour, with
  // dust at its base and three sparks arcing out. Then a reveal beat: the chest sits open
  // and glowing before the pick is offered — without it the pick screen arrives on the
  // very frame of the pop and covers its own payoff, and nobody sees the chest open.
  // An Elite's chest builds for most of a second; a room chest is a quick snap, so a run
  // never waits on it. The timer is frozen while it opens: touching it in time was enough.
  stepOpening(dt) {
    const p = this.g.position, elite = !this.timed;
    const A = elite ? 0.45 : 0.10, S = elite ? 0.30 : 0.15, R = elite ? 0.5 : 0.35;
    this.opening += dt;
    const o = this.opening;
    if (o < A) {
      const k = o / A;
      this.chest.position.set((Math.random() - 0.5) * 0.003 * k, 0, (Math.random() - 0.5) * 0.003 * k);
      this.chest.scale.set(1.5 * (1 + 0.07 * k * k), 1.5 * (1 - 0.16 * k * k), 1.5 * (1 + 0.07 * k * k));
      this.fx.glow.hold(_v.copy(p).setY(p.y + 0.02), this.tierColor, 0.09 + 0.09 * k, 0.95);
      return null;
    }
    if (!this.snapped) {
      this.snapped = true;
      this.chest.position.set(0, 0, 0);
      sfx.chestPop(elite ? 1 : 0);
      this.fx.impact(_v.copy(p).setY(p.y + 0.02), this.tierColor, elite ? 0.07 : 0.05, elite ? 36 : 24);
      this.fx.puff(_v.copy(p).setY(p.y + 0.01), 0xd8d2c6, 0.05, 0.5);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.random() * 0.8;
        _w.set(Math.cos(a) * 0.05, 0.26, Math.sin(a) * 0.05);
        this.fx.glow.emit(_v.copy(p).setY(p.y + 0.03), this.tierColor, 0.011, 0.002, 0.6, 1, _w, 0.55);
      }
    }
    if (o < A + S) {
      const q = Math.min(1, (o - A) / S), e = 1 + 2.70158 * (q - 1) ** 3 + 1.70158 * (q - 1) ** 2;   // easeOutBack: the lid overshoots and settles
      this.lidPivot.rotation.x = -1.85 * e;
      const pop = 1 + 0.07 * (1 - q);
      this.chest.scale.set(1.5 * pop, 1.5 * pop, 1.5 * pop);
      this.fx.glow.hold(_v.copy(p).setY(p.y + 0.03), this.tierColor, (elite ? 0.17 : 0.12) * (1 - q * 0.6), 0.95);
      return null;
    }
    // the reveal beat: lid up, glow held, a spark drifting now and then — then the pick
    this.lidPivot.rotation.x = -1.85;
    this.chest.scale.setScalar(1.5);
    this.fx.glow.hold(_v.copy(p).setY(p.y + 0.03), this.tierColor, elite ? 0.15 : 0.11, 0.95);
    if ((this.sparkT -= dt) <= 0) {
      this.sparkT = 0.22 + Math.random() * 0.2;
      _w.set((Math.random() - 0.5) * 0.02, 0.05 + Math.random() * 0.03, (Math.random() - 0.5) * 0.02);
      this.fx.glow.emit(_v.copy(p).setY(p.y + 0.035), this.tierColor, 0.008, 0.001, 0.6, 1, _w, -0.01);
    }
    if (o >= A + S + R) { this.hide(); return 'taken'; }
    return null;
  }
}
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
