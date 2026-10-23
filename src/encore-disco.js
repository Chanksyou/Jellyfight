// The Encore's disco ball (act 4). Every 8 bars, from 32 bars into the fight, a big mirror ball
// (about three jellies tall) drops from above the arena for 8 beats and throws 32 light spots across
// the floor, each on its own beam. Twice, 4 beats each: the spots wheel round as the ball turns for 3
// beats, then stop and flash fast in the Encore's disco colour for the 4th, the Warning; as that beat
// ends every spot strikes, hurting anything of the jelly on one up to --encore-floor-height (step off
// it, or jump). The second time round the ball turns the other way. The song's breakdown skips it.
//
// Time is in beats (the song's beatNow). No light is added: the ball, its rod, the beams and the
// spots are four unlit or lightly lit draws, the spots and beams instanced.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { STAGE4 } from './stage4.js';
import { sfx } from './sfx.js';

const HALF = (STAGE4.tiles * STAGE4.tileSize) / 2, BOSS = STAGE4.bossSpace;
// Health a strike takes (heavy, as the floor waves); moves to content/bosses.kdl with the campaign
export const DISCO_DMG = 5;
export const DISCO = { first: 128, every: 32, length: 8, cycle: 4, move: 3, spots: 32 };
const CENTER = [0, 0.3];                           // over the floor, out in front of the DJs
const UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Color();

// The club around it as a mirror sees it: a small cube map of dark haze with hot pools of the arena's
// lights (amber, cool blue, laser green, magenta, white), made once
function clubLights() {
  const faces = [], hues = ['#ff8a2a', '#7fa8ff', '#39ff14', '#ff2fd2', '#ffffff', '#ffd27a'];
  for (let f = 0; f < 6; f++) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    // silver haze, brighter above (+y), with a mottle so neighbouring tiles differ
    const base = g.createLinearGradient(0, 0, 0, 64); base.addColorStop(0, f === 2 ? '#c9cfdc' : '#8d93a3'); base.addColorStop(1, f === 3 ? '#3a3e4a' : '#5d6372');
    g.fillStyle = base; g.fillRect(0, 0, 64, 64);
    for (let k = 0; k < 40; k++) { const v = 90 + Math.random() * 150 | 0; g.fillStyle = `rgba(${v},${v},${v + 8},0.5)`; g.fillRect(Math.random() * 64, Math.random() * 64, 6 + Math.random() * 10, 6 + Math.random() * 10); }
    for (let k = 0; k < 5; k++) { const x = Math.random() * 64, y = Math.random() * 64, w = g.createRadialGradient(x, y, 0, x, y, 6); w.addColorStop(0, '#ffffff'); w.addColorStop(1, '#fff0'); g.fillStyle = w; g.fillRect(0, 0, 64, 64); }
    for (let k = 0; k < 5; k++) {
      const x = Math.random() * 64, y = Math.random() * 64, r = 5 + Math.random() * 12, grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, hues[(f + k) % hues.length]); grad.addColorStop(1, '#0000'); g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    }
    faces.push(c);
  }
  const t = new THREE.CubeTexture(faces); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  return t;
}
// rings of square tiles round a sphere of radius r, each a flat quad (its own normal) inset from its
// neighbours so the grout shows between
function mirrorTiles(r, rings) {
  const pos = [], nor = [], gap = 0.12, dl = Math.PI / rings, v = new THREE.Vector3(), n = new THREE.Vector3();
  const at = (lat, lon) => v.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)).multiplyScalar(r).toArray();
  for (let i = 0; i < rings; i++) {
    const lat = -Math.PI / 2 + (i + 0.5) * dl, cols = Math.max(4, Math.round(2 * rings * Math.cos(lat))), dn = (2 * Math.PI) / cols;
    for (let j = 0; j < cols; j++) {
      const lon = j * dn + (i % 2) * dn / 2, h = (dl * (1 - gap)) / 2, w = (dn * (1 - gap)) / 2;
      const q = [at(lat - h, lon - w), at(lat - h, lon + w), at(lat + h, lon + w), at(lat + h, lon - w)];
      n.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
      for (const k of [0, 2, 1, 0, 3, 2]) { pos.push(...q[k]); nor.push(n.x, n.y, n.z); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return geo;
}
// a few four-pointed star glints sitting on the ball's surface
function glints(r, count) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32); grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.18, '#ffffffaa'); grad.addColorStop(1, '#fff0');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64); g.fillStyle = '#fff';
  g.fillRect(31, 0, 2, 64); g.fillRect(0, 31, 64, 2);
  const pos = [], col = [], phase = [];
  for (let k = 0; k < count; k++) {
    const y = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - y * y);
    pos.push(Math.cos(a) * s * r * 1.01, y * r * 1.01, Math.sin(a) * s * r * 1.01); col.push(0, 0, 0); phase.push(Math.random() * 40);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: r * 0.5, map: new THREE.CanvasTexture(c), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  pts.userData.phase = phase; pts.userData.noCollide = true;
  return pts;
}
// each glint flares as the ball turns a tile's worth past it, with a little shimmer on the beat
function twinkle(pts, turn, beat) {
  const col = pts.geometry.attributes.color, ph = pts.userData.phase;
  for (let k = 0; k < ph.length; k++) { const b = Math.max(0, Math.sin(ph[k] + turn * 9 + beat * 0.7)) ** 12; col.setXYZ(k, b, b, b); }
  col.needsUpdate = true;
}

