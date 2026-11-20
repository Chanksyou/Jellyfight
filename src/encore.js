// Act 4's boss, the Encore: the DJ booth on the arena's stage (act4-arena.js, encore-model.js). It
// doesn't move; it plays its set (SetList below), every attack on its song's beat, and what the set
// holds depends on its stage, read from its Health (bosses.kdl `stages`), never the clock:
//   warm-up (while its opening force field is up): the floor waves (encore-floor.js), one at a time;
//   set 1: a laser on every wave (encore-laser.js);
//   set 2 (75%): disco ball visits (encore-disco.js) too;
//   set 3 (50%): the disco ball down for good (after the short-out), and the DJs' duet, the Wall of
//   sound (encore-wall.js), in the solo slots;
//   the last song (25%, a toast): waves always two at a time, and a solo slot every 10 bars: silver,
//   gold, duet, round again, with nothing between but the waves. The boss bar says whose solo it is, or
//   BOW · EXPOSED; the first bow and the first standing record before a wall each get a hint, once ever
//   (first-run.js EncoreHints).
// In set 1 to 3, every 16 bars from the end of the warm-up one DJ solos (slot, solo): for 4 bars a spotlight is on him
// and his wing lit his colour, the lasers rest and the other DJ plays a wave every 8 beats (none in a duet), while he
// plays his solo attack (the silver DJ's Record toss, encore-records.js; the gold DJ's Pyro, encore-pyro.js). Then he bows (bosses.kdl
// `solo`): for 2 bars, or 4 if no hit reached the jelly during his solo, the Encore is EXPOSED and
// hits on it do 1.5x. The song's breakdown bows both DJs, exposed too. In the duet (bosses.kdl `wall`)
// both DJs are lit and the floor rests: the silver DJ throws three records, the whole floor fills as a
// Warning but for a strip behind each, the wall rolls, and both bow, exposed. The speaker pulse that
// used to play in every set is gone (E5): the Wall of sound replaced it.
// Its stage edge shocks a jelly that touches it (encore-contact.js).
// It opens behind a force field (bosses.kdl start `guard`) that hits bounce off. Otherwise your attacks
// hurt it like any boss (its hit sphere is in front of the booth, clear of the stage's collider), and
// at 0 Health the set stops and it is beaten.
//
// At half Health its booth shorts out (`meltdown`): a short cut scene (main.js plays `cut`: the game
// holds and the camera cuts to the booth) of sparks spraying out of it, smoke, its LED panels
// flickering and dying red, the DJs jolting. From then on it keeps sparking and smoking, its panels
// pulse red on the beat, and its disco ball comes down for good (encore-disco.js stay).
//
// Like the other bosses (vacuum.js), what it does to you goes out as events (damage_taken) and the
// shove of its standing records comes back as `push`. Its beat comes from the song (main.js hands it a
// `song`: beat(dt), quiet(beat), drop(beat)); without one it keeps its own tempo clock.
import * as THREE from 'three';
import { bus, PLAYER } from './events.js';
import { CONTENT } from './content.js';
import { LOOK } from './look.js';
import { sfx } from './sfx.js';
import { juice } from './juice.js';
import { VolumeMaterial, volumeGeometry, hostile } from './vfx.js';
import { TRACKS } from './song-track.js';
import { EncoreFloor } from './encore-floor.js';
import { ENCORE } from './stage4.js';
import { EncoreLasers } from './encore-laser.js';
import { EncoreDisco } from './encore-disco.js';
import { EncoreContact } from './encore-contact.js';
import { EncoreRecords, landing } from './encore-records.js';
import { EncoreWall } from './encore-wall.js';
import { EncorePyro } from './encore-pyro.js';
import { EncoreHints } from './first-run.js';

// what it does, for the attack audit (src/stories/kit.js EVERY_ATTACK)
export const ATTACKS = { calm: ['floor', 'laser', 'disco', 'contact', 'records', 'pyro', 'wall'], angry: [] };
const DJS = ['silver', 'gold'], WING = { silver: 'leftWing', gold: 'rightWing', duet: 'all' }, SOLOISTS = { silver: ['silver'], gold: ['gold'], duet: DJS };
// each DJ's solo attack: books what he plays from bar line `at`
const SOLO_ATTACKS = {
  // the silver DJ's Record toss: a record a bar (from his mark, from the second bar: the first he vaults out)
  silver(at, S) {
    const R = this.def.skills.records || {}, bars = this.def.skills.solo?.bars ?? 4;
    for (let k = S.mark ? 1 : 0; k < bars; k++) {
      const land = at + k * 4;
      if (this.quiet(land)) continue;                      // (the breakdown rests it, as it rests the floor)
      this.records.cast(land, { from: () => this.hand('silver'), target: () => this.jellyAt(),
        dmg: R.dmg ?? 4, height: R.height ?? 0.25, stand: (R.stand ?? 4) * 4, flight: R.flight ?? 1, windup: R.windup ?? 3, lock: R.lock ?? 1 });
    }
  },
  // the gold DJ: a bar to crank his fader and show the first Warning, then a set of lanes a beat (odd lanes, even lanes)
  gold(at) {
    const R = this.def.skills.pyro || {}, bars = this.def.skills.solo?.bars ?? 4;
    for (let k = 0; k < (bars - 1) * 4; k++) {
      const fire = at + 4 + k;
      if (this.quiet(fire)) continue;
      this.pyro.cast(fire, { lanes: [0, 1, 2].map((i) => i * 2 + (k % 2)), dmg: R.dmg ?? 4, height: R.height ?? 0.35, reach: R.reach ?? 0.48, warn: R.warn ?? 2, burn: R.burn ?? 0.5, scorch: R.scorch ?? 8 });
    }
  },
  // the duet, the Wall of sound: the silver DJ throws `records` records a bar apart, facing the stage, each
  // landing `apart` from the ones before; as the last lands the wall's Warning starts (2 bars), and it rolls
  // as the solo's bars end (S.end); the floor rests until a bar after that, and both DJs bow `bow` bars.
  // On the floor (ENCORE.marks.duet) both vault out for the first bar, so it is a bar longer: records on
  // A+4, A+8, A+12, the roll on A+20 (both push it out), the bow to A+28, home in its last 2 beats
  duet(at, S) {
    const R = this.def.skills.records || {}, W = this.def.skills.wall || {}, n = W.records ?? 3, casts = [], k0 = S.mark ? 1 : 0;
    S.warnAt = at + (n - 1 + k0) * 4; S.end += k0 * 4; S.rest = S.end + 4; S.bow = (W.bow ?? 2) * 4;
    if (S.mark) S.bowAt = S.end + (W.roll ?? 2);                       // (on the floor they push the wall out first, then bow)
    for (let b = S.warnAt; b <= S.rest; b++) if (this.quiet(b)) { S.wall = { state: 'off' }; return; }   // (the song's breakdown would rest it mid-wall: called off, the plain set plays)
    for (let k = 0; k < n; k++) {
      const land = at + (k + k0) * 4, before = casts.slice();
      if (this.quiet(land)) continue;
      const c = this.records.cast(land, { from: () => this.hand('silver'), target: () => this.cover(before, W.apart ?? 0.2),
        dmg: R.dmg ?? 4, height: R.height ?? 0.25, stand: S.end + (W.roll ?? 2) - land, flight: R.flight ?? 1, windup: R.windup ?? 3, lock: R.lock ?? 1, face: 0 });
      if (c) casts.push(c);
    }
    S.wall = this.wall.cast(S.warnAt, S.end, casts, { dmg: W.dmg ?? 6, height: W.height ?? 0.4, roll: W.roll ?? 2, safe: W.safe ?? 0.1, behind: W.behind ?? 0.3, knock: W.knock ?? 0.6 });
  },
};
// where each DJ of a solo of `kind` stands on the floor ({ silver: [x, 0, z], ..., mid: the middle of
// them }, ENCORE.marks), or null: it plays from the booth
function floorMarks(kind) {
  const m = ENCORE.marks?.[kind];
  if (!m) return null;
  const who = SOLOISTS[kind], out = { mid: [0, 0, 0] };
  for (const d of who) {
    const p = Array.isArray(m) ? m : m[d];
    out[d] = [p[0], 0, p[1]]; out.mid[0] += p[0] / who.length; out.mid[2] += p[1] / who.length;
  }
  return out;
}
// round the jelly, where a duet's next record goes: at it, or the nearest of 12 spots `apart` round it
// that is that far from every record `before` it (towards the middle of the floor first), never so near
// the back of the floor that its safe strip has no room
const ROOM = 0.15, _spot = [0, 0], _try = [0, 0];
const FLOOR_BACK = (ENCORE.tiles * ENCORE.tileSize) / 2;   // the back of the floor (z): where the wall rolls to
// where your attacks find it: in front of the booth, so a bubble reaches it before the stage's collider
const TARGET = [0, 0.13, -0.17], BOOTH_R = 0.14;
const _hit = new THREE.Vector3(), _wa = new THREE.Vector3(), _wb = new THREE.Vector3();

