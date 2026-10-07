// Loads the game's content: plain-text files in content/ that say what things are, read
// before the game starts (boot.js). A mistake in a file stops loading with a message naming
// the file, the line and what's wrong, instead of a game that half works.
//
//   content/enemies.kdl   the bugs: numbers + behaviour words (src/words.js)
//   content/waves.kdl     how the night fills with them
//   content/look.css      colours and render numbers (src/look.js)
import { parse } from './kdl.js';
import { ENEMY_WORDS, TREASURE_WORDS, makeWord, newMods } from './words.js';

export const CONTENT = { enemies: {}, waves: null, treasures: [] };

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

// The combined effects of the treasures you own (ids): what the systems read
export function compileMods(ids) {
  const m = newMods();
  for (const t of CONTENT.treasures) {
    const n = ids.count ? ids.count(t.id) : ids.has(t.id) ? 1 : 0;
    if (!n) continue;
    if (t.levels.length > 1) { for (const fx of t.levels[Math.min(n, t.levels.length) - 1]) fx(m, 0); continue; }   // a levelled treasure: its level's words, once
    for (let copy = 0; copy < n; copy++) for (const fx of t.effects) fx(m, copy);   // stackable treasures apply once per copy
  }
  return m;
}

export async function loadContent(base = './content/') {
  const read = async (f) => { const r = await fetch(base + f); if (!r.ok) throw new Error(`content/${f}: couldn't load (${r.status})`); return r.text(); };
  const [enemies, waves, treasures] = await Promise.all([read('enemies.kdl'), read('waves.kdl'), read('treasures.kdl')]);
  CONTENT.enemies = compileEnemies(parse(enemies, 'content/enemies.kdl'));
  CONTENT.waves = compileWaves(parse(waves, 'content/waves.kdl'), CONTENT.enemies);
  CONTENT.treasures = compileTreasures(parse(treasures, 'content/treasures.kdl'));
  return CONTENT;
}
