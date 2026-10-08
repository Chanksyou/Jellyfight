// Stories: named situations in the real game, the same idea as Storybook. Each one sets the
// game up (`setup`) and can then be watched live, or played out headlessly by `play`, which
// steps the game and returns { ok, info }: what should have happened, and whether it did.
//
//   index.html?story=elites/kettle-steam   open one story and watch it (phone or desktop)
//   index.html?stories                      list every story, tap one to open it
//   node tests/run.mjs [filter]             play every story headlessly (see tests/run.mjs)
//
// When you add a behaviour, add a story that proves it. When a story breaks, the game did.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { bus, PLAYER } from './events.js';
import { ENEMY_WORDS, TREASURE_WORDS, TIMED_WORDS, newMods } from './words.js';
import { CONTENT, compileEnemies, compileTreasures } from './content.js';
import { rollCards, rollTreasures, RARITY, TREASURE_RARITY, xpToNext, BASE_STATS, STAT_INFO, EVOLUTIONS, TREASURES, ELEMENT_UPGRADES } from './stats.js';
const BASE_FIRE_RATE = BASE_STATS.fireRate;
import { parse } from './kdl.js';
import { LOOK } from './look.js';
import { SPECIES, buildCharacter, normalizeLook } from './character.js';
import { STAGES, currentAct, goToAct } from './stages.js';
import { pitch, isDeep } from './sfx.js';
import { TouchControls } from './touch.js';
import { FramePacer, FrameGovernor } from './pacing.js';
import { checkBvhLayout } from './collision.js';
import { FirstRun, isNewPlayer, markPlayed, PLAYED_KEY } from './first-run.js';
import { BEST_KEY } from './leaderboard.js';

const G = () => window;                       // main.js puts the game objects on window
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const r3 = (v) => [v.x, v.y, v.z].map((n) => +n.toFixed(3));

