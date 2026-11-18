// Dev tool: move, rotate, raise/lower and hide the apartment's furniture and objects.
//
// Edits are saved in this browser (localStorage) and applied every time the game loads, before
// collisions are built, so a moved sofa is solid where you put it. "Export" gives a JSON code
// to paste back to Claude so the layout can be baked in for everyone.
//
// Desktop: click an object to select it (or pick it from the list), drag it to move it along
// the floor, WASD/arrows pan, wheel zooms, right-drag turns the view. Q/E rotate 15° (hold
// Shift for 90°), R/F raise/lower 1 cm (Shift: 5 cm), H hide, Del delete, Ctrl+Z undo, Esc done.
// The screen itself (bars, Add drawer, sheets) is layout-ui.js; the ? button lists every key.
//
// Edits are kept per act: the Act buttons in the top bar reload the game into that act with
// the editor open, and each act's edits (and export) are its own — however many acts the
// game grows. Hide just stops showing an object; delete records { deleted: true } so the
// bake drops it for good. Hidden and deleted objects stay selectable in the list, and
// ⌂ (put back) or 👁 restores them.
// Touch: tap to select, drag it to move; drag empty space to pan; pinch to zoom; the bars do the rest.
//
// Floor vents are edited here too: each has an orange disc (the grille on the floor) and a cyan
// ball (where it throws you), joined by the arc of the jump. Drag either one and it sticks to
// whatever surface is under the pointer; R/F nudge it up and down. Vent edits are saved and
// exported with the furniture, keyed "vent:<name>" with `at` and `land` in world meters.
// Other stage markers (treasure spots, elites) don't follow moved furniture yet.
//
// Added things: Duplicate (Ctrl+D) drops a copy of the selected object 10 cm aside, saved as
// "copy:<object key>#n" { from, p, q }; a library prop (props.js) is "prop:<id>#n" { prop, p, q, s }.
// They're made before the collision world is built, so they're solid like the room's own
// furniture. Deleting one you added removes its entry; deleting a baked one records it deleted.
// Add (the drawer) places a prop in the middle of the view and then stamps one more on each tap
// on a surface; things you added stick to the top of whatever is under the pointer as you drag.
import * as THREE from 'three';
import { BAKED_LAYOUT, HIDDEN_SHELL } from './layout-baked.js';
import { HIDDEN } from './batch.js';
import { loadProps } from './props.js';
import { LayoutUi } from './layout-ui.js';
import { DRESSED } from './set-dressing.js';

const KEY = 'jf-layout-v1';
const SKIP = /^(Shell|door-|Hall_lights|LED_cove|Kitchen_lights|Closet$)/;   // walls, doors and lights stay put

// Every movable object: the Apartment node's named children, keyed "name#n" (names can repeat)
export function movables(root) {
  const app = root.getObjectByName('Apartment') || root;
  const seen = {}, out = [];
  for (const o of app.children) {
    if (o.userData.added) continue;   // copies and props: keyed by their layout entry (addedThings), never renumbering the room's own
    const n = seen[o.name] = (seen[o.name] || 0) + 1;
    if (!o.name || SKIP.test(o.name)) continue;
    out.push({ key: `${o.name}#${n}`, node: o });
  }
  return out;
}

