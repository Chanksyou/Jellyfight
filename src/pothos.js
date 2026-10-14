// The Pothos: act 3's boss, the trailing houseplant from the shelf over the bed grown huge, in its
// mossy terracotta pot on the pillows at the head of the bed. For now it's bare: the pot, a mound of
// heart-shaped leaves with a hollow at the front, and the glowing heart in that hollow. Only the
// heart can be hurt (its centre() and r are the heart's: a bubble that misses the heart misses the
// Pothos). Its attacks (Vine Whips, Cuttings, Aerial roots, the dragonflies) come later (spec #32).
// Same interface as the Vacuum and the Clog: position, r, center(), damage(), dead, rise, shielded,
// angry, update() -> {push}, dispose().
import * as THREE from 'three';
import { LOOK } from './look.js';
import { bus, PLAYER } from './events.js';
import { sfx } from './sfx.js';
import { CONTENT } from './content.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// state names are attack names (as in clog.js), taken in turn; 'idle' is the pause between them
export const ATTACKS = { calm: ['roots'], angry: ['roots'] };

const SCALE = 0.8;                       // how big it grew (the prototype's verdict: 1.5x read as too big)
const POT_H = 0.24, POT_R = 0.16, POT_RB = 0.11;   // the pot, before SCALE
const HEART = 0.055;                     // the heart's radius, before SCALE

// A pothos leaf: heart-shaped, cupped, tip drooping, cream-gold streaks over deep green. Its
// petiole is at the origin, it runs along +y to its tip (1 m: scaled per leaf) and faces +z.
function leafGeometry() {
  const g = new THREE.PlaneGeometry(1, 1, 6, 8), p = g.attributes.position, col = [];
  const deep = new THREE.Color(LOOK.color('pothos-leaf-deep', '#0f3311')), green = new THREE.Color(LOOK.color('pothos-leaf', '#1d5a1d'));
  const cream = new THREE.Color(LOOK.color('pothos-leaf-gold', '#f2dc5a')), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), t = p.getY(i) + 0.5;
    const w = 0.62 * Math.pow(Math.sin(Math.PI * Math.min(1, (t + 0.14) / 1.14)), 0.8) * (1 - 0.12 * t);
    const x = u * 2 * w, y = t - 0.16 * Math.abs(u * 2) * Math.pow(1 - t, 3), z = -0.14 * t * t + 0.1 * (u * 2) * (u * 2) * w;
    p.setXYZ(i, x, y, z);
    const streak = Math.sin(Math.atan2(x, t + 0.06) * 15 + Math.sin(t * 9 + x * 7) * 1.4) * 0.5 + 0.5;
    c.copy(green).lerp(deep, Math.abs(u * 2) * 0.55).lerp(cream, smooth(0.6, 0.95, streak) * (0.35 + 0.65 * t));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// The terracotta pot: tapered, a thick rim, moss creeping up and over the rim, dark cracks
function potGeometry(h, rb, rt) {
  const prof = [];
  for (let k = 0; k <= 12; k++) { const y = (k / 12) * h * 0.86; prof.push(new THREE.Vector2(rb + (rt - rb) * (y / (h * 0.86)), y)); }
  prof.push(new THREE.Vector2(rt * 1.08, h * 0.87), new THREE.Vector2(rt * 1.1, h), new THREE.Vector2(rt * 0.96, h), new THREE.Vector2(rt * 0.94, h * 0.9));
  const g = new THREE.LatheGeometry(prof, 40), p = g.attributes.position, col = [];
  const clay = new THREE.Color('#b8653c'), dark = new THREE.Color('#7e3f22'), moss = new THREE.Color('#58772c'), crackC = new THREE.Color('#2a1608'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i)), yn = y / h;
    const mossy = smooth(0.15, 0.6, Math.sin(a * 3 + 1.3) * 0.4 + Math.sin(a * 7 + y * 30) * 0.25 + (1 - yn) * 0.55 + (yn > 0.86 ? 0.5 : 0) - 0.15);
    const crack = Math.abs(((a * 1.6 + yn * 2.2) % 1 + 1) % 1 - 0.5) < 0.012 && yn < 0.85 ? 1 : 0;
    c.copy(clay).lerp(dark, 0.25 + 0.25 * Math.sin(a * 11 + yn * 6) ** 2).lerp(moss, mossy * 0.85).lerp(crackC, crack * 0.9);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// The heart: a lumpy glowing seed, green and gold, veined (radius 1)
function heartGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position, col = [], v = new THREE.Vector3(), c = new THREE.Color();
  const gold = new THREE.Color(LOOK.color('pothos-heart-gold', '#ffd34a')), green = new THREE.Color(LOOK.color('pothos-heart', '#7dff5a')), vein = new THREE.Color('#fffbe0');
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 5 + v.y * 3) * Math.sin(v.y * 6 - v.z * 4) * Math.sin(v.z * 5 + v.x * 2);
    v.multiplyScalar(1 + n * 0.14).multiply(V(0.85, 1.15, 0.8));
    p.setXYZ(i, v.x, v.y, v.z);
    const veined = Math.abs(Math.sin(Math.atan2(v.x, v.z) * 6 + v.y * 4)) < 0.18 ? 1 : 0;
    c.copy(gold).lerp(green, THREE.MathUtils.clamp(0.5 + n * 0.8, 0, 1)).lerp(vein, veined * 0.7);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// built once and shared by every Pothos (main.js warms one up behind Play, the fight builds another)
let PARTS = null;
function parts() {
  if (PARTS) return PARTS;
  PARTS = {
    leaf: leafGeometry(), pot: potGeometry(POT_H, POT_RB, POT_R), heart: heartGeometry(),
    dirt: new THREE.CircleGeometry(POT_R * 0.93, 24).rotateX(-Math.PI / 2),
    leafMat: new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.38, emissive: '#071405' }),
    potMat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }),
    dirtMat: new THREE.MeshStandardMaterial({ color: '#241509', roughness: 1 }),
    heartMat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: LOOK.color('pothos-heart-glow', '#2f8a14'), emissiveIntensity: 0.35 }),
  };
  return PARTS;
}

const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _s = new THREE.Vector3(), UP = V(0, 1, 0);
// a leaf's matrix: petiole at `pos`, running toward `out`, roughly facing up, rolled by `tilt`
function leafMatrix(pos, out, size, tilt) {
  _y.copy(out).normalize();
  _z.copy(UP).addScaledVector(_y, -UP.dot(_y)).normalize();
  if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1);
  _z.applyAxisAngle(_y, (tilt - 0.5) * 0.9);
  _x.crossVectors(_y, _z).normalize();
  return _m.makeBasis(_x, _y, _z).scale(_s.setScalar(size)).setPosition(pos);
}

// the plant in its own frame: the pot's base at the origin, facing -z (the foot of the bed)
function buildPothos() {
  const P = parts(), R = rng(7), root = new THREE.Group();
  const soil = POT_H * 0.9;
  root.add(new THREE.Mesh(P.pot, P.potMat));
  const dirt = new THREE.Mesh(P.dirt, P.dirtMat);
  dirt.position.y = soil;
  root.add(dirt);
  const heart = new THREE.Mesh(P.heart, P.heartMat);
  heart.position.set(0, soil + 0.12, -0.13);
  heart.scale.setScalar(HEART);
  root.add(heart);
  // a mound of leaves over the pot (one draw for all of them), a hollow at the front for the heart
  const leaves = [];
  for (let k = 0; k < 140 && leaves.length < 110; k++) {
    const u = R(), w = R() * Math.PI * 2, el = Math.acos(1 - u * 0.95);
    const dir = V(Math.sin(el) * Math.cos(w), Math.cos(el), Math.sin(el) * Math.sin(w));
    if (dir.z < -0.55 && dir.y < 0.75 && Math.abs(dir.x) < 0.5) continue;
    leaves.push({ pos: V(0, soil + 0.06, 0).addScaledVector(dir, 0.1 + R() * 0.12), out: dir.clone().setY(dir.y * 0.6 + 0.2).normalize(), size: 0.09 + R() * 0.06, tilt: R() });
  }
  const mound = new THREE.InstancedMesh(P.leaf, P.leafMat, leaves.length);
  leaves.forEach((L, i) => mound.setMatrixAt(i, leafMatrix(L.pos, L.out, L.size, L.tilt)));
  mound.instanceMatrix.needsUpdate = true;
  mound.computeBoundingSphere();
  root.add(mound);
  return { root, heart, mound };
}

export class Pothos {
  // arena: the stage's boss block (stage3.js): `pot` is where the pot stands, on the pillows
  constructor(scene, enemies, fx, arena, world) {
    Object.assign(this, { scene, enemies, fx, arena, world });
    this.kind = 'pothos';
    this.r = HEART * SCALE * 1.1;        // what bubbles must touch: the heart
    this.def = CONTENT.bosses.pothos;    // its numbers (content/bosses.kdl), read fresh so the Tuner's edits land mid-fight
    this.maxHp = this.hp = this.def.hp;
    this.dead = false;
    this.t = 0;
    this.rise = 0;
    this.state = 'idle';
    this.stateT = 3;                     // the first attack comes a moment after it rises
    this.next = 0;
    this.guards = [];
    this.wither = 0;
    this.glowColor = new THREE.Color(LOOK.color('pothos-heart-halo', '#5ee83a'));
    this.model = buildPothos();
    this.holder = new THREE.Group();
    this.holder.position.set(...arena.pot);
    this.holder.add(this.model.root);
    this.model.root.scale.setScalar(0.001);
    scene.add(this.holder);
    this._heart = new THREE.Vector3(); this._drop = new THREE.Vector3(); this._knockDir = new THREE.Vector3(); this._push = new THREE.Vector3();
    this.knock = 0;
  }

