// Stories: the main screen, dev tools, modes, the engine, the leaderboard. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { STAGES, nav } from '../stages.js';
import { serverBuild, reloadIfStale } from '../fresh.js';
import { FramePacer, FrameGovernor } from '../pacing.js';
import { World, checkBvhLayout, hitSpot } from '../collision.js';
import { loadLayout, applyLayout, visibleBox } from '../layout.js';
import { BAKED_LAYOUT } from '../layout-baked.js';
import { juice } from '../juice.js';
import { LOOK } from '../look.js';
import { BAKED_AO, fingerprint } from '../baked-ao.js';
import { BAKED_LIGHT, bakeFingerprint, setBakedLight } from '../baked-light.js';
import { NEEDS, PRICES, FEATS_KEY, PEARLS_KEY, lifetime, requirement, requirementText, unlocked, bank, pearlsFor, feats } from '../cosmetics.js';
import { FOUND_KEY } from '../collection.js';
import { normalizeLook, buildCharacter, DEFAULT_LOOK, OPTIONS, SPECIES } from '../character.js';
import { TYPES } from '../enemies.js';
import { TREASURES } from '../stats.js';
import { bus, PLAYER } from '../events.js';
import { FieldPerf } from '../field-perf.js';
import { markMoved } from '../static-batch.js';
import { G, V, evolve, fresh, near, ok, setupFight, spawn, step, story, phone, stub, tp } from './kit.js';

story('engine/field-numbers-ride-the-summary', {
  about: 'A played act\'s summary carries the frame numbers (median and slowest-5% frame, share of slow frames, lowest pixel ratio, tier, cap, screen) and the Settings picks, only after enough frames to mean something, and a dev run sends none.',
  setup: () => fresh({ elites: false, lash: false }),
  play() {
    const { run, GAME, gfx, pacing } = G(), rows = [];
    stub(run, 'telemetryDisabled', false);
    stub(run, 'board', { runLog: {}, saveRun: row => rows.push(row) });
    stub(pacing.pacer, 'due', () => true);
    Object.assign(pacing.field, new FieldPerf());
    step(2);
    // synthetic frame times in the past: a time ahead of now would give the next real frame a huge negative dt and break the music
    const base = performance.now() - 1e5, frame = (now) => GAME.frame(base + now);
    for (let i = 0; i < 10; i++) frame(i * 16);
    run.recordRun('in-progress');
    const tooFew = rows.at(-1).details.perf == null;
    for (let i = 10; i < 40; i++) frame(i * 16);
    frame(40 * 16 + 60); frame(40 * 16 + 120);   // two slow frames (the first interval after the stub is a skipped hitch)
    run.recordRun('in-progress');
    const d = rows.at(-1).details, p = d.perf, s = d.settings;
    const sane = p && p.n === 41 && p.ms > 16 && p.ms < 18 && p.p95 > 16 && p.p95 < 18 && p.slow > 0.04 && p.slow < 0.06 && p.minRatio > 0 && p.tier === gfx.quality
      && p.dpr === Math.round(devicePixelRatio * 100) / 100 && p.w === innerWidth && p.h === innerHeight && p.cap === (pacing.pacer.fps || 0) && p.lost === 0 && p.loadMs >= 0;
    const picks = s && s.graphics === gfx.choice && typeof s.easy === 'boolean' && typeof s.music === 'boolean' && typeof s.sound === 'boolean' && typeof s.calm === 'boolean' && typeof s.calmOs === 'boolean' && ['normal', 'large'].includes(s.text);
    const count = rows.length;
    run.devRun(); run.recordRun('ended');
    return ok(tooFew && sane && picks && rows.length === count, { tooFew, p, s, devSent: rows.length - count });
  },
});
story('engine/field-numbers-count-played-frames', {
  about: 'The frame numbers keep a fixed 64-bucket histogram: hitches over 250 ms and bad intervals are not frames, a 2 ms bucket is its middle, and 200 ms lands in the last bucket without growing anything.',
  setup() {},
  play() {
    const f = new FieldPerf();
    for (const ms of [0, -5, NaN, 251, 4000]) f.sample(ms, 16.7, 1.5);
    const none = f.n === 0 && f.summary({}) === null;
    for (let i = 0; i < 90; i++) f.sample(10.1, 16.7, 1.5);
    for (let i = 0; i < 10; i++) f.sample(200, 16.7, 1);
    const s = f.summary({ tier: 'medium' });
    return ok(none && f.hist.length === 64 && s.n === 100 && s.ms === 11 && s.p95 === 127 && s.slow === 0.1 && s.minRatio === 1 && s.tier === 'medium',
      { none, s });
  },
});
story('engine/run-log', {
  about: 'Actual play starts one act report, Health loss is summarized by source, hiding checkpoints without counting a death, completed outcomes survive hiding, and dev runs send nothing.',
  setup: () => fresh({ hurt: true }),
  play() {
    const { run } = G(), rows = [];
    stub(run, 'telemetryDisabled', false);
    stub(run, 'board', { runLog: {}, saveRun: row => rows.push(row) });
    run.recordRun('in-progress');
    const noMenuRun = rows.length === 0;
    step(0.02);
    const startedOnce = rows.length === 1 && rows[0].outcome === 'started';
    const id = run.logId;
    run.hurtBy = 'roach'; run.hurt(2, true); run.hurtBy = null;
    run.recordRun('in-progress');
    const checkpoint = rows.at(-1).outcome === 'in-progress' && rows.at(-1).lost.roach === 2 && rows.at(-1).run === id;
    const before = rows.length;
    run.recordRun('in-progress');
    const dedup = rows.length === before;
    run.phase = 'dead'; run.recordRun('in-progress');
    const died = rows.at(-1).outcome === 'died';
    run.phase = 'explore'; run.recordRun('in-progress');
    const stillFinal = rows.at(-1).outcome === 'died';
    const count = rows.length;
    run.devRun(); run.recordRun('ended');
    const devSkipped = rows.length === count;
    return ok(noMenuRun && startedOnce && checkpoint && dedup && died && stillFinal && devSkipped,
      { noMenuRun, startedOnce, checkpoint, dedup, died, stillFinal, devSkipped });
  },
});

story('engine/run-details', {
  about: 'The act report records defeated Elites and chosen Treasures with active-play timestamps and stack counts, retains its earlier snapshots, and names the unit and attack that dealt the fatal hit.',
  setup: () => fresh({ hurt: true }),
  play() {
    const { run } = G(), rows = [];
    stub(run, 'telemetryDisabled', false);
    stub(run, 'board', { runLog: {}, saveRun: row => rows.push(row) });
    step(1 / 60);
    stub(run.ui, 'choose', (_title, _sub, choices, pick) => pick(choices[0]));
    stub(run.ui, 'treasure', () => {});
    const treasure = TREASURES.find(t => t.id === 'goldRing');
    run.t = 12.3; run.offer('', '', [treasure], () => {});
    const elite = run.elites.list[0];
    run.t = 25; bus.emit('elite_defeated', { elite });
    run.recordRun('in-progress');
    const earlier = rows.at(-1).details;
    run.t = 55.4; run.offer('', '', [treasure], () => {});
    run.health = 1;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 10, source: 'coffee', drain: true });
    run.recordRun('in-progress');
    const d = rows.at(-1).details;
    const elites = d.elitesBeaten === 1 && d.elites[0][0] === elite.kind && d.elites[0][1] === 25;
    const pickups = d.treasuresObtained === 2 && JSON.stringify(d.pickups) === JSON.stringify([['goldRing', 12.3, 1], ['goldRing', 55.4, 2]]);
    const immutable = earlier.pickups.length === 1 && earlier.killedBy === null;
    const fatal = rows.at(-1).outcome === 'died' && d.killedBy.unit === 'mug' && d.killedBy.source === 'coffee';
    const carried = run.carryOver().logId === run.logId;
    return ok(elites && pickups && immutable && fatal && carried, { elites, pickups, immutable, fatal, carried, details: d });
  },
});

story('engine/run-death-attribution', {
  about: 'Fatal attribution follows a projectile after its owner is gone, labels the act boss, and only records a death after death-save or rebirth has failed.',
  setup: () => fresh({ hurt: true }),
  play() {
    const { run, enemies } = G();
    stub(run, 'die', () => { run.phase = 'dead'; });
    const shooter = spawn('ants', near(0.3, 0));
    enemies.spit(shooter, run.player.position, { speed: 0.8, life: 1, dmg: 10, shot: 'pin', height: 0 });
    const shot = enemies.shots.at(-1);
    stub(enemies, 'list', []);   // the retained projectile can land after its owner has despawned
    enemies.byId.delete(shooter.id);
    run.health = 1; run.iFrames = 0;
    enemies.shotHits(shot.m.position.clone(), 0.05);
    const retainedShot = run.killedBy?.unit === shooter.type && run.killedBy?.source === 'pin';
    run.phase = 'explore'; run.killedBy = null;
    run.health = 1;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 10, source: 'missile', unit: 'ladybug', drain: true });
    const projectile = run.killedBy?.unit === 'ladybug';
    run.phase = 'boss'; run.health = 1; run.killedBy = null;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 10, source: 'boss', drain: true });
    const boss = run.killedBy?.unit === run.stage.boss.kind;
    run.phase = 'explore'; run.health = 1; run.killedBy = null;
    bus.emit('status_applied', { targetId: PLAYER, status: 'bleed', duration: 2, strength: 10, unit: 'mosquito' });
    run.bleed(0.2);
    const bleed = run.killedBy?.unit === 'mosquito' && run.killedBy?.source === 'bleed';
    run.phase = 'explore'; run.health = 1; run.killedBy = null; run.saved = false;
    const mods = run.mods;
    stub(mods, 'deathSave', { health: 0.5 });
    bus.emit('damage_taken', { targetId: PLAYER, amount: 10, source: 'roach', drain: true });
    const saved = run.phase !== 'dead' && run.health > 0 && run.killedBy === null;
    return ok(retainedShot && projectile && boss && bleed && saved, { retainedShot, projectile, boss, bleed, saved });
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
    const { Leaderboard } = await import('../leaderboard.js');
    const tick = () => new Promise((r) => setTimeout(r, 0));
    try { localStorage.removeItem('jellyrun.best'); } catch {}
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
    const refusedNote = /view-only/i.test(M.note());
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
    try { localStorage.removeItem('jellyrun.name'); } catch {}
    window.claude = fakeClaude({ id: 'u_game' });
    run.board = new Leaderboard();
    await run.board.ready;
    run.kills = 12; run.level = 3; run.t = 60;   // a minute of the night: a score above 0
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
    try { localStorage.removeItem('jellyrun.name'); } catch {}
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
      && !ro.posted && ro.why === 'readonly' && O.status === 'offline' && off.why === 'offline' && shown && posted && firstScore > 0,
      { notYet, remembered, guest, home, listed, fresh, refused, refusedNote, first, lower, higher, order, escaped, ro, off, shown, posted, score: firstScore });
  },
});

