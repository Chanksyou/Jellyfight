// Loads the game's content: plain-text files in content/ that say what things are, read
// before the game starts (boot.js). A mistake in a file stops loading with a message naming
// the file, the line and what's wrong, instead of a game that half works.
//
//   content/enemies.kdl   the bugs: numbers + behaviour words (src/words.js)
//   content/waves.kdl     how the night fills with them
//   content/treasures.kdl the treasures (effect words: src/words.js)
//   content/evolutions.kdl what the jelly can become after an act's boss (the same effect words)
//   content/bosses.kdl    the bosses: Health and every attack's numbers (src/vacuum.js, src/clog.js, src/shark.js, src/encore.js)
//   content/elites.kdl    the elites: Health, aggro and every attack's numbers (src/elites.js)
//   content/levelups.kdl  level-ups: the XP curve, card rarities and card amounts (src/stats.js)
//   content/look.css      colours and render numbers (src/look.js)
import { parse } from './kdl.js';
import { ENEMY_WORDS, TREASURE_WORDS, makeWord, newMods } from './words.js';

export const CONTENT = { enemies: {}, waves: null, treasures: [], evolutions: [], bosses: {}, elites: {}, levelups: null, nodes: null };

// Dev-editor removals (src/balance-editor.js): keys like 'elite:mug' and 'card:health'.
// Session-only, never written to the files: a removed elite doesn't spawn (run.js) and a
// removed card isn't offered (stats.js rollCards), until it's restored or the page reloads.
export const REMOVED = new Set();
export const isRemoved = (kind, id) => REMOVED.has(`${kind}:${id}`);

const need = (node, keys, where) => { for (const k of keys) if (typeof node.props[k] !== 'number') throw new Error(`${where}: "${node.args[0]}" needs a number for ${k}=`); };

// enemy "id" name="…" hp= r= dmg= xp= model="…" { words… }
export function compileEnemies(nodes, file = 'content/enemies.kdl') {
  const out = {};
  for (const n of nodes) {
    const where = `${file}:${n.line}`;
    if (n.name !== 'enemy') throw new Error(`${where}: expected "enemy", got "${n.name}"`);
    const id = n.args[0];
    if (typeof id !== 'string') throw new Error(`${where}: enemy needs an id, like enemy "roach"`);
    need(n, ['hp', 'r', 'dmg', 'xp'], where);
    const words = n.children.map((w) => makeWord(ENEMY_WORDS, w, `${file}:${w.line}`));
    if (!words.some((w) => w.ground || w.fly)) throw new Error(`${where}: "${id}" has no way to move (give it chase, hover or sortie)`);
    out[id] = {
      id, name: n.props.name || id, hp: n.props.hp, r: n.props.r, dmg: n.props.dmg, xp: n.props.xp, model: n.props.model || id,
      words,
      fly: words.some((w) => w.fly),
      rolls: words.some((w) => w.rolls),
      rooted: words.some((w) => w.rooted),   // never moved by anything (rooted, hangs)
      rollDmg: words.find((w) => w.rollDmg != null)?.rollDmg ?? null,
      vocabulary: n.children.map((w) => w.name),
    };
  }
  return out;
}

// spawning { rate … cap … toughen … }  and  bug "id" weight= from= act=
export function compileWaves(nodes, enemies, file = 'content/waves.kdl') {
  const w = { rate: 0.22, grow: 0, cap: 6, capEvery: 15, capMax: 20, toughen: 0, bugs: [] };
  for (const n of nodes) {
    const where = `${file}:${n.line}`;
    if (n.name === 'spawning') {
      for (const s of n.children) {
        if (s.name === 'rate') { w.rate = s.args[0]; w.grow = s.props.grow ?? 0; }
        else if (s.name === 'cap') { w.cap = s.args[0]; w.capEvery = s.props.every ?? Infinity; w.capMax = s.props.max ?? w.cap; }
        else if (s.name === 'toughen') w.toughen = s.args[0];
        else throw new Error(`${file}:${s.line}: unknown spawning setting "${s.name}" (rate, cap, toughen)`);
      }
    } else if (n.name === 'bug') {
      const id = n.args[0];
      if (!enemies[id]) throw new Error(`${where}: no enemy called "${id}" in content/enemies.kdl`);
      w.bugs.push({ id, weight: n.props.weight ?? 1, from: n.props.from ?? 0, act: n.props.act ?? 1 });
    } else throw new Error(`${where}: expected "spawning" or "bug", got "${n.name}"`);
  }
  if (!w.bugs.length) throw new Error(`${file}: no bugs listed`);
  return w;
}

