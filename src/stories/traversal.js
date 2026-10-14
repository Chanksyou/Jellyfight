// Stories: getting around: vents and climbs. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import { TouchControls } from '../touch.js';
import { G, fresh, ok, sim, story, tp } from './kit.js';

// --- getting around: every vent lands where it says, the climbs and walls hold
const VENT_TARGETS = () => G().traversal.vents.map((v) => ({ to: v.to, x: v.x, z: v.z, land: v.land }));
for (const to of ['the sofa', 'the coffee table', 'the media console', 'the desk', 'the lounge chair', 'the stovetop']) {
  story(`traversal/vent-to-${to.replace('the ', '').replace(/ /g, '-')}`, {
    about: `Stepping on the vent flings you onto ${to}.`,
    setup() { fresh({ elites: false }); const v = VENT_TARGETS().find((v) => v.to === to); tp(v.x, 0.05, v.z, 0); },
    play() {
      const v = VENT_TARGETS().find((v) => v.to === to);
      const r = sim(3);
      const [x, y, z] = r.pos, [lx, ly, lz] = v.land;
      return ok(Math.hypot(x - lx, z - lz) < 0.08 && Math.abs(y - ly) < 0.06 && r.grounded, { end: r.pos, target: v.land });
    },
  });
}
let ventHome = null;
story('traversal/moved-vent-still-lands', {
  about: 'A vent moved in the layout editor launches from its new spot and lands on its new target.',
  setup() {
    fresh({ elites: false });
    const { traversal } = G(), v = traversal.vents[0];
    ventHome = [v.at, v.land];
    traversal.placeVent(0, [v.x + 0.15, v.y, v.z - 0.05], [2.6, 0.46, 3.0]);
    tp(v.x, 0.05, v.z, 0);
  },
  play() {
    const r = sim(3);
    G().traversal.placeVent(0, ...ventHome);
    const [x, y, z] = r.pos;
    return ok(Math.hypot(x - 2.6, z - 3.0) < 0.08 && Math.abs(y - 0.46) < 0.06 && r.grounded, { end: r.pos });
  },
});
story('traversal/sofa-climb', {
  about: 'Holding jump against the front of the corduroy sofa climbs it.',
  setup() { fresh({ elites: false }); tp(1.6, 0.05, 2.6, 0); },
  play() { sim(3, ['Space', 'KeyW']); const r = sim(1, ['KeyW']); return ok(r.pos[1] > 0.45, { end: r.pos }); },
});
story('traversal/hallway-walled', {
  about: 'The living room opening into the hallway is walled off in stage 1.',
  setup() { fresh({ elites: false }); tp(3.0, 0.05, 4.6, Math.PI); },
  play() { const r = sim(3, ['KeyW']); return ok(r.pos[2] < 4.83, { end: r.pos }); },
});
story('traversal/touch-stick-past-ring', {
  about: 'On a phone, dragging the joystick past its ring still swims at full speed, not slower.',
  setup() { fresh({ elites: false }); },
  play() {
    const fake = {}, tc = new TouchControls(fake);
    tc.el.setPointerCapture = () => {};
    const at = (type, x, y) => tc.el.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, bubbles: true }));
    at('pointerdown', 10, 300);
    const mag = (dx) => { at('pointermove', 10 + dx, 300); return +Math.hypot(fake.touchMove.x, fake.touchMove.y).toFixed(3); };
    const ring = mag(50), far = mag(150), farther = mag(400);
    at('pointerup', 410, 300);
    return ok(ring === 1 && far === 1 && farther === 1 && fake.touchMove === null, { ring, far, farther });
  },
});
story('traversal/touch-stick-lost-touch', {
  about: 'If a thumb lifts and the phone never says so, the next thumb on the left still gets the stick.',
  setup() { fresh({ elites: false }); },
  play() {
    const fake = {}, tc = new TouchControls(fake);
    tc.el.setPointerCapture = () => {};
    const at = (type, id, x, y) => tc.el.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true }));
    at('pointerdown', 1, 10, 300); at('pointermove', 1, 10, 250);   // this finger's pointerup never comes
    at('pointerdown', 2, 20, 300); at('pointermove', 2, 80, 300);   // a new thumb pushes right
    const took = fake.touchMove && fake.touchMove.x > 0.9;
    at('pointerup', 2, 80, 300);
    return ok(took && fake.touchMove === null, { move: fake.touchMove });
  },
});
story('traversal/force-fields-show', {
  about: 'Every invisible wall in the act (and the boss arena, once the fight starts) has a glowing force field you can see.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run, APT } = G(), fields = [];
    APT.scene.traverse((o) => { if (o.name === 'Force field') fields.push(o); });
    const walls = (run.stage.walls || []).filter((w) => w.max[1] - w.min[1] > 0.2).length;
    const shown = fields.filter((f) => f.visible).length;
    const boss = run.bossWalls.filter((m) => m.userData.field).length;
    return ok(shown === walls && walls > 0 && boss === run.bossWalls.length && fields.every((f) => f.userData.noCollide), { walls, shown, fields: fields.length, boss });
  },
});