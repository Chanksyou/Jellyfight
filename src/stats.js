// The jelly's stats, level-up cards, treasures and evolution choices.
// Everything a player reads is here, so tuning lives in one place.

export const BASE_STATS = {
  // Bubbles: the main attack, ranged. Level-up cards improve these.
  bubbles: 2,       // bubbles blown per volley, spread across the nearest enemies
  range: 0.3,       // meters a bubble flies before it pops on its own
  pop: 1.8,         // damage when a bubble pops on an enemy (light: lots of bubbles, each small)
  blowRate: 3.0,    // volleys per second: a stream of bubbles
  bubbleSize: 1.0,  // size multiplier: bigger bubbles are easier to land and splash wider
  moisture: 25,     // max health
  pulse: 1.0,       // swim speed multiplier
  bounce: 1.0,      // jump height multiplier
  // Tentacles: an automatic sting at close range. Only treasures improve these.
  tentacles: 1,     // tentacles that lash out at once (the jelly has 6 in all)
  reach: 0.07,      // meters a tentacle reaches
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
  pop:        { amounts: [0.5, 0.8, 1.3] },
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
export const TREASURES = [
  // bubbles (bubbles.js)
  { id: 'bobbyPin', name: 'Bobby Pin', icon: '🧷', text: 'Bubbles pierce, popping on up to 3 enemies in a line.' },
  { id: 'hairTie', name: 'Hair Tie', icon: '➰', text: 'Each bubble that pops blows a smaller one at another enemy nearby.' },
  { id: 'goldRing', name: 'Gold Ring', icon: '💍', text: 'Every 10th volley is golden and does 5x damage.' },
  { id: 'bathSalt', name: 'Bath Salt', icon: '🧂', text: 'Enemies you finish off burst and hurt their neighbors.' },
  { id: 'rubberDuck', name: 'Rubber Duck', icon: '🦆', text: 'When you get hit, a squeak knocks nearby enemies back. (5 s)' },
  { id: 'whale', name: 'Whale Bath Toy', icon: '🐳', text: 'Stand still for a second and you start spouting, refilling moisture.' },
  { id: 'qtip', name: 'Q-tip', icon: '🦴', text: 'Enemies your bubbles hit are slowed.' },
  { id: 'soapBubble', name: 'Rubber Glove', icon: '🧤', text: 'Blocks the first hit you take each stage.' },
  { id: 'lintRoller', name: 'Lint Roller', icon: '🧻', text: 'Every 20 s, all dew nearby sticks to you at once.' },
  { id: 'reedStick', name: 'Reed Stick', icon: '🎋', text: 'Every other volley adds one giant, slow bubble that pops for a big splash.' },
  // elements for your bubbles (bubbles.js); they stack
  { id: 'candle', name: 'Birthday Candle', icon: '🕯️', text: 'Fire bubbles: enemies burn for 3 s. Fire on a frozen enemy shatters it for triple damage.' },
  { id: 'battery', name: 'AA Battery', icon: '🔋', text: 'Lightning bubbles: every pop arcs to 2 more enemies nearby.' },
  { id: 'freezerPack', name: 'Freezer Pack', icon: '❄️', text: 'Ice bubbles: hits chill and slow; the 3rd chilled hit freezes the enemy solid.' },
  { id: 'nailPolish', name: 'Nail Polish', icon: '💅', text: 'Acid bubbles: pops leave a puddle that eats at anything standing in it.' },
  { id: 'paperFan', name: 'Paper Fan', icon: '🌬️', text: 'Wind bubbles: whatever they hit gets blown backward.' },
  { id: 'glitter', name: 'Glitter', icon: '✨', text: 'Glitter bubbles: the splash is twice as wide and hits harder.' },
  // tentacles (the close-range sting): these are the only way to improve them
  { id: 'fishingLine', name: 'Fishing Line', icon: '🎣', text: 'Two more tentacles lash out at once.' },
  { id: 'chopstick', name: 'Chopstick', icon: '🥢', text: 'Tentacles reach 60% farther.' },
  { id: 'hotSauce', name: 'Hot Sauce', icon: '🌶️', text: 'Tentacle stings do double damage and slow what they hit.' },
  { id: 'cactus', name: 'Cactus Spine', icon: '🌵', text: 'Anything that touches you gets stung hard.' },
  { id: 'wristband', name: 'Festival Wristband', icon: '🎟️', text: 'For 3 s after you land a jump, your tentacles lash twice as fast.' },
  { id: 'penSpring', name: 'Pen Spring', icon: '🌀', text: 'One more jump in mid-air: a triple jump.' },
  { id: 'bathBomb', name: 'Bath Bomb', icon: '💥', text: 'Every 6 s you fizz, stinging everything close around you.' },
  { id: 'nailClipper', name: 'Nail Clipper', icon: '✂️', text: '1 in 5 hits (bubbles and tentacles) does triple damage.' },
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
  { id: 'stickyNote', name: 'Sticky Note', icon: '🗒️', text: 'Enemies you hit are marked for 3 s and take 50% more damage from everything.' },
  { id: 'coin', name: 'Lucky Penny', icon: '🪙', text: 'Enemies drop 50% more dew.' },
  { id: 'dice', name: 'Game Die', icon: '🎲', text: 'Level-up cards roll one rarity higher.' },
  { id: 'hourglass', name: 'Egg Timer', icon: '⏳', text: 'The boss comes 30 s later: more night to grow in.' },
  { id: 'babyBottle', name: 'Baby Bottle', icon: '🍼', text: 'Every enemy you clear gives back a sip of moisture.' },
  { id: 'thimble', name: 'Thimble', icon: '🛡️', text: 'Hits take 30% less moisture.' },
];

// Treasures that change how you attack: elements, things that attack on their own, and bubble
// upgrades. The starting pick always includes one of these.
export const ATTACK_TREASURES = ['candle', 'battery', 'freezerPack', 'nailPolish', 'paperFan', 'glitter',
  'guitarPick', 'remote', 'fairyLights', 'magnifier', 'glowStick', 'iceCube', 'legoBrick', 'marble', 'bathBomb', 'cottonBall',
  'bobbyPin', 'hairTie', 'reedStick'];

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
