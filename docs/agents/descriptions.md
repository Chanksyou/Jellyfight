# Writing descriptions

How every player-facing description reads: Treasures (and their levels), Attack upgrades, evolutions, jelly type cards, level-up cards, hints and achievements.
One pattern everywhere means fewer words and nothing to re-learn between screens.
Two effects that do the same thing are written with the same words in the same order; only the numbers differ.

## The pattern

One or two short sentences: **trigger, then effect, then cost, then who it leaves out.** Aim for 15 words or fewer.
The text states what the code does: never change a number to fit a sentence, and when the two disagree, fix the sentence.

## Rules

1. **Triggers are a fixed phrase and a colon.** Use one of these, never a paraphrase:

   | When | Trigger |
   |---|---|
   | On a timer | `Every 6 s:` |
   | Counting attacks | `Every 5th attack:` (in an Attack upgrade, the type's own noun: `Every 5th shot:`) |
   | By chance | `1 in 10 hits:` · `1 in 4 kills:` · `1 in 8 attacks:` |
   | The jelly is hit | `When hit:` |
   | Landing from a jump | `On landing:` |
   | A hit lands | `On a hit:` · `On a hit on a Burning bug:` · `On a Crit:` |
   | A bug dies | `On a kill:` · `Every 10 kills:` · `On an Elite kill:` · `On a Boss kill:` · `When a Burning bug dies:` |
   | A new Level | `On a level-up:` |
   | Shield | `When your Shield breaks:` · `While your Shield is full:` |
   | Low Health | `Below 50% Health:` (always a percent, never "half") |
   | Standing still | `After 1 s standing still:` |
   | Moving | `After 3 s of moving:` · `Every 8 s of moving:` · `Every 2 m swum:` · `At full speed:` |
   | No damage taken | `After 4 s without damage:` |
   | Once | `Once per act:` · `Once per run:` |

   A stat that only holds somewhere can trail instead: `+40% Attack damage in the air.`
   A sentence with no trigger is always on: `Bubbles curve toward the nearest bug.`
2. **Stat changes use the stat's own name (GLOSSARY.md), sign first.** `+40% Attack damage`, `+1 mid-air jump`, `+3 Luck per Treasure found`.
   Not "attacks fire 15% faster" (that is `+15% Fire rate`) or "reach 30% less far" (`-30% Range`).
   Several stats: commas, then `and` before the last.
   A stat that scales reads `+N Stat per <thing>`, never "for each" or "Each <thing>: +N".
   Health regen reads `+0.5 Health every 5 s`, the way the level-up card and the stats panel show it; a heal that is not the stat reads `+N Health a second`.
3. **Damage has three forms, and one verb.**
   - Its own damage, from the Attack damage stat: `hits bugs within 12 cm for 2x Attack damage`. Always `Nx`, below 1 too (`0.5x Attack damage`); never a bare "2x damage", "hard", "stronger" or no number at all.
   - A copy or share of the hit that caused it: `for 60% of the hit`.
   - A change to damage: on your side `+30% damage to bugs within 14 cm`, `Crits do 3x damage`; on a bug you changed `Marked bugs take 30% more damage` (always `N% more`, never "takes 2x").
   The verb is `hits` and `do`: not "stings", "hurts", "burns", "cuts", "slams", "strikes" or "deals". `sting` belongs to the Tentacle jelly's lash, `Burns` (capital) only sets the Burn status, `zaps` only for lightning, and `Blasts` only for a Blast.
4. **Where reads `within N cm`.** Never "nearby", "near", "around you" or "close". A wider or bigger level changes the number.
   Targets read `the nearest bug`, `the N nearest bugs`, `the toughest bug within N cm`, `the biggest crowd`.
5. **How long reads `for N s`, straight after the thing it times.** `an ice puddle for 5 s`, `Stuns them for 0.5 s`, `+40% Fire rate for 8 s`. Not "lasts", "lasting" or "N s long".
6. **Limits come last in their sentence.** A cooldown reads `4 s cooldown.` as its own sentence. A cap reads `, up to +45%.` for a stat, `, up to 5 stacks.` for a status and `, up to 5 at once.` for things on the floor. Give a stacking boost's total, not its stack count. A floor reads `, never under 0.5.`
7. **Costs come after the effect, as their own sentence.** `+50% Attack damage. You take 25% more damage.` · `... -15% max Health.`
8. **Who it leaves out comes last, as its own short sentence.** `Elites and the Boss too.` · `Not Elites or the Boss.` · `Not the Boss.` · `Elites too.`
   Always `Elites and the Boss`: never "Bosses", "the boss" or "everything".
9. **One spelling per unit.** `s`, `cm`, `m`; `2x`, `3x` for multipliers (never "double", "twice", "half", "three times", "seconds").
   Comparisons read `2x as far`, `50% wider`, `20% slower`. A changed rule names the old value: `4 cards, not 3`.
   An amount over time reads `a second`. Chances read `1 in N`, except the Crit chance stat, which is `+5% Crit chance`.
10. **One word per thing.**
    - `bug`, never "enemy"; `kill` and `dies`, never "clear", "finish off" or "falls".
    - Moving a bug: `shoves` (away), `pulls` (in), `throws up` (into the air). Not "push", "knock" or "throw back".
    - Slowing reads `N% slower`. A bug that can't move is `Stunned`, `Frozen` or `Trapped`, whichever the code applies: not "held", "pinned" or "stuck".
    - Statuses as verbs or adjectives: `Burns` / `Burning`, `Chills` / `Chilled`, `Stuns` / `Stunned`, `Poisons` / `Poisoned`, `Frozen`, `Trapped`, `Marks` / `Marked`, `Signalled`, `Bleed`.
    - XP comes as `XP droplets`, never "gems" or "drips".
    - `You can't be hurt for 1 s.` · `You take 25% more damage.` · `You take 1 less damage a hit.`
    - Each jelly type's attack has one noun: bubble (Normal), Fire shot, Lightning shot and its arcs, Ice shard, Poison blob and its burst, Gust, Glitter bomb and its splash, Signal, lash and its sting (Tentacle). `attack` covers them all in a Treasure.
    - Capitalise stats and statuses: Health, max Health, Health regen, Shield, Attack damage, Fire rate, Move speed, Jump height, Range, Attack size, Attacks, Dodge, Luck, Crit, Crit chance, Level, XP, Treasure, Elite, Boss, Stun, Burn, Chill, Frozen, Poison, Bleed, Mark, Trap, Signal, Gust, Blast, Shot, Warning.
11. **Cut filler.** No flavour lead-ins ("Glass cannon:", "Slippery:"), no "this run" (everything lasts the run), no "from everything", "nonstop", "continuously", and no inner limits that rarely matter ("up to 5 times a second").
    The look and the sound carry the flavour.
12. **Levels repeat the same sentence.** Level 2 and 3 reuse level 1's wording and change only numbers, so the card's "Next level" reads like a diff.
13. **A jelly type's card** is one sentence on what its attack does, in the words above, then what it starts with: `Starts with the Jelly Mould Treasure.`

## Examples

| Before | After |
|---|---|
| Every 6 s you lob a bath bomb onto the biggest crowd. It fizzes, then erupts: bugs on it take 2x Attack damage and are thrown into the air, Stunned until they land. | Every 6 s: a bath bomb hits the biggest crowd for 2x Attack damage and throws bugs up, Stunned until they land. |
| Landing from a jump spouts water: +1.5 Health, at most once every 4 s. | On landing: +1.5 Health. 4 s cooldown. |
| Glass cannon: +50% attack damage, but hits take 25% more health. | +50% Attack damage. You take 25% more damage. |
| Every 10 enemies cleared, gain +0.25 Attack damage this run. | Every 10 kills: +0.25 Attack damage. |
| 10% of hits: Crit for 3x damage. | +10% Crit chance. Crits do 3x damage. |
| On landing: a wider, stronger shockwave stings nearby bugs. | On landing: a shockwave hits bugs within 14 cm for 1.5x Attack damage. |
| Every 5 s: zap the 3 nearest bugs for 2x damage. | Every 5 s: zaps the 3 nearest bugs for 2x Attack damage. |
| When hit (8 s cooldown): ... | When hit: ... 8 s cooldown. |
| Chilled bugs, Elites and Bosses take 40% more damage. | Chilled bugs take 40% more damage. Elites and the Boss too. |
| Each kill: +20% Fire rate for 3 s, up to 5 stacks. | On a kill: +20% Fire rate for 3 s, up to +100%. |
| 1 in 4 kills leaves a dust bunny for 6 s. | 1 in 4 kills: a dust bunny for 6 s. |
| Stand still for 1 s: a damp zone heals 5% max Health a second. | After 1 s standing still: +5% max Health a second. |

(The numbers in the After column are examples of the form; the real ones come from the content files.)

Words GLOSSARY.md lists under _Avoid_ (Bounce, Bubbles as a stat, item, chest...) stay out; the story `vocabulary/no-retired-words` checks it.
The story `vocabulary/descriptions-follow-the-formula` fails on the paraphrases these rules name.
