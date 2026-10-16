// The attack scoreboard: every attack in the game and its Attack Feel audit (docs/agents/attack-feel.md).
// When you change an attack, update its score here; when you add one, the guard story below fails
// until it's listed. `score` is the nine audit rows in ROWS order (1 or 0), or null until audited;
// `seen` says how it was scored: 'play' (watched at play speed) or 'code' (read only).
// The bar each must reach comes from the rules, not from here (see `bar` below).

import { CONTENT } from '../content.js';
import { ENEMY_WORDS, ELEMENT_BASE, TREASURE_WORDS, TIMED_WORDS, newMods } from '../words.js';
import { EVERY_ATTACK, ok, story } from './kit.js';

export const ROWS = ['anticipation', 'release', 'travel', 'impact', 'target-reaction', 'attacker-reaction', 'aftermath', 'confirmation', 'sound'];
const todo = { score: null };

export const AUDIT = {
  // the jelly's own attacks
  player: {
    bubble: { score: [1, 1, 1, 1, 1, 1, 1, 1, 1], seen: 'code', note: 'v178: a 2 s floor splat (aftermath) and a flight whoosh (sound); knockback follows damage. Proven by attack/bubble-feel; splat checked in phone screenshots, not watched at play speed.' },
    sting: { score: [1, 1, 1, 1, 1, 1, 0, 1, 0], seen: 'code', note: 'v181 (was 4/9): bell twitch on release, impact flash, hit shake, knockback follows damage. No aftermath or layered sound, by L2: a frequent, small attack. Proven by attack/sting-feel.' },
    fire: todo, lightning: todo, ice: todo, acid: todo, wind: todo, glitter: todo,
  },
  // treasure words (src/words.js) that make an attack of their own
  treasures: {
    'echo-bubble': todo, 'toy-mouse': todo, 'golden-bubble': todo, 'giant-bubble': todo, 'zap-on-pop': todo,
    'landing-shockwave': todo, 'squeak-when-hit': todo, reflect: todo, venom: todo, polyps: todo, 'touch-sting': todo,
    'burst-on-kill': todo, 'orbit-lights': todo, beam: todo, aura: todo,
    ring: todo, zap: todo, brick: todo, marble: todo, lash: todo, 'bubble-ring': todo,
  },
  // treasure words that don't: they change an attack's numbers (audited with that attack) or aren't combat
  notAttacks: [
    'pierce', 'element', 'element-up', 'mark-on-hit', 'crit', 'pin-on-crit', 'extra-jumps', 'when-hit', 'rebirth',
    'no-regen', 'adorn', 'death-save', 'damage-taken', 'spout', 'heal-on-kill', 'crumb-on-kill', 'xp-reach', 'stat',
    'per', 'while', 'xp-mult', 'card-rarity', 'card-choices', 'heal-on-hit', 'grow-on-kills', 'more-treasures',
    'elite-damage', 'bug-speed', 'more-bugs', 'every', 'dash', 'xp',
  ],
  // bug behaviour words (ENEMY_WORDS) that attack the jelly, plus a bug simply touching it
  bugs: {
    contact: { score: null, note: 'v179: global target reaction adds a small horizontal hurt nudge and the hurt-minor feel step; Reduce effects silences shake. Reaction present from code; remaining rows still await the full contact audit.' },
    'curl-dash': todo, leap: todo, sortie: todo, 'ball-charge': todo, poke: todo, spit: todo, 'charge-beam': todo,
    swat: todo, burst: todo, whip: todo, dive: todo, becomes: todo, lob: todo, drops: todo, holds: todo,
  },
  notBugAttacks: ['chase', 'hover', 'zip', 'evade', 'hatch', 'rooted', 'hangs', 'brood', 'rolls'],
  // every Elite and Boss attack (src/stories/kit.js EVERY_ATTACK, itself checked against the game)
  hostile: {
    'controller/barrage': todo, 'controller/rumble': todo, 'mug/coffee': todo, 'mug/spill': todo,
    'kettle/steam': todo, 'kettle/boil-over': todo,
    'vacuum/charge': todo, 'vacuum/brushes': todo, 'vacuum/spin': todo, 'vacuum/suction': todo, 'vacuum/flies': todo, 'vacuum/dump': todo,
    'soap/squirt': todo, 'soap/bubble-ring': todo, 'clock/sweep': todo, 'clock/wreath': todo, 'clock/hour': todo,
    'whipper/balloon': todo, 'whipper/cream': todo,
    'clog/lash': todo, 'clog/snare': todo, 'clog/roll': todo, 'clog/spray': todo, 'clog/flood': todo, 'clog/shed': todo,
    'pothos/cutting': todo, 'pothos/roots': todo, 'pothos/whip': todo, 'pothos/sweep': todo, 'pothos/snap': todo,
    'croc/volley': todo, 'croc/tail-slam': todo, 'croc/pounce': todo,
    'bull/rush': todo, 'bull/spiral': todo, 'bull/minis': todo,
    'coffer/accordion': todo, 'coffer/tongue': todo, 'coffer/jewels': todo,
  },
};

