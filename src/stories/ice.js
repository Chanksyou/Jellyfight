// Stories: the Ice jelly (content/jellies.kdl, docs/jelly-types phase P8a): its attack and look, its 12
// Attack upgrades (content/upgrades.kdl), and the words they brought (chill-to-freeze, ground-lock,
// slide-on-hit, shards, and new props on element-up, ring, shield-recharge and shield-burst).
import { bus } from '../events.js';
import { CONTENT, compileMods, compileTreasures } from '../content.js';
import { parse } from '../kdl.js';
import { elementParams } from '../words.js';
import { G, V, fresh, offs, ok, record, roachAt, setupFight, spawn, near, step, story, stub } from './kit.js';

const ICE_POOL = ['permafrost', 'brittle', 'shatterShards', 'coldSnap', 'glacierShell', 'icicleLance', 'frostbite', 'hoarfrost', 'snowball', 'deepFreeze', 'cryoSleep', 'avalanche'];

// the run's combined effects become what it owns plus these words (until the story ends)
function withWords(src) {
  const { run } = G();
  const [t] = compileTreasures(parse(`treasure "p8a" name="P8a" icon="x" text="x" {\n${src}\n}`, 'p8a.kdl'), 'p8a.kdl');
  const m = compileMods(run.owned, run.evolved || [], run.upgrades || []);
  for (const fx of t.effects) fx(m, 0);
  Object.defineProperty(run, 'mods', { value: m, configurable: true, writable: true });
  offs.push(() => { delete run.mods; });
  G().enemies.mods = m;
  return m;
}
const mistake = (src) => { try { compileTreasures(parse(`treasure "x" name="X" icon="x" text="x" {\n${src}\n}`, 't.kdl'), 't.kdl'); return null; } catch (e) { return e.message; } };
const ice = (o = {}) => ({ ...elementParams('ice'), ...o });
// an ice shard landing on a bug right now, as the flight loop strikes it (heading -z)
function shard(e, ep = ice(), dmg = 10) {
  const b = { elems: new Set(['ice']), tint: 'ice', ep, dmg, pierce: 1 + ep.pierce, vel: V(0, 0, -0.3), hit: new Set(), r: 0.01 };
  G().run.bubbles.strike(b, e, G().run.mods);
}
// a quiet Ice run: no shots of its own (the attack is switched off, so what a story fires by hand still flies), no stings
const calm = (opts = {}) => { setupFight({ types: 'ice', lash: false, ...opts }); G().run.attack = null; stub(G().run.bubbles, 'volley', () => false); };

// ------------------------------------------------------------------ the jelly
story('types/ice-plays', {
  about: 'An Ice jelly starts with Health 31, Shield 5 and Attack damage 9, hurts bugs only with its ice shard (9 each, 1.2 a second: 10.8 damage a second, inside the 9-12 budget), Chills every bug it hits, wears the frost look (crystal in the bell, frost on the tips) and is offered only Ice upgrades.',
  setup() { setupFight({ types: 'ice' }); },
  play() {
    const { run, menus } = G(), s = run.stats;
    run.startPicked = false;
    step(2);
    const stats = run.jelly === 'ice' && s.health === 31 && s.shield === 5 && s.bubbleDamage === 9 && s.fireRate === 1.2 && s.moveSpeed === 0.88 && s.jumpHeight === 0.9 && !menus.open && run.owned.size === 0;
    const bug = roachAt(0, -0.15);
    const log = record('damage_taken');
    let chilled = 0;
    step(60 * 8, () => { if (bug.chillT > 0) chilled++; return false; });
    const hits = log.filter((d) => d.targetId === bug.id), sources = new Set(hits.map((d) => (d.source === 'bubble' && d.feedback?.element) || d.source));
    const amounts = hits.map((d) => d.amount), dps = amounts.reduce((a, b) => a + b, 0) / 8;
    const only = sources.size === 1 && sources.has('ice') && amounts.every((a) => Math.abs(a - 9) < 1e-9);
    const budget = dps >= 9 && dps <= 12;
    const look = run.typeAdorn.join() === 'frost' && !!run.adorn.pieces.frost?.group.visible;
    return ok(stats && only && budget && chilled > 60 && look, { stats, sources: [...sources], shots: amounts.length, dps: +dps.toFixed(2), chilled, look: run.typeAdorn });
  },
});

