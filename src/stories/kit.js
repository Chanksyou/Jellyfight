// The shared kit for the stories (src/stories/<area>.js): the helpers every area uses, STORIES and
// the `story` / `act2` / `act3` / `phone` ways to add one. src/stories.js imports the areas in order.
import * as THREE from 'three';
import { bus, PLAYER } from '../events.js';
import { ENEMY_WORDS } from '../words.js';
import { CONTENT } from '../content.js';
import { BASE_STATS, xpToNext } from '../stats.js';
import { FirstRun, PLAYED_KEY } from '../first-run.js';
import { BEST_KEY } from '../leaderboard.js';
import { hostile, TeleMaterial, VolumeMaterial } from '../vfx.js';
import { ATTACKS as ELITE_ATTACKS } from '../elites.js';
import { ATTACKS as VACUUM_ATTACKS } from '../vacuum.js';
import { ATTACKS as CLOG_ATTACKS } from '../clog.js';
import { ATTACKS as POTHOS_ATTACKS } from '../pothos.js';

export const BASE_FIRE_RATE = BASE_STATS.fireRate;
export const G = () => window;                       // main.js puts the game objects on window
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const r3 = (v) => [v.x, v.y, v.z].map((n) => +n.toFixed(3));
const patched = [];
// replace a method for this story only (fresh() puts every one back)
export function stub(obj, key, fn) {
  patched.push([obj, key, Object.prototype.hasOwnProperty.call(obj, key), obj[key]]);
  obj[key] = fn;
}
export const offs = [];
// record every payload of a bus event during this story (stopped by fresh/restore)
export function record(type) { const log = []; offs.push(bus.on(type, (p) => log.push(p))); return log; }
export function restore() {
  while (offs.length) offs.pop()();
  while (patched.length) {
    const [obj, key, own, old] = patched.pop();
    if (own) obj[key] = old; else delete obj[key];
  }
}
// A clean run with the noise switched off: no waves, no scheduled treasures, no level-ups, no dying
// (each can be turned back on), and the start pick skipped.
export function fresh({ waves = false, treasures = false, hurt = false, levels = false, elites = true, bubbles = true, lash = true, firstRun = false } = {}) {
  const { run, menus, enemies } = G();
  restore();
  document.getElementById('g-over').hidden = true;   // the game doesn't step behind the pause menu
  menus.close();
  run.start();
  run.firstRun = new FirstRun(firstRun);   // a player's first run, or (by default) any other run
  run.startPicked = !firstRun;          // the start pick is skipped, unless the story is about it
  menus.close();
  if (!waves) stub(run, 'spawnWaves', () => {});
  if (!treasures) stub(run, 'scheduleTreasures', () => {});   // elites' chests still work
  if (!hurt) stub(run, 'hurt', () => {});
  if (!levels) stub(run, 'levelUp', () => {});
  if (!bubbles) stub(run.bubbles, 'update', () => {});
  if (!lash) stub(run.lash, 'update', () => {});
  enemies.clear();
  if (!elites) run.elites.clear();
  else run.elites.start(run.stage.elites);
}
// put the jelly somewhere (feet on the ground below) and face the camera along yaw
export function tp(x, y, z, yaw) {
  const { world, player, tpc } = G();
  world.focus(V(x, y, z), 1);
  world._focusAge = Infinity;
  player.spawn(V(x, y, z));
  player.snapToGround(0.3);
  tpc.snapTo(player.position);
  if (yaw !== undefined) tpc.yaw = yaw;
}
// step the game n frames; `until(i)` stops it early the first frame it returns anything truthy
export const step = (n, until) => { for (let i = 0; i < n; i++) { G().GAME.step(1 / 60); if (until && until(i)) return i; } return n; };
// hold keys for some seconds (jumpEvery: queue a jump every n frames); picks any card that opens
export function sim(secs, keys = [], jumpEvery = 0) {
  const { input, menus, player } = G();
  input.keys = new Set(keys);
  step(Math.round(secs * 60), (i) => {
    if (jumpEvery && i % jumpEvery === 0) input.jumpQueued = true;
    if (menus.open) document.querySelector('.jf-card')?.click();
  });
  input.keys = new Set();
  return { pos: r3(player.position), grounded: player.grounded };
}
export const spawn = (type, at, { still = false, hp } = {}) => {
  const e = G().enemies.spawn(type, at);
  e.spawnT = 1;
  if (still) e.hold = true;           // its behaviour words don't run: it just stands there
  if (hp) e.hp = e.maxHp = hp;
  return e;
};
export const ok = (pass, info = {}) => ({ ok: !!pass, info });
export const ELEMENTS_IDS = ['candle', 'battery', 'freezerPack', 'nailPolish', 'paperFan', 'glitter'];
export const STORIES = {};
export const story = (name, s) => { STORIES[name] = s; };

