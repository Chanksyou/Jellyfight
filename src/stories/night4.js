// Stories: act 4's night, the living room at dawn (stage4.js), the act's first scene. tests/run.mjs
// opens these on an act-4 page with the shark's run carried over (CARRY4); at time-up the stage door
// opens on the media console, and through it the arena loads (act4.js plays that scene).
import { STAGES, SAVE_KEY, keptRun, nav, stageOf } from '../stages.js';
import { ENCORE, STAGE4, ELITES4 } from '../stage4.js';
import * as THREE from 'three';
import { SONGS } from '../music.js';
import { movables, visibleBox } from '../layout.js';
import { FEATS_KEY, PEARLS_KEY } from '../cosmetics.js';
import * as kit from './kit.js';
import { G, V, fresh, night4, ok, sim, step, stub, tp } from './kit.js';
import { LOOK } from '../look.js';

const STATE = 'jellyrun.act';
// run fn, then put back the act's state, the kept run and the lifetime totals a run adds to
function keepingSaves(fn) {
  const act = sessionStorage.getItem(STATE), keys = [SAVE_KEY, FEATS_KEY, PEARLS_KEY], kept = keys.map((k) => localStorage.getItem(k)), name = window.name;
  try { return fn(); } finally {
    if (act === null) sessionStorage.removeItem(STATE); else sessionStorage.setItem(STATE, act);
    keys.forEach((k, i) => (kept[i] === null ? localStorage.removeItem(k) : localStorage.setItem(k, kept[i])));
    window.name = name;
  }
}
// start the act over with this carry (a reload's or the stage door's), then put the page's own back
function startWith(carry, fn) {
  const { run } = G(), was = run.carry, resumed = run.resumed;
  try { run.carry = carry; run.resumed = false; run.start(); return fn(); }
  finally { run.carry = was; run.resumed = resumed; }
}
// the jelly on the media console, where the stage door is, with the door open
function atTheDoor() {
  const { run } = G();
  run.t = run.duration;
  step(1);
  run.xpDrops.clear(); run.pendingLevels = 0;
  tp(1.6, 0.62, 4.55);
}

night4('the-act-opens-in-the-living-room-at-dawn', {
  about: 'Act 4 starts in act 1\'s living room, not the arena: the run arrives just inside the hallway door facing the room, with its level from act 3, at 6:00 AM, 3 minutes before the stage door opens. No boss; the room\'s Elites wait asleep on their furniture.',
  setup() { fresh(); },
  play() {
    const { run, player, hud } = G(), P = player.position;
    step(2);
    const clock = hud.el.querySelector('.clock').textContent + ' ' + hud.el.querySelector('.stage').textContent;
    const room = run.stage === STAGE4 && STAGES[3] === STAGE4 && !G().APT.arena && run.stage.parts.join() === 'act1';
    const atDoor = Math.hypot(P.x - 3.05, P.z - 4.4) < 0.03 && Math.abs(player.facing - Math.PI) < 0.01;
    return ok(room && atDoor && run.phase === 'explore' && !run.boss && run.level === 15 && run.duration === 180 && run.elites.alive.length === STAGE4.elites.length && run.elites.alive.every((e) => !e.awake)
      && /Stage door in (3:00|2:5\d)/.test(clock) && /6:00 AM · The Encore/.test(clock),
    { room, at: [P.x, P.z], facing: player.facing, phase: run.phase, level: run.level, duration: run.duration, clock });
  },
});

