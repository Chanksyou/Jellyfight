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

try { moveSaves(localStorage); } catch {}
try { moveSaves(sessionStorage); } catch {}
