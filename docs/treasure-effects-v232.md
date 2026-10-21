# Twelve treasure signatures, v232

The next non elemental batch: Bobby Pin, Gold Ring, Reed Stick, Sticky Note, Pen Spring,
Bath Bomb, TV Remote, Fairy Lights, Glow Stick, Static Balloon, Thumbtack and Snooze Button.
All effects follow existing confirmed results. No content values, target rules, RNG proc
thresholds, damage, movement, cooldowns or status durations were changed.

## Identities and preserved rules

| Treasure | Rule retained | Feedback sequence |
|---|---|---|
| Bobby Pin | Existing pierce count, hit set and damage; only plain piercing hits get the new accent. | Short directional pin stroke at actual strike, metallic zip, ordinary bubble body, target flash and receipts. |
| Gold Ring | Existing volley counter, every tenth/eighth/seventh cadence and multiplier. | Pale gold launch seal/chime and short circumference accents on the real golden body; ordinary impacts and splats remain. |
| Reed Stick | Existing extra giant volley, size, damage and 0.6 speed multiplier. | Large pressure seal, low airy release voice, circumference accents that follow the actual slow bubble. Existing larger splash and pop remain. |
| Sticky Note | Existing mark event, strongest modifier, duration and proxy exclusion. | Small cool paper tab flutters at accepted mark application; existing skull stays for the actual mark duration. Restrained paper rustle. Also reused by other accepted marks, including acid. |
| Pen Spring | Actual extra-air-jump branch only; same jump count and velocity. | Coil release below the jelly, short source contour, elastic upward twang and the existing bell squeeze. No cue for failed jump input. |
| Bath Bomb | Existing first 6 s release, level-specific cooldown/radius/damage and exclusion of proxies. | Tiny cooldown preparation contour; simultaneous full-radius fizz contour, rising beads, bell response and air/fizz sound. Confirmed neighbors get contact glints. |
| TV Remote | Existing nearest-target ordering, 3/4/5 target cap, range, damage and timer. | Short stepped blue signal from source to each actual target, local contact core, electronic snap and bell response. Pooled paths replace per-target line allocations. |
| Fairy Lights | Same orbit, bulb count, contact radius, per-enemy 0.4 s gap and damage. | Small bright filament cores within the existing bulbs; real contact spark, tiny bell response and quiet chime. No new lights. |
| Glow Stick | Same radius, tick interval, damage and eligible targets. | Exact fixed-radius rim, damage-tick contour, real-target glints and restrained tonal tick. Replaced the old cosmetic +/-5% radius breathing with a stable boundary. |
| Static Balloon | Same random proc chance, range, hit exclusions, target count and stun; no extra damage added. | One lilac kinked snap from actual pop to actual proc target, endpoint core and dry static sound. Avoids duplicating the ordinary lightning arc. |
| Thumbtack | Existing crit roll/multiplier and 0.8 s pin/stun, including velocity stop. | Tack accent follows the affected bug during the original pin window, sharp contact click, existing crit/target reaction and stun indication. Ends on timer, death or removal. |
| Snooze Button | Once-per-run lethal save, original restored Health and 1.5 s invulnerability. | Clock-like concentric contours/hands, harmless fragments, bell response and three-note recovery chime alongside existing Health pulse, impact and toast. |

Target damage/crit/kill feedback remains responsible for significance. No additional
screen shake, hit-stop, gameplay recoil, charge delay or text receipt is introduced.
Existing upgrade values determine actual projectile size, target count and area size.

## Audit

Nine digits are anticipation, release, travel/area, impact, target reaction, source
reaction, aftermath, scaled confirmation, layered varied sound. Previously unscored
attack words are now scored in `attack-audit.js`. These are code audits with stepped
screenshots/offline audio, marked `seen: 'code'`; no play-speed listening claim.

| Signature | Before | After | Zero / scope |
|---|---|---|---|
| Bobby Pin | Inherited plain bubble | Inherits bubble; directional contact added | Modifier, not a separate attack word. |
| Gold Ring | Unscored | 111111111 (9) | Inherits bubble anticipation/contact/receipt. |
| Reed Stick | Unscored | 111111111 (9) | Real slow body; no added charge delay. |
| Sticky Note | Existing status marker | Inherits confirmed parent hit | Status modifier; target/receipt belong to parent attack. |
| Pen Spring | Existing movement pulse | Movement release/recovery only | No damaging target; attack questions do not apply. |
| Bath Bomb puff | Unscored look | 111111111 (9) | Full area shown immediately; no travelling damage wave. |
| TV Remote | Unscored | 011111111 (8) | No added anticipation before automatic timer. |
| Fairy Lights | Unscored | 111111111 (9) | Orbit body anticipates physical contact. |
| Glow Stick | Unscored | 111110111 (8) | No repetitive player recoil for a passive aura. |
| Static Balloon | Unscored | 011111111 (8) | Instant proc adds no anticipation delay. |
| Thumbtack | Existing crit/stun | Inherits confirmed parent hit | Pin modifier; actual crit and stun own its significance. |
| Snooze Button | Existing impact/toast | Recovery release, clock aftermath, chime | Defensive save has no damaging target; attack questions do not apply. |

## Limits and lifecycle

Reuses the shared pools (16 arcs, 64 rods, 32 needles, 24 studs, two springs,
32 crystals and 16 foam pieces). Paper tabs add one warmed geometry and a pool capped
at 24. Full pools discard decoration only. Remote's old line material, allocation,
list, warmup and expiry code were removed.

All new materials/geometries warm during loading; no added dynamic lights or shaders.
Pin follow references clear on expiry, death, removal and reset. Ordinary Fx time
expires transient effects during suspended combat. Low needs no bloom. Reduced motion
suppresses paper rotation, arc/debris motion and fizz count; quiet source/contact
information stays. No new sustained audio loops; voices use existing mute/master bus,
pitch variation and role-specific limits (90–500 ms).

## Evidence and limits

- Initial targeted suite after runtime correction: 107 passed, 0 failed. Added thirteen
  real-game stories cover all twelve plus combined first-use rendering, quiet counts,
  caps and reset. Final exact-commit full results are recorded in the PR.
- Independent review found the signal method/color name collision and retained pin
  references; both fixed. Test setup was corrected to isolate Fairy Lights' first contact.
- Before/after desktop and phone Low screenshots inspected. Twelve offline audio
  captures are finite and nonzero, peak amplitudes below 0.05, without clipping.
- Initial mixed 20-bug Low scene, 24 frames: before 109–122 draws / 2.44 ms mean CPU
  step+render submission; after 116–129 / 5.07 ms; phone viewport 123–136 / 3.04 ms.
  Zero new programs after first use. CPU samples overlapped other browser work; a
  isolated repeat measured 1.88 ms mean / 1.70 ms median before versus 1.92 ms mean /
  1.80 ms median after, 110–123 versus 117–130 draws; shader increase remained zero. These are Chromium software-rendering
  diagnostics, not physical phone FPS or GPU completion times.
- Physical flagship-phone FPS and normal-speed audio listening remain unchecked.
  Balance bot skipped per owner preference: combat rules are unchanged.
