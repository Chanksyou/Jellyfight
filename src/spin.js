// The reward spin's numbers, no DOM (the screen is src/spin-screen.js). Roll first, show second:
// a pick is rolled as always (run.levelUp, run.pickTreasure) and this only turns that roll into
// what the machine shows. Reel filler is real rolls from the same eligible pool on the spin's own
// dice (seededRandom), so it never draws from Math.random and never moves the offer.
import { CONTENT } from './content.js';
import { LOOK } from './look.js';
import { RARITY, TREASURE_RARITY, CHEST_WEIGHTS, luckWeights } from './stats.js';
import { seededRandom } from './story-random.mjs';

const share = (w) => { const sum = w.reduce((a, b) => a + b, 0) || 1; return w.map((x) => x / sum); };

// One reel's chance of each rarity, with no Luck (was) and with yours (now), from the weights the
// roll itself uses; before three of a kind.
//   kind 'levelup': content/levelups.kdl rarities, then the Game Die's shift (bonus, capped at Epic).
//     A card with no lower tiers (Attacks) rolls up on its own; that is per stat and left out here.
//   kind 'treasure': CHEST_WEIGHTS[source], over the rarities in pool (what the chest can hold now).
//   kind 'legendary': the boss reward, always Legendary.
// Returns [{ id, name, was, now }] in rarity order.
export function tierOdds(kind, { luck = 0, bonus = 0, source = 'room', pool = [] } = {}) {
  if (kind === 'legendary') return [{ id: 'legendary', name: 'Legendary', was: 1, now: 1 }];
  if (kind === 'levelup') {
    const tiers = RARITY.map((r) => ({ ...r, weight: CONTENT.levelups.rarities[r.id] }));
    const shift = (p) => { const out = p.map(() => 0); p.forEach((x, i) => { out[Math.min(p.length - 1, i + bonus)] += x; }); return out; };
    const was = shift(share(luckWeights(tiers, 0))), now = shift(share(luckWeights(tiers, luck)));
    return RARITY.map((r, i) => ({ id: r.id, name: r.name, was: was[i], now: now[i] }));
  }
  const tiers = TREASURE_RARITY.map((r) => ({ ...r, weight: pool.some((t) => t.rarity === r.id) ? CHEST_WEIGHTS[source][r.id] : 0 }));
  const was = share(luckWeights(tiers, 0)), now = share(luckWeights(tiers, luck));
  return TREASURE_RARITY.map((r, i) => ({ id: r.id, name: r.name, was: was[i], now: now[i] })).filter((r, i) => tiers[i].weight > 0);
}

// What makes two cells look the same (a Treasure by id; a level-up card by stat, rarity and amount)
const same = (a, b) => !!a && !!b && (a.id ? a.id === b.id : a.stat === b.stat && a.rarity.id === b.rarity.id && a.amount === b.amount);

// The reels: for each offered card, `cells` filler cells, the card (at index `cells`, the payline),
// then one more filler cell (the row above it). rollOne(rng): one real roll (run.rollLevelUp(1, rng),
// run.rollChest(source, 1, rng)). No two neighbours alike; a filler may repeat across reels.
// seed: performance.now() in play, fixed in stories. Returns [[cell, ...], ...].
export function buildStrips(result, rollOne, { cells, seed = performance.now() } = {}) {
  const rng = seededRandom(Math.floor(seed * 1000));
  const filler = (not) => {
    let c;
    for (let i = 0; i < 20; i++) { c = rollOne(rng)[0]; if (!not.some((x) => same(x, c))) break; }   // a pool of one can't help repeating
    return c;
  };
  return result.map((card) => {
    const strip = [];
    for (let i = 0; i < cells; i++) strip.push(filler([strip[i - 1], i === cells - 1 ? card : null]));
    strip.push(card, filler([card]));
    return strip;
  });
}

// How many filler cells a reel has (--spin-cells-*): kind 'treasure' or 'levelup'
export const spinCells = (kind) => LOOK.num(`spin-cells-${kind}`, kind === 'treasure' ? 19 : 12);

// When things happen, in ms: the lever, each reel's stop after it, and the hold before the cards.
// A reel landing Epic or Legendary waits --spin-rare-wait longer, and so does every reel after it.
// kind 'treasure' or 'levelup'; results: the offered cards (a Treasure's rarity is a string, a card's an object).
export function spinTimes(kind, results) {
  const base = LOOK.list(`spin-stops-${kind}`, kind === 'treasure' ? ['1800', '2500', '3200'] : ['1000', '1400', '1800']).map(parseFloat);
  const step = base.length > 1 ? base[base.length - 1] - base[base.length - 2] : base[0];
  const wait = LOOK.num('spin-rare-wait', 500);
  let extra = 0;
  const stops = results.map((c, i) => {
    if (['epic', 'legendary'].includes(c.rarity?.id ?? c.rarity)) extra += wait;
    return (base[i] ?? base[base.length - 1] + step * (i - base.length + 1)) + extra;
  });
  return { lever: LOOK.num('spin-lever', 250), stops, hold: LOOK.num(`spin-hold-${kind}`, kind === 'treasure' ? 900 : 600) };
}
