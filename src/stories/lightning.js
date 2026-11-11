// Stories: the Lightning jelly type (P8b, docs/jelly-types/types/lightning.md): its main attack, its look,
// its 12 Attack upgrades (content/upgrades.kdl) and the words they brought (nth-attack bolt, charged-shot,
// touch-zap, orb, zap target and look, and new props on element-up).
// Shared helpers are in ./kit.js; src/stories.js imports this file in order.
import { PLAYER } from '../events.js';
import { CONTENT, compileTreasures } from '../content.js';
import { parse } from '../kdl.js';
import { elementParams } from '../words.js';
import { G, asPlayer, V, dmgBy, fresh, holdJelly, ok, record, roachAt, setupFight, spy, step, story, stub } from './kit.js';

const POOL = ['overcharge', 'conductor', 'staticSkin', 'stormCell', 'thunderclap', 'ballLightning', 'chainReaction', 'lightningRod', 'overload', 'staticCharge', 'surge', 'grounded'];
// take these Attack upgrades (the combined effects are worked out again)
const take = (...ids) => { const { run } = G(); run.upgrades = ids; run._modsE = null; return run.mods; };
const mistake = (src) => { try { compileTreasures(parse(`treasure "x" name="X" icon="x" text="x" {\n${src}\n}`, 't.kdl'), 't.kdl'); return null; } catch (e) { return e.message; } };
// a shot at the nearest bug: the Lightning jelly's own (full Fire rate, hit= of Attack damage)
const shoot = () => {
  const { run, player } = G(), B = run.bubbles, origin = player.position.clone().add(V(0, 0.06, 0));
  B.hit = run.attack.hit;
  return B.elementVolley('lightning', B.mainParams('lightning', run.mods), origin, run.S, run.mods);
};
// let what's flying land (the shot's pop, its arcs, its strike)
const land = () => { const { run } = G(); for (let i = 0; i < 90 && run.bubbles.list.length; i++) { run.bubbles.fly(1 / 60, run.S, run.mods); run.bubbles.effects(1 / 60, run.S); } };
const lightning = (log) => dmgBy(log, 'lightning');

story('types/lightning-plays', {
  about: 'A Lightning jelly hurts a bug only with its Lightning shot (4.5 Attack damage x hit 1, 2.2 a second): no plain bubbles and no tentacle stings; each shot arcs to others for 41% and Stuns them; it wears the storm look; and the end-of-act pick offers only Lightning\'s own upgrades.',
  setup() { setupFight({ types: 'lightning' }); },
  play() {
    const { run } = G();
    roachAt(0, -0.15); roachAt(0.06, -0.22); roachAt(-0.05, -0.27);
    const log = record('damage_taken'), stuns = record('status_applied'), shots = spy(run.bubbles, 'elementVolley');
    step(60 * 8);
    const by = {};
    for (const d of log) if (d.targetId !== PLAYER) { const k = d.source === 'bubble' && d.feedback?.element ? d.feedback.element : d.source; (by[k] ||= []).push(d.amount); }
    const sources = Object.keys(by);
    const hits = log.filter((d) => d.source === 'bubble' && d.targetId !== PLAYER).map((d) => d.amount);
    const arcs = lightning(log);
    const only = sources.every((k) => ['lightning', 'splash'].includes(k)) && hits.length > 0 && hits.every((a) => Math.abs(a - 4.5) < 1e-9);
    const rate = shots.length >= 16 && shots.length <= 19;   // 2.2 a second for 8 s
    // each arc is 41% of the shot (4.5 x 4.5 x 0.09 / 4.5 = 4.5 x 0.405) and Stuns
    const arcOk = arcs.length > 0 && arcs.every((d) => Math.abs(d.amount - 4.5 * 4.5 * 0.09) < 1e-9) && stuns.some((s) => s.status === 'stun' && s.duration === 0.5);
    step(1);
    const look = run.typeAdorn.join() === 'storm' && run.adorn.pieces.storm?.group.visible;
    // the upgrade pick: three of Lightning's own, none of another type's
    const offered = [];
    stub(run.ui, 'choose', (title, sub, choices) => offered.push(choices.map((c) => c.id)));
    run.pickUpgrade({ id: 1 }, () => {});
    const own = offered[0]?.length === 3 && offered[0].every((id) => POOL.includes(id));
    return ok(only && rate && arcOk && look && own, { sources, hits: hits.length, shots: shots.length, arcs: arcs.length, look, offered });
  },
});

