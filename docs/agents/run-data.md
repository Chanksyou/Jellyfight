# Balancing from player runs

The public Cloudflare site saves compact act summaries in D1 `jelly-fight-scores`.
There is no public read API for these records, and leaderboard submission is independent.
Dev modes and story URLs do not collect new reports.

## Collection and delivery

- The first actual gameplay update records `started`; visiting the menu does not count.
- Completing an act records `next-act`, even before Continue is pressed. Death and victory record `died` and `won`.
- Hiding or leaving the page records `in-progress`, or the final outcome if already completed. Identical snapshots are skipped.
- There are no recurring gameplay uploads and no movement or per-hit logs.
- One row in `run_summaries` represents `(player_id, run_id, act)`. The same run ID follows the campaign across page reloads.
- Revisions reject older snapshots; final outcomes cannot be replaced with unfinished checkpoints. `at` is the first receipt and `updated_at` the latest accepted receipt, both server timestamps.
- Failed requests retry with exponential backoff and jitter (up to about five minutes), including after reload. Up to eight reports share a request and one pair of existing rate-limit records. Reports use `fetch` with `keepalive`, below 48 KB per request.
- The local queue retains up to 32 pending acts for seven days. When browser storage is blocked it works in memory only. Abrupt phone/browser termination can still lose progress since the last checkpoint. The game does not wait for uploads.
- Historical `runs` rows are preserved; older open tabs still write that table. Do not combine those rows with new summaries without accounting for their different coverage and potential historical duplicates.

## Reading useful reports

Open Cloudflare → Storage & Databases → D1 → `jelly-fight-scores` → Console.
Use the actual build of interest in place of `vNNN` below. The `(build, act, device, at)` index supports comparisons within a release.

```sql
SELECT act, device, COUNT(*) AS attempts,
       COUNT(DISTINCT player_id) AS players,
       SUM(outcome IN ('next-act', 'won')) AS completed,
       SUM(outcome = 'died') AS deaths,
       SUM(finalized = 0) AS unfinished,
       ROUND(AVG(CASE WHEN finalized = 1 THEN time END), 1) AS finished_seconds
FROM run_summaries
WHERE build = 'vNNN'
GROUP BY act, device;
```

An unfinished record is not a death: the player may be paused, disconnected, or continuing later.
Keep it visible when judging completion; do not describe completion among reported endings as the win rate of all players.

```sql
SELECT r.act, j.key AS source,
       ROUND(SUM(j.value), 1) AS health_lost,
       COUNT(*) AS affected_attempts
FROM run_summaries r, json_each(r.health_lost) j
WHERE r.build = 'vNNN'
GROUP BY r.act, j.key
ORDER BY health_lost DESC;
```

Compare releases separately and split phone/desktop results; show both attempts and unique players.
Treasure ownership correlates with skill and time survived, so it does not by itself measure an item's strength.
Damage values are the existing post-shield damage amounts, which can include overkill on lethal hits.
Browser-supplied data is advisory, not cheat-proof.

## Elite defeats, Treasure choices, and deaths

The nullable `details` JSON column is added automatically without changing old rows.
Older reports have no detail; null means unknown, not zero.
These measurements are per act: `elitesBeaten` counts high-ground Elites, `elites` lists `[kind, seconds]`, `treasuresObtained` counts chosen items (including starting/boss Elements and their upgrades), and `pickups` lists `[treasure_id, seconds, stack_after_pick]` in choice order.
The existing `treasures` column is the full inventory, including items carried from previous acts; it is not the number of pickups in this act.
Times are active gameplay seconds from the beginning of the act, rounded to tenths, excluding pauses and choices.
Join the act rows by player/run ID to follow a campaign; do not sum pickup times as wall-clock timestamps.
The first 128 choices and 32 Elite defeats per act are retained; counters keep counting beyond these bounds.
`killedBy` contains `{unit, source}` only for a fatal hit after shields, death-save, and rebirth; a win or unfinished attempt has null.
The stable unit kind identifies the attacker (e.g. `mug`, `ladybug`, `vacuum`, `hair` for the Clog), while source identifies the existing damage label (e.g. `coffee`, `missile`, `boss`).
Projectiles retain their firing unit after it disappears; bleeding retains its applying unit, or unknown when combined bleeds have different units.

Read one release's recent attempts:

