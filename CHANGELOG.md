# Changelog

Release notes for Jelly Run, newest first. For setup and gameplay, see the [README](README.md).

v704 builds carved dark-stone tide-pool arena walls around Act 3's bed that rise first, then fills deeper 3 cm interactive moonlit water outward from the center before the shark breaches, with real-time waves reacting to the jelly, the shark, its fin, slams, illusion, and tornadoes.

v703 shortens the jelly's no-hurt time after a hit from 1 s to 0.25 s, so bugs can land hits more often (Shield, Hand Mirror and Cryo Sleep times are unchanged).

v702 the ground mist's flow round the jelly now eases in and out over half a second when it sets off, stops or turns back, so quick back-and-forth swimming no longer flicks the mist about.

v701 - The ground mist is smoother and lower: its thin spots are now lighter mist that blends into the rest instead of open floor, it fades out by about 11 cm, a little above the jelly's height, and it is about a third lighter overall.

v700 Shadows take the room's light: a bug's shadow leans and stretches away from the lamp that lights it and is darker where the room is bright, fainter in a dark corner; the jelly's glow pushes nearby bugs' shadows away from it; in act 4 the dawn sun takes over on its side of the line, long crisp shadows pointing away from the window; the Encore's arena has one fixed key light. The darkest part always stays under the creature, and it is still one draw.

v699 upgrades simple box-and-blob 3D models across bosses, elites, pickups, treasure props, early hats, and apartment furniture (Vacuum, Kettle, Headphones, Controller, Soap Dispenser, Shark fin, Treasure Chest, XP crystals, Health hearts, Cicada burrows, Frozen crystals, Whirlwind blades, Magnifying Glass handle, Rubber Duck, Guitar Pick, Fly Swatter, Bath Bomb, Ice Cube, Fairy Lights, basic hats/adornments, Act 4 arena PAR cans, extended photo veneers, bathroom caddy bottles, and runtime set-dressing replacements for the PC tower, glass side table, trash can, cubby bench, nightstand, air purifier, bedside lamp, and floor mirror).

v698 the ground mist now parts round the jelly: a soft hole where it swims, a trail behind it that curls into little eddies and fills back in over about 2.5 seconds, the patches sliding round it as it goes; vents thin the mist over themselves (a ride blows it further out) and big hits punch a hole that refills. Reduce effects keeps the parting without the curls; Low graphics parts it without the curls.

