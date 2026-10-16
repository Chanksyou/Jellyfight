# Attack Feel — Agent Instructions

Apply this file whenever you implement, tune, or review an attack, projectile,
hit effect, or combat feedback in this project. It is the operative summary of
the full theory in [The Feel of Impact](attack-effects-foundation.md); when the two disagree on a
detail, the foundation document explains why, and this file says what to do.

## Core principle

An attack is communication before it is arithmetic. The player never perceives
damage numbers directly — only their rendering through motion, light, sound,
and the world's reaction. Effects are not polish added afterward; they are the
combat system as the player experiences it. Never "fix" a weak-feeling attack
by raising its damage; fix its feedback.

## The chain: every attack must complete all seven phases

An attack is a causal chain. Each phase below must be present and perceptible.
One missing phase breaks the chain and downgrades the whole attack, no matter
how strong the others are.

1. **Anticipation** — a wind-up, charge, glow, or telegraph before release,
   scaled to the attack's power. Enemy attacks especially must be telegraphed;
   untelegraphed damage reads as unfair.
2. **Release** — the moment of firing is marked on the *same frame* the
   projectile leaves: muzzle flash + weapon/attacker kick together. Never let
   flash, sound, and projectile land on different frames.
3. **Travel** — the projectile is a trackable physical object: bright core,
   trail, slight spread/imperfection. It must never read as a laser line or be
   invisible in flight; the eye must be able to follow the cause to the effect.
4. **Impact** — an unmistakable event at the exact contact point: flash,
   sparks/particles, and deformation (squash) where it lands. A projectile must
   never silently vanish at the target's surface.
5. **Reaction** — both bodies answer. Target: one-frame white (or equivalent)
   flash, flinch, and knockback proportional to damage. Attacker: recoil, and
   a camera kick where a camera is involved. An enemy that absorbs hits without
   reacting is the #1 cause of "my weapon feels weak."
6. **Aftermath** — the world keeps evidence: debris/casings that persist,
   scorch or residue, lingering states (burning, slowed) that stay visible
   while they last. Damage-over-time must be visible, not just numerical.
7. **Confirmation** — the receipt, scaled by significance: damage numbers
   small for normal hits, clearly bigger for crits; kills get ceremony —
   hitstop (freeze 1–3 frames at the peak) before the body is thrown or
   dissolved. A kill must never look identical to a hit.

**Sound is a parallel channel across all phases**, not a phase: layer the
transient (crack/snap), the travel (whiz/whoosh), the impact (thud/boom), and
debris (ping/clatter), and randomize pitch slightly on every play. A single
unvaried sample reads as a toy within minutes.

## Laws (constraints, in priority order)

- **L1 Weakest link.** Juice is cumulative. When an attack feels weak, find
  the missing phase before adding more of a present one.
- **L2 Emphasis is a budget.** Scale effect intensity with significance:
  normal < crit < kill, trash enemy < boss. Keep ordinary attacks restrained
  so exceptional ones can be loud. If everything is thunder, nothing is.
- **L3 Timing beats quantity.** Same-frame causality, anticipation
  proportional to power, 1–3 frames of hitstop at the peak. Three effects on
  the exact frame beat ten effects mistimed.
- **L4 It must survive real play.** Feedback has to read at gameplay
  distance, in clutter, at speed, on a small screen, and on the 500th
  repetition. Prefer signals that read anywhere (white flash, knockback,
  pitch-varied sound) over subtle animation detail.
- **L5 Effects are information.** Every element must answer a player
  question: Did it fire? Did it hit? How much did it matter? Is it dead?
  Cut effects that answer nothing; they tax the ones that do.

## Pre-delivery audit

Before reporting any attack-effect work as done, score the attack against
these nine questions and report the score with any zeros named:

1. Can the player see it coming, in proportion to its power? (Anticipation)
2. Is the release marked on the exact frame it fires? (Release)
3. Can the eye track the projectile across the whole flight? (Travel)
4. Is there an unmistakable event at the contact point? (Impact)
5. Does the target visibly answer — flash, flinch, displacement? (Reaction)
6. Does the attacker (and camera) feel their own attack? (Reaction)
7. Does the world keep evidence after the instant passes? (Aftermath)
8. Is the receipt — numbers, kill treatment — scaled to significance?
   (Confirmation)
9. Is the sound layered (transient, travel, impact, debris) and varied
   per use? (Sound)

A basic attack on a minor enemy may legitimately score 6–7. A boss attack, a
player's signature ability, or anything meant to feel powerful must score 9.

## In Jelly Fight