// ------------------------------------------------------------------ the words
story('treasures/chill-to-freeze', {
  about: 'chill-to-freeze 3 time=1.5: the 3rd ice hit in a row on a Chilled bug freezes it solid for 1.5 s and the count starts over; a Chill that ran out starts the count over too; hits=1 is a mistake.',
  setup() { calm(); },
  play() {
    const { run } = G();
    withWords('chill-to-freeze 3 time=1.5');
    const a = roachAt(0, -0.3), frozen = record('enemy_frozen');
    shard(a); shard(a);
    const two = !(a.freezeT > 0) && a.chillT > 0;
    shard(a);
    const three = Math.abs(a.freezeT - 1.5) < 1e-9 && a.chillHits === 0 && frozen.length === 1;
    shard(a);
    const again = a.chillHits === 1 && frozen.length === 1;
    const b = roachAt(0.2, -0.3);
    shard(b); step(60 * 3); shard(b); shard(b);   // the Chill ran out between the first and the second
    const lapsed = !(b.freezeT > 0) && b.chillHits === 2;
    return ok(two && three && again && lapsed && !!mistake('chill-to-freeze 1'), { two, three, again, lapsed, run: run.jelly });
  },
});

story('treasures/ground-lock', {
  about: 'ground-lock "chilled": a Chilled bug can\'t start a leap, and a step that would take it uphill (or up in the air) doesn\'t happen; an unchilled bug does all of it. An unknown status is a mistake.',
  setup() { setupFight({ bubbles: false, lash: false, hurt: true }); },
  play() {
    const { run, enemies } = G();
    const leaps = (chilled) => {
      for (const e of enemies.list) e.dead = true;
      const e = spawn('lanternfly', near(0, -0.45)); e.leapCd = 0;
      if (chilled) e.chillT = e.slowT = 99;
      let crouched = false;
      step(60 * 4, () => (crouched = crouched || e.state === 'crouch' || e.state === 'leap'));
      e.dead = true;
      return crouched;
    };
    const free = leaps(false);
    withWords('ground-lock "chilled"');
    const locked = leaps(true), unchilled = leaps(false);
    // a walking bug that is lifted a little by every step
    stub(enemies, 'moveGround', (e) => { e.pos.y += 0.01; e.pos.x += 0.001; });
    const climb = (chilled) => {
      const e = roachAt(0, -0.3, { hp: 9999 });
      if (chilled) e.chillT = 99;
      const y0 = e.pos.y, x0 = e.pos.x;
      step(5);
      return { dy: e.pos.y - y0, dx: e.pos.x - x0 };
    };
    const c = climb(true), u = climb(false);
    const stays = Math.abs(c.dy) < 1e-6 && Math.abs(c.dx) < 1e-6 && u.dy > 0.02;
    return ok(free && !locked && unchilled && stays && !!mistake('ground-lock "soggy"'), { free, locked, unchilled, c, u, jelly: run.jelly });
  },
});

story('treasures/slide-on-hit', {
  about: 'slide-on-hit "frozen" distance=0.12: a hit on a Frozen bug sends it sliding 12 cm along the hit (it stays frozen) and Chills every other bug it slides into, but not ones off its path; a bug that isn\'t Frozen stays put.',
  setup() { calm(); },
  play() {
    const { run } = G();
    withWords('slide-on-hit "frozen" distance=0.12');
    const f = roachAt(0, -0.3), inPath = roachAt(0, -0.4), offPath = roachAt(0.2, -0.4), plain = roachAt(-0.2, -0.3);
    f.freezeT = 99;
    const z0 = f.pos.z, p0 = plain.pos.z;
    shard(plain);
    const stayed = Math.abs(plain.pos.z - p0) < 0.03 && !(inPath.chillT > 0);   // (the hit itself shoves a little)
    shard(f);
    const slid = Math.abs(f.pos.z - (z0 - 0.12)) < 0.01 && f.freezeT > 0;
    const chilled = inPath.chillT > 0 && !(offPath.chillT > 0) && f.chillT > 0;
    return ok(stayed && slid && chilled && !!mistake('slide-on-hit "soggy"'), { stayed, slid, dz: +(f.pos.z - z0).toFixed(3), inPath: inPath.chillT, offPath: offPath.chillT, jelly: run.jelly });
  },
});

