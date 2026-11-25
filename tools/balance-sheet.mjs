// Balance sheets: one page that prices the game's numbers on paper (docs/agents/balance-model.md).
// Reads content/*.kdl with the game's own loader (src/content.js), src/stats.js, src/score.js and the
// stage files, so every number on the page comes from the files and redraws when one changes.
// Changes nothing in the game and plays nothing.
//
//   node tools/balance-sheet.mjs                  writes .wrangler/balance-sheets.html, flags to stdout
//   node tools/balance-sheet.mjs --out=path.html
//
// Units: one point is 1% of a level 1 Normal jelly, in Offence (damage a second on one bug) or in
// Defence (Health it can spend in act 1). Each sheet: numbers (with file:line), model, charts, flags,
// and one knob per flag.
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ROOT, THREE_DIR } from '../tests/lib.mjs';

// The game's modules import 'three'; point it at the copy the tests use (npm ci --prefix tests)
if (!THREE_DIR) throw new Error('balance-sheet: no three.js for node: run npm install --prefix tests');
const T = pathToFileURL(THREE_DIR + '/').href;
const MAP = { three: T + 'build/three.module.js', 'three-mesh-bvh': pathToFileURL(path.join(ROOT, 'vendor/three-mesh-bvh.module.js')).href };
register('data:text/javascript,' + encodeURIComponent(`const M=${JSON.stringify(MAP)},T=${JSON.stringify(T)};
export async function resolve(s,c,n){if(M[s])return{url:M[s],shortCircuit:true};for(const p of['three/addons/','three/examples/jsm/'])if(s.startsWith(p))return{url:T+'examples/jsm/'+s.slice(p.length),shortCircuit:true};return n(s,c)}`));
const game = (f) => import(pathToFileURL(path.join(ROOT, f)).href);

const { CONTENT, loadContent, compileMods } = await game('src/content.js');
const realFetch = globalThis.fetch;
globalThis.fetch = async (f) => ({ ok: true, text: async () => fs.readFileSync(f, 'utf8') });   // loadContent reads with fetch
try { await loadContent(path.join(ROOT, 'content') + '/'); } finally { globalThis.fetch = realFetch; }
const { BASE_STATS, MAX_DODGE, SHIELD_WAIT, SHIELD_FILL, applyCard, bubbleShare, cardAmount, xpToNext, luckWeights, RARITY, MAX_BUBBLES, rollTreasures, CHEST_WEIGHTS, TREASURE_RARITY, treasureTier, rollCards, threeOfAKind, threeOfAKindTreasures, cardsNotFor } = await game('src/stats.js');
const { ELEMENT_BASE, TREASURE_WORDS, STAT_NAMES } = await game('src/words.js');
const { STAGE1 } = await game('src/stage1.js'), { STAGE2 } = await game('src/stage2.js'), { STAGE3 } = await game('src/stage3.js'), { STAGE4, ENCORE } = await game('src/stage4.js');
const KDL = await game('src/kdl.js');
const { SCORE, actParts, MAX_SCORE } = await game('src/score.js'), { EASY } = await game('src/easy.js');
const { dealt: EASY_DEALT, taken: EASY_TAKEN, pearls: EASY_PEARLS } = EASY;
export { CONTENT };

// ------------------------------------------------------------------ sources
const TEXT = {};
const read = (f) => (TEXT[f] ??= fs.readFileSync(path.join(ROOT, f), 'utf8'));
// file:line of the first line matching re; a moved number fails loudly rather than citing the wrong line
export function at(f, re, after = null) {
  const lines = read(f).split('\n'), from = after ? lines.findIndex((l) => after.test(l)) : 0;
  const i = from < 0 ? -1 : lines.findIndex((l, k) => k >= from && re.test(l));
  if (i < 0) throw new Error(`balance-sheet: ${f} has no line matching ${re}`);
  return `${f}:${i + 1}`;
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const kdl = (file, kind, id) => at(file, new RegExp(`^${kind} "${esc(id)}"`));
// ELEMENT in src/bubbles.js: each element's share of power (pw = Attack damage x 4.5)
const ELEMENT = Object.fromEntries([...read('src/bubbles.js').match(/export const ELEMENT = \{([\s\S]*?)\};/)[1].matchAll(/(\w+): ([\d. /]+),/g)].map(([, k, v]) => [k, Function(`return ${v}`)()]));
const PW = +read('src/bubbles.js').match(/pw: each \* ([\d.]+)/)[1];   // 4.5
const GADGET_POWER = +read('src/run.js').match(/get power\(\) \{ return this\.S\.bubbleDamage \* ([\d.]+)/)[1];   // 1.8

// ------------------------------------------------------------------ measured (not in the files)
// From the run log (D1 run_summaries), 142 runs by 17 players, 14 to 24 Nov 2026, means over cleared
// acts (the balance plan, https://claude.ai/artifact/3dCpaHd1uAvgjarjBxcVtE). Replace when the run log
// grows; these are the only typed-in numbers on the page.
export const RUN_LOG = {
  source: 'run log, 142 runs by 17 players, 14 to 24 Nov 2026, means over cleared acts',
  level: [11.7, 16.2, 19.3, 20.6],        // level at the end of each act (about the Boss door)
  treasures: [7.0, 13.9, 20.7, 25.1],     // Treasures held at the end of each act
  bossSeconds: [74, 71, 62, 114],         // Boss fight length
  healthLost: [60, 156, 190, 226],        // Health the act's hits took, before Shield
  cleared: [0.93, 0.79, 0.74, 0.53],      // share of bugs cleared
  // Wave C3 to D3, from the run log's damage by source (#529): 155 finished acts, 20 to 24 Nov 2026
  source2: 'run log, finished acts 20 to 24 Nov 2026 (damage by source, #529)',
  // Health lost to each Elite (all its sources) per one beaten
  eliteLost: { controller: 1.9, mug: 1.9, kettle: 2.3, soap: 5.3, clock: 5.1, whipper: 2.0, croc: 4.5, bull: 5.2, coffer: 8.2, bowl: 6.7, pillow: 3.7, headphones: 1.4 },
  bossLost: [8.8, 14, 12.7, 23.8],        // Health lost to the Boss in a beaten fight, not on Easy
  // Boss fight seconds by jelly type: [mean s, fights], beaten fights, not on Easy
  bossByType: [
    { fire: [112, 9], glitter: [49, 4], ice: [77, 5], lightning: [57, 6], normal: [76, 7], poison: [72, 5], tentacle: [33, 4], wind: [74, 6] },
    { fire: [126, 4], glitter: [60, 4], ice: [69, 4], lightning: [57, 4], normal: [59, 3], poison: [69, 4], tentacle: [50, 3], wind: [73, 4] },
    { fire: [47, 3], glitter: [78, 4], ice: [84, 4], lightning: [50, 2], normal: [24, 2], poison: [96, 4], tentacle: [26, 2], wind: [40, 3] },
    { fire: [64, 2], glitter: [119, 4], ice: [303, 2], lightning: [75, 1], normal: [62, 2], poison: [134, 3], tentacle: [48, 2], wind: [70, 2] },
  ],
};
// How often the Shield refills in an act: a careful player is out of trouble often, a brawler rarely
// (assumptions, not measured; the Shield needs SHIELD_WAIT + SHIELD_FILL s clear to refill)
export const STYLES = { careful: 20, brawler: 60 };   // seconds between refills
const BUDGET = [9, 12];                    // a jelly type's level 1 damage a second on one bug (docs/jelly-types/spec-core.md)

// ------------------------------------------------------------------ acts
const bossOf = (stage) => Object.values(CONTENT.bosses).find((B) => B.name === stage.boss.name);   // (the Clog's kind is 'hair')
export const ACTS = [
  { n: 1, name: 'Living room', stage: STAGE1, fight: STAGE1, file: 'src/stage1.js' },
  { n: 2, name: 'Bathroom', stage: STAGE2, fight: STAGE2, file: 'src/stage2.js' },
  { n: 3, name: 'Bedroom', stage: STAGE3, fight: STAGE3, file: 'src/stage3.js' },
  { n: 4, name: 'Dawn', stage: STAGE4, fight: ENCORE, file: 'src/stage4.js' },
].map((A) => {
  const B = bossOf(A.fight);
  return { ...A, bossId: B.id, boss: B.name.replace(/^The /, '').replace(/ One$/, ''), bossHp: B.hp * (A.fight.bossHp ?? 1), power: A.stage.power ?? 1, xpMult: A.stage.xpMult ?? 1, bugs: A.stage.bugs ?? 1, toughness: A.stage.toughness ?? 1, night: A.stage.duration,
    seconds: A.stage.duration + RUN_LOG.bossSeconds[A.n - 1] };
});
const knob = (A, k) => at(A.file, new RegExp(`^  ${k}:`), new RegExp(`^export const STAGE${A.n} = `));   // (stage4.js: the room, not the ENCORE arena above it)

// The night's bugs (run.js spawnWaves): rate + grow x t a second, times the act's `bugs`, each pick by
// weight among the bugs already out. The alive cap is ignored, so counts are a ceiling.
export function night(A, xpMult = 1, moreBugs = 1) {
  const W = CONTENT.waves, list = W.bugs.filter((b) => b.act === A.n), per = {}, dt = 0.1;
  let out = 0;
  for (let t = 0; t < A.night; t += dt) {
    const rate = (W.rate + t * W.grow) * A.bugs * moreBugs, live = list.filter((b) => t >= b.from), sw = live.reduce((s, b) => s + b.weight, 0);
    for (const b of live) per[b.id] = (per[b.id] || 0) + rate * dt * b.weight / sw;
    out += rate * dt;
  }
  const N = A.stage.nests;   // act 3's wasp nests
  if (N) per.nest = (per.nest || 0) + N.count;
  let xp = 0, hp = 0;
  for (const [id, k] of Object.entries(per)) { const E = CONTENT.enemies[id]; xp += k * Math.round(E.xp * xpMult * A.xpMult); hp += k * E.hp * A.toughness; }
  return { per, out, xp, hp };
}

// ------------------------------------------------------------------ levels
// Level reached with `xp` in all, as a fraction (12.4 = level 12, 40% of the way to 13)
export function levelAt(xp, cost = xpToNext) {
  let L = 1;
  while (xp >= cost(L)) { xp -= cost(L); L++; }
  return L + xp / cost(L);
}
const xpFor = (level, cost = xpToNext) => { let x = 0; for (let L = 1; L < Math.floor(level); L++) x += cost(L); return x + (level % 1) * cost(Math.floor(level)); };

// ------------------------------------------------------------------ the jelly
export const TYPES = Object.keys(CONTENT.jellies);
export const baseOf = (type) => ({ ...BASE_STATS, ...CONTENT.jellies[type].stats });
const LV = CONTENT.levelups;
export const cardPool = (type) => Object.entries(LV.cards).filter(([, c]) => c.weight > 0 && !c.notFor.includes(CONTENT.jellies[type].attack)).map(([stat, c]) => ({ stat, ...c }));
// odds of each card rarity at a Luck (stats.js luckWeights)
export function tierOdds(luck = 0) {
  const w = luckWeights(RARITY.map((r) => ({ weight: LV.rarities[r.id] })), luck), s = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / s);
}
const expectedAmount = (c, odds = tierOdds()) => c.amounts.reduce((s, a, i) => s + a * odds[i], 0);

// The reference jelly at a level: its type's start plus an average card each level, the card taken
// at random from those offered (so each stat by its weight) at the usual rarity odds. No Treasures:
// what the run log's Boss times show beyond this is what Treasures bring.
export function refStats(type, level) {
  const S = baseOf(type), pool = cardPool(type), W = pool.reduce((s, c) => s + c.weight, 0);
  for (let L = 1; L < level; L++) {
    const f = Math.min(1, level - L);
    for (const c of pool) applyCard(S, { stat: c.stat, amount: cardAmount(c.stat, expectedAmount(c), S[c.stat]) * f * c.weight / W });
  }
  return S;
}

// Offence: damage a second, on one bug, on each of a clump of 5, or on a Boss (src/bubbles.js, src/combat.js)
export function offence(type, S, target = 'one') {
  const J = CONTENT.jellies[type], kind = J.attack, AD = S.bubbleDamage, rate = S.fireRate;
  const shots = kind === 'tentacle' ? 1 : S.bubbles * bubbleShare(S.bubbles);   // side by side, all on one target; a tentacle stings each bug once
  let one = AD * J.hit * rate * shots, more = 0;
  if (kind === 'fire' && 1 / rate < ELEMENT_BASE.fire.burnTime) one += AD * PW * ELEMENT.burn * S.burnDamage;   // Burn, kept lit by every hit
  if (kind === 'poison' && 1 / rate < ELEMENT_BASE.poison.poisonTime) one += ELEMENT_BASE.poison.poisonStacks * AD * PW * ELEMENT.poison;   // each hit adds a stack and restarts them all
  if (target === 'clump') {
    if (kind === 'lightning') more = Math.min(4, ELEMENT_BASE.lightning.chain) * AD * PW * ELEMENT.bolt * rate * shots;
    if (kind === 'glitter') more = 4 * AD * PW * ELEMENT.glitter * rate * shots;
    if (kind === 'poison') more = 4 * (one - AD * J.hit * rate * shots);   // the burst Poisons the clump
    if (kind === 'wind') more = Math.min(4, ELEMENT_BASE.wind.pierce + S.pierce) * AD * J.hit * rate;
    if (kind === 'tentacle') more = Math.min(4, S.bubbles - 1) * AD * J.hit * rate;
  }
  return one + more;
}
export const OFF0 = offence('normal', baseOf('normal'));   // 1 Offence point = 1% of this
export const offPts = (x) => 100 * x / OFF0;

// Defence: Health you can spend in an act (before the act's power; Shield refills by style)
export function defence(S, A, style = 'careful', taken = 1) {
  const refills = A.seconds / STYLES[style];
  return (S.health + S.shield * refills + S.regen * A.seconds) / ((1 - Math.min(S.dodgeCap ?? MAX_DODGE, S.dodge) / 100) * taken);
}
export const DEF0 = defence(baseOf('normal'), ACTS[0]);    // 1 Defence point = 1% of this
export const defPts = (x) => 100 * x / DEF0;

// The moments every sheet prices at: the start, and each Boss door at the run log's levels
export const MOMENTS = [{ key: 'start', name: 'Start', A: ACTS[0], level: 1 },
  ...ACTS.map((A, i) => ({ key: `door${A.n}`, name: `${A.boss} door`, A, level: RUN_LOG.level[i], real: A.bossHp / RUN_LOG.bossSeconds[i] }))];

// ------------------------------------------------------------------ helpers for sheets
const r = (x, d = 1) => (Math.abs(x) >= 100 ? Math.round(x).toLocaleString('en-US') : (+x.toFixed(d)).toString());
const pct = (x, d = 0) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(d)}%`;
const name = (type) => CONTENT.jellies[type].name.replace(/ Jelly$/, '');
const a = (word) => (/^[AEIOU]/.test(word) ? 'an ' : 'a ') + word;
const CARD_NAME = { range: 'Range', bubbleDamage: 'Attack damage', fireRate: 'Fire rate', health: 'Health', shield: 'Shield', moveSpeed: 'Move speed', regen: 'Health regen', dodge: 'Dodge', luck: 'Luck', bubbles: 'Attacks', bubbleSize: 'Attack size' };
const cardLine = (stat) => at('content/levelups.kdl', new RegExp(`^card "${stat}"`));

// ------------------------------------------------------------------ S0: the yardstick
function sheetS0() {
  const n = baseOf('normal');
  const rows = MOMENTS.map((M) => {
    const S = refStats('normal', M.level), paper = offence('normal', S, 'one');
    return [M.name, r(M.level), r(paper), M.real ? r(M.real) : '', M.real ? `x${r(M.real / paper)}` : '', r(defence(S, M.A)), r(defence(S, M.A, 'brawler'))];
  });
  return {
    id: 'S0', title: 'The yardstick',
    lede: 'Every later sheet prices its items against these units and these five moments.',
    numbers: [
      ['Normal Attack damage', n.bubbleDamage, at('src/stats.js', /^ {2}bubbleDamage:/)],
      ['Normal Fire rate', n.fireRate, at('src/stats.js', /^ {2}fireRate:/)],
      ['Normal Health', n.health, at('src/stats.js', /^ {2}health:/)],
      ['Gadget power, x Attack damage', GADGET_POWER, at('src/run.js', /get power\(\)/)],
      ['Shield waits, fills (s)', `${SHIELD_WAIT}, ${SHIELD_FILL}`, at('src/stats.js', /SHIELD_WAIT = /)],
      ...ACTS.map((A) => [`Act ${A.n}: night s, power, toughness, bugs, xpMult`, `${A.night}, ${A.power}, ${A.toughness}, ${A.bugs}, ${A.xpMult}`, A.file]),
      ...ACTS.map((A) => [`${A.boss} Health`, r(A.bossHp), kdl('content/bosses.kdl', 'boss', A.bossId)]),
      ['Level, Boss time, Health lost per act', RUN_LOG.source, 'tools/balance-sheet.mjs RUN_LOG'],
    ],
    model: `Offence  = damage a second on one bug (attack, Burn, Poison; sheet A1)
           1 point = 1% of a level 1 Normal jelly = ${r(OFF0 / 100, 4)} damage a second
Defence  = (Health + Shield x refills + regen x act seconds) / ((1 - Dodge) x damage taken)
           1 point = 1% of a level 1 Normal jelly in act 1 = ${r(DEF0 / 100, 3)} Health
           refills: careful every ${STYLES.careful} s, brawler every ${STYLES.brawler} s (assumed)
Level    = XP in all through xpToNext (src/stats.js), as a fraction
Reference jelly at a moment = its type's start + (level - 1) average cards
           (each card by its weight, each rarity by its odds); no Treasures
Treasure share = real Boss damage a second (Boss Health / run log fight time) / paper`,
    tables: [{ head: ['Moment', 'Level', 'Paper Offence', 'Real at Boss', 'Treasures add', 'Defence careful', 'Defence brawler'], rows }],
    charts: [bars('Damage a second at each Boss door: paper (cards only) against real', MOMENTS.slice(1).flatMap((M) => [
      [`${M.A.boss}, paper`, offence('normal', refStats('normal', M.level))], [`${M.A.boss}, real`, M.real, 'b']]), { fmt: (v) => r(v) })],
    flags: [], notes: ['Real damage a second is Boss Health over the run log\'s mean fight time: it includes Treasures, evolutions, upgrades and every type, so read it as the whole run\'s Offence at that door.'],
  };
}

// ------------------------------------------------------------------ A1: the eight attacks
function sheetA1() {
  const flags = [], rows = [], reachRows = [];
  const bugReach = Object.values(CONTENT.enemies).filter((E) => E.reach > 0 && E.xp > 0);
  for (const type of TYPES) {
    const J = CONTENT.jellies[type], S = baseOf(type), one = offence(type, S), clump = offence(type, S, 'clump');
    const doors = MOMENTS.slice(1).map((M) => offence(type, refStats(type, M.level)));
    rows.push([`${J.icon} ${name(type)}`, J.attack, `x${J.hit}`, r(S.bubbleDamage), r(S.fireRate, 2), r(one), r(clump / one, 2) + 'x', ...doors.map((d) => r(d))]);
    const reach = J.attack === 'tentacle' ? S.reach : S.range;
    reachRows.push([name(type), `${r(reach * 100)} cm`, bugReach.filter((E) => E.reach >= reach).length + ` of ${bugReach.length}`]);
    if (one < BUDGET[0] || one > BUDGET[1]) {
      // the hit= that lands it mid-budget: damage = hit x a + b (Burn and Poison don't follow hit=)
      const b = offence(type, { ...S, bubbleDamage: S.bubbleDamage }) - S.bubbleDamage * J.hit * S.fireRate * (J.attack === 'tentacle' ? 1 : S.bubbles * bubbleShare(S.bubbles));
      const a = (one - b) / J.hit, want = (BUDGET[0] + BUDGET[1]) / 2, hit = (want - b) / a;
      flags.push({ text: `${name(type)} does ${r(one)} damage a second on one bug at level 1, outside the ${BUDGET[0]} to ${BUDGET[1]} budget${J.attack === 'tentacle' ? `, paid for by a ${r(S.reach * 100)} cm reach that ${reachRows.at(-1)[2]} bugs' attacks out-reach` : ''}.`,
        knob: { at: kdl('content/jellies.kdl', 'jelly', type), change: `hit=${J.hit} → ${r(hit, 2)}`, does: `${r(want)} a second, mid-budget (or keep it and write the reason in the file)` } });
    }
  }
  // the same card on every type: a flat +1 Attack damage is a bigger share of a small base
  const gain = TYPES.map((t) => [t, offence(t, { ...baseOf(t), bubbleDamage: baseOf(t).bubbleDamage + LV.cards.bubbleDamage.amounts[0] }) / offence(t, baseOf(t)) - 1]);
  const hi = gain.reduce((a, b) => (b[1] > a[1] ? b : a)), lo = gain.reduce((a, b) => (b[1] < a[1] ? b : a));
  // Fire rate's card is a % of Normal's Fire rate (applyCard reads BASE_STATS), so it skews by type too
  const rate = TYPES.map((t) => [t, BASE_STATS.fireRate * LV.cards.fireRate.amounts[0] / 100 / baseOf(t).fireRate]);
  const rhi = rate.reduce((a, b) => (b[1] > a[1] ? b : a)), rlo = rate.reduce((a, b) => (b[1] < a[1] ? b : a));
  if (hi[1] / lo[1] > 1.5) flags.push({ text: `A Common Attack damage card is ${pct(hi[1])} for ${name(hi[0])} and ${pct(lo[1])} for ${name(lo[0])}: a flat +${LV.cards.bubbleDamage.amounts[0]} favours small hits. Fire rate's card is a share of Normal's rate, so it runs ${pct(rlo[1])} (${name(rlo[0])}) to ${pct(rhi[1])} (${name(rhi[0])}).`,
    knob: { at: at('src/stats.js', /^export function applyCard/), change: 'add Attack damage and Fire rate cards as a % of the jelly type\'s own starting value, not a flat amount or Normal\'s', does: `every type gains the same share from the same card, about ${pct(LV.cards.fireRate.amounts[0] / 100)} at Common` } });
  // the spread between types once levelled (cards only)
  const enc = TYPES.map((t) => [t, offence(t, refStats(t, RUN_LOG.level[3]))]);
  const top = enc.reduce((a, b) => (b[1] > a[1] ? b : a)), bot = enc.reduce((a, b) => (b[1] < a[1] ? b : a));
  if (top[1] / bot[1] > 1.5) flags.push({ text: `At the Encore door on cards alone, ${name(top[0])} does ${r(top[1] / bot[1], 2)}x what ${name(bot[0])} does on one bug.`,
    knob: { at: kdl('content/jellies.kdl', 'jelly', bot[0]), change: `hit=${CONTENT.jellies[bot[0]].hit} → ${r(CONTENT.jellies[bot[0]].hit * Math.sqrt(top[1] / bot[1]), 2)}`, does: 'halves the gap (a level 1 change too: check the budget flag)' } });
  return {
    id: 'A1', title: 'The eight attacks',
    lede: 'Damage a second at level 1 and at each Boss door with average cards, on one bug, on a clump of 5, and on a Boss.',
    numbers: [
      ...TYPES.map((t) => [`${name(t)}: attack, hit=, stats`, `${CONTENT.jellies[t].attack} x${CONTENT.jellies[t].hit}`, kdl('content/jellies.kdl', 'jelly', t)]),
      ['Shares of power (pw = Attack damage x ' + PW + '): burn, bolt, glitter, poison', `${r(ELEMENT.burn, 3)}, ${r(ELEMENT.bolt, 3)}, ${r(ELEMENT.glitter, 3)}, ${r(ELEMENT.poison, 3)}`, at('src/bubbles.js', /^export const ELEMENT = /)],
      ['Burn s, arcs, Poison stacks and s, gust pierce', `${ELEMENT_BASE.fire.burnTime}, ${ELEMENT_BASE.lightning.chain}, ${ELEMENT_BASE.poison.poisonStacks} x ${ELEMENT_BASE.poison.poisonTime}, ${ELEMENT_BASE.wind.pierce}`, at('src/words.js', /^export const ELEMENT_BASE/)],
      ['More Attacks: each one costs', pct(-0.25), at('src/stats.js', /BUBBLE_PENALTY = /)],
    ],
    model: `one bug  = Attack damage x hit x Fire rate x Attacks share
           + Burn (Fire: Attack damage x ${PW} x ${r(ELEMENT.burn, 3)} a second, lit while hits come faster than ${ELEMENT_BASE.fire.burnTime} s)
           + Poison (stacks kept = min(${ELEMENT_BASE.poison.poisonStacks}, Fire rate x ${ELEMENT_BASE.poison.poisonTime} s), each Attack damage x 0.2 a second)
clump of 5 adds, on the other 4: Lightning ${ELEMENT_BASE.lightning.chain} arcs at ${r(PW * ELEMENT.bolt, 2)} x Attack damage; Glitter a splash at ${r(PW * ELEMENT.glitter, 2)};
           Poison its burst's stacks; Wind its pierce (${ELEMENT_BASE.wind.pierce} + Pierce); Tentacle one sting per tentacle
a Boss    = one bug (arcs and splashes need other bugs; a Stun holds a Boss only 0.1 s)
Not counted: Normal's small pop splash, Burn spreading on a kill, Wind's push into furniture, Chill's slowing.`,
    tables: [{ head: ['Type', 'Attack', 'hit', 'Attack damage', 'Fire rate', 'Level 1, one bug', 'Clump / one', ...MOMENTS.slice(1).map((M) => M.name)], rows },
      { head: ['Type', 'Reach at level 1', 'Bugs whose attack reaches as far'], rows: reachRows }],
    charts: [bars('Level 1, one bug (the budget is 9 to 12)', TYPES.map((t) => [name(t), offence(t, baseOf(t))]), { fmt: (v) => r(v), band: BUDGET }),
      bars('Encore door, cards only, one bug', enc.map(([t, v]) => [name(t), v]), { fmt: (v) => r(v) }),
      bars('Level 1, a clump of 5 (damage a second on all of them)', TYPES.map((t) => [name(t), offence(t, baseOf(t), 'clump')]), { fmt: (v) => r(v), cls: 'b' })],
    flags,
    notes: ['A Boss gets one bug\'s figure: arcs, splash and the extra tentacles need other bugs in reach.', 'Per-type Boss times from the run log will check this sheet once the run log records the type with each fight time.'],
  };
}

