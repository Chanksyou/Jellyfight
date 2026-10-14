import * as THREE from 'three';

// Procedural animation for the rhinoceros beetle GLB (export_anim.py output:
// Body, Eyes, Leg_F/M/R_L/R, Antenna_L/R — a static model with no rig).
// createBeetle(model) wraps the loaded scene in a group whose local frame is
// tidy (beetle faces -Z, up +Y) and poses the parts every frame:
//   idle   gentle sway, antennae twitch
//   walk   tripod gait (L_F+R_M+L_R against R_F+L_M+R_R), body bob and waddle
//   attack attack() charges the horns (an energy orb grows between them, the
//          body rears and trembles), then fires 3 energy balls in a spread
//          and recoils. Balls fly in model space; a game that wants its own
//          projectiles can read muzzleWorld()/facingWorld() at the flash, or
//          pass { balls: false } to suppress them (Jellyfight does: its spit
//          word deals the damage, the orb stays as the Warning).
const CHARGE = 0.8, RECOVER = 0.7;            // attack timeline, seconds
const BALL_SPEED = 16, BALL_LIFE = 1.3, SPREAD = 0.30;   // radians ~17 deg

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createBeetle(model, opts = {}) {
  const root = new THREE.Group();
  const align = new THREE.Group(); root.add(align);
  const pose = new THREE.Group(); align.add(pose);
  pose.add(model);

  const boxOf = (o) => new THREE.Box3().setFromObject(o);
  const named = {};
  model.traverse((o) => { if (o.isMesh) named[o.name] = o; });
  const bodyC = boxOf(named.Body).getCenter(new THREE.Vector3());
  const eyesC = boxOf(named.Eyes).getCenter(new THREE.Vector3());
  const bodySize = boxOf(named.Body).getSize(new THREE.Vector3());

  // align: yaw so the beetle faces -Z; pose pivots on the body centre
  const fwd = eyesC.clone().sub(bodyC); fwd.y = 0; fwd.normalize();
  align.rotation.y = Math.atan2(fwd.x, fwd.z) + Math.PI;
  pose.position.copy(bodyC);
  model.position.set(-bodyC.x, -bodyC.y, -bodyC.z);
  root.updateMatrixWorld(true);

  // a pivot at each hip, oriented so its local X is the beetle's lateral axis:
  // legs then swing fore/aft with a plain rotation.x
  const lateral = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), fwd).normalize();
  const basis = new THREE.Matrix4().makeBasis(lateral, new THREE.Vector3(0, 1, 0), fwd.clone().negate());
  const q0 = new THREE.Quaternion().setFromRotationMatrix(basis);
  const mkPivot = (mesh, hip) => {
    const p = new THREE.Group();
    p.position.copy(hip); p.quaternion.copy(q0);
    model.add(p); p.attach(mesh);
    p.userData.q0 = q0.clone();
    return p;
  };
  const legs = [];
  for (const s of ['F', 'M', 'R']) for (const side of ['L', 'R']) {
    const mesh = named[`Leg_${s}_${side}`], b = boxOf(mesh), c = b.getCenter(new THREE.Vector3());
    const hip = new THREE.Vector3(bodyC.x + (c.x - bodyC.x) * 0.45, b.max.y - (b.max.y - b.min.y) * 0.12, c.z);
    const tripodA = (s === 'F' && side === 'L') || (s === 'M' && side === 'R') || (s === 'R' && side === 'L');
    legs.push({ pivot: mkPivot(mesh, hip), phase: tripodA ? 0 : Math.PI });
  }
  const antennae = [];
  for (const side of ['L', 'R']) {
    const mesh = named[`Antenna_${side}`], b = boxOf(mesh), c = b.getCenter(new THREE.Vector3());
    const hip = new THREE.Vector3(bodyC.x + (c.x - bodyC.x) * 0.5, b.min.y + (b.max.y - b.min.y) * 0.2, c.z);
    antennae.push({ pivot: mkPivot(mesh, hip), side: side === 'L' ? 1 : -1 });
  }

  // energy balls + the charge orb that grows between the horns
  const glow = glowTexture();
  const mkBall = (r) => {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xeaf7ff }));
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x6fc4ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    spr.scale.setScalar(r * 6);
    g.add(core, spr);
    return g;
  };
  const muzzle = bodyC.clone().addScaledVector(fwd, bodySize.z * 0.30).add(new THREE.Vector3(0, bodySize.y * 0.30, 0));
  const orb = mkBall(0.52); orb.name = 'charge-orb'; orb.position.copy(muzzle); orb.visible = false; model.add(orb);
  const light = new THREE.PointLight(0x8fd0ff, 0, 12); light.position.copy(muzzle); model.add(light);
  const balls = [];
  if (opts.balls !== false) for (let i = 0; i < 3; i++) {
    const b = mkBall(0.30); b.visible = false; model.add(b);
    balls.push({ mesh: b, vel: new THREE.Vector3(), age: 0, alive: false });
  }

  let state = 'idle', t = 0, attackT = -1, gaitAmp = 0;
  const q = new THREE.Quaternion(), qx = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0);
  const swing = (pivot, a) => { qx.setFromAxisAngle(X, a); pivot.quaternion.copy(pivot.userData.q0).multiply(qx); };

  return {
    group: root,
    balls,
    get attacking() { return attackT >= 0; },
    setState(s) { state = s; },
    attack() { if (attackT < 0) { attackT = 0; return true; } return false; },
    muzzleWorld(out) { return model.localToWorld(out.copy(muzzle)); },
    facingWorld(out) { return out.copy(fwd).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())); },
    update(dt) {
      t += dt;
      const charging = attackT >= 0 && attackT < CHARGE;
      const firing = attackT >= CHARGE && attackT < CHARGE + 0.12;
      // gait: full in walk, planted while charging
      const want = state === 'walk' && !charging ? 1 : 0;
      gaitAmp += (want - gaitAmp) * Math.min(1, dt * 6);
      const stride = t * Math.PI * 2 * 1.6;
      for (const L of legs) {
        const a = Math.sin(stride + L.phase) * 0.38 * gaitAmp;
        const lift = Math.max(0, Math.sin(stride + L.phase + 0.9)) * 0.10 * gaitAmp;
        swing(L.pivot, a + lift);
      }
      for (const A of antennae) {
        const tw = Math.sin(t * 2.3 + A.side * 1.7) * 0.08 + Math.sin(t * 7.7 + A.side) * 0.02;
        swing(A.pivot, tw - (charging ? 0.35 : 0));
      }
      // body: bob + waddle in walk, rear-and-tremble in the charge, thrust on fire
      // (pose-space rotation.x is nose-DOWN positive: the align yaw flips the axis)
      let pitch = Math.sin(t * 1.7) * 0.012, bobY = 0, surge = 0;
      if (gaitAmp > 0.01) { bobY = Math.abs(Math.sin(stride)) * 0.09 * gaitAmp; pitch += Math.sin(stride * 2) * 0.015 * gaitAmp; }
      if (attackT >= 0) {
        attackT += dt;
        if (attackT < CHARGE) {
          const k = attackT / CHARGE, e = k * k;
          pitch -= e * 0.17;   // rear back as the charge builds
          if (k > 0.7) pitch += Math.sin(t * 55) * 0.008 * (k - 0.7) / 0.3;   // tremble at full charge
          orb.visible = true;
          orb.scale.setScalar(0.15 + e * 1.15 + Math.sin(t * 31) * 0.05 * k);
          light.intensity = e * 60;
        } else {
          if (attackT - dt < CHARGE) {   // the firing frame
            for (let i = 0; i < balls.length; i++) {
              const b = balls[i], ang = (i - 1) * SPREAD;
              b.vel.copy(fwd).applyAxisAngle(new THREE.Vector3(0, 1, 0), ang).multiplyScalar(BALL_SPEED);
              b.mesh.position.copy(muzzle);
              b.age = 0; b.alive = true; b.mesh.visible = true;
            }
            orb.scale.setScalar(1.9); light.intensity = 120;
          }
          const k = (attackT - CHARGE) / RECOVER;
          pitch += (1 - k) * 0.22;   // the head punches down-forward as it fires
          surge = -Math.sin(Math.min(1, k) * Math.PI) * 0.3;
          orb.visible = k < 0.15;
          if (orb.visible) orb.scale.multiplyScalar(0.8);
          light.intensity = Math.max(0, 120 * (1 - k * 3));
          if (k >= 1) { attackT = -1; orb.visible = false; light.intensity = 0; }
        }
      }
      pose.rotation.x = pitch;
      pose.position.y = bodyC.y + bobY;
      pose.position.z = bodyC.z + surge;
      for (const b of balls) {
        if (!b.alive) continue;
        b.age += dt;
        b.mesh.position.addScaledVector(b.vel, dt);
        b.mesh.scale.setScalar(1 + Math.sin(b.age * 26) * 0.08);
        if (b.age > BALL_LIFE) { b.alive = false; b.mesh.visible = false; }
      }
    },
  };
}
