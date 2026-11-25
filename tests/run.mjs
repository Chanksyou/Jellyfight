// Plays every story (src/stories/, entry src/stories.js) headlessly in the real game, plus a phone check, and
// fails if any story fails or the page logs an error.
//
//   node tests/run.mjs                 everything
//   node tests/run.mjs elites          only stories whose name contains "elites" (a,b: either)
//   node tests/run.mjs --no-mobile     skip the phone check
//   node tests/run.mjs --jobs=N        how many pages play side by side (default 3)
//   node tests/run.mjs --shard=1/8     one of eight disjoint groups of stories, balanced by cost (CI)
//   node tests/run.mjs --shard=1/8 --plan   print every shard's deal and exit (needs one boot to list the stories)
//   node tests/run.mjs --force         play a full run even if this commit already passed one
//   node tests/run.mjs --seed=42       reproduce a different deterministic set of story rolls
//
// Needs Playwright (cd tests && npm install && npx playwright install chromium).
// If the machine can't reach the three.js CDN, point JF_THREE at an unpacked three npm package (the
// version in index.html's import map), or put one in tests/.three (the session start hook does);
// its files are served from there instead.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { start, openGame, ROOT } from './lib.mjs';
import { DEFAULT_SEED } from '../src/story-random.mjs';

const args = process.argv.slice(2);
// filters: comma-separated; a story runs if its name contains any of them (none = everything)
const filters = (args.find((a) => !a.startsWith('--')) || '').split(',');
const wants = (name) => filters.some((f) => name.includes(f));
const MOBILE = !args.includes('--no-mobile');
const shardArg = args.find(a => a.startsWith('--shard='));
const shard = shardArg ? /^--shard=([1-9]\d*)\/([1-9]\d*)$/.exec(shardArg) : null;
if (shardArg && (!shard || !Number.isSafeInteger(+shard[1]) || !Number.isSafeInteger(+shard[2]) || +shard[1] > +shard[2])) {
  throw new Error('--shard must be INDEX/TOTAL with 1 <= INDEX <= TOTAL');
}
const shardIndex = shard ? +shard[1] - 1 : 0, shardCount = shard ? +shard[2] : 1;
const seedArg = args.find(a => a.startsWith('--seed='));
const SEED = seedArg ? Number(seedArg.slice(7)) : DEFAULT_SEED;
if (!Number.isInteger(SEED) || SEED < 0 || SEED > 0xffffffff) throw new Error('--seed must be an integer from 0 to 4294967295');
console.log(`Story seed base: ${SEED} (replay with --seed=${SEED})`);

// a full run of a clean checkout whose commit already passed one has nothing new to find (--force plays it anyway)
if (!shardArg && filters.join('') === '' && MOBILE && !seedArg && !args.includes('--force')) {
  try {
    const clean = !execSync('git status --porcelain', { cwd: ROOT }).toString().trim();
    const head = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
    if (clean && fs.readFileSync(path.join(ROOT, 'tests/.last-green'), 'utf8').trim() === head) {
      console.log(`${head.slice(0, 7)} already passed a full run (tests/.last-green): nothing to do. --force plays it again.`);
      process.exit(0);
    }
  } catch {}
}

const env = await start();
let failed = 0, passed = 0;
const text = (good, name, ms, info) => `${good ? '✓' : '✗'} ${name}${ms != null ? `  (${ms} ms)` : ''}${good ? '' : '\n    ' + JSON.stringify(info)}`;

