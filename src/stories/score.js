// The score (src/score.js): what each act pays, from what the jelly did in it, and the counts the run
// keeps for it (run.js scoreFacts): the night's bugs, damage taken before the Shield, the boss's time.
import { bus, PLAYER } from '../events.js';
import { SCORE, SEASON, actParts, actScore, MAX_SCORE } from '../score.js';
import { STAGES } from '../stages.js';
import { G, fresh, give, near, ok, setupFight, spawn, step, story, stub } from './kit.js';

const PERFECT = { nightShare: 1, bossShare: 1, won: true, elites: 3, bugsOut: 40, bugsCleared: 40, damageTaken: 0, bossSeconds: 45 };
const NOTHING = { nightShare: 0, bossShare: 0, won: false, elites: 0, bugsOut: 0, bugsCleared: 0, damageTaken: 0, bossSeconds: null };
const CEILING = { night: SCORE.night, bossDamage: SCORE.bossDamage, bossBeaten: SCORE.bossBeaten, elites: SCORE.elite * SCORE.elites, bugs: SCORE.bugs, clean: SCORE.clean, pace: SCORE.pace };
const part = (facts, key) => actParts(facts).find(([k]) => k === key)[1];

story('score/a-perfect-act-is-the-tables-maximum', {
  about: 'A perfect act (the whole night, the boss beaten within a minute with no damage, 3 Elites, every bug cleared) scores exactly the table\'s ceilings added up, 15,500, and a run\'s cap is that times 4 acts.',
  setup: () => {},
  play() {
    const sum = Object.values(CEILING).reduce((n, v) => n + v, 0), act = actScore(PERFECT);
    return ok(act === sum && act === 15500 && MAX_SCORE === sum * SCORE.acts && MAX_SCORE === 62000, { act, sum, MAX_SCORE });
  },
});

story('score/each-part-earns-its-ceiling-or-nothing', {
  about: 'Each part pays its ceiling for a perfect act and nothing for an act where nothing happened; halfway (half the night, half the boss, half the bugs, 50 damage, a 120 s fight) pays half; more than 3 Elites still pays for 3.',
  setup: () => {},
  play() {
    const top = Object.fromEntries(actParts(PERFECT)), none = Object.fromEntries(actParts(NOTHING));
    const ceilings = Object.entries(CEILING).every(([k, v]) => top[k] === v), zero = Object.values(none).every((v) => v === 0);
    const half = Object.fromEntries(actParts({ ...PERFECT, nightShare: 0.5, bugsCleared: 20, damageTaken: 50, bossSeconds: 120 }));
    const halves = half.night === SCORE.night / 2 && half.bugs === SCORE.bugs / 2 && half.clean === SCORE.clean / 2 && half.pace === SCORE.pace / 2;
    const bossHalf = part({ ...NOTHING, bossShare: 0.5 }, 'bossDamage') === SCORE.bossDamage / 2;
    const elites = part({ ...PERFECT, elites: 5 }, 'elites') === SCORE.elite * SCORE.elites;
    const worst = part({ ...PERFECT, damageTaken: 400, bossSeconds: 600 }, 'clean') === 0 && part({ ...PERFECT, bossSeconds: 600 }, 'pace') === 0;
    return ok(ceilings && zero && halves && bossHalf && elites && worst, { top, none, half, bossHalf, elites, worst });
  },
});

story('score/clean-play-and-boss-pace-only-for-a-cleared-act', {
  about: 'Clean play, Boss pace and the boss beaten pay only when the act is cleared: an act lost untouched, with a fast fight, earns none of them.',
  setup: () => {},
  play() {
    const lost = Object.fromEntries(actParts({ ...PERFECT, won: false, bossShare: 0.9 }));
    const unpaid = lost.clean === 0 && lost.pace === 0 && lost.bossBeaten === 0 && lost.bossDamage === SCORE.bossDamage * 0.9;
    return ok(unpaid, lost);
  },
});

story('score/shield-soaked-damage-lowers-clean-play', {
  about: 'A hit the Shield soaks whole still counts as damage taken, so Clean play falls with it; a hit the jelly dodges counts nothing.',
  setup: () => setupFight({ hurt: true, bubbles: false, lash: false }),
  play() {
    const { run } = G();
    run.stats.shield = 50; step(1);
    const health = run.health, k = run.stage.power || 1;
    run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount: 40, source: 'story' });
    const soaked = run.health === health && Math.abs(run.taken - 40 * k) < 1e-6;
    run.stats.dodge = 30; stub(Math, 'random', () => 0);   // the next hit is dodged
    run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount: 30, source: 'story' });
    const dodged = Math.abs(run.taken - 40 * k) < 1e-6;
    const clean = actParts({ ...PERFECT, damageTaken: run.scoreFacts().damageTaken }).find(([key]) => key === 'clean')[1];
    return ok(soaked && dodged && clean === Math.round(SCORE.clean * (1 - 40 * k / SCORE.cleanGone)), { soaked, dodged, taken: run.taken, clean, health: run.health });
  },
});

