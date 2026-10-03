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
import { rollCards, rollTreasures, RARITY, TREASURE_RARITY, xpToNext } from './stats.js';
import { parse } from './kdl.js';
import { LOOK } from './look.js';
import { SPECIES, buildCharacter, normalizeLook } from './character.js';
import { STAGES, currentAct, goToAct } from './stages.js';
import { pitch, isDeep } from './sfx.js';

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

// A clean run with the noise switched off: no waves, no gifts, no level-ups, no dying
// (each can be turned back on), and the start pick skipped.
export function fresh({ waves = false, gifts = false, hurt = false, levels = false, elites = true, bubbles = true, lash = true } = {}) {
  const { run, menus, enemies } = G();
  restore();
  document.getElementById('g-over').hidden = true;   // the game doesn't step behind the pause menu
  menus.close();
  run.start();
  run.startPicked = true;
  menus.close();
  if (!waves) stub(run, 'spawnWaves', () => {});
  if (!gifts) stub(run, 'updateGifts', () => {});
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

const step = (n, each) => { for (let i = 0; i < n; i++) { G().GAME.step(1 / 60); if (each && each(i) === true) return i; } return n; };
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
// --- golden gifts: on a schedule, somewhere else in the room, for a limited time
story('gifts/appear-on-schedule', {
  about: 'Golden gifts appear at 0:15, 1:00, 1:45, 2:30, 3:00 and 3:45, each somewhere else, and fade after 15 s if nobody takes them.',
  setup() { fresh({ elites: false, gifts: true }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { run } = G(), seen = [], spots = new Set();
    let gone = 0;
    stub(run.hud, 'toast', (text) => { if (/faded/.test(text)) gone++; });
    const wasActive = { v: false };
    for (let i = 0; i < 60 * 240; i++) {
      G().GAME.step(1 / 60);
      if (run.gift.active && !wasActive.v) { seen.push(Math.round(run.t)); spots.add(run.gift.spot.label); }
      wasActive.v = run.gift.active;
    }
    const want = [15, 60, 105, 150, 180, 225];
    return ok(seen.length === 6 && seen.every((t, k) => Math.abs(t - want[k]) <= 1) && gone >= 5 && spots.size >= 4, { seen, gone, spots: [...spots] });
  },
});
story('gifts/touch-for-a-treasure', {
  about: 'Touching a golden gift in time offers a treasure pick, and it goes away.',
  setup() { fresh({ elites: false, gifts: true }); tp(3.2, 0.05, 3.0, 0); G().run.t = 14.9; },
  play() {
    const { run, menus } = G();
    step(30, () => run.gift.active);
    const p = run.gift.pos.clone();
    let offered = false;
    stub(run.ui, 'choose', () => { offered = true; });
    tp(p.x, p.y + 0.01, p.z);
    step(20, () => offered);
    return ok(offered && !run.gift.active, { offered, at: r3(p) });
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
    const dmg = b[0].dmg / run.S.pop;
    return ok(first.length === 3 && sameFrame && parallel && gaps.every((g) => g > 0.01) && Math.abs(dmg - 0.85 ** 2) < 1e-6,
      { n: first.length, sameFrame, parallel, gaps: gaps.map((g) => +g.toFixed(3)), dmg: +dmg.toFixed(3) });
  },
});

story('attack/element-projectiles', {
  about: 'Each element treasure turns the bubble into its own projectile (a fireball, ball lightning, an ice shard, an acid glob, a wind gust, a glitter bomb), and the lightning one crackles with arcs.',
  setup() { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const P = G().player.position; spawn('roach', P.clone().add(V(0, 0, -0.25)), { still: true, hp: 1e6 }); },
  play() {
    const { run } = G();
    const seen = {};
    let arcs = 0;
    for (const [id, el] of [['candle', 'fire'], ['battery', 'lightning'], ['freezerPack', 'ice'], ['nailPolish', 'acid'], ['paperFan', 'wind'], ['glitter', 'glitter']]) {
      run.owned = new (run.owned.constructor)(); run.owned.add(id);
      run.bubbles.reset(); run.bubbles.timer = 1;
      step(6);
      seen[el] = run.bubbles.list.map((b) => b.m.userData.look).filter(Boolean)[0] || null;
      if (el === 'lightning') arcs = run.bubbles.looks.arcN;
    }
    const all = Object.entries(seen).every(([el, look]) => el === look);
    return ok(all && arcs > 0, { seen, arcs });
  },
});

story('treasures/start-pick-two-elements', {
  about: 'The starting treasure pick offers two element treasures and one of anything else.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { run, menus } = G();
    let good = 0, tries = 0, sample = null;
    stub(menus, 'choose', (title, sub, list) => {
      tries++;
      const els = list.filter((t) => ELEMENTS_IDS.includes(t.id)).length;
      if (list.length === 3 && els === 2) good++;
      sample = list.map((t) => t.id);
    });
    for (let i = 0; i < 100; i++) run.pickTreasure('', '', true);
    restore();
    return ok(tries === 100 && good === 100, { tries, good, sample });
  },
});

// --- the bugs
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
  about: 'A mosquito hovers out of reach and its spit costs you moisture.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const P = G().player.position; spawn('mosquito', P.clone().add(V(0, 0.1, -0.15))); },
  play() {
    const { run } = G();
    run.iFrames = 0;
    const m0 = run.moisture;
    step(60 * 10, () => run.moisture < m0);
    return ok(run.moisture < m0, { lost: +(m0 - run.moisture).toFixed(2) });
  },
});