night4('time-up-opens-the-stage-door-instead-of-a-boss', {
  about: 'When the 3 minutes are up no boss comes: the bugs go, no more come, and the stage door opens on the media console (a toast, a hint, a marker on the map). The act stays in the room until the jelly goes through.',
  setup() { fresh({ waves: true }); },
  play() {
    const { run, hud, enemies, player } = G(), toasts = [];
    stub(hud, 'toast', (t) => toasts.push(t));
    for (let i = 0; i < 3; i++) enemies.spawn('mantis', player.position.clone().add(V(0.3 + 0.1 * i, 0, -0.4)), 1);
    step(2);
    const before = enemies.list.filter((e) => !e.dead && !e.proxy).length;
    run.t = run.duration - 0.5;
    step(60);
    const gone = enemies.list.filter((e) => !e.dead && !e.proxy).length;
    step(60 * 6);
    const after = enemies.list.filter((e) => !e.dead && !e.proxy).length, clock = hud.el.querySelector('.clock').textContent;
    const marked = run.markers().some((m) => m.kind === 'exit');
    return ok(before > 0 && gone === 0 && after === 0 && run.doorOpen && run.phase === 'explore' && !run.boss
      && toasts.some((t) => /stage door is open/.test(t)) && !toasts.some((t) => /Time's up/.test(t)) && /Stage door open/.test(clock) && marked,
    { before, gone, after, door: run.doorOpen, phase: run.phase, toasts, clock, marked });
  },
});

night4('through-the-stage-door-the-arena-loads-with-the-act-carried', {
  about: 'Landing on the media console with the door open reloads into the arena, the act\'s second scene, the way an act change does: the act as it stands (Health, level, Treasures, kills, the act\'s clock) goes with it, the room\'s chests don\'t, and there is no Legendary or Attack upgrade pick.',
  setup() { fresh(); },
  play() {
    const { run, menus } = G();
    return keepingSaves(() => {
      let reloads = 0;
      stub(nav, 'reload', () => { reloads++; });
      stub(run, 'dev', false);
      run.health = 77; run.kills = 41;
      atTheDoor();
      step(3);
      const s = JSON.parse(sessionStorage.getItem(STATE)), M = s?.carry?.mid, kept = keptRun();
      const carried = M && M.scene === 2 && M.health === 77 && M.kills === 41 && M.t >= 180 && !M.chests.length && !M.treasureTimesLeft.length
        && M.now.level === 15 && M.now.owned.some(([id]) => id === 'goldRing') && s.carry.score === 24000;
      return ok(reloads === 1 && s.act === 4 && s.scene === 2 && s.then?.continue && carried && run.phase === 'door' && !menus.open
        && kept?.act === 4 && kept.scene === 2 && kept.carry.mid.scene === 2 && stageOf(4, 2) === ENCORE,
      { reloads, act: s?.act, scene: s?.scene, then: s?.then, mid: M && { scene: M.scene, health: M.health, kills: M.kills, t: M.t, chests: M.chests.length }, phase: run.phase, pick: menus.open, kept: kept && { act: kept.act, scene: kept.scene } });
    });
  },
});

night4('the-stage-door-is-shut-before-time-up', {
  about: 'The media console is just furniture during the night: standing on it before 8:00 AM does nothing.',
  setup() { fresh(); },
  play() {
    const { run } = G();
    let reloads = 0;
    stub(nav, 'reload', () => { reloads++; });
    run.t = 60;
    tp(1.6, 0.62, 4.55);
    step(30);
    return ok(reloads === 0 && !run.doorOpen && run.phase === 'explore', { reloads, door: run.doorOpen, phase: run.phase });
  },
});

night4('a-reload-in-the-room-picks-the-night-up', {
  about: 'A reload part way through the night (the act\'s progress kept every second) comes back to the room at the same act clock and Health, not a fresh night.',
  setup() { fresh(); },
  play() {
    const { run } = G();
    run.t = 100; run.health = 66;
    const mid = run.progress();
    return startWith({ ...run.carry, mid }, () => ok(run.stage === STAGE4 && Math.abs(run.t - 100) < 0.01 && run.health === 66 && mid.scene === 1,
      { t: run.t, health: run.health, scene: mid.scene }));
  },
});

night4('a-run-kept-in-the-arena-before-the-night-opens-in-the-room', {
  about: 'A run saved part way through act 4 before it had a night (its progress was kept in the arena, with no scene) opens in the room at the start of the night, from the act\'s carry, not part way through.',
  setup() { fresh(); },
  play() {
    const { run } = G();
    run.t = 40; run.health = 9;
    const { scene, ...old } = run.progress();
    return startWith({ ...run.carry, mid: old }, () => ok(run.stage === STAGE4 && run.t === 0 && run.health === run.S.health && run.level === 15 && !run.resumed,
      { t: run.t, health: run.health, max: run.S.health, level: run.level }));
  },
});

night4('fight-boss-from-the-room-goes-through-the-door', {
  about: 'The dev Fight boss pick for the Encore, made in act 4\'s room, reloads into the arena (scene 2), where the Encore is.',
  setup() { fresh(); },
  play() {
    const { run } = G();
    return keepingSaves(() => {
      let reloads = 0;
      stub(nav, 'reload', () => { reloads++; });
      const pick = run.bossChoices().find((p) => p.act === 4);
      run.startBossFight(pick);
      const s = JSON.parse(sessionStorage.getItem(STATE));
      return ok(reloads === 1 && s.act === 4 && s.scene === 2 && s.then?.boss === pick.name && !run.boss, { reloads, state: s });
    });
  },
});

night4('dying-in-the-room-says-how-far-the-stage-door-was', {
  about: 'A death in the room counts down to the stage door, not to the Encore (who is in the next scene); a run kept in act 4\'s arena before it had a night is offered to continue from the start of the room, at the act\'s carried level.',
  setup() { fresh(); },
  play() {
    const { run } = G();
    run.t = run.duration - 83;
    const close = run.howClose();
    return keepingSaves(() => {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ act: 4, carry: { level: 15, score: 24000, mid: { t: 40, now: { level: 19, score: 30000 } } } }));
      const k = keptRun();
      return ok(close === 'The stage door was 1:23 away' && k.scene === undefined && !k.carry.mid && k.carry.level === 15, { close, kept: k });
    });
  },
});

