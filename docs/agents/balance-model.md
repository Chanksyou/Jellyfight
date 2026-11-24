# Balance model

How the game's numbers are priced on paper, so a change can be judged before anyone plays it.
`node tools/balance-sheet.mjs` applies this model to the content files and writes the balance sheets to `.wrangler/balance-sheets.html` (`--out=` for elsewhere), with every flag and its knob on stdout.
It reads `content/*.kdl` through the game's own loader (`src/content.js`), `src/stats.js`, the stage files and the run's constants, so the sheets redraw whenever a number changes.
It changes nothing and plays nothing; the balance bot and the clear test (`docs/agents/balance-tools.md`) still measure what paper can't.

## Units

One **point** is 1% of a level 1 Normal jelly.

- **Offence**: damage a second on one bug. A level 1 Normal jelly does 6 x 1.76 = 10.56, so 1 point is 0.106 damage a second.
- **Defence**: Health the jelly can spend in an act. A level 1 Normal jelly has 25 in act 1, so 1 point is 0.25 Health.
- **Levels**: XP in all, run through `xpToNext`, as a fraction (12.4 is level 12 and 40% of the way to 13).

## Offence

```
Offence = Attack damage line x Fire rate line x Attacks share
        x (1 + Crit chance x (Crit mult - 1))      Crit
        x (1 + mark)                               Marks (ordinary bugs only)
        x (1 + status bonus)                       Status bonus
        x (1 + conditional)                        Conditional
        x (1 + Elite damage)                       Elite damage (Elites and Bosses only)
        + gadgets: Attack damage x 1.8 x their multiple / period x targets
        + damage over time: Burn, Poison, Bleed
```

Bonuses on the same line add.
Lines multiply.
Marks and Elite damage never meet: a mark changes only ordinary bugs (`src/enemies.js` returns for an Elite or a Boss first), Elite damage only Elites and Bosses.
A flat stat (Lemon Slice's +2) and a percent (Shot Glass's +50%) are both on the Attack damage line, because `Run.S` adds `base + add + base x pct`.

Each jelly type's attack (`content/jellies.kdl`, `src/bubbles.js` `ELEMENT`):

- one bug: Attack damage x `hit` x Fire rate, plus Fire's Burn (Attack damage x 4.5 x 0.17 a second, lit while hits come faster than its 3 s) and Poison's stacks (all 5 while hits come faster than its 5 s, since each hit restarts them; each 20% of Attack damage a second).
- a clump of 5 adds, on the other four: Lightning's 3 arcs, Glitter's splash, the Poison burst's stacks, Wind's pierce, one sting per extra tentacle.
- a Boss counts as one bug.

**The rule for a new damage bonus:** say which line it joins before picking its number.
A bonus on its own line multiplies every other line, so it is worth more than its number says; a new line needs a reason written next to it.

## Defence

```
Defence = (Health + Shield x refills + Health regen x act seconds + heals)
        / ((1 - Dodge) x damage taken)
```

Act seconds are the night plus the run log's mean Boss fight.
The Shield refills once every 20 s for a careful player and every 60 s for a brawler (assumed, not measured: it needs 5 s clear and 2 s to fill).
Hits are multiplied by the act's `power` before they land, so Defence is compared with the run log's Health lost per act, which already includes it.

## Levels

```
bugs out    = ∫ (rate + grow x t) x act bugs dt        (content/waves.kdl; the alive cap is ignored)
XP on offer = Σ bugs x round(XP x act xpMult)        (+ act 3's wasp nests)
level       = XP in all through xpToNext(L) = round(base x growth^(L-1))
```

This predicts the run log's end-of-act levels to within about half a level.
It leaves out the combo bonus on kill XP (`juice.bonus`) and the alive cap, which roughly cancel against the run log.

## The reference jelly

Items are priced against a reference jelly at five moments: the start, and each Boss door at the run log's mean level there.
The reference jelly is its type's starting stats plus an average card for each level: each card by its weight, each rarity by its odds, applied with `applyCard`.
It holds no Treasures.
The run log's real Boss damage a second (Boss Health over the mean fight time) divided by the reference jelly's is what Treasures, upgrades and evolutions add by that door.

## Budgets

