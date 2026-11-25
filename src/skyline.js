// The 33rd-floor view, seen only from indoors. Near towers and the distant panorama
// share one opaque mesh, one texture and one draw. The atlas has no private photography.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LOOK } from './look.js';
import { AMBIENT } from './ambient.js';

export async function loadSkylineAtlas() {
  try {
    const map = await new THREE.TextureLoader().loadAsync(new URL('../assets/greenpoint.webp', import.meta.url).href);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  } catch {
    return null;   // the room can still play with its usual sky color
  }
}

function panorama(radius, above, below) {
  const first = 106, span = 236;
  const g = new THREE.CylinderGeometry(radius, radius, above + below, 64, 2, true,
    THREE.MathUtils.degToRad(first), THREE.MathUtils.degToRad(span));
  const position = g.attributes.position, uv = g.attributes.uv, index = g.index;
  for (let i = 0; i < position.count; i++) {
    // Model -X is the desk pane, -Z is the couch pane. Reflect the narrow margins
    // at the sides to cover glancing indoor angles beyond the painted composition.
    const column = 1 - (first + span * uv.getX(i) - 154) / 156;
    const u = 1 - Math.abs(1 - Math.abs(column));
    const v = uv.getY(i);
    // Bring the painted streets inward so the city stays under steep looks through the lower glass.
    const reach = v === 0 ? 0.62 : 1;
    position.setXYZ(i, position.getX(i) * reach, v === 0 ? -below : v === 1 ? above : 0, position.getZ(i) * reach);
    uv.setXY(i, (4 + u * 1527) / 2048, v === 0 ? 0 : v === 1 ? 1 : 0.6875);
  }
  for (let i = 0; i < index.count; i += 3) {
    const back = index.getX(i + 1);
    index.setX(i + 1, index.getX(i + 2));
    index.setX(i + 2, back);
  }
  return g;
}

function tower(centre, x, z, width, depth, low, high, type, topRow, bottomRow) {
  const g = new THREE.BoxGeometry(width, high - low, depth);
  const uv = g.attributes.uv, tile = 1538 + type * 254;
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 4);
    const roof = face === 2 || face === 3;
    const x = face === 1 || face === 5 ? 1 - uv.getX(i) : uv.getX(i);
    const y = uv.getY(i);
    uv.setXY(i, (tile + 4 + x * 244) / 2048,
      1 - (roof ? 505 - y * 49 : bottomRow + y * (topRow - bottomRow)) / 512);
  }
  g.translate(x - centre[0], (low + high) / 2, z - centre[1]);
  return g;
}

