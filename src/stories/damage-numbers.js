import { bus } from '../events.js';
import { juice } from '../juice.js';
import { G, V, offs, ok, record, roachAt, setupFight, step, story } from './kit.js';

function setup() { setupFight({ bubbles: false, lash: false }); roachAt(0, -0.18); step(2); G().run.fx.clear(); }
const active = fx => fx.nums.filter(n => n.alive);

story('feedback/elemental-crits', {
  about: 'Real elemental projectile crits preserve their element and crit marker after armor/mark adjustments, without changing damage.',
  setup,
  play() {
    const { run, enemies, player } = G(), fx = run.fx, e = enemies.list[0], B = run.bubbles, mods = run.mods, hits = record('enemy_hit');
    mods.hits.bubbles.crit = { chance: 1, mult: 3 }; e.armor = 0.25; e.markT = 3; e.markMore = 0.5;
    for (const element of ['fire', 'ice', 'lightning', 'acid', 'wind', 'glitter']) {
      const b = B.blow(player.position.clone().add(V(0, 0.06, 0)), e, { size: 1, dmg: 2, tint: element, elems: [element], ep: mods.element[element] });
      B.strike(b, e, mods);
    }
    const nums = active(fx).filter(n => n.crit), expected = 2 * 3 * 0.75 * 1.5;
    const spread = Math.max(...nums.map(n => n.dx)) - Math.min(...nums.map(n => n.dx));
    const correct = nums.length === 6 && nums.every(n => n.glyph.textContent.includes('✦') && n.el.style.color !== '' && Math.abs(n.amount - expected) < 1e-6);
    const colors = new Set(nums.map(n => n.el.style.color));
    const separated = new Set(nums.map(n => n.dx)).size === 6 && spread >= fx.numberLook.lane * 5;
    return ok(correct && colors.size === 6 && separated && hits.slice(0, 6).every(h => h.feedback.crit && h.feedback.element && Math.abs(h.amount - expected) < 1e-6), { correct, colors: colors.size, separated, spread, numbers: nums.map(n => [n.element, n.amount]) });
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
  about: 'Burn and acid ticks combine by target/element within a fixed window; direct hits remain distinct and grouping cannot extend life indefinitely.',
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
    const reduced = crit.accent.style.display === 'none' && crit.glyph.textContent.includes('✦') && crit.el.style.transform.includes('scale(1, 1)');
    fx.clear(); const cleared = active(fx).length === 0;
    const label = fx.number(at, 'SHIELDED', '#fff', 12);
    return ok(bounded && reduced && cleared && !label.numeric && !label.crit && label.accent.textContent === '', { bounded, reduced, cleared, slots: fx.nums.length });
  },
});