v697 gives every shadow the shape of what casts it: each bug, Elite, boss and the jelly has a soft shadow drawn from its own model seen from above, turned the way it faces and as big as it really is (a dragonfly's wings, a spider's legs, the jelly's trailing tentacles); a millipede's shadow bends with its body, and a shadow goes softer the higher its caster flies, still one draw for all of them.

v696 lightens the ground mist by about a quarter in every act, and caps it lower at flat angles.

v695 adds a thick, uneven ground mist to the floors of acts 1 to 4, lit by the room's baked light, with a little of it on the jelly and the bugs. It thins as act 4's sun comes up.

v694 gives every bug, awake Elite and boss a soft shadow on the surface below it: bugs out to about what the camera shows, flyers and thrown bugs wider and fainter by their height, and the jelly's shadow never fades below a floor, so a jump still shows where it will land.

v693 offers "Try Easy mode" on the death screen after a second act 1 death, for players who have never cleared act 1.

v692 tunes five Treasures: Lego Brick hits harder (4, 4.5 and 5 damage), Marble hits harder (1.5, 1.65 and 1.8), Nail Clipper crits on 15% of hits, Cat Toy Mouse hits for 7, and Wind-Up Key is Epic.

v691 makes Fire's shot hit harder (hit 0.5 to 0.6), so Fire keeps up with the other types against the Vacuum and the Clog.

v690 Act 3's wasp nests send out at most six wasps at a time, down from nine, so the swarm is smaller and easier to clear.

v689 makes Clean play last longer in later acts: it now pays down to nothing at 100, 250, 300 and 350 Health taken in acts 1 to 4, so a hard-fought clear in act 2 to 4 still earns part of it.

v688 Chests are easier to grab: a golden chest now opens from about 8 cm away, instead of 4 cm, so a swim past or a rush through Warnings takes it. The Goodie Bag's second chest can no longer turn up inside a wall: it always lands on open floor beside the first, or on the same spot.

v687 gives Act 3's Great White One shark weightier, smoother attack timings (lengthening active/follow-through windows on bites, combo beats, spins, leaps, and breaches), adds non-linear strike/hold/recoil curves, and removes the hard rotation snap on recovery so attacks flow organically into swimming.

v686 keeps dying bug bodies and detached parts at full size until they hit the floor, adding floor-impact splatters and a longer grounded settle window before fading out.

v685 makes Elites and Bosses take a 0.1 second mini-stun from any stun or pin, and a Chill or slow of at most 10%, so Chilled bonuses (Brittle, Frostbite, Icicle Lance, Glacier Shell) now work on them; they still can't be Frozen, trapped or marked.

v684 Shield level-up card is 1 smaller at every rarity (+2 Common, +3 Rare, +4 Epic); Health is unchanged. Hot Water Bottle works below 65% Health, Little Trophy stops at +5 Attack damage a copy, and Piggy Bank stops at +30% Attack damage a copy.

v683 overhauls Act 3's Great White One shark boss animations and feeding-frenzy fish pools: adds a churning crimson-indigo ocean vortex shader with boiling froth and crisp coral danger rim, upgrades pool fish into stylized predatory bait-fish that breach and bank in 3D arcs (8 per pool), and gives the plush shark progressive S-wave spine/tail swimming, underdamped plush bounce springs, reactive hit flinch, sinuous stalking dorsal fin, and exaggerated anticipation/snap/recoil across all attacks.

v682 makes Act 2's Clog boss much more alive and fluid across every part: GPU vertex-shader hair flow, writhing, bristle, spin flare and churning core; 4 braided physics hair ropes via `stepChain` (cutting 28 draw calls) with per-attack choreography; underdamped spring jiggle, banking and wet hit flinch; bobbling springs on caught debris (plus a comb fragment and gold ring); staggered eye blinks, pupil tracking, windup squint/lock-beat pop, gnashing teeth and floating face lag; and gravity-stretching slime drips.

v681 upgrades bug death animations across all 17 bugs with multi-part flying/bouncing bug parts, 3-beat comedic motion, and cause-of-death treatments (lightning X-ray zap, stomp/brick pancake, wind wall-slam, tentacle whip launch, Pizza Cutter real-half slice, poison melt, fire charcoal hop, ice/glitter/wind part ejection) using pooled analytical floor physics and bounded phone caps with zero new draw calls or shaders.

v680 softens act 1 and gives every warning a fair look: the Mosquito's Bleed lasts 2 s, the Vacuum keeps 1 shielded fly out at a time and its charge takes 1.02 s, the House fly and Praying mantis warn for 0.5 s, the Wall Clock's wreath locks later (0.3 of its wind-up), the Coffer's accordion tracks you for 0.07 s and its tongue pulls slower. Hot Chili, Nail Clipper and Rolling Pin are now Rare.

v679 draws the stag beetle's released ball as a shaded energy ball: a hot orange swirl turning round its line of flight, a pale rim and a quick pulse, instead of a flat white disc (same size, hit sphere, timing and Damage).

v678 smooths the level-up curve: levels 1 to 7 cost what they did, then each level needs 30 XP more than the last (54, 84, 114…), so later acts keep giving level-ups.

v677 Exaggerated projectile recoil animations for all seven ranged bugs (Wood Ant, Giant House Spider, Ladybug, Dragonfly, Stag Beetle, Firefly, and Monarch Butterfly) with impulse kickback, recoil squash, front-leg wheelie/skid, and overlapping wing/appendage follow-through.

v676 adds a shared procedural insect geometry and micro-normal kit, LOD-gated 2-bone leg IK foot planting, and a hybrid CC0 GLB hero-bug import tool, upgrading all 16 bug models and animations while keeping draw calls and triangles lean on phones.

v675 adds a Skip button to the Legendary pick and the Attack upgrade pick: it takes nothing and the run carries on.

v674 rewrites every Treasure, Attack upgrade, evolution and jelly type description to one short pattern (trigger, effect, cost): about 20% fewer words, no number or effect changed; the Health regen card reads "every 5 s", and two out-of-date death-screen tips about Elements are gone.

v673 adds four balance facts to each act's private run log: what every Treasure and Attack upgrade pick offered, each level-up's cards, the damage dealt by source, and the jelly's stats as the Boss fight begins. Nothing changes in play.

v672 keeps the Encore's attacks steady: a phone's speaker latency moving no longer throws its whole set away (attacks vanishing mid-Warning and starting late), and a track that finishes loading mid-fight picks up at the fight's beat instead of restarting the set.

v671 takes the loading screen out of the page once it has faded, so its looping animations stop redrawing over the game, and keeps the game's canvas out of the story runner's page picture, which had been crashing the act 1 test shard.

v670 Applies Chan's layout edits: Act 1 (and Act 4, which follows it) loses the wooden bowl, cutting board, glass dish, dish cloth and glass cup and hides the red hardcover; the striped snake plant and pothos are placed, the pilea, knife strip and ultrawide monitor nudged. Act 2 loses the toilet spray and bath mat, gets a striped snake plant and pothos, and the duck rug, round rug and step stool move. Shadows and light re-baked.

v669 makes the candles in Act 1, Act 2 and Act 4 open tumblers with white wax inside, a wick and a small flickering flame, so the smoke curling off them makes sense.

v668 removes the leftover plant pieces that floated in the air above Act 1's and Act 4's sofa and by the lounge chair (leaves, a berry cluster and a bead string that were part of the room's walls-and-floor mesh).

v667 moves Act 4's five floor vents (the TV, sofa, desk, lounge chair and stove) to the spots set in the layout editor, so each lands the jelly where the layout puts it.

v666 gives the corduroy sofa, the kitchen, desk and sideboard wood, the bathroom's tiles and the kitchen counter and backsplash real photo textures in place of the drawn ones.

v665 tells a player on the run-complete screen when a dev run's score isn't going on the leaderboard, instead of just hiding Submit score.

v664 the dragonfly's whirlwind is bigger, comes sooner and hits for 3, and the monarch butterfly's prism ball flies higher and longer, lands 6 beats later, and its bolts are slower and last 2.5 s.

v663 gives every room's floor a scanned laminate in place of the drawn planks, and adds a fine grain up close on Medium and High: wood pores, a weave on bedding and upholstery, a paint stipple on walls (it replaces the old close-up bumps, which only showed in the jelly's glow). The soundtrack also skips what it missed after a page sat idle, instead of playing it all at once.

v662 the Range level-up card now reads just "Range" (it still stretches Tentacle reach).

v661 removes the wristband rings, the cord and the console cables from Act 4's floor.

v660 adds a soft pink glow on the wall behind Act 1's media console, like an LED strip washing the wall above it.

v659 makes the Controller's arrow drop plainer: no circle or dome under you, and the arrow hovers smaller and farther out, then flies the way it points to hit where you were.

v658 adds the powered apartment: little status lights glint on what is plugged in (the PC tower and the game console; act 3's air purifier) and thin grey smoke drifts off what burns or steams (the incense and candle, act 2's candle, oil burner and tub, act 3's humidifier plume). Act 4, the same room, has act 1's. Reduce effects keeps the lights on without blinking and slows the smoke, and Low draws no smoke.

v657 gives the Dragonfly a new attack and takes its beam away: it spins up a two-blade rotor two jelly radii across and flings it at you three times in a row, 0.3 s apart along the same line, with no pull on you.

v656 gives the Controller a third attack, the arrow drop: a big pad arrow hovers by you for a second while a circle and dome fill where you stand, then flies in for 3 Health. It comes down from above or in from your left or right, and only comes up from below when you're already in the air.

v655 The Pogo Stick now works on bosses: a jump onto the Vacuum, the Clog, the Shark or the Encore stomps for 4x Attack damage and bounces you back up. Bosses are still never Stunned and give no moment of safety.

v654 adds light that moves on its own: the wall TV in act 1 shows slow drifting colours and throws a soft pool of them on the rug (a smaller one by the monitor, and act 4 keeps its monitor pool while the concert owns the TV), act 3's night light drifts between pink and amber on the floor, and the city outside has lit windows that switch off and on and red beacons that blink. Reduce effects holds all of it still.

v653 fills the gap under the front door with floor, so a low camera in the hall's corner no longer sees the night outside through it.

v652 makes the curtains and shades hang and move: the shower curtain, the sheer curtains and the roller shades ripple slowly from the rail down to the hem, and billow away when the jelly brushes past or something big lands near them. It's all in the shaders, so no extra draws, and Reduce effects holds them still.

v651 brings rain to act 1: drops sit on the living room windows, a few run down the glass, the city behind goes soft and hazy, and the room tone adds rain on the glass with far thunder now and then. Act 4 is the same room at dawn and stays dry.

v650 replaces act 4's Moth with a Monarch butterfly: a painted monarch that flies in quick beats and glides, and lobs a spinning ball of hot rainbow light that fires bolts every way, up, down and all round, on every beat (2 each) and bursts where it lands (3).

v649 adds the cicada burrow's sound: a song that swells along the trail with a thump on each beat, a hush where it cuts out, an inhale that climbs into the burst, a heavy layered burst (sub thud, crack, shriek, chunks), a smack when it hits you, the whoosh and wet thump of the throw, and the chunks clattering as it lands.

v648 puts Dendi to sleep in his cardboard box by the cat scratcher in acts 1 and 4: slow breaths, an ear twitch and a tail flick now and then. He still gets up to finish the Vacuum, then goes back to sleep.

v647 animates the Cicada's burrow beat by beat: it rears up before it digs, the mound humps on every beat leaving cracks, then sinks flat while a mud chimney rises and the floor swells under the Warning; it rockets out stretched, throwing floor chunks, and a hit squashes the jelly in the freeze and sends it somersaulting away with the camera a touch behind; it lands heavy (or on its back after a miss) beside a crater and its shed shell.

v646 adds an experiment switch for heat shimmer over the vents (index.html?shimmer=1, Medium and High only): the picture just above each vent bends a little, and stays still behind furniture that stands in front. Off unless the switch is in the link.

v645 adds a line to each Treasure pick card for a treasure that changes a stat, such as "Dodge 26% → 35%", what it is now and after you take it; and the Odd Sock's Dodge now follows the same rules as the Dodge cards, each copy closing a share of the gap to the 60% cap, so five Socks give 46%, not the cap at once.

v644 makes the Cicada's burrow throw the jelly about a metre across the floor: the burst's shove is three times harder, the jelly tumbles for a beat with almost no grip so the stick can't cancel the throw, and the hit gets a short freeze. The attack now runs on the song (dig-in 1 beat, trail 5, Warning 2 beats, so the burst lands two bars after the dig-in) and the Cicada stays dazed for 4 beats. Harder: a hit sends you far and loses you control for a beat. Easier: twice the Warning and a longer window to hit it. Balance bot not run.

v643 remodels act 4's Cicada as a periodical cicada: a glossy black body with sculpted plates and an orange X on its back, big red-orange eyes, orange legs with thick digging forelegs, pale ribbed tymbals, and clear wings with painted orange veins and a black W, folded in a tent over its back. Looks only; it plays the same.

v642 gives act 4's Firefly a real flying look: raised dark wing covers edged in orange, smoky veined hind wings beating as a blur, an orange shield and thorax, beaded antennae and a body that hangs tail down and leans into its flight. Its lantern now swells and fades once every 4 beats of the song (about every 2 s) instead of blinking on every beat, and it flies lower and a little nearer, 10 to 25 cm above the jelly instead of 30 to 50.

v641 Act 2's camera now looks over the open bathroom door, tilting steeper instead of squeezing down to floor height behind it.

v640 makes the apartment's plants sway a few millimetres on their own and lean away when the jelly rushes past or a big hit lands near them, and glassware shiver under those hits; all of it is in the room's existing shader, so it adds no draw, light or shader, Reduce effects holds it still, and ?ambient=0 turns it off for phone measuring.

v639 stops a Cream Whipper balloon filling the screen when the camera is pushed in against a wall: it fades out as the lens comes near.

v638 lets each vent's air show in its room's own light: the wisps, dust and ribbons take the baked light where they rise, so they glow softly by a lamp and fade in a dark corner; act 3's moonlit bedroom gets fainter, cooler air and act 4's dawn a slightly warmer one.

v637 lets the Range level-up card stretch a Tentacle jelly's reach too, and Tentacle jellies are now offered it.

v636 makes a vent answer a ride: its air gusts and its ribbons snap straight as it catches the jelly, with a whoosh of sound and a light lift of the camera, and a soft hiss plays when you stand near one. In a Boss fight, when vents are off, the air now stops and the ribbons lie limp, and it starts again after.

v635 removes act 4's Soundbar bass wave, the low red wave that rolled across the living room every 16 bars: the room is easier, and the stage door's sub drop stays.

v634 adds a Free roam to the dev tools (Play group): pick an act and walk its room with no bugs, no Elites, no damage and the clock stopped, to look at the lighting, vents and ambient life.

v633 gives every floor vent a real grille (frame, angled louvres, a dark duct) and drops the column of light: the air now shows as soft wisps that rise from the louvres and fan out, dust motes carried up in the stream, and tell-tale ribbons that flutter on the grille, in all four acts.

v632 adds light you can see in the air: each lamp has a soft glow round its bulb, dust drifts in act 3's moonlight and in act 4's sun (not on Low graphics), and the jelly and the bugs pick up a little of the baked light where they stand, cool in the moonlight and warm in the sun.

v631 adds a quiet room tone under each act: a fridge hum and the city far below in the living room, tile-room air and a slow tub drip in the bathroom, a humidifier's hiss and an air purifier's fan in the bedroom, and birds arriving as the sun rises in act 4. A wall clock ticks, a wind chime rings and a far siren passes now and then, each heard from where it is in the room. It steps back when bugs close in, more under a Boss, and is silent in the Encore.

v630 tilts the camera steeper and keeps its lens in front of the kitchen counters when they would block the view of the jelly (they still never fade).

v629 gives each act its own mood: a cool moonlit haze and grade in act 3, a stronger moon through the bedroom curtains, brighter morning sun and sky in act 4's dawn, a stronger cool city glow at act 1's windows and a cooler bathroom light in act 2, all baked in Blender. Every bug now has a soft shadow under it, and the jelly's shadow is soft too.

v628 gives the big pieces of furniture (the kitchen, the sofa, cabinets, shelves, desks, posters, plants) their own baked light maps from Blender, so shelf shadows and lamp pools on them come out sharp instead of soft; smaller pieces keep the light grid. No extra draws.

v627 lights the furniture in every act with Blender's baked light too: each piece now sits in the same soft lamp light, shadow and bounce as the walls and floor around it, with the jelly's glow still live on top. Low graphics skips the lamp maths on furniture as well.

v626 lights the walls, floors and ceilings of every act with light baked in Blender: soft lamp shadows under the furniture, light bouncing off the room, a cool glow from the city through the living room's windows, moonlight through the bedroom window in act 3, cool bulbs in act 2's bathroom and closet, and in act 4 morning daylight that fades in with the dawn. The jelly's own glow still lights the floor live; Low graphics skips the lamp maths on baked surfaces.

v625 Singing Bowl ring wall is taller: 9 cm → 12 cm (the rim rings you jump or dodge).

v624 calms act 4's Headphones and the Mushroom Pillow's spores by about a third, still on the beat: the Headphones' shove waves and Stereo bursts come every 2 beats instead of every beat, with a little longer rest, and the Pillow breathes in for 3 beats before its spores and rests longer after; the Singing Bowl's ring walls stand 9 cm tall instead of 5.

v623 draws the jelly 15% bigger on phones, so it reads better on a small screen. Hit size, camera and effect sizes are unchanged.

v622 The dev test kit has a Stats tab: give any level-up card at Common, Rare or Epic (or take it away), add flat Attack damage and Fire rate, or reset your stats.

v621 tidies the Treasure juice looks after a review: the Magnifying Glass's steady burn no longer strobes its bug white, the Ice Cube's puddle reads as dark blue water, the Rubber Duck pops up yellow in front of the bell, the Guitar Pick and its notes are bigger and float clear of the damage numbers, and a Pizza Cutter's sliced halves take the bug's own colour. Fairy Lights' wire no longer allocates every frame.

v620 The Headphones' shove wave is narrower (0.2 m, was 0.4 m) and pushes less (0.3 m, was 0.4 m); the Singing Bowl's rings are lower (0.05 m tall, was 0.1 m) and thinner (0.04 m, was 0.06 m).

v619 makes three Legendary Treasures look the part (looks only): Snooze Button rings an alarm clock over the jelly as it saves you, slowing the world for a moment while the colour drains and comes back; Newton's Cradle throws a steel ball from bug to bug with each passed hit, the bug it lands on swinging back from it, a "×3" on a full chain, and the ball dropping and rolling away after; Bloody Fangs gives the jelly two fangs under its rim, a heartbeat once a second (a bell pulse and a small red ring) while Health seeps away, a dim red trail at full speed, and a Health bar whose rim beats with it.

v618 gives the Treasures that only change numbers a visible sign: Coffee Bean, Dustpan and Meatball tint your shots and wisp round the bell while their buff lasts, Dry Sock wisps and wind lines while you're airborne, Oven Mitt's full Shield burns brighter and puffs when chipped, Baby Bottle sends a green sip to the bell, Pizza Cutter slashes the bug it finishes, Rolling Pin and Can Opener flash and thud on their extra damage, and Thimble flecks silver when it soaks a hit. Looks only, no number changes.

v617 gives the Rubber Duck, Windowsill Cactus, Guitar Pick and Bath Salt Treasures bodies: a duck pops from under the bell and stars circle the Stunned bugs, Cactus needles fly to their bugs and stick, the Guitar Pick flicks across the bell and sends notes up, and chained Bath Salt bursts grow with the chain. Only how they look changes.

v616 gives Fairy Lights a sagging wire, trails and twinkling bulbs, the Magnifying Glass a lens that tilts at its target with a narrowing beam and scorch marks, and the Disco Ball sweeping light dots, pastel colours on the beat and a dip as it picks.

v615 gives the Treasure floor glows one living shader: Glow Stick's glow drifts and quickens as it charges, flashes when it stings and fizzes sparks off its rim at full charge, with the glow stick itself circling the bell; Night-Lights breathe, flicker on and send up motes; Ice Cube puddles shine wet with a frosty rim, ripple where a bug skids and the cube cracks apart as it melts; the Disco spot and Bath Bomb reach glitter and fizz. Glow Stick and Fairy Lights stings no longer flash whole crowds white: a short glow in the sting's colour instead.

v614 turns the XP spheres into small spinning gold crystals, so they read as experience.

v613 lets a run that took its opening Attack upgrade plus one after each of the first three bosses post its score; the score check allowed only three, so those runs showed "this run couldn't be checked".

v612 brings the jelly type pick screen's eight cards together as a set: the Tentacle card gains big curling tentacles in the dusk behind, drifting venom motes and a near tentacle in front; Glitter's floor of flakes no longer reads as a dot grid and the jelly keeps its own colour; the stand-in roaches on the centre card read brown instead of near white; Fire's stage water glows warm; Ice's colour is bluer so it reads apart from Normal; a pale jelly is warmed by Fire's light too; the stage's puffs fade at their edges (gas, not balls); each fireball boils on its own; a second Glitter crit burst no longer cuts the first short; Normal's first hit no longer builds a shader mid-fight; and the Fire and Lightning cards skip work where nothing can show.

v611 gives the Glitter jelly's attack on the pick screen a fuller burst, a longer glint trail and a pink-violet backdrop; in play nothing changes.

v610 paints Glitter's card on the jelly type pick screen in a shader: out-of-focus lights far behind, tumbling glitter flakes that flash white as they turn face on, winking stars, a pink and rainbow light on the jelly and glitter along its edge.

v609 makes the XP spheres twice as big, so they're easier to spot and chase.

v608 adds a Past seasons page to the leaderboard: once the owner ends a season, its Champions and top 3 stay readable there, and the board's Back and Change name buttons now stay in view on a phone held sideways (the Champions portraits are a little smaller there).

v607 makes act 4 run much lighter on phones: the sun's direction is read from look.css as numbers (a stray piece of text had put the whole act's 3D maths on a slow path), and on Low the act 3 Alligator no longer builds a shader when its fight starts.

v606 The overdraw budget story no longer counts the apartment's own glass, prints and camera-faded furniture, so it measures what a fight adds instead of where the view sits. Measured with the room left out (heaviest of four views, after the other engine stories ran): Controller crowd 1.65, bubble storm 0.40, Vacuum fight 0.63 (its force fields and traversal markers left by earlier stories); ceilings sit about 10% above. The arena keeps its old ceilings, since there the whole room is the arena and nothing is left out.

v605 adds an Overdraw view to the dev tools (Check group) and a count of how many layers each pixel is drawn over to the phone measuring tool, and stops drawing the Encore stage edge's shock flash and the stage door's glow while they have nothing to show, which takes about half of the see-through layers off the Encore's arena on a phone.

v604 lets the furniture's batches check what's in view only when the camera has moved 5 cm or turned 4 degrees, in a view padded by both so nothing in sight is left out, instead of every frame; solid furniture stops being sorted too, so a still camera sends phones none of the 66 draw lists a frame it used to.

v603 adds a `?msaa=2|4` test link that smooths edges in the graphics chip on Medium and draws a phone at pixel ratio 1.25 instead of 1.5, so the phone bench can compare the two; nothing changes without the link.

v602 makes bug crowds cheaper on phones: a far or off-screen bug that's only walking moves on alternate frames with both frames' time (same distance, walls still hold), a frame works out each moving piece's place once instead of twice, hidden pooled effects wait until they show, and the collision world re-checks furniture only after it moves.

v601 gives the Tentacle jelly's sting a violet ribbon trail that fades from its root, a flash at the tip as it snaps and a few venom drops thrown off the stung bug, and its barbs a venom glow with a glint running down each tentacle.

v600 makes the Poison jelly's attack look thicker on the pick screen: its blob shows a dark core through a glossy, wobbling body with a wet highlight, the burst leaves a soft green cloud that thins from the middle and droplets that fall, Poisoned roaches fume, and the water turns murky green. In play the blob and burst read the same, a little greener, and the tentacle drops are glossy and stretch as they fall.

v599 adds a test link, `?rt=packed`, that draws the picture and glow buffers at 32 bits a pixel instead of 64 where the phone's graphics chip can, so the phone bench can measure whether it helps (nothing changes without the link).

v598 makes your plain bubble glassier (clearer, with a bright rim) and its pop clearer too: on the pick screen it bursts as a ring and a double splash of droplets; in play the soft puff is mostly clear water.

v597 makes Low graphics really low on phones: the apartment draws with plain diffuse materials (no shine), the three spotlights go dark with the room's fill light lifted for them, and clearcoat, iridescence and sheen are off. Low looks plainer and should run lighter; Medium and High are unchanged. `?lite=1` tries the same look on any tier.

v596 draws the Tentacle jelly's pick card in a shader: whip lashes with ribbon trails crack round the jelly in a violet dusk, snapping with a star flash, a ring and venom drops, lighting the jelly's edge as they land.

v595 lets the apartment's furniture hold still: three.js no longer recomputes its 1,100-odd pieces' positions every frame (doors, the layout editor and boss sets update the pieces they move), so phones spend less of each frame on bookkeeping.

v594 makes the game churn less memory on phones: floor checks under bugs and the jelly's feet, the lamp ranking and the batch walk reuse what they have instead of making new objects each frame, and the minimap repaints 15 times a second (at once when a mark appears or moves) at no more than 2 pixels per CSS pixel.

v593 makes the Fire Jelly's attack on the type pick screen's live card look like fire: the fireball boils and trails a flame tail, a burning roach wears real flames, and a hit smokes and leaves a scorch that cools. Play looks the same.

v592 redraws the Poison jelly's pick card: thick glossy bubbles of poison wobble up and flow together when they touch, goo lines the card's glass and swells into drips that fall, vapour curls up behind, and a sickly green light from below lights the jelly, replacing the outlined circles.

v591 draws glass, window shades, bug wings, the jelly's oral arms and the additive glow pieces once instead of twice, a little less work on a phone's processor each frame (no change to how they look, except sheer curtains, which keep two passes).

v590 softens Wind's air on the jelly type pick screen and in play: the gust's speed lines and the Wind jelly's circling streaks are now soft ribbons of air that fade at both ends instead of hard thin bars and arcs, and the pick screen shows more of them with a minty backdrop.

v589 gives Normal's side card on the pick screen glassy bubbles drawn in a shader: three depths rising through rippling light, each a lens that bends the jelly and water behind it, with a rainbow film on its rim and a window highlight.

v588 repaints the Fire Jelly's card on the type pick screen: one rolling fire with torn tips and loose licks instead of separate spikes, and its warm light now falls on the jelly's bell and tentacles.

v587 gives the leaderboard tabs: Champions (the best run with each jelly type, and how many you hold), All, and a board for each jelly type, with a Season chip, a second line saying Won or the act reached and acts untouched, and your own row pinned with its real place when you are outside the top 10. Submit score is now offered when a run makes its own jelly type's top 10, so a second type's run is no longer held back by your best run with another.

v586 makes the Lightning jelly's attack look sharper: its shot is ball lightning with arcs crawling over it, each chain bolt holds one jagged channel per flicker and forks, the arc between its tentacle tips tapers and forks, and on the pick screen stunned bugs twitch and the stage turns a dark storm violet.

v585 repaints Wind's card on the jelly type pick screen: soft ribbons of air circle the jelly (the near ones bend the bell and tentacles as they cross it), with dust and three small leaves riding the spiral and the tentacles streaming sideways in the breeze, instead of hard white arcs.

v584 adds experiment links for phone measuring (?lights=3|4|6 sets the lamp slots, ?rt, ?msaa and ?lite are ready for later tasks); the bench shows which are on. Nothing changes without them.

v583 gives the Ice jelly's attack more bite: in play and on the pick screen its frost flower on the floor is now a shaded crystal instead of a line drawing, its shards are solid ice, its tentacle tip crystals catch the light and its cold mist is softer; on the pick screen a Chilled roach glints with rime and breathes cold and the water behind turns a cold blue.

v582 keeps the leaderboard as a best run per player and jelly type each season, and the Worker now works out each run's score from its own run log instead of trusting the number it is sent (runs that claim more bugs cleared than came out, a boss beaten in under 10 seconds, or more than 3 Elites in an act are refused); the board screen itself is unchanged until the next update.

v581 redraws the Ice jelly's pick card: real frost grows across the card's glass from the corners and glints as the light moves, snow falls at three depths, cold mist sinks off the bell and the jelly takes a pale icy rim, replacing the drawn-on corner flakes.

v580 redraws the Lightning card on the jelly pick screen: real branching bolts strike the jelly in a dark storm, flash its bell and fade to an afterimage, with a crackling glow round its edge, far bolts in the clouds and arcs between its tentacle tips.

v579 raises the disco ball while it hangs for good in set 3, so it no longer hides the DJs' heads and their bow during the duet; its spots, beams' landing and strikes are unchanged.

v578 puts scores on a new scale: each act now pays for what you did in it (the night survived, damage to its boss and beating it, up to 3 Elites, the share of the night's bugs cleared, and for a cleared act Clean play and Boss pace), up to 15,500 an act and 62,000 a run. Kills, Levels and Treasures no longer add to the score, and damage your Shield soaks counts against Clean play.

v577 gives the Encore its own fight view, further back and flatter, so a DJ out on the floor is on screen head to feet (his solo, the bow that leaves the Encore EXPOSED, and the duet) on phones and desktops; the arena's invisible fence no longer fades the floor, records and flames when the camera stands behind it.

v576 slows the reward spin: reels now roll 40% slower and the whole spin (every reel's stop and the hold before the cards) lasts twice as long.

v575 paints the Fire card on the jelly pick screen in a shader instead of drawn-on shapes: flames eaten by moving noise lick up behind and in front of the tentacles, the jelly is lit warm from below, embers rise with short trails, smoke drifts behind and the heat bends the jelly above the fire (the other side cards follow one by one).

v574 keeps the reward spin's reels landing on time on a slow phone or under hit-stop, silences its ticking when the machine closes mid-roll, times the lever's clunk to the lever, and hides the touch controls behind the machine.

v573 makes the Encore's duet EXPOSED only once both DJs bow (not while they push the wall out), and keeps the crowd rise of a late vault to the air he has left.

v572 films the pick screen's live centre card on a lit stage: its own sharp picture with bloom (none on Low graphics), reflections in the bell, a rim light in the jelly type's colour, a light that flares with each shot and hit, a glossy floor with soft shadows, light shafts and drifting specks, and a closer, slowly drifting camera; the room behind the pick screen is no longer drawn while it's open.

v571 makes a new player's first reward spin say how to stop the reels; boss rewards and Attack upgrades open straight on their cards.

v570 gives the reward spin its sounds: a lever clunk, soft ticks that slow with each reel, and a thunk as every reel lands, higher for rarer cards.

v569 makes act 4's Headphones, Mushroom Pillow and Singing Bowl hit harder and faster (more waves, rings and bursts, shorter windups, bigger hits), and its Firefly, Moth and Cicada more dangerous (Firefly hovers higher and lobs sooner, Moth plunges quicker for 5, Cicada's mound races after you and warns for one beat); the Headphones' angry waves no longer drop when bursts come every beat.

v568 gives the Encore's DJs sounds for leaving the booth: a whoosh and crowd rise as they vault out, a thud on landing, the same home, a deeper floor slam for the gold DJ, and a shove under the duet's Wall of sound.

v567 adds a one-time hint the first time a DJ lands on the floor ("A DJ on the floor is the one to hit. The booth can't be hurt until he is back."), and notes in the glossary that Solo and Bow happen on the floor.

v566 opens every level-up and Treasure chest on a slot machine: a reel per card rolls past real rolls and lands on your offer, the Luck panel shows each rarity's odds without and with your Luck, a jelly lever pulls itself, and three of a kind rolls one reel again onto its upgraded card (marked Upgraded on the pick card too). Tap, click or Space lands the reels, then skips to the cards; Reduce effects shows the landed machine and fades.

v565 sends each played act's frame numbers (median and slowest-5% frame, share of slow frames, lowest pixel ratio, graphics tier, frame cap, screen size, load time, graphics resets) and the player's Settings picks with the run summaries already sent, and adds a Send button to the phone bench; frame times and screen size only, nothing typed, no location.

v564 keeps every regular bug's Health the same all act (no more 18% more each minute); act 4's Firefly now has 700 Health, Moth 1000 and Cicada 1200.

v563 adds a phone bench at index.html?bench (and ?bench&act=3, ?bench&act=4, ?bench&act=4&scene=2): after one tap it plays the act's busiest moments in real frames, then the busiest again with bloom off, pixel ratio 1.0, lamps off, AO off and on Low, and shows this device's frame times, draw times, GPU time where the browser offers it and draw calls, with Copy results. A bench is not a run: it sends nothing and keeps nothing. tools/perf-phone.mjs now sets up the same moments from one shared table (src/bench-moments.js).

v562 sets the Elites' and bosses' final Health: Act 2 Elites 800 each, the Vacuum 1200, the Great White One 8000, Act 3 Elites 1800 each and Act 4 Elites 3200 each.

v561 three of a kind: when every level-up card or chest Treasure on offer shares a rarity, one of them goes up a rarity (three Commons make a Rare, three Rares an Epic, three Epic Treasures a Legendary; three Epic level-up cards stay Epic). Adds the reward spin's reels and odds behind the scenes, nothing on screen yet.

v560 moves the Encore's duet, the Wall of sound, onto the floor: both DJs vault out of the booth together and land side by side at the stage front, the one target between them (the booth can't be hit meanwhile). The silver DJ throws his three records from there while the gold DJ points at each landing spot, both push the wall out as it rolls, then bow on their marks and vault home. The duet is a bar longer (its Warning is still 2 bars), no record lands by the DJs, and a duet that is called off sends them home with no bow.

v559 the gold DJ now vaults out onto the floor for his solo, landing at the stage front inside his own flame lane, slams the floor as the first Warning shows, and raises an arm a beat before each set of flames to show which lanes burn next; he is the one to hit while he is out.

v558 sends the silver DJ out of the booth for his solo: he vaults onto the floor two beats before it, lands on his mark on its first beat, throws three records from there (was four) and bows there, then vaults home as his bow ends. While he is out he is the one to hit (the booth can't be hurt), he pushes the jelly aside and never hurts it, and his partner watches from the booth and pumps his fist when a record lands on you. The short-out, the last hit and a song rewind send him straight home; no DJ leaves while the force field is up. The gold DJ's solo and the duet still play from the booth.

v557 gives the Encore's DJs legs and a rig to leave the booth with (a vault there and back on the beat, landing, slam, conduct with either arm, push), ready for their solos on the floor; nothing changes in play yet.

v556 makes the Encore's floor waves half as frequent (one every other bar) and only lines (sweeps, arrows, gates and pincers, no rings), including the last song's doubled waves and the lighter waves during solos; its lasers keep their pace.

v555 lets the Encore's solos take turns across the whole fight instead of starting over at the silver DJ in each stage: set 2 opens on the gold DJ's Pyro and set 3 on the duet's Wall of sound, so a fight of a few minutes sees every solo (the duet still only below half Health).

v554 tidies the Encore after a whole-fight review: the wall's riser stops when its Warning is cut short, the breakdown's bow breathes out like a solo's, and a standing record's push can no longer feed on itself and freeze the game.

v553 gives the Encore's new moves their own sounds: a record scratched, thrown, stuck and shattered, the gold DJ's fader crank and flame jets, a riser and a crack for the Wall of sound, a breath out as a DJ bows and a cheer for a clean solo.

v552 gives the Encore's attacks a feel pass: a club laser flashes at its corner post as it fires, the disco ball's spots blaze magenta and the ball flares as they strike, every Encore hit leaves a fading scorch under the jelly, the stage edge's shock crackles, and with two Pyro sets warning at once the lanes firing next show brightest.

v551 adds the Encore's last song at a quarter of its Health: waves two at a time and the DJs solo back to back, then a duet, with a toast. The boss bar names the solo, the duet and the bow, the first bow and the first standing record before a wall get a one-time hint, and the shorts-out toast now shows.

v550 gives the gold DJ his own solo in the Encore: he cranks his fader, then six flame lanes across the floor go off a set a beat (odd lanes, then even), each lighting its Warning two beats ahead, burning 35 cm tall and 48 cm out from the stage and leaving a fading scorch mark; step into a lane that just fired, a jump won't clear them.

v549 adds the Encore's duet, the Wall of sound: below half Health, every third solo slot the silver DJ throws three records, then the whole floor lights up crimson except a white strip behind each record, and two bars later a wall of sound rolls from the stage to the back of the floor (6 Health, even mid-jump) while each record shatters as it shelters you; both DJs then bow, exposed. The speaker pulses are gone.

v548 gives the Encore's DJs solos: every 16 bars the silver DJ steps into a spotlight and throws four vinyl records at you (a jump doesn't clear one: step off its lane), each standing where it lands as a wall for 4 bars; then he bows, and for 2 bars (4 if he never hit you) the Encore is EXPOSED and takes 1.5x damage, as it is when both DJs bow through the song's breakdown.

v547 the Encore's DJs now call each wave: 4 beats ahead the DJ whose wave it is circles his arm (rings, arcs), swings it (sweeps), points down the floor (arrows, gates) or claps with his partner (closings, pincers), an arc's DJ turns to face its gap, a DJ whose wave hits you pumps his fist, and the nearer DJ flinches when you hit the booth.

v546 gives the Encore's two DJs a posable rig: torso, helmet and both arms move on their own, with ten moves timed to the beat (wave calls, record throw, fader crank, hands up, fist pump, flinch, bow) ready for the coming solos and attacks. Nothing in the fight changes yet; at rest they stand exactly as before.

v545 plays the Encore's fight from one set list whose stages follow its Health, not the clock: it warms up on floor waves alone behind its opening force field, adds lasers and speaker waves in set 1, brings its disco ball in only once it's down to 75%, and books a (still empty) solo slot every 16 bars for the DJs' coming solos.

v544 mixes sound 30 ms ahead instead of at the smallest buffer, so a busy moment on the audio thread no longer crackles and pops.

v543 stops the pop at the end of the Vacuum's suck: its breathing wobble (and the wobble in the Vacuum's brushes, the millipede's rev and the dragonfly's charge hum) now fades with the sound instead of playing on after it and being cut off, and a recorded hit that has to start part-way through fades in instead of clicking.

