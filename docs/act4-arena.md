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

## Floor patterns (v237, v238)

The Encore's first attack family: the floor lights up in shapes that sweep across it a tile every
third of a beat (8th-note triplets), in time with the Encore's song, like notes scrolling down a rhythm game. `src/encore-floor.js`
holds the patterns, the floor that plays them and the random set that picks them.

- **ring** expands from the front of the pyramid, one tile thick: jump it as it reaches you.
- **arc** is a ring with a gap (52°, its heading varies): jump it or run to the gap.
- **arrow** is a 45° chevron, tip first, crossing the floor down, left or right.
- **sweep** is a radar line swinging across the floor from the pyramid, either way round: jump it as
  it swings over you.
- **closing** is a ring that closes in a tile a step on where the jelly stood when it was cast,
  ending on it: you can't outrun it, so jump it.
- **gate** is a wall right across the floor (down, left or right) with a two-tile gap at a random
  place: run to the gap or jump it.
- **pincer** is two walls from the sides squeezing to the middle: jump one as it passes.

**Random, never predictable.** `EncoreSet` picks every wave at random, a new one every 4 beats: never
the same pattern twice running, with its direction, gap, spin or heading picked too. Whose wave it is
alternates, and a wave from a wing is the DJ on that side. **At the drop** (the track's bars 32 to 39,
64 beats into the fight, and again every time the song loops round) the waves come two at a time:
two different patterns, one from each DJ, so both DJs pump at once. Two waves from wings are never
from the same side.

