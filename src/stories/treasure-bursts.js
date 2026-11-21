// The bodies for the Rubber Duck, Windowsill Cactus, Guitar Pick and Bath Salt (src/treasure-bursts.js): Treasure juice J2.
import { bus } from '../events.js';
import { G, give, holdJelly, ok, record, roachAt, setupFight, step, story, stub } from './kit.js';

function ready(...ids) { setupFight({ hurt: true, bubbles: false, lash: false }); give(...ids); holdJelly(); }
const ctx = () => { const { run, player } = G(); return { mods: run.mods, feet: player.position, center: player.position.clone().setY(player.position.y + 0.045), power: run.power, facing: player.facing, pulse: () => {} }; };
const ef = (look) => G().run.mods.timed.flatMap((t) => t.effects).find((e) => e.look === look);
const hurt = () => { const { run } = G(); run.iFrames = 0; run.hit(1); };
const alive = (L, kind) => L.pools[kind].filter((p) => p.alive);

story('treasure-bursts/duck-pops-and-stars-follow-the-stunned', {
  about: 'Getting hit with the Rubber Duck pops a duck from under the bell (squashed first, back over a quarter second), three arcs at full reach a beat apart, and a star over each Stunned bug (at most 6) that goes when the Stun does. The shove and Stun are unchanged.',
  setup() { ready('rubberDuck'); for (let i = 0; i < 8; i++) roachAt(0.04 + i * 0.012, 0.01 * (i % 3)); },
  play() {
    const { run, enemies } = G(), g = run.gadgets, B = g.bursts, L = g.looks, Q = run.mods.squeaks[0];
    hurt();
    const first = alive(L, 'arc').filter((p) => p.size.x === Q.radius).length, stunned = enemies.list.filter((e) => e.stunT > 0).length;
    const stars = alive(L, 'crystal').filter((p) => p.kind === 'star'), following = stars.every((p) => p.follow);
    g.update(0.05, ctx()); const squash = B.duck[0].visible && B.duck[0].scale.y < B.duck[0].scale.x;
    for (let i = 0; i < 12; i++) { g.update(1 / 60, ctx()); L.update(1 / 60); }
    const arcs = alive(L, 'arc').filter((p) => p.size.x > Q.radius * 0.8).length;
    for (let i = 0; i < 120; i++) { g.update(1 / 60, ctx()); L.update(1 / 60); enemies.list.forEach((e) => { e.stunT = 0; }); }
    L.update(1 / 60);
    return ok(first === 1 && stunned === 8 && stars.length === 6 && following && squash && arcs === 3 && !B.duck[0].visible && !alive(L, 'crystal').some((p) => p.kind === 'star'), { first, stunned, stars: stars.length, squash, arcs, duck: B.duck[0].visible, left: alive(L, 'crystal').filter((p) => p.kind === 'star').length, following });
  },
});

story('treasure-bursts/cactus-needles-fly-after-the-hit-and-stick', {
  about: 'The Cactus\'s damage lands the frame you are hit; the needles fly to each bug after that, stay stuck in it without any Stun, six stand in the floor at the ring\'s reach, and the bell bristles with eight. None of it goes past the 32-needle cap.',
  setup() { ready('cactus'); roachAt(0.1, 0); roachAt(-0.12, 0.05); },
  play() {
    const { run, enemies } = G(), g = run.gadgets, L = g.looks, log = record('damage_taken'), R = run.mods.onHurt[0].effects[0].radius;
    hurt();
    const landed = log.filter((d) => d.source === 'ring').length === 2, flying = g.bursts.flights.length === 2, stuckAtOnce = alive(L, 'needle').filter((p) => p.stick && p.follow).length;
    const floor = alive(L, 'needle').filter((p) => !p.stick && Math.abs(Math.hypot(p.m.position.x - G().player.position.x, p.m.position.z - G().player.position.z) - R) < 1e-6).length;
    const bristles = g.bursts.bristle?.ps.length;
    for (let i = 0; i < 8; i++) { g.update(1 / 60, ctx()); L.update(1 / 60); }
    const stuck = alive(L, 'needle').filter((p) => p.stick && p.follow && enemies.list.includes(p.follow)).length;
    for (let i = 0; i < 12; i++) { g.update(1 / 60, ctx()); L.update(1 / 60); }   // 0.33 s in: still stuck, no Stun on them
    const kept = alive(L, 'needle').filter((p) => p.stick).length;
    return ok(landed && flying && stuckAtOnce === 0 && floor === 6 && bristles === 8 && stuck === 2 && kept === 2 && alive(L, 'needle').length <= L.caps.needle, { landed, flying, floor, bristles, stuck, kept });
  },
});

