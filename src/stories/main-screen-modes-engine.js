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
import { NEEDS, requirement, requirementText, unlocked } from '../cosmetics.js';
import { normalizeLook } from '../character.js';
import { G, V, fresh, near, ok, spawn, step, story, stub, tp } from './kit.js';

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
story('menu/reduce-effects', {
  about: 'The ✨ button in the pause menu turns Reduce effects on and off and remembers it: on, a kill still lands its hit-stop but shakes nothing; off, the kill shakes by its step on look.css\'s --feel-* ladder.',
  setup() { fresh({ elites: false }); },
  play() {
    const { enemies } = G(), btn = document.querySelector('#g-over [data-act="effects"]');
    let saved = null;
    try { saved = localStorage.getItem('jellyfight.effects'); } catch {}
    const was = juice.calm;
    const killOne = () => { juice.reset(); enemies.kill(spawn('roach', near(0.1, 0.1), { still: true })); return { shake: juice.trauma, stop: juice.stop }; };
    if (juice.calm) btn.click();
    const full = killOne(), fullText = btn.textContent;
    btn.click();
    const calm = killOne(), calmText = btn.textContent, remembered = localStorage.getItem('jellyfight.effects'), bodyCalm = document.body.classList.contains('calm');
    if (juice.calm !== was) btn.click();
    try { saved === null ? localStorage.removeItem('jellyfight.effects') : localStorage.setItem('jellyfight.effects', saved); } catch {}
    juice.reset();
    const [kShake, kStop] = LOOK.list('feel-kill', []).map(Number);
    return ok(Math.abs(full.shake - kShake) < 1e-6 && full.stop === kStop && calm.shake === 0 && calm.stop === kStop
      && /full/.test(fullText) && /reduced/.test(calmText) && remembered === 'reduced' && bodyCalm,
      { full, calm, fullText, calmText, remembered, bodyCalm, ladder: [kShake, kStop] });
  },
});
story('menu/dev-tools-locked', {
  about: 'The main screen has no Restart button and no Auto graphics; the dev tools wait behind one 🔒 Dev button: a wrong password keeps them hidden, "chan" shows them (Layout, Fight boss, 1 on 1, Test kit, Tuner, Diagnostics).',
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
  about: 'The earned-cosmetics framework: the look a run submits is the whole descriptor (it survives a JSON round trip through normalizeLook, so a leaderboard row can draw the actual jelly), and a registered requirement locks its creator option (disabled, 🔒, what it asks for) until the player\'s feats meet it. The registry ships empty: everything is unlocked.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run } = G();
    const look = run.playerLook();
    const roundTrip = normalizeLook(JSON.parse(JSON.stringify(look)));
    const carried = !!look && roundTrip.body === look.body && roundTrip.top === look.top && roundTrip.color === look.color && roundTrip.eyes === look.eyes;
    const none = { won: false, bestScore: 0, bestLevel: 0, bestKills: 0 }, won = { ...none, won: true };
    const freeByDefault = unlocked('top', 'crown', none) && requirement('top', 'crown') === null;
    NEEDS.top = { crown: { won: true } };
    let lockedOk = false, creatorOk = false;
    try {
      lockedOk = !unlocked('top', 'crown', none) && unlocked('top', 'crown', won) && unlocked('top', 'bow', none)
        && requirementText(requirement('top', 'crown')) === 'Earned with win a run';
      const over = document.querySelector('#g-over');
      over.hidden = false;
      document.querySelector('#g-over [data-act="creator"]').click(); step(30);
      const crown = document.querySelector('#creator [data-k="top"][data-v="crown"]');
      const bow = document.querySelector('#creator [data-k="top"][data-v="bow"]');
      creatorOk = !!crown && crown.disabled && crown.textContent.includes('🔒') && !!bow && !bow.disabled;
      dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
      over.hidden = true;
    } finally { delete NEEDS.top; }
    return ok(carried && freeByDefault && lockedOk && creatorOk, { carried, freeByDefault, lockedOk, creatorOk });
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