// ------------------------------------------------------------------ helpers
const patched = [];
// replace a method for this story only (fresh() puts every one back)
function stub(obj, key, fn) {
  patched.push([obj, key, Object.prototype.hasOwnProperty.call(obj, key), obj[key]]);
  obj[key] = fn;
}
const offs = [];
// record every payload of a bus event during this story (stopped by fresh/restore)
function record(type) { const log = []; offs.push(bus.on(type, (p) => log.push(p))); return log; }
function restore() {
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
const step = (n, until) => { for (let i = 0; i < n; i++) { G().GAME.step(1 / 60); if (until && until(i)) return i; } return n; };
// hold keys for some seconds (jumpEvery: queue a jump every n frames); picks any card that opens
function sim(secs, keys = [], jumpEvery = 0) {
  const { input, menus, player } = G();
  input.keys = new Set(keys);
  step(Math.round(secs * 60), (i) => {
    if (jumpEvery && i % jumpEvery === 0) input.jumpQueued = true;
    if (menus.open) document.querySelector('.jf-card')?.click();
  });
  input.keys = new Set();
  return { pos: r3(player.position), grounded: player.grounded };
}
const spawn = (type, at, { still = false, hp } = {}) => {
  const e = G().enemies.spawn(type, at);
  e.spawnT = 1;
  if (still) e.hold = true;           // its behaviour words don't run: it just stands there
  if (hp) e.hp = e.maxHp = hp;
  return e;
};
const ok = (pass, info = {}) => ({ ok: !!pass, info });
const ELEMENTS_IDS = ['candle', 'battery', 'freezerPack', 'nailPolish', 'paperFan', 'glitter'];

// ------------------------------------------------------------------ the stories
export const STORIES = {};
const story = (name, s) => { STORIES[name] = s; };

// --- getting around: every vent lands where it says, the climbs and walls hold
const VENT_TARGETS = () => G().traversal.vents.map((v) => ({ to: v.to, x: v.x, z: v.z, land: v.land }));
for (const to of ['the sofa', 'the coffee table', 'the media console', 'the desk', 'the lounge chair', 'the stovetop']) {
  story(`traversal/vent-to-${to.replace('the ', '').replace(/ /g, '-')}`, {
    about: `Stepping on the vent flings you onto ${to}.`,
    setup() { fresh({ elites: false }); const v = VENT_TARGETS().find((v) => v.to === to); tp(v.x, 0.05, v.z, 0); },
    play() {
      const v = VENT_TARGETS().find((v) => v.to === to);
      const r = sim(3);
      const [x, y, z] = r.pos, [lx, ly, lz] = v.land;
      return ok(Math.hypot(x - lx, z - lz) < 0.08 && Math.abs(y - ly) < 0.06 && r.grounded, { end: r.pos, target: v.land });
    },
  });
}
let ventHome = null;
story('traversal/moved-vent-still-lands', {
  about: 'A vent moved in the layout editor launches from its new spot and lands on its new target.',
  setup() {
    fresh({ elites: false });
    const { traversal } = G(), v = traversal.vents[0];
    ventHome = [v.at, v.land];
    traversal.placeVent(0, [v.x + 0.15, v.y, v.z - 0.05], [2.6, 0.46, 3.0]);
    tp(v.x, 0.05, v.z, 0);
  },
  play() {
    const r = sim(3);
    G().traversal.placeVent(0, ...ventHome);
    const [x, y, z] = r.pos;
    return ok(Math.hypot(x - 2.6, z - 3.0) < 0.08 && Math.abs(y - 0.46) < 0.06 && r.grounded, { end: r.pos });
  },
});
story('traversal/sofa-climb', {
  about: 'Holding jump against the front of the corduroy sofa climbs it.',
  setup() { fresh({ elites: false }); tp(1.6, 0.05, 2.6, 0); },
  play() { sim(3, ['Space', 'KeyW']); const r = sim(1, ['KeyW']); return ok(r.pos[1] > 0.45, { end: r.pos }); },
});
story('traversal/hallway-walled', {
  about: 'The living room opening into the hallway is walled off in stage 1.',
  setup() { fresh({ elites: false }); tp(3.0, 0.05, 4.6, Math.PI); },
  play() { const r = sim(3, ['KeyW']); return ok(r.pos[2] < 4.83, { end: r.pos }); },
});
story('traversal/touch-stick-past-ring', {
  about: 'On a phone, dragging the joystick past its ring still swims at full speed, not slower.',
  setup() { fresh({ elites: false }); },
  play() {
    const fake = {}, tc = new TouchControls(fake);
    tc.el.setPointerCapture = () => {};
    const at = (type, x, y) => tc.el.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, bubbles: true }));
    at('pointerdown', 10, 300);
    const mag = (dx) => { at('pointermove', 10 + dx, 300); return +Math.hypot(fake.touchMove.x, fake.touchMove.y).toFixed(3); };
    const ring = mag(50), far = mag(150), farther = mag(400);
    at('pointerup', 410, 300);
    return ok(ring === 1 && far === 1 && farther === 1 && fake.touchMove === null, { ring, far, farther });
  },
});
story('traversal/touch-stick-lost-touch', {
  about: 'If a thumb lifts and the phone never says so, the next thumb on the left still gets the stick.',
  setup() { fresh({ elites: false }); },
  play() {
    const fake = {}, tc = new TouchControls(fake);
    tc.el.setPointerCapture = () => {};
    const at = (type, id, x, y) => tc.el.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true }));
    at('pointerdown', 1, 10, 300); at('pointermove', 1, 10, 250);   // this finger's pointerup never comes
    at('pointerdown', 2, 20, 300); at('pointermove', 2, 80, 300);   // a new thumb pushes right
    const took = fake.touchMove && fake.touchMove.x > 0.9;
    at('pointerup', 2, 80, 300);
    return ok(took && fake.touchMove === null, { move: fake.touchMove });
  },
});
story('traversal/force-fields-show', {
  about: 'Every invisible wall in the act (and the boss arena, once the fight starts) has a glowing force field you can see.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run, APT } = G(), fields = [];
    APT.scene.traverse((o) => { if (o.name === 'Force field') fields.push(o); });
    const walls = (run.stage.walls || []).filter((w) => w.max[1] - w.min[1] > 0.2).length;
    const shown = fields.filter((f) => f.visible).length;
    const boss = run.bossWalls.filter((m) => m.userData.field).length;
    return ok(shown === walls && walls > 0 && boss === run.bossWalls.length && fields.every((f) => f.userData.noCollide), { walls, shown, fields: fields.length, boss });
  },
});
// --- the camera (camera.js): up against walls and furniture it looks over them instead of
// collapsing onto the jelly. The tour: the act's start, every vent's landing spot (the raised
// fixtures where the elites are) and the nearest wall or furniture in 8 directions from the
// start, at 16 headings each; then a slow full turn at each spot for sudden jumps.
function cameraSpots(extra = []) {
  const { traversal, run, world } = G(), s = run.stage.start, spots = [[s[0], 0.05, s[2]], ...extra];
  for (const v of traversal.vents) spots.push([v.land[0], v.land[1] + 0.05, v.land[2]]);
  const o = V(s[0], 0.03, s[2]);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4, d = V(Math.sin(a), 0, Math.cos(a)), h = world.castAll(o, d, 3);
    if (h && h.distance > 0.15) spots.push([o.x + d.x * (h.distance - 0.07), 0.05, o.z + d.z * (h.distance - 0.07)]);
  }
  return spots;
}
function cameraTour(spots) {
  const { tpc, world, APT } = G(), cam = tpc.camera.position, last = V(0, 0, 0), toCam = V(0, 0, 0), seen = new Set();
  const want = [tpc.pitch, tpc.distance], programs = APT.renderer.info.programs.length;
  let moved = 0, blocked = 0, jumps = 0, maxJump = 0, views = 0;
  for (const p of spots) {
    for (let k = 0; k < 16; k++) {
      // build the shaders this view needs (see-through copies included) without drawing it: in a
      // software GPU, 240 queued draws became a minutes-long stall a story or two later (#7)
      tp(...p, (k * Math.PI) / 8); step(30); G().batcher.sync(); APT.renderer.compile(APT.scene, APT.camera); views++;
      if (Math.abs(cam.distanceTo(tpc.focus) - want[1]) > 1e-3 || tpc.pitch !== want[0]) moved++;
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
const cameraStory = (extra, under) => ({
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
story('camera/fixed-view-fades-what-blocks', cameraStory([], 'Media_console_6'));
// --- treasures in the room: golden chests, on a schedule (each somewhere else, for a limited
// time) and where elites fall (for good)
const waiting = (timed) => G().run.roomTreasures.filter((t) => t.active && (timed === undefined || t.timed === timed));
story('treasures/appear-on-schedule', {
  about: 'Treasures turn up in the room at 0:15, 1:00, 1:45, 2:45 and 3:45, each somewhere else, and fade after 22 s if nobody takes them.',
  setup() { fresh({ elites: false, treasures: true }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { run } = G(), seen = [], spots = new Set();
    let gone = 0;
    stub(run.hud, 'toast', (text) => { if (/faded/.test(text)) gone++; });
    const wasActive = { v: false };
    for (let i = 0; i < 60 * 240; i++) {
      G().GAME.step(1 / 60);
      const t = waiting(true)[0];
      if (t && !wasActive.v) { seen.push(Math.round(run.t)); spots.add(t.spot.label); }
      wasActive.v = !!t;
    }
    const want = [15, 60, 105, 165, 225];
    return ok(seen.length === 5 && seen.every((t, k) => Math.abs(t - want[k]) <= 1) && gone >= 4 && spots.size >= 4, { seen, gone, spots: [...spots] });
  },
});
story('treasures/elite-chest-never-inside-furniture', {
  about: 'An elite bug beaten under furniture (a covered spot) leaves its chest on the nearest open spot instead: nothing over it or crowding it, easy to touch.',
  setup() { fresh({ treasures: false, elites: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { run, enemies } = G();
    stub(run.hud, 'toast', () => {});
    // find a covered spot on the floor nearby (under a table, the sofa…)
    let at = null;
    for (let x = 1; x <= 5 && !at; x += 0.1) for (let z = 1.5; z <= 5 && !at; z += 0.1) {
      const r = run.openSpot([x, 0.02, z]);
      if (!r.ok && r.why === 'covered overhead') { const h = run.world.castAll(V(x, 0.15, z), V(0, -1, 0), 0.4); if (h && h.point.y < 0.02) at = V(x, h.point.y, z); }
    }
    const bug = enemies.spawn('roach', at, 1, true); bug.spawnT = 1; bug.hold = true;
    enemies.kill(bug);
    step(2);
    const t = waiting(false)[0], open = t && run.openSpot([t.pos.x, t.pos.y, t.pos.z]).ok, d = t && Math.hypot(t.pos.x - at.x, t.pos.z - at.z);
    return ok(!!at && open && d < 0.5, { at: at && r3(at), chest: t && r3(t.pos), open, moved: d && +d.toFixed(2) });
  },
});
story('treasures/touch-the-chest', {
  about: 'A treasure waits in the room as a small golden chest (no beam of light): touching it in time offers a treasure pick, and it goes away.',
  setup() { fresh({ elites: false, treasures: true }); tp(3.2, 0.05, 3.0, 0); G().run.t = 14.9; },
  play() {
    const { run } = G();
    step(30, () => waiting(true).length);
    const t = waiting(true)[0], p = t.pos.clone();
    const size = new THREE.Box3().setFromObject(t.chest).getSize(V(0, 0, 0));
    const small = size.y < 0.05 && size.x < 0.06;            // a chest, not a tall beam
    let offered = false, tiers = [];
    stub(run.ui, 'choose', (tt, s, list) => { offered = true; tiers = list.map((c) => c.rarity); });
    tp(p.x, p.y + 0.01, p.z);
    step(20, () => offered);
    const roomTiers = tiers.every((r) => r === 'common' || r === 'rare');   // a room chest: Common and Rare
    return ok(offered && !t.active && small && roomTiers, { offered, small, tiers, size: r3(size), at: r3(p) });
  },
});
story('treasures/elites-leave-a-chest', {
  about: 'A beaten elite (an elite bug, or one on its high ground) leaves a golden chest near where it fell, on an open spot, with no pick right away and no bonus health; the chest waits for good, and touching it offers the pick.',
  setup() { fresh({ treasures: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { run, enemies } = G();
    let picks = 0, tiers = [];
    stub(run.ui, 'choose', (t, s, list) => { picks++; tiers.push(...list.map((c) => c.rarity)); });
    stub(run.hud, 'toast', () => {});
    const h0 = run.health = 20;
    // an elite bug, 25 cm away
    const bug = enemies.spawn('roach', near(0.25, 0), 1, true); bug.spawnT = 1; bug.hold = true;
    enemies.kill(bug);
    step(2);
    // near where it fell, on an open spot (nothing over or around it)
    const open = (t) => run.openSpot([t.pos.x, t.pos.y, t.pos.z]).ok;
    const fromBug = waiting(false)[0], bugSpot = fromBug && Math.hypot(fromBug.pos.x - bug.pos.x, fromBug.pos.z - bug.pos.z) < 0.5 && open(fromBug);
    // a high-ground elite
    const E = run.elites.alive[0];
    run.eliteDefeated(E);
    const fromElite = waiting(false).find((t) => t !== fromBug), eliteSpot = fromElite && fromElite.pos.distanceTo(E.base) < 0.5 && open(fromElite);
    const noPickYet = picks === 0, noHeal = run.health === h0;
    step(60 * 60);                                          // a minute later, both still wait
    const stayed = waiting(false).length === 2;
    tp(fromBug.pos.x, fromBug.pos.y + 0.01, fromBug.pos.z); step(20, () => picks);
    const eliteTiers = tiers.every((r) => r === 'rare' || r === 'epic');   // an Elite's chest: Rare and Epic
    return ok(bugSpot && eliteSpot && noPickYet && noHeal && stayed && picks === 1 && !fromBug.active && eliteTiers,
      { bugSpot, eliteSpot, noPickYet, noHeal, stayed, picks, tiers, health: run.health });
  },
});

// --- a player's first run (first-run.js): systems arrive one at a time
const modalTitle = () => document.querySelector('.jf-modal h2')?.textContent || '';
const pickFirstCard = () => document.querySelector('.jf-modal .jf-card')?.click();
story('first-run/no-element-pick-at-start', {
  about: 'On a player\'s first run nothing opens on the first frame: no Element pick, just the jelly swimming among roaches while its bubbles fire on their own.',
  setup() { fresh({ elites: false, firstRun: true }); tp(3.2, 0.05, 3.0, 0); spawn('roach', near(0, -0.2), { still: true, hp: 9999 }); },
  play() {
    const { menus, run } = G();
    let blown = 0;
    const was = run.bubbles.onBlow; run.bubbles.onBlow = () => { blown++; was(); };
    step(60 * 3);
    run.bubbles.onBlow = was;
    return ok(!menus.open && run.startPicked && blown > 0, { menu: menus.open, title: modalTitle(), blown });
  },
});
story('first-run/element-pick-after-first-card', {
  about: 'On a first run the Element pick opens right after the first Level-up\'s card, once; the next Level-up is just cards.',
  setup() { fresh({ elites: false, firstRun: true, levels: true }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { menus, run } = G();
    step(5);
    const quietStart = !menus.open;
    run.gainXp(3); step(5);
    const levelTitle = modalTitle();
    pickFirstCard(); step(5);
    const elementTitle = menus.open ? modalTitle() : '';
    pickFirstCard(); step(5);
    const owned = run.owned.size;
    run.gainXp(20); step(5);
    const secondTitle = modalTitle();
    pickFirstCard(); step(5);
    const after = menus.open ? modalTitle() : '';
    menus.close();
    return ok(quietStart && /level/i.test(levelTitle) && /element/i.test(elementTitle) && owned >= 1 && /level/i.test(secondTitle) && !/element/i.test(after),
      { quietStart, levelTitle, elementTitle, owned, secondTitle, after });
  },
});
const hintShown = () => { const h = document.querySelector('#hud .hint'); return h && h.classList.contains('on') ? h.textContent : ''; };
const hitJelly = (n = 1) => { G().run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount: n, source: 'story' }); };
story('first-run/health-hint-on-first-hit', {
  about: 'On a player\'s first run, the first hit shows one plain line about the Health bar for a few seconds; later hits don\'t show it again, and other runs never do.',
  setup() { fresh({ elites: false, firstRun: true, hurt: true }); tp(3.2, 0.05, 3.0, 0); G().run.startPicked = true; },
  play() {
    step(2);
    const before = hintShown();
    hitJelly(); step(2);
    const shown = hintShown();
    step(60 * 6);
    const gone = !/Health/.test(hintShown());
    hitJelly(); step(2);
    const again = /Health/.test(hintShown());
    // another run: never
    fresh({ elites: false, hurt: true }); tp(3.2, 0.05, 3.0, 0);
    hitJelly(); step(2);
    const other = /Health/.test(hintShown());
    return ok(!/Health/.test(before) && /That's your Health, top left\. Run out and the run ends\./.test(shown) && gone && !again && !other, { before, shown, gone, again, other });
  },
});
story('first-run/treasures-wait-for-the-element-pick', {
  about: 'On a player\'s first run no Treasure turns up before the Element pick is done; the first comes at the next scheduled time after it. An Elite still leaves its Treasure, and other runs get theirs at 0:15.',
  setup() { fresh({ elites: false, firstRun: true, treasures: true, levels: true }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { run } = G(), toasts = [];
    stub(run.hud, 'toast', (text) => toasts.push(text));
    const sched = () => run.roomTreasures.find((t) => t.active && t.timed);
    step(60 * 20);                                         // past 0:15, no Element pick yet
    const before = !!sched();
    run.gainXp(3); step(3); pickFirstCard(); step(3);      // the first card, then the Element pick
    const elementOpen = /element/i.test(modalTitle());
    pickFirstCard(); step(3);
    const t0 = run.t;
    step(60 * 45, () => sched());                          // the next scheduled time is 1:00
    const at = Math.round(run.t), first = !!sched(), told = toasts.some((t) => /A treasure appeared/.test(t));
    run.dropTreasure(near(0.2, 0));                        // an Elite's Treasure still drops on a first run
    const eliteChest = run.roomTreasures.some((t) => t.active && !t.timed);
    // another run: the first one at 0:15
    fresh({ elites: false, treasures: true }); tp(3.2, 0.05, 3.0, 0);
    step(60 * 17, () => sched());
    const otherAt = Math.round(G().run.t);
    return ok(!before && elementOpen && first && Math.abs(at - 60) <= 1 && told && eliteChest && Math.abs(otherAt - 15) <= 1,
      { before, elementOpen, t0: Math.round(t0), at, first, told, eliteChest, otherAt });
  },
});
const mapShown = () => { const m = document.querySelector('#hud .map'); return !!m && !m.hidden && getComputedStyle(m).display !== 'none'; };
story('first-run/minimap-with-the-first-treasure', {
  about: 'On a player\'s first run the minimap is hidden until the first Treasure appears in the room (scheduled, or left by an Elite), then stays; other runs show it from the start.',
  setup() { fresh({ elites: false, firstRun: true }); tp(3.2, 0.05, 3.0, 0); G().run.startPicked = true; },
  play() {
    const { run } = G();
    step(5);
    const hiddenAtStart = !mapShown();
    run.dropTreasure(near(0.3, 0)); step(3);               // an Elite's Treasure counts as the first
    const shownWithChest = mapShown();
    run.roomTreasures.forEach((t) => t.hide()); step(60 * 3);
    const stays = mapShown();
    // a scheduled one also counts
    fresh({ elites: false, firstRun: true, treasures: true }); tp(3.2, 0.05, 3.0, 0); G().run.startPicked = true;
    run.firstRun.elementChosen = true;                     // past the Element pick, so the 0:15 one comes
    step(5);
    const hiddenAgain = !mapShown();
    step(60 * 16, () => run.roomTreasures.some((t) => t.active));
    const shownWithScheduled = mapShown();
    // another run: shown from the start
    fresh({ elites: false }); step(3);
    const other = mapShown();
    return ok(hiddenAtStart && shownWithChest && stays && hiddenAgain && shownWithScheduled && other,
      { hiddenAtStart, shownWithChest, stays, hiddenAgain, shownWithScheduled, other });
  },
});
// The whole first minute of a player's first run, played like a player would (desktop and phone):
// the real waves run, cards and Element picks are taken as they come, and the story records when
// each thing first happens, then checks the order: moving only at first (no menu, no minimap), the
// Health hint on the first hit, the first card, the Element pick straight after it, then the first
// Treasure at the first scheduled time after that, with the minimap. Plenty of Health, so the
// minute can't end early; a nudge of XP if no Level-up has come by 0:40.
function firstMinute() {
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
story('first-run/the-first-minute', {
  about: 'A player\'s first minute, in order: swimming among roaches with bubbles firing on their own (no menu, no minimap), the Health hint on the first hit, the first card, the Element pick, then the first Treasure at 1:00 with the minimap.',
  setup() {},
  play: firstMinute,
});
story('first-run/other-runs-unchanged', {
  about: 'Any run that isn\'t a player\'s first opens the Element pick on the first frame, as before.',
  setup() { fresh({ elites: false }); G().run.startPicked = false; },
  play() {
    const { menus } = G();
    step(2);
    const title = modalTitle();
    menus.close();
    return ok(/element/i.test(title), { title });
  },
});
// play as a brand-new player for a moment: no record of a finished run, no saved best (put back after)
function asNewPlayer(fn) {
  const keys = [PLAYED_KEY, BEST_KEY], saved = keys.map((k) => localStorage.getItem(k));
  try { keys.forEach((k) => localStorage.removeItem(k)); return fn(); }
  finally { keys.forEach((k, i) => (saved[i] === null ? localStorage.removeItem(k) : localStorage.setItem(k, saved[i]))); }
}
story('first-run/who-is-new', {
  about: 'A player is new until a run of theirs ends (dried out, or the boss beaten); one with a saved best score is not new; a new run (as after a reload) keeps them new.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run } = G();
    stub(run.ui, 'choose', () => {});                     // the metamorphosis pick
    const r = asNewPlayer(() => {
      const fresh0 = isNewPlayer();
      run.start();
      const active = run.firstRun.active, still = isNewPlayer();
      run.die();
      const afterDeath = isNewPlayer();
      localStorage.removeItem(PLAYED_KEY);
      run.start(); run.metamorph();                       // the boss beaten
      const afterBoss = isNewPlayer();
      localStorage.removeItem(PLAYED_KEY); localStorage.setItem(BEST_KEY, JSON.stringify({ score: 10 }));
      const withBest = isNewPlayer();
      localStorage.removeItem(BEST_KEY); markPlayed();
      const marked = isNewPlayer();
      return { fresh0, active, still, afterDeath, afterBoss, withBest, marked };
    });
    return ok(r.fresh0 && r.active && r.still && !r.afterDeath && !r.afterBoss && !r.withBest && !r.marked, r);
  },
});
story('first-run/dev-runs-dont-count', {
  about: 'The dev modes (1 on 1, fight the boss) never run in first-run mode, and dying in one doesn\'t use up a new player\'s first run.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run } = G();
    const r = asNewPlayer(() => {
      run.startDuel(run.duelChoices().find((p) => !p.elite && !p.act) || run.duelChoices()[0]);
      const duelActive = run.firstRun.active;
      run.die();
      const stillNew = isNewPlayer();
      run.start(); run.devRun(); run.startBossIntro();
      const bossActive = run.firstRun.active;
      return { duelActive, stillNew, bossActive };
    });
    G().menus.close();
    return ok(!r.duelActive && r.stillNew && !r.bossActive, r);
  },
});

// --- movement
story('movement/jelly-steady-speed', {
  about: 'The jelly swims at a steady 0.42 m/s: the bell pulses, the speed does not.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.7, 0); },
  play() {
    const { player, input } = G();
    input.keys = new Set(['KeyW']);
    step(30);
    const s = [];
    for (let i = 0; i < 60; i++) { const p0 = player.position.clone(); G().GAME.step(1 / 60); s.push(Math.hypot(player.position.x - p0.x, player.position.z - p0.z) * 60); }
    input.keys = new Set();
    const min = Math.min(...s), max = Math.max(...s);
    return ok(Math.abs(min - 0.42) < 0.01 && Math.abs(max - 0.42) < 0.01, { min: +min.toFixed(3), max: +max.toFixed(3) });
  },
});
story('movement/roach-slower-than-jelly', {
  about: 'A cockroach chases at 0.3 m/s, slower than the jelly, so one can always be outswum.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 4.0, 0); spawn('roach', V(3.2, 0, 2.3)); },
  play() {
    const e = G().enemies.list[0];
    step(40); const a = e.pos.clone(); step(60);
    const v = e.pos.distanceTo(a);
    return ok(Math.abs(v - 0.3) < 0.02 && v < CONFIG.player.walkSpeed, { roach: +v.toFixed(3), jelly: CONFIG.player.walkSpeed });
  },
});

// --- the bubble stream
story('attack/bubble-stream', {
  about: 'With one bubble, bubbles come out one at a time (never two in a frame), about 1.76 a second to start.',
  setup() { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const P = G().player.position; spawn('roach', P.clone().add(V(0, 0, -0.2)), { still: true, hp: 9999 }); },
  play() {
    const { run, enemies } = G();
    const e = enemies.list[0], home = e.pos.clone(), born = [];
    let f = 0;
    const blow = run.bubbles.blow.bind(run.bubbles);
    stub(run.bubbles, 'blow', (...a) => { born.push(f); return blow(...a); });
    for (f = 0; f < 600; f++) { G().GAME.step(1 / 60); e.pos.copy(home); }
    const perSec = born.length / 10, sameFrame = born.filter((x, i) => i && born[i - 1] === x).length;
    const dps = (9999 - e.hp) / 10;
    return ok(Math.abs(perSec - 1.76) < 0.25 && sameFrame === 0 && dps > 8, { perSec, sameFrame, dps: +dps.toFixed(1) });
  },
});

story('attack/side-by-side-bubbles', {
  about: 'With 3 bubbles, each blow is 3 bubbles leaving at the same moment side by side, flying parallel, each doing 72% damage (15% less per extra bubble).',
  setup() { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const P = G().player.position; spawn('roach', P.clone().add(V(0, 0, -0.25)), { still: true, hp: 9999 }); G().run.stats.bubbles = 3; },
  play() {
    const { run } = G();
    const born = [];
    let f = 0;
    const blow = run.bubbles.blow.bind(run.bubbles);
    stub(run.bubbles, 'blow', (...a) => { const b = blow(...a); born.push({ f, b }); return b; });
    for (f = 0; f < 120 && born.length < 3; f++) G().GAME.step(1 / 60);
    const first = born.slice(0, 3), b = first.map((x) => x.b);
    step(4);
    const sameFrame = first.every((x) => x.f === first[0].f);
    const dirs = b.map((x) => x.vel.clone().setY(0).normalize());
    const parallel = dirs.every((d) => d.dot(dirs[0]) > 0.995);
    const gaps = [b[0].m.position.distanceTo(b[1].m.position), b[1].m.position.distanceTo(b[2].m.position)];
    const dmg = b[0].dmg / run.S.bubbleDamage;
    return ok(first.length === 3 && sameFrame && parallel && gaps.every((g) => g > 0.01) && Math.abs(dmg - 0.85 ** 2) < 1e-6,
      { n: first.length, sameFrame, parallel, gaps: gaps.map((g) => +g.toFixed(3)), dmg: +dmg.toFixed(3) });
  },
});

story('attack/element-projectiles', {
  about: 'Each element is an attack of its own: it fires its own projectile (a fireball, ball lightning, an ice shard, an acid glob, a wind gust, a glitter bomb) on its own timer, while the bubbles stay plain bubbles; the lightning one crackles with arcs.',
  setup() { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const P = G().player.position; spawn('roach', P.clone().add(V(0, 0, -0.25)), { still: true, hp: 1e6 }); },
  play() {
    const { run } = G();
    const seen = {};
    let arcs = 0, plainOnly = true;
    for (const [id, el] of [['candle', 'fire'], ['battery', 'lightning'], ['freezerPack', 'ice'], ['nailPolish', 'acid'], ['paperFan', 'wind'], ['glitter', 'glitter']]) {
      run.owned = new (run.owned.constructor)(); run.owned.add(id);
      run.bubbles.reset(); run.bubbles.timer = 1; run.bubbles.elTimers[el] = 1;
      step(6);
      const looks = run.bubbles.list.map((b) => b.m.userData.look || null);
      seen[el] = looks.find(Boolean) || null;
      if (!looks.includes(null)) plainOnly = false;            // a plain bubble flew alongside it
      if (el === 'lightning') arcs = run.bubbles.looks.arcN;
    }
    const all = Object.entries(seen).every(([el, look]) => el === look);
    return ok(all && plainOnly && arcs > 0, { seen, plainOnly, arcs });
  },
});
story('treasures/element-rewards', {
  about: 'Base elements are Legendary and never come from treasure chests: the start of a run offers 3 Legendary elements you don\'t have (and only elements). Element upgrades never turn up in an ordinary pick: owning fire, chests 1, 2, 4 and 5 offer none and chests 3 and 6 offer exactly one (a fire one); with no element, the 3rd chest is three ordinary treasures.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { run, menus } = G();
    const isUp = (t) => t.vocabulary.includes('element-up');
    let starts = 0, sample = null;
    stub(menus, 'choose', (title, sub, list) => {
      if (list.length === 3 && list.every((t) => ELEMENTS_IDS.includes(t.id) && !run.owned.has(t.id) && t.tier?.name === 'Legendary')) starts++;
      sample = list.map((t) => t.id);
    });
    for (let i = 0; i < 60; i++) run.pickElement('start', '');
    // a run with fire: count upgrades per chest, over many runs' first six chests
    let wrong = [], baseEl = 0;
    let ups = [];
    stub(menus, 'choose', (title, sub, list) => { ups.push(list.filter(isUp)); if (list.some((t) => ELEMENTS_IDS.includes(t.id))) baseEl++; });
    for (let r = 0; r < 40; r++) {
      run.owned.clear(); run.owned.add('candle'); run.chestsOpened = 0; ups = [];
      for (let c = 0; c < 6; c++) run.pickTreasure('', '', c % 2 ? 'elite' : 'room');
      ups.forEach((u, i) => {
        const want = (i + 1) % 3 === 0 ? 1 : 0;
        if (u.length !== want || u.some((t) => t.needs !== 'candle')) wrong.push(`chest ${i + 1}: ${u.map((t) => t.id)}`);
      });
    }
    // no element: the 3rd chest is three ordinary treasures
    run.owned.clear(); run.chestsOpened = 2; ups = [];
    let third = null;
    stub(menus, 'choose', (title, sub, list) => { third = list; });
    run.pickTreasure('', '', 'room');
    restore();
    const plainThird = third?.length === 3 && !third.some(isUp);
    return ok(starts === 60 && !wrong.length && !baseEl && plainThird, { starts, wrong: wrong.slice(0, 5), baseEl, plainThird, sample });
  },
});
story('enemies/ants-curl-and-roll', {
  about: 'An ant squad curls into a ball and rolls at you.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const P = G().player.position; spawn('ants', P.clone().add(V(0.25, 0, 0))); },
  play() {
    const e = G().enemies.list[0];
    const seen = new Set();
    step(60 * 6, () => { seen.add(e.state); return seen.has('dash'); });
    return ok(seen.has('windup') && seen.has('dash'), { states: [...seen] });
  },
});
story('enemies/mosquito-spits', {
  about: 'A mosquito hovers out of reach and its spit costs you health.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const P = G().player.position; spawn('mosquito', P.clone().add(V(0, 0.1, -0.15))); },
  play() {
    const { run } = G();
    run.iFrames = 0;
    const m0 = run.health;
    step(60 * 10, () => run.health < m0);
    return ok(run.health < m0, { lost: +(m0 - run.health).toFixed(2) });
  },
});

// --- progression
story('progression/luck', {
  about: 'Luck (a level-up card) makes rarer level-up cards and treasures come up more often.',
  setup() {},
  play() {
    const share = (luck) => {
      let epic = 0, cards = 0, top = 0, treasures = 0;
      for (let i = 0; i < 1500; i++) {
        for (const c of rollCards({ bubbles: 2 }, 3, 0, luck)) { cards++; if (c.rarity.id === 'epic') epic++; }
        for (const t of rollTreasures(CONTENT.treasures, 3, luck)) { treasures++; if (t.rarity === 'epic') top++; }
      }
      return { epicCards: +(epic / cards).toFixed(3), epicTreasures: +(top / treasures).toFixed(3) };
    };
    const none = share(0), lucky = share(60);
    return ok(lucky.epicCards > none.epicCards * 1.6 && lucky.epicTreasures > none.epicTreasures * 1.4, { none, lucky });
  },
});
story('content/every-treasure-has-a-rarity', {
  about: 'Every treasure is rated common, rare, epic or legendary, every rarity has treasures, and every element is Legendary.',
  setup() {},
  play() {
    const ids = TREASURE_RARITY.map((r) => r.id), count = Object.fromEntries(ids.map((id) => [id, 0]));
    for (const t of CONTENT.treasures) count[t.rarity] = (count[t.rarity] ?? NaN) + 1;
    const plainElements = CONTENT.treasures.filter((t) => t.vocabulary.includes('element') && t.rarity !== 'legendary').map((t) => t.id);
    return ok(ids.every((id) => count[id] > 0) && Object.keys(count).length === ids.length && !plainElements.length, { ...count, plainElements });
  },
});
story('progression/regen', {
  about: 'Health regen (a card or Hand Cream) refills health every second.',
  setup() { fresh({ elites: false, lash: false, bubbles: false }); tp(3.2, 0.05, 3.0, 0); G().run.stats.regen = 0.5; G().run.health = 10; },
  play() { step(60 * 4); const m = G().run.health; return ok(Math.abs(m - 12) < 0.05, { health: +m.toFixed(2) }); },
});
story('progression/dodge', {
  about: 'Dodge % makes that share of hits miss (starts at 0, capped at 60).',
  setup() { fresh({ elites: false, lash: false, bubbles: false, hurt: true }); tp(3.2, 0.05, 3.0, 0); G().run.stats.dodge = 50; },
  play() {
    const { run } = G();
    let missed = 0;
    for (let i = 0; i < 200; i++) { run.health = 50; run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount: 1, source: 'story' }); if (run.health === 50) missed++; }
    run.stats.dodge = 500;
    return ok(missed > 70 && missed < 130 && run.S.dodge === 60, { missed, of: 200, capped: run.S.dodge });
  },
});
story('progression/level-curve', {
  about: 'Each level needs 1.45x the XP of the last, starting at 3: three cockroaches (1 XP each) is level 2.',
  setup() { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { run } = G(), curve = [1, 2, 3, 4, 5, 6].map(xpToNext);
    let killed = 0;
    for (let k = 0; k < 3; k++) {
      const e = spawn('roach', near(0, -0.15), { still: true, hp: 1 });
      step(240, () => e.dead);
      if (e.dead) killed++;
      tp(e.pos.x, 0.05, e.pos.z);                  // swim over to where it burst and pick up the XP
      step(120);
    }
    const ok1 = curve.join() === '3,4,6,9,13,19' && killed === 3 && run.level === 2 && xpToNext(run.level) === 4;
    return ok(ok1, { curve, killed, level: run.level, xp: run.xp });
  },
});

// --- the vocabulary: one story per behaviour word (src/words.js), proving what it does
const near = (dx, dz, dy = 0) => G().player.position.clone().add(V(dx, dy, dz));
story('words/chase', {
  about: 'chase: a cockroach walks straight at you.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('roach', near(0.35, 0)); },
  play() { const e = G().enemies.list[0], d0 = e.pos.distanceTo(G().player.position); step(60); const d1 = e.pos.distanceTo(G().player.position); return ok(d0 - d1 > 0.2, { before: +d0.toFixed(3), after: +d1.toFixed(3) }); },
});
story('words/curl-dash', {
  about: 'curl-dash: an ant squad stops, curls into a ball, and rolls at you.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('ants', near(0.25, 0)); },
  play() {
    const e = G().enemies.list[0], seen = new Set();
    let dashSpeed = 0;
    step(60 * 6, () => { seen.add(e.state); if (e.state === 'dash') dashSpeed = Math.max(dashSpeed, Math.hypot(e.vel.x, e.vel.z)); return seen.has('rest'); });
    return ok(seen.has('windup') && seen.has('dash') && dashSpeed > 0.5, { states: [...seen], dashSpeed: +dashSpeed.toFixed(2) });
  },
});
story('enemies/spider-web-ball', {
  about: 'The house spider walks on alternating sets of legs, rears up to aim, and lobs a web ball that arcs (rising, then falling) onto you: it stings and slows you.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('spider', near(0, -0.85)); e.shootT = 99; },
  play() {
    const { run, enemies } = G(), e = enemies.list[0];
    const log = record('damage_taken');
    // walking: its legs move (the model animates with its speed)
    step(40);
    const moved = e.pos.distanceTo(G().player.position) < 0.78;
    e.shootT = 0.7;
    let reared = false, ys = [], hit = null, slowed = 0;
    step(60 * 4, () => {
      if (e.aimT > 0) reared = true;
      const s = enemies.shots.find((q) => q.web);
      if (s) ys.push(s.m.position.y);
      e.pos.copy(near(0, -0.6));                     // hold it at range so it shoots
      hit = log.find((d) => d.source === 'web');
      if (hit) slowed = run.slowT;
      return !!hit;
    });
    const peak = Math.max(...ys), arcs = ys.length > 3 && peak > ys[0] + 0.005 && ys[ys.length - 1] < peak;
    return ok(moved && reared && arcs && hit && hit.amount === 2 && slowed > 1, { moved, reared, arcs, peak: +peak.toFixed(3), hit: hit?.amount, slowed: +slowed.toFixed(2) });
  },
});
story('words/poke', {
  about: 'The house fly buzzes in beside you, rubs its front legs and draws back while a short line on the floor marks its strike, then pokes you with its straw of a mouth: 3 damage.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('housefly', near(0.2, 0, 0.03)); e.pokeCd = 0.8; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken');
    let warned = false, out = 0, hit = null, closest = 9;
    step(60 * 5, () => {
      if (e.state === 'windup' && enemies.pokeMarks.some((m) => m.visible)) warned = true;
      if (e.state === 'poke') out = Math.max(out, e.pokeK);
      closest = Math.min(closest, e.pos.distanceTo(player.position.clone().setY(player.position.y + CONFIG.player.height * 0.5)));
      hit = log.find((d) => d.source === 'housefly' && d.amount === 3);
      return !!hit;
    });
    return ok(warned && out === 1 && hit && closest > 0.06, { warned, out, hit: hit?.amount, closest: +closest.toFixed(3) });
  },
});
story('enemies/housefly-poke-dodge', {
  about: 'Backing out of the fly\'s reach once its aim locks makes the poke miss.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('housefly', near(0.2, 0, 0.03)); e.pokeCd = 0.8; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken');
    let moved = false, poked = false;
    step(60 * 5, () => {
      if (!moved && e.state === 'windup' && e.faceLock) {
        // step straight back from it, out of reach
        const d = player.position.clone().sub(e.pos).setY(0).normalize(), P = player.position;
        tp(P.x + d.x * 0.12, P.y, P.z + d.z * 0.12);
        moved = true;
      }
      if (e.state === 'poke') poked = true;
      return poked && e.state === 'rest';
    });
    const pokes = log.filter((d) => d.amount === 3);
    return ok(moved && poked && !pokes.length, { moved, poked, hits: log.map((d) => d.amount) });
  },
});
story('enemies/spider-keeps-its-distance', {
  about: 'Left to itself, the house spider stalks to about 30 cm from you and stays there (backing off if you close in), lobbing webs from range instead of walking into you.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('spider', near(0, -0.55)); },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken');
    let launched = 0, was = 0, closest = 9;
    step(60 * 10, (i) => {
      const n = enemies.shots.filter((q) => q.web).length;
      if (n > was) launched++;
      was = n;
      if (i > 120) closest = Math.min(closest, Math.hypot(e.pos.x - player.position.x, e.pos.z - player.position.z));
    });
    // walk up to it: it backs away
    const before = Math.hypot(e.pos.x - player.position.x, e.pos.z - player.position.z);
    tp(e.pos.x + (player.position.x - e.pos.x) * 0.4, player.position.y, e.pos.z + (player.position.z - e.pos.z) * 0.4);
    const p0 = e.pos.clone(), toMe = player.position.clone().sub(e.pos).setY(0).normalize();
    step(30);
    const backed = e.pos.clone().sub(p0).setY(0).dot(toMe) < -0.01;
    const webs = log.filter((d) => d.source === 'web').length, bumps = log.filter((d) => d.source === 'spider').length;
    return ok(closest > 0.4 && launched >= 2 && webs >= 1 && !bumps && backed, { closest: +closest.toFixed(3), launched, webs, bumps, backed, before: +before.toFixed(3) });
  },
});
story('words/ball-charge', {
  about: 'The millipede curls into a ball (hits on it do 75% less while curled), revs up spinning while its lane lights up on the floor, then rolls into you for 4. Once it uncurls it can be hurt again.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('millipede', near(0, -0.32)); e.ballCd = 0.3; },
  play() {
    const { enemies } = G(), e = enemies.list[0], log = record('damage_taken');
    const seen = new Set();
    let warned = false, armored = null, spun = 0, hit = null;
    step(60 * 6, () => {
      seen.add(e.state);
      if (e.state === 'spin' && enemies.chargeMarks.some((m) => m.visible)) warned = true;
      if (e.state === 'spin' && armored === null) { const hp = e.hp; enemies.applyDamage(e, 20); armored = Math.abs(hp - e.hp - 5) < 1e-6; }   // 20 hits for 5
      spun = Math.max(spun, e.spinA || 0);
      hit = hit || log.find((d) => d.source === 'millipede' && d.amount === 4);
      return hit && e.state === 'rest';
    });
    const hp = e.hp;
    enemies.applyDamage(e, 10);
    const hurtAfter = e.hp === hp - 10;
    return ok(['curl', 'spin', 'dash'].every((s) => seen.has(s)) && warned && armored && spun > 5 && hit && hurtAfter,
      { states: [...seen], warned, armored, spun: +spun.toFixed(1), hit: hit?.amount, hurtAfter });
  },
});
story('enemies/millipede-dodge', {
  about: 'Stepping out of the millipede\'s lane once its aim locks makes it roll past you.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('millipede', near(0, -0.32)); e.ballCd = 0.3; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken');
    let moved = false, rolled = false;
    step(60 * 6, () => {
      if (!moved && e.state === 'spin' && e.stateT < (e.spinMax || 0.9) * 0.4) {
        const d = e.dashDir, P = player.position;
        tp(P.x - d.z * 0.16, P.y, P.z + d.x * 0.16);
        moved = true;
      }
      if (e.state === 'dash') rolled = true;
      return rolled && e.state === 'rest';
    });
    const rolls = log.filter((d) => d.amount === 4);
    return ok(moved && rolled && !rolls.length, { moved, rolled, hits: log.map((d) => d.amount) });
  },
});
story('enemies/millipede-slithers', {
  about: 'The millipede snakes toward you from side to side, its body following the path its head took.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('millipede', near(0, -0.9)); e.ballCd = 99; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0];
    const start = e.pos.clone(), path = [];
    step(60 * 2.5, () => { path.push(e.pos.clone()); });
    // sideways wander from the straight line toward you
    const dir = player.position.clone().sub(start).setY(0).normalize(), side = new THREE.Vector3(-dir.z, 0, dir.x);
    const offs = path.map((p) => p.clone().sub(start).dot(side)), weave = Math.max(...offs) - Math.min(...offs);
    // the tail lies back along the path, a body length behind the head
    e.root.updateMatrixWorld(true);
    const tail = e.mesh.children[0].children.at(-1).getWorldPosition(new THREE.Vector3());
    const behind = tail.distanceTo(e.pos), along = path.some((p) => p.distanceTo(tail) < 0.06);
    return ok(weave > 0.02 && behind > 0.15 && along, { weave: +weave.toFixed(3), behind: +behind.toFixed(3), along });
  },
});
story('enemies/millipede-never-overlaps', {
  about: 'However you dart round behind it, the millipede\'s body never folds through itself: it swings round in arcs and its rings keep apart.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('millipede', near(0, -0.5)); e.ballCd = 99; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0];
    const segs = e.mesh.children[0].children, wide = 0.92 * e.r, v = new THREE.Vector3(), pts = segs.map(() => new THREE.Vector3());
    let worst = 9, at = 0;
    step(60 * 6, (i) => {
      // keep darting round behind it, so it has to turn right round to follow
      if (i % 50 === 0) {
        const c = e.pos, side = (i / 50) % 2 ? 1 : -1;
        tp(c.x - Math.sin(e.root.rotation.y) * 0.2 + Math.cos(e.root.rotation.y) * 0.06 * side, player.position.y, c.z - Math.cos(e.root.rotation.y) * 0.2 - Math.sin(e.root.rotation.y) * 0.06 * side);
      }
      if (i < 30) return;
      e.root.updateMatrixWorld(true);
      segs.forEach((s, k) => s.getWorldPosition(pts[k]));
      for (let a2 = 0; a2 < pts.length; a2++) for (let b = a2 + 3; b < pts.length; b++) {
        const d = v.copy(pts[a2]).sub(pts[b]).setY(0).length();
        if (d < worst) { worst = d; at = i; }
      }
    });
    return ok(worst > wide * 0.75, { worst: +worst.toFixed(4), wide: +wide.toFixed(4), frame: at });
  },
});
story('bubbles/never-linger', {
  about: 'With six bubbles a blow, the outside ones (aimed to the side of the target) fly on past and pop at the end of their range: none slow down and hang in the air.',
  setup() { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); G().run.stats.bubbles = 6; const e = spawn('roach', near(0, -0.25), { still: true, hp: 1e6 }); },
  play() {
    const { run } = G();
    let oldest = 0, slowest = 9, blown = 0;
    step(60 * 6, () => {
      for (const b of run.bubbles.list) { oldest = Math.max(oldest, b.t); if (b.t > 0.1) slowest = Math.min(slowest, b.vel.length()); }
      blown = Math.max(blown, run.bubbles.list.length);
    });
    return ok(blown >= 6 && oldest < 1.5 && slowest > 0.2, { blown, oldest: +oldest.toFixed(2), slowest: +slowest.toFixed(3) });
  },
});
story('words/sortie', {
  about: 'The ladybug flies round you, lands, lifts its red carapace and locks on (a red reticle closing in round you), then fires a homing missile that hits you for 3.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('ladybug', near(0.3, 0, 0.12)); e.stateT = 1.2; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken');
    const seen = new Set();
    let flewHigh = false, landedLow = false, raised = false, reticle = false, launched = false, hit = null;
    step(60 * 8, () => {
      seen.add(e.state);
      if (e.state === 'approach' && e.pos.y > player.position.y + 0.07) flewHigh = true;
      if (e.state === 'aim') { if (Math.abs(e.pos.y - 0.76 * e.r - player.position.y) < 0.02) landedLow = true; if (e.shellK === 1) raised = true; if (enemies.lockMarks.some((m) => m.visible)) reticle = true; }
      if (enemies.missiles.length) launched = true;
      hit = log.find((d) => d.source === 'missile');
      return !!hit;
    });
    return ok(flewHigh && landedLow && raised && reticle && launched && hit?.amount === 3, { states: [...seen], flewHigh, landedLow, raised, reticle, launched, hit: hit?.amount });
  },
});
story('enemies/ladybug-missile-glows', {
  about: 'A missile in flight glows orange at its tail and red at its seeker: every glow it adds has a real colour (no black blobs).',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('ladybug', near(0.3, 0, 0.12)); e.stateT = 0.3; },
  play() {
    const { enemies, fx } = G(), bad = [];
    const hold = fx.glow.hold.bind(fx.glow);
    stub(fx.glow, 'hold', (p, c, ...r) => { if (!c || !c.isColor) bad.push(String(c)); return hold(p, c, ...r); });
    let flew = false;
    step(60 * 5, () => { if (enemies.missiles.some((m) => m.state === 'home')) flew = true; return flew && bad.length > 0; });
    return ok(flew && !bad.length, { flew, bad: bad.slice(0, 3) });
  },
});
story('enemies/ladybug-missile-runs-out', {
  about: 'A homing missile hunts you for 4 s; if it hasn\'t caught you by then it sputters out, falls to the floor and fizzles away.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('ladybug', near(0.3, 0, 0.12)); e.stateT = 0.3; },
  play() {
    const { enemies } = G(), log = record('damage_taken');
    let m = null, sputterAt = null, minY = 9, down = false, gone = false;
    step(60 * 14, () => {
      if (!m && enemies.missiles.length) { m = enemies.missiles[0]; m.speed = 0.04; }   // too slow to ever catch you
      if (m) {
        if (m.state === 'sputter' && sputterAt === null) sputterAt = m.t;
        if (m.state === 'sputter') minY = Math.min(minY, m.m.position.y);
        if (m.state === 'down') down = true;
        if (down && !enemies.missiles.includes(m)) gone = true;
      }
      return gone;
    });
    return ok(m && Math.abs(sputterAt - 4) < 0.05 && down && gone && !log.some((d) => d.source === 'missile'), { sputterAt: sputterAt && +sputterAt.toFixed(2), down, gone, hits: log.map((d) => d.source) });
  },
});
story('enemies/ladybug-missile-can-be-shaken', {
  about: 'The missile can only turn so fast: swimming hard across its path makes it overshoot.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('ladybug', near(0.3, 0, 0.12)); e.stateT = 0.3; },
  play() {
    const { enemies, player } = G(), log = record('damage_taken');
    let m = null, dodged = false;
    step(60 * 12, (i) => {
      if (!m && enemies.missiles.length) m = enemies.missiles[0];
      if (m && m.state === 'home' && !dodged && m.m.position.distanceTo(player.position) < 0.12) {
        // sidestep hard, square to its flight
        const d = m.vel.clone().setY(0).normalize(), P = player.position;
        tp(P.x - d.z * 0.12, P.y, P.z + d.x * 0.12);
        dodged = true;
      }
      return m && !enemies.missiles.includes(m);
    });
    return ok(dodged && !log.some((d) => d.source === 'missile'), { dodged, hits: log.map((d) => d.source) });
  },
});
story('words/hover', {
  about: 'hover: a mosquito circles about 20 cm from you, above your head.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('mosquito', near(0.4, 0, 0.1)); e.shootT = 99; },
  play() {
    const e = G().enemies.list[0], pc = () => G().player.position.clone().setY(G().player.position.y + CONFIG.player.height * 0.5);
    step(60 * 4);
    const flat = Math.hypot(e.pos.x - pc().x, e.pos.z - pc().z), above = e.pos.y - pc().y;
    return ok(Math.abs(flat - 0.2) < 0.06 && above > 0.03, { flat: +flat.toFixed(3), above: +above.toFixed(3) });
  },
});
story('words/spit', {
  about: 'spit: a mosquito dips its nose and spits; the shot costs you health.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('mosquito', near(0, -0.15, 0.1)); },
  play() {
    const { run } = G();
    run.iFrames = 0;
    const m0 = run.health, e = G().enemies.list[0];
    let aimed = false;
    step(60 * 10, () => { if (e.aimT > 0) aimed = true; return run.health < m0; });
    return ok(aimed && run.health < m0, { aimed, lost: +(m0 - run.health).toFixed(2) });
  },
});
story('words/spit-dodge', {
  about: 'spit: the laser flies down its aiming line, so stepping off the line after it locks on dodges it.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('mosquito', near(0, -0.2, 0.1)); e.shootT = 0.6; },
  play() {
    const { run, enemies } = G(), e = enemies.list[0], P = G().player.position;
    run.iFrames = 0;
    const m0 = run.health;
    let shot = false;
    // wait until the aim has locked, then slip 6 cm to the side
    step(60, () => e.aimT > 0 && e.aimT < 0.2);
    tp(P.x + 0.06, P.y, P.z);
    step(90, () => { if (enemies.shots.length) shot = true; });
    return ok(shot && run.health === m0, { shot, lost: m0 - run.health });
  },
});
story('words/leap', {
  about: 'leap: a lanternfly crawls up, crouches over a marked landing spot, springs high and slams down on you.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('lanternfly', near(0, -0.45)); e.leapCd = 0; },
  play() {
    const { run, enemies } = G(), e = enemies.list[0], y0 = e.pos.y;
    run.iFrames = 0;
    const m0 = run.health, seen = new Set();
    let top = 0, mark = null;
    step(60 * 8, () => {
      seen.add(e.state);
      if (e.state === 'leap') top = Math.max(top, e.pos.y - y0);
      if (e.state === 'crouch' && enemies.leapMarks[0]?.visible) mark = true;
      return run.health < m0;
    });
    const ok1 = ['approach', 'crouch', 'leap', 'rest'].every((s) => seen.has(s)) && top > 0.15 && mark && m0 - run.health === 3;
    return ok(ok1, { states: [...seen], height: +top.toFixed(3), mark, lost: m0 - run.health });
  },
});
story('words/rolls', {
  about: 'rolls: a hair tangle tumbles along the floor as it comes at you.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('hair', near(0.4, 0)); },
  play() { const e = G().enemies.list[0], a = e.mesh.rotation.x; step(30); return ok(Math.abs(e.mesh.rotation.x - a) > 1, { turned: +(e.mesh.rotation.x - a).toFixed(2) }); },
});

