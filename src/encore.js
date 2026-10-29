// Act 4's boss, the Encore: the DJ booth on the arena's stage (act4-arena.js, encore-model.js). It
// doesn't move; it plays its set, every attack on its song's beat:
//   the floor waves and a laser every 4 beats (encore-floor.js EncoreSet, encore-laser.js),
//   from bar 16 the speaker waves (encore-pulse.js), from bar 32 the disco ball (encore-disco.js),
//   and its stage edge shocks a jelly that touches it (encore-contact.js).
// It opens behind a force field (bosses.kdl start `guard`) that hits bounce off. Otherwise your attacks
// hurt it like any boss (its hit sphere is in front of the booth, clear of the stage's collider), and
// at 0 Health the set stops and it is beaten.
//
// At half Health its booth shorts out (`meltdown`): a short cut scene (main.js plays `cut`: the game
// holds and the camera cuts to the booth) of sparks spraying out of it, smoke, its LED panels
// flickering and dying red, the DJs jolting. From then on it keeps sparking and smoking, its panels
// pulse red on the beat, and its disco ball comes down for good (encore-disco.js stay).
//
// Like the other bosses (vacuum.js), what it does to you goes out as events (damage_taken) and the
// shove of its speakers comes back as `push`. Its beat comes from the song (main.js hands it a
// `song`: beat(dt), quiet(beat), drop(beat)); without one it keeps its own tempo clock.
import * as THREE from 'three';
import { bus, PLAYER } from './events.js';
import { CONTENT } from './content.js';
import { LOOK } from './look.js';
import { sfx } from './sfx.js';
import { juice } from './juice.js';
import { VolumeMaterial, volumeGeometry, hostile } from './vfx.js';
import { TRACKS } from './song-track.js';
import { EncoreFloor, EncoreSet } from './encore-floor.js';
import { EncoreLasers } from './encore-laser.js';
import { EncoreDisco } from './encore-disco.js';
import { EncorePulses } from './encore-pulse.js';
import { EncoreContact } from './encore-contact.js';

