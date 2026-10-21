# Act 4: concert arena and Encore model (v235)

The supplied reference pictures establish a dark tiled concert floor, amber edge light,
cool overhead shafts and four elevated speaker arrays. The jelly sketch sets the scale.
The preview includes the environment and the visual pyramid boss with two helmeted
performers. Attack patterns, combat hitboxes and campaign transition are not implemented.

## Open and explore

Open `index.html?arena=act4`, or unlock Dev and choose **Act 4 preview**. The overview
shows the arena with the actual jelly at its spawn. **Walk arena** uses existing keyboard,
mouse, jump, camera and phone controls. **R** returns to spawn. **Arena overview** restores
the fixed establishing view. **Boss close-up** frames the performers and decks. **Tile lights** toggles one static color sample, not an attack
or a timed show. **Back to game** returns to the existing campaign.

The preview loads no apartment GLBs, enemy content or boss systems. `STAGE4` holds its
own dimensions and reserved boss footprint; it is deliberately absent from `STAGES`
until the boss and progression rules are ready. Act 3 remains the current finale.

## Scale and collision

- 1.44 × 1.44 m floor: 12 × 12 tiles, each 12 cm. About 24 jelly collision diameters wide.
- Four segmented speaker arrays hang above the floor and face inward.
- Low rails preserve the sightline; separate tall invisible bounds prevent jumping out.
- A 63 × 42 cm rear riser supports the pyramid booth and performers.
- One continuous collider sits at tile-top height, so grout cannot snag feet or let the
  jelly fall through. Walking/jumping and camera reuse the game's collision world.

## Lighting and performance

Two fixed sources: a hemisphere fill and directional key. No shadows, screen-space or
planar reflections, per-tile lights, moving lights or postprocessing in the Low preview.
Dark tiles and their colored layer are two instanced meshes (144 instances each).
The floor's broad amber/blue spill is one static shared texture; localized light pools
are another instanced draw. Fixed translucent shafts provide haze. Static speaker,
truss, rail and trim pieces are merged by material. No per-frame scenery generation.

`arena.setTile(row, column, color, strength)` changes only instance colors; `clearTiles()`
turns them off. Bounds and finite strength are checked, strength clamps to 0–1.
Future attacks can address individual tiles without replacing geometry, adding lights
or compiling materials. The current preview never deals damage.

The preview starts on Low, respects the existing phone FPS/pixel-ratio settings, and
reuses the resolution governor. Material and geometry variants compile before entry.
Owned geometry, materials, textures and instance buffers dispose on departure; persisted
browser-history pages retain their scene. The ordinary game's boot path stays unchanged.
Reference attachments remain local and are excluded from Git.

## Verification

Five new engine stories cover tile addressing/invalid input/clear, continuous ground,
jump-height boundaries, unchanged light/mesh counts after 500 tile updates, resource
cleanup, and real player walking/jumping against the boundary. Targeted result: 5 passed.
Independent review found missing initial collision focus and persisted-page cleanup;
both corrected. Final full-suite and GitHub results are recorded on the PR.

Desktop 1280 × 853 and phone 844 × 390 Low views inspected in dark, lit and walk modes.
Both had two lights, 63 draws and about 18,764 triangles including the jelly. Sixty tile
changes compiled zero additional programs and produced no console errors. Software
Chromium CPU step+render submission averaged about 0.42 ms desktop / 0.41 ms phone
viewport; these are not physical phone FPS or GPU completion measurements. Real flagship
phone performance remains unchecked. No balance bot: this preview introduces no combat.

## Encore boss model

`src/encore-model.js` builds the separate visual model. The truncated pyramid has inset
triangular plates, deduplicated blue-white LED edges and an amber stepped plinth. Two
triangular wings have metal perimeter rails, bronze cross bracing and exposed luminous
strips. The decks include jog-wheel rings, waveform screens, knobs, faders, screws and
rear cables. Silver and gold helmet variants use curved black visors, ear discs, rim
piping and distinct chin details. Fitted suits include lapels, seams, zipper teeth,
elbow folds, boots and individually segmented glove fingers.

Static details merge by material within each moving group. Only the two helmet pivots
and four glove pivots animate; reduced motion fixes their pose. Emissive cores and soft
additive sleeves create the light detail without adding lights or relying on bloom.
Two small generated matcaps provide helmet reflections, and one shared small bump map
adds leather grain. All geometry, materials and three textures belong to the model and
dispose with it. Every mesh is excluded from collision.

Three additional engine stories prove the silhouette and model budget (under 100,000
triangles and 60 meshes), idle/quiet poses with stable scene resources, and independent
cleanup of two instances. All eight targeted arena/model stories passed. Independent
review found no blockers; final full-suite results are recorded on the PR.

Final v234 desktop 1280 × 853 and phone 844 × 390 Low views were inspected in overview,
close-up, lit and walk modes. The complete scene has 105 draws, 111,792 triangles and
still only two lights. Sixty tile changes compiled zero new shader programs and produced
no console errors. Software Chromium CPU step+render submission averaged about 0.50 ms
desktop / 0.49 ms phone viewport. These are diagnostics, not physical phone FPS or GPU
completion measurements. Physical flagship phones remain unchecked.

## Attack lighting controls (v235)

The visual model exposes synchronous controls, with no attack timing or damage attached:

```js
const boss = arena.boss;
boss.setLighting('pyramid', '#ff5935', 0.5);
boss.setLighting('leftWing', '#ff5935', 1);
boss.setLighting('rightWing', '#ff5935', 1);
boss.setLighting('all', '#ff5935', 1);
boss.setTriangle(7, '#ff5935', 0.8);
boss.clearLighting();
```

