// Plays every story (src/stories/, entry src/stories.js) headlessly in the real game, plus a phone check, and
// fails if any story fails or the page logs an error.
//
//   node tests/run.mjs                 everything
//   node tests/run.mjs elites          only stories whose name contains "elites" (a,b: either)
//   node tests/run.mjs --no-mobile     skip the phone check
//   node tests/run.mjs --jobs=N        how many pages play side by side (default 3)
//   node tests/run.mjs --shard=1/8     one of eight disjoint groups of stories, balanced by cost (CI)
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
const CARRY = { score: 5000, level: 6, xp: 0, purse: 4, stats: { health: 130 }, owned: [['candle', 1]], grown: 0, growCount: 0 };
// act 3 starts as if the Clog was just beaten: a level-10 run with act 1's and act 2's evolutions
const CARRY3 = { score: 12000, level: 10, xp: 0, purse: 6, stats: { health: 160 }, owned: [['candle', 1], ['battery', 1]], grown: 0, growCount: 0, evolved: ['manOWar', 'upsideDown'] };
// act 4 as if the shark was just beaten: a level-15 run with three evolutions
const CARRY4 = { score: 24000, level: 15, xp: 0, purse: 8, stats: { health: 200 }, owned: [['candle', 1], ['battery', 1]], grown: 0, growCount: 0, evolved: ['manOWar', 'upsideDown', 'cinder'] };
const PAGES = [
  { key: 'act1', opts: { viewport: { width: 1100, height: 650 } } },
  { key: 'portrait', opts: { viewport: { width: 960, height: 1000 } } },
  { key: 'act2', opts: { viewport: { width: 1100, height: 650 }, act: { act: 2, carry: CARRY } } },
  { key: 'act3', opts: { viewport: { width: 1100, height: 650 }, act: { act: 3, carry: CARRY3 } } },
  { key: 'act4', opts: { viewport: { width: 1100, height: 650 }, act: { act: 4, carry: CARRY4 } } },
  { key: 'phone', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } },
  { key: 'phone3', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, act: { act: 3, carry: CARRY3 } } },
];
const pageOf = (n) => (n.startsWith('menu/portrait') ? 'portrait' : n.startsWith('phone/') ? 'phone' : n.startsWith('act2/') ? 'act2' : n.startsWith('act3/') ? 'act3' : n.startsWith('act4/') ? 'act4' : 'act1');
// Most of a full run is the game booting (a minute or more each: its shaders are built in software),
// not the stories, so pages play side by side (--jobs=N, default 3, each in its own browser) and boot
// two at a time (--boots=N): more at once starve each other's shader building past openGame's wait.
const num = (flag, d) => Math.max(1, Number((args.find((a) => a.startsWith(flag)) || '').slice(flag.length)) || d);
const JOBS = num('--jobs=', 3), BOOTS = num('--boots=', 2);
let free = BOOTS; const waiting = [];
const gate = async (f) => {
  if (free > 0) free--; else await new Promise((r) => waiting.push(r));
  try { return await f(); } finally { const next = waiting.shift(); if (next) next(); else free++; }
};
const prep = async (page) => page.evaluate(() => APT.renderer.setAnimationLoop(null));   // stories step and draw the game themselves; the game's own frame loop only adds slow software-rendered frames and timing noise
const boot = (e, opts) => gate(async () => { const got = await openGame(e, { ...opts, seed: SEED }); await prep(got.page); return got; });
// before the list exists, only the act a filter like "act2/" or "phone/" names is worth booting
// Start on the likely first page of this shard instead of booting act 1 on every runner.
const first = shardArg ? PAGES[shardIndex % PAGES.length] : PAGES.find((P) => !filters.every((f) => f && pageOf(f) !== P.key && pageOf(f) !== 'act1'));
let listing = await boot(env, first.opts);
const all = await listing.page.evaluate(async () => Object.entries((await import('/src/stories.js')).STORIES).map(([n, s]) => [n, s.portrait ? 'portrait' : s.phone ? ((s.act || 1) > 1 ? 'phone' + s.act : 'phone') : (s.act || 1) > 1 ? 'act' + s.act : 'act1']));
// one task per page (the page that listed the stories plays its own act's), then the two checks that need a page of their own
const pageTask = (P, names) => async (e) => {
  let got = listing && P === first ? listing : await boot(e, P.opts);
  if (got === listing) listing = null;
  const out = await playAll(got.page, got.errors, names);
  await got.page.close();
  return out;
};
// Under --shard, a page with many stories is split into chunks of about CHUNK that each boot a page of
// their own, and the tasks are dealt to the shards by cost (a boot costs about as long as BOOT_COST
// stories), so act 1's ~500 stories don't keep one runner going long after the rest are done.
const CHUNK = 75, BOOT_COST = 70;
let jobs = PAGES.flatMap((P) => {
  const names = all.filter(([n, k]) => k === P.key && wants(n)).map(([n]) => n);
  const parts = !names.length ? 0 : shardArg ? Math.ceil(names.length / CHUNK) : 1;
  return Array.from({ length: parts }, (_, i) => {
    const mine = names.slice(Math.floor(i * names.length / parts), Math.floor((i + 1) * names.length / parts));
    return { P, label: `${P.key} (${mine.length} stories)`, cost: BOOT_COST + mine.length, run: pageTask(P, mine) };
  });
});
if (wants('first-run/survives-a-reload')) jobs.push({ label: 'first-run/survives-a-reload', cost: 3 * BOOT_COST, run: firstRunReload });
if (MOBILE && wants('mobile/touch-controls')) jobs.push({ label: 'mobile/touch-controls', cost: BOOT_COST, run: touchControls });
if (shardArg) {
  // every shard starts with a task on the page it booted to list the stories, then the rest go, dearest
  // first, to whichever shard has the least so far: the same deal on every runner
  const load = Array(shardCount).fill(0), take = (j, s) => { j.shard = s; load[s] += j.cost; };
  const dearest = [...jobs].sort((a, b) => b.cost - a.cost);
  for (let s = 0; s < shardCount; s++) { const j = dearest.find((j) => j.shard == null && j.P === PAGES[s % PAGES.length]); if (j) take(j, s); }
  for (const j of dearest) if (j.shard == null) take(j, load.indexOf(Math.min(...load)));
  jobs = jobs.filter((j) => j.shard === shardIndex);
}
const tasks = jobs.map((j) => j.run);
if (!tasks.length) throw new Error('No story tasks selected; check the filter and --shard');
if (shardArg) console.log(`Story shard ${shardIndex + 1}/${shardCount}: ${jobs.map((j) => j.label).join(', ')}`);
const envs = [env];
await Promise.all(Array.from({ length: Math.min(JOBS, tasks.length) }, async (_, w) => {
  for (let t; (t = tasks.shift());) console.log((await t(envs[w] ||= await start())).join('\n'));
}));
if (listing) await listing.page.close();
await Promise.all(envs.slice(1).map((e) => e.close()));