export function addSkyline(scene, centre, map, { haze = 0 } = {}) {   // haze: rain on the glass (rain.js) softens the city, 0..1
  const above = LOOK.num('skyline-up', 84), below = LOOK.num('skyline-down', 100);
  const parts = [
    // Photo-matched masses. Window bays, crown lights and roof equipment are painted.
    tower(centre, -28, 28, 16, 14, -below, 23, 0, 4, 445),
    tower(centre, 32, -66, 18, 21, -below, 21, 1, 13, 445),
    tower(centre, 33, -67, 15.5, 18.5, 21, 24, 1, 1, 13),
    panorama(LOOK.num('skyline-radius', 132), above, below),
  ];
  const geometry = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  const material = new THREE.MeshBasicMaterial({ map, fog: false, toneMapped: false });
  const daylight = { value: 0 };
  const nightGain = LOOK.num('skyline-night-gain', 0.30);
  const dayGain = LOOK.num('skyline-day-gain', 2.2);
  const dawnStart = LOOK.num('skyline-dawn-start', 315), dawnEnd = LOOK.num('skyline-dawn-end', 475);
  const duskStart = LOOK.num('skyline-dusk-start', 1090), duskEnd = LOOK.num('skyline-dusk-end', 1230);
  // Daytime sky: the photo is a dusk, so after sunrise its sky pixels (blue, and above the roofs) are swapped
  // for a gradient from the scene's own sky colour (overhead) down to a pale horizon, with the sun low on it.
  // Nothing is downloaded: the same atlas, the same draw.
  const sky = {
    mix: { value: 0 }, up: { value: 0 }, horizon: { value: new THREE.Color() }, sun: { value: new THREE.Color() },
    sunAt: { value: new THREE.Vector2(LOOK.num('skyline-sun-x', 640), 0) },
  };
  const skyStart = LOOK.num('skyline-sky-start', 300), skyEnd = LOOK.num('skyline-sky-end', 350);
  const sunStart = LOOK.num('skyline-sun-start', 360), sunEnd = LOOK.num('skyline-sun-end', 480);
  const tints = ['horizon', 'sun'].map((n) => [new THREE.Color(LOOK.color(`skyline-${n}`, '#ffffff')), new THREE.Color(LOOK.color(`skyline-${n}-late`, '#ffffff'))]);
  const sunLow = LOOK.num('skyline-sun-low', 0.03), sunHigh = LOOK.num('skyline-sun-high', 0.4);
  material.userData.daylight = daylight;
  material.userData.sky = sky;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.cityDaylight = daylight;
    shader.uniforms.citySky = { value: scene.background };
    shader.uniforms.cityNightGain = { value: nightGain };
    shader.uniforms.cityDayGain = { value: dayGain };
    shader.uniforms.citySkyMix = sky.mix;
    shader.uniforms.citySunUp = sky.up;
    shader.uniforms.cityHorizon = sky.horizon;
    shader.uniforms.citySun = sky.sun;
    shader.uniforms.citySunAt = sky.sunAt;
    shader.uniforms.cityHaze = { value: haze };
    shader.uniforms.ambientOn = AMBIENT.uniforms.ambientOn;   // the room's one clock (ambient.js): windows switch, beacons blink
    shader.uniforms.ambientTime = AMBIENT.uniforms.ambientTime;
    shader.uniforms.cityLife = { value: new THREE.Vector3(LOOK.num('city-windows', 0.12), LOOK.num('city-window-dim', 0.12), LOOK.num('city-beacon-dim', 0.2)) };
    shader.uniforms.cityHazeColor = { value: new THREE.Color(LOOK.color('rain-haze-color', '#2a3442')) };
    shader.fragmentShader = `
      uniform float cityDaylight, cityNightGain, cityDayGain, citySkyMix, citySunUp;
      uniform vec3 citySky, cityHorizon, citySun, cityHazeColor;
      uniform float cityHaze, ambientOn, ambientTime;
      uniform vec3 cityLife;
      uniform vec2 citySunAt;
    ` + shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      vec3 art = diffuseColor.rgb;
      float luma = dot(art, vec3(0.2126, 0.7152, 0.0722));
      float light = smoothstep(0.14, 0.65, luma);
      vec3 night = art * mix(cityNightGain, 1.05, light);
      if (ambientOn > 0.5 && light > 0.0) {
        // a living city at night: some lit windows switch off and on (a cell is a window, each on its own slow beat; the beat
        // is a whole number of turns per 600 s, the clock's wrap), the red beacons on the tall roofs blink every two seconds
        vec2 cell = floor(vMapUv * vec2(2048.0, 512.0) / 3.0);
        float h = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453), h2 = fract(h * 91.7);
        float beat = ambientTime * 0.010471976 * (3.0 + floor(h2 * 6.0)) + h * 6.2831853;   // 0.010471976 = 2 pi / 600
        float flick = step(h, cityLife.x) * smoothstep(0.35, 0.65, 0.5 + 0.5 * sin(beat));
        float redLamp = step(0.55, art.r) * step(art.g, 0.38) * step(art.b, 0.38);
        float blink = smoothstep(0.35, 0.65, 0.5 + 0.5 * sin(ambientTime * 3.14159265 + h * 0.5));   // period 2 s (600 / 2 is whole)
        night *= mix(1.0, cityLife.y, flick * light * (1.0 - redLamp));
        night *= mix(1.0, mix(cityLife.z, 1.0, blink), redLamp);
      }
      diffuseColor.rgb = night;
      if (cityDaylight > 0.0) {
        float warmLamp = light * smoothstep(0.05, 0.42, art.r - art.b);
        vec3 day = art * mix(cityDayGain, 0.95, light) + citySky * (0.14 * (1.0 - light));
        day = mix(day, vec3(luma * 0.66), warmLamp * 0.7);
        day *= mix(vec3(1.0, 0.8, 0.62), vec3(1.0), citySunUp);   // the first light is warm
        diffuseColor.rgb = mix(night, day, cityDaylight);
      }
      if (citySkyMix > 0.0) {
        // the photo's sky: blue, above the roofs, in the painted panorama (the towers' tiles start at 0.75)
        float skyness = smoothstep(0.15, 0.22, art.b - art.r) * (1.0 - step(0.745, vMapUv.x)) * smoothstep(0.64, 0.68, vMapUv.y);
        float high = clamp((vMapUv.y - 0.69) / 0.31, 0.0, 1.0);
        vec2 toSun = vec2((vMapUv.x * 2048.0 - citySunAt.x) / 150.0, (high - citySunAt.y) * 2.6);
        float halo = exp(-dot(toSun, toSun) * 1.4), disc = smoothstep(0.16, 0.1, length(toSun));
        vec3 dayHigh = mix(cityHorizon, citySky, pow(high, 0.55)) + citySun * (halo * 0.55 + disc);
        diffuseColor.rgb = mix(diffuseColor.rgb, dayHigh, skyness * citySkyMix);
      }
      diffuseColor.rgb = mix(diffuseColor.rgb, cityHazeColor + diffuseColor.rgb * 0.35, cityHaze);   // rain: lower contrast, a little haze
    `).replace('#include <colorspace_fragment>', `
      #include <colorspace_fragment>
      float skyEdge = (1.0 - step(0.75, vMapUv.x)) * smoothstep(0.86, 1.0, vMapUv.y);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, citySky, skyEdge);   // the top blends into the sky colour overhead
    `);
  };
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Skyline';
  mesh.position.set(centre[0], 0, centre[1]);
  mesh.userData.noCollide = true;
  mesh.renderOrder = 10;    // opaque room surfaces write depth before the distant city
  scene.add(mesh);
  return (minutes) => {
    daylight.value = THREE.MathUtils.smoothstep(minutes, dawnStart, dawnEnd)
      * (1 - THREE.MathUtils.smoothstep(minutes, duskStart, duskEnd));
    sky.mix.value = THREE.MathUtils.smoothstep(minutes, skyStart, skyEnd);
    const t = THREE.MathUtils.smoothstep(minutes, sunStart, sunEnd);
    sky.up.value = t;
    sky.horizon.value.copy(tints[0][0]).lerp(tints[0][1], t);
    sky.sun.value.copy(tints[1][0]).lerp(tints[1][1], t);
    sky.sunAt.value.y = sunLow + (sunHigh - sunLow) * t;
  };
}
