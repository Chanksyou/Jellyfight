// The Shield (src/shield.js): a pool on top of Health from the Shield stat, its HUD bar, the
// treasures that need it (needs-stat="shield") and Aegis Jelly, which gives one.
import { bus, PLAYER } from '../events.js';
import { rollCards } from '../stats.js';
import { G, evolve, fresh, give, near, ok, record, setupFight, spawn, step, story, stub } from './kit.js';

const hit = (amount, drain = false) => { G().run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount, source: 'story', drain }); };
const setup = () => { setupFight({ hurt: true, bubbles: false, lash: false }); };
const withShield = (n = 4) => { G().run.stats.shield = n; step(1); };
const S = () => G().run.shield;

story('shield/starts-at-zero-and-absorbs-first', {
  about: 'A new jelly has no Shield and no bar; Shield arrives charged, takes damage before Health, and overflow passes to Health.',
  setup,
  play() {
    const { run, hud } = G(), bar = hud.$('.shield-bar');
    const none = run.S.shield === 0 && S().hp === 0 && bar.hidden && !S().group.visible;
    withShield(4);
    const charged = S().hp === 4 && !bar.hidden && S().group.visible;
    const hp = run.health;
    hit(3);
    const soaked = S().hp === 1 && run.health === hp;
    hit(3);
    const overflow = S().hp === 0 && run.health === hp - 2;
    return ok(none && charged && soaked && overflow, { none, charged, soaked, overflow, shield: S().hp, health: run.health });
  },
});

story('shield/recharges-after-five-calm-seconds', {
  about: 'After 5 s without damage the Shield refills, empty to full in 2 s; any damage (a drain too) restarts the wait; pauses do not count.',
  setup,
  play() {
    const { run } = G(); withShield(4);
    hit(10);
    step(60 * 4.9);
    const waiting = S().hp === 0 && !S().charging;
    hit(0.1, true);   // a drain restarts the wait
    step(60 * 4.9);
    const restarted = S().hp === 0;
    step(12);
    const charging = S().charging && S().hp > 0 && S().hp < 4;
    document.getElementById('g-over').hidden = false;
    const before = S().hp; step(60);
    const paused = S().hp === before;
    document.getElementById('g-over').hidden = true;
    step(60 * 2);
    const full = S().hp === 4 && S().full && !S().charging;
    return ok(waiting && restarted && charging && paused && full && run.phase !== 'dead', { waiting, restarted, charging, paused, full, hp: S().hp });
  },
});

story('shield/bar-follows-health-and-grows', {
  about: 'The Shield bar sits right after the Health bar, grows a little with every point of Shield, and shows broken, charging and full.',
  setup,
  play() {
    const { hud } = G(), bar = hud.$('.shield-bar'), health = hud.hpNodes['player-health'];
    withShield(3); step(1);
    const small = bar.getBoundingClientRect().width, h = health.getBoundingClientRect(), b = bar.getBoundingClientRect();
    const after = b.left >= h.right && b.left - h.right < 8 && Math.abs(b.top - h.top) < 2;
    G().run.stats.shield = 8; step(2);
    const grows = bar.getBoundingClientRect().width > small;
    hit(20); step(1);
    const empty = bar.classList.contains('empty');
    step(60 * 5.2);
    const charging = bar.classList.contains('charging');
    step(60 * 2.2);
    const full = !bar.classList.contains('charging') && !bar.classList.contains('empty') && bar.getAttribute('aria-valuenow') === '8';
    return ok(after && grows && empty && charging && full, { after, grows, empty, charging, full, small, big: bar.getBoundingClientRect().width });
  },
});

story('shield/phone-bar-fits', {
  about: 'On a phone the Health and Shield bars and the damage number stay on screen, even with a long Shield bar.',
  phone: true,
  setup,
  play() {
    const { hud } = G(); withShield(40); step(1); hit(2); step(1);
    const bar = hud.$('.shield-bar').getBoundingClientRect(), health = hud.hpNodes['player-health'].getBoundingClientRect(), n = hud.hpNodes['hp-delta'].getBoundingClientRect();
    return ok(bar.right <= innerWidth && n.right <= innerWidth && health.width >= 60 && bar.width > 0,
      { bar: [bar.x, bar.width], health: [health.x, health.width], number: [n.x, n.width], screen: innerWidth });
  },
});

story('shield/level-up-card', {
  about: 'Shield is a level-up card: +3 Common, +4 Rare, +5 Epic.',
  setup,
  play() {
    const { run } = G(), seen = new Set();
    for (let i = 0; i < 400; i++) for (const c of rollCards(run.stats, 3)) if (c.stat === 'shield') seen.add(c.amount);
    return ok([3, 4, 5].every((n) => seen.has(n)), { amounts: [...seen] });
  },
});

story('shield/treasures-need-a-shield-bar', {
  about: 'The shield treasures are offered only once the jelly has some Shield.',
  setup,
  play() {
    const { run } = G(), ids = ['crankFlashlight', 'eggTimer', 'ovenMitt', 'bubbleWrap', 'potLid'];
    const offered = new Set();
    stub(run, 'offer', (t, s, choices) => choices.forEach((c) => offered.add(c.id)));
    const roll = () => { offered.clear(); for (let i = 0; i < 300; i++) { run.pickTreasure(); run.pickLegendary(); } return ids.filter((id) => offered.has(id)); };
    const without = roll();
    withShield(3);
    const withBar = roll();
    return ok(without.length === 0 && withBar.length === ids.length, { without, withBar });
  },
});

