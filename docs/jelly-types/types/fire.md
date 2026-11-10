# Fire jelly

Attack and look built in **P4**, upgrade pool in **P6**. Glass cannon.

## Base stats (differences from Normal)

Attack damage 7.5 · Move speed 105% · Health 19 · Fire rate 1.5/s

Write these as `stat` lines in `content/jellies.kdl`. Player text says Attack damage and Attack size; the stat keys in code keep their names.

## Attack

Today's Fire shot (`element "fire"`, `ELEMENT_BASE.fire`) becomes the main attack. A hit sets Burn: 77% of Attack damage a second for 3 s, and a re-hit restarts it. A burning bug that dies lights everything within 6 cm.

As the main attack it fires at the jelly's full Fire rate. Set its hit multiplier (`hit` on the jelly in `content/jellies.kdl`) so the type lands inside the damage budget in `spec-core.md`, and report the arithmetic in the PR.

## Look

Core: flickering orange ember. Tentacles: tips glow like coals. Particles: sparks drifting up.

Pieces go on top of the player's own jelly and never change it (`src/adornments.js` pattern). The core is an emissive material, not a light. Particles go through `src/batch.js`.

## Unlock

Finish act 1.

## Attack upgrades (pool of 12)

This type owns: Escalation and risk: Burn that grows and spreads, bonuses at low Health. Don't borrow another type's family.

Verdict: **E** = existing words say it. **P** = one new prop on an existing word. **N** = a new word (with its own story). *shared* words come from P3 and already exist.

| Upgrade | What it does | Verdict | How to say it |
| --- | --- | --- | --- |
| Flashpoint | A hit on a burning bug bursts in a small Blast, 50% of the hit to everything within 4 cm | P | `status-damage` *shared* + `burst-on-kill`-style burst prop |
| Slow Burn | Burn stacks up to 3 times on one bug, and lasts 6 s | P | `element-up fire burnStacks=3 burnTime=3` |
| Fire Breath | Your shots become a short flame cone every few seconds, setting everything in it alight | N | `every 4 { cone }`: the existing `every` word + a new `cone` timed effect that sets Burn |
| Wildfire | Burning kills spread fire twice as far, and the spread fire can spread again | P | `element-up fire spread=2 respread=#true` |
| Hot Head | Below half Health, Burn does double damage | P | `while when="low-health"` on an element prop |
| Stoke | Each second a bug keeps burning, its Burn grows 20% | N | `burn-ramp step` |
| Inferno | A bug with 3 Burn stacks erupts in a ring of fire | N | `on-kill-of` *shared* (at 3 stacks) + `ring` |
| Backdraft | 5 burning kills within 3 s release a fire Blast around you | N | `streak kills within { ring }` |
| Fuel | Each burning bug nearby gives +5% Fire rate, up to +25% | P | `stack-buff` *shared* (event burning-nearby) |
| Blue Flame | Burn does +50%, but you take 10% more damage | E | `element-up fire burn=1.5` + `damage-taken 1.1` |
| Flare Up | Hitting a burning bug refreshes the Burn on every burning bug | N | `refresh-all status` |
| Melt | Burning Elites and the boss take +20% damage | N | `status-damage` *shared* `elites=#true` |

Tally: 1 existing, 5 new props, 6 new words (some shared).

The numbers are starting values reasoned from the code, not measured. Keep them unless the arithmetic is plainly broken; list doubts in the PR instead of tuning.
