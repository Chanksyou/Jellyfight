// The Clog: act 2's boss, a huge matted hairball that rises out of the bathtub drain. Built like
// the Vacuum (vacuum.js): it rolls after you and bumps you back, and between chases it cycles
// through telegraphed attacks:
//   lash      a hair rope rears up while a line on the tub floor shows where it will land (the
//             aim locks halfway), then whips down along it: 3, and it tangles you (slowed).
//             Angry, two ropes lash at once.
//   snare     three circles fill on the floor round you, then tufts of hair spring up in them: 2
//             and slowed if you're caught
//   roll      it spins up while its lane lights up, then rolls down it at you: 4
//   gurgle    the drain swirls and pulls you toward it; right by the drain it hurts
//   shed      it shakes off hair tangles that join the fight
//   spray     (angry) it spins, spraying globs of drain gunk all round
//   swarm     once, the first time it drops below 70%: it roars, four ladybugs burst out of its
//             hair, and it sinks into the drain: it can't be hurt until they're dead (30 s at most)
// Below 45% health it's angry: faster, shorter pauses, the spray and double lashes.
// Same interface as the Vacuum: position, r, center(), damage(), dead, shielded, update() -> {push}.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { angryEyes, standOut } from './enemies.js';
import { LOOK } from './look.js';
import { bus, PLAYER } from './events.js';
import { hostile, TeleMaterial } from './vfx.js';
import { sfx } from './sfx.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const HAIR = ['#1e130c', '#2a1a10', '#33200f', '#3b2618', '#24160e', '#4a2a16', '#5a3418', '#7a7470', '#b8904a'];   // mostly dark brown; a grey and a blonde one

function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function paint(geo, color) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  const c = new THREE.Color(color), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { a[k * 3] = c.r; a[k * 3 + 1] = c.g; a[k * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
// a curl of hair from point `a` outward along `d`, `len` long, wandering
function curl(R, a, d, len, thick, color, segs = 10) {
  const pts = [a.clone()], side = new THREE.Vector3().randomDirection().cross(d).normalize();
  let p = a.clone(), dir = d.clone();
  for (let k = 1; k <= 5; k++) {
    dir.addScaledVector(side, (R() - 0.5) * 1.2).addScaledVector(new THREE.Vector3().randomDirection(), 0.35).normalize();
    p = p.clone().addScaledVector(dir, len / 5);
    pts.push(p);
  }
  return paint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, thick, 3), color);
}

