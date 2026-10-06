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
//   soap        on the bathroom vanity (act 2): the glass soap dispenser by the tap. The pink soap
//               inside drains as it's hurt (its level is its health).
//     Soap squirt:    it pumps three times; each squirt lobs a glob of soap onto a pink circle
//                     filling where you stand. A hit stings, and it leaves a slick: soap underfoot
//                     takes away your grip, so you slide.
//     Bubble ring:    it foams up while a pink ring fills around it, then lets go a ring of soap
//                     bubbles drifting outward, with one gap to slip through.
//     Under half health it's angry: quicker, four squirts, and a second ring right after the
//     first with its gap somewhere else.
//   clock       the ornate wall clock over the hallway's cubby bench (act 2; clock-model.js). It
//               hangs on the wall; when you come onto the bench it slides down the wall to fight
//               you there (its bearded mask is its face and the place to hit), and goes back up
//               when you leave or beat it. Its hands keep real time.
//     Sweeping hands: a half-circle fills on the bench while its hands spin, then a golden hand
//                     sweeps right across it: jump it, or be in a far corner of the bench.
//     Victory's wreath: Victory raises her laurel wreath while a line on the bench shows where
//                     she'll throw it (it locks halfway), then it flies out and comes back along it.
//     Striking the hour (under half health): it chimes three times, each chime a golden ring
//                     rolling out across the bench: jump each one.
//   whipper     the cream whipper and its N2O cylinder on the hall floor by the front door (act 2;
//               whipper-model.js). The cylinder has the face; the gauges' needles swing as it works.
//     Balloon:        it blows a balloon up on its nozzle (a hiss, the gauges climbing), lets it go,
//                     and the balloon drifts after you for 3 s with a circle on the floor showing
//                     how far its burst reaches, filling and blinking faster, then bursts. Caught
//                     in it: 2, and all the sound goes deep and muffled for 5 s (sfx.js deepen),
//                     easing back to normal after.
//     Cream spray:    it tips toward you while a cone fills on the floor, then sprays whipped cream
//                     along it: 2, and the cream slows you.
//     Under half health it's angry: two balloons each time, and a longer spray.
//
// To the rest of the game each elite is a "proxy" enemy (enemies.addProxy), so bubbles,
// tentacles, treasures and the minimap treat it like any other target.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { angryEyes, standOut } from './enemies.js';
import { LOOK } from './look.js';
import { juice } from './juice.js';
import { sfx, deepen } from './sfx.js';
import { bus, PLAYER } from './events.js';
import { hostile, TeleMaterial } from './vfx.js';
import { buildClock, CLOCK } from './clock-model.js';
import { buildWhipper, buildBalloon } from './whipper-model.js';

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

// the soap dispenser's label: a pastel citrus print with its name across it
function soapLabel() {
  const c = document.createElement('canvas');
  c.width = 160; c.height = 112;
  const g = c.getContext('2d');
  g.fillStyle = '#fbf3e6'; g.fillRect(0, 0, 160, 112);
  g.strokeStyle = '#e86aa0'; g.lineWidth = 6; g.strokeRect(3, 3, 154, 106);
  const slice = (x, y, r, rind, flesh) => {
    g.fillStyle = rind; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = flesh; g.beginPath(); g.arc(x, y, r * 0.82, 0, 7); g.fill();
    g.strokeStyle = rind; g.lineWidth = 1.5;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82); g.stroke(); }
  };
  slice(28, 30, 15, '#e8b81a', '#fff2a0'); slice(132, 28, 13, '#f07a2a', '#ffc890'); slice(30, 86, 12, '#f07a2a', '#ffc890'); slice(130, 84, 15, '#e8b81a', '#fff2a0');
  g.fillStyle = '#6aa83a'; for (const [x, y, a] of [[50, 20, 0.6], [112, 40, -0.5], [48, 74, -0.4], [110, 96, 0.5]]) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 9, 4, 0, 0, 7); g.fill(); g.restore(); }
  g.fillStyle = '#c8326e'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.fillText('SOAP', 80, 64);
  g.font = '11px sans-serif'; g.fillStyle = '#8a5a6a'; g.fillText('citrus · hand wash', 80, 80);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A square glass pump bottle: thick clear glass, pink soap inside (its level shows the health
// left) with bubbles drifting up through it, a printed label, a white collar and pump with the
// nozzle out the front. The pump head presses down when it squirts. About 13 cm tall.
function soapModel() {
  const g = new THREE.Group();
  const W = 0.07, H = 0.085;
  const glass = new THREE.MeshStandardMaterial({ color: 0xdaebe7, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.1, depthWrite: false });
  const white = std(0xefefea, { roughness: 0.35 });
  add(g, new RoundedBoxGeometry(W, H, W, 4, 0.008), glass, 0, H / 2, 0).renderOrder = 2;
  add(g, new RoundedBoxGeometry(W * 0.96, 0.009, W * 0.96, 2, 0.003), std(0xcfe2de, { transparent: true, opacity: 0.65, roughness: 0.05 }), 0, 0.0045, 0);   // the thick glass base
  // the soap: a box from the base up, as tall as the soap left
  const liquidH = H * 0.8;
  const liquid = add(g, new THREE.BoxGeometry(W * 0.86, 1, W * 0.86).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xff6aa8, emissive: 0xff2a7a, emissiveIntensity: 0.5, transparent: true, opacity: 0.82, roughness: 0.12 }), 0, 0.009, 0);
  liquid.scale.y = liquidH;
  const bubs = [];
  const bubMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, roughness: 0.05, emissive: 0xffd0e4, emissiveIntensity: 0.4 });
  for (let k = 0; k < 7; k++) {
    const b = add(g, new THREE.SphereGeometry(1, 10, 8), bubMat, (Math.random() - 0.5) * W * 0.6, 0.02, (Math.random() - 0.5) * W * 0.6);
    b.scale.setScalar(0.0025 + Math.random() * 0.003);
    b.userData.rise = Math.random();
    bubs.push(b);
  }
  add(g, new THREE.PlaneGeometry(W * 0.82, H * 0.48), new THREE.MeshStandardMaterial({ map: soapLabel(), roughness: 0.6 }), 0, H * 0.4, W / 2 + 0.0008);
  // collar, stem, and the pump head with its nozzle pointing out the front
  add(g, new THREE.CylinderGeometry(0.014, 0.016, 0.012, 20), white, 0, H + 0.006, 0);
  const stem = add(g, new THREE.CylinderGeometry(0.004, 0.004, 0.024, 10), std(0xdadad6, { metalness: 0.3 }), 0, H + 0.024, 0);
  const head = new THREE.Group();
  head.position.y = H + 0.034;
  g.add(head);
  add(head, new RoundedBoxGeometry(0.03, 0.016, 0.028, 3, 0.005), white, 0, 0.008, 0);
  add(head, new THREE.CylinderGeometry(0.0042, 0.005, 0.036, 10), white, 0, 0.011, 0.026).rotation.x = Math.PI / 2;
  add(head, new THREE.SphereGeometry(0.0035, 8, 6), std(0xff6aa8, { emissive: 0xff2a7a, emissiveIntensity: 0.8 }), 0, 0.011, 0.045);   // a bead of soap at the tip
  const face = angryEyes({ y: 0, z: 0, size: 0.34, gap: 0.42 });
  face.scale.setScalar(0.034);
  face.position.set(0, H * 0.78, W / 2 + 0.002);
  g.add(face);
  return { group: g, muzzle: new THREE.Vector3(0, H + 0.045, 0.048), r: 0.05, head, headY: H + 0.034, stem, liquid, liquidH, bubs };
}