// --- the main screen
const leaderboardJellies = {
  about: 'The leaderboard is big and easy to read, and every score has that player\'s own customized jelly by their name (drawn from the look they posted with it): different jellies look different, the same jelly is drawn once, and an old score with no look still gets a jelly.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { Leaderboard } = await import('../leaderboard.js');
    const { run, menus } = G(), realBoard = run.board;
    const fake = fakeClaude({ id: 'u_me' });
    fake.docs.set('scores/u_pink', { score: 30000, name: 'Pinky', look: { body: 'moon', color: '#ff5fa2', accent: '#ffd23a', top: 'crown' } });
    fake.docs.set('scores/u_green', { score: 20000, name: 'Greeny', look: { body: 'lion', color: '#4dff7a', accent: '#1f6b3a' } });
    fake.docs.set('scores/u_old', { score: 10000, name: 'Oldie', body: 'box' });
    for (let i = 0; i < 7; i++) fake.docs.set('scores/u_extra' + i, { ...fake.docs.get('scores/u_pink'), score: 9000 - i, name: 'A long jelly name' });
    window.claude = fake;
    run.board = new Leaderboard();
    run.showBoard(() => menus.close());
    await new Promise((r) => setTimeout(r, 300));
    const board = document.querySelector('.jf-modal .jf-board');
    const imgs = [...(board?.querySelectorAll('img.jf-jelly') || [])], srcs = imgs.map((i) => i.getAttribute('src'));
    const pictures = imgs.length === 10 && srcs.every((s) => s.startsWith('data:image/png')) && new Set(srcs).size === 3;
    const compact = innerHeight <= 520 || innerWidth <= 700;
    const big = imgs[0]?.getBoundingClientRect().width >= (compact ? 56 : 80);
    board.scrollTop = board.scrollHeight;
    const fits = board.scrollWidth <= board.clientWidth && board.querySelector('button').getBoundingClientRect().bottom <= innerHeight;
    const t0 = performance.now(); run.jellyFace(fake.docs.get('scores/u_pink').look); const cached = performance.now() - t0 < 5;
    menus.close();
    delete window.claude;
    run.board = realBoard;
    return ok(pictures && big && fits && cached, { rows: imgs.length, unique: new Set(srcs).size, big, fits, cached });
  },
};
story('engine/leaderboard-shows-each-players-jelly', leaderboardJellies);
phone('leaderboard-shows-each-players-jelly', leaderboardJellies);

story('menu/reduce-effects', {
  about: 'There is no ✨ Effects button (the Graphics row is the one visual setting): Reduce effects follows the device\'s reduced-motion setting. On, a kill still lands its hit-stop but shakes nothing; off, the kill shakes by its step on look.css\'s --feel-* ladder.',
  setup() { fresh({ elites: false }); },
  play() {
    const { enemies } = G(), btn = document.querySelector('#g-over [data-act="effects"]');
    const follows = juice.calm === matchMedia('(prefers-reduced-motion: reduce)').matches;
    const was = juice.calm;
    // a hair tangle: small, so its kill is the plain 'kill' step
    const killOne = (calm) => { juice.calm = calm; juice.reset(); enemies.kill(spawn('hair', near(0.1, 0.1), { still: true })); return { shake: juice.trauma, stop: juice.stop }; };
    let full, calm;
    try { full = killOne(false); calm = killOne(true); } finally { juice.calm = was; juice.reset(); }
    const [kShake, kStop] = LOOK.list('feel-kill', []).map(Number);
    return ok(!btn && follows && Math.abs(full.shake - kShake) < 1e-6 && full.stop === kStop && calm.shake === 0 && calm.stop === kStop,
      { button: !!btn, follows, full, calm, ladder: [kShake, kStop] });
  },
});
story('dev/free-roam-is-quiet', {
  about: 'Dev free roam: the picker offers every act, and a roam in this act has no bugs, no Elites, no damage and a stopped clock, so you can walk the room and look.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run, player } = G();
    const picks = run.roamChoices(), pick = picks.find((p) => p.roam === run.stage.id);
    run.startRoam(pick);
    step(600);
    const before = run.health;
    run.hurt(5);
    step(10);
    return ok(picks.length === 4 && run.dev && run.enemies.alive === 0 && run.elites.alive.length === 0 && run.t === 0 && run.health === before && run.phase === 'explore',
      { acts: picks.length, dev: run.dev, bugs: run.enemies.alive, elites: run.elites.alive.length, t: run.t, health: [before, run.health], phase: run.phase, moved: !!player });
  },
});
story('dev/panel-has-every-tool', {
  about: 'The Dev panel is one sheet in four groups: Play (Fight boss, 1 on 1, Free roam, Act 4 preview), Tune (Test kit, Tuner), Build (Layout) and Check (Diagnostics, and AO, Bloom and Lamps as On/Off switches). Every tool is a tap away and does what it did in the old row: the pickers and tools open, the switches change the drawing, and the last group used is remembered.',
  setup() { fresh({ elites: false }); try { localStorage.removeItem('jellyrun.dev-group'); } catch {} },
  play() {
    const { run } = G(), over = document.querySelector('#g-over'), sheet = over.querySelector('.menu-dev'), $ = (s) => sheet.querySelector(s);
    const tab = (id) => $(`[data-group="${id}"]`), pane = (id) => $(`[data-pane="${id}"]`), visible = (id) => !pane(id).hidden;
    over.classList.add('dev-open'); over.hidden = false;
    over.querySelector('[data-act="dev"]').click();
    const opened = !sheet.hidden;
    const groups = {};
    for (const id of ['play', 'tune', 'build', 'check']) { tab(id).click(); groups[id] = [...pane(id).querySelectorAll('[data-act]')].map((b) => b.dataset.act).join() + (visible(id) ? '' : '!hidden'); }
    const grouped = JSON.stringify(groups) === JSON.stringify({ play: 'boss,duel,roam,arena4', tune: 'kit,tuner', build: 'layout', check: 'diag' });
    const remembered = localStorage.getItem('jellyrun.dev-group') === 'check';
    // the boss and 1 on 1 pickers open and offer their fights
    const pick = (act) => { over.hidden = false; $(`[data-act="${act}"]`).click(); const names = [...document.querySelectorAll('.btns button')].map((b) => b.textContent); const hid = over.hidden; [...document.querySelectorAll('.btns button')].find((b) => b.textContent === 'Back')?.click(); return { names: names.length, hid, back: !over.hidden }; };
    const boss = pick('boss'), duel = pick('duel'), sheetBack = !sheet.hidden;
    // the test kit and the tuner open and bring the pause menu back
    const tools = {};
    for (const t of ['kit', 'tuner']) { over.hidden = false; const w = window[t]; let back; const real = w.show; w.show = (r, o) => { back = o.onBack; }; $(`[data-act="${t}"]`).click(); w.show = real; tools[t] = over.hidden && !!back; back?.(); tools[t] = tools[t] && !over.hidden && !sheet.hidden; }
    // the switches really switch, and read their own state back
    const gfx = window.gfx, ao = (on) => $(`[data-pass="ao"][data-on="${on}"]`);
    const was = !gfx.off.has('ao');
    ao(was ? 'off' : 'on').click();
    const switched = gfx.off.has('ao') === was && ao(was ? 'off' : 'on').getAttribute('aria-pressed') === 'true';
    ao(was ? 'on' : 'off').click();
    const restored = gfx.off.has('ao') === !was;
    over.classList.remove('dev-open'); over.hidden = true;
    return ok(opened && grouped && remembered && boss.names > 1 && boss.hid && boss.back && duel.names > 1 && duel.back && sheetBack && tools.kit && tools.tuner && switched && restored,
      { opened, groups, remembered, boss, duel, tools, switched, restored, run: !!run });
  },
});
story('menu/dev-tools-locked', {
  about: 'The main screen has no Restart button and no Auto graphics; the dev tools wait behind one 🔒 Dev button. The Worker checks the password (it is not in the page): a wrong one keeps them hidden, the right one opens the Dev panel (Fight boss, 1 on 1, Act 4 preview, Test kit, Tuner, Layout, Diagnostics) and makes the run a dev run, which never reaches the leaderboard.',
  setup() { fresh({ elites: false }); try { sessionStorage.removeItem('jellyrun.dev'); } catch {} },
  async play() {
    const over = document.querySelector('#g-over'), shown = (sel) => getComputedStyle(over.querySelector(sel)).display !== 'none';
    const asked = [];
    stub(window, 'fetch', async (url, init) => { asked.push(String(url)); const { pass } = JSON.parse(init.body); return new Response(JSON.stringify({ open: pass === 'sea-secret' })); });
    over.classList.remove('dev-ask', 'dev-open');
    over.hidden = false;
    const restart = !!over.querySelector('[data-act="restart"]'), graphics = [...over.querySelectorAll('[data-q]')].map((b) => b.dataset.q);
    const hiddenAtFirst = !shown('.dev-btn');
    over.querySelector('[data-act="dev"]').click();
    const asks = shown('.dev-lock');
    const box = over.querySelector('[name="dev-pass"]');
    const devBefore = G().run.dev;
    const settle = () => new Promise((ok) => setTimeout(ok, 50));
    box.value = 'chan'; over.querySelector('[data-act="dev-unlock"]').click(); await settle();
    const oldPassFails = over.querySelector('.menu-dev').hidden && !over.classList.contains('dev-open');
    box.value = 'sea-secret'; over.querySelector('[data-act="dev-unlock"]').click(); await settle();
    const tools = [...over.querySelectorAll('.menu-dev [data-act]')].map((b) => b.dataset.act).filter((a) => a !== 'sheet-close');
    const sheetOpened = !over.querySelector('.menu-dev').hidden;
    const devRun = G().run.dev, notInPage = !document.documentElement.outerHTML.includes('sea-secret');
    G().run.start();
    const nextRunDev = G().run.dev;
    over.classList.remove('dev-ask', 'dev-open'); over.hidden = true;
    try { sessionStorage.removeItem('jellyrun.dev'); } catch {}
    G().run.start();
    const afterLock = G().run.dev;
    return ok(!restart && graphics.join() === 'low,medium,high' && hiddenAtFirst && asks && oldPassFails && sheetOpened && tools.join() === 'boss,duel,roam,arena4,kit,tuner,layout,diag'
      && asked.every((u) => u.endsWith('api/dev')) && !devBefore && devRun && nextRunDev && !afterLock && notInPage,
      { restart, graphics, hiddenAtFirst, asks, oldPassFails, tools, sheetOpened, asked, devBefore, devRun, nextRunDev, afterLock });
  },
});

