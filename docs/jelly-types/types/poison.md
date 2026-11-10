# Poison jelly

Built in **P8c**. Attrition. Replaces today's Acid Element entirely.

## Base stats (differences from Normal)

Health regen 0.5 every 5 s · Attack size 120% · Health 28 · Attack damage 5 · Range 25 cm

Write these as `stat` lines in `content/jellies.kdl`. Player text says Attack damage and Attack size; the stat keys in code keep their names.

## Attack

A blob that hits the first bug for Attack damage, then bursts in a 5 cm **sphere** (flying bugs included). The burst does no damage itself: it adds 1 Poison stack to every bug it touches. **Poison:** each stack does 20% of Attack damage a second for 5 s, up to 5 stacks, and a new stack refreshes the time. Poisoned bugs also deal 20% less damage (any number of stacks). Elites and the boss take the Poison damage but not the weakening. No puddles anywhere: remove the puddle code path for this type. Poisoned bugs bubble and drip green while it lasts. Colour: a cool friendly green, never the Clog's violet (rule 3).

As the main attack it fires at the jelly's full Fire rate. Set its hit multiplier (`hit` on the jelly in `content/jellies.kdl`) so the type lands inside the damage budget in `spec-core.md`, and report the arithmetic in the PR.

## Look

Core: pale green with rising toxic bubbles. Tentacles: tips drip. Particles: green drips falling from the bell.

Pieces go on top of the player's own jelly and never change it (`src/adornments.js` pattern). The core is an emissive material, not a light. Particles go through `src/batch.js`.

## Unlock

Finish act 3.

## Attack upgrades (pool of 12)

This type owns: Poison: stacks, weakening, spreading Poison, healing from Poisoned kills. Don't borrow another type's family.

Verdict: **E** = existing words say it. **P** = one new prop on an existing word. **N** = a new word (with its own story). *shared* words come from P3 and already exist.

| Upgrade | What it does | Verdict | How to say it |
| --- | --- | --- | --- |
| Wither | Each Poison stack also makes the bug take +6% damage from everything | P | `poison` + `per-stack-damage` prop |
| Lingering Dose | Poison lasts twice as long | E | `element-up poison poisonTime=2` |
| Overdose | Poison stacks up to 10 instead of 5 | E | `element-up poison stacks=10` |
| Splatter | The burst is 50% wider | E | `element-up poison width=1.5` |
| Venom Strike | The blob's direct hit does +20% for each Poison stack on the bug | P | `status-damage` *shared* `per-stack=0.2 by="direct"` |
| Waste Away | Poisoned bugs also lose 1% of their max Health a second, Elites too | N | `percent-dot status share` |
| Toxic Cloud | A Poisoned bug that dies releases a gas cloud that Poisons everything inside for 3 s | N | `on-kill-of` *shared* + new `cloud` effect |
| Burst Sac | A Poisoned bug that dies bursts, passing its stacks to bugs around it | N | `on-kill-of` *shared* + pass stacks |
| Leech | Heal 1 Health for each Poisoned kill, up to 3 a second | N | `on-kill-of` *shared* + heal (cap per second) |
| Contagion | A bug that touches a Poisoned bug gets 1 stack too | N | `spread-on-touch status` |
| Poison Rain | Every 8 s, 4 blobs fall on bugs around you | P | `every 8 { blob count=4 }` (blob = the Poison attack as a timed effect) |
| Split Blob | After its first hit, the blob splits in two, and each half flies on and bursts | N | `split-on-hit count` (shares code with Popcorn) |

Tally: 3 existing, 3 new props, 6 new words (some shared).

The numbers are starting values reasoned from the code, not measured. Keep them unless the arithmetic is plainly broken; list doubts in the PR instead of tuning.
