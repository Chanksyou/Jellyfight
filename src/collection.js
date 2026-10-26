// The Treasure book: every Treasure and evolution a player has picked and every Elite and boss they've
// beaten, across all their runs in this browser (FOUND_KEY), as lists of ids per kind. run.js notes a
// find as it happens (never in a dev run); the main menu's 📖 Treasure book shows found and unfound.
export const FOUND_KEY = 'jellyfight.found';
export const KINDS = ['treasures', 'evolutions', 'elites', 'bosses'];

export function found() {
  try { const f = JSON.parse(localStorage.getItem(FOUND_KEY)); return f && typeof f === 'object' ? f : {}; } catch { return {}; }
}

export const isFound = (kind, id, f = found()) => Array.isArray(f[kind]) && f[kind].includes(id);

// note a find; true when it's the first time
export function discover(kind, id) {
  const f = found();
  if (isFound(kind, id, f)) return false;
  f[kind] = [...(Array.isArray(f[kind]) ? f[kind] : []), id];
  try { localStorage.setItem(FOUND_KEY, JSON.stringify(f)); } catch {}
  return true;
}
