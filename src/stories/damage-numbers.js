import { bus } from '../events.js';
import { juice } from '../juice.js';
import { sfx } from '../sfx.js';
import { G, V, offs, ok, record, roachAt, setupFight, spy, step, story, stub } from './kit.js';

function setup() { setupFight({ bubbles: false, lash: false }); roachAt(0, -0.18); step(2); G().run.fx.clear(); }
const active = fx => fx.nums.filter(n => n.alive);

story('feedback/elemental-crits', {
  about: 'Real elemental projectile crits preserve their element and crit marker after armor/mark adjustments, without changing damage.',
  setup,
  play() {
    const { run, enemies, player } = G(), fx = run.fx, e = enemies.list[0], B = run.bubbles, mods = run.mods, hits = record('enemy_hit');
    mods.hits.bubbles.crit = { chance: 1, mult: 3 }; e.armor = 0.25; e.markT = 3; e.markMore = 0.5;
    const receipts = [];
    for (const element of ['fire', 'ice', 'lightning', 'acid', 'wind', 'glitter']) {
      fx.clear();   // isolated hits retain each Element's identity; mixed bursts are checked below
      const b = B.blow(player.position.clone().add(V(0, 0.06, 0)), e, { size: 1, dmg: 2, tint: element, elems: [element], ep: mods.element[element] });
      B.strike(b, e, mods);
      const n = active(fx).find(n => n.crit);
      receipts.push(n && { element: n.element, amount: n.amount, tag: n.tag.style.display === '' && n.tag.textContent === 'CRIT', color: n.el.style.color });
    }
    const expected = 2 * 3 * 0.75 * 1.5;
    const correct = receipts.every(n => n && n.tag && n.color !== '' && Math.abs(n.amount - expected) < 1e-6);
    const colors = new Set(receipts.map(n => n?.color));
    return ok(correct && colors.size === 6 && hits.slice(0, 6).every(h => h.feedback.crit && h.feedback.element && Math.abs(h.amount - expected) < 1e-6), { correct, colors: colors.size, receipts });
  },
});

