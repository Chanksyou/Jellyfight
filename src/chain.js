// One substep of a soft rope in water (the tentacles, tentacles.js, and the oral arms, arms.js):
// the root pinned to its pose, every other point sprung toward its pose (K, 1/s²), slowed by the
// still water (C, 1/s: across the chain; along it only `1 - slip` of that), sinking a little,
// kept from folding sharper than its pose (XPBD bend: share `bend` of a fold undone) and kept
// its length from the point above (follow the leader; `keep` of that correction carries on as speed).
// sim/vel/goal: Vector3 arrays, the same space (world, in model units). flow: the water's own
// velocity there (optional; still water if left out). Allocates nothing.
import * as THREE from 'three';

const _d = new THREE.Vector3(), _o = new THREE.Vector3(), _r = new THREE.Vector3(), STILL = new THREE.Vector3();

export function stepChain(sim, vel, goal, K, C, h, slip, sink, bend, keep, flow = STILL) {
  const N = sim.length - 1;
  sim[0].copy(goal[0]);
  for (let j = 1; j <= N; j++) {
    const p = sim[j], v = vel[j], g = goal[j], c = C[j];
    _d.copy(p).sub(sim[j - 1]);
    const r = _r.copy(v).sub(flow);                              // through the water
    const along = _d.dot(r) / (_d.lengthSq() || 1) * c * slip;  // drag given back along the chain
    v.x += (K[j] * (g.x - p.x) - c * r.x + along * _d.x) * h;
    v.y += (K[j] * (g.y - p.y) - c * r.y + along * _d.y) * h - sink;
    v.z += (K[j] * (g.z - p.z) - c * r.z + along * _d.z) * h;
    p.addScaledVector(v, h);
    _o.copy(p);
    // bend: folded tighter than the pose (two points up the chain closer than in the pose)?
    // undo most of the fold, so it curves instead of kinking
    if (j > 1) {
      _d.copy(p).sub(sim[j - 2]);
      const len = _d.length(), want = goal[j].distanceTo(goal[j - 2]);
      if (len < want && len > 1e-6) p.addScaledVector(_d, (want - len) / len * bend);
    }
    // keep the segment its length: it bends, it doesn't stretch
    const seg = goal[j].distanceTo(goal[j - 1]);
    _d.copy(p).sub(sim[j - 1]);
    const len = _d.length();
    if (len > 1e-6) p.copy(sim[j - 1]).addScaledVector(_d, seg / len);
    v.addScaledVector(_o.sub(p), -keep / h);                    // a little of the correction carries on
  }
}