export class Encore {
  constructor(scene, enemies, fx, B, world, ctx = {}) {
    Object.assign(this, { scene, enemies, fx, B, world });
    this.arenaView = ctx.arena;
    this.song = ctx.song || null;
    this.music = 'encore';                // what run.js musicState plays for it (music.js / song-track.js)
    this.def = CONTENT.bosses.encore;
    this.maxHp = this.hp = this.def.hp;
    this.r = BOOTH_R;
    this.dead = false; this.dying = false; this.rise = 1;
    this.state = 'set';
    this.t = 0; this.clock = 0; this.beat = null;
    this.flash = 0;
    this.guardT = this.def.skills.start?.guard ?? 0; this.opening = this.guardT > 0;   // its force field is up as the fight opens (bosses.kdl start `guard`)
    this.holder = new THREE.Object3D(); this.holder.position.set(...TARGET);
    const A = this.arenaView;
    // each hit lands with a flash and sparks at the jelly in that attack's colour
    this.floor = new EncoreFloor(A, { onHit: (dmg, c) => this.hurtPlayer(dmg, hostile(`encore-${c?.dj === 'gold' ? 'gold' : 'silver'}`), c?.dj) });
    this.lasers = new EncoreLasers(A, { fx, onHit: (dmg) => this.hurtPlayer(dmg, hostile('encore-laser')) });
    this.disco = new EncoreDisco(A, { fx, onHit: (dmg) => this.hurtPlayer(dmg, hostile('encore-disco')), quiet: (b) => this.quiet(b) || this.walling(b) });
    this.shove = { x: 0, z: 0 };
    this.contact = new EncoreContact(scene, A.shockSolids, { onShock: (dmg, point) => {
      this.hurtPlayer(dmg); sfx.zap?.();
      const away = new THREE.Vector3().subVectors(this.player.position, point).setY(0);
      if (away.lengthSq() > 1e-8) bus.emit('knockback', { targetId: PLAYER, dir: away.normalize(), force: 0.4 });
    } });
    this.records = new EncoreRecords(A, fx, { onHit: (dmg) => this.hurtPlayer(dmg, hostile('encore-silver'), this.watcher()), color: hostile('encore-silver'), scene });
    this.pyro = new EncorePyro(A, fx, { onHit: (dmg) => this.hurtPlayer(dmg, hostile('encore-gold')), color: hostile('encore-gold'), scene });
    this.wall = new EncoreWall(A, fx, { color: hostile('encore-wall'), scene, onHit: (dmg, w) => {
      this.hurtPlayer(dmg, hostile('encore-wall'));
      bus.emit('knockback', { targetId: PLAYER, dir: new THREE.Vector3(0, 0, 1), force: w.knock });   // the wall carries it a little way
    } });
    this.solo = null; this.soloTurn = { last: null }; this.restBow = false; this.hints = new EncoreHints(); this.toldLast = false;
    this.spots = Object.fromEntries(DJS.map((who) => [who, spotlight(A, who)]));
    this.spotHome = Object.fromEntries(DJS.map((who) => [who, this.spots[who].position.clone()]));
    this.flinchT = 0; this.watch = { w: 0, who: null, of: null }; this.keep = [0, 0, 0];   // (a DJ on the floor: his flinch, his partner's look, his records' keep-out)
    for (const who of DJS) { A.boss.travel(who, 'home', { secs: 1e-3 }); A.boss.perform(who, null); }   // (the arena outlives a fight: a DJ a last fight left out goes home)
    this.bowLift = Number(LOOK.list('encore-dance-bow', [])[3]) || 1.5;    // beats a bow takes to come back up
    // a hit on the jelly during a solo spoils it: the bow after is the short one
    // (up to a beat before its end, when he goes into his bow and its length is settled)
    this.offHurt = bus.on('damage_taken', (e) => { const S = this.solo; if (e.targetId === PLAYER && e.amount > 0 && S && !S.bowing && this.beat !== null && this.beat >= S.at) S.clean = false; });
    this.colors = { silver: hostile('encore-silver'), gold: hostile('encore-gold'), duet: hostile('encore-wall') };
    this.set = null;
    this.field = forceField(A.boss); A.root.add(this.field); this.fieldScale = this.field.scale.clone();
    this.booth = boothBox(A.boss);
    this.broken = false; this.cut = null; this.hurtT = 0; this.sparkT = 0; this.home = A.boss.root.position.clone();
    this.sparks = new Sparks(A.root);
  }

  get position() { return this.holder.position; }
  center(out = new THREE.Vector3()) { return out.copy(this.holder.position); }
  // up while it warms up as the fight opens, and while it reboots after shorting out (guardT)
  get shielded() { return this.guardT > 0; }
  get immune() { return !!(this.cut || this.falling) || this.shielded; }   // damage() does nothing now: attacks shouldn't pick it