Starting values from the balance plan, to be argued with:

| Source | Budget |
|---|---|
| Level-up card, Common / Rare / Epic | 12 / 18 / 24 points (Fire rate's own cards) |
| Common Treasure | 15 per copy, 60 at full stack |
| Rare Treasure | 25 per copy |
| Epic Treasure | 40 |
| Legendary Treasure or evolution | 70, and a cost worth at least 20 |
| Attack upgrade | 40 |

## Measured numbers

The only numbers typed into the tool are `RUN_LOG` in `tools/balance-sheet.mjs`: levels, Treasures held, Boss fight times, Health lost and bugs cleared per act, from the run log (D1 `run_summaries`).
Update them, with the date range, when the run log grows.

## Sheets

Each sheet has the same parts: the numbers it reads (each with its file and line), the model, charts, flags, and one knob per flag (a value, where it lives, and what changing it would do).
A knob is a suggestion; nothing changes until the owner picks it.

- S0: the yardstick (units, moments, the reference jelly).
- A1: the eight attacks. A2: XP and levels. A3: level-up cards. A4: the multiplier lines. A5: staying alive.
- B1: chests and rarity odds. B2: stat Treasures. B3: gadget Treasures. B4: growing and economy Treasures. B5: Attack upgrades. B6: Legendary Treasures and evolutions. B7: status effects.
- C1: bugs. C2: waves and act knobs.
- D1: score. D2: first run and Easy.

## What you pick up (Wave B)

A pick is priced by running the game's own `compileMods` (`src/content.js`) with it and without it on the reference jelly, so a word the game reads is read the same way here.
Points are the percent of the reference jelly's Offence plus the percent of its Defence at that moment, which is the 1% of a level 1 Normal jelly at the Start.
Stats apply as `Run.S` does (`withMods`); Crit, marks and status bonuses count as in A4, always on.
Gadgets (timed effects, orbiting lights, a beam, an aura) are paper damage a second: Attack damage x 1.8 x the word's multiple x bugs reached / seconds between uses.
A hit rate is not on paper: B3 says so, and the clear test measures it one Treasure at a time, on request.
Words with no number on paper (a trail, a rebirth, a decoy, `element-up`) are listed as not priced, and a pick with any is never flagged for being weak.
Growing Treasures (B4) read what an act brings from the night model and the run log: bugs killed, levels gained, picks found, seconds and metres swum.
Chest odds (B1) are the game's own `rollTreasures` run on a fixed seed.
Elites and Bosses take no control status (`src/enemies.js` returns for them first), so B7 counts control as attack time taken from ordinary bugs only.

Assumptions the files can't give are in `ASSUME` in `tools/balance-sheet.mjs`, each with its reason: how many bugs an area hit reaches, how much of a fight each `while` holds, how much of the time the jelly swims, and how long a Chore List target takes to clear.
They are guesses until play measures them, so a flag that rests on one says so.

Budgets from the balance plan (points a pick should be worth): Common 15 a copy, Rare 25, Epic 40, Legendary 70 (and a cost worth at least 20), Attack upgrade 40.

`tests/balance-sheet.test.mjs` (run by `node tests/check.mjs`) checks the model reproduces the damage each type's note in `content/jellies.kdl` works out by hand, and that every number and knob cites a line that exists.

## What fights back (Wave C)

A bug's attack is read from its words in `content/enemies.kdl`: damage a hit, seconds between hits (its `every`, or wind-up plus rest), and the wind-up as its warning; a bug with no attack word touches about once a second (`ASSUME.contact`).
The night's pressure (C2) is Health arriving a second against the reference jelly's Offence, with the jelly levelling on the XP that arrives; it reproduces the run log's end-of-act levels to within a level.

## What wraps it (Wave D)

The score (D1) prices each part of `src/score.js` for the run log's mean cleared act, and splits a run into finishing parts (night, Boss damage, Boss beaten) and skill parts (Elites, bugs, clean play, pace).
The run log has means only, so a part that pays everyone the same shows up here, but how far players spread around it needs the per-run rows.
First run and Easy (D2) sizes what a first-timer's jelly can spend in act 1 against what a cleared act costs, and what Easy's x2 dealt and x0.5 taken do on paper.