// treasure "id" name="…" icon="…" text="…" rarity="…" attack=#true stack=N { effect words… }
//   or with levels instead of stack=:  { words…  level 2 text="…" { words… }  level 3 text="…" { words… } }
const TIERS = ['common', 'rare', 'epic', 'legendary'];   // the ids of TREASURE_RARITY (stats.js)
const STACK_DEFAULT = 3, STACK_MAX = 5;
export function compileTreasures(nodes, file = 'content/treasures.kdl') {
  const out = [], seen = new Set();
  for (const n of nodes) {
    const where = `${file}:${n.line}`;
    if (n.name !== 'treasure') throw new Error(`${where}: expected "treasure", got "${n.name}"`);
    const id = n.args[0];
    if (typeof id !== 'string') throw new Error(`${where}: treasure needs an id, like treasure "bobbyPin"`);
    if (seen.has(id)) throw new Error(`${where}: there are two treasures called "${id}"`);
    seen.add(id);
    for (const k of ['name', 'icon', 'text']) if (typeof n.props[k] !== 'string') throw new Error(`${where}: "${id}" needs ${k}="…"`);
    if (n.props.stack !== undefined && !(Number.isInteger(n.props.stack) && n.props.stack >= 1)) throw new Error(`${where}: "${id}" stack= must be a whole number, 1 or more`);
    if (n.props.rarity !== undefined && !TIERS.includes(n.props.rarity)) throw new Error(`${where}: "${id}" rarity= must be one of ${TIERS.join(', ')}, not "${n.props.rarity}"`);
    // `level 2 text="…" { words }`, `level 3 …`: the treasure levels up when you take it again,
    // and each level is its whole word list (replacing the one before)
    const base = n.children.filter((w) => w.name !== 'level'), lv = n.children.filter((w) => w.name === 'level');
    if (!base.length) throw new Error(`${where}: "${id}" does nothing (give it effect words)`);
    lv.forEach((L, i) => {
      const at = `${file}:${L.line}`;
      if (L.args[0] !== i + 2) throw new Error(`${at}: "${id}" levels go in order: expected level ${i + 2}, got level ${L.args[0]}`);
      if (typeof L.props.text !== 'string') throw new Error(`${at}: "${id}" level ${i + 2} needs text="…" (what it adds, for the pick card)`);
      if (!L.children.length) throw new Error(`${at}: "${id}" level ${i + 2} does nothing (give it effect words)`);
    });
    if (lv.length && n.props.stack !== undefined) throw new Error(`${where}: "${id}" has levels, so it doesn't take stack= (its levels are its copies)`);
    const rarity = n.props.rarity ?? 'common', vocabulary = [...base, ...lv.flatMap((L) => L.children)].map((w) => w.name);
    // Stacking: a treasure without levels stacks (STACK_DEFAULT copies unless stack= says), up to
    // STACK_MAX; Legendary treasures, the elements and their upgrades are one of a kind
    const unique = rarity === 'legendary' || vocabulary.includes('element') || vocabulary.includes('element-up');
    if (n.props.stack > STACK_MAX) throw new Error(`${where}: "${id}" stack=${n.props.stack} is too many (at most ${STACK_MAX})`);
    if (unique && n.props.stack > 1) throw new Error(`${where}: "${id}" is ${rarity === 'legendary' ? 'Legendary' : 'an element or its upgrade'}, so it's one of a kind (no stack=)`);
    const words = (list) => list.map((w) => makeWord(TREASURE_WORDS, w, `${file}:${w.line}`));
    const levels = [words(base), ...lv.map((L) => words(L.children))];
    if (vocabulary.includes('element') && rarity !== 'legendary') throw new Error(`${where}: "${id}" is an element, so it's rarity="legendary"`);
    out.push({
      needs: n.props.needs ?? null,   // offered only once you own this treasure (an element's upgrades: its base)
      id, name: n.props.name, icon: n.props.icon, text: n.props.text, attack: !!n.props.attack, stack: lv.length ? lv.length + 1 : unique ? 1 : n.props.stack ?? STACK_DEFAULT, rarity,
      effects: levels[0], levels, levelText: [n.props.text, ...lv.map((L) => L.props.text)],
      vocabulary,
    });
  }
  for (const t of out) if (t.needs && !seen.has(t.needs)) throw new Error(`${file}: "${t.id}" needs="${t.needs}", but there is no treasure called that`);
  return out;
}

