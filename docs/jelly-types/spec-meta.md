# Jelly types: unlocks, book, achievements, text, leaderboard

Built in P10.

## Unlocks

A first-time player has Normal only. Each other type unlocks once, for good, and is saved with the player's other progress.

| Order | Unlock by | Jelly |
| --- | --- | --- |
| 1 | Finish act 1 | Fire |
| 2 | Defeat 3 Elites | Ice |
| 3 | Finish act 2 | Lightning |
| 4 | Defeat 6 Elites | Glitter |
| 5 | Finish act 3 | Poison |
| 6 | Defeat 9 Elites | Wind |
| 7 | Finish act 4 (win a run) | Tentacle |

- Elite kills count across all runs.
- Dev runs never count.
- A locked card shows its goal and progress ("Defeat 6 Elites: 4/6").
- When a run earns an unlock, the end-of-run screen shows it, the way a new award is shown today (`src/cosmetics.js`, `nextAward`).
- A player who already finished acts before this release gets those unlocks at once, from what their save and Treasure book already record. Elite counts start from 0 if no count was kept.

## Treasure book

- A new **Jellies** page: the eight types, locked ones shown as silhouettes with their goal.
- The six Elements, the 30 Element upgrades and Power Bank leave the Treasures page. A save that names a retired Treasure loads without error and simply drops it.
- Attack upgrades found get listed under their jelly on the Jellies page.
- The Evolutions page goes; former evolutions sit with the Legendary treasures.

## Achievements

- **Pack Light:** drop "counting starting Elements"; Attack upgrades don't count as treasures.
- **One of Everything:** drop the Element upgrade sentence.
- **Glass Cannon:** "Bubble damage" becomes "Attack damage".
- Check every other achievement text for Element, evolution, bubble and tentacle wording.

## Player text

- Death hints (`DEATH_HINTS` in `src/first-run.js`): replace the two Element hints with type hints.
- First-run tips: the Element pick tip goes. The opening tip "Attack automatically when bugs are nearby…" stays.
- The Treasure pick, level-up and stats panels use the Attack words.

## Leaderboard and run log

- The run log (`src/run-log.js`) and score submission carry the jelly type and the Attack upgrades taken.
- The plausibility check in `worker/index.js` accepts a run with a type, no Element, up to 3 Attack upgrades, and several former evolutions as Legendaries. It still rejects what it rejects today.
- The board shows each score's jelly type.
- The Worker deploys with main. Worker secrets are the owner's; don't touch them.
- Wiping old scores is the owner's step at release, in the D1 console.

## Stories

- `types/unlock-finish-act-1-opens-fire`
- `types/unlock-elites-count-across-runs`
- `types/dev-run-unlocks-nothing`
- `types/book-has-jellies-page`
- `types/old-save-with-retired-treasure-loads`
- Updated achievement and run-log stories (`tests/run-log.test.mjs`, `tests/achievement-board.test.mjs`).
