# Ending a season

A season is a number, `SEASON` in `src/score.js`, shared by the game and the Worker. The board keeps one best run per season, player and jelly type, so a season never needs a clean-up: its rows stay where they are and simply stop being the current board.

**Only when the owner asks.** Never end a season on your own, and never to fix a scoring bug (retune `SCORE` first, and say so).

## How

1. Open a one-line pull request that raises `SEASON` by 1 in `src/score.js`. Add a `changes/<branch>.md` note saying the board starts fresh and the old one is kept under Past seasons.
2. Nothing else: no migration, no D1 step. After the deploy the board is empty, Champions says "Nobody yet" for every type, and everyone can post again.
3. Runs already under way when it deploys carry the old season, so the Worker refuses them once (`unverified`). Pick a quiet moment.

## What players see

- The board opens on the new season ("Season N" chip).
- A **Past seasons** button appears beside Back (it is hidden while there is only Season 1). It opens a tab for each earlier season, newest first: that season's Champions (the best run of each jelly type) and the top 3 of All.
- Past seasons are read-only. The Worker serves them from `GET /api/scores?season=N&tab=champions|all` (any other tab reads as `all`, and only the top 3); a season that is current, missing or not a whole number gets the current board.

## Checks

Stories `board/past-seasons-keep-the-old-champions` (the screen) and the Worker test "a past season is read-only" (`tests/achievement-board.test.mjs`). `node tools/ui-shots.mjs --only=leaderboard-past` shoots the page.