  // where the fight is: 'warmup' behind its opening force field, then by its Health (bosses.kdl
  // `stages`: at or below each gate, the next stage) 'set1', 'set2', 'set3', 'last'
  get stage() {
    if (this.opening) return 'warmup';
    const f = this.hp / this.maxHp, g = this.def.skills.stages || {};
    return f <= (g.last ?? 0.25) ? 'last' : f <= (g.set3 ?? 0.5) ? 'set3' : f <= (g.set2 ?? 0.75) ? 'set2' : 'set1';
  }
  // a solo slot (kind 'silver', 'gold' or 'duet') from bar line `at`: that DJ solos, if he has a solo
  // attack yet (else the plain set plays through); false if it didn't start (one already plays)
  // (none while its force field is up: no DJ leaves the booth then; nor while he is still on his way home)
  slot(kind, at) {
    const marks = floorMarks(kind);
    if (!SOLO_ATTACKS[kind] || this.solo || this.shielded || (marks && SOLOISTS[kind].some((d) => this.arenaView.boss.out(d)))) return false;   // (one at a time: 16 bars apart, a solo and its bow take 8 at most)
    const bars = this.def.skills.solo?.bars ?? 4, air = this.def.skills.floor?.air ?? 2;
    this.solo = { who: kind, at, end: at + bars * 4, bowEnd: null, clean: true, bowing: false, lit: false };
    // a solo with a mark plays on the floor: its DJs take off `air` beats before it (at once, if it was booked late);
    // `marks` where each stands, `mark` the middle of them
    if (marks) Object.assign(this.solo, { marks, mark: marks.mid, off: Math.min(at - 0.25, Math.max(at - air, this.beat ?? -Infinity)) });
    SOLO_ATTACKS[kind].call(this, at, this.solo);
    return true;
  }
  // who solos in the bar from beat `at` (the set list's question: the lasers rest, the other DJ plays a wave every 8 beats)
  // (a duet rests the floor a bar longer, through the wall's roll)
  soloing(at) { const S = this.solo; return S && at >= S.at && at < (S.rest ?? S.end) ? S : null; }
  // the duet's wall is up (its Warning or its roll) on beat `b`: the disco ball rests, so the strips stay safe
  walling(b) { const w = this.solo?.wall; return !!w && w.state !== 'off' && b >= w.warnAt && b < w.end; }
  // a duet record's landing spot (see ROOM)
  // (if none of them is far enough, the one farthest from the rest)
  cover(before, apart) {
    const [x, z] = this.jellyAt(), r = this.records.r, e = this.records.edge, keep = this.records.keep, back = FLOOR_BACK - ROOM, base = Math.atan2(0.3 - z, -x);
    let best = -1;
    for (let k = -1; k < 12; k++) {
      const a = base + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * Math.PI / 6, d = k < 0 ? 0 : apart;
      landing(x + Math.cos(a) * d, Math.min(z + Math.sin(a) * d, back), r, e, _try, keep);
      let near = Infinity;
      for (const c of before) near = Math.min(near, Math.hypot(_try[0] - c.to[0], _try[1] - c.to[1]));
      if (near > best) { best = near; _spot[0] = _try[0]; _spot[1] = _try[1]; }
      if (near >= apart) break;
    }
    return _spot;
  }
  // EXPOSED: bowing after a solo, or both DJs bowing in the song's breakdown: hits do bosses.kdl `solo exposed` x
  get exposed() {
    const b = this.beat, S = this.solo;
    if (b === null || this.dead || this.cut || this.falling || this.shielded) return false;
    return !!(S && S.bowEnd !== null && b >= S.end && b < S.bowEnd) || (this.quiet(b) && this.quiet(b - 1));   // (the breakdown's bow is down a beat in)
  }
  // the word after its name on the boss bar: the soloing DJ, or the bow (hits do more)
  get tag() {
    const S = this.solo, b = this.beat;
    if (this.exposed) return 'BOW · EXPOSED';
    return S && b !== null && b >= S.at && b < S.end ? (S.who === 'duet' ? 'DUET' : `${S.who.toUpperCase()} DJ SOLO`) : null;
  }
  // its first-time lines: the last song (a toast each fight), and the hints (once ever): the first bow,
  // the first duet record standing before its wall
  announce() {
    if (this.stage === 'last' && !this.toldLast) { this.toldLast = true; bus.emit('toast', { text: 'The last song! Waves come two at a time.', ms: 2800 }); }
    const S = this.solo, id = this.exposed && S?.bowing ? 'bow' : S?.who === 'duet' && this.records.casts.some((c) => c.state === 'stand') ? 'cover' : null, text = id && this.hints.take(id);
    if (text) bus.emit('toast', { text, ms: 3600 });
  }
  // where the jelly is ([x, z], one array reused)
  jellyAt() { const a = (this._at ||= [0, 0]); a[0] = this.player.position.x; a[1] = this.player.position.z; return a; }
  // whose fist pumps when the soloist's attack hits: his partner, watching from the booth (none in a duet)
  watcher() { const S = this.solo; return S?.mark && S.who !== 'duet' ? (S.who === 'silver' ? 'gold' : 'silver') : null; }
  // the DJs out on the floor (each from his take-off till he lands home): the Encore's one target (one array, reused)
  outDjs() {
    const a = (this._out ||= []), S = this.solo;
    a.length = 0;
    if (S?.mark) for (const d of SOLOISTS[S.who]) if (this.arenaView.boss.out(d)) a.push(d);
    return a;
  }
  outDj() { return this.outDjs()[0] ?? null; }
  // where a DJ's throwing hand is (his outer glove), in the arena
  hand(who, out = this._hand ||= new THREE.Vector3()) {
    const r = this.arenaView.boss.rigs[who];
    return (r.glove ||= r.outer.children.find((o) => o.name === 'Gloved hand') || r.outer).getWorldPosition(out);
  }
  // each frame of a solo: the spotlight and his wing, his throws, then his bow (short if the solo hit you)
  soloStep(beat) {
    const S = this.solo, M = this.arenaView.boss, K = this.def.skills.solo || {};
    if (!S) return;
    const who = SOLOISTS[S.who], F = this.def.skills.floor || {};
    // a duet called off (the breakdown in its way, or no record standing as its Warning would start): over
    // at once, or, if they are out on the floor, both vault home with no bow
    if (S.wall?.state === 'off') {
      if (!S.mark || !this.outDjs().length) { this.endSolo(); return; }
      if (!S.bowing) { S.bowing = true; S.bowEnd = Math.round(beat) + (F.crouch ?? 2) + (F.air ?? 2); }   // (from the beat it was called off on)
    }
    if (S.mark) this.floorStep(S, beat);
    // his next throw (asked again each frame: it plays on; on the floor, once he has landed)
    for (const c of this.records.casts) if (c.state === 'wind') { if (beat >= c.release - 4 && (!S.mark || beat >= S.at + 1)) M.perform('silver', 'throw', c.release); break; }
    // his fader crank, as the first Warning shows (held to his bow: his lanes burn under it)
    if (S.who === 'gold' && !S.bowing) M.perform('gold', 'crank', S.at + 2, 1, Math.max(0, S.end - 1 - (S.at + 2)));
    if (S.who === 'gold' && !S.cranked && beat >= S.at + 2) { S.cranked = true; if (beat < S.at + 3) sfx.faderCrank(); }
    // the duet: both DJs throw their hands up as the wall's Warning fills, held till they bow
    if (S.warnAt != null && !S.bowing && beat >= S.warnAt) for (const d of DJS) M.perform(d, 'hands-up', S.warnAt + 1, 1, Math.max(0, S.end - S.warnAt - 3.5));
    // his bow, a beat before his solo ends: the long one if no hit reached the jelly till then (a duet's is its own)
    if (!S.bowing && beat >= S.end - 1) {
      const bow = S.bow ?? (S.clean ? K.clean ?? 4 : K.bow ?? 2) * 4;
      S.bowing = true; S.bowEnd = S.end + bow;
      const up = S.mark ? (F.crouch ?? 2) + (F.air ?? 2) : 0;   // (on the floor, up in time to vault home)
      S.down = Math.max(0, S.bowEnd - (S.bowAt ?? S.end) - up - this.bowLift);
      for (const d of who) if (S.bowAt > S.end) M.perform(d, 'push', S.end); else M.perform(d, 'bow', S.end, 1, S.down);
    }
    // the duet on the floor: both push the wall out as it rolls, then bow
    if (S.bowAt > S.end && S.bowing && !S.bowed && beat >= S.bowAt - 1) { S.bowed = true; for (const d of who) M.perform(d, 'bow', S.bowAt, 1, S.down); }
    if (S.bowing && !S.exhaled && beat >= S.end) { S.exhaled = true; if (beat < S.end + 1) { sfx.bowExhale(); if (S.clean) sfx.crowdCheer(); } }
    // the spotlight and his wing come up over the beat before his solo and go down over the beat after
    // (on the floor: up over the beat after he is booked, and on him till he is home)
    S.on = S.mark ? Math.min(1, Math.max(0, beat - (S.at - 5))) : beat < S.at - 1 ? 0 : beat < S.at ? beat - (S.at - 1) : beat < S.end ? 1 : Math.max(0, 1 - (beat - S.end));
    for (const d of who) this.spotOn(d, S.on);
    if (S.bowEnd !== null && beat >= S.bowEnd) this.endSolo();
  }
  // a solo on the floor, each frame: he crouches and vaults out to land on his mark on the solo's first
  // beat (a shove for a jelly standing there), faces the jelly till the lane he throws next locks, keeps
  // his records clear of him, and in his bow's last beats crouches and vaults home, landing as it ends.
  // The duet: both, each to his own mark; the gold DJ faces and points at where each record will land,
  // and from the wall's Warning both face down the floor
  floorStep(S, beat) {
    const M = this.arenaView.boss, F = this.def.skills.floor || {}, air = F.air ?? 2, crouch = F.crouch ?? 2, djs = SOLOISTS[S.who];
    const home = S.bowEnd !== null && beat >= S.bowEnd - air - crouch, next = this.records.casts.find((c) => c.state === 'wind'), aim = this.records.casts.find((c) => c.state === 'wind' || c.state === 'fly');
    for (const who of djs) {
      if (!home) {
        if (beat < S.at - 0.3) { if (beat >= S.off - crouch) M.perform(who, 'vault', S.off, 1, Math.max(0, S.at - S.off - 0.5)); }
        else if (beat < S.at + 1) M.perform(who, 'land', S.at);
        M.travel(who, S.marks[who], S.off, S.at);
      } else { const off = S.bowEnd - air; M.perform(who, 'vault', off, 1, Math.max(0, air - 0.5)); M.travel(who, 'home', off, S.bowEnd); }
      if (S.bowing) M.face(who, null);
      else if (S.warnAt != null && beat >= S.warnAt) { const f = (this._down ||= [0, 0]); f[0] = S.marks[who][0]; f[1] = FLOOR_BACK; M.face(who, f); }
      else if (who === 'gold' && S.who === 'duet') {
        // he points at where the next record will land, from its Warning till it lands (once landed himself)
        M.face(who, aim && beat >= aim.warnAt ? aim.to : this.jellyAt());
        if (aim && beat >= S.at + 1) M.perform(who, 'point', aim.lockAt, 1, aim.land - aim.lockAt);
      } else M.face(who, !next || beat < next.lockAt ? this.jellyAt() : null);
    }
    if (!home) {
      const k = this.keep; k[0] = S.mark[0]; k[1] = S.mark[2]; k[2] = (F.body ?? 0.06) + this.records.r + (F.keep ?? 0.06);
      k[3] = djs.length > 1 ? Math.abs(S.marks[djs[1]][0] - S.marks[djs[0]][0]) / 2 : 0;
      this.records.keep = k;
    } else this.records.keep = null;
    // the landing: a jelly on a mark is shoved off it, unhurt; dust at their feet
    if (!S.landed && beat >= S.at && M.out(djs[0])) {
      S.landed = true;
      const p = this.player.position;
      for (const who of djs) {
        const m = S.marks[who], d = Math.hypot(p.x - m[0], p.z - m[2]);
        if (d < (F.body ?? 0.06) + (this.player.cfg?.radius ?? 0.03) && p.y < 2 * (F.chest ?? 0.17))
          bus.emit('knockback', { targetId: PLAYER, dir: d > 1e-6 ? new THREE.Vector3(p.x - m[0], 0, p.z - m[2]).divideScalar(d) : new THREE.Vector3(0, 0, 1), force: F.shove ?? 0.5 });
        this.fx.puff(_hit.set(m[0], 0.01, m[2]), LOOK.color('encore-smoke', '#8c8c99'), LOOK.num('encore-landing-dust', 0.04), 0.6);
      }
      juice.feel('hit');
    }
  }
  // after the model moves (a DJ out on the floor): the target and his spotlight go with him, he flinches
  // when hit (the booth then can't be), and his partner in the booth turns his helmet to him
  floorFollow(dt, beat) {
    const M = this.arenaView.boss, S = this.solo, F = this.def.skills.floor || {}, outs = this.outDjs(), out = outs[0] ?? null;
    // (the duet's target is between the two of them)
    if (out) {
      const h = this.holder.position.set(0, 0, 0);
      for (const d of outs) h.add(M.rigs[d].body.getWorldPosition(_wa));
      h.divideScalar(outs.length); h.y += F.chest ?? 0.17; this.r = S.who === 'duet' ? F.duet ?? 0.14 : F.r ?? 0.1;
    } else { this.holder.position.fromArray(TARGET); this.r = BOOTH_R; }
    if (S?.mark && beat !== null) for (const d of SOLOISTS[S.who]) {
      const m = this.spots[d], h = this.spotHome[d], to = S.marks[d];
      if (M.out(d) && beat >= S.at) { M.rigs[d].body.getWorldPosition(m.position); this.arenaView.root.worldToLocal(m.position); m.position.y = 0.02; }
      else { const u = THREE.MathUtils.smoothstep(beat, S.at - 5, S.at - 4); m.position.set(h.x + (to[0] - h.x) * u, h.y + (0.02 - h.y) * u, h.z + (to[2] - h.z) * u); }
    }
    this.flinchT = Math.max(0, this.flinchT - dt * 6);
    if (this.flinchT > 0) for (const d of outs) M.rigs[d].torso.rotation.x -= this.flinchT * LOOK.num('encore-floor-flinch', 0.3);
    // (in the duet nobody is left in the booth to watch)
    const W = this.watch, solo = out && S.who !== 'duet';
    if (solo) { W.of = out; W.who = out === 'silver' ? 'gold' : 'silver'; }
    W.w += ((solo ? 1 : 0) - W.w) * Math.min(1, dt * 4);
    if (W.who && W.w > 1e-3) {
      const a = M.rigs[W.who], side = W.who === 'silver' ? -1 : 1;
      a.head.getWorldPosition(_wa); M.rigs[W.of].body.getWorldPosition(_wb);
      a.head.rotation.y += Math.max(-1.5, Math.min(1.5, Math.atan2(_wb.x - _wa.x, _wb.z - _wa.z) + side * 0.7)) * W.w;   // (as perform's look: 0 = down the floor)
    }
  }
  spotOn(who, on) {
    const m = this.spots[who];
    m.visible = on > 0;
    m.material.opacity = LOOK.num(this.solo?.mark ? 'encore-spotlight-floor-opacity' : 'encore-spotlight-opacity', 0.22) * on;   // (fainter on the floor: he is the target, seen through it)
  }
  // the solo over (its bow done, or cut short): spotlight off, his wing dark
  endSolo() {
    const S = this.solo;
    if (!S) return;
    for (const d of DJS) { this.spotOn(d, 0); this.spots[d].position.copy(this.spotHome[d]); }
    this.records.keep = null;
    if (S.lit) { this.arenaView.boss.setLighting(WING[S.who], 0, 0); this.floor.lit = true; }
    this.solo = null;
  }
  // stop the DJs' acts: no solo, no records, no move (the short-out, its defeat, a song rewind); a DJ
  // out on the floor goes home in `hop` s on the clock (a trip out not yet begun is called off)
  stopActs(hop = this.def.skills.floor?.hop ?? 0.4) {
    for (const who of DJS) this.arenaView.boss.travel(who, 'home', { secs: hop });
    this.records.reset(); this.wall.reset(); this.pyro.reset(); this.endSolo(); this.restBow = false; this.restExhale = null; this.floor.held.silver = this.floor.held.gold = false;
    for (const who of DJS) this.arenaView.boss.perform(who, null);
  }

