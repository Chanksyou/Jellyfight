// Stories: treasure effect words. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import { bus, PLAYER } from '../events.js';
import { CONTENT, compileTreasures } from '../content.js';
import { rollCards, RARITY, BASE_STATS, ELEMENT_UPGRADES } from '../stats.js';
import { parse } from '../kdl.js';
import { seededRandom } from '../story-random.mjs';
import { BASE_FIRE_RATE, G, V, dmgBy, fresh, give, near, ok, record, restore, roachAt, setupFight, spawn, step, story, stub, tp } from './kit.js';

// --- treasures: one story per effect word (content/treasures.kdl, TREASURE_WORDS in words.js)

story('treasures/pierce', {
  about: 'pierce (Bobby Pin): a bubble pops through up to 3 bugs in a line.',
  setup() { setupFight({ lash: false }); give('bobbyPin'); G().run.stats.bubbles = 1; [0.2, 0.25, 0.3].forEach((z) => roachAt(0, -z)); },
  play() { step(240); const hurt = G().enemies.list.filter((e) => e.hp < e.maxHp).length; return ok(hurt >= 2, { hurt }); },
});
story('treasures/pierce-splash', {
  about: 'pierce (Bobby Pin): a piercing bubble still splashes, where it first hits, so a bug beside the one it pierces takes the splash.',
  setup() { setupFight({ lash: false }); give('bobbyPin'); Object.assign(G().run.stats, { bubbles: 1, bubbleSize: 2 }); roachAt(0, -0.2); roachAt(0.02, -0.2); },   // big bubbles: a wide splash, so the bugs' own spacing can't dodge it
  play() {
    const log = record('damage_taken');
    step(120, () => dmgBy(log, 'splash').length > 0);
    const splash = dmgBy(log, 'splash').length, direct = dmgBy(log, 'bubble').length;
    return ok(splash > 0 && direct > 0, { splash, direct });
  },
});
story('treasures/golden-bubble', {
  about: 'golden-bubble (Gold Ring): every 10th bubble is golden and hits 5x.',
  setup() { setupFight({ lash: false }); give('goldRing'); roachAt(0, -0.15); },
  play() {
    const { run } = G(), opts = [];
    const blow = run.bubbles.blow.bind(run.bubbles);
    stub(run.bubbles, 'blow', (o, t, x) => { opts.push(x.golden); return blow(o, t, x); });
    step(60 * 13);
    const golden = opts.filter((g) => g === 5).length;
    return ok(opts.length >= 20 && golden === Math.floor(opts.length / 10), { blown: opts.length, golden });
  },
});
story('treasures/giant-bubble', {
  about: 'giant-bubble (Reed Stick): every 6th bubble brings a giant, slow one.',
  setup() { setupFight({ lash: false }); give('reedStick'); roachAt(0, -0.15); },
  play() {
    const { run } = G(), opts = [];
    const blow = run.bubbles.blow.bind(run.bubbles);
    stub(run.bubbles, 'blow', (o, t, x) => { opts.push(x); return blow(o, t, x); });
    step(60 * 8);
    const giants = opts.filter((x) => x.big).length, normal = opts.length - giants;
    return ok(giants >= 1 && giants === Math.floor(normal / 6) && opts.find((x) => x.big).size === 2.5, { normal, giants });
  },
});
story('treasures/element', {
  about: 'element: fire burns, lightning arcs, ice slows, acid leaves puddles (Candle, Battery, Freezer Pack, Nail Polish).',
  setup() { setupFight({ lash: false }); give('candle', 'battery', 'freezerPack', 'nailPolish'); G().run.stats.bubbles = 2; roachAt(-0.04, -0.15); roachAt(0.04, -0.15); roachAt(0.1, -0.2); },
  play() {
    const { run, enemies } = G();
    let burned = false, puddles = false, zapped = false, slowed = false;
    const zap = run.bubbles.zap.bind(run.bubbles);
    stub(run.bubbles, 'zap', (...a) => { zapped = true; return zap(...a); });
    step(60 * 6, () => {
      burned ||= run.bubbles.burning.size > 0; puddles ||= run.bubbles.puddles.length > 0;
      slowed ||= enemies.list.some((e) => e.slowT > 0);
      return burned && puddles && zapped && slowed;
    });
    return ok(burned && puddles && zapped && slowed, { burned, puddles, zapped, slowed });
  },
});
story('treasures/wind-blade', {
  about: 'Wind (Paper Fan) throws a crescent blade: it hits a bug 1.5 cm to the side of its flight line, where a plain bubble of the same size would miss.',
  setup() { setupFight({ lash: false }); roachAt(0, -0.3); },
  play() {
    const { run, player } = G(), B = run.bubbles, e = G().enemies.list[0], from = player.position.clone().setY(player.position.y + 0.03);
    const wind = B.blow(from, e, { size: 1, dmg: 1, tint: 'wind', elems: ['wind'], pierce: 2 });
    const plain = B.blow(from, e, { size: 1, dmg: 1, pierce: 1 });
    const side = wind.m.position.clone().add(V(0.015, 0, 0));
    const hits = [B.touches(wind, side, 0.005), B.touches(plain, side, 0.005)];
    B.release(wind); B.release(plain); B.list = B.list.filter((b) => b !== wind && b !== plain);
    return ok(hits[0] && !hits[1] && wind.m.userData.blade, { wind: hits[0], plain: hits[1], halfWidth: +wind.side.toFixed(4) });
  },
});
story('treasures/element-up', {
  about: 'Element upgrades change that element\'s attack: Lighter Fluid burns twice as hot, Long Matches burns 3 s longer, Birthday Cake fires two fireballs a shot; your Fire rate speeds every element attack up too.',
  setup() { setupFight({ lash: false, bubbles: true }); give('candle'); roachAt(0, -0.15); },
  play() {
    const { run, enemies } = G(), B = run.bubbles, e = enemies.list[0];
    step(2);
    const base = { ...run.mods.element.fire };
    give('lighterFluid'); give('longMatches'); give('birthdayCake');
    step(2);
    const up = run.mods.element.fire;
    B.burning.clear(); B.ignite(e, 10, up);
    const f = B.burning.get(e), burnT = f.t, burnDps = f.dps;
    // a shot: how many fireballs leave at once
    B.list.length = 0; B.elTimers.fire = 1; B.timer = 0;
    step(1);
    const fireballs = B.list.filter((b) => b.tint === 'fire').length;
    // Fire rate: shots a second scale with it (count the fire timer's progress over 1 s)
    const rateAt = (blow) => { run.stats.fireRate = blow; B.elTimers.fire = 0; let shots = 0; for (let i = 0; i < 60; i++) { const before = B.elTimers.fire; step(1); if (B.elTimers.fire < before) shots++; } return shots + B.elTimers.fire; };
    const slow = rateAt(BASE_FIRE_RATE), fast = rateAt(BASE_FIRE_RATE * 2);
    return ok(base.burn === 1 && up.burn === 2 && up.burnTime === 6 && burnT === 6 && Math.abs(burnDps - 10 * 0.17 * 2) < 1e-9 && up.count === 1 && fireballs === 2 && fast > slow * 1.7,
      { base, up, burnT, fireballs, slow: +slow.toFixed(2), fast: +fast.toFixed(2) });
  },
});
story('treasures/rarity-by-source', {
  about: 'At 0 Luck, ordinary room options roll 60/30/8/2 and elite options 40/40/15/5 across Common/Rare/Epic/Legendary. Luck still lifts rarer tiers.',
  setup() { setupFight({ lash: false }); },
  play() {
    const { run } = G(), seen = { room: {}, elite: {} };let src = 'room';
    stub(run, 'offer', (t, s, list) => { for (const c of list) seen[src][c.rarity] = (seen[src][c.rarity] || 0) + 1; });
    run.stats.luck = 0;stub(Math, 'random', seededRandom(41023));
    for (src of ['room', 'elite']) for (let i = 0; i < 1600; i++) { run.chestsOpened = 0; run.pickTreasure('', '', src); }
    const rates = { room: { ...seen.room }, elite: { ...seen.elite } }, expected = { room: { common: .6, rare: .3, epic: .08, legendary: .02 }, elite: { common: .4, rare: .4, epic: .15, legendary: .05 } };
    const matches = Object.entries(expected).every(([source, tiers]) => Object.entries(tiers).every(([tier, share]) => rates[source][tier] > 0 && Math.abs(rates[source][tier] / 4800 - share) < .025));
    const rareShare = (luck) => { stub(Math, 'random', seededRandom(41023)); run.stats.luck = luck; src = 'room'; seen.room = {}; for (let i = 0; i < 1600; i++) { run.chestsOpened = 0; run.pickTreasure('', '', 'room'); } return seen.room.rare / (seen.room.rare + seen.room.common); };
    const plain = rareShare(0), lucky = rareShare(100);run.stats.luck = 0;restore();
    return ok(matches && lucky > plain * 1.2, { rates, matches, plain, lucky });
  },
});
story('treasures/chest-rolls-have-no-minimum-rarity', {
  about: 'Either source can offer three Common treasures; no old Rare/Epic guarantee replaces the final option.',
  setup() { setupFight({ lash: false }); },
  play() {
    const { run } = G();let list = [];const allCommon = {};
    stub(run, 'offer', (t, s, l) => { list = l; });stub(Math, 'random', seededRandom(125833));run.stats.luck = 0;
    for (const source of ['room', 'elite']) for (let i = 0; i < 200; i++) {run.chestsOpened = 0;run.pickTreasure('', '', source);allCommon[source] ||= list.length === 3 && list.every(c => c.rarity === 'common');}
    restore();return ok(allCommon.room && allCommon.elite, { allCommon });
  },
});
story('treasures/pick-screen-order-and-rarity', {
  about: 'The treasure pick screen (UI.choose): name first, then the big icon, the rarity written out, the text, and a delta line when the treasure grows (Lv 1 → Lv 2, ×1 → ×2). The whole card wears its rarity: an Epic card washes and glows harder than a Common one, a Legendary gets the animated sheen. Picking pulses the won card while the other two burn away, and the modal closes a beat later.',
  setup() { setupFight({ lash: false }); },
  async play() {
    const { run } = G(), ui = run.ui;
    let picked = null;
    ui.choose('✨ A treasure!', 'Pick one to keep.', [
      { icon: '🧲', name: 'Plain Magnet', text: 'Pulls XP in.', tier: { name: 'Common', color: '#cfd6e0' } },
      { icon: '🔮', name: 'Deep Orb', text: 'Does something epic.', tier: { name: 'Epic', color: '#c77bff' }, delta: 'Lv 1 → Lv 2' },
      { icon: '👑', name: 'Old Crown', text: 'Rule changer.', tier: { name: 'Legendary', color: '#ffe9a0' }, delta: '×1 → ×2' },
    ], (c) => { picked = c; });
    const cards = [...ui.modal.querySelectorAll('.jf-card')];
    const inOrder = cards.every((el) => {
      const kids = [...el.children], at = (s) => kids.indexOf(el.querySelector(s));
      return at('.big') < at('.ic') && at('.ic') < at('.rar') && at('.rar') < at('.txt');
    });
    const tints = cards.map((el) => el.style.getPropertyValue('--tint'));
    const deltas = cards.map((el) => el.querySelector('.delta')?.textContent || null);
    const sheen = cards.map((el) => el.classList.contains('jf-sheen'));
    const sheenAnim = getComputedStyle(cards[2]).animationName;
    cards[1].click();
    const outro = cards.map((el) => el.classList.contains('jf-burn') ? 'burn' : el.classList.contains('jf-won') ? 'won' : '');
    const resolvedAtOnce = picked && picked.name === 'Deep Orb' && !ui.modal.hidden;
    step(45);   // the outro runs on the game's clock: ~0.64 s of steps closes the modal
    const closed = ui.modal.hidden;
    ui.close();
    return ok(cards.length === 3 && inOrder && tints.join() === '18%,36%,48%' && deltas.join() === ',Lv 1 → Lv 2,×1 → ×2'
      && sheen.join() === 'false,false,true' && sheenAnim.includes('jfSheen') && outro.join() === 'burn,won,burn' && resolvedAtOnce && closed,
      { tints, deltas, sheen, sheenAnim, outro, resolvedAtOnce, closed });
  },
});
story('treasures/choices-resume-mouse-during-selection', {
  about: 'Treasure and Element picks resume synchronously during the selection gesture, once, while their visual outro remains. A newer modal still blocks resume and survives the old outro.',
  setup() { setupFight({ lash: false }); },
  play() {
    const { run } = G(), ui = run.ui;
    let resumes = 0;
    stub(run, 'onResume', () => { resumes++; });
    run.pickTreasure();
    const blockedBeforePick = ui.open && !ui.closing;
    run.resume();
    const noEarlyResume = resumes === 0;
    const card = ui.modal.querySelector('.jf-card');
    card.click(); card.click();
    const treasure = resumes === 1 && ui.open && ui.closing;
    ui.tick(1);
    const closed = !ui.open && !ui.closing && resumes === 1;
    run.pickStartElement();
    ui.keyHandler({ code: 'Digit1' });
    const element = resumes === 2 && ui.closing && run.firstRun.elementChosen;
    ui.tick(1);
    const choice = { icon: '*', name: 'Next menu', text: '' };
    ui.choose('One', '', [choice], () => {
      ui.choose('Two', '', [choice], () => {});
      run.resume();
    });
    ui.modal.querySelector('.jf-card').click();
    ui.tick(1);
    const nextMenu = ui.open && !ui.closing && resumes === 2 && ui.modal.textContent.includes('Two');
    ui.close(); restore();
    return ok(blockedBeforePick && noEarlyResume && treasure && closed && element && nextMenu,
      { resumes, blockedBeforePick, noEarlyResume, treasure, closed, element, nextMenu });
  },
});
story('treasures/levels', {
  about: 'Treasures with level blocks (Fairy Lights) level up when taken again: 3 bulbs, then 4, then 5; the pick offers only the next level ("Lv 2" with what it adds), and nothing past level 3.',
  setup() { setupFight({ lash: false }); },
  play() {
    const { run } = G(), TREASURES_ALL = () => CONTENT.treasures;
    const bulbs = [], cards = [];
    // what the pick card would say: the only treasure left to offer is the Fairy Lights
    stub(run.ui, 'choose', (title, sub, list) => { cards.push(list.map((t) => `${t.name} | ${t.text} | ${t.delta || ''}`).join()); });
    const all = TREASURES_ALL();
    for (let k = 0; k < 3; k++) {
      all.forEach((t) => { if (t.id !== 'fairyLights') while (run.owned.count(t.id) < t.stack) run.owned.add(t.id); });
      run.pickTreasure(undefined, undefined, 'elite');   // Fairy Lights is Epic: an Elite's chest
      run.owned.add('fairyLights'); step(2); bulbs.push(run.mods.orbit?.count);
    }
    const before = cards.length; run.pickTreasure(undefined, undefined, 'elite');
    const offeredPast3 = cards.length > before && cards[cards.length - 1].includes('Fairy');
    const lv2 = /Lv 2/.test(cards[1]) && /four bulbs/i.test(cards[1]), lv3 = /Lv 3/.test(cards[2]) && /five .*bulbs/i.test(cards[2]);
    return ok(bulbs.join() === '3,4,5' && lv2 && lv3 && /Lv 1/.test(cards[0]) && !offeredPast3, { bulbs, cards, offeredPast3 });
  },
});
story('pickups/big-xp-drops', {
  about: 'XP comes as big drops worth 5 and small ones for the rest: 12 XP is two big drops and two small ones, and picking them all up gives 12.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const { run, xpDrops } = G(), xp0 = run.xp, lv0 = run.level;
    xpDrops.drop(near(0.05, 0, 0.01), 1, 12);
    const sizes = xpDrops.list.map((d) => d.value).sort().join();
    const bigger = xpDrops.list.find((d) => d.big)?.m.geometry.parameters.radius > xpDrops.list.find((d) => !d.big)?.m.geometry.parameters.radius;
    step(240);
    const gained = run.level > lv0 ? null : run.xp - xp0;
    return ok(sizes === '1,1,5,5' && bigger && xpDrops.list.length === 0 && (gained === null || gained === 12), { sizes, bigger, left: xpDrops.list.length, gained });
  },
});
story('treasures/mark-on-hit', {
  about: 'mark-on-hit (Sticky Note): bugs you hit are marked and take 30% more damage.',
  setup() { setupFight({ lash: false }); give('stickyNote'); roachAt(0, -0.15); },
  play() { const e = G().enemies.list[0]; step(120, () => e.markT > 0); return ok(e.markT > 0 && !!e.note, { markT: +e.markT.toFixed(2) }); },
});
story('treasures/mark-on-hit-levels', {
  about: 'mark-on-hit more= (Sticky Note level 3): marked bugs take 40% more damage, and a hit on one lands 1.4x.',
  setup() { setupFight({ lash: false }); give('stickyNote', 'stickyNote', 'stickyNote'); roachAt(0, -0.15); },
  play() {
    const e = G().enemies.list[0];
    step(120, () => e.markT > 0);
    const hp = e.hp;
    bus.emit('damage_taken', { targetId: e.id, amount: 10, source: 'test' });
    const landed = +(hp - e.hp).toFixed(3);
    return ok(e.markT > 0 && landed === 14, { markT: +e.markT.toFixed(2), landed });
  },
});
story('treasures/crit', {
  about: 'crit (Nail Clipper): about 1 hit in 5 does triple damage.',
  setup() { setupFight({ lash: false }); give('nailClipper'); roachAt(0, -0.15); },
  play() {
    const log = record('damage_taken'), pop = G().run.stats.bubbleDamage, e = G().enemies.list[0], home = e.pos.clone();
    step(60 * 20, () => { e.pos.copy(home); });   // held in range: a crit's bigger shove (knockFor) would push it out
    const hits = dmgBy(log, 'bubble'), crits = hits.filter((d) => Math.abs(d.amount - pop * 3) < 1e-6).length;
    return ok(hits.length > 20 && crits > 0 && crits < hits.length * 0.5, { hits: hits.length, crits });
  },
});
story('treasures/echo-bubble', {
  about: 'echo-bubble (Disco Ball): a bubble that pops on a bug fires again from there at the next bug close by, for 40% of its damage.',
  setup() { setupFight({ lash: false }); give('discoBall'); roachAt(0, -0.15); roachAt(0.06, -0.24); },
  play() {
    const { enemies, run } = G(), [first, second] = enemies.list, log = record('damage_taken');
    step(60 * 3, () => dmgBy(log, 'bubble').some((d) => d.targetId === second.id));
    const echoes = dmgBy(log, 'bubble').filter((d) => d.targetId === second.id), full = run.S.bubbleDamage;
    return ok(echoes.length > 0 && echoes.every((d) => Math.abs(d.amount - full * 0.4) < 1e-6), { echoes: echoes.map((d) => d.amount), full, onFirst: dmgBy(log, 'bubble').filter((d) => d.targetId === first.id).length });
  },
});
story('treasures/bubble-ring', {
  about: 'bubble-ring (Bubble Bath, every 5 s): 8 bubbles at once, spread evenly all around the jelly.',
  setup() { setupFight({ lash: false }); give('bubbleBath'); roachAt(0, -0.15); },
  play() {
    const { run } = G(), B = run.bubbles, orig = B.ring.bind(B);
    let rings = 0, out = 0;
    stub(B, 'ring', (...a) => { const n0 = B.list.length; orig(...a); rings++; out = B.list.length - n0; });
    step(60 * 6, () => rings);
    const dirs = B.list.filter((b) => !b.target).map((b) => Math.atan2(b.vel.z, b.vel.x));
    restore();
    return ok(rings === 1 && out === 8 && dirs.length === 8, { rings, out, dirs: dirs.map((a) => +a.toFixed(2)) });
  },
});
story('treasures/toy-mouse', {
  about: 'toy-mouse (Cat Toy Mouse): a big wind-up mouse trundles to the nearest bug and slams into it for 9x your power, hitting a bug beside it too (splash) but not one far off; it never trips over the jelly.',
  setup() { setupFight({ hurt: true, bubbles: false, lash: false }); give('toyMouse'); roachAt(0.25, 0.1); roachAt(0.25, 0.16); roachAt(-0.6, 0.6); },
  play() {
    const { run } = G(), [e, side, far] = G().enemies.list, log = record('damage_taken'), hard = run.power * run.mods.mouse.dmg;
    let sent = 0, bit = 0, me = 0;
    for (let k = 0; k < 4; k++) {
      run.gadgets.t.mouse = 0.001; step(1);
      if (run.gadgets.mouse.visible) sent++;
      step(60 * 4, () => log.some((d) => d.source === 'toy-mouse' && d.targetId === e.id && !d.counted && (d.counted = true)));
    }
    let splashed = 0, farHit = 0;
    for (const d of log) if (d.source === 'toy-mouse') d.targetId === PLAYER ? me++ : d.targetId === e.id && d.amount === hard ? bit++ : d.targetId === side.id ? splashed++ : d.targetId === far.id && farHit++;
    return ok(sent === 4 && bit === 4 && splashed === 4 && farHit === 0 && me === 0 && run.gadgets.mouse.scale.x > 2, { sent, bit, splashed, farHit, me });
  },
});
story('treasures/pin-on-crit', {
  about: 'pin-on-crit (Thumbtack, with a Nail Clipper\'s crits): a critical hit pins the bug in place for 0.8 s; it stops dead and doesn\'t walk while pinned (bubble hits can still nudge it).',
  setup() { setupFight({ lash: false }); give('nailClipper', 'thumbtack'); roachAt(0, -0.15, { hp: 9999 }); },
  play() {
    const { enemies } = G(), e = enemies.list[0], log = record('status_applied');
    step(60 * 10, () => log.some((s) => s.status === 'pin' && s.targetId === e.id));
    const pin = log.find((s) => s.status === 'pin' && s.targetId === e.id);
    // a pin stops the bug moving itself; bubble hits still nudge it, so stop blowing and let the
    // ones in the air land before measuring
    G().run.bubbles.timer = -1e6;
    step(15);
    const at = e.pos.clone();
    step(30);                                                       // 0.25 s to 0.75 s into the 0.8 s pin
    const moved = e.pos.distanceTo(at);
    return ok(pin?.duration === 0.8 && moved < 0.002, { pin: pin?.duration, moved: +moved.toFixed(4) });
  },
});
story('treasures/zap-on-pop', {
  about: 'zap-on-pop (Static Balloon): 20% of bubble pops snap static to another bug close by, stunning it for 0.5 s; a second Static Balloon makes it 40% (still one bug).',
  setup() { setupFight({ lash: false }); give('staticBalloon'); roachAt(0, -0.15); roachAt(0.08, -0.17); },
  play() {
    const { enemies } = G(), log = record('status_applied');
    const real = Math.random;
    Math.random = () => 0.05;                                       // every pop's 20% comes up
    step(60 * 4, () => log.some((s) => s.status === 'stun'));
    Math.random = real;
    const stuns = log.filter((s) => s.status === 'stun');
    give('staticBalloon');                                          // a second one: 40%, still one bug
    const Z = G().run.mods.popZap;
    return ok(Math.abs(Z.chance - 0.4) < 1e-9 && Z.count === 1 && stuns.length >= 1 && stuns.every((s) => s.duration === 0.5) && enemies.list.some((e) => e.id === stuns[0].targetId), { stuns: stuns.map((s) => [s.targetId, s.duration]) });
  },
});
story('treasures/extra-jumps', {
  about: 'extra-jumps (Pen Spring): no mid-air jump without it; each copy adds one, up to a quadruple jump with 3.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const { run, player } = G();
    step(2);
    const none = player.maxAirJumps;
    const per = [];
    for (let k = 0; k < 3; k++) { run.owned.add('penSpring'); step(2); per.push(player.maxAirJumps); }
    return ok(none === 0 && per.join() === '1,2,3', { none, per });
  },
});
story('treasures/landing-shockwave', {
  about: 'landing-shockwave (Cotton Ball): landing from a jump sends out a stinging ring.',
  setup() { setupFight({ bubbles: false, lash: false }); give('cottonBall'); roachAt(0.06, 0); },
  play() { const log = record('damage_taken'); G().input.jumpQueued = true; step(120); return ok(dmgBy(log, 'shockwave').length > 0, { hits: dmgBy(log, 'shockwave').length }); },
});
story('treasures/squeak-when-hit', {
  about: 'squeak-when-hit (Rubber Duck): when you get hit, nearby bugs are knocked back and hurt.',
  setup() { setupFight({ hurt: true, bubbles: false, lash: false }); give('rubberDuck'); roachAt(0.05, 0); },
  play() {
    const e = G().enemies.list[0], d0 = e.pos.distanceTo(G().player.position), log = record('damage_taken');
    G().run.iFrames = 0;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 1, source: 'story' });
    const d1 = e.pos.distanceTo(G().player.position);
    return ok(dmgBy(log, 'squeak').length === 1 && d1 > d0 + 0.03, { pushed: +(d1 - d0).toFixed(3) });
  },
});
story('treasures/when-hit', {
  about: 'when-hit (Windowsill Cactus): getting hit sprays needles at the bugs around you, at most 5 times a second.',
  setup() { setupFight({ hurt: true, bubbles: false, lash: false }); give('cactus'); roachAt(0.1, 0); roachAt(-0.12, 0.05); },
  play() {
    const { run, enemies } = G(), log = record('damage_taken');
    const hitMe = (amount, from) => { run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount, source: 'story', from }); };
    hitMe(1);
    const sprayed = new Set(dmgBy(log, 'ring').map((d) => d.targetId)).size;
    hitMe(1);                                                   // within its 0.2 s cooldown: nothing
    const again = dmgBy(log, 'ring').length;
    step(70); hitMe(1);                                         // later: again
    const later = dmgBy(log, 'ring').length;
    return ok(sprayed === 2 && again === 2 && later === 4, { sprayed, again, later });
  },
});
story('treasures/lash', {
  about: 'lash (Toaster Cord, when hit): a tentacle lashes back at the bug that hit you, for twice your Tentacle damage, and not at the other bug closer to you; at most 5 times a second.',
  setup() { setupFight({ hurt: true, bubbles: false }); give('kettleCord'); roachAt(0.12, 0); roachAt(0.16, 0.05); },   // both out of the tentacles' own reach
  play() {
    const { run, enemies } = G(), [other, biter] = enemies.list, log = record('damage_taken');
    const hitMe = () => { run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount: 2, source: 'story', from: biter.id }); };
    hitMe(); step(6);
    hitMe(); step(30);                                          // within its 0.2 s: no second lash
    const lashes = dmgBy(log, 'tentacle');
    return ok(lashes.length === 1 && lashes[0].targetId === biter.id && Math.abs(lashes[0].amount - run.S.tentacleDamage * 2) < 1e-6,
      { lashes: lashes.map((d) => [d.targetId === biter.id ? 'biter' : d.targetId === other.id ? 'other' : d.targetId, d.amount]), want: run.S.tentacleDamage * 2 });
  },
});
story('treasures/ring-slow', {
  about: 'ring slow= (Ice Cube): a cold snap slows the bugs close by for 2 s (not the ones farther out), and a slowed bug shows a frost ring under it.',
  setup() { setupFight({ bubbles: false, lash: false }); give('iceCube'); roachAt(0.1, 0); roachAt(0.4, 0); },
  play() {
    const { enemies } = G(), [close, far] = enemies.list, log = record('status_applied');
    step(60 * 6, () => log.some((s) => s.status === 'slow'));
    step(2);
    const slowed = log.filter((s) => s.status === 'slow').map((s) => s.targetId);
    return ok(slowed.includes(close.id) && !slowed.includes(far.id) && log.find((s) => s.targetId === close.id)?.duration === 2 && !(close.freezeT > 0) && close.slowRing?.visible,
      { slowed: slowed.map((id) => (id === close.id ? 'close' : id === far.id ? 'far' : id)), ring: !!close.slowRing?.visible });
  },
});
story('treasures/reflect', {
  about: 'reflect (Hand Mirror): the first hit bounces back at the bug that dealt it for 8x your power, you take none of it and can\'t be hurt for 1 s; another hit within 8 s lands as usual.',
  setup() { setupFight({ hurt: true, bubbles: false, lash: false }); give('handMirror'); roachAt(0.1, 0); },
  play() {
    const { run, enemies } = G(), e = enemies.list[0], log = record('damage_taken');
    run.health = 20;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 3, source: 'story', from: e.id });
    const back = dmgBy(log, 'reflect'), h1 = run.health, inv = run.iFrames;
    step(70);                                                   // past the 1 s, well inside the 8 s
    bus.emit('damage_taken', { targetId: PLAYER, amount: 3, source: 'story', from: e.id });
    const p = run.stage.power || 1, h2 = run.health;
    return ok(back.length === 1 && back[0].targetId === e.id && back[0].amount === run.power * run.mods.reflect.dmg && h1 === 20 && inv === 1 && Math.abs(h2 - (20 - 3 * p)) < 1e-6 && dmgBy(log, 'reflect').length === 1,
      { back: back.map((d) => d.amount), h1, inv, h2 });
  },
});
story('treasures/reflect-shockwave', {
  about: 'reflect burst (Hand Mirror): as the bounce goes off, a shockwave hits every bug within 15 cm for 3x your power and throws it back; a bug farther off is untouched.',
  setup() { setupFight({ hurt: true, bubbles: false, lash: false }); give('handMirror'); roachAt(0.05, 0); roachAt(-0.08, 0.04); roachAt(0.5, 0.5); },
  play() {
    const { run, enemies } = G(), [e, close, far] = enemies.list, log = record('damage_taken'), shoves = record('knockback');
    run.health = 20;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 3, source: 'story', from: e.id });
    const R = run.mods.reflect, by = (x) => dmgBy(log, 'reflect').filter((d) => d.targetId === x.id).map((d) => d.amount);
    const pushed = (x) => shoves.some((k) => k.targetId === x.id);
    step(2); const shell = run.gadgets.mirrorShell.visible;
    return ok(by(e)[0] === run.power * R.dmg && by(close)[0] === run.power * R.burstDmg && !by(far).length && pushed(close) && pushed(e) && !pushed(far) && shell,
      { attacker: by(e), close: by(close), far: by(far), shell });
  },
});
story('treasures/death-save', {
  about: 'death-save (Snooze Button): the first hit that would take your last Health leaves you at half your max Health instead; the next one ends the run.',
  setup() { setupFight({ hurt: true, bubbles: false, lash: false }); give('snooze'); },
  play() {
    const { run } = G();
    stub(run.hud, 'toast', () => {});
    run.health = 2; run.iFrames = 0;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 5, source: 'story' });
    const saved = run.health, phase1 = run.phase;
    run.health = 2; run.iFrames = 0;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 5, source: 'story' });
    const phase2 = run.phase;
    restore();
    return ok(Math.abs(saved - run.S.health / 2) < 1e-6 && phase1 !== 'dead' && phase2 === 'dead', { saved, max: run.S.health, phase1, phase2 });
  },
});
story('treasures/damage-taken', {
  about: 'damage-taken (Shot Glass): hits take 25% more health.',
  setup() { setupFight({ hurt: true }); give('shotGlass'); },
  play() { const { run } = G(), m0 = run.health; run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount: 4, source: 'story' }); return ok(Math.abs(m0 - run.health - 5) < 1e-9, { lost: m0 - run.health }); },
});
story('treasures/spout', {
  about: 'spout (Whale Bath Toy): stand still and you refill health.',
  setup() { setupFight({ bubbles: false, lash: false }); give('whale'); G().run.health = 10; },
  play() { step(60 * 3); return ok(G().run.health > 10.5, { health: +G().run.health.toFixed(2) }); },
});
story('treasures/heal-on-kill', {
  about: 'heal-on-kill (Baby Bottle): every bug you clear gives back a sip of health.',
  setup() { setupFight({ lash: false }); give('babyBottle'); G().run.health = 10; roachAt(0, -0.15, { still: true }); },
  play() { const e = G().enemies.list[0]; step(300, () => e.dead); return ok(e.dead && G().run.health === 10.2, { health: G().run.health }); },
});
story('treasures/burst-on-kill', {
  about: 'burst-on-kill (Bath Salt): bugs you finish off burst and hurt their neighbours.',
  setup() { setupFight({ lash: false }); give('bathSalt'); G().run.stats.bubbles = 1; spawn('hair', near(0, -0.12), { still: true, hp: 12 }); spawn('hair', near(0.035, -0.12), { still: true, hp: 9999 }); },   // small bugs, so the neighbour sits well inside the 3.5 cm burst
  play() { const log = record('damage_taken'); step(400, () => dmgBy(log, 'burst').length > 0); return ok(dmgBy(log, 'burst').length > 0, { bursts: dmgBy(log, 'burst').length }); },
});
story('treasures/xp-reach', {
  about: 'xp-reach (Fridge Magnet): XP flies to you from much farther away.',
  setup() { setupFight({ bubbles: false, lash: false }); give('magnet'); G().xpDrops.drop(near(0.18, 0, 0.01), 1, 1); },
  play() { step(120); return ok(G().xpDrops.list.length === 0, { left: G().xpDrops.list.length }); },
});
story('treasures/xp-mult', {
  about: 'xp-mult (Spilled Sugar): bugs drop 15% more XP.',
  setup() { setupFight({ lash: false }); give('sugar'); spawn('mosquito', near(0, -0.15), { still: true, hp: 1 }); },
  play() { const e = G().enemies.list[0]; step(300, () => e.dead); const total = G().xpDrops.list.reduce((a, d) => a + d.value, 0); return ok(e.dead && total === Math.round(e.T.xp * 1.15), { xp: total, base: e.T.xp }); },
});
story('treasures/card-rarity', {
  about: 'card-rarity (Game Die): level-up cards roll one rarity higher (never common).',
  setup() { setupFight(); give('dice'); },
  play() {
    let common = 0;
    for (let i = 0; i < 40; i++) for (const c of rollCards(G().run.stats, 3, G().run.mods.cardRarity)) if (c.rarity === RARITY[0]) common++;
    return ok(G().run.mods.cardRarity === 1 && common === 0, { common });
  },
});
story('treasures/stacking', {
  about: 'Stacking: a treasure without levels (Lemon Slice, stack=5) adds up per copy and stops being offered at its cap; a rule-changer (Thumbtack, stack=1) is never offered twice; with no stack= a treasure without levels stacks to 3.',
  setup() { setupFight(); give('lemon', 'lemon', 'lemon', 'lemon', 'thumbtack'); },
  play() {
    const { run } = G(), b = run.stats.bubbleDamage;
    const four = run.S.bubbleDamage;
    const byDefault = compileTreasures(parse('treasure "x" name="X" icon="x" text="x" {\n    pierce 3\n}', 't.kdl'), 't.kdl')[0].stack;
    let offered = [];
    stub(run.ui, 'choose', (title, sub, choices) => { offered = choices.map((c) => c.id); });
    const seen = new Set();
    for (let i = 0; i < 200; i++) { run.pickTreasure(); offered.forEach((id) => seen.add(id)); }
    const lemonOffered = seen.has('lemon');
    give('lemon');
    seen.clear();
    for (let i = 0; i < 200; i++) { run.pickTreasure(); offered.forEach((id) => seen.add(id)); }
    return ok(four === b + 8 && run.S.bubbleDamage === b + 10 && run.owned.count('lemon') === 5 && lemonOffered && !seen.has('lemon') && !seen.has('thumbtack') && byDefault === 3,
      { four, five: run.S.bubbleDamage, lemonOffered, afterFull: seen.has('lemon'), tack: seen.has('thumbtack'), byDefault });
  },
});
story('treasures/per', {
  about: 'per (Medicine Ball, Paperclip Chain, Roller Skate, Piggy Bank): a stat grows with another, live: Bubble damage follows max Health (+1 per 10), Tentacle damage follows Levels gained, Fire rate follows Move speed above the start, Bubble damage follows treasures found.',
  setup() { setupFight({ lash: false }); },
  play() {
    const { run } = G(), S = () => run.S;
    const bd0 = S().bubbleDamage, hp = S().health;
    give('medicineBall');
    const ball = S().bubbleDamage - bd0;                       // 25 max Health: +2.5
    run.stats.health += 10;                                    // a Health card
    const ballAfterCard = S().bubbleDamage - bd0;              // 35: +3.5
    const td0 = run.tentacleStats.tentacleDamage;
    give('paperclipChain');
    const clip0 = run.tentacleStats.tentacleDamage - td0;
    run.level += 2;
    const clip2 = run.tentacleStats.tentacleDamage - td0;      // two Levels gained: +2
    const fr0 = S().fireRate;
    give('rollerSkate');
    const skate0 = S().fireRate - fr0;
    run.stats.moveSpeed += 0.2;                                // +20% Move speed: +6% Fire rate
    const skate = (S().fireRate - fr0) / BASE_STATS.fireRate * 100;
    const bd1 = S().bubbleDamage;
    give('piggyBank');
    run.chestsOpened = 5;                                      // five treasures found: +15%
    const piggy = (S().bubbleDamage - bd1) / BASE_STATS.bubbleDamage * 100;
    const near = (a, b) => Math.abs(a - b) < 1e-6;
    return ok(near(ball, hp / 10) && near(ballAfterCard, (hp + 10) / 10) && clip0 === 0 && clip2 === 2 && skate0 === 0 && near(skate, 6) && near(piggy, 15),
      { ball, ballAfterCard, clip0, clip2, skate0, skate: +skate.toFixed(3), piggy: +piggy.toFixed(3) });
  },
});
story('treasures/while', {
  about: 'while (Dry Sock): Dry Sock adds 40% Bubble damage in the air and none once landed.',
  setup() { setupFight({ lash: false }); give('drySock'); },
  play() {
    const { run, player } = G(), bd = () => (run.S.bubbleDamage - run.stats.bubbleDamage) / BASE_STATS.bubbleDamage * 100;
    tp(3.2, 0.05, 3.0); player.position.y = 0.25; player.grounded = false; step(2);   // falling: in the air
    const air = bd(), grounded0 = player.grounded;
    step(120, () => player.grounded);
    const floor = bd();                                            // landed on the floor
    const near = (a, b) => Math.abs(a - b) < 1e-6;
    return ok(!grounded0 && near(air, 40) && near(floor, 0), { air, floor, grounded0 });
  },
});
story('treasures/while-low-health', {
  about: 'while low-health under=0.5 (Hot Water Bottle): +50% Fire rate, +40% Bubble damage and +20% Move speed only while under half your max Health; steam pours off you while it holds.',
  setup() { setupFight({ lash: false }); give('hotWaterBottle'); },
  play() {
    const { run } = G(), g = run.gadgets, pct = (k) => (run.S[k] - run.stats[k]) / BASE_STATS[k] * 100;
    const read = () => [pct('fireRate'), pct('bubbleDamage'), pct('moveSpeed')];
    run.health = run.S.health;
    const full = read(); step(5); const dry = !g.steamOn;
    run.health = run.S.health * 0.55;
    const above = read();
    run.health = run.S.health * 0.45;
    const low = read(); step(20); const steam = g.steamOn && g.looks.pools.foam.some((p) => p.alive);
    const same = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-6);
    return ok(same(full, [0, 0, 0]) && same(above, [0, 0, 0]) && same(low, [50, 40, 20]) && dry && steam, { full, above, low, dry, steam });
  },
});
story('treasures/power-bank', {
  about: 'Power Bank (element-up for every element, Legendary): the elements you own fire 50% faster; it needs no element, so it\'s never offered as an Element upgrade.',
  setup() { setupFight({ lash: false }); give('candle'); },
  play() {
    const { run } = G(), before = run.mods.element.fire.rate;
    give('powerBank');
    const after = run.mods.element.fire.rate, owns = [...run.mods.elements];
    return ok(Math.abs(after - before * 1.5) < 1e-9 && owns.join() === 'fire' && !ELEMENT_UPGRADES.includes('powerBank'), { before, after, owns });
  },
});
story('treasures/found-count-carries-over', {
  about: 'The count of treasures found (each one opened adds 1) carries into the next act with the rest of the run.',
  setup() { setupFight({ lash: false }); },
  play() {
    const { run } = G();
    stub(run.ui, 'choose', () => {});
    run.chestsOpened = 0;
    for (let i = 0; i < 4; i++) run.pickTreasure('', '', 'room');
    const counted = run.chestsOpened;
    restore();
    const carry = run.carryOver();
    run.carry = carry; run.start();
    const after = run.chestsOpened;
    run.carry = null; run.start();
    const fresh = run.chestsOpened;
    return ok(counted === 4 && carry.chestsOpened === 4 && after === 4 && fresh === 0, { counted, carried: carry.chestsOpened, after, fresh });
  },
});
story('treasures/stat', {
  about: 'stat (Lemon Slice, Coffee Bean): a treasure adds to a stat, flat or by a percent.',
  setup() { setupFight({ lash: false }); give('lemon'); give('coffeeBean'); },
  play() {
    const { run } = G(), b = run.stats;
    return ok(run.S.bubbleDamage === b.bubbleDamage + 2 && Math.abs(run.S.fireRate - b.fireRate * 1.25) < 1e-9, { pop: [b.bubbleDamage, run.S.bubbleDamage], blowRate: [b.fireRate, +run.S.fireRate.toFixed(3)] });
  },
});
story('treasures/stat-jump-tentacles', {
  about: 'stat reaches the stats nothing raised before: Jump height and the tentacles (Spring Insole, Spaghetti Strand, Tape Measure, Chopsticks, Stinging Nettle), and the lash uses them: two tentacles sting two bugs at once.',
  setup() { setupFight({ bubbles: false }); give('insole', 'spaghetti', 'tapeMeasure', 'chopsticks', 'nettle'); roachAt(0.06, 0); roachAt(-0.06, 0); },
  play() {
    const { run } = G(), b = BASE_STATS, S = run.S, T = run.tentacleStats, near = (a, c) => Math.abs(a - c) < 1e-9;
    const stats = near(S.jumpHeight, b.jumpHeight * 1.5) && T.tentacles === b.tentacles + 2
      && near(T.reach, b.reach * 1.6) && near(T.tentacleSpeed, b.tentacleSpeed * 1.4) && T.tentacleDamage === b.tentacleDamage + 4;
    const log = record('damage_taken');
    step(60 * 2);
    const stung = new Set(dmgBy(log, 'tentacle').map((d) => d.targetId)).size;
    return ok(stats && stung === 2, { jump: S.jumpHeight, T: { ...T }, stung });
  },
});
story('treasures/more-treasures', {
  about: 'more-treasures (Wind-Up Key): a treasure that turns up in the room on the schedule may bring another one 5 s after it goes (here the 20% always comes up); the extra one brings no more.',
  setup() { fresh({ treasures: true, elites: false, bubbles: false, lash: false }); give('windUpKey'); },
  play() {
    const { run } = G(), stay = run.stage.treasures.stay, first = run.treasureTimesLeft[0], real = Math.random;
    const before = run.treasureTimesLeft.length;
    Math.random = () => 0.01;
    run.t = first; run.scheduleTreasures();
    const queued = run.treasureTimesLeft.includes(first + stay + 5) && run.treasureTimesLeft.length === before;   // one used, one added
    run.roomTreasures.forEach((t) => { t.active = false; });         // the first one went
    const bonusAt = first + stay + 5, nextIsBonus = run.treasureTimesLeft[0] === bonusAt, n = run.treasureTimesLeft.length;
    run.t = bonusAt; run.scheduleTreasures();                          // the extra one turns up…
    Math.random = real;
    const noMore = run.treasureTimesLeft.length === n - 1;             // …and brings none of its own
    return ok(queued && nextIsBonus && noMore && run.roomTreasures.some((t) => t.active), { queued, nextIsBonus, noMore, left: run.treasureTimesLeft.map((x) => +x.toFixed(1)) });
  },
});
story('treasures/elite-damage', {
  about: 'elite-damage (Can Opener): hits on Elites and the boss do 15% more; ordinary bugs take the same as before.',
  setup() { setupFight({ lash: false, bubbles: false }); give('canOpener'); roachAt(0.3, 0); },
  play() {
    const { enemies } = G(), roach = enemies.list[0];
    const big = { position: near(-0.3, 0), r: 0.02, dead: false, hp: 1000, damage(a) { this.hp -= a; } };
    const e = enemies.addProxy(big);
    step(1);
    const hp0 = roach.hp;
    bus.emit('damage_taken', { targetId: e.id, amount: 10, source: 'story' });
    bus.emit('damage_taken', { targetId: roach.id, amount: 10, source: 'story' });
    big.dead = e.dead = true; enemies.list.splice(enemies.list.indexOf(e), 1); enemies.byId.delete(e.id);
    return ok(Math.abs(1000 - big.hp - 11.5) < 1e-9 && hp0 - roach.hp === 10, { elite: 1000 - big.hp, bug: hp0 - roach.hp });
  },
});
story('treasures/grow-on-kills', {
  about: 'grow-on-kills (Bandage, Dustpan): every 30 bugs you clear, +1 max health for good (and it refills); with a cap (Dustpan) a copy stops growing at +100% and a second copy grows on.',
  setup() { setupFight({ bubbles: false, lash: false }); give('bandage'); },
  play() {
    const { run } = G(), max0 = run.S.health;
    const kill = () => bus.emit('enemy_killed', { type: 'roach', pos: near(0.05, 0, 0.02), floor: G().player.position.y, r: 0.02, xp: 1 });
    for (let i = 0; i < 4; i++) kill();
    const after4 = run.S.health;
    for (let i = 0; i < 56; i++) kill();
    // with a cap (Dustpan: +0.2% Bubble damage a bug, up to +100% a copy): it stops at the cap, and a second copy grows on
    give('dustpan');
    const pct = () => (run.S.bubbleDamage - run.stats.bubbleDamage) / BASE_STATS.bubbleDamage * 100;
    for (let i = 0; i < 1100; i++) kill();
    const capped = pct();
    give('dustpan');
    for (let i = 0; i < 300; i++) kill();
    const second = pct();
    const same = (a, b) => Math.abs(a - b) < 1e-6;
    return ok(after4 === max0 && run.S.health >= max0 + 2 && same(capped, 100) && same(second, 160),
      { max0, after4, after10: run.S.health, capped: +capped.toFixed(3), second: +second.toFixed(3) });
  },
});
story('treasures/pause-lists-what-you-carry', {
  about: 'Pausing lists every treasure you carry with what it does, its copies or level, and for the ones that grow during the run what they have given so far and how near the next step is.',
  setup() { setupFight({ bubbles: false, lash: false }); give('trophy', 'lemon', 'lemon', 'bobbyPin', 'bobbyPin', 'paperclipChain', 'dustpan'); },
  async play() {
    const { run } = G(), overlay = document.getElementById('g-over');
    const kill = () => bus.emit('enemy_killed', { type: 'roach', pos: near(0.05, 0, 0.02), floor: G().player.position.y, r: 0.02, xp: 1 });
    for (let i = 0; i < 13; i++) kill();
    overlay.hidden = false;
    await Promise.resolve();                                  // the menu fills as it opens
    const card = (id) => overlay.querySelector(`.g-bag .t[data-id="${id}"]`)?.textContent || '';
    const shown = overlay.querySelector('.g-bag').getBoundingClientRect().height > 0;
    const trophy = card('trophy'), lemon = card('lemon'), pin = card('bobbyPin'), clip = card('paperclipChain'), pan = card('dustpan');
    overlay.hidden = true;
    return ok(shown && run.level === 1
      && trophy.includes('Little Trophy') && trophy.includes('So far: +0.25 Bubble damage') && trophy.includes('Next +0.25 Bubble damage in 7 bugs')
      && lemon.includes('×2') && lemon.includes('+2 bubble damage')
      && pin.includes('Level 2') && pin.includes('pierce up to 5') && !pin.includes('pierce, popping on up to 3') && pin.includes('Next level: Bubbles pierce up to 7')
      && clip.includes('Now: +0 Tentacle damage, from 0 Levels gained') && clip.includes('at Level 2')
      && pan.includes('+2.6 / +100% Bubble damage') && !pan.includes('So far:'),
    { shown, trophy, lemon, pin, clip, pan });
  },
});
story('treasures/crumb-on-kill', {
  about: 'crumb-on-kill (Meatball, Leftover): a bug you clear sometimes leaves a crumb; it drifts to you like XP and gives back 1 Health.',
  setup() { setupFight({ bubbles: false, lash: false }); give('meatball'); },
  play() {
    const { run, player } = G();
    const none = run.crumbs.list.length;
    run.health = 10;
    const real = Math.random;
    Math.random = () => 0.001;                                 // this kill's 2% comes up
    bus.emit('enemy_killed', { type: 'roach', pos: near(0.04, 0, 0.02), floor: player.position.y, r: 0.02, xp: 1 });
    Math.random = real;
    const dropped = run.crumbs.list.length;
    step(240, () => !run.crumbs.list.length);
    return ok(none === 0 && dropped === 1 && run.crumbs.list.length === 0 && Math.abs(run.health - 11) < 0.01, { dropped, health: +run.health.toFixed(2), left: run.crumbs.list.length });
  },
});
story('treasures/heal-on-hit', {
  about: 'heal-on-hit (Plastic Fangs): about 1 bubble or tentacle hit in 10 gives back 1 health.',
  setup() { setupFight({ bubbles: false, lash: false }); give('fangs'); roachAt(0.3, 0); },
  play() {
    const { run } = G(), e = G().enemies.list[0];
    let heals = 0;
    for (let i = 0; i < 300; i++) { run.health = 5; bus.emit('damage_taken', { targetId: e.id, amount: 0.01, source: 'bubble' }); if (run.health > 5) heals++; }
    run.health = 5; bus.emit('damage_taken', { targetId: e.id, amount: 0.01, source: 'zap' });
    return ok(heals > 12 && heals < 55, { heals, of: 300 });
  },
});
story('treasures/card-choices', {
  about: 'card-choices (Notebook): level-ups offer 4 cards.',
  setup() { setupFight(); give('notebook'); },
  play() {
    const { run } = G();
    let shown = 0;
    stub(run.ui, 'levelUp', (lvl, cards) => { shown = cards.length; });
    run.pendingLevels = 1;
    Object.getPrototypeOf(run).levelUp.call(run);
    return ok(shown === 4, { shown });
  },
});
story('treasures/bug-speed', {
  about: 'bug-speed (Snail Shell): bugs crawl 15% slower.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const run1 = () => { G().enemies.clear(); const e = spawn('roach', near(0.6, 0), { hp: 9999 }); const d0 = e.pos.distanceTo(G().player.position); step(40); return d0 - e.pos.distanceTo(G().player.position); };
    const plain = run1();
    give('snailShell');
    const slow = run1();
    return ok(slow / plain > 0.75 && slow / plain < 0.93, { plain: +plain.toFixed(3), slow: +slow.toFixed(3), ratio: +(slow / plain).toFixed(2) });
  },
});
story('treasures/more-bugs', {
  about: 'more-bugs (Spilled Sugar): 30% more bugs come out of the vents.',
  setup() { setupFight(); },
  play() {
    const { run, enemies } = G();
    let n = 0;
    stub(enemies, 'spawn', () => { n++; });
    stub(run, 'spawnPoint', () => near(0.4, 0));
    const count = () => { n = 0; run.spawnAcc = 0; Object.getPrototypeOf(run).spawnWaves.call(run, 200); return n; };
    const plain = count();
    give('sugar');
    const more = count();
    return ok(plain > 20 && Math.abs(more / plain - 1.3) < 0.08, { plain, more });
  },
});
story('treasures/xp', {
  about: 'xp inside every (Houseplant): every 10 s, 3 XP drips at your feet.',
  setup() { setupFight({ bubbles: false, lash: false }); give('houseplant'); },
  play() { const { run } = G(), p0 = run.purse; step(60 * 9); return ok(run.purse - p0 === 3, { gained: run.purse - p0 }); },
});
story('treasures/every', {
  about: 'every + ring (Guitar Pick): every 5 s a chord stings and pushes back everything close.',
  setup() { setupFight({ bubbles: false, lash: false }); give('guitarPick'); roachAt(0.08, 0); },
  play() {
    const log = record('damage_taken');
    step(60 * 9);
    const rings = dmgBy(log, 'ring').length, e = G().enemies.list[0];
    return ok(rings === 2 && e.pos.distanceTo(G().player.position) > 0.1, { rings, distance: +e.pos.distanceTo(G().player.position).toFixed(3) });
  },
});
story('treasures/ring', {
  about: 'ring (Bath Bomb, every 6 s): you fizz, stinging everything close for 2x your power, and nothing farther out.',
  setup() { setupFight({ bubbles: false, lash: false }); give('bathBomb'); roachAt(0.06, 0); roachAt(0.3, 0); },
  play() {
    const { run, enemies } = G(), [close, far] = enemies.list, log = record('damage_taken');
    step(60 * 7, () => dmgBy(log, 'ring').length > 0);
    const hits = dmgBy(log, 'ring');
    return ok(hits.length === 1 && hits[0].targetId === close.id && Math.abs(hits[0].amount - run.power * 2) < 1e-6, { hits: hits.map((d) => [d.targetId === close.id ? 'close' : 'far', +d.amount.toFixed(1)]) });
  },
});
story('treasures/zap', {
  about: 'zap (TV Remote): every 7 s, the 3 nearest bugs get zapped.',
  setup() { setupFight({ bubbles: false, lash: false }); give('remote'); [0.2, -0.2, 0.3, -0.3].forEach((x) => roachAt(x, 0.1)); },
  play() { const log = record('damage_taken'); step(60 * 5); return ok(dmgBy(log, 'zap').length === 3, { zapped: dmgBy(log, 'zap').length }); },
});
story('treasures/brick', {
  about: 'brick (Lego Brick): a dropped brick, twice the size, goes off when a bug steps on it and hurts every bug close by (not ones farther off).',
  setup() { setupFight({ bubbles: false, lash: false }); give('legoBrick'); },
  play() {
    const { gadgets } = G().run;
    step(60 * 3, () => gadgets.bricks.length > 0);
    const log = record('damage_taken');
    const b = gadgets.bricks[0];
    if (b) {
      const e = spawn('roach', b.m.position.clone(), { still: true, hp: 9999 }); e.pos.copy(b.m.position);
      spawn('roach', b.m.position.clone().add(V(0.015, 0, 0)), { still: true, hp: 9999 });   // close by: caught in the burst
      spawn('roach', b.m.position.clone().add(V(0.08, 0, 0)), { still: true, hp: 9999 });    // farther: not
    }
    step(5);
    return ok(!!b && b.m.scale.x === 2 && dmgBy(log, 'brick').length === 2, { bricks: gadgets.bricks.length, size: b?.m.scale.x, hits: dmgBy(log, 'brick').length });
  },
});
story('treasures/marble', {
  about: 'marble (Marble): a marble rolls out ahead of you and bowls through bugs.',
  setup() { setupFight({ bubbles: false, lash: false }); give('marble'); const P = G().player; const f = V(Math.sin(P.facing), 0, Math.cos(P.facing)); spawn('roach', P.position.clone().addScaledVector(f, 0.2), { still: true, hp: 9999 }); },
  play() { const log = record('damage_taken'); step(60 * 5); return ok(dmgBy(log, 'marble').length >= 1, { hits: dmgBy(log, 'marble').length }); },
});
story('treasures/orbit-lights', {
  about: 'orbit-lights (Fairy Lights): bulbs circle you and sting what they touch.',
  setup() { setupFight({ bubbles: false, lash: false }); give('fairyLights'); roachAt(0.1, 0); },
  play() { const log = record('damage_taken'); step(120); return ok(dmgBy(log, 'orbit-lights').length > 0, { stings: dmgBy(log, 'orbit-lights').length }); },
});
story('treasures/beam', {
  about: 'beam (Magnifying Glass): focused moonlight burns the nearest bug.',
  setup() { setupFight({ bubbles: false, lash: false }); give('magnifier'); roachAt(0.2, 0); },
  play() { const log = record('damage_taken'); step(60); return ok(dmgBy(log, 'beam').length >= 3, { burns: dmgBy(log, 'beam').length }); },
});
story('treasures/aura', {
  about: 'aura (Glow Stick): a glow around you stings anything inside it.',
  setup() { setupFight({ bubbles: false, lash: false }); give('glowStick'); roachAt(0.06, 0); },
  play() { const log = record('damage_taken'); step(90); return ok(dmgBy(log, 'aura').length >= 2, { stings: dmgBy(log, 'aura').length }); },
});