// --- guards: the vocabulary stays complete, and content mistakes are caught
// The words GLOSSARY.md retires (its _Avoid_ lists) stay out of what players read: content names and
// texts, stat names, cards and evolutions, and the prose strings the HUD, menus and run show.
story('vocabulary/no-retired-words', {
  about: 'No word GLOSSARY.md lists under _Avoid_ shows up in what players read (content, stats, cards, evolutions, and the HUD, menu and run text).',
  setup() {},
  async play() {
    const get = async (f) => (await fetch(f)).text();
    const avoid = [...(await get('/GLOSSARY.md')).matchAll(/^_Avoid_:(.*)$/gm)]
      .flatMap((m) => m[1].replace(/\([^)]*\)/g, '').split(',')).map((w) => w.trim()).filter(Boolean);
    const texts = [];
    for (const t of TREASURES) texts.push([`treasure ${t.id}`, [t.name, t.text, ...(t.levelText || [])].join(' · ')]);
    for (const [id, e] of Object.entries(CONTENT.enemies)) texts.push([`enemy ${id}`, e.name]);
    for (const [k, v] of Object.entries(STAT_INFO)) texts.push([`stat ${k}`, v.name]);
    for (const e of EVOLUTIONS) texts.push([`evolution ${e.id}`, `${e.name} · ${e.text}`]);
    // prose in the code players read: quoted strings with a space in them, comments stripped
    for (const f of ['run.js', 'hud.js', 'ui.js', 'main.js', 'stats.js', 'first-run.js']) {
      const src = (await get(`/src/${f}`)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
      // one line at a time; a string that reads as prose (words and spaces, no code or CSS in it)
      for (const line of src.split('\n')) for (const m of line.matchAll(/'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) {
        const text = (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, '');
        if (/[A-Za-z]{3,} [A-Za-z]{2,}/.test(text) && !/[;{}=]|=>|<style|\.jf-|#[a-z-]+ \{/.test(text)) texts.push([`src/${f}`, text]);
      }
    }
    const hits = [];
    for (const w of avoid) {
      const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      for (const [where, text] of texts) if (re.test(text)) hits.push(`${w} in ${where}: "${text.slice(0, 70)}"`);
    }
    return ok(avoid.length > 10 && !hits.length, { avoid: avoid.length, hits: hits.slice(0, 12) });
  },
});
story('vocabulary/every-word-documented-used-and-proven', {
  about: 'Every behaviour word has a description, is used by some bug, and has a words/ story.',
  setup() {},
  play() {
    const used = new Set(Object.values(CONTENT.enemies).flatMap((T) => T.vocabulary));
    const problems = [];
    for (const [w, def] of Object.entries(ENEMY_WORDS)) {
      if (!def.doc) problems.push(`${w}: no doc`);
      if (!used.has(w)) problems.push(`${w}: no bug uses it`);
      if (!STORIES['words/' + w]) problems.push(`${w}: no words/${w} story`);
    }
    return ok(!problems.length, { problems });
  },
});
story('content/mistakes-are-caught', {
  about: 'A typo in a .kdl file stops loading with a message naming the file, line and problem.',
  setup() {},
  play() {
    const tryIt = (src) => { try { compileEnemies(parse(src, 'test.kdl'), 'test.kdl'); return null; } catch (e) { return e.message; } };
    const unknown = tryIt('enemy "x" hp=1 r=0.01 dmg=1 xp=1 {\n    lurk 3\n}');
    const badArgs = tryIt('enemy "x" hp=1 r=0.01 dmg=1 xp=1 {\n    chase\n}');
    const badProp = tryIt('enemy "x" hp=1 r=0.01 dmg=1 xp=1 {\n    chase 0.3\n    curl-dash wndup=1\n}');
    const noMove = tryIt('enemy "x" hp=1 r=0.01 dmg=1 xp=1 {\n    rolls\n}');
    const good = /test\.kdl:2: unknown word "lurk"/.test(unknown) && /"chase" takes speed/.test(badArgs) && /no setting "wndup"/.test(badProp) && /no way to move/.test(noMove);
    return ok(good, { unknown, badArgs, badProp, noMove });
  },
});
story('look/every-species-builds', {
  about: 'Every jellyfish species builds a model with hunting tentacles for the Lash, and old saved looks become jellyfish.',
  setup() {},
  play() {
    const built = {};
    for (const id of Object.keys(SPECIES)) {
      const c = buildCharacter({ body: id }, 0.09);
      let meshes = 0;
      c.root.traverse((o) => { if (o.isMesh) meshes++; });
      built[id] = { meshes, tentacles: c.tentacles?.count };
      c.dispose();
    }
    const old = [normalizeLook({ body: 'jellyfish' }).body, normalizeLook({ body: 'blob', feet: true }).body, 'feet' in normalizeLook({ feet: true })];
    const good = Object.values(built).every((b) => b.meshes > 10 && b.tentacles >= 6) && old[0] === 'nettle' && old[1] === 'nettle' && old[2] === false;
    return ok(good, { built, old });
  },
});
story('look/tokens-reach-the-game', {
  about: 'Values in content/look.css are what the game uses.',
  setup() {},
  play() {
    const s = G().APT.scene;
    return ok(LOOK.has('night-fill') && s.environmentIntensity === LOOK.num('night-fill') && s.fog.density === LOOK.num('haze'), { fill: s.environmentIntensity, haze: s.fog.density });
  },
});

// --- treasures: one story per effect word (content/treasures.kdl, TREASURE_WORDS in words.js)
const give = (...ids) => { for (const id of ids) G().run.owned.add(id); };
const dmgBy = (log, source) => log.filter((d) => d.source === source && d.targetId !== PLAYER);
const roachAt = (dx, dz, opts = { still: true, hp: 9999 }) => spawn('roach', near(dx, dz), opts);
const setupFight = (opts = {}) => { fresh({ elites: false, ...opts }); tp(3.2, 0.05, 3.0, 0); };

story('treasures/pierce', {
  about: 'pierce (Bobby Pin): a bubble pops through up to 3 bugs in a line.',
  setup() { setupFight({ lash: false }); give('bobbyPin'); G().run.stats.bubbles = 1; [0.2, 0.25, 0.3].forEach((z) => roachAt(0, -z)); },
  play() { step(240); const hurt = G().enemies.list.filter((e) => e.hp < e.maxHp).length; return ok(hurt >= 2, { hurt }); },
});
story('treasures/split-bubble', {
  about: 'split-bubble (Hair Tie): each pop blows a smaller bubble at another bug nearby.',
  setup() { setupFight({ lash: false }); give('hairTie'); G().run.stats.bubbles = 1; roachAt(0, -0.12); roachAt(0.1, -0.14); },
  play() { step(360); const side = G().enemies.list[1]; return ok(side.hp < side.maxHp, { sideDamage: Math.round(side.maxHp - side.hp) }); },
});
story('treasures/golden-bubble', {
  about: 'golden-bubble (Gold Ring): every 10th bubble is golden and hits 5x.',
  setup() { setupFight({ lash: false }); give('goldRing'); roachAt(0, -0.15); },
  play() {
    const { run } = G(), opts = [];
    const blow = run.bubbles.blow.bind(run.bubbles);
    stub(run.bubbles, 'blow', (o, t, x) => { opts.push(x.golden); return blow(o, t, x); });
    step(60 * 13);
    const golden = opts.filter((g) => g === 5).length;
    return ok(opts.length >= 20 && golden === Math.floor(opts.length / 10), { blown: opts.length, golden });
  },
});
story('treasures/giant-bubble', {
  about: 'giant-bubble (Reed Stick): every 6th bubble brings a giant, slow one.',
  setup() { setupFight({ lash: false }); give('reedStick'); roachAt(0, -0.15); },
  play() {
    const { run } = G(), opts = [];
    const blow = run.bubbles.blow.bind(run.bubbles);
    stub(run.bubbles, 'blow', (o, t, x) => { opts.push(x); return blow(o, t, x); });
    step(60 * 8);
    const giants = opts.filter((x) => x.big).length, normal = opts.length - giants;
    return ok(giants >= 1 && giants === Math.floor(normal / 6) && opts.find((x) => x.big).size === 2.5, { normal, giants });
  },
});
story('treasures/element', {
  about: 'element: fire burns, lightning arcs, ice freezes, acid leaves puddles (Candle, Battery, Freezer Pack, Nail Polish).',
  setup() { setupFight({ lash: false }); give('candle', 'battery', 'freezerPack', 'nailPolish'); G().run.stats.bubbles = 2; roachAt(-0.04, -0.15); roachAt(0.04, -0.15); roachAt(0.1, -0.2); },
  play() {
    const { run, enemies } = G();
    let burned = false, puddles = false, zapped = false, frozen = false;
    const zap = run.bubbles.zap.bind(run.bubbles);
    stub(run.bubbles, 'zap', (...a) => { zapped = true; return zap(...a); });
    step(60 * 6, () => {
      burned ||= run.bubbles.burning.size > 0; puddles ||= run.bubbles.puddles.length > 0;
      frozen ||= enemies.list.some((e) => e.freezeT > 0);
      return burned && puddles && zapped && frozen;
    });
    return ok(burned && puddles && zapped && frozen, { burned, puddles, zapped, frozen });
  },
});
story('treasures/element-up', {
  about: 'Element upgrades change that element\'s attack: Lighter Fluid burns 50% hotter, Long Matches burns 2 s longer, Birthday Cake fires two fireballs a shot; your Fire rate speeds every element attack up too.',
  setup() { setupFight({ lash: false, bubbles: true }); give('candle'); roachAt(0, -0.15); },
  play() {
    const { run, enemies } = G(), B = run.bubbles, e = enemies.list[0];
    step(2);
    const base = { ...run.mods.element.fire };
    give('lighterFluid'); give('longMatches'); give('birthdayCake');
    step(2);
    const up = run.mods.element.fire;
    B.burning.clear(); B.ignite(e, 10, up);
    const f = B.burning.get(e), burnT = f.t, burnDps = f.dps;
    // a shot: how many fireballs leave at once
    B.list.length = 0; B.elTimers.fire = 1; B.timer = 0;
    step(1);
    const fireballs = B.list.filter((b) => b.tint === 'fire').length;
    // Fire rate: shots a second scale with it (count the fire timer's progress over 1 s)
    const rateAt = (blow) => { run.stats.fireRate = blow; B.elTimers.fire = 0; let shots = 0; for (let i = 0; i < 60; i++) { const before = B.elTimers.fire; step(1); if (B.elTimers.fire < before) shots++; } return shots + B.elTimers.fire; };
    const slow = rateAt(BASE_FIRE_RATE), fast = rateAt(BASE_FIRE_RATE * 2);
    return ok(base.burn === 1 && up.burn === 1.5 && up.burnTime === 5 && burnT === 5 && Math.abs(burnDps - 10 * 0.17 * 1.5) < 1e-9 && up.count === 1 && fireballs === 2 && fast > slow * 1.7,
      { base, up, burnT, fireballs, slow: +slow.toFixed(2), fast: +fast.toFixed(2) });
  },
});
story('treasures/rarity-by-source', {
  about: 'A chest that turns up in the room offers Common and Rare treasures; one a beaten Elite leaves offers Rare and Epic; neither ever offers a Legendary. Luck still favours the rarer of the two.',
  setup() { setupFight({ lash: false }); },
  play() {
    const { run } = G();
    const seen = { room: {}, elite: {} };
    let src = 'room';
    stub(run.ui, 'choose', (t, s, list) => { for (const c of list) seen[src][c.rarity] = (seen[src][c.rarity] || 0) + 1; });
    for (src of ['room', 'elite']) for (let i = 0; i < 300; i++) run.pickTreasure('', '', src);
    // luck: the rarer tier's share of the room's picks goes up
    const rareShare = (luck) => { run.stats.luck = luck; src = 'room'; seen.room = {}; for (let i = 0; i < 300; i++) run.pickTreasure('', '', 'room'); return seen.room.rare / (seen.room.rare + seen.room.common); };
    const plain = rareShare(0), lucky = rareShare(100);
    run.stats.luck = 0;
    restore();
    const R = seen.elite, rooms = Object.keys(seen.room), elites = Object.keys(R);
    return ok(rooms.every((r) => r === 'common' || r === 'rare') && elites.every((r) => r === 'rare' || r === 'epic') && R.rare > 0 && R.epic > 0 && lucky > plain * 1.3,
      { elite: R, plain: +plain.toFixed(2), lucky: +lucky.toFixed(2) });
  },
});
story('treasures/levels', {
  about: 'Treasures with level blocks (Fairy Lights) level up when taken again: 3 bulbs, then 4, then 5; the pick offers only the next level ("Lv 2" with what it adds), and nothing past level 3.',
  setup() { setupFight({ lash: false }); },
  play() {
    const { run } = G(), TREASURES_ALL = () => CONTENT.treasures;
    const bulbs = [], cards = [];
    // what the pick card would say: the only treasure left to offer is the Fairy Lights
    stub(run.ui, 'choose', (title, sub, list) => { cards.push(list.map((t) => `${t.name} | ${t.text}`).join()); });
    const all = TREASURES_ALL();
    for (let k = 0; k < 3; k++) {
      all.forEach((t) => { if (t.id !== 'fairyLights') while (run.owned.count(t.id) < t.stack) run.owned.add(t.id); });
      run.pickTreasure(undefined, undefined, 'elite');   // Fairy Lights is Epic: an Elite's chest
      run.owned.add('fairyLights'); step(2); bulbs.push(run.mods.orbit?.count);
    }
    const before = cards.length; run.pickTreasure(undefined, undefined, 'elite');
    const offeredPast3 = cards.length > before && cards[cards.length - 1].includes('Fairy');
    const lv2 = /Lv 2/.test(cards[1]) && /four bulbs/.test(cards[1]), lv3 = /Lv 3/.test(cards[2]) && /five bulbs/.test(cards[2]);
    return ok(bulbs.join() === '3,4,5' && lv2 && lv3 && /Lv 1/.test(cards[0]) && !offeredPast3, { bulbs, cards, offeredPast3 });
  },
});
story('pickups/big-xp-drops', {
  about: 'XP comes as big drops worth 5 and small ones for the rest: 12 XP is two big drops and two small ones, and picking them all up gives 12.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const { run, xpDrops } = G(), xp0 = run.xp, lv0 = run.level;
    xpDrops.drop(near(0.05, 0, 0.01), 1, 12);
    const sizes = xpDrops.list.map((d) => d.value).sort().join();
    const bigger = xpDrops.list.find((d) => d.big)?.m.geometry.parameters.radius > xpDrops.list.find((d) => !d.big)?.m.geometry.parameters.radius;
    step(240);
    const gained = run.level > lv0 ? null : run.xp - xp0;
    return ok(sizes === '1,1,5,5' && bigger && xpDrops.list.length === 0 && (gained === null || gained === 12), { sizes, bigger, left: xpDrops.list.length, gained });
  },
});
story('treasures/mark-on-hit', {
  about: 'mark-on-hit (Sticky Note): bugs you hit are marked and take 50% more damage.',
  setup() { setupFight({ lash: false }); give('stickyNote'); roachAt(0, -0.15); },
  play() { const e = G().enemies.list[0]; step(120, () => e.markT > 0); return ok(e.markT > 0 && !!e.note, { markT: +e.markT.toFixed(2) }); },
});
story('treasures/crit', {
  about: 'crit (Nail Clipper): about 1 hit in 5 does triple damage.',
  setup() { setupFight({ lash: false }); give('nailClipper'); roachAt(0, -0.15); },
  play() {
    const log = record('damage_taken'), pop = G().run.stats.bubbleDamage;
    step(60 * 20);
    const hits = dmgBy(log, 'bubble'), crits = hits.filter((d) => Math.abs(d.amount - pop * 3) < 1e-6).length;
    return ok(hits.length > 20 && crits > 0 && crits < hits.length * 0.5, { hits: hits.length, crits });
  },
});
story('treasures/echo-bubble', {
  about: 'echo-bubble (Disco Ball): a bubble that pops on a bug fires again from there at the next bug close by, at full damage.',
  setup() { setupFight({ lash: false }); give('discoBall'); roachAt(0, -0.15); roachAt(0.06, -0.24); },
  play() {
    const { enemies, run } = G(), [first, second] = enemies.list, log = record('damage_taken');
    step(60 * 3, () => dmgBy(log, 'bubble').some((d) => d.targetId === second.id));
    const echoes = dmgBy(log, 'bubble').filter((d) => d.targetId === second.id), full = run.S.bubbleDamage;
    return ok(echoes.length > 0 && echoes.every((d) => Math.abs(d.amount - full) < 1e-6 || d.amount >= full), { echoes: echoes.map((d) => d.amount), full, onFirst: dmgBy(log, 'bubble').filter((d) => d.targetId === first.id).length });
  },
});
story('treasures/bubble-ring', {
  about: 'bubble-ring (Bubble Bath, every 5 s): 8 bubbles at once, spread evenly all around the jelly.',
  setup() { setupFight({ lash: false }); give('bubbleBath'); roachAt(0, -0.15); },
  play() {
    const { run } = G(), B = run.bubbles, orig = B.ring.bind(B);
    let rings = 0, out = 0;
    stub(B, 'ring', (...a) => { const n0 = B.list.length; orig(...a); rings++; out = B.list.length - n0; });
    step(60 * 6, () => rings);
    const dirs = B.list.filter((b) => !b.target).map((b) => Math.atan2(b.vel.z, b.vel.x));
    restore();
    return ok(rings === 1 && out === 8 && dirs.length === 8, { rings, out, dirs: dirs.map((a) => +a.toFixed(2)) });
  },
});
story('treasures/toy-mouse', {
  about: 'toy-mouse (Cat Toy Mouse): a wind-up mouse scurries to the nearest bug and hits it for 30; sometimes it trips over the jelly instead, for 2.',
  setup() { setupFight({ hurt: true, bubbles: false, lash: false }); give('toyMouse'); roachAt(0.25, 0.1); },
  play() {
    const { run } = G(), e = G().enemies.list[0], log = record('damage_taken'), real = Math.random;
    const send = (r) => { run.gadgets.t.mouse = 0.001; Math.random = () => r; step(1); Math.random = real; };
    send(0.5);                                                   // not a trip: off to the bug
    const out = run.gadgets.mouse.visible;
    step(60 * 3, () => log.some((d) => d.source === 'toy-mouse'));
    const bit = log.find((d) => d.source === 'toy-mouse');
    send(0.05);                                                  // a trip
    step(60 * 3, () => log.some((d) => d.source === 'toy-mouse' && d.targetId === PLAYER));
    const trip = log.find((d) => d.source === 'toy-mouse' && d.targetId === PLAYER);
    return ok(out && bit?.targetId === e.id && bit.amount === 30 && trip?.amount === 2, { out, bit: bit && [bit.targetId === e.id, bit.amount], trip: trip?.amount });
  },
});
story('treasures/pin-on-crit', {
  about: 'pin-on-crit (Thumbtack, with a Nail Clipper\'s crits): a critical hit pins the bug in place for 0.8 s; it stops dead and doesn\'t walk while pinned (bubble hits can still nudge it).',
  setup() { setupFight({ lash: false }); give('nailClipper', 'thumbtack'); roachAt(0, -0.15, { hp: 9999 }); },
  play() {
    const { enemies } = G(), e = enemies.list[0], log = record('status_applied');
    step(60 * 10, () => log.some((s) => s.status === 'pin' && s.targetId === e.id));
    const pin = log.find((s) => s.status === 'pin' && s.targetId === e.id);
    // a pin stops the bug moving itself; bubble hits still nudge it, so stop blowing and let the
    // ones in the air land before measuring
    G().run.bubbles.timer = -1e6;
    step(15);
    const at = e.pos.clone();
    step(30);                                                       // 0.25 s to 0.75 s into the 0.8 s pin
    const moved = e.pos.distanceTo(at);
    return ok(pin?.duration === 0.8 && moved < 0.002, { pin: pin?.duration, moved: +moved.toFixed(4) });
  },
});
story('treasures/zap-on-pop', {
  about: 'zap-on-pop (Static Balloon): a bubble popping on a bug sometimes snaps static to another bug close by, stunning it for 0.5 s.',
  setup() { setupFight({ lash: false }); give('staticBalloon'); roachAt(0, -0.15); roachAt(0.08, -0.17); },
  play() {
    const { enemies } = G(), log = record('status_applied');
    const real = Math.random;
    Math.random = () => 0.05;                                       // every pop's 20% comes up
    step(60 * 4, () => log.some((s) => s.status === 'stun'));
    Math.random = real;
    const stuns = log.filter((s) => s.status === 'stun');
    return ok(stuns.length >= 1 && stuns.every((s) => s.duration === 0.5) && enemies.list.some((e) => e.id === stuns[0].targetId), { stuns: stuns.map((s) => [s.targetId, s.duration]) });
  },
});
story('treasures/extra-jumps', {
  about: 'extra-jumps (Pen Spring): no mid-air jump without it; each copy adds one, up to a quadruple jump with 3.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const { run, player } = G();
    step(2);
    const none = player.maxAirJumps;
    const per = [];
    for (let k = 0; k < 3; k++) { run.owned.add('penSpring'); step(2); per.push(player.maxAirJumps); }
    return ok(none === 0 && per.join() === '1,2,3', { none, per });
  },
});
story('treasures/landing-shockwave', {
  about: 'landing-shockwave (Cotton Ball): landing from a jump sends out a stinging ring.',
  setup() { setupFight({ bubbles: false, lash: false }); give('cottonBall'); roachAt(0.06, 0); },
  play() { const log = record('damage_taken'); G().input.jumpQueued = true; step(120); return ok(dmgBy(log, 'shockwave').length > 0, { hits: dmgBy(log, 'shockwave').length }); },
});
story('treasures/squeak-when-hit', {
  about: 'squeak-when-hit (Rubber Duck): when you get hit, nearby bugs are knocked back and hurt.',
  setup() { setupFight({ hurt: true, bubbles: false, lash: false }); give('rubberDuck'); roachAt(0.05, 0); },
  play() {
    const e = G().enemies.list[0], d0 = e.pos.distanceTo(G().player.position), log = record('damage_taken');
    G().run.iFrames = 0;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 1, source: 'story' });
    const d1 = e.pos.distanceTo(G().player.position);
    return ok(dmgBy(log, 'squeak').length === 1 && d1 > d0 + 0.03, { pushed: +(d1 - d0).toFixed(3) });
  },
});
story('treasures/when-hit', {
  about: 'when-hit (Windowsill Cactus, Toaster Cord): getting hit sprays needles at the bugs around you, once a second at most; the Toaster Cord arcs back at the bug that hit you for half the damage you took.',
  setup() { setupFight({ hurt: true, bubbles: false, lash: false }); give('cactus'); roachAt(0.1, 0); roachAt(-0.12, 0.05); },
  play() {
    const { run, enemies } = G(), log = record('damage_taken');
    const hitMe = (amount, from) => { run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount, source: 'story', from }); };
    hitMe(1);
    const sprayed = new Set(dmgBy(log, 'ring').map((d) => d.targetId)).size;
    hitMe(1);                                                   // within its 1 s cooldown: nothing
    const again = dmgBy(log, 'ring').length;
    step(70); hitMe(1);                                         // a second later: again
    const later = dmgBy(log, 'ring').length;
    // the Toaster Cord: a bug hits you for 4, it takes 2 back (and not the other bug, closer to you)
    run.owned.delete('cactus'); give('kettleCord');
    const far = enemies.list[1], biter = roachAt(0.2, 0.05);
    log.length = 0;
    hitMe(4, biter.id);
    const zaps = dmgBy(log, 'zap');
    return ok(sprayed === 2 && again === 2 && later === 4 && zaps.length === 1 && zaps[0].targetId === biter.id && Math.abs(zaps[0].amount - 2 * (run.stage.power || 1)) < 1e-6,
      { sprayed, again, later, zaps: zaps.map((z) => [z.targetId === biter.id ? 'biter' : z.targetId === far.id ? 'other' : z.targetId, z.amount]) });
  },
});
story('treasures/ring-slow', {
  about: 'ring slow= (Stress Ball, when hit): the bugs within 12 cm are slowed for 1 s, once every 4 s.',
  setup() { setupFight({ hurt: true, bubbles: false, lash: false }); give('stressBall'); roachAt(0.08, 0); roachAt(0.3, 0); },
  play() {
    const { run, enemies } = G(), [close, far] = enemies.list, log = record('status_applied');
    run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount: 1, source: 'story' });
    const slowed = log.filter((s) => s.status === 'slow').map((s) => s.targetId);
    return ok(slowed.includes(close.id) && !slowed.includes(far.id) && log.find((s) => s.targetId === close.id)?.duration === 1, { slowed: slowed.map((id) => (id === close.id ? 'close' : id === far.id ? 'far' : id)) });
  },
});
story('treasures/reflect', {
  about: 'reflect (Hand Mirror): the first hit bounces back at the bug that dealt it, you take none of it and can\'t be hurt for 1 s; another hit within 20 s lands as usual.',
  setup() { setupFight({ hurt: true, bubbles: false, lash: false }); give('handMirror'); roachAt(0.1, 0); },
  play() {
    const { run, enemies } = G(), e = enemies.list[0], log = record('damage_taken');
    run.health = 20;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 3, source: 'story', from: e.id });
    const back = dmgBy(log, 'reflect'), h1 = run.health, inv = run.iFrames;
    step(70);                                                   // past the 1 s, well inside the 20 s
    bus.emit('damage_taken', { targetId: PLAYER, amount: 3, source: 'story', from: e.id });
    const p = run.stage.power || 1, h2 = run.health;
    return ok(back.length === 1 && back[0].targetId === e.id && h1 === 20 && inv === 1 && Math.abs(h2 - (20 - 3 * p)) < 1e-6 && dmgBy(log, 'reflect').length === 1,
      { back: back.map((d) => d.amount), h1, inv, h2 });
  },
});
story('treasures/death-save', {
  about: 'death-save (Snooze Button): the first hit that would take your last Health leaves you at half your max Health instead; the next one ends the run.',
  setup() { setupFight({ hurt: true, bubbles: false, lash: false }); give('snooze'); },
  play() {
    const { run } = G();
    stub(run.hud, 'toast', () => {});
    run.health = 2; run.iFrames = 0;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 5, source: 'story' });
    const saved = run.health, phase1 = run.phase;
    run.health = 2; run.iFrames = 0;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 5, source: 'story' });
    const phase2 = run.phase;
    restore();
    return ok(Math.abs(saved - run.S.health / 2) < 1e-6 && phase1 !== 'dead' && phase2 === 'dead', { saved, max: run.S.health, phase1, phase2 });
  },
});
story('treasures/damage-taken', {
  about: 'damage-taken (Shot Glass): hits take 25% more health.',
  setup() { setupFight({ hurt: true }); give('shotGlass'); },
  play() { const { run } = G(), m0 = run.health; run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount: 4, source: 'story' }); return ok(Math.abs(m0 - run.health - 5) < 1e-9, { lost: m0 - run.health }); },
});
story('treasures/spout', {
  about: 'spout (Whale Bath Toy): stand still and you refill health.',
  setup() { setupFight({ bubbles: false, lash: false }); give('whale'); G().run.health = 10; },
  play() { step(60 * 3); return ok(G().run.health > 10.5, { health: +G().run.health.toFixed(2) }); },
});
story('treasures/heal-on-kill', {
  about: 'heal-on-kill (Baby Bottle): every bug you clear gives back a sip of health.',
  setup() { setupFight({ lash: false }); give('babyBottle'); G().run.health = 10; roachAt(0, -0.15, { still: true }); },
  play() { const e = G().enemies.list[0]; step(300, () => e.dead); return ok(e.dead && G().run.health === 10.5, { health: G().run.health }); },
});
story('treasures/burst-on-kill', {
  about: 'burst-on-kill (Bath Salt): bugs you finish off burst and hurt their neighbours.',
  setup() { setupFight({ lash: false }); give('bathSalt'); G().run.stats.bubbles = 1; roachAt(0, -0.12, { still: true, hp: 12 }); roachAt(0.035, -0.12); },
  play() { const log = record('damage_taken'); step(400, () => dmgBy(log, 'burst').length > 0); return ok(dmgBy(log, 'burst').length > 0, { bursts: dmgBy(log, 'burst').length }); },
});
story('treasures/xp-reach', {
  about: 'xp-reach (Fridge Magnet): XP flies to you from much farther away.',
  setup() { setupFight({ bubbles: false, lash: false }); give('magnet'); G().xpDrops.drop(near(0.18, 0, 0.01), 1, 1); },
  play() { step(120); return ok(G().xpDrops.list.length === 0, { left: G().xpDrops.list.length }); },
});
story('treasures/xp-mult', {
  about: 'xp-mult (Spilled Sugar): bugs drop 30% more XP.',
  setup() { setupFight({ lash: false }); give('sugar'); spawn('mosquito', near(0, -0.15), { still: true, hp: 1 }); },
  play() { const e = G().enemies.list[0]; step(300, () => e.dead); const total = G().xpDrops.list.reduce((a, d) => a + d.value, 0); return ok(e.dead && total === Math.round(e.T.xp * 1.3), { xp: total, base: e.T.xp }); },
});
story('treasures/card-rarity', {
  about: 'card-rarity (Game Die): level-up cards roll one rarity higher (never common).',
  setup() { setupFight(); give('dice'); },
  play() {
    let common = 0;
    for (let i = 0; i < 40; i++) for (const c of rollCards(G().run.stats, 3, G().run.mods.cardRarity)) if (c.rarity === RARITY[0]) common++;
    return ok(G().run.mods.cardRarity === 1 && common === 0, { common });
  },
});
story('treasures/stacking', {
  about: 'Stacking: a treasure without levels (Lemon Slice, stack=5) adds up per copy and stops being offered at its cap; a rule-changer (Hair Tie, stack=1) is never offered twice; with no stack= a treasure without levels stacks to 3.',
  setup() { setupFight(); give('lemon', 'lemon', 'lemon', 'lemon', 'hairTie'); },
  play() {
    const { run } = G(), b = run.stats.bubbleDamage;
    const four = run.S.bubbleDamage;
    const byDefault = compileTreasures(parse('treasure "x" name="X" icon="x" text="x" {\n    pierce 3\n}', 't.kdl'), 't.kdl')[0].stack;
    let offered = [];
    stub(run.ui, 'choose', (title, sub, choices) => { offered = choices.map((c) => c.id); });
    const seen = new Set();
    for (let i = 0; i < 200; i++) { run.pickTreasure(); offered.forEach((id) => seen.add(id)); }
    const lemonOffered = seen.has('lemon');
    give('lemon');
    seen.clear();
    for (let i = 0; i < 200; i++) { run.pickTreasure(); offered.forEach((id) => seen.add(id)); }
    return ok(four === b + 8 && run.S.bubbleDamage === b + 10 && run.owned.count('lemon') === 5 && lemonOffered && !seen.has('lemon') && !seen.has('hairTie') && byDefault === 3,
      { four, five: run.S.bubbleDamage, lemonOffered, afterFull: seen.has('lemon'), tie: seen.has('hairTie'), byDefault });
  },
});
story('treasures/per', {
  about: 'per (Medicine Ball, Paperclip Chain, Roller Skate, Piggy Bank): a stat grows with another, live: Bubble damage follows max Health (+1 per 10), Tentacle damage follows Levels gained, Fire rate follows Move speed above the start, Bubble damage follows treasures found.',
  setup() { setupFight({ lash: false }); },
  play() {
    const { run } = G(), S = () => run.S;
    const bd0 = S().bubbleDamage, hp = S().health;
    give('medicineBall');
    const ball = S().bubbleDamage - bd0;                       // 25 max Health: +2.5
    run.stats.health += 10;                                    // a Health card
    const ballAfterCard = S().bubbleDamage - bd0;              // 35: +3.5
    const td0 = run.tentacleStats.tentacleDamage;
    give('paperclipChain');
    const clip0 = run.tentacleStats.tentacleDamage - td0;
    run.level += 2;
    const clip2 = run.tentacleStats.tentacleDamage - td0;      // two Levels gained: +2
    const fr0 = S().fireRate;
    give('rollerSkate');
    const skate0 = S().fireRate - fr0;
    run.stats.moveSpeed += 0.2;                                // +20% Move speed: +4% Fire rate
    const skate = (S().fireRate - fr0) / BASE_STATS.fireRate * 100;
    const bd1 = S().bubbleDamage;
    give('piggyBank');
    run.chestsOpened = 5;                                      // five treasures found: +10%
    const piggy = (S().bubbleDamage - bd1) / BASE_STATS.bubbleDamage * 100;
    const near = (a, b) => Math.abs(a - b) < 1e-6;
    return ok(near(ball, hp / 10) && near(ballAfterCard, (hp + 10) / 10) && clip0 === 0 && clip2 === 2 && skate0 === 0 && near(skate, 4) && near(piggy, 10),
      { ball, ballAfterCard, clip0, clip2, skate0, skate: +skate.toFixed(3), piggy: +piggy.toFixed(3) });
  },
});
story('treasures/while', {
  about: 'while (Dry Sock, High Stool): Dry Sock adds 40% Bubble damage in the air and none once landed; High Stool adds 30% standing on a table and none on the floor.',
  setup() { setupFight({ lash: false }); give('drySock', 'highStool'); },
  play() {
    const { run, player } = G(), bd = () => (run.S.bubbleDamage - run.stats.bubbleDamage) / BASE_STATS.bubbleDamage * 100;
    tp(3.2, 0.05, 3.0); player.position.y = 0.25; player.grounded = false; step(2);   // falling: in the air
    const air = bd(), grounded0 = player.grounded;
    step(120, () => player.grounded);
    const floor = bd();                                            // landed on the floor
    tp(0.66, 0.85, 2.84); step(120, () => player.grounded);        // onto the kitchen table (the Mug's high ground)
    const table = bd(), tableY = player.position.y;
    const near = (a, b) => Math.abs(a - b) < 1e-6;
    return ok(!grounded0 && near(air, 40) && near(floor, 0) && near(table, 30) && tableY > 0.5, { air, floor, table, tableY: +tableY.toFixed(2), grounded0 });
  },
});
story('treasures/while-low-health', {
  about: 'while low-health (Hot Water Bottle): +50% Fire rate and +20% Move speed only while under 30% of max Health.',
  setup() { setupFight({ lash: false }); give('hotWaterBottle'); },
  play() {
    const { run } = G(), pct = (k) => (run.S[k] - run.stats[k]) / BASE_STATS[k] * 100;
    run.health = run.S.health;
    const full = [pct('fireRate'), pct('moveSpeed')];
    run.health = run.S.health * 0.2;
    const low = [pct('fireRate'), pct('moveSpeed')];
    const same = (a, b) => Math.abs(a - b) < 1e-6;
    return ok(same(full[0], 0) && same(full[1], 0) && same(low[0], 50) && same(low[1], 20), { full, low });
  },
});
story('treasures/power-bank', {
  about: 'Power Bank (element-up for every element, Legendary): the elements you own fire 50% faster; it needs no element, so it\'s never offered as an Element upgrade.',
  setup() { setupFight({ lash: false }); give('candle'); },
  play() {
    const { run } = G(), before = run.mods.element.fire.rate;
    give('powerBank');
    const after = run.mods.element.fire.rate, owns = [...run.mods.elements];
    return ok(Math.abs(after - before * 1.5) < 1e-9 && owns.join() === 'fire' && !ELEMENT_UPGRADES.includes('powerBank'), { before, after, owns });
  },
});
story('treasures/found-count-carries-over', {
  about: 'The count of treasures found (each one opened adds 1) carries into the next act with the rest of the run.',
  setup() { setupFight({ lash: false }); },
  play() {
    const { run } = G();
    stub(run.ui, 'choose', () => {});
    run.chestsOpened = 0;
    for (let i = 0; i < 4; i++) run.pickTreasure('', '', 'room');
    const counted = run.chestsOpened;
    restore();
    const carry = run.carryOver();
    run.carry = carry; run.start();
    const after = run.chestsOpened;
    run.carry = null; run.start();
    const fresh = run.chestsOpened;
    return ok(counted === 4 && carry.chestsOpened === 4 && after === 4 && fresh === 0, { counted, carried: carry.chestsOpened, after, fresh });
  },
});
story('treasures/stat', {
  about: 'stat (Lemon Slice, Coffee Bean): a treasure adds to a stat, flat or by a percent.',
  setup() { setupFight({ lash: false }); give('lemon'); give('coffeeBean'); },
  play() {
    const { run } = G(), b = run.stats;
    return ok(run.S.bubbleDamage === b.bubbleDamage + 2 && Math.abs(run.S.fireRate - b.fireRate * 1.25) < 1e-9, { pop: [b.bubbleDamage, run.S.bubbleDamage], blowRate: [b.fireRate, +run.S.fireRate.toFixed(3)] });
  },
});
story('treasures/stat-size-jump-tentacles', {
  about: 'stat reaches the stats nothing raised before: Bubble size, Jump height and the tentacles (Bike Pump, Spring Insole, Spaghetti Strand, Tape Measure, Chopsticks, Stinging Nettle), and the lash uses them: two tentacles sting two bugs at once.',
  setup() { setupFight({ bubbles: false }); give('bikePump', 'insole', 'spaghetti', 'tapeMeasure', 'chopsticks', 'nettle'); roachAt(0.06, 0); roachAt(-0.06, 0); },
  play() {
    const { run } = G(), b = BASE_STATS, S = run.S, T = run.tentacleStats, near = (a, c) => Math.abs(a - c) < 1e-9;
    const stats = near(S.bubbleSize, b.bubbleSize * 1.2) && near(S.jumpHeight, b.jumpHeight * 1.2) && T.tentacles === b.tentacles + 1
      && near(T.reach, b.reach * 1.25) && near(T.tentacleSpeed, b.tentacleSpeed * 1.25) && T.tentacleDamage === b.tentacleDamage + 2;
    const log = record('damage_taken');
    step(60 * 2);
    const stung = new Set(dmgBy(log, 'tentacle').map((d) => d.targetId)).size;
    return ok(stats && stung === 2, { size: S.bubbleSize, jump: S.jumpHeight, T: { ...T }, stung });
  },
});
story('treasures/gadget-haste', {
  about: 'gadget-haste (Wind-Up Key): treasures on a timer go off 20% more often; a Guitar Pick\'s first chord comes at 2.5 s instead of 3 s.',
  setup() { setupFight({ bubbles: false, lash: false }); give('guitarPick'); roachAt(0.08, 0); },
  play() {
    const first = () => { const log = record('damage_taken'); return step(60 * 6, () => dmgBy(log, 'ring').length > 0) / 60; };
    const plain = first();
    setupFight({ bubbles: false, lash: false }); give('guitarPick', 'windUpKey'); roachAt(0.08, 0);
    const keyed = first();
    return ok(Math.abs(plain / keyed - 1.2) < 0.03, { plain: +plain.toFixed(2), keyed: +keyed.toFixed(2) });
  },
});
story('treasures/elite-damage', {
  about: 'elite-damage (Can Opener): hits on Elites and the boss do 40% more; ordinary bugs take the same as before.',
  setup() { setupFight({ lash: false, bubbles: false }); give('canOpener'); roachAt(0.3, 0); },
  play() {
    const { enemies } = G(), roach = enemies.list[0];
    const big = { position: near(-0.3, 0), r: 0.02, dead: false, hp: 1000, damage(a) { this.hp -= a; } };
    const e = enemies.addProxy(big);
    step(1);
    const hp0 = roach.hp;
    bus.emit('damage_taken', { targetId: e.id, amount: 10, source: 'story' });
    bus.emit('damage_taken', { targetId: roach.id, amount: 10, source: 'story' });
    big.dead = e.dead = true; enemies.list.splice(enemies.list.indexOf(e), 1); enemies.byId.delete(e.id);
    return ok(Math.abs(1000 - big.hp - 14) < 1e-9 && hp0 - roach.hp === 10, { elite: 1000 - big.hp, bug: hp0 - roach.hp });
  },
});
story('treasures/grow-on-kills', {
  about: 'grow-on-kills (Bandage, Dustpan): every 5 bugs you clear, +1 max health for good (and it refills); with a cap (Dustpan) a copy stops growing at +100% and a second copy grows on.',
  setup() { setupFight({ bubbles: false, lash: false }); give('bandage'); },
  play() {
    const { run } = G(), max0 = run.S.health;
    const kill = () => bus.emit('enemy_killed', { type: 'roach', pos: near(0.05, 0, 0.02), floor: G().player.position.y, r: 0.02, xp: 1 });
    for (let i = 0; i < 4; i++) kill();
    const after4 = run.S.health;
    for (let i = 0; i < 6; i++) kill();
    // with a cap (Dustpan: +0.1% Bubble damage a bug, up to +100% a copy): it stops at the cap, and a second copy grows on
    give('dustpan');
    const pct = () => (run.S.bubbleDamage - run.stats.bubbleDamage) / BASE_STATS.bubbleDamage * 100;
    for (let i = 0; i < 1100; i++) kill();
    const capped = pct();
    give('dustpan');
    for (let i = 0; i < 300; i++) kill();
    const second = pct();
    const same = (a, b) => Math.abs(a - b) < 1e-6;
    return ok(after4 === max0 && run.S.health >= max0 + 2 && same(capped, 100) && same(second, 130),
      { max0, after4, after10: run.S.health, capped: +capped.toFixed(3), second: +second.toFixed(3) });
  },
});
story('treasures/crumb-on-kill', {
  about: 'crumb-on-kill (Meatball, Leftover): a bug you clear sometimes leaves a crumb; it drifts to you like XP and gives back 1 Health.',
  setup() { setupFight({ bubbles: false, lash: false }); give('meatball'); },
  play() {
    const { run, player } = G();
    const none = run.crumbs.list.length;
    run.health = 10;
    const real = Math.random;
    Math.random = () => 0.001;                                 // this kill's 2% comes up
    bus.emit('enemy_killed', { type: 'roach', pos: near(0.04, 0, 0.02), floor: player.position.y, r: 0.02, xp: 1 });
    Math.random = real;
    const dropped = run.crumbs.list.length;
    step(240, () => !run.crumbs.list.length);
    return ok(none === 0 && dropped === 1 && run.crumbs.list.length === 0 && Math.abs(run.health - 11) < 0.01, { dropped, health: +run.health.toFixed(2), left: run.crumbs.list.length });
  },
});
story('treasures/heal-on-hit', {
  about: 'heal-on-hit (Plastic Fangs): about 1 bubble or tentacle hit in 10 gives back 1 health.',
  setup() { setupFight({ bubbles: false, lash: false }); give('fangs'); roachAt(0.3, 0); },
  play() {
    const { run } = G(), e = G().enemies.list[0];
    let heals = 0;
    for (let i = 0; i < 300; i++) { run.health = 5; bus.emit('damage_taken', { targetId: e.id, amount: 0.01, source: 'bubble' }); if (run.health > 5) heals++; }
    run.health = 5; bus.emit('damage_taken', { targetId: e.id, amount: 0.01, source: 'zap' });
    return ok(heals > 12 && heals < 55, { heals, of: 300 });
  },
});
story('treasures/card-choices', {
  about: 'card-choices (Notebook): level-ups offer 4 cards.',
  setup() { setupFight(); give('notebook'); },
  play() {
    const { run } = G();
    let shown = 0;
    stub(run.ui, 'levelUp', (lvl, cards) => { shown = cards.length; });
    run.pendingLevels = 1;
    Object.getPrototypeOf(run).levelUp.call(run);
    return ok(shown === 4, { shown });
  },
});
story('treasures/bug-speed', {
  about: 'bug-speed (Snail Shell): bugs crawl 15% slower.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const run1 = () => { G().enemies.clear(); const e = spawn('roach', near(0.6, 0), { hp: 9999 }); const d0 = e.pos.distanceTo(G().player.position); step(40); return d0 - e.pos.distanceTo(G().player.position); };
    const plain = run1();
    give('snailShell');
    const slow = run1();
    return ok(slow / plain > 0.75 && slow / plain < 0.93, { plain: +plain.toFixed(3), slow: +slow.toFixed(3), ratio: +(slow / plain).toFixed(2) });
  },
});
story('treasures/more-bugs', {
  about: 'more-bugs (Spilled Sugar): 30% more bugs come out of the vents.',
  setup() { setupFight(); },
  play() {
    const { run, enemies } = G();
    let n = 0;
    stub(enemies, 'spawn', () => { n++; });
    stub(run, 'spawnPoint', () => near(0.4, 0));
    const count = () => { n = 0; run.spawnAcc = 0; Object.getPrototypeOf(run).spawnWaves.call(run, 200); return n; };
    const plain = count();
    give('sugar');
    const more = count();
    return ok(plain > 20 && Math.abs(more / plain - 1.3) < 0.08, { plain, more });
  },
});
story('treasures/xp', {
  about: 'xp inside every (Houseplant): every 12 s, 2 XP drips at your feet.',
  setup() { setupFight({ bubbles: false, lash: false }); give('houseplant'); },
  play() { const { run } = G(), p0 = run.purse; step(60 * 9); return ok(run.purse - p0 === 2, { gained: run.purse - p0 }); },
});
story('treasures/every', {
  about: 'every + ring (Guitar Pick): every 5 s a chord stings and pushes back everything close.',
  setup() { setupFight({ bubbles: false, lash: false }); give('guitarPick'); roachAt(0.08, 0); },
  play() {
    const log = record('damage_taken');
    step(60 * 9);
    const rings = dmgBy(log, 'ring').length, e = G().enemies.list[0];
    return ok(rings === 2 && e.pos.distanceTo(G().player.position) > 0.1, { rings, distance: +e.pos.distanceTo(G().player.position).toFixed(3) });
  },
});
story('treasures/ring', {
  about: 'ring with freeze (Ice Cube): a cold snap freezes everything close.',
  setup() { setupFight({ bubbles: false, lash: false }); give('iceCube'); roachAt(0.1, 0); },
  play() { const e = G().enemies.list[0]; step(60 * 6, () => e.freezeT > 0); return ok(e.freezeT > 0, { freezeT: +e.freezeT.toFixed(2) }); },
});
story('treasures/zap', {
  about: 'zap (TV Remote): every 7 s, the 3 nearest bugs get zapped.',
  setup() { setupFight({ bubbles: false, lash: false }); give('remote'); [0.2, -0.2, 0.3, -0.3].forEach((x) => roachAt(x, 0.1)); },
  play() { const log = record('damage_taken'); step(60 * 5); return ok(dmgBy(log, 'zap').length === 3, { zapped: dmgBy(log, 'zap').length }); },
});
story('treasures/brick', {
  about: 'brick (Lego Brick): a dropped brick hurts the first bug that steps on it.',
  setup() { setupFight({ bubbles: false, lash: false }); give('legoBrick'); },
  play() {
    const { gadgets } = G().run;
    step(60 * 3, () => gadgets.bricks.length > 0);
    const log = record('damage_taken');
    const b = gadgets.bricks[0];
    if (b) { const e = spawn('roach', b.m.position.clone(), { still: true, hp: 9999 }); e.pos.copy(b.m.position); }
    step(5);
    return ok(!!b && dmgBy(log, 'brick').length === 1, { bricks: gadgets.bricks.length, hits: dmgBy(log, 'brick').length });
  },
});
story('treasures/marble', {
  about: 'marble (Marble): a marble rolls out ahead of you and bowls through bugs.',
  setup() { setupFight({ bubbles: false, lash: false }); give('marble'); const P = G().player; const f = V(Math.sin(P.facing), 0, Math.cos(P.facing)); spawn('roach', P.position.clone().addScaledVector(f, 0.2), { still: true, hp: 9999 }); },
  play() { const log = record('damage_taken'); step(60 * 5); return ok(dmgBy(log, 'marble').length >= 1, { hits: dmgBy(log, 'marble').length }); },
});
story('treasures/orbit-lights', {
  about: 'orbit-lights (Fairy Lights): bulbs circle you and sting what they touch.',
  setup() { setupFight({ bubbles: false, lash: false }); give('fairyLights'); roachAt(0.07, 0); },
  play() { const log = record('damage_taken'); step(120); return ok(dmgBy(log, 'orbit-lights').length > 0, { stings: dmgBy(log, 'orbit-lights').length }); },
});
story('treasures/beam', {
  about: 'beam (Magnifying Glass): focused moonlight burns the nearest bug.',
  setup() { setupFight({ bubbles: false, lash: false }); give('magnifier'); roachAt(0.2, 0); },
  play() { const log = record('damage_taken'); step(60); return ok(dmgBy(log, 'beam').length >= 3, { burns: dmgBy(log, 'beam').length }); },
});
story('treasures/aura', {
  about: 'aura (Glow Stick): a glow around you stings anything inside it.',
  setup() { setupFight({ bubbles: false, lash: false }); give('glowStick'); roachAt(0.06, 0); },
  play() { const log = record('damage_taken'); step(90); return ok(dmgBy(log, 'aura').length >= 2, { stings: dmgBy(log, 'aura').length }); },
});
story('vocabulary/every-treasure-word-documented-used-and-proven', {
  about: 'Every treasure word has a description, is used by some treasure, and has a treasures/ story.',
  setup() {},
  play() {
    const used = new Set(CONTENT.treasures.flatMap((t) => t.vocabulary));
    const usedTimed = new Set();
    for (const t of CONTENT.treasures) for (const fx of t.effects) { const m = newMods(); try { fx(m); } catch {} for (const T of m.timed) for (const ef of T.effects) usedTimed.add(ef.kind); }
    const problems = [];
    for (const [w, def] of Object.entries(TREASURE_WORDS)) {
      if (!def.doc) problems.push(`${w}: no doc`);
      if (!used.has(w)) problems.push(`${w}: no treasure uses it`);
      if (!STORIES['treasures/' + w]) problems.push(`${w}: no treasures/${w} story`);
    }
    for (const [w, def] of Object.entries(TIMED_WORDS)) {
      if (!def.doc) problems.push(`${w}: no doc`);
      if (!usedTimed.has(w)) problems.push(`${w}: no treasure uses it`);
      if (!STORIES['treasures/' + w]) problems.push(`${w}: no treasures/${w} story`);
    }
    return ok(!problems.length && CONTENT.treasures.length >= 40, { problems, treasures: CONTENT.treasures.length });
  },
});
story('content/treasure-mistakes-are-caught', {
  about: 'A typo in treasures.kdl names the file, line and problem, and so does breaking a stacking rule (stack= on a treasure with levels, more than 5, a Legendary or element that stacks, an element that isn\'t Legendary, an unknown rarity).',
  setup() {},
  play() {
    const tryIt = (src) => { try { compileTreasures(parse(src, 'test.kdl'), 'test.kdl'); return null; } catch (e) { return e.message; } };
    const unknown = tryIt('treasure "x" name="X" icon="x" text="x" {\n    pierce 3\n    sparkle\n}');
    const element = tryIt('treasure "x" name="X" icon="x" text="x" {\n    element "plasma"\n}');
    const block = tryIt('treasure "x" name="X" icon="x" text="x" {\n    every 5 {\n        explode\n    }\n}');
    // the stacking rules: no stack= on a treasure with levels, at most 5, Legendary and elements one of a kind
    const levelled = tryIt('treasure "x" name="X" icon="x" text="x" stack=2 {\n    pierce 3\n    level 2 text="y" {\n        pierce 4\n    }\n}');
    const tooMany = tryIt('treasure "x" name="X" icon="x" text="x" stack=6 {\n    pierce 3\n}');
    const legendStack = tryIt('treasure "x" name="X" icon="x" text="x" rarity="legendary" stack=2 {\n    pierce 3\n}');
    const plainElement = tryIt('treasure "x" name="X" icon="x" text="x" rarity="rare" {\n    element "fire"\n}');
    const badTier = tryIt('treasure "x" name="X" icon="x" text="x" rarity="mythic" {\n    pierce 3\n}');
    const fine = tryIt('treasure "x" name="X" icon="x" text="x" stack=5 {\n    pierce 3\n}');
    const rules = /levels, so it doesn't take stack=/.test(levelled) && /stack=6 is too many/.test(tooMany) && /one of a kind/.test(legendStack)
      && /is an element, so it's rarity="legendary"/.test(plainElement) && /rarity= must be one of common, rare, epic, legendary/.test(badTier) && fine === null;
    const good = /test\.kdl:3: unknown word "sparkle"/.test(unknown) && /test\.kdl:2: element must be one of/.test(element) && /test\.kdl:3: unknown word "explode"/.test(block) && rules;
    return ok(good, { unknown, element, block, levelled, tooMany, legendStack, plainElement, badTier, fine });
  },
});