story('treasures/shards', {
  about: 'on-kill-of status="chilled" { shards 2 range=0.12 dmg=0.5 }: a Chilled bug that dies sends a shard at each of the 2 nearest bugs within 12 cm, for 0.5 x power, and Chills them; the 3rd one, a far one, and a bug that wasn\'t Chilled when it died set off nothing. shards 0 is a mistake.',
  setup() { calm(); },
  play() {
    const { run } = G();
    withWords('on-kill-of status="chilled" {\n  shards 2 range=0.12 dmg=0.5\n}');
    const log = record('damage_taken'), kill = (e) => bus.emit('damage_taken', { targetId: e.id, amount: 1e6, source: 'bubble' });
    const quiet = roachAt(0, -0.6); roachAt(0.05, -0.6);
    kill(quiet);
    const none = !log.some((d) => d.source === 'shards');
    const dying = roachAt(0, -0.3), a = roachAt(0.05, -0.3), b = roachAt(-0.07, -0.3), c = roachAt(0, -0.2), far = roachAt(0.4, -0.3);
    dying.chillT = 5;
    kill(dying);
    const hit = log.filter((d) => d.source === 'shards');
    const ids = new Set(hit.map((d) => d.targetId));
    const nearest = ids.size === 2 && ids.has(a.id) && ids.has(b.id) && hit.every((d) => Math.abs(d.amount - run.power * 0.5) < 1e-9);
    const chilled = a.chillT > 0 && b.chillT > 0 && !(c.chillT > 0) && !(far.chillT > 0);
    return ok(none && nearest && chilled && !!mistake('on-kill-of status="chilled" {\n  shards 0\n}'), { none, nearest, chilled, hit: hit.length });
  },
});

story('treasures/ring-chill', {
  about: 'ring 0.15 chill=2: a ring round you Chills (not just slows) every bug within 15 cm for 2 s and no bug outside it.',
  setup() { calm(); },
  play() {
    const { run } = G();
    const m = withWords('every 6 {\n  ring 0.15 chill=2\n}');
    const near1 = roachAt(0.08, 0), far1 = roachAt(0.3, 0);
    const P = run.player.position, ctx = { feet: P.clone(), center: P.clone().setY(P.y + run.cfg.height * 0.45), facing: run.player.facing, power: run.power, pulse() {} };
    run.gadgets.fire(m.timed[0].effects[0], ctx);
    return ok(near1.chillT === 2 && near1.slowT >= 2 && !(far1.chillT > 0), { near: near1.chillT, far: far1.chillT });
  },
});

story('treasures/shield-recharge-near', {
  about: 'shield-recharge faster=1 near=0.15: the Shield refills twice as fast while a Chilled bug is within 15 cm of you, and at the usual speed with none close or with only an unchilled one; sooner= with near= is a mistake.',
  setup() { calm(); },
  play() {
    const { run } = G();
    withWords('shield-recharge faster=1 near=0.15');
    const gain = () => { run.shield.hp = 0; run.shield.calm = 99; step(60); return run.shield.hp; };
    const alone = gain();
    const e = roachAt(0.06, 0);
    const plain = gain();
    e.chillT = 99;
    const chilled = gain();
    e.pos.x += 0.4;
    const far = gain();
    return ok(alone > 1 && Math.abs(plain - alone) < 0.05 && Math.abs(chilled - 2 * alone) < 0.1 && Math.abs(far - alone) < 0.05 && !!mistake('shield-recharge faster=1 near=0.15 sooner=1'), { alone, plain, chilled, far });
  },
});

