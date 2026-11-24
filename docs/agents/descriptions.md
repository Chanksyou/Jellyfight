# Writing descriptions

How every player-facing description reads: Treasures (and their levels), Attack upgrades, evolutions, jelly type blurbs, level-up cards and tips.
One pattern everywhere means fewer words and nothing to re-learn between screens.

## The pattern

One or two short sentences: **trigger, then effect, then cost.** Aim for 15 words or fewer.

## Rules

1. **Triggers are a fixed phrase and a colon.** Use one of these, never a paraphrase:
   `Every 6 s:` · `Every 5th attack:` · `1 in 10 hits:` / `1 in 4 kills:` · `When hit:` · `On landing:` · `On a kill:` · `When your Shield breaks:` · `Below half Health:` · `While your Shield is full:` · `Once per act:` · `Once per run:`.
   A stat that only holds somewhere can trail instead: `+40% Attack damage in the air.`
2. **Stat changes use the stat's own name (GLOSSARY.md), sign first.** `+40% Attack damage`, `+1 mid-air jump`, `+3 Luck per Treasure found`.
   Not "attacks fire 15% faster" (that is `+15% Fire rate`) or "reach 30% less far" (`-30% Range`).
3. **Costs come last, as their own sentence.** `+50% Attack damage. You take 25% more damage.` · `... -15% max Health.`
4. **One spelling per unit.** `s`, `cm`, `m`; `2x`, `3x` for multipliers (never "double", "twice", "three times", "seconds").
   A cooldown reads `4 s cooldown`; an amount over time reads `a second`. Chances read `1 in N`.
5. **One word per thing.** `bug`, never "enemy"; name `Elites and the Boss` when they are in or out.
   `kill`, never "clear" or "finish off". Vulnerability reads `take N% more damage`.
   Capitalise stats and statuses: Health, max Health, Shield, Attack damage, Fire rate, Move speed, Range, Attack size, Dodge, Luck, Level, Treasure, Stun, Burn, Chill, Frozen, Poison, Bleed, Crit, Trap, Gust, Blast, Shot.
6. **Cut filler.** No flavour lead-ins ("Glass cannon:", "Slippery:"), no "this run" (everything lasts the run), no "from everything", "nonstop", "continuously", and no inner limits that rarely matter ("up to 5 times a second").
   The look and the sound carry the flavour.
7. **Levels repeat the same sentence.** Level 2 and 3 reuse level 1's wording and change only numbers or one adjective, so the card's "Next level" reads like a diff.

## Examples

| Before | After |
|---|---|
| Every 6 s you lob a bath bomb onto the biggest crowd. It fizzes, then erupts: bugs on it take 2x Attack damage and are thrown into the air, Stunned until they land. | Every 6 s: a bath bomb hits the biggest crowd for 2x Attack damage and throws bugs up, Stunned until they land. |
| Landing from a jump spouts water: +1.5 Health, at most once every 4 s. | On landing: +1.5 Health. 4 s cooldown. |
| Glass cannon: +50% attack damage, but hits take 25% more health. | +50% Attack damage. You take 25% more damage. |
| Every 10 enemies cleared, gain +0.25 Attack damage this run. | Every 10 kills: +0.25 Attack damage. |

Words GLOSSARY.md lists under _Avoid_ (Bounce, Bubbles as a stat, item, chest...) stay out; the story `vocabulary/no-retired-words` checks it.