Each setter returns false for an unknown part, invalid triangle index or nonfinite
strength without changing anything. Finite strength clamps to 0–1. Omitted color and
strength use `--encore-charge` and full strength; `--encore-charge-brightness` sets gain.
Colors use the Three.js color format. Strength zero extinguishes that selection;
`clearLighting()` extinguishes every selection. Reset before changing attack patterns
or on interruption, recovery, death and restart. A later attack system owns its timing
and must use the established hostile warning/volume language for actual hazards.

Triangle indices are deterministic: 0–47 front pyramid face, 48–71 right face,
72–119 rear face, 120–143 left face, 144 left wing, 145 right wing. Pyramid faces visit
rows bottom to top, columns in face order, then the two triangles of each cell.
`triangleCount` is 146. Parts may overlap previous per-triangle settings: the most recent
write wins for each triangle.

The always-present additive layer has one dynamic vertex-color buffer and one material.
Its initial colors are zero. It sits just above the metal panels, leaves the LED lattice
visible, and uses no scene lights or bloom. Setting or clearing lighting reuses its
geometry, material and buffer, including on Low. Disposal includes the new resources.
The static **Boss lights** preview cycles off → pyramid → left wing → right wing → all.
Three new stories cover addressing, reset, intensity, invalid input, bounded resources
and independent instances. Physical phone performance remains unchecked.

Desktop and phone-sized Low previews were inspected for all five states. Final complete
scene: 106 draws, 111,938 triangles, two fixed lights; 60 lighting writes produced zero
new shader programs and no console errors. The single-pass overlay renders after the
transparent wing panels so both wings display equal intensity. Software Chromium CPU
submission averaged about 0.52 ms for both viewports; this is not a physical phone FPS
measurement. Targeted arena/model stories: 11 passed; guards passed. Full-suite and
GitHub results are recorded on the PR.

## Floor patterns (v237)

The Encore's first attack family: the floor lights up in shapes that travel across it one step a
beat, in time with the Encore's song, like notes scrolling down a rhythm game. `src/encore-floor.js`
holds the patterns, the floor that plays them and the preview's setlist.

- **ring** expands from the front of the pyramid a tile a beat, one tile thick: jump it as it reaches you.
- **arc** is a ring with a gap (52°, its heading varies): jump it or run to the gap.
- **arrow** is a 45° chevron, tip first, crossing the floor down, left or right a row a beat. The
  setlist's three arrows four beats apart are three jumps in a row.

Each step goes off on its beat. Its Warning starts 2 beats before (`--encore-floor-lead`): the tiles
glow dimly in `--hostile-encore` and a low volume rises out of them to the height the hit reaches
(`--encore-floor-height`, 4 cm). On the beat the tiles flash bright, pushed towards white so the
beat's line stands out from the Warning ahead, and anything of the jelly inside the volume (its feet
below 4 cm, its footprint over a hot tile) is hit once a pattern for 4 Health (heavy, few hits; it
moves to `content/bosses.kdl` when the Encore joins the campaign). The pyramid, or the wing an arrow
comes from, fills over the bar before a pattern and flashes as it starts.

**Why every 4 beats.** A jump lasts about 1.26 s and clears 4 cm for about 1.1 s. At 128 BPM a beat
is 0.47 s, so the jelly can't jump every beat: a hit beat every 4 leaves time to land and get set,
and a jump pressed up to about 2 beats early still clears it. Patterns are written in beats; the
floor takes its time from what is playing (`beatNow()`: the audio clock less the output latency), so
it stays on the speakers' beat. Going back in time drops what was playing; going forward more than a
beat (a pause, a long frame) passes the missed steps without hitting.

**The song.** The owner's choice: Westend's edit of Daft Punk's "Around the World"
(`assets/audio/encore-around-the-world.mp3`, see `assets/audio/README.md`), played by
`src/song-track.js`. Its beat grid was measured from the file: 128 BPM, first beat 0.052 s in. It
loops on its 159 whole bars, so the beat counts on with no slip, and the floor rests through its
breakdown (bars 75 to 79, the kick out): the setlist leaves out any pattern that would play into
it. If the file can't load, the preview plays `SONGS.encore` in `src/music.js` instead: an original
French-house track at 121 BPM (Dm9, Bbmaj7, F, C6; a new `stab` voice for its chopped chords).

**In the preview.** **Fight: floor patterns** starts the track and the setlist (8 bars, round and
round) with Health from `BASE_STATS`; a hit is the hurt sound, the `impact-big` shake (Reduce effects
silences it) and a pop up off the floor, and Health fills back up at 0. **Stop the fight** ends it.

**Cost.** No light is added. The tiles are the arena's existing instanced colours; the volumes are
one more instanced draw (144 boxes, unlit, additive, no depth write) that is black when idle.

**Feel audit (code, not yet watched at play speed): 5/9.** Anticipation, release, travel, target
reaction (the pop) and camera reaction are there. Missing: an impact at the contact point (the
preview has no fx pools), aftermath, a damage number, and a layered hit sound. They come with the
game's own fx, HUD and sounds when the Encore joins the campaign; until then it isn't on the
scoreboard, which lists only attacks in the game (`EVERY_ATTACK`).

Stories `encore/*` (10 new): the ring's travel and thickness, a standing jelly hit on the beat only,
a real jump on the beat clearing it (and one 3 beats early not), the arc's gap, the arrow's shape
and its three-jump run, the Warning rising to the beat with no light added, hitches and jumps in
time, the track's grid landing on its kicks, its whole-bar loop and breakdown rest, and the
fallback song scheduling.
