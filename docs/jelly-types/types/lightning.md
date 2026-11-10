# Lightning jelly

Built in **P8b**. Fast and twitchy.

## Base stats (differences from Normal)

Fire rate 2.2/s · Move speed 115% · Attack damage 4.5 · Health 22

Write these as `stat` lines in `content/jellies.kdl`. Player text says Attack damage and Attack size; the stat keys in code keep their names.

## Attack

Today's Lightning shot (`ELEMENT_BASE.lightning`) becomes the main attack. A hit arcs to 3 more bugs within 16 cm for 41% each, and Stuns the arc targets (not the first bug) for 0.5 s.

As the main attack it fires at the jelly's full Fire rate. Set its hit multiplier (`hit` on the jelly in `content/jellies.kdl`) so the type lands inside the damage budget in `spec-core.md`, and report the arithmetic in the PR.

## Look

Core: crackling blue-white. Tentacles: a small arc jumps between two tips every few seconds. Particles: faint static flecks.

Pieces go on top of the player's own jelly and never change it (`src/adornments.js` pattern). The core is an emissive material, not a light. Particles go through `src/batch.js`.

## Unlock

Finish act 2.

## Attack upgrades (pool of 12)

This type owns: Chains and charge-ups: arcs, every Nth shot, stored power. Don't borrow another type's family.

Verdict: **E** = existing words say it. **P** = one new prop on an existing word. **N** = a new word (with its own story). *shared* words come from P3 and already exist.

| Upgrade | What it does | Verdict | How to say it |
| --- | --- | --- | --- |
| Overcharge | Every 5th shot is a big bolt: arcs hit twice and jump twice as far | N | `nth-attack` *shared* + element props |
| Conductor | Arcs can jump back to bugs already hit, up to 6 jumps | P | `element-up lightning revisit=#true chain=3` |
| Static Skin | Bugs that touch you are zapped and Stunned for 1 s, once every 2 s each | P | `touch-sting` + `stun` prop and per-bug cooldown |
| Storm Cell | Stand still for 2 s to charge; your next shot strikes every bug within 20 cm | N | `charge-while-rooted time { zap }` |
| Thunderclap | Stunned bugs take +50% damage from everything | N | `status-damage` *shared* |
| Ball Lightning | Every 6 s, a slow orb drifts out and zaps every bug it passes | N | `every 6 { orb speed dmg }` (new timed effect) |
| Chain Reaction | A Stunned bug that dies sends arcs to 2 more | N | `on-kill-of` *shared* + `zap` |
| Lightning Rod | Arcs jump to Stunned bugs first, for +30% damage | P | `element-up lightning prefer="stunned"` + `status-damage` |
| Overload | Every 10 s, your next shot strikes the toughest bug nearby for 5x | P | `every 10 { zap target="toughest" dmg=5 }` |
| Static Charge | After 3 s of moving, your next shot arcs to 3 more bugs | N | `while when="moving"` *shared* + next-shot word |
| Surge | Each arc gives +2% Fire rate for 3 s, up to +20% | N | `stack-buff` *shared* (event arc) |
| Grounded | Arcs can jump to Elites and the boss for full damage | P | `element-up lightning elites=#true` |

Tally: 0 existing, 5 new props, 7 new words (some shared).

The numbers are starting values reasoned from the code, not measured. Keep them unless the arithmetic is plainly broken; list doubts in the PR instead of tuning.
