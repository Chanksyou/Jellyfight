# Jelly Fight

A third-person game where you play a ~9 cm jellyfish of your own design inside a real-scale 3D model of the apartment.

## Run it

ES modules won't load over `file://`, so serve the folder:

```
npx http-server -c-1        # or: python -m http.server
```

Open the printed localhost URL. The VS Code "Live Server" extension also works.

## The game

You're an immortal jellyfish growing up over one night in the apartment. Stage 1 (Polyp) is the living room and its kitchen strip, midnight to 2 am (5 real minutes).

It's night: the room is lit only by its lamps (warm pools of light, dark corners, a faint haze across the room), and you're a fluorescent jelly in it: a tall clear bell with glowing canals and a bright rim, long glowing tentacles and frilly blue oral arms, with a soft halo and a small light of your own that tints the floor around you. The bugs, elites and the Vacuum carry a faint glow and a warm rim light so they read against the dark, and their angry eyes shine. The bathroom and hallway are kept for a later stage (`src/stage-bathroom.js`).

- **You attack on your own, two ways.** Your main attack is **bubbles**: the bell blows a steady stream of bubbles, one after another (about 1.8 a second to start), at enemies in range; each pops hard (6 damage) with a small splash. Stream speed is blow rate × bubbles, so every bubble or blow-rate card makes the stream visibly faster, and extra bubbles spread across more targets. Level-up cards improve them (bubbles, range, pop damage, blow rate). Element treasures infuse them, and they stack: fire (burns; shatters frozen enemies), lightning (arcs to 2 more), ice (chills, then freezes), acid (puddles), wind (knockback) and glitter (bigger splash). Up close, your **tentacles** sting automatically at a fixed strength; the Stinging Frills evolution is the only thing that changes them. You swim, jump and position.
- **Bugs** come for you and drop **dew** (your XP) when you clear them: **cockroaches** scuttle straight at you (a little slower than you swim, so you can always get away from one); **ant squads** (five ants in a block, from 0:30) curl into a ball and roll into you; **mosquitoes** hover out of reach and shoot laser bolts: a flickering red beam shows where the bolt will go (brighter as the shot nears), it locks on halfway through, and stepping off the line dodges it. From 2:00, **spotted lanternflies** crawl after you, crouch over a red ring marking where they'll land, then leap high (flashing their red hindwings) and slam down on it: step out of the ring. There aren't many at once, but each is worth a lot. Each piece of high ground has an **elite**, an object there that came alive, each with two attacks it alternates, every one telegraphed on the ground before it lands: the **Controller** on the media console (three colored aim lines, then a button barrage; a red rumble circle that fills, then a shockwave), the **Mug** on the desk (coffee lobs onto filling brown circles that leave scalding puddles; a tip-over with an arrow, then a spill that pours puddles along it) and the **Kettle** on the stove (whistles with a blue steam cone drawn where it'll blast; boils over, raining drops on filling orange circles). They turn to face you before winding up and only fight when you come close. Beat one for 20 dew, moisture and a treasure pick.
- **Golden gifts:** at 0:15, 1:00, 1:45, 2:30, 3:00 and 3:45 a bright glowing gold gift box turns up somewhere else in the room (under a tall beam of gold light, and on the minimap) and waits 15 s, its ring on the floor draining and blinking as time runs out. Reach it in time for a treasure pick; otherwise it fades away. The times and how long each stays are `gifts` in `src/stage1.js`.
- **Every run starts with a treasure:** pick 1 of 3 before the night begins.
- **Level up** by collecting dew (cockroaches drop 1, ant squads 2, mosquitoes 5; each level needs 1.5x the dew of the last, starting at 3: 3, 5, 7, 10, 15, 23…): pick 1 of 3 cards, each one stat and one number (bubbles, range, pop damage, blow rate, max moisture, swim speed, moisture regen, dodge %, luck). Regen, dodge and luck start at 0; dodge caps at 60%. Luck makes rarer cards and treasures come up more often. One free reroll per level.
- **Moon Drops** spawn one at a time somewhere in the stage and show on the minimap with how far above or below you they are. The minimap draws the room, furniture footprints (lighter is taller), vents, enemies (red dots), gifts, elites and the boss, each with its height difference in cm. Each of the first 3 lets you keep 1 of 3 **treasures**: lost things you keep all run, each rated common, rare, epic or legendary (rarer ones come up less often; luck shifts the odds). Most are unique (one each); plain number boosts (Lemon Slice, Hand Cream, Odd Sock…) are stackable and can be picked up to 2 or 3 times, showing ×2 in the HUD. There are 47: bubble and element upgrades, stat boosts (regen, dodge, damage, range), Brotato-style trade-offs (a glass cannon, life steal, bait that brings more bugs and more dew) and slow growers (+max moisture or damage every N kills), things that attack on their own (a chord every 5 s, remote zaps, orbiting fairy lights, a burning moonbeam, Lego traps, bowling marbles, freezes, auras), and rule-benders (marks that make enemies take more damage, more dew, better or more level-up cards, slower bugs). The 4th (bigger, orange) summons **The Vacuum**, a robot vacuum that powers on in front of the kitchen. It chases and bumps you, and cycles through attacks: a telegraphed charge, suction that pulls you in, spinning-brush sweeps, dumping cockroaches from its bin, and (once hurt) a spin that sprays dust.
- Beat it and you **metamorphose** into an Ephyra (pick 1 of 3 evolutions). Dry out and you shrink back to a polyp and start over.
- **5 minutes per stage.** At 2 am the moonlight drags you to the boss whether you have the drops or not, so the drops are a race: get them fast and you go in with more treasures (or summon the boss early).

**Getting around:** the jelly swims at a steady speed while its bell pulses in strokes (`src/swim.js`), faster the harder you push. It has a double jump (the Pen Spring treasure makes it a triple). Floor vents fling you in an arc straight onto the sofa, coffee table, media console, desk, lounge chair and stovetop. Hold Space to climb the front of the corduroy sofa.

## Changing the game

Most changes are edits to plain-text files, not code. `CLAUDE.md` is the full map (agents read it automatically):

- **`content/enemies.kdl`**: every bug as a few numbers and a few behaviour words, e.g. `chase 0.3`, or `curl-dash windup=0.6 time=0.7 speed=0.75 rest=0.8 dmg=3`. Each word is defined once in `src/words.js` with what its numbers mean. A typo stops loading with a message naming the file and line.
- **`content/waves.kdl`**: how fast bugs arrive, how many at once, how much tougher they get, and from when each kind appears.
- **`content/treasures.kdl`**: all 47 treasures, each a name, icon, text and effect words (and `stack=N` for stackable ones), e.g. `pierce 3`, `crit chance=0.2 mult=3`, or `every 5 { ring 0.13 dmg=1.2 push=0.035 }`. A new treasure that combines existing effects needs no code.
- **`content/look.css`**: colours and render numbers: the night fill, haze, bloom, the jelly's size, colour, glow and light, how much enemies glow, gut colours, the camera.

**Stories** (`src/stories.js`) are named situations in the real game, like Storybook: `index.html?story=words/curl-dash` opens one live (on a phone too), `index.html?stories` lists them all. Each story's `play()` also runs headlessly and checks what should happen. `node tests/run.mjs` plays every story plus a phone touch check and fails on any broken behaviour or console error. Setup: `cd tests && npm install && npx playwright install chromium`.

**The balance bot** (`node tests/balance.mjs 5`) plays whole nights on autopilot and reports how long it lasted, its level and kills, whether it beat the boss, and which sources took its moisture. Run it before and after anything that could make the game harder or easier.

## Dev: layout editor

**🛠 Layout (dev)** in the pause menu lets you move, rotate, raise/lower and hide the furniture and objects. Tap or click an object to select it (a yellow box shows it), drag it to move it. Desktop: WASD pan, wheel zoom, right-drag turns the view, Q/E rotate 15° (Shift: 90°), R/F raise/lower 1 cm (Shift: 5 cm), H hide, Ctrl+Z undo. Touch: drag empty space to pan, pinch to zoom, and use the toolbar.

Edits are saved in the browser (`localStorage` key `jf-layout-v1`) and applied on every load before collisions are built, so moved furniture is solid where it is. **Export** shows a JSON code; paste it back to Claude to bake the layout into the stage for everyone. Baked edits live in `src/layout-baked.js`; they load first and become each object's "home", with your own browser edits on top. **Vents** are edited here too: each shows an orange disc (the grille on the floor) and a cyan ball (where it throws you) joined by the jump's arc. Drag either and it sticks to whatever surface is under the pointer (point at a cushion or a shelf); R/F nudge it up or down, ⌂ puts it back. They export with the furniture as `vent:<name>` entries, which get baked into the vent list in `src/stage1.js`. Other stage markers (Moon Drop and golden gift spots, elites) don't follow moved furniture yet. Code: `src/layout.js`.

## Controls

WASD move · mouse look · Space jump, again in the air to double jump (hold to climb fabric) · 1/2/3 pick a card · R reroll · wheel zoom · Esc pause · F3 debug readout. "Look" in the pause menu opens the jellyfish creator: pick a species (Sea Nettle, Moon Jelly, Lion's Mane, Box Jelly, Crystal Jelly, Fried Egg), then its colours, finish, spots, face and hat. On phones: left thumb moves, right thumb looks, ⤴ jumps (tap again in the air to double jump, hold to climb).

## How it fits together

The apartment is a static 3D model, baked to `assets/apartment.glb` (geometry, materials, textures, and doors as separate nodes), plus `assets/apartment.json` (floor plan, acts, door angles, the lights at midnight). The game doesn't load that whole file: `tools/split.mjs` cuts it into one file per act, and each act loads only its own rooms. `apartment-act1.glb` (~3.6 MB) is the living room and the hallway you can see down from it (seen only: an invisible wall keeps you out of it in act 1), plus every room's walls, floors and doors, so every view is solid; `apartment-act2.glb` (~1.1 MB) the bathroom and hall closets; `apartment-act3.glb` (~0.9 MB) the bedroom. A stage lists the parts it needs (`parts` in `src/stage1.js`); `GAME.loadRooms(['act2'])` brings in more at the start of a later act (solid, with layout edits, on the minimap, with that act's lamps). Each part is meshopt-compressed (needs WebAssembly) with a `-q` twin used automatically if WebAssembly is blocked. Nothing from the original apartment app runs in the game.

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
| `content/*.kdl`, `content/look.css` | What things are (bugs, waves) and how they look. See "Changing the game". |
| `src/words.js` | The vocabulary: bug behaviours (`ENEMY_WORDS`), treasure effects (`TREASURE_WORDS`, `TIMED_WORDS`), each word once with its doc, arguments and settings. |
| `src/content.js`, `src/kdl.js`, `src/look.js` | Load and check the content files before the game starts. |
| `src/stories.js`, `tests/run.mjs` | Named situations that prove behaviour; the headless runner. |
| `src/main.js` | Wires everything up: pause menu, mode switching (play, creator, layout), and the frame loop, which only works out dt and calls each system's `update` in order. |
| `src/systems.js` | The per-frame systems: clock (dt clamp, hit-stop), gameplay, layout editor, touch controls, idle avatar, input, camera (follow, creator orbit, shake), blob shadow, HUD, debug readout, render. |
| `src/events.js` | The event bus (synchronous `on`/`emit`) and the event list. Systems don't change each other's data: attacks emit `damage_taken`, `status_applied` and `knockback` with a target id (`'player'` or an enemy's id); enemies.js and run.js own the HP, status and position they apply to, and announce `enemy_hit`, `enemy_frozen`, `enemy_killed`, `elite_defeated` and `boss_health`. |
| `src/feedback.js` | Listens for enemy hits, freezes and kills and plays the numbers, bursts, shake, hit-stop and sounds. |
| `src/config.js` | Tuning numbers: player size, speed, jump, gravity, camera. Units are meters. |
| `src/character.js` | Character looks (options, defaults, random) and the procedural model + animation (the jellyfish's pulsing bell). |
| `src/swim.js` | One bell stroke: the squeeze, the thrust, and how often strokes come. Shared by movement and animation. |
| `src/tentacles.js` | The jellyfish's 6 live tentacles: hang, trail, stream when falling, whip out when the Lash strikes. |
| `src/creator.js` | The jellyfish creator panel (species, colours, finish, face, hat). |
| `src/hud.js` | Moisture, XP, dew, night clock, Moon Drops, treasures, minimap with markers, boss bar, hints, toasts. |
| `src/graphics.js` | Post-processing: ambient occlusion (N8AO), depth of field, bloom, vignette. Low / Medium / High in the pause menu. |
| `src/detail.js` | Fine close-up detail (normal maps): grain on floors and rugs, an orange-peel paint finish on walls, doors, cabinets and porcelain. |
| `src/player.js` | Swimming movement, low-gravity jump and double jump, vent launches, climbing, wall sliding, stepping up small ledges. |
| `src/camera.js` | Orbit camera that follows the player and pulls in when furniture is in the way. |
| `src/collision.js` | Raycast collision against the apartment's meshes, with a BVH per mesh and a nearby-object filter. `cast()` walks the BVH itself, reading triangles straight from the typed arrays, so a ray that misses allocates nothing (it runs 100+ times a frame in a fight). |
| `src/batch.js` | Instanced drawing for the small moving things (bug parts, bubbles, puffs, gut chunks, rings, dew, tentacles, laser bolts). They stay normal meshes for the game code but are hidden from the camera; once a frame, before rendering, the batcher draws each geometry + material group as one InstancedMesh, with per-instance color and fade for effects. A big fight is ~300 draw calls instead of ~2,100. |
| `src/vfx.js` | The combat visual language (Returnal-style): hostile attacks in hot colours, one per source (`--hostile-*` in look.css), friendly in cool ones; glowing projectiles (white-hot core, halo, trail), floor warnings that fill until the hit (`TeleMaterial`: circle, wedge, strip) and impacts (flash, sparks, shockwave). All the glows are one particle draw call. |
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
| `src/combat.js` | The Lash (close-range tentacle sting): targeting and picking which tentacle strikes. |
| `src/vacuum.js` | The Vacuum, stage 1's boss, and its attacks. |
| `src/boss.js` | Simpler bosses: The Clog (bathroom) and The Dust King. |
| `src/critters.js` | Bug models with moving legs and wings: cockroach, ant squad, mosquito, the spotted lanternfly (high detail: painted wings, flashes its red hindwings when it leaps), and the hopping standing stapler (built and tested, saved for act 2: an office stapler opened out on its hinge, 80 health, firing a fan of five staples for 5 moisture each). |
| `src/traversal.js` | Vent launch pads, climbing, and per-stage apartment setup (doors, see-through curtain, walls). Objects are looked up by name, e.g. `Shower curtain`. |
| `src/pickups.js` | Dew and the Moon Drop. |
| `src/ui.js`, `src/hud.js`, `src/fx.js` | Menus, HUD and minimap, damage numbers and poofs. |
