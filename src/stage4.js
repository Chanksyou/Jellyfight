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

// The living room's three Elites, as plain data (STAGE4.elites spawns those whose kinds exist in
// elites.js; the threads building the others add them there). Each stands on its own furniture,
// clear of the clutter (layout-baked.js act 4 moves and hides the props round them).
//   at: where it stands (world metres, y = the surface)   face: yaw toward its vent's landing (the jelly's side)
//   wake: the box that wakes it   vent: the vent that lands you on the same furniture (`land`)
//   hide: the apartment object it stands in for while alive   stand: where a 1 on 1 with it puts you
// No two are ever awake together (guard story night4/elite-spots-are-spread-out): their wake boxes never
// overlap and each stands 2 m or more from the next.
// "Nothing from the back shelves" (Chan): the Glass-dome speaker is up there, so the third is the Headphones.
export const ELITES4 = [
  { kind: 'bowl', hide: 'Singing_bowl', area: 'lounge chair', face: 0, vent: 'Vent by the lounge chair',
    at: [3.17, 0.435, 0.903], wake: { min: [2.82, 0.38, 0.593], max: [3.49, 1.2, 1.433] }, stand: [3.17, 0.435, 1.223],
    seat: { min: [2.95, 0.803], max: [3.39, 1.303] } },   // seat: the cushion's top (x, z), where the bowl's Hum fills (measured: the wake box also takes in the chair's back and arms)
  { kind: 'pillow', hide: 'Mushroom_pillow', area: 'sofa', face: -0.695, vent: 'Vent by the sofa',
    at: [1.165, 0.51, 1.282], wake: { min: [0.515, 0.46, 0.482], max: [2.015, 1.2, 1.782] }, stand: [1.215, 0.511, 1.582] },
  { kind: 'headphones', hide: 'Headphones', area: 'kitchen counter', face: -2.906, vent: 'Vent by the stove',
    at: [4.62, 0.94, 2.85], wake: { min: [4.35, 0.89, 1.7], max: [5.0, 1.6, 3.0] }, stand: [4.57, 0.94, 2.65] },
];

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
  music: 'sunrise',                   // "Sunrise Set" (music.js)
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
  vents: STAGE1.vents.map((v) => ({ ...v })),   // act 1's six (a copy: the layout editor moves this act's own; the three by the Elites land clear of them: layout-baked.js)
  climbs: [],
  // act 1's spots, less the two the Elites' props now crowd (the sofa seat under the Mushroom pillow, the lounge chair seat)
  spots: STAGE1.spots.filter((sp) => !['sofa seat', 'lounge chair'].includes(sp.label)),
  treasures: { at: [15, 65, 115], stay: 22 },   // three in the 3 minute night
  // the opening acts (elites.js): the Singing Bowl, the Mushroom Pillow and the Headphones
  elites: ELITES4,
  eliteHp: 2.8,                       // a stand-in until the tuning phase picks act 4's: act 3's 2.4 grown as its toughness grows (3 -> 3.5): 800 x 2.8 = 2240

  // The sun (sunrise.js): its line runs straight across the room in x and creeps from the window
  // wall (z `from`) to `to` over the night (`duration`), then stays. All of the room on the window
  // side of it is sunlit, floor and furniture tops alike, and a jelly there loses `drain` Health a
  // second before the act's `power` (1.5 x 2 = 3; the Clog's acid is 2.667 x 1.5 = 4). Bugs and
  // Elites aren't hurt. It never reaches the stage door (z 4.35 up). `across`: the room's x span.
  sun: { from: 0.3, to: 3.3, drain: 1.5, across: [0, 5] },

  // The Soundbar's bass wave (bass-wave.js): every `every` bars of the song (16: 30 s at 128 BPM), on the
  // bar, one low wave rolls from the TV wall (z `from`, the media console's front) to the window wall
  // (z `to`), the room's width (`across`), `width` m deep and `height` m tall, at `speed` m/s (4 s across):
  // `dmg` to anything of the jelly under its top as it passes (a bug's heavy hit; x the act's power).
  // A jump clears it; furniture tops stand above it.
  bass: { every: 16, height: 0.05, width: 0.1, speed: 1.1, dmg: 4, from: 4.35, to: 0, across: [0, 5] },

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
