# Jelly Fight game toolkit

Three focused workflows for design and review, usable in ordinary conversation
or explicitly as skills. Project rules stay in `CLAUDE.md`.

| Task | Claude Code | Codex |
|---|---|---|
| Combat readability, counterplay, and feel | `/jelly-combat-review` | `$jelly-combat-review` |
| Measured phone performance investigation | `/jelly-phone-performance` | `$jelly-phone-performance` |
| Playtest synthesis and interface friction | `/jelly-playtest-analysis` | `$jelly-playtest-analysis` |

Examples:

- "Use jelly-combat-review on the Vacuum's attacks. Find the weakest feedback
  phase and the smallest improvement; separate code evidence from observed play."
- "Use jelly-phone-performance to investigate the hitch when an effect first
  appears. Start with existing measurements and tell me what still needs a phone."
- "Use jelly-playtest-analysis on these notes: [paste notes]. Rank the problems
  and give me a focused retest plan."

Each workflow produces a report and a next action. A broader request can include
implementation, but requesting a review alone does not start edits, publish
issues, or run the long balance bot. Missing observations remain explicitly
unassessed; phone emulation is never presented as physical-device testing.

The shared instructions live in `.claude/skills/jelly-*/SKILL.md`.
Codex discovery entries in `.agents/skills/` load those files, avoiding duplicate
workflow bodies and Windows symlink setup. Edit the shared file when changing a
workflow; keep its name and description aligned with its Codex entry. If a skill
does not appear after updating the checkout, restart the assistant session. An
assistant can also read the shared file directly.

Inspired by the focused review, performance evidence, and playtest workflows in
[Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios).
These are original Jelly Fight instructions using the project's existing
architecture and verification; no upstream runtime, hooks, or configuration are
required.