// evolution "id" name="…" icon="…" text="…" { effect words… }: one is picked after each act's boss
// (Run.metamorph) and kept for the rest of the run. The same words as treasures; one of a kind.
export function compileEvolutions(nodes, file = 'content/evolutions.kdl') {
  for (const n of nodes) if (n.name !== 'evolution') throw new Error(`${file}:${n.line}: expected "evolution", got "${n.name}"`);
  const asTreasures = nodes.map((n) => ({ ...n, name: 'treasure', props: { ...n.props, rarity: 'legendary' } }));
  return compileTreasures(asTreasures, file).map((t) => ({ ...t, evolution: true }));
}

// boss "id" name="…" icon="…" hp= contact= { skill key=number … }: the boss fights' numbers. A skill
// block is just named numbers (no words, no args); the boss classes read the ones they know,
// fresh from the compiled object each attack, so the balance editor's edits land mid-fight.
export function compileBosses(nodes, file = 'content/bosses.kdl') {
  const out = {};
  for (const n of nodes) {
    const where = `${file}:${n.line}`;
    if (n.name !== 'boss') throw new Error(`${where}: expected "boss", got "${n.name}"`);
    const id = n.args[0];
    if (typeof id !== 'string') throw new Error(`${where}: boss needs an id, like boss "vacuum"`);
    if (out[id]) throw new Error(`${where}: there are two bosses called "${id}"`);
    need(n, ['hp', 'contact'], where);
    if (typeof n.props.icon !== 'string') throw new Error(`${where}: "${id}" needs icon="…" (its Treasure book picture)`);
    const skills = {};
    for (const s of n.children) {
      if (skills[s.name]) throw new Error(`${file}:${s.line}: "${id}" has two "${s.name}" blocks`);
      if (s.args.length || s.children.length) throw new Error(`${file}:${s.line}: "${id}" ${s.name} takes only key=number settings`);
      for (const [k, v] of Object.entries(s.props)) if (typeof v !== 'number') throw new Error(`${file}:${s.line}: "${id}" ${s.name} ${k}= must be a number`);
      skills[s.name] = { ...s.props };
    }
    out[id] = { id, name: n.props.name || id, icon: n.props.icon, hp: n.props.hp, contact: n.props.contact, skills };
  }
  return out;
}

const needProps = (node, keys, where, label) => { for (const k of keys) if (typeof node.props[k] !== 'number') throw new Error(`${where}: ${label} needs a number for ${k}=`); };

// pace recover= tempo=  and  elite "id" name="…" icon="…" hp= aggro= angry= { skill key=number … }:
// the elites' numbers, in the bosses' shape. The models, radii and phase timings stay in
// elites.js (KINDS there keeps name/build/scale); a fighting elite holds its compiled
// object (this.def) and the update loop reads it fresh, so editor edits land mid-fight.
const ELITE_KINDS = ['controller', 'mug', 'kettle', 'soap', 'clock', 'whipper', 'croc', 'bull', 'coffer'];
export function compileElites(nodes, file = 'content/elites.kdl') {
  const out = { pace: null };
  for (const n of nodes) {
    const where = `${file}:${n.line}`;
    if (n.name === 'pace') {
      if (out.pace) throw new Error(`${where}: two pace blocks`);
      needProps(n, ['recover', 'tempo'], where, 'pace');
      out.pace = { recover: n.props.recover, tempo: n.props.tempo };
      continue;
    }
    if (n.name !== 'elite') throw new Error(`${where}: expected "elite" or "pace", got "${n.name}"`);
    const id = n.args[0];
    if (!ELITE_KINDS.includes(id)) throw new Error(`${where}: no elite called "${id}" (the kinds are ${ELITE_KINDS.join(', ')})`);
    if (out[id]) throw new Error(`${where}: there are two elites called "${id}"`);
    need(n, ['hp', 'aggro'], where);
    if (typeof n.props.icon !== 'string') throw new Error(`${where}: "${id}" needs icon="…" (its Treasure book picture)`);
    if (n.props.angry !== undefined && typeof n.props.angry !== 'number') throw new Error(`${where}: "${id}" angry= must be a number`);
    const skills = {};
    for (const s of n.children) {
      if (skills[s.name]) throw new Error(`${file}:${s.line}: "${id}" has two "${s.name}" blocks`);
      if (s.args.length || s.children.length) throw new Error(`${file}:${s.line}: "${id}" ${s.name} takes only key=number settings`);
      for (const [k, v] of Object.entries(s.props)) if (typeof v !== 'number') throw new Error(`${file}:${s.line}: "${id}" ${s.name} ${k}= must be a number`);
      skills[s.name] = { ...s.props };
    }
    out[id] = { id, name: n.props.name || id, icon: n.props.icon, hp: n.props.hp, aggro: n.props.aggro, angry: n.props.angry ?? null, skills };
  }
  if (!out.pace) throw new Error(`${file}: no pace block (recover= and tempo= for every elite)`);
  for (const k of ELITE_KINDS) if (!out[k]) throw new Error(`${file}: no elite called "${k}"`);
  return out;
}