v542 keeps vent rides smooth on phones: while the air carries the jelly up, the camera turns nothing new see-through (a ride up through the bathroom vanity had started 30+ see-through copies at once).

v541 gives act 2's Elites recorded sounds layered over their synthesized ones: the Soap Dispenser's pump, foam, popping bubbles and breaking glass, the Wall Clock's sweep, strike, bell chime, wreath and breaking, and the Cream Whipper's balloon fill, squeal, burst, cream spray and splat, and breaking; beating one of them plays its own breaking sound, and the Cream Whipper's deep sound still slows the recordings.

v540 turns every sound effect down 20%, so effects sit a little lower than the music; the volume setting and music are unchanged.

v539 frees the mouse when the start-of-run Attack upgrade pick opens on desktop, so its cards can be clicked without pressing Escape.

v538 keeps a bug's body touching you from counting as its attack landing (no contact pose or hit recoil for a brush; a Millipede's roll and a Cockroach's jab still count), stops the eyes of a bug that has thrown something (Ant, House spider, Firefly, Ladybug, Stag beetle, Dragonfly whirlwind) drooping as if it missed, brings the Praying mantis, Stag beetle, Ant, House spider and Wasp home earlier in their recoil so the last fifth is the punish window closing, and opens the Mantis's lean and the Stag beetle's jaws a little wider in their build-up.

v537 draws the Praying mantis's swat on the frame it hits you: its forelegs are shut on the jelly as the hurt shows, instead of closing two or three frames later.

v536 evens out how the basic bugs' attacks move: the Praying mantis and Horsehair worm reach their wind-up pose sooner and hold it longer, mid-sized bugs stretch a little further at full reach than light ones, and a Cicada whose burst misses you lands tipped onto one side (one that hits stands dazed upright).

v535 makes the Giant millipede's body chain about seven times cheaper on a phone (no behind-the-scenes number allocation), so a crowd of bugs attacking no longer stutters.

v534 makes the Dragonfly show its attacks on its body (its beam: it draws back, its wings stop dead and its tail curls up over its back; its whirlwind: its wings beat faster and sweep forward as it leans back, then freeze when the aim locks), gives the Cockroach a head-low lean-in and a jab as its touch lands, and squeezes a Wasp nest just before each wasp crawls out. Only how they look: no hit moves.

v533 gives the House fly and the Wasp a build-up, a strike and a recovery: the House fly rubs its legs and draws its head back, then the rubbing stops dead and its straw shoots out; the Wasp rears with its sting curled under, then darts nose-down with its wings swept back. A hit and a miss now look different. When they hit, how hard and how far they reach are unchanged.

v532 the Ant, House spider, Firefly, Ladybug and Stag beetle throw with their whole bodies: each braces and coils, holds still for a beat before it lets go, then rocks back after the throw (the Stag beetle is shoved back and eases home without a bounce). Nothing about when or where their shots go has changed.

v531 finishes act 4 for release: Full Clearance now counts act 4's three Elites too (twelve in all), and the Glossary names the sun, bass wave, stage door and Easy mode.

v530 gives the Praying mantis, Horsehair worm and Giant millipede real attack animations: the mantis rears, holds its forelegs open quivering and snaps them shut crossed, and a missed swat leaves them stuck out a moment longer (your window to hit back); the worm rears into an S with its tip trembling, cracks down tip last with a ripple along the floor and lifts off base first; the millipede leans back and rocks as it revs, leans into its roll, then skids, topples and unrolls head last before swaying dizzily. Hit timing is unchanged.

v529 gives the Spotted lanternfly, Moth and Cicada a real build-up, swing and recoil (attack-motion "pounce"): the lanternfly crouches deep, flashes its red as its landing spot locks, dips once more and springs off stretched, then lands squashed, bounces and folds its wings late; the Moth rears with its wings flared until they clap shut over its back as its circle locks, tips nose-down over a moment instead of snapping there, and lands with its wings slapped flat before fanning them; the Cicada scoops and shimmies into the floor, bursts up stretched with its wings thrown open, sways dazed and shakes its head and snaps its wings shut just before it can move again. No timing, damage or Warning changes.

v528 tunes act 4: the Elites in the living room have less Health (800 x 1.8 instead of 800 x 2.8, so they take about as long to beat as act 3's, and the Mushroom Pillow's spores hit for 3 instead of 4), the Encore has twice the Health (36000, so a fight should take about 2 minutes for most players and 3 to 4 for the slower half, instead of about one: projected from the run log), and the room spawns bugs 43% faster with 43% more alive at once.

v527 gives the Mosquito's bite a real build-up, swing and recoil: it draws back and rears, holds quivering with its front legs reaching and eyes narrowing, dips its head as its aim locks, goes dead still, then darts stretched out nose first; a landed bite holds a moment, eyes shut, and bounces back squashed, while a miss carries on past and rolls. The shared attack clock behind it (src/attack-motion.js, attack-motion in content/enemies.kdl, --bug-attack-* in look.css) is what every other basic bug moves to next. No timing, damage or Warning changes.

v526 gives act 1's three Elites recorded sounds layered over their synthesized ones: the Controller's button clicks, hit thud, slam and charge-up, the Mug's slosh, splash and pour, the Kettle's whistle, steam blast, lid pop and drops, and each Elite's own breaking sound when it is beaten.

v525 adds the tests and tools for the coming bug attack animation work, with no change to how the game looks or plays: a story that keeps every basic bug attack's hit on the same frame and spot (`attacks/animation-never-moves-a-hit`), a check that a bug's `anim` allocates nothing and never reads the clock or `Math.random`, and tools that film each attack (`tools/bug-reel.mjs`) and time all the bugs' animation on a phone (`tools/bug-anim-bench.mjs`).

v524 gives the jelly's everyday sounds recordings: the bubble's blow, pop and hit, a crit, a bug dying (small and large), jump, land, hurt, and the jelly's Shield coming up, taking a hit and breaking; the Vacuum's Shield and sounds with no recording yet keep their synthesized sounds.

v523 gives pickups and menus recorded sounds: the coin chime for XP (climbing with the chain) and Treasure, the chest creak and pop, the level-up chime, a shimmer for card reveals and awards, a till for buying, and soft taps for menus; they load as soon as sound is on, and the old synthesized sounds stay behind them.

v522 moves lightning's recorded sounds into the first sound pack: they now download only for a Lightning Jelly run and never while muted, follow the Cream Whipper's deep sound, and a heavy chain strike has a synthesized sound when the recording can't load. `sounds.html` plays every recorded take next to its synthesized sound.

v521 tunes the jelly's new motion: its tentacles are drawn about twice as fast (every jelly's animation now costs less than before the motion work), a victory or death copy keeps its oral arms' bend, and the bell is never culled at a screen edge while it flares.

v520 the jelly's tentacle roots now hang from the bell's flexing rim (also while lashing) and ride it in and down on each stroke, so they pull in a little further and open a little wider than before; its fringe streams out behind the rim's lag, and the victory and death copies keep the bell's bend they were made with.

v519 makes act 4's sunlight smooth: the room's own shaders light it, so it follows the sofa's curves without stair-steps, warms each surface's own colour, and lights the sides facing the window (one draw fewer).

v518 gives Act 4's living room exactly Act 1's furniture layout, plants and things on the shelves and tables included; only the three Elites' own furniture and Act 4's vents differ, and from now on any layout change made in Act 1 shows up in Act 4 too.

v517 dresses act 4's living room as a show about to start: a low barrier of Festival wristbands strung behind where the sun stops and cables running from the media console, with the LED cove strip, the Corner LED, the Spotlight floor lamp and the TV flashing on the song's beat; when time is up the TV flares and the media console lights up for eight beats (two with Reduce effects, or skip it with a jump) before the stage door opens.

v516 starts every run after the first with a pick of 1 of 3 Attack upgrades from your jelly type's pool, before any bugs come (it doesn't use your level-up reroll).

v515 gives the jelly's oral arms a life of their own: each swings on a soft chain in the water the bell carries along, so the arms keep going the old way through a turn, swing on after a stop and flare out as the bell relaxes after each stroke (they no longer wobble on a clock).

v514 bends the jelly's bell like a real one: the crown stays nearly still while the lower bell squeezes in on each stroke and flares open as it relaxes, the bend running down so the rim moves a moment after the crown.

v513 Act 4 reads better: the Cicada's trailing mound is dim until it locks, the Soundbar's bass wave lets the floor show through, and the sun's lit side stands out more.

v512 gives the jelly weight when it swims: each stroke pushes twice (a small second push as the bell recoils), a still jelly pulses then rests a beat while it sinks a little, and the body tips back when you start, rocks forward and through upright when you stop, and banks into turns.

v511 makes the jelly's tentacles move like real ones: no more ripple on a clock; each stroke squeezes their roots in and the wave runs down to the tips, which hang softer, sink a little, trail behind and swing on after a stop, and curve instead of kinking.

v510 Act 4 no longer hitches on phones the first time the Encore's lasers or disco ball light up, or a moth leaves its black smoke: their graphics are now prepared while the act loads. A new guard story keeps act 4 inside the phone budget for draw calls, shaders and lights.

v509 bakes Chan's act 1 and act 2 layout edits: plants moved and added in the living room and the bathroom, a few small items removed, and the round plant stand hidden.

v508 adds the tests and tools for the coming jelly motion work, with no change to how the game looks or plays: a rest pose for every jelly (`restPose`), a story that keeps every look's rest pose exactly as it was, a story that caps the work one jelly does per frame, and `tools/motion-reel.mjs` for before/after reels.

