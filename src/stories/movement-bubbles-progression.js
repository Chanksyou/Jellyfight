// Stories: movement, the bubble stream, progression. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { bus, PLAYER } from '../events.js';
import { CONTENT } from '../content.js';
import { knockFor, rollCards, rollTreasures, TREASURE_RARITY, ELEMENT_UPGRADES, xpToNext, cardText } from '../stats.js';
import { sfx } from '../sfx.js';
import { ELEMENTS_IDS, G, V, fresh, give, holdJelly, near, ok, record, restore, spawn, startVacuum, step, story, stub, tp } from './kit.js';

// --- movement
story('movement/jelly-steady-speed', {
  about: 'The jelly swims at a steady 0.42 m/s: the bell pulses, the speed does not.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.7, 0); },
  play() {
    const { player, input } = G();
    input.keys = new Set(['KeyW']);
    step(30);
    const s = [];
    for (let i = 0; i < 60; i++) { const p0 = player.position.clone(); G().GAME.step(1 / 60); s.push(Math.hypot(player.position.x - p0.x, player.position.z - p0.z) * 60); }
    input.keys = new Set();
    const min = Math.min(...s), max = Math.max(...s);
    return ok(Math.abs(min - 0.42) < 0.01 && Math.abs(max - 0.42) < 0.01, { min: +min.toFixed(3), max: +max.toFixed(3) });
  },
});
story('movement/roach-slower-than-jelly', {
  about: 'A cockroach chases at 0.35 m/s, slower than the jelly, so one can always be outswum.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 4.0, 0); spawn('roach', V(3.2, 0, 2.3)); },
  play() {
    const e = G().enemies.list[0];
    step(40); const a = e.pos.clone(); step(60);
    const v = e.pos.distanceTo(a);
    return ok(Math.abs(v - 0.35) < 0.02 && v < CONFIG.player.walkSpeed, { roach: +v.toFixed(3), jelly: CONFIG.player.walkSpeed });
  },
});

// --- the bubble stream
story('movement/hit-pushes-the-jelly-back', {
  about: 'A hit shoves the jelly away from what hit it, harder the more it hurt (CONFIG.player.hitPush): a 6-damage hit pushes further than a 1-damage one. An attack that sends its own knockback (before or after its damage), or says knock: true (a boss already pushing you), adds no second shove.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('roach', near(0.15, 0), { still: true, hp: 9999 }); },
  play() {
    const { run, player, enemies } = G(), e = enemies.list[0], P = player.position;
    const hitBy = (amount, extra = {}, before, after) => {
      tp(3.2, 0.05, 3.0, 0); step(20); run.iFrames = 0; run.health = 99;
      const shoves = record('knockback'), x0 = P.x;
      before?.(); bus.emit('damage_taken', { targetId: PLAYER, amount, source: 'story', from: e.id, ...extra }); after?.();
      step(30);
      return { shoves: shoves.filter((k) => k.targetId === PLAYER).map((k) => +k.force.toFixed(3)), dirX: +(shoves.find((k) => k.targetId === PLAYER)?.dir.x ?? 0).toFixed(2), moved: +(x0 - P.x).toFixed(4) };
    };
    const own = () => bus.emit('knockback', { targetId: PLAYER, dir: V(0, 0, 1), force: 0.3 });
    const small = hitBy(1), big = hitBy(6), ownAfter = hitBy(6, {}, null, own), ownBefore = hitBy(6, {}, own), boss = hitBy(6, { knock: true });
    return ok(small.shoves.length === 1 && big.shoves.length === 1 && big.shoves[0] > small.shoves[0] && big.dirX < -0.9 && big.moved > small.moved && big.moved > 0.015
      && ownAfter.shoves.length === 1 && ownAfter.shoves[0] === 0.3 && ownBefore.shoves.length === 1 && ownBefore.shoves[0] === 0.3 && boss.shoves.length === 0,
      { small, big, ownAfter, ownBefore, boss });
  },
});
story('attack/bubble-stream', {
  about: 'With one bubble, bubbles come out one at a time (never two in a frame), about 1.76 a second to start.',
  setup() { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const P = G().player.position; spawn('roach', P.clone().add(V(0, 0, -0.2)), { still: true, hp: 9999 }); },
  play() {
    const { run, enemies } = G();
    const e = enemies.list[0], home = e.pos.clone(), born = [];
    let f = 0;
    const blow = run.bubbles.blow.bind(run.bubbles);
    stub(run.bubbles, 'blow', (...a) => { born.push(f); return blow(...a); });
    for (f = 0; f < 600; f++) { G().GAME.step(1 / 60); e.pos.copy(home); }
    const perSec = born.length / 10, sameFrame = born.filter((x, i) => i && born[i - 1] === x).length;
    const dps = (9999 - e.hp) / 10;
    return ok(Math.abs(perSec - 1.76) < 0.25 && sameFrame === 0 && dps > 8, { perSec, sameFrame, dps: +dps.toFixed(1) });
  },
});

