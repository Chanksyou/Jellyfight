// The looks of three Legendary Treasures (gadgets.js owns one of these). Looks only: no hit, timing or
// number is decided here.
//   Snooze Button (death-save): an alarm clock rings and shakes over the jelly, the world slows for a
//     moment and its colour drains (juice.grey: graphics.js's output pass, or the HUD's veil on Low).
//   Newton's Cradle (overkill): a steel ball carries each passed hit from bug to bug, landing as the
//     hit does (enemies.js overkill / deliverPasses); after the last pass it drops, rolls and fades.
//   Bloody Fangs (health-drain): a heartbeat once a second while Health seeps away (a bell pulse and a
//     small red ring), and a dim red trail while you swim flat out. Its fangs are an adorn piece.
// Every body is the kit's (GadgetLooks geometry + material, so no draw or program of its own), built at
// load through the prop registry so the warm-up shows it.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { juice } from './juice.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), FWD = new THREE.Vector3(0, 0, 1);

export class TreasureLegends {
  constructor(g) {
    this.g = g; this.fx = g.fx; this.looks = g.looks; this.enemies = g.enemies;
    const L = g.looks, part = (parent, geo, color) => {
      const m = new THREE.Mesh(geo, L.mat);
      m.userData.color = new THREE.Color(color); m.userData.opacity = 1;
      parent.add(m); return m;
    };
    // the alarm clock: a round face, two bells, the hammer between them, two hands and two feet
    const shell = new THREE.Color(LOOK.color('treasure-snooze', '#d3eaff')), dark = LOOK.color('treasure-snooze-ink', '#4a5d80');
    this.clock = g.props.prop('alarm-clock', () => {
      const c = new THREE.Group(), s = LOOK.num('treasure-clock-size', 0.02);
      c.userData.size = 1;
      const face = part(c, L.geo.stud, shell); face.rotation.x = Math.PI / 2; face.scale.set(s, s * 0.5, s);
      const dial = part(c, L.geo.stud, '#ffffff'); dial.rotation.x = Math.PI / 2; dial.position.z = s * 0.2; dial.scale.set(s * 0.78, s * 0.2, s * 0.78);
      c.userData.bells = [-1, 1].map((k) => { const b = part(c, L.geo.foam, shell); b.position.set(k * s * 0.62, s * 0.95, 0); b.scale.setScalar(s * 0.42); return b; });
      const hammer = c.userData.hammer = new THREE.Group(); hammer.position.y = s * 0.95; c.add(hammer);
      const stem = part(hammer, L.geo.rod, dark); stem.scale.set(s * 0.06, s * 0.55, s * 0.06); stem.position.y = s * 0.28;
      const head = part(hammer, L.geo.foam, dark); head.scale.setScalar(s * 0.14); head.position.y = s * 0.55;
      for (const [len, a] of [[0.5, 0.4], [0.35, -1.9]]) { const h = part(c, L.geo.rod, dark); h.scale.set(s * 0.07, s * len, s * 0.07); h.rotation.z = a; h.position.set(-Math.sin(a) * s * len * 0.5, Math.cos(a) * s * len * 0.5, s * 0.32); }
      for (const k of [-1, 1]) { const f = part(c, L.geo.rod, dark); f.scale.set(s * 0.09, s * 0.45, s * 0.09); f.rotation.z = k * 0.6; f.position.set(k * s * 0.6, -s * 1.05, 0); }
      g.group.add(c); return c;
    });
    this.save = null;
    // the Cradle's steel balls: one carries a chain of passes; a few chains can run at once
    this.steel = new THREE.Color(LOOK.color('treasure-newtonsCradle', '#9ff3ff'));
    this.glint = new THREE.Color('#ffffff');
    this.balls = g.props.pool('cradle-ball', 4, () => {
      const m = part(g.group, L.geo.foam, this.steel); m.userData.size = LOOK.num('treasure-cradle-ball', 0.0055);
      m.userData.ball = { state: 'idle', t: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), dir: new THREE.Vector3(), target: null, at: null, floor: 0, vy: 0 };
      return m;
    });
    this.bleed = new THREE.Color(LOOK.color('bleed', '#ff2a4a'));
    this.reset();
  }

  reset() {
    this.save = null; this.beatT = 0; this.trailT = 0;
    juice.grey = 0;
    if (this.clock) this.clock.visible = false;
    for (const m of this.balls || []) { m.visible = false; m.userData.ball.state = 'idle'; m.userData.ball.target = m.userData.ball.at = null; }
  }

  // real seconds for this frame: the effects here keep their pace through the slow motion they start
  real(dt) { return dt / (juice.scale || 1); }

  // --- Snooze Button: the save itself (run.js hurt). at: the jelly's feet (followed while it rings), h: its height
  snooze(at, h) {
    const quiet = this.looks.quiet;
    this.save = { t: 0, at, h, quiet };
    this.clock.visible = true;
    if (!quiet) {
      juice.feel('save');
      juice.slow(...LOOK.list('save-slow', [0.6, 0.3]).map(Number));
      this.fx.number(_a.copy(at).setY(at.y + h * 2.2), 'Zzz', LOOK.color('treasure-snooze', '#d3eaff'), 18);
    }
  }
  tickSnooze(dt) {
    const S = this.save, c = this.clock;
    if (!S) return;
    S.t += this.real(dt);
    const ring = LOOK.num('treasure-clock-ring', 0.6), fade = 0.25, u = S.t / (ring + fade);
    // colour drains fast, holds while it rings, then comes back
    const drain = LOOK.num('save-grey', 0.85);
    juice.grey = S.quiet ? 0 : drain * Math.min(1, S.t / 0.08) * Math.min(1, Math.max(0, (ring + 0.2 - S.t) / 0.4));
    if (u >= 1) { this.save = null; c.visible = false; juice.grey = 0; return; }
    const P = S.at;
    c.position.set(P.x, P.y + S.h * 1.7, P.z);
    const grow = Math.min(1, S.t / 0.08), gone = S.t > ring ? 1 - (S.t - ring) / fade : 1;
    c.scale.setScalar(Math.max(0.001, grow * gone * (S.quiet ? 1 : 1 + 0.15 * Math.max(0, 1 - S.t / 0.15))));
    const ringing = !S.quiet && S.t < ring;
    c.quaternion.copy(this.fx.camera.quaternion).multiply(_q.setFromAxisAngle(FWD, ringing ? Math.sin(S.t * 70) * 0.22 : 0));   // facing you, rocking as it rings
    c.userData.hammer.rotation.z = ringing ? Math.sin(S.t * 90) * 0.9 : 0;
    for (const o of c.children) if (o.userData.color) o.userData.opacity = gone;
    for (const b of c.userData.hammer.children) b.userData.opacity = gone;
  }

  // --- Newton's Cradle. A pass leaves `from` (the bug it killed, id fromId) for bug `to`, landing in `dur` s:
  // the ball already resting on that bug goes on, else a free one. Returns the ball (the pass keeps it)
  cradleLaunch(from, fromId, to, dur) {
    let m = this.balls.find((x) => x.userData.ball.state === 'rest' && x.userData.ball.at === fromId)
      || this.balls.find((x) => x.userData.ball.state === 'idle')
      || this.balls.reduce((a, b) => (a.userData.ball.t >= b.userData.ball.t ? a : b));
    const B = m.userData.ball;
    if (B.state !== 'rest') B.from.copy(from); else B.from.copy(m.position);
    Object.assign(B, { state: 'fly', t: 0, dur: Math.max(1e-3, dur), target: to, at: null });
    this.enemies.center(to, B.to);
    m.position.copy(B.from); m.scale.setScalar(m.userData.size); m.userData.opacity = 1; m.visible = true;
    return m;
  }
  // the pass landed on bug n at c (n null: its bug was gone, so the ball just drops); full: the last pass a chain can make
  cradleLand(m, n, c, depth, full) {
    if (!m) return;
    const B = m.userData.ball;
    if (n) { B.dir.copy(c).sub(B.from).setY(0); m.position.copy(c); }
    if (B.dir.lengthSq() < 1e-10) B.dir.set(1, 0, 0);
    B.dir.normalize();
    B.state = n ? 'rest' : 'drop'; B.t = 0; B.at = n?.id ?? null; B.target = n; B.vy = 0;
    B.floor = this.enemies.floorBelow(m.position, m.position.y - 0.05);
    if (full && depth > 1 && n) this.fx.number(_a.copy(c).setY(c.y + n.r * 2.5), '×' + depth, LOOK.color('treasure-newtonsCradle', '#9ff3ff'), 16);
  }
  tickBalls(dt) {
    const E = this.enemies, quiet = this.looks.quiet, low = this.fx.low(), G = this.fx.glow;
    for (const m of this.balls) {
      const B = m.userData.ball;
      if (B.state === 'idle') continue;
      B.t += dt;
      if (B.state === 'fly') {
        if (B.target && !B.target.dead) E.center(B.target, B.to);
        const u = Math.min(1, B.t / B.dur);
        m.position.lerpVectors(B.from, B.to, u).y += Math.sin(u * Math.PI) * LOOK.num('treasure-cradle-arc', 0.012);   // a swing's arc
        if (!low) G.emit(m.position, this.steel, m.userData.size * 2.4, m.userData.size * 0.6, 0.12, 0.4);
        if (B.t > B.dur + 0.25) { B.state = 'drop'; B.t = 0; B.target = null; B.floor = E.floorBelow(m.position, m.position.y - 0.05); }   // its pass never landed (the room was cleared)
      } else if (B.state === 'rest') {   // it sits on the bug a beat, in case that one passes too
        if (B.target && !B.target.dead) E.center(B.target, m.position);
        if (B.t >= LOOK.num('treasure-cradle-rest', 0.12)) { B.state = 'drop'; B.t = 0; B.target = null; }
      } else {                          // it falls to the floor, rolls on the way it was going and fades
        const life = LOOK.num('treasure-cradle-roll', 0.4);
        if (m.position.y > B.floor) { B.vy -= 1.5 * dt; m.position.y = Math.max(B.floor, m.position.y + B.vy * dt); B.t = 0; }
        else if (!quiet) m.position.addScaledVector(B.dir, dt * 0.06 * Math.max(0, 1 - B.t / life));
        m.userData.opacity = Math.max(0, 1 - B.t / life);
        if (B.t >= life) { B.state = 'idle'; m.visible = false; continue; }
      }
      G.hold(_b.copy(m.position).y += m.userData.size * 0.4, this.glint, m.userData.size * 1.2, 0.5 * m.userData.opacity);   // the steel's shine
    }
  }

  // --- Bloody Fangs: run.js drain calls this each frame Health seeps away. P: the jelly's feet, h its height, r its radius
  heartbeat(dt, P, h, r, pulse, fast) {
    const quiet = this.looks.quiet, G = this.fx.glow;
    if ((this.beatT -= dt) <= 0) {
      this.beatT = LOOK.num('fangs-beat', 1);
      if (!quiet) pulse?.(LOOK.num('fangs-beat-pulse', 0.25));
      const n = 10, R = r * 1.3, s = r * 0.3;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        _a.set(P.x + Math.cos(a) * R, P.y + h * 0.4, P.z + Math.sin(a) * R);
        _b.set(Math.cos(a), 0, Math.sin(a)).multiplyScalar(quiet ? 0 : r * 1.2);
        G.emit(_a, this.bleed, s, s * 0.4, 0.45, LOOK.num('fangs-beat-glow', 0.5), _b);
      }
    }
    if (fast && !quiet && !this.fx.low() && (this.trailT -= dt) <= 0) {
      this.trailT = 0.06;
      G.emit(_a.set(P.x, P.y + h * 0.3, P.z), this.bleed, r * 0.35, r * 0.1, 0.4, LOOK.num('fangs-trail-glow', 0.25));
    }
  }

  update(dt) {
    this.tickSnooze(dt);
    this.tickBalls(dt);
  }
}
