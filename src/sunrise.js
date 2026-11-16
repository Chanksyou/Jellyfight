// The sun: a stage's `sun` block (act 4's room, stage4.js). Daylight creeps across the room from the
// window wall, its line running straight across in x and moving in z from `from` to `to` over the
// night, then staying there. All of the room on the window side of the line is sunlit, floor and
// furniture tops alike, and a jelly standing in it dries out: it loses `drain` Health a second (the
// act's `power` on top, as every hurt), out through the event bus as damage_taken, source 'sun', so
// the run log and the death screen can name it. Bugs and Elites aren't hurt.
//
// It is painted, never a light (CLAUDE.md rule 7): one additive sheet draped over the room's floor
// and furniture tops, cut off at the line with a hard hot rim (the floor shape of its Warning), and a
// low hex volume standing on the line over the strip it moves into next (fx.volume, the Warning's
// volume), both in --hostile-sun. Two draws. Both are built when the run starts, so their programs
// are built with everything else behind Play; nothing is allocated or compiled while it plays.
//
// While the jelly is in it: the bell dulls (avatar.dry), steam comes off it, a low sizzle, and a
// small tremor each second it bites (juice.feel('sun')), when the rim flares. Look values: --sun-*.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { hostile } from './vfx.js';
import { bus, PLAYER } from './events.js';
import { juice } from './juice.js';
import { sfx } from './sfx.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const _o = new THREE.Vector3(), _mid = new THREE.Vector3(), _top = new THREE.Vector3();
const STEP = 0.015;          // m: a cell whose corners differ more than this is across a furniture edge
const CHEST = 0.06;          // m: a chest's half width and a little: how far into the shade its spot must be

// logarithmic depth (desktop) needs these chunks in a custom shader (as vfx.js does)
const LOGV_PARS = '#include <common>\n#include <logdepthbuf_pars_vertex>';
const LOGF_PARS = '#include <logdepthbuf_pars_fragment>';

// The sunlit sheet: a warm additive glow on everything with z below uLine, brightest in a hard hot
// rim along the line (the edge you must stay behind), and nothing past it
class SunMaterial extends THREE.ShaderMaterial {
  constructor(color) {
    super({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uLine: { value: 0 },
        uRim: { value: LOOK.num('sun-rim', 0.035) },
        uFill: { value: LOOK.num('sun-fill', 0.25) },
        uRimGlow: { value: LOOK.num('sun-rim-glow', 0.7) },
        uPulse: { value: 0 },
      },
      vertexShader: /* glsl */`
        ${LOGV_PARS}
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        ${LOGF_PARS}
        uniform vec3 uColor; uniform float uLine, uRim, uFill, uRimGlow, uPulse;
        varying vec3 vW;
        void main() {
          #include <logdepthbuf_fragment>
          float d = uLine - vW.z;                            // how far into the sun
          if (d < 0.0) discard;
          float edge = smoothstep(0.0, fwidth(vW.z) * 1.5, d);   // hard, but not jagged
          float rim = 1.0 - smoothstep(uRim * 0.6, uRim, d);
          float a = edge * (uFill + rim * (uRimGlow + uPulse));
          gl_FragColor = vec4(uColor * a, 1.0);              // added to the room: light, never a cover
        }`,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.extensions = { derivatives: true };
  }
}

export class Sunrise {
  constructor(run) {
    this.run = run;
    this.sun = null;          // the stage's sun block, or null
    this.sheet = null;        // the sunlit sheet (built once per page, for the room as it stands)
    this.vol = null;          // the Warning's volume on the line
    this.line = 0;            // z of the line now
    this.lit = false;         // the jelly is in the sun this frame
  }

  // where the line is `t` seconds into the night
  lineAt(t) {
    const S = this.sun;
    return S.from + (S.to - S.from) * Math.min(1, Math.max(0, t / (this.run.duration || 1)));
  }
  // false when a chest at `z` would be in the sun before `until` (seconds into the night): it would
  // turn up where the jelly has to burn to reach it
  shaded(z, until) { return !this.sun || z > this.lineAt(until) + CHEST; }

