// The jelly's stats, level-up cards, treasures and evolution choices.
// Everything a player reads is here, so tuning lives in one place.

export const BASE_STATS = {
  tentacles: 2,     // tentacles that lash out at once (the jelly has 6 in all)
  reach: 0.12,      // meters a tentacle reaches (about 3.5x body height)
  sting: 5,         // damage per tentacle
  lashSpeed: 1.2,   // lashes per second
  moisture: 25,     // max health
  pulse: 1.0,       // swim speed multiplier
  bounce: 1.0,      // jump height multiplier
};

// How each stat is shown on a card and in the stats panel
export const STAT_INFO = {
  tentacles: { name: 'Tentacles', icon: '🪼', fmt: (v) => `${v}` },
  reach:     { name: 'Reach',     icon: '📏', fmt: (v) => `${(v * 100).toFixed(1)} cm` },
  sting:     { name: 'Sting',     icon: '⚡', fmt: (v) => `${Math.round(v)}` },
  lashSpeed: { name: 'Lash speed', icon: '💨', fmt: (v) => `${v.toFixed(2)}/s` },
  moisture:  { name: 'Moisture',  icon: '💧', fmt: (v) => `${Math.round(v)}` },
  pulse:     { name: 'Swim speed', icon: '⏩', fmt: (v) => `${Math.round(v * 100)}%` },
  bounce:    { name: 'Bounce',    icon: '⤴️', fmt: (v) => `${Math.round(v * 100)}%` },
};

export const RARITY = [
  { id: 'common', name: 'Common', color: '#cfd6e0', weight: 70 },
  { id: 'rare', name: 'Rare', color: '#5fb4ff', weight: 25 },
  { id: 'epic', name: 'Epic', color: '#c77bff', weight: 5 },
];

// [common, rare, epic] amounts. `pct` = percent of the base value, added.
const CARD_VALUES = {
  tentacles: { amounts: [0, 1, 2], weight: 0.6 },   // too strong to be common
  reach:     { amounts: [10, 18, 30], pct: true },
  sting:     { amounts: [2, 4, 7] },
  lashSpeed: { amounts: [10, 18, 30], pct: true },
  moisture:  { amounts: [4, 8, 14] },
  pulse:     { amounts: [8, 14, 22], pct: true, weight: 1.2 },
  bounce:    { amounts: [8, 14, 22], pct: true },
};

export function cardText(card) {
  const info = STAT_INFO[card.stat];
  const v = CARD_VALUES[card.stat];
  const amount = v.pct ? `${card.amount}%` : card.amount;
  const unit = card.stat === 'tentacles' ? (card.amount === 1 ? ' Tentacle' : ' Tentacles') : ` ${info.name}`;
  return `+${amount}${unit}`;
}

export function applyCard(stats, card) {
  const v = CARD_VALUES[card.stat];
  if (v.pct) stats[card.stat] += BASE_STATS[card.stat] * card.amount / 100;
  else stats[card.stat] += card.amount;
  stats.tentacles = Math.min(MAX_TENTACLES, stats.tentacles);
}

function pickWeighted(list, w) {
  let r = Math.random() * list.reduce((s, x) => s + w(x), 0);
  for (const x of list) if ((r -= w(x)) <= 0) return x;
  return list[list.length - 1];
}

// Three different stats, each with a rolled rarity
// bonus: rarity steps added to every card (Game Die)
export function rollCards(stats, n = 3, bonus = 0) {
  const pool = Object.keys(CARD_VALUES).filter((k) => k !== 'tentacles' || stats.tentacles < MAX_TENTACLES);
  const cards = [];
  while (cards.length < n && pool.length) {
    const stat = pickWeighted(pool, (s) => CARD_VALUES[s].weight ?? 1);
    pool.splice(pool.indexOf(stat), 1);
    let rarity = pickWeighted(RARITY, (r) => r.weight);
    let ri = Math.min(RARITY.length - 1, RARITY.indexOf(rarity) + bonus);
    if (CARD_VALUES[stat].amounts[ri] === 0) ri = 1; // tentacles start at rare
    if (stat === 'tentacles') ri = Math.min(ri, 1 + (MAX_TENTACLES - stats.tentacles >= 2 ? 1 : 0));
    cards.push({ stat, rarity: RARITY[ri], amount: CARD_VALUES[stat].amounts[ri] });
  }
  return cards;
}

// Dew needed to go from `level` to the next one
export const xpToNext = (level) => 10 + 4 * level;   // steep: levels are a trickle, treasures are the big moments