const ADDED = /^(copy|prop):[^"'<>&]+#\d+$/;
// The copies and props added to the room (layout entries "copy:…" and "prop:…")
export function addedThings(root) {
  const app = root.getObjectByName('Apartment') || root;
  return app.children.filter((o) => o.userData.added).map((o) => ({ key: o.userData.added, node: o, added: true }));
}

// A copy of a room object (or a prop's template): the same geometry and materials, so it's drawn
// in the same batches (static-batch.js), and no lights (a light added during play rebuilds every shader)
export function copyOf(src) {
  const c = src.clone(), lights = [];
  c.traverse((o) => {
    if (o.isLight) lights.push(o);
    else if (o.layers.isEnabled(HIDDEN)) o.layers.set(0);   // the source is drawn in a batch; the copy joins it there
  });
  for (const l of lights) l.removeFromParent();
  return c;
}

// The TV, soundbar and shower curtain are drawn by set-dressing.js (the baked piece is hidden, and set dressing
// runs after the layout at boot, so it's known by name): a copy would be the flat baked one
export const isDressed = (node) => !!node.userData.dressed || DRESSED.includes(node.name);

// Make this act's added things that aren't in the room yet: a copy once its source's room is
// loaded (a later act's rooms arrive with loadRooms), a prop once the library has it
async function addThings(root, baked, data) {
  const app = root.getObjectByName('Apartment') || root;
  const have = new Set(addedThings(root).map((t) => t.key));
  const want = [...new Set([...Object.keys(baked), ...Object.keys(data)])].filter((k) => ADDED.test(k) && !have.has(k)).map((k) => [k, { ...baked[k], ...data[k] }]);
  if (!want.length) return [];
  const ids = [...new Set(want.map(([, e]) => e.prop).filter(Boolean))];
  // one at a time (one download): a prop that can't load is skipped, like a missing source, and the rest still come
  const props = Object.assign({}, ...await Promise.all(ids.map((id) => loadProps([id]).catch(() => ({})))));
  const src = new Map(movables(root).map((m) => [m.key, m.node]));
  const made = [];
  for (const [key, e] of want) {
    const from = e.from ? src.get(e.from) : props[e.prop];
    if (!from || isDressed(from)) continue;
    const node = copyOf(from);
    const { home, ...own } = node.userData;   // keep the source's own flags (noCollide, noCameraFade…), not its home
    node.userData = { ...own, added: key, ...(e.from ? { from: e.from } : { prop: e.prop, s: e.s ?? 1 }) };
    applyEdit(node, e);   // where it was put: its home if it isn't baked
    app.add(node);
    made.push(node);
  }
  return made;
}

// Bounds of what you can see: objects carry invisible click boxes and flat see-through shadow
// sheets from the apartment app
export function visibleBox(node, box) {
  box.makeEmpty();
  const b = new THREE.Box3();
  node.updateMatrixWorld(true);
  node.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    if (m.visible === false || m.colorWrite === false || m.transparent) return;   // skip click boxes and soft shadow sheets
    box.union(b.setFromObject(o, true));
  });
  if (box.isEmpty()) box.setFromObject(node, true);
  return box;
}

// Saved edits are kept per act under one key: { 1: {...}, 2: {...} }. Anything stored before
// the split was edited in act 1 (the only act the editor could reach), so a flat map is act 1's.
function loadAllLayout() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (!d || typeof d !== 'object') return {};
    return Object.keys(d).some((k) => /^\d+$/.test(k)) ? d : { 1: d };
  } catch { return {}; }
}
// The act is never defaulted: every caller names the act it means (the game's current one),
// so an edit for one act can never be read as another's by accident.
export function loadLayout(act) { return loadAllLayout()[act] || {}; }
function saveLayout(act, data) {
  try { const all = loadAllLayout(); all[act] = data; localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private window: edits last this session */ }
}

function applyEdit(node, e) {
  if (e.p) node.position.fromArray(e.p);
  if (e.q) node.quaternion.fromArray(e.q);
  if (e.s) { node.scale.setScalar(e.s); if (node.userData.prop) node.userData.s = e.s; }
  node.visible = !(e.hidden || e.deleted);
  node.updateMatrixWorld(true);
}

const VENT = (v) => `vent:${v.name}`;
const same3 = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-4);

// Call before the vents are built (Traversal): the baked layout first (that becomes each vent's
// "home"), then your saved edits. Changes the stage's vent list in place.
export function applyVentLayout(vents, act, data = loadLayout(act)) {
  const baked = BAKED_LAYOUT[act] || {};
  let pruned = false;
  for (const v of vents) {
    if (!v.home) {
      const b = baked[VENT(v)];
      if (b) { v.at = [...b.at]; v.land = [...b.land]; }
      v.home = { at: [...v.at], land: [...v.land] };
    }
    const e = data[VENT(v)];
    if (!e) continue;
    // a saved edit that has since been baked in is no longer an edit
    if (same3(e.at, v.home.at) && same3(e.land, v.home.land)) { delete data[VENT(v)]; pruned = true; continue; }
    v.at = [...e.at]; v.land = [...e.land];
  }
  if (pruned) saveLayout(act, data);
}

