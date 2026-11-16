// The Soundbar's bass wave: a stage's `bass` block (act 4's room, stage4.js). Every `every` bars of the
// act's song, on the bar, the Soundbar on the media console sends one low wave across the floor from the
// TV wall (z `from`) to the window wall (z `to`): a strip the room's width (x `across`), `width` m deep and
// `height` m tall, rolling at `speed` m/s. Anything of the jelly under its top as it passes is hit for
// `dmg` (the act's power on top), once a wave, out through the event bus as damage_taken, source 'bass'.
// Furniture tops stand above it and a jump clears it, like the Encore's floor waves (encore-floor.js).
//
// Time is in beats, the run's beat (run.beat: the song's as the speakers play it, or the run's own count
// at the song's tempo while no song plays), so the wave goes off on the music's bar line.
//
// The Warning, over the bar before: a floor strip along the TV wall, the wave's footprint, and the hex
// volume of the space it will fill over it (fx.volume 'lane'), filling together to the moment it goes,
// in --hostile-bass; a beat before, a sub drop (sfx.bassDrop). On the bar: a flash along the Soundbar,
// a thump, a tremor (juice.feel('bass')), and the strip and its volume roll off down the room at full,
// lifting motes off the floor behind them. Two draws, built when the run starts; their programs are the
// shared Warning ones (warmed behind Play), so nothing compiles while it plays. Look values: --bass-*.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { hostile } from './vfx.js';
import { bus, PLAYER } from './events.js';
import { juice } from './juice.js';
import { sfx } from './sfx.js';

const _o = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3();
const WARN = 4;                       // beats of Warning: the bar before it goes

export class BassWave {
  constructor(run) {
    this.run = run;
    this.B = null;                    // the stage's bass block, or null
    this.strip = null; this.vol = null;
  }

  // the bar line (in beats) of the next wave after `beat`
  nextAfter(beat) { const P = this.B.every * 4; return (Math.floor(beat / P) + 1) * P; }
  get busy() { return this.state !== 'idle'; }

  // the run starts (Run.start): this stage's wave, or none
  start(stage) {
    this.B = stage.bass || null;
    this.state = 'idle'; this.beat = null; this.next = 0; this.hit = false; this.dropped = false; this.moteT = 0;
    if (!this.B) { if (this.strip) this.show(false); return; }
    if (!this.strip) this.build();
    this.show(false);
    this.next = this.nextAfter(this.run.beat ?? 0);
    // where the Soundbar stands (set-dressing.js names its group), for the flash as it goes
    const bar = this.run.scene.getObjectByName('Soundbar');
    this.bar = bar ? new THREE.Box3().setFromObject(bar) : new THREE.Box3(new THREE.Vector3(1.0, 0.6, 4.55), new THREE.Vector3(2.3, 0.66, 4.65));
  }