story('types/lightning-look-comes-and-goes', {
  about: 'The Lightning jelly\'s storm look is a core and glowing tips on its jelly, a small arc that jumps between two tips every few seconds (a bar of segments that shows for a moment), and static flecks that blink; a Normal jelly has none of it.',
  setup() { setupFight({ types: 'lightning', bubbles: false, lash: false }); },
  play() {
    const { run } = G();
    const seen = { arc: false, fleck: false };
    for (let i = 0; i < 60 * 8; i++) {
      step(1);
      const P = run.adorn.pieces.storm;
      if (!P) continue;
      const kids = P.group.children;   // core, 8 tips, 6 arc segments, then the flecks
      if (kids.slice(9, 15).some((m) => m.visible)) seen.arc = true;
      if (kids.slice(15).some((m) => m.visible)) seen.fleck = true;
    }
    const P = run.adorn.pieces.storm, core = P.group.children[0], tips = P.group.children.slice(1, 9).filter((m) => m.visible).length;
    const worn = P.group.visible && core.visible && tips >= 3;
    fresh({ types: 'normal' }); step(2);
    const none = !run.adorn.pieces.storm?.group.visible;
    return ok(worn && seen.arc && seen.fleck && none, { worn, tips, seen, none });
  },
});

// ------------------------------------------------------------------ the words
story('treasures/bolt', {
  about: 'nth-attack 5 { bolt }: every 5th lightning shot is a big bolt (bigger, its arcs 2x as hard and 2x as far) and the others are ordinary; it does nothing for a bubble; dmg=, reach= and size= must be above 0.',
  setup() { setupFight({ types: 'lightning', bubbles: false, lash: false }); },
  play() {
    const { run } = G(), B = run.bubbles;
    roachAt(0, -0.15);
    take('overcharge');
    const blows = spy(B, 'blow');
    for (let i = 0; i < 10; i++) shoot();
    const ofShot = (i) => blows[i][2];
    const bigOnes = blows.map((_, i) => i).filter((i) => ofShot(i).big);
    const P = elementParams('lightning'), big = ofShot(4), plain = ofShot(3);
    const works = bigOnes.join() === '4,9' && Math.abs(big.ep.bolt - P.bolt * 2) < 1e-9 && Math.abs(big.ep.chainRange - P.chainRange * 2) < 1e-9 && big.size > plain.size && plain.ep.bolt === P.bolt;
    const bubbleIgnores = B.nth(run.mods, 5) === null && B.nth(run.mods, 5, 'bolt') !== null;
    const bad = mistake('nth-attack 5 {\n bolt dmg=0\n}');
    return ok(works && bubbleIgnores && /bolt: dmg, reach and size must be above 0/.test(bad), { bigOnes, works, bubbleIgnores, bad });
  },
});

story('treasures/touch-zap', {
  about: 'touch-zap (Static Skin): a bug touching you is zapped and Stunned for 1 s, once every 2 s per bug (a second bug has its own timer); a bug that isn\'t touching is left alone; stun= and each= must be above 0.',
  setup() { setupFight({ types: 'lightning', bubbles: false, lash: false }); },
  play() {
    const { run, enemies } = G();
    const none = (() => { roachAt(0.02, 0); const log = record('damage_taken'); step(30); const n = dmgBy(log, 'touch').length; enemies.clear(); return n; })();
    take('staticSkin');
    const far = roachAt(0.4, 0.4), a = roachAt(0.02, 0), log = record('damage_taken');
    step(12);
    const first = dmgBy(log, 'touch').filter((d) => d.targetId === a.id);
    const stunned = a.stunT > 0.5;
    step(60);   // 1.2 s in: still cooling down
    const cooling = dmgBy(log, 'touch').filter((d) => d.targetId === a.id).length === 1;
    const b = roachAt(0, 0.02);
    step(12);
    const own = dmgBy(log, 'touch').filter((d) => d.targetId === b.id).length === 1;
    step(60 * 1.2);   // 2.4 s in: the first bug's timer is up
    const again = dmgBy(log, 'touch').filter((d) => d.targetId === a.id).length === 2;
    const left = dmgBy(log, 'touch').every((d) => d.targetId !== far.id) && !(far.stunT > 0);
    const hurt = first.length === 1 && Math.abs(first[0].amount - run.power * 0.6) < 1e-9;
    const bad = mistake('touch-zap stun=0');
    return ok(none === 0 && hurt && stunned && cooling && own && again && left && /touch-zap: stun and each must be above 0/.test(bad), { none, hurt, stunned, cooling, own, again, left, bad });
  },
});

