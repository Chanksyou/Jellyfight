// Jelly types (content/jellies.kdl): what a run starts as. Built behind one switch until release
// (docs/jelly-types/spec-core.md). With TYPE_SWITCH.on false every run is Normal and nothing changes;
// on (`?types` or `?types=<id>`, the dev tools' Types button, or a story's fresh({ types: '<id>' }))
// a new run starts as TYPE_SWITCH.start, and counts as a dev run (no score, not in the run log).
import { CONTENT } from './content.js';
import { BASE_STATS, STAT_INFO } from './stats.js';

export const TYPE_SWITCH = { on: false, start: 'normal', locked: {} };

// The jelly a new run starts as
export const startingJelly = () => (TYPE_SWITCH.on && CONTENT.jellies[TYPE_SWITCH.start] ? TYPE_SWITCH.start : 'normal');

// A run's starting stats: Normal's (BASE_STATS) with the type's stat lines on top
export const jellyStats = (id) => ({ ...BASE_STATS, ...(CONTENT.jellies[id]?.stats || {}) });

// The run's one attack (spec-core.md): null with the switch off, where a run has today's three at
// once (bubbles, the Elements it owns, the lash); on, the jelly's attack= and hit= (content/jellies.kdl)
export const jellyAttack = (id) => {
  const J = CONTENT.jellies[id];
  return TYPE_SWITCH.on && J ? { kind: J.attack, hit: J.hit } : null;
};

// The pick screen's six bars (docs/jelly-types/spec-pick-screen.md), each 0 to 1 from the type's level-1
// stats, so they can't drift from the real values. Normal sits at 0.5 on every bar: bar = value / (2 x
// Normal's value), capped at 1. The Tentacle jelly is measured on the same scale (its 11 cm reach
// against Normal's 30 cm range makes its Range bar honestly short); its Area is Attacks out of 6.
export const BAR_NAMES = ['Damage', 'Attack speed', 'Range', 'Area', 'Toughness', 'Mobility'];
const barValues = (id) => {
  const J = CONTENT.jellies[id], s = jellyStats(id), melee = J.attack === 'tentacle';
  return [
    s.bubbleDamage * J.hit,
    s.fireRate,
    melee ? s.reach : s.range,
    melee ? s.bubbles / 3 : s.bubbleSize * (J.area ? 1.5 : 1),   // the Tentacle jelly's is Attacks out of 6 (halved below)
    (s.health + s.shield + 20 * s.regen) / (1 - s.dodge / 100),
    s.moveSpeed * Math.sqrt(s.jumpHeight),
  ];
};
export const typeBars = (id) => {
  const normal = barValues('normal'), v = barValues(id);
  return v.map((x, i) => Math.min(1, x / (2 * normal[i])));
};

// A bar drawn as 10 segments: how many are lit (at least one, so a short bar still shows)
export const BAR_SEGMENTS = 10;
export const barSegments = (bar) => Math.max(1, Math.round(bar * BAR_SEGMENTS));

// What a type changes that the bars fold together or leave out, as a difference from Normal (only what
// differs): "+5 Shield", "Pierce +1", "+10 Luck", "Dodge 5%", "Jump height 120%"
const DETAIL_STATS = ['shield', 'regen', 'dodge', 'jumpHeight', 'luck', 'pierce'];
export const typeDetails = (id) => {
  const s = jellyStats(id);
  return DETAIL_STATS.filter((k) => s[k] !== BASE_STATS[k]).map((k) => {
    const I = STAT_INFO[k];
    return k === 'shield' || k === 'luck' ? `+${I.fmt(s[k] - BASE_STATS[k])} ${I.name}` : `${I.name} ${I.fmt(s[k])}`;
  });
};

// Is a type open to pick? null, or what unlocks it: { goal, have, need }. STUB until P10 (unlocks,
// docs/jelly-types/spec-meta.md): every type is open. P10 replaces this with the achievements' progress;
// until then a story locks one by setting TYPE_SWITCH.locked.
export const typeLock = (id) => TYPE_SWITCH.locked[id] || null;