// --- elites: targetable, and every attack telegraphs before it lands
const ELITE_SPOTS = { controller: [1.42, 0.61, 4.5], mug: [0.66, 0.78, 2.84], kettle: [4.6, 0.91, 3.8] };
for (const kind of ['controller', 'mug', 'kettle']) {
  story(`elites/${kind}-takes-bubbles`, {
    about: `Bubbles reach and hurt the ${kind} on its high ground.`,
    setup() { fresh(); tp(...ELITE_SPOTS[kind].map((v, i) => (i === 1 ? v + 0.05 : v)), 0); },
    play() {
      const { run, enemies, menus } = G();
      const e = run.elites.list.find((x) => x.kind === kind), hp0 = e.hp;
      step(600, () => { if (menus.open) menus.close(); });
      const dmg = Math.round(hp0 - e.hp);
      return ok(enemies.list.includes(e.entry) && dmg > 60, { dmg });
    },
  });
  for (const atk of [0, 1]) {
    const when = { controller: [0.45, 0.8], mug: [0.6, 0.6], kettle: [0.7, 0.6] }[kind][atk];
    const at = { controller: [[1.62, 0.61, 4.47], [1.55, 0.61, 4.45]], mug: [[0.62, 0.78, 2.95], [0.62, 0.78, 3.0]], kettle: [[4.5, 0.91, 3.45], [4.5, 0.91, 3.45]] }[kind][atk];
    const name = { controller: ['barrage', 'rumble'], mug: ['lob', 'spill'], kettle: ['steam', 'boil-over'] }[kind][atk];
    story(`elites/${kind}-${name}`, {
      about: `The ${kind}'s ${name} attack shows its warning on the ground before it lands.`,
      setup() { fresh({ bubbles: false, lash: false }); tp(at[0], at[1] + 0.05, at[2], 0); const e = G().run.elites.list.find((x) => x.kind === kind); e.next = atk; e.cool = 0; },
      play() {
        const { run, player } = G();
        const e = run.elites.list.find((x) => x.kind === kind);
        step(400, () => e.state === 'windup' && e.stateT >= when);
        const telegraphs = e.tele.length + run.elites.blobs.length;
        const info = { state: e.state, telegraphs };
        let aimed = true;
        if (kind === 'kettle' && atk === 0) {       // the steam cone must point at you, not the wall
          const b = new THREE.Box3().setFromObject(e.tele[0]), c = b.getCenter(V(0, 0, 0));
          aimed = c.sub(e.base).setY(0).dot(player.position.clone().sub(e.base).setY(0)) > 0;
          info.aimed = aimed;
        }
        return ok(e.state === 'windup' && telegraphs > 0 && aimed, info);
      },
    });
  }
}

