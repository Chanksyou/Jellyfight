// Act 4 tuning fights, in the page (runner: tests/act4-tuning.mjs). A synthetic end-of-act-3 build (cards, Treasures,
// Legendary picks and Attack upgrades rolled with the game's own functions) fights an Elite, the Encore or a pack of
// bugs, driven by the balance bot's movement. Not earned progression: compare before and after, never read as a human.
import * as THREE from 'three';
import { CONTENT } from '../src/content.js';
import { rollCards, cardsNotFor, rollTreasures, treasureTier, applyCard, TREASURES, EVOLUTIONS, CHEST_WEIGHTS } from '../src/stats.js';
import { seededRandom } from '../src/story-random.mjs';
import { fresh, step } from '../src/stories/kit.js';
import { choose } from './balance-core.mjs';
import { observe, controller } from './balance-browser.mjs';

const G = () => window;
const pickOne = (list, rnd) => list[Math.floor(rnd() * list.length)];

// What a run that cleared acts 1 to 3 well holds (worker/index.js: the best real runs reached level 17 by the end of act 3): `levels` cards, `chests` Treasures (room and Elite chests alternate),
// `legendaries` boss picks, `upgrades` Attack upgrades. Rolls and picks are seeded; picks follow the style's card weights.
export function endOfAct3(seed, style, { levels = 16, chests = 12, legendaries = 3, upgrades = 4 } = {}) {
  const { run } = G(), rnd = seededRandom(seed ^ 0x5eed), kind = run.attack?.kind, taken = { cards: {}, treasures: [], legendary: [], upgrades: [] };
  const skip = cardsNotFor(kind);
  for (let i = 0; i < levels; i++) {
    const cards = rollCards(run.stats, 3 + run.mods.cardChoices, run.mods.cardRarity, run.S.luck, run.S, skip);
    const c = cards[choose(cards, i % 2 ? 'close' : style, [], rnd)];
    applyCard(run.stats, c); taken.cards[c.stat] = (taken.cards[c.stat] || 0) + 1;
  }
  const can = (t, weights) => weights[t.rarity] > 0 && run.owned.count(t.id) < t.stack && (!t.needs || run.owned.has(t.needs)) && run.hasStat(t) && run.forAttack(t);
  for (let i = 0; i < chests; i++) {
    const w = CHEST_WEIGHTS[i % 2 ? 'elite' : 'room'];
    const offer = rollTreasures(TREASURES.filter((t) => can(t, w)), 3, run.S.luck, (t) => w[t.rarity] / treasureTier(t).weight);
    if (!offer.length) continue;
    const t = pickOne(offer, rnd); run.owned.add(t.id); taken.treasures.push(t.id);
  }
  for (let i = 0; i < legendaries; i++) {
    const pool = [...TREASURES.filter((t) => t.rarity === 'legendary' && can(t, { legendary: 1 })), ...EVOLUTIONS.filter((e) => !run.evolved.includes(e.id) && run.forAttack(e))];
    if (!pool.length) break;
    const t = pickOne(pool, rnd);
    if (t.evolution) run.evolved.push(t.id); else run.owned.add(t.id);
    taken.legendary.push(t.id);
  }
  for (let i = 0; i < upgrades; i++) {
    const pool = CONTENT.upgrades.filter((u) => u.jelly === run.jelly && !run.upgrades.includes(u.id) && (!u.needs || run.upgrades.includes(u.needs)));
    if (!pool.length) break;
    const u = pickOne(pool, rnd); run.upgrades.push(u.id); taken.upgrades.push(u.id);
  }
  run.level = levels + 1;
  run.health = run.S.health; run.shield.update(0);
  const S = run.S;
  return { ...taken, stats: { health: S.health, dmg: S.bubbleDamage, rate: S.fireRate, bubbles: S.bubbles, range: S.range, regen: S.regen, dodge: S.dodge, shield: S.shield } };
}

