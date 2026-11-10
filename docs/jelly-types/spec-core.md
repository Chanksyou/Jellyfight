# Jelly types: core spec

Every worker on this rework reads this file. It holds the decisions that are final, the words to use, and the numbers shared by all types. Per-type detail is in `types/<type>.md`.

## What changes

1. **A run starts by picking a jelly type.** There are eight: Normal, Fire, Lightning, Ice, Poison, Wind, Glitter, Tentacle. The type sets the base stats and the one attack for the whole run.
2. **Elements stop being Treasures.** Six of them become types (Acid becomes Poison). The start-of-run Element pick, the boss reward's "new Element", the 30 Element upgrade Treasures, the every-3rd-chest upgrade slot, and Power Bank all go.
3. **The tentacle lash stops being a default attack.** Only the Tentacle jelly has it, as its main attack.
4. **One set of attack stats.** Attack damage, Fire rate and Attacks drive every type's attack, tentacles included. Tentacle damage, Tentacle speed and Tentacles stop being stats; Tentacle reach stays.
5. **"Bubble" becomes "attack" in player text.** Bubble damage is Attack damage, Bubble size is Attack size, Bubbles is Attacks, and Treasures say "attacks". Only Normal's own shots are still called bubbles.
6. **After each act's boss: two picks.** First a Legendary-only pick of three, then 1 of 3 Attack upgrades from the type's pool of 12. That's 3 Attack upgrades a run (after acts 1, 2 and 3).
7. **Evolutions become Legendary treasures.** There is no separate evolution pick. A run can take several, and they stack.
8. **A first-time player plays Normal.** The other seven types unlock through easy achievements (`spec-meta.md`).

## The switch

All of this is built behind one switch, `GAME.types`, off for players until release (P11).

- With the switch **off**, the game plays exactly as on main and every existing story passes unchanged.
- It turns on with `?types` in the URL, a toggle in the dev tools, and `fresh({ types: '<id>' })` in stories.
- A run with the switch on before release is a dev run: no score, not in the run log.

## Words

Use these in player text, code comments and content. `GLOSSARY.md` gets each one in the phase that introduces it.

| Word | Meaning |
| --- | --- |
| Jelly type | What the player picks at the start: base stats plus an attack |
| Attack | A type's one automatic attack: bubbles, an Element shot, or tentacle lashes |
| Attack damage, Attack size, Attacks | The stats formerly Bubble damage, Bubble size, Bubbles |
| Attack upgrade | An end-of-act pick from the type's pool; never in a chest |
| Poison | The Poison jelly's status (below). The Clog's acid stays "acid" |
| Bleed | Damage over time from tentacle stings (the `venom` word's player text) |

Never use a word `GLOSSARY.md` lists under _Avoid_ in player text. "Bounce" and "Projectile" are on that list.

## Base stats

Normal is `BASE_STATS` in `src/stats.js`, unchanged. Each other type is written in `content/jellies.kdl` as differences from Normal.

| Jelly | Differences from Normal |
| --- | --- |
| Normal | none |
| Fire | Attack damage 7.5 · Move speed 105% · Health 19 · Fire rate 1.5/s |
| Lightning | Fire rate 2.2/s · Move speed 115% · Attack damage 4.5 · Health 22 |
| Ice | Health 31 · Shield 5 · Attack damage 9 · Fire rate 1.2/s · Move speed 88% · Jump height 90% |
| Poison | Health regen 0.5 every 5 s · Attack size 120% · Health 28 · Attack damage 5 · Range 25 cm |
| Wind | Move speed 120% · Jump height 120% · Range 36 cm · Pierce +1 · Health 20 · Fire rate 1.5/s |
| Glitter | Luck +10 · Attack size 125% · Dodge 5% · Attack damage 4.8 · Fire rate 1.5/s |
| Tentacle | Attack damage 9 · Attacks 3 · Tentacle reach 11 cm · Health 32 · Shield 3 · Move speed 110% |

Normal for reference: Health 25, Shield 0, Health regen 0, Dodge 0%, Luck 0, Move speed 100%, Jump height 100%, Attack damage 6, Fire rate 1.76/s, Range 30 cm, Attack size 100%, Attacks 1, Pierce 0.

Level-up cards stay as they are. Attack size and Attacks are not offered as cards (weight 0, as today).

## Damage budget

Today's Element shots were tuned as a second attack beside bubbles (most hit for 60% of Bubble damage at about one shot a second). As a main attack each fires at the jelly's full Fire rate, so its hit multiplier must be set again.

- **Measure:** damage a second on one ordinary bug at level 1, counting the type's own damage over time on that bug (Burn, Poison at its steady stack count). Arcs and splashes onto other bugs don't count.
- **Normal:** 6 x 1.76 = 10.6.
- **Each ranged type:** between 9 and 12.
- **Tentacle:** about 16 (9 x 1.76), to pay for its short reach.
- **The knob:** one `hit` multiplier per type in `content/jellies.kdl`. Set it by arithmetic, show the arithmetic in the PR, and change nothing else to hit the budget.

These are starting values. The owner tunes after playing (G1) and after the balance runs (G2).

## Defaults for questions the owner left open

Build to these. The owner may overrule any of them before the phase named.

| Question | Default | Phase |
| --- | --- | --- |
| Does Normal get its own 12 upgrades, or borrow? | Its own 12 (`types/normal.md`) | P8n |
| Do Element upgrades keep today's Treasure names? | No, new names. The six tentacle Treasures keep theirs | P6 |
| Do Elite kills for unlocks count across runs? | Yes, across all runs | P10 |
| Can any pair of former evolutions not stack? | No pair is blocked | P9 |
| Do stacked costs add up? | Yes, in full | P9 |
| What happens to the metamorphosis reveal? | It plays when a former evolution is picked | P9 |
| What happens to Power Bank? | Removed | P9 |
| Old scores on the leaderboard? | The owner wipes the board at release | P11 |

## Not changing

Bugs, waves, Elites, bosses, stages, the shop, Pearls, cosmetics, the camera and the level-up cards' numbers. If a phase seems to need a change there, stop and report.
