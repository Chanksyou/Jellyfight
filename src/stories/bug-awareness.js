// What bugs notice (content/waves.kdl notice, lose-track, startle): a new bug stands head up for a moment,
// the floor bugs lose a jelly that goes up a vent, and a bug beside one that dies steps aside.
import { bus } from '../events.js';
import { G, V, fresh, holdJelly, near, ok, setupFight, spawn, step, story, stub, tp } from './kit.js';

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const calm = () => { const { run } = G(); stub(run, 'hurt', () => {}); stub(run, 'hit', () => {}); run.health = 1e6; };
const newest = () => G().enemies.list.filter((e) => !e.dead && !e.proxy).pop();

story('bugs/notice-before-chasing', {
  about: 'A bug the night sends out stands still for 0.3 to 0.5 s before it walks (a first run\'s bugs do not wait): it has not moved after a quarter second and has begun to by a second.',
  setup() {},
  play() {
    const { run, enemies } = G(), spawnWaves = Object.getPrototypeOf(run).spawnWaves;
    const send = () => { enemies.clear(); stub(run, 'spawnPoint', () => near(0.7, 0)); run.spawnAcc = 1; spawnWaves.call(run, 0.001); return newest(); };
    setupFight(); calm();
    const e = send(), waits = e?.noticeT, from = e?.pos.clone();
    step(15); const early = e ? flat(e.pos, from) : -1;
    step(45); const late = e ? flat(e.pos, from) : -1;
    if (e) enemies.kill(e, true);
    fresh({ elites: false, bubbles: false, lash: false, firstRun: true }); tp(3.2, 0.05, 3.0, 0); calm();
    const f = send(), first = f?.noticeT;
    if (f) enemies.kill(f, true);
    return ok(e && waits >= 0.3 && waits <= 0.5 && early < 0.01 && late > 0.05 && f && first === undefined, { waits, early, late, first });
  },
});

story('bugs/mill-about-when-the-jelly-leaves-the-floor', {
  about: 'When a vent catches the jelly, a Cockroach a metre away mills about for 1.2 s (it goes less than a third as far toward the jelly as it would), then heads for the spot beneath it and comes closer.',
  setup() { setupFight({ bubbles: false, lash: false }); holdJelly(); calm(); },
  play() {
    const { enemies } = G(), P = G().player.position;
    const run = (lose) => {
      enemies.clear(); enemies.lostT = 0;
      const e = spawn('roach', V(P.x - 1, P.y + 0.01, P.z), { hp: 1e7 });
      step(30);
      const d0 = flat(e.pos, P);
      if (lose) bus.emit('vent_ride', { vent: 'story' });
      step(60); const d1 = flat(e.pos, P);
      step(180); const d2 = flat(e.pos, P);
      enemies.kill(e, true);
      return { gained: +(d0 - d1).toFixed(3), later: +(d1 - d2).toFixed(3) };
    };
    const lost = run(true), kept = run(false);
    return ok(lost.gained < kept.gained * 0.5 && lost.later > 0.3, { lost, kept });
  },
});

story('bugs/startle-when-a-neighbour-dies', {
  about: 'A Cockroach 6 cm from one that dies steps aside, away from where it fell, for about 0.4 s instead of walking on toward the jelly.',
  setup() { setupFight({ bubbles: false, lash: false }); holdJelly(); calm(); },
  play() {
    const { enemies } = G(), P = G().player.position;
    const a = spawn('roach', V(P.x + 0.7, P.y + 0.01, P.z), { hp: 1e7, still: true }), b = spawn('roach', V(P.x + 0.7, P.y + 0.01, P.z + 0.06), { hp: 1e7 });
    step(2);
    const z0 = b.pos.z;
    enemies.kill(a, true);
    step(18);
    const aside = b.pos.z - z0;   // along the way from where it fell (+z); the jelly is along -x
    step(120);
    enemies.kill(b, true);
    return ok(aside > 0.03, { aside: +aside.toFixed(3) });
  },
});