// --- the room's own map (layout-baked.js act 4, ELITES4): vents, chests and the three Elites' spots
// the small props on the furniture (boxes of things under 60 cm; a big sparse plant's box is no use), as [name, box]
function smallProps(skip) {
  const out = [];
  for (const { key, node } of movables(G().APT.root)) {
    const b = visibleBox(node, new THREE.Box3());
    if (!node.visible || b.isEmpty() || skip.test(key) || b.max.x - b.min.x > 0.6 || b.max.z - b.min.z > 0.6) continue;
    out.push([key, b]);
  }
  return out;
}
// metres from a point to the nearest small prop standing at that height (xz distance to its box)
const nearProp = (skip, x, y, z) => Math.min(...smallProps(skip).filter(([, b]) => b.max.y > y + 0.02 && b.min.y < y + 0.3)
  .map(([, b]) => Math.hypot(Math.max(b.min.x - x, 0, x - b.max.x), Math.max(b.min.z - z, 0, z - b.max.z))));

night4('every-vent-lands-where-it-says', {
  about: 'Each of act 4\'s six vents flings the jelly to its landing spot, standing: the three by the Elites land across the furniture from them.',
  setup() { fresh({ elites: false }); },
  play() {
    const { traversal } = G(), bad = [];
    for (const v of traversal.vents) {
      tp(v.x, 0.05, v.z, 0);
      const r = sim(3), [lx, ly, lz] = v.land;
      if (!(Math.hypot(r.pos[0] - lx, r.pos[2] - lz) < 0.08 && Math.abs(r.pos[1] - ly) < 0.06 && r.grounded)) bad.push({ to: v.to, end: r.pos, land: v.land });
    }
    return ok(traversal.vents.length === 6 && !bad.length, { bad });
  },
});

