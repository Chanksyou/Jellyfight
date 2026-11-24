// High-ground elites: things on the furniture that came alive, one per raised area. Each
// stands in for a real object in the room (hidden while it's alive), only fights when you come
// close, and alternates two attacks. Every attack is telegraphed on the surface first, so you
// can read it and dodge. Beating one gives a treasure pick (run.js).
//
//   controller  on the media console.
//     Button combo:   four floor symbols (one per button) fill on and around you, then go off one
//                     at a time in the order its buttons light, in low prisms: step into a spent one.
//     Rumble:         it buzzes while a red circle fills around it, then a shockwave knocks
//                     you back off the console if you're inside.
//     Arrow drop:     a pad arrow hovers a little way off you (above, to your left or right; below
//                     if you're in the air), tip pointing at you and following you; it locks, then
//                     flies the way it points and strikes where you were: step out of its way.
//   mug         on the standing desk.
//     Coffee lob:     a brown circle fills where you stand; hot coffee lands there and scalds.
//     Spill:          it tips toward you while a lane fills along the line; then it pours a wave
//                     down it: caught, you're scalded and washed along it, and scalding puddles
//                     stay on the line.
//   kettle      on the stove.
//     Steam balls:    it shakes, whistles and swells while a ball of steam boils up at its
//                     spout (nothing on the counter yet), then fires three in a row, each at where
//                     you'll be as it lands if you keep going (change direction); only then does each one's orange circle and half dome
//                     show, filling while it flies, and it bursts there in gusts of steam: keep moving.
//     Boil dry:       the lid pops off and lands on the stove away from you with a white circle
//                     round it; an orange circle and dome fill round the Kettle, then steam rolls over
//                     all of it except the lid's circle: get to the lid, or out of reach.
//   soap        on the bathroom vanity (act 2): the glass soap dispenser by the tap. The pink soap
//               inside drains as it's hurt (its level is its health).
//     Bubble trap:    it pumps up a big soap bubble and lets it go; it drifts after you (slower
//                     than you swim) with a pink circle under it. Shoot it and it pops. One that
//                     reaches you closes round you, carries you toward the Dispenser and pops:
//                     hurt, and a slick underfoot (soap takes away your grip, so you slide).
//     Bubble ring:    it foams up while a pink ring fills around it, then lets go rings of foam
//                     columns drifting outward, each too tall to jump or duck, with one gap to
//                     slip through.
//     Under its angry threshold: two bubble traps, quicker, and five rings, each gap somewhere else.
//   clock       the ornate wall clock over the hallway's cubby bench (act 2; clock-model.js). It
//               hangs on the wall; when you come onto the bench it slides down the wall to fight
//               you there (its bearded mask is its face and the place to hit), and goes back up
//               when you leave or beat it. Its hands keep real time.
//     Sweeping hands: a half-circle fills on the bench, with a low volume (2 cm) over it, while
//                     its hands spin, then a golden hand sweeps right across it: jump it, or be in
//                     a far corner of the bench.
//     Victory's wreath: Victory raises her laurel wreath while a line on the bench shows where
//                     she'll throw it and a second line from her hand shows the height (the
//                     jelly's middle, mid-jump included; both lock halfway); then it's a Shot out
//                     along that line and back: be above, below or beside it.
//     Telling the time (angry only): three times its hands snap to a time, and a wedge fills on
//                     the bench under each hand; on the chime both strike: stand between them.
//   whipper     the cream whipper and its N2O cylinder on the hall floor by the front door (act 2;
//               whipper-model.js). The cylinder has the face; the gauges' needles swing as it works.
//     Balloon:        it blows a balloon up on its nozzle (a hiss, the gauges climbing), lets it go,
//                     and the balloon drifts after you for 3 s with its Warning, a circle on the
//                     floor and a sphere round it showing how far its burst reaches, filling and
//                     blinking faster, then bursts: a whole-sphere Blast round it. Caught in it
//                     (beside, under or level): 2, and all the sound goes deep and muffled for 5 s
//                     (sfx.js deepen), easing back to normal after.
//     Piping:         its nozzle follows you while your wake glows behind you (a strip on the floor
//                     and the low ridge of cream over it); then a stream of cream lays a star-ridged
//                     bead exactly along the path you swam, 0.8 s behind you, for 3.5 s. The bead
//                     (4 cm, jump it) stays 4 s, then sags and fades. Touch it, or stand still till
//                     the stream catches you: 3, and the cream slows you. Keep moving, don't double back.
//     Under 65% Health it's angry: more balloons each time, and it pipes longer (5 s, the bead stays 6 s).
//   croc        the plush alligator on the pillows at the head of the bed (act 3; croc-model.js),
//               standing in for the real plush. It sleeps (eyes shut, breathing) until you're on
//               the bed (stage3.js `wake`), then turns to face you and fights; leave the bed and it
//               settles back. Its numbers, radii and timings are all in content/elites.kdl.
//     Frost volley:   its mouth opens while three Warnings (a circle, a half sphere over it) fill in
//                     a fan round you; then three fast frost balls fly there one after another,
//                     from one end of the fan, and burst as Blasts that also slow you: outpace it.
//     Tail slam:      it turns its back on you and slams its tail 3 to 5 times in a rhythm picked
//                     afresh each time, a small ring Warning filling at the tail before each slam;
//                     each slam sends a thick ring wall rolling out over the bed: jump it.
//     Pounce:         it crouches while a Warning fills where you are, following you until it
//                     locks; then it leaps there and lands as a Blast round itself: move after the
//                     lock. It stays where it landed till you leave the bed, then walks home.
//     Under 65% Health it's angry: five frost balls, 4 to 6 slams, quicker windups.
//   bull        the red plush bull on the changing table (act 3; bull-model.js): the dresser on the
//               bedroom's north wall. It sleeps until you're on the table top (stage3.js `wake`),
//               then fights there; leave and it settles back. Its numbers are in content/elites.kdl.
//     Bull rush:      its horns swell and glow while it stamps and lowers its head, and a lane
//                     Warning (too tall to jump) fills from it through you to the table's edge;
//                     then it charges down it: sidestep. It stands dizzy at the edge (hit it), then
//                     walks home.
//     Spiral:         a Warning circle fills round it, then it spins, firing red Shots out along two
//                     arms that wind into a spiral; one arm flies at floor level (jump it), the
//                     other at jump height (stay down).
//     Little bulls:   two little bulls, jelly-sized, pop up just left and right of you, each with a
//                     lane Warning through where you are; then they charge along it and burst on
//                     you, on each other, or at the lane's end or the table's edge: jump them.
//     Under 65% Health it's angry: bigger horns and a quicker rush, three spiral arms turning
//     faster, quicker little bulls.
//   coffer      the Latticework Coffer, a mimic box on the vanity desk (act 3; coffer-model.js),
//               standing in for the inlaid wooden box there. It sleeps as a plain shut box until
//               you're on the desk top, then opens its amber eyes, rises on its legs and fights;
//               leave and it settles back. Its numbers, radii and timings are in content/elites.kdl.
//     Accordion:      five strikes in a row: each aims where you are (80 cm from it at most), a
//                     Warning (a circle, the half sphere over it) fills there, sliding with you
//                     until it locks, while the lid shoots out on its stretching bellows, then the
//                     lid slams down there as a Blast: dodge after the lock.
//     Tongue:         its mouth opens and the tongue latches onto you: no Warning, it can't miss
//                     (docs/adr/0001). For 4 s it pulls you toward its mouth (this.pull, which the
//                     run adds to your swimming) faster than base move speed; reach the mouth and
//                     you're bitten and thrown back out.
//     Jewels:         jewels shoot up off its lid out of sight while Warnings fill on random spots
//                     spread over the desk; then they fall onto them and burst as Blasts.
//     Under 65% Health it's angry: quicker strikes, a harder pull, more jewels.
//   bowl        the Singing Bowl on the lounge chair (act 4's living room; bowl-model.js), standing in
//               for the real bowl there, on its cushion with its striker. It keeps the song's time:
//               every strike and hum lands on a beat (the run's beat, `beat`), so its numbers in
//               content/elites.kdl are in beats.
//     Rim ring:       the striker lifts over the rim while a Warning (a disc round the bowl and the low
//                     ring wall over it) fills; on the bar it strikes and a thin, low ring wall rolls
//                     out across the seat: jump it. One a bar. Reaching its reach it holds, dim, for
//                     a couple of beats, then rolls back in to the bowl as bright as it left: jump it again.
//     Hum:            the striker runs round the rim and its song swells while a Warning (a rectangle
//                     over the whole seat (stage4.js `seat`), and the slab over it) fills everywhere but a
//                     white safe circle round the bowl; on the bar the sound hits all of the seat outside
//                     that circle, over a jump too: swim in close (where the rings' echo catches you).
//     Under 65% Health it's angry: two rings a bar, the second faster.
//   pillow      the Mushroom Pillow on the sofa (act 4's living room; pillow-model.js), standing in for
//               the real pillow there. It keeps the song's time too (its numbers are in beats).
//     Spores:         its cap breathes in, its spots glowing, then puffs spores that drift over the
//                     seat (one onto where you are) and settle as marked spots (a circle and the
//                     column over it); they flash for a beat, then burst on the bar as columns that
//                     hit all the way up over a jump: step off the spot, a jump doesn't clear it.
//     Fairy ring:     its cap breathes in while a circle follows you, then eight caps sprout in a ring
//                     round where you stand; they flash for a beat, then burst as columns over a
//                     jump too. Hold still in the middle; run and you cross a column.
//     Under 65% Health it's angry: more spores, settling faster, and a second Fairy ring where you'd flee.
//   headphones  the Headphones on the kitchen counter by the stove (act 4's living room; headphones-model.js),
//               standing in for the real pair on the coffee table, up on their two ear cups like a
//               pair of speakers. It keeps the song's time too (its numbers are in beats). The counter
//               ends at a drop: falling off is the punishment (back up by the vent by the stove).
//     Shove waves:    its cups take turns, one a bar: the cup's speaker lights white while a white
//                     Warning (a strip from it through you to the table's edge and the low lane over
//                     it) fills, following you until a beat before; on the bar a white sound wave
//                     rolls down it. It doesn't hurt: it shoves you along it, toward the edge. Jump it
//                     to stay put, step out of it, or ride it if there's room behind you.
//     Stereo:         a line down the counter through the Headphones splits its ground into two halves, one
//                     per cup. A cup lights up and marks its half (a floor square and the slab over it, each
//                     half in its own colour) filling to the beat; then that half bursts: cross to the
//                     other half on the beat. The first half is the one you stand on.
//     Under 65% Health it's angry: more bursts, and a beat after each the cup that burst sends a shove
//                     wave at you across the line: jump it, or be shoved deeper into the half about to burst.
//
// To the rest of the game each elite is a "proxy" enemy (enemies.addProxy), so bubbles,
// tentacles, treasures and the minimap treat it like any other target.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { angryEyes, standOut } from './enemies.js';
import { LOOK } from './look.js';
import { followLite } from './lite-materials.js';
import { juice } from './juice.js';
import { sfx, deepen } from './sfx.js';
import { bus, PLAYER } from './events.js';
import { CONTENT } from './content.js';
import { hostile, TeleMaterial, VolumeMaterial, volumeGeometry, FLOOR_SHAPES, floorShapeGeometry, floorShapeHits, blastHits, coneHits, coneVolume, laneHits, shotHits, ringHits, shotTarget, SHOT_HEIGHT } from './vfx.js';
import { buildClock, CLOCK } from './clock-model.js';
import { buildWhipper, buildBalloon } from './whipper-model.js';
import { buildCroc } from './croc-model.js';
import { buildBull, buildMiniBull } from './bull-model.js';
import { buildCoffer, COFFER } from './coffer-model.js';
import { buildBowl } from './bowl-model.js';
import { buildPillow } from './pillow-model.js';
import { buildHeadphones } from './headphones-model.js';

// every elite's attacks, in the order it takes them (e.attack is the index); the clock strikes the
// hour (its last) only once it's angry. The stories check each one's Warning (attacks/…, act2/attacks-…)
export const ATTACKS = {
  controller: ['barrage', 'rumble', 'arrow'], mug: ['coffee', 'spill'], kettle: ['steam-ball', 'boil-dry'],
  soap: ['bubble-trap', 'bubble-ring'], clock: ['sweep', 'wreath', 'hour'], whipper: ['balloon', 'piping'],
  croc: ['volley', 'tail-slam', 'pounce'], bull: ['rush', 'spiral', 'minis'], coffer: ['accordion', 'tongue', 'jewels'],
  bowl: ['ring', 'hum'], pillow: ['spores', 'fairy'], headphones: ['shove', 'stereo'],
};

const DOWN = new THREE.Vector3(0, -1, 0);
// Arrow drop: the pad arrow (a flat slab, its tip on +y) and the four it can be: the way each flies
const ARROW_OUTLINE = [[0, 1], [0.9, 0.1], [0.35, 0.1], [0.35, -1], [-0.35, -1], [-0.35, 0.1], [-0.9, 0.1]];
const ARROW_DIRS = ['down', 'left', 'right', 'up'];   // 'up' only once you are in the air

// the Cream Whipper's Piping: how often it notes where you swam (s), and the bead's piece: a
// star-ridged prism standing on y = 0 (2 tall, 2 wide), from z = 0 to 1; scale (R, R, length)
const PIPE_STEP = 0.12;
// the first snap= beats line (default 4: a bar) at or after beat `at`: act 4 Elites time their hits to it
const flat2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const snapUp = (at, snap = 4) => Math.ceil(at / snap) * snap;
function beadGeometry(points = 8) {
  const star = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const a = Math.PI * i / points, r = i % 2 ? 0.72 : 1;
    star[i ? 'lineTo' : 'moveTo'](Math.sin(a) * r, 1 + Math.cos(a) * r);
  }
  return new THREE.ExtrudeGeometry(star, { depth: 1, bevelEnabled: false });
}

// the Wall Clock's wreath as Victory throws it: a glowing copy of the one in her hand
function thrownWreath(wreath) {
  const m = wreath.clone(true);
  m.visible = true;                                                    // (the one in her hand was just hidden)
  m.scale.setScalar(LOOK.num('wreath-scale', 3.2));                  // bigger than life, so you can see it coming
  m.rotation.set(Math.PI / 2, 0, 0);                                 // flat, spinning like a thrown ring
  const gold = LOOK.color('wreath-color', '#e0b048'), glowK = LOOK.num('wreath-glow', 1.1);
  m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set(gold); o.material.emissive = hostile('clock').clone(); o.material.emissiveIntensity = glowK; o.material.toneMapped = false; } });
  return m;
}
const UP = new THREE.Vector3(0, 1, 0);
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, ...o });
const glow = (color, k = 1.5) => std(color, { emissive: color, emissiveIntensity: k });
const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

// ------------------------------------------------------------------ models (meters, facing +z)
function controllerModel() {
  const g = new THREE.Group();
  const shell = std(0x2a2a32, { roughness: 0.35 }), dark = std(0x151518), grip = std(0x1c1c22, { roughness: 0.9 });
  add(g, new RoundedBoxGeometry(0.11, 0.024, 0.055, 4, 0.011), shell, 0, 0.014, 0);
  for (const s of [-1, 1]) {
    const gp = add(g, new THREE.CapsuleGeometry(0.013, 0.03, 4, 12), grip, s * 0.04, 0.012, -0.03);   // textured grips
    gp.rotation.x = Math.PI / 2 - 0.5; gp.rotation.z = s * 0.35;
    add(g, new RoundedBoxGeometry(0.026, 0.008, 0.01, 2, 0.003), dark, s * 0.034, 0.024, 0.029);        // bumpers
    const tr = add(g, new RoundedBoxGeometry(0.022, 0.012, 0.014, 2, 0.004), dark, s * 0.034, 0.018, 0.036); // triggers
    tr.rotation.x = -0.4;
  }
  const buttons = [];
  const btn = (c, x, z) => { const b = add(g, new THREE.SphereGeometry(0.0045, 12, 8), glow(c, 0.5), x, 0.027, z); b.scale.y = 0.5; buttons.push(b); };
  btn(0x3ad86a, 0.03, 0.006); btn(0xd83a3a, 0.038, -0.002); btn(0x3a8ad8, 0.022, -0.002); btn(0xf2c81a, 0.03, -0.01);
  for (const [w, d] of [[0.016, 0.005], [0.005, 0.016]]) add(g, new THREE.BoxGeometry(w, 0.004, d), dark, -0.03, 0.027, -0.002);
  for (const x of [-0.013, 0.013]) {
    add(g, new THREE.CylinderGeometry(0.006, 0.007, 0.006, 14), dark, x, 0.028, -0.014);
    add(g, new THREE.TorusGeometry(0.0055, 0.0012, 6, 16), std(0x3a3a44), x, 0.0315, -0.014).rotation.x = Math.PI / 2;
  }
  add(g, new THREE.CylinderGeometry(0.004, 0.004, 0.002, 16), glow(0xffffff, 1), 0, 0.0265, 0.008);    // home button
  // light bar along the front edge: blue at rest, flashing red when it's about to rumble
  const barMat = glow(0x3a8aff, 2);
  add(g, new THREE.BoxGeometry(0.05, 0.004, 0.004), barMat, 0, 0.02, 0.029);
  // the cable trailing off the back
  add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.02, -0.03), new THREE.Vector3(0.01, 0.01, -0.07), new THREE.Vector3(-0.02, 0.003, -0.12), new THREE.Vector3(0.03, 0.002, -0.17)]), 16, 0.002, 5), dark);
  const face = angryEyes({ y: 0, z: 0, size: 0.3, gap: 0.42, glow: true });
  face.scale.setScalar(0.03);
  face.position.set(0, 0.03, -0.02);
  face.rotation.x = -0.9;
  g.add(face);
  return { group: g, muzzle: new THREE.Vector3(0, 0.03, 0.03), r: 0.05, buttons, barMat };
}

// ------------------------------------------------------------------ the Mug
// Modelled on the real desk mug (Chandan's photo, 2026-10-13): cream glaze, sage-green
// inside, a flared lip, a handle that ends in a ball, and its painted artwork — a frog,
// fly agarics, ladybirds, sparkles, little flowers — raised as relief instead of paint.
// Body, handle and artwork are merged into ONE vertex-coloured mesh (the critters.js
// pattern): one draw call, and the camera fade still takes the mug as a single object.
// shortcut: no coaster from the photo — the Spill tips the whole model group, so a
// coaster glued to the base would tip with it and float mid-pour.
// The lathe profile runs up the outside, over the rim and down the inside to under the
// coffee, so the wall has real thickness and the inside can wear its own colour.
const MUG_PROFILE = [[0, 0.001], [0.028, 0.001], [0.0315, 0.003], [0.0342, 0.01], [0.035, 0.03], [0.0347, 0.05], [0.0356, 0.068], [0.0378, 0.08], [0.0392, 0.086], [0.0386, 0.0885], [0.0358, 0.0875], [0.0346, 0.078], [0.0342, 0.072], [0, 0.07]];
const MUG_WALL = [[0.003, 0.0315], [0.01, 0.0342], [0.03, 0.035], [0.05, 0.0347], [0.068, 0.0356], [0.08, 0.0378]];   // outer wall radius by height
const wallR = (y) => {
  for (let i = 1; i < MUG_WALL.length; i++) if (y <= MUG_WALL[i][0]) { const [y0, r0] = MUG_WALL[i - 1], [y1, r1] = MUG_WALL[i]; return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0); }
  return MUG_WALL[MUG_WALL.length - 1][1];
};
// one flat vertex colour and no uv, so parts merge (same trick as critters.js tint,
// but each part keeps its own smooth normals — a mug is not a faceted bug)
const paint = (geo, hex) => {
  geo = geo.index ? geo.toNonIndexed() : geo;
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { a[k * 3] = c.r; a[k * 3 + 1] = c.g; a[k * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
};
const blob = (sx, sy, sz, hex, seg = 14) => paint(new THREE.SphereGeometry(1, seg, Math.max(8, Math.round(seg * 0.7))).scale(sx, sy, sz), hex);
// a part built facing +z at the origin, sunk into the wall at height y, angle theta
const relief = (geo, theta, y, sink = 0.0012) => { geo.translate(0, y, wallR(y) - sink); geo.rotateY(theta); return geo; };

function mugFrog(theta, y) {
  const G = 0x548038, GD = 0x3a5c28, parts = [];
  parts.push(relief(blob(0.0105, 0.0085, 0.0028, G), theta, y));                                                        // body
  parts.push(relief(blob(0.0075, 0.0052, 0.0026, G).translate(0, 0.008, 0.0004), theta, y));                             // head
  for (const s of [-1, 1]) {
    parts.push(relief(blob(0.0021, 0.0021, 0.0018, G).translate(s * 0.0039, 0.0118, 0.0012), theta, y));                 // eye bumps
    parts.push(relief(blob(0.0011, 0.0011, 0.0009, 0x141210).translate(s * 0.0039, 0.0126, 0.0022), theta, y));          // pupils
    parts.push(relief(blob(0.0052, 0.0034, 0.002, G).rotateZ(s * 0.5).translate(s * 0.0092, -0.0042, 0), theta, y));      // back legs
    for (const t of [-1, 0, 1]) parts.push(relief(blob(0.0026, 0.0011, 0.0011, G).rotateZ(t * 0.35).translate(s * 0.0108, -0.0088 + Math.abs(t) * -0.0008, 0.0008), theta, y));   // toes
  }
  for (const [dx, dy, dz] of [[-0.004, 0.002, 0.0024], [0.003, 0.0045, 0.0022], [0.0005, -0.003, 0.0026]]) parts.push(relief(blob(0.0012, 0.001, 0.0007, GD).translate(dx, dy, dz), theta, y));   // speckles
  return parts;
}

function mugMushroom(theta, y, s = 1) {
  const parts = [relief(paint(new THREE.CylinderGeometry(0.0016 * s, 0.0025 * s, 0.0085 * s, 10).translate(0, -0.0068 * s, -0.0004), 0xd9c3a5), theta, y)];   // stem
  parts.push(relief(blob(0.0095 * s, 0.0066 * s, 0.0031 * s, 0xb3352b), theta, y));                                      // cap
  for (const [dx, dy, dz] of [[-0.0042, 0.0028, 0.0024], [0.0038, 0.0038, 0.0021], [0.0006, 0.0008, 0.003], [-0.0018, 0.0052, 0.0016]])
    parts.push(relief(blob(0.00125 * s, 0.001 * s, 0.0007 * s, 0xf3ead8).translate(dx * s, dy * s, dz * s), theta, y));  // cap spots
  return parts;
}

function mugLadybug(theta, y, s = 1) {
  const parts = [];
  for (const w of [-1, 1]) {
    parts.push(relief(blob(0.0031 * s, 0.0042 * s, 0.0018 * s, 0xc23a24).translate(w * 0.0018 * s, 0, 0), theta, y));    // wing cases, groove between
    parts.push(relief(blob(0.00085 * s, 0.00085 * s, 0.0006 * s, 0x201a16).translate(w * 0.0028 * s, 0.0015 * s, 0.0014 * s), theta, y));
    parts.push(relief(blob(0.00085 * s, 0.00085 * s, 0.0006 * s, 0x201a16).translate(w * 0.0012 * s, -0.002 * s, 0.0015 * s), theta, y));
  }
  parts.push(relief(blob(0.0021 * s, 0.0019 * s, 0.0015 * s, 0x201a16).translate(0, 0.0046 * s, 0.0002), theta, y));      // head
  return parts;
}

function mugSparkle(theta, y, s = 1) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = i % 2 ? 0.0013 * s : 0.0044 * s, px = Math.sin(a) * r, py = Math.cos(a) * r; i ? shape.lineTo(px, py) : shape.moveTo(px, py); }
  shape.closePath();
  return relief(paint(new THREE.ExtrudeGeometry(shape, { depth: 0.0011, bevelEnabled: false }), 0x262640), theta, y, 0.0004);
}

function mugFlower(theta, y, s = 1) {
  const parts = [];
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; parts.push(relief(blob(0.0016 * s, 0.0023 * s, 0.0009 * s, 0x74513a).rotateZ(a).translate(Math.sin(a) * 0.0022 * s, Math.cos(a) * 0.0022 * s, 0), theta, y)); }
  parts.push(relief(blob(0.0013 * s, 0.0013 * s, 0.0011 * s, 0x2e2019), theta, y));
  return parts;
}

function mugModel() {
  const g = new THREE.Group();
  // the lathe body, two-tone: cream outside, sage inside. Lathe vertices run along the
  // profile within each segment, so the profile point index says which side a vertex is
  // on (the points from the inner lip onward are the inside) — normals don't: on the
  // inside leg they point away from the axis, like the outside.
  const lathe = (() => {
    const pts = MUG_PROFILE.map(([r, y]) => new THREE.Vector2(r, y));
    let geo = new THREE.LatheGeometry(pts, 64);
    const n = geo.attributes.position.count, a = new Float32Array(n * 3);
    const cream = new THREE.Color(0xf1e7d3), sage = new THREE.Color(0x7e8f74);
    for (let k = 0; k < n; k++) {
      const c = k % pts.length >= 10 ? sage : cream;
      a[k * 3] = c.r; a[k * 3 + 1] = c.g; a[k * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    geo = geo.toNonIndexed();
    if (geo.attributes.uv) geo.deleteAttribute('uv');
    return geo;
  })();
  // the handle: a tube swept out and down the wall, ending in a ball like the real one
  const handlePts = [[-0.0345, 0.066, 0], [-0.052, 0.064, 0], [-0.061, 0.052, 0], [-0.06, 0.036, 0], [-0.05, 0.024, 0], [-0.0365, 0.02, 0]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const parts = [lathe,
    paint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(handlePts), 24, 0.0052, 10), 0xf1e7d3),
    blob(0.0085, 0.008, 0.0085, 0xf1e7d3, 18).translate(-0.0365, 0.019, 0),          // the ball at the lower joint
    blob(0.0068, 0.0068, 0.0068, 0xf1e7d3, 16).translate(-0.0348, 0.066, 0),         // the upper joint
    ...mugFrog(0.62, 0.034),
    ...mugMushroom(1.8, 0.046, 1), ...mugMushroom(-1.7, 0.042, 0.72), ...mugMushroom(2.8, 0.024, 0.52), ...mugMushroom(-2.9, 0.054, 0.5),
    ...mugLadybug(1.18, 0.06, 1), ...mugLadybug(-2.35, 0.022, 0.85),
    mugSparkle(-0.3, 0.068, 1), mugSparkle(2.3, 0.06, 0.7), mugSparkle(-1.05, 0.016, 0.8), mugSparkle(3.1, 0.05, 0.6), mugSparkle(-0.5, 0.066, 0.55),
    ...mugFlower(-0.62, 0.02, 1), ...mugFlower(2.45, 0.014, 0.8),
    relief(blob(0.0058, 0.0026, 0.0006, 0x9a7648), 0.98, 0.0795, 0.0002),            // coffee stains under the rim
    relief(paint(new THREE.BoxGeometry(0.0015, 0.0075, 0.0006), 0x9a7648), 0.98, 0.0745, 0.0002),
    relief(blob(0.0042, 0.002, 0.0006, 0x9a7648), -2.55, 0.0805, 0.0002),
  ];
  add(g, mergeGeometries(parts), std(0xffffff, { vertexColors: true, roughness: 0.27, side: THREE.DoubleSide }));
  // the coffee, with its meniscus ring where it meets the wall
  const coffee = mergeGeometries([new THREE.CircleGeometry(0.0342, 40).rotateX(-Math.PI / 2).translate(0, 0.0735, 0), new THREE.TorusGeometry(0.0334, 0.0011, 8, 40).rotateX(Math.PI / 2).translate(0, 0.0735, 0)]);
  add(g, coffee, std(0x3a2214, { roughness: 0.08 }));
  // a spoon left in it
  const spoon = new THREE.Group();
  spoon.position.set(0.012, 0.07, -0.01);
  spoon.rotation.z = -0.35;
  add(spoon, new THREE.CylinderGeometry(0.0022, 0.0028, 0.07, 8), std(0xc8ccd0, { metalness: 0.9, roughness: 0.2 }), 0, 0.035, 0);
  g.add(spoon);
  const face = angryEyes({ y: 0, z: 0, size: 0.34, gap: 0.4 });
  face.scale.setScalar(0.03);
  face.position.set(0, 0.052, 0.0352);
  g.add(face);
  return { group: g, muzzle: new THREE.Vector3(0, 0.08, 0), r: 0.045 };
}

function kettleModel() {
  const g = new THREE.Group();
  const steel = std(0xd8dcdf, { metalness: 0.85, roughness: 0.18 }), black = std(0x16161a, { roughness: 0.5 });
  const pts = [[0, 0], [0.06, 0], [0.068, 0.02], [0.066, 0.06], [0.055, 0.09], [0.035, 0.105], [0.03, 0.11]].map(([r, y]) => new THREE.Vector2(r, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 36), steel));
  add(g, new THREE.CylinderGeometry(0.062, 0.064, 0.008, 36), black, 0, 0.004, 0);                         // base ring
  // water gauge window
  add(g, new RoundedBoxGeometry(0.012, 0.05, 0.004, 2, 0.002), std(0x9fd8ff, { transparent: true, opacity: 0.6, roughness: 0.05 }), 0.05, 0.045, 0.042).rotation.y = 0.9;
  const lid = new THREE.Group();
  lid.position.y = 0.112;
  add(lid, new THREE.CylinderGeometry(0.031, 0.031, 0.006, 24), steel);
  add(lid, new THREE.SphereGeometry(0.009, 12, 8), black, 0, 0.008, 0);
  g.add(lid);
  const spout = add(g, new THREE.CylinderGeometry(0.007, 0.014, 0.06, 14), steel, 0, 0.07, 0.07);
  spout.rotation.x = 0.9;
  add(g, new THREE.TorusGeometry(0.0075, 0.002, 6, 14), black, 0, 0.09, 0.093).rotation.x = 0.9 - Math.PI / 2;   // spout tip
  const handle = add(g, new THREE.TorusGeometry(0.045, 0.007, 10, 24, Math.PI), black, 0, 0.105, 0);
  handle.rotation.y = Math.PI / 2;
  const led = add(g, new THREE.SphereGeometry(0.004, 8, 6), glow(0xff3a2a, 2), -0.05, 0.02, 0.04);
  const face = angryEyes({ y: 0, z: 0, size: 0.34, gap: 0.42 });
  face.scale.setScalar(0.04);
  face.position.set(0, 0.05, 0.066);
  g.add(face);
  return { group: g, muzzle: new THREE.Vector3(0, 0.1, 0.1), r: 0.065, lid, led };
}

