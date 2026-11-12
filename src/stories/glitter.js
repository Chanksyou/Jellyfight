// Stories: the Glitter jelly type (docs/jelly-types phase P8e): its bomb and the sphere it bursts in,
// and the words its 12 Attack upgrades brought (random-status, gild, splash-reflect, wish,
// splash-shots, next-attack, splash; echo-bubble from="splash", crit by="splash", crumb-on-kill
// drop="level").
import * as THREE from 'three';
import { bus, PLAYER } from '../events.js';
import { CONTENT, compileMods, compileTreasures } from '../content.js';
import { parse } from '../kdl.js';
import { elementParams } from '../words.js';
import { xpToNext } from '../stats.js';
import { PLAYED_KEY } from '../first-run.js';
import { BEST_KEY } from '../leaderboard.js';
import { G, fresh, ok, record, roachAt, setupFight, spawn, near, spy, step, story, stub, offs } from './kit.js';

// the run's combined effects become what it owns (and its jelly's own) plus these words, until the story ends
function withWords(src) {
  const { run } = G();
  const [t] = compileTreasures(parse(`treasure "p8e" name="P8e" icon="x" text="x" {\n${src}\n}`, 'p8e.kdl'), 'p8e.kdl');
  const m = compileMods(run.owned, run.evolved || [], run.upgrades || [], run.attack ? run.jelly : null);
  for (const fx of t.effects) fx(m, 0);
  Object.defineProperty(run, 'mods', { value: m, configurable: true, writable: true });
  offs.push(() => { delete run.mods; });
  G().enemies.mods = m;
  run.bubbles.mods = m;
  return m;
}
const mistake = (src) => { try { compileTreasures(parse(`treasure "x" name="X" icon="x" text="x" {\n${src}\n}`, 't.kdl'), 't.kdl'); return null; } catch (e) { return e.message; } };
// a Glitter fight whose jelly doesn't fire on its own
const quiet = () => { setupFight({ types: 'glitter' }); stub(G().run.bubbles, 'elementVolley', () => false); };
// a glitter bomb (the Glitter jelly's: ep.main) that hit `hit`, as bubbles.js blows it: 4.8 Attack damage at Attack size 1.25
const AD = 4.8, HIT = 1.3, SIZE = 1.25;
function bomb(hit, at = G().enemies.center(hit).clone()) {
  return { m: { position: at }, r: 0.0065 * SIZE, dmg: AD * HIT, pw: AD * 4.5, ep: G().run.bubbles.mainParams('glitter', G().run.mods), elems: new Set(['glitter']), hit: new Set(hit ? [hit] : []) };
}
const RADIUS = 0.026 * SIZE * (0.08 / 0.026);   // the burst's radius: 10 cm
const splashOn = (log, e) => log.filter((d) => d.targetId === e.id && d.source === 'splash').map((d) => d.amount);
const kill = (e) => bus.emit('damage_taken', { targetId: e.id, amount: 1e6, source: 'splash' });
const GLITTER_POOL = ['prism', 'rainbow', 'luckySparkle', 'confettiPop', 'midasTouch', 'discoBomb', 'mirrorGlitter', 'wish', 'jackpot', 'hotStreak', 'partyPopper', 'starBurst'];

story('types/glitter-plays', {
  about: 'A Glitter jelly hurts bugs only with its glitter bombs: the bug a bomb hits takes 4.8 x 1.3 = 6.24 (no bubbles, no stings), and every other bug in its burst takes 40% of Attack damage, 1.92. Each burst shows as a cloud of glitter.',
  setup() { setupFight({ types: 'glitter' }); },
  play() {
    const { run } = G(), log = record('damage_taken'), volleys = spy(run.bubbles, 'volley');
    const bug = roachAt(0, -0.14), next = roachAt(0.04, -0.15);
    step(60 * 4);
    const by = {};
    for (const d of log) if (d.targetId !== PLAYER) { const k = d.source === 'bubble' && d.feedback?.element ? d.feedback.element : d.source; (by[k] ||= []).push(d.amount); }
    const sources = Object.keys(by).sort().join(' ');
    const hits = (by.glitter || []).filter((a) => Math.abs(a - AD * HIT) < 1e-9).length, splashes = (by.splash || []).filter((a) => Math.abs(a - AD * 0.4) < 1e-9).length;
    const balls = run.bubbles.looks.clouds?.length || 0;
    return ok(sources === 'glitter splash' && hits >= 3 && splashes >= 3 && !volleys.length && balls >= 1 && !run.lash.list?.some?.((t) => t.striking), { sources, hits, splashes, volleys: volleys.length, balls, bug: bug.hp, next: next.hp });
  },
});