// Treasures: lost things with one-of-a-kind effects. Each can appear once per run.
export const TREASURES = [
  { id: 'bobbyPin', name: 'Bobby Pin', icon: '🧷', text: 'Lashes pierce, hitting everything in a line.' },
  { id: 'hairTie', name: 'Hair Tie', icon: '➰', text: 'Each lash bounces to one more enemy nearby.' },
  { id: 'goldRing', name: 'Gold Ring', icon: '💍', text: 'Every 10th lash is golden and does 5x damage.' },
  { id: 'bathSalt', name: 'Bath Salt', icon: '🧂', text: 'Enemies you finish off burst and hurt their neighbors.' },
  { id: 'rubberDuck', name: 'Rubber Duck', icon: '🦆', text: 'When you get hit, a squeak knocks nearby enemies back. (5 s)' },
  { id: 'whale', name: 'Whale Bath Toy', icon: '🐳', text: 'Stand still for a second and you start spouting, refilling moisture.' },
  { id: 'qtip', name: 'Q-tip', icon: '🦴', text: 'Enemies you sting are slowed.' },
  { id: 'soapBubble', name: 'Soap Bubble', icon: '🫧', text: 'Blocks the first hit you take each stage.' },
  { id: 'lintRoller', name: 'Lint Roller', icon: '🧻', text: 'Every 20 s, all dew nearby sticks to you at once.' },
  { id: 'reedStick', name: 'Reed Stick', icon: '🎋', text: 'One tentacle becomes a lance: double reach, half speed.' },
  { id: 'wristband', name: 'Festival Wristband', icon: '🎟️', text: 'For 3 s after you land a jump, you lash 50% faster.' },
  { id: 'penSpring', name: 'Pen Spring', icon: '🌀', text: 'One more jump in mid-air: a triple jump.' },
  { id: 'bathBomb', name: 'Bath Bomb', icon: '💥', text: 'Every 6 s you fizz, stinging everything close around you.' },
  { id: 'nailClipper', name: 'Nail Clipper', icon: '✂️', text: '1 in 5 stings is a snip for triple damage.' },
  { id: 'cottonBall', name: 'Cotton Ball', icon: '☁️', text: 'Land from a jump to send out a soft shockwave that stings.' },
  { id: 'loofah', name: 'Loofah', icon: '🧽', text: 'Dew soaks into you from much farther away.' },
  // things that attack on their own (gadgets.js)
  { id: 'guitarPick', name: 'Guitar Pick', icon: '🎸', text: 'Every 5 s a chord rings out, stinging and pushing back everything close.' },
  { id: 'remote', name: 'TV Remote', icon: '📺', text: 'Every 7 s, zap the 3 nearest enemies for double damage.' },
  { id: 'fairyLights', name: 'Fairy Lights', icon: '💡', text: 'Three little bulbs circle you and sting whatever they touch.' },
  { id: 'magnifier', name: 'Magnifying Glass', icon: '🔍', text: 'Focused moonlight burns the nearest enemy, nonstop.' },
  { id: 'glowStick', name: 'Glow Stick', icon: '🟢', text: 'A soft glow around you stings anything inside it.' },
  { id: 'iceCube', name: 'Ice Cube', icon: '🧊', text: 'Every 8 s a cold snap freezes everything close for 2 s. Frozen things can\'t hurt you.' },
  { id: 'legoBrick', name: 'Lego Brick', icon: '🧱', text: 'Drop a brick every 4 s. Anything that steps on it takes a huge hit.' },
  { id: 'marble', name: 'Marble', icon: '🔮', text: 'Every 5 s a marble rolls out ahead of you, bouncing off walls and bowling through enemies.' },
  // things that bend the rules
  { id: 'stickyNote', name: 'Sticky Note', icon: '🗒️', text: 'Enemies you sting are marked for 3 s and take 50% more damage from everything.' },
  { id: 'coin', name: 'Lucky Penny', icon: '🪙', text: 'Enemies drop 50% more dew.' },
  { id: 'dice', name: 'Game Die', icon: '🎲', text: 'Level-up cards roll one rarity higher.' },
  { id: 'hourglass', name: 'Egg Timer', icon: '⏳', text: 'The boss comes 30 s later: more night to grow in.' },
  { id: 'babyBottle', name: 'Baby Bottle', icon: '🍼', text: 'Every enemy you clear gives back a sip of moisture.' },
  { id: 'thimble', name: 'Thimble', icon: '🛡️', text: 'Hits take 30% less moisture.' },
];

export const MAX_TENTACLES = 6;

// Offered after beating a stage's boss; pick one
export const EVOLUTIONS = [
  { id: 'bell', name: 'Ephyra Bell', icon: '🔔', text: '+1 Tentacle, +15% Swim speed', apply: (s) => { s.tentacles = Math.min(MAX_TENTACLES, s.tentacles + 1); s.pulse += 0.15; } },
  { id: 'frills', name: 'Stinging Frills', icon: '✨', text: '+4 Sting, +15% Reach', apply: (s) => { s.sting += 4; s.reach += BASE_STATS.reach * 0.15; } },
  { id: 'breath', name: 'Deep Breath', icon: '🌊', text: '+10 Moisture', apply: (s) => { s.moisture += 10; } },
  { id: 'rhythm', name: 'Quick Rhythm', icon: '🥁', text: '+25% Lash speed', apply: (s) => { s.lashSpeed += 0.25; } },
  { id: 'spring', name: 'Springy Bell', icon: '🪀', text: '+25% Bounce, +10% Swim speed', apply: (s) => { s.bounce += 0.25; s.pulse += 0.1; } },
];
