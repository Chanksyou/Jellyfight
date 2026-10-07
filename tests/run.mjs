// Plays every story (src/stories.js) headlessly in the real game, plus a phone check, and
// fails if any story fails or the page logs an error.
//
//   node tests/run.mjs                 everything
//   node tests/run.mjs elites          only stories whose name contains "elites"
//   node tests/run.mjs --no-mobile     skip the phone check
//
// Needs Playwright (cd tests && npm install && npx playwright install chromium).
// If the machine can't reach the three.js CDN, point JF_THREE at an unpacked three@0.186.1
// npm package and its files are served from there instead.
import { start, openGame } from './lib.mjs';

const args = process.argv.slice(2);
const filter = args.find((a) => !a.startsWith('--')) || '';
const MOBILE = !args.includes('--no-mobile');

const env = await start();
let failed = 0, passed = 0;
const line = (good, name, ms, info) => console.log(`${good ? '✓' : '✗'} ${name}${ms != null ? `  (${ms} ms)` : ''}${good ? '' : '\n    ' + JSON.stringify(info)}`);

// --- every story, one page per act (booting the apartment takes a while, so a page only opens
// when it has a story to play). Later acts start as if the act before was just beaten, carrying a
// level-6 run with a Candle; stories with `phone: true` (phone/...) play in a page that looks
// like a phone. The first page that opens lists every story for the rest.
const CARRY = { score: 5000, level: 6, xp: 0, purse: 4, stats: { health: 130 }, owned: [['candle', 1]], grown: 0, growCount: 0 };
const PAGES = [
  { key: 'act1', opts: { viewport: { width: 1100, height: 650 } } },
  { key: 'act2', opts: { viewport: { width: 1100, height: 650 }, act: { act: 2, carry: CARRY } } },
  { key: 'phone', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } },
];
const pageOf = (n) => (n.startsWith('phone/') ? 'phone' : n.startsWith('act2/') ? 'act2' : 'act1');
let all = null;   // [name, page key] for every story, once a page has listed them
for (const P of PAGES) {
  // before the list exists, only the act a filter like "act2/" or "phone/" names is worth booting
  if (!all && filter && pageOf(filter) !== P.key && pageOf(filter) !== 'act1') continue;
  if (all && !all.some(([n, k]) => k === P.key && n.includes(filter))) continue;
  const { page, errors } = await openGame(env, P.opts);
  // stories step and draw the game themselves; the game's own frame loop running between them
  // only adds slow software-rendered frames (seconds each) and timing noise
  await page.evaluate(() => APT.renderer.setAnimationLoop(null));
  all ||= await page.evaluate(async () => Object.entries((await import('/src/stories.js')).STORIES).map(([n, s]) => [n, s.phone ? 'phone' : (s.act || 1) > 1 ? 'act' + s.act : 'act1']));
  await playAll(page, errors, all.filter(([n, k]) => k === P.key && n.includes(filter)).map(([n]) => n));
  await page.close();
}

async function playAll(page, errors, names) {
  for (const name of names) {
    const before = errors.length;
    const r = await page.evaluate(async (n) => (await import('/src/stories.js')).runStory(n), name);
    const newErrors = errors.slice(before);
    const good = r.ok && !newErrors.length;
    line(good, name, r.ms, newErrors.length ? { ...r.info, errors: newErrors } : r.info);
    good ? passed++ : failed++;
  }
}

// --- on a phone: tap Play, pick a starting treasure, swim with the joystick, jump
if (MOBILE && (!filter || 'mobile'.includes(filter))) {
  const { page, errors } = await openGame(env, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
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
  line(good, 'mobile/touch-controls', null, { ...out, errors });
  good ? passed++ : failed++;
  await page.close();
}

await env.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