story('treasures/charged-shot', {
  about: 'charged-shot "rooted" 2 strike=0.2 (Storm Cell): standing still 2 s charges the next lightning shot, which also strikes every bug within 20 cm of where it lands for 2x its damage, then starts again from none; moving breaks the charge. "moving" 3 chain=3 (Static Charge) arcs the shot to 3 more bugs after 3 s at full speed. A charge needs strike= or chain=.',
  setup() { setupFight({ types: 'lightning' }); },
  play() {
    const { run, player } = G(), B = run.bubbles;
    take('stormCell');
    step(60 * 1.5);
    const early = !B.charge;
    step(60 * 0.7);
    const ready = !!B.charge && B.charge.strike === 0.2 && B.charge.keys.length === 1;
    // a target, and a bug 18.5 cm (to its body) from it: beyond the arc's 16 cm reach, inside the strike's 20
    const t = roachAt(0, -0.15), far = roachAt(0.185 + CONTENT.enemies.roach.r, -0.15), log = record('damage_taken');
    step(60 * 0.8, () => !B.charge);
    const spent = !B.charge && run.chargeT[run.mods.charged[0].key] < 0.5;
    step(36);   // the shot lands
    const struck = lightning(log).filter((d) => d.targetId === far.id);
    const strike = struck.length >= 1 && Math.abs(struck[0].amount - 4.5 * 2) < 1e-9;
    step(24);
    const resting = !B.charge;   // 1 s since it was spent: not yet
    // moving: it builds only while swimming at full speed
    setupFight({ types: 'lightning', bubbles: false });
    const jelly = holdJelly(); jelly.fullSpeed = true;
    take('staticCharge');
    step(60 * 2.5);
    const notYet = !G().run.bubbles.charge;
    step(60 * 0.7);
    const R = G().run, B2 = R.bubbles, moved = !!B2.charge && B2.charge.chain === 3 && B2.charge.strike === 0;
    jelly.fullSpeed = false; step(2);
    const broken = !B2.charge;
    // the 3 extra arcs: a line of bugs 10 cm apart, a charged shot jumps 6 times, an ordinary one 3
    for (let k = 0; k < 7; k++) roachAt(0, -0.15 - 0.1 * k);
    const jumps = spy(B2, 'zap');
    B2.charge = { chain: 3, strike: 0, dmg: 1, keys: [] };
    shoot(); land();
    const charged = jumps.length;
    jumps.length = 0;
    shoot(); land();
    const plain = jumps.length;
    const bad = mistake('charged-shot "rooted" 2') || '';
    return ok(early && ready && spent && strike && resting && notYet && moved && broken && charged === 6 && plain === 3 && /needs strike= or chain=/.test(bad), { early, ready, spent, struck: struck.map((d) => d.amount), strike, resting, notYet, moved, broken, charged, plain, bad });
  },
});

