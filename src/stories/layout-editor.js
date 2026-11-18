// Stories: the dev layout editor's Add drawer, stamping, sticking and size (src/layout.js, layout-ui.js).
// (Duplicate, baked copies and prop entries are in main-screen-modes-engine.js.)
import * as THREE from 'three';
import { World } from '../collision.js';
import { loadLayout, visibleBox } from '../layout.js';
import { G, V, fresh, ok, step, story } from './kit.js';

const gone = () => { try { localStorage.removeItem('jf-layout-v1'); } catch {} };
// done: what you added leaves the room, and the editor (which lives on between stories) forgets its edits
function closeEditor(L) {
  if (L.active) L.onDone();
  for (const it of [...L.items]) { if (L.isNew(it)) L.drop(it); else { L.toHome(it); it.stick = undefined; } }
  L.data = {}; L.undoStack = []; L.stamp = null;
  gone(); document.querySelector('#g-over').hidden = true;
}
// the editor, open in act 1
function openEditor() {
  fresh({ elites: false }); gone();
  document.querySelector('#g-over').hidden = false;
  document.querySelector('#g-over [data-act="layout"]').click(); step(30);
  const L = window.layout;
  L.dom.setPointerCapture = () => {};   // taps below are made up, with no pointer to capture
  return L;
}
// look straight at a spot (the middle of the view is where Add drops things)
const look = (L, x, y, z, dist = 1.6) => { L.target.set(x, y, z); L.dist = dist; L.pitch = 1.2; step(2); L.camera.updateMatrixWorld(true); };
const wait = async (until) => { for (let i = 0; i < 400 && !until(); i++) await new Promise((r) => setTimeout(r, 25)); return until(); };
// where a world point is on the screen, as a pointer event sees it
const onScreen = (L, p) => { L.camera.updateMatrixWorld(true); const r = L.dom.getBoundingClientRect(), v = p.clone().project(L.camera); return { clientX: r.left + (v.x + 1) / 2 * r.width, clientY: r.top + (1 - v.y) / 2 * r.height }; };
const tapAt = (L, e) => {
  const at = { ...e, pointerId: 1, button: 0, bubbles: true };
  L.dom.dispatchEvent(new PointerEvent('pointerdown', at));
  L.dom.dispatchEvent(new PointerEvent('pointerup', at));
};
// is it solid: a ray down onto it, on a grid over its footprint, first meets one of its own meshes
const solid = (world, node) => {
  const b = visibleBox(node, new THREE.Box3()), within = (o) => { for (; o; o = o.parent) if (o === node) return true; return false; };
  world._focusAge = Infinity; world.focus(b.getCenter(new THREE.Vector3()), 0, 3);
  for (let i = 1; i < 6; i++) for (let k = 1; k < 6; k++) {
    const hit = world.cast(V(b.min.x + (b.max.x - b.min.x) * i / 6, b.max.y + 0.05, b.min.z + (b.max.z - b.min.z) * k / 6), V(0, -1, 0), b.max.y - b.min.y + 0.1);
    if (hit && within(hit.mesh)) return true;
  }
  return false;
};
const plants = (L) => L.items.filter((x) => /^prop:pothos#/.test(x.key) && !(x.key in L.baked));

story('dev/layout-add-prop-on-shelf', {
  about: 'Add opens a drawer listing the prop library (content/props.kdl) by label. Tapping Pothos places it on the top of whatever is in the middle of the view (a media console top, not inside it), solid, saved as a prop:<id>#n entry at its size, selected, with stamping switched on.',
  setup() { fresh({ elites: false }); gone(); },
  async play() {
    const L = openEditor(), { world } = G();
    try {
      look(L, 1.9, 0, 6.2);
      L.el.querySelector('[data-a=add]').click();
      const tiles = [...document.querySelectorAll('.jf-lt-sheet [data-prop]')].map((t) => t.dataset.prop);
      const wantTiles = (await import('../content.js')).CONTENT.props.map((p) => p.id);
      document.querySelector('.jf-lt-sheet [data-prop=pothos]').click();
      await wait(() => L.stamp);
      const it = L.sel, n = it?.node, entry = loadLayout(1)[it?.key];
      const drawerClosed = !document.querySelector('.jf-lt-sheet');
      const onTop = !!n && Math.abs(n.position.y - 0.6) < 0.03 && Math.hypot(n.position.x - 1.2, n.position.z - 4.6) < 0.2;
      const saved = entry?.prop === 'pothos' && entry.s === 1 && entry.p.length === 3 && entry.q.length === 4;
      const chip = L.el.querySelector('[data-a=stamp-off]');
      return ok(tiles.join() === wantTiles.join() && tiles.length >= 6 && /^prop:pothos#\d+$/.test(it?.key) && drawerClosed && onTop && saved && !!n && solid(world, n) && !chip.hidden && /Pothos/.test(chip.textContent),
        { tiles, key: it?.key, drawerClosed, at: n?.position.toArray().map((v) => +v.toFixed(3)), saved, chip: chip.textContent });
    } finally { closeEditor(L); }
  },
});

story('dev/layout-stamp-copies', {
  about: 'After Add, each tap on a surface drops another of the same prop (tapping something you added selects it instead), each solid and saved. One undo removes only the last. Esc stops stamping (a tap selects again); a second Esc is Done.',
  setup() { fresh({ elites: false }); gone(); },
  async play() {
    const L = openEditor(), { world } = G();
    try {
      look(L, 1.9, 0, 6.2, 2.4);
      await L.addProp('pothos');
      const r = L.dom.getBoundingClientRect();
      for (const dx of [-240, -120, 120, 240]) tapAt(L, { clientX: r.left + r.width / 2 + dx, clientY: r.top + r.height / 2 + 70 });
      const made = plants(L), five = made.length === 5 && Object.keys(loadLayout(1)).length === 5;
      const allSolid = made.every((x) => solid(world, x.node));
      const apart = new Set(made.map((x) => x.node.position.toArray().map((v) => v.toFixed(2)).join())).size === 5;
      const last = L.sel;
      L.undo();
      const undone = plants(L).length === 4 && !L.byNode.has(last.node) && !last.node.visible && Object.keys(loadLayout(1)).length === 4 && !solid(world, last.node);
      dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
      const stopped = !L.stamp && L.active;
      const before = plants(L).length;
      tapAt(L, { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 - 60 });
      const noMore = plants(L).length === before;
      dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
      return ok(five && allSolid && apart && undone && stopped && noMore && !L.active, { five, allSolid, apart, undone, stopped, noMore, active: L.active });
    } finally { closeEditor(L); }
  },
});

story('dev/layout-deleted-copy-not-solid', {
  about: 'A copy deleted in the layout editor stops blocking the jelly at once (rays and sweeps go through where it stood), and undo makes it solid again.',
  setup() { fresh({ elites: false }); gone(); },
  async play() {
    const L = openEditor(), { world } = G();
    try {
      L.sel = L.items.find((x) => x.key === 'Lounge_chair#1');
      L.duplicate();
      const c = L.sel, was = solid(world, c.node);
      L.deleteSelected();
      const deleted = !solid(world, c.node) && !L.byNode.has(c.node);
      L.undo();
      const back = solid(world, c.node) && L.byNode.has(c.node);
      // a baked copy deleted (kept as a deleted entry) is no more solid either
      L.sel = c; L.deleteSelected(); L.putBack();
      return ok(was && deleted && back, { was, deleted, back });
    } finally { closeEditor(L); }
  },
});

story('dev/layout-prop-size-and-stick', {
  about: 'A prop\'s size goes 0.5 to 2 in 10% steps about its base, is saved as s, and undo takes it back. Dragging a prop you added drops it on the top of what is under the pointer (a media console top), seeing through itself; furniture slides on the floor until Stick is switched on.',
  setup() { fresh({ elites: false }); gone(); },
  async play() {
    const L = openEditor();
    try {
      look(L, 1.9, 0, 6.2);
      await L.addProp('pothos'); L.endStamp();
      const it = L.sel, n = it.node, key = it.key;
      const base = n.position.y;
      L.resize(0.1); L.resize(0.1);
      const grown = n.scale.x === 1.2 && loadLayout(1)[key].s === 1.2 && Math.abs(n.position.y - base) < 1e-6;
      L.undo();
      const undone = n.scale.x === 1.1 && loadLayout(1)[key].s === 1.1;
      for (let i = 0; i < 30; i++) L.resize(-0.1);
      const small = n.scale.x === 0.5 && loadLayout(1)[key].s === 0.5;
      for (let i = 0; i < 40; i++) L.resize(0.1);
      const big = n.scale.x === 2 && loadLayout(1)[key].s === 2;
      for (let i = 0; i < 10; i++) L.resize(-0.1);   // back to its own size
      // drag it from the console top to the floor beside it, then up onto the console
      const grab = (p) => { const e = onScreen(L, p); L.dom.dispatchEvent(new PointerEvent('pointerdown', { ...e, pointerId: 1, button: 0, bubbles: true })); return e; };
      const move = (e, p) => { const to = onScreen(L, p); L.dom.dispatchEvent(new PointerEvent('pointermove', { ...to, pointerId: 1, bubbles: true })); return to; };
      const release = (e) => L.dom.dispatchEvent(new PointerEvent('pointerup', { ...e, pointerId: 1, bubbles: true }));
      const drag = (from, to) => { const e = grab(from); const t = move(e, to); release(t); };
      // a point on the prop itself (it's leaves and stems, with gaps between)
      const onIt = (x = it) => {
        const b = visibleBox(x.node, new THREE.Box3());
        for (let i = 1; i < 8; i++) for (let k = 1; k < 8; k++) for (const h of [0.3, 0.6]) {
          const p = V(b.min.x + (b.max.x - b.min.x) * i / 8, b.min.y + (b.max.y - b.min.y) * h, b.min.z + (b.max.z - b.min.z) * k / 8);
          if (L.pick(onScreen(L, p))?.it === x) return p;
        }
        return null;
      };
      const mid = onIt();
      if (!mid) return ok(false, { noGrip: true, scale: n.scale.x, visible: n.visible, sel: L.sel === it, items: L.byNode.has(n), box: visibleBox(n, new THREE.Box3()).min.toArray() });
      // dragged down in front of the console: it lands on whatever is there (the floor), not where it started
      const spot = V(1.0, 0, 5.1), under = L.surfaceHit(onScreen(L, spot), { exclude: n, up: true });
      drag(mid, spot);
      const afterFloor = n.position.toArray().map((v) => +v.toFixed(3));
      const onFloor = Math.abs(n.position.y - under.y) < 0.02 && n.position.y < 0.5 && Math.hypot(n.position.x - under.x, n.position.z - under.z) < 0.25;
      const there = onIt();
      const top = V(1.3, 0.6, 4.6), over = L.surfaceHit(onScreen(L, top), { exclude: n, up: true });
      drag(there, top);
      const onConsole = Math.abs(n.position.y - over.y) < 0.02 && over.y > 0.5 && Math.hypot(n.position.x - over.x, n.position.z - over.z) < 0.25;
      // furniture: slides on the floor by default, sticks when asked
      const chair = L.items.find((x) => x.key === 'Lounge_chair#1');
      const defaults = L.sticks(it) === true && L.sticks(chair) === false;
      const c = visibleBox(chair.node, new THREE.Box3()).getCenter(new THREE.Vector3());
      look(L, c.x, c.y, c.z, 2.2);
      L.sel = chair;
      const grip = onIt(chair), [x0, y0] = [chair.node.position.x, chair.node.position.y];
      drag(grip, grip.clone().add(V(0.3, 0, 0)));
      const slid = Math.abs(chair.node.position.y - y0) < 1e-6 && Math.abs(chair.node.position.x - x0 - 0.3) < 0.06;
      L.toggleStick();
      const toggled = L.sticks(chair) === true;
      return ok(grown && undone && small && big && onFloor && onConsole && defaults && slid && toggled, { grown, undone, small, big, onFloor, onConsole, over: over.toArray(), defaults, slid, toggled, afterFloor, y: n.position.y });
    } finally { closeEditor(L); }
  },
});

story('dev/layout-dressed-piece-not-copied', {
  about: 'The TV and the soundbar are drawn by the set dressing (the baked ones are hidden), so Duplicate refuses them instead of dropping a flat, hidden-model copy; a saved copy entry that names one is skipped at load.',
  setup() { fresh({ elites: false }); gone(); },
  async play() {
    const L = openEditor();
    try {
      const dressed = L.items.filter((x) => x.node.userData.dressed);
      for (const d of dressed) d.node.userData.dressed = false;   // as at boot, before set dressing has run: still known by name
      if (!dressed.length) return ok(false, { dressed: 0 });
      const before = L.items.length;
      for (const d of dressed) { L.sel = d; L.refresh(); L.duplicate(); }
      const refused = L.items.length === before && L.el.querySelector('[data-a=dup]').disabled;
      const { applyLayout } = await import('../layout.js');
      const made = await applyLayout(G().APT.root, 1, { [`copy:${dressed[0].key}#1`]: { from: dressed[0].key, p: [0, 0, 0], q: [0, 0, 0, 1] } });
      for (const d of dressed) d.node.userData.dressed = true;
      return ok(refused && made.length === 0, { dressed: dressed.map((d) => d.key), refused, made: made.length });
    } finally { closeEditor(L); }
  },
});

story('dev/layout-prop-moves-after-resize', {
  about: 'A prop can still be picked up and dragged after it has been made smaller or bigger, and again after it is back at its own size: a placed plant at 50%, 150%, 200% and 100% follows the pointer across the floor, a visible thing wins the pick over the invisible click box of the TV behind it, which used to swallow a small plant.',
  setup() { fresh({ elites: false }); gone(); },
  async play() {
    const L = openEditor(), out = {};
    try {
      look(L, 1.9, 0, 6.2);
      await L.addProp('pothos'); L.endStamp();
      const it = L.sel, n = it.node;
      const grab = (p) => { const e = onScreen(L, p); L.dom.dispatchEvent(new PointerEvent('pointerdown', { ...e, pointerId: 1, button: 0, bubbles: true })); return e; };
      const move = (p) => { const to = onScreen(L, p); L.dom.dispatchEvent(new PointerEvent('pointermove', { ...to, pointerId: 1, bubbles: true })); return to; };
      const release = (e) => L.dom.dispatchEvent(new PointerEvent('pointerup', { ...e, pointerId: 1, bubbles: true }));
      const onIt = () => {
        const b = visibleBox(n, new THREE.Box3());
        for (let i = 1; i < 8; i++) for (let k = 1; k < 8; k++) for (const h of [0.3, 0.6, 0.8]) {
          const p = V(b.min.x + (b.max.x - b.min.x) * i / 8, b.min.y + (b.max.y - b.min.y) * h, b.min.z + (b.max.z - b.min.z) * k / 8);
          if (L.pick(onScreen(L, p))?.it === it) return p;
        }
        return null;
      };
      // the flow in the real editor: the size button (selection stays), then straight to dragging it
      const spots = [V(1.0, 0, 5.4), V(1.0, 0, 6.6)];
      for (const s of [0.5, 1.5, 2, 1]) {
        while (Math.abs(n.userData.s - s) > 1e-6) L.resize(n.userData.s < s ? 0.1 : -0.1);
        L.refresh();
        for (const [i, spot] of spots.entries()) {
          const at = L.surfaceHit(onScreen(L, spot), { exclude: n, up: true }), grip = onIt();
          if (!grip) { out[`${s}-${i}`] = 'no grip'; continue; }
          const e = grab(grip); release(move(spot));
          out[`${s}-${i}`] = Math.hypot(n.position.x - at.x, n.position.z - at.z) < 0.3 && Math.abs(n.position.y - at.y) < 0.03;
        }
      }
      return ok(Object.values(out).every((v) => v === true), out);
    } finally { closeEditor(L); }
  },
});
