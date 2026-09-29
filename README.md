# Jelly Fight

A third-person game where you play a ~5 cm critter of your own design inside a real-scale 3D model of the apartment.

## Run it

ES modules won't load over `file://`, so serve the folder:

```
npx http-server -c-1        # or: python -m http.server
```

Open the printed localhost URL. The VS Code "Live Server" extension also works.

## The game

You're an immortal jellyfish growing up over one night in the apartment. Stage 1 (Polyp) is the living room and its kitchen strip, midnight to 2 am (5 real minutes). The bathroom and hallway are kept for a later stage (`src/stage-bathroom.js`).

- **You attack on your own, two ways.** Your main attack is **bubbles**: the bell squeezes and blows them at enemies in range; they pop for damage and a small splash. Level-up cards improve them (more bubbles per volley, range, pop damage, blow rate, bubble size). Element treasures infuse them, and they stack: fire (burns; shatters frozen enemies), lightning (arcs to 2 more), ice (chills, then freezes), acid (puddles), wind (knockback) and glitter (bigger splash). Up close, your **tentacles** sting automatically; only treasures improve them (Fishing Line, Chopstick, Hot Sauce, Cactus Spine, Festival Wristband). You swim, jump and position.
- **Bugs** come for you and drop **dew** (your XP) when you clear them: **cockroaches** scuttle straight at you; **ant squads** (five ants in a block) curl into a ball and roll into you; **mosquitoes** hover out of reach and spit at you. There aren't many at once, but each is worth a lot. Each piece of high ground has an **elite**, an object there that came alive, each with its own attack: the **Controller** on the media console (spreads of button shots), the **Mug** on the desk (lobs coffee that leaves scalding puddles) and the **Kettle** on the stove (whistles, then blasts steam). They only fight when you come close. Beat one for 20 dew, moisture and a treasure pick.
- **Lost things up high:** gift boxes on the kitchen counter, the sofa arm, the top of a pillow and the back of the lounge chair, each a treasure pick for the climb.
- **Every run starts with a treasure:** pick 1 of 3 before the night begins.
- **Level up** by collecting dew (levels come slowly): pick 1 of 3 cards, each one stat and one number (bubble stats, moisture, swim speed, bounce). One free reroll per level.
- **Moon Drops** spawn one at a time somewhere in the stage and show on the minimap with how far above or below you they are. Each of the first 3 lets you keep 1 of 3 **treasures**: lost things with a unique effect, once per run. There are 30: lash upgrades, things that attack on their own (a chord every 5 s, remote zaps, orbiting fairy lights, a burning moonbeam, Lego traps, bowling marbles, freezes, auras), and rule-benders (marks that make enemies take more damage, more dew, better level-up cards, a later boss). The 4th (bigger, orange) summons **The Vacuum**, a robot vacuum that powers on in front of the kitchen. It chases and bumps you, and cycles through attacks: a telegraphed charge, suction that pulls you in, spinning-brush sweeps, dumping cockroaches from its bin, and (once hurt) a spin that sprays dust.
- Beat it and you **metamorphose** into an Ephyra (pick 1 of 3 evolutions). Dry out and you shrink back to a polyp and start over.
- **5 minutes per stage.** At 2 am the moonlight drags you to the boss whether you have the drops or not, so the drops are a race: get them fast and you go in with more treasures (or summon the boss early).

**Getting around:** the jelly swims in strokes (`src/swim.js`): the bell squeezes shut and it surges, then relaxes open and glides. The movement and the animation read the same curve and has a double jump (the Pen Spring treasure makes it a triple). Floor vents fling you in an arc straight onto the sofa, coffee table, media console, desk, lounge chair and stovetop. Hold Space to climb the front of the corduroy sofa.

## Controls

WASD move · mouse look · Space jump, again in the air to double jump (hold to climb fabric) · 1/2/3 pick a card · R reroll · wheel zoom · Esc pause · F3 debug readout. "Look" in the pause menu opens the character creator. On phones: left thumb moves, right thumb looks, ⤴ jumps (tap again in the air to double jump, hold to climb).

## How it fits together

The apartment is a static 3D model, `assets/apartment.glb` (geometry, materials, textures, and doors as separate nodes), plus `assets/apartment.json` (floor plan, door angles, the lights at midnight). `apartment.glb` is meshopt-compressed (~5 MB, needs WebAssembly); `apartment-q.glb` is the same model without that compression (~9 MB), loaded automatically if WebAssembly is blocked. Nothing from the original apartment app runs in the game.

`src/boot.js` sets up three.js (r170 from jsDelivr), loads the apartment with `src/apartment.js`, then starts `src/main.js`.

The apartment's colors and lights were authored for three.js r128, so the game keeps color management off and `src/legacy-lighting.js` renders the lights with r128's falloff and scaling.

