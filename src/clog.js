// The Clog: act 2's boss, a huge matted hairball that rises out of the bathtub drain. Between
// attacks it bounds after you in squashing hops, juking to one side as it crouches; bumping into
// it is a wet, heavy slam (3, thrown back and tangled). It cycles through telegraphed attacks:
//   pinball   three leaps at you: each landing spot is a circle with a half sphere over it that
//             follows you, then locks just before it slams down there as a Blast (3, thrown back);
//             the third slam also rolls a low ring wave out across the tub: jump it
//   comb      hair curtains slam down across the tub in lanes beside each other, too tall to jump:
//             every other lane, then the ones between, then every other again; step into the lane
//             that just struck
//   lash      a hair rope rears up while a line on the tub floor shows where it will land (the
//             aim locks halfway), under a low lane (3 cm: jump it), then whips down along it: 3,
//             and it tangles you (slowed). Angry, two ropes lash at once.
//   snare     three circles fill on the floor round you, each a floor Blast (a half sphere: jump
//             clear of it), then tufts of hair spring up in them: 2 and slowed if you're caught
//   roll      it spins up while its lane lights up, a lane as tall as the hairball (a jump doesn't
//             clear it: get out of it), then rolls down it at you: 4
//   flood     the spout gushes and the tub fills (a ring round the drain fills with it), then it
//             all drains at once: a whirlpool drags you toward the drain; right by it, it hurts
//   shed      it shakes off hair tangles that join the fight
//   spray     (angry) it spins, spraying globs of drain gunk all round in three streams: Shots
//             alternating floor level and jump height
//   swarm     once, the first time it drops below 70%: it roars, four ladybugs burst out of its
//             hair, and it sinks into the drain: it can't be hurt until they're dead (30 s at most)
// Below 45% health it's angry: faster, shorter pauses, the spray and double lashes.
// Same interface as the Vacuum: position, r, center(), damage(), dead, shielded, update() -> {push}.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { angryEyes, standOut } from './enemies.js';
import { LOOK } from './look.js';
import { bus, PLAYER } from './events.js';
import { hostile, TeleMaterial, laneHits, blastHits, ringHits, shotTarget, SHOT_HEIGHT } from './vfx.js';
import { sfx } from './sfx.js';
import { juice } from './juice.js';
import { CONTENT } from './content.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _rel = new THREE.Vector3();
const GUNK = () => LOOK.color('clog-gunk', '#3a2a16');   // its wet smears (fx.splat: harmless, they fade)
const HAIR = ['#1e130c', '#2a1a10', '#33200f', '#3b2618', '#24160e', '#4a2a16', '#5a3418', '#7a7470', '#b8904a'];   // mostly dark brown; a grey and a blonde one

// a shudder as it winds up (its root jitters sideways)
function M_shake(M, a) { M.root.position.x = (Math.random() - 0.5) * a; }
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
  standOut(root, { base: LOOK.num('boss-glow', 0.15) * 0.5, rim: LOOK.num('boss-rim', 0.6) * 0.4 });   // dimmer than other bosses: a thin strand is nearly all rim, and it washed the hair out pale
  return { root, roll, face, maw, teeth, drips, ropes, eyes };
}

// its attacks in the order it takes them, calm and angry (pick); the stories check each one's Warning
export const ATTACKS = { calm: ['lash', 'pinball', 'snare', 'roll', 'comb', 'flood', 'shed'], angry: ['pinball', 'lash', 'spray', 'comb', 'roll', 'snare', 'flood', 'lash', 'shed'] };

