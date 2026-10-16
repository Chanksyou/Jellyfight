// Stories: the event bus, the boss (Vacuum), modes. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { bus, PLAYER } from '../events.js';
import { STAGES } from '../stages.js';
import { hostile } from '../vfx.js';
import { juice } from '../juice.js';
import { ELEMENTS_IDS, G, JUMP_FEET, V, againVacuum, bossHits, fresh, holdJelly, ok, r3, restore, shownWarnings, sim, spawn, startVacuum, step, story, stub, tp } from './kit.js';

// --- the event bus: what hits, kills, freezes and rewards do
story('events/player-hit-feedback', {
  about: 'Landed hits nudge the jelly away with a light shake; invulnerability and drains add no nudge, and Reduce effects disables shake only.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3, 0); spawn('roach', G().player.position.clone().add(V(0.2, 0, 0)), { still: true }); },
  play() {
    const { run, player, enemies } = G();
    run.S.dodge = 0; run.iFrames = 0;
    stub(juice, 'calm', false); stub(juice, 'trauma', 0);
    player.velocity.set(0, 0, 0);
    const hit = { targetId: PLAYER, amount: 1, source: 'story', from: enemies.list[0].id };
    bus.emit('damage_taken', hit);
    const directed = Math.abs(player.velocity.x + 0.06) < 1e-8 && player.velocity.y === 0 && Math.abs(player.velocity.z) < 1e-8;
    const shake = Math.abs(juice.trauma - 0.22) < 1e-8;
    bus.emit('damage_taken', hit);
    bus.emit('damage_taken', { ...hit, drain: true });
    const noRepeat = Math.abs(player.velocity.x + 0.06) < 1e-8 && Math.abs(juice.trauma - 0.22) < 1e-8;
    run.iFrames = 0; player.velocity.set(0, 0, 0); player.facing = 0;
    juice.calm = true; juice.trauma = 0;
    bus.emit('damage_taken', { ...hit, from: null });
    const fallback = Math.abs(player.velocity.z + 0.06) < 1e-8 && player.velocity.y === 0;
    return ok(directed && shake && noRepeat && fallback && juice.trauma === 0, { directed, shake, noRepeat, fallback, calmShake: juice.trauma });
  },
});
story('events/kill-drops-xp', {
  about: 'Bubbles kill a roach: it bursts, counts as a kill and drops XP.',
  setup() { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const P = G().player.position; spawn('roach', P.clone().add(V(0, 0, -0.18)), { still: true }); },
  play() {
    const { run, enemies, xpDrops } = G();
    const e = enemies.list[0], k0 = run.kills;
    step(300, () => e.dead);
    return ok(e.dead && run.kills === k0 + 1 && xpDrops.list.length > 0 && !enemies.byId.has(e.id), { dead: e.dead, xp: xpDrops.list.length });
  },
});
story('events/ice-refreshes-slow-without-freezing', {
  about: 'Ice slows on the first hit and refreshes the slow on repeated hits without freezing.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('ants', G().player.position.clone().add(V(0.3, 0, 0.3))); },
  play() {
    const e = G().enemies.list[0];
    bus.emit('status_applied', { targetId: e.id, status: 'chill', duration: 2 });
    const once = e.slowT;
    e.slowT = 0.5;
    bus.emit('status_applied', { targetId: e.id, status: 'chill', duration: 2 });
    return ok(once === 2 && e.slowT === 2 && !(e.freezeT > 0), { afterOne: once, afterTwo: e.slowT, frozen: e.freezeT || 0 });
  },
});
story('events/iframes-and-drain', {
  about: 'A second hit inside the invincibility window does nothing; ongoing drain (puddles) still does.',
  setup() { fresh({ hurt: true, elites: false }); },
  play() {
    const { run } = G();
    run.iFrames = 0;
    const m0 = run.health;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 3, source: 'story' });
    const m1 = run.health;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 3, source: 'story' });
    const m2 = run.health;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 1, source: 'story', drain: true });
    return ok(m1 === m0 - 3 && m2 === m1 && run.health === m2 - 1, { m0, m1, m2, m3: run.health });
  },
});
story('events/elite-defeat-leaves-a-treasure', {
  about: 'Beating an elite leaves a treasure (a golden chest) on its high ground, not a pick right away.',
  setup() { fresh(); },
  play() {
    const { run, enemies, menus } = G();
    const mug = run.elites.list.find((e) => e.kind === 'mug'), entry = enemies.list.find((e) => e.proxy === mug);
    bus.emit('damage_taken', { targetId: entry.id, amount: 9999, source: 'story' });
    step(5);
    const pick = menus.open, chest = run.roomTreasures.find((t) => t.active && !t.timed);
    const near = chest && Math.hypot(chest.pos.x - mug.base.x, chest.pos.z - mug.base.z) < 0.05 && Math.abs(chest.pos.y - mug.base.y) < 0.05;
    return ok(mug.dead && !pick && near, { dead: mug.dead, pick, chest: chest && r3(chest.pos), base: r3(mug.base) });
  },
});