Desktop uses a logarithmic depth buffer, so the camera can sit 2 mm from a wall without flicker. Phones skip it (it defeats their GPUs' hidden-surface removal) and use a 5 mm near plane.

### Re-baking the apartment

`tools/apartment-source.html` is the full apartment app, kept only as the source for the bake. After changing it:

```
cd tools
npm install
npx playwright install chromium
npm run export
```

The bathroom's close-up details live in the source too: the vanity's undermount basin (a real bowl under a hole in the counter), the oval toilet seat, the loop-pile bath mat, canvas laundry bags, panelled doors and fabric coats. A material whose bump map is its own color map keeps its bump through the bake.

The exporter (`tools/exporter.js`) keeps the meshes inside the rooms. It drops everything else: the neighborhood, the corridor, the sky, Dendi, particles and helpers. Doors are exported closed as `door-<id>` nodes. `tools/compress.mjs` then meshopt-compresses the geometry (about 17 MB down to 5 MB).

| File | What it does |
| --- | --- |
| `src/boot.js` | Renderer, camera, loading screen; loads the apartment, starts the game. |
| `src/apartment.js` | Loads the baked apartment, recreates its lights and reflections, exposes the doors. |
| `src/main.js` | Wires everything up: pause menu, creator mode, graphics, blob shadow, frame loop. |
| `src/config.js` | Tuning numbers: player size, speed, jump, gravity, camera. Units are meters. |
| `src/character.js` | Character looks (options, defaults, random) and the procedural model + animation (the jellyfish's pulsing bell). |
| `src/swim.js` | One bell stroke: the squeeze, the thrust, and how often strokes come. Shared by movement and animation. |
| `src/tentacles.js` | The jellyfish's 6 live tentacles: hang, trail, stream when falling, whip out when the Lash strikes. |
| `src/creator.js` | Character creator panel. |
| `src/hud.js` | Moisture, XP, dew, night clock, Moon Drops, treasures, minimap with markers, boss bar, hints, toasts. |
| `src/graphics.js` | Post-processing: ambient occlusion (N8AO), depth of field, bloom, vignette. Low / Medium / High in the pause menu. |
| `src/detail.js` | Fine close-up detail (normal maps): grain on floors and rugs, an orange-peel paint finish on walls, doors, cabinets and porcelain. |
| `src/player.js` | Swimming movement, low-gravity jump and double jump, vent launches, climbing, wall sliding, stepping up small ledges. |
| `src/camera.js` | Orbit camera that follows the player and pulls in when furniture is in the way. |
| `src/collision.js` | Raycast collision against the apartment's meshes, with a BVH per mesh and a nearby-object filter. |
| `src/input.js`, `src/touch.js` | Keyboard and pointer-lock mouse; phone joystick, look drag and buttons. |
| `src/errors.js` | On-screen error panel and the Diagnostics readout (pause menu, or `#debug`). |
| `src/legacy-lighting.js` | Renders r128-era lights under r170. |
| `vendor/` | three-mesh-bvh 0.8.3, n8ao 2.0.1 (plus a stub for its unused `postprocessing` import). |

## Characters and swapping in a real model

A look is plain JSON (`{ name, body, finish, color, accent, pattern, eyes, eyeColor, mouth, top, topColor, feet, size }`). `buildCharacter(look, heightMeters)` returns an avatar:

```js
{ root: THREE.Object3D, update(dt, { speed, walkSpeed, grounded, vy, swim, vel }), land(impact), dispose(),
  pulse(), tentacles }   // optional: a jump's bell squeeze; a TentacleRig the Lash strikes with
```

The player only talks to that interface (`player.setAvatar(avatar)`), so a rigged glTF character can replace the procedural one by writing another builder that returns the same shape. It would drive its animation mixer from `update()` and map the look's colors and hat onto the model.

## Stage and tuning files

| File | What's in it |
| --- | --- |
| `src/stage1.js` | The living room: rooms, start, doors, invisible walls, vents (and where each lands you), climbable fabric, Moon Drop spots, boss arena and its walls. Positions are world meters. |
| `src/stage-bathroom.js` | The bathroom and hallway, in the same format, for a later stage. |
| `src/stats.js` | Base stats, level-up cards and their numbers, XP curve, treasures, evolutions. |
| `src/enemies.js` | Enemy types (health, speed, damage, size, dew), their angry eyes, and how they move. |
| `src/run.js` | Wave pacing, Moon Drops and treasure picks, damage, treasure effects, boss flow, death and victory. |
| `src/elites.js` | The high-ground elites: Controller, Mug and Kettle, their models and attacks. |
| `src/gadgets.js` | Treasures that act on their own: Guitar Pick, TV Remote, Fairy Lights, Magnifying Glass, Glow Stick, Ice Cube, Lego Brick, Marble. |
| `src/bubbles.js` | The main attack: bubble volleys, steering, popping, splash, the bubble treasures and the six elements. |
| `src/combat.js` | The Lash (close-range tentacle sting): targeting, picking which tentacle strikes, and its treasures. |
| `src/vacuum.js` | The Vacuum, stage 1's boss, and its attacks. |
| `src/boss.js` | Simpler bosses: The Clog (bathroom) and The Dust King. |
| `src/critters.js` | Bug models with moving legs and wings: cockroach, ant squad, mosquito. |
| `src/traversal.js` | Vent launch pads, climbing, and per-stage apartment setup (doors, see-through curtain, walls). Objects are looked up by name, e.g. `Shower curtain`. |
| `src/pickups.js` | Dew and the Moon Drop. |
| `src/ui.js`, `src/hud.js`, `src/fx.js` | Menus, HUD and minimap, damage numbers and poofs. |
