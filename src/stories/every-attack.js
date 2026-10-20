// Stories: every Elite and Boss attack, checked per act. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import { CONTENT } from '../content.js';
import { makeBoss } from '../run.js';
import { G, act2, asNewPlayer, everyAttack, fresh, ok, r3, sim, step, story, tp } from './kit.js';

// --- 3D attacks, every one checked per act: each Elite and Boss attack is listed here with what it
story('bosses/unknown-kind-is-an-error', {
  about: 'A stage whose boss block names a kind of boss the game doesn\'t have (run.js BOSSES) is an error that names it, not a quiet fight with some other boss.',
  setup() {},
  play() {
    const { APT, enemies, fx, world } = G();
    let error = '';
    try { makeBoss({ kind: 'toaster', name: 'The Toaster' }, APT.scene, enemies, fx, world); } catch (e) { error = e.message; }
    return ok(/toaster/.test(error) && /hair/.test(error), { error });
  },
});
story('attacks/act-1-every-warning-has-volume', {
  about: 'Every Controller, Mug, Kettle and Vacuum attack in turn: each Warning before a Blast, lane, ring or cone shows its floor shape with its volume over it, filling together; both go after the hit; none builds a new shader.',
  setup() { fresh({ bubbles: false, lash: false }); },
  play() { return everyAttack(1); },
});
act2('attacks-every-warning-has-volume', {
  about: 'Every Soap Dispenser, Wall Clock, Cream Whipper and Clog attack in turn: each Warning before a Blast, lane, ring, half slab or cone shows its floor shape with its volume over it, filling together; both go after the hit; none builds a new shader.',
  setup() { fresh({ bubbles: false, lash: false }); },
  play() { return everyAttack(2); },
});

act2('soap-slick-slides', {
  about: 'Soap underfoot: let go on a slick and you keep sliding a long way; off it you stop almost at once.',
  setup() { fresh({ elites: false }); tp(2.75, 0.05, 6.6, 0); },
  play() {
    const { run, player } = G();
    const glide = (soapy) => {
      tp(2.75, 0.05, 7.2, Math.PI);
      if (soapy) for (let k = 0; k < 7; k++) run.elites.slick(player.position.clone().setZ(player.position.z + 0.24 + k * 0.08), 0.07, 9);   // ahead, where you let go
      sim(0.6, ['KeyW']);
      const p0 = player.position.clone();
      sim(0.5);
      const d = player.position.distanceTo(p0);
      run.elites.clear();
      return d;
    };
    const dry = glide(false), wet = glide(true);
    return ok(wet > dry * 2.5 && wet > 0.05, { dry: +dry.toFixed(3), wet: +wet.toFixed(3) });
  },
});

act2('closets-are-shut', {
  about: 'The closet doors stand ajar to peek in, but a force field keeps you out of both (and out of the living room).',
  setup() { fresh({ elites: false }); },
  play() {
    const walk = (x, z, yaw) => { fresh({ elites: false }); tp(x, 0.05, z, yaw); return sim(3, ['KeyW']).pos; };
    const laundry = walk(3.3, 5.3, -Math.PI / 2), coat = walk(2.8, 5.4, Math.PI / 2), living = walk(3.0, 5.3, 0);
    return ok(laundry[0] < 3.6 && coat[0] > 2.5 && living[2] > 4.85, { laundry, coat, living });
  },
});

act2('only-act-2-bugs', {
  about: 'Act 2\'s waves are only its four bugs (house flies, spiders, millipedes, ladybugs), none of act 1\'s.',
  setup() { fresh({ waves: true, elites: false }); G().run.t = 200; },
  play() {
    const { run, enemies } = G();
    const pool = new Set(CONTENT.waves.bugs.filter((b) => b.act === 2).map((b) => b.id));
    const seen = new Set();
    step(1800, () => { for (const e of enemies.list) if (!e.proxy && !e.elite) seen.add(e.type); run.t = 200; });
    const stray = [...seen].filter((t) => !pool.has(t));
    return ok(pool.has('spider') && pool.has('housefly') && pool.has('ladybug') && seen.size >= 3 && !stray.length, { seen: [...seen], stray });
  },
});

act2('carries-the-run', {
  about: 'Act 2 starts with what act 1 left you: level, treasures and the score so far.',
  setup() { fresh(); },
  play() {
    const { run } = G();
    return ok(run.level === 6 && run.owned.has('candle') && run.score() >= 5000 && run.health === run.stats.health && run.stats.health === 130,
      { level: run.level, owned: [...run.owned], score: run.score(), health: run.health });
  },
});

act2('never-a-first-run', {
  about: 'Act 2 never runs in first-run mode, even for a browser with no record of a finished run.',
  setup() { fresh(); },
  play() {
    const active = asNewPlayer(() => { G().run.start(); return G().run.firstRun.active; });
    return ok(!active, { active });
  },
});

act2('treasure-spots', {
  about: 'Treasures can turn up all over the hallway and bathroom, each on a real surface you can reach.',
  setup() { fresh(); },
  play() {
    const { run } = G();
    return ok(run.spots.length >= 12 && !run.spotRejects.length && run.spots.every((sp) => run.inStage(sp.at[0], sp.at[2])),
      { kept: run.spots.length, rejects: run.spotRejects });
  },
});

act2('the-clog', {
  about: 'When time is up, the Clog rises from the bathtub drain and you face it in the tub.',
  setup() { fresh(); },
  play() {
    const { run, menus, player } = G();
    run.startBossIntro();
    step(240, () => { if (menus.open) document.querySelector('.jf-card')?.click(); return run.phase === 'boss'; });
    step(60);
    const B = run.stage.boss, P = player.position;
    const inTub = P.x > B.arenaMin[0] && P.x < B.arenaMax[0] && P.z > B.arenaMin[2] && P.z < B.arenaMax[2];
    return ok(run.phase === 'boss' && run.boss?.kind === 'hair' && inTub, { phase: run.phase, kind: run.boss?.kind, at: r3(P) });
  },
});

act2('leads-to-act-3', {
  about: 'Beating the Clog, growing and taking a Legendary treasure offers the way on to act 3, the bedroom, with the score so far: the act 2 end no longer says act 3 is coming.',
  setup() { fresh(); },
  play() {
    const { run, menus } = G();
    run.metamorph();
    document.querySelector('.jf-card')?.click();     // the evolution
    document.querySelector('.jf-evolution-footer button').click(); // skip its transformation
    document.querySelector('.jf-card')?.click();     // the boss's Legendary
    const text = document.querySelector('.jf-modal')?.innerText || '';
    const go = [...document.querySelectorAll('.jf-modal button')].some((b) => /On to act 3/.test(b.textContent));
    menus.close();
    return ok(go && /Act 2 complete/.test(text) && /bedroom/i.test(text) && /Score so far/.test(text) && !/coming soon/.test(text), { go, text: text.slice(0, 200) });
  },
});
