// Dev tool: move, rotate, raise/lower and hide the apartment's furniture and objects.
//
// Edits are saved in this browser (localStorage) and applied every time the game loads, before
// collisions are built, so a moved sofa is solid where you put it. "Export" gives a JSON code
// to paste back to Claude so the layout can be baked in for everyone.
//
// Desktop: click an object to select it, drag it to move it along the floor, WASD/arrows pan,
// wheel zooms, right-drag turns the view. Q/E rotate 15° (hold Shift for 90°), R/F raise/lower
// 1 cm (Shift: 5 cm), H hide, Ctrl+Z undo, Esc done.
// Touch: tap to select, drag it to move; drag empty space to pan; pinch to zoom; the toolbar
// does the rest.
//
// Stage markers (vents, Moon Drop spots, elites, gift boxes) don't follow moved furniture yet.
import * as THREE from 'three';

const KEY = 'jf-layout-v1';
const SKIP = /^(Shell|door-|Hall_lights|LED_cove|Kitchen_lights|Closet$)/;   // walls, doors and lights stay put

// Every movable object: the Apartment node's named children, keyed "name#n" (names can repeat)
function movables(root) {
  const app = root.getObjectByName('Apartment') || root;
  const seen = {}, out = [];
  for (const o of app.children) {
    const n = seen[o.name] = (seen[o.name] || 0) + 1;
    if (!o.name || SKIP.test(o.name)) continue;
    out.push({ key: `${o.name}#${n}`, node: o });
  }
  return out;
}

// Bounds of what you can see: objects carry invisible click boxes and flat see-through shadow
// sheets from the apartment app
function visibleBox(node, box) {
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

export function loadLayout() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function saveLayout(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private window: edits last this session */ }
}

function applyEdit(node, e) {
  if (e.p) node.position.fromArray(e.p);
  if (e.q) node.quaternion.fromArray(e.q);
  node.visible = !e.hidden;
  node.updateMatrixWorld(true);
}

// Call once after the apartment loads, before the collision world is built
export function applyLayout(root, data = loadLayout()) {
  let n = 0;
  for (const { key, node } of movables(root)) {
    node.userData.home ||= { p: node.position.toArray(), q: node.quaternion.toArray(), v: node.visible };
    if (data[key]) { applyEdit(node, data[key]); n++; }
  }
  return n;
}

export class LayoutEditor {
  // ctx: { root, camera, dom, world, scene, onChange }
  constructor(ctx) {
    Object.assign(this, ctx);
    this.items = movables(this.root);
    this.byNode = new Map(this.items.map((it) => [it.node, it]));
    this.data = loadLayout();
    this.undoStack = [];
    this.sel = null;
    this.target = new THREE.Vector3(2.5, 0, 2.6);
    this.yaw = 0.6;
    this.pitch = 1.0;
    this.dist = 3.2;
    this.ray = new THREE.Raycaster();
    this.keys = new Set();
    this.box = new THREE.Box3Helper(new THREE.Box3(), 0xffd23a);
    this.box.visible = false;
    this.scene.add(this.box);
    this.buildUi();
    this.bind();
  }

