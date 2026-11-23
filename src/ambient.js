// Ambient life: what moves in the room by itself. Plants lean a few millimetres and their leaves
// flutter; glassware shivers when something big lands near it. All of it is a few lines in the
// apartment's one shared shader patch (baked-ao.js), so it adds no draw, no light, no shader
// program and uploads nothing but these uniforms each frame.
//
//  - One clock (ambientTime) and four gusts (ambientGust: xyz where, w how hard, 0..1), shared by
//    every piece. Gust 0 is the jelly's own wake (how fast it moves); 1-3 are the last big hits
//    landing (fx.impact's 'impact' event). A piece fades a gust by distance (--ambient-reach).
//  - Which pieces move is plain data below (SWAY, RATTLE), by piece name. Act 4 is act 1's room, so
//    it gets the same list. mark() gives their meshes an `ambient` attribute (x: how far up the
//    plant, 0 at the pot; y: a glass's own phase), and zeros to every other mesh that shares one of
//    their materials, so the furniture batches group exactly as before.
//  - Rest pose is today's: with the switch off (Reduce effects, ?ambient=0) every vertex is where
//    the model has it. Numbers are --ambient-* in content/look.css.
//  - Cloth (the shower curtain, the sheer curtains, the roller shades) is pinned where it hangs from and ripples more toward its
//    hem: a slow wave runs across it, and a gust billows it away from where it came from. Its attribute is y < 0: minus how far
//    down the cloth the vertex hangs (0 at the rail, 1 at the hem).
// Later ambient tasks (floor light, status lights, smoke) hang off this same clock and gusts.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { bus } from './events.js';
import { EXPERIMENTS } from './experiments.js';

// pieces by name (a copy's _2 / .001 suffix is ignored), and the layout editor's props by id
export const SWAY = ['Aloe', 'Monstera', 'Pilea', 'Pothos', 'Pothos_planter', 'Rubber_plant', 'Snake_plant', 'Tall_snake_plant',
  'aloe', 'monstera', 'pothos', 'rubberPlant', 'snakePlant', 'spiderPlant', 'marbleSnake', 'stripedSnake'];
// glassware only: the Mug and the Kettle are Elites, so nothing shaped like them moves on its own
export const RATTLE = ['Glass_cup', 'Juice_glass', 'Cut-crystal_glass', 'Short_tumbler', 'Shot_glasses', 'Tumblers', 'Mason_jar',
  'Glass_mug', 'Crystal_pitcher', 'Carafe', 'Water_filter_pitcher', 'Glass_teapot'];
// cloth: hung from the top, moving more toward the hem (the roller shade's meshes are a tube, a rail and the sheet: only the sheet and rail swing)
export const CLOTH = ['Shower_curtain', 'Sheer_curtain', 'Roller_shade'];
const base = (name) => name.replace(/(\.\d+|_\d+)+$/, '');
export const kindOf = (name) => (SWAY.includes(base(name)) ? 'sway' : RATTLE.includes(base(name)) ? 'rattle' : CLOTH.includes(base(name)) ? 'cloth' : null);

const uniforms = {
  ambientOn: { value: 0 },        // 0 holds everything still
  ambientTime: { value: 0 },
  ambientGust: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
  ambientReach: { value: 0.3 },
  ambientSway: { value: new THREE.Vector4() },     // idle lean, idle flutter, gust push, gust flutter (m at a plant's tip)
  ambientRattle: { value: new THREE.Vector2() },   // m, rad/s
  ambientCloth: { value: new THREE.Vector3() },    // idle ripple (m at the hem), gust billow (m at the hem), ripple rate (rad/s)
};
export const AMBIENT = { uniforms };

