// Stories: the Poison jelly type (docs/jelly-types phase P8c): its blob, burst and Poison status, its
// weakening, and the words its 12 Attack upgrades brought (percent-dot, spread-on-touch, split-on-hit,
// cloud, pass-stacks, heal, blob).
import { bus, PLAYER } from '../events.js';
import { CONTENT, compileMods, compileTreasures } from '../content.js';
import { parse } from '../kdl.js';
import { elementParams } from '../words.js';
import { PLAYED_KEY } from '../first-run.js';
import { BEST_KEY } from '../leaderboard.js';
import { G, fresh, ok, record, roachAt, setupFight, spawn, near, spy, step, story, stub, offs } from './kit.js';

// the run's combined effects become what it owns (and its jelly's own) plus these words, until the story ends
function withWords(src) {
  const { run } = G();
  const [t] = compileTreasures(parse(`treasure "p8c" name="P8c" icon="x" text="x" {\n${src}\n}`, 'p8c.kdl'), 'p8c.kdl');
  const m = compileMods(run.owned, run.evolved || [], run.upgrades || [], run.attack ? run.jelly : null);
  for (const fx of t.effects) fx(m, 0);
  Object.defineProperty(run, 'mods', { value: m, configurable: true, writable: true });
  offs.push(() => { delete run.mods; });
  G().enemies.mods = m;
  return m;
}
const mistake = (src) => { try { compileTreasures(parse(`treasure "x" name="X" icon="x" text="x" {\n${src}\n}`, 't.kdl'), 't.kdl'); return null; } catch (e) { return e.message; } };
const poison = (o = {}) => ({ ...elementParams('poison'), ...o });
const kill = (e) => bus.emit('damage_taken', { targetId: e.id, amount: 1e6, source: 'bubble' });
const stacks = (e) => G().enemies.statuses.poisoned(e);
// a Poison fight whose jelly doesn't fire (its Poison still ticks: bubbles' update runs)
const quiet = () => { setupFight({ types: 'poison' }); stub(G().run.bubbles, 'elementVolley', () => false); };
const POISON_POOL = ['wither', 'lingeringDose', 'overdose', 'splatter', 'venomStrike', 'wasteAway', 'toxicCloud', 'burstSac', 'leech', 'contagion', 'poisonRain', 'splitBlob'];

story('types/poison-plays', {
  about: 'A Poison jelly hurts a bug only with its blob (5 x 0.6 = 3 a hit) and the Poison its burst adds: no bubbles, no stings, no puddles. A bug under steady fire holds the most stacks, 5. A Poisoned bug deals 20% less damage to the jelly (the type\'s own status-taken), one without Poison as much as ever.',
  setup() { setupFight({ types: 'poison' }); },
  play() {
    const { run } = G(), log = record('damage_taken'), volleys = spy(run.bubbles, 'volley');
    const bug = roachAt(0, -0.12);
    step(60 * 4);
    const by = {};
    for (const d of log) if (d.targetId !== PLAYER) { const k = d.source === 'bubble' && d.feedback?.element ? d.feedback.element : d.source; (by[k] ||= []).push(d.amount); }
    const only = Object.keys(by).length === 1 && by.poison?.length > 0;
    const hits = by.poison.filter((a) => Math.abs(a - 3) < 1e-9).length, ticks = by.poison.length - hits;
    const held = stacks(bug), noPuddles = run.bubbles.puddles.length === 0;
    const plain = roachAt(0.2, 0.2);
    const taken = spy(run, 'hit'), from = (e) => { run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount: 4, from: e.id, source: 'story' }); return taken.at(-1)[0]; };
    const k = run.stage.power || 1, weak = from(bug), full = from(plain);
    const pass = only && hits >= 5 && ticks > 3 && held === 5 && noPuddles && !volleys.length && Math.abs(weak - 3.2 * k) < 1e-9 && Math.abs(full - 4 * k) < 1e-9;
    return ok(pass, { sources: Object.keys(by), hits, ticks, held, noPuddles, volleys: volleys.length, weak, full });
  },
});

