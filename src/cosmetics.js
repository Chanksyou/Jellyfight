// Earned and bought cosmetics: which creator options a player has unlocked, and what a locked
// one asks for. The registry is plain data keyed by the same option ids the look
// descriptor uses (character.js OPTIONS), so an option means the same thing in the
// creator, in the saved look and in a leaderboard row: everything travels as the
// descriptor (normalizeLook in character.js), never as creator state. A look a
// player already wears stays valid if its option later becomes an award —
// normalizeLook never gates; only the creator gates changing to a locked option.
//
// Two kinds of locked option:
//  - golden awards (NEEDS), earned by feats and never sold: proof of what you did
//  - shop looks (PRICES), bought with Pearls, which every run that ends pays (pearlsFor)
//
// A requirement is an object over the player's feats: their lifetime totals in this browser
// (FEATS_KEY, kept by run.js as runs end and acts change), their best run (the same entry the
// leaderboard keeps, leaderboard.js BEST_KEY) and their Treasure book (collection.js):
//   { wins: 3 }            won this many runs (beat the last act's boss)
//   { runs: 25 }           played this many runs to the end
//   { kills: 1000 }        cleared this many bugs, all runs together
//   { elites: 10 }         beaten this many Elites, all runs together
//   { elite_kettle: 10 }   beaten this Elite kind this many times
//   { flawless: 1 }        beaten a boss without losing Health in the fight
//   { bestScore: 10000 }   a personal best of at least this
//   { bestLevel: 8 }       reached this level in a run
//   { bestKills: 100 }     this many kills in one run
//   { boss: 'vacuum' }     beaten this boss (a stage's boss kind)
//   { winAs: 'moon' }      won a run as this species
//   { book: 0.5 }          found this share of all Treasures
//   { allGold: true }      earned every other golden award
// Every key present must hold; no entry in NEEDS or PRICES = always unlocked.
//
// The awards and the shop's looks are their own items, so nothing a player could already pick gets
// locked. Making a cosmetic an award or a shop look is one line here; the item itself is built in
// character.js.
import { BEST_KEY } from './leaderboard.js';
import { found } from './collection.js';
import { CONTENT } from './content.js';
import { STAGES } from './stages.js';
import { SPECIES } from './character.js';

export const NEEDS = {
  top: {
    goldcrown: { wins: 1 }, laurel: { kills: 1000 }, goldantlers: { kills: 5000 },
    earmuffs: { boss: 'vacuum' }, duck: { boss: 'hair' }, sharkfin: { boss: 'shark' }, headset: { boss: 'encore' },
    goldbook: { book: 1 }, goldkettle: { elite_kettle: 10 }, tiara: { flawless: 1 },
    crown_nettle: { winAs: 'nettle' }, crown_moon: { winAs: 'moon' }, crown_lion: { winAs: 'lion' },
    crown_box: { winAs: 'box' }, crown_crystal: { winAs: 'crystal' }, crown_egg: { winAs: 'egg' },
  },
  eyes: { goldmask: { wins: 3 }, shades: { runs: 25 }, goldspecs: { book: 0.5 }, pixelshades: { elite_controller: 10 } },
  mouth: { goldtooth: { elites: 10 } },
  finish: { gilded: { allGold: true } },
};

// The shop: what each look costs in Pearls
export const PRICES = {
  top: { bottlecap: 60, thimble: 60, paperboat: 60, stickynote: 60, showercap: 150, shell: 150, starfish: 150, sock: 150, lampshade: 300, fishbowl: 300, coral: 300 },
  eyes: { googly: 60, hearts: 60, stars: 150, snorkel: 150, monocle: 150, glasses3d: 150 },
  mouth: { moustache: 60, tongue: 60, bubblegum: 150 },
  pattern: { rings: 100, stripes: 100, freckles: 100 },
};

// What a run pays in Pearls (run.js credits it as it goes: bugs and Elites as they fall, a boss when
// it's beaten, the rest as the run ends). Score never feeds it, so a hard run still pays.
export const PEARLS = { run: 5, bugs: 10, elite: 3, boss: 10, firstBoss: 25, win: 20 };   // bugs: one Pearl per this many cleared
export const pearlsFor = ({ kills = 0, elites = 0, bosses = 0, firstBosses = 0, ended = false, won = false }) =>
  Math.floor(kills / PEARLS.bugs) + elites * PEARLS.elite + bosses * PEARLS.boss + firstBosses * PEARLS.firstBoss + (ended ? PEARLS.run : 0) + (won ? PEARLS.win : 0);

export const FEATS_KEY = 'jellyfight.feats';
const ZERO = { runs: 0, wins: 0, kills: 0, elites: 0, flawless: 0 };

