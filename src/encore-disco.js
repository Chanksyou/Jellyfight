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
export const DISCO_DMG = 4;
export const DISCO = { first: 128, every: 32, length: 8, cycle: 4, move: 3, spots: 32 };
const CENTER = [0, 0.3];                           // over the floor, out in front of the DJs
const UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Color();

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
    // the ball: a mosaic of mirror tiles (each face its own shade), turning
    const ballGeo = new THREE.SphereGeometry(this.r, 22, 14).toNonIndexed(), shade = [];
    for (let f = 0; f < ballGeo.attributes.position.count / 3; f++) { const v = Math.random() < 0.08 ? 1.8 : 0.25 + 0.75 * Math.random(); for (let k = 0; k < 3; k++) shade.push(v, v, v * 1.03); }   // mirror tiles, a few catching the light
    ballGeo.setAttribute('color', new THREE.Float32BufferAttribute(shade, 3)); ballGeo.computeVertexNormals();
    this.ballMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.12, flatShading: true, emissive: '#5a5a66', emissiveIntensity: 1 });
    this.ball = new THREE.Mesh(ballGeo, this.ballMat); this.ball.userData.noCollide = true;
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
    this.owned = [ballGeo, this.ballMat, rodGeo, this.rod.material, spotGeo, this.spots.material, beamGeo, this.beams.material];
    this.layout = [];                                         // each spot: how far out from under the ball, and its angle round it
  }

  // the show playing at this beat: its first beat, or null
  showAt(beat) {
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
  turn(u) {
    const spin = LOOK.num('encore-disco-spin', 0.35), c = Math.floor(u / DISCO.cycle), k = Math.min(DISCO.move, u - c * DISCO.cycle);
    const first = Math.min(1, c) * DISCO.move;                // how far the first 4 beats turned it
    return spin * (c === 0 ? k : first - k);
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
    if (u !== null) for (let c = this.struck + 1; c < Math.min(DISCO.length / DISCO.cycle, Math.floor(u / DISCO.cycle)); c++) this.strike(c, player, skip);
    // the ball: drops over the beat before, hangs for the show, rises away over the beat and a half after
    const down = u === null ? 0 : u < 0 ? 1 + u : u <= DISCO.length ? 1 : Math.max(0, 1 - (u - DISCO.length) / 1.5);
    this.hanger.visible = down > 0.001;
    const y = this.top + (this.hang - this.top) * (1 - (1 - down) ** 3);
    this.hanger.position.set(CENTER[0], y, CENTER[1]);
    this.rod.scale.set(1, Math.max(0.01, this.top + 0.4 - y), 1);
    const playing = u !== null && u >= 0 && u < DISCO.length;
    if (playing) this.ball.rotation.y = -this.turn(u);
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

  reset() { this.beat = null; this.show = null; this.struck = -1; this.hanger.visible = this.spots.visible = this.beams.visible = false; }
  dispose() { this.root.removeFromParent(); this.spots.dispose(); this.beams.dispose(); for (const o of this.owned) o.dispose(); }
}
