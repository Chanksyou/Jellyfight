# Changelog

Release notes for Jelly Fight, newest first. For setup and gameplay, see the [README](README.md).

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