  quiet(b) { return !!this.song?.quiet?.(b); }
  // `dj`: whose attack it was (a floor wave's), who pumps a fist on the next beat
  hurtPlayer(dmg, color = null, dj = null) {
    if (this.dead) return;
    if (dj && this.beat !== null) this.floor.react(dj, 'fist-pump', Math.ceil(this.beat));
    bus.emit('damage_taken', { targetId: PLAYER, amount: dmg, source: 'boss' });
    if (color && this.player) this.fx.impact(_hit.copy(this.player.position).setY(this.player.position.y + 0.03), color, 0.03, 10);
    // and leaves a scorch on the floor under it, harmless and fading (the hit's aftermath)
    if (this.player) this.fx.splat(_hit.copy(this.player.position).setY(0), LOOK.color('encore-scorch', '#1a1410'), LOOK.num('encore-hit-scorch', 0.035), 'scorch');
  }

  damage(amount, color = '#fff', feedback = {}) {
    if (this.dead || this.cut || this.falling) return;              // (nothing lands while it shorts out or falls)
    if (this.shielded) { this.flash = 1; this.fx.number(this.center().setY(this.holder.position.y + 0.1), 'SHIELDED', LOOK.color('encore-shield', '#3fd0ff'), 12); return; }   // it bounces off the force field
    if (this.exposed) amount *= this.def.skills.solo?.exposed ?? 1.5;   // bowing: wide open
    this.hp -= amount;
    this.fx.number(this.center().setY(this.holder.position.y + 0.1), amount, color, 16, feedback);
    const out = this.outDj();
    if (out) this.flinchT = 1;                                        // a DJ on the floor was hit: he flinches (floorFollow)
    else this.hurtT = 1;                                              // the booth flinches: its panels flash white, it jolts
    // and the nearer DJ (silver stands on the -x side) flinches, at most once a beat
    if (!out && this.beat !== null && Math.floor(this.beat) !== this.flinched) {
      this.flinched = Math.floor(this.beat);
      this.floor.react(this.player && this.player.position.x > this.center().x ? 'gold' : 'silver', 'flinch', this.beat + 0.15);
    }
    if (this.hp <= 0) this.beaten();
    else if (!this.broken && this.hp <= this.maxHp * (this.def.skills.meltdown?.at ?? 0.5)) this.meltdown();
  }
  // Half Health: the booth shorts out. Its set stops for the cut scene, then plays on, broken
  meltdown() {
    this.broken = true;
    const b = this.booth, c = b.getCenter(new THREE.Vector3()), short = juice.calm || !!this.fx.reducedMotion?.matches;
    this.floor.reset(); this.lasers.reset(); this.contact.reset(); this.disco.visit(null); this.set = null; this.stopActs(short ? 1e-3 : this.def.skills.floor?.knock ?? 0.3);   // (knocked home as the cut opens)
    this.cut = { t: 0, length: LOOK.num(short ? 'encore-meltdown-calm-time' : 'encore-meltdown-time', short ? 1.2 : 3.4), next: 0, blown: false,
      // the shot: in front of the booth and off to one side, easing in
      from: new THREE.Vector3(c.x + 0.34, b.max.y * 0.75, b.max.z + 0.62), to: new THREE.Vector3(c.x + 0.18, b.max.y * 0.6, b.max.z + 0.42), look: c.clone().setY(b.max.y * 0.5) };
    juice.feel('impact-big'); sfx.lightningBig?.(); sfx.boom();
    bus.emit('toast', { text: 'The Encore shorts out! Its disco ball is down for good.' });
  }
  // sparks spraying out of a random spot on the pyramid's front face (it slopes back as it rises),
  // a flash there and a puff of dark smoke
  spark(big = false) {
    const b = this.booth, h = 0.1 + Math.random() * 0.75, w = (b.max.x - b.min.x) * 0.3 * (1 - h);
    const p = new THREE.Vector3((b.min.x + b.max.x) / 2 + (Math.random() * 2 - 1) * w, b.min.y + h * (b.max.y - b.min.y), b.max.z - h * (b.max.z - b.min.z) * 0.6 + 0.01);
    const hot = LOOK.list('encore-sparks', ['#fff6c8', '#ffd23a', '#ff8a1e']);
    this.fx.impact(p, hot[1], big ? 0.09 : 0.045, big ? 28 : 14);
    this.sparks.emit(p, big ? 70 : 24, big ? 1.1 : 0.75);
    if (big || Math.random() < 0.6) this.fx.puff(p.clone().setY(p.y + 0.02), LOOK.color('encore-smoke', '#8c8c99'), big ? 0.1 : 0.05, big ? 1.6 : 1);
    big ? sfx.lightningBig?.() : sfx.zap?.();
    return p;
  }
  // No cat to finish it: it goes down in its own cut scene (`falling`, main.js frames `cut`), the music
  // cut dead (run.js musicState). Its set stops; explosions climb over the booth,
  // its panels die section by section, the DJs slump over their decks and the disco ball crashes down
  // and shatters; one last blow-out, then the smoke settles and it's beaten (`dead`: run.js onBossDead)
  beaten() {
    if (this.falling || this.dead) return;
    this.hp = 0; this.state = 'falling';
    const b = this.booth, c = b.getCenter(new THREE.Vector3()), short = juice.calm || !!this.fx.reducedMotion?.matches;
    this.floor.reset(); this.lasers.reset(); this.contact.reset(); this.set = null; this.stopActs(short ? 1e-3 : this.def.skills.floor?.knock ?? 0.3);
    this.field.visible = false;
    const length = LOOK.num(short ? 'encore-defeat-calm-time' : 'encore-defeat-time', short ? 1.5 : 4.6);
    this.falling = { t: 0, length, next: 0, blown: false, ball: this.disco.hanger.visible ? { y: this.disco.hanger.position.y, v: 0, down: false } : null };
    // the shot: a wide view of the whole stage, drifting slowly back as it comes apart
    this.cut = { t: 0, length, from: new THREE.Vector3(c.x - 0.3, b.max.y * 1.1, b.max.z + 0.7), to: new THREE.Vector3(c.x - 0.15, b.max.y * 1.4, b.max.z + 1.0), look: c.clone().setY(b.max.y * 0.45) };
    for (const who of ['silver', 'gold']) this.arenaView.boss.dance(who, null);
    this.arenaView.boss.setLighting('all', 0xffffff, 1);
    juice.feel('boss-kill'); sfx.lightningBig?.(); sfx.boom();
  }
  // each frame of its fall (after the model's own update, so the slump sticks)
  fallDown(dt) {
    const F = this.falling, C = this.cut, M = this.arenaView.boss, D = this.disco, u = Math.min(1, F.t / F.length);
    F.t += dt; if (C) C.t = F.t;
    // explosions, faster and faster until the blow-out at 60%, then dying away
    if (F.t >= F.next) { F.next = F.t + (u < 0.6 ? 0.3 - 0.22 * (u / 0.6) : 0.25 + (u - 0.6)); if (u < 0.85) this.spark(u > 0.35 && Math.random() < 0.4); }
    if (!F.blown && u >= 0.6) {
      F.blown = true;
      for (let k = 0; k < 4; k++) this.spark(true);
      const c = this.booth.getCenter(_hit);
      this.fx.impact(c, LOOK.color('encore-broken', '#ff2a3a'), 0.18, 30);
      this.fx.ring(c.setY(0.01), 0xffd23a, 0.7, 0.6);
      juice.feel('boss-kill'); sfx.boom(); sfx.lightningBig?.();
    }
    // its panels die section by section: still lit ones stutter, then go dark for good
    const n = M.triangleCount || 0, alive = Math.ceil(n * (1 - Math.min(1, u / 0.62)));
    for (let i = 0; i < n; i++) M.setTriangle(i, Math.random() < 0.5 ? 0xffffff : LOOK.color('encore-broken', '#ff2a3a'), i < alive ? Math.random() * 0.8 : 0);
    // it shudders, and after the blow-out sags a little to one side
    const sag = THREE.MathUtils.smoothstep(u, 0.6, 0.75);
    M.root.position.copy(this.home).add(_hit.set((Math.random() - 0.5) * 0.01 * (1 - sag), -0.012 * sag, 0));
    M.root.rotation.z = 0.04 * sag;
    // the DJs slump over their decks
    const slump = THREE.MathUtils.smoothstep(u, 0.15, 0.7);
    for (const h of M.heads) { h.rotation.x += slump * 0.7; h.rotation.z = (Math.random() - 0.5) * 0.3 * (1 - slump); }
    // the disco ball (if it was down) snaps off and crashes onto the floor, shattering
    if (F.ball && !F.ball.down) {
      if (u > 0.25) { F.ball.v -= 2.5 * dt; F.ball.y += F.ball.v * dt; }
      D.hanger.position.y = F.ball.y; D.hanger.rotation.z += dt * (u > 0.25 ? 3 : 0);
      if (F.ball.y < 0.12) {
        F.ball.down = true; D.hanger.visible = D.spots.visible = D.beams.visible = false;
        const p = D.hanger.position.clone().setY(0.03);
        this.fx.impact(p, 0xffffff, 0.12, 24); this.fx.ice.shatter(p, 30, 0.012, 0.8, 0);
        juice.feel('impact-big'); sfx.shatter?.();
      }
    }
    if (F.t >= F.length) {
      this.falling = null; this.cut = null; this.dead = true; this.state = 'beaten';
      D.reset(); M.clearLighting?.();
    }
  }