// Call once after the apartment loads, before the collision world is built (and again when more
// rooms load). The baked layout (layout-baked.js) goes first and becomes each object's "home";
// your own saved edits go on top. Saved edits that now match home are dropped; your added things
// are never dropped (nothing baked to match). Returns the copies and props it made: a caller
// adding them after the collision world exists makes them solid (world.addObjects) and batched.
export async function applyLayout(root, act, data = loadLayout(act)) {
  const baked = BAKED_LAYOUT[act] || {};
  let pruned = false;
  const gone = HIDDEN_SHELL[act];
  if (gone) root.getObjectByName('Shell')?.traverse((o) => { if (gone.includes(o.name)) o.visible = false; });
  const made = await addThings(root, baked, data);
  for (const { key, node, added } of [...movables(root), ...addedThings(root)]) {
    if (!node.userData.home) {
      if (baked[key]) applyEdit(node, baked[key]);
      node.userData.home = { p: node.position.toArray(), q: node.quaternion.toArray(), v: node.visible, s: node.userData.prop ? baked[key]?.s ?? 1 : undefined };
    }
    const e = data[key];
    if (!e) continue;
    const h = node.userData.home;
    if ((!added || key in baked) && e.p && e.q && !e.deleted && e.p.every((v, i) => Math.abs(v - h.p[i]) < 1e-4) && e.q.every((v, i) => Math.abs(v - h.q[i]) < 1e-5) && !e.hidden === h.v && (e.s ?? h.s) === h.s) { delete data[key]; pruned = true; continue; }
    applyEdit(node, e);
  }
  if (pruned) saveLayout(act, data);
  return made;
}

export class LayoutEditor {
  // ctx: { root, camera, dom, world, statics, scene, onChange }
  constructor(ctx) {
    Object.assign(this, ctx);
    this.items = [...movables(this.root), ...addedThings(this.root)];
    this.byNode = new Map(this.items.map((it) => [it.node, it]));
    this.ventItems = this.traversal ? this.makeVentHandles() : [];
    for (const it of this.ventItems) this.byNode.set(it.node, it);
    this.act = ctx.act || 1;
    this.baked = BAKED_LAYOUT[this.act] || {};
    this.data = loadLayout(this.act);
    for (const it of this.items) it.deleted = !!this.data[it.key]?.deleted;
    this.undoStack = [];
    this.sel = null;
    this.target = new THREE.Vector3(2.5, 0, 2.6);
    this.yaw = 0.6;
    this.pitch = 1.0;
    this.dist = 3.2;
    this.ray = new THREE.Raycaster();
    this.ray.layers.enable(HIDDEN);   // the apartment's batched pieces (static-batch.js)
    this.keys = new Set();
    this.box = new THREE.Box3Helper(new THREE.Box3(), 0xffd23a);
    this.box.visible = false;
    this.scene.add(this.box);
    this.ui = new LayoutUi(this);
    this.el = this.ui.el;
    this.stamp = null;   // { id }: each tap on a surface drops another of this prop
    this.tpl = {};       // prop templates loaded so far
    this.bind();
  }

