// The sun: a stage's `sun` block (act 4's room, stage4.js). Daylight creeps across the room from the
// window wall, its line running straight across in x and moving in z from `from` to `to` over the
// night, then staying there. All of the room on the window side of the line is sunlit, floor and
// furniture tops alike, and a jelly standing in it dries out: it loses `drain` Health a second (the
// act's `power` on top, as every hurt), out through the event bus as damage_taken, source 'sun', so
// the run log and the death screen can name it. Bugs and Elites aren't hurt.
//
// It is never a light (CLAUDE.md rule 7): the room's own shaders light it (baked-ao.js, the patch
// every apartment material already shares), so it lies on everything on the window side of the line,
// curved sofa arms and the sides facing the window too, warming each surface's own colour, with a soft
// edge and a hard hot rim on the line (the floor shape of its Warning). A low hex volume stands on the
// line over the strip it moves into next (fx.volume, the Warning's volume), both in --hostile-sun.
// One draw (the volume), no shader of its own; nothing is allocated or compiled while it plays.
//
// While the jelly is in it: the bell dulls (avatar.dry), steam comes off it, a low sizzle, and a
// small tremor each second it bites (juice.feel('sun')), when the rim flares. Look values: --sun-*.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { hostile } from './vfx.js';
import { bus, PLAYER } from './events.js';
import { juice } from './juice.js';
import { sfx } from './sfx.js';
import { BAKED_AO } from './baked-ao.js';

const _o = new THREE.Vector3(), _mid = new THREE.Vector3(), _top = new THREE.Vector3();
const CHEST = 0.06;          // m: a chest's half width and a little: how far into the shade its spot must be
const OFF = -1e4;            // the line's z when there's no sun (baked-ao.js skips it)
const U = BAKED_AO.uniforms;

export class Sunrise {
  constructor(run) {
    this.run = run;
    this.sun = null;          // the stage's sun block, or null
    this.vol = null;          // the Warning's volume on the line
    this.line = 0;            // z of the line now
    this.lit = false;         // the jelly is in the sun this frame
  }

  // where the line is `t` seconds into the night
  lineAt(t) {
    const S = this.sun;
    return S.from + (S.to - S.from) * Math.min(1, Math.max(0, t / (this.run.duration || 1)));
  }
  // false when a chest at `z` would be in the sun before `until` (seconds into the night): it would
  // turn up where the jelly has to burn to reach it
  shaded(z, until) { return !this.sun || z > this.lineAt(until) + CHEST; }

  // the run starts (Run.start): this stage's sun, or none
  start(stage) {
    this.sun = stage.sun || null;
    // the look's timings, read once (update runs every frame)
    this.K = { beat: LOOK.num('sun-volume-beat', 1.5), tick: LOOK.num('sun-tick', 1), pulse: LOOK.num('sun-pulse', 0.8), steam: LOOK.num('sun-steam-gap', 0.35),
      sizzle: LOOK.num('sun-sizzle-gap', 0.32), dryIn: LOOK.num('sun-dry-in', 1.2), dryOut: LOOK.num('sun-dry-out', 2), flash: LOOK.num('sun-flash', 0.02) };
    this.lit = false; this.tickT = 0; this.steamT = 0; this.sizzleT = 0; this.tagT = 0; this.dryK = 0; this.shown = -1; this.told = false;
    U.sunLine.value = OFF; U.sunPulse.value = 0;
    if (!this.sun) { if (this.vol) this.vol.visible = false; return; }
    if (!this.vol) this.build();
    this.place(0);
  }

  // the room's shaders' sun (baked-ao.js) and the Warning's volume: a low hex wall standing on the
  // line over the strip it moves into next
  build() {
    const S = this.sun, [x0, x1] = S.across;
    U.sunColor.value.set(hostile('sun'));
    U.sunDir.value.fromArray(LOOK.nums('sun-dir', [0.3, 0.55, -1])).normalize();
    U.sunFill.value = LOOK.num('sun-fill', 1.6); U.sunSoft.value = LOOK.num('sun-soft', 0.03); U.sunWarm.value = LOOK.num('sun-warm', 0.5);
    U.sunRim.value = LOOK.num('sun-rim', 0.035); U.sunRimGlow.value = LOOK.num('sun-rim-glow', 0.85);
    this.vol = this.run.fx.volume(hostile('sun'), 'lane', _o.set((x0 + x1) / 2, 0, S.from), new THREE.Vector3(x1 - x0, LOOK.num('sun-volume-height', 0.04), LOOK.num('sun-volume-ahead', 0.06)));
    this.vol.material.opacity = LOOK.num('sun-volume-opacity', 0.6);
  }

  // the line at `t` seconds into the night
  place(t) {
    const z = this.line = U.sunLine.value = this.lineAt(t);
    this.vol.position.z = z;
    this.vol.visible = z < this.sun.to;   // the Warning while it still moves: stopped, nothing more fills
    this.vol.material.progress = (this.run.t / this.K.beat) % 1;
  }

  // each frame of play
  update(dt) {
    if (!this.sun) return;
    const run = this.run, P = run.player.position, S = this.sun, K = this.K;
    this.place(run.t);
    U.sunPulse.value = Math.max(0, U.sunPulse.value - dt * 3);
    // the one check: the jelly's feet on the window side of the line
    const lit = run.phase === 'explore' && P.z < this.line && !(run.polypT > 0);
    const mid = _mid.set(P.x, P.y + run.cfg.height * 0.5, P.z), colour = U.sunColor.value;
    const top = _top.set(P.x, P.y + run.cfg.height * 0.9, P.z);   // steam rises off the crown, clear of the bell
    if (lit) {
      bus.emit('damage_taken', { targetId: PLAYER, amount: S.drain * dt, source: 'sun', drain: true });
      if (!this.lit) {   // stepping in: a hiss and a puff of steam off the bell, a flash where the light catches it
        run.gadgets.looks.steam(top);
        run.fx.impact(mid, colour, K.flash, 6);
        sfx.sunIn();
        if (run.t - this.tagT > 3 || !this.tagT) { this.tagT = run.t; run.fx.number(_o.set(P.x, P.y + run.cfg.height * 1.1, P.z), 'DRYING', '#' + colour.getHexString(), 13); }
        if (!this.told) { this.told = true; run.hud.toast('The sun dries you out: keep to the shade', 2600); }
        this.tickT = K.tick;
      }
      if ((this.tickT -= dt) <= 0) { this.tickT += K.tick; juice.feel('sun'); U.sunPulse.value = K.pulse; }   // it bites: a tremor, the rim flares
      if ((this.steamT -= dt) <= 0) { this.steamT = K.steam; run.gadgets.looks.steam(top); }
      if ((this.sizzleT -= dt) <= 0) { this.sizzleT = K.sizzle; sfx.sunSizzle(); }
    }
    this.lit = lit;
    // the bell dries as it stays, and comes back slowly in the shade (that is only the look: the drain stops at once)
    this.dryK = lit ? Math.min(1, this.dryK + dt / K.dryIn) : Math.max(0, this.dryK - dt / K.dryOut);
    const av = run.player.avatar;
    if (av !== this.avatar) { this.avatar = av; this.shown = -1; }
    if (av?.dry && this.dryK !== this.shown) { this.shown = this.dryK; av.dry(this.dryK); }
  }
}