export class EncoreDisco {
  // arena: buildAct4's; onHit(dmg): the jelly was struck; quiet(beat): the song's breakdown;
  // random: where the spots scatter
  constructor(arena, { onHit = () => {}, quiet = () => false, random = Math.random } = {}) {
    Object.assign(this, { arena, onHit, quiet, random });
    this.r = LOOK.num('encore-disco-radius', 0.12);
    this.hang = LOOK.num('encore-disco-hang', 0.5);          // the ball's centre when it's down
    this.top = 1.4;                                           // up out of sight
    this.spotR = LOOK.num('encore-disco-spot', 0.028);
    this.white = new THREE.Color(LOOK.color('encore-disco-light', '#fff4e2'));
    this.hot = new THREE.Color(LOOK.color('hostile-encore-disco', '#ff2fd2'));
    this.beat = null; this.show = null; this.struck = -1;
    this.root = new THREE.Group(); this.root.name = 'Encore disco ball'; arena.root.add(this.root);
    // the ball: rings of small square mirror tiles, each a flat facet reflecting the club's lights,
    // over dark grout, turning; a few star glints twinkle on it
    this.env = clubLights();
    const ballGeo = mirrorTiles(this.r, LOOK.num('encore-disco-rings', 26));
    this.ballMat = new THREE.MeshBasicMaterial({ color: '#ffffff', envMap: this.env, combine: THREE.MultiplyOperation, reflectivity: 1 });
    this.ball = new THREE.Mesh(ballGeo, this.ballMat); this.ball.userData.noCollide = true;
    const groutGeo = new THREE.SphereGeometry(this.r * 0.985, 24, 16);
    this.ball.add(new THREE.Mesh(groutGeo, new THREE.MeshBasicMaterial({ color: '#07080b' })));
    this.glints = glints(this.r, 22); this.ball.add(this.glints);
    const rodGeo = new THREE.CylinderGeometry(0.0025, 0.0025, 1, 6).translate(0, 0.5, 0);
    this.rod = new THREE.Mesh(rodGeo, new THREE.MeshBasicMaterial({ color: '#1a1e28' })); this.rod.userData.noCollide = true;
    this.hanger = new THREE.Group(); this.hanger.add(this.ball, this.rod); this.hanger.visible = false;
    this.root.add(this.hanger);
    // the spots on the floor and their beams from the ball: one instanced draw each
    const n = DISCO.spots;
    const spotGeo = new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2);
    this.spots = new THREE.InstancedMesh(spotGeo, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), n);
    const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true).translate(0, 0.5, 0);
    this.beams = new THREE.InstancedMesh(beamGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: LOOK.num('encore-disco-beam', 0.35), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), n);
    for (const m of [this.spots, this.beams]) { m.frustumCulled = false; m.userData.noCollide = true; m.visible = false; m.renderOrder = 4; this.root.add(m); }
    for (let i = 0; i < n; i++) { this.spots.setColorAt(i, _c.set(0)); this.beams.setColorAt(i, _c.set(0)); }
    this.owned = [ballGeo, this.ballMat, this.env, groutGeo, this.ball.children[0].material, this.glints.geometry, this.glints.material, this.glints.material.map, rodGeo, this.rod.material, spotGeo, this.spots.material, beamGeo, this.beams.material];
    this.layout = [];                                         // each spot: how far out from under the ball, and its angle round it
  }

  // the show playing at this beat: its first beat, or null
  showAt(beat) {
    if (this.stayFrom != null && beat >= this.stayFrom - 1) return this.stayFrom;   // down for good (stay)
    if (beat < DISCO.first - 1) return null;
    const at = DISCO.first + Math.floor((beat - DISCO.first + 1) / DISCO.every) * DISCO.every;
    return beat < at + DISCO.length + 1.5 && !this.quiet(at) && !this.quiet(at + DISCO.length - 1) ? at : null;
  }
  // the spots scattered afresh for a show: anywhere on the open floor, where they both stop (the
  // ball turned 3 beats' worth, then back) is on the floor too, so all of them are there to strike
  scatter() {
    const open = (x, z) => Math.abs(x) < HALF - 0.03 && Math.abs(z) < HALF - 0.03 && !(Math.abs(x - BOSS.center[0]) < BOSS.width / 2 && Math.abs(z - BOSS.center[2]) < BOSS.depth / 2);
    const stop = this.turn(DISCO.move);
    this.layout = Array.from({ length: DISCO.spots }, () => {
      for (;;) {
        const x = (this.random() * 2 - 1) * HALF, z = (this.random() * 2 - 1) * HALF, r = Math.hypot(x - CENTER[0], z - CENTER[1]), a = Math.atan2(z - CENTER[1], x - CENTER[0]);
        if (open(x, z) && open(CENTER[0] + Math.cos(a + stop) * r, CENTER[1] + Math.sin(a + stop) * r)) return { r, a };
      }
    });
  }
  // how far the ball has turned (radians) at `u` beats into its show: it wheels for 3 beats of each 4,
  // stopped for the 4th; the second 4 beats turn the other way
  // (one way, then back the other: every other 4 beats, so a show that stays keeps swinging)
  turn(u) {
    const spin = LOOK.num('encore-disco-spin', 0.35), c = Math.floor(u / DISCO.cycle), k = Math.min(DISCO.move, u - c * DISCO.cycle);
    return spin * (c % 2 === 0 ? k : DISCO.move - k);
  }
  // spot i's place on the floor at turn `t`, or null off the floor
  spot(i, t, out = _p) {
    const L = this.layout[i], a = L.a + t, x = CENTER[0] + Math.cos(a) * L.r, z = CENTER[1] + Math.sin(a) * L.r;
    return Math.abs(x) < HALF && Math.abs(z) < HALF ? out.set(x, 0.0012, z) : null;
  }

  update(beat, player) {
    if (this.beat !== null && beat < this.beat) this.struck = -1;
    const skip = this.beat !== null && beat - this.beat > 1;
    this.beat = beat;
    const at = this.showAt(beat), u = at === null ? null : beat - at;
    if (at !== this.show) { this.show = at; this.struck = -1; if (at !== null) this.scatter(); }
    // each 4 beats strike as they end (beats 4 and 8 of the show), where the spots stopped
    const len = this.stayFrom != null ? Infinity : DISCO.length;
    if (u !== null) for (let c = this.struck + 1; c < Math.min(len / DISCO.cycle, Math.floor(u / DISCO.cycle)); c++) this.strike(c, player, skip || this.quiet(at + c * DISCO.cycle));
    // staying: fresh spots every 8 beats, at the turn back to where they started
    if (this.stayFrom != null && u >= 0 && Math.floor(u / (DISCO.cycle * 2)) !== this.dealt) { this.dealt = Math.floor(u / (DISCO.cycle * 2)); this.scatter(); }
    // the ball: drops over the beat before, hangs for the show, rises away over the beat and a half after
    const down = u === null ? 0 : u < 0 ? 1 + u : u <= len ? 1 : Math.max(0, 1 - (u - len) / 1.5);
    this.hanger.visible = down > 0.001;
    const y = this.top + (this.hang - this.top) * (1 - (1 - down) ** 3);
    this.hanger.position.set(CENTER[0], y, CENTER[1]);
    this.rod.scale.set(1, Math.max(0.01, this.top + 0.4 - y), 1);
    const playing = u !== null && u >= 0 && u < len && !(this.stayFrom != null && this.quiet(beat));
    if (playing) this.ball.rotation.y = -this.turn(u);
    if (this.hanger.visible) twinkle(this.glints, this.ball.rotation.y, beat);
    this.spots.visible = this.beams.visible = playing;
    if (!playing) return;
    // the spots: soft white while they wheel; stopped, they flash fast between white and the hot colour
    const k = u % DISCO.cycle, stopped = k >= DISCO.move, t = this.turn(u);
    const flash = stopped && Math.floor(k * 8) % 2 === 0, bright = stopped ? 1 : 0.55 + 0.15 * Math.sin(beat * 6);
    const size = this.spotR * (stopped ? 1.15 : 1), ball = _d.set(CENTER[0], y, CENTER[1]);
    for (let i = 0; i < DISCO.spots; i++) {
      const p = this.spot(i, t);
      if (!p) { _m.makeScale(0, 0, 0); this.spots.setMatrixAt(i, _m); this.beams.setMatrixAt(i, _m); continue; }
      this.spots.setMatrixAt(i, _m.compose(p, _q.identity(), _s.set(size, 1, size)));
      this.spots.setColorAt(i, _c.copy(flash ? this.hot : this.white).multiplyScalar(bright));
      // its beam, from the ball to the spot
      const dir = _s.copy(p).sub(ball), len = dir.length();
      this.beams.setMatrixAt(i, _m.compose(ball, _q.setFromUnitVectors(UP, dir.divideScalar(len)), _s.set(0.0018, len, 0.0018)));
      this.beams.setColorAt(i, _c.copy(flash ? this.hot : this.white).multiplyScalar(stopped ? 0.9 : 0.5));
    }
    for (const m of [this.spots, this.beams]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  }
  // the spots where cycle `c` stopped strike: any under the jelly (its feet below the floor's hit
  // height) hurts it, once
  strike(c, player, skip) {
    this.struck = c;
    if (skip) return;
    sfx.encoreDisco?.();
    if (!player || player.position.y >= LOOK.num('encore-floor-height', 0.04)) return;
    const p = player.position, r = player.cfg?.radius ?? 0.03, t = this.turn(c * DISCO.cycle + DISCO.move), q = new THREE.Vector3();
    for (let i = 0; i < DISCO.spots; i++) if (this.spot(i, t, q) && Math.hypot(q.x - p.x, q.z - p.z) < this.spotR + r * 0.6) { this.onHit(DISCO_DMG, { name: 'disco' }); return; }
  }

  // from beat `at` the ball comes down and stays, wheeling, stopping and striking every 4 beats
  // (the Encore after half Health); null: back to its every-8-bars shows
  stay(at) { this.stayFrom = at; this.dealt = -1; }

  reset() { this.beat = null; this.show = null; this.struck = -1; this.stayFrom = null; this.hanger.visible = this.spots.visible = this.beams.visible = false; }
  dispose() { this.root.removeFromParent(); this.spots.dispose(); this.beams.dispose(); for (const o of this.owned) o.dispose(); }
}
