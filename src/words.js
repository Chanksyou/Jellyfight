// The game's vocabulary: every behaviour word the content files (content/*.kdl) can use,
// each defined exactly once. A word has a one-line `doc`, its positional `args`, its named
// `props` (with defaults), and `make`, which returns what the word does.
//
// Enemy words run every frame for every bug that uses them, in the order the bug lists them.
// A word's tick gets the bug `e`, the frame `c` and the Enemies system `en`:
//   c.dt, c.t           frame time, seconds into the night
//   c.pc                the jelly's middle (Vector3)
//   c.toP, c.dist       from the bug to the jelly, and how far
//   c.flatDir, c.flat   the same, flat on the floor (unit vector, meters)
//   c.slow              1 normally, 0.55 slowed, 0 frozen or stunned
//   c.speed, c.dir      ground bugs: set these and the bug walks that way (collision included)
// Flying words move the bug themselves and set `fly`.
//
// To teach the game a new behaviour: add a word here (small, one job), use it in a .kdl file,
// and add a story (src/stories.js) that proves it.
import * as THREE from 'three';

const _away = new THREE.Vector3(), _spot = new THREE.Vector3(), _want = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export const ENEMY_WORDS = {
  chase: {
    doc: 'Walks straight at you at `speed` m/s.',
    args: ['speed'],
    make: ([speed]) => ({
      ground: true,
      tick(e, c) { c.dir.copy(c.flatDir); c.speed = speed * c.slow; },
    }),
  },

  'curl-dash': {
    doc: 'Up close, stops and winds up for `windup` s, dashes at `speed` m/s for `time` s (hitting for `dmg`), then rests for `rest` s. List it after the walking word.',
    props: { windup: 0.45, time: 0.45, speed: 0.825, rest: 0.6, dmg: null, range: 0.2 },
    make: (_, p) => ({
      rollDmg: p.dmg,
      tick(e, c) {
        e.stateT -= c.dt;
        if (e.state === 'approach' && c.flat < p.range && e.grounded) { e.state = 'windup'; e.stateT = p.windup; }
        else if (e.state === 'windup') {
          c.speed = 0;
          if (e.stateT <= 0) { e.state = 'dash'; e.stateT = p.time; e.dashDir.copy(c.flatDir); }
        } else if (e.state === 'dash') {
          c.speed = p.speed * c.slow;
          c.dir.copy(e.dashDir);
          if (e.stateT <= 0) { e.state = 'rest'; e.stateT = p.rest; }
        } else if (e.state === 'rest') {
          c.speed *= 0.3;
          if (e.stateT <= 0) e.state = 'approach';
        }
      },
    }),
  },

  hover: {
    doc: 'Flies `distance` m from you and `above` m higher, circling slowly, at up to `speed` m/s.',
    args: ['distance'],
    props: { above: 0.07, speed: 0.33, circle: 0.4 },
    make: ([distance], p) => ({
      fly: true,
      tick(e, c) {
        const away = _away.copy(e.pos).sub(c.pc).setY(0);
        if (away.lengthSq() < 1e-6) away.set(1, 0, 0);
        away.normalize().applyAxisAngle(UP, c.dt * p.circle);
        const to = _spot.copy(c.pc).addScaledVector(away, distance).setY(c.pc.y + p.above).sub(e.pos);
        const s = p.speed * c.slow;
        e.vel.lerp(to.clampLength(0, 1).multiplyScalar(s * 6).clampLength(0, s), 1 - Math.exp(-3 * c.dt));
        e.pos.addScaledVector(e.vel, c.dt);
      },
    }),
  },

  drift: {
    doc: 'Flies at your middle at `speed` m/s with a lazy wobble.',
    args: ['speed'],
    make: ([speed]) => ({
      fly: true,
      tick(e, c) {
        const s = speed * c.slow, d = _away.copy(c.toP).normalize();
        const wob = Math.sin(c.t * 3 + e.phase) * 0.35;
        e.vel.lerp(_want.set(d.x + wob * d.z, d.y + Math.sin(c.t * 2 + e.phase) * 0.3, d.z - wob * d.x).multiplyScalar(s), 1 - Math.exp(-3 * c.dt));
        e.pos.addScaledVector(e.vel, c.dt);
      },
    }),
  },

  spit: {
    doc: 'Every `every` s, if you are within `reach` m, spits a shot at you (`speed` m/s, lasts `life` s, `dmg` damage), dipping to aim for `aim` s first.',
    props: { every: 2.4, reach: 0.45, speed: 0.48, life: 1.47, dmg: 1, aim: 0.35 },
    make: (_, p) => ({
      init(e) { e.shootT = 1 + Math.random() * 1.5; e.aimT = 0; },
      tick(e, c, en) {
        e.shootT -= c.dt * (c.slow > 0 ? 1 : 0);
        e.aimT = Math.max(0, e.aimT - c.dt);
        if (e.shootT <= p.aim && e.aimT <= 0 && e.shootT > 0) e.aimT = p.aim;
        if (e.shootT <= 0 && c.dist < p.reach) { e.shootT = p.every; en.spit(e, c.pc, p.speed, p.life, p.dmg); }
        else if (e.shootT <= 0) e.shootT = 0.5;
      },
    }),
  },

  rolls: {
    doc: 'Its body rolls along the floor as it moves (no animation of its own).',
    make: () => ({ rolls: true }),
  },

  'slows-on-touch': {
    doc: 'Touching it slows you down for a moment (sticky lint).',
    make: () => ({ slows: true }),
  },
};

