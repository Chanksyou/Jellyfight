// Stories: act 4 within the phone budget (the act 4 plan; numbers in /mnt/project-files/act4-perf/report.md,
// measured with tools/perf-phone.mjs). At its busiest the living room draws no more than act 1 does at
// its busiest plus 15 draw calls, and nothing in the room or the arena builds a shader during play
// (a phone stalls on each one) or adds or removes a light.
import * as THREE from 'three';
import { G, act4, encoreFight, fresh, headphones, near, night4, ok, spawn, startHeadphones, step, stub, tp } from './kit.js';

// Act 1's busiest moment (14 bugs round the jelly in the living room while the Controller attacks),
// counted by sceneDraws below on main at the act 4 perf check (Nov 18 2026): the budget is that + 15.
// The concert dressing's own draws come out of the same 15.
export const ACT1_BUSIEST = 247;
export const BUDGET = ACT1_BUSIEST + 15;

const tiny = { t: null };
// The most draw calls the scene pass takes (the furniture, bugs, effects, Warnings: what the
// composer's own passes add is the same in every act) as the camera turns once round the jelly, in a
// phone's wider view. Stepping the game a frame per heading, so what's going on goes on.
export function sceneDraws(headings = 16) {
  const { APT, tpc, batcher, statics } = G(), R = APT.renderer, cam = APT.camera, info = R.info;
  tiny.t ||= new THREE.WebGLRenderTarget(4, 4);
  const aspect = cam.aspect, auto = info.autoReset, was = R.getRenderTarget(), yaw = tpc.yaw;
  let most = 0;
  cam.aspect = 844 / 390; cam.updateProjectionMatrix();
  info.autoReset = false;
  try {
    for (let k = 0; k < headings; k++) {
      tpc.yaw = yaw + (k / headings) * Math.PI * 2;
      G().GAME.step(1 / 60);
      cam.aspect = 844 / 390; cam.updateProjectionMatrix();   // (a step's resize check may put it back)
      batcher.sync(); statics?.sync();
      R.setRenderTarget(tiny.t); info.reset(); R.render(APT.scene, cam);
      most = Math.max(most, info.render.calls);
    }
  } finally {
    R.setRenderTarget(was); info.autoReset = auto; cam.aspect = aspect; cam.updateProjectionMatrix(); tpc.yaw = yaw;
  }
  return most;
}
// what the scene needs built now: every program, by identity (one freed and another built keeps the count)
const built = () => { const { batcher, GAME, APT } = G(); batcher.sync(); GAME.compile(); return new Set(APT.renderer.info.programs); };
const lights = () => { let n = 0; G().APT.scene.traverse((o) => { if (o.isLight) n++; }); return n; };
const fresher = (before) => [...built()].filter((p) => !before.has(p)).map((p) => p.name || p.cacheKey.slice(0, 40));
const immortal = () => { const { run } = G(); stub(run, 'hurt', () => {}); run.health = 1e6; };

// the room at its busiest: every kind of act 4 bug out (14, act 3's most at once), 12 Firefly pools
// glowing, three butterflies' prism balls and their rings of bolts, the sun far across the floor and the bass wave going off; then the Headphones angry
night4('within-the-phone-budget-at-its-busiest', {
  about: 'Act 4\'s living room at its busiest (14 fireflies, monarch butterflies and cicadas round the jelly, 12 Firefly pools, three prism balls firing their rings of bolts, the sun late in the night and the bass wave going off; then the Headphones angry on the counter) draws no more than act 1 at its busiest plus 15 draw calls in a phone\'s view, builds no shader and adds or removes no light.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { run, enemies, player } = G(), before = built(), lit = lights();
    fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); immortal();
    stub(run, 'song', null); run.t = 150; step(2); run.beat = run.bass.next - 3.5;
    const kinds = ['firefly', 'butterfly', 'cicada'];
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, r = 0.25 + (i % 3) * 0.1; spawn(kinds[i % 3], near(Math.cos(a) * r, Math.sin(a) * r), { hp: 1e6 }); }
    const P = player.position, L = { flight: 1.2, peak: 0.2, radius: 0.14, dmg: 2, drain: 1, last: 10, most: 12 };
    for (let i = 0; i < 12; i++) { const to = P.clone().add({ x: -0.3 + (i % 4) * 0.2, y: 0, z: -0.3 + Math.floor(i / 4) * 0.2 }); enemies.glowPools.throw(to.clone().setY(to.y + 0.15), to, L, -1, 'firefly'); }
    step(90);
    const room = sceneDraws(), bugs = enemies.list.filter((e) => !e.dead).length, pools = enemies.glowPools.pools.length, bass = run.bass.state;
    step(60 * 4);   // the bugs' attacks
    const PR = { beats: 4, peak: 0.18, radius: 0.12, count: 12, speed: 0.35, life: 1.2, dmg: 2, burst: 3, most: 3 };   // and three prism balls at once, mid-flight with their rings out
    for (let i = 0; i < 3; i++) enemies.prismBalls.throw(near(0.3 * i - 0.3, 0.3, 0.3), near(0.3 * i - 0.3, -0.3), PR, -1, 'butterfly', run.beat);
    step(60 * 1.4);
    const later = sceneDraws(), bolts = enemies.prismBalls.bolts.length;
    startHeadphones(0, { angry: true, hold: true }); immortal(); headphones().cool = 0;
    step(60 * 3);
    const elite = sceneDraws(), most = Math.max(room, later, elite), fresh_ = fresher(before);
    return ok(most <= BUDGET && !fresh_.length && lights() === lit && bugs >= 14 && pools === 12 && bolts >= 60 && bass !== 'idle',
      { room, later, elite, budget: BUDGET, newShaders: fresh_, lights: [lit, lights()], bugs, pools, bolts, bass });
  },
});

// the arena: the Encore's drop (two floor waves and lasers) and its disco ball build nothing on the
// spot, though the fight starts the moment the arena loads (warmUp's own copy must leave its shaders)
act4('the-encore-builds-no-shader-mid-fight', {
  about: 'The Encore\'s fight builds no shader as it goes, through its drop (two floor waves at once and the lasers) and its disco ball, and adds or removes no light: its look was all built while the arena loaded.',
  setup() {},
  play() {
    const before = built(), lit = lights(), seen = [];
    const B = encoreFight({ beat: 92 }); immortal();
    B.hp = B.maxHp * 0.7;   // set 2, so its disco ball visits
    let disco = false;
    const look = () => { disco ||= B.disco.hanger.visible; for (const p of fresher(before)) if (!seen.includes(p)) seen.push(p); };
    for (let i = 0; i < 8; i++) { step(60); look(); }
    // straight on to just before its next disco ball visit (set list: every 32 beats, 16 after a solo slot), on its own clock
    stub(B, 'song', { beat: () => null, quiet: () => false, drop: () => false });
    const o = B.set.origin; B.clock = o + 16 + Math.ceil((B.beat + 8 - o - 16) / 32) * 32 - 7;
    for (let i = 0; i < 12; i++) { step(30); look(); }
    return ok(!seen.length && lights() === lit && disco, { newShaders: seen, lights: [lit, lights()], disco, beat: B.beat });
  },
});
