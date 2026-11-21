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

## Measuring a phone's page without a phone

- **The bench** (`src/bench.js`, moments in `src/bench-moments.js`): `index.html?bench` for act 1,
  `?bench&act=3`, `?bench&act=4`, and `?bench&act=4&scene=2` for the Encore arena. One tap on Start
  (about 2 minutes for act 1). Each busiest moment gets a 2 s settle and 8 s of measured frames, then
  again under each switch: bloom off, pixel ratio 1.0, lamps off, AO off, Low. The bench draws its own
  frames, so the pacer and governor don't see them. Results can be copied, or sent to `perf_reports`
  (no player id, one per address every 30 s). Story pages never send.
- **Experiment switches** (`src/experiments.js`, read once at boot, never saved): `?lights=3|4|6`
  (lamp slots), `?rt=packed` (R11G11B10 buffers, `graphics.js`), `?msaa=0|2|4` (`main.js`),
  `?lite=1` (Low's plain materials on any tier). They are load-time choices, so each needs its own
  link. The bench carries them across its act links and prints them in its results.
- **The headless tool**: `node tools/perf-phone.mjs`. Useful flags: `--tiers=medium,low`,
  `--only=act1,act3,night4,arena`, `--profile` (top 30 functions and time by file),
  `--overdraw` (layers per pixel and the heaviest see-through stacks), `--json=out.json`,
  `--frames=N`, `--throttle=N` (CPU slowdown, 4 by default). A medium page takes about 6 minutes.
- **Real play**: each act summary carries `details.perf` and `details.settings` (`src/field-perf.js`).
  Read them with the queries in `docs/agents/run-data.md`.

Everything the headless tool reports is headless Chromium with SwiftShader at 4x CPU slowdown.
Draw calls, triangles, programs, lights and uploads are real counts. Times only rank costs. Never
report a phone's frame rate, heat or GPU time from them. The bench's GPU timer has never run, and
iPhones never offer it.

Budgets and rules that the code now relies on:

- Draw calls: `night4/within-the-phone-budget-at-its-busiest` allows act 1's busiest moment plus 15
  (`ACT1_BUSIEST` in `src/stories/act4-perf.js`, a number measured once; re-measure it when act 1
  changes a lot).
- No light added or removed in play, and no shader built in play (rule 7).
- Still furniture is frozen (`src/static-batch.js`). A piece that moves after load must call
  `markMoved(o)`; the story runner fails any story that leaves a frozen piece's matrix stale.
- Furniture batches cull only when the camera moves `--batch-cull-move` or turns `--batch-cull-turn`
  (`content/look.css`). A still camera uploads nothing, so a change that needs the batches to check
  the view every frame has to trigger a cull some other way.
- Low (`src/lite-materials.js`) draws apartment pieces with plain Lambert copies and no spotlights.
  Bugs and the jelly keep their materials, which are made at spawn.
- A hidden node that is shown has its `matrixWorld` read before the render: call `updateMatrixWorld`
  first (`batch.js` `updateShown`).
- `LOOK.list` returns strings. Convert them before passing them to a number API.

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