// the hairball, in meters, radius `r`, facing +z. `roll` turns as it rolls; the face, maw and
// ropes stay facing you.
// matted hair: thousands of fine curved strokes, light and dark, over a dark ground
function hairTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d'), R = rng(5);
  g.fillStyle = '#2a2018'; g.fillRect(0, 0, 512, 512);
  g.lineCap = 'round';
  for (let k = 0; k < 5000; k++) {
    const x = R() * 512, y = R() * 512, a = R() * Math.PI * 2, L = 12 + R() * 40, bend = (R() - 0.5) * 30;
    const v = R();
    g.strokeStyle = v < 0.45 ? `rgba(8,5,3,${0.5 + R() * 0.4})` : v < 0.9 ? `rgba(${90 + R() * 60 | 0},${60 + R() * 40 | 0},${35 + R() * 25 | 0},${0.35 + R() * 0.4})` : `rgba(200,190,170,${0.3 + R() * 0.3})`;
    g.lineWidth = 0.6 + R() * 1.2;
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * L / 2 - Math.sin(a) * bend, y + Math.sin(a) * L / 2 + Math.cos(a) * bend, x + Math.cos(a) * L, y + Math.sin(a) * L);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function buildClog(r) {
  const R = rng(97);
  const wet = new THREE.MeshPhysicalMaterial({ vertexColors: true, map: hairTexture(), roughness: 0.42, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.35 });
  const strandMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
  const root = new THREE.Group(), roll = new THREE.Group();
  root.add(roll);
  // the core: a lumpy matted mass, darker in the hollows
  const core = new THREE.IcosahedronGeometry(r * 0.92, 4), p = core.attributes.position, v = new THREE.Vector3();
  const col = new Float32Array(p.count * 3), dark = new THREE.Color('#0a0604'), light = new THREE.Color('#33200f'), t = new THREE.Color();
  for (let k = 0; k < p.count; k++) {
    v.fromBufferAttribute(p, k).normalize();
    const h = Math.sin(v.x * 9 + 1) * Math.sin(v.y * 7 + 2) * Math.sin(v.z * 8 + 3) + 0.5 * Math.sin(v.x * 21 + v.y * 17 + v.z * 13);
    v.multiplyScalar(r * 0.92 * (1 + 0.14 * h));
    p.setXYZ(k, v.x, v.y, v.z);
    t.copy(dark).lerp(light, THREE.MathUtils.clamp(0.5 + h * 0.6, 0, 1));
    col[k * 3] = t.r; col[k * 3 + 1] = t.g; col[k * 3 + 2] = t.b;
  }
  core.computeVertexNormals();
  core.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const coreMesh = new THREE.Mesh(core, wet);
  roll.add(coreMesh);
  // the matted layer: hundreds of short curls lying over it, and long loose strands
  const strands = [];
  // (a parting is left over the face, so the eyes and maw show through)
  const parted = (d) => d.z > 0.72 && Math.abs(d.x) < 0.5 && d.y > -0.55 && d.y < 0.62;
  for (let k = 0; k < 1500; k++) {
    const d = new THREE.Vector3().randomDirection();
    if (parted(d)) continue;
    const a = d.clone().multiplyScalar(r * (0.88 + R() * 0.1));
    const tan = new THREE.Vector3().randomDirection().cross(d).normalize();
    strands.push(curl(R, a, tan.lerp(d, 0.12).normalize(), r * (0.3 + R() * 0.45), r * 0.009, HAIR[(R() * 7) | 0], 5));
  }
  for (let k = 0; k < 70; k++) {
    const d = new THREE.Vector3().randomDirection();
    if (parted(d)) continue;
    const a = d.clone().multiplyScalar(r * 0.95);
    if (d.y > 0.6) d.y *= -0.3;                                         // long ones droop
    strands.push(curl(R, a, d.clone().setY(d.y - 0.6).normalize(), r * (0.9 + R() * 1.1), r * 0.008, HAIR[(R() * HAIR.length) | 0], 12));
  }
  const strandMesh = new THREE.Mesh(mergeGeometries(strands), strandMat);
  roll.add(strandMesh);
  // things caught in it: a pink hair tie, a bobby pin, soap scum, a bead, a cotton bud
  const tie = new THREE.Mesh(new THREE.TorusGeometry(r * 0.22, r * 0.045, 8, 24), new THREE.MeshStandardMaterial({ color: 0xff5aa0, roughness: 0.5 }));
  tie.position.set(r * 0.55, r * 0.55, r * 0.5); tie.rotation.set(0.6, 0.3, 0.2);
  roll.add(tie);
  const pin = new THREE.Group();
  for (const s of [-1, 1]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.012, r * 0.012, r * 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.8, roughness: 0.3 })); rod.position.x = s * r * 0.03; rod.rotation.z = s * 0.06; pin.add(rod); }
  pin.position.set(-r * 0.7, r * 0.35, r * 0.55); pin.rotation.set(0.4, 0, 1.1);
  roll.add(pin);
  const scum = new THREE.MeshPhysicalMaterial({ color: 0xe8e4d4, roughness: 0.3, transmission: 0.2, transparent: true, opacity: 0.85, clearcoat: 0.8 });
  for (let k = 0; k < 7; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(r * (0.08 + R() * 0.08), 10, 8), scum); b.position.copy(new THREE.Vector3().randomDirection().multiplyScalar(r * 0.95)); b.scale.y = 0.6; roll.add(b); }
  const bead = new THREE.Mesh(new THREE.SphereGeometry(r * 0.08, 12, 10), new THREE.MeshStandardMaterial({ color: 0x3aa8ff, roughness: 0.1, metalness: 0.2 }));
  bead.position.set(r * 0.2, -r * 0.5, r * 0.85);
  roll.add(bead);
  const bud = new THREE.Group();
  bud.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.02, r * 0.02, r * 0.8, 8), new THREE.MeshStandardMaterial({ color: 0xf4f0ff, roughness: 0.4 })));
  for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.SphereGeometry(r * 0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 })); c.position.y = s * r * 0.42; c.scale.y = 1.5; bud.add(c); }
  bud.position.set(-r * 0.4, -r * 0.2, -r * 0.8); bud.rotation.set(0.5, 0.5, 0.8);
  roll.add(bud);

  // the face (doesn't roll): glowing eyes peering through a parting in the hair, and the maw
  const face = new THREE.Group();
  root.add(face);
  const eyes = angryEyes({ y: 0, z: 0, size: 0.34, gap: 0.4, glow: true });
  eyes.scale.setScalar(r * 0.6);
  eyes.position.set(0, r * 0.3, r * 0.98);
  face.add(eyes);
  const maw = new THREE.Group();
  maw.position.set(0, -r * 0.22, r * 0.9);
  face.add(maw);
  maw.add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.32, 20, 12).scale(1, 0.55, 0.3), new THREE.MeshBasicMaterial({ color: 0x080404 })));
  const gums = new THREE.MeshStandardMaterial({ color: 0x5a2a20, roughness: 0.6 });
  const toothMat = new THREE.MeshStandardMaterial({ color: 0xd8d0b0, roughness: 0.5 });
  const teeth = [];
  for (const [y, s] of [[1, -1], [-1, 1]]) for (let k = 0; k < 6; k++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(r * 0.03, r * 0.1, 6), toothMat);
    tooth.position.set((k - 2.5) * r * 0.09, y * r * 0.13, r * 0.06);
    tooth.rotation.z = s > 0 ? 0 : Math.PI;
    maw.add(tooth); teeth.push(tooth);
  }
  maw.add(new THREE.Mesh(new THREE.TorusGeometry(r * 0.3, r * 0.04, 6, 24).scale(1, 0.55, 1), gums));
  // slime drips hanging off the bottom
  const slime = new THREE.MeshPhysicalMaterial({ color: 0x8a9a5a, roughness: 0.15, transparent: true, opacity: 0.7, clearcoat: 1 });
  const drips = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.4, d = new THREE.Mesh(new THREE.SphereGeometry(r * 0.06, 10, 8), slime);
    d.position.set(Math.cos(a) * r * 0.55, -r * 0.8, Math.sin(a) * r * 0.55);
    d.scale.set(1, 2.4, 1);
    root.add(d); drips.push(d);
  }
  // the hair ropes: four thick twisted bundles, each a chain of joints, reaching forward and down
  const segGeo = mergeGeometries([0, 1, 2, 3].map((k) => paint(new THREE.CylinderGeometry(r * 0.065, r * 0.08, r * 0.38, 6, 1).translate(Math.cos(k * 1.6) * r * 0.05, r * 0.18, Math.sin(k * 1.6) * r * 0.05).rotateY(k * 0.7), HAIR[k + 1])));
  const ropes = [[-0.55, 0.15], [0.55, 0.15], [-0.35, -0.35], [0.35, -0.35]].map(([x, y], i) => {
    const base = new THREE.Group();
    base.position.set(x * r, y * r, r * 0.6);
    base.rotation.y = x * 0.6;
    root.add(base);
    const joints = [];
    let parent = base;
    for (let k = 0; k < 8; k++) {
      const j = new THREE.Group();
      if (k) j.position.y = r * 0.34;
      parent.add(j);
      const seg = new THREE.Mesh(segGeo, strandMat);
      seg.rotation.y = k * 0.8;
      j.add(seg);
      joints.push(j);
      parent = j;
    }
    return { base, joints, i, x };
  });
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  standOut(root, { base: LOOK.num('boss-glow', 0.15) * 0.5, rim: LOOK.num('boss-rim', 0.6) * 0.4 });   // dimmer than other bosses: a thin strand is nearly all rim, and it washed the hair out pale
  return { root, roll, face, maw, teeth, drips, ropes, eyes };
}

