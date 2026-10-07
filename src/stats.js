// The jelly's stats, level-up cards, treasures and evolution choices.
// Everything a player reads is here, so tuning lives in one place.
import { CONTENT } from './content.js';

export const BASE_STATS = {
  // Bubbles: the main attack, ranged. Level-up cards improve these.
  bubbles: 1,         // bubbles blown side by side at once, flying parallel; each extra one costs damage (BUBBLE_PENALTY)
  range: 0.3,         // meters a bubble flies before it pops on its own
  bubbleDamage: 6,    // damage when a bubble pops on an enemy (a slower stream, each bubble hits hard)
  fireRate: 1.76,     // blows per second (each blow is `bubbles` bubbles at once)
  bubbleSize: 1.0,    // size multiplier: bigger bubbles are easier to land and splash wider
  health: 25,         // max health
  moveSpeed: 1.0,     // move speed multiplier
  jumpHeight: 1.0,    // jump height multiplier
  regen: 0,           // health refilled per second
  dodge: 0,           // % chance a hit misses you entirely (60% at most)
  luck: 0,            // shifts level-up cards and treasures toward the rarer kinds (see luckWeights)
  // Tentacles: an automatic lash at close range. Only treasures improve these.
  tentacles: 1,       // tentacles that lash out at once (the jelly has 6 in all)
  reach: 0.083,       // meters a tentacle reaches, from the middle of the bell (~5 cm past its rim)
  tentacleDamage: 4,  // damage per tentacle
  tentacleSpeed: 1.0, // lashes per second
};

// How each stat is shown on a card and in the stats panel
export const STAT_INFO = {
  bubbles:         { name: 'Bubbles',         icon: '🫧', fmt: (v) => (v > 1 ? `${v} side by side · ${Math.round(bubbleShare(v) * 100)}% damage each` : `${v}`) },
  range:           { name: 'Range',           icon: '📏', fmt: (v) => `${Math.round(v * 100)} cm` },
  bubbleDamage:    { name: 'Bubble damage',   icon: '💥', fmt: (v) => `${+v.toFixed(1)}` },
  fireRate:        { name: 'Fire rate',       icon: '💨', fmt: (v) => `${v.toFixed(2)}/s` },
  bubbleSize:      { name: 'Bubble size',     icon: '🔵', fmt: (v) => `${Math.round(v * 100)}%` },
  health:          { name: 'Health',          icon: '💧', fmt: (v) => `${Math.round(v)}` },
  moveSpeed:       { name: 'Move speed',      icon: '⏩', fmt: (v) => `${Math.round(v * 100)}%` },
  jumpHeight:      { name: 'Jump height',     icon: '⤴️', fmt: (v) => `${Math.round(v * 100)}%` },
  regen:           { name: 'Health regen',    icon: '💦', fmt: (v) => `${+v.toFixed(2)}/s` },
  dodge:           { name: 'Dodge',           icon: '🍃', fmt: (v) => `${Math.round(v)}%` },
  luck:            { name: 'Luck',            icon: '🍀', fmt: (v) => `${Math.round(v)}` },
  tentacles:       { name: 'Tentacles',       icon: '🪼', fmt: (v) => `${v}` },
  reach:           { name: 'Tentacle reach',  icon: '📐', fmt: (v) => `${(v * 100).toFixed(1)} cm` },
  tentacleDamage:  { name: 'Tentacle damage', icon: '⚡', fmt: (v) => `${Math.round(v)}` },
  tentacleSpeed:   { name: 'Tentacle speed',  icon: '🌀', fmt: (v) => `${v.toFixed(2)}/s` },
};

// Level-up card rarities, and how often each rolls with no luck
export const RARITY = [
  { id: 'common', name: 'Common', color: '#cfd6e0', weight: 70 },
  { id: 'rare', name: 'Rare', color: '#5fb4ff', weight: 25 },
  { id: 'epic', name: 'Epic', color: '#c77bff', weight: 5 },
];

