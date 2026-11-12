---
name: jelly-combat-review
description: Review Jelly Fight attacks or encounters for readable feedback, fair counterplay, and useful player choices. Use for a combat design or feel review, rather than an ordinary code review.
---

# Jelly Fight combat review

Read `CLAUDE.md` and `GLOSSARY.md` at the repository root. Follow
`docs/agents/attack-feel.md`; for the jelly's attacks also read
`docs/agents/jelly-attack-design.md`. These are the standards, not a second rubric.

Review the attack, encounter, or proposal the user names. If none is named, use
the combat change under discussion; ask for a target only if none can be inferred.
Read its content, controller, hit logic, feedback, callers, and related stories.
Find their current homes through `CLAUDE.md` and search; do not assume every Boss
uses the same controller. Inspect `src/stories/attack-audit.js` for existing scores.

Trace what the player can see, decide, and do:

- Does the Warning describe the actual hit space and time, including height,
  surfaces, and jumps? Is there a reachable response from the player's position?
- Do tracking, overlaps, recovery, and repeated attacks leave understandable
  choices? Identify a specific unavoidable situation before calling one unfair.
- Can the source, target, release, contact, and end of danger be read at gameplay
  distance, in a crowd, on a phone, with Reduce Effects and sound off?
- Does each attack ask for a distinct response or serve a clear encounter role?
  Separate a proposed design improvement from a demonstrated defect.

Use the existing story list (`index.html?stories`) to find a focused situation,
then observe `index.html?story=<name>` at play speed when tools permit. Check the
current phone default and Low fallback. Retain screenshots or clips for visual
findings; a still cannot prove timing or sound. A proposal can be reviewed without
a running implementation, but mark its untested assumptions.

Report the target and evidence used, the existing nine-question feel audit with
its zeros, and a short ranked list of actionable findings. For each finding give
the player-visible problem, file/story or captured evidence, smallest useful fix,
whether it affects balance, and a way to verify it. Distinguish code-supported
scores from observed play; mark unobservable rows unverified rather than inventing
a passing score. Do not update the scoreboard merely because a review was run.

End with the best next change and what was not assessed. A review requests a
report; implement fixes only when the user's task includes them. Follow the
project's balance-tools and release rules for any authorized follow-up.
