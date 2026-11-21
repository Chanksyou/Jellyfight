// The game's busiest moments, set up the same way wherever they're measured: the phone bench on a real
// device (src/bench.js, index.html?bench) and the headless measuring tool (tools/perf-phone.mjs). One
// table, so the two can't drift. No imports: Node reads PAGES and the moment names from it too.
//
// Each moment is ({ K, G, nav }) => void: K the story kit (src/stories/kit.js), G the window the game puts
// its objects on, nav stages.js's nav. It sets the moment up; the frames after it are measured. The jelly
// can't be hurt and bugs are held at 14 (act 3's most at once) with Health no attack gets through.

// the runs tests/run.mjs carries into later acts
const CARRY3 = { score: 12000, level: 10, xp: 0, purse: 6, stats: { health: 160 }, owned: [['goldRing', 1], ['nailClipper', 1]], grown: 0, growCount: 0, evolved: ['manOWar', 'upsideDown'] };
const CARRY4 = { score: 24000, level: 15, xp: 0, purse: 8, stats: { health: 200 }, owned: [['goldRing', 1], ['nailClipper', 1]], grown: 0, growCount: 0, evolved: ['manOWar', 'upsideDown', 'cinder'] };
// which act and scene each page opens, with the run it carries in (stages.js goToAct)
export const PAGES = {
  act1: {},
  act3: { act: { act: 3, carry: CARRY3 } },
  night4: { act: { act: 4, carry: CARRY4 } },
  arena: { act: { act: 4, scene: 2, carry: CARRY4 } },
};
export const pageFor = (act = 1, scene = 1) => (act === 3 ? 'act3' : act === 4 ? (scene === 2 ? 'arena' : 'night4') : 'act1');

const immortal = ({ K, G }) => { K.stub(G.run, 'hurt', () => {}); G.run.health = 1e6; };
function crowd({ K }, kinds) {
  const n = 14;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, r = 0.25 + (i % 3) * 0.1; K.spawn(kinds[i % kinds.length], K.near(Math.cos(a) * r, Math.sin(a) * r), { hp: 1e6 }); }
}
// the first moment after the quiet one in each page is its busiest: the bench replays it once per switch
export const MOMENTS = {
  act1: {
    'quiet room': (c) => { c.K.fresh({ elites: false }); immortal(c); },
    'bugs + Controller': (c) => {
      c.K.startController(0); immortal(c); crowd(c, ['roach', 'ants', 'mosquito', 'lanternfly']);
      const e = c.G.run.elites.list.find((x) => x.kind === 'controller'); e.hp = e.maxHp * 0.5;
    },
    'Vacuum fight': (c) => { c.K.startVacuum('spin'); immortal(c); },
    // the jelly holding the 13 Treasures the Treasure juice plan dressed up, in a 14-bug crowd, two Night-Lights plugged in
    'treasure storm': (c) => {
      const { K, G } = c;
      K.fresh({ elites: false }); immortal(c);
      K.give('glowStick', 'bloodyFangs', 'newtonsCradle', 'snooze', 'rubberDuck', 'cactus', 'guitarPick', 'fairyLights', 'magnifier', 'discoBall', 'bathSalt', 'nightLight', 'iceCube');
      crowd(c, ['roach', 'ants', 'mosquito', 'lanternfly']);
      const P = G.player.position;
      for (const dx of [-0.15, 0.15]) G.run.gadgets.plugIn(P.clone().setX(P.x + dx), G.run.mods.nightLight);
      K.step(120);
    },
  },
  act3: {
    'bugs + Alligator angry': (c) => { c.K.startCroc(0, { angry: true }); immortal(c); crowd(c, ['dragonfly', 'mantis', 'beetle']); },
    'shark fight': (c) => { c.K.sharkFight(); immortal(c); },
  },
  night4: {
    'three bugs + 12 Firefly pools': (c) => {
      const { K, G } = c;
      K.fresh({ elites: false, bubbles: false, lash: false }); K.tp(3.2, 0.05, 3.0, 0); immortal(c); crowd(c, ['firefly', 'moth', 'cicada']);
      const P = G.player.position, L = { flight: 1.2, peak: 0.2, radius: 0.14, dmg: 2, drain: 1, last: 10, most: 12 };
      for (let i = 0; i < 12; i++) { const to = P.clone().add(new G.THREE.Vector3(-0.3 + (i % 4) * 0.2, 0, -0.3 + Math.floor(i / 4) * 0.2)); G.enemies.glowPools.throw(to.clone().setY(to.y + 0.15), to, L, -1, 'firefly'); }
      K.step(90);
    },
    'Singing Bowl angry': (c) => { c.K.startBowl(0, { angry: true }); immortal(c); },
    'Mushroom Pillow angry': (c) => { c.K.startPillow(0, { angry: true }); immortal(c); },
    'Headphones angry': (c) => { c.K.startHeadphones(0, { angry: true, hold: true }); immortal(c); },
    'bass wave + sun': (c) => {
      const { K, G } = c;
      K.fresh({ bubbles: false, lash: false }); K.tp(3.2, 0.05, 3.0, 0); immortal(c);
      G.run.t = 150; K.step(2); K.stub(G.run, 'song', null); G.run.beat = G.run.bass.next - 3.5;
    },
    'stage door opens': (c) => {
      const { K, G } = c;
      K.fresh({ bubbles: false, lash: false }); immortal(c); K.stub(c.nav, 'reload', () => {}); G.run.t = G.run.duration - 1; K.tp(1.9, 0.05, 4.2, 0);
    },
  },
  arena: {
    'Encore disco': (c) => { c.K.encoreFight({ beat: 126 }); immortal(c); },
    'Encore drop (two waves + lasers)': (c) => { c.K.encoreFight({ beat: 96 }); immortal(c); },
  },
};
export const busiest = (page) => Object.keys(MOMENTS[page]).find((n) => n !== 'quiet room');

// The heaviest stacks of see-through marks, for the Overdraw view (src/overdraw.js, tools/perf-phone.mjs --overdraw): not in
// MOMENTS, so the bench never plays them. Same shape and same pages; the Vacuum (its spin), Firefly pools and bass + sun moments above count too.
export const STACKS = {
  act1: {
    'bubble storm + Bubble Bath': (c) => {
      const { K, G } = c;
      K.fresh({ elites: false }); K.give('bubbleBath'); immortal(c); crowd(c, ['roach', 'ants']);
      Object.assign(G.run.S, { bubbles: 5, fireRate: 8, range: 0.6 });
      K.step(120);
    },
  },
  arena: {
    'Encore Pyro, six lanes': (c) => {
      const B = c.K.encoreFight({ beat: 96 }); immortal(c); c.K.step(5);
      const b = B.pyro.beat, set = (n) => [0, 1, 2].map((i) => i * 2 + n);
      B.pyro.cast(b + 5, { lanes: set(0), warn: 5 }); B.pyro.cast(b + 6, { lanes: set(1), warn: 6 });   // both Warnings up and filling for the whole sample (the flames come after)
      c.K.step(5);
    },
  },
};
