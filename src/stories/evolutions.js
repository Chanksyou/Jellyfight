// Stories: evolution words. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { bus, PLAYER } from '../events.js';
import { newMods, TREASURE_WORDS, TIMED_WORDS } from '../words.js';
import { CONTENT, isRemoved, compileTreasures } from '../content.js';
import { balanceGroups, applyBalance, toggleRemoved, resetBalance } from '../balance-editor.js';
import { BASE_STATS, xpToNext, rollCards } from '../stats.js';
import { parse } from '../kdl.js';
import { buildCharacter, SPECIES } from '../character.js';
import { G, STORIES, dmgBy, evolve, fresh, give, near, ok, record, restore, roachAt, setupFight, spawn, step, story, stub } from './kit.js';

// --- evolutions (content/evolutions.kdl): one story per word they brought
story('treasures/venom', {
  about: 'venom (Box Jelly): each tentacle sting adds a venom stack (up to 5) that burns half your Tentacle damage a second per stack; Box Jelly lashes with 4 tentacles reaching twice as far.',
  setup() { setupFight({ bubbles: false }); evolve('boxJelly'); roachAt(0.13, 0); },
  play() {
    const { run } = G(), e = G().enemies.list[0], log = record('damage_taken');
    step(60 * 6);
    const venom = dmgBy(log, 'venom'), stacks = run.lash.venom.get(e)?.stacks, T = run.tentacleStats;
    return ok(T.tentacles === 4 && Math.abs(T.reach - BASE_STATS.reach * 2) < 1e-9 && venom.length > 5 && stacks === 5, { tentacles: T.tentacles, reach: T.reach, ticks: venom.length, stacks });
  },
});
story('treasures/polyps', {
  about: 'polyps (Man o\' War): two polyps circle the jelly and each blows a bubble with yours, at half damage; max Health is 20% lower.',
  setup() { setupFight({ lash: false }); evolve('manOWar'); G().run.stats.bubbles = 1; roachAt(0, -0.15); },
  play() {
    const { run } = G(), B = run.bubbles;
    let blown = 0; const orig = B.blow.bind(B); stub(B, 'blow', (...a) => { blown++; return orig(...a); });
    B.timer = 1; step(1);
    restore();                                                   // (stops records too: record after)
    const log = record('damage_taken');
    step(60 * 3, () => dmgBy(log, 'bubble').length >= 3);
    const hits = dmgBy(log, 'bubble').map((d) => +d.amount.toFixed(2)), full = run.S.bubbleDamage;
    return ok(blown === 3 && hits.some((h) => Math.abs(h - full * 0.5) < 0.01) && Math.abs(run.S.health - BASE_STATS.health * 0.8) < 1e-9 && run.adorn.pieces.polyps?.group.visible, { blown, hits, health: run.S.health });
  },
});
story('treasures/rebirth', {
  about: 'rebirth (Immortal Jelly): a killing blow makes you a polyp instead: you can\'t be hurt or attack for 5 s, then bloom back with full Health. Once an act: the next killing blow is the end.',
  setup() { setupFight({ hurt: true }); evolve('immortal'); },
  play() {
    const { run } = G(), hit = (n) => { run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount: n, source: 'story' }); };
    hit(999);
    const polyp = run.polypT > 0 && run.phase !== 'dead' && run.player.avatar.root.scale.x < 0.5;
    hit(999);                                                    // can't be hurt as a polyp
    const safe = run.phase !== 'dead';
    step(60 * 5 + 10);
    const bloomed = run.polypT === 0 && run.health === run.S.health && run.player.avatar.root.scale.x === 1;
    step(90); hit(999);
    return ok(polyp && safe && bloomed && run.phase === 'dead', { polyp, safe, bloomed, phase: run.phase });
  },
});
story('treasures/no-regen', {
  about: 'no-regen (Immortal Jelly): Health regen does nothing, even from a card.',
  setup() { setupFight({ hurt: true, bubbles: false, lash: false }); evolve('immortal'); G().run.stats.regen = 1; G().run.health = 5; },
  play() { const { run } = G(); step(120); return ok(run.S.regen === 0 && run.health === 5, { regen: run.S.regen, health: run.health }); },
});
story('treasures/dash', {
  about: 'every + ring + dash (Moon Jelly): every 2.5 s the bell pulses, stinging and pushing back bugs close by, and the jelly surges (+80% Move speed for 0.35 s).',
  setup() { setupFight({ bubbles: false, lash: false }); evolve('moonJelly'); roachAt(0.08, 0); },
  play() {
    const { run } = G(), log = record('damage_taken');
    let surge = 0;
    step(60 * 3, () => { if (run.dashT > 0) surge = Math.max(surge, run.S.moveSpeed); return dmgBy(log, 'ring').length > 0 && surge > 0; });
    return ok(dmgBy(log, 'ring').length === 1 && Math.abs(surge - BASE_STATS.moveSpeed * 1.8) < 1e-6, { rings: dmgBy(log, 'ring').length, surge });
  },
});
story('treasures/touch-sting', {
  about: 'touch-sting (Lion\'s Mane): bugs touching the jelly are stung twice a second; ones a little farther off aren\'t. +60% max Health.',
  setup() { setupFight({ bubbles: false, lash: false }); evolve('lionsMane'); roachAt(0.035, 0); roachAt(0.15, 0); },
  play() {
    const { run, enemies } = G(), [close, far] = enemies.list, log = record('damage_taken');
    step(61);
    const stings = dmgBy(log, 'touch');
    return ok(stings.length === 2 && stings.every((d) => d.targetId === close.id) && Math.abs(run.S.health - BASE_STATS.health * 1.6) < 1e-9, { stings: stings.map((d) => (d.targetId === far.id ? 'far' : 'close')), health: run.S.health });
  },
});
story('treasures/while-rooted', {
  about: 'while "rooted" (Upside-down Jelly): standing still for a second adds 80% Fire rate, 1 Health a second and 1 pierce; moving takes them away. Fronds grow on the floor while rooted.',
  setup() { setupFight({ lash: false }); evolve('upsideDown'); },
  play() {
    const { run, player } = G(), b = run.stats;
    step(30);
    const early = run.S.fireRate;
    step(60);
    const rooted = [run.S.fireRate, run.S.regen, run.S.pierce];
    const fronds = run.adorn.pieces.fronds?.group.visible;
    run.stillT = 0; player.speed = 0.1;                          // it moves
    const moving = run.S.fireRate;
    const near = (a, c) => Math.abs(a - c) < 1e-6;
    return ok(near(early, b.fireRate) && near(rooted[0], b.fireRate + BASE_STATS.fireRate * 0.8) && near(rooted[1], b.regen + 1) && rooted[2] === 1 && near(moving, b.fireRate) && fronds,
      { early, rooted, moving, fronds });
  },
});
story('evolutions/box-jelly-existing-tentacles', {
  about: 'Box Jelly brightens and thickens the current tentacles instead of adding floor-clipping strands, and a new run restores them.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const { run, player } = G(), avatar = player.avatar, rig = avatar.tentacles;
    const meshes = rig.list.map((t) => t.mesh), glow = rig.list[0].baseGlow;
    evolve('boxJelly'); step(3);
    const enhanced = rig.venom && rig.list.every((t, i) => t.mesh === meshes[i] && t.mat.emissiveIntensity > glow) && !run.adorn.pieces['venom-tips']?.group.children.length;
    run.onMainMenu();
    const clearedBeforePlay = !rig.venom;
    step(3);
    const restored = rig.list.every((t) => t.mat.emissiveIntensity === t.baseGlow);
    fresh({ bubbles: false, lash: false });
    return ok(enhanced && player.avatar === avatar && clearedBeforePlay && restored, { enhanced, clearedBeforePlay, restored, sameAvatar: player.avatar === avatar });
  },
});
story('look/box-jelly-tentacles-every-species', {
  about: 'Every species keeps its tentacle count and length with Box Jelly, glows during a Lash, and keeps thicker tubes and tips off the floor.',
  setup() {},
  play() {
    const failures = [];
    for (const body of Object.keys(SPECIES)) {
      const c = buildCharacter({ body }, 1), rig = c.tentacles, T = rig.list[0];
      c.root.position.set(2, 0.2, 3);
      c.root.rotation.y = 0.7;
      const state = { speed: 0, walkSpeed: 1, grounded: true, vy: 0 };
      c.update(0, state);
      const width = T.tip.scale.x, count = rig.count, length = rig.length;
      rig.venom = true;
      c.update(0, state);
      let good = T.tip.scale.x >= width * 2.9 && rig.count === count && rig.length === length;
      for (const phase of [null, -0.14, 0.65, 1, null]) {
        const striking = phase !== null;
        state.speed = striking ? 0.35 : 0;
        state.walkSpeed = 0.35;
        state.vel = new THREE.Vector3(0.3, 0, 0.2);
        if (striking) rig.aim(0, T.mesh.localToWorld(T.anchor.clone().setY(0)), phase, false, phase === 1 ? 1 : 0);
        else rig.aim(0, null);
        c.update(1 / 60, state);
        c.root.updateMatrixWorld(true);
        for (const t of rig.list) {
          const p = new THREE.Vector3();
          for (const mesh of [t.mesh, t.tip]) {
            const positions = mesh.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
              p.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
              good &&= p.y >= c.root.position.y;
            }
          }
          good &&= t.mat.emissiveIntensity >= t.baseGlow * 2.9;
        }
      }
      if (!good) failures.push(body);
      c.dispose();
    }
    return ok(failures.length === 0, { failures });
  },
});
story('treasures/adorn', {
  about: 'adorn: an evolution adds its piece on top of the jelly, and the player\'s own model is untouched (same meshes before and after).',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const { run, player } = G(), count = () => { let n = 0; player.avatar.root.traverse(() => n++); return n; };
    const before = count(), avatar = player.avatar;
    evolve('lionsMane'); step(2);
    const mane = run.adorn.pieces.mane?.group.visible;
    return ok(mane && player.avatar === avatar && count() === before, { mane, sameAvatar: player.avatar === avatar, before, after: count() });
  },
});
story('evolutions/one-of-each-and-carried', {
  about: 'The metamorphosis offers 3 evolutions you don\'t have yet; the one you pick goes with the run into the next act (and shows in the HUD).',
  setup() { setupFight(); },
  play() {
    const { run } = G();
    run.evolved.push('boxJelly');
    let offered = [];
    stub(run.ui, 'choose', (t, s, choices) => { offered = choices.map((c) => c.id); });
    run.metamorph();
    restore();
    const carry = run.carryOver();
    return ok(offered.length === 3 && !offered.includes('boxJelly') && carry.evolved.includes('boxJelly'), { offered, carried: carry.evolved });
  },
});
story('dev/test-kit', {
  about: 'The dev test kit: a new test run has no waves and you can\'t die; + and − add and take away treasure copies, levels and evolutions; it spawns a pack to try them on; the game holds still while it\'s open.',
  setup() { fresh(); },
  play() {
    const { run } = G(), kit = window.kit, tap = (sel) => kit.el.querySelector(sel).click();
    kit.show(run, {});
    tap('[data-k="new"]');
    const calm = run.devCalm && run.devGod;
    const row = (id, k) => tap(`.row[data-id="${id}"] [data-k="${k}"]`);
    row('lemon', 'plus'); row('lemon', 'plus'); row('lemon', 'minus');
    row('bobbyPin', 'plus'); row('bobbyPin', 'plus');
    row('boxJelly', 'plus');
    const t0 = run.t; G().GAME.step(1 / 60); const held = run.t === t0;
    tap('[data-k="pack"]');
    const bugs = G().enemies.list.filter((e) => e.type === 'roach').length;
    run.health = 1; run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount: 50, source: 'story' });
    const alive = run.health >= 1 && run.phase !== 'dead';
    const got = { lemon: run.owned.count('lemon'), pin: run.owned.count('bobbyPin'), evolved: [...run.evolved], tentacles: run.tentacleStats.tentacles };
    kit.hide();
    return ok(calm && got.lemon === 1 && got.pin === 2 && got.evolved.join() === 'boxJelly' && got.tentacles === 4 && held && bugs === 10 && alive, { calm, ...got, held, bugs, alive });
  },
});
story('dev/balance-editor', {
  about: 'The dev balance editor: a new number for a bug, a treasure or a boss recompiles the content at once: the next bug spawns with the new Health (one already alive keeps its own), a treasure you hold applies its new numbers, a boss skill the boss is fighting with takes its new number, an elite skill takes its new number, the XP curve and a card amount change what the next level-up offers, removing an elite or a card takes it out of the run and the offers, the panel lists every bug, treasure, boss, elite and level-up with its numbers, and Reset puts the file values back and restores everything removed.',
  setup() { fresh(); },
  play() {
    const { run } = G(), S = () => run.S, groups = balanceGroups();
    const field = (kind, id, label) => groups.find((g) => g.kind === kind && g.id === id).fields.find((f) => f.label === label);
    const panel = window.tuner; panel.show(run, {});
    const rows = panel.el.querySelectorAll('.row').length;
    const described = panel.el.querySelector('.row[data-id="coffeeBean"]').textContent.includes('Bubbles blow 25% faster.');
    panel.hide();
    const first = spawn('roach', near(0.3, 0), { still: true });
    const hp0 = first.hp;
    field('bug', 'roach', 'hp').set(12); applyBalance(run);
    const second = spawn('roach', near(-0.3, 0), { still: true });
    give('coffeeBean');
    const fr1 = S().fireRate;
    field('treasure', 'coffeeBean', 'stat amount').set(50); applyBalance(run);
    const fr2 = S().fireRate;
    const bossDmg0 = CONTENT.bosses.vacuum.skills.charge.dmg;
    field('boss', 'vacuum', 'charge dmg').set(9); applyBalance(run);
    const bossDmg1 = CONTENT.bosses.vacuum.skills.charge.dmg;
    const mugDmg0 = CONTENT.elites.mug.skills.coffee.dmg;
    field('elite', 'mug', 'coffee dmg').set(5); applyBalance(run);
    const mugDmg1 = CONTENT.elites.mug.skills.coffee.dmg;
    const xp0 = xpToNext(2);
    field('levelup', 'xp', 'growth').set(2); applyBalance(run);
    const xp1 = xpToNext(2);
    const card0 = CONTENT.levelups.cards.bubbleDamage.amounts[1];
    field('levelup', 'bubbleDamage', 'rare').set(4); applyBalance(run);
    const card1 = CONTENT.levelups.cards.bubbleDamage.amounts[1];
    toggleRemoved(groups.find((g) => g.removeKey === 'elite:mug'));
    toggleRemoved(groups.find((g) => g.removeKey === 'card:health'));
    const mugRemoved = isRemoved('elite', 'mug');
    let healthOffered = false;
    for (let i = 0; i < 300 && !healthOffered; i++) healthOffered = rollCards(S(), 3).some((c) => c.stat === 'health');
    resetBalance(run);
    const third = spawn('roach', near(0, 0.3), { still: true });
    const fr3 = S().fireRate;
    const bossDmg2 = CONTENT.bosses.vacuum.skills.charge.dmg;
    const restored = !isRemoved('elite', 'mug') && !isRemoved('card', 'health')
      && CONTENT.elites.mug.skills.coffee.dmg === 3 && xpToNext(2) === xp0 && CONTENT.levelups.cards.bubbleDamage.amounts[1] === card0;
    return ok(rows > 100 && described && hp0 === 25 && second.hp === 12 && first.hp === 25 && fr2 > fr1 && Math.abs(fr3 - fr1) < 1e-9 && third.hp === 25 && bossDmg0 === 4 && bossDmg1 === 9 && bossDmg2 === 4
      && mugDmg0 === 3 && mugDmg1 === 5 && xp0 === 6 && xp1 === 8 && card0 === 2 && card1 === 4 && mugRemoved && !healthOffered && restored,
      { rows, described, hp0, second: second.hp, first: first.hp, fr1, fr2, fr3, third: third.hp, bossDmg0, bossDmg1, bossDmg2, mugDmg0, mugDmg1, xp0, xp1, card0, card1, mugRemoved, healthOffered, restored });
  },
});
story('dev/balance-editor-hints', {
  about: 'Every number of every bug, treasure and evolution in the balance editor has a short note on what it does (from its word\'s doc, or the file\'s own key), and tapping a number in an open row shows that note in the row\'s one hint line: Cockroach chase speed says it walks at that many m/s.',
  setup() { fresh(); },
  play() {
    const groups = balanceGroups().filter((g) => ['bug', 'treasure', 'evolution'].includes(g.kind));
    const bare = groups.flatMap((g) => g.fields.filter((f) => !f.hint).map((f) => `${g.id} ${f.label}`));
    const panel = window.tuner; panel.show(G().run, {});
    panel.el.querySelector('.row[data-id="roach"] .head').click();
    const row = panel.el.querySelector('.row[data-id="roach"]');
    const before = row.querySelector('.hint').textContent;
    const input = [...row.querySelectorAll('.fld')].find((l) => l.textContent.startsWith('chase speed')).querySelector('input');
    input.focus();
    const after = row.querySelector('.hint').textContent, bold = row.querySelector('.hint b')?.textContent;
    panel.hide();
    return ok(groups.length > 50 && !bare.length && /tap a number/i.test(before) && /walks straight at you at speed m\/s/i.test(after) && bold === 'speed',
      { groups: groups.length, bare: bare.slice(0, 8), before, after, bold });
  },
});
story('hud/treasure-timers', {
  about: 'Treasures show big in the HUD, and a timed one wears a clock face: Guitar Pick (every 5 s) greys out and its dark wedge shrinks as the chord comes round, lighting up when it goes off; Snooze Button stays lit until it saves you, then greys out for good; one with no timer (Lemon Slice) has no face.',
  setup() { setupFight({ hurt: true, bubbles: false, lash: false }); give('guitarPick', 'snooze', 'lemon'); },
  play() {
    const { run } = G(), span = (id) => document.querySelector(`#hud .items span[data-id="${id}"]`), cd = (id) => +span(id).style.getPropertyValue('--cd');
    step(2);
    const big = span('lemon').getBoundingClientRect().width >= 26;
    const a = cd('guitarPick'); step(60); const b = cd('guitarPick');
    const counting = span('guitarPick').classList.contains('wait') && b < a;
    step(60 * 5, () => cd('guitarPick') > 0.9);                      // it went off: the wait starts over
    const went = cd('guitarPick') > 0.9;
    const snoozeReady = span('snooze').classList.contains('timed') && !span('snooze').classList.contains('wait');
    run.health = 1; run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount: 5, source: 'story' }); step(2);
    const spent = span('snooze').classList.contains('spent');
    const plain = !span('lemon').classList.contains('timed');
    return ok(big && counting && went && snoozeReady && spent && plain, { big, a, b, counting, went, snoozeReady, spent, plain });
  },
});
story('vocabulary/every-treasure-word-documented-used-and-proven', {
  about: 'Every treasure word has a description, is used by some treasure, and has a treasures/ story.',
  setup() {},
  play() {
    const users = [...CONTENT.treasures, ...CONTENT.evolutions];   // evolutions use the same words
    const used = new Set(users.flatMap((t) => t.vocabulary));
    const usedTimed = new Set();
    for (const t of users) for (const fx of t.effects) { const m = newMods(); try { fx(m); } catch {} for (const T of [...m.timed, ...m.onHurt]) for (const ef of T.effects) usedTimed.add(ef.kind); }
    const problems = [];
    for (const [w, def] of Object.entries(TREASURE_WORDS)) {
      if (!def.doc) problems.push(`${w}: no doc`);
      if (!used.has(w)) problems.push(`${w}: no treasure uses it`);
      if (!STORIES['treasures/' + w]) problems.push(`${w}: no treasures/${w} story`);
    }
    for (const [w, def] of Object.entries(TIMED_WORDS)) {
      if (!def.doc) problems.push(`${w}: no doc`);
      if (!usedTimed.has(w)) problems.push(`${w}: no treasure uses it`);
      if (!STORIES['treasures/' + w]) problems.push(`${w}: no treasures/${w} story`);
    }
    return ok(!problems.length && CONTENT.treasures.length >= 40, { problems, treasures: CONTENT.treasures.length });
  },
});
story('content/treasure-mistakes-are-caught', {
  about: 'A typo in treasures.kdl names the file, line and problem, and so does breaking a stacking rule (stack= on a treasure with levels, more than 5, a Legendary or element that stacks, an element that isn\'t Legendary, an unknown rarity).',
  setup() {},
  play() {
    const tryIt = (src) => { try { compileTreasures(parse(src, 'test.kdl'), 'test.kdl'); return null; } catch (e) { return e.message; } };
    const unknown = tryIt('treasure "x" name="X" icon="x" text="x" {\n    pierce 3\n    sparkle\n}');
    const element = tryIt('treasure "x" name="X" icon="x" text="x" {\n    element "plasma"\n}');
    const block = tryIt('treasure "x" name="X" icon="x" text="x" {\n    every 5 {\n        explode\n    }\n}');
    // the stacking rules: no stack= on a treasure with levels, at most 5, Legendary and elements one of a kind
    const levelled = tryIt('treasure "x" name="X" icon="x" text="x" stack=2 {\n    pierce 3\n    level 2 text="y" {\n        pierce 4\n    }\n}');
    const tooMany = tryIt('treasure "x" name="X" icon="x" text="x" stack=6 {\n    pierce 3\n}');
    const legendStack = tryIt('treasure "x" name="X" icon="x" text="x" rarity="legendary" stack=2 {\n    pierce 3\n}');
    const plainElement = tryIt('treasure "x" name="X" icon="x" text="x" rarity="rare" {\n    element "fire"\n}');
    const badTier = tryIt('treasure "x" name="X" icon="x" text="x" rarity="mythic" {\n    pierce 3\n}');
    const fine = tryIt('treasure "x" name="X" icon="x" text="x" stack=5 {\n    pierce 3\n}');
    const rules = /levels, so it doesn't take stack=/.test(levelled) && /stack=6 is too many/.test(tooMany) && /one of a kind/.test(legendStack)
      && /is an element, so it's rarity="legendary"/.test(plainElement) && /rarity= must be one of common, rare, epic, legendary/.test(badTier) && fine === null;
    const good = /test\.kdl:3: unknown word "sparkle"/.test(unknown) && /test\.kdl:2: element must be one of/.test(element) && /test\.kdl:3: unknown word "explode"/.test(block) && rules;
    return ok(good, { unknown, element, block, levelled, tooMany, legendStack, plainElement, badTier, fine });
  },
});
