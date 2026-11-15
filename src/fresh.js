// Is the code this page runs the version the server has now? Content files (content/*.kdl) come
// fresh off the CDN on every load, but a phone can keep running the last version's code (Safari
// holding on to cached modules across the act reload, or a page that loaded mid-deploy). Old code
// reading new content crashes every frame: on Nov 15 an iPhone's elites.js still asked for the
// Soap's `squirt` the day after content renamed it `trap`. The server's src/main.js is the truth
// (its BUILD is what the build bot numbers), asked past every cache while the rest of the page loads.
import { nav } from './stages.js';

// room to remember every file the page loads, so a stale page can name what to fetch again
try { performance.setResourceTimingBufferSize(2000); } catch {}

const TRIED = 'jellyrun.freshReload';
export const BUILD_RE = /const BUILD = '(v\d+)';/;
export const serverBuild = () => fetch('./src/main.js', { cache: 'no-store' })
  .then((r) => (r.ok ? r.text() : '')).then((t) => BUILD_RE.exec(t)?.[1] || null).catch(() => null);

// When the running BUILD isn't the server's: fetch every game file this page loaded past the cache
// (so the cache now holds the new ones) and reload, once per tab per version; if the reload still
// runs old code, play on rather than loop. Resolves true when it's reloading.
export async function reloadIfStale(asked, running = window.JF_BUILD) {
  const now = await asked;
  if (!now || !running || now === running) return false;
  try { if (sessionStorage.getItem(TRIED) === now) return false; sessionStorage.setItem(TRIED, now); } catch { return false; }
  const ours = performance.getEntriesByType('resource').map((r) => r.name)
    .filter((u) => u.startsWith(location.origin) && /\/(src|vendor|content)\/[^?#]*\.(js|kdl|css)$/.test(u));
  await Promise.all(ours.map((u) => fetch(u, { cache: 'reload' }).catch(() => {})));
  nav.reload();
  return true;
}
