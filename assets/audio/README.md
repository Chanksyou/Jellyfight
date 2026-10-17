# Fire sample audio

`fireball-flight.mp3` is the owner's supplied
`koiroylers-fireball-impact-351961.mp3`, used for launch and travel in the fire sample audition.
Its filename identifies koiroylers; no license document was supplied.
Confirm redistribution rights before including this asset in a production release.

The sample and normal gameplay load this file after audio is unlocked. Loading
or decoding failure retains synthesized fire audio so gameplay can continue.

# Lightning

`lightning/` holds the owner's supplied clips from Hove Audio's **Lightning Magic** sound
effects pack (free version, https://hoveaudio.itch.io/lightning-magic-sound-effects-pack-free-version),
sold as royalty-free (not CC0). Confirm the pack's licence covers shipping them in the game.
Each file is trimmed to start on its strike, faded out and peak-normalized to -1 dBFS, as a
112 kbps MP3. `src/sfx.js` (`SAMPLES`) plays them by role, in turn, falling back to synthesized
sounds until they load; `lightning-sounds.html` plays each one.

| File | From (MAGElem_…_HoveAud_LightningMagic) | Role |
|---|---|---|
| launch-1, launch-2 | LightningStrikeSolo_08, LightningStrikeWoutRum_08 (first 0.5 s) | the ball leaving the bell |
| hit-1..3 | LightningStrikeWoutRum_13, _16, _26 | a lightning hit |
| big-1..3 | LightningStrikeFull_28, LightningStrikeWoutRum_21, _28 | a chain that jumps to 2+ bugs |
| chain-1..3 | LightningStrikeSolo_13, _16, _26 (first 0.25 s) | each chain jump, pitched up per jump |

Supplied but unused: LightningStrikeSolo_21 and _28.