// --- the event bus: what hits, kills, freezes and rewards do
story('events/kill-drops-xp', {
  about: 'Bubbles kill a roach: it bursts, counts as a kill and drops XP.',
  setup() { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const P = G().player.position; spawn('roach', P.clone().add(V(0, 0, -0.18)), { still: true }); },
  play() {
    const { run, enemies, xpDrops } = G();
    const e = enemies.list[0], k0 = run.kills;
    step(300, () => e.dead);
    return ok(e.dead && run.kills === k0 + 1 && xpDrops.list.length > 0 && !enemies.byId.has(e.id), { dead: e.dead, xp: xpDrops.list.length });
  },
});
story('events/ice-freezes-on-second-chill', {
  about: 'Two ice hits freeze a bug solid.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('ants', G().player.position.clone().add(V(0.3, 0, 0.3))); },
  play() {
    const e = G().enemies.list[0];
    bus.emit('status_applied', { targetId: e.id, status: 'chill', duration: 2 });
    const once = e.freezeT;
    bus.emit('status_applied', { targetId: e.id, status: 'chill', duration: 2 });
    return ok(!(once > 0) && e.freezeT === 2, { afterOne: once || 0, afterTwo: e.freezeT });
  },
});
story('events/iframes-and-drain', {
  about: 'A second hit inside the invincibility window does nothing; ongoing drain (puddles) still does.',
  setup() { fresh({ hurt: true, elites: false }); },
  play() {
    const { run } = G();
    run.iFrames = 0;
    const m0 = run.health;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 3, source: 'story' });
    const m1 = run.health;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 3, source: 'story' });
    const m2 = run.health;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 1, source: 'story', drain: true });
    return ok(m1 === m0 - 3 && m2 === m1 && run.health === m2 - 1, { m0, m1, m2, m3: run.health });
  },
});
story('events/elite-defeat-leaves-a-treasure', {
  about: 'Beating an elite leaves a treasure (a golden chest) on its high ground, not a pick right away.',
  setup() { fresh(); },
  play() {
    const { run, enemies, menus } = G();
    const mug = run.elites.list.find((e) => e.kind === 'mug'), entry = enemies.list.find((e) => e.proxy === mug);
    bus.emit('damage_taken', { targetId: entry.id, amount: 9999, source: 'story' });
    step(5);
    const pick = menus.open, chest = run.roomTreasures.find((t) => t.active && !t.timed);
    const near = chest && Math.hypot(chest.pos.x - mug.base.x, chest.pos.z - mug.base.z) < 0.05 && Math.abs(chest.pos.y - mug.base.y) < 0.05;
    return ok(mug.dead && !pick && near, { dead: mug.dead, pick, chest: chest && r3(chest.pos), base: r3(mug.base) });
  },
});

// --- the boss
story('boss/vacuum-arena-and-kill', {
  about: 'The Vacuum fight: low walls keep you in front of the kitchen, and it can be beaten.',
  setup() { fresh({ bubbles: true }); G().run.startBossIntro(); },
  play() {
    const { run, menus } = G();
    step(180);
    const phase = run.phase;
    const esc = sim(4, ['KeyD']).pos;
    const A = run.stage.boss;
    const inside = esc[0] > A.arenaMin[0] - 0.1 && esc[0] < A.arenaMax[0] + 0.1 && esc[2] > A.arenaMin[2] - 0.1 && esc[2] < A.arenaMax[2] + 0.1;
    run.stats.tentacleDamage = 60; run.stats.tentacles = 4;
    step(60 * 40, () => { if (menus.open) document.querySelector('.jf-card')?.click(); return run.boss.dead; });
    return ok(phase === 'boss' && inside && run.boss.dead, { phase, esc, dead: run.boss.dead });
  },
});

story('boss/vacuum-lanternfly-shield', {
  about: 'The Vacuum launches 4 lanternflies and is immune until they are all dead, then can be hurt again.',
  setup() { fresh({ bubbles: false, lash: false }); G().run.startBossIntro(); },
  play() {
    const { run, enemies } = G();
    step(180);
    const V = run.boss;
    V.state = 'flies'; V.stateT = 1.0; V.prevT = 1.0;
    step(60);
    const flies = V.guards.length, airborne = V.guards.filter((e) => e.airborne).length;
    const hp0 = V.hp;
    bus.emit('damage_taken', { targetId: enemies.list.find((e) => e.proxy === V).id, amount: 50, source: 'test' });
    const immune = V.hp === hp0 && V.shielded;
    step(60);
    const landed = V.guards.every((e) => !e.airborne);
    for (const e of [...V.guards]) enemies.applyDamage(e, 1e4);
    step(5);
    const down = !V.shielded;
    V.damage(50);
    return ok(flies === 4 && airborne === 4 && immune && landed && down && V.hp === hp0 - 50, { flies, airborne, immune, landed, down, hp: V.hp, hp0 });
  },
});

story('boss/vacuum-enrages-at-half', {
  about: 'Below half health the Vacuum enrages: it stops and shudders for a moment (ENRAGED!), then does everything twice as fast.',
  setup() { fresh({ bubbles: false, lash: false, hurt: false }); G().run.startBossIntro(); },
  play() {
    const { run } = G();
    step(180);
    const V = run.boss;
    const calm = V.pace;
    V.hp = V.maxHp * 0.49;
    step(2);
    const enraging = V.enrageT > 0, still = V.pace === 1;
    const at = V.holder.position.clone();
    step(30);
    const stood = V.holder.position.distanceTo(at) < 1e-6;
    step(90);                                       // the enrage is over
    V.state = 'chase'; V.stateT = 2.6;
    step(30);                                       // half a second of real time
    const used = 2.6 - V.stateT;                    // a calm Vacuum would use 0.5 s of its chase
    return ok(calm === 1 && enraging && still && stood && V.pace === 2 && used > 0.9 && used < 1.1, { calm, enraging, stood, pace: V.pace, used: +used.toFixed(2) });
  },
});

story('boss/vacuum-two-shields-max', {
  about: 'The Vacuum raises its lanternfly shield twice a fight at most.',
  setup() { fresh({ bubbles: false, lash: false, hurt: false }); G().run.startBossIntro(); },
  play() {
    const { run, enemies } = G();
    step(180);
    const V = run.boss;
    let flies = 0;
    for (let k = 0; k < 12; k++) {                  // plenty of picks: the flies come up every 5th normally
      for (const e of [...V.guards]) enemies.applyDamage(e, 1e4);
      step(2);
      V.pick();
      if (V.state === 'flies') { flies++; V.launch(); }
    }
    return ok(V.shields === 2 && flies === 2, { shields: V.shields, flies });
  },
});

story('modes/quick-restart-after-death', {
  about: 'Starting a new run right after dying: the old run\'s death screen (it comes 0.7 s after) doesn\'t land on the new run.',
  setup() { fresh({ bubbles: false, lash: false }); },
  async play() {
    const { run, menus } = G();
    run.die();
    run.start();                                   // straight away, before the death screen
    run.startPicked = true;
    await new Promise((r) => setTimeout(r, 1000));
    const stale = /dried out/.test(document.querySelector('.jf-modal')?.innerText || '');
    const t0 = run.t;
    step(60);
    const runs = run.phase === 'explore' && run.t > t0;
    menus.close();
    return ok(!stale && runs, { stale, phase: run.phase, runs });
  },
});

