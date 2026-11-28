# Summoner Jelly

A fragile backline commander. It fights through its little jellies (Jelly Mould, `src/turrets.js`) and steers them with its Signal.

## Base stats (differences from Normal)

Attack damage 4.5 · Fire rate 1.5/s · Range 36 cm · Health 20 · Move speed 108%

Starts every run with Jelly Mould at level 1 (`start-treasure="jellyMould"` in `content/jellies.kdl`, owned but not counted as found).
Taking Jelly Mould again levels it to 2 and 3.

## Attack: the Signal

`attack="signal"`, `hit=1` (`ELEMENT_BASE.signal` in `src/words.js`): a fast light dart at full Fire rate.
The bug it hits is Signalled for 3 s (`bubbles.signalled`), one bug at a time: a hit on another bug moves the Signal, a hit on the same bug starts its time again.
Little jellies shoot the Signalled bug first while it is in their Range and do 25% more damage to it (`signalMore`).
A little jelly's own shot never Signals; Elites and the Boss can be Signalled.

Look: a white dart in a cyan halo with a short cyan and violet ribbon (`--signal-*` in `content/look.css`); the Signalled bug glows and a ring pulses out from it every 0.6 s (glow only in Reduce effects).
Sound: a sonar ping on release, a tick on a hit, a two-note lock-on chime when the Signal moves (`sfx.elementLaunch('signal')`, `elementHit('signal')`, `signalMark`).

## Damage budget (spec-core.md: 9 to 12 a second on one bug at level 1)

- Signal: 4.5 x 1 x 1.5/s = 6.75
- Level 1 little jelly (40% damage, 8 s of every 10) on the Signalled bug: 4.5 x 0.4 x 1.25 x 1.5/s = 3.4 while out, 2.7 on average
- Together: about 9.5 a second, the low end of the budget. The one knob is `hit=`; Jelly Mould's numbers are shared with every type, so leave them.

## Unlock

Defeat 9 Elites (the same count as the Wind jelly, so both open together).

## Attack upgrades (pool of 12, `content/upgrades.kdl`)

All of them work through the little jellies, with four words: `turret-element` (the Element they fire; with two or more, each one set down takes the next in turn), `turret-up` (sooner, more at once, Health, time, damage per Element out, Crits), `turret-on "place|end|popped|every"` (a block of timed effects where the little jelly stands) and `turret-relay` (your Signals passing one take its Element), plus `per of="little-jellies"`.

| Upgrade | What it does | Words |
|---|---|---|
| Cinder Mould | Fire shots; a 2x Blast within 10 cm when one is gone | `turret-element "fire"`, `turret-on "end" { ring }` |
| Frost Mould | Ice shards; Chills bugs within 12 cm every 1 s | `turret-element "ice"`, `turret-on "every" { ring chill= }` |
| Tesla Mould | Lightning shots; every 2 s zaps 2 bugs within 15 cm for 50% | `turret-element "lightning"`, `turret-on "every" { zap }` |
| Spore Mould | Poison blobs; a 10 cm Poison cloud for 4 s when one is gone | `turret-element "poison"`, `turret-on "end" { cloud }` |
| Gale Mould | Gusts; set down, shoves bugs within 12 cm away | `turret-element "wind"`, `turret-on "place" { ring push= }` |
| Prism Mould | Glitter bombs; 1 in 5 hits Crit for 2.5x | `turret-element "glitter"`, `turret-up crit=` |
| Budding | 40% sooner, +2 at once (6 at most) | `turret-up rate= most=` |
| Relay | your Signals passing within 8 cm take its Element and +35% | `turret-relay` |
| Cross-Pollination | +25% little jelly damage per different Element out | `turret-up per-element=` |
| Martyr Pop | bugs pop one: a 3x Blast within 12 cm | `turret-on "popped" { ring }` |
| Choir | +10% Fire rate per little jelly out, up to +60% (they fire at your Fire rate) | `per "fire-rate" of="little-jellies"` |
| Thick Glass | 2x Health, 50% longer, +30% Range | `turret-up health= time=`, `stat range` |

Changed from the plan: Martyr Pop and the Mould Blasts don't apply the little jelly's Element (the `ring` they use has none); Tesla Mould zaps bugs near each little jelly rather than arcing between them; the Signal has its own name so it isn't confused with Sticky Note's mark (which Elites and the Boss ignore). Turrets stay at 6 at once.

Stories: `src/stories/summoner.js` (`types/summoner-*`, `treasures/turret-*`, `treasures/per-little-jellies`, `content/start-treasure`).