// --- the boss
story('boss/vacuum-arena-and-kill', {
  about: 'The Vacuum fight: low walls keep you in front of the kitchen, and it can be beaten.',
  setup() { fresh({ bubbles: true }); G().run.startBossIntro(); },
  play() {
    const { run, menus } = G();
    step(180);
    const phase = run.phase;
    const esc = sim(4, ['KeyD']).pos;
    const A = run.stage.boss;
    const inside = esc[0] > A.arenaMin[0] - 0.1 && esc[0] < A.arenaMax[0] + 0.1 && esc[2] > A.arenaMin[2] - 0.1 && esc[2] < A.arenaMax[2] + 0.1;
    run.stats.tentacleDamage = 60; run.stats.tentacles = 4;
    step(60 * 40, () => { if (menus.open) document.querySelector('.jf-card')?.click(); return run.boss.dead; });
    return ok(phase === 'boss' && inside && run.boss.dead, { phase, esc, dead: run.boss.dead });
  },
});

story('boss/vacuum-lanternfly-shield', {
  about: 'The Vacuum launches 4 lanternflies and is immune until they are all dead, then can be hurt again.',
  setup() { fresh({ bubbles: false, lash: false }); G().run.startBossIntro(); },
  play() {
    const { run, enemies } = G();
    step(180);
    const V = run.boss;
    V.state = 'flies'; V.stateT = 1.0; V.prevT = 1.0;
    step(60);
    const flies = V.guards.length, airborne = V.guards.filter((e) => e.airborne).length;
    const hp0 = V.hp;
    bus.emit('damage_taken', { targetId: enemies.list.find((e) => e.proxy === V).id, amount: 50, source: 'test' });
    const immune = V.hp === hp0 && V.shielded;
    step(60);
    const landed = V.guards.every((e) => !e.airborne);
    for (const e of [...V.guards]) enemies.applyDamage(e, 1e4);
    step(5);
    const down = !V.shielded;
    V.damage(50);
    return ok(flies === 4 && airborne === 4 && immune && landed && down && V.hp === hp0 - 50, { flies, airborne, immune, landed, down, hp: V.hp, hp0 });
  },
});

story('boss/vacuum-enrages-at-half', {
  about: 'Below half health the Vacuum enrages: it stops and shudders for a moment (ENRAGED!), then does everything twice as fast.',
  setup() { fresh({ bubbles: false, lash: false, hurt: false }); G().run.startBossIntro(); },
  play() {
    const { run } = G();
    step(180);
    const V = run.boss;
    const calm = V.pace;
    V.hp = V.maxHp * 0.49;
    step(2);
    const enraging = V.enrageT > 0, still = V.pace === 1;
    const at = V.holder.position.clone();
    step(30);
    const stood = V.holder.position.distanceTo(at) < 1e-6;
    step(90);                                       // the enrage is over
    V.state = 'chase'; V.stateT = 2.6;
    step(30);                                       // half a second of real time
    const used = 2.6 - V.stateT;                    // a calm Vacuum would use 0.5 s of its chase
    return ok(calm === 1 && enraging && still && stood && V.pace === 2 && used > 0.9 && used < 1.1, { calm, enraging, stood, pace: V.pace, used: +used.toFixed(2) });
  },
});