story('score/treasures-and-levels-add-nothing', {
  about: 'Taking Treasures and Levels changes the score not at all: only deeds score.',
  setup: () => fresh({ elites: false }),
  play() {
    const { run } = G(), before = run.score();
    give('goldRing', 'candle', 'candle'); run.level += 5;
    const after = run.score();
    return ok(after === before && !run.scoreParts().some(([k]) => /Level|Treasure|Survival/.test(k)), { before, after, parts: run.scoreParts() });
  },
});

story('score/bugs-cleared-counts-the-nights-bugs', {
  about: 'Bugs cleared is the share of the night\'s bugs the jelly cleared: each counts as it comes out, one the game removes (time\'s up) never counts as cleared, and the boss fight\'s bugs count on neither side.',
  setup: () => fresh({ elites: false }),
  play() {
    const { run, enemies } = G();
    const bugs = [0, 1, 2, 3].map((i) => spawn('roach', near(0.1 * i, 0.2), { still: true }));
    enemies.kill(bugs[0]); enemies.kill(bugs[1]); enemies.kill(bugs[2], true);
    const night = run.bugsOut === 4 && run.bugsCleared === 2;
    const half = run.scoreParts().find(([k]) => k === 'Bugs cleared')?.[1] === SCORE.bugs / 2;
    stub(run, 'phase', 'boss');
    enemies.kill(spawn('roach', near(0.3, 0.3), { still: true }));
    const boss = run.bugsOut === 4 && run.bugsCleared === 2;
    return ok(night && half && boss, { out: run.bugsOut, cleared: run.bugsCleared, half, boss });
  },
});

story('score/counts-survive-a-reload-and-reach-the-run-log', {
  about: 'The act\'s score counts ride a reload mid-act (progress / resumeAct), and each act\'s run log row carries them under details.score.',
  setup: () => fresh({ elites: false, lash: false }),
  play() {
    const { run } = G(), rows = [];
    Object.assign(run, { bugsOut: 12, bugsCleared: 9, taken: 23.46 });
    const M = run.progress();
    Object.assign(run, { bugsOut: 0, bugsCleared: 0, taken: 0 });
    run.resumeAct(M);
    const back = run.bugsOut === 12 && run.bugsCleared === 9 && run.taken === 23.46;
    stub(run, 'telemetryDisabled', false);
    stub(run, 'board', { runLog: {}, saveRun: (row) => rows.push(row) });
    step(2);
    run.recordRun('in-progress');
    const s = rows.at(-1)?.details.score;
    const logged = s && s.bugsOut === 12 && s.bugsCleared === 9 && s.damageTaken === 23.5 && s.bossSeconds === null && s.nightShare >= 0 && s.bossShare === 0 && !('won' in s);
    return ok(back && logged, { back, s });
  },
});

story('score/the-worker-scores-the-run-log-the-same', {
  about: 'What the Worker scores from the run log (each act\'s details.score, its Elites and its outcome, worker/index.js runFacts) is the score the game carries on to the next act, even after the act complete screen has been up a while; each logged act carries the season.',
  setup: () => fresh({ elites: false, lash: false }),
  play() {
    const { run, menus } = G(), rows = [];
    Object.assign(run, { bossWon: true, bossTime: 55.04, elitesBeaten: 2, bugsOut: 31, bugsCleared: 22, taken: 12.34, t: STAGES[0].duration, dev: false, logStarted: true });
    stub(run, 'telemetryDisabled', false);
    stub(run, 'board', { runLog: {}, saveRun: (row) => rows.push(row) });
    let carry = null;
    const real = run.carryOver.bind(run);
    stub(run, 'carryOver', () => (carry = real()));
    run.actComplete(STAGES[1]);
    step(30);
    run.recordRun('next-act');   // what On to act 2 logs before it goes
    menus.close();
    const row = rows.at(-1), d = row?.details || {};
    const worker = actScore({ ...d.score, elites: d.elitesBeaten, won: row?.outcome === 'next-act' || row?.outcome === 'won' });
    return ok(row && worker === carry.score && row.score === carry.score && d.season === SEASON, { worker, carried: carry?.score, logged: row?.score, season: d.season });
  },
});
