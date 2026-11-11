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
| P8a Ice | in review | | Frost look (crystal, tip frost, mist); Ice's 12 Attack upgrades; words chill-to-freeze, ground-lock, slide-on-hit, shards, and props on ring, shield-recharge, shield-burst, element-up ice |
| P8b Lightning | not started | | |
| P8c Poison | not started | | |
| P8d Wind | not started | | |
| P8e Glitter | not started | | |
| P8n Normal pool | not started | | |
| P9 | merged | #230 | v393 · Evolutions join the Legendary pick with types on (still in content/evolutions.kdl until P11); not-for= on Rebound, Man o' War, Disco Ball; tentacle-weapon word |
| P10 | not started | | |
| G2 | waiting | | Owner's balance runs and go |
| P11 | not started | | |

## Owner decisions since the plan was written

None yet. Record each one here with its date, and change the spec file it affects in the same PR.
