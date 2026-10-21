# Six treasure signatures — v230

Cosmetic changes only. Content damage, target selection, radius, speed, cooldown,
first-fire timing, statuses and collision rules are retained. Ring's existing
`look` property selects `chord` and `needles`; no code branches on a treasure id.

| Treasure | Identity and preserved rules | Feedback |
|---|---|---|
| Cat Toy Mouse | One nearest ordinary bug within 1.2 m; 30 flat damage, original 10 s timer, speed and 4 s expiry. | A key prepares during the last .25 s of the existing timer. Same-frame release sound/bell pulse, scurrying body, moving tail and winding key. Actual contact compresses the nose/body, flashes the target and produces a clack, short skid and .24 s collapsing spring. Miss/target-loss expiry produces no contact. |
| Marble | Original .825 m/s, 1.47 s lifetime, size 4, one hit per enemy and original wall reflection. | Launch/bell pulse, rotating dark swirl, .2 s bounded trail, glass wall contact, local pressure streak and knock on actual enemy hits. No damage from the decorative trail. |
| Lego Brick | Original 4 s timer, size 2, 14 s lifetime, 5 active limit, walking trigger and .024 m burst. Levels retain their existing values. | Cosmetic .16 s drop/bounce on a child transform; the root remains active at the original floor position from frame one. Stud glint, plastic click, actual trigger flash/full-area outline, falling cosmetic studs and clatter. Reuse the body after expiry or consumption. |
| Guitar Pick | Original 5 s timer, .13 m radius, damage and shove; levels unchanged. | Preparation in the final .25 s of the existing timer, three full-radius string arcs on the damage frame, oscillating decay over .45 s, contact vibration marks, layered varied chord/body/pluck. The cosmetic arcs do not delay hits. |
| Magnifying Glass | Original nearest-target selection, range, damage and .25 s ticks; level 3 retains .2 s ticks. No fire status added. | Optical acquisition ring settles onto the actual target; a restrained .22 m column and focus spot tighten on ticks, with vapor and quiet varied optical tones. Shared damage receipts use grouped tick styling. Clears when no target exists. |
| Windowsill Cactus | Original when-hit trigger, 1 s cooldown, .25 m radius, .35 power damage and copy stacking. | Immediate source pulse, tapered needles only to selected/affected targets, localized contacts and a dry release/tick sound. No moving projectile, new delay, extra targets or stun. |

## Nine-question audit (code, not play-speed audio certification)

Rows: anticipation, release, travel/active area, impact, target reaction, attacker
reaction, aftermath, confirmation, layered varied sound. The registry previously
left these attacks unscored. Retrospective baseline estimates from the old code:

| Signature | Before | After | Remaining zero |
|---|---:|---:|---|
| Mouse | 4/9 | 9/9 | None |
| Marble | 3/9 | 8/9 | No separate anticipation cue before the automatic launch; acceptable for a Common treasure. |
| Brick | 5/9 | 9/9 | None; placed brick itself anticipates the trigger. |
| Chord | 5/9 | 9/9 | None; active area replaces projectile travel. |
| Focus | 7/9 | 9/9 | None; acquisition/active column replaces projectile travel. |
| Needles | 5/9 | 8/9 | No anticipation before reactive retaliation; do not delay its existing hit. |

The shared `ring` registry remains unscored overall: Bath Bomb and Ice Cube's
other ring looks were not reworked or newly certified by this task.

## Limits and lifecycle

- No new lights. All new effect geometry is batched. Pooled limits: 16 arcs,
  64 trail/contact rods, 32 needles, 24 studs and 2 spring afterimages. Optional
  decoration is dropped at the limit; actual damage/targets are unaffected.
- Bricks and marbles reuse their bodies, geometry and materials. Content still
  decides active counts/lifetimes. Reset removes bodies and hides every pooled
  cosmetic; transient effects expire on the ordinary Fx clock during suspended
  combat, including boss ceremonies and polyp transformations.
- Reduce Effects and OS reduced motion suppress new mouse shake/scurry, arc
  wobble/rotation, marble trails, brick bounce, and debris/spring spin. Readable
  contact, source silhouettes and honest area bounds remain.
- Synthesized sounds use existing mute, master bus and per-role rate limits.
  Focus ticks/rolling/scurry are deliberately quiet; there are no sustained audio
  loops. Offline captures verify nonzero finite output without clipping.
- Warmup explicitly includes the world camera layer and both direct and composer
  output variants. The old portrait-only mask could otherwise hide warmers while
  loading. State is restored in `finally`. This also uploads existing world/warmer
  geometry during loading: renderer memory counters therefore rise sooner,
  rather than proving that the new treasure models added that many geometries.

## Evidence and limits

- Existing treasure regression suite plus eight new real-game stories: 87 passed.
- Real-render shader check: zero additional programs after combined first use.
- Desktop and landscape phone viewport Low screenshots inspected for all six.
- Same 20-bug mixed-treasure Low scene, 24 measured desktop frames: before
  115–129 draws / 1.85 ms mean CPU step+submission; after 126–140 draws / 2.44 ms.
  Phone viewport after: 133–147 draws / 2.11 ms. These are software-rendered
  Chromium diagnostics, not physical phone frame times or GPU completion times.
- Physical flagship phone FPS and normal-speed audio listening remain unchecked.
  No balance bot: combat rules are unchanged and the owner previously declined it.
