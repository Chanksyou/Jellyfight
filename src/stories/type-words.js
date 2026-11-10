// Stories: the jelly types' six shared words (docs/jelly-types, phase P3). No content uses them yet,
// so each story compiles a test treasure from KDL and makes it the run's combined effects.

import { bus, PLAYER } from '../events.js';
import { compileMods, compileTreasures } from '../content.js';
import { parse } from '../kdl.js';
import { BASE_STATS, knockFor } from '../stats.js';
import { G, give, offs, ok, record, roachAt, setupFight, spy, step, story, stub } from './kit.js';

// the run's combined effects become what it owns plus these words (until the story ends)
function withWords(src) {
  const { run } = G();
  const [t] = compileTreasures(parse(`treasure "p3" name="P3" icon="x" text="x" {\n${src}\n}`, 'p3.kdl'), 'p3.kdl');
  const m = compileMods(run.owned, run.evolved || []);
  for (const fx of t.effects) fx(m, 0);
  Object.defineProperty(run, 'mods', { value: m, configurable: true, writable: true });
  offs.push(() => { delete run.mods; });
  G().enemies.mods = m;
  return m;
}
const mistake = (src) => { try { compileTreasures(parse(`treasure "x" name="X" icon="x" text="x" {\n${src}\n}`, 't.kdl'), 't.kdl'); return null; } catch (e) { return e.message; } };
const hits = () => { const log = []; offs.push(bus.on('enemy_hit', (h) => log.push(h))); return log; };

story('treasures/status-damage', {
  about: 'status-damage: hits on a Stunned bug do 50% more, a Bleeding bug takes +10% a stack from tentacles only, damage over time and Elites are left out unless elites=#true. Shatter is one every run has: Fire on a frozen bug does 3x, shoves 3x as hard, shows SHATTER! and thaws it, so the next hit is plain.',
  setup() { setupFight({ lash: false }); give('candle'); stub(G().run.bubbles, 'volley', () => false); },   // fire shots only
  play() {
    const { run, enemies } = G();
    // Shatter, in real play: the candle's fireballs on a frozen roach
    const a = roachAt(0, -0.12), b = roachAt(0.25, -0.3);
    bus.emit('status_applied', { targetId: a.id, status: 'freeze', duration: 30 });
    const got = hits(), dealt = [], knocks = record('knockback'), words = spy(run.fx, 'number');
    offs.push(bus.on('damage_taken', (d) => {
      if (d.targetId === a.id && d.source === 'bubble' && d.feedback?.element === 'fire') dealt.push({ sent: d.amount, landed: got.at(-1).amount, frozen: a.freezeT > 0 });
    }));
    step(60 * 6, () => dealt.length >= 2);
    const [first, second] = dealt, shove = knocks.find((k) => k.targetId === a.id)?.force;
    const shattered = !!first && Math.abs(first.landed / first.sent - 3) < 1e-9 && !first.frozen && words.some((w) => w[1] === 'SHATTER!');
    const plainAfter = !!second && Math.abs(second.landed / second.sent - 1) < 1e-9;
    const shoveOk = !!first && Math.abs(shove - knockFor(first.sent * 3)) < 1e-9;
    // the word itself
    enemies.clear();
    withWords('status-damage "stunned"\nstatus-damage "bleeding" more=0 per-stack=0.1 by="tentacle"\nstatus-damage "marked" more=1 elites=#true');
    stub(run.bubbles, 'update', () => {});
    const e = roachAt(0, -0.2), plain = roachAt(0.1, -0.2);
    bus.emit('status_applied', { targetId: e.id, status: 'stun', duration: 30 });
    run.lash.venom.set(e, { stacks: 3, perStack: 0, t: 30, tick: 9 });
    const land = (target, source, amount = 2, feedback) => { bus.emit('damage_taken', { targetId: target.id, amount, source, feedback }); return got.at(-1).amount; };
    const stunned = land(e, 'bubble'), byTentacle = land(e, 'tentacle'), tick = land(e, 'fire'), unhurt = land(plain, 'bubble');
    const boss = { proxy: {}, stunT: 9, markT: 9 }, eliteK = enemies.statusMore(boss, 'bubble');
    const bad = [mistake('status-damage "chilled" thaw=#true'), mistake('status-damage "soggy"'), mistake('status-damage "stunned" by="laser"')];
    const pass = shattered && plainAfter && shoveOk && Math.abs(stunned - 3) < 1e-9 && Math.abs(byTentacle - 3.6) < 1e-9 && tick === 2 && unhurt === 2
      && Math.abs(eliteK - 2) < 1e-9 && bad.every(Boolean);
    return ok(pass, { first, second, shove, stunned, byTentacle, tick, unhurt, eliteK, bad });
  },
});

