# Fire feedback sample (v171)

The supplied recording starts when the projectile is fired and carries its
launch and travel sound. Confirmed fire hits throw 12 faster sparks and play a
separate synthesized impact crack and low punch. Death while the burn is active produces nine
charred fragments, 18 rising embers fading over 0.75 seconds, and a separately
throttled crackling death cue. This also applies when another attack finishes a
burning enemy. Silent removals skip the fire death effect. Existing damage,
rewards and burn spread are unchanged. Training targets now have 5 HP so the
sample demonstrates a real burn kill; normal enemy health is unchanged.

The sample now loads the owner's supplied `koiroylers-fireball-impact-351961.mp3`
after enabling sound. Launch plays the recording instead of the synthetic
launch cue. Standard casts fade out at 1.1 seconds; upgrades deepen pitch and extend
the tail (at most 1.52 seconds), with small random pitch variation. Playback shares
the game's master gain, mute and compressor, the existing 90 ms launch throttle, and a
three-voice cap. Failed loading falls back to synthesized sound. Normal gameplay
does not load the recording. Asset provenance is in `assets/audio/README.md`.

Open `fire-sample.html` on the same server as the game. Enable sound, choose
Birthday Candle or Upgraded flame, and cast. The scene uses the game's actual
`Bubbles`, `BubbleLooks`, jelly model, pooled effects, and sound synthesizer.
The three stationary training bugs are simplified targets, not the game's enemy AI.
The replay restores them between casts. Bloom is off.

## Design note

- Identity: a small hot core pulling tapered, flickering flame tongues and sparse
  embers behind it. The launch is anchored to the jelly. The sample squeezes the
  bell at release; the game retains its existing bell animation callbacks.
- Rules: existing nearest-target selection, independent Element timer, projectile
  speed, radius, range, direct damage, splash, burn ticks, upgrades, shatter, and
  burn spread remain in their original code paths. No windup delay, extra damage,
  new knockback, stun, or hit-stop was added.
- Release: a short local spark with a low pressure pulse, midrange lift, and
  rising filtered-noise flame rush. Launch audio is throttled to one cue per 90 ms across simultaneous shots.
- Travel: a solid core and animated tapered geometry carry the silhouette on Low.
  The existing shared particle buffer carries the short trail. Appearance values
  live under `--fire-*` in `content/look.css`.
- Contact: a brief hot flash at a confirmed strike, seven embers, and a descending
  low body and midrange punch under a sharp noise crack, ragged flame tail, and
  five irregular fading crackles. Pitch and texture vary between casts. Existing
  size, extra-shot and burn upgrades add bounded weight and a lower timbre.
  Impact audio is throttled to one cue per 95 ms. Fire no longer plays the generic watery pop at the same time.
  Range expiry and wall collisions produce no enemy-hit flash or impact sound.
- Aftermath: burning targets shed two small rising accents every 0.12 seconds
  while the existing burn is active; particles finish their short fade afterward.
- Upgrades: the sample's second mode uses the existing extra-shot, stronger-burn,
  and longer-burn values. It auditions these effects; it does not grant upgrades
  to normal play. Extra shots retain their real separate bodies and lanes.
- Limits: at most three trail puffs plus one ember per fireball per 0.035-second
  visual tick, with a 0.19-second trail and 0.38-second ember lifetime. All effects
  share the existing globally bounded pool; no per-shot lights or new bloom pass.

## Verification and capture

`attack/fire-feedback` checks immediate release, unchanged direct damage, six
unchanged burn ticks, expiry and reset. `attack/fire-miss` checks that a miss
does not create contact, sound, splash, or damage. Existing projectile and Element
upgrade stories cover shared mechanics. Preview checks cover audio mute, reset,
phone-sized layout, and the reduced-motion default (replay off).

To reproduce the before/after captures, using the same scene and viewport:

```powershell
node tools/fire-preview.mjs <output-directory> 2b62012
```

The tool routes only the original fire-related modules from that baseline for
the comparison. It exports screenshots, eight-second WebM clips with live audio,
a WAV of the actual synthesized cues, and measured frame/particle/draw-call data.
Headless desktop timings and phone emulation are not real-device performance claims.

On the initial capture: peak active particles were 112 before and 58 after;
peak draw calls were 83 before and 80 after; 95th-percentile frame interval was
about 33.4 ms in both. These are short sample-scene observations, not dense-game benchmarks.
The rendered WAV peak was about 0.24, below clipping.

The v168 audio revision adds a pressure pulse, stronger midrange and bass contact,
and randomized ember accents. Its rendered WAV peak was about 0.60, below clipping.
`attack/fire-audio-upgrades` checks that real upgrades increase launch and impact
weight, that weight is capped, and that projectile damage stays unchanged. The
three focused fire checks pass. This revision is an audio audition; a human
listening review still decides whether the intensity suits the game.

The full story run passed 383 checks and failed `act3/aerial-roots-land-near-and-creep`
once. That check passed twice with the original fire modules and twice with the
updated modules on isolated reruns. The full suite is not claimed green. Actual
iPhone/Pixel performance and a human listening review remain pending.
