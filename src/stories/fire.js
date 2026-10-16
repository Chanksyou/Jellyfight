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
    stub(sfx, 'fireLaunch', weight => launches.push(weight));
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