story('treasures/status-taken', {
  about: 'status-taken: a Slowed bug deals 50% less damage to the jelly; a bug that isn\'t Slowed hits as hard as ever, and an Elite or the boss is never weakened.',
  setup() { setupFight({ lash: false, bubbles: false }); },
  play() {
    const { run, enemies } = G();
    withWords('status-taken "slowed" less=0.5');
    const slowed = roachAt(0, -0.2), plain = roachAt(0.1, -0.2), elite = roachAt(-0.1, -0.2);
    elite.proxy = { damage() {} };   // stands in for an Elite: only its being a proxy matters here
    for (const e of [slowed, elite]) bus.emit('status_applied', { targetId: e.id, status: 'slow', duration: 30 });
    elite.slowT = 30;
    const taken = spy(run, 'hit'), from = (e) => { run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount: 4, from: e.id, source: 'story' }); return taken.at(-1)[0]; };
    const k = run.stage.power || 1, a = from(slowed), b = from(plain), c = from(elite);
    delete elite.proxy;
    return ok(Math.abs(a - 2 * k) < 1e-9 && Math.abs(b - 4 * k) < 1e-9 && Math.abs(c - 4 * k) < 1e-9, { slowed: a, plain: b, elite: c, power: k });
  },
});

story('treasures/on-kill-of', {
  about: 'on-kill-of: a Burning bug that dies sets off its ring where it fell, stinging the bug beside it; a bug that wasn\'t burning sets off nothing. by="splash": a bug killed by a splash drops 7 XP where it died, one killed by a bubble doesn\'t.',
  setup() { setupFight({ lash: false, bubbles: false }); },
  play() {
    const { run, enemies } = G();
    withWords('on-kill-of status="burning" {\n  ring 0.06 dmg=1\n}\non-kill-of by="splash" {\n  xp 7\n}');
    const log = record('damage_taken'), drops = spy(run.xpDrops, 'drop');
    const kill = (e, source) => bus.emit('damage_taken', { targetId: e.id, amount: 1e6, source });
    const burning = roachAt(0, -0.3), beside = roachAt(0.04, -0.3);
    run.bubbles.ignite(burning, 1);
    kill(burning, 'bubble');
    const ringed = log.some((d) => d.source === 'ring' && d.targetId === beside.id);
    log.length = 0;
    const dry = roachAt(0, -0.6), nextTo = roachAt(0.04, -0.6);
    kill(dry, 'bubble');
    const quiet = !log.some((d) => d.source === 'ring');
    const sevens = () => drops.filter((a) => a[2] === 7).length;
    const splashed = roachAt(-0.3, -0.3); kill(splashed, 'splash');
    const fromSplash = sevens();
    const popped = roachAt(-0.3, -0.6); kill(popped, 'bubble');
    const neither = mistake('on-kill-of {\n  xp 1\n}');
    return ok(ringed && quiet && fromSplash === 1 && sevens() === 1 && !!neither && !nextTo.dead, { ringed, quiet, fromSplash, after: sevens(), neither });
  },
});

story('treasures/nth-attack', {
  about: 'nth-attack: every 3rd blow is a big one instead (4x damage, twice the size); with random=#true about 1 blow in 4 is.',
  setup() { setupFight({ lash: false }); roachAt(0, -0.15); },
  play() {
    const { run } = G(), B = run.bubbles;
    withWords('nth-attack 3 {\n  big dmg=4 size=2\n}');
    const blown = spy(B, 'blow'), v0 = B.volleys;
    step(60 * 6);
    const opts = blown.map((a) => a[2]), bigs = opts.filter((o) => o.big);
    const plainDmg = opts.find((o) => !o.big)?.dmg, plainSize = opts.find((o) => !o.big)?.size;
    const fixed = opts.length >= 6 && bigs.length === Math.floor(B.volleys / 3) - Math.floor(v0 / 3) && bigs.every((o) => Math.abs(o.dmg - plainDmg * 4) < 1e-9 && Math.abs(o.size - plainSize * 2) < 1e-9);
    const random = withWords('nth-attack 4 random=#true {\n  big\n}');
    let n = 0; for (let i = 1; i <= 400; i++) if (B.nth(random, i)) n++;
    const share = n / 400, bad = mistake('nth-attack 1 {\n  big\n}');
    return ok(fixed && share > 0.17 && share < 0.33 && !!bad, { blows: opts.length, v0, volleys: B.volleys, bigs: bigs.length, share, bad });
  },
});