story('attack/bubble-feel', {
  about: 'The ordinary bubble completes the Attack Feel chain (docs/agents/attack-feel.md): the bell squeeze, blow and flight whoosh on the frame it leaves; a flash at the contact; the roach flashes white and is shoved by knockFor(damage); a wet splat stays on the floor about 2 s and then goes.',
  setup() { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('roach', G().player.position.clone().add(V(0, 0, -0.2)), { still: true, hp: 9999 }); },
  play() {
    const { run, enemies, fx } = G(), B = run.bubbles, e = enemies.list[0];
    let f = 0;
    const at = { blow: [], whiz: [], born: [], impact: [], splat: [] }, spy = (o, k, log) => { const fn = o[k].bind(o); stub(o, k, (...a) => { log.push(f); return fn(...a); }); };
    spy(sfx, 'blow', at.blow); spy(sfx, 'whiz', at.whiz); spy(B, 'blow', at.born); spy(fx, 'impact', at.impact); spy(fx, 'splat', at.splat);
    const shoves = record('knockback'), hits = record('damage_taken');
    let flashed = false;
    for (f = 0; f < 120 && !at.splat.length; f++) { G().GAME.step(1 / 60); flashed ||= e.flashT > 0; }
    step(2); flashed ||= e.flashT > 0;
    const hit = hits.find((h) => h.source === 'bubble'), shove = shoves.find((k) => k.targetId === e.id);
    const splatsAt = (t) => { step(Math.round(t * 60)); return fx.splats.filter((x) => x.alive).length; };
    const after1 = splatsAt(1);
    stub(B, 'volley', () => false);   // no more bubbles: the last splats go 2 s after the last pop
    const after2 = splatsAt(2.4);
    // more damage, bigger shove (stopping at 3 cm)
    const force = (dmg) => { const log = record('knockback'); B.strike({ dmg, vel: V(0, 0, -1), elems: new Set(), hit: new Set() }, e, run.mods); return log.at(-1)?.force; };
    const ladder = [6, 24, 100].map(force);
    const sameFrame = at.blow[0] === at.born[0] && at.whiz[0] === at.born[0];
    return ok(sameFrame && at.impact.length > 0 && at.impact[0] === at.splat[0] && flashed && hit && Math.abs(shove.force - knockFor(hit.amount)) < 1e-9
      && after1 >= 1 && after2 === 0 && ladder[0] < ladder[1] && ladder[1] < ladder[2] && ladder[2] === 0.03,
      { at: Object.fromEntries(Object.entries(at).map(([k, v]) => [k, v[0]])), flashed, dmg: hit?.amount, force: shove?.force, after1, after2, ladder });
  },
});
story('attack/sting-feel', {
  about: 'The tentacle sting completes its Attack Feel chain (7/7, docs/agents/attack-feel.md): the bell twitches on the frame the tentacles whip out; where one lands, a flash; the bug flashes white and is shoved by knockFor(damage), so a 4-damage sting shoves 4 mm.',
  setup() { fresh({ elites: false, bubbles: false }); tp(3.2, 0.05, 3.0, 0); spawn('roach', G().player.position.clone().add(V(0, 0, -0.07)), { still: true, hp: 9999 }); },
  play() {
    const { run, enemies, fx, player } = G(), L = run.lash, e = enemies.list[0];
    let f = 0;
    const at = { pulse: [], strike: [], impact: [] }, spy = (o, k, log) => { const fn = o[k].bind(o); stub(o, k, (...a) => { log.push(f); return fn(...a); }); };
    spy(player.avatar, 'pulse', at.pulse); spy(L, 'strike', at.strike); spy(fx, 'impact', at.impact);
    const shoves = record('knockback'), hits = record('damage_taken');
    let flashed = false;
    for (f = 0; f < 180 && !at.impact.length; f++) { G().GAME.step(1 / 60); flashed ||= e.flashT > 0; }
    step(2); flashed ||= e.flashT > 0;
    const hit = hits.find((h) => h.source === 'tentacle'), shove = shoves.find((k) => k.targetId === e.id);
    return ok(at.strike.length && at.pulse[0] === at.strike[0] && at.impact.length && flashed && hit && shove && Math.abs(shove.force - knockFor(hit.amount)) < 1e-9,
      { at: Object.fromEntries(Object.entries(at).map(([k, v]) => [k, v[0]])), flashed, dmg: hit?.amount, force: shove?.force });
  },
});
story('attack/armor-is-a-last-resort', {
  about: 'Bubbles and tentacles both aim past an armoured bug (a curled millipede: hits do 75% less) at an unarmoured one farther off, and only fall back to the armoured one when nothing else is in range.',
  setup() { fresh({ hurt: true, elites: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('millipede', near(0, -0.25)); e.ballCd = 0.3; },
  play() {
    const { run, enemies, player } = G(), mill = enemies.list[0];   // the millipede from setup (fresh leaves it alone in the list)
    const roach = spawn('roach', player.position.clone().add(V(0.1, 0, -0.55)), { still: true, hp: 9999 });
    step(60 * 3, () => mill.armor > 0);   // curled up and revving: armoured, and still where it curled
    const c = new THREE.Vector3(), P = player.position;
    const dMill = enemies.center(mill, c).distanceTo(P), dRoach = enemies.center(roach, c).distanceTo(P);
    const first = { bubbles: run.bubbles.inRange(P, 0.6)[0], lash: run.lash.inReach(P, 0.6)[0] };
    enemies.applyDamage(roach, 1e5);
    const fallback = { bubbles: run.bubbles.inRange(P, 0.6)[0], lash: run.lash.inReach(P, 0.6)[0] };
    const pass = mill.armor > 0 && dMill < dRoach && first.bubbles === roach && first.lash === roach && fallback.bubbles === mill && fallback.lash === mill;
    return ok(pass, { armor: mill.armor, dMill: +dMill.toFixed(2), dRoach: +dRoach.toFixed(2), firstIsRoach: first.bubbles === roach && first.lash === roach, fallbackIsMill: fallback.bubbles === mill && fallback.lash === mill });
  },
});
story('attack/lash-skips-a-shielded-boss', {
  about: "While the Vacuum's guards are up it can't be hurt, and the tentacles know it: they leave its shielded proxies alone and strike a bug in reach instead.",
  setup() { startVacuum('flies'); },
  play() {
    const { run, enemies } = G(), B = run.boss, player = holdJelly();
    B.stateT = B.prevT = 1.05;   // startVacuum's timer table has no 'flies': give it a windup so the launch (stateT crossing 0.4) can fire
    const roach = spawn('roach', player.position.clone().add(V(0.1, 0, -0.3)), { still: true, hp: 9999 });
    step(90, () => B.guards.length > 0);
    const c = new THREE.Vector3();
    const guardNear = enemies.list.some((e) => e.proxy === B && enemies.center(e, c).distanceTo(player.position) < 2);
    const reach = run.lash.inReach(player.position, 2);
    const pass = B.shielded && guardNear && reach.includes(roach) && !reach.some((e) => e.proxy === B);
    return ok(pass, { guards: B.guards.length, shielded: B.shielded, guardNear, reached: reach.map((e) => e.kind || 'boss') });
  },
});

story('attack/side-by-side-bubbles', {
  about: 'With 3 bubbles, each blow is 3 bubbles leaving at the same moment side by side, flying parallel, each doing 56% damage (25% less per extra bubble).',
  setup() { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const P = G().player.position; spawn('roach', P.clone().add(V(0, 0, -0.25)), { still: true, hp: 9999 }); G().run.stats.bubbles = 3; },
  play() {
    const { run } = G();
    const born = [];
    let f = 0;
    const blow = run.bubbles.blow.bind(run.bubbles);
    stub(run.bubbles, 'blow', (...a) => { const b = blow(...a); born.push({ f, b }); return b; });
    for (f = 0; f < 120 && born.length < 3; f++) G().GAME.step(1 / 60);
    const first = born.slice(0, 3), b = first.map((x) => x.b);
    step(4);
    const sameFrame = first.every((x) => x.f === first[0].f);
    const dirs = b.map((x) => x.vel.clone().setY(0).normalize());
    const parallel = dirs.every((d) => d.dot(dirs[0]) > 0.995);
    const gaps = [b[0].m.position.distanceTo(b[1].m.position), b[1].m.position.distanceTo(b[2].m.position)];
    const dmg = b[0].dmg / run.S.bubbleDamage;
    return ok(first.length === 3 && sameFrame && parallel && gaps.every((g) => g > 0.01) && Math.abs(dmg - 0.75 ** 2) < 1e-6,
      { n: first.length, sameFrame, parallel, gaps: gaps.map((g) => +g.toFixed(3)), dmg: +dmg.toFixed(3) });
  },
});

story('attack/element-projectiles', {
  about: 'Each element is an attack of its own: it fires its own projectile (a fireball, ball lightning, an ice shard, an acid glob, a wind gust, a glitter bomb) on its own timer, while the bubbles stay plain bubbles; the lightning one crackles with arcs.',
  setup() { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const P = G().player.position; spawn('roach', P.clone().add(V(0, 0, -0.25)), { still: true, hp: 1e6 }); },
  play() {
    const { run } = G();
    const seen = {};
    let arcs = 0, plainOnly = true;
    for (const [id, el] of [['candle', 'fire'], ['battery', 'lightning'], ['freezerPack', 'ice'], ['nailPolish', 'acid'], ['paperFan', 'wind'], ['glitter', 'glitter']]) {
      run.owned = new (run.owned.constructor)(); run.owned.add(id);
      run.bubbles.reset(); run.bubbles.timer = 1; run.bubbles.elTimers[el] = 1;
      step(el === 'wind' ? 20 : 6);   // wind now gathers for 0.28 s before release
      const looks = run.bubbles.list.map((b) => b.m.userData.look || null);
      seen[el] = looks.find(Boolean) || null;
      if (!looks.includes(null)) plainOnly = false;            // a plain bubble flew alongside it
      if (el === 'lightning') arcs = run.bubbles.looks.arcN;
    }
    const all = Object.entries(seen).every(([el, look]) => el === look);
    return ok(all && plainOnly && arcs > 0, { seen, plainOnly, arcs });
  },
});
story('treasures/element-rewards', {
  about: 'Base elements are Legendary and never come from treasure chests: the start of a run offers 3 Legendary elements you don\'t have (and only elements). Element upgrades never turn up in an ordinary pick: owning fire, chests 1, 2, 4 and 5 offer none and chests 3 and 6 offer exactly one (a fire one); with no element, the 3rd chest is three ordinary treasures.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { run, menus } = G();
    const isUp = (t) => ELEMENT_UPGRADES.includes(t.id);
    let starts = 0, sample = null;
    stub(menus, 'choose', (title, sub, list) => {
      if (list.length === 3 && list.every((t) => ELEMENTS_IDS.includes(t.id) && !run.owned.has(t.id) && t.tier?.name === 'Legendary')) starts++;
      sample = list.map((t) => t.id);
    });
    for (let i = 0; i < 60; i++) run.pickElement('start', '');
    // a run with fire: count upgrades per chest, over many runs' first six chests
    let wrong = [], baseEl = 0;
    let ups = [];
    stub(menus, 'choose', (title, sub, list) => { ups.push(list.filter(isUp)); if (list.some((t) => ELEMENTS_IDS.includes(t.id))) baseEl++; });
    for (let r = 0; r < 40; r++) {
      run.owned.clear(); run.owned.add('candle'); run.chestsOpened = 0; ups = [];
      for (let c = 0; c < 6; c++) run.pickTreasure('', '', c % 2 ? 'elite' : 'room');
      ups.forEach((u, i) => {
        const want = (i + 1) % 3 === 0 ? 1 : 0;
        if (u.length !== want || u.some((t) => t.needs !== 'candle')) wrong.push(`chest ${i + 1}: ${u.map((t) => t.id)}`);
      });
    }
    // no element: the 3rd chest is three ordinary treasures
    run.owned.clear(); run.chestsOpened = 2; ups = [];
    let third = null;
    stub(menus, 'choose', (title, sub, list) => { third = list; });
    run.pickTreasure('', '', 'room');
    restore();
    const plainThird = third?.length === 3 && !third.some(isUp);
    return ok(starts === 60 && !wrong.length && !baseEl && plainThird, { starts, wrong: wrong.slice(0, 5), baseEl, plainThird, sample });
  },
});
story('enemies/ant-pin-colours', {
  about: 'Each ant spawns with one of the five thumbtack colours (--pin-colors), and the pin it throws is that colour too.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { enemies } = G(), seen = new Set();
    for (let i = 0; i < 40; i++) seen.add(spawn('ants', near(0.5 + (i % 8) * 0.06, 0.3 + Math.floor(i / 8) * 0.06), { still: true }).mesh.userData.pin);
    const e = enemies.list[0];
    enemies.spit(e, near(0, 0, 0.05), { speed: 0.8, life: 1, dmg: 2, shot: 'pin', height: -0.4 });
    const thrown = enemies.shots.at(-1).m.geometry, held = e.root.getObjectsByProperty('geometry', thrown).length > 0;
    return ok(seen.size === 5 && held, { colours: [...seen].sort(), held });
  },
});
story('enemies/ant-and-roach-same-size', {
  about: 'An ant and a cockroach are the same length nose to tail (within 5 mm), so neither reads as the bigger bug.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('roach', near(0.5, 0), { still: true }); spawn('ants', near(-0.5, 0), { still: true }); },
  play() {
    step(90);                                            // grown in
    const len = {};
    for (const e of G().enemies.list) {
      const q = e.root.quaternion.clone();
      e.root.quaternion.identity(); e.root.updateMatrixWorld(true);
      len[e.type] = +new THREE.Box3().setFromObject(e.mesh).getSize(new THREE.Vector3()).z.toFixed(3);
      e.root.quaternion.copy(q); e.root.updateMatrixWorld(true);
    }
    return ok(Math.abs(len.roach - len.ants) < 0.005, len);
  },
});
story('enemies/ant-keeps-off-and-throws', {
  about: 'An ant walks after you, stops a little off, and throws its pushpin at you.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const P = G().player.position; spawn('ants', P.clone().add(V(0.6, 0, 0))); },
  play() {
    const { enemies, player } = G(), e = enemies.list[0];
    let thrown = false;
    step(60 * 8, () => (thrown = enemies.shots.some((s) => s.roll)));
    const d = Math.hypot(e.pos.x - player.position.x, e.pos.z - player.position.z);
    return ok(thrown && d > 0.2 && d < 0.5, { thrown, distance: +d.toFixed(2) });
  },
});
story('enemies/mosquito-bites', {
  about: 'A mosquito zips round you faster than you swim, then darts in and bites, and you bleed.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const P = G().player.position; spawn('mosquito', P.clone().add(V(0, 0.1, -0.3))); },
  play() {
    const { run } = G(), e = G().enemies.list[0];
    run.iFrames = 0;
    const m0 = run.health;
    let fastest = 0;
    e.biteCd = 3;                                               // circling first
    step(60 * 3, () => { fastest = Math.max(fastest, e.vel.length()); });
    step(60 * 8, () => run.bleeds.length > 0);
    return ok(run.health < m0 && run.bleeds.length > 0 && fastest > CONFIG.player.walkSpeed, { lost: +(m0 - run.health).toFixed(2), bleeding: run.bleeds.length, fastest: +fastest.toFixed(2), swim: CONFIG.player.walkSpeed });
  },
});