story('types/glitter-burst-sphere', {
  about: 'The Glitter jelly\'s burst is a 10 cm sphere: it splashes a bug beside the one it hit and a mosquito 6 cm above, not one 15 cm off nor the bug the bomb hit, and shows its glitter flung out to fill that same 10 cm, roughly (no shell drawn round it). The Glitter Element bought as a Treasure (jelly types off) keeps its floor ring.',
  setup() { quiet(); },
  play() {
    const { run, enemies } = G(), B = run.bubbles;
    const hit = roachAt(0, -0.25), beside = roachAt(0.06, -0.25), far = roachAt(0.15, -0.25), flyer = spawn('mosquito', near(0, -0.25, 0.06), { still: true, hp: 9999 });
    const log = record('damage_taken');
    B.splash(bomb(hit));
    const got = { hit: splashOn(log, hit).length, beside: splashOn(log, beside)[0], flyer: splashOn(log, flyer)[0], far: splashOn(log, far).length };
    const ball = B.looks.clouds.find((v) => v.visible), at = enemies.center(hit).clone(), F = G().fx.glitter;
    const plain = !B.looks.balls;   // no shell
    step(12);
    // how far out the flakes got: the farthest few, a little before they sink
    const reach = F.list.filter((f) => f.life && !f.down).map((f) => f.p.distanceTo(at)).sort((a, b) => b - a);
    const grown = reach[Math.floor(reach.length * 0.05)];
    step(30);
    const gone = !ball?.visible;
    // the Element as a Treasure: no ball
    fresh({ bubbles: true });
    const shown = G().run.bubbles.looks.clouds?.filter((v) => v.visible).length || 0;
    const e = roachAt(0, -0.25);
    G().run.bubbles.splash({ m: { position: enemies.center(e).clone() }, r: 0.0065, dmg: 1, pw: 6 * 4.5, ep: elementParams('glitter'), elems: new Set(['glitter']), hit: new Set([e]) });
    const old = (G().run.bubbles.looks.clouds?.filter((v) => v.visible).length || 0) - shown;
    const pass = got.hit === 0 && Math.abs(got.beside - AD * 0.4) < 1e-9 && Math.abs(got.flyer - AD * 0.4) < 1e-9 && got.far === 0
      && Math.abs(grown - RADIUS) < RADIUS * 0.25 && gone && old === 0 && plain;
    return ok(pass, { ...got, grown, radius: RADIUS, gone, old, plain });
  },
});

story('types/glitter-aims-at-flying-bugs', {
  about: 'A Glitter jelly with only a mosquito hovering 8 cm up in range throws its bombs at it, and they hit it.',
  setup() { setupFight({ types: 'glitter' }); },
  play() {
    const log = record('damage_taken');
    const flyer = spawn('mosquito', near(0, -0.14, 0.08), { still: true, hp: 9999 });
    step(60 * 3);
    const hits = log.filter((d) => d.targetId === flyer.id && d.source === 'bubble' && d.feedback?.element === 'glitter').length;
    return ok(hits >= 2, { hits });
  },
});

story('treasures/random-status', {
  about: 'random-status statuses="stunned" time=1.5: a glitter burst Stuns the bug it hit and the one beside it, not one outside; with "chilled" it Chills them and its glitter turns blue; with "burning" they Burn. "frozen" is not a status it can roll.',
  setup() { quiet(); },
  play() {
    const { run, enemies } = G(), S = enemies.statuses, out = {};
    for (const st of ['stunned', 'chilled', 'burning']) {
      quiet();
      withWords(`random-status statuses="${st}" time=1.5`);
      const hit = roachAt(0, -0.25), beside = roachAt(0.05, -0.25), far = roachAt(0.2, -0.25);
      G().run.bubbles.splash(bomb(hit));
      const ball = G().run.bubbles.looks.clouds.find((v) => v.visible);
      out[st] = [S[st](hit), S[st](beside), S[st](far), ball?.color?.toString(16)];
    }
    const yes = (a) => a[0] > 0 && a[1] > 0 && a[2] === 0;
    return ok(yes(out.stunned) && yes(out.chilled) && yes(out.burning) && out.chilled[3] === '7ad8ff' && !!mistake('random-status statuses="frozen"'), out);
  },
});

