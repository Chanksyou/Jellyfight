// Act 2's bathtub, dressed after the real one: white stacked-subway tile on the two walls round
// the tub, a pink-and-white striped non-slip mat on the tub floor and a domed chrome drain stopper,
// brushed-steel fittings on the end wall (the spout, the round thermostat plate with two knobs,
// the slide rail with its hand shower and coiled hose, the hose outlet), the overflow plate and the
// grey hose running over the rim, a smiley scrub sponge and two Pantene bottles on the rim
// corners, and a black wire caddy on the back wall with its bottles and a loofah hanging off it.
// Decoration only: none of it collides. Added by main.js when the stage asks for it.
//
// Tub (world meters): inside floor y 0.15, rim y 0.55; the end wall (with the drain below it) at
// x 0.057, the back wall at z 7.901; the tub runs x 0.06-1.62, z 7.15-7.89.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tex = (w, h, paint, rx = 1, ry = 1) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
  return t;
};

// stacked subway tile: long white tiles, warm grout, a little variation tile to tile
const tileTex = (rx, ry) => tex(256, 256, (g, w, h) => {
  g.fillStyle = '#ddd2c0'; g.fillRect(0, 0, w, h);                       // grout
  const rows = 8, cols = 2, gw = 2;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const v = 238 + Math.random() * 12;
    g.fillStyle = `rgb(${v},${v - 3},${v - 9})`;
    g.fillRect(c * w / cols + gw / 2, r * h / rows + gw / 2, w / cols - gw, h / rows - gw);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(c * w / cols + 6, r * h / rows + 4, w / cols - 30, 3);   // glaze highlight
  }
}, rx, ry);