// --- every story, one page per act (booting the apartment takes a while, so a page only opens
// when it has a story to play). Later acts start as if the act before was just beaten, carrying a
// level-6 run with a Candle (act 3: a level-10 run); stories with `phone: true` (phone/...) play in a page that looks
// like a phone (opened on their act: `act: 3` plays in a phone page on act 3). The first page that opens lists every story for the rest.
const CARRY = { score: 5000, level: 6, xp: 0, purse: 4, stats: { health: 130 }, owned: [['goldRing', 1]], grown: 0, growCount: 0 };
// act 3 starts as if the Clog was just beaten: a level-10 run with act 1's and act 2's evolutions
const CARRY3 = { score: 12000, level: 10, xp: 0, purse: 6, stats: { health: 160 }, owned: [['goldRing', 1], ['nailClipper', 1]], grown: 0, growCount: 0, evolved: ['manOWar', 'upsideDown'] };
// act 4 as if the shark was just beaten: a level-15 run with three evolutions
const CARRY4 = { score: 24000, level: 15, xp: 0, purse: 8, stats: { health: 200 }, owned: [['goldRing', 1], ['nailClipper', 1]], grown: 0, growCount: 0, evolved: ['manOWar', 'upsideDown', 'cinder'] };
const PAGES = [
  { key: 'act1', opts: { viewport: { width: 1100, height: 650 } } },
  { key: 'portrait', opts: { viewport: { width: 960, height: 1000 } } },
  { key: 'act2', opts: { viewport: { width: 1100, height: 650 }, act: { act: 2, carry: CARRY } } },
  { key: 'act3', opts: { viewport: { width: 1100, height: 650 }, act: { act: 3, carry: CARRY3 } } },
  { key: 'act4', opts: { viewport: { width: 1100, height: 650 }, act: { act: 4, scene: 2, carry: CARRY4 } } },   // the arena, behind the stage door
  { key: 'night4', opts: { viewport: { width: 1100, height: 650 }, act: { act: 4, carry: CARRY4 } } },           // act 4's night in the living room
  { key: 'phone', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } },
  { key: 'phone3', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, act: { act: 3, carry: CARRY3 } } },
  { key: 'phone4', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, act: { act: 4, scene: 2, carry: CARRY4 } } },   // the arena on a phone
];
const pageOf = (n) => (n.startsWith('menu/portrait') ? 'portrait' : n.startsWith('phone/') ? 'phone' : n.startsWith('act2/') ? 'act2' : n.startsWith('act3/') ? 'act3' : n.startsWith('act4/') ? 'act4' : n.startsWith('night4/') ? 'night4' : 'act1');
// Most of a full run is the game booting (a minute or more each: its shaders are built in software),
// not the stories, so pages play side by side (--jobs=N, default 3, each in its own browser) and boot
// two at a time (--boots=N): more at once starve each other's shader building past openGame's wait.
const num = (flag, d) => Math.max(1, Number((args.find((a) => a.startsWith(flag)) || '').slice(flag.length)) || d);
const JOBS = num('--jobs=', 3), BOOTS = num('--boots=', 2);
// A story that takes longer than this has hung: it fails, and the rest play on a fresh page (--story-timeout=SECONDS).
// The slowest honest story is about a minute in CI; without a limit a hung page sat until the job's own timeout.
// With one job (the CI) each story's line prints as it finishes, so a log that stops shows which story it stopped in.
const LIVE = JOBS === 1;
const STORY_MS = num('--story-timeout=', 240) * 1000;
class StoryHang extends Error {}
const SMALL = Number((args.find((a) => a.startsWith('--small=')) || '').slice(8)) || 0.25;
// Closing a page or the browser waits for the software GPU to finish every frame it was handed; the stories are done by then, so give up after a minute (the process exit ends the browser).
const quit = (p) => Promise.race([Promise.resolve(p).catch(() => {}), new Promise((r) => setTimeout(r, 60000))]);
let free = BOOTS; const waiting = [];
const gate = async (f) => {
  if (free > 0) free--; else await new Promise((r) => waiting.push(r));
  try { return await f(); } finally { const next = waiting.shift(); if (next) next(); else free++; }
};
// Stories step and draw the game themselves; the game's own frame loop only adds slow software-rendered frames and timing noise.
// The canvas is also kept out of the page's picture (opacity 0: still laid out and still hit by taps). Headless Chromium copies
// every frame drawn on a visible WebGL canvas back off the software GPU for its compositor, and a story that draws dozens of
// frames in one go queued so many copies that the page stalled for minutes and ran out of memory ("Target crashed").
// shown(page, f) puts the picture back for a failure screenshot.
const prep = async (page) => page.evaluate(() => { APT.renderer.setAnimationLoop(null); APT.renderer.domElement.style.opacity = '0'; });
const shown = async (page, f) => {
  await page.evaluate(async () => { APT.renderer.setPixelRatio(1); (await import('/src/stories/kit.js')).G().gfx.resize(); APT.renderer.domElement.style.opacity = ''; GAME.render(); }).catch(() => {});
  try { return await f(); } finally { await page.evaluate(() => { APT.renderer.domElement.style.opacity = '0'; }).catch(() => {}); }
};
const boot = (e, opts) => gate(async () => { const got = await openGame(e, { ...opts, seed: SEED }); await prep(got.page); return got; });
// The page that lists the stories is the one this run plays first. Under --shard that's FIRST's entry
// for this shard (the CI's eight: the reload check's new-player page, act 1 three times, then the other
// big acts), so no runner boots a page it doesn't play; otherwise the act a filter like "act2/" names.
const FIRST_RUN = { key: 'first-run', opts: { viewport: { width: 1100, height: 650 }, newPlayer: true } };
const TOUCH = { key: 'touch' };
const FIRST = ['first-run', 'act1', 'act1', 'act1', 'act2', 'act3', 'night4', 'phone'];
const firstKey = (s) => FIRST[s % FIRST.length];
const first = !shardArg ? PAGES.find((P) => !filters.every((f) => f && pageOf(f) !== P.key && pageOf(f) !== 'act1'))
  : firstKey(shardIndex) === FIRST_RUN.key ? FIRST_RUN : PAGES.find((P) => P.key === firstKey(shardIndex));