story('treasures/shield-burst-invuln', {
  about: 'shield-burst dmg=0 invuln=1: when the Shield breaks you can\'t be hurt for 1 s more, with no blast; without it nothing changes; a burst with neither dmg nor invuln is a mistake.',
  setup() { calm(); },
  play() {
    const { run } = G();
    const log = record('damage_taken'), breaks = () => { run.iFrames = 0; run.shield.hp = run.shield.max; run.shield.absorb(run.shield.max); return run.iFrames; };
    const before = breaks();
    withWords('shield-burst dmg=0 invuln=1');
    roachAt(0.04, 0);
    const after = breaks();
    return ok(before === 0 && Math.abs(after - 1) < 1e-9 && !log.some((d) => d.source === 'shield-burst') && !!mistake('shield-burst dmg=0'), { before, after });
  },
});

story('treasures/ice-frostbite', {
  about: 'element-up "ice" frostbite=0.2: a bug hit by an ice shard takes 20% of the hit every second for as long as it stays Chilled (a tick every half second); without it Chill does no damage.',
  setup() { calm(); },
  play() {
    const log = record('damage_taken');
    const a = roachAt(0, -0.3), b = roachAt(0.2, -0.3);
    shard(a, ice({ frostbite: 0.2 })); shard(b);
    step(60 * 3);
    const ticks = (e) => log.filter((d) => d.source === 'ice' && d.targetId === e.id && d.feedback?.tick).map((d) => d.amount);
    const t = ticks(a);
    return ok(t.length >= 3 && t.length <= 4 && t.every((x) => Math.abs(x - 1) < 1e-9) && !ticks(b).length, { ticks: t.length, amounts: t });
  },
});

story('treasures/ice-lance-snowball', {
  about: 'element-up "ice" chillPierce=1: a shard flies through a bug that was already Chilled without using up its pierce; with pierce=2 grow=0.1 it goes through 2 more bugs and is 10% bigger after each.',
  setup() { calm(); },
  play() {
    const { run } = G(), B = run.bubbles;
    const lane = (ep, pre) => {
      for (const e of G().enemies.list) e.dead = true;
      B.list.forEach((b) => { b.done = true; });
      const a = roachAt(0, -0.14), b = roachAt(0, -0.22), c = roachAt(0, -0.3), d = roachAt(0, -0.38);
      if (pre) a.chillT = 99;
      const log = record('damage_taken'), shots = [];
      B.elementVolley('ice', { ...ep, dmg: 1 }, run.player.position.clone().setY(run.player.position.y + 0.04), run.S, run.mods);
      const first = B.list.find((x) => x.tint === 'ice'), r0 = first.r;
      step(90, () => { const s = B.list.find((x) => x === first); if (s) shots.push(+(s.r / r0).toFixed(3)); return !s || s.done; });
      const hit = [a, b, c, d].map((e) => log.some((x) => x.targetId === e.id && x.source === 'bubble' && x.feedback?.element === 'ice'));
      return { hit: hit.map(Number).join(''), grew: Math.max(...shots) };
    };
    const plain = lane(ice(), false);
    const lance = lane(ice({ chillPierce: 1 }), true), noPre = lane(ice({ chillPierce: 1 }), false);
    const ball = lane(ice({ pierce: 2, grow: 0.1 }), false);
    return ok(plain.hit === '1000' && lance.hit === '1100' && noPre.hit === '1000' && ball.hit === '1110' && Math.abs(ball.grew - 1.21) < 0.02 && plain.grew === 1, { plain, lance, noPre, ball });
  },
});