// ------------------------------------------------------------------ shared by more than one area
// collapsing onto the jelly. The tour: the act's start, every vent's landing spot (the raised
// fixtures where the elites are) and the nearest wall or furniture in 8 directions from the
// start, at 16 headings each; then a slow full turn at each spot for sudden jumps.
export function cameraSpots(extra = []) {
  const { traversal, run, world } = G(), s = run.stage.start, spots = [[s[0], 0.05, s[2]], ...extra];
  for (const v of traversal.vents) spots.push([v.land[0], v.land[1] + 0.05, v.land[2]]);
  const o = V(s[0], 0.03, s[2]);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4, d = V(Math.sin(a), 0, Math.cos(a)), h = world.castAll(o, d, 3);
    if (h && h.distance > 0.15) spots.push([o.x + d.x * (h.distance - 0.07), 0.05, o.z + d.z * (h.distance - 0.07)]);
  }
  return spots;
}
export function cameraTour(spots) {
  const { tpc, world, APT } = G(), cam = tpc.camera.position, last = V(0, 0, 0), toCam = V(0, 0, 0), seen = new Set();
  const F = tpc.fight, want = F ? [F.pitch, F.distance] : [tpc.pitch, tpc.distance], programs = APT.renderer.info.programs.length;
  let moved = 0, blocked = 0, jumps = 0, maxJump = 0, views = 0;
  for (const p of spots) {
    for (let k = 0; k < 16; k++) {
      // build the shaders this view needs (see-through copies included) without drawing it: in a
      // software GPU, 240 queued draws became a minutes-long stall a story or two later (#7)
      tp(...p, (k * Math.PI) / 8); step(30); G().batcher.sync(); APT.renderer.compile(APT.scene, APT.camera); views++;
      if (Math.abs(cam.distanceTo(tpc.focus) - want[1]) > 1e-3 || Math.abs(tpc.viewPitch - want[0]) > 1e-3) moved++;   // (a fight view: eased in)
      for (const m of tpc.over) seen.add(m.name);
      const len = toCam.subVectors(cam, tpc.focus).length();
      if (world.cast(tpc.focus, toCam.normalize(), len, tpc.over)) blocked++;   // something solid left between the jelly and the camera
    }
    tp(...p, 0); step(20); last.copy(cam);
    for (let i = 0; i < 240; i++) {
      tpc.yaw += (Math.PI * 2) / 240;
      tpc.update(1 / 60, { x: 0, y: 0, wheel: 0 }, G().player.position);
      const j = cam.distanceTo(last); last.copy(cam);
      if (j > 0.05) jumps++;   // a snap: turning moves it under 2 cm a frame
      maxJump = Math.max(maxJump, j);
    }
  }
  const newShaders = APT.renderer.info.programs.length - programs;
  return { views, moved, blocked, jumps, maxJump: +maxJump.toFixed(3), newShaders, seeThrough: [...seen] };
}
// `under`: a piece of furniture the jelly gets underneath on the tour, which it should see through
export const cameraStory = (extra, under) => ({
  about: `The camera never moves on its own: same tilt and distance at every spot and heading, no snaps while turning. Whatever would block the view fades out instead (furniture over the jelly like the ${under.replace(/_\d+$/, '').replace(/_/g, ' ').toLowerCase()}, a wall behind it), with no shader built on the spot, and turns solid again once clear.`,
  setup() { fresh({ elites: false }); },
  play() {
    const { tpc, run } = G(), spots = cameraSpots(extra), now = cameraTour(spots);
    // back out in the open, whatever faded is solid again, on its own material
    const s = run.stage.start;
    tp(s[0], 0.05, s[2], 0); step(60);
    const restored = [...tpc._fades.keys()].every((m) => tpc.over.has(m)) && tpc._fades.size <= tpc.over.size;
    return ok(now.moved === 0 && now.blocked === 0 && now.jumps === 0 && now.newShaders === 0 && now.seeThrough.includes(under) && restored, { spots: spots.length, ...now, restored });
  },
});
export const modalTitle = () => document.querySelector('.jf-modal h2')?.textContent || '';
export const pickFirstCard = () => document.querySelector('.jf-modal .jf-card')?.click();
export const hintShown = () => { const h = document.querySelector('#hud .hint'); return h && h.classList.contains('on') ? h.textContent : ''; };
export const hitJelly = (n = 1) => { G().run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount: n, source: 'story' }); };
export const mapShown = () => { const m = document.querySelector('#hud .map'); return !!m && !m.hidden && getComputedStyle(m).display !== 'none'; };
// The whole first minute of a player's first run, played like a player would (desktop and phone):
// the real waves run, cards and Element picks are taken as they come, and the story records when
// each thing first happens, then checks the order: moving only at first (no menu, no minimap), the
// Health hint on the first hit, the first card, the Element pick straight after it, then the first
// Treasure at the first scheduled time after that, with the minimap. Plenty of Health, so the
// minute can't end early; a nudge of XP if no Level-up has come by 0:40.
export function firstMinute() {
  fresh({ elites: false, firstRun: true, waves: true, treasures: true, levels: true, hurt: true });
  tp(3.2, 0.05, 3.0, 0);
  const { run, menus, enemies } = G(), T = {};
  run.stats.health = run.health = 500;
  spawn('roach', near(0, -0.2), { hp: 9999 });            // in range from the start, for the bubbles
  let blown = 0;
  const was = run.bubbles.onBlow; run.bubbles.onBlow = () => { blown++; was(); };
  for (let i = 0; i < 60 * 90 && !T.treasure; i++) {
    G().GAME.step(1 / 60);
    const t = +run.t.toFixed(2);
    if (t < 5) { if (menus.open || mapShown() || enemies.list.some((e) => e.type !== 'roach')) T.busyEarly = t; }
    if (t >= 6 && !T.hint && !run.firstRun.hitHintShown) hitJelly();          // no roach reached us yet: a hit
    if (T.hint === undefined && /That's your Health/.test(hintShown())) T.hint = t;
    if (menus.open) {
      const title = modalTitle();
      if (/element/i.test(title)) T.element ??= t;
      else if (/level/i.test(title)) T.card ??= t;
      pickFirstCard();
    }
    if (t >= 40 && T.card === undefined && !menus.open) run.gainXp(xpToNext(run.level));
    if (T.map === undefined && mapShown()) T.map = t;
    if (run.roomTreasures.some((x) => x.active && x.timed)) T.treasure = t;
    if (T.element === undefined && run.roomTreasures.some((x) => x.active)) T.treasureBeforeElement = t;
  }
  run.bubbles.onBlow = was;
  menus.close();
  const due = (run.stage.treasures.at || []).find((x) => x >= T.element);
  const good = T.busyEarly === undefined && blown > 0 && T.hint !== undefined && T.card !== undefined && T.element >= T.card && T.element - T.card < 0.5
    && T.treasureBeforeElement === undefined && Math.abs(T.treasure - due) <= 0.1 && Math.abs(T.map - T.treasure) <= 0.1;
  return ok(good, { ...T, due, blown });
}
// play as a brand-new player for a moment: no record of a finished run, no saved best (put back after)
export function asNewPlayer(fn) {
  const keys = [PLAYED_KEY, BEST_KEY], saved = keys.map((k) => localStorage.getItem(k));
  try { keys.forEach((k) => localStorage.removeItem(k)); return fn(); }
  finally { keys.forEach((k, i) => (saved[i] === null ? localStorage.removeItem(k) : localStorage.setItem(k, saved[i]))); }
}
export const near = (dx, dz, dy = 0) => G().player.position.clone().add(V(dx, dy, dz));
// the floor Warnings in the scene in the Pothos's colour, showing
export const pothosFloor = () => shownWarnings().floor.filter((o) => o.material.uniforms.uColor.value.getHex() === hostile('pothos').getHex());
export const give = (...ids) => { for (const id of ids) G().run.owned.add(id); };
export const evolve = (id) => { G().run.evolved.push(id); };   // take an evolution (content/evolutions.kdl)
export const dmgBy = (log, source) => log.filter((d) => d.source === source && d.targetId !== PLAYER);
export const roachAt = (dx, dz, opts = { still: true, hp: 9999 }) => spawn('roach', near(dx, dz), opts);
export const setupFight = (opts = {}) => { fresh({ elites: false, ...opts }); tp(3.2, 0.05, 3.0, 0); };
// that dome over the floor circle, both filling to the moment it lands
const MUG_AT = [0.62, 0.78, 2.95];
export function startCoffeeLob() {
  fresh({ bubbles: false, lash: false });
  tp(MUG_AT[0], MUG_AT[1] + 0.05, MUG_AT[2], 0);
  const e = G().run.elites.list.find((x) => x.kind === 'mug');
  e.next = 0; e.cool = 0;
}
// the Warning meshes in the scene over a landing spot: its floor shape and its volume
export function warningsAt(to) {
  const near = (o) => Math.hypot(o.position.x - to.x, o.position.z - to.z) < 0.01;
  const kids = G().APT.scene.children.filter(near);
  return { floor: kids.find((o) => o.material instanceof TeleMaterial), volume: kids.find((o) => o.material instanceof VolumeMaterial) };
}
// hold the jelly still where it is put (its own update is switched off for this story)
export function holdJelly() { const { player } = G(); stub(player, 'update', () => {}); player.velocity.set(0, 0, 0); return player; }
// them: its button barrage mixes floor-level and jump-height Shots, and its rumble is a dome Blast
export const CONTROLLER_AT = [1.62, 0.61, 4.47];
export const JUMP_FEET = 0.12;   // feet 12 cm up: a jelly near the top of its jump (body 12 to 21 cm)
export function startController(atk) {
  fresh({ bubbles: false, lash: false });
  tp(CONTROLLER_AT[0], CONTROLLER_AT[1] + 0.05, CONTROLLER_AT[2], 0);
  const e = G().run.elites.list.find((x) => x.kind === 'controller');
  e.next = atk; e.cool = 0;
  return e;
}
// doesn't clear it, stepping out does); its boiling drops land as small floor Blasts (jump them)
const KETTLE_AT = [4.5, 0.91, 3.45];
export const theKettle = () => G().run.elites.list.find((x) => x.kind === 'kettle');
export function startKettle(atk) {
  fresh({ bubbles: false, lash: false });
  tp(KETTLE_AT[0], KETTLE_AT[1] + 0.05, KETTLE_AT[2], 0);
  const e = theKettle();
  e.next = atk; e.cool = 0;
}
// are low walls (2 cm: jump them), and its spin's dust clumps are Shots at mixed heights
const VAC_JELLY = [3.6, 0, 3.6];   // in front of where it powers on, 50 cm away
export function startVacuum(attack, at = VAC_JELLY) {
  fresh({ bubbles: false, lash: false });
  G().run.startBossIntro();
  step(180);
  tp(at[0], at[1] + 0.05, at[2], 0);
  const B = G().run.boss;
  B.heading = Math.atan2(at[0] - B.position.x, at[2] - B.position.z);
  B.state = attack; B.stateT = { charge: 1.0, brushes: 1.4, spin: 2.2 }[attack]; B.prevT = B.stateT; B.locked = false;
  return B;
}
// every hit the Vacuum lands from now on (not the suction's drain)
export function bossHits() { const b = []; offs.push(bus.on('damage_taken', (d) => { if (d.source === 'boss' && !d.drain) b.push(d); })); return b; }
// the Warnings showing in the scene: floor shapes and volumes (the Vacuum hides its own, never removes them)
export function shownWarnings() {
  const shown = (o) => o.visible && o.material?.opacity > 0;
  const kids = G().APT.scene.children.filter(shown);
  return { floor: kids.filter((o) => o.material instanceof TeleMaterial), volume: kids.filter((o) => o.material instanceof VolumeMaterial) };
}
// start an attack again from where the Vacuum powers on, with the jelly held on the floor `away` m in front
export function againVacuum(B, attack, away = 0.5) {
  B.position.set(...G().run.stage.boss.drain);
  const player = G().player;
  player.position.set(B.position.x, B.position.y, B.position.z + away); player.grounded = true; player.velocity.set(0, 0, 0);
  B.heading = 0;
  B.knock = 0; B.state = attack; B.stateT = { charge: 1.0, brushes: 1.4, spin: 2.2 }[attack]; B.prevT = B.stateT; B.locked = false;
  return player;
}
export const act2 = (name, s) => story('act2/' + name, { act: 2, ...s });
// the Soap Dispenser on the vanity (elites.js): you land beside it off the vanity vent
export const soapElite = () => G().run.elites.alive.find((e) => e.kind === 'soap');
export const besideSoap = () => tp(1.5, 0.9, 5.47, 0);
// and the bubble ring drifts out at mixed heights: floor level (jump them) and jump height (stay down)
export function startSoap(atk, { angry = false } = {}) {
  fresh({ bubbles: false, lash: false }); besideSoap();
  const e = soapElite(); if (angry) e.hp = e.maxHp * 0.4;
  e.next = atk; e.cool = 0;
  return e;
}
// the Wall Clock over the cubby bench (elites.js, clock-model.js): the bench vent lands you below it
export const hallClock = () => G().run.elites.list.find((e) => e.kind === 'clock');
export const onBench = (x = 2.06, z = 7.5) => tp(x, 0.5, z, 0);
// the Wall Clock's attacks in 3D: start one with the jelly held where it stands on the bench
export function startClock(atk, { x = 2.0, z = 7.42, angry = false } = {}) {
  fresh({ hurt: true, bubbles: false, lash: false }); onBench(x, z);
  const e = hallClock(), player = holdJelly();
  if (angry) e.hp = e.maxHp * 0.4;
  step(90); step(400, () => e.state === 'idle');   // (it may have started one of its own coming down)
  e.cool = 0; e.next = atk;
  return { e, player, bench: player.position.y };
}
// the Cream Whipper in the hall's far corner by the front door (elites.js, whipper-model.js)
export const whipper = () => G().run.elites.alive.find((e) => e.kind === 'whipper');
export const byDoor = () => tp(3.15, 0.02, 8.5, 0);   // where its 1 on 1 puts you (stage2.js stand)
// the balloon's Warning as the scene holds it: its floor circle (and a volume, which it shouldn't have)
export function balloonWarning(B) { return warningsAt(B.m.position); }
export const startBalloon = () => { fresh({ bubbles: false, lash: false }); byDoor(); const e = whipper(); e.cool = 0; e.next = 0; };
export const startSpray = () => { fresh({ bubbles: false, lash: false }); tp(3.27, 0.02, 8.78, 0); const e = whipper(); e.cool = 0; e.next = 1; };
// act 3's Alligator on the pillows at the head of the bed (elites.js kind 'croc', croc-model.js):
// start one of its attacks with the jelly held on the bed in front of it (x, z), facing it
export const croc = () => G().run.elites.list.find((e) => e.kind === 'croc');
export const onBed = (x = -0.1, z = 9.75) => tp(x, 0.75, z, 0);
export function startCroc(atk, { x = -0.1, z = 10.2, angry = false } = {}) {
  fresh({ hurt: true, bubbles: false, lash: false }); onBed(x, z);
  const e = croc(), player = holdJelly();
  e.cool = 99;
  if (angry) e.hp = e.maxHp * 0.5;
  step(60);                                         // awake, and turned to face the jelly
  e.cool = 0; e.next = atk;
  return { e, player, bed: player.position.y };
}
// act 3's Bull on the changing table (elites.js kind 'bull', bull-model.js): the dresser on the
// bedroom's north wall, its top 1.146 m up. Start one of its attacks with the jelly held on the
// table top east of it (x, z), facing it
export const bull = () => G().run.elites.list.find((e) => e.kind === 'bull');
export const onTable = (x = -0.5, z = 8.36) => tp(x, 1.2, z, 0);
export function startBull(atk, { x = -0.6, z = 8.36, angry = false } = {}) {
  fresh({ hurt: true, bubbles: false, lash: false }); onTable(x, z);
  const e = bull(), player = holdJelly();
  e.cool = 99;
  if (angry) e.hp = e.maxHp * 0.5;
  step(60);                                         // awake, and turned to face the jelly
  e.cool = 0; e.next = atk;
  return { e, player, table: player.position.y };
}
// the Clog (clog.js): straight into the boss fight in the tub
export const clogFight = () => {
  fresh({ hurt: true, bubbles: false, lash: false });
  const { run, menus } = G();
  run.startBossIntro();
  step(60 * 6, () => { if (menus.open) document.querySelector('.jf-card')?.click(); return run.phase === 'boss' && run.boss?.rise >= 1; });
  return run.boss;
};
export const clogAttack = (B, name, P) => {
  if (P) tp(...P, 0);
  B.state = 'chase'; B.stateT = 0;
  B.next = ['lash', 'snare', 'roll', 'flood', 'shed'].indexOf(name);
};
// start a Clog attack with the jelly held still (feet `up` m over the tub floor) at x on the drain's line
export function clogAgain(B, name, x, up = 0) {
  B.position.copy(B.drain); B.knock = 0; B.heading = Math.PI / 2;
  const player = holdJelly();
  player.position.set(x, B.floor + up, B.drain.z); player.grounded = !up;
  clogAttack(B, name);
  return player;
}
// warns with, and one story per act starts every one in turn. A Warning before a Blast, a lane, a
// ring, a half slab or a cone shows its floor shape with its volume over it, filling together, and
// both go after the hit; starting any attack builds no new shader. An attack the game has (elites.js
// ATTACKS, vacuum.js / clog.js ATTACKS) that isn't listed here fails its act's story, so a new one
// has to say what it warns with.
//   volume  a floor Warning with its volume over it
//   floor   a floor Warning with no volume (the Cream Whipper's balloon, by the owner's call)
//   sweep   a volume with no floor Warning (the Vacuum's brushes, by decision): it must show
//   shot    a Warning (if any) before Shots: no volume, the Shots are what you watch
//   hazard  a floor hazard (spec #22, Out of Scope): it only hurts while you stand in it
//   none    no Warning: it lets bugs out
const eliteOf = (kind) => G().run.elites.list.find((x) => x.kind === kind);
const held = (start) => () => { start(); holdJelly(); };
const atVacuum = (a) => () => { const B = startVacuum(a); holdJelly(); againVacuum(B, a, 0.4); };
const atClog = (a) => () => {
  const B = clogFight();
  if (a === 'spray') { B.swarmed = true; B.hp = B.maxHp * 0.4; }
  clogAgain(B, a, 0.75);
  if (a === 'spray') { B.state = 'spray'; B.stateT = 1.0; B.prevT = 1.0; }
};
// a Bug of `type` put down near the held jelly; it's warning while `warns(it)`; `end` takes it away
function bugWarns(type, warns) {
  let it = null;
  return {
    start() { const { player } = G(); holdJelly(); it = spawn(type, player.position.clone().add(V(0.15, 0, 0.1))); },
    during: () => !!it && warns(it),
    end() { const { enemies } = G(); for (const e of enemies.list) if (!e.dead && ['cutting', 'sprout', 'root'].includes(e.type)) enemies.kill(e, true); it = null; },
  };
}
// the Pothos's guarding vines snapping at a jelly held by its heart: warning while a snap is under
// way; `end` takes the jelly away from the heart and lets the last snap land
function guardSnap() {
  const B = () => G().run.boss, on = () => B().snaps.some((L) => L.on);
  return {
    is: 'volume',
    start() {
      const b = pothosFight(), { world } = G(), player = holdJelly(), c = b.center();
      b.stateT = 1e9;
      const hit = world.castAll(V(c.x, c.y + 0.3, c.z - 0.2), V(0, -1, 0), 1);
      player.position.set(c.x, hit.point.y, c.z - 0.2);
    },
    during: on,
    end() { const { player, run } = G(); player.position.set(...run.stage.boss.playerStart); step(60, () => !on()); },
  };
}
export const EVERY_ATTACK = {
  1: {
    controller: { barrage: { is: 'shot', start: held(() => startController(0)) }, rumble: { is: 'volume', start: held(() => startController(1)) } },
    mug: { coffee: { is: 'volume', start: held(startCoffeeLob) }, spill: { is: 'hazard' } },
    kettle: { steam: { is: 'volume', start: held(() => startKettle(0)) }, 'boil-over': { is: 'volume', start: held(() => startKettle(1)) } },
    vacuum: {
      charge: { is: 'volume', start: atVacuum('charge') }, brushes: { is: 'sweep', start: atVacuum('brushes') }, spin: { is: 'shot', start: atVacuum('spin') },
      suction: { is: 'hazard' }, flies: { is: 'none' }, dump: { is: 'none' },
    },
  },
  2: {
    soap: { squirt: { is: 'volume', start: held(() => startSoap(0)) }, 'bubble-ring': { is: 'shot', start: held(() => startSoap(1)) } },
    clock: { sweep: { is: 'volume', start: () => startClock(0) }, wreath: { is: 'shot', start: () => startClock(1) }, hour: { is: 'volume', start: () => startClock(2, { angry: true }) } },
    whipper: { balloon: { is: 'floor', start: held(startBalloon) }, cream: { is: 'volume', start: held(startSpray) } },
    clog: {
      lash: { is: 'volume', start: atClog('lash') }, snare: { is: 'volume', start: atClog('snare') }, roll: { is: 'volume', start: atClog('roll') }, spray: { is: 'shot', start: atClog('spray') },
      flood: { is: 'hazard' }, shed: { is: 'none' },
    },
  },
  3: {
    pothos: {                         // each attack joins here as it lands (pothos.js ATTACKS)
      cutting: { is: 'none' },        // it drops Cuttings: their countdown is the Cutting's own (words/becomes)
      roots: { is: 'volume', start: () => { const B = pothosFight(); holdJelly(); B.begin('roots'); } },
      whip: { is: 'volume', start: () => { const B = pothosFight(); holdJelly(); B.begin('whip'); } },
      sweep: { is: 'volume', start: () => { const B = pothosFight(); holdJelly(); B.begin('sweep'); } },
      snap: guardSnap(),              // its guarding vines (not a turn: `always`), at a jelly close to its heart
    },
    // the Alligator on the pillows (elites.js): its frost balls' Blasts, its tail slams' ring walls, its pounce's Blast
    croc: { volley: { is: 'volume', start: () => startCroc(0) }, 'tail-slam': { is: 'volume', start: () => startCroc(1) }, pounce: { is: 'volume', start: () => startCroc(2) } },
    // the Bull on the changing table (elites.js): its rush's Blast, its spiral's Shots (a circle
    // Warning first, like the Soap Dispenser's bubble ring), its little bulls' lanes
    bull: { rush: { is: 'volume', start: () => startBull(0) }, spiral: { is: 'shot', start: () => startBull(1) }, minis: { is: 'volume', start: () => startBull(2) } },
    // the Bugs it sends that warn (a behaviour word with a hostile `color`): each started on its own
    bugs: {
      cutting: { is: 'floor', ...bugWarns('cutting', (e) => !e.dead) },                     // its countdown (becomes): a floor circle only, by decision
      sprout: { is: 'volume', ...bugWarns('sprout', () => G().enemies.lobs.some((b) => !b.done)) },   // the sap lob's Blast
      root: { is: 'volume', ...bugWarns('root', (e) => e.state === 'drop') },             // dropping from above
    },
  },
};
// which Boss this act has (run.js BOSSES: the Clog's kind is 'hair')
const bossKind = () => ({ vacuum: 'vacuum', pothos: 'pothos' })[G().run.stage.boss.kind] || 'clog';
// the attacks the game has this act: each fighting Elite's, and the Boss's (calm and angry)
function attacksInGame(act) {
  const { run } = G(), out = {}, boss = bossKind(), A = { vacuum: VACUUM_ATTACKS, clog: CLOG_ATTACKS, pothos: POTHOS_ATTACKS }[boss];
  for (const e of run.elites.list) out[e.kind] = [...ELITE_ATTACKS[e.kind]];
  out[boss] = [...new Set([...A.calm, ...A.angry, ...(A.always || [])])];   // (`always`: not a turn, the Pothos's guarding vines)
  // Bugs that warn (so far only the Pothos's: Cuttings, Sap sprouts, Aerial roots) are checked in act 3
  if (act === 3) out.bugs = Object.entries(CONTENT.enemies).filter(([, T]) => warnsWith(T).length).map(([id]) => id);
  return out;
}
// the behaviour words a Bug warns with: those drawn in a hostile colour (src/words.js `color`)
const warnsWith = (T) => T.vocabulary.filter((w) => ENEMY_WORDS[w]?.props && 'color' in ENEMY_WORDS[w].props);
// Elite and Boss Shots in flight
const shotsFlying = () => { const { run } = G(), els = run.elites; return els.bullets.length + els.soapBubbles.length + els.thrown.length + (run.boss?.shots?.length || 0); };
// each volume showing, with the floor Warning under it (same spot, same fill), if there is one
// (a curved floor strip, the Pothos's Vine Whip, carries a chain of lane volumes along it: each
// stands on the strip's centre line)
export function volumePairs() {
  const w = shownWarnings(), at = (f, v) => Math.hypot(f.position.x - v.position.x, f.position.z - v.position.z) < 0.01 || (f.material.shape === 'strip' && stripLine(f).some((c) => Math.hypot(c.x - v.position.x, c.z - v.position.z) < 0.01));
  const under = (v) => (f) => at(f, v) && Math.abs(f.material.progress - v.material.progress) < 1e-6;
  return w.volume.map((v) => [v, w.floor.find(under(v))]);
}
// start one attack; check its Warning as it shows and fills, the shaders, and that it's gone after
function checkAttack(who, name, a) {
  const { APT, batcher, run } = G(), r = {};
  a.start();
  const boss = who === bossKind() ? run.boss : null, e = boss || a.during ? null : eliteOf(who);
  const programs = APT.renderer.info.programs.length;
  const shows = {
    volume: () => volumePairs().some(([, f]) => f && f.material.progress > 0.05),
    floor: () => { const w = shownWarnings(); return w.floor.some((f) => f.material.progress > 0.05) && !w.volume.length; },
    sweep: () => shownWarnings().volume.length > 0,
    shot: () => shotsFlying() > 0,
  }[a.is];
  // while this attack is the one going (not the next one after it)
  const during = a.during || (boss ? () => boss.state === name : () => e.state === 'windup' && ELITE_ATTACKS[who][e.attack] === name);
  // (an Elite's Shots fly as its attack ends: those count once it has started)
  const now = a.is === 'shot' ? () => started && shows() : () => during() && shows();
  const compile = () => { batcher.sync(); APT.renderer.compile(APT.scene, APT.camera); };
  let started = false, warned = false;
  step(60 * 8, () => {
    if (during()) started = true;
    if (!warned && during() && shownWarnings().floor.length) { warned = true; compile(); }   // its floor Warning, as soon as it shows
    return now() || (a.is !== 'shot' && started && !during());
  });
  r.shown = now();
  compile();   // and with its volume, or its Shots
  r.newShaders = APT.renderer.info.programs.length - programs;
  if (a.is === 'volume') {
    // every volume showing sits over its floor Warning, and the two fill on together
    const p1 = volumePairs(), was = p1.map(([v]) => v.material.progress);
    step(6);
    r.volumes = p1.length;
    r.filling = p1.length > 0 && p1.every(([v, f], i) => f && f.parent && v.parent && Math.abs(f.material.progress - v.material.progress) < 1e-6 && v.material.progress > was[i]);
  }
  // after the hit: keep it from starting another, let what's in flight land, then nothing shows
  if (boss && a.end) a.end(); else if (boss) { step(60 * 6, () => boss.state !== name); boss.stateT = 1e9; } else if (e) { step(60 * 8, () => e.state === 'idle'); e.cool = 1e9; } else { step(60 * 8, () => !during()); a.end(); }
  const els = run.elites;
  step(60 * 6, () => !els.blobs.length && !els.balloons.length && !els.rings.length && !shotsFlying());
  step(20);
  const w = shownWarnings();
  r.gone = !w.floor.length && !w.volume.length;
  return r;
}
export function everyAttack(act) {
  const listed = EVERY_ATTACK[act], inGame = attacksInGame(act), out = {}, bad = [];
  for (const [who, names] of Object.entries(inGame)) for (const n of names) if (!listed[who]?.[n]) bad.push(`${who} ${n}: not listed`);
  for (const [who, attacks] of Object.entries(listed)) {
    for (const [name, a] of Object.entries(attacks)) {
      if (!inGame[who]?.includes(name)) { bad.push(`${who} ${name}: not in the game`); continue; }
      if (!a.start) continue;   // a floor hazard, or no Warning
      const r = out[`${who} ${name}`] = checkAttack(who, name, a);
      if (!(r.shown && r.newShaders === 0 && r.gone && (a.is !== 'volume' || r.filling))) bad.push(`${who} ${name}`);
    }
  }
  return ok(!bad.length, { bad, ...out });
}
// run as if the Clog was just beaten (tests/run.mjs)
export const act3 = (name, s) => story('act3/' + name, { act: 3, ...s });
// the Pothos (pothos.js): straight into the boss fight on the bed
export const pothosFight = (opts = {}) => {
  fresh({ hurt: true, bubbles: false, lash: false, elites: false, ...opts });
  const { run, menus } = G();
  run.startBossIntro();
  step(60 * 6, () => { if (menus.open) document.querySelector('.jf-card')?.click(); return run.phase === 'boss' && run.boss?.rise >= 1; });
  return run.boss;
};
// Where the Pothos's heart and the jelly are on screen in the fight view (pixels from the top): both
// in frame, the top of the heart (swollen as in an opening) below the top HUD band (the boss bar and
// the intro toast "The Pothos wakes!"), the jelly above the bottom edge
export const heartFrame = (B) => {
  const { APT, player } = G(), cv = APT.renderer.domElement.getBoundingClientRect();
  APT.camera.updateMatrixWorld();
  const px = (p) => { const q = p.clone().project(APT.camera); return { x: Math.round((q.x + 1) / 2 * cv.width), y: Math.round((1 - q.y) / 2 * cv.height), z: q.z }; };
  const c = B.center(), top = px(c.clone().setY(c.y + B.r * 1.5)), heart = px(c), jelly = px(player.position);
  const bottom = (sel) => { const el = document.querySelector(sel); return el && !el.hidden ? Math.round(el.getBoundingClientRect().bottom - cv.top) : 0; };
  const hud = Math.max(bottom('#hud .boss'), bottom('#hud .toast'));
  const inside = (p) => p.x > 0 && p.x < cv.width && p.y > 0 && p.y < cv.height && p.z < 1;
  return { good: inside(heart) && inside(jelly) && top.y > hud && hud > 0, heartTop: top.y, hud, heart: [heart.x, heart.y], jelly: [jelly.x, jelly.y], screen: [Math.round(cv.width), Math.round(cv.height)] };
};
// a floor strip's centre line as drawn, in the world: the middle of each row across it, from its start
export function stripLine(f) {
  f.updateWorldMatrix(true, false);
  const p = f.geometry.attributes.position, out = [];
  for (let i = 0; i + 1 < p.count; i += 2) out.push(V(0, 0, 0).fromBufferAttribute(p, i).add(V(0, 0, 0).fromBufferAttribute(p, i + 1)).multiplyScalar(0.5).applyMatrix4(f.matrixWorld));
  return out;
}
export const phone = (name, s) => story('phone/' + name, { phone: true, ...s });
