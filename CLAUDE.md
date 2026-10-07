# Jelly Fight: how to change this game

A jellyfish roguelike in a real-scale 3D apartment. Three.js, plain ES modules, no build step.
Players are on phones (iPhone 13+ in Safari, Pixel 8+ in Chrome) as much as desktops.

The game is meant to be changed by short requests to agents that have never seen it. That
works because every kind of change has **one home**, things are described in **plain-text
content** with a small **vocabulary**, and **stories** prove behaviour. Keep it that way.

Words: `GLOSSARY.md` is the game's vocabulary (Health, XP, Treasure, Element, Elite…), the same in player text, code and content. The story `vocabulary/no-retired-words` fails if player text uses a word it lists under _Avoid_.

## Where each kind of change lives

| To change… | Edit | Notes |
|---|---|---|
| A bug's numbers or behaviour | `content/enemies.kdl` | Behaviour is words from `src/words.js` (`ENEMY_WORDS`) |
| When bugs appear, how many, how fast | `content/waves.kdl` | |
| Colours, glow, night lighting, haze, bloom, camera, jelly size | `content/look.css` | Read by `src/look.js` at startup |
| What a new player's first run introduces, and when | `src/first-run.js` | The run asks it at a few points; stories use `fresh({ firstRun: true })` |
| Frame-rate cap, pixel ratio range, lamps lit at once on phones | `content/look.css` (`--phone-fps`, `--*-pixel-ratio`, `--phone-lights`) | Logic in `src/pacing.js` and `src/light-slots.js`; graphics-reset recovery in `src/gpu-recovery.js` |
| Vents, treasure times and spots, elite spots, boss arena | `src/stage1.js` (act 1), `src/stage2.js` (act 2); acts listed in `src/stages.js` | Plain data. Vents can also be dragged in the layout editor; bake exported `vent:<name>` positions into the vent list here |
| Which rooms each act loads | `tools/split.mjs` (`ACTS`), then `node tools/split.mjs`; a stage's `parts` | The game never loads the whole apartment; act 2/3 load with `GAME.loadRooms` |
| Furniture placement | the dev layout editor (pause menu) → export → `src/layout-baked.js` | |
| Player stats and level-up cards | `src/stats.js` (`BASE_STATS`, `CARD_VALUES`) | |
| Treasures | `content/treasures.kdl` | Effect words from `src/words.js` (`TREASURE_WORDS`, `TIMED_WORDS` for `every N { … }`). Systems read the run's combined effects (`run.mods`), never treasure ids. Unique by default; `stack=N` only for plain number boosts. Give it a `rarity=`: for damage, run `node tests/clear.mjs <id>` and compare with `tests/clear-baseline.txt` (legendary 3.5x+, epic 2x+, rare 1.4x+ faster clearing 10 clumped cockroaches; it's quick, no need to ask); for anything else, by how unique the effect is. Before adding one, check no existing treasure already does nearly the same thing |
| Elites (Controller, Mug, Kettle) | `src/elites.js` | Not words yet |
| The boss (Vacuum) | `src/vacuum.js` | Not words yet |
| Bug models / the jelly's model | `src/critters.js` / `src/character.js` | Procedural three.js, no assets |
| Movement and collision | `src/player.js`, `src/collision.js` | |

## Rules

1. **New behaviour = a new word, not a special case.** If a bug or a treasure needs to do
   something no word can say, add a small word to `src/words.js` (one job, a one-line `doc`,
   named args/props), use it in the `.kdl`, and add a story that proves it (`words/<name>` for
   bug words, `treasures/<name>` for treasure words). Never branch on an id in code
   (`if (e.type === 'roach')`, `owned.has('candle')`). If existing words can say it, use them:
   a new treasure is often just a new combination, e.g. `every 3 { ring 0.1 freeze=1 }`.
2. **Prove it with a story.** `src/stories.js` holds named situations in the real game; each
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
   # a story with `act: 2` (act2/... in stories.js) plays in a second page opened on act 2;
   # one with `phone: true` (phone/...) in a page that looks like a phone
   ```

   `node tests/check.mjs` is the fast check (modules parse, guard stories pass); the pre-push hook
   (`.githooks/pre-push`) runs it on every push and refuses a push to `main` whose commit hasn't
   passed a full run. The session start hook sets up three.js and the hooks in cloud sessions.
3. **Attacks speak one visual language** (`src/vfx.js`, think Returnal): hostile is hot and
   saturated, one `--hostile-*` colour per source; friendly is cool (`--friendly`); they never
   share a colour. A new enemy projectile is `fx.orb(colour)` + `fx.orbTick` each frame + `fx.free`;
   a new warning on the floor is a `TeleMaterial` (circle / wedge / strip) whose `progress` fills
   to the moment of the hit; a hit landing is `fx.impact`. Don't add plain grey or brown attacks.
4. **Look values go in `content/look.css`**, not literals in code. Read them with
   `LOOK.num(name, fallback)` / `LOOK.color(...)` / `LOOK.list(...)`.
5. **Don't quietly re-balance.** If a change could make the game harder or easier, offer to
   run the balance bot (**ask the owner first, never run it unasked**; it takes about 15 minutes) before and after (`node tests/balance.mjs 5`: an autopilot plays whole nights
   and reports how long it lasted, its level and kills, and which sources took its Health),
   say what moved with those numbers (the last recorded run is `tests/balance-baseline.txt`),
   and name the one value to change. Don't tweak content
   numbers to make a test pass.
6. **Look at it.** `index.html?story=<name>` opens a story live (phone or desktop);
   `index.html?stories` lists them. Screenshots of real play beat reasoning about shaders.
7. **Phones first.** Phones run graphics Auto: `low` (no bloom, no AO), stepping up to `medium` only while
   frames stay quick (`src/pacing.js`). Never add or remove a light during play (a new light count rebuilds
   every shader and stalls a phone); a new lamp is a `userData.lamp` point light that `src/light-slots.js` shares. Keep draw
   calls low: small moving things are instanced through `src/batch.js` (`batcher.track(mesh)`);
   hot loops reuse vectors instead of allocating (`world.cast` allocates nothing on a miss).
8. **Systems talk through the event bus** (`src/events.js`): `damage_taken`, `status_applied`,
   `knockback`, `enemy_killed`… Don't write another system's data directly.
9. **Ship it the same way every time:** bump `BUILD` in `src/main.js`, update `README.md`,
   run the stories (rule 2), commit, push `main` (no need to ask), then republish the artifact
   (`docs/agents/publishing.md`).

## Next (the same pattern, not done yet)

- **Elites and the Vacuum as stacked words** (a telegraph shape + an effect per attack).

## Agent skills

### Issue tracker

GitHub Issues on `Chanksyou/Jellyfight` (no `gh` in cloud sessions: use the GitHub MCP tools). See `docs/agents/issue-tracker.md`.

### Triage labels

The five defaults: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root, created when first needed. See `docs/agents/domain.md`.
