# P8n: Normal's pool

- **Model:** standard, high effort
- **Size:** M
- **Depends on:** G1. Counts toward the three-at-once limit.
- **Branch:** `types/p8n`

First read `docs/jelly-types/README.md` (the rules for every worker) and `docs/jelly-types/spec-core.md`.

## Also read

- `docs/jelly-types/types/normal.md` (the upgrade table)
- `src/bubbles.js` (bubble flight, `blow`, `pop`), `content/upgrades.kdl`

## Do

Build Normal's 12 upgrades. Eight need new bubble-flight words; keep each to one job. Split Blob in the Poison pool shares code with Popcorn: whichever of P8n and P8c merges second reuses the first one's word.

## Stories

- `treasures/<word>` for each new word
- `upgrades/<id>` for each of the 12

## Done when

- A Normal run with the switch on is offered only Normal upgrades, and all 12 work.