story('treasures/upgrades-show-current-effect-once', {
  about: 'An upgrade card shows the complete current effect and one level comparison. Picking it confirms its name and resulting level without repeating the description.',
  setup() { setupFight({ bubbles: false, lash: false }); give('bobbyPin'); },
  play() {
    const { run } = G(), ui = run.ui;
    const count = run.owned.count.bind(run.owned);
    stub(run.owned, 'count', (id) => id === 'bobbyPin' ? count(id) : 99);
    run.chestsOpened = 0;
    run.pickTreasure();
    const cards = [...ui.modal.querySelectorAll('.jf-card')], card = cards[0];
    const name = card?.querySelector('.big').textContent, text = card?.querySelector('.txt').textContent, delta = card?.querySelector('.delta').textContent;
    card?.click();
    const toast = ui.pop.textContent;
    const good = cards.length === 1 && name === 'Bobby Pin' && text === 'Bubbles pierce up to 5 enemies in a line.' && delta === 'Lv 1 → Lv 2'
      && toast.includes('Bobby Pin') && toast.includes('Level 2') && !toast.includes('pierce');
    step(45);
    return ok(good, { name, text, delta, toast });
  },
});

story('treasures/tuned-element-upgrades', {
  about: 'The tuned fire, lightning, ice, wind and glitter upgrades reach the live attack modifiers with their requested durations, multipliers and pierce counts.',
  setup() { setupFight({ bubbles: false, lash: false }); give('candle', 'battery', 'freezerPack', 'paperFan', 'glitter', 'longMatches', 'lighterFluid', 'copperWire', 'powerStrip', 'popsicleStick', 'hairDryer', 'deskFan', 'craftGlitter', 'glitterGlue', 'sequins'); },
  play() {
    const E = G().run.mods.element;
    const got = [E.fire.burnTime, E.fire.burn, E.lightning.chainRange, E.lightning.bolt, E.ice.pierce, E.wind.pierce, E.wind.rate, E.glitter.width, E.glitter.slow, E.glitter.rate];
    const want = [6, 2, 0.32, 2, 5, 6, 0.88 * 1.4, (0.08 / 0.026) * 1.4, 2, 1.05 * 1.4];
    return ok(got.every((v, i) => Math.abs(v - want[i]) < 1e-9), { got, want });
  },
});
story('treasures/tuned-level-effects', {
  about: 'At each level the tuned Cotton Ball, Rubber Duck, Whale Bath Toy, Guitar Pick, Bath Bomb and Sticky Note feed the requested damage, range, shove, cooldown, healing and mark bonuses into gameplay.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const got = [], want = [
      [2.5, .21, .12, 4, 1.5, .18, 2, .05, .12, 2, .3],
      [5, .21, .15, 4, 1.75, .22, 3, .07, .15, 3, .35],
      [7, .21, .2, 3, 2, .26, 4, .09, .18, 4, .4],
    ];
    for (let i = 0; i < 3; i++) {
      give('cottonBall', 'rubberDuck', 'whale', 'guitarPick', 'bathBomb', 'stickyNote');
      const M = G().run.mods, duck = M.squeaks[0], rings = M.timed.flatMap((t) => t.effects), chord = rings.find((e) => e.kind === 'ring' && e.look === 'chord'), bomb = rings.find((e) => e.kind === 'ring' && e.look === 'puff');
      got.push([M.landingShockwave.dmg, duck.radius, duck.push, duck.cooldown, M.spout.heal, chord.radius, chord.dmg, chord.push, bomb.radius, bomb.dmg, M.hits.bubbles.markMore]);
    }
    return ok(got.every((row, i) => row.every((v, j) => Math.abs(v - want[i][j]) < 1e-9)), { got, want });
  },
});


