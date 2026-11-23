// Heat shimmer over the vents: an experiment, on only with index.html?shimmer=1 (src/experiments.js), on Medium
// and High (Low has no picture to bend). Each frame, right after the room is drawn, the vents' heat scene
// (vent-air.js: the wisps again, wider) is drawn into a small bend map, hidden wherever the room stands in
// front of the air (it reads the room's depth); the output pass (graphics.js) then reads the picture a few
// pixels aside where the map says. One small map, one draw, one more look-up a pixel; no light, nothing uploaded.
import * as THREE from 'three';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { LOOK } from './look.js';

export class ShimmerPass extends Pass {
  // heat: the vents' heat scene; depth(readBuffer): the depth texture the room was just drawn with
  constructor(heat, camera, depth) {
    super();
    this.heat = heat; this.camera = camera; this.depth = depth;
    this.needsSwap = false;   // draws only its own map
    this.scale = LOOK.num('vent-shimmer-scale', 0.5);
    this.map = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });   // signed bends, added up
    this.clear = new THREE.Color(0, 0, 0);
  }
  setSize(w, h) { this.map.setSize(Math.max(1, Math.round(w * this.scale)), Math.max(1, Math.round(h * this.scale))); }
  render(renderer, writeBuffer, readBuffer) {
    const r = renderer, wasColor = r.getClearColor(new THREE.Color()), wasAlpha = r.getClearAlpha(), cam = this.camera, caps = r.capabilities;
    for (const o of this.heat.children) {
      const u = o.material.uniforms;
      u.tDepth.value = this.depth(readBuffer);
      u.uRes.value.set(this.map.width, this.map.height);
      u.depthMode.value = caps.reversedDepthBuffer ? 2 : caps.logarithmicDepthBuffer ? 1 : 0;
      u.near.value = cam.near; u.far.value = cam.far; u.logFar.value = Math.log2(cam.far + 1);
    }
    r.setRenderTarget(this.map);
    r.setClearColor(this.clear, 0);
    r.clear(true, false, false);
    r.render(this.heat, cam);
    r.setClearColor(wasColor, wasAlpha);
  }
  dispose() { this.map.dispose(); }
}