// Check one word use from a content file and build it. Throws a message that names the file
// and line, so a typo in a .kdl file says exactly what's wrong.
export function makeWord(registry, node, where) {
  const def = registry[node.name];
  if (!def) throw new Error(`${where}: unknown word "${node.name}". Known words: ${Object.keys(registry).join(', ')}`);
  const want = def.args || [];
  if (node.args.length !== want.length) throw new Error(`${where}: "${node.name}" takes ${want.length ? want.join(', ') : 'no arguments'}, got ${node.args.length}`);
  for (const k of Object.keys(node.props)) if (!(def.props && k in def.props)) throw new Error(`${where}: "${node.name}" has no setting "${k}"${def.props ? ` (it has: ${Object.keys(def.props).join(', ')})` : ''}`);
  // a block word (every N { … }) builds its children from its own little vocabulary
  if (def.block && !node.children.length) throw new Error(`${where}: "${node.name}" needs a { block } of effects (${Object.keys(def.block).join(', ')})`);
  if (!def.block && node.children.length) throw new Error(`${where}: "${node.name}" doesn't take a { block }`);
  const children = def.block ? node.children.map((c) => makeWord(def.block, c, where.replace(/:\d+$/, ':' + c.line))) : null;
  try {
    return def.make(node.args, { ...def.props, ...node.props }, where, children);
  } catch (e) {
    throw new Error(e.message.startsWith(where) ? e.message : `${where}: ${e.message}`);
  }
}

// ------------------------------------------------------------------ treasure words
// A treasure (content/treasures.kdl) is a few of these. Each one adds its effect to the run's
// combined effects, `mods` (see newMods): the systems read mods, never treasure ids. Damage
// numbers are multiples of the run's power (pop damage x 1.8) unless the doc says otherwise.

// What a run has with no treasures
export function newMods() {
  return {
    bubbles: { pierce: 1, split: false, golden: null, giant: null },
    elements: new Set(),
    hits: { bubbles: { mark: 0, crit: null }, tentacles: { mark: 0, crit: null } },
    stats: { add: {}, pct: {} },     // stat bonuses: added, and % of the starting value
    landingShockwave: null, extraJumps: 0,
    dewReach: 1, dewMult: 1, healOnKill: 0, healOnHit: null, damageTaken: 1,
    growth: [], bugSpeed: 1, moreBugs: 1, cardChoices: 0,
    squeaks: [], spout: null, burstOnKill: null, cardRarity: 0,
    timed: [], orbit: null, beam: null, aura: null,
  };
}

const BY = ['bubbles', 'tentacles', 'all'];
const scopes = (by, where) => {
  if (!BY.includes(by)) throw new Error(`${where}: by= must be one of ${BY.join(', ')}`);
  return by === 'all' ? ['bubbles', 'tentacles'] : [by];
};
const ELEMENT_IDS = ['fire', 'lightning', 'ice', 'acid', 'wind', 'glitter'];