story('treasures/element-damage-and-speed', {
  about: 'Base Ice hits for 2x at 0.285 m/s, Wind for 1.5x at 1.6 m/s, and Glitter splashes for 0.4x within 8 cm at 0.4 m/s; damage scales with Bubble damage.',
  setup() { setupFight({ bubbles: false, lash: false }); give('freezerPack', 'paperFan', 'glitter'); roachAt(0, -0.18); step(2); },
  play() {
    const { run, player, enemies } = G(), B = run.bubbles, e = enemies.list[0];
    e.hp = e.maxHp = 10000;
    const near = roachAt(0.079, -0.18), far = roachAt(0.12, -0.18);
    const log = record('damage_taken'), results = [], close = (a, b) => Math.abs(a - b) < 1e-8;
    for (const D of [6, 12]) for (const [id, mult, speed] of [['ice', 2, 0.285], ['wind', 1.5, 1.6], ['glitter', 0.6, 0.4]]) {
      const stats = { ...run.S, bubbles: 1, bubbleSize: 1, bubbleDamage: D };
      B.elementVolley(id, run.mods.element[id], player.position.clone().add(V(0, 0.06, 0)), stats, run.mods);
      const b = B.list[B.list.length - 1];
      B.strike(b, e, run.mods);
      const hit = log.filter(d => d.targetId === e.id && d.source === 'bubble').at(-1);
      let splash = true;
      if (id === 'glitter') {
        b.hit.add(e); b.m.position.copy(enemies.center(e));
        near.pos.copy(e.pos).add(V(0.079, 0, 0)); far.pos.copy(e.pos).add(V(0.12, 0, 0));
        const start = log.length; B.splash(b); const hits = log.slice(start).filter(d => d.source === 'splash');
        splash = hits.some(d => d.targetId === near.id && close(d.amount, D * 0.4)) && !hits.some(d => d.targetId === far.id);
      }
      results.push({ id, D, damage: hit.amount, speed: b.speed, splash, pass: close(hit.amount, D * mult) && close(b.speed, speed) && splash });
      B.release(b, true); B.list.pop();
    }
    return ok(results.every(r => r.pass), { results });
  },
});

