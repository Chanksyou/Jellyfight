# The Great White One — PoE2 Shark Boss: Complete Attack Breakdown

*For feeding into an AI to animate a shark model with the same attacks.*
*Sources: poe-vault Act 4 boss guide, Game8 boss guide, datamined skill list (poe2db), and a 6-second Game8 fight clip (frames inspected). See "Sources & confidence" at the end for what is verified vs. inferred.*

## The boss at a glance

- **Name:** The Great White One
- **Game:** Path of Exile 2, Act 4 (optional boss)
- **Location:** Whakapanu Island, in a shoreline arena called the **Shark Pit** — a sandy beach arena ringed with sharp, teeth-like rocks
- **Damage:** Physical (with Cold resistance/weakness profile: resists Physical and Cold, weak to Lightning)
- **Drops:** Shark Fin (quest item for the "Tribal Medicine" quest)
- **Fight structure:** A small baseline moveset used the whole fight, plus one big attack that unlocks at **85% health**. There is no second phase — the fight just gets denser as piranha pools accumulate.

## The model and how it moves (read this first)

The Great White One is **not a normal swimming shark**. It is a huge, land-adapted shark that:

- **Walks on land.** It rears up and moves across the sand on its fins — its pectoral fins work like stubby arms (it literally swipes with one in its combo). Animate it upright-ish, belly forward, tail dragging/swaying behind, not belly-down like a beached fish.
- **Swims through sand as if it were water.** When burrowed, the whole body vanishes and only a **dorsal fin ridge cutting through the sand** (plus a churned sand trail) is visible. This is its signature look: the player tracks a moving fin, not a body.
- **Erupts out of the ground.** Its burrow attacks end with the shark bursting vertically out of the sand, jaws first, sand exploding outward.
- **Head-tracks its target.** The datamined model data includes quadruped-style head control with a ~0.5 s head-turn duration — the head leads every attack, snapping toward the player before the body follows.

## Combat systems that shape the animations

These aren't attacks, but they change how the attacks play — include them or the moveset won't read correctly.

- **Prey (the blood-scent mechanic).** After any of its melee attacks hits, the target gains the **Prey** debuff ("The scent of blood lures your foe"). While marked, the boss's burrowed movement tracks the player faster and more tightly. Animation note: burrowed-fin movement should visibly speed up and home in harder once Prey is applied; the fin should curve toward the player rather than wander.
- **Feeding Frenzy.** After landing a bite, the shark enters a frenzy state: it moves faster and hits harder. Animation note: frenzied attacks should be snappier (shorter windups, more aggressive posture, wider jaw gape) than the same attacks in the calm state.
- **Bleed.** Nearly all its melee hits inflict bleed — the fight is built around damage-over-time pressure, so bite and swipe hits should read as tearing, raking wounds, not clean blunt impacts.
- **Quicksand.** One of its spin attacks leaves a slowing sand zone (the "Quicksand" debuff).
- **Piranha pools.** Several attacks leave behind circular pools of water full of snapping piranha that deal damage over time to anyone standing in them. Pools persist and accumulate through the fight, shrinking the safe arena.

---

## Attack 1 — Lunging Bite (melee basic)

- **Trigger:** Player in melee range. Used throughout the fight.
- **Anticipation:** The shark plants itself, rears its head back slightly, and opens its jaws wide — the head leads, snapping toward the player.
- **Action:** A fast forward lunge, head thrusting ahead of the body, jaws snapping shut on the target. Short range, frontal cone.
- **Effect:** Heavy physical damage + bleed. A hit applies **Prey** to the target.
- **Recovery:** Brief settle back onto its fins before it can act again.
- **Animation notes:** This is the workhorse attack — keep it quick and readable: rear back (0.3–0.5 s), lunge-and-snap (fast), recover. The jaw snap is the impact frame; add a small sand kick-up at the feet on the lunge.

## Attack 2 — Leap / Jump Attack (ranged gap-closer)

