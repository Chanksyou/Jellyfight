// A "1 in N" chance of yours (crit, trap, ghost, life steal...): one roll, and with the Lucky Cat
// (mods.luckyRolls) another try if it missed. Without the cat it takes exactly one Math.random(),
// so fixed-seed stories don't move. Not for Dodge, Rarity, or anything a bug rolls.
import { bus } from './events.js';

export function rollChance(chance, mods) {
  if (Math.random() < chance) return true;
  for (let i = 1; i < (mods?.luckyRolls ?? 1); i++) if (Math.random() < chance) { bus.emit('lucky_roll'); return true; }
  return false;
}