  // the beat now: the song's, or its own tempo clock (no song, music off, or the song still loading)
  beatNow(dt) {
    const b = this.song?.beat?.(dt);
    if (Number.isFinite(b)) return (this.clock = b);
    return (this.clock += dt * TRACKS.encore.bpm / 60);
  }

  update(dt, player) {
    this.player = player;
    this.t += dt;
    this.shove.x = this.shove.z = 0;
    const A = this.arenaView, beat = this.dead ? null : this.beatNow(dt), M = A.boss;
    if (this.falling) { /* its fall: fallDown, after the model's update */ }
    else if (this.cut) this.shortOut(dt, beat);
    else if (!this.dead && beat !== null) {
      // A restarted track needs a new set, with fresh warnings rather than old scheduled beats.
      if (this.beat !== null && beat < this.beat) {
        this.floor.reset(); this.lasers.reset(); this.disco.reset(beat); this.set = null; this.flinched = null; this.stopActs();
      }
      this.beat = beat;
      const S = this.def.skills.set || {};
      this.set ||= new SetList(this.floor, Math.ceil(beat / 4) * 4 + 4, { quiet: (b) => this.quiet(b), drop: (b) => !!this.song?.drop?.(b), target: () => [player.position.x, player.position.z],
        lasers: this.lasers, disco: this.disco, stage: () => this.stage, slot: (kind, at) => this.slot(kind, at), soloing: (at) => this.soloing(at), solo: S.solo, soloLast: S.last, discoEvery: S.disco, waveBars: S.wave, turn: this.soloTurn });
      this.set.update(beat);
      this.floor.update(beat, player);
      this.lasers.update(beat, player);
      if (this.broken && this.disco.stayFrom == null) this.disco.stay(Math.ceil(beat / 4) * 4);   // down from the next bar, for good
      this.disco.update(beat, player);
      this.records.update(beat, player, dt);
      // a DJ standing on his mark pushes the jelly out of his body, as a standing record does (never hurts)
      const O = this.solo, F = this.def.skills.floor || {};
      if (O?.mark && beat >= O.at && !(O.bowEnd !== null && beat >= O.bowEnd - (F.air ?? 2))) for (const d of this.outDjs()) this.records.ring(O.marks[d][0], O.marks[d][2], F.body ?? 0.06, 2 * (F.chest ?? 0.17), player);
      this.pyro.update(beat, player, dt);
      this.wall.update(beat, player);
      this.shove.x += this.records.pushX; this.shove.z += this.records.pushZ;
      this.soloStep(beat);
      this.announce();
      // the song's breakdown: both DJs bow, from a beat in to a beat and a half before it ends
      const rest = this.quiet(beat);
      if (rest && !this.restBow) {
        let end = beat; while (this.quiet(end) && end < beat + 64) end += 0.5;
        for (const who of DJS) M.perform(who, 'bow', beat + 1, 1, Math.max(0, end - beat - 1 - this.bowLift));
        this.restExhale = beat + 1;   // and breathe out as they go down, as after a solo
      }
      if (this.restExhale != null && beat >= this.restExhale) { if (rest && beat < this.restExhale + 1) sfx.bowExhale(); this.restExhale = null; }
      this.restBow = rest;
      // the wave gestures leave a DJ alone while the Encore moves him: his solo (from his first wind-up) and bow, the breakdown's bow
      for (const who of DJS) this.floor.held[who] = rest || ((this.solo?.who === who || this.solo?.who === 'duet') && beat >= this.solo.at - (this.solo.mark ? 5 : 4));
      if (this.guardT > 0) { this.guardT = Math.max(0, this.guardT - dt); if (!this.guardT) this.opening = false; }   // warming up or rebooting: counts down while its set plays
      // broken: it keeps sparking and smoking, every second or two
      if (this.broken && (this.sparkT -= dt) <= 0) { this.sparkT = 0.8 + Math.random() * 1.4; this.spark(); }
    }
    this.contact.update(dt, player, !this.dead && !this.cut, !!this.fx.reducedMotion?.matches);
    A.updateAmbience?.(this.dead || this.falling ? null : beat, !!this.fx.reducedMotion?.matches, beat !== null && this.quiet(beat), this.wall.swell);
    M.update(dt, !!this.fx.reducedMotion?.matches, this.dead || this.falling ? null : beat);
    this.floorFollow(dt, this.dead || this.falling || this.cut ? null : beat);
    if (this.falling) this.fallDown(dt);
    // its panels: a white flash when a hit lands; broken, a red pulse on the beat between floor waves
    this.hurtT = Math.max(0, this.hurtT - dt * 6);
    if (!this.cut && !this.dead) {
      const red = this.broken && beat !== null ? Math.exp(-((beat % 1 + 1) % 1) * 4) * 0.8 : 0;
      if (this.hurtT > 0) { M.setLighting('all', 0xffffff, this.hurtT); this.floor.lit = true; }   // (the floor waves' own lighting comes back after)
      else if (this.broken && !this.floor.casts.length) M.setLighting('all', LOOK.color('encore-broken', '#ff2a3a'), 0.25 + red);
      // a solo: his wing lit his colour, pulsing on the beat
      const S = this.solo;
      if (S && S.on > 0 && !this.hurtT) { M.setLighting(WING[S.who], this.colors[S.who], S.on * (0.6 + 0.4 * Math.exp(-((beat % 1 + 1) % 1) * 4))); S.lit = true; }
      else if (S?.lit && !S.on) { M.setLighting(WING[S.who], 0, 0); S.lit = false; this.floor.lit = true; }
    }
    this.sparks.update(dt);
    // on the beat the DJs nod and the booth pumps; a hit squashes it a touch (the short-out shakes it)
    const on = !this.cut && !this.dead && beat !== null && !this.quiet(beat), kick = on ? Math.exp(-((beat % 1 + 1) % 1) * 6) : 0;
    if (!this.cut) { M.root.position.copy(this.home); for (const h of M.heads) h.rotation.x += kick * 0.22; }
    M.root.scale.set(1 + kick * 0.008, 1 - this.hurtT * 0.015 - kick * 0.012, 1 + kick * 0.008);
    // the force field: grows in over its booth, flares when hit, and shatters in a
    // spray of cyan shards when it drops
    if (this.wasShielded && !this.shielded && !this.dead) {
      const c = this.booth.getCenter(new THREE.Vector3()), blue = LOOK.color('encore-shield', '#3fd0ff');
      this.fx.burst(c.setY(this.booth.max.y * 0.6), [blue, '#ffffff', blue], 24, 0.006, 0.7, 0);
      this.fx.ring(c.setY(0.01), blue, 0.6, 0.5); sfx.shatter?.(); juice.feel('impact');
    }
    this.fieldUp = this.shielded ? Math.min(1, (this.fieldUp || 0) + dt * 3) : 0;
    this.wasShielded = this.shielded;
    this.field.visible = this.shielded;
    this.field.scale.copy(this.fieldScale).multiplyScalar(0.6 + 0.4 * (1 - (1 - this.fieldUp) ** 3));
    this.flash = Math.max(0, this.flash - dt * 4);
    this.field.material.opacity = LOOK.num('encore-shield-opacity', 0.55) * (0.85 + 0.15 * Math.sin(this.t * 3)) + this.flash;
    bus.emit('boss_health', { name: this.B.name, hp: this.hp, maxHp: this.maxHp, shielded: this.shielded, shieldText: this.guardT > 0 ? `Shielded: ${this.opening ? 'warming up' : 'rebooting'} (${Math.ceil(this.guardT)} s)` : undefined, exposed: this.exposed, tag: this.tag });
    return { push: dt > 0 && (this.shove.x || this.shove.z) ? { x: this.shove.x / dt, z: this.shove.z / dt } : null };
  }