// (the vertex half of baked-ao.js's patch: a world-space offset for this vertex)
export const AMBIENT_VERTEX = /* glsl */`
  attribute vec2 ambient;
  uniform float ambientOn, ambientTime, ambientReach;
  uniform vec4 ambientGust[4], ambientSway;
  uniform vec2 ambientRattle;
  uniform vec3 ambientCloth;
  vec3 ambientOffset(vec3 p, vec3 n) {
    if (ambientOn <= 0.0 || (ambient.x == 0.0 && ambient.y == 0.0)) return vec3(0.0);
    float t = ambientTime, g = 0.0;
    vec3 push = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      vec3 d = p - ambientGust[i].xyz;
      d.y = 0.0;
      float k = ambientGust[i].w * smoothstep(ambientReach, 0.0, length(d));
      push += d / (length(d) + 0.01) * k;
      g += k;
    }
    g = min(g, 1.0);
    vec3 off = vec3(0.0);
    if (ambient.y < 0.0) {   // cloth: out of its own plane (its normal, level), the hem most
      float w = ambient.y * ambient.y, side = dot(p.xz, vec2(0.7, 0.9));
      vec3 face = vec3(n.x, 0.0, n.z);
      face = length(face) > 0.2 ? normalize(face) : vec3(0.0, 0.0, 1.0);
      float ripple = sin(t * ambientCloth.z - p.y * 2.6 + side * 3.1) + 0.5 * sin(t * ambientCloth.z * 1.7 + p.y * 1.3 - side * 5.3);
      off += face * (w * ambientCloth.x * ripple);
      float away = 0.0;   // which side of the cloth the gust is on: it billows to the other
      for (int i = 0; i < 4; i++) {
        vec3 d = p - ambientGust[i].xyz;
        d.y = 0.0;
        float k = ambientGust[i].w * smoothstep(ambientReach, 0.0, length(d));
        away += k * (dot(d, face) >= 0.0 ? 1.0 : -1.0);
      }
      off += face * (w * ambientCloth.y * away * (0.8 + 0.2 * sin(t * ambientCloth.z * 3.0 + side * 4.0)));
      return off;
    }
    if (ambient.x > 0.0) {
      float w = ambient.x * ambient.x, ph = dot(p.xz, vec2(1.7, 2.3));   // the tips bend most; neighbours out of step
      off.xz += vec2(sin(t * 0.9 + ph) + 0.4 * sin(t * 2.3 + ph * 1.7), cos(t * 0.7 + ph * 1.3)) * (w * ambientSway.x);
      float fl = sin(t * 7.0 + dot(p, vec3(31.0, 17.0, 23.0)));   // each leaf edge on its own beat
      off += vec3(fl, 0.5 * fl, -fl) * (w * (ambientSway.y + ambientSway.w * g));
      off += push * (w * ambientSway.z * (0.75 + 0.25 * sin(t * 9.0 + ph)));
    }
    if (ambient.y > 0.0) off.xz += vec2(sin(t * ambientRattle.y + ambient.y * 37.0), cos(t * ambientRattle.y * 1.3 + ambient.y * 53.0)) * (g * ambientRattle.x);
    return off;
  }`;

export class Ambient {
  constructor(calm = () => false) {   // calm: Reduce effects (or the device's reduced motion) holds everything still
    this.uniforms = uniforms;
    this.enabled = EXPERIMENTS.ambient !== 0;
    this.calm = calm;
    this.next = 1;                // the hit slot the next gust takes
    this.marked = new Set();      // materials of marked meshes (later rooms' meshes that share them get zeros)
    this.pieces = [];             // marked pieces (stories)
    this.read();
    bus.on('impact', ({ pos, size }) => this.gust(pos, size / LOOK.num('ambient-gust-size', 0.08)));
  }

  read() {
    uniforms.ambientReach.value = LOOK.num('ambient-reach', 0.3);
    uniforms.ambientSway.value.set(LOOK.num('ambient-lean', 0.004), LOOK.num('ambient-flutter', 0.0008), LOOK.num('ambient-push', 0.015), LOOK.num('ambient-gust-flutter', 0.003));
    uniforms.ambientRattle.value.set(LOOK.num('ambient-rattle', 0.0015), LOOK.num('ambient-rattle-rate', 60));
    uniforms.ambientCloth.value.set(LOOK.num('ambient-cloth', 0.006), LOOK.num('ambient-cloth-billow', 0.05), LOOK.num('ambient-cloth-rate', 0.9));
    this.fade = LOOK.num('ambient-gust-fade', 0.8);
    this.wake = LOOK.num('ambient-wake-speed', 0.8);
  }

  // a gust at pos, strength 0..1 (more than 1 is held at 1), in the oldest hit slot
  gust(pos, strength) {
    const s = Math.min(1, strength);
    if (!this.enabled || s <= 0.05) return;
    uniforms.ambientGust.value[this.next].set(pos.x, pos.y, pos.z, s);
    this.next = this.next % 3 + 1;
  }