story('treasures/ice-deep-freeze', {
  about: 'status-damage "frozen" more=2 thaw=#true (Deep Freeze): the next hit on a Frozen bug does 3x and thaws it; the one after is an ordinary hit.',
  setup() { calm(); },
  play() {
    withWords('status-damage "frozen" more=2 thaw=#true');
    const e = roachAt(0, -0.3);
    e.freezeT = 99;
    const hp = e.hp;
    shard(e, ice(), 10);
    const first = hp - e.hp, thawed = e.freezeT === 0;
    shard(e, ice(), 10);
    const second = hp - first - e.hp;
    return ok(Math.abs(first - 30) < 1e-6 && thawed && Math.abs(second - 10) < 1e-6, { first, second, thawed });
  },
});

// ------------------------------------------------------------------ the pool, as content
// each upgrade compiled alone: the combined effects it must set (its behaviour is its words' stories)
const SAYS = {
  permafrost: (m) => m.chillFreeze?.hits === 3 && m.chillFreeze.time === 1.5,
  brittle: (m) => m.statusDamage.some((d) => d.status === 'chilled' && d.more === 0.4),
  shatterShards: (m) => m.killsOf.some((K) => K.status === 'chilled' && K.effects[0].kind === 'shards' && K.effects[0].count === 4),
  coldSnap: (m) => m.timed.some((T) => T.every === 6 && T.effects[0].kind === 'ring' && T.effects[0].chill === 2 && T.effects[0].radius === 0.15),
  glacierShell: (m) => m.shield.near.some((N) => N.faster === 1 && N.radius === 0.15),
  icicleLance: (m) => m.element.ice.chillPierce === 1,
  frostbite: (m) => m.element.ice.frostbite === 0.2,
  hoarfrost: (m) => m.groundLock.includes('chilled'),
  snowball: (m) => m.element.ice.pierce === 2 && Math.abs(m.element.ice.grow - 0.1) < 1e-9,
  deepFreeze: (m) => m.statusDamage.some((d) => d.status === 'frozen' && d.by === 'all' && d.more === 2 && d.thaw),
  cryoSleep: (m) => m.shield.invuln === 1,
  avalanche: (m) => m.slideOnHit.some((S) => S.status === 'frozen' && S.distance === 0.12),
};
story('upgrades/ice-pool', {
  about: 'Ice has exactly 12 Attack upgrades, each setting what its text says (Permafrost\'s freeze, Cold Snap\'s ring every 6 s, Snowball\'s 2 more bugs, …) and nothing before it is taken; an Ice run is offered only those, Deep Freeze and Avalanche only after Permafrost; a Fire run is offered none of them.',
  setup() { fresh({ types: 'ice' }); },
  play() {
    const { run } = G(), wrong = [], pool = CONTENT.upgrades.filter((u) => u.jelly === 'ice');
    for (const id of ICE_POOL) {
      run.upgrades = [];
      let before; try { before = SAYS[id](run.mods); } catch { before = false; }
      run.upgrades = [id];
      if (before || !SAYS[id](run.mods)) wrong.push(id);
    }
    const offers = (taken) => {
      const seen = new Set();
      run.upgrades = taken;
      stub(run.ui, 'choose', (title, sub, choices) => choices.forEach((c) => seen.add(c.id)));
      for (let i = 0; i < 80; i++) run.pickUpgrade({ id: 2 }, () => {});
      return seen;
    };
    const without = offers([]), withP = offers(['permafrost']);
    const gated = without.size === 10 && !without.has('deepFreeze') && !without.has('avalanche') && withP.size === 11 && withP.has('deepFreeze') && withP.has('avalanche') && !withP.has('permafrost');
    fresh({ types: 'fire' });
    const fireSeen = new Set();
    stub(G().run.ui, 'choose', (title, sub, choices) => choices.forEach((c) => fireSeen.add(c.id)));
    for (let i = 0; i < 40; i++) G().run.pickUpgrade({ id: 2 }, () => {});
    const clean = [...fireSeen].every((id) => !ICE_POOL.includes(id));
    fresh();
    return ok(!wrong.length && pool.length === 12 && pool.every((u) => ICE_POOL.includes(u.id)) && gated && clean, { wrong, pool: pool.length, without: without.size, withP: withP.size, clean });
  },
});