  // ---------------------------------------------------------------- UI
  buildUi() {
    const el = this.el = document.createElement('div');
    el.className = 'jf-keep';
    el.hidden = true;
    el.innerHTML = `<style>
      #jf-layout { position: fixed; inset: auto 0 0 0; z-index: 30; display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; padding: 8px;
        background: linear-gradient(transparent, #0d1020dd 30%); font: 600 13px system-ui, sans-serif; color: #fff; pointer-events: none; }
      #jf-layout > * { pointer-events: auto; }
      #jf-layout button { background: #2a2f4a; color: #fff; border: 1px solid #ffffff33; border-radius: 10px; padding: 9px 12px; font: inherit; min-width: 44px; }
      #jf-layout button:disabled { opacity: .35; }
      #jf-layout button.go { background: #3a8a5a; }
      #jf-layout .name { flex-basis: 100%; text-align: center; font-size: 14px; text-shadow: 0 1px 3px #000; }
      #jf-layout-top { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); z-index: 30; background: #0d1020cc; color: #ffd23a; padding: 6px 12px;
        border-radius: 10px; font: 600 12px system-ui, sans-serif; text-align: center; pointer-events: none; max-width: 90vw; }
      #jf-layout-io { position: fixed; inset: 10% 8%; z-index: 31; background: #1a1d30; border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 8px; color: #fff; font: 13px system-ui, sans-serif; }
      #jf-layout-io textarea { flex: 1; font: 12px ui-monospace, monospace; background: #0d1020; color: #9fe2ff; border: 1px solid #ffffff33; border-radius: 8px; padding: 8px; }
      #jf-layout-io div { display: flex; gap: 8px; justify-content: flex-end; }
      #jf-layout-io button { background: #2a2f4a; color: #fff; border: 1px solid #ffffff33; border-radius: 10px; padding: 9px 14px; font: 600 13px system-ui, sans-serif; }
    </style>
    <div id="jf-layout-top">🛠 Layout editor (dev) · tap an object to select, drag it to move${matchMedia('(pointer: coarse)').matches ? '' : ' · WASD pan · wheel zoom · right-drag turn · Q/E rotate · R/F up/down · H hide · Ctrl+Z undo'}</div>
    <div id="jf-layout">
      <div class="name">Nothing selected</div>
      <button data-a="rotL" title="Rotate left 15° (Q)">⟲</button><button data-a="rotR" title="Rotate right 15° (E)">⟳</button>
      <button data-a="up" title="Raise 1 cm (R)">⬆</button><button data-a="down" title="Lower 1 cm (F)">⬇</button>
      <button data-a="hide" title="Hide / show (H)">👁</button><button data-a="home" title="Put this one back">⌂</button>
      <button data-a="undo" title="Undo (Ctrl+Z)">↶</button>
      <button data-a="viewL" title="Turn view">◀</button><button data-a="viewR" title="Turn view">▶</button>
      <button data-a="io">⇄ Export</button><button data-a="reset">Reset all</button><button data-a="done" class="go">Done</button>
    </div>`;
    document.body.appendChild(el);
    this.nameEl = el.querySelector('.name');
    el.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (!a) return;
      ({
        rotL: () => this.rotate(Math.PI / 12), rotR: () => this.rotate(-Math.PI / 12),
        up: () => this.raise(0.01), down: () => this.raise(-0.01),
        hide: () => this.toggleHide(), home: () => this.putBack(), undo: () => this.undo(),
        viewL: () => { this.yaw += Math.PI / 8; }, viewR: () => { this.yaw -= Math.PI / 8; },
        io: () => this.showIo(), reset: () => this.resetAll(), done: () => this.onDone?.(),
      })[a]?.();
      this.refresh();
    });
  }

  refresh() {
    const it = this.sel;
    this.nameEl.textContent = it ? `${it.node.name.replace(/_/g, ' ')}${it.node.visible ? '' : ' (hidden)'}${this.data[it.key] ? ' · edited' : ''}` : `Nothing selected · ${Object.keys(this.data).length} edited`;
    this.el.querySelectorAll('[data-a=rotL],[data-a=rotR],[data-a=up],[data-a=down],[data-a=hide],[data-a=home]').forEach((b) => { b.disabled = !it; });
    this.el.querySelector('[data-a=undo]').disabled = !this.undoStack.length;
    if (it) { visibleBox(it.node, this.box.box); this.box.visible = true; this.box.updateMatrixWorld(true); } else this.box.visible = false;
  }

  open() { this.el.hidden = false; this.active = true; this.refresh(); }
  close() { this.el.hidden = true; this.active = false; this.sel = null; this.box.visible = false; this.drag = null; }

  // ---------------------------------------------------------------- edits
  snapshot(it) { return { key: it.key, before: this.data[it.key] ? { ...this.data[it.key] } : null }; }
  commit(it, snap) {
    const n = it.node, h = n.userData.home;
    const p = n.position.toArray().map((v) => +v.toFixed(4)), q = n.quaternion.toArray().map((v) => +v.toFixed(5));
    const same = h && p.every((v, i) => Math.abs(v - h.p[i]) < 1e-4) && q.every((v, i) => Math.abs(v - h.q[i]) < 1e-5) && n.visible === h.v;
    if (same) delete this.data[it.key];
    else this.data[it.key] = { p, q, ...(n.visible ? {} : { hidden: true }) };
    if (snap) this.undoStack.push(snap);
    if (this.undoStack.length > 100) this.undoStack.shift();
    saveLayout(this.data);
    n.updateMatrixWorld(true);
    this.onChange?.();
  }

  center(n) { return visibleBox(n, new THREE.Box3()).getCenter(new THREE.Vector3()); }

  // rotate about the object's own middle (its pivot may be the room's corner)
  rotate(a) {
    const it = this.sel; if (!it) return;
    const snap = this.snapshot(it), n = it.node;
    const c = n.parent.worldToLocal(this.center(n));
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
    n.position.sub(c).applyQuaternion(q).add(c);
    n.quaternion.premultiply(q);
    this.commit(it, snap);
  }
  raise(dy) { const it = this.sel; if (!it) return; const snap = this.snapshot(it); it.node.position.y += dy; this.commit(it, snap); }
  toggleHide() { const it = this.sel; if (!it) return; const snap = this.snapshot(it); it.node.visible = !it.node.visible; this.commit(it, snap); }
  putBack() {
    const it = this.sel; if (!it) return;
    const snap = this.snapshot(it), h = it.node.userData.home;
    it.node.position.fromArray(h.p); it.node.quaternion.fromArray(h.q); it.node.visible = h.v;
    this.commit(it, snap);
  }
  undo() {
    const u = this.undoStack.pop(); if (!u) return;
    const it = this.items.find((x) => x.key === u.key), h = it.node.userData.home;
    if (u.before) applyEdit(it.node, u.before);
    else { it.node.position.fromArray(h.p); it.node.quaternion.fromArray(h.q); it.node.visible = h.v; }
    this.commit(it, null);
    this.sel = it;
  }
  resetAll() {
    if (!confirm('Put every object back where it started?')) return;
    for (const it of this.items) { const h = it.node.userData.home; if (!h) continue; it.node.position.fromArray(h.p); it.node.quaternion.fromArray(h.q); it.node.visible = h.v; it.node.updateMatrixWorld(true); }
    this.data = {}; this.undoStack = []; saveLayout(this.data); this.onChange?.();
  }

  showIo() {
    const box = document.createElement('div');
    box.id = 'jf-layout-io';
    box.className = 'jf-keep';
    box.innerHTML = `<b>Layout code</b><span>Copy this and paste it to Claude to bake the layout in. Or paste a code here and press Load.</span>
      <textarea spellcheck="false"></textarea><div><button data-a="copy">Copy</button><button data-a="load">Load</button><button data-a="close">Close</button></div>`;
    const ta = box.querySelector('textarea');
    ta.value = JSON.stringify(this.data, null, 1);
    box.addEventListener('click', async (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'copy') { ta.select(); try { await navigator.clipboard.writeText(ta.value); e.target.textContent = 'Copied!'; } catch { document.execCommand?.('copy'); e.target.textContent = 'Selected: copy it'; } }
      if (a === 'load') {
        try {
          const d = JSON.parse(ta.value);
          for (const it of this.items) { const h = it.node.userData.home; it.node.position.fromArray(h.p); it.node.quaternion.fromArray(h.q); it.node.visible = h.v; }
          this.data = d; saveLayout(d); applyLayout(this.root, d); this.onChange?.(); this.refresh(); box.remove();
        } catch (err) { e.target.textContent = 'Not valid JSON'; }
      }
      if (a === 'close') box.remove();
    });
    document.body.appendChild(box);
  }

  // ---------------------------------------------------------------- input
  pointerRay(e) {
    const r = this.dom.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    return this.ray;
  }
  pick(e) {
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
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -got.point.y);
        this.drag = { move: true, plane, last: got.point.clone(), snap: this.snapshot(got.it), moved: false };
      } else this.drag = { pan: true, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, picked: got?.it || null };
      d.setPointerCapture?.(e.pointerId);
    });
    d.addEventListener('pointermove', (e) => {
      if (!this.active || !pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && this.pinch) { const nd = this.pinchDist(pts); this.dist = THREE.MathUtils.clamp(this.dist * this.pinch / nd, 0.3, 7); this.pinch = nd; return; }
      const g = this.drag; if (!g) return;
      if (g.move) {
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
      if (!this.active) return;
      pts.delete(e.pointerId);
      if (pts.size < 2) this.pinch = null;
      const g = this.drag; this.drag = null;
      if (!g) return;
      if (g.move && g.moved) this.commit(this.sel, g.snap);
      // a tap (not a pan): select what was under it, or deselect
      if (g.pan && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 6) this.sel = g.picked;
      this.refresh();
    };
    d.addEventListener('pointerup', up);
    d.addEventListener('pointercancel', up);
    d.addEventListener('contextmenu', (e) => { if (this.active) e.preventDefault(); });
    d.addEventListener('wheel', (e) => { if (this.active) this.dist = THREE.MathUtils.clamp(this.dist * (1 + Math.sign(e.deltaY) * 0.1), 0.3, 7); }, { passive: true });
    addEventListener('keydown', (e) => {
      if (!this.active || e.target.closest?.('textarea, input')) return;
      this.keys.add(e.code);
      const big = e.shiftKey;
      if (e.code === 'KeyQ') this.rotate(big ? Math.PI / 2 : Math.PI / 12);
      else if (e.code === 'KeyE') this.rotate(big ? -Math.PI / 2 : -Math.PI / 12);
      else if (e.code === 'KeyR') this.raise(big ? 0.05 : 0.01);
      else if (e.code === 'KeyF') this.raise(big ? -0.05 : -0.01);
      else if (e.code === 'KeyH') this.toggleHide();
      else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) this.undo();
      else if (e.code === 'Escape') this.onDone?.();
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