**Whose wave.** Each wave belongs to one DJ and is his colour: the silver DJ's electric blue
(`--hostile-encore-silver`, his helmet's blue piping made hot) or the gold DJ's gold
(`--hostile-encore-gold`). An arrow from a wing is the DJ on that side (silver on the left). From the
bar before his wave until it's done, that DJ throws his outer arm up and pumps it, down on every
beat (`boss.dance(who, beat)` in `src/encore-model.js`: the outer arm is its own part, pivoting at
the shoulder), and the pyramid, or the wing an arrow comes from, fills in his colour and flashes as
the wave starts.

**No Warning tiles** (the owner's call, recorded in `docs/adr/0001`): you watch the wave come. A tile
lights in its DJ's colour the moment its step goes off, held near full and then falling away over
0.45 beats (`--encore-floor-fade`), the wave's trail. While lit, a low volume over it shows the height
it hits (`--encore-floor-height`, 4 cm). The jelly is hit when a step goes off with its feet below
4 cm and its footprint over one of the step's tiles, once a wave, for 4 Health (heavy, few hits; it
moves to `content/bosses.kdl` when the Encore joins the campaign).

**Why waves every 4 beats.** A jump lasts about 1.26 s and clears 4 cm for about 1.1 s. At 128 BPM
a beat is 0.47 s, so a jump hangs about 2.7 beats: a new wave every 4 beats, with no rests between,
leaves just time to land and get set. Waves can overlap on the floor (a side arrow takes 6 beats to
cross), but any one spot gets about 4 beats between them. A wave crosses a tile in a third of a beat, so the jump only has to be in the air as it passes;
one pressed up to about 2 beats early still clears it. Patterns are written in beats; the
floor takes its time from what is playing (`beatNow()`: the audio clock less the output latency), so
it stays on the speakers' beat. Going back in time drops what was playing; going forward more than a
beat (a pause, a long frame) passes the missed steps without hitting.

**The song.** The owner's choice: Westend's edit of Daft Punk's "Around the World"
(`assets/audio/encore-around-the-world.mp3`, see `assets/audio/README.md`), played by
`src/song-track.js`. Its beat grid was measured from the file: 128 BPM, first beat 0.052 s in. It
starts 64 beats (16 bars, about 30 s) in, skipping the intro, and loops from the end of its 159th
bar back to there, a whole number of bars, so the beat counts on with no slip, and the floor rests through its
breakdown (bars 75 to 79, the kick out): the set leaves out any wave that would play into
it. If the file can't load, the preview plays `SONGS.encore` in `src/music.js` instead: an original
French-house track at 121 BPM (Dm9, Bbmaj7, F, C6; a new `stab` voice for its chopped chords).

**In the preview.** **Fight: floor patterns** starts the track and the random waves with Health from `BASE_STATS`; a hit is the hurt sound, the `impact-big` shake (Reduce effects
silences it) and a pop up off the floor, and Health fills back up at 0. **Stop the fight** ends it.

**Cost.** No light is added. The tiles are the arena's existing instanced colours; the volumes are
one more instanced draw (144 boxes, unlit, additive, no depth write) that is black when idle. The two
dancing arms are their own parts, a few more merged draws in the model's budget.

**Feel audit (code, not yet watched at play speed): 5/9.** Anticipation (the wind-up and the DJ's
arm), release, travel (the wave itself), target reaction (the pop) and the attacker and camera
reacting (the pumping DJ, the shake) are there. Missing: an impact at the contact point (the
preview has no fx pools), aftermath, a damage number, and a layered hit sound. They come with the
game's own fx, HUD and sounds when the Encore joins the campaign; until then it isn't on the
scoreboard, which lists only attacks in the game (`EVERY_ATTACK`).

Stories `encore/*` (22): the ring's travel and thickness, a standing jelly hit on the beat only,
a real jump on the beat clearing it (and one 3 beats early not), the arc's gap, the arrow's shape
and its three-jump run, no Warning tiles and each wave in its DJ's colour with no light added, the DJ's arm pumping on the beat, the four newer shapes and how they hit, the random picking, the drop's pairs, hitches and jumps in
time, the track's grid landing on its kicks, its whole-bar loop and breakdown rest, and the
fallback song scheduling.

## Solid boss structure and contact electricity (v239)

The pyramid's model dimensions now produce a closed low-poly collision hull. It follows
all four sloped faces, the deck cap, plinth, both triangular wing prisms and their bases.
The arena registers this invisible hull with the existing World/Player collision path;
the stage riser remains solid as well. Decorative performers, fingers and LEDs are not
individual colliders. Collision geometry is owned and disposed by the model.

`EncoreContact` checks the player's radius/height capsule against those same hulls and
the stage riser using transformed triangles. A 3 mm tolerance covers movement's resting
contact; no broad box can shock a jelly merely passing through empty space above the
wings. The contact point comes from the nearest triangle. Touching deals 4 Health,
at most once per second. This preview-only contact hazard works whenever walking,
including outside the floor fight; overview has no new hits. As with the floor preview,
Health refills at zero. Fight restart or R clears the effect/cooldown. Pause freezes it.

A constant amber energized outline is its warning. Confirmed contact sends a jagged arc
from the surface to the jelly, with short crawling bolts and a local additive body flash.
The source outline flashes as well. The jelly flinches and is moved away through collision,
with the existing hurt pop and impact-big camera feel. A projected “Shock! −4 Health”
receipt confirms the hit. Electrical impact and hurt voices supply layered, varied sound.
The remaining arcs fade for 0.32 seconds. Reduced motion keeps the receipt/arc information,
softens the local flash, fixes the jagged shape and disables the existing camera shake.
No full-screen strobe, added light, or per-hit scene allocation is used. Fixed geometry,
materials, triangle cache and numeric buffers are reused and disposed with the preview.
Look tokens: `--encore-contact`, `--encore-contact-life`, `--encore-contact-warning`.

Contact feel audit: **9/9 from code**, not a new campaign scoreboard entry yet. The
persistent surface cue is anticipation; the same-frame source pulse is release; the
surface-to-body arc is travel/contact; the flash marks impact; flinch/push and source
pulse/camera answer; fading arcs are aftermath; Health and the receipt confirm damage;
layered electrical/hurt voices provide sound. Visual states were inspected in stepped
real-game desktop and phone-sized Low previews. Audio playback was not listened to.

Four new stories prove front/side/back and airborne collision, vertical/wing proximity,
contact cooldown/reset/quiet behavior, and bounded effect resources/disposal. All 30
arena/Encore stories and guards pass. Desktop and phone preview: 119 draws, no errors,
zero new shader programs on a shock, Health 25 → 21, and no second hit after recoil takes
the jelly clear. Physical phone performance remains unchecked. Balance bot was not run:
it does not play this standalone Act 4 preview. Full-suite results are on the PR.

## Beat ambience and speaker readability (v240)

`arena.updateAmbience(beat, reducedMotion, breakdown)` uses the exact absolute music beat
passed to the floor system. It modulates the existing hemisphere fill/directional key,
shared perimeter light-pool opacity, blue-white/amber overhead shaft opacity and matching
speaker trim. Downbeats get the strongest accent; other beats get three quarters of it.
The envelope decays exponentially within each beat. A hitch or rewind reads its new phase
directly; it cannot queue missed flashes or drift into a separate metronome.

No song, loading, negative pre-roll, invalid beat, breakdown and reduced motion restore
steady base lighting. Stopping/restarting a fight resets it immediately. Pause freezes the
visual scene with the rest of the preview. No screen flashes, light-count changes or
postprocessing passes are introduced. Floor attack colors and the pyramid/wing warning
buffers are untouched. The blue-white/amber washes stay on broad scenery and fixtures;
they do not turn safe floor tiles into warning tiles.

All four suspended speakers have five separate cabinets, lighter side ribs and suspension
caps, recessed twin cones, metallic driver surrounds, dust caps, perforated grille faces,
side handle recesses and blue (left) / amber (right) edge strips. A single shared 64² grille
texture and static geometry merged by material keep the detail bounded. Speaker faces
point inward on both sides; cabinet depth and side details keep the outer silhouette
readable too. All new geometry, materials and the grille texture dispose with the arena.

Look tokens use `--arena-speaker-*` for cabinet/baffle/driver/grille colors and
`--arena-beat-*` for fill/key/spill/beam/trim amplitude and envelope decay. Light intensities
never fall below their readable base values. The ambient layer introduces no damage,
contact changes, audio processing or attack timing changes.

Four new stories cover absolute beat/decay/downbeat/reset, quiet/invalid/breakdown states,
unchanged hazard buffers and scene resources after 2,000 updates, speaker detail and
owned grille/material cleanup. All 34 targeted arena/Encore stories passed. Independent
review found no blockers. Final guards/full-suite results are recorded on the PR.

Desktop 1280 × 853 and phone 844 × 390 Low overview/close-up states were inspected.
Complete preview: 128 draws, 126,310 triangles, two existing lights. A 120-frame sequence
compiled zero new shader programs, logged no errors, and submitted CPU work in about
0.36 ms desktop / 0.34 ms phone viewport in software Chromium. These are not physical
phone FPS measurements. Audio-clock integration and reduced-motion delivery are checked
in the live preview; audio playback was not listened to. No balance bot: no combat values
or behavior changed. Physical flagship phone performance remains unchecked.

## Club lasers (v241)

`src/encore-laser.js`: an emitter on each of the arena's four corner posts, 35 cm up
(`--encore-laser-height`). It fires a fan of green beams (`--hostile-encore-laser`,
laser green) from its corner down to a line on the floor through where the jelly is when its Warning
starts: a laser plane, crisp anti-aliased beams over a haze, brightest where it burns the floor.
One fires on every wave's beat, every 4 beats, alongside the random floor waves, from a random corner
to a random side.

- **Warning:** a thin line (3 cm, `--encore-laser-band`) where it will land flashes faintly green on
  the floor for 2 beats (`--encore-laser-lead`, a strip `TeleMaterial` at `--encore-laser-warn`),
  with the plane barely there over it as its volume (`--encore-laser-warn-plane`). It then sweeps
  10 cm (`--encore-laser-sweep`) to one side, so get clear of the line by more than that.
- **Fire:** on the beat the plane fires full and swings 10 cm sideways across the band over a beat
  (`--encore-laser-fire`), with a zap (`sfx.encoreLaser`). Anything of the jelly inside it is hit,
  once a laser, for 4 Health.
- **Dodge:** step well clear of the line. The plane is a fan from up high, tall by its corner and down to
  nothing at the far end, so far from the corner a jump clears it; near it, it can't.

Two pooled planes and bands, four emitters: a few unlit draws, no light added.

## Disco ball (v242)

`src/encore-disco.js`: every 8 bars, from 32 bars into the fight (beat 128), a big mirror ball
(`--encore-disco-radius`, 24 cm across, about three jellies tall) drops on its rod from above the
arena over the beat before and hangs over the floor (`--encore-disco-hang`) for 8 beats, then rises
away. It is a real mirror ball: about 900 square tiles in rings (`--encore-disco-rings`), each a flat
facet over dark grout, reflecting a small generated cube map of the club (silver haze, white
highlights, pools of the arena's amber, blue, green and magenta), so it shimmers as it turns; star
glints twinkle on it. It throws 32 light spots across the open floor, each on its own beam from the ball.

Twice, 4 beats each:
- for 3 beats the spots wheel round as the ball turns (`--encore-disco-spin`), warm white and harmless;
- on the 4th they stop and flash fast between white and hot magenta (`--hostile-encore-disco`): the
  Warning, where they will strike;
- as that beat ends they strike (`sfx.encoreDisco`): a jelly standing on one, its feet below the
  floor's hit height (4 cm), takes 4 Health, once a strike. Step off the spot, or jump.

The second 4 beats turn the other way. Spots are scattered afresh for each show, always where they
stop on open floor, so all 32 are there to strike. The song's breakdown skips a show. The floor waves
and lasers carry on through it. The ball (tiles, grout, glints), rod, beams and spots are six draws (beams and spots
instanced), no light added.

## Speaker pulses (v242)

`src/encore-pulse.js`: from bar 16 of the fight (beat 64), one corner speaker at a time fires a
white sound wave (`--encore-pulse`), the four stacks taking turns round the arena; the next fires as
it arrives, so only one is ever in flight. The wave is a packet of five concentric arcs lying flat at
jelly height, like a drawn sound wave: the widest at the front (`--encore-pulse-radius`, about 40 cm
across, `--encore-pulse-arc` about 125°), bulging the way it travels, the others nested behind it
(`--encore-pulse-gap`). It drops from the speaker and rolls across the floor to the opposite corner's
speaker in 2 beats (`--encore-pulse-travel`). It does no damage: a jelly its front passes through is
shoved 12 cm (`--encore-pulse-push`) the way it is going, slid over 0.2 s with the jelly's own
collision, once a wave, with a soft whomp (`sfx.encorePulse`). Jump it to stay put. The song's
breakdown quiets it. Every arc in flight is one instanced draw.
