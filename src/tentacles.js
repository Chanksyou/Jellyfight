// The jelly's six tentacles: soft tubes that hang from under the bell, trail behind as it
// swims, stream upward as it falls, and whip out one at a time when the Lash strikes.
//
// Each tentacle is a chain of points simulated like a soft rope in water: every point is pulled
// toward a resting pose (hanging under the bell, flaring and pulling in with its pulse), firmly
// at the root and softly at the tip, sinking a little, slowed by the water (more across the
// tentacle than along it, like any slender thing), kept at its length and kept from folding
// sharper than its pose. Nothing ripples on a clock: each stroke squeezes the roots in, and the
// chain carries that down as a wave; when the jelly turns or stops, the tips trail behind and
// swing on after it, the way real ones do.
//
// The pose is in the character's model units (1 unit = the character's height, feet at y = 0,
// facing +z); the chain is simulated in world space (scaled to model units), so the jelly
// moving, turning and tilting is what drags the tentacles.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { stepChain } from './chain.js';

const SEG = 20;           // rings along a tentacle (and points in its chain)
const RAD = 8;            // vertices around a ring
const MAX_TENTACLES = 16; // max tentacles supported by the per-tentacle strike glow uniform array
// the chain: spring toward the pose at the root (1/s²; firm, so the Lash leaves from the bell),
// damping ratio, simulation step (fixed, so 30 and 60 fps step the same: Macklin 2019, small steps)
const K_ROOT = 700, DAMP = 0.55, STEP = 1 / 60;
// how much of the length rule's correction becomes speed: all of it makes the tips whip (the
// energy piles up at the end of the chain), none makes them stiff
const KEEP = 0.15;
const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3(), _b = new THREE.Vector3();
const _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _o = new THREE.Vector3(), _d = new THREE.Vector3();
const NO_RIM = { k: 1, dy: 0 }, _r = new THREE.Vector3();
const _m = new THREE.Matrix4(), _strikeCol = new THREE.Color(), _goldenCol = new THREE.Color(0xffc23a);
const Z = new THREE.Vector3(0, 0, 1), X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
// the ring's corners round the unit circle, worked out once (used for initial rest-pose bounds)
const COS = Float64Array.from({ length: RAD }, (_, k) => Math.cos((k / RAD) * Math.PI * 2));
const SIN = Float64Array.from({ length: RAD }, (_, k) => Math.sin((k / RAD) * Math.PI * 2));
// static taper profile along the tentacle, root to tip
const TAPER = Float32Array.from({ length: SEG + 1 }, (_, j) => {
  const s = j / SEG;
  return (1 - 0.72 * s) * (1 + 0.12 * (1 - s) ** 3);
});

// The tentacles' styles (look.tentacles): every ring's shape. bead: every third ring this much
// thicker (beads on a string); wide/thin: the ring stretched one way and pressed the other (a
// ribbon); twist: how far the ring turns from root to tip. Curly also winds the pose (update).
const STYLES = {
  straight: { bead: 1, wide: 1, thin: 1, twist: 0 },
  curly: { bead: 1, wide: 1, thin: 1, twist: 0 },
  beaded: { bead: 2.1, wide: 1, thin: 1, twist: 0 },
  ribbon: { bead: 1, wide: 2.6, thin: 0.3, twist: Math.PI * 3 },
};