- **Trigger:** Player at medium to long range. Used throughout the fight.
- **Anticipation:** The shark crouches low, coiling its tail under itself, head fixed on the player.
- **Action:** It launches itself in a high arc toward the player's position and slams down on landing, sand bursting outward at the impact point. The datamined skill list shows three range variants (close, medium, long) plus 180° variants, meaning the leap works whether the player is in front of or behind it.
- **Effect:** Area damage at the landing point.
- **Recovery:** A beat of stillness as it re-plants its fins after landing.
- **Animation notes:** A full-body ballistic arc — tail tucked on takeoff, body stretched at the apex, jaws slightly open, then a heavy landing with a sand-burst ring and a small ground shake. The 180° variant should include a fast spin-turn before takeoff, not a slide.

## Attack 3 — Melee Combo (bite → arm swipe → tail sweep)

- **Trigger:** Player in melee range. The boss's signature combo, used throughout the fight.
- **Anticipation:** A short square-up: the shark faces the player and raises its head.
- **Action (three beats, no pause between):**
  1. **Bite** — a forward jaw snap, as in Attack 1.
  2. **Arm swipe** — it swings one pectoral fin like an arm in a horizontal slash across the player's position.
  3. **Tail sweep** — it pivots and whips its tail in a wide frontal arc, sweeping the area in front of it.
- **Effect:** Three consecutive hits; the bite can apply bleed and Prey. The tail sweep covers a wider arc than the bite, catching players who sidestepped the first two hits.
- **Recovery:** The tail swing's momentum carries it into a brief re-facing pause.
- **Animation notes:** This is the combo to nail — three distinct silhouettes in sequence: head-forward snap, fin-arm slash (the fin should read as a limb here, elbow-ish bend), then a full-body pivot into the tail whip. The datamined list includes a second combo variant, so feel free to vary the order/timing slightly on repeat uses. A dedicated tail-hit skill exists in the data, so the tail sweep is a real, separate hit — not just follow-through.

## Attack 4 — Tail Spin (360° spin with sand spray)

- **Trigger:** Melee range, typically when the player is close or circling it.
- **Anticipation:** The shark plants its fins and begins to coil, tail drawing inward.
- **Action:** It spins its whole body 360°, tail whipping around in a full circle, throwing a spray of sand outward in all directions as it turns.
- **Effect:** Damage all around it (not just in front) — the counter to standing behind it.
- **Recovery:** A short dizzy-settle as the spin resolves.
- **Animation notes:** The spin should be fast and low — body close to the ground, tail extended to maximize the circle, sand spraying radially off the tail tip. This is also the attack most likely to pair with the quicksand zone (see Attack 8); if combined, the spin leaves the ground churned.

## Attack 5 — Rear / 180° Melee

- **Trigger:** Player behind the shark.
- **Anticipation:** A fast head-whip around toward the player.
- **Action:** A snapping bite (or jump-attack variant) delivered after spinning to face the player.
- **Effect:** Punishes trying to sit safely behind it.
- **Animation notes:** The turn itself is the tell — a sudden head snap followed by the body whipping around. Never let the shark attack backward without turning; the turn is part of the move's readability.

## Attack 6 — Sand Dive (burrow → track → erupt, ×4)

- **Trigger:** Used throughout the fight, repeatedly. This is the fight's defining move.
- **Anticipation:** The shark dives nose-first into the sand and vanishes completely. Only its dorsal fin remains visible, cutting a line through the sand toward the player, with a churned trail behind it.
- **Action:** The fin tracks the player's position (tracking slightly loosely at first, tighter and faster if the player has Prey). When it arrives, the shark **erupts vertically out of the sand, jaws first**, sand exploding outward — then immediately re-burrows and repeats. **It does this four times in a row**, each eruption at the player's current position.
- **Effect:** Each eruption deals damage at the burst point and leaves behind a **piranha pool** — a circular patch of water full of snapping fish that deals physical damage over time to anyone standing in it. After four eruptions, four pools dot the arena.
- **Recovery:** After the fourth eruption it stays surfaced, briefly shaking sand off before resuming normal attacks.
- **Animation notes:** This is the money sequence. Phases: (a) dive — nose down, body pouring into the ground, sand closing over it; (b) fin tracking — fin ridge + wake, speed ramping up under Prey; (c) eruption — vertical burst, body near-vertical, jaws agape, sand fountain; (d) re-burrow — it folds back down without fully surfacing between repetitions. The four repetitions should feel relentless, with the fin's approach getting faster each time.

