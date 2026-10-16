# The Feel of Impact — A Foundational Basis for Attack Effects

*Synthesized from two tutorial reels by Egor Vasilev (@vasilev.yegor) — "How to make shots juicy" (Oct 15, 2026) and "How to make a spell juicy" (Oct 14, 2026) — unified into one framework and grounded in the established game-feel literature.*

## Thesis: an attack is communication before it is arithmetic

The simulation decides damage in numbers. The player never touches those numbers directly. Everything a player believes about an attack — that it fired, that it connected, that it hurt, that it mattered — arrives through effects: motion, light, sound, and the world's reaction.

So attack effects are not decoration applied to a combat system after the fact. As far as the player is concerned, they *are* the combat system. A perfectly balanced attack that reads as weak will be reported as weak, and tuning its damage numbers upward to compensate corrupts the balance to fix what is actually a feedback problem. Effects deserve to be designed as a discipline with a structure — a basis — not sprinkled on as polish.

Two working animators' checklists, one for gunfire (7 steps) and one for a magic projectile (8 steps), turn out to be the same theory stated twice. Unified, they describe a single causal chain that every satisfying attack completes, plus one parallel channel (sound) that runs alongside all of it. This document states that chain, explains *why* each link works in terms of human perception, and names the failure mode that appears when a link is missing — which the reels demonstrate explicitly: every intermediate version is "better, but still feels weak, because…"

## The perceptual basis: why these things and not others

The techniques are not arbitrary taste. Each one exploits a specific way the human perceptual system judges events.

**1. Causality is perceived, not computed.** In Michotte's classic experiments on the perception of causality (1946), when one object's motion is followed within a frame or two by another object's response, the brain does not *infer* that the first caused the second — it *sees* causation directly. This is why the reels insist the muzzle flash, the gun's kick, and the shot leaving happen on the **same frame**, and why the target's flinch must be immediate. Stretch the timing and the same damage stops reading as cause and effect and starts reading as two unrelated events that happened near each other.

**2. Force is judged by its consequences, not by its source.** People estimate power from displaced mass, deformation, recoil, debris, and lingering change — an intuitive Newtonian physics. A larger number ticking off a health bar does not read as power. A body thrown across the room, a target squashing on impact, shells accumulating on the floor — those read as power. Effects are how force becomes visible.

**3. Prediction confirmed is satisfying; prediction denied is noise.** The brain is a prediction engine and rewards confirmed predictions. Anticipation — a charge-up, a wind-up, a gathering glow — lets the player predict the coming event, and the release cashes that prediction in. Attacks that appear from nothing feel arbitrary. Anticipation also scales expectation: a longer, bigger charge is a *contract* promising a bigger payoff, and the release must honor it.

**4. Sound carries the information vision cannot.** Vision reports shape and motion well, but the *material* facts of an impact — hard or soft, heavy or light, near or far — are carried by sound. Real impacts decompose acoustically into a sharp transient, a body, and debris noise. Layered game sound (crack + whiz + thud + ping) works because it mirrors that decomposition; a single sample reads as a toy within ten repetitions.

**5. Repetition without variation disappears.** Habituation is the perceptual system's economy measure: an identical repeated stimulus fades from attention. This is why the reels' smallest-sounding advice — spread on the bullets, a nudge of pitch on every shot — is load-bearing. Combat is the most repeated verb in an action game; effects that cannot survive the 500th repetition will quietly stop existing for the player.

**6. Attention tracks change, and memory trusts what persists.** A flash lasts a frame; a burning enemy, a scorched wall, and casings on the floor extend the event in time. A world that keeps evidence of the fight lets the player read the fight's history at a glance — and proves the damage was real in a way a transient number cannot.

## The phase model: one causal chain, seven links and a channel