  // The cut scene's steps (main.js holds the game and frames `cut`): bursts of sparks all over the booth,
  // faster and faster, its panels flickering white and red, the DJs jolting, one big blow-out two thirds
  // in, then its panels die to a dull red and the set plays on
  shortOut(dt, beat) {
    const C = this.cut, M = this.arenaView.boss, u = C.t / C.length;
    C.t += dt;
    if (C.t >= C.next) { C.next = C.t + 0.22 - 0.15 * u; this.spark(); }
    if (!C.blown && u >= 0.62) { C.blown = true; this.spark(true); this.spark(true); juice.feel('elite-kill'); sfx.boom(); }
    // its panels fail: mostly a dying, stuttering red, now and then a white surge
    const surge = Math.random() < 0.18;
    M.setLighting('all', surge ? 0xffffff : LOOK.color('encore-broken', '#ff2a3a'), surge ? 0.7 : Math.random() < 0.35 ? 0 : 0.2 + Math.random() * 0.7);
    M.root.position.copy(this.home).add(new THREE.Vector3((Math.random() - 0.5) * 0.008, (Math.random() - 0.5) * 0.004, 0).multiplyScalar(1 - u * 0.5));
    for (const h of M.heads) h.rotation.z = (Math.random() - 0.5) * 0.5 * (1 - u);
    if (C.t >= C.length) {
      for (const h of M.heads) h.rotation.z = 0; this.cut = null; M.root.position.copy(this.home); this.floor.lit = true;
      // it reboots behind its force field: it can't be hurt for a while (bosses.kdl meltdown `guard`)
      this.guardT = this.def.skills.meltdown?.guard ?? 10; this.opening = false;
    }
  }