// lifetime totals in this browser
export function lifetime() {
  try { const f = JSON.parse(localStorage.getItem(FEATS_KEY)); return { ...ZERO, ...(f && typeof f === 'object' ? f : {}) }; } catch { return { ...ZERO }; }
}
// add to them (run.js: a run's bugs as it goes, an Elite beaten, a run ended or won)
export function addFeats(delta) {
  const f = lifetime();
  // the totals above, and per-kind counts: elite_<kind> (Elites beaten), won_<species> (runs won as it)
  for (const k of Object.keys(delta)) if (delta[k] > 0 && (k in ZERO || /^(elite|won)_\w+$/.test(k))) f[k] = (f[k] || 0) + delta[k];
  try { localStorage.setItem(FEATS_KEY, JSON.stringify(f)); } catch {}
  return f;
}

// The player's feats: lifetime totals, their best run and their Treasure book.
export function feats() {
  let b = null;
  try { b = JSON.parse(localStorage.getItem(BEST_KEY)) || null; } catch {}
  const L = lifetime(), book = found(), all = CONTENT.treasures.length;
  const f = {
    ...L, won: !!b?.won, bestScore: b?.score || 0, bestLevel: b?.level || 0, bestKills: b?.kills || 0,
    boss: Array.isArray(book.bosses) ? book.bosses : [],
    winAs: Object.keys(L).filter((k) => k.startsWith('won_') && L[k] > 0).map((k) => k.slice(4)),
    book: all ? CONTENT.treasures.filter((t) => book.treasures?.includes(t.id)).length / all : 0,
  };
  f.allGold = Object.entries(NEEDS).every(([key, ids]) => Object.entries(ids).every(([id, need]) => need.allGold || meets(need, f)));
  return f;
}

const meets = (need, f) => Object.entries(need).every(([k, v]) => (v === true ? !!f[k] : typeof v === 'string' ? (f[k] || []).includes(v) : (f[k] || 0) >= v));

export const requirement = (key, id) => NEEDS[key]?.[id] || null;
export const price = (key, id) => PRICES[key]?.[id] || 0;

// The Pearl bank: how many a player has and which shop looks they've bought ('key:id')
export const PEARLS_KEY = 'jellyfight.pearls';
export function bank() {
  try { const b = JSON.parse(localStorage.getItem(PEARLS_KEY)); if (b && typeof b === 'object') return { pearls: Math.max(0, b.pearls | 0), bought: Array.isArray(b.bought) ? b.bought : [] }; } catch {}
  return { pearls: 0, bought: [] };
}
const keepBank = (b) => { try { localStorage.setItem(PEARLS_KEY, JSON.stringify(b)); } catch {} return b; };
export const addPearls = (n) => { const b = bank(); if (n > 0) b.pearls += n | 0; return keepBank(b); };
// buy a shop look; false when it isn't for sale, is already yours or costs more than you have
export function buy(key, id) {
  const b = bank(), cost = price(key, id), k = `${key}:${id}`;
  if (!cost || b.bought.includes(k) || b.pearls < cost) return false;
  b.pearls -= cost; b.bought.push(k);
  keepBank(b);
  return true;
}

// f: feats (an award); bought: the bank's list (a shop look)
export function unlocked(key, id, f = null, bought = null) {
  const need = requirement(key, id);
  if (need) return meets(need, f || feats());
  if (price(key, id)) return (bought || bank().bought).includes(`${key}:${id}`);
  return true;
}

// every award unlocked with these feats, as 'key:id'
export const unlockedAwards = (f = feats()) => Object.entries(NEEDS).flatMap(([key, ids]) => Object.keys(ids).filter((id) => unlocked(key, id, f)).map((id) => `${key}:${id}`));

// The locked award a player is nearest to, by its least-done requirement, as { key, id, need },
// or null when all are earned (the death screen points at it)
export function nextAward(f = feats()) {
  let best = null, most = -1;
  for (const [key, ids] of Object.entries(NEEDS)) for (const [id, need] of Object.entries(ids)) {
    if (unlocked(key, id, f)) continue;
    const done = Math.min(...Object.entries(need).map(([k, v]) => (v === true || typeof v === 'string' ? +meets({ [k]: v }, f) : (f[k] || 0) / v)));
    if (done > most) { most = done; best = { key, id, need }; }
  }
  return best;
}

// What a locked option asks for, in words, for the creator (with how far along you are, given f)
export const requirementText = (need, f = null) => (need ? 'Earned: ' + needText(need, f) : '');
const theName = (n) => n.replace(/^The /, 'the ');
export function needText(need, f = null) {
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
    if (k === 'flawless') return 'beat a boss without losing Health';
    if (k === 'boss') return `beat ${theName(STAGES.find((s) => s.boss.kind === v)?.boss.name || v)}`;
    if (k === 'winAs') return `win a run as a ${SPECIES[v]?.name || v}`;
    if (k === 'book') return v >= 1 ? 'find every Treasure' : `find ${Math.round(v * 100)}% of all Treasures` + (f && 'book' in f ? ` (${Math.round(f.book * 100)}% so far)` : '');
    if (k === 'allGold') return 'earn every other golden award';
    if (k.startsWith('elite_')) return `beat ${theName(CONTENT.elites[k.slice(6)]?.name || k.slice(6))} ${v} times` + so(k, v);
    return k;
  });
  return parts.join(' and ');
}