### Phase 1 — Anticipation
*From: the spell reel's Step 1 (Charge).*
The wind-up before release: pulling fire from the air, a growing glow, a drawn bow, an aim beam. Its function is to load the prediction (basis 3) and to telegraph — for enemy attacks, anticipation is what makes damage feel *fair*, because the player was shown what was coming. **Missing it:** attacks feel arbitrary and cheap, and big attacks feel no bigger than small ones because nothing scaled the expectation.

### Phase 2 — Release
*From: the gunfire reel's Step 1 (The Shot).*
The instant of firing, marked by a flash and the weapon's kick on the same frame the projectile leaves. Its function is to stamp t=0 and bind cause to effect in a single perceptual instant (basis 1). **Missing or smeared across frames:** the shot feels disconnected and laggy, as if the game responded late to the player's input.

### Phase 3 — Travel
*From: gunfire Step 2 (Bullets); spell Steps 2–3 (Core, Trail).*
The projectile as a trackable physical object: a bright hot core, a trail or tongues of flame behind it, a little spread and imperfection so it doesn't read as geometry. Its function is to let the eye carry the cause across space to the effect — the player must be able to follow *what* hit the target. **Missing it:** hits appear to come from nowhere; perfectly straight, coreless projectiles read as lasers or UI lines, not as things with mass.

### Phase 4 — Impact
*From: spell Step 4 (Burst); the flash-and-squash half of gunfire Step 3 (The Hit).*
The event at the contact point: a flash, sparks, and deformation — squash — where the projectile lands. Its function is to mark the exact place and instant of contact; squash is the oldest device in animation (one of the twelve classical principles) precisely because deformation is how force absorbed becomes visible (basis 2). **Missing it:** the projectile politely vanishes at the target's surface and the damage feels like a rumor.

