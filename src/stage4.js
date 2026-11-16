// Stage 4: the Encore. Played in two scenes. First the living room at dawn (act 1's room, entered
// from the hallway end), 6 am to 8 am: a 3 minute night with no boss at the end of it. When the
// time is up the stage door opens on the media console (`stageDoor`), and stepping through it
// loads the second scene, the concert arena (ENCORE, built by act4-arena.js), with the act carried
// over as it stands: the same reload as an act change (run.js throughStageDoor, stages.js scene 2).
// Beating the Encore wins the run. Positions are world metres; the living room's are as stage1.js
// describes them.
import { STAGE1, HALL_CLOCK } from './stage1.js';

// The concert arena: the act's second scene. Positions are metres round the arena's middle; the
// floor is 12 x 12 tiles of 12 cm. No night to explore: the fight starts straight away.
const HALF = 0.72;
export const ENCORE = {
  id: 4,
  scene: 2,
  name: 'The Encore',
  subtitle: 'The concert',
  arena: 'encore',                    // built by act4-arena.js (boot.js), not loaded from the apartment
  rooms: ['Arena'],
  plan: [['Arena', [[-HALF, -HALF], [HALF, -HALF], [HALF, HALF], [-HALF, HALF]]]],   // the minimap's outline
  parts: [],
  won: 'Your Medusa brought the house down.',   // the winning end's line
  evolve: 'Your Medusa takes the stage.',
  start: [0, 0.01, 0.48],
  duration: 0,                        // straight into the fight
  clock: [360, 360],
  // tougher again than act 3: the Encore's Health, every hit you take, the XP
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

// The living room at dawn: the act's first scene, and the act as STAGES lists it
export const STAGE4 = {
  id: 4,
  name: 'The Encore',
  subtitle: 'Living room at dawn',
  rooms: STAGE1.rooms,
  parts: STAGE1.parts,                // act 1's apartment file (already cached from act 1)
  start: [3.05, 0, 4.4],              // just inside the hallway door, by the TV wall
  face: Math.PI,                      // facing the room, toward the window (run.js start)
  duration: 180,                      // seconds until the stage door opens (3:00)
  clock: [360, 480],                  // in-game minutes after midnight: 6:00 AM -> 8:00 AM
  sky: 'dawn',                        // the look: content/look.css --dawn-* (blue hour at 6:00 warming to gold by 8:00; main.js)
  window: { x: -0.3, y: [0.3, 2.45], z: [1.15, 4.0] },   // the glow card just outside the window (the glass on the desk wall, x 0; stage1.js)
  music: 'bloom',                     // stand-in: act 3's "Medusa Bloom" until act 4 has its own song
  // as tough as the arena (the act's numbers); `bugs` is act 3's pacing, a stand-in like the bugs
  // themselves (content/waves.kdl act=4)
  toughness: 3.5,
  power: 2,
  bugs: 0.7,
  xpMult: 1.6,

  noCollide: [],
  hide: STAGE1.hide,
  decor: [HALL_CLOCK],
  fade: {},
  doors: STAGE1.doors,
  walls: STAGE1.walls,                // the hallway opening and the safety floor, as in act 1
  vents: STAGE1.vents.map((v) => ({ ...v })),   // act 1's six (a copy: the layout editor moves this act's own)
  climbs: [],
  spots: STAGE1.spots,
  treasures: { at: [15, 65, 115], stay: 22 },   // three in the 3 minute night
  elites: [],                         // the opening acts come later

  // When the time is up this opens on the media console (stage1.js: x 0.9-2.4, z 4.35-4.8, top 0.6):
  // land on its top (the vent by the TV goes there) to go through to the arena
  stageDoor: {
    min: [0.9, 0.55, 4.35],
    max: [2.4, 1.3, 4.83],
    to: ENCORE,
    opens: '⏰ 8:00 AM! The stage door is open on the media console',
    hint: 'The stage door is open: get onto the media console by the TV',
  },

  // the act's boss, in its second scene (the Treasure book, the dev Fight boss and the death screen name it)
  boss: ENCORE.boss,
};
