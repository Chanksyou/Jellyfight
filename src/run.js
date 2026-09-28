// One run of stage 1: survive the night, grow, collect 3 Moon Drops, beat The Clog, evolve.
import * as THREE from 'three';
import { BASE_STATS, rollCards, applyCard, xpToNext, TREASURES, treasureCost, EVOLUTIONS } from './stats.js';
import { inPoly } from './hud.js';
import { Clog } from './boss.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const TOTAL_DROPS = 3;
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

export class Run {
  // ctx: { scene, stage, plan, world, player, cfg, enemies, lash, dew, moon, chests, traversal, hud, ui, fx, tpc, input, setNight }
  constructor(ctx) {
    Object.assign(this, ctx);
    this.rooms = ctx.plan;
    this.fade = document.createElement('div');
    this.fade.style.cssText = 'position:fixed;inset:0;background:radial-gradient(#fffbe8,#cfe2ff);opacity:0;pointer-events:none;z-index:20;transition:opacity .5s';
    document.body.appendChild(this.fade);
    this.enemies.onKill = (e) => this.onKill(e);
    this.player.onLand = () => { if (this.owned.has('wristband')) this.wristT = 3; };
    this.start();
  }

  // ------------------------------------------------------------ setup
  start() {
    const s = this.stage;
    this.enemies.clear();
    this.dew.clear();
    this.fx.clear();
    this.lash.reset();
    this.boss?.dispose();
    this.boss = null;
    this.traversal.bossMode = false;
    this.moon.hide();
    this.hud.setBoss(null);
    this.ui.close();
    this.fade.style.opacity = 0;

    this.phase = 'explore';
    this.t = 0;
    this.stats = { ...BASE_STATS };
    this.level = 1;
    this.xp = 0;
    this.purse = 0;
    this.moisture = this.stats.moisture;
    this.owned = new Set();
    this.opened = 0;
    this.freeNext = false;
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
    this.spawnAcc = 0;
    this.dropTimer = 2;
    this.lastArea = null;
    this.bursts = [];
    this.nightT = 0;

    const start = new THREE.Vector3(...s.start);
    this.world.focus(start, 1);
    this.player.spawn(start);
    this.player.snapToGround();
    this.tpc.snapTo(this.player.position);

    // pick this run's treasure spots and find the surface under each
    const spots = shuffle([...s.treasures]).slice(0, s.treasureCount).map((sp) => {
      const [x, y, z] = sp.at;
      const hit = this.world.castAll(new THREE.Vector3(x, y + 0.1, z), DOWN, 0.3);
      return { x, y: hit ? hit.point.y : y, z };
    });
    this.chests.place(spots);
    this.setNight(s.clock[0]);
    this.refreshHud();
  }

  get paused() { return this.ui.open; }