// Treasure rarities (rarity="…" in content/treasures.kdl), and how often a pick slot rolls each
// with no luck. Rated by tests/clear.mjs (how much faster ten clumped cockroaches die) for
// treasures that hurt things, and by how unique the effect is for the rest.
export const TREASURE_RARITY = [
  { id: 'common', name: 'Common', color: '#cfd6e0', weight: 55 },
  { id: 'rare', name: 'Rare', color: '#5fb4ff', weight: 30 },
  { id: 'epic', name: 'Epic', color: '#c77bff', weight: 12 },
];

// Luck: each tier above common is (1 + luck/100)x likelier per step up, so 30 luck makes rares
// 1.3x, epics 1.69x and legendaries 2.2x as likely (before the shares are re-normalised)
export const luckWeights = (tiers, luck = 0) => tiers.map((r, i) => r.weight * Math.max(0, 1 + luck / 100) ** i);

// [common, rare, epic] amounts. `pct` = percent of the base value, added.
const CARD_VALUES = {
  bubbles:       { amounts: [0, 1, 2], weight: 0.6 },   // too strong to be common
  range:         { amounts: [10, 18, 30], pct: true },
  bubbleDamage:  { amounts: [1.25, 2, 3.25] },   // scaled with the base (6) so each card is worth the same share
  fireRate:      { amounts: [10, 18, 30], pct: true },
  health:        { amounts: [4, 8, 14] },
  moveSpeed:     { amounts: [8, 14, 22], pct: true, weight: 1.2 },
  regen:         { amounts: [0.1, 0.2, 0.35], suffix: '/s' },   // health a second
  dodge:         { amounts: [3, 5, 8], suffix: '%' },           // percentage points
  luck:          { amounts: [10, 18, 30] },                     // see luckWeights
};

// Each bubble past the first makes every bubble in the blow 15% weaker (compounding): 2 bubbles
// do 85% each (1.7x in all), 3 do 72% (2.2x), 6 do 44% (2.7x). More bubbles, more spread, less punch.
export const BUBBLE_PENALTY = 0.15;
export const bubbleShare = (n) => (1 - BUBBLE_PENALTY) ** Math.max(0, n - 1);

export function cardText(card) {
  const info = STAT_INFO[card.stat];
  const v = CARD_VALUES[card.stat];
  const amount = v.pct ? `${card.amount}%` : `${card.amount}${v.suffix || ''}`;
  if (card.stat === 'bubbles') return `+${amount} ${card.amount === 1 ? 'Bubble' : 'Bubbles'} side by side · ${Math.round((1 - bubbleShare(card.amount + 1)) * 100)}% less damage each`;
  return `+${amount} ${info.name}`;
}

export function applyCard(stats, card) {
  const v = CARD_VALUES[card.stat];
  if (v.pct) stats[card.stat] += BASE_STATS[card.stat] * card.amount / 100;
  else stats[card.stat] += card.amount;
  stats.bubbles = Math.min(MAX_BUBBLES, stats.bubbles);
}

function pickWeighted(list, w) {
  let r = Math.random() * list.reduce((s, x) => s + w(x), 0);
  for (const x of list) if ((r -= w(x)) <= 0) return x;
  return list[list.length - 1];
}

