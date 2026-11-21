// Screenshots of the jelly type pick screen's pictures, on a phone held sideways (844x390) and a
// desktop (1280x720, and --wide: 2000x1000): every type as the live centre card (once its shaders
// are built) and as a side card (pick-aura.js; shot in the centre, with the live picture off), each as its own shot plus one contact sheet a page
// size. The before/after pictures for the pick screen's effects (/mnt/project-files/jelly-fx/).
//
//   node tools/pick-shots.mjs                     every type, phone and desktop, into .wrangler/pick-shots
//   node tools/pick-shots.mjs --only=fire,ice     just those types
//   node tools/pick-shots.mjs --phone | --desktop | --wide    one size
//   node tools/pick-shots.mjs --side              side cards only (skips the slow live centre card)
//   node tools/pick-shots.mjs --out=DIR           somewhere else
//   node tools/pick-shots.mjs --color=#f2f2f2     the player's jelly that colour (a pale look, say)
//   node tools/pick-shots.mjs --low | --calm       on Low graphics | with Reduce effects on (the cards' one still frame)
//
// Uses the test runner's Playwright and three.js (tests/lib.mjs). In a software renderer the first
// picture of each kind takes a while (its shaders build): give it a few minutes.
import fs from 'node:fs';
import path from 'node:path';
import { start, openGame, ROOT } from '../tests/lib.mjs';

const args = process.argv.slice(2), arg = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const only = arg('only')?.split(',').filter(Boolean);
const sideOnly = args.includes('--side'), color = arg('color'), low = args.includes('--low'), calm = args.includes('--calm');
const out = path.resolve(arg('out') || path.join(ROOT, '.wrangler/pick-shots'));
const SIZES = [
  { name: 'phone', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } },
  { name: 'desktop', opts: { viewport: { width: 1280, height: 720 } } },
  { name: 'wide', opts: { viewport: { width: 2000, height: 1000 } } },
];
const picked = SIZES.filter((d) => args.includes('--' + d.name));
const DEVICES = picked.length ? picked : SIZES.slice(0, 2);
fs.mkdirSync(out, { recursive: true });

const env = await start();
try {
  for (const device of DEVICES) {
    const { page, errors } = await openGame(env, device.opts);
    await page.evaluate(() => APT.renderer.setAnimationLoop(null));   // only the pick screen draws
    const ids = await page.evaluate(async ({ color, low, calm }) => {
      const { asPlayer, fresh, G } = await import('/src/stories/kit.js');
      asPlayer(true);   // every type open
      fresh({ types: 'normal' });
      const gfx = G().gfx;
      if (low && gfx.quality !== 'low') { gfx.setQuality('low'); await gfx.ready; }
      if (calm) window.picker.calm = () => true;
      window.mainMenu.home = true; window.picker.close();
      if (color) { const P = window.picker, own = P.look; P.look = () => ({ ...own(), color }); }
      window.GAME.startRun();
      return window.picker.ids;
    }, { color, low, calm });
    const unknown = (only || []).filter((n) => !ids.includes(n));
    if (unknown.length) throw new Error(`no type called ${unknown.join(', ')} (have: ${ids.join(', ')})`);
    const shots = [];
    for (const id of ids) {
      if (only && !only.includes(id)) continue;
      for (const as of sideOnly ? ['side'] : ['side', 'centre']) {
        // a side card's picture: the card brought to the centre (where it shows whole) with the live
        // picture off, so it shows what it shows at the side
        const at = await page.evaluate(({ id, as }) => {
          const P = window.picker, i = P.ids.indexOf(id), c = i;
          if (P.live) { P.stopLive(); P.liveSaved = P.live; }
          P.live = as === 'side' ? null : P.liveSaved;
          P.go(c); P.pos = P.target; P.vel = 0; P.place(); P.auraAt = -1;
          return i;
        }, { id, as });
        await page.waitForFunction(({ at, as }) => {
          const P = window.picker, card = P.cards[at], aura = P.auras[at];
          if (as === 'side') return !P.painter?.has(aura.dataset.aura) || aura.classList.contains('lit');
          const live = P.live; return live && live.built.get(P.centre) && !live.canvas.hidden && card.querySelector('.tp-live');
        }, { at, as }, { timeout: 600000, polling: 500 });
        await page.waitForTimeout(as === 'centre' ? 2500 : 900);   // a moment of the attack or the element
        const file = path.join(out, `${device.name}-${id}-${as}.png`);
        await page.locator('#type-pick .tp-art').nth(at).screenshot({ path: file, timeout: 120000 });
        shots.push({ id, as, file });
        console.log('✓ ' + path.relative(process.cwd(), file));
      }
    }
    // the contact sheet: a row a type, side card then centre card
    const sheet = await env.browser.newPage({ viewport: { width: 1200, height: 400 } });
    const cells = shots.map((s) => `<figure><img src="data:image/png;base64,${fs.readFileSync(s.file).toString('base64')}"><figcaption>${s.id} · ${s.as}</figcaption></figure>`).join('');
    await sheet.setContent(`<body style="margin:0;background:#0b1622;color:#cfe;font:14px sans-serif"><main style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:8px">${cells}</main>
      <style>figure{margin:0}img{width:100%;display:block;border-radius:6px}figcaption{padding:2px 4px}</style></body>`);
    const file = path.join(out, `${device.name}-sheet.png`);
    await sheet.screenshot({ path: file, fullPage: true });
    await sheet.close();
    console.log('✓ ' + path.relative(process.cwd(), file));
    if (errors.length) console.log(`  ${device.name} page errors:\n    ` + errors.slice(0, 5).join('\n    '));
    await page.close();
  }
} finally {
  await env.close();
}
