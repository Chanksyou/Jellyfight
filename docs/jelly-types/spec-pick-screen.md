# Jelly types: the pick screen

Built in P5. The owner's sketch is `pick-screen-sketch.png` in this folder.

## Layout

- **Carousel.** One card per type in a row. The centre card is the largest, its neighbours are smaller, and the next ones are cut off at the screen edges, so it's clear there's more to scroll.
- **Card.** The type's name on top. Then a framed portrait: the player's own jelly wearing that type's look, spinning slowly (`src/jelly-portrait.js`). Then the 6 bars.
- **Moving.** Swipe or drag on phones. Arrow keys or the mouse wheel on desktop. Tapping a side card brings it to the centre. The centre card snaps into place.
- **Centre card only: a details panel under the bars.**
  - The stats the bars fold together or leave out, each as a difference from Normal: "+5 Shield", "Pierce +1", "+10 Luck", "Dodge 5%", "Jump height 120%". List only what differs.
  - One line on the signature attack.
  - **Play**, or for a locked type its unlock goal and progress ("Defeat 6 Elites: 4/6").
- **Side cards** show only the name, portrait and bars. A locked card is greyed out.
- **Phones in landscape.** The centre card must fit the screen height. If it doesn't, put the bars beside the portrait instead of under it.
- **First run.** A first-time player never sees this screen (`src/first-run.js`); the run starts as Normal.

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

This screen is the first thing a returning player touches each run. Give the snap, the card change and Play the same care as the existing menus (`src/main-menu.js`, sounds in `src/sfx.js`). Honour the OS "reduce motion" setting, as the rest of the game does.

## Stories

- `types/pick-screen-shows-every-type`
- `types/pick-screen-locked-card-cannot-play`
- `types/pick-screen-bars-normal-is-half`
- `types/pick-screen-fits-phone` (`phone: true`)
- `types/first-run-is-normal`