story('boss/legendary-reward', {
  about: 'The Boss reward: after the metamorphosis, a Legendary pick of three with at least one element you don\'t have yet, then the act is complete.',
  setup() { fresh({ bubbles: false, lash: false, hurt: false }); },
  play() {
    const { run } = G();
    run.owned.add('candle');
    const modal = () => document.querySelector('.jf-modal');
    run.metamorph();
    const first = modal().querySelector('h2')?.textContent;
    modal().querySelector('.jf-card').click();                        // an evolution
    const second = modal().querySelector('h2')?.textContent;
    const offered = [...modal().querySelectorAll('.jf-card .big')].map((n) => n.textContent);
    const tiers = [...modal().querySelectorAll('.jf-card .rar')].map((n) => n.textContent);
    modal().querySelector('.jf-card').click();                        // a Legendary
    const third = modal().querySelector('h2')?.textContent;
    G().menus.close();
    // the rule over many rolls: Legendary only, never one you own, always an element while any are left
    const els = ['battery', 'freezerPack', 'nailPolish', 'paperFan', 'glitter'];
    for (const id of els) run.owned.delete(id);                       // back to owning just fire
    let bad = 0, rolls = 0, lastOnly = 0;
    stub(run.ui, 'choose', (t, s, list) => {
      rolls++;
      if (list.some((c) => c.rarity !== 'legendary' || run.owned.has(c.id)) || !list.some((c) => ELEMENTS_IDS.includes(c.id))) bad++;
    });
    for (let i = 0; i < 100; i++) run.pickLegendary('', '', () => {});
    let treasures = 0;
    stub(run.ui, 'choose', (t, s, list) => { if (list.some((c) => !ELEMENTS_IDS.includes(c.id))) treasures++; });
    for (let i = 0; i < 100; i++) run.pickLegendary('', '', () => {});   // Legendary treasures turn up too (Hand Mirror, Snooze Button)
    for (const id of els.slice(0, 4)) run.owned.add(id);              // one element left
    stub(run.ui, 'choose', (t, s, list) => { if (list.some((c) => c.id === 'glitter')) lastOnly++; else bad++; });
    for (let i = 0; i < 50; i++) run.pickLegendary('', '', () => {});
    restore();
    return ok(/Metamorphosis/.test(first) && /Legendary/.test(second) && offered.length === 3 && !offered.includes('Birthday Candle')
      && tiers.every((t) => t === 'Legendary') && /Act 1 complete/.test(third) && !bad && rolls === 100 && lastOnly === 50 && treasures > 30,
      { first, second, offered, tiers, third, bad, rolls, lastOnly, treasures });
  },
});

story('boss/xp-comes-to-you', {
  about: 'Once a boss is beaten, all the XP around the arena (its own and its summons\') flies to you, and any still on its way counts when the metamorphosis opens.',
  setup() { fresh({ bubbles: false, lash: false, hurt: false }); G().run.startBossIntro(); },
  play() {
    const { run, xpDrops } = G();
    step(180);
    const A = run.stage.boss;
    for (let k = 0; k < 6; k++) xpDrops.drop(V(A.arenaMin[0] + 0.1 + k * 0.2, 0.02, A.arenaMax[2] - 0.1), 1, 3);   // XP from summons, far from you
    const before = run.purse;
    run.boss.hp = 0; run.boss.dead = true;
    step(90);
    const flewIn = run.purse - before;
    const leftWhenDone = xpDrops.list.length;
    return ok(flewIn >= 18 + 30 - 5 && leftWhenDone === 0, { flewIn, leftWhenDone });
  },
});

story('modes/dev-fight-boss', {
  about: 'The pause menu\'s Fight boss (dev) button starts a fresh run that goes straight to the boss.',
  setup() { fresh(); },
  play() {
    const { run, menus } = G();
    document.getElementById('g-over').hidden = false;
    document.querySelector('#g-over [data-act="boss"]').click();
    document.getElementById('g-over').hidden = true;   // desktop closes the menu once the mouse locks (not in a headless browser)
    step(240, () => { if (menus.open) document.querySelector('.jf-card')?.click(); return run.phase === 'boss'; });
    return ok(run.phase === 'boss' && !!run.boss && run.t < 10, { phase: run.phase, t: run.t });
  },
});

story('elites/hud-health-bar', {
  about: 'While an elite fights you, its name and health show on the HUD under the clock (and drop as you hit it); walk away and the bar goes. Its own bar over it turns from green toward red.',
  setup() { fresh({ bubbles: false, lash: false }); tp(0.66, 0.78, 2.95, 0); },
  play() {
    const { run } = G(), mug = run.elites.list.find((e) => e.kind === 'mug');
    const bar = () => document.querySelector('#hud .elite');
    step(20);
    const shown = !bar().hidden && /MUG/.test(bar().innerText);
    const full = bar().querySelector('i').style.transform;
    const green = mug.fill.material.color.g > mug.fill.material.color.r;
    mug.hp = mug.maxHp * 0.3;
    step(2);
    const after = bar().querySelector('i').style.transform, red = mug.fill.material.color.r > mug.fill.material.color.g;
    tp(3.2, 0.05, 3.0, 0);
    step(20);
    const gone = bar().hidden;
    return ok(shown && full === 'scaleX(1)' && /scaleX\(0\.3/.test(after) && green && red && gone, { shown, full, after, green, red, gone });
  },
});

story('elites/hall-clock-hangs-in-act-1', {
  about: 'In act 1 the detailed hall clock hangs over the cubby bench as a plain clock (you can see down the hall), in place of the apartment\'s simple one.',
  setup() { fresh(); },
  play() {
    const { run } = G(), c = run.elites.decor.find((d) => d.kind === 'clock');
    let oldShown = false; G().APT.root.traverse((o) => { if (/^Ornate_wall_clock/.test(o.name) && o.isMesh && o.visible) oldShown = true; });
    return ok(c && !oldShown && Math.abs(c.holder.position.y - 1.12) < 0.02 && !run.elites.list.some((e) => e.kind === 'clock'), { clock: !!c, oldShown, y: c && +c.holder.position.y.toFixed(3) });
  },
});
story('modes/dev-one-on-one', {
  about: 'The pause menu\'s 1 on 1 (dev) button lists every enemy; picking one starts a run with just it (it comes back after you clear it), and an elite puts you on its high ground.',
  setup() { fresh(); },
  play() {
    const { run, enemies } = G();
    const pickFrom = (name) => {
      document.getElementById('g-over').hidden = false;
      document.querySelector('#g-over [data-act="duel"]').click();
      const btn = [...document.querySelectorAll('.btns button')].find((b) => b.textContent === name);
      btn?.click();
      document.getElementById('g-over').hidden = true;   // desktop closes the menu once the mouse locks (not in a headless browser)
      return !!btn;
    };
    const listed = pickFrom('House fly');
    stub(run, 'hurt', () => {}); stub(run.bubbles, 'update', () => {}); stub(run.lash, 'update', () => {});
    step(60 * 4);
    const bugs = () => enemies.list.filter((e) => !e.dead && !e.proxy);
    const alone = bugs().length === 1 && bugs()[0].type === 'housefly';
    enemies.applyDamage(bugs()[0], 1e4);
    step(30);
    const gone = bugs().length === 0;
    step(90);
    const back = bugs().length === 1 && bugs()[0].type === 'housefly';
    const all = ['The Controller', 'The Mug', 'The Kettle', 'The Soap Dispenser', 'The Wall Clock', 'The Cream Whipper'].every((n) => run.duelChoices().some((p) => p.name.startsWith(n + ' (elite')));
    const elite = pickFrom('The Mug (elite, act 1)');
    step(30);
    const mug = run.elites.alive.length === 1 && run.elites.alive[0].spec.kind === 'mug' && G().player.position.y > 0.6 && bugs().length === 0;
    return ok(listed && alone && gone && back && elite && mug && all, { listed, alone, gone, back, elite, mug, all, y: +G().player.position.y.toFixed(2) });
  },
});

story('treasures/spots-not-on-vent-landings', {
  about: 'No treasure spot sits on a vent\'s landing point: the ones that did moved over, onto the same surface.',
  setup() { fresh(); },
  play() {
    const { run, traversal } = G();
    const lands = traversal.vents.map((v) => v.land);
    const bad = run.spots.filter((sp) => lands.some((L) => Math.hypot(L[0] - sp.at[0], L[2] - sp.at[2]) < 0.13 && Math.abs(L[1] - sp.y) < 0.08)).map((sp) => sp.label);
    const moved = run.spots.filter((sp) => { const o = run.stage.spots.find((q) => q.label === sp.label); return o && (o.at[0] !== sp.at[0] || o.at[2] !== sp.at[2]); })
      .map((sp) => `${sp.label} ${sp.at.map((v) => v.toFixed(2)).join(',')}`);
    return ok(!bad.length && moved.length >= 4 && run.spots.length >= 12, { bad, moved, kept: run.spots.length, rejects: run.spotRejects });
  },
});

story('engine/tentacles-swim-smoothly', {
  about: 'The jelly\'s tentacles are a simulated chain: swimming drags them out behind, and they move smoothly (no frame-to-frame jitter at the tips).',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.0, 3.0, 0); },
  play() {
    const { input, player } = G();
    const rig = player.avatar.tentacles, tips = [];
    step(30);
    input.keys = new Set(['KeyW']);
    for (let i = 0; i < 120; i++) { step(1); tips.push(rig.list.map((T) => T.sim[T.sim.length - 1].clone())); }
    // trailing: the tips sit behind the roots, against the swim direction
    const back = rig.list.reduce((a, T) => a + T.sim[T.sim.length - 1].clone().sub(T.sim[0]).dot(player.velocity.clone().setY(0).normalize()), 0) / rig.list.length;
    input.keys = new Set();
    let jerk = 0, n = 0;
    for (let f = 2; f < tips.length; f++) for (let k = 0; k < tips[f].length; k++, n++) jerk += tips[f][k].clone().sub(tips[f - 1][k].clone().multiplyScalar(2)).add(tips[f - 2][k]).length();
    jerk /= n;
    return ok(jerk < 0.03 && back < -0.1, { jerk: +jerk.toFixed(4), back: +back.toFixed(3) });
  },
});

story('engine/music-renders-and-builds', {
  about: 'The soundtrack (music.js) plays both songs, and more intensity brings in more layers (louder, busier).',
  setup() { fresh({ elites: false }); },
  async play() {
    const { Music } = await import('./music.js');
    const rms = async (song, I) => {
      const ctx = new OfflineAudioContext(1, 16000 * 4, 16000), m = new Music(ctx, ctx.destination);
      m.play(song, 0.05);
      m.I = I;
      m.schedule(4);
      const d = (await ctx.startRendering()).getChannelData(0);
      let sum = 0;
      for (let i = 16000; i < d.length; i++) sum += d[i] * d[i];
      return Math.sqrt(sum / (d.length - 16000));
    };
    const quiet = await rms('drift', 0), loud = await rms('drift', 1), boss = await rms('machinery', 0.9);
    const st = G().run.musicState();
    return ok(quiet > 0.002 && loud > quiet * 1.5 && boss > 0.01 && st.song === 'drift', { quiet: +quiet.toFixed(4), loud: +loud.toFixed(4), boss: +boss.toFixed(4), song: st.song });
  },
});

// a stand-in for claude.ai's db and user capabilities, in memory (leaderboard stories)
function fakeClaude({ id = 'u_me', canWrite = true, silent = false, told = true } = {}) {
  const docs = new Map(), subs = new Set();
  const snap = (p) => ({ id: p.split('/').pop(), exists: docs.has(p), data: () => docs.get(p) });
  const notify = () => subs.forEach((f) => f());
  const query = (col, field, dir, n) => ({
    orderBy: (f, d) => query(col, f, d, n), limit: (k) => query(col, field, dir, k),
    async get() {
      let list = [...docs.keys()].filter((p) => p.startsWith(col + '/')).map(snap);
      if (field) list.sort((a, b) => (dir === 'desc' ? -1 : 1) * (a.data()[field] - b.data()[field]));
      if (n) list = list.slice(0, n);
      return { docs: list, size: list.length, empty: !list.length };
    },
    onSnapshot(next) {
      const run = () => this.get().then(next);
      if (silent) return () => {};             // a viewer whose live feed never delivers
      subs.add(run); Promise.resolve().then(run);
      return () => subs.delete(run);
    },
  });
  const db = {
    collection: (c) => query(c),
    doc: (p) => ({
      get: async () => snap(p),
      set: async (d) => {
        if (!canWrite || p !== 'scores/' + id) throw { code: 'invalid_argument', message: 'no' };
        docs.set(p, d); notify();
      },
    }),
  };
  const user = { id: async () => id, can: async () => (told ? canWrite : null) };
  return { use: async (name) => ({ db, user })[name] || null, docs };
}

story('engine/leaderboard', {
  about: 'Runs post their score to the shared leaderboard (one entry each, kept only when it beats your best), read-only viewers just see it, names are escaped, and off claude.ai it says where the board lives.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { Leaderboard } = await import('./leaderboard.js');
    const tick = () => new Promise((r) => setTimeout(r, 0));
    try { localStorage.removeItem('jellyfight.best'); } catch {}
    // signed in with write access
    const fake = fakeClaude();
    window.claude = fake;
    const B = new Leaderboard();
    await B.ready;
    fake.docs.set('scores/u_other', { score: 900, name: '<b>Evil</b>' });
    const first = await B.submit({ score: 500, name: 'Jelly' });
    const lower = await B.submit({ score: 300, name: 'Jelly' });
    const higher = await B.submit({ score: 1200, name: 'Jelly' });
    await tick(); await tick();
    const order = B.rows.map((r) => r.score).join(',');
    const escaped = B.table().some(([k]) => k.includes('&lt;b&gt;Evil')) && !B.table().some(([k]) => k.includes('<b>Evil'));
    // a viewer who can only read
    window.claude = fakeClaude({ id: 'u_view', canWrite: false });
    const R = new Leaderboard();
    await R.ready;
    const ro = await R.submit({ score: 9999, name: 'Viewer' });
    // a brand-new player the platform tells nothing about (can() is null): tries, and posts
    window.claude = fakeClaude({ id: 'u_new', told: false });
    const N = new Leaderboard();
    await N.ready;
    const fresh = await N.submit({ score: 120, name: 'Newbie' });
    // the same, but the rules refuse: read-only from then on
    window.claude = fakeClaude({ id: 'u_new2', told: false, canWrite: false });
    const M = new Leaderboard();
    await M.ready;
    const refused = await M.submit({ score: 120, name: 'Newbie' });
    const refusedNote = /view-only/.test(M.note());
    // off claude.ai
    delete window.claude;
    const O = new Leaderboard();
    await O.ready;
    const off = await O.submit({ score: 50, name: 'Solo' });
    // the game: dying shows the score; it goes on the board only when you submit it, under the
    // name you type (or Guest)
    const { run, menus } = G();
    const realBoard = run.board;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const modal = () => document.querySelector('.jf-modal');
    const press = (re) => [...modal().querySelectorAll('button')].find((b) => re.test(b.textContent))?.click();
    try { localStorage.removeItem('jellyfight.name'); } catch {}
    window.claude = fakeClaude({ id: 'u_game' });
    run.board = new Leaderboard();
    await run.board.ready;
    run.kills = 12; run.level = 3;
    run.die();
    await wait(800);
    const shown = /Score/.test(modal()?.innerText || '');
    const notYet = !window.claude.docs.has('scores/u_game');
    const box = modal().querySelector('input[name="player"]');
    const home = [...modal().querySelectorAll('button')].some((b) => /Main menu/.test(b.textContent));
    box.value = 'Squid';
    press(/Submit score/);
    await wait(300);
    const doc = window.claude.docs.get('scores/u_game');
    const firstScore = run.score();
    const posted = doc?.score === firstScore && doc?.name === 'Squid' && /on the leaderboard/.test(modal()?.innerText || '') && !/Submit score/.test(modal()?.innerText || '');
    menus.close();
    // a second player who leaves the name empty is Guest (the box offers the last name typed: clear it)
    window.claude = fakeClaude({ id: 'u_guest' });
    run.board = new Leaderboard();
    await run.board.ready;
    run.start(); run.kills = 5;
    run.die();
    await wait(800);
    const remembered = modal().querySelector('input[name="player"]')?.value === 'Squid';
    modal().querySelector('input[name="player"]').value = '';
    press(/Submit score/);
    await wait(300);
    const guest = window.claude.docs.get('scores/u_guest')?.name === 'Guest';
    menus.close();
    try { localStorage.removeItem('jellyfight.name'); } catch {}
    // the board opened with no live feed at all still shows what's in the table (it read it)
    const quiet = fakeClaude({ id: 'u_quiet', silent: true });
    quiet.docs.set('scores/u_someone', { score: 24718, name: 'Jelly' });
    window.claude = quiet;
    run.board = new Leaderboard();
    run.showBoard(() => menus.close());
    await new Promise((r) => setTimeout(r, 300));
    const listed = /24,718/.test(document.querySelector('.jf-modal')?.innerText || '');
    menus.close();
    delete window.claude;
    run.board = realBoard;
    return ok(notYet && remembered && guest && home && listed && fresh.posted && !refused.posted && refused.why === 'readonly' && refusedNote && first.posted && !lower.posted && lower.why === 'lower' && higher.posted && order === '1200,900' && escaped
      && !ro.posted && ro.why === 'readonly' && O.status === 'offline' && off.why === 'offline' && shown && posted && firstScore >= 12 * 10 + 200,
      { notYet, remembered, guest, home, listed, fresh, refused, refusedNote, first, lower, higher, order, escaped, ro, off, shown, posted, score: firstScore });
  },
});

// --- the main screen
story('menu/dev-tools-locked', {
  about: 'The main screen has no Restart button and no Auto graphics; the dev tools wait behind one 🔒 Dev button: a wrong password keeps them hidden, "chan" shows them (Layout, Fight boss, 1 on 1, Other act, Diagnostics).',
  setup() { fresh({ elites: false }); try { sessionStorage.removeItem('jellyfight.dev'); } catch {} },
  play() {
    const over = document.querySelector('#g-over'), shown = (sel) => getComputedStyle(over.querySelector(sel)).display !== 'none';
    over.classList.remove('dev-ask', 'dev-open');
    over.hidden = false;
    const restart = !!over.querySelector('[data-act="restart"]'), graphics = [...over.querySelectorAll('[data-q]')].map((b) => b.dataset.q);
    const hiddenAtFirst = !shown('.dev-tools');
    over.querySelector('[data-act="dev"]').click();
    const asks = shown('.dev-lock');
    const box = over.querySelector('[name="dev-pass"]');
    box.value = 'nope'; over.querySelector('[data-act="dev-unlock"]').click();
    const stillHidden = !shown('.dev-tools');
    box.value = 'chan'; over.querySelector('[data-act="dev-unlock"]').click();
    const tools = shown('.dev-tools') ? [...over.querySelectorAll('.dev-tools button')].map((b) => b.dataset.act) : [];
    over.classList.remove('dev-ask', 'dev-open'); over.hidden = true;
    try { sessionStorage.removeItem('jellyfight.dev'); } catch {}
    return ok(!restart && graphics.join() === 'low,medium,high' && hiddenAtFirst && asks && stillHidden && tools.join() === 'layout,boss,duel,act,diag',
      { restart, graphics, hiddenAtFirst, asks, stillHidden, tools });
  },
});

// --- modes
story('modes/creator-layout-debug', {
  about: 'The Look screen, the layout editor and the F3 readout (with the whole frame\'s draw calls and shaders) open and close cleanly.',
  setup() { fresh({ elites: false }); },
  play() {
    const { menus, player, gfx } = G();
    const over = document.querySelector('#g-over');
    const click = (act) => document.querySelector(`#g-over [data-act="${act}"]`).click();
    over.hidden = false;
    click('creator'); step(30); G().GAME.render();
    const creatorCam = +G().APT.camera.position.distanceTo(player.position).toFixed(3);
    dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
    const back = !over.hidden;
    click('layout'); step(30);
    const layoutOpen = !!window.layout && gfx.focus > 0.5;
    window.layout.onDone();
    dispatchEvent(new KeyboardEvent('keydown', { code: 'F3' }));
    over.hidden = true; menus.close(); step(40);
    const text = document.querySelector('#hud')?.innerText || '';
    const readout = /\d+ fps/.test(text) && /[1-9]\d* draws \| \d+k tris \| [1-9]\d* shaders/.test(text);
    dispatchEvent(new KeyboardEvent('keydown', { code: 'F3' }));
    return ok(creatorCam > 0 && creatorCam < 0.6 && back && layoutOpen && readout, { creatorCam, back, layoutOpen, readout });
  },
});

