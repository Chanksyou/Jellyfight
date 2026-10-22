// What an element bubble looks like in flight: each element treasure turns the bubble into its
// own projectile, so you can see what every shot will do before it lands.
//
//   fire       a white-hot fireball in a flickering orange flame, licking flames streaming back
//              and embers dropping off it
//   lightning  a ball of light with jagged arcs crackling around it (new ones every frame) and
//              sparks spitting off
//   ice        a spinning crystal shard pointed along its flight, a frosty trail and snow
//   acid       a wobbling green glob with a bubble rolling over it, dripping as it flies
//   wind       a crescent wind blade, flat and bowed forward, with a fainter one behind it and wisps
//              trailing off both tips (bubbles.js hits everything its arc passes through)
//   glitter    a hot pink orb shedding twinkling sparks in every colour
//
// Every mesh is drawn instanced (batch.js) and every glow is a GlowPoints particle (vfx.js);
// the lightning arcs share one line buffer. So a screen full of them is a handful of draw calls.
import * as THREE from 'three';
import { batcher } from './batch.js';
import { LOOK } from './look.js';

const Z = new THREE.Vector3(0, 0, 1);
const _t = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const C = (hex) => new THREE.Color(hex);
const COL = {
  bolt: C(0xffe640), spark: C(0xfff8c0),
  frost: C(0x6ad0ff), snow: C(0xe8f8ff),
  acid: C(0x5aff1a), drip: C(0x3aff00), fume: C(0xb8ff8a),
  wisp: [C(0xffffff), C(0xbfe6ff)],
  glitter: [C(0xff2ab0), C(0xffc81a), C(0x2ae0ff), C(0xb04aff), C(0x6aff6a)],
};
const SIZE = 1.3;    // element projectiles read a little bigger than a plain bubble
// The wind blade: an arc of radius R (in bubble radii) lying flat, bowed forward (+z), its middle at
// the projectile and its tips swept back. WIND_ARC is also how far to each side it hits (bubbles.js).
export const WIND_ARC = 2.6;
function crescent(R, tube) {
  const arc = Math.PI * 0.75;
  return new THREE.TorusGeometry(R, tube, 6, 28, arc).rotateZ(Math.PI / 2 - arc / 2).rotateX(Math.PI / 2).translate(0, 0, -R);
}

