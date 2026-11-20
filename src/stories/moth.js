// Stories: the moth (act 4) and the `plunge` that drops it on you. Shared helpers are in ./kit.js; src/stories.js imports this file in order.
import { G, JUMP_FEET, V, fresh, holdJelly, near, night4, ok, record, spawn, spy, step, stub, tp, story } from './kit.js';

// a moth ready to plunge at a held jelly; the jelly's feet are at floor + feetUp
const plungeSetup = () => { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const m = spawn('moth', near(0.3, 0, 0.1)); m.diveCd = 0; return m; };
const FLOOR = () => G().enemies.floorBelow(G().player.position, G().player.position.y);

story('words/plunge', {
  about: 'A moth circles you, then climbs about 40 cm over you while a circle and a column fill under it; it drops straight down into the column for 5, lives, pulls up and comes round again for a second plunge.',
  act: 4,
  setup() { plungeSetup(); },
  play() {
    const { enemies } = G(), m = enemies.list[0], log = record('damage_taken'), states = new Set();
    const floor = FLOOR(); let top = 0, marks = false, ascending = true, fell = 0;
    const stings = () => log.filter((d) => d.source === 'moth' && d.amount === 5).length;
    holdJelly();
    step(60 * 14, () => {
      states.add(m.state); top = Math.max(top, m.pos.y - floor);
      if (m.state === 'climb' && enemies.plungeMarks.some((M) => M.floor.visible && M.vol.visible)) marks = true;
      if (m.state === 'drop' && m.pos.y - floor > 0.12) fell++;
      return stings() >= 2;
    });
    return ok(stings() >= 2 && top > 0.3 && marks && fell > 0 && states.has('climb') && states.has('drop') && !m.dead, { stings: stings(), top: +top.toFixed(2), marks, fell, states: [...states], dead: m.dead });
  },
});

story('words/plunge-step-off', {
  about: 'Stepping out of the circle after it locks dodges the plunge: no hit, but the smoke still comes.',
  act: 4,
  setup() { plungeSetup(); },
  play() {
    const { enemies, player, fx } = G(), m = enemies.list[0], log = record('damage_taken'), puffs = spy(fx, 'smoke');
    holdJelly(); let moved = false;
    step(60 * 6, () => { if (!moved && m.state === 'drop') { player.position.x += 0.3; moved = true; } return puffs.length > 0; });
    return ok(moved && puffs.length === 1 && !log.some((d) => d.source === 'moth'), { moved, puffs: puffs.length, hits: log.filter((d) => d.source === 'moth').length });
  },
});

story('words/plunge-jump', {
  about: 'A jump inside the circle still gets hit: the column is as tall as the Warning shows.',
  act: 4,
  setup() { plungeSetup(); },
  play() {
    const { enemies, player } = G(), m = enemies.list[0], log = record('damage_taken');
    holdJelly(); const floor = FLOOR(); let jumped = false;
    step(60 * 6, () => { if (!jumped && m.state === 'drop') { player.position.y = floor + JUMP_FEET; jumped = true; } return log.some((d) => d.source === 'moth' && d.amount === 5); });
    return ok(jumped && log.some((d) => d.source === 'moth' && d.amount === 5), { jumped, hits: log.filter((d) => d.source === 'moth').length });
  },
});

story('words/plunge-smoke', {
  about: 'A plunge leaves a puff of black smoke that hangs about a second and then thins out and is gone; there are never more than three puffs, and it draws over bugs but under the jelly and every Warning.',
  act: 4,
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { fx, player } = G(), alive = () => fx.smokes.filter((s) => s.alive).length, at = player.position.clone();
    fx.smoke(at); step(60 * 0.9); const holding = alive() === 1 && fx.smokes[0].blobs[0].userData.opacity > 0.8;
    step(60 * 1.0); const gone = alive() === 0;
    for (let i = 0; i < 6; i++) fx.smoke(at.clone().add(V(i * 0.1, 0, 0)));
    const most = alive(), blobs = fx.smokes.reduce((n, s) => n + s.blobs.length, 0);
    return ok(holding && gone && most === 3 && blobs <= 12 && fx.smokeMat.userData.renderOrder < 2, { holding, gone, most, blobs });
  },
});

night4('moth-from-0-45', {
  about: 'Act 4\'s night brings moths from 0:45, and not before: a roll favouring the last eligible bug cannot spawn one at 0:44.9, but does at 0:45.',
  setup() { fresh({ waves: true, elites: false }); },
  play() {
    const { run, enemies, player } = G();
    stub(Math, 'random', () => 0.999999);
    stub(run, 'spawnPoint', () => player.position.clone());   // eligibility is separate from scenery placement
    const during = (t) => { enemies.clear(); run.t = t; run.spawnAcc = 1; run.spawnWaves(0); return enemies.list.filter((e) => e.type === 'moth').length; };
    const before = during(44.9), after = during(45);
    return ok(!before && after > 0, { before, after });
  },
});
