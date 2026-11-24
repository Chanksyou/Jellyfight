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

const { CONTENT, loadContent } = await game('src/content.js');
const realFetch = globalThis.fetch;
globalThis.fetch = async (f) => ({ ok: true, text: async () => fs.readFileSync(f, 'utf8') });   // loadContent reads with fetch
try { await loadContent(path.join(ROOT, 'content') + '/'); } finally { globalThis.fetch = realFetch; }
const { BASE_STATS, MAX_DODGE, SHIELD_WAIT, SHIELD_FILL, applyCard, bubbleShare, cardAmount, xpToNext, luckWeights, RARITY } = await game('src/stats.js');
const { ELEMENT_BASE, TREASURE_WORDS } = await game('src/words.js');
const { STAGE1 } = await game('src/stage1.js'), { STAGE2 } = await game('src/stage2.js'), { STAGE3 } = await game('src/stage3.js'), { STAGE4, ENCORE } = await game('src/stage4.js');
const KDL = await game('src/kdl.js');
export { CONTENT };

// ------------------------------------------------------------------ sources
const TEXT = {};
const read = (f) => (TEXT[f] ??= fs.readFileSync(path.join(ROOT, f), 'utf8'));
// file:line of the first line matching re; a moved number fails loudly rather than citing the wrong line
export function at(f, re) {
  const i = read(f).split('\n').findIndex((l) => re.test(l));
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
const knob = (A, k) => at(A.file, new RegExp(`^  ${k}:`));

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
  if (kind === 'poison') one += Math.min(ELEMENT_BASE.poison.poisonStacks, rate * ELEMENT_BASE.poison.poisonTime) * AD * PW * ELEMENT.poison;
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
  return (S.health + S.shield * refills + S.regen * A.seconds) / ((1 - Math.min(MAX_DODGE, S.dodge) / 100) * taken);
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
a Boss    = one bug (arcs and splashes need other bugs; Stun does nothing to a Boss)
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
  const curves = [['Today', xpToNext], [`Steady +${r(sA)}, same end`, step(sA)], [`Steady +${r(sB)}, 5 more`, step(sB)]];
  const perAct = curves.map(([label, cost]) => { let x = 0; const e = nights.map((N) => levelAt(x += N.xp, cost)); return [label, e.map((L, i) => L - (i ? e[i - 1] : 1))]; });
  const flags = [];
  if (gained[3] < gained[0] / 4) flags.push({ text: `Levels run out: ${gained.map((v) => r(v)).join(', ')} level-ups in acts 1 to 4. Each level costs ${r((LV.xp.growth - 1) * 100)}% more than the last, and each act's XP grows less than that.`,
    knob: { at: at('src/stats.js', /export const xpToNext/), change: `each level costs a steady ${r(sA)} XP more than the last, in place of x${LV.xp.growth}`, does: `level-ups per act become ${perAct[1][1].map((v) => r(v)).join(', ')}, ending at the same level` } });
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
      ['XP to level up: base, growth', `${LV.xp.base}, x${LV.xp.growth}`, at('content/levelups.kdl', /^xp /)],
      ['Spawning: rate, grow a second', `${CONTENT.waves.rate}, ${CONTENT.waves.grow}`, at('content/waves.kdl', /^\s+rate /)],
      ...ACTS.map((A) => [`Act ${A.n}: night, bugs, xpMult`, `${A.night} s, x${A.bugs}, x${A.xpMult}`, A.n === 1 ? at(A.file, /duration:/) : knob(A, 'xpMult')]),
      ...Object.values(CONTENT.enemies).filter((E) => E.xp > 0 && E.id !== 'hair').map((E) => [`${E.name}: XP, Health`, `${E.xp}, ${E.hp}`, kdl('content/enemies.kdl', 'enemy', E.id)]),
    ],
    model: `bugs out in a night = ∫ (rate + grow x t) x act bugs dt   (alive cap ignored: a ceiling)
each bug picked by weight among those already out (waves.kdl from=)
XP on offer = Σ bugs x round(XP x act xpMult)        (+ act 3's wasp nests)
level = XP in all through xpToNext(L) = round(${LV.xp.base} x ${LV.xp.growth}^(L-1)), as a fraction
real players clear ${RUN_LOG.cleared.map((c) => pct(c).slice(1)).join(', ')} of the bugs yet reach about the paper level: XP left on the floor is collected after the Boss.`,
    tables: [{ head: ['Act', 'Night', 'Bugs out', 'XP on offer', 'Paper level at the end', 'Real level', 'Level-ups in the act'], rows },
      { head: ['Curve', 'Act 1', 'Act 2', 'Act 3', 'Act 4'], rows: perAct.map(([l, v]) => [l, ...v.map((x) => r(x))]) },
      { head: ['XP Treasure', 'Copies', 'Levels over a run from act 1', 'From act 2'], rows: xpRows.map((x) => [x[1], x[2], r(x[3], 2), r(x[4], 2)]) }],
    charts: [grouped(`Level-ups in each act: today (x${LV.xp.growth} a level) and two steady steps (XP more per level)`, ['Act 1', 'Act 2', 'Act 3', 'Act 4'], perAct.map(([l, v]) => [l, v]), (v) => r(v)),
      bars('XP per 100 Health of bug (act in brackets)', bugRows.map(([l, v]) => [l, v]), { fmt: (v) => r(v) })],
    flags,
    notes: ['The Pedometer and the Magnet need distance swum and pickup reach from play; they are left to Wave B4.', 'A steady step is a change to xpToNext in src/stats.js, not a number in levelups.kdl.'],
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
      flags.push({ text: `At the ${door.name} a Common ${CARD_NAME[stat]} card is worth ${pct(cardWorth('normal', stat, 0, door))} of a Normal jelly's ${OFFENCE_CARDS.includes(stat) ? 'Offence' : 'Defence'}, ${r(k, 2)}x Fire rate's ${pct(yard(door))}.`,
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
export function linesOf(item, node) {
  const top = item.levels?.length > 1 ? item.levels.length : item.stack ?? 1;
  const kids = (lv) => (lv > 1 ? node.children.find((c) => c.name === 'level' && c.args[0] === lv)?.children ?? [] : node.children.filter((c) => c.name !== 'level'));
  const sum = (words) => Object.fromEntries(LINES.map((L) => [L.key, words.reduce((s, w) => { const f = L.words[w.name]; return f ? s + f(w, { ...TREASURE_WORDS[w.name]?.props, ...w.props }) : s; }, 0)]));
  const one = sum(kids(1)), levelled = item.levels?.length > 1;
  const all = levelled ? sum(kids(top)) : Object.fromEntries(Object.entries(one).map(([k, v]) => [k, v * top]));
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
    // the most one build holds: every Treasure at full stack, and the best one type's upgrades
    const tre = its.filter((x) => x.kind !== 'upgrade').reduce((s, x) => s + x.all, 0);
    const byType = {};
    for (const x of its.filter((y) => y.kind === 'upgrade')) byType[x.jelly] = (byType[x.jelly] || 0) + x.all;
    const up = Math.max(0, ...Object.values(byType));
    return { line, its, max: tre + up };
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
  const product = lineRows.reduce((p, L) => p * (1 + L.max), 1);
  return {
    id: 'A4', title: 'The multiplier lines',
    lede: 'Bonuses on one line add; lines multiply. Which line each damage bonus joins, and how far each can reach.',
    numbers: items.map((x) => [`${x.name} (${x.rarity}) → ${LINES.find((L) => L.key === x.line).name}`, `${pct(x.one)}${x.top > 1 ? `, ${pct(x.all)} at ${x.top}` : ''}${x.grows ? ', grows' : ''}`, x.at]),
    model: `Offence = Attack damage line x Fire rate line x (1 + Crit chance x (mult - 1)) x (1 + mark) x (1 + status bonus) x (1 + conditional) x (1 + Elite damage)
           + gadgets (Attack damage x ${GADGET_POWER} x their multiple) + damage over time
Attack damage line counts in shares of Normal's ${BASE_STATS.bubbleDamage} (Lemon Slice's +2 = +33%)
A conditional counts as if it always holds, a mark as if it is always on, a status bonus as if the bug always has it (Poison at ${ELEMENT_BASE.poison.poisonStacks} stacks):
the paper ceiling, not a typical run. Growing items (per, grow-on-kills, bounty) are priced in Wave B4.`,
    tables: [{ head: ['Line', 'Items', 'One type\'s most', 'x at most'], rows: lineRows.map(({ line, its, max }) => [line.name, its.length, pct(max), `x${r(1 + max, 2)}`]) }],
    charts: [bars('Most each line reaches in one build (x)', lineRows.map(({ line, max }) => [line.name, 1 + max]), { fmt: (v) => 'x' + r(v, 2), ref: 1 })],
    flags,
    notes: [`Every line at its most multiplies to x${r(product)} on paper. A typical build needs the run log's pickups by act (the run log additions) to price.`],
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
  const thimble = read('content/treasures.kdl').match(/hit-less ([\d.]+)/)[1];
  const potC = pot('careful'), potB = pot('brawler');
  if (potB > 0.7 * DEF0) flags.push({ text: `On paper Pot Lid gives ${r(potC)} Health over the Vacuum act to a careful player and ${r(potB)} to a brawler, far past a Legendary's 70 points (${r(0.7 * DEF0)} Health). The catch the sum can't see: at 1 Health, the first hit while the Shield is down ends the run.`,
    knob: { at: kdl('content/treasures.kdl', 'treasure', 'potLid'), change: 'health-to-shield keeps 5 Health, not 1 (a keep= on the word)', does: 'one stray hit is no longer the end, and the paper number stops hiding the risk' } });
  const fade = typical.map((t) => 1 / t);
  if (fade[3] < fade[0] / 2.5) flags.push({ text: `The Thimble takes ${thimble} off each hit: ${pct(Math.min(1, +thimble / typical[0])).slice(1)} of a typical act 1 hit, ${pct(+thimble / typical[3]).slice(1)} of an act 4 one.`,
    knob: { at: kdl('content/treasures.kdl', 'treasure', 'thimble'), change: 'hit-less 1 → a share of each hit (a new word, hit-share)', does: 'keeps its worth in every act' } });
  // evolution costs in Health: a negative percent of starting Health
  const evo = CONTENT.evolutions.map((e) => { const node = KDL.parse(read('content/evolutions.kdl'), 'e').find((n) => n.args[0] === e.id); const w = node.children.find((c) => c.name === 'stat' && c.args[0] === 'health' && c.args[1] < 0); return w ? [e, w.props.percent ? BASE_STATS.health * w.args[1] / 100 : w.args[1], w] : null; }).filter(Boolean);
  const felt = 0.2 * DEF0;   // a cost worth at least 20 Defence points
  for (const [e, hp, w] of evo) if (-hp < felt) flags.push({ text: `${e.name} costs ${r(-hp)} max Health${w.props.percent ? ` (${-w.args[1]}% of a starting ${BASE_STATS.health})` : ''}, less than ${LV.cards.health.amounts[1]} from one Rare Health card.`,
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
    tables: [{ head: ['Item', 'Health over the Vacuum act, careful', 'Brawler'], rows: [...priced.map(([n, c, b]) => [`Common ${n} card`, r(c), r(b)]), ['Pot Lid', r(potC), r(potB)], ['Snooze Button (once a run)', r(snooze * S0.health), r(snooze * S0.health)]] },
      { head: ['Act', 'Reference jelly can spend, careful', 'Brawler', 'Real Health lost'], rows: supply.map(([n, c, b, d]) => [n, r(c), r(b), d]) },
      { head: ['Act', 'Typical bug hit (with power)', 'Thimble takes off'], rows: typical.map((t, i) => [i + 1, r(t, 2), pct(Math.min(1, +thimble / t)).slice(1)]) }],
    charts: [bars('Health a Common card gives over the Vacuum act (careful)', priced.map(([n, c]) => [n, c]), { fmt: (v) => r(v) }),
      grouped('Health to spend in each act against Health lost', ['Act 1', 'Act 2', 'Act 3', 'Act 4'], [['Careful', supply.map((s) => s[1])], ['Brawler', supply.map((s) => s[2])], ['Lost (real)', supply.map((s) => s[3])]], (v) => r(v))],
    flags,
    notes: ['Heals from Treasures (Baby Bottle, Whale, Bloody Fangs, Meatball) need kills, jumps and hits from play: Wave B4 prices them with the run log.'],
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
export const buildSheets = () => [sheetS0(), sheetA1(), sheetA2(), sheetA3(), sheetA4(), sheetA5()];
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
