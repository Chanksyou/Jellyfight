// Screenshots of every screen, on a phone held sideways (844x390) and a desktop (1280x720): the
// before/after pictures for UI work. The screens are the ones the UI guard stories measure
// (SCREENS in src/stories/ui.js), opened the way the game opens them, plus `kit` (every piece of
// src/ui-kit.css on one sheet, a shot per screenful, and `kit-sheet`, its sheet open).
//
//   node tools/ui-shots.mjs                          every screen, both sizes, into .wrangler/ui-shots
//   node tools/ui-shots.mjs --only=book,title        just those screens
//   node tools/ui-shots.mjs --phone | --desktop      one size
//   node tools/ui-shots.mjs --out=DIR                somewhere else
//   node tools/ui-shots.mjs --large                  with Settings' Large text (files end -large)
//
// Uses the test runner's Playwright and three.js (tests/lib.mjs: tests/.three when the CDN is blocked).
import fs from 'node:fs';
import path from 'node:path';
import { start, openGame, ROOT } from '../tests/lib.mjs';

const args = process.argv.slice(2), arg = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const only = arg('only')?.split(',').filter(Boolean);
const large = args.includes('--large');
const out = path.resolve(arg('out') || path.join(ROOT, '.wrangler/ui-shots'));
const DEVICES = [
  { name: 'phone', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } },
  { name: 'desktop', opts: { viewport: { width: 1280, height: 720 } } },
].filter((d) => !args.includes('--phone') && !args.includes('--desktop') || args.includes('--' + d.name));
fs.mkdirSync(out, { recursive: true });

const env = await start();
try {
  for (const device of DEVICES) {
    const { page, errors } = await openGame(env, device.opts);
    await page.evaluate(() => APT.renderer.setAnimationLoop(null));   // drawn by stepping the game, like the stories
    const names = await page.evaluate(async () => ['kit', 'kit-sheet', ...Object.keys((await import('/src/stories/ui.js')).SCREENS)]);
    const unknown = (only || []).filter((n) => !names.includes(n));
    if (unknown.length) throw new Error(`no screen called ${unknown.join(', ')} (have: ${names.join(', ')})`);
    for (const [i, screen] of names.entries()) {
      if (only && !only.includes(screen)) continue;
      const shown = await page.evaluate(async ({ screen, phone, large }) => {
        document.documentElement.dataset.textSize = large ? 'large' : 'normal';
        const { fresh, step, tp } = await import('/src/stories/kit.js'), ui = await import('/src/stories/ui.js');
        const s = screen.startsWith('kit') ? { open() { this.el = ui.kitSheet(); if (screen === 'kit-sheet') this.el.querySelector('[data-kit=sheet-open]').click(); }, close() { this.el.remove(); } } : ui.SCREENS[screen];
        if (s.phone && !phone) return false;
        fresh({ elites: false, bubbles: false, lash: false });
        if (!screen.startsWith('kit')) tp(3.2, 0.05, 3.0);   // in the room, so the 3D behind the screen is worth looking at
        step(30);                                         // the jelly settles and the HUD fills in
        s.open();
        step(30);                                         // the screen's own entrance plays out
        await document.fonts.ready;
        window.GAME.render();                             // the loop is stopped: draw the frame the shot will show
        window.__shotClose = () => { try { s.close(); } finally { step(1); } };
        return true;
      }, { screen, phone: device.name === 'phone', large });
      if (!shown) continue;
      // the kit sheet scrolls: a shot per screenful
      for (let part = 1, more = true; more; part++) {
        const file = path.join(out, `${device.name}-${String(i).padStart(2, '0')}-${screen}${part > 1 ? '-' + part : ''}${large ? '-large' : ''}.jpg`);
        await page.waitForTimeout(400);                   // CSS transitions run on real time
        await page.screenshot({ path: file, type: 'jpeg', quality: 82, timeout: 120000 });
        console.log('✓ ' + path.relative(process.cwd(), file));
        more = screen === 'kit' && await page.evaluate(() => {
          const el = document.getElementById('ui-kit-sheet'), top = el.scrollTop;
          el.scrollTop += el.clientHeight - 40;
          return el.scrollTop > top;
        });
      }
      await page.evaluate(() => window.__shotClose());
    }
    if (errors.length) console.log(`  ${device.name} page errors:\n    ` + errors.slice(0, 5).join('\n    '));
    await page.close();
  }
} finally {
  await env.close();
}
