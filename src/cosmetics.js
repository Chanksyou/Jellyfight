// Earned cosmetics: which creator options a player has unlocked, and what a locked
// one asks for. The registry is plain data keyed by the same option ids the look
// descriptor uses (character.js OPTIONS), so an option means the same thing in the
// creator, in the saved look and in a leaderboard row: everything travels as the
// descriptor (normalizeLook in character.js), never as creator state. A look a
// player already wears stays valid if its option later becomes an award —
// normalizeLook never gates; only the creator gates changing to a locked option.
//
// A requirement is an object over the player's feats: their lifetime totals in this browser
// (FEATS_KEY, kept by run.js as runs end and acts change) and their best run (the same entry the
// leaderboard keeps, leaderboard.js BEST_KEY):
//   { wins: 3 }            won this many runs (beat the last act's boss)
//   { runs: 25 }           played this many runs to the end
//   { kills: 1000 }        cleared this many bugs, all runs together
//   { elites: 10 }         beaten this many Elites, all runs together
//   { bestScore: 10000 }   a personal best of at least this
//   { bestLevel: 8 }       reached this level in a run
//   { bestKills: 100 }     this many kills in one run
// Every key present must hold; no entry in NEEDS = always unlocked.
//
// The awards are their own items (golden ones), so nothing a player could already pick gets locked.
// Making a cosmetic an award is one line here; the item itself is built in character.js.
import { BEST_KEY } from './leaderboard.js';

export const NEEDS = {
  top: { goldcrown: { wins: 1 }, laurel: { kills: 1000 }, goldantlers: { kills: 5000 } },
  eyes: { goldmask: { wins: 3 }, shades: { runs: 25 } },
  mouth: { goldtooth: { elites: 10 } },
};

export const FEATS_KEY = 'jellyfight.feats';
const ZERO = { runs: 0, wins: 0, kills: 0, elites: 0 };

// lifetime totals in this browser
export function lifetime() {
  try { const f = JSON.parse(localStorage.getItem(FEATS_KEY)); return { ...ZERO, ...(f && typeof f === 'object' ? f : {}) }; } catch { return { ...ZERO }; }
}
// add to them (run.js: a run's bugs as it goes, an Elite beaten, a run ended or won)
export function addFeats(delta) {
  const f = lifetime();
  for (const k of Object.keys(ZERO)) if (delta[k] > 0) f[k] += delta[k];
  try { localStorage.setItem(FEATS_KEY, JSON.stringify(f)); } catch {}
  return f;
}

// The player's feats: lifetime totals and their best run.
export function feats() {
  let b = null;
  try { b = JSON.parse(localStorage.getItem(BEST_KEY)) || null; } catch {}
  return { ...lifetime(), won: !!b?.won, bestScore: b?.score || 0, bestLevel: b?.level || 0, bestKills: b?.kills || 0 };
}

export const requirement = (key, id) => NEEDS[key]?.[id] || null;

export function unlocked(key, id, f = feats()) {
  const need = requirement(key, id);
  if (!need) return true;
  return Object.entries(need).every(([k, v]) => (v === true ? !!f[k] : (f[k] || 0) >= v));
}

// every award unlocked with these feats, as 'key:id'
export const unlockedAwards = (f = feats()) => Object.entries(NEEDS).flatMap(([key, ids]) => Object.keys(ids).filter((id) => unlocked(key, id, f)).map((id) => `${key}:${id}`));

// What a locked option asks for, in words, for the creator (with how far along you are, given f)
export function requirementText(need, f = null) {
  if (!need) return '';
  const so = (k, v) => (f && typeof v === 'number' && v > 1 && k in f ? ` (${Number(f[k] || 0).toLocaleString()} so far)` : '');
  const parts = Object.entries(need).map(([k, v]) => {
    if (k === 'won') return 'win a run';
    if (k === 'wins') return (v === 1 ? 'win a run' : `win ${v} runs`) + so(k, v);
    if (k === 'runs') return `play ${v} runs` + so(k, v);
    if (k === 'kills') return `clear ${Number(v).toLocaleString()} bugs` + so(k, v);
    if (k === 'elites') return `beat ${v} Elites` + so(k, v);
    if (k === 'bestScore') return `a best of ${Number(v).toLocaleString()}`;
    if (k === 'bestLevel') return `reach level ${v}`;
    if (k === 'bestKills') return `${v} kills in a run`;
    return k;
  });
  return 'Earned: ' + parts.join(' and ');
}
