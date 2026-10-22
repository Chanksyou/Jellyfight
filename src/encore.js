// Act 4's boss, the Encore: the DJ booth on the arena's stage (act4-arena.js, encore-model.js). It
// doesn't move; it plays its set, every attack on its song's beat:
//   the floor waves and a laser every 4 beats (encore-floor.js EncoreSet, encore-laser.js),
//   from bar 16 the speaker waves (encore-pulse.js), from bar 32 the disco ball (encore-disco.js),
//   and its stage edge shocks a jelly that touches it (encore-contact.js).
// At bar 8, and every 16 bars after, it calls 4 stag beetles (content/enemies.kdl "beetle") onto the
// floor and raises a force field: while any of them lives it takes no damage. Otherwise your attacks
// hurt it like any boss (its hit sphere is in front of the booth, clear of the stage's collider), and
// at 0 Health the set stops and it is beaten.
//
// Like the other bosses (vacuum.js), what it does to you goes out as events (damage_taken) and the
// shove of its speakers comes back as `push`. Its beat comes from the song (main.js hands it a
// `song`: beat(dt), quiet(beat), drop(beat)); without one it keeps its own tempo clock.
import * as THREE from 'three';
import { bus, PLAYER } from './events.js';
import { CONTENT } from './content.js';
import { LOOK } from './look.js';
import { sfx } from './sfx.js';
import { VolumeMaterial, volumeGeometry } from './vfx.js';
import { TRACKS } from './song-track.js';
import { EncoreFloor, EncoreSet } from './encore-floor.js';
import { EncoreLasers } from './encore-laser.js';
import { EncoreDisco } from './encore-disco.js';
import { EncorePulses } from './encore-pulse.js';
import { EncoreContact } from './encore-contact.js';

// what it does, for the attack audit (src/stories/kit.js EVERY_ATTACK)
export const ATTACKS = { calm: ['floor', 'laser', 'pulse', 'disco', 'contact', 'beetles'], angry: [] };
// where your attacks find it: in front of the booth, so a bubble reaches it before the stage's collider
const TARGET = [0, 0.13, -0.17];

export class Encore {
  constructor(scene, enemies, fx, B, world, ctx = {}) {
    Object.assign(this, { scene, enemies, fx, B, world });
    this.arenaView = ctx.arena;
    this.song = ctx.song || null;
    this.music = 'encore';                // what run.js musicState plays for it (music.js / song-track.js)
    this.def = CONTENT.bosses.encore;
    this.maxHp = this.hp = this.def.hp;
    this.r = 0.14;
    this.dead = false; this.dying = false; this.rise = 1;
    this.state = 'set';
    this.t = 0; this.clock = 0; this.beat = null;
    this.guards = []; this.summoned = -1; this.shieldT = 0; this.flash = 0;
    this.holder = new THREE.Object3D(); this.holder.position.set(...TARGET);
    this.toughness = ctx.toughness ?? 1;
    const A = this.arenaView;
    const hit = (dmg) => this.hurtPlayer(dmg);
    this.floor = new EncoreFloor(A, { onHit: hit });
    this.lasers = new EncoreLasers(A, { onHit: hit });
    this.disco = new EncoreDisco(A, { onHit: hit, quiet: (b) => this.quiet(b) });
    this.shove = { x: 0, z: 0 };
    this.pulses = new EncorePulses(A, { quiet: (b) => this.quiet(b), push: (dx, dz) => { this.shove.x += dx; this.shove.z += dz; } });
    this.contact = new EncoreContact(scene, A.shockSolids, { onShock: (dmg, point) => {
      this.hurtPlayer(dmg);
      const away = new THREE.Vector3().subVectors(this.player.position, point).setY(0);
      if (away.lengthSq() > 1e-8) bus.emit('knockback', { targetId: PLAYER, dir: away.normalize(), force: 0.4 });
    } });
    this.set = null;
    this.field = forceField(); this.field.position.set(0, 0.07, -0.43); A.root.add(this.field);
  }

  get position() { return this.holder.position; }
  center(out = new THREE.Vector3()) { return out.copy(this.holder.position); }
  // up while any of the beetles it called is alive
  get shielded() { return this.guards.length > 0; }

  quiet(b) { return !!this.song?.quiet?.(b); }
  hurtPlayer(dmg) { if (!this.dead) bus.emit('damage_taken', { targetId: PLAYER, amount: dmg, source: 'boss' }); }