story('boss/vacuum-two-shields-max', {
  about: 'The Vacuum raises its lanternfly shield twice a fight at most.',
  setup() { fresh({ bubbles: false, lash: false, hurt: false }); G().run.startBossIntro(); },
  play() {
    const { run, enemies } = G();
    step(180);
    const V = run.boss;
    let flies = 0;
    for (let k = 0; k < 12; k++) {                  // plenty of picks: the flies come up every 5th normally
      for (const e of [...V.guards]) enemies.applyDamage(e, 1e4);
      step(2);
      V.pick();
      if (V.state === 'flies') { flies++; V.launch(); }
    }
    return ok(V.shields === 2 && flies === 2, { shields: V.shields, flies });
  },
});

// --- 3D attacks: the Vacuum's charge is a lane as tall as it is (8 cm: jump it), its brush sweeps
story('boss/dendi-finishes-the-vacuum', {
  about: 'At 0 hp the Vacuum is doomed, not dead: the screen fades, Dendi appears beside it in view of the camera, and his smack is what kills it — then the usual cleared flow runs.',
  setup() { startVacuum('charge'); },
  play() {
    const { run } = G(), B = run.boss, d = window.dendi;
    B.damage(99999);
    const doomed = B.dying && !B.dead;
    let smacked = false, catNear = false, onScreen = false;
    const v = new THREE.Vector3();
    step(60 * 5, () => {
      if (d.state() === 'smack') smacked = true;
      // the camera shows him: his middle inside the frame while he smacks (it once kept the player's angle and left him off-screen)
      if (smacked && d.group.visible) { d.group.getWorldPosition(v); v.y += 0.15; v.project(G().APT.camera); if (Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.9 && v.z < 1) onScreen = true; }
      if (B.dead && !catNear) {
        const c = B.center(), gp = d.group.position;
        catNear = Math.hypot(gp.x - c.x, gp.z - c.z) < B.r + 0.45;
      }
      return B.dead && run.bossWon;
    });
    return ok(doomed && smacked && catNear && onScreen && run.bossWon && !d.group.visible,
      { doomed, smacked, catNear, onScreen, won: run.bossWon, goneAfter: !d.group.visible });
  },
});
story('boss/vacuum-charge-warning-is-a-lane', {
  about: "The charge's Warning is its floor strip with a lane volume over it as tall as the Vacuum (8 cm), filling together; both go when it rams.",
  setup() { startVacuum('charge'); },
  play() {
    const B = G().run.boss, floorY = B.position.y;
    step(20);
    const w1 = shownWarnings(), strip = w1.floor[0], lane = w1.volume[0], p1 = [strip?.material.progress, lane?.material.progress];
    step(20);
    const p2 = [strip?.material.progress, lane?.material.progress];
    let shape = {};
    if (strip && lane) {
      const s = new THREE.Box3().setFromObject(strip), l = new THREE.Box3().setFromObject(lane);
      const same = (a, b) => Math.abs(a - b) < 0.005;
      shape = { tall: +(l.max.y - floorY).toFixed(3), onFloor: l.min.y > floorY - 0.005, over: same(s.min.x, l.min.x) && same(s.max.x, l.max.x) && same(s.min.z, l.min.z) && same(s.max.z, l.max.z) };
      shape.ok = Math.abs(shape.tall - 0.08) < 0.003 && shape.onFloor && shape.over;
    }
    step(60, () => B.locked);
    const w3 = shownWarnings(), gone = B.locked && !w3.floor.includes(strip) && !w3.volume.includes(lane);
    const filling = !!(strip && lane) && Math.abs(p1[0] - p1[1]) < 1e-6 && Math.abs(p2[0] - p2[1]) < 1e-6 && p2[1] > p1[1];
    return ok(filling && shape.ok && gone, { p1, p2, shape, gone, floors: w1.floor.length, volumes: w1.volume.length });
  },
});
story('boss/vacuum-charge-jumped-clear', {
  about: "A jelly standing in the charge's lane is hit (4) when the Vacuum gets there; one in the air above it (feet 12 cm up, over an 8 cm Vacuum) isn't, by the lane or the bump, as it rams underneath.",
  setup() { startVacuum('charge'); },
  play() {
    const B = G().run.boss, player = holdJelly(), hits = bossHits(), out = {};
    for (const jump of [false, true]) {
      againVacuum(B, 'charge');
      step(120, () => B.locked);
      if (jump) { player.position.y = B.position.y + JUMP_FEET; player.grounded = false; }
      const h0 = hits.length, from = B.position.clone();
      step(120, () => B.state !== 'charge');
      const passed = B.position.distanceTo(from) > from.distanceTo(player.position);   // it rammed on past the jelly
      out[jump ? 'jumping' : 'standing'] = { hits: hits.slice(h0).map((h) => h.amount), passed };
    }
    const pass = out.standing.hits[0] === 4 && out.jumping.hits.length === 0 && out.jumping.passed;
    return ok(pass, out);
  },
});
story('boss/vacuum-charge-just-cleared-no-bump', {
  about: "The charge's lane (8 cm) is its hit while it rams: a jelly in the air with its feet 9 cm up, just over the lane, isn't hit by the lane or by bumping into it as it rams underneath.",
  setup() { startVacuum('charge'); },
  play() {
    const B = G().run.boss, player = holdJelly(), hits = bossHits();
    againVacuum(B, 'charge');
    step(120, () => B.locked);
    player.position.y = B.position.y + 0.09; player.grounded = false;
    const from = B.position.clone();
    step(120, () => B.state !== 'charge');
    const passed = B.position.distanceTo(from) > from.distanceTo(player.position);
    const got = hits.map((h) => h.amount);
    return ok(passed && !got.length, { passed, hits: got });
  },
});
story('boss/vacuum-brushes-sweep-a-low-wall', {
  about: "Each brush sweep shows as a low wall (2 cm) spreading out round the Vacuum to its reach (27 cm), in its hostile colour, then gone.",
  setup() { startVacuum('brushes'); },
  play() {
    const B = G().run.boss;
    holdJelly(); againVacuum(B, 'brushes', 0.4);
    const seen = [];
    step(120, () => {
      const v = shownWarnings().volume[0];
      if (v) { const b = new THREE.Box3().setFromObject(v); seen.push({ r: (b.max.x - b.min.x) / 2, tall: b.max.y - B.position.y, low: b.min.y - B.position.y, color: v.material.uniforms.uColor.value.getHex() }); }
      return B.state !== 'brushes';
    });
    const after = shownWarnings().volume.length;
    const walls = seen.length > 0 && seen.every((w) => Math.abs(w.tall - 0.02) < 0.002 && Math.abs(w.low) < 0.002 && w.color === hostile('vacuum').getHex());
    const spreads = seen.length > 2 && seen[1].r > seen[0].r && Math.abs(Math.max(...seen.map((w) => w.r)) - 0.27) < 0.01;
    return ok(walls && spreads && after === 0, { frames: seen.length, first: seen[0] && +seen[0].r.toFixed(3), widest: seen.length && +Math.max(...seen.map((w) => w.r)).toFixed(3), walls, after });
  },
});
story('boss/vacuum-brushes-jumped-clear', {
  about: "A jelly standing in a brush sweep's reach is hit by both sweeps (3 each); one in the air above it (feet 5 cm up, over a 2 cm wall) isn't.",
  setup() { startVacuum('brushes'); },
  play() {
    const B = G().run.boss, player = holdJelly(), hits = bossHits(), out = {};
    for (const jump of [false, true]) {
      againVacuum(B, 'brushes', 0.26);
      if (jump) { player.position.y = B.position.y + 0.05; player.grounded = false; }
      const h0 = hits.length;
      step(120, () => B.state !== 'brushes');
      out[jump ? 'jumping' : 'standing'] = hits.slice(h0).map((h) => h.amount).filter((n) => n === 3).length;   // a sweep's hit (the bump is 2)
    }
    return ok(out.standing === 2 && out.jumping === 0, out);
  },
});
story('boss/vacuum-spin-low-and-high', {
  about: "The spin's dust clumps are Shots alternating floor level (4.5 cm) and jump height (16 cm): the low ones pass under a jumping jelly and the high ones over a grounded one (each hits the jelly that doesn't dodge it, 3).",
  setup() { startVacuum('spin'); },
  play() {
    const B = G().run.boss, player = holdJelly(), hits = bossHits(), out = {};
    for (const jump of [false, true]) {
      againVacuum(B, 'spin', 0.45);
      B.stateT = 1.0;
      if (jump) { player.position.y = B.position.y + JUMP_FEET; player.grounded = false; }
      const h0 = hits.length, seen = new Set(), heights = [];
      // keep it facing the jelly as each clump flies, so every one comes straight at it
      const aim = () => { B.heading = Math.atan2(player.position.x - B.position.x, player.position.z - B.position.z) - 9 / 60; };
      aim();
      step(200, () => {
        for (const s of B.shots) if (!seen.has(s)) { seen.add(s); heights.push(s.m.position.y - B.position.y); }
        if (B.state === 'spin') aim();
        return B.state !== 'spin' && !B.shots.length;
      });
      const low = heights.filter((h) => h < 0.07).length, high = heights.length - low;
      const alternate = heights.every((h, i) => i === 0 || (h < 0.07) !== (heights[i - 1] < 0.07));
      out[jump ? 'jumping' : 'grounded'] = { low, high, alternate, hits: hits.slice(h0).map((h) => h.amount) };
    }
    const g = out.grounded, j = out.jumping, spin = (r) => r.hits.filter((n) => n === 3).length, clean = (r) => r.hits.every((n) => n === 2 || n === 3);   // 3s are the clumps; a 2 is a bump (at spin speed 0.9 for 3 s the Vacuum drives the last stretch into you)
    const pass = g.low > 0 && g.high > 0 && j.low > 0 && j.high > 0 && g.alternate && j.alternate && clean(g) && clean(j)
      && spin(g) === g.low && spin(j) === j.high;   // grounded: only the low clumps hit; jumping: only the high ones
    return ok(pass, out);
  },
});
for (const attack of ['charge', 'brushes', 'spin']) {
  story(`boss/vacuum-${attack}-builds-no-shader`, {
    about: `Starting the Vacuum's ${attack} builds no new shader: its Warning, volume and Shots were built behind Play.`,
    setup() { startVacuum(attack); },
    play() {
      const { APT, batcher } = G(), B = G().run.boss, programs = APT.renderer.info.programs.length;
      holdJelly(); againVacuum(B, attack, 0.4);
      const showing = () => (attack === 'spin' ? B.shots.length > 1 : shownWarnings().volume.length > 0);
      step(120, showing);
      const shown = showing();
      batcher.sync(); APT.renderer.compile(APT.scene, APT.camera);
      const newShaders = APT.renderer.info.programs.length - programs;
      return ok(shown && newShaders === 0, { shown, newShaders });
    },
  });
}