// what it does, for the attack audit (src/stories/kit.js EVERY_ATTACK)
export const ATTACKS = { calm: ['floor', 'laser', 'pulse', 'disco', 'contact'], angry: [] };
// where your attacks find it: in front of the booth, so a bubble reaches it before the stage's collider
const TARGET = [0, 0.13, -0.17];
const _hit = new THREE.Vector3();

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
    this.flash = 0;
    this.guardT = this.def.skills.start?.guard ?? 0; this.opening = this.guardT > 0;   // its force field is up as the fight opens (bosses.kdl start `guard`)
    this.holder = new THREE.Object3D(); this.holder.position.set(...TARGET);
    const A = this.arenaView;
    // each hit lands with a flash and sparks at the jelly in that attack's colour
    this.floor = new EncoreFloor(A, { onHit: (dmg, c) => this.hurtPlayer(dmg, hostile(`encore-${c?.dj === 'gold' ? 'gold' : 'silver'}`)) });
    this.lasers = new EncoreLasers(A, { onHit: (dmg) => this.hurtPlayer(dmg, hostile('encore-laser')) });
    this.disco = new EncoreDisco(A, { onHit: (dmg) => this.hurtPlayer(dmg, hostile('encore-disco')), quiet: (b) => this.quiet(b) });
    this.shove = { x: 0, z: 0 };
    this.pulses = new EncorePulses(A, { quiet: (b) => this.quiet(b), push: (dx, dz) => { this.shove.x += dx; this.shove.z += dz; } });
    this.contact = new EncoreContact(scene, A.shockSolids, { onShock: (dmg, point) => {
      this.hurtPlayer(dmg);
      const away = new THREE.Vector3().subVectors(this.player.position, point).setY(0);
      if (away.lengthSq() > 1e-8) bus.emit('knockback', { targetId: PLAYER, dir: away.normalize(), force: 0.4 });
    } });
    this.set = null;
    this.field = forceField(A.boss); A.root.add(this.field); this.fieldScale = this.field.scale.clone();
    this.booth = boothBox(A.boss);
    this.broken = false; this.cut = null; this.hurtT = 0; this.sparkT = 0; this.home = A.boss.root.position.clone();
    this.sparks = new Sparks(A.root);
  }

  get position() { return this.holder.position; }
  center(out = new THREE.Vector3()) { return out.copy(this.holder.position); }
  // up while it warms up as the fight opens, and while it reboots after shorting out (guardT)
  get shielded() { return this.guardT > 0; }

  quiet(b) { return !!this.song?.quiet?.(b); }
  hurtPlayer(dmg, color = null) {
    if (this.dead) return;
    bus.emit('damage_taken', { targetId: PLAYER, amount: dmg, source: 'boss' });
    if (color && this.player) this.fx.impact(_hit.copy(this.player.position).setY(this.player.position.y + 0.03), color, 0.03, 10);
  }

  damage(amount, color = '#fff', feedback = {}) {
    if (this.dead || this.cut || this.falling) return;              // (nothing lands while it shorts out or falls)
    if (this.shielded) { this.flash = 1; this.fx.number(this.center().setY(this.holder.position.y + 0.1), 'SHIELDED', LOOK.color('encore-shield', '#3fd0ff'), 12); return; }   // it bounces off the force field
    this.hp -= amount;
    this.fx.number(this.center().setY(this.holder.position.y + 0.1), amount, color, 16, feedback);
    this.hurtT = 1;                                                   // the booth flinches: its panels flash white, it jolts
    if (this.hp <= 0) this.beaten();
    else if (!this.broken && this.hp <= this.maxHp * (this.def.skills.meltdown?.at ?? 0.5)) this.meltdown();
  }
  // Half Health: the booth shorts out. Its set stops for the cut scene, then plays on, broken
  meltdown() {
    this.broken = true;
    this.floor.reset(); this.lasers.reset(); this.pulses.reset(); this.contact.reset(); this.set = null;
    const b = this.booth, c = b.getCenter(new THREE.Vector3()), short = juice.calm || !!this.fx.reducedMotion?.matches;
    this.cut = { t: 0, length: LOOK.num(short ? 'encore-meltdown-calm-time' : 'encore-meltdown-time', short ? 1.2 : 3.4), next: 0, blown: false,
      // the shot: in front of the booth and off to one side, easing in
      from: new THREE.Vector3(c.x + 0.34, b.max.y * 0.75, b.max.z + 0.62), to: new THREE.Vector3(c.x + 0.18, b.max.y * 0.6, b.max.z + 0.42), look: c.clone().setY(b.max.y * 0.5) };
    juice.feel('impact-big'); sfx.lightningBig?.(); sfx.boom();
    bus.emit('toast', { text: 'The Encore shorts out! Its disco ball is down for good.' });
  }
  // sparks spraying out of a random spot on the pyramid's front face (it slopes back as it rises),
  // a flash there and a puff of dark smoke
  spark(big = false) {
    const b = this.booth, h = 0.1 + Math.random() * 0.75, w = (b.max.x - b.min.x) * 0.3 * (1 - h);
    const p = new THREE.Vector3((b.min.x + b.max.x) / 2 + (Math.random() * 2 - 1) * w, b.min.y + h * (b.max.y - b.min.y), b.max.z - h * (b.max.z - b.min.z) * 0.6 + 0.01);
    const hot = LOOK.list('encore-sparks', ['#fff6c8', '#ffd23a', '#ff8a1e']);
    this.fx.impact(p, hot[1], big ? 0.09 : 0.045, big ? 28 : 14);
    this.sparks.emit(p, big ? 70 : 24, big ? 1.1 : 0.75);
    if (big || Math.random() < 0.6) this.fx.puff(p.clone().setY(p.y + 0.02), LOOK.color('encore-smoke', '#8c8c99'), big ? 0.1 : 0.05, big ? 1.6 : 1);
    big ? sfx.lightningBig?.() : sfx.zap?.();
    return p;
  }
  // No cat to finish it: it goes down in its own cut scene (`falling`, main.js frames `cut`), the music
  // cut dead (run.js musicState). Its set stops; explosions climb over the booth,
  // its panels die section by section, the DJs slump over their decks and the disco ball crashes down
  // and shatters; one last blow-out, then the smoke settles and it's beaten (`dead`: run.js onBossDead)
  beaten() {
    if (this.falling || this.dead) return;
    this.hp = 0; this.state = 'falling';
    this.floor.reset(); this.lasers.reset(); this.pulses.reset(); this.contact.reset(); this.set = null;
    this.field.visible = false;
    const b = this.booth, c = b.getCenter(new THREE.Vector3()), short = juice.calm || !!this.fx.reducedMotion?.matches;
    const length = LOOK.num(short ? 'encore-defeat-calm-time' : 'encore-defeat-time', short ? 1.5 : 4.6);
    this.falling = { t: 0, length, next: 0, blown: false, ball: this.disco.hanger.visible ? { y: this.disco.hanger.position.y, v: 0, down: false } : null };
    // the shot: a wide view of the whole stage, drifting slowly back as it comes apart
    this.cut = { t: 0, length, from: new THREE.Vector3(c.x - 0.3, b.max.y * 1.1, b.max.z + 0.7), to: new THREE.Vector3(c.x - 0.15, b.max.y * 1.4, b.max.z + 1.0), look: c.clone().setY(b.max.y * 0.45) };
    for (const who of ['silver', 'gold']) this.arenaView.boss.dance(who, null);
    this.arenaView.boss.setLighting('all', 0xffffff, 1);
    juice.feel('boss-kill'); sfx.lightningBig?.(); sfx.boom();
  }
  // each frame of its fall (after the model's own update, so the slump sticks)
  fallDown(dt) {
    const F = this.falling, C = this.cut, M = this.arenaView.boss, D = this.disco, u = Math.min(1, F.t / F.length);
    F.t += dt; if (C) C.t = F.t;
    // explosions, faster and faster until the blow-out at 60%, then dying away
    if (F.t >= F.next) { F.next = F.t + (u < 0.6 ? 0.3 - 0.22 * (u / 0.6) : 0.25 + (u - 0.6)); if (u < 0.85) this.spark(u > 0.35 && Math.random() < 0.4); }
    if (!F.blown && u >= 0.6) {
      F.blown = true;
      for (let k = 0; k < 4; k++) this.spark(true);
      const c = this.booth.getCenter(_hit);
      this.fx.impact(c, LOOK.color('encore-broken', '#ff2a3a'), 0.18, 30);
      this.fx.ring(c.setY(0.01), 0xffd23a, 0.7, 0.6);
      juice.feel('boss-kill'); sfx.boom(); sfx.lightningBig?.();
    }
    // its panels die section by section: still lit ones stutter, then go dark for good
    const n = M.triangleCount || 0, alive = Math.ceil(n * (1 - Math.min(1, u / 0.62)));
    for (let i = 0; i < n; i++) M.setTriangle(i, Math.random() < 0.5 ? 0xffffff : LOOK.color('encore-broken', '#ff2a3a'), i < alive ? Math.random() * 0.8 : 0);
    // it shudders, and after the blow-out sags a little to one side
    const sag = THREE.MathUtils.smoothstep(u, 0.6, 0.75);
    M.root.position.copy(this.home).add(_hit.set((Math.random() - 0.5) * 0.01 * (1 - sag), -0.012 * sag, 0));
    M.root.rotation.z = 0.04 * sag;
    // the DJs slump over their decks
    const slump = THREE.MathUtils.smoothstep(u, 0.15, 0.7);
    for (const h of M.heads) { h.rotation.x += slump * 0.7; h.rotation.z = (Math.random() - 0.5) * 0.3 * (1 - slump); }
    // the disco ball (if it was down) snaps off and crashes onto the floor, shattering
    if (F.ball && !F.ball.down) {
      if (u > 0.25) { F.ball.v -= 2.5 * dt; F.ball.y += F.ball.v * dt; }
      D.hanger.position.y = F.ball.y; D.hanger.rotation.z += dt * (u > 0.25 ? 3 : 0);
      if (F.ball.y < 0.12) {
        F.ball.down = true; D.hanger.visible = D.spots.visible = D.beams.visible = false;
        const p = D.hanger.position.clone().setY(0.03);
        this.fx.impact(p, 0xffffff, 0.12, 24); this.fx.ice.shatter(p, 30, 0.012, 0.8, 0);
        juice.feel('impact-big'); sfx.shatter?.();
      }
    }
    if (F.t >= F.length) {
      this.falling = null; this.cut = null; this.dead = true; this.state = 'beaten';
      D.reset(); M.clearLighting?.();
    }
  }

  // the beat now: the song's, or its own tempo clock (no song, music off, or the song still loading)
  beatNow(dt) {
    const b = this.song?.beat?.(dt);
    if (b === null) return null;                                    // the song is loading: hold
    if (b !== undefined) return b;
    return (this.clock += dt * TRACKS.encore.bpm / 60);
  }

  update(dt, player) {
    this.player = player;
    this.t += dt;
    this.shove.x = this.shove.z = 0;
    const A = this.arenaView, beat = this.dead ? null : this.beatNow(dt), M = A.boss;
    if (this.falling) { /* its fall: fallDown, after the model's update */ }
    else if (this.cut) this.shortOut(dt, beat);
    else if (!this.dead && beat !== null) {
      this.beat = beat;
      this.set ||= new EncoreSet(this.floor, Math.ceil(beat / 4) * 4 + 4, { quiet: (b) => this.quiet(b), drop: (b) => !!this.song?.drop?.(b), target: () => [player.position.x, player.position.z], lasers: this.lasers });
      this.set.update(beat);
      this.floor.update(beat, player);
      this.lasers.update(beat, player);
      if (this.broken && this.disco.stayFrom == null) this.disco.stay(Math.ceil(beat / 4) * 4);   // down from the next bar, for good
      this.disco.update(beat, player);
      this.pulses.update(beat, player, dt);
      if (this.guardT > 0) { this.guardT = Math.max(0, this.guardT - dt); if (!this.guardT) this.opening = false; }   // warming up or rebooting: counts down while its set plays
      // broken: it keeps sparking and smoking, every second or two
      if (this.broken && (this.sparkT -= dt) <= 0) { this.sparkT = 0.8 + Math.random() * 1.4; this.spark(); }
    }
    this.contact.update(dt, player, !this.dead && !this.cut, !!this.fx.reducedMotion?.matches);
    A.updateAmbience?.(this.dead || this.falling ? null : beat, !!this.fx.reducedMotion?.matches, beat !== null && this.quiet(beat));
    M.update(dt, !!this.fx.reducedMotion?.matches);
    if (this.falling) this.fallDown(dt);
    // its panels: a white flash when a hit lands; broken, a red pulse on the beat between floor waves
    this.hurtT = Math.max(0, this.hurtT - dt * 6);
    if (!this.cut && !this.dead) {
      const red = this.broken && beat !== null ? Math.exp(-((beat % 1 + 1) % 1) * 4) * 0.8 : 0;
      if (this.hurtT > 0) { M.setLighting('all', 0xffffff, this.hurtT); this.floor.lit = true; }   // (the floor waves' own lighting comes back after)
      else if (this.broken && !this.floor.casts.length) M.setLighting('all', LOOK.color('encore-broken', '#ff2a3a'), 0.25 + red);
    }
    this.sparks.update(dt);
    // on the beat the DJs nod and the booth pumps; a hit squashes it a touch (the short-out shakes it)
    const on = !this.cut && !this.dead && beat !== null && !this.quiet(beat), kick = on ? Math.exp(-((beat % 1 + 1) % 1) * 6) : 0;
    if (!this.cut) { M.root.position.copy(this.home); for (const h of M.heads) h.rotation.x += kick * 0.22; }
    M.root.scale.set(1 + kick * 0.008, 1 - this.hurtT * 0.015 - kick * 0.012, 1 + kick * 0.008);
    // the force field: grows in over its booth, flares when hit, and shatters in a
    // spray of cyan shards when it drops
    if (this.wasShielded && !this.shielded && !this.dead) {
      const c = this.booth.getCenter(new THREE.Vector3()), blue = LOOK.color('encore-shield', '#3fd0ff');
      this.fx.burst(c.setY(this.booth.max.y * 0.6), [blue, '#ffffff', blue], 24, 0.006, 0.7, 0);
      this.fx.ring(c.setY(0.01), blue, 0.6, 0.5); sfx.shatter?.(); juice.feel('impact');
    }
    this.fieldUp = this.shielded ? Math.min(1, (this.fieldUp || 0) + dt * 3) : 0;
    this.wasShielded = this.shielded;
    this.field.visible = this.shielded;
    this.field.scale.copy(this.fieldScale).multiplyScalar(0.6 + 0.4 * (1 - (1 - this.fieldUp) ** 3));
    this.flash = Math.max(0, this.flash - dt * 4);
    this.field.material.opacity = LOOK.num('encore-shield-opacity', 0.55) * (0.85 + 0.15 * Math.sin(this.t * 3)) + this.flash;
    bus.emit('boss_health', { name: this.B.name, hp: this.hp, maxHp: this.maxHp, shielded: this.shielded, shieldText: this.guardT > 0 ? `Shielded: ${this.opening ? 'warming up' : 'rebooting'} (${Math.ceil(this.guardT)} s)` : undefined });
    return { push: dt > 0 && (this.shove.x || this.shove.z) ? { x: this.shove.x / dt, z: this.shove.z / dt } : null };
  }

  // The cut scene's steps (main.js holds the game and frames `cut`): bursts of sparks all over the booth,
  // faster and faster, its panels flickering white and red, the DJs jolting, one big blow-out two thirds
  // in, then its panels die to a dull red and the set plays on
  shortOut(dt, beat) {
    const C = this.cut, M = this.arenaView.boss, u = C.t / C.length;
    C.t += dt;
    if (C.t >= C.next) { C.next = C.t + 0.22 - 0.15 * u; this.spark(); }
    if (!C.blown && u >= 0.62) { C.blown = true; this.spark(true); this.spark(true); juice.feel('elite-kill'); sfx.boom(); }
    // its panels fail: mostly a dying, stuttering red, now and then a white surge
    const surge = Math.random() < 0.18;
    M.setLighting('all', surge ? 0xffffff : LOOK.color('encore-broken', '#ff2a3a'), surge ? 0.7 : Math.random() < 0.35 ? 0 : 0.2 + Math.random() * 0.7);
    M.root.position.copy(this.home).add(new THREE.Vector3((Math.random() - 0.5) * 0.008, (Math.random() - 0.5) * 0.004, 0).multiplyScalar(1 - u * 0.5));
    for (const h of M.heads) h.rotation.z = (Math.random() - 0.5) * 0.5 * (1 - u);
    if (C.t >= C.length) {
      for (const h of M.heads) h.rotation.z = 0; this.cut = null; M.root.position.copy(this.home); this.floor.lit = true;
      // it reboots behind its force field: it can't be hurt for a while (bosses.kdl meltdown `guard`)
      this.guardT = this.def.skills.meltdown?.guard ?? 10; this.opening = false;
    }
  }

  dispose() {
    this.sparks.dispose();
    this.floor.dispose(); this.lasers.dispose(); this.disco.dispose(); this.pulses.dispose(); this.contact.dispose();
    this.field.removeFromParent(); this.field.material.dispose();
    this.arenaView.boss.clearLighting?.();
    this.arenaView.boss.root.position.copy(this.home); this.arenaView.boss.root.scale.setScalar(1);
  }
}

