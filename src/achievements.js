// Win-gated challenges. Run history travels with the act; earned achievements stay on this device.
export const ACHIEVEMENTS_KEY = 'jellyrun.achievements';
const defense = s => (s.cards.health || 0) + (s.cards.regen || 0) + (s.cards.dodge || 0);
const offense = s => (s.cards.bubbleDamage || 0) + (s.cards.fireRate || 0);
const allRooms = (s, key, count) => [1, 2, 3].every(act => (s[key][act] || []).length === count);

export const ACHIEVEMENTS = [
  { id: 'floor-dweller', name: 'Floor Dweller', text: 'Defeat no household Elites.', test: s => s.eliteKills === 0 },
  { id: 'full-clearance', name: 'Full Clearance', text: 'Defeat all nine household Elites before their respective bosses arrive.', test: s => allRooms(s, 'elites', 3) },
  { id: 'perfect-run', name: 'The Perfect Run', text: 'Complete the entire game without losing Health at any point. Shields and Dodge are allowed.', test: s => !s.hurt },
  { id: 'perfect-boss', name: 'Perfect Boss', text: 'Defeat one boss without losing Health during its fight.', test: s => s.perfect.length >= 1 },
  { id: 'perfect-pair', name: 'Perfect Pair', text: 'Defeat two bosses without losing Health during their fights.', test: s => s.perfect.length >= 2 },
  { id: 'one-of-everything', name: 'One of Everything', text: 'Never collect the same treasure twice. Element upgrades count as their own named treasures; evolutions are separate.', test: s => !s.duplicate },
  { id: 'early-retirement', name: 'Early Retirement', text: 'Defeat all three Act 1 household Elites before 3:00 of exploration.', test: s => s.early },
  { id: 'everything-must-go', name: 'Everything Must Go', text: 'Collect all four original scheduled room treasures in each apartment act. Elite drops and bonus treasures do not substitute.', test: s => allRooms(s, 'scheduled', 4) },
  { id: 'make-your-own-luck', name: 'Make Your Own Luck', text: 'Choose at least eight Luck level-up cards.', test: s => (s.cards.luck || 0) >= 8 },
  { id: 'built-to-last', name: 'Built to Last', text: 'Choose at least eleven Health, Health regen, or Dodge level-up cards in total.', test: s => defense(s) >= 11 },
  { id: 'glass-cannon', name: 'Glass Cannon', text: 'Choose at least ten Bubble damage or Fire rate level-up cards, and no Health, Health regen, or Dodge cards.', test: s => offense(s) >= 10 && defense(s) === 0 },
  { id: 'pack-light', name: 'Pack Light', text: 'Collect no more than six treasures total, counting starting Elements, boss rewards, repeats, and upgrades. Evolutions do not count.', test: s => s.treasures <= 6 },
  { id: 'trust-the-hand', name: 'Trust the Hand', text: 'Never use a level-up reroll.', test: s => s.rerolls === 0 },
];

export function newChallenges(act, carry) {
  // Older saves have no full-run history: allow play, but never guess that earlier acts were flawless.
  return carry ? JSON.parse(JSON.stringify(carry)) : {
    eligible: act === 1, hurt: false, perfect: [], bosses: [], elites: {}, eliteKills: 0, scheduled: {}, cards: {},
    seen: [], treasures: 0, duplicate: false, early: false, rerolls: 0, awarded: false,
  };
}

export function earnedAchievements() {
  try {
    const saved = JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY));
    return saved && !Array.isArray(saved) && typeof saved === 'object' ? saved : {};
  } catch { return {}; }
}

export function awardAchievements(state, won, dev) {
  if (!won || dev || !state.eligible || state.awarded || ![1, 2, 3, 4].every(act => state.bosses.includes(act))) return [];
  const earned = earnedAchievements(), fresh = ACHIEVEMENTS.filter(a => !earned[a.id] && a.test(state));
  const at = new Date().toISOString();
  for (const a of fresh) earned[a.id] = at;
  try { localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(earned)); } catch {}
  state.awarded = true;
  return fresh;
}
