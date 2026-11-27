// Signs for the Treasures that change numbers only (src/buff-looks.js): Treasure juice J5.
// Each sign is on exactly while the run's buff is, and the damage numbers never change.
import { bus, PLAYER } from '../events.js';
import { G, give, holdJelly, ok, record, roachAt, setupFight, step, story } from './kit.js';

function ready(...ids) { setupFight({ hurt: true, bubbles: false, lash: false }); give(...ids); holdJelly(); G().run.S.dodge = 0; step(1); }
const B = () => G().run.buffLooks;

story('buff-looks/coffee-sign-lives-with-its-buff', {
  about: 'Coffee Bean\'s kick: while its stack is live the sign names Fire rate, the shots glow in its colour and the Fire rate really is up; when the 8 s run out the sign and the glow are gone.',
  setup() { ready('coffeeBean'); },
  play() {
    const { run } = G(), rate = run.S.fireRate;
    const before = !B().signs.length && !run.bubbles.buffTint;
    run.buff('level-up'); step(2);
    const on = B().signs.includes('fireRate') && run.bubbles.buffTint === B().cols.fireRate && run.lash.buffTint === B().cols.fireRate && run.S.fireRate > rate;
    step(60 * 8 + 5);
    const off = !B().signs.length && !run.bubbles.buffTint && run.S.fireRate === rate;
    return ok(before && on && off, { before, on, off });
  },
});

story('buff-looks/dry-sock-sign-only-in-the-air', {
  about: 'Dry Sock\'s "while airborne": the air sign is on while the jelly is off the floor and off when it lands.',
  setup() { ready('drySock'); },
  play() {
    const { run, player } = G();
    player.grounded = true; B().update(0);
    const ground = !B().signs.includes('air');
    player.grounded = false; B().update(0);
    const air = B().signs.includes('air') && !!B().tint;
    player.grounded = true; B().update(0);
    return ok(ground && air && !B().signs.length, { ground, air });
  },
});

story('buff-looks/oven-mitt-rim-while-shield-full', {
  about: 'Oven Mitt: the Shield burns brighter while it is full (and the bonus holds), and the first chip takes the extra glow and the 30% off together.',
  setup() { ready('ovenMitt'); G().run.stats.shield = 6; step(2); },
  play() {
    const { run } = G(), S = run.shield, op = () => S.shell.material.opacity;
    const full = S.full && S.rim && run.enemies.damageMult === 1.3;
    const bright = op();
    S.absorb(1); step(1);
    const chipped = !S.rim && run.enemies.damageMult === 1 && op() < bright;
    return ok(full && chipped, { full, chipped, bright, after: op() });
  },
});

story('buff-looks/baby-bottle-sips-capped', {
  about: 'Baby Bottle: a kill that heals sends one green glow flying to the bell; no sip when Health is full; never more than 6 in the air.',
  setup() { ready('babyBottle'); },
  play() {
    const { run } = G(), live = () => B().flies.filter((f) => f.t >= 0).length;
    const at = run.player.position.clone();
    run.health = run.S.health; run.onKill({ targetId: 1, pos: at, r: 0.02, xp: 0 });
    const none = live() === 0;
    run.health = 1;
    for (let i = 0; i < 10; i++) { run.health = 1; run.onKill({ targetId: 100 + i, pos: at, r: 0.02, xp: 0 }); }
    const capped = live() === 6;
    step(30);
    return ok(none && capped && live() === 0, { none, capped, left: live() });
  },
});

story('buff-looks/pizza-cutter-slash-once', {
  about: 'Pizza Cutter: finishing a bug off sends one enemy_sliced (the slash and two halves, in the bug\'s own body colour, not a neutral one); a hit that leaves it above 15% sends none. SLICED and the kill are unchanged.',
  setup() { ready('pizzaCutter'); roachAt(0.2, 0); roachAt(-0.2, 0); },
  play() {
    const [a, b] = G().enemies.list, log = record('enemy_sliced');
    bus.emit('damage_taken', { targetId: a.id, amount: a.maxHp * 0.9, source: 'story' });
    bus.emit('damage_taken', { targetId: b.id, amount: b.maxHp * 0.8, source: 'story' });
    const c = log[0]?.color, tinted = !!c && (Math.abs(c.r - c.g) > 0.02 || Math.abs(c.g - c.b) > 0.02);   // a roach's brown, not grey
    return ok(a.dead && !b.dead && log.length === 1 && tinted, { sliced: log.length, color: c && c.getHexString() });
  },
});

story('buff-looks/bonus-damage-flash-at-most-five-a-second', {
  about: 'Rolling Pin: a hit on a fresh bug sends a bonus flash, at most 5 a second however many land; a hit that gets no bonus sends none; the damage is the same.',
  setup() { ready('rollingPin'); for (let i = 0; i < 6; i++) roachAt(0.1 + i * 0.05, 0); },
  play() {
    const { enemies } = G(), log = record('bonus_damage'), hp = enemies.list.map((e) => e.hp);
    for (const e of enemies.list) bus.emit('damage_taken', { targetId: e.id, amount: 1, source: 'story' });
    const burst = log.length;
    const dealt = enemies.list.every((e, i) => Math.abs((hp[i] - e.hp) - 1.5) < 1e-6);
    step(15);
    enemies.list[0].hp = enemies.list[0].maxHp * 0.5;
    bus.emit('damage_taken', { targetId: enemies.list[0].id, amount: 1, source: 'story' });
    return ok(burst === 1 && dealt && log.length === 1, { burst, dealt, later: log.length });
  },
});

story('buff-looks/thimble-fleck-only-when-it-soaks', {
  about: 'Thimble: a hit that it takes 1 off leaves a silver fleck; a hit already at its floor (0.5) leaves none; the Health lost is what it was.',
  setup() { ready('thimble'); },
  play() {
    const { run } = G(), studs = () => run.gadgets.looks.pools.stud.filter((p) => p.alive).length;
    run.iFrames = 0; run.health = run.S.health; const h0 = run.health;
    run.hit(3); const big = studs() > 0 && Math.abs(h0 - run.health - 2) < 1e-6;
    step(120);
    const gone = studs() === 0;
    run.iFrames = 0; run.hit(0.5);
    return ok(big && gone && studs() === 0, { big, gone });
  },
});

story('buff-looks/signs-build-no-shader-and-stay-quiet', {
  about: 'Every sign shows without building a shader after the warm-up; with Reduce effects the pulses and wind stay off.',
  setup() { ready('coffeeBean', 'drySock', 'babyBottle', 'thimble', 'pizzaCutter', 'rollingPin', 'ovenMitt'); G().run.stats.shield = 6; roachAt(0.1, 0); },
  play() {
    const { run, GAME, APT, player } = G();
    GAME.render(); const n = APT.renderer.info.programs.length;
    run.buff('level-up'); player.grounded = false; step(30);
    B().slice(player.position, 0.02); B().bonus(player.position, 0.02); B().tink(); B().sip(player.position);
    run.shield.absorb(1); step(30); GAME.render();
    const built = APT.renderer.info.programs.length - n;
    const pulses = B().pulseT;
    return ok(built === 0 && pulses > 0, { built, pulses });
  },
});