story('types/poison-burst-and-stacks', {
  about: 'The Poison blob\'s burst is a sphere: it Poisons the bug it hit, a flying bug 3 cm above and nothing 10 cm away, and does no damage itself. Each stack does 20% of Attack damage a second, at most 5 stacks; a new stack restarts the time, and Poison ends 5 s after the last one.',
  setup() { quiet(); },
  play() {
    const { run } = G(), B = run.bubbles;
    const hit = roachAt(0, -0.2), far = roachAt(0.1, -0.2), flyer = spawn('mosquito', near(0, -0.2, 0.09), { still: true, hp: 9999 });
    const log = record('damage_taken');
    const b = { m: { position: G().enemies.center(hit).clone() }, r: 0.0065 * 1.2, pw: 5 * 4.5, ep: poison(), elems: new Set(['poison']), hit: new Set([hit]) };
    B.splash(b);
    const reached = [stacks(hit), stacks(flyer), stacks(far)], dealt = log.length;
    for (let i = 0; i < 6; i++) B.poison(hit, 5 * 4.5, poison());
    step(60);
    const ticks = log.filter((d) => d.targetId === hit.id && d.source === 'poison').map((d) => d.amount);
    step(60 * 3); B.poison(hit, 5 * 4.5, poison()); step(60 * 3);
    const refreshed = stacks(hit);
    step(60 * 2.5);
    const ended = stacks(hit);
    const pass = reached[0] === 1 && reached[1] === 1 && reached[2] === 0 && dealt === 0 && stacks(hit) === 0 && refreshed === 5 && ended === 0
      && ticks.length >= 2 && ticks.every((a) => Math.abs(a - 5 * 0.2 * 5 * 0.5) < 1e-9);
    return ok(pass, { reached, dealt, ticks, refreshed, ended });
  },
});

story('types/poison-hits-count-as-poison', {
  about: 'Venom Strike\'s status-damage by="poison": the blob\'s hit on a bug with 2 Poison stacks lands 40% harder; a Poison tick on it doesn\'t (Wither and Venom Strike are for hits only), nor does a plain bubble.',
  setup() { quiet(); },
  play() {
    withWords('status-damage "poisoned" more=0 per-stack=0.2 by="poison" elites=#true');
    const bug = roachAt(0, -0.2), landed = record('enemy_hit');
    G().run.bubbles.poison(bug, 1e-6, poison({ poisonTime: 30 }), 2);
    const hit = (source, feedback) => { landed.length = 0; bus.emit('damage_taken', { targetId: bug.id, amount: 3, source, feedback }); return landed[0]?.amount; };
    const blob = hit('bubble', { element: 'poison' }), tick = hit('poison'), plain = hit('bubble');
    return ok(Math.abs(blob - 4.2) < 1e-9 && tick === 3 && plain === 3, { blob, tick, plain });
  },
});

story('treasures/percent-dot', {
  about: 'percent-dot "poisoned" share=0.01: a Poisoned bug loses 1% of its max Health a second, an Elite too, the boss not (unless boss=#true); a bug without Poison loses nothing. A share of 1 or more is a mistake.',
  setup() { quiet(); },
  play() {
    const { run } = G(), B = run.bubbles;
    withWords('percent-dot "poisoned" share=0.01');
    const sick = roachAt(0, -0.2, { still: true, hp: 1000 }), well = roachAt(0.1, -0.2, { still: true, hp: 1000 });
    const elite = roachAt(-0.1, -0.2), boss = roachAt(-0.2, -0.2);
    elite.proxy = { maxHp: 2000, damage() {} }; boss.proxy = { maxHp: 2000, damage() {} }; boss.boss = true;
    for (const e of [sick, elite, boss]) B.poison(e, 1e-6, poison({ poisonTime: 30 }));
    const log = record('damage_taken');
    step(60 * 2);
    const big = (e) => log.filter((d) => d.targetId === e.id && d.amount > 1).reduce((a, d) => a + d.amount, 0);
    const got = { sick: big(sick), well: big(well), elite: big(elite), boss: big(boss) };
    delete elite.proxy; delete boss.proxy;
    const pass = Math.abs(got.sick - 20) < 5.1 && got.well === 0 && Math.abs(got.elite - 40) < 10.1 && got.boss === 0 && !!mistake('percent-dot "poisoned" share=1');
    return ok(pass, got);
  },
});