story('dev/layout-editor-acts-and-delete', {
  about: 'The layout editor binds the act it opened in, keeps each act\'s edits in their own slice of the saved layout, and can delete an object picked from its list (recorded as deleted, restorable).',
  setup() { fresh({ elites: false }); },
  async play() {
    const { APT } = G();
    const over = document.querySelector('#g-over');
    over.hidden = false;
    document.querySelector('#g-over [data-act="layout"]').click(); step(30);
    const L = window.layout;
    if (!L) return ok(false, { layout: null });
    // the top bar offers every other apartment act in STAGES, however many there are (an arena act has no furniture)
    const acts = [...L.el.querySelectorAll('[data-a^="act"]')].map((b) => b.dataset.a);
    const wantActs = STAGES.filter((s) => !s.arena).map((s) => s.id).filter((n) => n !== 1).map((n) => 'act' + n).join();
    // every apartment act in STAGES has a baked-layout section, and act 3's slot is ready for it
    const slots = STAGES.filter((s) => !s.arena).every((s) => !!BAKED_LAYOUT[s.id]) && !!BAKED_LAYOUT[3] && typeof loadLayout(3) === 'object';
    // pick an object from the list and delete it: gone, and recorded as deleted
    const it = L.items[0];
    L.ui.listEl.value = it.key; L.ui.listEl.dispatchEvent(new Event('change'));
    const picked = L.sel === it;
    L.deleteSelected();
    const gone = !it.node.visible && it.deleted && L.data[it.key]?.deleted === true;
    // the deletion lives in act 1's slice only — act 2's saved layout is untouched
    const scoped = !!loadLayout(1)[it.key]?.deleted && !(it.key in loadLayout(2));
    // and ⌂ brings it back, clearing the entry
    L.putBack();
    const back = it.node.visible && !it.deleted && !(it.key in L.data);
    // applyLayout honours the act it is given: a crafted act-2 edit moves the object
    await applyLayout(APT.root, 2, { [it.key]: { p: [9, 0, 9], q: [0, 0, 0, 1] } });
    const moved = it.node.position.x === 9;
    it.node.position.fromArray(it.node.userData.home.p); markMoved(it.node);
    try { localStorage.removeItem('jf-layout-v1'); } catch {}
    L.onDone();
    return ok(L.act === 1 && acts.join() === wantActs && slots && picked && gone && scoped && back && moved,
      { act: L.act, acts, slots, picked, gone, scoped, back, moved });
  },
});
story('dev/layout-editor-act-2', {
  act: 2,
  about: 'Opened in act 2, the layout editor binds act 2 and lists the bathroom furniture.',
  setup() { fresh({ elites: false }); },
  play() {
    const over = document.querySelector('#g-over');
    over.hidden = false;
    document.querySelector('#g-over [data-act="layout"]').click(); step(30);
    const L = window.layout;
    if (!L) return ok(false, { layout: null });
    const bath = L.items.some((x) => /Bathtub|Vanity/.test(x.key));
    const acts = [...L.el.querySelectorAll('[data-a^="act"]')].map((b) => b.dataset.a);
    const wantActs = STAGES.filter((s) => !s.arena).map((s) => s.id).filter((n) => n !== 2).map((n) => 'act' + n).join();
    L.onDone();
    return ok(L.act === 2 && bath && acts.join() === wantActs, { act: L.act, bath, acts });
  },
});

story('dev/layout-duplicate-is-solid-and-saved', {
  about: 'Duplicate (Ctrl+D) in the layout editor drops a copy of the selected object 10 cm aside and selects it. The copy blocks the jelly like the room\'s own furniture, is saved and exported as a copy:<key>#n entry, and is made again on a reload, before the collision world. Deleting it removes its entry, and undo puts it back.',
  setup() { fresh({ elites: false }); try { localStorage.removeItem('jf-layout-v1'); } catch {} },
  async play() {
    const { APT, world } = G();
    document.querySelector('#g-over').hidden = false;
    document.querySelector('#g-over [data-act="layout"]').click(); step(30);
    const L = window.layout;
    if (!L) return ok(false, { layout: null });
    const src = L.items.find((x) => x.key === 'Lounge_chair#1');
    L.sel = src;
    dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', ctrlKey: true }));
    dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', ctrlKey: true }));
    const c = L.sel, key = c?.key;
    if (!c || c === src) return ok(false, { duplicated: false });
    const aside = +c.node.position.distanceTo(src.node.position).toFixed(3);
    // rays along the room's x into the copy's side, on a grid over it (it stands 10 cm toward +x, so it's hit before its source)
    const b = visibleBox(c.node, new THREE.Box3()), mid = b.getCenter(new THREE.Vector3()), toward = V(-1, 0, 0);
    const blocks = (w, node) => {
      w._focusAge = Infinity; w.focus(mid, 0, 3);
      for (let i = 1; i < 6; i++) for (let k = 1; k < 6; k++) {
        const from = V(b.max.x + 0.02, b.min.y + (b.max.y - b.min.y) * i / 6, b.min.z + (b.max.z - b.min.z) * k / 6);
        let o = w.cast(from, toward, 1)?.mesh;
        while (o && o !== node) o = o.parent;
        if (o) return true;
      }
      return false;
    };
    const solid = blocks(world, c.node);
    const saved = loadLayout(1)[key];
    L.showIo();
    const io = document.querySelector('#jf-layout-io'), exported = JSON.parse(io.querySelector('textarea').value).edits[key];
    io.remove();
    // delete: its entry goes and it leaves the list; undo: the same one back
    L.deleteSelected();
    const deleted = !(key in loadLayout(1)) && !L.items.includes(c) && !c.node.visible;
    L.undo();
    const undone = !!loadLayout(1)[key] && L.byNode.has(c.node) && c.node.visible;
    // a reload: the room without the copy, then the layout applied as the game boots (before its collision world)
    L.drop(L.byNode.get(c.node));
    try { localStorage.setItem('jf-layout-v1', JSON.stringify({ 1: { [key]: saved } })); } catch {}
    const made = await applyLayout(APT.root, 1), again = made[0];
    const back = made.length === 1 && again.userData.added === key && again.position.toArray().every((v, i) => Math.abs(v - saved.p[i]) < 1e-4);
    const bootSolid = back && blocks(new World(again, { staticScene: true }), again);
    again.removeFromParent();
    try { localStorage.removeItem('jf-layout-v1'); } catch {}
    world._focusAge = Infinity;
    L.onDone();
    const entry = (e) => !!e && e.from === 'Lounge_chair#1' && e.p?.length === 3 && e.q?.length === 4;
    return ok(/^copy:Lounge_chair#1#\d+$/.test(key) && Math.abs(aside - 0.1) < 0.002 && solid && entry(saved) && entry(exported) && deleted && undone && back && bootSolid,
      { key, aside, solid, saved, exported: !!exported, deleted, undone, back, bootSolid });
  },
});

story('dev/layout-baked-copy-prunes-and-deletes', {
  about: 'A copy baked into the layout is made at load like any added thing. A saved edit that matches the bake is pruned, as for the room\'s own furniture, and deleting the copy in the editor records it as deleted (so the bake drops it) instead of removing its entry.',
  setup() { fresh({ elites: false }); try { localStorage.removeItem('jf-layout-v1'); } catch {} },
  async play() {
    const { APT } = G(), key = 'copy:Lounge_chair#1#9', at = { from: 'Lounge_chair#1', p: [0.6, 0, -0.4971], q: [0, 0, 0, 1] };
    BAKED_LAYOUT[1][key] = at;
    let node = null;
    try {
      const data = { [key]: { ...at } }, made = await applyLayout(APT.root, 1, data);
      node = made[0];
      const loaded = made.length === 1 && node.userData.added === key && node.position.x === 0.6, pruned = !(key in data);
      document.querySelector('#g-over').hidden = false;
      document.querySelector('#g-over [data-act="layout"]').click(); step(30);
      const L = window.layout;
      L.place(made);
      L.sel = L.byNode.get(node);
      L.deleteSelected();
      const deleted = loadLayout(1)[key]?.deleted === true && loadLayout(1)[key].from === 'Lounge_chair#1' && !node.visible && L.items.some((x) => x.key === key);
      L.putBack();
      const back = node.visible && !(key in loadLayout(1));
      L.onDone();
      return ok(loaded && pruned && deleted && back, { loaded, pruned, deleted, back });
    } finally {
      delete BAKED_LAYOUT[1][key];
      const it = node && window.layout?.byNode.get(node);
      if (it) window.layout.drop(it); else if (node) { node.visible = false; node.removeFromParent(); }
      try { localStorage.removeItem('jf-layout-v1'); } catch {}
    }
  },
});