// ------------------------------------------------------------------ A2: XP and levels
function sheetA2() {
  const nights = ACTS.map((A) => night(A));
  let xp = 0;
  const ends = nights.map((N) => levelAt(xp += N.xp));
  const gained = ends.map((L, i) => L - (i ? ends[i - 1] : 1));
  const rows = ACTS.map((A, i) => [`${A.n} ${A.name}`, A.night + ' s', r(nights[i].out, 0), r(nights[i].xp, 0), r(ends[i]), r(RUN_LOG.level[i]), r(gained[i])]);
  // steady-step curves: each level costs `step` more than the last
  const total = xp, step = (s) => (L) => Math.round(LV.xp.base + s * (L - 1));
  const solve = (want) => { let lo = 0.1, hi = 40; for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (levelAt(total, step(m)) > want) lo = m; else hi = m; } return (lo + hi) / 2; };
  const sA = solve(ends[3]), sB = solve(ends[3] + 5);
  const before = (L) => Math.round(LV.xp.base * LV.xp.growth ** (L - 1));
  const curves = [['Before (x' + LV.xp.growth + ' every level)', before], ['Today', xpToNext], [`Steady +${r(sA)} from level 1, same end`, step(sA)], [`Steady +${r(sB)}, 5 more`, step(sB)]];
  const perAct = curves.map(([label, cost]) => { let x = 0; const e = nights.map((N) => levelAt(x += N.xp, cost)); return [label, e.map((L, i) => L - (i ? e[i - 1] : 1))]; });
  const flags = [];
  if (gained[3] < gained[0] / 4) flags.push({ text: `Levels run out: ${gained.map((v) => r(v)).join(', ')} level-ups in acts 1 to 4. Each level costs ${r((LV.xp.growth - 1) * 100)}% more than the last, and each act's XP grows less than that.`,
    knob: { at: at('src/stats.js', /export const xpToNext/), change: `each level costs a steady ${r(sA)} XP more than the last, in place of x${LV.xp.growth}`, does: `level-ups per act become ${perAct[2][1].map((v) => r(v)).join(', ')}, ending at the same level` } });
  // XP Treasures: levels over a whole run, taken at the start of act 1 (all copies)
  const runXp = (mult = 1, more = 1, from = 0) => nights.reduce((s, N, i) => s + (i >= from ? night(ACTS[i], mult, more).xp : N.xp), 0);
  const houseplant = (from = 0) => { const w = read('content/treasures.kdl').match(/treasure "houseplant"[\s\S]*?every (\d+) \{\s*xp (\d+)/); return ACTS.slice(from).reduce((s, A) => s + Math.floor(A.night / +w[1]) * +w[2], 0); };
  const xpRows = [
    ['coin', 'Lucky Penny', 'one copy', levelAt(runXp(1.25)) - ends[3], levelAt(runXp(1.25, 1, 1)) - ends[3]],
    ['sugar', 'Spilled Sugar', 'one copy', levelAt(runXp(1.15, 1.25)) - ends[3], levelAt(runXp(1.15, 1.25, 1)) - ends[3]],
    ['houseplant', 'Houseplant', 'level 1', levelAt(total + houseplant()) - ends[3], levelAt(total + houseplant(1)) - ends[3]],
  ];
  const coin = xpRows[0];
  if (coin[3] < 1) {
    let m = 1.25; while (levelAt(runXp(m, 1, 1)) - ends[3] < 1 && m < 3) m += 0.05;
    flags.push({ text: `A Lucky Penny is worth ${r(coin[3], 2)} of a level over a whole run (${r(coin[4], 2)} from act 2): less than one level-up card, for the most picked Treasure in the run log.`,
      knob: { at: kdl('content/treasures.kdl', 'treasure', 'coin'), change: `xp-mult 1.25 → ${r(m, 2)}`, does: 'one copy taken at the start of act 2 is worth a whole level' } });
  }
  // XP per 100 Health of bug, with each act's toughness and xpMult
  const bugRows = ACTS.flatMap((A) => Object.keys(night(A).per).map((id) => { const E = CONTENT.enemies[id]; return [`${E.name} (${A.n})`, 100 * Math.round(E.xp * A.xpMult) / (E.hp * A.toughness), id, A]; }));
  const worst = bugRows.reduce((a, b) => (b[1] < a[1] ? b : a));
  const sameAct = bugRows.filter((b) => b[3] === worst[3] && b !== worst).map((b) => b[1]).sort((a, b) => a - b);
  const med = sameAct[Math.floor(sameAct.length / 2)];
  if (worst[1] < med * 0.75) flags.push({ text: `${worst[0]} pays ${r(worst[1])} XP per 100 Health, the least of any bug (its act's others pay ${r(med)}).`,
    knob: { at: kdl('content/enemies.kdl', 'enemy', worst[2]), change: `xp=${CONTENT.enemies[worst[2]].xp} → ${Math.round(CONTENT.enemies[worst[2]].xp * med / worst[1])}`, does: 'pays like the rest of its act' } });
  return {
    id: 'A2', title: 'XP and levels',
    lede: 'XP on offer per act, the level it buys, and what each XP source is worth in levels.',
    numbers: [
      ['XP to level up: base, growth, steady from, step', `${LV.xp.base}, x${LV.xp.growth}, level ${LV.xp.steadyFrom}, +${LV.xp.step}`, at('content/levelups.kdl', /^xp /)],
      ['Spawning: rate, grow a second', `${CONTENT.waves.rate}, ${CONTENT.waves.grow}`, at('content/waves.kdl', /^\s+rate /)],
      ...ACTS.map((A) => [`Act ${A.n}: night, bugs, xpMult`, `${A.night} s, x${A.bugs}, x${A.xpMult}`, A.n === 1 ? at(A.file, /duration:/) : knob(A, 'xpMult')]),
      ...Object.values(CONTENT.enemies).filter((E) => E.xp > 0 && E.id !== 'hair').map((E) => [`${E.name}: XP, Health`, `${E.xp}, ${E.hp}`, kdl('content/enemies.kdl', 'enemy', E.id)]),
    ],
    model: `bugs out in a night = ∫ (rate + grow x t) x act bugs dt   (alive cap ignored: a ceiling)
each bug picked by weight among those already out (waves.kdl from=)
XP on offer = Σ bugs x round(XP x act xpMult)        (+ act 3's wasp nests)
level = XP in all through xpToNext(L) = round(${LV.xp.base} x ${LV.xp.growth}^(L-1)) up to level ${LV.xp.steadyFrom}, then ${LV.xp.step} more each level, as a fraction
real players clear ${RUN_LOG.cleared.map((c) => pct(c).slice(1)).join(', ')} of the bugs yet reach about the paper level: XP left on the floor is collected after the Boss.`,
    tables: [{ head: ['Act', 'Night', 'Bugs out', 'XP on offer', 'Paper level at the end', 'Real level', 'Level-ups in the act'], rows },
      { head: ['Curve', 'Act 1', 'Act 2', 'Act 3', 'Act 4'], rows: perAct.map(([l, v]) => [l, ...v.map((x) => r(x))]) },
      { head: ['XP Treasure', 'Copies', 'Levels over a run from act 1', 'From act 2'], rows: xpRows.map((x) => [x[1], x[2], r(x[3], 2), r(x[4], 2)]) }],
    charts: [grouped(`Level-ups in each act: the old x${LV.xp.growth} curve, today's, and two steady steps (XP more per level)`, ['Act 1', 'Act 2', 'Act 3', 'Act 4'], perAct.map(([l, v]) => [l, v]), (v) => r(v)),
      bars('XP per 100 Health of bug (act in brackets)', bugRows.map(([l, v]) => [l, v]), { fmt: (v) => r(v) })],
    flags,
    notes: ['The Pedometer and the Magnet need distance swum and pickup reach from play; they are left to Wave B4.', 'The curve: levels 1 to 7 as before, then +30 XP a level (steady-from and step in levelups.kdl), picked Nov 24.'],
  };
}

// ------------------------------------------------------------------ A3: level-up cards
// What a card adds, as a share of the jelly's Offence (Attack damage, Fire rate) or Defence (the rest
// that can be priced). Range, Move speed and Luck aren't priced on this sheet.
const OFFENCE_CARDS = ['bubbleDamage', 'fireRate'], DEFENCE_CARDS = ['health', 'shield', 'regen', 'dodge'];
export function cardWorth(type, stat, tier, M, style = 'careful') {
  const S = refStats(type, M.level), c = LV.cards[stat], after = { ...S };
  applyCard(after, { stat, amount: cardAmount(stat, c.amounts[tier], S[stat]) });
  if (OFFENCE_CARDS.includes(stat)) return offence(type, after) / offence(type, S) - 1;
  if (DEFENCE_CARDS.includes(stat)) return defence(after, M.A, style) / defence(S, M.A, style) - 1;
  return null;
}
// chance each card is among the 3 offered (weights, drawn without putting back)
export function offerChance(type, n = 3) {
  const pool = cardPool(type), out = Object.fromEntries(pool.map((c) => [c.stat, 0]));
  const go = (left, p, k) => {
    if (!k) return;
    const W = left.reduce((s, c) => s + c.weight, 0);
    for (const c of left) { const q = p * c.weight / W; out[c.stat] += q; go(left.filter((x) => x !== c), q, k - 1); }
  };
  go(pool, 1, n);
  return out;
}
function sheetA3() {
  const flags = [], door = MOMENTS[1], cards = [...OFFENCE_CARDS, ...DEFENCE_CARDS];
  const rows = cards.map((stat) => [CARD_NAME[stat], LV.cards[stat].amounts.join(' / '), ...MOMENTS.map((M) => pct(cardWorth('normal', stat, 0, M)))]);
  const yard = (M) => cardWorth('normal', 'fireRate', 0, M);
  for (const stat of cards.filter((s) => s !== 'fireRate')) {
    const k = cardWorth('normal', stat, 0, door) / yard(door);
    if (k > 1.5 || k < 1 / 1.5) {
      // the Common amount that matches Fire rate's share at the Vacuum door
      let lo = 0, hi = LV.cards[stat].amounts[0] * 20;
      const worth = (a) => { const S = refStats('normal', door.level), after = { ...S }; applyCard(after, { stat, amount: cardAmount(stat, a, S[stat]) }); return (OFFENCE_CARDS.includes(stat) ? offence('normal', after) / offence('normal', S) : defence(after, door.A) / defence(S, door.A)) - 1; };
      for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (worth(m) < yard(door)) lo = m; else hi = m; }
      const want = (lo + hi) / 2, d = want < 1 ? 2 : 0;
      flags.push({ text: `At the ${door.name} a Common ${CARD_NAME[stat]} card is worth ${pct(cardWorth('normal', stat, 0, door))} of a Normal jelly's ${OFFENCE_CARDS.includes(stat) ? 'Offence' : 'Defence'}, ${r(k, 2)}x Fire rate's ${pct(yard(door))}.${['shield', 'regen'].includes(stat) ? ` (This rests on the assumed Shield refill every ${STYLES.careful} s; check it against play before turning the knob.)` : ''}`,
        knob: { at: cardLine(stat), change: `common=${LV.cards[stat].amounts[0]} → ${r(want, d)} (Rare and Epic in step)`, does: 'level with the Fire rate yardstick' } });
    }
  }
  // per type: the best Offence card for each, at the Start and the Encore door
  const best = TYPES.map((t) => [name(t), ...[MOMENTS[0], MOMENTS[4]].map((M) => { const v = OFFENCE_CARDS.map((s) => [s, cardWorth(t, s, 0, M)]).sort((a, b) => b[1] - a[1])[0]; return `${CARD_NAME[v[0]]} ${pct(v[1])}`; })]);
  const offer = offerChance('normal'), notebook = offerChance('normal', 4);
  const odds = [0, 10, 30, 60].map((luck) => [`Luck ${luck}`, ...tierOdds(luck).map((p) => pct(p).slice(1))]);
  const o = tierOdds(), same = (n) => o.slice(0, 2).reduce((s, p) => s + p ** n, 0);
  return {
    id: 'A3', title: 'Level-up cards',
    lede: 'Each card\'s worth as a share of the jelly it lands on, against Fire rate as the yardstick.',
    numbers: [
      ['Rarity odds: Common, Rare, Epic', `${LV.rarities.common} / ${LV.rarities.rare} / ${LV.rarities.epic}`, at('content/levelups.kdl', /^rarities /)],
      ...Object.entries(LV.cards).map(([stat, c]) => [`${CARD_NAME[stat]}: Common / Rare / Epic, weight`, `${c.amounts.join(' / ')}, ${c.weight}`, cardLine(stat)]),
      ['Dodge cap', MAX_DODGE + '%', at('src/stats.js', /MAX_DODGE = /)],
      ['Luck: each rarity step up is (1 + Luck/200)x likelier', 'luckWeights', at('src/stats.js', /export const luckWeights/)],
      ['Three of a kind lifts one card a rarity', 'threeOfAKind', at('src/stats.js', /export function threeOfAKind/)],
      ['Notebook: a fourth card; Game Die: every card a rarity up', `card-choices 1, card-rarity 1`, `${kdl('content/treasures.kdl', 'treasure', 'notebook')}, ${kdl('content/treasures.kdl', 'treasure', 'dice')}`],
    ],
    model: `worth = Offence (or Defence) after the card / before - 1, on the reference Normal jelly at that moment
Fire rate's Common card is the yardstick: a card is flagged at more than 1.5x or under 1/1.5 of it at the ${door.name}
Defence is the careful style (Shield every ${STYLES.careful} s); Range, Move speed and Luck aren't priced here
offered = chance a card is among the 3 (weights, no repeats); three of a kind = ${pct(same(3), 1).slice(1)} of level-ups (${pct(same(4), 1).slice(1)} with the Notebook's 4)`,
    tables: [{ head: ['Card', 'Common / Rare / Epic', ...MOMENTS.map((M) => M.name)], rows },
      { head: ['Type', 'Best Offence card at the Start', 'At the Encore door'], rows: best },
      { head: ['Card', 'Offered (3 cards)', 'With the Notebook (4)'], rows: Object.keys(offer).map((s) => [CARD_NAME[s], pct(offer[s]).slice(1), pct(notebook[s]).slice(1)]) },
      { head: ['Luck', 'Common', 'Rare', 'Epic'], rows: odds }],
    charts: [bars(`Common card worth at the ${door.name}, Normal jelly`, cards.map((s) => [CARD_NAME[s], cardWorth('normal', s, 0, door) * 100, OFFENCE_CARDS.includes(s) ? '' : 'b']), { fmt: (v) => r(v) + '%', ref: yard(door) * 100 }),
      bars('Common Attack damage card at level 1, by type', TYPES.map((t) => [name(t), cardWorth(t, 'bubbleDamage', 0, MOMENTS[0]) * 100]), { fmt: (v) => r(v) + '%', ref: LV.cards.fireRate.amounts[0] })],
    flags,
    notes: ['Shield and Health regen are worth more to a careful player than a brawler: the brawler\'s Shield refills every ' + STYLES.brawler + ' s, not ' + STYLES.careful + '.'],
  };
}

// ------------------------------------------------------------------ A4: the multiplier lines
// Which line each effect word joins (docs/agents/balance-model.md), and how much one copy adds to it
const LINES = [
  { key: 'damage', name: 'Attack damage', words: { stat: (n) => (n.args[0] === 'bubble-damage' ? (n.props.percent ? n.args[1] / 100 : n.args[1] / BASE_STATS.bubbleDamage) : 0) } },
  { key: 'rate', name: 'Fire rate', words: { stat: (n) => (n.args[0] === 'fire-rate' && n.props.percent ? n.args[1] / 100 : 0) } },
  { key: 'crit', name: 'Crit', words: { crit: (n, p) => p.chance * (p.mult - 1) } },
  { key: 'mark', name: 'Marks', words: { 'mark-on-hit': (n, p) => p.more, spotlight: (n, p) => p.more * Math.min(1, p.time / p.every) } },
  { key: 'status', name: 'Status bonus', words: { 'status-damage': (n, p) => p.more + 5 * p['per-stack'], 'burn-ramp': (n, p) => p.most } },
  { key: 'conditional', name: 'Conditional', words: { while: (n, p) => (['bubble-damage', 'fire-rate'].includes(n.args[1]) && p.percent ? n.args[2] / 100 : 0), 'fresh-damage': (n) => n.args[0] / 100, 'shield-full-damage': (n) => n.args[0] / 100, 'focus-ramp': (n, p) => p.most } },
  { key: 'elite', name: 'Elite damage', words: { 'elite-damage': (n) => n.args[0] / 100 } },
];
const GROWS = ['per', 'grow-on-kills', 'bounty', 'stack-buff'];
// the number a line's word turns on, for a knob: [how it reads, value, set(value) as it would be written]
const MAIN = { stat: (w) => [w.args[1], (v) => `stat "${w.args[0]}" ${v}${w.props.percent ? ' percent=#true' : ''}`], crit: (w, p) => [p.chance, (v) => `crit chance=${v}`], 'mark-on-hit': (w, p) => [p.more, (v) => `mark-on-hit more=${v}`],
  'status-damage': (w, p) => (p['per-stack'] ? [p['per-stack'], (v) => `status-damage per-stack=${v}`] : [p.more, (v) => `status-damage more=${v}`]), 'burn-ramp': (w, p) => [p.most, (v) => `burn-ramp most=${v}`],
  while: (w) => [w.args[2], (v) => `while "${w.args[0]}" "${w.args[1]}" ${v}`], 'fresh-damage': (w) => [w.args[0], (v) => `fresh-damage ${v}`], 'shield-full-damage': (w) => [w.args[0], (v) => `shield-full-damage ${v}`],
  'focus-ramp': (w, p) => [p.most, (v) => `focus-ramp most=${v}`], 'elite-damage': (w) => [w.args[0], (v) => `elite-damage ${v}`], spotlight: (w, p) => [p.more, (v) => `spotlight more=${v}`] };
// one item (a treasure, upgrade or evolution) on each line: one copy, and all its copies or its top level
export function linesOf(item, node, n = null) {
  const top = item.levels?.length > 1 ? item.levels.length : item.stack ?? 1;
  const kids = (lv) => (lv > 1 ? node.children.find((c) => c.name === 'level' && c.args[0] === lv)?.children ?? [] : node.children.filter((c) => c.name !== 'level'));
  const sum = (words) => Object.fromEntries(LINES.map((L) => [L.key, words.reduce((s, w) => { const f = L.words[w.name]; return f ? s + f(w, { ...TREASURE_WORDS[w.name]?.props, ...w.props }) : s; }, 0)]));
  const one = sum(kids(1)), levelled = item.levels?.length > 1;
  const all = levelled ? sum(kids(n ?? top)) : Object.fromEntries(Object.entries(one).map(([k, v]) => [k, v * (n ?? top)]));
  return { one, all, top, levelled, grows: kids(1).some((w) => GROWS.includes(w.name)) };
}
function sheetA4() {
  const items = [];
  const groups = [['treasures', CONTENT.treasures, 'treasure'], ['upgrades', CONTENT.upgrades, 'upgrade'], ['evolutions', CONTENT.evolutions, 'evolution']];
  for (const [f, list, kind] of groups) {
    const tree = KDL.parse(read(`content/${f}.kdl`), `content/${f}.kdl`);
    for (const item of list) {
      const node = tree.find((n) => n.args[0] === item.id);
      const L = linesOf(item, node);
      for (const line of LINES) {
        if (!L.one[line.key]) continue;
        const w = node.children.find((c) => line.words[c.name]?.(c, { ...TREASURE_WORDS[c.name]?.props, ...c.props }));   // the first word on this line, for its knob
        const main = MAIN[w.name](w, { ...TREASURE_WORDS[w.name]?.props, ...w.props });
        items.push({ line: line.key, id: item.id, name: item.name, kind, rarity: kind === 'treasure' ? item.rarity : kind, one: L.one[line.key], all: L.all[line.key], top: L.top, levelled: L.levelled, grows: L.grows, at: `content/${f}.kdl:${w.line}`, jelly: item.jelly, main });
      }
    }
  }
  const flags = [];
  const lineRows = LINES.map((line) => {
    const its = items.filter((x) => x.line === line.key && x.all > 0);
    // the most one build holds: every Treasure at full stack, the best 3 evolutions (a Boss pick each)
    // and the best 3 Attack upgrades of one type (a run takes one at the start and after Bosses 1 to 3)
    const best = (list, n) => list.map((x) => x.all).sort((a, b) => b - a).slice(0, n).reduce((s, v) => s + v, 0);
    const tre = best(its.filter((x) => x.kind === 'treasure'), Infinity), evo = best(its.filter((x) => x.kind === 'evolution'), 3);
    const up = Math.max(0, ...TYPES.map((t) => best(its.filter((x) => x.kind === 'upgrade' && x.jelly === t), 3)));
    return { line, its, max: tre + evo + up };
  });
  for (const { line, its } of lineRows) {
    // a Common past a Rare card's worth with one copy; an Attack upgrade past 2.5x its budget (about +40%, the balance plan)
    for (const x of its.filter((y) => (y.rarity === 'common' && y.one >= LV.cards.fireRate.amounts[1] / 100 * 1.5) || (y.kind === 'upgrade' && y.one >= 1))) {
      const want = x.kind === 'upgrade' ? 0.4 : 0.15, [v, write] = x.main;
      flags.push({ text: `${x.name}${x.kind === 'upgrade' ? ` (${a(name(x.jelly))} Attack upgrade)` : ', a Common,'} adds ${pct(x.one)} to the ${line.name} line${x.top > 1 ? ` with one copy, ${pct(x.all)} at ${x.top} ${x.levelled ? 'levels' : 'copies'}` : ''}${['status', 'conditional', 'mark'].includes(line.key) ? ' while it holds' : ''}.`,
        knob: { at: x.at, change: `${write(v)} → ${write(+(v * want / x.one).toPrecision(2))}`, does: `about ${pct(want)}, the ${x.kind === 'upgrade' ? 'Attack upgrade' : 'Common'} budget` } });
    }
    const free = its.filter((x) => x.kind !== 'upgrade');
    if (free.length === 1 && line.key !== 'rate') flags.push({ text: `The ${line.name} line has one Treasure in it (${free[0].name}), so the line's whole bonus multiplies everything else.`,
      knob: { at: free[0].at, change: 'join it to the Attack damage line (stat "bubble-damage" … percent=#true)', does: 'it adds with Lemon Slice and Shot Glass instead of multiplying them' } });
  }
  // Marks change only ordinary bugs (enemies.js returns for an Elite or a Boss first); Elite damage only Elites and Bosses
  const product = (skip) => lineRows.reduce((p, L) => (L.line.key === skip ? p : p * (1 + L.max)), 1);
  return {
    id: 'A4', title: 'The multiplier lines',
    lede: 'Bonuses on one line add; lines multiply. Which line each damage bonus joins, and how far each can reach.',
    numbers: items.map((x) => [`${x.name} (${x.rarity}) → ${LINES.find((L) => L.key === x.line).name}`, `${pct(x.one)}${x.top > 1 ? `, ${pct(x.all)} at ${x.top}` : ''}${x.grows ? ', grows' : ''}`, x.at]),
    model: `Offence = Attack damage line x Fire rate line x (1 + Crit chance x (mult - 1)) x (1 + mark) x (1 + status bonus) x (1 + conditional) x (1 + Elite damage)
           + gadgets (Attack damage x ${GADGET_POWER} x their multiple) + damage over time
Attack damage line counts in shares of Normal's ${BASE_STATS.bubbleDamage} (Lemon Slice's +2 = +33%)
A conditional counts as if it always holds, a mark as if it is always on, a status bonus as if the bug always has it (Poison at ${ELEMENT_BASE.poison.poisonStacks} stacks):
the paper ceiling, not a typical run. Growing items (per, grow-on-kills, bounty) are priced in Wave B4.`,
    tables: [{ head: ['Line', 'Sources', 'One build\'s most', 'x at most'], rows: lineRows.map(({ line, its, max }) => [line.name + (line.key === 'mark' ? ' (bugs only)' : line.key === 'elite' ? ' (Elites and Bosses only)' : ''), its.length, pct(max), `x${r(1 + max, 2)}`]) }],
    charts: [bars('Most each line reaches in one build (x)', lineRows.map(({ line, max }) => [line.name, 1 + max]), { fmt: (v) => 'x' + r(v, 2), ref: 1 })],
    flags,
    notes: [`Every line at its most multiplies to x${r(product('elite'))} on a bug and x${r(product('mark'))} on an Elite or Boss, on paper: every Treasure at full stack, 3 evolutions and 3 Attack upgrades. A typical build needs the run log's pickups by act (the run log additions) to price.`],
  };
}
// ------------------------------------------------------------------ A5: staying alive
function sheetA5() {
  const flags = [], door = MOMENTS[1];
  const S0 = refStats('normal', door.level);
  // Health a card gives over the Vacuum's act, careful and brawler
  const health = (stat, style) => { const S = { ...S0 }; applyCard(S, { stat, amount: cardAmount(stat, LV.cards[stat].amounts[0], S[stat]) }); return defence(S, door.A, style) - defence(S0, door.A, style); };
  const priced = DEFENCE_CARDS.map((s) => [CARD_NAME[s], health(s, 'careful'), health(s, 'brawler')]);
  const supply = ACTS.map((A, i) => { const S = refStats('normal', RUN_LOG.level[i]); return [A.n, defence(S, A), defence(S, A, 'brawler'), RUN_LOG.healthLost[i]]; });
  // Pot Lid: max Health becomes Shield (health-to-shield)
  const pot = (style) => { const S = { ...S0, shield: S0.shield + S0.health - 1, health: 1, regen: 0 }; return defence(S, door.A, style) - defence(S0, door.A, style); };
  // Thimble: one less Health a hit, against each act's typical bug hit
  const hitOf = (E) => Math.max(E.dmg, ...E.words.map((w) => +w.dmg || 0).filter(Number.isFinite));
  const typical = ACTS.map((A) => { const N = night(A); const t = Object.entries(N.per).reduce((s, [id, k]) => s + k * hitOf(CONTENT.enemies[id]) * A.power, 0) / Object.values(N.per).reduce((a, b) => a + b, 0); return t; });
  const [, thimble, least = TREASURE_WORDS['hit-less'].props.least] = read('content/treasures.kdl').match(/hit-less ([\d.]+)(?: least=([\d.]+))?/).map(Number);
  const off = (t) => (t > least ? Math.min(thimble, t - least) / t : 0);   // run.js hit: never below least
  const potC = pot('careful'), potB = pot('brawler');
  if (potB > 0.7 * DEF0) flags.push({ text: `On paper Pot Lid gives ${r(potC)} Health over the Vacuum act to a careful player and ${r(potB)} to a brawler, far past a Legendary's 70 points (${r(0.7 * DEF0)} Health). The catch the sum can't see: at 1 Health, the first hit while the Shield is down ends the run.`,
    knob: { at: kdl('content/treasures.kdl', 'treasure', 'potLid'), change: 'health-to-shield keeps 5 Health, not 1 (a keep= on the word)', does: 'one stray hit is no longer the end, and the paper number stops hiding the risk' } });
  if (off(typical[3]) < off(typical[0]) / 1.5) flags.push({ text: `The Thimble takes ${thimble} off each hit (never below ${least}): ${pct(off(typical[0])).slice(1)} of a typical act 1 hit, ${pct(off(typical[3])).slice(1)} of an act 4 one.`,
    knob: { at: kdl('content/treasures.kdl', 'treasure', 'thimble'), change: 'hit-less 1 → a share of each hit (a new word, hit-share)', does: 'keeps its worth in every act' } });
  // evolution costs in Health: a negative percent of starting Health
  const evo = CONTENT.evolutions.map((e) => { const node = KDL.parse(read('content/evolutions.kdl'), 'e').find((n) => n.args[0] === e.id); const w = node.children.find((c) => c.name === 'stat' && c.args[0] === 'health' && c.args[1] < 0); return w ? [e, w.props.percent ? BASE_STATS.health * w.args[1] / 100 : w.args[1], w] : null; }).filter(Boolean);
  const felt = 0.2 * DEF0;   // a cost worth at least 20 Defence points
  for (const [e, hp, w] of evo) if (-hp < felt) flags.push({ text: `${e.name} costs ${r(-hp)} max Health${w.props.percent ? ` (${-w.args[1]}% of a starting ${BASE_STATS.health})` : ''}, under 20 Defence points (${r(felt)} Health) for a Normal jelly.`,
    knob: { at: `content/evolutions.kdl:${w.line}`, change: `stat "health" ${w.args[1]} → ${w.props.percent ? -Math.round(100 * felt / BASE_STATS.health) : -Math.round(felt)}`, does: `a cost of ${r(felt)} Health, 20 Defence points` } });
  const snooze = read('content/treasures.kdl').match(/death-save health=([\d.]+)/)[1];
  return {
    id: 'A5', title: 'Staying alive',
    lede: 'Health, Shield, Health regen and Dodge on one scale: Health you can spend in an act.',
    numbers: [
      ['Normal Health, Shield, regen, Dodge', `${BASE_STATS.health}, ${BASE_STATS.shield}, ${BASE_STATS.regen}, ${BASE_STATS.dodge}`, at('src/stats.js', /^ {2}health:/)],
      ['Shield waits, fills (s)', `${SHIELD_WAIT}, ${SHIELD_FILL}`, at('src/stats.js', /SHIELD_WAIT = /)],
      ['Dodge cap; Odd Sock raises it to', `${MAX_DODGE}%, 80%`, at('src/stats.js', /MAX_DODGE = /)],
      ...DEFENCE_CARDS.map((s) => [`${CARD_NAME[s]} card`, LV.cards[s].amounts.join(' / '), cardLine(s)]),
      ...ACTS.map((A) => [`Act ${A.n}: hits on you x`, A.power, A.n === 1 ? A.file : knob(A, 'power')]),
      ['Thimble: Health off each hit', thimble, kdl('content/treasures.kdl', 'treasure', 'thimble')],
      ['Snooze Button: a save at this share of max Health, once a run', snooze, kdl('content/treasures.kdl', 'treasure', 'snooze')],
      ['Pot Lid: max Health becomes Shield', 'health-to-shield', kdl('content/treasures.kdl', 'treasure', 'potLid')],
      ['Shot Glass: hits take', 'x1.25', kdl('content/treasures.kdl', 'treasure', 'shotGlass')],
      ['Health lost per cleared act', RUN_LOG.healthLost.join(', '), 'tools/balance-sheet.mjs RUN_LOG'],
    ],
    model: `Health to spend in an act = (Health + Shield x act seconds / refill gap + regen x act seconds) / ((1 - Dodge) x damage taken)
act seconds = night + the run log's Boss fight; refill gap: careful ${STYLES.careful} s, brawler ${STYLES.brawler} s
Health lost (run log) already counts the act's power and is before Shield; it is what survivors spent, not a limit
A death save is worth ${snooze} x max Health once a run, and the run itself.`,
    tables: [{ head: ['Source', 'Health over the Vacuum act, careful', 'Brawler'], rows: [...priced.map(([n, c, b]) => [`Common ${n} card`, r(c), r(b)]), ['Pot Lid', r(potC), r(potB)], ['Snooze Button (once a run)', r(snooze * S0.health), r(snooze * S0.health)]] },
      { head: ['Act', 'Reference jelly can spend, careful', 'Brawler', 'Real Health lost'], rows: supply.map(([n, c, b, d]) => [n, r(c), r(b), d]) },
      { head: ['Act', 'Typical bug hit (with power)', 'Thimble takes off'], rows: typical.map((t, i) => [i + 1, r(t, 2), pct(off(t)).slice(1)]) }],
    charts: [bars('Health a Common card gives over the Vacuum act (careful)', priced.map(([n, c]) => [n, c]), { fmt: (v) => r(v) }),
      grouped('Health to spend in each act against Health lost', ['Act 1', 'Act 2', 'Act 3', 'Act 4'], [['Careful', supply.map((s) => s[1])], ['Brawler', supply.map((s) => s[2])], ['Lost (real)', supply.map((s) => s[3])]], (v) => r(v))],
    flags,
    notes: ['Heals from Treasures (Baby Bottle, Whale, Bloody Fangs, Meatball) need kills, jumps and hits from play: Wave B4 prices them with the run log.'],
  };
}

