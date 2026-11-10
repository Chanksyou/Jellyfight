# Jelly types: one Legendary pool

Built in P9. After the rework, the boss's Legendary pick draws from one pool of 19, and they should all sit at a similar power level.

## The pool

| From | Legendaries |
| --- | --- |
| Already Legendary (9) | Game Die, Notebook, Hand Mirror, Snooze Button, Disco Ball, Bubble Bath, Hot Water Bottle, Cat Toy Mouse, Pot Lid |
| Former evolutions (10) | Cinder Jelly, Rebound Jelly, Mirage Jelly, Aegis Jelly, Box Jelly, Man o' War, Immortal Jelly, Moon Jelly, Lion's Mane, Upside-down Jelly |
| Leaving | The six Elements (now jelly types) and Power Bank |

## Rules

1. **Evolutions move into `content/treasures.kdl`** as `rarity="legendary"`, keeping their words, their costs and their `adorn` pieces. `content/evolutions.kdl` and the separate evolution pick go.
2. **They stack.** A run can hold several. Costs add up in full. No pair is blocked.
3. **Several `adorn` pieces at once must still read** on a phone and stay cheap to draw. Check halo + mane + sail + moon ring together, with a type's core showing.
4. **The metamorphosis reveal** (`src/evolution-reveal.js`) plays when a former evolution is picked.
5. **Every Legendary must do something for every jelly type,** or be offered only to the types it works for. Add a `types=` list to the treasure rather than branching on an id. Known cases:
   - **Rebound Jelly** only moves bubbles and shots: not offered to Tentacle.
   - **Box Jelly** gives tentacles to a type that has none. For a ranged type that is a second, close-range attack; for the Tentacle jelly it adds to Attacks and reach. Keep it for all types and measure both.
   - **Upside-down Jelly, Man o' War, Rebound:** their text says "bubbles". Reword to "attacks".
   - **Bubble Bath, Disco Ball:** check each against the Tentacle jelly.
6. **Immortal Jelly** keeps Health regen until its first revive, then none for the run. Don't change that.

## Measuring

Report one table for all 19: Legendary, kind (damage / survival / utility), number, gap from the median.

- **Damage:** `node tests/clear.mjs <id>` with paired controls and several scenarios, and `node tests/matchup.mjs` for large targets and clumps (`docs/agents/balance-tools.md`). These quick checks need no permission.
- **Survival and utility** (Hand Mirror, Pot Lid, Immortal, Mirage, Aegis, Game Die, Notebook, Snooze Button): there is no clear-style number. Describe what each did in an encounter run and flag it for the owner's judgement.
- **Target:** each damage Legendary within about 25% of the median clear strength.
- **Name the outliers and the one value to change for each. Change no value.** The owner picks which to retune; retunes are a follow-up PR.
- **Never run the balance bot** (`tests/balance.mjs`) without the owner's yes.