// The force field: the shared hex shell (vfx.js VolumeMaterial) as a see-through dome over the whole
// booth (sized from its collider, with room to spare, so none of it hides inside the booth), in its
// own cyber blue with big bright cells (`--encore-shield-hex`, `--encore-shield-glow`), flaring when a
// hit bounces off it
// Sparks: glowing streaks that spray out, fall, skip off the floor and fade from white-hot to orange.
// One pooled, additive instanced draw (no lights); oldest reused when it's full
const SPARKS = 220, _sm = new THREE.Matrix4(), _sq = new THREE.Quaternion(), _sv = new THREE.Vector3(), _ss = new THREE.Vector3(), _sc = new THREE.Color(), _sup = new THREE.Vector3(0, 1, 0);
class Sparks {
  constructor(parent) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), SPARKS);
    this.mesh.name = 'Encore sparks'; this.mesh.frustumCulled = false; this.mesh.userData.noCollide = true; this.mesh.renderOrder = 6;
    this.list = Array.from({ length: SPARKS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), t: 0, life: 0 }));
    this.next = 0; this.live = 0;
    this.hot = new THREE.Color(LOOK.color('encore-spark-hot', '#fff6c8')); this.cool = new THREE.Color(LOOK.color('encore-spark-cool', '#ff7a14'));
    for (let i = 0; i < SPARKS; i++) { this.mesh.setMatrixAt(i, _sm.makeScale(0, 0, 0)); this.mesh.setColorAt(i, _sc.set(0)); }
    parent.add(this.mesh);
  }
  // n sparks from p, out toward the room (+z) and up, `speed` m/s or so
  emit(p, n, speed) {
    for (let k = 0; k < n; k++) {
      const s = this.list[this.next]; this.next = (this.next + 1) % SPARKS;
      const a = Math.random() * Math.PI * 2, up = 0.3 + Math.random() * 0.9, v = speed * (0.35 + Math.random() * 0.65);
      s.p.copy(p); s.v.set(Math.cos(a) * 0.8, up, 0.6 + Math.abs(Math.sin(a))).normalize().multiplyScalar(v);
      s.t = 0; s.life = 0.35 + Math.random() * 0.55;
    }
    this.live = SPARKS;
  }
  update(dt) {
    if (!this.live) return;
    let any = 0;
    this.list.forEach((s, i) => {
      if (s.t >= s.life) { if (s.life) { this.mesh.setMatrixAt(i, _sm.makeScale(0, 0, 0)); s.life = 0; } return; }
      any++;
      s.t += dt; s.v.y -= 2.4 * dt; s.p.addScaledVector(s.v, dt);
      if (s.p.y < 0.003 && s.v.y < 0) { s.p.y = 0.003; s.v.y *= -0.35; s.v.x *= 0.6; s.v.z *= 0.6; }   // skips off the floor
      const k = s.t / s.life, len = Math.max(0.006, s.v.length() * 0.045);
      this.mesh.setMatrixAt(i, _sm.compose(s.p, _sq.setFromUnitVectors(_sup, _sv.copy(s.v).normalize()), _ss.set(0.0026, len, 0.0026)));
      this.mesh.setColorAt(i, _sc.copy(this.hot).lerp(this.cool, k).multiplyScalar(3 * (1 - k * k)));
    });
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
    if (!any) this.live = 0;
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.dispose(); }
}

// the booth's box in the arena (its collider's, where it stands)
function boothBox(booth) {
  const g = booth.collisionGeometry;
  if (!g.boundingBox) g.computeBoundingBox();
  return g.boundingBox.clone().translate(booth.root.position);
}

function forceField(booth) {
  const mat = new VolumeMaterial(LOOK.color('encore-shield', '#3fd0ff'), 'dome');
  mat.progress = 1;
  mat.uniforms.uHex.value = LOOK.num('encore-shield-hex', 28);
  mat.uniforms.uGlow.value = LOOK.num('encore-shield-glow', 2.4);
  const box = boothBox(booth);
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()), room = LOOK.num('encore-shield-room', 1.3);
  const m = new THREE.Mesh(volumeGeometry('dome'), mat);
  m.position.set(c.x, box.min.y, c.z);
  m.scale.set(size.x / 2 * room, size.y * room, size.z / 2 * room);
  m.name = 'Encore force field'; m.userData.noCollide = true; m.visible = false; m.renderOrder = 5;
  return m;
}
