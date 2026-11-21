// The shared floor glow (src/treasure-glow.js), soft hits (enemies.js feedback.soft) and the Treasure prop
// registry (src/treasure-props.js): Treasure juice J1.
import { bus } from '../events.js';
import { G, give, holdJelly, ok, record, roachAt, setupFight, step, story, stub } from './kit.js';

function ready(...ids) { setupFight({ hurt: true, bubbles: false, lash: false }); give(...ids); holdJelly(); G().run.S.dodge = 0; }
function ctx(moving = false) { const { run, player } = G(); return { mods: run.mods, feet: player.position, center: player.position.clone().setY(player.position.y + 0.045), power: run.power, moving, pulse: (k) => player.avatar.pulse(k) }; }
const ef = (kind) => G().run.mods.timed.flatMap((t) => t.effects).find((e) => e.kind === kind);
const pools = (g) => [g.aura, ...g.lampPool.map((l) => l.userData.pool), ...g.house.puddlePool.map((p) => p.disc), ...g.house.bombPool.map((b) => b.disc), g.house.spotPool];

story('treasure-glow/every-pool-shares-one-program', {
  about: 'Glow Stick\'s aura, the Night-Light pools, Ice Cube puddles, Bath Bomb discs and the Disco spot are all the one floor-glow shader (each with its own uniforms), drawn outside the batcher, with no flat disc or see-through physical puddle left; the glow stick is a prop.',
  setup() { ready('glowStick'); },
  play() {
    const { run, APT, GAME } = G(), g = run.gadgets, all = pools(g);
    const shared = all.every((m) => m.material.isTreasureGlow && m.userData.ownDraw && m.material.fragmentShader === all[0].material.fragmentShader);
    const own = new Set(all.map((m) => m.material)).size === all.length;
    g.update(1 / 60, ctx()); GAME.render();
    const before = APT.renderer.info.programs.length;
    for (const m of all) { m.visible = true; m.parent.visible = true; }
    GAME.render();
    const built = APT.renderer.info.programs.length - before;
    return ok(shared && own && built === 0 && g.props.all.has('glow-stick') && !run.gadgets.house.puddleMat, { shared, own, built, pools: all.length });
  },
});

story('treasure-glow/soft-hits-same-damage', {
  about: 'A soft hit (the aura\'s and Fairy Lights\' steady stings) deals exactly what a plain hit does, status-damage included (Thunderclap on a Stunned bug), but the bug doesn\'t flash white: a short glow in the hit\'s colour instead.',
  setup() { ready('glowStick'); G().run.upgrades.push('thunderclap'); step(1); },
  play() {
    const { fx } = G(), a = roachAt(0.2, 0), b = roachAt(-0.2, 0), log = record('enemy_hit');
    for (const e of [a, b]) bus.emit('status_applied', { targetId: e.id, status: 'stun', duration: 2 });
    const glows = fx.glow.parts.length;
    bus.emit('damage_taken', { targetId: a.id, amount: 1, color: '#8aff9f', source: 'aura', feedback: { soft: true } });
    const soft = { dmg: log[0]?.amount, flash: a.flashT || 0, glow: fx.glow.parts.length - glows };
    bus.emit('damage_taken', { targetId: b.id, amount: 1, color: '#8aff9f', source: 'aura' });
    const plain = { dmg: log[1]?.amount, flash: b.flashT || 0 };
    return ok(soft.dmg === plain.dmg && soft.dmg > 1.4 && soft.flash === 0 && plain.flash > 0 && soft.glow === 1, { soft, plain });
  },
});

