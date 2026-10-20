// Reproducible story randomness, shared by served stories and the Node runner.
// Gameplay outside the story runner keeps Math.random.
export const DEFAULT_SEED = 20261020;

export function seedFor(name, base = DEFAULT_SEED) {
  let seed = base >>> 0;
  for (let i = 0; i < name.length; i++) seed = Math.imul(seed ^ name.charCodeAt(i), 16777619) >>> 0;
  return seed;
}

// Mulberry32: a small integer generator whose output is always in [0, 1).
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = state;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}
