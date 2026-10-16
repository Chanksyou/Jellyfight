# Player HUD Health feedback — v186

Only the player's HUD Health component changes. Boss and elite bars retain their
markup, styles and update behavior. Damage, healing, invulnerability, knockback,
existing hurt audio and camera feedback retain their gameplay rules.

## Feedback

- Actual HP and its number update immediately on damage. A pale coral loss trail
  holds for 200 ms, then drains over 400 ms. Rapid hits share the current hold
  deadline, so continuous damage cannot postpone the trail forever.
- Recoil scales with HP lost / maximum HP, capped at 11%, and cannot restart
  more often than every 180 ms. One bounded animation per effect channel.
- Rapid losses share one negative number; consecutive deliberate heals share
  one positive number. A change of sign starts a fresh label. Small fractions
  remain readable; no number is spawned per projectile.
- Deliberate healing adds a mint glow, a positive number and a smooth fill/edge
  response. Passive regeneration and stillness healing are quiet and preserve
  an active damage trail. Overhealing adds no feedback.
- Below 30% Health, a slow 1.4 s border pulse and warning icon communicate danger.
  Entering it from higher Health gives one capped local emphasis.
- A soft highlight at the fill's leading edge ripples on damage/healing.
- Reduce Effects and reduced-motion preference suppress recoil, edge wobble,
  entry emphasis and border/healing pulses, including effects already in flight.
  The real HP, trail, change number and low-health icon remain available.

Starting a run or changing max HP cancels prior Health timers/animations and
initializes quietly. This prevents reset and capacity changes from masquerading
as damage or healing. A progressbar label exposes the actual current/max values.

## Verification

Targeted stories cover instant HP loss, grouped rapid hits, the fixed trail
hold, quiet regen preserving that trail, deliberate healing, overheal, actual
Run healing call sites, reset/max-HP changes, Reduce Effects, phone layout and
boss/elite isolation. Existing regen, healing treasure, rebirth, death-save,
player-hit and Reduce Effects stories are also run. Final counts are in the PR.

The real Hud component was recorded at normal UI speed and inspected through
screenshots for damage, healing, critical Health and Reduce Effects. Desktop
1100x650 and phone-sized 844x390 captures fit the number beside the bar; no
browser errors. This component preview uses a plain background. Phone emulation
is not real-device performance evidence. No 3D meshes, lights or effects added.
Full release suite remains required before merge; no balance simulation needed
for these presentation changes. Real-phone performance/listening not checked.
