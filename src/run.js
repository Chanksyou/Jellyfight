// One run of stage 1: grow until the timer runs out (grabbing treasures that turn up in the room and
// the ones elites drop), then beat the stage's boss and evolve.
import * as THREE from 'three';
import { addForceField } from './forcefield.js';
import { BASE_STATS, rollCards, rollTreasures, treasureTier, applyCard, xpToNext, TREASURES, EVOLUTIONS, ELEMENT_TREASURES, ELEMENT_UPGRADES, MAX_BUBBLES, MAX_DODGE, MAX_TENTACLES, STAT_INFO } from './stats.js';
import { inPoly } from './hud.js';
import { STAGES, goToAct } from './stages.js';
import { Vacuum } from './vacuum.js';
import { Clog } from './clog.js';
import { TYPES } from './enemies.js';
import { CONTENT, compileMods } from './content.js';
import { Gadgets } from './gadgets.js';
import { Elites, ELITE_NAMES } from './elites.js';
import { Bubbles } from './bubbles.js';
import { RoomTreasure, XpDrops } from './pickups.js';
import { FirstRun, markPlayed } from './first-run.js';
import { juice } from './juice.js';
import { sfx, calm } from './sfx.js';
import { bus, PLAYER } from './events.js';
import { FRIENDLY as friendlyColor } from './vfx.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const _drop = new THREE.Vector3(), p0 = new THREE.Vector3();
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Which rarities a treasure pick offers, by where it came from: a chest that turned up in the room
// (on the schedule) or one a beaten Elite left. The Boss reward is Legendary only (pickLegendary).
// Standing this far (m) above the act's floor counts as high ground (a `while` treasure): furniture,
// not a rug or a threshold
const HIGH_GROUND = 0.1;
// Under this share of max Health counts as low (a `while low-health` treasure)
const LOW_HEALTH = 0.3;

const PICK_TIERS = { room: ['common', 'rare'], elite: ['rare', 'epic'] };

// The treasures you own; counts changes so the combined effects are rebuilt only when needed
// The treasures you own: a set of ids that also counts copies of stackable ones (stack=N)
class Owned extends Set {
  add(v) { super.add(v); (this.n ||= new Map()).set(v, this.count(v) + 1); this.version = (this.version || 0) + 1; return this; }
  delete(v) { const r = super.delete(v); this.n?.delete(v); this.version = (this.version || 0) + 1; return r; }
  clear() { super.clear(); this.n?.clear(); this.version = (this.version || 0) + 1; }
  count(v) { return this.n?.get(v) || 0; }
}

