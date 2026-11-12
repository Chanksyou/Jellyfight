---
name: jelly-playtest-analysis
description: Turn Jelly Fight playtest notes, recordings, or player reports into evidence-backed priorities and focused follow-up checks. Use for playtest synthesis, including onboarding, HUD, treasure choices, and touch controls.
---

# Jelly Fight playtest analysis

Read `CLAUDE.md`, `GLOSSARY.md`, and `docs/agents/issue-tracker.md`.
Use supplied notes, recordings, screenshots, or the playtest already discussed.
If there is no playtest evidence, offer a short test plan for the named question;
do not manufacture player reactions or a completed report.

Capture available context: build/commit, device/browser, input method, new or
returning player, act/loadout, duration, and the session's goal. Leave unknowns
unknown. Preserve reported player language and recording timestamps; distinguish
observed events, the player's interpretation, and the analyst's hypothesis.

Group repeated observations by the same underlying problem without losing their
sources. One tester saying something twice is not two independent testers. Note
what worked when evidence supports it, as well as friction. For each priority
finding include:

- What the player tried, what happened, and why it matters to play.
- The supporting quote, timestamp, screenshot, or supplied note. Label a paraphrase.
- Impact and observed frequency within this sample; do not generalize to all players.
- Reproduction steps if known, or the precise next observation needed to reproduce.
- The likely existing home in the project, verified by inspecting it. A suspected
  cause is not a confirmed defect.
- A small proposed change or experiment and its observable acceptance condition.

For first-run or interface confusion, trace the relevant flow rather than
reviewing a screenshot in isolation. `src/first-run.js`, `src/hud.js`,
`src/stories/phone.js`, and related stories are starting points, not an exhaustive
list. Check vocabulary, touch access, screen coverage, reading time, visibility
without sound, and Reduce Effects where relevant. Separate a control, camera,
feedback, or performance problem from a balance problem before proposing tuning.

Finish with the highest-value next action and a short retest plan: the situation,
device/input to use, what to watch, and what success would look like. Say which
questions the evidence cannot answer. Link to existing issues when available;
provide issue-ready drafts for new findings. Reading or analyzing reports does
not authorize posting issues, comments, or messages; create them only when asked.
Follow `CLAUDE.md` for any authorized code changes or balance experiments.