// xp base= growth=, rarities common= rare= epic=, card "stat" common= rare= epic= weight=:
// what a level-up offers. How an amount applies (percent of base, per second, points) stays
// with the stat in stats.js; this file is only the numbers.
const CARD_STATS = ['bubbles', 'range', 'bubbleDamage', 'fireRate', 'health', 'moveSpeed', 'regen', 'dodge', 'luck', 'bubbleSize'];
export function compileLevelups(nodes, file = 'content/levelups.kdl') {
  const out = { xp: null, rarities: null, cards: {} };
  for (const n of nodes) {
    const where = `${file}:${n.line}`;
    if (n.name === 'xp') {
      if (out.xp) throw new Error(`${where}: two xp blocks`);
      needProps(n, ['base', 'growth'], where, 'xp');
      out.xp = { base: n.props.base, growth: n.props.growth };
    } else if (n.name === 'rarities') {
      if (out.rarities) throw new Error(`${where}: two rarities blocks`);
      needProps(n, ['common', 'rare', 'epic'], where, 'rarities');
      out.rarities = { common: n.props.common, rare: n.props.rare, epic: n.props.epic };
    } else if (n.name === 'card') {
      const id = n.args[0];
      if (!CARD_STATS.includes(id)) throw new Error(`${where}: no level-up card called "${id}" (the cards are ${CARD_STATS.join(', ')})`);
      if (out.cards[id]) throw new Error(`${where}: there are two cards called "${id}"`);
      need(n, ['common', 'rare', 'epic'], where);
      if (n.props.weight !== undefined && typeof n.props.weight !== 'number') throw new Error(`${where}: "${id}" weight= must be a number`);
      out.cards[id] = { amounts: [n.props.common, n.props.rare, n.props.epic], weight: n.props.weight ?? 1 };
    } else throw new Error(`${where}: expected "xp", "rarities" or "card", got "${n.name}"`);
  }
  if (!out.xp) throw new Error(`${file}: no xp block (base= and growth=)`);
  if (!out.rarities) throw new Error(`${file}: no rarities block (common= rare= epic=)`);
  for (const s of CARD_STATS) if (!out.cards[s]) throw new Error(`${file}: no card called "${s}"`);
  return out;
}

// The combined effects of the treasures you own (ids) and the evolutions you've taken: what the
// systems read
export function compileMods(ids, evolved = []) {
  const m = newMods();
  for (const e of CONTENT.evolutions) if (evolved.includes(e.id)) owned(m, e.id, () => { for (const fx of e.effects) fx(m, 0); });
  for (const t of CONTENT.treasures) {
    const n = ids.count ? ids.count(t.id) : ids.has(t.id) ? 1 : 0;
    if (!n) continue;
    owned(m, t.id, () => {
      if (t.levels.length > 1) { for (const fx of t.levels[Math.min(n, t.levels.length) - 1]) fx(m, 0); return; }   // a levelled treasure: its level's words, once
      for (let copy = 0; copy < n; copy++) for (const fx of t.effects) fx(m, copy);   // stackable treasures apply once per copy
    });
  }
  return m;
}

// Notes which treasure (or evolution) each timer it adds belongs to, so the HUD can show that
// treasure's countdown (Run.cooldowns) and the pause menu its growth (treasure-bag.js): what it adds
// to the timed, when-hit, squeak, growth and per lists, and the one-off effects it sets. Only for showing: the systems still read the combined effects.
const SINGLES = ['mouse', 'reflect', 'deathSave', 'rebirth', 'energyShield', 'decoy'];
function owned(m, id, apply) {
  const lists = [m.timed, m.onHurt, m.squeaks, m.growth, m.per], at = lists.map((l) => l.length), had = SINGLES.map((k) => m[k]);
  apply();
  lists.forEach((list, i) => { for (const x of list.slice(at[i])) x.owner = id; });
  SINGLES.forEach((k, i) => { if (m[k] !== had[i]) m.owners[k] = id; });
}