// ================================================================== Wave B: what you pick up
// The same model, now for Treasures, Attack upgrades and evolutions. One pick is priced by running the
// game's own compileMods (src/content.js) with and without it on the reference jelly, so a word the
// game reads is read here the same way. Points are percent of the reference jelly's Offence plus
// percent of its Defence at that moment (at the Start that is the docs' 1% of a level 1 Normal jelly).
// Assumptions the files can't give are in ASSUME, each with its reason; the page prints them.
export const ASSUME = {
  area: 3,          // bugs an area hit reaches (the clump of 5 in sheet A1 is the ceiling)
  while: { airborne: 0.25, moving: 0.8, unhurt: 0.5, rooted: 0.2, 'low-health': 0.1, lit: 0.3, wet: 0.3 },   // share of a fight each `while` holds
  moving: 0.6,      // share of the time the jelly is swimming
  swim: 0.42,       // m/s at Move speed 1 (the balance plan)
  bountyKill: 8,    // seconds to clear a Chore List target after it appears
  orbitGap: 0.4,    // an orbiting bulb hurts a bug at most this often (words.js orbit-lights)
};
export const PICK = { common: 15, rare: 25, epic: 40, legendary: 70, upgrade: 40 };   // points a pick should be worth (docs/agents/balance-model.md)
const STACK_COMMON = 60;                  // a Common at full stack
const TREE = {};
const tree = (f) => (TREE[f] ??= KDL.parse(read(`content/${f}.kdl`), `content/${f}.kdl`));
export const nodeOf = (f, id) => tree(f).find((n) => n.args[0] === id);
const LIVE = (list) => list.filter((t) => !t.retired);
const forType = (item, type) => !(item.notFor || []).includes(CONTENT.jellies[type].attack);
const modsOf = (type, { t = {}, e = [], u = [] } = {}) => compileMods({ count: (id) => t[id] || 0 }, e, u, type);
const gapOf = (i) => (i < 0 ? Infinity : ACTS[i].night / Math.max(0.5, RUN_LOG.level[i] - (RUN_LOG.level[i - 1] ?? 1)));   // seconds between level-ups in act i

// The stats a jelly has with `m` on: Run.S (src/run.js) with a `while` held for its share of a fight
// and a level-up buff for the share of the gap it lasts. Other buffs (kills, hits) are left out.
export function withMods(type, S0, m, gap = Infinity) {
  const base = baseOf(type), S = { ...S0 };
  for (const k in S) S[k] = S0[k] + (m.stats.add[k] || 0) + base[k] * (m.stats.pct[k] || 0) / 100;
  for (const c of m.whiles) S[c.stat] += (ASSUME.while[c.when] ?? 0.3) * (c.percent ? base[c.stat] * c.amount / 100 : c.amount);
  for (const b of m.buffs) if (b.event === 'level-up') S[b.stat] += Math.min(b.stacks, b.time / gap) * (b.percent ? base[b.stat] * b.amount / 100 : b.amount);
  S.bubbles = Math.max(1, Math.min(MAX_BUBBLES, Math.round(S.bubbles)));
  const cap = S.dodgeCap = Math.max(MAX_DODGE, m.dodgeCap);
  let left = 1;
  for (const d of m.stats.dodge) left *= 1 - Math.min(1, d / cap);
  S.dodge = Math.min(cap, Math.max(0, S.dodge) + cap * (1 - left));
  if (m.shield.fromHealth) { S.shield += Math.max(0, S.health - 1); S.health = 1; }
  if (m.noRegen === true) S.regen = 0;
  S.taken = m.damageTaken;
  return S;
}

// Paper damage a second from timed words, orbiting lights, a beam and an aura, on the reference jelly.
// `left` names the effect kinds that could hurt but aren't priced here (they need play).
const HITS = { ring: (e) => e.dmg * ASSUME.area, zap: (e) => e.count * e.dmg, brick: (e) => e.dmg * (e.burst ? ASSUME.area : 1), marble: (e) => e.dmg * ASSUME.area, swatter: (e) => e.mult, geyser: (e) => e.dmg * ASSUME.area,
  cone: (e) => e.dmg * ASSUME.area, shards: (e) => e.count * e.dmg, 'bubble-ring': (e) => e.count * e.dmg / GADGET_POWER, orb: (e) => e.dmg };   // (a bubble ring's bubbles hit for Attack damage, not power)
const NO_DAMAGE = ['puddle', 'xp', 'heal', 'ink', 'cloud', 'reach-flare', 'pass-stacks'];
export function gadgets(m, S) {
  const P = S.bubbleDamage * GADGET_POWER, left = new Set();
  let dps = 0;
  for (const t of m.timed) for (const e of t.effects) { const f = HITS[e.kind]; if (f) dps += P * f(e) / t.every; else if (!NO_DAMAGE.includes(e.kind)) left.add(e.kind); }
  if (m.orbit) dps += P * m.orbit.dmg / ASSUME.orbitGap;   // one bug on the ring at a time
  if (m.beam) dps += P * m.beam.dmg / m.beam.tick;
  if (m.aura) dps += P * m.aura.dmg / m.aura.tick * ASSUME.area;
  return { dps, left: [...left] };
}