// --- the engine
// How often and how sharp (pacing.js): fed made-up frame times, so these hold on any machine
const feed = (g, ms, secs) => { const out = []; for (let t = 0; t < secs * 1000; t += ms) { const c = g.sample(ms); if (c) out.push(c); } return out; };
story('engine/frame-cap-60', {
  about: 'Phones draw at most 60 frames a second, even on a 120 Hz screen, and slowly behind a menu; a 60 Hz screen with jittery timestamps loses no frames.',
  setup() {},
  play() {
    const count = (p, hz, secs, menu, jitter = 0) => { let n = 0; for (let i = 0; i < hz * secs; i++) if (p.due(i * 1000 / hz + (i % 2 ? jitter : -jitter), menu)) n++; return n; };
    const at120 = count(new FramePacer({ fps: 60 }), 120, 2);
    const at60 = count(new FramePacer({ fps: 60 }), 60, 2, false, 1);
    const menu = count(new FramePacer({ fps: 60, menuFps: 20 }), 60, 2, true);
    const free = count(new FramePacer({ fps: 0 }), 144, 1);
    return ok(at120 === 120 && at60 === 120 && menu >= 38 && menu <= 42 && free === 144, { at120, at60, menu, free });
  },
});
story('engine/governor-sheds-pixels-when-slow', {
  about: 'Frames running long (25 ms at a 60 fps aim) make the governor draw at a lower pixel ratio, and it keeps it when frames get faster.',
  setup() {},
  play() {
    const g = new FrameGovernor({ fps: 60, scale: 1.5, min: 1, max: 1.5 });
    const first = feed(g, 25, 2.5);
    const down = g.scale;
    feed(g, 15, 2.5);                       // the lower resolution helped
    return ok(first[0]?.scale === 1.375 && down === 1.375 && g.scale <= 1.375 && g.target < 17, { first, down, now: g.scale, log: g.log });
  },
});
story('engine/governor-learns-a-frame-cap', {
  about: 'A steady 30 fps that drawing fewer pixels doesn\'t speed up (iPhone Low Power Mode) is a cap, not a slow GPU: the governor undoes its step, aims for 30, and aims for 60 again once the cap lifts.',
  setup() {},
  play() {
    const g = new FrameGovernor({ fps: 60, scale: 1.5, min: 1, max: 1.5 });
    feed(g, 33.3, 6);
    const capped = g.log.some((l) => l.why === 'capped'), keptSharp = g.scale === 1.5, aim = Math.round(1000 / g.target);
    feed(g, 33.3, 20);
    const settled = g.scale === 1.5;
    feed(g, 16.7, 3);
    const back = Math.round(1000 / g.target);
    return ok(capped && keptSharp && aim === 30 && settled && back === 60, { capped, keptSharp, aim, settled, back, log: g.log });
  },
});
story('engine/reversed-depth', {
  about: 'With EXT_clip_control the game draws with a reversed depth buffer: the camera keeps its 2 mm near plane without log depth, and depth of field reads depth the reversed way.',
  setup() { fresh({ elites: false }); },
  play() {
    const { APT, gfx } = G(), caps = APT.renderer.capabilities;
    const can = !!APT.renderer.getContext().getExtension('EXT_clip_control');
    const was = gfx.choice;
    gfx.setQuality('high'); G().GAME.render();
    const mode = gfx.dof?.uniforms.depthMode.value;
    gfx.setQuality(was);
    const good = can ? caps.reversedDepthBuffer && !caps.logarithmicDepthBuffer && APT.camera.near === CONFIG.camera.near && mode === 2 : !caps.reversedDepthBuffer;
    return ok(good, { can, reversed: caps.reversedDepthBuffer, log: caps.logarithmicDepthBuffer, near: APT.camera.near, mode });
  },
});
story('hud/minimap-turns-with-the-camera', {
  about: 'The minimap is centred on the jelly and turned so up is where the camera looks: a treasure just ahead of the camera shows straight up from the middle at any heading, and one far away waits on the rim in its direction. The health and XP bars are big enough to read at a glance.',
  setup() { fresh({ elites: false }); tp(2.4, 0.05, 2.2, 0); },
  play() {
    const { hud, player } = G(), P = player.position, c = hud.map, g = c.getContext('2d');
    // where a pure-green marker lands on the map: the centroid of its pixels, relative to the centre
    const find = (mx, mz, yaw) => {
      hud.update(P, 0, yaw, [{ x: mx, y: P.y, z: mz, color: '#00ff00', kind: 'treasure' }]);
      const W = c.width, d = g.getImageData(0, 0, W, W).data;
      let sx = 0, sy = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 200 && d[i] < 60 && d[i + 2] < 60) { const k = i / 4; sx += k % W; sy += (k / W) | 0; n++; }
      return n ? { x: (sx / n - W / 2) / (W / 2), y: (sy / n - W / 2) / (W / 2) } : null;   // -1..1 across the map
    };
    const ahead = [0, 1.3, 2.6, -2].map((yaw) => {
      const p = find(P.x - Math.sin(yaw) * 0.6, P.z - Math.cos(yaw) * 0.6, yaw);
      return p && Math.abs(p.x) < 0.08 && p.y < -0.15 ? 1 : 0;
    });
    const far = find(P.x - 30, P.z, Math.PI / 2);          // 30 m dead ahead of a camera turned 90 degrees
    const onRim = far && Math.hypot(far.x, far.y) > 0.85 && far.y < -0.8;
    const bar = document.querySelector('#hud .moist');
    const xp = document.querySelector('#hud .xp');
    const big = bar.getBoundingClientRect().height >= 15 && xp.getBoundingClientRect().height >= 7;
    const mapSize = c.getBoundingClientRect().width;
    return ok(ahead.every(Boolean) && onRim && big && mapSize >= 190, { ahead, far, onRim, bar: bar.getBoundingClientRect().height, xp: xp.getBoundingClientRect().height, mapSize });
  },
});
story('engine/bvh-layout-checked-at-boot', {
  about: 'world.cast reads three-mesh-bvh\'s internals; a check at boot casts test rays both ways and stops the game with a clear message if they disagree (a library upgrade changed the layout), instead of every ray quietly missing.',
  setup() {},
  play() {
    const { world } = G();
    let passes = true, caught = '';
    try { checkBvhLayout(world, true); } catch { passes = false; }
    const real = world.castMesh;
    world.castMesh = function () {};                     // a walk that misreads the layout: never hits
    try { checkBvhLayout(world, true); } catch (e) { caught = e.message; } finally { world.castMesh = real; }
    return ok(passes && /three-mesh-bvh/.test(caught), { passes, caught });
  },
});
story('engine/raycast-matches-reference', {
  about: 'world.cast (our own BVH walk) gives the same hits, distances and normals as three.js Raycaster.',
  setup() { fresh({ elites: false }); },
  play() {
    const { world } = G();
    const vis = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    const ref = (origin, dir, far) => {
      const rc = world.raycaster; rc.set(origin, dir); rc.near = 0; rc.far = far;
      const list = world.nearby.filter((m, i) => { const sp = world.nearbySpheres[i]; return rc.ray.distanceSqToPoint(sp.center) <= sp.radius * sp.radius && sp.center.distanceTo(origin) - sp.radius <= far; });
      for (const h of rc.intersectObjects(list, false)) if (vis(h.object)) return { distance: h.distance, normal: h.face.normal.clone().transformDirection(h.object.matrixWorld) };
      return null;
    };
    let rays = 0, same = 0, maxD = 0, normals = 0;
    for (const s of [[3.2, 0.05, 3.0], [1.4, 0.55, 2.2], [0.6, 0.8, 3.2], [4.5, 0.95, 3.4], [2.6, 0.5, 3.0], [1.2, 0.65, 4.4]]) {
      world.focus(V(...s), 1); world._focusAge = Infinity; world.focus(V(...s), 1);
      for (let k = 0; k < 200; k++) {
        const o = V(s[0] + (Math.random() - 0.5) * 0.6, s[1] + Math.random() * 0.3, s[2] + (Math.random() - 0.5) * 0.6);
        const d = k % 3 ? V(0, 0, 0).randomDirection() : V(0, -1, 0), far = [0.05, 0.3, 3][k % 3];
        const A = ref(o, d, far), B = world.cast(o, d, far);
        rays++;
        if (!!A === !!B) same++;
        if (A && B) { maxD = Math.max(maxD, Math.abs(A.distance - B.distance)); if (A.normal.dot(B.normal) < 0.99) normals++; }
      }
    }
    return ok(same === rays && maxD < 1e-6 && normals === 0, { rays, same, maxD, normals });
  },
});
story('engine/fight-draw-calls', {
  about: 'A busy fight stays cheap to draw: bugs, bubbles and effects are instanced (batch.js).',
  setup() {
    fresh({ elites: false });
    tp(3.2, 0.05, 3.0, 0);
    const { run } = G(), P = G().player.position;
    for (const t of ['candle', 'glitter', 'battery', 'fairyLights']) run.owned.add(t);
    Object.assign(run.stats, { bubbles: 6, fireRate: 3 });
    for (let k = 0; k < 25; k++) { const a = k * 0.9, d = 0.15 + (k % 5) * 0.06; spawn(['roach', 'ants', 'mosquito'][k % 3], P.clone().add(V(Math.cos(a) * d, 0, Math.sin(a) * d)), { hp: 9999 }); }
  },
  play() {
    step(90);
    const info = G().APT.renderer.info;
    info.autoReset = false; info.reset(); G().GAME.render();
    const calls = info.render.calls;
    info.autoReset = true;
    return ok(calls < 450, { calls, instanced: G().batcher.drawn });
  },
});
// (keep this one last among the in-room stories: it leaves act 2's rooms loaded)
story('engine/act2-rooms-load-when-needed', {
  about: 'Act 1 loads the living room and the hallway you can see (but not enter) from it; act 2 (bathroom, closets) loads on demand, solid and in place.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { APT, world, GAME } = G();
    const has = (n) => !!APT.root.getObjectByName(n);
    const lights = () => { let n = 0; APT.scene.traverse((o) => { if (o.isPointLight || o.isSpotLight) n++; }); return n; };
    const before = { act1Only: [...APT.loaded].join() === 'act1', sofa: has('Corduroy_sofa'), hallLights: has('Hall_lights'), washer: has('Washer'), toilet: has('Toilet'), lights: lights(), colliders: world.colliders.length };
    const t0 = performance.now();
    const added = await GAME.loadRooms(['act2']);
    const ms = Math.round(performance.now() - t0);
    // the vanity top is solid where the bathroom's vent throws you
    world._focusAge = Infinity; world.focus(new THREE.Vector3(1.5, 1, 5.52), 0);   // collision checks what's near; look in the bathroom
    const hit = world.cast(new THREE.Vector3(1.5, 1.3, 5.52), new THREE.Vector3(0, -1, 0), 1);
    const keys = (await import('./layout.js')).movables(APT.root).map((m) => m.key);
    const after = { loaded: [...APT.loaded].join(), toilet: has('Toilet'), added: added.length, lights: lights(), colliders: world.colliders.length, vanityTop: hit ? +hit.point.y.toFixed(3) : null, toiletKey: keys.includes('Toilet#1'), ms };
    const good = before.act1Only && before.sofa && before.hallLights && !before.washer && !before.toilet && after.toilet && after.added > 40 && after.lights >= before.lights && after.colliders > before.colliders && hit && Math.abs(hit.point.y - 0.88) < 0.03 && after.toiletKey;
    return ok(good, { before, after });
  },
});

// ------------------------------------------------------------------ running them

// --- act 1 hands over to act 2
story('acts/act-1-leads-to-act-2', {
  about: 'Beating the act 1 boss, growing and taking a new element offers the way on to act 2, with the score so far.',
  setup() { fresh(); },
  play() {
    const { run, menus } = G();
    run.kills = 12;
    run.metamorph();
    document.querySelector('.jf-card')?.click();     // the evolution
    document.querySelector('.jf-card')?.click();     // the boss's element reward
    const text = document.querySelector('.jf-modal, .jf-panel, #g-ui')?.innerText || document.body.innerText;
    const go = [...document.querySelectorAll('button')].some((b) => /On to act 2/.test(b.textContent));
    menus.close();
    return ok(go && /Act 1 complete/.test(text) && /Score so far/.test(text), { go, text: text.slice(0, 160) });
  },
});

// --- act 2: the hallway and the bathroom (stage2.js). These play in a page opened on act 2,
// carrying a level-6 run with a Candle (tests/run.mjs)
// Beat every elite in this act and walk (jumping now and then) to the chest it leaves, from an
// open spot 25 cm away: the chest must be on an open spot and touchable, never inside or under
// anything (the Kettle's once landed inside the kettle, the Controller's under an overhang)
function eliteChestsReachable() {
  const { run } = G(), out = {};
  stub(run.ui, 'choose', () => {});
  stub(run.hud, 'toast', () => {});
  for (const E of [...run.elites.list]) {
    for (const t of run.roomTreasures) t.hide();
    E.dead = true;
    step(10);
    const t = run.roomTreasures.find((x) => x.active);
    if (!t) { out[E.kind] = 'no chest'; continue; }
    const p = t.pos.clone(), open = run.openSpot([p.x, p.y, p.z]).ok;
    let taken = false;
    for (let k = 0; k < 16 && !taken; k++) {
      const a = (k / 16) * Math.PI * 2, sx = p.x + Math.cos(a) * 0.25, sz = p.z + Math.sin(a) * 0.25;
      const o = run.openSpot([sx, p.y, sz]);
      if (!o.ok || Math.abs(o.y - p.y) > 0.15) continue;
      tp(sx, o.y + 0.02, sz, 0);
      for (let i = 0; i < 60 * 5 && t.active; i++) {
        const P = G().player.position;
        G().player.facing = Math.atan2(p.x - P.x, p.z - P.z); G().tpc.yaw = G().player.facing + Math.PI;
        G().input.keys = new Set(['KeyW']);
        if (i % 40 === 0) G().input.jumpQueued = true;
        G().GAME.step(1 / 60);
      }
      G().input.keys = new Set();
      taken = !t.active;
    }
    out[E.kind] = open && taken ? 'ok' : `open ${open}, taken ${taken}`;
  }
  restore();
  return ok(Object.keys(out).length > 0 && Object.values(out).every((v) => v === 'ok'), out);
}
story('elites/every-chest-reachable', {
  about: 'Every act 1 elite (Controller, Mug, Kettle) leaves its chest on an open spot the jelly can walk or jump to and touch: never inside the kettle or under the controllers.',
  setup() { fresh({ treasures: false }); },
  play: eliteChestsReachable,
});
const act2 = (name, s) => story('act2/' + name, { act: 2, ...s });
act2('every-elite-chest-reachable', {
  about: 'Every act 2 elite (Soap Dispenser, Wall Clock, Cream Whipper) leaves its chest on an open spot the jelly can walk or jump to and touch.',
  setup() { fresh({ treasures: false }); },
  play: eliteChestsReachable,
});
for (const v of STAGES[1].vents) {
  act2(`vent-to-${v.to.replace('the ', '').replace(/ /g, '-')}`, {
    about: `Stepping on the ${v.name.toLowerCase()} flings you onto ${v.to}.`,
    setup() { fresh({ elites: false }); tp(v.at[0], 0.05, v.at[2], 0); },
    play() {
      const r = sim(3);
      const [x, y, z] = r.pos, [lx, ly, lz] = v.land;
      return ok(Math.hypot(x - lx, z - lz) < 0.08 && Math.abs(y - ly) < 0.06 && r.grounded, { end: r.pos, target: v.land });
    },
  });
}

// the Soap Dispenser on the vanity (elites.js): you land beside it off the vanity vent
const soapElite = () => G().run.elites.alive.find((e) => e.kind === 'soap');
const besideSoap = () => tp(1.5, 0.9, 5.47, 0);
act2('soap-dispenser-stands-in', {
  about: 'The soap dispenser by the tap comes alive as an elite (the real one hides while it fights), and the pink soap inside drains as it\'s hurt.',
  setup() { fresh(); besideSoap(); },
  play() {
    const e = soapElite();
    if (!e) return ok(false, { elite: 'missing' });
    step(10);
    const full = e.model.liquid.scale.y;
    G().enemies.applyDamage(e.entry, e.maxHp * 0.6);
    step(60);
    const drained = e.model.liquid.scale.y < full * 0.5;
    return ok(e.hidden && !e.hidden.visible && e.name === 'The Soap Dispenser' && drained, { hidden: !!e.hidden, realShown: e.hidden?.visible, full: +full.toFixed(3), now: +e.model.liquid.scale.y.toFixed(3) });
  },
});
act2('soap-dispenser-squirt', {
  about: 'Soap squirt: it pumps three times, each glob lobbed onto a pink circle filling where you stand: a hit stings for 2 and leaves a slick that makes you slip.',
  setup() { fresh({ hurt: true }); besideSoap(); const e = soapElite(); e.cool = 0; e.next = 0; },
  play() {
    const { run } = G(), log = record('damage_taken');
    let circles = 0, slipped = false, slicks = 0;
    step(60 * 3, () => {
      circles = Math.max(circles, run.elites.blobs.length);
      slicks = Math.max(slicks, run.elites.slicks.length);
      if (run.slipT > 0) slipped = true;
    });
    const hits = log.filter((d) => d.source === 'soap');
    return ok(circles >= 1 && hits.length >= 1 && hits[0].amount === 2 && slicks >= 1 && slipped, { circles, hits: hits.map((d) => d.amount), slicks, slipped });
  },
});
act2('soap-dispenser-bubble-ring', {
  about: 'Bubble ring: it foams up while a pink ring fills round it, then lets go a ring of soap bubbles drifting outward with one gap to slip through. They all pop before long.',
  setup() { fresh({ hurt: true }); besideSoap(); const e = soapElite(); e.cool = 0; e.next = 1; },
  play() {
    const { run } = G(), e = soapElite(), dirs = [], bub = run.elites.bubble.bind(run.elites);
    stub(run.elites, 'bubble', (from, dir, ...rest) => { dirs.push(Math.atan2(dir.x, dir.z)); return bub(from, dir, ...rest); });
    let warned = false;
    step(60 * 4, () => { if (e.state === 'windup' && e.tele.length) warned = true; });
    if (!dirs.length) return ok(false, { warned, bubbles: 'none' });
    const angles = dirs.sort((a, b) => a - b);
    // the widest gap between neighbouring bubbles (going round) is the way through
    const gaps = angles.map((a, i) => (i ? a - angles[i - 1] : a + Math.PI * 2 - angles.at(-1)));
    const widest = Math.max(...gaps) * 180 / Math.PI;
    return ok(warned && angles.length === 16 && widest > 50 && run.elites.soapBubbles.length === 0, { warned, count: angles.length, widest: Math.round(widest), left: run.elites.soapBubbles.length });
  },
});
act2('soap-dispenser-angry', {
  about: 'Under half health the Soap Dispenser is angry: four squirts instead of three, and a second bubble ring right after the first.',
  setup() { fresh({ hurt: true }); besideSoap(); const e = soapElite(); e.hp = e.maxHp * 0.4; e.cool = 0; e.next = 0; },
  play() {
    const { run } = G(), e = soapElite();
    let globs = 0, bubbles = 0;
    const lob = run.elites.lob.bind(run.elites), bub = run.elites.bubble.bind(run.elites);
    stub(run.elites, 'lob', (...a) => { globs++; return lob(...a); });
    stub(run.elites, 'bubble', (...a) => { bubbles++; return bub(...a); });
    step(60 * 3, (i) => i > 10 && e.state === 'idle');          // the squirt attack, to its end
    e.cool = 0; e.next = 1;
    step(60 * 3, (i) => i > 10 && e.state === 'idle');          // then the bubble rings
    return ok(globs === 4 && bubbles === 32, { globs, bubbles });
  },
});
act2('one-on-one-soap-dispenser', {
  about: 'The 1 on 1 (dev) picker puts you on the vanity beside the Soap Dispenser, alone with it.',
  setup() { fresh(); },
  play() {
    const { run, player } = G();
    const pick = run.duelChoices().find((p) => p.name === 'The Soap Dispenser (elite, act 2)');
    if (!pick) return ok(false, { pick: 'missing' });
    run.startDuel(pick);
    step(30);
    const e = soapElite(), d = e ? Math.hypot(player.position.x - e.base.x, player.position.z - e.base.z) : 9;
    return ok(run.elites.alive.length === 1 && e && d < 0.5 && player.position.y > 0.8, { elites: run.elites.alive.length, near: +d.toFixed(2), y: +player.position.y.toFixed(2) });
  },
});
// the Wall Clock over the cubby bench (elites.js, clock-model.js): the bench vent lands you below it
const hallClock = () => G().run.elites.list.find((e) => e.kind === 'clock');
const onBench = (x = 2.06, z = 7.5) => tp(x, 0.5, z, 0);
const oldClockShown = () => { let shown = false; G().APT.root.traverse((o) => { if (/^Ornate_wall_clock/.test(o.name) && o.isMesh && o.visible) shown = true; }); return shown; };
act2('clock-hangs-on-the-wall', {
  about: 'The detailed wall clock hangs over the cubby bench in place of the apartment\'s simple one, its hands showing the real time.',
  setup() { fresh(); tp(2.75, 0.05, 6.6, 0); },
  play() {
    const e = hallClock();
    if (!e) return ok(false, { clock: 'missing' });
    step(120);
    const d = new Date(), want = -(d.getMinutes() + d.getSeconds() / 60) / 60 * Math.PI * 2, got = e.model.minuteHand.rotation.z;
    const off = Math.abs(Math.atan2(Math.sin(want - got), Math.cos(want - got)));
    return ok(!oldClockShown() && Math.abs(e.holder.position.y - 1.12) < 0.01 && off < 0.1, { oldShown: oldClockShown(), y: +e.holder.position.y.toFixed(3), handOff: +off.toFixed(3) });
  },
});
act2('clock-comes-down-to-fight', {
  about: 'Land on the cubby bench and the clock comes alive: it slides down the wall to fight you there, and goes back up once you leave.',
  setup() { fresh(); onBench(); },
  play() {
    const e = hallClock();
    step(90);
    const down = e.holder.position.y, ready = e.ready;
    e.cool = 99;
    tp(2.75, 0.05, 6.6, 0);
    step(60 * 4);
    const up = e.holder.position.y;
    return ok(down < 0.5 && ready && up > 1.1, { down: +down.toFixed(3), ready, up: +up.toFixed(3) });
  },
});
act2('clock-can-be-hit', {
  about: 'Down on the bench, the clock\'s mask is in reach: your bubbles hurt it.',
  setup() { fresh(); onBench(1.9, 7.42); G().run.hurt = () => {}; const e = hallClock(); e.cool = 99; },
  play() {
    const e = hallClock();
    step(60 * 5);
    return ok(e.hp < e.maxHp, { hp: Math.round(e.hp), max: e.maxHp });
  },
});
act2('clock-sweeping-hands', {
  about: 'Sweeping hands: a half circle fills on the bench while the hands whirl, then a golden hand sweeps across it for 3. In a far front corner of the bench it can\'t reach you.',
  setup() { fresh({ hurt: true, bubbles: false, lash: false }); onBench(); },
  play() {
    const sweep = (x, z) => {
      fresh({ hurt: true, bubbles: false, lash: false }); onBench(x, z);
      const e = hallClock(), log = record('damage_taken');
      step(90); e.cool = 0; e.next = 0;
      let warned = false, swept = false;
      step(60 * 3, () => { if (e.state === 'windup' && e.tele.length) warned = true; if (e.beam) swept = true; return swept && e.state === 'idle'; });
      return { warned, swept, hits: log.filter((d) => d.source === 'clock').map((d) => d.amount) };
    };
    const mid = sweep(2.0, 7.42), corner = sweep(2.14, 7.08);
    return ok(mid.warned && mid.swept && mid.hits[0] === 3 && corner.swept && !corner.hits.length, { mid, corner });
  },
});
act2('clock-wreath-boomerang', {
  about: 'Victory\'s wreath: a line on the bench shows where she\'ll throw it, then the wreath flies out along it and comes back to her hand: 2 if it catches you.',
  setup() { fresh({ hurt: true, bubbles: false, lash: false }); onBench(); },
  play() {
    const { run } = G(), e = hallClock(), log = record('damage_taken');
    step(90); e.cool = 0; e.next = 1;
    let warned = false, flew = false;
    step(60 * 4, () => { if (e.state === 'windup' && e.tele.length) warned = true; if (run.elites.thrown.length) flew = true; return flew && e.state === 'idle'; });
    const hits = log.filter((d) => d.source === 'clock-wreath').map((d) => d.amount);
    return ok(warned && flew && hits[0] === 2 && e.model.wreath.visible && !run.elites.thrown.length, { warned, flew, hits, back: e.model.wreath.visible });
  },
});
act2('clock-strikes-the-hour', {
  about: 'Under half health the clock also strikes the hour: three chimes, each a golden ring rolling out across the bench (2 if it rolls over you).',
  setup() { fresh({ hurt: true, bubbles: false, lash: false }); onBench(); },
  play() {
    const { run } = G(), e = hallClock(), log = record('damage_taken');
    e.hp = e.maxHp * 0.4;
    step(90); e.cool = 0; e.next = 2;
    let rings = 0;
    const ring = run.elites.rings;
    step(60 * 4, () => { rings = Math.max(rings, e.chimed + 1 || 0); return rings >= 3 && e.state === 'idle'; });
    const hits = log.filter((d) => d.source === 'clock-chime');
    // and its attacks now go round three ways
    const order = [0, 1, 2, 3].map(() => e.next++ % (e.hp < e.maxHp * 0.5 ? 3 : 2));
    return ok(rings === 3 && hits.length >= 1 && order.includes(2), { rings, hits: hits.length, order });
  },
});
act2('clock-beaten-hangs-again', {
  about: 'Beat the clock and it goes back up its wall as a plain clock (no face, no health bar), still keeping time; its treasure lands on the bench below, in reach.',
  setup() { fresh(); onBench(); },
  play() {
    const { run, enemies, menus } = G(), e = hallClock(), log = record('elite_defeated');
    step(90);
    enemies.applyDamage(e.entry, e.maxHp + 1);
    step(10);
    const chest = run.roomTreasures.find((t) => t.active && !t.timed), picked = !!chest && chest.pos.y < 0.8 && !menus.open;
    step(60 * 3);
    return ok(log.length === 1 && e.decor && !e.model.face.visible && !e.bar.visible && e.holder.position.y > 1.1 && run.elites.decor.includes(e) && picked, { chestY: chest && +chest.pos.y.toFixed(2), defeated: log.length, decor: !!e.decor, y: +e.holder.position.y.toFixed(3), picked });
  },
});