async function playAll(page, errors, names) {
  const out = [];
  for (const name of names) {
    const before = errors.length;
    const r = await page.evaluate(async ({ name, seed }) => (await import('/src/stories.js')).runStory(name, seed), { name, seed: SEED });
    const newErrors = errors.slice(before);
    const good = r.ok && !newErrors.length;
    if (!good) {
      const dir = path.join(ROOT, '.wrangler/story-failures'); fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, name.replace(/[^a-z0-9_-]/gi, '-') + `-${r.seed}.png`);
      await page.screenshot({ path: file }).catch(e => console.log(`Screenshot failed: ${e.message}`));
    }
    out.push(result(good, name, r.ms, { ...r.info, seed: r.seed, ...(newErrors.length ? { errors: newErrors } : {}) }));
  }
  return out;
}
function result(good, ...a) { good ? passed++ : failed++; return text(good, ...a); }

// --- a player's first run survives a real reload, and ends for good once a run ends (first-run.js)
async function firstRunReload(e) {
  const { page, errors } = await boot(e, { viewport: { width: 1100, height: 650 }, newPlayer: true });
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

// --- on a phone: tap Play, pick a starting treasure, swim with the joystick, jump
async function touchControls(e) {
  const { page, errors } = await boot(e, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  const ev = (f, a) => page.evaluate(f, a);
  const step = (n) => ev((n) => { for (let i = 0; i < n; i++) GAME.step(1 / 60); return [player.position.x, player.position.z, player.velocity.y]; }, n);
  const out = {};
  out.touchUi = await ev(() => document.body.classList.contains('touch'));
  await page.tap('#g-over .play');
  await ev(() => {
    run.spawnWaves = () => {}; run.hurt = () => {};
    // The title transition finishes before the starting pick can open.
    for (let i = 0; i < 120 && !menus.open; i++) GAME.step(1 / 60);
  });
  out.startPick = await ev(() => menus.open);
  await page.tap('.jf-card');
  await step(45);   // the pick resolves after its 0.64 s outro (the other cards burning away), on the game's clock
  out.picked = await ev(() => !menus.open && run.owned.size > 0);
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
  const good = out.touchUi && out.startPick && out.picked && out.swam > 0.2 && out.jumpVy > 0.1 && !errors.length;
  await page.close();
  return [result(good, 'mobile/touch-controls', null, { ...out, errors })];
}


await env.close();
console.log(`\n${passed} passed, ${failed} failed`);
// a full green run on a clean checkout records its commit: the pre-push hook (.githooks/pre-push)
// lets that commit go to main
if (!shardArg && !failed && filters.join('') === '' && MOBILE && SEED === DEFAULT_SEED) {
  try {
    const clean = !execSync('git status --porcelain', { cwd: ROOT }).toString().trim();
    if (clean) fs.writeFileSync(path.join(ROOT, 'tests/.last-green'), execSync('git rev-parse HEAD', { cwd: ROOT }).toString());
  } catch {}
}
process.exit(failed ? 1 : 0);