  build() {
    const { fx, scene } = this.run, B = this.B, c = hostile('bass'), w = B.across[1] - B.across[0];
    const mid = (B.across[0] + B.across[1]) / 2;
    // a strip plane from its start along +z (elites.js stripGeo), turned to roll toward the window (-z)
    this.mat = fx.tele(c, 'strip');
    this.strip = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), this.mat);
    this.strip.name = 'Bass wave'; this.strip.renderOrder = 3; this.strip.frustumCulled = false;
    this.strip.userData.noCollide = true;
    this.strip.scale.set(w, 1, B.width); this.strip.rotation.y = Math.PI;
    scene.add(this.strip);
    this.vol = fx.volume(c, 'lane', _o.set(mid, 0, B.from), _s.set(w, B.height, B.width));
    this.vol.name = 'Bass wave volume'; this.vol.rotation.y = Math.PI; this.vol.frustumCulled = false;
    this.vol.userData.noCollide = true;
    this.vol.material.opacity = LOOK.num('bass-volume-opacity', 0.8);
    this.strip.position.set(mid, LOOK.num('bass-lift', 0.003), B.from);
  }

  show(on) { this.strip.visible = this.vol.visible = on; }
  // the Warning and the wave stand with their back edge (the TV side) at z
  place(z, progress) {
    this.strip.position.z = this.vol.position.z = z;
    this.mat.progress = this.vol.material.progress = progress;
  }

  // each frame of play, with the run's beat
  update(dt, beat) {
    if (!this.B) return;
    const run = this.run, B = this.B, last = this.beat;
    // a jump back in time (the song started, or started again) drops what was going and counts on from
    // there; a jump forward of more than a beat (a pause, a long frame) passes the wave without hitting
    if (last !== null && beat < last) { this.beat = beat; this.stop(); }
    const skip = last !== null && beat - last > 1;
    this.beat = beat;
    if (run.phase !== 'explore') { if (this.busy) this.stop(); if (beat >= this.next) this.next = this.nextAfter(beat); return; }

    if (this.state === 'idle' && beat >= this.next - WARN) {
      if (beat >= this.next) this.next = this.nextAfter(beat);       // came in too late for this one's Warning
      else { this.state = 'warn'; this.at = this.next; this.hit = false; this.dropped = false; this.show(true); }
    }
    if (this.state === 'warn') {
      const k = Math.min(1, Math.max(0, (beat - (this.at - WARN)) / WARN));
      this.place(B.from, k);
      if (!this.dropped && beat >= this.at - 1) { this.dropped = true; sfx.bassDrop(); }   // the sub drop a beat ahead
      if (beat >= this.at) this.launch();
    }
    if (this.state === 'wave') this.roll(dt, beat, skip);
  }

  // on the bar: it goes
  launch() {
    const run = this.run, c = this.mat.uniforms.uColor.value, b = this.bar;
    this.state = 'wave'; this.z = this.B.from;
    this.place(this.B.from, 1);
    // the Soundbar kicks: a flash along its grille, the room trembles, a thump with the sub under it
    for (let i = 0; i < 5; i++) run.fx.impact(_o.set(THREE.MathUtils.lerp(b.min.x, b.max.x, (i + 0.5) / 5), (b.min.y + b.max.y) / 2, b.min.z - 0.01), c, 0.02, 4);
    juice.feel('bass');
    sfx.bassWave();
    if (!this.told) { this.told = true; run.hud.toast('🔊 The Soundbar\'s bass wave: jump it, or be up on the furniture', 2800); }
  }

  // the wave rolling down the room: where its back edge is, how far it went since last frame, the hit
  roll(dt, beat, skip) {
    const run = this.run, B = this.B, P = run.player.position, r = run.cfg.radius;
    const was = this.z, z = this.z = B.from - B.speed * (beat - this.at) * 60 / run.bpm;
    this.place(z, 1);
    // the one check: the jelly's feet under its top, its footprint inside what the wave swept this frame
    // (from its front now to its back last frame), in the room's width
    if (!this.hit && !skip && !(run.polypT > 0) && P.y < B.height && P.x > B.across[0] - r && P.x < B.across[1] + r
      && P.z < was + r && P.z > z - B.width - r) {
      this.hit = true;
      bus.emit('damage_taken', { targetId: PLAYER, amount: B.dmg, source: 'bass', at: new THREE.Vector3(P.x, P.y, P.z + 0.1) });
      run.fx.impact(_o.set(P.x, P.y + run.cfg.height * 0.4, P.z), this.mat.uniforms.uColor.value, 0.03, 12);
      sfx.bassHit();
    }
    // the wake: motes of its colour lift off the floor behind it and fade (only the look: they don't hurt)
    if ((this.moteT -= dt) <= 0) {
      this.moteT = LOOK.num('bass-mote-gap', 0.05);
      const c = this.mat.uniforms.uColor.value, life = LOOK.num('bass-mote-life', 0.5);
      for (let i = 0; i < 4; i++) run.fx.glow.emit(_o.set(THREE.MathUtils.lerp(B.across[0], B.across[1], Math.random()), 0.005, z + Math.random() * 0.03), c, 0.006, 0.001, life, 0.8, _v.set(0, 0.08 + Math.random() * 0.06, 0.03));
    }
    if (z - B.width < B.to) this.stop();
  }

  // done (or dropped): hidden, and the next one is on the next bar line it comes round to
  stop() { this.state = 'idle'; this.show(false); this.next = this.nextAfter(this.beat ?? 0); }
}
