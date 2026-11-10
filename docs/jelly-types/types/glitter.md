# Glitter jelly

Built in **P8e**. Crowds and luck.

## Base stats (differences from Normal)

Luck +10 · Attack size 125% · Dodge 5% · Attack damage 4.8 · Fire rate 1.5/s

Write these as `stat` lines in `content/jellies.kdl`. Player text says Attack damage and Attack size; the stat keys in code keep their names.

## Attack

Today's Glitter bomb (`ELEMENT_BASE.glitter`) becomes the main attack: slow bombs that burst in an 8 cm **sphere**, splashing every other bug inside for 40%, flying bugs included. The hit check is already 3D (`splash` in `src/bubbles.js`); what changes is the look and the aim. Show the burst as a ball of sparkle the size of the real hit area (`fx.volume`, `docs/adr/0001-warnings-show-volume.md`), not a floor ring, and let bombs target flying bugs.

As the main attack it fires at the jelly's full Fire rate. Set its hit multiplier (`hit` on the jelly in `content/jellies.kdl`) so the type lands inside the damage budget in `spec-core.md`, and report the arithmetic in the PR.

## Look

Core: rainbow shimmer. Tentacles: sparkling tips. Particles: twinkles on the bell.

Pieces go on top of the player's own jelly and never change it (`src/adornments.js` pattern). The core is an emissive material, not a light. Particles go through `src/batch.js`.

## Unlock

Defeat 6 Elites.

## Attack upgrades (pool of 12)

This type owns: Chance: Luck, Crits, random effects, XP. Don't borrow another type's family.

Verdict: **E** = existing words say it. **P** = one new prop on an existing word. **N** = a new word (with its own story). *shared* words come from P3 and already exist.

| Upgrade | What it does | Verdict | How to say it |
| --- | --- | --- | --- |
| Prism | Each splash fires 3 small rainbow shots at the nearest bugs | P | `echo-bubble`-style `from="splash" count=3` |
| Rainbow | Each bomb rolls a colour: red Burns, blue Chills, yellow Stuns, briefly | N | `random-status statuses time` |
| Lucky Sparkle | 15% chance a splash Crits for 3x | P | `crit by="splash"` (new scope) |
| Confetti Pop | Bugs killed by a splash pop into confetti that splashes again at half damage | N | `on-kill-of` *shared* `by="splash"` + splash |
| Midas Touch | 1 in 20 splashed bugs turns to gold: frozen stiff and shining for 3 s, then it bursts into a shower of 5 small glitter bombs | N | `gild chance time bombs` |
| Disco Bomb | Every 8 s, the next bomb splashes 3x as wide | P | `every 8 { next-attack width=3 }` (shares next-shot word) |
| Mirror Glitter | Splash reflects off walls once | N | `splash-reflect` |
| Wish | Once per act, a splash that kills 10 bugs gives a free level-up card | N | `wish kills` (once per act, free level-up card) |
| Jackpot | 1 in 100 kills drops a big XP gem worth a whole level | P | `crumb-on-kill` + `xp` drop kind |
| Hot Streak | A splash that kills 3 or more bugs makes the next bomb 50% bigger, stacking until a splash kills fewer | N | `stack-buff` *shared* (event big-splash) |
| Party Popper | A random bomb in 10 is giant, splashing for 3x damage | N | `nth-attack` *shared* `random=#true` |
| Star Burst | A splash that hits 5 or more bugs fires a star shot at each | N | `splash-shots min` |

Tally: 0 existing, 4 new props, 8 new words (some shared).

The numbers are starting values reasoned from the code, not measured. Keep them unless the arithmetic is plainly broken; list doubts in the PR instead of tuning.