story('treasures/crit-splash', {
  about: 'crit by="splash" chance=1 mult=3: every glitter burst Crits, splashing for 3x (5.76, not 1.92); crit by="bubbles" leaves bursts alone.',
  setup() { quiet(); },
  play() {
    const one = (words) => {
      quiet(); withWords(words);
      const hit = roachAt(0, -0.25), beside = roachAt(0.05, -0.25), log = record('damage_taken');
      G().run.bubbles.splash(bomb(hit));
      return splashOn(log, beside)[0];
    };
    const crit = one('crit by="splash" chance=1 mult=3'), plain = one('crit by="bubbles" chance=1 mult=3');
    return ok(Math.abs(crit - AD * 0.4 * 3) < 1e-9 && Math.abs(plain - AD * 0.4) < 1e-9, { crit, plain });
  },
});

story('treasures/splash', {
  about: 'on-kill-of by="splash" { splash dmg=0.5 }: a bug a splash kills bursts into confetti that splashes the bug beside it for half a burst (0.96), and a bug killed by a bomb\'s own hit doesn\'t.',
  setup() { quiet(); },
  play() {
    withWords('on-kill-of by="splash" {\n  splash dmg=0.5\n}');
    const a = roachAt(0, -0.25), beside = roachAt(0.04, -0.25), log = record('damage_taken');
    kill(a);
    const conf = splashOn(log, beside).filter((n) => n < 1e5);
    const b = roachAt(0.3, -0.25), near2 = roachAt(0.34, -0.25);
    bus.emit('damage_taken', { targetId: b.id, amount: 1e6, source: 'bubble', feedback: { element: 'glitter' } });
    const none = splashOn(log, near2).length;
    return ok(conf.length === 1 && Math.abs(conf[0] - AD * 0.4 * 0.5) < 1e-9 && none === 0 && !!mistake('on-kill-of by="splash" {\n  splash dmg=0\n}'), { conf, none });
  },
});

story('treasures/gild', {
  about: 'gild chance=1 time=3 bombs=5: a bug a burst splashes turns to gold, held still (Stunned) for 3 s; then it bursts into small glitter bombs, one at each of the 2 bugs near it, at half a bomb\'s hit. The boss and Elites are never gilded.',
  setup() { quiet(); },
  play() {
    const { run, enemies } = G(), B = run.bubbles;
    withWords('gild chance=1 time=3 bombs=5');
    const hit = roachAt(0, -0.25), gold = roachAt(0.05, -0.25), elite = roachAt(-0.05, -0.25);
    elite.proxy = { maxHp: 2000, damage() {} };
    const n1 = roachAt(0.12, -0.3), n2 = roachAt(0.12, -0.2);
    const blows = spy(B, 'blow');
    B.splash(bomb(hit));
    delete elite.proxy;
    const held = enemies.statuses.stunned(gold) > 0, gilded = B.gilded.map((g) => g.e);
    step(60 * 2);
    const early = blows.length;
    step(60 * 1.2);
    const bombs = blows.filter((c) => c[2].tint === 'glitter' && Math.abs(c[2].dmg - AD * HIT * 0.5) < 1e-9);
    const at = new Set(bombs.map((c) => c[1]));
    return ok(held && gilded.includes(gold) && !gilded.includes(elite) && early === 0 && bombs.length >= 2 && at.has(n1) && at.has(n2) && !!mistake('gild bombs=0'), { held, gilded: gilded.length, early, bombs: bombs.length });
  },
});

