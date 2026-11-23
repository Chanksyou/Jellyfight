// Stories: the Overdraw view (src/overdraw.js). How many layers a pixel gets at the game's heaviest stacks of
// see-through marks stays under a ceiling (what the trims in changes/phone-perf-g4.md measured, plus 10%), so
// a new effect that piles layers up shows here. Counts are layers a pixel is drawn over, headless, not a phone's time.
import { G, ok, story } from './kit.js';
import * as K from './kit.js';
import { nav } from '../stages.js';
import { MOMENTS, STACKS } from '../bench-moments.js';
import { measureOverdraw } from '../overdraw.js';

// run a moment, look all round (four quarter turns) and keep the heaviest view: [layers on average, worst layers] for see-through pieces
function stack(page, name) {
  const { GAME, APT, tpc } = G(), table = STACKS[page]?.[name] ? STACKS[page] : MOMENTS[page];
  table[name]({ K, G: G(), nav });
  K.step(30); GAME.render();
  const yaw0 = tpc.yaw, got = { avg: 0, all: 0, worst: 0 };
  for (let i = 0; i < 4; i++) {
    tpc.yaw = yaw0 + (i * Math.PI) / 2; K.step(6); GAME.render();
    const t = measureOverdraw(APT.renderer, APT.scene, APT.camera, { seeThrough: true, room: APT.arena ? null : APT.root }), a = measureOverdraw(APT.renderer, APT.scene, APT.camera);
    got.avg = Math.max(got.avg, t.avg); got.worst = Math.max(got.worst, t.worst); got.all = Math.max(got.all, a.avg);
  }
  tpc.yaw = yaw0;
  return got;
}
// [page, moment, ceiling for see-through layers on average, ceiling for all pieces on average]
const CEILING = {   // [moment, see-through ceiling, all-pieces figure (printed only: it moves with the view and the faded furniture)]
  // (act 1's first two rose by about 0.05 for the soft shadows under each bug, systems.js: small round see-through discs)
  act1: [['bugs + Controller', 2.0, 7.9], ['bubble storm + Bubble Bath', 0.5, 3.6], ['Vacuum fight', 0.7, 4.1]],
  night4: [['three bugs + 12 Firefly pools', 1.9, 3.7], ['bass wave + sun', 0.45, 2.4]],
  arena: [['Encore disco', 0.71, 5.2], ['Encore Pyro, six lanes', 2.41, 6.1]],
};
const budget = (page) => () => {
  const rows = CEILING[page].map(([name, see, all]) => ({ name, see, all, got: stack(page, name) }));
  return ok(rows.every((r) => r.got.avg <= r.see), { rows: rows.map((r) => `${r.name}: see-through ${r.got.avg} (max ${r.see}), all ${r.got.all} (max ${r.all}), worst ${r.got.worst}`) });
};

story('engine/overdraw-stays-under-budget', {
  about: 'On the phone page in act 1, a pixel is drawn over by no more layers than a ceiling at the crowd with the Controller, a bubble storm with Bubble Bath and the Vacuum\'s fight (its spin) (see-through pieces other than the apartment own pieces, each from the heaviest of four views).',
  phone: true,
  setup() {},
  play: budget('act1'),
});
story('night4/overdraw-stays-under-budget', {
  about: 'In act 4\'s night, a pixel is drawn over by no more layers than a ceiling at the 12 Firefly pools, the bass wave with the sun.',
  setup() {},
  play: budget('night4'),
});
story('encore/overdraw-stays-under-budget', {
  about: 'On the phone page in the arena, a pixel is drawn over by no more layers than a ceiling at the disco ball and the gold DJ\'s Pyro with six lanes warning: the stage-edge flash is not drawn while it is idle.',
  phone: true, act: 4, scene: 2,
  setup() {},
  play: budget('arena'),
});

story('engine/overdraw-counts-layers', {
  about: 'The overdraw measure counts layers: three full-screen see-through planes are 3 layers everywhere, a see-through box is 1 layer on its near face and 2 when drawn on both faces, and a plane that is not drawn is 0; the dev panel\'s Overdraw view draws the scene as flat layers and puts the picture back.',
  setup() {},
  play() {
    const { THREE, APT, gfx } = G();
    const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    cam.position.z = 5;
    const plane = (z, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), mat); m.position.z = z; scene.add(m); return m; };
    const glass = (extra = {}) => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, ...extra });
    const a = plane(0, glass()), b = plane(-1, glass()), c = plane(-2, new THREE.MeshBasicMaterial());
    const three = measureOverdraw(APT.renderer, scene, cam, {}), glassOnly = measureOverdraw(APT.renderer, scene, cam, { seeThrough: true });
    a.visible = b.visible = c.visible = false;
    const none = measureOverdraw(APT.renderer, scene, cam, {});
    // a closed box seen from outside: its near face is 1 layer; drawn on both faces (DoubleSide) the far face adds a second
    const box = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 1), glass()); scene.add(box);
    const oneFace = measureOverdraw(APT.renderer, scene, cam, {});
    box.material.side = THREE.DoubleSide; box.material.needsUpdate = true;
    const bothFaces = measureOverdraw(APT.renderer, scene, cam, {});
    // the dev view: on, it draws something other than the game's picture; off, the picture is back
    const bg = APT.scene.background, was = gfx.overdraw;
    const draws = (on) => { gfx.overdraw = on; gfx.render(); return gfx.frameInfo.calls; };
    const drawsOn = draws(true), drawsOff = draws(false);
    gfx.overdraw = was;
    const fine = APT.scene.background === bg && !APT.scene.overrideMaterial;
    return ok(three.avg === 3 && three.worst === 3 && three.covered === 1 && glassOnly.avg === 2 && none.avg === 0 && oneFace.worst === 1 && bothFaces.worst === 2 && drawsOn > 0 && drawsOff > 0 && fine,
      { three, glassOnly, none, oneFace, bothFaces, drawsOn, drawsOff, fine });
  },
});

story('encore/stage-edge-flash-is-only-drawn-while-it-flashes', {
  about: 'The stage edge\'s shock flash (a sphere, clear at opacity 0) is not drawn until the jelly touches the edge, is drawn while it flashes, and is gone again after it: no layers of nothing across the arena, and no new shader built when it first shows.',
  act: 4, scene: 2,
  setup() {},
  play() {
    const { APT } = G(), B = K.encoreFight({ beat: 96 }), c = B.contact, p = { position: K.V(0, 0, -0.189), cfg: G().CONFIG?.player || G().player.cfg };
    K.step(5);
    const idle = !c.flash.visible, programs = APT.renderer.info.programs.length;
    c.update(0, p); c.update(1 / 60, p); G().GAME.render();
    const flashing = c.flash.visible && c.life > 0, built = APT.renderer.info.programs.length - programs;
    for (let i = 0; i < 40; i++) c.update(1 / 60, { position: K.V(5, 0, 5), cfg: p.cfg });
    const gone = !c.flash.visible;
    c.reset();
    return ok(idle && flashing && built === 0 && gone && !c.flash.visible, { idle, flashing, built, gone });
  },
});