// What an item adds, in points, to the reference jelly at a moment: the same jelly with `spec` and without `base`.
// fx multiplies Offence for the lines the stats don't carry (Crit, marks, status bonus), as sheet A4 counts them.
export function worth(type, M, spec, { fx = 1, base = {}, gap = Infinity } = {}) {
  const S0 = refStats(type, M.level), m0 = modsOf(type, base), m1 = modsOf(type, spec);
  const A0 = withMods(type, S0, m0, gap), A1 = withMods(type, S0, m1, gap), g0 = gadgets(m0, A0), g1 = gadgets(m1, A1);
  const o0 = offence(type, A0) + g0.dps, o1 = (offence(type, A1) + g1.dps) * fx;
  const def = (S) => defence(S, M.A, 'careful', S.taken);
  return { off: 100 * (o1 / o0 - 1), def: 100 * (def(A1) / def(A0) - 1), gad: 100 * (g1.dps - g0.dps) / o0, dps: g1.dps - g0.dps, left: g1.left, m: m1 };
}
const total = (w) => w.off + w.def;
// the cost side: only the stat parts that take something away
export function costOf(type, M, spec) {
  const S0 = refStats(type, M.level), m = modsOf(type, spec), neg = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.min(0, v)]));
  const mn = { stats: { add: neg(m.stats.add), pct: neg(m.stats.pct), dodge: [] }, whiles: [], buffs: [], dodgeCap: 0, shield: { fromHealth: false }, noRegen: false, damageTaken: Math.max(1, m.damageTaken) };
  const A0 = withMods(type, S0, { ...mn, stats: { add: {}, pct: {}, dodge: [] }, damageTaken: 1 }), A1 = withMods(type, S0, mn);
  const def = (S) => defence(S, M.A, 'careful', S.taken);
  return 100 * (offence(type, A1) / offence(type, A0) - 1) + 100 * (def(A1) / def(A0) - 1);
}
// the lines a pick carries outside the stats, at n copies (or level n): crit, marks, status bonus, and a conditional that isn't a `while` (those are in the stats)
export function fxOf(item, node, n = 1) {
  const L = linesOf(item, node, n).all, hasWhile = (item.vocabulary || []).includes('while');
  return ['crit', 'mark', 'status', ...(hasWhile ? [] : ['conditional'])].reduce((p, k) => p * (1 + (L[k] || 0)), 1);
}
// the words a price covers; everything else a pick says is listed as not priced
const PRICED = new Set(['stat', 'crit', 'mark-on-hit', 'status-damage', 'burn-ramp', 'while', 'fresh-damage', 'shield-full-damage', 'focus-ramp', 'damage-taken', 'dodge-cap', 'stack-buff', 'every', 'orbit-lights', 'beam', 'aura', 'health-to-shield', 'no-regen', 'adorn']);
const unpricedOf = (item) => [...new Set((item.vocabulary || []).filter((w) => !PRICED.has(w)))];
// the number a pick's change turns on: the first word A4 knows (a stat that adds), else the first dmg= or mult= inside it
function turn(node, level = 1) {
  const kids = level > 1 ? node.children.find((c) => c.name === 'level' && c.args[0] === level)?.children ?? [] : node.children.filter((c) => c.name !== 'level');
  for (const w of kids) { if (MAIN[w.name] && (w.name !== 'stat' || w.args[1] > 0)) { const [v, write] = MAIN[w.name](w, { ...TREASURE_WORDS[w.name]?.props, ...w.props }); return { v, write, line: w.line }; } }
  const NUM = { 'grow-on-kills': 1, per: 1, bounty: 1, 'xp-mult': 0, 'distance-xp': 0, 'more-treasures': 0 };
  for (const w of kids) if (NUM[w.name] != null) { const i = NUM[w.name], put = (x) => `${w.name} ${w.args.map((q, j) => (j === i ? x : typeof q === 'string' ? `"${q}"` : q)).join(' ')}${Object.entries(w.props).map(([k, q]) => ` ${k}=${q === true ? '#true' : typeof q === 'string' ? `"${q}"` : q}`).join('')}`; return { v: w.args[i], write: put, line: w.line }; }
  const find = (ws) => { for (const w of ws) { for (const k of ['dmg', 'mult']) if (typeof w.props[k] === 'number') return { v: w.props[k], write: (x) => `${w.name} ${k}=${x}`, line: w.line }; const f = find(w.children); if (f) return f; } return null; };
  return find(kids);
}
const scaled = (t, want, have) => { const k = want / have; return { change: `${t.write(t.v)} → ${t.write(+(t.v * k).toPrecision(2))}`, does: `about ${r(want)} points, ${r(have)} now` }; };
const MOMENT_VAC = MOMENTS[1], MOMENT_ENC = MOMENTS[4];
const rarityName = (x) => ({ common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' })[x];
const budgetOf = (item, kind) => (kind === 'upgrade' ? PICK.upgrade : PICK[item.rarity]);
function seeded(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ------------------------------------------------------------------ B1: chests and rarity odds
// What a chest can hold for a Normal jelly at the start: no needs=, nothing retired
const ROOM_CHESTS = ACTS.reduce((s, A) => s + A.stage.treasures.at.length, 0), ELITE_CHESTS = ACTS.reduce((s, A) => s + A.stage.elites.length, 0);
export const startPool = () => LIVE(CONTENT.treasures).filter((t) => !t.needs && !t.needsChance && forType(t, 'normal'));
export function chestOdds(source, luck, trials = 6000) {
  const rng = seeded(11 + luck), pool = startPool().filter((t) => CHEST_WEIGHTS[source][t.rarity] > 0), seen = {}, favor = (t) => CHEST_WEIGHTS[source][t.rarity] / treasureTier(t).weight;
  let legend = 0;
  for (let i = 0; i < trials; i++) { const got = rollTreasures(pool, 3, luck, favor, rng); if (got.some((t) => t.rarity === 'legendary')) legend++; for (const t of got) seen[t.id] = (seen[t.id] || 0) + 1; }
  const per = Object.fromEntries(TREASURE_RARITY.map((R) => { const ids = pool.filter((t) => t.rarity === R.id); return [R.id, ids.length ? ids.reduce((s, t) => s + (seen[t.id] || 0), 0) / trials / ids.length : 0]; }));
  return { legend: legend / trials, per };
}
// what a pick from a source is worth on average, from its rarity weights
const pickWorth = (source) => { const W = CHEST_WEIGHTS[source], s = Object.values(W).reduce((p, q) => p + q, 0); return Object.entries(W).reduce((p, [k, w]) => p + w / s * PICK[k], 0); };
function sheetB1() {
  const flags = [], pool = startPool(), all = LIVE(CONTENT.treasures), counts = TREASURE_RARITY.map((R) => [R.id, all.filter((t) => t.rarity === R.id).length, pool.filter((t) => t.rarity === R.id).length]);
  const lucks = [0, 20, 40, 60], rows = lucks.map((L) => ({ L, room: chestOdds('room', L), elite: chestOdds('elite', L) }));
  const runSee = (o) => 1 - (1 - o.room.legend) ** ROOM_CHESTS * (1 - o.elite.legend) ** ELITE_CHESTS;
  const zero = rows[0];
  // each Common is offered how many times as often as each Rare
  const ratio = zero.room.per.common / zero.room.per.rare;
  if (ratio >= 2) {
    const w = CHEST_WEIGHTS.room, want = Math.round(2 * w.rare * counts[0][2] / counts[1][2]);
    flags.push({ text: `In a room chest each one of the ${counts[0][2]} Commons is offered ${r(ratio, 1)}x as often as each one of the ${counts[1][2]} Rares (${pct(zero.room.per.common).slice(1)} against ${pct(zero.room.per.rare).slice(1)} of chests), because a rarity's weight is shared among its members.`,
      knob: { at: at('src/stats.js', /^ {2}room: /), change: `common ${w.common} → ${want}`, does: 'each Common shows up about twice as often as each Rare, not more' } });
  }
  const keyN = LIVE(CONTENT.treasures).find((t) => t.id === 'windUpKey'), bagN = nodeOf('treasures', 'goodieBag');
  const extraRoom = ROOM_CHESTS * 0.2, keyWorth = extraRoom * pickWorth('room');
  if (keyWorth > 1.5 * PICK.rare) {
    const want = Math.max(1, Math.round(20 * PICK.rare / keyWorth));
    flags.push({ text: `One Wind-Up Key brings about ${r(extraRoom)} more room chests over a run, and a room pick is worth about ${r(pickWorth('room'))} points on average: ${r(keyWorth)} points against a Rare's ${PICK.rare} (taken at the start; ${r(3 * keyWorth)} at 3 copies).`,
      knob: { at: kdl('content/treasures.kdl', 'treasure', keyN.id), change: `more-treasures 20 → ${want}`, does: `a copy brings about ${r(ROOM_CHESTS * want / 100)} chests, worth the Rare budget` } });
  }
  const bagWorth = (every) => Math.floor(ELITE_CHESTS / every) * pickWorth('elite');
  if (bagWorth(2) > 1.5 * PICK.legendary) {
    const best = [3, 4, 5, 6].map((e) => [e, Math.abs(bagWorth(e) - PICK.legendary)]).sort((p, q) => p[1] - q[1])[0][0];
    flags.push({ text: `The Goodie Bag, with an Elite pick worth about ${r(pickWorth('elite'))} points, brings ${Math.floor(ELITE_CHESTS / 2)} extra picks over ${ELITE_CHESTS} Elites: ${r(bagWorth(2))} points against a Legendary's ${PICK.legendary} (taken at the start).`,
      knob: { at: kdl('content/treasures.kdl', 'treasure', bagN.args[0]), change: `elite-bonus every=2 → every=${best}`, does: `${Math.floor(ELITE_CHESTS / best)} extra picks, about ${r(bagWorth(best))} points` } });
  }
  const nLeg = (o) => ROOM_CHESTS * o.room.legend + ELITE_CHESTS * o.elite.legend;
  if (nLeg(rows[3]) < 1.5 * nLeg(zero)) flags.push({ text: `Luck 60 lifts the chests that offer a Legendary in a run from ${r(nLeg(zero))} to ${r(nLeg(rows[3]))}, x${r(nLeg(rows[3]) / nLeg(zero), 2)} for the most Luck there is.`,
    knob: { at: at('src/stats.js', /export const luckWeights/), change: '(1 + luck/200) → (1 + luck/120) per rarity step', does: 'Luck 60 makes each step up 1.5x as likely, not 1.3x' } });
  return {
    id: 'B1', title: 'Chests and rarity odds',
    lede: 'What a chest offers, how often each Treasure turns up, and what Luck buys. Odds are rolled with the game\'s own rollTreasures on a fixed seed, for a Normal jelly at the start.',
    numbers: [
      ['Room chest weights: Common, Rare, Epic, Legendary', Object.values(CHEST_WEIGHTS.room).join(' / '), at('src/stats.js', /^ {2}room: /)],
      ['Elite chest weights', Object.values(CHEST_WEIGHTS.elite).join(' / '), at('src/stats.js', /^ {2}elite: /)],
      ['Luck: each rarity step up is (1 + Luck/200)x likelier', 'luckWeights', at('src/stats.js', /export const luckWeights/)],
      ...ACTS.map((A) => [`Act ${A.n}: room chests at (s), Elites`, `${A.stage.treasures.at.join(', ')}, ${A.stage.elites.length}`, at(A.file, /^ {2}treasures:/)]),
      ['Wind-Up Key: more room chests per copy', '20%', kdl('content/treasures.kdl', 'treasure', 'windUpKey')],
      ['Goodie Bag: every 2nd Elite leaves a second pick', 'every 2', kdl('content/treasures.kdl', 'treasure', 'goodieBag')],
      ...counts.map(([id, n, p]) => [`${rarityName(id)} Treasures in play, offered to Normal at the start`, `${n}, ${p}`, 'content/treasures.kdl']),
    ],
    model: `A chest rolls 3 Treasures without repeats (rollTreasures, src/stats.js): each slot picks a rarity by weight x (1 + Luck/200)^step, then one Treasure of it.
Each Treasure of a rarity has that rarity's chance divided by how many there are, so more Treasures of a rarity means each shows up less.
Chests in a run: ${ROOM_CHESTS} room (stage treasures.at) and ${ELITE_CHESTS} Elite, plus the Boss's Legendary pick (not counted here).
Pick worth = the chest's weights x the budget (Common ${PICK.common}, Rare ${PICK.rare}, Epic ${PICK.epic}, Legendary ${PICK.legendary}): room ${r(pickWorth('room'))}, Elite ${r(pickWorth('elite'))}.
Odds are ${6000} seeded rolls per cell, so each is good to about a point of chance.`,
    tables: [
      { head: ['Rarity', 'In play', 'At the start (no needs=)', 'Chance one is in a room chest', 'In an Elite chest'], rows: counts.map(([id, n, p]) => [rarityName(id), n, p, pct(zero.room.per[id], 1).slice(1), pct(zero.elite.per[id], 1).slice(1)]) },
      { head: ['Luck', 'Room chest has a Legendary', 'Elite chest has a Legendary', `Chests in a run with one (of ${ROOM_CHESTS + ELITE_CHESTS})`, 'A run sees at least one'], rows: rows.map((o) => [o.L, pct(o.room.legend, 1).slice(1), pct(o.elite.legend, 1).slice(1), r(nLeg(o)), pct(runSee(o)).slice(1)]) },
    ],
    charts: [bars('Chance a Treasure of each rarity is in a room chest (each one)', counts.map(([id]) => [rarityName(id), zero.room.per[id] * 100]), { fmt: (v) => r(v, 1) + '%' }),
      bars('Chests in a run that offer a Legendary, by Luck', rows.map((o) => [`Luck ${o.L}`, nLeg(o)]), { fmt: (v) => r(v, 1), cls: 'b' })],
    flags,
    notes: ['A Treasure with needs= (Pizza Cutter is not, but Lucky Cat needs a chance effect) joins the pool later; the table counts what a Normal jelly can be offered at the start.', 'The Boss\'s Legendary pick is separate: 3 from the Legendary Treasures and evolutions you can take, so a run sees 4 such picks.'],
  };
}

// ------------------------------------------------------------------ B2: stat Treasures
// Treasures that only move stats, add a Crit or a mark, or condition a stat. Priced on every jelly type that can be offered them.
const STATLIKE = new Set(['stat', 'damage-taken', 'dodge-cap', 'dodge-slip', 'stack-buff', 'while', 'crit', 'mark-on-hit', 'fresh-damage', 'shield-full-damage', 'shot-speed', 'elite-damage']);
export const statTreasures = () => LIVE(CONTENT.treasures).filter((t) => t.vocabulary.every((w) => STATLIKE.has(w)));
// one pick of a Treasure at a moment: n copies (or level n), on one type
export function treasureWorth(t, type, M, n = 1, gapAt = -1) {
  const node = nodeOf('treasures', t.id);
  return worth(type, M, { t: { [t.id]: n } }, { fx: fxOf(t, node, n), gap: gapOf(gapAt) });
}
function sheetB2() {
  const flags = [], items = statTreasures(), rows = [], chartRows = [];
  const gapAt = [-1, 0, 3];   // the start has no level-up gap; the Vacuum act and the Encore act
  const moments = [MOMENTS[0], MOMENT_VAC, MOMENT_ENC];
  for (const t of items) {
    const node = nodeOf('treasures', t.id), types = TYPES.filter((x) => forType(t, x)), one = moments.map((M, i) => total(treasureWorth(t, 'normal', M, 1, gapAt[i])));
    const full = total(treasureWorth(t, 'normal', MOMENT_VAC, t.stack, 0)), spread = types.map((x) => total(treasureWorth(t, x, MOMENT_VAC, 1, 0)));
    const eliteOnly = t.vocabulary.length === 1 && t.vocabulary[0] === 'elite-damage';
    const budget = PICK[t.rarity], left = unpricedOf(t);
    rows.push([t.name, rarityName(t.rarity), t.stack, ...one.map((v) => r(v)), r(full), `${r(Math.min(...spread))} to ${r(Math.max(...spread))}`, r(budget), left.length ? left.join(', ') : eliteOnly ? 'Elites and Bosses only' : '']);
    chartRows.push([t.name, one[1], t.rarity === 'common' ? '' : t.rarity === 'rare' ? 'b' : 'c']);
    if (eliteOnly || !(one[1] > 0)) continue;
    const v = one[1], want = budget, T = turn(node), whens = [...new Set(treasureWorth(t, 'normal', MOMENT_VAC, 1, 0).m.whiles.map((c) => c.when))], holds = whens.length ? ` It counts as holding ${whens.map((x) => `${pct(ASSUME.while[x] ?? 0.3).slice(1)} (${x})`).join(', ')} of a fight.` : '';
    if (T && (v > 1.5 * want || v < 0.5 * want)) flags.push({ text: `${t.name}, ${a(rarityName(t.rarity))}, is worth ${r(v)} points a copy at the Vacuum door on a Normal jelly (${r(Math.min(...spread))} to ${r(Math.max(...spread))} across the types it is offered to), against a ${rarityName(t.rarity)} budget of ${budget}.${left.length ? ` (Not priced: ${left.join(', ')}.)` : ''}${holds}`,
      knob: { at: `content/treasures.kdl:${T.line}`, ...scaled(T, want, v) } });
  }
  return {
    id: 'B2', title: 'Stat Treasures',
    lede: `The ${items.length} Treasures that move stats, add a Crit or a mark, or condition a stat, each priced against its rarity's budget. Range, Move speed and jump stay unpriced.`,
    numbers: items.map((t) => [`${t.name} (${t.rarity}, x${t.stack})`, t.text, kdl('content/treasures.kdl', 'treasure', t.id)]).concat([['Budgets per copy', Object.entries(PICK).map(([k, v]) => `${k} ${v}`).join(', '), 'docs/agents/balance-model.md'], ['A `while` holds for this share of a fight', Object.entries(ASSUME.while).map(([k, v]) => `${k} ${v}`).join(', '), 'tools/balance-sheet.mjs ASSUME']]),
    model: `points = 100 x (Offence after / before - 1) + 100 x (Defence after / before - 1), on the reference jelly at the moment
the stats come from the game's own compileMods, applied as Run.S does; a while condition holds for the share of a fight in ASSUME.while;
a level-up buff (Coffee Bean) lasts its seconds out of the act's gap between level-ups; Crit, marks and status bonuses count as in A4 (always on)
Elite damage works on Elites and Bosses only, so it is listed but not flagged. A drawback (Shot Glass's x1.25 hits, Hot Chili's -30% Range) is priced when it is a stat;
Range itself is not, so Hot Chili's cost shows only through its Attack damage and Fire rate.`,
    tables: [{ head: ['Treasure', 'Rarity', 'Copies', 'One copy at the Start', 'At the Vacuum door', 'At the Encore door', 'Full stack, Vacuum door', 'Vacuum door, across its types', 'Budget a copy', 'Not priced'], rows }],
    charts: [bars('One copy at the Vacuum door, points (Common blue, Rare green, Epic orange)', chartRows, { fmt: (v) => r(v), ref: PICK.common })],
    flags,
    notes: [`A Common at full stack should be about ${STACK_COMMON} points; the full-stack column is the check.`, 'Worth differs by type because the same +2 Attack damage is a bigger share of a slower attack: the spread column is the check on a Treasure that is only good for some.'],
  };
}

// ------------------------------------------------------------------ B3: gadget Treasures
// Treasures whose effect is a timed, orbiting, beam or aura effect: paper damage a second if every hit lands.
export const gadgetTreasures = () => LIVE(CONTENT.treasures).filter((t) => [1, 2, 3].some((n) => { const m = modsOf('normal', { t: { [t.id]: Math.min(n, t.levels.length > 1 ? t.levels.length : 1) } }); return m.timed.length || m.orbit || m.beam || m.aura; }));
function sheetB3() {
  const flags = [], items = gadgetTreasures(), rows = [], priced = [];
  for (const t of items) {
    const node = nodeOf('treasures', t.id), levels = t.levels.length > 1 ? t.levels.length : 1;
    const w = [...Array(levels).keys()].map((i) => treasureWorth(t, 'normal', MOMENT_VAC, i + 1, 0));
    const left = [...new Set(w.flatMap((x) => x.left))], every = modsOf('normal', { t: { [t.id]: 1 } }).timed.map((x) => x.every), ev = unpricedOf(t);
    const pts = w.map((x) => x.gad), L1 = pts[0];
    priced.push({ t, node, pts, L1, w });
    rows.push([t.name, rarityName(t.rarity), every.length ? every.join(', ') + ' s' : 'always on', ...[0, 1, 2].map((i) => (pts[i] != null ? r(pts[i]) : '')), r(PICK[t.rarity]), r(w[0].dps, 2), [...left, ...ev.filter((x) => !['every', 'orbit-lights', 'beam', 'aura', 'while', 'stat'].includes(x))].join(', ')]);
    const T = turn(node, 1);
    if (T && (L1 > 2 * PICK[t.rarity] || (L1 > 0 && L1 < 0.4 * PICK[t.rarity]))) flags.push({ text: `${t.name}, ${a(rarityName(t.rarity))}, does ${r(L1)} points of paper damage at the Vacuum door with one level, against a ${rarityName(t.rarity)} budget of ${PICK[t.rarity]} (every hit landing, ${ASSUME.area} bugs for an area).`,
      knob: { at: `content/treasures.kdl:${T.line}`, ...scaled(T, PICK[t.rarity], L1) } });
    if (levels === 3 && pts[0] > 0 && pts[2] < 1.6 * pts[0]) {
      const T3 = turn(node, 3);
      if (T3) flags.push({ text: `${t.name}'s level 3 does ${r(pts[2])} points against ${r(pts[0])} at level 1 (x${r(pts[2] / pts[0], 2)}): two more picks for under double.`,
        knob: { at: `content/treasures.kdl:${T3.line}`, ...scaled(T3, 2 * pts[0], pts[2]) } });
    }
  }
  const rares = priced.filter((x) => x.t.rarity === 'rare' && x.L1 > 0), bestRare = rares.sort((p, q) => q.L1 - p.L1)[0];
  for (const x of priced.filter((y) => y.t.rarity === 'legendary')) if (bestRare && x.L1 < bestRare.L1) {
    const T = turn(x.node, 1);
    if (T) flags.push({ text: `${x.t.name}, a Legendary, does ${r(x.L1)} points of paper damage; ${bestRare.t.name}, a Rare, does ${r(bestRare.L1)} with one level.`, knob: { at: `content/treasures.kdl:${T.line}`, ...scaled(T, PICK.legendary, x.L1) } });
  }
  const evented = LIVE(CONTENT.treasures).filter((t) => !items.includes(t) && t.vocabulary.some((w) => ['landing-shockwave', 'squeak-when-hit', 'burst-on-kill', 'on-attack', 'ghosts', 'zap-on-pop', 'when-hit', 'leave-on-kill', 'overkill', 'reflect', 'toy-mouse', 'swat', 'stomp'].includes(w)));
  return {
    id: 'B3', title: 'Gadget Treasures',
    lede: 'Timed, orbiting, beam and aura Treasures: damage a second on paper with every hit landing. How often a hit lands needs play: the clear test measures it, one Treasure at a time, on request.',
    numbers: items.map((t) => [`${t.name} (${t.rarity})`, t.text, kdl('content/treasures.kdl', 'treasure', t.id)]).concat([['Gadget power, x Attack damage', GADGET_POWER, at('src/run.js', /get power\(\)/)], ['Bugs an area hit reaches; an orbit bulb hurts a bug at most every (s)', `${ASSUME.area}; ${ASSUME.orbitGap}`, 'tools/balance-sheet.mjs ASSUME']]),
    model: `damage a second = Attack damage x ${GADGET_POWER} x its multiple x bugs reached / seconds between uses (timed)
orbit lights: dmg per bulb every ${ASSUME.orbitGap} s on the one bug on the ring; beam: dmg every tick on 1 bug; aura: dmg every tick on ${ASSUME.area} bugs, at its full size
points = that damage a second as a share of the reference Normal jelly's Offence at the Vacuum door
hit rate (how often it lands, how many bugs it reaches in a real crowd) is not on paper: the clear test fills it in
event-driven Treasures (${evented.map((t) => t.name).join(', ')}) fire on a hit, a kill, a landing or a hit taken: their rate is play, so they are left out`,
    tables: [{ head: ['Treasure', 'Rarity', 'Every', 'Level 1', 'Level 2', 'Level 3', 'Budget', 'Damage a second, level 1', 'Not priced'], rows }],
    charts: [bars('Paper damage at level 1, Vacuum door (points; line is a Rare\'s budget)', priced.map((x) => [x.t.name, x.L1, x.t.rarity === 'common' ? '' : x.t.rarity === 'rare' ? 'b' : x.t.rarity === 'epic' ? 'c' : '']), { fmt: (v) => r(v), ref: PICK.rare })],
    flags,
    notes: ['Paper damage is a ceiling: the real number is this times how often the hit lands. Treat a flag as "measure this one", not as proof.'],
  };
}

// ------------------------------------------------------------------ B4: growing and economy Treasures
// What an act brings, from the night model and the run log: bugs killed, levels gained, picks found, seconds, XP on offer, metres swum.
export const FLOW = ACTS.map((A, i) => {
  const N = night(A);
  return { kills: N.out * RUN_LOG.cleared[i], levels: RUN_LOG.level[i] - (RUN_LOG.level[i - 1] ?? 1), chests: A.stage.treasures.at.length + A.stage.elites.length + 1, seconds: A.seconds, xp: N.xp, swum: A.seconds * ASSUME.moving * ASSUME.swim };
});
const flowSum = (from, to) => FLOW.slice(from, to + 1).reduce((s, f) => Object.fromEntries(Object.keys(f).map((k) => [k, (s[k] || 0) + f[k]])), {});
// what one copy has grown to by Boss door `to` (0..3) if taken at the start of act `from`: stat gains and extra XP
export function grown(node, from, to, S0) {
  const F = flowSum(from, to), base = BASE_STATS, add = {}, out = { add, xp: 0 };
  const put = (name, amount, percent, times) => { const key = STAT_NAMES[name]; add[key] = (add[key] || 0) + times * amount * (percent ? base[key] / 100 : 1); };
  for (const w of node.children.filter((c) => c.name !== 'level')) {
    const p = { ...TREASURE_WORDS[w.name]?.props, ...w.props };
    if (w.name === 'grow-on-kills') { const n = Math.floor(F.kills / p.kills); put(w.args[0], w.args[1], p.percent, p.cap != null ? Math.min(n, p.cap / w.args[1]) : n); }
    else if (w.name === 'per') put(w.args[0], w.args[1], p.percent, Math.min(p.most ?? Infinity, { levels: F.levels, chests: F.chests, 'max-health': S0.health }[p.of] / p.every));
    else if (w.name === 'bounty') put(w.args[0], w.args[1], false, F.seconds / (p.every + ASSUME.bountyKill));
    else if (w.name === 'xp-mult') out.xp += F.xp * (w.args[0] - 1);
    else if (w.name === 'more-bugs') out.xp += F.xp * (w.args[0] - 1);   // (its bugs come with their XP, and their danger)
    else if (w.name === 'distance-xp') out.xp += F.swum / p.every * w.args[0];
    else if (w.name === 'every') for (const e of w.children) if (e.name === 'xp') out.xp += F.seconds / w.args[0] * e.args[0];
  }
  return out;
}
// one average level at a door, in points
const levelPts = (M, type = 'normal') => { const U = refStats(type, M.level), V = refStats(type, M.level + 1); return 100 * (offence(type, V) / offence(type, U) - 1) + 100 * (defence(V, M.A) / defence(U, M.A) - 1); };
export function growthWorth(node, from, to, type = 'normal') {
  const M = MOMENTS[to + 1], S0 = refStats(type, M.level), g = grown(node, from, to, S0), S1 = { ...S0 };
  for (const [k, v] of Object.entries(g.add)) S1[k] += v;
  const stats = 100 * (offence(type, S1) / offence(type, S0) - 1) + 100 * (defence(S1, M.A) / defence(S0, M.A) - 1);
  const L = levelAt(xpFor(M.level) + g.xp) - M.level;
  return { pts: stats + L * levelPts(M, type), levels: L, add: g.add };
}
const GROWERS = ['trophy', 'stopwatch', 'bandage', 'choreList', 'teaBag', 'spareChange', 'piggyBank', 'coin', 'sugar', 'houseplant', 'pedometer', 'fishFood'];
function sheetB4() {
  const flags = [], rows = [], curves = [];
  for (const id of GROWERS) {
    const t = CONTENT.treasures.find((x) => x.id === id), node = nodeOf('treasures', id), per = [0, 1, 2, 3].map((k) => growthWorth(node, k, 3).pts), unp = id === 'spareChange' || id === 'fishFood';
    const luck = id === 'spareChange' ? `Luck +${r(3 * flowSum(0, 3).chests)} over a run` : id === 'fishFood' ? 'levels up 2 of your Treasures a Boss: not priced' : '';
    rows.push([t.name, rarityName(t.rarity), t.stack, ...per.map((v) => (unp ? '' : r(v))), r(PICK[t.rarity]), luck]);
    curves.push([t.name, per, t]);
    if (unp) continue;
    const T = turn(node), full = per[0], late = per[2], want = PICK[t.rarity];
    if (T && full > 2 * want) flags.push({ text: `${t.name}, ${a(rarityName(t.rarity))}, grows to ${r(full)} points at the Encore door if taken in act 1 (one copy), over twice its ${want} budget, and nothing caps it.`,
      knob: { at: `content/treasures.kdl:${T.line}`, ...scaled(T, 1.5 * want, full) } });
    else if (late < 0.25 * want && full >= 0.5 * want) flags.push({ text: `${t.name}, ${a(rarityName(t.rarity))}, is worth ${r(full)} points taken in act 1 but ${r(late)} taken in act 3 (budget ${want}): late in a run it is a wasted pick.`,
      knob: { at: kdl('content/treasures.kdl', 'treasure', id), change: 'no number: let it start at a higher level, or gain faster the later it is taken', does: 'a late pick still pays something (a new word, grow-on-kills catch-up)' } });
  }
  const fx = FLOW.map((f, i) => [`Act ${i + 1}`, r(f.kills), r(f.levels), r(f.chests), r(f.seconds), r(f.xp), r(f.swum)]);
  return {
    id: 'B4', title: 'Growing and economy Treasures',
    lede: 'A Treasure that grows or pays over time is worth more the earlier it is taken. Value in points at the Encore door, for one copy taken at the start of each act.',
    numbers: GROWERS.map((id) => { const t = CONTENT.treasures.find((x) => x.id === id); return [`${t.name} (${t.rarity}, x${t.stack})`, t.text, kdl('content/treasures.kdl', 'treasure', id)]; })
      .concat([['Kills, levels, picks, seconds, XP, metres an act brings', 'the night model and the run log', 'tools/balance-sheet.mjs RUN_LOG'], ['Share of time swimming; swim speed (m/s); seconds to clear a Chore List target', `${ASSUME.moving}; ${ASSUME.swim}; ${ASSUME.bountyKill}`, 'tools/balance-sheet.mjs ASSUME']]),
    model: `taken at the start of act k, kept to the Encore door
kills grow stats (Little Trophy, Kitchen Timer, Bandage); levels and picks feed per words (Tea Bag, Piggy Bank); a Chore List target lands every (every + ${ASSUME.bountyKill} s)
XP words (Lucky Penny, Spilled Sugar, Houseplant, Pedometer) add XP, turned into levels through xpToNext, each level worth an average card at that door
points = Offence and Defence of the reference Normal jelly with the grown stats, against without, plus extra levels x what one level adds
Luck (Spare Change) and levelling Treasures (Fish Food) are not priced`,
    tables: [{ head: ['Treasure', 'Rarity', 'Copies', 'Taken in act 1', 'Act 2', 'Act 3', 'Act 4', 'Budget a copy', 'Unpriced'], rows }, { head: ['Act', 'Bugs killed', 'Levels gained', 'Picks found', 'Seconds', 'XP on offer', 'Metres swum'], rows: fx }],
    charts: [grouped('Points at the Encore door, one copy, by the act it was taken in', ['Taken in act 1', 'Act 3'], [['Little Trophy', [0, 2].map((k) => growthWorth(nodeOf('treasures', 'trophy'), k, 3).pts)], ['Piggy Bank', [0, 2].map((k) => growthWorth(nodeOf('treasures', 'piggyBank'), k, 3).pts)], ['Lucky Penny', [0, 2].map((k) => growthWorth(nodeOf('treasures', 'coin'), k, 3).pts)]], (v) => r(v))],
    flags,
    notes: ['These are one-copy ceilings if taken at the start of the act. The run log\'s real pickup order (which act a Treasure is taken in) would sharpen them: it is in the run log additions.'],
  };
}

// ------------------------------------------------------------------ B5: Attack upgrades
// A pick's price over what it needs first (an upgrade that needs another is priced on top of it)
const needsChain = (u) => { const out = []; for (let x = u; x?.needs; x = CONTENT.upgrades.find((y) => y.id === x.needs)) out.unshift(x.needs); return out; };
export function upgradeWorth(u, M = MOMENT_VAC) {
  const node = nodeOf('upgrades', u.id), need = needsChain(u), w = worth(u.jelly, M, { u: [...need, u.id] }, { fx: fxOf(u, node, 1) * 1, base: { u: need } });
  return { ...w, pts: total(w), node, need };
}
const median = (xs) => { const s = [...xs].sort((p, q) => p - q); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
function sheetB5() {
  const flags = [], byType = TYPES.map((type) => {
    const list = CONTENT.upgrades.filter((u) => u.jelly === type).map((u) => ({ u, ...upgradeWorth(u), left: unpricedOf(u) }));
    const priced = list.filter((x) => x.pts > 0.5).sort((p, q) => q.pts - p.pts);
    return { type, list, priced };
  });
  const meds = byType.map((x) => median(x.priced.map((y) => y.pts))), overall = median(meds.filter((m) => m > 0));
  for (const T of byType) for (const x of T.priced) {
    const t = turn(x.node);
    if (t && x.pts > 2 * PICK.upgrade && !x.left.length) flags.push({ text: `${x.u.name}, ${a(name(T.type))} Attack upgrade, is worth ${r(x.pts)} points at the Vacuum door${x.need.length ? ' on top of what it needs' : ''}, over twice an Attack upgrade's ${PICK.upgrade}.`, knob: { at: `content/upgrades.kdl:${t.line}`, ...scaled(t, PICK.upgrade, x.pts) } });
  }
  byType.forEach((T, i) => {
    const mine = meds[i];
    if (T.priced.length >= 3 && overall && mine < 0.5 * overall) {
      const weak = T.priced[T.priced.length - 1], t = turn(weak.node);
      if (t) flags.push({ text: `${name(T.type)}'s priced Attack upgrades have a middle worth of ${r(mine)} points against ${r(overall)} across the types: its pool is the weakest of the eight on paper. The weakest priced one is ${weak.u.name} at ${r(weak.pts)}.`, knob: { at: `content/upgrades.kdl:${t.line}`, ...scaled(t, PICK.upgrade, weak.pts) } });
    }
  });
  const rows = byType.map((T, i) => [name(T.type), `${T.priced.length} of ${T.list.length}`, T.priced[0] ? `${T.priced[0].u.name} ${r(T.priced[0].pts)}` : '', T.priced[1] ? `${T.priced[1].u.name} ${r(T.priced[1].pts)}` : '', r(meds[i]), T.list.filter((x) => !T.priced.includes(x)).map((x) => x.u.name + (x.u.needs ? ' (needs another)' : '')).join(', ')]);
  return {
    id: 'B5', title: 'Attack upgrades',
    lede: `All ${CONTENT.upgrades.length} Attack upgrades, ${TYPES.length} types of twelve. Priced where a number exists on paper (stats, Crit, marks, status bonuses, timed effects); the rest change how an attack behaves and need play.`,
    numbers: CONTENT.upgrades.map((u) => [`${u.name} (${name(u.jelly)}${u.needs ? `, needs ${u.needs}` : ''})`, u.text, kdl('content/upgrades.kdl', 'upgrade', u.id)]).concat([['Attack upgrade budget', PICK.upgrade, 'docs/agents/balance-model.md']]),
    model: `points = Offence and Defence of the type's reference jelly at the Vacuum door with the upgrade, against without (and on top of what it needs)
priced: stat and Crit, mark and status words, timed effects (every), always-on effects, as in B2 and B3; element-up, on-kill-of, streaks, echo-bubble and the other behaviour words are not
a type with few priced upgrades is mostly behaviour: the clear test measures it`,
    tables: [{ head: ['Type', 'Priced', 'Best priced', 'Second', 'Middle priced (points)', 'Not priced'], rows }],
    charts: [bars('Best priced Attack upgrade at the Vacuum door, by type (points)', byType.map((T) => [name(T.type), T.priced[0]?.pts ?? 0]), { fmt: (v) => r(v), ref: PICK.upgrade }),
      bars('Middle priced Attack upgrade, by type (points)', byType.map((T, i) => [name(T.type), meds[i]]), { fmt: (v) => r(v), ref: PICK.upgrade, cls: 'b' })],
    flags,
    notes: ['A priced number is a ceiling for upgrades that need a status or a streak to hold: it counts as if it always does.'],
  };
}

// ------------------------------------------------------------------ B6: Legendary Treasures and evolutions
const LEGENDS = () => [...LIVE(CONTENT.treasures).filter((t) => t.rarity === 'legendary').map((t) => ({ item: t, kind: 'treasure', file: 'treasures', spec: { t: { [t.id]: 1 } } })), ...CONTENT.evolutions.map((e) => ({ item: e, kind: 'evolution', file: 'evolutions', spec: { e: [e.id] } }))];
export function legendWorth(x, type = 'normal', M = MOMENT_VAC) {
  const node = nodeOf(x.file, x.item.id), w = worth(type, M, x.spec, { fx: fxOf(x.item, node, 1) }), cost = costOf(type, M, x.spec);
  return { ...w, pts: total(w), cost, node };
}
function sheetB6() {
  const flags = [], rows = [], priced = [];
  for (const x of LEGENDS()) {
    const types = TYPES.filter((t) => forType(x.item, t)), type = types.includes('normal') ? 'normal' : types[0], W = legendWorth(x, type), left = unpricedOf(x.item), dead = TYPES.filter((t) => !types.includes(t));
    const gain = W.pts - W.cost, full = !left.length && !W.left.length;
    rows.push([x.item.name, x.kind === 'treasure' ? 'Treasure' : 'Evolution', name(type), r(gain), r(-W.cost), r(W.pts), dead.length ? dead.map(name).join(', ') : '', left.join(', ') + (W.left.length ? ` ${W.left.join(', ')}` : '')]);
    priced.push([x.item.name, W.pts, x.kind === 'treasure' ? '' : 'b']);
    const T = turn(W.node);
    if (full && T && W.pts > 0 && (W.pts < 0.5 * PICK.legendary || W.pts > 2 * PICK.legendary)) flags.push({ text: `${x.item.name}${x.kind === 'evolution' ? ' (an evolution)' : ''} is worth ${r(W.pts)} points net on the ${name(type)} jelly at the Vacuum door, against a Legendary's ${PICK.legendary}, with nothing left unpriced.${x.item.vocabulary.includes('while') ? ` A while condition counts as holding for a share of a fight (${[...new Set(W.m.whiles.map((c) => `${pct(ASSUME.while[c.when] ?? 0.3).slice(1)} ${c.when}`))].join(', ')}).` : ''}`, knob: { at: `content/${x.file}.kdl:${T.line}`, ...scaled(T, PICK.legendary, W.pts) } });
    const neg = x.item.vocabulary.includes('stat') && -W.cost > 0;
    const w = neg && nodeOf(x.file, x.item.id).children.find((c) => c.name === 'stat' && c.args[1] < 0), k = neg ? 20 / -W.cost : 0;
    if (neg && -W.cost < 20 && w && Math.abs(w.args[1] * k) <= (w.props.percent ? 50 : BASE_STATS[STAT_NAMES[w.args[0]]] / 2)) {
      const v = w.args[1];
      flags.push({ text: `${x.item.name}'s cost is ${r(-W.cost)} points on the ${name(type)} jelly at the Vacuum door, under the 20 a Legendary's cost should be worth.`, knob: { at: `content/${x.file}.kdl:${w.line}`, change: `stat "${w.args[0]}" ${v}${w.props.percent ? ' percent=#true' : ''} → ${+(v * k).toPrecision(2)}`, does: 'a cost worth about 20 points' } });
    }
  }
  return {
    id: 'B6', title: 'Legendary Treasures and evolutions',
    lede: `The ${rows.length} Boss picks (Legendary Treasures and evolutions): what each gains and costs in points, and for which types it is not offered.`,
    numbers: [...LEGENDS().map((x) => [`${x.item.name} (${x.kind})`, x.item.text, kdl(`content/${x.file}.kdl`, x.kind, x.item.id)]), ['Legendary budget; cost worth at least', `${PICK.legendary}; 20`, 'docs/agents/balance-model.md']],
    model: `gain = points the stat, Crit, mark and timed parts add on the reference jelly at the Vacuum door; cost = points the negative stats take away (Health, Fire rate, Range, Move speed)
net = gain - cost, against a Legendary's ${PICK.legendary}; a Legendary's cost should be worth at least 20
priced on the Normal jelly, or the first type it is offered to (Rebound Jelly: Normal only); "Not offered to" is the types its not-for= leaves out
words with no number on paper (fire-trail, rebirth, decoy, reflect...) are listed as not priced: a pick with any is partly priced and never flagged for being weak`,
    tables: [{ head: ['Pick', 'Kind', 'Priced on', 'Gain', 'Cost', 'Net', 'Not offered to', 'Not priced'], rows }],
    charts: [bars('Net points at the Vacuum door (Treasures blue, evolutions green)', priced, { fmt: (v) => r(v), ref: PICK.legendary })],
    flags,
    notes: ['Net points leave out whatever the unpriced words are worth, so a low net with a long Not priced list is not a skip: it is a pick the paper cannot judge.'],
  };
}

// ------------------------------------------------------------------ B7: status effects
// How a status reaches a bug, from src/words.js and src/enemies.js: Elites and Bosses take only a 0.1 s mini-stun and a x0.9 slow
const SLOWED = 0.55;   // a slowed or chilled bug moves at this speed (enemies.js slow)
function sheetB7() {
  const flags = [], el = ELEMENT_BASE;
  const status = [
    ['Burn', `${el.fire.burn}x for ${el.fire.burnTime} s a hit, ${el.fire.burnStacks} at once`, 'Elites and Bosses too (damage over time)', at('src/words.js', /^ {2}fire: \{ burn: /)],
    ['Poison', `${el.poison.poisonStacks} stacks, ${el.poison.poisonTime} s each`, 'Elites and Bosses too (damage over time)', at('src/words.js', /^ {2}poison: \{ poison: /)],
    ['Bleed', 'a bug\'s hit makes you bleed: dps x seconds', 'a hit on you, not on a bug', at('src/enemies.js', /e\.bleeds/)],
    ['Stun', `${el.lightning.stun} s an arc; Treasures 0.5 to 1 s`, 'Elites and Bosses take a 0.1 s mini-stun', at('src/enemies.js', /status === 'stun' \|\| status === 'pin'/)],
    ['Pin', 'a stun that stops it dead', 'Elites and Bosses take a 0.1 s mini-stun', at('src/enemies.js', /status === 'stun' \|\| status === 'pin'/)],
    ['Chill', `${el.ice.chill} s a hit, a slow to x${SLOWED}`, 'Elites and Bosses too, but only x0.9', at('src/enemies.js', /status === 'chill'/)],
    ['Slow', `x${SLOWED} speed for its time`, 'Elites and Bosses too, but only x0.9', at('src/enemies.js', /e\.slowT > 0 \? 0\.55/)],
    ['Freeze', 'stopped for its time; a hit on it can shatter it', 'not Elites or Bosses (never Frozen)', at('src/enemies.js', /status === 'freeze'/)],
  ];
  // control from one Treasure or jelly attack: seconds a bug is held a second, if it is kept topped up, as attack time removed
  const sources = [];
  const add = (label, kind, secs, every, from) => sources.push({ label, kind, secs, every, from, held: Math.min(1, secs / every) * (kind === 'slow' ? 1 - SLOWED : 1) });
  for (const t of LIVE(CONTENT.treasures)) {
    const m = modsOf('normal', { t: { [t.id]: 1 } });
    for (const x of m.timed) for (const e of x.effects) {
      if (e.kind === 'ring') { if (e.freeze) add(t.name, 'freeze', e.freeze, x.every, t.id); if (e.slow) add(t.name, 'slow', e.slow, x.every, t.id); if (e.chill) add(t.name, 'slow', e.chill, x.every, t.id); }
      if (e.kind === 'swatter') add(t.name, 'stun', e.stun, x.every, t.id);
      if (e.kind === 'puddle') add(t.name, 'stun', e.skid, x.every, t.id);
    }
    for (const s of m.squeaks) add(t.name, 'stun', s.stun, s.cooldown, t.id);
  }
  const ice = el.ice.chill, hit = 1 / BASE_STATS.fireRate;
  add('Ice attack', 'slow', ice, hit, 'ice');
  add('Lightning arc', 'stun', el.lightning.stun, 1 / (el.lightning.rate * BASE_STATS.fireRate), 'lightning');
  // Boss and Elite time: how much of an act the control Treasures are on dead ground
  const bossShare = ACTS.map((A) => RUN_LOG.bossSeconds[A.n - 1] / A.seconds);
  const hurts = (t) => { const m = modsOf('normal', { t: { [t.id]: 1 } }); return gadgets(m, BASE_STATS).dps > 0 || m.squeaks.some((s) => s.dmg > 0) || m.popZap?.dmg > 0; };
  const pure = LIVE(CONTENT.treasures).filter((t) => sources.some((s) => s.from === t.id) && !hurts(t));
  for (const t of pure) {
    const node = nodeOf('treasures', t.id), T = turn(node);
    flags.push({ text: `${t.name} only holds bugs still or slows them, and Elites and Bosses barely feel that (a 0.1 s stun, a 10% slow): in the ${r(100 * bossShare[0])}% to ${r(100 * Math.max(...bossShare))}% of an act spent in the Boss fight it does next to nothing, and Elites (${ACTS[0].stage.elites.length} an act) shrug it off too.`,
      knob: { at: T ? `content/treasures.kdl:${T.line}` : kdl('content/treasures.kdl', 'treasure', t.id), change: 'give it a damage part (a ring or squeak dmg=…) that Elites and Bosses do take', does: 'it keeps some worth in a Boss fight' } });
  }
  return {
    id: 'B7', title: 'Status effects',
    lede: 'What each status does, to what, and how much attack time each control source takes from a bug. Elites and Bosses take Burn, Poison and Bleed damage, a 0.1 s mini-stun and a x0.9 slow, and no other control.',
    numbers: [...status.map(([n, v, w, f]) => [n + ': ' + w, v, f]), ...sources.map((s) => [`${s.label}: ${s.kind} ${s.secs} s every ${r(s.every, 2)} s`, `${s.kind}`, s.from === 'ice' || s.from === 'lightning' ? at('src/words.js', new RegExp(`^ {2}${s.from}: \\{`)) : kdl('content/treasures.kdl', 'treasure', s.from)])],
    model: `a bug held still or frozen loses all its attack time; a slowed or chilled bug moves at x${SLOWED}, so loses ${r(100 * (1 - SLOWED))}% of it
attack time removed a second on one bug = (seconds held per use / seconds between uses, at most 1) x that share, if the source is kept going on the one bug
Elites and Bosses (src/enemies.js status_applied) take only a 0.1 s mini-stun from Stun and Pin and a x0.9 slow from Chill and Slow; Freeze, Mark and trap do nothing to them
the Boss fight is ${ACTS.map((A, i) => `${r(100 * bossShare[i])}%`).join(', ')} of acts 1 to 4 on the run log's mean times`,
    tables: [{ head: ['Status', 'Strength and length', 'Elites and Bosses'], rows: status.map(([n, v, w]) => [n, v, w]) },
      { head: ['Source', 'Kind', 'Seconds held a use', 'Every (s)', 'Attack time removed a second, one bug'], rows: sources.map((s) => [s.label, s.kind, r(s.secs, 2), r(s.every, 2), pct(s.held).slice(1)]) }],
    charts: [bars('Attack time removed a second on one bug (%)', sources.map((s) => [s.label, s.held * 100, s.kind === 'stun' ? '' : 'b']), { fmt: (v) => r(v) + '%', left: 170 })],
    flags,
    notes: ['A control Treasure is worth its hold on an ordinary bug, which a fight with many bugs and no Boss pays in full: the paper cannot say how much a held bug is worth, only how much of its time is gone.'],
  };
}

// ================================================================== Wave C: what fights back (C1 and C2)
// ------------------------------------------------------------------ C1: bugs
// Each bug's attack words, read from content/enemies.kdl: damage a hit, seconds between hits, and the warning before it lands.
const ATTACK_WORDS = ['spit', 'bite', 'leap', 'poke', 'ball-charge', 'sortie', 'whirlwind', 'prism', 'lob', 'swat', 'whip', 'charge-shot', 'burrow', 'dive'];
ASSUME.contact = 1;   // a bug with no attack word hurts by touch about this often a second (an assumption: the touch gap is in run.js)
export function attackOf(id) {
  const node = nodeOf('enemies', id), E = CONTENT.enemies[id], hits = [];
  for (const w of node.children.filter((c) => ATTACK_WORDS.includes(c.name))) {
    const p = w.props, cycle = p.every ?? (w.name === 'sortie' ? p.fly + p.land + p.rest : (p.windup ?? 0) + (p.rest ?? 1));
    const dmg = p.dmg * (w.name === 'whirlwind' ? p.count : w.name === 'prism' ? p.most : 1), warn = p.windup ?? p.charge ?? p.curl ?? p.warn ?? p.aim ?? 0;
    hits.push({ word: w.name, dmg, cycle, warn });
  }
  if (!hits.length) hits.push({ word: 'touch', dmg: E.dmg, cycle: 1 / ASSUME.contact, warn: 0 });
  return { hits, dps: hits.reduce((s, h) => s + h.dmg / h.cycle, 0), warn: Math.min(...hits.filter((h) => h.warn > 0).map((h) => h.warn), Infinity), line: node.line };
}
const BUGS = () => [...new Set(CONTENT.waves.bugs.map((b) => b.id))].map((id) => ({ id, act: CONTENT.waves.bugs.find((b) => b.id === id).act })).concat([{ id: 'nest', act: 3 }]);
// seconds to clear one bug of this kind at the act's door, with the reference jelly's cards only and with what the run log shows Treasures add
export function clearTime(id, A) {
  const M = MOMENTS[A.n], paper = offence('normal', refStats('normal', M.level)), E = CONTENT.enemies[id];
  return { paper: E.hp * A.toughness / paper, real: E.hp * A.toughness / (M.real || paper) };
}
function sheetC1() {
  const flags = [], rows = [], per = [];
  for (const { id, act } of BUGS()) {
    const A = ACTS[act - 1], E = CONTENT.enemies[id], T = attackOf(id), C = clearTime(id, A), xpPerHp = E.xp * A.xpMult / (E.hp * A.toughness), N = night(A).per[id] || 0;
    const hit = Math.max(...T.hits.map((h) => h.dmg)) * A.power;
    per.push({ id, act, A, E, T, C, xpPerHp, N, hit });
    rows.push([E.name, act, r(E.hp * A.toughness), r(C.paper), r(C.real), r(T.dps * A.power, 2), r(hit, 1), Number.isFinite(T.warn) ? r(T.warn, 2) : 'touch', r(1000 * xpPerHp, 1), r(N)]);
  }
  for (const act of [1, 2, 3, 4]) {
    const mine = per.filter((x) => x.act === act && x.id !== 'nest'), tot = mine.reduce((s, x) => s + x.N, 0);
    const med = (f) => median(mine.map(f)), medReal = med((x) => x.C.real), mClear = med((x) => x.C.paper), mXp = med((x) => x.xpPerHp), mDps = med((x) => x.T.dps);
    for (const x of mine) {
      const hpKnob = { at: kdl('content/enemies.kdl', 'enemy', x.id), do: (v) => `hp=${x.E.hp} → hp=${Math.round(x.E.hp * v)}` };
      if (x.C.real > 2.5 * medReal && x.C.real > 6) flags.push({ text: `${x.E.name} (act ${act}) takes ${r(x.C.paper)} s to clear at the ${x.A.boss} door on the reference jelly (${r(x.C.real)} s with what Treasures add), ${r(x.C.paper / mClear, 1)}x the act's middle bug (${r(mClear)} s).`,
        knob: { at: hpKnob.at, change: hpKnob.do(3 * mClear / x.C.paper), does: `a clear time of about three of the act's middle bug` } });
      else if (x.xpPerHp > 2.5 * mXp && x.T.dps < mDps) flags.push({ text: `${x.E.name} (act ${act}) pays ${r(1000 * x.xpPerHp, 1)} XP per 1000 Health, ${r(x.xpPerHp / mXp, 1)}x the act's middle bug, and deals ${r(x.T.dps * x.A.power, 2)} a second against the middle ${r(mDps * x.A.power, 2)}: free XP.`,
        knob: { at: kdl('content/enemies.kdl', 'enemy', x.id), change: `xp=${x.E.xp} → xp=${Math.max(1, Math.round(x.E.xp * 2 * mXp / x.xpPerHp))}`, does: 'about twice the act\'s middle XP per Health' } });
      if (x.hit >= 3 && x.T.warn < 0.4) flags.push({ text: `${x.E.name} (act ${act}) hits for ${r(x.hit, 1)} with ${r(x.T.warn, 2)} s of warning: under a phone thumb's reaction.`,
        knob: { at: x.T.line ? `content/enemies.kdl:${nodeOf('enemies', x.id).children.find((c) => ATTACK_WORDS.includes(c.name)).line}` : hpKnob.at, change: 'windup → 0.5', does: 'half a second to step aside' } });
    }
  }
  // paper damage if nothing is dodged, against what the run log says was lost
  const act = ACTS.map((A, i) => { const tot = per.filter((x) => x.act === A.n).reduce((s, x) => s + x.N * x.T.dps * A.power * x.C.real, 0); return [A.n, tot, RUN_LOG.healthLost[i]]; });
  return {
    id: 'C1', title: 'Bugs',
    lede: 'Each bug on paper: how long it takes to clear, how hard it hits if nothing is dodged, how long you have to dodge, and what it pays.',
    numbers: per.map((x) => [`${x.E.name} (act ${x.act}): Health, damage, XP`, `${x.E.hp}, ${x.E.dmg}, ${x.E.xp}; ${x.T.hits.map((h) => `${h.word} ${h.dmg} every ${r(h.cycle, 2)} s`).join(', ')}`, kdl('content/enemies.kdl', 'enemy', x.id)])
      .concat([['Acts: toughness, power, xpMult', ACTS.map((A) => `${A.toughness}, ${A.power}, ${A.xpMult}`).join('; '), 'src/stage*.js'], ['Touch rate when a bug has no attack word', ASSUME.contact + ' a second', 'tools/balance-sheet.mjs ASSUME']]),
    model: `clear time = Health x act toughness / the reference Normal jelly's Offence at the act's Boss door (cards only); "with Treasures" divides by the run log's real damage a second instead
damage a second sent = sum over its attack words of (hits x damage) / seconds between hits, times the act's power (never dodged, never killed); a bug with no attack word touches ${ASSUME.contact} a second
warning = the wind-up, charge, curl or aim before the hit lands; XP per Health = XP x act xpMult / (Health x toughness)
bugs out is the night model's count (alive cap ignored)`,
    tables: [{ head: ['Bug', 'Act', 'Health', 'Clear (s), cards', 'Clear (s), with Treasures', 'Damage a second sent', 'Biggest hit', 'Warning (s)', 'XP per 1000 Health', 'Bugs out'], rows },
      { head: ['Act', 'Paper threat: bugs out x damage a second x clear time (Health)', 'Run log: Health lost', 'Implied dodged or never hit'], rows: act.map(([n, t, l]) => [n, r(t), r(l), pct(1 - l / t).slice(1)]) }],
    charts: [bars('Seconds to clear one, with Treasures (blue acts 1 and 3, green acts 2 and 4)', per.map((x) => [x.E.name, x.C.real, x.act % 2 ? '' : 'b']), { fmt: (v) => r(v), left: 130 }),
      bars('Damage a second sent, never dodged (with the act\'s power)', per.map((x) => [x.E.name, x.T.dps * x.A.power, x.act % 2 ? '' : 'b']), { fmt: (v) => r(v, 2), left: 130 })],
    flags,
    notes: ['The run log has Health lost per act, not per bug, so a bug-by-bug check of paper threat against play (House fly, Ladybug) waits for the run log additions (damage by source).', 'The threat column is a ceiling: a bug alive for its whole clear time, attacking without pause, never dodged. The implied dodged share is how far play falls under it.'],
  };
}


// ------------------------------------------------------------------ C2: waves and act knobs
// Bug Health arriving a second against the reference jelly's Offence, through the night. The jelly levels on the XP the bugs bring,
// from where the last act's Boss door left it; Offence is the cards-only jelly times what Treasures add at this act's door (the run log).
export function pressure(A, dt = 5, scale = {}) {
  const W = CONTENT.waves, list = W.bugs.filter((b) => b.act === A.n), tough = A.toughness * (scale.toughness ?? 1), bugs = A.bugs * (scale.bugs ?? 1), M = MOMENTS[A.n];
  const k = (scale.k ?? (M.real || 1) / offence('normal', refStats('normal', M.level))), x0 = xpFor(RUN_LOG.level[A.n - 2] ?? 1), out = [];
  let xp = 0;
  for (let t = 0; t < A.night; t += dt) {
    const rate = (W.rate + t * W.grow) * bugs, live = list.filter((b) => t >= b.from), sw = live.reduce((s, b) => s + b.weight, 0);
    const hp = rate * live.reduce((s, b) => s + b.weight * CONTENT.enemies[b.id].hp * tough, 0) / sw;
    xp += rate * live.reduce((s, b) => s + b.weight * Math.round(CONTENT.enemies[b.id].xp * A.xpMult), 0) / sw * dt;
    const level = levelAt(x0 + xp), off = offence('normal', refStats('normal', level)) * k * (scale.off ?? 1);
    out.push({ t, hp, off, load: hp / off, level });
  }
  return out;
}
const peak = (P) => Math.max(...P.map((x) => x.load));
function sheetC2() {
  const flags = [], P = ACTS.map((A) => pressure(A)), peaks = P.map(peak), mean = (p) => p.reduce((s, x) => s + x.load, 0) / p.length, means = P.map(mean);
  const rows = ACTS.map((A, i) => [A.n, ...[60, 120, 180, 240].map((s) => (s < A.night ? r(P[i].find((x) => x.t >= s - 5).load, 2) : '')), r(peaks[i], 2), r(means[i], 2), r(P[i][P[i].length - 1].level)]);
  const ref = means[0];
  ACTS.forEach((A, i) => {
    if (i && (means[i] > 1.5 * ref || means[i] < ref / 1.5)) {
      const t = A.toughness * ref / means[i];
      flags.push({ text: `Act ${A.n}'s bugs arrive at ${r(means[i], 2)} of the jelly's Offence over the night (act 1: ${r(ref, 2)}), ${r(means[i] / ref, 1)}x act 1's pressure.`,
        knob: { at: knob(A, 'toughness'), change: `toughness: ${A.toughness} → ${r(t, 2)}`, does: `act ${A.n} loads the jelly as hard as act 1 does (bugs: ${A.bugs} → ${r(A.bugs * ref / means[i], 2)} does the same, with fewer bugs)` } });
    }
  });
  // act 4 carries its bugs' Health in enemies.kdl, acts 2 and 3 in the stage's toughness
  const tough4 = ACTS[3].toughness;
  if (tough4 === 1 && ACTS[1].toughness > 1 && ACTS[2].toughness > 1) flags.push({ text: `Acts 2 and 3 scale a bug's Health with the stage's toughness (${ACTS[1].toughness}, ${ACTS[2].toughness}); act 4's toughness is ${tough4}, and its bugs carry the Health themselves (Firefly ${CONTENT.enemies.firefly.hp}, Monarch ${CONTENT.enemies.butterfly.hp}, Cicada ${CONTENT.enemies.cicada.hp}, against a Dragonfly's ${CONTENT.enemies.dragonfly.hp}).`,
    knob: { at: knob(ACTS[3], 'toughness'), change: `toughness: 1 → 4, and hp 700 / 1000 / 1200 → 175 / 250 / 300 (Firefly, Monarch butterfly, Cicada)`, does: `the same Health, written the way acts 2 and 3 write it, so a later act's knob is one number (the Encore arena's own toughness, ${ENCORE.toughness ?? 3.5}, would need x4 to keep its bugs as they are)` } });
  const waves = ACTS.map((A) => CONTENT.waves.bugs.filter((b) => b.act === A.n));
  return {
    id: 'C2', title: 'Waves and act knobs',
    lede: 'Bug Health arriving a second against the jelly\'s Offence, minute by minute: where the line crosses, the room starts to fill. The four act knobs (toughness, power, bugs, xpMult) set it.',
    numbers: [['Spawn rate, growth a second; alive cap start, every, max', `${CONTENT.waves.rate}, ${CONTENT.waves.grow}; 6, 15, 20`, at('content/waves.kdl', /^spawning/)],
      ...ACTS.map((A) => [`Act ${A.n}: toughness, power, bugs, xpMult, night s`, `${A.toughness}, ${A.power}, ${A.bugs}, ${A.xpMult}, ${A.night}`, A.n === 1 ? A.file : knob(A, 'toughness')]),
      ...ACTS.map((A, i) => [`Act ${A.n} bugs: id weight from`, waves[i].map((b) => `${b.id} ${b.weight} ${b.from ?? 0}`).join('; '), at('content/waves.kdl', new RegExp(`^bug "${waves[i][0].id}"`))])],
    model: `arriving Health a second = (spawn rate + growth x t) x act bugs x the weighted mean of (bug Health x act toughness) over the bugs out by t
the jelly's level follows the XP that arrives, from the last Boss door's level; Offence = cards-only Normal jelly at that level x what Treasures add at this act's door (run log)
load = arriving Health a second / Offence: above 1 the jelly cannot keep up and the room fills (the alive cap and the time bugs take to reach you are ignored)`,
    tables: [{ head: ['Act', 'Load at 1:00', '2:00', '3:00', '4:00', 'Peak', 'Mean over the night', 'Level at the Boss door'], rows }],
    charts: [bars('Mean load over the night (arriving Health a second / Offence)', ACTS.map((A, i) => [`Act ${A.n}`, means[i]]), { fmt: (v) => r(v, 2), ref: ref })],
    flags,
    notes: ['Load is not difficulty: a bug that hits hard and dies fast loads little. It says how much of your Offence each act asks for just to keep the room clear.', 'No target is set yet. Say what mean load you want in each act, and the knob lines above give the toughness that matches it.'],
  };
}

// ================================================================== Wave C: C3 to C5 (Elites, Bosses, moving and dodging)
// Elite and Boss timings live in code (src/elites.js, src/vacuum.js, src/clog.js, src/shark.js, src/encore.js), not only in
// content: each one here is read from its line (num), so a moved or changed timing fails loudly or redraws.
const num = (f, re) => { const m = read(f).match(re); if (!m) throw new Error(`balance-sheet: ${f} has no match for ${re}`); return +m[1]; };
const IFRAMES = num('src/run.js', /this\.phase === 'dead'\) return;\n\s*this\.iFrames = ([\d.]+);/);             // after a hit, nothing else lands for this long (run.js hit)
const TEMPO = CONTENT.elites.pace.tempo, RECOVER = CONTENT.elites.pace.recover;
const BPM4 = num('src/music.js', /name: 'Sunrise Set', bpm: (\d+)/), BEAT = 60 / BPM4;   // act 4's song: its Elites keep its beat
const SWIM = num('src/config.js', /walkSpeed: ([\d.]+)/), JUMP_H = num('src/config.js', /jumpHeight: ([\d.]+)/);
ASSUME.near = 0.3;    // m between the jelly and an Elite or Boss when an attack starts (aggro ranges are 0.75 to 1.8 m; the jelly shoots from range)
ASSUME.lane = 0.6;   // m of table the Bull's rush runs before its edge
ASSUME.gadgetHit = 0.3;   // D3: the share of a gadget's paper damage a second that lands in play (B3's figures are every swing on ASSUME.area bugs; the clear test measures it)
// hits that can land from parts landing at these times (s), one per IFRAMES
export function landed(times) {
  let n = 0, last = -Infinity;
  for (const t of [...times].sort((p, q) => p - q)) if (t - last >= IFRAMES) { n++; last = t; }
  return n;
}
const span = (n, gap, t0 = 0) => Array.from({ length: n }, (_, k) => t0 + k * gap);
const E_AT = (re) => at('src/elites.js', re);
// Each Elite's attacks, in the order it takes them, calm and angry. Per attack, in real s: warn (its Warning shows to the first hit),
// dodge (from the moment it locks on you to the hit: the time you really have), len (start to idle), rest (cool, run down at pace recover),
// hits (parts that can land, through the i-frames), dmg (a hit, before the act's power), move (m you must cover to get clear, for C5).
export function eliteAttacks(kind, angry = false) {
  const K = CONTENT.elites[kind], S = K.skills, t = (x) => x / TEMPO, A = (calm, mad) => (angry && mad != null ? mad : calm), R = JELLY_R;
  const L = {
    controller: () => {
      const B = S.barrage, wind = num('src/elites.js', /const R = 0\.22, wind = ([\d.]+);/), Rr = 0.22, W = S.arrow;
      return [
        { id: 'barrage', dmg: B.dmg, warn: t(B.windup), dodge: t(B.windup), len: t(B.windup + 3 * B.gap), rest: B.rest, times: [t(B.windup)], move: B.radius + R, how: 'step out of the symbol about to go off', src: E_AT(/Button combo: four fixed floor symbols/) },
        { id: 'rumble', dmg: S.rumble.dmg, warn: t(wind), dodge: t(wind), len: t(wind), rest: num('src/elites.js', /knock\(e\.base, 0\.9\); \}\n\s*e\.state = 'idle'; e\.cool = ([\d.]+);/), times: [t(wind)], move: Rr + R - 0.05, how: 'get out of the circle (too tall to jump)', src: E_AT(/const R = 0\.22, wind = /) },
        { id: 'arrow', dmg: W.dmg, warn: W.warn + W.strike, dodge: W.warn * (1 - W.lock) + W.strike, len: W.warn + W.strike, rest: W.rest, times: [W.warn + W.strike], move: W.radius + R, how: 'step aside after it locks', src: E_AT(/Arrow drop: a pad arrow/) },
      ];
    },
    mug: () => {
      const C = S.coffee, P = S.spill, gap = num('src/elites.js', /s >= e\.thrown \* ([\d.]+)\) \{ e\.thrown\+\+/), flight = num('src/elites.js', /this\.lob\(muzzle, target, ([\d.]+), hostile\('mug'\)/);
      const wind = num('src/elites.js', /const W = SK\.spill, wind = ([\d.]+)/), pour = Math.max(0.5, P.puddles * 0.12 + 0.02);
      return [
        { id: 'coffee', dmg: C.dmg, warn: flight, dodge: flight, len: t(C.lobs * gap), rest: num('src/elites.js', /e\.state = 'idle'; e\.cool = ([\d.]+); e\.thrown = 0;/), times: span(C.lobs, t(gap), flight), move: 0.045 + R, how: 'keep moving: each lob lands where you were', src: E_AT(/Coffee lob: lobs a beat apart/) },
        { id: 'spill', dmg: P.dmg, warn: t(wind), dodge: t(wind), len: t(wind + pour), rest: 1.8, times: [t(wind + 0.12)], move: P.width / 2 + R, how: 'step out of the lane, or jump it', src: E_AT(/Spill: tips toward you while a lane Warning/) },
      ];
    },
    kettle: () => {
      const B = S.ball, D = S.boil, burst = span(B.shots, B.every, t(B.charge) + B.flight).flatMap((x) => span(B.gusts, B.gap, x));
      return [
        { id: 'steam-ball', dmg: B.dmg, warn: B.flight, dodge: B.flight, len: t(B.charge) + (B.shots - 1) * B.every + B.flight + (B.gusts - 1) * B.gap, rest: 1.6, times: burst, move: B.radius + R, how: 'change direction: each ball leads you', src: E_AT(/Steam balls: it boils up a ball/) },
        { id: 'boil-dry', dmg: D.dmg, warn: t(D.flight + D.fill), dodge: t(D.fill), len: t(D.flight + D.fill + 0.5), rest: 1.8, times: [t(D.flight + D.fill)], move: D.away - D.safe, how: 'reach the lid\'s safe circle', src: E_AT(/Boil dry: the lid pops off/) },
      ];
    },
    soap: () => {
      const T = S.trap, G = S.ring, n = A(T.count, T.angryCount), rings = A(G.rings, G.angryRings), blow = 1.0, ringSpeed = 0.26;
      return [
        { id: 'bubble-trap', dmg: T.dmg, warn: t(blow) + ASSUME.near / T.speed, dodge: ASSUME.near / T.speed, len: t(n * (blow + 0.2)), rest: A(1.8, 1.3), times: span(n, t(blow + 0.2), t(blow) + ASSUME.near / T.speed), move: 0, how: `outswim it (${T.speed} m/s) or pop it (${T.hp} Health)`, src: E_AT(/Bubble trap: it pumps up a big soap bubble/) },
        { id: 'bubble-ring', dmg: G.dmg, warn: t(1.0) + ASSUME.near / ringSpeed, dodge: ASSUME.near / ringSpeed, len: t(1.0 + (rings - 1) * 0.55 + 0.35), rest: A(1.8, 1.3), times: span(rings, t(0.55), t(1.0) + ASSUME.near / ringSpeed), move: 0.06, how: 'find the gap, or jump the low ones', src: E_AT(/Bubble ring: foams up/) },
      ];
    },
    clock: () => {
      const wind = A(1.0, 0.8), dur = 0.55, wr = num('src/elites.js', /wreathFlight: ([\d.]+)/), H = S.hour, out = [
        { id: 'sweep', dmg: S.sweep.dmg, warn: t(wind), dodge: t(wind), len: t(wind + dur), rest: A(1.7, 1.2), times: [t(wind + dur / 2)], move: 0, how: 'jump the hand (2 cm) or leave its half circle', src: E_AT(/Sweeping hands: a half circle fills/) },
        { id: 'wreath', dmg: S.wreath.dmg, warn: t(0.8), dodge: t(0.8 * 0.7), len: t(0.8) + 2 * wr, rest: A(1.7, 1.2), times: [t(0.8) + wr, t(0.8) + 2 * wr], move: 0.04 + R, how: 'step off its line after it locks, twice (out and back)', src: E_AT(/Victory's wreath: a line on the bench/) }];
      if (angry) out.push({ id: 'hour', dmg: H.dmg, warn: t(H.warn), dodge: t(H.warn), len: t(H.warn * H.rounds + 0.3), rest: 1.6, times: span(H.rounds, t(H.warn), t(H.warn)), move: 0.1, how: 'stand between the hands', src: E_AT(/Telling the time \(angry only\)/) });
      return out;
    },
    whipper: () => {
      const B = S.balloon, P = S.piping, n = A(B.count, B.angryCount), fill = 1.0;
      return [
        { id: 'balloon', dmg: B.dmg, warn: B.fuse, dodge: B.fuse, len: t(n * (fill + 0.25)), rest: A(2.2, 1.6), times: span(n, t(fill + 0.25), t(fill) + B.fuse), move: 0.2 + R, how: 'get 20 cm from the balloon as it bursts', src: E_AT(/Balloon: blow one up on the nozzle/) },
        { id: 'piping', dmg: P.dmg, warn: P.wake, dodge: P.wake, len: A(P.pipe, P.angryPipe) + P.wake, rest: 1.8, times: [P.wake], move: P.height * 1.25 / 2 + R, how: 'keep moving, never double back', src: E_AT(/Piping: the nozzle follows you/) },
      ];
    },
    croc: () => {
      const V = S.volley, T = S.tail, Q = S.pounce, n = A(V.count, V.angryCount), wind = t(A(V.windup, V.angryWindup));
      const slams = (A(T.slams, T.angrySlams) + A(T.maxSlams, T.angryMaxSlams)) / 2, gap = (T.gapMin + T.gapMax) / 2, ringAt = ASSUME.near / T.speed;
      const qw = A(Q.windup, Q.angryWindup);
      return [
        { id: 'volley', dmg: V.dmg, warn: wind + V.flight, dodge: wind + V.flight, len: wind + V.flight + 0.35 + V.stagger * (n - 1), rest: A(V.rest, V.angryRest), times: span(n, V.stagger, wind + V.flight), move: V.radius + R, how: 'outpace the fan', src: E_AT(/Frost volley: the mouth opens/) },
        { id: 'tail-slam', dmg: T.dmg, warn: t(gap) + ringAt, dodge: ringAt, len: t(T.turn + slams * gap + 0.45), rest: A(T.rest, T.angryRest), times: span(Math.round(slams), t(gap), t(T.turn + gap) + ringAt), move: 0, how: 'jump each ring wall', src: E_AT(/Tail slam: it turns its back to you/) },
        { id: 'pounce', dmg: Q.dmg, warn: t(qw + Q.air), dodge: t(qw * (1 - Q.lock) + Q.air), len: t(qw + Q.air + 0.4), rest: A(Q.rest, Q.angryRest), times: [t(qw + Q.air)], move: Q.radius + R, how: 'leave its circle after it locks', src: E_AT(/Pounce: it crouches while a Warning/) },
      ];
    },
    bull: () => {
      const Q = S.rush, P = S.spiral, N = S.minis, qw = t(A(Q.windup, Q.angryWindup)), sp = A(Q.speed, Q.angrySpeed), arms = A(P.arms, P.angryArms);
      return [
        { id: 'rush', dmg: Q.dmg, warn: qw + ASSUME.near / sp, dodge: qw + ASSUME.near / sp, len: qw + ASSUME.lane / sp + Q.dizzy, rest: A(Q.rest, Q.angryRest), times: [qw + ASSUME.near / sp], move: Q.width / 2 + R, how: 'step out of the lane (too tall to jump)', src: E_AT(/Bull rush: its horns swell/) },
        { id: 'spiral', dmg: P.dmg, warn: t(P.warn) + ASSUME.near / P.speed, dodge: ASSUME.near / P.speed, len: t(P.warn + P.time + 0.2), rest: A(P.rest, P.angryRest), times: span(Math.floor(P.time / P.every) * arms, t(P.every) / arms, t(P.warn) + ASSUME.near / P.speed).filter((x) => x <= t(P.warn + P.time) + ASSUME.near / P.speed), move: 0, how: 'jump the low arms, stay down for the high', src: E_AT(/Spiral: a Warning circle fills round it/) },
        { id: 'minis', dmg: N.dmg, warn: t(N.warn) + N.side / A(N.speed, N.angrySpeed), dodge: t(N.warn) + N.side / A(N.speed, N.angrySpeed), len: t(N.warn) + N.reach / A(N.speed, N.angrySpeed), rest: A(N.rest, N.angryRest), times: [t(N.warn) + N.side / A(N.speed, N.angrySpeed)], move: N.width / 2 + R, how: 'step out of both lanes', src: E_AT(/Little bulls: two pop up beside you/) },
      ];
    },
    coffer: () => {
      const Ac = S.accordion, T = S.tongue, J = S.jewels, un = A(Ac.unfold, Ac.angryUnfold), pull = A(T.pull, T.angryPull);
      const reel = Math.max(0, ASSUME.near - T.bite) / Math.max(0.01, pull - SWIM);   // swimming straight away at base Move speed
      return [
        { id: 'accordion', dmg: Ac.dmg, warn: t(un), dodge: t(un * (1 - Ac.track)), len: t(Ac.strikes * un), rest: A(Ac.rest, Ac.angryRest), times: span(Ac.strikes, t(un), t(un)), move: Ac.radius + R, how: 'step off after each strike locks', src: E_AT(/Accordion: strikes in a row/) },
        { id: 'tongue', dmg: T.dmg, warn: t(T.open), dodge: Math.min(T.hold, reel), len: t(T.open + T.shoot) + Math.min(T.hold, reel) + T.chews * T.chew + 0.3, rest: A(T.rest, T.angryRest), times: [t(T.open + T.shoot) + Math.min(T.hold, reel)], move: Infinity, pull, how: `swim away faster than ${pull} m/s for ${T.hold} s (it can't miss)`, src: E_AT(/Tongue: its mouth opens, then the tongue shoots/) },
        { id: 'jewels', dmg: J.dmg, warn: t(J.rain), dodge: t(J.rain), len: t(J.rain + 0.4), rest: A(J.rest, J.angryRest), times: [t(J.rain)], move: J.radius + R, how: 'leave each marked spot', src: E_AT(/Jewels: amber jewels shoot up/) },
      ];
    },
    bowl: () => {
      const G = S.ring, H = S.hum, n = A(G.rings, G.angryRings), every = angry ? 2 : 4, first = G.windup + G.snap / 2, out = ASSUME.near / A(G.speed, G.angrySpeed);
      const hits = span(n, every, first).flatMap((b) => [b * BEAT + out, (b + G.echo) * BEAT + out]), hw = H.windup + H.snap / 2;
      return [
        { id: 'ring', dmg: G.dmg, warn: first * BEAT + out, dodge: out, len: (first + (n - 1) * every + G.echo + 1) * BEAT, rest: A(G.rest, G.angryRest), times: hits, move: 0, how: 'jump each ring, out and back', src: E_AT(/Rim ring: the striker lifts/) },
        { id: 'hum', dmg: H.dmg, warn: hw * BEAT, dodge: hw * BEAT, len: (hw + 1) * BEAT, rest: A(H.rest, H.angryRest), times: [hw * BEAT], move: Math.max(0, ASSUME.near - H.safe), how: 'swim into the safe circle by the bowl', src: E_AT(/Hum: the striker runs round the rim/) },
      ];
    },
    pillow: () => {
      const P = S.spores, F = S.fairy, drift = A(P.drift, P.angryDrift), lead = P.windup + drift + 1 + P.snap / 2, fl = F.windup + F.grow + 1 + F.snap / 2;
      return [
        { id: 'spores', dmg: P.dmg, warn: (drift + 1) * BEAT, dodge: BEAT, len: lead * BEAT, rest: A(P.rest, P.angryRest), times: [lead * BEAT], move: P.radius + R, how: 'step off the spot before the bar', src: E_AT(/Spores: the cap breathes in, its spots glowing; on a beat/) },
        { id: 'fairy', dmg: F.dmg, warn: (F.grow + 1) * BEAT, dodge: (F.grow + 1) * BEAT, len: (fl + (angry ? F.grow + 2 : 0)) * BEAT, rest: A(F.rest, F.angryRest), times: angry ? [fl * BEAT, (fl + F.grow + 2) * BEAT] : [fl * BEAT], move: 0, how: 'hold still in the ring', src: E_AT(/Fairy ring: the cap breathes in while a circle follows you/) },
      ];
    },
    headphones: () => {
      const W = S.shove, St = S.stereo, n = A(St.bursts, St.angryBursts), first = St.windup + St.snap / 2;
      return [
        { id: 'shove', dmg: 0, warn: (W.windup + W.snap / 2) * BEAT, dodge: W.lock * BEAT, len: (W.windup + W.snap / 2 + (W.waves - 1) * W.every + 1) * BEAT, rest: A(W.rest, W.angryRest), times: [], move: 0, how: `jump each wave or be shoved ${W.push} m (off the counter is the punishment)`, src: E_AT(/Shove waves: the cups take turns/) },
        { id: 'stereo', dmg: St.dmg, warn: first * BEAT, dodge: St.every * BEAT, len: (first + (n - 1) * St.every + 1) * BEAT, rest: A(St.rest, St.angryRest), times: span(n, St.every * BEAT, first * BEAT), move: 0.1 + R, how: 'cross the line on each beat', src: E_AT(/Stereo: a dividing line down the counter/) },
      ];
    },
  };
  return L[kind]().map((x) => ({ ...x, hits: landed(x.times) }));
}
const JELLY_R = num('src/config.js', /radius: ([\d.]+)/);
// One Elite's fight: its loop (attacks then rests), Health sent a second if every part lands, seconds to beat
export function eliteFight(kind, A) {
  const K = CONTENT.elites[kind], hp = K.hp * (A.stage.eliteHp || 1), M = MOMENTS[A.n], prev = A.n > 1 ? RUN_LOG.level[A.n - 2] : 1;
  const level = (prev + RUN_LOG.level[A.n - 1]) / 2, paper = offence('normal', refStats('normal', level)), real = paper * (M.real / offence('normal', refStats('normal', M.level)));
  const loop = (angry) => { const L = eliteAttacks(kind, angry), sec = L.reduce((s, x) => s + x.len + x.rest / RECOVER, 0), hp = L.reduce((s, x) => s + x.hits * x.dmg * A.power, 0); return { L, sec, dps: hp / sec }; };
  const calm = loop(false), mad = K.angry ? loop(true) : calm, share = K.angry ?? 0;
  const secs = (off) => hp / off, sent = (off) => secs(off) * ((1 - share) * calm.dps + share * mad.dps);
  return { kind, name: K.name, hp, level, paper, real, calm, mad, secs: { paper: secs(paper), real: secs(real) }, sent: sent(real), lost: RUN_LOG.eliteLost[kind] };
}
export const ELITE_ACTS = () => ACTS.map((A) => ({ A, kinds: A.stage.elites.map((e) => e.kind) }));
function sheetC3() {
  const flags = [], fights = ELITE_ACTS().flatMap(({ A, kinds }) => kinds.map((k) => ({ A, ...eliteFight(k, A) })));
  const chest = pickWorth('elite');
  const rows = fights.map((f) => [f.name, f.A.n, r(f.hp), r(f.secs.paper), r(f.secs.real), r(f.calm.dps, 2), r(f.mad.dps, 2), r(f.sent), f.lost != null ? r(f.lost, 1) : '', f.lost != null ? pct(1 - f.lost / f.sent).slice(1) : '']);
  const atk = fights.flatMap((f) => [...new Map([...f.calm.L, ...f.mad.L].map((x) => [x.id, x])).values()].map((x) => ({ f, x, hit: x.dmg * f.A.power })));
  const atkRows = atk.map(({ f, x, hit }) => [`${f.name}: ${x.id}`, r(hit, 1), x.hits, r(x.warn, 2), r(x.dodge, 2), hit ? r(x.dodge / hit, 3) : '', x.how]);
  // the least time to react for the most damage: under C1's 0.4 s with a hit worth 6 or more
  for (const { f, x, hit } of atk) if (hit >= 6 && x.dodge < 0.4 - 1e-9) {
    const kdlLine = `content/elites.kdl:${nodeOf('elites', f.kind).children.find((c) => c.name === (x.id === 'wreath' ? 'wreath' : x.id))?.line ?? nodeOf('elites', f.kind).line}`;
    const fix = { accordion: ['track', CONTENT.elites.coffer.skills.accordion.track, +(1 - 0.4 * TEMPO / CONTENT.elites.coffer.skills.accordion.unfold).toFixed(2), kdlLine],
      wreath: ['the lock at 0.3 of the 0.8 s wind-up (wind * 0.3)', 0.3, +(1 - 0.4 * TEMPO / 0.8).toFixed(2), E_AT(/if \(s < wind \* 0\.3 \|\| !e\.aim\)/)] }[x.id];
    flags.push({ text: `${f.name}'s ${x.id} hits for ${r(hit, 1)} (act ${f.A.n}'s power) with ${r(x.dodge, 2)} s between locking on and landing: under the 0.4 s a phone thumb needs (sheet C1's line).${x.hits > 1 ? ` It can land ${x.hits} times an attack.` : ''}`,
      knob: fix ? { at: fix[3], change: `${fix[0]} ${fix[1]} → ${fix[2]}`, does: 'it locks 0.4 s before it lands' } : { at: kdlLine, change: 'its wind-up up by ' + r(0.4 - x.dodge, 2) + ' s', does: '0.4 s to react' } });
  }
  // is each Elite worth its chest? Health it really costs (run log), as a share of what the reference jelly can spend in the act
  const costPts = (f) => (f.lost == null ? null : 100 * f.lost / defence(refStats('normal', f.level), f.A));
  for (const f of fights) {
    const c = costPts(f);
    if (c != null && c > 1.5 * chest) flags.push({ text: `${f.name} costs ${r(f.lost, 1)} Health a fight in the run log, ${r(c)}% of what the act's reference jelly can spend, for a chest worth about ${r(chest)} points (${r(chest)}% of the jelly).`,
      knob: { at: kdl('content/elites.kdl', 'elite', f.kind), change: `its worst attack's dmg down by a third (${[...f.calm.L].sort((p, q) => q.hits * q.dmg - p.hits * p.dmg)[0].id})`, does: 'about a chest\'s worth of Health a fight' } });
  }
  // act by act: seconds to beat with what Treasures add, the same chest each time
  const actSecs = ACTS.map((A) => median(fights.filter((f) => f.A === A).map((f) => f.secs.real)));
  ACTS.forEach((A, i) => { if (i && (actSecs[i] < actSecs[0] / 2 || actSecs[i] > actSecs[0] * 2)) flags.push({ text: `Act ${A.n}'s Elites take ${r(actSecs[i])} s to beat with what Treasures add at its door, against act 1's ${r(actSecs[0])} s, for the same chest.`,
    knob: { at: knob(A, 'eliteHp'), change: `eliteHp: ${A.stage.eliteHp} → ${r(A.stage.eliteHp * actSecs[0] / actSecs[i] * (actSecs[i] < actSecs[0] ? 1.5 : 1), 2)}`, does: actSecs[i] < actSecs[0] ? 'about 1.5x act 1\'s fight, a step up each act' : 'act 1\'s fight length' } }); });
  // within an act, the Elite that sends the most if never dodged
  for (const A of ACTS) {
    const mine = fights.filter((f) => f.A === A), med = median(mine.map((f) => f.calm.dps)), top = mine.reduce((p, q) => (q.calm.dps > p.calm.dps ? q : p));
    if (top.calm.dps > 1.75 * med) {
      const worst = [...top.calm.L].sort((p, q) => q.hits * q.dmg / (q.len + q.rest) - p.hits * p.dmg / (p.len + p.rest))[0];
      flags.push({ text: `${top.name} sends ${r(top.calm.dps, 2)} Health a second if nothing is dodged, ${r(top.calm.dps / med, 1)}x act ${A.n}'s middle Elite; its ${worst.id} lands up to ${worst.hits} hits of ${r(worst.dmg * A.power, 1)}.`,
        knob: { at: `content/elites.kdl:${nodeOf('elites', top.kind).children.find((c) => c.name === worst.id || worst.id.startsWith(c.name))?.line ?? nodeOf('elites', top.kind).line}`, change: `${worst.id} rest up so the loop sends ${r(1.5 * med, 2)} a second`, does: 'its pressure in line with the act\'s others' } });
    }
  }
  return {
    id: 'C3', title: 'Elites',
    lede: 'Each Elite\'s loop of attacks: how long it takes to beat, the Health it sends if nothing is dodged, how long you have to react, and what its chest is worth against what it costs.',
    numbers: [
      ['Pace: rest runs down x, attacks play x', `${RECOVER}, ${TEMPO}`, at('content/elites.kdl', /^pace /)],
      ['After a hit nothing lands for (s)', IFRAMES, at('src/run.js', /this\.iFrames = 0\.25;/)],
      ['Act 4\'s Elites keep the song\'s beat: bpm', BPM4, at('src/music.js', /name: 'Sunrise Set'/)],
      ...ACTS.map((A) => [`Act ${A.n}: eliteHp, power`, `${A.stage.eliteHp || 1}, ${A.power}`, A.n === 1 ? A.file : knob(A, 'eliteHp')]),
      ...fights.map((f) => [`${f.name}: Health, angry at`, `${CONTENT.elites[f.kind].hp}, ${CONTENT.elites[f.kind].angry ?? 'never'}`, kdl('content/elites.kdl', 'elite', f.kind)]),
      ...atk.map(({ f, x }) => [`${f.name}: ${x.id} (dmg, warn s, dodge s, len s, rest s)`, `${x.dmg}, ${r(x.warn, 2)}, ${r(x.dodge, 2)}, ${r(x.len, 2)}, ${r(x.rest, 2)}`, x.src]),
      ['Elite chest worth (points)', r(chest), at('src/stats.js', /^ {2}elite: /)],
      ['Health lost to each Elite, per one beaten', RUN_LOG.source2, 'tools/balance-sheet.mjs RUN_LOG'],
      ['How far the jelly stands when an attack starts (m)', ASSUME.near, 'tools/balance-sheet.mjs ASSUME'],
    ],
    model: `an Elite's loop = each attack in turn: its length + its rest / pace recover (${RECOVER}); tempo-timed parts / pace tempo (${TEMPO}); act 4's in beats of ${r(BEAT, 3)} s
hits an attack can land = its parts' landing times, one per ${IFRAMES} s (the jelly's i-frames after a hit)
Health sent a second = Σ hits x dmg x act power / loop seconds; calm until its angry= share of Health is gone, then angry
seconds to beat = Health x eliteHp / the reference Normal jelly's Offence midway through the act (cards only), or that times what Treasures add at the act's door
dodge = from the moment it locks on you (or its Warning shows, if it never follows you) to the hit; a Shot or wall that has to travel adds ${ASSUME.near} m of flight
worth its chest: the run log's Health lost a fight, as a share of what the act's reference jelly can spend, against the chest's ${r(chest)} points (each a percent of that jelly)`,
    tables: [{ head: ['Elite', 'Act', 'Health', 'Seconds to beat, cards', 'With Treasures', 'Sent a second, calm', 'Angry', 'Sent a fight, never dodged', 'Run log: lost a fight', 'Dodged or never hit'], rows },
      { head: ['Attack', 'A hit (with power)', 'Hits it can land', 'Warning (s)', 'Dodge (s)', 'Dodge s per Health', 'How to beat it'], rows: atkRows }],
    charts: [bars('Health lost a fight (run log) as % of what the act\'s jelly can spend; the chest is worth the dashed line', fights.filter((f) => f.lost != null).map((f) => [f.name.replace(/^The /, ''), costPts(f), f.A.n % 2 ? '' : 'b']), { fmt: (v) => r(v, 1) + '%', ref: chest, left: 170 }),
      bars('Seconds between locking on and landing, attacks that hurt (0.4 s dashed)', atk.filter(({ hit }) => hit).map(({ f, x }) => [`${f.name.replace(/^The /, '')} ${x.id}`, Math.min(x.dodge, 3), f.A.n % 2 ? '' : 'b']), { fmt: (v) => r(v, 2), ref: 0.4, left: 190 })],
    flags,
    notes: ['Never dodged is a ceiling: every part landing, one per i-frame. The run log\'s Health lost is what real players took; the gap is how much each attack is dodged.', 'Act 4\'s attacks snap to the song\'s bars, so a Warning lasts between windup= and windup= + snap= beats; the sheet takes the middle.', 'Puddles, beads and slicks that hurt over time (the Mug\'s coffee, the Whipper\'s cream) are left out of hits; the run log counts them (coffee, cream).'],
  };
}

// ------------------------------------------------------------------ C4: Bosses
// Each Boss's loop, read from content/bosses.kdl and its controller: attacks in order, the gap between them (chase or rest),
// the time it can't be hurt, and what speeds it up when angry. Times are real s; drains (suction, acid, pools) hurt a second, past i-frames.
const B_AT = (f, re) => at(f, re);
export function bossLoop(id, angry = false) {
  const S = CONTENT.bosses[id].skills, R = JELLY_R, near = ASSUME.near;
  if (id === 'vacuum') {
    const k = angry ? S.enrage.pace : 1, sweeps = [S.brushes.time - 0.9, S.brushes.time - 0.35];
    const A = {
      charge: { dmg: S.charge.dmg, warn: S.charge.windup, dodge: S.charge.windup, len: S.charge.windup + Math.min(S.charge.time, 1), times: [S.charge.windup + near / S.charge.speed], how: 'step out of its lane or jump it (8 cm)' },
      suction: { dmg: 0, drain: S.suction.dmg, drainS: S.suction.time, warn: 0, dodge: 0, len: S.suction.time, times: [], how: `swim away: it pulls at up to ${r(S.suction.pull * 1.2, 2)} m/s close in, you swim ${SWIM}` },
      brushes: { dmg: S.brushes.dmg, warn: sweeps[0], dodge: sweeps[0], len: S.brushes.time, times: sweeps, how: 'jump each sweep (2 cm)' },
      dump: { dmg: 0, warn: 0, dodge: 0, len: S.dump.time, times: [], how: `${S.dump.roaches}${angry ? ' + 1' : ''} Cockroaches` },
      flies: { dmg: 0, warn: S.flies.windup, dodge: S.flies.windup, len: S.flies.windup, times: [], how: `${S.flies.count} Spotted lanternflies; it can't be hurt till they're dead (${S.flies.shield} s at most, ${S.flies.max} a fight)` },
      spin: { dmg: S.spin.dmg, warn: 0, dodge: near / S.spin.speed, len: S.spin.time, times: span(Math.floor(S.spin.time / S.spin.every), S.spin.every, near / S.spin.speed), how: 'jump the low clumps, stay down for the high' },
    };
    const order = (angry ? ['charge', 'spin', 'flies', 'suction', 'brushes', 'charge', 'dump'] : ['charge', 'suction', 'flies', 'brushes', 'dump']);
    return { order, A, gap: S.chase.time, k, src: B_AT('src/vacuum.js', /^export const ATTACKS = /) };
  }
  if (id === 'clog') {
    const k = 1, lw = angry ? S.lash.angryWindup : S.lash.windup, P = S.pinball, cw = (x) => x * (angry ? 0.8 : 1);
    const leaps = span(P.count, 0, 0).map((_, i) => P.windup * (i ? 0.7 : 1) + P.air), pin = leaps.map((_, i) => leaps.slice(0, i + 1).reduce((a, b) => a + b, 0));
    const A = {
      lash: { dmg: S.lash.dmg, warn: lw, dodge: lw, len: lw + 0.3, times: [lw], how: `step out of reach (slowed ${S.lash.slow} s if caught)` },
      pinball: { dmg: P.dmg, warn: P.windup + P.air, dodge: P.lock, len: pin.at(-1) + P.ring / P.ringSpeed, times: [...pin, pin.at(-1) + near / P.ringSpeed], how: 'leave each landing circle after it locks, then jump the ring' },
      snare: { dmg: S.snare.dmg, warn: S.snare.windup, dodge: S.snare.windup, len: S.snare.windup, times: [S.snare.windup], how: 'step out of the snare' },
      roll: { dmg: S.roll.dmg, warn: S.roll.windup, dodge: S.roll.windup, len: S.roll.windup + S.roll.time, times: [S.roll.windup + near / (angry ? S.roll.angrySpeed : S.roll.speed)], how: 'step out of its line' },
      comb: { dmg: S.comb.dmg, warn: cw(S.comb.windup), dodge: cw(S.comb.next), len: cw(S.comb.windup + (S.comb.waves - 1) * S.comb.next), times: span(Math.ceil(S.comb.waves / 2), cw(2 * S.comb.next), cw(S.comb.windup)), how: 'switch lanes each curtain (too tall to jump)' },
      shed: { dmg: 0, warn: 0, dodge: 0, len: S.shed.time, times: [], how: `${S.shed.count}${angry ? ' + 1' : ''} hair tangles` },
      spray: { dmg: S.spray.dmg, warn: 0, dodge: near / S.spray.speed, len: S.spray.time, times: span(Math.floor(S.spray.time / S.spray.every), S.spray.every, near / S.spray.speed), how: 'keep moving across the spray' },
    };
    const order = angry ? ['pinball', 'lash', 'spray', 'comb', 'roll', 'snare', 'lash', 'shed'] : ['lash', 'pinball', 'snare', 'roll', 'comb', 'shed'];
    return { order, A, gap: angry ? S.chase.angryTime : S.chase.time, k, src: B_AT('src/clog.js', /^export const ATTACKS = /) };
  }
  if (id === 'shark') {
    const A = {}, M = S.motion;
    for (const n of ['bite', 'rear', 'combo', 'spin', 'leap', 'dive', 'burrowBite', 'maelstrom', 'tornado']) {
      const x = S[n], under = x.track != null, count = x.count ?? 1, beat = (x.windup ?? 0) + (x.track ?? 0);
      A[n] = { dmg: x.dmg, warn: x.windup + (x.track ?? 0), dodge: under ? x.tell ?? x.windup : x.windup, len: count * beat + x.active, under: under ? count * (x.track ?? 0) : 0, times: span(count, beat, beat), how: under ? 'leave its circle as it tells where it surfaces' : x.height < JUMP_H ? `jump it (${r(x.height * 100)} cm) or step out` : 'step out of reach' };
    }
    const order = angry ? ['bite', 'combo', 'dive', 'tornado', 'leap', 'spin', 'maelstrom', 'burrowBite', 'rear'] : ['bite', 'leap', 'combo', 'spin', 'rear', 'dive', 'burrowBite', 'maelstrom'];
    return { order, A, gap: M.rest, k: angry ? 1 : 1, src: B_AT('src/shark.js', /^export const ATTACKS=/) };
  }
  // the Encore: a 16-bar slot (set solo=) of floor waves every `wave` bars, one solo (4 bars: records, pyro or the wall) and its bow
  const b = 4 * BEAT_ENC, solo = S.solo, slot = S.set.solo * b, Rr = S.records, Py = S.pyro, W = S.wall;
  const A = {
    floor: { dmg: ENC_FLOOR_DMG, warn: 2 * BEAT_ENC, dodge: 2 * BEAT_ENC, len: 0, times: [0], per: (S.set.solo - solo.bars - solo.bow) / S.set.wave + (solo.bars + solo.bow) / (2 * S.set.wave), how: 'step off its line (never a ring)' },
    records: { dmg: Rr.dmg, warn: (Rr.windup + Rr.flight) * BEAT_ENC, dodge: (Rr.lock + Rr.flight) * BEAT_ENC, len: solo.bars * b, times: span(solo.bars, b, (Rr.windup + Rr.flight) * BEAT_ENC), how: 'step out of the lane before he throws (too tall to jump)' },
    pyro: { dmg: Py.dmg, warn: Py.warn * BEAT_ENC, dodge: Py.warn * BEAT_ENC, len: (solo.bars - 1) * b, times: span((solo.bars - 1) * 4, BEAT_ENC, Py.warn * BEAT_ENC), how: 'stand in the lane that isn\'t burning' },
    wall: { dmg: W.dmg, warn: 2 * b, dodge: W.roll * BEAT_ENC, len: solo.bars * b, times: [solo.bars * b], how: `get in a strip behind a record (${W.safe} m wide)` },
  };
  return { order: ['records', 'pyro', 'wall'], A, gap: slot - solo.bars * b, k: 1, slot, src: B_AT('src/encore.js', /SOLO_ATTACKS/) };
}
const BEAT_ENC = 60 / +read('src/song-track.js').match(/encore: \{[^}]*bpm: (\d+)/)[1];
const ENC_FLOOR_DMG = num('src/encore-floor.js', /export const FLOOR_DMG = ([\d.]+)/);
// Health sent a second if every part lands, and the boss's own share of the loop it can't be hurt
export function bossFight(A, type = 'normal', off = null) {
  const id = A.bossId, D = CONTENT.bosses[id], S = D.skills, M = MOMENTS[A.n];
  const send = (angry) => {
    const L = bossLoop(id, angry);
    let sec = 0, hp = 0, under = 0;
    if (id === 'encore') {
      for (const n of L.order) { const x = L.A[n]; hp += landed(x.times) * x.dmg; }
      hp = hp / L.order.length + L.A.floor.per * L.A.floor.dmg; sec = L.slot;
    } else for (const n of L.order) { const x = L.A[n]; sec += (x.len + L.gap) / L.k; hp += landed(x.times) * x.dmg + (x.drain ?? 0) * (x.drainS ?? 0) * 0.5; under += (x.under ?? 0) / L.k; }
    return { L, sec, dps: hp * A.power / sec, under: under / sec };
  };
  const angryAt = { vacuum: S.enrage?.at, clog: S.enrage?.at, shark: S.tornado?.at, encore: CONTENT.bosses.encore.skills.stages.set3 }[id] ?? 0;
  const calm = send(false), mad = send(true);
  // time it can't be hurt, a fight: the Vacuum's fly shields (4 lanternflies to clear, twice), the Clog's two acid floods,
  // the Encore's opening and reboot force fields, the shark's share of each loop under the quilt
  const fly = CONTENT.enemies.lanternfly.hp * S.flies?.count;
  const flood = S.acid ? S.acid.rise + S.acid.rounds * S.acid.every + S.acid.drain : 0;
  const fixedOf = (o) => ({ vacuum: S.flies ? S.flies.max * Math.min(S.flies.shield, fly / o + 1) : 0, clog: 2 * flood, encore: (S.start?.guard ?? 0) + (S.meltdown?.guard ?? 0), shark: 0 })[id];
  const loopUnder = (1 - angryAt) * calm.under + angryAt * mad.under, exposed = id === 'encore' ? 1 + (S.solo.exposed - 1) * S.solo.bow / S.set.solo : 1;
  // what Treasures add at this door, from the run log's mean fight with the waiting taken out (S0's figure leaves it in)
  const logSecs = RUN_LOG.bossSeconds[A.n - 1];
  let o = M.real;
  for (let i = 0; i < 40; i++) o = A.bossHp / (exposed * (1 - loopUnder) * Math.max(5, logSecs - fixedOf(o)));
  const paper = offence(type, refStats(type, M.level)), k = o / offence('normal', refStats('normal', M.level)), real = off ?? paper * k, fixed = fixedOf(real);
  const secs = (A.bossHp / real / exposed) / (1 - loopUnder) + fixed;
  return { id, A, paper, real, k, fixed, loopUnder, exposed, secs, calm, mad, angryAt, sent: secs * ((1 - angryAt) * calm.dps + angryAt * mad.dps), flood, fly };
}
function sheetC4() {
  const flags = [], F = ACTS.map((A) => bossFight(A));
  const rows = F.map((f, i) => [f.A.boss, r(f.A.bossHp), r(f.A.bossHp / f.real), r(f.fixed + f.loopUnder * f.secs), r(f.secs), r(RUN_LOG.bossSeconds[i]), r(f.calm.dps * 60), r(f.mad.dps * 60), r(f.sent), r(RUN_LOG.bossLost[i], 1)]);
  const atk = F.flatMap((f) => { const L = { ...f.calm.L.A, ...f.mad.L.A }; return Object.entries(L).map(([n, x]) => ({ f, n, x, hit: x.dmg * f.A.power, hits: landed(x.times) })); });
  const atkRows = atk.map(({ f, n, x, hit, hits }) => [`${f.A.boss}: ${n}`, x.drain ? `${r(x.drain * f.A.power, 1)} a second` : hit ? r(hit, 1) : '', hits || '', r(x.warn, 2), r(x.dodge, 2), x.how]);
  // by jelly type: paper fight length (the type's cards-only Offence x what Treasures add at the door) against the run log
  const typeRows = [], slow = [];
  F.forEach((f, i) => {
    const real = RUN_LOG.bossByType[i], times = TYPES.map((t) => [t, bossFight(f.A, t).secs, real[t]]);
    const known = times.filter((x) => x[2] && x[2][1] >= 3), med = median(known.map((x) => x[2][0]));
    for (const [t, p, x] of times) {
      typeRows.push([f.A.boss, name(t), r(p), x ? `${x[0]} (${x[1]})` : '']);
      if (x && x[1] >= 3 && x[0] > 1.75 * med) slow.push({ f, t, secs: x[0], n: x[1], med, paper: p });
    }
  });
  for (const s of slow) flags.push({ text: `${name(s.t)} took ${s.secs} s on the ${s.f.A.boss} in the run log (${s.n} fights), ${r(s.secs / s.med, 1)}x the middle type's ${r(s.med)} s; the paper says ${r(s.paper)} s. ${['ice', 'poison'].includes(CONTENT.jellies[s.t].attack) ? `A Boss takes no control status and has no crowd round it, so ${CONTENT.jellies[s.t].attack === 'ice' ? 'Chill and Freeze' : 'the Poison burst\'s spread'} buys nothing here.` : 'The paper can\'t see why: a clear test on this Boss (tests/clear.mjs) would.'}`,
    knob: { at: kdl('content/jellies.kdl', 'jelly', s.t), change: `hit=${CONTENT.jellies[s.t].hit} → ${r(CONTENT.jellies[s.t].hit * Math.sqrt(s.secs / s.med), 2)}`, does: `halves the gap on the ${s.f.A.boss} (and lifts its bug fights too: check A1's budget)` } });
  // time it can't be hurt, as a share of the real fight
  F.forEach((f, i) => { const u = f.fixed + f.loopUnder * f.secs, sh = u / RUN_LOG.bossSeconds[i]; if (sh > 0.3) flags.push({ text: `The ${f.A.boss} can't be hurt for about ${r(u)} s of a fight (${id2why(f)}): ${pct(sh).slice(1)} of the run log's ${RUN_LOG.bossSeconds[i]} s fight is waiting with nothing to hit.`,
    knob: f.id === 'clog' ? { at: `content/bosses.kdl:${nodeOf('bosses', 'clog').children.find((c) => c.name === 'acid').line}`, change: `rounds=${CONTENT.bosses.clog.skills.acid.rounds} → ${Math.max(3, Math.round(CONTENT.bosses.clog.skills.acid.rounds * 0.6))}`, does: `each flood ${r(f.flood)} s → ${r(f.flood - (CONTENT.bosses.clog.skills.acid.rounds - Math.max(3, Math.round(CONTENT.bosses.clog.skills.acid.rounds * 0.6))) * CONTENT.bosses.clog.skills.acid.every)} s` }
      : f.id === 'encore' ? { at: `content/bosses.kdl:${nodeOf('bosses', 'encore').children.find((c) => c.name === 'start').line}`, change: `guard=${CONTENT.bosses.encore.skills.start.guard} → 8`, does: `${CONTENT.bosses.encore.skills.start.guard - 8} s less waiting at the start` }
      : f.id === 'vacuum' ? { at: `content/bosses.kdl:${nodeOf('bosses', 'vacuum').children.find((c) => c.name === 'flies').line}`, change: `max=${CONTENT.bosses.vacuum.skills.flies.max} → 1`, does: `one fly shield a fight, about ${r(f.fixed / CONTENT.bosses.vacuum.skills.flies.max)} s less waiting` }
      : { at: kdl('content/bosses.kdl', 'boss', f.id), change: 'shorter cover', does: 'less waiting' } }); });
  // least time for the most damage, as C3
  for (const { f, n, x, hit, hits } of atk) if (hit >= 6 && x.dodge < 0.4 - 1e-9 && hits) flags.push({ text: `The ${f.A.boss}'s ${n} hits for ${r(hit, 1)} with ${r(x.dodge, 2)} s between locking on and landing.`,
    knob: { at: `content/bosses.kdl:${nodeOf('bosses', f.id).children.find((c) => c.name === n).line}`, change: n === 'pinball' ? `lock=${CONTENT.bosses.clog.skills.pinball.lock} → 0.4` : 'its wind-up up', does: '0.4 s to react' } });
  return {
    id: 'C4', title: 'Bosses',
    lede: 'Each Boss\'s fight on paper: how long at the reference Offence, the time it can\'t be hurt, the Health it sends if nothing is dodged, and the run log\'s real times by jelly type.',
    numbers: [
      ...F.map((f) => [`${f.A.boss}: Health (with the act's bossHp), contact`, `${r(f.A.bossHp)}, ${CONTENT.bosses[f.id].contact}`, kdl('content/bosses.kdl', 'boss', f.id)]),
      ...F.map((f) => [`${f.A.boss}: attack order`, `${f.calm.L.order.join(', ')}; angry ${f.mad.L.order.join(', ')}`, f.calm.L.src]),
      ['Vacuum: between attacks it chases (s); angry pace', `${CONTENT.bosses.vacuum.skills.chase.time}; x${CONTENT.bosses.vacuum.skills.enrage.pace}`, at('src/vacuum.js', /get pace\(\)/)],
      ['Clog: acid floods at, each (s)', `${CONTENT.bosses.clog.skills.acid.first}, ${CONTENT.bosses.clog.skills.acid.second}; ${r(F[1].flood)}`, at('src/clog.js', /this\.state = 'acid'/)],
      ['Shark: rest between attacks (s); illusion at', `${CONTENT.bosses.shark.skills.motion.rest}; ${CONTENT.bosses.shark.skills.illusion.at}`, at('src/shark.js', /get shielded\(\)/)],
      ['Encore: guards (s), solo slot (bars), bow (bars) at x', `${CONTENT.bosses.encore.skills.start.guard} + ${CONTENT.bosses.encore.skills.meltdown.guard}; ${CONTENT.bosses.encore.skills.set.solo}; ${CONTENT.bosses.encore.skills.solo.bow} at x${CONTENT.bosses.encore.skills.solo.exposed}`, at('src/encore.js', /get exposed\(\)/)],
      ['Encore floor wave damage; song bpm', `${ENC_FLOOR_DMG}; ${r(60 / BEAT_ENC)}`, at('src/encore-floor.js', /export const FLOOR_DMG/)],
      ['Fight length and Health lost to the Boss, by act and by type', RUN_LOG.source2, 'tools/balance-sheet.mjs RUN_LOG'],
    ],
    model: `fight seconds = (Boss Health / Offence) / (1 - the loop's share under cover) / bows' exposed bonus + the time it can't be hurt
Offence = the reference jelly at the door (cards only, by type) x what Treasures add at that door: the run log's mean fight with the waiting taken out
can't be hurt: the Vacuum's fly shields (4 lanternflies to clear, ${CONTENT.bosses.vacuum.skills.flies.max} a fight, ${CONTENT.bosses.vacuum.skills.flies.shield} s at most), the Clog's two acid floods (rise + rounds x every + drain), the shark under the quilt (track), the Encore's two force fields
Health sent a second = Σ hits that can land (one per ${IFRAMES} s) x dmg x act power / (attacks + gaps); drains (suction) count half their time; angry once Health falls below its line
the Encore is a ${CONTENT.bosses.encore.skills.set.solo}-bar slot: floor waves every ${CONTENT.bosses.encore.skills.set.wave} bars and one solo (records, pyro or the wall in turn); lasers, the disco ball and stage-edge shocks are not priced`,
    tables: [{ head: ['Boss', 'Health', 'Hurting s at reference Offence', 'Can\'t be hurt (s)', 'Paper fight (s)', 'Run log (s)', 'Sent a minute, calm', 'Angry', 'Sent a fight, never dodged', 'Run log: lost to it'], rows },
      { head: ['Boss', 'Type', 'Paper fight (s)', 'Run log s (fights)'], rows: typeRows },
      { head: ['Attack', 'A hit (with power)', 'Hits it can land', 'Warning (s)', 'Dodge (s)', 'How to beat it'], rows: atkRows }],
    charts: [grouped('Fight length: paper and the run log (s)', F.map((f) => f.A.boss), [['Paper', F.map((f) => f.secs)], ['Run log', RUN_LOG.bossSeconds]], (v) => r(v)),
      bars('Encore fight by type in the run log (s)', TYPES.filter((t) => RUN_LOG.bossByType[3][t]).map((t) => [name(t), RUN_LOG.bossByType[3][t][0]]), { fmt: (v) => r(v), ref: median(TYPES.filter((t) => RUN_LOG.bossByType[3][t]).map((t) => RUN_LOG.bossByType[3][t][0])) })],
    flags,
    notes: ['Paper fight times are set so the Normal jelly matches the run log\'s mean (what Treasures add is solved from it), so a type\'s paper time differs from Normal\'s by its cards only.', 'The Vacuum for a first run: the run log\'s players lost 8.8 Health to it a fight, so on its own it isn\'t the wall; sheet D2 looks at first runs.', 'Type rows with one or two fights are anecdotes (Ice\'s 303 s on the Encore is two fights); the flag needs three or more and 1.75x the middle type.', 'The shark\'s illusion (from half its Health) attacks with the same moves at its own rest, so its angry figure is a floor.', 'The Encore\'s lasers, disco ball and stage-edge shock are in look.css and not priced here.'],
  };
}
const id2why = (f) => ({ vacuum: 'its lanternfly shields', clog: 'two acid floods from the head of the tub', shark: 'under the quilt', encore: 'its opening and reboot force fields' })[f.id];

// ------------------------------------------------------------------ C5: moving and dodging
// A held jump, stepped as src/player.js steps it: rise at gravity (apexHang near the top), fall at fallGravity, capped at maxFall.
const PC = (k) => num('src/config.js', new RegExp(`${k}: ([\\d.]+)`));
export function jumpArc(dt = 1 / 240) {
  const g = PC('gravity'), hang = PC('apexHang'), band = PC('apexBand'), fall = PC('fallGravity'), maxFall = PC('maxFall');
  let y = 0, vy = Math.sqrt(2 * g * JUMP_H), t = 0;
  const pts = [];
  while (y >= 0 && t < 5) { pts.push([t, y]); const k = vy < -band ? fall : Math.abs(vy) <= band ? hang : 1; vy = Math.max(-maxFall, vy - g * k * dt); y += vy * dt; t += dt; }
  const above = (h) => { const up = pts.filter(([, z]) => z > h); return up.length ? { from: up[0][0], to: up.at(-1)[0], long: up.at(-1)[0] - up[0][0] } : { from: 0, to: 0, long: 0 }; };
  return { air: t, top: Math.max(...pts.map((p) => p[1])), above };
}
// The walls you jump: each passes under you for (band + the jelly's width) / its speed; a jump clears it when the feet stay above its height that long
// (the Vacuum's lane runs from where the charge started to its front, vacuum.js laneHits: once the front reaches you, you stand in it until the charge ends)
const WALLS = () => {
  const C = CONTENT.elites, B = CONTENT.bosses, R2 = 2 * JELLY_R;
  return [
    { name: 'Alligator tail-slam ring', h: C.croc.skills.tail.height, pass: (C.croc.skills.tail.band + R2) / C.croc.skills.tail.speed, src: kdl('content/elites.kdl', 'elite', 'croc') },
    { name: 'Singing Bowl ring', h: C.bowl.skills.ring.height, pass: (C.bowl.skills.ring.band + R2) / C.bowl.skills.ring.speed, src: kdl('content/elites.kdl', 'elite', 'bowl') },
    { name: 'Singing Bowl ring, angry', h: C.bowl.skills.ring.height, pass: (C.bowl.skills.ring.band + R2) / C.bowl.skills.ring.angrySpeed, src: kdl('content/elites.kdl', 'elite', 'bowl') },
    { name: 'Headphones shove wave', h: C.headphones.skills.shove.height, pass: R2 / C.headphones.skills.shove.speed, src: kdl('content/elites.kdl', 'elite', 'headphones') },
    { name: 'Clog pinball ring', h: B.clog.skills.pinball.ringH, pass: R2 / B.clog.skills.pinball.ringSpeed, src: kdl('content/bosses.kdl', 'boss', 'clog') },
    { name: 'Vacuum charge lane', h: num('src/vacuum.js', /this\.h = ([\d.]+);/), pass: B.vacuum.skills.charge.time - ASSUME.near / B.vacuum.skills.charge.speed, src: at('src/vacuum.js', /this\.h = /),
      // already low: the knob is how long you stand in the lane
      long: (win) => ({ at: `content/bosses.kdl:${nodeOf('bosses', 'vacuum').children.find((c) => c.name === 'charge').line}`, change: `charge time=${B.vacuum.skills.charge.time} → ${r(win / 1.5 + ASSUME.near / B.vacuum.skills.charge.speed, 2)}`, does: `the lane is under you for ${r(win / 1.5, 2)} s, two thirds of a jump` }) },
    { name: 'Wall Clock sweeping hand', h: num('src/elites.js', /sweepH: ([\d.]+)/), pass: 0.03 / (Math.PI * 0.42 / (0.55 / TEMPO)) + R2 / (Math.PI * 0.42 / (0.55 / TEMPO)), src: at('src/elites.js', /const CLOCK_HITS = /) },
  ];
};
// What each attack asks of the jelly's swimming: metres to get clear over the seconds it gives
export function dodgeNeeds() {
  const out = [];
  for (const A of ACTS) {
    const ms = refStats('normal', RUN_LOG.level[A.n - 1]).moveSpeed;
    for (const kind of A.stage.elites.map((e) => e.kind)) for (const angry of [false, true]) for (const x of eliteAttacks(kind, angry)) {
      if (angry && !CONTENT.elites[kind].angry) continue;
      if (angry && out.some((o) => o.kind === kind && o.id === x.id && Math.abs(o.need - (x.pull ?? x.move / x.dodge)) < 1e-9)) continue;
      out.push({ A, kind, who: CONTENT.elites[kind].name, id: x.id, angry, dmg: x.dmg * A.power, move: x.move, dodge: x.dodge, need: x.pull ?? x.move / x.dodge, pull: x.pull, ms, line: nodeOf('elites', kind).children.find((c) => c.name === x.id || x.id.startsWith(c.name))?.line ?? nodeOf('elites', kind).line, file: 'content/elites.kdl' });
    }
  }
  return out.filter((o) => o.dmg > 0 && (o.pull || (o.move > 0 && Number.isFinite(o.need))));
}
function sheetC5() {
  const flags = [], J = jumpArc(), N = dodgeNeeds(), base = SWIM;
  const rows = N.map((o) => [`${o.who}: ${o.id}${o.angry ? ' (angry)' : ''}`, o.A.n, r(o.dmg, 1), o.pull ? 'held by a pull' : r(o.move * 100, 1) + ' cm', o.pull ? '' : r(o.dodge, 2), r(o.need, 2), pct(o.need / base).slice(1), pct(o.need / (base * o.ms)).slice(1)]);
  const over = N.filter((o) => o.need > base * o.ms && !(o.angry && N.some((p) => !p.angry && p.kind === o.kind && p.id === o.id && p.need > base * p.ms)));
  for (const o of over) {
    const ok = o.pull ? `pull ${o.pull} → ${r(base * 0.85, 2)}` : `its dodge time ${r(o.dodge, 2)} s → ${r(o.move / (base * o.ms * 0.85), 2)} s`;
    flags.push({ text: o.pull ? `${o.who}'s ${o.id}${o.angry ? ' (angry)' : ''} pulls at ${o.pull} m/s: getting away takes ${pct(o.need / base).slice(1)} Move speed, and the act ${o.A.n} reference jelly has ${pct(o.ms).slice(1)}.${(() => { const m = N.find((p) => p.angry && p.kind === o.kind && p.id === o.id); return m ? ` Angry it pulls at ${m.pull} m/s (${pct(m.need / base).slice(1)}).` : ''; })()} It can't miss, so for most players it is ${r(o.dmg, 1)} Health every time.` : `${o.who}'s ${o.id}${o.angry ? ' (angry)' : ''} asks for ${r(o.need, 2)} m/s (${r(o.move * 100, 1)} cm in ${r(o.dodge, 2)} s), ${pct(o.need / (base * o.ms)).slice(1)} of the act ${o.A.n} reference jelly's swim: stepping out isn't enough, only a jump or luck.`,
      knob: { at: `${o.file}:${o.line}`, change: ok, does: 'a reference jelly can get away at 85% of its speed' } });
  }
  // walls you jump: is the hang long enough?
  const walls = WALLS().map((w) => ({ ...w, win: J.above(w.h) }));
  for (const w of walls) if (w.win.long < w.pass * 1.5) flags.push({ text: `The ${w.name} is ${r(w.h * 100, 1)} cm tall and passes under you in ${r(w.pass, 2)} s; a full jump keeps the jelly over it for ${r(w.win.long, 2)} s, ${w.win.long < w.pass ? 'too short: it can\'t be cleared' : 'under 1.5x: the timing is tight'}.`,
    knob: w.long && w.h <= J.top * 0.6 ? w.long(w.win.long) : { at: w.src, change: `height ${w.h} → ${r(J.top * 0.6, 3)}`, does: `a jump clears it for ${r(J.above(J.top * 0.6).long, 2)} s` } });
  // what Move speed buys: the share of dodge-able Health (step-out attacks) the reference jelly can step out of, by Move speed
  const steps = [1, 1.1, 1.2, 1.3, 1.5, 1.75, 2], sh = (m) => { const all = N.filter((o) => !o.pull), tot = all.reduce((s, o) => s + o.dmg, 0); return all.filter((o) => o.need <= base * m).reduce((s, o) => s + o.dmg, 0) / tot; };
  return {
    id: 'C5', title: 'Moving and dodging',
    lede: 'What each Elite attack asks of your swimming: the distance to get clear over the time it gives, as a share of your speed. And how long a jump keeps you over the walls you are meant to jump.',
    numbers: [
      ['Swim speed (m/s at Move speed 100%)', SWIM, at('src/config.js', /walkSpeed: /)],
      ['Jump height (m), gravity, fall x, apex hang x', `${JUMP_H}, ${PC('gravity')}, ${PC('fallGravity')}, ${PC('apexHang')}`, at('src/config.js', /jumpHeight: /)],
      ['Jelly radius (m)', JELLY_R, at('src/config.js', /radius: 0\.0306/)],
      ['Move speed card: Common / Rare / Epic', LV.cards.moveSpeed.amounts.join(' / '), cardLine('moveSpeed')],
      ['A full jump: in the air (s), top (m)', `${r(J.air, 2)}, ${r(J.top, 3)}`, at('src/player.js', /a heavier fall than rise/)],
      ...walls.map((w) => [`${w.name}: height (m), passes under you (s)`, `${w.h}, ${r(w.pass, 2)}`, w.src]),
      ...ACTS.map((A, i) => [`Act ${A.n} door: reference Move speed`, pct(refStats('normal', RUN_LOG.level[i]).moveSpeed).slice(1), 'tools/balance-sheet.mjs refStats']),
    ],
    model: `need (m/s) = metres to get clear (half the Warning's width + the jelly's ${r(JELLY_R * 100, 1)} cm) / dodge seconds (from C3: from the lock to the hit)
share = need / (${SWIM} m/s x Move speed); over 100% the attack can't be stepped out of in time
a pull (the Coffer's tongue) asks for its own speed, whatever the time
a wall passes under you for (its thickness + the jelly's width) / its speed; a held jump keeps the feet above h for the time the arc spends there (src/player.js, stepped at 240 a second)`,
    tables: [{ head: ['Attack', 'Act', 'A hit (with power)', 'To get clear', 'In (s)', 'Needs (m/s)', 'Of base swim', 'Of the act\'s reference jelly'], rows },
      { head: ['Wall', 'Height (cm)', 'Passes under you (s)', 'A jump keeps you over it (s)', 'From (s after the jump)'], rows: walls.map((w) => [w.name, r(w.h * 100, 1), r(w.pass, 2), r(w.win.long, 2), r(w.win.from, 2)]) },
      { head: ['Move speed', ...steps.map((m) => pct(m).slice(1))], rows: [['Share of step-out Health you can outrun', ...steps.map((m) => pct(sh(m)).slice(1))]] }],
    charts: [bars('Speed each attack asks, as a share of base swim (100% dashed)', N.map((o) => [`${o.who.replace(/^The /, '')} ${o.id}${o.angry ? '!' : ''}`, Math.min(4, o.need / base) * 100, o.A.n % 2 ? '' : 'b']), { fmt: (v) => r(v) + '%', ref: 100, left: 200 }),
      bars('Share of step-out Health you can outrun, by Move speed', steps.map((m) => [pct(m).slice(1), sh(m) * 100]), { fmt: (v) => r(v) + '%', cls: 'b' })],
    flags,
    notes: ['Bosses and bugs are in C4 and C1 (their dodge times); the speed table here is the Elites\' attacks, where the files give a radius for every Warning.', 'A jump that lands just as a wall arrives is a second chance the table doesn\'t count; the jump window is from a standing start, not a running one.', 'Move speed also stretches a step into a dodge for every Shot; what it is worth in Health saved needs play (the run log\'s damage by source, before and after).'],
  };
}

// ================================================================== Wave D3: the spread of builds
// The dice-only roller: whole runs rolled with the game's own dice (rollCards, threeOfAKind, rollTreasures, threeOfAKindTreasures from
// src/stats.js, and the Legendary and Attack upgrade picks as src/run.js shuffles them), on a seeded generator. The player's part is
// fixed: either the pick that's best on paper (the sheets' prices) or one at random, so all the spread is the dice. Each build is priced at
// each Boss door with the game's own compileMods, against the reference jelly (cards by their odds, no Treasures) at the same level.
const TAKE = (S, mods, owned, attack) => (t) => (owned[t.id] || 0) < t.stack && (!t.needs || owned[t.needs]) && (!t.needsStat || S[t.needsStat] > 0) && (!t.needsChance || mods.chancy)
  && !(t.notFor?.includes(attack) || t.retired) && !(t.heals && mods.shield.fromHealth);
const shuffled = (xs, rng) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// a pick's price on paper at a moment: what the B sheets would say for the next copy, its rarity's budget where nothing is priced
const PRICE = new Map();
function pickPrice(kind, item, type, M, n) {
  const key = `${kind}:${item.id}:${type}:${M.key}:${n}`;
  if (PRICE.has(key)) return PRICE.get(key);
  let p;
  if (kind === 'treasure') {
    const node = nodeOf('treasures', item.id), w = worth(type, M, { t: { [item.id]: n + 1 } }, { fx: fxOf(item, node, n + 1) / (n ? fxOf(item, node, n) : 1), base: n ? { t: { [item.id]: n } } : {} });
    p = unpricedOf(item).length || w.left.length ? Math.max(total(w), PICK[item.rarity] ?? 0) : total(w);
  } else if (kind === 'evolution') { const w = legendWorth({ item, kind, file: 'evolutions', spec: { e: [item.id] } }, type, M); p = unpricedOf(item).length ? Math.max(w.pts - w.cost, PICK.legendary) : w.pts - w.cost; }
  else { const w = upgradeWorth(item, M); p = unpricedOf(item).length ? Math.max(w.pts, PICK.upgrade) : w.pts; }
  PRICE.set(key, p);
  return p;
}
// one run: { doors: [points at each Boss door], items: ids held at the Encore door }
// each kind of roll has its own dice (DICE), so one kind can be held still (fix) to see how much of the spread is its doing
export const DICE = ['cards', 'chests', 'legendary', 'upgrades', 'finds'];
export function rollRun(type, seed, { policy = 'best', weights = CHEST_WEIGHTS, more = null, fix = null } = {}) {
  const n3 = (k) => (more === k ? 4 : 3);   // more: one kind of offer shows a fourth option
  const R = Object.fromEntries(DICE.map((d, i) => [d, seeded((d === fix ? 1 : seed) * 7919 + i)])), J = CONTENT.jellies[type], attack = J.attack, S = baseOf(type), owned = {}, evos = [], ups = [], doors = [];
  const spec = () => ({ t: owned, e: evos, u: ups });
  let mods = modsOf(type, spec()), level = 1;
  const pickRng = seeded(seed * 31 + 5), choose = (opts, price) => (policy === 'best' ? opts.reduce((p, q) => (price(q) > price(p) ? q : p)) : opts[Math.floor(pickRng() * opts.length)]);
  const live = (M) => withMods(type, S, mods, Infinity);
  const upgrade = (M) => { const pool = CONTENT.upgrades.filter((u) => u.jelly === type && !ups.includes(u.id) && (!u.needs || ups.includes(u.needs))), left = shuffled(pool, R.upgrades).slice(0, n3('upgrades')); if (left.length) { ups.push(choose(left, (u) => pickPrice('upgrade', u, type, M, 0)).id); mods = modsOf(type, spec()); } };
  const chest = (source, M) => {
    const now = live(M), take = TAKE(now, mods, owned, attack), favor = (t) => weights[source][t.rarity] / treasureTier(t).weight;
    const offer = threeOfAKindTreasures(rollTreasures(CONTENT.treasures.filter((t) => weights[source][t.rarity] > 0 && take(t)), n3('chests'), now.luck, favor, R.chests), CONTENT.treasures.filter(take), R.chests);
    if (!offer.length) return;
    const t = choose(offer, (x) => pickPrice('treasure', x, type, M, owned[x.id] || 0));
    owned[t.id] = (owned[t.id] || 0) + 1; mods = modsOf(type, spec());
  };
  const card = (M) => {
    const now = live(M), skip = [...(mods.shield.fromHealth ? ['health', 'regen'] : []), ...cardsNotFor(attack)];
    const cards = threeOfAKind(rollCards(S, n3('cards') + mods.cardChoices, mods.cardRarity, now.luck, now, skip, R.cards), now, R.cards);
    if (!cards.length) return;
    const gain = (c) => { const T = { ...S }; applyCard(T, c); const a = withMods(type, T, mods), b = now; return offence(type, a) / offence(type, b) + defence(a, M.A, 'careful', a.taken) / defence(b, M.A, 'careful', b.taken); };
    applyCard(S, choose(cards, gain));
  };
  const legend = (M) => {
    const can = (t) => t.rarity === 'legendary' && (owned[t.id] || 0) < t.stack && (!t.needs || owned[t.needs]) && !(t.notFor?.includes(attack) || t.retired) && (!t.needsStat || live(M)[t.needsStat] > 0) && (!t.needsChance || mods.chancy);
    const left = shuffled([...CONTENT.treasures.filter(can).map((t) => ['treasure', t]), ...CONTENT.evolutions.filter((e) => !evos.includes(e.id) && !e.notFor?.includes(attack) && !e.retired).map((e) => ['evolution', e])], R.legendary).slice(0, n3('legendary'));
    if (!left.length) return;
    const [k, x] = choose(left, ([k2, y]) => pickPrice(k2, y, type, M, owned[y.id] || 0));
    if (k === 'evolution') evos.push(x.id); else owned[x.id] = (owned[x.id] || 0) + 1;
    mods = modsOf(type, spec());
  };
  upgrade(MOMENTS[0]);   // a returning player's run opens with one
  ACTS.forEach((A, i) => {
    const M = MOMENTS[i + 1], prevT = i ? RUN_LOG.treasures[i - 1] : 0, gainT = RUN_LOG.treasures[i] - prevT - (i ? 1 : 0), rooms = A.stage.treasures.at.length, elites = A.stage.elites.length;
    const find = Math.max(0, Math.min(1, (gainT - elites) / rooms));   // room chests opened, so a run's Treasures match the run log's
    const ev = [];
    const ups2 = Math.floor(RUN_LOG.level[i]) - level; for (let k = 0; k < ups2; k++) ev.push([A.night * (k + 0.5) / ups2, 'card']);
    A.stage.treasures.at.forEach((t) => ev.push([t, 'room']));
    for (let k = 0; k < elites; k++) ev.push([A.night * (k + 1) / (elites + 1), 'elite']);
    for (const [, what] of ev.sort((p, q) => p[0] - q[0])) {
      if (what === 'card') { card(M); level++; } else if (what === 'room') { if (R.finds() < find) chest('room', M); } else chest('elite', M);
    }
    // priced at the door: Offence and Defence of this build against the reference jelly at the same level
    const ref = refStats(type, M.level), refOff = offence(type, ref), refDef = defence(ref, A);
    const now = live(M), fx = Object.entries(owned).reduce((p, [id, n]) => { const t = CONTENT.treasures.find((x) => x.id === id); return p * fxOf(t, nodeOf('treasures', id), n); }, 1)
      * evos.reduce((p, id) => p * fxOf(CONTENT.evolutions.find((x) => x.id === id), nodeOf('evolutions', id), 1), 1) * ups.reduce((p, id) => p * fxOf(CONTENT.upgrades.find((x) => x.id === id), nodeOf('upgrades', id), 1), 1);
    const off = offence(type, now) * fx + ASSUME.gadgetHit * gadgets(mods, now).dps, def = defence(now, A, 'careful', now.taken);
    doors.push({ off: off / refOff, def: def / refDef });
    if (i < 3) { legend(M); upgrade(M); }
  });
  return { doors, items: [...Object.keys(owned), ...evos, ...ups] };
}
const pctile = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
export function rollMany(n = 10000, opts = {}, types = TYPES) {
  const runs = [];
  for (let k = 0; k < n; k++) { const type = types[k % types.length]; runs.push({ type, ...rollRun(type, 1000 + k, opts) }); }
  return runs;
}
// the lucky tenth over the unlucky tenth within each type, the middle type's figure
const within = (runs, d) => median(TYPES.map((t) => { const s = spreadOf(runs.filter((x) => x.type === t), d); return s.p90 / s.p10; }));
const spreadOf = (runs, d, k = 'off') => { const v = runs.map((x) => x.doors[d][k]); return { p10: pctile(v, 0.1), p50: pctile(v, 0.5), p90: pctile(v, 0.9) }; };
export const D3_RUNS = 10000;
function sheetD3(runs = D3_RUNS) {
  const few = Math.max(TYPES.length, Math.round(runs / 5)), flags = [], best = rollMany(runs), blind = rollMany(few, { policy: 'blind' });
  const doors = ACTS.map((A, d) => ({ A, best: spreadOf(best, d), blind: spreadOf(blind, d), within: within(best, d) }));
  const x2 = (v) => `x${r(v, 2)}`, real = (i) => bossFight(ACTS[i]).k;
  const rows = doors.map((x, i) => [x.A.boss, x2(x.best.p10), x2(x.best.p50), x2(x.best.p90), x2(x.within), x2(x.blind.p50), x2(real(i)), x2(spreadOf(best, i, 'def').p50)]);
  const typeRows = TYPES.map((t) => { const mine = best.filter((x) => x.type === t); const s = spreadOf(mine, 3); return [name(t), x2(s.p10), x2(s.p50), x2(s.p90), x2(s.p90 / s.p10)]; });
  const E = doors[3];
  // how much is the roll (lucky tenth over unlucky tenth, within a type), against how much is the picking
  const luck = E.within, skill = E.best.p50 / E.blind.p50;
  // which dice it is: hold one kind still (the same roll in every run) and see how much the gap closes
  const some = Math.max(TYPES.length * 2, Math.round(runs / 10)), base = within(best.slice(0, some), 3);
  const held = DICE.map((d) => [d, within(rollMany(some, { fix: d }), 3)]), most = held.reduce((p, q) => (q[1] < p[1] ? q : p));
  // which items the lucky tenth hold far more often than everyone
  // (within each type, so a type's own Attack upgrades don't ride on the type being strong)
  const cut = Object.fromEntries(TYPES.map((t) => [t, spreadOf(best.filter((x) => x.type === t), 3).p90])), top = best.filter((x) => x.doors[3].off >= cut[x.type]);
  const freq = (set, id) => set.filter((x) => x.items.includes(id)).length / Math.max(1, set.length), mine = (set, id) => set.filter((x) => TYPES.some((t) => t === x.type && (CONTENT.upgrades.find((u) => u.id === id)?.jelly ?? t) === t));
  const ids = [...new Set(best.flatMap((x) => x.items))];
  const lift = ids.map((id) => ({ id, all: freq(mine(best, id), id), top: freq(mine(top, id), id) })).filter((x) => x.all > 0.05).map((x) => ({ ...x, k: x.top / x.all })).sort((p, q) => q.k - p.k);
  // a proposed change and what it does to the gap: a fourth option in the offers whose dice matter most
  const kind = most[0] === 'finds' ? 'chests' : most[0], four = within(rollMany(some, { more: kind }), 3);
  const where = { chests: [at('src/run.js', /^ {2}rollChest\(source = 'room', n = 3/), 'n = 3 → 4 (a fourth Treasure in every chest)'], legendary: [at('src/run.js', /const left = shuffle\(\[\.\.\.TREASURES\.filter\(can\), \.\.\.evos\]\)\.slice\(0, 3\)/), 'slice(0, 3) → slice(0, 4) (a fourth Legendary or evolution after each Boss)'],
    upgrades: [at('src/run.js', /const left = shuffle\(pool\)\.slice\(0, 3\)/), 'slice(0, 3) → slice(0, 4) (a fourth Attack upgrade)'], cards: [at('src/run.js', /rollLevelUp\(n = 3 \+ this\.mods\.cardChoices/), 'n = 3 → 4 (a fourth level-up card)'] }[kind];
  if (luck > 1.5) {
    flags.push({ text: `At the Encore door the lucky tenth of rolled builds of a type (the best pick on paper taken every time) have ${r(luck, 1)}x the Offence of its unlucky tenth; picking the best rather than at random is worth ${r(skill, 2)}x. Holding one kind of dice still shows whose doing it is: the ${most[0]} close it most, from x${r(base, 2)} to x${r(most[1], 2)}.`,
      knob: { at: where[0], change: where[1], does: `the ratio goes from x${r(base, 2)} to x${r(four, 2)} on ${some.toLocaleString('en-US')} rolls${four > 0.9 * base ? ': more choice barely narrows it, as the luck is spread over every roll' : ''}` } });
  }
  for (const x of lift.slice(0, 3)) if (x.k > 2.5) {
    const item = CONTENT.treasures.find((t) => t.id === x.id) || CONTENT.evolutions.find((t) => t.id === x.id) || CONTENT.upgrades.find((t) => t.id === x.id);
    const file = CONTENT.treasures.includes(item) ? 'treasures' : CONTENT.evolutions.includes(item) ? 'evolutions' : 'upgrades', node = nodeOf(file, x.id), t = turn(node);
    flags.push({ text: `${item.name} is in ${pct(x.top).slice(1)} of the luckiest tenth of builds (of each type) and ${pct(x.all).slice(1)} of all that could hold it: finding it is ${r(x.k, 1)}x likelier in a lucky run than in any run, so whether it's offered decides the build.`,
      knob: t ? { at: `content/${file}.kdl:${t.line}`, change: `${t.write(t.v)} → ${t.write(+(t.v * 0.7).toPrecision(2))}`, does: 'a third less, so missing it costs less' } : { at: kdl(`content/${file}.kdl`, file === 'treasures' ? 'treasure' : file === 'evolutions' ? 'evolution' : 'upgrade', x.id), change: 'its main number down a third', does: 'missing it costs less' } });
  }
  return {
    id: 'D3', title: 'The spread of builds',
    lede: `${runs.toLocaleString('en-US')} runs rolled with the game's own dice, ${Math.round(runs / TYPES.length)} of each type, the best pick on paper taken every time: how far apart an unlucky and a lucky build are at each Boss door.`,
    numbers: [
      ['Level-up roll and three of a kind', 'rollCards, threeOfAKind', at('src/stats.js', /^export function rollCards/)],
      ['Chest roll and three of a kind', 'rollTreasures, threeOfAKindTreasures', at('src/stats.js', /^export function rollTreasures/)],
      ['Chest weights: room, Elite', `${Object.values(CHEST_WEIGHTS.room).join('/')}, ${Object.values(CHEST_WEIGHTS.elite).join('/')}`, at('src/stats.js', /^export const CHEST_WEIGHTS/)],
      ['Who can be offered what (takeable)', 'stack, needs, needs-stat, needs-chance, not-for, heals', at('src/run.js', /^ {2}takeable\(t\)/)],
      ['Boss rewards: 3 from Legendaries and evolutions, then 1 of 3 Attack upgrades', 'pickLegendary, pickUpgrade', at('src/run.js', /^ {2}pickLegendary\(/)],
      ['A returning player starts with 1 of 3 Attack upgrades', 'pickUpgrade', at('src/run.js', /a returning player's run opens with 1 of 3 Attack upgrades/)],
      ['Levels and Treasures held at each door', `${RUN_LOG.level.join(', ')}; ${RUN_LOG.treasures.join(', ')}`, 'tools/balance-sheet.mjs RUN_LOG'],
    ],
    model: `a run: 1 of 3 Attack upgrades, then each act's level-ups (the run log's levels), its room chests and Elite chests in time order, and after acts 1 to 3 the Legendary pick and an Attack upgrade
room chests are opened at the share that gives the run log's Treasures held (every Elite is beaten); level-up rerolls and the reward spin's look are left out (the spin never changes the roll)
dice: the game's own functions on a seeded generator (run k uses seed 1000 + k), so the page is the same every time
the player's part is fixed: "best" takes the option the sheets price highest (a card by what it adds now, a pick by its B-sheet price for the next copy, its rarity's budget where nothing is priced); "blind" takes one at random
a build at a door = its Offence (and Defence) / the reference jelly's at the same level (average cards, no Treasures), priced with compileMods as in sheets B2 to B6\nOffence = the attack with its stats and its Crit, mark, status and conditional lines (A4) + gadgets at ${ASSUME.gadgetHit} of their paper damage a second (B3's figures assume every swing lands)\nthe run log's 'Treasures add' (sheet S0) is the real thing to set the middle against: paper builds run high where gadgets and lines hold all the time`,
    tables: [{ head: ['Door', 'Offence: unlucky tenth', 'Middle', 'Lucky tenth', 'Lucky / unlucky, within a type', 'Middle, picking blind', 'Run log: what Treasures add (C4)', 'Defence, middle'], rows },
      { head: ['Type', 'Encore door Offence: unlucky tenth', 'Middle', 'Lucky tenth', 'Lucky / unlucky'], rows: typeRows },
      { head: ['Held still', 'Nothing', ...DICE], rows: [['Lucky / unlucky at the Encore door', x2(base), ...held.map(([, v]) => x2(v))]] },
      { head: ['Item', 'In builds that could hold it', 'In the lucky tenth of its type', 'x'], rows: lift.slice(0, 12).map((x) => [(CONTENT.treasures.find((t) => t.id === x.id) || CONTENT.evolutions.find((t) => t.id === x.id) || CONTENT.upgrades.find((t) => t.id === x.id)).name, pct(x.all).slice(1), pct(x.top).slice(1), r(x.k, 1)]) }],
    charts: [grouped('Offence at each door, x the reference jelly: unlucky tenth, middle, lucky tenth', doors.map((x) => x.A.boss), [['Unlucky', doors.map((x) => x.best.p10)], ['Middle', doors.map((x) => x.best.p50)], ['Lucky', doors.map((x) => x.best.p90)]], x2),
      bars('Encore door, middle build by type (x the reference jelly\'s Offence)', TYPES.map((t) => [name(t), spreadOf(best.filter((x) => x.type === t), 3).p50]), { fmt: x2 })],
    flags,
    notes: ['Points are on paper: behaviour words that the sheets don\'t price count at their rarity\'s budget when picking and nothing in the build\'s price, so a build of behaviour Treasures reads low.', 'Change a number, run the script, and this table shows what the change does to the gap: that is the question this sheet answers.'],
  };
}

// ================================================================== Wave D: the wrappers (D1 and D2)
// ------------------------------------------------------------------ D1: score
ASSUME.elitesBeaten = 2;   // Elites beaten in a cleared act, of 3: the run log has no count (a run log addition)
// What the mean cleared act on the run log earns, part by part (src/score.js actParts), and what a perfect one does
export function meanAct(i) {
  const A = ACTS[i];
  return actParts({ act: A.n, nightShare: 1, won: true, elites: ASSUME.elitesBeaten, bugsOut: 1, bugsCleared: RUN_LOG.cleared[i], damageTaken: RUN_LOG.healthLost[i], bossSeconds: RUN_LOG.bossSeconds[i] });
}
function sheetD1() {
  const flags = [], acts = ACTS.map((A, i) => meanAct(i)), keys = acts[0].map(([k]) => k);
  const PART = { night: 'Night survived', bossDamage: 'Boss damage', bossBeaten: 'Boss beaten', elites: 'Elites', bugs: 'Bugs cleared', clean: 'Clean play', pace: 'Boss pace' };
  const perfect = actParts({ nightShare: 1, won: true, elites: SCORE.elites, bugsOut: 1, bugsCleared: 1, damageTaken: 0, bossSeconds: 0 });
  const rows = keys.map((k, j) => [PART[k], r(perfect[j][1]), ...acts.map((a) => `${r(a[j][1])} (${pct(a[j][1] / perfect[j][1]).slice(1)})`)]);
  const tot = acts.map((a) => a.reduce((s, [, v]) => s + v, 0)), fixed = ['night', 'bossDamage', 'bossBeaten'];
  const skillMax = perfect.filter(([k]) => !fixed.includes(k)).reduce((s, [, v]) => s + v, 0), fixedMax = perfect.filter(([k]) => fixed.includes(k)).reduce((s, [, v]) => s + v, 0);
  // clean play: the damage that pays nothing, against what the mean cleared act takes
  const lost = RUN_LOG.healthLost, zero = lost.map((l, i) => (l >= SCORE.cleanGone[i] ? i + 1 : 0)).filter(Boolean);
  if (zero.length) {
    const want = SCORE.cleanGone.map((g, i) => Math.max(g, Math.ceil(lost[i] / 0.75 / 50) * 50));
    flags.push({ text: `Clean play pays nothing at ${SCORE.cleanGone.join(' / ')} Health taken (acts 1 to 4), and the mean cleared act loses ${lost.join(', ')} (acts 1 to 4): act${zero.length > 1 ? 's' : ''} ${zero.join(', ')} earn${zero.length > 1 ? '' : 's'} 0 of its ${r(SCORE.clean)}, so most of the part is out of reach.`,
      knob: { at: at('src/score.js', /^ {2}cleanGone:/), change: `cleanGone: [${SCORE.cleanGone.join(', ')}] → [${want.join(', ')}]`, does: `the mean act in act 4 keeps ${pct(1 - lost[3] / want[3]).slice(1)} of the part, and a clean run still takes all of it` } });
  }
  // pace: the mean Boss fight sits near the top of the range in acts 1 to 3
  const paceShare = RUN_LOG.bossSeconds.map((t) => Math.max(0, Math.min(1, (SCORE.paceNone - t) / (SCORE.paceNone - SCORE.paceFull))));
  if (Math.max(...paceShare.slice(0, 3)) > 0.85) {
    const m = RUN_LOG.bossSeconds.slice(0, 3).reduce((s, x) => s + x, 0) / 3, F = Math.round(0.45 * m / 5) * 5, N = Math.round((m - 0.55 * F) / 0.45 / 5) * 5;
    flags.push({ text: `Boss pace gives full marks at ${SCORE.paceFull} s and the mean Boss fight takes ${RUN_LOG.bossSeconds.slice(0, 3).join(', ')} s in acts 1 to 3: ${paceShare.slice(0, 3).map((p) => pct(p).slice(1)).join(', ')} of the part, so it pays nearly everyone the same.`,
      knob: { at: at('src/score.js', /^ {2}paceFull:/), change: `paceFull: ${SCORE.paceFull} → ${F}, paceNone: ${SCORE.paceNone} → ${N}`, does: `a ${r(m)} s fight earns ${pct((N - m) / (N - F)).slice(1)} of the part, with room above and below` } });
  }
  return {
    id: 'D1', title: 'Score',
    lede: 'What each part of the score pays the mean cleared act on the run log, and how much of a run\'s score is skill and how much is just finishing.',
    numbers: Object.entries(SCORE).map(([k, v]) => [`score.${k}`, v, at('src/score.js', new RegExp(`^ {2}${k}:`))])
      .concat([['Run log: Health lost, Boss seconds, share of bugs cleared', `${RUN_LOG.healthLost.join(', ')}; ${RUN_LOG.bossSeconds.join(', ')}; ${RUN_LOG.cleared.join(', ')}`, 'tools/balance-sheet.mjs RUN_LOG'], ['Elites beaten in a cleared act (of 3)', ASSUME.elitesBeaten, 'tools/balance-sheet.mjs ASSUME']]),
    model: `each part is src/score.js actParts of the run log's mean cleared act: the whole night, the Boss beaten, ${ASSUME.elitesBeaten} Elites (assumed: the run log has no count), the cleared share of bugs, the Health lost, the Boss time
a run's means hide its spread: a part that looks fair on the mean can still pay every player the same, or pay none of them. The per-run spread needs the run log's rows (the run log additions), so this sheet reads the mean only
night, Boss damage and Boss beaten are the finishing parts (${r(fixedMax)} of an act's ${r(fixedMax + skillMax)}); Elites, bugs, clean play and pace are the skill parts (${r(skillMax)})`,
    tables: [{ head: ['Part', 'Perfect act', ...ACTS.map((A) => `Act ${A.n}, mean cleared`)], rows }, { head: ['', ...ACTS.map((A) => `Act ${A.n}`), 'Run (4 acts)'], rows: [['Mean cleared act earns', ...tot.map((t) => r(t)), r(tot.reduce((s, x) => s + x, 0))], ['Share of a perfect act', ...tot.map((t) => pct(t / (fixedMax + skillMax)).slice(1)), pct(tot.reduce((s, x) => s + x, 0) / MAX_SCORE).slice(1)]] }],
    charts: [bars('Share of each part the mean cleared act earns, act 2', keys.map((k, j) => [PART[k], 100 * acts[1][j][1] / perfect[j][1]]), { fmt: (v) => r(v) + '%' }),
      bars('Clean play earned by the mean cleared act, by act (of 2,000)', ACTS.map((A, i) => [`Act ${A.n}`, acts[i][keys.indexOf('clean')][1]]), { fmt: (v) => r(v), cls: 'b' })],
    flags,
    notes: ['A part that pays zero or full to the mean act can still separate players if the spread around that mean is wide: the per-run rows will say.'],
  };
}

// ------------------------------------------------------------------ D2: first run and Easy
function sheetD2() {
  const flags = [], A = ACTS[0], lost = RUN_LOG.healthLost[0], levels = [1, 3, 6, 9, MOMENTS[1].level];
  // Defence a first-timer's jelly has by level (cards only), against what a cleared act 1 costs on the run log
  const rows = levels.map((L) => { const S = refStats('normal', L), c = defence(S, A), b = defence(S, A, 'brawler'); return [r(L), r(S.health), r(c), r(b), r(c / lost, 2), r(b / lost, 2)]; });
  const sec = (L) => { const P = pressure(A, 1, { k: 1 }); return (P.find((x) => x.level >= L) || P[P.length - 1]).t; };
  const need = (style) => levels.find((L) => defence(refStats('normal', L), A, style) >= lost);
  const needB = need('brawler'), tB = needB ? sec(needB) : null;
  // Easy: x2 dealt, x0.5 taken
  const peak = (s) => { const P = pressure(A, 5, s); return [Math.max(...P.map((x) => x.load)), P.reduce((q, x) => q + x.load, 0) / P.length]; };
  const norm = peak({ k: 1 }), easy = peak({ k: 1, off: EASY_DEALT });
  const lines = [['Normal, cards only', ...norm.map((v) => r(v, 2))], ['Easy (x2 dealt)', ...easy.map((v) => r(v, 2))]];
  if (tB != null && tB > 0.25 * A.night) flags.push({ text: `A first-timer's jelly, with cards only, cannot spend what a cleared act 1 costs on the run log (${lost} Health) until level ${r(needB)}, about ${r(tB)} s into a ${A.night} s night, if it keeps the Shield down as a brawler does; as a careful player it needs level ${r(need('careful') ?? 0)}.`,
    knob: { at: at('src/first-run.js', /^const JUMP_TIP_AT/), change: 'a first run takes x0.75 from hits (a new number here, read by the damage step)', does: `a first run's Defence is a third more: the same ${lost} Health lasts about ${r(lost / 0.75)}` } });
  const offX = 1 / EASY_TAKEN;
  return {
    id: 'D2', title: 'First run and Easy',
    lede: 'What a first-timer\'s jelly can spend in act 1, and what Easy mode changes on paper. The run log\'s share of first-run deaths (6 in 10 Normal runs that finish act 1 and then die) is not in the files, so the sheet sizes the gap rather than proving it.',
    numbers: [['Easy: dealt, taken, Pearls', `x${EASY_DEALT}, x${EASY_TAKEN}, x${EASY_PEARLS}`, at('src/easy.js', /export const EASY = /)], ['Act 1: night s, power, toughness', `${A.night}, ${A.power}, ${A.toughness}`, A.file], ['Run log: act 1 Health lost', lost, 'tools/balance-sheet.mjs RUN_LOG']],
    model: `Defence = Health to spend over act 1 (sheet A5) for a reference Normal jelly, cards only, by level; the run log's act 1 Health lost is what a cleared act cost
load = Health arriving a second / Offence (sheet C2), cards only; Easy doubles damage dealt (x${EASY_DEALT}) and halves damage taken (x${EASY_TAKEN}): Offence x${EASY_DEALT}, Defence x${offX}
this sheet reads one act of one jelly with no Treasures: a first run takes some, so the gap is a ceiling`,
    tables: [{ head: ['Level', 'Health', 'Spend, careful', 'Spend, brawler', 'x the run log\'s loss, careful', 'brawler'], rows }, { head: ['Act 1 load', 'Peak', 'Mean over the night'], rows: lines },
      { head: ['Easy mode', 'Offence', 'Defence', 'Together'], rows: [['x', `x${EASY_DEALT}`, `x${offX}`, `x${r(EASY_DEALT * offX)}`]] }],
    charts: [bars('Act 1 Health to spend by level, brawler (line: the run log\'s loss)', levels.map((L, i) => [`Level ${r(L)}`, defence(refStats('normal', L), A, 'brawler')]), { fmt: (v) => r(v), ref: lost })],
    flags,
    notes: [`Easy's two halves multiply: x${EASY_DEALT} Offence and x${offX} Defence is about x${r(EASY_DEALT * offX)} on paper, and it posts no score.`],
  };
}

// ------------------------------------------------------------------ charts (inline SVG, no libraries)
const W = 460, ROW = 22;
const xmlesc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
// rows: [label, value, cls?]; band: [lo, hi] shaded; ref: a dashed line at this value
function bars(title, rows, { fmt = String, band, ref, cls = '', left: L = 150 } = {}) {
  const max = Math.max(...rows.map((x) => x[1]), band?.[1] ?? 0, ref ?? 0) * 1.08 || 1, R = 56, w = W - L - R, h = rows.length * ROW + 8;
  const x = (v) => L + Math.max(0, v) / max * w;
  let s = band ? `<rect class="band" x="${x(band[0])}" y="0" width="${x(band[1]) - x(band[0])}" height="${h}"/>` : '';
  rows.forEach(([label, v, c], i) => { const y = 4 + i * ROW; s += `<text class="l" x="${L - 8}" y="${y + 14}">${xmlesc(label)}</text><rect class="bar ${c ?? cls}" x="${L}" y="${y + 3}" width="${Math.max(1, x(v) - L)}" height="${ROW - 8}" rx="2"/><text class="v" x="${x(v) + 6}" y="${y + 14}">${xmlesc(fmt(v))}</text>`; });
  if (ref != null) s += `<line class="ref" x1="${x(ref)}" x2="${x(ref)}" y1="0" y2="${h}"/>`;
  return `<figure><figcaption>${xmlesc(title)}</figcaption><svg viewBox="0 0 ${W} ${h}" role="img" aria-label="${xmlesc(title)}">${s}</svg></figure>`;
}
// series: [[label, [v per group]]]
function grouped(title, groups, series, fmt = String) {
  const rows = groups.flatMap((g, gi) => series.map(([label, v], si) => [`${g} · ${label}`, v[gi], ['', 'b', 'c'][si]]));
  return bars(title, rows, { fmt, left: 190 });
}

// ------------------------------------------------------------------ the page
export const buildSheets = ({ runs = D3_RUNS } = {}) => [sheetS0(), sheetA1(), sheetA2(), sheetA3(), sheetA4(), sheetA5(), sheetB1(), sheetB2(), sheetB3(), sheetB4(), sheetB5(), sheetB6(), sheetB7(), sheetC1(), sheetC2(), sheetC3(), sheetC4(), sheetC5(), sheetD1(), sheetD2(), sheetD3(runs)];
function page(sheets) {
  const rev = (() => { try { return fs.readFileSync(path.join(ROOT, '.git/HEAD'), 'utf8').trim(); } catch { return ''; } })();
  const table = (t) => `<div class="scroll"><table><tr>${t.head.map((h) => `<th>${xmlesc(h)}</th>`).join('')}</tr>${t.rows.map((row) => `<tr>${row.map((c) => `<td>${xmlesc(c)}</td>`).join('')}</tr>`).join('')}</table></div>`;
  const sheet = (s) => `<section id="${s.id}"><div class="kicker">${s.id}</div><h2>${xmlesc(s.title)}</h2><p class="lede">${xmlesc(s.lede)}</p>
<h3>Flags and knobs</h3>${s.flags.length ? `<ol class="flags">${s.flags.map((f) => `<li><p>${xmlesc(f.text)}</p><p class="knob"><code>${xmlesc(f.knob.at)}</code> ${xmlesc(f.knob.change)}: ${xmlesc(f.knob.does)}.</p></li>`).join('')}</ol>` : '<p class="cap">Nothing flagged.</p>'}
<h3>Picture</h3><div class="charts">${s.charts.join('')}</div>
<h3>Model</h3><pre>${xmlesc(s.model)}</pre>
${s.tables.map(table).join('')}
${s.notes.map((n) => `<p class="cap">${xmlesc(n)}</p>`).join('')}
<details><summary>Numbers (${s.numbers.length}, each with its file and line)</summary>${table({ head: ['Number', 'Value', 'Where'], rows: s.numbers.map(([a, b, c]) => [a, String(b), c]) })}</details></section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jelly Run Balance Sheets</title>
<style>
:root{--bg:#f7f8f9;--panel:#fff;--ink:#0d1318;--ink2:#4a5560;--ink3:#77828d;--rule:#dfe4e8;--a:#2a78d6;--b:#1baf7a;--c:#eb6834;--band:#2a78d61f;--warn:#b97a00}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0e1114;--panel:#171b1f;--ink:#eef1f3;--ink2:#b6bfc7;--ink3:#87929c;--rule:#2a3138;--a:#3987e5;--b:#199e70;--c:#d95926;--band:#3987e52a;--warn:#e0a020}}
:root[data-theme="dark"]{--bg:#0e1114;--panel:#171b1f;--ink:#eef1f3;--ink2:#b6bfc7;--ink3:#87929c;--rule:#2a3138;--a:#3987e5;--b:#199e70;--c:#d95926;--band:#3987e52a;--warn:#e0a020}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,sans-serif;padding:24px 16px 64px}
main{max-width:920px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
h1{font-size:30px;margin:0}h2{font-size:22px;margin:0}h3{font-size:14px;margin:12px 0 0;color:var(--ink2)}
section{background:var(--panel);border:1px solid var(--rule);border-radius:6px;padding:16px;display:flex;flex-direction:column;gap:8px;min-width:0}
.kicker{font:500 12px ui-monospace,monospace;color:var(--ink3);letter-spacing:.08em}.lede{color:var(--ink2);margin:0}.cap{font-size:13px;color:var(--ink3);margin:0}
pre{background:var(--bg);border-radius:6px;padding:10px;overflow-x:auto;font-size:12.5px;margin:0}code{font-size:.9em}
.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:5px 10px 5px 0;border-bottom:1px solid var(--rule);vertical-align:top}th{color:var(--ink3);font-weight:500;white-space:nowrap}
.flags{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px}.flags p{margin:0}.knob{color:var(--ink2);font-size:13.5px}.knob code{color:var(--warn)}
figure{margin:0}figcaption{font-size:13px;color:var(--ink2);margin-bottom:4px}svg{width:100%;max-width:680px;height:auto;display:block}
svg text{font:12px system-ui,sans-serif;fill:var(--ink2)}svg .l{text-anchor:end}svg .bar{fill:var(--a)}svg .bar.b{fill:var(--b)}svg .bar.c{fill:var(--c)}svg .band{fill:var(--band)}svg .ref{stroke:var(--ink3);stroke-dasharray:4 3}
nav{display:flex;flex-wrap:wrap;gap:8px}nav a{color:var(--a)}summary{cursor:pointer;color:var(--ink2);font-size:13px}
</style></head><body><main>
<h1>Balance sheets</h1>
<p class="lede">Written by <code>node tools/balance-sheet.mjs</code> from the content files${rev ? ` (${xmlesc(rev)})` : ''}. One point is 1% of a level 1 Normal jelly. Nothing here changes the game: each flag names one knob, yours to accept or drop. How the numbers are worked out: <code>docs/agents/balance-model.md</code>.</p>
<nav>${sheets.map((s) => `<a href="#${s.id}">${s.id} ${xmlesc(s.title)} (${s.flags.length})</a>`).join('')}</nav>
${sheets.map(sheet).join('\n')}
</main></body></html>`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const out = process.argv.find((a) => a.startsWith('--out='))?.slice(6) || path.join(ROOT, '.wrangler/balance-sheets.html');
  const sheets = buildSheets();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, page(sheets));
  for (const s of sheets) for (const f of s.flags) console.log(`${s.id}  ${f.text}\n     knob ${f.knob.at}: ${f.knob.change}`);
  console.error(`balance-sheet: ${sheets.reduce((n, s) => n + s.flags.length, 0)} flags, page at ${path.relative(ROOT, out)}`);
}
