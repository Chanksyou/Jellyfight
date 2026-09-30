// One run of stage 1: grow for 2 minutes, collect Moon Drops (the first 3 give treasures,
// the 4th summons the boss early), then beat the stage's boss and evolve. When time runs out the boss
// comes anyway.
import * as THREE from 'three';
import { BASE_STATS, rollCards, applyCard, xpToNext, TREASURES, EVOLUTIONS, ATTACK_TREASURES } from './stats.js';
import { inPoly } from './hud.js';
import { Boss } from './boss.js';
import { Vacuum } from './vacuum.js';
import { TYPES } from './enemies.js';
import { Gadgets } from './gadgets.js';
import { Elites } from './elites.js';
import { Bubbles } from './bubbles.js';
import { LostThings } from './pickups.js';
import { juice } from './juice.js';
import { sfx } from './sfx.js';
import { bus, PLAYER } from './events.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const TOTAL_DROPS = 4;          // drops 1-3 each give a treasure; the 4th summons the boss
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

export class Run {
  // ctx: { scene, stage, plan, world, player, cfg, enemies, lash, dew, moon, traversal, hud, ui, fx, tpc, input, setNight }
  constructor(ctx) {
    Object.assign(this, ctx);
    this.gadgets = new Gadgets(ctx.scene, ctx.enemies, ctx.fx, ctx.world);
    this.bubbles = new Bubbles(ctx.scene, ctx.enemies, ctx.fx, ctx.world);
    this.bubbles.grace = this.cfg.radius;
    this.lost = new LostThings(ctx.scene);
    this.bubbles.onBlow = () => { this.player.avatar?.pulse?.(0.6); sfx.blow(); };   // the bell squeezes as it blows
    this.elites = new Elites(ctx.scene, ctx.enemies, ctx.fx, ctx.world, ctx.tpc.camera, ctx.apartment);
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
    this.cactusCd = new Map();           // enemy id -> when Cactus Spine can sting it again

    // The run owns the jelly's moisture, slow and knockback, and what kills are worth
    bus.on('damage_taken', ({ targetId, amount, drain }) => {
      if (targetId !== PLAYER) return;
      if (drain) this.hurt(amount, true);   // puddles and suction: no i-frames, no flinch
      else this.hit(amount);                // i-frames, Thimble, Soap Bubble, Rubber Duck
    });
    bus.on('status_applied', ({ targetId, status, duration }) => {
      if (targetId === PLAYER && status === 'slow') this.slowT = Math.max(this.slowT, duration);
    });
    bus.on('knockback', ({ targetId, dir, force, launch }) => {
      if (targetId !== PLAYER) return;
      const v = this.player.velocity;
      v.addScaledVector(dir, force);
      if (launch) { v.y = Math.max(v.y, launch); this.player.grounded = false; }
    });
    bus.on('enemy_killed', (k) => { if (!k.silent) this.onKill(k); });
    bus.on('elite_defeated', ({ elite }) => this.eliteDefeated(elite));
    this.player.onLand = (drop) => {
      if (this.owned.has('wristband')) this.wristT = 3;
      if (this.owned.has('cottonBall') && drop > 0.04) this.shockwave(this.player.position.clone(), 0.08, this.power * 2, 0xffffff);
    };
    // a little wake of bubbles behind each stroke of the bell
    this.player.onStroke = () => {
      const P = this.player.position, f = this.player.facing;
      this.fx.puff(new THREE.Vector3(P.x - Math.sin(f) * this.cfg.radius * 1.4, P.y + this.cfg.height * 0.45, P.z - Math.cos(f) * this.cfg.radius * 1.4), 0xdff4ff, 0.008, 0.3);
    };
    this.start();
  }