story('treasures/splash-reflect', {
  about: 'splash-reflect: a burst going off 4 cm from a wall goes off once more, thrown back off it, splashing a bug 14 cm from the wall that the first missed; one in the open goes off once.',
  setup() { quiet(); },
  play() {
    const { run, world } = G(), B = run.bubbles;
    withWords('splash-reflect');
    // find a wall: from the jelly, the nearest thing straight ahead along -z at bug height
    // find a wall: the nearest thing round the jelly at bug height
    const from = near(0, 0, 0.012);
    let h = null, dir = null;
    for (let k = 0; k < 16; k++) {
      const d = new THREE.Vector3(Math.cos(k / 16 * Math.PI * 2), 0, Math.sin(k / 16 * Math.PI * 2)), x = world.cast(from, d, 3);
      if (x && x.distance > 0.2 && (!h || x.distance < h.distance)) { h = { distance: x.distance, point: x.point.clone() }; dir = d; }
    }
    if (!h) return ok(false, { wall: 'none near' });
    const at = h.point.clone().addScaledVector(dir, -0.04);
    const hit = roachAt(at.x - G().player.position.x, at.z - G().player.position.z), back = spawn('roach', at.clone().addScaledVector(dir, -0.11).setY(G().player.position.y), { still: true, hp: 9999 });
    const log = record('damage_taken'), balls = () => (B.looks.clouds || []).filter((v) => v.visible).length;
    const before = balls();
    B.splash(bomb(hit, G().enemies.center(hit).clone()));
    const wallBalls = balls() - before, reflected = splashOn(log, back).length;
    const open = roachAt(0.4, 0.4), b0 = balls();
    B.splash(bomb(open));
    return ok(wallBalls === 2 && reflected === 1 && balls() - b0 === 1, { wall: h.distance, wallBalls, reflected, open: balls() - b0 });
  },
});

story('treasures/wish', {
  about: 'wish 10: a splash that kills 10 bugs gives a free level-up once an act; a second one in the same act gives nothing, and a splash that kills 9 never does. Fewer than 3 kills is a mistake.',
  setup() { setupFight({ types: 'glitter', bubbles: false }); },
  play() {
    const { run } = G();
    withWords('wish 10');
    const lv = () => run.level + 0;
    const l0 = lv();
    bus.emit('big_splash', { pos: near(0, 0), kills: 9 });
    const l9 = lv();
    bus.emit('big_splash', { pos: near(0, 0), kills: 10 });
    const l10 = lv();
    bus.emit('big_splash', { pos: near(0, 0), kills: 12 });
    return ok(l9 === l0 && l10 === l0 + 1 && lv() === l10 && !!mistake('wish 2'), { l0, l9, l10, again: lv() });
  },
});

story('treasures/splash-shots', {
  about: 'splash-shots min=5 dmg=0.5: a burst that reaches 5 bugs fires a star shot at each, half the bomb\'s hit (3.12); one that reaches 4 fires none.',
  setup() { quiet(); },
  play() {
    const { run } = G(), B = run.bubbles;
    withWords('splash-shots min=5 dmg=0.5');
    const shots = spy(B, 'blow');
    const five = [0, 0.03, -0.03, 0.05, -0.05].map((x) => roachAt(x, -0.25));
    B.splash(bomb(five[0]));
    const at5 = shots.filter((c) => Math.abs(c[2].dmg - AD * HIT * 0.5) < 1e-9).length;
    shots.length = 0;
    const four = [0, 0.03, -0.03, 0.05].map((x) => roachAt(x + 0.5, 0.4));
    B.splash(bomb(four[0]));
    return ok(at5 === 5 && shots.length === 0 && !!mistake('splash-shots min=0'), { at5, at4: shots.length });
  },
});

story('treasures/echo-bubble-from-splash', {
  about: 'echo-bubble from="splash" count=3 dmg=0.3: every glitter burst fires 3 small shots at the 3 nearest bugs, 30% of the bomb\'s hit (1.872); from="pop" (as before) fires none from a burst.',
  setup() { quiet(); },
  play() {
    const { run } = G(), B = run.bubbles;
    withWords('echo-bubble from="splash" count=3 dmg=0.3');
    const shots = spy(B, 'blow');
    const bugs = [0, 0.06, -0.06, 0.12].map((x) => roachAt(x, -0.25));
    B.splash(bomb(bugs[0]));
    const n = shots.filter((c) => Math.abs(c[2].dmg - AD * HIT * 0.3) < 1e-9 && c[2].size < SIZE).length;
    return ok(n === 3 && !!mistake('echo-bubble from="nowhere"'), { n });
  },
});