  // the run starts (Run.start): this stage's sun, or none. `rebuild`: the room changed (the layout
  // editor), so drape the sheet again
  start(stage, rebuild = false) {
    this.sun = stage.sun || null;
    this.lit = false; this.tickT = 0; this.steamT = 0; this.sizzleT = 0; this.tagT = 0; this.dryK = 0; this.shown = -1; this.told = false;
    if (rebuild && this.sheet) { this.run.scene.remove(this.sheet); this.sheet.geometry.dispose(); this.sheet = null; }
    if (!this.sun) { if (this.sheet) this.sheet.visible = this.vol.visible = false; return; }
    if (!this.sheet) this.build();
    this.sheet.visible = this.vol.visible = true;
    this.place(0);
  }

  // Drape the sheet over the room in two layers on one grid of --sun-cell, a row at a time from the
  // window wall so the draw can stop at the line: the floor, found from --sun-floor-from (under
  // furniture too: the rule is the line, so the floor under a table is sunlit as well), and the tops
  // of what stands on it, found from --sun-reach (above that: cabinets, lamps). A top cell across an
  // edge is left out; a floor cell across one (a rug's edge, a leg) lies flat at its lowest corner.
  build() {
    const { world, scene, fx } = this.run, S = this.sun, cell = LOOK.num('sun-cell', 0.04), lift = LOOK.num('sun-lift', 0.002);
    const from = [LOOK.num('sun-floor-from', 0.05), LOOK.num('sun-reach', 1.2)];
    const [x0, x1] = S.across, nx = Math.ceil((x1 - x0) / cell) + 1, nz = Math.ceil((S.to + 0.1) / cell) + 1, N = nx * nz;
    const pos = new Float32Array(N * 6), ok = new Uint8Array(N * 2);   // the floor's points, then the tops'
    // the grid in blocks, each with the colliders near it gathered (world.focus), so a drop costs a BVH walk
    const B = 12;
    for (let bz = 0; bz < nz; bz += B) for (let bx = 0; bx < nx; bx += B) {
      world.focus(_mid.set(x0 + (bx + B / 2) * cell, 0, (bz + B / 2) * cell), 1, B * cell);
      for (let j = bz; j < Math.min(nz, bz + B); j++) for (let i = bx; i < Math.min(nx, bx + B); i++) {
        for (let L = 0; L < 2; L++) {
          const x = x0 + i * cell, z = j * cell, hit = world.cast(_o.set(x, from[L], z), DOWN, from[L] + 0.1), k = L * N + j * nx + i;
          pos[k * 3] = x; pos[k * 3 + 1] = hit ? hit.point.y + lift : 0; pos[k * 3 + 2] = z;
          ok[k] = hit ? 1 : 0;
        }
      }
    }
    world.focus(this.run.player.position, 1);   // back to where the jelly is
    const extra = [], idx = [], rows = [], y = (k) => pos[k * 3 + 1];
    for (let j = 0; j < nz - 1; j++) {
      for (let L = 0; L < 2; L++) for (let i = 0; i < nx - 1; i++) {
        const a = L * N + j * nx + i, b = a + 1, c = a + nx, d = c + 1;
        if (!(ok[a] && ok[b] && ok[c] && ok[d])) continue;
        const lo = Math.min(y(a), y(b), y(c), y(d)), hi = Math.max(y(a), y(b), y(c), y(d));
        if (L === 1 && [a, b, c, d].some((k) => y(k) - y(k - N) <= STEP)) continue;   // a top no higher than the floor: the floor has it
        if (hi - lo <= STEP) { idx.push(a, c, b, b, c, d); continue; }
        if (L === 1) continue;
        const n = 2 * N + extra.length / 3;
        for (const k of [a, b, c, d]) extra.push(pos[k * 3], lo, pos[k * 3 + 2]);
        idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      }
      rows.push(idx.length);   // indices drawn up to the end of row j (its far side at z = (j + 1) * cell)
    }
    const all = new Float32Array(pos.length + extra.length);
    all.set(pos); all.set(extra, pos.length);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(all, 3));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3((x0 + x1) / 2, 0.3, S.to / 2), Math.hypot(x1 - x0, S.to) / 2 + 0.5);
    this.rows = rows; this.cell = cell;
    this.sheet = new THREE.Mesh(g, this.mat ||= new SunMaterial(hostile('sun')));
    this.sheet.name = 'Sunlight';
    this.sheet.frustumCulled = false;
    this.sheet.renderOrder = 3;   // with the floor Warnings
    scene.add(this.sheet);
    // the Warning's volume: a low hex wall standing on the line over the strip it moves into next
    this.vol ||= fx.volume(hostile('sun'), 'lane', _o.set((x0 + x1) / 2, 0, S.from), new THREE.Vector3(x1 - x0, LOOK.num('sun-volume-height', 0.04), LOOK.num('sun-volume-ahead', 0.06)));
    this.vol.material.opacity = LOOK.num('sun-volume-opacity', 0.6);
  }

  // the line (and what's drawn of the sheet) at `t` seconds into the night
  place(t) {
    const z = this.line = this.lineAt(t);
    this.sheet.material.uniforms.uLine.value = z;
    const row = Math.min(this.rows.length - 1, Math.floor(z / this.cell));
    this.sheet.geometry.setDrawRange(0, this.rows[Math.max(0, row)]);
    this.vol.position.z = z;
    this.vol.visible = z < this.sun.to;   // the Warning while it still moves: stopped, nothing more fills
    this.vol.material.progress = (this.run.t / LOOK.num('sun-volume-beat', 1.5)) % 1;
  }

  // each frame of play
  update(dt) {
    if (!this.sun) return;
    const run = this.run, P = run.player.position, S = this.sun;
    this.place(run.t);
    const U = this.sheet.material.uniforms;
    U.uPulse.value = Math.max(0, U.uPulse.value - dt * 3);
    // the one check: the jelly's feet on the window side of the line
    const lit = run.phase === 'explore' && P.z < this.line && !(run.polypT > 0);
    const mid = _mid.set(P.x, P.y + run.cfg.height * 0.5, P.z), colour = U.uColor.value;
    const top = _top.set(P.x, P.y + run.cfg.height * 0.9, P.z);   // steam rises off the crown, clear of the bell
    if (lit) {
      bus.emit('damage_taken', { targetId: PLAYER, amount: S.drain * dt, source: 'sun', drain: true });
      if (!this.lit) {   // stepping in: a hiss and a puff of steam off the bell, a flash where the light catches it
        run.gadgets.looks.steam(top);
        run.fx.impact(mid, colour, LOOK.num('sun-flash', 0.02), 6);
        sfx.sunIn();
        if (run.t - this.tagT > 3 || !this.tagT) { this.tagT = run.t; run.fx.number(_o.set(P.x, P.y + run.cfg.height * 1.1, P.z), 'DRYING', '#' + colour.getHexString(), 13); }
        if (!this.told) { this.told = true; run.hud.toast('☀️ The sun dries you out: keep to the shade', 2600); }
        this.tickT = LOOK.num('sun-tick', 1);
      }
      if ((this.tickT -= dt) <= 0) { this.tickT += LOOK.num('sun-tick', 1); juice.feel('sun'); U.uPulse.value = LOOK.num('sun-pulse', 0.8); }   // it bites: a tremor, the rim flares
      if ((this.steamT -= dt) <= 0) { this.steamT = LOOK.num('sun-steam-gap', 0.35); run.gadgets.looks.steam(top); }
      if ((this.sizzleT -= dt) <= 0) { this.sizzleT = LOOK.num('sun-sizzle-gap', 0.32); sfx.sunSizzle(); }
    }
    this.lit = lit;
    // the bell dries as it stays, and comes back slowly in the shade (that is only the look: the drain stops at once)
    this.dryK = lit ? Math.min(1, this.dryK + dt / LOOK.num('sun-dry-in', 1.2)) : Math.max(0, this.dryK - dt / LOOK.num('sun-dry-out', 2));
    const av = run.player.avatar;
    if (av !== this.avatar) { this.avatar = av; this.shown = -1; }
    if (av?.dry && this.dryK !== this.shown) { this.shown = this.dryK; av.dry(this.dryK); }
  }
}
