// Act 4's room dressed as a show about to start: a stage's `dressing` block (stage4.js).
//   - the lit props (`pulse`: the LED cove strip, the Corner LED and the Spotlight floor lamps) and the
//     TV flash on the song's beat (run.beat): their emissive only, never a light added or removed
//   - the stage door moment: at time-up the bugs go, the TV flares and the media console lights up for
//     a few beats on the music, then the door opens (Run.showStageDoor). A jump skips it; with Reduce
//     effects it is shorter and the glow is steady.
// Nothing here is solid or in anyone's way: no collider. The glow plate is built once per page and kept shown (a bare opacity of 0 until the door
// moment), so no program compiles while it plays. Look values: --dress-*.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { juice } from './juice.js';
import { sfx } from './sfx.js';

const DOWN = new THREE.Vector3(0, -1, 0), _o = new THREE.Vector3();

export class ConcertDressing {
  constructor(run) {
    this.run = run;
    this.D = null;               // the stage's dressing block, or null
    this.glow = null;            // the media console lighting up
    this.lamps = [];             // { m: material, base: its emissive intensity }
    this.tv = null;              // { m, hex, base }
    this.state = 'idle';         // idle -> moment (the door is warming up) -> open
  }
  get calm() { return juice.calm || !!this.run.fx.reducedMotion?.matches; }

  // the run starts (Run.start): this stage's dressing, or none
  start(stage) {
    this.restore();
    this.D = stage.dressing || null;
    this.state = 'idle'; this.from = 0;
    if (!this.D) { if (this.glow) this.glow.visible = false; return; }
    this.K = { amp: LOOK.num('dress-pulse', 0.7), decay: LOOK.num('dress-decay', 4), tv: LOOK.num('dress-tv-glow', 0.35), tvBeat: LOOK.num('dress-tv-beat', 0.5),
      flare: LOOK.num('dress-tv-flare', 3), door: LOOK.num('dress-door-glow', 0.55), doorBeat: LOOK.num('dress-door-beat', 0.35),
      beats: LOOK.num('dress-door-beats', 8), beatsCalm: LOOK.num('dress-door-beats-calm', 2) };
    if (!this.glow) this.build(stage);
    this.glow.visible = true;
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

  build(stage) {
    const { world, scene } = this.run;
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

  // time's up: the door warms up for a few beats before it opens. False when this stage has no dressing
  // (its door opens at once).
  door() {
    if (!this.D || this.state !== 'idle') return false;
    this.state = 'moment';
    this.from = this.run.beat ?? 0;
    this.age = 0;
    this.beats = this.calm ? this.K.beatsCalm : this.K.beats;
    this.run.hud.toast(this.run.stage.stageDoor.starts, 2400);
    sfx.bassDrop();
    return true;
  }
  skip() { if (this.state === 'moment') this.from = -1e9; }

  // each frame of play
  update(dt = 0) {
    if (!this.D) return;
    const run = this.run, K = this.K, beat = run.beat ?? 0;
    let p = 0;   // how far through the door moment
    if (this.state === 'moment') {
      if (beat < this.from) this.from = beat;   // the song started again: count on from here
      this.age += dt;   // real time too, so a stalled beat clock can't hold the door shut
      p = Math.min(1, Math.max((beat - this.from) / this.beats, this.age / (this.beats * 60 / (run.bpm || 120))));
    }
    const ph = beat - Math.floor(beat), pulse = this.calm ? 0 : Math.exp(-ph * K.decay) * (Math.floor(beat) % 4 === 0 ? 1 : 0.6);
    for (const { m, base } of this.lamps) m.emissiveIntensity = base * (1 + K.amp * pulse + p * 0.5);
    const open = this.state === 'open';
    if (this.tv) this.tv.m.emissiveIntensity = K.tv + K.tvBeat * pulse + K.flare * (open ? 0.3 : p * p);
    this.glow.material.opacity = open ? K.door + K.doorBeat * pulse : p * K.door;
    this.glow.visible = this.glow.material.opacity > 0.002;   // not drawn while it has no light to show (a plain additive MeshBasic: its shader is the arena's others')
    if (this.state === 'moment' && p >= 1) { this.state = 'open'; run.showStageDoor(); }
  }
}
