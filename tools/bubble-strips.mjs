// Frame strips of the plain bubble's motion (src/bubbles.js): a launch, a hit, a miss, a Pop Chain and a Bubble
// Trap, each a row of frames a few ticks of the game apart, cropped round the bubble, on a phone held sideways
// (844x390 at 2x) and a desktop (1280x720). Looks only: a software renderer, never a frame rate.
//
//   node tools/bubble-strips.mjs                  every strip, phone and desktop, into .wrangler/bubble-strips
//   node tools/bubble-strips.mjs --strip=launch   one of launch|hit|miss|chain|trap
//   --phone | --desktop | --out=DIR | --calm (Reduce effects on)
//
// Each strip is played twice: a dry run finds the frame of the event (the hit, the pop, the trap bursting), then
// the same scene is played again, shooting at frames counted from it (its bubbles' bob is fixed, so it repeats).
import fs from 'node:fs';
import path from 'node:path';
import { start, openGame, ROOT } from '../tests/lib.mjs';

const args = process.argv.slice(2), arg = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const out = path.resolve(arg('out') || path.join(ROOT, '.wrangler/bubble-strips'));
const modes = arg('strip') ? [arg('strip')] : ['launch', 'hit', 'miss', 'chain', 'trap'];
const calm = args.includes('--calm');
const SIZES = [
  { name: 'phone', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  { name: 'desktop', opts: { viewport: { width: 1280, height: 720 } } },
];
const picked = SIZES.filter((d) => args.includes('--' + d.name));
const SPOT = [2.4, 0.05, 2.6, Math.PI * 0.8];   // act 1's open floor
fs.mkdirSync(out, { recursive: true });

// per strip: frames to shoot, counted from the first (launch) or from the event; and how many metres wide to look
const PLAN = {
  launch: { at: [2, 4, 6, 8, 10, 14], from: 'start', span: 0.15 },
  hit: { at: [-3, -1, 0, 1, 2, 4, 7], from: 'event', span: 0.1 },
  miss: { at: [-1, 0, 1, 2, 3, 5], from: 'event', span: 0.1 },
  chain: { at: [-1, 0, 1, 2, 4, 7], from: 'event', span: 0.14 },
  trap: { at: [2, 10, 22, -1, 1, 3, 6], from: 'event', span: 0.09 },
};

const env = await start();
try {
  for (const device of picked.length ? picked : SIZES) {
    const { page, errors } = await openGame(env, { ...device.opts, act: { act: 1 } });
    await page.evaluate(async () => { APT.renderer.setAnimationLoop(null); gfx.setQuality('medium'); await gfx.ready; });
    for (const mode of modes) {
      const plan = PLAN[mode];
      // build the scene in the page; `window.__s.next()` plays a frame and says whether the event has happened
      const build = () => page.evaluate(async ([v, mode, calm]) => {
        const { fresh, tp, step, spawn, stub, V } = await import('/src/stories/kit.js');
        const { juice } = await import('/src/juice.js');
        fresh({ elites: false, lash: false });
        juice.calm = calm;
        for (const el of document.body.children) if (el.tagName !== 'CANVAS') el.style.visibility = 'hidden';
        tp(v[0], v[1], v[2], v[3]);
        step(30);
        const B = run.bubbles, cam = APT.camera;
        stub(B, 'volley', () => false);
        const fwd = cam.getWorldDirection(V(0, 0, 0)).setY(0).normalize(), side = V(-fwd.z, 0, fwd.x);
        const bell = player.position.clone().setY(player.position.y + run.cfg.height * 0.75);
        const at = (d, s = 0) => bell.clone().addScaledVector(fwd, d).addScaledVector(side, s);
        const roach = (p) => { const e = spawn('roach', p, { still: true, hp: 9999 }); e.pos.y = p.y - e.r; return e; };
        const o = { size: run.S.bubbleSize, dmg: 1, pierce: 1 };
        const S = window.__s = { f: 0, ev: null, look: at(0.1), side, calm };
        if (mode === 'launch') {
          S.b = B.blow(bell, roach(at(0.7)), o); S.look = at(0.075);
          S.next = () => null;
        } else if (mode === 'hit') {
          const e = roach(at(0.13)); S.b = B.blow(bell, e, o); S.b.wobble = 0; S.look = at(0.11);
          S.next = () => (S.b.done ? true : null);
        } else if (mode === 'miss') {
          S.b = B.blow(bell, null, { ...o, dir: fwd }); S.b.wobble = 0; S.look = at(0.1);
          S.next = () => { if (S.f === 14) { B.pop(S.b, null, run.S, run.mods); return true; } return null; };
        } else if (mode === 'chain') {
          const mk = (x) => { const b = B.blow(at(0.15, x), null, { ...o, dir: fwd, speed: 0.001 }); b.wobble = 0; return b; };
          const row = [mk(-0.03), mk(0), mk(0.03)];
          run.mods.popChain = { range: 0.04, dmg: 0.5 };
          S.look = at(0.15); S.row = row; S.e = roach(at(0.15, -0.045));
          S.next = () => { if (S.f === 12) { B.pop(row[0], S.e, run.S, run.mods); return true; } return null; };
        } else if (mode === 'trap') {
          const e = roach(at(0.12)); S.look = at(0.12);
          B.trapBug(e, 0.5);
          S.next = () => (B.traps.length ? null : true);
        }
        S.tick = () => { step(1); S.f++; const r = S.next(); if (r && S.ev === null) S.ev = S.f - (mode === 'trap' ? 0 : 0); return S.ev; };
      }, [SPOT, mode, calm]);
      const tick = () => page.evaluate(() => window.__s.tick());
      let ev = null;
      if (plan.from === 'event') {
        await build();
        for (let i = 0; i < 200 && ev === null; i++) ev = await tick();
        if (ev === null) { console.log(`${mode}: no event`); continue; }
      }
      await build();
      const wanted = plan.at.map((a) => (plan.from === 'event' ? ev + a : a));
      const shots = [];
      for (let f = 1; f <= Math.max(...wanted); f++) {
        await tick();
        if (!wanted.includes(f)) continue;
        // the crop: `span` metres round where to look, square, in CSS pixels
        const clip = await page.evaluate((span) => {
          const S = window.__s, cam = APT.camera, c = document.querySelector('canvas').getBoundingClientRect();
          const p = S.look.clone().project(cam), q = S.look.clone().addScaledVector(S.side, 0.1).project(cam);
          const ppm = Math.abs(q.x - p.x) / 2 * c.width / 0.1, w = Math.min(span * ppm, c.height, c.width);
          const cx = (p.x + 1) / 2 * c.width, cy = (1 - p.y) / 2 * c.height;
          window.GAME.render();
          return { x: Math.max(0, Math.min(c.width - w, cx - w / 2)), y: Math.max(0, Math.min(c.height - w, cy - w / 2)), width: w, height: w };
        }, plan.span);
        await page.waitForTimeout(60);
        shots.push((await page.screenshot({ type: 'jpeg', quality: 90, clip, timeout: 180000 })).toString('base64'));
      }
      const joined = await page.evaluate(async ([shots, labels]) => {
        const imgs = await Promise.all(shots.map((s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/jpeg;base64,' + s; })));
        const Z = 300, c = document.createElement('canvas'); c.width = (Z + 4) * imgs.length; c.height = Z;
        const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
        x.font = '14px sans-serif';
        imgs.forEach((img, i) => { x.drawImage(img, i * (Z + 4), 0, Z, Z); x.fillStyle = '#fff'; x.fillText(labels[i], i * (Z + 4) + 8, 20); });
        return c.toDataURL('image/jpeg', 0.92).split(',')[1];
      }, [shots, plan.at.map((a) => (plan.from === 'event' ? (a < 0 ? `event ${a}` : `event +${a}`) : `frame ${a}`))]);
      const name = `${mode}-${device.name}${calm ? '-calm' : ''}`;
      fs.writeFileSync(path.join(out, `${name}.jpg`), Buffer.from(joined, 'base64'));
      console.log(name, plan.from === 'event' ? `(event at frame ${ev})` : '');
    }
    if (errors.length) console.log(errors.slice(0, 5).join('\n'));
    await page.close();
  }
} finally { await env.close(); }