story('modes/quick-restart-after-death', {
  about: 'Starting a new run right after dying: the old run\'s death screen (it comes 0.7 s after) doesn\'t land on the new run.',
  setup() { fresh({ bubbles: false, lash: false }); },
  async play() {
    const { run, menus } = G();
    run.die();
    run.start();                                   // straight away, before the death screen
    run.startPicked = true;
    await new Promise((r) => setTimeout(r, 1000));
    const stale = /dried out/.test(document.querySelector('.jf-modal')?.innerText || '');
    const t0 = run.t;
    step(60);
    const runs = run.phase === 'explore' && run.t > t0;
    menus.close();
    return ok(!stale && runs, { stale, phase: run.phase, runs });
  },
});

story('boss/legendary-reward', {
  about: 'The Boss reward: after the metamorphosis, a Legendary pick of three with at least one element you don\'t have yet, then the act is complete.',
  setup() { fresh({ bubbles: false, lash: false, hurt: false }); },
  play() {
    const { run } = G();
    run.owned.add('candle');
    const modal = () => document.querySelector('.jf-modal');
    run.metamorph();
    const first = modal().querySelector('h2')?.textContent;
    modal().querySelector('.jf-card').click();                        // an evolution
    const second = modal().querySelector('h2')?.textContent;
    const offered = [...modal().querySelectorAll('.jf-card .big')].map((n) => n.textContent);
    const tiers = [...modal().querySelectorAll('.jf-card .rar')].map((n) => n.textContent);
    modal().querySelector('.jf-card').click();                        // a Legendary
    const third = modal().querySelector('h2')?.textContent;
    G().menus.close();
    // the rule over many rolls: Legendary only, never one you own, always an element while any are left
    const els = ['battery', 'freezerPack', 'nailPolish', 'paperFan', 'glitter'];
    for (const id of els) run.owned.delete(id);                       // back to owning just fire
    let bad = 0, rolls = 0, lastOnly = 0;
    stub(run.ui, 'choose', (t, s, list) => {
      rolls++;
      if (list.some((c) => c.rarity !== 'legendary' || run.owned.has(c.id)) || !list.some((c) => ELEMENTS_IDS.includes(c.id))) bad++;
    });
    for (let i = 0; i < 100; i++) run.pickLegendary('', '', () => {});
    let treasures = 0;
    stub(run.ui, 'choose', (t, s, list) => { if (list.some((c) => !ELEMENTS_IDS.includes(c.id))) treasures++; });
    for (let i = 0; i < 100; i++) run.pickLegendary('', '', () => {});   // Legendary treasures turn up too (Hand Mirror, Snooze Button)
    for (const id of els.slice(0, 4)) run.owned.add(id);              // one element left
    stub(run.ui, 'choose', (t, s, list) => { if (list.some((c) => c.id === 'glitter')) lastOnly++; else bad++; });
    for (let i = 0; i < 50; i++) run.pickLegendary('', '', () => {});
    restore();
    return ok(/Metamorphosis/.test(first) && /Legendary/.test(second) && offered.length === 3 && !offered.includes('Birthday Candle')
      && tiers.every((t) => t === 'Legendary') && /Act 1 complete/.test(third) && !bad && rolls === 100 && lastOnly === 50 && treasures > 30,
      { first, second, offered, tiers, third, bad, rolls, lastOnly, treasures });
  },
});

