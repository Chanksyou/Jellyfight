# Wind attack — v183

## Rules

Paper Fan fires at half the base bubble frequency: 0.88 casts/s at the starting
1.76 bubbles/s. Fire-rate increases scale both. Wind rate upgrades still multiply
wind's own rate. Each cast visibly gathers for 0.28 s, shortened at extreme
attack speeds to fit inside 65% of its firing period. The timer continues during
the windup, so the steady release cadence remains half the bubble rate.
Windup delay is explicitly requested for this attack; other automatic attacks
retain their immediate firing rules.

v220 doubles the base push multiplier from 0.3 to 0.6 (2.1 cm to 4.2 cm).
The separate damage-based shove is unchanged, and Box Fan still multiplies the
base push by 1.6. Damage, arc, extra projectiles and piercing remain unchanged.
A wind hit first deals its normal damage, then pushes a surviving target.
The push is swept against the scenery collision world with five body probes.
It stops short of a wall/object instead of teleporting through it. A confirmed
scenery collision applies one additional hit equal to 100% of that wind hit's
damage, as requested. Enemy bodies are not in this query. Horizontal floors,
near-tangential scrapes, misses and push-immune/rooted/proxy targets do not
produce collision damage. A lethal initial hit grants its normal kill without
an extra damage event; a collision kill also grants its reward exactly once.

## Seven phases and nine-row audit

v220 is a base-push tuning change: all nine feedback rows remain unchanged,
so the code audit stays 9/9 → 9/9. A farther push can produce more scenery hits.

| Row | Before | After | Evidence |
|---|---:|---:|---|
| Anticipation | 0 | 1 | Six gathering wisps plus the jelly's progressive bell compression. |
| Release | 0 | 1 | Bell recoil, launch glow and rush on the projectile's release frame. |
| Travel | 1 | 1 | Existing instanced crescent and tapered wisps. |
| Impact | 1 | 1 | Existing localized flash and fragments; scenery has its own flash/dust. |
| Target reaction | 1 | 1 | Actual shove and shared white hit flash; swept wall contact stops the body. |
| Attacker reaction | 0 | 1 | Bell release pulse and restrained shared `hit` feel step. |
| Aftermath | 1 | 1 | Fading wind-hit fragments and harmless wall dust. |
| Confirmation | 1 | 1 | Numbers reflect actual hit/collision damage; normal kill handling. |
| Sound | 0 | 1 | Varied gathering breath, release rush, contact snap/debris, scenery thud. |

Code audit: **5/9 → 9/9**, not a claim that all phases have been judged at play
speed. The prior scoreboard had no wind score; the before score above comes
from tracing the old implementation. Visual and sound review is still needed
before calling this a finished feel audit.

## Limits and cleanup

One pending windup for the jelly, shared across its simultaneous extra shots.
Gathering uses six transient holds in the existing bounded glow buffer; no new
lights or bloom pass. Release is one glow, and scenery impacts use seven sparks
and five pooled chunks. Charge sound is stopped when paused, reset, hidden,
transformed into a non-attacking polyp, or the wind element is removed. A paused
charge restarts on resume. Reduce effects suppresses camera motion through the
existing feel ladder. No new hit-stop or stun is added.

`attack/wind-*` checks collision damage/kill, body clearance, enemy/floor/rooted
exclusion, windup, both normal/fast cadence, and pause/reset cleanup.
`attack/ice-slow-and-followup-upgrade` covers slow-only ice, Snow Globe and
Freezer Burn. Balance simulation is omitted at the owner's request.

## Verification evidence

Six targeted stories passed on v181, including cadence at 1× and 4× Fire rate.
Desktop (1000×650) and phone-sized Low (844×390) stepped gameplay captures
show the source, wind crescent and scenery placement, with no browser errors.
The captured target lost 13.2 Health: a 6.6 wind hit plus a 6.6 scenery hit.
These are software-rendered Chromium checks, not real phone hardware tests.
The real-time recorder produced unusable footage, so its frame-time readings
were discarded. Normal-speed timing, listening, dense-fight performance and
real-device performance remain review items before release; the audit stays
`seen: 'code'`.