night4('every-chest-spot-is-open', {
  about: 'Every chest spot the act lists is open in this layout: none is covered, crowded, or on a vent\'s landing, so no run drops one (Run.openSpot rejects).',
  setup() { fresh(); },
  play() {
    const { run } = G();
    return ok(run.spots.length === STAGE4.spots.length && run.spots.length >= 8 && !run.spotRejects.length, { listed: STAGE4.spots.length, kept: run.spots.length, rejects: run.spotRejects });
  },
});

night4('each-elite-spot-is-on-its-furniture-and-clear', {
  about: 'The Singing bowl\'s spot is on the lounge chair seat, the Mushroom pillow\'s on the sofa seat and the Headphones\' on the kitchen counter by the stove: each on its furniture\'s own surface, 15 cm clear of other small props, 30 cm or more from its vent\'s landing on the same surface, which sits in its wake box. The act spawns all three, where it says.',
  setup() { fresh(); },
  play() {
    const { run, traversal, APT } = G(), THREEBOX = THREE.Box3;
    const FURNITURE = { 'lounge chair': 'Lounge_chair#1', sofa: 'Corduroy_sofa#1', 'kitchen counter': 'Kitchen#1' };
    const bad = [];
    for (const e of ELITES4) {
      const v = traversal.vents.find((q) => q.name === e.vent), node = movables(APT.root).find((m) => m.key === FURNITURE[e.area]).node;
      const f = visibleBox(node, new THREEBOX()), [x, y, z] = e.at, [lx, ly, lz] = v.land, w = e.wake;
      const own = new RegExp(`^(${e.hide}|${FURNITURE[e.area].replace(/#.*/, '')})#`);
      const checks = {
        onFurniture: x > f.min.x && x < f.max.x && z > f.min.z && z < f.max.z && Math.abs(y - ly) < 0.02 && y < f.max.y,
        clear: nearProp(own, x, y, z) > 0.15,
        landsClear: nearProp(own, lx, ly, lz) > 0.06 && Math.hypot(x - lx, z - lz) > 0.3,
        wakes: [x, lx].every((a, i) => a > w.min[0] && a < w.max[0]) && [z, lz].every((a) => a > w.min[2] && a < w.max[2]) && y > w.min[1] && y < w.max[1],
        faces: Math.abs(Math.sin(e.face) * (lz - z) - Math.cos(e.face) * (lx - x)) < 0.05 && Math.sin(e.face) * (lx - x) + Math.cos(e.face) * (lz - z) > 0,   // toward the landing, not away
        hidesARealObject: movables(APT.root).some((m) => m.key.startsWith(e.hide + '#')),
      };
      if (Object.values(checks).some((c) => !c)) bad.push({ kind: e.kind, checks });
    }
    const spawned = run.elites.list.map((e) => e.kind), placed = run.elites.list.every((e) => e.spec === ELITES4.find((q) => q.kind === e.kind));
    return ok(ELITES4.length === 3 && !bad.length && spawned.join() === 'bowl,pillow,headphones' && placed, { bad, spawned });
  },
});

night4('elites-are-spread-out-so-two-never-wake-together', {
  about: 'Act 4\'s three Elites stand 2 m or more apart and their wake boxes never overlap, so no spot in the room is inside two of them: the jelly never fights two at once.',
  setup() { fresh(); },
  play() {
    const bad = [];
    for (const [i, a] of ELITES4.entries()) for (const b of ELITES4.slice(i + 1)) {
      const apart = Math.hypot(a.at[0] - b.at[0], a.at[2] - b.at[2]);
      const overlap = [0, 1, 2].every((k) => a.wake.min[k] < b.wake.max[k] && b.wake.min[k] < a.wake.max[k]);
      if (apart < 2 || overlap) bad.push({ pair: [a.kind, b.kind], apart: +apart.toFixed(2), overlap });
    }
    return ok(!bad.length, { bad });
  },
});