story('dev/layout-prop-entry-is-made', {
  about: 'A prop:<id>#n entry in the layout puts that library prop (props.js) in the room at its size: a copy of the template (the same geometry and materials), solid, with no lights. An entry naming a prop the library doesn\'t have is skipped.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { APT } = G(), { loadProps } = await import('../props.js');
    const data = { 'prop:monstera#9': { prop: 'monstera', p: [3.2, 0, 3.3], q: [0, 0, 0, 1], s: 1.5 }, 'prop:nothing#1': { prop: 'nothing', p: [3, 0, 3], q: [0, 0, 0, 1], s: 1 } };
    const made = await applyLayout(APT.root, 1, data), node = made[0];
    try {
      const t = (await loadProps(['monstera'])).monstera, mine = [], theirs = [];
      node?.traverse((o) => { if (o.isMesh) mine.push(o); });
      t.traverse((o) => { if (o.isMesh) theirs.push(o); });
      const shared = mine.length > 0 && mine.length === theirs.length && mine.every((m, i) => m.geometry === theirs[i].geometry && m.material === theirs[i].material);
      let lights = 0; node?.traverse((o) => { if (o.isLight) lights++; });
      // solid: a ray down onto its pot (where it stands) hits it
      const w = node && new World(node, { staticScene: true }), top = node && visibleBox(node, new THREE.Box3());
      if (w) { w._focusAge = Infinity; w.focus(node.position, 0, 3); }
      const hit = w && w.cast(V(node.position.x, top.max.y + 0.05, node.position.z), V(0, -1, 0), top.max.y + 0.1);
      return ok(made.length === 1 && node.userData.added === 'prop:monstera#9' && node.scale.x === 1.5 && shared && !lights && !!hit,
        { made: made.length, scale: node?.scale.x, shared, lights, hit: !!hit });
    } finally {
      for (const n of made) { n.visible = false; n.removeFromParent(); }
    }
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

story('modes/cosmetics-framework', {
  about: 'Earned cosmetics: the look a run submits is the whole descriptor (it survives a JSON round trip through normalizeLook, so a leaderboard row can draw the actual jelly); the golden items are locked in the creator (✨, 🔒, tapping one says what it takes and how far along you are) until the lifetime totals meet them; a run that ends adds its bugs, the run and a win to those totals, and the end screen names what it just unlocked.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run, menus } = G();
    const look = run.playerLook();
    const roundTrip = normalizeLook(JSON.parse(JSON.stringify({ ...look, top: 'goldcrown' })));
    const carried = !!look && roundTrip.body === look.body && roundTrip.top === 'goldcrown' && roundTrip.color === look.color && roundTrip.eyes === look.eyes;
    const zero = { runs: 0, wins: 0, kills: 0, elites: 0 };
    const rules = requirement('top', 'goldcrown')?.wins === 1 && !unlocked('top', 'goldcrown', zero) && unlocked('top', 'goldcrown', { ...zero, wins: 1 })
      && unlocked('top', 'bow', zero) && requirementText(requirement('top', 'laurel'), { kills: 412 }) === 'Earned: clear 1,000 bugs (412 so far)';
    // every golden item builds, in gold
    const GOLD = new THREE.Color('#ffc93a').convertSRGBToLinear().getHexString();   // character.js M.award
    const gold = (l) => { let n = 0; const c = buildCharacter(normalizeLook({ ...DEFAULT_LOOK, ...l }), 0.03); (c.group || c.root || c).traverse((o) => { if (o.isMesh && o.material.color?.getHexString() === GOLD) n++; }); return n; };
    const plain = { top: 'none', eyes: 'big', mouth: 'smile' }, base = gold(plain);
    const built = Object.entries(NEEDS).flatMap(([key, ids]) => Object.keys(ids).map((id) => [`${key}:${id}`, gold({ ...plain, [key]: id }) > base]));
    const allBuilt = built.length >= 6 && built.every(([, b]) => b);
    const saved = localStorage.getItem(FEATS_KEY);
    let creatorOk = false, flushOk = false, endOk = false, info = {};
    try {
      localStorage.setItem(FEATS_KEY, JSON.stringify(zero));
      const over = document.querySelector('#g-over');
      over.hidden = false;
      document.querySelector('#g-over [data-act="creator"]').click(); step(30);
      const crown = document.querySelector('#creator [data-k="top"][data-v="goldcrown"]');
      const bow = document.querySelector('#creator [data-k="top"][data-v="bow"]');
      crown?.click();
      const note = document.querySelector('#creator .need[data-for="top"]')?.textContent || '';
      const wearing = run.playerLook().top;
      creatorOk = !!crown && crown.classList.contains('locked') && crown.querySelectorAll('svg').length === 2   // the star (earned) and the lock
        && /^Golden crown · Earned: win a run$/.test(note.trim()) && wearing !== 'goldcrown' && !!bow && !bow.classList.contains('locked');
      info.note = note;
      dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
      over.hidden = true;
      // bugs cleared during the run count once, however often it's flushed (act change, page hidden, the end)
      run.kills = 7; run.flushFeats(); run.flushFeats();
      flushOk = lifetime().kills === 7;
      run.phase = 'won';
      stub(run, 'board', null);
      run.endRun('🏆 You won!', 'won', 'Play again');
      const end = document.querySelector('.jf-modal')?.innerText || '';
      menus.close();
      const f = lifetime();
      info = { ...info, f, end: end.slice(0, 160) };
      endOk = f.runs === 1 && f.wins === 1 && f.kills === 7 && /Unlocked/.test(end) && /Golden crown/.test(end) && unlocked('top', 'goldcrown');
    } finally { saved === null ? localStorage.removeItem(FEATS_KEY) : localStorage.setItem(FEATS_KEY, saved); }
    return ok(carried && rules && allBuilt && creatorOk && flushOk && endOk, { carried, rules, built: built.filter(([, b]) => !b), creatorOk, flushOk, endOk, ...info });
  },
});

story('modes/try-on-locked-cosmetics', {
  about: 'Trying on: tapping a locked golden award or shop look in the creator shows it on the jelly with what it takes or its price, but the look the game keeps (and saves, and runs with) never changes; picking an owned option, Done or Escape puts the jelly back.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run, player } = G();
    const keep = [FEATS_KEY, PEARLS_KEY, 'jellyrun.look.v2'].map((k) => [k, localStorage.getItem(k)]);
    const GOLD = new THREE.Color('#ffc93a').convertSRGBToLinear().getHexString();   // character.js M.award
    const gold = () => { let n = 0; player.avatar.root.traverse((o) => { if (o.isMesh && o.material.color?.getHexString() === GOLD) n++; }); return n; };
    const saved = () => JSON.parse(localStorage.getItem('jellyrun.look.v2') || 'null')?.top;
    const info = {};
    try {
      localStorage.setItem(FEATS_KEY, JSON.stringify({ runs: 0, wins: 0, kills: 0, elites: 0 }));
      localStorage.setItem(PEARLS_KEY, JSON.stringify({ pearls: 0, bought: [] }));
      const over = document.querySelector('#g-over');
      const open = () => { over.hidden = false; document.querySelector('#g-over [data-act="creator"]').click(); step(2); };
      const chip = (k, v) => document.querySelector(`#creator [data-k="${k}"][data-v="${v}"]`);
      const note = () => document.querySelector('#creator .need[data-for="top"]').textContent;
      const hint = () => document.querySelector('.cr-hint').textContent;
      open();
      chip('top', 'none').click(); step(1);
      const base = gold();
      // an award: worn on the jelly, said what it takes, not the look
      chip('top', 'goldcrown').click(); step(1);
      const award = gold() > base && run.playerLook().top === 'none' && /Earned: win a run/.test(note())
        && chip('top', 'goldcrown').classList.contains('try') && /Trying it on · Golden crown · Earned: win a run/.test(hint());
      // a shop look: a new jelly, its price, still not the look
      const before = player.avatar;
      chip('top', 'lampshade').click(); step(1);
      const shop = player.avatar !== before && gold() === base && run.playerLook().top === 'none' && /300 Pearls/.test(note())
        && !chip('top', 'goldcrown').classList.contains('try') && /Lampshade · 300 Pearls/.test(hint());
      // an owned pick ends it
      chip('top', 'bow').click(); step(1);
      const owned = run.playerLook().top === 'bow' && /Drag to spin/.test(hint());
      // Done while trying on: saves the real look, puts the jelly back
      chip('top', 'goldcrown').click(); step(1);
      document.querySelector('#creator [data-act="done"]').click(); step(1);
      const done = saved() === 'bow' && run.playerLook().top === 'bow' && gold() === base;
      // Escape while trying on: the same
      open(); chip('top', 'goldcrown').click(); step(1);
      dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })); step(1);
      const escaped = saved() === 'bow' && run.playerLook().top === 'bow' && gold() === base && document.querySelector('#creator').hidden;
      over.hidden = true;
      Object.assign(info, { award, shop, owned, done, escaped, base, note: note() });
      return ok(award && shop && owned && done && escaped, info);
    } finally { keep.forEach(([k, v]) => (v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v))); }
  },
});