  // ------------------------------------------------------------ setup
  start() {
    const s = this.stage;
    this.enemies.clear();
    this.elites?.start(this.stage.elites);
    this.lost?.place(this.stage.lostThings || []);
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
    this.moon.hide();
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
    this.owned = new Set();
    this.drops = 0;
    this.kills = 0;
    this.pendingLevels = 0;
    this.iFrames = 0;
    this.slowT = 0;
    this.wristT = 0;
    this.stillT = 0;
    this.duckCd = 0;
    this.bubbleUsed = false;
    this.lintT = 20;
    this.bombT = 6;
    this.spawnAcc = 0;
    this.dropTimer = 2;
    this.lastArea = null;
    this.bursts = [];
    this.cactusCd.clear();
    this.nightT = 0;

    const start = new THREE.Vector3(...s.start);
    this.world.focus(start, 1);
    this.player.spawn(start);
    this.player.snapToGround();
    this.tpc.snapTo(this.player.position);

    // Only open, easy-to-reach Moon Drop spots (the apartment is static, so check once)
    if (!this.dropSpots) {
      this.dropSpots = [];
      this.dropRejects = [];
      for (const sp of s.drops) {
        const r = this.openSpot(sp.at);
        if (r.ok) this.dropSpots.push({ ...sp, y: r.y });
        else this.dropRejects.push(`${sp.label}: ${r.why}`);
      }
      if (!this.dropSpots.length) this.dropSpots = s.drops.map((sp) => ({ ...sp, y: sp.at[1] }));
    }
    this.setNight(s.clock[0]);
    this.refreshHud();
  }

  get paused() { return this.ui.open; }
  // how hard treasures that attack on their own hit: scales with pop damage
  get power() { return this.stats.pop * 1.8; }   // gadgets and treasures: pop 6 -> 10.8, as before the slower, harder stream
  // The tentacles' stats, with their treasures applied
  get tentacleStats() {
    const s = this.stats, o = this.owned;
    return {
      tentacles: Math.min(6, s.tentacles + (o.has('fishingLine') ? 2 : 0)),
      reach: s.reach * (o.has('chopstick') ? 1.6 : 1),
      sting: s.sting,
      lashSpeed: s.lashSpeed,
    };
  }
  // the treasures that work on tentacle stings
  get tentacleTreasures() {
    return new Set(['stickyNote', 'nailClipper', 'hotSauce'].filter((id) => this.owned.has(id)));
  }
  // seconds until the boss comes (the Egg Timer adds 30)
  get duration() { return this.stage.duration + (this.owned.has('hourglass') ? 30 : 0); }

