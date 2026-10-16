# Designing the jelly's attacks

Read this before developing or reviewing any player projectile, damaging skill,
or attack modifier. It applies to ordinary bubbles, all Elements, tentacle
stings, Evolutions, Treasures, companions, auras, traps, retaliation, and effects
triggered by hits, kills, movement, or landing. Apply the same method to future
attacks. This is a development standard, not a claim that every current attack
already meets it.

## Purpose and references

Every attack should communicate **where its energy comes from, how it moves,
what it reaches, and what happened when it connected**. Build satisfaction from
shape, timing, contrast, and a visible consequence. More particles alone do not
make a better attack.

The foundation is [Attack Feel](attack-feel.md): the seven-phase chain
(Anticipation, Release, Travel, Impact, Reaction, Aftermath, Confirmation), sound
as a parallel channel, the five laws, and the nine-question audit. Its reasoning
is in [The Feel of Impact](attack-effects-foundation.md). This guide applies that
chain to the jelly; use its phase names in notes, code comments, and reviews.

The owner's references are Egor's [spell feedback demonstration](https://www.instagram.com/p/Deff1_AtlFi/)
and [lightning demonstration](https://www.instagram.com/p/DeaiBSlodi2/), plus the
gunfire and spell reels unified in the foundation.
Use their principles: build feedback in deliberate layers; give electricity
expressive bends, varying width, tapered accents, and a bright core within a
colored halo. The application to Jelly Fight below is our design direction,
not a transcription of either reel. Their audio has not been evaluated.

Follow Ponytail: read the existing attack flow, reuse what works, improve one
representative attack first, and add only the layers needed to make it readable
and satisfying. No new effects framework or dependency just to follow this guide.

## Before changing an attack

Trace its source, targeting, timer, collision or area checks, damage, status
effects, event listeners, visual lifetime, and cleanup. Check modifiers and
companions that reuse it. The code and content are authoritative when older
descriptions disagree: Elements currently fire independently of ordinary bubbles.

For each attack being changed, put a short design note in the task or pull request:

- **Identity:** the one action or material it should suggest, and its silhouette.
- **Rules:** trigger, source, target, reach, cadence, damage, statuses, and end conditions.
- **Feedback:** anticipation, release, travel, impact, reaction, aftermath, and
  confirmation; mark phases that do not apply. Specify sound separately from visuals.
- **Audit:** the nine-question score from [Attack Feel](attack-feel.md), before
  and after, with each zero named.
- **Strength:** ordinary hit, upgraded or critical hit, and kill; identify what scales.
- **Limits:** concurrent effects, sound overlap, lifetime, and what Low graphics omits.
- **Proof:** the story, visual comparison, and performance checks that will establish success.

Record actual timing and limits for the affected attack rather than inventing
one duration or particle count for every ability. This note is documentation;
it does not require a runtime profile system.

## Use one sequence, adapted to each attack

| Phase | What the player should understand | Development instruction |
|---|---|---|
| Anticipation | The jelly or skill is about to act. | Use an existing bell squeeze, tentacle draw-back, gathering energy, or cooldown cue where appropriate. Repeating automatic attacks need subtle preparation; do not add a charge delay to every shot. |
| Release | The attack starts here and goes this way. | Anchor it to the actual bell, tentacle tip, companion, or trigger location. Coordinate the source animation, launch effect, and sound. |
| Travel or active area | Its direction, shape, and reach are readable. | Give projectiles a distinct body and optional trailing accents. Give auras, traps, and pulses an honest footprint instead of inventing travel. Keep the leading edge clear. |
| Impact | A real hit happened at this point. | Trigger the main flash, burst, and sound from the confirmed gameplay result. Separate hit feedback from a wall collision, range expiry, blocked hit, or miss. |
| Reaction | The target felt it, and so did the jelly. | Enemy white flash and squash or flinch; the jelly's bell or tentacle answers its own attack. Shake scales with significance. Displacement only where gameplay already applies it. |
| Aftermath | The immediate hit ended, or a status remains active. | Clear the burst quickly. An ongoing burn, freeze, venom, or puddle shows exactly while it lasts. Cosmetic leftovers (splats, droplets) may stay briefly if they read as harmless, fade, and are capped. |
| Confirmation | How much it mattered; whether it died. | Numbers sized by significance, a distinct crit, and a kill that never looks like a hit (burst, the existing kill hit-stop). |

The highest contrast should be at the important instant and place. Reserve bright
white accents for small, brief cores or contacts; keep silhouettes visible against
both the room and other effects. A trail shows previous motion, not extra reach.
Enemy recoil, flashes, and damage numbers should agree with the outcome. Damage
numbers support the effect; players should recognize a successful hit without them.

## Give each attack family its own character

These are target qualities, not instructions to change attack mechanics.

| Family | Shape and motion | Contact and continuing information |
|---|---|---|
| Ordinary bubbles | A rounded translucent body, readable rim, and buoyant motion from the bell. | A quick, local pop and restrained fragments; retain a visible rim on Low without bloom. |
| Tentacle stings | A readable lash from the correct tentacle toward the chosen enemy, followed by recovery. | A localized sting at contact; venom has its own continuing cue. Decorative deformation must not imply an extra hit or interrupt movement. |
| Fire | A compact energetic core, irregular flame envelope, and trailing embers. | A brief ignition at contact; burning remains visible only while the status is active. |
| Lightning | An irregular angular path, varying thickness, tapered ends, limited secondary arcs, and a narrow bright core within the element's colored halo. | A sharp local contact and brief afterimage. Chain segments join actual struck enemies; do not draw damaging-looking connections to untouched targets. |
| Ice | A directional crystalline silhouette and sparse, sharp fragments. | Distinguish a chilling hit from a completed freeze and from a shatter; show each only when it occurs. |
| Acid | A cohesive wobbling glob with restrained drips. | The persistent puddle shows the actual affected ground area and lifetime, including its ending. |
| Wind | A broad crescent with clear direction and tapered wisps. | Its visible sweep agrees with collision width. Show a shove only when gameplay applies one. |
| Glitter | A compact sparkling body with a clear center; decorative particles stay subordinate. | A brief area burst that communicates the real splash size; avoid an opaque cloud. |
| Pulses, auras, and contact skills | An anchored ring, boundary, or restrained body cue appropriate to the actual volume. | Distinguish a persistent active area from a timed damage tick. A tick need not produce a full-screen celebration. |
| Traps, orbiters, companions, and triggered attacks | Keep the source identifiable: the placed object, moving companion, landing point, or struck enemy. | Reuse the matching attack family's language; show activation, consumption, expiry, and secondary hits only when they occur. |

Upgrades should reinforce the changed property: a wider area has a wider readable
footprint; an additional projectile has another body; a real chain has another
connection. A damage-only upgrade can change emphasis without implying a larger
hitbox. Overlapping statuses need a clear primary silhouette and restrained accents,
not every full effect stacked on the same enemy.

## Keep feedback honest and combat readable

- Preserve targeting, cooldowns, damage, range, projectile speed, collision,
  status duration, and movement unless a mechanics change is explicitly requested.
  Adding anticipation must not secretly delay firing or reduce damage per second.
- Animate from gameplay events and positions. Cosmetic animation never decides
  whether something hits. Avoid duplicate flashes, sounds, and numbers when both
  an attack and a shared event listener handle the same hit.
- Knockback follows damage: a harder hit shoves further (the owner's decision;
  see [Attack Feel](attack-feel.md)). Do not introduce stun or new hit-stop as
  cosmetic polish; they affect play and follow the balance procedure in `CLAUDE.md`.
  Shake and hit-stop come from the `--feel-*` ladder through `juice.feel`.
- Common hits stay local and restrained. Critical hits and important kills may
  receive stronger emphasis, bounded across simultaneous hits. Continuous attacks
  must not create continuous camera shake or chain freezes of the whole game.
- The jelly, enemy silhouettes, hostile Warnings, and safe movement space remain
  readable during a crowded fight. Follow `CLAUDE.md`'s friendly/hostile visual
  language. Preserve approved element identities; do not copy a reel's palette
  where it would conflict with this game's danger cues. Use shape and timing as
  well as color to distinguish them.
- Add sound through the existing audio system, synchronized with the corresponding
  event and limited under rapid fire. Honor mute and existing volume controls.
  Gameplay information must remain understandable without sound, bloom, or shake.
  Avoid large repeated flashes and strobing; preserve reduced-effects settings
  where present and flag accessibility limits during review.

## Use the existing implementation homes

| Concern | Start here |
|---|---|
| Bubble and Element firing, hits, chains, and persistent effects | `src/bubbles.js` |
| Element projectile appearance and animation | `src/bubble-looks.js` |
| Tentacle hit rules and rig | `src/combat.js`, `src/tentacles.js`, `src/character.js` |
| Triggered, passive, companion, and run-level effects | `src/gadgets.js`, `src/run.js` |
| Shared effects and visual primitives | `src/fx.js`, `src/vfx.js`, `src/batch.js` |
| Event-driven hit, status, and kill feedback | `src/events.js`, `src/feedback.js` |
| Existing camera emphasis and sound | `src/juice.js`, `src/sfx.js` |
| Appearance values | `content/look.css`, read through `src/look.js` |
| Mechanics, upgrades, and effect vocabulary | `src/stats.js`, `src/words.js`, `content/treasures.kdl`, `content/evolutions.kdl` |

Trace the actual caller before choosing a home. Reuse the event bus and existing
effect words; do not branch on a Treasure or Evolution id. Keep new appearance
values in `content/look.css`. Keep effects pooled or batched, reuse buffers and
scratch vectors, and clean up on hit, expiry, reset, death, and act transition.

## Phones and dense fights are the baseline

Build the readable body, contact, and necessary status cues on Low first, with
bloom off. Higher settings may add decorative glow, fragments, and trails.
Never remove information needed to understand a hit or active damage area.

Set explicit limits on concurrent particles, trail segments, branches, lingering
effects, and sound voices. At the limit, shed old or optional decoration while
preserving the real projectile and contact. Avoid large overlapping transparent
layers, per-shot lights, shader recompilation during combat, and per-frame object
allocation. Follow the existing light-slot and frame-pacing rules.

Measure frame times, draw calls, and active effect counts before and after in the
same scene. Judge against the configured graphics tier and frame cap. Phone-sized
browser emulation checks layout and readability; it does not establish performance
on a real iPhone or Pixel. Report which hardware and graphics settings were tested.

## Develop and verify one complete attack at a time

1. Inventory the affected family and its modifiers; write the short design note.
2. Capture the current behavior in a repeatable story. Improve its silhouette
   and contact first, then add only useful preparation, trails, sound, and aftermath.
3. Compare before and after from the gameplay camera at normal speed. Check
   source alignment, contact timing, misses, walls, floor height, and moving targets.
4. Exercise upgrades, multiple Elements, companions, critical hits, chains,
   simultaneous kills, and ongoing statuses that actually interact with the change.
   Check pause, reset, death, and act transitions for lingering visuals or sounds.
5. Inspect both an isolated hit and dense play on desktop and phone Low without
   bloom; verify mute and supported reduced-effects settings. Confirm that hostile
   Warnings and the jelly remain visible. Use still images for shape and recordings
   or live playback for timing; a screenshot cannot prove animation or sound.
6. Add or update the relevant story for changed behavior, including a check that
   cosmetic polish preserves hit rules when applicable. Existing `treasures/`,
   `evolutions/`, and `phone/` stories are starting points, not proof of visual quality.
   Run the targeted stories during work and the full suite before a code release,
   as required by `CLAUDE.md`. Never claim an untested device or sound check passed.
7. Review for duplicate feedback, excessive intensity, geometry/particle growth,
   cleanup failures, and accidental balance changes. Follow the normal branch,
   commit, pull request, and approved release workflow.

An attack is ready when its audit score fits its significance (see
[Attack Feel](attack-feel.md)); its source, direction or area, successful contact, and
ongoing effects are understandable at normal play speed; its identity survives
Low graphics and muted audio; its effects end correctly; and its required checks
and measured performance support the change. Report evidence and remaining limits.
