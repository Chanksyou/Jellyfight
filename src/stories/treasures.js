// Stories: treasure effect words. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import { bus, PLAYER } from '../events.js';
import { CONTENT, compileMods, compileTreasures } from '../content.js';
import { rollCards, RARITY, BASE_STATS } from '../stats.js';
import { elementParams } from '../words.js';
import { parse } from '../kdl.js';
import { seededRandom } from '../story-random.mjs';
import { BASE_FIRE_RATE, G, V, dmgBy, fresh, give, holdJelly, near, ok, record, restore, roachAt, setupFight, spawn, startVacuum, spy, steadyBugs, step, story, stub, tp, withElement } from './kit.js';

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
  about: 'golden-bubble (Gold Ring): every 10th bubble is golden (Gold Ring\'s does no extra damage: its payout is the coin).',
  setup() { setupFight({ lash: false }); give('goldRing'); roachAt(0, -0.15); },
  play() {
    const { run } = G(), opts = [];
    const blow = run.bubbles.blow.bind(run.bubbles);
    stub(run.bubbles, 'blow', (o, t, x) => { opts.push(x.golden); return blow(o, t, x); });
    step(60 * 13);
    const golden = opts.filter((g) => g === 1).length;
    return ok(opts.length >= 20 && golden === Math.floor(opts.length / 10), { blown: opts.length, golden });
  },
});
story('treasures/golden-coin', {
  about: 'golden-bubble coin= (Gold Ring) on a Fire jelly: every 10th Element volley is golden too, keeping its fire look; a bug a golden hit finishes drops a big gold XP gem worth 4x its XP; one finished by an ordinary hit drops plain XP.',
  setup() { setupFight({ bubbles: false, lash: false }); give('goldRing'); withElement('fire'); roachAt(0, -0.15); step(2); },
  play() {
    const { run } = G(), B = run.bubbles, opts = [];
    const blow = B.blow.bind(B);
    stub(B, 'blow', (o, t, x) => { opts.push(x); return blow(o, t, x); });
    const at = G().player.position.clone().setY(G().player.position.y + 0.04);
    for (let i = 0; i < 10; i++) B.elementVolley('fire', run.mods.element.fire, at, run.S, run.mods);
    const shots = opts.filter((x) => x.tint === 'fire'), gold = shots.filter((x) => x.golden);
    const kill = (golden) => { const e = roachAt(0.05, 0.05, { hp: 1 }), n = run.xpDrops.list.length; bus.emit('damage_taken', { targetId: e.id, amount: 50, source: 'story', feedback: { golden } }); return run.xpDrops.list.slice(n).reduce((s, d) => s + d.value, 0); };
    const xp = G().enemies.list[0].T.xp, coin = kill(true), plain = kill(false);
    return ok(gold.length >= 1 && gold.length <= Math.ceil(shots.length / 10) && coin >= xp * 4 && plain < xp * 4, { shots: shots.length, gold: gold.length, coin, plain, xp });
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
// the combined effects of one treasure written in these words (no run needed)
const modsOf = (src) => {
  const [t] = compileTreasures(parse(`treasure "w" name="W" icon="x" rarity="legendary" text="x" {\n${src}\n}`, 'w.kdl'), 'w.kdl');
  const m = compileMods(new Set(), [], []);
  for (const fx of t.effects) fx(m, 0);
  return m;
};
story('treasures/element-up', {
  about: 'element-up: changes one number of an element attack: some add (burnTime, count) and the rest multiply (burn), as a jelly type\'s Attack upgrades use it.',
  setup() {},
  play() {
    const m = modsOf('element-up "fire" burn=2 burnTime=3'), base = elementParams('fire');
    return ok(m.element.fire.burn === base.burn * 2 && m.element.fire.burnTime === base.burnTime + 3, { burn: m.element.fire.burn, burnTime: m.element.fire.burnTime });
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
story('treasures/rarity-by-source', {
  about: 'At 0 Luck, ordinary room options roll 60/30/8/2 and elite options 40/40/15/5 across Common/Rare/Epic/Legendary (the roll, before three of a kind). Luck still lifts rarer tiers.',
  setup() { setupFight({ lash: false }); },
  play() {
    const { run } = G(), seen = { room: {}, elite: {} };let src = 'room';
    stub(run, 'offer', () => {});
    const roll = run.rollChest.bind(run);
    stub(run, 'rollChest', (source, ...a) => { const list = roll(source, ...a); for (const c of list) seen[src][c.rarity] = (seen[src][c.rarity] || 0) + 1; return list; });
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
  about: 'Either source can roll three Common treasures; no old Rare/Epic guarantee replaces the final option (three of a kind then makes one of them Rare).',
  setup() { setupFight({ lash: false }); },
  play() {
    const { run } = G();let list = [];const allCommon = {};
    stub(Math, 'random', seededRandom(125833));run.stats.luck = 0;
    for (const source of ['room', 'elite']) for (let i = 0; i < 200; i++) {list = run.rollChest(source);allCommon[source] ||= list.length === 3 && list.every(c => c.rarity === 'common');}
    restore();return ok(allCommon.room && allCommon.elite, { allCommon });
  },
});
story('treasures/pick-screen-order-and-rarity', {
  about: 'The treasure pick screen (UI.choose): the kit card: the big icon, the rarity written out above the name, then the text, and a delta badge in the corner when the treasure grows (Lv 1 → Lv 2, ×1 → ×2). The whole card wears its rarity: an Epic card washes and glows harder than a Common one, a Legendary gets the animated sheen. Picking pulses the won card while the other two burn away, and the modal closes a beat later.',
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
      return at('.ic') < at('.rar') && at('.rar') < at('.ui-card-name') && at('.ui-card-name') < at('.ui-card-body') && el.classList.contains('ui-card');
    });
    const tints = cards.map((el) => el.style.getPropertyValue('--tint'));
    const deltas = cards.map((el) => el.querySelector('.jf-badges .ui-card-count')?.textContent || null);
    const sheen = cards.map((el) => el.classList.contains('jf-sheen'));
    const sheenAnim = getComputedStyle(cards[2], '::before').animationName;   // (the sheen is the card's ::before)
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
  about: 'Treasure picks resume synchronously during the selection gesture, once, while their visual outro remains. A newer modal still blocks resume and survives the old outro.',
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
    const choice = { icon: '*', name: 'Next menu', text: '' };
    ui.choose('One', '', [choice], () => {
      ui.choose('Two', '', [choice], () => {});
      run.resume();
    });
    ui.modal.querySelector('.jf-card').click();
    ui.tick(1);
    const nextMenu = ui.open && !ui.closing && resumes === 1 && ui.modal.textContent.includes('Two');
    ui.close(); restore();
    return ok(blockedBeforePick && noEarlyResume && treasure && closed && nextMenu,
      { resumes, blockedBeforePick, noEarlyResume, treasure, closed, nextMenu });
  },
});
story('treasures/held-key-recovers-after-focus-loss', {
  about: 'A movement key still held after a treasure focus interruption resumes on its next repeat, without another press; repeating jump never queues another jump.',
  setup() { setupFight({ lash: false }); },
  play() {
    const { run, input } = G();
    const key = (code, repeat = false) => dispatchEvent(new KeyboardEvent('keydown', { code, repeat }));
    key('KeyW');
    run.pickTreasure();
    dispatchEvent(new Event('blur'));
    const cleared = input.moveAxes().y === 0;
    run.ui.modal.querySelector('.jf-card').click();
    run.ui.tick(1);
    key('KeyW', true);
    const resumed = input.moveAxes().y === 1;
    key('Space', true);
    const noJump = !input.consumeJump();
    input.keys.clear();
    return ok(cleared && resumed && noJump, { cleared, resumed, noJump });
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
    const lv2 = /Lv 2/.test(cards[1]) && /4 bulbs/.test(cards[1]), lv3 = /Lv 3/.test(cards[2]) && /5 .*bulbs/.test(cards[2]);
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
  about: 'echo-bubble dmg=0.4: a bubble that pops on a bug fires again from there at the next bug close by, for 40% of its damage.',
  setup() { setupFight({ lash: false }); roachAt(0, -0.15); roachAt(0.06, -0.24); },
  play() {
    const undo = withWords('echo-bubble dmg=0.4');
    const { enemies, run } = G(), [first, second] = enemies.list, log = record('damage_taken');
    step(60 * 3, () => dmgBy(log, 'bubble').some((d) => d.targetId === second.id));
    const echoes = dmgBy(log, 'bubble').filter((d) => d.targetId === second.id), full = run.S.bubbleDamage;
    undo();
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
  about: 'squeak-when-hit (Rubber Duck): when you get hit, nearby bugs are knocked back and Stunned, and take no damage.',
  setup() { setupFight({ hurt: true, bubbles: false, lash: false }); give('rubberDuck'); roachAt(0.05, 0); },
  play() {
    const e = G().enemies.list[0], d0 = e.pos.distanceTo(G().player.position), log = record('damage_taken');
    G().run.iFrames = 0;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 1, source: 'story' });
    const d1 = e.pos.distanceTo(G().player.position);
    return ok(dmgBy(log, 'squeak').length === 0 && e.stunT > 0 && d1 > d0 + 0.03, { pushed: +(d1 - d0).toFixed(3), stun: e.stunT });
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
  about: 'ring slow=: a cold snap slows the bugs close by for 2 s (not the ones farther out), and frost drifts up off a slowed bug (no ring on the floor).',
  setup() { setupFight({ bubbles: false, lash: false }); roachAt(0.1, 0); roachAt(0.4, 0); },
  play() {
    const undo = withWords('every 6 {\n ring 0.16 dmg=0.5 slow=2 color="#bff4ff" show=0.6\n}');
    const { enemies } = G(), [close, far] = enemies.list, log = record('status_applied');
    step(60 * 6, () => log.some((s) => s.status === 'slow'));
    const glows = spy(G().fx.glow, 'emit'), rings = spy(G().fx, 'ring');
    step(60);
    const slowed = log.filter((s) => s.status === 'slow').map((s) => s.targetId);
    const frost = glows.filter((a) => a[1]?.getHexString?.() === '9fe4ff').length, floorRings = rings.filter((a) => a[1] === 0x9fe4ff).length;
    undo();
    return ok(slowed.includes(close.id) && !slowed.includes(far.id) && log.find((s) => s.targetId === close.id)?.duration === 2 && !(close.freezeT > 0) && frost > 0 && !floorRings,
      { slowed: slowed.map((id) => (id === close.id ? 'close' : id === far.id ? 'far' : id)), frost, floorRings });
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
  about: 'per (Medicine Ball, Paperclip Chain, Roller Skate, Piggy Bank): a stat grows with another, live: Attack damage follows max Health (+1 per 10), Tentacle damage follows Levels gained, Fire rate follows Move speed above the start, Attack damage follows treasures found.',
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
    run.chestsOpened = 20;                                     // capped at 10 treasures: +30%, not +60%
    const piggyCap = (S().bubbleDamage - bd1) / BASE_STATS.bubbleDamage * 100;
    const near = (a, b) => Math.abs(a - b) < 1e-6;
    return ok(near(ball, hp / 10) && near(ballAfterCard, (hp + 10) / 10) && clip0 === 0 && clip2 === 2 && skate0 === 0 && near(skate, 6) && near(piggy, 15) && near(piggyCap, 30),
      { ball, ballAfterCard, clip0, clip2, skate0, skate: +skate.toFixed(3), piggy: +piggy.toFixed(3), piggyCap: +piggyCap.toFixed(3) });
  },
});
story('treasures/while', {
  about: 'while (Dry Sock): Dry Sock adds 40% Attack damage in the air and none once landed.',
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
  about: 'while low-health under=0.65 (Hot Water Bottle): +50% Fire rate, +40% Attack damage and +20% Move speed only while under 65% of your max Health; steam pours off you while it holds.',
  setup() { setupFight({ lash: false }); give('hotWaterBottle'); },
  play() {
    const { run } = G(), g = run.gadgets, pct = (k) => (run.S[k] - run.stats[k]) / BASE_STATS[k] * 100;
    const read = () => [pct('fireRate'), pct('bubbleDamage'), pct('moveSpeed')];
    run.health = run.S.health;
    const full = read(); step(5); const dry = !g.steamOn;
    run.health = run.S.health * 0.7;
    const above = read();
    run.health = run.S.health * 0.45;
    const low = read(); step(20); const steam = g.steamOn && g.looks.pools.foam.some((p) => p.alive);
    const same = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-6);
    return ok(same(full, [0, 0, 0]) && same(above, [0, 0, 0]) && same(low, [50, 40, 20]) && dry && steam, { full, above, low, dry, steam });
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
    return ok(run.S.bubbleDamage === b.bubbleDamage + 2 && Math.abs(run.S.fireRate - b.fireRate * 1.15) < 1e-9, { pop: [b.bubbleDamage, run.S.bubbleDamage], blowRate: [b.fireRate, +run.S.fireRate.toFixed(3)] });
  },
});
story('treasures/level-up-kick', {
  about: 'stack-buff "level-up" (Coffee Bean): each Level-up gives +40% Fire rate for 8 s, on top of its +15%; a second Level-up restarts the time, not doubling it.',
  setup() { setupFight({ lash: false, bubbles: false }); give('coffeeBean'); },
  play() {
    const { run } = G(), b = run.stats.fireRate, rate = () => run.S.fireRate / b;
    const before = rate(); run.buff('level-up'); step(1); const kicked = rate(); run.buff('level-up'); step(1); const again = rate();
    step(60 * 8.2); const after = rate();
    return ok(Math.abs(before - 1.15) < 1e-6 && Math.abs(kicked - 1.55) < 1e-6 && Math.abs(again - 1.55) < 1e-6 && Math.abs(after - 1.15) < 1e-6, { before, kicked, again, after });
  },
});
story('treasures/shot-speed', {
  about: 'shot-speed (Drinking Straw): bubbles fly 40% faster.',
  setup() { setupFight({ lash: false, bubbles: false }); roachAt(0, -0.2); },
  play() {
    const { run, player } = G(), B = run.bubbles, at = player.position.clone().setY(player.position.y + 0.04);
    B.volley(at, run.S, run.mods); const plain = B.list.at(-1).speed;
    give('straw'); step(1); B.volley(at, run.S, run.mods); const fast = B.list.at(-1).speed;
    return ok(Math.abs(fast / plain - 1.4) < 1e-6, { plain, fast });
  },
});
story('treasures/while-unhurt', {
  about: 'while "unhurt" (Hand Cream): no Health regen from it until 4 s pass without a hit; a hit starts the wait again.',
  setup() { setupFight({ hurt: true, bubbles: false, lash: false }); give('handCream'); },
  play() {
    const { run } = G(), r0 = run.stats.regen;
    run.iFrames = 0; run.hit(1); step(2); const early = run.S.regen;
    step(60 * 4.2); const later = run.S.regen;
    run.iFrames = 0; run.hit(1); step(2); const reset = run.S.regen;
    return ok(early === r0 && Math.abs(later - r0 - 0.5) < 1e-9 && reset === r0, { r0, early, later, reset });
  },
});
story('treasures/dodge-slip', {
  about: 'dodge-slip (Odd Sock): a bug whose hit you dodge is Stunned for 0.5 s; one you didn\'t dodge isn\'t.',
  setup() { setupFight({ hurt: true, bubbles: false, lash: false }); give('sock'); roachAt(0.05, 0); },
  play() {
    const { run } = G(), e = G().enemies.list[0], real = Math.random;
    Math.random = () => 0.001; run.iFrames = 0; run.hit(1, e.id); Math.random = real;
    const slipped = e.stunT > 0; e.stunT = 0;
    Math.random = () => 0.999; run.iFrames = 0; run.hit(1, e.id); Math.random = real;
    return ok(slipped && !(e.stunT > 0), { slipped, after: e.stunT });
  },
});
story('treasures/dodge-cap', {
  about: 'Odd Socks raise the most Dodge you can have from 60% to 80% (dodge-cap), and their Dodge follows the Dodge rules, as the level-up cards do: each copy closes 15/80 of the gap to that cap (15, 27.2, 37.4%...), so five Socks stay under it; with Dodge cards on top it stops at 80, and without a Sock it still stops at 60.',
  setup() { setupFight({ lash: false }); },
  play() {
    const { run } = G(), got = [];
    run.stats.dodge = 500; const plain = run.S.dodge; run.stats.dodge = 0;   // no Sock yet: the usual 60 cap
    if (plain !== 60) return ok(false, { plain });
    for (let i = 0; i < 5; i++) { give('sock'); got.push(+run.S.dodge.toFixed(2)); }
    const shrinking = got.every((v, i) => i === 0 || v - got[i - 1] < (i === 1 ? 15 : got[i - 1] - (got[i - 2] ?? 0)));
    const cap = run.S.dodgeCap;
    run.stats.dodge = 30; const both = run.S.dodge;
    return ok(got[0] === 15 && got[1] === 27.19 && got[4] < 80 && shrinking && cap === 80 && both === 80, { got, cap, both });
  },
});
story('treasures/pick-shows-stats-now-and-after', {
  about: 'A Treasure pick card for a treasure that changes a stat says it: "Dodge 15% → 27%" (Odd Sock with one already owned), now and after one more copy; a treasure that changes no stat adds no such line.',
  setup() { setupFight({ lash: false }); give('sock'); },
  play() {
    const { run } = G(), ui = run.ui;
    const sock = CONTENT.treasures.find((t) => t.id === 'sock'), plain = CONTENT.treasures.find((t) => t.id !== 'sock' && !run.statChanges(t).length);
    const c = run.statChanges(sock), none = run.statChanges(plain);
    run.offer('Test', '', [{ ...sock, tier: { name: 'Common' }, changes: c }, { ...plain, tier: { name: 'Common' }, changes: none }]);
    const lines = [...ui.modal.querySelectorAll('.jf-card')].map((el) => el.querySelector('.jf-now')?.textContent || '');
    ui.close(); restore();
    return ok(c.length === 1 && c[0].stat === 'dodge' && c[0].from === 15 && Math.abs(c[0].to - 27.1875) < 1e-6 && lines[0] === '🍃 Dodge 15% → 27%' && !lines[1], { c, lines, plain: plain.id });
  },
});
story('treasures/rear-shot', {
  about: 'rear-shot (Bubble Wand): every volley also fires one shot straight behind you, at full Attack damage, while the ones at the bug keep theirs.',
  setup() { setupFight({ lash: false, bubbles: false }); give('bubbleWand'); roachAt(0, -0.2); },
  play() {
    const { run, player } = G(), B = run.bubbles, at = player.position.clone().setY(player.position.y + 0.04), n = B.list.length;
    B.volley(at, run.S, run.mods);
    const shots = B.list.slice(n), front = shots[0], back = shots.find((b) => b.vel.dot(front.vel) < 0);
    return ok(shots.length === 2 && !!back && Math.abs(back.dmg - run.S.bubbleDamage) < 1e-9, { shots: shots.length, back: back?.dmg, full: run.S.bubbleDamage });
  },
});
story('treasures/stat-jump-tentacles', {
  about: 'stat reaches the stats nothing raised before: Jump height and the tentacles (Spring Insole, Spaghetti Strand, Tape Measure, Chopsticks, Stinging Nettle); the lash using them is proven by the Tentacle jelly stories.',
  setup() { setupFight({ bubbles: false }); give('insole', 'spaghetti', 'tapeMeasure', 'chopsticks', 'nettle'); },
  play() {
    const { run } = G(), b = BASE_STATS, S = run.S, T = run.tentacleStats, near = (a, c) => Math.abs(a - c) < 1e-9;
    const stats = near(S.jumpHeight, b.jumpHeight * 1.5) && T.tentacles === b.tentacles + 2
      && near(T.reach, b.reach * 1.6) && near(T.tentacleSpeed, b.tentacleSpeed * 1.4) && T.tentacleDamage === b.tentacleDamage + 4;
    return ok(stats, { jump: S.jumpHeight, T: { ...T } });
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
// the run's effects plus a few words that no Treasure uses as written any more (undo() puts the real ones back)
function withWords(src) {
  const { run } = G();
  const [t] = compileTreasures(parse(`treasure "w" name="W" icon="x" text="x" {\n${src}\n}`, 'w.kdl'), 'w.kdl');
  const m = compileMods(run.owned, run.evolved || [], run.upgrades || [], run.attack ? run.jelly : null);
  for (const fx of t.effects) fx(m, 0);
  Object.defineProperty(run, 'mods', { value: m, configurable: true, writable: true });
  return () => { delete run.mods; };
}
story('treasures/grow-on-kills', {
  about: 'grow-on-kills (Bandage): every 30 bugs you clear, +1 max health for good (and it refills); with a cap (+0.2% Attack damage a bug, up to +100%) it stops at the cap.',
  setup() { setupFight({ bubbles: false, lash: false }); give('bandage'); },
  play() {
    const { run } = G(), max0 = run.S.health;
    const kill = () => bus.emit('enemy_killed', { type: 'roach', pos: near(0.05, 0, 0.02), floor: G().player.position.y, r: 0.02, xp: 1 });
    for (let i = 0; i < 4; i++) kill();
    const after4 = run.S.health;
    for (let i = 0; i < 56; i++) kill();
    // with a cap (+0.2% Attack damage a bug, up to +100%): it stops at the cap
    const undo = withWords('grow-on-kills "bubble-damage" 0.2 kills=1 percent=#true cap=100');
    const pct = () => (run.S.bubbleDamage - run.stats.bubbleDamage) / BASE_STATS.bubbleDamage * 100;
    for (let i = 0; i < 300; i++) kill();
    const part = pct();
    for (let i = 0; i < 800; i++) kill();
    const capped = pct(); undo();
    const same = (a, b) => Math.abs(a - b) < 1e-6;
    return ok(after4 === max0 && run.S.health >= max0 + 2 && same(part, 60) && same(capped, 100),
      { max0, after4, after10: run.S.health, part: +part.toFixed(3), capped: +capped.toFixed(3) });
  },
});
story('treasures/pause-lists-what-you-carry', {
  about: 'Pausing lists every treasure you carry with what it does, its copies or level, and for the ones that grow during the run what they have given so far and how near the next step is.',
  setup() { setupFight({ bubbles: false, lash: false }); give('trophy', 'lemon', 'lemon', 'bobbyPin', 'bobbyPin', 'paperclipChain'); },
  async play() {
    const { run } = G(), overlay = document.getElementById('g-over');
    const kill = () => bus.emit('enemy_killed', { type: 'roach', pos: near(0.05, 0, 0.02), floor: G().player.position.y, r: 0.02, xp: 1 });
    for (let i = 0; i < 13; i++) kill();
    overlay.hidden = false;
    await Promise.resolve();                                  // the menu fills as it opens
    const card = (id) => overlay.querySelector(`.g-bag .t[data-id="${id}"]`)?.textContent || '';
    const shown = overlay.querySelector('.g-bag').getBoundingClientRect().height > 0;
    const trophy = card('trophy'), lemon = card('lemon'), pin = card('bobbyPin'), clip = card('paperclipChain');
    overlay.hidden = true;
    return ok(shown && run.level === 1
      && trophy.includes('Little Trophy') && trophy.includes('+0.25 / +5 Attack damage') && !trophy.includes('So far:')
      && lemon.includes('×2') && lemon.includes('+2 Attack damage')
      && pin.includes('Level 2') && pin.includes('pierce up to 8') && !pin.includes('pierce up to 4') && pin.includes('Next level: Attacks pierce up to 12')
      && clip.includes('Now: +0 Tentacle damage, from 0 Levels gained') && clip.includes('at Level 2'),
    { shown, trophy, lemon, pin, clip });
  },
});
story('treasures/crumb-on-kill', {
  about: 'crumb-on-kill: a bug you clear sometimes leaves a crumb; it drifts to you like XP and gives back 1 Health.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const { run, player } = G(), undo = withWords('crumb-on-kill chance=0.1 health=1');
    const none = run.crumbs.list.length;
    run.health = 10;
    const real = Math.random;
    Math.random = () => 0.001;                                 // this kill's 2% comes up
    bus.emit('enemy_killed', { type: 'roach', pos: near(0.04, 0, 0.02), floor: player.position.y, r: 0.02, xp: 1 });
    Math.random = real;
    const dropped = run.crumbs.list.length;
    step(240, () => !run.crumbs.list.length); undo();
    return ok(none === 0 && dropped === 1 && run.crumbs.list.length === 0 && Math.abs(run.health - 11) < 0.01, { dropped, health: +run.health.toFixed(2), left: run.crumbs.list.length });
  },
});
story('treasures/leave-on-kill', {
  about: 'leave-on-kill (Dustpan, Leftover Meatball): a cleared bug sometimes leaves a dust bunny or a meatball that stays put. Close by it doesn\'t drift to you; swim onto it to pick it up. A dust bunny gives a stack of +15% Fire rate for 5 s; a meatball +3 Health and +20% Move speed for 3 s. One not picked up is gone after its time.',
  setup() { setupFight({ bubbles: false, lash: false }); give('dustpan', 'meatball'); },
  play() {
    const { run, player } = G(), real = Math.random, fire0 = run.S.fireRate, move0 = run.S.moveSpeed;
    Math.random = () => 0.001;
    bus.emit('enemy_killed', { type: 'roach', pos: near(0.06, 0, 0.02), floor: player.position.y, r: 0.02, xp: 1 });
    Math.random = real;
    const dust = run.left.dust.list[0], meat = run.left.meatball.list[0];
    step(60);
    const waits = run.left.dust.list.length === 1 && run.left.meatball.list.length === 1 && dust.pos.distanceTo(player.position) > 0.07;
    run.health = 10;
    player.position.x = dust.pos.x; player.position.z = dust.pos.z; step(20);
    player.position.x = meat.pos.x; player.position.z = meat.pos.z; step(20);
    const picked = !run.left.dust.list.length && !run.left.meatball.list.length;
    const buffed = run.S.fireRate > fire0 * 1.149 && run.S.moveSpeed > move0 * 1.19 && Math.abs(run.health - 13) < 0.05;
    Math.random = () => 0.001;
    bus.emit('enemy_killed', { type: 'roach', pos: near(0.3, 0.3, 0.02), floor: player.position.y, r: 0.02, xp: 1 });
    Math.random = real;
    step(60 * 8.5);
    const gone = !run.left.dust.list.length && !run.left.meatball.list.length;
    return ok(waits && picked && buffed && gone, { waits, picked, buffed, health: run.health, fire: run.S.fireRate / fire0, gone });
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
  setup() { setupFight({ bubbles: false, lash: false }); steadyBugs(); },
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
  about: 'ring (every 6 s): a ring round you stings everything close for 2x your power, and nothing farther out.',
  setup() { setupFight({ bubbles: false, lash: false }); roachAt(0.06, 0); roachAt(0.3, 0); },
  play() {
    const undo = withWords('every 6 first=6 {\n ring 0.12 dmg=2\n}');
    const { run, enemies } = G(), [close, far] = enemies.list, log = record('damage_taken');
    step(60 * 7, () => dmgBy(log, 'ring').length > 0);
    const hits = dmgBy(log, 'ring');
    undo();
    return ok(hits.length === 1 && hits[0].targetId === close.id && Math.abs(hits[0].amount - run.power * 2) < 1e-6, { hits: hits.map((d) => [d.targetId === close.id ? 'close' : 'far', +d.amount.toFixed(1)]) });
  },
});
story('treasures/zap', {
  about: 'zap (TV Remote): every 5 s, the 3 nearest bugs get zapped.',
  setup() { setupFight({ bubbles: false, lash: false }); give('remote'); [0.2, -0.2, 0.3, -0.3].forEach((x) => roachAt(x, 0.1)); },
  play() { const log = record('damage_taken'); step(60 * 5); return ok(dmgBy(log, 'zap').length === 3, { zapped: dmgBy(log, 'zap').length }); },
});
story('treasures/brick', {
  about: 'brick (Lego Brick): a dropped brick, three times the size, goes off when a bug steps on it and hurts every bug close by (not ones farther off).',
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
    return ok(!!b && b.m.scale.x === 3 && dmgBy(log, 'brick').length === 2, { bricks: gadgets.bricks.length, size: b?.m.scale.x, hits: dmgBy(log, 'brick').length });
  },
});
story('treasures/brick-falls', {
  about: 'brick (Lego Brick): one dropped while you are in the air falls to the floor under you instead of hanging there.',
  setup() { setupFight({ bubbles: false, lash: false }); give('legoBrick'); },
  play() {
    const { gadgets } = G().run, P = holdJelly();
    step(1);
    const floorY = P.position.y;
    P.position.y = floorY + 0.35;   // up near the top of a jump
    step(60 * 3, () => gadgets.bricks.length > 0);
    const b = gadgets.bricks[0];
    const startY = b?.m.position.y;
    step(2);
    const falling = b && !b.landed && b.m.position.y < startY;
    step(60);
    return ok(!!b && startY > floorY + 0.3 && falling && b.landed && Math.abs(b.m.position.y - floorY) < 0.01,
      { floorY, startY, y: b?.m.position.y, landed: b?.landed });
  },
});
story('treasures/brick-hurts-boss', {
  about: 'brick (Lego Brick): a boss that steps on a brick takes its hit (and the burst); an Elite does not.',
  setup() { setupFight({ bubbles: false, lash: false }); give('legoBrick'); },
  play() {
    const { gadgets } = G().run, { enemies } = G();
    step(60 * 3, () => gadgets.bricks.length > 0);
    step(60, () => gadgets.bricks[0]?.landed);
    const b = gadgets.bricks[0];
    const mk = (dx) => ({ position: b.m.position.clone().add(V(dx, 0, 0)), r: 0.02, dead: false, hp: 100, maxHp: 100, damage(a) { this.hp -= a; if (this.hp <= 0) this.dead = true; } });
    const boss = mk(0), elite = mk(0.01), bo = enemies.addProxy(boss), el = enemies.addProxy(elite); bo.boss = true;
    step(5);
    for (const x of [el, bo]) { x.dead = true; enemies.list.splice(enemies.list.indexOf(x), 1); enemies.byId.delete(x.id); }
    return ok(boss.hp < 100 && elite.hp === 100, { boss: boss.hp, elite: elite.hp });
  },
});
story('treasures/brick-hurts-vacuum', {
  about: 'brick (Lego Brick): the real Vacuum, rolling over a brick on the floor, loses Health.',
  setup() { startVacuum('charge'); give('legoBrick'); },
  play() {
    const { gadgets } = G().run, B = G().run.boss, hp = B.hp;
    const ef = G().run.mods.timed.flatMap((t) => t.effects).find((e) => e.kind === 'brick');
    const feet = B.position.clone();
    gadgets.fire(ef, { feet, center: feet.clone().setY(feet.y + 0.05), facing: 0, power: 1, mods: G().run.mods });
    step(60 * 2);
    return ok(B.hp < hp, { before: hp, after: B.hp });
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
    const name = card?.querySelector('.ui-card-name').textContent, text = card?.querySelector('.ui-card-body').textContent, delta = card?.querySelector('.ui-card-count').textContent;
    card?.click();
    const toast = ui.pop.textContent;
    const good = cards.length === 1 && name === 'Bobby Pin' && text === 'Attacks pierce up to 8 bugs.' && delta === 'Lv 1 → Lv 2'
      && toast.includes('Bobby Pin') && toast.includes('Level 2') && !toast.includes('pierce');
    step(45);
    return ok(good, { name, text, delta, toast });
  },
});

story('treasures/tuned-level-effects', {
  about: 'At each level the tuned Cotton Ball, Rubber Duck, Whale Bath Toy, Guitar Pick, Bath Bomb and Sticky Note feed the requested damage, range, shove, cooldown, healing and mark bonuses into gameplay.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const got = [], want = [
      [1.2, .25, .15, 4, 1.5, .18, 2, .05, .1, 2, .3],
      [5, .28, .18, 4, 2, .22, 3, .07, .12, 3, .35],
      [7, .3, .22, 3, 2.5, .26, 4, .09, .14, 4, .4],
    ];
    for (let i = 0; i < 3; i++) {
      give('cottonBall', 'rubberDuck', 'whale', 'guitarPick', 'bathBomb', 'stickyNote');
      const M = G().run.mods, duck = M.squeaks[0], rings = M.timed.flatMap((t) => t.effects), chord = rings.find((e) => e.kind === 'ring' && e.look === 'chord'), bomb = rings.find((e) => e.kind === 'geyser');
      got.push([M.landingShockwave.dmg, duck.radius, duck.push, duck.cooldown, M.landHeal.health, chord.radius, chord.dmg, chord.push, bomb.radius, bomb.dmg, M.hits.bubbles.markMore]);
    }
    return ok(got.every((row, i) => row.every((v, j) => Math.abs(v - want[i][j]) < 1e-9)), { got, want });
  },
});


story('treasures/element-damage-and-speed', {
  about: 'Base Ice hits for 2x at 0.285 m/s, Wind for 1.5x at 1.6 m/s, and Glitter splashes for 0.4x within 8 cm at 0.4 m/s; damage scales with Attack damage.',
  setup() { setupFight({ bubbles: false, lash: false }); withElement('ice', 'wind', 'glitter'); roachAt(0, -0.18); step(2); },
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
  setup() { setupFight({ bubbles: false, lash: false }); withElement('acid'); roachAt(0, -0.18); step(2); },
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

// --- Risk of Rain-inspired finds (v407+)
story('treasures/execute', {
  about: 'execute (Pizza Cutter): a hit that leaves a bug under 15% of its Health finishes it off; one that leaves it above that does not.',
  setup() { setupFight({ lash: false, bubbles: false }); give('pizzaCutter'); roachAt(0.2, 0, { still: true }); roachAt(-0.2, 0, { still: true }); },
  play() {
    step(1);   // the run hands its treasures to the enemies on a frame
    const [a, b] = G().enemies.list;
    bus.emit('damage_taken', { targetId: a.id, amount: a.maxHp * 0.9, source: 'story' });   // left at 10%: sliced
    bus.emit('damage_taken', { targetId: b.id, amount: b.maxHp * 0.8, source: 'story' });   // left at 20%: lives
    return ok(a.dead && !b.dead, { sliced: a.dead, left: +(b.hp / b.maxHp).toFixed(2) });
  },
});
story('treasures/execute-elites', {
  about: 'execute (Pizza Cutter): an Elite dropped under 8% is finished off; the boss never is.',
  setup() { setupFight({ lash: false, bubbles: false }); give('pizzaCutter'); },
  play() {
    step(1);
    const { enemies } = G();
    const mk = (x) => ({ position: near(x, 0), r: 0.02, dead: false, hp: 100, maxHp: 100, damage(a) { this.hp -= a; if (this.hp <= 0) this.dead = true; } });
    const elite = mk(-0.3), boss = mk(0.3), e = enemies.addProxy(elite), bo = enemies.addProxy(boss); bo.boss = true;
    bus.emit('damage_taken', { targetId: e.id, amount: 95, source: 'story' });
    bus.emit('damage_taken', { targetId: bo.id, amount: 95, source: 'story' });
    for (const x of [e, bo]) { x.dead = true; enemies.list.splice(enemies.list.indexOf(x), 1); enemies.byId.delete(x.id); }
    return ok(elite.dead && !boss.dead && boss.hp === 5, { elite: elite.hp, boss: boss.hp });
  },
});
story('treasures/fresh-damage', {
  about: 'fresh-damage (Rolling Pin): a hit on a bug above 90% Health does 50% more; once it is lower, hits do the usual.',
  setup() { setupFight({ lash: false, bubbles: false }); give('rollingPin'); spawn('mantis', near(0.2, 0), { still: true }); },
  play() {
    step(1);
    const e = G().enemies.list[0], hp0 = e.hp;
    bus.emit('damage_taken', { targetId: e.id, amount: 25, source: 'story' });
    const first = hp0 - e.hp, hp1 = e.hp;
    bus.emit('damage_taken', { targetId: e.id, amount: 10, source: 'story' });   // now under 90%
    const second = hp1 - e.hp;
    return ok(Math.abs(first - 37.5) < 1e-9 && Math.abs(second - 10) < 1e-9, { first, second });
  },
});
story('treasures/hit-less', {
  about: 'hit-less (Thimble): a hit takes 1 less Health, never under 0.5, and a hit already under 0.5 is left as it is.',
  setup() { setupFight({ hurt: true }); give('thimble'); },
  play() {
    const { run } = G(), took = (n) => { run.iFrames = 0; const h = run.health; bus.emit('damage_taken', { targetId: PLAYER, amount: n, source: 'story' }); return +(h - run.health).toFixed(6); };
    const big = took(4), small = took(1), tiny = took(0.3);
    return ok(big === 3 && small === 0.5 && tiny === 0.3, { big, small, tiny });
  },
});
story('treasures/boss-levels', {
  about: 'boss-levels (Fish Food): when an act\'s boss falls, 2 Treasures that can still level up each go up one; one at its top level, or without levels, does not.',
  setup() { setupFight({ lash: false, bubbles: false }); give('fishFood'); give('rubberDuck'); give('whale'); give('whale'); give('whale'); give('lemon'); },
  play() {
    const { run } = G();
    run.feedTreasures(run.mods.bossLevels);
    const duck = run.owned.count('rubberDuck'), whale = run.owned.count('whale'), lemon = run.owned.count('lemon');
    return ok(run.mods.bossLevels === 2 && duck === 2 && whale === 3 && lemon === 1, { duck, whale, lemon });
  },
});
story('treasures/night-light', {
  about: 'night-light with while "lit": a Level-up plugs in a night-light where you are; inside its glow you get +40% Fire rate and +0.5 Health regen, outside it you don\'t; a 4th unplugs the oldest.',
  setup() { setupFight({ lash: false, bubbles: false, levels: true }); give('nightLight'); },
  play() {
    const undo = withWords('while "lit" "fire-rate" 40 percent=#true\nwhile "lit" "health-regen" 0.5');
    const { run } = G(), gadgets = run.gadgets, rate0 = run.S.fireRate, regen0 = run.S.regen;
    run.pendingLevels = 1; run.levelUp(); run.ui.close();
    step(2);
    const litRate = run.S.fireRate, litRegen = run.S.regen;
    gadgets.lamps[0].g.position.x += 0.6; step(2);   // the lamp, not the jelly, moves away (no furniture in the way)
    const awayRate = run.S.fireRate;
    for (let i = 0; i < 3; i++) gadgets.plugIn(player.position, run.mods.nightLight);
    undo();
    return ok(Math.abs(litRate - rate0 * 1.4) < 1e-6 && Math.abs(litRegen - regen0 - 0.5) < 1e-6 && Math.abs(awayRate - rate0) < 1e-6 && gadgets.lamps.length === 3,
      { rate0, litRate, awayRate, regen0, litRegen, lamps: gadgets.lamps.length });
  },
});
story('treasures/bounty', {
  about: 'bounty (Chore List): a far-off bug gets a gold target; clearing it adds 0.25 Attack damage for good, and clearing an unmarked bug adds nothing.',
  setup() { setupFight({ lash: false, bubbles: false }); give('choreList'); roachAt(0, -0.6, { still: true }); roachAt(0, -0.1, { still: true }); },
  play() {
    const { run, enemies } = G(), gadgets = run.gadgets, dmg0 = run.S.bubbleDamage;
    step(60 * 11, () => gadgets.bountyId != null);
    const marked = enemies.list.find((e) => e.id === gadgets.bountyId), other = enemies.list.find((e) => e !== marked);
    bus.emit('damage_taken', { targetId: other.id, amount: 999, source: 'story' });
    const afterOther = run.S.bubbleDamage;
    bus.emit('damage_taken', { targetId: marked.id, amount: 999, source: 'story' });
    const after = run.S.bubbleDamage;
    return ok(!!marked && marked.pos.distanceTo(G().player.position) > 0.4 && afterOther === dmg0 && Math.abs(after - dmg0 - 0.25) < 1e-9 && gadgets.bountyId === null,
      { marked: !!marked, dmg0, afterOther, after });
  },
});
story('treasures/ghosts', {
  about: 'ghosts (Glow-in-the-Dark Star): a cleared bug can rise as a glowing ghost that flies to another bug and slams it, then fades after 8 s.',
  setup() { setupFight({ lash: false, bubbles: false }); give('glowStar'); roachAt(0.1, -0.15, { still: true, hp: 9999 }); },
  play() {
    const { run } = G(), gadgets = run.gadgets, log = record('damage_taken');
    gadgets.ghost(near(-0.05, -0.15, 0.02), run.mods.ghosts);
    step(60 * 3, () => dmgBy(log, 'ghost').length > 0);
    const hits = dmgBy(log, 'ghost').length;
    step(60 * 8);
    return ok(hits > 0 && gadgets.ghosts.length === 0, { hits, left: gadgets.ghosts.length });
  },
});
// --- Megabonk-inspired (Chan, Nov 14): Pedometer, Bloody Fangs, Pocket Vacuum
story('treasures/distance-xp', {
  about: 'distance-xp (Pedometer): every 2 m you swim gives 1 XP straight away, so 4.2 m back and forth gives 2; standing still gives none, and a jump of more than 20 cm in one frame (a room change) counts as 20 cm.',
  setup() { setupFight({ lash: false, bubbles: false }); give('pedometer'); },
  play() {
    const { run, player } = G(), x0 = player.position.x;
    step(2);
    const still0 = run.purse;
    step(60);
    const still = run.purse - still0, p0 = run.purse;
    for (let i = 0; i < 42; i++) { player.position.x = x0 + (i % 2 ? 0 : 0.1); step(1); }
    const swum = run.purse - p0, p1 = run.purse;
    run.walked = 0; player.position.x += 5; step(1);
    const jumped = run.purse - p1;
    return ok(run.mods.distanceXp.xp === 1 && still === 0 && swum === 2 && jumped === 0, { still, swum, jumped, walked: run.walked });
  },
});
story('treasures/health-drain', {
  about: 'health-drain (Bloody Fangs): Health seeps away at 1 a second, but never below 1, and the Shield is left alone (a Tentacle jelly, which has one); it also gives +25% Move speed, +50% Fire rate and one more mid-air jump.',
  setup() { setupFight({ types: 'tentacle', lash: false, bubbles: false }); },
  play() {
    const { run } = G(), was = { speed: run.S.moveSpeed, rate: run.S.fireRate, jumps: run.mods.extraJumps };
    give('bloodyFangs'); run.health = 10;
    step(1);
    const h0 = run.health, shield0 = run.shield.hp;
    step(120);
    const lost = +(h0 - run.health).toFixed(2), shieldSame = shield0 > 0 && run.shield.hp === shield0;
    run.health = 1.5; step(120);
    const floor = run.health;
    const S = run.S, ok1 = Math.abs(S.moveSpeed - was.speed * 1.25) < 1e-6 && Math.abs(S.fireRate - was.rate * 1.5) < 1e-6 && run.mods.extraJumps === was.jumps + 1;
    return ok(Math.abs(lost - 2) < 0.05 && floor === 1 && shieldSame && ok1, { lost, floor, shieldSame, speed: S.moveSpeed, rate: S.fireRate, jumps: run.mods.extraJumps, was });
  },
});
story('treasures/pocket-vacuum', {
  about: 'on-attack + whirl dmg= (Pocket Vacuum): an attack that rolls under 1 in 10 sets off a tornado at the nearest bug; one that rolls over sets off none. It sucks two bugs 25 cm apart into a huddle (under 10 cm) within 2 s, stings the bugs in it every 0.5 s, keeps to 3 at once and is gone after 4 s.',
  setup() { setupFight({ lash: false, bubbles: false }); give('pocketVacuum'); },
  play() {
    const { run } = G(), Gd = run.gadgets, log = record('damage_taken'), real = Math.random;
    const a = roachAt(0, -0.2), b = roachAt(0.25, -0.2);
    let none, one, capped;
    try {
      Math.random = () => 0.5; run.attacked(); none = Gd.whirls?.length || 0;
      Math.random = () => 0.05; run.attacked(); one = Gd.whirls.length;
      for (let i = 0; i < 5; i++) run.attacked();
      capped = Gd.whirls.length;
    } finally { Math.random = real; }
    const d0 = b.pos.distanceTo(a.pos);
    step(120);
    const d1 = b.pos.distanceTo(a.pos), stung = new Set(dmgBy(log, 'whirl').map((d) => d.targetId)).size;
    step(130);
    const gone = Gd.whirls.length === 0;
    return ok(none === 0 && one === 1 && capped === 3 && d1 < 0.1 && stung === 2 && gone, { none, one, capped, d0, d1, stung, gone });
  },
});
story('treasures/on-attack', {
  about: 'on-attack rolls once per attack for every jelly type: Normal\'s volley of bubbles, an Element shot (Fire) and a round of tentacle stings each roll it, a Tentacle round of 3 stings only once.',
  setup() {},
  play() {
    const counts = {};
    for (const type of ['normal', 'fire', 'tentacle']) {
      setupFight({ types: type });
      const { run } = G(), calls = spy(run, 'attacked'), strikes = spy(run.lash, 'strike');
      for (let i = 0; i < 3; i++) roachAt(0.05 + i * 0.02, -0.04);
      step(150);
      counts[type] = { attacks: calls.length, stings: strikes.length };
    }
    const T = counts.tentacle;
    return ok(counts.normal.attacks >= 2 && counts.fire.attacks >= 2 && T.attacks >= 2 && T.stings >= T.attacks * 2, counts);
  },
});