This file and the foundation are the theory under
[Designing the jelly's attacks](jelly-attack-design.md), which applies them to
the jelly's families, phones, and verification. `CLAUDE.md` rules still win:
where a phase below needs something that changes play, it goes through them.

### Where each phase already has a home

Reuse these before writing anything new. A phase missing from an attack is
usually one call to an existing primitive, not a new system.

| Phase | Player attacks | Hostile attacks (Elites, Vacuum) | Existing pieces |
|---|---|---|---|
| Anticipation | The bell squeeze (`run.js` `onBlow` → `avatar.pulse`); cooldown cues. Automatic fire gets no added charge delay. | The Warning: floor shape + volume filling to the hit (`fx.tele`, `fx.volume`, ADR 0001). | `src/vfx.js`, `src/fx.js` |
| Release | Squeeze, `sfx.blow` and the bubble on the same frame (`bubbles.js`). | `fx.impact` at the muzzle, launch sound. | `src/fx.js`, `src/sfx.js` |
| Travel | The bubble body and Element looks. | A Shot: `fx.orb` + `fx.orbTick`. | `src/bubble-looks.js`, `src/fx.js` |
| Impact | `fx.impact`, `fx.burst`, `fx.ring` at the contact point. | `fx.impact`; `blastHits` decides the hit. | `src/fx.js` |
| Reaction (target) | White flash (`e.flashT`, `enemies.js`), the `knockback` event, critter squash. | The jelly's hurt: `damage_taken`, shake. | `src/enemies.js`, `src/critters.js`, `src/events.js` |
| Reaction (attacker) | Bell squeeze, `juice.shake` scaled by size. | The Elite or Vacuum's own animation. | `src/juice.js` |
| Aftermath | Burning, frozen, acid puddle while the status lasts; fire corpses. | Scorches only while they still hurt. | `src/bubbles.js`, `src/fx.js` |
| Confirmation | `fx.number` sized by significance, `fx.crit`, kill burst + `juice.hitstop` (`feedback.js`). | The Health bar and hurt sound. | `src/feedback.js`, `src/juice.js` |
| Sound | `sfx` voices with `jitter()` pitch and `gap()` limits. | Same. | `src/sfx.js` |

### House rules that shape the chain

- **More damage, bigger knockback** (owner's decision, October 2026). A hit's
  shove grows with the damage it does, for the jelly's attacks and treasures.
  Making knockback follow damage needs no balance-bot run; say in the pull request
  what moved. Stun and new hit-stop still follow `CLAUDE.md` rule 5. The flinch,
  white flash, and squash are free: they change only what the player sees.
- **How hard a moment lands is one ladder.** Shake and hit-stop come from the
  `--feel-*` steps in `content/look.css` through `juice.feel(step)`, from `hit`
  (a bubble pop) to `boss-kill`. An attack picks a step; it never calls
  `juice.shake`/`juice.hitstop` with its own numbers. A new step is a new line on
  the ladder, in order of significance (L2).
- **Hit-stop belongs to kills and big moments.** Never per ordinary hit, never
  chained by continuous fire.
- **Reduce effects** (the pause menu's ✨ button, `juice.calm`) turns off screen
  shake and softens the hurt glow. Anything new that shakes or flashes the whole
  screen must go quiet under it. Information never depends on it being off.
- **Aftermath is honest.** Evidence that stays must not look like an active
  hazard. A burning, chilled, or acid state shows exactly while it lasts. Purely
  cosmetic leftovers (splats, droplets, scorch) are allowed when they read as
  harmless, fade, and are capped and pooled for phones.
- **Hostile is hot, friendly is cool** (`CLAUDE.md` rule 3). Anticipation for a
  hostile attack is its Warning, in the source's colour.
- **Phones first.** Every phase must still read on Low with bloom off and
  without sound. Sound adds weight; it never carries information alone.
- **Effects follow the confirmed gameplay result** and never decide a hit.

### The scoreboard and reporting the audit

Every attack in the game is listed with its score in `src/stories/attack-audit.js`
(the jelly's, its Elements, treasure words that attack, bug words that attack, and
every Elite and Boss attack). The story `vocabulary/every-attack-is-audited` fails
when an attack is missing or stale, and reports what is unscored or below its bar.
The bar is worked out from the rules: 9 for Elements, Elite and Boss attacks, and
treasure words a Legendary treasure or an Evolution uses; 7 for the rest.

When you change an attack, update its score there and put the before and after
in the pull request, naming each zero and why it is acceptable (L2) or what fixes
it (L1). Score what you saw at play speed (`seen: 'play'`); mark scores from
reading code only as `seen: 'code'`.

### Baseline: the ordinary bubble (from reading the code, October 2026)

The starting point for the rework. Not play-tested; confirm on screen before
building on it.

| # | Score | Evidence |
|---|---|---|
| 1 Anticipation | 1 | Bell squeeze; subtle, as an automatic attack should be. |
| 2 Release | 1 | `onBlow` squeeze + `sfx.blow` when the bubble spawns. |
| 3 Travel | 1 | Translucent body and rim. |
| 4 Impact | 1 | `fx.impact` flash and sparks, droplet `fx.burst`. |
| 5 Target reaction | 1 | 0.07 s white flash and a small shove (not for flyers). |
| 6 Attacker reaction | 1 | Bell squeeze; a 0.03 shake per pop (0.12 big). |
| 7 Aftermath | 0 | The pop clears in about 0.3 s; nothing stays unless a status does. |
| 8 Confirmation | 1 | Numbers sized by significance, crit star, kill burst + hit-stop. |
| 9 Sound | 0 | Transient (`blow`), impact (`pop` + `hit`), debris (the pop's fizz), all pitch-varied; no travel layer. |

7/9, acceptable for a basic attack on a minor enemy. v178 fills both zeros: a
plain bubble's pop leaves a wet splat on the floor for 2 s (`fx.splat`), and the
blow carries a short whoosh as it flies off (`sfx.whiz`); its knockback now follows
damage (`knockFor` in `src/stats.js`). The scoreboard holds the current score. The jelly's signature
attacks (Elements, Evolutions, Legendary Treasures) and every Elite and Vacuum
attack must reach 9.