export class Clog {
  constructor(scene, enemies, fx, arena, world) {
    Object.assign(this, { scene, enemies, fx, arena, world });
    this.kind = 'hair';
    this.r = 0.1;
    this.def = CONTENT.bosses.clog;   // its numbers (content/bosses.kdl), read fresh each attack so the Tuner's edits land mid-fight
    this.maxHp = this.hp = this.def.hp;
    this.dead = false;
    this.dying = false;   // doomed at 0 hp: held for Dendi's finishing smack (die())
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
    // over them, the space each attack fills (vfx.js volumes), shown and filled with its floor
    // shape (syncVolumes): the lash's low lane (3 cm: jump it), the roll's lane as tall as the
    // hairball (a jump doesn't clear it), each snare's half sphere
    this.lashH = 0.03; this.lashLen = 0.48; this.lashW = 0.07;
    this.rollH = this.r * 2; this.rollLen = 0.8; this.rollW = this.r * 1.8;
    this.snareR = 0.05;
    const vol = (kind, s) => { const m = fx.volume(hostile('clog'), kind, this.drain, s); m.visible = false; return m; };
    this.lashVols = [0, 1].map(() => vol('lane', V(this.lashW, this.lashH, this.lashLen)));
    this.rollVol = vol('lane', V(this.rollW, this.rollH, this.rollLen));
    this.snareVols = [0, 1, 2].map(() => vol('dome', this.snareR));
    this.rollAt = new THREE.Vector3();
    this.rollDir = new THREE.Vector3();
    // pinball: where it will land (a circle and a half sphere, scaled to the slam's radius); the ring
    // wave its last slam rolls out (a glowing ring on the floor and its low 'ring' wall)
    this.pinTele = tele('circle', new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2));
    this.pinVol = vol('dome', 1);
    this.waveMesh = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: hostile('clog').clone().multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.waveMesh.renderOrder = 3; this.waveMesh.visible = false; scene.add(this.waveMesh);
    this.waveVol = vol('ring', V(1, 1, 1));
    this.wave = null;
    // comb: the lanes its hair curtains slam down in (strips across the tub, each with its tall lane)
    this.combTeles = [0, 1, 2, 3, 4].map(() => tele('strip', strip()));
    this.combVols = [0, 1, 2, 3, 4].map(() => vol('lane', V(1, 1, 1)));
    this.combX = [];
    // its hops between attacks, and how squashed (+) or stretched (-) it is
    this.hop = null; this.hopWait = 0.3; this.lift = 0; this.squash = 0;
    this._at = new THREE.Vector3(); this._from = new THREE.Vector3();
    // tick() scratch: the per-frame paths (chase heading, the whirlpool, the lash strike) reuse
    // these instead of minting vectors every frame
    this._toP = new THREE.Vector3(); this._toDrain = new THREE.Vector3(); this._side = new THREE.Vector3();
    this._d = new THREE.Vector3(); this._tip = new THREE.Vector3(); this._lane = new THREE.Vector3(); this._puff = new THREE.Vector3(); this._contact = new THREE.Vector3();
    this.tuftGeo = new THREE.ConeGeometry(0.004, 0.05, 5).translate(0, 0.025, 0);
    this.tuftMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.8 });
    // the drain itself: a dark grate that churns while it gurgles
    this.grate = new THREE.Mesh(new THREE.CircleGeometry(0.035, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1a1a1e, metalness: 0.7, roughness: 0.4 }));
    this.grate.position.copy(this.drain).setY(this.floor + 0.0015);
    scene.add(this.grate);
    // the bath water (flood): a sheet across the tub that rises and drains, the stream from the
    // spout, and a whirlpool spiral over the drain while it drains
    const a = arena;
    this.waterY = this.floor;
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(a.arenaMax[0] - a.arenaMin[0], a.arenaMax[2] - a.arenaMin[2]).rotateX(-Math.PI / 2),
      new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1, clearcoat: 1, emissive: 0x2a6a8a, emissiveIntensity: 0.25, depthWrite: false }));
    this.water.position.set((a.arenaMin[0] + a.arenaMax[0]) / 2, this.floor, (a.arenaMin[2] + a.arenaMax[2]) / 2);
    this.water.renderOrder = 2;
    this.water.visible = false;
    scene.add(this.water);
    this.stream = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, 1, 12, 1, true).translate(0, 0.5, 0), new THREE.MeshPhysicalMaterial({ color: 0xcfeeff, transparent: true, opacity: 0.6, roughness: 0, emissive: 0x4a8aaa, emissiveIntensity: 0.3, depthWrite: false }));
    this.stream.position.set(0.226, this.floor, 7.48);
    this.stream.visible = false;
    scene.add(this.stream);
    const spiral = document.createElement('canvas');
    spiral.width = spiral.height = 256;
    const sg = spiral.getContext('2d');
    sg.translate(128, 128);
    for (let k = 0; k < 4; k++) {
      sg.rotate(Math.PI / 2);
      sg.strokeStyle = 'rgba(230,248,255,.8)'; sg.lineWidth = 7;
      sg.beginPath();
      for (let t = 0; t < 1; t += 0.02) { const r = 10 + t * 115, th = t * 4.2; sg[t ? 'lineTo' : 'moveTo'](Math.cos(th) * r, Math.sin(th) * r); }
      sg.stroke();
    }
    const st = new THREE.CanvasTexture(spiral);
    this.whirl = new THREE.Mesh(new THREE.CircleGeometry(0.2, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, opacity: 0.8 }));
    this.whirl.renderOrder = 3;
    this.whirl.visible = false;
    scene.add(this.whirl);
  }

  get position() { return this.holder.position; }
  center(out = new THREE.Vector3()) { return out.copy(this.holder.position).setY(this.holder.position.y + this.r * (1 - this.sink * 0.9)); }
  get shielded() { return this.guards.length > 0; }
  get angry() { return this.hp < this.maxHp * this.def.skills.enrage.at; }

  damage(amount, color = '#fff', feedback = {}) {
    if (this.dead || this.dying || this.rise < 1) return;
    if (this.shielded) { this.fx.number(this.center().setY(this.floor + 0.05), 'IN THE DRAIN', '#cfe6ff', 12); return; }
    this.hp -= amount;
    this.hitPop = 1;
    this.fx.number(this.center().setY(this.holder.position.y + this.r * 2.2), amount, color, 16, feedback);
    if (this.hp <= 0) { this.hp = 0; this.dying = true; }   // doomed, not dead: the cat finishes it (main.js)
  }

  // Dendi's paw lands: now it dies (the death animation in tick() takes over)
  die() { if (this.dying) { this.dying = false; this.dead = true; } }

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
    const SK = this.def.skills;
    const out = { push: null, hurt: 0, hit: 0, slow: 0 };
    const p = this.holder.position, P = player.position, M = this.model;
    const hide = () => { for (const m of [...this.lines, ...this.snares, ...this.volumes(), this.pinTele, ...this.combTeles, this.waveMesh, this.water, this.stream, this.whirl]) { m.visible = false; } this.swirl.visible = false; this.floodOn = this.plugged = false; this.wave = this.pin = this.comb = null; this.lift = 0; };
    if (this.dead) {
      if (!this.deathSound) { this.deathSound = true; sfx.clogDeath(); hide(); this.guards.forEach((e) => this.enemies.kill(e, true)); this.guards = []; }
      this.sink = Math.min(1, this.sink + dt * 0.6);
      this.place(dt);
      this.holder.scale.multiplyScalar(Math.max(0, 1 - dt * 0.8));
      if (Math.random() < dt * 25) this.fx.puff(this.center().add(new THREE.Vector3().randomDirection().multiplyScalar(this.r)), 0x3b2618, 0.03, 0.5);
      return out;
    }
    // doomed: it stops where it was hit, waiting for the cat
    if (this.dying) return out;
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
    const angry = this.angry, toP = this._toP.copy(P).sub(p).setY(0), dist = toP.length();
    let mouth = 0;
    this.stateT -= dt;

    // the swarm: the first time it drops below 70%, whatever it was doing
    if (!this.swarmed && this.hp < this.maxHp * SK.swarm.at && this.state !== 'swarm') { hide(); this.state = 'swarm'; this.stateT = 1.4; this.swarmT = 0; sfx.clogRoar(); }

    if (this.state === 'chase') {
      this.bound(dt, P, toP, dist, angry);
      if (this.stateT <= 0 && !this.hop) this.pick();
    } else if (this.state === 'pinball') {
      mouth = this.pinball(dt, P, player, out, angry);
    } else if (this.state === 'comb') {
      mouth = this.combing(dt, P, player, out, angry);
    } else if (this.state === 'lash') {
      // a rope (two when angry) rears up while its line fills on the floor; the aim locks halfway
      const wind = angry ? SK.lash.angryWindup : SK.lash.windup, n = angry ? 2 : 1;
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
          juice.feel('impact');
          this.squash = Math.max(this.squash, 0.45);                     // it heaves down with the rope
          this.lines.forEach((L, i) => {
            if (!L.visible) return;
            L.material.progress = 1;
            const a = L.rotation.y, d = this._d.set(Math.sin(a), 0, Math.cos(a));
            const tip = this._tip.copy(p).addScaledVector(d, 0.42).setY(this.floor + 0.01);
            this.fx.impact(tip, hostile('clog'), 0.03, 12);
            this.fx.burst(tip, ['#3b2618', '#8a9a5a', '#5a3a24'], 6, 0.003, 0.25, this.floor);
            this.fx.splat(tip, GUNK(), 0.03);                              // where the rope slapped down: a wet smear
            this.fx.splat(this._puff.copy(p).addScaledVector(d, 0.22).setY(this.floor), GUNK(), 0.022);
            // anything of the jelly in the low lane along the line (jumping over it clears it)
            if (laneHits(this._lane.copy(L.position).setY(this.floor), d, this.lashLen, this.lashW, this.lashH, P, player.cfg)) { out.hit = SK.lash.dmg; out.slow = SK.lash.slow; this.contact(P, player.cfg); }
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
        if (this.stateT <= 0) {
          this.locked = true; this.stateT = SK.roll.time; this.rollWind = null; L.visible = false; sfx.clogRoll();
          // off it goes: a burst of grime behind it, stretched long, the camera kicked
          this.fx.impact(this._puff.copy(p).setY(this.floor + 0.02), hostile('clog'), LOOK.num('act2-muzzle-flash', 0.014) * 2.5, 10);
          this.fx.puff(this._puff, 0x6a5a3a, 0.05, 0.4);
          this.squash = -0.5; this.trailT = 0; juice.feel('hit');
          this.rollAt.copy(p).setY(this.floor); this.rollDir.set(Math.sin(this.heading), 0, Math.cos(this.heading)); this.rollHit = false;
        }
      } else {
        // the lane it rolls down, as far as its front has got: anything of the jelly in it is hit
        // (once a roll), at any height up to the top of the hairball, so a jump doesn't clear it
        const reached = Math.min(this.rollLen, _rel.copy(p).sub(this.rollAt).dot(this.rollDir) + this.r);
        if (!this.rollHit && this.knock <= 0 && laneHits(this.rollAt, this.rollDir, reached, this.rollW, this.rollH, P, player.cfg)) {
          this.rollHit = true; out.hit = SK.roll.dmg; this.knockBack(toP, 1.0);
          this.slam(_rel.copy(toP).normalize().multiplyScalar(this.r).add(p).setY(P.y + 0.03), 1);   // it rolls into you: the wet slam where it struck
        }
        const wall = this.drive(dt, null, angry ? SK.roll.angrySpeed : SK.roll.speed, 0);
        if (Math.random() < dt * 25) this.fx.puff(p.clone().setY(this.floor + 0.01), 0x6a5a3a, 0.025, 0.35);
        if ((this.trailT -= dt) <= 0) { this.trailT = LOOK.num('clog-trail-every', 0.1); this.fx.splat(this._puff.copy(p).setY(this.floor), GUNK(), this.r * 0.35); }   // the track it leaves
        if (wall || this.stateT <= 0) {
          this.locked = false; sfx.clogSlam(); this.squash = 0.9;
          this.fx.impact(p.clone().setY(this.floor + 0.02), hostile('clog'), this.r * 0.6, 16);
          this.fx.burst(p.clone().setY(this.floor + 0.04), HAIR.slice(0, 6), 12, 0.004, 0.45, this.floor);
          this.fx.splat(this._puff.copy(p).setY(this.floor), GUNK(), this.r * 0.6);
          juice.feel(wall ? 'impact-big' : 'hit');
          this.toChase();
        }
      }
    } else if (this.state === 'snare') {
      // three circles fill round you (they follow you until halfway), then hair springs up in them
      const wind = SK.snare.windup - 0.25;   // the state's last quarter second is the spring itself
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
        juice.feel('impact');
        this.squash = Math.max(this.squash, 0.5); this.chomp = 0.3;   // it clenches as its hair springs
        for (const m of this.snares) {
          const c = m.position;
          this.fx.impact(this._puff.copy(c).setY(this.floor + 0.01), hostile('clog'), 0.025, 8);
          this.fx.splat(this._puff.setY(this.floor), GUNK(), 0.035);
          for (let k = 0; k < 7; k++) {
            const tuft = new THREE.Mesh(this.tuftGeo, this.tuftMat);
            const a = (k / 7) * Math.PI * 2;
            tuft.position.set(c.x + Math.cos(a) * 0.025, this.floor, c.z + Math.sin(a) * 0.025);
            tuft.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
            this.scene.add(tuft);
            this.tufts.push({ m: tuft, t: 0 });
          }
          this.fx.burst(c.clone().setY(this.floor + 0.01), ['#3b2618', '#2a1a10', '#8a9a5a'], 6, 0.003, 0.3, this.floor);
          if (blastHits(_rel.copy(c).setY(this.floor), this.snareR, P, player.cfg)) { out.hit = SK.snare.dmg; out.slow = SK.snare.slow; this.contact(P, player.cfg); }   // a floor Blast: its half sphere
          m.visible = false;
        }
      }
      if (this.stateT <= 0) { this.sprung = false; hide(); this.toChase(); }
    } else if (this.state === 'flood') {
      // Fill and drain: the spout gushes and the tub fills (a ring round the drain fills with it,
      // showing where the whirlpool will be); then the plug pulls and it all drains at once, a
      // whirlpool dragging you toward the drain. Right by the drain it hurts.
      const fill = 1.8, hold = 0.3, drainT = 3.0, el = this.floodMax - this.stateT, W = this.water, s = this.swirl;
      if (!this.floodOn) { this.floodOn = true; W.visible = true; sfx.clogPour(fill); }
      this.drive(dt, this.drain, el < fill ? 0.05 : 0.12, 2);
      s.visible = true;
      s.position.copy(this.drain).setY(this.waterY + 0.002);
      s.scale.setScalar(0.32);
      if (el < fill) {
        // filling: the stream from the spout, the level rising, the ring filling
        const u = el / fill;
        this.waterY = this.floor + 0.004 + u * 0.1;
        this.stream.visible = true;
        this.stream.scale.y = Math.max(0.01, 0.633 - this.waterY);
        this.stream.position.y = this.waterY;
        s.material.progress = u;
        s.material.opacity = 0.6 + 0.2 * Math.sin(this.t * 12);
        if (Math.random() < dt * 40) this.fx.puff(this._puff.set(0.226, this.waterY + 0.005, 7.48 + (Math.random() - 0.5) * 0.02), 0xdff4ff, 0.012, 0.35);
      } else if (el < fill + hold) {
        this.stream.visible = false;
        s.material.progress = 1;
        s.material.opacity = 1;
        if (!this.plugged) {
          this.plugged = true; sfx.clogDrain(drainT); sfx.clogPlug();
          // the plug pulled: a flash and a ring at the drain, the hairball heaving, the camera kicked
          this.fx.impact(this._puff.copy(this.drain).setY(this.waterY + 0.01), hostile('clog'), 0.05, 16);
          this.fx.ring(this._puff, hostile('clog'), 0.2, 0.5);
          this.squash = Math.max(this.squash, 0.6); this.chomp = 0.5; juice.feel('impact');
        }
      } else {
        // draining: the level drops fast and the whirlpool pulls
        const u = Math.min(1, (el - fill - hold) / drainT);
        this.waterY = this.floor + 0.004 + 0.1 * (1 - u) * (1 - u);
        s.material.progress = 1;
        s.material.opacity = 0.9;
        this.whirl.visible = true;
        this.whirl.position.copy(this.drain).setY(this.waterY + 0.003);
        this.whirl.rotation.y -= dt * 9;
        const toDrain = this._toDrain.copy(this.drain).sub(P).setY(0), dd = toDrain.length(), side = this._side.set(-toDrain.z, 0, toDrain.x).normalize();
        const k = THREE.MathUtils.clamp(1.4 - dd * 0.55, 0.75, 1.15) * (1 - u * 0.25) * (angry ? 1.1 : 1);   // strong from anywhere in the tub: just short of your move speed (0.42) up close
        out.push = toDrain.normalize().multiplyScalar(SK.flood.pull * k).addScaledVector(side, 0.12 * k);   // in and round, like a real whirlpool
        if (dd < 0.055 && Math.abs(P.y - this.floor) < 0.08) {
          out.hurt = SK.flood.dmg * dt;
          // sucked in against it: a gulp every so often (a flash and a splash on you, it squashes and chomps)
          if ((this.gulpT = (this.gulpT || 0) - dt) <= 0) {
            this.gulpT = 0.3;
            this.fx.impact(this._puff.copy(P).setY(P.y + player.cfg.height * 0.5), hostile('clog'), LOOK.num('act2-contact-flash', 0.03) * 0.7, 8);
            this.fx.burst(this._puff, ['#dff4ff', '#8a9a5a', '#3b2618'], 5, 0.003, 0.3, this.floor);
            this.squash = Math.max(this.squash, 0.35); this.chomp = 0.3; sfx.clogSplat();
          }
        }
        this.grate.rotation.y += dt * 14;
        if (Math.random() < dt * 40) { const a = Math.random() * 6.3, rr = 0.03 + Math.random() * 0.28; this.fx.puff(this._puff.copy(this.drain).add(this._side.set(Math.cos(a) * rr, this.waterY - this.drain.y + 0.006, Math.sin(a) * rr)), 0xdff4ff, 0.008, 0.3); }   // _side's work (out.push) is done by now
      }
      W.position.y = this.waterY;
      W.material.opacity = 0.55;
      mouth = 0.7;
      if (this.stateT <= 0) {
        this.floodOn = this.plugged = false; W.visible = this.whirl.visible = this.stream.visible = s.visible = false;
        // the bath gone, scum rings are left round the drain a while (harmless: they fade)
        for (let k = 0; k < 6; k++) { const a = k * 1.05 + Math.random() * 0.5, rr = 0.06 + Math.random() * 0.2; this.fx.splat(this._puff.set(this.drain.x + Math.cos(a) * rr, this.floor, this.drain.z + Math.sin(a) * rr), LOOK.color('clog-scum', '#8a9a7a'), 0.03 + Math.random() * 0.03); }
        this.toChase();
      }
    } else if (this.state === 'shed') {
      // it shakes, and hair tangles fly off it
      mouth = 0.5;
      M.root.position.x = (Math.random() - 0.5) * 0.006;
      if (this.prevT > 0.4 && this.stateT <= 0.4) {
        const n = SK.shed.count + (angry ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const a = this.heading + (k - (n - 1) / 2) * 1.1 + Math.PI;
          const q = p.clone().add(V(Math.sin(a), 0, Math.cos(a)).multiplyScalar(this.r + 0.04));
          this.clampIn(q);
          this.enemies.spawn('hair', q.setY(this.floor), 1.3);
          // a clump flying off it to where the tangle lands (it grows in as the clump gets there), and a smear there
          const from = this.center(this._puff);
          this.fx.glow.emit(from, hostile('clog'), 0.03, 0.012, 0.22, 1, this._side.copy(q).sub(from).divideScalar(0.22));
          this.fx.burst(from, HAIR.slice(0, 6), 3, 0.004, 0.4, this.floor);
          this.fx.splat(q, GUNK(), 0.03);
        }
        this.fx.puff(this.center(), 0x3b2618, 0.07, 0.5);
        this.fx.impact(this.center(this._puff), hostile('clog'), 0.04, 14);
        this.squash = Math.max(this.squash, 0.6); juice.feel('hit');
        sfx.clogShed();
      }
      if (this.stateT <= 0) { M.root.position.x = 0; this.toChase(); }
    } else if (this.state === 'spray') {
      // spinning, spraying globs of drain gunk all round
      this.heading += dt * 8;
      M.root.rotation.y = this.heading;
      mouth = 1;
      this.sprayT = (this.sprayT ?? 0) - dt;
      if (this.sprayT <= 0) {
        // three streams at once, a third of a turn apart, a glob every tenth of a second: Shots
        // (fx.shot), each volley alternating floor level (jump it) and jump height (stay down)
        this.sprayT = SK.spray.every;
        this.volley = ((this.volley || 0) + 1) % 2;
        const y = shotTarget(P, player.cfg, this.volley ? SHOT_HEIGHT.jump : SHOT_HEIGHT.floor, this.floor).y;
        for (let k = 0; k < 3; k++) {
          const a = this.heading + k * Math.PI * 2 / 3, dir = V(Math.sin(a), 0, Math.cos(a));
          const from = p.clone().addScaledVector(dir, this.r).setY(y), to = p.clone().addScaledVector(dir, Math.max(dist, this.r + 0.15)).setY(y);
          this.shots.push(this.fx.shot(hostile('clog'), from, to, { speed: SK.spray.speed, size: 0.008, life: 1.4 }));
          this.fx.impact(from, hostile('clog'), LOOK.num('act2-muzzle-flash', 0.014), 2);   // spat out of its hair
        }
        this.squash = Math.max(this.squash, 0.15);                       // a heave with every volley
        sfx.clogSpit();
      }
      if (this.stateT <= 0) this.toChase();
    } else if (this.state === 'swarm') {
      // a roar, four ladybugs burst out of its hair, and down into the drain it goes
      this.swarmT += dt;
      mouth = 1;
      M.root.position.x = (Math.random() - 0.5) * 0.008;
      if (!this.guards.length && this.swarmT > 0.8 && !this.swarmed) {
        this.swarmed = true;
        for (let k = 0; k < SK.swarm.count; k++) {
          const a = this.heading + (k / 4) * Math.PI * 2 + Math.PI / 4;
          const q = this.clampIn(p.clone().add(V(Math.sin(a), 0, Math.cos(a)).multiplyScalar(this.r + 0.05))).setY(this.floor + 0.1);
          const e = this.enemies.spawn('ladybug', q, 1.2);
          e.spawnT = 0.5;
          e.stateT = 2.5 + k * 0.7;                                     // they don't all land at once
          e.vel.set(Math.sin(a) * 0.3, 0.35, Math.cos(a) * 0.3);
          this.guards.push(e);
        }
        this.guardT = SK.swarm.shield;
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
    this.syncVolumes();
    this.prevT = this.stateT;
    if (this.state !== 'swarm' && this.sink > 0) this.sink = Math.max(0, this.sink - dt);
    if (angry && !this.wasAngry) sfx.clogRoar();
    this.wasAngry = angry;
    if ((this.chomp = Math.max(0, (this.chomp || 0) - dt)) > 0) mouth = 1;
    this.place(dt);
    this.animate(dt, mouth);

    // bumping into it knocks you back (not while it's down the drain)
    if (this.knock <= 0 && this.sink < 0.3 && dist < this.r + 0.02 && Math.abs(P.y - (p.y - this.r * 0.05)) < 0.12) {
      const rolling = this.state === 'roll' && this.locked;
      out.hit = Math.max(out.hit, rolling ? SK.roll.dmg : this.def.contact);
      out.slow = Math.max(out.slow, SK.chase.tangle ?? 0.8);                  // a mouthful of hair: tangled for a moment
      this.knockBack(toP, rolling ? 1.0 : 0.8);
      this.slam(_rel.copy(toP).normalize().multiplyScalar(this.r).add(p).setY(P.y + 0.03), 1);
      this.chomp = 0.45;
    }
    this.waves(dt, P, player, out);
    if (this.knock > 0) { this.knock -= dt; out.push = (out.push || new THREE.Vector3()).clone().addScaledVector(this.knockDir, this.knockSpeed); }

    // gunk globs
    for (const s of this.shots) {
      if (this.fx.shotStep(s, dt, this.world, P, player.cfg)) { out.hit = Math.max(out.hit, SK.spray.dmg); this.contact(P, player.cfg, 0.6); }
      if (s.done) { this.fx.splat(this._puff.set(s.m.position.x, this.floor, s.m.position.z), GUNK(), 0.014); sfx.clogSplat(); }   // where the glob ended: a smear
    }
    this.shots = this.shots.filter((s) => !s.done);
    // hair tufts from a snare: up, then back down
    for (const f of this.tufts) {
      f.t += dt;
      f.m.scale.set(1, Math.min(1, f.t * 8) * Math.max(0, 1 - (f.t - 0.5) * 2), 1);
      if (f.t > 1) { this.scene.remove(f.m); f.done = true; }
    }
    this.tufts = this.tufts.filter((f) => !f.done);
    return out;
  }

  volumes() { return [...this.lashVols, this.rollVol, ...this.snareVols, this.pinVol, this.waveVol, ...this.combVols]; }
  // each volume shows, sits, turns and fills with the floor Warning it stands over
  syncVolumes() {
    const pair = (v, f, on) => {
      v.visible = on && f.visible;
      if (!v.visible) return;
      v.position.copy(f.position).setY(this.floor);
      v.rotation.y = f.rotation.y;
      v.material.progress = f.material.progress;
      v.material.opacity = f.material.opacity;
    };
    this.lashVols.forEach((v, i) => pair(v, this.lines[i], this.state === 'lash'));
    pair(this.rollVol, this.lines[0], this.state === 'roll');
    this.snareVols.forEach((v, i) => pair(v, this.snares[i], true));
    pair(this.pinVol, this.pinTele, this.state === 'pinball');
    if (this.pinVol.visible) { this.pinVol.position.copy(this.pinTele.position).setY(this.floor); this.pinVol.scale.setScalar(this.pinTele.scale.x); }
    this.combVols.forEach((v, i) => {
      pair(v, this.combTeles[i], this.state === 'comb');
      if (v.visible) v.scale.set(this.combTeles[i].scale.x, this.combH, this.combTeles[i].scale.z);
    });
  }

  // how high it sits: on the tub floor, sunk into the drain as `sink` goes to 1
  place(dt) {
    const p = this.holder.position;
    p.y = this.floor + this.r * 0.05 - this.sink * this.r * 1.6 + this.lift;
    const b = 1 + (this.hitPop || 0) * 0.04, q = this.squash;
    this.model.root.scale.set(b * (1 + q * 0.22), b * (1 - q * 0.3), b * (1 + q * 0.22));   // squashed flat and wide (+), or stretched tall (-)
    this.squash *= Math.exp(-7 * dt);
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

  // Between attacks it bounds after you: it crouches (squashing, turning to you), then hops a
  // short way toward you, juking a little to one side, stretched tall in the air, and lands with
  // a squash, a thud and dust
  bound(dt, P, toP, dist, angry) {
    const H = this.def.skills.chase, p = this.holder.position;
    if (!this.hop) {
      this.drive(dt, P, 0, 3);
      this.hopWait -= dt;
      if (this.hopWait < 0.16) this.squash = Math.max(this.squash, 0.55 * (1 - this.hopWait / 0.16));   // the crouch
      if (this.hopWait <= 0) {
        const juke = (Math.random() - 0.5) * 1.1, len = Math.min(H.hop ?? 0.16, Math.max(0.04, dist - this.r * 0.6));
        const a = Math.atan2(toP.x, toP.z) + juke;
        this.hop = { t: 0, dur: H.air ?? 0.32, from: p.clone(), to: this.clampIn(p.clone().add(V(Math.sin(a), 0, Math.cos(a)).multiplyScalar(len))) };
        this.heading = a;
        sfx.clogHop(false);
      }
      return;
    }
    const h = this.hop;
    h.t += dt;
    const u = Math.min(1, h.t / h.dur);
    p.x = h.from.x + (h.to.x - h.from.x) * u;
    p.z = h.from.z + (h.to.z - h.from.z) * u;
    this.lift = 4 * (H.height ?? 0.05) * u * (1 - u);
    this.squash = -0.35 * Math.sin(Math.PI * u);
    this.model.root.rotation.y = this.heading;
    this.model.roll.rotation.x += dt * 9;
    if (u >= 1) {
      this.hop = null; this.lift = 0; this.squash = 0.7;
      this.hopWait = angry ? (H.angryEvery ?? 0.4) : (H.every ?? 0.6);
      for (let k = 0; k < 4; k++) this.fx.puff(_rel.copy(p).setY(this.floor + 0.008).add(this._side.set(Math.cos(k * 1.57), 0, Math.sin(k * 1.57)).multiplyScalar(this.r * 0.9)), 0x8a7a5a, 0.022, 0.35);
      sfx.clogHop(true);
      if (dist < 0.5) juice.feel('hit');
    }
  }

  // a heavy wet impact at `at`: a flash, hair and gunk flying, a puff, a splat left on the floor,
  // a slam you feel (k: how big, 1 a bump into it or a pinball landing)
  slam(at, k = 1) {
    this.fx.impact(at, hostile('clog'), 0.045 * k, 20);
    this.fx.burst(at, [...HAIR.slice(0, 6), '#8a9a5a', '#8a9a5a'], 14, 0.0045, 0.5, this.floor);
    this.fx.puff(at, 0x3b2618, 0.05 * k, 0.5);
    this.fx.splat(_rel.set(at.x, this.floor, at.z), GUNK(), 0.045 * k);
    juice.feel('impact-big');
    sfx.clogSlam();
    this.squash = Math.max(this.squash, 0.8);
  }

  // an attack catching the jelly (P its feet): a flash and gunk flying off it, a smear under it,
  // the impact shake (k: how big)
  contact(P, cfg, k = 1) {
    const c = this._contact.copy(P).setY(P.y + cfg.height * 0.5);
    this.fx.impact(c, hostile('clog'), LOOK.num('act2-contact-flash', 0.03) * k, 10);
    this.fx.burst(c, [...HAIR.slice(0, 4), '#8a9a5a'], 6, 0.0035, 0.35, this.floor);
    this.fx.splat(this._contact.setY(this.floor), GUNK(), 0.025 * k);
    juice.feel('impact');
  }

  // Pinball: three leaps at you. Each crouch and flight its landing spot (a circle with a half
  // sphere over it, the slam's radius) follows you, locking `lock` s before it lands; the landing
  // is a Blast round it. The last slam rolls a ring wave out (waves()). Returns how open its maw is.
  pinball(dt, P, player, out) {
    const S = this.def.skills.pinball, p = this.holder.position, R = S.radius;
    const J = (this.pin ||= { k: 0, phase: 'crouch', t: 0, at: new THREE.Vector3().copy(P), from: new THREE.Vector3() });
    J.t += dt;
    const wind = J.k ? S.windup * 0.7 : S.windup, left = J.phase === 'crouch' ? wind - J.t + S.air : J.phase === 'air' ? S.air - J.t : 0;
    if (J.phase !== 'land') {
      if (left > S.lock) this.clampIn(J.at.set(P.x, this.floor, P.z));
      const T = this.pinTele;
      T.visible = true;
      T.position.copy(J.at).setY(this.floor + 0.003);
      T.scale.setScalar(R);
      T.material.progress = 1 - left / (wind + S.air);
      T.material.opacity = 0.75 + 0.25 * Math.abs(Math.sin(this.t * (left < S.lock ? 30 : 12)));
    }
    if (J.phase === 'crouch') {
      this.drive(dt, J.at, 0, 5);
      this.squash = Math.max(this.squash, 0.75 * Math.min(1, J.t / wind));
      M_shake(this.model, 0.004);
      if (J.t >= wind) { J.phase = 'air'; J.t = 0; J.from.copy(p); sfx.clogLeap(); this.fx.puff(_rel.copy(p).setY(this.floor + 0.01), 0x8a7a5a, 0.05, 0.4); }
      return 0.6;
    }
    if (J.phase === 'air') {
      const u = Math.min(1, J.t / S.air);
      p.x = J.from.x + (J.at.x - J.from.x) * u;
      p.z = J.from.z + (J.at.z - J.from.z) * u;
      this.lift = 4 * S.height * u * (1 - u);
      this.squash = -0.45 * Math.sin(Math.PI * u);
      this.model.roll.rotation.x += dt * 14;
      if (u >= 1) {
        this.lift = 0; this.pinTele.visible = false;
        this.slam(_rel.copy(J.at).setY(this.floor + 0.02), 1.4);
        this.fx.ring(this._puff.copy(J.at).setY(this.floor + 0.004), hostile('clog'), R * 1.2, 0.35);
        if (blastHits(this._at.copy(J.at).setY(this.floor), R, P, player.cfg)) { out.hit = S.dmg; this.knockBack(_rel.copy(P).sub(J.at), S.knock); }
        J.k++; J.phase = 'land'; J.t = 0;
        if (J.k >= S.count) this.wave = { at: J.at.clone(), r: this.r, hit: false };
      }
      return 1;
    }
    if (J.t >= (J.k >= S.count ? 0.6 : 0.16)) {
      if (J.k >= S.count) { this.pin = null; this.toChase(); } else { J.phase = 'crouch'; J.t = 0; }
    }
    return 0.3;
  }

  // the ring wave the last pinball slam rolls out: a low wall across the tub floor; jump it
  waves(dt, P, player, out) {
    const W = this.wave, S = this.def.skills.pinball;
    if (!W) { this.waveMesh.visible = this.waveVol.visible = false; return; }
    const was = W.r;
    W.r = Math.min(S.ring, W.r + dt * S.ringSpeed);
    const k = W.r / S.ring;
    this.waveMesh.visible = this.waveVol.visible = true;
    this.waveMesh.position.copy(W.at).setY(this.floor + 0.004);
    this.waveMesh.scale.setScalar(W.r);
    this.waveMesh.material.opacity = 0.9 * (1 - k);
    this.waveVol.position.copy(W.at).setY(this.floor);
    this.waveVol.scale.set(W.r, S.ringH, W.r);
    this.waveVol.material.progress = 1;
    this.waveVol.material.opacity = 1 - k;
    if (!W.hit && ringHits(this._at.copy(W.at).setY(this.floor), Math.max(0, was - 0.03), W.r, S.ringH, P, player.cfg)) {
      W.hit = true; out.hit = Math.max(out.hit, S.ringDmg); this.knockBack(_rel.copy(P).sub(W.at), 0.5);
    }
    if (W.r >= S.ring) this.wave = null;
  }

  // Comb: hair curtains slam down across the tub in `lanes` lanes side by side round where you
  // were (each a strip across the tub with a lane too tall to jump): every other lane, then the
  // ones between, then every other again, each wave's Warning filling for `windup` (`next` after
  // the first). Step into the lane that just struck. Returns how open its maw is.
  combing(dt, P, player, out, angry) {
    const S = this.def.skills.comb, a = this.arena, n = this.combTeles.length;
    if (!this.comb) {
      // the lanes, centred on you, kept inside the tub
      const w = S.width, half = (n * w) / 2, x0 = THREE.MathUtils.clamp(P.x, a.arenaMin[0] + half, a.arenaMax[0] - half);
      this.combX = this.combTeles.map((_, i) => x0 - half + w * (i + 0.5));
      this.comb = { wave: 0, t: 0 };
      this.combH = S.height;
    }
    const C = this.comb, wind = (C.wave ? S.next : S.windup) * (angry ? 0.8 : 1), len = a.arenaMax[2] - a.arenaMin[2];
    C.t += dt;
    this.drive(dt, P, 0, 3);
    M_shake(this.model, 0.003);
    this.combTeles.forEach((T, i) => {
      T.visible = i % 2 === C.wave % 2;
      if (!T.visible) return;
      T.position.set(this.combX[i], this.floor + 0.003, a.arenaMin[2]);
      T.rotation.y = 0;
      T.scale.set(S.width, 1, len);
      T.material.progress = Math.min(1, C.t / wind);
      T.material.opacity = 0.75 + 0.25 * Math.abs(Math.sin(this.t * 22));
    });
    if (C.t >= wind) {
      sfx.clogLash(); juice.feel('impact');
      const dir = this._d.set(0, 0, 1);
      this.combTeles.forEach((T, i) => {
        if (!T.visible) return;
        for (let k = 0; k < 3; k++) {
          const at = this._tip.set(this.combX[i], this.floor + 0.02, a.arenaMin[2] + len * (k + 0.5) / 3);
          this.fx.impact(at, hostile('clog'), 0.025, 8);
          this.fx.burst(at, HAIR.slice(0, 5), 4, 0.003, 0.3, this.floor);
          const tuft = new THREE.Mesh(this.tuftGeo, this.tuftMat);
          tuft.position.set(at.x, this.floor, at.z); tuft.scale.set(2.5, 1, 2.5);
          this.scene.add(tuft); this.tufts.push({ m: tuft, t: 0 });
        }
        if (laneHits(this._lane.set(this.combX[i], this.floor, a.arenaMin[2]), dir, len, S.width, S.height, P, player.cfg)) { out.hit = S.dmg; out.slow = S.slow; }
        T.visible = false;
      });
      C.wave++; C.t = 0;
      if (C.wave >= S.waves) { this.comb = null; this.toChase(); }
    }
    return 0.8;
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
    this.model.root.position.x = 0;
    this.state = 'chase';
    this.stateT = this.angry ? this.def.skills.chase.angryTime : this.def.skills.chase.time;
    this.locked = false;
  }

  // the next attack, in a loop (the spray joins once it's angry)
  pick() {
    const order = this.angry ? ATTACKS.angry : ATTACKS.calm;
    this.state = order[this.next++ % order.length];
    const SK = this.def.skills;
    this.stateT = { lash: (this.angry ? SK.lash.angryWindup : SK.lash.windup) + 0.3, snare: SK.snare.windup, roll: SK.roll.windup, flood: SK.flood.time, shed: SK.shed.time, spray: SK.spray.time, pinball: 99, comb: 99 }[this.state];
    this.pin = this.comb = null;
    this.floodMax = this.stateT;
    ({ lash: () => sfx.clogLashWind(), roll: () => sfx.clogRollWind(), snare: () => sfx.clogRustle(), spray: () => sfx.clogRoar(), pinball: () => sfx.clogRoar(), comb: () => sfx.clogRustle() })[this.state]?.();
    this.prevT = this.stateT;
    this.locked = false;
  }

  dispose() {
    this.scene.remove(this.holder);
    for (const m of [...this.lines, ...this.snares, ...this.volumes(), this.pinTele, ...this.combTeles, this.waveMesh, this.swirl, this.grate, this.water, this.stream, this.whirl]) this.scene.remove(m);
    this.tufts.forEach((f) => this.scene.remove(f.m));
    this.shots.forEach((s) => this.fx.free(s.m));
  }
}
