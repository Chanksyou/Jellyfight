// The apartment's lights were tuned for three.js r128, which used "legacy" light units.
// Newer three.js only has physical units, so without this every lamp would look different.
//  - patchLegacyFalloff: restores the old point/spot distance falloff (call before anything compiles)
//  - scaleLightsOnRender: legacy mode multiplied direct and ambient light by PI; do the same for each render
export function patchLegacyFalloff(THREE) {
  const re = /float getDistanceAttenuation\([\s\S]*?return distanceFalloff;\s*\}/;
  const chunk = THREE.ShaderChunk.lights_pars_begin;
  if (!re.test(chunk)) {
    console.warn('legacy-lighting: getDistanceAttenuation not found; lights will use physical falloff');
    return;
  }
  THREE.ShaderChunk.lights_pars_begin = chunk.replace(re, `float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	if ( cutoffDistance > 0.0 && decayExponent > 0.0 ) return pow( saturate( - lightDistance / cutoffDistance + 1.0 ), decayExponent );
	return 1.0;
}`);
}

// lite: phones. Point and spot lights (the lamps) are hidden for the draw and the sky light is
// boosted to make up for them. Hiding them the same way every frame keeps the GPU programs
// fixed, so nothing recompiles.
export const LIGHTING = { lite: false, skyBoost: 3 };

export function scaleLightsOnRender(renderer, scene) {
  const render = renderer.render.bind(renderer);
  let lights = [];
  let age = Infinity;
  renderer.render = (s, cam) => {
    if (s !== scene) return render(s, cam);
    if (++age > 120) { // lights get added over time (lamps, club mode); rescan every ~2 s
      lights = [];
      scene.traverse((o) => { if (o.isLight) lights.push(o); });
      age = 0;
    }
    const lite = LIGHTING.lite;
    for (const l of lights) {
      l.intensity *= Math.PI;
      if (lite && (l.isPointLight || l.isSpotLight)) { l._wasVisible = l.visible; l.visible = false; }
      if (lite && (l.isHemisphereLight || l.isAmbientLight)) l.intensity *= LIGHTING.skyBoost;
    }
    try {
      render(s, cam);
    } finally {
      for (const l of lights) {
        l.intensity /= Math.PI;
        if (lite && (l.isPointLight || l.isSpotLight)) l.visible = l._wasVisible;
        if (lite && (l.isHemisphereLight || l.isAmbientLight)) l.intensity /= LIGHTING.skyBoost;
      }
    }
  };
}