let listing = await boot(env, first.opts);
const all = await listing.page.evaluate(async () => Object.entries((await import('/src/stories.js')).STORIES).map(([n, s]) => [n, s.portrait ? 'portrait' : s.phone ? ((s.act || 1) > 1 ? 'phone' + s.act : 'phone') : (s.act || 1) > 1 ? (s.act === 4 && s.scene !== 2 ? 'night4' : 'act' + s.act) : 'act1', !!s.readback]));
const readback = new Set(all.filter((a) => a[2]).map((a) => a[0]));
const reuse = (P) => { if (!listing || P !== first) return null; const got = listing; listing = null; return got; };
// one task per page, then the two checks that need a page of their own. A page that crashes (the browser's
// "Target crashed", not a story failing) is replayed once per run on a fresh page from the story it was
// playing; a second crash fails the run.
let crashed = false, hangs = 0;
// Stories that read the picture back play first: drawing is queued for the software GPU and any story that reads pixels
// waits for every frame the stories before it drew (6 minutes in CI behind act 1's first 150 stories, against 5 seconds alone).
const pageTask = (P, played) => async (e) => {
  const names = [...played.filter((n) => readback.has(n)), ...played.filter((n) => !readback.has(n))];
  let got = reuse(P) || await boot(e, P.opts);
  const out = [];
  while (out.length < names.length) {
    try { await playAll(got.page, got.errors, names.slice(out.length), out); }
    catch (err) {
      if (err instanceof StoryHang) {
        const note = `${err.message} took over ${STORY_MS / 1000} s and was stopped: it fails, and the rest play on a fresh page`;
        console.log(process.env.GITHUB_ACTIONS ? `::error::${note}` : `✗ ${note}`);
        out.push(result(false, err.message, STORY_MS, { hung: true }));
        if (++hangs > 3) throw new Error('Four stories hung in one run: stopping');
        await got.page.close().catch(() => {});
        got = await boot(e, P.opts);
        continue;
      }
      if (crashed || !/Target crashed/.test(String(err))) throw err;
      crashed = true;
      const note = `The ${P.key} page crashed during ${names[out.length]}: replaying it and the rest on a fresh page (a second crash fails the run)`;
      console.log(process.env.GITHUB_ACTIONS ? `::warning::${note}` : `⚠ ${note}`);
      await got.page.close().catch(() => {});
      got = await boot(e, P.opts);
    }
  }
  await quit(got.page.close());
  return out;
};
const BOOT_COST = 180;
const byPage = PAGES.map((P) => ({ P, names: all.filter(([n, k]) => k === P.key && wants(n)).map(([n]) => n) })).filter((p) => p.names.length);
const solo = [];
// n: what a task costs beyond its first boot, in stories
if (wants('first-run/survives-a-reload')) solo.push({ P: FIRST_RUN, label: 'first-run/survives-a-reload', n: 2 * BOOT_COST, run: firstRunReload });
if (MOBILE && wants('mobile/touch-controls')) solo.push({ P: TOUCH, label: 'mobile/touch-controls', n: 0, run: touchControls });
const pageJob = ({ P, names }) => ({ P, names, label: `${P.key} (${names.length} stories)`, run: pageTask(P, names) });
let jobs = [...byPage.map(pageJob), ...solo];
if (shardArg) {
  // Booting the game costs far more than a story (about 80 s against about 0.45 s in CI, Nov 2026), so
  // the deal counts in stories with a boot as BOOT_COST of them. Every shard first gets a part of the page
  // it listed from; the rest go, dearest first, wherever they finish soonest (a part of a page the shard
  // already plays costs no boot: its parts play on one page). A page is split into as many parts as
  // brings the slowest shard down. The same deal on every runner.
  const deal = (parts) => {
    const js = [...solo.map((j) => ({ ...j })), ...byPage.flatMap(({ P, names }) => {
      const n = parts.get(P);
      // Interleave round-robin so GPU/readPixels-heavy story files spread evenly across shards
      return Array.from({ length: n }, (_, i) => {
        const mine = names.filter((_, idx) => idx % n === i);
        return { P, names: mine, n: mine.length };
      });
    })].sort((a, b) => b.n - a.n);
    const load = Array(shardCount).fill(0), plays = Array.from({ length: shardCount }, () => new Set());
    const cost = (j, s) => j.n + (plays[s].has(j.P) ? 0 : BOOT_COST);
    const put = (j, s) => { load[s] += cost(j, s); plays[s].add(j.P); j.shard = s; };
    for (let s = 0; s < shardCount; s++) { const j = js.find((j) => j.shard == null && j.P.key === firstKey(s)); if (j) put(j, s); }
    for (const j of js) if (j.shard == null) { let best = 0; for (let s = 1; s < shardCount; s++) if (load[s] + cost(j, s) < load[best] + cost(j, best)) best = s; put(j, best); }
    return { js, slowest: Math.max(...load) };
  };
  const parts = new Map(byPage.map(({ P, names }) => [P, Math.min(names.length, Math.max(1, Array.from({ length: shardCount }, (_, s) => firstKey(s)).filter((k) => k === P.key).length))]));
  let best = deal(parts);
  for (let better = true; better;) {
    better = null;
    for (const { P, names } of byPage) {
      if (parts.get(P) >= names.length) continue;
      parts.set(P, parts.get(P) + 1);
      const d = deal(parts);
      if (d.slowest < best.slowest) { best = d; better = P; }
      parts.set(P, parts.get(P) - 1);
    }
    if (better) parts.set(better, parts.get(better) + 1);
  }
  if (args.includes('--plan')) {
    for (let s = 0; s < shardCount; s++) {
      const js = best.js.filter((j) => j.shard === s), boots = new Set(js.map((j) => j.P)).size + (js.some((j) => j.P === FIRST_RUN) ? 2 : 0);
      console.log(`shard ${s + 1}: ${boots} boots, ${js.reduce((t, j) => t + (j.names?.length || 0), 0)} stories, ${js.map((j) => j.run ? j.label : `${j.P.key} ${j.names.length}`).join(', ')}`);
    }
    await env.close(); process.exit(0);
  }
  const mine = new Map();
  for (const j of best.js.filter((j) => j.shard === shardIndex)) {
    if (j.run) mine.set(j, j);
    else if (mine.has(j.P)) mine.get(j.P).names.push(...j.names);
    else mine.set(j.P, { P: j.P, names: [...j.names] });
  }
  jobs = [...mine.values()].map((j) => j.run ? j : pageJob(j));
}
jobs.sort((a, b) => (b.P === first) - (a.P === first));   // the listing page plays first, so two game pages are never open at once
if (!jobs.some((j) => j.P === first)) { await listing.page.close(); listing = null; }
const tasks = jobs.map((j) => j.run);
if (!tasks.length) throw new Error('No story tasks selected; check the filter and --shard');
if (shardArg) console.log(`Story shard ${shardIndex + 1}/${shardCount}: ${jobs.map((j) => j.label).join(', ')}`);
const envs = [env];
await Promise.all(Array.from({ length: Math.min(JOBS, tasks.length) }, async (_, w) => {
  for (let t; (t = tasks.shift());) { const lines = (await t(envs[w] ||= await start())).filter(Boolean).join('\n'); if (lines) console.log(lines); }
}));
if (listing) await quit(listing.page.close());
await Promise.all(envs.slice(1).map((e) => quit(e.close())));

