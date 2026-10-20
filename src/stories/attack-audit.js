// The attack scoreboard: every attack in the game and its Attack Feel audit (docs/agents/attack-feel.md).
// When you change an attack, update its score here; when you add one, the guard story below fails
// until it's listed. `score` is the nine audit rows in ROWS order (1 or 0), or null until audited;
// `seen` says how it was scored: 'play' (watched at play speed) or 'code' (read only).
// v206: shared confirmation still scores 1; rapid direct hits share one burst receipt per target,
// retaining crit emphasis and quiet grouped ticks. Other phases/scores are unchanged.
// v209 tunes elite tempo, counts and aggro only. Existing phase implementations and scores
// are retained; unscored elite attacks remain unscored (no new claim of play-speed verification).
// v219: Box Jelly reuses the existing Lash rig with thicker, brighter tubes. Strike timing,
// target feedback, venom and sound are retained; the existing sting score is unchanged.
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
    sting: { score: [1, 1, 1, 1, 1, 1, 1, 1, 1], seen: 'code', note: 'v215 7→9: a 25 ms coil and accelerating snap fit inside the original 70 ms contact. The bell answers, confirmed contact squashes the tip and flashes the target with unchanged damage-scaled shove; fast retraction releases the soft rig into its spring recovery. A brief curved wet trace and small fading floor droplets fill aftermath. Layered varied stretch, release zip, wet slap/body and droplets fill sound. Existing damage/kill receipts remain grouped. Dead or newly shielded targets give no false hit feedback. Code/stepped-visual audit; play-speed sound not certified.' },
    fire: { score: [1, 1, 1, 1, 1, 1, 1, 1, 1], seen: 'code', note: 'v190, shared with the other Elements: energy gathers at the bell over the last fifth of its timer (no added delay); on the release frame the bell squeezes (onElementRelease). Its own: launch flash and pressure-pulse sound per fireball, a flame-tongued fireball with embers, a compact ignition and crack on a real hit only (attack/fire-miss), the bug flashes and is shoved, burning shows exactly while it lasts and burning deaths break into ash, embers and smoke; numbers and kill burst. Proven by attack/fire-feedback, attack/fire-miss, attack/element-feel (gather); screenshots, not watched at play speed.' },
    lightning: { score: [1, 1, 1, 1, 1, 1, 1, 1, 1], seen: 'code', note: 'v191: motes gather at the bell before each shot (no added delay); on the release frame the bell squeezes, a flash with short arcs, and a snap with a buzzing zip and crackles. In flight a crackling ball of light with a streak behind it, now and then spitting an arc. A real hit: a white flash lighting up round it, six forks and sparks spat out, a scorch on the floor that fades; a crack, falling zap, low thump with a rumble of thunder and sizzling crackles. Each chain jump is a flickering bolt that re-strikes in a new jagged shape every frame for 0.2 s (crisp line, white core, yellow halo, thick in the middle and tapering, forks), flashing where it lands, only ever to a bug it really hit; each jump\'s tzzt a step higher; a chain of 2+ jumps lands harder (feel hit-big). Stunned bugs crackle with little arcs exactly while the stun lasts. Proven by attack/element-feel, attack/lightning-chain; screenshots, not watched at play speed.' },
    ice: { score: [1, 1, 1, 1, 1, 1, 1, 1, 1], seen: 'code', note: 'v190, shared with the other Elements: energy gathers at the bell over the last fifth of its timer (no added delay); on the release frame the bell squeezes (onElementRelease), a frosty flash and a glassy chime with a whoosh. A spinning crystal shard with a frosty trail; a real hit throws ice shards and settling frost with a crunch, thud and tinkles; chill only slows (refreshing, never freezing) and the slow ring shows exactly while it lasts. Proven by attack/element-feel, attack/ice-slow-and-followup-upgrade; screenshots, not watched at play speed.' },
    acid: { score: [1, 1, 1, 1, 1, 1, 1, 1, 1], seen: 'code', note: 'v197: motes gather at the bell; on release the bell squeezes, a green flash and a gloopy bloop. In flight a wobbling glob with a sloshing two-blob tail, a slimy streak, drips and toxic vapour coming off it. A real hit: a flash, a splash of droplets and a crown of drops thrown up and falling, sizzle smoke; a splat, bloops and a hiss. The puddle (AcidMaterial: a wobbly irregular edge, deep toxic middle, bright rim, ripples and blisters swelling across it) splats in with a ring of drops, overshooting then settling; it bubbles and fumes while it lasts and shrinks, darkens and dries over its last 0.6 s, showing its real area and ending; each bite on a bug sizzles green and smokes at its feet with a quiet hiss. Small ticks now show as 0.4, not 0. Proven by attack/element-feel, attack/acid-puddle-feel; screenshots, not watched at play speed.' },
    wind: { score: [1, 1, 1, 1, 1, 1, 1, 1, 1], seen: 'code', note: 'v181: gathered wind and bell compression before same-frame release, crescent/trail, confirmed impact flash, push/white flinch, bell recoil/light feel step, fading debris, actual damage/kill numbers, varied charge/rush/contact/scenery thud. Scenery-only swept push deals one equal-damage collision; attack/wind-* proves mechanics. Play-speed visual review pending.' },
    glitter: { score: [1, 1, 1, 1, 1, 1, 1, 1, 1], seen: 'code', note: 'v190, shared with the other Elements: energy gathers at the bell over the last fifth of its timer (no added delay); on the release frame the bell squeezes (onElementRelease), a pink flash and a twinkling chime. A sparkling orb; a real hit bursts in confetti with a ring the size of the real splash, and twinkles drift down and fade (harmless) with a pop, thump and shimmering pings. Proven by attack/element-feel; screenshots, not watched at play speed.' },
  },
  // treasure words (src/words.js) that make an attack of their own
  treasures: {
    'fire-trail': { score: [1, 1, 1, 1, 1, 1, 1, 1, 1], seen: 'code', note: 'v214 Cinder: flaming tentacle tips announce the source, actual grounded movement ignites a floor ribbon with a hiss/crackle on release. Blue-white tongues and the honest footprint show only the last two seconds of walked surface. Confirmed floor contacts flash locally, flinch and receive damage-scaled shove; the jelly pulses with a restrained hit feel step. The live trail flickers and fades out with its exact damage lifetime; grouped fire ticks and existing kill feedback confirm results. Varied ignition, crack/body/sizzle/debris sound layers. Code audit; stories and stepped desktop/phone previews cover the route, air gaps, expiry, overlap, height, reset and shader preparation. Play-speed sound not audited.' },
    rebound: { score: [1, 1, 1, 1, 1, 1, 1, 1, 1], seen: 'code', note: 'v213: inherits the ordinary bubble bell pulse, same-frame blow/whiz, body/glow, confirmed contact flash and droplets, target white flash and damage-scaled shove, feel step, fading floor splat, grouped damage/kill receipts and varied layered pop sound. Reversing bands, turn ring and falling-pitch watery whoosh mark the return; brief rings track its path. Stories prove one hit per leg, guidance, bounded lifetime, pierce and unchanged Elements. Code audit; no play-speed audio claim.' },
    'energy-shield': { score: [1, 1, 1, 1, 1, 1, 1, 1, 1], seen: 'code', note: 'Aegis: the visible shell weakens and flashes on absorbed hits; depletion releases the burst, bell pulse and layered crack/bass/crystal sound together. A brief sphere and ring show the actual 20 cm area. Confirmed targets receive localized impacts, white flash, damage-scaled shove, damage numbers and existing kill feedback. Harmless shards settle and fade within 1.1 s. The shell disappears for the HUD-marked 8 s recharge, then returns with a chime. Code audit; gameplay screenshots and stories cover absorption, overflow, flat burst damage, recharge and reset; not a play-speed sound audit.' },
    'echo-bubble': todo, 'toy-mouse': todo, 'golden-bubble': todo, 'giant-bubble': todo, 'zap-on-pop': todo,
    'landing-shockwave': todo, 'squeak-when-hit': todo, reflect: todo, venom: todo, polyps: todo, 'touch-sting': todo,
    'burst-on-kill': todo, 'orbit-lights': todo, beam: todo, aura: todo,
    ring: todo, zap: todo, brick: todo, marble: todo, lash: todo, 'bubble-ring': todo,
  },
  // treasure words that don't: they change an attack's numbers (audited with that attack) or aren't combat
  notAttacks: [
    'decoy',
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
    'charge-shot': { score: [1, 1, 1, 1, 1, 1, 1, 1, 1], seen: 'code', note: 'The stag beetle: a 1 s charge (sparks drawn in, a big ball growing between its mandibles with arcs to them, jaws trembling, a rising whine with crackles; aim locks at 60%); on the fire frame a flash at its jaws, a zap and its mandibles snapping wide as it rocks back; a big white core in a hot orange halo shedding sparks, with a whoosh. Wherever it lands it explodes, a Blast 7 cm round: a white flash, an orange fireball swelling and billowing up, shock rings, forks of lightning, sparks thrown up and falling, bits of floor, smoke, a fading scorch with dying embers; a crack and a low boom with crackles and pattering bits; on the jelly the hurt reaction and a shove, a near miss shakes the screen (feel impact). Proven by words/charge-shot, words/charge-shot-blast, enemies/stag-beetle-shot-dodge, act3/stag-beetle-with-sound; checked in desktop and phone screenshots of each phase, not watched at play speed.' },
  },
  notBugAttacks: ['chase', 'hover', 'zip', 'evade', 'hatch', 'rooted', 'hangs', 'brood', 'rolls', 'death-motion'],
  // every Elite and Boss attack (src/stories/kit.js EVERY_ATTACK, itself checked against the game)
  hostile: {
    'controller/barrage': { score: [1, 1, 1, 1, 1, 1, 1, 1, 1], seen: 'code', note: 'v226: fixed source-magenta circle, square, triangle and X floor warnings with matching low prisms; buttons press, rising charge and final click precede same-frame shape flashes, physical recoil and layered release/contact audio. Shape footprint and height determine one actual hurt/Health receipt, followed by fading prisms and harmless fragments. 9/9 before and after; code/stepped visual audit, not play-speed listening. Replaces three mixed-height Shots with floor explosions.' },
    'controller/rumble': { score: [1, 1, 1, 1, 1, 1, 1, 1, 1], seen: 'code', note: 'v218, previously unscored: growing motor vibration, compressed body, bright light bar and synchronized floor/22 cm dome Warning; same-frame discharge flash, kick and motor crack/bass/debris sound; a brief dome shows the exact blast extent (instant area attack, no projectile flight); existing confirmed hurt/knockback/Health feedback; harmless pooled chips and a small fading scuff record the discharge. Damage, 1.1 phase time, 22 cm hit area and knockback retained. Reduce Effects removes new vibration; pulse expires and reset removes it. Code/stepped visual audit, not a play-speed listening claim.' },
    'mug/coffee': todo, 'mug/spill': todo,
    'kettle/steam': todo, 'kettle/boil-over': todo,
    'vacuum/charge': todo, 'vacuum/brushes': todo, 'vacuum/spin': todo, 'vacuum/suction': todo, 'vacuum/flies': todo, 'vacuum/dump': todo,
    'soap/squirt': todo, 'soap/bubble-ring': todo, 'clock/sweep': todo, 'clock/wreath': todo, 'clock/hour': todo,
    'whipper/balloon': todo, 'whipper/cream': todo,
    'clog/pinball': { score: [1, 1, 1, 1, 1, 1, 1, 1, 1], seen: 'code', note: 'v194: three leaps at you. Anticipation: a crouch with a shudder and a roar while a circle with a half sphere fills where it will land, following you then flashing faster as it locks. Release: a heave and rising whoosh, a dust puff. Travel: the hairball arcs high, stretched tall and spinning. Impact: a slam (flash, hair and gunk, puff, ring) and the Blast. Reaction: you are thrown back; it squashes flat and shakes the screen (impact-big). Aftermath: a gunk splat on the tub floor; the last slam rolls a ring wave out (jump it). Confirmation: Health bar and hurt. Sound: heave/whoosh, thud, splat, pattering bits. Proven by act2/clog-pinball; screenshots, not watched at play speed.' },
    'clog/comb': { score: [1, 1, 1, 1, 1, 1, 1, 1, 1], seen: 'code', note: 'v194: hair curtains in alternating lanes across the tub. Anticipation: a rustle, the Clog shudders with its maw open while each wave\'s strips and tall lane volumes fill. Release: the lash crack on the frame they fall. Travel: none needed (an area that fills). Impact: flashes and hair bursts along each struck lane. Reaction: you are hit and tangled; the screen shakes (impact). Aftermath: hair tufts spring up along the lanes and sink. Confirmation: Health bar and hurt. Sound: rustle, crack, the tufts. Proven by act2/clog-comb; screenshots, not watched at play speed.' },
    'clog/lash': todo, 'clog/snare': todo, 'clog/roll': todo, 'clog/spray': todo, 'clog/flood': todo, 'clog/shed': todo,
    'pothos/cutting': todo, 'pothos/roots': todo,
    'pothos/whip': { score: [1, 1, 1, 1, 1, 1, 1, 1, 1], seen: 'code', note: 'v184: existing curved warning, vine windup/lash/landing, endpoint impact and player hurt/knock feedback, heart opening and layered sound retained; recovery shorter, foliage and heart move continuously. Stepped desktop/phone captures; normal-speed review pending.' },
    'pothos/sweep': { score: [1, 1, 1, 1, 1, 1, 1, 1, 1], seen: 'code', note: 'v184: code audit 8->9: confirmed contact now adds a localized impact. Wedge/arc warning, moving vine, player hurt/knock, settled vine and layered brush/crack sound retained. Normal-speed review pending.' },
    'pothos/snap': { score: [1, 1, 1, 1, 1, 1, 1, 1, 1], seen: 'code', note: 'v184: existing warning/lash, impact, player hurt/knock, vine recoil and layered sound retained. Guard still pauses for the full heart opening. Code audit only.' },
    'croc/volley': todo, 'croc/tail-slam': todo, 'croc/pounce': todo,
    'bull/rush': todo, 'bull/spiral': todo, 'bull/minis': todo,
    'coffer/accordion': todo, 'coffer/tongue': { score: [1, 1, 1, 1, 1, 1, 1, 1, 1], seen: 'code', note: 'v181: the chomp. Anticipation: the mouth gapes with a creak (no Warning: unavoidable by design, ADR 0001). Release: the lash. Travel: the stretching, glowing tongue. Impact: the jaws slam shut on the jelly on the bite frame (flash, drool and tooth spray, feel impact-big). Reactions: the jelly is hurt, held and chewed, then spat out with a shove; the box bounces and chews. Aftermath: a wet patch on the desk. Confirmation: the hurt number and the chew crunches. Sound: creak, lash, latch, chomp, crunches, spit, pitch-varied. Proven by act3/coffer-tongue-chomps-chews-and-spits; checked in desktop and phone screenshots, not watched at play speed.' }, 'coffer/jewels': todo,
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