story('treasures/next-attack', {
  about: 'every 1 { next-attack width=3 }: the Glitter jelly\'s next bomb bursts 3 times as wide (30 cm), and the one after is back to 10 cm. A next-attack that changes nothing is a mistake.',
  setup() { setupFight({ types: 'glitter' }); },
  play() {
    const { run } = G(), B = run.bubbles;
    withWords('every 1 first=0.05 {\n  next-attack width=3\n}');
    const widths = spy(B, 'blow');
    roachAt(0, -0.14);
    step(10);
    const armed = !!B.next;
    step(60 * 2);
    const w = widths.filter((c) => c[2].tint === 'glitter').map((c) => +c[2].ep.width.toFixed(3));
    const base = +(0.08 / 0.026).toFixed(3);
    return ok(armed && w.includes(+(base * 3).toFixed(3)) && w.includes(base) && !!mistake('every 1 {\n  next-attack\n}'), { armed, w });
  },
});

story('treasures/crumb-on-kill-level', {
  about: 'crumb-on-kill drop="level" chance=1: a kill drops one big XP gem worth the rest of the level; picking it up levels the jelly up. A drop that is neither health nor level is a mistake.',
  setup() { setupFight({ types: 'glitter', bubbles: false }); },
  play() {
    const { run } = G();
    withWords('crumb-on-kill drop="level" chance=1');
    const before = run.xpDrops.list.length, need = xpToNext(run.level) - run.xp;
    const e = roachAt(0.05, -0.05);
    kill(e);
    const gem = run.xpDrops.list.slice(before).find((d) => d.value >= need);
    const l0 = run.level;
    step(60 * 3);
    return ok(!!gem && run.level > l0 && !!mistake('crumb-on-kill drop="pearls"'), { gem: gem?.value, need, l0, level: run.level });
  },
});

// ------------------------------------------------------------------ Glitter's pool, as content
const SAYS = {
  prism: (m) => m.splashShots.some((S) => S.min === 0 && S.count === 3 && S.dmg === 0.3),
  rainbow: (m) => m.randomStatus?.statuses.join(' ') === 'burning chilled stunned' && m.randomStatus.time === 1.5,
  luckySparkle: (m) => m.hits.splash.crit?.chance === 0.15 && m.hits.splash.crit.mult === 3,
  confettiPop: (m) => m.killsOf.some((K) => K.by === 'splash' && K.effects[0].kind === 'splash' && K.effects[0].dmg === 0.5),
  midasTouch: (m) => m.gild?.chance === 0.05 && m.gild.time === 3 && m.gild.bombs === 5,
  discoBomb: (m) => m.timed.some((T) => T.every === 8 && T.effects[0].kind === 'next-attack' && T.effects[0].width === 3),
  mirrorGlitter: (m) => m.splashReflect === true,
  wish: (m) => m.wish?.kills === 10,
  jackpot: (m) => m.jackpot?.chance === 0.01,
  hotStreak: (m) => m.buffs.some((b) => b.event === 'big-splash' && b.stat === 'bubbleSize' && b.amount === 50 && b.percent && b.stacks === 3),
  partyPopper: (m) => m.nth.some((N) => N.every === 10 && N.random && N.effects[0].kind === 'big' && N.effects[0].dmg === 3),
  starBurst: (m) => m.splashShots.some((S) => S.min === 5 && S.dmg === 0.5),
};
story('upgrades/glitter-pool', {
  about: 'Glitter has exactly 12 Attack upgrades, each setting what its text says (Prism\'s 3 shots, Midas Touch\'s gold, Wish\'s 10 kills, …) and nothing before it is taken; a Glitter run is offered only those, a Fire run none of them.',
  setup() { fresh({ types: 'glitter' }); },
  play() {
    const { run } = G(), wrong = [], pool = CONTENT.upgrades.filter((u) => u.jelly === 'glitter').map((u) => u.id);
    for (const id of GLITTER_POOL) {
      run.upgrades = [];
      let before; try { before = SAYS[id](run.mods); } catch { before = false; }
      run.upgrades = [id];
      if (before || !SAYS[id](run.mods)) wrong.push(id);
    }
    run.upgrades = [];
    const offered = new Set();
    stub(run.ui, 'choose', (title, sub, choices) => choices.forEach((c) => offered.add(c.id)));
    for (let i = 0; i < 40; i++) run.pickUpgrade({ id: 2 }, () => {});
    const own = [...offered].every((id) => GLITTER_POOL.includes(id)) && offered.size === 12;
    fresh({ types: 'fire' });
    const fireOffered = new Set();
    stub(G().run.ui, 'choose', (title, sub, choices) => choices.forEach((c) => fireOffered.add(c.id)));
    for (let i = 0; i < 40; i++) G().run.pickUpgrade({ id: 2 }, () => {});
    const clean = [...fireOffered].every((id) => !GLITTER_POOL.includes(id));
    fresh();
    return ok(!wrong.length && pool.length === 12 && pool.every((id) => GLITTER_POOL.includes(id)) && own && clean, { wrong, pool: pool.length, own, offered: offered.size, clean });
  },
});