// The acid puddle's surface (bubbles.js puddles; one program, each puddle its own copy of the
// uniforms): a wobbly, irregular edge round a deep toxic middle and a bright rim, ripples and
// blisters moving over it; uFade fades it in and out, uDry shrinks and darkens it as it ends
export class AcidMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      uniforms: {
        uTime: { value: 0 }, uSeed: { value: 0 }, uFade: { value: 1 }, uDry: { value: 0 },
        uDeep: { value: C(LOOK.color('acid-deep', '#1f8a06')) }, uBright: { value: C(LOOK.color('acid-bright', '#b8ff4a')) },
      },
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec2 vP;
        void main() {
          vP = position.xz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <logdepthbuf_pars_fragment>
        uniform float uTime, uSeed, uFade, uDry; uniform vec3 uDeep, uBright;
        varying vec2 vP;
        void main() {
          #include <logdepthbuf_fragment>
          float r = length(vP), a = atan(vP.y, vP.x), t = uTime;
          float edge = (0.84 + 0.07 * sin(a * 5.0 + uSeed) + 0.045 * sin(a * 9.0 - t * 1.3 + uSeed * 2.0) + 0.03 * sin(a * 14.0 + t * 2.1)) * (1.0 - uDry * 0.35);
          if (r > edge) discard;
          float k = r / edge;
          float ripple = 0.5 + 0.5 * sin(r * 26.0 - t * 4.0 + uSeed);
          float blister = 0.0;
          for (int i = 0; i < 5; i++) {
            float f = float(i);
            vec2 c = 0.55 * vec2(sin(uSeed * 3.1 + f * 2.3 + t * 0.35), cos(uSeed * 1.7 + f * 1.9 - t * 0.3));
            float grow = fract(t * 0.6 + f * 0.37);
            blister += smoothstep(0.035, 0.0, abs(length(vP - c) - grow * 0.2)) * (1.0 - grow);
          }
          vec3 col = mix(uDeep, uBright, clamp(smoothstep(0.55, 1.0, k) * 0.8 + ripple * 0.22 + blister * 1.2, 0.0, 1.0)) + uBright * blister * 0.35;
          col *= 1.0 - uDry * 0.45;
          float alpha = (0.5 + 0.4 * smoothstep(0.7, 1.0, k) + blister * 0.3) * uFade;
          gl_FragColor = vec4(col, alpha);
        }`,
      transparent: true, depthWrite: false, toneMapped: false,
    });
  }
}

// unlit (they're lights, not things); additive ones glow over whatever is behind
const lit = (hex, opacity = 1, add = false) => new THREE.MeshBasicMaterial({
  color: hex, transparent: opacity < 1 || add, opacity, depthWrite: !add && opacity >= 1, toneMapped: false,
  blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
});

export class BubbleLooks {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.pools = {};
    this.windColor = C(LOOK.color('wind-core', '#d9f6ff'));
    this.fire = {
      core: C(LOOK.color('fire-core', '#fff6ce')), flame: C(LOOK.color('fire-flame', '#ffb632')),
      edge: C(LOOK.color('fire-edge', '#ff581f')), ember: C(LOOK.color('fire-ember', '#ffc566')),
      length: LOOK.num('fire-tail-length', 4.8), interval: LOOK.num('fire-trail-interval', 0.035),
      life: LOOK.num('fire-trail-life', 0.19), contactLife: LOOK.num('fire-contact-life', 0.11),
      contactScale: LOOK.num('fire-contact-scale', 3.2), emberLife: LOOK.num('fire-ember-life', 0.38),
      burnInterval: LOOK.num('fire-burn-interval', 0.12),
      sparks: LOOK.num('fire-contact-sparks', 12), sparkSpeed: LOOK.num('fire-spark-speed', 0.23),
      deathEmbers: LOOK.num('fire-death-embers', 18), deathLife: LOOK.num('fire-death-life', 0.75),
      ash: LOOK.color('fire-ash', '#382b28'),
      smoke: LOOK.color('fire-smoke', '#74655d'),
    };
    const F = this.fire;
    const ball = new THREE.IcosahedronGeometry(1, 2);
    const flake = new THREE.CircleGeometry(1, 6), crystal = new THREE.OctahedronGeometry(1, 0), iceMat = new THREE.MeshStandardMaterial({ color: 0xaee6ff, emissive: 0x1a8aff, emissiveIntensity: 1.3, roughness: 0.08, metalness: 0.3, flatShading: true });
    // Base at the hot core, tapered point trailing along local -z. No dynamic lights.
    const tongue = new THREE.ConeGeometry(1, 1, 7).rotateX(-Math.PI / 2).translate(0, 0, -0.5);
    // each element's parts: [geometry, material, { name, s: [x, y, z] scale, at: [x, y, z] }]
    // (local +z is the way it flies)
    this.parts = {
      fire: [
        [ball, lit(F.core), { name: 'core', s: [0.8, 0.8, 1.05] }],
        [ball, lit(F.flame, 0.72, true), { name: 'flame', s: [1.05, 1.05, F.length * 0.45], at: [0, 0, -0.7] }],
        [tongue, lit(F.edge, 0.4, true), { name: 'flame2', s: [1.45, 1.45, F.length * 1.4] }],
        [tongue, lit(F.core, 0.7, true), { name: 'tongue', s: [0.35, 0.35, F.length * 0.85], at: [0.45, 0.1, -0.2] }],
      ],
      lightning: [
        [ball, lit(0xfffbe0)],
        [ball, lit(0xffc800, 0.45), { name: 'halo', s: [1.6, 1.6, 1.6] }],
      ],
      ice: [
        [crystal, iceMat, { name: 'shard', s: [0.75, 0.75, 2.2] }],
        [crystal, lit(0xffffff), { name: 'core', s: [0.3, 0.3, 1.6] }],           // a white-hot heart inside it
        [crystal, iceMat, { name: 'chip1', s: [0.22, 0.22, 0.6] }],               // two chips of ice orbiting it
        [crystal, iceMat, { name: 'chip2', s: [0.18, 0.18, 0.5] }],
        [ball, lit(0x2a9aff, 0.25), { s: [1.4, 1.4, 2.4] }],
      ],
      acid: [
        [ball, lit(0x5aee10), { name: 'blob' }],
        [ball, lit(0x1acc00, 0.35), { s: [1.45, 1.45, 1.45] }],
        [ball, lit(0xc8ff6a), { name: 'bub', s: [0.36, 0.36, 0.36] }],
        [ball, lit(0x46d80c), { name: 'tail1', s: [0.62, 0.62, 0.8], at: [0, 0, -1.25] }],   // a sloshing tail
        [ball, lit(0x34b808), { name: 'tail2', s: [0.38, 0.38, 0.55], at: [0, 0, -2.05] }],
      ],
      wind: [
        [crescent(WIND_ARC, 0.32), lit(0xffffff, 0.85, true), { name: 'blade', s: [1, 0.35, 1] }],
        [crescent(WIND_ARC * 0.8, 0.22), lit(0xbfe8ff, 0.6, true), { name: 'blade2', s: [1, 0.3, 1], at: [0, 0, -1.1] }],
        [ball, lit(0xeef6ff, 0.6, true), { s: [0.6, 0.6, 0.6] }],
      ],
      glitter: [
        // a clear bauble with a hot pink heart and glitter swirling round inside it
        [ball, lit(0xff2ab0), { name: 'heart', s: [0.55, 0.55, 0.55] }],
        [ball, lit(0xffd0f0, 0.22, true), { name: 'bauble', s: [1.25, 1.25, 1.25] }],
        [ball, lit(0xff4ac0, 0.35), { name: 'halo', s: [1.6, 1.6, 1.6] }],
        ...[0xffc81a, 0x2ae0ff, 0xb04aff, 0x6aff6a, 0xffffff, 0xff2ab0].map((c, k) => [flake, lit(c, 1, true), { name: 'f' + k, s: [0.24, 0.24, 0.24] }]),
      ],
    };
    // lightning arcs, all of them in one line buffer, rebuilt every frame
    const MAX = 96 * 5 * 2;
    this.arcPos = new Float32Array(MAX * 3);
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(this.arcPos, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.arcs = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffe640, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.arcs.frustumCulled = false;
    this.arcs.renderOrder = 4;
    scene.add(this.arcs);
    this.arcN = 0;
    this.arcMax = MAX;
    // the lightning's chain bolts while they flicker (strike): pooled, at most BOLTS at once
    this.live = [];
    this.boltPool = [];
    this.path = Array.from({ length: 17 }, () => new THREE.Vector3());
    this.L = {
      core: C(LOOK.color('bolt-core', '#fffbe8')), halo: C(LOOK.color('bolt-halo', '#ffd21a')), flash: C(LOOK.color('bolt-flash', '#fff6c8')),
      life: LOOK.num('bolt-life', 0.2), width: LOOK.num('bolt-width', 0.005), jag: LOOK.num('bolt-jag', 0.22), most: LOOK.num('bolt-most', 12),
    };
  }

  // a projectile for element `el` (pooled)
  get(el) {
    const pool = (this.pools[el] ||= []);
    let m = pool.pop();
    if (!m) {
      m = new THREE.Group();
      m.userData.look = el;
      for (const [geo, mat, o = {}] of this.parts[el]) {
        const part = new THREE.Mesh(geo, mat);
        if (o.s) part.scale.set(...o.s);
        if (o.at) part.position.set(...o.at);
        part.userData.base = part.scale.clone();
        if (o.name) m.userData[o.name] = part;
        m.add(part);
      }
      batcher.track(m);
    }
    if (!m.parent) this.scene.add(m);
    m.visible = true;
    return m;
  }

  release(m) { m.visible = false; this.pools[m.userData.look].push(m); }

  // one of each, for the shader warm-up (main.js)
  warm(at) { return Object.keys(this.parts).map((el) => { const m = this.get(el); m.position.copy(at); m.scale.setScalar(0.01); return m; }); }

  frame() { this.arcN = 0; }
  endFrame() {
    this.arcs.geometry.setDrawRange(0, this.arcN);
    this.arcs.geometry.attributes.position.needsUpdate = true;
    this.arcs.visible = this.arcN > 0;
  }

  windGather(pos, progress, size) {
    const radius = LOOK.num('wind-gather-radius', 0.022) * size * (1 - progress * 0.6);
    for (let k = 0; k < 6; k++) {
      const angle = k * Math.PI / 3 + progress * Math.PI * 3;
      _p.copy(pos).add(_v.set(Math.cos(angle) * radius, Math.sin(angle * 2) * radius * 0.2, Math.sin(angle) * radius));
      this.fx.glow.hold(_p, this.windColor, radius * 0.25, 0.35 + progress * 0.4);
    }
  }

  windRelease(pos, size) {
    this.fx.glow.emit(pos, this.windColor, LOOK.num('wind-release-size', 0.018) * size, LOOK.num('wind-release-size', 0.018) * size * 2, LOOK.num('wind-release-life', 0.12), 0.65);
  }

  // each element's own colours for its gather, launch and contact: [main, bright accent]
  tones(el) {
    const F = this.fire;
    return { fire: [F.flame, F.core], lightning: [COL.bolt, COL.spark], ice: [COL.frost, COL.snow], acid: [COL.acid, COL.drip], glitter: [COL.glitter[0], COL.glitter[1]] }[el] || [COL.snow, COL.snow];
  }

  // anticipation: motes of the element drawn in to the bell, tighter and brighter as `k` nears 1
  gather(el, pos, k, size) {
    const [a, b] = this.tones(el), radius = LOOK.num('element-gather-radius', 0.02) * size * (1 - k * 0.7);
    for (let i = 0; i < 4; i++) {
      const ang = i * Math.PI / 2 + k * Math.PI * 2;
      _p.copy(pos).add(_v.set(Math.cos(ang) * radius, Math.sin(ang * 2) * radius * 0.3, Math.sin(ang) * radius));
      this.fx.glow.hold(_p, i % 2 ? b : a, radius * 0.45 + 0.003, 0.35 + k * 0.6);
    }
  }

  // release: a flash at the bell in the element's colours (lightning snaps a few short arcs out)
  launch(el, pos, size) {
    const [a, b] = this.tones(el), r = LOOK.num('element-launch-size', 0.014) * size, glow = this.fx.glow;
    glow.emit(pos, b, r, r * 0.3, 0.1, 1.2);
    glow.emit(pos, a, r * 1.8, r * 2.6, 0.16, 0.5);
    if (el === 'lightning') for (let k = 0; k < 3; k++) this.bolt([_a.copy(pos), _b.copy(pos).add(_v.randomDirection().multiplyScalar(r * 2.2))], r * 0.25);
  }

  // impact, only for a confirmed hit (bubbles.js pop on an enemy): each element lands its own way
  contact(el, pos, r, floor = pos.y - 0.03) {
    const glow = this.fx.glow, [a, b] = this.tones(el);
    glow.emit(pos, b, r * 3.2, r * 0.6, 0.09, 1.3);                                    // the sharp contact
    if (el === 'lightning') {
      glow.emit(pos, this.L.flash, r * 14, r * 4, 0.06, 1.2);                                // a white flash that lights up round it
      glow.emit(pos, a, r * 7, r * 2, 0.18, 0.7);
      for (let k = 0; k < 6; k++) this.strike(pos, _b.copy(pos).add(_v.randomDirection().multiplyScalar(r * (4 + Math.random() * 3))), r * 0.35);   // forks crackling off it
      for (let k = 0; k < 10; k++) glow.emit(pos, k % 2 ? COL.spark : COL.bolt, r * 0.45, 0, 0.25 + Math.random() * 0.25, 1, _v.randomDirection().multiplyScalar(0.25 + Math.random() * 0.3), 1.2);   // sparks spat out
    } else if (el === 'ice') {
      // it shatters: a cold white flash, real crystal shards tumbling out and skipping off the floor,
      // a frost flower spreading where it struck, frost settling
      glow.emit(pos, COL.snow, r * 9, r * 3, 0.07, 1.1);
      glow.emit(pos, COL.frost, r * 5, r * 2, 0.22, 0.6);
      this.fx.ice.shatter(pos, 9, r * 0.55, 0.5, floor);
      this.fx.ice.bloom(_p.set(pos.x, floor, pos.z), r * LOOK.num('ice-bloom', 5), 1.6);
      for (let k = 0; k < 5; k++) glow.emit(_p.copy(pos).add(_v.randomDirection().multiplyScalar(r * 1.5)), COL.snow, r * 0.5, r * 0.3, 0.8 + Math.random() * 0.5, 0.9, _a.set((Math.random() - 0.5) * 0.03, 0.01, (Math.random() - 0.5) * 0.03), 0.06);   // frost settling
    } else if (el === 'acid') {
      glow.emit(pos, a, r * 4.5, r * 2, 0.2, 0.7);
      this.fx.acid.drops(pos, 14, 0.32, floor, r * 0.28);                                      // real drops of acid splashing out, each landing with a fizz and a spot
      for (let k = 0; k < 10; k++) {                                                            // a crown of drops thrown up and falling
        const ang = k * 0.63 + Math.random() * 0.3;
        glow.emit(pos, k % 3 ? COL.acid : COL.fume, r * 0.7, r * 0.35, 0.5 + Math.random() * 0.25, 1, _v.set(Math.cos(ang) * 0.12, 0.16 + Math.random() * 0.1, Math.sin(ang) * 0.12), 1.3);
      }
      this.fx.puff(_p.copy(pos).setY(pos.y + r), 0x9ab08a, r * 2.4, 0.6);                      // the sizzle's smoke
    } else if (el === 'glitter') {
      glow.emit(pos, a, r * 5, r * 3, 0.16, 0.6);
      for (let k = 0; k < 8; k++) glow.emit(_p.copy(pos).add(_v.randomDirection().multiplyScalar(r * 2)), COL.glitter[k % 5], r * 0.5, 0, 0.9 + Math.random() * 0.6, 1, _a.set((Math.random() - 0.5) * 0.05, 0.03, (Math.random() - 0.5) * 0.05), 0.05);   // twinkles drifting down
    }
  }

  // the glitter bomb going off (bubbles.js splash; its flakes are fx.glitter's): a white-hot pop, a
  // flash of every colour, and a ring of sparkle racing out to the splash's real edge
  glitterPop(pos, radius) {
    const glow = this.fx.glow;
    glow.emit(pos, COL.snow, radius * 1.2, radius * 0.6, 0.07, 1.4);
    for (let k = 0; k < 5; k++) glow.emit(pos, COL.glitter[k], radius * 0.7, radius * 0.5, 0.2, 0.5);
    for (let k = 0; k < 18; k++) {                                            // sparkles flung to the edge
      const a = (k / 18) * Math.PI * 2;
      glow.emit(pos, COL.glitter[k % 5], radius * 0.09, 0, 0.3 + Math.random() * 0.15, 1.2, _v.set(Math.cos(a) * radius * 3, 0.03, Math.sin(a) * radius * 3), 0.15);
    }
  }
  // a bug the glitter splash hit: it sparkles all over for a moment
  glittered(pos, r) {
    for (let k = 0; k < 5; k++) this.fx.glow.emit(_p.copy(pos).add(_v.randomDirection().multiplyScalar(r * 0.9)), COL.glitter[(Math.random() * 5) | 0], r * 0.45, 0, 0.35 + Math.random() * 0.4, 1.3, _a.set(0, 0.015, 0), 0.1);
  }

  // the acid puddle splashing down: a ring of drops thrown out to its edge and a bright splat
  puddleSplat(pos, r) {
    const glow = this.fx.glow;
    glow.emit(pos, COL.acid, r * 0.6, r * 2.2, 0.22, 0.6);
    for (let k = 0; k < 10; k++) { const a = k * 0.63; glow.emit(pos, k % 2 ? COL.acid : COL.drip, r * 0.12, r * 0.05, 0.4, 1, _v.set(Math.cos(a) * r * 4, 0.12, Math.sin(a) * r * 4), 1.2); }
  }
  // a live puddle, each frame: blisters swelling and popping, toxic fumes rising off it
  puddleLive(pos, r, dt, k = 1) {
    const glow = this.fx.glow;
    if (Math.random() < dt * 9 * k) {                                                          // a bubble swelling, then popping
      const a = Math.random() * 6.3, d = Math.sqrt(Math.random()) * r * 0.75;
      _p.set(pos.x + Math.cos(a) * d, pos.y + 0.002, pos.z + Math.sin(a) * d);
      glow.emit(_p, COL.acid, r * 0.05, r * 0.16, 0.35, 0.8);
      if (Math.random() < 0.5) for (let j = 0; j < 3; j++) glow.emit(_p, COL.fume, r * 0.04, 0, 0.3, 1, _v.set((Math.random() - 0.5) * 0.05, 0.06 + Math.random() * 0.04, (Math.random() - 0.5) * 0.05), 0.8);
    }
    if (Math.random() < dt * 6 * k) {                                                          // fumes drifting up
      const a = Math.random() * 6.3, d = Math.random() * r * 0.8;
      glow.emit(_p.set(pos.x + Math.cos(a) * d, pos.y + 0.004, pos.z + Math.sin(a) * d), COL.fume, r * 0.12, r * 0.4, 1.1, 0.16, _v.set((Math.random() - 0.5) * 0.01, 0.03, (Math.random() - 0.5) * 0.01));
    }
  }
  // the puddle eating at a bug standing in it: a sizzle of green and smoke at its feet
  acidBite(pos, r) {
    const glow = this.fx.glow;
    glow.emit(pos, COL.acid, r * 1.2, r * 0.4, 0.2, 0.8);
    for (let k = 0; k < 4; k++) glow.emit(pos, COL.fume, r * 0.25, 0, 0.35, 1, _v.set((Math.random() - 0.5) * 0.06, 0.08 + Math.random() * 0.05, (Math.random() - 0.5) * 0.06), 0.6);
    this.fx.puff(_p.copy(pos).setY(pos.y + r * 0.5), 0x9ab08a, r * 1.1, 0.45);
    // froth: green bubbles welling up over the bug as the acid eats at it, a drop or two running off
    for (let k = 0; k < 6; k++) glow.emit(_p.copy(pos).add(_v.set((Math.random() - 0.5) * r * 1.6, Math.random() * r * 1.4, (Math.random() - 0.5) * r * 1.6)), k % 2 ? COL.acid : COL.drip, r * 0.18, r * 0.32, 0.3 + Math.random() * 0.2, 0.9, _a.set(0, 0.01, 0));
    if (Math.random() < 0.5) this.fx.acid.drops(_p.copy(pos).setY(pos.y + r), 2, 0.15, pos.y - r * 0.6, r * 0.12);
  }

  // a bolt along `pts`: a bright core inside a yellow halo, widest in the middle and tapering to
  // both ends, with one short fork; a brief afterimage (glow particles: nothing to allocate or free)
  bolt(pts, w = LOOK.num('bolt-width', 0.004)) {
    const glow = this.fx.glow, n = pts.length - 1;
    for (let i = 0; i < n; i++) for (let s = 0; s < 3; s++) {
      const f = (i + s / 3) / n, taper = 0.35 + 0.65 * Math.sin(Math.PI * f);
      _t.copy(pts[i]).lerp(pts[i + 1], s / 3);
      glow.emit(_t, COL.bolt, w * 2.6 * taper, w * taper, 0.14, 0.55);
      glow.emit(_t, COL.spark, w * taper, w * 0.3, 0.1, 1);
    }
    if (n >= 2) {                                                                          // a short fork off the middle
      const m = pts[n >> 1];
      _d.randomDirection().multiplyScalar(w * 4);
      for (let s = 1; s <= 3; s++) glow.emit(_t.copy(m).addScaledVector(_d, s), COL.bolt, w * (1.6 - s * 0.35), 0, 0.1, 0.8);
    }
  }

  // A jagged path from a to b into this.path (midpoint displacement: big bends, then smaller
  // kinks on them), `jag` its sideways reach as a share of its length. Returns the point count.
  jagged(a, b, jag) {
    const P = this.path, n = 16, len = a.distanceTo(b);
    P[0].copy(a); P[n].copy(b);
    for (let step = n; step > 1; step >>= 1) {
      const off = len * jag * (step / n);
      for (let i = step >> 1; i < n; i += step) P[i].copy(P[i - (step >> 1)]).lerp(P[i + (step >> 1)], 0.5).add(_v.randomDirection().multiplyScalar(off * (0.5 + Math.random() * 0.5)));
    }
    return n + 1;
  }

  // A chain bolt from a to b (bubbles.js zap: it only ever joins things the chain really hit).
  // For its short life it re-strikes in a new shape every frame and flickers, a crisp line inside
  // a bright core inside a yellow halo, thickest in the middle and tapering to both ends, a fork or
  // two off it; it flashes where it lands and fades to an afterimage.
  strike(a, b, w = this.L.width) {
    if (this.live.length >= this.L.most) return;
    const s = this.boltPool.pop() || { a: new THREE.Vector3(), b: new THREE.Vector3() };
    s.a.copy(a); s.b.copy(b); s.t = 0; s.w = w;
    this.live.push(s);
    this.fx.glow.emit(b, this.L.flash, w * 9, w * 2, 0.12, 1.4);                           // where it lands
  }
  tickBolts(dt) {
    if (!this.live.length) return;
    const L = this.L, glow = this.fx.glow;
    for (const s of this.live) {
      s.t += dt;
      const k = s.t / L.life;
      if (k >= 1) continue;
      const flick = k < 0.15 ? 1.4 : (Math.random() < 0.3 ? 0.35 : 1) * (1 - k * 0.8);   // a hard first frame, then it stutters out
      const n = this.jagged(s.a, s.b, L.jag), P = this.path;
      let h = 0;
      for (let i = 1; i < n; i++) {
        // glow beads packed closely enough along each kink to read as one solid stroke
        const seg = P[i - 1].distanceTo(P[i]), beads = Math.min(6, Math.max(1, Math.ceil(seg / (s.w * 1.1))));
        for (let q = 0; q < beads; q++) {
          const f = (i - 1 + q / beads) / (n - 1), w = s.w * (0.3 + 0.7 * Math.sin(Math.PI * f));
          _t.copy(P[i - 1]).lerp(P[i], q / beads);
          glow.hold(_t, L.core, w * 1.3, flick);
          if (h++ % 2 === 0) glow.hold(_t, L.halo, w * 3.4, 0.4 * flick);
        }
        if (this.arcN + 2 <= this.arcMax) { this.arcPos.set([P[i - 1].x, P[i - 1].y, P[i - 1].z, P[i].x, P[i].y, P[i].z], this.arcN * 3); this.arcN += 2; }
      }
      if (Math.random() < 0.6) {                                                            // a fork off a random kink
        const at = P[2 + ((Math.random() * (n - 4)) | 0)];
        _d.randomDirection().multiplyScalar(s.w * 3);
        for (let j = 1; j <= 3; j++) glow.hold(_t.copy(at).addScaledVector(_d, j), L.halo, s.w * (1.6 - j * 0.4), 0.7 * flick);
      }
    }
    for (let i = this.live.length - 1; i >= 0; i--) if (this.live[i].t >= L.life) this.boltPool.push(this.live.splice(i, 1)[0]);
  }
  clearBolts() { this.boltPool.push(...this.live); this.live.length = 0; }

  fireLaunch(pos, r) {
    const F = this.fire;
    this.fx.glow.emit(pos, F.core, r * 2.2, r * 0.4, F.contactLife, 0.9);
    this.fx.glow.emit(pos, F.flame, r * 4, r, F.contactLife * 1.5, 0.35);
  }

  // A compact contact, not another damage area. Only confirmed enemy strikes call this.
  fireHit(pos, r, direction = Z) {
    const F = this.fire, glow = this.fx.glow;
    _d.copy(direction).normalize();
    glow.emit(pos, F.core, r * F.contactScale, r * 0.5, F.contactLife, 1.1);
    glow.emit(pos, F.edge, r * F.contactScale * 1.5, r, F.contactLife * 2, 0.5);
    for (let k = 0; k < F.sparks; k++) {
      _v.set(Math.cos(k * 2.4) * F.sparkSpeed * 0.65, 0.08 + (k % 3) * 0.07, Math.sin(k * 2.4) * F.sparkSpeed * 0.65).addScaledVector(_d, F.sparkSpeed * 0.45);
      glow.emit(pos, k % 2 ? F.ember : F.flame, r * 0.6, 0, F.emberLife, 0.9, _v, 0.35);
    }
    // An expanding flame lick turns upward as the sharp contact disappears.
    for (let k = 0; k < 3; k++) {
      _v.copy(_d).multiplyScalar(0.045).y += 0.04 + k * 0.025;
      glow.emit(pos, k === 1 ? F.edge : F.flame, r * (1.5 + k * 0.4), r * 0.2, 0.18 + k * 0.035, 0.4, _v);
    }
  }

  fireBurn(pos, r) {
    const F = this.fire;
    this.fx.glow.emit(pos, F.flame, r * 0.9, r * 0.15, F.life, 0.45, _v.set(0, 0.055, 0));
    this.fx.glow.emit(pos, F.ember, r * 0.18, 0, F.emberLife, 0.8, _v.set(0.01, 0.07, -0.01));
  }

  // Cosmetic breakup: damage, rewards and spread stay in their existing paths.
  fireDeath(pos, r) {
    const F = this.fire, glow = this.fx.glow;
    glow.emit(pos, F.flame, r * 2, r * 0.2, F.contactLife * 2, 0.75);
    this.fx.burst(pos, [F.ash, F.ash, `#${F.edge.getHexString()}`], 9, r * 0.2, 0.1, pos.y - r);
    this.fx.puff(_p.copy(pos).setY(pos.y + r * 0.6), F.smoke, r * 1.1, 0.5);
    for (let k = 0; k < F.deathEmbers; k++) {
      _p.copy(pos).add(_a.set(Math.cos(k * 2.4), ((k % 5) - 2) * 0.35, Math.sin(k * 2.4)).multiplyScalar(r * 0.7));
      _v.set(Math.cos(k * 2.4) * 0.05, 0.07 + (k % 4) * 0.035, Math.sin(k * 2.4) * 0.05);
      glow.emit(_p, k % 3 ? F.ember : F.edge, r * 0.17, 0, F.deathLife, 0.9, _v, -0.03);
    }
  }

  // b: a flying bubble (bubbles.js). Points it along its flight, sizes and animates it, and
  // throws off its particles.
  update(b, dt, t) {
    const m = b.m, U = m.userData, glow = this.fx.glow, r = b.r * SIZE * Math.min(1, b.t * 8);
    const dir = _d.copy(b.vel).normalize();
    m.quaternion.setFromUnitVectors(Z, dir);
    m.scale.setScalar(r);
    const tail = _p.copy(m.position).addScaledVector(dir, -b.r);
    // trails are laid along the whole way it moved this frame, so they read as a streak, not dots
    const last = (b.lastTail ||= tail.clone()), gap = last.distanceTo(tail), steps = Math.min(5, Math.max(1, Math.round(gap / (r * 0.35))));
    const along = (k) => _t.copy(last).lerp(tail, (k + 1) / steps);
    b.lookT = (b.lookT || 0) - dt;
    const tick = b.lookT <= 0;
    if (tick) b.lookT = U.look === 'fire' ? this.fire.interval : 0.016;
    const w = b.wobble;
    switch (U.look) {
      case 'fire': {
        const F = this.fire, f = 1 + 0.22 * Math.sin(t * 31 + w);
        U.core.scale.set(0.8 / f, 0.8 * f, 1.15);
        U.flame.scale.set(1.05 * f, 1.05 / f, F.length * 0.45 / f);
        U.flame.rotation.z = Math.sin(t * 17 + w) * 0.25;
        U.flame2.scale.set(1.25 / f, 1.15 * f, F.length * 1.2 * f);
        U.flame2.rotation.z = -t * 5 + w;
        U.tongue.scale.z = F.length * (0.85 + Math.sin(t * 23 + w) * 0.15);
        U.tongue.position.x = Math.sin(t * 19 + w) * 0.45;
        glow.hold(m.position, F.flame, r * 3.2, 0.3);
        if (tick) {
          for (let k = 0; k < Math.min(3, steps); k++) {
            _v.copy(dir).multiplyScalar(-0.04).add(_a.set(0, 0.035, 0));
            glow.emit(along(k), k % 2 ? F.edge : F.flame, r * 1.7, 0, F.life, 0.45, _v, -0.15);
          }
          glow.emit(tail, F.ember, r * 0.3, 0, F.emberLife, 0.8, _a.set(Math.sin(t * 19 + w) * 0.025, 0.045, 0), 0.12);
        }
        break;
      }
      case 'lightning': {
        U.halo.scale.setScalar(1.4 + Math.random() * 0.6);              // it flickers
        glow.hold(m.position, COL.bolt, r * (3 + Math.random() * 1.5), 0.45);
        // 4 jagged arcs out from the core, new every frame, beaded with light so they read thick
        for (let k = 0; k < 4 && this.arcN + 10 <= this.arcMax; k++) {
          _a.randomDirection();
          let x = m.position.x, y = m.position.y, z = m.position.z;
          const len = r * (3 + Math.random() * 2.5);
          for (let s = 1; s <= 5; s++) {
            const q = len * (s / 5);
            const nx = m.position.x + _a.x * q + (Math.random() - 0.5) * r * 0.9;
            const ny = m.position.y + _a.y * q + (Math.random() - 0.5) * r * 0.9;
            const nz = m.position.z + _a.z * q + (Math.random() - 0.5) * r * 0.9;
            this.arcPos.set([x, y, z, nx, ny, nz], this.arcN * 3);
            this.arcN += 2;
            glow.hold(_b.set(nx, ny, nz), COL.bolt, r * 0.75, 0.9);
            x = nx; y = ny; z = nz;
          }
        }
        if (tick && Math.random() < 0.5) glow.emit(m.position, COL.spark, r * 0.7, r * 0.1, 0.18, 1, _v.randomDirection().multiplyScalar(0.25));
        if (tick) for (let k = 0; k < Math.min(3, steps); k++) glow.emit(along(k), COL.bolt, r * 1.6, r * 0.2, 0.12, 0.5);   // a crackling streak behind it
        if (Math.random() < dt * 8) this.strike(m.position, _b.copy(m.position).add(_v.randomDirection().multiplyScalar(r * 7)), r * 0.3);   // now and then it spits an arc out
        break;
      }
      case 'ice': {
        U.shard.rotation.z += dt * 9; U.core.rotation.z -= dt * 14;
        U.chip1.position.set(Math.cos(t * 11 + w) * 1.5, Math.sin(t * 11 + w) * 1.5, -0.4); U.chip1.rotation.set(t * 13, t * 7, 0);
        U.chip2.position.set(Math.cos(t * 11 + w + Math.PI) * 1.3, Math.sin(t * 11 + w + Math.PI) * 1.3, -0.9); U.chip2.rotation.set(t * 9, t * 15, 0);
        glow.hold(m.position, COL.frost, r * 3, 0.3);
        if (Math.random() < dt * 14) glow.emit(_a.copy(m.position).add(_v.randomDirection().multiplyScalar(r * 0.9)), COL.snow, r * 0.9, 0, 0.07, 1.4);   // a glint off a facet
        if (tick) {
          for (let k = 0; k < steps; k++) glow.emit(along(k), COL.frost, r * 1.8, r * 0.4, 0.45, 0.5);   // the frosty trail hangs in the air
          if (Math.random() < 0.4) glow.emit(tail, COL.snow, r * 0.45, r * 0.3, 0.7, 1, _v.set((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.04), 0.15);
        }
        break;
      }
      case 'acid': {
        const k = Math.sin(t * 15 + w), j = Math.cos(t * 11 + w);
        U.blob.scale.set(1 + 0.22 * k, 1 - 0.2 * k, 1.1 + 0.15 * j);       // a wobbling glob
        U.bub.position.set(Math.cos(t * 7 + w) * 0.75, 0.55 + 0.2 * k, Math.sin(t * 7 + w) * 0.75);
        U.tail1.position.set(Math.sin(t * 13 + w) * 0.25, Math.cos(t * 11 + w) * 0.2, -1.25 - 0.15 * j);   // its tail sloshing behind it
        U.tail1.scale.set(0.62 - 0.1 * k, 0.62 + 0.1 * k, 0.8 + 0.2 * j);
        U.tail2.position.set(Math.sin(t * 13 + w - 1) * 0.4, Math.cos(t * 11 + w - 1) * 0.3, -2.05 - 0.2 * k);
        glow.hold(m.position, COL.acid, r * 3.4, 0.35);
        if (tick) {
          for (let k = 0; k < steps; k++) glow.emit(along(k), COL.acid, r * 1.5, r * 0.3, 0.3, 0.5);   // a slimy streak
          if (Math.random() < 0.7) glow.emit(_v.copy(m.position).setY(m.position.y - r * 0.8), COL.drip, r * 1.0, r * 0.6, 0.55, 0.95, _a.set((Math.random() - 0.5) * 0.02, -0.02, (Math.random() - 0.5) * 0.02), 1.4);   // drips fall
          if (Math.random() < 0.5) glow.emit(tail, COL.fume, r * 1.2, r * 3, 0.7, 0.18, _a.set((Math.random() - 0.5) * 0.02, 0.035, (Math.random() - 0.5) * 0.02));   // toxic vapour coming off it
        }
        break;
      }
      case 'wind': {
        const p = 1 + 0.08 * Math.sin(t * 24 + w);                        // the blade breathes as it flies
        U.blade.scale.set(p, 0.35, p);
        U.blade2.scale.set(2 - p, 0.3, 2 - p);
        glow.hold(m.position, COL.wisp[1], r * 4, 0.4);
        if (tick) {
          // wisps peel off both tips, and a faint streak behind the middle
          _a.set(1, 0, 0).applyQuaternion(m.quaternion);
          for (let s = -1; s <= 1; s += 2) {
            _v.copy(m.position).addScaledVector(_a, s * r * WIND_ARC * 0.85).addScaledVector(dir, -r * WIND_ARC * 0.5);
            glow.emit(_v, COL.wisp[s > 0 ? 0 : 1], r * 1.1, r * 0.3, 0.3, 0.8);
          }
          glow.emit(tail, COL.wisp[1], r * 1.4, r * 0.4, 0.22, 0.6);
        }
        break;
      }
      case 'glitter': {
        U.halo.scale.setScalar(1.5 + 0.2 * Math.sin(t * 25 + w));
        for (let k = 0; k < 6; k++) {                                          // the glitter swirling inside the bauble, flashing as it turns
          const f = U['f' + k], a = t * (5 + k) + w + k * 1.05, h = Math.sin(t * 3.1 + k * 2.3) * 0.55;
          f.position.set(Math.cos(a) * 0.8, h, Math.sin(a) * 0.8); f.rotation.set(t * (11 + k), t * (7 + k * 2), 0);
        }
        glow.hold(m.position, COL.glitter[0], r * 3, 0.3);
        if (tick) for (let s = 0; s < 3; s++) {
          glow.emit(_v.copy(m.position).addScaledVector(_a.randomDirection(), r * 1.5), COL.glitter[(Math.random() * 5) | 0], r * 1.2, 0, 0.35 + Math.random() * 0.3, 1, _b.randomDirection().multiplyScalar(0.06), 0.2);
        }
        break;
      }
    }
    b.lastTail.copy(tail);
  }
}
