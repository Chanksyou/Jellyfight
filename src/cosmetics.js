// Earned cosmetics: which creator options a player has unlocked, and what a locked
// one asks for. The registry is plain data keyed by the same option ids the look
// descriptor uses (character.js OPTIONS), so an option means the same thing in the
// creator, in the saved look and in a leaderboard row: everything travels as the
// descriptor (normalizeLook in character.js), never as creator state. A look a
// player already wears stays valid if its option later becomes an award —
// normalizeLook never gates; only the creator gates changing to a locked option.
//
// A requirement is an object over the player's feats — their best run, the same
// entry shape the leaderboard keeps (leaderboard.js BEST_KEY):
//   { won: true }          won a run (the 🏆 on the board)
//   { bestScore: 10000 }   a personal best of at least this
//   { bestLevel: 8 }       reached this level in a run
//   { bestKills: 100 }     this many kills in one run
// Every key present must hold; no entry in NEEDS = always unlocked.
//
// Nothing is earned yet — this is the framework. Making a cosmetic an award is one
// line here, e.g.  top: { crown: { won: true } }.
import { BEST_KEY } from './leaderboard.js';

export const NEEDS = {};

// The player's feats, from the best run this browser remembers.
export function feats() {
  let b = null;
  try { b = JSON.parse(localStorage.getItem(BEST_KEY)) || null; } catch {}
  return { won: !!b?.won, bestScore: b?.score || 0, bestLevel: b?.level || 0, bestKills: b?.kills || 0 };
}

export const requirement = (key, id) => NEEDS[key]?.[id] || null;

export function unlocked(key, id, f = feats()) {
  const need = requirement(key, id);
  if (!need) return true;
  return Object.entries(need).every(([k, v]) => (v === true ? !!f[k] : (f[k] || 0) >= v));
}

// What a locked option asks for, in words, for the creator.
export function requirementText(need) {
  if (!need) return '';
  const parts = Object.entries(need).map(([k, v]) => {
    if (k === 'won') return 'win a run';
    if (k === 'bestScore') return `a best of ${Number(v).toLocaleString()}`;
    if (k === 'bestLevel') return `reach level ${v}`;
    if (k === 'bestKills') return `${v} kills in a run`;
    return k;
  });
  return 'Earned with ' + parts.join(' and ');
}