story('modes/pearls-and-the-shop', {
  about: 'Pearls: every run that ends pays (5, a Pearl per 10 bugs, 3 an Elite, 10 a boss, 25 more the first time ever, 20 for a win), banked as they come, never in a dev run, and the end screen says how many. The creator shows a shop look with its price; tapping it offers Buy only when you have enough; buying spends them and puts it on. New golden awards read the Treasure book, per-Elite and per-species counts and a boss beaten without losing Health; the Gilded finish needs every other one.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run, menus } = G();
    const keep = [FEATS_KEY, PEARLS_KEY, FOUND_KEY].map((k) => [k, localStorage.getItem(k)]);
    const info = {};
    try {
      [FEATS_KEY, PEARLS_KEY, FOUND_KEY].forEach((k) => localStorage.removeItem(k));
      // the earn rate, as the proposal priced it
      const rates = pearlsFor({ kills: 35, ended: true }) === 8 && pearlsFor({ kills: 60, elites: 2, ended: true }) === 17
        && pearlsFor({ kills: 350, elites: 9, bosses: 4, ended: true, won: true }) === 127;
      // a run as it goes: bugs flushed (twice, counted once), an Elite, a boss (a first, untouched), then the end
      run.kills = 23; run.flushFeats(); run.flushFeats();
      const afterBugs = bank().pearls;
      stub(run, 'dropTreasure', () => {});
      run.eliteDefeated({ kind: 'kettle', name: 'The Kettle', base: run.player.position.clone(), r: 0.1, spec: { area: 'stovetop' } });
      const afterElite = bank().pearls, f1 = lifetime();
      run.bossHurt = false;
      stub(run, 'boss', { center: () => V(0, 0, 0) }); stub(run, 'fx', { puff() {} });
      run.onBossDead({ impact: false });
      const afterBoss = bank().pearls, f2 = lifetime();
      run.phase = 'dead';
      stub(run, 'board', null);
      run.endRun('You were popped', 'dead', 'Try again');
      const end = document.querySelector('.jf-modal')?.innerText || '';
      menus.close();
      const earnOk = rates && afterBugs === 2 && afterElite === 5 && f1.elite_kettle === 1 && afterBoss === 5 + 10 + 25 && f2.flawless === 1
        && bank().pearls === 45 && run.pearls === 45 && /Pearls\s*\+45/.test(end);
      Object.assign(info, { earnOk, rates, afterBugs, afterElite, afterBoss, bank: bank().pearls, end: end.slice(0, 200) });
      // a dev run earns nothing
      run.dev = true; run.kills = 500; run.flushFeats({ runs: 1 }); run.earn(50); run.dev = false;
      const devOk = bank().pearls === 45;
      // the creator: a shop look shows its price, says what you have, offers Buy only when you can, and buying wears it
      const over = document.querySelector('#g-over');
      over.hidden = false;
      document.querySelector('#g-over [data-act="creator"]').click(); step(30);
      const chip = (k, v) => document.querySelector(`#creator [data-k="${k}"][data-v="${v}"]`);
      const lamp = chip('top', 'lampshade'), cap = chip('top', 'bottlecap');
      lamp.click();
      const tooDear = !document.querySelector('#creator [data-buy]') && /300 Pearls/.test(document.querySelector('#creator .need[data-for="top"]').textContent);
      localStorage.setItem(PEARLS_KEY, JSON.stringify({ pearls: 70, bought: [] }));
      cap.click();
      const buyBtn = document.querySelector('#creator [data-buy="top"][data-v="bottlecap"]');
      buyBtn?.click(); step(2);
      const bought = bank().pearls === 10 && bank().bought.includes('top:bottlecap') && run.playerLook().top === 'bottlecap'
        && !chip('top', 'bottlecap').classList.contains('locked') && /\b10 Pearls/.test(document.querySelector('#creator .pearls').textContent);
      const shopOk = !!lamp && lamp.classList.contains('locked') && /\b300$/.test(lamp.textContent.trim()) && tooDear && !!buyBtn && bought;
      Object.assign(info, { tooDear, bought, lampText: lamp?.textContent });
      dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
      over.hidden = true;
      // the new awards' rules
      const F = feats();
      const rules = unlocked('top', 'duck', { ...F, boss: ['hair'] }) && !unlocked('top', 'duck', { ...F, boss: ['vacuum'] })
        && unlocked('top', 'crown_moon', { ...F, winAs: ['moon'] }) && !unlocked('top', 'crown_moon', { ...F, winAs: ['box'] })
        && unlocked('eyes', 'goldspecs', { ...F, book: 0.5 }) && !unlocked('eyes', 'goldspecs', { ...F, book: 0.49 })
        && unlocked('top', 'goldkettle', { ...F, elite_kettle: 10 }) && !unlocked('top', 'goldkettle', { ...F, elite_kettle: 9 })
        && unlocked('top', 'tiara', { ...F, flawless: 1 }) && !unlocked('finish', 'gilded', F) && unlocked('finish', 'gilded', { ...F, allGold: true })
        && requirementText(requirement('top', 'duck')) === 'Earned: beat the Clog' && requirementText(requirement('top', 'goldkettle'), { elite_kettle: 3 }) === 'Earned: beat the Kettle 10 times (3 so far)'
        && requirementText(requirement('top', 'crown_lion')) === "Earned: win a run as a Lion's Mane";
      // every shop look and award is a real option, priced or earned, never both, and builds on every species
      const all = Object.entries(PRICES).flatMap(([k, ids]) => Object.keys(ids).map((id) => [k, id])).concat(Object.entries(NEEDS).flatMap(([k, ids]) => Object.keys(ids).map((id) => [k, id])));
      const listed = all.every(([k, id]) => OPTIONS[k].some(([v]) => v === id)) && all.every(([k, id]) => !(PRICES[k]?.[id] && NEEDS[k]?.[id]));
      // (what a look builds: its meshes and their vertices)
      const meshes = (l) => { let n = 0; const c = buildCharacter(normalizeLook({ ...DEFAULT_LOOK, ...l }), 0.03); c.root.traverse((o) => { if (o.isMesh) n += 100000 + o.geometry.attributes.position.count; }); c.update(0.5, { speed: 0, vy: 0, grounded: true }); c.dispose(); return n; };
      const broken = [];
      for (const body of Object.keys(SPECIES)) {
        const plain = { body, top: 'none', eyes: 'big', mouth: 'smile', pattern: 'none', finish: 'glow' }, base = meshes(plain);
        // (a pattern or finish is paint, a body is checked by look/every-species-builds, and an arm or tentacle
        // style reshapes the same parts: look/arm-and-tentacle-styles)
        for (const [k, id] of all) if (!['pattern', 'finish', 'body', 'arms', 'tentacles'].includes(k) && meshes({ ...plain, [k]: id }) === base) broken.push(`${body}:${k}:${id}`);
      }
      Object.assign(info, { rules, listed, broken: broken.slice(0, 6) });
      return ok(earnOk && devOk && shopOk && rules && listed && !broken.length, info);
    } finally { keep.forEach(([k, v]) => (v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v))); }
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
story('engine/no-black-frame-when-the-pixel-ratio-changes', {
  about: 'A frame where the governor changes the pixel ratio is still drawn: the change goes in before the frame is drawn, because resizing the canvas clears it (made after drawing, that frame showed whole black).',
  setup() { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); step(2); },
  play() {
    const { APT, GAME } = G(), r = APT.renderer, gl = r.getContext(), px = new Uint8Array(4);
    const blank = () => { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(gl.drawingBufferWidth >> 1, gl.drawingBufferHeight >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return px[0] + px[1] + px[2] + px[3] === 0; };
    const from = r.getPixelRatio(), to = from === 1 ? 1.25 : 1;
    let asked = 0;
    stub(window.pacing.pacer, 'due', () => true);
    stub(window.pacing.governor, 'sample', () => (asked++ ? null : { scale: to }));
    GAME.frame(performance.now() + 1000);
    const changed = r.getPixelRatio() === to, black = blank();
    r.setPixelRatio(from); G().gfx.resize();
    return ok(asked === 1 && changed && !black, { asked, changed, black, from, to });
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
story('engine/graphics-switch-prepares-shaders', {
  about: 'Only the shaders for the graphics in use are built behind Play. Switching to Low builds the other set behind the menu (Play waits), after which every bug and the evolutions draw without a new shader.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  async play() {
    const { gfx, APT, GAME, batcher } = G(), was = gfx.choice, btn = document.querySelector('#g-over .play');
    try {
      gfx.setQuality('low');
      const waited = btn.disabled;
      await gfx.ready;
      GAME.render(); const before = APT.renderer.info.programs.length;
      Object.keys(TYPES).forEach((t, i) => spawn(t, near(0.2 + 0.03 * i, 0.1)));
      evolve('aegis'); evolve('cinder'); evolve('rebound'); evolve('mirage');
      step(30); batcher.sync(); GAME.render();
      const added = APT.renderer.info.programs.length - before;
      const progs = APT.renderer.info.programs, built = progs.slice(progs.length - Math.max(0, added)).map((p) => p.cacheKey.slice(-40));
      return ok(waited && !btn.disabled && gfx.quality === 'low' && added <= 0, { waited, added, before, tier: gfx.quality, built });
    } finally {
      gfx.setQuality(was);
      await gfx.ready;
    }
  },
});
story('engine/low-draws-plain-materials', {
  about: 'Low graphics draw the apartment with plain diffuse materials (no shine maths per lamp) and its spotlights dark, the room fill lifted for them, and shiny extras (clearcoat, iridescence) off; a lamp glow set on a piece still shows. Back on Medium every piece has its own material again. Both switches build their shaders behind the menu, and play then builds none.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { gfx, APT, GAME, statics, batcher } = G(), was = gfx.choice;
    const pieces = () => { const a = []; APT.root.traverse((o) => { if (o.isMesh) a.push(o); }); return a; };
    const standard = () => pieces().filter((o) => [].concat(o.material).some((m) => m.isMeshStandardMaterial)).length + statics.batches.filter((b) => b.batch.material.isMeshStandardMaterial).length;
    const lights = (k) => { const a = []; APT.scene.traverse((o) => { if (o[k]) a.push(o); }); return a; };
    const shiny = () => { let n = 0; APT.scene.traverse((o) => { for (const m of [].concat(o.material || [])) if (m.isMeshPhysicalMaterial && (m.clearcoat > 0 || m.iridescence > 0)) n++; }); return n; };
    const drawn = async () => { await gfx.ready; batcher.sync(); statics.sync(); const n = APT.renderer.info.programs.length; GAME.render(); GAME.render(); return APT.renderer.info.programs.length - n; };
    try {
      gfx.setQuality('medium'); await gfx.ready;
      const mats = new Map(pieces().map((o) => [o, o.material])), hemi = lights('isHemisphereLight')[0].intensity;
      const medium = { standard: standard(), shiny: shiny(), spots: lights('isSpotLight').filter((l) => l.visible).length };
      gfx.setQuality('low');
      const lowNew = await drawn();
      const lamp = pieces().find((o) => !Array.isArray(o.material) && o.material.isMeshLambertMaterial && mats.get(o).isMeshStandardMaterial);
      const own = mats.get(lamp), glowWas = own.emissiveIntensity;
      own.emissiveIntensity = 3.5;   // what act 4's beat does to a lamp's own material
      const follows = lamp.material.emissiveIntensity === 3.5 && lamp.material.emissive === own.emissive;
      own.emissiveIntensity = glowWas;
      const low = { standard: standard(), shiny: shiny(), spots: lights('isSpotLight').filter((l) => l.visible).length, hemi: lights('isHemisphereLight')[0].intensity / hemi, inBatches: statics.count, follows, built: lowNew };
      gfx.setQuality('medium');
      const backNew = await drawn();
      const restored = pieces().every((o) => o.material === mats.get(o));
      const back = { standard: standard(), shiny: shiny(), spots: lights('isSpotLight').filter((l) => l.visible).length, hemi: lights('isHemisphereLight')[0].intensity / hemi, restored, built: backNew };
      const pass = medium.standard > 100 && medium.spots > 0 && low.standard === 0 && low.shiny === 0 && low.spots === 0 && low.hemi > 1 && low.inBatches > 100 && follows && lowNew === 0
        && restored && back.standard === medium.standard && back.shiny === medium.shiny && back.spots === medium.spots && back.hemi === 1 && backNew === 0;
      return ok(pass, { medium, low, back });
    } finally { gfx.setQuality(was); await gfx.ready; }
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
story('engine/raycast-into-a-hit-record-matches', {
  about: 'world.cast written into a reused hit record (the floor under a bug, the jelly\'s feet, every frame) gives the same hit as one that returns a new object, and a miss leaves the record alone.',
  setup() { fresh({ elites: false }); },
  play() {
    const { world } = G(), out = hitSpot();
    world.focus(V(3.2, 0.05, 3.0), 1); world._focusAge = Infinity; world.focus(V(3.2, 0.05, 3.0), 1);
    let rays = 0, same = 0, reused = 0, hits = 0;
    for (let k = 0; k < 300; k++) {
      const o = V(3.2 + (Math.random() - 0.5) * 0.6, 0.05 + Math.random() * 0.3, 3.0 + (Math.random() - 0.5) * 0.6);
      const d = k % 3 ? V(0, 0, 0).randomDirection() : V(0, -1, 0), far = [0.05, 0.3, 3][k % 3];
      const A = world.cast(o, d, far), B = world.cast(o, d, far, null, false, out);
      rays++;
      if (!A && !B) { same++; continue; }
      hits++;
      if (B === out) reused++;
      if (A && B && Math.abs(A.distance - B.distance) < 1e-9 && A.point.distanceTo(B.point) < 1e-9 && A.normal.distanceTo(B.normal) < 1e-9 && A.mesh === B.mesh) same++;
    }
    return ok(same === rays && reused === hits && hits > 20, { rays, same, hits, reused });
  },
});
story('engine/fight-draw-calls', {
  about: 'A busy fight stays cheap to draw: bugs, bubbles and effects are instanced (batch.js).',
  setup() {
    fresh({ elites: false, types: 'fire' });
    tp(3.2, 0.05, 3.0, 0);
    const { run } = G(), P = G().player.position;
    run.owned.add('fairyLights');
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
  about: 'Act 1 loads the living room and the hallway you can see (but not enter) from it; act 2 (bathroom, closets) loads on demand, solid and in place. A saved copy of a piece in the arriving rooms is made with them, solid and drawn.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { APT, world, GAME, statics } = G();
    try { localStorage.setItem('jf-layout-v1', JSON.stringify({ 1: { 'copy:Toilet#1#1': { from: 'Toilet#1' } } })); } catch {}
    const has = (n) => !!APT.root.getObjectByName(n);
    const lights = () => { let n = 0; APT.scene.traverse((o) => { if (o.isPointLight || o.isSpotLight) n++; }); return n; };
    const before = { act1Only: [...APT.loaded].join() === 'act1', sofa: has('Corduroy_sofa'), hallLights: has('Hall_lights'), washer: has('Washer'), toilet: has('Toilet'), lights: lights(), colliders: world.colliders.length };
    const t0 = performance.now();
    const added = await GAME.loadRooms(['act2']);
    const ms = Math.round(performance.now() - t0);
    // the vanity top is solid where the bathroom's vent throws you
    world._focusAge = Infinity; world.focus(new THREE.Vector3(1.5, 1, 5.52), 0);   // collision checks what's near; look in the bathroom
    const hit = world.cast(new THREE.Vector3(1.5, 1.3, 5.52), new THREE.Vector3(0, -1, 0), 1);
    const { movables, addedThings } = await import('../layout.js'), keys = movables(APT.root).map((m) => m.key);
    const copy = addedThings(APT.root).find((t) => t.key === 'copy:Toilet#1#1')?.node, pieces = [];
    copy?.traverse((o) => { if (o.isMesh) pieces.push(o); });
    const batched = new Set(statics.batches.flatMap((b) => b.pieces.map((p) => p.mesh)));
    const copied = !!copy && pieces.length > 0 && pieces.every((m) => world.colliders.includes(m) && (batched.has(m) || m.layers.test(APT.camera.layers)));
    try { localStorage.removeItem('jf-layout-v1'); } catch {}
    if (copy) { copy.visible = false; copy.removeFromParent(); }
    const after = { loaded: [...APT.loaded].join(), toilet: has('Toilet'), added: added.length, lights: lights(), colliders: world.colliders.length, vanityTop: hit ? +hit.point.y.toFixed(3) : null, toiletKey: keys.includes('Toilet#1'), copied, ms };
    const good = before.act1Only && before.sofa && before.hallLights && !before.washer && !before.toilet && after.toilet && after.added > 15 && after.lights >= before.lights && after.colliders > before.colliders && hit && Math.abs(hit.point.y - 0.88) < 0.03 && after.toiletKey && copied;
    return ok(good, { before, after });
  },
});


const changeNameStory = {
  about: 'A player can rename an existing leaderboard entry without a new run; taken names show an error, successful changes keep the score and are remembered.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { Leaderboard } = await import('../leaderboard.js');
    const { run } = G(), realBoard = run.board, realFetch = window.fetch, realClaude = window.claude;
    const oldName = localStorage.getItem('jellyrun.name');
    let mine = { name: 'Old Jelly', score: 1200, at: 10, body: 'moon' };
    const modal = () => document.querySelector('.jf-modal');
    const press = text => [...modal().querySelectorAll('button')].find(b => b.textContent.includes(text))?.click();
    const tick = () => new Promise(resolve => setTimeout(resolve, 30));
    try {
      delete window.claude;
      window.fetch = async (url, options) => {
        if (String(url) === 'api/name') {
          const { name } = JSON.parse(options.body);
          if (name === 'Taken') return Response.json({ renamed: false, why: 'taken' }, { status: 409 });
          mine = { ...mine, name };
          return Response.json({ renamed: true, name });
        }
        return Response.json({ top: [{ ...mine, id: run.board?.id }], mine });
      };
      const board = run.board = new Leaderboard(); await board.ready;
      run.t = run.duration; run.endRun('Finished', '', 'Again');   // the whole night: a score above the board's 1,200
      press('Leaderboard'); await tick();
      press('Change name');
      modal().querySelector('input[name="player"]').value = 'Taken'; press('Save name'); await tick();
      const refused = /already in use/.test(modal().textContent) && board.mine.name === 'Old Jelly';
      modal().querySelector('input[name="player"]').value = 'New Jelly'; press('Save name'); await tick();
      const renamed = board.mine.name === 'New Jelly' && board.mine.score === 1200 && board.mine.at === 10
        && localStorage.getItem('jellyrun.name') === 'New Jelly' && /New Jelly/.test(modal().textContent);
      press('Back'); await tick();
      const remembered = modal().querySelector('input[name="player"]')?.value === 'New Jelly';
      press('Leaderboard'); await tick(); press('Change name'); press('Cancel'); await tick();
      return ok(refused && renamed && remembered && /Leaderboard/.test(modal().textContent), { refused, renamed, remembered });
    } finally {
      run.board.onChange = null; run.endView = null; run.board = realBoard;
      window.fetch = realFetch;
      if (realClaude === undefined) delete window.claude; else window.claude = realClaude;
      if (oldName === null) localStorage.removeItem('jellyrun.name'); else localStorage.setItem('jellyrun.name', oldName);
    }
  },
};
story('engine/leaderboard-change-name', changeNameStory);
story('phone/leaderboard-change-name', { ...changeNameStory, phone: true });

for (const phone of [false, true]) story((phone ? 'phone/' : 'modes/') + 'cosmetic-purchase-visible', {
  phone,
  about: 'A selected cosmetic keeps its price and Buy button above the footer at every scroll position; changing the preview replaces the offer and choosing an owned look clears it.',
  setup() { fresh({ elites: false }); },
  play() {
    const saved = localStorage.getItem(PEARLS_KEY);
    const over = document.querySelector('#g-over');
    try {
      localStorage.setItem(PEARLS_KEY, JSON.stringify({ pearls: 70, bought: [] }));
      over.hidden = false;
      document.querySelector('#g-over [data-act="creator"]').click(); step(2);
      const panel = document.querySelector('#creator'), scroll = panel.querySelector('.scroll');
      const chip = (v) => panel.querySelector('[data-k="top"][data-v="' + v + '"]');
      chip('bottlecap').click();
      const note = panel.querySelector('.need'), button = note.querySelector('[data-buy]');
      const visible = () => {
        const r = button.getBoundingClientRect(), p = panel.getBoundingClientRect(), f = panel.querySelector('footer').getBoundingClientRect();
        return r.top >= p.top && r.bottom <= f.top && r.left >= p.left && r.right <= p.right && r.bottom <= innerHeight;
      };
      scroll.scrollTop = 0;
      const atTop = visible(), top = button.getBoundingClientRect().top;
      scroll.scrollTop = scroll.scrollHeight;
      const atBottom = visible() && button.getBoundingClientRect().top === top && !scroll.contains(button);
      chip('lampshade').click();
      const replaced = !note.querySelector('[data-buy]') && /Lampshade.*300 Pearls/.test(note.textContent);
      chip('none').click();
      const cleared = note.textContent === '';
      return ok(atTop && atBottom && replaced && cleared, { atTop, atBottom, replaced, cleared });
    } finally {
      dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
      over.hidden = true;
      saved === null ? localStorage.removeItem(PEARLS_KEY) : localStorage.setItem(PEARLS_KEY, saved);
    }
  },
});
story('engine/bloom-glows-without-black-squares', {
  about: 'On Medium a bright light glows past its edge (the half-resolution bloom), and a broken pixel the scene draws (NaN) stays where it is instead of smearing black squares over the glow. The dev switches turn AO and bloom off and back on.',
  setup() { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0.8); step(2); },
  async play() {
    const { gfx, APT } = G(), { scene, camera } = APT, gl = APT.renderer.getContext(), was = gfx.choice;
    const quad = (color, x) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.001, 0.001), new THREE.MeshBasicMaterial({ color }));
      camera.updateMatrixWorld();
      m.position.set(x, 0, -0.1).applyMatrix4(camera.matrixWorld);
      m.quaternion.copy(camera.quaternion);
      scene.add(m);
      return m;
    };
    const px = new Uint8Array(4);
    const at = (m, dx) => {   // the screen's brightness dx pixels right of a quad's centre
      const p = m.position.clone().project(camera);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(Math.round((p.x + 1) / 2 * gl.drawingBufferWidth) + dx, Math.round((p.y + 1) / 2 * gl.drawingBufferHeight), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px[0] + px[1] + px[2];
    };
    gfx.setQuality('medium'); await gfx.ready;
    const bright = quad(new THREE.Color(40, 40, 40), -0.012), broken = quad(new THREE.Color(NaN, NaN, NaN), 0.012);
    const draw = () => { G().batcher.sync(); gfx.render(); };
    try {
      draw();
      const glow = at(bright, 14), nearBroken = at(broken, 12);
      const aoOff = !gfx.toggle('ao') && gfx.composer.passes[0].isRenderPass;
      const bloomOff = !gfx.toggle('bloom'); draw();
      const dark = at(bright, 14);
      const back = gfx.toggle('ao') && gfx.toggle('bloom') && !gfx.off.size && gfx.bloom.enabled;
      return ok(glow > dark + 6 && nearBroken > 30 && aoOff && bloomOff && back, { glow, dark, nearBroken, aoOff, bloomOff, back });
    } finally {
      scene.remove(bright, broken);
      gfx.setQuality(was); await gfx.ready;
    }
  },
});
story('engine/floor-grain-has-valid-normals', {
  about: 'The shared floor-grain texture contains varied upward-facing normals, including rows of the stretched noise grid.',
  setup() {},
  play() {
    const mesh = G().world.colliders.find((m) => m.material.normalMap?.isDataTexture
      && m.material.normalScale?.x === LOOK.num('surface-grain', 0.22));
    const data = mesh?.material.normalMap.image.data;
    if (!data) return ok(false, { found: false });
    let invalid = 0, tilted = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 2] < 128 || data[i + 3] !== 255) invalid++;
      if (Math.abs(data[i] - 127) > 2 || Math.abs(data[i + 1] - 127) > 2) tilted++;
    }
    return ok(invalid === 0 && tilted > data.length / 16, { invalid, tilted, texels: data.length / 4 });
  },
});
story('engine/baked-ao-is-current', {
  about: 'Every act\'s baked corner shadows were baked from the apartment files and furniture layout it plays with now. Moved furniture or a re-exported apartment fails this until node tools/bake-ao.mjs bakes them again.',
  setup() {},
  async play() {
    const stale = [];
    for (const s of STAGES.filter((s) => s.parts.length)) {
      const meta = await fetch(`assets/ao-${s.id}.json`).then((r) => (r.ok ? r.json() : null));
      const now = await fingerprint(s.parts, BAKED_LAYOUT[s.id]);
      if (!meta || JSON.stringify(meta.made) !== JSON.stringify(now) || meta.parts.join() !== s.parts.join()) stale.push(s.id);
    }
    return ok(!stale.length, { stale });
  },
});
story('engine/furniture-edges-are-chamfered', {
  about: 'The boxes furniture is built from have a small chamfer (tools/apartment-source.html chamferBoxes): thin 45° strips between faces whose corners keep their faces\' normals, so light rolls round the edge. The kitchen and the media console each show many; the walls, floors and ceilings show none.',
  setup() {},
  async play() {
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    const axis = (v) => Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) > 0.999;
    const strips = (root, keep, named = new Set()) => {
      let count = 0;
      root.traverse((o) => {
        if (!o.isMesh || !keep(o)) return;
        const before = count;
        const g = o.geometry, p = g.attributes.position, nm = g.attributes.normal, ix = g.index;
        if (!nm) return;
        for (let t = 0; t < (ix ? ix.count : p.count); t += 3) {
          const k = [0, 1, 2].map((j) => (ix ? ix.getX(t + j) : t + j));
          a.fromBufferAttribute(p, k[0]); b.fromBufferAttribute(p, k[1]); c.fromBufferAttribute(p, k[2]);
          n.subVectors(b, a).cross(c.sub(a)).normalize();
          const m = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)].sort((x, y) => y - x);
          if (Math.abs(m[0] - Math.SQRT1_2) < 0.02 && Math.abs(m[1] - Math.SQRT1_2) < 0.02 && k.every((i) => axis(a.fromBufferAttribute(nm, i)))) count++;
        }
        if (count > before) { let q = o; while (q && !q.name) q = q.parent; named.add(q?.name || ''); }
      });
      return count;
    };
    const piece = (name) => { let f = null; window.APT.root.traverse((o) => { if (!f && o.name === name) f = o; }); return f; };
    const kitchen = strips(piece('Kitchen'), () => true), console_ = strips(piece('Media_console'), () => true);
    // the built-in kitchen and the door leaves are furniture the game treats as walls; the walls themselves stay sharp
    const shell = new Set();
    strips(window.APT.root, (o) => o.userData.structural, shell);
    const walls = [...shell].filter((nm) => !/^(Kitchen|.*door)(_\d+)?$/.test(nm));
    return ok(kitchen > 40 && console_ > 20 && !walls.length, { kitchen, console: console_, walls });
  },
});
story('engine/baked-light-is-current', {
  about: 'Every act\'s baked light (Blender, baked-light.js) was baked from the apartment files, furniture layout, lamps and light list (bake-lights.js) it plays with now. Moved furniture, a changed lamp or a changed light list fails this until node tools/bake-light.mjs bakes again.',
  setup() {},
  async play() {
    const stale = [];
    for (const s of STAGES.filter((s) => s.parts.length)) {
      const meta = await fetch(`assets/light-${s.id}.json`).then((r) => (r.ok ? r.json() : null));
      const now = await bakeFingerprint(s.id, s.parts, BAKED_LAYOUT[s.id]);
      if (!meta || JSON.stringify(meta.made) !== JSON.stringify(now) || meta.parts.join() !== s.parts.join()) stale.push(s.id);
    }
    return ok(!stale.length, { stale });
  },
});
story('engine/bugs-cast-soft-shadows', {
  about: 'Every bug standing on something gets a soft round shadow under it (systems.js ShadowSystem), all of them in one instanced draw, sized to the bug; a bug thrown into the air has none until it lands. The jelly\'s own shadow is the same soft picture.',
  setup() { fresh({ elites: false, lash: false, bubbles: false }); tp(2.6, 0.05, 2.6, 0.8); },
  async play() {
    const bugs = [0, 1, 2].map((i) => spawn('ants', near(0.2 + i * 0.06, 0.12), { still: true }));
    step(30);
    const S = G().shadows, grounded = bugs.filter((e) => e.grounded).length, on = S.bugs.count;
    bugs[0].grounded = false; bugs[0].vy = 2; S.update(0);
    const thrown = S.bugs.count;
    return ok(grounded === 3 && on === 3 && thrown === 2 && S.bugs.isInstancedMesh && !!S.blob.material.alphaMap, { grounded, on, thrown });
  },
});
// how many pixels differ between two renders of the same frame, one after `change` (stories below)
function changedPixels(change, undo) {
  const { APT, gfx } = G(), gl = APT.renderer.getContext();
  const shot = () => { G().batcher.sync(); gfx.render(); const a = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
  const A = shot(); change(); const B = shot(); undo();
  let n = 0;
  for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 6) n++;
  return n;
}
story('engine/bugs-and-jelly-take-the-baked-light', {
  about: 'The jelly and the bugs take a little of the baked light where they stand (baked-light.js tintShader, --baked-tint): every lit material of the jelly and the bugs reads the furniture\'s light grid, so turning the tint up changes how they are drawn, and it is a number, not a new shader.',
  setup() { fresh({ elites: false, lash: false, bubbles: false }); tp(2.6, 0.05, 2.6, 0.8); },
  async play() {
    for (let i = 0; i < 4; i++) spawn('roach', near(0.2 + i * 0.06, 0.12), { still: true });
    step(10);
    const U = BAKED_LIGHT.uniforms.lbTint, was = U.value, lit = [];
    G().player.avatar.root.traverse((o) => { if (o.isMesh) [].concat(o.material).forEach((m) => { if (m.isMeshStandardMaterial) lit.push(!!m.userData.tinted); }); });
    G().batcher.sync(); G().gfx.render();   // (the new bugs' first draw builds their shaders)
    const programs = G().APT.renderer.info.programs.length;
    const changed = changedPixels(() => { U.value = 20; }, () => { U.value = was; });
    const built = G().APT.renderer.info.programs.length - programs;
    return ok(was > 0 && lit.length > 0 && lit.every(Boolean) && changed > 50 && built === 0, { tint: was, jellyLit: lit.length, changed, built });
  },
});
story('engine/lamps-glow-in-the-air', {
  about: 'Every lamp has a soft glow round its bulb in its own colour, as bright as the lamp is (air-light.js), all of them one draw; the dev panel\'s lamps switch puts them out with the lamps. Act 1 has no dust in the air (only act 3\'s moonlight and act 4\'s sun do).',
  setup() { fresh({ elites: false, lash: false, bubbles: false }); step(2); },
  async play() {
    const air = G().air, { APT, GAME } = G(), tint = air.halos.geometry.attributes.tint;
    const lit = () => { let n = 0; for (let i = 0; i < air.lamps.length; i++) if (tint.getX(i) + tint.getY(i) + tint.getZ(i) > 0) n++; return n; };
    const lamps = air.lamps.length, on = lit();
    GAME.toggleLamps(); air.update(0, APT.renderer, APT.camera);
    const off = lit();
    GAME.toggleLamps(); air.update(0, APT.renderer, APT.camera);
    return ok(lamps > 5 && on === lamps && off === 0 && lit() === lamps && air.halos.isPoints && !air.motes, { lamps, on, off, motes: !!air.motes });
  },
});
story('engine/baked-light-maps-the-big-pieces', {
  about: 'The big pieces of furniture (piece-light.js: the kitchen, the sofa, the cabinets) each read their own light map from the bake, and every one the bake mapped still matches its piece (another triangle count would leave it on the light grid). The maps cost no draws: everything of the same material carries a light map attribute, so the furniture batches still join them.',
  setup() { fresh({ elites: false, lash: false, bubbles: false }); step(2); },
  async play() {
    const want = BAKED_LIGHT.meta?.pieces?.length || 0;
    let without = 0;
    APT.root.traverse((o) => { if (o.isMesh && !o.geometry.attributes.lightUv) without++; });
    return ok(want > 20 && APT.lightMapped === want && without === 0, { want, mapped: APT.lightMapped, without });
  },
});
story('engine/baked-light-lights-the-shell', {
  about: 'The floor shows Blender\'s baked light in place of its lamps\' diffuse: switching every lamp off barely changes it, while with the bake switched off (the dev panel\'s Baked light) the same floor darkens a lot. The jelly\'s glow stays live on the baked floor, on Medium and on Low (whose plain materials skip the lamp maths there). Switching the bake builds no shader (it is a number, not a new program).',
  setup() { fresh({ elites: false, lash: false, bubbles: false }); tp(2.6, 0.05, 2.6, 0.8); step(3); },
  async play() {
    const { gfx, APT, GAME } = G(), { camera } = APT, gl = APT.renderer.getContext(), was = gfx.choice, px = new Uint8Array(4);
    if (!BAKED_LIGHT.meta) return ok(false, { baked: false });
    const glow = (() => { let g = null; APT.scene.traverse((o) => { if (o.isPointLight && !o.userData.lamp && !o.userData.slot) g = o; }); return g; })();
    const P = G().player.position, right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
    const spot = (d) => P.clone().addScaledVector(right, d).setY(0.001);
    const at = (p) => {   // the screen's brightness at a floor point (a 3x3 average)
      G().batcher.sync(); gfx.render();
      const s = p.clone().project(camera), x = Math.round((s.x + 1) / 2 * gl.drawingBufferWidth), y = Math.round((s.y + 1) / 2 * gl.drawingBufferHeight);
      let sum = 0;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { gl.readPixels(x + i, y + j, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); sum += px[0] + px[1] + px[2]; }
      return sum / 9;
    };
    const far = spot(0.5), close = spot(0.07);
    const lamps = () => { const on = GAME.toggleLamps(); return on; };
    const measure = async (tier) => {
      gfx.setQuality(tier); await gfx.ready;
      setBakedLight(false); at(far); setBakedLight(true); at(far);
      const programs = APT.renderer.info.programs.length;
      setBakedLight(false); at(far); setBakedLight(true); at(far);
      const built = APT.renderer.info.programs.length - programs;   // (switching lamps or the glow off changes the light count, which does build: measured before that)
      const baked = at(far); lamps(); const bakedDark = at(far); lamps();
      const withGlow = at(close); glow.visible = false; const noGlow = at(close); glow.visible = true;
      setBakedLight(false);
      const live = at(far); lamps(); const liveDark = at(far); lamps();
      setBakedLight(true);
      return { baked, bakedDark, live, liveDark, withGlow, noGlow, built };
    };
    try {
      const medium = await measure('medium'), low = await measure('low');
      const good = (m) => m.bakedDark > m.baked * 0.8 && m.liveDark < m.live * 0.6 && m.withGlow > m.noGlow + 3 && m.built === 0;
      return ok(good(medium) && good(low), { medium, low });
    } finally { setBakedLight(true); glow.visible = true; gfx.setQuality(was); await gfx.ready; }
  },
});
story('engine/baked-light-lights-the-furniture', {
  about: 'Furniture reads the light grid Blender baked through the rooms (the light from 6 directions at points every 10 cm): with the bake on, switching every lamp off barely changes a piece of furniture; with the bake off (the dev panel\'s Baked light) the same piece darkens a lot. --baked-light-furniture 0 hands it back to the live lamps.',
  setup() { fresh({ elites: false, lash: false, bubbles: false }); tp(3.2, 0.05, 3.6, Math.PI * 0.85); step(3); },
  async play() {
    const { gfx, APT, GAME, tpc } = G(), { camera } = APT, gl = APT.renderer.getContext(), px = new Uint8Array(4);
    if (!BAKED_LIGHT.meta?.grid) return ok(false, { grid: false });
    tpc.pitch = 0.42; tpc.distance = 1.1; step(2);
    // a pixel that shows a solid, lit piece of furniture: rays from the camera across the screen
    const ray = new THREE.Raycaster(), solids = [];
    ray.layers.enableAll();
    APT.root.traverse((o) => { if (o.isMesh && !o.isBatchedMesh && !o.userData.structural && !o.material.transparent && o.visible) solids.push(o); });
    let spot = null;
    for (let y = -0.3; y <= 0.5 && !spot; y += 0.1) for (let x = -0.6; x <= 0.6 && !spot; x += 0.1) {
      ray.setFromCamera(new THREE.Vector2(x, y), camera);
      const hit = ray.intersectObjects(solids, false)[0], all = ray.intersectObject(APT.root, true).find((h) => !h.object.material.transparent);
      if (hit && all && all.object === hit.object && hit.distance < 2.5 && hit.face.normal.y > 0.5) spot = new THREE.Vector2(x, y);
    }
    if (!spot) return ok(false, { spot: false });
    const at = () => {
      G().batcher.sync(); gfx.render();
      const x = Math.round((spot.x + 1) / 2 * gl.drawingBufferWidth), y = Math.round((spot.y + 1) / 2 * gl.drawingBufferHeight);
      let sum = 0;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { gl.readPixels(x + i, y + j, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); sum += px[0] + px[1] + px[2]; }
      return sum / 9;
    };
    try {
      setBakedLight(true);
      const baked = at(); GAME.toggleLamps(); const bakedDark = at(); GAME.toggleLamps();
      setBakedLight(false);
      const live = at(); GAME.toggleLamps(); const liveDark = at(); GAME.toggleLamps();
      return ok(bakedDark > baked * 0.8 && liveDark < live * 0.75 && baked > 20, { spot: spot.toArray(), baked, bakedDark, live, liveDark });
    } finally { setBakedLight(true); }
  },
});
story('engine/baked-ao-shades-corners', {
  about: 'Low and Medium draw the baked corner shadows instead of N8AO (one scene render a frame, not two): where a cabinet meets the floor reads darker than open floor. High keeps N8AO and turns the baked ones off, so corners don\'t darken twice.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { gfx } = G(), u = BAKED_AO.uniforms, tex = u.aoVolume.value, was = gfx.choice;
    if (!tex) return ok(false, { baked: false });
    const [W, H] = tex.image.width ? [tex.image.width, tex.image.height] : [0, 0], d = tex.image.data;
    const open = (x, y, z) => {   // the baked openness nearest a point
      const g = [x, y, z].map((v, k) => Math.round((v - u.aoMin.value.getComponent(k)) / u.aoSize.value.getComponent(k) * tex.image[['width', 'height', 'depth'][k]] - 0.5));
      return d[g[0] + W * (g[1] + H * g[2])] / 255;
    };
    let corner = 1;   // the darkest floor along a line to the living room's east wall, past the media console
    for (let x = 4.0; x < 4.98; x += 0.04) corner = Math.min(corner, open(x, 0.02, 1.5));
    const floor = open(2.6, 0.02, 2.6);   // open floor
    try {
      gfx.setQuality('medium'); await gfx.ready;
      const medium = { ao: !gfx.composer.passes[0].isRenderPass, strength: u.aoStrength.value };   // N8AO, or a plain scene render
      gfx.setQuality('low'); await gfx.ready;
      const low = u.aoStrength.value;
      gfx.setQuality('high'); await gfx.ready;
      const high = { ao: !gfx.composer.passes[0].isRenderPass, strength: u.aoStrength.value };
      return ok(corner < floor * 0.8 && !medium.ao && medium.strength > 0 && low > 0 && high.ao && high.strength === 0, { corner, floor, medium, low, high });
    } finally { gfx.setQuality(was); await gfx.ready; }
  },
});
story('engine/furniture-drawn-in-batches', {
  about: 'Furniture that shares a material is drawn in one batch (far fewer draws), and each piece still acts on its own: one the camera fades leaves the batch and is drawn see-through by itself, then goes back; one that moves (a door swinging) moves in the batch; a hidden one is hidden there too.',
  setup() { fresh({ elites: false }); tp(3.2, 0.05, 3.0, 0.8); step(2); },
  play() {
    const { statics, tpc } = G(), b = statics.batches.find((x) => x.pieces.length > 2 && x.pieces.some((q) => !q.mesh.userData.structural)), p = b.pieces.find((q) => !q.mesh.userData.structural), o = p.mesh;   // (a wall never fades: it is structural)
    const visibleAt = () => b.batch.getVisibleAt(p.id) || (p.inBatch && !p.inView);   // (in the batch, though maybe culled out of view)
    const pieces = statics.count, start = visibleAt() && o.layers.mask !== 1;
    tpc.startFade(o); statics.sync();
    const faded = !visibleAt() && o.layers.mask === 1;
    tpc.unfade(o, tpc._fades.get(o)); statics.sync();
    const back = visibleAt() && o.layers.mask !== 1;
    const m = new THREE.Matrix4(), was = o.position.clone();
    o.position.x += 0.1; markMoved(o); statics.sync(); b.batch.getMatrixAt(p.id, m);
    const moved = Math.abs(m.elements[12] - o.matrixWorld.elements[12]) < 1e-6;
    o.position.copy(was); markMoved(o);
    o.visible = false; statics.sync();
    const hidden = !visibleAt();
    o.visible = true; statics.sync();
    return ok(pieces > 300 && start && faded && back && moved && hidden && visibleAt(), { pieces, batches: statics.batches.length, start, faded, back, moved, hidden });
  },
});

