// Jelly types (content/jellies.kdl): what a run starts as (docs/jelly-types/spec-core.md). Every run is a
// type; a first-time player's is Normal, a returning player picks (pick-screen.js) and the pick is TYPE_PICK.start.
import { CONTENT } from './content.js';
import { BASE_STATS, STAT_INFO } from './stats.js';
import { found } from './collection.js';
import { lifetime } from './cosmetics.js';
import { STAGES } from './stages.js';

export const TYPE_PICK = { start: 'normal' };

// The jelly a new run starts as
export const startingJelly = () => (CONTENT.jellies[TYPE_PICK.start] ? TYPE_PICK.start : 'normal');

// A run's starting stats: Normal's (BASE_STATS) with the type's stat lines on top
export const jellyStats = (id) => ({ ...BASE_STATS, ...(CONTENT.jellies[id]?.stats || {}) });

// The run's one attack (spec-core.md): the jelly's attack= and hit= (content/jellies.kdl)
export const jellyAttack = (id) => {
  const J = CONTENT.jellies[id] || CONTENT.jellies.normal;
  return { kind: J.attack, hit: J.hit };
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

// Is a type open to pick? null, or what unlocks it: { goal, have, need } (docs/jelly-types/spec-meta.md).
// Read from what the save already keeps, so an unlock is for good and an older save gets its at once:
// unlock-act=N is the Treasure book's beaten bosses (collection.js), unlock-elites=N the lifetime Elite
// count (cosmetics.js). Neither counts a dev run (run.js), so a dev run unlocks nothing.
export function typeLock(id) {
  const U = CONTENT.jellies[id]?.unlock;
  if (!U) return null;
  if (U.act) {
    const beaten = found().bosses, kind = STAGES[U.act - 1]?.boss.kind;
    return Array.isArray(beaten) && beaten.includes(kind) ? null : { goal: `Finish act ${U.act}`, have: 0, need: 1 };
  }
  const have = lifetime().elites;
  return have >= U.elites ? null : { goal: `Defeat ${U.elites} Elites`, have, need: U.elites };
}
// the types open now, in content order
export const openTypes = () => Object.keys(CONTENT.jellies).filter((id) => !typeLock(id));

