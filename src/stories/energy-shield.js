import { bus, PLAYER } from '../events.js';
import { CONTENT } from '../content.js';
import { G, evolve, fresh, give, near, ok, record, setupFight, spawn, step, story } from './kit.js';

const hit = (amount, drain = false) => { G().run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount, source: 'story', drain }); };
const setup = () => { setupFight({ hurt: true, bubbles: false, lash: false }); evolve('aegis'); step(1); };

story('treasures/energy-shield', {
  about: 'Aegis absorbs 10 damage, explodes once for a flat 10 within 20 cm, and passes overflow to Health.',
  setup,
  play() {
    const { run } = G(), log = record('damage_taken'), hp = run.health;
    const close = spawn('roach', near(0.1, 0), { still: true, hp: 100 });
    const far = spawn('roach', near(0.5, 0), { still: true, hp: 100 });
    run.stats.bubbleDamage = 100;
    hit(4);
    const partial = run.energyShield.hp === 6 && run.health === hp;
    step(60 * 9);
    const noPartialRefill = run.energyShield.hp === 6;
    hit(8);
    const burst = log.filter((d) => d.source === 'energy-shield');
    const broken = run.energyShield.hp === 0 && run.energyShield.cooldown === 6 && !run.energyShield.group.visible;
    hit(1);
    return ok(partial && noPartialRefill && broken && run.health === hp - 3 && close.hp === 90 && far.hp === 100 && burst.length === 1 && burst[0].amount === 10,
      { partial, noPartialRefill, broken, health: run.health, close: close.hp, far: far.hp, burst: burst.map((d) => d.amount) });
  },
});

story('evolutions/energy-shield-recharge', {
  about: 'The shield returns exactly six gameplay seconds after breaking; pauses and unrelated treasure changes cannot refill it early, and its HUD icon shows the wait.',
  setup,
  play() {
    const { run } = G(); hit(10);
    const start = run.cooldowns().aegis?.left;
    give('coffeeBean'); step(1);
    const preserved = run.energyShield.hp === 0;
    document.getElementById('g-over').hidden = false;
    const wait = run.energyShield.cooldown; step(120);
    const paused = run.energyShield.cooldown === wait;
    document.getElementById('g-over').hidden = true;
    step(358);
    const waiting = run.energyShield.hp === 0 && run.energyShield.cooldown > 0;
    step(2);
    const ready = run.energyShield.hp === 10 && run.energyShield.cooldown === 0 && run.energyShield.group.visible && run.cooldowns().aegis?.left === 0;
    return ok(start === 1 && preserved && paused && waiting && ready, { start, preserved, paused, waiting, ready });
  },
});

story('evolutions/energy-shield-drain-reset-and-carry', {
  about: 'Drain also consumes the shield, immunity keeps it intact, and a carried evolution starts protected while a fresh run has no shield.',
  setup,
  play() {
    const { run } = G();
    run.polypT = 1; hit(4, true);
    const immune = run.energyShield.hp === 10;
    run.polypT = 0; hit(3, true);
    const drain = run.energyShield.hp === 7;
    const carry = run.carryOver();
    run.carry = carry; run.start();
    const carried = run.energyShield.hp === 10 && run.energyShield.group.visible;
    run.carry = null; fresh({ hurt: true, bubbles: false, lash: false });
    const reset = run.energyShield.hp === 0 && !run.energyShield.group.visible;
    return ok(immune && drain && carried && reset && carry.evolved.includes('aegis'), { immune, drain, carried, reset });
  },
});

story('evolutions/energy-shield-no-new-shader', {
  about: 'The shell is prepared behind Play, stays the same mesh across recharge, and remains visible on Low without bloom.',
  setup() { setupFight({ hurt: true, bubbles: false, lash: false }); },
  play() {
    const { APT, run, gfx } = G(), group = run.energyShield.group;
    const quality = gfx.quality;
    try {
      gfx.setTier('low'); G().GAME.render();
      const programs = APT.renderer.info.programs.length;
      evolve('aegis'); step(2); G().GAME.render();
      const ready = group.visible && run.energyShield.shell.material.opacity > 0.3;
      const noShader = APT.renderer.info.programs.length === programs;
      const def = CONTENT.evolutions.find((e) => e.id === 'aegis');
      return ok(ready && noShader && group === run.energyShield.group && !!def, { ready, noShader, before: programs, after: APT.renderer.info.programs.length });
    } finally { gfx.setTier(quality); }
  },
});
