// Stage 4: the Encore. A concert arena (act4-arena.js), not a room of the apartment: reached by
// beating act 3's boss (the run carries on, as into acts 2 and 3), and the last act. No night to
// explore: the fight starts straight away, and beating the Encore wins the run. Positions are
// metres round the arena's middle; the floor is 12 x 12 tiles of 12 cm.
const HALF = 0.72;
export const STAGE4 = {
  id: 4,
  name: 'The Encore',
  subtitle: 'The concert',
  arena: 'encore',                    // built by act4-arena.js (boot.js), not loaded from the apartment
  rooms: ['Arena'],
  plan: [['Arena', [[-HALF, -HALF], [HALF, -HALF], [HALF, HALF], [-HALF, HALF]]]],   // the minimap's outline
  parts: [],
  won: 'Your Medusa brought the house down. The encore is yours.',   // the winning end's line
  evolve: 'Your Medusa takes the stage.',
  start: [0, 0.01, 0.48],
  duration: 0,                        // straight into the fight
  clock: [360, 360],
  // tougher again than act 3: the beetles' Health, the Encore's, every hit you take, the XP
  toughness: 3.5,
  bossHp: 1,
  power: 2,
  bugs: 1,
  xpMult: 1.6,
  spots: [], vents: [], climbs: [], walls: [], elites: [], treasures: { at: [] },

  // the arena's own numbers (act4-arena.js and the Encore's attacks)
  tiles: 12, tileSize: 0.12,
  bossSpace: { center: [0, 0, -0.36], width: 0.62, depth: 0.48 },

  boss: {
    name: 'The Encore',
    kind: 'encore',
    intro: 'The Encore takes the stage!',
    arenaMin: [-HALF, 0, -HALF],
    arenaMax: [HALF, 1, HALF],
    playerStart: [0, 0.01, 0.48],
    faceBoss: true,                   // start facing the booth (run.js)
  },
};