story('enemies/stapler-fans-five-staples', {
  about: 'A standing stapler fires a fan of five staples, about 50 degrees across, from its head.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('stapler', near(0, -0.35)); e.shootT = 0.8; },
  play() {
    const { enemies } = G(), e = enemies.list[0];
    let shots = [];
    step(60 * 3, () => { if (enemies.shots.length >= 5) { shots = enemies.shots.slice(0, 5); return true; } });
    const angle = (s) => Math.atan2(s.v.x, s.v.z) * 180 / Math.PI, a = shots.map(angle);
    const fan = a.length ? Math.max(...a) - Math.min(...a) : 0, high = shots.every((s) => s.m.position.y > e.pos.y + e.r * 1.8);
    return ok(shots.length === 5 && Math.abs(fan - 50) < 3 && high && shots.every((s) => s.source === 'staple'), { shots: shots.length, fan: +fan.toFixed(1), high, hp: e.maxHp });
  },
});
story('enemies/stapler-staples-hurt', {
  about: 'A staple costs you 5 moisture; a stapler takes 80 damage to clear.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('stapler', near(0, -0.3)); e.shootT = 0.8; },
  play() {
    const { run, enemies } = G(), e = enemies.list[0];
    run.iFrames = 0;
    const m0 = run.moisture;
    step(60 * 4, () => run.moisture < m0);
    return ok(m0 - run.moisture === 5 && e.T.hp === 80, { lost: m0 - run.moisture, hp: e.T.hp });
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
        for (const t of rollTreasures(CONTENT.treasures, 3, luck)) { treasures++; if (t.rarity === 'epic' || t.rarity === 'legendary') top++; }
      }
      return { epicCards: +(epic / cards).toFixed(3), epicOrLegendaryTreasures: +(top / treasures).toFixed(3) };
    };
    const none = share(0), lucky = share(60);
    return ok(lucky.epicCards > none.epicCards * 1.6 && lucky.epicOrLegendaryTreasures > none.epicOrLegendaryTreasures * 1.4, { none, lucky });
  },
});
story('content/every-treasure-has-a-rarity', {
  about: 'Every treasure is rated common, rare, epic or legendary, and every rarity has treasures.',
  setup() {},
  play() {
    const ids = TREASURE_RARITY.map((r) => r.id), count = Object.fromEntries(ids.map((id) => [id, 0]));
    for (const t of CONTENT.treasures) count[t.rarity] = (count[t.rarity] ?? NaN) + 1;
    return ok(ids.every((id) => count[id] > 0) && Object.keys(count).length === ids.length, count);
  },
});
story('progression/regen', {
  about: 'Moisture regen (a card or Hand Cream) refills moisture every second.',
  setup() { fresh({ elites: false, lash: false, bubbles: false }); tp(3.2, 0.05, 3.0, 0); G().run.stats.regen = 0.5; G().run.moisture = 10; },
  play() { step(60 * 4); const m = G().run.moisture; return ok(Math.abs(m - 12) < 0.05, { moisture: +m.toFixed(2) }); },
});
story('progression/dodge', {
  about: 'Dodge % makes that share of hits miss (starts at 0, capped at 60).',
  setup() { fresh({ elites: false, lash: false, bubbles: false, hurt: true }); tp(3.2, 0.05, 3.0, 0); G().run.stats.dodge = 50; },
  play() {
    const { run } = G();
    let missed = 0;
    for (let i = 0; i < 200; i++) { run.moisture = 50; run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount: 1, source: 'story' }); if (run.moisture === 50) missed++; }
    run.stats.dodge = 500;
    return ok(missed > 70 && missed < 130 && run.S.dodge === 60, { missed, of: 200, capped: run.S.dodge });
  },
});
story('progression/level-curve', {
  about: 'Each level needs 1.5x the dew of the last, starting at 3: three cockroaches (1 dew each) is level 2.',
  setup() { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { run } = G(), curve = [1, 2, 3, 4, 5, 6].map(xpToNext);
    let killed = 0;
    for (let k = 0; k < 3; k++) {
      const e = spawn('roach', near(0, -0.15), { still: true, hp: 1 });
      step(240, () => e.dead);
      if (e.dead) killed++;
      tp(e.pos.x, 0.05, e.pos.z);                  // swim over to where it burst and pick up the dew
      step(120);
    }
    const ok1 = curve.join() === '3,5,7,10,15,23' && killed === 3 && run.level === 2 && xpToNext(run.level) === 5;
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
  about: 'The millipede curls into a ball (taking no damage while curled), revs up spinning while its lane lights up on the floor, then rolls into you for 4. Once it uncurls it can be hurt again.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('millipede', near(0, -0.32)); e.ballCd = 0.3; },
  play() {
    const { enemies } = G(), e = enemies.list[0], log = record('damage_taken');
    const seen = new Set();
    let warned = false, immune = null, spun = 0, hit = null;
    step(60 * 6, () => {
      seen.add(e.state);
      if (e.state === 'spin' && enemies.chargeMarks.some((m) => m.visible)) warned = true;
      if (e.state === 'spin' && immune === null) { const hp = e.hp; enemies.applyDamage(e, 25); immune = e.hp === hp; }
      spun = Math.max(spun, e.spinA || 0);
      hit = hit || log.find((d) => d.source === 'millipede' && d.amount === 4);
      return hit && e.state === 'rest';
    });
    const hp = e.hp;
    enemies.applyDamage(e, 10);
    const hurtAfter = e.hp === hp - 10;
    return ok(['curl', 'spin', 'dash'].every((s) => seen.has(s)) && warned && immune && spun > 5 && hit && hurtAfter,
      { states: [...seen], warned, immune, spun: +spun.toFixed(1), hit: hit?.amount, hurtAfter });
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
  about: 'spit: a mosquito dips its nose and spits; the shot costs you moisture.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('mosquito', near(0, -0.15, 0.1)); },
  play() {
    const { run } = G();
    run.iFrames = 0;
    const m0 = run.moisture, e = G().enemies.list[0];
    let aimed = false;
    step(60 * 10, () => { if (e.aimT > 0) aimed = true; return run.moisture < m0; });
    return ok(aimed && run.moisture < m0, { aimed, lost: +(m0 - run.moisture).toFixed(2) });
  },
});
story('words/spit-dodge', {
  about: 'spit: the laser flies down its aiming line, so stepping off the line after it locks on dodges it.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('mosquito', near(0, -0.2, 0.1)); e.shootT = 0.6; },
  play() {
    const { run, enemies } = G(), e = enemies.list[0], P = G().player.position;
    run.iFrames = 0;
    const m0 = run.moisture;
    let shot = false;
    // wait until the aim has locked, then slip 6 cm to the side
    step(60, () => e.aimT > 0 && e.aimT < 0.2);
    tp(P.x + 0.06, P.y, P.z);
    step(90, () => { if (enemies.shots.length) shot = true; });
    return ok(shot && run.moisture === m0, { shot, lost: m0 - run.moisture });
  },
});
story('words/leap', {
  about: 'leap: a lanternfly crawls up, crouches over a marked landing spot, springs high and slams down on you.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('lanternfly', near(0, -0.45)); e.leapCd = 0; },
  play() {
    const { run, enemies } = G(), e = enemies.list[0], y0 = e.pos.y;
    run.iFrames = 0;
    const m0 = run.moisture, seen = new Set();
    let top = 0, mark = null;
    step(60 * 8, () => {
      seen.add(e.state);
      if (e.state === 'leap') top = Math.max(top, e.pos.y - y0);
      if (e.state === 'crouch' && enemies.leapMarks[0]?.visible) mark = true;
      return run.moisture < m0;
    });
    const ok1 = ['approach', 'crouch', 'leap', 'rest'].every((s) => seen.has(s)) && top > 0.15 && mark && m0 - run.moisture === 3;
    return ok(ok1, { states: [...seen], height: +top.toFixed(3), mark, lost: m0 - run.moisture });
  },
});
story('words/drift', {
  about: 'drift: a dust mote floats at your middle (bathroom stage).',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('mote', near(0.4, 0, 0.15)); },
  play() { const e = G().enemies.list[0], d0 = e.pos.distanceTo(G().player.position); step(90); const d1 = e.pos.distanceTo(G().player.position); return ok(d0 - d1 > 0.15 && e.T.fly, { before: +d0.toFixed(3), after: +d1.toFixed(3) }); },
});
story('words/rolls', {
  about: 'rolls: a dust bunny tumbles along the floor as it comes at you (bathroom stage).',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('bunny', near(0.4, 0)); },
  play() { const e = G().enemies.list[0], a = e.mesh.rotation.x; step(30); return ok(Math.abs(e.mesh.rotation.x - a) > 1, { turned: +(e.mesh.rotation.x - a).toFixed(2) }); },
});
story('words/slows-on-touch', {
  about: 'slows-on-touch: brushing against lint slows you down (bathroom stage).',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('lint', near(0.03, 0), { still: true }); },
  play() { step(10); return ok(G().run.slowT > 0, { slowT: +G().run.slowT.toFixed(2) }); },
});

