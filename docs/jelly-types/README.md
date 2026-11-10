# Jelly types rework: the plan

This folder is the whole plan for replacing Elements with jelly types. It is written to be fed to an orchestrator that hands each phase to a fresh worker agent. The decision behind it is `docs/adr/0002-jelly-types-replace-elements.md`.

**Orchestrator: read this file and `STATUS.md`, nothing else.** Workers read their own phase file and what it names.

## Files

| File | Who reads it |
| --- | --- |
| `README.md` (this) | The orchestrator, and every worker (the rules section) |
| `STATUS.md` | The orchestrator, at the start of every session |
| `spec-core.md` | Every worker |
| `phases/P<n>.md` | The one worker doing that phase |
| `types/<type>.md` | Workers on that type's phases |
| `spec-pick-screen.md`, `spec-legendaries.md`, `spec-meta.md` | Workers on P5, P9, P10 |

## Phases

Sizes: S is under about 300 changed lines, M under about 800, L above that.
Models: **deep** is the strongest model (`claude-opus-5-5`). **standard** is `claude-sonnet-5-5`. Use `claude-haiku-5-5` for nothing here but the orchestrator's own bookkeeping, if it can run on it.

| Phase | What | Model | Size | Depends on |
| --- | --- | --- | --- | --- |
| P1 | The jelly type and the switch | deep | M | none |
| P2 | "Bubble" becomes "attack" (text only) | standard | M | P1 |
| P3 | The six shared words | deep | M | P1 |
| P4 | Main attacks: Normal, Fire, Tentacle | deep | L | P2, P3 |
| P5 | The pick screen | standard, high effort | M | P4 |
| P6 | End-of-act Attack upgrade pick, Fire's pool | deep | L | P4 |
| P7 | Tentacle's pool | standard, high effort | M | P6 |
| **G1** | **Owner plays Normal, Fire, Tentacle** | none | none | P5, P7 |
| P8a | Ice jelly | standard, high effort | L | G1 |
| P8b | Lightning jelly | standard, high effort | L | G1 |
| P8c | Poison jelly | deep | L | G1 |
| P8d | Wind jelly | standard, high effort | L | G1 |
| P8e | Glitter jelly | deep | L | G1 |
| P8n | Normal's pool | standard, high effort | M | G1 |
| P9 | One Legendary pool | deep | L | P6 |
| P10 | Unlocks, book, achievements, text, leaderboard | standard, high effort | L | all P8, P9 |
| **G2** | **Owner's balance runs and go for release** | none | none | P10 |
| P11 | Release: switch on, old code out | standard, high effort | L | G2 |

```
P1 ─┬─ P2 ─┬─ P4 ─┬─ P5 ──────┬─ G1 ─┬─ P8a..e, P8n (3 at once) ─┬─ P10 ─ G2 ─ P11
    └─ P3 ─┘      └─ P6 ─ P7 ─┘      │                           │
                     P6 ─────────────┴─ P9 ──────────────────────┘
```

What may run at the same time: P2 with P3. P5 with P6. P9 with the P8 phases. Never more than three workers at once: they collide in `src/words.js` and `content/`.

About 17 pull requests in all.

## The gates need the owner

- **G1.** The owner plays the three types with `?types`, and sends **one** message with every note. The orchestrator turns the notes into edits to the spec files in one small docs PR, then starts P8. Offer the balance bot (Fire and Tentacle against Normal, matching seeds); run it only on a yes.
- **G2.** With the owner's yes, run `node tests/balance.mjs 5 --styles=ranged --act-only --type=<id>` for each type and for Normal on the same seeds (about 15 minutes each). Report what moved and name one value to change per type. Change values only on the owner's say, in one PR.
- **Every merge.** The owner says "merge", and only after the `Game checks` job is green. Ask for merges in batches when several PRs are ready and don't depend on each other.

## Rules for the orchestrator (these are what save credits)

1. **One fresh worker per phase.** Its whole prompt is: "Do phase P<n> of the jelly types rework. Read `docs/jelly-types/phases/P<n>.md` and follow it." Add nothing. The files carry the context.
2. **Never paste the spec, a diff or a log into a prompt or into your own context.** Read only each worker's handoff block (below) and `STATUS.md`.
3. **Start a phase only when everything it depends on is merged to main.** Workers branch from `origin/main`.
4. **Don't re-plan.** If a worker reports the spec is wrong or unclear, stop that phase and ask the owner one question. Fix the spec file in a docs PR, then restart the phase with a fresh worker.
5. **Stop losses.** End a worker and report to the owner if it: fails to get `Game checks` green after two fix attempts, grows past twice its size class, or wants to change something `spec-core.md` lists under "Not changing".
6. **One review per PR,** by a fresh standard-model worker told: "Review PR #<n> against `docs/jelly-types/phases/P<n>.md` using `.claude/skills/ponytail-review/SKILL.md`. Read the diff and only the files it touches." The author fixes what the review finds, once. A second round needs the owner.
7. **No research agents, no sub-agents inside workers, no exploring the codebase beyond the files a phase names** unless a named file points somewhere else.
8. **The full story suite runs in GitHub's `Game checks`, never in a worker,** except P11. The balance bot never runs without the owner's yes.
9. **After each merge, add one line to `STATUS.md`** (in the next phase's PR, not a PR of its own).
10. **Never merge, never push to main, never wipe data, never touch Worker secrets.** Those are the owner's.

## Rules for every worker

1. Read `CLAUDE.md`, this section, `spec-core.md`, and your phase file. Read no other phase.
2. Branch `types/<phase id in lower case>` from the latest `origin/main`. One pull request.
3. **Everything new is behind `GAME.types`.** With it off the game is unchanged and every existing story passes untouched. If you must edit an existing story, say why in the PR.
4. **New behaviour is a new word** in `src/words.js` with a one-line `doc` and its own story. Never branch on an id. If existing words can say it, use them.
5. **Numbers come from the spec.** Don't tune to make a test pass. If arithmetic in the spec is plainly broken, keep going with the nearest sane value and list it under "Open" in your handoff.
6. Run `node tests/check.mjs` and only the stories you added or touched (`node tests/run.mjs <name>`). Don't run the whole suite. Don't run `tests/balance.mjs`.
7. Attack changes follow `docs/agents/attack-feel.md`: put its nine-question audit in the PR.
8. Anything a player can see: phone and desktop screenshots in the PR.
9. Add `changes/types-<phase id>.md` (one line, no version number). Never edit `BUILD`.
10. Player text uses `GLOSSARY.md` words and none it lists under _Avoid_.
11. Open the PR with the repo's usual body, and end your work with this handoff block, in under 150 words:

```
PHASE: P<n>
PR: <url>
CHECKS: <what you ran and the result>
STORIES: <added / changed>
NEW WORDS: <names>
SKIPPED: <anything in the phase file you did not do, and why>
OPEN: <questions or doubts for the owner, or "none">
STATUS LINE: <one line for STATUS.md>
```

## What this plan does not decide

The numbers. Every stat and upgrade value here is a starting point reasoned from the code at v384, not measured. G1 and G2 are where the owner tunes them.