story('feedback/crit-lands-harder', {
  about: 'A real crit lands harder than a hit without changing damage: a shing, a --feel-crit shake with no hit-stop, a number tagged CRIT that slams in at about twice its size inside a star burst, then settles; Reduce Effects keeps the CRIT tag but drops the burst and the slam.',
  setup,
  play() {
    const { run, enemies, player } = G(), fx = run.fx, e = enemies.list[0], B = run.bubbles, mods = run.mods;
    const shings = spy(sfx, 'crit'), feels = spy(juice, 'feel');
    stub(juice, 'calm', false); stub(fx, 'reducedMotion', { matches: false });
    const strike = (chance) => { mods.hits.bubbles.crit = { chance, mult: 3 }; B.strike(B.blow(player.position.clone().add(V(0, 0.06, 0)), e, { size: 1, dmg: 2 }), e, mods); };
    juice.stop = 0; strike(0); fx.update(0.01);
    const plain = active(fx)[0], hit = plain.amount, quiet = !shings.length && !feels.some(f => f[0] === 'crit') && plain.flare.style.display === 'none';
    fx.clear(); strike(1); fx.update(0.01);
    const n = active(fx).find(x => x.crit), slam = +/scale\(([\d.]+)/.exec(n.el.style.transform)[1];
    const burst = n.flare.style.display === '' && n.tag.style.display === '' && n.tag.textContent === 'CRIT' && n.el.style.fontStyle === 'italic';
    const felt = shings.length === 1 && feels.some(f => f[0] === 'crit') && juice.stop === 0 && Math.abs(n.amount - hit * 3) < 1e-6;
    fx.update(0.3);
    const settled = n.flare.style.display === 'none' && /scale\(1, 1\)/.test(n.el.style.transform);
    fx.clear(); stub(fx, 'reducedMotion', { matches: true }); strike(1); fx.update(0.01);
    const m = active(fx).find(x => x.crit), calm = m.flare.style.display === 'none' && m.tag.style.display === '' && m.el.style.transform.includes('scale(1, 1)');
    return ok(quiet && burst && slam > 1.7 && felt && settled && calm, { quiet, burst, slam, felt, settled, calm });
  },
});

story('feedback/multiattack-one-receipt', {
  about: 'Rapid attacks share one direct-hit total per enemy, preserve crit emphasis, and replace the previous burst instead of spreading more labels. Gameplay damage is unchanged.',
  setup,
  play() {
    const { run, enemies } = G(), fx = run.fx, e = enemies.list[0], hp = e.hp;
    const hit = (amount, feedback = {}, targetId = e.id) => bus.emit('damage_taken', { targetId, amount, source: 'bubble', feedback });
    for (let i = 0; i < 12; i++) hit(2, { element: i % 2 ? 'lightning' : 'ice', crit: i === 5 });
    const receipt = active(fx).find(n => !n.tick);
    const born = receipt.born;
    const combined = active(fx).length === 1 && receipt.amount === 24 && receipt.element === 'mixed' && receipt.crit && receipt.glyph.textContent === '24' && receipt.tag.style.display === '' && hp - e.hp === 24;
    fx.update(0.1); hit(3);
    const stable = receipt.amount === 27 && receipt.t === 0.1 && receipt.born === born;
    fx.update(fx.numberLook.hitWindow); hit(4);
    const next = active(fx).length === 1 && active(fx)[0] === receipt && receipt.amount === 4 && !receipt.crit;
    const other = roachAt(0.1, -0.18); hit(9, {}, other.id);
    const separate = active(fx).length === 2 && active(fx).find(n => n.targetId === other.id).amount === 9;
    let bounded = true;
    for (let i = 0; i < 60; i++) {
      fx.update(0.05); hit(1);
      bounded &&= active(fx).filter(n => n.targetId === e.id && !n.tick).length === 1 && receipt.amount <= 10;
    }
    fx.update(fx.numberLook.life + 0.01);
    return ok(combined && stable && next && separate && bounded && !receipt.alive, { combined, stable, next, separate, bounded, expired: !receipt.alive });
  },
});

story('feedback/sting-and-proxy-crits', {
  about: 'Sting crits and proxy damage carry explicit metadata, including elite damage scaling.',
  setup,
  play() {
    const { run, enemies, player } = G(), e = enemies.list[0], fx = run.fx;
    run.lash.land({ hits: { crit: { chance: 1, mult: 3 } }, target: e, dmg: 2 }, player.position, enemies.center(e));
    const sting = active(fx).some(n => n.crit && n.amount === 6 && !n.element);
    const before = enemies.eliteDamage; offs.push(() => { enemies.eliteDamage = before; }); enemies.eliteDamage = 2;
    const proxy = { position: player.position.clone(), r: 0.03, damage(amount, color, feedback) { fx.number(this.position, amount, color, 16, feedback); } };
    const p = enemies.addProxy(proxy);
    bus.emit('damage_taken', { targetId: p.id, amount: 4, source: 'bubble', feedback: { crit: true, element: 'ice' } });
    const forwarded = active(fx).some(n => n.targetId === p.id && n.crit && n.element === 'ice' && n.amount === 8);
    return ok(sting && forwarded, { sting, forwarded });
  },
});

story('feedback/ticks-stay-separate', {
  about: 'Burn and acid ticks combine by target/element within a fixed window; direct hits stay separate from ticks and grouping cannot extend tick life indefinitely.',
  setup,
  play() {
    const { run, enemies } = G(), fx = run.fx, id = enemies.list[0].id;
    const hit = (source, amount, feedback) => bus.emit('damage_taken', { targetId: id, amount, source, feedback });
    hit('fire', 0.2); const burn = active(fx)[0];
    fx.update(0.2); hit('fire', 0.3); hit('acid', 0.4); hit('bubble', 6, { element: 'fire', crit: true });
    const grouped = burn.amount === 0.5 && burn.t === 0.2 && active(fx).length === 3;
    fx.update(0.41); hit('fire', 0.2);
    const window = active(fx).filter(n => n.tick && n.element === 'fire').length === 2;
    fx.update(0.25);
    return ok(grouped && window && !burn.alive, { grouped, window, expired: !burn.alive });
  },
});

story('feedback/number-budget-and-reduce-effects', {
  about: 'Number slots and accents are capped, direct crits survive tick pressure, and Reduce Effects removes motion/accents while retaining crit identity.',
  setup,
  play() {
    const { run, player } = G(), fx = run.fx, at = player.position.clone().add(V(0, 0.06, -0.15));
    const crit = fx.number(at, 30, '#fff', 14, { crit: true, element: 'lightning', targetId: 'crit' });
    for (let i = 0; i < 90; i++) fx.number(at, 1, '#fff', 14, { tick: true, element: 'fire', targetId: i });
    const bounded = fx.nums.length <= fx.numberLook.cap && crit.alive;
    const before = juice.calm; offs.push(() => { juice.calm = before; }); juice.calm = true;
    fx.update(0.05);
    const reduced = crit.accent.style.display === 'none' && crit.tag.style.display === '' && crit.el.style.transform.includes('scale(1, 1)');
    fx.clear(); const cleared = active(fx).length === 0;
    const label = fx.number(at, 'SHIELDED', '#fff', 12);
    return ok(bounded && reduced && cleared && !label.numeric && !label.crit && label.accent.textContent === '', { bounded, reduced, cleared, slots: fx.nums.length });
  },
});
