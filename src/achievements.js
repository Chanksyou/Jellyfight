// Win-gated challenges. Run history travels with the act; earned achievements stay on this device.
export const ACHIEVEMENTS_KEY = 'jellyrun.achievements';
const defense = s => (s.cards.health || 0) + (s.cards.regen || 0) + (s.cards.dodge || 0);
const offense = s => (s.cards.bubbleDamage || 0) + (s.cards.fireRate || 0);
const elites = s => Object.values(s.elites).reduce((n, list) => n + list.length, 0);
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

export function challengeProgress(s, id) {
  const label = ACHIEVEMENTS.find(a => a.id === id);
  if (!s.eligible) return 'Start a new run to track this challenge';
  if (id === 'make-your-own-luck') return `${Math.min(8, s.cards.luck || 0)}/8 Luck cards`;
  if (id === 'built-to-last') return `${Math.min(11, defense(s))}/11 defensive cards`;
  if (id === 'glass-cannon') return defense(s) ? 'Not eligible this run: defensive card chosen' : `${Math.min(10, offense(s))}/10 offensive cards`;
  if (id === 'perfect-boss' || id === 'perfect-pair') { const n = id === 'perfect-boss' ? 1 : 2; return `${Math.min(n, s.perfect.length)}/${n} flawless bosses`; }
  if (id === 'full-clearance') return `${elites(s)}/9 household Elites`;
  if (id === 'everything-must-go') return [1, 2, 3].map(act => `Act ${act}: ${(s.scheduled[act] || []).length}/4`).join(' · ');
  if (id === 'pack-light') return s.treasures > 6 ? 'Not eligible this run: more than six treasures' : `${s.treasures}/6 treasures`;
  if (id === 'floor-dweller' && s.eliteKills) return 'Not eligible this run: household Elite defeated';
  if (id === 'perfect-run' && s.hurt) return 'Not eligible this run: Health lost';
  if (id === 'one-of-everything' && s.duplicate) return 'Not eligible this run: duplicate treasure';
  if (id === 'trust-the-hand' && s.rerolls) return 'Not eligible this run: reroll used';
  if (id === 'early-retirement' && !s.early && s.bosses.includes(1)) return 'Not eligible this run: Act 1 deadline missed';
  return label.test(s) ? 'Requirement met so far · finish the run to earn it' : 'In progress · finish the run to earn it';
}
