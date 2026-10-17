import { sfx } from '../sfx.js';
import { G, V, dmgBy, give, ok, record, roachAt, setupFight, step, story, stub } from './kit.js';

story('attack/fire-feedback', {
  about: 'A fireball keeps its original damage and burn ticks, makes one contact cue per real hit, and clears on reset. Cosmetic launch and flame animation do not add damage or delay the shot.',
  setup() { setupFight({ bubbles: false, lash: false }); give('candle'); roachAt(0, -0.18); step(2); },
  play() {
    const { run, player, enemies } = G(), B = run.bubbles, S = run.S, M = run.mods;
    const P = M.element.fire, origin = player.position.clone().add(V(0, 0.06, 0)), e = enemies.list[0];
    let contacts = 0;
    const hit = B.looks.fireHit.bind(B.looks);
    stub(B.looks, 'fireHit', (...args) => { contacts++; hit(...args); });
    const log = record('damage_taken');
    B.elementVolley('fire', P, origin, S, M);
    const immediate = B.list.length === 1 && B.list[0].t === 0;
    const expectedHit = S.bubbleDamage * P.dmg, expectedBurnTick = S.bubbleDamage * 4.5 * 0.17 * P.burn * 0.5;
    for (let i = 0; i < 210; i++) { B.fly(1 / 60, S, M); B.effects(1 / 60, S); }
    const hits = dmgBy(log, 'bubble'), burns = dmgBy(log, 'fire');
    const expired = B.burning.size === 0;
    B.ignite(e, 10, P); B.reset();
    return ok(immediate && contacts === 1 && hits.length === 1 && Math.abs(hits[0].amount - expectedHit) < 1e-8 && burns.length === 6 && burns.every(x => Math.abs(x.amount - expectedBurnTick) < 1e-8) && expired && !B.list.length && !B.burning.size,
      { immediate, contacts, directHits: hits.length, burnTicks: burns.length, expectedHit, expectedBurnTick, expired, resetClear: !B.list.length && !B.burning.size });
  },
});

story('attack/fire-miss', {
  about: 'A fireball that expires without touching an enemy has no contact flash, impact sound, splash, or damage.',
  setup() { setupFight({ bubbles: false, lash: false }); give('candle'); step(2); },
  play() {
    const { run, player } = G(), B = run.bubbles;
    let contacts = 0, sounds = 0;
    stub(B.looks, 'fireHit', () => { contacts++; }); stub(sfx, 'fire', () => { sounds++; });
    const log = record('damage_taken');
    B.blow(player.position.clone().add(V(0, 0.06, 0)), null, { dir: V(1, 0, 0), size: 1, dmg: 3.6, tint: 'fire', elems: ['fire'], ep: run.mods.element.fire, pierce: 1, range: 0.03 });
    for (let i = 0; i < 90; i++) B.fly(1 / 60, run.S, run.mods);
    return ok(!contacts && !sounds && !log.length && !B.list.length && !B.burning.size, { contacts, sounds, damageEvents: log.length, remaining: B.list.length });
  },
});

story('attack/fire-audio-upgrades', {
  about: 'Fire upgrades give the launch and confirmed hits more audio weight, bounded at high upgrade levels; the extra weight does not change projectile damage.',
  setup() { setupFight({ bubbles: false, lash: false }); give('candle'); roachAt(0, -0.18); step(2); },
  play() {
    const { run, player } = G(), B = run.bubbles, launches = [], impacts = [];
    stub(sfx, 'fireLaunch', weight => { launches.push(weight); });
    stub(sfx, 'fire', weight => impacts.push(weight));
    const origin = player.position.clone().add(V(0, 0.06, 0));
    B.elementVolley('fire', run.mods.element.fire, origin, run.S, run.mods);
    const normal = launches[0];
    B.reset(); launches.length = 0;
    give('lighterFluid', 'birthdayCake'); step(2);
    B.elementVolley('fire', run.mods.element.fire, origin, run.S, run.mods);
    const upgraded = [...launches], damage = B.list.map(b => b.dmg);
    for (let i = 0; i < 60; i++) B.fly(1 / 60, run.S, run.mods);
    B.blow(origin, null, { dir: V(1, 0, 0), size: 100, dmg: 1, tint: 'fire', elems: ['fire'], ep: run.mods.element.fire, pierce: 1 });
    const capped = launches.at(-1);
    return ok(normal === 1 && upgraded.length === 2 && upgraded.every(w => w > normal && w <= 1.6) && impacts.length > 0 && impacts.every(w => w > normal) && damage.every(d => Math.abs(d - run.S.bubbleDamage * run.mods.element.fire.dmg) < 1e-8) && capped === 1.6,
      { normal, upgraded, impacts, damage, capped });
  },
});