story('engine/still-furniture-skips-matrix-updates', {
  about: "The apartment holds still, so a frame's matrix update skips its 2,000-odd pieces; a door that swings (markMoved) still moves, solid and in its batch, and every piece's stored matrices match where it stands.",
  setup() { fresh({ elites: false }); tp(3.2, 0.05, 3.0, 0.8); step(2); },
  play() {
    const { APT, statics } = G(), scene = APT.scene;
    let pieces = 0, visited = 0, inApt = 0;
    APT.root.traverse(() => pieces++);
    const own = THREE.Object3D.prototype.updateMatrixWorld, under = (o) => { for (; o; o = o.parent) if (o === APT.root) return true; return false; };   // (the apartment's root has its own, which stops there)
    THREE.Object3D.prototype.updateMatrixWorld = function (f) { visited++; if (under(this)) inApt++; return own.call(this, f); };
    try { scene.updateMatrixWorld(); } finally { THREE.Object3D.prototype.updateMatrixWorld = own; }
    const door = Object.values(APT.doors)[0], node = door.node, before = node.matrixWorld.clone();
    door.set(door.open); statics.sync();
    const swung = !node.matrixWorld.equals(before);
    const p = statics.batches.flatMap((b) => b.pieces.map((q) => ({ b, q }))).find(({ q }) => { for (let x = q.mesh; x; x = x.parent) if (x === node) return q.inBatch; return false; });
    const m = new THREE.Matrix4();   // (a closed door's batch copy has to swing with it)
    p?.b.batch.getMatrixAt(p.q.id, m);
    const batchFollows = !p || m.elements.every((v, i) => Math.abs(v - p.q.mesh.matrixWorld.elements[i]) < 1e-5);   // (the batch keeps 32-bit floats)
    door.set(0); statics.sync();
    return ok(pieces > 1000 && inApt === 0 && swung && batchFollows, { pieces, visited, inApt, door: node.name, swung, batched: !!p, batchFollows });
  },
});

