// Act 4's room dressed as a show about to start: a stage's `dressing` block (stage4.js).
//   - a low crowd barrier of Festival wristbands, flat rings on a cord, strung across the room just
//     behind where the sun stops (`wristbands`), and cables run along the floor from the media
//     console's front (`cables`): one merged mesh, one draw call, painted flat on the floor
//   - the lit props (`pulse`: the LED cove strip, the Corner LED and the Spotlight floor lamps) and the
//     TV flash on the song's beat (run.beat): their emissive only, never a light added or removed
//   - the stage door moment: at time-up the bugs go, the TV flares and the media console lights up for
//     a few beats on the music, then the door opens (Run.showStageDoor). A jump skips it; with Reduce
//     effects it is shorter and the glow is steady.
// Nothing here is solid or in anyone's way: no collider, and everything lies within a few millimetres
// of the floor. Both draws are built once per page and kept shown (a bare opacity of 0 until the door
// moment), so no program compiles while it plays. Look values: --dress-*.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { juice } from './juice.js';
import { sfx } from './sfx.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const DOWN = new THREE.Vector3(0, -1, 0), _o = new THREE.Vector3();
const VENT_GAP = 0.17;                   // m kept clear round a vent's floor mouth and a chest spot on the floor
const FLOOR = 0.03;                      // m: a floor hit above this is furniture, and the dressing skips it

const paint = (geo, hex) => {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
};

export class ConcertDressing {
  constructor(run) {
    this.run = run;
    this.D = null;               // the stage's dressing block, or null
    this.mesh = null;            // the barrier and the cables
    this.glow = null;            // the media console lighting up
    this.lamps = [];             // { m: material, base: its emissive intensity }
    this.tv = null;              // { m, hex, base }
    this.vents = [];
    this.state = 'idle';         // idle -> moment (the door is warming up) -> open
  }
  get calm() { return juice.calm || !!this.run.fx.reducedMotion?.matches; }

  // the run starts (Run.start): this stage's dressing, or none
  start(stage) {
    this.restore();
    this.D = stage.dressing || null;
    this.state = 'idle'; this.from = 0;
    if (!this.D) { if (this.mesh) this.mesh.visible = this.glow.visible = false; return; }
    this.K = { amp: LOOK.num('dress-pulse', 0.7), decay: LOOK.num('dress-decay', 4), tv: LOOK.num('dress-tv-glow', 0.35), tvBeat: LOOK.num('dress-tv-beat', 0.5),
      flare: LOOK.num('dress-tv-flare', 3), door: LOOK.num('dress-door-glow', 0.55), doorBeat: LOOK.num('dress-door-beat', 0.35),
      beats: LOOK.num('dress-door-beats', 8), beatsCalm: LOOK.num('dress-door-beats-calm', 2) };
    this.vents = [...stage.vents.map((v) => v.at), ...stage.spots.map((sp) => sp.at).filter((a) => a[1] < 0.05)];   // floor vents and floor chest spots
    if (!this.mesh) this.build(stage);
    this.mesh.visible = this.glow.visible = true;
    this.glow.material.opacity = 0;
    const seen = new Set();
    this.lamps = [];
    this.run.scene.traverse((root) => {
      if (this.D.pulse.includes(root.name)) root.traverse((m) => {
        const mat = m.isMesh && m.material;
        if (mat?.emissive && mat.emissive.getHex() && !seen.has(mat)) { seen.add(mat); this.lamps.push({ m: mat, base: mat.emissiveIntensity }); }
      });
      else if (root.name === 'TV screen' && !this.tv) this.tv = { m: root.material, hex: root.material.emissive.getHex(), base: root.material.emissiveIntensity };
    });
    if (this.tv) this.tv.m.emissive.set(LOOK.color('dress-tv', '#6f9bff'));
  }

  // put every material back as the apartment made it (the next stage, or none)
  restore() {
    for (const { m, base } of this.lamps) m.emissiveIntensity = base;
    if (this.tv) { this.tv.m.emissive.setHex(this.tv.hex); this.tv.m.emissiveIntensity = this.tv.base; }
    this.lamps = []; this.tv = null;
  }

  // the floor under (x, z): its height, or null where furniture stands (or nothing does)
  floorAt(x, z) {
    if (this.vents.some((v) => Math.hypot(v[0] - x, v[2] - z) < VENT_GAP)) return null;   // a gap round every floor vent and chest spot
    const h = this.run.world.castAll(_o.set(x, 0.3, z), DOWN, 0.4);
    return h && h.point.y < FLOOR ? h.point.y : null;
  }