### Phase 5 — Reaction
*From: spell Step 5 (Reaction); gunfire Steps 3–4 (The Hit's knockback, Recoil).*
Both bodies answer. The target flashes white, flinches, and is knocked back; the attacker is pushed by their own recoil and the camera kicks with them. The one-frame white flash is a "this one counted" stamp legible at any distance or in any clutter. Knockback converts damage into distance — the most legible unit a game has. **Missing it:** the single most common cause of "my weapon feels weak" — the enemy absorbs shots like foam, and the player's own body never acknowledges the power it supposedly unleashed.

### Phase 6 — Aftermath
*From: gunfire Step 5 (Blood & Shells); spell Step 7 (Aftermath).*
Persistent evidence: casings and debris that stay, a scorch mark, an enemy left burning whose flames die down over seconds. Its function is duration — it extends the event past its instant (basis 6) and makes damage-over-time *visible* instead of asking the player to trust a number. **Missing it:** a pristine battlefield seconds after a huge fight; the fight feels like it never happened.

### Phase 7 — Confirmation
*From: gunfire Step 7 (The Kill); spell Step 8 (Damage Numbers).*
The receipt that closes the loop: damage numbers scaled by significance (small for a normal hit, big for a crit), and ceremony for the kill — a freeze frame (hitstop) that holds the climax for a beat before the body is thrown. Its function is bookkeeping the player can audit and a sense of escalation: the receipt teaches what mattered. Hitstop gives the brain a moment to register the peak event instead of letting it blur past. **Missing it:** kills indistinguishable from hits, uniform numbers, no escalation — the player cannot tell a great play from an ordinary one.

### The parallel channel — Sound
*From: gunfire Step 6 (Sound); spell Step 6 (Sound).*
Not a phase but a track running through all of them: layer the transient (crack), the travel (whiz/whoosh), the impact (thud/boom), and the debris (ping, casings), and vary the pitch slightly on every repetition (basis 4 and 5). It is the only channel that reports weight and material, and the channel most players will describe — unprompted — when they say an attack "feels powerful." **Missing or single-sampled:** the attack reads as a toy within minutes, however good it looks.

## Cross-cutting laws

**L1 — Juice is cumulative, and the chain is only as strong as its weakest link.** Both reels are built as controlled experiments: add one layer, and the verdict is "better, but…" until the chain is complete. A missing phase doesn't subtract its share — it breaks the causal story at that link and downgrades the whole attack.

**L2 — Emphasis is a budget.** Effect intensity must scale with significance: normal hit < crit < kill; trash enemy < boss. The reels' opening contrast — "feels like nothing" versus "feels like thunder" — only works because a baseline exists. If everything is thunder, nothing is. Restraint on the ordinary is what buys meaning for the exceptional.

**L3 — Timing beats quantity.** Same-frame causality, a freeze of one to three frames at the peak, anticipation proportional to power. Ten effects mistimed lose to three effects on the exact frame.

**L4 — Feedback must survive real play conditions.** It has to read at gameplay distance, in clutter, at speed, on a small screen, and for the five-hundredth time. A white flash reads anywhere; a subtle facial animation does not. Design for the conditions of play, not the conditions of the demo.

**L5 — Every effect is information, or it is a tax.** Each element should answer a question the player is asking: Did it fire? Did it hit? How much did it matter? Is it dead? An effect that answers nothing is clutter that dilutes the ones that do.

## Why the focus belongs here

- **Feel is the player's only evidence.** Players cannot perceive the simulation, the balance spreadsheet, or the damage formula — only their rendering. Perceived power *is* power, for every practical purpose of design.
- **It is where fairness lives.** Telegraphing (Phase 1) and readable reaction (Phase 5) are the difference between a death that feels earned and one that feels cheap, at identical damage values.
- **It is the highest-leverage layer.** These are presentation changes: they multiply the perceived value of every existing attack, enemy, and sound asset without new content, and they do it on the verb the player repeats most.
- **It protects the game's lifespan.** Habituation-resistant design (variation, layering) is what keeps hour fifty feeling as alive as hour one.

## The audit: the basis made usable

Score any attack 0 or 1 per row. The total is a *floor*, not a target to maximize uniformly — by L2, a boss's signature attack should outscore a trash enemy's poke.

| # | Question | Phase |
|---|---|---|
| 1 | Can the player see it coming, in proportion to its power? | Anticipation |
| 2 | Is the release marked on the exact frame it fires? | Release |
| 3 | Can the eye track the projectile across the whole flight? | Travel |
| 4 | Is there an unmistakable event at the contact point? | Impact |
| 5 | Does the target visibly answer — flash, flinch, displacement? | Reaction |
| 6 | Does the attacker (and camera) feel their own attack? | Reaction |
| 7 | Does the world keep evidence after the instant passes? | Aftermath |
| 8 | Is the receipt — numbers, kill treatment — scaled to significance? | Confirmation |
| 9 | Is the sound layered (transient, travel, impact, debris) and varied per use? | Sound |

## Sources and grounding

- Egor Vasilev (@vasilev.yegor), Instagram reels: "How to make shots juicy" (Oct 15, 2026) — gunfire in 7 steps; "How to make a spell juicy" (Oct 14, 2026) — a magic attack in 8 steps. The phase model above is a unification of the two step lists; the reels' own step-to-phase mapping is shown in each phase heading.
- Steve Swink, *Game Feel: A Game Designer's Guide to Virtual Sensation* (2008) — the foundational treatment of feel as a design discipline.
- Martin Jonsson & Petri Purho, "Juice It or Lose It" (2012) — the canonical demonstration that layered feedback transforms the same mechanics.
- Jan Willem Nijman (Vlambeer), "The Art of Screenshake" (2013) — a practitioner's catalogue of impact techniques, including hitstop and the primacy of reaction.
- Albert Michotte, *The Perception of Causality* (1946; English ed. 1963) — the experimental basis for perceived causation.
- Frank Thomas & Ollie Johnston, *The Illusion of Life* (1981) — the twelve principles of animation, including anticipation, squash and stretch, and follow-through, from which several phases descend.