// The furniture batches (static-batch.js) work out what's in view only when the camera has moved or
// turned enough: three would cull and upload each batch's draw list every frame.
const tinyTarget = {};
const frame = () => {   // a step, then the scene drawn once into a tiny target: the pass the batches' lists serve (the composer's would be slow on desktop High)
  const { GAME, APT, batcher, statics } = G(), R = APT.renderer, was = R.getRenderTarget();
  GAME.step(1 / 60); batcher.sync(); statics.sync();
  tinyTarget.t ||= new THREE.WebGLRenderTarget(4, 4);
  try { R.setRenderTarget(tinyTarget.t); R.render(APT.scene, APT.camera); } finally { R.setRenderTarget(was); }
};
const listVersions = () => G().statics.batches.map((b) => b.batch._indirectTexture.version);
story('engine/batches-cull-off-the-frame-clock', {
  about: "While the camera holds still the furniture batches reuse their draw lists: no batch uploads one in 60 frames, and no batch sorts. A turn past the threshold culls again, and pieces behind the camera are left out.",
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0.8); step(30); frame(); frame(); },
  play() {
    const { statics, tpc, APT } = G(), gl = APT.renderer.getContext();
    const before = listVersions(), culls = statics.culls;
    let uploads = 0, sorting = 0;
    const real = gl.texSubImage2D;
    gl.texSubImage2D = function (...a) { uploads++; return real.apply(this, a); };
    const still = tpc.yaw;
    try { for (let i = 0; i < 60; i++) { tpc.yaw = still; frame(); sorting += statics.batches.filter((b) => b.batch.sortObjects).length; } } finally { gl.texSubImage2D = real; }
    const after = listVersions(), changed = after.filter((v, i) => v !== before[i]).length, stillCulls = statics.culls - culls;
    const outOfView = statics.batches.reduce((n, b) => n + b.pieces.filter((p) => p.inBatch && !p.inView).length, 0);
    tpc.yaw = still + Math.PI; frame();   // turn round: past the threshold, so the lists change
    const turned = listVersions().filter((v, i) => v !== after[i]).length, turnCulls = statics.culls - culls - stillCulls;
    tpc.yaw = still; frame();
    const opaqueSort = statics.batches.filter((b) => !b.batch.material.transparent && b.batch.sortObjects).length;
    return ok(statics.batches.length > 20 && changed === 0 && stillCulls === 0 && sorting === 0 && outOfView > 0 && turned > 0 && turnCulls === 1 && opaqueSort === 0,
      { batches: statics.batches.length, changed, stillCulls, sorting, uploads, outOfView, turned, turnCulls, opaqueSort });
  },
});