story('treasures/spread-on-touch', {
  about: 'spread-on-touch "poisoned": a bug touching a Poisoned bug gets a Poison stack within half a second; one 30 cm off doesn\'t, and without the word neither does the one touching.',
  setup() { quiet(); },
  play() {
    const spread = (words) => {
      quiet();
      if (words) withWords('spread-on-touch "poisoned"');
      const sick = roachAt(0, -0.2), touching = roachAt(0.05, -0.2), far = roachAt(0.3, -0.2);
      G().run.bubbles.poison(sick, 1, poison({ poisonTime: 30 }));
      step(40);
      return [stacks(touching), stacks(far)];
    };
    const [on, off] = [spread(true), spread(false)];
    return ok(on[0] === 1 && on[1] === 0 && off[0] === 0 && !!mistake('spread-on-touch "burning"'), { on, off });
  },
});

story('treasures/split-on-hit', {
  about: 'split-on-hit 2 dmg=0.5: every Normal bubble that hits a bug splits into 2 halves for half its damage that fly on missing that bug, and a half never splits again.',
  setup() { setupFight({ lash: false }); },
  play() {
    const { run } = G();
    withWords('split-on-hit 2 dmg=0.5');
    const a = roachAt(0, -0.08), log = record('damage_taken'), blows = spy(run.bubbles, 'blow');
    step(60 * 2);
    const full = run.S.bubbleDamage, parents = log.filter((d) => d.targetId === a.id && d.source === 'bubble' && Math.abs(d.amount - full) < 1e-9).length;
    const halves = blows.filter((c) => Math.abs(c[2].dmg - full * 0.5) < 1e-9).length;
    const halvesOnA = log.filter((d) => d.targetId === a.id && Math.abs(d.amount - full * 0.5) < 1e-9).length;
    return ok(parents >= 2 && halves === 2 * parents && !halvesOnA && !!mistake('split-on-hit 0'), { parents, halves, halvesOnA });
  },
});

story('treasures/cloud', {
  about: 'on-kill-of status="poisoned" { cloud radius=0.05 time=3 }: a Poisoned bug that dies leaves a gas cloud that Poisons a bug 3 cm off and not one 15 cm off; after 3 s it is gone and Poisons nothing more.',
  setup() { setupFight({ types: 'poison', bubbles: false }); },
  play() {
    const { run } = G();
    withWords('on-kill-of status="poisoned" {\n  cloud radius=0.05 time=3\n}');
    const victim = roachAt(0, -0.25), inside = roachAt(0.03, -0.25), outside = roachAt(0.15, -0.25);
    run.bubbles.poison(victim, 1);
    kill(victim);
    step(40);
    const got = [stacks(inside), stacks(outside)];
    step(60 * 3);
    const late = roachAt(-0.03, -0.25);
    step(40);
    return ok(got[0] >= 1 && got[1] === 0 && !run.gadgets.clouds.length && stacks(late) === 0 && !!mistake('on-kill-of status="poisoned" {\n  cloud radius=0\n}'), { got, late: stacks(late), clouds: run.gadgets.clouds.length });
  },
});

story('treasures/pass-stacks', {
  about: 'on-kill-of status="poisoned" { pass-stacks "poisoned" radius=0.06 }: a bug that dies with 3 Poison stacks passes all 3 to a bug 4 cm off, none to one 20 cm off.',
  setup() { setupFight({ types: 'poison', bubbles: false }); },
  play() {
    const { run } = G();
    withWords('on-kill-of status="poisoned" {\n  pass-stacks "poisoned" radius=0.06\n}');
    const victim = roachAt(0, -0.25), close = roachAt(0.04, -0.25), far = roachAt(0.2, -0.25);
    run.bubbles.poison(victim, 1, null, 3);
    kill(victim);
    return ok(stacks(close) === 3 && stacks(far) === 0 && !!mistake('on-kill-of status="poisoned" {\n  pass-stacks "burning"\n}'), { close: stacks(close), far: stacks(far) });
  },
});

