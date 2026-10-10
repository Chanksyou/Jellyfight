// PROTOTYPE (throwaway, lives on the prototype/3d-warnings branch, never main): three looks for
// the see-through volume a Warning adds over its floor shape (docs/adr/0001-warnings-show-volume.md).
// Open index.html?story=prototype/3d-warnings&variant=A|B|C; the bar at the bottom (or ← →) flips.
//   A  hex shell:   the force field's hex grid on the surface, filling as a band rising from the floor
//   B  soft bubble: a faint tinted shell, with a glowing core growing from the middle out
//   C  bright rim:  only the outline glows (clear middle), a bright ring sweeps up to the hit
// Each shows four real-size attacks: the Mug's coffee Blast (4.5 cm), a big floor Blast (12 cm,
// like the Controller's rumble), a mid-air Blast (the Whipper's balloon) and a 3 cm high lane (the Clog's lash).
import * as THREE from 'three';
import { TeleMaterial, hostile } from './vfx.js';

const VARIANTS = { A: 'Hex shell', B: 'Soft bubble', C: 'Bright rim' };
const CYCLE = 2.2, FILL = 1.7;   // seconds: a Warning fills for FILL, then the hit, then again

const vert = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vLocal, vWorld, vN;
  void main() {
    vLocal = position;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
    #include <logdepthbuf_vertex>
  }`;
const frag = /* glsl */`
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uColor; uniform float uProgress, uTime, uVariant, uKind, uHit, uCore;
  varying vec3 vLocal, vWorld, vN;
  float hex(vec2 p) {                       // distance to the nearest hex cell edge (0 on the line)
    p *= vec2(1.0, 1.1547);
    vec2 a = mod(p, vec2(1.0, 1.732)) - vec2(0.5, 0.866), b = mod(p - vec2(0.5, 0.866), vec2(1.0, 1.732)) - vec2(0.5, 0.866);
    vec2 g = dot(a, a) < dot(b, b) ? a : b;
    g = abs(g);
    return 0.5 - max(dot(g, normalize(vec2(1.0, 1.732))), g.x);
  }
  void main() {
    #include <logdepthbuf_fragment>
    // how far up the volume this point is, 0 at the bottom, 1 at the top
    float h = uKind < 0.5 ? vLocal.y : uKind < 1.5 ? vLocal.y * 0.5 + 0.5 : vLocal.y + 0.5;
    vec3 view = normalize(cameraPosition - vWorld);
    float facing = abs(dot(normalize(vN), view));
    float rim = pow(1.0 - facing, 2.0);
    if (uKind > 1.5) {                       // a lane (a box): its edges are its outline
      vec3 q = abs(vLocal) * 2.0;           // 1 on a face; an edge is where a second axis is near 1 too
      float mid = q.x + q.y + q.z - max(q.x, max(q.y, q.z)) - min(q.x, min(q.y, q.z));
      rim = max(rim * 0.5, smoothstep(0.8, 1.0, mid));
    }
    float a = 0.0; vec3 col = uColor;
    if (uVariant < 0.5) {                    // A: hex shell, a band rising from the floor
      float lines = 1.0 - smoothstep(0.0, 0.07, hex(vWorld.xz * 90.0 + vec2(vWorld.y * 90.0, 0.0)));
      float filled = step(h, uProgress), front = smoothstep(0.08, 0.0, abs(h - uProgress));
      a = lines * (0.18 + filled * 0.55) + front * 0.8 + rim * 0.25 + filled * 0.08;
    } else if (uVariant < 1.5) {             // B: soft bubble, a core that grows from the middle
      a = uCore > 0.5 ? 0.35 + rim * 0.3 : 0.07 + rim * 0.35 + uProgress * 0.12;
    } else {                                 // C: bright rim, clear middle, a ring sweeping up
      float ring = smoothstep(0.05, 0.0, abs(h - uProgress));
      a = rim * (0.55 + uProgress * 0.45) + ring * 0.9;
    }
    a = clamp(a + uHit * 0.6, 0.0, 1.0);
    col = col * (1.0 + a * 0.6) + vec3(uHit * 0.4);
    gl_FragColor = vec4(col * a * 1.5, a);
  }`;

function volumeMat(color, variant, kind, core = false) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color.clone() }, uProgress: { value: 0 }, uTime: { value: 0 }, uVariant: { value: 'ABC'.indexOf(variant) }, uKind: { value: kind }, uHit: { value: 0 }, uCore: { value: core ? 1 : 0 } },
    vertexShader: vert, fragmentShader: frag,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}

// geometry: unit shapes, scaled per attack (kind 0 dome, 1 sphere, 2 lane)
const GEO = [
  new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  new THREE.SphereGeometry(1, 28, 16),
  new THREE.BoxGeometry(1, 1, 1),
];

export function start({ scene, player, tpc, fx }) {
  const params = new URLSearchParams(location.search);
  let variant = VARIANTS[params.get('variant')] ? params.get('variant') : 'A';
  const P = player.position.clone();
  const fwd = P.clone().sub(tpc.camera.position).setY(0).normalize(), side = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const at = (f, s, up = 0) => P.clone().addScaledVector(fwd, f).addScaledVector(side, s).setY(P.y + up);
  const attacks = [
    { name: 'coffee', kind: 0, color: hostile('mug'), pos: at(0.22, -0.16), r: 0.045 },
    { name: 'rumble', kind: 0, color: hostile('controller'), pos: at(0.34, 0.02), r: 0.12 },
    { name: 'balloon', kind: 1, color: hostile('whipper'), pos: at(0.2, 0.2, 0.12), r: 0.07, floor: P.y },
    { name: 'lash', kind: 2, color: hostile('clog'), pos: at(0.12, 0.02), size: [0.035, 0.03, 0.32] },
  ];
  const group = new THREE.Group();
  scene.add(group);
  const build = () => {
    group.clear();
    for (const A of attacks) {
      A.vol = new THREE.Mesh(GEO[A.kind], volumeMat(A.color, variant, A.kind));
      A.vol.position.copy(A.pos);
      if (A.kind === 2) { A.vol.scale.set(...A.size); A.vol.position.y += A.size[1] / 2; A.vol.lookAt(A.vol.position.clone().add(side)); }
      else A.vol.scale.setScalar(A.r);
      A.vol.renderOrder = 4;
      group.add(A.vol);
      A.core = null;
      if (variant === 'B' && A.kind < 2) { A.core = new THREE.Mesh(GEO[A.kind], volumeMat(A.color, variant, A.kind, true)); A.core.position.copy(A.pos); A.core.renderOrder = 5; group.add(A.core); }
      // the floor shape, as today (TeleMaterial): a circle under a Blast, a strip under a lane
      const flat = A.kind === 2 ? new THREE.PlaneGeometry(1, 1) : new THREE.CircleGeometry(1, 40);
      A.warn = new THREE.Mesh(flat, new TeleMaterial(A.color, A.kind === 2 ? 'strip' : 'circle'));
      A.warn.rotation.x = -Math.PI / 2;
      A.warn.position.copy(A.pos).setY((A.floor ?? A.pos.y) + 0.002);
      if (A.kind === 2) { A.warn.scale.set(A.size[0] * 1.2, A.size[2], 1); A.warn.rotation.z = Math.atan2(side.x, side.z); }
      else A.warn.scale.setScalar(A.r);
      A.warn.renderOrder = 3;
      group.add(A.warn);
    }
  };
  build();

  // the switcher: obviously not part of the game (prototype only)
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:40;display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:999px;background:#fff;color:#111;font:600 15px system-ui;box-shadow:0 4px 18px #000a;user-select:none';
  bar.innerHTML = '<button data-d="-1">◀</button><span></span><button data-d="1">▶</button>';
  bar.querySelectorAll('button').forEach((b) => { b.style.cssText = 'border:0;background:#111;color:#fff;border-radius:999px;width:40px;height:40px;font-size:16px;cursor:pointer'; });
  const label = bar.querySelector('span');
  const show = () => { label.textContent = `${variant} (${VARIANTS[variant]})`; params.set('variant', variant); history.replaceState(null, '', '?' + params); };
  const go = (d) => { const k = Object.keys(VARIANTS); variant = k[(k.indexOf(variant) + d + k.length) % k.length]; build(); show(); };
  bar.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) go(+b.dataset.d); });
  addEventListener('keydown', (e) => { if (e.target.closest?.('input, textarea, [contenteditable]')) return; if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1); });
  document.body.appendChild(bar);
  show();

  // every CYCLE seconds: fill, hit, again
  let fired = false;
  const tick = () => {
    const t = (performance.now() / 1000) % CYCLE, k = Math.min(1, t / FILL), hit = t > FILL ? 1 - (t - FILL) / (CYCLE - FILL) : 0;
    if (t < FILL) fired = false;
    for (const A of attacks) {
      const u = A.vol.material.uniforms;
      u.uProgress.value = k; u.uHit.value = hit; u.uTime.value = t;
      A.warn.material.progress = k;
      if (A.core) { A.core.scale.setScalar(A.r * Math.max(0.001, k)); A.core.material.uniforms.uProgress.value = k; A.core.material.uniforms.uHit.value = hit; }
      if (hit > 0 && !fired) fx.impact(A.kind === 0 ? A.pos.clone().setY(A.pos.y + 0.01) : A.vol.position, A.color, (A.r || 0.03) * 0.6, 10);
    }
    if (hit > 0) fired = true;
    requestAnimationFrame(tick);
  };
  tick();
}