story('treasures/acid-vulnerability', {
  about: 'Acid puddles apply 30% vulnerability to their own ticks and other hits, expire normally, and do not weaken a stronger Sticky Note mark.',
  setup() { setupFight({ bubbles: false, lash: false }); give('nailPolish'); roachAt(0, -0.18); step(2); },
  play() {
    const { run, player, enemies } = G(), B = run.bubbles, e = enemies.list[0]; e.hp = e.maxHp = 10000;
    B.elementVolley('acid', run.mods.element.acid, player.position.clone().add(V(0, 0.06, 0)), run.S, run.mods);
    const b = B.list[B.list.length - 1]; b.m.position.copy(enemies.center(e)); b.hit.add(e); B.pop(b, e, run.S, run.mods);
    const p = B.puddles[0]; p.m.position.copy(e.pos); p.tick = 0;
    const before = e.hp; B.effects(1 / 60, run.S);
    const more = e.markMore, tick = before - e.hp;
    bus.emit('damage_taken', { targetId: e.id, amount: 10, source: 'bubble' }); const hit = before - tick - e.hp;
    bus.emit('status_applied', { targetId: e.id, status: 'mark', duration: 3, more: 0.5 });
    p.tick = 0; B.effects(1 / 60, run.S); const stronger = e.markMore;
    B.reset(); step(181);
    return ok(more === 0.3 && Math.abs(tick - 6 * 4.5 * 0.012 * 0.5 * 1.3) < 1e-8 && Math.abs(hit - 13) < 1e-8 && stronger === 0.5 && e.markT === 0, { more, tick, hit, stronger, expired: e.markT === 0 });
  },
});
