// Things you collect: XP and treasures (each waiting in the room as a golden chest).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { batcher } from './batch.js';
import { LOOK } from './look.js';
import { sfx } from './sfx.js';
import { juice } from './juice.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const MAGNET = 0.09;          // meters: XP drifts to you from this far
const BIG = 5;                // XP a big drop is worth: every 5 XP comes as one big drop, easier to read

// double-terminated hexagonal crystal (24 tris, flat-shaded, still 1 instanced draw via Batcher)
function hexCrystalGeo(r, hScale) {
  const h = r * hScale;
  const pts = [[0, -h], [r, -h * 0.36], [r, h * 0.36], [0, h]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(pts, 6);
  geo.parameters.radius = r;
  return geo;
}

// plump beveled heart for Health crumbs (still 1 instanced draw via Batcher)
function heartCrumbGeo(r) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.85);
  s.bezierCurveTo(-0.55, -0.45, -1.05, 0.1, -0.95, 0.55);
  s.bezierCurveTo(-0.85, 0.98, -0.25, 1.0, 0, 0.52);
  s.bezierCurveTo(0.25, 1.0, 0.85, 0.98, 0.95, 0.55);
  s.bezierCurveTo(1.05, 0.1, 0.55, -0.45, 0, -0.85);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.24, bevelSize: 0.18, bevelSegments: 2, curveSegments: 6 });
  geo.center();
  geo.scale(r, r, r);
  return geo;
}

// ---------------------------------------------------------------- XP
// Health crumbs (the crumb-on-kill word) are the same pickups in another colour: `look` picks it
export class XpDrops {
  constructor(scene, world, look = null, life = 0) {   // life (s): a drop not picked up by then is gone (leave-on-kill)
    this.scene = scene;
    this.world = world;
    this.life = life;
    this.list = [];
    this.r = look ? 0.0035 : LOOK.num('xp-size', 0.007);   // XP crystals are set in look.css; Health crumbs and leave-on-kill drops stay small
    const gem = (r) => hexCrystalGeo(r * LOOK.num('xp-gem-scale', 1.25), LOOK.num('xp-gem-height', 1.35));
    this.geo = look ? heartCrumbGeo(this.r) : gem(this.r);
    this.mat = look
      ? new THREE.MeshStandardMaterial({ color: LOOK.color(look, '#ffb47a'), emissive: LOOK.color(look, '#ffb47a'), emissiveIntensity: 0.35, roughness: 0.5 })
      : new THREE.MeshStandardMaterial({ color: LOOK.color('xp-color', '#ffd25a'), emissive: LOOK.color('xp-glow', '#e8a21b'), emissiveIntensity: 0.5, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.9, flatShading: true });
    // a big drop (worth BIG): about twice as wide and brighter, so a 5-XP drop reads as one thing
    this.bigGeo = gem(this.r * 1.9);
    this.bigMat = new THREE.MeshStandardMaterial({ color: LOOK.color('xp-big-color', '#ffe27a'), emissive: LOOK.color('xp-big-glow', '#ffc43a'), emissiveIntensity: 0.9, roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.95, flatShading: true });
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
      this.list.push({ m, pos: pos.clone(), value: worth, big, vel: new THREE.Vector3(Math.cos(a) * s, 0.12, Math.sin(a) * s), floor: hit ? hit.point.y + this.r * (big ? 1.9 : 1) : pos.y, pull: false, pullT: 0, t: 0, spin: Math.random() * 6.28 });
    }
  }

  // one big drop worth `value` (Jackpot), drawn half again as big; false if none could be made
  gem(pos, value) {
    const n = this.list.length;
    this.drop(pos, BIG);
    const d = this.list.length > n ? this.list[n] : null;
    if (d) { d.value = value; d.k = 1.6; }
    return !!d;   // false: too many on the floor, it folded into another
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
          d.m.scale.set(1 / Math.sqrt(1 + stretch), 1 + stretch, 1 / Math.sqrt(1 + stretch)).multiplyScalar(d.k || 1);
        } else d.m.scale.setScalar(d.k || 1);
      } else {
        if (this.life && d.t > this.life) { d.done = true; this.scene.remove(d.m); continue; }
        // pop out, fall, settle
        d.vel.y -= 1.2 * dt;
        p.addScaledVector(d.vel, dt);
        if (p.y <= d.floor) { p.y = d.floor; d.vel.set(0, 0, 0); }
        if (this.xpLook && !quiet) d.m.rotation.y = d.t * LOOK.num('xp-spin', 2.2) + d.spin;   // the crystal turns slowly while it waits
        d.m.scale.setScalar((d.k || 1) * (1 + Math.sin(d.t * 5) * 0.08));
        d.m.position.copy(p);
      }
    }
    if (got || this.life || this.list.some((d) => d.done)) this.list = this.list.filter((d) => !d.done);
    this.magnetAll = false;
    return got;
  }
}

// ---------------------------------------------------------------- treasure
// A treasure waiting in the room, shown as a small golden chest that glows softly and twinkles.
// Touch it for a treasure pick. One that turns up on the schedule (stage.treasures) waits `stay`
// seconds, with a thin gold ring on the floor that drains as its time runs out (blinking for the last
// few seconds); one an elite drops waits for good (stay = Infinity, no ring).
// The chest's materials and shapes are shared by every chest, so a second one needs no new shaders.
// Contents are unknown until opening: both sources use a neutral gold glow, ring and burst.
let CHEST = null;
function paintChest(geo, hex) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