story('treasures/stack-buff', {
  about: 'stack-buff: each kill adds +10% Fire rate for 3 s, at most 2 stacks, and they all run out together 3 s after the last; a hit by an attack, a lightning arc and a splash that kills 3 or more bugs each add their own buff.',
  setup() { setupFight({ lash: false }); stub(G().run.bubbles, 'volley', () => false); },
  play() {
    const { run, enemies } = G(), S = () => run.S;
    withWords('stack-buff "kill" "fire-rate" 10 percent=#true time=3 stacks=2\nstack-buff "hit" "move-speed" 0.1 time=1\nstack-buff "arc" "luck" 5\nstack-buff "big-splash" "dodge" 4');
    const fr0 = S().fireRate, ms0 = S().moveSpeed, kill = (e) => bus.emit('damage_taken', { targetId: e.id, amount: 1e6, source: 'zap' });
    kill(roachAt(0.3, 0.3)); const one = S().fireRate - fr0;
    kill(roachAt(0.3, 0.35)); kill(roachAt(0.35, 0.3)); const capped = S().fireRate - fr0;
    const target = roachAt(0.4, 0.4);
    bus.emit('damage_taken', { targetId: target.id, amount: 1, source: 'bubble' }); const hit = S().moveSpeed - ms0;
    bus.emit('damage_taken', { targetId: target.id, amount: 1, source: 'lightning' }); const arc = S().luck - run.stats.luck;
    step(Math.round(60 * 1.2)); const hitGone = Math.abs(S().moveSpeed - ms0) < 1e-9, stillFast = S().fireRate - fr0;
    step(Math.round(60 * 2)); const fadedTogether = Math.abs(S().fireRate - fr0) < 1e-9;
    // a real splash: one huge bubble into a clump of four weak roaches (they nudge apart a few cm)
    const clump = [[0, -0.2], [0.012, -0.2], [-0.012, -0.2], [0, -0.212]].map(([x, z]) => roachAt(x, z, { still: true, hp: 1 }));
    const big = record('big_splash'), d0 = S().dodge;
    run.bubbles.blow(run.player.position.clone().setY(run.player.position.y + 0.03), clump[0], { size: 10, dmg: 50, pierce: 1 });
    step(120, () => big.length > 0);
    const splash = big.length === 1 && Math.abs(S().dodge - d0 - 4) < 1e-9;
    const base = BASE_STATS.fireRate * 0.1;
    return ok(Math.abs(one - base) < 1e-9 && Math.abs(capped - 2 * base) < 1e-9 && Math.abs(hit - 0.1) < 1e-9 && arc === 5 && hitGone && Math.abs(stillFast - 2 * base) < 1e-9 && fadedTogether && splash,
      { one, capped, hit, arc, hitGone, stillFast, fadedTogether, splashKills: big[0]?.kills, dodge: S().dodge - d0 });
  },
});

story('treasures/while-moving', {
  about: 'while when="moving": +20% Dodge only while the jelly swims at full speed: none standing still, all of it a moment into a straight swim, none again once it has stopped.',
  setup() { setupFight({ lash: false, bubbles: false }); },
  play() {
    const { run, player } = G(), dodge = () => run.S.dodge - run.stats.dodge;
    withWords('while "moving" "dodge" 20');
    step(10); const still = dodge();
    G().input.keys = new Set(['KeyW']); step(30); const swimming = dodge(), full = player.fullSpeed;
    G().input.keys = new Set(); step(60); const stopped = dodge();
    return ok(still === 0 && swimming === 20 && full && stopped === 0, { still, swimming, full, stopped });
  },
});
