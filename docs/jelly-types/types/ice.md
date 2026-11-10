# Ice jelly

Built in **P8a**. Slow tank.

## Base stats (differences from Normal)

Health 31 · Shield 5 · Attack damage 9 · Fire rate 1.2/s · Move speed 88% · Jump height 90%

Write these as `stat` lines in `content/jellies.kdl`. Player text says Attack damage and Attack size; the stat keys in code keep their names.

## Attack

Today's Ice shard (`ELEMENT_BASE.ice`) becomes the main attack: slow-flying shards. A hit Chills for 2 s: the bug moves at 55% speed, and a re-hit refreshes it.

As the main attack it fires at the jelly's full Fire rate. Set its hit multiplier (`hit` on the jelly in `content/jellies.kdl`) so the type lands inside the damage budget in `spec-core.md`, and report the arithmetic in the PR.

## Look

Core: pale blue crystal. Tentacles: frost on the tips. Particles: cold mist sinking to the floor.

Pieces go on top of the player's own jelly and never change it (`src/adornments.js` pattern). The core is an emissive material, not a light. Particles go through `src/batch.js`.

## Unlock

Defeat 3 Elites.

## Attack upgrades (pool of 12)

This type owns: Control and defence: slows, Freeze, Shield. Don't borrow another type's family.

Verdict: **E** = existing words say it. **P** = one new prop on an existing word. **N** = a new word (with its own story). *shared* words come from P3 and already exist.

| Upgrade | What it does | Verdict | How to say it |
| --- | --- | --- | --- |
| Permafrost | 3 Chilled hits on one bug Freeze it solid for 1.5 s | N | `chill-to-freeze hits time` |
| Brittle | Chilled bugs take +40% damage from everything | N | `status-damage` *shared* |
| Shatter Shards | Frozen or Chilled kills burst into 4 shards that hit nearby bugs | N | `on-kill-of` *shared* + new `shards` effect |
| Cold Snap | Every 6 s, a frost ring Chills everything within 15 cm | E | `every 6 { ring 0.15 slow=2 }` |
| Glacier Shell | Your Shield refills twice as fast while a Chilled bug is within 15 cm | P | `shield-recharge` + `while` condition "chilled bug near" |
| Icicle Lance | Shards pierce every Chilled bug in their path | P | `element-up ice pierceStatus="chill"` |
| Frostbite | Chill also deals 20% of the hit's damage each second | P | `element-up ice frostbite=0.2` |
| Hoarfrost | Chilled bugs can't jump, fly up or climb | N | `ground-lock status` (no jumping, flying up or climbing) |
| Snowball | Shards pierce 2 bugs and grow 10% bigger with each | P | `element-up ice pierce=2 grow=0.1` |
| Deep Freeze | The next hit on a Frozen bug does 3x and thaws it | N | `status-damage` *shared* `thaw=#true` (generalise today's Shatter) |
| Cryo Sleep | When your Shield breaks, you freeze solid and take no damage for 1 s | P | `shield-burst` + `invuln` prop |
| Avalanche | A hit Frozen bug slides away and Chills whatever it hits | N | `slide-on-hit` |

Tally: 1 existing, 5 new props, 6 new words (some shared).

The numbers are starting values reasoned from the code, not measured. Keep them unless the arithmetic is plainly broken; list doubts in the PR instead of tuning.
