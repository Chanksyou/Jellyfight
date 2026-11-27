# Jelly types: the pick screen

Built in P5 and redesigned as a Spotlight + 2D Roster Grid so the screen scales cleanly as the roster grows past 10–20+ types.

## Layout

- **Two-column landscape layout** (both desktop and phones held sideways; stacks Spotlight above Roster Grid on narrow portrait screens).
- **Left — Spotlight card.** The selected jelly's full name, a **Favorite (`★`)** toggle, its framed portrait/live attack preview beside the 6 stat bars, stat-diff chips, one line on the signature attack, and **Play** (or for a locked type, its unlock goal and progress, e.g. `"Defeat 6 Elites: 4/6"`).
- **Right — 2D Roster Grid.** A scrollable grid of square tiles, ordered:
  1. **Random (`?`)** tile first (always visible without scrolling)
  2. **Favorites (`★`)** (unlocked, in `content/jellies.kdl` order)
  3. **Remaining unlocked jellies** (in `content/jellies.kdl` order)
  4. **Locked jellies** at the end, dimmed with a lock pip (still tappable to inspect aura, stats, and unlock progress)
- **Tile visuals.** Each visible jelly tile animates its element aura shader (`src/pick-aura.js`) around the player's own jelly at `--pick-aura-fps`, plus its short name underneath (Reduce effects holds a single frozen frame).
- **Navigation.** Tap/click any tile to select immediately; swipe left/right or scroll wheel on the Spotlight to browse casually; arrow keys move in 2D (`Left`/`Right` step, `Up`/`Down` move by row); `Enter` plays; `Escape` goes back.
- **Random (`?`) roulette.** Tapping Random sweeps a highlight across unlocked tiles (`--pick-roll-time`, `--pick-roll-steps`) with `spinTick` / `spinStop` sounds and selects the landed jelly into the Spotlight (instant jump with Reduce effects).
- **Persistence.** Last-picked jelly (`jellyrun.jelly`) and Favorites (`jellyrun.favJellies`) persist in `localStorage`.
- **First run.** A first-time player never sees this screen (`src/first-run.js`); the run starts as Normal.

## The live Spotlight

Once settled on an unlocked jelly, the Spotlight's portrait comes alive (`src/attack-preview.js`): the jelly, in the player's look and the type's look, fires its real main attack at three roaches with a roach's Health, which die the game's way (`showKill` in `src/feedback.js`) and come back.
It runs the game's own `Bubbles` and `Lash` with the type's level-1 stats and `attack=`/`hit=`, so a new type whose attack works in play shows here with nothing added.
Only the Spotlight animates; while loading, on locked jellies, or when live preview is off, the Spotlight shows the type's animated element aura shader (`src/pick-aura.js`). Reduce effects holds a single frozen frame and skips the roulette sweep and Play squeeze.

## The 6 bars

Each bar is a number from 0 to 1, worked out from the type's level-1 stats so it can never drift from the real values. Normal sits at 0.5 on every bar.

| Bar | Value before scaling |
| --- | --- |
| Damage | Attack damage x the type's `hit` multiplier |
| Attack speed | Fire rate |
| Range | Range, or Tentacle reach for the Tentacle jelly |
| Area | Attack size, times 1.5 if the attack splashes, arcs or bursts; Attacks for the Tentacle jelly |
| Toughness | Health + Shield + 20 x Health regen a second, all divided by (1 - Dodge) |
| Mobility | Move speed x the square root of Jump height |

Scaling: bar = value / (2 x Normal's value), capped at 1. For Range, the Tentacle jelly uses the same scale as everyone (11 cm against Normal's 30 cm), so its bar is honestly short. For Area, the Tentacle jelly's bar is Attacks / 6.

Put the formula in one function with a story that pins Normal at 0.5 on all six.

## Feel

This screen is the first thing a returning player touches each run. Give the tile pick, the Random roulette, Favorite pinning, and Play the same care as the existing menus (`src/main-menu.js`, sounds in `src/sfx.js`). Honour the OS "reduce motion" setting, as the rest of the game does.

## Stories

- `types/pick-screen-shows-every-type`
- `types/pick-screen-motion`
- `types/pick-screen-favorites-and-random`
- `types/pick-screen-locked-card-says-how-to-open`
- `types/pick-screen-locked-card-cannot-play`
- `types/pick-screen-bars-normal-is-half`
- `types/pick-screen-fits-phone` (`phone: true`)
- `types/pick-screen-centre-card-attacks`
- `types/first-run-is-normal`