story('treasure-glow/aura-sting-flashes-soft', {
  about: 'The aura\'s sting is a soft hit: same amount as before, the glow flashes (uPulse) the frame it stings and settles in 0.25 s, the stick circles the bell brighter with charge, and sparks fizz off the rim only at full charge.',
  setup() { ready('glowStick'); },
  play() {
    const { run, fx } = G(), g = run.gadgets, u = g.aura.material.uniforms, log = record('damage_taken'), bug = roachAt(0.05, 0);
    g.t.aura = 0; g.update(1 / 60, ctx()); bug.dead = true;   // (gone after the first sting: later glows are only the rim's sparks)
    const hit = log.find((d) => d.source === 'aura'), pulsed = u.uPulse.value >= 0 && u.uPulse.value < 0.2, still = u.uCharge.value;
    const dim = g.stick.userData.opacity, sparks0 = fx.glow.parts.length;
    for (let i = 0; i < 60; i++) g.update(1 / 60, ctx());
    const settled = u.uPulse.value === -1, noSparks = fx.glow.parts.length <= sparks0;
    for (let i = 0; i < 200; i++) g.update(1 / 60, ctx(true));
    const full = u.uCharge.value, bright = g.stick.userData.opacity > dim + 0.3, sparks = fx.glow.parts.length > sparks0;
    return ok(hit?.feedback?.soft && pulsed && settled && still === 0 && full === 1 && g.stick.visible && bright && sparks && noSparks, { pulsed, settled, full, bright, sparks });
  },
});

story('treasure-glow/no-shader-when-each-fires', {
  about: 'After the warm-up, the aura stinging, a Night-Light plugging in, an Ice Cube puddle, a Bath Bomb fizzing and the Disco spot build no new shader program.',
  setup() { ready('glowStick', 'iceCube', 'bathBomb', 'discoBall', 'nightLight'); for (const x of [0.05, 0.12, -0.1]) roachAt(x, 0.03); },
  play() {
    const { run, GAME, APT, player } = G(), g = run.gadgets, c = ctx();
    g.update(1 / 60, c); GAME.render();
    const before = APT.renderer.info.programs.length;
    g.t.aura = 0; g.plugIn(player.position.clone(), run.mods.nightLight);
    g.fire(ef('puddle'), c); g.fire(ef('geyser'), c); g.t.spotlight = 0;
    for (let i = 0; i < 40; i++) g.update(1 / 60, c);
    GAME.render();
    const built = APT.renderer.info.programs.length - before;
    return ok(built === 0 && g.lamps.length === 1 && g.house.puddles.length === 1 && !!g.house.spot, { built, lamps: g.lamps.length, puddles: g.house.puddles.length, spot: !!g.house.spot });
  },
});

story('treasure-glow/quiet-holds-pools-still', {
  about: 'With Reduce effects the pools hold still (their clocks stop, the dome doesn\'t flicker), the Night-Light sends up no motes and the aura no sparks; the sting\'s flash (information) stays. On Low there are no motes either.',
  setup() { ready('glowStick', 'nightLight'); },
  play() {
    const { run, fx, player } = G(), g = run.gadgets, u = g.aura.material.uniforms;
    stub(fx, 'reducedMotion', { matches: true });
    g.plugIn(player.position.clone(), run.mods.nightLight);
    const L = g.lamps[0], lu = L.g.userData.pool.material.uniforms, t0 = [u.uTime.value, lu.uTime.value], parts = fx.glow.parts.length;
    let flicker = false;
    for (let i = 0; i < 240; i++) { g.update(1 / 60, ctx(true)); flicker ||= L.g.userData.dome.userData.color.r < g.lampColor.r * 0.5; }
    const still = u.uTime.value === t0[0] && lu.uTime.value === t0[1], none = fx.glow.parts.length <= parts;
    roachAt(0.03, 0); g.t.aura = 0; g.update(1 / 60, ctx(true)); const flash = u.uPulse.value >= 0;
    stub(fx, 'reducedMotion', { matches: false }); stub(fx, 'low', () => true);
    const parts2 = fx.glow.parts.length; L.mote = 0; g.tickLights(1, run.mods, player.position);
    const lowNone = fx.glow.parts.length === parts2;
    return ok(still && none && !flicker && flash && lowNone, { still, none, flicker, flash, lowNone });
  },
});