story('treasures/heal', {
  about: 'on-kill-of status="poisoned" { heal 1 most=3 }: each Poisoned bug that dies gives back 1 Health, at most 3 times a second; a bug without Poison gives nothing.',
  setup() { setupFight({ types: 'poison', bubbles: false }); },
  play() {
    const { run } = G();
    withWords('on-kill-of status="poisoned" {\n  heal 1 most=3\n}');
    const heals = spy(run, 'heal'), ones = () => heals.filter((c) => c[0] === 1).length;
    kill(roachAt(0.3, 0.3));
    const plain = ones();
    for (let i = 0; i < 5; i++) { const e = roachAt(0.05 * i, -0.3); run.bubbles.poison(e, 1); kill(e); }
    const capped = ones();
    step(70);
    const e = roachAt(0, 0.3); run.bubbles.poison(e, 1); kill(e);
    return ok(plain === 0 && capped === 3 && ones() === 4 && !!mistake('heal 0'), { plain, capped, after: ones() });
  },
});

story('treasures/blob', {
  about: 'every 1 { blob count=2 range=0.3 }: Poison blobs fall from above on 2 of the 3 bugs within 30 cm (one each) and Poison them; a bug farther off gets none.',
  setup() { setupFight({ types: 'poison' }); },
  play() {
    const { run, enemies } = G();
    stub(run.bubbles, 'elementVolley', () => false);   // only the timed blobs fire
    withWords('every 1 first=0.1 {\n  blob count=2 range=0.3\n}');
    const bugs = [roachAt(0, -0.1), roachAt(0.1, -0.1), roachAt(-0.1, -0.1)], far = roachAt(0.5, 0.5);
    const blows = spy(run.bubbles, 'blow');
    step(20);
    const fell = blows.filter((c) => c[2].tint === 'poison' && c[0].y > enemies.center(c[1]).y + 0.05);
    step(60);
    const poisoned = bugs.filter((e) => stacks(e) > 0).length;
    return ok(fell.length === 2 && new Set(fell.map((c) => c[1])).size === 2 && poisoned >= 2 && stacks(far) === 0 && !!mistake('every 1 {\n  blob count=0\n}'), { fell: fell.length, poisoned, far: stacks(far) });
  },
});

