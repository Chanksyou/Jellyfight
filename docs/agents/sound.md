# Sound: how recorded sounds get into the game

Every sound in `src/sfx.js` is synthesized first. A recording is a **role** (`kettle-steam`, `lightning-hit`) with a few **takes**, in a **pack**: one MP3 for a group of roles that load together.
The synthesized sound always stays behind it, so a pack that is missing, slow or muted changes nothing but the sound.

## The pieces

| Piece | Where | What it does |
|---|---|---|
| Manifest | `tools/sounds.json` | Each pack: `for` tags, and each role's `cue`, `vol`, `mode`, `cap` and source takes |
| Builder | `node tools/sounds.mjs <sources folder> [--only=<pack>]` | Trims, fades, mono 48 kHz, joins takes with 300 ms of silence, encodes 96 kbps MP3 into `assets/audio/<pack>.mp3`, writes `assets/audio/packs.json` (each take's `start`, `length` and measured `peak`) |
| Player | `src/sfx.js` (`sample`, `wantPacks`, `loadPack`, `cueLog`) | Loads packs, plays takes in turn, falls back to synthesis |
| Audition page | `sounds.html` | Every pack, role and take at game volume, next to today's synthesized sound, with each take's share of energy above 400 Hz |
| Credits | `assets/audio/credits.json` | Every audio file's `from` and `licence`; `node tests/check.mjs` fails on a file without one |
| Stories | `src/stories/sound.js` | Fallback on a 404, nothing fetched before sound is on, every role has a synthesized sound, peak timing and voices, the cue log |

## Rules

1. **A role keeps its synthesized sound.** In `sfx.js` a recorded role is always played as `if (sample('<role>', …)) return;` followed by the synthesized sound. `mode: "replace"` makes `sample` return true once the pack is in (the recording plays instead); `"layer"` returns false (it plays on top). `node tests/check.mjs` fails on a role without that line, on a `sample()` role no pack has, and on a role whose `cue` isn't an `sfx` method; the story `sound/every-role-has-a-synthesized-sound` plays each `cue` with no packs and fails if it is silent.
2. **When packs load.** A pack's `for` tags say when: `unlock` (as soon as sound is on: the `core` pack), `act N`, `jelly <type>`. An Elite's or boss's pack is tagged with its act, and a pack that another act also plays takes that act's tag too (lightning: `jelly lightning` and `act 4`, whose Encore strikes with its heavy thunder). The run asks at its start (`wantPacks` in `run.js`); packs no longer wanted are let go. Nothing downloads before the first tap turns sound on, nor while muted. A pack decodes only while the audio context is running (decoding on a suspended one can stall; PR #281). Never ask for a pack mid-fight.
3. **Budgets** (guarded in `tests/check.mjs`): at most 450 KB of packs per act (its `unlock` and `act N` packs plus the biggest jelly type's), 60 s decoded per act, 2.2 MB in all. At 96 kbps mono a second costs about 12 KB.
4. **Timing by peak.** `tools/sounds.mjs` measures each take's peak; Soundza's `sync_ms` is not reliable and variations move the peak by 80 ms or more. To land a hit on a moment, call `sample(role, { peakAt: audioTime })`: it starts early by the take's peak. After decoding, `sfx.js` re-finds each take's start within 50 ms (Safari may ignore MP3's gapless header), so keep the builder's 300 ms gaps.
5. **Voices.** 8 recorded voices at once; ordinary sounds get 6, and `urgent: true` (a hostile build-up, a hit on the jelly) may use the last 2. Small bugs keep their `gap()` minimums.
   A sound that comes in swarms (the jelly's blow, pop, hit and kill) passes `soft: true, max: 2` (`EVERYDAY` in `sfx.js`): at most 2 takes of it at once, and it never takes the last 2 ordinary voices, so rarer sounds (a lightning chain) aren't starved. A role's dice (which take, how much it varies) come from `sfx.js`'s own `rng`, never `Math.random`: a pack arrives at an unpredictable moment, and a story's seeded rolls must not depend on it.
   A cue that several sources share (`pop`) takes a flag so the bug's own use keeps its synthesized sound (`pop(false, true)`).
6. **The mix language.** Hostile is dry, hard and bright; the jelly is wet, round and cool; they never share a source recording. Every recording needs energy above 400 Hz (phone speakers): hostile above 85% on `sounds.html`. A role's loudness is its `vol` in the manifest (times `quieter(k, …)` for a whole family, like `LIGHTNING`). Recordings follow `pitch()` (the Cream Whipper's deep sound), and any fade on a playing sound goes through `holdAt` (Firefox has no `cancelAndHoldAtTime`).
7. **Variable-length sounds stay synthesized** (charge-ups that last as long as the attack's wind-up).
8. **The cue log.** `cueLog(() => frame)` starts a log of every `sfx` call and every recorded take (`{ cue, frame, recorded }`), `cueLog(null)` stops it. A story asserts a cue's frame against the hit's frame with it.

## Auditioning (agents can't hear)

Every new sound goes in front of the owner before it enters the game: an audition board with today's sound and up to 3 candidates, the recommended one picked.
Soundza's `search_sounds` gives an `audition_url` (`soundza.com/listen?ids=a,b,c`) for candidates; after the pick, build the pack and point the owner at `sounds.html` to hear it in place.
Check each take's energy above 400 Hz on `sounds.html` and say which candidates fail it.

## Licences

The repository is public, so only edited takes joined into packs are committed, never the original downloads: keep sources in the project's files (`sound-plan/sources/<pack>/`) and pass that folder to `tools/sounds.mjs`.
Soundza sounds may ship inside the game and be edited, but not be shared on their own; AI-made takes say so (`ai_content`).
For each Soundza take, `credits.json` records its Soundza id, the date it was downloaded and the edits (`from` may be a list of `{ role, soundza, date, edits }`).
A sound with no clear licence is listed as such in `credits.json`, and the owner decides.