  // show what only appears mid-fight, for the shader build at load (main.js warmUp)
  warm(on) { this.records.warm(on); this.wall.warm(on); this.pyro.warm(on); for (const who of DJS) this.spots[who].visible = on; }
  dispose() {
    this.offHurt(); this.records.dispose(); this.wall.dispose(); this.pyro.dispose();
    for (const m of Object.values(this.spots)) { m.removeFromParent(); m.material.dispose(); }
    this.sparks.dispose();
    this.floor.dispose(); this.lasers.dispose(); this.disco.dispose(); this.contact.dispose();
    this.field.removeFromParent(); this.field.material.dispose();
    this.arenaView.boss.clearLighting?.();
    this.arenaView.boss.root.position.copy(this.home); this.arenaView.boss.root.scale.setScalar(1);
  }
}

// The force field: the shared hex shell (vfx.js VolumeMaterial) as a see-through dome over the whole
// booth (sized from its collider, with room to spare, so none of it hides inside the booth), in its
// own cyber blue with big bright cells (`--encore-shield-hex`, `--encore-shield-glow`), flaring when a
// hit bounces off it
// Sparks: glowing streaks that spray out, fall, skip off the floor and fade from white-hot to orange.
// One pooled, additive instanced draw (no lights); oldest reused when it's full
const SPARKS = 220, _sm = new THREE.Matrix4(), _sq = new THREE.Quaternion(), _sv = new THREE.Vector3(), _ss = new THREE.Vector3(), _sc = new THREE.Color(), _sup = new THREE.Vector3(0, 1, 0);
class Sparks {
  constructor(parent) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), SPARKS);
    this.mesh.name = 'Encore sparks'; this.mesh.frustumCulled = false; this.mesh.userData.noCollide = true; this.mesh.renderOrder = 6;
    this.list = Array.from({ length: SPARKS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), t: 0, life: 0 }));
    this.next = 0; this.live = 0;
    this.hot = new THREE.Color(LOOK.color('encore-spark-hot', '#fff6c8')); this.cool = new THREE.Color(LOOK.color('encore-spark-cool', '#ff7a14'));
    for (let i = 0; i < SPARKS; i++) { this.mesh.setMatrixAt(i, _sm.makeScale(0, 0, 0)); this.mesh.setColorAt(i, _sc.set(0)); }
    parent.add(this.mesh);
  }
  // n sparks from p, out toward the room (+z) and up, `speed` m/s or so
  emit(p, n, speed) {
    for (let k = 0; k < n; k++) {
      const s = this.list[this.next]; this.next = (this.next + 1) % SPARKS;
      const a = Math.random() * Math.PI * 2, up = 0.3 + Math.random() * 0.9, v = speed * (0.35 + Math.random() * 0.65);
      s.p.copy(p); s.v.set(Math.cos(a) * 0.8, up, 0.6 + Math.abs(Math.sin(a))).normalize().multiplyScalar(v);
      s.t = 0; s.life = 0.35 + Math.random() * 0.55;
    }
    this.live = SPARKS;
  }
  update(dt) {
    if (!this.live) return;
    let any = 0;
    this.list.forEach((s, i) => {
      if (s.t >= s.life) { if (s.life) { this.mesh.setMatrixAt(i, _sm.makeScale(0, 0, 0)); s.life = 0; } return; }
      any++;
      s.t += dt; s.v.y -= 2.4 * dt; s.p.addScaledVector(s.v, dt);
      if (s.p.y < 0.003 && s.v.y < 0) { s.p.y = 0.003; s.v.y *= -0.35; s.v.x *= 0.6; s.v.z *= 0.6; }   // skips off the floor
      const k = s.t / s.life, len = Math.max(0.006, s.v.length() * 0.045);
      this.mesh.setMatrixAt(i, _sm.compose(s.p, _sq.setFromUnitVectors(_sup, _sv.copy(s.v).normalize()), _ss.set(0.0026, len, 0.0026)));
      this.mesh.setColorAt(i, _sc.copy(this.hot).lerp(this.cool, k).multiplyScalar(3 * (1 - k * k)));
    });
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
    if (!any) this.live = 0;
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.dispose(); }
}