  build(stage) {
    const { world, scene, player } = this.run, D = this.D, lift = LOOK.num('dress-lift', 0.003);
    const R = LOOK.num('dress-band-radius', 0.032), W = LOOK.num('dress-cable-width', 0.018);
    const colours = LOOK.list('dress-wristbands', ['#ff5ca8', '#38d6ff']), cord = LOOK.color('dress-cord', '#202026'), cable = LOOK.color('dress-cable', '#44444f');
    const parts = [];
    // the crowd barrier: wristbands lying flat in a row, each a little off the line and turned
    const B = D.wristbands, [x0, x1] = B.across;
    const bit = (n) => ((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1;   // a repeatable scatter, no Math.random
    const cordPts = [];
    for (let i = 0, x = x0; x <= x1; i++, x += B.gap) {
      const z = B.z + (bit(i) - 0.5) * 0.02, y = this.floorAt(x, z);
      cordPts.push(y === null ? null : [x, y, z]);
      if (y === null) continue;
      const ring = new THREE.RingGeometry(R * 0.7, R, 12); ring.deleteAttribute('uv'); ring.rotateX(-Math.PI / 2).rotateY(bit(i + 7) * Math.PI).scale(1, 1, 0.8 + bit(i + 3) * 0.3);
      ring.translate(x, y + lift * (1 + (i % 2) * 0.5), z);
      parts.push(paint(ring, colours[i % colours.length]));
    }
    // the cord through them
    for (let i = 0; i < cordPts.length - 1; i++) if (cordPts[i] && cordPts[i + 1]) parts.push(this.ribbon(cordPts[i], cordPts[i + 1], 0.004, cord, lift * 0.5));
    // cables off the media console's front: a gentle wander from `from` to `to`, a segment at a time
    for (const { from, to } of D.cables) {
      const n = Math.max(6, Math.round(Math.hypot(to[0] - from[0], to[1] - from[1]) / 0.06));
      let last = null;
      for (let i = 0; i <= n; i++) {
        const t = i / n, bend = Math.sin(t * Math.PI * 2.2) * 0.05 * Math.sin(t * Math.PI);
        const x = from[0] + (to[0] - from[0]) * t - (to[1] - from[1]) * bend, z = from[1] + (to[1] - from[1]) * t + (to[0] - from[0]) * bend;
        const y = this.floorAt(x, z), p = y === null ? null : [x, y, z];
        if (p && last) parts.push(this.ribbon(last, p, W, cable, lift));
        last = p;
      }
    }
    world.focus(player.position, 1);   // (castAll doesn't use it; keep the world as it was)
    this.mesh = new THREE.Mesh(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g))),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1 }));
    this.mesh.name = 'Concert dressing';
    this.mesh.userData.noCollide = true;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    // the media console lighting up: a flat additive plate on its top, the stage door's footprint
    const door = stage.stageDoor, top = world.castAll(_o.set((door.min[0] + door.max[0]) / 2, 1.2, (door.min[2] + door.max[2]) / 2), DOWN, 1.2);
    const y = (top ? top.point.y : door.min[1]) + 0.004, inset = 0.03;
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(door.max[0] - door.min[0] - inset * 2, door.max[2] - door.min[2] - inset * 2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: LOOK.color('dress-door', '#8fe8ff'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.glow.position.set((door.min[0] + door.max[0]) / 2, y, (door.min[2] + door.max[2]) / 2);
    this.glow.name = 'Stage door glow';
    this.glow.userData.noCollide = true;
    this.glow.renderOrder = 3;
    scene.add(this.glow);
  }

  // a flat strip lying on the floor from a to b ([x, y, z])
  ribbon(a, b, w, hex, lift) {
    const dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz) || 1, nx = -dz / len * w / 2, nz = dx / len * w / 2;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      a[0] - nx, a[1] + lift, a[2] - nz, a[0] + nx, a[1] + lift, a[2] + nz, b[0] + nx, b[1] + lift, b[2] + nz, b[0] - nx, b[1] + lift, b[2] - nz], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);   // facing up
    return paint(g, hex);
  }

  // time's up: the door warms up for a few beats before it opens. False when this stage has no dressing
  // (its door opens at once).
  door() {
    if (!this.D || this.state !== 'idle') return false;
    this.state = 'moment';
    this.from = this.run.beat ?? 0;
    this.beats = this.calm ? this.K.beatsCalm : this.K.beats;
    this.run.hud.toast(this.run.stage.stageDoor.starts, 2400);
    sfx.bassDrop();
    return true;
  }
  skip() { if (this.state === 'moment') this.from = -1e9; }

  // each frame of play
  update() {
    if (!this.D) return;
    const run = this.run, K = this.K, beat = run.beat ?? 0;
    let p = 0;   // how far through the door moment
    if (this.state === 'moment') {
      if (beat < this.from) this.from = beat;   // the song started again: count on from here
      p = Math.min(1, (beat - this.from) / this.beats);
    }
    const ph = beat - Math.floor(beat), pulse = this.calm ? 0 : Math.exp(-ph * K.decay) * (Math.floor(beat) % 4 === 0 ? 1 : 0.6);
    for (const { m, base } of this.lamps) m.emissiveIntensity = base * (1 + K.amp * pulse + p * 0.5);
    const open = this.state === 'open';
    if (this.tv) this.tv.m.emissiveIntensity = K.tv + K.tvBeat * pulse + K.flare * (open ? 0.3 : p * p);
    this.glow.material.opacity = open ? K.door + K.doorBeat * pulse : p * K.door;
    if (this.state === 'moment' && p >= 1) { this.state = 'open'; run.showStageDoor(); }
  }
}