// One static BufferGeometry holding all `count` tentacle tubes. Per-vertex `aTentacle` carries
// (tentacleIdx, ringIdx, angleRad) so the vertex shader can skin every ring from uChainTex.
function mergedTubeGeometry(count) {
  const perTent = (SEG + 1) * RAD;
  const totalVerts = count * perTent;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(totalVerts * 3);
  const nor = new Float32Array(totalVerts * 3);
  const att = new Float32Array(totalVerts * 3);
  const idx = [];
  for (let tid = 0; tid < count; tid++) {
    const base = tid * perTent;
    for (let j = 0; j <= SEG; j++) {
      for (let k = 0; k < RAD; k++) {
        const vi = (base + j * RAD + k) * 3;
        att[vi] = tid;
        att[vi + 1] = j;
        att[vi + 2] = (k / RAD) * Math.PI * 2;
      }
    }
    for (let j = 0; j < SEG; j++) {
      for (let k = 0; k < RAD; k++) {
        const a = base + j * RAD + k, b = base + j * RAD + ((k + 1) % RAD), c = a + RAD, d = b + RAD;
        idx.push(a, b, c, b, d, c);
      }
    }
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('aTentacle', new THREE.BufferAttribute(att, 3));
  g.setIndex(idx);
  return g;
}

const TUBE_VERT_COMMON = /* glsl */ `
uniform sampler2D uChainTex;
uniform vec3 uStyle;
uniform vec3 uFloorPlane;
attribute vec3 aTentacle;
varying float vTentacleId;
`;

const TUBE_VERT_NORMAL = /* glsl */ `
vTentacleId = aTentacle.x;
int tId = int(aTentacle.x + 0.5);
int tJ = int(aTentacle.y + 0.5);
vec4 tCur = texelFetch(uChainTex, ivec2(tJ, tId), 0);
vec3 tPrev = texelFetch(uChainTex, ivec2(max(0, tJ - 1), tId), 0).xyz;
vec3 tNext = texelFetch(uChainTex, ivec2(min(${SEG}, tJ + 1), tId), 0).xyz;
vec3 tTan = tNext - tPrev;
float tLenSq = dot(tTan, tTan);
tTan = tLenSq < 1e-10 ? vec3(0.0, -1.0, 0.0) : tTan * inversesqrt(tLenSq);
vec3 tP0 = texelFetch(uChainTex, ivec2(0, tId), 0).xyz;
vec3 tP1 = texelFetch(uChainTex, ivec2(1, tId), 0).xyz;
vec3 tT0 = tP1 - tP0;
float t0LenSq = dot(tT0, tT0);
tT0 = t0LenSq < 1e-10 ? vec3(0.0, -1.0, 0.0) : tT0 * inversesqrt(t0LenSq);
vec3 tRef0 = abs(tT0.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
vec3 tN0 = normalize(cross(tT0, tRef0));
vec3 tN = tN0 - tTan * dot(tN0, tTan);
float tNLenSq = dot(tN, tN);
if (tNLenSq > 1e-5) {
  tN *= inversesqrt(tNLenSq);
} else {
  vec3 tRef = abs(tTan.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  tN = normalize(cross(tTan, tRef));
}
vec3 tB = cross(tTan, tN);
float tAng = aTentacle.z + (float(tJ) / ${SEG}.0) * uStyle.z;
float tC = cos(tAng);
float tS = sin(tAng);
float tR = tCur.w;
vec3 tPos = tCur.xyz + tN * (tC * tR * uStyle.x) + tB * (tS * tR * uStyle.y);
float tFloor = uFloorPlane.x - uFloorPlane.y * tPos.x - uFloorPlane.z * tPos.z;
tPos.y = max(tPos.y, tFloor);
objectNormal = tN * tC + tB * tS;
`;

const GLOW_FRAG_COMMON = /* glsl */ `
uniform vec4 uTentacleGlow[${MAX_TENTACLES}];
varying float vTentacleId;
`;

const GLOW_FRAG_EMISSIVE = /* glsl */ `
vec4 tGlow = uTentacleGlow[clamp(int(vTentacleId + 0.5), 0, ${MAX_TENTACLES - 1})];
totalEmissiveRadiance = mix(totalEmissiveRadiance, tGlow.rgb, tGlow.a);
`;

function patchTubeMaterial(mat, uniforms) {
  mat.customProgramCacheKey = () => 'gpuTentacles';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uChainTex = uniforms.uChainTex;
    shader.uniforms.uStyle = uniforms.uStyle;
    shader.uniforms.uFloorPlane = uniforms.uFloorPlane;
    shader.uniforms.uTentacleGlow = uniforms.uTentacleGlow;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + TUBE_VERT_COMMON)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + TUBE_VERT_NORMAL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = tPos;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLOW_FRAG_COMMON)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + GLOW_FRAG_EMISSIVE);
  };
}

function patchTipMaterial(mat, uniforms) {
  mat.customProgramCacheKey = () => 'gpuTentacleTips';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTentacleGlow = uniforms.uTentacleGlow;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vTentacleId;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvTentacleId = float(gl_InstanceID);\n#else\nvTentacleId = 0.0;\n#endif');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLOW_FRAG_COMMON)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + GLOW_FRAG_EMISSIVE);
  };
}

