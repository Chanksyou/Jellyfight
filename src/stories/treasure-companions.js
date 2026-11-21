// Fairy Lights, the Magnifying Glass and the Disco Ball drawn (src/treasure-companions.js): Treasure juice J3.
import { bus } from '../events.js';
import { G, give, holdJelly, ok, record, roachAt, setupFight, step, story, stub } from './kit.js';

function ready(...ids) { setupFight({ hurt: true, bubbles: false, lash: false }); give(...ids); holdJelly(); G().run.S.dodge = 0; }
function ctx(beat = 0) { const { run, player } = G(); return { mods: run.mods, feet: player.position, center: player.position.clone().setY(player.position.y + 0.045), power: run.power, moving: false, beat, pulse: () => {} }; }

story('treasure-companions/fairy-wire-trails-and-pop', {
  about: 'Fairy Lights draw a wire through every bulb (one line, two points a bulb) and a trail each; a bulb that stings pops to 1.6x and settles in 0.15 s; bulb places and the soft sting are unchanged. On Low there is no wire or trail; with Reduce effects no twinkle, pop or trail.',
  setup() { ready('fairyLights'); },
  play() {
    const { run, fx } = G(), g = run.gadgets, C = g.companions, n = Math.min(run.mods.orbit.count, g.bulbs.length), log = record('damage_taken');
    const c = ctx();
    for (let i = 0; i < 6; i++) g.update(1 / 60, c);
    const bug = roachAt(run.mods.orbit.radius, 0);
    const wired = C.wire.visible && C.wire.geometry.drawRange.count === n * 2, onCircle = g.bulbs.slice(0, n).every((b) => Math.abs(Math.hypot(b.position.x - c.center.x, b.position.z - c.center.z) - run.mods.orbit.radius) < 1e-6);
    const holds = fx.glow.holds.length;
    let popped = 0, soft = false;
    for (let i = 0; i < 90; i++) { g.update(1 / 60, c); popped = Math.max(popped, ...g.bulbs.map((b) => b.scale.x)); }
    soft = log.some((d) => d.source === 'orbit-lights' && d.feedback?.soft);
    bug.dead = true;
    for (let i = 0; i < 12; i++) g.update(1 / 60, c);
    const settled = g.bulbs.every((b) => Math.abs(b.scale.x - 1) < 1e-6);
    stub(fx, 'low', () => true); g.update(1 / 60, c); const low = !C.wire.visible;
    stub(fx, 'low', () => false); stub(fx, 'reducedMotion', { matches: true });
    fx.glow.holds.length = 0; g.update(1 / 60, c); const quietTrail = fx.glow.holds.length === 0;
    return ok(wired && onCircle && holds > 0 && popped > 1.5 && popped <= 1.6001 && soft && settled && low && quietTrail, { wired, onCircle, holds, popped, soft, settled, low, quietTrail });
  },
});

story('treasure-companions/magnifier-lens-narrows-and-scorches', {
  about: 'The Magnifying Glass shows a lens over the bell facing its target, the beam narrows from wide to a point in 0.4 s (damage per burn unchanged), a scorch is left on lock and again each second, and with no target the lens is gone. Reduce effects: the lens holds its aim and no smoke curls.',
  setup() { ready('magnifier'); },
  play() {
    const { run, fx } = G(), g = run.gadgets, C = g.companions, log = record('damage_taken'), c = ctx(), bug = roachAt(0.1, 0);
    const splats = () => fx.splats.filter((s) => s.alive).length, s0 = splats();
    g.update(1 / 60, c);
    const wide = g.beam.scale.x, lens = C.rim.visible && C.pane.visible, locked = splats() === s0 + 1;
    for (let i = 0; i < 30; i++) g.update(1 / 60, c);
    const point = g.beam.scale.x, burns = log.filter((d) => d.source === 'beam');
    for (let i = 0; i < 40; i++) g.update(1 / 60, c);
    const again = splats() >= s0 + 2, same = new Set(log.filter((d) => d.source === 'beam').map((d) => d.amount)).size === 1;
    const facing = C.rim.quaternion.angleTo(C.tilt) < 1e-6;
    bug.pos.x += 5; bug.pos.z += 5; for (let i = 0; i < 3; i++) g.update(1 / 60, c);
    const gone = !C.rim.visible && !C.pane.visible && g.beam.scale.x === 1;
    return ok(wide > 1.4 && lens && locked && point < 0.4 && burns.length >= 1 && again && same && facing && gone, { wide, lens, locked, point, burns: burns.length, again, same, facing, gone });
  },
});

story('treasure-companions/disco-steps-colour-on-the-beat', {
  about: 'The Disco Ball\'s cone, pool and ball step through four pastel colours as the song\'s beat counts, eight light dots sweep the floor round you, the picked bug wears the light, and the ball dips and spins up as it picks. Reduce effects: one steady colour, no dots, no dip. Low: no dots.',
  setup() { ready('discoBall'); },
  play() {
    const { run, fx } = G(), g = run.gadgets, H = g.house, C = g.companions, bug = roachAt(0.05, 0);
    g.t.spotlight = 0;
    g.update(1 / 60, ctx(0));
    const dip = H.ball.position.y < ctx().center.y + 0.07 - 0.004 && C.kick > 0.9, spun = H.ball.rotation.y > 0;
    fx.glow.holds.length = 0; g.update(1 / 60, ctx(0));
    const dots = fx.glow.holds.length / 8;   // 8 dots + the picked bug's rim
    const seen = [];
    for (let b = 0; b < 4; b++) { for (let i = 0; i < 40; i++) g.update(1 / 60, ctx(b + i / 40)); seen.push(H.cone.material.color.getHexString()); }
    const four = new Set(seen).size === 4, pool = H.spotPool.material.uniforms.uColor.value.getHexString() === seen[3];
    stub(fx, 'low', () => true); fx.glow.holds.length = 0; g.update(1 / 60, ctx(1)); const low = fx.glow.holds.length <= 8 && fx.glow.holds.length >= 1;
    stub(fx, 'low', () => false); stub(fx, 'reducedMotion', { matches: true });
    for (let i = 0; i < 40; i++) g.update(1 / 60, ctx(2));
    fx.glow.holds.length = 0; g.update(1 / 60, ctx(3));
    const steady = H.cone.material.color.getHexString() === C.palette[0].getHexString() && fx.glow.holds.length === 8, hn = fx.glow.holds.length / 8;
    return ok(dip && spun && dots >= 1 && four && pool && low && steady && !!H.spot && H.spot.e === bug, { dip, spun, dots, seen, pool, low, steady, hn, cone: H.cone.material.color.getHexString() });
  },
});

story('treasure-companions/no-shader-when-each-shows', {
  about: 'After the warm-up, the wire, the lens, the beam narrowing, the light dots and the bulb pop build no new shader program.',
  setup() { ready('fairyLights', 'magnifier', 'discoBall'); },
  play() {
    const { run, GAME, APT } = G(), g = run.gadgets, c = ctx();
    g.update(1 / 60, c); GAME.render();
    const before = APT.renderer.info.programs.length;
    roachAt(0.1, 0); roachAt(-0.1, 0.03); g.t.spotlight = 0;
    for (let i = 0; i < 90; i++) g.update(1 / 60, ctx(i / 30));
    GAME.render();
    const built = APT.renderer.info.programs.length - before;
    return ok(built === 0 && g.companions.wire.visible && g.companions.rim.visible, { built });
  },
});
