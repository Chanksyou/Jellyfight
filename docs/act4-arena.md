# Act 4: concert arena and Encore model (v234)

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