  get position() { return this.holder.position; }
  // the heart, where it is now (it grows with the rise, and beats)
  center(out = new THREE.Vector3()) {
    const h = this.model.heart.position, s = this.model.root.scale.x;
    return out.set(h.x * s, h.y * s, h.z * s).add(this.holder.position);
  }
  get shielded() { return this.guards.length > 0; }
  get angry() { return this.hp < this.maxHp * this.def.skills.enrage.at; }

  damage(amount, color = '#fff') {
    if (this.dead || this.rise < 1) return;
    if (this.shielded) { this.fx.number(this.center().setY(this.center().y + 0.05), 'SHIELDED', '#cfe6ff', 12); return; }
    this.hp -= amount;
    this.hitPop = 1;
    this.fx.number(this.center().setY(this.center().y + 0.06), Math.round(amount), color, 16);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  update(dt, player) {
    const out = this.tick(dt, player);
    if (out.hit) bus.emit('damage_taken', { targetId: PLAYER, amount: out.hit, source: 'boss' });
    bus.emit('boss_health', { name: this.arena.name, hp: this.hp, maxHp: this.maxHp, shielded: this.shielded, shieldText: 'SHIELDED' });
    return { push: out.push };
  }

  tick(dt, player) {
    this.t += dt;
    this.player = player;
    const out = { push: null, hit: 0 };
    const M = this.model, s = SCALE;
    if (this.dead) {
      // it wilts back down into its pot
      if (!this.wither) sfx.clogDeath?.();
      this.wither = Math.min(1, this.wither + dt * 0.6);
      M.root.scale.setScalar(s * (1 - this.wither * 0.7));
      M.heart.material.emissiveIntensity = 0.35 * (1 - this.wither);
      return out;
    }
    // it grows up out of the pillows
    if (this.rise < 1) {
      if (this.rise === 0) sfx.clogRise?.();
      this.rise = Math.min(1, this.rise + dt * 0.55);
      M.root.scale.setScalar(s * Math.max(0.001, smooth(0, 1, this.rise)));
    } else M.root.scale.setScalar(s);
    // the heart beats and glows in its hollow (kept below white so its colour reads)
    const beat = Math.max(0, Math.sin(this.t * 4)) ** 4;
    this.hitPop = Math.max(0, (this.hitPop || 0) - dt * 5);
    M.heart.scale.setScalar(HEART * (1 + beat * 0.05 + this.hitPop * 0.12));
    M.heart.material.emissiveIntensity = 0.3 + beat * 0.15;
    this.fx.glow.hold(this.center(this._heart), this.glowColor, 0.14 * (0.8 + beat * 0.3), 0.6);
    // its attacks, in turn
    if (this.rise >= 1) {
      this.stateT -= dt;
      if (this.stateT <= 0) {
        if (this.state === 'idle') { const order = this.angry ? ATTACKS.angry : ATTACKS.calm; this.begin(order[this.next++ % order.length]); }
        else { const SK = this.def.skills[this.state]; this.state = 'idle'; this.stateT = this.angry ? SK.angryRest : SK.rest; }
      }
    }
    // bumping into the pot hurts and knocks you back off it
    const P = player.position, h = this.holder.position, dx = P.x - h.x, dz = P.z - h.z, d = Math.hypot(dx, dz);
    this.knock = Math.max(0, this.knock - dt);
    if (this.knock <= 0 && d < POT_R * SCALE + player.cfg.radius && P.y < h.y + POT_H * SCALE) {
      out.hit = this.def.contact;
      this.knock = 0.3;
      if (d) this._knockDir.set(dx / d, 0, dz / d); else this._knockDir.set(0, 0, -1);
    }
    if (this.knock > 0) out.push = this._push.copy(this._knockDir).multiplyScalar(0.6);
    return out;
  }

  // start an attack (the stories start them directly too)
  begin(name) {
    const SK = this.def.skills[name];
    this.state = name;
    this.stateT = SK.time;
    if (name === 'roots') this.roots(SK);
  }

  // Aerial roots: they drop from the canopy and the shelf over the bed, one onto where you are and the
  // rest round you; each is an enemy (content/enemies.kdl "root") that falls on its own Warning
  roots({ count, spread }) {
    const P = this.player.position;
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, d = k ? spread * (0.5 + 0.5 * Math.random()) : 0;
      const at = this._drop.set(P.x + Math.sin(a) * d, P.y + 0.1, P.z + Math.cos(a) * d);
      at.y = this.enemies.floorBelow(at, P.y);
      this.enemies.spawn('root', at);
    }
  }

  dispose() {
    this.scene.remove(this.holder);
    this.model.mound.dispose();          // its instance buffer; the shared geometry and materials stay
  }
}
