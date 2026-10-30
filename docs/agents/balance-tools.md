# Balance tools

Use the real game for balance measurements; these scripts do not change gameplay values.
They print JSON Lines (one JSON object per line) to stdout, with progress on stderr.
Save reports under `.wrangler/` so they stay out of commits.
Each report records its revision, dirty-checkout flag, seeds, styles and build settings.
Old `balance-baseline.txt` and `clear-baseline.txt` results are historical and cannot be compared numerically with the new measurement schema.

## Small, repeatable comparisons

```powershell
New-Item -ItemType Directory -Force .wrangler
node tests/clear.mjs lighterFluid --seeds=10,11,12 --styles=ranged --build=candle > .wrangler/fire-before.jsonl
# Run the identical command on the candidate revision, saving fire-after.jsonl.
node tests/compare-balance.mjs .wrangler/fire-before.jsonl .wrangler/fire-after.jsonl
```

The scripts pair each seed/style/scenario with its control.
An upgrade's control includes its prerequisite, so Lighter Fluid is compared with Fire alone, not with no Element.
The matchup tool reads Epic card values directly from `content/levelups.kdl`, skips cards not offered, and tests base and maximum copies/levels of treasures.
Items already present at that level in a requested base build are reported as skipped.
Build entries use treasure ids (`candle`), copy counts (`lemon@3`) or evolutions (`evo:boxJelly`); prerequisites are added automatically and invalid ids/counts fail.
Explicit comparisons whose builds are identical are rejected.

```powershell
$env:BUGS = 'roach,ants'
node tests/matchup.mjs freezerBurn --seeds=10,11 --styles=ranged,close,rooting --build=freezerPack
Remove-Item Env:BUGS
```

Clear runs use a stationary ranged pack and a chasing swarm; matchups use a large enemy and a chasing clump.
Both tools keep the jelly stationary by default for controlled comparisons, but support the same movement styles as campaigns.
Each scenario runs a 30-second clear attempt and a separate 10-second probe with high-Health targets and a mortal jelly.
Deaths and timeouts are reported separately; they are never converted into completed clear times.
The probe's DPS uses its actual elapsed time, so inspect outcome and exposure alongside DPS.
`TRIES=N` remains an alias for the number of encounter seeds unless explicit seeds or `--runs=N` are supplied.
Matchup filtering and positional zero-based shards (`lemon,pin 0/4`) remain supported.

## Three movement styles

- `ranged`: approaches firing range, backs off when crowded, and circles at a safe distance.
- `close`: approaches tentacle range, backing off at contact distance.
- `rooting`: holds in firing range, retreats from contact or nearby shots, then settles again.
- `stationary`: controlled benchmark only; never moves or dodges.

The moving bots avoid nearby ordinary projectiles and jump when blocked.
They seek active treasure chests when not engaging a nearby enemy.
They do not solve navigation through furniture, learn boss mechanics, model phone controls or reproduce human reaction times.
Playstyle-specific level-up priorities and a separate seeded tie-breaker replace always taking the first card.
`--prefer=health,candle,upsideDown` overrides those priorities when the named stat/treasure/evolution is actually offered; it never manufactures rewards.
Random treasure/evolution ties remain random rather than claiming to know the best build.

## Full campaigns and build additions

```powershell
node tests/balance.mjs 5 --seed=10 --styles=ranged,close,rooting > .wrangler/campaign.jsonl
node tests/balance.mjs --seeds=10,11 --styles=ranged --build=candle --add=lighterFluid > .wrangler/fire-upgrade.jsonl
```

Act 1 starts a real campaign: level-ups, offered treasures, boss rewards and evolution choices lead into the next act with the game's real carry data.
All four acts are followed until death, final victory or the per-act simulation-time limit (`--seconds=600`).
Starting later with `--act=2`, `3` or `4` uses an explicitly labelled synthetic fixture, not earned progression.
Use `--act-only` for the old single-act difficulty check.
Starting builds are experimental injections; their success does not prove they are naturally obtainable at that point.
Extra builds apply only at the start, never again after an act transition.
The adapter skips the cosmetic evolution reveal and runs `Run.later` callbacks on simulated time, retaining the real reward and carry callbacks.
It opens the next act with the carry produced by the game's own act-complete button.

## Targeted synergies

```powershell
node tests/clear.mjs --seeds=10,11 --styles=ranged --synergy=nailPolish+stickyNote > .wrangler/acid-mark.jsonl
node tests/balance.mjs --seeds=10,11 --styles=close --build=freezerPack --synergy=freezerBurn+evo:boxJelly
```

This evaluates four matching builds: base, A, B and A+B.
The interaction is `A+B - A - B + base`, reported for encounter DPS or campaign acts beaten.
It is a screening signal, not an automatic verdict; effects can overlap, exposure can differ after death and a useful specialist need not win every scenario.
Use fresh confirmation seeds before making tuning decisions.

## Measurements and uncertainty

- Enemy damage is actual Health removed after armor, marks and proxy/boss defenses, capped to exclude overkill.
- Player Health loss is the actual post-shield debit, capped at remaining Health; shields and healing are separate totals.
- Dodge, invulnerability and polyp immunity do not count as Health lost.
- Lethal-hit saves and rebirths remain enabled; immediate and delayed revival restoration are recorded separately from ordinary healing.
- Campaign reports include act outcomes, chosen/offered rewards, owned copies, evolutions, level, XP, kills, distance moved and time rooted.
- Summary estimates include count, mean, standard deviation and standard error; campaign completion rates include a 95% Wilson interval.
- Paired clear-time estimates include only pairs where both builds cleared; inspect all outcome counts to avoid selecting only the successes.

Replays stop the background frame loop, reset retained movement clocks and separate visual/audio randomness in the test adapter.
One combat RNG stream remains per act/trial: changed gameplay can consume different draws, so matching seeds do not guarantee identical later spawns or offers across revisions.
The tools do not estimate causal item value from human win rates or replace human checks for feel, readability and difficulty.
Five campaigns are a smoke check; increase the seed count for close comparisons, and interpret uncertainty before changing numbers.
Reports from different run limits or preference policies are rejected by the saved comparison tool; unmatched seeds/builds are counted explicitly.

## Verify the tools

```powershell
node --test tests/balance.test.mjs
node tests/balance-smoke.mjs
node tests/balance.mjs --seeds=17 --styles=ranged,close,rooting --seconds=5 --act-only
```

The pure checks run in `tests/check.mjs`.
The browser smoke checks real shields/Health/healing, armor/vulnerability/overkill, mortal revival, current card values, prerequisite controls, deterministic replays and rooting.
It forces boss victories only in the smoke harness to verify all four acts' evolution/reward/carry/ending paths; ordinary balance runs never force victories.
These are tool checks, not evidence that a build or the whole game is balanced.
