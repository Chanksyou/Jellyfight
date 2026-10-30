// One run of stage 1: grow until the timer runs out (grabbing treasures that turn up in the room and
// the ones elites drop), then beat the stage's boss and evolve.
import * as THREE from 'three';
import { addForceField, showForceField } from './forcefield.js';
import { BASE_STATS, rollCards, rollTreasures, treasureTier, applyCard, xpToNext, TREASURES, EVOLUTIONS, ELEMENT_TREASURES, ELEMENT_UPGRADES, MAX_BUBBLES, MAX_DODGE, MAX_TENTACLES, STAT_INFO, CHEST_WEIGHTS } from './stats.js';
import { inPoly } from './hud.js';
import { STAGES, forgetRun, goToAct, keepRun } from './stages.js';
import { Vacuum } from './vacuum.js';
import { Clog } from './clog.js';
import { Shark } from './shark.js';
import { Encore } from './encore.js';
import { TYPES } from './enemies.js';
import { CONTENT, compileMods, isRemoved } from './content.js';
import { NEST } from './critters.js';
import { Gadgets } from './gadgets.js';
import { Adornments } from './adornments.js';
import { EnergyShield } from './energy-shield.js';
import { Mirage } from './mirage.js';
import { FireTrail } from './fire-trail.js';
import { EvolutionReveal } from './evolution-reveal.js';
import { Victory } from './victory.js';
import { addFeats, unlockedAwards, nextAward, needText, needShort, requirement, feats, addPearls, bank, pearlsFor, PEARLS } from './cosmetics.js';
import { discover, isFound, found } from './collection.js';
import { OPTIONS } from './character.js';
import { LOOK } from './look.js';
import { meshesNamed } from './traversal.js';
import { BossSet } from './boss-set.js';
import { Elites, ELITE_NAMES } from './elites.js';
import { Bubbles } from './bubbles.js';
import { RoomTreasure, XpDrops } from './pickups.js';
import { FirstRun, markPlayed } from './first-run.js';
import { juice } from './juice.js';
import { sfx, calm } from './sfx.js';
import { bus, PLAYER } from './events.js';
import { FRIENDLY as friendlyColor } from './vfx.js';
import { esc } from './leaderboard.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const _drop = new THREE.Vector3(), p0 = new THREE.Vector3(), _mid = new THREE.Vector3(), _bug = new THREE.Vector3();
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Standing this far (m) above the act's floor counts as high ground (a `while` treasure): furniture,
// not a rug or a threshold
const ROOTED = 1;          // seconds standing still on the ground before a `while "rooted"` holds

// The treasures you own; counts changes so the combined effects are rebuilt only when needed
// The treasures you own: a set of ids that also counts copies of stackable ones (stack=N)
class Owned extends Set {
  add(v) { super.add(v); (this.n ||= new Map()).set(v, this.count(v) + 1); this.version = (this.version || 0) + 1; return this; }
  delete(v) { const r = super.delete(v); this.n?.delete(v); this.version = (this.version || 0) + 1; return r; }
  remove(v) { if (this.count(v) > 1) { this.n.set(v, this.count(v) - 1); this.version++; } else this.delete(v); }   // one copy (or level) fewer
  clear() { super.clear(); this.n?.clear(); this.version = (this.version || 0) + 1; }
  count(v) { return this.n?.get(v) || 0; }
}

// Where a wasp nest hanging at `spot` (stage.nests) has its middle: out from the surface by its
// widest radius, so its side rests against it, and half its height below where its top meets it
// (`r`: the nest's size, content/enemies.kdl)
export function nestMiddle(spot, r) {
  const [x, y, z] = spot.at, [ox, oz] = spot.out, k = NEST.width * r * 0.98;
  return new THREE.Vector3(x + ox * k, y - NEST.height / 2 * r, z + oz * k);
}

// The boss classes, by the kind a stage's boss block names (the Clog is 'hair')
export const BOSSES = { vacuum: Vacuum, hair: Clog, shark: Shark, encore: Encore };
// the boss a stage's boss block names (B.kind), built for its arena; an unknown kind is a mistake in
// the stage file, not a reason to fight some other boss. ctx: what an arena boss needs (encore.js:
// the built arena, the song it plays to, the act's toughness for what it calls)
export function makeBoss(B, scene, enemies, fx, world, ctx = {}) {
  const Boss = BOSSES[B.kind];
  if (!Boss) throw new Error(`no boss of kind "${B.kind}" (${B.name}): the kinds are ${Object.keys(BOSSES).join(', ')} (run.js BOSSES)`);
  return new Boss(scene, enemies, fx, B, world, ctx);
}

