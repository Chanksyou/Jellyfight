# Jelly Fight

A third-person game where you play a ~3.5 cm critter of your own design inside a real-scale 3D model of the apartment.

## Run it

ES modules won't load over `file://`, so serve the folder:

```
npx http-server -c-1        # or: python -m http.server
```

Open the printed localhost URL. The VS Code "Live Server" extension also works.

## Controls

WASD move · mouse look · Space jump · Shift sprint (uses stamina) · wheel zoom · R respawn · C character creator · Esc pause · G apartment viewer · F3 debug readout

On first visit the character creator opens before you play. Your character is saved in the browser (localStorage).

## How it fits together

`index.html` is the apartment app. Its code lives in a `<script type="text/plain" id="apartment-src">` block and is run unchanged by `src/boot.js` once three.js (r170, from jsDelivr) has loaded. The apartment has a few small hooks, each marked `JELLY`:

1. `logarithmicDepthBuffer: true` on the renderer, so a 2 mm camera near plane doesn't make surfaces flicker.
2. The render loop calls `GAME.step(dt)` and `GAME.render()` instead of its own camera and render while the game is active.
3. `window.APT` exposes the scene, renderer, camera and floor plan, plus `enterGame()` / `exitGame()`.
4. A style rule that hides the apartment's UI in game mode.

The apartment was written for three.js r128. For r170 it only needed the color-space renames; `src/legacy-lighting.js` keeps its lights looking the same (old falloff, and the PI scaling legacy lights had). `apartment-original.html` is the untouched r128 original.

| File | What it does |
| --- | --- |
| `src/boot.js` | Loads three.js, runs the apartment, starts the game. |
| `src/main.js` | Game modes (play, pause menu, creator), spawn, health, stamina, blob shadow. |
| `src/config.js` | Tuning numbers: player size, speed, jump, gravity, camera. Units are meters. |
| `src/character.js` | Character looks (options, defaults, random) and the procedural model + animation. |
| `src/creator.js` | Character creator panel. |
| `src/hud.js` | Hearts, stamina bar, minimap of the floor plan, room name, toasts. |
| `src/graphics.js` | Post-processing: ambient occlusion (N8AO), depth of field, bloom, vignette. Low / Medium / High in the pause menu. |
| `src/detail.js` | Fine bump detail on floors and rugs, which otherwise look flat up close. |
| `src/player.js` | Movement, jumping, wall sliding, stepping up tiny ledges, landing and fall tracking. |
| `src/camera.js` | Orbit camera that follows the player and pulls in when furniture is in the way. |
| `src/collision.js` | Raycast collision against every visible apartment mesh (the neighborhood outside is excluded), with a BVH per mesh and a nearby-object filter. |
| `src/input.js` | Keyboard and pointer-lock mouse. |
| `src/legacy-lighting.js` | Keeps r128-era lighting under r170. |
| `vendor/` | three-mesh-bvh 0.8.3, n8ao 2.0.1 (plus a stub for its unused `postprocessing` import). |

## Characters and swapping in a real model

A look is plain JSON (`{ name, body, finish, color, accent, pattern, eyes, eyeColor, mouth, top, topColor, feet, size }`). `buildCharacter(look, heightMeters)` returns an avatar:

```js
{ root: THREE.Object3D, update(dt, { speed, walkSpeed, grounded, vy }), land(impact), dispose() }
```

The player only talks to that interface (`player.setAvatar(avatar)`), so a rigged glTF character can replace the procedural one by writing another builder that returns the same shape. It would drive its animation mixer from `update()` and map the look's colors and hat onto the model.

## Game rules so far

- 5 hearts. Falls over 0.7 m hurt (half a heart, plus half per extra 30 cm). At zero you respawn.
- Sprinting drains stamina in 3.5 s. Run it dry and you can't sprint again until it's back to 35%.