// --- the other Elements' Attack Feel chain (docs/agents/attack-feel.md)
const ELEMENT_OF = { lightning: 'battery', ice: 'freezerPack', acid: 'nailPolish', glitter: 'glitter' };
story('attack/element-feel', {
  about: 'Lightning, ice, acid and glitter each complete the Attack Feel chain: energy gathers at the bell over the last fifth of the timer (the shot still leaves on time); on the frame it leaves, the bell squeezes, a launch flash and the element\'s launch sound; a hit lands with its own contact effect and hit sound, once; a shot that hits nothing makes neither. Lightning\'s chain draws a bolt to each bug it jumps to, and a stunned bug crackles while the stun lasts.',
  setup() { setupFight({ bubbles: false, lash: false }); roachAt(0, -0.18); roachAt(0.06, -0.24); step(2); },
  play() {
    const { run, player, enemies } = G(), B = run.bubbles, origin = player.position.clone().add(V(0, 0.06, 0)), out = {};
    const n = {}, spy = (o, k) => { const fn = o[k].bind(o); stub(o, k, (...a) => { n[k] = (n[k] || 0) + 1; return fn(...a); }); };
    spy(player.avatar, 'pulse'); spy(B.looks, 'gather'); spy(B.looks, 'launch'); spy(B.looks, 'contact'); spy(B.looks, 'bolt'); spy(sfx, 'elementLaunch'); spy(sfx, 'elementHit');
    for (const [el, id] of Object.entries(ELEMENT_OF)) {
      run.owned = new (run.owned.constructor)(); run.owned.add(id); step(1);
      B.reset(); for (const k in n) n[k] = 0;
      const M = run.mods, P = M.element[el];
      B.elTimers[el] = 0.85; Object.getPrototypeOf(B).update.call(B, 1 / 60, origin, run.S, M);   // gathering, not yet fired (the setup stubs update)
      const gathered = n.gather > 0 && !B.list.length;
      B.reset(); for (const k in n) n[k] = 0;
      B.elementVolley(el, P, origin, run.S, M);
      const released = n.pulse === 1 && n.launch === 1 && n.elementLaunch === 1 && B.list.length >= 1;
      const bolts0 = n.bolt || 0;
      for (let i = 0; i < 90 && B.list.length; i++) { B.fly(1 / 60, run.S, M); B.effects(1 / 60, run.S); }
      const landed = n.contact === 1 && n.elementHit === 1, chained = el !== 'lightning' || n.bolt - bolts0 >= 1;
      const stunned = el !== 'lightning' || enemies.list.some((e) => e.stunT > 0);
      B.reset(); for (const k in n) n[k] = 0;
      B.blow(origin, null, { dir: V(1, 0, 0), size: 1, dmg: 1, tint: el, elems: [el], ep: P, pierce: 1, range: 0.03 });
      for (let i = 0; i < 90 && B.list.length; i++) B.fly(1 / 60, run.S, M);
      const missQuiet = !n.contact && !n.elementHit;
      out[el] = { gathered, released, landed, chained, stunned, missQuiet };
    }
    return ok(Object.values(out).every((o) => Object.values(o).every(Boolean)), out);
  },
});