export class Run {
  // ctx: { scene, stage, plan, world, player, cfg, enemies, lash, xpDrops, traversal, hud, ui, fx, tpc, input, setNight }
  constructor(ctx) {
    Object.assign(this, ctx);
    this.gadgets = new Gadgets(ctx.scene, ctx.enemies, ctx.fx, ctx.world);
    this.bubbles = new Bubbles(ctx.scene, ctx.enemies, ctx.fx, ctx.world);
    this.bubbles.treasureLooks=this.gadgets.looks;
    this.enemies.treasureLooks=this.gadgets.looks;
    this.bubbles.grace = this.cfg.radius;
    // treasures waiting in the room as golden chests: on a schedule (stage.treasures) and where elites fall
    this.roomTreasures = [new RoomTreasure(ctx.scene, ctx.fx)];
    this.friendly = friendlyColor().getHex();   // look.css --friendly: reflect and death-save flashes
    // a soft cool ring under the jelly that fades in while bugs crowd it, so you can always find yourself
    this.crowdRing = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: this.friendly, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.crowdRing.renderOrder = 3; this.crowdRing.visible = false;
    ctx.scene.add(this.crowdRing);
    this.energyShield = new EnergyShield(this);
    this.mirage = new Mirage(this);
    this.fireTrail = new FireTrail(this);
    this.evolutionReveal = new EvolutionReveal(this);
    this.victory = new Victory(this);   // the ending, after the last act's boss (victory.js)
    this.crumbs = new XpDrops(ctx.scene, ctx.world, 'health-crumb');   // Health crumbs bugs drop (crumb-on-kill)
    this.adorn = new Adornments(ctx.scene, ctx.player, ctx.cfg);          // what evolutions add to the jelly's look
    this.bubbles.onBlow = () => { this.player.avatar?.pulse?.(0.6); sfx.blow(); sfx.whiz(); };   // the bell squeezes as it blows
    this.lash.onLash = () => this.player.avatar?.pulse?.(0.3);   // and twitches as its tentacles whip out
    this.bubbles.onWindCharge = k => this.player.avatar?.pulse?.(0.15 + k * 0.55);
    this.bubbles.onWindRelease = () => this.player.avatar?.pulse?.(1);
    this.bubbles.onElementRelease = () => this.player.avatar?.pulse?.(0.75);   // the bell squeezes as an element shot leaves
    this.elites = new Elites(ctx.scene, ctx.enemies, ctx.fx, ctx.world, ctx.tpc.camera, ctx.apartment);
    this.elites.hpScale = this.stage.eliteHp || 1;
    this.elites.decorSpecs = this.stage.decor || [];   // what only hangs there in this act (the hall clock)
    // the room rearranged for the fight (boss-set.js: act 2's widened tub)
    this.bossSet = new BossSet(ctx.scene, ctx.world, ctx.stage.boss.set);
    // low invisible walls around the boss arena, solid only during the fight
    this.bossWalls = (ctx.stage.boss.walls || []).map((w) => {
      const size = w.max.map((v, i) => v - w.min[i]);
      const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
      m.position.set(...w.min.map((v, i) => v + size[i] / 2));
      m.visible = false;
      m.updateMatrixWorld();
      ctx.world.addCollider(m);
      // and what you see of it: up only while the fight is (forcefield.js)
      const field = addForceField(ctx.scene, w, { hidden: !ctx.stage.boss.forceField && !LOOK.num('boss-force-field', 0) });   // invisible unless the stage draws it: the camera can stand behind it
      if (field) { showForceField(field, false); m.userData.field = field; }
      return m;
    });
    this.rooms = ctx.plan;
    this.fade = document.createElement('div');
    this.fade.style.cssText = 'position:fixed;inset:0;background:radial-gradient(#fffbe8,#cfe2ff);opacity:0;pointer-events:none;z-index:20;transition:opacity .5s';
    document.body.appendChild(this.fade);

    // The run owns the jelly's health, slow and knockback, and what kills are worth
    bus.on('damage_taken', ({ targetId, amount, drain, from, contact, knock, at }) => {
      if (targetId !== PLAYER) return;
      amount *= this.stage.power || 1;       // later acts hit harder (stage files)
      if (drain) this.hurt(amount, true);   // puddles and suction: no i-frames, no flinch
      else this.hit(amount, from, contact, knock, at); // i-frames, dodge, the on-hurt treasures (Rubber Duck, when-hit)
    });
    // slow: you swim `strength` slower (0.4 unless it says; an Aerial root's hold is 0.5)
    bus.on('status_applied', ({ targetId, status, duration, strength }) => {
      if (targetId === PLAYER && status === 'slow' && strength == null) this.slowT = Math.max(this.slowT, duration);
      else if (targetId === PLAYER && status === 'slow') {
        this.slowK = this.slowHardT > 0 ? Math.max(this.slowK, strength) : strength;
        this.slowHardT = Math.max(this.slowHardT, duration);
      }
      if (targetId === PLAYER && status === 'slip') this.slipT = Math.max(this.slipT, duration);   // soap underfoot: you slide
      // bleed (a mosquito's bite): `strength` Health a second for `duration` s; every bleed runs on its own, so they stack
      if (targetId === PLAYER && status === 'bleed' && this.phase !== 'dead') {
        this.bleeds.push({ t: duration, dps: strength ?? 1 });
        const P = this.player.position;
        this.fx.number(P.clone().setY(P.y + this.cfg.height * 1.1), 'BLEED', LOOK.color('bleed', '#ff2a4a'), 13);
      }
    });
    bus.on('knockback', ({ targetId, dir, force, launch }) => {
      if (targetId !== PLAYER) return;
      this.shovedAt = this.frame; this.hitPush = null;   // an attack that shoves you itself takes the place of the hit's pushback
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
    this.player.onAirJump=()=>{this.gadgets.looks.spring(this.player.position);this.gadgets.looks.arc(this.player.position,.035);sfx.gadgetSpring();};
    // a jump's takeoff: a ring of water pushed out under the bell, a pop of bubbles, a bloop
    this.player.onJump = () => {
      const P = this.player.position, r = this.cfg.radius, c = LOOK.color('jump-splash', '#cfefff');
      this.fx.ring(_drop.set(P.x, P.y + 0.002, P.z), c, r * LOOK.num('jump-ring', 2.2), 0.28);
      this.fx.burst(_drop.set(P.x, P.y + r * 0.3, P.z), [c, '#ffffff'], 5, r * 0.09, 0.22, P.y);
      sfx.jump();
    };
    this.player.onLand = (drop) => {
      // the landing: a splash ring and droplets, bigger and louder the further it fell (not a step down)
      if (drop > LOOK.num('land-splash-from', 0.04)) {
        const P = this.player.position, r = this.cfg.radius, k = Math.min(1, drop / 0.3), c = LOOK.color('jump-splash', '#cfefff');
        this.fx.ring(_drop.set(P.x, P.y + 0.002, P.z), c, r * (1.8 + 1.8 * k), 0.3 + 0.15 * k);
        this.fx.burst(_drop.set(P.x, P.y + r * 0.2, P.z), [c, '#ffffff', '#9fd8ff'], Math.round(4 + 8 * k), r * 0.1, 0.18 + 0.2 * k, P.y);
        sfx.land(k);
      }
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
    this.evolutionReveal.cancel();
    this.victory.cancel();
    const s = this.stage;
    this.duel = null;                 // dev: one on one with a single enemy (startDuel)
    calm();                           // a balloon's deep sound doesn't outlast the run
    this.enemies.clear();
    this.elites?.start((this.stage.elites || []).filter((s) => !isRemoved('elite', s.kind)));   // an elite the dev editor removed doesn't spawn (duels, which pick one on purpose, still can)
    // the act's wasp nests hang from the start, or from `nests.from` seconds in (spawnWaves)
    this.nestsAt = this.stage.nests?.from > 0 ? this.stage.nests.from : null;
    if (this.nestsAt == null) this.spawnNests();
    this.roomTreasures?.forEach((t) => t.hide());
    this.treasureTimesLeft = [...(this.stage.treasures?.at || [])];   // seconds into the night each scheduled treasure appears
    this.bonusTreasureAt = new Set();                                  // which of those a Wind-Up Key added (they don't bring more)
    this.lastTreasureSpot = null;
    this.recentTreasureSpots = [];   // the last few spots, so each one turns up somewhere new
    this.xpDrops.clear();
    this.xpChain = this.xpChainT = this.xpFeedbackT = 0;
    this.hud.resetXp();
    this.crumbs?.clear();
    this.fx.clear();
    this.lash.reset();
    this.energyShield.reset();
    this.mirage.reset();
    this.fireTrail.reset();
    juice.reset();
    this.bubbles.reset();
    this.gadgets.reset();
    this.boss?.dispose();
    this.boss = null;
    this.traversal.bossMode = false;
    this.bossWalls.forEach((m) => { m.visible = false; if (m.userData.field) showForceField(m.userData.field, false); });
    this.bossSet.apply(false);
    this.hud.setBoss(null);
    this.hud.setElite(null);
    this.hud.resetHealth(); this.healthPulse = false;
    this.ui.close();
    this.fade.style.opacity = 0;

    this.phase = 'explore';
    this.t = 0;
    this.hitPush = null; this.frame = 0; this.shovedAt = -1;
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
    this.featKills = 0;               // of those, already added to the lifetime totals (cosmetics.js)
    this.eliteBugs = 0;               // golden elite bugs cleared (score)
    this.elitesBeaten = 0;            // high-ground elites beaten (score)
    this.bossStartT = null;
    this.bossWon = false;
    this.bossDeadT = false;           // a death left over from a restarted run would keep this boss from ending
    this.collectAll = false;
    this.runId = (this.runId || 0) + 1;    // delayed steps (later()) belong to this run only
    this.pendingLevels = 0;
    this.iFrames = 0;
    this.slowT = 0;
    this.slowHardT = this.slowK = 0;    // a slow with its own strength
    this.slipT = 0;
    this.bleeds = [];                 // bleeds running on the jelly (status 'bleed'): { t, dps }
    this.bleedDripT = 0;
    this.stillT = 0;
    this.dashT = 0; this.dashK = 0;  // dash: a burst of speed (Moon Jelly)
    this.polypT = 0;                  // rebirth: seconds left as a polyp (Immortal Jelly)
    this.rebornThisAct = false;       // rebirth is once an act: a later act starts fresh
    this.rerolls = 1;                 // level-up card rerolls: one an act, a later act starts fresh
    this.devCalm = false; this.devGod = false;   // dev test kit (test-kit.js): no waves, can't die
    this.player.avatar?.root.scale.setScalar(1);
    this.squeakCd = []; this.hurtCd = {};
    this.mirrorUntil = 0;
    this.reflectAt = 0;               // when a reflect treasure is ready again (seconds into the night)
    this.saved = false;               // the run's one death-save is spent
    this.grown = {}; this.growCount = {}; this.growTotal = {};
    this.chestsOpened = 0;            // treasure chests opened this run (every 3rd offers an Element upgrade)
    this.evolved = [];                // evolutions taken (content/evolutions.kdl), one per act's boss
    this.newFinds = [];               // first-ever finds this run, for the end screen (collection.js)
    this.pearls = 0;                  // Pearls this run has earned (cosmetics.js), already in the bank
    this.awardsBefore = this.dev ? [] : unlockedAwards();   // golden awards held when the run began: the end screen names the new ones
    this.bossHurt = false;            // lost Health in this act's boss fight (the Diamond tiara asks for a fight without)
    // a later act: the run carries on from the act before (main.js gives it: stages.js)
    const C = this.carry;
    if (C) {
      this.stats = { ...BASE_STATS, ...C.stats };
      this.level = C.level; this.xp = C.xp; this.purse = C.purse;
      for (const [id, n] of C.owned) for (let k = 0; k < n; k++) this.owned.add(id);
      this.grown = { ...C.grown }; this.growCount = { ...C.growCount }; this.growTotal = { ...C.growTotal };
      this.chestsOpened = C.chestsOpened || 0;
      this.evolved = [...(C.evolved || [])];
      this.newFinds = [...(C.newFinds || [])];
      this.pearls = C.pearls || 0;
      if (C.awardsBefore) this.awardsBefore = C.awardsBefore;
      this.saved = !!C.saved;
      this.health = this.S.health;   // with what its evolution and treasures add
      this.startPicked = true;        // you already have your treasures
    }
    this.spawnAcc = 0;
    this.bursts = [];
    this.nightT = 0;

    const start = new THREE.Vector3(...s.start);
    this.world.focus(start, 1);
    this.player.spawn(start);
    this.player.snapToGround();
    this.tpc.endFight();
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
    this.adorn.update(0, this);       // reset evolution visuals even when the main menu pauses the run
    this.energyShield.update(0);
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
    // while: conditionals, true right now or not (the jelly in the air, or low on Health)
    const whiles = this.mods.whiles;
    if (whiles.length) {
      const P = this.player, air = !P.grounded && !P.climbing, rooted = this.stillT >= ROOTED;
      for (const c of whiles) if (c.when === 'airborne' ? air : c.when === 'rooted' ? rooted : this.health < S.health * c.under) S[c.stat] += c.percent ? BASE_STATS[c.stat] * c.amount / 100 : c.amount;
    }
    // per: converters read the stats above (not each other's results), so the order doesn't matter
    const per = this.mods.per;
    if (per.length) {
      const was = (this._perAt ||= {}); was.health = S.health; was.moveSpeed = S.moveSpeed;
      for (const c of per) S[c.stat] += (this.perSource(c.of, was) / c.every) * c.amount * (c.percent ? BASE_STATS[c.stat] / 100 : 1);
    }
    S.bubbles = Math.max(1, Math.min(MAX_BUBBLES, Math.round(S.bubbles)));
    S.dodge = Math.min(MAX_DODGE, Math.max(0, S.dodge));
    S.tentacles = Math.max(1, Math.min(MAX_TENTACLES, Math.round(S.tentacles)));
    if (this.mods.noRegen) S.regen = 0;                           // no-regen (Immortal Jelly)
    if (this.dashT > 0) S.moveSpeed += BASE_STATS.moveSpeed * this.dashK;   // dash (Moon Jelly's pulse)
    return S;
  }

  // what a per converter counts (`of`), read from stats S
  perSource(of, S) {
    return of === 'max-health' ? S.health : of === 'move-speed-bonus' ? Math.max(0, (S.moveSpeed / BASE_STATS.moveSpeed - 1) * 100) : of === 'levels' ? this.level - 1 : this.chestsOpened || 0;
  }

  get power() { return this.S.bubbleDamage * 1.8; }   // gadgets and treasures: pop 6 -> 10.8, as before the slower, harder stream
  // The tentacles' stats, with their treasures applied
  // The combined effects of your treasures (content/treasures.kdl, src/words.js): every system
  // reads these, never treasure ids
  get mods() {
    if (this._modsOf !== this.owned || this._modsV !== this.owned.version || this._modsE !== (this.evolved?.length || 0)) {
      this._mods = compileMods(this.owned, this.evolved || []);
      this._modsOf = this.owned;
      this._modsV = this.owned.version;
      this._modsE = this.evolved?.length || 0;
    }
    return this._mods;
  }

  get tentacleStats() {
    const s = this.S;   // treasures can raise all four (stat, per)
    return { tentacles: s.tentacles, reach: s.reach, tentacleDamage: s.tentacleDamage, tentacleSpeed: s.tentacleSpeed };
  }
  // seconds until the boss comes (treasures can make the night longer)
  get duration() { return this.stage.duration; }
  // how far through the night (0..1); an act with no night (duration 0, act 4) is straight into its fight
  get night() { return this.duration ? Math.min(1, this.t / this.duration) : 1; }

  // ------------------------------------------------------------ main update
  update(dt) {
    // a hit's pushback waits a frame: if its attack sent a knockback of its own (before or after the damage), that one stands
    if (this.hitPush) { const { dir, force } = this.hitPush; this.hitPush = null; bus.emit('knockback', { targetId: PLAYER, dir, force }); }
    this.frame++;
    this.adorn.update(dt, this);      // evolutions' pieces on the jelly, in every phase
    this.mirage.update(0);
    this.fireTrail.update(dt);
    this.energyShield.update(this.phase === 'explore' || this.phase === 'boss' ? dt : 0);
    if (this.phase === 'dead' || this.phase === 'won' || this.phase === 'metamorph') { this.touchAction = null; return; }
    // every run starts with an Element: pick 1 of 3 before anything happens (on a player's first
    // run it waits for the first Level-up instead: first-run.js)
    if (!this.startPicked && this.phase === 'explore') {
      this.startPicked = true;
      if (this.firstRun.startElementPick) { this.pickStartElement(); return; }
    }
    this.t += dt;
    const P = this.player, s = this.S;
    this.crowdCue(dt);

    // --- movement, with vents, fabric, the drain's pull and an elite's (the Coffer's tongue: elites.pull,
    // set as it updated last frame)
    const tr = this.traversal.query(P.position);
    let push = null;
    if (this.phase === 'boss' && this.boss) {
      push = this.boss.update(dt, P).push;
      if (this.boss.dead && !this.bossDeadT) this.onBossDead();
    } else if (this.phase === 'explore') push = this.elites.pull;
    if (this.phase !== 'intro') {
      this.world.focus(P.position, dt);
      P.update(dt, this.input, this.tpc.yaw, {
        speedMul: s.moveSpeed, jumpMul: s.jumpHeight, vent: this.phase === 'explore' ? tr.vent : null, climb: !!tr.climb,
        airJumps: this.mods.extraJumps,       // no mid-air jump until Pen Spring
        slow: Math.max(this.slowT > 0 ? 0.4 : 0, this.slowHardT > 0 ? this.slowK : 0), push,
        slip: this.slipT > 0 ? 1 : 0,
        onWalk: this.fireTrail.config ? this.fireTrail.onWalk : null,
      });
      if (this.phase === 'boss' && this.boss) this.keepInArena(P);
    }

    // --- timers
    this.fireTrail.draw();
    this.iFrames = Math.max(0, this.iFrames - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.slowHardT = Math.max(0, this.slowHardT - dt);
    this.dashT = Math.max(0, (this.dashT || 0) - dt);
    this.stillT = P.speed < 0.02 && P.grounded ? this.stillT + dt : 0;   // standing still (spout, rooted)
    if (this.polypT > 0 && (this.polypT -= dt) <= 0) this.bloom();       // rebirth: back from a polyp
    this.slipT = Math.max(0, this.slipT - dt);
    if (this.bleeds.length) this.bleed(dt);
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
      this.setNight(c0 + (c1 - c0) * this.night);
    }

    // --- attacks and enemies
    const origin = P.position.clone().setY(P.position.y + this.cfg.height * 0.45);
    this.mirage.update(dt);
    if (this.phase === 'explore' || this.phase === 'boss') {
      const polyp = this.polypT > 0;     // rebirth: a polyp can't attack
      // main attack: bubbles, blown from the top of the bell
      this.bubbles.update(dt, P.position.clone().setY(P.position.y + this.cfg.height * 0.75), s, this.mods, polyp);
      // close-range sting: tentacles, improved only by treasures
      if (!polyp) this.lash.update(dt, origin, this.tentacleStats, this.mods.hits.tentacles, {});
      else this.lash.animate(dt, origin);
      if (!polyp) this.gadgets.update(dt, { mods: this.mods, feet: P.position, center: origin, facing: P.facing, power: this.power, radius: this.cfg.radius,
        pulse: (k) => P.avatar?.pulse(k),
        mirrorReady: this.t>=this.reflectAt, mirrorActive: this.t<this.mirrorUntil&&this.iFrames>0,
        steaming: this.mods.whiles.some((c) => c.when === 'low-health' && this.health < this.S.health * c.under),
        dropXp: (n) => this.xpDrops.drop(P.position.clone().setY(P.position.y + 0.01), 1, n), bubbleRing: (n, k) => this.bubbles.ring(origin, n, this.S.bubbleDamage * k, this.S, this.mods),
        dash: (k, time) => { this.dashK = k; this.dashT = time; } });
      if (this.phase === 'explore') {
        this.elites.update(dt, P, this.cfg);
        // the elite fighting you (the closest awake one): its name and health on the HUD
        const fe = this.elites.list.filter((e) => !e.dead && !e.decor && !e.beaten && (e.awake || e.state !== 'idle'))
          .sort((a, b) => a.base.distanceTo(P.position) - b.base.distanceTo(P.position))[0];
        this.hud.setElite(fe ? fe.name : null, fe ? fe.hp / fe.maxHp : 0);
      } else this.hud.setElite(null);
      this.enemies.pace = this.mods.bugSpeed;
      this.enemies.eliteDamage = this.mods.eliteDamage;
      this.enemies.update(dt, { position: P.position, height: this.cfg.height, radius: this.cfg.radius, grounded: P.grounded }, this.t, this.mirage.target);
      this.contactDamage();
      this.enemies.shotHits(_mid.copy(P.position).setY(P.position.y + this.cfg.height * 0.5), this.cfg.radius);
    }
    for (const b of this.bursts.splice(0)) this.burst(b);

    // --- treasure effects that tick here (timed and area ones run in gadgets.js)
    if (s.regen > 0 && this.phase !== 'intro') this.heal(s.regen * dt, true);   // health regen (cards, treasures)
    const spout = this.mods.spout;
    if (spout && this.stillT > spout.after) this.heal(spout.heal * dt, true);

    // --- XP
    if (this.collectAll) this.xpDrops.magnetAll = true;   // the boss is down: everything on the floor flies to you
    const got = this.xpDrops.update(dt, origin, this.mods.xpReach);
    this.xpChainT -= dt; this.xpFeedbackT -= dt;
    if (got) {
      this.gainXp(got);
      if (this.xpFeedbackT <= 0) {
        this.xpChain = this.xpChainT > 0 ? Math.min(10, this.xpChain + 1) : 0;
        this.xpFeedbackT = LOOK.num('xp-feedback-gap', 0.075);
        sfx.xp(this.xpChain, got >= 5);
        bus.emit('xp_collected', { amount: got, chain: this.xpChain });
        const big = got >= 5, quiet = juice.calm || this.fx.reducedMotion.matches;
        this.fx.glow.emit(origin, this.xpDrops.bigMat.color, LOOK.num('xp-collect-size', 0.012) * (big ? 1.5 : 1), 0, LOOK.num('xp-collect-life', 0.16), quiet ? 0.2 : 0.5);
      }
      this.xpChainT = LOOK.num('xp-chain-window', 0.65);
    }
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

  // ------------------------------------------------------------ dev: fight boss
  // Every act's boss, offered by the pause menu's Fight boss button: a fresh run (level 1,
  // no treasures) straight to its intro. Another act's boss reloads into that act first,
  // like a duel pick.
  bossChoices() {
    return STAGES.filter((st) => st.boss).map((st) => ({ name: `${st.boss.name} (boss, act ${st.id})`, act: st.id }));
  }

  startBossFight(pick) {
    if (pick.act !== this.stage.id) { goToAct(pick.act, null, { boss: pick.name }); return; }   // its arena is in another act
    this.start();
    this.devRun();
    this.startBossIntro();
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

  // the crowd ring: how many bugs are pressed round the jelly (flat, within --crowd-near), easing the
  // ring in from the 2nd and to full by the 5th
  crowdCue(dt) {
    const P = this.player.position, near = LOOK.num('crowd-near', 0.12), R = this.crowdRing;
    let n = 0;
    for (const e of this.enemies.list) if (!e.dead && !e.proxy && Math.abs(e.pos.y - P.y) < 0.1 && Math.hypot(e.pos.x - P.x, e.pos.z - P.z) < near) n++;
    const want = Math.min(1, Math.max(0, (n - 1) / 4)) * LOOK.num('crowd-ring', 0.5);
    R.material.opacity += (want - R.material.opacity) * (1 - Math.exp(-6 * dt));
    R.visible = R.material.opacity > 0.01;
    if (!R.visible) return;
    R.position.set(P.x, P.y + 0.003, P.z);
    R.scale.setScalar(this.cfg.radius * 2.3 * (1 + 0.05 * Math.sin(this.t * 6)));
  }

  // ------------------------------------------------------------ waves
  // How the night fills with bugs: content/waves.kdl
  spawnWaves(dt) {
    if (this.devCalm) return;         // dev test kit: waves off
    if (this.nestsAt != null && this.t >= this.nestsAt) { this.nestsAt = null; this.spawnNests(); }   // nests that come later in the night
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
    const pc = _mid.copy(P).setY(P.y + this.cfg.height * 0.5);
    for (const e of this.enemies.list) {
      if (e.dead || e.proxy || e.freezeT > 0) continue;     // frozen things can't hurt you
      if (e.airborne) continue;                             // mid-leap: its landing does the hurting (the leap word)
      if (!e.T.dmg) continue;                               // harmless to touch (an Aerial root: its hold does the hurting)
      const d = this.enemies.center(e, _bug).distanceTo(pc);
      if (d < (e.hitR || e.r) + this.cfg.radius) {
        // rolling bugs hit harder (a millipede's ball)
        bus.emit('damage_taken', { targetId: PLAYER, amount: e.state === 'dash' && e.T.rollDmg ? e.T.rollDmg : e.T.dmg, source: e.type, from: e.id, contact: true });
      }
    }
  }

  // from: the enemy id that dealt the hit, if one did (when-hit effects can answer it)
  hit(amount, from = null, contact = false, knock = false, at = null) {
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
      this.mirrorUntil=this.t+M.reflect.invuln;
      const P = this.player.position, at = P.clone().setY(P.y + this.cfg.height * 0.5);
      const R = M.reflect, power = this.power;
      this.gadgets.mirrorState(at,false,true);this.gadgets.mirrorBurst(at,P,R.burst);
      sfx.gadgetMirror(true);this.player.avatar?.pulse(.3);
      this.fx.number(at.clone().setY(at.y + 0.04), 'REFLECT', '#cfe8ff', 22);
      const e = from != null && this.enemies.list.find((x) => x.id === from && !x.dead);
      if (e) { this.gadgets.looks.streak(at,this.enemies.center(e),this.gadgets.looks.silver,.0025,.22);this.fx.impact(this.enemies.center(e), this.friendly, 0.025, 10); bus.emit('damage_taken', { targetId: e.id, amount: Math.max(amount, power * R.dmg), color: '#cfe8ff', source: 'reflect' }); }
      // the shockwave: everything close is hit and thrown back (the attacker already took its bounce)
      if (R.burst) for (const n of this.gadgets.near(at, R.burst)) {
        if (n === e) continue;
        if (R.burstDmg) bus.emit('damage_taken', { targetId: n.id, amount: power * R.burstDmg, color: '#cfe8ff', source: 'reflect' });
        if (R.push) bus.emit('knockback', { targetId: n.id, dir: n.pos.clone().sub(P).setY(0).normalize(), force: R.push });
        this.gadgets.looks.streak(at,this.enemies.center(n),this.gadgets.looks.silver,.0012,.16);
      }
      if (e && R.push) bus.emit('knockback', { targetId: e.id, dir: e.pos.clone().sub(P).setY(0).normalize(), force: R.push });
      return;
    }
    // squeak-when-hit effects (they stack), each on its own cooldown
    M.squeaks.forEach((Q, i) => {
      if ((this.squeakCd[i] || 0) > this.t) return;
      this.squeakCd[i] = this.t + Q.cooldown;
      const P = this.player.position;
      this.gadgets.looks.squeak(P,Q.radius);sfx.gadgetSqueak();
      this.fx.number(P.clone().setY(P.y + 0.05), 'SQUEAK', '#ffe066', 16);
      for (const e of this.enemies.list) {
        if (e.dead || e.proxy) continue;
        const away = e.pos.clone().sub(P).setY(0);
        const d = away.length();
        if (d > Q.radius) continue;
        if (Q.push) bus.emit('knockback', { targetId: e.id, dir: away.normalize(), force: Q.push });
        this.gadgets.looks.streak(this.enemies.center(e),this.enemies.center(e).addScaledVector(away,.018),this.gadgets.looks.duck,.001,.16);
        bus.emit('damage_taken', { targetId: e.id, amount: Q.dmg, color: '#ffe066', source: 'squeak' });
      }
    });
    // when-hit effects: a { ring, zap … } block on its own cooldown, aimed at whoever hit you
    for (const H of M.onHurt) {
      if ((this.hurtCd[H.key] || 0) > this.t) continue;
      this.hurtCd[H.key] = this.t + H.cooldown;
      const P = this.player.position, center = P.clone().setY(P.y + this.cfg.height * 0.5);
      const lash = (e, k) => this.lash.strike(center, e, this.S.tentacleDamage * k, this.mods.hits.tentacles);   // the lash word: a tentacle hits back
      const ctx = { feet: P, center, facing: this.player.facing, power: this.power, from, taken: amount, lash, pulse: (k) => this.player.avatar?.pulse(k) };
      for (const ef of H.effects) this.gadgets.fire(ef, ctx);
    }
    this.hurt(amount, false, from, contact, knock, at);
  }

  // bleeding: Health lost each second (no i-frames, no flinch), and drops of it dripping off the
  // jelly to the floor, faster the more bleeds are running, for exactly as long as it lasts
  bleed(dt) {
    let dps = 0;
    for (const b of this.bleeds) { const run = Math.min(dt, b.t); dps += b.dps * run / dt; b.t -= dt; }
    this.bleeds = this.bleeds.filter((b) => b.t > 0);
    if (dps > 0) bus.emit('damage_taken', { targetId: PLAYER, amount: dps * dt, source: 'bleed', drain: true });
    if ((this.bleedDripT -= dt) > 0) return;
    this.bleedDripT = LOOK.num('bleed-drip', 0.22) / Math.min(3, this.bleeds.length + 1);
    const P = this.player.position, c = LOOK.color('bleed', '#ff2a4a');
    this.fx.burst(_drop.set(P.x, P.y + this.cfg.height * 0.35, P.z), [c, c, '#ffffff'], 3, this.cfg.radius * LOOK.num('bleed-drop', 0.16), 0.12, P.y);
  }

  // at: where the hit landed or came from (a Shot, a Blast's middle), when the attack knows; else its attacker
  hurt(amount, silent = false, from = null, contact = false, knock = false, at = null) {
    if (this.polypT > 0) return;      // rebirth: nothing hurts a polyp (not even puddles and suction)
    if (this.phase === 'dead') return;
    amount = this.energyShield.absorb(amount, silent);
    if (amount <= 0) return;
    if (this.devGod) amount = Math.max(0, Math.min(amount, this.health - 1));   // dev test kit: can't die (hits still land, for treasures that react to them)
    this.health -= amount;
    if (this.phase === 'boss') this.bossHurt = true;
    const hint = amount > 0 && this.firstRun.hintOnHit();   // a first run's one line about Health (first-run.js)
    if (hint) { this.hint = hint; this.hintT = 4.5; }
    if (!silent && amount > 0) {
      juice.feel('hurt-minor'); sfx.hurt();
      // pushback away from what hit you (a bug, or the boss), harder the more it hurt; backwards if nothing says where from
      const attacker = from != null && this.enemies.list.find(e => e.id === from);
      const by = attacker ? this.enemies.center(attacker) : this.phase === 'boss' ? this.boss?.center?.() : null;
      const away = by ? this.player.position.clone().sub(by).setY(0) : new THREE.Vector3();
      const P = this.player.position, mid = _drop.set(P.x, P.y + this.cfg.height * 0.5, P.z);
      if (at || by) this.gadgets.looks.hurt(mid, at || by, this.cfg.radius);   // a red arc on the side it hit
      if (away.lengthSq() < 1e-8) away.set(-Math.sin(this.player.facing), 0, -Math.cos(this.player.facing));
      const H = this.cfg.hitPush;
      if (!knock && this.shovedAt !== this.frame) this.hitPush = { dir: away.normalize(), force: Math.min(H.max, H.base + H.perDamage * amount) };
      bus.emit('player_hurt', { amount, from, contact });   // the hit really landed: its attacker's feedback (enemies.js landed)
    }
    if (!silent) this.player.avatar?.land(1.5);
    // death-save: once per run, the last of your Health holds
    const D = this.mods.deathSave;
    if (this.health <= 0 && D && !this.saved && this.phase !== 'dead') {
      this.saved = true;
      this.health = this.S.health * D.health;
      this.healthPulse = true;
      this.iFrames = 1.5;
      const P = this.player.position;
      this.fx.ring(P.clone().setY(P.y + 0.004), this.friendly, 0.12, 0.6);
      this.fx.impact(P.clone().setY(P.y + this.cfg.height * 0.5), this.friendly, 0.05, 16);
      this.gadgets.looks.snooze(P.clone().setY(P.y+.008));sfx.gadgetSnooze();this.player.avatar?.pulse(.6);
      this.hud.toast('⏰ Snooze! Back up with half your Health.', 2400);
      return;
    }
    // rebirth (Immortal Jelly): once an act, back to a polyp instead, then bloom with full Health
    const R = this.mods.rebirth;
    if (this.health <= 0 && R && !this.rebornThisAct && this.phase !== 'dead') {
      this.rebornThisAct = true;
      this.health = 1;
      this.polypT = R.time;
      this.iFrames = R.time + 0.5;
      this.player.avatar?.root.scale.setScalar(0.45);
      const P = this.player.position;
      this.fx.ring(P.clone().setY(P.y + 0.004), this.friendly, 0.1, 0.8);
      this.hud.toast(`♾️ Back to a polyp… you bloom again in ${R.time} s.`, 2400);
      return;
    }
    if (this.health <= 0) this.die();
  }

  // rebirth's end: the polyp blooms back into a jelly with full Health
  bloom() {
    this.polypT = 0;
    this.health = this.S.health;
    this.healthPulse = true;
    this.iFrames = 1;
    this.player.avatar?.root.scale.setScalar(1);
    const P = this.player.position, c = P.clone().setY(P.y + this.cfg.height * 0.5);
    this.fx.ring(P.clone().setY(P.y + 0.004), this.friendly, 0.18, 0.7);
    this.fx.impact(c, this.friendly, 0.05, 18);
    this.hud.toast('♾️ You bloom again, whole.', 2000);
  }

  heal(amount, quiet = false) {
    const before = this.health;
    this.health = Math.min(this.S.health, this.health + amount);
    if (!quiet && this.health > before) this.healthPulse = true;
  }

  // an enemy_killed event: { pos, r, xp, elite }
  // The act's wasp nests (stage.nests): `count` of its spots, each a different one, get a nest
  // hanging there (nestMiddle). They're as tough as the act's bugs.
  spawnNests(stage = this.stage) {
    const N = stage.nests;
    if (!N?.spots?.length) return [];
    const T = CONTENT.enemies.nest, spots = [...N.spots].sort(() => Math.random() - 0.5).slice(0, N.count ?? 1);
    return spots.map((spot) => {
      const e = this.enemies.spawn('nest', nestMiddle(spot, T.r), stage.toughness ?? 1);
      e.root.rotation.y = Math.atan2(spot.out[0], spot.out[1]);
      e.spawnT = 1;                    // it's been there all along
      e.spot = spot;
      return e;
    });
  }

  onKill({ pos: c, r, xp: baseXp, elite, floor = c.y }) {
    this.kills++;
    const combo = juice.kill();
    if (combo % 10 === 0) { sfx.combo(combo); this.fx.number(c.clone().setY(c.y + r * 3), `${combo} COMBO!`, '#ffd23a', 22); }
    const xp = Math.round(baseXp * this.mods.xpMult * (this.stage.xpMult || 1) * juice.bonus);   // the act's own xpMult too
    if (xp > 0) {                     // some bugs are worth nothing (a nest's wasps)
      this.xpDrops.drop(c, 1, xp);
      this.fx.number(c.clone().setY(c.y + r * 1.5), `+${xp} XP`, '#ffe27a', elite ? 20 : 14);
    }
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
    if (this.mods.burstOnKill) {this.gadgets.looks.salt(c,this.mods.burstOnKill.radius,true);this.bursts.push(c);}
  }

  // One of the high-ground elites (elites.js) is beaten
  eliteDefeated(e) {
    this.kills++;
    this.elitesBeaten++;
    if (!this.dev) { addFeats({ elites: 1, [`elite_${e.kind}`]: 1 }); this.earn(PEARLS.elite); }
    this.found('elites', e.kind, e.name);
    juice.feel('elite-kill'); sfx.boom();
    this.xpDrops.drop(e.base.clone().setY(e.base.y + e.r), 1, 20);
    this.fx.number(e.base.clone().setY(e.base.y + e.r * 2.5), '+20 XP', '#ffe27a', 20);
    this.dropTreasure(e.base);
    this.hud.toast(`✨ ${e.name} is beaten! It left a treasure on the ${e.spec.area}.`, 2400);
  }

  // A ring of stinging (Bath Bomb, Cotton Ball)
  shockwave(c, radius, dmg, color) {
    this.gadgets.looks.cushion(c,radius);this.player.avatar?.pulse(.3);sfx.gadgetCotton();
    for (const e of this.enemies.list) {
      if (e.dead || e.proxy) continue;
      if (this.enemies.center(e).distanceTo(c) < radius + e.r) {this.gadgets.looks.contact(this.enemies.center(e),this.gadgets.looks.cotton,.008);bus.emit('damage_taken', { targetId: e.id, amount: dmg, color: '#ffd0ec', source: 'shockwave' });}
    }
  }

  burst(c) {
    const B = this.mods.burstOnKill;
    if (!B) return;
    this.gadgets.looks.salt(c,B.radius);sfx.gadgetSalt();
    for (const e of this.enemies.list) {
      if (e.dead || e.proxy) continue;
      if (this.enemies.center(e).distanceTo(c) < B.radius + e.r) {this.gadgets.looks.contact(this.enemies.center(e),this.gadgets.looks.silver,.006);bus.emit('damage_taken', { targetId: e.id, amount: this.power * B.dmg, color: '#bfe8ff', source: 'burst' });}
    }
  }

  // ------------------------------------------------------------ growth
  gainXp(n) {
    this.purse += n;
    this.xp += n * this.firstRun.xpMul;   // a first run's first Level-up comes sooner (first-run.js)
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
    // the ding: a gold ring leaves the jelly and the badge pops while the cards wait a beat (ui.js),
    // and the picked card's icon flies into the badge
    const at = this.player.position.clone().setY(this.player.position.y + this.cfg.height * 0.5).project(this.tpc.camera);
    this.hud.levelDing((at.x + 1) / 2 * innerWidth, (1 - at.y) / 2 * innerHeight);
    this.ui.levelUp(this.level - this.pendingLevels, rollCards(this.stats, 3 + this.mods.cardChoices, this.mods.cardRarity, this.S.luck), this.S, this.rerolls, (card) => {
      const before = this.stats.health;
      applyCard(this.stats, card);
      if (this.stats.health > before) this.heal(this.stats.health - before);
      if (this.firstRun.elementPickAfterCard()) { this.pickStartElement(); return; }   // a first run: the Element comes now
      this.resume();
    }, () => { this.rerolls--; return rollCards(this.stats, 3 + this.mods.cardChoices, this.mods.cardRarity, this.S.luck); }, this.hud.$('.lvl').getBoundingClientRect());
  }

  resume() {
    if (!this.ui.open || this.ui.closing) this.onResume?.();
  }

  // a dev mode's run (1 on 1, fight the boss): played as a normal run, and not counted as one
  devRun() { this.dev = true; this.firstRun = new FirstRun(false); }

  pickStartElement() {
    this.pickElement('🔥 Pick your element', 'Adds an attack alongside your bubbles. Upgrades appear every third treasure pick.',
      () => {
        const { hint, treasureAt } = this.firstRun.elementChose(this.t);   // a first run: a tip, and the skipped Treasure soon (first-run.js)
        if (hint) { this.hint = hint; this.hintT = 4.5; }
        if (treasureAt != null) this.treasureTimesLeft = [treasureAt, ...this.treasureTimesLeft.filter((x) => x > treasureAt)];
        this.resume();
      });
  }

  // Pick 1 of 3 treasures you can still take (unique ones you don't have, stackable ones below
  // their stack=N) from a treasure chest; every 3rd chest, one of them is an Element upgrade. Base elements never come from here: they're Legendary (pickElement, pickLegendary).
  // source: chest-specific rarity weights (CHEST_WEIGHTS), with no forced minimum rarity
  pickTreasure(title = '✨ A treasure', sub = 'Choose a treasure.', source = 'room') {
    const weights = CHEST_WEIGHTS[source];
    // rollTreasures already supports a weight multiplier; cancel its base weights, retaining Luck.
    const favor = (t) => weights[t.rarity] / treasureTier(t).weight;
    const takeable = (t) => this.owned.count(t.id) < t.stack && (!t.needs || this.owned.has(t.needs));
    const can = (t) => weights[t.rarity] > 0 && takeable(t) && !ELEMENT_TREASURES.includes(t.id) && !ELEMENT_UPGRADES.includes(t.id);
    // every 3rd chest: one of the three is an upgrade for an element you own (by its own rarity), if any is left
    const ups = ++this.chestsOpened % 3 === 0 ? TREASURES.filter((t) => ELEMENT_UPGRADES.includes(t.id) && takeable(t)) : [];
    const up = ups.length ? rollTreasures(ups, 1, this.S.luck, favor) : [];
    const rolled = rollTreasures(TREASURES.filter(can), 3 - up.length, this.S.luck, favor);
    let left = shuffle([...up, ...rolled]);
    if (!left.length) return;
    // stackable ones say how many you'd have; levelled ones which level it'd be and what it adds
    left = left.map((t) => {
      const next = this.owned.count(t.id) + 1, levelled = t.levels.length > 1;
      const text = levelled && next > 1 ? t.levelText[next - 1] : t.text;
      // the pick card's delta line (old → new), only when this take grows the treasure
      const delta = levelled ? (next > 1 ? `Lv ${next - 1} → Lv ${next}` : 'Lv 1') : t.stack > 1 ? (next > 1 ? `×${next - 1} → ×${next}` : `1/${t.stack}`) : null;
      return { ...t, tier: treasureTier(t), text, delta };
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

  // The Treasure book (collection.js): note a find, and list it for the end screen when it's a first
  markNew(kind, choices) { return choices.map((c) => ({ ...c, fresh: !this.dev && !isFound(kind, c.id) })); }
  // (true when it's a first)
  found(kind, id, label = id) { if (!this.dev && discover(kind, id)) { this.newFinds.push(label); return true; } return false; }

  offer(title, sub, choices, then = () => this.resume()) {
    if (document.pointerLockElement) document.exitPointerLock();
    sfx.treasure();
    this.ui.choose(title, sub, this.markNew('treasures', choices), (t) => {
      const before = this.S.health;
      this.owned.add(t.id);
      this.found('treasures', t.id, `${t.icon} ${t.name}`);
      if (this.S.health > before) this.heal(this.S.health - before);
      this.ui.treasure(t, this.owned.count(t.id));
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
    const at = this.treasureTimesLeft.shift(), bonus = this.bonusTreasureAt.delete(at);
    if (!this.firstRun.treasuresDue) return;           // a first run, before its Element pick: this one's skipped (first-run.js)
    const spot = this.nextTreasureSpot();
    if (!spot) return;
    this.placeTreasure(spot, T.stay);
    // more-treasures (Wind-Up Key): a scheduled one may bring another, a little after it goes
    if (!bonus && Math.random() < this.mods.moreTreasures) {
      const next = this.t + T.stay + 5;
      this.bonusTreasureAt.add(next);
      this.treasureTimesLeft.push(next);
      this.treasureTimesLeft.sort((a, b) => a - b);
    }
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
      if (r === 'taken') this.pickTreasure('✨ A treasure!', 'Choose a treasure.', t.timed ? 'room' : 'elite');
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
    if (this.duration) this.hud.toast(`⏰ Time's up! ${this.stage.boss.name} is coming…`, 2400);
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
      this.bossSet.apply(true);
      // what stands round the arena and would hide the fight (the Clog's shower curtain and door) goes faint
      this.tpc.keepFaint((B.seeThrough || []).flatMap((n) => meshesNamed(this.scene, n)), LOOK.num('boss-see-through', 0.15));
      this.elites.clear();
      this.roomTreasures.forEach((t) => t.hide());
      this.bossWalls.forEach((m) => { m.visible = true; if (m.userData.field) showForceField(m.userData.field, true, CONTENT.bosses[B.kind]?.skills.arrival?.barrier||0); });
      const p = new THREE.Vector3(...B.playerStart);
      this.world.focus(p, 1);
      P.spawn(p);
      P.snapToGround();
      P.facing = -Math.PI / 2;
      this.tpc.snapTo(P.position);
      this.tpc.yaw = -Math.PI / 2 + Math.PI;
      this.boss = makeBoss(B, this.scene, this.enemies, this.fx, this.world, { arena: this.arena, song: this.song, toughness: this.stage.toughness });
      this.boss.maxHp = this.boss.hp = Math.round(this.boss.maxHp * (B.hpScale ?? this.stage.bossHp ?? 1));
      // a boss with its own fight view (the shark: back and up, to keep it and the bed in frame), or a
      // stage that asks (B.faceBoss: act 4's arena), turns you to face it; with a view, the camera
      // eases into it for the fight
      if (this.boss.camera || B.faceBoss) {
        const bp = this.boss.position;
        this.tpc.yaw = Math.atan2(P.position.x - bp.x, P.position.z - bp.z);
        P.facing = this.tpc.yaw - Math.PI;
        if (this.boss.camera) this.tpc.fight = this.boss.camera;
      }
      this.enemies.addProxy(this.boss);
      this.later(() => { this.fade.style.opacity = 0; }, 150);
      this.phase = 'boss';
      this.bossStartT = this.t;
      this.bossStarted = false;
      this.bossHurt = false;
      this.hud.toast(B.intro || `${B.name} rises!`, 2400);
    }
  }

  onBossDead({ impact = true } = {}) {
    this.bossDeadT = true;
    this.collectAll = true;           // the boss's XP and its summons' all come to you
    this.bossWon = true;
    const first = this.found('bosses', this.stage.boss.kind, this.stage.boss.name);
    if (!this.dev) {
      this.earn(pearlsFor({ bosses: 1, firstBosses: first ? 1 : 0 }));
      if (!this.bossHurt) addFeats({ flawless: 1 });
    }
    this.bossTime = this.t - (this.bossStartT ?? this.t);
    this.tpc.fight = null;            // back to the player's own view
    const still = juice.calm || this.fx.reducedMotion?.matches;   // the device asks for reduced motion: no slow motion or shake
    if (impact) { juice.feel('boss-kill'); if (!still) juice.slow(...LOOK.list('boss-kill-slow', [0.7, 0.25]).map(Number)); sfx.boom(); }
    const c = this.boss.center();
    this.fx.puff(c, 0x5a4030, 0.12, 0.8);
    this.xpDrops.drop(c, 1, 30);
    for (const e of this.enemies.list) if (!e.dead && !e.proxy) this.enemies.kill(e, true);
    this.hud.toast(`${this.stage.boss.name} is cleared!`, 2200, 'stamp');
    if (!still) juice.shake(LOOK.num('cleared-shake', 0.35));
    sfx.stamp();
    // the last act's boss: straight on to the ending (nothing after it to grow into); otherwise the metamorphosis
    this.later(() => (STAGES[this.stage.id] ? this.metamorph() : this.won()), 2200);
  }

  // The run is won (the last act's boss is beaten): the jelly swims home to the sea (victory.js), then
  // the score, to post if it makes the top 10
  won() {
    if ((this.ui.open && !this.ui.closing) || this.pendingLevels > 0) { this.later(() => this.won(), 250); return; }   // (a pick still open finishes first)
    this.phase = 'won';
    if (!this.dev) markPlayed();
    this.bossDeadT = false;
    const left = this.xpDrops.list.reduce((n, d) => n + d.value, 0);   // whatever XP hadn't reached you still counts
    this.xpDrops.clear();
    this.collectAll = false;
    if (left) this.gainXp(left);
    this.hud.setBoss(null);
    if (document.pointerLockElement) document.exitPointerLock();
    this.victory.begin(() => this.endRun('Run complete', '', 'Play again from act 1', { parts: true }));
  }

  metamorph() {
    // a pick still open (a level-up from the boss's XP) or still to come: it's finished first, never
    // replaced by the metamorphosis
    if ((this.ui.open && !this.ui.closing) || this.pendingLevels > 0) { this.later(() => this.metamorph(), 250); return; }
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
    const choices = shuffle(EVOLUTIONS.filter((e) => !this.evolved.includes(e.id))).slice(0, 3);
    const next = STAGES[this.stage.id];           // the act after this one, if there is one
    const pick = next ? 'Choose an evolution for the rest of the run.' : 'Choose an evolution.';   // (the last act: nothing after it to promise)
    this.ui.choose('Metamorphosis!', `${this.stage.evolve || 'Your polyp becomes an <b>Ephyra</b>, a baby jellyfish.'} ${pick}`, this.markNew('evolutions', choices), (evo) => {
      const before = this.mods;
      this.evolved.push(evo.id);
      this.found('evolutions', evo.id, `${evo.icon} ${evo.name}`);
      this.health = this.S.health;
      this.evolutionReveal.begin(evo, before, () => {
        this.phase = 'won';
        // The transformation finishes before the next reward replaces its portrait.
        if (next) this.pickLegendary('👑 A Legendary treasure', `Choose a treasure for act ${next.id}.`, () => this.actComplete(next));
        else this.endRun('🏆 You won!', this.stage.won || 'Your jelly is a full-grown Medusa, and the apartment is yours.', 'Play again from act 1', { parts: true });
      });
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
    this.later(() => this.endRun('You dried out', 'Back to a polyp. Another run awaits.', 'Try again'), 700);
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
  // (parts: also list what the score is made of, as the winning end does)
  endRun(title, sub, again, { parts = false } = {}) {
    if (!this.dev) forgetRun();   // a finished run can't be continued (stages.js)
    const score = this.score();
    const entry = { score, body: this.playerBody?.() || 'nettle', look: this.playerLook?.() || null, level: this.level, kills: this.kills, time: Math.round(this.t), won: this.bossWon, build: (typeof window !== 'undefined' && window.JF_BUILD) || '' };
    const B = this.board;
    const best = B ? B.keepBest(entry) : false;    // your best in this browser, posted or not
    // the run counts toward earned cosmetics; anything it unlocked is shown here (a boss or an Elite
    // can unlock one mid-run), with the Pearls it earned
    const had = new Set(this.awardsBefore), won = this.phase === 'won';
    this.flushFeats({ runs: 1, wins: won ? 1 : 0, ...(won ? { [`won_${entry.body}`]: 1 } : {}) });
    const earned = unlockedAwards().filter((k) => !had.has(k)).map((k) => { const [key, id] = k.split(':'); return { key, id, name: OPTIONS[key].find(([v]) => v === id)?.[1] || id }; });
    let typed = savedName();
    // a death: how close it came, your best, and the unlock you're nearest, to pull you into the next run
    const dead = this.phase === 'dead', near = dead ? this.howClose() : null, next = dead ? nextAward() : null;
    // your own jelly wearing it (jelly-portrait.js, as the leaderboard draws players)
    const unlockFace = next && this.jellyFace?.({ ...(this.playerLook?.() || {}), [next.key]: next.id });
    const pull = [
      ...(near ? [['So close', near]] : []),
      ...(dead && B?.localBest && !best ? [['Your best', B.localBest.score.toLocaleString()]] : []),
      ...(next ? [['🎯 Next unlock', `${unlockFace ? `<img class="jf-unlock" src="${unlockFace}" alt="">` : ''}${OPTIONS[next.key].find(([v]) => v === next.id)?.[1] || next.id} <small>· ${needShort(next.need, feats())}</small>`]] : []),
    ];
    const finds = this.newFinds.length ? [['📖 New in your book', `${this.newFinds.slice(0, 3).map(esc).join(', ')}${this.newFinds.length > 3 ? ` <small>+${this.newFinds.length - 3} more</small>` : ''}`]] : [];
    // result: what came of a Submit (null until you submit)
    const show = (result) => {
      this.endView = 'summary';
      const said = !result ? '' : result.posted ? ' <small>· on the leaderboard</small>'
        : { lower: ' <small>· not posted: your best on the board is higher</small>', readonly: ' <small>· view-only here, not posted</small>' }[result.why] || ' <small>· couldn\'t post, try again</small>';
      // the first time it's shown, its numbers count up (ui.js tally): the score, the Pearls going into your bank, each part
      const n = (v, pre = '', from = 0) => (result ? pre + v.toLocaleString() : counter(v, pre, from)), banked = bank().pearls;
      const rows = [['Score', `<span class="jf-score">${n(score)}</span>${best ? ' <small class="jf-best">new best!</small>' : ''}${said}`],
        ...(this.dev ? [] : [['🦪 Pearls', `${n(this.pearls, '+')} <small>· ${n(banked, '', Math.max(0, banked - this.pearls))} in all</small>`]]),
        ...pull, ...(parts ? this.scoreParts().filter(([, v]) => v).map(([k, v]) => [k, n(v, '+')]) : []), ...this.summary(), ...finds];
      if (earned.length) rows.unshift(['🎁 Unlocked', `<b>${earned.map((a) => esc(a.name)).join(', ')}</b>`]);
      // only a score that makes the board's top 10 can be entered (leaderboard.js qualifies)
      const high = !B || B.qualifies(score), canPost = B && B.status !== 'offline' && high && !result?.posted && !['readonly', 'lower', 'sending'].includes(result?.why);
      if (B && B.status !== 'offline' && !high && !result) rows.push(['Leaderboard', B.mine && B.mine.score >= score ? '<small>your best on the board is higher</small>' : `<small>not enough for the top 10 this time (#10: ${B.cutoff().toLocaleString()})</small>`]);
      // your name for the board: whatever you typed last time, or Guest if you leave it empty
      if (canPost) rows.push(['Name', `<input name="player" class="jf-name" maxlength="20" placeholder="Guest" autocomplete="nickname" value="${esc(typed)}">`]);
      const buttons = [];
      // a run always starts over from act 1; after a death, starting again is the big button (Enter still submits)
      const tryAgain = { label: again, go: dead || !canPost, onClick: () => { if (this.stage.id > 1) goToAct(1); else { this.start(); this.resume(); } } };
      if (dead) buttons.push(tryAgain);
      if (canPost) {
        buttons.push({ label: '📤 Submit score', go: !dead, enter: true, onClick: (v) => {
          typed = (v.player || '').trim().slice(0, 20);
          saveName(typed);
          show({ posted: false, why: 'sending' });
          B.post({ ...entry, name: typed || 'Guest' }).then((r) => { this.lastPost = r; if (this.endView === 'summary') show(r); });
        } });
      }
      if (!dead) buttons.push(tryAgain);
      if (B) buttons.push({ label: '🏆 Leaderboard', onClick: () => this.showBoard(() => show(result)) });
      if (this.onMainMenu) buttons.push({ label: '🏠 Main menu', onClick: () => this.onMainMenu() });
      this.ui.message(title, result?.why === 'sending' ? 'Sending your score…' : sub, rows, buttons);
    };
    show(null);
    // each golden award it earned gets its own reveal over that, your jelly wearing it (ui.js award)
    const say = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    this.ui.award(earned.map((a) => ({ name: a.name, need: say(needText(requirement(a.key, a.id))), wear: () => this.onWear?.(a.key, a.id),
      face: this.jellyFace?.({ ...(this.playerLook?.() || {}), [a.key]: a.id }) })));
  }

  // How near a death came to beating the act: the boss's time still to come, or its Health left
  howClose() {
    const name = this.stage.boss.name, B = this.boss;
    if (B && !this.bossWon) return `${name} had ${Math.max(1, Math.round((100 * Math.max(0, B.hp)) / B.maxHp))}% Health left`;
    const left = Math.ceil(this.duration - this.t);
    return left > 0 ? `${name} was ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} away` : null;
  }

  // What the run takes into the next act (stages.js; Run.start reads it back as this.carry)
  carryOver() {
    return {
      score: this.score(), stats: this.stats, level: this.level, xp: this.xp, purse: this.purse,
      owned: [...this.owned].map((id) => [id, this.owned.count(id)]), grown: this.grown, growCount: this.growCount, growTotal: this.growTotal,
      chestsOpened: this.chestsOpened, saved: this.saved, evolved: this.evolved, newFinds: this.newFinds,
      pearls: this.pearls, awardsBefore: this.awardsBefore,
    };
  }

  // A walled boss arena keeps the jelly in. The walls stop it, but should it ever end up past one
  // (squeezed out where two meet, over the top on a stack of mid-air jumps), it's put straight back
  // just inside, on the arena's floor, instead of falling out of the fight. Its bugs are held inside
  // too (enemies.keepIn): one the boss dumps out against a wall can't end up stuck in or behind it
  keepInArena(P) {
    const B = this.stage.boss;
    if (!B.walls?.length) return;
    this.enemies.keepIn(B.arenaMin, B.arenaMax);
    const p = P.position, r = P.cfg.radius, [x0, y0, z0] = B.arenaMin, [x1, , z1] = B.arenaMax;
    const out = p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1, fell = p.y < y0 - 0.05;
    if (!out && !fell) return;
    p.x = THREE.MathUtils.clamp(p.x, x0 + r, x1 - r);
    p.z = THREE.MathUtils.clamp(p.z, z0 + r, z1 - r);
    P.velocity.x = P.velocity.z = 0;
    if (fell) { p.y = B.arenaMax[1]; P.velocity.y = 0; P.snapToGround(B.arenaMax[1] - y0 + 0.1); }
    P.syncMesh();
  }

  // The lifetime totals earned cosmetics are judged by (cosmetics.js): this run's bugs cleared since
  // last time, and anything else (a run ended, a win). Called as a run ends, before the next act
  // loads, and when the page goes away mid-run (main.js), so no bug is counted twice or lost.
  // A dev mode (1 on 1, fight the boss) counts nothing.
  flushFeats(extra = {}) {
    if (this.dev) return;
    addFeats({ kills: this.kills - this.featKills, ...extra });
    // and its Pearls: the bugs since last time, and a run ended or won
    this.earn(pearlsFor({ kills: this.kills }) - pearlsFor({ kills: this.featKills }) + pearlsFor({ ended: extra.runs > 0, won: extra.wins > 0 }));
    this.featKills = this.kills;
  }
  // Pearls into the bank as they're earned (cosmetics.js), so a closed tab keeps them; a dev run earns none
  earn(n) {
    if (this.dev || !(n > 0)) return;
    this.pearls += n;
    addPearls(n);
  }

  // An act beaten with another to come: the run moves on with everything it has (level, stats,
  // treasures, score so far); you submit the score at the end of the run
  actComplete(next) {
    const carry = this.carryOver(), score = carry.score;
    this.ui.message(`Act ${this.stage.id} complete`, `Next: ${next.subtitle}. Your progress carries over.`,
      [['Score so far', `<span class="jf-score">${counter(score, '', this.carry?.score || 0)}</span>`], ...this.summary()],
      [{ label: `On to act ${next.id} →`, go: true, onClick: () => { this.flushFeats(); if (!this.dev) keepRun(next.id, carry); goToAct(next.id, carry, { continue: true }); } }]);   // straight into it, no main menu
  }

  // The Treasure book (collection.js) as a dialog: every Treasure, evolution, Elite and boss, found or not
  showBook(back) {
    const f = found(), RANK = ['common', 'rare', 'epic', 'legendary'];
    const sec = (title, kind, list) => ({ title, items: list.map((x) => ({ ...x, found: isFound(kind, x.id, f) })) });
    this.ui.book('📖 Treasure book', [
      sec('Treasures', 'treasures', [...TREASURES].sort((a, b) => RANK.indexOf(a.rarity) - RANK.indexOf(b.rarity)).map((t) => ({ id: t.id, icon: t.icon, name: t.name, text: t.text, color: treasureTier(t).color }))),
      sec('Evolutions', 'evolutions', EVOLUTIONS.map((e) => ({ id: e.id, icon: e.icon, name: e.name, text: e.text }))),
      sec('Elites', 'elites', Object.values(CONTENT.elites).filter((e) => e.id).map((e) => ({ id: e.id, icon: e.icon, name: e.name, text: 'beaten.' }))),
      sec('Bosses', 'bosses', STAGES.map((st) => ({ id: st.boss.kind, icon: Object.values(CONTENT.bosses).find((b) => b.name === st.boss.name)?.icon, name: st.boss.name, text: 'beaten.' }))),   // by name: the Clog's kind is 'hair'
    ], back);
  }

  // The leaderboard as a dialog; back() returns to where it was opened from
  showBoard(back) {
    const B = this.board;
    this.endView = 'board';
    const draw = () => {
      if (this.endView !== 'board') return;
      this.ui.message('🏆 Leaderboard', B.note(), B.table(this.jellyFace), [{ label: 'Back', go: true, onClick: () => { B.onChange = null; back(); } }], 'jf-board');
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
      ...(this.evolved.length ? [['Evolutions', this.evolved.map((id) => { const e = EVOLUTIONS.find((x) => x.id === id); return `${e.icon} ${e.name}`; }).join(', ')]] : []),
      ['Treasures', [...this.owned].map((id) => TREASURES.find((t) => t.id === id).icon + (this.owned.count(id) > 1 ? `×${this.owned.count(id)}` : '')).join(' ') || 'none'],
    ];
  }

  // ------------------------------------------------------------ music
  // What the soundtrack (music.js) should play: the act's own song while you explore (its stage's
  // `music`: "Puddle Drift", "Ephyra Tide", "Medusa Bloom"), building with the bugs close by and the hour; "Domestic Machinery" for the Vacuum, wilder as it weakens
  musicState() {
    if (this.phase === 'explore') {
      const P = this.player.position;
      let near = 0;
      for (const e of this.enemies.list) if (!e.dead && e.pos.distanceTo(P) < 0.7) near += e.proxy ? 4 : 1;   // elites count for more
      return { song: this.stage.music || 'drift', intensity: Math.min(1, 0.12 + 0.6 * Math.min(1, near / 10) + 0.3 * this.night) };
    }
    if (this.phase === 'boss' && this.boss && !this.boss.dead && !this.boss.falling) return { song: this.boss.music || 'machinery', intensity: 0.62 + 0.45 * (1 - this.boss.hp / this.boss.maxHp), suck: this.boss.state === 'suction' };
    return { song: null, intensity: 0 };
  }

  // ------------------------------------------------------------ HUD
  // How far along each timed treasure or evolution is, by its id: { left, spent }, where left is the
  // share of its wait still to go (0 = ready or going off now, 1 = just went off) and spent is a
  // once-a-run (or once-an-act) effect already used. The HUD draws them as clock faces.
  cooldowns() {
    const M = this.mods, G = this.gadgets, out = (this._cd ||= {});
    for (const k in out) delete out[k];
    const put = (id, left, spent = false) => {
      if (!id) return;
      left = Math.max(0, Math.min(1, left));
      if (!out[id] || left < out[id].left) out[id] = { left, spent };   // several copies: the soonest
    };
    for (const T of M.timed) put(T.owner, (G.t[T.key] ?? T.first) / T.every);
    for (const H of M.onHurt) put(H.owner, ((this.hurtCd[H.key] || 0) - this.t) / H.cooldown);
    M.squeaks.forEach((Q, i) => put(Q.owner, ((this.squeakCd[i] || 0) - this.t) / Q.cooldown));
    const O = M.owners;
    if (M.mouse) put(O.mouse, G.mouseRun ? 0 : (G.t.mouse ?? M.mouse.every * 0.6) / M.mouse.every);
    if (M.reflect) put(O.reflect, (this.reflectAt - this.t) / M.reflect.every);
    if (M.deathSave) put(O.deathSave, this.saved ? 1 : 0, this.saved);
    if (M.rebirth) put(O.rebirth, this.polypT > 0 ? 0 : this.rebornThisAct ? 1 : 0, this.rebornThisAct && !(this.polypT > 0));
    if (M.energyShield) put(O.energyShield, this.energyShield.cooldown / M.energyShield.recharge);
    if (M.decoy) put(O.decoy, 1 - this.mirage.wait / M.decoy.every);
    return out;
  }

  refreshHud() {
    this.hud.showMap(this.firstRun.mapShown);   // a first run: hidden until the first Treasure (first-run.js)
    const h = this.hud;
    h.setHealth(this.health, this.S.health, { heal: !!this.healthPulse });
    this.healthPulse = false;
    h.setXp(this.level, this.xp, xpToNext(this.level), this.purse);
    h.setItems([...this.evolved.map((id) => EVOLUTIONS.find((e) => e.id === id)), ...[...this.owned].map((id) => { const t = TREASURES.find((x) => x.id === id), n = this.owned.count(id); return n > 1 ? { ...t, icon: `${t.icon}<sub>×${n}</sub>` } : t; })]);
    h.setCooldowns(this.cooldowns());
    const [c0, c1] = this.stage.clock;
    const mins = c0 + (c1 - c0) * this.night;
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
// A number an end screen counts up (ui.js tally): from `from`, written with `pre` in front
const counter = (n, pre = '', from = 0) => `<span class="jf-count" data-n="${n}" data-pre="${pre}" data-from="${from}">${pre}${n.toLocaleString()}</span>`;
function savedName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }
function saveName(n) { try { localStorage.setItem(NAME_KEY, n); } catch {} }
