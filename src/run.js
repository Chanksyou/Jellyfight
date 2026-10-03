// One run of stage 1: grow until the timer runs out (grabbing golden gifts and beating elites for
// treasures), then beat the stage's boss and evolve.
import * as THREE from 'three';
import { BASE_STATS, rollCards, rollTreasures, TREASURE_RARITY, applyCard, xpToNext, TREASURES, EVOLUTIONS, ELEMENT_TREASURES, MAX_BUBBLES, MAX_DODGE, STAT_INFO } from './stats.js';
import { inPoly } from './hud.js';
import { STAGES, goToAct } from './stages.js';
import { Boss } from './boss.js';
import { Vacuum } from './vacuum.js';
import { TYPES } from './enemies.js';
import { CONTENT, compileMods } from './content.js';
import { Gadgets } from './gadgets.js';
import { Elites, ELITE_NAMES } from './elites.js';
import { Bubbles } from './bubbles.js';
import { GoldGift } from './pickups.js';
import { juice } from './juice.js';
import { sfx, calm } from './sfx.js';
import { bus, PLAYER } from './events.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

// The treasures you own; counts changes so the combined effects are rebuilt only when needed
// The treasures you own: a set of ids that also counts copies of stackable ones (stack=N)
class Owned extends Set {
  add(v) { super.add(v); (this.n ||= new Map()).set(v, this.count(v) + 1); this.version = (this.version || 0) + 1; return this; }
  delete(v) { const r = super.delete(v); this.n?.delete(v); this.version = (this.version || 0) + 1; return r; }
  clear() { super.clear(); this.n?.clear(); this.version = (this.version || 0) + 1; }
  count(v) { return this.n?.get(v) || 0; }
}

export class Run {
  // ctx: { scene, stage, plan, world, player, cfg, enemies, lash, dew, traversal, hud, ui, fx, tpc, input, setNight }
  constructor(ctx) {
    Object.assign(this, ctx);
    this.gadgets = new Gadgets(ctx.scene, ctx.enemies, ctx.fx, ctx.world);
    this.bubbles = new Bubbles(ctx.scene, ctx.enemies, ctx.fx, ctx.world);
    this.bubbles.grace = this.cfg.radius;
    this.gift = new GoldGift(ctx.scene, ctx.fx);   // golden gifts on a schedule (stage.gifts)
    this.bubbles.onBlow = () => { this.player.avatar?.pulse?.(0.6); sfx.blow(); };   // the bell squeezes as it blows
    this.elites = new Elites(ctx.scene, ctx.enemies, ctx.fx, ctx.world, ctx.tpc.camera, ctx.apartment);
    this.elites.decorSpecs = this.stage.decor || [];   // what only hangs there in this act (the hall clock)
    // low invisible walls around the boss arena, solid only during the fight
    this.bossWalls = (ctx.stage.boss.walls || []).map((w) => {
      const size = w.max.map((v, i) => v - w.min[i]);
      const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
      m.position.set(...w.min.map((v, i) => v + size[i] / 2));
      m.visible = false;
      m.updateMatrixWorld();
      ctx.world.addCollider(m);
      return m;
    });
    this.rooms = ctx.plan;
    this.fade = document.createElement('div');
    this.fade.style.cssText = 'position:fixed;inset:0;background:radial-gradient(#fffbe8,#cfe2ff);opacity:0;pointer-events:none;z-index:20;transition:opacity .5s';
    document.body.appendChild(this.fade);

    // The run owns the jelly's moisture, slow and knockback, and what kills are worth
    bus.on('damage_taken', ({ targetId, amount, drain }) => {
      if (targetId !== PLAYER) return;
      if (drain) this.hurt(amount, true);   // puddles and suction: no i-frames, no flinch
      else this.hit(amount);                // i-frames, Thimble, Soap Bubble, Rubber Duck
    });
    bus.on('status_applied', ({ targetId, status, duration }) => {
      if (targetId === PLAYER && status === 'slow') this.slowT = Math.max(this.slowT, duration);
      if (targetId === PLAYER && status === 'slip') this.slipT = Math.max(this.slipT, duration);   // soap underfoot: you slide
    });
    bus.on('knockback', ({ targetId, dir, force, launch }) => {
      if (targetId !== PLAYER) return;
      const v = this.player.velocity;
      v.addScaledVector(dir, force);
      if (launch) { v.y = Math.max(v.y, launch); this.player.grounded = false; }
    });
    bus.on('enemy_killed', (k) => { if (!k.silent) this.onKill(k); });
    // heal-on-hit (treasures): a chance that your bubble or tentacle hits give back moisture
    bus.on('damage_taken', (d) => {
      const H = this.mods.healOnHit;
      if (H && d.targetId !== PLAYER && (d.source === 'bubble' || d.source === 'tentacle') && Math.random() < H.chance) this.heal(H.moisture);
    });
    bus.on('elite_defeated', ({ elite }) => this.eliteDefeated(elite));
    this.player.onLand = (drop) => {
      const M = this.mods;
      const L = M.landingShockwave;
      if (L && drop > L.drop) this.shockwave(this.player.position.clone(), L.radius, this.power * L.dmg, 0xffffff);
    };
    // a little wake of bubbles behind each stroke of the bell
    this.player.onStroke = () => {
      const P = this.player.position, f = this.player.facing;
      this.fx.puff(new THREE.Vector3(P.x - Math.sin(f) * this.cfg.radius * 1.4, P.y + this.cfg.height * 0.45, P.z - Math.cos(f) * this.cfg.radius * 1.4), 0xdff4ff, 0.008, 0.3);
    };
    this.carry = ctx.carry || null;   // a later act: what the run brought from the act before (stages.js)
    this.start();
  }

