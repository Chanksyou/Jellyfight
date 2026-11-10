// Jelly types (content/jellies.kdl): what a run starts as. Built behind one switch until release
// (docs/jelly-types/spec-core.md). With TYPE_SWITCH.on false every run is Normal and nothing changes;
// on (`?types` or `?types=<id>`, the dev tools' Types button, or a story's fresh({ types: '<id>' }))
// a new run starts as TYPE_SWITCH.start, and counts as a dev run (no score, not in the run log).
import { CONTENT } from './content.js';
import { BASE_STATS } from './stats.js';

export const TYPE_SWITCH = { on: false, start: 'normal' };

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