// --- progression
story('content/levelup-and-elite-tuning', {
  about: 'The requested level-up and elite tuning reaches the compiled game content.',
  setup() {},
  play() {
    const L = CONTENT.levelups, E = CONTENT.elites;
    const actual = {
      xp: L.xp, rarities: L.rarities,
      cards: Object.fromEntries(['health', 'fireRate', 'regen', 'dodge', 'bubbleSize'].map((id) => [id, L.cards[id].amounts])),
      bubbles: L.cards.bubbles.weight, bubbleSize: L.cards.bubbleSize.weight, pace: E.pace,
      aggro: ['controller', 'mug', 'kettle', 'soap', 'whipper'].map((id) => E[id].aggro),
      mug: [E.mug.skills.spill.puddles, E.mug.skills.coffee.lobs, E.mug.skills.coffee.drain],
      soap: [E.soap.skills.squirt.count, E.soap.skills.squirt.angryCount, E.soap.skills.ring.rings, E.soap.skills.ring.angryRings],
    };
    const expected = {
      xp: { base: 4, growth: 1.35 }, rarities: { common: 65, rare: 25, epic: 10 },
      cards: { health: [3, 5, 7], fireRate: [12, 18, 24], regen: [0.1, 0.2, 0.3], dodge: [10, 13, 16], bubbleSize: [15, 20, 25] },
      bubbles: 0, bubbleSize: 0, pace: { recover: 1, tempo: 1.4 }, aggro: [1.1, 0.9, 1.4, 1.2, 1.25], mug: [7, 5, 3], soap: [9, 10, 3, 5],
    };
    return ok(JSON.stringify(actual) === JSON.stringify(expected), { actual });
  },
});
story('progression/card-tiers', {
  about: 'Level-up cards give their tier\'s amount (Dodge at 0%: 10 / 13 / 16%); Bubbles and Bubble size are no longer offered.',
  setup() {},
  play() {
    const seen = {};
    for (let i = 0; i < 3000; i++) for (const c of rollCards({ bubbles: 1 }, 3)) (seen[c.stat] ||= new Set()).add(`${c.rarity.id}:${c.amount}`);
    const bubbles = [...(seen.bubbles || []), ...(seen.bubbleSize || [])], dodge = [...(seen.dodge || [])].sort();
    return ok(bubbles.length === 0 && dodge.join() === 'common:10,epic:16,rare:13', { bubbles, dodge });
  },
});
story('progression/one-reroll-per-act', {
  about: 'Level-up cards can be rerolled once an act: after the reroll is spent, the next level-up\'s Reroll button is greyed out; a later act (a fresh start, carrying the run) gives one back.',
  setup() { fresh({ elites: false, levels: true }); },
  play() {
    const { run, menus } = G();
    const button = () => document.querySelector('.jf-modal [data-act="reroll"]');
    run.pendingLevels = 2;
    run.levelUp();
    const first = !button().disabled;
    button().click();
    const spent = run.rerolls === 0 && button().disabled;
    document.querySelector('.jf-modal .jf-card').click();
    step(50);
    run.levelUp();
    const second = button().disabled && /\(0\)/.test(button().textContent);
    document.querySelector('.jf-modal .jf-card').click();
    step(50);
    run.start();                          // what a later act does on load (with the run's carry)
    const back = run.rerolls === 1;
    menus.close();
    return ok(first && spent && second && back, { first, spent, second, back });
  },
});
story('progression/disabled-cards-never-offered', {
  about: 'A zero-weight card is excluded even when every available card is requested and randomness picks the first entry.',
  setup() {},
  play() {
    stub(Math, 'random', () => 0);
    stub(CONTENT.levelups.cards.range, 'weight', 0);
    try {
      const cards = rollCards({ bubbles: 1 }, 99, 0, 0).map((c) => c.stat);
      return ok(CONTENT.levelups.cards.bubbles.weight === 0 && cards.length === 8 && !cards.includes('bubbles') && !cards.includes('bubbleSize') && !cards.includes('range'), { cards });
    } finally { restore(); }
  },
});
story('progression/luck', {
  about: 'Luck (a level-up card) makes rarer level-up cards and treasures come up more often.',
  setup() {},
  play() {
    const share = (luck) => {
      let epic = 0, cards = 0, top = 0, treasures = 0;
      for (let i = 0; i < 1500; i++) {
        for (const c of rollCards({ bubbles: 6 }, 3, 0, luck)) { cards++; if (c.rarity.id === 'epic') epic++; }
        for (const t of rollTreasures(CONTENT.treasures, 3, luck)) { treasures++; if (t.rarity === 'epic') top++; }
      }
      return { epicCards: +(epic / cards).toFixed(3), epicTreasures: +(top / treasures).toFixed(3) };
    };
    const none = share(0), lucky = share(120);
    return ok(lucky.epicCards > none.epicCards * 1.6 && lucky.epicTreasures > none.epicTreasures * 1.4, { none, lucky });
  },
});
story('content/every-treasure-has-a-rarity', {
  about: 'Every treasure is rated common, rare, epic or legendary, every rarity has treasures, and every element is Legendary.',
  setup() {},
  play() {
    const ids = TREASURE_RARITY.map((r) => r.id), count = Object.fromEntries(ids.map((id) => [id, 0]));
    for (const t of CONTENT.treasures) count[t.rarity] = (count[t.rarity] ?? NaN) + 1;
    const plainElements = CONTENT.treasures.filter((t) => t.vocabulary.includes('element') && t.rarity !== 'legendary').map((t) => t.id);
    return ok(ids.every((id) => count[id] > 0) && Object.keys(count).length === ids.length && !plainElements.length, { ...count, plainElements });
  },
});
story('progression/regen-card-reads-every-5-seconds', {
  about: 'The Health regen level-up card gives 0.1 / 0.2 / 0.3 Health a second (common / rare / epic) and reads as Health every 5 seconds: +0.5, +1, +1.5.',
  setup() {},
  play() {
    const amounts = CONTENT.levelups.cards.regen.amounts;
    const texts = amounts.map((amount) => cardText({ stat: 'regen', amount }));
    const want = ['+0.5 Health every 5 seconds', '+1 Health every 5 seconds', '+1.5 Health every 5 seconds'];
    return ok(amounts.join() === '0.1,0.2,0.3' && texts.every((t, i) => t === want[i]), { amounts, texts });
  },
});
story('progression/regen', {
  about: 'Health regen (a card or Hand Cream) refills health every second.',
  setup() { fresh({ elites: false, lash: false, bubbles: false }); tp(3.2, 0.05, 3.0, 0); G().run.stats.regen = 0.5; G().run.health = 10; },
  play() { step(60 * 4); const m = G().run.health; return ok(Math.abs(m - 12) < 0.05, { health: +m.toFixed(2) }); },
});
story('progression/dodge', {
  about: 'Dodge % makes that share of hits miss (starts at 0, capped at 60).',
  setup() { fresh({ elites: false, lash: false, bubbles: false, hurt: true }); tp(3.2, 0.05, 3.0, 0); G().run.stats.dodge = 50; },
  play() {
    const { run } = G();
    let missed = 0;
    for (let i = 0; i < 200; i++) { run.health = 50; run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount: 1, source: 'story' }); if (run.health === 50) missed++; }
    run.stats.dodge = 500;
    return ok(missed > 70 && missed < 130 && run.S.dodge === 60, { missed, of: 200, capped: run.S.dodge });
  },
});
story('progression/dodge-diminishes', {
  about: 'Dodge level-ups have diminishing returns: each pick closes the same share of the gap to the 60% cap (Common +10% at 0 Dodge, +5% at 30), so twelve picks in a row each still add some Dodge and never reach 60. Dodge from treasures (Odd Sock) counts toward the gap, and once treasures alone reach 60 the card is no longer offered.',
  setup() { fresh({ elites: false, lash: false, levels: true }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { run, menus } = G();
    for (const [k, c] of Object.entries(CONTENT.levelups.cards)) if (k !== 'dodge') stub(c, 'weight', 0);   // only Dodge is offered
    stub(CONTENT.levelups.rarities, 'rare', 0); stub(CONTENT.levelups.rarities, 'epic', 0);   // always Common
    const pick = () => {
      run.pendingLevels = 1;
      run.levelUp();
      const card = document.querySelector('.jf-modal .jf-card'), text = card.querySelector('.big').textContent;
      const was = run.S.dodge;
      card.click();
      step(50);
      return { text, gain: +(run.S.dodge - was).toFixed(2) };
    };
    const picks = [];
    for (let i = 0; i < 12; i++) picks.push(pick());
    const gains = picks.map((p) => p.gain), top = run.S.dodge;
    const shrinking = gains.every((g, i) => g > 0 && (i === 0 || g < gains[i - 1]));
    const reads = picks.every((p) => p.text === `+${p.gain}% Dodge`);
    run.stats.dodge = 0; give('sock');   // 15% from the Odd Sock: the first card gives 10 x 45/60
    const sock = pick();
    menus.close();
    const atCap = rollCards(run.stats, 3, 0, 0, { ...run.S, dodge: 60 }).length;   // treasures alone at the cap: no Dodge card at all
    return ok(gains[0] === 10 && picks[0].text === '+10% Dodge' && shrinking && reads && top < 60 && sock.gain === 7.5 && atCap === 0, { gains, top: +top.toFixed(1), sock, atCap });
  },
});
story('progression/level-curve', {
  about: 'Each level needs 1.35x the XP of the last, starting at 4: four cockroaches (1 XP each) is level 2.',
  setup() { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { run } = G(), curve = [1, 2, 3, 4, 5, 6].map(xpToNext);
    let killed = 0;
    for (let k = 0; k < 4; k++) {
      const e = spawn('roach', near(0, -0.15), { still: true, hp: 1 });
      step(240, () => e.dead);
      if (e.dead) killed++;
      tp(e.pos.x, 0.05, e.pos.z);                  // swim over to where it burst and pick up the XP
      step(120);
    }
    const ok1 = curve.join() === '4,5,7,10,13,18' && killed === 4 && run.level === 2 && xpToNext(run.level) === 5;
    return ok(ok1, { curve, killed, level: run.level, xp: run.xp });
  },
});

story('movement/jump-feel', {
  about: 'The jump, tuned like a platformer\'s: held, it reaches its full height (20 cm) with a beat of hang at the top, then falls faster than it rose; tapped (let go early) it\'s a short hop; a press just before landing jumps on touchdown (buffer). The bell stretches up at takeoff and squashes flat on landing; takeoff pushes out a ring of water with a bloop, and a real landing splashes.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); step(30); },
  play() {
    const { player, input, fx, run } = G(), y0 = player.position.y, rings = () => fx.rings.filter((r) => r.alive).length;
    let jumps = 0; const oj = run.player.onJump; run.player.onJump = () => { jumps++; oj(); };
    const jump = (holdFrames) => {
      const start = player.position.y; let peak = start, up = 0, down = 0, stretch = 1;
      input.keys.add('Space'); input.jumpQueued = true;
      for (let i = 0; i < 240; i++) {
        if (i === holdFrames) input.keys.delete('Space');
        step(1);
        stretch = Math.max(stretch, player.avatar.squash.scale.y);
        if (player.position.y > peak) { peak = player.position.y; up = i; }
        if (i > 2 && player.grounded) { down = i - up; break; }
      }
      input.keys.delete('Space');
      return { height: +(peak - start).toFixed(3), up, down, stretch: +stretch.toFixed(3) };
    };
    const r0 = rings(), full = jump(999), ring = rings() > r0;
    let squash = 1; for (let i = 0; i < 12; i++) { step(1); squash = Math.min(squash, player.avatar.squash.scale.y); }
    step(30);
    const hop = jump(4);
    step(30);
    // the buffer: jump, and press again just before touching down; it jumps again on landing
    input.jumpQueued = true; step(1);
    step(240, () => player.velocity.y < 0 && player.position.y - y0 < 0.012);
    const before = jumps; input.jumpQueued = true;
    step(20);
    const buffered = jumps === before + 1 && player.velocity.y > 0.2;
    run.player.onJump = oj;
    return ok(full.height > 0.19 && full.height < 0.23 && full.down < full.up && hop.height < full.height * 0.6 && buffered && ring && full.stretch > 1.08 && squash < 0.94,
      { full, hop, buffered, ring, squash: +squash.toFixed(3) });
  },
});