// the Cream Whipper in the hall's far corner by the front door (elites.js, whipper-model.js)
const whipper = () => G().run.elites.alive.find((e) => e.kind === 'whipper');
const byDoor = () => tp(3.15, 0.02, 8.5, 0);   // where its 1 on 1 puts you (stage2.js stand)
act2('whipper-balloon-bursts-on-time', {
  about: 'The Cream Whipper blows a balloon up on its nozzle and lets it go; it drifts after you with its burst circle filling on the floor, and bursts 3 s after it\'s let go: 2, and all the sound goes deep.',
  setup() { fresh({ hurt: true, bubbles: false, lash: false }); byDoor(); const e = whipper(); e.cool = 0; e.next = 0; },
  play() {
    const { run } = G(), log = record('damage_taken');
    let loose = -1, burst = -1, followed = false, d0 = null;
    step(60 * 6, (i) => {
      const B = run.elites.balloons[0];
      if (B && loose < 0) { loose = i; d0 = B.m.position.distanceTo(G().player.position); }
      if (B && B.t > 1.5 && B.m.position.distanceTo(G().player.position) < d0 - 0.03) followed = true;
      if (loose >= 0 && burst < 0 && !run.elites.balloons.length) burst = i;
      return burst >= 0;
    });
    const fuse = (burst - loose) / 60, hits = log.filter((d) => d.source === 'balloon');
    return ok(loose >= 0 && Math.abs(fuse - 3) < 0.1 && followed && hits[0]?.amount === 2 && isDeep(), { fuse: +fuse.toFixed(2), followed, hits: hits.map((d) => d.amount), deep: isDeep() });
  },
});
act2('whipper-deep-sound-recovers', {
  about: 'Caught in a burst, the sound stays deep for 5 s, then eases back to normal over the next few seconds.',
  setup() { fresh(); },
  play() {
    let fake = performance.now();
    stub(performance, 'now', () => fake);
    G().run.elites.balloons.length = 0;
    return import('./sfx.js').then(({ deepen }) => {
      deepen(5, 3);
      const at = (s) => { fake += s * 1000; return pitch(); };
      const p1 = at(1), p4 = at(3.5), p6 = at(2), p7 = at(1), p9 = at(2);
      return ok(p1 < 0.65 && p4 < 0.65 && p6 > p4 && p6 < p7 && p7 < 1 && p9 === 1, { p1, p4: +p4.toFixed(2), p6: +p6.toFixed(2), p7: +p7.toFixed(2), p9 });
    });
  },
});
act2('whipper-burst-misses-outside', {
  about: 'Outside the burst circle, the balloon pops harmlessly and your hearing is fine.',
  setup() { fresh({ hurt: true, bubbles: false, lash: false }); byDoor(); },
  play() {
    const { run } = G(), log = record('damage_taken');
    const e = whipper(); e.cool = 0; e.next = 0;
    let gone = false;
    step(60 * 6, () => {
      const B = run.elites.balloons[0];
      if (B && B.t > 2.6 && !gone) { gone = true; tp(2.3, 0.02, 7.0, 0); }   // dash away just before it bursts
      return gone && !run.elites.balloons.length;
    });
    return ok(gone && !log.some((d) => d.source === 'balloon') && !isDeep(), { gone, hits: log.map((d) => d.source), deep: isDeep() });
  },
});
act2('whipper-cream-spray', {
  about: 'Cream spray: the whipper tips toward you while a cone fills on the floor, then sprays whipped cream along it: 2, and it slows you.',
  setup() { fresh({ hurt: true, bubbles: false, lash: false }); tp(3.27, 0.02, 8.78, 0); const e = whipper(); e.cool = 0; e.next = 1; },
  play() {
    const { run } = G(), e = whipper(), log = record('damage_taken');
    let warned = false, slowed = false;
    step(60 * 3, () => { if (e.state === 'windup' && e.tele.length) warned = true; if (run.slowT > 0) slowed = true; return e.sprayed && e.state === 'idle'; });
    const hits = log.filter((d) => d.source === 'cream');
    return ok(warned && hits[0]?.amount === 2 && slowed, { warned, hits: hits.map((d) => d.amount), slowed });
  },
});
act2('whipper-angry-two-balloons', {
  about: 'Under half health the Cream Whipper blows two balloons each time.',
  setup() { fresh({ hurt: true, bubbles: false, lash: false }); byDoor(); const e = whipper(); e.hp = e.maxHp * 0.4; e.cool = 0; e.next = 0; },
  play() {
    const { run } = G();
    let most = 0;
    step(60 * 3.5, () => { most = Math.max(most, run.elites.balloons.length); });
    return ok(most === 2, { most });
  },
});

// the Clog (clog.js): straight into the boss fight in the tub
const clogFight = () => {
  fresh({ hurt: true, bubbles: false, lash: false });
  const { run, menus } = G();
  run.startBossIntro();
  step(60 * 6, () => { if (menus.open) document.querySelector('.jf-card')?.click(); return run.phase === 'boss' && run.boss?.rise >= 1; });
  return run.boss;
};
const clogAttack = (B, name, P) => {
  if (P) tp(...P, 0);
  B.state = 'chase'; B.stateT = 0;
  B.next = ['lash', 'snare', 'roll', 'flood', 'shed'].indexOf(name);
};
act2('act-2-fewer-bugs-more-xp', {
  about: 'Act 2 sends a little fewer bugs (0.85x the spawn rate and how many at once) and each drops a little more XP (1.2x).',
  setup() { fresh({ elites: false }); },
  play() {
    const { run, enemies, xpDrops } = G(), stage = run.stage;
    // spawns over the same minute of the night, with and without the act's `bugs`
    const count = (bugs) => {
      let n = 0;
      const was = stage.bugs, spawn = enemies.spawn, point = run.spawnPoint;
      stage.bugs = bugs;
      enemies.spawn = () => { n++; return null; };
      run.spawnPoint = () => near(0.4, 0);
      run.spawnAcc = 0; run.t = 60;
      const waves = Object.getPrototypeOf(run).spawnWaves;   // fresh() switches the waves off: call the real one
      for (let i = 0; i < 60 * 60; i++) waves.call(run, 1 / 60);
      stage.bugs = was; enemies.spawn = spawn;
      if (Object.getPrototypeOf(run).spawnPoint === point) delete run.spawnPoint; else run.spawnPoint = point;
      return n;
    };
    const plain = count(1), act2 = count(stage.bugs);
    // XP from a 5-XP kill
    let dropped = 0;
    stub(xpDrops, 'drop', (p, v, n) => { dropped += v * n; });
    run.onKill({ pos: near(0.1, 0), r: 0.01, xp: 5 });
    return ok(stage.bugs === 0.85 && stage.xpMult === 1.2 && act2 < plain && act2 >= Math.floor(plain * 0.85) - 1 && dropped === 6, { plain, act2, dropped });
  },
});
act2('camera-fixed-view-fades-what-blocks', cameraStory([[1.3, 0.72, 5.37]], 'Fluted_sideboard_8'));   // plus the bottom of the sink
act2('jump-out-of-the-sink', {
  about: 'The bathroom sink bowl is about 17 cm deep: from the bottom of it the jelly jumps clear of the rim and out (the default 20 cm jump clears it; at the old 13 cm it was stuck).',
  setup() { fresh({ elites: false }); tp(1.3, 0.72, 5.37, Math.PI); },
  play() {
    const start = sim(0.5), { input, player } = G();
    // hold forward, jumping every 2/3 s, until the jelly is past the bowl's rim
    input.keys = new Set(['KeyW']);
    let out = false;
    // out: past the bowl's far rim (z 5.5)
    step(60 * 4, (i) => { if (i % 40 === 0) input.jumpQueued = true; out = player.position.z > 5.6; return out; });
    input.keys = new Set();
    return ok(start.pos[1] < 0.75 && out, { start: start.pos, end: r3(player.position) });
  },
});
act2('act-2-hits-harder', {
  about: 'Act 2 is scaled for the stronger jelly that arrives: bugs, elites and the Clog have more health, and hits on you do 1.5x.',
  setup() { fresh({ hurt: true }); },
  play() {
    const { run, enemies } = G(), stage = run.stage;
    const fly = enemies.spawn('housefly', near(0.5, 0), stage.toughness);
    const bugX = fly.maxHp / fly.T.hp;
    const soap = run.elites.list.find((e) => e.kind === 'soap');
    run.iFrames = 0;
    const m0 = run.health;
    import('./events.js').then(({ bus, PLAYER }) => bus.emit('damage_taken', { targetId: PLAYER, amount: 2, source: 'test' }));
    return new Promise((res) => setTimeout(() => {
      const took = m0 - run.health;
      res(ok(bugX === 2 && soap.maxHp === Math.round(240 * 1.8) && Math.abs(took - 3) < 0.01, { bugX, soapHp: soap.maxHp, took: +took.toFixed(2) }));
    }, 50));
  },
});
act2('bathroom-details', {
  about: 'The tub is dressed like the real one: tile, the striped mat, the spout, thermostat and shower rail, the smiley sponge, the Pantene bottles and the wire caddy with its loofah. None of it gets in your way.',
  setup() { fresh(); },
  play() {
    let g = null; G().APT.scene.traverse((o) => { if (o.name === 'Bathroom details') g = o; });
    let meshes = 0, solid = 0; g?.traverse((o) => { if (o.isMesh) { meshes++; if (!o.userData.noCollide) solid++; } });
    return ok(g && meshes > 45 && !solid, { found: !!g, meshes, solid });
  },
});
act2('tub-is-clear', {
  about: 'The bathtub (the Clog\'s arena) is empty: the green see-through blob that sat in it is gone.',
  setup() { fresh(); },
  play() {
    let shown = false;
    G().APT.root.traverse((o) => { if (o.name === 'Bathtub_3' && o.visible) shown = true; });
    return ok(!shown, { shown });
  },
});
act2('clog-rises-and-chases', {
  about: 'When time runs out the Clog, a big wet matted hairball, rises out of the bathtub drain and rolls after you.',
  setup() {},
  play() {
    const B = clogFight(), { player } = G();
    tp(1.2, 0.16, 7.53, 0);
    const d0 = B.position.distanceTo(player.position);
    B.stateT = 99;
    step(90);
    const d1 = B.position.distanceTo(player.position);
    return ok(B.constructor.name === 'Clog' && B.rise === 1 && d1 < d0 - 0.1, { boss: B.constructor.name, d0: +d0.toFixed(2), d1: +d1.toFixed(2) });
  },
});
act2('clog-lash', {
  about: 'Hair lash: a rope of hair rears up while a line fills on the tub floor, then whips down along it: 3, and you\'re tangled (slowed).',
  setup() {},
  play() {
    const B = clogFight(), { run } = G(), log = record('damage_taken');
    clogAttack(B, 'lash', [0.62, 0.16, 7.53]);
    let warned = false;
    step(60 * 2, () => { if (B.state === 'lash' && B.lines[0].visible) warned = true; return B.struck; });
    step(2);
    const hit = log.find((d) => d.source === 'boss');
    return ok(warned && hit?.amount === 3 && run.slowT > 0.5, { warned, hit: hit?.amount, slowed: +run.slowT.toFixed(2) });
  },
});
act2('clog-snare', {
  about: 'Snare: three circles fill on the floor round you, then hair springs up in them: 2 and slowed if you\'re caught.',
  setup() {},
  play() {
    const B = clogFight(), { run } = G(), log = record('damage_taken');
    clogAttack(B, 'snare', [0.9, 0.16, 7.53]);
    let circles = 0;
    step(60 * 2, () => { circles = Math.max(circles, B.snares.filter((m) => m.visible).length); return B.sprung; });
    step(2);
    const hit = log.find((d) => d.source === 'boss');
    return ok(circles === 3 && hit?.amount === 2 && run.slowT > 0.5 && B.tufts.length > 0, { circles, hit: hit?.amount, tufts: B.tufts.length });
  },
});
act2('clog-roll', {
  about: 'Roll: it spins up while its lane lights up on the floor, then rolls down it at you: 4.',
  setup() {},
  play() {
    const B = clogFight(), log = record('damage_taken');
    clogAttack(B, 'roll', [1.1, 0.16, 7.53]);
    let lane = false, rolled = false;
    step(60 * 3, () => { if (B.state === 'roll' && B.lines[0].visible) lane = true; if (B.locked) rolled = true; return log.some((d) => d.source === 'boss'); });
    const hit = log.find((d) => d.source === 'boss');
    return ok(lane && rolled && hit?.amount === 4, { lane, rolled, hit: hit?.amount });
  },
});
act2('clog-flood', {
  about: 'Fill and drain: the spout gushes and the tub fills, then it drains all at once and the whirlpool drags you to the drain, where the Clog sits waiting (it hurts).',
  setup() {},
  play() {
    const B = clogFight(), { player } = G(), log = record('damage_taken');
    clogAttack(B, 'flood', [1.3, 0.16, 7.53]);
    let filled = 0, poured = false;
    step(60 * 2.2, () => { filled = Math.max(filled, B.waterY - B.floor); if (B.stream.visible) poured = true; });
    const d0 = Math.hypot(player.position.x - B.drain.x, player.position.z - B.drain.z);
    step(60 * 1.6);
    const d1 = Math.hypot(player.position.x - B.drain.x, player.position.z - B.drain.z);
    step(60 * 2.2);
    const drained = !B.water.visible, hurt = log.some((d) => d.source === 'boss');   // dragged into the drain (and the hairball sitting on it)
    return ok(poured && filled > 0.08 && d1 < d0 - 0.3 && drained && hurt, { poured, filled: +filled.toFixed(3), d0: +d0.toFixed(2), d1: +d1.toFixed(2), drained, hurt });
  },
});
act2('clog-ladybug-swarm-once', {
  about: 'The first time the Clog drops below 70% it roars, four ladybugs burst out of its hair, and it hides in the drain (it can\'t be hurt) until they\'re dead. It only happens once.',
  setup() {},
  play() {
    const B = clogFight(), { enemies } = G();
    tp(1.2, 0.16, 7.53, 0);
    B.hp = B.maxHp * 0.69;
    step(60 * 3);
    const bugs = B.guards.length, hp = B.hp;
    B.damage(100);
    const immune = B.hp === hp && B.shielded;
    for (const e of [...B.guards]) enemies.applyDamage(e, 1e5);
    step(60 * 3);
    B.damage(50);
    const hurtAgain = B.hp === hp - 50, back = B.state !== 'swarm' && B.sink === 0;
    B.hp = B.maxHp * 0.5;
    step(60 * 2);
    const again = B.guards.length;
    return ok(bugs === 4 && immune && hurtAgain && back && again === 0, { bugs, immune, hurtAgain, back, again });
  },
});
act2('clog-angry-spray', {
  about: 'Below 45% the Clog is angry: faster, and it spins spraying globs of drain gunk all round in three streams at once.',
  setup() {},
  play() {
    const B = clogFight();
    tp(1.2, 0.16, 7.53, 0);
    B.swarmed = true;
    B.hp = B.maxHp * 0.4;
    B.state = 'chase'; B.stateT = 0; B.next = 1;                         // the angry order: lash, spray, ...
    let globs = 0;
    step(60 * 2.5, () => { globs = Math.max(globs, B.shots.length); return B.state === 'spray' && globs >= 24; });
    const dirs = new Set(B.shots.slice(-3).map((q) => Math.round(Math.atan2(q.v.x, q.v.z) * 2)));
    return ok(B.angry && globs >= 24 && dirs.size === 3, { angry: B.angry, globs, streams: dirs.size, state: B.state });
  },
});

act2('soap-slick-slides', {
  about: 'Soap underfoot: let go on a slick and you keep sliding a long way; off it you stop almost at once.',
  setup() { fresh({ elites: false }); tp(2.75, 0.05, 6.6, 0); },
  play() {
    const { run, player } = G();
    const glide = (soapy) => {
      tp(2.75, 0.05, 7.2, Math.PI);
      if (soapy) for (let k = 0; k < 7; k++) run.elites.slick(player.position.clone().setZ(player.position.z + 0.24 + k * 0.08), 0.07, 9);   // ahead, where you let go
      sim(0.6, ['KeyW']);
      const p0 = player.position.clone();
      sim(0.5);
      const d = player.position.distanceTo(p0);
      run.elites.clear();
      return d;
    };
    const dry = glide(false), wet = glide(true);
    return ok(wet > dry * 2.5 && wet > 0.05, { dry: +dry.toFixed(3), wet: +wet.toFixed(3) });
  },
});

act2('closets-are-shut', {
  about: 'The closet doors stand ajar to peek in, but a force field keeps you out of both (and out of the living room).',
  setup() { fresh({ elites: false }); },
  play() {
    const walk = (x, z, yaw) => { fresh({ elites: false }); tp(x, 0.05, z, yaw); return sim(3, ['KeyW']).pos; };
    const laundry = walk(3.3, 5.3, -Math.PI / 2), coat = walk(2.8, 5.4, Math.PI / 2), living = walk(3.0, 5.3, 0);
    return ok(laundry[0] < 3.6 && coat[0] > 2.5 && living[2] > 4.85, { laundry, coat, living });
  },
});

act2('only-act-2-bugs', {
  about: 'Act 2\'s waves are only its four bugs (house flies, spiders, millipedes, ladybugs), none of act 1\'s.',
  setup() { fresh({ waves: true, elites: false }); G().run.t = 200; },
  play() {
    const { run, enemies } = G();
    const pool = new Set(CONTENT.waves.bugs.filter((b) => b.act === 2).map((b) => b.id));
    const seen = new Set();
    step(1800, () => { for (const e of enemies.list) if (!e.proxy && !e.elite) seen.add(e.type); run.t = 200; });
    const stray = [...seen].filter((t) => !pool.has(t));
    return ok(pool.has('spider') && pool.has('housefly') && pool.has('ladybug') && seen.size >= 3 && !stray.length, { seen: [...seen], stray });
  },
});

act2('carries-the-run', {
  about: 'Act 2 starts with what act 1 left you: level, treasures and the score so far.',
  setup() { fresh(); },
  play() {
    const { run } = G();
    return ok(run.level === 6 && run.owned.has('candle') && run.score() >= 5000 && run.health === run.stats.health && run.stats.health === 130,
      { level: run.level, owned: [...run.owned], score: run.score(), health: run.health });
  },
});

act2('never-a-first-run', {
  about: 'Act 2 never runs in first-run mode, even for a browser with no record of a finished run.',
  setup() { fresh(); },
  play() {
    const active = asNewPlayer(() => { G().run.start(); return G().run.firstRun.active; });
    return ok(!active, { active });
  },
});

act2('treasure-spots', {
  about: 'Treasures can turn up all over the hallway and bathroom, each on a real surface you can reach.',
  setup() { fresh(); },
  play() {
    const { run } = G();
    return ok(run.spots.length >= 12 && !run.spotRejects.length && run.spots.every((sp) => run.inStage(sp.at[0], sp.at[2])),
      { kept: run.spots.length, rejects: run.spotRejects });
  },
});

act2('the-clog', {
  about: 'When time is up, the Clog rises from the bathtub drain and you face it in the tub.',
  setup() { fresh(); },
  play() {
    const { run, menus, player } = G();
    run.startBossIntro();
    step(240, () => { if (menus.open) document.querySelector('.jf-card')?.click(); return run.phase === 'boss'; });
    step(60);
    const B = run.stage.boss, P = player.position;
    const inTub = P.x > B.arenaMin[0] && P.x < B.arenaMax[0] && P.z > B.arenaMin[2] && P.z < B.arenaMax[2];
    return ok(run.phase === 'boss' && run.boss?.kind === 'hair' && inTub, { phase: run.phase, kind: run.boss?.kind, at: r3(P) });
  },
});

// --- on a phone (tests/run.mjs plays these in a page that looks like a phone)
const phone = (name, s) => story('phone/' + name, { phone: true, ...s });
phone('light-slots-follow-the-jelly', {
  about: 'A phone lights the room with 6 shared lights: the lamps lighting the jelly most fade into them as it swims across the room (and the far ones out), and no shader is rebuilt on the way.',
  setup() { fresh({ elites: false }); tp(4.2, 0.05, 3.5, 0); },
  play() {
    const { pacing, APT, GAME } = G(), S = pacing.lightSlots;
    const pointLights = () => { let n = 0; APT.scene.traverse((o) => { if (o.isPointLight && o.visible) n++; }); return n; };
    step(40); GAME.render();
    const best = () => [...S.lamps].sort((a, b) => b.score - a.score)[0].light;   // the lamp lighting the jelly most
    const east = best(), eastLit = S.lit().includes(east), eastSet = S.lit();
    const programs = APT.renderer.info.programs.length, lights = pointLights();
    const fading = [];
    for (let i = 0; i < 40; i++) {   // swim, not teleport: a few cm a frame
      G().player.position.x = 4.2 - (3.5 * i) / 40; G().player.position.z = 3.5 - (2.2 * i) / 40; GAME.step(1 / 60); }
    for (const s of S.slots) if (s.lamp && s.lamp.w > 0 && s.lamp.w < 1) fading.push(+s.lamp.w.toFixed(2));
    step(60); GAME.render();
    const west = best(), westLit = west !== east && S.lit().includes(west) && eastSet.some((l) => !S.lit().includes(l));
    // the light count never changed, so no shader was rebuilt for it (a rebuild would add ~100
    // programs; a new effect appearing on the way may add one)
    const same = APT.renderer.info.programs.length - programs < 5 && pointLights() === lights;
    return ok(S.slots.length === 6 && S.lit().length <= 6 && eastLit && westLit && fading.length > 0 && same,
      { slots: S.slots.length, lamps: S.lamps.length, lit: S.lit().length, eastLit, westLit, fading, programs, lights, nowPrograms: APT.renderer.info.programs.length });
  },
});
phone('the-first-minute', {
  about: 'A player\'s first minute on a phone plays in the same order as on desktop: moving only, the Health hint, the first card, the Element pick, then the first Treasure with the minimap.',
  setup() {},
  play: firstMinute,
});
phone('graphics-reset-recovers', {
  about: 'When the graphics chip resets (iOS backgrounding), the game pauses with a note, rebuilds once the browser gives the GPU back, and draws again; no error panel.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { APT, GAME, gpu, gfx } = G();
    const ext = APT.renderer.getContext().getExtension('WEBGL_lose_context');
    const wait = (f, ms = 60000) => new Promise((res) => { const t0 = performance.now(); const tick = () => (f() || performance.now() - t0 > ms ? res(f()) : setTimeout(tick, 50)); tick(); });
    const before = gpu.restores;
    ext.loseContext();
    const lost = await wait(() => gpu.lost, 5000);
    const note = document.querySelector('.gpu-note'), noteShown = !note.hidden;
    const paused = !document.querySelector('#g-over').hidden;
    ext.restoreContext();
    const back = await wait(() => gpu.restores > before);
    document.querySelector('#g-over').hidden = true;
    step(5); GAME.render();
    const drew = gfx.frameInfo.calls > 0;
    const panel = [...document.querySelectorAll('.jf-keep')].some((e) => /⚠/.test(e.textContent));
    return ok(lost && noteShown && paused && back && note.hidden && drew && !panel, { lost, noteShown, paused, back, noteHidden: note.hidden, drew, calls: gfx.frameInfo.calls, panel });
  },
});

// Headless: play one story, return { name, ok, info, ms } (errors fail the story). A story's play()
// may be async (one that waits for a download).
export async function runStory(name) {
  const s = STORIES[name];
  const t0 = performance.now();
  try {
    s.setup();
    const r = await s.play();
    return { name, ok: r.ok, info: r.info, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    return { name, ok: false, info: { error: String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') }, ms: Math.round(performance.now() - t0) };
  } finally {
    restore();
    G().input.keys = new Set();
  }
}

// Live: set the story up and let the game run it in real time (index.html?story=name)
export function mount(name) {
  const s = STORIES[name];
  if (!s) return list(`No story called "${name}".`);
  if ((s.act || 1) !== currentAct()) return goToAct(s.act || 1);   // it plays in another act: reload into it
  s.setup();
  document.getElementById('g-over').hidden = true;
  const tag = document.createElement('div');
  tag.style.cssText = 'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:30;max-width:90vw;padding:8px 12px;border-radius:10px;background:#000a;color:#fff;font:13px system-ui;text-align:center;pointer-events:none';
  tag.innerHTML = `<b>${name}</b><br>${s.about}`;
  document.body.appendChild(tag);
}

// index.html?stories: every story as a link
export function list(note = '') {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:60;overflow:auto;padding:20px;background:#0d1020f0;color:#fff;font:14px system-ui';
  const groups = {};
  for (const [name, s] of Object.entries(STORIES)) (groups[name.split('/')[0]] ||= []).push([name, s]);
  el.innerHTML = `<h2 style="margin:0 0 6px">Stories</h2><p style="opacity:.7;margin:0 0 14px">${note || 'Tap one to watch it in the real game.'}</p>` +
    Object.entries(groups).map(([g, items]) => `<h3 style="margin:14px 0 6px;text-transform:capitalize">${g}</h3>` +
      items.map(([n, s]) => `<a href="?story=${encodeURIComponent(n)}" style="display:block;color:#9fe2ff;padding:5px 0">${n.split('/')[1]}<br><span style="color:#fff9;font-size:12px">${s.about}</span></a>`).join('')).join('');
  document.body.appendChild(el);
}
