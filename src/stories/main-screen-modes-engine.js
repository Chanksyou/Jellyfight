// Stories: the main screen, dev tools, modes, the engine, the leaderboard. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { STAGES } from '../stages.js';
import { FramePacer, FrameGovernor } from '../pacing.js';
import { checkBvhLayout } from '../collision.js';
import { loadLayout, applyLayout } from '../layout.js';
import { BAKED_LAYOUT } from '../layout-baked.js';
import { juice } from '../juice.js';
import { LOOK } from '../look.js';
import { NEEDS, PRICES, FEATS_KEY, PEARLS_KEY, lifetime, requirement, requirementText, unlocked, bank, pearlsFor, feats } from '../cosmetics.js';
import { FOUND_KEY } from '../collection.js';
import { normalizeLook, buildCharacter, DEFAULT_LOOK, OPTIONS, SPECIES } from '../character.js';
import { TYPES } from '../enemies.js';
import { G, V, evolve, fresh, near, ok, setupFight, spawn, step, story, stub, tp } from './kit.js';

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
      && !ro.posted && ro.why === 'readonly' && O.status === 'offline' && off.why === 'offline' && shown && posted && firstScore >= 12 * 10 + 200,
      { notYet, remembered, guest, home, listed, fresh, refused, refusedNote, first, lower, higher, order, escaped, ro, off, shown, posted, score: firstScore });
  },
});

// --- the main screen
story('engine/leaderboard-shows-each-players-jelly', {
  about: 'The leaderboard is big and easy to read, and every score has that player\'s own customized jelly by their name (drawn from the look they posted with it): different jellies look different, the same jelly is drawn once, and an old score with no look still gets a jelly.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { Leaderboard } = await import('../leaderboard.js');
    const { run, menus } = G(), realBoard = run.board;
    const fake = fakeClaude({ id: 'u_me' });
    fake.docs.set('scores/u_pink', { score: 30000, name: 'Pinky', look: { body: 'moon', color: '#ff5fa2', accent: '#ffd23a', top: 'crown' } });
    fake.docs.set('scores/u_green', { score: 20000, name: 'Greeny', look: { body: 'lion', color: '#4dff7a', accent: '#1f6b3a' } });
    fake.docs.set('scores/u_old', { score: 10000, name: 'Oldie', body: 'box' });
    window.claude = fake;
    run.board = new Leaderboard();
    run.showBoard(() => menus.close());
    await new Promise((r) => setTimeout(r, 300));
    const board = document.querySelector('.jf-modal .jf-board');
    const imgs = [...(board?.querySelectorAll('img.jf-jelly') || [])], srcs = imgs.map((i) => i.getAttribute('src'));
    const pictures = imgs.length === 3 && srcs.every((s) => s.startsWith('data:image/png')) && new Set(srcs).size === 3;
    const big = parseFloat(getComputedStyle(board.querySelector('.jf-stats')).fontSize) >= 20 && imgs[0]?.getBoundingClientRect().width >= 48;
    const t0 = performance.now(); run.jellyFace(fake.docs.get('scores/u_pink').look); const cached = performance.now() - t0 < 5;
    menus.close();
    delete window.claude;
    run.board = realBoard;
    return ok(pictures && big && cached, { rows: imgs.length, unique: new Set(srcs).size, big, cached, size: board && getComputedStyle(board.querySelector('.jf-stats')).fontSize });
  },
});

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
story('menu/dev-tools-locked', {
  about: 'The main screen has no Restart button and no Auto graphics; the dev tools wait behind one 🔒 Dev button: a wrong password keeps them hidden, "chan" shows them (Layout, Fight boss, 1 on 1, Test kit, Tuner, Diagnostics).',
  setup() { fresh({ elites: false }); try { sessionStorage.removeItem('jellyrun.dev'); } catch {} },
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
    try { sessionStorage.removeItem('jellyrun.dev'); } catch {}
    return ok(!restart && graphics.join() === 'low,medium,high' && hiddenAtFirst && asks && stillHidden && tools.join() === 'layout,arena4,boss,duel,kit,tuner,diag',   // Act 4 environment preview joins the locked Dev row in v233.
      { restart, graphics, hiddenAtFirst, asks, stillHidden, tools });
  },
});

story('dev/layout-editor-acts-and-delete', {
  about: 'The layout editor binds the act it opened in, keeps each act\'s edits in their own slice of the saved layout, and can delete an object picked from its list (recorded as deleted, restorable).',
  setup() { fresh({ elites: false }); },
  play() {
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
    L.listEl.value = it.key; L.listEl.dispatchEvent(new Event('change'));
    const picked = L.sel === it;
    L.deleteSelected();
    const gone = !it.node.visible && it.deleted && L.data[it.key]?.deleted === true;
    // the deletion lives in act 1's slice only — act 2's saved layout is untouched
    const scoped = !!loadLayout(1)[it.key]?.deleted && !(it.key in loadLayout(2));
    // and ⌂ brings it back, clearing the entry
    L.putBack();
    const back = it.node.visible && !it.deleted && !(it.key in L.data);
    // applyLayout honours the act it is given: a crafted act-2 edit moves the object
    applyLayout(APT.root, 2, { [it.key]: { p: [9, 0, 9], q: [0, 0, 0, 1] } });
    const moved = it.node.position.x === 9;
    it.node.position.fromArray(it.node.userData.home.p);
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
      creatorOk = !!crown && crown.classList.contains('locked') && crown.textContent.includes('✨') && crown.textContent.includes('🔒')
        && /^🔒 Golden crown · Earned: win a run$/.test(note) && wearing !== 'goldcrown' && !!bow && !bow.classList.contains('locked');
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
        && !chip('top', 'bottlecap').classList.contains('locked') && /🦪 10 Pearls/.test(document.querySelector('#creator .pearls').textContent);
      const shopOk = !!lamp && lamp.classList.contains('locked') && /🦪 300/.test(lamp.textContent) && tooDear && !!buyBtn && bought;
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
        for (const [k, id] of all) if (k !== 'pattern' && k !== 'finish' && meshes({ ...plain, [k]: id }) === base) broken.push(`${body}:${k}:${id}`);
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
    const keys = (await import('../layout.js')).movables(APT.root).map((m) => m.key);
    const after = { loaded: [...APT.loaded].join(), toilet: has('Toilet'), added: added.length, lights: lights(), colliders: world.colliders.length, vanityTop: hit ? +hit.point.y.toFixed(3) : null, toiletKey: keys.includes('Toilet#1'), ms };
    const good = before.act1Only && before.sofa && before.hallLights && !before.washer && !before.toilet && after.toilet && after.added > 40 && after.lights >= before.lights && after.colliders > before.colliders && hit && Math.abs(hit.point.y - 0.88) < 0.03 && after.toiletKey;
    return ok(good, { before, after });
  },
});
