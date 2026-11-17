// Stories: the living room's layout (layout-baked.js acts 1 and 4: the same room) and the view from
// its windows (skyline.js: the apartment is on the 33rd floor).
import { movables, visibleBox } from '../layout.js';
import { ELITES4 } from '../stage4.js';
import * as THREE from 'three';
import { G, night4, ok, story } from './kit.js';

// objects the new layout deleted: every plant that lost its pot or stand (and the Monstera and Tall snake plant), the pillows and the rest
const GONE = ['Round_plant_stand', 'Snake_plant', 'Tall_snake_plant', 'Rubber_plant', 'Monstera', 'Aloe', 'Cat_window_perches', 'Globe_clamp_lamp', 'Olive_pillow', 'Fluffy_white_pillow', 'Red_hardcover'];
const box = (key) => { const m = movables(G().APT.root).find((q) => q.key === key + '#1'); return m && m.node.visible ? visibleBox(m.node, new THREE.Box3()) : null; };
const near = (v, w, e = 0.05) => v.every((n, i) => Math.abs(n - w[i]) <= e);
// where the sofa, the coffee table and the lounge chair stand in the new layout (min x,z and max x,z)
const SPOTS = { Corduroy_sofa: [0.49, 0.47, 2.91, 2.08], Glass_coffee_table: [1.3, 1.89, 2.67, 2.88], Lounge_chair: [2.82, 0.59, 3.49, 1.43] };
const layoutOk = () => {
  const gone = GONE.filter((k) => box(k)), moved = Object.entries(SPOTS).filter(([k, w]) => { const b = box(k); return !b || !near([b.min.x, b.min.z, b.max.x, b.max.z], w); }).map(([k]) => k);
  return ok(!gone.length && !moved.length, { gone, moved });
};

story('room/the-new-living-room-layout', {
  about: 'Act 1\'s living room has the layout Chan exported from the editor: the sofa, coffee table and lounge chair stand toward the window, and the plants that lost their pots and stands, with the pillows and lamp that went too, are gone (not shown, not solid).',
  setup() {},
  play: layoutOk,
});
night4('the-room-has-the-same-new-layout', {
  about: 'Act 4 is the same living room: the sofa, coffee table and lounge chair in the same places and the same things deleted. Its Elites stand on the moved furniture (each on its seat or counter, as the elite-spot stories check).',
  setup() {},
  play() {
    const r = layoutOk(), seat = ELITES4.filter((e) => e.area !== 'kitchen counter').every((e) => {
      const f = box(e.area === 'sofa' ? 'Corduroy_sofa' : 'Lounge_chair');
      return f && e.at[0] > f.min.x && e.at[0] < f.max.x && e.at[2] > f.min.z && e.at[2] < f.max.z;
    });
    return ok(r.ok && seat, { ...r.info, seat });
  },
});

story('engine/the-view-is-from-the-33rd-floor', {
  about: 'Through the windows you look out over a city far below, not at a flat dark wall: one unlit ring of towers and street lights round the apartment (skyline.js), about 100 m down to the streets, a single draw call that is never a light and never solid.',
  setup() {},
  play() {
    const { APT } = G(), ring = APT.scene.getObjectByName('Skyline');
    const lights = []; APT.scene.traverse((o) => { if (o.isLight) lights.push(o); });
    const stuff = ring && ring.geometry.parameters;
    return ok(ring && ring.isMesh && !Array.isArray(ring.material) && ring.material.isMeshBasicMaterial && !ring.material.depthWrite && ring.userData.noCollide
      && stuff.radiusTop > 20 && stuff.height >= 100 && ring.position.y + stuff.height / 2 >= 0 && ring.position.y - stuff.height / 2 <= -90
      && APT.scene.children.filter((o) => o.name === 'Skyline').length === 1,
      { ring: !!ring, stuff, y: ring?.position.y, lights: lights.length });
  },
});
