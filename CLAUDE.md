# Jelly Run: how to change this game

A jellyfish roguelike in a real-scale 3D apartment. Three.js, plain ES modules, no build step.
Players are on phones (iPhone 13+ in Safari, Pixel 8+ in Chrome) as much as desktops.

The game is meant to be changed by short requests to agents that have never seen it. That
works because every kind of change has **one home**, things are described in **plain-text
content** with a small **vocabulary**, and **stories** prove behaviour. Keep it that way.

Words: `GLOSSARY.md` is the game's vocabulary (Health, XP, Treasure, Element, Elite…), the same in player text, code and content. The story `vocabulary/no-retired-words` fails if player text uses a word it lists under _Avoid_.

## Ponytail methods

Use [Ponytail](https://github.com/dietrichgebert/ponytail) in **full** mode by
default for coding, debugging, refactoring, dependency choices, and reviews.
Before that work, read and apply `.claude/skills/ponytail/SKILL.md`; for reviews,
also read `.claude/skills/ponytail-review/SKILL.md`. These checked-in skills serve
both Codex and Claude Code; no separate plugin installation is required to follow them.
Read the affected flow and callers, reuse existing code and platform features,
and make the smallest complete change. Preserve validation, error handling,
security, accessibility, and the project's required checks. End work reports with
what was skipped or not checked and any material risk. Follow a different mode
when the owner requests it.

## Working with Codex and Claude Code

These are the shared project instructions for both agents; `AGENTS.md` directs
Codex here. Keep project rules in this file so the agents follow the same workflow.

1. Check `git status` and the current branch before editing. Preserve unfinished
   work. For a new task, fetch origin and create a descriptive feature branch from
   the latest `origin/main` on a clean checkout. For a handoff, continue the named
   branch instead of starting over.
2. Use one agent to implement and the other to review. If both edit concurrently,
   use separate worktrees and branches. Never switch branches or edit the same
   working folder while another agent is working there.
3. Preview gameplay changes locally, run the checks in rule 2, and make focused
   commits. Hand off the branch name, commit, change summary, checks and results,
   and any unfinished work; chat history is not shared between tools.
4. Push the feature branch and open a pull request for review. Merge into `main`
   only when the owner explicitly requests a release or approves the merge.
   Pushing or merging into `main` deploys the game to Cloudflare.
5. For a release containing code changes, run the full story suite on the final
   integration before deployment. A local push to `main` requires a clean,
   committed checkout and a full passing run on that exact commit, including any
   merge commit. GitHub merges do not run local hooks: record the required checks
   in the pull request and complete them before merging. Then update local `main`.
   The required GitHub `Game checks` result requires guards, the balance smoke check and all eight story
   shards to pass on the PR integration. Wait for it to pass; do not bypass it.
   Shards never record a local full-suite pass. Stories reset to a fixed
   seed per name; use `node tests/run.mjs --seed=N` to replay other rolls and keep
   failure screenshots/logs from the Actions artifact. The default seed's clean
   full run is what records `tests/.last-green` for the local push hook.

Enable the existing pre-push hook in each fresh clone with
`git config --local core.hooksPath .githooks`. See README for test dependencies.

## Where each kind of change lives

For any change to an attack, projectile, hit effect, or combat feedback (the jelly's,
an Elite's, or the Vacuum's), read and follow [Attack Feel](docs/agents/attack-feel.md):
the seven-phase chain every attack completes, its laws, and the nine-question audit to
report before calling the work done (the reasoning is in
[The Feel of Impact](docs/agents/attack-effects-foundation.md)). For the jelly's own
attacks, also follow [Designing the jelly's attacks](docs/agents/jelly-attack-design.md),
which applies the chain to identity, upgrades, readability, mobile performance, and
verification across all player attack families.

| To change… | Edit | Notes |
|---|---|---|
| A bug's numbers or behaviour | `content/enemies.kdl` | Behaviour is words from `src/words.js` (`ENEMY_WORDS`) |
| When bugs appear, how many, how fast | `content/waves.kdl` | |
| Colours, glow, night lighting, haze, bloom, camera, jelly size; each act's mood; the soft shadows under the jelly and bugs | `content/look.css` | Read by `src/look.js` at startup. An act's own mood is `--<name>-act<n>` over `--<name>` for `night-fill`, `night-sky`, `haze`, `haze-color` and the colour grade `grade-gain`, `grade-lift`, `grade-sat` (`src/main.js`; the grade is `GRADE` in `src/graphics.js`'s output pass, Medium and High). Shadows: `--jelly-shadow`, `--bug-shadow`, `--bug-shadow-size` (`ShadowSystem` in `src/systems.js`, the bugs' in one instanced draw; story `engine/bugs-cast-soft-shadows`) |
| UI colours, type, spacing, motion; shared UI pieces; icons | `content/look.css` (`--ui-*`, its top block); `src/ui-kit.css`; `src/icons.js` | Fonts self-hosted in `assets/fonts`. `?story=ui/kit` shows every piece; the stories `ui/text-at-least-12px` and `ui/targets-at-least-44px` guard every screen on a phone; `node tools/ui-shots.mjs [--only=<screen>]` shoots each screen on phone and desktop |
| How hard a hit, kill or attack lands (screen shake, hit-stop) | `content/look.css` (`--feel-*`) | One ladder by significance; code calls `juice.feel(step)`, never its own numbers |
| An attack's feel audit score | `src/stories/attack-audit.js` | Every attack is listed; `vocabulary/every-attack-is-audited` guards it |
| What a new player's first run introduces, and when | `src/first-run.js` | The run asks it at a few points; stories use `fresh({ firstRun: true })`. A first run is always the Normal jelly; later runs open the type pick screen |
| Frame-rate cap, pixel ratio range, lamps lit at once on phones | `content/look.css` (`--phone-fps`, `--*-pixel-ratio`, `--phone-lights`) | Logic in `src/pacing.js` and `src/light-slots.js`; graphics-reset recovery in `src/gpu-recovery.js` |
| Phone performance measurements: the bench, its moments, the experiment switches, the headless `perf-phone` tool, and what real phones send | `src/bench.js`, `src/bench-moments.js` (a moment is one entry in `MOMENTS`), `src/experiments.js` (`?lights`, `?rt=packed`, `?msaa`, `?lite=1`), `tools/perf-phone.mjs`, `src/field-perf.js`, `src/overdraw.js` | Headless numbers are counts and rankings, never a phone's frame rate. Read [Jelly phone performance](.claude/skills/jelly-phone-performance/SKILL.md) first. Stories `bench/*`, `night4/within-the-phone-budget-at-its-busiest` |
| Furniture batch culling, the frozen apartment, the minimap's redraw rate | `content/look.css` (`--batch-cull-move`, `--batch-cull-turn`, `--map-fps`, `--map-max-dpr`); `src/static-batch.js` (`freeze`, `markMoved`, `cull`); `src/hud.js` (`mapDue`) | A piece that moves after load calls `markMoved`. Stories `engine/batches-cull-off-the-frame-clock`, `engine/still-furniture-skips-matrix-updates`, `hud/minimap-redraws-on-its-own-clock` |
| Low graphics' plain materials and the fill light that replaces the spotlights | `src/lite-materials.js`; `content/look.css` (`--lite-fill`) | Apartment pieces only. Bugs and the jelly keep their materials, which are made at spawn. Story `engine/low-draws-plain-materials` |
| Vents, treasure times and spots, elite spots, boss arena | `src/stage1.js` (act 1), `src/stage2.js` (act 2), `src/stage3.js` (act 3), `src/stage4.js` (act 4: `STAGE4` the room with its `ELITES4` and vents, whose `stageDoor` opens at time-up into its second scene, the `ENCORE` arena; its `sun` and `bass` have their own rows below, the sun's look is in `src/sunrise.js`); acts listed in `src/stages.js` | Plain data. Vents can also be dragged in the layout editor; bake exported `vent:<name>` positions into the vent list here |
| Act 4's sun (where its line starts and stops, how much it drains) and how it looks | `src/stage4.js` (`sun`), `src/sunrise.js`, `content/look.css` (`--sun-*`, `--hostile-sun`) | Any stage with a `sun` block gets it; stories `night4/the-sun-*` |
| Act 4's bass wave (how often, how high, how fast, how hard) and how it looks | `src/stage4.js` (`bass`), `src/bass-wave.js`, `content/look.css` (`--bass-*`, `--hostile-bass`, `--feel-bass`) | Any stage with a `bass` block gets it, on the run's beat (`run.beat`, `keepTime` in `src/run.js`); stories in `src/stories/bass-wave.js` |
| The Encore (act 4's arena fight): its set list by stage, solos and bows, each attack's numbers and code | Numbers in `content/bosses.kdl` (`encore`: `stages`, `set`, `solo`, `records`, `pyro`, `wall`); the set list and solos in `src/encore.js` (`SetList`, `SOLO_ATTACKS`); the floor waves `src/encore-floor.js`, lasers `src/encore-laser.js`, disco ball `src/encore-disco.js`, stage-edge shock `src/encore-contact.js`, Record toss `src/encore-records.js`, Pyro `src/encore-pyro.js`, Wall of sound `src/encore-wall.js`; the DJs `src/encore-model.js` (poses in `content/look.css`, `--encore-dance-*`); colours and looks in `content/look.css` (`--encore-*`, `--hostile-encore-*`); stories in `src/stories/encore.js` | Stages read the Encore's Health, never the clock. Solos and bows read `bosses.kdl`; a new attack is a `SOLO_ATTACKS` entry plus its numbers. Every Encore attack needs an `encore/*` audit entry in `src/stories/attack-audit.js`. The DJs' floor solos: each DJ's mark is `ENCORE.marks` in `src/stage4.js` (a solo with no mark plays from the booth; the duet has one per DJ); the `floor` line in `content/bosses.kdl` sets `crouch, air, body, r, chest, keep, shove, knock, hop, duet` (the crouch and air beats, the body's radius, the hit sphere, the keep-out, the shove, the knock-home and rewind-hop seconds, and the duet's radius). The rig in `src/encore-model.js` has legs (`outerLeg`, `innerLeg`, hidden in the booth), `travel()` and `face()` for the trip out and back, and the moves `vault`, `land`, `slam`, `conduct`, `push` (poses in `content/look.css` `--encore-dance-*`; also `--encore-vault-height`, `--encore-turn-rate`, `--encore-floor-flinch`, `--encore-landing-dust`). `floorMarks`, `floorStep` and `floorFollow` in `src/encore.js` run a solo on the floor: a DJ out is the Encore's one target, and the booth can't be hit meanwhile. Sounds: `vaultWhoosh`, `landThud`, `crowdRise`, `floorSlam`, `wallShove` in `src/sfx.js`. The fight view (a camera pulled back and aimed toward the stage, so a DJ on the floor shows head to feet) is `--encore-camera-*` in `content/look.css`, read in `src/encore.js` and handed to the camera by `run.js`. The disco ball's height in set 3 is `--encore-disco-stay-hang` in `content/look.css`, read by `src/encore-disco.js` |
| Which rooms each act loads | `tools/split.mjs` (`ACTS`), then `node tools/split.mjs`; a stage's `parts` | The game never loads the whole apartment; act 2/3 load with `GAME.loadRooms` |
| Baked light on walls, floors, ceilings and furniture (Blender): each act's bake-only lights (moon, city glow, act 4's daylight), how bright the bake shows, the bake itself | The light list: `src/bake-lights.js` (the act's lamps are baked from the apartment as played, in watts: `lampWatts` in `tools/bake-light-page.js`); `content/look.css` (`--baked-light`, `--dawn-daylight*`); bake with `node tools/bake-light.mjs [act]` (`tools/bake-light.py`, needs `pip install bpy pillow`); shown by `src/baked-light.js` through the room's shader patch in `src/baked-ao.js` | The shell reads a picture by world position; the big pieces of furniture read their own light maps in the same picture (`src/piece-light.js`: which pieces and the texel size in `PIECE`; cut into charts at bake time, rebuilt with a `lightUv` attribute at load, no new draws); the rest of the furniture reads a light grid (every 10 cm, 6 directions, `--baked-light-furniture`). The bake replaces only lamp diffuse; lamp shine, the fill, the jelly's glow and act 4's sun line stay live. The dev panel's Baked light switch compares. `node tools/light-shots.mjs` (`--shell`) shoots baked against live. Stories `engine/baked-light-*`; `engine/baked-light-is-current` fails until you re-bake after moving furniture or changing a lamp or the list (`bake-layout.mjs` re-bakes touched acts) |
| Light in the air and on what moves: the soft glow round each lamp's bulb, the dust drifting in act 3's moonlight and act 4's sun, and the baked light's tint on the jelly and the bugs | Halos and dust: `src/air-light.js` (`AirLight`, one draw each), a stage's `motes` box (`src/stage3.js`, `src/stage4.js`); the tint: `tintShader` / `tintWithBake` in `src/baked-light.js` (bugs through `standOut` in `src/enemies.js`, the jelly in `src/player.js` `setAvatar`); numbers in `content/look.css` (`--lamp-halo*`, `--motes*`, `--baked-tint`) | Dust shows only where the baked light grid says the beam passes (the grid's direction `face`); Low draws no dust, Reduce effects holds it still. Stories `engine/lamps-glow-in-the-air`, `engine/bugs-and-jelly-take-the-baked-light`, `act3/dust-drifts-in-the-moonlight` |
| Furniture placement | the dev layout editor (pause menu) → export → `node tools/bake-layout.mjs <code file or ->` (merges into `src/layout-baked.js`, re-bakes shadows for touched acts; `--check` previews) | `bake-layout.mjs` re-bakes the shadows and the light itself (`src/baked-ao.js`, `src/baked-light.js`); after re-exporting the apartment, run `node tools/bake-ao.mjs` (the story `engine/baked-ao-is-current` fails until you do). Act 4 is act 1's room: it takes act 1's whole layout (`BAKED_LAYOUT[4] = { ...act 1, ...act 4's own }`), so bake furniture, plant and prop changes into act 1 only; act 4's own entries are just its Elites' furniture, what stands in their spot (`ELITES4` `clears`, hidden) and vents (`tests/check.mjs` fails on any other) |
| The score (what each act pays: night, Boss damage and beaten, Elites, Bugs cleared, Clean play, Boss pace) | `src/score.js` (`SCORE`, `actParts`, `MAX_SCORE`); the run's counts in `src/run.js` (`scoreFacts`) | One table, read by the game, `src/leaderboard.js` and `worker/index.js`; no score number anywhere else. Each act's `details.score` in the run log holds its facts. Stories `score/*` (`src/stories/score.js`) |
| The leaderboard on the game's own site (Champions, All, a tab per jelly type, the Season chip, Submit score) | `src/leaderboard.js` (`Leaderboard`, `mineOf`, `qualifies`), `src/run.js` (`showBoard`, `showTabs`), `ui.board` in `src/ui.js`, `--board-*` in `content/look.css`; the Worker's `board` table and `api/scores` in `worker/index.js`; the season in `src/score.js` (`SEASON`) | Rows are kept per season, player and jelly type, and the Worker checks each posted score against the run's logged acts. Past seasons (a button on the board, `Run.showPast`) shows each finished season's Champions and top 3 of All, read-only. Ending a season is bumping `SEASON`, only when the owner asks ([seasons](docs/agents/seasons.md)). Stories `board/*` (`src/stories/board.js`) and the `leaderboard-*` screens in `src/stories/ui.js` |
| The Treasure book (what a player has found across runs) and the death screen's pull | `src/collection.js`, `run.js` (`showBook`, `endRun`), `src/cosmetics.js` (`nextAward`) | Finds are noted in `run.found`, never in a dev run |
| Shop looks and their prices, Pearls a run earns, golden awards and what earns them | `src/cosmetics.js` (`PRICES`, `PEARLS`, `NEEDS`); the looks themselves in `src/character.js` | A new look is an `OPTIONS` entry plus its model; hats sit with `seat(r)` so they fit every species |
| Player stats and level-up cards | `src/stats.js` (`BASE_STATS`, `CARD_VALUES`) | A jelly type's starting stats are `stats` in its `content/jellies.kdl` entry, on top of `BASE_STATS` |
| Jelly types (what a run starts as: stats, one attack, look, unlock) | `content/jellies.kdl`, `src/jelly-types.js`, `src/pick-screen.js` | A type is `attack=`, `hit=`, stat lines, an `adorn` look and `unlock-act=` / `unlock-elites=`; add a story under `src/stories/` and an entry in `src/stories/attack-audit.js` |
| The pick screen's pictures: the centre card's live attack, the side cards' element shaders, the card stills | The centre card: `src/attack-preview.js` (its live attack, warm-up and drawing into the card), `src/pick-stage.js` (lights, reflections, floor, backdrop). Side cards: `src/pick-aura.js` (the registry), `src/pick-auras/<kind>.js` (one shader per `aura=` kind; `kit.js` and `painter.js` shared), `src/jelly-portrait.js` (the still of the jelly). An element's own looks: `src/fire-looks.js`, `src/ice-looks.js`, and the rest in `src/` | Numbers and colours in `content/look.css`: `--pick-*`, `--preview-*`, `--aura-<kind>-*`, `--preview-backdrop-<id>`, `--preview-grade-<id>`, `--type-<id>`, and the `*-showcase-*` values. `Fx` takes `showcase` only on the centre card (`src/fx.js`): effects may spend more there, never in play, where a look keeps today's budget (no added draws, lights or shader programs). Look with `node tools/pick-shots.mjs` (`--only=<type>`, `--side`, `--low`, `--calm`, `--wide`). Stories `types/pick-*` and the per-type `types/*-pick-card-attacks` |
| Attack upgrades (the pick after each of the first three bosses) | `content/upgrades.kdl` | 12 per type, each `jelly="<id>"`, Treasure words; one of a kind, never in a chest. Needs a story |
| Evolutions (Legendary treasures that change what the jelly is) | `content/evolutions.kdl` | They are offered in the Legendary pick after each boss; `not-for=` keeps one off a type it doesn't fit. Treasure words; each changes how you play, has a cost, and an `adorn` piece (`src/adornments.js`) drawn on top of the player's own jelly, never changing it |
| The reward spin (the reels before level-up cards and Treasure picks) | `src/spin.js` (rolls and reel strips, no DOM), `src/spin-screen.js` (the machine), `content/look.css` (`--spin-*`), `src/sfx.js` (`spinLever`, `spinTick`, `spinStop`), stories `spin/*` (`src/stories/spin.js`); the three-of-a-kind rule is in `src/stats.js` | Reels are real rolls from the same eligible pool, on their own seeded generator; they never change the offer, which is rolled first. Only level-up and Treasure picks spin, never boss rewards or Attack upgrades. Odds don't change except the three-of-a-kind upgrade |
| How a Treasure's effect looks (its floor glow, its body, a soft hit) | Floor pools: `src/treasure-glow.js` (`glowPool(kind, colour)`: one shader, kinds glow / lamp / wet / spot / fizz); bodies: `src/treasure-props.js` (`gadgets.props.prop(name, build)`, built at load and shown by the warm-up); the Duck, Cactus, Guitar Pick and Bath Salt's bodies and flights: `src/treasure-bursts.js` (`gadgets.bursts`); the Snooze clock, the Cradle's steel ball and Bloody Fangs' heartbeat: `src/treasure-legends.js` (`gadgets.legends`; the screen's colour drain is `juice.grey`, read by `graphics.js`'s output pass, the HUD veil on Low); the kit's rings, rods and flecks: `src/gadget-looks.js`; colours `--treasure-<id>` in `content/look.css` | Looks only, never a number in `.kdl`. A steady sting passes `feedback: { soft: true }` (no white flash, a glow in its colour; damage and status-damage unchanged), never `tick`. Reduce effects keeps where and how far, drops motion; Low drops sparks and motes. Stories `treasure-glow/*`; bench moment `treasure storm` |
| Treasures | `content/treasures.kdl` | Effect words from `src/words.js` (`TREASURE_WORDS`, `TIMED_WORDS` for `every N { … }`). Systems read the run's combined effects (`run.mods`), never treasure ids. Stacking: a treasure with `level` blocks levels up when taken again (no `stack=`); one without levels stacks by default (3 copies, `stack=N` up to 5; `stack=1` for a rule-changer); Legendary treasures are one of a kind. Give it a `rarity=`: for damage, run `node tests/clear.mjs <id>` using paired controls and several scenarios ([Balance tools](docs/agents/balance-tools.md); quick encounter checks need no permission). The old clear-strength thresholds (Legendary 3.5x+, Epic 2x+, Rare 1.4x+) are rough guides, not automatic rarity assignments; historical `tests/clear-baseline.txt` numbers use the old measurement schema; for anything else, by how unique the effect is. Chest rarity weights live in `src/stats.js` (`CHEST_WEIGHTS`): room Common/Rare/Epic/Legendary 60/30/8/2; Elite 40/40/15/5 per option at 0 Luck, with no forced minimum rarity. Boss rewards are Legendary only (evolutions included), then an Attack upgrade. Before adding one, check no existing treasure already does nearly the same thing |
| Props the layout editor can add (plants: Aloe, Monstera, Pothos, Rubber plant, Snake plant, Spider plant, and two imported snake plants) | `content/props.kdl`; `src/props.js` (`loadProps(ids)`); builders in `tools/props-export.js`, or a downloaded model turned into `tools/props-src/<name>.glb` by `node tools/prop-import.mjs <download> <out> [--tris=4000] [--leaf-texture=512]` and named with `file=` (credit its license in README's Credits); then `node tools/props.mjs` (also run by `tools/export.mjs`) writes `assets/props.glb` | One group per prop, at most 2 vertex-coloured materials; the file downloads only when something asks for a prop; story `props/every-prop-loads` |
| Recorded sounds (sound packs: which roles, when they load, budgets, credits) | `tools/sounds.json`, then `node tools/sounds.mjs <sources folder>` (writes `assets/audio/<pack>.mp3` and `packs.json`); `src/sfx.js` (`sample`, `wantPacks`); `assets/audio/credits.json` | Follow [Sound](docs/agents/sound.md). Every role keeps its synthesized sound; `sounds.html` plays every take; stories in `src/stories/sound.js` |
| Elites (Controller, Mug, Kettle) | `src/elites.js` | Not words yet |
| The boss (Vacuum) | `src/vacuum.js` | Not words yet |
| Bug models / the jelly's model | `src/critters.js` / `src/character.js` | Procedural three.js, no assets |
| How a bug's attack moves (build-up, swing, recoil) | `content/enemies.kdl` (`attack-motion`, one style per basic bug); `src/attack-motion.js` (the attack clock and curves; its top note says how to convert a bug); `content/look.css` (`--bug-attack-*`) | Poses are functions of `e.atk`, never of `e.pos`; the hit timing is fixed by `attacks/animation-never-moves-a-hit`, so a motion change never moves a hit. No flash or colour change on an attacking bug. Stories `motion/*` (`src/stories/bug-attack-motion.js`) |
| How the jelly moves (bell flex, swim stroke and lean, tentacle and oral-arm physics) | The bell's bend: `src/bell-flex.js` (shader patch + `bellFlex` CPU mirror, which the face, hats and tentacle roots follow); the stroke, second surge, idle hold and lean/roll springs: `src/swim.js`; the tentacles: `src/tentacles.js`; the oral arms: `src/arms.js`; the chain step they share: `src/chain.js`; the pieces are joined in `src/character.js`. Knobs: `--jelly-motion-*` in `content/look.css` | Motion never changes the look: `avatar.restPose()` is every clock, spring and input at zero, and `look/rest-pose-unchanged` (`src/stories/rest-pose.json`) fails if any look's rest pose moves. `engine/jelly-motion-budget` caps the tentacle work per frame (`TentacleRig.work`); add no draw calls, lights or shader programs for motion (rule 7), and keep a box jelly's update near 1 ms at 4x CPU throttle. Reels to compare before and after: `node tools/motion-reel.mjs` (about 10 min a size). Stories `motion/*` (`src/stories/motion.js`, `tentacle-motion.js`) |
| Movement and collision | `src/player.js`, `src/collision.js` | |
| How the camera keeps inside the walls (how close it stays, how fast it comes back), which pieces seal the rooms | `content/look.css` (`--camera-clear-*`), `src/camera.js` (`clearTo`); `userData.structural` is set when the apartment is baked (`tools/apartment-source.html`, `tools/exporter.js`) and never fades | Re-bake with `node tools/export.mjs` (restore `assets/apartment.json` if only a flickering lamp's intensity changed), then `node tools/bake-ao.mjs`. Stories `camera/stays-inside-the-shell`, `camera/shell-never-fades` |

## Rules

1. **New behaviour = a new word, not a special case.** If a bug or a treasure needs to do
   something no word can say, add a small word to `src/words.js` (one job, a one-line `doc`,
   named args/props), use it in the `.kdl`, and add a story that proves it (`words/<name>` for
   bug words, `treasures/<name>` for treasure words). Never branch on an id in code
   (`if (e.type === 'roach')`, `owned.has('candle')`). If existing words can say it, use them:
   a new treasure is often just a new combination, e.g. `every 3 { ring 0.1 freeze=1 }`.
2. **Prove it with a story.** `src/stories/<area>.js` hold named situations in the real game (shared
   helpers in `src/stories/kit.js`; `src/stories.js` loads the areas in order); each
   `play()` steps the game and asserts what should happen. Add or update a story for every
   behaviour you change. While you work, run just the stories for what you're touching. Before
   you push `main`:
   - **A code change** (anything in `src/`, `index.html`, `vendor/`, `tests/`): run them all. Every
     push to `main` goes live, and a change in one place (loading, the frame loop) breaks stories
     far from it.
   - **Only `content/` or docs**: run the stories for what you changed plus the guards
     (`node tests/run.mjs content/` and `node tests/run.mjs vocabulary/`); a `look.css` number or
     a README edit needs nothing.

   ```
   cd tests && npm install && npx playwright install chromium   # once
   node tests/run.mjs            # everything
   node tests/run.mjs elites     # just stories whose name contains "elites"
   # a story with `act: 2` (act2/... in src/stories/act2.js) plays in a second page opened on act 2;
   # one with `phone: true` (phone/...) in a page that looks like a phone
   ```

   `node tests/check.mjs` is the fast check (modules parse, guard stories pass); the pre-push hook
   (`.githooks/pre-push`) runs it on every push and refuses a push to `main` whose commit hasn't
   passed a full run. The session start hook sets up three.js and the hooks in cloud sessions.
3. **Attacks speak one visual language** (`src/vfx.js`, think Returnal): hostile is hot and
   saturated, one `--hostile-*` colour per source; friendly is cool (`--friendly`); they never
   share a colour. Elite and Boss attacks take up 3D space (`docs/adr/0001-warnings-show-volume.md`):
   each is a **Blast** (hits anything of the jelly inside a sphere round where it goes off, half a
   sphere on a surface, a whole one in mid-air: `blastHits(centre, r, player.position, cfg)`), a
   **Shot** (aimed in 3D at the jelly, in the air or on the ground: `fx.orb(colour)` + `fx.orbTick`
   each frame + `fx.free`), or a lane or cone with a real height. A **Warning** is a floor shape (a
   `TeleMaterial`: circle / wedge / strip) plus a hex-shell volume of the space the attack will fill
   (`fx.volume(colour, kind, pos, r)`, a `VolumeMaterial`; a new kind is one entry in vfx.js's
   `VOLUME`), both in the source's colour, their `progress` filling together to the moment of the
   hit and removed together. A hit landing is `fx.impact`. Don't add plain grey or brown attacks.
4. **Look values go in `content/look.css`**, not literals in code. Read them with
   `LOOK.num(name, fallback)` / `LOOK.color(...)` / `LOOK.list(...)`.
5. **Don't quietly re-balance.** If a change could make the game harder or easier, offer to
   run the balance bot (**ask the owner first, never run it unasked**; it takes about 15 minutes) before and after (`node tests/balance.mjs 5 --styles=ranged --act-only`: an autopilot plays whole nights
   and reports how long it lasted, its level and kills, and which sources took its Health),
   say what moved with matching seeds and settings (see [Balance tools](docs/agents/balance-tools.md); `tests/balance-baseline.txt` is historical),
   and name the one value to change. Don't tweak content
   numbers to make a test pass.
6. **Look at it.** `index.html?story=<name>` opens a story live (phone or desktop);
   `index.html?stories` lists them. Screenshots of real play beat reasoning about shaders.
7. **Phones first.** Phones start on graphics `medium` (bloom and half-res AO; the player can pick Low, with no bloom or AO, or High), only the chosen tier's shaders are built at startup (`prepareGraphics` in `src/main.js`; switching tier rebuilds behind the menu),
   and the frame governor trades sharpness for smoothness (`src/pacing.js`). Never add or remove a light during play (a new light count rebuilds
   every shader and stalls a phone); a new lamp is a `userData.lamp` point light that `src/light-slots.js` shares. Keep draw
   calls low: small moving things are instanced through `src/batch.js` (`batcher.track(mesh)`);
   hot loops reuse vectors instead of allocating (`world.cast` allocates nothing on a miss).
8. **Systems talk through the event bus** (`src/events.js`): `damage_taken`, `status_applied`,
   `knockback`, `enemy_killed`… Don't write another system's data directly.
9. **Ship through a reviewed pull request:** for game changes, add a note
   `changes/<branch>.md` with the changelog entry, without a version number
   (`changes/README.md`). Never edit `BUILD` in `src/main.js` or the changelog's `vN …` lines:
   after the merge, the "Number the build" workflow gives each note the next BUILD,
   moves it into `CHANGELOG.md` and commits that to main, so parallel pull requests never
   collide on a number. Documentation-only changes need no note. `README.md` keeps one sentence per line
   (renders the same; edits to different sentences then never conflict): `node tools/one-sentence.mjs`
   rewraps it, and `node tests/check.mjs` fails until it's wrapped. Run the stories (rule 2), commit to a feature branch, push the branch,
   and open a pull request. Follow the release approval and final verification
   steps above before merging into `main`. Republish the artifact only as part of
   an explicitly requested release (`docs/agents/publishing.md`).

## Next (the same pattern, not done yet)

- **Elites and the Vacuum as stacked words** (a telegraph shape + an effect per attack).

## Agent skills

### Game toolkit

For combat design/feel reviews, phone performance investigations, and playtest
analysis, use the focused [game toolkit](docs/agents/game-toolkit.md). Shared
workflows live in `.claude/skills/jelly-*/SKILL.md`; `.agents/skills/` provides
Codex discovery entries. Load only the workflow relevant to the request.

### Motion design

For any UI animation, transition or micro-interaction, follow `.claude/skills/motion-design/SKILL.md`
(LottieFiles, MIT; Codex entry in `.agents/skills/motion-design`). Use the `--ui-fast/mid/slow` and
`--ui-ease-*` tokens in `content/look.css`, animate only `transform` and `opacity` on phones, and keep
Reduce effects (`body.calm`, OS reduced motion) to fades.

### Issue tracker

GitHub Issues on `Chanksyou/Jellyfight` (no `gh` in cloud sessions: use the GitHub MCP tools). See `docs/agents/issue-tracker.md`.

### Triage labels

The five defaults: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root, created when first needed. See `docs/agents/domain.md`.
