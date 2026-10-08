// The event bus: how systems tell each other things happened instead of reaching into each
// other's data. It's synchronous: emit() runs every listener before it returns, so a bubble's
// damage has landed (and a kill has been counted) before the next bubble checks its target.
//
// Events (payloads):
//   damage_taken    { targetId, amount, color?, source, drain?, from? }   targetId 'player' or an enemy id;
//                   from: the enemy id that dealt it, when one did (on-hurt treasures answer it)
//                   drain: ongoing damage that skips i-frames and the flinch (puddles, suction)
//   status_applied  { targetId, status, duration? }  status: 'slow' | 'mark' | 'stun' | 'chill' | 'freeze' | 'thaw'
//   knockback       { targetId, dir, force, launch? } dir: unit Vector3. launch: minimum upward speed
//   enemy_hit       { targetId, amount, color, pos }  after an enemy's HP went down
//   enemy_frozen    { targetId, pos, r }
//   enemy_killed    { targetId, type, elite, pos, floor, r, xp, silent }
//   elite_defeated  { elite }                         a high-ground elite (elites.js) was beaten
//   boss_health     { name, hp, maxHp, shielded? }
export const PLAYER = 'player';

const listeners = new Map();

export const bus = {
  on(type, fn) {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(fn);
    return () => this.off(type, fn);
  },
  off(type, fn) {
    const list = listeners.get(type);
    if (list) listeners.set(type, list.filter((f) => f !== fn));
  },
  emit(type, payload) {
    const list = listeners.get(type);
    if (!list) return;
    for (const fn of [...list]) fn(payload);   // a copy: listeners may subscribe or emit while we loop
  },
};

let lastId = 0;
export const nextId = () => ++lastId;
