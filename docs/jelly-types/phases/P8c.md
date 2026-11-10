# P8c: The Poison jelly

- **Model:** deep
- **Size:** L
- **Depends on:** G1 (the owner's checkpoint). At most three P8 phases run at once.
- **Branch:** `types/p8c`

First read `docs/jelly-types/README.md` (the rules for every worker) and `docs/jelly-types/spec-core.md`.

## Also read

- `docs/jelly-types/types/poison.md` (all of it)
- `docs/agents/attack-feel.md` and `docs/agents/jelly-attack-design.md`
- `src/bubbles.js` (the acid branches), `src/acid-looks.js` if it exists, `src/adornments.js`
- `content/jellies.kdl`, `content/upgrades.kdl`; P4's Fire work as the pattern to copy

## Do

All behind the switch.

1. **The attack** as a main attack, at the jelly's full Fire rate, with `hit` set to land in the damage budget.
2. **Poison replaces Acid.** Build the blob, the sphere burst and the Poison status as `types/poison.md` describes. Poison's weakening uses `status-taken` from P3. Remove puddles from this type entirely. Add Poison to `GLOSSARY.md`. The Clog's acid (`content/bosses.kdl`, violet) is a different thing: leave it alone.
3. **The look**: core, tentacle tips, particles.
4. **The 12 upgrades** in `content/upgrades.kdl`, as the table says. Each new word gets a story.
5. The Attack Feel audit for the main attack; update `src/stories/attack-audit.js`.

**Merging beside other P8 phases:** you all add to `src/words.js`, `content/jellies.kdl` and `content/upgrades.kdl`. Add your words in one block at the end of `TREASURE_WORDS`, and rebase on `origin/main` before asking for review.

## Stories

- `types/poison-plays` (its attack is the only attack and lands its effect)
- `treasures/<word>` for each new word
- `upgrades/<id>` for each of the 12

## Done when

- A Poison run with the switch on plays act 1 through and is offered only Poison upgrades.
- The PR shows the damage budget arithmetic, and phone and desktop screenshots of the attack and the look.

## Not in this phase

- Other types. The pick screen. Unlocks.
