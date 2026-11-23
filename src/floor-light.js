// Light on the floor from what glows in the room: the TV's colours spilling onto the rug, the monitor's glow
// in front of the desk, act 3's night light drifting between pink and amber. Each is one soft pool made with
// the Treasure glow's own shader (treasure-glow.js, kind `lamp`: no ring, no hard edge), so no new shader
// program, and a stage lists them as plain data (`floorLight`). Never a light: a pool only paints the floor.
//
//  - A spot is { at: [x, z], r, kind }. Kind `screen` follows the screensaver's colours (screenColor: the same
//    drift the TV's screen draws, set-dressing.js), `night` wanders warm.
//  - Slow on purpose (--floor-light-rate, a full drift in about 30 s) and dimmer than the jelly's own glow
//    (--floor-light-opacity); it never reads as a Warning (rule 3: those are hot, hard-edged and quick).
//  - Reduce effects (and ?ambient=0, which builds none) holds a steady colour. All of it is uniforms.
//  - The pools belong to the room (they are added to the apartment), so the overdraw budget counts them with the room's own
//    pieces, not with what a fight adds.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { glowPool } from './treasure-glow.js';

// The screensaver's colour at clock t (seconds), centre of the screen. The TV's shader draws the same sum,
// so the pool in front of it matches. `rate` is rad/s; the clock wraps every 600 s (ambient.js), so keep it a
// whole number of turns per wrap: 2 * pi * k / 600.
export function screenColor(t, out, rate = LOOK.num('floor-light-rate', 0.2094)) {
  return out.setRGB(0.5 + 0.5 * Math.cos(t * rate), 0.5 + 0.5 * Math.cos(t * rate + 2.0), 0.5 + 0.5 * Math.cos(t * rate + 4.0));
}

export class FloorLight {
  constructor(scene, spots = [], calm = () => false, clock = () => 0) {
    this.calm = calm;
    this.clock = clock;
    this.rate = LOOK.num('floor-light-rate', 0.2094);
    this.pools = spots.map((s) => {
      const mesh = glowPool('lamp', '#ffffff');
      mesh.position.set(s.at[0], LOOK.num('floor-light-lift', 0.015), s.at[1]);
      mesh.scale.setScalar(s.r);
      mesh.material.uniforms.uOpacity.value = LOOK.num('floor-light-opacity', 0.28);
      mesh.visible = true;
      mesh.name = `Floor light ${s.kind}`;
      scene.add(mesh);
      mesh.updateMatrixWorld(true);   // (the apartment is frozen: nothing updates a piece added to it later)
      return { mesh, kind: s.kind, phase: s.phase || 0 };
    });
    this.tmp = new THREE.Color();
    this.update(0);
  }

  update() {
    if (!this.pools.length) return;
    const t = this.calm() ? 0 : this.clock();
    for (const p of this.pools) {
      const u = p.mesh.material.uniforms;
      if (p.kind === 'night') {   // pink -> amber -> lilac, slowly
        const k = 0.5 + 0.5 * Math.sin(t * this.rate * 0.5 + p.phase);
        this.tmp.setHSL(THREE.MathUtils.lerp(0.95, 0.09, k), 0.7, 0.62);
      } else screenColor(t, this.tmp, this.rate).lerp(WHITE, 0.25);   // a little washed: it is light, not paint
      u.uColor.value.copy(this.tmp);
      u.uTime.value = t * 0.3;
    }
  }
}
const WHITE = new THREE.Color(1, 1, 1);