async function playAll(page, errors, names, out = []) {
  for (const name of names) {
    const before = errors.length;
    // frames are drawn in software and their cost is paid later, in bulk: stories that never look at the picture draw it small
    await page.evaluate(async ({ ratio }) => { APT.renderer.setPixelRatio(ratio); (await import('/src/stories/kit.js')).G().gfx.resize(); }, { ratio: readback.has(name) ? 1 : SMALL }).catch(() => {});
    let timer;
    const r = await Promise.race([
      page.evaluate(async ({ name, seed }) => (await import('/src/stories.js')).runStory(name, seed), { name, seed: SEED }),
      new Promise((_, no) => { timer = setTimeout(() => no(new StoryHang(name)), STORY_MS); }),
    ]).finally(() => clearTimeout(timer));
    const newErrors = errors.slice(before);
    const good = r.ok && !newErrors.length;
    if (!good) {
      const dir = path.join(ROOT, '.wrangler/story-failures'); fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, name.replace(/[^a-z0-9_-]/gi, '-') + `-${r.seed}.png`);
      await shown(page, () => page.screenshot({ path: file })).catch(e => console.log(`Screenshot failed: ${e.message}`));
    }
    out.push(result(good, name, r.ms, { ...r.info, seed: r.seed, ...(newErrors.length ? { errors: newErrors } : {}) }));
  }
  return out;
}
function result(good, ...a) { good ? passed++ : failed++; const line = text(good, ...a); if (LIVE) console.log(line); return LIVE ? '' : line; }