// --- guards: the vocabulary stays complete, and content mistakes are caught
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
    const unknown = tryIt('enemy "x" hp=1 r=0.01 dmg=1 dew=1 {\n    lurk 3\n}');
    const badArgs = tryIt('enemy "x" hp=1 r=0.01 dmg=1 dew=1 {\n    chase\n}');
    const badProp = tryIt('enemy "x" hp=1 r=0.01 dmg=1 dew=1 {\n    chase 0.3\n    curl-dash wndup=1\n}');
    const noMove = tryIt('enemy "x" hp=1 r=0.01 dmg=1 dew=1 {\n    rolls\n}');
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
story('treasures/mark-on-hit', {
  about: 'mark-on-hit (Sticky Note): bugs you hit are marked and take 50% more damage.',
  setup() { setupFight({ lash: false }); give('stickyNote'); roachAt(0, -0.15); },
  play() { const e = G().enemies.list[0]; step(120, () => e.markT > 0); return ok(e.markT > 0 && !!e.note, { markT: +e.markT.toFixed(2) }); },
});
story('treasures/crit', {
  about: 'crit (Nail Clipper): about 1 hit in 5 does triple damage.',
  setup() { setupFight({ lash: false }); give('nailClipper'); roachAt(0, -0.15); },
  play() {
    const log = record('damage_taken'), pop = G().run.stats.pop;
    step(60 * 20);
    const hits = dmgBy(log, 'bubble'), crits = hits.filter((d) => Math.abs(d.amount - pop * 3) < 1e-6).length;
    return ok(hits.length > 20 && crits > 0 && crits < hits.length * 0.5, { hits: hits.length, crits });
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
story('treasures/damage-taken', {
  about: 'damage-taken (Shot Glass): hits take 25% more moisture.',
  setup() { setupFight({ hurt: true }); give('shotGlass'); },
  play() { const { run } = G(), m0 = run.moisture; run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount: 4, source: 'story' }); return ok(Math.abs(m0 - run.moisture - 5) < 1e-9, { lost: m0 - run.moisture }); },
});
story('treasures/spout', {
  about: 'spout (Whale Bath Toy): stand still and you refill moisture.',
  setup() { setupFight({ bubbles: false, lash: false }); give('whale'); G().run.moisture = 10; },
  play() { step(60 * 3); return ok(G().run.moisture > 10.5, { moisture: +G().run.moisture.toFixed(2) }); },
});
story('treasures/heal-on-kill', {
  about: 'heal-on-kill (Baby Bottle): every bug you clear gives back a sip of moisture.',
  setup() { setupFight({ lash: false }); give('babyBottle'); G().run.moisture = 10; roachAt(0, -0.15, { still: true }); },
  play() { const e = G().enemies.list[0]; step(300, () => e.dead); return ok(e.dead && G().run.moisture === 10.5, { moisture: G().run.moisture }); },
});
story('treasures/burst-on-kill', {
  about: 'burst-on-kill (Bath Salt): bugs you finish off burst and hurt their neighbours.',
  setup() { setupFight({ lash: false }); give('bathSalt'); G().run.stats.bubbles = 1; roachAt(0, -0.12, { still: true, hp: 12 }); roachAt(0.035, -0.12); },
  play() { const log = record('damage_taken'); step(400, () => dmgBy(log, 'burst').length > 0); return ok(dmgBy(log, 'burst').length > 0, { bursts: dmgBy(log, 'burst').length }); },
});
story('treasures/dew-reach', {
  about: 'dew-reach (Fridge Magnet): dew flies to you from much farther away.',
  setup() { setupFight({ bubbles: false, lash: false }); give('magnet'); G().dew.drop(near(0.18, 0, 0.01), 1, 1); },
  play() { step(120); return ok(G().dew.list.length === 0, { left: G().dew.list.length }); },
});
story('treasures/dew-mult', {
  about: 'dew-mult (Spilled Sugar): bugs drop 30% more dew.',
  setup() { setupFight({ lash: false }); give('sugar'); spawn('mosquito', near(0, -0.15), { still: true, hp: 1 }); },
  play() { const e = G().enemies.list[0]; step(300, () => e.dead); const total = G().dew.list.reduce((a, d) => a + d.value, 0); return ok(e.dead && total === Math.round(e.T.dew * 1.3), { dew: total, base: e.T.dew }); },
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
  about: 'stack=N: a stackable treasure (Lemon Slice, stack=3) adds up per copy and stops being offered at 3; a unique one is never offered twice.',
  setup() { setupFight(); give('lemon', 'lemon', 'bobbyPin'); },
  play() {
    const { run } = G(), b = run.stats.pop;
    const two = run.S.pop;
    let offered = [];
    stub(run.ui, 'choose', (title, sub, choices) => { offered = choices.map((c) => c.id); });
    const seen = new Set();
    for (let i = 0; i < 200; i++) { run.pickTreasure(); offered.forEach((id) => seen.add(id)); }
    const lemonOffered = seen.has('lemon');
    give('lemon');
    seen.clear();
    for (let i = 0; i < 200; i++) { run.pickTreasure(); offered.forEach((id) => seen.add(id)); }
    return ok(two === b + 4 && run.S.pop === b + 6 && run.owned.count('lemon') === 3 && lemonOffered && !seen.has('lemon') && !seen.has('bobbyPin'), { two, three: run.S.pop, lemonOffered, afterFull: seen.has('lemon'), pin: seen.has('bobbyPin') });
  },
});
story('treasures/stat', {
  about: 'stat (Lemon Slice, Coffee Bean): a treasure adds to a stat, flat or by a percent.',
  setup() { setupFight({ lash: false }); give('lemon'); give('coffeeBean'); },
  play() {
    const { run } = G(), b = run.stats;
    return ok(run.S.pop === b.pop + 2 && Math.abs(run.S.blowRate - b.blowRate * 1.25) < 1e-9, { pop: [b.pop, run.S.pop], blowRate: [b.blowRate, +run.S.blowRate.toFixed(3)] });
  },
});
story('treasures/grow-on-kills', {
  about: 'grow-on-kills (Bandage): every 5 bugs you clear, +1 max moisture for good (and it refills).',
  setup() { setupFight({ bubbles: false, lash: false }); give('bandage'); },
  play() {
    const { run } = G(), max0 = run.S.moisture;
    const kill = () => bus.emit('enemy_killed', { type: 'roach', pos: near(0.05, 0, 0.02), floor: G().player.position.y, r: 0.02, dew: 1 });
    for (let i = 0; i < 4; i++) kill();
    const after4 = run.S.moisture;
    for (let i = 0; i < 6; i++) kill();
    return ok(after4 === max0 && run.S.moisture === max0 + 2 && run.moisture === run.S.moisture, { max0, after4, after10: run.S.moisture });
  },
});
story('treasures/heal-on-hit', {
  about: 'heal-on-hit (Plastic Fangs): about 1 bubble or tentacle hit in 10 gives back 1 moisture.',
  setup() { setupFight({ bubbles: false, lash: false }); give('fangs'); roachAt(0.3, 0); },
  play() {
    const { run } = G(), e = G().enemies.list[0];
    let heals = 0;
    for (let i = 0; i < 300; i++) { run.moisture = 5; bus.emit('damage_taken', { targetId: e.id, amount: 0.01, source: 'bubble' }); if (run.moisture > 5) heals++; }
    run.moisture = 5; bus.emit('damage_taken', { targetId: e.id, amount: 0.01, source: 'zap' });
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
story('treasures/dew', {
  about: 'dew inside every (Houseplant): every 12 s, 2 dew drips at your feet.',
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
  about: 'A typo in treasures.kdl names the file, line and problem.',
  setup() {},
  play() {
    const tryIt = (src) => { try { compileTreasures(parse(src, 'test.kdl'), 'test.kdl'); return null; } catch (e) { return e.message; } };
    const unknown = tryIt('treasure "x" name="X" icon="x" text="x" {\n    pierce 3\n    sparkle\n}');
    const element = tryIt('treasure "x" name="X" icon="x" text="x" {\n    element "plasma"\n}');
    const block = tryIt('treasure "x" name="X" icon="x" text="x" {\n    every 5 {\n        explode\n    }\n}');
    const good = /test\.kdl:3: unknown word "sparkle"/.test(unknown) && /test\.kdl:2: element must be one of/.test(element) && /test\.kdl:3: unknown word "explode"/.test(block);
    return ok(good, { unknown, element, block });
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
story('events/kill-drops-dew', {
  about: 'Bubbles kill a roach: it bursts, counts as a kill and drops dew.',
  setup() { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const P = G().player.position; spawn('roach', P.clone().add(V(0, 0, -0.18)), { still: true }); },
  play() {
    const { run, enemies, dew } = G();
    const e = enemies.list[0], k0 = run.kills;
    step(300, () => e.dead);
    return ok(e.dead && run.kills === k0 + 1 && dew.list.length > 0 && !enemies.byId.has(e.id), { dead: e.dead, dew: dew.list.length });
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
    const m0 = run.moisture;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 3, source: 'story' });
    const m1 = run.moisture;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 3, source: 'story' });
    const m2 = run.moisture;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 1, source: 'story', drain: true });
    return ok(m1 === m0 - 3 && m2 === m1 && run.moisture === m2 - 1, { m0, m1, m2, m3: run.moisture });
  },
});
story('events/elite-defeat-gives-treasure', {
  about: 'Beating an elite opens a treasure pick.',
  setup() { fresh(); },
  play() {
    const { run, enemies, menus } = G();
    const mug = run.elites.list.find((e) => e.kind === 'mug'), entry = enemies.list.find((e) => e.proxy === mug);
    bus.emit('damage_taken', { targetId: entry.id, amount: 9999, source: 'story' });
    step(5);
    const pick = menus.open;
    menus.close();
    return ok(mug.dead && pick, { dead: mug.dead, pick });
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
    run.stats.sting = 60; run.stats.tentacles = 4;
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

story('gifts/not-on-vent-landings', {
  about: 'No golden gift spot sits on a vent\'s landing point: the ones that did moved over, onto the same surface.',
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
function fakeClaude({ id = 'u_me', canWrite = true } = {}) {
  const docs = new Map(), subs = new Set();
  const snap = (p) => ({ id: p.split('/').pop(), exists: docs.has(p), data: () => docs.get(p) });
  const notify = () => subs.forEach((f) => f());
  const query = (col, field, dir, n) => ({
    orderBy: (f, d) => query(col, f, d, n), limit: (k) => query(col, field, dir, k),
    onSnapshot(next) {
      const run = () => {
        let list = [...docs.keys()].filter((p) => p.startsWith(col + '/')).map(snap);
        if (field) list.sort((a, b) => (dir === 'desc' ? -1 : 1) * (a.data()[field] - b.data()[field]));
        if (n) list = list.slice(0, n);
        next({ docs: list, size: list.length, empty: !list.length });
      };
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
  const user = { id: async () => id, can: async () => canWrite };
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
    // off claude.ai
    delete window.claude;
    const O = new Leaderboard();
    await O.ready;
    const off = await O.submit({ score: 50, name: 'Solo' });
    // the game: dying shows the score and posts it
    const { run, menus } = G();
    const realBoard = run.board;
    window.claude = fakeClaude({ id: 'u_game' });
    run.board = new Leaderboard();
    run.kills = 12; run.level = 3;
    run.die();
    await new Promise((r) => setTimeout(r, 800));
    const shown = /Score/.test(document.querySelector('.jf-modal')?.innerText || '');
    const posted = window.claude.docs.get('scores/u_game')?.score === run.score();
    menus.close();
    delete window.claude;
    run.board = realBoard;
    return ok(first.posted && !lower.posted && lower.why === 'lower' && higher.posted && order === '1200,900' && escaped
      && !ro.posted && ro.why === 'readonly' && O.status === 'offline' && off.why === 'offline' && shown && posted && run.score() >= 12 * 10 + 200,
      { first, lower, higher, order, escaped, ro, off, shown, posted, score: run.score() });
  },
});

// --- modes
story('modes/creator-layout-debug', {
  about: 'The Look screen, the layout editor and the F3 readout open and close cleanly.',
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
    const readout = /\d+ fps/.test(document.querySelector('#hud')?.innerText || '');
    dispatchEvent(new KeyboardEvent('keydown', { code: 'F3' }));
    return ok(creatorCam > 0 && creatorCam < 0.6 && back && layoutOpen && readout, { creatorCam, back, layoutOpen, readout });
  },
});

// --- the engine
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
    Object.assign(run.stats, { bubbles: 6, blowRate: 3 });
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
  about: 'Beating the act 1 boss and growing offers the way on to act 2, with the score so far.',
  setup() { fresh(); },
  play() {
    const { run, menus } = G();
    run.kills = 12;
    run.metamorph();
    document.querySelector('.jf-card')?.click();
    const text = document.querySelector('.jf-modal, .jf-panel, #g-ui')?.innerText || document.body.innerText;
    const go = [...document.querySelectorAll('button')].some((b) => /On to act 2/.test(b.textContent));
    menus.close();
    return ok(go && /Act 1 complete/.test(text) && /Score so far/.test(text), { go, text: text.slice(0, 160) });
  },
});

// --- act 2: the hallway and the bathroom (stage2.js). These play in a page opened on act 2,
// carrying a level-6 run with a Candle (tests/run.mjs)
const act2 = (name, s) => story('act2/' + name, { act: 2, ...s });
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
  about: 'Beat the clock and it goes back up its wall as a plain clock (no face, no health bar), still keeping time; you get a treasure pick.',
  setup() { fresh(); onBench(); },
  play() {
    const { run, enemies, menus } = G(), e = hallClock(), log = record('elite_defeated');
    step(90);
    enemies.applyDamage(e.entry, e.maxHp + 1);
    step(10);
    const picked = menus.open;
    menus.close();
    step(60 * 3);
    return ok(log.length === 1 && e.decor && !e.model.face.visible && !e.bar.visible && e.holder.position.y > 1.1 && run.elites.decor.includes(e) && picked, { defeated: log.length, decor: !!e.decor, y: +e.holder.position.y.toFixed(3), picked });
  },
});

// the Cream Whipper by the front door (elites.js, whipper-model.js)
const whipper = () => G().run.elites.alive.find((e) => e.kind === 'whipper');
const byDoor = () => tp(3.0, 0.02, 7.85, 0);
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
  setup() { fresh({ hurt: true, bubbles: false, lash: false }); tp(3.2, 0.02, 7.92, 0); const e = whipper(); e.cool = 0; e.next = 1; },
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
  about: 'Act 2\'s waves bring its own bugs (spiders, house flies, ladybugs and staplers among them), none of act 1\'s.',
  setup() { fresh({ waves: true, elites: false }); G().run.t = 200; },
  play() {
    const { run, enemies } = G();
    const pool = new Set(CONTENT.waves.bugs.filter((b) => b.act === 2).map((b) => b.id));
    const seen = new Set();
    step(900, () => { for (const e of enemies.list) if (!e.proxy && !e.elite) seen.add(e.type); run.t = 200; });
    const stray = [...seen].filter((t) => !pool.has(t));
    return ok(pool.has('spider') && pool.has('housefly') && pool.has('ladybug') && seen.size >= 3 && !stray.length, { seen: [...seen], stray });
  },
});

act2('carries-the-run', {
  about: 'Act 2 starts with what act 1 left you: level, treasures and the score so far.',
  setup() { fresh(); },
  play() {
    const { run } = G();
    return ok(run.level === 6 && run.owned.has('candle') && run.score() >= 5000 && run.moisture === run.stats.moisture && run.stats.moisture === 130,
      { level: run.level, owned: [...run.owned], score: run.score(), moisture: run.moisture });
  },
});

act2('gift-spots', {
  about: 'Golden gifts can turn up all over the hallway and bathroom, each on a real surface you can reach.',
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