story('boss/xp-comes-to-you', {
  about: 'Once a boss is beaten, all the XP around the arena (its own and its summons\') flies to you, and any still on its way counts when the metamorphosis opens.',
  setup() { fresh({ bubbles: false, lash: false, hurt: false }); G().run.startBossIntro(); },
  play() {
    const { run, xpDrops } = G();
    step(180);
    const A = run.stage.boss;
    for (let k = 0; k < 6; k++) xpDrops.drop(V(A.arenaMin[0] + 0.1 + k * 0.2, 0.02, A.arenaMax[2] - 0.1), 1, 3);   // XP from summons, far from you
    const before = run.purse;
    run.boss.hp = 0; run.boss.dead = true;
    step(90);
    const flewIn = run.purse - before;
    const leftWhenDone = xpDrops.list.length;
    return ok(flewIn >= 18 + 30 - 5 && leftWhenDone === 0, { flewIn, leftWhenDone });
  },
});

story('boss/ends-after-a-quick-restart', {
  about: 'A run restarted in the moment between a boss falling and the metamorphosis (dying to a stray shot, then Try again): the next boss still ends when it\'s beaten.',
  setup() { fresh({ bubbles: false, lash: false, hurt: false }); G().run.startBossIntro(); },
  play() {
    const { run, menus } = G();
    step(180);
    run.boss.hp = 0; run.boss.dead = true;
    step(2);                                       // the boss is down; its metamorphosis is 2.2 s away
    const first = run.bossWon;
    run.start(); run.startPicked = true;           // restarted before it comes
    run.startBossIntro();
    step(180);
    const second = run.phase === 'boss' && !run.bossWon;
    run.boss.hp = 0; run.boss.dead = true;
    step(2);
    menus.close();
    return ok(first && second && run.bossWon, { first, second, wonAgain: run.bossWon });
  },
});