// A solo's spotlight: a cone of haze from high over a DJ down onto him, brightest at his feet. Unlit
// (no light is added), additive, hidden until his solo
let SPOT_GEO = null;
function spotlight(A, who) {
  const h = 0.95, body = A.boss.rigs[who].body;
  if (!SPOT_GEO) {
    SPOT_GEO = new THREE.ConeGeometry(LOOK.num('encore-spotlight-radius', 0.09), h, 24, 1, true).translate(0, h / 2, 0);
    const p = SPOT_GEO.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) col.fill(1 - p.getY(i) / h, i * 3, i * 3 + 3);   // fading out towards its top
    SPOT_GEO.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const m = new THREE.Mesh(SPOT_GEO, new THREE.MeshBasicMaterial({ color: LOOK.color('encore-spotlight', '#fff1d0'), vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
  A.root.updateMatrixWorld(true);
  body.getWorldPosition(m.position); A.root.worldToLocal(m.position); m.position.y += 0.02;
  m.name = `Encore ${who} spotlight`; m.userData.noCollide = true; m.visible = false; m.renderOrder = 5;
  A.root.add(m);
  return m;
}

// the booth's box in the arena (its collider's, where it stands)
function boothBox(booth) {
  const g = booth.collisionGeometry;
  if (!g.boundingBox) g.computeBoundingBox();
  return g.boundingBox.clone().translate(booth.root.position);
}

function forceField(booth) {
  const mat = new VolumeMaterial(LOOK.color('encore-shield', '#3fd0ff'), 'dome');
  mat.progress = 1;
  mat.uniforms.uHex.value = LOOK.num('encore-shield-hex', 28);
  mat.uniforms.uGlow.value = LOOK.num('encore-shield-glow', 2.4);
  const box = boothBox(booth);
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()), room = LOOK.num('encore-shield-room', 1.3);
  const m = new THREE.Mesh(volumeGeometry('dome'), mat);
  m.position.set(c.x, box.min.y, c.z);
  m.scale.set(size.x / 2 * room, size.y * room, size.z / 2 * room);
  m.name = 'Encore force field'; m.userData.noCollide = true; m.visible = false; m.renderOrder = 5;
  return m;
}

// What the Encore plays: a wave every other bar (8 beats; a jump hangs about 2.7), each one a line
// (a sweep, arrow, gate or pincer, never a ring) picked at random, never the same pattern twice
// running, with its direction, gap, spin and DJ picked too; at a drop (the song's `drop(beat)`), two
// waves at once, one from each DJ. Bars are still 4 beats: the lasers, solos and disco ball keep to them.
export const WAVE_GAP = 4;
export const LINE_WAVES = ['sweep', 'arrow', 'gate', 'pincer'];
const DIRS = ['down', 'left', 'right'];
const pick = (list, random) => list[Math.floor(random() * list.length) % list.length];
// a wave's options, picked
function options(name, random) {
  const dir = pick(DIRS, random);
  switch (name) {
    case 'arrow': return { dir };
    case 'sweep': return { spin: random() < 0.5 ? 1 : -1 };
    case 'gate': return { dir, gap: 1 + Math.floor(random() * (ENCORE.tiles - 3)) };
    default: return {};
  }
}
// an arrow or a gate from a wing is the DJ on that side (silver on the left)
const sideDj = (o) => (o.dir === 'right' ? 'silver' : o.dir === 'left' ? 'gold' : null);

// The Encore's set list: its fight laid out a bar (4 beats) at a time from beat `from`, each bar cast
// 6 beats ahead of its downbeat (time for the wind-up). After a jump in time it skips what was missed.
// A bar holds, by `stage()` as the bar is laid out (Encore.stage):
//   a wave (every stage, every `waveBars` bars): picked at random from the line waves, never the same pattern twice running; the song's
//     `quiet(beat)` (its breakdown, the kick out) rests the floor; its `drop(beat)` doubles the waves
//     (not in the warm-up), and in the last song they are always two at a time. `target()` is where the jelly is.
//   a club laser from a random corner on every bar (`lasers`, encore-laser.js; not in the warm-up)
//   in set 2, a disco ball visit every `discoEvery` bars, halfway between solo slots (`disco`)
// From the first bar after the warm-up (`origin`), every `solo` bars is a solo slot: `slot(kind, at)`,
// silver in set 1, silver and gold in turn in set 2, then silver, gold and a duet. The turn carries on from
// stage to stage (`turn.last`, kept by the Encore so a rebuilt set list keeps it), so set 2 opens on gold and
// set 3 on the duet: a fight that's over in a few slots still shows every solo.
// The last song's slots come every `soloLast` bars from 2 bars in (a slot that finds a solo still playing
// tries again the next bar): a solo and its bow, the next, a duet, with only the waves between.
const SOLOS = { set1: ['silver'], set2: ['silver', 'gold'], set3: ['silver', 'gold', 'duet'], last: ['silver', 'gold', 'duet'] };
export class SetList {
  constructor(floor, from, { random = Math.random, quiet = () => false, drop = () => false, target = () => [0, 0.3], lasers = null, disco = null,
    stage = () => 'set1', slot = () => {}, soloing = () => null, solo = 16, soloLast = 10, discoEvery = 8, waveBars = 2, turn = { last: null } } = {}) {
    Object.assign(this, { floor, from, random, quiet, drop, target, lasers, disco, stage, slot, soloing, solo, soloLast, discoEvery, waveBars, turn });
    this.next = 0; this.last = null; this.dj = 0; this.origin = null;
  }
  update(beat) {
    for (;;) {
      const at = this.from + this.next * WAVE_GAP;
      if (beat < at - 6) return;
      if (at > beat) this.bar(at);
      this.next++;
    }
  }
  // lay out the bar from beat `at`
  bar(at) {
    const stage = this.stage(), warm = stage === 'warmup';
    if (!warm) {
      this.origin ??= at;
      const n = (at - this.origin) / WAVE_GAP, kinds = SOLOS[stage];
      if (stage !== this.soloStage) { this.soloStage = stage; this.nextSlot = n + 2; }
      const kind = kinds[(kinds.indexOf(this.turn.last) + 1) % kinds.length];   // the one after the last that played (in this stage's list)
      if (stage === 'last') { if (n >= this.nextSlot && this.slot(kind, at) !== false) { this.turn.last = kind; this.nextSlot = n + this.soloLast; } }   // (a slot that finds a solo still playing waits a bar)
      else if (n > 0 && n % this.solo === 0 && this.slot(kind, at) !== false) this.turn.last = kind;
      if (stage === 'set2' && n % this.discoEvery === this.discoEvery / 2) this.disco?.visit(at);
    }
    if (this.quiet(at) || this.quiet(at + 8)) return;
    // a solo: the lasers rest and the other DJ plays a wave every `waveBars` x 8 beats, a bar into it (a duet: no wave)
    const solo = warm ? null : this.soloing(at);
    if (solo) { if (solo.who !== 'duet' && (at - solo.at) % (2 * WAVE_GAP * this.waveBars) === WAVE_GAP) this.wave(at, 1, solo.who === 'silver' ? 'gold' : 'silver'); return; }
    if (this.next % this.waveBars === 0) this.wave(at, !warm && (stage === 'last' || this.drop(at)) ? 2 : 1);
    // (its corner and side are picked in the warm-up too, so the waves roll the same with lasers or without)
    if (this.lasers) {
      const corner = Math.floor(this.random() * 4) % 4, side = this.random() < 0.5 ? 1 : -1;
      if (!warm) this.lasers.cast(at, { corner, side, target: this.target });
    }
  }
  // `count` waves on beat `at`, different patterns. Two at once are one from each DJ: a wave from a
  // wing is that side's DJ, so the other wave is turned away from that wing.
  wave(at, count, dj = null) {
    const names = LINE_WAVES, waves = [];
    for (let n = 0; n < count; n++) {
      const name = pick(names.filter((x) => x !== this.last && !waves.some((w) => w.name === x)), this.random);
      waves.push({ name, o: options(name, this.random) });
    }
    const [a, b] = waves;
    if (b) {
      if (sideDj(a.o) && sideDj(b.o)) b.o.dir = 'down';              // not both from the same (or opposite) wings
      const first = sideDj(a.o) ?? (sideDj(b.o) === 'silver' ? 'gold' : 'silver');
      a.o.dj = first; b.o.dj = first === 'silver' ? 'gold' : 'silver';
      if (sideDj(b.o) && sideDj(b.o) !== b.o.dj) b.o.dir = 'down';
    } else if (dj) { if (sideDj(a.o) && sideDj(a.o) !== dj) a.o.dir = 'down'; a.o.dj = dj; }   // (a wing's wave is that side's DJ)
    else a.o.dj = sideDj(a.o) ?? ['silver', 'gold'][this.dj++ % 2];
    for (const w of waves) this.floor.cast(w.name, at, w.o);
    this.last = waves[waves.length - 1].name;
  }
}