export class Run {
  // ctx: { scene, stage, plan, world, player, cfg, enemies, lash, xpDrops, traversal, hud, ui, fx, tpc, input, setNight }
  constructor(ctx) {
    Object.assign(this, ctx);
    this.gadgets = new Gadgets(ctx.scene, ctx.enemies, ctx.fx, ctx.world);
    this.bubbles = new Bubbles(ctx.scene, ctx.enemies, ctx.fx, ctx.world);
    this.bubbles.grace = this.cfg.radius;
    // treasures waiting in the room as golden chests: on a schedule (stage.treasures) and where elites fall
    this.roomTreasures = [new RoomTreasure(ctx.scene, ctx.fx)];
    this.friendly = friendlyColor().getHex();   // look.css --friendly: reflect and death-save flashes
    this.crumbs = new XpDrops(ctx.scene, ctx.world, 'health-crumb');   // Health crumbs bugs drop (crumb-on-kill)
    this.bubbles.onBlow = () => { this.player.avatar?.pulse?.(0.6); sfx.blow(); };   // the bell squeezes as it blows
    this.elites = new Elites(ctx.scene, ctx.enemies, ctx.fx, ctx.world, ctx.tpc.camera, ctx.apartment);
    this.elites.hpScale = this.stage.eliteHp || 1;
    this.elites.decorSpecs = this.stage.decor || [];   // what only hangs there in this act (the hall clock)
    // low invisible walls around the boss arena, solid only during the fight
    this.bossWalls = (ctx.stage.boss.walls || []).map((w) => {
      const size = w.max.map((v, i) => v - w.min[i]);
      const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
      m.position.set(...w.min.map((v, i) => v + size[i] / 2));
      m.visible = false;
      m.updateMatrixWorld();
      ctx.world.addCollider(m);
      // and what you see of it: up only while the fight is (forcefield.js)
      const field = addForceField(ctx.scene, w);
      if (field) { field.visible = false; m.userData.field = field; }
      return m;
    });
    this.rooms = ctx.plan;
    this.fade = document.createElement('div');
    this.fade.style.cssText = 'position:fixed;inset:0;background:radial-gradient(#fffbe8,#cfe2ff);opacity:0;pointer-events:none;z-index:20;transition:opacity .5s';
    document.body.appendChild(this.fade);

    // The run owns the jelly's health, slow and knockback, and what kills are worth
    bus.on('damage_taken', ({ targetId, amount, drain, from }) => {
      if (targetId !== PLAYER) return;
      amount *= this.stage.power || 1;       // later acts hit harder (stage files)
      if (drain) this.hurt(amount, true);   // puddles and suction: no i-frames, no flinch
      else this.hit(amount, from);          // i-frames, dodge, the on-hurt treasures (Rubber Duck, when-hit)
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
    // heal-on-hit (treasures): a chance that your bubble or tentacle hits give back health
    bus.on('damage_taken', (d) => {
      const H = this.mods.healOnHit;
      if (H && d.targetId !== PLAYER && (d.source === 'bubble' || d.source === 'tentacle') && Math.random() < H.chance) this.heal(H.health);
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
    this.roomTreasures?.forEach((t) => t.hide());
    this.treasureTimesLeft = [...(this.stage.treasures?.at || [])];   // seconds into the night each scheduled treasure appears
    this.lastTreasureSpot = null;
    this.recentTreasureSpots = [];   // the last few spots, so each one turns up somewhere new
    this.xpDrops.clear();
    this.crumbs?.clear();
    this.fx.clear();
    this.lash.reset();
    juice.reset();
    this.bubbles.reset();
    this.gadgets.reset();
    this.boss?.dispose();
    this.boss = null;
    this.traversal.bossMode = false;
    this.bossWalls.forEach((m) => { m.visible = false; if (m.userData.field) m.userData.field.visible = false; });
    this.hud.setBoss(null);
    this.hud.setElite(null);
    this.ui.close();
    this.fade.style.opacity = 0;

    this.phase = 'explore';
    this.t = 0;
    this.startPicked = false;         // the starting Element pick is offered on the run's first frame
    this.firstRun = FirstRun.forStage(this.stage);   // a player's first run (first-run.js)
    this.hint = null; this.hintT = 0;
    this.dev = false;                 // a dev mode's run (1 on 1, fight the boss): never a first run, never counts as played
    this.stats = { ...BASE_STATS };
    this.level = 1;
    this.xp = 0;
    this.purse = 0;
    this.health = this.stats.health;
    this.owned = new Owned();
    this.kills = 0;
    this.eliteBugs = 0;               // golden elite bugs cleared (score)
    this.elitesBeaten = 0;            // high-ground elites beaten (score)
    this.bossStartT = null;
    this.bossWon = false;
    this.collectAll = false;
    this.runId = (this.runId || 0) + 1;    // delayed steps (later()) belong to this run only
    this.pendingLevels = 0;
    this.iFrames = 0;
    this.slowT = 0;
    this.slipT = 0;
    this.stillT = 0;
    this.squeakCd = []; this.hurtCd = {};
    this.reflectAt = 0;               // when a reflect treasure is ready again (seconds into the night)
    this.saved = false;               // the run's one death-save is spent
    this.grown = {}; this.growCount = {}; this.growTotal = {};
    this.chestsOpened = 0;            // treasure chests opened this run (every 3rd offers an Element upgrade)
    // a later act: the run carries on from the act before (main.js gives it: stages.js)
    const C = this.carry;
    if (C) {
      this.stats = { ...BASE_STATS, ...C.stats };
      this.level = C.level; this.xp = C.xp; this.purse = C.purse;
      for (const [id, n] of C.owned) for (let k = 0; k < n; k++) this.owned.add(id);
      this.grown = { ...C.grown }; this.growCount = { ...C.growCount }; this.growTotal = { ...C.growTotal };
      this.chestsOpened = C.chestsOpened || 0;
      this.saved = !!C.saved;
      this.health = this.stats.health;
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

    // Only open, easy-to-reach treasure spots (the apartment is static, so check once)
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
  // how hard treasures that attack on their own hit: scales with bubble damage
  // Your stats as they stand: the starting values plus level-up cards (this.stats) plus what
  // your treasures add (stat words). One object, refilled on each read: no garbage per frame.
  get S() {
    const S = (this._S ||= {}), add = this.mods.stats.add, pct = this.mods.stats.pct;
    const grown = this.grown || {};
    for (const k in this.stats) S[k] = this.stats[k] + (add[k] || 0) + (grown[k] || 0) + BASE_STATS[k] * (pct[k] || 0) / 100;
    // while: conditionals, true right now or not (the jelly in the air, or up on furniture)
    const whiles = this.mods.whiles;
    if (whiles.length) {
      const P = this.player, air = !P.grounded && !P.climbing, high = P.grounded && P.position.y > (this.stage.floorY || 0) + HIGH_GROUND;
      const low = this.health < S.health * LOW_HEALTH;
      for (const c of whiles) if (c.when === 'airborne' ? air : c.when === 'high-ground' ? high : low) S[c.stat] += c.percent ? BASE_STATS[c.stat] * c.amount / 100 : c.amount;
    }
    // per: converters read the stats above (not each other's results), so the order doesn't matter
    const per = this.mods.per;
    if (per.length) {
      const health = S.health, speedBonus = (S.moveSpeed / BASE_STATS.moveSpeed - 1) * 100;
      for (const c of per) {
        const src = c.of === 'max-health' ? health : c.of === 'move-speed-bonus' ? Math.max(0, speedBonus) : c.of === 'levels' ? this.level - 1 : this.chestsOpened || 0;
        S[c.stat] += (src / c.every) * c.amount * (c.percent ? BASE_STATS[c.stat] / 100 : 1);
      }
    }
    S.bubbles = Math.max(1, Math.min(MAX_BUBBLES, Math.round(S.bubbles)));
    S.dodge = Math.min(MAX_DODGE, Math.max(0, S.dodge));
    S.tentacles = Math.max(1, Math.min(MAX_TENTACLES, Math.round(S.tentacles)));
    return S;
  }

  get power() { return this.S.bubbleDamage * 1.8; }   // gadgets and treasures: pop 6 -> 10.8, as before the slower, harder stream
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
    const s = this.S;   // treasures can raise all four (stat, per)
    return { tentacles: s.tentacles, reach: s.reach, tentacleDamage: s.tentacleDamage, tentacleSpeed: s.tentacleSpeed };
  }
  // seconds until the boss comes (treasures can make the night longer)
  get duration() { return this.stage.duration; }

  // ------------------------------------------------------------ main update
  update(dt) {
    if (this.phase === 'dead' || this.phase === 'won' || this.phase === 'metamorph') { this.touchAction = null; return; }
    // every run starts with an Element: pick 1 of 3 before anything happens (on a player's first
    // run it waits for the first Level-up instead: first-run.js)
    if (!this.startPicked && this.phase === 'explore') {
      this.startPicked = true;
      if (this.firstRun.startElementPick) { this.pickStartElement(); return; }
    }
    this.t += dt;
    const P = this.player, s = this.S;

    // --- movement, with vents, fabric, and the drain's pull
    const tr = this.traversal.query(P.position);
    let push = null;
    if (this.phase === 'boss' && this.boss) {
      push = this.boss.update(dt, P).push;
      if (this.boss.dead && !this.bossDeadT) this.onBossDead();
    }
    if (this.phase !== 'intro') {
      this.world.focus(P.position, dt);
      P.update(dt, this.input, this.tpc.yaw, {
        speedMul: s.moveSpeed, jumpMul: s.jumpHeight, vent: this.phase === 'explore' ? tr.vent : null, climb: !!tr.climb,
        airJumps: this.mods.extraJumps,       // no mid-air jump until Pen Spring
        slow: this.slowT > 0 ? 0.4 : 0, push,
        slip: this.slipT > 0 ? 1 : 0,
      });
    }

    // --- timers
    this.iFrames = Math.max(0, this.iFrames - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.slipT = Math.max(0, this.slipT - dt);
    // --- the night: waves, treasures, and the boss when time runs out
    if (this.phase === 'explore' && this.duel) this.updateDuel(dt);
    else if (this.phase === 'explore') {
      this.spawnWaves(dt);
      this.scheduleTreasures();
      this.updateRoomTreasures(dt);
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
      this.gadgets.update(dt, { mods: this.mods, feet: P.position, center: origin, facing: P.facing, power: this.power, dropXp: (n) => this.xpDrops.drop(P.position.clone().setY(P.position.y + 0.01), 1, n), bubbleRing: (n, k) => this.bubbles.ring(origin, n, this.S.bubbleDamage * k, this.S, this.mods) });
      if (this.phase === 'explore') {
        this.elites.update(dt, P, this.cfg);
        // the elite fighting you (the closest awake one): its name and health on the HUD
        const fe = this.elites.list.filter((e) => !e.dead && !e.decor && !e.beaten && (e.awake || e.state !== 'idle'))
          .sort((a, b) => a.base.distanceTo(P.position) - b.base.distanceTo(P.position))[0];
        this.hud.setElite(fe ? fe.name : null, fe ? fe.hp / fe.maxHp : 0);
      } else this.hud.setElite(null);
      this.enemies.pace = this.mods.bugSpeed;
      this.enemies.eliteDamage = this.mods.eliteDamage;
      this.enemies.update(dt, { position: P.position, height: this.cfg.height, radius: this.cfg.radius }, this.t);
      this.contactDamage();
      this.enemies.shotHits(P.position.clone().setY(P.position.y + this.cfg.height * 0.5), this.cfg.radius);
    }
    for (const b of this.bursts.splice(0)) this.burst(b);

    // --- treasure effects that tick here (timed and area ones run in gadgets.js)
    if (s.regen > 0 && this.phase !== 'intro') this.heal(s.regen * dt);   // health regen (cards, treasures)
    const spout = this.mods.spout;
    if (spout) {
      this.stillT = P.speed < 0.02 && P.grounded ? this.stillT + dt : 0;
      if (this.stillT > spout.after) this.heal(spout.heal * dt);
    }

    // --- XP
    if (this.collectAll) this.xpDrops.magnetAll = true;   // the boss is down: everything on the floor flies to you
    const got = this.xpDrops.update(dt, origin, this.mods.xpReach);
    if (got) { this.gainXp(got); sfx.xp(juice.combo); }
    const crumbs = this.crumbs.update(dt, origin, this.mods.xpReach);   // each crumb is worth its Health
    if (crumbs) { this.heal(crumbs); this.fx.number(origin.clone().setY(origin.y + this.cfg.height), `+${crumbs} Health`, '#c6ffb0', 14); }
    juice.update(dt);
    this.hud.setCombo(juice.combo, juice.comboT / 2.5, juice.bonus);

    // --- hints
    this.input.consumeInteract();
    this.touchAction = null;
    const jumpKey = this.touch ? '⤴' : '<kbd>Space</kbd>';
    if (tr.vent) this.lastVent = tr.vent.to;
    if (this.hintT > 0) { this.hintT -= dt; this.hud.hint(this.hint); }   // a timed line (first-run.js) wins for its few seconds
    else if (tr.climb && !P.climbing && this.phase === 'explore') this.hud.hint(`Hold ${jumpKey} to climb the ${tr.climb.name.toLowerCase()}`);
    else if (P.flight) this.hud.hint(`Whoosh! Up to ${this.lastVent}`);
    else this.hud.hint(null);

    if (this.phase === 'intro') this.updateBossIntro(dt);
    if (this.pendingLevels > 0 && !this.ui.open && this.phase !== 'intro') this.levelUp();
    this.refreshHud();
  }

  // ------------------------------------------------------------ dev: one on one
  // A fresh run with nothing in it but one enemy, to see how it moves and attacks: a bug that
  // turns up in front of you (another 1.5 s after you clear it), or one of this act's elites with
  // you on its high ground (it comes back after you beat it). No waves, no scheduled treasures, no boss.
  duelChoices() {
    const bugs = Object.values(TYPES).map((T) => ({ name: T.name, bug: T.id }));
    // every act's elites: one from another act reloads the game into that act first (startDuel)
    const elites = STAGES.flatMap((st) => (st.elites || []).map((spec) => ({ name: `${ELITE_NAMES[spec.kind]} (elite, act ${st.id})`, elite: spec, act: st.id })));
    return [...bugs, ...elites];
  }

  startDuel(pick) {
    if (pick.act && pick.act !== this.stage.id) { goToAct(pick.act, null, { duel: pick.name }); return; }   // its room is in another act
    this.start();
    this.devRun();
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
    const more = this.mods.moreBugs * (this.stage.bugs || 1);   // more-bugs (treasures), and the act's own `bugs`
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
        // ant squads hit harder rolling
        bus.emit('damage_taken', { targetId: PLAYER, amount: e.state === 'dash' && e.T.rollDmg ? e.T.rollDmg : e.T.dmg, source: e.type, from: e.id });
      }
    }
  }

  // from: the enemy id that dealt the hit, if one did (when-hit effects can answer it)
  hit(amount, from = null) {
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
    // reflect: the first hit every so often goes back where it came from, and you take none of it
    if (M.reflect && this.t >= this.reflectAt) {
      this.reflectAt = this.t + M.reflect.every;
      this.iFrames = M.reflect.invuln;
      const P = this.player.position, at = P.clone().setY(P.y + this.cfg.height * 0.5);
      this.fx.ring(P.clone().setY(P.y + 0.004), this.friendly, 0.06, 0.4);
      this.fx.number(at.clone().setY(at.y + 0.04), 'REFLECT', '#cfe8ff', 18);
      const e = from != null && this.enemies.list.find((x) => x.id === from && !x.dead);
      if (e) { this.fx.impact(this.enemies.center(e), this.friendly, 0.02, 8); bus.emit('damage_taken', { targetId: e.id, amount, color: '#cfe8ff', source: 'reflect' }); }
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
    // when-hit effects: a { ring, zap … } block on its own cooldown, aimed at whoever hit you
    for (const H of M.onHurt) {
      if ((this.hurtCd[H.key] || 0) > this.t) continue;
      this.hurtCd[H.key] = this.t + H.cooldown;
      const P = this.player.position, ctx = { feet: P, center: P.clone().setY(P.y + this.cfg.height * 0.5), facing: this.player.facing, power: this.power, from, taken: amount };
      for (const ef of H.effects) this.gadgets.fire(ef, ctx);
    }
    this.hurt(amount);
  }

  hurt(amount, silent = false) {
    this.health -= amount;
    const hint = amount > 0 && this.firstRun.hintOnHit();   // a first run's one line about Health (first-run.js)
    if (hint) { this.hint = hint; this.hintT = 4.5; }
    if (!silent) { juice.shake(0.55); sfx.hurt(); }
    if (!silent) this.player.avatar?.land(1.5);
    // death-save: once per run, the last of your Health holds
    const D = this.mods.deathSave;
    if (this.health <= 0 && D && !this.saved && this.phase !== 'dead') {
      this.saved = true;
      this.health = this.S.health * D.health;
      this.iFrames = 1.5;
      const P = this.player.position;
      this.fx.ring(P.clone().setY(P.y + 0.004), this.friendly, 0.12, 0.6);
      this.fx.impact(P.clone().setY(P.y + this.cfg.height * 0.5), this.friendly, 0.05, 16);
      this.hud.toast('⏰ Snooze! Back up with half your Health.', 2400);
      return;
    }
    if (this.health <= 0) this.die();
  }

  heal(amount) { this.health = Math.min(this.S.health, this.health + amount); }

  // an enemy_killed event: { pos, r, xp, elite }
  onKill({ pos: c, r, xp: baseXp, elite, floor = c.y }) {
    this.kills++;
    const combo = juice.kill();
    if (combo % 10 === 0) { sfx.combo(combo); this.fx.number(c.clone().setY(c.y + r * 3), `${combo} COMBO!`, '#ffd23a', 22); }
    const xp = Math.round(baseXp * this.mods.xpMult * (this.stage.xpMult || 1) * juice.bonus);   // the act's own xpMult too
    this.xpDrops.drop(c, 1, xp);
    this.fx.number(c.clone().setY(c.y + r * 1.5), `+${xp} XP`, '#ffe27a', elite ? 20 : 14);
    if (this.mods.healOnKill) this.heal(this.mods.healOnKill);
    // grow-on-kills: every N kills a stat grows for good
    // (with a cap: that copy stops growing once it has added `cap` in all)
    for (const g of this.mods.growth) {
      if (g.cap != null && (this.growTotal[g.key] || 0) >= g.cap) continue;
      const n = (this.growCount[g.key] || 0) + 1;
      this.growCount[g.key] = n % g.kills;
      if (n < g.kills) continue;
      const step = g.cap != null ? Math.min(g.amount, g.cap - (this.growTotal[g.key] || 0)) : g.amount;
      this.growTotal[g.key] = (this.growTotal[g.key] || 0) + step;
      const amount = g.percent ? BASE_STATS[g.stat] * step / 100 : step;
      this.grown[g.stat] = (this.grown[g.stat] || 0) + amount;
      if (g.stat === 'health') this.heal(amount);
      if (g.percent) continue;             // a percent grows in small steps: no number for each one
      const P = this.player.position;
      this.fx.number(P.clone().setY(P.y + this.cfg.height * 1.2), `+${g.amount} ${STAT_INFO[g.stat]?.icon || ''}`, '#c6ffb0', 15);
    }
    // crumb-on-kill: now and then a bug leaves a Health crumb to pick up
    const cr = this.mods.crumbs;
    if (cr && Math.random() < cr.chance) this.crumbs.drop(c, cr.health);
    if (elite) {                         // elites leave a treasure where they fall
      this.eliteBugs++;
      this.fx.puff(c, 0xffd23a, r * 3, 0.5);
      if (this.phase === 'explore') { this.dropTreasure(_drop.set(c.x, floor, c.z)); this.hud.toast('✨ Elite cleared! It left a treasure.', 1800); }
    }
    if (this.mods.burstOnKill) this.bursts.push(c);
  }

  // One of the high-ground elites (elites.js) is beaten
  eliteDefeated(e) {
    this.kills++;
    this.elitesBeaten++;
    juice.shake(0.7); juice.hitstop(0.15); sfx.boom();
    this.xpDrops.drop(e.base.clone().setY(e.base.y + e.r), 1, 20);
    this.fx.number(e.base.clone().setY(e.base.y + e.r * 2.5), '+20 XP', '#ffe27a', 20);
    this.dropTreasure(e.base);
    this.hud.toast(`✨ ${e.name} is beaten! It left a treasure on the ${e.spec.area}.`, 2400);
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
  gainXp(n) {
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
      const before = this.stats.health;
      applyCard(this.stats, card);
      if (this.stats.health > before) this.heal(this.stats.health - before);
      if (this.firstRun.elementPickAfterCard()) { this.pickStartElement(); return; }   // a first run: the Element comes now
      this.resume();
    }, () => rollCards(this.stats, 3 + this.mods.cardChoices, this.mods.cardRarity, this.S.luck));
  }

  resume() {
    if (!this.ui.open) this.onResume?.();
  }

  // a dev mode's run (1 on 1, fight the boss): played as a normal run, and not counted as one
  devRun() { this.dev = true; this.firstRun = new FirstRun(false); }

  pickStartElement() {
    this.pickElement('🔥 Pick your element', 'An attack of its own, fired alongside your bubbles. Every third treasure you find offers one of its upgrades. A Boss can bring you another.',
      () => { this.firstRun.elementChosen = true; this.resume(); });
  }

  // start: the starting pick, two elements for your bubbles and one of anything else
  // Pick 1 of 3 treasures you can still take (unique ones you don't have, stackable ones below
  // their stack=N) from a treasure chest; every 3rd chest, one of them is an Element upgrade. Base elements never come from here: they're Legendary (pickElement, pickLegendary).
  // source: where the pick came from, which decides the rarities it offers (PICK_TIERS)
  pickTreasure(title = '✨ A treasure', sub = 'Pick one to keep.', source = 'room') {
    const tiers = PICK_TIERS[source];
    const takeable = (t) => this.owned.count(t.id) < t.stack && (!t.needs || this.owned.has(t.needs));
    const can = (t) => tiers.includes(t.rarity) && takeable(t) && !ELEMENT_TREASURES.includes(t.id) && !ELEMENT_UPGRADES.includes(t.id);
    // every 3rd chest: one of the three is an upgrade for an element you own (by its own rarity), if any is left
    const ups = ++this.chestsOpened % 3 === 0 ? TREASURES.filter((t) => ELEMENT_UPGRADES.includes(t.id) && takeable(t)) : [];
    const up = ups.length ? rollTreasures(ups, 1, this.S.luck) : [];
    let left = shuffle([...up, ...rollTreasures(TREASURES.filter(can), 3 - up.length, this.S.luck)]);
    if (!left.length) return;
    // stackable ones say how many you'd have; levelled ones which level it'd be and what it adds
    left = left.map((t) => {
      const next = this.owned.count(t.id) + 1, levelled = t.levels.length > 1;
      const name = levelled ? `${t.name} <small>Lv ${next}${next > 1 ? ' ⬆' : ''}</small>` : t.stack > 1 ? `${t.name} <small>${next}/${t.stack}</small>` : t.name;
      const text = levelled && next > 1 ? t.levelText[next - 1] : t.text;
      return { ...t, tier: treasureTier(t), name, text };
    });
    this.offer(title, sub, left);
  }

  // The start of a run: pick the base version of one element attack you don't have yet (1 of 3,
  // all Legendary); every 3rd treasure chest then offers one of its upgrades.
  // then: what happens after the pick (or straight away, if you already have every element)
  pickElement(title, sub, then = () => this.resume()) {
    const left = shuffle(TREASURES.filter((t) => ELEMENT_TREASURES.includes(t.id) && !this.owned.has(t.id))).slice(0, 3)
      .map((t) => ({ ...t, tier: treasureTier(t) }));
    if (!left.length) { then(); return; }
    this.offer(title, sub, left, then);
  }

  // The Boss reward: a Legendary pick of three, with at least one element you don't have yet
  // (while any are left); the rest from the other Legendary treasures and elements you can take
  pickLegendary(title, sub, then = () => this.resume()) {
    const can = (t) => t.rarity === 'legendary' && this.owned.count(t.id) < t.stack && (!t.needs || this.owned.has(t.needs));
    const pool = shuffle(TREASURES.filter(can)), el = pool.find((t) => ELEMENT_TREASURES.includes(t.id));
    const left = (el ? [el, ...pool.filter((t) => t !== el)] : pool).slice(0, 3);
    if (!left.length) { then(); return; }
    this.offer(title, sub, shuffle(left).map((t) => ({ ...t, tier: treasureTier(t) })), then);
  }

  offer(title, sub, choices, then = () => this.resume()) {
    if (document.pointerLockElement) document.exitPointerLock();
    sfx.treasure();
    this.ui.choose(title, sub, choices, (t) => {
      const before = this.S.health;
      this.owned.add(t.id);
      if (this.S.health > before) this.heal(this.S.health - before);
      this.ui.treasure(t);
      then();
    });
  }

  // ------------------------------------------------------------ treasures in the room
  // At each time in stage.treasures.at a treasure turns up somewhere else in the room and waits
  // stage.treasures.stay seconds; touch it in time for a treasure pick
  scheduleTreasures() {
    const T = this.stage.treasures;
    if (!T || !this.treasureTimesLeft.length || this.t < this.treasureTimesLeft[0]) return;
    if (this.roomTreasures.some((t) => t.active && t.timed)) return;   // one scheduled at a time: the next waits
    this.treasureTimesLeft.shift();
    if (!this.firstRun.treasuresDue) return;           // a first run, before its Element pick: this one's skipped (first-run.js)
    const spot = this.nextTreasureSpot();
    if (!spot) return;
    this.placeTreasure(spot, T.stay);
    this.lastTreasureSpot = spot;
    this.recentTreasureSpots = [spot.label, ...this.recentTreasureSpots].slice(0, 3);
    this.hud.toast(`✨ A treasure appeared: ${spot.label}. ${T.stay} seconds to grab it!`, 2800);
  }

  // A beaten elite leaves its treasure where it fell, on the nearest open spot (openSpot: open
  // overhead, nothing crowding it, flat), so it's never inside or under furniture; it waits there
  // for the rest of the act. Nothing open close by: it settles on the surface under where it fell
  // (the wall clock's lands on the bench below).
  dropTreasure(at) {
    const p = this.openSpotNear(at);
    if (!p) { const hit = this.world.castAll(_drop.set(at.x, at.y + 0.03, at.z), DOWN, 2.5); p0.copy(at); if (hit) p0.y = hit.point.y; }
    this.placeTreasure((p || p0).clone(), Infinity, Math.random() * Math.PI * 2);
  }

  // The closest open spot to `at` (rings out to 50 cm), on the same surface if there is one there
  openSpotNear(at) {
    let other = null;
    for (const d of [0, 0.04, 0.08, 0.12, 0.16, 0.2, 0.25, 0.3, 0.4, 0.5]) {
      const n = d ? 16 : 1;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2, x = at.x + Math.cos(a) * d, z = at.z + Math.sin(a) * d;
        const r = this.openSpot([x, at.y, z]);
        if (!r.ok) continue;
        if (Math.abs(r.y - at.y) < 0.1) return new THREE.Vector3(x, r.y, z);
        other ||= new THREE.Vector3(x, r.y, z);
      }
    }
    return other;
  }

  placeTreasure(at, stay, facing) {
    let t = this.roomTreasures.find((x) => !x.active);
    if (!t) this.roomTreasures.push(t = new RoomTreasure(this.scene, this.fx));
    t.show(at, stay, facing);
    this.firstRun.treasureAppeared();
    return t;
  }

  updateRoomTreasures(dt) {
    for (const t of this.roomTreasures) {
      const r = t.update(dt, this.t, this.player.position);
      if (r === 'taken') this.pickTreasure('✨ A treasure!', t.timed ? 'You got there in time. Pick one to keep.' : 'Pick one to keep.', t.timed ? 'room' : 'elite');
      else if (r === 'gone') this.hud.toast('✨ The treasure faded away…', 1800);
    }
  }

  // somewhere else: away from you, in another part of the room from the last one, not one of the
  // last three spots (from the stage's open spots: flat, nothing overhead)
  nextTreasureSpot() {
    const P = this.player.position, last = this.lastTreasureSpot;
    const ok = (sp, far, elsewhere) => Math.hypot(sp.at[0] - P.x, sp.at[2] - P.z) > far
      && (!elsewhere || !last || (sp.area !== last.area && Math.hypot(sp.at[0] - last.at[0], sp.at[2] - last.at[2]) > 0.8 && !this.recentTreasureSpots.includes(sp.label)));
    for (const [far, elsewhere] of [[0.8, true], [0.5, true], [0.5, false], [0, false]]) {
      const c = (this.spots || []).filter((sp) => ok(sp, far, elsewhere));
      if (c.length) return c[Math.floor(Math.random() * c.length)];
    }
    return null;
  }

  // ------------------------------------------------------------ treasure spots
  // A treasure on a vent's landing point would be grabbed just by taking the vent, so a spot that
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

  // A treasure spot must be easy to see and reach: open sky above it (the camera looks down),
  // nothing crowding it, and flat ground. Returns the surface height, or null with a reason.
  openSpot([x, y, z]) {
    const W = this.world, V = (a, b, c) => new THREE.Vector3(a, b, c);
    const hit = W.castAll(V(x, y + 0.15, z), DOWN, 0.4);
    if (!hit) return { ok: false, why: 'no surface' };
    const sy = hit.point.y;
    if (W.castAll(V(x, sy + 0.01, z), V(0, 1, 0), 0.3)) return { ok: false, why: 'covered overhead' };
    // a ray that starts inside something (a kettle standing on the spot) passes through its faces
    // without a hit, so also look down from well above: the first thing below must be the surface
    const top = W.castAll(V(x, sy + 0.3, z), DOWN, 0.31);
    if (!top || top.point.y > sy + 0.01) return { ok: false, why: 'inside or under something' };
    // nothing beside it, low down or overhanging at the jelly's height (it would stand on it, too high to touch)
    for (const h of [0.015, 0.05, 0.09]) for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      if (W.castAll(V(x, sy + h, z), V(Math.cos(a), 0, Math.sin(a)), 0.06)) return { ok: false, why: 'crowded' };
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
    this.xpDrops.magnetAll = true;
  }

  updateBossIntro(dt) {
    this.liftT += dt;
    const P = this.player;
    this.xpDrops.magnetAll = true;
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
      this.roomTreasures.forEach((t) => t.hide());
      this.bossWalls.forEach((m) => { m.visible = true; if (m.userData.field) m.userData.field.visible = true; });
      const p = new THREE.Vector3(...B.playerStart);
      this.world.focus(p, 1);
      P.spawn(p);
      P.snapToGround();
      P.facing = -Math.PI / 2;
      this.tpc.snapTo(P.position);
      this.tpc.yaw = -Math.PI / 2 + Math.PI;
      this.boss = B.kind === 'vacuum' ? new Vacuum(this.scene, this.enemies, this.fx, B, this.world) : new Clog(this.scene, this.enemies, this.fx, B, this.world);
      this.boss.maxHp = this.boss.hp = Math.round(this.boss.maxHp * (B.hpScale ?? this.stage.bossHp ?? 1));
      this.enemies.addProxy(this.boss);
      this.later(() => { this.fade.style.opacity = 0; }, 150);
      this.phase = 'boss';
      this.bossStartT = this.t;
      this.bossStarted = false;
      this.hud.toast(B.intro || `${B.name} rises!`, 2400);
    }
  }

  onBossDead() {
    this.bossDeadT = true;
    this.collectAll = true;           // the boss's XP and its summons' all come to you
    this.bossWon = true;
    this.bossTime = this.t - (this.bossStartT ?? this.t);
    juice.shake(1); juice.hitstop(0.25); sfx.boom();
    const c = this.boss.center();
    this.fx.puff(c, 0x5a4030, 0.12, 0.8);
    this.xpDrops.drop(c, 1, 30);
    for (const e of this.enemies.list) if (!e.dead && !e.proxy) this.enemies.kill(e, true);
    this.hud.toast(`${this.stage.boss.name} is cleared!`, 2200);
    this.later(() => this.metamorph(), 2200);
  }

  metamorph() {
    this.phase = 'metamorph';
    if (!this.dev) markPlayed();      // a run ended: the player isn't new any more (first-run.js)
    this.bossDeadT = false;
    // whatever XP hadn't reached you yet still counts
    const left = this.xpDrops.list.reduce((n, d) => n + d.value, 0);
    this.xpDrops.clear();
    this.collectAll = false;
    if (left) this.gainXp(left);
    this.hud.setBoss(null);
    if (document.pointerLockElement) document.exitPointerLock();
    const choices = shuffle([...EVOLUTIONS]).slice(0, 3);
    this.ui.choose('Metamorphosis!', `${this.stage.evolve || 'Your polyp becomes an <b>Ephyra</b>, a baby jellyfish.'} Choose how it grows.`, choices, (evo) => {
      evo.apply(this.stats);
      this.health = this.stats.health;
      this.phase = 'won';
      const next = STAGES[this.stage.id];         // the act after this one, if there is one
      // the Boss reward: a Legendary pick (always with an element you don't have), before moving on
      if (next) this.pickLegendary('👑 A Legendary treasure', `${this.stage.boss.name} is beaten. Take a Legendary treasure into act ${next.id}.`, () => this.actComplete(next));
      else this.endRun(`Act ${this.stage.id} complete`, 'The hallway and the bathroom are yours. The bedroom (act 3) is coming soon.', 'Play again from act 1');
    });
  }

  // A delayed step (real time, ms) that only happens if this run is still the one being played:
  // restart quickly after dying and the old death screen won't land on the new run
  later(fn, ms) {
    const id = this.runId;
    setTimeout(() => { if (this.runId === id) fn(); }, ms);
  }

  die() {
    if (this.phase === 'dead') return;
    this.phase = 'dead';
    if (!this.dev) markPlayed();
    this.health = 0;
    if (document.pointerLockElement) document.exitPointerLock();
    this.hud.setBoss(null);
    this.later(() => this.endRun('You dried out', 'But an immortal jelly never really dies. It shrinks back into a polyp… and tries again.', 'Try again'), 700);
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
    const entry = { score, body: this.playerBody?.() || 'nettle', level: this.level, kills: this.kills, time: Math.round(this.t), won: this.bossWon, build: (typeof window !== 'undefined' && window.JF_BUILD) || '' };
    const B = this.board;
    const best = B ? B.keepBest(entry) : false;    // your best in this browser, posted or not
    let typed = savedName();
    // result: what came of a Submit (null until you submit)
    const show = (result) => {
      this.endView = 'summary';
      const said = !result ? '' : result.posted ? ' <small>· on the leaderboard</small>'
        : { lower: ' <small>· not posted: your best on the board is higher</small>', readonly: ' <small>· view-only here, not posted</small>' }[result.why] || ' <small>· couldn\'t post, try again</small>';
      const rows = [['Score', `<span class="jf-score">${score.toLocaleString()}</span>${best ? ' <small>new best!</small>' : ''}${said}`], ...this.summary()];
      const canPost = B && B.status !== 'offline' && !result?.posted && !['readonly', 'lower', 'sending'].includes(result?.why);
      // your name for the board: whatever you typed last time, or Guest if you leave it empty
      if (canPost) rows.push(['Name', `<input name="player" class="jf-name" maxlength="20" placeholder="Guest" autocomplete="nickname" value="${escAttr(typed)}">`]);
      const buttons = [];
      if (canPost) {
        buttons.push({ label: '📤 Submit score', go: true, onClick: (v) => {
          typed = (v.player || '').trim().slice(0, 20);
          saveName(typed);
          show({ posted: false, why: 'sending' });
          B.post({ ...entry, name: typed || 'Guest' }).then((r) => { this.lastPost = r; if (this.endView === 'summary') show(r); });
        } });
      }
      // a run always starts over from act 1
      buttons.push({ label: again, go: !canPost, onClick: () => { if (this.stage.id > 1) goToAct(1); else { this.start(); this.resume(); } } });
      if (B) buttons.push({ label: '🏆 Leaderboard', onClick: () => this.showBoard(() => show(result)) });
      if (this.onMainMenu) buttons.push({ label: '🏠 Main menu', onClick: () => this.onMainMenu() });
      this.ui.message(title, result?.why === 'sending' ? 'Sending your score…' : sub, rows, buttons);
    };
    show(null);
  }

  // What the run takes into the next act (stages.js; Run.start reads it back as this.carry)
  carryOver() {
    return {
      score: this.score(), stats: this.stats, level: this.level, xp: this.xp, purse: this.purse,
      owned: [...this.owned].map((id) => [id, this.owned.count(id)]), grown: this.grown, growCount: this.growCount, growTotal: this.growTotal,
      chestsOpened: this.chestsOpened, saved: this.saved,
    };
  }

  // An act beaten with another to come: the run moves on with everything it has (level, stats,
  // treasures, score so far); you submit the score at the end of the run
  actComplete(next) {
    const carry = this.carryOver(), score = carry.score;
    this.ui.message(`Act ${this.stage.id} complete`, `${this.stage.subtitle} is yours. Next: act ${next.id}, ${next.subtitle.toLowerCase()}. Your level, stats and treasures come with you.`,
      [['Score so far', `<span class="jf-score">${score.toLocaleString()}</span>`], ...this.summary()],
      [{ label: `On to act ${next.id} →`, go: true, onClick: () => goToAct(next.id, carry, { continue: true }) }]);   // straight into it, no main menu
  }

  // The leaderboard as a dialog; back() returns to where it was opened from
  showBoard(back) {
    const B = this.board;
    this.endView = 'board';
    const draw = () => {
      if (this.endView !== 'board') return;
      this.ui.message('🏆 Leaderboard', B.note(), B.table(), [{ label: 'Back', go: true, onClick: () => { B.onChange = null; back(); } }]);
    };
    draw();
    B.onChange = draw;                  // redraw as the scores come in (and when someone else posts)
    B.ready.then(() => B.refresh());
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
    if (this.phase === 'boss' && this.boss && !this.boss.dead) return { song: 'machinery', intensity: 0.62 + 0.45 * (1 - this.boss.hp / this.boss.maxHp), suck: this.boss.state === 'suction' || (this.boss.state === 'flood' && this.boss.plugged) };
    return { song: null, intensity: 0 };
  }

  // ------------------------------------------------------------ HUD
  refreshHud() {
    this.hud.showMap(this.firstRun.mapShown);   // a first run: hidden until the first Treasure (first-run.js)
    const h = this.hud;
    h.setHealth(this.health, this.S.health);
    h.setXp(this.level, this.xp, xpToNext(this.level), this.purse);
    h.setItems([...this.owned].map((id) => { const t = TREASURES.find((x) => x.id === id), n = this.owned.count(id); return n > 1 ? { ...t, icon: `${t.icon}<sub>×${n}</sub>` } : t; }));
    const [c0, c1] = this.stage.clock;
    const mins = c0 + (c1 - c0) * Math.min(1, this.t / this.duration);
    const hh = Math.floor(mins / 60), mm = Math.floor(mins % 60);
    const left = Math.max(0, Math.ceil(this.duration - this.t));
    // big: how long until the boss; small: the night's clock and who's coming
    const clock = `${hh === 0 ? 12 : hh}:${String(mm).padStart(2, '0')} AM`;
    const exploring = this.phase === 'explore';
    h.setClock(exploring ? `Boss in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : clock, exploring && left <= 20);
    h.setStage(this.duel ? `Dev: 1 on 1 with ${this.duel.name} · pause to pick another` : exploring ? `${clock} · ${this.stage.boss.name}` : '');
  }

  markers() {
    const out = [];
    for (const e of this.enemies.list) if (!e.dead && !e.proxy) out.push({ kind: 'enemy', x: e.pos.x, y: e.pos.y, z: e.pos.z });
    if (this.phase === 'explore') for (const t of this.roomTreasures) if (t.active) out.push({ kind: 'treasure', x: t.pos.x, y: t.pos.y, z: t.pos.z, color: '#ffc93a', big: true });
    if (this.phase === 'explore') for (const e of this.elites.alive) out.push({ x: e.base.x, y: e.base.y, z: e.base.z, color: '#ff8a3a' });
    if (this.phase === 'boss' && this.boss && !this.boss.dead) { const p = this.boss.position; out.push({ x: p.x, y: p.y, z: p.z, color: '#ff4a4a', big: true }); }
    return out;
  }
}

// The name you put on the leaderboard, kept in this browser for next time ('' = Guest)
const NAME_KEY = 'jellyfight.name';
function savedName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }
function saveName(n) { try { localStorage.setItem(NAME_KEY, n); } catch {} }
const escAttr = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