story('upgrades/glitter-party-popper', {
  about: 'Party Popper (nth-attack 10 random=#true { big dmg=3 size=2 }) works on the Glitter bomb: with every bomb a big one, each hits for 3x (18.72) and is twice the size.',
  setup() { setupFight({ types: 'glitter' }); },
  play() {
    const { run } = G();
    withWords('nth-attack 2 {\n  big dmg=3 size=2\n}');
    const blows = spy(run.bubbles, 'blow');
    roachAt(0, -0.14);
    step(60 * 2.5);
    const g = blows.filter((c) => c[2].tint === 'glitter'), big = g.filter((c) => Math.abs(c[2].dmg - AD * HIT * 3) < 1e-9 && Math.abs(c[2].size - SIZE * 2) < 1e-9);
    return ok(g.length >= 2 && big.length >= 1 && big.length < g.length, { bombs: g.length, big: big.length });
  },
});

story('types/glitter-pick-card-attacks', {
  about: 'On the pick screen, the Glitter card wears its look (the sparkle piece) and, in the centre, its jelly throws real glitter bombs at the three roaches: their bursts splash, they die and come back.',
  setup() {},
  play() {
    const { GAME, mainMenu, picker } = G(), live = picker.live;
    const keys = [PLAYED_KEY, BEST_KEY], was = keys.map((k) => localStorage.getItem(k));
    keys.forEach((k) => localStorage.removeItem(k)); localStorage.setItem(PLAYED_KEY, '1');   // a returning player sees the pick screen
    try {
      fresh({ types: 'glitter' }); mainMenu.home = true; picker.close(); GAME.startRun();
      stub(live, 'draw', () => {});   // the pictures themselves are for screenshots (a software renderer builds shaders slowly)
      stub(live.renderer, 'compileAsync', () => Promise.resolve());
      stub(picker, 'portrait', () => '');
      picker.tick(picker.last + 16);
      let bombs = 0, balls = 0, kills = 0, dead = 0, list = live.P.enemies.list;
      for (let i = 0; i < 10 * 30; i++) {
        live.simulate(1 / 30);
        const now = live.P.enemies.list, n = now.filter((b) => b.dead).length;
        if (now !== list) { kills += 3 - dead; list = now; dead = 0; } else { kills += n - dead; dead = n; }
        bombs = Math.max(bombs, live.P.bubbles.list.filter((b) => b.tint === 'glitter').length);
        balls = Math.max(balls, live.P.bubbles.looks.clouds?.filter((v) => v.visible).length || 0);
      }
      const worn = !!live.P.worn.pieces.sparkle?.group.visible;
      return ok(picker.liveFor === 'glitter' && bombs >= 1 && balls >= 1 && kills >= 3 && worn, { live: picker.liveFor, bombs, balls, kills, worn });
    } finally {
      keys.forEach((k, i) => (was[i] === null ? localStorage.removeItem(k) : localStorage.setItem(k, was[i])));
      picker.close(); mainMenu.home = false;
    }
  },
});
