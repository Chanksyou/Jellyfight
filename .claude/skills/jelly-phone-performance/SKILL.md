---
name: jelly-phone-performance
description: Investigate Jelly Fight phone frame pacing, rendering cost, loading stalls, or memory growth using measured evidence. Use for performance investigations, not to claim device performance from a desktop phone viewport.
---

# Jelly Fight phone performance

Read `CLAUDE.md`. Resolve the current phone tier, frame cap, and resolution range
from `content/look.css`, `src/main.js`, and `src/pacing.js`; do not freeze a copy
of those settings in this skill. Target devices are described in the project rules.
Read the relevant portions of `docs/research/threejs-performance-and-graphics.md`
and `docs/research/iphone-and-pixel8.md` for background, treating dated research
and unverified claims as context rather than present measurements.

Start from a reported hitch, scene, or suspected regression. Record the commit,
device, browser/OS, graphics tier, viewport, pixel ratio, scenario/seed, and sample
duration where available. Separate cold loading, first use of an effect, steady
play, and sustained play. Compare matching scenarios and settings; record any
resolution changes from the governor that could disguise a slowdown.

Use the smallest relevant evidence source already available:

- `gfx.frameInfo` in `src/graphics.js` counts draw calls and triangles across
  rendering passes. `APT.renderer.info` supplies program/resource counts; inspect
  the current implementation before interpreting counters as costs or bytes.
- `src/pacing.js` explains frame caps and governor decisions. A steady low frame
  rate alone does not identify a GPU bottleneck or prove thermal throttling.
- `src/light-slots.js`, `src/batch.js`, effect pools, and the affected controller
  are places to trace shader churn, excess draws, allocations, or retained objects.
- For collision or other CPU work, capture a browser profile around a repeatable
  scenario. Discover existing profiling tools before recommending commands; a
  subsystem benchmark does not establish whole-game FPS.
- `node tests/run.mjs phone/` checks phone behavior in browser emulation. It is
  regression evidence, not a measurement on an iPhone or Pixel. The existing test
  harness uses software WebGL; identify that explicitly in any timing report.

For a measured comparison, report frame intervals (including slow frames),
sample count, rendering counts, or a profiler trace appropriate to the question.
Keep before/after device, seed, scene, tier, warm-up, and duration comparable.
Missing physical-device data means device performance is **not assessed**. Source
inspection can still produce a clearly labeled hypothesis and a measurement plan;
do not invent FPS, GPU time, memory savings, or a universal draw-call budget.

Return the reproduction setup, measured observations with evidence locations,
ranked bottlenecks or hypotheses, and the smallest next experiment. State how it
would confirm or reject the suspected cause. If a fix is authorized, preserve
the project's light, pooling, allocation, graphics recovery, and verification
rules; remeasure before claiming a speedup. End with unmeasured devices and risks.