v507 makes a dropped Lego Brick fall to whatever is under it (a jump, a ledge) instead of hanging in the air, and lets the act bosses step on a brick and take its hit and burst (Elites still don't).

v506 The ant's pushpin is easier to read: once an ant locks its aim, a dotted glow line shows where the pin will fly, and a thrown pin is drawn bigger with a brighter halo and trail. A missed pin glows where it sticks until it goes. Damage and hit size are unchanged.

v505 makes the Pocket Vacuum's mini tornado much stronger: it is 2.5 times wider and its pull is six times harder, so every bug round it is sucked hard into the middle, with air streaking in from the rim.

v504 adds Easy mode: switch it on in Settings and your next run deals twice the damage and takes half, earns half the Pearls and keeps no leaderboard score; an "Easy mode" badge shows under the clock while it's on.

v503 fixes the layout editor not letting you pick up or drag a small plant: the invisible click box of the TV (or other furniture) behind it was swallowing the tap, so a plant made smaller could no longer be moved.

v502 fixes the type pick's Play button going dead after turning onto a locked card while it squeezes.

v501 the dev layout editor is now compact and built on the UI kit: act chips and a ? help button on top, a slim bar (Add, Undo, Export, Done) below, and a selection bar only while something is selected (rotate, up/down, a prop's size, Stick, Duplicate, hide, delete, put back); Reset all moved into the Export sheet. Add opens a drawer of the prop library: tapping a plant places it on the surface in the middle of the view, and every tap on a surface after that stamps another until Esc, the Stamping chip or Done. Things you added stick to the top of whatever is under the pointer as you drag them (Stick switches it on for furniture); props resize 50-200% in 10% steps. The TV and soundbar can't be duplicated (the room draws them separately).

v500 swaps the dusk sky in the 33rd-floor window for a sunrise sky in Act 4's living room, a gradient with a low warm sun at 6:00 AM that brightens to a clear blue morning by 8:00 AM. Nothing new is downloaded.

v499 adds two snake plants to the layout editor's props, made from downloaded models: one in a white marble pot with pale variegated leaves, and a tall striped one in a ceramic pot with a saucer. Each is two draw calls and under 4,000 triangles, with its shading baked in.

v498 gives the title tiles a quick cascade, springs buttons back past full size when you let go, has sheets rise then sink faster, makes the jelly pick row settle on a card with a small overshoot, and squeezes Play for 80 ms before a run starts.

v497 moves the HUD only by transform and opacity, so it stops repainting every frame on phones: a hit squashes the Health bar and it settles, the low-Health glow breathes softly, a new Treasure pops into the row while one taken again bumps its count, and a level-up empties the XP bar quickly before refilling it.

v496 Motion M4: the loading and turn-sideways screens use the shared motion tokens for their loops, and the loading jelly only glows (no swim or wave) under Reduce effects.

v495 Layout edits now bake in with one command: `node tools/bake-layout.mjs <export code>` merges the export into the baked layout and re-bakes shadows for the acts it touched.

v494 keeps the camera inside the apartment: walls, floors, ceilings, window glass and doors no longer fade out when you back up against them, and the camera comes in along the same view instead of ending up outside the room, so the night, the skyline and the dark beyond the front door stay hidden. Backed against a wall it comes in at once (never closer than 16 cm), then eases back out about a tenth of a second after the wall clears.

v493 makes picks and end screens move smoothly on phones: a picked Treasure's icon now flies along a curve into its slot in the Treasure row (which pops as it lands), cards deal in one by one with the rarest last, the cards you didn't pick drop away fast, and the Legendary sheen, the won glow and the golden award's rays no longer repaint the screen every frame (the rays turn twice, then rest). On a death the jelly sags in under a second and the numbers wait for it before counting up.

v492 adds Duplicate (Ctrl+D or ⧉) to the dev layout editor: a copy of the selected furniture drops 10 cm aside, solid and drawn in the same batches as the original, and saves and exports as a `copy:` entry; the layout can also hold `prop:` entries for the coming prop library.

v491 keeps small props solid for the camera: a cup or teapot the camera's edge rays only brush past no longer fades out, and one that really sits between the jelly and the camera goes half see-through instead of vanishing (`src/camera.js`).

v490 moves the Mushroom Pillow, the Singing Bowl and the Bull's table out of their furniture: the Pillow sits 25 cm forward on the sofa, the Bowl 10 cm forward on its chair with a shorter-held striker, the Bull's rush stops short of the changing pad's raised ends and the baby wipes and a desk-edge trinket are gone, so no Elite attack passes through furniture.

v489 adds motion easing and stagger tokens, and two guard stories that fail when a screen animates a paint property or Reduce effects does more than fade.

v488 replaces the Headphones' aimed bass Shots (act 4, the kitchen counter) with Stereo: a line down the counter through the Headphones splits its ground into two halves, and the cups burst them in turn, a cup lighting up and marking its half in its own colour (indigo, spearmint) two beats before, so you cross to the other half on the beat; angry, a shove wave also crosses the line between bursts.

v487 adds a prop library for the dev layout editor: six plants (Aloe, Monstera, Pothos, Rubber plant, Snake plant, Spider plant), each whole with its pot, baked into one small file the game only downloads when a prop is asked for. Nothing in play changes yet.

v486 replaces the Cicada's cone of sound in Act 4 with a Burrow: on the bar it digs into the floor and can't be hit while under. A glowing mound trails after you for a bar of the song, then locks, and a circle and dome fill over the spot for two beats. On the beat it bursts up there, hurting and tossing you if you're still inside. Step off the circle. Afterwards it stands dazed for a moment: that's when to hit it.

v485 replaces the Mushroom Pillow's hop with the Fairy ring: eight spore caps sprout in a ring round where the jelly stands and burst as columns, so hold still in the middle (run and you cross one); angry, a second ring sprouts where the jelly would flee.

v484 puts the dev tools in one compact Dev panel: Play (Fight boss, 1 on 1, Act 4 preview), Tune (Test kit, Tuner), Build (Layout) and Check (Diagnostics, with AO, Bloom and Lamps as On/Off switches), and it remembers the last group you used.

v483 rearranges Act 1 props, including the pet corner and shelves, removes the smart speaker, and moves five floor vents.

v482 puts the sunset canyon wallpaper and centered Jelly Run title window from the desk photo on the apartment's curved monitor.

v481 stops building what stands inside the hall closets (washer and dryer, coats, shoes, supplies), which nobody can enter or see into: act 2 downloads 205 KB less and draws about two dozen fewer objects; the doors are unchanged.

v480 sets five Elites down clear of their furniture: the Mug and the Alligator no longer float over their desk and bed, the Kettle no longer sinks into the counter, and the Soap Dispenser and the Coffer step out of the backsplash and riser behind them; a new guard checks every Elite's body, landing spots and attacks against the room.

v479 fixes the last UI problems from the final look: on a phone with Large text the death screen's hint, chips and numbers fit above the buttons again (the time/Level/bugs chips sit under the numbers on a death), "The Vacuum was 4:20 away" stays on one line, the HUD's clock-and-boss line under the timer is bigger and brighter, the next jelly on the phone's pick screen shows its whole name, and a row of looks cut at the fold in Change your look fades out instead of looking broken.

v478 calms Elite Warnings: every floor Warning and its hex volume glow a little less (look.css `--warning-floor-glow` 1.45, was a 1.7 in code; `--warning-volume-glow` 1.1, was 1.5); the Coffer's 10 to 14 jewel Warnings each show quieter, the Mushroom Pillow's spore columns stay dim until their last beat (then flash full as before), and the Headphones' white shove lane is fainter (it shoves, never hurts).

v477 Act 4's Elites (the Singing Bowl, the Mushroom Pillow and the Headphones) attack faster: their hits land on the next half bar instead of the next whole bar, their wind-ups are a beat shorter, and they rest 0.6 s between attacks (0.4 s when angry). A minute of fighting now has about 38% more attacks (bowl 11 to 13, pillow 17 to 26, headphones 9 to 12). It is harder.

v476 refines the apartment's wood, fabric, tile, stone and paint finishes in the existing texture slots and fixes the grain normal map, with the same furniture meshes and walking surfaces.

v475 recreates the apartment's 33rd-floor Greenpoint window views with a painted city backdrop, nearby tower silhouettes, and city lights that fade toward dawn.

v474 swaps the last emoji in toasts, screen titles, hints and the leaderboard for the UI's own icons (gold, silver and bronze ranks, a trophy beside a winning score), and the minimap no longer measures itself every frame.

v473 hides the plants that were baked into the living room's walls-and-floor piece (the spiky air plants over the sofa and by the window, hanging plants, the leaves by the lounge chair), which could not be clicked or deleted in the layout editor.

v472 tidies the UI overhaul after review: tapping on a phone no longer leaves the Continue/Play button, a pick card or the feedback bubble lit, tiles that only show a number (the win and end screens) no longer press in when tapped, an unlock's "· win a run" stays on one line, the 12 px and 44 px guards now hold every screen with no exceptions, and on a tall window the jelly pick cards are as tall as what they hold instead of stretching with an empty middle.

v471 adds the Badminton Racket, a Legendary Treasure: your attacks (bubbles, Element shots, gusts, Glitter and Poison bursts, tentacle lashes) swat bug Shots (pushpins, web balls) out of the air, and a swatted Shot flies back at the bug that fired it for 3x your Attack damage; and fixes a pin that was stuck when the bugs cleared coming back stuck the next time it was thrown.

v470 takes the last plants out of the living room (the Monstera and the Tall snake plant) and bakes in the Headphones' new spot in act 1.

v469 gives the end screens the kit look: an act complete stamps a gold seal beside its heading and shows the Treasures you took as tiles over the score parts counting up; the death screen is a dark panel that reads over the sand and fits a phone with every button on screen; the win shows the jelly up close beside a panel with the run's numbers and a trophy icon. Evolution reveals already used the kit.

v468 restyles the Treasure book, Achievements, leaderboard and Change your look on the new look: the book's sections are tabs with its close always in view, unfound tiles show where to find them, Achievements keep their rules behind an info icon, and Change your look uses kit chips and buttons.

v467 improves the jelly pick screen: the centre card fills the screen's height with a bigger attack preview, taller stat bars, arrows and dots for swiping, and locked cards say how to unlock them.

v466 rearranges the living room (acts 1 and 4) to Chan's new layout: the sofa, coffee table and lounge chair move toward the window, the plants that lost their pots and stands are gone, the vents and chest spots follow, and act 4's Singing Bowl and Mushroom Pillow Elites move with their furniture. The apartment is now on the 33rd floor: the windows look out over a city about 100 m down instead of a dark nothing.

v465 puts every pick on one card: level-up, Treasure, Attack upgrade and evolution picks now share the same look, with the rarity written on the card, numbers in the text highlighted, and New! and count together in the corner. The end screens, leaderboard, Treasure book and Achievements use the new panels and icon buttons.

v464 rebuilds the HUD and touch controls on the new UI kit: kit Health, XP, Shield, Elite and boss bars, a level ring, 12 px or larger HUD text with a dark outline (the night's time, the Health number, Treasure counts), a clean glass minimap of room outlines marking only chests, Elites, the boss and the way out (no more bug dots or furniture blobs), a mint glass jump button with an icon instead of the pink one, brighter thumb rings, outlined damage numbers and the kit's toast.

v463 gives the title, the pause menu and the loading screens the new night-aquarium look. The title is slimmer: How to play, a big Play, and three tiles (Treasure book, Trophies, Change your look), with a gear in the corner that opens Settings (Sound, Music, Graphics, Frame rate on phones, a new Normal or Large Text size, and Install app). The pause menu is now its own screen: Resume, Settings, Main menu (it asks twice before leaving the run), and a summary of Health, Level, the time to the Boss and the Treasures you carry.

v462 UI kit follow-up: buttons, tiles and cards light up on hover only with a mouse, so a tapped one on a phone no longer stays lit; the 12 px and 44 px guards now measure each screen after it has faded in, and list the small text and short buttons that were hiding behind the fade.

v461 adds the UI design kit the coming menu and HUD redesign is built from: night-aquarium colours, the Fredoka and Inter fonts, line icons and shared buttons, cards, bars and sheets. Nothing on screen changes yet.

v460 fits the title screen on a short landscape phone, gives Achievements a scroll area above a solid footer, hides the thumb ring in Change your look, adds a close button and a slimmer header to the Treasure book, and hides the Dev button and fps readout from players (five taps on the version bring up Dev).

v459 adds the Lucky Cat, a Legendary Treasure: every "1 in N" chance of yours (crits, traps, ghosts, life steal, Pocket Vacuum, gilding…) is rolled twice and the better roll counts, with a paw and a soft bell when the second try hit; Dodge and Rarity are not rolled twice, and it is only offered once you own an effect that rolls a chance.

v458 replaces the Singing Bowl's Chime with the Hum: its song swells while the whole chair seat fills with a Warning except a white circle round the bowl, then goes off on the bar, so swimming in close is the answer; its rim rings now roll out, hold dim for two beats, and roll back in to the bowl as an echo you jump again.

v457 adds the Pogo Stick, a Legendary Treasure: land on a bug to stomp it for 4x Attack damage and spring back up; each stomp in a row before you touch the floor hits 1x harder, up to 8x.

v456 replaces the Cream Whipper's cream spray with Piping: its nozzle follows you while your wake glows violet, then a stream of cream lays a 4 cm star-ridged bead along the path you swam, 0.8 s behind you, for 3.5 s (5 s angry); the bead stays 4 s (6 s angry), then sags and fades. Touch it or stand still and it's 3 and a slow: keep moving, don't double back, jump across your line.

v455 adds Newton's Cradle, a Legendary Treasure: when a hit finishes off a bug, the damage left over passes to the nearest bug within 12 cm, up to 3 times.

v454 gives the Moth a new attack in act 4: it climbs about 30 cm over you while a circle and a column fill under it, then drops straight down into it (a jump doesn't clear it) and leaves a puff of black smoke for about a second that hides bugs, XP and pools behind it. Step off the circle to dodge.

v453 makes Act 4's firefly a real flier: it drifts and bobs 12 to 20 cm up, hanging still now and then, and on the bar (every 8 s or so) turns its tail to you and lobs a glowing blob in a slow high arc; a circle and dome fill where it lands, it splashes there (2) and leaves a glowing pool for 10 s that drains 1 Health a second while you stand in it (jump it). Pools from several fireflies add up, at most 12 at once. Its bite is gone.

v452 spreads act 4's three Elites across the living room so no two are ever awake together: the Mushroom Pillow moves to the desk end of the sofa and the Headphones to the kitchen counter by the stove (the Singing Bowl stays on the lounge chair).

v451 moves the Cream Whipper Elite about 30 cm out of the hall's corner by the front door, so there is room to swim round it.

v450 adds the Goodie Bag, a Legendary Treasure: every second Elite you beat leaves two Treasures instead of one.

v449 wakes the Headphones on Act 4's glass coffee table, the act's third Elite: the pair on the stand comes alive, up on its ear cups like two speakers, and teaches the Encore's speaker rule. Its cups take turns sending white sound waves down a lane through you to the table's edge, one a bar: they don't hurt, they shove you 20 cm along. Jump one to stay put, step out of its lane, or ride it if there's room behind you; ride it off the edge and the vent by the table brings you back up. Between waves the cups fire bass Shots at you, a beat apart, each with a line and a tube showing where it flies: step sideways. Under 65% Health each wave comes with a bass Shot at jump height from the other cup, so jumping the wave flies you into the Shot: stay down and ride the shove.

v448 wakes the Mushroom Pillow on Act 4's sofa, the act's second Elite: the plush toadstool on the seat comes alive and teaches the Encore's disco rule. Its cap breathes in, then puffs spores that drift over the seat (one onto where you are) and settle as marked spots with a column over each; they flash for a beat and burst on the bar as columns taller than a jump, so step off the spot, a jump won't clear it. It also crouches and hops a short way toward you, landing on the beat as a Blast round itself: step back out of its circle. Under 65% Health it puffs more spores and they settle faster.

v447 adds the Firefly to act 4 from 0:00 (in place of the dragonfly stand-in, so the living room now has only Fireflies, Moths and Cicadas): a small beetle that drifts round you with a lantern for a tail. The lantern blinks on every beat of the song, and on the fourth blink it tips up, lit, and darts at you for 2 Health. New word: on-beat.

v446 the Encore only ever plays its own recording: if the recording is slow to load, the fight plays without music until it's ready, rather than switching to a different built-in song; a stuck decode of the recording is tried again once.

v445 wakes the Singing Bowl on Act 4's lounge chair, the act's first Elite: a bronze bowl on its golden cushion that keeps the song's time. On the bar its striker hits the rim and a thin, low ring rolls out across the seat (a disc and a low wall fill round the bowl as its Warning): jump it. Its chime sings a ball of sound over the bowl, then fires a Shot a beat at you: keep moving sideways. Under 65% Health it strikes two rings a bar, the second faster.

v444 keeps the Encore's music and attacks going on phones: its song now downloads while the arena loads and, if decoding it stalls for 8 seconds, the synthesized Encore song plays instead of silence (a stuck decode also left the Encore waiting for a beat that never came).

v443 tones the Cicada's cone Warning way down: it's much fainter with less glow, so it no longer drowns the fight.

v442 reworks the Moth's attack: with the lamps too high to use, it now flutters round you in wide loops and swoops in passes (3 Health a sting), living through each one. Drops the lamp word.

v441 adds the Moth to act 4 from 0:45 (in place of the praying mantis stand-in): pale and dusty-winged, it flutters round the nearest lit lamp and, when you stand under or near that lamp, rears up with its wings flared and swoops at you for 3 Health. It lives through the swoop and climbs back to its lamp. New words: lamp, and dive's lamp/spend options.

v440 adds the Soundbar's bass wave to act 4's living room: every 16 bars of "Sunrise Set" (30 s), on the bar, a low wave rolls down the room from the TV wall to the window. Jump it as it passes, or be up on the furniture; caught on the floor it takes 8 Health. A bar ahead its Warning fills along the TV wall in hot speaker red, and a sub drop plays a beat before it goes.

v439 adds the Cicada to Act 4's living room from 1:30, replacing the stag beetle there: a stocky, slow tank with big red eyes and clear wings that plants itself and sings a cone of sound (a floor wedge and a cone fill as a warning, then it hurts and shoves you away). Step out of the wedge, or jump it close to its head.

v438 brings the sun up in Act 4's living room: a line of daylight creeps from the window wall toward the TV over the 3 minute night, and a jelly standing on its side of it, floor or furniture, loses 3 Health a second, its bell drying dull and steaming with a low sizzle. Its edge glows hot with a low hex Warning just ahead; bugs aren't hurt, chests never turn up where it will reach before they fade, and the stage door stays in the shade.

v437 gives Act 4's living room its dawn look: a blue hour at 6:00 AM warming to gold by 8:00 AM, a little brighter than the night, with the window glowing.

v436 gives Act 4's living room its own map: the Singing bowl moves onto the lounge chair, the Mushroom pillow stands clear on the sofa and the Headphones sit on the glass coffee table, ready to come alive as Act 4's Elites, with the vents beside them landing you across from each one; the Disco-ball mobile and a clutter bowl are cleared away, the corner shadows are baked for the new layout, and the night plays its own song, "Sunrise Set".

v435 gives act 4 a night before the Encore: the run now arrives in the living room at dawn, just inside the hallway door, for 3 minutes from 6:00 to 8:00 AM, with three chests and act 3's bugs standing in until the act's own crowd comes. When the time is up no boss comes: the bugs go and the stage door opens on the media console, and landing there takes the run through to the concert arena with its Health, level, Treasures and kills as they were, for the same Encore fight as before. A run saved part way through act 4 before this update opens in the room.

v434 writes act 4's exploring song, "Sunrise Set" (E minor, 128 BPM like the Encore recording): a soundcheck whose kick waits for the fuller layer. It isn't playing in game until act 4 exists.

v433 makes the act 3 shark summon its illusion at half Health: a see-through copy that rises beside the jelly and uses the shark's own attacks for the same damage. It has no Health, nothing aims at it and your attacks pass through it, so keep hitting the solid shark; it rests a little longer between attacks so the two strike out of step, and it goes when the shark is beaten.

v432 reloads a page still running an older version's code into the new one, so a phone can't crash mid-fight reading new content with old code (the Soap Dispenser's `SK.squirt` error).

v431 gives the dragonfly a second attack: it whips its wings into a little whirlwind of spinning blades and flings it at you. The whirlwind flies slowly and sucks you toward it as it comes, so swim hard to one side.

v430 gives four act 1 and act 2 Elite attacks their own answer: the Kettle's Boil dry pops its lid onto the counter and the only spot the steam misses is the white circle round it, the Soap Dispenser blows a bubble trap that drifts after you (shoot it down or be held and popped), the Clock's hour strikes now light the wedges its real hands point at, and the Mug's spill scalds you and washes you along the line.

v429 makes three act 3 Elites move: the Bull's rush is a real charge down a lane to the table's edge (sidestep it, then hit it while it's dizzy), the Alligator's pounce lands where you are and it stays there till you leave the bed, and the Coffer's accordion Warning follows you until it locks.

v428 adds three Megabonk-inspired Treasures: Pedometer (rare, +1 XP for every 2 m you swim), Bloody Fangs (Legendary, lose 1 Health a second but never your last, for +25% Move speed, +50% Fire rate and +1 mid-air jump) and Pocket Vacuum (epic, 1 in 10 attacks sets off a 4 s mini tornado by the nearest bug that pulls bugs together and stings them a little).

v427 makes four Elite attacks play differently: the Controller's symbols go off one at a time in the order its buttons light, the Kettle's steam balls aim where you're heading, the Soap Dispenser's bubbles are foam columns you can't jump or duck (find the gap), and the Alligator's frost balls land one after another across the fan.

v426 gives the last look-alike Treasures a body of their own: Fly Swatter slaps flying bugs with a real swatter, Bath Bomb is lobbed onto a crowd and erupts in a foam geyser that throws bugs into the air, Ice Cube melts into a slippery puddle bugs skid on (and you swim faster on), Disco Ball's spotlight picks the toughest bug close by and makes it take double damage (now for every jelly type), Whale Bath Toy spouts Health when you land a jump, Night-Light's glow keeps ordinary bugs out (no more stat bonus), and Bubble Wrap goes off as a ring of little pops.

v425 makes more look-alike Treasures their own thing: Rubber Duck Stuns instead of hurting, Marble is a pinball that speeds up off walls, Glow Stick grows while you swim, Moon Jelly stings the bugs it surges through, Dustpan and Leftover Meatball leave things on the floor to swim for, Gold Ring's golden attacks drop big gold XP gems on every jelly type, and Coffee Bean, Drinking Straw, Flip Flop, Odd Sock, Hand Cream and Bubble Wand each get their own twist.

v424 fixes Treasures that didn't fit some jelly types: removes Box Jelly; Reed Stick is Normal's alone and Rebound Jelly is only offered to Normal (Element shots never rebounded); Bobby Pin now pierces with Fire, Lightning, Ice and Wind shots (not offered to Poison, Glitter or Tentacle); with Pot Lid, chests stop offering Treasures that only heal; Hot Chili and Cinder Jelly cut Tentacle reach too, so their cost bites the Tentacle jelly; Ricochet still works with Rebound Jelly; Roller Skate counts Move speed from your jelly's own start; Nail Clipper, Thumbtack and Fly Swatter crits now reach Glitter bursts; Bubble Bath says it fires plain bubbles.

v423 cuts look-alike Treasures: Aegis Jelly is retired (Bubble Wrap does its job), Egg Timer folds into Crank Flashlight's new levels, Static Balloon, Disco Ball and Ice Cube are no longer offered to the jelly types they copy, and Attack upgrades that shared an icon get their own.

v422 makes every jelly's arms show (four or more real arms below the rim, on every bell), lights the rim and the tentacle tips in the second color ("Arm and rim color"), softens the tentacles' glow so a bell color stays that color instead of turning white, and adds four bells (Onion Dome, Bubble, Gem, Comb Jelly with rippling rainbow rows), an Arms row (Frilly, Curly, Pom-poms, Streamers), a Tentacles row (Straight, Curly, Beaded, Ribbon) and five bell patterns (Spots, Hearts, Stars, Zigzag, Spiral) in the Pearl shop.

v421 makes furniture and walls the camera fades see-through much cheaper to draw: they use a plain lit copy of their material, drawn once, and High's AO no longer draws them a second time, so the frame rate holds when you walk behind a sofa or wall.

v420 the Glitter jelly's burst no longer draws a shaded sphere: its glitter flies out to fill the burst's reach, hangs a moment and sinks.

v419 shows phone players how to turn the camera: until they first drag on the right side, a dashed hint there has a see-through finger sweeping across it, and the camera turns along with its first two sweeps. It comes back in the next act if a whole act passes without a turn.

v418 takes the glowing core out of every jelly type's bell (it poked out of flat bells like the Fried Egg's, on the pick card and in play), and turns the Glitter jelly's burst into a plain glassy ball with no hex cells, so it's much less busy.

v417 keeps a dev password saved in the Cloudflare dashboard through every deploy, and the unlock box now says "No dev password set on the server" when the Worker can't see one, instead of "Wrong password".

v416 Removed the old Element Treasures (the 37 Elements and their upgrades, plus Power Bank) and the Element pick code they needed, now that every run is a jelly type.

v415 stops jumps from dodging boss attacks that should hit anything in their space: the Clog's hair chunks now splash a column 25 cm up off a duck's back (hop to the spared duck instead of jumping off), its comb curtains stand 22 cm tall (taller than a full jump), the Encore's disco spots hit at any height (step off them), and its floor tiles keep hurting while they're lit, so landing in a wave's wake is hit.

v414 Fixed the balance smoke check failing after act 3: a boss's Legendary pick is not always an evolution, so the run may carry none.

v413 Jelly types are here: after your first run you pick a jelly (Normal, Fire, Lightning, Ice, Poison, Wind, Glitter or Tentacle) before every run, each with its own attack, look and 12 Attack upgrades (one after each of the first three bosses). New types unlock by finishing acts and defeating Elites. The old Element treasures and the separate evolution pick are replaced: evolutions now come in the Legendary pick after a boss.

v412 starts the camera 15% closer to the jelly (0.765 m on desktop, 0.595 m on phones); the mouse wheel still zooms out to the old 0.9 m view.

v411 cuts the floor rings that crowded fights: hits, crits, kills, freezes, gusts, jumps, enemy throws, rebound trails, special bubbles, the Glow Stick's tick, the Chore List target and the Night-Light's rim no longer draw a circle on the floor, slowed bugs show drifting frost instead of a ring, and the room chest's timer is a thin gold arc instead of the danger Warning look, so floor circles now mean a Warning or the real reach of an area hit.

v410 adds seven Treasures inspired by roguelike classics: Pizza Cutter (hits finish off bugs under 15% Health, Elites under 8%), Rolling Pin (+40% damage to anything above 90% Health), Thimble (every hit takes 1 less Health, never under 0.5), Fish Food (an act's Boss falling levels up 2 of your Treasures), Night-Light (each Level-up plugs in a night-light; in its glow +40% Fire rate and +0.5 Health regen), Chore List (a far-off bug gets a gold target worth +0.25 Attack damage) and Glow-in-the-Dark Star (1 in 10 cleared bugs rises as a glowing ghost that slams other bugs).

v409 Elites no longer stall when you swim tight circles round them: once an attack is ready, an Elite snaps round to face you and starts it, instead of waiting to finish turning (which a close circling jelly kept it from ever doing).

v408 lightens crowded fights on phones: bugs far from the jelly or off screen animate on alternate frames, and past 8 hit effects in one frame the rest keep only their flash, without the sparks and ring.

v407 shows each jelly type's element moving round the jelly on the pick screen's cards (flames, frost, crackling arcs, toxic bubbles, gusts, glitter, stings, bubbles), with the jelly itself drawn plain, so every card reads differently.

v406 adds jelly type unlocks (finish acts, defeat Elites), a Jellies page in the Treasure book, type-aware hints and achievement text, and each score's jelly type on the leaderboard, all behind the jelly types switch.

v405 adds the Glitter jelly behind the jelly types switch: glitter bombs that burst in a ball of sparkle you can see (flying bugs too), its rainbow look, and its 12 Attack upgrades.

v404 builds the Wind jelly type behind the jelly types switch: fast gusts that go through three bugs and shove them back, a white swirl and streaming tentacles for its look, and its 12 Attack upgrades (Cyclone, Bowling, Glide: hold jump in the air to drift down, and more).

v403 jelly types (behind the switch): the Normal jelly gets its 12 Attack upgrades, from Double Bubble to Orbit.

v402 adds the Lightning jelly behind the jelly types switch: its shot arcs to 3 more bugs and stuns them, its jelly crackles with a storm look, and it has 12 Attack upgrades (big bolts, charge-ups, Ball Lightning and more).

v401 jelly types (behind the switch): the Ice jelly gets its look (a pale crystal in the bell, frost on its tentacle tips, cold mist sinking to the floor) and its 12 Attack upgrades, from Permafrost to Avalanche.

v400 Poison Rain blobs start under low furniture instead of inside it, and Toxic Cloud and Burst Sac stacks are worth the blob's own with more Attacks.

v399 builds the Poison jelly type behind the jelly types switch: a blob that bursts into Poison stacks (no puddles), Poisoned bugs hit 20% softer, its green look, and its 12 Attack upgrades.

v398 paints the marks left on the floor at startup: splashes, scorches, Ink Cloud blots and dust now have real shapes instead of flat discs (one small painted sheet, same size, fade and cost).

v397 brings the jelly type pick screen's centre card to life: your jelly fires its real attack (bubbles, Fire shots, the Tentacle lash) at three roaches that die and come back, so you can see how the attack works and how long a kill takes.

v396 stops tentacles, bubbles and treasure attacks aiming at a boss that can't be hurt right now (rising, doomed at 0 Health waiting for the cat, or in Encore's cut scenes), not only a shielded one, so they hit a bug instead.

v395 drops an unused lightning line material that was only built to warm up a shader the game never draws (lightning bolts use their own pooled lines), so startup builds one shader fewer.

v394 gives the Tentacle jelly its 12 Attack upgrades after each boss (jelly types are still behind the dev switch): Stinging Nettle, Tape Measure, Spaghetti Strand, Toaster Cord, Chopsticks and Paperclip Chain reworked, plus Whip Crack, Anchor, Ink Cloud, Venom Sac, Coil and Bell Pulse.

v393 jelly types (behind the switch): no separate evolution pick; the boss's Legendary pick draws from one pool of 19 (the 9 Legendary treasures and the 10 former evolutions), evolutions stack, Box Jelly's tentacles lash for any jelly type, and Rebound, Man o' War and Disco Ball are offered only to types they work for.

v392 makes the dev password check ignore stray spaces or a line break in the stored password, and says "Wait 3 seconds" instead of "Wrong password" when you try again too fast.

v391 adds the jelly type pick screen behind the jelly types switch: a row of cards with a slowly turning portrait, six stat bars and a details panel, opened by Play.

v390 jelly types (behind the switch): after each of the first three bosses a second pick of 3 Attack upgrades from the type's pool, with Fire's 12 (content/upgrades.kdl); with types on, chests never offer Elements, Element upgrades, Power Bank or the old tentacle Treasures.

v389 gives the Normal, Fire and Tentacle jelly types their one attack each, behind the types switch: Normal blows bubbles with no tentacle lash, Fire fires its Fire shot at its full Fire rate, and Tentacle stings with Attacks tentacles for Attack damage and is never offered Range, Attack size or Pierce; Fire glows with an ember and coal-tipped tentacles, Tentacle's tentacles are longer, thicker and barbed.

v388 adds six shared words for the jelly types' coming Attack upgrades (status-damage, status-taken, on-kill-of, nth-attack, stack-buff, while moving); Shatter now runs on status-damage and plays the same.

v387 renames the Bubble stats to Attack in player text: Attack damage, Attack size and Attacks, and treasures, cards, evolutions and achievements now say "attack" where they mean your attack. No numbers or behaviour changed.

v386 lays the groundwork for jelly types (dev only): content/jellies.kdl lists the eight types, and the dev switch (`?types`, a Types button in the dev tools) starts a run as one with its own stats. Players see no change.

v385 makes Low and Medium graphics lighter on phones: corners and the floor under furniture get baked shadows instead of live ambient occlusion (Low gets them for the first time), bloom runs at half resolution and is added in while the picture is finished, and furniture that shares a material is drawn in one batch (a phone's Medium frame drops from about 530 draws to 200). Dev tools get AO, Bloom and Lamps switches for measuring on a phone.

v384 makes phones run cooler: they draw at 30 frames a second by default (pick 60 under Frame rate in the menu), and a held or double tap no longer selects the page's text or pops the copy bubble.

v383 keeps a later act's progress as it's played, so refreshing the page in act 2, 3 or 4 picks the act up where it was (its clock, Health, kills, level, Treasures, beaten Elites and waiting chests, and the same level-up cards) instead of a fresh act with full Health.

v382 draws the jelly on the title screen 35% bigger (the menu camera sits closer), on phones, desktops and tall windows.

v381 fixes Firefox throwing a sound error over and over when a fireball or wind charge was cut short (Firefox has no `cancelAndHoldAtTime`).

v380 keeps dev-tool runs off the leaderboard: the 🔒 Dev password is checked by the server instead of sitting in the game's files, any run that uses the test kit or tuner (or any run after unlocking them) is a dev run that can't be submitted, and the leaderboard only takes a score backed by a logged run with believable levels, act times and treasure counts.

v379 makes the kitchen cabinets, stove, cookware and countertop objects transparent only during the Vacuum fight, restoring their original materials after victory, death or restarting.

v378 closes the shark fight’s safe corners: the leap’s warned splash reaches its aimed spot across the playable bed, while the shark stays inside the arena and the locked splash remains dodgeable.

v377 clears Continue immediately on death or final victory, including the tab’s carried run, so closing or reloading during the ending cannot restore a finished playthrough.

v376 keeps the selected cosmetic’s price and Buy button visible above the creator’s footer while you scroll. Golden award requirements appear there too, and choosing another look clears the purchase offer.

v375 lets players change their public leaderboard name without changing their score or place, reserves unique names across score and achievement boards regardless of capitalization or repeated spaces, and resolves existing duplicates by keeping the earliest saved score’s name and giving later entries an available numbered name.

v374 adds a How to play button above Play that reveals a short gameplay summary: move and dodge, attack automatically, collect XP, choose upgrades and treasures, then survive to beat the boss and reach the next act. The summary starts collapsed.

v373 keeps the kitchen counter, stove, cookware, and countertop items opaque at every camera angle.

v372 Show large, sharp portraits of each player's customized jellyfish beside their achievement rank, name and total; sharing updates the saved look, with saved score appearances available for older entries.

v371 Keeps bugs outside the hallway cabinet and checks their full body clearance before spawning beside walls or furniture.

v370 reuses enemy models, hostile projectile models and state, and bubble, tentacle, acid puddle, brick and marble state, resetting combat history and poses while preserving enemy identity and death effects.

v368 Put a Share achievements button directly in the Achievements section, opening the existing name-and-confirmation flow for the achievement leaderboard.

v367 Keep the Encore attacking when music is loading or suspended, continue silent timing from its last audible beat, and reschedule its set with fresh warnings if the song restarts.

v366 Keep held phone joystick gestures through Treasure and level-up picks, resuming movement when the cards close without another tap. Recover held keyboard controls after a focus interruption without repeating jump, reset or interact actions.

v365 extends browser zoom protection to the pause menu, blocking pinch and double-tap zoom while keeping its buttons and vertical scrolling usable.

v364 adds Elite defeats, chosen Treasure counts and pickup timelines, and the unit and attack responsible for a death to the private balancing reports. Records use active-play seconds within each act and the existing batched uploads; historical records remain available.

v363 prevents accidental browser zoom during two-thumb play, including missed presses between Jump and the map, by protecting the whole page while the touch controls are visible and explicitly cancelling native touch gestures for iPhone browsers that ignore CSS on positioned controls. Menus retain deliberate pinch zoom and scrolling, without double-tap zoom.

v362 records compact balancing summaries when an act starts, ends, or the player leaves the tab. Failed uploads retry from a bounded local queue; batched reports update one record per run and act without duplicating results or replacing a completed act with an older checkpoint. Historical run records remain available.

v361 adds a beta bubble to the corner of the death and win screens: "Jelly Run is still in beta! Tap to bloop us your thoughts" opens a box to type feedback, which the game site keeps with the run's build, act, score and device. The game site also keeps a private log of every act played (outcome, score, level, treasures, what took your Health), never shown in the game.

v360 gives the death screen its own backdrop: your jelly lies dried out on cracked mud under a dusty sun, slumped flat with its tentacles splayed across the ground, faded to a dull husk, the title screen's look gone dry.

v359 shows one random hint for new players in its own bubble on the death screen of acts 1 and 2.

v358 adds an "Install app" button to the title screen where the browser can install Jelly Run (Chrome, Edge); it opens the install prompt and goes away once installed. Android's install popup now shows a description and screenshots.

v357 drops the progress lines (counts like 3/8 and "In progress" notes) under unearned achievements, since each one is earned within a single run.

v356 adds the Shield: a bar after the Health bar that takes damage first and refills to full in 2 s after 5 s without damage, a Shield level-up card (+3/+4/+5), and five shield treasures offered once you have some (Crank Flashlight, Egg Timer, Oven Mitt, Bubble Wrap, Pot Lid). Aegis Jelly now gives +5 Shield and keeps its 15-damage burst.

v355 makes the tentacle sting easier to see: the striking tentacle swells and burns white-hot, a cyan glow follows it out and streaks behind its tip, it lands on top of the bug instead of inside it, and a cyan crescent cracks across the bug where it hits. Damage, reach and timing are unchanged.

v354 adds an Achievements section to the main menu, pause menu and run summary with 13 challenges earned only by winning all four acts. Tracks selected cards, original scheduled treasures, treasure repeats, Elite defeats, rerolls and Health loss across acts; earned achievements stay in this browser. Its Top 5 players submenu lets players share their earned achievements under their leaderboard name, ranks unique achievements across winning runs, and shows their own shared total. Repeat submissions cannot add duplicate points or erase earlier achievements. Dev-assisted runs and older saves without challenge history cannot unlock achievements.

v353 gives Dodge level-ups diminishing returns: each pick closes the same share of the gap to the 60% cap (Common +10% at 0 Dodge, about +5% at 30%), so a Dodge pick always adds something, and the card stops being offered once treasures alone reach 60%.

v352 makes Immortal Jelly keep Health regen until its first polyp revive; regen stops for the rest of the run after that.

v351 enlarges the jelly in customization and leaderboard portraits on desktop and phones, keeping all ten scores reachable in a scrolling board.

v350 opens a new player's first run with a tip for 7 s: "Attack automatically when bugs are nearby. Collect XP to grow stronger and survive until the boss arrives."

v349 pauses the game when you leave it mid-run (another tab or app, or the phone locked), so you come back to the pause menu instead of a fight already underway.

v348 makes holding a phone upright always pause the run. The "Turn your phone sideways" screen now goes by the phone's own screen, not the page's width (iPhones can keep the page at its landscape width after turning back upright, which let play go on in portrait), and nothing in the run moves while it's up, even when a level-up or treasure pick was open as the phone turned. Turn it back sideways and the screen goes away; tap Play to carry on.

v347 moves the game to jellyrun.org: the old address sends players there and brings their saves (best score, Pearls, Treasure book, looks, settings) with them.

v346 renames the game to Jelly Run: the title, loading screen, main menu, tab and home-screen name. Saves from Jelly Fight (best score, Pearls, Treasure book, looks, settings) carry over.

v345 swaps the bathtub's dressing for the widened tub's in the Clog fight: the real tub's mat, drain, end tile, sponge and rim bottles no longer sit inside the acid, and the wide tub's own mat, spout and tile show (the swap matched names the way the model loader spells them, so the game's own dressing was never found). Story: `act2/tub-dressing-widens-with-the-tub`.

v344 makes critical hits land harder: the number is tagged CRIT and slams in at twice its size in italics inside a star burst, hangs a beat, then rises; the hit gets a white-hot core, a second wide ring, a small screen kick and a bright metallic shing. Damage is unchanged.

v343 retunes treasures and evolutions: Flip Flop +20% Move speed (was 30%); Bandage grows every 30 kills (was 15); Hand Cream 0.2 Health regen a second (was 0.25); Cotton Ball shockwave 2.5 damage (was 3); Baby Bottle heals 0.2 / 0.3 / 0.4 per kill (was 0.25 / 0.5 / 1); Disco Ball echoes for 40% of damage (was 60%); Cat Toy Mouse every 5 s (was 6); Tea Bag every 2 Levels (was every Level); Fly Swatter crits 2.5x and pins for 0.2 s (was 3x, 0.4 s); Spring Insole +50% Jump height (was 25%); Tape Measure +60% Tentacle reach (was 75%); Mirage Jelly -15% max Health (was -10%); Aegis Jelly shield absorbs 5, explodes for 15, returns after 5 s (was 10 / 10 / 6 s); Box Jelly tentacles reach twice as far (was three times); Lion's Mane -20% Move speed (was -15%).

v342 rebalances Elements: Acid vulnerability is 30%, Ice hits for 2x Bubble damage at half speed, Wind hits for 1.5x at 1.6 m/s, and Glitter travels at 0.4 m/s with an 8 cm splash for 40% of Bubble damage. Element pickups now summarize damage and signature effects.

v341 makes the bathroom shower curtain see-through while keeping its chrome rod and rings solid.

v340 retunes treasures and level-ups: Sticky Note marks add 30% / 35% / 40% damage (was 50 / 60 / 70%); Popsicle Stick and Hair Dryer pierce 5 more (was 3); Frozen Peas +50% (was 40%); Box Fan pushes 80% farther (was 60%); Ice Cube snaps every 6 / 5 / 4 s (was 8 / 7 / 6); Houseplant drips 3 / 4 / 5 XP every 10 / 8 / 6 s (was 2 / 3 / 5 XP, Lv 3 every 7 s); Medicine Ball gives +1 Bubble damage per 10 max Health (was 8); each Level needs 1.35x the XP of the last (was 1.4x); the Health regen card gives 0.1 / 0.2 / 0.3 a second (was 0.2 / 0.3 / 0.4); the Bubble size card is no longer offered and Bike Pump (+25% Bubble size) is gone.

v339 takes the grey hose that arched from the bathtub's overflow plate over the front rim out of Act 2's bathroom; the overflow plate stays. Decoration only, so nothing plays differently, the Clog fight included. Story: `act2/no-hose-over-the-tub-rim`.

v338 gives level-up cards one free reroll per act instead of one every level-up.

v337 makes every boss immune to stun: lightning arcs, the Static Balloon's zaps and pin-on-crit no longer hold them still (the shark used to stop and lose its frenzy). An IMMUNE pop-up shows when one lands. A freeze still holds the shark.

v336 shows a small red arc on the jelly's edge the moment a hit lands, on the side it came from: toward a biting bug, or where a Shot or Blast struck (bugs, Elites and bosses).

v335 plays every lightning sound (the shot leaving, its hit, each chain jump and the heavy strike) 30% quieter.

v334 turns sound back on with the first tap after a phone moves on to the next act. The reload into act 2, 3 or 4 loses the tap that allowed sound, and the game listened for the finger going down, which browsers don't count, so acts 2 and 3 (and their new music) stayed silent on phones. Now the next tap, click or key turns sound and the act's music on, and it keeps listening until it's on (`unlockOnGesture` in src/sfx.js).

v333 replaces the Kettle's steam cone with a steam ball. For 1 s the Kettle shakes harder, swells, rattles its lid and whistles while a glowing ball of steam boils up at its spout, with nothing on the counter. Then it fires three balls in a row, 0.4 s apart, each at where the jelly is as it leaves (a flash, a kick back, the lid jumping, a crack and hiss for each; a smaller ball swells back between them); only as each is fired does its Warning show: a yellow circle with a half dome over it (6 cm), filling while the ball arcs over trailing steam (0.6 s). Each bursts there in three gusts of steam 0.15 s apart (3 Health and a shove to anything of the jelly inside the dome); the circle and dome stay up exactly while gusts are coming, then the counter is left wet for a moment. Keep moving and step out of each circle while its ball flies. Numbers in `content/elites.kdl` (`ball dmg= shots= every= gusts= gap= charge= flight= radius=`), the ball's size in `content/look.css` (`--kettle-ball-size`). Stories: `elites/kettle-steam-ball-warns-only-once-fired`, `elites/kettle-steam-ball-volley-hits-standing-jelly`, `elites/kettle-steam-ball-volley-aims-at-each-new-spot`, `elites/kettle-steam-ball-feel`.

v332 makes a new player's first run quicker to get going: XP counts double until the first Level-up, so the Element pick comes about twice as soon (~12 s in instead of ~20 s), which usually brings the first Treasure back to 0:15 instead of 1:15 (one skipped before the pick now turns up 4 s after it). The Element pick now closes with a tip: hold jump to jump higher.

v331 tones down two glaring Warnings. First, the one before the worm bursts out of a dead praying mantis. The orange circle filling round the carcass is about a third as bright and flickers less, so it no longer glares, but still shows clearly where the burst will hit. The giant millipede's lane while it revs up to roll is dimmed the same way. Their brightness and flicker are `--burst-warning-*` and `--charge-warning-*` in content/look.css.

v330 makes phones play sideways only. Held upright, a phone shows a "Turn your phone sideways" screen over everything (the title too), and turning it upright mid-run pauses the game under that screen, so nothing hits the jelly while you can't see it; turn it back and tap Play to carry on. On Android, Play also goes full screen and locks the screen sideways (it already did); iPhone browsers can't lock orientation, so there the screen is what holds it. Tablets and desktop windows are unaffected (the cover only shows on a touch screen under 600 px wide). Play asks for full screen in every browser that allows it (Chrome, Samsung Internet, Firefox, Edge and Opera on Android); iPhone browsers don't allow it, so the way to play full screen there is Share → Add to Home Screen, and on an iPhone the title screen says so ("Full screen: tap Share, then Add to Home Screen"; × hides it for good; not shown once it's opened from the home screen). The game now has a web app manifest (`manifest.webmanifest`, icon in `assets/icon/`), so added to the home screen it opens full screen with no browser bars, and on Android locked sideways.

v329 smooths the knit blanket on Act 3's bed to a shallow fold, so the jelly can walk across its edge in either direction without jumping. The visible blanket and its collision use the same flattened geometry.

v328 adjusts the bedroom bed and four vents, and removes the sleeping baby and shelf decorations.

v327 loads faster by building only the shaders the chosen graphics draw with. Low draws straight to the screen and Medium/High through the bloom and ambient occlusion passes, and each needs its own version of every shader; the game used to build both (about 290) and use one, and it built the second set all at once at the end of loading. Now it builds about 170, a few at a time, then the bloom and ambient occlusion passes behind the loading screen too. Switching between Low and Medium or High in the pause menu builds the other set then: Play shows "Preparing graphics…" for a moment (warmUp keeps a stand-in for everything it showed, so bugs, bosses and evolutions are ready afterwards too). Phones now start on Medium instead of Low; Low is still in the pause menu. Story: `engine/graphics-switch-prepares-shaders`.
v324 gives every Treasure book entry its own icon. Cinder Jelly is now 👣 (Kindling keeps 🔥) and Mirage Jelly 👻 (Man o' War keeps 🫧). The Elites, all 👾 before, are 🎮 Controller, ☕ Mug, ♨️ Kettle, 🧼 Soap Dispenser, 🕰️ Wall Clock, 🍦 Cream Whipper, 🐊 Alligator, 🐂 Bull and 🧰 Latticework Coffer; the bosses, all 👑 before, are 🤖 Vacuum, 🪠 Clog, 🦈 Great White One and 🎧 Encore. An Elite's or boss's icon is `icon=` in content/elites.kdl or content/bosses.kdl, and the Tuner shows it too.

v323 takes the stag beetles out of the Encore's fight. It no longer calls 2 beetles onto the floor at bar 8 and every 16 bars after, and its force field no longer goes up while they live. The fight is now the Encore and its set on its own: the force field still covers the booth while it warms up at the start and while it reboots after shorting out at half Health, and nothing else holds your hits off. Beetles still appear in act 3.

v319 makes the moments the game hands you something land. The menus and reward screens have small sounds of their own: a tap, a whoosh as each card is dealt and a chord as big as the rarest card's rarity, a thunk when you pick, a crackle as the others burn, a chime when you buy a look. A level-up lands first: the level badge pops and a gold ring leaves your jelly, then the cards deal in after a beat, wearing their rarity like treasure cards, and leave the same way (the won card pulses, the others burn away, its icon flies into the badge). The end screens tally: rows arrive one by one, and the Score, each part of it and the Pearls going into your bank count up with rising ticks; a tap skips to the end. A golden award earned in a run gets its own reveal before the score, your jelly wearing it on turning gold rays, with Wear it now and Continue. A boss's last blow plays on in slow motion after its hit-stop, and "… is cleared!" stamps in big and gold. On phones the thumb controls no longer stay on screen while your jelly swims home after a win. Reduce motion shows every number at once and skips the motion and the slow motion; sounds stay. The slow motion's length and speed are `--boss-kill-slow` in content/look.css.

v318 lets you try on looks you haven't unlocked. In Change your look, tap a locked shop look or golden award and your jelly wears it right away, with its price or what it takes shown over the jelly ("Trying it on · Lampshade · 300 Pearls"). Pick anything you own, tap Surprise me, or leave the creator and it comes off; a look you're only trying on is never saved and never goes into a run.

v317 makes loading feel alive. The loading screen now stays up until Play works, with a swimming jelly that keeps moving even while the page is busy, and says what it's doing (downloading, unpacking, building the rooms, preparing the graphics) with a bar that fills through every step, not just the download. The graphics are prepared a few at a time so the screen can update between them (src/main.js, `prepareGraphics`), and nothing is drawn behind the screen meanwhile. The apartment downloads as a gzipped copy (`assets/apartment-act<N>.glb.gz`, made by `node tools/split.mjs`; about half the size, since Cloudflare doesn't compress .glb files), and index.html preloads every game module so they arrive alongside it instead of one level at a time (the list is written by `node tools/preload.mjs`; `node tests/check.mjs` fails when it or a .gz copy is out of date).

v314 retunes the evolutions and a few treasures from Dev mode play. Lion's Mane stings four times a second for twice as much, from a little farther off. Moon Jelly pulses every 2 s, twice as hard, nearly twice as wide and with a bigger shove. Immortal Jelly costs 10% max Health (was 25%), Man o' War 15% (was 20%) but its polyps' shots hit for 30% (was half), Box Jelly's tentacles reach three times as far and its bubbles blow 35% slower (was 40%), Aegis's shield returns after 6 s (was 8), Mirage's ghost lasts 4 s and costs 10% max Health (was 3 s, 15%), and Cinder's trail burns 3 s, a little wider and taller. Cat Toy Mouse comes every 6 s, hits harder (9x), is bigger and quicker, with twice the splash; Disco Ball's echo hits for 60% (was 65%); Hand Mirror is ready every 8 s (was 15); Windowsill Cactus and Toaster Cord can answer up to 5 hits a second, the needles reach 45 cm for more damage and the cord lashes twice as far; Spaghetti Strand adds 2 tentacles and Tape Measure +75% reach.

v313 gives acts 2 and 3 their own music while you explore, from the same dark synth band as act 1's "Puddle Drift" (string pads, a sequenced analog bass, low brass) but each a step more urgent. Act 2 plays "Ephyra Tide": D minor at 108 BPM, a galloping bass, a kick off the bar, ticking hats and a faster arpeggio as the bugs close in, and the brass a fourth higher. Act 3 plays "Medusa Bloom": E minor with a Phrygian turn at 116 BPM, a new chord every bar, the drums out of half time (snare on 2 and 4, toms every other bar), driving 16th bass, a riser into every eighth bar and the highest brass of the three. Boss songs are unchanged. Each act's song is its stage's `music` (src/stage1.js to stage3.js); the songs live in src/music.js, and `node tools/music.mjs` renders all three to listen to.

v311 adds Pearls and a shop of new looks. Every run that ends pays Pearls: 5 for the run, 1 for every 10 bugs, 3 an Elite, 10 a boss (25 more the first time you ever beat it) and 20 for a win; they're banked as you earn them, and the end screen says how many. In Change your look, a shop look shows its price (🦪); tap it, then Buy. On sale (60 / 150 / 300 Pearls): a bottle cap, thimble helm, paper boat, sticky note, shower cap, hermit shell, starfish, odd sock, lampshade, fishbowl and coral crown on top; googly, heart and star eyes, a snorkel mask, a monocle and 3D glasses; a moustache, tongue out and bubble gum; and three bell patterns (rings, stripes, freckles; 100 each). Sixteen new golden awards can't be bought: dust-bunny earmuffs, a golden duck, a golden fin and an Encore headset for beating each boss, Bookworm specs and a golden book for half and all of the Treasure book, a golden kettle and pixel shades for 10 Kettles and 10 Controllers, a diamond tiara for a boss beaten without losing Health, a crown for winning as each species, and the Gilded finish for earning every other one. Every hat rests where the bell is as wide as it is, so it sits right on every species and rides the bell's pulse; a hat's still parts draw as one mesh per material, and the Immortal Jelly's halo floats above a tall hat. Prices and the earn rate live in src/cosmetics.js (`PRICES`, `PEARLS`); the looks are built in src/character.js.

v310 makes the bathtub 1.6 times as wide for the Clog fight, so the fight has room to move: inside it runs about 1 m front to back instead of 62 cm (the length is unchanged). Only for the fight: exploring act 2 the bathroom is as it was. Under the fade into the fight the tub grows out into the room from the back wall and what stood in front of it moves out of its way (the laundry shelf and everything on it, its drawstring bag, the bath mat, the shower curtain, the step stool a little), and the bathroom door goes (it would stand in the wider tub); a new run puts it all back. The drain, the spout and the fittings on the end wall sit in the middle of the wider tub; the Clog's attacks keep their sizes, and its comb lanes, the acid and the ducks spread across the whole tub. A stage's boss can now rearrange its room for the fight (`boss.set` in its stage file, src/boss-set.js).

v309 brings the default phone camera closer: 0.7 metres from the jelly, down from 0.9. Desktop still starts at 0.9 metres, and the shark fight keeps its separate phone view at 0.85 metres.

v308 makes the shower curtain and the open bathroom door see-through during the Clog fight. Both stand round the tub and could hide the fight: the camera only fades what's between it and the jelly, and you can pass through the curtain, so it never faded at all. Now both go faint (15% solid) when the Clog rises and come back solid on a new run. Tune it with --boss-see-through in content/look.css; a stage's boss `seeThrough` lists what goes faint (the camera keeps them faint: camera.js `keepFaint`).

v306 softens the dragonfly's charge sound. The whine that climbed to a shrill 1.9–2.9 kHz is now a low hum, two soft tones an octave apart rising from 75–150 Hz to 240–480 Hz under a muffling filter, with a slower flutter. A swarm no longer stacks into noise: at most three hums play at once, the second and third quieter, and any more dragonflies charge silently (their beam still fires). Tune it in `beamCharge` in src/sfx.js.

v305 makes the Clog's acid deadlier and better looking. Floating in it now costs 4 Health a second (was 2). The acid is a toxic violet goo, mottled and oily, no longer green: violet is the yellow ducks' complement on the painter's colour wheel (and sits opposite the Clog's yellow-green Warnings), so the ducks pop off it. Toxic bubbles keep swelling and popping on it, letting off fumes and the odd hiss. In the 25% phase the whirlpool is a real swirl now, spiral arms turning down into a dark eye and sweeping the bubbles round, and the ducks circle twice as fast (`whirl=1`). Tune it with `acid` in content/bosses.kdl and `--clog-acid*` in content/look.css.

v303 applies a second Dev mode tuning pass to the act 2 and 3 bugs (`content/enemies.kdl`, 11 numbers), mostly easing them. Wasps dive slower (2) from closer (50 cm) and sting for 4 instead of 6. The stag beetle's ball flies much slower (0.6). The dragonfly zips slower (1.25) and shorter (20 cm), charges for half a second instead of 1 s, fires a wider beam (8 cm) and darts away from hits at most every 5 s. The mantis swats 20 cm instead of 30. The ladybug flies round you slower (0.45).

v302 gives the Clog its acid duck phases and drops its flood and ladybug swarm. Four rubber ducks sit round the middle of the tub floor. At 75% and again at 25% of its Health, the Clog fills the tub half full of green acid (floating in it costs 2 Health a second) and the ducks bob up on it. From the head of the tub, where it can't be hurt, it lobs a hair chunk at three of the four ducks every 1.5 s, eight times: get on the spared duck. Then the acid drains and the fight goes on. The second time, the acid swirls: the ducks circle the middle, carrying you, and each chunk lands where its duck will be. Tune it with `acid` and `ducks` in content/bosses.kdl.

v300 softens the lanternfly's landing warning: opacity now pulses gently between 24% and 28%, down from 85–100%. Its landing radius, fill timing and damage are unchanged. Tune it with --leap-warning-opacity and --leap-warning-pulse in content/look.css.

v299 quadruples The Great White One's Health: 1500 to 6000 base, or 2400 to 9600 in Act 3 after its existing 1.6x boss scaling.

v298 reduces Act 3's regular bug spawn multiplier from 0.85 to 0.70 (about 18% fewer spawns), lowering its regular-spawn alive cap from 17 to 14. Wasp nests and boss summons keep their existing settings.

v297 applies the owner's 38 treasure tuning values: stronger Element upgrades, wider Rubber Duck, Guitar Pick and Bath Bomb effects, lower Cotton Ball damage and Whale Bath Toy healing, and smaller Sticky Note bonuses at higher levels. Descriptions match the new values.

v296 trims repeated text across picks, inventory, rewards, combat hints and end screens. Upgraded treasures show their current effect, level labels appear once per pick, and pickup confirmations show the name and level or copy count.

v295 removes jump-climbing from the sofa. Use its floor vent to reach the seat.

v294 starts desktop and phone gameplay fully zoomed out, 0.9 m from the jelly. Desktop players can scroll to zoom in as usual.

v293 reworks the mosquito into a fast biter. It no longer spits a laser and has no aiming line. It flits round you in quick jittery darts, faster than you swim (0.9 m/s, about 15 cm out), then stops, draws back with its whine climbing and darts in to bite: 1 damage, and you Bleed 1 Health a second for 3 s. Every bite adds its own Bleed, so they stack. Its aim locks halfway through the draw-back, so moving off as the whine climbs makes it miss. Bleeding shows as red drops dripping off the jelly for exactly as long as it lasts, with a BLEED receipt when a bite lands. Its legs are now jointed and move in flight: they dangle and swing, sweep back with its speed, fling out in turns, the hind pair held up; its wings beat in a figure of eight and it banks into turns. New words `bite` and `bleeds` (`src/words.js`); the spit word's `laser` shot is gone. Stories: `words/bite`, `words/bite-dodge`, `words/bleeds`, `words/bite-feel`, `enemies/mosquito-bites`.

v291 retunes every bug from a Dev mode tuning pass (`content/enemies.kdl`, 88 numbers). Most bugs got faster, bigger and harder to stand next to. Cockroaches chase a bit faster (0.35, still slower than you) and are bigger. The ant is smaller and quicker but has less Health (45), and its pin flies at chest height. An ant and a cockroach are now the same length, about 10.5 cm. Mosquitoes spit faster and farther with looser aim. The lanternfly leaps farther and higher, lands a wider, harder slam (5 in 20 cm) but rests longer between leaps, and bites for 2. The spider lobs flatter, faster webs more often from farther off and has more Health. The house fly is bigger, tougher (65), hugs you closer and pokes sooner. The millipede turns and weaves harder and rolls twice as fast. The ladybug flies faster and its missile turns harder. The dragonfly zips faster, charges for 1 s instead of 2 and fires a thicker beam from farther. The mantis chases twice as fast and swats sooner, wider and harder (4). The worm bursts out in a 40 cm, 5-damage circle and whips more often. The stag beetle's shot is a big slow-charging ball with a 30 cm, 5-damage blast. Nests brood up to 9 wasps, one every 4 s; wasps are bigger and dive much faster from farther. Touch damage went from 1 to 2 on the lanternfly, mantis, worm and nest.

v290 makes the minimap smaller on phones: 135 px across instead of 195, so in landscape it takes about a third of the screen's height instead of half and stops covering the right side of the room. It's still drawn sharp, sits under the pause button, and a desktop's map is unchanged. Story: `phone/minimap-is-small`.

v288 frames the shark fight like the Vacuum fight. The fight view looked across the bed at a low angle and aimed 1 m (1.8 m on a phone) past the jelly, so the jelly sat at the very bottom edge of the screen. It now looks down at about the Vacuum fight's angle (tilt 0.98 on a desktop, 0.95 on a phone; the Vacuum's 1.05), aimed only a little ahead (0.25 m, 0.3 m on a phone), from 1.15 m on a desktop and 0.85 m on a phone (which pulls back to about 1 m while the shark leaps). The jelly sits just below the middle, the shark stays below the boss bar between attacks (its leaps can still reach the bar), and on a desktop the whole bed is in view. Tune it with `--shark-camera-*` in look.css. The stories `act3/shark-fight-camera` and `phone/shark-fight-keeps-the-boss-below-the-bar` now fail if the jelly drops out of the middle of the screen.

v287 keeps a run when the tab closes. Moving on to a new act now also keeps the run on the device (level, stats, Treasures and score so far), so if the page is closed or the phone drops the tab, the main menu offers **Continue act 2** (with the act's rooms, your level and score) above Play, which steps back to a quieter button. Continuing loads straight into that act as if you'd just beaten the one before. Only act starts are kept, not progress inside an act; the run ending (dying or winning) or starting a new one with Play forgets it, and dev runs keep nothing (`keepRun`/`keptRun`/`forgetRun` in `src/stages.js`). Story: `menu/continue-a-kept-run`.

v285 gives the Great White One angry eyes. A fabric lid now covers the top of each eye with a dark stitched brow along its edge, both sloping down toward the nose, so the shark scowls instead of looking blank; they close with its blink. Clearest side-on and up close (`shark-preview.html`, Face or Close-up). Story: `act3/shark-has-angry-brows`.

v283 removes the ✨ Effects button from the main screen; the Graphics row (Low, Medium, High) is the one visual setting. Reduce effects (no screen shake, a softer hurt glow, quieter menus and reveals) now simply follows the device's own reduced-motion setting, and an old pick saved by the button is forgotten. Story: `menu/reduce-effects`.

v282 makes getting hit push the jelly back. Every hit that lands shoves the jelly away from whatever hit it (the bug, or the boss; straight back if nothing says where it came from), harder the more it hurt: 0.08 m/s plus 0.07 per point of damage, up to 0.6 (`hitPush` in `src/config.js`). A cockroach's 1-damage bite moves it about 1 cm, a 6-damage wasp dive about 3 cm (it was a flat 4 mm before). Attacks that already throw the jelly (the beetle's blast, the elites' slams, the shark's bites, the Vacuum's and the Clog's rams) keep their own shove and add none on top; puddles and suction still don't push. Story: `movement/hit-pushes-the-jelly-back`.

v281 gives you reasons to play another run. Dying now says how close it came ("The Vacuum was 0:42 away", or how much Health the boss had left), shows your best score, and names the golden unlock you're nearest, with a little portrait of your own jelly wearing it and how far along you are ("Golden laurel · clear 1,000 bugs (859 so far)"). Try again is the big button; Enter still submits your score. And there's a **📖 Treasure book** on the main menu: every Treasure and evolution you've picked and every Elite and boss you've beaten, across all your runs in this browser, with the rest left as ?. Tap a found one to read what it does. A Treasure or evolution you've never picked wears a **New!** badge on its pick card, and the end screen lists what the run added to your book (`src/collection.js`; dev runs add nothing).

v280 replaces the ant squad with one **ant** carrying a pushpin (the owner's character sheet): a red wood ant with a dark heart-shaped head, elbowed antennae, a ridged thorax on a narrow waist, a big banded gaster and long jointed legs, a red pushpin in its jaws. It walks after you and keeps about 30 cm off; then it stands, braces and coils back (no line on the floor: the wind-up is the only warning; the aim locks halfway through), lunges and throws it spinning on its long axis: 2 Health. Each ant spawns with one of five thumbtack colours (red, blue, yellow, green, white: `--pin-colors` in `content/look.css`), and its pins keep that colour. A new pin swells into its jaws. A pin that misses sticks in whatever it hits for 2 s. The curl-and-roll is gone (the `curl-dash` word and the `tumble` death motion with it; the ant crumples). The pin is the spit word's new `shot="pin"`, with `still=true` to stand while throwing. Stories: `words/spit-pin`, `words/spit-pin-sticks`, `words/spit-pin-feel`, `enemies/ant-keeps-off-and-throws`, `enemies/ant-pin-colours`, `deaths/ant-crumples`.

v278 juices up the three weakest Legendary treasures. Cat Toy Mouse is three times the size, trundles at 0.25 m/s (was 0.6), comes every 7 s (was 10) and slams into its bug for 8x your power (was a flat 30), hitting every bug within 12 cm and shoving them back, with a dust trail, a ring to the splash edge, flying bits and a deeper thump; it now clears 10 cockroaches 3.6x faster than no treasure (was 1.2x). Hand Mirror shows six circling mirror shards while it's ready; when it goes off, a faceted mirror shell pops up round the jelly for the 1 s you can't be hurt, the bug that hit you takes at least 8x your power (was its own 1 or 2 damage), and a shockwave hits everything within 15 cm for 3x your power and throws it back. Hot Water Bottle starts below half Health (was 30%), adds +40% Bubble damage, and steam pours off the jelly while it holds. New word props: `toy-mouse size= splash= push=` (its `dmg` is now a multiple of your power), `reflect dmg= burst= burstDmg= push=`, `while … under=`. Stories: `treasures/toy-mouse`, `treasures/reflect`, `treasures/reflect-shockwave`, `treasures/while-low-health`, `treasure-feel/mouse-contact-and-recovery`, `treasure-feel-more/mirror-ready-block-attacker-and-expiry`.

v277 brings back the Vacuum's force field and keeps the bugs it dumps inside it. v273 hid every boss arena's force field so the shark fight's camera could stand behind it; the Vacuum's is drawn again (its stage sets `forceField: true` in `src/stage1.js`; the shark's stays hidden, and `--boss-force-field` in `content/look.css` still draws them all). With its back to a wall, the Vacuum's bin used to drop cockroaches inside or behind the field's thin wall, where they stuck; now a walled arena holds every bug at least its own radius in from the walls (`enemies.keepIn`, called from `Run.keepInArena`), so they land inside and come for the jelly. Story: `boss/vacuum-force-field-shows-and-holds-its-bugs`.

v275 gives every number in the ⚖️ Tuner a short note. Open a bug, treasure or evolution and tap a number: the row's one hint line says what it does ("dashes at **speed** m/s", "Health taken per hit"); on a desktop, hovering a number shows it too. Word numbers take their note from the word's own doc in `src/words.js` (so a new word's numbers explain themselves), a file's own keys (hp, r, dmg, xp, stack) and the shared boss and elite keys from a small list in `src/balance-editor.js`, and an Element upgrade's numbers from `ELEMENT_HINTS` next to `ELEMENT_BASE`. Boss and elite skill numbers with their own names have no note yet. Story: `dev/balance-editor-hints`.

v274 restores desktop mouse look immediately after choosing a Treasure or Element. The card closing animation still plays, but no extra click into the game is needed. A replacement menu still blocks resuming.

v273 makes a boss arena's force field invisible and takes back v272's camera tipping. The field is still there: it's solid (the jelly can't leave, and v269's safety net still puts it back if it ever does) and it still rises as the fight starts, it just isn't drawn, so the camera can stand behind it at the fight view's own angle and distance without the hex shimmer blurring the view. The camera no longer tips up over the jelly near a wall. `--boss-force-field: 1` in `content/look.css` draws it again. The smaller shark and beetle from v272 stay. The Great White One is also 50% quicker: it swims at 0.24 m/s (was 0.16), tracks under the quilt half again as fast, its tornadoes travel 0.45 m/s and its flung fish land in 0.37 s, and its bites, sweeps, leap and eruptions play out in two thirds of the time; its windups and warning times are unchanged (content/bosses.kdl `shark`). The Health regen level-up card gives 0.2 / 0.3 / 0.4 Health a second (common / rare / epic; epic was 0.6, rare 0.4) and reads as Health every 5 seconds: "+1 Health every 5 seconds", "+1.5…", "+2…"; the stats panel shows regen the same way (`content/levelups.kdl`, `src/stats.js` CARD_FLAGS). Story: `act3/shark-force-field-is-invisible-and-the-camera-stays-level`.

v272 keeps the camera inside a boss arena's force field, and makes the shark and the stag beetle 25% smaller. With the jelly near a wall and the camera behind it, the camera stood outside the field and looked through it, which blurred the whole view with the field's hex shimmer. Now, in a walled arena (the Vacuum's, the shark's bed), the camera tips up over the jelly just as steeply as it takes for it to stay inside the field (3 cm in from it, `--camera-field-inset`), looking down over the field instead of through it; its distance is unchanged. Tipped up, a fight view's aim comes back toward the jelly as far as it takes to keep the jelly in frame. The Great White One and the stag beetle are 25% smaller: the shark's model, body radius, how close it gets to the walls and where its fin rides (`SIZE` in `src/shark.js`; its attacks' reach and radii in `content/bosses.kdl` are unchanged), and the beetle's `r` in `content/enemies.kdl` (0.092 to 0.069; its model and body scale with it, act 4's beetles too). With the smaller shark the fight view keeps the camera's v271 distances (0.95 m on a phone, 0.85 m on a desktop) and holds the jelly well up off the bottom of the screen. Code: `src/camera.js` (`bounds`, set by `src/run.js` while the walls are up). Story: `act3/shark-camera-stays-inside-the-force-field`.

v271 brings the shark fight's camera in. It sat 1.25 m back on a phone (1.1 m on a desktop) and pulled back a further 3x each attack's jump height while the shark leapt or erupted: over 3 m during a tornado, so the jelly was a speck. Now it's 0.95 m on a phone and 0.85 m on a desktop, and a phone only makes 0.6x the jump height of room (under 0.4 m). To keep the shark below the boss bar from closer in, a phone's view aims a little further ahead (1.8 m, was 1.4). Numbers: `--shark-camera-*` in `content/look.css`.

v270 clears out what was left of the Pothos, act 3's old boss, after the shark replaced it. Gone: its three bugs (the Cutting, the Sap sprout and the Aerial root, which nothing spawned any more) with their models, sounds and stories; the four behaviour words only they used (`becomes`, `lob`, `drops`, `holds`) and their code in `src/enemies.js`; its colours, camera numbers and the rest of its look values in `content/look.css`; its glossary entries; and `docs/pothos-fluidity.md`. Comments that still named it now name the shark. Nothing in play changes. (The apartment's own pothos plant on the bedroom shelf stays hidden in act 3, as before.)

v269 fixes falling out of a boss arena. The arena's force-field walls stop the jelly along their length, but where two walls meet it could squeeze out of the corner and fall off the bed to the floor, and a stack of mid-air jumps could carry it over the top. Now, during a fight in a walled arena (the Vacuum's, the shark's bed), a jelly that ever ends up outside is put straight back just inside, on the arena's floor (`keepInArena` in `src/run.js`). The story `act3/shark-the-jelly-never-leaves-the-arena` shoves it hard at every wall and corner, walking and jumping.

v268 tightens the shark fight. The force field now closes right along the front of the pillows, so the pillows and the bolster behind them sit outside the arena and the whole fight is on the open bed (only the folded quilt's 4-5 cm edge stands up from the sheet). The Great White One moves and travels faster: it swims at 0.16 m/s (was 0.10), its bites, sweeps and leap land quicker, it tracks under the quilt about half again as fast for less time, and its tornadoes and flung fish fly faster (windups are unchanged, so every attack is still readable). Its fish circles are wider (17 cm, was 13), drain 3 Health a second (was 2) and slow you 30% while you stand in one. Every attack has its own sound now: a swish as a bite or leap starts, a jaw chomp, a heavy water slam where it lands or erupts, a gulp as it dives, a rumble building under an eruption, howling tornadoes, fish flicking out and slapping down. The water looks richer for the same cost (still one draw, no reflection pass or texture): four crossing wave trains, Schlick Fresnel over a reflected room, sharper glints, a moving web of caustic light on the quilt and in the fish circles, crest foam and a foam line on the flood as it spreads. Numbers: content/bosses.kdl `shark`.

v267 replaces Act 3’s Pothos with The Great White One: a fully animated plush shark. A 12-joint flexible spine, fin elbows and tail add flowing turns, alternating fin steps, attack coils, airborne tucks, blinks and landing compression. It walks on padded fins, lunges and snaps its hinged jaws, combos bite → fin swipe → tail sweep, spins, leaps, dives under the quilt four times and leaves pools of snapping piranha. Below 85% Health it adds three fish-flinging tornadoes. Confirmed melee hits mark Prey and bleed; a landed bite triggers Feeding Frenzy. The rebuilt mouth has a continuous roof, two inset tooth rows, a padded rounded chin and a connected cheek hinge. Attack values live in `content/bosses.kdl`; the rig in `src/shark-model.js`; the controller in `src/shark.js`. `shark-preview.html` runs the actual controller with selectable attacks and face/chin views. No downloaded model assets. [Design and adaptations](docs/shark-boss.md). The separate static floor prop is removed. Burrowing and eruptions now move the body through a clipped quilt surface, showing the snout, shoulders and tail progressively. Its entrance raises a force field around the bed, surfaces the shark and spreads a 1 cm water sheet that slows grounded movement by 15%. Piranha pools are dark, murky brown with subdued boundaries so their fish remain visible. The water uses analytic ripple shading, Fresnel, restrained highlights and foam, with no reflection scene pass or extra light.

v266 makes cosmetics something you earn: six golden pieces for the jelly, each unlocked by what you've done across all your runs in this browser. Golden crown: win a run. Golden mask: win 3 runs. Golden laurel: clear 1,000 bugs. Golden antlers: clear 5,000 bugs. Gold shades: play 25 runs. Gold tooth: beat 10 Elites. In Change your look they show with a ✨, locked (🔒) until earned; tapping a locked one says what it takes and how far along you are. The end screen names anything a run just unlocked. The totals (runs, wins, bugs, Elites) are kept in `jellyfight.feats` and updated as a run ends, between acts, and when the page closes mid-run; dev modes count nothing. Random only picks what you've unlocked. Which item asks for what is one line each in `src/cosmetics.js` (`NEEDS`); the pieces themselves are built in `src/character.js`.

v265 juices up the jelly's jump, using the platformer playbook (Mario's heavier fall, Celeste's forgiving input). Controls: hold jump for the full 20 cm, or let go early for a short hop. A press up to 0.12 s before landing still jumps on touchdown (buffer), and a jump still works 0.1 s after walking off an edge (coyote time, as before). The arc gets a beat of hang time at the top of a held jump and falls 1.7x as fast as it rose, so it reads snappy without losing the jelly's float. The jump height and everything a full jump reaches are unchanged. Look: the bell stretches up out of the squeeze at takeoff and squashes flat on landing, harder the further it fell. The landing used to push the spring the wrong way, so it stretched instead. Takeoff pushes a ring of water out under the bell with a pop of bubbles and a bloop; a real landing splashes a ring and droplets with a wet pat, bigger the further it fell. Numbers: `coyoteTime`, `jumpBuffer`, `jumpCut`, `fallGravity`, `apexHang` in `src/config.js`; `--jump-*` and `--land-splash-from` in `content/look.css`.

v264 calms the see-through camera in cluttered spots like the open tea shelves in the act 1 kitchen. As the camera's rays swept across a shelf, cups and teapots faded in and out every few frames, and a pile of half-transparent pieces drawn over each other looked like it was glitching. Now anything the camera fades stays faded for 0.4 s after it's clear, and small clutter (under 15 cm across) fades all the way out instead of to see-through. It's still there to bump into. Furniture and walls fade to see-through as before (`src/camera.js`). Across a 4-second camera sweep at the shelves, pieces switching fade direction within a sixth of a second went from 325 to 8.

v263 fixes the big white circles flashing on the first bug you hit each run. The game's puffs and wet splats are pooled pieces built 1 m across and sized as they play. The first time one was needed it was brand new, and it got drawn for a frame at that full 1 m (a white sphere and a disc) before its first update shrank it. Later hits reused pieces left small, so only the first hit showed it. New pieces now start at size 0, and a puff or splat is sized the moment it spawns (`src/fx.js`).

v262 makes treasures scarcer. Each act's night brings 4 treasures to the room instead of 5, now at 0:15, 1:15, 2:15 and 3:20. Elites still leave theirs. Luck is half as strong: each step up in rarity is (1 + Luck/200)× likelier, where it was Luck/100 (`luckWeights` in `src/stats.js`). The Game Die (level-up cards roll one rarity higher) is now a Legendary treasure, so it only turns up as a rare find or a Boss reward. It was Epic.

v261 sizes the HUD to the window. The whole HUD (Health and XP, treasures, clock, boss and elite bars, toasts, minimap) scales by one number: the window against a 1600×900 base, the smaller of the two ratios, kept between 0.85× and 1.75×. A 1366×768 laptop gets 0.85×, 1080p about 1.07×, 1440p 1.44× and 4K 1.75×, so the HUD takes about the same share of the screen everywhere. The minimap is drawn at its scaled size so it stays sharp. Phones and windows under 700×520 keep their own layout. It's CSS `zoom` on `#hud` (`Hud.fit` in `src/hud.js`), set again on every resize; the base size and limits are `--hud-base-*` and `--hud-scale-min/max` in `content/look.css`.

v260 stops the pause menu (and its treasure list) opening behind the end screen. Dying or winning lets go of the mouse, and letting go of the mouse opened the pause menu; once a run is over it no longer does.

v259 makes the Encore much tougher. Its Health goes from 4500 to 18000. The fight opens with its force field up: it can't be hurt for the first 15 s while its set warms up (`start guard=15` in `content/bosses.kdl`; its Health bar reads "Shielded: warming up"). Each of its attacks does 1 more damage: the floor waves 4 (from 3), the lasers 3 (from 2), the disco ball 5 (from 4) and the shock on its stage edge 5 (from 4). The speaker waves still only shove.

v258 gives the Encore a reboot after it shorts out: when the half-Health cut scene ends, its force field goes up and it can't be hurt for 10 s while its set keeps playing (`meltdown guard=10` in `content/bosses.kdl`). Hits bounce off as SHIELDED, its Health bar reads "Shielded: rebooting (N s)", and when the time is up the field shatters.

v257 makes a treasure's dot on the minimap a third bigger (`--map-treasure-scale` in `content/look.css`), and gives the kitchen a real sink. The counter now has a hole with an undermount brushed-steel basin under it, about 15 cm deep, with a drain. You can drop into it and jump back out (a jump clears 20 cm). It was a flat dark plate on the counter. Baked from `tools/apartment-source.html`, as the bathroom vanity's basin is; `tools/export.mjs` now takes `CHROMIUM=/path/to/chrome` for machines whose Chromium doesn't match Playwright's own.

v256 removes act 1's treasure spot by the window: treasures in the living room no longer turn up on the windowsill (`src/stage1.js`). The other 13 spots are unchanged.

v255 makes the Encore tougher: its Health goes from 3000 to 4500 (`content/bosses.kdl`), so the final fight lasts about half as long again. Nothing else about it changed.

v254 upgrades the wind attack, as fire, lightning, ice, glitter and acid were. The gust bursts out of the bell in a rush of speed lines with a ring of air, and air streaks along with the blade as it flies. A hit buffets the bug: streaks blow past it, a little whirlwind curls up round it, and real flecks of dust and lint blow off its feet, tumble and settle. A shoved bug kicks up dust as it slides, and slamming into the scenery knocks dust off the wall and leaves a scuff. A bug finished by wind is blown away: its own body tumbles off along the gust, spinning and shrinking, then puffs into dust. New layered sounds: a whump-whoosh-whistle launch, a buffeting hit, a cracking slam, and a rising howl when a bug is blown away. No numbers changed; the streaks and dust are two pooled draws (`src/wind-looks.js`).

v253 lists what you carry on the pause menu. Every treasure and evolution you have shows its icon, name, copies (×2) or Level, and what it does. A treasure with levels says what taking it again would give. The ones that grow during the run show their progress. Little Trophy, Kitchen Timer and Bandage show what they've added so far, plus a bar and how many bugs until the next step. Dustpan shows how far it is toward its +100% cap. Piggy Bank, Spare Change, Paperclip Chain, Tea Bag, Medicine Ball and Roller Skate show what they give right now and what they count. For the Level ones, that includes how much XP until the next Level adds more. A once-a-run treasure like the Snooze Button says when it's already used. The list reads the run's own counters (`src/treasure-bag.js`); no numbers changed.

v252 gives the run a real ending. When the Encore's Health hits 0 it goes down in its own scene: the music cuts, the camera pulls back on the stage, explosions climb over the booth as its panels die section by section, the DJs slump over their decks and the disco ball crashes down and shatters, then one last blow-out and the smoke settles. Then "Congratulations! You won!" over the sea, where your own jelly swims away home through rising bubbles. Continue brings up your score, and the name box and Submit only show when the score would make the leaderboard's top 10 (otherwise it says what #10 has); this applies to every end screen. No metamorphosis after the last boss: there's nothing left to grow into.

v251 upgrades the acid attack, as fire, lightning, ice and glitter were. A hit now splashes real glossy drops of acid that arc out like teardrops and land with a fizz and a green spot that fades. A bug the puddle eats at froths with green bubbles. A bug finished by acid melts: its own body turns to glowing goo and slumps into the floor, fizzing, leaving a green stain. New layered sounds: a sloshing launch, a wet splat with pattering drops and a long hiss, and a gurgling melt. No numbers changed; the drops are one pooled draw (`src/acid-looks.js`).

v250 upgrades the glitter attack, as fire, lightning and ice were. The bomb is a clear bauble with a hot pink heart and glitter swirling inside it. When it goes off: a white-hot pop, a flash of every colour, a ring of sparkle racing out to the splash's real edge, and real glitter flakes thrown out to that edge, fluttering down, glinting as they turn and lying on the floor twinkling before they fade. Every bug the splash hits sparkles. A bug finished by glitter bursts into glitter (no body left). New layered sounds: a twinkling launch, a bang with a boom and a long shimmer, a sparkly pop for a glitter kill. No numbers changed; the flakes are one pooled draw (`src/glitter-looks.js`).

v249 upgrades the ice attack (Freezer Pack), as fire and lightning were. The shard is now a faceted crystal with a white-hot core, two chips of ice orbiting it and glints off its facets. A hit shatters: a cold flash, real crystal shards that tumble, skip off the floor and melt away, and a frost flower that spreads on the floor and fades, with a crack, crunch and tinkling shards. A chilled bug wears a crown of ice spikes and gives off drifting frost exactly while the chill lasts. A bug killed while chilled shatters into ice with a glass-breaking crash (no body left). No numbers changed; the shards and flowers are two pooled draws (`src/ice-looks.js`).

v248 gives the Encore fight much more juice. At half Health its booth shorts out in a cut scene: the game holds and the camera cuts in on the booth as sparks spray out of it, smoke rises and its panels flicker and fail red, with one big blow-out. From then on it keeps sparking, its panels pulse red on the beat, and its disco ball comes down for good, wheeling and striking every 4 beats. Its booth now flashes white and jolts when you hit it, the DJs nod and the booth pumps on every beat, its force field grows in as the beetles arrive and shatters when the last one dies, and each of its hits flashes at the jelly in that attack's colour. Lighter hits: the club lasers take 2 Health and the floor waves 3 (the disco spots and the stage edge stay at 4). See [the arena note](docs/act4-arena.md).

v247 gives room chest options base chances of 60% Common / 30% Rare / 8% Epic / 2% Legendary, and elite chest options 40% / 40% / 15% / 5%. These are per option at 0 Luck, normalized if a rarity has no eligible treasure left. There is no forced minimum rarity; unopened chests use a neutral gold glow. Every third chest still offers an owned Element upgrade using its chest weights among eligible upgrade rarities. New Elements remain starting/boss rewards; ordinary Legendary treasures can now appear in either chest source.

v246 makes the leaderboard big and easy to read (larger rows and scores, on phones too) and puts each player's own customized jelly in a round picture by their name, drawn from the look they posted with their score (`src/jelly-portrait.js`: each look is drawn once, off screen, and kept). Old scores without a look get a jelly of their species.

v245 makes the Encore call 2 beetles at a time instead of 4, and makes its force field much easier to see: brighter, with big hex cells, and wrapped round the whole booth instead of half hidden inside it. See [the arena note](docs/act4-arena.md).

v244 makes Act 4 a real act. Beat the Pothos, take your Legendary treasure, and the run carries on into the Encore's concert arena. There's no night to explore: the fight starts straight away to its song, with every attack so far (floor waves, lasers, speaker waves, the disco ball, the shock on its stage edge). At bar 8, and every 16 bars after, it calls 4 stag beetles onto the floor and a blue hex force field rises over its booth: your hits bounce off until all 4 are dead. Bring its Health (3000) to 0 and the run ends as a win, after one more metamorphosis. See [the arena note](docs/act4-arena.md).

v243 fixes two things a playtester found. Beating a boss often levels you up from its XP: that level-up pick now stays open as long as you like, and the metamorphosis comes after it (before, it replaced the pick after 2 s and the card was lost). And the top of the vanity chair's back in act 3 is now the Latticework Coffer's ground too, so it wakes and strikes there instead of sleeping while you shoot it from that perch.

v242 adds the Encore's disco ball: every 8 bars, from 32 bars in, a mirror ball drops over the floor for 8 beats and throws 32 light spots that wheel round for 3 beats, stop and flash on the 4th, then strike where they stopped. Twice, then it rises away. Step off a spot or jump it. And from bar 16 the corner speakers take turns firing a wide white sound wave (nested arcs), one at a time, each rolling across the floor to the opposite corner before the next fires: it does no damage, but it shoves you 12 cm. See [the arena note](docs/act4-arena.md).

v241 rigs the Encore's arena with club lasers: an emitter on each corner post fires a fan of green beams, a laser plane, down to a line through where you stand. A thin line flashes faintly on the floor for 2 beats where it will land, then it fires and sweeps 10 cm to one side: get well clear of the line, or jump it far from its corner. One fires every 4 beats, alongside the floor waves. See [the arena note](docs/act4-arena.md).

v240 pulses the Act 4 overhead beams, perimeter spill, speaker trim and existing fill/key lights to the playing track’s beat. The blue-white/amber ambience fades smoothly, rests during breakdowns, and stays steady under reduced motion. The four speaker stacks now have clearer five-cabinet silhouettes, recessed twin drivers, perforated grilles, metal surrounds and side handles. No extra lights or combat changes.

v239 makes the Encore booth, sloped pyramid and side wings solid. Its energized stage edge warns before contact; touching it deals 4 Health at most once per second, with local lightning, a brief jelly glow, recoil, layered electrical sound and a damage receipt. This works in Walk arena and the floor-pattern fight; overview stays safe. Reset/fight restart clears the effect.

v238 makes the Encore's floor waves three times as fast (a tile every third of a beat), a new wave every 4 beats with no rests between, picked at random and never the same twice running, and no Warning tiles ahead of them: you watch the wave come. Four new waves join the ring, arc and arrow: a sweep, a closing ring, a gate with a gap and a pincer. At the track's drop, 64 beats in, two waves come at once. Each wave is one DJ's colour (the silver DJ's electric blue, the gold DJ's gold), and that DJ throws an arm up and pumps it on the beat while it plays. See [the arena note](docs/act4-arena.md).

v237 gives the Encore its first attacks in the Act 4 preview (Dev → Act 4 preview → **Fight: floor patterns**): the floor lights up in rings, arcs and arrows that travel a tile a beat to Westend's edit of "Around the World" (128 BPM, the owner's pick; an original synthesized track if it can't load), and you jump them on the beat or run to an arc's gap. Each hit takes 4 Health. See [the arena note](docs/act4-arena.md).

v236 finishes the enemy feel pass: every Elite, Boss and bug attack is now scored on the attack-feel scoreboard (none left to do). Each one has a release mark, the attacker reacting, something at the point of contact, a fading leftover and varied sound, through `juice.feel` and pooled effects. A bug hit that lands now squashes the bug, splashes jelly off you and plays a wet slap. Readability: a bug hit flashes white at most every 0.2 s (`--hit-flash-gap`), a soft ring under the jelly shows where you are in a crowd (`--crowd-ring`), and toasts sit on a dark pill. Damage, timings, ranges, Warnings and cooldowns are unchanged.

v235 makes the Encore pyramid triangles and each side wing independently lightable for future attacks. Color and brightness can be set per part or per triangle, then cleared. **Boss lights** in the Act 4 preview cycles static samples. This adds one prepared mesh and no lights or attack behavior.

v234 adds the Encore boss visual model to the Act 4 preview: a triangular LED pyramid booth, braced glowing wings, silver and gold helmeted performers, fitted suits, articulated gloves and twin DJ decks. Use **Boss close-up** to inspect it. The model has restrained idle movement and adds no lights. Combat and campaign entry are still pending. See [the arena note](docs/act4-arena.md).

v233 adds the standalone Act 4 concert arena preview: open `index.html?arena=act4`, or Dev → Act 4 preview. Explore the tiled floor, raised rear riser, suspended side speakers and amber/blue lighting. “Tile lights” shows a static lighting sample. The initial environment was followed by the v234 boss visual model; attacks and campaign transition remain pending. See [the arena note](docs/act4-arena.md).

v232 gives twelve more treasures distinct feedback: Bobby Pin, Gold Ring, Reed Stick, Sticky Note, Pen Spring, Bath Bomb, TV Remote, Fairy Lights, Glow Stick, Static Balloon, Thumbtack and Snooze Button. Bounded effects clarify real procs, contacts and recovery without changing combat rules. See [the design note](docs/treasure-effects-v232.md).

v231 gives Disco Ball, Bubble Bath, Cotton Ball, Bath Salt, Rubber Duck and Hand Mirror distinct release, contact and recovery effects with layered sounds. Cosmetics reuse bounded pools, support reduced motion, and compile during loading. Damage, cooldowns and hit rules are unchanged. See [the design and verification note](docs/treasure-effects-v231.md).

v230 gives Cat Toy Mouse, Marble, Lego Brick, Guitar Pick, Magnifying Glass and Windowsill Cactus distinct movement, contact effects and layered sounds. Reusable effect meshes, reduced motion support and loading-time shader preparation keep these signatures bounded. Combat values and hit rules are unchanged. See [the design and verification note](docs/treasure-effects-v230.md).

v229 confines new elite attacks to their own platform and clear sight of the jelly. Leaving cancels unfinished windups; released shots, lobs, wreaths, rings, balloons and jewels finish normally. Ground targets stay within the platform footprint. Damage, counts and timing values are unchanged.

v228 gives every boss a longer Dendi finish: the screen fades into a staged view, the cat walks up along a short surface-checked path, pauses, raises his paw and lands a layered finishing thump. A contact flash, debris, the boss's collapse and a lingering aftermath precede a second fade back to the jelly and rewards. Gameplay waits throughout; Reduce Effects uses a shorter static finish. No combat or reward values changed.

v227 indexes scenery bounds before bug-body collision, preserving full triangle sweeps, corners, moving props and distant enemies. Elite warnings, volumes, puddles, slicks, balloons and thrown wreaths reuse prepared meshes/materials after removal. Inactive batches release model references. Attack shapes, damage, timings and movement rules are unchanged.

Gameplay stories now use reproducible random seeds and save screenshots on failure. GitHub's Game checks workflow runs the guards and every story with pinned browser/Three.js dependencies before merging.

v226 replaces the Controller's three-shot barrage with a circle, square, triangle and X charging on the floor at and around the jelly. After one second at the current elite tempo they explode together for 3 damage, with matching 6 cm high warning volumes: step clear or jump. Positions stay fixed throughout the charge, and overlapping shapes only deal damage once.

v225 keeps moving bugs on their side of walls with a body-radius sweep against the apartment's actual triangles. Retreating spiders, walking and rolling bugs, flyers, jumps, crowd separation and knockback stop or slide at walls, edges and corners, including outside the player's nearby collision list. Falling roots resolve their landing hit where their body actually lands.

This release also reduces the wake distances of the Controller to 1.1 m, Mug to 0.9 m, Kettle to 1.4 m, Soap Dispenser to 1.2 m and Cream Whipper to 1.25 m.

v223 makes small and large XP drops gold, including their glow, pickup streaks and collection flash, matching the XP bar and separating them from water splats.

v222 gives enemy deaths different motions: roaches crumple and skid, ant squads tumble apart (gone in v280: the ant crumples), flying bugs spin and flutter down, and ladybugs, millipedes and stag beetles shed a recognizable piece of their own shell. Harmless bodies last briefly with a 12-body cap; Reduce Effects skips them, burning deaths retain their ash treatment, and rewards and removal from combat still happen immediately.

v220 adds Cinder Jelly: flaming tentacle tips leave a blue-white fire trail along actual grounded movement. Each section burns for two seconds, dealing half power per second to touching bugs without stacking where paths overlap. Jumps, climbs and vents leave gaps; standing still creates no new trail. Range is 20% lower. The trail follows floor height, uses one bounded mesh, and the feet are instanced for phones. Wind's base push is also doubled from 0.3 to 0.6, preserving damage-based extra shove, Box Fan scaling and scenery collision rules.

v219 makes Box Jelly's existing tentacles three times thicker and brighter, with no extra strands. The thicker tubes and tips stay above their floor limit, including during the newer sting pullback and contact squash.

v218 reduces Controller/Mug/Kettle aggro to 1.3/1.1/1.5 m. The Controller now charges and presses its buttons, clicks on aim lock, kicks back as its barrage launches, and sheds small fading fragments when Shots end. Its rumble revs up, compresses and vibrates, then discharges through its existing 22 cm dome with a recoil, debris and a small harmless scuff. Varied mechanical charge, firing, impact and debris sounds follow the attack. Damage, attack timing, Shot speed and hit areas are retained; Reduce Effects removes the new vibration.

v217 gives jelly customization the same underwater background as the home screen, including drifting light and caustics. Live look changes stay visible, Reduce Effects freezes the water, and leaving customization restores the normal scene layers.

v216 adds elastic curved XP pickup streaks, a compact collection glow, rising chimes for continuous collection (with a fuller note for big pickups), and a pulsing XP bar. The chime chain resets after a collection gap and on restart. Feedback is grouped for crowded pickups; Reduce Effects keeps collection quiet. XP values, magnet range, movement speed and collection timing are unchanged.

v215 makes tentacle stings pull back, snap, squash at confirmed contact and recoil, with a short curved wet trace, floor droplets and layered stretch/snap/slap sounds. The existing 70 ms contact time, attack cadence, damage and knockback are retained. Evolution choices now show the selected jelly gathering energy and blooming into its new adornments in a 1.6-second underwater portrait before the next reward. Skip by button, Enter, Space or Escape; Reduce Effects uses a brief static reveal. Rebound bands reverse, Mirage separates a ghost, and Aegis assembles its shell; other adornments grow into place.

v213 adds Rebound Jelly (ordinary bubbles hit once on each outward/return leg, with 20% lower Fire rate) and Mirage Jelly (3-second copies attract nearby bugs every 8 seconds spent moving, with 15% less maximum Health). Returning bubbles seek your current position; existing projectiles, locked attacks, Elites and bosses still threaten the real jelly. Rebound adds reversing light bands; Mirage adds an iridescent rim and a fading copy of your own design.

v212 adds Aegis Jelly: an energy shield absorbs 10 damage, bursts for a flat 10 damage within 20 cm when depleted, and fully recharges 8 seconds after breaking. Overflow reaches Health; a partial shield does not refill. Its shell and evolution cooldown icon show when protection is available.

v210 welcomes a returning player back by their leaderboard name, over their jelly on the main menu ("Welcome back, …"), and lays the framework for earned cosmetics: a score entry now carries the player's whole look, not just their species — the Worker keeps it (sanitized to the descriptor's own keys) and hands it back with every row, so a board row can draw the actual jelly it belongs to. Which creator options are earned is data in `src/cosmetics.js`, keyed by the same option ids the look uses and judged against the player's best run (a win, a best score, a level, kills); the registry ships empty, so nothing is locked yet, and a look already being worn never becomes invalid.

v209 applies the updated level-up amounts, rarity chances, XP curve and elite pace, wake distances and attack counts. Bubbles is removed from level-up offers; a card with weight=0 in content/levelups.kdl is disabled.

v208 fits every eye and mouth combination onto its jelly's curved head. Faces follow the bell's swimming pulse, and sleepy eyelids no longer show an eye highlight.

v207 centers the menu controls beneath the jelly in tall desktop windows. The portrait column fills the viewport instead of shrinking against the left edge.

v206 groups rapid direct hits on each enemy into one damage number per short burst. Later bursts reuse that label, mixed attacks use a neutral color, and any crit keeps its marker. Ongoing damage ticks stay separate. Damage calculations are unchanged.

v205 gives the main menu a living portrait of your saved jelly in shimmery underwater light. Tap the jelly to squish it, choose Change your look beneath it, and Play transitions into the apartment. Reduce Effects quiets the motion, and pause/resume stays compact. An isolated study is available at `menu-preview.html`.

v204 damage numbers: explicit crit markers and six element colors/motion styles. Burn and acid ticks group per target within a fixed window, separate from direct hits. Pooled text has separate trajectories, sheds accents in crowds and honors Reduce Effects. Bosses and elites receive the same confirmed hit metadata. Damage and crit rules are unchanged.

v203 no more giant white circles: the ring a dying bug leaves was pure white and 3x its size (28 cm for a
stag beetle, round you on every kill in act 3); it's now a soft blue and at most 8 cm round.

v202 Act 3 gets sturdier (owner's Tuner pass): the Coffer, the Bull and the Alligator all go to
800 Health (the Coffer also aggros from further, its accordion reaches 80 cm and its jewel
Warnings are twice as wide), and the bedroom bugs toughen — dragonfly 85, stag beetle 210,
wasp nest 250, wasp 40, mantis 200, horsehair worm 150 with a 42 cm whip.

v201 dragonflies come down after you: one over the bed (or anywhere above you) used to only climb
once you dropped to the floor; now it heads back down toward you, slipping past the bed's edge.

v200 phones stop paying for the glass: the coffee table and side table tops are the dearest
material in the game on a touch GPU (a clearcoat is a second specular lobe priced against every
lamp), so on a phone the apartment's glass loads without its clearcoat and a little rougher —
same see-through tinted look, most of the per-pixel cost gone. Desktops keep the full glass.

v199 no more whole black frames: when the frame governor changed the pixel ratio it did so after
drawing, and resizing the canvas cleared that frame; the change now goes in before the frame is drawn.

v197 acid is juicier: a sloshing, dripping, fuming glob; a hit splashes a crown of drops with sizzle
smoke; the puddle is a living pool (a wobbly glowing edge, ripples, blisters swelling and popping, fumes)
that splats in, bites bugs in it with a green sizzle and visibly dries up as it ends. Small damage ticks
show as 0.4 instead of 0. No numbers changed.

v196 the Clog fight is livelier: it bounds after you in squashing hops, bumping into it is a heavy wet
slam (3, thrown back, tangled, a big shake), and it has two new attacks with set dodges: pinball (three
leaps that slam where you were, then a ring wave to jump) and comb (hair curtains in alternating lanes:
step into the lane that just struck). Its lash, snare and roll crash now shake the screen.

v193 lightning's recorded sounds are about 8 dB quieter (they stacked louder than the fireball).

v192 lightning plays recorded strikes (Hove Audio's Lightning Magic): a crackling launch, a strike on
each hit, a heavier strike with thunder when the chain jumps to 2+ bugs, and a short zap per jump
climbing in pitch, several takes each played in turn; lightning-sounds.html plays them all.

v191 lightning really crackles: chain bolts flicker and re-strike in new jagged shapes (white
core, yellow halo, tapered, forked) only to bugs they really hit, each jump's zap climbing in pitch;
a hit flashes white with forks, sparks and a scorch, a crack and a rumble of thunder; the ball spits
arcs as it flies, and stunned bugs crackle with little arcs. No numbers changed.

v190 the Elements hit harder to the eye and ear: each gathers at the bell before it fires, the
bell squeezes as it leaves with a launch flash and sound, and each lands its own way (lightning
forks and tapered chain bolts, ice shards and frost, acid droplets, glitter confetti and twinkles)
with its own layered hit sound; stunned bugs crackle while the stun lasts. No numbers changed.

v189 the stag beetle's ball is bigger and explodes where it lands: a fireball, shock rings,
lightning and sparks, 3 and a shove to anything of the jelly within 7 cm.

v187 act 3 stag beetles (iridescent green-black): from 1:00, slow tanks about 3x the jelly that charge an
electric ball between their mandibles for 1 s and fire it; step aside once the
aim locks.

v186 player HUD Health: immediate damage with a delayed coral loss trail, capped
jelly recoil, one grouped change number, mint healing feedback, a liquid fill
edge, and a slow low-health border pulse with a warning icon. Passive regen is
quiet and preserves the damage trail. Reduce Effects keeps the information and
removes motion/pulsing. Boss/elite bars and combat numbers are unchanged.

v184 Pothos: its heart and canopy sway continuously and leaves ripple along the
vines while the pot stays seated. Recovery pauses are 0.95 s (0.35 s angry),
and the boss resumes attacking after its 1 s dragonfly summon while the shield
lasts independently. Whip/sweep warnings, 1.5 s heart openings, damage and Health
are unchanged. Sweeps now flash at confirmed contact.
Wind (v220): doubled its base push from 2.1 cm to 4.2 cm. Damage-based extra shove
and Box Fan's 60% multiplier retain their existing rules; scenery still stops
the push and deals one equal-damage collision hit.

Sting feel (v182): the tentacle sting now completes its Attack Feel chain (7/7,
up from 4/9). The bell twitches as the tentacles whip out, each sting lands with
a small flash and the `hit` shake step, and its shove follows its damage like the
bubble's (`knockFor`: a base 4-damage sting shoves 4 mm, it was a flat 8 mm).
Story `attack/sting-feel`.

v181 wind: Paper Fan gathers before releasing at half the base bubble frequency.
Fire-rate increases speed up its cadence and shorten the windup when necessary.
Pushed enemies that hit walls or scenery take an extra 100% of the wind hit's
damage, with a separate impact flash, dust and thud. Enemy contact does not
trigger this bonus. See `docs/wind-attack.md` for the attack audit and limits.

v181 ice: Freezer Pack slows enemies for 2 s; repeated hits refresh the slow
without freezing. Ice Tray extends it and Snow Globe spreads it. Freezer Burn
now doubles shard damage against already slowed enemies. Existing slow strength
is unchanged (enemies move at 55% speed).

v179 player hit feedback: landed discrete hits apply a small 0.06 m/s horizontal
knockback away from the attacker (backward fallback) and a light 0.22 shake cue.
Movement damps the nudge normally. Dodges, reflected hits and invulnerability
skip it; continuous drain retains its existing quiet behavior. This small
movement change can affect positioning near ledges; balance simulation was not run.

Bubble feel (v178), the first attack reworked to `docs/agents/attack-feel.md`: a
plain bubble's pop leaves a wet splat on the floor that fades over 2 s (`fx.splat`,
at most 24 at once, `--splat-*` in `content/look.css`); blowing one adds a soft
whoosh as it flies off; and its shove follows its damage (`knockFor` in
`src/stats.js`: 1 mm per point, up to 3 cm), so a base bubble shoves as before
while crits and giant bubbles shove further. Story `attack/bubble-feel`.

Attack feel foundation (v177): the groundwork for reworking every attack to
`docs/agents/attack-feel.md`. How hard a moment lands (screen shake and hit-stop)
is one ladder in `content/look.css` (`--feel-*`, read by `juice.feel`), from a
bubble pop up to a boss kill; Elite attack shakes snapped to its nearest step
(within 0.05). The pause menu's ✨ button turns on Reduce effects: no screen shake
and a softer hurt glow (hit-stop stays); it starts on when the device asks for
reduced motion. `src/stories/attack-audit.js` lists every attack with its
nine-row audit score, and `vocabulary/every-attack-is-audited` fails if one is missing.

Fire overhaul (v174): normal gameplay now uses the approved fire sequence and
recorded launch/flight audio. Loading starts after the first audio-unlocking tap;
failed loading falls back to synthesis. Burning deaths char, curl and shrink,
with immediate gameplay death and rewards. Damage and burn timing are unchanged.
The recording now skips its quiet lead-in and keeps a 100 ms ignition on close
hits. Launch feedback supports rapid fire with a 35 ms gate and three sustained
voices; replaced voices fade quickly. Pause/reset can bypass the minimum ignition.
Run `node tests/fire-audio.mjs` for onset, short-range, rapid-fire and reset renders.

Open `fire-sample.html` on the local server to audition
the real fireball's tapered flame, launch whoosh, contact crack and burning embers.
Use **Enable sound**, then cast a single shot or an upgraded volley. The sample
uses the same projectile and audio code as the game; fire damage, rates and burn
rules are unchanged. It is a focused training scene without the apartment or bloom.
The v172 rework ties flight audio to projectile lifetime, separates impact from
quiet burning, and adds hit recoil and a curling, shrinking burn death. See
`docs/fire-rework-research.md` for sources and the revised sequence.
Fire audio layers a pressure pulse, a rising flame rush and a deep, crackling impact;
upgraded volleys sound heavier, with small variations between casts. Both gameplay
and the sample use the owner-supplied recorded launch and flight, fading on
projectile contact or expiry, with at most three overlapping voices.
