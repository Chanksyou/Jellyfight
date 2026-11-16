// Stories: act 4's night, the living room at dawn (stage4.js), the act's first scene. tests/run.mjs
// opens these on an act-4 page with the shark's run carried over (CARRY4); at time-up the stage door
// opens on the media console, and through it the arena loads (act4.js plays that scene).
import { STAGES, SAVE_KEY, keptRun, nav, stageOf } from '../stages.js';
import { ENCORE, STAGE4 } from '../stage4.js';
import { FEATS_KEY, PEARLS_KEY } from '../cosmetics.js';
import { G, V, fresh, night4, ok, step, stub, tp } from './kit.js';
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
  about: 'Act 4 starts in act 1\'s living room, not the arena: the run arrives just inside the hallway door facing the room, with its level from act 3, at 6:00 AM, 3 minutes before the stage door opens. No boss, no Elites yet.',
  setup() { fresh(); },
  play() {
    const { run, player, hud } = G(), P = player.position;
    step(2);
    const clock = hud.el.querySelector('.clock').textContent + ' ' + hud.el.querySelector('.stage').textContent;
    const room = run.stage === STAGE4 && STAGES[3] === STAGE4 && !G().APT.arena && run.stage.parts.join() === 'act1';
    const atDoor = Math.hypot(P.x - 3.05, P.z - 4.4) < 0.03 && Math.abs(player.facing - Math.PI) < 0.01;
    return ok(room && atDoor && run.phase === 'explore' && !run.boss && run.level === 15 && run.duration === 180 && run.elites.alive.length === 0
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
    const before = enemies.list.filter((e) => !e.dead).length;
    run.t = run.duration - 0.5;
    step(60);
    const gone = enemies.list.filter((e) => !e.dead).length;
    step(60 * 6);
    const after = enemies.list.filter((e) => !e.dead).length, clock = hud.el.querySelector('.clock').textContent;
    const marked = run.markers().some((m) => m.color === '#9fd8ff');
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

night4('the-dawn-look-warms-across-the-night', {
  about: 'Act 4\'s room is lit by the dawn values (look.css --dawn-*), not the night\'s: the blue hour at 6:00 AM (fill, sky, haze, an unlit glow card on the window wall) warming to gold by 8:00 AM, with no light added or removed.',
  setup() { fresh(); },
  play() {
    const { run, APT } = G(), S = APT.scene, card = () => S.getObjectByName('Dawn window');
    const near = (a, b) => Math.abs(a - b) < 0.005;   // a frame or two into the night
    const hex = (c) => '#' + c.getHexString();
    const lights = () => { let n = 0; S.traverse((o) => { if (o.isLight) n++; }); return n; };
    step(2);
    const lit = lights(), start = { fill: S.environmentIntensity, sky: hex(S.background), haze: S.fog.density, window: hex(card().material.color) };
    run.t = run.duration; run.nightT = 0;
    step(2);
    const end = { fill: S.environmentIntensity, sky: hex(S.background), window: hex(card().material.color) };
    const unlit = card().material.isMeshBasicMaterial && card().position.x < 0;
    return ok(near(start.fill, LOOK.num('dawn-fill')) && start.sky === LOOK.color('dawn-sky') && near(start.haze, LOOK.num('dawn-haze')) && start.window === LOOK.color('dawn-window')
      && near(end.fill, LOOK.num('dawn-fill-late')) && end.sky === LOOK.color('dawn-sky-late') && end.window === LOOK.color('dawn-window-late')
      && unlit && lights() === lit, { start, end, lit });
  },
});