## Attack 7 — Burrowed Bite

- **Trigger:** While burrowed and tracking (often chained into the Sand Dive sequence).
- **Anticipation:** The fin's path straightens directly at the player and the sand ahead begins to bulge.
- **Action:** The shark's head bursts partially out of the sand and snaps at the player without fully emerging, then sinks back under.
- **Effect:** A quick bite hit from below/side — harder to read than a surfaced bite because only the head appears.
- **Animation notes:** A "half-eruption": head and jaws only, sand spraying forward, then an immediate sink. Use it as a stinger between full eruptions.

## Attack 8 — Sand Maelstrom / Quicksand Spin

- **Trigger:** Mid-fight, from a burrowed state.
- **Anticipation:** The shark burrows and begins spinning beneath the surface — the sand above it starts swirling in a widening circle.
- **Action:** A large circular zone of churning sand forms around it. The swirling sand acts as quicksand, heavily slowing anyone inside. The boss then follows up by leaping out of the maelstrom at the player.
- **Effect:** Movement-speed slow inside the zone (the "Quicksand" debuff), setting up the leap follow-up for big damage.
- **Recovery:** The zone persists briefly after the shark leaves it.
- **Animation notes:** The tell is the ground itself — a visibly rotating sand vortex with a clear circular edge, growing to full size before the leap. The shark should be felt spinning *under* the vortex (sand rippling in rotation), then the leap bursts out of the vortex center. Note: some guides describe this and the Sand Dive as one sequence and some as separate moves; the datamined skills confirm both a quicksand zone skill and dive skills exist, so treat them as combinable pieces.

## Attack 9 — Tornado Dive (unlocks at 85% health)

- **Trigger:** Only once the boss is below 85% health. Its biggest, flashiest attack.
- **Anticipation:** The shark burrows and tracks the player, then the ground forms a **large circle of dust** at its position — the biggest telegraph in the fight.
- **Action:** The shark **jumps high out of the sand** from inside the dust circle, and as it does, it spawns **three tornadoes** (sand-and-water funnels) that travel outward in random directions toward the arena's edge. The tornadoes throw piranhas out in every direction as they move, scattering fish projectiles across the arena.
- **Effect:** The tornadoes are moving hazards (the "Tornado" debuff/zone), and the scattered piranhas add chip damage zones wherever they land. The arena gets significantly more dangerous after each use.
- **Recovery:** The shark lands heavily and takes a moment to recover — the best punish window in the fight.
- **Animation notes:** The full spectacle beat: dust circle forms and holds (readable pause), then a huge vertical leap with the body fully airborne and arched, tornadoes spiraling out from the launch point with visible fish silhouettes spinning inside them, piranhas flung outward like shrapnel. The landing should be the heaviest impact in the whole moveset — big sand burst, brief ground tremble, shark planted and still for a beat.

## Attack 10 — Piranha Pool Burst

- **Trigger:** Tied to eruptions and tornadoes (not a standalone cast).
- **Anticipation:** Water begins bubbling up through the sand at the eruption/landing point.
- **Action:** A circular pool of shallow water forms, visibly full of thrashing piranha — fins and snapping jaws breaking the surface.
- **Effect:** Standing in the pool deals physical damage over time; pools persist and accumulate, progressively shrinking safe ground.
- **Animation notes:** The pool itself needs life: constant fish thrash, splashing, occasional leaping fish. A fresh pool should "burst" into existence with a splash on formation, then settle into a churning idle.