// every frame, each batched piece whose bounds touch the camera's true view is in its batch's draw list
function missingInView() {
  const { statics, APT } = G(), cam = APT.camera, f = new THREE.Frustum(), s = new THREE.Sphere();
  f.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse), cam.coordinateSystem, cam.reversedDepth);
  const miss = [];
  for (const { batch, pieces } of statics.batches) {
    const list = new Set(batch._indirectTexture.image.data.subarray(0, batch._multiDrawCount));
    for (const p of pieces) {
      if (!p.inBatch) continue;
      batch.getBoundingSphereAt(batch.getGeometryIdAt(p.id), s).applyMatrix4(p.matrix);
      if (f.intersectsSphere(s) && !list.has(p.id)) miss.push(p.mesh.name || p.mesh.uuid);
    }
  }
  return miss;
}
const noPieceMissing = (phone) => ({
  phone,
  about: `Spinning the camera (slowly, under the re-cull threshold, and fast), walking and riding a vent${phone ? ' in a phone\'s wider view' : ''}: in every frame every batched piece in the camera's view is drawn, though the batches cull only now and then.`,
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0.8); step(30); frame(); },
  play() {
    const { statics, tpc, input, traversal, player } = G();
    const culls = statics.culls;
    let frames = 0, missed = 0, first = null, flew = 0;
    const check = () => { frames++; const m = missingInView(); if (m.length) { missed++; first ||= { frame: frames, pieces: m.slice(0, 3) }; } };
    for (let i = 0; i < 160; i++) { tpc.yaw += 0.05; tpc.pitch = Math.sin(i / 9) * 0.4; frame(); check(); }   // about 3 degrees a frame: mostly reused lists
    for (let i = 0; i < 40; i++) { tpc.yaw += 0.35; frame(); check(); }   // as fast as a flick
    input.keys = new Set(['KeyW']);
    for (let i = 0; i < 120; i++) { if (i % 30 === 0) tpc.yaw += 0.6; frame(); check(); }
    input.keys = new Set();
    const v = traversal.vents[0];
    tp(v.x + 0.1, v.y + 0.01, v.z, Math.PI / 2); frame(); check();
    player.position.set(v.x, v.y + 0.005, v.z);
    for (let i = 0; i < 240; i++) { frame(); check(); if (player.flight) flew++; else if (flew) break; }
    const reused = frames - (statics.culls - culls);
    return ok(frames > 350 && missed === 0 && flew > 10 && reused > frames / 3, { frames, culls: statics.culls - culls, reused, missed, first, flew, vent: v.to });
  },
});
story('engine/no-piece-missing-in-view', noPieceMissing(false));
story('engine/no-piece-missing-in-view-phone', noPieceMissing(true));

story('engine/old-code-reloads-into-the-new-version', {
  about: 'A page running an older BUILD than the server has (a phone holding last version\'s code while content comes fresh: the Soap crash of Nov 15) fetches its files past the cache and reloads, once per version; a matching BUILD plays on.',
  setup() { fresh({ elites: false }); },
  async play() {
    let reloads = 0;
    stub(nav, 'reload', () => { reloads++; });
    const KEY = 'jellyrun.freshReload', was = sessionStorage.getItem(KEY);
    try {
      sessionStorage.removeItem(KEY);
      const server = await serverBuild(), asksServer = !!server && server === window.JF_BUILD;
      const same = !(await reloadIfStale(Promise.resolve('v1'), 'v1')) && reloads === 0;
      const unknown = !(await reloadIfStale(Promise.resolve(null), 'v1')) && reloads === 0;
      const stale = (await reloadIfStale(Promise.resolve('v2'), 'v1')) && reloads === 1;
      const once = !(await reloadIfStale(Promise.resolve('v2'), 'v1')) && reloads === 1;
      return ok(asksServer && same && unknown && stale && once, { server, running: window.JF_BUILD, asksServer, same, unknown, stale, once, reloads });
    } finally { was === null ? sessionStorage.removeItem(KEY) : sessionStorage.setItem(KEY, was); }
  },
});