// --- a player's first run survives a real reload, and ends for good once a run ends (first-run.js)
async function firstRunReload(e) {
  const { page, errors } = reuse(FIRST_RUN) || await boot(e, FIRST_RUN.opts);
  const ready = () => page.waitForFunction(() => window.run && document.querySelector('#g-over .play') && !document.querySelector('#g-over .play').disabled, null, { timeout: 180000 });
  // what the old page logs while the reload tears it down (a download still in flight, aborted)
  // isn't the game failing: only errors from the page that loads count
  const reload = () => gate(async () => { const kept = errors.length; await page.reload({ waitUntil: 'commit', timeout: 180000 }); errors.length = kept; await ready(); });
  const out = { first: await page.evaluate(() => run.firstRun.active) };
  await reload();
  out.afterReload = await page.evaluate(() => run.firstRun.active);
  await page.evaluate(() => run.die());
  await reload();
  out.afterARun = await page.evaluate(() => run.firstRun.active);
  const good = out.first && out.afterReload && !out.afterARun && !errors.length;
  await page.close();
  return [result(good, 'first-run/survives-a-reload', null, { ...out, errors })];
}

// --- on a phone: tap Play, swim with the joystick, jump
async function touchControls(e) {
  const { page, errors } = await boot(e, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, newPlayer: true });   // a first run is Normal, with no pick screen
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id], i) => ({ x, y, id: id ?? i })) });
  const ev = (f, a) => page.evaluate(f, a);
  const step = (n) => ev((n) => { for (let i = 0; i < n; i++) GAME.step(1 / 60); return [player.position.x, player.position.z, player.velocity.y]; }, n);
  const out = {};
  out.touchUi = await ev(() => document.body.classList.contains('touch'));
  await page.tap('#g-over .play');
  await ev(() => {
    run.spawnWaves = () => {}; run.hurt = () => {};
    // The title transition finishes before play starts. A first run is Normal: no pick opens.
    for (let i = 0; i < 120; i++) GAME.step(1 / 60);
  });
  out.startPick = await ev(() => !menus.open);   // straight into play
  out.picked = await ev(() => run.jelly === 'normal');
  const a = await step(1);
  await touch('touchStart', [[150, 280]]);
  await touch('touchMove', [[150, 220]]);
  const b = await step(60);
  await touch('touchEnd', []);
  out.swam = +Math.hypot(b[0] - a[0], b[1] - a[1]).toFixed(3);
  const jb = await (await page.$('#touch .jump')).boundingBox();
  await touch('touchStart', [[jb.x + jb.width / 2, jb.y + jb.height / 2]]);
  const c = await step(4);
  await touch('touchEnd', []);
  out.jumpVy = +c[2].toFixed(3);
  // Browser gestures must leave both the page scale and the follow distance alone, including
  // beneath furniture (the reported trigger) and when both thumbs are on the screen.
  await ev(async () => {
    const { fresh, tp, step } = await import('/src/stories/kit.js');
    fresh({ elites: false });
    const cabinet = APT.root.getObjectByName('Media_console_6');
    const box = new THREE.Box3().setFromObject(cabinet);
    tp((box.min.x + box.max.x) / 2, 0.05, (box.min.z + box.max.z) / 2, 0);
    step(30);
  });
  const view = () => ev(() => ({ scale: visualViewport.scale, width: visualViewport.width, distance: tpc.distance }));
  const before = await view();
  await cdp.send('Input.synthesizeTapGesture', { x: 600, y: 230, tapCount: 2, gestureSourceType: 'touch' });
  // Keep the left thumb held while the right alternates Jump and misses beside it,
  // in the gap below the map, and by the viewport edge. Pointer 0 stays down throughout.
  await touch('touchStart', [[150, 280]]);
  await touch('touchMove', [[150, 220]]);
  for (const [x, y] of [[jb.x + jb.width / 2, jb.y + jb.height / 2], [jb.x - 8, jb.y + 20], [780, jb.y - 12], [838, 230]]) {
    for (let i = 0; i < 2; i++) {
      await touch('touchStart', [[150, 220], [x, y]]);
      await step(2);
      await touch('touchEnd', [[x, y, 1]]);   // release only the right thumb, not pointer 0
    }
  }
  await touch('touchStart', [[150, 220], [600, 230]]);
  await touch('touchMove', [[100, 220], [650, 230]]);
  await step(5);
  out.keptMoving = await ev(() => input.touchMove?.y > 0);
  await touch('touchEnd', []);
  await page.waitForTimeout(400);   // let any browser zoom animation finish before measuring
  out.released = await ev(() => !input.touchMove && !input.touchJump);
  const after = await view();
  out.stableView = before.scale === 1 && after.scale === before.scale && after.width === before.width && after.distance === before.distance;
  await page.tap('#touch .pause');
  await step(2);
  out.paused = await ev(() => !document.getElementById('g-over').hidden && document.getElementById('touch').hidden);
  const pausedBefore = await view();
  await cdp.send('Input.synthesizeTapGesture', { x: 40, y: 120, tapCount: 2, gestureSourceType: 'touch' });
  await touch('touchStart', [[100, 180]]);
  await touch('touchStart', [[100, 180], [200, 180]]);
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', [[100 - i * 6, 180], [200 + i * 6, 180]]);
    await page.waitForTimeout(30);
  }
  await touch('touchEnd', []);
  await page.waitForTimeout(400);
  const pausedAfter = await view();
  out.stablePause = pausedAfter.scale === pausedBefore.scale && pausedAfter.width === pausedBefore.width && pausedAfter.distance === pausedBefore.distance;
  // Exercise the existing scroll container with enough content to overflow this phone viewport.
  const panelAt = await ev(() => {
    const panel = document.querySelector('#g-over > div'), spacer = document.createElement('div');
    spacer.id = 'scroll-probe'; spacer.style.height = '600px'; panel.appendChild(spacer); panel.scrollTop = 0;
    const r = panel.getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.min(r.bottom - 30, innerHeight - 30) };
  });
  out.scrollContext = await ev(({ x, y }) => {
    const panel = document.querySelector('#g-over > div');
    return { height: panel.clientHeight, content: panel.scrollHeight, top: panel.scrollTop,
      target: document.elementFromPoint(x, y)?.tagName, root: getComputedStyle(document.documentElement).touchAction,
      menu: getComputedStyle(document.getElementById('g-over')).touchAction };
  }, panelAt);
  await touch('touchStart', [[panelAt.x, panelAt.y]]);
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', [[panelAt.x, panelAt.y - i * 15]]);
    await page.waitForTimeout(30);
  }
  await touch('touchEnd', []);
  await page.waitForTimeout(200);
  out.menuScroll = await ev(() => {
    const panel = document.querySelector('#g-over > div'), scrolled = panel.scrollTop > 0;
    document.getElementById('scroll-probe').remove(); panel.scrollTop = 0; return scrolled;
  });
  await page.tap('#g-over .pause-resume');
  await step(2);
  out.resumed = await ev(() => document.getElementById('g-over').hidden && !document.getElementById('touch').hidden);
  const good = out.touchUi && out.startPick && out.picked && out.swam > 0.2 && out.jumpVy > 0.1 && out.stableView && out.keptMoving && out.released && out.paused && out.stablePause && out.menuScroll && out.resumed && !errors.length;
  await page.close();
  return [result(good, 'mobile/touch-controls', null, { ...out, errors })];
}


console.log(`\n${passed} passed, ${failed} failed`);
await quit(env.close());
// a full green run on a clean checkout records its commit: the pre-push hook (.githooks/pre-push)
// lets that commit go to main
if (!shardArg && !failed && filters.join('') === '' && MOBILE && SEED === DEFAULT_SEED) {
  try {
    const clean = !execSync('git status --porcelain', { cwd: ROOT }).toString().trim();
    if (clean) fs.writeFileSync(path.join(ROOT, 'tests/.last-green'), execSync('git rev-parse HEAD', { cwd: ROOT }).toString());
  } catch {}
}
process.exit(failed ? 1 : 0);
