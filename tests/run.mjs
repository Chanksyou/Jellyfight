// Plays every story (src/stories/, entry src/stories.js) headlessly in the real game, plus a phone check, and
// fails if any story fails or the page logs an error.
//
//   node tests/run.mjs                 everything
//   node tests/run.mjs elites          only stories whose name contains "elites" (a,b: either)
//   node tests/run.mjs --no-mobile     skip the phone check
//   node tests/run.mjs --jobs=N        how many pages play side by side (default 3)
//   node tests/run.mjs --force         play a full run even if this commit already passed one
//
// Needs Playwright (cd tests && npm install && npx playwright install chromium).
// If the machine can't reach the three.js CDN, point JF_THREE at an unpacked three npm package (the
// version in index.html's import map), or put one in tests/.three (the session start hook does);
// its files are served from there instead.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { start, openGame, ROOT } from './lib.mjs';

const args = process.argv.slice(2);
// filters: comma-separated; a story runs if its name contains any of them (none = everything)
const filters = (args.find((a) => !a.startsWith('--')) || '').split(',');
const wants = (name) => filters.some((f) => name.includes(f));
const MOBILE = !args.includes('--no-mobile');

// a full run of a clean checkout whose commit already passed one has nothing new to find (--force plays it anyway)
if (filters.join('') === '' && MOBILE && !args.includes('--force')) {
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
const PAGES = [
  { key: 'act1', opts: { viewport: { width: 1100, height: 650 } } },
  { key: 'act2', opts: { viewport: { width: 1100, height: 650 }, act: { act: 2, carry: CARRY } } },
  { key: 'act3', opts: { viewport: { width: 1100, height: 650 }, act: { act: 3, carry: CARRY3 } } },
  { key: 'phone', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } },
  { key: 'phone3', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, act: { act: 3, carry: CARRY3 } } },
];
const pageOf = (n) => (n.startsWith('phone/') ? 'phone' : n.startsWith('act2/') ? 'act2' : n.startsWith('act3/') ? 'act3' : 'act1');
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
const boot = (e, opts) => gate(async () => { const got = await openGame(e, opts); await prep(got.page); return got; });
// before the list exists, only the act a filter like "act2/" or "phone/" names is worth booting
const first = PAGES.find((P) => !filters.every((f) => f && pageOf(f) !== P.key && pageOf(f) !== 'act1'));
let listing = await boot(env, first.opts);
const all = await listing.page.evaluate(async () => Object.entries((await import('/src/stories.js')).STORIES).map(([n, s]) => [n, s.phone ? ((s.act || 1) > 1 ? 'phone' + s.act : 'phone') : (s.act || 1) > 1 ? 'act' + s.act : 'act1']));
// one task per page (the page that listed the stories plays its own act's), then the two checks that need a page of their own
const tasks = PAGES.map((P) => [P, all.filter(([n, k]) => k === P.key && wants(n)).map(([n]) => n)]).filter(([, names]) => names.length)
  .map(([P, names]) => async (e) => {
    let got = listing && P === first ? listing : await boot(e, P.opts);
    if (got === listing) listing = null;
    const out = await playAll(got.page, got.errors, names);
    await got.page.close();
    return out;
  });
if (listing && !tasks.length) await listing.page.close();
if (wants('first-run/survives-a-reload')) tasks.push(firstRunReload);
if (MOBILE && wants('mobile/touch-controls')) tasks.push(touchControls);
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
    const r = await page.evaluate(async (n) => (await import('/src/stories.js')).runStory(n), name);
    const newErrors = errors.slice(before);
    out.push(result(r.ok && !newErrors.length, name, r.ms, newErrors.length ? { ...r.info, errors: newErrors } : r.info));
  }
  return out;
}
function result(good, ...a) { good ? passed++ : failed++; return text(good, ...a); }

// --- a player's first run survives a real reload, and ends for good once a run ends (first-run.js)
async function firstRunReload(e) {
  const { page, errors } = await boot(e, { viewport: { width: 1100, height: 650 }, newPlayer: true });
  const ready = () => page.waitForFunction(() => window.run && document.querySelector('#g-over .play') && !document.querySelector('#g-over .play').disabled, null, { timeout: 180000 });
  const out = { first: await page.evaluate(() => run.firstRun.active) };
  await gate(async () => { await page.reload(); await ready(); });
  out.afterReload = await page.evaluate(() => run.firstRun.active);
  await page.evaluate(() => run.die());
  await gate(async () => { await page.reload(); await ready(); });
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
  await ev(() => { run.spawnWaves = () => {}; run.hurt = () => {}; GAME.step(1 / 60); });
  out.startPick = await ev(() => menus.open);
  await page.tap('.jf-card');
  await step(3);
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
if (!failed && filters.join('') === '' && MOBILE) {
  try {
    const clean = !execSync('git status --porcelain', { cwd: ROOT }).toString().trim();
    if (clean) fs.writeFileSync(path.join(ROOT, 'tests/.last-green'), execSync('git rev-parse HEAD', { cwd: ROOT }).toString());
  } catch {}
}
process.exit(failed ? 1 : 0);