story('treasure-bursts/cactus-quiet-has-no-flight', {
  about: 'With Reduce effects the Cactus\'s needles are stuck in their bugs at once: no flight, no floor needles, no bristle.',
  setup() { ready('cactus'); roachAt(0.1, 0); },
  play() {
    const { run, fx } = G(), g = run.gadgets, L = g.looks;
    stub(fx, 'reducedMotion', { matches: true });
    hurt(); g.update(1 / 60, ctx()); L.update(1 / 60);
    const n = alive(L, 'needle');
    return ok(n.length === 1 && n[0].stick && !!n[0].follow && !g.bursts.bristle, { n: n.length });
  },
});

story('treasure-bursts/pick-flicks-then-three-arcs-and-notes', {
  about: 'The Guitar Pick\'s prepare shows the pick flicking across the bell; the chord is three full-reach arcs 0.06 s apart and each bug it hits sends up a note. Damage and shove are what they were.',
  setup() { ready('guitarPick'); roachAt(0.06, 0); roachAt(-0.07, 0.02); },
  play() {
    const { run } = G(), g = run.gadgets, L = g.looks, B = g.bursts, e = ef('chord'), log = record('damage_taken');
    step(200, () => g.chordReady.visible);
    const flick = B.pick.visible; g.update(1 / 60, ctx());
    step(80, () => log.some((d) => d.source === 'ring'));
    const hits = log.filter((d) => d.source === 'ring'), full = () => alive(L, 'arc').filter((p) => Math.abs(p.size.x - e.radius) < 1e-6).length;
    const one = full(), notes = alive(L, 'stud').filter((p) => p.kind === 'drift').length;
    const y0 = alive(L, 'stud').find((p) => p.kind === 'drift')?.m.position.y;
    for (let i = 0; i < 8; i++) { g.update(1 / 60, ctx()); L.update(1 / 60); }
    const three = full(), rose = alive(L, 'stud').find((p) => p.kind === 'drift')?.m.position.y > y0;
    return ok(flick && hits.length === 2 && hits.every((d) => d.amount === run.power * e.dmg) && one === 1 && three === 3 && notes === 2 && rose, { flick, hits: hits.length, one, three, notes, rose });
  },
});

story('treasure-bursts/salt-chain-grows-and-stays-in-reach', {
  about: 'A Bath Salt burst that follows another within half a second is one deeper in the chain: more and bigger crystals thrown faster, a higher chime. No crystal or glitter is drawn past the burst\'s reach; a lone burst starts again from the bottom.',
  setup() { ready('bathSalt'); },
  play() {
    const { run, player } = G(), g = run.gadgets, L = g.looks, B = g.bursts, R = run.mods.burstOnKill.radius, c = player.position.clone();
    const count = () => alive(L, 'crystal').length, depths = [], counts = [], far = [];
    for (let k = 0; k < 3; k++) {
      L.reset(); depths.push(B.salt(c, R)); counts.push(count());
      for (let i = 0; i < 30; i++) { L.update(1 / 60); for (const p of alive(L, 'crystal')) far.push(Math.hypot(p.m.position.x - c.x, p.m.position.z - c.z)); }
      B.clock += 0.3;
    }
    B.clock += 2; const again = B.salt(c, R);
    return ok(depths.join() === '0,1,2' && counts[2] > counts[0] && again === 0 && Math.max(...far) <= R, { depths, counts, again, far: Math.max(...far), R });
  },
});

story('treasure-bursts/no-shader-when-each-fires', {
  about: 'After the warm-up, the duck, the cactus needles, the pick and a chained salt burst build no new shader program.',
  setup() { ready('rubberDuck', 'cactus', 'guitarPick', 'bathSalt'); for (const x of [0.05, 0.12, -0.1]) roachAt(x, 0.03); },
  play() {
    const { run, GAME, APT, player } = G(), g = run.gadgets, c = ctx();
    g.update(1 / 60, c); GAME.render();
    const before = APT.renderer.info.programs.length;
    hurt(); g.bursts.pickPrepare(c.center, 0.5); g.bursts.salt(player.position, 0.035); g.bursts.salt(player.position, 0.035);
    for (let i = 0; i < 30; i++) { g.update(1 / 60, c); g.looks.update(1 / 60); }
    GAME.render();
    const built = APT.renderer.info.programs.length - before;
    return ok(built === 0, { built });
  },
});