// the soap dispenser's label: a pastel citrus print with its name across it
function soapLabel() {
  const c = document.createElement('canvas');
  c.width = 160; c.height = 112;
  const g = c.getContext('2d');
  g.fillStyle = '#fbf3e6'; g.fillRect(0, 0, 160, 112);
  g.strokeStyle = '#e86aa0'; g.lineWidth = 6; g.strokeRect(3, 3, 154, 106);
  const slice = (x, y, r, rind, flesh) => {
    g.fillStyle = rind; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = flesh; g.beginPath(); g.arc(x, y, r * 0.82, 0, 7); g.fill();
    g.strokeStyle = rind; g.lineWidth = 1.5;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82); g.stroke(); }
  };
  slice(28, 30, 15, '#e8b81a', '#fff2a0'); slice(132, 28, 13, '#f07a2a', '#ffc890'); slice(30, 86, 12, '#f07a2a', '#ffc890'); slice(130, 84, 15, '#e8b81a', '#fff2a0');
  g.fillStyle = '#6aa83a'; for (const [x, y, a] of [[50, 20, 0.6], [112, 40, -0.5], [48, 74, -0.4], [110, 96, 0.5]]) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 9, 4, 0, 0, 7); g.fill(); g.restore(); }
  g.fillStyle = '#c8326e'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.fillText('SOAP', 80, 64);
  g.font = '11px sans-serif'; g.fillStyle = '#8a5a6a'; g.fillText('citrus · hand wash', 80, 80);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A square glass pump bottle: thick clear glass, pink soap inside (its level shows the health
// left) with bubbles drifting up through it, a printed label, a white collar and pump with the
// nozzle out the front. The pump head presses down when it squirts. About 13 cm tall.
function soapModel() {
  const g = new THREE.Group();
  const W = 0.07, H = 0.085;
  const glass = new THREE.MeshStandardMaterial({ color: 0xdaebe7, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.1, depthWrite: false });
  const white = std(0xefefea, { roughness: 0.35 });
  add(g, new RoundedBoxGeometry(W, H, W, 4, 0.008), glass, 0, H / 2, 0).renderOrder = 2;
  add(g, new RoundedBoxGeometry(W * 0.96, 0.009, W * 0.96, 2, 0.003), std(0xcfe2de, { transparent: true, opacity: 0.65, roughness: 0.05 }), 0, 0.0045, 0);   // the thick glass base
  // the soap: a box from the base up, as tall as the soap left
  const liquidH = H * 0.8;
  const liquid = add(g, new THREE.BoxGeometry(W * 0.86, 1, W * 0.86).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xff6aa8, emissive: 0xff2a7a, emissiveIntensity: 0.5, transparent: true, opacity: 0.82, roughness: 0.12 }), 0, 0.009, 0);
  liquid.scale.y = liquidH;
  const bubs = [];
  const bubMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, roughness: 0.05, emissive: 0xffd0e4, emissiveIntensity: 0.4 });
  for (let k = 0; k < 7; k++) {
    const b = add(g, new THREE.SphereGeometry(1, 10, 8), bubMat, (Math.random() - 0.5) * W * 0.6, 0.02, (Math.random() - 0.5) * W * 0.6);
    b.scale.setScalar(0.0025 + Math.random() * 0.003);
    b.userData.rise = Math.random();
    bubs.push(b);
  }
  add(g, new THREE.PlaneGeometry(W * 0.82, H * 0.48), new THREE.MeshStandardMaterial({ map: soapLabel(), roughness: 0.6 }), 0, H * 0.4, W / 2 + 0.0008);
  // collar, stem, and the pump head with its nozzle pointing out the front
  add(g, new THREE.CylinderGeometry(0.014, 0.016, 0.012, 20), white, 0, H + 0.006, 0);
  const stem = add(g, new THREE.CylinderGeometry(0.004, 0.004, 0.024, 10), std(0xdadad6, { metalness: 0.3 }), 0, H + 0.024, 0);
  const head = new THREE.Group();
  head.position.y = H + 0.034;
  g.add(head);
  add(head, new RoundedBoxGeometry(0.03, 0.016, 0.028, 3, 0.005), white, 0, 0.008, 0);
  add(head, new THREE.CylinderGeometry(0.0042, 0.005, 0.036, 10), white, 0, 0.011, 0.026).rotation.x = Math.PI / 2;
  add(head, new THREE.SphereGeometry(0.0035, 8, 6), std(0xff6aa8, { emissive: 0xff2a7a, emissiveIntensity: 0.8 }), 0, 0.011, 0.045);   // a bead of soap at the tip
  const face = angryEyes({ y: 0, z: 0, size: 0.34, gap: 0.42 });
  face.scale.setScalar(0.034);
  face.position.set(0, H * 0.78, W / 2 + 0.002);
  g.add(face);
  return { group: g, muzzle: new THREE.Vector3(0, H + 0.045, 0.048), r: 0.05, head, headY: H + 0.034, stem, liquid, liquidH, bubs };
}

// the clock elite: the model, its hit point (the mask), its health bar over the top
function clockModel() {
  const c = buildClock();
  return { ...c, muzzle: new THREE.Vector3(0, CLOCK.maskY, 0.06), r: 0.07, hitAt: new THREE.Vector3(0, CLOCK.maskY, 0.05), barY: CLOCK.H + 0.06 };
}

// the cream whipper elite: the model, its health bar over the regulator
function whipperModel() {
  const w = buildWhipper();
  return { ...w, muzzle: new THREE.Vector3(0.09, 0.35, 0.02), r: 0.07, barY: 0.47 };
}

// the plush alligator elite (act 3; croc-model.js): its frost balls come from its mouth
function crocModel() {
  const c = buildCroc();
  c.group.updateMatrixWorld(true);
  return { ...c, muzzle: c.mouth.getWorldPosition(new THREE.Vector3()), r: 0.11, barY: 0.11, hitAt: new THREE.Vector3(0, 0.022, 0.01) };   // (barY and hitAt: in the elite's frame, unscaled)
}

// the plush bull elite (act 3; bull-model.js): its Shots come from its middle
function bullModel() {
  return { ...buildBull(), muzzle: new THREE.Vector3(0, 0.15, 0.07), r: 0.13, barY: 0.47, hitAt: new THREE.Vector3(0, 0.13, 0) };   // (barY and hitAt: in the elite's frame, unscaled)
}

// the Latticework Coffer (act 3; coffer-model.js): its tongue comes from its mouth, at its front
function cofferModel() {
  const c = buildCoffer();
  c.tongue.material.emissive.copy(hostile('coffer'));                // the tongue glows in its hostile colour
  return { ...c, muzzle: new THREE.Vector3(0, 0.05, COFFER.D / 2), r: 0.12, barY: 0.16, hitAt: new THREE.Vector3(0, 0.055, 0) };   // (barY and hitAt: in the elite's frame, unscaled)
}

// the Singing Bowl (act 4; bowl-model.js): its song gathers just over its rim
function bowlModel() {
  return { ...buildBowl(), muzzle: new THREE.Vector3(0, 0.112, 0), r: 0.07, barY: 0.17, hitAt: new THREE.Vector3(0, 0.07, 0) };   // (barY and hitAt: in the elite's frame, unscaled)
}

// the Mushroom Pillow (act 4; pillow-model.js): its spores leave from the top of its cap
function pillowModel() {
  return { ...buildPillow(), muzzle: new THREE.Vector3(0, 0.45, 0), r: 0.19, barY: 0.34, hitAt: new THREE.Vector3(0, 0.13, 0) };   // (barY and hitAt: in the elite's frame, unscaled)
}

// the Headphones (act 4; headphones-model.js): its band's top, and a mouth in each cup (model.mouths)
function headphonesModel() {
  return { ...buildHeadphones(), muzzle: new THREE.Vector3(0, 0.12, 0.02), r: 0.1, barY: 0.24, hitAt: new THREE.Vector3(0, 0.06, 0) };   // (barY and hitAt: in the elite's frame, unscaled)
}

const BALLOON = 0.15;      // the Cream Whipper's balloons: scale of the model (about 18 cm tall, 15 cm across)
export const BALLOON_MID = 0.6;   // the middle of a balloon's body above its knot, in its model's units (whipper-model.js: the body is 1.2 tall)

// What each kind is, as a model: name, size and builder. Its numbers (Health, aggro range and
// every attack's damage and counts) live in content/elites.kdl, compiled into CONTENT.elites;
// a fighting elite holds its entry (this.def) and the update loop reads it fresh each frame.
// How fast every elite fights is that file's pace: its rest between attacks runs down
// recover times as fast, and each attack (telegraph, strike, follow-through) plays tempo
// times as fast. Telegraphs stay readable: their `progress` still fills to the hit, just sooner.
const KINDS = {
  controller: { name: 'The Controller', scale: 1.5, build: controllerModel, down: 'controllerDown' },
  mug: { name: 'The Mug', build: mugModel, down: 'mugDown' },
  kettle: { name: 'The Kettle', scale: 1.2, build: kettleModel, down: 'kettleDown' },
  soap: { name: 'The Soap Dispenser', scale: 1.3, build: soapModel, down: 'soapDown' },
  clock: { name: 'The Wall Clock', wall: true, build: clockModel, down: 'clockDown' },
  whipper: { name: 'The Cream Whipper', build: whipperModel, down: 'whipperDown' },
  croc: { name: 'The Alligator', scale: 1.28, build: crocModel },
  bull: { name: 'The Bull', scale: 0.6, build: bullModel },
  coffer: { name: 'The Latticework Coffer', build: cofferModel },
  bowl: { name: 'The Singing Bowl', scale: 1.4, build: bowlModel },
  pillow: { name: 'The Mushroom Pillow', scale: 0.6, build: pillowModel },   // smaller than the 44 cm prop: life size, its cap filled the game camera
  headphones: { name: 'The Headphones', build: headphonesModel },
};
const ONE = new THREE.Vector3(1, 1, 1);
// the Wall Clock's attacks in 3D (m): the sweeping hand's volume and each chime's ring wall are this
// high over the bench (jump them); the wreath is a Shot with this hit radius, flying out in this many s
const CLOCK_HITS = { sweepH: 0.02, chimeH: 0.03, wreathRadius: 0.04, wreathFlight: 0.5 };
const NOWHERE = new THREE.Vector3(0, -99, 0);
const ELITE_WALK = 0.35;   // m/s: how fast an Elite that moved walks back to its spot
// the Headphones' sound waves: how many can roll at once, the arcs nested in each (m apart), and the
// angle each arc spans (rad); the front arc is as wide as the wave's lane
const WAVE = { pool: 3, arcs: 5, gap: 0.02, spread: 2.2 };
// the Soap Dispenser's bubble ring: each bubble is a column of foam (m over the vanity: its middle,
// half its height, its radius, and the heights its hit is tested at), too tall to jump or duck: find the gap
const SOAP_COLUMN = { mid: 0.12, half: 0.09, r: 0.016, at: [SHOT_HEIGHT.floor, 0.1, SHOT_HEIGHT.jump] };
// the Alligator: its tail pieces' pitch at rest (rad: a little up off the bed), and its tail slam's
// Warning, a circle this wide (m) where the tail lands, with the ring wall round it
const CROC_TAIL_REST = [0.08, 0.04, 0.02], CROC_SLAM_WARN = 0.05;   // where a wreath that already hit you this way (out or back) looks for the jelly

export const ELITE_NAMES = Object.fromEntries(Object.entries(KINDS).map(([k, K]) => [k, K.name]));
// the sfx that plays when a kind is beaten: its own breaking sound (`down`), else run.js plays the plain boom
export const ELITE_DOWN = Object.fromEntries(Object.entries(KINDS).filter(([, K]) => K.down).map(([k, K]) => [k, K.down]));

// ------------------------------------------------------------------ one elite
class Elite {
  constructor(owner, spec) {
    const K = KINDS[spec.kind], D = CONTENT.elites[spec.kind];
    Object.assign(this, { owner, spec, kind: spec.kind, name: K.name, aggro: D.aggro, def: D });
    this.maxHp = this.hp = Math.round(D.hp * (owner.hpScale || 1));   // later acts: tougher (stage eliteHp)
    this.dead = false;
    this.base = new THREE.Vector3(...spec.at);
    this.home = this.base.clone();       // its spot: one that moves (rush, pounce) walks back here
    const m = K.build();
    this.size = K.scale || 1;             // a bit bigger than life, so it reads from the game camera
    m.r *= this.size;
    m.muzzle.multiplyScalar(this.size);
    this.model = m;
    this.r = m.r;
    this.holder = new THREE.Group();
    this.holder.position.copy(this.base);
    if (spec.face != null) this.holder.rotation.y = spec.face;   // how it rests while it sleeps
    this.holder.add(m.group);
    if (K.wall) {
      // hung on a wall (spec.wall): it faces out from it and never turns; it comes down to fight
      const w = spec.wall;
      this.wall = w;
      this.hangY = w.y;
      this.fightY = this.base.y + 0.02;
      this.holder.position.set(w.x, w.y, w.z);
      this.holder.rotation.y = w.yaw;
    }
    standOut(m.group, { base: LOOK.num('elite-glow', 0.2), rim: LOOK.num('elite-rim', 0.6) });   // readable in the dark room
    followLite(m.group);   // Low's plain extras (lite-materials.js): it may be built after the graphics were prepared
    owner.scene.add(this.holder);
    for (const o of m.loose || []) { followLite(o); owner.scene.add(o); }   // what it sends out into the room (the Coffer's tongue and jewels), hidden till then
    // its health bar over it, facing the camera: big, outlined and drawn over everything, going
    // green -> yellow -> red as it loses health (the HUD shows it too while it fights you)
    this.bar = new THREE.Group();
    const W = 0.11, H = 0.014;
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.006, H + 0.006), new THREE.MeshBasicMaterial({ color: 0xfff2d0, depthTest: false, toneMapped: false }));
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.002, H + 0.002), new THREE.MeshBasicMaterial({ color: 0x14121a, depthTest: false }));
    this.fill = new THREE.Mesh(new THREE.PlaneGeometry(W, H).translate(W / 2, 0, 0), new THREE.MeshBasicMaterial({ color: 0x5ae05a, depthTest: false, toneMapped: false }));
    back.position.z = 0.0003;
    this.fill.position.set(-W / 2, 0, 0.0006);
    edge.renderOrder = 10; back.renderOrder = 11; this.fill.renderOrder = 12;
    this.bar.add(edge, back, this.fill);
    this.bar.position.y = m.barY ?? m.r * 2.2 + 0.03;
    this.holder.add(this.bar);
    this.t = 0;
    this.cool = 1.5;
    this.state = 'idle';
    this.next = 0;                       // which attack comes next (they alternate)
    this.hitPop = 0;
    this.tele = [];                      // telegraph meshes for the current attack
    // stand in for the real object while alive
    this.hidden = spec.hide ? owner.findObject(spec.hide) : null;
    if (this.hidden) { this.hiddenWas = this.hidden.visible; this.hidden.visible = false; }
  }

  get position() { return this.base; }
  // where bubbles aim and land (enemies.center): a hanging elite's hit point, else just above its base
  center(out = new THREE.Vector3()) {
    const h = this.model.hitAt;
    if (!h) return out.copy(this.base).setY(this.base.y + this.r);
    const c = Math.cos(this.holder.rotation.y), s = Math.sin(this.holder.rotation.y);
    return out.set(h.x * c + h.z * s, h.y, -h.x * s + h.z * c).add(this.holder.position);
  }

  // a hanging elite after it's beaten: back up on its wall as a plain clock (no face, no bar)
  retire() {
    this.clearTele();
    this.decor = true;
    this.bar.visible = false;
    if (this.model.face) this.model.face.visible = false;
    if (this.model.wreath) this.model.wreath.visible = true;
  }

  damage(amount, color = '#fff', feedback = {}) {
    if (this.dead) return;
    this.hp -= amount;
    this.hitPop = 1;
    const c = this.center();
    this.owner.fx.number(c.setY(c.y + this.r * 0.6), amount, color, 16, feedback);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  clearTele() { this.tele.forEach((m) => { this.owner.scene.remove(m); }); this.tele = []; }
  // the Mushroom Pillow's spores still out (drifting or settled): back to the pool
  dropSpores() {
    for (const s of this.spores || []) this.owner.fx.free(s.orb);
    for (const R of [this.plan?.ring, this.plan?.second]) if (R && !R.gone) for (const k of R.caps) this.owner.fx.free(k.cap);   // (and the Fairy ring's caps)
    this.spores = null;
  }

  cancelAttack() {
    this.clearTele();
    if (this.inflating) { this.owner.scene.remove(this.inflating.group); this.inflating = null; }
    if (this.blowing) { this.blowing.dead = true; this.blowing = null; }   // a bubble trap still on the nozzle
    this.owner.blobs = this.owner.blobs.filter(b => {
      if (b.owner !== this || b.t >= b.wait) return true;
      this.owner.fx.free(b.m); this.owner.scene.remove(b.warn); if (b.vol) this.owner.scene.remove(b.vol);
      return false;
    });
    for (const b of this.minis || []) if (b.state === 'warn') { b.done = true; this.owner.scene.remove(b.m); }
    // These are local windup/choreography fields. Released attacks live in the manager and continue.
    for (const key of ['aim','beam','blasted','burst','chimed','combo','struck','washed','spillDir','hours','round','blowing','lidFly','lane','dizzyT','pounceAt','pounceFrom','creamed','pipe','fired','arrowDir','arrowAt','arrowAir','arrowSide','arrowMesh','arrowT','gems','hissed','landed','lash','launched','leapt','minis','popped','poured','rained','rhythm','rings','rushed','slams','spots','sprayed','squirted','stamped','strike','swept','threw','thrown','volleyed','strikes','struckN','humAt','humDone','fromBeat','turn','beatWas']) delete this[key];
    for (const o of this.model.loose || []) o.visible = false;
    if (this.model.wreath) this.model.wreath.visible = !this.owner.thrown.some(w => w.owner === this);
    if (this.model.lever) this.model.lever.rotation.z = 0;
    if (this.model.whip) this.model.whip.rotation.x = 0;
    if (this.kind === 'whipper' && this.owner.stream) this.owner.stream.visible = false;   // its stream of cream (its bead stays)
    if (this.model.needles) this.model.needles.forEach(n => { n.rotation.z = 1.2; });
    if (this.kind === 'clock') this.spin = 0;
    if (this.kind === 'kettle' && this.lidFly) { this.owner.scene.remove(this.lidFly.lid); this.model.lid.visible = true; this.lidFly = null; }
    if (this.kind === 'kettle') { this.model.lid.position.y = 0.112; this.model.led.material.emissiveIntensity = 2; this.owner.fx.free(this.ball); this.ball = null; this.flights = []; this.bursts = []; this.sinceShot = null; }
    if (this.kind === 'bowl') { this.model.pose('rest'); this.charge = 0; }
    if (this.kind === 'pillow') { this.dropSpores(); this.holder.position.copy(this.base); this.plan = null; this.charge = 0; }   // 
    if (this.kind === 'headphones') { this.plan = null; this.lit = [0, 0]; }
    if (this.kind === 'soap') {
      const M = this.model;
      M.head.position.y = M.headY; M.stem.scale.y = 1; M.stem.position.y = M.headY - 0.012;
    }
    this.model.group.rotation.set(0,0,0);
    this.state = 'idle'; this.stateT = 0; this.locked = false; this.cool = 0;
  }

  remove() {
    this.clearTele();
    this.owner.fx.free(this.ball);   // the Kettle's steam ball, still charging
    if (this.kind === 'whipper' && this.owner.stream) this.owner.stream.visible = false;
    this.dropSpores();               // the Mushroom Pillow's, still drifting
    if (this.inflating) { this.owner.scene.remove(this.inflating.group); this.inflating = null; }   // a balloon half blown up
    this.owner.scene.remove(this.holder);
    for (const o of this.model.loose || []) this.owner.scene.remove(o);
    if (this.hidden) this.hidden.visible = this.hiddenWas;   // back as it was (it may be hidden in the layout)
  }
}