  // ------------------------------------------------------------ setup
  start() {
    const s = this.stage;
    this.duel = null;                 // dev: one on one with a single enemy (startDuel)
    calm();                           // a balloon's deep sound doesn't outlast the run
    this.enemies.clear();
    this.elites?.start(this.stage.elites);
    this.gift?.hide();
    this.giftsLeft = [...(this.stage.gifts?.at || [])];   // seconds into the night each golden gift appears
    this.lastGift = null;
    this.recentGifts = [];   // the last few gift spots, so each one turns up somewhere new
    this.dew.clear();
    this.fx.clear();
    this.lash.reset();
    juice.reset();
    this.bubbles.reset();
    this.gadgets.reset();
    this.boss?.dispose();
    this.boss = null;
    this.traversal.bossMode = false;
    this.bossWalls.forEach((m) => { m.visible = false; });
    this.hud.setBoss(null);
    this.ui.close();
    this.fade.style.opacity = 0;

    this.phase = 'explore';
    this.t = 0;
    this.startPicked = false;         // the starting treasure is offered on the run's first frame
    this.stats = { ...BASE_STATS };
    this.level = 1;
    this.xp = 0;
    this.purse = 0;
    this.moisture = this.stats.moisture;
    this.owned = new Owned();
    this.kills = 0;
    this.eliteBugs = 0;               // golden elite bugs cleared (score)
    this.elitesBeaten = 0;            // high-ground elites beaten (score)
    this.bossStartT = null;
    this.bossWon = false;
    this.pendingLevels = 0;
    this.iFrames = 0;
    this.slowT = 0;
    this.slipT = 0;
    this.stillT = 0;
    this.squeakCd = [];
    this.grown = {}; this.growCount = {};
    // a later act: the run carries on from the act before (main.js gives it: stages.js)
    const C = this.carry;
    if (C) {
      this.stats = { ...BASE_STATS, ...C.stats };
      this.level = C.level; this.xp = C.xp; this.purse = C.purse;
      for (const [id, n] of C.owned) for (let k = 0; k < n; k++) this.owned.add(id);
      this.grown = { ...C.grown }; this.growCount = { ...C.growCount };
      this.moisture = this.stats.moisture;
      this.startPicked = true;        // you already have your treasures
    }
    this.spawnAcc = 0;
    this.bursts = [];
    this.nightT = 0;

    const start = new THREE.Vector3(...s.start);
    this.world.focus(start, 1);
    this.player.spawn(start);
    this.player.snapToGround();
    this.tpc.snapTo(this.player.position);

    // Only open, easy-to-reach gift spots (the apartment is static, so check once)
    if (!this.spots) {
      this.spots = [];
      this.spotRejects = [];
      for (const sp of s.spots) {
        const r = this.openSpot(sp.at);
        if (!r.ok) { this.spotRejects.push(`${sp.label}: ${r.why}`); continue; }
        const moved = this.offLanding(sp, r.y);
        if (moved) this.spots.push(moved);
        else this.spotRejects.push(`${sp.label}: on a vent landing`);
      }
      if (!this.spots.length) this.spots = s.spots.map((sp) => ({ ...sp, y: sp.at[1] }));
    }
    this.setNight(s.clock[0]);
    this.refreshHud();
  }

  get paused() { return this.ui.open; }
  // how hard treasures that attack on their own hit: scales with pop damage
  // Your stats as they stand: the starting values plus level-up cards (this.stats) plus what
  // your treasures add (stat words). One object, refilled on each read: no garbage per frame.
  get S() {
    const S = (this._S ||= {}), add = this.mods.stats.add, pct = this.mods.stats.pct;
    const grown = this.grown || {};
    for (const k in this.stats) S[k] = this.stats[k] + (add[k] || 0) + (grown[k] || 0) + BASE_STATS[k] * (pct[k] || 0) / 100;
    S.bubbles = Math.max(1, Math.min(MAX_BUBBLES, Math.round(S.bubbles)));
    S.dodge = Math.min(MAX_DODGE, Math.max(0, S.dodge));
    return S;
  }

  get power() { return this.S.pop * 1.8; }   // gadgets and treasures: pop 6 -> 10.8, as before the slower, harder stream
  // The tentacles' stats, with their treasures applied
  // The combined effects of your treasures (content/treasures.kdl, src/words.js): every system
  // reads these, never treasure ids
  get mods() {
    if (this._modsOf !== this.owned || this._modsV !== this.owned.version) {
      this._mods = compileMods(this.owned);
      this._modsOf = this.owned;
      this._modsV = this.owned.version;
    }
    return this._mods;
  }

  get tentacleStats() {
    const s = this.stats;
    return {
      tentacles: Math.min(6, s.tentacles),
      reach: s.reach,
      sting: s.sting,
      lashSpeed: s.lashSpeed,
    };
  }
  // seconds until the boss comes (treasures can make the night longer)
  get duration() { return this.stage.duration; }