```sql
SELECT player_id, run_id, act, outcome, treasures,
       json_extract(details, '$.elitesBeaten') AS elites_beaten,
       json_extract(details, '$.treasuresObtained') AS treasures_obtained,
       json_extract(details, '$.killedBy.unit') AS died_to_unit,
       json_extract(details, '$.killedBy.source') AS fatal_attack
FROM run_summaries
WHERE build = 'vNNN'
ORDER BY at DESC
LIMIT 100;
```

For a selected player/run, list the complete available choice timeline (replace both IDs):

```sql
SELECT r.act,
       json_extract(p.value, '$[0]') AS treasure,
       json_extract(p.value, '$[1]') AS seconds_into_act,
       json_extract(p.value, '$[2]') AS stack_after_pick
FROM run_summaries r, json_each(r.details, '$.pickups') p
WHERE r.player_id = 'PLAYER_ID' AND r.run_id = 'RUN_ID'
ORDER BY r.act, CAST(p.key AS INTEGER);
```

Use `json_each(r.details, '$.elites')` with the first two fields of the same query for the Elite defeat timeline.
These reads use the existing build or player/run indexes; no extra index or upload per pickup is needed.

## Frame numbers and Settings from real play

`details.perf` and `details.settings` ride with each act summary from builds after this change; older rows have neither (null means unknown).
`src/field-perf.js` counts the frames the pixel-ratio governor judges (played, not paused, not behind a menu; intervals over 250 ms are hitches and not counted) in a fixed 64-bucket histogram of 2 ms steps, so the numbers are accurate to 2 ms.
No `perf` is sent for an act with fewer than 30 counted frames, and dev runs send nothing.
`perf` holds `ms` (median frame interval), `p95`, `slow` (share of frames over 1.5 times the cap's interval, 0 to 1), `n` (frames counted), `minRatio` (lowest pixel ratio the governor reached), `tier` (the graphics tier drawn), `cap` (frames a second the pacer allows, 0 for none), `dpr`, `w` and `h` (CSS pixels), `loadMs` (navigation start to Play enabled) and `lost` (graphics resets, `gpu-recovery.js`).
`settings` holds the Settings picks as they were at the last save: `graphics` (the pick, which is `perf.tier` unless a rebuild is under way), `fps` (the phone's 30 or 60 pick, 0 on a desktop), `text`, `easy`, `music` and `sound` (true is on), `calm` (Reduce effects) and `calmOs` (the device asked for it).
A new pick in the Settings sheet is one more field in `run.fieldNumbers` in `src/main.js` and in `settings()` in `worker/index.js`.
The Worker keeps only these fields, numbers clamped and words from fixed lists.
Frame times are what the browser reports, so a 60 Hz screen at a 30 cap shows 33 ms by design: read `ms` against `cap`.
The count starts over when a run starts and when the graphics tier or frame cap is changed, so a row covers one setting.
`perf_reports` has no ceiling beyond the per-address limit: prune it by hand in the D1 console if it ever grows.
Browser-supplied and advisory, like the rest.

Median frame time by build, act and device, phones only:

```sql
SELECT build, act, device, COUNT(*) AS acts,
       ROUND(AVG(json_extract(details, '$.perf.ms')), 1) AS median_ms,
       ROUND(AVG(json_extract(details, '$.perf.slow')), 3) AS slow_share
FROM run_summaries
WHERE json_extract(details, '$.perf.n') >= 300 AND finalized = 1
GROUP BY build, act, device
ORDER BY build DESC, act;
```

Split by `$.perf.tier` and `$.perf.cap` to compare graphics tiers.

The phone bench's Send (`index.html?bench`) writes `perf_reports` (`at`, `build`, `device`, `ua` trimmed to 200 characters, `json` under 8 KB), with no player id, one per address every 30 seconds.
Read it in the D1 console: `SELECT at, build, device, json_extract(json, '$.moments[0].ms') FROM perf_reports ORDER BY at DESC`.

## Capacity and history

Check D1 Metrics → Row Metrics for actual reads/writes and storage; indexes and rate limiting add writes beyond the summary rows.
Run reports on demand or on a modest schedule rather than scanning the full history for every page view.
No queue service, recurring server job, automatic deletion, or aggregate cache is added until measured usage warrants it.
Before raw history needs pruning, export it and preserve daily aggregates grouped by build, act, device, and outcome; do not silently discard balancing data.
