// The jelly's stats, level-up cards, treasures and evolution choices.
// Everything a player reads is here, so tuning lives in one place.
import { CONTENT } from './content.js';

export const BASE_STATS = {
  // Bubbles: the main attack, ranged. Level-up cards improve these.
  bubbles: 2,       // more bubbles: a faster stream, spread across that many of the nearest enemies
  range: 0.3,       // meters a bubble flies before it pops on its own
  pop: 6,           // damage when a bubble pops on an enemy (a slower stream, each bubble hits hard)
  blowRate: 0.88,   // stream speed: bubbles per second = blow rate x bubbles (1.76/s to start)
  bubbleSize: 1.0,  // size multiplier: bigger bubbles are easier to land and splash wider
  moisture: 25,     // max health
  pulse: 1.0,       // swim speed multiplier
  bounce: 1.0,      // jump height multiplier
  // Tentacles: an automatic sting at close range. Only treasures improve these.
  tentacles: 1,     // tentacles that lash out at once (the jelly has 6 in all)
  reach: 0.083,     // meters a tentacle reaches, from the middle of the bell (~5 cm past its rim)
  sting: 4,         // damage per tentacle
  lashSpeed: 1.0,   // lashes per second
};

// How each stat is shown on a card and in the stats panel
export const STAT_INFO = {
  bubbles:    { name: 'Bubbles',     icon: '🫧', fmt: (v) => `${v}` },
  range:      { name: 'Range',       icon: '📏', fmt: (v) => `${Math.round(v * 100)} cm` },
  pop:        { name: 'Pop damage',  icon: '💥', fmt: (v) => `${+v.toFixed(1)}` },
  blowRate:   { name: 'Blow rate',   icon: '💨', fmt: (v) => `${v.toFixed(2)}/s` },
  bubbleSize: { name: 'Bubble size', icon: '🔵', fmt: (v) => `${Math.round(v * 100)}%` },
  moisture:   { name: 'Moisture',    icon: '💧', fmt: (v) => `${Math.round(v)}` },
  pulse:      { name: 'Swim speed',  icon: '⏩', fmt: (v) => `${Math.round(v * 100)}%` },
  bounce:     { name: 'Bounce',      icon: '⤴️', fmt: (v) => `${Math.round(v * 100)}%` },
  tentacles:  { name: 'Tentacles',   icon: '🪼', fmt: (v) => `${v}` },
  reach:      { name: 'Tentacle reach', icon: '📐', fmt: (v) => `${(v * 100).toFixed(1)} cm` },
  sting:      { name: 'Sting',       icon: '⚡', fmt: (v) => `${Math.round(v)}` },
  lashSpeed:  { name: 'Lash speed',  icon: '🌀', fmt: (v) => `${v.toFixed(2)}/s` },
};

export const RARITY = [
  { id: 'common', name: 'Common', color: '#cfd6e0', weight: 70 },
  { id: 'rare', name: 'Rare', color: '#5fb4ff', weight: 25 },
  { id: 'epic', name: 'Epic', color: '#c77bff', weight: 5 },
];

// [common, rare, epic] amounts. `pct` = percent of the base value, added.
const CARD_VALUES = {
  bubbles:    { amounts: [0, 1, 2], weight: 0.6 },   // too strong to be common
  range:      { amounts: [10, 18, 30], pct: true },
  pop:        { amounts: [1.25, 2, 3.25] },   // scaled with the base (6) so each card is worth the same share
  blowRate:   { amounts: [10, 18, 30], pct: true },
  bubbleSize: { amounts: [12, 20, 35], pct: true },
  moisture:   { amounts: [4, 8, 14] },
  pulse:      { amounts: [8, 14, 22], pct: true, weight: 1.2 },
  bounce:     { amounts: [8, 14, 22], pct: true },
};

export function cardText(card) {
  const info = STAT_INFO[card.stat];
  const v = CARD_VALUES[card.stat];
  const amount = v.pct ? `${card.amount}%` : card.amount;
  const unit = card.stat === 'bubbles' ? (card.amount === 1 ? ' Bubble' : ' Bubbles') : ` ${info.name}`;
  return `+${amount}${unit}`;
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
// bonus: rarity steps added to every card (Game Die)
export function rollCards(stats, n = 3, bonus = 0) {
  const pool = Object.keys(CARD_VALUES).filter((k) => k !== 'bubbles' || stats.bubbles < MAX_BUBBLES);
  const cards = [];
  while (cards.length < n && pool.length) {
    const stat = pickWeighted(pool, (s) => CARD_VALUES[s].weight ?? 1);
    pool.splice(pool.indexOf(stat), 1);
    let rarity = pickWeighted(RARITY, (r) => r.weight);
    let ri = Math.min(RARITY.length - 1, RARITY.indexOf(rarity) + bonus);
    if (CARD_VALUES[stat].amounts[ri] === 0) ri = 1; // extra bubbles start at rare
    if (stat === 'bubbles') ri = Math.min(ri, 1 + (MAX_BUBBLES - stats.bubbles >= 2 ? 1 : 0));
    cards.push({ stat, rarity: RARITY[ri], amount: CARD_VALUES[stat].amounts[ri] });
  }
  return cards;
}

// Dew needed to go from `level` to the next one
export const xpToNext = (level) => 10 + 4 * level;   // steep: levels are a trickle, treasures are the big moments

// Treasures: lost things with one-of-a-kind effects. Each can appear once per run.
// Treasures live in content/treasures.kdl (name, icon, text and effect words; src/words.js)
export const TREASURES = CONTENT.treasures;

// Treasures that change how you attack (attack=#true): the starting pick always includes one
export const ATTACK_TREASURES = CONTENT.treasures.filter((t) => t.attack).map((t) => t.id);

export const MAX_TENTACLES = 6;
export const MAX_BUBBLES = 6;

// Offered after beating a stage's boss; pick one
export const EVOLUTIONS = [
  { id: 'bell', name: 'Ephyra Bell', icon: '🔔', text: '+1 Bubble, +15% Swim speed', apply: (s) => { s.bubbles = Math.min(MAX_BUBBLES, s.bubbles + 1); s.pulse += 0.15; } },
  { id: 'frills', name: 'Stinging Frills', icon: '✨', text: '+1 Tentacle, +4 Sting, +25% Tentacle reach', apply: (s) => { s.tentacles = Math.min(MAX_TENTACLES, s.tentacles + 1); s.sting += 4; s.reach += BASE_STATS.reach * 0.25; } },
  { id: 'breath', name: 'Deep Breath', icon: '🌊', text: '+10 Moisture', apply: (s) => { s.moisture += 10; } },
  { id: 'rhythm', name: 'Quick Rhythm', icon: '🥁', text: '+25% Blow rate, +25% Lash speed', apply: (s) => { s.blowRate += BASE_STATS.blowRate * 0.25; s.lashSpeed += 0.25; } },
  { id: 'spring', name: 'Springy Bell', icon: '🪀', text: '+25% Bounce, +10% Swim speed', apply: (s) => { s.bounce += 0.25; s.pulse += 0.1; } },
];