// effects that fire on an `every N { … }` timer; each gets (gadgets, ctx) when it fires
export const TIMED_WORDS = {
  ring: {
    doc: 'A ring around you, `radius` m: stings everything inside for `dmg`, pushes it out by `push` m, freezes it for `freeze` s. `elites=#false` spares elites and the boss; `look` is "ring" or "puff".',
    args: ['radius'],
    props: { dmg: 1, push: 0, freeze: 0, elites: true, color: '#ffffff', look: 'ring', show: 0.45 },
    make: ([radius], p) => ({ kind: 'ring', radius, ...p }),
  },
  zap: {
    doc: 'Zaps the `count` nearest enemies within `range` m with a jagged bolt, `dmg` each.',
    args: ['count'],
    props: { range: 0.45, dmg: 2 },
    make: ([count], p) => ({ kind: 'zap', count, ...p }),
  },
  brick: {
    doc: 'Drops a brick at your feet; the first walking enemy to step on it takes `dmg`. Lasts `last` s, at most `most` on the floor.',
    props: { dmg: 4, last: 14, most: 5 },
    make: (_, p) => ({ kind: 'brick', ...p }),
  },
  marble: {
    doc: 'Rolls a marble out the way you face at `speed` m/s for `life` s, bouncing off walls; each enemy it bowls through takes `dmg`.',
    props: { dmg: 2, speed: 0.825, life: 1.47 },
    make: (_, p) => ({ kind: 'marble', ...p }),
  },
  dew: {
    doc: 'Drops `dew` worth of dew at your feet.',
    args: ['dew'],
    make: ([n]) => ({ kind: 'dew', dew: n }),
  },
};

// The stats a treasure can raise with `stat`, by the name content files use
export const STAT_NAMES = { bubbles: 'bubbles', range: 'range', pop: 'pop', 'blow-rate': 'blowRate', moisture: 'moisture', 'swim-speed': 'pulse', regen: 'regen', dodge: 'dodge', luck: 'luck' };