  // ------------------------------------------------------------ main update
  update(dt) {
    if (this.phase === 'dead' || this.phase === 'won' || this.phase === 'metamorph') { this.touchAction = null; return; }
    // every run starts with a treasure: pick 1 of 3 before anything happens
    if (!this.startPicked && this.phase === 'explore') {
      this.startPicked = true;
      this.pickTreasure('🎁 Pick a starting treasure', 'Two elements for your bubbles, or something else. Keep one to shape this run.', true);
      return;
    }
    this.t += dt;
    const P = this.player, s = this.S;

    // --- movement, with vents, fabric, lint, and the drain's pull
    const tr = this.traversal.query(P.position);
    let push = null;
    if (this.phase === 'boss' && this.boss) {
      push = this.boss.update(dt, P).push;
      if (this.boss.dead && !this.bossDeadT) this.onBossDead();
    }
    if (this.phase !== 'intro') {
      this.world.focus(P.position, dt);
      P.update(dt, this.input, this.tpc.yaw, {
        speedMul: s.pulse, jumpMul: s.bounce, vent: this.phase === 'explore' ? tr.vent : null, climb: !!tr.climb,
        airJumps: this.mods.extraJumps,       // no mid-air jump until Pen Spring
        slow: this.slowT > 0 ? 0.4 : 0, push,
        slip: this.slipT > 0 ? 1 : 0,
      });
    }

    // --- timers
    this.iFrames = Math.max(0, this.iFrames - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.slipT = Math.max(0, this.slipT - dt);
    // --- the night: waves, gifts, and the boss when time runs out
    if (this.phase === 'explore' && this.duel) this.updateDuel(dt);
    else if (this.phase === 'explore') {
      this.spawnWaves(dt);
      this.updateGifts(dt);
      if (this.t >= this.duration && this.phase === 'explore') this.startBossIntro();
    }
    this.nightT -= dt;
    if (this.nightT <= 0) {
      this.nightT = 10;
      const [c0, c1] = this.stage.clock;
      this.setNight(c0 + (c1 - c0) * Math.min(1, this.t / this.duration));
    }

    // --- attacks and enemies
    const origin = P.position.clone().setY(P.position.y + this.cfg.height * 0.45);
    if (this.phase === 'explore' || this.phase === 'boss') {
      // main attack: bubbles, blown from the top of the bell
      this.bubbles.update(dt, P.position.clone().setY(P.position.y + this.cfg.height * 0.75), s, this.mods);
      // close-range sting: tentacles, improved only by treasures
      this.lash.update(dt, origin, this.tentacleStats, this.mods.hits.tentacles, {});
      this.gadgets.update(dt, { mods: this.mods, feet: P.position, center: origin, facing: P.facing, sting: this.power, dropDew: (n) => this.dew.drop(P.position.clone().setY(P.position.y + 0.01), 1, n) });
      if (this.phase === 'explore') {
        this.elites.update(dt, P, this.cfg);
      }
      this.enemies.pace = this.mods.bugSpeed;
      this.enemies.update(dt, { position: P.position, height: this.cfg.height, radius: this.cfg.radius }, this.t);
      this.contactDamage();
      this.enemies.shotHits(P.position.clone().setY(P.position.y + this.cfg.height * 0.5), this.cfg.radius);
    }
    for (const b of this.bursts.splice(0)) this.burst(b);

    // --- treasure effects that tick here (timed and area ones run in gadgets.js)
    if (s.regen > 0 && this.phase !== 'intro') this.heal(s.regen * dt);   // moisture regen (cards, treasures)
    const spout = this.mods.spout;
    if (spout) {
      this.stillT = P.speed < 0.02 && P.grounded ? this.stillT + dt : 0;
      if (this.stillT > spout.after) this.heal(spout.heal * dt);
    }

    // --- dew
    const got = this.dew.update(dt, origin, this.mods.dewReach);
    if (got) { this.gainDew(got); sfx.dew(juice.combo); }
    juice.update(dt);
    this.hud.setCombo(juice.combo, juice.comboT / 2.5, juice.bonus);

    // --- hints
    this.input.consumeInteract();
    this.touchAction = null;
    const jumpKey = this.touch ? '⤴' : '<kbd>Space</kbd>';
    if (tr.vent) this.lastVent = tr.vent.to;
    if (tr.climb && !P.climbing && this.phase === 'explore') this.hud.hint(`Hold ${jumpKey} to climb the ${tr.climb.name.toLowerCase()}`);
    else if (P.flight) this.hud.hint(`Whoosh! Up to ${this.lastVent}`);
    else this.hud.hint(null);

    if (this.phase === 'intro') this.updateBossIntro(dt);
    if (this.pendingLevels > 0 && !this.ui.open && this.phase !== 'intro') this.levelUp();
    this.refreshHud();
  }

  // ------------------------------------------------------------ dev: one on one
  // A fresh run with nothing in it but one enemy, to see how it moves and attacks: a bug that
  // turns up in front of you (another 1.5 s after you clear it), or one of this act's elites with
  // you on its high ground (it comes back after you beat it). No waves, no gifts, no boss.
  duelChoices() {
    const bugs = Object.values(TYPES).map((T) => ({ name: T.name, bug: T.id }));
    // every act's elites: one from another act reloads the game into that act first (startDuel)
    const elites = STAGES.flatMap((st) => (st.elites || []).map((spec) => ({ name: `${ELITE_NAMES[spec.kind]} (elite, act ${st.id})`, elite: spec, act: st.id })));
    return [...bugs, ...elites];
  }

  startDuel(pick) {
    if (pick.act && pick.act !== this.stage.id) { goToAct(pick.act, null, { duel: pick.name }); return; }   // its room is in another act
    this.start();
    this.startPicked = true;
    this.duel = { ...pick, wait: 0 };
    this.elites.start(pick.elite ? [pick.elite] : []);
    if (pick.elite) {
      // up on its high ground: where the vent that goes there lands you (or its own standing spot, for one on the floor)
      const at = pick.elite.at, v = [...this.traversal.vents].sort((a, b) => Math.hypot(a.land[0] - at[0], a.land[2] - at[2]) - Math.hypot(b.land[0] - at[0], b.land[2] - at[2]))[0];
      const p = new THREE.Vector3(...(pick.elite.stand || (v ? v.land : at)));
      this.world.focus(p, 1);
      this.player.spawn(p);
      this.player.snapToGround();
      this.tpc.snapTo(this.player.position);
    } else this.duelSpawn();
    this.hud.toast(`🐞 1 on 1: ${pick.name}`, 2000);
  }

  // the duel's bug, a little way off where it can reach you (straight ahead if nowhere else)
  duelSpawn() {
    const type = this.duel.bug, P = this.player.position, f = this.player.facing;
    const at = this.spawnPoint(type) || P.clone().add(new THREE.Vector3(Math.sin(f) * 0.4, TYPES[type].fly ? 0.08 : 0.02, Math.cos(f) * 0.4));
    this.enemies.spawn(type, at, this.stage.toughness || 1);
  }

  updateDuel(dt) {
    const D = this.duel;
    const left = D.bug ? this.enemies.list.some((e) => !e.dead && !e.proxy) : this.elites.alive.length > 0;
    if (left) { D.wait = 0; return; }
    if ((D.wait += dt) < (D.bug ? 1.5 : 4)) return;
    D.wait = 0;
    if (D.bug) this.duelSpawn();
    else this.elites.start([D.elite]);
  }

  // ------------------------------------------------------------ waves
  // How the night fills with bugs: content/waves.kdl
  spawnWaves(dt) {
    const W = CONTENT.waves, bugs = W.bugs.filter((b) => b.act === this.stage.id);   // this act's bugs
    if (!bugs.length) return;
    const more = this.mods.moreBugs;   // more-bugs (treasures)
    const rate = (W.rate + this.t * W.grow) * more;
    const cap = Math.min(W.capMax, W.cap + this.t / W.capEvery) * more;
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.enemies.alive >= cap) continue;
      const w = bugs.map((b) => [b.id, this.t >= b.from ? b.weight : 0]);
      let r = Math.random() * w.reduce((a, [, x]) => a + x, 0), type = bugs[0].id;
      for (const [k, x] of w) if ((r -= x) <= 0) { type = k; break; }
      const pos = this.spawnPoint(type) || (type !== bugs[0].id ? this.spawnPoint((type = bugs[0].id)) : null);
      if (pos) this.enemies.spawn(type, pos, (this.stage.toughness || 1) * (1 + this.t / 60 * W.toughen));
    }
  }

  inStage(x, z) { return this.rooms.some(([, poly]) => inPoly(x, z, poly)); }

  spawnPoint(type) {
    const P = this.player.position;
    const pc = P.clone().setY(P.y + this.cfg.height * 0.5);
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, d = 0.35 + Math.random() * 0.5;
      const x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
      if (!this.inStage(x, z)) continue;
      const dir = new THREE.Vector3(x - P.x, 0, z - P.z).normalize();
      if (this.world.cast(pc, dir, d)) continue;               // behind a wall or furniture
      if (TYPES[type].fly) return new THREE.Vector3(x, pc.y + 0.05 + Math.random() * 0.06, z);
      const hit = this.world.cast(new THREE.Vector3(x, P.y + 0.12, z), DOWN, 0.3);
      if (hit && Math.abs(hit.point.y - P.y) < 0.1) return hit.point.clone();
    }
    return null;
  }

  // ------------------------------------------------------------ damage
  contactDamage() {
    const P = this.player.position;
    const pc = P.clone().setY(P.y + this.cfg.height * 0.5);
    for (const e of this.enemies.list) {
      if (e.dead || e.proxy || e.freezeT > 0) continue;     // frozen things can't hurt you
      if (e.airborne) continue;                             // mid-leap: its landing does the hurting (the leap word)
      const d = this.enemies.center(e).distanceTo(pc);
      if (d < (e.hitR || e.r) + this.cfg.radius) {
        if (e.T.slows) bus.emit('status_applied', { targetId: PLAYER, status: 'slow', duration: 1.5 });
        // ant squads hit harder rolling
        bus.emit('damage_taken', { targetId: PLAYER, amount: e.state === 'dash' && e.T.rollDmg ? e.T.rollDmg : e.T.dmg, source: e.type });
      }
    }
  }

  hit(amount) {
    if (this.iFrames > 0 || this.phase === 'dead') return;
    this.iFrames = 1.0;
    const M = this.mods;
    amount *= M.damageTaken;
    // dodge: the hit misses (and a moment of grace, so touching a bug doesn't re-roll every frame)
    if (Math.random() * 100 < this.S.dodge) {
      this.iFrames = 0.4;
      const P = this.player.position;
      this.fx.number(P.clone().setY(P.y + this.cfg.height), 'DODGE', '#bfffd0', 15);
      return;
    }
    // squeak-when-hit effects (they stack), each on its own cooldown
    M.squeaks.forEach((Q, i) => {
      if ((this.squeakCd[i] || 0) > this.t) return;
      this.squeakCd[i] = this.t + Q.cooldown;
      const P = this.player.position;
      this.fx.puff(P.clone().setY(P.y + 0.015), 0xffe066, Q.radius, 0.35);
      this.fx.number(P.clone().setY(P.y + 0.05), 'SQUEAK', '#ffe066', 16);
      for (const e of this.enemies.list) {
        if (e.dead || e.proxy) continue;
        const away = e.pos.clone().sub(P).setY(0);
        const d = away.length();
        if (d > Q.radius) continue;
        if (Q.push) bus.emit('knockback', { targetId: e.id, dir: away.normalize(), force: Q.push });
        bus.emit('damage_taken', { targetId: e.id, amount: Q.dmg, color: '#ffe066', source: 'squeak' });
      }
    });
    this.hurt(amount);
  }

  hurt(amount, silent = false) {
    this.moisture -= amount;
    if (!silent) { juice.shake(0.55); sfx.hurt(); }
    if (!silent) this.player.avatar?.land(1.5);
    if (this.moisture <= 0) this.die();
  }

  heal(amount) { this.moisture = Math.min(this.S.moisture, this.moisture + amount); }

  // an enemy_killed event: { pos, r, dew, elite }
  onKill({ pos: c, r, dew: baseDew, elite }) {
    this.kills++;
    const combo = juice.kill();
    if (combo % 10 === 0) { sfx.combo(combo); this.fx.number(c.clone().setY(c.y + r * 3), `${combo} COMBO!`, '#ffd23a', 22); }
    const dew = Math.round(baseDew * this.mods.dewMult * juice.bonus);
    this.dew.drop(c, 1, dew);
    this.fx.number(c.clone().setY(c.y + r * 1.5), `+${dew}💧`, '#9fe2ff', elite ? 20 : 14);
    if (this.mods.healOnKill) this.heal(this.mods.healOnKill);
    // grow-on-kills: every N kills a stat grows for good
    for (const g of this.mods.growth) {
      const n = (this.growCount[g.key] || 0) + 1;
      this.growCount[g.key] = n % g.kills;
      if (n < g.kills) continue;
      this.grown[g.stat] = (this.grown[g.stat] || 0) + g.amount;
      if (g.stat === 'moisture') this.heal(g.amount);
      const P = this.player.position;
      this.fx.number(P.clone().setY(P.y + this.cfg.height * 1.2), `+${g.amount} ${STAT_INFO[g.stat]?.icon || ''}`, '#c6ffb0', 15);
    }
    if (elite) {                         // elites give back some moisture and drop a treasure
      this.eliteBugs++;
      this.heal(4);
      this.fx.puff(c, 0xffd23a, r * 3, 0.5);
      if (this.phase === 'explore') this.pickTreasure('✨ Elite cleared!', 'It dropped three lost things. Keep one. (+4 moisture)');
    }
    if (this.mods.burstOnKill) this.bursts.push(c);
  }

  // One of the high-ground elites (elites.js) is beaten
  eliteDefeated(e) {
    this.kills++;
    this.elitesBeaten++;
    juice.shake(0.7); juice.hitstop(0.15); sfx.boom();
    this.heal(4);
    this.dew.drop(e.base.clone().setY(e.base.y + e.r), 1, 20);
    this.fx.number(e.base.clone().setY(e.base.y + e.r * 2.5), '+20💧', '#9fe2ff', 20);
    this.pickTreasure(`✨ ${e.name} is beaten!`, `It was guarding the ${e.spec.area}. It dropped three lost things: keep one. (+4 moisture)`);
  }

  // A ring of stinging (Bath Bomb, Cotton Ball)
  shockwave(c, radius, dmg, color) {
    this.fx.puff(c.clone().setY(c.y + 0.01), color, radius, 0.35);
    for (const e of this.enemies.list) {
      if (e.dead || e.proxy) continue;
      if (this.enemies.center(e).distanceTo(c) < radius + e.r) bus.emit('damage_taken', { targetId: e.id, amount: dmg, color: '#ffd0ec', source: 'shockwave' });
    }
  }

  burst(c) {
    const B = this.mods.burstOnKill;
    if (!B) return;
    this.fx.puff(c, 0xffffff, B.radius, 0.3);
    for (const e of this.enemies.list) {
      if (e.dead || e.proxy) continue;
      if (this.enemies.center(e).distanceTo(c) < B.radius + e.r) bus.emit('damage_taken', { targetId: e.id, amount: this.power * B.dmg, color: '#bfe8ff', source: 'burst' });
    }
  }

  // ------------------------------------------------------------ growth
  gainDew(n) {
    this.purse += n;
    this.xp += n;
    while (this.xp >= xpToNext(this.level)) {
      this.xp -= xpToNext(this.level);
      this.level++;
      this.pendingLevels++;
    }
  }

  levelUp() {
    this.pendingLevels--;
    sfx.levelUp();
    if (document.pointerLockElement) document.exitPointerLock();
    this.ui.levelUp(this.level - this.pendingLevels, rollCards(this.stats, 3 + this.mods.cardChoices, this.mods.cardRarity, this.S.luck), this.S, 1, (card) => {
      const before = this.stats.moisture;
      applyCard(this.stats, card);
      if (this.stats.moisture > before) this.heal(this.stats.moisture - before);
      this.resume();
    }, () => rollCards(this.stats, 3 + this.mods.cardChoices, this.mods.cardRarity, this.S.luck));
  }

  resume() {
    if (!this.ui.open) this.onResume?.();
  }

  // Pick 1 of 3 treasures you can still take (unique ones you don't have, stackable ones below
  // their stack=N) from a golden gift or an elite
  // start: the starting pick, two elements for your bubbles and one of anything else
  pickTreasure(title = '🎁 A treasure', sub = 'Three lost things. Keep one.', start = false) {
    const can = (t) => this.owned.count(t.id) < t.stack;
    const elem = (t) => ELEMENT_TREASURES.includes(t.id);
    let left = start
      ? shuffle([...rollTreasures(TREASURES.filter((t) => elem(t) && can(t)), 2, this.S.luck), ...rollTreasures(TREASURES.filter((t) => !elem(t) && can(t)), 1, this.S.luck)])
      : rollTreasures(TREASURES.filter(can), 3, this.S.luck);
    if (!left.length) return;
    if (document.pointerLockElement) document.exitPointerLock();
    sfx.treasure();
    // stackable ones say how many you'd have
    left = left.map((t) => ({ ...t, tier: TREASURE_RARITY.find((r) => r.id === t.rarity), name: t.stack > 1 ? `${t.name} <small>${this.owned.count(t.id) + 1}/${t.stack}</small>` : t.name }));
    this.ui.choose(title, sub, left, (t) => {
      const before = this.S.moisture;
      this.owned.add(t.id);
      if (this.S.moisture > before) this.heal(this.S.moisture - before);
      this.ui.treasure(t);
      this.resume();
    });
  }

  // ------------------------------------------------------------ golden gifts
  // At each time in stage.gifts.at a golden gift turns up somewhere else in the room and waits
  // stage.gifts.stay seconds; touch it in time for a treasure pick
  updateGifts(dt) {
    const G = this.stage.gifts;
    if (!G) return;
    const r = this.gift.update(dt, this.t, this.player.position);
    if (r === 'taken') this.pickTreasure('🎁 A golden gift!', 'You got there in time. Keep one.');
    else if (r === 'gone') this.hud.toast('🎁 The golden gift faded away…', 1800);
    if (!this.gift.active && this.giftsLeft.length && this.t >= this.giftsLeft[0]) {
      this.giftsLeft.shift();
      const spot = this.giftSpot();
      if (!spot) return;
      this.gift.show(spot, G.stay);
      this.lastGift = spot;
      this.recentGifts = [spot.label, ...this.recentGifts].slice(0, 3);
      this.hud.toast(`🎁 A golden gift appeared: ${spot.label}. ${G.stay} seconds to grab it!`, 2800);
    }
  }

  // somewhere else: away from you, in another part of the room from the last one, not one of the
  // last three spots (from the stage's open spots: flat, nothing overhead)
  giftSpot() {
    const P = this.player.position, last = this.lastGift;
    const ok = (sp, far, elsewhere) => Math.hypot(sp.at[0] - P.x, sp.at[2] - P.z) > far
      && (!elsewhere || !last || (sp.area !== last.area && Math.hypot(sp.at[0] - last.at[0], sp.at[2] - last.at[2]) > 0.8 && !this.recentGifts.includes(sp.label)));
    for (const [far, elsewhere] of [[0.8, true], [0.5, true], [0.5, false], [0, false]]) {
      const c = (this.spots || []).filter((sp) => ok(sp, far, elsewhere));
      if (c.length) return c[Math.floor(Math.random() * c.length)];
    }
    return null;
  }

  // ------------------------------------------------------------ gift spots
  // A gift on a vent's landing point would be grabbed just by taking the vent, so a spot that
  // close to one moves over (15-35 cm, staying on the same surface and open), or is dropped
  offLanding(sp, y) {
    const lands = this.traversal.vents.map((v) => v.land);
    const near = (x, z, yy) => lands.some((L) => Math.hypot(L[0] - x, L[2] - z) < 0.13 && Math.abs(L[1] - yy) < 0.08);
    if (!near(sp.at[0], sp.at[2], y)) return { ...sp, y };
    for (const d of [0.15, 0.2, 0.25, 0.3, 0.35]) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, x = sp.at[0] + Math.cos(a) * d, z = sp.at[2] + Math.sin(a) * d;
        const r = this.openSpot([x, y, z]);
        if (r.ok && Math.abs(r.y - y) < 0.02 && !near(x, z, r.y)) return { ...sp, at: [x, r.y, z], y: r.y };
      }
    }
    return null;
  }

  // A gift spot must be easy to see and reach: open sky above it (the camera looks down),
  // nothing crowding it, and flat ground. Returns the surface height, or null with a reason.
  openSpot([x, y, z]) {
    const W = this.world, V = (a, b, c) => new THREE.Vector3(a, b, c);
    const hit = W.castAll(V(x, y + 0.15, z), DOWN, 0.4);
    if (!hit) return { ok: false, why: 'no surface' };
    const sy = hit.point.y;
    if (W.castAll(V(x, sy + 0.01, z), V(0, 1, 0), 0.3)) return { ok: false, why: 'covered overhead' };
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      if (W.castAll(V(x, sy + 0.015, z), V(Math.cos(a), 0, Math.sin(a)), 0.06)) return { ok: false, why: 'crowded' };
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const h = W.castAll(V(x + Math.cos(a) * 0.03, sy + 0.05, z + Math.sin(a) * 0.03), DOWN, 0.1);
      if (!h || Math.abs(h.point.y - sy) > 0.012) return { ok: false, why: 'uneven or on an edge' };
    }
    return { ok: true, y: sy };
  }

  // ------------------------------------------------------------ boss
  startBossIntro() {
    this.phase = 'intro';
    this.liftT = 0;
    this.hud.toast(`⏰ Time's up! ${this.stage.boss.name} is coming…`, 2400);
    for (const e of this.enemies.list) if (!e.dead) this.enemies.kill(e, true);
    this.dew.magnetAll = true;
  }

  updateBossIntro(dt) {
    this.liftT += dt;
    const P = this.player;
    this.dew.magnetAll = true;
    if (this.liftT < 1.4) {
      P.position.y += dt * 0.1;
      P.syncMesh();
      P.avatar?.update(dt, { speed: 0, walkSpeed: 1, grounded: false, vy: 0.3 });
      this.fade.style.opacity = Math.min(1, this.liftT / 1.2);
    } else if (!this.bossStarted) {
      this.bossStarted = true;
      const B = this.stage.boss;
      this.enemies.clear();
      this.traversal.bossMode = true;
      this.elites.clear();
      this.gift.hide();
      this.bossWalls.forEach((m) => { m.visible = true; });
      const p = new THREE.Vector3(...B.playerStart);
      this.world.focus(p, 1);
      P.spawn(p);
      P.snapToGround();
      P.facing = -Math.PI / 2;
      this.tpc.snapTo(P.position);
      this.tpc.yaw = -Math.PI / 2 + Math.PI;
      this.boss = B.kind === 'vacuum' ? new Vacuum(this.scene, this.enemies, this.fx, B, this.world) : new Boss(this.scene, this.enemies, this.fx, B);
      this.enemies.addProxy(this.boss);
      setTimeout(() => { this.fade.style.opacity = 0; }, 150);
      this.phase = 'boss';
      this.bossStartT = this.t;
      this.bossStarted = false;
      this.hud.toast(B.intro || `${B.name} rises!`, 2400);
    }
  }

  onBossDead() {
    this.bossDeadT = true;
    this.bossWon = true;
    this.bossTime = this.t - (this.bossStartT ?? this.t);
    juice.shake(1); juice.hitstop(0.25); sfx.boom();
    const c = this.boss.center();
    this.fx.puff(c, 0x5a4030, 0.12, 0.8);
    this.dew.drop(c, 1, 30);
    for (const e of this.enemies.list) if (!e.dead && !e.proxy) this.enemies.kill(e, true);
    this.hud.toast(`${this.stage.boss.name} is cleared!`, 2200);
    setTimeout(() => this.metamorph(), 2200);
  }

  metamorph() {
    this.phase = 'metamorph';
    this.bossDeadT = false;
    this.hud.setBoss(null);
    if (document.pointerLockElement) document.exitPointerLock();
    const choices = shuffle([...EVOLUTIONS]).slice(0, 3);
    this.ui.choose('Metamorphosis!', `${this.stage.evolve || 'Your polyp becomes an <b>Ephyra</b>, a baby jellyfish.'} Choose how it grows.`, choices, (evo) => {
      evo.apply(this.stats);
      this.moisture = this.stats.moisture;
      this.phase = 'won';
      const next = STAGES[this.stage.id];         // the act after this one, if there is one
      if (next) this.actComplete(next);
      else this.endRun(`Act ${this.stage.id} complete`, 'The hallway and the bathroom are yours. The bedroom (act 3) is coming soon.', 'Play again from act 1');
    });
  }

  die() {
    if (this.phase === 'dead') return;
    this.phase = 'dead';
    this.moisture = 0;
    if (document.pointerLockElement) document.exitPointerLock();
    this.hud.setBoss(null);
    setTimeout(() => this.endRun('You dried out', 'But an immortal jelly never really dies. It shrinks back into a polyp… and tries again.', 'Try again'), 700);
  }

  // ------------------------------------------------------------ score
  // One number for the whole run (the leaderboard ranks by it), from its parts
  scoreParts() {
    const treasures = [...this.owned].reduce((n, id) => n + this.owned.count(id), 0);
    const B = this.boss, bossDamage = B ? 1 - Math.max(0, B.hp) / B.maxHp : 0;
    const parts = [
      ...(this.carry ? [['Earlier acts', this.carry.score]] : []),
      ['Bugs cleared', this.kills * 10],
      ['Elite bugs', this.eliteBugs * 50],
      ['Elites beaten', this.elitesBeaten * 300],
      ['Levels', (this.level - 1) * 100],
      ['Treasures', treasures * 150],
      ['Survival', Math.round(Math.min(this.t, this.duration) * 2)],
      [`${this.stage.boss.name} damage`, Math.round(bossDamage * 1500)],
    ];
    if (this.bossWon) parts.push([`${this.stage.boss.name} beaten`, 3000 + Math.round(Math.max(0, 180 - (this.bossTime || 180)) * 20)]);
    return parts;
  }

  score() { return this.scoreParts().reduce((n, [, v]) => n + v, 0); }

  // The end of a run: the summary with the score, posted to the leaderboard (board: the
  // Leaderboard, given by main.js), and a button to see the board
  endRun(title, sub, again) {
    const score = this.score();
    const entry = { score, name: this.playerName?.() || 'Jelly', body: this.playerBody?.() || 'nettle', level: this.level, kills: this.kills, time: Math.round(this.t), won: this.bossWon, build: (typeof window !== 'undefined' && window.JF_BUILD) || '' };
    const show = (result) => {
      this.endView = 'summary';
      const rows = [['Score', `<span class="jf-score">${score.toLocaleString()}</span>${result?.best ? ' <small>new best!</small>' : ''}`], ...this.summary()];
      // a run always starts over from act 1
      const buttons = [{ label: again, go: true, onClick: () => { if (this.stage.id > 1) goToAct(1); else { this.start(); this.resume(); } } }];
      if (this.board) buttons.push({ label: '🏆 Leaderboard', onClick: () => this.showBoard(() => show(result)) });
      this.ui.message(title, sub, rows, buttons);
    };
    show(null);
    // when the post comes back, refresh the summary (if it's still what's on screen) with "new best!"
    this.board?.submit(entry).then((result) => { this.lastPost = result; if ((this.phase === 'dead' || this.phase === 'won') && this.endView === 'summary') show(result); });
  }

  // An act beaten with another to come: the score so far goes on the board, and the run moves on
  // with everything it has (level, stats, treasures, score)
  actComplete(next) {
    const score = this.score();
    const carry = {
      score, stats: this.stats, level: this.level, xp: this.xp, purse: this.purse,
      owned: [...this.owned].map((id) => [id, this.owned.count(id)]), grown: this.grown, growCount: this.growCount,
    };
    this.board?.submit({ score, name: this.playerName?.() || 'Jelly', body: this.playerBody?.() || 'nettle', level: this.level, kills: this.kills, time: Math.round(this.t), won: false, build: (typeof window !== 'undefined' && window.JF_BUILD) || '' });
    this.ui.message(`Act ${this.stage.id} complete`, `${this.stage.subtitle} is yours. Next: act ${next.id}, ${next.subtitle.toLowerCase()}. Your level, stats and treasures come with you.`,
      [['Score so far', `<span class="jf-score">${score.toLocaleString()}</span>`], ...this.summary()],
      [{ label: `On to act ${next.id} →`, go: true, onClick: () => goToAct(next.id, carry) }]);
  }

  // The leaderboard as a dialog; back() returns to where it was opened from
  showBoard(back) {
    const B = this.board;
    this.endView = 'board';
    const rows = B.table();
    this.ui.message('🏆 Leaderboard', B.note(), rows.length ? rows : [], [{ label: 'Back', go: true, onClick: back }]);
  }

  summary() {
    const m = Math.floor(this.t / 60), sec = String(Math.floor(this.t % 60)).padStart(2, '0');
    return [
      ['Time', `${m}:${sec}`],
      ['Level', this.level],
      ['Dry things cleared', this.kills],
      ['Treasures', [...this.owned].map((id) => TREASURES.find((t) => t.id === id).icon + (this.owned.count(id) > 1 ? `×${this.owned.count(id)}` : '')).join(' ') || 'none'],
    ];
  }

  // ------------------------------------------------------------ music
  // What the soundtrack (music.js) should play: "Puddle Drift" while you explore, building with
  // the bugs close by and the hour; "Domestic Machinery" for the Vacuum, wilder as it weakens
  musicState() {
    if (this.phase === 'explore') {
      const P = this.player.position;
      let near = 0;
      for (const e of this.enemies.list) if (!e.dead && e.pos.distanceTo(P) < 0.7) near += e.proxy ? 4 : 1;   // elites count for more
      return { song: 'drift', intensity: Math.min(1, 0.12 + 0.6 * Math.min(1, near / 10) + 0.3 * Math.min(1, this.t / this.duration)) };
    }
    if (this.phase === 'boss' && this.boss && !this.boss.dead) return { song: 'machinery', intensity: 0.62 + 0.45 * (1 - this.boss.hp / this.boss.maxHp), suck: this.boss.state === 'suction' };
    return { song: null, intensity: 0 };
  }

  // ------------------------------------------------------------ HUD
  refreshHud() {
    const h = this.hud;
    h.setMoisture(this.moisture, this.S.moisture);
    h.setXp(this.level, this.xp, xpToNext(this.level), this.purse);
    h.setItems([...this.owned].map((id) => { const t = TREASURES.find((x) => x.id === id), n = this.owned.count(id); return n > 1 ? { ...t, icon: `${t.icon}<sub>×${n}</sub>` } : t; }));
    const [c0, c1] = this.stage.clock;
    const mins = c0 + (c1 - c0) * Math.min(1, this.t / this.duration);
    const hh = Math.floor(mins / 60), mm = Math.floor(mins % 60);
    const left = Math.max(0, Math.ceil(this.duration - this.t));
    // big: how long until the boss; small: the night's clock and who's coming
    const clock = `${hh === 0 ? 12 : hh}:${String(mm).padStart(2, '0')} AM`;
    const exploring = this.phase === 'explore';
    h.setClock(exploring ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : clock, exploring && left <= 20);
    h.setStage(this.duel ? `Dev: 1 on 1 with ${this.duel.name} · pause to pick another` : exploring ? `${clock} · ${this.stage.boss.name} is coming` : '');
  }

  markers() {
    const out = [];
    for (const e of this.enemies.list) if (!e.dead && !e.proxy) out.push({ kind: 'enemy', x: e.pos.x, y: e.pos.y, z: e.pos.z });
    if (this.phase === 'explore' && this.gift.active) { const g = this.gift.pos; out.push({ x: g.x, y: g.y, z: g.z, color: '#ffc93a', big: true }); }
    if (this.phase === 'explore') for (const e of this.elites.alive) out.push({ x: e.base.x, y: e.base.y, z: e.base.z, color: '#ff8a3a' });
    if (this.phase === 'boss' && this.boss && !this.boss.dead) { const p = this.boss.position; out.push({ x: p.x, y: p.y, z: p.z, color: '#ff4a4a', big: true }); }
    return out;
  }
}
