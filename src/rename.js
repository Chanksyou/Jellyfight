// The game was called Jelly Fight, and its saves were kept under `jellyfight.*`. Before any
// module reads a save, move each one to `jellyrun.*` so returning players keep their best
// score, Pearls, Treasure book, looks and settings. A key already saved under the new name wins.
const OLD = 'jellyfight.', NEW = 'jellyrun.';

export function moveSaves(store) {
  for (const key of Object.keys(store)) {
    if (!key.startsWith(OLD)) continue;
    const to = NEW + key.slice(OLD.length);
    if (store.getItem(to) === null) store.setItem(to, store.getItem(key));
    store.removeItem(key);
  }
}

// The game's home moved from its old Cloudflare address to jellyrun.org. A browser keeps saves per
// address, so the old one hands them over: it opens jellyrun.org with every save in the link
// (#saves=…), and jellyrun.org keeps each one it doesn't already have.
export const HOME = 'https://jellyrun.org/';
const OLD_HOST = 'jelly-fight.nycjfc.workers.dev';

// where a page on this host should go instead (with its saves), or null to stay
export function forwardFor(host, store) {
  if (host !== OLD_HOST) return null;
  const saves = {};
  for (const key of Object.keys(store)) if (key.startsWith(NEW)) saves[key] = store.getItem(key);
  return HOME + '#saves=' + encodeURIComponent(JSON.stringify(saves));
}

// keep the saves a link brought (hash: '#saves=…'); true when it brought any
export function takeSaves(hash, store) {
  if (!hash.startsWith('#saves=')) return false;
  let saves = null;
  try { saves = JSON.parse(decodeURIComponent(hash.slice(7))); } catch {}
  if (!saves || typeof saves !== 'object') return false;
  for (const [key, v] of Object.entries(saves)) {
    if (key.startsWith(NEW) && typeof v === 'string' && store.getItem(key) === null) store.setItem(key, v);
  }
  return true;
}

try { moveSaves(localStorage); } catch {}
try { moveSaves(sessionStorage); } catch {}
let away = null;
try { away = forwardFor(location.hostname, localStorage); } catch {}
if (away) {
  location.replace(away);
  await new Promise(() => {});   // the game doesn't start here: it's on its way to jellyrun.org
}
try { if (takeSaves(location.hash, localStorage)) history.replaceState(null, '', location.pathname + location.search); } catch {}