// the clock elite: the model, its hit point (the mask), its health bar over the top
function clockModel() {
  const c = buildClock();
  return { ...c, muzzle: new THREE.Vector3(0, CLOCK.maskY, 0.06), r: 0.07, hitAt: new THREE.Vector3(0, CLOCK.maskY, 0.05), barY: CLOCK.H + 0.06 };
}

// the cream whipper elite: the model, its health bar over the regulator
function whipperModel() {
  const w = buildWhipper();
  return { ...w, muzzle: new THREE.Vector3(0.09, 0.35, 0.02), r: 0.07, barY: 0.47 };
}

const BALLOON = 0.15;      // the Cream Whipper's balloons: scale of the model (about 18 cm tall, 15 cm across)

const KINDS = {
  controller: { name: 'The Controller', hp: 150, aggro: 0.7, scale: 1.5, build: controllerModel },
  mug: { name: 'The Mug', hp: 170, aggro: 0.8, build: mugModel },
  kettle: { name: 'The Kettle', hp: 210, aggro: 0.6, scale: 1.2, build: kettleModel },
  soap: { name: 'The Soap Dispenser', hp: 240, aggro: 0.7, scale: 1.3, build: soapModel },
  clock: { name: 'The Wall Clock', hp: 300, aggro: 0.55, wall: true, build: clockModel },
  whipper: { name: 'The Cream Whipper', hp: 260, aggro: 0.75, build: whipperModel },
};

export const ELITE_NAMES = Object.fromEntries(Object.entries(KINDS).map(([k, K]) => [k, K.name]));