  // ------------------------------------------------------------ main update
  update(dt) {
    if (this.phase === 'dead' || this.phase === 'won' || this.phase === 'metamorph') { this.touchAction = null; return; }
    this.t += dt;
    const P = this.player, s = this.stats;

    // --- movement, with vents, fabric, lint, and the drain's pull
    const tr = this.traversal.query(P.position);
    let push = null;
    if (this.phase === 'boss' && this.boss) {
      const r = this.boss.update(dt, P);
      push = r.push;
      if (r.hurt) this.hurt(r.hurt, true);
      if (r.contact) this.hit(4);
      this.hud.setBoss(this.stage.boss.name, this.boss.hp / this.boss.maxHp);
      if (this.boss.dead && !this.bossDeadT) this.onBossDead();
    }
    if (this.phase !== 'moonlift') {
      this.world.focus(P.position, dt);
      P.update(dt, this.input, this.tpc.yaw, {
        speedMul: s.pulse, jumpMul: s.bounce, lift: tr.lift, climb: !!tr.climb,
        slow: this.slowT > 0 ? 0.4 : 0, push,
      });
    }

    // --- timers
    this.iFrames = Math.max(0, this.iFrames - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.wristT = Math.max(0, this.wristT - dt);
    this.duckCd = Math.max(0, this.duckCd - dt);
    const dry = this.t > this.stage.duration;

    // --- the night: clock, The Dry
    if (this.phase === 'explore') {
      if (dry) this.hurt(0.25 * dt, true);
      this.spawnWaves(dt, dry);
      this.updateDrops(dt);
    }
    this.nightT -= dt;
    if (this.nightT <= 0) {
      this.nightT = 10;
      const [c0, c1] = this.stage.clock;
      this.setNight(c0 + (c1 - c0) * Math.min(1, this.t / this.stage.duration));
    }

    // --- attacks and enemies
    const origin = P.position.clone().setY(P.position.y + this.cfg.height * 0.45);
    if (this.phase === 'explore' || this.phase === 'boss') {
      this.lash.update(dt, origin, s, this.owned, { lashSpeedMul: this.wristT > 0 ? 1.5 : 1 });
      this.enemies.update(dt, { position: P.position, height: this.cfg.height }, this.t);
      this.contactDamage();
    }
    for (const b of this.bursts.splice(0)) this.burst(b);

    // --- treasure effects that tick
    if (this.owned.has('whale')) {
      this.stillT = P.speed < 0.02 && P.grounded ? this.stillT + dt : 0;
      if (this.stillT > 1) this.heal(0.5 * dt);
    }
    if (this.owned.has('lintRoller')) {
      this.lintT -= dt;
      if (this.lintT <= 0) { this.lintT = 20; this.dew.magnetAll = true; this.fx.puff(origin, 0x9fe2ff, 0.05, 0.4); }
    }

    // --- dew
    const got = this.dew.update(dt, origin);
    if (got) this.gainDew(got);

    // --- treasures
    this.chests.update(dt, this.t);
    this.chests.setCost(this.freeNext ? 0 : treasureCost(this.opened));
    const chest = this.phase === 'explore' ? this.chests.nearest(P.position) : null;
    const cost = this.freeNext ? 0 : treasureCost(this.opened);
    if (chest && this.input.consumeInteract()) this.openChest(chest, cost);
    this.input.consumeInteract();

    // --- hints
    const canOpen = chest && this.purse >= cost;
    this.touchAction = canOpen ? `Open 💧${cost || 'free'}` : null;
    const jumpKey = this.touch ? '⤴' : '<kbd>Space</kbd>';
    if (chest) this.hud.hint(canOpen ? (this.touch ? 'Treasure! Tap Open' : `<kbd>E</kbd> open for 💧 ${cost || 'free'}`) : `Needs 💧 ${cost} dew (you have ${this.purse})`);
    else if (tr.climb && !P.climbing && this.phase === 'explore') this.hud.hint(`Hold ${jumpKey} to climb the ${tr.climb.name.toLowerCase()}`);
    else this.hud.hint(null);

    this.moon.update(dt);
    if (this.phase === 'moonlift') this.updateMoonlift(dt);
    if (this.pendingLevels > 0 && !this.ui.open && this.phase !== 'moonlift') this.levelUp();
    this.refreshHud();
  }

  // ------------------------------------------------------------ waves
  spawnWaves(dt, dry) {
    const rate = (0.4 + this.t * 0.008) * (dry ? 1.8 : 1);
    const cap = dry ? 75 : Math.min(60, 20 + this.t / 6);
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.enemies.alive >= cap) continue;
      const w = [['mote', 1], ['bunny', this.t > 25 ? 0.6 : 0], ['lint', this.t > 75 ? 0.45 : 0]];
      let r = Math.random() * w.reduce((a, [, x]) => a + x, 0), type = 'mote';
      for (const [k, x] of w) if ((r -= x) <= 0) { type = k; break; }
      const pos = this.spawnPoint(type) || (type !== 'mote' ? this.spawnPoint((type = 'mote')) : null);
      if (pos) this.enemies.spawn(type, pos, 1 + this.t / 60 * 0.22);
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
      if (type === 'mote') return new THREE.Vector3(x, pc.y + (Math.random() * 0.1 - 0.02), z);
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
      if (e.dead || e.proxy) continue;
      const d = this.enemies.center(e).distanceTo(pc);
      if (d < e.r + this.cfg.radius) {
        if (e.T.slows) this.slowT = 1.5;
        this.hit(e.T.dmg);
      }
    }
  }

  hit(amount) {
    if (this.iFrames > 0 || this.phase === 'dead') return;
    this.iFrames = 1.0;
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
        e.pos.addScaledVector(away.normalize(), 0.06);
        this.enemies.damage(e, 3, '#ffe066');
      }
    }
    this.hurt(amount);
  }

  hurt(amount, silent = false) {
    this.moisture -= amount;
    if (!silent) this.player.avatar?.land(1.5);
    if (this.moisture <= 0) this.die();
  }

  heal(amount) { this.moisture = Math.min(this.stats.moisture, this.moisture + amount); }

  onKill(e) {
    this.kills++;
    const c = this.enemies.center(e);
    this.dew.drop(c, 1, e.T.dew);
    if (this.owned.has('bathSalt')) this.bursts.push(c);
  }

  burst(c) {
    this.fx.puff(c, 0xffffff, 0.045, 0.3);
    for (const e of this.enemies.list) {
      if (e.dead || e.proxy) continue;
      if (this.enemies.center(e).distanceTo(c) < 0.045 + e.r) this.enemies.damage(e, this.stats.sting * 0.5, '#bfe8ff');
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
    if (document.pointerLockElement) document.exitPointerLock();
    this.ui.levelUp(this.level - this.pendingLevels, rollCards(), this.stats, 1, (card) => {
      const before = this.stats.moisture;
      applyCard(this.stats, card);
      if (this.stats.moisture > before) this.heal(this.stats.moisture - before);
      this.resume();
    }, () => rollCards());
  }

  resume() {
    if (!this.ui.open) this.onResume?.();
  }

  openChest(chest, cost) {
    if (this.purse < cost) { this.hud.toast('Not enough dew', 900); return; }
    const left = TREASURES.filter((t) => !this.owned.has(t.id));
    if (!left.length) return;
    this.purse -= cost;
    this.opened++;
    const t = left[(Math.random() * left.length) | 0];
    this.owned.add(t.id);
    this.freeNext = t.id === 'spareKey';
    this.chests.markOpen(chest);
    this.fx.puff(chest.pos.clone().setY(chest.pos.y + 0.01), 0xffd23a, 0.03, 0.4);
    this.ui.treasure(t);
  }

  // ------------------------------------------------------------ moon drops
  updateDrops(dt) {
    if (this.moon.active) {
      const P = this.player.position;
      const d = this.moon.position.distanceTo(P.clone().setY(P.y + this.cfg.height * 0.5));
      if (d < 0.03) this.collectDrop();
      return;
    }
    if (this.drops >= TOTAL_DROPS) return;
    this.dropTimer -= dt;
    if (this.dropTimer <= 0) this.spawnDrop();
  }

  spawnDrop() {
    const P = this.player.position;
    const [lo, hi] = this.drops === 0 ? [0.5, 2.0] : [1.0, 3.5];
    const all = this.stage.drops;
    const dist = (sp) => Math.hypot(sp.at[0] - P.x, sp.at[2] - P.z);
    let cands = all.filter((sp) => sp.area !== this.lastArea && dist(sp) >= lo && dist(sp) <= hi);
    if (!cands.length) cands = all.filter((sp) => dist(sp) >= 0.5);
    let r = Math.random() * cands.reduce((a, sp) => a + (sp.at[1] > 0.3 ? 2 : 1), 0), spot = cands[0];
    for (const sp of cands) if ((r -= sp.at[1] > 0.3 ? 2 : 1) <= 0) { spot = sp; break; }
    const [x, y, z] = spot.at;
    const hit = this.world.castAll(new THREE.Vector3(x, y + 0.1, z), DOWN, 0.3);
    this.moon.show(spot, hit ? hit.point.y : y);
    this.lastArea = spot.area;
    this.hud.toast(`🌙 A Moon Drop appeared: ${spot.label}`, 2200);
  }

  collectDrop() {
    this.drops++;
    const p = this.moon.position.clone();
    this.fx.puff(p, 0xfff0c0, 0.06, 0.5);
    this.dew.drop(p, 1, 5);
    this.moon.hide();
    this.dropTimer = 1.2;
    if (this.drops >= TOTAL_DROPS) this.startMoonlift();
    else this.hud.toast(`🌙 Moon Drop ${this.drops} / ${TOTAL_DROPS}`);
  }

  // ------------------------------------------------------------ boss
  startMoonlift() {
    this.phase = 'moonlift';
    this.liftT = 0;
    this.hud.toast('🌙 The moonlight lifts you…', 2200);
    this.chests.list.forEach((c) => { if (!c.open) c.g.visible = false; });
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
      const p = new THREE.Vector3(...B.playerStart);
      this.world.focus(p, 1);
      P.spawn(p);
      P.snapToGround();
      P.facing = -Math.PI / 2;
      this.tpc.snapTo(P.position);
      this.tpc.yaw = -Math.PI / 2 + Math.PI;
      this.boss = new Clog(this.scene, this.enemies, this.fx, B);
      this.enemies.addProxy(this.boss);
      setTimeout(() => { this.fade.style.opacity = 0; }, 150);
      this.phase = 'boss';
      this.bossStarted = false;
      this.hud.toast(`${B.name} rises from the drain!`, 2400);
    }
  }

  onBossDead() {
    this.bossDeadT = true;
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
      this.ui.message('Stage 1 complete', 'The bathroom and hallway are yours. The living room (stage 2) is coming soon.', this.summary(), [
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
    const dry = this.t > this.stage.duration;
    const mins = c0 + (c1 - c0) * Math.min(1, this.t / this.stage.duration);
    const hh = Math.floor(mins / 60), mm = Math.floor(mins % 60);
    h.setClock(`${hh === 0 ? 12 : hh}:${String(mm).padStart(2, '0')} AM${dry ? ' · The Dry is spreading' : ''}`, dry);
    h.setStage(`Stage ${this.stage.id} · ${this.stage.name}`);
    h.setDrops(this.drops, TOTAL_DROPS, this.phase === 'boss');
  }

  markers() {
    const out = [];
    if (this.moon.active) {
      const p = this.moon.position;
      out.push({ x: p.x, y: p.y, z: p.z, color: '#fff3c4', big: true });
    }
    for (const c of this.chests.list) if (!c.open && c.g.visible) out.push({ x: c.pos.x, y: c.pos.y, z: c.pos.z, color: '#ffd23a' });
    return out;
  }
}
