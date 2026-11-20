// The stage the pick screen's centre card films its attack on (attack-preview.js): deep water to
// reflect in the bell's clear coat, a soft key, a dim fill, a rim in the type's colour, one light in
// the type's colour at the attack that flares with each shot and hit, a glossy floor with soft
// shadows under the jelly and its roaches, and a backdrop of deep water with slow light shafts and
// drifting specks. The attack stays the brightest thing on it.
//
// Lights are made once and only change colour, so changing type never builds a shader. Nothing here
// is used in play.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { juice } from './juice.js';

const col = (name, fallback) => new THREE.Color(LOOK.color(name, fallback));

// a soft round spot, white in the middle and nothing at the edge: the alpha of the floor and its shadows
function spot() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (let i = 0; i <= 8; i++) { const v = Math.round(255 * (1 - i / 8) ** 2); grad.addColorStop(i / 8, `rgb(${v},${v},${v})`); }   // eases out to nothing
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// What the bell reflects: water lighter toward the surface overhead, with a bright patch of surface
// light above and a pale panel on the key's side, so the clear coat shows a window and a glint
function waterEnvironment(renderer) {
  const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
  const c = document.createElement('canvas'); c.width = 16; c.height = 128;
  const g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 128);
  [[0, '#dff8ff'], [0.2, LOOK.color('menu-water-glow', '#70ddc7')], [0.45, LOOK.color('menu-water-shallow', '#175c70')], [1, LOOK.color('menu-water-deep', '#06162e')]]
    .forEach(([s, v]) => grad.addColorStop(s, v));
  g.fillStyle = grad; g.fillRect(0, 0, 16, 128);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 12), new THREE.MeshBasicMaterial({ map, side: THREE.BackSide }));
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#eaf9ff').multiplyScalar(2) }));
  panel.position.set(-2.2, 2.4, 2.6); panel.lookAt(0, 0, 0);
  es.add(sky, panel);
  const env = pm.fromScene(es, 0.02);
  pm.dispose();
  es.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
  return env;
}

