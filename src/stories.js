// Stories: named situations in the real game, the same idea as Storybook. Each one sets the
// game up (`setup`) and can then be watched live, or played out headlessly by `play`, which
// steps the game and returns { ok, info }: what should have happened, and whether it did.
//
//   index.html?story=elites/kettle-steam   open one story and watch it (phone or desktop)
//   index.html?stories                      list every story, tap one to open it
//   node tests/run.mjs [filter]             play every story headlessly (see tests/run.mjs)
//
// When you add a behaviour, add a story that proves it. When a story breaks, the game did.

import { currentAct, currentScene, goToAct } from './stages.js';
import { G, STORIES, restore, stillMismatch } from './stories/kit.js';
import { DEFAULT_SEED, seededRandom, seedFor } from './story-random.mjs';
import './stories/traversal.js';
import './stories/camera.js';
import './stories/treasures-in-room.js';
import './stories/first-run.js';
import './stories/easy.js';
import './stories/achievements.js';
import './stories/board.js';
import './stories/movement-bubbles-progression.js';
import './stories/words.js';
import './stories/bug-collision.js';
import './stories/bug-nav.js';
import './stories/bug-steering.js';
import './stories/attack-gap.js';
import './stories/bug-facing.js';
import './stories/bug-rhythm.js';
import './stories/bug-ants.js';
import './stories/bug-attack-motion.js';
import './stories/runtime-efficiency.js';
import './stories/treasures.js';
import './stories/spin.js';
import './stories/type-words.js';
import './stories/treasure-feel.js';
import './stories/treasure-feel-more.js';
import './stories/treasure-feel-twelve.js';
import './stories/buff-looks.js';
import './stories/treasure-glow.js';
import './stories/treasure-bursts.js';
import './stories/treasure-companions.js';
import './stories/treasure-legends.js';
import './stories/treasure-house.js';
import './stories/arena4.js';
import './stories/encore.js';
import './stories/fire.js';
import './stories/sound.js';
import './stories/elite-sounds-act1.js';
import './stories/elite-sounds-act2.js';
import './stories/damage-numbers.js';
import './stories/death-remains.js';
import './stories/hud-health.js';
import './stories/wind.js';
import './stories/evolutions.js';
import './stories/shield.js';
import './stories/rebound-mirage.js';
import './stories/fire-trail.js';
import './stories/tether.js';
import './stories/wake.js';
import './stories/looks.js';
import './stories/bell-flex.js';
import './stories/motion.js';
import './stories/tentacle-motion.js';
import './stories/feel-reveal.js';
import './stories/xp-feel.js';
import './stories/elites.js';
import './stories/elite-platforms.js';
import './stories/elite-room.js';
import './stories/events-boss.js';
import './stories/main-screen-modes-engine.js';
import './stories/layout-editor.js';
import './stories/main-menu.js';
import './stories/come-back.js';
import './stories/payoff.js';
import './stories/score.js';
import './stories/act2.js';
import './stories/act2-bosses.js';
import './stories/every-attack.js';
import './stories/attack-audit.js';
import './stories/readability.js';
import './stories/act3.js';
import './stories/act3-croc.js';
import './stories/act3-bull.js';
import './stories/act3-coffer.js';
import './stories/act4.js';
import './stories/night4.js';
import './stories/vents.js';
import './stories/living-room.js';
import './stories/butterfly.js';
import './stories/firefly.js';
import './stories/night4-singing-bowl.js';
import './stories/night4-mushroom.js';
import './stories/night4-headphones.js';
import './stories/sunrise.js';
import './stories/shadow-light.js';
import './stories/dressing.js';
import './stories/act4-perf.js';
import './stories/bench.js';
import './stories/overdraw.js';
import './stories/phone.js';
import './stories/nests.js';
import './stories/types.js';
import './stories/ice.js';
import './stories/lightning.js';
import './stories/legendaries.js';
import './stories/upgrades.js';
import './stories/poison.js';
import './stories/glitter.js';
import './stories/normal.js';
import './stories/wind-type.js';
import './stories/unlocks.js';
import './stories/ui.js';
import './stories/props.js';
import './stories/ambient.js';
import './stories/mist.js';
export { STORIES, fresh, tp } from './stories/kit.js';

// Headless: play one story, return { name, ok, info, ms } (errors fail the story). A story's play()
// may be async (one that waits for a download).
export async function runStory(name, baseSeed = DEFAULT_SEED) {
  const s = STORIES[name];
  const random = Math.random, seed = seedFor(name, baseSeed);
  Math.random = seededRandom(seed);
  const t0 = performance.now();
  try {
    s.setup();
    const r = await s.play();
    const moved = stillMismatch();   // a furniture mover that skipped markMoved (static-batch.js)
    if (moved) return { name, seed, ok: false, info: { ...r.info, movedWithoutMarkMoved: moved }, ms: Math.round(performance.now() - t0) };
    return { name, seed, ok: r.ok, info: r.info, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    return { name, seed, ok: false, info: { error: String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') }, ms: Math.round(performance.now() - t0) };
  } finally {
    restore();
    Math.random = random;
    G().input.keys = new Set();
  }
}

// Live: set the story up and let the game run it in real time (index.html?story=name)

export function mount(name) {
  const s = STORIES[name];
  if (!s) return list(`No story called "${name}".`);
  if ((s.act || 1) !== currentAct() || (s.scene || 1) !== currentScene()) return goToAct(s.act || 1, null, null, s.scene || 1);   // it plays in another act (or scene): reload into it
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