story('modes/dev-fight-boss', {
  about: 'The pause menu\'s Fight boss (dev) button opens the boss picker; picking this act\'s boss starts a fresh run that goes straight to it.',
  setup() { fresh(); },
  play() {
    const { run, menus } = G();
    document.getElementById('g-over').hidden = false;
    document.querySelector('#g-over [data-act="boss"]').click();
    [...document.querySelectorAll('.btns button')].find((b) => b.textContent === 'The Vacuum (boss, act 1)')?.click();
    document.getElementById('g-over').hidden = true;   // desktop closes the menu once the mouse locks (not in a headless browser)
    step(240, () => { if (menus.open) document.querySelector('.jf-card')?.click(); return run.phase === 'boss'; });
    return ok(run.phase === 'boss' && !!run.boss && run.t < 10, { phase: run.phase, t: run.t });
  },
});

story('elites/hud-health-bar', {
  about: 'While an elite fights you, its name and health show on the HUD under the clock (and drop as you hit it); walk away and the bar goes. Its own bar over it turns from green toward red.',
  setup() { fresh({ bubbles: false, lash: false }); tp(0.66, 0.78, 2.95, 0); },
  play() {
    const { run } = G(), mug = run.elites.list.find((e) => e.kind === 'mug');
    const bar = () => document.querySelector('#hud .elite');
    step(20);
    const shown = !bar().hidden && /MUG/.test(bar().innerText);
    const full = bar().querySelector('i').style.transform;
    const green = mug.fill.material.color.g > mug.fill.material.color.r;
    mug.hp = mug.maxHp * 0.3;
    step(2);
    const after = bar().querySelector('i').style.transform, red = mug.fill.material.color.r > mug.fill.material.color.g;
    tp(3.2, 0.05, 3.0, 0);
    step(20);
    const gone = bar().hidden;
    return ok(shown && full === 'scaleX(1)' && /scaleX\(0\.3/.test(after) && green && red && gone, { shown, full, after, green, red, gone });
  },
});

story('elites/tougher-and-quicker', {
  about: 'Elites have their file Health in act 1 (the Mug: 250) and rest 1.2x quicker between attacks (Elite pace): a 1.2 s rest is over in 1 s.',
  setup() { fresh({ bubbles: false, lash: false }); },
  play() {
    const { run } = G(), mug = run.elites.list.find((e) => e.kind === 'mug');
    const hp = mug?.maxHp === Math.round(250 * (run.elites.hpScale || 1));
    mug.cool = 1.2;
    step(60);
    return ok(hp && Math.abs(mug.cool) < 0.03, { maxHp: mug?.maxHp, cool: +mug.cool.toFixed(3) });
  },
});
story('elites/hall-clock-hangs-in-act-1', {
  about: 'In act 1 the detailed hall clock hangs over the cubby bench as a plain clock (you can see down the hall), in place of the apartment\'s simple one.',
  setup() { fresh(); },
  play() {
    const { run } = G(), c = run.elites.decor.find((d) => d.kind === 'clock');
    let oldShown = false; G().APT.root.traverse((o) => { if (/^Ornate_wall_clock/.test(o.name) && o.isMesh && o.visible) oldShown = true; });
    return ok(c && !oldShown && Math.abs(c.holder.position.y - 1.12) < 0.02 && !run.elites.list.some((e) => e.kind === 'clock'), { clock: !!c, oldShown, y: c && +c.holder.position.y.toFixed(3) });
  },
});
story('modes/dev-one-on-one', {
  about: 'The pause menu\'s 1 on 1 (dev) button lists every enemy; picking one starts a run with just it (it comes back after you clear it), and an elite puts you on its high ground.',
  setup() { fresh(); },
  play() {
    const { run, enemies } = G();
    const pickFrom = (name) => {
      document.getElementById('g-over').hidden = false;
      document.querySelector('#g-over [data-act="duel"]').click();
      const btn = [...document.querySelectorAll('.btns button')].find((b) => b.textContent === name);
      btn?.click();
      document.getElementById('g-over').hidden = true;   // desktop closes the menu once the mouse locks (not in a headless browser)
      return !!btn;
    };
    const listed = pickFrom('House fly');
    stub(run, 'hurt', () => {}); stub(run.bubbles, 'update', () => {}); stub(run.lash, 'update', () => {});
    step(60 * 4);
    const bugs = () => enemies.list.filter((e) => !e.dead && !e.proxy);
    const alone = bugs().length === 1 && bugs()[0].type === 'housefly';
    enemies.applyDamage(bugs()[0], 1e4);
    step(30);
    const gone = bugs().length === 0;
    step(90);
    const back = bugs().length === 1 && bugs()[0].type === 'housefly';
    const all = ['The Controller', 'The Mug', 'The Kettle', 'The Soap Dispenser', 'The Wall Clock', 'The Cream Whipper'].every((n) => run.duelChoices().some((p) => p.name.startsWith(n + ' (elite')));
    const elite = pickFrom('The Mug (elite, act 1)');
    step(30);
    const mug = run.elites.alive.length === 1 && run.elites.alive[0].spec.kind === 'mug' && G().player.position.y > 0.6 && bugs().length === 0;
    return ok(listed && alone && gone && back && elite && mug && all, { listed, alone, gone, back, elite, mug, all, y: +G().player.position.y.toFixed(2) });
  },
});
story('modes/dev-fight-boss-picker', {
  about: 'The pause menu\'s Fight boss (dev) button lists every act\'s boss; picking one starts a fresh run straight at its intro (a boss from another act reloads into that act first).',
  setup() { fresh(); },
  play() {
    const { run } = G();
    // every act with a boss offers it, labelled with its act
    const picks = run.bossChoices();
    const listed = STAGES.filter((st) => st.boss).every((st) => picks.some((p) => p.act === st.id && p.name === `${st.boss.name} (boss, act ${st.id})`));
    // open the picker and choose this act's boss
    document.getElementById('g-over').hidden = false;
    document.querySelector('#g-over [data-act="boss"]').click();
    const btn = [...document.querySelectorAll('.btns button')].find((b) => b.textContent === 'The Vacuum (boss, act 1)');
    btn?.click();
    document.getElementById('g-over').hidden = true;   // desktop closes the menu once the mouse locks (not in a headless browser)
    const intro = run.phase === 'intro';
    step(240);
    return ok(listed && !!btn && intro && !!run.boss, { listed, btn: !!btn, intro, boss: !!run.boss, phase: run.phase });
  },
});

story('treasures/spots-not-on-vent-landings', {
  about: 'No treasure spot sits on a vent\'s landing point: the ones that did moved over, onto the same surface.',
  setup() { fresh(); },
  play() {
    const { run, traversal } = G();
    const lands = traversal.vents.map((v) => v.land);
    const bad = run.spots.filter((sp) => lands.some((L) => Math.hypot(L[0] - sp.at[0], L[2] - sp.at[2]) < 0.13 && Math.abs(L[1] - sp.y) < 0.08)).map((sp) => sp.label);
    const moved = run.spots.filter((sp) => { const o = run.stage.spots.find((q) => q.label === sp.label); return o && (o.at[0] !== sp.at[0] || o.at[2] !== sp.at[2]); })
      .map((sp) => `${sp.label} ${sp.at.map((v) => v.toFixed(2)).join(',')}`);
    return ok(!bad.length && moved.length >= 4 && run.spots.length >= 12 && run.spots.every((sp) => run.inStage(sp.at[0], sp.at[2])), { bad, moved, kept: run.spots.length, rejects: run.spotRejects });
  },
});

story('engine/tentacles-swim-smoothly', {
  about: 'The jelly\'s tentacles are a simulated chain: swimming drags them out behind, and they move smoothly (no frame-to-frame jitter at the tips).',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.0, 3.0, 0); },
  play() {
    const { input, player } = G();
    const rig = player.avatar.tentacles, tips = [];
    step(30);
    input.keys = new Set(['KeyW']);
    for (let i = 0; i < 120; i++) { step(1); tips.push(rig.list.map((T) => T.sim[T.sim.length - 1].clone())); }
    // trailing: the tips sit behind the roots, against the swim direction
    const back = rig.list.reduce((a, T) => a + T.sim[T.sim.length - 1].clone().sub(T.sim[0]).dot(player.velocity.clone().setY(0).normalize()), 0) / rig.list.length;
    input.keys = new Set();
    let jerk = 0, n = 0;
    for (let f = 2; f < tips.length; f++) for (let k = 0; k < tips[f].length; k++, n++) jerk += tips[f][k].clone().sub(tips[f - 1][k].clone().multiplyScalar(2)).add(tips[f - 2][k]).length();
    jerk /= n;
    return ok(jerk < 0.03 && back < -0.1, { jerk: +jerk.toFixed(4), back: +back.toFixed(3) });
  },
});

story('engine/music-renders-and-builds', {
  about: 'The soundtrack (music.js) plays both songs, and more intensity brings in more layers (louder, busier).',
  setup() { fresh({ elites: false }); },
  async play() {
    const { Music } = await import('../music.js');
    const rms = async (song, I) => {
      const ctx = new OfflineAudioContext(1, 16000 * 4, 16000), m = new Music(ctx, ctx.destination);
      m.play(song, 0.05);
      m.I = I;
      m.schedule(4);
      const d = (await ctx.startRendering()).getChannelData(0);
      let sum = 0;
      for (let i = 16000; i < d.length; i++) sum += d[i] * d[i];
      return Math.sqrt(sum / (d.length - 16000));
    };
    const quiet = await rms('drift', 0), loud = await rms('drift', 1), boss = await rms('machinery', 0.9);
    const st = G().run.musicState();
    return ok(quiet > 0.002 && loud > quiet * 1.5 && boss > 0.01 && st.song === 'drift', { quiet: +quiet.toFixed(4), loud: +loud.toFixed(4), boss: +boss.toFixed(4), song: st.song });
  },
});
