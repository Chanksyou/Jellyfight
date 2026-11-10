# Normal jelly

Attack built in **P4**, upgrade pool in **P8n**. All-rounder. Exactly today's jelly, minus the default tentacle.

## Base stats (differences from Normal)

None: Normal is `BASE_STATS` as it stands (Health 25, Attack damage 6, Fire rate 1.76/s, Range 30 cm, Attack size 100%, Attacks 1, Move speed 100%).

Write these as `stat` lines in `content/jellies.kdl`. Player text says Attack damage and Attack size; the stat keys in code keep their names.

## Attack

Plain bubbles, as today (`src/bubbles.js`). No tentacle lash.

## Look

Core: none. Tentacles: plain. Particles: none. This is the clean look.

Pieces go on top of the player's own jelly and never change it (`src/adornments.js` pattern). The core is an emissive material, not a light. Particles go through `src/batch.js`.

## Unlock

Always open. A first-time player can only pick this.

## Attack upgrades (pool of 12)

This type owns: Bubble physics: splitting, ricochets, homing, wobbling, more bubbles. Don't borrow another type's family.

Verdict: **E** = existing words say it. **P** = one new prop on an existing word. **N** = a new word (with its own story). *shared* words come from P3 and already exist.

| Upgrade | What it does | Verdict | How to say it |
| --- | --- | --- | --- |
| Double Bubble | +1 Attack side by side, with no damage penalty | P | `stat bubbles 1` + new `no-penalty` prop on bubble share |
| Popcorn | A popped bubble splits into 3 small ones at 30% damage | N | `split-on-pop count speed dmg` |
| Bubble Trap | 1 in 8 bubbles traps a small bug inside, floating it helpless for 1.5 s | N | `trap-on-hit chance time` (reuses pin status) |
| Big Bubble | Attack size and splash +50% | E | `stat bubble-size 50 percent=#true` |
| Homing | Bubbles curve toward the nearest bug | N | `homing turn` |
| Pop Chain | A bubble popping next to another bubble pops it too, for 50% | N | `pop-chain dmg` |
| Wobble | Bubbles zigzag in a wide wobble, brushing more bugs on the way | N | `wobble width` |
| Ricochet | Bubbles that hit a wall ricochet off it once | P | `rebound walls-only=#true times=1` |
| Bubble Chain | A bubble that kills flies on to the next bug | P | `echo-bubble on="kill"` |
| Rapid Pop | Each hit in a row on the same bug does 10% more, up to +50% | N | `focus-ramp step most` |
| Big Finish | A bubble that reaches the end of its Range pops in a 2x splash | N | `range-pop splash` |
| Orbit | Bubbles that miss circle you once, hitting bugs they touch | N | `orbit-misses` |

Tally: 1 existing, 3 new props, 8 new words (some shared).

The numbers are starting values reasoned from the code, not measured. Keep them unless the arithmetic is plainly broken; list doubts in the PR instead of tuning.