// ------------------------------------------------------------------ manager
export class Elites {
  constructor(scene, enemies, fx, world, camera, apartmentRoot) {
    Object.assign(this, { scene, enemies, fx, world, camera, root: apartmentRoot });
    this.list = [];
    this.bullets = [];
    this.controllerPulses = [];
    this.warningPool = []; this.volumePool = [];
    this.puddleMeshes = []; this.slickMeshes = [];
    this.balloonPool = []; this.wreathPool = [];
    this.blobs = [];
    this.steams = [];        // the Kettle's steam ball bursting (steamBurst)
    this.puddles = [];
    this.decor = [];         // things that only hang there (the hall clock when it isn't fighting)
    this.decorSpecs = [];    // set by the run: this act's decor (stage.decor)
    this.thrown = [];        // the clock's wreath in flight
    this.balloons = [];      // the Cream Whipper's balloons, drifting after you
    this.beads = []; this.beadFree = [];   // and the pieces of cream it pipes along your path (fx pieces: drawn instanced, the bits' shader)
    this.stream = null;      // and the stream it pipes them with (one fx piece, made the first time)
    this.beadGeo = beadGeometry();
    this.streamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);   // along +z, 0 to 1
    this._beadDir = new THREE.Vector3(); this._beadAt = new THREE.Vector3();
    this.rings = [];         // and its rings rolling out (the clock's chimes, the Singing Bowl's rim rings)
    this.halfGeo = new THREE.CircleGeometry(1, 48, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2);   // a half circle pointing +z
    this.ringMat = new THREE.MeshBasicMaterial({ color: hostile('clock').clone().multiplyScalar(1.6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, forceSinglePass: true });
    this.ringMats = {};      // the ring walls' bands, one per hostile colour (all one program: ringMat's)
    this.bandGeo = new THREE.RingGeometry(0.5, 1, 64, 1).rotateX(-Math.PI / 2);   // a thick band (ring()): each copy's inner edge moves
    this._probe = new THREE.Vector3(); this._ringAt = new THREE.Vector3(); this._glowAt = new THREE.Vector3();   // scratch for the rings
    this.soapBubbles = [];   // the Soap Dispenser's bubble rings, drifting outward
    this.traps = [];         // the Soap Dispenser's bubble traps, drifting after you
    this.slicks = [];        // and the slippery soap its squirts leave
    this._dir = new THREE.Vector3();   // scratch for the bubbles' wall raycasts
    this.bubbleGeo = new THREE.SphereGeometry(1, 16, 12);
    this.bubbleMat = new THREE.MeshStandardMaterial({ color: 0xffe0ee, transparent: true, opacity: 0.4, roughness: 0.02, metalness: 0.3, emissive: 0xff4a9a, emissiveIntensity: 0.35, depthWrite: false });
    this.soapMat = new THREE.MeshStandardMaterial({ color: 0xffb8d4, transparent: true, opacity: 0.75, roughness: 0.05, emissive: 0xff4a9a, emissiveIntensity: 0.25 });
    // projectiles are glowing orbs (fx.orb) in each elite's hostile colour (vfx.js, look.css)
    this.coffeeMat = std(0x3a2214, { roughness: 0.08 });
    this.flat = new THREE.CircleGeometry(1, 36).rotateX(-Math.PI / 2);
    this.arrowGeo = new THREE.ExtrudeGeometry(new THREE.Shape(ARROW_OUTLINE.map(([x, y]) => new THREE.Vector2(x, y))), { depth: 0.3, bevelEnabled: false }).translate(0, 0, -0.15);
    this.arrowMat = std(0x2a2a30, { roughness: 0.4, emissive: hostile('controller'), emissiveIntensity: 1.2 });
    this.ringGeo = new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2);
    this.stripGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
    // a 50° wedge pointing +z (Circle geometry's sector starts at +x, so rotate it round)
    this.coneGeo = new THREE.CircleGeometry(1, 24, -0.45, 0.9).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2);
    // floor warnings (vfx.js): outline, a fill that grows to the hit, stripes toward where it lands
    this.T = {
      brown: new TeleMaterial(hostile('mug'), 'strip'), red: new TeleMaterial(hostile('controller')), orange: new TeleMaterial(hostile('kettle')),
      mugCircle: new TeleMaterial(hostile('mug')),
      symbols: FLOOR_SHAPES.map(shape => new TeleMaterial(hostile('controller'), shape)),
      puddle: new TeleMaterial(hostile('mug')),
      soap: new TeleMaterial(hostile('soap')), soapRing: new TeleMaterial(hostile('soap')), slick: new TeleMaterial(hostile('soap')),
      blast: new TeleMaterial(hostile('whipper')), pipe: new TeleMaterial(hostile('whipper'), 'strip'),
      sweep: new TeleMaterial(hostile('clock'), 'wedge', Math.PI / 2), beam: new TeleMaterial(hostile('clock'), 'strip'), wreath: new TeleMaterial(hostile('clock'), 'strip'), chime: new TeleMaterial(hostile('clock')),
      frost: new TeleMaterial(hostile('croc')), frostRing: new TeleMaterial(hostile('croc')), pounce: new TeleMaterial(hostile('croc')),
      rush: new TeleMaterial(hostile('bull')), spiral: new TeleMaterial(hostile('bull')), lane: new TeleMaterial(hostile('bull'), 'strip'),
      coffer: new TeleMaterial(hostile('coffer')),
      bowl: new TeleMaterial(hostile('bowl')), bowlSeat: new TeleMaterial(hostile('bowl'), 'square'),
      pillow: new TeleMaterial(hostile('pillow')),
      shove: new TeleMaterial(LOOK.color('headphones-shove', '#f4f8ff'), 'strip'),   // a sound wave that shoves (the Headphones'): white, it doesn't hurt
      stereo: [new TeleMaterial(hostile('headphones'), 'square'), new TeleMaterial(hostile('headphones-right'), 'square')],   // the two halves' floor squares, one hostile colour each (Stereo)
      safe: new TeleMaterial(LOOK.color('safe-spot', '#ffffff')),   // the one spot an attack spares (the Kettle's lid)
      hour: new TeleMaterial(hostile('clock'), 'wedge', 0.45),
    };
    this.minis = [];         // the Bull's little bulls, charging along their lanes
    // a spiral Shot that reached the jelly leaves a little stuffing and a scuff under it
    this._scuff = new THREE.Vector3();
    this.bullShotEnd = (b, struck) => {
      if (!struck) return;
      const at = b.m.position, y = this.surfaceBelow(at);
      this.fx.burst(at, LOOK.list('bull-fluff', ['#f0d0c0', '#ffffff', '#a83a3a']), 4, 0.003, 0.2, y);
      this.fx.splat(this._scuff.set(at.x, y, at.z), LOOK.color('bull-scuff', '#6a5048'), LOOK.num('bull-shot-scuff', 0.012), 'dust');
      sfx.bullHit();
    };
    this._camEuler = new THREE.Euler(); this._right = new THREE.Vector3(); this._from = new THREE.Vector3(); this._to = new THREE.Vector3(); this._mid = new THREE.Vector3(); this._mid2 = new THREE.Vector3();   // scratch for the Bull
    // the pull on the jelly this frame (m/s, flat), or null: the Coffer's tongue. The run adds it
    // to the jelly's movement next frame, as it does a Boss's `push`
    this.pull = null;
    this._pull = new THREE.Vector3(); this._home = new THREE.Vector3(); this._mouth = new THREE.Vector3(); this._tip = new THREE.Vector3();   // scratch for the Coffer
    // the song's time, as the run keeps it (run.js keepTime): its beat now and its tempo (the Singing Bowl)
    this.beat = 0; this.bpm = 120;
    // the Hum reached the jelly: glints and a fading shimmer under it, and the bowl's thunk
    this.bowlHurt = (at) => {
      const y = this.surfaceBelow(at);
      this.fx.impact(at, hostile('bowl'), LOOK.num('bowl-hum-flash', 0.025), 8);
      this.fx.burst(at, LOOK.list('bowl-glints', ['#fff2c0', '#cba24b', '#ffffff']), 5, 0.0025, 0.2, y);
      this.fx.splat(this._scuff.set(at.x, y, at.z), LOOK.color('bowl-shimmer', '#d8c890'), LOOK.num('bowl-hum-shimmer', 0.014), 'dust');
      juice.feel('impact'); sfx.bowlHit();
    };
    this._m4 = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._eul = new THREE.Euler(); this._s3 = new THREE.Vector3();
    // the Headphones' sound waves rolling out over the counter (wave(), drawn in update): nested
    // white arcs lying flat at the height they shove up to, like the Encore's speakers'. Every arc in
    // flight is one instanced draw, always in the scene (so its shader is built with the rest)
    this.waves = []; this._dropC = new THREE.Color();
    this.waveColor = new THREE.Color(LOOK.color('headphones-shove', '#f4f8ff'));
    const spread = WAVE.spread;
    this.waveArcs = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.03, 5, 28, spread).rotateZ(-spread / 2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), WAVE.pool * WAVE.arcs);
    this.waveArcs.name = 'Headphones sound waves'; this.waveArcs.frustumCulled = false; this.waveArcs.userData.noCollide = true; this.waveArcs.renderOrder = 4;
    for (let i = 0; i < WAVE.pool * WAVE.arcs; i++) { this.waveArcs.setMatrixAt(i, this._m4.makeScale(0, 0, 0)); this.waveArcs.setColorAt(i, this.waveColor); }
    scene.add(this.waveArcs);
    // a Stereo burst that hit the jelly (at its middle): a buzz of sparks off it and a fading scuff under it
    this.buzzHurt = (at, color) => {
      const y = this.surfaceBelow(at);
      this.fx.burst(at, ['#ffffff', color], 5, 0.0025, 0.25, y);
      this.fx.splat(this._scuff.set(at.x, y, at.z), LOOK.color('headphones-scuff', '#6c6680'), LOOK.num('headphones-scuff-size', 0.014), 'dust');
      juice.feel('impact'); sfx.headphonesBassHit();
    };
  }

  // Apartment objects are named after what they are; three.js's loader swaps spaces for underscores
  findObject(name) {
    const want = THREE.PropertyBinding.sanitizeNodeName(name);
    let found = null;
    this.root.traverse((o) => { if (!found && o.name === want) found = o; });
    return found;
  }

  start(specs = []) {
    this.clear();
    for (const s of specs) {
      const e = new Elite(this, s);
      e.entry = this.enemies.addProxy(e);
      this.list.push(e);
    }
    // what only hangs there (unless it's fighting this time)
    for (const s of this.decorSpecs) if (!specs.some((q) => q.kind === s.kind)) { const d = new Elite(this, s); d.retire(); this.decor.push(d); }
  }

  clear() {
    for (const p of this.controllerPulses) this.scene.remove(p.m);
    this.controllerPulses = [];
    this.pull = null;
    this.list.forEach((e) => { e.remove(); if (e.entry) e.entry.dead = true; });
    this.list = [];
    this.decor.forEach((e) => e.remove());
    this.decor = [];
    for (const w of this.thrown) { this.scene.remove(w.m); this.fx.free(w.shot.m); }
    for (const r of this.rings) { this.scene.remove(r.m); this.scene.remove(r.vol); if (r.band) r.m.geometry.dispose(); }
    for (const b of this.balloons) { this.scene.remove(b.m); this.scene.remove(b.warn); }
    for (const b of this.beads) { b.m.visible = false; this.beadFree.push(b.m); }
    this.thrown = []; this.rings = []; this.balloons = []; this.beads = [];
    for (const b of this.minis) this.scene.remove(b.m);
    this.minis = [];
    for (const b of [...this.bullets, ...this.blobs]) { this.fx.free(b.m); if (b.warn) this.scene.remove(b.warn); if (b.vol) this.scene.remove(b.vol); }
    for (const p of [...this.puddles, ...this.slicks, ...this.soapBubbles]) this.scene.remove(p.m);
    for (const b of this.steams) { this.scene.remove(b.warn); this.scene.remove(b.vol); }
    this.steams = [];
    this.bullets = []; this.blobs = []; this.puddles = []; this.slicks = []; this.soapBubbles = [];
    for (const B of this.traps) { this.scene.remove(B.m); this.scene.remove(B.warn); B.entry.dead = true; }
    this.traps = []; this.washT = 0;
    this.waves = [];
    for (let i = 0; i < WAVE.pool * WAVE.arcs; i++) this.waveArcs.setMatrixAt(i, this._m4.makeScale(0, 0, 0));
    this.waveArcs.instanceMatrix.needsUpdate = true;
  }

  get alive() { return this.list.filter((e) => !e.dead); }

  // Show one of each projectile and telegraph so their shaders compile before play (main.js warmUp)
  warm(on, at) {
    if (on) {
      this._warm = [...[this.T.brown, this.T.red, this.T.orange, this.T.puddle, this.T.soap, this.T.sweep, this.T.beam, ...this.T.symbols].map((m) => new THREE.Mesh(this.flat, m)), new THREE.Mesh(this.arrowGeo, this.arrowMat), new THREE.Mesh(this.flat, this.coffeeMat), new THREE.Mesh(this.flat, this.soapMat), new THREE.Mesh(this.bubbleGeo, this.bubbleMat)];
      const soap = soapModel();
      soap.group.traverse((o) => { if (o.isMesh) this._warm.push(o.clone()); });   // its own materials too
      const whip = buildWhipper(), bal = buildBalloon();
      whip.group.traverse((o) => { if (o.isMesh) this._warm.push(o.clone()); });
      bal.group.traverse((o) => { if (o.isMesh) this._warm.push(o.clone()); });
      this._warm.push(new THREE.Mesh(this.flat, this.T.blast), new THREE.Mesh(this.flat, this.T.pipe));
      const clock = buildClock();
      clock.group.traverse((o) => { if (o.isMesh) this._warm.push(o.clone()); });
      thrownWreath(clock.wreath).traverse((o) => { if (o.isMesh) this._warm.push(o); });   // glowing, not tone mapped: its own program
      const croc = buildCroc();                                            // the Alligator's plush, as it stands out in the room
      standOut(croc.group, { base: LOOK.num('elite-glow', 0.2), rim: LOOK.num('elite-rim', 0.6) });
      croc.group.traverse((o) => { if (o.isMesh) this._warm.push(o.clone()); });
      const bull = buildBull();                                            // the Bull's plush (and its glowing horns), as it stands out
      standOut(bull.group, { base: LOOK.num('elite-glow', 0.2), rim: LOOK.num('elite-rim', 0.6) });
      bull.group.traverse((o) => { if (o.isMesh) this._warm.push(o.clone()); });
      const coffer = cofferModel();                                        // the Coffer's box (and its glowing eyes, its tongue and its jewels)
      standOut(coffer.group, { base: LOOK.num('elite-glow', 0.2), rim: LOOK.num('elite-rim', 0.6) });
      coffer.group.traverse((o) => { if (o.isMesh) this._warm.push(o.clone()); });
      for (const o of coffer.loose) { const c = o.clone(); c.visible = true; if (c.isInstancedMesh) c.count = 1; this._warm.push(c); }
      const bowl = buildBowl();                                            // the Singing Bowl, its cushion and striker, as they stand out
      standOut(bowl.group, { base: LOOK.num('elite-glow', 0.2), rim: LOOK.num('elite-rim', 0.6) });
      bowl.song.material.opacity = 0.5;
      bowl.group.traverse((o) => { if (o.isMesh) this._warm.push(o.clone()); });
      const pillow = buildPillow();                                        // the Mushroom Pillow, as it stands out, its spots glowing
      standOut(pillow.group, { base: LOOK.num('elite-glow', 0.2), rim: LOOK.num('elite-rim', 0.6) });
      pillow.glow.material.opacity = 0.5;
      pillow.group.traverse((o) => { if (o.isMesh) this._warm.push(o.clone()); });
      const phones = buildHeadphones();                                    // the Headphones, as they stand out, their speakers glowing
      standOut(phones.group, { base: LOOK.num('elite-glow', 0.2), rim: LOOK.num('elite-rim', 0.6) });
      for (const m of phones.glows) m.material.opacity = 0.5;
      phones.group.traverse((o) => { if (o.isMesh) this._warm.push(o.clone()); });
      this._warm.push(new THREE.Mesh(this.stripGeo, this.T.lane));
      this._warm.push(new THREE.Mesh(this.ringGeo, this.ringMat));
      this._warm.push(new THREE.Mesh(volumeGeometry('dome'), new VolumeMaterial(hostile('mug'))));   // every Warning volume shares this one program
      this._warm.forEach((m) => { m.visible = true; m.position.copy(at); m.scale.setScalar(m.geometry === this.flat ? 0.01 : 1); this.scene.add(m); });
    } else (this._warm || []).forEach((m) => this.scene.remove(m));
  }

  surfaceBelow(p) {
    const h = this.world.castAll(p.clone().setY(p.y + 0.05), DOWN, 1.5);
    return h ? h.point.y : p.y;
  }

  onPlatform(e, p) {
    const W = e.spec.wake;
    return !W || p.x >= W.min[0] && p.x <= W.max[0] && p.y >= W.min[1] && p.y <= W.max[1] && p.z >= W.min[2] && p.z <= W.max[2];
  }

  canSee(e, pc, radius) {
    const from = this._from.copy(e.model.muzzle).applyAxisAngle(UP,e.holder.rotation.y).add(e.wall ? e.holder.position : e.base);
    const delta = this._dir.copy(pc).sub(from), distance = delta.length();
    if (distance < radius) return true;
    const hit = this.world.castAll(from,delta.multiplyScalar(1/distance),distance);
    return !hit || hit.distance >= distance-radius;
  }

  platformTarget(e, at, inset = 0) {
    const W = e.spec.wake;
    if (W) for (const [axis,i] of [['x',0],['z',2]]) {
      const margin = Math.min(inset,(W.max[i]-W.min[i])/2);
      at[axis] = THREE.MathUtils.clamp(at[axis],W.min[i]+margin,W.max[i]-margin);
    }
    at.y = this.surfaceBelow(at);
    return at;
  }

  // Detached warnings are available again; reset every animated property before reuse.
  volume(color, kind, pos, scale) {
    const hex = color.isColor ? color.getHex() : new THREE.Color(color).getHex();
    let m = this.volumePool.find(m => !m.parent && m.material.kind === kind && m.material.uniforms.uColor.value.getHex() === hex);
    if (!m) { m = this.fx.volume(color, kind, pos, scale); this.volumePool.push(m); }
    else this.scene.add(m);
    m.visible = true; m.position.copy(pos); m.rotation.order = 'XYZ'; m.rotation.set(0, 0, 0);
    if (typeof scale === 'number') m.scale.setScalar(scale); else m.scale.copy(scale);
    m.material.progress = 0; m.material.opacity = 1;
    return m;
  }

  // an Elite that moves (the Bull's rush, the Alligator's pounce): its base and model go to `at`
  moveElite(e, at) { e.base.copy(at); e.base.y = this.surfaceBelow(at); e.holder.position.copy(e.base); }

  // a flat telegraph mesh on a surface
  mark(e, geo, mat, pos, scale, rotY = 0) {
    let m = this.warningPool.find(m => !m.parent && m.geometry === geo && m.userData.template === mat);
    if (!m) {
      m = new THREE.Mesh(geo, mat.clone()); m.userData.template = mat;
      this.warningPool.push(m);
    }
    m.visible = true; m.material.opacity = 1; m.material.progress = 0;
    m.rotation.order = 'XYZ'; m.rotation.set(0, 0, 0);
    m.position.copy(pos);
    m.scale.copy(scale);
    m.rotation.y = rotY;
    m.renderOrder = 3;
    this.scene.add(m);
    if (e) e.tele.push(m);
    return m;
  }

  // a warning circle that fills from the middle as the hit gets closer (k 0..1); o: how strongly
  // it shows (an attack that lays many at once keeps each one quieter)
  warnCircle(pos, r, mat, o = 1) {
    const g = this.mark(null, this.flat, mat, pos, new THREE.Vector3(r, r, r));
    g.position.y += 0.002;
    g.updateMatrixWorld(true);
    g.userData.fill = (k) => { g.material.progress = k; g.material.opacity = o * (0.85 + Math.sin(performance.now() / 60) * 0.15); };
    return g;
  }

  // lob something in an arc to `to`; a warning circle fills until it lands. dome: it lands as a
  // floor Blast of radius r, so its Warning has the half-sphere volume over the circle too.
  // arc: how high it rises on the way (m); wait: s it holds before it flies, its Warning filling
  // all along to the landing (the Alligator's frost balls); size: the orb's
  lob(from, to, T, color, warnMat, r, onLand, { dome = false, arc = 0.12, wait = 0, size = 0.007, owner = null, onLaunch = null } = {}) {
    const m = this.fx.orb(color, size);
    m.position.copy(from);
    m.visible = !wait;
    const vol = dome ? this.volume(color, 'dome', to, r) : null;
    const b = { m, warn: this.warnCircle(to, r, warnMat), vol, from: from.clone(), to: to.clone(), t: 0, T, onLand, onLaunch, arc, wait, owner };
    this.blobs.push(b);
    return b;
  }

  // the Kettle's steam ball bursting at `at`: skill.gusts gusts of steam, skill.gap s apart, each a
  // floor Blast of radius r (skill.dmg). Its circle and half dome stay up, pulsing, while gusts are
  // still coming, so what can hurt you shows exactly as long as it can
  steamBurst(at, r, skill) {
    const warn = this.warnCircle(at, r, this.T.orange), vol = this.volume(hostile('kettle'), 'dome', at, r);
    warn.userData.fill(1); vol.material.progress = 1;
    const b = { at: at.clone(), r, skill, warn, vol, t: 0, k: 0, struck: false };
    this.steams.push(b);
    return b;
  }

  // a ring wall rolling out from `at` (see the rings in update): a glowing band on the surface with
  // its volume, a 'ring' wall `h` tall (default skill.height), round it; it hits the jelly once for
  // skill.dmg (read as it hits, so live edits land) as `source`. band: how thick the band is (m,
  // the same all the way out; 0: a thin ring that widens as it goes); follow: see update
  // onHit: called the frame it catches the jelly (that attack's own contact feedback)
  // echo: at its reach it holds, dim, for this many beats of the song, then rolls back in to where it
  // started, as bright as it left, and hits again (a ring walks out and back); owner: the Elite it is
  // the attack of: it is gone when that one is dead or the jelly is off its ground
  ring(at, color, skill, source, { h = skill.height, band = 0, speed = 0.75, max = 0.55, r = 0.03, follow = false, onHit = null, echo = null, onEcho = null, owner = null } = {}) {
    // (a ring that echoes dims and brightens on its own, so it has a band material of its own, not the colour's shared one)
    const own = echo != null, mat = own ? Object.assign(this.ringMat.clone(), { color: color.clone().multiplyScalar(1.6) }) : (this.ringMats[color.getHex()] ||= Object.assign(this.ringMat.clone(), { color: color.clone().multiplyScalar(1.6) }));
    const m = new THREE.Mesh(band ? this.bandGeo.clone() : this.ringGeo, mat);
    m.position.copy(at).setY(at.y + 0.006);
    m.scale.setScalar(r);
    this.scene.add(m);
    const vol = this.volume(color, 'ring', at, new THREE.Vector3(r, h, r));   // the wall it rolls out as
    vol.material.progress = 1;
    this.rings.push({ m, vol, at: at.clone(), y: at.y, r, min: r, max, speed, h, band, follow, skill, source, color, hit: false, onHit, echo, onEcho, owner, phase: 'out', own });
  }

  // fire a Shot (fx.shot) from `from` at `to`; it hits for `damage` as `source`
  shoot(from, to, color, source, damage, opts) {
    const s = Object.assign(this.fx.shot(color, from, to, opts), { source, damage });
    this.bullets.push(s);
    return s;
  }

  puddle(at, r = 0.045, life = 3.5) {
    let m = this.puddleMeshes.find(m => !m.parent);
    if (!m) {
      m = new THREE.Mesh(this.flat, this.coffeeMat);
      const hot = new THREE.Mesh(this.flat, this.T.puddle.clone());
      hot.position.y = 0.0006; hot.renderOrder = 3; m.add(hot);
      this.puddleMeshes.push(m);
    }
    m.children[0].material.progress = 0; m.children[0].material.opacity = 1;
    m.position.copy(at).setY(at.y + 0.0015);
    m.scale.setScalar(r);
    this.scene.add(m);
    this.puddles.push({ m, r, t: life });
  }

  // a slick of soap where a squirt landed: slippery underfoot for `life` s (a glossy pink pool
  // with a hazard edge)
  slick(at, r = 0.05, life = 5) {
    let m = this.slickMeshes.find(m => !m.parent);
    if (!m) {
      m = new THREE.Mesh(this.flat, this.soapMat);
      const edge = new THREE.Mesh(this.flat, this.T.slick.clone());
      edge.position.y = 0.0006; edge.renderOrder = 3; m.add(edge);
      this.slickMeshes.push(m);
    }
    m.children[0].material.progress = 0; m.children[0].material.opacity = 1;
    m.position.copy(at).setY(at.y + 0.0015);
    m.scale.setScalar(r);
    this.scene.add(m);
    this.slicks.push({ m, r, t: life });
  }

  // the Soap Dispenser's bubble trap: a big bubble that drifts after the jelly (see update), and a
  // target (enemies.addProxy) your attacks pop; its Warning is the pink circle under it
  trapBubble(at, T) {
    const m = new THREE.Mesh(this.bubbleGeo, this.bubbleMat);
    m.position.copy(at); m.scale.setScalar(0.002); m.renderOrder = 4;
    this.scene.add(m);
    const warn = this.mark(null, this.flat, this.T.soap, at, new THREE.Vector3(T.radius, T.radius, T.radius));
    const B = { m, warn, t: 0, T, loose: false, held: 0, hp: T.hp, maxHp: T.hp, r: T.radius, dead: false, vel: new THREE.Vector3(), from: null,
      get position() { return m.position; }, center: (out) => out.copy(m.position),
      damage: (amount, color) => { if (B.dead || !B.loose) return; B.hp -= amount; this.fx.number(m.position.clone().setY(m.position.y + T.radius), amount, color, 12); if (B.hp <= 0) { B.hp = 0; B.dead = true; B.popped = true; } } };
    B.entry = this.enemies.addProxy(B);
    this.traps.push(B);
    return B;
  }

  // a soap bubble drifting outward from `from` along `dir` (unit, flat)
  bubble(from, dir, speed, life) {
    const m = new THREE.Mesh(this.bubbleGeo, this.bubbleMat);
    m.scale.set(SOAP_COLUMN.r, SOAP_COLUMN.half, SOAP_COLUMN.r);
    m.position.copy(from);
    m.renderOrder = 4;
    this.scene.add(m);
    this.soapBubbles.push({ m, v: dir.clone().multiplyScalar(speed), t: life, wob: Math.random() * 6, y: from.y });
  }

  balloon(color) {
    let b = this.balloonPool.find(b => !b.group.parent);
    if (!b) { b = buildBalloon(color); this.balloonPool.push(b); }
    b.mat.color.set(color); b.mat.emissive.set(color); b.mat.emissiveIntensity = 0.25; b.mat.opacity = 0.9; b.ribbon.visible = true;
    b.group.visible = true; b.group.position.set(0,0,0); b.group.rotation.set(0,0,0); b.group.scale.setScalar(1);
    return b;
  }

  // a piece of the Cream Whipper's bead from `a` toward `to` (path points), laid `u` (0..1) of the way
  // so far; it stands for `life` s, then sags (see the beads in update). bead: the one piping's
  // bead it belongs to ({ hit }: it hurts once a piping)
  bead(a, to, bead, life, yaw) {
    const m = this.beadFree.pop() || this.fx.piece(this.beadGeo, this.fx.chunkMat);
    m.visible = true; m.scale.setScalar(0);
    m.userData.color.set(LOOK.color('whipper-bead', '#f8ecff')).multiplyScalar(LOOK.num('whipper-bead-bright', 1.8)); m.userData.opacity = 1;
    const b = { m, a, to, u: 0, yaw, t: 0, life, bead };
    this.beads.push(b);
    return b;
  }

  wreath(source) {
    let m = this.wreathPool.find(m => !m.parent);
    if (!m) { m = thrownWreath(source); this.wreathPool.push(m); }
    m.visible = true; m.rotation.set(Math.PI/2,0,0); m.scale.setScalar(LOOK.num('wreath-scale',3.2));
    return m;
  }

  // the clock's wreath in flight, a Shot (fx.shot) from `from` to `to`: there in CLOCK_HITS.wreathFlight s, or at
  // `speed` (the way back); it hits with the wreath's size, its glowing core the orb
  wreathShot(from, to, speed) {
    const dist = from.distanceTo(to), v = speed || Math.max(0.2, dist / CLOCK_HITS.wreathFlight);
    return Object.assign(this.fx.shot(hostile('clock'), from, to, { speed: v, life: Math.max(0.001, dist / v) }), { size: CLOCK_HITS.wreathRadius });
  }

  // the clock's hands: real time (hour and minute), or whirling while it winds up an attack
  clockHands(e, dt) {
    const M = e.model;
    if (e.spin) { M.minuteHand.rotation.z -= dt * e.spin; M.hourHand.rotation.z -= dt * e.spin / 12; return; }
    if (e.state !== 'idle' && !e.decor) return;                       // an attack is moving them
    const d = new Date(), min = d.getMinutes() + d.getSeconds() / 60, hr = (d.getHours() % 12) + min / 60;
    const ease = (cur, want) => cur + Math.atan2(Math.sin(want - cur), Math.cos(want - cur)) * (1 - Math.exp(-4 * dt));
    M.minuteHand.rotation.z = ease(M.minuteHand.rotation.z, -min / 60 * Math.PI * 2);
    M.hourHand.rotation.z = ease(M.hourHand.rotation.z, -hr / 12 * Math.PI * 2);
  }

  // where Victory's wreath is (world), for throwing it and catching it again
  wreathWorld(e) {
    if (!e?.model?.wreath) return null;
    e.holder.updateMatrixWorld(true);
    return e.model.wreath.getWorldPosition(new THREE.Vector3());
  }

  // the Wall Clock's gilt catching the jelly (its hand, wreath or a chime): a flash on it, glints
  // thrown off, a scuff on the surface under it, a clang and the impact shake
  clockStruck(P, cfg) {
    const c = (this._struck ||= new THREE.Vector3()).copy(P).setY(P.y + cfg.height * 0.5);
    this.fx.impact(c, hostile('clock'), LOOK.num('act2-contact-flash', 0.03), 12);
    this.fx.burst(c, LOOK.list('clock-glints', ['#fff0b0', '#ffc23a', '#e0b048']), 6, 0.003, 0.3, P.y);
    this.fx.splat(this._probe.copy(P).setY(this.surfaceBelow(P)), LOOK.color('clock-scuff', '#6a5426'), 0.014, 'dust');
    juice.feel('impact'); sfx.clockStrike(true);
  }

  // where the Coffer's accordion strike aims: at the jelly, no further than its reach (A.range) from it
  cofferAim(e, A, P) {
    e.aim.copy(P);
    const dx = e.aim.x - e.base.x, dz = e.aim.z - e.base.z, d = Math.hypot(dx, dz);
    if (d > A.range) { e.aim.x = e.base.x + (dx / d) * A.range; e.aim.z = e.base.z + (dz / d) * A.range; }
    return this.platformTarget(e, e.aim, A.radius);
  }

  // the Wall Clock's chime in Telling the time: both wedges under its hands strike at once
  clockStrikes(e, H, half, len, P, cfg, pc, hit, knock) {
    sfx.clockChime(e.round); juice.feel('hit'); e.hitPop = 0.7;
    this.fx.impact(e.center(this._mid), hostile('clock'), LOOK.num('act2-muzzle-flash', 0.014) * 2, 8);   // the bell struck
    const surf = this._probe.copy(e.base).setY(e.base.y + 0.002);
    let struck = false;
    for (const k of e.hours) {
      const b = e.holder.rotation.y - k * (Math.PI / 6), dir = this._dir.set(Math.sin(b), 0, Math.cos(b));
      const tip = this._to.copy(surf).addScaledVector(dir, len * 0.7);
      this.fx.impact(tip.setY(tip.y + 0.01), hostile('clock'), 0.025, 10);
      this.fx.glow.emit(tip, hostile('clock'), 0.06, 0.02, 0.3, 0.9);
      if (!struck && coneHits(surf, dir, len, half, P, cfg)) { struck = true; hit(H.dmg, 'clock-chime', e.base); knock(e.base, 0.5); this.clockStruck(P, cfg); }
    }
    e.clearTele();
  }

  // the Coffer's jewels: n spots on its ground (spec.wake, inset by the Warning's size), at least
  // J.spread apart (closing up a little if they don't fit) and off the Coffer itself
  cofferSpots(e, n, J) {
    const W = e.spec.wake, m = J.radius * 0.6, out = [];
    let gap = J.spread;
    for (let tries = 1; out.length < n && tries < 3000; tries++) {
      if (tries % 300 === 0) gap *= 0.9;
      const at = new THREE.Vector3(W.min[0] + m + Math.random() * (W.max[0] - W.min[0] - 2 * m), W.max[1], W.min[2] + m + Math.random() * (W.max[2] - W.min[2] - 2 * m));
      if (Math.hypot(at.x - e.base.x, at.z - e.base.z) < e.r || out.some((o) => Math.hypot(o.x - at.x, o.z - at.z) < gap)) continue;
      at.y = this.surfaceBelow(at);
      if (at.y > W.min[1]) out.push(at);
    }
    return out;
  }

  // the Mushroom Pillow's spore spots: the first where the jelly stands, the rest on its seat (its wake
  // box, at the pillow's own level, never the back or an arm) within S.near of the jelly, S.spread apart, none under the pillow itself
  pillowSpots(e, P, n, S) {
    const W = e.spec.wake, out = [this.platformTarget(e, P.clone(), S.radius)];
    let gap = S.spread;
    for (let tries = 1; out.length < n && tries < 300; tries++) {
      if (tries % 75 === 0) gap *= 0.85;
      const a = Math.random() * Math.PI * 2, d = gap + Math.random() * Math.max(0, S.near - gap);
      const at = new THREE.Vector3(P.x + Math.cos(a) * d, W.max[1], P.z + Math.sin(a) * d);
      if (at.x < W.min[0] + S.radius || at.x > W.max[0] - S.radius || at.z < W.min[2] + S.radius || at.z > W.max[2] - S.radius) continue;
      if (Math.hypot(at.x - e.base.x, at.z - e.base.z) < e.r + S.radius || out.some((o) => Math.hypot(o.x - at.x, o.z - at.z) < gap)) continue;
      at.y = this.surfaceBelow(at);
      if (Math.abs(at.y - e.base.y) < 0.04) out.push(at);   // (the seat, not the back or an arm)
    }
    return out;
  }


  // the middle of the Headphones' cup i's speaker (world, into `out`)
  headphonesMouth(e, i, out) { return out.copy(e.model.mouths[i]).multiplyScalar(e.size).applyAxisAngle(UP, e.holder.rotation.y).add(e.base); }

  // take some of an Elite's Warning meshes (a list of them) off the scene, and out of its e.tele
  dropTele(e, parts) { for (const m of parts) this.scene.remove(m); e.tele = e.tele.filter((m) => !parts.includes(m)); }

  // One Headphones shove wave's cue, from cup `cup`, from beat `from` to beat `due` (Q: its lane's state, one per
  // attack). Its Warning (a white strip from the cup through the jelly to the counter's edge, and the low lane over
  // it) fills and follows the jelly until `lock` beats before; on `due` the wave rolls down it. True on that beat
  shoveCue(e, Q, cup, from, due, lock, P, fwd, dt) {
    const W = e.def.skills.shove, top = e.base.y, beat = this.beat, u = THREE.MathUtils.clamp((beat - from) / (due - from), 0, 1);
    if (beat < due - lock) {                                          // following you
      this.headphonesMouth(e, cup, Q.start).setY(top + 0.002);
      Q.dir.set(P.x - Q.start.x, 0, P.z - Q.start.z);
      if (Q.dir.lengthSq() < 1e-6) Q.dir.copy(fwd);
      Q.dir.normalize();
      const aim = Math.atan2(Q.dir.x, Q.dir.z);
      if (Q.yaw == null || Math.abs(Math.atan2(Math.sin(aim - Q.yaw), Math.cos(aim - Q.yaw))) > 0.03) { Q.len = this.edgeAlong(e, Q.start, Q.dir); Q.yaw = aim; }   // (only once it turns a little: it casts)
    }
    if (!Q.parts) {
      Q.parts = [this.mark(e, this.stripGeo, this.T.shove, Q.start, this._s3.set(W.width, 1, Q.len)), this.volume(this.waveColor, 'lane', Q.start, this._s3.set(W.width, W.height, Q.len))];
      e.tele.push(Q.parts[1]);
      Q.parts[0].material.opacity = LOOK.num('headphones-wave-warning', 0.3); Q.parts[1].material.opacity = LOOK.num('headphones-wave-volume', 0.35);   // (white blooms: kept faint)
    }
    const yaw = Math.atan2(Q.dir.x, Q.dir.z);
    for (const m of Q.parts) { m.position.copy(Q.start); m.rotation.set(0, yaw, 0); m.scale.z = Q.len; m.material.progress = u; }
    Q.parts[0].position.y += 0.002;
    e.lit[cup] = u; e.model.glows[cup].material.color.copy(this.waveColor);
    if (u < 1 && Math.random() < dt * 14 * u) this.fx.glow.emit(this._mid.copy(Q.start).setY(top + 0.03 + Math.random() * 0.04), this.waveColor, 0.02, 0.006, 0.3, 0.7);   // the air in front of the cup trembling
    if (beat < due) return false;
    this.dropTele(e, Q.parts); Q.parts = null; Q.yaw = null;
    e.lit[cup] = 0; e.pump[cup] = 1; e.recoil = 0.4;
    this.wave(Q.start, Q.dir, Q.len, W);
    this.fx.impact(this.headphonesMouth(e, cup, this._mid), this.waveColor, LOOK.num('headphones-wave-flash', 0.025), 8);
    juice.feel('hit'); sfx.headphonesWave(cup);
    return true;
  }

  // how far an Elite's furniture top runs from `from` (on it) along unit flat `dir` before its edge:
  // where the surface drops away or its wake box ends, in 5 cm steps (m, at least 10 cm)
  edgeAlong(e, from, dir, max = 1.5) {
    const W = e.spec.wake, p = this._probe;
    let d = 0.05;
    for (; d <= max; d += 0.05) {
      p.set(from.x + dir.x * d, from.y + 0.1, from.z + dir.z * d);
      if (p.x < W.min[0] || p.x > W.max[0] || p.z < W.min[2] || p.z > W.max[2] || this.surfaceBelow(p) < from.y - 0.04) break;
    }
    return Math.max(0.1, d - 0.05);
  }

  // a Headphones sound wave from `from` (on the table) along unit flat `dir` for `len` m, at W.speed
  // m/s: a jelly under its top (W.height over `from`) as its front passes is shoved W.push m along it,
  // once, and isn't hurt. See update
  wave(from, dir, len, W) { this.waves.push({ from: from.clone(), dir: dir.clone(), len, W, f: 0, hit: false }); }

  // What they do to you goes out as events (damage_taken, knockback, status_applied); a beaten
  // elite sends elite_defeated
  update(dt, player, cfg) {
    const P = player.position, pc = P.clone().setY(P.y + cfg.height * 0.5);
    const camQ = this.camera.quaternion;
    const sameLevel = (y) => Math.abs(P.y - y) < 0.1;
    const hit = (amount, source, at) => bus.emit('damage_taken', { targetId: PLAYER, amount, source, at });   // at: where it struck from (the red arc on the jelly)
    const knock = (from, force) => { const dir = P.clone().sub(from).setY(0); bus.emit('knockback', { targetId: PLAYER, dir: dir.lengthSq() > 1e-8 ? dir.normalize() : dir.set(1, 0, 0), force, launch: 0.25 }); };   // (right under it: any way out)
    this.pull = null;
    if (this.washT > 0) { this.washT -= dt; this.pull = this.washDir; }   // washed along by the Mug's spill, or shoved by a Headphones wave

    // things that only hang there: a hanging elite goes back up its wall; clock hands keep time
    for (const d of this.decor) {
      if (d.wall) d.holder.position.y += (d.hangY - d.holder.position.y) * (1 - Math.exp(-2.5 * dt));
      d.model.group.scale.setScalar(1);
      d.model.group.position.set(0, 0, 0);
      d.model.group.rotation.set(0, 0, 0);
      if (d.kind === 'clock') this.clockHands(d, dt);
    }

    for (const e of this.list) {
      if (e.dead) {
        if (!e.done) {
          e.done = true;
          const c = e.center();
          this.fx.puff(c, 0xffd23a, e.r * 2.5, 0.6);
          this.fx.ring(e.base.clone().setY(e.base.y + 0.004), 0xffd23a, e.r * 3, 0.6);
          if (e.wall) { e.retire(); this.decor.push(e); }   // back up on its wall, just a clock again
          else e.remove();
          bus.emit('elite_defeated', { elite: e });
        }
        continue;
      }
      e.t += dt;
      e.hitPop = Math.max(0, e.hitPop - dt * 6);
      const g = e.model.group;
      g.scale.setScalar(e.size * (1 + e.hitPop * 0.08));
      e.bar.quaternion.copy(camQ);
      const k = Math.max(0, e.hp / e.maxHp);
      e.fill.scale.x = Math.max(0.001, k);
      e.fill.material.color.setHSL(0.33 * k, 0.85, 0.55);          // green -> yellow -> red
      const to = pc.clone().sub(e.base);
      // awake: you're within aggro of it, and on its ground if it has one (spec.wake: a box)
      const onIts = this.onPlatform(e,P), awake = onIts && to.length() < e.aggro;
      e.awake = awake;
      const raining = e.kind === 'coffer' && e.attack === 2 && e.gems; // fixed landing spots for airborne jewels
      if (raining && !onIts) for (let i = e.gems.length - 1; i >= 0; i--) if (!e.gems[i].out) {
        e.gems.splice(i, 1); e.spots.splice(i, 1);
        for (const m of e.tele.splice(i * 2, 2)) this.scene.remove(m);
      }
      if (e.state !== 'idle' && !onIts && (!raining || !e.gems.length)) e.cancelAttack();
      // a hanging elite comes down its wall while you're close (and fights only once it's down)
      if (e.wall) {
        if (awake || e.state !== 'idle') e.downT = 1.5; else e.downT = Math.max(0, (e.downT || 0) - dt);
        const want = e.downT > 0 ? e.fightY : e.hangY, wasUp = e.holder.position.y > e.fightY + 0.05;
        e.holder.position.y += (want - e.holder.position.y) * (1 - Math.exp(-3.5 * dt));
        if (wasUp && e.holder.position.y <= e.fightY + 0.05 && want === e.fightY) { this.fx.puff(e.base.clone().setY(e.base.y + 0.02), 0xd8c8b0, 0.06, 0.5); sfx.clockChime(1, false); }
        e.ready = Math.abs(e.holder.position.y - e.fightY) < 0.03;
      }
      // face you (unless an attack has locked its aim, or it hangs on a wall), and bob so it reads as alive
      if (!e.locked && !e.wall) {
        const rest = !awake && e.state === 'idle' && e.spec.face != null;   // asleep: back the way it rests
        let d = (rest ? e.spec.face : Math.atan2(to.x, to.z)) - e.holder.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        e.holder.rotation.y += d * (1 - Math.exp(-(awake ? 6 : 1.5) * dt));
      }
      g.position.set(0, Math.abs(Math.sin(e.t * (awake ? 4 : 1.5))) * 0.004, 0);
      g.rotation.set(0, 0, 0);
      e.kick = Math.max(0, (e.kick || 0) - dt * 6);   // an attack's kick (the Mug's, the Kettle's): it leans back and squashes
      if (e.kick) { g.rotation.x = -e.kick * LOOK.num('elite-recoil', 0.15); g.scale.y *= 1 - e.kick * LOOK.num('elite-recoil-squash', 0.12); }
      if (e.kind === 'controller') {
        e.controllerKick = Math.max(0, (e.controllerKick || 0) - dt * 6);
        g.rotation.x = -e.controllerKick * LOOK.num('controller-recoil', 0.2);
        g.scale.y *= 1 - e.controllerKick * LOOK.num('controller-recoil-squash', 0.15);
        e.model.buttons.forEach(b => { b.position.y = 0.027; b.material.emissive.copy(b.material.color); b.material.emissiveIntensity = 0.5; });
        e.model.barMat.emissiveIntensity = 2;
      }
      // act 3's elites answer their own attacks: squash (a landing, a stomp) and recoil (a shot), easing back
      if (e.squash || e.recoil) {
        e.squash = Math.max(0, (e.squash || 0) - dt * 5); e.recoil = Math.max(0, (e.recoil || 0) - dt * 6);
        const q = e.squash * LOOK.num('elite-land-squash', 0.22);
        g.scale.y *= 1 - q; g.scale.x *= 1 + q * 0.5; g.scale.z *= 1 + q * 0.5;
        g.rotation.x -= e.recoil * LOOK.num('elite-recoil', 0.16);
      }
      e.cool -= dt * CONTENT.elites.pace.recover;
      const muzzle = e.model.muzzle.clone().applyAxisAngle(UP, e.holder.rotation.y).add(e.wall ? e.holder.position : e.base);
      if (e.kind === 'clock') this.clockHands(e, dt);
      let heading = e.holder.rotation.y;
      const fwd = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
      const surf = e.base.clone().setY(e.base.y + 0.002);

      // the Soap Dispenser, attacking or not: the soap left is its health, bubbles drift up through it
      if (e.kind === 'soap') {
        const M = e.model, level = M.liquidH * Math.max(0.06, e.hp / e.maxHp);
        M.liquid.scale.y += (level - M.liquid.scale.y) * (1 - Math.exp(-6 * dt));
        for (const b of M.bubs) {
          b.userData.rise = (b.userData.rise + dt * (e.hp < e.maxHp * e.def.angry ? 0.6 : 0.3)) % 1;
          b.position.y = 0.012 + b.userData.rise * M.liquid.scale.y;
        }
      }

      // the Alligator, attacking or not: its eyes close while it sleeps, it breathes, its tail sways
      if (e.kind === 'croc') {
        const M = e.model;
        M.eyes.scale.y += ((awake || e.state !== 'idle' ? 1 : 0.12) - M.eyes.scale.y) * (1 - Math.exp(-6 * dt));
        if (e.state === 'idle') {
          g.position.y = 0;
          if (!awake) g.scale.y *= 1 + Math.sin(e.t * 1.6) * 0.03;          // asleep: slow breaths
          M.upper.rotation.x = M.lower.rotation.x = 0;
          M.tail.forEach((t, i) => { t.rotation.x = CROC_TAIL_REST[i]; t.rotation.y = Math.sin(e.t * (awake ? 2.4 : 0.8) - i * 0.9) * (awake ? 0.18 : 0.05); });
        }
      }

      // the Singing Bowl, attacking or not: its eyes close while it sleeps; its song glows in it as it
      // charges and while it still rings after a strike (e.hum), its rim trembling with it
      if (e.kind === 'bowl') {
        const M = e.model;
        M.eyes.scale.y += ((awake || e.state !== 'idle' ? 1 : 0.12) - M.eyes.scale.y) * (1 - Math.exp(-6 * dt));
        e.hum = Math.max(0, (e.hum || 0) - dt * LOOK.num('bowl-ring-out', 0.8));
        M.song.material.color.copy(hostile('bowl'));
        M.song.material.opacity = Math.min(1, Math.max(e.charge || 0, e.hum) * LOOK.num('bowl-song-glow', 0.8));
        const shiver = e.hum * LOOK.num('bowl-tremble', 0.03) * Math.sin(e.t * 90);
        M.body.scale.set(1 + shiver, 1, 1 - shiver);
        if (e.state === 'idle') { g.position.y = 0; if (!awake) g.scale.y *= 1 + Math.sin(e.t * 1.6) * 0.015; }   // asleep: still, breathing a little
      }

      // the Mushroom Pillow, attacking or not: its eyes close while it sleeps, it breathes; its spots
      // glow as it gathers spores (e.charge), and its cap pops up as it puffs them (e.pop)
      if (e.kind === 'pillow') {
        const M = e.model;
        M.eyes.scale.y += ((awake || e.state !== 'idle' ? 1 : 0.12) - M.eyes.scale.y) * (1 - Math.exp(-6 * dt));
        e.pop = Math.max(0, (e.pop || 0) - dt * 4);
        M.cap.scale.set(1 - e.pop * 0.05, 1 + e.pop * LOOK.num('pillow-pop', 0.18), 1 - e.pop * 0.05);
        M.cap.position.y = M.capY;
        M.glow.material.color.copy(hostile('pillow'));
        M.glow.material.opacity = Math.min(1, Math.max(e.charge || 0, e.pop)) * LOOK.num('pillow-spot-glow', 0.9);
        if (e.state === 'idle') { g.position.y = 0; if (!awake) g.scale.y *= 1 + Math.sin(e.t * 1.6) * 0.015; else g.rotation.z = Math.sin(e.t * 2.4) * 0.025; }   // asleep: breathing; awake: swaying
      }

      // the Headphones, attacking or not: its eyes close while it sleeps; awake it bobs to the beat.
      // Each cup's speaker glows as it gets ready to play (e.lit[i]) and the cup kicks back as it does (e.pump[i])
      if (e.kind === 'headphones') {
        const M = e.model;
        M.eyes.scale.y += ((awake || e.state !== 'idle' ? 1 : 0.12) - M.eyes.scale.y) * (1 - Math.exp(-6 * dt));
        e.lit ||= [0, 0]; e.pump ||= [0, 0];
        for (let i = 0; i < 2; i++) {
          e.pump[i] = Math.max(0, e.pump[i] - dt * 5);
          M.cups[i].position.copy(M.cupAt[i]); M.cups[i].position.z -= e.pump[i] * LOOK.num('headphones-kick', 0.012);
          M.cups[i].scale.setScalar(1 + e.pump[i] * 0.15 + e.lit[i] * 0.04 * Math.sin(e.t * 40));
          M.glows[i].material.opacity = Math.min(1, Math.max(e.lit[i], e.pump[i])) * LOOK.num('headphones-speaker-glow', 0.9);
        }
        if (e.state === 'idle') {
          e.lit[0] = e.lit[1] = 0; g.position.y = 0;
          if (!awake) g.scale.y *= 1 + Math.sin(e.t * 1.6) * 0.015;                         // asleep: breathing
          else g.scale.y *= 1 + Math.pow(1 - (((this.beat % 1) + 1) % 1), 3) * 0.04;        // awake: nodding along on every beat
        }
      }

      // the Bull, attacking or not: its eyes close while it sleeps, it breathes, it sways awake
      if (e.kind === 'bull') {
        const M = e.model;
        M.eyes.scale.y += ((awake || e.state !== 'idle' ? 1 : 0.12) - M.eyes.scale.y) * (1 - Math.exp(-6 * dt));
        if (e.state === 'idle') {
          g.position.y = 0;
          if (!awake) g.scale.y *= 1 + Math.sin(e.t * 1.6) * 0.03;          // asleep: slow breaths
          else g.rotation.z = Math.sin(e.t * 3) * 0.04;                       // awake: rocking side to side
          for (const h of M.horns) h.scale.setScalar(1);
          M.hornMat.emissiveIntensity = 0;
        }
      }

      // the Coffer, attacking or not: asleep a plain shut box; awake it rises on its legs, its
      // bellows part (breathing) and its eyes open, its tendrils whip. e.cof: its pose, eased
      if (e.kind === 'coffer') {
        const M = e.model, C = (e.cof ||= { lift: 0, gap: 0.002, jaw: 0, eyes: 0 }), ease = 1 - Math.exp(-6 * dt);
        C.eyes += ((awake || e.state !== 'idle' ? 1 : 0) - C.eyes) * ease;
        M.eyes.visible = C.eyes > 0.05;
        M.eyes.scale.setScalar(Math.max(0.05, C.eyes));
        M.tendrils.rotation.set(0, Math.sin(e.t * 9) * 0.22, Math.sin(e.t * 13) * 0.05);
        g.position.y = 0;
        if (e.state === 'idle') {
          C.lift += ((awake ? COFFER.LIFT : 0) - C.lift) * ease;
          C.gap += ((awake ? 0.02 + Math.sin(e.t * 3) * 0.004 : 0.002) - C.gap) * ease;
          C.jaw += (0 - C.jaw) * ease;
          M.pose(C.lift, C.gap, C.jaw);
        }
      }

      // an Elite that moved walks back to its spot once it's idle (one that stays, the Alligator after
      // a pounce, only once you've left it); it starts nothing on the way
      const homeD = e.wall ? 0 : Math.hypot(e.home.x - e.base.x, e.home.z - e.base.z);
      if (e.state === 'idle' && homeD > 0.005 && (!awake || !e.stays)) {
        const d = Math.min(homeD, dt * ELITE_WALK);
        this.moveElite(e, this._probe.set(e.base.x + (e.home.x - e.base.x) / homeD * d, e.base.y + 0.05, e.base.z + (e.home.z - e.base.z) / homeD * d));
        e.holder.rotation.y = Math.atan2(e.home.x - e.base.x, e.home.z - e.base.z);
        g.position.y = Math.abs(Math.sin(e.t * 12)) * 0.005;
        continue;
      }
      if (homeD <= 0.005 && e.stays !== undefined) { e.stays = undefined; e.base.copy(e.home); e.holder.position.copy(e.home); }   // back on its spot (as it was placed)

      // start the next attack
      if (e.state === 'idle') {
        if (!awake || e.cool > 0 || (e.wall && !e.ready) || !this.canSee(e,pc,cfg.radius)) continue;
        // snap round the rest of the way, so the telegraph points where you are. (Waiting to face
        // you stalled it forever: its easing turn never catches a jelly circling it close)
        if (!e.wall) {
          heading = e.holder.rotation.y = Math.atan2(to.x, to.z);
          fwd.set(Math.sin(heading), 0, Math.cos(heading));
          muzzle.copy(e.model.muzzle).applyAxisAngle(UP, heading).add(e.base);
        }
        e.attack = e.next++ % (ATTACKS[e.kind].length - (e.kind === 'clock' && e.hp >= e.maxHp * e.def.angry ? 1 : 0));   // the clock strikes the hour only once it's angry
        e.state = 'windup';
        e.stateT = 0;
        e.locked = false;
      }
      e.stateT += dt * CONTENT.elites.pace.tempo;
      const s = e.stateT;

      // ---------------------------------------------------------- controller
      if (e.kind === 'controller') {
        const M = e.model, SK = e.def.skills;
        if (e.attack === 0) {
          // Button combo: four fixed floor symbols, one per button, go off one after another in the
          // order their buttons light (a new order each time); each symbol's Warning fills to its own
          // moment, so the fullest goes next. Step into one that already went off. One hit at most
          const D = SK.barrage, due = (i) => D.windup + e.combo.indexOf(i) * D.gap, last = D.windup + (FLOOR_SHAPES.length - 1) * D.gap;
          if (!e.tele.length && !e.combo) {
            e.combo = FLOOR_SHAPES.map((_, i) => i).sort(() => Math.random() - 0.5); e.fired = 0; e.struck = false;
            const floor = this.surfaceBelow(P), angle = Math.atan2(P.x-e.base.x, P.z-e.base.z);
            FLOOR_SHAPES.forEach((kind, i) => {
              const a = angle + (i-1)*Math.PI*2/3, at = P.clone();
              if (i) { at.x += Math.sin(a)*D.spread; at.z += Math.cos(a)*D.spread; }
              this.platformTarget(e,at.setY(floor),D.radius);
              const m = this.mark(e, floorShapeGeometry(kind), this.T.symbols[i], at, new THREE.Vector3(D.radius,1,D.radius));
              m.position.y += .002; m.userData.symbol = kind; m.userData.i = i;
              const vol = this.volume(hostile('controller'), 'symbol-'+kind, at, new THREE.Vector3(D.radius,D.height,D.radius));
              vol.userData.symbol = kind; vol.userData.i = i; e.tele.push(vol);
            });
            sfx.controllerCharge(false, D.windup / CONTENT.elites.pace.tempo);
          }
          const charge = Math.min(1, s / D.windup), next = e.combo[e.fired];
          g.rotation.x = s < last ? charge * LOOK.num('controller-windup-tilt', 0.12) : g.rotation.x;
          M.buttons.forEach((b, i) => {   // the next button to go lights hot; the ones still to come glow; spent ones go dark
            const k = e.combo.indexOf(i), spent = k < e.fired, lit = i === next ? 1 : spent ? 0 : 0.35;
            b.position.y -= (spent ? 1 : charge) * LOOK.num('controller-button-press', 0.002);
            b.material.emissive.copy(spent ? b.material.color : hostile('controller'));
            b.material.emissiveIntensity = spent ? 0.1 : 0.5 + lit * charge * LOOK.num('controller-button-glow', 3) + (i === next ? Math.sin(e.t * 30) * 0.5 + 0.5 : 0);
          });
          if (charge > .75 && !e.locked) { e.locked = true; sfx.controllerLock(); }
          for (const m of e.tele) m.material.progress = Math.min(1, s / due(m.userData.i));
          while (e.fired < FLOOR_SHAPES.length && s >= due(e.combo[e.fired])) {
            const i = e.combo[e.fired++], parts = e.tele.filter((m) => m.userData.i === i), v = parts.find((m) => m.material instanceof VolumeMaterial);
            const at = v.position, kind = v.userData.symbol;
            const struck = !e.struck && floorShapeHits(kind, at, D.radius, D.height, P, cfg);
            if (struck) { e.struck = true; hit(D.dmg, 'controller', at); }
            this.fx.impact(at, hostile('controller'), LOOK.num('controller-symbol-impact', .03), LOOK.num('controller-symbol-sparks', 8));
            this.fx.burst(at, [LOOK.color('controller-debris', '#aaa5a0')], LOOK.num('controller-symbol-chips', 3), LOOK.num('controller-chip-size', .002), .1, at.y);
            const pulse = this.volume(hostile('controller'), 'symbol-'+kind, at, v.scale);
            pulse.material.progress = 1;
            this.controllerPulses.push({ m: pulse, t: 0, life: LOOK.num('controller-pulse-life', .22) });
            for (const m of parts) { this.scene.remove(m); e.tele.splice(e.tele.indexOf(m), 1); }
            sfx.controllerFire(); sfx.controllerContact(); if (struck) sfx.controllerHit(); juice.feel(e.fired === FLOOR_SHAPES.length ? 'impact-big' : 'impact');
            e.controllerKick = 1;
          }
          if (e.fired >= FLOOR_SHAPES.length) {
            e.clearTele(); g.rotation.x = -LOOK.num('controller-recoil', .2);
            g.scale.y *= 1 - LOOK.num('controller-recoil-squash', .15);
            e.combo = null; e.state = 'idle'; e.cool = D.rest; e.locked = false;
          }
        } else if (e.attack === 2) {
          // Arrow drop: a pad arrow hovers `reach` m off you, flying the way it points: down from above,
          // or in from your left or right (right and left are the camera's); `up` only if you're already in
          // the air. It tracks you for `warn` s (until `lock` of it), then flies the way its tip points and
          // lands as a Blast where you were. No floor shape: the arrow's line is the warning. Step aside
          const D = SK.arrow, w = s / CONTENT.elites.pace.tempo, R = D.radius, H = cfg.height, mid = this._to;
          const floorY = this.surfaceBelow(P), at = e.arrowAt ||= new THREE.Vector3();
          if (!e.arrowDir) {
            const air = P.y - floorY > D.air, pick = air ? ARROW_DIRS : ARROW_DIRS.slice(0, 3);
            e.arrowDir = pick[Math.floor(Math.random() * pick.length)]; e.arrowAir = air; e.arrowT = 0;
            e.arrowSide = new THREE.Vector3(1, 0, 0).applyQuaternion(camQ).setY(0).normalize();
            e.arrowMesh = new THREE.Mesh(this.arrowGeo, this.arrowMat); e.arrowMesh.renderOrder = 3; this.scene.add(e.arrowMesh); e.tele.push(e.arrowMesh);
            at.copy(P);
            sfx.controllerCharge(false, D.warn);
          }
          const k = Math.min(1, w / D.warn);
          if (w < D.warn * D.lock) {                                           // still following you
            at.set(P.x, e.arrowAir ? P.y + H / 2 : floorY, P.z);
            if (!e.arrowAir) this.platformTarget(e, at, R);
          } else if (!e.locked) { e.locked = true; sfx.controllerLock(); }
          // where the arrow is: hovering reach m out, then flying in to the Blast's centre
          const dir = e.arrowDir, side = dir === 'left' ? -1 : 1, fly = Math.min(1, Math.max(0, (w - D.warn) / D.strike));
          mid.set(at.x, e.arrowAir ? at.y : at.y + H / 2, at.z);
          const out = (1 - fly * fly) * D.reach + Math.sin(e.t * 9) * 0.004 * (1 - fly);
          if (dir === 'down' || dir === 'up') mid.y += dir === 'down' ? out : -out; else mid.addScaledVector(e.arrowSide, side * out);
          const m = e.arrowMesh, S = D.size;
          m.position.copy(mid); m.scale.setScalar(S);
          m.rotation.order = 'YXZ';   // turn to the camera, lean back with its pitch (a flat slab seen from above is a sliver), then tip the way it flies
          m.rotation.set(this._camEuler.setFromQuaternion(camQ, 'YXZ').x * 0.8, Math.atan2(-e.arrowSide.z, e.arrowSide.x), dir === 'down' ? Math.PI : dir === 'up' ? 0 : side * Math.PI / 2);
          g.rotation.x = Math.min(1, k) * LOOK.num('controller-windup-tilt', 0.12);
          if (w >= D.warn + D.strike) {
            const struck = blastHits(at, R, P, cfg);
            if (struck) hit(D.dmg, 'controller', at);
            this.fx.impact(at, hostile('controller'), LOOK.num('controller-symbol-impact', 0.03), LOOK.num('controller-symbol-sparks', 8));
            this.fx.burst(at, [LOOK.color('controller-debris', '#aaa5a0')], LOOK.num('controller-symbol-chips', 3), LOOK.num('controller-chip-size', 0.002), 0.1, floorY);
            sfx.controllerFire(); sfx.controllerContact(); if (struck) sfx.controllerHit(); juice.feel('impact-big');
            e.clearTele(); e.controllerKick = 1; g.rotation.x = -LOOK.num('controller-recoil', 0.2);
            for (const key of ['arrowDir', 'arrowAt', 'arrowAir', 'arrowSide', 'arrowMesh']) delete e[key];
            e.state = 'idle'; e.cool = D.rest; e.locked = false;
          }
        } else {
          // Rumble: buzz while a red dome fills over its circle, then a shockwave: a floor Blast
          // too tall to jump over (get out of it), knocking back whatever of you is inside
          const R = 0.22, wind = 1.1;
          if (s < wind) {
            if (!e.tele.length) {
              e.tele.push(this.warnCircle(surf, R, this.T.red), this.volume(hostile('controller'), 'dome', surf, R));
              sfx.controllerCharge(true, wind / CONTENT.elites.pace.tempo);
            }
            e.tele[0].userData.fill(s / wind);
            e.tele[1].material.progress = s / wind;
            const charge = s / wind, quiet = juice.calm || this.fx.reducedMotion.matches;
            const shake = quiet ? 0 : LOOK.num('controller-vibration', 0.004) * charge;
            g.position.x = Math.sin(e.t * 110) * shake; g.position.z = Math.cos(e.t * 93) * shake;
            g.scale.y *= 1 - charge * LOOK.num('controller-load-squash', 0.12);
            M.barMat.emissiveIntensity = 2 + charge * LOOK.num('controller-bar-glow', 4);
            M.barMat.emissive.setHex(Math.sin(e.t * 25) > 0 ? 0xff2a2a : 0x3a8aff);
          } else {
            e.clearTele();
            M.barMat.emissive.setHex(0x3a8aff);
            this.fx.ring(surf, hostile('controller'), R, 0.45);
            this.fx.impact(surf.clone().setY(surf.y + 0.01), hostile('controller'), 0.05, 22);
            const pulse = this.volume(hostile('controller'), 'dome', surf, R);
            pulse.material.progress = 1;
            this.controllerPulses.push({ m: pulse, t: 0, life: LOOK.num('controller-pulse-life', 0.22) });
            this.fx.burst(surf, [LOOK.color('controller-debris', '#aaa5a0')], 8, LOOK.num('controller-chip-size', 0.002), 0.18, e.base.y);
            this.fx.splat(surf, LOOK.color('controller-scuff', '#514949'), LOOK.num('controller-scuff-size', 0.018), 'dust');
            e.controllerKick = 1; g.rotation.x = -LOOK.num('controller-recoil', 0.2); g.scale.y *= 1 - LOOK.num('controller-recoil-squash', 0.15);
            juice.feel('impact-big'); sfx.controllerRumble();
            if (blastHits(e.base, R, P, cfg)) { hit(SK.rumble.dmg, 'controller', e.base); knock(e.base, 0.9); }
            e.state = 'idle'; e.cool = 1.8;
          }
        }
      }

      // ---------------------------------------------------------- mug
      if (e.kind === 'mug') {
        const SK = e.def.skills;
        if (e.attack === 0) {
          // Coffee lob: lobs a beat apart, each at where you're standing then; each lands as a
          // floor Blast (jump it) and leaves a scalding puddle
          const R = 0.045;
          const land = (at) => {
            const struck = blastHits(at, R, P, cfg);
            if (struck) hit(SK.coffee.dmg, 'mug', at);
            this.puddle(at); this.fx.impact(at.clone().setY(at.y + 0.008), hostile('mug'), 0.025, 10);
            this.fx.burst(at.clone().setY(at.y + 0.01), [LOOK.color('mug-coffee', '#3a2214'), LOOK.color('mug-coffee-light', '#6a4a2a')], 6, 0.003, 0.3, at.y);
            juice.feel(struck ? 'impact' : 'hit'); sfx.mugSplash(struck);
          };
          const throwAt = () => {
            const target = this.platformTarget(e,P.clone(),R); this.lob(muzzle, target, 1.0, hostile('mug'), this.T.mugCircle, R, land, { dome: true });
            e.hitPop = 0.6; e.kick = 1; this.fx.impact(muzzle, hostile('mug'), 0.012, 5); sfx.mugLob();   // flung: a flash at the rim as it leans back
          };
          if (!e.thrown) e.thrown = 0;
          if (e.thrown < SK.coffee.lobs && s >= e.thrown * 0.6) { e.thrown++; throwAt(); }
          if (s > SK.coffee.lobs * 0.6) { e.state = 'idle'; e.cool = 1.6; e.thrown = 0; }
        } else {
          // Spill: tips toward you while a lane Warning (a strip and the box over it) fills along the
          // line, then pours a wave down it: caught, you're scalded and washed along to its end
          // (toward the desk's edge); it leaves scalding puddles along the line
          const W = SK.spill, wind = 0.9, len = W.puddles * 0.075 + 0.05, pour = Math.max(0.5, W.puddles * 0.12 + 0.02);
          if (s < wind) {
            if (!e.tele.length) {
              e.locked = true; e.poured = -1; e.washed = false; e.spillDir = fwd.clone();
              const at = surf.clone().addScaledVector(fwd, e.r);
              this.mark(e, this.stripGeo, this.T.brown, at, new THREE.Vector3(W.width, 1, len), heading);
              const vol = this.volume(hostile('mug'), 'lane', at, new THREE.Vector3(W.width, W.height, len)); vol.rotation.y = heading; e.tele.push(vol);
            }
            for (const m of e.tele) m.material.progress = s / wind;
            e.tele[0].material.opacity = 0.75 + Math.sin(e.t * 18) * 0.2;
            g.rotation.x = (s / wind) * 0.7;                                  // tipping over
          } else if (s < wind + pour) {
            g.rotation.x = 0.9 + e.kick * 0.25;                               // tipped, jolting on as it lets go
            if (e.tele.length) e.clearTele();
            const k = Math.floor((s - wind) / 0.12), front = e.r + 0.05 + ((s - wind) / pour) * (len - 0.05);
            if (k !== e.poured && k < W.puddles) {
              if (e.poured < 0) { e.kick = 1; this.fx.impact(muzzle, hostile('mug'), 0.015, 6); juice.feel('hit'); sfx.mugPour(); }   // the release: it lets go
              e.poured = k;
              const at = e.base.clone().addScaledVector(e.spillDir, e.r + 0.05 + k * 0.075);
              if (this.onPlatform(e,at)) {
                at.y = this.surfaceBelow(at);
                this.puddle(at, 0.04, 3);
                this.fx.burst(at.clone().setY(at.y + 0.01), ['#3a2214', '#6a4a2a'], 5, 0.003, 0.25, at.y);
                sfx.mugSplash();
              }
            }
            // the wave's front: a jelly it reaches (low enough, on the line) is scalded and washed along
            const dx = P.x - e.base.x, dz = P.z - e.base.z, along = dx * e.spillDir.x + dz * e.spillDir.z, across = Math.abs(dx * e.spillDir.z - dz * e.spillDir.x);
            if (!e.washed && along > e.r && along < front + cfg.radius && across < W.width / 2 + cfg.radius && P.y < e.base.y + W.height) {
              e.washed = true; hit(W.dmg, 'mug', P); this.washT = W.carry; this.washDir = e.spillDir.clone().multiplyScalar(W.push);
              this.fx.impact(pc, hostile('mug'), LOOK.num('act2-contact-flash', 0.03), 10); juice.feel('impact'); sfx.mugSplash(true);
            }
          } else { e.clearTele(); e.locked = false; e.state = 'idle'; e.cool = 1.8; }
        }
        if (Math.random() < dt * 3) this.fx.puff(e.base.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.02, 0.1, (Math.random() - 0.5) * 0.02)), 0xffffff, 0.008, 0.8);   // steam wisps
      }

      // ---------------------------------------------------------- kettle
      if (e.kind === 'kettle') {
        const M = e.model, SK = e.def.skills;
        if (e.attack === 0) {
          // Steam balls: it boils up a ball of steam at the spout for `charge` s with nothing on the
          // counter (only the Kettle shaking, whistling, its lid rattling and the ball swelling), then
          // fires `shots` of them in a row, `every` s apart, each at where you are as it leaves (a
          // smaller ball swells back between them). Each one's Warning shows only as it's fired: an
          // orange circle and half dome filling while it flies, and it bursts into several gusts of
          // steam there (steamBurst), each a floor Blast: keep moving, out of each circle
          const B = SK.ball, charge = B.charge, R = B.radius, big = LOOK.num('kettle-ball-size', 0.012);
          const swell = (k, glow) => {   // the ball at the spout, k 0..1 of its full size
            if (!e.ball) e.ball = this.fx.orb(hostile('kettle'), 0.002);
            const O = e.ball.userData.orb, wob = 1 + Math.sin(e.t * 45) * 0.08 * k;
            O.size = (0.002 + (big - 0.002) * k) * wob;
            e.ball.scale.setScalar(O.size);
            e.ball.position.copy(muzzle).addScaledVector(fwd, O.size);
            this.fx.orbTick(e.ball, dt, glow);
          };
          if (s < charge) {
            const k = s / charge, kk = k * k;
            if (!e.ball) sfx.kettleCharge();
            swell(k, 0.8 + 1.2 * k);
            g.rotation.z = Math.sin(e.t * 50) * (0.02 + 0.06 * kk);                           // shaking harder as it builds
            g.scale.y *= 1 + 0.08 * kk; g.scale.x *= 1 - 0.04 * kk; g.scale.z *= 1 - 0.04 * kk;   // swelling up with the pressure
            M.lid.position.y = 0.112 + Math.abs(Math.sin(e.t * (30 + 30 * k))) * (0.003 + 0.006 * k);
            M.led.material.emissiveIntensity = 2 + 4 * k;
            if (Math.random() < dt * (10 + 30 * k)) {                                            // steam drawn into the ball
              const a = Math.random() * Math.PI * 2, d = 0.02 + Math.random() * 0.02;
              this.fx.puff(this._mid.copy(e.ball.position).add(new THREE.Vector3(Math.cos(a) * d, (Math.random() - 0.3) * d, Math.sin(a) * d)), 0xffffff, 0.006 + 0.006 * k, 0.25);
            }
          } else {
            e.fired ||= 0; e.flights ||= []; e.bursts ||= [];
            e.sinceShot = (e.sinceShot ?? 1e9) + dt;
            if (e.fired < B.shots && e.sinceShot >= B.every) {
              // the release: a ball leaves on this frame, locked on where you are now
              e.fired++; e.sinceShot = 0; e.launched = true;
              this.fx.free(e.ball); e.ball = null;
              const at = this.platformTarget(e, P.clone().addScaledVector(player.velocity, B.lead * B.flight).setY(P.y), R * 0.5);   // where you'll be as it lands, if you keep going: change direction
              e.kick = 1; M.lid.position.y = 0.13; M.led.material.emissiveIntensity = 2 + 2 * (B.shots - e.fired);
              this.fx.impact(muzzle, hostile('kettle'), 0.025, 12); this.fx.puff(muzzle, 0xffffff, 0.03, 0.35);
              juice.feel('hit'); sfx.kettleBlast();
              e.flights.push(this.lob(muzzle, at, B.flight, hostile('kettle'), this.T.orange, R, (p) => { e.bursts.push(this.steamBurst(p, R, B)); }, { dome: true, arc: 0.1, size: big }));
            } else if (e.fired < B.shots) {
              const k = e.sinceShot / B.every;
              swell(0.4 + 0.6 * k, 1 + k);                                                        // the next one swelling back
              g.rotation.z = Math.sin(e.t * 50) * 0.05;
            }
            M.lid.position.y += (0.112 - M.lid.position.y) * (1 - Math.exp(-10 * dt));
            for (const f of e.flights) if (!f.done && Math.random() < dt * 30) this.fx.puff(f.m.position, 0xf2f6ff, 0.012, 0.35);   // a steam trail behind each
            if (e.fired >= B.shots && e.flights.every((f) => f.done) && e.bursts.length >= e.flights.length && e.bursts.every((b) => b.done)) {   // once every gust is over
              e.launched = false; e.fired = 0; e.sinceShot = null; e.flights = []; e.bursts = [];
              e.state = 'idle'; e.cool = 1.6; M.lid.position.y = 0.112; M.led.material.emissiveIntensity = 2;
            }
          }
        } else {
          // Boil dry: the lid pops off and lands on the stove away from you, a white circle round it;
          // then a big Warning (a circle and the half dome over it, reach= round the Kettle) fills and
          // steam rolls over all of it except the lid's circle: get to the lid (or out of reach)
          const D = SK.boil, fill = D.flight + D.fill;
          if (!e.lidFly) {
            M.led.material.emissiveIntensity = 4;
            e.kick = 0.7; this.fx.impact(M.lid.getWorldPosition(this._mid), hostile('kettle'), 0.02, 10); juice.feel('hit'); sfx.kettlePop();   // the release: the lid jumps off
            // where it lands: in reach, on the stove, at least `away` from you and clear of the Kettle
            const at = new THREE.Vector3();
            for (let i = 0; i < 60; i++) {
              const a = Math.random() * Math.PI * 2, r = e.r + D.safe + Math.random() * (D.reach - e.r - D.safe * 2);
              this.platformTarget(e, at.set(e.base.x + Math.sin(a) * r, e.base.y + 0.05, e.base.z + Math.cos(a) * r), D.safe);
              if (Math.hypot(at.x - P.x, at.z - P.z) >= D.away && Math.hypot(at.x - e.base.x, at.z - e.base.z) <= D.reach - D.safe) break;
            }
            const lid = (this.flyingLid ||= M.lid.clone());
            lid.scale.setScalar(e.size); lid.rotation.set(0, 0, 0);
            this.scene.add(lid); M.lid.visible = false;
            e.lidFly = { lid, from: M.lid.getWorldPosition(new THREE.Vector3()), at, steamed: false };
            e.tele.push(this.warnCircle(surf, D.reach, this.T.orange), this.volume(hostile('kettle'), 'dome', surf, D.reach));
          }
          const F = e.lidFly, u = Math.min(1, s / D.flight), k = Math.min(1, s / fill);
          F.lid.position.lerpVectors(F.from, F.at, u); F.lid.position.y += Math.sin(u * Math.PI) * 0.12;
          F.lid.rotation.x += dt * (u < 1 ? 14 : 0); if (u >= 1) F.lid.rotation.x = 0;
          if (u >= 1 && !F.landed) {   // it clatters down: its safe circle shows
            F.landed = true; sfx.kettleDrop(false); this.fx.puff(F.at, 0xffffff, 0.02, 0.3);
            const safe = this.mark(e, this.flat, this.T.safe, F.at.clone().setY(F.at.y + 0.003), new THREE.Vector3(D.safe, D.safe, D.safe));
            safe.material.progress = 1; safe.renderOrder = 4;
          }
          if (e.tele[0]) { e.tele[0].userData.fill(k); e.tele[1].material.progress = k; }
          if (F.landed && e.tele[2]) e.tele[2].material.opacity = 0.75 + Math.sin(e.t * 12) * 0.25;
          M.lid.position.y = 0.112;
          g.rotation.z = Math.sin(e.t * 50) * 0.04 * k;   // rattling harder as it boils
          if (s >= fill && !F.steamed) {
            // the steam: a Blast over all its reach, except the lid's circle
            F.steamed = true; e.clearTele();
            this.fx.impact(surf.clone().setY(surf.y + 0.01), hostile('kettle'), 0.05, 20);
            for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, r = D.reach * (0.3 + 0.6 * Math.random()); this.fx.puff(this._mid.set(e.base.x + Math.sin(a) * r, e.base.y + 0.02, e.base.z + Math.cos(a) * r), 0xffffff, D.reach * 0.35, 0.6); }
            this.fx.ring(surf, hostile('kettle'), D.reach, 0.4);
            juice.feel('impact-big'); sfx.kettleGust(false, true);
            const safe = Math.hypot(P.x - F.at.x, P.z - F.at.z) < D.safe;
            if (!safe && blastHits(e.base, D.reach, P, cfg)) { hit(D.dmg, 'kettle', e.base); knock(e.base, 0.8); this.fx.puff(pc, 0xffffff, 0.025, 0.4); sfx.kettleGust(true, false); }
          }
          if (s > fill + 0.5) { this.scene.remove(F.lid); M.lid.visible = true; e.lidFly = null; e.clearTele(); M.led.material.emissiveIntensity = 2; M.lid.position.y = 0.112; e.state = 'idle'; e.cool = 1.8; }
        }
      }

      // ---------------------------------------------------------- soap dispenser
      if (e.kind === 'soap') {
        const M = e.model, SK = e.def.skills, angry = e.hp < e.maxHp * e.def.angry;
        const press = (k) => { M.head.position.y = M.headY - k * 0.012; M.stem.scale.y = 1 - k * 0.5; M.stem.position.y = M.headY - 0.012 - k * 0.006; };
        if (e.attack === 0) {
          // Bubble trap: it pumps up a big soap bubble at its nozzle (the bubble swelling), lets it go,
          // and it drifts after you (slower than you swim) with a pink circle under it filling as it
          // goes; it has a little Health: shoot it and it pops. One that reaches you closes round the
          // jelly and carries it back toward the Dispenser, then pops: scalded by the soap, and a slick
          const T = SK.trap, n = angry ? T.angryCount : T.count, blow = 1.0, k = Math.floor(s / (blow + 0.2)), u = (s % (blow + 0.2)) / blow;
          if (k < n) {
            press(Math.abs(Math.sin(e.t * 14)) * 0.6 * Math.min(1, u));
            if (!e.blowing && u < 1) { e.blowing = this.trapBubble(muzzle, T); sfx.soapPump(); }
            if (e.blowing) {
              const B = e.blowing, grow = THREE.MathUtils.smoothstep(Math.min(1, u), 0, 1);
              B.m.position.copy(muzzle).addScaledVector(fwd, T.radius * grow); B.m.scale.setScalar(Math.max(0.002, T.radius * grow));
              if (u >= 1) {   // let go: off it drifts
                B.loose = true; e.blowing = null; press(0);
                this.fx.impact(muzzle, hostile('soap'), LOOK.num('act2-muzzle-flash', 0.014), 6); sfx.soapBubbles(); juice.feel('hit'); e.hitPop = 0.5;
              }
            }
          } else { press(0); e.state = 'idle'; e.cool = angry ? 1.3 : 1.8; }
        } else {
          // Bubble ring: foams up (pumping fast, the ring filling round it), then lets go a ring
          // of 16 bubbles drifting outward with a gap; angry, a second ring with its gap elsewhere.
          // They alternate floor level (the jelly's middle on the floor: jump them) and jump height
          // (high Shots: stay down)
          const wind = 1.0;
          if (s < wind) {
            if (!e.tele.length) e.tele.push(this.warnCircle(surf, 0.17, this.T.soapRing));
            e.tele[0].userData.fill(s / wind);
            press(Math.abs(Math.sin(e.t * 26)) * 0.7);
            g.rotation.z = Math.sin(e.t * 40) * 0.03;
            if (Math.random() < dt * 25) this.fx.puff(muzzle.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.02, 0, (Math.random() - 0.5) * 0.02)), 0xffe0ee, 0.009, 0.5);   // foam spilling out
          } else if ((e.rings || 0) < (angry ? SK.ring.angryRings : SK.ring.rings) && s > wind + (e.rings || 0) * 0.55) {
            e.rings = (e.rings || 0) + 1;
            e.clearTele();
            press(0);
            const slots = 18, skip = Math.floor(Math.random() * slots);
            for (let k = 0; k < slots; k++) {
              if (k === skip || k === (skip + 1) % slots) continue;          // the gap: two slots wide
              const a = (k / slots) * Math.PI * 2 + (e.rings - 1) * 0.6, dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
              this.bubble(e.base.clone().addScaledVector(dir, e.r * 1.1).setY(e.base.y + SOAP_COLUMN.mid), dir, 0.26, 2.3);
            }
            this.fx.ring(surf, hostile('soap'), 0.17, 0.35);
            this.fx.impact(muzzle, hostile('soap'), LOOK.num('act2-muzzle-flash', 0.014) * 1.5, 6);   // the foam letting go
            sfx.soapBubbles();
            juice.feel('hit');
            e.hitPop = 0.8;
          }
          // the attack ends a beat after its last ring (rings are 0.55 apart): the end has to
          // follow the ring count in the file, or a count past 2 would never all fire
          if (s > wind + ((angry ? SK.ring.angryRings : SK.ring.rings) - 1) * 0.55 + 0.35) { e.rings = 0; e.clearTele(); e.state = 'idle'; e.cool = angry ? 1.3 : 1.8; }
        }
      }

      // ---------------------------------------------------------- wall clock
      if (e.kind === 'clock') {
        const M = e.model, SK = e.def.skills, angry = e.hp < e.maxHp * e.def.angry, R = 0.42;
        const flat = (v) => Math.atan2(v.x - e.base.x, v.z - e.base.z);     // the angle of a point round the pivot
        if (e.attack === 0) {
          // Sweeping hands: a half circle fills on the bench while the hands spin, then a golden hand sweeps across it
          const wind = angry ? 0.8 : 1.0, dur = 0.55;
          if (s < wind) {
            if (!e.tele.length) {
              e.dirSweep = Math.random() < 0.5 ? 1 : -1;
              this.mark(e, this.halfGeo, this.T.sweep, surf, new THREE.Vector3(R, 1, R), heading);
              const vol = this.volume(hostile('clock'), 'half', e.base, new THREE.Vector3(R, CLOCK_HITS.sweepH, R));   // the low space the hand sweeps through
              vol.rotation.y = heading;
              e.tele.push(vol);
            }
            for (const m of e.tele) { m.material.progress = s / wind; m.material.opacity = 0.7 + Math.sin(e.t * 22) * 0.15; }
            e.spin = 14;                                                         // the hands whirl
            if (Math.random() < dt * 8) sfx.clockTick();
          } else if (s < wind + dur) {
            const u = (s - wind) / dur, b = heading + e.dirSweep * (-Math.PI / 2 + u * Math.PI);
            if (!e.beam) {
              e.beam = this.mark(e, this.stripGeo, this.T.beam, surf.clone().setY(surf.y + 0.002), new THREE.Vector3(0.03, 1, R), b);
              e.beam.material.progress = 1;
              e.prevB = b - e.dirSweep * 0.01;
              sfx.clockSweep();
              this.fx.impact(surf.clone().setY(surf.y + 0.01), hostile('clock'), LOOK.num('act2-muzzle-flash', 0.014) * 2, 10);   // the hand lets go from the pivot
              e.hitPop = 0.6; juice.feel('hit');
            }
            e.beam.rotation.y = b;
            if (e.tele[0]) e.tele[0].material.opacity = e.tele[1].material.opacity = 0.35;
            const tip = surf.clone().add(new THREE.Vector3(Math.sin(b) * R, 0.01, Math.cos(b) * R));
            this.fx.glow.emit(tip, hostile('clock'), 0.05, 0.01, 0.25, 0.9);
            // did the hand pass you (anything of you inside its low volume, within its reach, as it went by)?
            const between = (x, a0, a1) => { const w = (v) => Math.atan2(Math.sin(v - a0), Math.cos(v - a0)); const t = w(x), span = w(a1); return span >= 0 ? t >= 0 && t <= span : t <= 0 && t >= span; };
            if (!e.swept && ringHits(e.base, 0, R - cfg.radius * 0.5, CLOCK_HITS.sweepH, P, cfg) && between(flat(P), e.prevB, b)) { e.swept = true; hit(SK.sweep.dmg, 'clock', e.base); knock(e.base, 0.7); this.clockStruck(P, cfg); }
            e.prevB = b;
            e.spin = 0;
            M.minuteHand.rotation.z = -e.dirSweep * (u - 0.5) * Math.PI;                 // the dial's minute hand sweeps with it
          } else {
            if (e.beam) {
              // the hand clacks into its stop at the far side: a flash and a scuff at its tip
              const b = heading + e.dirSweep * Math.PI / 2, tip = surf.clone().add(this._mid.set(Math.sin(b) * R, 0, Math.cos(b) * R));
              this.fx.impact(tip.clone().setY(tip.y + 0.006), hostile('clock'), 0.02, 6);
              this.fx.splat(tip, LOOK.color('clock-scuff', '#6a5426'), 0.012, 'dust');
              sfx.clockStrike(false);
            }
            e.clearTele(); e.beam = null; e.swept = false; e.spin = 0; e.state = 'idle'; e.cool = angry ? 1.2 : 1.7;
          }
        } else if (e.attack === 1) {
          // Victory's wreath: a line on the bench to you and one from her hand to your middle (mid-jump
          // included), locking halfway; then the wreath is a Shot out along it and back
          const wind = 0.8;
          if (s < wind) {
            if (s < wind * 0.3 || !e.aim) e.aim = shotTarget(P, cfg, null, P.y, e.aim || new THREE.Vector3());
            const from = this.wreathWorld(e), dx = e.aim.x - e.base.x, dz = e.aim.z - e.base.z, len = Math.max(0.05, Math.hypot(dx, dz));
            if (!e.tele.length) {
              this.mark(e, this.stripGeo, this.T.wreath, surf, new THREE.Vector3(0.05, 1, len), Math.atan2(dx, dz));
              this.mark(e, this.stripGeo, this.T.wreath, from || surf, ONE).rotation.order = 'YXZ';   // its height: tilted to the Shot's height
            }
            e.tele[0].rotation.y = Math.atan2(dx, dz);
            e.tele[0].scale.z = len;
            if (from) {
              const up = e.tele[1], rise = e.aim.y - from.y, reach = Math.max(0.01, Math.hypot(e.aim.x - from.x, e.aim.z - from.z));
              up.position.copy(from);
              up.rotation.set(-Math.atan2(rise, reach), Math.atan2(e.aim.x - from.x, e.aim.z - from.z), 0);
              up.scale.set(0.012, 1, Math.hypot(reach, rise));
            }
            for (const m of e.tele) m.material.progress = s / wind;
            M.wreath.rotation.z += dt * 12;                                      // she brandishes it
            M.wreath.scale.setScalar(1 + Math.sin(e.t * 20) * 0.08);
            if (from && Math.random() < dt * 14) this.fx.glow.emit(from, hostile('clock'), 0.04, 0.01, 0.3, 0.8);
          } else if (!e.threw) {
            e.threw = true;
            e.clearTele();
            M.wreath.visible = false;
            const m = this.wreath(M.wreath);
            const from = this.wreathWorld(e);
            m.position.copy(from);
            this.scene.add(m);
            this.thrown.push({ m, shot: this.wreathShot(from, e.aim, 0), owner: e, aim: e.aim.clone(), out: true, hitOut: false, hitBack: false });
            sfx.wreathWhirr();
            this.fx.impact(from, hostile('clock'), LOOK.num('act2-muzzle-flash', 0.014) * 1.5, 8);   // it leaves her hand
            e.hitPop = 0.6; juice.feel('hit');
          } else if (!this.thrown.some((w) => w.owner === e)) { e.threw = false; e.aim = null; M.wreath.visible = true; M.wreath.scale.setScalar(1); e.state = 'idle'; e.cool = angry ? 1.2 : 1.7; }
        } else {
          // Telling the time (angry only): the bench is its face. Each round the hands snap to a time,
          // and a wedge Warning (a floor wedge and the cone over it) fills on the bench under each
          // hand; on the chime both strike. Read the hands, stand between them. rounds= times
          const H = SK.hour, half = 0.45, len = R * 0.95, round = Math.floor(s / H.warn);
          if (round < H.rounds && round !== e.round) {
            if (e.round != null && e.round >= 0) this.clockStrikes(e, H, half, len, P, cfg, pc, hit, knock);
            e.round = round; e.clearTele();
            // a new time: two hands on the bench's half of the face (nine through twelve to three), apart
            const slot = () => [-3, -2, -1, 0, 1, 2, 3][Math.floor(Math.random() * 7)];   // hours from twelve
            let h = slot(), m = slot(); while (Math.abs(h - m) < 2) m = slot();
            e.hours = [h, m];
            for (const k of e.hours) {
              const b = heading + k * (Math.PI / 6) * -1, dir = this._dir.set(Math.sin(b), 0, Math.cos(b));
              this.mark(e, this.coneGeo, this.T.hour, surf, new THREE.Vector3(len, 1, len), b);
              e.tele.push(coneVolume(this, hostile('clock'), surf, b, len, half));
            }
            sfx.clockTick(); e.hitPop = 0.4;
          }
          if (round >= H.rounds && e.round != null && e.round >= 0) { this.clockStrikes(e, H, half, len, P, cfg, pc, hit, knock); e.round = -1; }
          const u = (s % H.warn) / H.warn;
          for (const m of e.tele) m.material.progress = u;
          if (e.hours) {   // the hands point there: hour hand at the first, minute hand at the second
            M.hourHand.rotation.z += ((-e.hours[0] * Math.PI / 6) - M.hourHand.rotation.z) * (1 - Math.exp(-14 * dt));
            M.minuteHand.rotation.z += ((-e.hours[1] * Math.PI / 6) - M.minuteHand.rotation.z) * (1 - Math.exp(-14 * dt));
          }
          g.rotation.z = Math.sin(e.t * 30) * 0.01;
          if (s > H.warn * H.rounds + 0.3) { e.round = null; e.hours = null; e.clearTele(); e.state = 'idle'; e.cool = 1.6; }
        }
      }

      // ---------------------------------------------------------- cream whipper
      if (e.kind === 'whipper') {
        const M = e.model, SK = e.def.skills, angry = e.hp < e.maxHp * e.def.angry;
        const gauges = (k) => M.needles.forEach((n, i) => { n.rotation.z = 1.2 - k * 2.3 + Math.sin(e.t * 30 + i) * 0.05 * k; });
        if (e.attack === 0) {
          // Balloon: blow one up on the nozzle, let it go; angry, a second straight after
          const fill = 1.0, n = angry ? SK.balloon.angryCount : SK.balloon.count, k = Math.floor(s / (fill + 0.25)), u = (s % (fill + 0.25)) / fill;
          if (k < n) {
            if (!e.inflating && u < 1) {
              e.inflating = this.balloon(new THREE.Color().setHSL(0.72 + Math.random() * 0.2, 0.8, 0.6).getHex());
              this.scene.add(e.inflating.group);
              sfx.balloonFill(fill);
            }
            if (e.inflating) {
              const b = e.inflating, grow = THREE.MathUtils.smoothstep(Math.min(1, u), 0, 1);
              e.holder.updateMatrixWorld(true);
              M.tip.getWorldPosition(b.group.position);
              b.group.scale.setScalar(0.004 + grow * BALLOON - 0.004 * grow);
              b.group.rotation.set(Math.sin(e.t * 9) * 0.1 * grow, 0, Math.sin(e.t * 7) * 0.1 * grow);
              gauges(grow);
              M.lever.rotation.z = -grow * 0.25;
              if (Math.random() < dt * 20) this.fx.puff(b.group.position.clone(), 0xe8e0ff, 0.006, 0.25);
              if (u >= 1) {
                // let go: it drifts after you, and bursts 3 s later as a whole-sphere Blast of radius R
                // round it: its Warning is the circle on the floor under it (no volume: the owner's call,
                // the balloon itself shows where the burst is)
                const R = 0.2, warn = this.mark(null, this.flat, this.T.blast, surf, new THREE.Vector3(R, R, R));
                warn.renderOrder = 3;
                warn.scale.setScalar(R);
                this.scene.add(warn);
                this.balloons.push({ m: b.group, b, warn, t: 0, fuse: SK.balloon.fuse, R, vel: new THREE.Vector3(0, 0.05, 0), size: BALLOON, tick: 0 });
                sfx.balloonLoose();
                this.fx.impact(b.group.position, hostile('whipper'), LOOK.num('act2-muzzle-flash', 0.014), 6);   // let go off the nozzle
                e.hitPop = 0.5;
                e.inflating = null;
                M.lever.rotation.z = 0;
              }
            }
          } else { gauges(0); e.state = 'idle'; e.cool = angry ? 1.6 : 2.2; }
        } else {
          // Piping: the nozzle follows you while your wake glows behind you, its Warning: a strip on the
          // floor and the low ridge of cream over it along each bit of the path, filling to when the
          // cream gets there. Then a stream of cream lays a bead along exactly where you swam, wake= s
          // behind you, for pipe= s (path noted every PIPE_STEP s). The bead stays and hurts (the beads
          // in update): keep moving and don't double back. A stop lets the stream catch you up
          const PI = SK.piping, rt = s / CONTENT.elites.pace.tempo, S = PIPE_STEP, wake = PI.wake;   // rt: real s since it started
          const p = (e.pipe ||= { pts: [], segs: [], laid: -1, piece: null, bead: { hit: false }, pipe: angry ? PI.angryPipe : PI.pipe, stay: angry ? PI.angryStay : PI.stay }), pipe = p.pipe;   // (angry or not as it started)
          // where you are, noted (on the surface under you, mid-jump too)
          while (p.pts.length * S <= pipe + 1e-6 && rt >= p.pts.length * S) p.pts.push(new THREE.Vector3(P.x, this.surfaceBelow(P), P.z));
          const last = p.pts.length - 1, noted = p.pts.length * S > pipe + 1e-6, tau = rt - wake;   // tau: the path's time the stream has got to
          // the wake: a strip and its ridge over each bit of path (at least a square, so a still jelly shows one)
          const W = PI.height * 1.25;
          for (let i = 0; i < last; i++) {
            const k = (rt - i * S) / (wake + S);   // 1 when the stream has laid this bit right through
            let seg = p.segs[i];
            if (k >= 1) { if (seg) { for (const m of seg) { this.scene.remove(m); e.tele.splice(e.tele.indexOf(m), 1); } p.segs[i] = null; } continue; }
            if (seg === null) continue;
            if (!seg) {
              const a = p.pts[i], b = p.pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), len = Math.max(W, d);
              const yaw = d > 1e-4 ? Math.atan2(dx, dz) : (p.segs[i - 1]?.[0].rotation.y ?? heading);
              const at = this._probe.copy(a).addScaledVector(this._beadDir.set(Math.sin(yaw), 0, Math.cos(yaw)), -(len - d) / 2);
              const strip = this.mark(e, this.stripGeo, this.T.pipe, at, this._beadAt.set(W, 1, len), yaw);
              strip.position.y += 0.002;
              const vol = this.volume(hostile('whipper'), 'lane', at, this._beadAt.set(W, PI.height, len));
              vol.rotation.y = yaw; e.tele.push(vol);
              seg = p.segs[i] = [strip, vol];
            }
            for (const m of seg) { m.material.progress = k; m.material.opacity = 0.75 + Math.sin(e.t * 22 + i) * 0.15; }
          }
          if (tau < 0) {
            // winding up: tipping toward you, the gauges climbing, a hiss
            M.whip.rotation.x = Math.min(1, rt / wake) * 0.35;
            gauges(Math.min(1, rt / wake) * 0.7 + Math.sin(e.t * 12) * 0.05);
            if (!e.hissed) { e.hissed = true; sfx.balloonFill(wake, false); }
          } else if (!noted || tau < last * S) {
            // the stream: from the nozzle to where your path was wake= s ago, laying the bead there
            const k = Math.min(Math.floor(tau / S), last - 1), u = THREE.MathUtils.clamp((tau - k * S) / S, 0, 1);
            while (p.laid < k) {
              if (p.piece) p.piece.u = 1;
              p.laid++;
              p.piece = this.bead(p.pts[p.laid], p.pts[p.laid + 1], p.bead, p.stay, p.piece?.yaw ?? heading);
            }
            p.piece.u = u;
            const tip = this._tip.copy(p.pts[k]).lerp(p.pts[k + 1], u);
            e.locked = true;   // the nozzle follows the stream, not you
            let d = Math.atan2(tip.x - e.base.x, tip.z - e.base.z) - e.holder.rotation.y;
            e.holder.rotation.y += Math.atan2(Math.sin(d), Math.cos(d)) * (1 - Math.exp(-10 * dt));
            M.whip.rotation.x = 0.4 + Math.sin(e.t * 25) * 0.02;
            M.lever.rotation.z = -0.3;
            gauges(0.8 + Math.sin(e.t * 12) * 0.1);
            e.holder.updateMatrixWorld(true);
            const from = M.tip.getWorldPosition(this._mid), to = tip.setY(tip.y + PI.height * 0.8), st = (this.stream ||= this.fx.piece(this.streamGeo, this.fx.chunkMat));
            st.visible = true; st.userData.color.set(LOOK.color('whipper-bead', '#f8ecff')).multiplyScalar(LOOK.num('whipper-bead-bright', 1.8)); st.userData.opacity = 1;
            st.position.copy(from); st.lookAt(to);
            const w = PI.height * 0.16 * (1 + Math.sin(e.t * 40) * 0.15);
            st.scale.set(w, w, from.distanceTo(to));
            if (!e.sprayed) {   // the release: the nozzle opens with a flash, the whipper pops, a pssht
              e.sprayed = true; sfx.creamSpray(pipe);
              this.fx.impact(from, hostile('whipper'), LOOK.num('act2-muzzle-flash', 0.014) * 1.5, 8);
              e.hitPop = 0.6; juice.feel('hit');
            }
            if (Math.random() < dt * 10) this.fx.puff(to, 0xfffaf0, 0.012, 0.35);   // where it lands
          } else {
            p.piece && (p.piece.u = 1);
            e.clearTele(); this.stream.visible = false;
            e.locked = false; e.hissed = e.sprayed = false; e.pipe = null;
            M.whip.rotation.x = 0; M.lever.rotation.z = 0; gauges(0); e.state = 'idle'; e.cool = 1.8;
          }
        }
      }

      // ---------------------------------------------------------- the alligator
      if (e.kind === 'croc') {
        const M = e.model, SK = e.def.skills, angry = e.hp < e.maxHp * e.def.angry, tempo = CONTENT.elites.pace.tempo;
        const jaw = (k) => { M.upper.rotation.x = -k * 0.6; M.lower.rotation.x = k * 0.32; };
        if (e.attack === 0) {
          // Frost volley: the mouth opens while a Warning (a circle and the half sphere over it)
          // fills at each spot of a fan round you; then a frost ball flies fast to each and bursts
          // as a Blast that slows you
          const V = SK.volley, wind = angry ? V.angryWindup : V.windup;
          if (!e.volleyed) {
            e.volleyed = true;
            e.locked = true;
            const n = angry ? V.angryCount : V.count, side = new THREE.Vector3(fwd.z, 0, -fwd.x);
            e.frostFelt = false;
            // the frame the balls leave its mouth: a frosty flash there, its head kicks back, the launch
            const launch = (b) => { this.fx.impact(b.from, hostile('croc'), 0.02, 8); e.recoil = 1; sfx.frostLaunch(); };
            for (let k = 0; k < n; k++) {
              const at = P.clone().addScaledVector(side, (k - (n - 1) / 2) * V.spread);
              this.platformTarget(e,at,V.radius);
              this.lob(muzzle, at, V.flight, hostile('croc'), this.T.frost, V.radius, (p) => {
                this.fx.impact(p.clone().setY(p.y + 0.01), hostile('croc'), 0.03, 12);
                this.fx.burst(p.clone().setY(p.y + 0.01), ['#ffffff', '#cfe0ff', '#7f94ff'], 8, 0.003, 0.3, p.y);
                this.fx.ring(p.clone().setY(p.y + 0.003), hostile('croc'), V.radius, 0.35);
                this.fx.splat(p, LOOK.color('croc-frost-splat', '#dfe8ff'), V.radius * LOOK.num('croc-frost-splat-size', 0.35), 'dust');   // harmless rime, fading
                if (!e.frostFelt) { e.frostFelt = true; juice.feel('impact'); }       // once a volley: they land together
                sfx.frostLand();
                if (blastHits(p, V.radius, P, cfg)) {
                  hit(V.dmg, 'croc-frost', p);
                  bus.emit('status_applied', { targetId: PLAYER, status: 'slow', duration: V.slowTime, strength: V.slow });
                }
              }, { dome: true, arc: V.arc, wait: wind / tempo + k * V.stagger, size: V.size, owner: e, onLaunch: launch });   // one after another, from one end of the fan: outpace it
            }
            sfx.freeze();
          }
          jaw(Math.min(1, s / wind));
          if (s < wind && Math.random() < dt * 25) this.fx.glow.emit(muzzle, hostile('croc'), 0.03, 0.006, 0.3, 0.9);   // frost gathering in its mouth
          if (s > wind + (V.flight + 0.35 + V.stagger * ((angry ? V.angryCount : V.count) - 1)) * tempo) { jaw(0); e.volleyed = false; e.locked = false; e.state = 'idle'; e.cool = angry ? V.angryRest : V.rest; }
        } else if (e.attack === 1) {
          // Tail slam: it turns its back to you, then slams its tail on the bed in a rhythm of its
          // own each time (gaps picked as it starts); before each slam a small Warning (a circle and
          // the ring wall round it) fills where the tail will land, and each slam sends a thick
          // ring wall rolling out over the bed: jump it
          const T = SK.tail;
          if (!e.rhythm) {
            e.locked = true;
            const lo = angry ? T.angrySlams : T.slams, hi = angry ? T.angryMaxSlams : T.maxSlams, n = lo + Math.floor(Math.random() * (hi - lo + 1));
            e.rhythm = [];
            for (let k = 0, at = T.turn; k < n; k++) e.rhythm.push(at += T.gapMin + Math.random() * (T.gapMax - T.gapMin));
            e.slams = 0;
            e.backYaw = heading + Math.PI;
            e.slamAt = e.base.clone().addScaledVector(fwd, M.tailReach * e.size);   // its tail, once it has turned, lies toward you
            this.platformTarget(e,e.slamAt,CROC_SLAM_WARN);
          }
          let d = e.backYaw - e.holder.rotation.y;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          e.holder.rotation.y += d * (1 - Math.exp(-10 * dt));
          const k = e.slams, due = e.rhythm[Math.min(k, e.rhythm.length - 1)], from = k ? e.rhythm[k - 1] : T.turn;
          if (k < e.rhythm.length) {
            if (s >= from && !e.tele.length) e.tele.push(this.warnCircle(e.slamAt, CROC_SLAM_WARN, this.T.frostRing), this.volume(hostile('croc'), 'ring', e.slamAt, new THREE.Vector3(CROC_SLAM_WARN, T.height, CROC_SLAM_WARN)));
            const u = THREE.MathUtils.clamp((s - from) / (due - from), 0, 1);
            if (e.tele.length) { e.tele[0].userData.fill(u); e.tele[1].material.progress = u; }
            const lift = s < from ? 0 : Math.sin(Math.min(1, u / 0.8) * Math.PI * 0.5) * (u > 0.8 ? (1 - u) / 0.2 : 1);   // up, then down hard
            M.tail.forEach((t, i) => { t.rotation.x = CROC_TAIL_REST[i] + lift * (0.55 - i * 0.12); t.rotation.y = 0; });
            if (s >= due) {
              e.slams++;
              e.clearTele();
              M.tail.forEach((t, i) => { t.rotation.x = -0.05 * (i + 1); });
              e.hitPop = 0.6;
              juice.feel('impact');
              sfx.crocThump(0.8);
              const at = e.slamAt.clone().setY(e.slamAt.y + 0.01);
              this.fx.puff(at, 0xdfe6ff, 0.04, 0.4);
              this.fx.impact(at, hostile('croc'), 0.025, 10);
              this.fx.burst(at, LOOK.list('croc-fluff', ['#7fa36a', '#a8c690', '#ffffff']), 6, 0.003, 0.25, e.slamAt.y);
              this.fx.splat(e.slamAt, LOOK.color('croc-frost-splat', '#dfe8ff'), CROC_SLAM_WARN * LOOK.num('croc-dent-size', 0.6), 'dust');   // a dent in the quilt, fading
              this.ring(e.slamAt, hostile('croc'), T, 'croc-tail', { band: T.band, speed: T.speed, max: T.reach, follow: true });
            }
          } else if (s > due + 0.45) { e.rhythm = null; e.locked = false; e.state = 'idle'; e.cool = angry ? T.angryRest : T.rest; }
        } else {
          // Pounce: it crouches while a Warning (a circle and the half sphere over it) fills where you
          // are, following you until lock= of the crouch; then it leaps there and lands as a Blast
          // round itself, and stays there (it walks back to its pillows only once you leave the bed)
          const Q = SK.pounce, wind = angry ? Q.angryWindup : Q.windup, land = wind + Q.air;
          if (!e.pounceAt) { e.pounceAt = new THREE.Vector3(); e.pounceFrom = e.base.clone(); e.landed = false; }
          const at = e.pounceAt;
          if (s < wind * Q.lock) { this.platformTarget(e, at.copy(P), Q.radius * 0.5); at.y = this.surfaceBelow(this._probe.copy(at).setY(P.y + 0.05)); }
          else e.locked = true;
          if (!e.tele.length && !e.landed) e.tele.push(this.warnCircle(at, Q.radius, this.T.pounce), this.volume(hostile('croc'), 'dome', at, Q.radius));
          if (e.tele.length) {
            const u = Math.min(1, s / land); e.tele[0].userData.fill(u); e.tele[1].material.progress = u;
            e.tele[0].position.copy(at).setY(at.y + 0.002); e.tele[1].position.copy(at);
          }
          if (s < wind) {
            const c = Math.min(1, s / (wind * 0.6));
            g.scale.y *= 1 - c * 0.22;                                           // crouching down
            g.scale.x *= 1 + c * 0.08;
            g.position.x = (Math.random() - 0.5) * 0.002 * c;
            jaw(c * 0.25);
          } else if (s < land) {
            const u = (s - wind) / Q.air;
            if (!e.leapt) { e.leapt = true; sfx.wind(); sfx.crocThump(0.5); this.fx.puff(surf.clone().setY(surf.y + 0.01), 0xdfe6ff, 0.05, 0.4); e.squash = 0.6; e.holder.rotation.y = Math.atan2(at.x - e.base.x, at.z - e.base.z); }   // the push off
            e.holder.position.lerpVectors(e.pounceFrom, at, u);
            g.position.y = Math.sin(u * Math.PI) * Q.leap;
            g.rotation.x = -0.35 * Math.cos(u * Math.PI);                       // nose up going up, down coming down
            M.tail.forEach((t, i) => { t.rotation.x = 0.25 - u * 0.4 + i * 0.05; });
            jaw(0.5);
          } else if (!e.landed) {
            e.landed = true;
            e.clearTele();
            this.moveElite(e, this._mid.copy(at).setY(at.y + 0.05)); e.stays = true;
            const surf = e.base.clone().setY(e.base.y + 0.002);
            jaw(0);
            this.fx.ring(surf, hostile('croc'), Q.radius, 0.5);
            this.fx.impact(surf.clone().setY(surf.y + 0.01), hostile('croc'), 0.05, 22);
            this.fx.puff(surf.clone().setY(surf.y + 0.01), 0xdfe6ff, Q.radius * 0.8, 0.6);
            this.fx.burst(surf.clone().setY(surf.y + 0.02), LOOK.list('croc-fluff', ['#7fa36a', '#a8c690', '#ffffff']), 10, 0.004, 0.35, surf.y);
            this.fx.splat(surf, LOOK.color('croc-frost-splat', '#dfe8ff'), Q.radius * LOOK.num('croc-dent-size', 0.6) * 0.5, 'dust');
            e.squash = 1;                                                        // it lands flat, then springs back
            juice.feel('impact-big'); sfx.crocThump(1.4);
            if (blastHits(surf, Q.radius, P, cfg)) { hit(Q.dmg, 'croc-pounce', surf); knock(e.base, Q.knock); this.fx.impact(pc, hostile('croc'), 0.02, 8); }
          } else if (s > land + 0.4) { e.landed = e.leapt = false; e.pounceAt = null; e.locked = false; e.state = 'idle'; e.cool = angry ? Q.angryRest : Q.rest; }
        }
      }

      // ---------------------------------------------------------- the bull
      if (e.kind === 'bull') {
        const M = e.model, SK = e.def.skills, angry = e.hp < e.maxHp * e.def.angry, col = hostile('bull');
        if (e.attack === 0) {
          // Bull rush: its horns swell and glow while it stamps and lowers its head, and a lane
          // Warning (a strip and the box over it, as wide as the Bull and too tall to jump) fills from
          // it through you to the table's edge; then it charges down it, knocking away what it meets,
          // skids to a stop at the edge and stands there dizzy (hit it!) before it walks home
          const Q = SK.rush, wind = angry ? Q.angryWindup : Q.windup, big = angry ? Q.angryHorns : Q.horns;
          if (!e.lane) {
            e.locked = true;
            const dir = fwd.clone(), W = e.spec.wake, m = Q.width * 0.5;
            let len = 0;   // to the table's edge (its wake box, less half the Bull)
            while (len < 2 && this._probe.copy(e.base).addScaledVector(dir, len + 0.01).x > W.min[0] + m && this._probe.x < W.max[0] - m && this._probe.z > W.min[2] + m && this._probe.z < W.max[2] - m) len += 0.01;
            e.lane = { dir, len, from: e.base.clone(), along: 0, struck: false, rushed: false };
            this.mark(e, this.stripGeo, this.T.lane, surf.clone().setY(surf.y + 0.002), new THREE.Vector3(Q.width, 1, len), heading);
            const vol = this.volume(col, 'lane', surf.clone().setY(surf.y + 0.002), new THREE.Vector3(Q.width, Q.height, len));
            vol.rotation.y = heading; e.tele.push(vol);
          }
          const L = e.lane, charge = s - wind, run = Math.min(L.len, Math.max(0, charge) / CONTENT.elites.pace.tempo * (angry ? Q.angrySpeed : Q.speed));   // speed: real m/s
          if (s < wind) {
            const u = s / wind, k = THREE.MathUtils.smoothstep(u, 0, 0.75);
            for (const m of e.tele) m.material.progress = u;
            for (const h of M.horns) h.scale.setScalar(1 + (big - 1) * k);
            M.hornMat.emissive.copy(col);
            M.hornMat.emissiveIntensity = k * (1.4 + Math.sin(e.t * 30) * 0.5);
            const stamp = Math.floor(s / 0.3);                                   // a stamp every 0.3 s, head lowering
            g.position.y = Math.abs(Math.sin((s / 0.3) * Math.PI)) * 0.012;
            g.rotation.x = 0.22 * k;
            g.rotation.z = (stamp % 2 ? 1 : -1) * 0.05;
            if (stamp !== e.stamped) { e.stamped = stamp; this.fx.puff(surf.clone().setY(surf.y + 0.01), 0xf0d0c0, 0.03, 0.35); sfx.crocThump(0.5); }
          } else if (L.along < L.len) {
            if (!L.rushed) {   // off it goes: the release
              L.rushed = true; e.clearTele();
              this.fx.impact(surf.clone().setY(surf.y + 0.02), col, 0.04, 16);
              this.fx.puff(surf.clone().setY(surf.y + 0.01).addScaledVector(L.dir, -0.04), 0xf0d0c0, 0.05, 0.4);
              juice.feel('hit'); sfx.bullSnort();
            }
            L.along = run;
            this.moveElite(e, this._mid.copy(L.from).addScaledVector(L.dir, L.along)); e.stays = false;
            g.rotation.x = 0.3; g.position.y = Math.abs(Math.sin(s * 28)) * 0.008;
            if (Math.random() < dt * 30) this.fx.puff(this._to.copy(e.base).setY(e.base.y + 0.006), 0xf0d0c0, 0.02, 0.3);
            const c = this._to.copy(e.base).setY(e.base.y + Q.height * 0.4);
            if (!L.struck && blastHits(c, Q.width * 0.5 + 0.02, P, cfg)) {
              L.struck = true; hit(Q.dmg, 'bull-rush', c); knock(this._from.copy(e.base).addScaledVector(L.dir, -0.2), Q.knock);
              this.fx.impact(pc, col, 0.03, 14); juice.feel('impact-big'); sfx.bullRush();
            }
            if (L.along >= L.len) {   // the skid at the edge: it slams to a stop, stuffing flying
              e.squash = 1; e.dizzyT = 0;
              this.fx.impact(surf.clone().setY(surf.y + 0.02).addScaledVector(L.dir, 0.04), col, 0.04, 16);
              this.fx.burst(surf.clone().setY(surf.y + 0.03), LOOK.list('bull-fluff', ['#f0d0c0', '#ffffff', '#a83a3a']), 12, 0.004, 0.4, surf.y);   // stuffing and fluff thrown up
              this.fx.splat(surf, LOOK.color('bull-scuff', '#6a5048'), LOOK.num('bull-mini-scuff', 0.02) * 1.5, 'dust');   // skid marks, fading
              if (!L.struck) juice.feel('impact'); sfx.bullMini(false);
            }
          } else {
            // dizzy: the horns shrink back, it sways round in a daze, then it's done (and walks home)
            e.dizzyT += dt;
            const k = Math.max(0, 1 - e.dizzyT / 0.4);
            for (const h of M.horns) h.scale.setScalar(1 + (big - 1) * k);
            M.hornMat.emissiveIntensity = k * 1.4;
            g.rotation.x = 0;
            g.rotation.z = Math.sin(e.dizzyT * 9) * 0.12; e.holder.rotation.y += dt * Math.sin(e.dizzyT * 4) * 2;
            if (Math.random() < dt * 6) this.fx.glow.emit(this._to.copy(e.base).setY(e.base.y + e.r * 2.4), LOOK.color('bull-dizzy', '#fff2a0'), 0.012, 0.01, 0.4, 0.8);   // stars round its head
            if (e.dizzyT > Q.dizzy) { e.lane = null; e.stamped = -1; e.locked = false; e.state = 'idle'; e.cool = angry ? Q.angryRest : Q.rest; }
          }
        } else if (e.attack === 1) {
          // Spiral: a Warning circle fills round it; then it spins, firing a Shot out along each arm
          // every beat as it turns, so the arms wind into a spiral. Arms alternate floor level (the
          // jelly's middle on the floor: jump it) and jump height (stay down)
          const S = SK.spiral, arms = angry ? S.angryArms : S.arms, turn = THREE.MathUtils.degToRad(angry ? S.angryTurn : S.turn);
          if (s < S.warn) {
            if (!e.tele.length) { e.locked = true; e.spinAt = heading; e.fired = 0; e.tele.push(this.warnCircle(surf, S.warnRadius, this.T.spiral)); }
            e.tele[0].userData.fill(s / S.warn);
            g.rotation.z = Math.sin(e.t * 40) * 0.03;                           // trembling, about to go
          } else if (s < S.warn + S.time) {
            if (e.tele.length) { e.clearTele(); sfx.zap(); }
            const t = s - S.warn;
            e.holder.rotation.y = e.spinAt + t * turn;                          // spinning like a top
            for (; e.fired * S.every <= t; e.fired++) {
              const a = e.spinAt + e.fired * S.every * turn;
              for (let k = 0; k < arms; k++) {
                const b = a + (k / arms) * Math.PI * 2, dx = Math.sin(b), dz = Math.cos(b);
                const y = e.base.y + (k % 2 ? SHOT_HEIGHT.jump : SHOT_HEIGHT.floor);
                this._from.set(e.base.x + dx * e.r * 0.8, y, e.base.z + dz * e.r * 0.8);
                this._to.set(this._from.x + dx, y, this._from.z + dz);
                this.shoot(this._from, this._to, col, 'bull-spiral', S.dmg, { speed: S.speed, size: S.size, life: S.reach / S.speed }).onEnd = this.bullShotEnd;
                this.fx.glow.emit(this._from, col, S.size * 4, S.size * 7, 0.12, 1);   // a flash where it leaves
              }
              e.hitPop = Math.max(e.hitPop, LOOK.num('bull-spiral-pulse', 0.35));   // its body pulses with each beat
              sfx.bullShot();
            }
          } else if (s > S.warn + S.time + 0.2) { e.locked = false; e.state = 'idle'; e.cool = angry ? S.angryRest : S.rest; }
        } else {
          // Little bulls: two pop up beside you (left and right as the camera sees it), each with a
          // lane Warning (a strip and the box over it) through where you are; then they charge
          const N = SK.minis;
          if (!e.minis) {
            e.locked = true;
            const right = this._right.set(1, 0, 0).applyQuaternion(camQ).setY(0).normalize(), y = this.surfaceBelow(P), pair = { struck: false };
            this.miniGeo ||= buildMiniBull(N.height);
            e.minis = [-1, 1].map((sd) => {
              const at = new THREE.Vector3(P.x + right.x * sd * N.side, y, P.z + right.z * sd * N.side), dir = new THREE.Vector3(-right.x * sd, 0, -right.z * sd), yaw = Math.atan2(dir.x, dir.z);
              const m = new THREE.Mesh(this.miniGeo, M.mat);
              m.position.copy(at);
              m.rotation.y = yaw;
              m.scale.setScalar(0.01);
              this.scene.add(m);
              this.mark(e, this.stripGeo, this.T.lane, at.clone().setY(y + 0.002), new THREE.Vector3(N.width, 1, N.reach), yaw);
              const vol = this.volume(col, 'lane', at.clone().setY(y + 0.002), new THREE.Vector3(N.width, N.height, N.reach));
              vol.rotation.y = yaw;
              e.tele.push(vol);
              this.fx.puff(at.clone().setY(y + 0.02), 0xf0d0c0, 0.03, 0.4);
              const b = { m, owner: e, pair, at, dir, y, along: 0, t: 0, state: 'warn' };
              this.minis.push(b);
              return b;
            });
            sfx.pop(false, true);
          }
          if (s < N.warn) {
            for (const m of e.tele) { m.material.progress = s / N.warn; m.material.opacity = 0.7 + Math.sin(e.t * 22) * 0.15; }
          } else if (e.tele.length) {
            e.clearTele();
            for (const b of e.minis) {
              b.state = 'charge'; b.speed = angry ? N.angrySpeed : N.speed;
              // off they go: a kick of dust behind each and a flash at its horns, a snort
              const p = this._mid.copy(b.m.position).setY(b.y + N.height * 0.5);
              this.fx.puff(this._to.copy(p).addScaledVector(b.dir, -N.width * 0.5).setY(b.y + 0.01), 0xf0d0c0, 0.03, 0.35);
              this.fx.impact(p.addScaledVector(b.dir, N.width * 0.4), col, 0.012, 6);
            }
            e.squash = 0.5;                                                      // the big Bull stamps them off
            sfx.bullSnort();
            sfx.milliRoll(N.reach / e.minis[0].speed);   // (its length: without one, live audio threw)
          } else if (e.minis.every((b) => b.done)) { e.minis = null; e.locked = false; e.state = 'idle'; e.cool = angry ? N.angryRest : N.rest; }
        }
      }

      // ---------------------------------------------------------- the latticework coffer
      if (e.kind === 'coffer') {
        const M = e.model, SK = e.def.skills, angry = e.hp < e.maxHp * e.def.angry, col = hostile('coffer'), C = e.cof, tempo = CONTENT.elites.pace.tempo;
        e.holder.updateMatrixWorld(true);
        const home = this._home.set(0, C.lift + COFFER.base + C.gap, 0);      // the lid's middle (underneath) on the box, in its frame
        if (e.attack === 0) {
          // Accordion: strikes in a row. Each locks where you are (no further than range from it)
          // and a Warning (a circle and the half sphere over it) fills there while the lid shoots
          // out on its stretching bellows and hovers over it; then it slams down there as a Blast.
          // The bellows snap back as the next strike locks
          const A = SK.accordion, unfold = angry ? A.angryUnfold : A.unfold, n = A.strikes, k = Math.floor(s / unfold);
          if (e.strike == null) { e.strike = -1; e.aim ||= new THREE.Vector3(); e.lidFrom ||= new THREE.Vector3(); e.lidAt ||= new THREE.Vector3(); e.lidFrom.copy(home); e.lidAt.copy(home); e.locked = true; }
          C.gap += (0.03 - C.gap) * (1 - Math.exp(-10 * dt));
          C.jaw = 0;
          if (e.strike >= 0 && e.tele.length && s >= (e.strike + 1) * unfold) {
            // the slam
            e.clearTele();
            this.fx.impact(this._mid.copy(e.aim).setY(e.aim.y + 0.01), col, 0.03, 14);
            this.fx.puff(this._mid, 0x8a6a4a, 0.035, 0.35);
            this.fx.burst(this._mid, LOOK.list('coffer-chips', ['#8a6a4a', '#c8a878', '#e8d8b0']), 6, 0.003, 0.28, e.aim.y);   // splinters off the lid
            this.fx.splat(e.aim, LOOK.color('coffer-scuff', '#5a4632'), A.radius * LOOK.num('coffer-scuff-size', 0.45), 'dust');      // a dusty mark where it landed, fading
            e.hitPop = Math.max(e.hitPop, 0.4);                                  // the box jolts with the slam
            juice.feel('impact'); sfx.cofferSlam();
            if (blastHits(e.aim, A.radius, P, cfg)) { hit(A.dmg, 'coffer-accordion', e.aim); this.fx.impact(pc, col, 0.015, 6); }
            e.lidFrom.copy(e.lidAt);
          }
          if (k < n && k !== e.strike) {
            // the next strike: lock where you are
            e.strike = k;
            this.cofferAim(e, A, P);
            e.tele.push(this.warnCircle(e.aim, A.radius, this.T.coffer), this.volume(col, 'dome', e.aim, A.radius));
            sfx.cofferWheeze(unfold / tempo);
          }
          // the lid hovers over you, its Warning sliding with you, until track= of the strike: then it locks
          if (k < n && e.tele.length && (s - k * unfold) / unfold < A.track) { this.cofferAim(e, A, P); e.tele[0].position.copy(e.aim).setY(e.aim.y + 0.002); e.tele[1].position.copy(e.aim); }
          const to = g.worldToLocal(this._to.copy(e.aim));                  // the spot, in its frame
          if (k < n) {
            const u = (s - k * unfold) / unfold;
            e.tele[0].userData.fill(u);
            e.tele[1].material.progress = u;
            // the lid: back from the last strike and cocked up (so the Warning shows clear), shot out
            // to hover over the spot, then down on it
            if (u < 0.25) e.lidAt.lerpVectors(e.lidFrom, home, THREE.MathUtils.smoothstep(u / 0.25, 0, 1));
            else if (u < 0.5) e.lidAt.copy(home).setY(home.y + A.hover * Math.sin(((u - 0.25) / 0.25) * Math.PI * 0.5));
            else if (u < 0.85) { e.lidAt.lerpVectors(home, to, THREE.MathUtils.smoothstep((u - 0.5) / 0.35, 0, 1)); e.lidAt.y += A.hover; }
            else e.lidAt.copy(to).setY(to.y + A.hover * (1 - ((u - 0.85) / 0.15) ** 2));
          } else {
            const u = Math.min(1, (s - n * unfold) / 0.25);
            e.lidAt.lerpVectors(e.lidFrom, home, THREE.MathUtils.smoothstep(u, 0, 1));
            if (u >= 1) { e.strike = null; e.locked = false; e.state = 'idle'; e.cool = angry ? A.angryRest : A.rest; }
          }
          M.pose(C.lift, C.gap, 0);
          if (e.state !== 'idle') M.reach(e.lidAt.x, e.lidAt.y, e.lidAt.z);
        } else if (e.attack === 1) {
          // Tongue: its mouth opens, then the tongue shoots to you and latches on (it can't miss);
          // it pulls you toward its mouth (the run adds this.pull to your swimming) for `hold` s.
          // Brought to its mouth you're bitten and thrown back out; else it lets go
          const T = SK.tongue, tg = M.tongue, mouth = g.localToWorld(this._mouth.set(0, M.mouthY(), COFFER.D / 2 - 0.01));
          if (!e.lash) { e.lash = { state: 'open', from: new THREE.Vector3(), at: 0 }; e.locked = false; sfx.cofferCreak(T.open / tempo); }
          const L = e.lash, open = Math.min(1, s / T.open);
          C.jaw = 0.75 * THREE.MathUtils.smoothstep(open, 0, 1) * (L.state === 'done' ? Math.max(0, 1 - (s - L.at) / 0.3) : 1);
          C.gap += ((L.state === 'done' ? 0.02 : 0.035) - C.gap) * (1 - Math.exp(-10 * dt));
          M.pose(C.lift, C.gap, C.jaw);
          const tip = this._tip;
          if (L.state === 'open' && s >= T.open) { L.state = 'shoot'; L.at = s; sfx.tongueLash(); }
          if (L.state === 'shoot') {
            const f = Math.min(1, (s - L.at) / T.shoot);
            tip.lerpVectors(mouth, pc, f);
            if (f >= 1) { L.state = 'latched'; L.at = s; sfx.tongueLatch(); this.fx.impact(pc, col, 0.012, 6); }
          }
          if (L.state === 'latched') {
            tip.copy(pc);
            const dx = e.base.x - P.x, dz = e.base.z - P.z, d = Math.hypot(dx, dz) || 1, pull = angry ? T.angryPull : T.pull;
            if (d < T.bite) {
              // the chomp: its jaws slam shut on you on this frame (the impact: flash, spray of drool and
              // tooth glints, the crunch, a heavy shake); it holds you and chews, then spits you out
              hit(T.dmg, 'coffer-tongue', e.base);
              this.fx.impact(mouth, col, 0.035, 16);
              this.fx.burst(mouth, LOOK.list('coffer-chomp-bits', ['#fff3c4', '#e9dca0', '#ffffff']), 12, 0.004, 0.4, e.base.y);
              juice.feel('impact-big'); sfx.cofferChomp();
              e.hitPop = 0.8;
              L.state = 'chew'; L.at = s; L.chews = 0;
            } else if (s - L.at > T.hold || !e.awake) { L.state = 'back'; L.at = s; L.from.copy(tip); sfx.tongueLash(); }
            else this.pull = this._pull.set((dx / d) * pull, 0, (dz / d) * pull);
          }
          if (L.state === 'chew') {
            // chewing: held in its mouth (pulled onto it), the jaw parting a little and slamming each chew,
            // the box bouncing, eyes flaring, a crunch each time; then it gapes and spits you back out
            const t = s - L.at, k = Math.floor(t / T.chew), ph = (t % T.chew) / T.chew;
            this.pull = this._pull.set((mouth.x - P.x) * 12, 0, (mouth.z - P.z) * 12);
            let bob = 0;
            if (k < T.chews) {
              C.jaw = 0.2 * Math.sin(ph * Math.PI);
              bob = 0.004 * Math.sin(ph * Math.PI);
              if (k > L.chews) {
                L.chews = k;
                this.fx.impact(mouth, col, 0.018, 8);
                this.fx.burst(mouth, LOOK.list('coffer-chomp-bits', ['#fff3c4', '#e9dca0', '#ffffff']), 5, 0.003, 0.3, e.base.y);
                juice.feel('impact'); sfx.cofferCrunch(); e.hitPop = 0.5;
              }
            } else {
              knock(e.base, T.knock);
              this.fx.puff(mouth, LOOK.color('coffer-drool', '#e8e2b8'), 0.03, 0.4);
              this.fx.splat(this._mid.set(mouth.x, e.base.y, mouth.z), LOOK.color('coffer-drool', '#e8e2b8'), 0.025);   // a wet patch on the desk where it spat you out
              sfx.cofferSpit(); e.hitPop = 0.6;
              L.state = 'done'; L.at = s;
            }
            M.pose(C.lift + bob, C.gap, C.jaw);
          }
          if (L.state === 'back') {
            const f = Math.min(1, (s - L.at) / 0.15);
            tip.lerpVectors(L.from, mouth, f);
            if (f >= 1) { L.state = 'done'; L.at = s; }
          }
          tg.visible = M.tip.visible = L.state === 'shoot' || L.state === 'latched' || L.state === 'back';
          if (tg.visible) {
            const dx = tip.x - mouth.x, dy = tip.y - mouth.y, dz = tip.z - mouth.z, len = Math.max(0.005, Math.hypot(dx, dy, dz));
            const thin = THREE.MathUtils.clamp(Math.sqrt(0.12 / len), 0.4, 1);   // it thins as it stretches
            tg.position.copy(mouth);
            tg.rotation.set(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0, 'YXZ');
            tg.scale.set(LOOK.num('coffer-tongue-width', 0.026) * thin, LOOK.num('coffer-tongue-thickness', 0.012) * thin, len);
            M.tip.position.copy(tip);
            M.tip.scale.setScalar(LOOK.num('coffer-tongue-tip', 0.02));
            tg.material.emissiveIntensity = L.state === 'latched' ? 0.8 + Math.min(1, (s - L.at) / T.hold) * 1.2 + Math.sin(e.t * 30) * 0.2 : 0.6;
            if (L.state === 'latched' && Math.random() < dt * 20) this.fx.glow.emit(this._mid.lerpVectors(mouth, tip, Math.random()), col, 0.012, 0.004, 0.25, 0.8);
          }
          if (L.state === 'done' && s - L.at > 0.3) { e.lash = null; tg.visible = M.tip.visible = false; e.state = 'idle'; e.cool = angry ? T.angryRest : T.rest; }
        } else {
          // Jewels: amber jewels shoot up out of sight off its lid while Warnings (a circle and the
          // half sphere over it) fill on random spots spread over the desk; then the jewels fall
          // fast onto them and burst as Blasts
          const J = SK.jewels, gems = M.jewels;
          if (!e.spots) {
            e.locked = true;
            const n = angry ? J.angryCount : J.count;
            e.spots = this.cofferSpots(e, n, J);
            for (const at of e.spots) {                                     // (ten or more at once: each kept quiet, look.css)
              const w = this.warnCircle(at, J.radius, this.T.coffer, LOOK.num('coffer-jewel-warning', 0.6)), v = this.volume(col, 'dome', at, J.radius);
              v.material.opacity = LOOK.num('coffer-jewel-volume', 0.4);
              e.tele.push(w, v);
            }
            // each jewel leaves from a spot on the lid, at its own moment, up and a little out
            e.gems = e.spots.map((_, i) => ({ from: g.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 0.15, C.lift + COFFER.base + C.gap + COFFER.lid, (Math.random() - 0.5) * 0.12)), dx: (Math.random() - 0.5) * 0.5, dz: (Math.random() - 0.5) * 0.5, at: i * 0.035, spin: Math.random() * 6, out: false }));
            e.rained = e.burst = false;
          }
          const u = Math.min(1, s / J.rain);
          for (let i = 0; i < e.tele.length; i += 2) { e.tele[i].userData.fill(u); e.tele[i + 1].material.progress = u; }
          C.jaw = s < 0.5 ? Math.sin((s / 0.5) * Math.PI) * 0.35 : 0;              // the lid pops as they fly
          C.gap += (0.03 - C.gap) * (1 - Math.exp(-10 * dt));
          M.pose(C.lift, C.gap, C.jaw);
          let shown = 0;
          const fallAt = J.rain - J.drop;
          if (s >= fallAt && !e.rained) { e.rained = true; sfx.jewelWhistle(J.drop / tempo); }
          for (let i = 0; i < e.gems.length && !e.burst; i++) {
            const G = e.gems[i], up = (s - G.at) / 0.4, p = this._mid;
            if (up >= 0 && up < 1) {
              // shooting up, fast, out of sight
              if (!G.out) { G.out = true; sfx.jewelLaunch(i); this.fx.glow.emit(G.from, col, 0.012, 0.03, 0.14, 1); }   // a glint as it leaves the lid
              p.set(G.from.x + G.dx * up * 0.3, G.from.y + J.up * up * up * 1.6, G.from.z + G.dz * up * 0.3);
            } else if (s >= fallAt) {
              const f = Math.min(1, (s - fallAt) / J.drop), at = e.spots[i];
              p.set(at.x, at.y + J.radius * 0.3 + J.up * (1 - f * f), at.z);
            } else continue;
            this._q.setFromEuler(this._eul.set(G.spin + s * 9, s * 7, 0));
            gems.setMatrixAt(shown++, this._m4.compose(p, this._q, this._s3.setScalar(0.013)));
            this.fx.glow.hold(p, col, 0.03, 0.8);
          }
          gems.count = shown;
          gems.instanceMatrix.needsUpdate = true;
          gems.visible = shown > 0;
          if (s >= J.rain && !e.burst) {
            // they land
            e.burst = true;
            e.clearTele();
            gems.count = 0; gems.visible = false;
            let struck = false;
            for (const at of e.spots) {
              this.fx.impact(this._mid.copy(at).setY(at.y + 0.01), col, 0.03, 10);
              this.fx.burst(this._mid, ['#ffb22a', '#ff7a00', '#ffe0a0'], 5, 0.003, 0.3, at.y);
              this.fx.splat(at, LOOK.color('coffer-shards', '#b89a6a'), J.radius * LOOK.num('coffer-shards-size', 0.25), 'dust');   // glittering grit, fading
              if (!struck && blastHits(at, J.radius, P, cfg)) { struck = true; hit(J.dmg, 'coffer-jewel', at); this.fx.impact(pc, col, 0.015, 6); }
            }
            e.hitPop = Math.max(e.hitPop, 0.4);
            juice.feel('impact'); sfx.jewelCrack();
          }
          if (s > J.rain + 0.4) { e.spots = e.gems = null; e.locked = false; e.state = 'idle'; e.cool = angry ? J.angryRest : J.rest; }
        }
      }

      // ---------------------------------------------------------- the singing bowl
      // Both attacks keep the song's time (this.beat: the run's beat), not the pace's tempo: a strike
      // or the hum is due on a beat planned as the attack starts. If the beat jumps (a menu ate some,
      // or the song started), the attack is called off rather than going off unwarned
      if (e.kind === 'bowl') {
        const M = e.model, SK = e.def.skills, angry = e.hp < e.maxHp * e.def.angry, col = hostile('bowl'), beat = this.beat;
        const jumped = (e.strikes || e.humAt) && Math.abs(beat - e.beatWas - dt * this.bpm / 60) > 1;   // (a frame is far under a beat)
        e.beatWas = beat;
        if (jumped) { const S = e.attack ? SK.hum : SK.ring; e.cancelAttack(); e.cool = angry ? S.angryRest : S.rest; continue; }
        const rim = this._mid.copy(muzzle);
        if (e.attack === 0) {
          // Rim ring: the striker lifts over the rim while a Warning (a disc round the bowl and the low
          // ring wall over it) fills to the strike; on the bar it hits the rim and a thin, low ring
          // wall rolls out across the seat: jump it. Angry: two a bar, the second faster
          const R = SK.ring;
          if (!e.strikes) {                                                  // planned as it starts: turning angry part way keeps the plan
            const first = snapUp(beat + R.windup, R.snap), every = angry ? 2 : 4;   // the first bar line at least windup beats away
            e.strikes = Array.from({ length: angry ? R.angryRings : R.rings }, (_, k) => first + k * every);
            e.struckN = 0; e.fromBeat = beat;
          }
          const k = e.struckN, n = e.strikes.length;
          if (k < n) {
            const due = e.strikes[k], from = k ? e.strikes[k - 1] : e.fromBeat, u = THREE.MathUtils.clamp((beat - from) / (due - from), 0, 1);
            if (!e.tele.length) e.tele.push(this.warnCircle(surf, R.warn, this.T.bowl), this.volume(col, 'ring', surf, new THREE.Vector3(R.warn, R.height, R.warn)));
            e.tele[0].userData.fill(u); e.tele[1].material.progress = u;
            M.pose('strike', u < 0.8 ? 1 - u / 0.8 : (u - 0.8) / 0.2);       // lifts up and back, then down onto the rim
            e.charge = u;
            if (beat >= due) {
              e.struckN++;
              e.clearTele();
              M.pose('strike', 1);
              e.hum = 1; e.hitPop = 0.6; e.recoil = 0.6;
              this.fx.impact(rim.clone().setY(rim.y - 0.01).addScaledVector(this._right.set(Math.cos(heading), 0, -Math.sin(heading)), e.r * 0.9), col, LOOK.num('bowl-strike-flash', 0.03), 10);   // where the striker meets the rim
              this.fx.burst(rim, LOOK.list('bowl-glints', ['#fff2c0', '#cba24b', '#ffffff']), 6, 0.0025, 0.25, e.base.y);
              this.fx.splat(surf, LOOK.color('bowl-shimmer', '#d8c890'), R.warn * LOOK.num('bowl-shimmer-size', 0.5), 'dust');   // a shimmer on the cushion, fading
              juice.feel('impact'); sfx.bowlStrike(angry && k % 2 === 1);
              this.ring(surf, col, R, 'bowl-ring', { band: R.band, speed: angry && k % 2 ? R.angrySpeed : R.speed, max: R.reach, r: e.r * 0.4, follow: true, onHit: () => sfx.bowlHit(), echo: R.echo, owner: e,
                onEcho: () => { sfx.bowlEcho(); this.fx.impact(surf, col, LOOK.num('bowl-echo-flash', 0.02), 6); } });   // it turns back: a chime and a flash at the bowl
            }
          } else if (beat > e.strikes[n - 1] + 1) { e.strikes = null; e.charge = 0; M.pose('rest'); e.state = 'idle'; e.cool = angry ? R.angryRest : R.rest; }
        } else {
          // Hum: the striker runs round the rim and the bowl's song swells while a Warning (a rectangle
          // over the whole seat, `seat` in stage4.js, and the slab over it) fills everywhere but a white safe
          // circle round the bowl; on the bar the sound hits the jelly anywhere on the seat outside
          // that circle, up to `height` over it (a jump doesn't clear it): swim in close
          const H = SK.hum, S = e.spec.seat;
          if (!e.humAt) {
            e.humAt = snapUp(beat + H.windup, H.snap);                  // the first snap line at least windup beats away
            e.humDone = false; e.fromBeat = beat; e.turn = 0;
            const hw = (S.max[0] - S.min[0]) / 2, hd = (S.max[1] - S.min[1]) / 2, mid = this._mid2.set(S.min[0] + hw, e.base.y, S.min[1] + hd);
            e.tele.push(
              this.mark(null, floorShapeGeometry('square'), this.T.bowlSeat, this._probe.set(mid.x, e.base.y + 0.002, mid.z), this._s3.set(hw, 1, hd)),
              this.volume(col, 'symbol-square', mid, this._s3.set(hw, H.height, hd)));
            const safe = this.mark(e, this.flat, this.T.safe, this._probe.set(e.base.x, e.base.y + 0.004, e.base.z), this._s3.set(H.safe, H.safe, H.safe));
            safe.material.progress = 1; safe.renderOrder = 4;   // the spared circle (white, as the Kettle's lid's), there from the start
            sfx.bowlSing((e.humAt - beat) * 60 / this.bpm);
          }
          if (!e.humDone) {
            const u = THREE.MathUtils.clamp((beat - e.fromBeat) / (e.humAt - e.fromBeat), 0, 1);
            e.turn += dt * (4 + u * 10);                                         // round the rim, faster as it sings
            M.pose('sing', 0, e.turn);
            e.charge = u;                                                        // its song swelling in the bowl
            e.tele[0].material.progress = e.tele[1].material.progress = u;
            e.tele[0].material.opacity = 0.85 + Math.sin(e.t * 12) * 0.15;
            if (u < 1 && Math.random() < dt * 20) this.fx.glow.emit(rim, col, 0.025, 0.006, 0.3, 0.9);   // the song gathering
            if (beat >= e.humAt) {
              e.humDone = true;
              e.clearTele();
              M.pose('strike', 1);
              e.hum = 1; e.kick = 1; e.hitPop = 0.6;
              this.fx.impact(rim, col, LOOK.num('bowl-hum-flash', 0.025), 12);
              this.fx.ring(surf, col, Math.hypot(Math.max(S.max[0] - e.base.x, e.base.x - S.min[0]), Math.max(S.max[1] - e.base.z, e.base.z - S.min[1])), LOOK.num('bowl-hum-shock', 0.5));   // out to the seat's far corner
              this.fx.burst(rim, LOOK.list('bowl-glints', ['#fff2c0', '#cba24b', '#ffffff']), 6, 0.0025, 0.25, e.base.y);
              this.fx.splat(surf, LOOK.color('bowl-shimmer', '#d8c890'), H.safe, 'dust');   // a shimmer where it spared you, fading
              juice.feel('impact-big'); sfx.bowlHum();
              if (P.x >= S.min[0] - cfg.radius && P.x <= S.max[0] + cfg.radius && P.z >= S.min[1] - cfg.radius && P.z <= S.max[1] + cfg.radius && Math.hypot(P.x - e.base.x, P.z - e.base.z) >= H.safe && P.y < e.base.y + H.height) { hit(H.dmg, 'bowl-hum', e.base); knock(e.base, H.knock); this.bowlHurt(this._mid.set(P.x, P.y + cfg.height * 0.5, P.z)); }
            }
          } else if (beat > e.humAt + 1) { e.humAt = null; e.charge = 0; M.pose('rest'); e.state = 'idle'; e.cool = angry ? H.angryRest : H.rest; }
        }
      }

      // ---------------------------------------------------------- the mushroom pillow
      // Both attacks keep the song's time (this.beat), planned in beats as they start (e.plan); if the
      // beat jumps, the attack is called off rather than going off unwarned (as the Singing Bowl's)
      if (e.kind === 'pillow') {
        const M = e.model, SK = e.def.skills, angry = e.hp < e.maxHp * e.def.angry, col = hostile('pillow'), beat = this.beat;
        const jumped = e.plan && Math.abs(beat - e.beatWas - dt * this.bpm / 60) > 1;   // (a frame is far under a beat)
        e.beatWas = beat;
        if (jumped) { const S = e.attack ? SK.fairy : SK.spores; e.cancelAttack(); e.cool = angry ? S.angryRest : S.rest; continue; }
        const inhale = (from, to) => {                                       // the cap breathes in, its spots glowing, spores gathering to it
          const u = THREE.MathUtils.clamp((beat - from) / (to - from), 0, 1);
          M.cap.scale.y *= 1 - u * LOOK.num('pillow-inhale', 0.16); M.cap.scale.x *= 1 + u * 0.05; M.cap.scale.z *= 1 + u * 0.05;
          e.charge = u;
          if (Math.random() < dt * 12 * u) this.fx.glow.emit(this._mid.copy(muzzle).setY(muzzle.y - 0.05 + Math.random() * 0.05).addScaledVector(this._right.set(Math.random() - 0.5, 0, Math.random() - 0.5), 0.3), col, 0.02, 0.005, 0.3, 0.8);
        };
        if (e.attack === 0) {
          // Spores: the cap breathes in, its spots glowing; on a beat it puffs spores that drift over
          // the seat (the first onto where you are) and settle as marked spots, a circle and the
          // column over it filling to the burst; settled, they flash for one beat, then burst on the
          // bar as columns that hit all the way up over a jump: step off the spot. Angry: more, settling faster
          const S = SK.spores;
          if (!e.plan) {
            const drift = angry ? S.angryDrift : S.drift, burst = snapUp(beat + S.windup + drift + 1, S.snap);   // the first snap line far enough off
            e.plan = { from: beat, puff: burst - 1 - drift, settle: burst - 1, burst, n: angry ? S.angrySpots : S.spots };
            sfx.pillowInhale((e.plan.puff - beat) * 60 / this.bpm);
          }
          const L = e.plan;
          if (beat < L.puff) {                                               // breathing in
            inhale(L.from, L.puff);
          } else if (!L.puffed) {                                            // the puff, on the beat
            L.puffed = true;
            const spots = this.pillowSpots(e, P, L.n, S), size = LOOK.num('pillow-spore-size', 0.008);
            e.spores = spots.map((at) => {
              const v = this.volume(col, 'disc', at, this._s3.set(S.radius, LOOK.num('pillow-column', 0.35), S.radius));
              v.material.opacity = LOOK.num('pillow-column-opacity', 0.2);
              e.tele.push(this.warnCircle(at, S.radius, this.T.pillow, LOOK.num('pillow-spot-warning', 0.6)), v);
              const orb = this.fx.orb(col, size);
              orb.position.copy(muzzle);
              return { at, from: muzzle.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.5) * 0.12)), orb, phase: Math.random() * 6.28 };
            });
            e.pop = 1; e.charge = 0.4;
            this.fx.puff(muzzle, LOOK.color('pillow-puff', '#f0c8ff'), LOOK.num('pillow-puff-size', 0.12), 0.7, 0.5);
            this.fx.impact(muzzle, col, LOOK.num('pillow-puff-flash', 0.03), 10);
            juice.feel('hit'); sfx.pillowPuff();
          }
          if (e.spores) {
            const k = THREE.MathUtils.clamp((beat - L.puff) / (L.burst - L.puff), 0, 1), u = THREE.MathUtils.clamp((beat - L.puff) / (L.settle - L.puff), 0, 1);
            const flash = beat >= L.settle ? +(Math.sin((beat - L.settle) * Math.PI * 4) > 0) : 0, arc = LOOK.num('pillow-spore-arc', 0.12);
            e.spores.forEach((sp, i) => {
              const w = e.tele[i * 2], v = e.tele[i * 2 + 1], ease = 1 - (1 - u) * (1 - u);
              w.userData.fill(k); v.material.progress = k;
              if (beat >= L.settle) { const o = LOOK.num('pillow-column-opacity', 0.2); w.material.opacity = 0.5 + 0.5 * flash; v.material.opacity = o + (1 - o) * flash; }
              sp.orb.position.lerpVectors(sp.from, sp.at, ease);
              sp.orb.position.y += Math.sin(Math.min(1, u * 1.4) * Math.PI) * arc + LOOK.num('pillow-spore-size', 0.008);
              sp.orb.position.x += Math.sin(u * 9 + sp.phase) * 0.02 * (1 - u); sp.orb.position.z += Math.cos(u * 7 + sp.phase) * 0.02 * (1 - u);
              this.fx.orbTick(sp.orb, dt, u < 1 ? 1 : 0.7 + flash * 0.9);
            });
            e.charge = 0.4 + flash * 0.6;
            if (beat >= L.settle && !L.settled) {                            // they settle on their spots
              L.settled = true;
              for (const sp of e.spores) this.fx.puff(sp.at.clone().setY(sp.at.y + 0.01), LOOK.color('pillow-puff', '#f0c8ff'), S.radius * 0.6, 0.35, 0.35);
              sfx.pillowSettle(e.spores.length);
            }
            if (beat >= L.burst) {                                           // the burst, on the bar: columns
              let struck = false;
              e.clearTele();                                                 // (its volumes go back to the pool for the columns)
              e.spores.forEach((sp) => {
                const at = sp.at, mid = this._mid.copy(at).setY(at.y + 0.02);
                if (!struck && Math.hypot(P.x - at.x, P.z - at.z) < S.radius + cfg.radius && P.y + cfg.height > at.y && P.y < at.y + LOOK.num('pillow-column', 0.35)) struck = true;   // the column, as tall as it's drawn (over a full jump)
                const pulse = this.volume(col, 'disc', at, this._s3.set(S.radius, LOOK.num('pillow-column', 0.35), S.radius));
                pulse.material.progress = 1;
                this.controllerPulses.push({ m: pulse, t: 0, life: LOOK.num('pillow-column-life', 0.3), o: LOOK.num('pillow-column-burst', 0.5) });
                this.fx.impact(mid, col, LOOK.num('pillow-burst-flash', 0.03), 8);
                for (const h of [0.1, 0.45, 0.8]) this.fx.puff(this._probe.copy(at).setY(at.y + h * LOOK.num('pillow-column', 0.35)), LOOK.color('pillow-puff', '#f0c8ff'), S.radius * 0.9, 0.45, 0.4);
                this.fx.splat(at, LOOK.color('pillow-dust', '#c9a0d8'), S.radius * LOOK.num('pillow-dust-size', 0.7), 'dust');   // spore dust, fading
              });
              if (struck) { hit(S.dmg, 'pillow-spores', P); this.fx.impact(pc, col, 0.02, 8); }
              e.dropSpores();
              e.charge = 0; e.pop = 0.5;
              juice.feel(struck ? 'impact' : 'hit'); sfx.pillowBurst(struck);
              e.plan = null; e.state = 'idle'; e.cool = angry ? S.angryRest : S.rest;
            }
          }
        } else {
          // Fairy ring: the cap breathes in while a circle follows you (where the ring will sprout);
          // on a beat eight caps sprout in a ring round where you stand, their Warnings (a circle and
          // the column over each) filling together; they flash for one beat, then burst on the bar as
          // columns that hit all the way up (over a jump). Hold still in the middle and you're fine;
          // run and you cross a column at once. Angry: after the first bursts, a second ring sprouts
          // where you'd flee (the way you were moving, else away from it), a beat to flash and burst
          const F = SK.fairy, tall = LOOK.num('pillow-column', 0.35), cdim = LOOK.num('pillow-column-opacity', 0.2);
          if (!e.plan) {
            const burst = snapUp(beat + F.windup + F.grow + 1, F.snap);
            e.plan = { from: beat, puff: burst - 1 - F.grow, ring: null, again: angry };
            sfx.pillowInhale((e.plan.puff - beat) * 60 / this.bpm);
          }
          const L = e.plan;
          const sprout = (c, settle) => {                                     // eight caps round c, each with its Warning
            const R = { c, settle, burst: settle + 1, from: settle - F.grow, caps: [], struck: false };
            for (let i = 0; i < F.caps; i++) {
              const a = i / F.caps * Math.PI * 2, at = new THREE.Vector3(c.x + Math.cos(a) * F.ring, c.y, c.z + Math.sin(a) * F.ring);
              const v = this.volume(col, 'disc', at, this._s3.set(F.radius, tall, F.radius));
              v.material.opacity = cdim;
              e.tele.push(this.warnCircle(at, F.radius, this.T.pillow, LOOK.num('pillow-spot-warning', 0.6)), v);
              const cap = this.fx.orb(col, 0.001);                            // (a pooled, instanced sphere, squashed to a cap)
              cap.userData.color.set(LOOK.color('pillow-cap', '#ff7ae8'));
              R.caps.push({ at, cap });
            }
            this.fx.puff(this._probe.copy(c).setY(c.y + 0.01), LOOK.color('pillow-puff', '#f0c8ff'), F.ring, 0.5, 0.45);
            this.fx.impact(c.clone().setY(c.y + 0.01), col, LOOK.num('pillow-puff-flash', 0.03), 10);
            juice.feel('hit'); sfx.pillowPuff();
            return R;
          };
          const dropRing = (R) => { for (const k of R.caps) { k.cap.visible = false; this.fx.free(k.cap); } e.clearTele(); };
          const inColumn = (at) => Math.hypot(P.x - at.x, P.z - at.z) < F.radius + cfg.radius && P.y + cfg.height > at.y && P.y < at.y + tall;
          if (beat < L.puff) {                                               // breathing in, the circle following you
            inhale(L.from, L.puff);
            if (!e.tele.length) e.tele.push(this.warnCircle(P, F.ring + F.radius, this.T.pillow, 0.5));
            this.platformTarget(e, this._mid.copy(P), 0);
            e.tele[0].position.copy(this._mid).setY(this._mid.y + 0.002); e.tele[0].userData.fill(THREE.MathUtils.clamp((beat - L.from) / (L.puff - L.from), 0, 1));
          } else if (!L.ring) {                                              // sprout on the beat, where you stand
            e.clearTele();
            L.ring = sprout(this.platformTarget(e, P.clone(), 0), L.puff + F.grow); L.p0 = P.clone();
            e.pop = 1; e.charge = 0.4;
          }
          for (const R of [L.ring, L.second]) {
            if (!R || R.gone) continue;
            const k = THREE.MathUtils.clamp((beat - R.from) / (R.burst - R.from), 0, 1), grow = THREE.MathUtils.clamp((beat - R.from) / Math.max(0.01, R.settle - R.from), 0, 1);
            const flash = beat >= R.settle ? +(Math.sin((beat - R.settle) * Math.PI * 4) > 0) : 0, o = cdim;
            R.caps.forEach((s, i) => {
              const w = e.tele[i * 2], v = e.tele[i * 2 + 1], size = F.radius * 0.9 * grow;
              w.userData.fill(k); v.material.progress = k;
              if (beat >= R.settle) { w.material.opacity = 0.5 + 0.5 * flash; v.material.opacity = o + (1 - o) * flash; }
              s.cap.position.set(s.at.x, s.at.y + size * 0.3, s.at.z); s.cap.scale.set(size, size * 0.5, size);
              if (!R.struck && beat > R.from + 0.25 && inColumn(s.at)) {      // run into a cap and its column goes off (a quarter beat after it sprouts)
                R.struck = true; hit(F.dmg, 'pillow-fairy', P); this.fx.impact(pc, col, 0.02, 8); juice.feel('impact'); sfx.pillowBurst(true);
              }
            });
            e.charge = 0.4 + flash * 0.6;
            if (beat >= R.settle && !R.settled) { R.settled = true; sfx.pillowSettle(F.caps); }
            if (beat >= R.burst) {                                           // the burst, on the bar: columns
              const struck = R.struck || R.caps.some((s) => inColumn(s.at));
              dropRing(R); R.gone = true;                                    // (its volumes go back to the pool for the columns)
              for (const { at } of R.caps) {
                const pulse = this.volume(col, 'disc', at, this._s3.set(F.radius, tall, F.radius));
                pulse.material.progress = 1;
                this.controllerPulses.push({ m: pulse, t: 0, life: LOOK.num('pillow-column-life', 0.3), o: LOOK.num('pillow-column-burst', 0.5) });
                this.fx.impact(this._mid.copy(at).setY(at.y + 0.02), col, LOOK.num('pillow-burst-flash', 0.03), 8);
                for (const h of [0.1, 0.45, 0.8]) this.fx.puff(this._probe.copy(at).setY(at.y + h * tall), LOOK.color('pillow-puff', '#f0c8ff'), F.radius * 0.9, 0.45, 0.4);
                this.fx.splat(at, LOOK.color('pillow-dust', '#c9a0d8'), F.radius * LOOK.num('pillow-dust-size', 0.7), 'dust');
              }
              if (struck && !R.struck) { hit(F.dmg, 'pillow-fairy', P); this.fx.impact(pc, col, 0.02, 8); }
              e.charge = 0; e.pop = 0.5; juice.feel(struck ? 'impact' : 'hit'); sfx.pillowBurst(struck);
              if (R === L.ring && L.again) {                                 // angry: a second ring where you'd flee
                const away = this._right.set(P.x - L.p0.x, 0, P.z - L.p0.z);
                if (away.length() < 0.03) away.set(R.c.x - e.base.x, 0, R.c.z - e.base.z);
                away.normalize().multiplyScalar(F.flee);
                let c2 = null;
                for (const sign of [1, -1]) {                                // the seat is narrow: if the way you'd flee runs out of it, the other way
                  const t = this.platformTarget(e, new THREE.Vector3(R.c.x + away.x * sign, R.c.y, R.c.z + away.z * sign), 0);
                  if (!c2 || flat2(t, R.c) > flat2(c2, R.c)) c2 = t;
                }
                L.second = sprout(c2, R.burst + F.grow);
              } else { e.plan = null; e.state = 'idle'; e.cool = angry ? F.angryRest : F.rest; }
            }
          }
        }
      }

      // ---------------------------------------------------------- the headphones
      // Both attacks keep the song's time (this.beat), planned in beats as they start (e.plan); if the
      // beat jumps, the attack is called off rather than going off unwarned (as the Singing Bowl's)
      if (e.kind === 'headphones') {
        const M = e.model, SK = e.def.skills, angry = e.hp < e.maxHp * e.def.angry, beat = this.beat, top = e.base.y;
        const jumped = e.plan && Math.abs(beat - e.beatWas - dt * this.bpm / 60) > 1;   // (a frame is far under a beat)
        e.beatWas = beat;
        if (jumped) { const S = e.attack ? SK.stereo : SK.shove; e.cancelAttack(); e.cool = angry ? S.angryRest : S.rest; continue; }
        const cue = () => ({ start: new THREE.Vector3(), dir: new THREE.Vector3(), len: 0.1, yaw: null, parts: null });
        if (e.attack === 0) {
          // Shove waves: the cups take turns, one a bar (shoveCue: a white Warning filling, following you
          // until W.lock beats before, then the wave, which shoves)
          const W = SK.shove;
          if (!e.plan) {
            const first = snapUp(beat + W.windup, W.snap);              // the first snap line at least windup beats away
            e.plan = { from: beat, due: Array.from({ length: W.waves }, (_, k) => first + k * W.every), k: 0, cue: cue() };
          }
          const L = e.plan, n = L.due.length;
          if (L.k < n) {
            const due = L.due[L.k];
            e.locked = beat >= due - W.lock;                              // locked: it holds still
            if (this.shoveCue(e, L.cue, L.k % 2, L.k ? L.due[L.k - 1] : L.from, due, W.lock, P, fwd, dt)) L.k++;
          } else if (beat > L.due[n - 1] + 1) { e.plan = null; e.locked = false; e.state = 'idle'; e.cool = angry ? W.angryRest : W.rest; }
        } else {
          // Stereo: a dividing line down the counter through the Headphones splits the ground (the wake box)
          // into two halves, the low-x half and the high-x half, each its cup's own. The cups take turns: a
          // cup lights up and marks its half (a floor square and the slab S.height over it, in its colour) filling
          // to a beat, then the half bursts and hurts a jelly whose middle is on it. The first half is the one
          // you stand on as it starts; cross to the other on the beat. Angry, S.lead beats after each burst
          // the cup that burst sends a shove wave at you across the line (a cue like the shove attack's)
          const S = SK.stereo, G = e.spec.wake;
          if (!e.plan) {
            const bursts = angry ? S.angryBursts : S.bursts, first = snapUp(beat + S.windup, S.snap);
            e.plan = { from: beat, due: Array.from({ length: bursts }, (_, k) => first + k * S.every), k: 0, half: P.x < e.base.x ? 0 : 1, line: e.base.x, marks: null, cue: cue(), wave: null, angry,
              lowCup: (M.mouths[0].x - M.mouths[1].x) * Math.cos(e.spec.face) <= 0 ? 0 : 1 };   // the cup on the low-x side as it faces its counter's length (not as it turns toward it)
            sfx.headphonesHum((first - beat) * 60 / this.bpm);
          }
          const L = e.plan, n = L.due.length;
          e.locked = true;                                                // it faces its counter's length, so its cups sit one over each half
          const turn = Math.atan2(Math.sin(e.spec.face - e.holder.rotation.y), Math.cos(e.spec.face - e.holder.rotation.y));
          e.holder.rotation.y += turn * (1 - Math.exp(-6 * dt));
          if (L.k < n) {
            const due = L.due[L.k], from = L.k ? L.due[L.k - 1] : L.from, h = (L.half + L.k) % 2;   // h 0: x under the line
            const cup = h ? 1 - L.lowCup : L.lowCup;
            const col = hostile(h ? 'headphones-right' : 'headphones'), x0 = h ? L.line : G.min[0], x1 = h ? G.max[0] : L.line, hw = (x1 - x0) / 2, hd = (G.max[2] - G.min[2]) / 2;
            if (!L.marks) {
              const mid = this._mid2.set(x0 + hw, top, G.min[2] + hd);
              L.marks = [this.mark(e, floorShapeGeometry('square'), this.T.stereo[h], this._probe.set(mid.x, top + 0.002, mid.z), this._s3.set(hw, 1, hd)), this.volume(col, 'symbol-square', mid, this._s3.set(hw, S.height, hd))];
              e.tele.push(L.marks[1]);
            }
            const u = THREE.MathUtils.clamp((beat - from) / (due - from), 0, 1);
            for (const m of L.marks) m.material.progress = u;
            e.lit[cup] = u; M.glows[cup].material.color.copy(col);
            if (u < 1 && Math.random() < dt * 14 * u) this.fx.glow.emit(this.headphonesMouth(e, cup, this._mid).setY(top + 0.03 + Math.random() * 0.04), col, 0.02, 0.006, 0.3, 0.7);   // the air in front of the cup trembling
            if (beat >= due) {                                            // on the beat: the half bursts
              this.dropTele(e, L.marks); L.marks = null;
              e.lit[cup] = 0; e.pump[cup] = 1; e.recoil = 0.4;
              const centre = this._mid2.set(x0 + hw, top, G.min[2] + hd);
              this.fx.impact(this.headphonesMouth(e, cup, this._mid), col, LOOK.num('headphones-stereo-flash', 0.025), 8);
              this.fx.burst(this._mid.set(centre.x, top + 0.02, centre.z), ['#ffffff', col], 8, 0.004, 0.35, top);
              this.fx.splat(centre, LOOK.color('headphones-scuff', '#6c6680'), LOOK.num('headphones-stereo-scuff', 0.1), 'dust');
              juice.feel('hit'); sfx.headphonesBass();
              if (P.x >= x0 && P.x <= x1 && P.z >= G.min[2] && P.z <= G.max[2] && P.y < top + S.height) {
                hit(S.dmg, 'headphones-stereo', this.headphonesMouth(e, cup, this._mid).clone());
                this.buzzHurt(this._mid.set(P.x, P.y + cfg.height * 0.5, P.z), '#' + col.getHexString());
              }
              L.k++;
              if (L.angry && L.k < n && !L.wave) L.wave = { cup, from: due, at: due + S.lead };   // the cup that just burst now aims a shove wave at you
            }
          } else if (beat > L.due[n - 1] + 1) { e.plan = null; e.locked = false; e.state = 'idle'; e.cool = angry ? S.angryRest : S.rest; }
          if (L.wave && this.shoveCue(e, L.cue, L.wave.cup, L.wave.from, L.wave.at, S.lock, P, fwd, dt)) L.wave = null;
        }
      }
    }

    // the Bull's little bulls: popping up, charging along their lanes, and bursting (a squash, a puff
    // and an impact) on the jelly (once a pair: 'bull-mini'), on each other, at the lane's end or
    // off the table's edge. Each is a jelly-sized body: a ball round its middle, as wide as its lane
    for (const b of this.minis) {
      if (b.done) continue;
      b.t += dt;
      const N = CONTENT.elites.bull.skills.minis, m = b.m;
      if (b.state === 'warn') {
        m.scale.setScalar(Math.min(1, 0.01 + b.t * 6));
        m.rotation.x = Math.sin(b.t * 18) * 0.08;                          // pawing the ground
        if (b.owner.dead) { b.state = 'burst'; b.t = 0; }
      } else if (b.state === 'charge') {
        b.along += b.speed * dt;
        m.position.copy(b.at).addScaledVector(b.dir, b.along);
        m.position.y = b.y + Math.abs(Math.sin(b.t * 28)) * 0.006;
        m.rotation.x = 0.18;
        m.scale.setScalar(1);
        if (Math.random() < dt * 20) this.fx.puff(this._mid.copy(m.position).setY(b.y + 0.005), 0xf0d0c0, 0.01, 0.25);
        const c = this._mid.copy(m.position).setY(b.y + N.height / 2);
        let burst = b.along >= N.reach;
        let struckYou = false;
        if (!b.pair.struck && blastHits(c, N.width / 2, P, cfg)) { b.pair.struck = true; burst = struckYou = true; hit(N.dmg, 'bull-mini', c); knock(m.position, N.knock); }
        for (const o of this.minis) if (o !== b && o.pair === b.pair && o.state === 'charge' && o.m.position.distanceTo(m.position) < N.width) { o.state = 'burst'; o.t = 0; burst = true; }
        if (!burst && b.along > N.side && this.surfaceBelow(m.position) < b.y - 0.03) burst = true;   // off the table's edge
        if (burst) {
          b.state = 'burst'; b.t = 0;
          this.fx.impact(c, hostile('bull'), 0.03, 12);
          this.fx.puff(c, 0xf0d0c0, 0.04, 0.4);
          this.fx.burst(c, LOOK.list('bull-fluff', ['#f0d0c0', '#ffffff', '#a83a3a']), 6, 0.003, 0.3, b.y);
          this.fx.splat(this._scuff.set(c.x, b.y, c.z), LOOK.color('bull-scuff', '#6a5048'), LOOK.num('bull-mini-scuff', 0.02), 'dust');
          if (struckYou) juice.feel('impact');
          sfx.bullMini(struckYou);
        }
      } else if (b.state === 'burst') {
        const u = Math.min(1, b.t / 0.18);
        m.scale.set(1 + u * 0.5, Math.max(0.05, 1 - u * 0.8), 1 + u * 0.5);   // squashed flat as it bursts
        if (u >= 1) { b.done = true; this.scene.remove(m); }
      }
    }
    this.minis = this.minis.filter((b) => !b.done);

    // the Cream Whipper's balloons: drifting after you, bobbing, the burst circle filling under
    // them; at 3 s they burst, and caught in it your hearing goes deep for a while
    for (const b of this.balloons) {
      b.t += dt;
      const want = pc.clone().setY(pc.y + 0.1).sub(b.m.position);   // its knot just over your head, the balloon above
      const flat = Math.hypot(want.x, want.z);
      b.vel.x += ((flat > 0.02 ? want.x / flat * 0.2 : 0) - b.vel.x) * (1 - Math.exp(-2.5 * dt));   // slower than you swim (0.42): you can always get away
      b.vel.z += ((flat > 0.02 ? want.z / flat * 0.2 : 0) - b.vel.z) * (1 - Math.exp(-2.5 * dt));
      b.vel.y += (THREE.MathUtils.clamp(want.y * 1.5, -0.16, 0.16) - b.vel.y) * (1 - Math.exp(-3 * dt));   // sinking to your height as it comes
      b.m.position.addScaledVector(b.vel, dt);
      const left = b.fuse - b.t, late = Math.max(0, 1 - left / 0.7);
      b.m.scale.setScalar(b.size * (1 + late * 0.15 + Math.sin(b.t * (6 + late * 40)) * 0.02 * (1 + late * 3)));
      b.m.rotation.set(Math.sin(b.t * 2.2) * 0.15 - b.vel.z * 1.5, 0, Math.cos(b.t * 1.7) * 0.15 + b.vel.x * 1.5);
      b.b.mat.emissiveIntensity = 0.25 + late * 0.8;
      // it sits between a close camera (the jelly's back to a wall) and the jelly: fade it out as the lens comes near, so it never fills the view
      const lens = b.m.position.distanceTo(this.camera.position), near = LOOK.num('balloon-fade-near', 0.1), far = LOOK.num('balloon-fade-far', 0.25);
      b.b.mat.opacity = 0.9 * THREE.MathUtils.smoothstep(lens, near, far);
      b.b.ribbon.visible = b.b.mat.opacity > 0.15;
      // the burst circle on the floor under it
      if ((b.floorT = (b.floorT || 0) - dt) <= 0) { b.floorT = 0.1; b.floor = this.surfaceBelow(b.m.position); }
      b.warn.position.set(b.m.position.x, (b.floor ?? 0) + 0.003, b.m.position.z);
      b.warn.material.progress = Math.min(1, b.t / b.fuse);
      b.warn.material.opacity = 0.7 + 0.3 * Math.abs(Math.sin(b.t * (5 + late * 25)));
      if ((b.tick -= dt) <= 0) { b.tick = Math.max(0.08, left * 0.18); sfx.balloonTick(); }
      if (b.t >= b.fuse) {
        b.done = true;
        const at = b.m.position.clone();
        at.y += b.m.scale.y * BALLOON_MID;                       // round the balloon's middle, above its knot
        this.scene.remove(b.m); this.scene.remove(b.warn);
        const col = '#' + b.b.mat.color.getHexString();
        this.fx.burst(at, [col, col, '#ffffff'], 14, 0.004, 0.35, b.floor ?? at.y - 0.1);           // scraps of rubber
        this.fx.impact(at, hostile('whipper'), 0.05, 18);
        this.fx.ring(new THREE.Vector3(at.x, (b.floor ?? 0) + 0.004, at.z), hostile('whipper'), b.R, 0.4);
        this.fx.puff(at, 0xd8c8ff, b.R * 0.9, 0.9);                                                   // a cloud of gas
        juice.feel('impact');
        sfx.balloonPop();
        // caught: anything of the jelly inside the sphere round it (beside, below or level with it)
        this.fx.splat(this._probe.set(at.x, b.floor ?? at.y - 0.1, at.z), col, LOOK.num('balloon-scrap-size', 0.016));   // its limp scrap, left on the floor
        if (blastHits(at, b.R, P, cfg)) { hit(CONTENT.elites.whipper.skills.balloon.dmg, 'balloon', at); deepen(CONTENT.elites.whipper.skills.balloon.muffle, 3); sfx.daze(); this.fx.impact(pc, hostile('whipper'), LOOK.num('act2-contact-flash', 0.03), 10); }
      }
    }
    this.balloons = this.balloons.filter((b) => !b.done);

    // the Cream Whipper's bead of piped cream: each piece stands its life (from when it was laid), then
    // sags flat and fades, harmless by then. While it stands, anything of the jelly touching it, under
    // its top (height=), is hit once a piping and slowed; jump over it and it misses
    const PS = CONTENT.elites.whipper?.skills.piping;
    let kept = 0;
    for (const b of this.beads) {
      b.t += dt;
      const sag = Math.max(0, (b.t - b.life) / PS.sag);
      if (sag >= 1) { b.m.visible = false; this.beadFree.push(b.m); continue; }
      this.beads[kept++] = b;
      const R = PS.height / 2, dx = b.to.x - b.a.x, dz = b.to.z - b.a.z, full = Math.hypot(dx, dz), len = full * b.u + R;   // its ends round off over the joins
      if (full > 1e-4) b.yaw = Math.atan2(dx, dz);
      const dir = this._beadDir.set(Math.sin(b.yaw), 0, Math.cos(b.yaw)), start = this._beadAt.copy(b.a).addScaledVector(dir, -R / 2);
      b.m.position.copy(start); b.m.position.y += 0.001;
      b.m.rotation.set(0, b.yaw, 0);
      b.m.scale.set(R * (1 + sag * 0.6), R * (1 - sag * 0.85), len);
      b.m.userData.opacity = 1 - sag;
      if (!sag && !b.bead.hit && laneHits(start, dir, len, R * 2, PS.height, P, cfg)) {
        b.bead.hit = true;
        hit(PS.dmg, 'cream', start);
        bus.emit('status_applied', { targetId: PLAYER, status: 'slow', duration: PS.slow });
        this.fx.puff(pc, 0xfffaf0, 0.05, 0.6);
        this.fx.impact(pc, hostile('whipper'), LOOK.num('act2-contact-flash', 0.03), 10);
        this.fx.burst(pc, LOOK.list('cream-bits', ['#fffaf0', '#fff6e8', '#f0e6ff']), 8, 0.004, 0.3, b.a.y);
        this.fx.splat(this._probe.copy(P).setY(b.a.y), LOOK.color('cream-splat', '#fff6e8'), LOOK.num('cream-splat-size', 0.022));
        juice.feel('impact'); sfx.creamSplat();
      }
    }
    this.beads.length = kept;

    // the clock's wreath: a Shot out along its line to where you were (until then, or a wall), spinning,
    // then back to Victory's hand; it flies on through you, hitting you at most once going out and
    // once coming back (2 each), the way it did before it was a Shot
    for (const w of this.thrown) {
      const way = w.out ? 'hitOut' : 'hitBack';
      const struck = this.fx.shotStep(w.shot, dt, this.world, w[way] ? NOWHERE : P, cfg);
      if (struck) { w[way] = true; hit(CONTENT.elites.clock.skills.wreath.dmg, 'clock-wreath', w.shot.m.position); this.clockStruck(P, cfg); }
      w.m.position.copy(w.shot.m.position);
      w.m.rotation.z += dt * 18;
      if (w.shot.done) {
        const home = this.wreathWorld(w.owner) || w.m.position, at = w.m.position, v = w.shot.v.length();
        if (struck && w.out && at.distanceTo(w.aim) > 0.01) w.shot = this.wreathShot(at, w.aim, v);        // on through you to where it was thrown
        else if (w.out && at.distanceTo(home) > 0.01) { w.out = false; w.shot = this.wreathShot(at, home, v); }   // there (or a wall): turn back
        else if (struck && at.distanceTo(home) > 0.01) w.shot = this.wreathShot(at, home, v);                // on back through you
        else { w.done = true; this.scene.remove(w.m); w.owner.model.wreath.visible = true; w.owner.hitPop = 0.5; this.fx.impact(at, hostile('clock'), 0.012, 4); sfx.wreathCatch(); }   // back in her hand
      }
      if (w.owner.dead && !w.done) { w.done = true; this.scene.remove(w.m); this.fx.free(w.shot.m); }
    }
    this.thrown = this.thrown.filter((w) => !w.done);

    // ring walls rolling out (the clock's chimes over the bench, the Alligator's tail slams over
    // the bed), each low: jump them. One that follows a bed hits at the height of the bed under
    // the jelly, if that is near its own (not a jelly down on the floor beside the bed)
    const under = this.rings.some((r) => r.follow) ? this.world.castAll(this._probe.copy(P).setY(P.y + 0.05), DOWN, 1.5)?.point.y : null;
    for (const r of this.rings) {
      if (r.owner && (r.owner.dead || !this.onPlatform(r.owner, P))) { r.r = r.max; r.phase = 'out'; r.echo = null; r.hit = true; }   // its Elite is gone, or you left its ground: it ends here
      const was = r.r;
      if (r.phase === 'wait') r.backAt = Math.min(r.backAt, this.beat + r.echo);   // (the song's beat jumping back can't hold it longer)
      if (r.phase === 'wait' && this.beat >= r.backAt) { r.phase = 'back'; r.hit = false; r.onEcho?.(); }
      else if (r.phase === 'out') r.r = Math.min(r.max, r.r + dt * r.speed);
      else if (r.phase === 'back') r.r = Math.max(r.min, r.r - dt * r.speed);
      if (r.phase === 'out' && r.r >= r.max && r.echo != null) { r.phase = 'wait'; r.backAt = this.beat + r.echo; }
      r.m.scale.setScalar(r.r);
      if (r.band) {
        // a band of the same thickness all the way out: its inner edge kept `band` inside the outer one
        const p = r.m.geometry.attributes.position, n = p.count / 2, k = Math.max(0, 1 - r.band / r.r);
        for (let i = 0; i < n; i++) p.setXYZ(i, p.getX(i + n) * k, 0, p.getZ(i + n) * k);
        p.needsUpdate = true;
      }
      // an echoing ring never fades away: it dims as it goes out, holds dim (harmless) at its reach and
      // brightens through the last beat before it comes back, then fades again as it rolls home
      const fade = r.echo == null ? 1 - r.r / r.max : r.phase === 'wait' ? 0.25 + 0.75 * Math.max(0, 1 - (r.backAt - this.beat)) : r.phase === 'back' ? 1 - 0.7 * (1 - r.r / r.max) : 1 - 0.75 * r.r / r.max;
      r.m.material.opacity = 0.9 * fade;
      r.vol.scale.set(r.r, r.h, r.r);
      r.vol.material.opacity = fade;
      this.fx.glow.hold(this._glowAt.set(r.at.x + r.r, r.m.position.y + 0.004, r.at.z), r.color, 0.03, 0.5);
      const at = !r.follow ? r.at : under != null && Math.abs(under - r.at.y) < 0.06 ? this._ringAt.set(r.at.x, under, r.at.z) : null;
      if (r.follow) {
        // drawn at the height of the bed under the jelly too (easing there), so where you are its wall is as it hits
        r.y += ((at ? at.y : r.at.y) - r.y) * (1 - Math.exp(-12 * dt));
        r.m.position.y = r.y + 0.006;
        r.vol.position.y = r.y;
      }
      const back = r.phase === 'back', hitting = r.phase !== 'wait';
      if (!r.hit && hitting && at && (back ? ringHits(at, Math.max(0, r.r - r.band), was, r.h, P, cfg) : ringHits(at, Math.max(0, was - r.band), r.r, r.h, P, cfg))) { r.hit = true; this.fx.impact(this._scuff.set(P.x, r.y + 0.01, P.z), r.color, 0.02, 8); hit(r.skill.dmg, r.source, r.at); if (r.skill.knock) knock(r.at, r.skill.knock); r.onHit?.(); }   // (a wave with knock= shoves you on, away from where it started)
      if (back ? r.r <= r.min : r.r >= r.max && r.echo == null) { r.done = true; this.scene.remove(r.m); this.scene.remove(r.vol); if (r.band) r.m.geometry.dispose(); if (r.own) r.m.material.dispose(); }
    }
    this.rings = this.rings.filter((r) => !r.done);

    // the Headphones' sound waves rolling out over the counter: nested arcs lying flat at the
    // height they shove up to, widest in front. Its front passing a jelly under that height (on the
    // table, in its lane) shoves it along, once, and doesn't hurt; a jelly that jumped it stays put
    let wi = 0;
    for (const w of this.waves) {
      const was = w.f, W = w.W;
      w.f = Math.min(w.len, w.f + dt * W.speed);
      const dx = P.x - w.from.x, dz = P.z - w.from.z, along = dx * w.dir.x + dz * w.dir.z, across = Math.abs(dx * w.dir.z - dz * w.dir.x);
      if (!w.hit && along > was - cfg.radius && along < w.f + cfg.radius && across < W.width / 2 + cfg.radius && P.y < w.from.y + W.height && P.y > w.from.y - 0.04) {
        w.hit = true;
        this.washT = W.carry; this.washDir = w.dir.clone().multiplyScalar(W.push / W.carry);
        this.fx.impact(this._scuff.set(P.x, P.y + 0.02, P.z), this.waveColor, LOOK.num('headphones-shove-flash', 0.02), 6);
        sfx.headphonesShove();
      }
      if (Math.random() < dt * 30) this.fx.glow.emit(this._glowAt.copy(w.from).addScaledVector(w.dir, w.f * Math.random()).setY(w.from.y + 0.005), this.waveColor, 0.015, 0.008, 0.5, 0.5);   // motes lifting off the glass behind it, fading
      const R = W.width / 2 / Math.sin(WAVE.spread / 2), fade = Math.min(1, (1 - w.f / w.len) * 6, w.f / 0.03);
      const centre = this._probe.copy(w.from).addScaledVector(w.dir, w.f - R).setY(w.from.y + W.height);
      this._q.setFromAxisAngle(UP, Math.atan2(-w.dir.z, w.dir.x));
      for (let k = 0; k < WAVE.arcs && wi < WAVE.pool * WAVE.arcs; k++, wi++) {
        const rk = Math.max(0.01, R - k * WAVE.gap);
        this.waveArcs.setMatrixAt(wi, this._m4.compose(centre, this._q, this._s3.set(rk, rk, rk)));
        this.waveArcs.setColorAt(wi, this._dropC.copy(this.waveColor).multiplyScalar((1 - k * 0.16) * fade));
      }
      if (w.f >= w.len) w.done = true;
    }
    if (this.waves.length || this.waveArcs.userData.shown) {
      for (let i = wi; i < WAVE.pool * WAVE.arcs; i++) this.waveArcs.setMatrixAt(i, this._m4.makeScale(0, 0, 0));
      this.waveArcs.instanceMatrix.needsUpdate = true; this.waveArcs.instanceColor.needsUpdate = true;
      this.waveArcs.userData.shown = wi > 0;
    }
    this.waves = this.waves.filter((w) => !w.done);

    // soap bubbles drifting out from the Soap Dispenser: they pop on you, on walls, or when they've gone far enough
    for (const b of this.soapBubbles) {
      b.t -= dt;
      b.m.position.addScaledVector(b.v, dt);
      b.m.position.y = b.y + Math.sin(b.t * 5 + b.wob) * 0.006;   // bobbing as it drifts
      const wob = 1 + Math.sin(b.t * 9 + b.wob) * 0.06;
      b.m.scale.set(SOAP_COLUMN.r * wob, SOAP_COLUMN.half / wob, SOAP_COLUMN.r * wob);
      this.fx.glow.hold(b.m.position, hostile('soap'), 0.05, 0.55);
      if (this.world.cast(b.m.position, this._dir.copy(b.v).normalize(), b.v.length() * dt + SOAP_COLUMN.r)) b.t = 0;
      // a column of foam from near the floor to above a jump: anything of the jelly level with it is hit
      if (SOAP_COLUMN.at.some((y) => shotHits(this._probe.copy(b.m.position).setY(b.y - SOAP_COLUMN.mid + y), SOAP_COLUMN.r, P, cfg))) { hit(CONTENT.elites.soap.skills.ring.dmg, 'soap-bubble', b.m.position); b.t = 0; b.hitYou = true; }
      if (b.t <= 0) {
        this.scene.remove(b.m);
        const floor = this.surfaceBelow(b.m.position);                 // where its suds land (once, as it pops)
        this.fx.burst(b.m.position, ['#ffe0ee', '#ff8ac0', '#ffffff'], 4, 0.003, 0.2, floor);
        this.fx.ring(b.m.position.clone(), hostile('soap'), 0.014, 0.18);
        if (b.hitYou) this.fx.impact(b.m.position, hostile('soap'), LOOK.num('act2-contact-flash', 0.03) * 0.6, 8);   // it burst on the jelly
        this.fx.splat(this._probe.set(b.m.position.x, floor, b.m.position.z), LOOK.color('soap-suds', '#f6e4ee'), LOOK.num('soap-suds-size', 0.009));
        sfx.bubblePop();
      }
    }
    this.soapBubbles = this.soapBubbles.filter((b) => b.t > 0);

    // the Soap Dispenser's bubble traps: drifting after you; shot, they pop harmlessly; one that
    // reaches you holds you and carries you toward the Dispenser for T.hold s, then pops on you
    for (const B of this.traps) {
      const T = B.T, m = B.m, soap = this.list.find((x) => x.kind === 'soap');
      if (B.loose && !B.held && !B.dead) {
        B.t += dt;
        const want = this._dir.copy(pc).sub(m.position), d = want.length();
        B.vel.lerp(want.multiplyScalar(d > 0.005 ? T.speed / d : 0), 1 - Math.exp(-2 * dt));
        m.position.addScaledVector(B.vel, dt);
        m.scale.setScalar(T.radius * (1 + Math.sin(B.t * 7) * 0.05));
        if (shotHits(m.position, T.radius * 0.8, P, cfg)) { B.held = 1e-6; B.from = m.position.clone(); sfx.bubblePop(); this.fx.impact(pc, hostile('soap'), 0.02, 6); juice.feel('hit'); }
        else if (B.t > T.life) B.dead = true;
      }
      if (B.held) {
        // trapped: the bubble round the jelly, carried toward the Dispenser (or held still)
        B.held += dt;
        const home = soap ? this._to.copy(soap.base) : B.from, toHome = this._dir.set(home.x - B.from.x, 0, home.z - B.from.z);
        const L = toHome.length(); if (L > 0.12) B.from.addScaledVector(toHome, Math.min(L - 0.12, T.carry * dt) / L);
        this.pull = this._pull.set((B.from.x - P.x) * 12, 0, (B.from.z - P.z) * 12);
        m.position.copy(pc); m.scale.setScalar(T.radius * 1.3 * (1 + Math.sin(B.held * 30) * 0.04));
        if (B.held >= T.hold && !B.dead) {
          B.dead = true;
          hit(T.dmg, 'soap', P); this.slick(this._probe.copy(P).setY(this.surfaceBelow(P))); bus.emit('status_applied', { targetId: PLAYER, status: 'slip', duration: 0.6 });
          this.fx.impact(pc, hostile('soap'), LOOK.num('act2-contact-flash', 0.03), 12); juice.feel('impact');
        }
      }
      if (B.loose && !B.held && !B.dead) { B.warn.position.set(m.position.x, this.surfaceBelow(m.position) + 0.003, m.position.z); B.warn.material.progress = Math.min(1, B.t / T.life); }
      else if (!B.loose) B.warn.position.set(m.position.x, this.surfaceBelow(m.position) + 0.003, m.position.z);
      if (B.dead && !B.gone) {
        B.gone = true; B.entry.dead = true; this.enemies.byId?.delete(B.entry.id);
        this.scene.remove(m); this.scene.remove(B.warn);
        const floor = this.surfaceBelow(m.position);
        this.fx.burst(m.position, ['#ffe0ee', '#ff8ac0', '#ffffff'], 10, 0.003, 0.3, floor);
        this.fx.ring(m.position.clone().setY(floor + 0.003), hostile('soap'), T.radius, 0.3);
        this.fx.splat(this._probe.set(m.position.x, floor, m.position.z), LOOK.color('soap-suds', '#f6e4ee'), T.radius * 0.5);
        sfx.bubblePop();
      }
    }
    this.traps = this.traps.filter((B) => !B.gone);
    // soap slicks: standing in one, you slip
    for (const p of this.slicks) {
      p.t -= dt;
      p.m.scale.setScalar(p.r * Math.min(1, p.t * 2, (5 - p.t) * 8 + 0.2));
      const edge = p.m.children[0].material;
      edge.opacity = 0.35 + Math.sin(performance.now() / 200) * 0.1;
      const d = Math.hypot(P.x - p.m.position.x, P.z - p.m.position.z);
      if (d < p.r && Math.abs(P.y - p.m.position.y) < 0.02 && player.grounded) bus.emit('status_applied', { targetId: PLAYER, status: 'slip', duration: 0.35 });
      if (p.t <= 0) this.scene.remove(p.m);
    }
    this.slicks = this.slicks.filter((p) => p.t > 0);

    // Shots in flight: each hits the jelly's whole body
    for (const b of this.bullets) {
      const struck = this.fx.shotStep(b, dt, this.world, P, cfg);
      if (struck) hit(b.damage, b.source, b.m.position);
      if (b.done) b.onEnd?.(b, struck);
    }
    this.bullets = this.bullets.filter((b) => !b.done);
    for (const p of this.controllerPulses) {
      p.t += dt;
      p.m.material.opacity = Math.max(0, 1 - p.t / p.life) * (p.o ?? LOOK.num('controller-pulse-opacity', 0.45));
      if (p.t >= p.life) this.scene.remove(p.m);
    }
    this.controllerPulses = this.controllerPulses.filter(p => p.t < p.life);

    // lobbed things in flight, with their warning circles filling
    for (const b of this.blobs) {
      b.t += dt;
      const k = Math.min(1, b.t / (b.wait + b.T)), f = Math.max(0, Math.min(1, (b.t - b.wait) / b.T));   // the Warning's fill, and how far it has flown
      if (b.t >= b.wait) {
        if (!b.flown) { b.flown = true; b.onLaunch?.(b); }   // the frame it leaves
        b.m.visible = true;
        b.m.position.lerpVectors(b.from, b.to, f);
        b.m.position.y += 4 * b.arc * f * (1 - f);   // a thrown arc: steady across, gravity pulling it up and back down to its apex `arc` over the line
        this.fx.orbTick(b.m, dt, 1.2);
      }
      b.warn.userData.fill(k);
      if (b.vol) b.vol.material.progress = k;
      if (f >= 1) {
        this.fx.free(b.m);
        this.scene.remove(b.warn);
        if (b.vol) this.scene.remove(b.vol);
        b.onLand?.(b.to);
        b.done = true;
      }
    }
    this.blobs = this.blobs.filter((b) => !b.done);

    // the Kettle's steam bursts: one gust every skill.gap s; the first lands with the ball
    for (const b of this.steams) {
      b.t += dt;
      const S = b.skill, kettle = hostile('kettle');
      b.warn.material.opacity = 0.55 + Math.sin(b.t * 40) * 0.2;
      b.vol.material.opacity = Math.max(0.2, 1 - b.k / S.gusts);
      while (b.k < S.gusts && b.t >= b.k * S.gap) {
        const first = b.k === 0, a = b.k * 2.4 + Math.random(), off = first ? 0 : b.r * 0.35;
        const p = this._mid.set(b.at.x + Math.cos(a) * off, b.at.y + 0.01, b.at.z + Math.sin(a) * off);
        this.fx.puff(p, 0xffffff, b.r * (first ? 1.6 : 1.1 + Math.random() * 0.3), 0.55);   // a gust boiling up and out
        for (let i = 0, n = first ? 6 : 3; i < n; i++) {
          const q = a + i * Math.PI * 2 / n;
          this.fx.puff(this._mid2.set(b.at.x + Math.cos(q) * b.r * 0.7, b.at.y + 0.006, b.at.z + Math.sin(q) * b.r * 0.7), 0xf2f6ff, b.r * 0.6, 0.45);
        }
        this.fx.puff(p.setY(p.y + b.r * 0.8), 0xf2f6ff, b.r * 0.9, 0.8);
        this.fx.ring(b.at.clone().setY(b.at.y + 0.004), kettle, b.r * (first ? 1.5 : 1.15), 0.35);   // its reach
        if (first) { this.fx.impact(b.at.clone().setY(b.at.y + 0.01), kettle, 0.035, 16); this.fx.burst(b.at.clone().setY(b.at.y + 0.01), [0xffffff, 0xd8ecff, kettle.getHex()], 10, 0.004, 0.4, b.at.y); }
        const struck = blastHits(b.at, b.r, P, cfg);
        if (struck) { hit(S.dmg, 'kettle', b.at); knock(b.at, 0.8); }
        if (struck && !b.struck) { b.struck = true; this.fx.impact(pc, kettle, 0.025, 10); this.fx.puff(pc, 0xffffff, 0.025, 0.4); juice.feel('impact'); }   // scalded where it reaches you
        else if (first) juice.feel('hit');
        sfx.kettleGust(struck, first);
        b.k++;
      }
      if (b.k >= S.gusts && b.t >= S.gusts * S.gap) {
        this.scene.remove(b.warn); this.scene.remove(b.vol);
        for (let i = 0; i < 3; i++) { const a = i * 2.1 + Math.random(); this.fx.splat(this._mid.set(b.at.x + Math.cos(a) * b.r * 0.5, b.at.y, b.at.z + Math.sin(a) * b.r * 0.5), LOOK.color('kettle-wet', '#b8c8d8'), LOOK.num('kettle-wet-size', 0.03) * (0.7 + i * 0.2)); }   // a harmless wet patch, fading
        b.done = true;
      }
    }
    this.steams = this.steams.filter((b) => !b.done);

    // scalding puddles
    let scalded = false;
    for (const p of this.puddles) {
      p.t -= dt;
      p.m.scale.setScalar(p.r * Math.min(1, p.t * 2));
      const d = Math.hypot(P.x - p.m.position.x, P.z - p.m.position.z);
      if (d < p.r && Math.abs(P.y - p.m.position.y) < 0.02 && player.grounded) { scalded = true; bus.emit('damage_taken', { targetId: PLAYER, amount: CONTENT.elites.mug.skills.coffee.drain * dt, source: 'coffee', drain: true }); bus.emit('status_applied', { targetId: PLAYER, status: 'slow', duration: 0.3 }); }
      if (p.t <= 0) this.scene.remove(p.m);
    }
    // the jelly answers the scald: steam and a sizzle off it, a few times a second while it stands in one
    this.scaldT = scalded ? (this.scaldT || 0) - dt : 0;
    if (scalded && this.scaldT <= 0) { this.scaldT = 0.25; this.fx.puff(P, 0xffffff, 0.015, 0.4); this.fx.impact(P, hostile('mug'), 0.008, 3); sfx.scald(); }
    this.puddles = this.puddles.filter((p) => p.t > 0);
  }
}