export class Clog {
  constructor(scene, enemies, fx, arena, world) {
    Object.assign(this, { scene, enemies, fx, arena, world });
    this.kind = 'hair';
    this.r = 0.1;
    this.maxHp = this.hp = 1500;
    this.dead = false;
    this.t = 0;
    this.rise = 0;
    this.state = 'chase';
    this.stateT = 3;
    this.next = 0;
    this.heading = 0;
    this.knock = 0;
    this.knockDir = new THREE.Vector3();
    this.drain = V(...arena.drain);
    this.floor = this.drain.y;
    this.shots = [];
    this.tufts = [];
    this.guards = [];          // the ladybugs it let loose (the swarm): it's in the drain while they live
    this.swarmed = false;
    this.sink = 0;             // 0 up, 1 down in the drain

    const M = buildClog(this.r);
    Object.assign(this, { model: M, body: M.root });
    this.holder = new THREE.Group();
    this.holder.add(M.root);
    this.holder.position.copy(this.drain);
    M.root.scale.setScalar(0.001);
    scene.add(this.holder);

    const tele = (shape, geo) => { const m = new THREE.Mesh(geo, new TeleMaterial(hostile('clog'), shape)); m.material.opacity = 0; m.renderOrder = 3; m.visible = false; scene.add(m); return m; };
    const strip = () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
    this.lines = [tele('strip', strip()), tele('strip', strip())];
    this.swirl = tele('circle', new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2));
    this.snares = [0, 1, 2].map(() => tele('circle', new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2)));
    this.tuftGeo = new THREE.ConeGeometry(0.004, 0.05, 5).translate(0, 0.025, 0);
    this.tuftMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.8 });
    // the drain itself: a dark grate that churns while it gurgles
    this.grate = new THREE.Mesh(new THREE.CircleGeometry(0.035, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1a1a1e, metalness: 0.7, roughness: 0.4 }));
    this.grate.position.copy(this.drain).setY(this.floor + 0.0015);
    scene.add(this.grate);
  }

  get position() { return this.holder.position; }
  center(out = new THREE.Vector3()) { return out.copy(this.holder.position).setY(this.holder.position.y + this.r * (1 - this.sink * 0.9)); }
  get shielded() { return this.guards.length > 0; }
  get angry() { return this.hp < this.maxHp * 0.45; }

  damage(amount, color = '#fff') {
    if (this.dead || this.rise < 1) return;
    if (this.shielded) { this.fx.number(this.center().setY(this.floor + 0.05), 'IN THE DRAIN', '#cfe6ff', 12); return; }
    this.hp -= amount;
    this.hitPop = 1;
    this.fx.number(this.center().setY(this.holder.position.y + this.r * 2.2), Math.round(amount), color, 16);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  update(dt, player) {
    const out = this.tick(dt, player);
    if (out.hurt) bus.emit('damage_taken', { targetId: PLAYER, amount: out.hurt, source: 'boss', drain: true });
    if (out.hit) bus.emit('damage_taken', { targetId: PLAYER, amount: out.hit, source: 'boss' });
    if (out.slow) bus.emit('status_applied', { targetId: PLAYER, status: 'slow', duration: out.slow });
    bus.emit('boss_health', { name: this.arena.name, hp: this.hp, maxHp: this.maxHp, shielded: this.shielded, shieldText: 'IN THE DRAIN' });
    return { push: out.push };
  }

  // roll along the heading, turning toward `target` at most `turn` rad/s; true if it hit the tub wall
  drive(dt, target, speed, turn) {
    const p = this.holder.position;
    if (target) {
      let d = Math.atan2(target.x - p.x, target.z - p.z) - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += THREE.MathUtils.clamp(d, -turn * dt, turn * dt);
    }
    p.x += Math.sin(this.heading) * speed * dt;
    p.z += Math.cos(this.heading) * speed * dt;
    const a = this.arena, x0 = a.arenaMin[0] + this.r, x1 = a.arenaMax[0] - this.r, z0 = a.arenaMin[2] + this.r, z1 = a.arenaMax[2] - this.r;
    const wall = p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1;
    p.x = THREE.MathUtils.clamp(p.x, x0, x1);
    p.z = THREE.MathUtils.clamp(p.z, z0, z1);
    this.model.root.rotation.y = this.heading;
    this.model.roll.rotation.x += speed * dt / this.r;                 // the hair rolls; the face stays on you
    return wall;
  }

  tick(dt, player) {
    this.t += dt;
    const out = { push: null, hurt: 0, hit: 0, slow: 0 };
    const p = this.holder.position, P = player.position, M = this.model;
    const hide = () => { for (const m of [...this.lines, ...this.snares]) { m.visible = false; } this.swirl.visible = false; };
    if (this.dead) {
      if (!this.deathSound) { this.deathSound = true; sfx.clogDeath(); hide(); this.guards.forEach((e) => this.enemies.kill(e, true)); this.guards = []; }
      this.sink = Math.min(1, this.sink + dt * 0.6);
      this.place(dt);
      this.holder.scale.multiplyScalar(Math.max(0, 1 - dt * 0.8));
      if (Math.random() < dt * 25) this.fx.puff(this.center().add(new THREE.Vector3().randomDirection().multiplyScalar(this.r)), 0x3b2618, 0.03, 0.5);
      return out;
    }
    // rise out of the drain, gurgling, hair unfurling
    if (this.rise < 1) {
      if (this.rise === 0) sfx.clogRise();
      this.rise = Math.min(1, this.rise + dt * 0.55);
      M.root.scale.setScalar(this.rise);
      p.y = this.floor + this.r * (this.rise - 1);
      this.heading = Math.atan2(P.x - p.x, P.z - p.z);
      M.root.rotation.y = this.heading;
      if (Math.random() < dt * 30) this.fx.puff(this.drain.clone().setY(this.floor + 0.01), 0x8a9a5a, 0.02, 0.4);
      this.animate(dt, 0);
      return out;
    }
    this.hitPop = Math.max(0, (this.hitPop || 0) - dt * 6);
    const angry = this.angry, toP = P.clone().sub(p).setY(0), dist = toP.length();
    let mouth = 0;
    this.stateT -= dt;

    // the swarm: the first time it drops below 70%, whatever it was doing
    if (!this.swarmed && this.hp < this.maxHp * 0.7 && this.state !== 'swarm') { hide(); this.state = 'swarm'; this.stateT = 1.4; this.swarmT = 0; sfx.clogRoar(); }

    if (this.state === 'chase') {
      this.drive(dt, P, angry ? 0.17 : 0.12, angry ? 2.2 : 1.6);
      if (this.stateT <= 0) this.pick();
    } else if (this.state === 'lash') {
      // a rope (two when angry) rears up while its line fills on the floor; the aim locks halfway
      const wind = angry ? 0.85 : 1.05, n = angry ? 2 : 1;
      if (this.stateT > 0.3) {
        const u = 1 - (this.stateT - 0.3) / wind;
        if (u < 0.5) this.drive(dt, P, 0, 4);
        this.lines.forEach((L, i) => {
          L.visible = i < n;
          if (!L.visible) return;
          L.position.copy(p).setY(this.floor + 0.003);
          L.rotation.y = this.heading + (n > 1 ? (i ? 0.38 : -0.38) : 0);
          L.scale.set(0.07, 1, 0.48);
          L.material.progress = u;
          L.material.opacity = 0.8 + Math.sin(this.t * 26) * 0.2;
        });
        this.rearing = u;
      } else {
        if (!this.struck) {
          this.struck = true;
          sfx.clogLash();
          this.lines.forEach((L, i) => {
            if (!L.visible) return;
            L.material.progress = 1;
            const a = L.rotation.y, d = V(Math.sin(a), 0, Math.cos(a)), rel = P.clone().sub(p).setY(0);
            const along = rel.dot(d), side = Math.abs(rel.x * d.z - rel.z * d.x);
            const tip = p.clone().addScaledVector(d, 0.42).setY(this.floor + 0.01);
            this.fx.impact(tip, hostile('clog'), 0.03, 12);
            this.fx.burst(tip, ['#3b2618', '#8a9a5a', '#5a3a24'], 6, 0.003, 0.25, this.floor);
            if (along > 0 && along < 0.5 && side < 0.035 + 0.03 && Math.abs(P.y - this.floor) < 0.08) { out.hit = 3; out.slow = 1.2; }
          });
        }
        this.rearing = -1;                                              // slammed down along the line
        if (this.stateT <= 0) { hide(); this.struck = false; this.rearing = 0; this.toChase(); }
      }
    } else if (this.state === 'roll') {
      // spin up in place while the lane lights up, then roll along it
      if (!this.locked) {
        this.drive(dt, P, 0, 3);
        M.roll.rotation.x += dt * 30 * (1 - this.stateT);
        const L = this.lines[0];
        L.visible = true;
        L.position.copy(p).setY(this.floor + 0.003);
        L.rotation.y = this.heading;
        L.scale.set(this.r * 1.8, 1, 0.8);
        this.rollWind ??= Math.max(0.01, this.stateT);
        L.material.progress = 1 - this.stateT / this.rollWind;
        L.material.opacity = 0.8 + Math.sin(this.t * 30) * 0.2;
        if (Math.random() < dt * 20) this.fx.puff(p.clone().setY(this.floor + 0.01), 0x8a9a5a, 0.02, 0.3);
        if (this.stateT <= 0) { this.locked = true; this.stateT = 1.1; this.rollWind = null; L.visible = false; sfx.clogRoll(); }
      } else {
        const wall = this.drive(dt, null, angry ? 1.0 : 0.85, 0);
        if (Math.random() < dt * 25) this.fx.puff(p.clone().setY(this.floor + 0.01), 0x6a5a3a, 0.025, 0.35);
        if (wall || this.stateT <= 0) { this.locked = false; sfx.clogSplat(); this.fx.impact(p.clone().setY(this.floor + 0.02), hostile('clog'), this.r * 0.6, 16); this.toChase(); }
      }
    } else if (this.state === 'snare') {
      // three circles fill round you (they follow you until halfway), then hair springs up in them
      const wind = 1.0;
      if (this.stateT > 0.25) {
        const u = 1 - (this.stateT - 0.25) / wind;
        this.drive(dt, P, 0.03, 1);
        this.snares.forEach((m, i) => {
          if (u < 0.5 || !m.visible) {
            const a = i * 2.1 + this.t * 0.3, d = i ? 0.075 : 0;
            m.position.set(P.x + Math.cos(a) * d, this.floor + 0.003, P.z + Math.sin(a) * d);
          }
          m.visible = true;
          m.scale.setScalar(0.05);
          m.material.progress = u;
          m.material.opacity = 0.75 + 0.25 * Math.abs(Math.sin(this.t * 14));
        });
        mouth = 0.4;
      } else if (!this.sprung) {
        this.sprung = true;
        sfx.clogSnare();
        for (const m of this.snares) {
          const c = m.position;
          for (let k = 0; k < 7; k++) {
            const tuft = new THREE.Mesh(this.tuftGeo, this.tuftMat);
            const a = (k / 7) * Math.PI * 2;
            tuft.position.set(c.x + Math.cos(a) * 0.025, this.floor, c.z + Math.sin(a) * 0.025);
            tuft.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
            this.scene.add(tuft);
            this.tufts.push({ m: tuft, t: 0 });
          }
          this.fx.burst(c.clone().setY(this.floor + 0.01), ['#3b2618', '#2a1a10', '#8a9a5a'], 6, 0.003, 0.3, this.floor);
          if (Math.hypot(P.x - c.x, P.z - c.z) < 0.05 + 0.025 && Math.abs(P.y - this.floor) < 0.06) { out.hit = 2; out.slow = 1.5; }
          m.visible = false;
        }
      }
      if (this.stateT <= 0) { this.sprung = false; hide(); this.toChase(); }
    } else if (this.state === 'gurgle') {
      // the drain swirls and pulls you toward it; right by the drain it hurts
      this.drive(dt, this.drain, 0.06, 1.5);
      const s = this.swirl;
      s.visible = true;
      s.position.copy(this.drain).setY(this.floor + 0.003);
      s.scale.setScalar(0.24);
      s.material.progress = 0;
      s.material.opacity = 0.8;
      const toDrain = this.drain.clone().sub(P).setY(0), dd = toDrain.length();
      out.push = toDrain.normalize().multiplyScalar(0.17 * THREE.MathUtils.clamp(1.3 - dd * 1.2, 0.35, 1.1) * (angry ? 1.2 : 1));
      if (dd < 0.05 && Math.abs(P.y - this.floor) < 0.06) out.hurt = 2 * dt;
      this.grate.rotation.y += dt * 8;
      if (Math.random() < dt * 30) { const a = Math.random() * 6.3, rr = 0.03 + Math.random() * 0.2; this.fx.puff(this.drain.clone().add(V(Math.cos(a) * rr, 0.008, Math.sin(a) * rr)), 0xb8c8a0, 0.007, 0.3); }
      mouth = 0.7;
      if (this.stateT <= 0) { s.visible = false; this.toChase(); }
    } else if (this.state === 'shed') {
      // it shakes, and hair tangles fly off it
      mouth = 0.5;
      M.root.position.x = (Math.random() - 0.5) * 0.006;
      if (this.prevT > 0.4 && this.stateT <= 0.4) {
        const n = angry ? 4 : 3;
        for (let k = 0; k < n; k++) {
          const a = this.heading + (k - (n - 1) / 2) * 1.1 + Math.PI;
          const q = p.clone().add(V(Math.sin(a), 0, Math.cos(a)).multiplyScalar(this.r + 0.04));
          this.clampIn(q);
          this.enemies.spawn('hair', q.setY(this.floor), 1.3);
        }
        this.fx.puff(this.center(), 0x3b2618, 0.07, 0.5);
        sfx.clogSplat();
      }
      if (this.stateT <= 0) { M.root.position.x = 0; this.toChase(); }
    } else if (this.state === 'spray') {
      // spinning, spraying globs of drain gunk all round
      this.heading += dt * 8;
      M.root.rotation.y = this.heading;
      mouth = 1;
      this.sprayT = (this.sprayT ?? 0) - dt;
      if (this.sprayT <= 0) {
        this.sprayT = 0.16;
        const dir = V(Math.sin(this.heading), 0, Math.cos(this.heading));
        const m = this.fx.orb(hostile('clog'), 0.008);
        m.position.copy(p).addScaledVector(dir, this.r).setY(this.floor + 0.03);
        this.shots.push({ m, v: dir.multiplyScalar(0.5), t: 1.4 });
        sfx.clogSplat();
      }
      if (this.stateT <= 0) this.toChase();
    } else if (this.state === 'swarm') {
      // a roar, four ladybugs burst out of its hair, and down into the drain it goes
      this.swarmT += dt;
      mouth = 1;
      M.root.position.x = (Math.random() - 0.5) * 0.008;
      if (!this.guards.length && this.swarmT > 0.8 && !this.swarmed) {
        this.swarmed = true;
        for (let k = 0; k < 4; k++) {
          const a = this.heading + (k / 4) * Math.PI * 2 + Math.PI / 4;
          const q = this.clampIn(p.clone().add(V(Math.sin(a), 0, Math.cos(a)).multiplyScalar(this.r + 0.05))).setY(this.floor + 0.1);
          const e = this.enemies.spawn('ladybug', q, 1.2);
          e.spawnT = 0.5;
          e.stateT = 2.5 + k * 0.7;                                     // they don't all land at once
          e.vel.set(Math.sin(a) * 0.3, 0.35, Math.cos(a) * 0.3);
          this.guards.push(e);
        }
        this.guardT = 30;
        this.fx.impact(this.center(), hostile('missile'), 0.06, 20);
        this.fx.puff(this.center(), 0x3b2618, 0.09, 0.6);
        sfx.ladyBuzz();
      }
      if (this.swarmed) {
        // into the drain: only the eyes show; out again once the ladybugs are gone
        this.drive(dt, this.drain, 0.25, 4);
        const at = Math.hypot(p.x - this.drain.x, p.z - this.drain.z) < 0.02;
        this.sink += ((at && this.shielded ? 0.75 : 0) - this.sink) * (1 - Math.exp(-3 * dt));
        this.guards = this.guards.filter((e) => !e.dead);
        if ((this.guardT -= dt) <= 0) this.guards = [];
        if (!this.shielded) {
          if (!this.surfaced) { this.surfaced = true; sfx.clogRise(); this.fx.puff(this.drain.clone().setY(this.floor + 0.02), 0x8a9a5a, 0.08, 0.6); }
          if (this.sink < 0.05) { this.sink = 0; M.root.position.x = 0; this.toChase(); }
        }
      }
    }
    this.prevT = this.stateT;
    if (this.state !== 'swarm' && this.sink > 0) this.sink = Math.max(0, this.sink - dt);
    if (angry && !this.wasAngry) sfx.clogRoar();
    this.wasAngry = angry;
    this.place(dt);
    this.animate(dt, mouth);

    // bumping into it knocks you back (not while it's down the drain)
    if (this.knock <= 0 && this.sink < 0.3 && dist < this.r + 0.02 && Math.abs(P.y - this.floor) < 0.12) {
      const rolling = this.state === 'roll' && this.locked;
      out.hit = Math.max(out.hit, rolling ? 4 : 2);
      this.knockBack(toP, rolling ? 1.0 : 0.6);
    }
    if (this.knock > 0) { this.knock -= dt; out.push = (out.push || new THREE.Vector3()).clone().addScaledVector(this.knockDir, this.knockSpeed); }

    // gunk globs
    const pc = P.clone().setY(P.y + 0.026);
    for (const s of this.shots) {
      s.t -= dt;
      s.m.position.addScaledVector(s.v, dt);
      this.fx.orbTick(s.m, dt);
      if (s.m.position.distanceTo(pc) < 0.026) { out.hit = Math.max(out.hit, 2); s.t = 0; }
      if (s.t <= 0) { this.fx.impact(s.m.position, hostile('clog'), 0.015, 8); this.fx.free(s.m); }
    }
    this.shots = this.shots.filter((s) => s.t > 0);
    // hair tufts from a snare: up, then back down
    for (const f of this.tufts) {
      f.t += dt;
      f.m.scale.set(1, Math.min(1, f.t * 8) * Math.max(0, 1 - (f.t - 0.5) * 2), 1);
      if (f.t > 1) { this.scene.remove(f.m); f.done = true; }
    }
    this.tufts = this.tufts.filter((f) => !f.done);
    return out;
  }

  // how high it sits: on the tub floor, sunk into the drain as `sink` goes to 1
  place(dt) {
    const p = this.holder.position;
    p.y = this.floor + this.r * 0.05 - this.sink * this.r * 1.6;
    this.model.root.scale.setScalar(1 + (this.hitPop || 0) * 0.04);
  }

  // the living bits: breathing, the maw, the ropes swaying (rearing up and slamming for a lash), drips
  animate(dt, mouth) {
    const M = this.model, t = this.t;
    M.root.scale.y *= 1 + Math.sin(t * 3) * 0.03;
    this.mouthK = (this.mouthK || 0) + (mouth - (this.mouthK || 0)) * (1 - Math.exp(-10 * dt));
    M.maw.scale.set(1, 0.5 + this.mouthK * 1.1, 1);
    for (const R of M.ropes) {
      const lashing = this.state === 'lash' && R.i < (this.angry ? 2 : 1);
      R.joints.forEach((j, k) => {
        const sway = Math.sin(t * 2.2 + R.i * 1.7 + k * 0.6) * 0.12;
        let x = 0.55 + sway;                                            // drooping forward and down
        if (lashing && this.rearing > 0) x = -0.25 - this.rearing * 0.35 + sway * 0.3;   // curled up and back over it
        if (lashing && this.rearing < 0) x = 0.22;                       // whipped out flat along the floor
        j.rotation.x = k ? x * 0.32 : x + 0.9;
        j.rotation.z = Math.sin(t * 1.7 + R.i + k) * 0.08;
      });
      R.base.scale.setScalar(lashing && this.rearing < 0 ? 1.45 : 1);    // stretched out to its full reach
    }
    for (const [i, d] of M.drips.entries()) d.scale.y = 2.4 + Math.sin(t * 2 + i) * 0.5;
  }

  clampIn(q) {
    const a = this.arena;
    q.x = THREE.MathUtils.clamp(q.x, a.arenaMin[0] + 0.05, a.arenaMax[0] - 0.05);
    q.z = THREE.MathUtils.clamp(q.z, a.arenaMin[2] + 0.05, a.arenaMax[2] - 0.05);
    return q;
  }

  knockBack(toP, speed) {
    this.knock = 0.3;
    this.knockSpeed = speed;
    this.knockDir.copy(toP).setY(0).normalize();
  }

  toChase() {
    this.state = 'chase';
    this.stateT = this.angry ? 1.5 : 2.4;
    this.locked = false;
  }

  // the next attack, in a loop (the spray joins once it's angry)
  pick() {
    const order = this.angry ? ['lash', 'spray', 'roll', 'snare', 'gurgle', 'lash', 'shed'] : ['lash', 'snare', 'roll', 'gurgle', 'shed'];
    this.state = order[this.next++ % order.length];
    this.stateT = { lash: (this.angry ? 0.85 : 1.05) + 0.3, snare: 1.25, roll: 1.0, gurgle: 3.0, shed: 1.0, spray: 2.2 }[this.state];
    ({ lash: () => sfx.clogLashWind(), roll: () => sfx.clogRollWind(), gurgle: () => sfx.clogGurgle(this.stateT), snare: () => sfx.clogRustle(), spray: () => sfx.clogRoar() })[this.state]?.();
    this.prevT = this.stateT;
    this.locked = false;
  }

  dispose() {
    this.scene.remove(this.holder);
    for (const m of [...this.lines, ...this.snares, this.swirl, this.grate]) this.scene.remove(m);
    this.tufts.forEach((f) => this.scene.remove(f.m));
    this.shots.forEach((s) => this.fx.free(s.m));
  }
}
