// Stories: act 4's sun (sunrise.js, STAGE4.sun), in the living room at dawn. Its line creeps from the
// window wall toward the TV wall over the night; a jelly on the window side of it dries out.
import { bus, PLAYER } from '../events.js';
import { STAGE4 } from '../stage4.js';
import { juice } from '../juice.js';
import { G, V, fresh, night4, ok, record, spy, step, tp } from './kit.js';

const FLOOR = [3.4, 0, 2.2];   // open floor by the lounge chair (act 1's spot): sunlit from 2:24
const lineAt = (t) => G().run.sunrise.lineAt(t);

night4('the-sun-line-advances-on-time', {
  about: 'The sun\'s line runs across the room in x and moves from z 0.3 at the start of the night to z 3.3 at 3:00 (so 1.8 half way), then stays. It is painted, not lit: one sheet over the floor and furniture tops and its Warning volume on the line, no light added, and no shader built while it plays.',
  setup() { fresh(); },
  play() {
    const { run, APT, batcher, GAME } = G(), S = run.sunrise, lights = [];
    APT.scene.traverse((o) => { if (o.isLight) lights.push(o); });
    batcher.sync(); GAME.compile();
    const programs = APT.renderer.info.programs.length;
    const at = {};
    for (const t of [0, 90, 180, 250]) { run.t = t; step(1); at[t] = +S.line.toFixed(3); }
    run.t = 90; step(1);
    const volOnLine = S.vol.position.z === S.line && Math.abs(S.line - 1.8) < 0.01;
    const shown = S.sheet.visible && S.sheet.parent === APT.scene && S.vol.visible && S.vol.parent === APT.scene;
    run.t = 200; step(1);
    const stopped = !S.vol.visible && S.sheet.visible;   // the line has stopped: nothing more to warn of
    // stepping into it: the steam, the flash, the tag, the drying bell, all built already
    run.t = 150; tp(...FLOOR); step(60);
    batcher.sync(); GAME.compile();
    const newShaders = APT.renderer.info.programs.length - programs, after = [];
    APT.scene.traverse((o) => { if (o.isLight) after.push(o); });
    const across = S.sheet.geometry.boundingSphere && STAGE4.sun.across.join() === '0,5';
    return ok(at[0] === 0.3 && at[90] === 1.8 && at[180] === 3.3 && at[250] === 3.3 && volOnLine && shown && stopped && newShaders === 0 && after.length === lights.length && across,
      { at, volOnLine, shown, stopped, newShaders, lights: [lights.length, after.length] });
  },
});

night4('the-sun-drains-health-in-the-light', {
  about: 'A jelly standing on the window side of the line loses 3 Health a second (1.5 before act 4\'s power of 2), as damage_taken from the sun, counted under "sun" in the act\'s run log. Its bell dries out, steam comes off it, the tag says DRYING, and each second it bites the screen trembles (feel "sun").',
  setup() { fresh({ hurt: true }); },
  play() {
    const { run } = G(), hits = record('damage_taken'), feels = spy(juice, 'feel'), tags = spy(run.fx, 'number');
    run.t = 150; tp(...FLOOR);
    step(5);
    const s0 = run.lost.sun || 0;
    step(120);
    const rate = (run.lost.sun - s0) / 2, sun = hits.filter((h) => h.source === 'sun');
    const dried = run.sunrise.dryK > 0.9 && run.sunrise.lit, bites = feels.filter(([k]) => k === 'sun').length;
    return ok(Math.abs(rate - 3) < 0.15 && sun.length > 0 && sun.every((h) => h.targetId === PLAYER && h.drain)
      && dried && tags.some(([, text]) => text === 'DRYING') && bites >= 2,
    { rate, lostSun: run.lost.sun, events: sun.length, dryK: run.sunrise.dryK, tags: tags.map(([, t]) => t), bites });
  },
});

night4('drying-out-in-the-sun-names-the-sun', {
  about: 'Dying in the sun is a death by the sun: the run log\'s killedBy names it (unit and source "sun").',
  setup() { fresh({ hurt: true }); },
  play() {
    const { run } = G();
    run.t = 150; tp(...FLOOR); step(2);
    run.health = 0.5;
    step(60, () => run.phase === 'dead');
    return ok(run.phase === 'dead' && run.killedBy?.source === 'sun' && run.killedBy?.unit === 'sun', { phase: run.phase, killedBy: run.killedBy });
  },
});

night4('the-shade-and-the-stage-door-are-safe', {
  about: 'The same floor before the line reaches it costs nothing, and nor does the TV end of the room once the door is open: the line stops at z 3.3, a metre short of the stage door (z 4.35 up).',
  setup() { fresh({ hurt: true }); },
  play() {
    const { run } = G();
    run.t = 30; tp(...FLOOR); step(5);
    const h0 = run.health;
    step(120);
    const shade = h0 - run.health;
    // past time-up, the line has stopped: just inside the hallway door, by the stage door's console
    run.t = 400; tp(3.05, 0, 4.4); step(3);
    const h1 = run.health, lit1 = run.sunrise.lit;
    step(120);
    const door = h1 - run.health;
    return ok(shade === 0 && door === 0 && !lit1 && !run.sunrise.lit && lineAt(1e6) < STAGE4.stageDoor.min[2] && run.lost.sun === undefined,
      { shade, door, line: lineAt(1e6), lostSun: run.lost.sun });
  },
});

night4('the-sun-does-not-hurt-bugs', {
  about: 'Bugs in the sun are not hurt by it: the sun only ever damages the jelly.',
  setup() { fresh({ bubbles: false, lash: false }); },
  play() {
    const { run, enemies } = G(), hits = record('damage_taken');
    run.t = 170; tp(3.05, 0, 4.4);   // the jelly in the shade, by the hallway door
    const bugs = [0, 1, 2].map((i) => enemies.spawn('mantis', V(0.6 + i * 0.4, 0.01, 0.6), 1));
    const hp = bugs.map((e) => e.hp);
    step(60);
    const inSun = bugs.filter((e) => e.pos.z < run.sunrise.line).length;
    const sunOnBugs = hits.filter((h) => h.source === 'sun' && h.targetId !== PLAYER).length;
    return ok(inSun > 0 && sunOnBugs === 0 && bugs.every((e, i) => e.hp === hp[i]), { inSun, sunOnBugs, hp: bugs.map((e) => e.hp) });
  },
});

night4('chests-never-turn-up-where-the-sun-will-reach', {
  about: 'A room chest waits 22 s: it never turns up on floor or furniture the sun will reach before it fades. Rolled many times at each of the night\'s three chest times.',
  setup() { fresh(); },
  play() {
    const { run } = G(), stay = STAGE4.treasures.stay, bad = [], seen = new Set();
    for (const t of STAGE4.treasures.at) for (let i = 0; i < 40; i++) {
      run.t = t; run.lastTreasureSpot = null; run.recentTreasureSpots = [];
      const sp = run.nextTreasureSpot();
      if (!sp) continue;
      seen.add(`${t}:${sp.label}`);
      if (sp.at[2] <= lineAt(t + stay) + 0.06) bad.push(`${t}: ${sp.label} (z ${sp.at[2]})`);
    }
    // late in the night every spot left is past where the line will stop
    run.t = 170;
    const late = run.spots.filter((sp) => run.sunrise.shaded(sp.at[2], 170 + stay)).every((sp) => sp.at[2] > 3.36);
    return ok(!bad.length && seen.size > 3 && late, { bad, seen: [...seen] });
  },
});