// The water behind: deep, lighter above, graded toward the type's colour low in the middle, with
// slow slanted shafts of light from the surface. Drawn first, behind everything, over the whole picture.
function backdrop() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uDeep: { value: col('menu-water-deep', '#06162e') }, uShallow: { value: col('menu-water-shallow', '#175c70') },
      uTint: { value: new THREE.Color() }, uGrade: { value: new THREE.Color(1, 1, 1) }, uTintK: { value: LOOK.num('preview-backdrop-tint', 1) },
      uShafts: { value: LOOK.num('preview-shafts', 0.5) }, uBright: { value: LOOK.num('preview-backdrop', 0.5) }, uTime: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uDeep, uShallow, uTint, uGrade;
      uniform float uTintK, uShafts, uBright, uTime;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv;
        vec3 c = mix(uDeep, uShallow, smoothstep(0.05, 1.1, p.y) * 0.75);
        float low = (1.0 - p.y) * (1.0 - smoothstep(0.1, 0.65, abs(p.x - 0.5)));
        c += uTint * uTintK * low * 0.03;
        float s = 0.0;
        for (int i = 0; i < 3; i++) {
          float f = float(i);
          float x = p.x + (1.0 - p.y) * 0.32 - (0.18 + 0.27 * f) - 0.035 * sin(uTime * (0.19 + 0.06 * f) + f * 2.1);
          s += exp(-x * x * (260.0 - 60.0 * f)) * (0.65 + 0.35 * sin(uTime * (0.31 + 0.05 * f) + f * 1.7));
        }
        c += mix(uShallow, vec3(0.75, 0.95, 1.0), 0.35) * s * uShafts * smoothstep(0.15, 1.0, p.y);
        c *= 1.0 - 0.5 * smoothstep(0.32, 0.78, length((p - 0.5) * vec2(1.0, 1.1)));
        gl_FragColor = vec4(c * uGrade * uBright, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

const SPECKS = 36;
const _p = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

export class PickStage {
  constructor(scene, renderer) {
    this.scene = scene;
    this.reflect(renderer);
    scene.environmentIntensity = LOOK.num('preview-environment', 0.6);
    // a fixed set of lights for the stage's whole life: changing type changes their colours only
    const fill = new THREE.HemisphereLight(LOOK.color('menu-water-glow', '#70ddc7'), LOOK.color('menu-water-deep', '#06162e'), LOOK.num('preview-fill', 0.9));
    const key = new THREE.DirectionalLight('#e8f8ff', LOOK.num('preview-key', 2.4)); key.position.set(-1, 2, 1.5);
    this.rim = new THREE.DirectionalLight('#fff', LOOK.num('preview-rim', 2.5)); this.rim.position.set(0.7, 0.9, -1.6);
    this.glow = new THREE.PointLight('#fff', 0, 0, 2);
    scene.add(fill, key, this.rim, this.glow);
    this.back = backdrop();
    // a glossy floor that catches the attack's light and the water's sheen, fading to nothing at its edges
    const fade = spot();
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({
      color: LOOK.color('preview-floor', '#0b2a3a'), roughness: LOOK.num('preview-floor-roughness', 0.62), metalness: 0,
      envMapIntensity: LOOK.num('preview-floor-sheen', 0.25), alphaMap: fade, transparent: true, opacity: LOOK.num('preview-floor-opacity', 0.7), depthWrite: false }));
    this.floor.renderOrder = -2;
    // soft contact shadows: the jelly's, then a roach's each (one draw)
    this.shadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      color: 0x000000, alphaMap: spot(), transparent: true, opacity: LOOK.num('preview-shadow', 0.6), depthWrite: false }), 4);
    this.shadows.renderOrder = -1;
    this.shadows.frustumCulled = false;
    scene.add(this.back, this.floor, this.shadows);
    // specks drifting up through the water, half far behind the fight and half nearer the camera
    this.specks = Array.from({ length: SPECKS }, (_, i) => ({ x: Math.random(), y: Math.random(), near: i % 2, rise: 0.012 + Math.random() * 0.018, sway: Math.random() * 6.28, s: 0.6 + Math.random() * 0.8 }));
    this.speckColor = new THREE.Color();
    this.mid = new THREE.Vector3();
    this.t = 0; this.k = 0;
  }

  // what the bell reflects, drawn on the GPU: made again after the screen has freed it (unreflect) or
  // the graphics chip was reset (it's a picture drawn once, which a reset loses)
  reflect(renderer) {
    this.unreflect();
    this.env = waterEnvironment(renderer);
    this.scene.environment = this.env.texture;
  }
  unreflect() { this.env?.dispose(); this.env = null; }

  // the type's colour: the rim, the attack's light, the water low behind and the specks; `grade`
  // shifts the whole water toward the type's own (--preview-grade-<id> in look.css; white: as it is)
  setType(color, grade = '#ffffff') {
    this.rim.color.set(color);
    this.glow.color.set(color);
    this.back.material.uniforms.uTint.value.set(color);
    this.back.material.uniforms.uGrade.value.set(grade);
    this.speckColor.set(LOOK.color('menu-water-glow', '#70ddc7')).lerp(new THREE.Color(color), 0.4);
  }

  // where the fight is: the floor and the specks centre on it
  place(mid) {
    this.mid.copy(mid);
    this.floor.position.set(mid.x, 0, mid.z);
  }

  // a shot or a hit at `pos`: the attack's light jumps there and flares
  flash(pos, k = 1) {
    this.glow.position.copy(pos);
    this.k = Math.max(this.k, k);
  }

  // one frame: the attack light fades, the shadows follow the jelly and the roaches, the specks drift
  // (each held as a faint glow in the preview's own GlowPoints: no draw of their own)
  frame(dt, P) {
    this.t += dt;
    this.k *= Math.exp(-dt * LOOK.num('preview-attack-light-fade', 12));
    this.glow.intensity = this.k * LOOK.num('preview-attack-light', 0.002);
    this.back.material.uniforms.uTime.value = this.t;
    const sh = this.shadows, H = P.avatar ? P.player.position : null;
    const put = (i, x, z, w) => { sh.setMatrixAt(i, _m.compose(_p.set(x, 0.0004, z), _q, _s.set(w, 1, w))); };
    put(0, H?.x || 0, H?.z || 0, LOOK.num('preview-shadow-jelly', 0.11));
    for (let i = 0; i < 3; i++) {
      const b = P.enemies.list[i];
      put(i + 1, b?.pos.x || 0, b?.pos.z || 0, b && !b.dead ? b.r * 3.2 : 0);
    }
    sh.instanceMatrix.needsUpdate = true;
    const m = this.mid, a = LOOK.num('preview-specks', 0.22), t = juice.calm ? 0 : this.t;
    for (const s of this.specks) {
      const y = (s.y + t * s.rise) % 1;
      _p.set(m.x + (s.x - 0.5) * (s.near ? 0.34 : 0.7) + 0.01 * Math.sin(t * 0.4 + s.sway), 0.01 + y * 0.3, m.z + (s.near ? 0.15 : -0.22 - s.x * 0.15));
      P.fx.glow.hold(_p, this.speckColor, (s.near ? 0.005 : 0.0028) * s.s, a * Math.sin(Math.PI * y) * (s.near ? 0.6 : 1));
    }
  }
}
