// Stories: named situations in the real game, the same idea as Storybook. Each one sets the
// game up (`setup`) and can then be watched live, or played out headlessly by `play`, which
// steps the game and returns { ok, info }: what should have happened, and whether it did.
//
//   index.html?story=elites/kettle-steam   open one story and watch it (phone or desktop)
//   index.html?stories                      list every story, tap one to open it
//   node tests/run.mjs [filter]             play every story headlessly (see tests/run.mjs)
//
// When you add a behaviour, add a story that proves it. When a story breaks, the game did.

import { currentAct, goToAct } from './stages.js';
import { G, STORIES, restore } from './stories/kit.js';
import './stories/traversal.js';
import './stories/camera.js';
import './stories/treasures-in-room.js';
import './stories/first-run.js';
import './stories/movement-bubbles-progression.js';
import './stories/words.js';
import './stories/treasures.js';
import './stories/fire.js';
import './stories/damage-numbers.js';
import './stories/hud-health.js';
import './stories/wind.js';
import './stories/evolutions.js';
import './stories/energy-shield.js';
import './stories/elites.js';
import './stories/events-boss.js';
import './stories/main-screen-modes-engine.js';
import './stories/main-menu.js';
import './stories/act2.js';
import './stories/act2-bosses.js';
import './stories/every-attack.js';
import './stories/attack-audit.js';
import './stories/act3.js';
import './stories/act3-croc.js';
import './stories/act3-bull.js';
import './stories/act3-coffer.js';
import './stories/phone.js';
import './stories/nests.js';
export { STORIES, fresh, tp } from './stories/kit.js';

// Headless: play one story, return { name, ok, info, ms } (errors fail the story). A story's play()
// may be async (one that waits for a download).
export async function runStory(name) {
  const s = STORIES[name];
  const t0 = performance.now();
  try {
    s.setup();
    const r = await s.play();
    return { name, ok: r.ok, info: r.info, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    return { name, ok: false, info: { error: String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') }, ms: Math.round(performance.now() - t0) };
  } finally {
    restore();
    G().input.keys = new Set();
  }
}

// Live: set the story up and let the game run it in real time (index.html?story=name)

export function mount(name) {
  const s = STORIES[name];
  if (!s) return list(`No story called "${name}".`);
  if ((s.act || 1) !== currentAct()) return goToAct(s.act || 1);   // it plays in another act: reload into it
  s.setup();
  document.getElementById('g-over').hidden = true;
  const tag = document.createElement('div');
  tag.style.cssText = 'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:30;max-width:90vw;padding:8px 12px;border-radius:10px;background:#000a;color:#fff;font:13px system-ui;text-align:center;pointer-events:none';
  tag.innerHTML = `<b>${name}</b><br>${s.about}`;
  document.body.appendChild(tag);
}

// index.html?stories: every story as a link
export function list(note = '') {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:60;overflow:auto;padding:20px;background:#0d1020f0;color:#fff;font:14px system-ui';
  const groups = {};
  for (const [name, s] of Object.entries(STORIES)) (groups[name.split('/')[0]] ||= []).push([name, s]);
  el.innerHTML = `<h2 style="margin:0 0 6px">Stories</h2><p style="opacity:.7;margin:0 0 14px">${note || 'Tap one to watch it in the real game.'}</p>` +
    Object.entries(groups).map(([g, items]) => `<h3 style="margin:14px 0 6px;text-transform:capitalize">${g}</h3>` +
      items.map(([n, s]) => `<a href="?story=${encodeURIComponent(n)}" style="display:block;color:#9fe2ff;padding:5px 0">${n.split('/')[1]}<br><span style="color:#fff9;font-size:12px">${s.about}</span></a>`).join('')).join('');
  document.body.appendChild(el);
}
