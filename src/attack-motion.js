// How a basic bug's attack moves: build-up, swing and recoil, drawn on its body group only.
// The attack words keep their own clocks (e.state + e.stateT, a Shot's aimT/aimMax and firedT); this
// module reads them (never writes them) into e.atk, and the bug's anim in critters.js poses from it.
//
// How to convert a bug (buildMosquito is the reference):
// 1. content/enemies.kdl: give it `attack-motion "<style>" tier="<tier>"` (lunge throw pounce swipe roll nip;
//    fodder light mid heavy). Its attack word already names its phases (words.js `phases`).
// 2. In its anim, read `const A = e.atk` and pose from A.phase ('idle' 'build' 'swing' 'recoil'), A.k (0 to 1
//    through it), A.pt (s into it), A.hit (landed or missed), A.still, A.smear, A.lockT, A.vary, A.side.
// 3. Shape with the curves here (coil in build, snap in swing, settle or heavy in recoil, quiver for
//    tension), stretch() the body, mixPose() limb poses, eyes() for the face, spring() (swim.js) for lag.
// 4. Never `new`, a literal, Math.random or performance.now in the anim: a pose is a function of A.
// 5. Numbers go in content/look.css (--bug-attack-*); add a case to motion/attack-has-three-phases.
import { LOOK } from './look.js';

export const STYLES = ['lunge', 'throw', 'pounce', 'swipe', 'roll', 'nip'];
export const TIERS = ['fodder', 'light', 'mid', 'heavy'];

// curve calls this frame, for the engine/bug-attack-work-is-bounded budget (enemies.js reads it per bug)
export const WORK = { n: 0, most: 0 };
export const WORK_BUDGET = 24;

let K = null;
export function knobs() {
  if (K) return K;
  const n = (name, d) => LOOK.num('bug-attack-' + name, d);
  K = { still: n('still', 0.1), fire: n('fire', 0.06), smear: n('smear', 1.3), smearAt: n('smear-at', 0.03), vary: n('vary', 0.1), puffs: n('puffs', 4), beat: n('lock-beat', 0.067), style: {}, tier: {} };
  for (const s of STYLES) K.style[s] = { hold: n(s + '-hold', 0.35), over: n(s + '-over', 0.08), strike: n(s + '-strike', 0.08), bounces: n(s + '-bounces', 2), damp: n(s + '-damp', 2), follow: n(s + '-follow', 0.06) };
  for (const t of TIERS) K.tier[t] = { stretch: n(t + '-stretch', 1.2), over: n(t + '-over', 0.12), contact: n(t + '-contact', 0.05), puff: LOOK.list('bug-attack-' + t + '-puff', []), bounce: t !== 'heavy' };
  return K;
}

// ------------------------------------------------------------------ curves: pure functions of k, no memory
const clamp01 = (k) => (k < 0 ? 0 : k > 1 ? 1 : k);
// build-up: out fast to 1 + over by k = hold, back to 1 by k = 1.5 hold, then held
export function coil(k, hold = 0.35, over = 0.08) {
  WORK.n++;
  k = clamp01(k);
  if (k < hold) { const u = 1 - k / hold; return (1 - u * u * u) * (1 + over); }
  const u = clamp01((k - hold) / (hold * 0.5));
  return 1 + over * (1 - u * u * (3 - 2 * u));
}
// tension in a hold: a small shake that grows with k², its phase from the bug's own seed
export function quiver(k, t, seed, rate = 47) { WORK.n++; return Math.sin(t * rate + seed) * k * k; }
// swing: accelerates in (k³), runs `over` past the target over the last tenth
export function snap(k, over = 0.15) {
  WORK.n++;
  k = clamp01(k);
  return k < 0.9 ? (k / 0.9) ** 3 : 1 + over * (k - 0.9) * 10;
}
// recoil for light bugs: from 1 to 0 with `bounces` swings through zero, dying away as (1 - k)^damp
export function settle(k, bounces = 2, damp = 2) { WORK.n++; k = clamp01(k); return (1 - k) ** damp * Math.cos(Math.PI * bounces * k); }
// recoil for heavy bugs: no bounce, a slow ease from 1 to 0
export function heavy(k) { WORK.n++; k = clamp01(k); return 1 - k * k * (3 - 2 * k); }
// squash and stretch that keeps volume: `a` times as long along z (its line), thinner across
export function stretch(obj, a) { const w = 1 / Math.sqrt(a); obj.scale.set(w, w, a); }
// mix two poses (arrays of angles) into `out`; with `lag`, each joint after the first runs that much k behind
// (successive joints: body, then root, then tip)
export function mixPose(A, B, k, out, lag = 0) {
  for (let i = 0; i < A.length; i++) { const j = clamp01(k - i * lag); out[i] = A[i] + (B[i] - A[i]) * j; }
  return out;
}
// the two frames after the aim locks (the lock beat)
export const lockBeat = (A) => A.lockT >= 0 && A.lockT < knobs().beat;
// the angry eyes (enemies.js angryEyes): narrow through the build-up, wide at the lock, shut on a landed hit,
// drooping after a miss
export function eyes(face, A) {
  let y = 1, droop = 0;
  if (A.phase === 'build') y = lockBeat(A) ? 1.35 : 1 - 0.45 * clamp01(A.k / 0.6);
  else if (A.phase === 'swing') y = A.hit ? 0.12 : 0.6;
  else if (A.phase === 'recoil') { const q = 1 - A.k; y = A.hit ? 1 - 0.4 * q : 1 - 0.3 * q; droop = A.hit ? 0 : 0.25 * q; }
  const C = face.children;
  for (let i = 0; i < C.length; i++) { C[i].scale.y = y; C[i].rotation.x = droop; }
}