night4('the-act-plays-sunrise-set', {
  about: 'Act 4\'s night plays its own song, "Sunrise Set", not the stand-in from act 3.',
  setup() { fresh(); },
  play() { return ok(STAGE4.music === 'sunrise' && !!SONGS.sunrise, { music: STAGE4.music }); },
});

night4('the-dawn-look-warms-across-the-night', {
  about: 'The interior dawn fill, sky and haze warm across Act 4. The city remains visible and brightens on the same mesh and atlas, with no light added or removed.',
  setup() { fresh(); },
  play() {
    const { run, APT } = G(), S = APT.scene, city = S.getObjectByName('Skyline');
    if (!city) return ok(false, { city: false });
    const daylight = city.material.userData.daylight, map = city.material.map;
    const near = (a, b) => Math.abs(a - b) < 0.005;   // a frame or two into the night
    const hex = (c) => '#' + c.getHexString();
    const lights = () => { let n = 0; S.traverse((o) => { if (o.isLight) n++; }); return n; };
    step(2);
    const lit = lights(), start = { fill: S.environmentIntensity, sky: hex(S.background), haze: S.fog.density, daylight: daylight.value };
    run.t = run.duration; run.nightT = 0;
    step(2);
    const end = { fill: S.environmentIntensity, sky: hex(S.background), daylight: daylight.value };
    return ok(near(start.fill, LOOK.num('dawn-fill')) && start.sky === LOOK.color('dawn-sky') && near(start.haze, LOOK.num('dawn-haze'))
      && near(end.fill, LOOK.num('dawn-fill-late')) && end.sky === LOOK.color('dawn-sky-late')
      && start.daylight > 0 && start.daylight < 0.5 && end.daylight === 1
      && !S.getObjectByName('Dawn window') && city.material.map === map && lights() === lit, { start, end, lit });
  },
});
night4('cicadas-from-1-30', {
  about: 'A roll favouring the last eligible bug cannot spawn a cicada before 1:30 in the living room, but spawns one at exactly 1:30.',
  setup() { fresh({ waves: true, elites: false }); },
  play() {
    const { run, enemies, player } = G();
    stub(Math, 'random', () => .999999);
    stub(run, 'spawnPoint', () => player.position.clone());
    const during = (t) => { enemies.clear(); run.t = t; run.spawnAcc = 1; run.spawnWaves(0); return enemies.list.filter((e) => e.type === 'cicada').length; };
    const before = during(89.999), after = during(90);
    return ok(!before && after > 0, { before, after });
  },
});

// act 4's Elites attack about 40% more often since snap=2 and the shorter windups and rests: this plays each one
// for a minute on the run's own beat (the jelly held on its spot, no damage) and counts the attacks it starts
// (`e.next` counts them). The bowl gains least: its rings stay a bar apart. BEFORE (snap 4, old windups, rest 1.0): bowl 11, pillow 17, headphones 9 in 60 s.
night4('elites-attack-faster', {
  about: 'Left to attack for a minute, the Singing Bowl, the Mushroom Pillow and the Headphones together start at least 30% more attacks than they did on whole-bar timing, and each at least 10% more (their old counts are in this story).',
  setup() {},
  play() {
    const BEFORE = { bowl: 11, pillow: 17, headphones: 9 }, out = {};
    for (const [kind, at] of [['bowl', kit.onChair], ['pillow', kit.onSofa], ['headphones', kit.onCounter]]) {
      fresh({ bubbles: false, lash: false }); at();
      stub(G().run, 'song', null);
      const e = G().run.elites.list.find((q) => q.kind === kind), player = kit.holdJelly();
      step(60); e.cool = 0; e.next = 0;
      step(60 * 60);
      out[kind] = e.next;
    }
    const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
    return ok(sum(out) >= sum(BEFORE) * 1.3 && Object.keys(BEFORE).every((k) => out[k] >= BEFORE[k] * 1.1), { attacksPerMinute: out, before: BEFORE });
  },
});