export function addBathroomDetails(scene) {
  const g = new THREE.Group();
  g.name = 'Bathroom details';
  const add = (geo, mat, at, rot) => { const m = new THREE.Mesh(geo, mat); if (at) m.position.copy(at); if (rot) m.rotation.set(...rot); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const steel = new THREE.MeshStandardMaterial({ color: 0xe4e6ea, metalness: 0.45, roughness: 0.3, emissive: 0x3a3c40, emissiveIntensity: 0.4 });   // brushed steel: kept bright in the dark room
  const black = new THREE.MeshStandardMaterial({ color: 0x141416, metalness: 0.4, roughness: 0.4 });
  const wood = new THREE.MeshStandardMaterial({ color: 0xc8a070, roughness: 0.6 });

  // --- tile on the walls round the tub (just off the wall so it doesn't flicker)
  const tile = (w, h) => new THREE.MeshStandardMaterial({ map: tileTex(w / 0.3, h / 0.075 / 8), roughness: 0.25, emissive: 0xfff4e6, emissiveIntensity: 0.16 });   // glazed white tile still reads white at night
  add(new THREE.PlaneGeometry(1.56, 1.9), tile(1.56, 1.9), V(0.84, 0.55 + 0.95, 7.899), [0, Math.PI, 0]);             // back wall
  add(new THREE.PlaneGeometry(0.74, 1.9), tile(0.74, 1.9), V(0.059, 0.55 + 0.95, 7.525), [0, Math.PI / 2, 0]);        // end wall

  // --- the non-slip mat: pink and white stripes, with the drain cut-out circle near its end
  const mat = tex(512, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let k = 0; k < 40; k++) { c.fillStyle = k % 2 ? 'rgba(255,255,255,.95)' : `rgba(${226 + Math.random() * 14},${180 + Math.random() * 20},${200 + Math.random() * 16},.92)`; c.fillRect(k * w / 40, 0, w / 40, h); }
    c.fillStyle = 'rgba(255,255,255,.95)'; for (const y of [0.33, 0.66]) c.fillRect(0, y * h, w, 3);
  });
  add(new THREE.PlaneGeometry(0.8, 0.42).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: mat, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -1 }), V(0.86, 0.1515, 7.53));
  // the drain stopper: a domed brushed-steel cap
  add(new THREE.SphereGeometry(0.03, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.3, 1), steel, V(0.3, 0.1505, 7.53));
  add(new THREE.RingGeometry(0.03, 0.045, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.4 }), V(0.3, 0.1508, 7.53));

  // --- fittings on the end wall (x 0.057), facing +x
  const onWall = (m) => { m.rotation.z = -Math.PI / 2; return m; };                                 // cylinders out of the wall
  // the spout, sticking out over the drain
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 24), steel, V(0.061, 0.64, 7.48), [0, 0, -Math.PI / 2]);
  const spout = add(new THREE.CylinderGeometry(0.013, 0.013, 0.17, 20), steel, V(0.14, 0.64, 7.48));
  onWall(spout);
  add(new THREE.CircleGeometry(0.012, 16), new THREE.MeshBasicMaterial({ color: 0x202020 }), V(0.226, 0.633, 7.48), [Math.PI / 2, 0, 0]);   // its mouth
  // the thermostat: a round plate with two knobs
  add(new THREE.CylinderGeometry(0.085, 0.085, 0.006, 40), steel, V(0.06, 0.7, 7.72), [0, 0, -Math.PI / 2]);
  for (const [y, z] of [[0.735, 7.715], [0.66, 7.73]]) {
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 20), steel, V(0.088, y, z), [0, 0, -Math.PI / 2]);
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 20), steel, V(0.115, y, z), [0, 0, -Math.PI / 2]);
  }
  // the slide rail with its two wall brackets, the hand shower parked in it, the outlet and hose
  add(new THREE.CylinderGeometry(0.0085, 0.0085, 0.7, 16), steel, V(0.1, 1.38, 7.56));
  for (const y of [1.08, 1.68]) { add(new THREE.CylinderGeometry(0.028, 0.028, 0.006, 24), steel, V(0.06, y, 7.56), [0, 0, -Math.PI / 2]); add(new THREE.CylinderGeometry(0.006, 0.006, 0.04, 8), steel, V(0.08, y, 7.56), [0, 0, -Math.PI / 2]); }
  add(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 16), steel, V(0.1, 1.52, 7.56));               // the slider
  add(new THREE.CylinderGeometry(0.012, 0.011, 0.24, 16), steel, V(0.1, 1.64, 7.505));              // the hand shower
  add(new THREE.CylinderGeometry(0.022, 0.022, 0.006, 24), steel, V(0.06, 1.3, 7.4), [0, 0, -Math.PI / 2]);   // the hose outlet
  const hose = new THREE.CatmullRomCurve3([V(0.08, 1.3, 7.4), V(0.12, 1.1, 7.38), V(0.16, 0.88, 7.46), V(0.14, 0.9, 7.52), V(0.11, 1.2, 7.52), V(0.1, 1.52, 7.505)]);
  add(new THREE.TubeGeometry(hose, 60, 0.0055, 6), new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 0.85, roughness: 0.35 }));
  // the overflow plate on the tub's inside end, and the grey hose from it over the front rim
  add(new THREE.CylinderGeometry(0.032, 0.032, 0.006, 32), steel, V(0.13, 0.43, 7.5), [0, 0, -Math.PI / 2 + 0.35]);
  const grey = new THREE.CatmullRomCurve3([V(0.14, 0.43, 7.5), V(0.2, 0.47, 7.35), V(0.32, 0.555, 7.2), V(0.6, 0.57, 7.17), V(0.9, 0.53, 7.1), V(1.0, 0.3, 7.05)]);
  add(new THREE.TubeGeometry(grey, 50, 0.007, 6), new THREE.MeshStandardMaterial({ color: 0xc8cacc, roughness: 0.6 }));

  // --- on the rim: the smiley scrub sponge, and the two Pantene bottles
  const sponge = new THREE.Group();
  sponge.position.set(0.11, 0.55, 7.85);
  g.add(sponge);
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.037, 0.03, 28), new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 1 }));
  sp.position.y = 0.015; sp.rotation.x = -0.25; sp.castShadow = true; sponge.add(sp);
  const face = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.CircleGeometry(0.004, 10), face); e.position.set(s * 0.011, 0.024, 0.04); sponge.add(e); }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0022, 6, 16, Math.PI), face);
  smile.position.set(0, 0.016, 0.04); smile.rotation.z = Math.PI; sponge.add(smile);
  sponge.rotation.y = 0.9;
  const bottle = (at, body, cap, label, h = 0.22) => {
    const b = new THREE.Group();
    b.position.copy(at);
    g.add(b);
    const lab = tex(128, 256, label);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.038, h, 24), [new THREE.MeshStandardMaterial({ map: lab, roughness: 0.3 }), new THREE.MeshStandardMaterial({ color: body, roughness: 0.3 }), new THREE.MeshStandardMaterial({ color: body, roughness: 0.3 })]);
    m.position.y = h / 2; m.castShadow = true; b.add(m);
    const pump = new THREE.MeshStandardMaterial({ color: cap, roughness: 0.4 });
    for (const [geo, y] of [[new THREE.CylinderGeometry(0.02, 0.03, 0.025, 20), h + 0.012], [new THREE.CylinderGeometry(0.006, 0.006, 0.035, 10), h + 0.04], [new THREE.BoxGeometry(0.014, 0.012, 0.05), h + 0.06]]) { const p = new THREE.Mesh(geo, pump); p.position.y = y; if (y > h + 0.05) p.position.z = 0.015; b.add(p); }
    return b;
  };
  bottle(V(1.56, 0.55, 7.85), 0xf2ecd8, 0xd8b878, (c, w, h) => {                                        // Pantene conditioner: gold
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#d8b06a'); gr.addColorStop(0.45, '#f4ead6'); gr.addColorStop(1, '#fbf6ec');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = '#5a4020'; c.font = 'bold 18px Georgia'; c.textAlign = 'center'; c.fillText('PANTENE', w / 2, h * 0.42);
    c.font = 'bold 40px Georgia'; c.fillStyle = '#c8962a'; c.fillText('10', w / 2, h * 0.58);
  }).rotation.y = -2.3;
  bottle(V(1.55, 0.55, 7.2), 0xf8f0ea, 0xffffff, (c, w, h) => {                                         // Pantene: pink roses
    c.fillStyle = '#fbf3ec'; c.fillRect(0, 0, w, h);
    for (let k = 0; k < 26; k++) { c.fillStyle = ['#f06a7a', '#f8a07a', '#ffd08a', '#e84a5a'][k % 4]; c.beginPath(); c.arc(Math.random() * w, h * 0.35 + Math.random() * h * 0.6, 8 + Math.random() * 12, 0, 7); c.fill(); }
    c.fillStyle = '#7a3a2a'; c.font = 'bold 18px Georgia'; c.textAlign = 'center'; c.fillText('PANTENE', w / 2, h * 0.3);
  }, 0.2).rotation.y = -1.9;

  // --- the black wire caddy on the back wall, two shelves, its bottles and a loofah
  const caddy = new THREE.Group();
  caddy.position.set(1.0, 1.2, 7.9);
  g.add(caddy);
  const wire = (pts) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), pts.length * 4, 0.003, 5), black); caddy.add(m); };
  for (const y of [0, 0.3]) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.008, 0.1), wood);
    shelf.position.set(0, y, -0.055); caddy.add(shelf);
    wire([V(-0.17, y + 0.005, 0), V(-0.17, y + 0.005, -0.11), V(0.17, y + 0.005, -0.11), V(0.17, y + 0.005, 0)]);
    wire([V(-0.17, y + 0.04, -0.005), V(-0.17, y + 0.04, -0.11), V(0.17, y + 0.04, -0.11), V(0.17, y + 0.04, -0.005)]);
  }
  for (const x of [-0.15, 0.15]) wire([V(x, 0, -0.004), V(x, 0.45, -0.004)]);
  const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 24), black);
  hook.rotation.x = Math.PI / 2; hook.position.set(0, 0.36, -0.006); caddy.add(hook);
  const put = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; caddy.add(m); return m; };
  // top shelf: an amber bottle and a pink jar
  put(new THREE.BoxGeometry(0.07, 0.07, 0.05), new THREE.MeshPhysicalMaterial({ color: 0x9a7020, roughness: 0.1, transparent: true, opacity: 0.8, clearcoat: 1 }), -0.08, 0.34, -0.05);
  put(new THREE.CylinderGeometry(0.03, 0.03, 0.045, 20), new THREE.MeshStandardMaterial({ color: 0xf0a0a8, roughness: 0.4 }), 0.1, 0.33, -0.05);
  // lower shelf: the pink foaming pump bottle with its hair ties, and the red hair-mask tube leaning out
  put(new THREE.CylinderGeometry(0.035, 0.037, 0.12, 20), new THREE.MeshStandardMaterial({ color: 0xfff4f0, roughness: 0.4 }), 0.06, 0.065, -0.05);
  put(new THREE.CylinderGeometry(0.036, 0.036, 0.045, 20), new THREE.MeshStandardMaterial({ color: 0xff9ab0, roughness: 0.4 }), 0.06, 0.04, -0.05);
  put(new THREE.CylinderGeometry(0.014, 0.022, 0.03, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), 0.06, 0.14, -0.05);
  for (const [k, c] of [[0, 0x5ab8e8], [1, 0xc87aa0]]) { const t = put(new THREE.TorusGeometry(0.02, 0.0045, 6, 18), new THREE.MeshStandardMaterial({ color: c, roughness: 0.3 }), 0.06, 0.11 + k * 0.011, -0.05); t.rotation.x = Math.PI / 2; }
  const tube = put(new THREE.BoxGeometry(0.045, 0.16, 0.022), new THREE.MeshStandardMaterial({ color: 0xc82a3a, roughness: 0.35 }), -0.13, 0.08, -0.05);
  tube.rotation.z = 0.6;
  // the loofah, hanging off the shelf's corner on a cord
  put(new THREE.CylinderGeometry(0.0015, 0.0015, 0.08, 4), new THREE.MeshStandardMaterial({ color: 0xf0ead8 }), 0.17, -0.04, -0.03);
  const loofah = put(new THREE.CylinderGeometry(0.022, 0.026, 0.13, 10, 4), new THREE.MeshStandardMaterial({ color: 0xead8b0, roughness: 1, map: tex(64, 64, (c, w, h) => { c.fillStyle = '#e8d6ac'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b89a68'; c.lineWidth = 1; for (let k = 0; k < 60; k++) { c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 0, 7); c.stroke(); } }) }), 0.17, -0.15, -0.03);
  loofah.rotation.z = 0.05;

  g.traverse((o) => { if (o.isMesh) o.userData.noCollide = true; });
  scene.add(g);
  return g;
}
