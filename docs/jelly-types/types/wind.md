# Wind jelly

Built in **P8d**. Kiter.

## Base stats (differences from Normal)

Move speed 120% · Jump height 120% · Range 36 cm · Pierce +1 · Health 20 · Fire rate 1.5/s

Write these as `stat` lines in `content/jellies.kdl`. Player text says Attack damage and Attack size; the stat keys in code keep their names.

## Attack

Today's Wind gust (`ELEMENT_BASE.wind`) becomes the main attack: fast gusts with a 0.28 s wind-up that pierce and push bugs back. A bug slammed into scenery takes the hit again.

As the main attack it fires at the jelly's full Fire rate. Set its hit multiplier (`hit` on the jelly in `content/jellies.kdl`) so the type lands inside the damage budget in `spec-core.md`, and report the arithmetic in the PR.

## Look

Core: spinning white swirl. Tentacles: stream back as if in a breeze. Particles: air streaks circling the bell.

Pieces go on top of the player's own jelly and never change it (`src/adornments.js` pattern). The core is an emissive material, not a light. Particles go through `src/batch.js`.

## Unlock

Defeat 9 Elites.

## Attack upgrades (pool of 12)

This type owns: Movement: pushes, Dodge, jumps and landings. Don't borrow another type's family.

Verdict: **E** = existing words say it. **P** = one new prop on an existing word. **N** = a new word (with its own story). *shared* words come from P3 and already exist.

| Upgrade | What it does | Verdict | How to say it |
| --- | --- | --- | --- |
| Cyclone | Every few seconds a gust becomes a small whirlwind that pulls bugs together | N | `every 5 { whirl }`: the existing `every` word + a new `whirl` timed effect that pulls bugs in |
| Bowling | A pushed bug knocks over every bug it hits, for the same damage | N | `pushed-hits` |
| Tailwind | Each gust that hits gives +30% Move speed for 2 s | N | `stack-buff` *shared* (event hit, move speed) |
| Updraft | Landing from a jump blasts a gust ring that pushes everything within 12 cm | P | `landing-shockwave` + `push` prop |
| Gale | Gusts pierce every bug in their path; damage drops 20% per bug | P | `element-up wind pierce=99 falloff=0.2` |
| Slipstream | +20% Dodge while moving at full speed | N | `while when="moving"` *shared* `stat dodge 20` |
| Crosswind | Each gust fires a second one at an angle | P | `element-up wind count=1 angle=30` |
| Eye of the Storm | Every 2 s, bugs within 6 cm are pushed away from you | E | `every 2 { ring 0.06 push=0.04 }` |
| Slam Dunk | A bug slammed into furniture takes 3x instead of the hit again | E | `element-up wind collision=3` |
| Second Wind | Once per act, at low Health, a gust ring throws everything back and you get +50% Move speed for 5 s | P | `when-hit` + `once-per-act` and `low-health` props `{ ring; dash }` |
| Jet Stream | Gusts fly 50% faster and farther | E | `element-up wind speed=1.5 range=1.5` |
| Glide | Hold jump in the air to drift down slowly; gusts fired while drifting push twice as far | N | `glide fall push` (needs input: hold jump in the air) |

Tally: 3 existing, 4 new props, 5 new words (some shared).

The numbers are starting values reasoned from the code, not measured. Keep them unless the arithmetic is plainly broken; list doubts in the PR instead of tuning.