export class TentacleRig {
  // parent: the group the tentacles hang from (moves and tilts with the bell).
  // opts: { count, radius (anchor ring), y (anchor height), length, thickness, material, angles? (each one's place around the ring),
  //   tipMaterial? (the tip's own colour), tipSize? (the tip's radius, in thicknesses), style? (STYLES) }
  constructor(parent, opts) {
    this.parent = parent;
    this.floorRoot = opts.floorRoot || parent;
    this.count = opts.count;
    this.length = opts.length;
    this.thick = opts.thickness;
    // the Tentacle jelly type (adornments.js barbs): its tentacles drawn longer and thicker
    this.barbed = false;
    this.barbThick = LOOK.num('barbed-tentacle-thickness', 1.8);
    this.barbLength = LOOK.num('barbed-tentacle-length', 1.35);
    // the Wind jelly type (adornments.js gale): its tentacles streaming back as if in a breeze
    this.breeze = false;
    this.breezeStream = LOOK.num('gale-tentacle-stream', 0.3);
    // a striking tentacle swells and burns white-hot so the lash reads at play distance
    this.strikeThick = LOOK.num('lash-strike-thickness', 2.4);
    this.strikeGlow = LOOK.num('lash-strike-glow', 2.6);
    this.strikeColor = new THREE.Color(LOOK.color('lash-strike', '#e9fdff'));
    this.flare = opts.flare ?? 0.3;
    this.style = STYLES[opts.style] ? opts.style : 'straight';
    this.tipSize = opts.tipSize ?? 0.45;
    this.curl = LOOK.num('tentacle-curl', 0.07);
    this.weight = LOOK.num('jelly-motion-weight', 0.6);
    this.alongDrag = LOOK.num('jelly-motion-drag-along', 0.5);
    const kTip = LOOK.num('jelly-motion-tip-spring', 20), drag = LOOK.num('jelly-motion-drag', 7);
    this.compliance = LOOK.num('jelly-motion-bend-compliance', 0.0002);   // bend (XPBD, Macklin 2016)

    // One DataTexture ((SEG + 1) x count, RGBA32F) holds all chains' local points (rgb) and
    // ring radii (a), uploaded once per frame (~2 KB/frame) instead of rebuilding vertices on CPU.
    this.chainData = new Float32Array((SEG + 1) * opts.count * 4);
    this.chainTex = new THREE.DataTexture(this.chainData, SEG + 1, opts.count, THREE.RGBAFormat, THREE.FloatType);
    this.chainTex.minFilter = THREE.NearestFilter;
    this.chainTex.magFilter = THREE.NearestFilter;
    this.chainTex.generateMipmaps = false;
    this.chainTex.needsUpdate = true;

    const st = STYLES[this.style];
    this.glows = Array.from({ length: MAX_TENTACLES }, () => new THREE.Vector4(0, 0, 0, 0));
    this.uniforms = {
      uChainTex: { value: this.chainTex },
      uStyle: { value: new THREE.Vector3(st.wide, st.thin, st.twist) },
      uFloorPlane: { value: new THREE.Vector3(-1e6, 0, 0) },
      uTentacleGlow: { value: this.glows },
    };

    const hasOwnTip = !!opts.tipMaterial && opts.tipMaterial !== opts.material;
    this.tubeMat = opts.material.clone();
    patchTubeMaterial(this.tubeMat, this.uniforms);
    this.tubeMesh = new THREE.Mesh(mergedTubeGeometry(opts.count), this.tubeMat);
    this.tubeMesh.frustumCulled = false;

    this.tipMat = (hasOwnTip ? opts.tipMaterial : opts.material).clone();
    patchTipMaterial(this.tipMat, this.uniforms);
    this.tipMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), this.tipMat, opts.count);
    this.tipMesh.frustumCulled = false;
    // Parent tips under tubeMesh so hiding tubeMesh (e.g. dried-out.js) hides both tubes and tips.
    this.tubeMesh.add(this.tipMesh);
    parent.add(this.tubeMesh);

    const baseEmissive = this.tubeMat.emissive.clone(), baseGlow = this.tubeMat.emissiveIntensity;
    const tipEmissive = this.tipMat.emissive.clone(), tipGlow = this.tipMat.emissiveIntensity;
    const srcMat = opts.material, srcTipMat = opts.tipMaterial || opts.material;

    this.list = [];
    for (let i = 0; i < opts.count; i++) {
      const a = opts.angles?.[i] ?? (i / opts.count) * Math.PI * 2 + Math.PI / opts.count;   // none straight under the face (unless placed)
      const tipPos = new THREE.Vector3();
      const tip = {
        position: tipPos,
        quaternion: new THREE.Quaternion(),
        scale: new THREE.Vector3(1, 1, 1),
        getWorldPosition: (out) => {
          this.parent.updateWorldMatrix(true, false);
          return out.copy(tipPos).applyMatrix4(this.parent.matrixWorld);
        },
      };
      const mat = {
        color: this.tubeMat.color,
        emissive: baseEmissive.clone(),
        emissiveIntensity: baseGlow,
        opacity: this.tubeMat.opacity,
        clone: () => srcMat.clone(),
      };
      const tipMat = hasOwnTip ? {
        color: this.tipMat.color,
        emissive: tipEmissive.clone(),
        emissiveIntensity: tipGlow,
        opacity: this.tipMat.opacity,
        clone: () => srcTipMat.clone(),
      } : mat;
      this.list.push({
        mesh: this.tubeMesh, tip, mat, baseEmissive: baseEmissive.clone(), baseGlow,
        tipMat, tipEmissive: tipEmissive.clone(), tipGlow,
        angle: a, out: new THREE.Vector3(Math.sin(a), 0, Math.cos(a)),
        anchor: new THREE.Vector3(Math.sin(a) * opts.radius, opts.y, Math.cos(a) * opts.radius),
        phase: i * 1.7, pts: Array.from({ length: SEG + 1 }, () => new THREE.Vector3()),
        sim: Array.from({ length: SEG + 1 }, () => new THREE.Vector3()),     // world, in model units
        vel: Array.from({ length: SEG + 1 }, () => new THREE.Vector3()),
        goal: Array.from({ length: SEG + 1 }, () => new THREE.Vector3()),
        aim: null, k: 0, golden: false, impact: 0,
      });
    }
    this.t = 0;
    this.work = 0;                      // chain points stepped in the last update (story engine/jelly-motion-budget)
    this.fresh = true;                  // first frame (or a jump cut): start the chain on its pose
    this.lastRoot = new THREE.Vector3();
    this.inv = new THREE.Matrix4();
    this.tipWorld = new THREE.Matrix4();
    // each point's spring and damping, root to tip
    this.K = Array.from({ length: SEG + 1 }, (_, j) => K_ROOT + (kTip - K_ROOT) * (j / SEG) ** 0.6);
    this.C = this.K.map((k) => Math.max(drag, 2 * DAMP * Math.sqrt(k)));   // across the tentacle
    this._bakeRestGeometry();
  }

  // Populate static position/normal buffers once with the style's rest-pose vertices so bounding
  // boxes and style-shape checks reflect straight/curly/beaded/ribbon without per-frame CPU writes.
  _bakeRestGeometry() {
    const pos = this.tubeMesh.geometry.attributes.position, nor = this.tubeMesh.geometry.attributes.normal;
    const PA = pos.array, NA = nor.array, st = STYLES[this.style], perTent = (SEG + 1) * RAD;
    for (let tid = 0; tid < this.list.length; tid++) {
      const T = this.list[tid], P = T.pts;
      const side = _b.set(T.out.z, 0, -T.out.x);
      for (let j = 0; j <= SEG; j++) {
        const s = j / SEG;
        const p = P[j].copy(T.anchor);
        p.y -= this.length * s;
        p.addScaledVector(T.out, this.flare * s);
        if (this.style === 'curly') {
          const c = this.curl * Math.sqrt(s), a = s * 14 + T.phase;
          p.addScaledVector(T.out, Math.cos(a) * c).addScaledVector(side, Math.sin(a) * c);
        }
        if (p.y < 0.015) p.y = 0.015;
      }
      const base = tid * perTent;
      for (let j = 0; j <= SEG; j++) {
        _t.copy(P[Math.min(SEG, j + 1)]).sub(P[Math.max(0, j - 1)]);
        if (_t.lengthSq() < 1e-10) _t.set(0, -1, 0);
        _t.normalize();
        if (j === 0) _n.crossVectors(_t, Math.abs(_t.z) < 0.9 ? Z : X).normalize();
        else _n.addScaledVector(_t, -_n.dot(_t)).normalize();
        _b.crossVectors(_t, _n);
        const s = j / SEG, r = this.thick * TAPER[j] * (j % 3 === 1 ? st.bead : 1);
        const tw = s * st.twist, tc = Math.cos(tw), ts = Math.sin(tw), Q = P[j];
        const nX = _n.x, nY = _n.y, nZ = _n.z, bX = _b.x, bY = _b.y, bZ = _b.z, rw = r * st.wide, rt = r * st.thin;
        for (let k = 0; k < RAD; k++) {
          const c = COS[k] * tc - SIN[k] * ts, sn = SIN[k] * tc + COS[k] * ts;
          const idx = (base + j * RAD + k) * 3;
          PA[idx] = Q.x + (nX * c * rw + bX * sn * rt);
          PA[idx + 1] = Q.y + (nY * c * rw + bY * sn * rt);
          PA[idx + 2] = Q.z + (nZ * c * rw + bZ * sn * rt);
          NA[idx] = nX * c + bX * sn;
          NA[idx + 1] = nY * c + bY * sn;
          NA[idx + 2] = nZ * c + bZ * sn;
        }
      }
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
  }

  // Direction (world, horizontal) a tentacle's root points out from the body. Used to pick
  // the tentacle facing an enemy.
  worldDir(i, out) {
    this.parent.getWorldQuaternion(_q);
    return out.copy(this.list[i].out).applyQuaternion(_q).setY(0).normalize();
  }

  // Send tentacle i toward a world point. k: 0 = resting, 1 = fully out. null to release.
  aim(i, worldPoint, k = 0, golden = false, impact = 0) {
    const T = this.list[i];
    if (!T) return;
    if (!worldPoint || k === 0) { T.aim = null; T.k = T.impact = 0; return; }
    T.aim = (T.aim || new THREE.Vector3()).copy(worldPoint);
    T.k = k;
    T.golden = golden;
    T.impact = impact;
  }

  // state: { localVel (not read: the chain drags behind on its own), contract (1 = squeezed, 0 = rest, below 0 = relaxed open), rim ({ k: the rim's radius scale, dy: how far it has dropped, in the rig's frame }), vy (m/s) }
  update(dt, state) {
    this.work = 0;
    const rest = state.rest;           // the rest pose (character.js restPose): no clock-driven ripple or flutter
    if (rest) { this.t = 0; this.fresh = true; }
    this.t += dt;
    const L = this.length * (this.barbed ? this.barbLength : 1), contract = state.contract, rim = state.rim || NO_RIM;
    const fall = THREE.MathUtils.clamp(-state.vy * 3, 0, 1);          // falling: stream upward
    const rise = THREE.MathUtils.clamp(state.vy * 3, 0, 1);           // jumping: trail straight down
    this.parent.updateWorldMatrix(true, false);
    const M = this.parent.matrixWorld;
    // world meters per model unit, fixed once (the body's squash and stretch must not move the chain)
    this.unit ||= _s.setFromMatrixScale(M).x || 1;
    const unit = this.unit;
    this.inv.copy(M).invert();
    // a jump cut (respawn, a menu, the first frame): no dragging the tentacles across the room
    _v.setFromMatrixPosition(M).divideScalar(unit);
    if (this.fresh || dt <= 0 || dt > 0.25 || _v.distanceTo(this.lastRoot) > 3) this.fresh = true;
    this.lastRoot.copy(_v);
    const floorY = this.floorRoot.getWorldPosition(_o).y + 0.015 * (1 - fall) * unit;
    const Me = M.elements;
    const m1 = Me[1] / Me[5], m9 = Me[9] / Me[5], m0 = (floorY - Me[13]) / Me[5];
    this.uniforms.uFloorPlane.value.set(m0, m1, m9);
    const st = STYLES[this.style];
    this.uniforms.uStyle.value.set(st.wide, st.thin, st.twist);

    for (let tid = 0; tid < this.list.length; tid++) {
      const T = this.list[tid];
      // --- the pose the chain is pulled toward: hang close under the bell (a lean jelly),
      // flaring a little as the bell relaxes and pulling in on the power stroke, the roots
      // riding the bell's rim as it flexes (state.rim: how far in it pulls, how far it drops);
      // the softer springs down the chain turn each squeeze into a wave running down to the tip
      const flare = this.flare - 0.09 * contract - 0.06 * rise;
      const side = _b.set(T.out.z, 0, -T.out.x);
      for (let j = 0; j <= SEG; j++) {
        const s = j / SEG, s15 = s ** 1.5;
        const p = T.goal[j].copy(T.anchor);
        p.x *= rim.k; p.z *= rim.k; p.y += rim.dy;
        p.y -= L * s * (1 - 0.55 * fall);
        p.addScaledVector(T.out, flare * s);
        if (this.style === 'curly') { const c = this.curl * Math.sqrt(s), a = s * 14 + T.phase; p.addScaledVector(T.out, Math.cos(a) * c).addScaledVector(side, Math.sin(a) * c); }
        if (this.breeze) {   // streaming back (the model faces +z), fluttering a little
          p.z -= L * this.breezeStream * s15 * (1 + (rest ? 0 : 0.2 * Math.sin(this.t * 3.1 + T.phase)));
          p.x += rest ? 0 : L * this.breezeStream * 0.12 * s * Math.sin(this.t * 2.3 + T.phase * 1.3);
          p.y += L * this.breezeStream * 0.25 * s15;
        }
        p.y += fall * 0.35 * s15;
        p.y = Math.max(p.y, 0.015 * (1 - fall));                       // don't reach into the floor
        p.applyMatrix4(M).divideScalar(unit);                           // to world, in model units
      }
      if (this.fresh) for (let j = 0; j <= SEG; j++) { T.sim[j].copy(T.goal[j]); T.vel[j].set(0, 0, 0); }

      // --- the chain: root pinned under the bell, each point sprung toward its pose, sinking a
      // little and dragged by the still water (across twice as hard as along), then kept from
      // folding sharper than its pose and kept its length from the one above (follow the leader)
      const n = Math.min(6, Math.max(1, Math.round(dt / STEP))), h = dt / n;
      if (!this.fresh) {
        this.work += n * SEG;
        const slip = 1 - this.alongDrag, sink = this.weight * h, bend = 1 / (1 + this.compliance / (h * h));   // share of a fold undone per substep
        const segLen = T.segLen || (T.segLen = new Float32Array(SEG + 1)), bendLen = T.bendLen || (T.bendLen = new Float32Array(SEG + 1));
        for (let j = 1; j <= SEG; j++) {
          segLen[j] = T.goal[j].distanceTo(T.goal[j - 1]);
          if (j > 1) bendLen[j] = T.goal[j].distanceTo(T.goal[j - 2]);
        }
        for (let it = 0; it < n; it++) stepChain(T.sim, T.vel, T.goal, this.K, this.C, h, slip, sink, bend, KEEP, undefined, segLen, bendLen);
      }
      // back to the parent's frame (drawn off the floor; the chain itself just swings back up)
      const floor = 0.015 * (1 - fall);
      for (let j = 0; j <= SEG; j++) {
        const p = T.pts[j].copy(T.sim[j]).multiplyScalar(unit).applyMatrix4(this.inv);
        if (p.y < floor) p.y = floor;
      }

      // --- striking: a whip arc from the root out to the target, blended over the chain (which
      // follows it, so the tentacle swings back on its own when the strike ends)
      const glow = T.baseGlow;
      const gVec = tid < MAX_TENTACLES ? this.glows[tid] : null;
      if (T.aim) {
        const target = this.parent.worldToLocal(_v.copy(T.aim));
        if (T.k < 0) {
          // Draw the resting tip away from the target, gathering tension before the snap.
          _d.copy(target).sub(T.anchor).normalize();
          for (let j = 1; j <= SEG; j++) {
            const w = (j / SEG) ** 2 * -T.k;
            T.pts[j].addScaledVector(_d, -w * 0.3).y += w * 0.18;
            T.pts[j].y = Math.max(floor, T.pts[j].y);
          }
          if (gVec) gVec.set(0, 0, 0, 0);
          this.writeChain(tid, T, floorY, Me);
          continue;
        }
        _r.set(T.anchor.x * rim.k, T.anchor.y + rim.dy, T.anchor.z * rim.k);   // the root rides the rim, as the chain's does
        const end = _t.copy(_r).lerp(target, T.k);
        const dist = end.distanceTo(_r);
        const ctrl = _n.copy(_r).add(end).multiplyScalar(0.5).addScaledVector(T.out, dist * 0.25);
        ctrl.y += dist * 0.25;
        const w = Math.min(1, T.k * 2);
        for (let j = 0; j <= SEG; j++) {
          const s = j / SEG, u = 1 - s;
          const bx = u * u * _r.x + 2 * u * s * ctrl.x + s * s * end.x;
          const by = u * u * _r.y + 2 * u * s * ctrl.y + s * s * end.y;
          const bz = u * u * _r.z + 2 * u * s * ctrl.z + s * s * end.z;
          T.pts[j].lerp(_v.set(bx, by, bz), w);
          T.sim[j].copy(T.pts[j]).applyMatrix4(M).divideScalar(unit);
        }
        _strikeCol.copy(T.golden ? _goldenCol : this.strikeColor);
        const strikeGlow = 0.6 + T.k * (this.strikeGlow - 0.6);
        T.mat.emissive.copy(_strikeCol);
        T.mat.emissiveIntensity = strikeGlow;
        if (T.tipMat !== T.mat) { T.tipMat.emissive.copy(_strikeCol); T.tipMat.emissiveIntensity = strikeGlow; }
        if (gVec) gVec.set(_strikeCol.r * strikeGlow, _strikeCol.g * strikeGlow, _strikeCol.b * strikeGlow, 1);
      } else {
        T.mat.emissive.copy(T.baseEmissive);
        T.mat.emissiveIntensity = glow;
        if (T.tipMat !== T.mat) { T.tipMat.emissive.copy(T.tipEmissive); T.tipMat.emissiveIntensity = T.tipGlow * glow / T.baseGlow; }
        if (gVec) gVec.set(0, 0, 0, 0);
      }
      this.writeChain(tid, T, floorY, Me);
    }
    this.chainTex.needsUpdate = true;
    this.tipMesh.instanceMatrix.needsUpdate = true;
    this.fresh = false;
  }

  // start the chains on their pose next frame (after a teleport)
  reset() { this.fresh = true; }

  // Pack one tentacle's chain points + ring radii into chainData and update its tip instance matrix.
  writeChain(tid, T, floorY, M) {
    const thick = this.thick * (this.barbed ? this.barbThick : 1) * (T.aim && T.k > 0 ? 1 + (this.strikeThick - 1) * T.k : 1);
    const P = T.pts, st = STYLES[this.style], data = this.chainData;
    const rowBase = tid * (SEG + 1) * 4;
    for (let j = 0; j <= SEG; j++) {
      const Q = P[j], off = rowBase + j * 4;
      data[off] = Q.x;
      data[off + 1] = Q.y;
      data[off + 2] = Q.z;
      data[off + 3] = thick * TAPER[j] * (j % 3 === 1 ? st.bead : 1);
    }
    T.tip.position.copy(P[SEG]);
    T.tip.scale.setScalar(thick * this.tipSize);
    if (T.impact > 0) {
      T.tip.quaternion.setFromUnitVectors(Y, _t.copy(P[SEG]).sub(P[SEG - 1]).normalize());
      T.tip.scale.multiply(_s.set(1 + T.impact * 1.8, 1 - T.impact * 0.65, 1 + T.impact * 1.8));
    } else {
      T.tip.quaternion.identity();
    }
    _m.compose(T.tip.position, T.tip.quaternion, T.tip.scale);
    const W = this.tipWorld.multiplyMatrices(this.parent.matrixWorld, _m).elements;
    const tipFloor = (floorY + Math.hypot(W[1], W[5], W[9]) - M[1] * T.tip.position.x - M[9] * T.tip.position.z - M[13]) / M[5];
    if (T.tip.position.y < tipFloor) {
      T.tip.position.y = tipFloor;
      _m.setPosition(T.tip.position);
    }
    this.tipMesh.setMatrixAt(tid, _m);
  }

  dispose() {
    this.tubeMesh.geometry.dispose();
    this.tubeMat.dispose();
    this.tipMesh.geometry.dispose();
    this.tipMat.dispose();
    this.chainTex.dispose();
  }
}