  // ---------------------------------------------------------------- vents
  // Two handles per vent (always drawn on top, only while the editor is open) and the jump's arc
  makeVentHandles() {
    // drawn on top of everything, last (transparent: after the vents' own glowing air columns), in true colour
    const out = [], top = (m) => { m.material.depthTest = false; m.material.toneMapped = false; m.material.transparent = true; m.renderOrder = 999; m.visible = false; this.scene.add(m); return m; };
    // dim colours: the frame is tone-mapped after the effects, which washes bright orange out to yellow
    const plateMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5a00).multiplyScalar(0.45) }), landMat = new THREE.MeshBasicMaterial({ color: 0x5ff0ff });
    this.traversal.vents.forEach((v, vi) => {
      v.home ||= { at: [...v.at], land: [...v.land] };
      const at = top(new THREE.Mesh(new THREE.CylinderGeometry(v.radius, v.radius, 0.006, 24), plateMat.clone()));
      const land = top(new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), landMat.clone()));
      at.name = `${v.name}: floor grille`;
      land.name = `${v.name}: where it throws you (${v.to})`;
      const arc = top(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 25 }, () => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: 0x5ff0ff })));
      const key = `vent:${v.name}`;
      out.push({ key, vi, end: 'at', node: at, arc }, { key, vi, end: 'land', node: land, arc });
    });
    for (const it of out) this.placeHandle(it);
    return out;
  }
  // put a vent's handle where the vent says (and redraw its arc)
  placeHandle(it) {
    const v = this.traversal.vents[it.vi];
    it.node.position.fromArray(it.end === 'at' ? v.at : v.land);
    it.node.position.y += it.end === 'at' ? 0.003 : 0.018;
    it.node.updateMatrixWorld(true);
    const a = new THREE.Vector3(...v.at), b = new THREE.Vector3(...v.land), lift = Math.max(a.y, b.y) - a.y + 0.12;
    const pos = it.arc.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { const t = i / (pos.count - 1); pos.setXYZ(i, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + 4 * lift * t * (1 - t), a.z + (b.z - a.z) * t); }
    pos.needsUpdate = true;
    it.arc.geometry.computeBoundingSphere();
    it.arc.updateMatrixWorld(true);
  }
  // the vent as its two handles now stand
  ventFromHandles(it) {
    const [a, l] = this.ventItems.filter((x) => x.vi === it.vi).map((x) => x.node.position);
    const r = (p, dy) => [+p.x.toFixed(3), +(p.y - dy).toFixed(3), +p.z.toFixed(3)];
    return { at: r(a, 0.003), land: r(l, 0.018) };
  }
  setVent(vi, e) {
    this.traversal.placeVent(vi, e.at, e.land);
    for (const x of this.ventItems) if (x.vi === vi) this.placeHandle(x);
  }
  commitVent(it, snap) {
    const v = this.traversal.vents[it.vi], e = this.ventFromHandles(it);
    if (same3(e.at, v.home.at) && same3(e.land, v.home.land)) delete this.data[it.key];
    else this.data[it.key] = e;
    this.setVent(it.vi, e);
    if (snap) this.undoStack.push(snap);
    saveLayout(this.act, this.data);
    this.onChange?.();
  }
  ventHome(vi) { const h = this.traversal.vents[vi].home; this.setVent(vi, { at: h.at, land: h.land }); }

  // the first solid, visible surface under the pointer (furniture, floor), for dropping things on.
  // exclude: a node to see through (the thing being dragged); up: only surfaces that face up (tops, not sides)
  surfaceHit(e, { exclude, up } = {}) {
    const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    const within = (o, root) => { for (; o; o = o.parent) if (o === root) return true; return false; };
    for (const h of this.pointerRay(e).intersectObject(this.root, true)) {
      const m = h.object.material;
      if (!h.object.isMesh || m.visible === false || m.colorWrite === false || m.transparent || !shown(h.object)) continue;
      if (exclude && within(h.object, exclude)) continue;
      if (up && h.face && h.face.normal.clone().transformDirection(h.object.matrixWorld).y < 0.5) continue;
      return h.point;
    }
    if (up) return null;   // nothing facing up under the pointer (looking at a wall's side): not the floor outside the room
    return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  }

  // ---------------------------------------------------------------- UI (layout-ui.js)
  refresh() {
    this.ui.refresh();
    const it = this.sel;
    if (it) { visibleBox(it.node, this.box.box); this.box.visible = true; this.box.updateMatrixWorld(true); } else this.box.visible = false;
  }

  // pick up objects that arrived since the editor was made (a later act's rooms)
  refreshItems() {
    for (const it of [...movables(this.root), ...addedThings(this.root)]) if (!this.byNode.has(it.node)) { it.deleted = !!this.data[it.key]?.deleted; this.items.push(it); this.byNode.set(it.node, it); }
  }

  open() { this.refreshItems(); this.el.hidden = false; this.active = true; this.showVents(true); this.refresh(); }
  close() { this.el.hidden = true; this.ui.dismiss(); this.active = false; this.sel = null; this.stamp = null; this.box.visible = false; this.drag = null; this.showVents(false); }
  showVents(on) { for (const it of this.ventItems) { it.node.visible = on; it.arc.visible = on; } }

  // ---------------------------------------------------------------- edits
  snapshot(it) { return { key: it.key, before: this.data[it.key] ? { ...this.data[it.key] } : null }; }
  commit(it, snap) {
    if (it.vi != null) return this.commitVent(it, snap);
    const n = it.node, h = n.userData.home, u = n.userData;
    const p = n.position.toArray().map((v) => +v.toFixed(4)), q = n.quaternion.toArray().map((v) => +v.toFixed(5));
    const same = h && !it.deleted && p.every((v, i) => Math.abs(v - h.p[i]) < 1e-4) && q.every((v, i) => Math.abs(v - h.q[i]) < 1e-5) && n.visible === h.v && u.s === h.s;
    const what = !it.added ? {} : u.from ? { from: u.from } : { prop: u.prop, s: u.s };   // an added thing's entry is the thing
    if (same && (!it.added || it.key in this.baked)) delete this.data[it.key];
    else this.data[it.key] = { ...what, p, q, ...(it.deleted ? { deleted: true } : n.visible ? {} : { hidden: true }) };
    if (snap) this.undoStack.push(snap);
    if (this.undoStack.length > 100) this.undoStack.shift();
    saveLayout(this.act, this.data);
    n.updateMatrixWorld(true);
    this.onChange?.();
  }

  center(n) { return visibleBox(n, new THREE.Box3()).getCenter(new THREE.Vector3()); }

  // rotate about the object's own middle (its pivot may be the room's corner)
  rotate(a) {
    const it = this.sel; if (!it || it.vi != null) return;
    const snap = this.snapshot(it), n = it.node;
    const c = n.parent.worldToLocal(this.center(n));
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
    n.position.sub(c).applyQuaternion(q).add(c);
    n.quaternion.premultiply(q);
    this.commit(it, snap);
  }
  raise(dy) { const it = this.sel; if (!it) return; const snap = this.snapshot(it); it.node.position.y += dy; this.commit(it, snap); }
  // a prop's size: 0.5-2x the library's, in 10% steps (about its base, so it stays on what it stands on)
  resize(d) {
    const it = this.sel, u = it?.node.userData;
    if (!u?.prop || it.deleted) return;
    const s = Math.min(2, Math.max(0.5, Math.round((u.s + d) * 10) / 10));
    if (s === u.s) return;
    const snap = this.snapshot(it);
    u.s = s; it.node.scale.setScalar(s);
    this.commit(it, snap);
  }
  // does dragging it drop it on the top of whatever is under the pointer? (added things do; furniture slides on the floor unless you ask)
  sticks(it) { return it.stick ?? !!it.added; }
  toggleStick() { const it = this.sel; if (it && it.vi == null) it.stick = !this.sticks(it); }
  toggleHide() {
    const it = this.sel; if (!it || it.vi != null) return;
    const snap = this.snapshot(it);
    if (it.deleted) { it.deleted = false; it.node.visible = true; }   // the eye brings a deleted object back
    else it.node.visible = !it.node.visible;
    this.commit(it, snap);
  }
  // delete: gone from the game (not shown, not solid) and recorded as deleted in the export,
  // so the bake drops it for good; it stays in the list, and ⌂ or 👁 brings it back
  deleteSelected() {
    const it = this.sel; if (!it || it.vi != null || it.deleted) return;
    const snap = this.snapshot(it);
    if (this.isNew(it)) { snap.node = it.node; this.drop(it); this.undoStack.push(snap); saveLayout(this.act, this.data); this.onChange?.(); return; }
    it.deleted = true; it.node.visible = false;
    this.commit(it, snap);
  }

  // ---------------------------------------------------------------- added things
  isNew(it) { return it.added && !(it.key in this.baked); }   // added here, not baked in
  // a new one leaves for good: its entry goes and it leaves the room (hidden, the collision world
  // and the batches skip it; undo puts the same one back)
  drop(it) {
    delete this.data[it.key];
    it.node.visible = false;
    it.node.removeFromParent();
    this.items.splice(this.items.indexOf(it), 1);
    this.byNode.delete(it.node);
    if (this.sel === it) this.sel = null;
  }
  // things applyLayout just made, made part of the room: solid, drawn in the batches, listed
  place(nodes) {
    for (const node of nodes) { node.updateMatrixWorld(true); this.world.addObjects([node]); this.statics?.add(node); }
    this.refreshItems();
  }
  freeKey(base) {
    const taken = (k) => k in this.data || k in this.baked || this.items.some((x) => x.key === k);
    let n = 1;
    while (taken(`${base}#${n}`)) n++;
    return `${base}#${n}`;
  }
  // a new thing (positioned already) made part of the room: solid, batched, saved, selected
  addNew(node, key, what) {
    const { home, ...own } = node.userData;
    node.userData = { ...own, added: key, ...what };
    node.visible = true;
    (this.root.getObjectByName('Apartment') || this.root).add(node);
    node.userData.home = { p: node.position.toArray(), q: node.quaternion.toArray(), v: true, s: what.s };
    this.place([node]);
    this.sel = this.byNode.get(node);
    this.commit(this.sel, { key, before: null });
  }
  // a copy of the selected object (or prop) 10 cm aside along the room, selected
  // (not of a dressed piece: isDressed)
  canCopy(it) { return it.vi == null && !it.deleted && !isDressed(it.node); }
  duplicate() {
    const it = this.sel; if (!it || !this.canCopy(it)) return;
    const u = it.node.userData, from = it.added ? u.from : it.key, node = copyOf(it.node);
    node.position.add(new THREE.Vector3(0.1, 0, 0).applyMatrix3(new THREE.Matrix3().setFromMatrix4(it.node.parent.matrixWorld).invert()));
    this.addNew(node, this.freeKey(from ? `copy:${from}` : `prop:${u.prop}`), from ? { from } : { prop: u.prop, s: u.s });
  }
  // Add: a library prop in the middle of the view, then every tap on a surface stamps another (until endStamp)
  async addProp(id) {
    this.tpl[id] ||= (await loadProps([id]))[id];
    if (!this.active) return;   // closed while it downloaded
    const r = this.dom.getBoundingClientRect();
    this.stamp = { id };
    this.stampAt({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
  }
  stampAt(e) {
    const { id } = this.stamp, app = this.root.getObjectByName('Apartment') || this.root, at = this.surfaceHit(e, { up: true });
    if (!at) return;   // looking along the floor: nothing to drop it on
    const node = copyOf(this.tpl[id]);
    node.position.copy(app.worldToLocal(at));
    node.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.items.length * 2.4);   // each a different way round
    this.addNew(node, this.freeKey(`prop:${id}`), { prop: id, s: 1 });
  }
  endStamp() { const was = !!this.stamp; this.stamp = null; return was; }
  // the home state back: where it was baked or loaded, shown, its own size
  toHome(it) {
    const h = it.node.userData.home, n = it.node;
    if (!h) return;
    it.deleted = false;
    n.position.fromArray(h.p); n.quaternion.fromArray(h.q); n.visible = h.v;
    if (h.s) { n.userData.s = h.s; n.scale.setScalar(h.s); }
    n.updateMatrixWorld(true);
  }
  putBack() {
    const it = this.sel; if (!it) return;
    if (it.vi != null) { const snap = this.snapshot(it); this.ventHome(it.vi); this.commitVent(it, snap); return; }
    const snap = this.snapshot(it);
    this.toHome(it);
    this.commit(it, snap);
  }
  undo() {
    const u = this.undoStack.pop(); if (!u) return;
    const vent = this.ventItems.find((x) => x.key === u.key);
    if (vent) {
      if (u.before) this.setVent(vent.vi, u.before); else this.ventHome(vent.vi);
      this.commitVent(vent, null);
      this.sel = vent;
      return;
    }
    if (u.node && !this.byNode.has(u.node)) { (this.root.getObjectByName('Apartment') || this.root).add(u.node); this.refreshItems(); }   // a new thing deleted: the same one back
    const it = this.items.find((x) => x.key === u.key);
    if (!it) return;
    if (this.isNew(it) && !u.before) { this.drop(it); saveLayout(this.act, this.data); this.onChange?.(); return; }   // undo a duplicate
    if (u.before) applyEdit(it.node, u.before);
    else this.toHome(it);
    it.deleted = !!u.before?.deleted;
    this.commit(it, null);
    this.sel = it;
  }
  resetAll() {
    for (const it of [...this.items]) { if (this.isNew(it)) this.drop(it); else this.toHome(it); }
    this.traversal?.vents.forEach((v, vi) => this.ventHome(vi));
    this.data = {}; this.undoStack = []; saveLayout(this.act, this.data); this.onChange?.();
  }

  // this act's edits as the code to paste to Claude (and back in with loadCode)
  exportCode() { return JSON.stringify({ act: this.act, edits: this.data }, null, 1); }
  // replaces this act's edits with a pasted code; returns a note when it went elsewhere, throws when it isn't a code
  async loadCode(text) {
    const d = JSON.parse(text);
    if (!d || typeof d !== 'object' || Array.isArray(d) || (d.edits !== undefined && (!d.edits || typeof d.edits !== 'object' || Array.isArray(d.edits)))) throw new TypeError('not a layout code');
    const wrapped = d && Number.isInteger(d.act) && d.edits && typeof d.edits === 'object';
    const edits = wrapped ? d.edits : d;   // codes from before the wrapper are the bare edits, for this act
    if (wrapped && d.act !== this.act) { saveLayout(d.act, edits); return `Saved under Act ${d.act}: switch acts to see it`; }
    for (const it of [...this.items]) { if (this.isNew(it)) this.drop(it); else this.toHome(it); }
    this.data = edits; this.undoStack = []; saveLayout(this.act, edits); this.place(await applyLayout(this.root, this.act, edits));
    for (const it of this.items) it.deleted = !!this.data[it.key]?.deleted;
    this.traversal?.vents.forEach((v, vi) => { const e = edits[`vent:${v.name}`]; if (e) this.setVent(vi, e); else this.ventHome(vi); });
    this.onChange?.(); this.refresh();
    return null;
  }
  showIo() { this.ui.showIo(); }

  // ---------------------------------------------------------------- input
  pointerRay(e) {
    const r = this.dom.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    return this.ray;
  }
  pick(e) {
    // vent handles first: they're small and drawn on top of everything
    if (this.ventItems.length) {
      const h = this.pointerRay(e).intersectObjects(this.ventItems.map((it) => it.node), false)[0];
      if (h) return { it: this.byNode.get(h.object), point: h.point };
    }
    const hits = this.pointerRay(e).intersectObjects(this.items.map((it) => it.node), true);
    for (const h of hits) {
      let o = h.object;
      if (!o.visible) continue;
      while (o && !this.byNode.has(o)) o = o.parent;
      if (o) return { it: this.byNode.get(o), point: h.point };
    }
    return null;
  }

  bind() {
    const d = this.dom, pts = new Map();
    d.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { this.drag = null; this.pinch = this.pinchDist(pts); return; }
      if (e.button === 2) { this.drag = { view: true, x: e.clientX, y: e.clientY }; return; }
      const got = this.pick(e);
      if (got && got.it === this.sel) {
        // grab the selected object: move it on the horizontal plane through the grab point
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -got.point.y), n = got.it.node;
        this.drag = { move: true, plane, last: got.point.clone(), snap: this.snapshot(got.it), moved: false, surface: got.it.vi != null };
        if (!this.drag.surface && this.sticks(got.it)) {
          // it keeps its grip on where you took hold, and its base rides on the surface under the pointer
          const at = n.getWorldPosition(new THREE.Vector3());
          this.drag.stick = { dx: at.x - got.point.x, dz: at.z - got.point.z, dy: at.y - visibleBox(n, new THREE.Box3()).min.y };
        }
      } else this.drag = { pan: true, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, picked: got?.it || null };
      d.setPointerCapture?.(e.pointerId);
    });
    d.addEventListener('pointermove', (e) => {
      if (!this.active || !pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && this.pinch) { const nd = this.pinchDist(pts); this.dist = THREE.MathUtils.clamp(this.dist * this.pinch / nd, 0.3, 7); this.pinch = nd; return; }
      const g = this.drag; if (!g) return;
      if (g.move && g.surface) {
        // a vent handle: stick to whatever is under the pointer
        const p = this.surfaceHit(e);
        if (!p) return;
        const it = this.sel;
        it.node.position.copy(p).y += it.end === 'at' ? 0.003 : 0.018;
        it.node.updateMatrixWorld(true);
        this.setVent(it.vi, this.ventFromHandles(it));
        g.moved = true;
        this.refresh();
      } else if (g.move && g.stick) {
        const n = this.sel.node, p = this.surfaceHit(e, { exclude: n, up: true });
        if (!p) return;
        n.position.copy(n.parent.worldToLocal(new THREE.Vector3(p.x + g.stick.dx, p.y + g.stick.dy, p.z + g.stick.dz)));
        n.updateMatrixWorld(true);
        g.moved = true;
        this.refresh();
      } else if (g.move) {
        const p = this.pointerRay(e).ray.intersectPlane(g.plane, new THREE.Vector3());
        if (!p) return;
        const delta = p.clone().sub(g.last);
        g.last.copy(p);
        const n = this.sel.node;
        n.position.add(delta.applyMatrix3(new THREE.Matrix3().setFromMatrix4(n.parent.matrixWorld).invert()));   // world move -> parent space
        n.updateMatrixWorld(true);
        g.moved = true;
        this.refresh();
      } else if (g.view) {
        this.yaw -= (e.clientX - g.x) * 0.006;
        this.pitch = THREE.MathUtils.clamp(this.pitch + (e.clientY - g.y) * 0.005, 0.25, 1.5);
        g.x = e.clientX; g.y = e.clientY;
      } else if (g.pan) {
        const k = this.dist * 0.0016, dx = e.clientX - g.x, dy = e.clientY - g.y;
        const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        this.target.addScaledVector(r, -dx * k).addScaledVector(f, dy * k);
        g.x = e.clientX; g.y = e.clientY;
      }
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (!this.active) return;
      if (pts.size < 2) this.pinch = null;
      const g = this.drag; this.drag = null;
      if (!g) return;
      if (g.move && g.moved) this.commit(this.sel, g.snap);
      // a tap (not a pan): stamping drops another on the surface (a tap on something you added selects it instead); else select what was under it, or deselect
      if (g.pan && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 6) { if (e.type === 'pointercancel') { /* the browser took the touch: not a tap */ } else if (this.stamp && !g.picked?.added) this.stampAt(e); else this.sel = g.picked; }
      this.refresh();
    };
    d.addEventListener('pointerup', up);
    d.addEventListener('pointercancel', up);
    d.addEventListener('contextmenu', (e) => { if (this.active) e.preventDefault(); });
    d.addEventListener('wheel', (e) => { if (this.active) this.dist = THREE.MathUtils.clamp(this.dist * (1 + Math.sign(e.deltaY) * 0.1), 0.3, 7); }, { passive: true });
    addEventListener('keydown', (e) => {
      if (!this.active || (e.code !== 'Escape' && (this.ui.open || e.target.closest?.('textarea, input, select')))) return;   // (a sheet or the list has the keys; Esc still closes)
      if (!e.ctrlKey && !e.metaKey) this.keys.add(e.code);   // Ctrl+D duplicates, it doesn't pan
      const big = e.shiftKey;
      if (e.code === 'KeyQ') this.rotate(big ? Math.PI / 2 : Math.PI / 12);
      else if (e.code === 'KeyE') this.rotate(big ? -Math.PI / 2 : -Math.PI / 12);
      else if (e.code === 'KeyR') this.raise(big ? 0.05 : 0.01);
      else if (e.code === 'KeyF') this.raise(big ? -0.05 : -0.01);
      else if (e.code === 'KeyH') this.toggleHide();
      else if (e.code === 'Delete' || e.code === 'Backspace') this.deleteSelected();
      else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) this.undo();
      else if (e.code === 'KeyD' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.duplicate(); }
      else if (e.code === 'Escape') { if (!this.ui.dismiss() && !this.endStamp()) this.onDone?.(); }   // a sheet first, then stamping, then done
      else return;
      this.refresh();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
  }
  pinchDist(pts) { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; }

  // ---------------------------------------------------------------- camera
  update(dt) {
    const k = this.keys, sp = this.dist * 0.8 * dt;
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    if (k.has('KeyW') || k.has('ArrowUp')) this.target.addScaledVector(f, sp);
    if (k.has('KeyS') || k.has('ArrowDown')) this.target.addScaledVector(f, -sp);
    if (k.has('KeyA') || k.has('ArrowLeft')) this.target.addScaledVector(r, -sp);
    if (k.has('KeyD') || k.has('ArrowRight')) this.target.addScaledVector(r, sp);
    const cp = Math.cos(this.pitch);
    this.camera.position.set(this.target.x + Math.sin(this.yaw) * cp * this.dist, this.target.y + Math.sin(this.pitch) * this.dist, this.target.z + Math.cos(this.yaw) * cp * this.dist);
    this.camera.lookAt(this.target);
    if (this.sel) { visibleBox(this.sel.node, this.box.box); this.box.updateMatrixWorld(true); }   // the game turns off automatic matrix updates
  }
}
