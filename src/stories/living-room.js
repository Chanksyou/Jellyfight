// Stories: the living room's layout (layout-baked.js acts 1 and 4: the same room) and the view from
// its windows (skyline.js: the apartment is on the 33rd floor).
import { movables, visibleBox } from '../layout.js';
import { ELITES4 } from '../stage4.js';
import { HIDDEN_SHELL } from '../layout-baked.js';
import { meshesNamed } from '../traversal.js';
import * as THREE from 'three';
import { G, fresh, night4, ok, step, story } from './kit.js';

// objects the new layout deleted: every plant that lost its pot or stand (and the Monstera and Tall snake plant), the pillows and the rest
const GONE = ['Round_plant_stand', 'Snake_plant', 'Tall_snake_plant', 'Rubber_plant', 'Monstera', 'Aloe', 'Cat_window_perches', 'Globe_clamp_lamp', 'Olive_pillow', 'Fluffy_white_pillow', 'Red_hardcover'];
const box = (key) => { const m = movables(G().APT.root).find((q) => q.key === key + '#1'); return m && m.node.visible ? visibleBox(m.node, new THREE.Box3()) : null; };
const near = (v, w, e = 0.05) => v.every((n, i) => Math.abs(n - w[i]) <= e);
// where the sofa, the coffee table and the lounge chair stand in the new layout (min x,z and max x,z)
const SPOTS = { Corduroy_sofa: [0.49, 0.47, 2.91, 2.08], Glass_coffee_table: [1.3, 1.89, 2.67, 2.88], Lounge_chair: [2.82, 0.59, 3.49, 1.43] };
const layoutOk = () => {
  // the plants that are loose pieces of the walls-and-floor mesh (no editor handle) are hidden too
  const shell = G().APT.root.getObjectByName('Shell'), loose = [];
  shell.traverse((o) => { if (HIDDEN_SHELL[G().run.stage.id].includes(o.name) && o.visible) loose.push(o.name); });
  const gone = [...GONE.filter((k) => box(k)), ...loose], moved = Object.entries(SPOTS).filter(([k, w]) => { const b = box(k); return !b || !near([b.min.x, b.min.z, b.max.x, b.max.z], w); }).map(([k]) => k);
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

story('room/the-monitor-shows-the-canyon-wallpaper', {
  about: 'The desk monitor displays a centered Jelly Run window between the warm sunset canyon and cool forest on its existing unlit screen.',
  setup() {},
  play() {
    const screen = meshesNamed(G().APT.root, 'Ultrawide monitor')
      .find((mesh) => mesh.material.isMeshBasicMaterial && mesh.material.map?.repeat.x === -1);
    const image = screen?.material.map.image;
    if (!image || image.width !== 512 || image.height !== 160) return ok(false, { screen: !!screen, width: image?.width, height: image?.height });
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    // GLTFExporter flips CanvasTexture rows for the monitor's existing UVs.
    ctx.translate(0, canvas.height);
    ctx.scale(1, -1);
    ctx.drawImage(image, 0, 0);
    const sunset = ctx.getImageData(65, 48, 1, 1).data;
    const forest = ctx.getImageData(410, 46, 1, 1).data;
    const menu = ctx.getImageData(251, 48, 1, 1).data;
    const play = ctx.getImageData(191, 105, 1, 1).data;
    return ok(sunset[0] > sunset[2] + 55 && forest[2] > forest[0] + 16
      && menu[1] > menu[0] + 30 && play[0] > 210 && play[1] > 175 && play[2] < 160,
      { sunset: [...sunset], forest: [...forest], menu: [...menu], play: [...play] });
  },
});

story('engine/the-view-is-from-the-33rd-floor', {
  about: 'The 33rd-floor view shares one opaque draw and one atlas for the painted panorama and close towers. Its geometry never joins the collision world.',
  setup() {},
  play() {
    const { APT, world, run } = G(), ring = APT.scene.getObjectByName('Skyline');
    if (!ring) return ok(false, { ring: false });
    run.setNight(0);
    const { geometry, material } = ring;
    geometry.computeBoundingBox();
    const triangles = geometry.index.count / 3, { min, max } = geometry.boundingBox;
    const image = material.map?.image;
    const solid = world.colliders.includes(ring);
    return ok(ring.isMesh && material.isMeshBasicMaterial && material.depthWrite && !material.transparent
      && !material.fog && !ring.castShadow && ring.userData.noCollide && !solid
      && APT.scene.children.filter((o) => o.name === 'Skyline').length === 1
      && geometry.groups.length === 0 && triangles <= 320 && min.y <= -90 && max.y >= 25
      && image?.width === 2048 && image.height === 512 && material.userData.daylight.value === 0,
      { triangles, height: [min.y, max.y], atlas: [image?.width, image?.height], solid });
  },
});

story('room/copies-share-batches', {
  about: 'Ten copies of a piece of furniture (the layout editor\'s Duplicate) share its geometry and materials, carry no lights and go in its batches: the room has no more to draw than before.',
  setup() { fresh({ elites: false }); },
  play() {
    const { statics, APT } = G(), scene = APT.scene;
    try { localStorage.removeItem('jf-layout-v1'); } catch {}
    document.querySelector('#g-over').hidden = false;
    document.querySelector('#g-over [data-act="layout"]').click(); step(30);
    const L = window.layout;
    if (!L) return ok(false, { layout: null });
    const meshes = (n) => { const out = []; n.traverse((o) => { if (o.isMesh) out.push(o); }); return out; };
    const batched = new Set(statics.batches.flatMap((b) => b.pieces.map((p) => p.mesh)));
    const src = L.items.find((it) => !it.added && it.node.visible && meshes(it.node).length > 1 && meshes(it.node).every((m) => batched.has(m) && m.visible));
    // what the renderer has to draw: every shown mesh on the camera's layers (a batch is one)
    const draws = () => { let n = 0; scene.traverseVisible((o) => { if (o.isMesh && o.layers.test(APT.camera.layers)) n++; }); return n; };
    const before = draws();
    L.sel = src;
    const had = new Set(L.items);
    for (let i = 0; i < 10; i++) L.duplicate();
    const copies = L.items.filter((x) => !had.has(x)), own = meshes(src.node);
    const shared = copies.every((c) => meshes(c.node).every((m, i) => m.geometry === own[i].geometry && m.material === own[i].material));
    const lights = copies.reduce((n, c) => { c.node.traverse((o) => { if (o.isLight) n++; }); return n; }, 0);
    const after = draws();
    // and every copy is drawn: in a batch, or by itself
    const inBatch = new Set(statics.batches.flatMap((b) => b.pieces.filter((p) => p.inBatch).map((p) => p.mesh)));
    const drawn = copies.every((c) => meshes(c.node).every((m) => inBatch.has(m) || m.layers.test(APT.camera.layers)));
    for (const c of copies) L.drop(c);
    try { localStorage.removeItem('jf-layout-v1'); } catch {}
    L.onDone();
    return ok(src && copies.length === 10 && shared && !lights && drawn && after === before, { src: src?.key, copies: copies.length, shared, lights, drawn, before, after });
  },
});