story('treasures/orb', {
  about: 'every 6 { orb } (Ball Lightning): a slow ball drifts out toward the nearest bug and zaps every bug it passes once, 1.5x your power each, then fades after its time; a bug off its path is left alone; the ball is gone after a reset.',
  setup() { setupFight({ types: 'lightning', bubbles: false, lash: false }); },
  play() {
    const { run, enemies } = G(), gad = run.gadgets, fx = run.fx;
    take('ballLightning');
    const a = roachAt(0, -0.25), off = roachAt(0.4, 0.3), log = record('damage_taken');
    step(60 * 3.7);   // the first one goes out after 3.6 s
    const out = gad.orbs.length === 1 && fx.orbs.some((o) => o.alive);
    const start = gad.orbs[0].m.position.clone();
    step(60 * 3.5);
    const hits = lightning(log);
    const once = hits.length === 1 && hits[0].targetId === a.id && Math.abs(hits[0].amount - run.power * 1.5) < 1e-9;
    const moved = gad.orbs[0] ? gad.orbs[0].m.position.distanceTo(start) > 0.1 : true;
    const left = !hits.some((d) => d.targetId === off.id);
    step(60 * 1.6);   // its 5 s are up (the next goes out at 9.6 s)
    const gone = gad.orbs.length === 0 && fx.orbs.every((o) => !o.alive);
    const bad = mistake('every 6 {\n orb speed=0\n}');
    gad.orbs.push({ m: fx.orb('#fff', 0.005), dir: V(0, 0, 1), t: 9, speed: 0.1, radius: 0.02, dmg: 1, hit: new Set() });
    gad.reset();
    const cleared = gad.orbs.length === 0;
    return ok(out && once && moved && left && gone && cleared && /orb: speed, life and radius must be above 0/.test(bad), { out, once, hits: hits.length, moved, left, gone, cleared, bad });
  },
});

story('treasures/zap-toughest', {
  about: 'zap 1 target="toughest" look="bolt" (Overload): the timed zap picks the bug with the most Health left (an Elite or the boss counts as the most) instead of the nearest, and as a bolt it counts as a lightning arc; plain zap still takes the nearest; target= and look= must be known.',
  setup() { setupFight({ types: 'lightning', bubbles: false, lash: false }); },
  play() {
    const { run } = G();
    take('overload');
    const nearBug = roachAt(0, -0.1, { still: true, hp: 40 }), tough = roachAt(0.25, 0.0, { still: true, hp: 400 }), log = record('damage_taken');
    step(60 * 6.2);   // the first one goes off after 6 s
    const hit = lightning(log);
    const toughest = hit.length === 1 && hit[0].targetId === tough.id && Math.abs(hit[0].amount - run.power * 5) < 1e-9;
    // an ordinary zap still takes the nearest, and is not a lightning arc
    const gad = run.gadgets, plain = record('damage_taken');
    gad.fire({ kind: 'zap', count: 1, range: 0.45, dmg: 2, target: 'nearest', look: 'signal' }, { center: run.player.position.clone().add(V(0, 0.04, 0)), power: run.power, pulse() {} });
    const nearest = dmgBy(plain, 'zap').length === 1 && dmgBy(plain, 'zap')[0].targetId === nearBug.id;
    const bad = [mistake('every 10 {\n zap 1 target="weakest"\n}'), mistake('every 10 {\n zap 1 look="beam"\n}')];
    return ok(toughest && nearest && /target must be nearest or toughest/.test(bad[0]) && /look must be signal or bolt/.test(bad[1]), { toughest, hits: hit.length, nearest, bad });
  },
});