// treasure words (timed ones too) used by a Legendary treasure or an Evolution: signature attacks
function signatureWords() {
  const out = new Set();
  for (const t of [...CONTENT.treasures.filter((t) => t.rarity === 'legendary'), ...CONTENT.evolutions]) {
    t.vocabulary.forEach((w) => out.add(w));
    for (const fx of t.effects) { const m = newMods(); try { fx(m); } catch {} for (const T of [...m.timed, ...m.onHurt]) for (const ef of T.effects) out.add(ef.kind); }
  }
  return out;
}
// the least an attack must score (docs/agents/attack-feel.md): 9 for signature, Elite and Boss attacks
export function bar(section, name, signature = signatureWords()) {
  if (section === 'hostile' || (section === 'player' && name in ELEMENT_BASE)) return 9;
  if (section === 'treasures' && signature.has(name)) return 9;
  return 7;
}

story('vocabulary/every-attack-is-audited', {
  about: 'Every attack in the game (the jelly\'s, its Elements, attacking treasure words, attacking bug words, every Elite and Boss attack) is on the scoreboard in src/stories/attack-audit.js, each score well formed. It reports what is unscored or below its bar; it fails only on a missing, stale or malformed entry.',
  setup() {},
  play() {
    const problems = [];
    const same = (what, listed, real) => {
      for (const n of real) if (!listed.includes(n)) problems.push(`${what} ${n}: not on the scoreboard`);
      for (const n of listed) if (!real.includes(n)) problems.push(`${what} ${n}: listed but not in the game`);
    };
    const { player, treasures, notAttacks, bugs, notBugAttacks, hostile } = AUDIT;
    same('element', Object.keys(player).filter((n) => n !== 'bubble' && n !== 'sting'), Object.keys(ELEMENT_BASE).filter((n) => n !== 'common'));
    same('treasure word', [...Object.keys(treasures), ...notAttacks], [...Object.keys(TREASURE_WORDS), ...Object.keys(TIMED_WORDS)]);
    same('bug word', [...Object.keys(bugs).filter((n) => n !== 'contact'), ...notBugAttacks], Object.keys(ENEMY_WORDS));
    const real = Object.values(EVERY_ATTACK).flatMap((act) => Object.entries(act).filter(([who]) => who !== 'bugs').flatMap(([who, a]) => Object.keys(a).map((n) => `${who}/${n}`)));
    same('Elite/Boss attack', Object.keys(hostile), real);
    const sig = signatureWords(), report = {};
    for (const section of ['player', 'treasures', 'bugs', 'hostile']) {
      const r = report[section] = { scored: 0, unscored: 0, below: [] };
      for (const [name, a] of Object.entries(AUDIT[section])) {
        if (a.score === null) { r.unscored++; continue; }
        if (!Array.isArray(a.score) || a.score.length !== ROWS.length || a.score.some((v) => v !== 0 && v !== 1)) { problems.push(`${section} ${name}: score must be ${ROWS.length} ones and zeros`); continue; }
        if (a.seen !== 'play' && a.seen !== 'code') problems.push(`${section} ${name}: seen must be 'play' or 'code'`);
        r.scored++;
        const total = a.score.reduce((s, v) => s + v, 0), need = bar(section, name, sig);
        if (total < need) r.below.push(`${name} ${total}/${need} (missing: ${ROWS.filter((_, i) => !a.score[i]).join(', ')})`);
      }
    }
    return ok(!problems.length, { problems, ...report });
  },
});