// run the bot until done(); returns what the fight cost
// perch: { wake, stand } keeps the bot on the Elite's ground (it has no navigation: left to itself it walks off the furniture and the Elite sleeps)
function fight(config, done, seconds, targetOf, perch, immortal) {
  const { input } = G();
  const { run, player } = G(), meter = observe(), bot = controller(config, meter), W = perch?.wake;
  let frames = 0;
  try {
    for (; frames < seconds * 60 && run.phase !== 'dead' && !done(); frames++) {
      bot.tick(frames);
      if (config.hop && frames % 40 === 0) input.jumpQueued = true;   // hops the whole fight: the floor patterns and waves are jumped (the bot cannot read them)
      if (immortal) run.health = run.S.health;   // takes every hit, never dies: how long the damage alone takes
      if (W) {
        const P = player.position, V = player.velocity;
        if (P.x < W.min[0] + 0.02 || P.x > W.max[0] - 0.02) { P.x = Math.min(W.max[0] - 0.02, Math.max(W.min[0] + 0.02, P.x)); V.x = 0; }
        if (P.z < W.min[2] + 0.02 || P.z > W.max[2] - 0.02) { P.z = Math.min(W.max[2] - 0.02, Math.max(W.min[2] + 0.02, P.z)); V.z = 0; }
        if (P.y < W.min[1] - 0.02) { P.y = perch.stand[1]; V.y = 0; }
      }
    }
  } finally { meter.stop(); G().input.keys = new Set(); }
  const elapsed = frames / 60, d = meter.data;
  return { outcome: run.phase === 'dead' ? 'died' : done() ? 'cleared' : 'timeout', elapsed, killedBy: run.phase === 'dead' ? d.lastDamageSource : null,
    maxHealth: run.S.health, shield: run.S.shield, healthLost: d.healthLost, healthBySource: d.healthBySource, damage: d.damage, dps: elapsed ? d.damage / elapsed : 0, ...targetOf?.() };
}

function begin(config) {
  const random = Math.random;
  Math.random = seededRandom(config.seed);
  return () => { Math.random = random; };
}

// an Elite 1 on 1 (the dev duel: run.startDuel), on the act the page was opened on
export function elite({ seed, style, jelly, kind, seconds = 240, sun = false }) {
  const end = begin({ seed });
  try {
    const { run } = G();
    G().APT.renderer.setAnimationLoop(null);
    fresh({ hurt: true, levels: false, types: jelly, elites: false });
    const pick = run.duelChoices().find((p) => p.elite?.kind === kind && p.act === run.stage.id);
    if (!pick) throw Error(`no ${kind} Elite in act ${run.stage.id}`);
    run.startDuel(pick);
    if (!sun) { run.sunrise.update = () => {}; run.bass.update = () => {}; }   // the Elite alone: the sun's and the bass wave's costs are read from their numbers (stage4.js)
    const build = endOfAct3(seed, style);
    step(30);
    run.health = run.S.health;
    const e = () => run.elites.list.find((x) => x.kind === kind);
    return { act: run.stage.id, kind, jelly, style, seed, build, ...fight({ style }, () => !e() || e().dead, seconds, () => ({ eliteMaxHp: e()?.maxHp, eliteHpLeft: Math.max(0, e()?.hp ?? 0) }), pick.elite.wake && { wake: pick.elite.wake, stand: pick.elite.stand || pick.elite.at }) };
  } finally { end(); }
}

// the Encore (act 4 scene 2) or an act's boss: straight into the fight
export function boss({ seed, style, jelly, seconds = 420, immortal = false, hop = false }) {
  const end = begin({ seed });
  try {
    const { run } = G();
    G().APT.renderer.setAnimationLoop(null);
    fresh({ hurt: true, levels: false, types: jelly, elites: false });
    run.devRun();
    if (!G().APT.arena && !run.stage.stageDoor) run.startBossIntro();   // an act with a night: straight to its boss
    step(60 * 8, () => { if (G().menus.open) document.querySelector('.jf-card')?.click(); return run.phase === 'boss' && run.boss && run.boss.ready !== false; });
    const build = endOfAct3(seed, style);
    const B = () => run.boss;
    return { act: run.stage.id, boss: run.stage.boss.name, jelly, style, seed, build, ...fight({ style, hop }, () => !B() || B().dead || run.bossWon, seconds, () => ({ bossMaxHp: B()?.maxHp, bossHpLeft: Math.max(0, B()?.hp ?? 0) }), null, immortal) };
  } finally { end(); }
}

// a pack of the act's bugs at the stage's toughness, as mid-night spawns (`minute`: how far into the night)
export function pack({ seed, style, jelly, types, counts, minute = 1.5, seconds = 90 }) {
  const end = begin({ seed });
  try {
    const { run, player, enemies } = G();
    G().APT.renderer.setAnimationLoop(null);
    fresh({ hurt: true, levels: false, types: jelly, elites: false });
    run.devRun();
    const build = endOfAct3(seed, style);
    step(5);
    const toughness = run.stage.toughness || 1, bugs = [];
    let k = 0;
    types.forEach((type, i) => { for (let n = 0; n < counts[i]; n++, k++) {
      const a = k * 2.399, d = 0.28 + (k % 3) * 0.05;
      const e = enemies.spawn(type, player.position.clone().add(new THREE.Vector3(Math.cos(a) * d, 0.02, Math.sin(a) * d)), toughness);
      e.spawnT = 1; bugs.push(e);
    } });
    return { act: run.stage.id, types, counts, jelly, style, seed, build, ...fight({ style }, () => bugs.every((e) => e.dead), seconds, () => ({ left: bugs.filter((e) => !e.dead).length })) };
  } finally { end(); }
}