export const TREASURE_WORDS = {
  pierce: { doc: 'Each bubble pops on up to `count` enemies in a line.', args: ['count'], make: ([n]) => (m) => { m.bubbles.pierce = Math.max(m.bubbles.pierce, n); } },
  'split-bubble': { doc: 'Each bubble that pops blows a smaller one at another enemy nearby, once.', make: () => (m) => { m.bubbles.split = true; } },
  'golden-bubble': { doc: 'Every `every`th bubble is golden and does `mult` times damage.', props: { every: 10, mult: 5 }, make: (_, p) => (m) => { m.bubbles.golden = p; } },
  'giant-bubble': { doc: 'Every `every`th bubble also blows a giant one: `size` times bigger, `dmg` times the damage, `speed` times as fast.', props: { every: 6, size: 2.5, dmg: 4, speed: 0.6 }, make: (_, p) => (m) => { m.bubbles.giant = p; } },
  element: {
    doc: 'Infuses your bubbles with an element: fire, lightning, ice, acid, wind or glitter (see bubbles.js). Elements stack.',
    args: ['name'],
    make: ([name]) => { if (!ELEMENT_IDS.includes(name)) throw new Error(`element must be one of ${ELEMENT_IDS.join(', ')}, not "${name}"`); return (m) => { m.elements.add(name); }; },
  },
  'mark-on-hit': { doc: 'Enemies you hit are marked for `seconds` and take 50% more damage from everything. `by` as above.', args: ['seconds'], props: { by: 'all' }, make: ([s], p, where) => { const sc = scopes(p.by, where); return (m) => { for (const k of sc) m.hits[k].mark = Math.max(m.hits[k].mark, s); }; } },
  crit: { doc: '`chance` of a hit doing `mult` times damage. `by` as above. Several crits (or copies) add their chances and use the biggest mult.', props: { chance: 0.2, mult: 3, by: 'all' }, make: (_, p, where) => { const sc = scopes(p.by, where); return (m) => { for (const k of sc) { const c = m.hits[k].crit; m.hits[k].crit = c ? { chance: c.chance + p.chance, mult: Math.max(c.mult, p.mult) } : { chance: p.chance, mult: p.mult }; } }; } },
  'extra-jumps': { doc: '`count` more jumps in mid-air.', args: ['count'], make: ([n]) => (m) => { m.extraJumps += n; } },
  'landing-shockwave': { doc: 'Landing from a drop of at least `drop` m sends out a ring of `radius` m that stings for `dmg`.', args: ['radius'], props: { dmg: 2, drop: 0.04 }, make: ([r], p) => (m) => { m.landingShockwave = { radius: r, ...p }; } },
  'squeak-when-hit': { doc: 'When you get hit, enemies within `radius` m are pushed back `push` m and take `dmg` (a flat number). Once every `cooldown` s. Several stack.', props: { radius: 0.09, push: 0.06, dmg: 3, cooldown: 5 }, make: (_, p) => (m) => { m.squeaks.push(p); } },
  'damage-taken': { doc: 'Hits take `times` as much moisture.', args: ['times'], make: ([k]) => (m) => { m.damageTaken *= k; } },
  spout: { doc: 'Stand still for `after` s and you refill `heal` moisture a second.', props: { after: 1, heal: 0.5 }, make: (_, p) => (m) => { m.spout = p; } },
  'heal-on-kill': { doc: 'Every enemy you clear gives back `moisture`.', args: ['moisture'], make: ([n]) => (m) => { m.healOnKill += n; } },
  'burst-on-kill': { doc: 'Enemies you finish off burst, stinging everything within `radius` m for `dmg`.', args: ['radius'], props: { dmg: 0.5 }, make: ([r], p) => (m) => { m.burstOnKill = { radius: r, dmg: p.dmg }; } },
  'dew-reach': { doc: 'Dew drifts to you from `times` as far.', args: ['times'], make: ([k]) => (m) => { m.dewReach *= k; } },
  stat: {
    doc: 'Raises a stat by `amount` (negative lowers it): bubbles, range, pop, blow-rate, moisture, swim-speed, regen (moisture a second), dodge (% chance a hit misses) or luck (rarer cards and treasures). `percent=#true` means % of its starting value.',
    args: ['name', 'amount'],
    props: { percent: false },
    make: ([name, amount], p) => {
      const key = STAT_NAMES[name];
      if (!key) throw new Error(`stat must be one of ${Object.keys(STAT_NAMES).join(', ')}, not "${name}"`);
      if (typeof amount !== 'number') throw new Error(`stat ${name} needs a number`);
      return (m) => { const t = p.percent ? m.stats.pct : m.stats.add; t[key] = (t[key] || 0) + amount; };
    },
  },
  'dew-mult': { doc: 'Enemies drop `times` as much dew.', args: ['times'], make: ([k]) => (m) => { m.dewMult *= k; } },
  'card-rarity': { doc: 'Level-up cards roll `steps` rarity higher.', args: ['steps'], make: ([n]) => (m) => { m.cardRarity += n; } },
  'card-choices': { doc: 'Level-ups offer `count` more cards to pick from.', args: ['count'], make: ([n]) => (m) => { m.cardChoices += n; } },
  'heal-on-hit': { doc: '`chance` that a bubble or tentacle hit gives back `moisture` (life steal).', props: { chance: 0.1, moisture: 1 }, make: (_, p) => (m) => { m.healOnHit = m.healOnHit ? { chance: m.healOnHit.chance + p.chance, moisture: Math.max(m.healOnHit.moisture, p.moisture) } : { ...p }; } },
  'grow-on-kills': {
    doc: 'Every `kills` enemies you clear, a stat grows by `amount` for the rest of the run (stat names as in `stat`; max moisture also refills by as much).',
    args: ['name', 'amount'],
    props: { kills: 10 },
    make: ([name, amount], p, where) => {
      const key = STAT_NAMES[name];
      if (!key) throw new Error(`grow-on-kills: stat must be one of ${Object.keys(STAT_NAMES).join(', ')}, not "${name}"`);
      return (m, copy = 0) => { m.growth.push({ stat: key, amount, kills: p.kills, key: `${where}#${copy}` }); };
    },
  },
  'bug-speed': { doc: 'Bugs move at `times` their speed (not elites or the boss).', args: ['times'], make: ([k]) => (m) => { m.bugSpeed *= k; } },
  'more-bugs': { doc: '`times` as many bugs come out of the vents (the cap on bugs at once grows too).', args: ['times'], make: ([k]) => (m) => { m.moreBugs *= k; } },
  every: {
    doc: 'Every `seconds` (the first time after `first` s, 60% of the period by default), does the effects in its { block }: ring, zap, brick, marble, dew.',
    args: ['seconds'],
    props: { first: null },
    block: TIMED_WORDS,
    make: ([s], p, where, effects) => (m, copy = 0) => { m.timed.push({ every: s, first: p.first ?? s * 0.6, effects, key: `${where}#${copy}` }); },
  },
  'orbit-lights': { doc: '`count` little bulbs circle you `radius` m out and sting whatever they touch for `dmg` (each enemy at most every 0.4 s).', args: ['count'], props: { radius: 0.07, dmg: 0.6 }, make: ([n], p) => (m) => { m.orbit = { count: n, ...p }; } },
  beam: { doc: 'A beam burns the nearest enemy within `range` m for `dmg` every `tick` s.', props: { range: 0.35, dmg: 0.3, tick: 0.25 }, make: (_, p) => (m) => { m.beam = p; } },
  aura: { doc: 'A glow of `radius` m around you stings everything inside for `dmg` every `tick` s.', args: ['radius'], props: { dmg: 0.4, tick: 0.5 }, make: ([r], p) => (m) => { m.aura = { radius: r, ...p }; } },
};
