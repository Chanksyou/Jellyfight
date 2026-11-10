# Tentacle jelly

Attack and look built in **P4**, upgrade pool in **P7**. Melee bruiser. No ranged attack at all.

## Base stats (differences from Normal)

Attack damage 9 · Attacks 3 · Tentacle reach 11 cm · Health 32 · Shield 3 · Move speed 110% · Fire rate 1.76/s (unchanged)

Write these as `stat` lines in `content/jellies.kdl`. Player text says Attack damage and Attack size; the stat keys in code keep their names.

## Attack

The lash (`src/combat.js`, `src/tentacles.js`) becomes the main attack. Every 1/Fire rate seconds, up to `Attacks` tentacles each strike a different bug within Tentacle reach for Attack damage. No bubbles. Range, Attack size and Pierce do nothing for this type, so level-up cards and Treasures for those three are not offered to it. Budget: about 16 damage a second on one bug (1.5x Normal), up to about 48 on a crowd in reach.

## Look

Core: none. Tentacles: longer, thicker, barbed, so the type reads from far away. Particles: none.

Pieces go on top of the player's own jelly and never change it (`src/adornments.js` pattern). The core is an emissive material, not a light. Particles go through `src/batch.js`.

## Unlock

Finish act 4 (win a run).

## Attack upgrades (pool of 12)

This type owns: Close range: grabs, retaliation, standing your ground. Don't borrow another type's family.

Verdict: **E** = existing words say it. **P** = one new prop on an existing word. **N** = a new word (with its own story). *shared* words come from P3 and already exist.

| Upgrade | What it does | Verdict | How to say it |
| --- | --- | --- | --- |
| Stinging Nettle | Stings stack Bleed: 25% of Attack damage a second for 3 s, up to 5 stacks | E | `venom` word renamed in text to Bleed (stacks 5, time 3) |
| Tape Measure | +60% Tentacle reach, and every 2 s a tentacle shoots out up to 30 cm, grabs the toughest bug and reels it in, slamming it for 3x damage and hitting every bug it's dragged through | N | `stat tentacle-reach 60 percent=#true` + new `grab every range dmg` |
| Spaghetti Strand | Every 4th lash hits every bug in reach at once | N | `nth-attack` *shared* + `lash all=#true` |
| Toaster Cord | When a bug hits you, every tentacle lashes back at everything in reach for 2x damage | P | `when-hit { lash all=#true dmg=2 }` |
| Chopsticks | Each kill gives +10% Fire rate for 3 s, up to 5 stacks | N | `stack-buff` *shared* (event kill, Fire rate) |
| Paperclip Chain | Each sting jumps on to a second bug in reach for 60% damage | P | `echo-bubble`-style for stings `by="tentacles"` |
| Whip Crack | Stings at the very edge of your reach do 2x | N | `reach-sweetspot edge mult` |
| Anchor | After 1 s standing still, +50% Attack damage | E | `while when="rooted" { stat bubble-damage 50 percent=#true }` |
| Ink Cloud | When hit, you squirt ink: nearby bugs miss you half the time for 2 s | N | `when-hit { ink time miss }` (new effect) |
| Venom Sac | Every 20 stings, your next lash hits every bug in reach and gives each 3 Bleed stacks | N | `sting-count every=20 { lash all=#true }` + 3 Bleed stacks (counts stings, not attacks) |
| Coil | A bug stung 5 times within 2 s is held in place for 1 s | P | `pin` after `hits` within `time` (pin status exists) |
| Bell Pulse | Every 3 s, your tentacles flare out to twice their reach for one lash | N | `every 3 { reach-flare mult }` (new timed effect) |

Tally: 2 existing, 3 new props, 7 new words (some shared).

The numbers are starting values reasoned from the code, not measured. Keep them unless the arithmetic is plainly broken; list doubts in the PR instead of tuning.
