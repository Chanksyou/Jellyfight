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

// enemy "id" name="…" hp= r= dmg= dew= model="…" { words… }
export function compileEnemies(nodes, file = 'content/enemies.kdl') {
  const out = {};
  for (const n of nodes) {
    const where = `${file}:${n.line}`;
    if (n.name !== 'enemy') throw new Error(`${where}: expected "enemy", got "${n.name}"`);
    const id = n.args[0];
    if (typeof id !== 'string') throw new Error(`${where}: enemy needs an id, like enemy "roach"`);
    need(n, ['hp', 'r', 'dmg', 'dew'], where);
    const words = n.children.map((w) => makeWord(ENEMY_WORDS, w, `${file}:${w.line}`));
    if (!words.some((w) => w.ground || w.fly)) throw new Error(`${where}: "${id}" has no way to move (give it chase, hover or drift)`);
    out[id] = {
      id, name: n.props.name || id, hp: n.props.hp, r: n.props.r, dmg: n.props.dmg, dew: n.props.dew, model: n.props.model || id,
      words,
      fly: words.some((w) => w.fly),
      rolls: words.some((w) => w.rolls),
      slows: words.some((w) => w.slows),
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
const TIERS = ['common', 'rare', 'epic', 'legendary'];   // the ids of TREASURE_RARITY (stats.js)
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
    if (!n.children.length) throw new Error(`${where}: "${id}" does nothing (give it effect words)`);
    out.push({
      id, name: n.props.name, icon: n.props.icon, text: n.props.text, attack: !!n.props.attack, stack: n.props.stack ?? 1, rarity: n.props.rarity ?? 'common',
      effects: n.children.map((w) => makeWord(TREASURE_WORDS, w, `${file}:${w.line}`)),
      vocabulary: n.children.map((w) => w.name),
    });
  }
  return out;
}

// The combined effects of the treasures you own (ids): what the systems read
export function compileMods(ids) {
  const m = newMods();
  for (const t of CONTENT.treasures) {
    const n = ids.count ? ids.count(t.id) : ids.has(t.id) ? 1 : 0;   // stackable treasures apply once per copy
    for (let copy = 0; copy < n; copy++) for (const fx of t.effects) fx(m, copy);
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
