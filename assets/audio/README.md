# Fire sample audio

`fireball-flight.mp3` is the owner's supplied
`koiroylers-fireball-impact-351961.mp3`, used for launch and travel in the fire sample audition.
Its filename identifies koiroylers; no license document was supplied.
Confirm redistribution rights before including this asset in a production release.

The sample and normal gameplay load this file after audio is unlocked. Loading
or decoding failure retains synthesized fire audio so gameplay can continue.

# Sound packs

Recorded takes by role, joined into one MP3 per pack (`<pack>.mp3`) and listed in `packs.json`, both built by
`node tools/sounds.mjs <sources folder>` from `tools/sounds.json`; `src/sfx.js` (`sample`) plays them, falling back
to synthesized sounds until a pack loads, and `sounds.html` plays every take. Every audio file here has its source and
licence in `credits.json` (`node tests/check.mjs` fails otherwise). Rules: `docs/agents/sound.md`. The original
sources stay out of git (this repository is public): they are in the project's files, `sound-plan/sources/`.

## lightning.mp3

The owner's supplied clips from Hove Audio's **Lightning Magic** sound
effects pack (free version, https://hoveaudio.itch.io/lightning-magic-sound-effects-pack-free-version),
sold as royalty-free (not CC0). Confirm the pack's licence covers shipping them in the game.
Each clip was trimmed to start on its strike, faded out and peak-normalized to -1 dBFS.

| Takes | From (MAGElem_…_HoveAud_LightningMagic) | Role |
|---|---|---|
| launch-1, launch-2 | LightningStrikeSolo_08, LightningStrikeWoutRum_08 (first 0.5 s) | the ball leaving the bell |
| hit-1..3 | LightningStrikeWoutRum_13, _16, _26 | a lightning hit |
| big-1..3 | LightningStrikeFull_28, LightningStrikeWoutRum_21, _28 | a chain that jumps to 2+ bugs |
| chain-1..3 | LightningStrikeSolo_13, _16, _26 (first 0.25 s) | each chain jump, pitched up per jump |

Supplied but unused: LightningStrikeSolo_21 and _28.

# The Encore's song

`encore-around-the-world.mp3` is the owner's supplied
`DAFT_PUNK_-_AROUND_THE_WORLD_WESTEND_EDIT_FREE_DOWNLOAD_KLICKAUD.mp3`: Westend's edit of Daft Punk's
"Around the World", released by Westend as a free download on SoundCloud. The recording is Daft
Punk's; the free download is not a licence for it. The owner chose to include it for their own
play, knowing this repository is public. `src/song-track.js` (`TRACKS.encore`) holds its measured beat
grid (128 BPM, first beat 0.052 s, 159 bars, breakdown bars 75 to 79; it starts and loops back 64 beats in); the act 4 preview falls back
to the synthesized `SONGS.encore` (`src/music.js`) if it can't load.

## core.mp3

The jelly's everyday sounds, from the Soundza library (https://soundza.com), loaded as soon as sound is on.
The bubble's blow, pop (small and big) and hit, a crit, a bug dying (small and large), jump, land, hurt, and the jelly's Shield coming up, taking a hit and breaking.
Chan picked each from an audition board; the Vacuum's Shield keeps its synthesized sound.
Six takes (two each for the bubble's hit, its small pop and a small bug dying) are AI-made variations of the library sound beside them, from Soundza's `vary_sound`.
Every take's Soundza id is in `credits.json`.
