# The Great White One: Act 3

Replaces the Pothos on the existing bed arena. The requested moveset is retained in
[the supplied attack reference](shark-attack-reference.md). This is a plush shark
diving through a quilt, with fabric dust and stuffing rather than a literal beach.
The source model is a visual reference; all geometry and textures here are procedural.

## Model and animation

`src/shark-model.js` builds shared, warmed geometry and materials. Seven independently
posed meshes cover the trunk, upper head, connected lower jaw, eyes, two fin arms,
and articulated tail stock with its caudal/pelvic fins. Twelve deforming joints (five
spine, two per fin arm, three tail) blend smooth skin weights. Each clone owns its
skeleton; geometry and materials remain shared. Neck, fins and tail attach to the
spine so their roots follow the bend instead of separating from it. The padded chin is a rounded
lens with an inset mouth floor, rather than a detached white ball or a pink plate.
The upper mouth is continuous with the skull. Both rows of felt teeth follow the
snout curve. Head/eyes track before the whole body turns; breathing, planted fin
steps, crouching, jaw snaps, tail coils, leaps and death have separate poses.
Turns lean through the body, the tail follows with a delayed wave, fin elbows curl
through alternating steps, and walking eases in/out. Attacks coil, stretch and tuck
the fins; landings compress and settle. Blinks, anticipatory squints and hit winces
add expression. Secondary body tilt/roll is damped while jaw contact stays exact.
The model is 34,760 triangles in seven meshes; skinning adds no model draw calls.

Only a fin proxy and a capped dust wake remain above the quilt while burrowed.
The body cannot be targeted while hidden, including the eruption warning interval.

## Moves

| Move | Animation and counterplay |
|---|---|
| Lunging bite | Head backs up, jaws gape, body crouches/lunges; the hit lands with closure. Step aside or jump the finite-height warning. |
| Leap | Locked landing circle, full arcing flight, impact squash/burst and recovery. |
| Combo | Three separate tells and contact frames: bite, fin-arm slash, rotating tail passage. |
| Tail spin | Coil then 360° pivot; collision follows the moving tail arc. Its low sweep can be jumped. |
| Rear attack | Head and body turn visibly before a frontal bite; no backwards hit. |
| Dive | Fin tracks, locks its eruption spot, shows a new warning, erupts and reburrows, exactly four times. |
| Burrowed bite | A shorter, lower breach with a jaw snap and its own tell. |
| Maelstrom | A churning slowing pool, tracking fin and warned leap out toward the jelly. |
| Tornado dive | Unlocks at 85% Health; a long tell, high breach, three spiral funnels carrying fish, arcing fish projectiles and a warned heavy landing. Longest recovery. |
| Piranha pools | Hot rim plus honest finite-height volume, animated fish and a formation splash. Can be jumped. |

Confirmed melee damage applies Prey and a short bleed. Prey makes fin tracking
faster and tighter. A confirmed bite triggers Feeding Frenzy: 25% faster timing and
movement, 15% stronger direct hits, hot glow and wider/faster poses. Blocked or
dodged hits do not grant these states. A stun interrupts the attack, stops movement
and ends frenzy. Old pools/projectiles may continue during a stun.

## Adaptation and limits

- Health retains Act 3's existing 1500 × 1.6 = 2400 scaling.
- Attack damage and timings are Jelly Fight tuning values, not claims about PoE2 frame data.
- Pools expire after 20 seconds, cap at six, and replace the oldest. Quicksand lasts five seconds.
  This deliberately preserves safe space on a small bed instead of indefinitely filling it.
- At most three tornadoes, twelve airborne fish and 72 instanced fish silhouettes.
- No additional game lights, fur shells or transparent layered fur. Shared assets retain warmed shaders.
- Dendi finishes the shark at zero Health; the usual evolution, Legendary reward and Act 4 transition remain.
- The optional balance bot was skipped at the owner's request. Balance and physical-phone frame times
  still require play feedback; browser story checks do not establish real-device performance.

## Attack Feel audit

The new attack entries in `src/stories/attack-audit.js` score 9/9 from code review:
paired warnings; exact release marks; visible moving bodies, tail or fish; localized
impact; confirmed player reaction; boss recoil/crouch; bounded residue or live pools;
Health/numbers scaled by significance; layered, pitch-varied existing voices.
No zero is intentionally accepted. The old Pothos entries are retired with its controller.
Normal-speed visual inspection and automated behavior checks complement this audit;
the code score does not claim that phone hardware or the full sound mix was auditioned.