  damage(amount, color = '#fff', feedback = {}) {
    if (this.dead) return;
    if (this.shielded) { this.flash = 1; this.fx.number(this.center().setY(this.holder.position.y + 0.1), 'SHIELDED', LOOK.color('encore-shield', '#3fd0ff'), 12); return; }   // it bounces off the force field
    this.hp -= amount;
    this.fx.number(this.center().setY(this.holder.position.y + 0.1), amount, color, 16, feedback);
    if (this.hp <= 0) this.beaten();
  }
  // no cat to finish it: the music stops and it's beaten (run.js onBossDead)
  beaten() {
    this.hp = 0; this.dead = true; this.state = 'beaten';
    this.floor.reset(); this.lasers.reset(); this.disco.reset(); this.pulses.reset(); this.contact.reset();
    this.arenaView.boss.clearLighting?.();
    for (const g of this.guards) if (!g.dead) this.enemies.kill(g, true);
    this.guards = [];
    this.field.visible = false;
  }

  // the beat now: the song's, or its own tempo clock (no song, music off, or the song still loading)
  beatNow(dt) {
    const b = this.song?.beat?.(dt);
    if (b === null) return null;                                    // the song is loading: hold
    if (b !== undefined) return b;
    return (this.clock += dt * TRACKS.encore.bpm / 60);
  }

  // At bar 8 and every 16 bars after: 4 beetles on the open floor, and the force field while they live
  summon(beat) {
    const S = this.def.skills.beetles || {}, at = S.at ?? 32, every = S.every ?? 64, count = S.count ?? 4;
    const n = Math.floor((beat - at) / every);
    if (beat < at || n <= this.summoned) return;
    this.summoned = n;
    const spots = [[-0.45, 0.05], [0.45, 0.05], [-0.42, 0.5], [0.42, 0.5]];
    for (let k = this.guards.length; k < count; k++) {
      const [x, z] = spots[k % spots.length], p = new THREE.Vector3(x, 0.02, z);
      const e = this.enemies.spawn('beetle', p, this.toughness);
      if (e) { this.guards.push(e); this.fx.puff?.(p, 0x6fd2ff, 0.08, 0.5); }
    }
    this.shieldT = 0;
    bus.emit('toast', { text: 'The Encore calls its beetles! Its force field holds while they live.' });
  }

  update(dt, player) {
    this.player = player;
    this.t += dt;
    this.shove.x = this.shove.z = 0;
    this.guards = this.guards.filter((g) => !g.dead);
    const A = this.arenaView, beat = this.dead ? null : this.beatNow(dt);
    if (!this.dead && beat !== null) {
      this.beat = beat;
      this.set ||= new EncoreSet(this.floor, Math.ceil(beat / 4) * 4 + 4, { quiet: (b) => this.quiet(b), drop: (b) => !!this.song?.drop?.(b), target: () => [player.position.x, player.position.z], lasers: this.lasers });
      this.set.update(beat);
      this.floor.update(beat, player);
      this.lasers.update(beat, player);
      this.disco.update(beat, player);
      this.pulses.update(beat, player, dt);
      this.summon(beat);
      // never stuck behind a shield for ever (a beetle that can't reach you)
      if (this.shielded && (this.shieldT += dt) > (this.def.skills.beetles?.timeout ?? 90)) { for (const g of this.guards) this.enemies.kill(g, true); this.guards = []; }
    }
    this.contact.update(dt, player, !this.dead, !!this.fx.reducedMotion?.matches);
    A.updateAmbience?.(this.dead ? null : beat, !!this.fx.reducedMotion?.matches, beat !== null && this.quiet(beat));
    A.boss.update(dt, !!this.fx.reducedMotion?.matches);
    // the force field: up while beetles live, flaring when hit
    this.field.visible = this.shielded;
    this.flash = Math.max(0, this.flash - dt * 4);
    this.field.material.opacity = LOOK.num('encore-shield-opacity', 0.55) * (0.85 + 0.15 * Math.sin(this.t * 3)) + this.flash;
    bus.emit('boss_health', { name: this.B.name, hp: this.hp, maxHp: this.maxHp, shielded: this.shielded, shieldText: this.shielded ? `Shielded: beat the beetles (${this.guards.length} left)` : undefined });
    return { push: dt > 0 && (this.shove.x || this.shove.z) ? { x: this.shove.x / dt, z: this.shove.z / dt } : null };
  }

  dispose() {
    this.floor.dispose(); this.lasers.dispose(); this.disco.dispose(); this.pulses.dispose(); this.contact.dispose();
    this.field.removeFromParent(); this.field.material.dispose();
    this.arenaView.boss.clearLighting?.();
  }
}

// The force field: the shared hex shell (vfx.js VolumeMaterial) as a see-through dome over the booth,
// in its own cyber blue, flaring when a hit bounces off it
function forceField() {
  const mat = new VolumeMaterial(LOOK.color('encore-shield', '#3fd0ff'), 'dome');
  mat.progress = 1;
  mat.uniforms.uHex.value = LOOK.num('energy-shield-hex', 65);
  const m = new THREE.Mesh(volumeGeometry('dome'), mat);
  m.scale.set(0.5, 0.42, 0.32); m.name = 'Encore force field'; m.userData.noCollide = true; m.visible = false; m.renderOrder = 5;
  return m;
}