function chestParts(fx) {
  if (CHEST) return CHEST;
  const gold = new THREE.Color(0xffc93a);
  // Single vertex-coloured material for both base and lid (cuts 8 draws/chest -> 2)
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, emissive: 0xffb830, emissiveIntensity: 0.42, roughness: 0.28, metalness: 0.65, toneMapped: false });
  const G = 0xffc83e, TRIM = 0x8a5010, DARK = 0x3b1f05, BRIGHT = 0xfff098;
  // Base: hollow walls so popping the lid reveals a glowing mound of coins, plus brass straps, corner brackets, rivets, side ring handles & keyhole lock
  const baseParts = [
    paintChest(new THREE.BoxGeometry(0.036, 0.005, 0.024).translate(0, 0.0025, 0), G),
    paintChest(new THREE.BoxGeometry(0.036, 0.013, 0.003).translate(0, 0.0115, 0.0105), G),
    paintChest(new THREE.BoxGeometry(0.036, 0.013, 0.003).translate(0, 0.0115, -0.0105), G),
    paintChest(new THREE.BoxGeometry(0.003, 0.013, 0.018).translate(-0.0165, 0.0115, 0), G),
    paintChest(new THREE.BoxGeometry(0.003, 0.013, 0.018).translate(0.0165, 0.0115, 0), G),
    paintChest(new THREE.BoxGeometry(0.031, 0.004, 0.019).translate(0, 0.007, 0), DARK),       // dark inner lining
    paintChest(new THREE.SphereGeometry(0.012, 10, 6).scale(1.1, 0.45, 0.68).translate(0, 0.0115, 0), BRIGHT),   // glowing gold mound inside
    paintChest(new THREE.BoxGeometry(0.0368, 0.0018, 0.0248).translate(0, 0.0178, 0), DARK),   // lid seam
    paintChest(new THREE.BoxGeometry(0.0085, 0.0095, 0.003).translate(0, 0.0155, 0.0126), TRIM),  // lock plate
    paintChest(new THREE.BoxGeometry(0.002, 0.0038, 0.0015).translate(0, 0.0148, 0.014), DARK),   // keyhole
  ];
  for (const x of [-0.012, 0.012]) {
    baseParts.push(paintChest(new THREE.BoxGeometry(0.0042, 0.0182, 0.025).translate(x, 0.0091, 0), TRIM));
    for (const z of [-0.0128, 0.0128]) for (const y of [0.004, 0.013])
      baseParts.push(paintChest(new THREE.BoxGeometry(0.0016, 0.0016, 0.0012).translate(x, y, z), BRIGHT));
  }
  for (const s of [-1, 1]) {
    baseParts.push(paintChest(new THREE.TorusGeometry(0.0032, 0.0009, 6, 12).rotateY(Math.PI / 2).translate(s * 0.0188, 0.0105, 0), TRIM));
  }
  // Lid (local to lidPivot at y=0.018, z=-0.012, so offset +0.012 in z)
  const lidParts = [
    paintChest(new THREE.CylinderGeometry(0.012, 0.012, 0.036, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(0, 0, 0.012), G),
    paintChest(new THREE.BoxGeometry(0.006, 0.0045, 0.0026).translate(0, 0.001, 0.0245), TRIM),   // front clasp tongue
  ];
  for (const x of [-0.012, 0.012]) {
    lidParts.push(paintChest(new THREE.CylinderGeometry(0.0124, 0.0124, 0.0042, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(x, 0, 0.012), TRIM));
  }
  CHEST = {
    gold,
    mat,
    baseGeo: mergeGeometries(baseParts),
    lidGeo: mergeGeometries(lidParts),
    ringMat: new THREE.MeshBasicMaterial({ color: gold, transparent: true, depthWrite: false, toneMapped: false }),
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
    this.chest.add(new THREE.Mesh(C.baseGeo, C.mat));
    // the lid and its bands ride on a hinge at the back edge, so opening can pop it
    this.lidPivot = new THREE.Group();
    this.lidPivot.position.set(0, 0.018, -0.012);
    this.lidPivot.add(new THREE.Mesh(C.lidGeo, C.mat));
    this.chest.add(this.lidPivot);
    this.chest.scale.setScalar(1.5);
    // each chest's own timer: a thin gold arc that drains (its own geometry, so its draw range is its own).
    // Plain on purpose: the filled, flowing circle (vfx.js TeleMaterial) belongs to danger Warnings only
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), C.ringMat.clone());
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
  // at: { at: [x, y, z], y, label } (a spot) or a Vector3; stay: seconds, or Infinity
  show(at, stay = Infinity, facing = 0) {
    this.spot = at.isVector3 ? null : at;
    this.stay = stay;
    this.left = stay;
    this.active = true;
    this.tierColor = this.gold;   // unknown contents: the glow promises no minimum rarity
    this.ring.material.color.copy(this.tierColor);
    this.ring.geometry.setDrawRange(0, Infinity);
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
    if (this.timed) { this.ring.geometry.setDrawRange(0, Math.ceil(48 * Math.max(0, this.left / this.stay)) * 6); this.ring.material.opacity = blink; }   // 6 indices per segment
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
    const flat = Math.hypot(feet.x - p.x, feet.z - p.z), up = feet.y - p.y, G = LOOK.num('chest-grab', 0.085);   // a wide hitbox: far wider than the chest, so a swim past or a rush under Warnings still takes it
    if (_v.copy(p).setY(p.y + 0.015).distanceTo(feet) < G || p.distanceTo(feet) < G * 0.9 || (flat < G * 0.9 && up > -0.02 && up < 0.12)) {
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