story('treasures/lightning-arcs', {
  about: 'element-up "lightning" revisit=1 chain=3 (Conductor): arcs jump back to bugs already hit, 6 jumps in all; stunFirst=1 (Lightning Rod): the arc goes to a Stunned bug before a nearer one; eliteBolt=2 (Grounded): an Elite or the boss takes arcs twice as hard.',
  setup() { setupFight({ types: 'lightning', bubbles: false, lash: false }); },
  play() {
    const { run, enemies } = G(), B = run.bubbles;
    const arcsOn = () => { const log = record('damage_taken'); shoot(); land(); return log; };
    // two bugs 10 cm apart: without revisit the arc visits the second once; with it, back and forth 6 times
    const a = roachAt(0, -0.15), b = roachAt(0.1, -0.15);
    take(); const base = arcsOn();
    const baseArcs = [lightning(base).filter((d) => d.targetId === a.id).length, lightning(base).filter((d) => d.targetId === b.id).length];
    take('conductor'); const back = arcsOn();
    const backArcs = [lightning(back).filter((d) => d.targetId === a.id).length, lightning(back).filter((d) => d.targetId === b.id).length];
    const revisit = baseArcs.join() === '0,1' && backArcs.join() === '3,3';
    // a nearer bug and a farther Stunned one: the Rod's arc takes the Stunned one first, and hits it 30% harder
    enemies.clear(); take();
    const t = roachAt(0, -0.15), near = roachAt(0.06, -0.15), stunned = roachAt(0.12, -0.15); stunned.stunT = 9;
    const order = (log) => lightning(log).map((d) => d.targetId);
    enemies.mods = run.mods;
    const plain = arcsOn();
    const plainFirst = order(plain)[0] === near.id;
    stunned.stunT = 9; near.stunT = 0; take('lightningRod'); enemies.mods = run.mods;
    const hp0 = [stunned.hp, near.hp];
    const rod = arcsOn(), rodFirst = order(rod)[0] === stunned.id;
    enemies.mods = run.mods;   // (the hits are weighed where they land: this is the Health each lost)
    const harder = Math.abs((hp0[0] - stunned.hp) / (hp0[1] - near.hp) - 1.3) < 1e-9;
    // an Elite (or the boss) among them: Grounded doubles the arcs on it
    const eliteArc = (ids) => {
      enemies.clear(); take(...ids);
      const got = [], t2 = roachAt(0, -0.15);
      enemies.addProxy({ position: V(t2.pos.x + 0.12, t2.pos.y, t2.pos.z), r: 0.03, damage: (amount) => got.push(amount) });
      arcsOn();
      return got[0];
    };
    const plainElite = eliteArc([]), grounded = eliteArc(['grounded']);
    const double = plainElite > 0 && Math.abs(grounded / plainElite - 2) < 1e-9;
    return ok(revisit && plainFirst && rodFirst && harder && double, { baseArcs, backArcs, plainFirst, rodFirst, harder, plainElite, grounded });
  },
});

// ------------------------------------------------------------------ the pool
story('upgrades/lightning-pool', {
  about: 'Each of Lightning\'s 12 Attack upgrades, taken in a Lightning run, sets what its text says (Overcharge\'s big bolt every 5th, Conductor\'s 6 jumps, Ball Lightning every 6 s, …), and nothing before it is taken; Thunderclap and Lightning Rod make Stunned bugs take 50% and 30% more, a Stunned bug dying sends bolts to 2 more (Chain Reaction), and each arc gives +2% Fire rate (Surge).',
  setup() { setupFight({ types: 'lightning', bubbles: false, lash: false }); },
  play() {
    const { run, enemies } = G();
    const SAYS = {
      overcharge: (m) => m.nth.some((N) => N.every === 5 && N.effects[0].kind === 'bolt'),
      conductor: (m) => m.element.lightning?.revisit === 1 && m.element.lightning.chain === 6,
      staticSkin: (m) => m.touchZap?.stun === 1 && m.touchZap.each === 2,
      stormCell: (m) => m.charged.some((C) => C.when === 'rooted' && C.time === 2 && C.strike === 0.2),
      thunderclap: (m) => m.statusDamage.some((D) => D.status === 'stunned' && D.more === 0.5 && D.by === 'all'),
      ballLightning: (m) => m.timed.some((T) => T.every === 6 && T.effects[0].kind === 'orb'),
      chainReaction: (m) => m.killsOf.some((K) => K.status === 'stunned' && K.effects[0].kind === 'zap' && K.effects[0].count === 2),
      lightningRod: (m) => m.element.lightning?.stunFirst === 1 && m.statusDamage.some((D) => D.status === 'stunned' && D.more === 0.3 && D.by === 'lightning'),
      overload: (m) => m.timed.some((T) => T.every === 10 && T.effects[0].kind === 'zap' && T.effects[0].target === 'toughest' && T.effects[0].dmg === 5),
      staticCharge: (m) => m.charged.some((C) => C.when === 'moving' && C.time === 3 && C.chain === 3),
      surge: (m) => m.buffs.some((b) => b.event === 'arc' && b.stat === 'fireRate' && b.amount === 2 && b.stacks === 10),
      grounded: (m) => m.element.lightning?.eliteBolt === 2,
    };
    const mine = CONTENT.upgrades.filter((u) => u.jelly === 'lightning').map((u) => u.id), wrong = [];
    for (const id of POOL) {
      take(); let before; try { before = SAYS[id](run.mods); } catch { before = false; }
      take(id);
      if (before || !SAYS[id](run.mods)) wrong.push(id);
    }
    const sameList = mine.length === 12 && POOL.every((id) => mine.includes(id));
    // Thunderclap + Lightning Rod on a Stunned bug: 1 + 0.5 + 0.3 from a lightning hit; 1.5 from anything else
    const e = roachAt(0, -0.15), more = (by) => { enemies.mods = run.mods; return enemies.statusMore(e, by); };
    take('thunderclap'); e.stunT = 0; const calm = more('lightning'); e.stunT = 5;
    const clap = [calm, more('lightning'), more('bubble')];
    take('thunderclap', 'lightningRod');
    const both = more('lightning'), other = more('bubble');
    const stack = clap[0] === 1 && clap[1] === 1.5 && clap[2] === 1.5 && Math.abs(both - 1.8) < 1e-9 && Math.abs(other - 1.5) < 1e-9;
    // Chain Reaction: a Stunned bug that dies sends bolts to the 2 nearest; one that wasn't Stunned sends none
    enemies.clear(); take('chainReaction'); enemies.mods = run.mods;
    const dead = roachAt(0, -0.15), n1 = roachAt(0.07, -0.15), n2 = roachAt(-0.07, -0.15), n3 = roachAt(0.3, -0.3), log = record('damage_taken');
    dead.stunT = 5; enemies.kill(dead); step(2);
    const bolted = lightning(log).map((d) => d.targetId);
    const reaction = bolted.length === 2 && bolted.includes(n1.id) && bolted.includes(n2.id) && !bolted.includes(n3.id);
    log.length = 0;
    const calmDead = roachAt(0.2, 0.2); enemies.kill(calmDead); step(2);
    const silent = lightning(log).length === 0;
    // Surge: each arc gives +2% Fire rate
    take('surge'); run.buffs = {};
    const base = run.S.fireRate;
    for (let i = 0; i < 3; i++) run.buff('arc');
    const surged = Math.abs(run.S.fireRate - base - 3 * 0.02 * run.baseStats.fireRate) < 1e-9;
    return ok(!wrong.length && sameList && stack && reaction && silent && surged, { sameList, stack, reaction, wrong, mine: mine.length, clap, both, other, bolted: bolted.length, silent, base, surged: run.S.fireRate });
  },
});

