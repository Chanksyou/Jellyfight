// Stories: act 4, the Encore's concert (stage4.js, act4-arena.js, encore.js). The run comes here
// after beating the Pothos (tests/run.mjs opens these on an act-4 page with that run's carry). There
// is no night: the fight starts straight away, and beating the Encore wins the run. Shared helpers
// are in ./kit.js; src/stories.js imports this file in order.

import { CONTENT } from '../content.js';
import { G, act4, encoreFight, everyAttack, ok, record, step, stub } from './kit.js';

act4('the-encore-fight-starts-straight-away', {
  about: 'Act 4 has no night to explore: the run goes straight into the Encore\'s fight in the concert arena (no "Time\'s up!"), with its Health bar up, its set playing and no bugs waiting.',
  setup() {},
  play() {
    const { run, hud } = G(), toasts = [];
    stub(hud, 'toast', (t) => toasts.push(t));
    const B = encoreFight();
    step(30);
    const health = CONTENT.bosses.encore.hp * (run.stage.bossHp ?? 1);
    return ok(run.stage.id === 4 && run.phase === 'boss' && B?.constructor.name === 'Encore' && B.hp === health && !toasts.some((t) => /Time's up/.test(t)) && B.beat > 0,
      { act: run.stage.id, phase: run.phase, boss: B?.constructor.name, hp: B?.hp, health, beat: B?.beat, toasts });
  },
});

act4('its-beetles-hold-up-a-force-field-until-they-die', {
  about: 'At bar 8 (beat 32) the Encore calls 4 stag beetles onto the floor and a blue force field rises over its booth: while any beetle lives your hits bounce off. Kill the 4 and it takes damage again. 16 bars later (beat 96) it calls 4 more.',
  setup() {},
  play() {
    const B = encoreFight({ beat: 31.5 }), { enemies } = G();
    step(60);
    const called = B.guards.length, beetles = B.guards.every((g) => g.type === 'beetle'), up = B.shielded && B.field.visible;
    const hp0 = B.hp; B.damage(50);
    const bounced = B.hp === hp0;
    for (const g of [...B.guards]) enemies.kill(g);
    step(2);
    const down = !B.shielded && !B.field.visible;
    B.damage(50);
    const hurt = B.hp === hp0 - 50;
    B.clock = 95.5; step(60);
    const again = B.guards.length;
    return ok(called === 4 && beetles && up && bounced && down && hurt && again === 4, { called, beetles, up, bounced, down, hurt, again });
  },
});

act4('beating-the-encore-wins-the-run', {
  about: 'Bring the Encore\'s Health to 0 and the set stops: the jelly takes one more metamorphosis, then the run ends as a win ("brought the house down") with no Legendary pick and no act after it, and the score posts to the Leaderboard.',
  setup() {},
  async play() {
    const B = encoreFight(), { run, menus } = G();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const modal = () => document.querySelector('.jf-modal');
    let posted = null;
    stub(run, 'board', { status: 'online', keepBest: () => false, post: (e) => { posted = e; return Promise.resolve({ posted: true }); } });
    B.damage(B.hp + 1);
    step(10, () => run.bossWon);
    step(5);
    await wait(2400);
    const grow = modal()?.innerText || '';
    modal()?.querySelector('.jf-card')?.click();
    run.evolutionReveal.finish();
    const end = modal()?.innerText || '';
    const next = [...(modal()?.querySelectorAll('button') || [])].some((b) => /On to act/.test(b.textContent));
    [...modal().querySelectorAll('button')].find((b) => /Submit score/.test(b.textContent))?.click();
    await wait(50);
    menus.close();
    return ok(B.dead && run.bossWon && /Metamorphosis/.test(grow) && !/Legendary/.test(end) && /brought the house down/.test(end) && !next && posted?.won,
      { dead: B.dead, won: run.bossWon, grow: grow.slice(0, 160), end: end.slice(0, 160), next, posted: !!posted });
  },
});

act4('every-attack-is-listed', {
  about: 'Every Encore attack the game has is on the attack list (kit.js EVERY_ATTACK), and nothing listed is missing from the game.',
  setup() { encoreFight(); },
  play() { return everyAttack(4); },
});
