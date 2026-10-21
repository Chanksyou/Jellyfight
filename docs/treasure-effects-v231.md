# Treasure effects, v231

Six more non elemental treasure signatures. Combat rules and content values stay unchanged.
The implementation extends `GadgetLooks`; it adds no framework, light, dependency or gameplay word.

## Identity, rules and sequence

| Treasure | Existing rules retained | Feedback |
|---|---|---|
| Disco Ball | Actual bubble pop selects the next eligible bug within 0.2 m; one child at 65% damage, original speed, hit exclusions and pierce rules. Misses never echo. | Faceted lilac retarget glint, segmented rings and short accents following the real child path, higher second-contact chime. Ordinary bubble release, impacts, splats and receipts remain. |
| Bubble Bath | Eight evenly spaced straight bubbles every 5 s; existing first-fire timer, random rotation, damage, pierce and speed. | Eight beads gather during the last 0.3 s of cooldown; eight release strokes, existing bell squeeze and broad bloop together. Ordinary bubbles retain their travel/contact. |
| Cotton Ball | Existing minimum drop, radius and power-scaled damage; immediate sphere check centered at feet, excludes proxies. | Compressed translucent cotton wisps, full-radius contour on the hit frame, bell response, actual-neighbor flashes and airy low thump. No travelling damage wave. |
| Bath Salt | Existing death queue resolves on the next update; original strict sphere check, proxy exclusion, radius and damage. Chain deaths remain queued. | Tiny crystal edging at death, salt fracture at the queued burst, real-neighbor contacts, fading grains and rate-limited brittle cracks. |
| Rubber Duck | Original hurt trigger, per-effect cooldown, flat XZ radius, knockback and flat damage; dodge/reflect still precede it. | Three slightly offset elastic contours, recoil strokes only on affected bugs, existing hurt squash and SQUEAK receipt, rubber chirp and air pop. |
| Hand Mirror | First hit every 15 s blocks, reflects the post-modifier amount to the actual living attacker if available, and grants the existing 1 s invulnerability. Environmental hits still block without retaliation. | Subtle ready crescent; same-frame block glint and bell response, optical streak only to a real attacker, thin sheen for the existing invulnerability, folding away at expiry. Glass ping/crack layers. |

Strength remains with the existing damage/crit/kill feedback. Area upgrades use the actual
configured radius; additional cosmetics never extend reach or add hits. Remote salt bursts
get no repeated player kick. No new hit-stop or camera shake.

## Nine-question audit

All six were previously unscored in the attack scoreboard. Code-derived scores below
include inherited feedback; screenshots were stepped, and audio was rendered offline.
They are marked `seen: 'code'`, not a claim of normal-speed watching/listening.

| Question | Disco | Bath | Cotton | Salt | Duck | Mirror |
|---|---|---|---|---|---|---|
| Anticipation | 1 | 1 | 1 | 1 | 0 | 1 |
| Same-frame release | 1 | 1 | 1 | 1 | 1 | 1 |
| Travel / honest active area | 1 | 1 | 1 | 1 | 1 | 1 |
| Actual contact | 1 | 1 | 1 | 1 | 1 | 1 |
| Target reaction | 1 | 1 | 1 | 1 | 1 | 1 |
| Source reaction | 1 | 1 | 1 | 0 | 1 | 1 |
| Harmless aftermath / active-state end | 1 | 1 | 1 | 1 | 1 | 1 |
| Scaled receipt / kill | 1 | 1 | 1 | 1 | 1 | 1 |
| Layered varied sound | 1 | 1 | 1 | 1 | 1 | 1 |
| Total | 9 | 9 | 9 | 8 | 8 | 9 |

Zeros: Rubber Duck is an immediate reaction to hurt, with no added anticipation delay.
Bath Salt's remote burst does not kick the jelly on every chain kill. Both remain above
their ordinary treasure bar. The Legendary Hand Mirror includes a persistent ready cue.

## Limits and lifecycle

- Existing shared caps: 16 arcs, 64 streaks, 32 needles, 24 studs, two springs.
  New pools: at most 32 crystal pieces and 16 cotton wisps; a full pool drops decoration.
- Salt grains fade within 0.36 s; echo accents within 0.18 s; cotton wisps within 0.42 s.
  No residue implies an ongoing hazard. All fade on the Fx clock during suspended combat.
- Bath beads and mirror crescents are persistent prepared geometry. Reset hides them;
  inactive combat hides them. Warmup holds them and the new pooled kinds for shader loading.
- Reduce Effects / OS reduced motion suppress mirror rotation and echo streaks, reduce
  crystal/foam/contour counts, and suppress existing arc wobble and debris spin.
- Basic cool materials remain visible on Low without bloom. No dynamic lights.
- Six sounds use the existing master/mute bus, pitch jitter and role-specific rate limits
  (65–150 ms). No sustained loops. Offline output is finite, nonzero and below clipping.

## Verification

Seven new real-game stories cover preparation, exact bubble count/spacing, one echo,
miss contacts, original sphere eligibility, deferred salt chain, duck cooldown, actual
mirror attacker/environmental blocking, invulnerability expiry, reduced motion, bounded
pools, cleanup and real-render first-use shader counts. Independent read-only review found
no combat-rule blocker; its quiet-mirror and miss-test corrections were applied.

Initial targeted suite: 94 passed, 0 failed. Full final integration result is recorded
on the pull request. Desktop and landscape phone Low screenshots were inspected; the
initial cotton cushion was softened after preview to avoid hiding bugs.

Same 20-bug mixed scene, 24 frames: baseline 107–119 draws / 1.65 ms mean CPU
step+render submission; initial after 109–128 / 1.75 ms; phone viewport 116–135 / 2.55 ms.
No additional programs compiled after mixed first use. These Chromium diagnostics are
not physical phone FPS or completed GPU frame times. Physical flagship phones and
normal-speed audio listening remain unchecked. Balance bot skipped per owner preference;
combat rules are unchanged.