// ------------------------------------------------------------------ the pick screen's centre card

story('types/pick-screen-lightning-card', {
  about: 'On the pick screen the Lightning card\'s jelly fires its real Lightning shots at three roaches, which arc to each other, are Stunned and die; its portrait wears the storm look (adornments.js); nothing reaches the game.',
  setup() {},
  play() {
    const { GAME, mainMenu, picker } = G(), live = picker.live, back = asPlayer(true);
    try {
      fresh({ types: 'lightning' });
      const hurt = record('damage_taken');
      mainMenu.home = true; picker.close(); GAME.startRun();
      stub(live, 'draw', () => {});
      stub(live.renderer, 'compileAsync', () => Promise.resolve());
      stub(picker, 'portrait', () => '');
      picker.tick(picker.last + 16);
      let shots = 0, kills = 0, dead = 0, list = live.P.enemies.list, arcs = 0;
      const zap = live.P.bubbles.zap.bind(live.P.bubbles);
      live.P.bubbles.zap = (...a) => { arcs++; return zap(...a); };
      for (let i = 0; i < 10 * 30; i++) {
        live.simulate(1 / 30);
        const now = live.P.enemies.list, n = now.filter((b) => b.dead).length;
        if (now !== list) { kills += 3 - dead; list = now; dead = 0; } else { kills += n - dead; dead = n; }
        shots = Math.max(shots, live.P.bubbles.list.filter((b) => b.tint === 'lightning').length);
      }
      const look = picker.liveFor === 'lightning' && live.P.worn.pieces.storm?.group.visible;
      const quiet = hurt.filter((d) => d.targetId !== PLAYER).length === 0;
      return ok(look && shots >= 1 && arcs >= 1 && kills >= 3 && quiet, { liveFor: picker.liveFor, look, shots, arcs, kills, quiet });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});
