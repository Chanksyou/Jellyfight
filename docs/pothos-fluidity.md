# Pothos fluid combat — v184

## Fight changes

The pot remains planted on the pillows. Its heart and canopy now sway together,
with phased leaf motion along the vines. Targeting and leaf collision follow the
actual pose; motion stops when dying. The former whole-pot cutting shake was
removed because rotating the pot disagreed with its collision frame.

Recovery is 0.95 s calm and 0.35 s angry (previously 1.8/1.1 s). Whip and sweep
warnings remain 0.8 s and the heart opening remains 1.5 s. Health, damage,
projectile speed, counts and guard rules are unchanged. This deliberately raises
pressure through more frequent decisions and simultaneous threats.

The dragonfly summon lasts 1 s, followed by normal recovery and the next attack.
Its shield independently lasts until all four guards die or 30 s pass. The boss
continues its normal attack rotation while shielded; it cannot summon twice.
The existing falling roots, Cuttings and dragonflies provide pressure to keep
moving. No new attack area, unannounced hit or per-hit stun was added.

## Nine-row code audit

Scores below are from code tracing, not a normal-speed feel certification.
Before entries were unscored in the registry; the baseline was reconstructed.

| Row | Whip before/after | Sweep before/after | Snap before/after |
|---|---|---|---|
| Anticipation | 1/1: curved lane + volume | 1/1: wedge + arc volumes | 1/1: short lane |
| Release | 1/1: vine lashes + crack | 1/1: brush/crack + vine | 1/1: vine lashes + crack |
| Travel | 1/1: posed vine | 1/1: vine crosses warned wedge | 1/1: posed vine |
| Impact | 1/1: burst and player hit | 0/1: new flash at actual player contact | 1/1: burst and player hit |
| Target reaction | 1/1: hurt + knock/launch | 1/1: hurt + directional knock | 1/1: hurt + knock |
| Attacker reaction | 1/1: vine follows through, heart opens | 1/1: vine follows through and settles | 1/1: vine recoils |
| Aftermath | 1/1: landed vine/open heart | 1/1: vine settles | 1/1: fading fragments |
| Confirmation | 1/1: shared actual damage/death feedback | 1/1: same | 1/1: same |
| Sound | 1/1: layered wind/crack/body with randomized noise | 1/1: brush/crack/body | 1/1: wind/crack/body |

Whip **9/9 -> 9/9**, sweep **8/9 -> 9/9**, snap **9/9 -> 9/9**;
all remain `seen: code`. Cuttings and roots retain their delegated enemy attack
chains and unscored registry entries; their effects were not redesigned here.
No new shake/hit-stop values: player hurt uses the shared feel ladder and honors
Reduce effects. Motion is local to the plant and does not depend on sound/bloom.

## Evidence and limits

34 targeted Pothos stories passed on the final implementation, including the
sweep-flash assertion. New stories cover moving heart/drawn target
agreement, anchored pot, stopping when dying and attack rotation during the shield.
Existing stories cover jumping warnings, body blockers, openings, shield expiry,
Dendi's finish, camera framing and no new shaders.

Stepped desktop 1100x650 and phone-sized Low 844x390 captures have no browser
errors. Same recovery scene: desktop draw calls 315 before/after; simulation p50
0.1 -> 0.3 ms and p95 0.5 -> 1.4 ms. Phone-sized Low after: 269 draw calls,
p50 0.2 ms, p95 0.4 ms. Heart X travel over three seconds: 3.83 cm (was static).
These are software-rendered Chromium measurements of simulation cost, excluding
render time; they do not establish FPS on a real phone or dense combat performance.
No new geometry, lights or shader variants; leaves remain one instanced mesh.

Normal-speed playback, listening, dense-fight measurements and real-device
performance remain release review items. Full suite is required before merge.
Balance simulation remains omitted at the owner's prior request.
