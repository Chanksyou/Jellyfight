// Stories: movement, the bubble stream, progression. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { bus, PLAYER } from '../events.js';
import { CONTENT } from '../content.js';
import { rollCards, rollTreasures, TREASURE_RARITY, xpToNext } from '../stats.js';
import { ELEMENTS_IDS, G, V, fresh, holdJelly, near, ok, restore, spawn, startVacuum, step, story, stub, tp } from './kit.js';

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
  about: 'A cockroach chases at 0.3 m/s, slower than the jelly, so one can always be outswum.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 4.0, 0); spawn('roach', V(3.2, 0, 2.3)); },
  play() {
    const e = G().enemies.list[0];
    step(40); const a = e.pos.clone(); step(60);
    const v = e.pos.distanceTo(a);
    return ok(Math.abs(v - 0.3) < 0.02 && v < CONFIG.player.walkSpeed, { roach: +v.toFixed(3), jelly: CONFIG.player.walkSpeed });
  },
});

// --- the bubble stream
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
      step(6);
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
    const isUp = (t) => t.vocabulary.includes('element-up');
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
story('enemies/ants-curl-and-roll', {
  about: 'An ant squad curls into a ball and rolls at you.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const P = G().player.position; spawn('ants', P.clone().add(V(0.25, 0, 0))); },
  play() {
    const e = G().enemies.list[0];
    const seen = new Set();
    step(60 * 6, () => { seen.add(e.state); return seen.has('dash'); });
    return ok(seen.has('windup') && seen.has('dash'), { states: [...seen] });
  },
});
story('enemies/mosquito-spits', {
  about: 'A mosquito hovers out of reach and its spit costs you health.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const P = G().player.position; spawn('mosquito', P.clone().add(V(0, 0.1, -0.15))); },
  play() {
    const { run } = G();
    run.iFrames = 0;
    const m0 = run.health;
    step(60 * 10, () => run.health < m0);
    return ok(run.health < m0, { lost: +(m0 - run.health).toFixed(2) });
  },
});
story('enemies/beetle-charges-and-fires-three', {
  about: 'A rhinoceros beetle in range charges its horns — the glowing orb is the warning — then fires exactly three fat electrical orbs in a fan (each twice a spider\'s web ball across, with its crackling halo), each doing its spit damage.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const P = G().player.position; spawn('beetle', P.clone().add(V(0.3, 0, 0))); },
  play() {
    const { enemies } = G(), e = enemies.list[0];
    let sawAim = false, orbLit = false, volley = null, maxLight = 0;
    step(60 * 10, () => {
      if (e.aimT > 0) { sawAim = true; const orb = e.mesh.getObjectByName('charge-orb'); if (orb && orb.visible) orbLit = true; }
      e.mesh.traverse((o) => { if (o.isPointLight) maxLight = Math.max(maxLight, o.intensity); });
      if (!volley && enemies.shots.length >= 3) volley = enemies.shots.slice(0, 3).map((s) => ({ vx: s.v.x, vz: s.v.z, dmg: s.dmg, orb: !!s.orb, geo: s.m.geometry === enemies.orbGeo, halo: s.m.children.length === 1 }));
      return !!volley;
    });
    if (!volley) return ok(false, { sawAim, orbLit, shots: enemies.shots.length });
    const a0 = Math.atan2(volley[0].vx, volley[0].vz), a2 = Math.atan2(volley[2].vx, volley[2].vz);
    const fan = Math.abs(a2 - a0) * 180 / Math.PI;
    const dmg = volley.every((s) => s.dmg === 3);
    const orbs = volley.every((s) => s.orb && s.geo && s.halo);
    const big = enemies.orbGeo.parameters.radius > 0.009 * 1.5;   // the web wad's radius is 0.009
    // the charge light is scaled for a 6 cm beetle (it only tints the horns — an
    // unscaled light floods the room white), and the orbs read blue, not white
    const blue = enemies.orbColor.b > enemies.orbColor.r + 0.15 && enemies.orbMat.color.b > enemies.orbMat.color.r + 0.15;
    return ok(sawAim && orbLit && fan > 28 && fan < 40 && dmg && orbs && big && maxLight <= 3 && blue,
      { sawAim, orbLit, fan: +fan.toFixed(1), dmg, orbs, big, maxLight: +maxLight.toFixed(2), blue });
  },
});

// --- progression
story('progression/card-tiers', {
  about: 'Level-up cards give their tier\'s amount (Dodge: 10 / 12.5 / 15%), and the Bubbles card only ever comes as Epic +1.',
  setup() {},
  play() {
    const seen = {};
    for (let i = 0; i < 3000; i++) for (const c of rollCards({ bubbles: 1 }, 3)) (seen[c.stat] ||= new Set()).add(`${c.rarity.id}:${c.amount}`);
    const bubbles = [...(seen.bubbles || [])], dodge = [...(seen.dodge || [])].sort();
    return ok(bubbles.join() === 'epic:1' && dodge.join() === 'common:10,epic:15,rare:12.5', { bubbles, dodge });
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
    const none = share(0), lucky = share(60);
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
story('progression/level-curve', {
  about: 'Each level needs 1.45x the XP of the last, starting at 3: three cockroaches (1 XP each) is level 2.',
  setup() { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { run } = G(), curve = [1, 2, 3, 4, 5, 6].map(xpToNext);
    let killed = 0;
    for (let k = 0; k < 3; k++) {
      const e = spawn('roach', near(0, -0.15), { still: true, hp: 1 });
      step(240, () => e.dead);
      if (e.dead) killed++;
      tp(e.pos.x, 0.05, e.pos.z);                  // swim over to where it burst and pick up the XP
      step(120);
    }
    const ok1 = curve.join() === '3,4,6,9,13,19' && killed === 3 && run.level === 2 && xpToNext(run.level) === 4;
    return ok(ok1, { curve, killed, level: run.level, xp: run.xp });
  },
});