// Three different stats, each with a rolled rarity
// bonus: rarity steps added to every card (Game Die); luck: your Luck stat (luckWeights)
export function rollCards(stats, n = 3, bonus = 0, luck = 0) {
  const w = luckWeights(RARITY, luck);
  const pool = Object.keys(CARD_VALUES).filter((k) => k !== 'bubbles' || stats.bubbles < MAX_BUBBLES);
  const cards = [];
  while (cards.length < n && pool.length) {
    const stat = pickWeighted(pool, (s) => CARD_VALUES[s].weight ?? 1);
    pool.splice(pool.indexOf(stat), 1);
    const rarity = pickWeighted(RARITY, (r) => w[RARITY.indexOf(r)]);
    let ri = Math.min(RARITY.length - 1, RARITY.indexOf(rarity) + bonus);
    if (CARD_VALUES[stat].amounts[ri] === 0) ri = 1; // extra bubbles start at rare
    if (stat === 'bubbles') ri = Math.min(ri, 1 + (MAX_BUBBLES - stats.bubbles >= 2 ? 1 : 0));
    cards.push({ stat, rarity: RARITY[ri], amount: CARD_VALUES[stat].amounts[ri] });
  }
  return cards;
}

// XP needed to go from `level` to the next one
export const xpToNext = (level) => Math.round(3 * 1.45 ** (level - 1));   // 3, 4, 6, 9, 13, 19, 28, 40…: each level 1.45x the last

// Up to n different treasures from pool: each slot rolls a rarity (with luck) among the rarities
// still in the pool, then one treasure of that rarity
// favor(t): how much likelier than usual t is (1 = as usual); a tier's chance is its rarity
// weight, shared across what's left in it, so with every favor at 1 this is the plain roll
export function rollTreasures(pool, n = 3, luck = 0, favor = () => 1) {
  const left = [...pool], out = [], w = luckWeights(TREASURE_RARITY, luck);
  while (out.length < n && left.length) {
    const inTier = (t) => left.filter((o) => o.rarity === t.rarity).length;
    const t = pickWeighted(left, (o) => w[TREASURE_RARITY.findIndex((r) => r.id === o.rarity)] / inTier(o) * favor(o));
    left.splice(left.indexOf(t), 1);
    out.push(t);
  }
  return out;
}

// Treasures: lost things with their own effects; unique ones once per run, stackable ones up to stack=N.
// Treasures live in content/treasures.kdl (name, icon, text and effect words; src/words.js)
export const TREASURES = CONTENT.treasures;

// Treasures that change how you attack (attack=#true)
export const ATTACK_TREASURES = CONTENT.treasures.filter((t) => t.attack).map((t) => t.id);
// The element attacks' base treasures (the `element` word): only from element rewards (the start
// of a run, after each boss), never from gifts or elites
export const ELEMENT_TREASURES = CONTENT.treasures.filter((t) => t.vocabulary.includes('element')).map((t) => t.id);

export const MAX_TENTACLES = 6;
export const MAX_BUBBLES = 6;
export const MAX_DODGE = 60;   // % chance a hit misses, at most

// Offered after beating a stage's boss; pick one
export const EVOLUTIONS = [
  { id: 'bell', name: 'Ephyra Bell', icon: '🔔', text: '+1 Bubble side by side (15% less damage each), +15% Move speed', apply: (s) => { s.bubbles = Math.min(MAX_BUBBLES, s.bubbles + 1); s.moveSpeed += 0.15; } },
  { id: 'frills', name: 'Stinging Frills', icon: '✨', text: '+1 Tentacle, +4 Tentacle damage, +25% Tentacle reach', apply: (s) => { s.tentacles = Math.min(MAX_TENTACLES, s.tentacles + 1); s.tentacleDamage += 4; s.reach += BASE_STATS.reach * 0.25; } },
  { id: 'breath', name: 'Deep Breath', icon: '🌊', text: '+10 Health', apply: (s) => { s.health += 10; } },
  { id: 'rhythm', name: 'Quick Rhythm', icon: '🥁', text: '+25% Fire rate, +25% Tentacle speed', apply: (s) => { s.fireRate += BASE_STATS.fireRate * 0.25; s.tentacleSpeed += 0.25; } },
  { id: 'spring', name: 'Springy Bell', icon: '🪀', text: '+25% Jump height, +10% Move speed', apply: (s) => { s.jumpHeight += 0.25; s.moveSpeed += 0.1; } },
];