## Attack 11 — Feeding Frenzy (state, not a strike)

- **Trigger:** After landing a bite.
- **Action:** The shark visibly enters a frenzy — faster movement, snappier attacks, wider jaw gape, more aggressive posture.
- **Effect:** Increased speed and damage across the whole moveset until the state ends.
- **Animation notes:** Frenzy should be readable at a glance: quicker windups, less settling between attacks, maybe a reddish tint or blood-flecked jaws, and the burrowed fin moving noticeably faster. When animating any attack, produce a calm version and a frenzied version with ~20–30% faster timing.

---

## Fight flow (how the attacks sequence)

1. **Opening:** The shark bursts out of the surf/sand at the shoreline as the player approaches — full-body breach, sand and water spray, then it plants on the beach.
2. **Baseline loop (100–85% HP):** Lunging Bite, Leap, Melee Combo, Tail Spin, and Sand Dive (×4 eruptions) rotate, with Prey applied by any melee hit making the burrowed phases track harder.
3. **85% HP:** Tornado Dive joins the rotation. From here on, piranha pools from dives and tornadoes accumulate, and the arena gets progressively more hazardous.
4. **Throughout:** Frenzy windows after landed bites make everything faster and more dangerous; stuns interrupt it and open punish windows.

## Paste-ready summary (for an AI animation prompt)

> A massive land-walking shark boss that fights on a sandy beach. It rears up on stubby fin-arms, lunges with wide jaw snaps, leaps in high arcs onto its target, and performs a three-hit combo: bite, fin-arm swipe, full-body tail sweep. It spins 360° spraying sand, and repeatedly burrows completely under the sand — only its dorsal fin visible cutting toward the player — before erupting vertically out of the ground four times in a row, each eruption leaving a churning pool of snapping piranha. Below 85% health it adds its ultimate: it forms a large dust circle, leaps high into the air, and spawns three wandering sand tornadoes that fling piranhas in all directions. Any landed bite marks the victim as Prey, making its burrowed fin track faster, and puts it into a Feeding Frenzy of faster, harder attacks.

## Sources & confidence

- **poe-vault Act 4 Boss Guide** — the most structured account: baseline bite/leap/combo, Sand Dive ×4 with piranha pools, Tornado Dive at 85% (three tornadoes, piranhas in every direction). Treat as the backbone.
- **Game8 Boss Guide** — Prey debuff mechanic (melee hit → faster burrowed tracking), debuff list (Feeding Frenzy, Prey, Quicksand, Tornado), resistances/weakness. The 6-second Game8 clip's frames confirm the burrowed-fin visual and the Prey debuff text ("The scent of blood lures your foe").
- **Datamined skill list (poe2db, from game data)** — corroborates and expands the moveset with internal names: TailSpin, two MeleeCombos, MediumRangeJumpEndAttack (+180° variants), Melee180, BurrowedBite, DiveClose/Medium/LongRange (charge + impact), SandnadoQuicksand, SandnadoFishProjectile, SandnadoFishnado, BurstPuddle, BurrowEmerge/BurrowEmergeFast, FinTracker (+Backwards), BurrowedFinSinkTelegraph, BurrowedFinRaise. This is the strongest evidence for the full move list, but skill names alone don't give timings — timings in this doc are descriptive, not frame data.
- **mmoexp guides** — weakest source (SEO-grade, repetitive); used only where corroborated (quicksand slow zone + leap follow-up, piranha puddle damage-over-time, bleed focus, lightning weakness). One junk result that described a totally different boss (a cave beast with icy breath) was discarded.
- **Caveats:** The official wiki's ability section for this boss is empty, and patch 0.4.0 notes say the boss's behaviour was "improved" — so some details from 0.3.0-era guides may have shifted. No published frame data or exact timings exist; any numbers in animation prompts should be treated as artistic direction, not game data. The "Sand Maelstrom" vs "Sand Dive" naming differs between guides; this doc treats the quicksand spin and the ×4 dive as combinable pieces, which the datamined skills support.
