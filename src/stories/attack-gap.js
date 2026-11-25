// The attack gap (content/waves.kdl attack-gap, enemies.js, go() in src/words.js): no two bugs
// start their attacks within the gap of each other, bugs in a crowd still attack as often, and a
// bug on screen goes before one off it.
import * as THREE from 'three';
import { CONTENT } from '../content.js';
import { G, V, holdJelly, ok, setupFight, spawn, step, story, stub } from './kit.js';

const calm = () => { const { run } = G(); stub(run, 'hurt', () => {}); stub(run, 'hit', () => {}); run.health = 1e6; };
const attacking = (e) => (e.state !== 'approach' && e.state !== 'rest') || e.aimT > 0;   // a wind-up started (spit: its aim)
// a ring of bugs round a still jelly, each within its attack range; every start, as [second, bug]
function crowd(types, secs, r = 0.16, gap = null) {
  setupFight({ bubbles: false, lash: false }); holdJelly(); calm();
  if (gap !== null) stub(CONTENT.waves, 'attackGap', gap);
  const P = G().player.position, bugs = types.map((t, i) => {
    const a = (i / types.length) * Math.PI * 2, fly = CONTENT.enemies[t]?.fly;
    return spawn(t, V(P.x + Math.cos(a) * r, P.y + (fly ? 0.06 : 0.01), P.z + Math.sin(a) * r), { hp: 1e7 });
  });
  const was = new Map(), starts = [];
  step(Math.round(secs * 60), (f) => {
    for (const e of bugs) { const on = attacking(e); if (on && !was.get(e)) starts.push([f / 60, e]); was.set(e, on); }
  });
  for (const e of bugs) G().enemies.kill(e, true);
  return starts;
}
const gaps = (starts) => starts.slice(1).map(([t, e], i) => (e === starts[i][1] ? Infinity : t - starts[i][0]));

story('bugs/attacks-do-not-start-together', {
  about: 'Six Mosquitoes and four Spotted lanternflies right beside a still jelly: no bug starts its attack within the attack gap (0.3 s) of another bug\'s start. With the gap set to 0 some do.',
  setup() {},
  play() {
    const types = ['mosquito', 'mosquito', 'mosquito', 'lanternfly', 'lanternfly', 'mosquito', 'mosquito', 'lanternfly', 'mosquito', 'lanternfly'];
    const gap = CONTENT.waves.attackGap, frame = 1 / 60 + 1e-6;
    const held = gaps(crowd(types, 12)), free = gaps(crowd(types, 12, 0.16, 0));
    const close = (g) => g.filter((x) => x < gap - frame).length;
    return ok(gap >= 0.3 && held.length >= 10 && close(held) === 0 && close(free) > 0, { gap, starts: held.length + 1, tooClose: close(held), tooCloseWithout: close(free), nearest: +Math.min(...held).toFixed(3) });
  },
});

story('bugs/attack-as-often-as-before', {
  about: 'A 14-bug crowd in act 1\'s mix (6 Cockroaches, 3 Ants, 3 Mosquitoes, 2 Spotted lanternflies) round a still jelly for 40 s: the bugs start as many attacks with the attack gap as without it, within 6% (about 4% fewer: every bug in reach the whole time is the worst case).',
  setup() {},
  play() {
    const types = ['roach', 'ants', 'mosquito', 'roach', 'lanternfly', 'ants', 'roach', 'mosquito', 'roach', 'ants', 'lanternfly', 'roach', 'mosquito', 'roach'];
    const held = crowd(types, 40, 0.2).length, free = crowd(types, 40, 0.2, 0).length;
    return ok(free > 30 && Math.abs(held - free) <= free * 0.06, { held, free, change: +((held / free - 1) * 100).toFixed(1) + '%' });
  },
});

story('bugs/seen-bugs-attack-first', {
  about: 'Two Spotted lanternflies ready to leap at the same moment, one on screen and one off it, after a third bug\'s leap held them both: the one on screen starts first, though the one off screen comes first in the bug list.',
  setup() {},
  play() {
    setupFight({ bubbles: false, lash: false }); holdJelly(); calm();
    step(5);
    const { enemies } = G(), camera = enemies.fx.camera, P = G().player.position.clone();
    camera.updateMatrixWorld();
    const view = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const spot = (inView) => {
      for (let i = 0; i < 160; i++) {
        const a = i * 0.39, d = 0.3 + (i % 5) * 0.06, at = V(P.x + Math.cos(a) * d, P.y + 0.01, P.z + Math.sin(a) * d);
        if (view.intersectsSphere(new THREE.Sphere(at, 0.12)) === inView && G().run.world.cast(V(at.x, P.y + 0.1, at.z), V(0, -1, 0), 0.2)) return at;
      }
      return null;
    };
    const out = spot(false), inside = spot(true);
    if (!out || !inside) return ok(false, { out: !!out, inside: !!inside });
    const hidden = spawn('lanternfly', out, { hp: 1e7 }), seen = spawn('lanternfly', inside, { hp: 1e7 });
    const first = spawn('lanternfly', inside.clone().lerp(P, 0.3), { hp: 1e7 });
    hidden.leapCd = seen.leapCd = 0.1; first.leapCd = 0;
    let order = null;
    step(120, () => {
      const h = attacking(hidden), s = attacking(seen);
      if (h || s) order = s && !h ? 'seen' : h && !s ? 'hidden' : 'both';
      return !!order;
    });
    const info = { order, firstLeapt: first.state !== 'approach', hiddenSeen: view.intersectsSphere(new THREE.Sphere(hidden.pos, hidden.r * 2)) };
    for (const e of [hidden, seen, first]) enemies.kill(e, true);
    return ok(order === 'seen' && info.firstLeapt && !info.hiddenSeen, info);
  },
});