  // once a frame: the clock, the jelly's wake (gust 0) and the hits fading out
  update(dt, at, speed) {
    uniforms.ambientOn.value = this.enabled && !this.calm() ? 1 : 0;
    uniforms.ambientTime.value = (uniforms.ambientTime.value + dt) % 600;   // shortcut: wraps every 10 min (one tiny twitch) so the sines stay precise on a phone
    const [wake, ...hits] = uniforms.ambientGust.value;
    wake.set(at.x, at.y, at.z, Math.min(1, speed / this.wake));
    for (const h of hits) h.w = Math.max(0, h.w - dt / this.fade);
  }

  // Give the moving pieces under root their `ambient` attribute (before statics.add: a batch copies its
  // geometries' attributes once). Called again for rooms loaded later.
  mark(root) {
    if (!this.enabled) return 0;
    root.updateMatrixWorld(true);
    const users = new Map();   // geometry -> how many meshes draw it
    root.traverse((o) => { if (o.isMesh) users.set(o.geometry, (users.get(o.geometry) || 0) + 1); });
    this.users = users;
    let n = 0;
    const walk = (o) => {
      const kind = !o.isMesh && kindOf(o.name);
      if (kind && !o.userData.ambient) { o.userData.ambient = kind; this[kind](o); this.pieces.push(o); n++; return; }
      if (!kind) o.children.forEach(walk);
    };
    walk(root);
    // A batch is one material and one set of attributes: every other mesh drawn with a material that a
    // marked mesh uses gets zeros, and so does every mesh sharing a geometry that now has them, until none is left out
    const meshes = [];
    root.traverse((o) => { if (o.isMesh && !Array.isArray(o.material)) meshes.push(o); });
    for (let more = true; more;) {
      more = false;
      for (const o of meshes) if (o.geometry.attributes.ambient) this.marked.add(o.material);
      for (const o of meshes) {
        if (o.geometry.attributes.ambient || !this.marked.has(o.material)) continue;
        o.geometry.setAttribute('ambient', new THREE.BufferAttribute(new Float32Array(o.geometry.attributes.position.count * 2), 2));
        more = true;
      }
    }
    return n;
  }

  // a marked mesh's own geometry: a copy when another piece draws the same one (that piece mustn't move with it)
  own(m) {
    const g = m.geometry;
    if ((this.users.get(g) || 0) > 1 && !g.attributes.ambient) { m.geometry = g.clone(); m.geometry.boundsTree = g.boundsTree; }   // (same vertices: the collision world's tree still fits)
    return m.geometry;
  }

  meshes(piece) {
    const out = [];
    piece.traverse((o) => { if (o.isMesh && !Array.isArray(o.material) && (o.material.isMeshStandardMaterial || o.material.isMeshLambertMaterial || o.material.isMeshPhongMaterial)) out.push(o); });
    return out;
  }

  // The meshes of a piece grouped by where they stand (touching in plan view, 2 cm apart counts): root(i) names i's group
  clusters(list) {
    const boxes = list.map((m) => new THREE.Box3().setFromObject(m)), group = list.map((_, i) => i);
    const root = (i) => (group[i] === i ? i : (group[i] = root(group[i])));
    const touch = (a, b) => a.min.x <= b.max.x + 0.02 && b.min.x <= a.max.x + 0.02 && a.min.z <= b.max.z + 0.02 && b.min.z <= a.max.z + 0.02;
    for (let i = 0; i < list.length; i++) for (let j = 0; j < i; j++) if (touch(boxes[i], boxes[j])) group[root(i)] = root(j);
    return { boxes, root };
  }