// ------------------------------------------------------------------ one elite
class Elite {
  constructor(owner, spec) {
    const K = KINDS[spec.kind];
    Object.assign(this, { owner, spec, kind: spec.kind, name: K.name, aggro: K.aggro });
    this.maxHp = this.hp = Math.round(K.hp * (owner.hpScale || 1));   // later acts: tougher (stage eliteHp)
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
    if (K.wall) {
      // hung on a wall (spec.wall): it faces out from it and never turns; it comes down to fight
      const w = spec.wall;
      this.wall = w;
      this.hangY = w.y;
      this.fightY = this.base.y + 0.02;
      this.holder.position.set(w.x, w.y, w.z);
      this.holder.rotation.y = w.yaw;
    }
    m.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    standOut(m.group, { base: LOOK.num('elite-glow', 0.2), rim: LOOK.num('elite-rim', 0.6) });   // readable in the dark room
    owner.scene.add(this.holder);
    // its health bar over it, facing the camera: big, outlined and drawn over everything, going
    // green -> yellow -> red as it loses health (the HUD shows it too while it fights you)
    this.bar = new THREE.Group();
    const W = 0.11, H = 0.014;
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.006, H + 0.006), new THREE.MeshBasicMaterial({ color: 0xfff2d0, depthTest: false, toneMapped: false }));
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.002, H + 0.002), new THREE.MeshBasicMaterial({ color: 0x14121a, depthTest: false }));
    this.fill = new THREE.Mesh(new THREE.PlaneGeometry(W, H).translate(W / 2, 0, 0), new THREE.MeshBasicMaterial({ color: 0x5ae05a, depthTest: false, toneMapped: false }));
    back.position.z = 0.0003;
    this.fill.position.set(-W / 2, 0, 0.0006);
    edge.renderOrder = 10; back.renderOrder = 11; this.fill.renderOrder = 12;
    this.bar.add(edge, back, this.fill);
    this.bar.position.y = m.barY ?? m.r * 2.2 + 0.03;
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
  // where bubbles aim and land (enemies.center): a hanging elite's hit point, else just above its base
  center(out = new THREE.Vector3()) {
    const h = this.model.hitAt;
    if (!h) return out.copy(this.base).setY(this.base.y + this.r);
    const c = Math.cos(this.holder.rotation.y), s = Math.sin(this.holder.rotation.y);
    return out.set(h.x * c + h.z * s, h.y, -h.x * s + h.z * c).add(this.holder.position);
  }

  // a hanging elite after it's beaten: back up on its wall as a plain clock (no face, no bar)
  retire() {
    this.clearTele();
    this.decor = true;
    this.bar.visible = false;
    if (this.model.face) this.model.face.visible = false;
    if (this.model.wreath) this.model.wreath.visible = true;
  }

  damage(amount, color = '#fff') {
    if (this.dead) return;
    this.hp -= amount;
    this.hitPop = 1;
    const c = this.center();
    this.owner.fx.number(c.setY(c.y + this.r * 0.6), Math.round(amount), color, 16);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  clearTele() { this.tele.forEach((m) => this.owner.scene.remove(m)); this.tele = []; }

  remove() {
    this.clearTele();
    if (this.inflating) { this.owner.scene.remove(this.inflating.group); this.inflating = null; }   // a balloon half blown up
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
    this.decor = [];         // things that only hang there (the hall clock when it isn't fighting)
    this.decorSpecs = [];    // set by the run: this act's decor (stage.decor)
    this.thrown = [];        // the clock's wreath in flight
    this.balloons = [];      // the Cream Whipper's balloons, drifting after you
    this.rings = [];         // and its chime rings rolling out
    this.halfGeo = new THREE.CircleGeometry(1, 48, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2);   // a half circle pointing +z
    this.ringMat = new THREE.MeshBasicMaterial({ color: hostile('clock').clone().multiplyScalar(1.6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    this.soapBubbles = [];   // the Soap Dispenser's bubble rings, drifting outward
    this.slicks = [];        // and the slippery soap its squirts leave
    this.bubbleGeo = new THREE.SphereGeometry(1, 16, 12);
    this.bubbleMat = new THREE.MeshStandardMaterial({ color: 0xffe0ee, transparent: true, opacity: 0.4, roughness: 0.02, metalness: 0.3, emissive: 0xff4a9a, emissiveIntensity: 0.35, depthWrite: false });
    this.soapMat = new THREE.MeshStandardMaterial({ color: 0xffb8d4, transparent: true, opacity: 0.75, roughness: 0.05, emissive: 0xff4a9a, emissiveIntensity: 0.25 });
    // projectiles are glowing orbs (fx.orb) in each elite's hostile colour (vfx.js, look.css)
    this.coffeeMat = std(0x3a2214, { roughness: 0.08 });
    this.flat = new THREE.CircleGeometry(1, 36).rotateX(-Math.PI / 2);
    this.ringGeo = new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2);
    this.stripGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
    // a 50° wedge pointing +z (Circle geometry's sector starts at +x, so rotate it round)
    this.coneGeo = new THREE.CircleGeometry(1, 24, -0.45, 0.9).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2);
    // floor warnings (vfx.js): outline, a fill that grows to the hit, stripes toward where it lands
    this.T = {
      brown: new TeleMaterial(hostile('mug'), 'strip'), red: new TeleMaterial(hostile('controller')), orange: new TeleMaterial(hostile('kettle')),
      mugCircle: new TeleMaterial(hostile('mug')), steam: new TeleMaterial(hostile('kettle'), 'wedge', 0.45),
      aim: [0, 1, 2].map(() => new TeleMaterial(hostile('controller'), 'strip')),
      puddle: new TeleMaterial(hostile('mug')),
      soap: new TeleMaterial(hostile('soap')), soapRing: new TeleMaterial(hostile('soap')), slick: new TeleMaterial(hostile('soap')),
      blast: new TeleMaterial(hostile('whipper')), cream: new TeleMaterial(hostile('whipper'), 'wedge', 0.45),
      sweep: new TeleMaterial(hostile('clock'), 'wedge', Math.PI / 2), beam: new TeleMaterial(hostile('clock'), 'strip'), wreath: new TeleMaterial(hostile('clock'), 'strip'), chime: new TeleMaterial(hostile('clock')),
    };
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
    // what only hangs there (unless it's fighting this time)
    for (const s of this.decorSpecs) if (!specs.some((q) => q.kind === s.kind)) { const d = new Elite(this, s); d.retire(); this.decor.push(d); }
  }

  clear() {
    this.list.forEach((e) => { e.remove(); if (e.entry) e.entry.dead = true; });
    this.list = [];
    this.decor.forEach((e) => e.remove());
    this.decor = [];
    for (const w of this.thrown) this.scene.remove(w.m);
    for (const r of this.rings) this.scene.remove(r.m);
    for (const b of this.balloons) { this.scene.remove(b.m); this.scene.remove(b.warn); }
    this.thrown = []; this.rings = []; this.balloons = [];
    for (const b of [...this.bullets, ...this.blobs]) { this.fx.free(b.m); if (b.warn) this.scene.remove(b.warn); }
    for (const p of [...this.puddles, ...this.slicks, ...this.soapBubbles]) this.scene.remove(p.m);
    this.bullets = []; this.blobs = []; this.puddles = []; this.slicks = []; this.soapBubbles = [];
  }

  get alive() { return this.list.filter((e) => !e.dead); }

  // Show one of each projectile and telegraph so their shaders compile before play (main.js warmUp)
  warm(on, at) {
    if (on) {
      this._warm = [...[this.T.brown, this.T.red, this.T.orange, this.T.steam, this.T.puddle, this.T.soap, this.T.sweep, this.T.beam, ...this.T.aim].map((m) => new THREE.Mesh(this.flat, m)), new THREE.Mesh(this.flat, this.coffeeMat), new THREE.Mesh(this.flat, this.soapMat), new THREE.Mesh(this.bubbleGeo, this.bubbleMat)];
      const soap = soapModel();
      soap.group.traverse((o) => { if (o.isMesh) this._warm.push(o.clone()); });   // its own materials too
      const whip = buildWhipper(), bal = buildBalloon();
      whip.group.traverse((o) => { if (o.isMesh) this._warm.push(o.clone()); });
      bal.group.traverse((o) => { if (o.isMesh) this._warm.push(o.clone()); });
      this._warm.push(new THREE.Mesh(this.flat, this.T.blast), new THREE.Mesh(this.flat, this.T.cream));
      const clock = buildClock();
      clock.group.traverse((o) => { if (o.isMesh) this._warm.push(o.clone()); });
      this._warm.push(new THREE.Mesh(this.ringGeo, this.ringMat));
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
    const g = new THREE.Mesh(this.flat, mat.clone());
    g.scale.setScalar(r);
    g.renderOrder = 3;
    g.position.copy(pos).setY(pos.y + 0.002);
    g.updateMatrixWorld(true);
    this.scene.add(g);
    g.userData.fill = (k) => { g.material.progress = k; g.material.opacity = 0.85 + Math.sin(performance.now() / 60) * 0.15; };
    return g;
  }

  // lob something in an arc to `to`; a warning circle fills until it lands
  lob(from, to, T, color, warnMat, r, onLand) {
    const m = this.fx.orb(color, 0.007);
    m.position.copy(from);
    this.blobs.push({ m, warn: this.warnCircle(to, r, warnMat), from: from.clone(), to: to.clone(), t: 0, T, onLand });
  }

  puddle(at, r = 0.045, life = 3.5) {
    const m = new THREE.Mesh(this.flat, this.coffeeMat);
    m.position.copy(at).setY(at.y + 0.0015);
    m.scale.setScalar(r);
    const hot = new THREE.Mesh(this.flat, this.T.puddle.clone());   // scalding: a glowing hazard edge
    hot.position.y = 0.0006;
    hot.renderOrder = 3;
    m.add(hot);
    this.scene.add(m);
    this.puddles.push({ m, r, t: life });
  }

  // a slick of soap where a squirt landed: slippery underfoot for `life` s (a glossy pink pool
  // with a hazard edge)
  slick(at, r = 0.05, life = 5) {
    const m = new THREE.Mesh(this.flat, this.soapMat);
    m.position.copy(at).setY(at.y + 0.0015);
    m.scale.setScalar(r);
    const edge = new THREE.Mesh(this.flat, this.T.slick.clone());
    edge.position.y = 0.0006;
    edge.renderOrder = 3;
    edge.material.progress = 0;
    m.add(edge);
    this.scene.add(m);
    this.slicks.push({ m, r, t: life });
  }

  // a soap bubble drifting outward from `from` along `dir` (unit, flat)
  bubble(from, dir, speed, life) {
    const m = new THREE.Mesh(this.bubbleGeo, this.bubbleMat);
    m.scale.setScalar(0.011);
    m.position.copy(from);
    m.renderOrder = 4;
    this.scene.add(m);
    this.soapBubbles.push({ m, v: dir.clone().multiplyScalar(speed), t: life, wob: Math.random() * 6, y: from.y });
  }

  // the clock's hands: real time (hour and minute), or whirling while it winds up an attack
  clockHands(e, dt) {
    const M = e.model;
    if (e.spin) { M.minuteHand.rotation.z -= dt * e.spin; M.hourHand.rotation.z -= dt * e.spin / 12; return; }
    if (e.state !== 'idle' && !e.decor) return;                       // an attack is moving them
    const d = new Date(), min = d.getMinutes() + d.getSeconds() / 60, hr = (d.getHours() % 12) + min / 60;
    const ease = (cur, want) => cur + Math.atan2(Math.sin(want - cur), Math.cos(want - cur)) * (1 - Math.exp(-4 * dt));
    M.minuteHand.rotation.z = ease(M.minuteHand.rotation.z, -min / 60 * Math.PI * 2);
    M.hourHand.rotation.z = ease(M.hourHand.rotation.z, -hr / 12 * Math.PI * 2);
  }

  // where Victory's wreath is (world), for throwing it and catching it again
  wreathWorld(e) {
    if (!e?.model?.wreath) return null;
    e.holder.updateMatrixWorld(true);
    return e.model.wreath.getWorldPosition(new THREE.Vector3());
  }

  // What they do to you goes out as events (damage_taken, knockback, status_applied); a beaten
  // elite sends elite_defeated
  update(dt, player, cfg) {
    const P = player.position, pc = P.clone().setY(P.y + cfg.height * 0.5);
    const camQ = this.camera.quaternion;
    const sameLevel = (y) => Math.abs(P.y - y) < 0.1;
    const hit = (amount, source) => bus.emit('damage_taken', { targetId: PLAYER, amount, source });
    const knock = (from, force) => bus.emit('knockback', { targetId: PLAYER, dir: P.clone().sub(from).setY(0).normalize(), force, launch: 0.25 });

    // things that only hang there: a hanging elite goes back up its wall; clock hands keep time
    for (const d of this.decor) {
      if (d.wall) d.holder.position.y += (d.hangY - d.holder.position.y) * (1 - Math.exp(-2.5 * dt));
      d.model.group.scale.setScalar(1);
      d.model.group.position.set(0, 0, 0);
      d.model.group.rotation.set(0, 0, 0);
      if (d.kind === 'clock') this.clockHands(d, dt);
    }

    for (const e of this.list) {
      if (e.dead) {
        if (!e.done) {
          e.done = true;
          const c = e.center();
          this.fx.puff(c, 0xffd23a, e.r * 2.5, 0.6);
          this.fx.ring(e.base.clone().setY(e.base.y + 0.004), 0xffd23a, e.r * 3, 0.6);
          if (e.wall) { e.retire(); this.decor.push(e); }   // back up on its wall, just a clock again
          else e.remove();
          bus.emit('elite_defeated', { elite: e });
        }
        continue;
      }
      e.t += dt;
      e.hitPop = Math.max(0, e.hitPop - dt * 6);
      const g = e.model.group;
      g.scale.setScalar(e.size * (1 + e.hitPop * 0.08));
      e.bar.quaternion.copy(camQ);
      const k = Math.max(0, e.hp / e.maxHp);
      e.fill.scale.x = Math.max(0.001, k);
      e.fill.material.color.setHSL(0.33 * k, 0.85, 0.55);          // green -> yellow -> red
      const to = pc.clone().sub(e.base);
      const awake = to.length() < e.aggro;
      e.awake = awake;
      // a hanging elite comes down its wall while you're close (and fights only once it's down)
      if (e.wall) {
        if (awake || e.state !== 'idle') e.downT = 1.5; else e.downT = Math.max(0, (e.downT || 0) - dt);
        const want = e.downT > 0 ? e.fightY : e.hangY, wasUp = e.holder.position.y > e.fightY + 0.05;
        e.holder.position.y += (want - e.holder.position.y) * (1 - Math.exp(-3.5 * dt));
        if (wasUp && e.holder.position.y <= e.fightY + 0.05 && want === e.fightY) { this.fx.puff(e.base.clone().setY(e.base.y + 0.02), 0xd8c8b0, 0.06, 0.5); sfx.clockChime(1); }
        e.ready = Math.abs(e.holder.position.y - e.fightY) < 0.03;
      }
      // face you (unless an attack has locked its aim, or it hangs on a wall), and bob so it reads as alive
      if (!e.locked && !e.wall) {
        let d = Math.atan2(to.x, to.z) - e.holder.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        e.holder.rotation.y += d * (1 - Math.exp(-(awake ? 6 : 1.5) * dt));
      }
      g.position.set(0, Math.abs(Math.sin(e.t * (awake ? 4 : 1.5))) * 0.004, 0);
      g.rotation.set(0, 0, 0);
      e.cool -= dt;
      const muzzle = e.model.muzzle.clone().applyAxisAngle(UP, e.holder.rotation.y).add(e.wall ? e.holder.position : e.base);
      if (e.kind === 'clock') this.clockHands(e, dt);
      const heading = e.holder.rotation.y, fwd = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
      const surf = e.base.clone().setY(e.base.y + 0.002);

      // the Soap Dispenser, attacking or not: the soap left is its health, bubbles drift up through it
      if (e.kind === 'soap') {
        const M = e.model, level = M.liquidH * Math.max(0.06, e.hp / e.maxHp);
        M.liquid.scale.y += (level - M.liquid.scale.y) * (1 - Math.exp(-6 * dt));
        for (const b of M.bubs) {
          b.userData.rise = (b.userData.rise + dt * (e.hp < e.maxHp * 0.5 ? 0.6 : 0.3)) % 1;
          b.position.y = 0.012 + b.userData.rise * M.liquid.scale.y;
        }
      }

      // start the next attack
      if (e.state === 'idle') {
        if (!awake || e.cool > 0 || (e.wall && !e.ready)) continue;
        // finish turning to face you first, so the telegraph points where you are
        const off = Math.atan2(Math.sin(Math.atan2(to.x, to.z) - heading), Math.cos(Math.atan2(to.x, to.z) - heading));
        if (Math.abs(off) > 0.15 && !e.wall) continue;
        e.attack = e.next++ % (e.kind === 'clock' && e.hp < e.maxHp * 0.5 ? 3 : 2);   // the clock strikes the hour too once it's angry
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
            e.tele.forEach((m, i) => { m.position.copy(surf); m.rotation.y = e.holder.rotation.y + [-0.22, 0, 0.22][i]; m.material.opacity = e.locked ? 1 : 0.55 + Math.sin(e.t * 20) * 0.2; m.material.progress = Math.min(1, s / 0.85); });
          } else {
            e.tele.forEach((m, i) => {
              const dir = new THREE.Vector3(Math.sin(m.rotation.y), 0, Math.cos(m.rotation.y));
              const b = this.fx.orb(hostile('controller'), 0.0055);
              b.position.copy(muzzle);
              this.bullets.push({ m: b, v: dir.multiplyScalar(0.9), t: 1.0 });
            });
            M.buttons.forEach((b) => { b.material.emissiveIntensity = 0.5; });
            this.fx.impact(muzzle, hostile('controller'), 0.012, 6);
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
            this.fx.ring(surf, hostile('controller'), R, 0.45);
            this.fx.impact(surf.clone().setY(surf.y + 0.01), hostile('controller'), 0.05, 22);
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
          const throwAt = () => { const target = P.clone(); target.y = this.surfaceBelow(P); this.lob(muzzle, target, 1.0, hostile('mug'), this.T.mugCircle, 0.045, (at) => { this.puddle(at); this.fx.impact(at.clone().setY(at.y + 0.008), hostile('mug'), 0.025, 10); sfx.acid(); }); e.hitPop = 0.6; };
          if (!e.thrown) { e.thrown = 1; throwAt(); }
          if (s > 0.6 && e.thrown === 1) { e.thrown = 2; throwAt(); }
          if (s > 1.2) { e.state = 'idle'; e.cool = 1.6; e.thrown = 0; }
        } else {
          // Spill: tips toward you (arrow on the surface shows the line), then pours a wave
          const wind = 0.9;
          if (s < wind) {
            if (!e.tele.length) { e.locked = true; e.poured = -1; this.mark(e, this.stripGeo, this.T.brown, surf.clone().addScaledVector(fwd, e.r), new THREE.Vector3(0.08, 1, 0.34), heading); }
            e.tele[0].material.opacity = 0.75 + Math.sin(e.t * 18) * 0.2;
            e.tele[0].material.progress = s / wind;
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
            e.tele[0].material.opacity = 0.7 + Math.sin(e.t * 25) * 0.15;
            e.tele[0].material.progress = s / wind;
            g.rotation.z = Math.sin(e.t * 50) * 0.05;
            M.lid.position.y = 0.112 + Math.abs(Math.sin(e.t * 40)) * 0.004;
            if (Math.random() < dt * 20) this.fx.puff(muzzle, 0xffffff, 0.006, 0.3);
            if (Math.random() < dt * 6) sfx.wind();
          } else if (s < wind + 1.0) {
            if (e.tele[0]) { e.tele[0].material.opacity = 0.45; e.tele[0].material.progress = 1; }
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
              this.lob(muzzle, at, 1.0 + k * 0.15, hostile('kettle'), this.T.orange, 0.035, (p) => {
                this.fx.impact(p.clone().setY(p.y + 0.008), hostile('kettle'), 0.025, 12);
                this.fx.puff(p, 0xffffff, 0.03, 0.4);
                if (Math.hypot(P.x - p.x, P.z - p.z) < 0.035 + cfg.radius && Math.abs(P.y - p.y) < 0.06) hit(2, 'kettle');
              });
            }
          }
          M.lid.position.y = 0.112 + Math.max(0, Math.sin(Math.min(1, s * 2) * Math.PI)) * 0.04;
          if (s > 1.6) { e.popped = false; M.led.material.emissiveIntensity = 2; M.lid.position.y = 0.112; e.state = 'idle'; e.cool = 1.8; }
        }
      }

      // ---------------------------------------------------------- soap dispenser
      if (e.kind === 'soap') {
        const M = e.model, angry = e.hp < e.maxHp * 0.5;
        const press = (k) => { M.head.position.y = M.headY - k * 0.012; M.stem.scale.y = 1 - k * 0.5; M.stem.position.y = M.headY - 0.012 - k * 0.006; };
        if (e.attack === 0) {
          // Soap squirt: a pump stroke for each glob, each lobbed where you stand then
          const n = angry ? 4 : 3, gap = angry ? 0.32 : 0.42;
          const k = Math.floor(s / gap), ph = (s % gap) / gap;
          press(k < n ? Math.sin(Math.min(1, ph * 1.6) * Math.PI) : 0);
          if (k < n && k !== e.squirted) {
            e.squirted = k;
            const target = P.clone(); target.y = this.surfaceBelow(P);
            this.lob(muzzle, target, 0.75, hostile('soap'), this.T.soap, 0.04, (at) => {
              this.fx.impact(at.clone().setY(at.y + 0.008), hostile('soap'), 0.02, 8);
              this.fx.burst(at.clone().setY(at.y + 0.01), ['#ffb8d4', '#ff6aa8', '#ffffff'], 6, 0.003, 0.25, at.y);
              sfx.soapSplat();
              if (Math.hypot(P.x - at.x, P.z - at.z) < 0.04 + cfg.radius && Math.abs(P.y - at.y) < 0.06) hit(2, 'soap');
              this.slick(at);
            });
            this.fx.puff(muzzle, 0xffd0e4, 0.008, 0.3);
            sfx.soapPump();
            e.hitPop = 0.5;
          }
          if (s > n * gap + 0.25) { press(0); e.squirted = -1; e.state = 'idle'; e.cool = angry ? 1.1 : 1.6; }
        } else {
          // Bubble ring: foams up (pumping fast, the ring filling round it), then lets go a ring
          // of 16 bubbles drifting outward with a gap; angry, a second ring with its gap elsewhere
          const wind = 1.0;
          if (s < wind) {
            if (!e.tele.length) e.tele.push(this.warnCircle(surf, 0.17, this.T.soapRing));
            e.tele[0].userData.fill(s / wind);
            press(Math.abs(Math.sin(e.t * 26)) * 0.7);
            g.rotation.z = Math.sin(e.t * 40) * 0.03;
            if (Math.random() < dt * 25) this.fx.puff(muzzle.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.02, 0, (Math.random() - 0.5) * 0.02)), 0xffe0ee, 0.009, 0.5);   // foam spilling out
          } else if ((e.rings || 0) < (angry ? 2 : 1) && s > wind + (e.rings || 0) * 0.55) {
            e.rings = (e.rings || 0) + 1;
            e.clearTele();
            press(0);
            const slots = 18, skip = Math.floor(Math.random() * slots), y = e.base.y + cfg.height * 0.5;
            for (let k = 0; k < slots; k++) {
              if (k === skip || k === (skip + 1) % slots) continue;          // the gap: two slots wide
              const a = (k / slots) * Math.PI * 2 + (e.rings - 1) * 0.6, dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
              this.bubble(e.base.clone().addScaledVector(dir, e.r * 1.1).setY(y), dir, 0.26, 2.3);
            }
            this.fx.ring(surf, hostile('soap'), 0.17, 0.35);
            sfx.soapBubbles();
            e.hitPop = 0.8;
          }
          if (s > wind + (angry ? 0.9 : 0.35)) { e.rings = 0; e.clearTele(); e.state = 'idle'; e.cool = angry ? 1.3 : 1.8; }
        }
      }

      // ---------------------------------------------------------- wall clock
      if (e.kind === 'clock') {
        const M = e.model, angry = e.hp < e.maxHp * 0.5, R = 0.42;
        const flat = (v) => Math.atan2(v.x - e.base.x, v.z - e.base.z);     // the angle of a point round the pivot
        if (e.attack === 0) {
          // Sweeping hands: a half circle fills on the bench while the hands spin, then a golden hand sweeps across it
          const wind = angry ? 0.8 : 1.0, dur = 0.55;
          if (s < wind) {
            if (!e.tele.length) { e.dirSweep = Math.random() < 0.5 ? 1 : -1; this.mark(e, this.halfGeo, this.T.sweep, surf, new THREE.Vector3(R, 1, R), heading); }
            e.tele[0].material.progress = s / wind;
            e.tele[0].material.opacity = 0.7 + Math.sin(e.t * 22) * 0.15;
            e.spin = 14;                                                         // the hands whirl
            if (Math.random() < dt * 8) sfx.clockTick();
          } else if (s < wind + dur) {
            const u = (s - wind) / dur, b = heading + e.dirSweep * (-Math.PI / 2 + u * Math.PI);
            if (!e.beam) {
              e.beam = this.mark(e, this.stripGeo, this.T.beam, surf.clone().setY(surf.y + 0.002), new THREE.Vector3(0.03, 1, R), b);
              e.beam.material.progress = 1;
              e.prevB = b - e.dirSweep * 0.01;
              sfx.clockSweep();
            }
            e.beam.rotation.y = b;
            if (e.tele[0]) e.tele[0].material.opacity = 0.35;
            const tip = surf.clone().add(new THREE.Vector3(Math.sin(b) * R, 0.01, Math.cos(b) * R));
            this.fx.glow.emit(tip, hostile('clock'), 0.05, 0.01, 0.25, 0.9);
            // did the hand pass you (you on the bench, within its reach, not in the air)?
            const ang = flat(P), d = Math.hypot(P.x - e.base.x, P.z - e.base.z);
            const between = (x, a0, a1) => { const w = (v) => Math.atan2(Math.sin(v - a0), Math.cos(v - a0)); const t = w(x), span = w(a1); return span >= 0 ? t >= 0 && t <= span : t <= 0 && t >= span; };
            if (!e.swept && d < R + cfg.radius * 0.5 && sameLevel(e.base.y) && player.grounded && between(ang, e.prevB, b)) { e.swept = true; hit(3, 'clock'); knock(e.base, 0.7); }
            e.prevB = b;
            e.spin = 0;
            M.minuteHand.rotation.z = -e.dirSweep * (u - 0.5) * Math.PI;                 // the dial's minute hand sweeps with it
          } else { e.clearTele(); e.beam = null; e.swept = false; e.spin = 0; e.state = 'idle'; e.cool = angry ? 1.2 : 1.7; }
        } else if (e.attack === 1) {
          // Victory's wreath: a line on the bench to you (locks halfway), then the wreath flies out along it and back
          const wind = 0.8;
          if (s < wind) {
            const target = P.clone().setY(P.y + cfg.height * 0.5);
            if (s < wind * 0.5 || !e.aim) e.aim = target;
            const from = this.wreathWorld(e), dx = e.aim.x - e.base.x, dz = e.aim.z - e.base.z, len = Math.max(0.05, Math.hypot(dx, dz));
            if (!e.tele.length) this.mark(e, this.stripGeo, this.T.wreath, surf, new THREE.Vector3(0.05, 1, len), Math.atan2(dx, dz));
            e.tele[0].rotation.y = Math.atan2(dx, dz);
            e.tele[0].scale.z = len;
            e.tele[0].material.progress = s / wind;
            M.wreath.rotation.z += dt * 12;                                      // she brandishes it
            M.wreath.scale.setScalar(1 + Math.sin(e.t * 20) * 0.08);
            if (from && Math.random() < dt * 14) this.fx.glow.emit(from, hostile('clock'), 0.04, 0.01, 0.3, 0.8);
          } else if (!e.threw) {
            e.threw = true;
            e.clearTele();
            M.wreath.visible = false;
            const m = M.wreath.clone(true);
            m.visible = true;                                                    // (the one in her hand was just hidden)
            m.scale.setScalar(3.2);                                             // bigger than life, so you can see it coming
            m.rotation.set(Math.PI / 2, 0, 0);                                 // flat, spinning like a thrown ring
            m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.setHex(0xe0b048); o.material.emissive = hostile('clock').clone(); o.material.emissiveIntensity = 1.1; o.material.toneMapped = false; } });
            const from = this.wreathWorld(e);
            m.position.copy(from);
            this.scene.add(m);
            this.thrown.push({ m, from, to: e.aim.clone(), t: 0, T: 0.5, owner: e, hits: 0 });
            sfx.wreathWhirr();
          } else if (!this.thrown.some((w) => w.owner === e)) { e.threw = false; e.aim = null; M.wreath.visible = true; M.wreath.scale.setScalar(1); e.state = 'idle'; e.cool = angry ? 1.2 : 1.7; }
        } else {
          // Striking the hour: the hands snap to the hour, then three chimes, each a golden ring rolling out over the bench
          const wind = 0.6, gap = 0.7;
          if (s < wind) {
            if (!e.tele.length) e.tele.push(this.warnCircle(surf, 0.06, this.T.chime));
            e.tele[0].userData.fill(s / wind);
            M.minuteHand.rotation.z += (0 - M.minuteHand.rotation.z) * (1 - Math.exp(-12 * dt));   // to twelve
            g.rotation.z = Math.sin(e.t * 30) * 0.01;
          } else {
            const k = Math.floor((s - wind) / gap);
            if (k < 3 && k !== e.chimed) {
              e.chimed = k;
              e.clearTele();
              sfx.clockChime(k);
              e.hitPop = 0.7;
              const m = new THREE.Mesh(this.ringGeo, this.ringMat);
              m.position.copy(surf).setY(surf.y + 0.006);
              this.scene.add(m);
              this.rings.push({ m, at: surf.clone(), r: 0.03, max: 0.55, owner: e, hit: false });
            }
            if (s > wind + gap * 3) { e.chimed = -1; e.state = 'idle'; e.cool = 1.6; }
          }
        }
      }

      // ---------------------------------------------------------- cream whipper
      if (e.kind === 'whipper') {
        const M = e.model, angry = e.hp < e.maxHp * 0.5;
        const gauges = (k) => M.needles.forEach((n, i) => { n.rotation.z = 1.2 - k * 2.3 + Math.sin(e.t * 30 + i) * 0.05 * k; });
        if (e.attack === 0) {
          // Balloon: blow one up on the nozzle, let it go; angry, a second straight after
          const fill = 1.0, n = angry ? 2 : 1, k = Math.floor(s / (fill + 0.25)), u = (s % (fill + 0.25)) / fill;
          if (k < n) {
            if (!e.inflating && u < 1) {
              e.inflating = buildBalloon(new THREE.Color().setHSL(0.72 + Math.random() * 0.2, 0.8, 0.6).getHex());
              this.scene.add(e.inflating.group);
              sfx.balloonFill(fill);
            }
            if (e.inflating) {
              const b = e.inflating, grow = THREE.MathUtils.smoothstep(Math.min(1, u), 0, 1);
              e.holder.updateMatrixWorld(true);
              M.tip.getWorldPosition(b.group.position);
              b.group.scale.setScalar(0.004 + grow * BALLOON - 0.004 * grow);
              b.group.rotation.set(Math.sin(e.t * 9) * 0.1 * grow, 0, Math.sin(e.t * 7) * 0.1 * grow);
              gauges(grow);
              M.lever.rotation.z = -grow * 0.25;
              if (Math.random() < dt * 20) this.fx.puff(b.group.position.clone(), 0xe8e0ff, 0.006, 0.25);
              if (u >= 1) {
                // let go: it drifts after you, and bursts 3 s later
                const R = 0.2, warn = new THREE.Mesh(this.flat, this.T.blast.clone());
                warn.renderOrder = 3;
                warn.scale.setScalar(R);
                this.scene.add(warn);
                this.balloons.push({ m: b.group, b, warn, t: 0, fuse: 3, R, vel: new THREE.Vector3(0, 0.05, 0), size: BALLOON, tick: 0 });
                sfx.balloonLoose();
                e.inflating = null;
                M.lever.rotation.z = 0;
              }
            }
          } else { gauges(0); e.state = 'idle'; e.cool = angry ? 1.6 : 2.2; }
        } else {
          // Cream spray: it tips toward you while a cone fills on the floor, then sprays along it
          const wind = 0.85, dur = angry ? 1.0 : 0.6, len = angry ? 0.42 : 0.34;
          if (s < wind) {
            if (!e.tele.length) { e.locked = true; this.mark(e, this.coneGeo, this.T.cream, surf.clone().addScaledVector(fwd, 0.05), new THREE.Vector3(len, 1, len), heading); }
            e.tele[0].material.progress = s / wind;
            e.tele[0].material.opacity = 0.7 + Math.sin(e.t * 22) * 0.15;
            M.whip.rotation.x = (s / wind) * 0.35;                       // tipping toward you
            gauges(0.6 + Math.sin(e.t * 12) * 0.1);
            if (!e.hissed) { e.hissed = true; sfx.balloonFill(0.4); }
          } else if (s < wind + dur) {
            M.whip.rotation.x = 0.4;
            M.lever.rotation.z = -0.3;
            if (!e.sprayed) { e.sprayed = true; sfx.creamSpray(dur); }
            if (Math.random() < dt * 45) {
              const kk = Math.random(), side = new THREE.Vector3(fwd.z, 0, -fwd.x).multiplyScalar((Math.random() - 0.5) * 0.7 * kk * len);
              this.fx.puff(e.base.clone().addScaledVector(fwd, 0.08 + kk * len * 0.9).add(side).setY(e.base.y + 0.02 + (1 - kk) * 0.12), 0xfffaf0, 0.016 + kk * 0.028, 0.5);
            }
            const rel = pc.clone().sub(e.base).setY(0), along = rel.dot(fwd), ang = Math.acos(THREE.MathUtils.clamp(rel.clone().normalize().dot(fwd), -1, 1));
            if (!e.creamed && along > 0 && along < len + 0.05 && ang < 0.47 && sameLevel(e.base.y)) {
              e.creamed = true;
              hit(2, 'cream');
              bus.emit('status_applied', { targetId: PLAYER, status: 'slow', duration: 1.5 });
              this.fx.puff(pc.clone(), 0xfffaf0, 0.05, 0.6);
            }
          } else { e.clearTele(); e.locked = false; e.hissed = e.sprayed = e.creamed = false; M.whip.rotation.x = 0; M.lever.rotation.z = 0; gauges(0); e.state = 'idle'; e.cool = 1.8; }
        }
      }
    }

    // the Cream Whipper's balloons: drifting after you, bobbing, the burst circle filling under
    // them; at 3 s they burst, and caught in it your hearing goes deep for a while
    for (const b of this.balloons) {
      b.t += dt;
      const want = pc.clone().setY(pc.y + 0.1).sub(b.m.position);   // its knot just over your head, the balloon above
      const flat = Math.hypot(want.x, want.z);
      b.vel.x += ((flat > 0.02 ? want.x / flat * 0.2 : 0) - b.vel.x) * (1 - Math.exp(-2.5 * dt));   // slower than you swim (0.42): you can always get away
      b.vel.z += ((flat > 0.02 ? want.z / flat * 0.2 : 0) - b.vel.z) * (1 - Math.exp(-2.5 * dt));
      b.vel.y += (THREE.MathUtils.clamp(want.y * 1.5, -0.16, 0.16) - b.vel.y) * (1 - Math.exp(-3 * dt));   // sinking to your height as it comes
      b.m.position.addScaledVector(b.vel, dt);
      const left = b.fuse - b.t, late = Math.max(0, 1 - left / 0.7);
      b.m.scale.setScalar(b.size * (1 + late * 0.15 + Math.sin(b.t * (6 + late * 40)) * 0.02 * (1 + late * 3)));
      b.m.rotation.set(Math.sin(b.t * 2.2) * 0.15 - b.vel.z * 1.5, 0, Math.cos(b.t * 1.7) * 0.15 + b.vel.x * 1.5);
      b.b.mat.emissiveIntensity = 0.25 + late * 0.8;
      // the burst circle on the floor under it
      if ((b.floorT = (b.floorT || 0) - dt) <= 0) { b.floorT = 0.1; b.floor = this.surfaceBelow(b.m.position); }
      b.warn.position.set(b.m.position.x, (b.floor ?? 0) + 0.003, b.m.position.z);
      b.warn.material.progress = Math.min(1, b.t / b.fuse);
      b.warn.material.opacity = 0.7 + 0.3 * Math.abs(Math.sin(b.t * (5 + late * 25)));
      if ((b.tick -= dt) <= 0) { b.tick = Math.max(0.08, left * 0.18); sfx.balloonTick(); }
      if (b.t >= b.fuse) {
        b.done = true;
        const at = b.m.position.clone();
        this.scene.remove(b.m); this.scene.remove(b.warn);
        const col = '#' + b.b.mat.color.getHexString();
        this.fx.burst(at, [col, col, '#ffffff'], 14, 0.004, 0.35, b.floor ?? at.y - 0.1);           // scraps of rubber
        this.fx.impact(at, hostile('whipper'), 0.05, 18);
        this.fx.ring(new THREE.Vector3(at.x, (b.floor ?? 0) + 0.004, at.z), hostile('whipper'), b.R, 0.4);
        this.fx.puff(at, 0xd8c8ff, b.R * 0.9, 0.9);                                                   // a cloud of gas
        juice.shake(0.25);
        sfx.balloonPop();
        // caught: inside the circle it showed on the floor, and not far above or below the balloon
        if (Math.hypot(pc.x - at.x, pc.z - at.z) < b.R + cfg.radius && Math.abs(pc.y - at.y) < 0.2) { hit(2, 'balloon'); deepen(5, 3); sfx.daze(); }
      }
    }
    this.balloons = this.balloons.filter((b) => !b.done);

    // the clock's wreath: out along its line to where you were, spinning, then back to Victory's hand
    for (const w of this.thrown) {
      w.t += dt;
      const out = w.t < w.T, k = out ? w.t / w.T : Math.min(1, (w.t - w.T) / w.T);
      const home = this.wreathWorld(w.owner) || w.from;
      if (out) w.m.position.lerpVectors(w.from, w.to, k * (2 - k)); else w.m.position.lerpVectors(w.to, home, k * k);
      w.m.position.y += Math.sin((out ? k : 1 - k) * Math.PI) * 0.03;
      w.m.rotation.z += dt * 18;
      this.fx.glow.hold(w.m.position, hostile('clock'), 0.11, 0.8);
      if ((w.trail = (w.trail || 0) - dt) <= 0) { w.trail = 0.02; this.fx.glow.emit(w.m.position, hostile('clock'), 0.04, 0.01, 0.25, 0.8); }
      const leg = out ? 1 : 2;
      if (w.hits < leg && w.m.position.distanceTo(pc) < cfg.radius + 0.04) { w.hits = leg; hit(2, 'clock-wreath'); }
      else if (w.hits < leg - 1) w.hits = leg - 1;
      if (!out && k >= 1) { w.done = true; this.scene.remove(w.m); w.owner.model.wreath.visible = true; }
      if (w.owner.dead) { w.done = true; this.scene.remove(w.m); }
    }
    this.thrown = this.thrown.filter((w) => !w.done);

    // the clock's chime rings rolling out over the bench: jump them
    for (const r of this.rings) {
      r.r += dt * 0.75;
      r.m.scale.setScalar(r.r);
      r.m.material.opacity = 0.9 * (1 - r.r / r.max);
      this.fx.glow.hold(r.m.position.clone().add(new THREE.Vector3(r.r, 0.004, 0)), hostile('clock'), 0.03, 0.5);
      const d = Math.hypot(P.x - r.at.x, P.z - r.at.z);
      if (!r.hit && Math.abs(d - r.r) < 0.025 + cfg.radius * 0.4 && Math.abs(P.y - r.at.y) < 0.03 && player.grounded) { r.hit = true; hit(2, 'clock-chime'); }
      if (r.r >= r.max) { r.done = true; this.scene.remove(r.m); }
    }
    this.rings = this.rings.filter((r) => !r.done);

    // soap bubbles drifting out from the Soap Dispenser: they pop on you, on walls, or when they've gone far enough
    for (const b of this.soapBubbles) {
      b.t -= dt;
      b.m.position.addScaledVector(b.v, dt);
      b.m.position.y = b.y + Math.sin(b.t * 5 + b.wob) * 0.006;   // bobbing as it drifts
      b.m.scale.setScalar(0.011 * (1 + Math.sin(b.t * 9 + b.wob) * 0.06));
      this.fx.glow.hold(b.m.position, hostile('soap'), 0.05, 0.55);
      if (this.world.cast(b.m.position, this._dir.copy(b.v).normalize(), b.v.length() * dt + 0.011)) b.t = 0;
      if (b.m.position.distanceTo(pc) < cfg.radius + 0.011) { hit(2, 'soap-bubble'); b.t = 0; b.hitYou = true; }
      if (b.t <= 0) {
        this.scene.remove(b.m);
        this.fx.burst(b.m.position, ['#ffe0ee', '#ff8ac0', '#ffffff'], 4, 0.003, 0.2, b.m.position.y - 0.03);
        this.fx.ring(b.m.position.clone(), hostile('soap'), 0.014, 0.18);
        sfx.bubblePop();
      }
    }
    this.soapBubbles = this.soapBubbles.filter((b) => b.t > 0);

    // soap slicks: standing in one, you slip
    for (const p of this.slicks) {
      p.t -= dt;
      p.m.scale.setScalar(p.r * Math.min(1, p.t * 2, (5 - p.t) * 8 + 0.2));
      const edge = p.m.children[0].material;
      edge.opacity = 0.35 + Math.sin(performance.now() / 200) * 0.1;
      const d = Math.hypot(P.x - p.m.position.x, P.z - p.m.position.z);
      if (d < p.r && Math.abs(P.y - p.m.position.y) < 0.02 && player.grounded) bus.emit('status_applied', { targetId: PLAYER, status: 'slip', duration: 0.35 });
      if (p.t <= 0) this.scene.remove(p.m);
    }
    this.slicks = this.slicks.filter((p) => p.t > 0);

    // button shots
    for (const b of this.bullets) {
      b.t -= dt;
      const step = b.v.length() * dt;
      if (this.world.cast(b.m.position, this._dir.copy(b.v).normalize(), step + 0.004)) b.t = 0;
      b.m.position.addScaledVector(b.v, dt);
      this.fx.orbTick(b.m, dt);
      if (b.m.position.distanceTo(pc) < cfg.radius + 0.006) { hit(2, 'controller'); b.t = 0; }
      if (b.t <= 0) { this.fx.impact(b.m.position, hostile('controller'), 0.015, 8); this.fx.free(b.m); }
    }
    this.bullets = this.bullets.filter((b) => b.t > 0);

    // lobbed things in flight, with their warning circles filling
    for (const b of this.blobs) {
      b.t += dt;
      const k = Math.min(1, b.t / b.T);
      b.m.position.lerpVectors(b.from, b.to, k);
      b.m.position.y += Math.sin(k * Math.PI) * 0.12;
      this.fx.orbTick(b.m, dt, 1.2);
      b.warn.userData.fill(k);
      if (k >= 1) {
        this.fx.free(b.m);
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
