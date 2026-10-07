// Phones shade every lit pixel once per light in the scene, and the apartment has 15+ lamps, so on
// a phone most of a frame goes on lamps lighting walls you can't see from where the jelly is.
// LightSlots keeps a fixed number of point lights (look.css --phone-lights) and, every frame, hands
// them to the lamps that matter most around the jelly; the other lamps are hidden (a hidden light
// costs nothing). Lamps fade in and out of their slots so nothing pops.
//
// The number of lights never changes, so no shader is ever rebuilt mid-game (three.js builds one
// program per light count, and rebuilding them stalls a phone). The lamps stay in the scene,
// hidden, so they keep their real positions (the layout editor moves them with furniture) and
// anything that dims or recolours a lamp still works: the slot copies it every frame.
import * as THREE from 'three';

const _p = new THREE.Vector3();

export class LightSlots {
  // scene: where the lamps are (apartment.js marks them userData.lamp); count: slots
  constructor(scene, count, { fade = 0.5, reach = 1.5 } = {}) {
    Object.assign(this, { scene, count, fade, reach });
    this.lamps = [];                    // { light, w, slot }
    this.slots = [];
    for (let i = 0; i < count; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 1, 2);
      light.name = 'light-slot-' + i;
      light.userData.slot = true;
      scene.add(light);
      this.slots.push({ light, lamp: null });
    }
    this.last = new THREE.Vector3(Infinity, 0, 0);
    this.rescan();
  }

  // pick up lamps added since (an act's rooms loading: main.js loadRooms)
  rescan() {
    const known = new Set(this.lamps.map((l) => l.light));
    this.scene.traverse((o) => {
      if (!o.isPointLight || !o.userData.lamp || known.has(o)) return;
      o.visible = false;
      this.lamps.push({ light: o, w: 0, slot: null, score: 0 });
    });
  }

  // how much a lamp lights the space around the jelly: its legacy falloff, reaching a little past
  // its cutoff so lamps lighting the walls in view still count
  score(lamp, focus) {
    const L = lamp.light;
    if (!(L.intensity > 0)) return 0;
    const d = L.getWorldPosition(_p).distanceTo(focus);
    if (!(L.distance > 0)) return L.intensity / (1 + d * d);
    const f = 1 - d / (L.distance + this.reach);
    return f > 0 ? L.intensity * Math.pow(f, L.decay || 1) : 0;
  }

  // focus: the point to light (the jelly). A big jump (a teleport, a new run) snaps instead of fading.
  update(dt, focus) {
    const snap = this.last.distanceToSquared(focus) > 1;
    this.last.copy(focus);
    for (const l of this.lamps) l.score = this.score(l, focus);
    const want = this.lamps.filter((l) => l.score > 0).sort((a, b) => b.score - a.score).slice(0, this.count);
    const wanted = new Set(want);
    const rate = snap ? Infinity : dt / this.fade;
    if (snap) for (const s of this.slots) if (s.lamp && !wanted.has(s.lamp)) { s.lamp.w = 0; s.lamp.slot = null; s.lamp = null; }
    for (const l of want) {
      if (l.slot) continue;
      const free = this.slots.find((s) => !s.lamp);
      if (!free) continue;                 // every slot is still fading a lamp out: wait a moment
      free.lamp = l; l.slot = free; l.w = snap ? 1 : 0;
    }
    for (const s of this.slots) {
      const l = s.lamp, out = s.light;
      if (!l) { out.intensity = 0; continue; }
      l.w = wanted.has(l) ? Math.min(1, l.w + rate) : Math.max(0, l.w - rate);
      if (l.w <= 0 && !wanted.has(l)) { l.slot = null; s.lamp = null; out.intensity = 0; continue; }
      const L = l.light;
      L.getWorldPosition(out.position);
      out.color.copy(L.color);
      out.distance = L.distance; out.decay = L.decay;
      out.intensity = L.intensity * l.w;
    }
  }

  // which lamps are lit now (stories, the F3 readout)
  lit() { return this.slots.filter((s) => s.lamp && s.light.intensity > 0).map((s) => s.lamp.light); }

  // back to every lamp lit by itself (stories)
  dispose() {
    for (const s of this.slots) this.scene.remove(s.light);
    for (const l of this.lamps) l.light.visible = true;
    this.slots = []; this.lamps = [];
  }
}