// ------------------------------------------------------------------ the clock
// One per bug, made at spawn (enemies.js). `style` and `tier` are its look.css numbers.
export function newAttack(T) {
  const k = knobs(), m = T.attackMotion;
  return { phase: 'idle', k: 0, pt: 0, t: 0, lock: -1, lockT: -1, hit: false, still: false, smear: false, n: 0, vary: 1, side: 1, quiet: 1, style: k.style[m.style], tier: k.tier[m.tier], key: '', len: 0, st: 0, rt: 0, r0: 0, rkey: '', rec: false, k0: 0, carry: '' };
}

// puffs this frame (at most knobs().puffs), counted by beginFrame
const PUFFS = { n: 0 };
export function beginFrame() { PUFFS.n = 0; }
// a weight puff under a seen bug (fx null: far or off-screen, none), within the frame's cap
export function attackPuff(fx, e) {
  if (!fx || PUFFS.n >= knobs().puffs) return false;
  PUFFS.n++;
  fx.puff(e.pos, undefined, e.r * 0.9, 0.35, 0.45);
  return true;
}

const frac = (x) => x - Math.floor(x);
// each attack's own size (vary, 1 ± --bug-attack-vary) and side to lean (±1), from the bug's seed and the attack's number
export function roll(A, seed, n) {
  const h = frac(Math.sin((seed + n * 7.13) * 12.9898) * 43758.5453);
  A.vary = 1 + knobs().vary * (h * 2 - 1);
  A.side = frac(h * 97.31) < 0.5 ? -1 : 1;
  return A;
}
// Steps e.atk from the attack word's clock. dt: the frame's time (0 while frozen or stunned); fx: null for a
// far or off-screen bug (no puffs); calm: Reduce effects (quivers half size).
export function attackClock(e, dt, fx = null, calm = false) {
  const A = e.atk, P = e.T.attack, C = knobs();
  let key = e.state, kind = P.phases[key], left = P.timer[key] ? e[P.timer[key]] : e.stateT;
  if (!kind && P.shot) {                     // a Shot without states (spit): aimT is its build-up, firedT its throw
    if (e.aimT > 0) { key = 'aim'; kind = 'build'; left = e.aimT; }
    else if (e.firedT > 0) { key = 'fired'; kind = 'fire'; left = e.firedT; }
  }
  if (!kind) key = '';
  const was = A.phase;
  if (key !== A.key) {
    A.key = key; A.st = 0; A.k0 = A.k; A.carry = A.phase;   // a phase that runs on into its next step carries its k
    A.len = P.span[key] ?? Math.max(0, left);   // a step with no clock of its own (a dart) has a span instead
    if (kind === 'build' && was !== 'build') {   // a new attack: its own seeded roll
      A.n++; A.t = 0; A.hit = false; A.rec = false;
      roll(A, e.phase, A.n);
    }
  } else A.st += dt;
  A.t += dt;
  A.quiet = calm ? 0.5 : 1;
  A.lock = -1; A.lockT = -1; A.still = false; A.smear = false;
  const k = A.len > 0 ? clamp01(P.span[key] == null && left > 0 ? 1 - left / A.len : A.st / A.len) : 0;
  let phase = 'idle', kk = 0, frozen = false, since = -1;
  if (kind === 'build') {
    phase = 'build'; kk = k;
    const lock = P.lock[key];
    if (lock != null) { A.lock = lock; if (k >= lock) A.lockT = (k - lock) * A.len; }
    A.still = !P.more[key] && A.len > 0 && (1 - k) * A.len <= C.still;
  } else if (kind === 'swing' || (kind === 'fire' && A.st < C.fire)) {
    phase = 'swing'; kk = kind === 'fire' ? A.st / C.fire : k;
  } else if (kind) {                         // recoil, after its holds: contact (a landed hit only), then follow-through
    if (!A.rec) { A.rec = true; A.rt = 0; A.rkey = key; A.r0 = A.st; } else A.rt += dt;
    const contact = A.hit ? A.tier.contact : 0;
    if (A.rt < contact) { phase = 'swing'; frozen = true; }   // the contact pose, held as it was
    else {
      const first = key === A.rkey, start = first ? A.r0 : 0, hold = first ? contact + A.style.follow : 0;
      const span = A.len - start - hold;
      phase = 'recoil'; kk = span > 0 ? clamp01((A.st - start - hold) / span) : 1;
      if (first) since = A.rt - contact;     // its time from the contact pose's end, not rounded to frames
    }
  } else A.hit = false;
  if (since >= 0) A.pt = since; else if (phase !== was) A.pt = 0; else if (!frozen) A.pt += dt;
  // a step that another step of the same phase follows fills only half of what is left of it, so k never drops
  const share = P.more[key] && (kind !== 'fire' || phase === 'recoil') ? 0.5 : 1;
  if (!frozen) A.k = phase === A.carry && phase !== 'idle' ? A.k0 + (1 - A.k0) * kk * share : kk * share;
  A.phase = phase;
  if (phase === 'swing' && !frozen) A.smear = A.pt >= C.smearAt && A.pt < C.smearAt + 1 / 30;
  if (phase !== was && ((phase === 'swing' && !frozen && A.tier.puff.includes('launch')) || (phase === 'recoil' && A.tier.puff.includes('land')))) attackPuff(fx, e);
  return A;
}