  // A plant: a piece can hold several plants (pots side by side), so its meshes are grouped by where they
  // stand (touching in plan view). In each group the pot (a mesh standing on the group's bottom, under
  // 60% of its height) holds still, and above the pot's rim (or a quarter of the way up) each vertex
  // moves by how far up the plant it is.
  sway(piece) {
    const list = this.meshes(piece).filter((m) => { for (let o = m; o && o !== piece; o = o.parent) if (!o.visible) return false; return true; });
    const { boxes, root } = this.clusters(list);
    const v = new THREE.Vector3(), mat = new THREE.Matrix4();
    for (const r of new Set(list.map((_, i) => root(i)))) {
      const ids = list.map((_, i) => i).filter((i) => root(i) === r);
      const box = new THREE.Box3();
      ids.forEach((i) => box.union(boxes[i]));
      const h = box.max.y - box.min.y, pots = ids.filter((i) => boxes[i].min.y <= box.min.y + 0.01 && boxes[i].max.y - boxes[i].min.y < 0.6 * h);
      const rim = pots.length ? Math.max(...pots.map((i) => boxes[i].max.y)) : box.min.y + 0.25 * h;
      for (const i of ids) {
        const m = list[i], g = this.own(m), pos = g.attributes.position;
        if (g.attributes.ambient) continue;
        const a = new Float32Array(pos.count * 2);
        if (!pots.includes(i)) {
          if (m.isInstancedMesh) m.getMatrixAt(0, mat).premultiply(m.matrixWorld); else mat.copy(m.matrixWorld);
          for (let k = 0; k < pos.count; k++) a[2 * k] = THREE.MathUtils.clamp((v.fromBufferAttribute(pos, k).applyMatrix4(mat).y - rim) / Math.max(0.01, box.max.y - rim), 0, 1);
        }
        g.setAttribute('ambient', new THREE.BufferAttribute(a, 2));
      }
    }
  }

  // Glassware: the whole piece shivers together, on its own phase, only in a gust
  rattle(piece) {
    const phase = 0.1 + (this.pieces.length * 0.618) % 1;
    for (const m of this.meshes(piece)) {
      const g = this.own(m);
      if (g.attributes.ambient) continue;
      const a = new Float32Array(g.attributes.position.count * 2);
      for (let i = 1; i < a.length; i += 2) a[i] = phase;
      g.setAttribute('ambient', new THREE.BufferAttribute(a, 2));
    }
  }

  // Cloth: a piece can hold several hangings (the roller shades, one a window), so its meshes are grouped by where
  // they hang; in each group a vertex is marked by how far down it is between the highest point (the rail, which holds
  // still) and the lowest (the hem). A hanging nothing patched yet (the shower curtain, built apart from the apartment)
  // gets the ripple in its own shader.
  cloth(piece) {
    const list = this.meshes(piece).filter((m) => { for (let o = m; o && o !== piece; o = o.parent) if (!o.visible) return false; return true; });
    const { boxes, root } = this.clusters(list), v = new THREE.Vector3(), mat = new THREE.Matrix4();
    for (const r of new Set(list.map((_, i) => root(i)))) {
      const ids = list.map((_, i) => i).filter((i) => root(i) === r), box = new THREE.Box3();
      ids.forEach((i) => box.union(boxes[i]));
      // the cloth is the tall part (a rail, a roller tube or a cassette is under 10 cm): it hangs from its own top, and what
      // sits above that (the rod, the cassette) holds still
      const tall = ids.filter((i) => boxes[i].max.y - boxes[i].min.y >= 0.1);
      if (!tall.length) continue;
      const top = Math.max(...tall.map((i) => boxes[i].max.y));
      for (const i of ids) {
        const m = list[i], g = this.own(m), pos = g.attributes.position;
        if (g.attributes.ambient) continue;
        const a = new Float32Array(pos.count * 2);
        if (m.isInstancedMesh) m.getMatrixAt(0, mat).premultiply(m.matrixWorld); else mat.copy(m.matrixWorld);
        for (let k = 0; k < pos.count; k++) a[2 * k + 1] = -THREE.MathUtils.clamp((top - v.fromBufferAttribute(pos, k).applyMatrix4(mat).y) / Math.max(0.01, top - box.min.y), 0, 1);
        g.setAttribute('ambient', new THREE.BufferAttribute(a, 2));
        if (m.material.onBeforeCompile === THREE.Material.prototype.onBeforeCompile) clothShader(m.material);
      }
    }
  }
}

// A hanging built outside the apartment's shared patch: only the ripple, in its own shader (same uniforms)
function clothShader(m) {
  m.defaultAttributeValues = { ...m.defaultAttributeValues, ambient: [0, 0] };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>' + AMBIENT_VERTEX)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec3 ambOff = ambientOffset((modelMatrix * vec4(transformed, 1.0)).xyz, mat3(modelMatrix) * objectNormal);
        if (ambOff != vec3(0.0)) { mvPosition.xyz += mat3(viewMatrix) * ambOff; gl_Position = projectionMatrix * mvPosition; }`);
  };
  m.needsUpdate = true;
}