  // ------------------------------------------------------------ main update
  update(dt) {
    if (this.phase === 'dead' || this.phase === 'won' || this.phase === 'metamorph') { this.touchAction = null; return; }
    // every run starts with a treasure: pick 1 of 3 before anything happens
    if (!this.startPicked && this.phase === 'explore') {
      this.startPicked = true;
      this.pickTreasure('🎁 Pick a starting treasure', 'Something lost, just within reach. Keep one to shape this run.', true);
      return;
    }
    this.t += dt;
    const P = this.player, s = this.stats;

    // --- movement, with vents, fabric, lint, and the drain's pull
    const tr = this.traversal.query(P.position);
    let push = null;
    if (this.phase === 'boss' && this.boss) {
      push = this.boss.update(dt, P).push;
      if (this.boss.dead && !this.bossDeadT) this.onBossDead();
    }
    if (this.phase !== 'moonlift') {
      this.world.focus(P.position, dt);
      P.update(dt, this.input, this.tpc.yaw, {
        speedMul: s.pulse, jumpMul: s.bounce, vent: this.phase === 'explore' ? tr.vent : null, climb: !!tr.climb,
        airJumps: this.owned.has('penSpring') ? 2 : 1,
        slow: this.slowT > 0 ? 0.4 : 0, push,
      });
    }

    // --- timers
    this.iFrames = Math.max(0, this.iFrames - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.wristT = Math.max(0, this.wristT - dt);
    this.duckCd = Math.max(0, this.duckCd - dt);
    // --- the night: waves, drops, and the boss when time runs out
    if (this.phase === 'explore') {
      this.spawnWaves(dt);
      this.updateDrops(dt);
      if (this.t >= this.duration && this.phase === 'explore') this.startMoonlift(true);
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
      this.bubbles.update(dt, P.position.clone().setY(P.position.y + this.cfg.height * 0.75), s, this.owned);
      // close-range sting: tentacles, improved only by treasures
      this.lash.update(dt, origin, this.tentacleStats, this.tentacleTreasures, { lashSpeedMul: this.wristT > 0 ? 2 : 1 });
      this.gadgets.update(dt, { owned: this.owned, feet: P.position, center: origin, facing: P.facing, sting: this.power });
      if (this.phase === 'explore') {
        this.elites.update(dt, P, this.cfg);
        const found = this.lost.update(dt, this.t, P.position);
        if (found) { this.fx.puff(found.pos.clone().setY(found.pos.y + 0.01), 0xffd23a, 0.04, 0.5); this.pickTreasure('🎁 A lost thing!', `Tucked away on the ${found.label}. Keep one.`); }
      }
      this.enemies.update(dt, { position: P.position, height: this.cfg.height }, this.t);
      this.contactDamage();
      this.enemies.shotHits(P.position.clone().setY(P.position.y + this.cfg.height * 0.5), this.cfg.radius);
    }
    for (const b of this.bursts.splice(0)) this.burst(b);

    // --- treasure effects that tick
    if (this.owned.has('whale')) {
      this.stillT = P.speed < 0.02 && P.grounded ? this.stillT + dt : 0;
      if (this.stillT > 1) this.heal(0.5 * dt);
    }
    if (this.owned.has('bathBomb') && this.phase !== 'moonlift') {
      this.bombT -= dt;
      if (this.bombT <= 0) { this.bombT = 6; this.shockwave(P.position.clone(), 0.09, this.power * 1.5, 0xff9ad8); }
    }
    if (this.owned.has('lintRoller')) {
      this.lintT -= dt;
      if (this.lintT <= 0) { this.lintT = 20; this.dew.magnetAll = true; this.fx.puff(origin, 0x9fe2ff, 0.05, 0.4); }
    }

    // --- dew
    const got = this.dew.update(dt, origin, this.owned.has('loofah') ? 2.5 : 1);
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

    this.moon.update(dt);
    if (this.phase === 'moonlift') this.updateMoonlift(dt);
    if (this.pendingLevels > 0 && !this.ui.open && this.phase !== 'moonlift') this.levelUp();
    this.refreshHud();
  }

  // ------------------------------------------------------------ waves
  spawnWaves(dt) {
    // fewer enemies, each worth more (see TYPES in enemies.js); paced for a 5-minute night
    const rate = 0.22 + this.t * 0.0022;
    const cap = Math.min(20, 6 + this.t / 15);
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.enemies.alive >= cap) continue;
      // cockroaches from the start, ant squads from 0:45, mosquitoes from 1:30
      const w = [['roach', 1], ['ants', this.t > 45 ? 0.5 : 0], ['mosquito', this.t > 90 ? 0.45 : 0]];
      let r = Math.random() * w.reduce((a, [, x]) => a + x, 0), type = 'roach';
      for (const [k, x] of w) if ((r -= x) <= 0) { type = k; break; }
      const pos = this.spawnPoint(type) || (type !== 'roach' ? this.spawnPoint((type = 'roach')) : null);
      if (pos) this.enemies.spawn(type, pos, 1 + this.t / 60 * 0.18);
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
      const d = this.enemies.center(e).distanceTo(pc);
      if (d < e.r + this.cfg.radius) {
        if (e.T.slows) bus.emit('status_applied', { targetId: PLAYER, status: 'slow', duration: 1.5 });
        // Cactus Spine: whatever touches you gets stung (once per second each)
        if (this.owned.has('cactus') && !(this.cactusCd.get(e.id) > this.t)) {
          this.cactusCd.set(e.id, this.t + 1);
          bus.emit('damage_taken', { targetId: e.id, amount: this.stats.sting * 3 + this.power, color: '#9adf6a', source: 'cactus' });
        }
        // ant squads hit harder rolling
        bus.emit('damage_taken', { targetId: PLAYER, amount: e.state === 'dash' && e.T.rollDmg ? e.T.rollDmg : e.T.dmg, source: e.type });
      }
    }
  }

  hit(amount) {
    if (this.iFrames > 0 || this.phase === 'dead') return;
    this.iFrames = 1.0;
    if (this.owned.has('thimble')) amount *= 0.7;
    if (this.owned.has('soapBubble') && !this.bubbleUsed) {
      this.bubbleUsed = true;
      this.hud.toast('🫧 Pop!', 900);
      return;
    }
    if (this.owned.has('rubberDuck') && this.duckCd <= 0) {
      this.duckCd = 5;
      const P = this.player.position;
      this.fx.puff(P.clone().setY(P.y + 0.015), 0xffe066, 0.09, 0.35);
      this.fx.number(P.clone().setY(P.y + 0.05), 'SQUEAK', '#ffe066', 16);
      for (const e of this.enemies.list) {
        if (e.dead || e.proxy) continue;
        const away = e.pos.clone().sub(P).setY(0);
        const d = away.length();
        if (d > 0.09) continue;
        bus.emit('knockback', { targetId: e.id, dir: away.normalize(), force: 0.06 });
        bus.emit('damage_taken', { targetId: e.id, amount: 3, color: '#ffe066', source: 'duck' });
      }
    }
    this.hurt(amount);
  }

  hurt(amount, silent = false) {
    this.moisture -= amount;
    if (!silent) { juice.shake(0.55); sfx.hurt(); }
    if (!silent) this.player.avatar?.land(1.5);
    if (this.moisture <= 0) this.die();
  }

  heal(amount) { this.moisture = Math.min(this.stats.moisture, this.moisture + amount); }

  // an enemy_killed event: { pos, r, dew, elite }
  onKill({ pos: c, r, dew: baseDew, elite }) {
    this.kills++;
    const combo = juice.kill();
    if (combo % 10 === 0) { sfx.combo(combo); this.fx.number(c.clone().setY(c.y + r * 3), `${combo} COMBO!`, '#ffd23a', 22); }
    const dew = Math.round((this.owned.has('coin') ? baseDew * 1.5 : baseDew) * juice.bonus);
    this.dew.drop(c, 1, dew);
    this.fx.number(c.clone().setY(c.y + r * 1.5), `+${dew}💧`, '#9fe2ff', elite ? 20 : 14);
    if (this.owned.has('babyBottle')) this.heal(0.5);
    if (elite) {                         // elites give back some moisture and drop a treasure
      this.heal(4);
      this.fx.puff(c, 0xffd23a, r * 3, 0.5);
      if (this.phase === 'explore') this.pickTreasure('✨ Elite cleared!', 'It dropped three lost things. Keep one. (+4 moisture)');
    }
    if (this.owned.has('bathSalt')) this.bursts.push(c);
  }

  // One of the high-ground elites (elites.js) is beaten
  eliteDefeated(e) {
    this.kills++;
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
    this.fx.puff(c, 0xffffff, 0.045, 0.3);
    for (const e of this.enemies.list) {
      if (e.dead || e.proxy) continue;
      if (this.enemies.center(e).distanceTo(c) < 0.045 + e.r) bus.emit('damage_taken', { targetId: e.id, amount: this.power * 0.5, color: '#bfe8ff', source: 'bathSalt' });
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
    this.ui.levelUp(this.level - this.pendingLevels, rollCards(this.stats, 3, this.owned.has('dice') ? 1 : 0), this.stats, 1, (card) => {
      const before = this.stats.moisture;
      applyCard(this.stats, card);
      if (this.stats.moisture > before) this.heal(this.stats.moisture - before);
      this.resume();
    }, () => rollCards(this.stats, 3, this.owned.has('dice') ? 1 : 0));
  }

  resume() {
    if (!this.ui.open) this.onResume?.();
  }

  // Pick 1 of 3 treasures you don't have yet (from a Moon Drop or an elite)
  // attack: make sure one of the three changes how you attack (the starting pick)
  pickTreasure(title = `🌙 Moon Drop ${this.drops} / ${TOTAL_DROPS}`, sub = 'The moonlight shows you three lost things. Keep one.', attack = false) {
    let left = shuffle(TREASURES.filter((t) => !this.owned.has(t.id))).slice(0, 3);
    if (attack && !left.some((t) => ATTACK_TREASURES.includes(t.id))) {
      const a = shuffle(TREASURES.filter((t) => ATTACK_TREASURES.includes(t.id) && !this.owned.has(t.id)))[0];
      if (a) left = shuffle([a, ...left.slice(0, 2)]);
    }
    if (!left.length) return;
    if (document.pointerLockElement) document.exitPointerLock();
    sfx.treasure();
    this.ui.choose(title, sub, left, (t) => {
      this.owned.add(t.id);
      this.ui.treasure(t);
      this.resume();
    });
  }

  // ------------------------------------------------------------ moon drops
  updateDrops(dt) {
    if (this.moon.active) {
      const P = this.player.position;
      const d = this.moon.position.distanceTo(P.clone().setY(P.y + this.cfg.height * 0.5));
      if (d < 0.02 + this.cfg.radius) this.collectDrop();
      return;
    }
    if (this.drops >= TOTAL_DROPS) return;
    this.dropTimer -= dt;
    if (this.dropTimer <= 0) this.spawnDrop();
  }

  // A Moon Drop spot must be easy to see and reach: open sky above it (the camera looks down),
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

  spawnDrop() {
    const P = this.player.position;
    const [lo, hi] = this.drops === 0 ? [0.5, 2.0] : [1.0, 3.5];
    const all = this.dropSpots;
    const dist = (sp) => Math.hypot(sp.at[0] - P.x, sp.at[2] - P.z);
    let cands = all.filter((sp) => sp.area !== this.lastArea && dist(sp) >= lo && dist(sp) <= hi);
    if (!cands.length) cands = all.filter((sp) => dist(sp) >= 0.5);
    const spot = cands[(Math.random() * cands.length) | 0];
    const last = this.drops === TOTAL_DROPS - 1;
    this.moon.show(spot, spot.y, last);
    this.lastArea = spot.area;
    this.hud.toast(last ? `🌕 The full moon drop appeared: ${spot.label}. It will summon ${this.stage.boss.name}!` : `🌙 A Moon Drop appeared: ${spot.label}`, last ? 3200 : 2200);
  }

  collectDrop() {
    this.drops++;
    const p = this.moon.position.clone();
    this.fx.puff(p, 0xfff0c0, 0.06, 0.5);
    this.dew.drop(p, 1, 5);
    this.moon.hide();
    this.dropTimer = 1.2;
    if (this.drops >= TOTAL_DROPS) this.startMoonlift();
    else this.pickTreasure();
  }

  // ------------------------------------------------------------ boss
  startMoonlift(timeUp = false) {
    this.phase = 'moonlift';
    this.liftT = 0;
    this.moon.hide();
    this.hud.toast(timeUp ? `🌕 Time's up! The moonlight drags you to ${this.stage.boss.name}…` : '🌙 The moonlight lifts you…', 2400);
    for (const e of this.enemies.list) if (!e.dead) this.enemies.kill(e, true);
    this.dew.magnetAll = true;
  }

  updateMoonlift(dt) {
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
      this.lost.clear();
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
      this.bossStarted = false;
      this.hud.toast(B.intro || `${B.name} rises!`, 2400);
    }
  }

  onBossDead() {
    this.bossDeadT = true;
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
    this.ui.choose('Metamorphosis!', 'Your polyp becomes an <b>Ephyra</b>, a baby jellyfish. Choose how it grows.', choices, (evo) => {
      evo.apply(this.stats);
      this.moisture = this.stats.moisture;
      this.phase = 'won';
      this.ui.message('Stage 1 complete', 'The living room is yours. The bathroom and hallway (stage 2) are coming soon.', this.summary(), [
        { label: 'Play stage 1 again', go: true, onClick: () => { this.start(); this.resume(); } },
      ]);
    });
  }

  die() {
    if (this.phase === 'dead') return;
    this.phase = 'dead';
    this.moisture = 0;
    if (document.pointerLockElement) document.exitPointerLock();
    this.hud.setBoss(null);
    setTimeout(() => this.ui.message('You dried out', 'But an immortal jelly never really dies. It shrinks back into a polyp… and tries again.', this.summary(), [
      { label: 'Try again', go: true, onClick: () => { this.start(); this.resume(); } },
    ]), 700);
  }

  summary() {
    const m = Math.floor(this.t / 60), sec = String(Math.floor(this.t % 60)).padStart(2, '0');
    return [
      ['Time', `${m}:${sec}`],
      ['Level', this.level],
      ['Moon Drops', `${this.drops} / ${TOTAL_DROPS}`],
      ['Dry things cleared', this.kills],
      ['Treasures', [...this.owned].map((id) => TREASURES.find((t) => t.id === id).icon).join(' ') || 'none'],
    ];
  }

  // ------------------------------------------------------------ HUD
  refreshHud() {
    const h = this.hud;
    h.setMoisture(this.moisture, this.stats.moisture);
    h.setXp(this.level, this.xp, xpToNext(this.level), this.purse);
    h.setItems([...this.owned].map((id) => TREASURES.find((t) => t.id === id)));
    const [c0, c1] = this.stage.clock;
    const mins = c0 + (c1 - c0) * Math.min(1, this.t / this.duration);
    const hh = Math.floor(mins / 60), mm = Math.floor(mins % 60);
    const left = Math.max(0, Math.ceil(this.duration - this.t));
    const boss = this.phase === 'explore' ? ` · ${this.stage.boss.name} in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '';
    h.setClock(`${hh === 0 ? 12 : hh}:${String(mm).padStart(2, '0')} AM${boss}`, this.phase === 'explore' && left <= 20);
    h.setStage(`Stage ${this.stage.id} · ${this.stage.name}`);
    h.setDrops(this.drops, TOTAL_DROPS, this.phase === 'boss');
  }

  markers() {
    const out = [];
    for (const v of this.traversal.vents) out.push({ kind: 'vent', x: v.x, y: v.y, z: v.z });
    for (const e of this.enemies.list) if (!e.dead && !e.proxy) out.push({ kind: 'enemy', x: e.pos.x, y: e.pos.y, z: e.pos.z });
    if (this.moon.active) {
      const p = this.moon.position;
      out.push({ x: p.x, y: p.y, z: p.z, color: '#fff3c4', big: true, icon: this.moon.full ? '🌕' : '🌙' });
    }
    if (this.phase === 'explore') for (const s of this.lost.list) if (!s.taken) out.push({ x: s.pos.x, y: s.pos.y, z: s.pos.z, color: '#ff7a9a', icon: '🎁' });
    const ICON = { controller: '🎮', mug: '☕', kettle: '🫖' };
    if (this.phase === 'explore') for (const e of this.elites.alive) out.push({ x: e.base.x, y: e.base.y, z: e.base.z, color: '#ffc23a', big: true, icon: ICON[e.kind] || '★' });
    if (this.phase === 'boss' && this.boss && !this.boss.dead) { const p = this.boss.position; out.push({ x: p.x, y: p.y, z: p.z, color: '#ff4a4a', big: true, icon: '🤖' }); }
    return out;
  }
}