// ------------------------------------------------------------------ Poison's pool, as content
const SAYS = {
  wither: (m) => m.statusDamage.some((d) => d.status === 'poisoned' && d.perStack === 0.06 && d.more === 0 && d.elites),
  lingeringDose: (m) => m.element.poison.poisonTime === 10,
  overdose: (m) => m.element.poison.poisonStacks === 10,
  splatter: (m) => Math.abs(m.element.poison.width - 1.5 * 0.05 / 0.026) < 1e-9,
  venomStrike: (m) => m.statusDamage.some((d) => d.status === 'poisoned' && d.perStack === 0.2 && d.by === 'poison'),
  wasteAway: (m) => m.percentDots.some((d) => d.status === 'poisoned' && d.share === 0.01 && !d.boss),
  toxicCloud: (m) => m.killsOf.some((K) => K.status === 'poisoned' && K.effects[0].kind === 'cloud' && K.effects[0].radius === 0.05 && K.effects[0].time === 3),
  burstSac: (m) => m.killsOf.some((K) => K.status === 'poisoned' && K.effects[0].kind === 'pass-stacks' && K.effects[0].radius === 0.06),
  leech: (m) => m.killsOf.some((K) => K.status === 'poisoned' && K.effects[0].kind === 'heal' && K.effects[0].health === 1 && K.effects[0].most === 3),
  contagion: (m) => m.spreadOnTouch.includes('poisoned'),
  poisonRain: (m) => m.timed.some((T) => T.every === 8 && T.effects[0].kind === 'blob' && T.effects[0].count === 4),
  splitBlob: (m) => m.split?.count === 2 && m.split.dmg === 0.5,
};
story('upgrades/poison-pool', {
  about: 'Poison has exactly 12 Attack upgrades, each setting what its text says (Overdose\'s 10 stacks, Toxic Cloud\'s gas, Split Blob\'s two halves, …) and nothing before it is taken; a Poison run is offered only those, a Fire run none of them.',
  setup() { fresh({ types: 'poison' }); },
  play() {
    const { run } = G(), wrong = [], pool = CONTENT.upgrades.filter((u) => u.jelly === 'poison').map((u) => u.id);
    for (const id of POISON_POOL) {
      run.upgrades = [];
      let before; try { before = SAYS[id](run.mods); } catch { before = false; }
      run.upgrades = [id];
      if (before || !SAYS[id](run.mods)) wrong.push(id);
    }
    run.upgrades = [];
    const offered = new Set();
    stub(run.ui, 'choose', (title, sub, choices) => choices.forEach((c) => offered.add(c.id)));
    for (let i = 0; i < 40; i++) run.pickUpgrade({ id: 2 }, () => {});
    const own = [...offered].every((id) => POISON_POOL.includes(id)) && offered.size === 12;
    fresh({ types: 'fire' });
    const fireOffered = new Set();
    stub(G().run.ui, 'choose', (title, sub, choices) => choices.forEach((c) => fireOffered.add(c.id)));
    for (let i = 0; i < 40; i++) G().run.pickUpgrade({ id: 2 }, () => {});
    const clean = [...fireOffered].every((id) => !POISON_POOL.includes(id));
    fresh();
    return ok(!wrong.length && pool.length === 12 && pool.every((id) => POISON_POOL.includes(id)) && own && clean, { wrong, pool: pool.length, own, offered: offered.size, clean });
  },
});

story('types/poison-pick-card-attacks', {
  about: 'On the pick screen, the Poison card wears its look (the toxin piece) and, in the centre, its jelly fires real Poison blobs at the three roaches: they are Poisoned, die and come back.',
  setup() {},
  play() {
    const { GAME, mainMenu, picker } = G(), live = picker.live;
    const keys = [PLAYED_KEY, BEST_KEY], was = keys.map((k) => localStorage.getItem(k));
    keys.forEach((k) => localStorage.removeItem(k)); localStorage.setItem(PLAYED_KEY, '1');   // a returning player sees the pick screen
    try {
      fresh({ types: 'poison' }); mainMenu.home = true; picker.close(); GAME.startRun();
      stub(live, 'draw', () => {});   // the pictures themselves are for screenshots (a software renderer builds shaders slowly)
      stub(live.renderer, 'compileAsync', () => Promise.resolve());
      stub(picker, 'portrait', () => '');
      picker.tick(picker.last + 16);
      let blobs = 0, poisoned = 0, kills = 0, dead = 0, list = live.P.enemies.list;
      for (let i = 0; i < 10 * 30; i++) {
        live.simulate(1 / 30);
        const now = live.P.enemies.list, n = now.filter((b) => b.dead).length;
        if (now !== list) { kills += 3 - dead; list = now; dead = 0; } else { kills += n - dead; dead = n; }
        blobs = Math.max(blobs, live.P.bubbles.list.filter((b) => b.tint === 'poison').length);
        poisoned = Math.max(poisoned, live.P.bubbles.poisoned.size);
      }
      const worn = !!live.P.worn.pieces.toxin?.group.visible;
      return ok(picker.liveFor === 'poison' && blobs >= 1 && poisoned >= 2 && kills >= 3 && worn, { live: picker.liveFor, blobs, poisoned, kills, worn });
    } finally {
      keys.forEach((k, i) => (was[i] === null ? localStorage.removeItem(k) : localStorage.setItem(k, was[i])));
      picker.close(); mainMenu.home = false;
    }
  },
});