story('treasures/shield-recharge', {
  about: 'Crank Flashlight refills the Shield 50% faster a copy; Egg Timer starts it 1 s sooner a copy.',
  setup,
  play() {
    const { run } = G(); withShield(4);
    const base = [S().wait, S().fill];
    give('crankFlashlight', 'crankFlashlight', 'eggTimer');
    const quick = [S().wait, S().fill];
    hit(10);
    step(60 * 3.9);
    const waited = S().hp === 0;
    step(60 * 0.2 + 60 * 1.0 + 2);
    const full = S().hp === 4;
    return ok(base[0] === 5 && base[1] === 2 && quick[0] === 4 && quick[1] === 1 && waited && full && run.owned.count('crankFlashlight') === 2,
      { base, quick, waited, full });
  },
});

story('treasures/shield-full-damage', {
  about: 'Oven Mitt: while the Shield is full, everything the jelly does hurts 30% more a copy; not while it is down.',
  setup,
  play() {
    const { run } = G(); withShield(4); give('ovenMitt', 'ovenMitt');
    const roach = spawn('roach', near(0.4, 0), { still: true, hp: 1000 });
    step(1);
    bus.emit('damage_taken', { targetId: roach.id, amount: 10, source: 'story' });
    const full = 1000 - roach.hp;
    hit(1); step(1);
    const was = roach.hp;
    bus.emit('damage_taken', { targetId: roach.id, amount: 10, source: 'story' });
    const down = was - roach.hp;
    return ok(Math.abs(full - 16) < 1e-6 && Math.abs(down - 10) < 1e-6, { full, down });
  },
});

story('treasures/shield-burst', {
  about: 'Bubble Wrap: when the Shield breaks it blasts every enemy within 30 cm for 2x Bubble damage a copy (one blast; up to 3 copies); enemies outside are untouched.',
  setup,
  play() {
    const { run } = G(); withShield(4); give('bubbleWrap'); step(1);
    run.stats.bubbleDamage = 10;
    const log = record('damage_taken');
    const close = spawn('roach', near(0.2, 0), { still: true, hp: 100 });
    const far = spawn('roach', near(0.6, 0), { still: true, hp: 100 });
    hit(3);
    const early = log.filter((d) => d.source === 'shield-burst').length;
    hit(3);
    const burst = log.filter((d) => d.source === 'shield-burst'), closeHp = close.hp;
    give('bubbleWrap', 'bubbleWrap'); step(60 * 8);
    hit(4);
    const three = log.filter((d) => d.source === 'shield-burst').slice(1);
    return ok(early === 0 && burst.length === 1 && burst[0].amount === 20 && closeHp === 80 && far.hp === 100 && three.length === 1 && three[0].amount === 60 && run.owned.count('bubbleWrap') === 3,
      { early, burst: burst.map((d) => d.amount), close: closeHp, far: far.hp, three: three.map((d) => d.amount) });
  },
});

story('treasures/health-to-shield', {
  about: 'Pot Lid: max Health drops to 1 and the rest becomes Shield (later max Health too); healing gives nothing; Health and Health regen cards are not offered.',
  setup,
  play() {
    const { run } = G(); withShield(3);
    const was = run.S.health;
    give('potLid'); run.health = Math.min(run.health, run.S.health); step(1);
    const converted = run.S.health === 1 && run.health === 1 && run.S.shield === 3 + was - 1 && S().hp === run.S.shield;
    run.stats.health += 5; step(1);
    const later = run.S.health === 1 && run.S.shield === 3 + was + 4;
    hit(run.S.shield); run.heal(10); run.stats.regen = 1; step(60);
    const noHeal = run.health === 1;
    let cards = false;
    for (let i = 0; i < 300; i++) if (rollCards(run.stats, 3, 0, 0, run.S, ['health', 'regen']).some((c) => c.stat === 'health' || c.stat === 'regen')) cards = true;
    return ok(converted && later && noHeal && !cards && run.mods.shield.fromHealth, { converted, later, noHeal, cards, shield: run.S.shield });
  },
});

story('evolutions/aegis-gives-shield', {
  about: 'Aegis Jelly gives +5 Shield on the bar, bursts once for a flat 15 within 20 cm when it breaks, and refills like any Shield.',
  setup,
  play() {
    const { run } = G(); evolve('aegis'); step(1);
    const log = record('damage_taken');
    const close = spawn('roach', near(0.1, 0), { still: true, hp: 100 });
    const far = spawn('roach', near(0.5, 0), { still: true, hp: 100 });
    run.stats.bubbleDamage = 100;   // flat: Bubble damage doesn't change it
    const given = run.S.shield === 5 && S().hp === 5;
    hit(8);
    const burst = log.filter((d) => d.source === 'shield-burst');
    step(60 * 7.2);
    const back = S().hp === 5;
    return ok(given && burst.length === 1 && burst[0].amount === 15 && close.hp === 85 && far.hp === 100 && back,
      { given, burst: burst.map((d) => d.amount), close: close.hp, far: far.hp, back });
  },
});

story('shield/carries-and-resets', {
  about: 'A later act starts with its Shield full; a fresh run starts with none; the shell needs no new shader.',
  setup,
  play() {
    const { APT, run } = G();
    G().GAME.render();
    const programs = APT.renderer.info.programs.length;
    withShield(4); hit(3);
    G().GAME.render();
    const noShader = APT.renderer.info.programs.length === programs;
    const carry = run.carryOver();
    run.carry = carry; run.start();
    const carried = S().hp === 4 && S().group.visible;
    run.carry = null; fresh({ hurt: true, bubbles: false, lash: false });
    const reset = S().hp === 0 && !S().group.visible && run.S.shield === 0;
    return ok(noShader && carried && reset, { noShader, carried, reset, before: programs, after: APT.renderer.info.programs.length });
  },
});
