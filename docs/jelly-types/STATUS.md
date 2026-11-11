# Jelly types rework: status

One line per phase, newest last. The orchestrator reads this at the start of every session and adds a line after each merge.

| Phase | State | PR | Note |
| --- | --- | --- | --- |
| Plan | written | | Spec and phases as of Nov 10 2026, against main at v385 |
| P1 | merged | #223 | Type switch, content/jellies.kdl, run.jelly (v386) |
| P2 | merged | #224 | v387 · Bubble stats read Attack damage, Attack size, Attacks; keys unchanged |
| P3 | merged | #225 | v388 · Six shared words; Shatter on status-damage |
| P4 | merged | #226 | v389 · Normal, Fire, Tentacle attacks; not-for= on cards and Treasures; ember and barbs looks |
| P5 | merged | #227 | Pick screen behind the switch: 10-segment bars, ember and barbs on the portraits, Try again opens it |
| P6 | merged | #228 | v390 · End-of-act Attack upgrade pick and Fire's 12 upgrades (content/upgrades.kdl) |
| P7 | merged | #229 | v394 · Tentacle's 12 Attack upgrades; nine new words; the old Treasures stay for types off |
| G1 | skipped | | Chan skipped the play-test (Nov 11 2026); treat as passed, to be played with G2 |
| P8a Ice | merged | #238 | v401 · Frost look (crystal, tip frost, mist); Ice's 12 Attack upgrades; words chill-to-freeze, ground-lock, slide-on-hit, shards, and props on ring, shield-recharge, shield-burst, element-up ice |
| P8b Lightning | merged | #241 | v402 |
| P8c Poison | merged | #236, #237 | v399-v400 · Blob + sphere burst + Poison stacks (no puddles), weakening via status-taken, toxin look, 12 upgrades, seven new words; hit=0.6 (10.3/s) |
| P8d Wind | merged | #240 | Gust as the Wind jelly's main attack (hit=1.15 -> 10.35/s), Pierce +1 reaches a type's main attack, gale look, 12 upgrades, new words whirl, pushed-hits, glide + props on landing-shockwave, when-hit, wind element-up |
| P8e Glitter | merged | #239 | v405 · Bomb at hit=1.3 (9.4/s), its burst a visible sphere (fx.volume), sparkle look, 12 upgrades; new words random-status, gild, splash-reflect, wish, splash-shots, next-attack, splash; props echo-bubble from=, crit by=splash, crumb-on-kill drop=level |
| P8n Normal pool | merged | #242 | Normal's 12 Attack upgrades (Double Bubble to Orbit); words trap-on-hit, homing, pop-chain, wobble, focus-ramp, range-pop, orbit-misses; props stat no-penalty, rebound walls-only, echo-bubble on="kill"; the trap status |
| P9 | merged | #230 | v393 · Evolutions join the Legendary pick with types on (still in content/evolutions.kdl until P11); not-for= on Rebound, Man o' War, Disco Ball; tentacle-weapon word |
| P10 | merged | | Unlocks from the save (book's bosses, lifetime Elites) via unlock-act= / unlock-elites= in jellies.kdl; Jellies page in the book; type hints and achievement text; jelly column on scores; checkRun caps Attack upgrades at 3 |
| G2 | skipped | | Owner said release without the playtests |
| P11a | merged | #248 | v413 · Jelly types on for everyone: first run Normal, then the pick screen every run |
| P11b | in review | | Dead Element Treasures, the Element pick and Power Bank removed; Attack upgrades keep the `element-up` word. Follow-ups not done: P11.md's "unread tentacle stats" (not clearly unread: tentacles/reach/tentacleDamage/tentacleSpeed still feed the lash), and `content/evolutions.kdl` stays (offered in the Legendary pick) |

## Owner decisions since the plan was written

None yet. Record each one here with its date, and change the spec file it affects in the same PR.
