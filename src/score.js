// The score: what an act earns, from what the jelly did in it. One table, read by the game (run.js
// scoreParts), the leaderboard's cap (leaderboard.js) and the Worker (worker/index.js). Plain data and
// pure functions: no DOM, no three.js, nothing the Worker can't import.
//
// Facts (one act): { nightShare, bossShare, won, elites, bugsOut, bugsCleared, damageTaken, bossSeconds }
//   nightShare   0..1 of the act's night lived (act 4: its room's night)
//   bossShare    0..1 of the boss's Health removed
//   won          the act's boss is beaten
//   elites       high-ground Elites beaten
//   bugsOut      bugs that came out during the night, counted at spawn: waves, Nests, split-off children and
//                Elite summons all count; the boss fight's summons don't (on either side)
//   bugsCleared  of those, the ones the jelly cleared (the same night-only rule)
//   damageTaken  Health the act's hits would have taken with no Shield, until the boss falls (each damage-over-time
//                tick counts; a Treasure's own Health drain, Bloody Fangs, is a price you chose and doesn't)
//   bossSeconds  how long the boss fight took
// The board's season: rows are kept per season (worker/index.js `board`), and the game sends this with every
// run-log act and score post. Ending a season is bumping this number, only when the owner asks.
export const SEASON = 1;

export const SCORE = {
  night: 2000,          // Night survived: all of it for the whole night
  bossDamage: 3000,     // <Boss> damage: all of it for all its Health
  bossBeaten: 5000,     // <Boss> beaten
  elite: 500,           // Elites beaten: each, up to `elites` an act
  elites: 3,
  bugs: 1000,           // Bugs cleared: all of it for every bug that came out
  clean: 2000,          // Clean play (a cleared act only): all of it with no damage taken,
  cleanGone: 100,       //   none at this much damage taken
  pace: 1000,           // Boss pace (a cleared act only): all of it at `paceFull` s or less,
  paceFull: 60,         //   none at `paceNone` s
  paceNone: 180,
  acts: 4,
};

const share = (v) => Math.max(0, Math.min(1, +v || 0));

// The act's parts as [key, points]; keys: night, bossDamage, bossBeaten, elites, bugs, clean, pace
export function actParts(f) {
  const S = SCORE, won = !!f.won, out = Math.max(0, f.bugsOut || 0);
  return [
    ['night', S.night * share(f.nightShare)],
    ['bossDamage', S.bossDamage * (won ? 1 : share(f.bossShare))],
    ['bossBeaten', won ? S.bossBeaten : 0],
    ['elites', S.elite * Math.max(0, Math.min(S.elites, Math.floor(f.elites || 0)))],
    ['bugs', out ? S.bugs * share((f.bugsCleared || 0) / out) : 0],
    ['clean', won ? S.clean * share(1 - Math.max(0, f.damageTaken || 0) / S.cleanGone) : 0],
    ['pace', won ? S.pace * share((S.paceNone - (f.bossSeconds ?? S.paceNone)) / (S.paceNone - S.paceFull)) : 0],
  ].map(([k, v]) => [k, Math.round(v)]);
}

export const actScore = (f) => actParts(f).reduce((n, [, v]) => n + v, 0);

// a perfect act, times the acts: the most a run can score
export const MAX_SCORE = actScore({ nightShare: 1, won: true, elites: SCORE.elites, bugsOut: 1, bugsCleared: 1, damageTaken: 0, bossSeconds: 0 }) * SCORE.acts;