export async function loadContent(base = './content/') {
  const read = async (f) => { const r = await fetch(base + f); if (!r.ok) throw new Error(`content/${f}: couldn't load (${r.status})`); return r.text(); };
  const [enemies, waves, treasures, evolutions, bosses, elites, levelups] = await Promise.all([read('enemies.kdl'), read('waves.kdl'), read('treasures.kdl'), read('evolutions.kdl'), read('bosses.kdl'), read('elites.kdl'), read('levelups.kdl')]);
  // The parsed files are kept (CONTENT.nodes): the dev balance editor edits their numbers and
  // recompiles from them, without reloading the page.
  CONTENT.nodes = { enemies: parse(enemies, 'content/enemies.kdl'), treasures: parse(treasures, 'content/treasures.kdl'), evolutions: parse(evolutions, 'content/evolutions.kdl'), bosses: parse(bosses, 'content/bosses.kdl'), elites: parse(elites, 'content/elites.kdl'), levelups: parse(levelups, 'content/levelups.kdl') };
  CONTENT.enemies = compileEnemies(CONTENT.nodes.enemies);
  CONTENT.waves = compileWaves(parse(waves, 'content/waves.kdl'), CONTENT.enemies);
  CONTENT.treasures = compileTreasures(CONTENT.nodes.treasures);
  CONTENT.evolutions = compileEvolutions(CONTENT.nodes.evolutions);
  CONTENT.bosses = compileBosses(CONTENT.nodes.bosses);
  CONTENT.elites = compileElites(CONTENT.nodes.elites);
  CONTENT.levelups = compileLevelups(CONTENT.nodes.levelups);
  return CONTENT;
}

// Rebuild the compiled content from the parsed files (CONTENT.nodes), in place, so the
// references the game already holds (stats.js's TREASURES, enemies.js's TYPES) see the new
// numbers: the next bug spawns with them and the run's combined effects pick them up on the
// next recompute. Everything compiles before anything is swapped in, so a bad number (the
// compiler names the file and line) changes nothing.
export function recompileContent() {
  const enemies = compileEnemies(CONTENT.nodes.enemies);
  const treasures = compileTreasures(CONTENT.nodes.treasures);
  const evolutions = compileEvolutions(CONTENT.nodes.evolutions);
  const bosses = compileBosses(CONTENT.nodes.bosses);
  const elites = compileElites(CONTENT.nodes.elites);
  const levelups = compileLevelups(CONTENT.nodes.levelups);
  for (const id of Object.keys(CONTENT.enemies)) if (!enemies[id]) delete CONTENT.enemies[id];
  Object.assign(CONTENT.enemies, enemies);
  CONTENT.treasures.forEach((t, i) => Object.assign(t, treasures[i]));
  CONTENT.evolutions.forEach((t, i) => Object.assign(t, evolutions[i]));
  // bosses swap in place, skill by skill: a boss already fighting holds its compiled object
  // (vacuum.js's this.def) and reads it fresh each attack, so identity is the whole point
  for (const id of Object.keys(CONTENT.bosses)) if (!bosses[id]) delete CONTENT.bosses[id];
  for (const [id, b] of Object.entries(bosses)) {
    const cur = CONTENT.bosses[id] || (CONTENT.bosses[id] = { skills: {} });
    cur.id = b.id; cur.name = b.name; cur.hp = b.hp; cur.contact = b.contact;
    for (const s of Object.keys(cur.skills)) if (!b.skills[s]) delete cur.skills[s];
    for (const [s, vals] of Object.entries(b.skills)) Object.assign(cur.skills[s] || (cur.skills[s] = {}), vals);
  }
  // elites swap the same way: a fighting elite holds its object (elites.js's this.def)
  Object.assign(CONTENT.elites.pace || (CONTENT.elites.pace = {}), elites.pace);
  for (const [id, d] of Object.entries(elites)) {
    if (id === 'pace') continue;
    const cur = CONTENT.elites[id] || (CONTENT.elites[id] = { skills: {} });
    cur.id = d.id; cur.name = d.name; cur.hp = d.hp; cur.aggro = d.aggro; cur.angry = d.angry;
    for (const s of Object.keys(cur.skills)) if (!d.skills[s]) delete cur.skills[s];
    for (const [s, vals] of Object.entries(d.skills)) Object.assign(cur.skills[s] || (cur.skills[s] = {}), vals);
  }
  // level-ups: stats.js reads the values fresh on every roll, so swapping the numbers is all
  Object.assign(CONTENT.levelups.xp, levelups.xp);
  Object.assign(CONTENT.levelups.rarities, levelups.rarities);
  for (const [id, c] of Object.entries(levelups.cards)) {
    const cur = CONTENT.levelups.cards[id] || (CONTENT.levelups.cards[id] = {});
    cur.amounts = [...c.amounts]; cur.weight = c.weight;
  }
}
