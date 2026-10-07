# three.js performance and graphics for Jelly Fight (phones first)

Research note, 2026-10-07. The question: which three.js techniques, rendering strategies and
recent changes (r170 to r186.1, the current release) would most improve performance and looks,
especially on mid-range Android phones in Chrome, and what this codebase should change.

How this was checked. I read the game's code. I then checked three.js claims against the npm
tarballs of three r170, r171 to r185 and r186.1 (the source code is the primary source) and against
the three.js manual pages in the GitHub repo. Library claims come from the libraries' own READMEs,
changelogs and npm source. Some sites were blocked by this sandbox's network proxy: threejs.org,
developer.chrome.com, MDN's site, khronos.org and gltf-transform.dev. Where I could, I used the same
text from GitHub mirrors of those docs (mdn/content, three.js `manual/pages`,
KhronosGroup/WebGL). Claims I could not trace to a primary source are marked **(unverified)**.

I measured things in headless Chromium with **SwiftShader**, a CPU rasterizer. Its draw-call and
triangle counts are exact. Its timings only show relative cost and do not predict phone frame
times. I had no real Pixel to test on.

---

## Summary: top recommendations, ranked

1. **Cap the number of lamps the shader evaluates on phones.** Act 1 lights every lit pixel with 16 point lights, 3 spot lights and a hemisphere light. Keep a fixed count of "light slots" (for example 4 to 6) and fill them each frame with the lamps that matter most near the jelly and camera. Because the count stays the same, no shader is rebuilt. This is the largest phone win I found. In SwiftShader, keeping only the 4 nearest lights cut frame time by 27%. Darker distant corners could change visibility, so the owner decides first.
2. **Adaptive resolution.** Scale `renderer.setPixelRatio` from measured frame time, between a floor and the current cap (1.5 on phones), with hysteresis. Put the limits in `look.css`. This is cheap, can be undone, and does not change rules.
3. **Stop drawing full-rate frames behind menus.** Draw at about 10 to 20 fps, or only on change, while the pause menu, a pick screen or the creator is up. This saves battery and heat on phones.
4. **Cheaper materials on the `low` tier.** Bubbles use iridescence plus clearcoat. The jelly uses clearcoat plus sheen. The fine detail normal maps are on every floor and wall. On `low`, swap these for cheaper variants. Every one of these runs its per-light loop against all 20 lights.
5. **Add renderer stats to the F3 readout** (`renderer.info` draw calls, triangles, programs, textures) and profile once on a real Pixel. Use Chrome remote debugging plus Spector.js. Every other number in this note should then be re-checked on a phone.
6. **Upgrade three r170 to r186 on the same `WebGLRenderer`** (a medium move). I ran a smoke test: the game boots on r186 with no console errors, collision works, and the legacy-lighting patch still applies. What the upgrade brings: `reversedDepthBuffer` (r179), which can replace the desktop's logarithmic depth and win back early-z; `outputBufferType` + `setEffects()` (r182); and bug fixes. **Do not** upgrade the vendored three-mesh-bvh past 0.9.3 without changing `src/collision.js`, which reads BVH internals whose layout changed in 0.9.4.
7. **Bake the static lamp light and AO into the apartment** (a big move). Use vertex colours or lightmaps from `tools/export.mjs`. Phones would then get the warm-pools-and-dark-corners look with almost no dynamic lights, plus the contact darkening that only desktop gets from N8AO today. Effort is large, and it conflicts with the layout editor moving furniture.
8. **WebGPURenderer + TSL: not now.** WebGPU ships on Android Chrome 121+ (Android 12+, ARM/Qualcomm GPUs), and r184 to r186 added clustered and dynamic lighting, TAAU/FSR1 upscaling and a node post stack. But the three.js manual still calls the renderer experimental. Moving would mean rewriting every custom shader in the game (legacy lighting, `TeleMaterial`, `GlowPoints`, the batcher's opacity hook, N8AO, DOF). Revisit after items 1 to 6, on a branch, measured on a Pixel.

Draw calls are **not** the main phone problem today. Measured from the start position in act 1,
frustum culling leaves 111 to 152 draw calls per view (1,081 with culling off). The batcher keeps
fights at "~300" (README). Per-pixel shading cost is the main problem: lights, physical
materials and the pixel count.

---

## Current state of the renderer (with citations)

### Renderer and colour

- `WebGLRenderer({ antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: !IS_TOUCH })`: `src/boot.js:18`. Phones get canvas MSAA and **no** log depth. Desktop gets log depth.
- Pixel ratio `min(devicePixelRatio, IS_TOUCH ? 1.5 : 2)`, fixed at boot. No quality tier changes it: `src/boot.js:19`.
- `outputColorSpace = SRGBColorSpace`, `toneMapping = ACESFilmicToneMapping`: `src/boot.js:20-21`. `THREE.ColorManagement.enabled = false` because the apartment was authored for r128: `src/boot.js:12`.
- Legacy light units. `patchLegacyFalloff` regex-replaces `getDistanceAttenuation` in `ShaderChunk.lights_pars_begin`: `src/legacy-lighting.js:5-16`. `scaleLightsOnRender` wraps `renderer.render` to multiply every light's intensity by π for each render and rescans the scene for lights every 120 frames: `src/legacy-lighting.js:18-36`.
- Camera: 60° FOV, near 0.002, far 200: `src/boot.js:25`. The near plane on phones is 0.005: `src/main.js:297`.
- Frame loop: `renderer.setAnimationLoop` → `GAME.step(dt)` + `GAME.render()`: `src/main.js:485-493`. It always runs at full rate, including behind menus. Rendering is `batcher.sync()` then `gfx.render()`: `src/systems.js:187-192`.

### Quality tiers (`src/graphics.js`)

- Tiers are `low | medium | high`. The default is `IS_TOUCH ? 'low' : 'high'` (`src/main.js:170`), saved in localStorage (`src/graphics.js:100-111`).
- **low**: no composer, a plain `renderer.render` (`src/graphics.js:120`, `:170-174`). It still renders every light, every physical material and the detail normal maps.
- **medium**: N8AO in `Performance` mode at half resolution, then a NaN/Inf clamp pass, UnrealBloom and OutputPass (`src/graphics.js:128-152`).
- **high**: N8AO in `Medium` mode at full resolution with 4× MSAA on its beauty target (`:138`), a 24-tap disk DOF that reads depth about 25 times per pixel (`:55`, `:143`), then bloom and output.
- The composer path still has the canvas created with `antialias: true`. On medium/high the canvas MSAA buffer only receives the final full-screen quad, so its memory and resolve are wasted. The cost is small, and I measured nothing for it.

### Lights

- The lights come from `assets/apartment.json`, created per act part: `src/apartment.js:63`, `:107-122`. Act 1 loads **15 point lights, 3 spot lights and 1 hemisphere light**. `ShadowSystem` adds one more point light for the jelly's glow (`src/systems.js:136`). I measured 16 point, 3 spot and 1 hemisphere light in the scene.
- Point-light cutoff distances are 1.1 to 5 m, in a living room about 5 m across. From the start position, the nearest light is the jelly's own; the other 18 are 2.0 to 5.9 m away. So most of them reach most of the room.
- `scene.environment` is a small PMREM room gradient (`src/apartment.js:171-205`) at `environmentIntensity` 0.12 (`src/main.js:136`). Fog is `FogExp2` (`src/main.js:138`), which costs very little.
- **There are no shadow maps.** `renderer.shadowMap.enabled` is never set anywhere in `src/`. Every `castShadow = true` (critters, elites, tentacles, the batcher at `src/batch.js:82,101`) does nothing and costs nothing. The comment at `src/systems.js:122-123` ("re-renders its shadow map when furniture moves") is stale. The only shadows are the blob under the jelly (`src/systems.js:124-153`) and N8AO on medium/high.
- The light count is part of the program cache key (`numPointLights` / `numSpotLights` in r170 `WebGLPrograms.js:320-321,452-453`). Adding or removing a light recompiles every lit material. Today acts change by reloading the page, and `warmUp()` precompiles (below), so this only matters for any future change to the light count during play.

### Apartment geometry and textures

- One `.glb` per act is created by `tools/split.mjs`. The pipeline is gltf-transform `dedup` / `weld` / `prune`, then `meshopt` at level `medium`, plus a quantize-only `-q` fallback (`tools/compress.mjs:18-24`, `tools/split.mjs:78-83`). The game uses three's WASM `MeshoptDecoder` (`src/apartment.js:13-19`).
- Act 1 file (`assets/apartment-act1.glb`, 3.6 MB): 1,072 nodes, 910 mesh nodes, 727 meshes/primitives, **313 materials**, 74 images (JPEG/PNG, 0.91 MB packed, mostly 64 to 512 px). Extensions: `EXT_mesh_gpu_instancing` (24 nodes), `EXT_meshopt_compression`, `KHR_mesh_quantization`, clearcoat/sheen/ior/emissive_strength/unlit. Only **101 materials have a base-colour texture**. None have occlusion, normal or roughness maps. 579 of 727 primitives have **no UVs**, and 212 have vertex colours. (Numbers read from the glb's JSON chunk.)
- Estimated texture VRAM for act 1, decoded to RGBA8 with mips: about 22 MB. This is moderate.
- At load, `prepareMeshes` unpacks quantized positions to Float32 for the BVH, sets anisotropy (4 on touch, 8 otherwise) and turns `bump:` material names into bump maps (`src/apartment.js:75-101`). `addSurfaceDetail` clones materials to add tiling detail normal maps (two 256² textures generated on the CPU) to every textured standard material (`src/main.js:144`, `src/detail.js`).
- Measured (SwiftShader, 915×412, low quality, act 1 start): **111 to 152 draw calls and 19k to 99k triangles** depending on camera yaw. Culling off: 1,081 calls, 326k triangles. The scene has 1,239 meshes, 461 materials and 165 compiled programs. `renderer.info.memory` reports 309 geometries and 54 textures.

### Small moving things, VFX, materials

- `src/batch.js`: every tracked mesh moves to a hidden layer. Each frame `sync()` groups visible meshes by geometry+material into one `InstancedMesh` per group. It writes matrices with `addUpdateRange`, keeps per-instance colour and opacity through an `onBeforeCompile` patch (`:17-30`), and turns off frustum culling on the batches (`:62`). This is the right design for this game.
- `src/vfx.js`: `TeleMaterial` (a custom `ShaderMaterial`, `:37-106`) and `GlowPoints` (one `THREE.Points` draw for every glow, additive, capped at 900; `:112-200`). `GlowPoints.update` re-uploads all four attributes in full each frame and allocates a 4-element array each frame (`:194`). The cost is minor.
- Material mix: mostly `MeshStandardMaterial`. `MeshPhysicalMaterial` is used for the jelly (clearcoat + sheen, transparent outer bell: `src/character.js:167,290`), bubbles (clearcoat + **iridescence**, transparent: `src/bubbles.js:70-71`), the Clog (clearcoat, one `transmission: 0.2`: `src/clog.js:125`) and a few props. Each of these pays the full per-light loop for all 20 lights.
- Shader warm-up: `warmUp()` spawns one of everything, syncs batches and calls `renderer.compileAsync(scene, camera)` behind the Play button (`src/main.js:394-449`). r170's `compileAsync` polls `KHR_parallel_shader_compile` when it is available (r170 `WebGLRenderer.js` around lines 1043-1079). Good.

### Collision

- `src/collision.js` builds a three-mesh-bvh `MeshBVH` per collider (`indirect: true`, `:8`, `:28`). `cast()` walks the BVH's packed node buffer **directly** (`bvh._roots`, the leaf flag at `u16[n*2+15]`, the right child at `u32[n+6]` treated as an *absolute* index: `:146-176`). It allocates nothing on a miss. That is good for the CPU, but it depends on undocumented internals (see the three-mesh-bvh section).
- Hot loops mostly reuse scratch vectors (`src/enemies.js`, `src/collision.js:35-44`). I did not audit every `clone()` in `elites.js` (53) or `bubbles.js` (18), and some may be per-frame.

---

## Findings by topic

### 1. What changed in three.js since r170 (checked in the npm source for each release)

- **Latest release:** r186.1 (npm `three@0.186.1`, published 2026-09-24; `npm view three time`).
- **`WebGLRenderer` is maintained but frozen for large features.** The manual says: "`WebGLRenderer` is still maintained and the recommended choice for pure WebGL 2 applications. However, … there are no plans to add larger new features to the renderer since the project's focus is now on `WebGPURenderer`" ([manual/pages/webgpurenderer.html](https://github.com/mrdoob/three.js/blob/dev/manual/pages/webgpurenderer.html)).
- **The `WebGPURenderer` maturity caveat is still in the manual:** "The renderer itself is still in an experimental state … depending on your application and scene setup, you will encounter missing features or a better performance with `WebGLRenderer`." `ShaderMaterial`, `RawShaderMaterial`, `onBeforeCompile()` and `EffectComposer` "are not supported in `WebGPURenderer`" (same page). It falls back to WebGL 2 automatically, or always with `forceWebGL: true` (same page; r186 `src/renderers/webgpu/WebGPURenderer.js:41,57`).
- **New `WebGLRenderer` options**, located by grepping each release's `src/renderers/WebGLRenderer.js`:
  - `reversedDepthBuffer`, **from r179**. It "Requires the `EXT_clip_control` extension. This is a more faster and accurate version than logarithmic depth buffer" (r186 `WebGLRenderer.js` JSDoc, around line 3701). It falls back with a warning when the extension is missing (`WebGLCapabilities.js:96-100`). The same JSDoc says `logarithmicDepthBuffer` "uses `gl_FragDepth` if available which disables the Early Fragment Test optimization and can cause a decrease in performance."
  - `outputBufferType` + `setEffects()`, **from r182**. With `HalfFloatType` output the renderer runs post effects itself and "Tone mapping and color space conversion are applied automatically", so no `OutputPass` is needed (r186 `WebGLRenderer.js:743-771`).
  - Node-material compatibility in WebGL through `renderer.setNodesHandler(new WebGLNodesHandler())`, **from r184**. The source describes it as "Compatibility loader and builder for TSL Node materials in WebGLRenderer" (`examples/jsm/tsl/WebGLNodesHandler.js`). I did not test what it covers.
- **The WebGPU-side addons that matter here** (checked by listing `examples/jsm` in each release):
  - `lighting/DynamicLighting.js` (**r184**): it "batches supported analytic lights into uniform arrays so light count changes do not recompile materials". Defaults are 16 point + 16 spot. `WebGPURenderer` only (`import … from 'three/webgpu'`).
  - `lighting/ClusteredLighting.js` (**r185**, replacing `TiledLighting.js` from r170): "Forward+ Clustered Shading … only the lights actually reaching each fragment are evaluated". It handles point lights only (`maxLights`, "Maximum number of point lights") and builds clusters with a **compute** pass (`ClusteredLightsNode.js:206`). WebGPURenderer only. **(Unverified:** whether it works on the WebGL 2 fallback backend.)
  - `lighting/LightProbeGrid.js` (WebGPU) and `LightProbeGridWebGL.js` (**r184**): a "3D grid of L2 Spherical Harmonic irradiance probes that provides position-dependent diffuse global illumination", baked on the GPU. The WebGL version works with `WebGLRenderer`. This could be a cheap way to give the bugs and the jelly room-correct fill light.
  - `tsl/display/FSR1Node.js` and `TAAUNode.js` (**r184**): spatial and temporal upscalers. FSR1's own note says: "Only use FSR 1 if your application is fragment-shader bound … simply shaded scenes will render faster at native resolution without it."
  - Also `SMAANode`, `FXAANode`, `GTAONode`, `SSGINode`, `BloomNode` (selective bloom through MRT `emissive`), and `DepthOfFieldNode`.
- **Renames and deprecations that touch this code:**
  - `PostProcessing` was renamed `RenderPipeline` (**r183**, `src/renderers/common/PostProcessing.js:5`).
  - `THREE.Clock` is deprecated in favour of `THREE.Timer` (**r183**, `src/core/Clock.js:6`). The game defines its own `Clock` in `src/systems.js:17`, so it is not affected.
  - `PCFSoftShadowMap` is deprecated (**r186**, `src/constants.js:73`).
  - The `*Async` renderer methods are deprecated in favour of `await renderer.init()` (**r181**, WebGPURenderer).
  - `EffectComposer`, `UnrealBloomPass`, `ShaderPass`, `OutputPass` and `SMAAPass`/`FXAAPass` still ship in r186 `examples/jsm/postprocessing/`.
- **The legacy-lighting patch still applies in r186.** `lights_pars_begin` still contains `float getDistanceAttenuation(… return distanceFalloff; }` (r186 `ShaderChunk/lights_pars_begin.glsl.js:69`), and `opaque_fragment` (used by `src/batch.js:25`) still exists.
- **My smoke test of r186.1 with this game:** I served the r186 build through the tests' `JF_THREE` hook. The game booted with no console errors, the legacy patch applied, `world.cast` hit the floor, and low/medium/high all rendered. A low-quality screenshot looked the same as r170, apart from randomised UI cards. I did **not** run the story suite on r186.
- **Release-note highlights** (from the [GitHub releases page](https://github.com/mrdoob/three.js/releases), read with a summariser that garbled the dates, so treat this as a pointer and not a quote): r186 "Add SunLight with cascaded shadow maps", "Add DirectRenderPipeline"; r184 "Make `compileAsync()` truly non-blocking" (WebGPU), "Add NodeMaterial compatibility layer" (WebGL); r185 "TSL … improves compilation performance by 3.0x". I confirmed that `SunLight`/`SunLightShadow` exist in r186 `examples/jsm/lights/`. An indoor night scene has no use for a sun anyway.

### 2. WebGPU on Android Chrome

- The gpuweb implementation-status wiki ([source](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status), raw markdown read) lists Chromium Android support as:
  - "✅ ARM/Qualcomm/Intel, Android 12+: [Chrome] 121"
  - "✅ Imagination, Android 16+: 139"
  - "👷 Samsung Xclipse, Android 12+: TBD"
  - "👷 Others: TBD"
  
  It links each to Chrome's "new in WebGPU" posts (developer.chrome.com was blocked here).
- What that means for Pixels: Pixel 6 to 9 use Arm Mali GPUs (Tensor G1 to G4), which are covered from Chrome 121 on Android 12+. **(Unverified:** the Pixel 10's Tensor G5 GPU vendor. If it is Imagination, it needs Android 16+ and Chrome 139+.) Samsung Exynos phones with Xclipse GPUs do not have WebGPU yet, so the WebGL 2 path must stay first-class regardless.
- Firefox for Android has WebGPU only "Behind a flag" (same wiki).

### 3. BatchedMesh vs InstancedMesh vs merged geometry

- `InstancedMesh`: one geometry and one material, many transforms. This is the right tool for `src/batch.js`, which is already well built.
- `BatchedMesh`: "render a large number of objects with the **same material** but with different geometries or world transformations" (r186 `src/objects/BatchedMesh.js` JSDoc). It uses `WEBGL_multi_draw` (`WebGLBufferRenderer.js:33`) and has per-instance `setColorAt`, `setVisibleAt`, `perObjectFrustumCulled` and `sortObjects`. For the apartment the blocker is **313 materials**: BatchedMesh needs one material per batch.
- Merging (gltf-transform): `join` "Joins compatible Primitives and reduces draw calls", best after `dedup` + `flatten`, with the note that "In a Scene that heavily reuses the same Mesh data, joining may increase vertex count. Consider … instancing". `palette` "Creates palette textures containing all unique values of scalar Material properties … then merges materials", and "Materials already containing texture coordinates (UVs) are not eligible" (source in `@gltf-transform/functions@4.5.1` `src/join.ts`, `src/palette.ts`). That fits this apartment: 579 of 727 primitives have no UVs. `instance()` creates `EXT_mesh_gpu_instancing` from shared meshes, and the files already use it on 24 nodes.
- What it means here: draw calls are at 111 to 152 per view, so merging is a modest win. It also conflicts with how the game uses nodes. The layout editor moves furniture by node name (`src/layout.js`, `src/layout-baked.js`), stages look nodes up by name, doors swing (`src/apartment.js:125-136`), and collision builds one BVH per mesh. Only the `Shell…` nodes (walls, floors, ceilings; `tools/split.mjs:24`) are never moved, so they are the safe candidates.

### 4. Texture compression (KTX2/Basis) and mesh compression

- MDN: GPU-compressed formats are "smaller on in GPU memory, and are faster to sample from. (This reduces texture memory bandwidth, which is precious on mobile)". It also notes they are "generally only acceptable for colors (not e.g., normals …)". Basis Universal "offers a way to support all common compressed texture formats with a single compressed texture file" ([mdn/content WebGL best practices](https://github.com/mdn/content/blob/main/files/en-us/web/api/webgl_api/webgl_best_practices/index.md)).
- three's `KTX2Loader` transcodes Basis with a WASM transcoder in a **Web Worker created from a `Blob` URL** (r186 `examples/jsm/loaders/KTX2Loader.js:329-334`). `src/apartment.js:38-41` already records that claude.ai's page policy blocked `fetch()` of `blob:` URLs. **(Unverified:** whether `new Worker(blob:)` is allowed there.) This needs a test on the artifact before relying on it.
- What it means here: act 1 holds only about 22 MB of decoded texture. KTX2 would save VRAM and bandwidth, but this is not the bottleneck. It is low priority, and only worth doing for colour textures.
- Mesh compression is already right. The pipeline uses meshopt (`EXT_meshopt_compression`) plus quantization. meshoptimizer's README notes that Draco-style codecs "typically are designed to maximize the compression ratio at the cost of disturbing the vertex/index order (which makes the meshes inefficient to render on GPU) or decompression performance" ([meshoptimizer README](https://github.com/zeux/meshoptimizer/blob/master/README.md)). Keep meshopt. `level: 'medium'` reorders for cache efficiency already.

### 5. Shadows and ambient occlusion

- The three.js manual on shadows: each shadow-casting point light renders the scene 6 extra times. "Another solution is to use fake shadows" (a blob texture), which is what the game does ([manual/pages/shadows.html](https://github.com/mrdoob/three.js/blob/dev/manual/pages/shadows.html)). With 18 lamps, real shadow maps are off the table on phones. Keeping them disabled is correct.
- N8AO's README: `halfRes` gives "generally 2x-4x" speed-up, and depth-aware upsampling costs "a fixed cost of around 1ms". The quality table lists `Performance` as for "Mobile, Low-end iGPUs" and `Low` as for "High-End Mobile". Transparent objects with transparency support on "will be rendered twice" ([n8ao README](https://github.com/N8python/n8ao/blob/master/README.md)). N8AO is WebGL `EffectComposer`-based, so it would not move to WebGPURenderer.
- Baked AO and light: the glb has no `occlusionTexture` and most primitives have no UVs. A lightmap bake needs a second UV set (gltf-transform has `unwrap`), or the bake can go into per-vertex colour, which needs no UVs but is limited by mesh density. Both are build-time work in `tools/`. three's `LightProbeGridWebGL` (r184+) is a runtime alternative for **diffuse** indirect light on moving things. It does not replace direct lamp light.

### 6. Adaptive resolution and frame-time quality scaling

- The three.js manual on HD-DPI: "Mobile GPUs have less power than desktops … top of the line phones have an HD-DPI ratio of 3x … they have to do 9x the rendering … For any heavy three.js app that's probably what you want [render at 1x] otherwise you're likely to get a slow framerate" ([manual/pages/responsive.html](https://github.com/mrdoob/three.js/blob/dev/manual/pages/responsive.html)).
- MDN: "A common (and easy) way to trade off quality for speed is rendering into a smaller back buffer, and upscaling the result" (WebGL best practices, linked above).
- The game caps phones at 1.5 (`src/boot.js:19`). A frame-time controller is a design choice, not a library feature. Nothing in three.js does it for you on `WebGLRenderer`. **(Unverified:** how Chrome on Android paces rAF on 90/120 Hz Pixel displays.) The controller should measure the real frame interval, as `DebugSystem` already does (`src/systems.js:171-176`), and not assume 60.

### 7. Shader precompilation

- MDN: prefer `KHR_parallel_shader_compile`, which "provides a *non-blocking* `COMPLETION_STATUS` query" (best-practices page above; spec mirror [KhronosGroup/WebGL extension.xml](https://github.com/KhronosGroup/WebGL/blob/main/extensions/KHR_parallel_shader_compile/extension.xml)).
- three's `compileAsync` uses it when present (r170 and r186 source). The game already warms everything up (`src/main.js:394-449`). The remaining risk is anything that changes a program key **during** play: a light count change, a new material permutation such as a first `FLASH` swap on a new mesh type, or a texture appearing. A recompile then stalls the frame. Light slots (proposal Q1) keep the light count fixed for exactly this reason.

### 8. Culling and room-based visibility

- Per-object frustum culling is on for the apartment, and it already takes 1,081 calls down to 111 to 152. Act splitting (`tools/split.mjs:23`) already removes other rooms' geometry and lamps. Act 1 still loads the hallway, the whole shell and the hall lights (`apartment-act1.glb`). One cheap step: **turn off lamps whose room is not in the current stage's `rooms`**. In act 1 the hall lights shine in a hallway you can see but not enter. **(Unverified** for this game: which of the 18 act-1 lights are hallway lights. The positions at x≈0.45 and x≈4.6 look like them.) That is a data change, not new code.
- Occlusion culling (GPU queries, portals) is not offered by three.js core. The win would be small at 111 to 152 calls. Skip it.

### 9. Cheap mobile post: bloom, AA

- pmndrs `postprocessing`'s `EffectPass` "automatically organizes and merges any given combination of effects. This minimizes the amount of render operations", and draws with one full-screen triangle ([pmndrs/postprocessing README](https://github.com/pmndrs/postprocessing/blob/main/README.md)). Moving `graphics.js` to it could fold the Finite clamp, DOF/vignette and bloom composite into fewer passes on desktop. N8AO ships a pmndrs-compatible `N8AOPostPass` (n8ao README).
- Phones: today they get no bloom. `vfx.js` glows are already additive point sprites, so combat reads fine. A cheap "fake bloom" for lamps and screens is a few warm halo sprites at emissive lamp positions. **Flag:** CLAUDE.md rule 3 says hostile is hot and saturated. Lamp halos must stay pale warm-white and low-saturation so they never read as an attack.
- AA: phones already use canvas MSAA (`antialias: true`) without a composer. That is the cheapest AA on tile-based GPUs and better than FXAA/SMAA for geometry edges. Keep it. On medium/high, the N8AO beauty target has 4× MSAA only on high (`src/graphics.js:138`). Medium has no AA on the scene render, so a single FXAA/SMAA pass would help there (`FXAAPass`/`SMAAPass` exist in r186 `examples/jsm/postprocessing/`).

### 10. Fog and haze

- `FogExp2` is computed in each material's fragment shader and is cheap. The `look.css` `--haze` is fine as it is. No change.

### 11. GPU particles for VFX

- `GlowPoints` is one `Points` draw, with the CPU updating up to 900 particles. That is already cheap. A GPU (TSL compute) particle system is WebGPU-only work. The phone risk with point sprites is **fill**: `gl_PointSize` is clamped to 256 px (`src/vfx.js:136`), and many large additive points near the camera overdraw. On `low`, the clamp could be lowered or size scaled with the adaptive pixel ratio.

### 12. Profiling tools

- `renderer.info` (`render.calls`, `triangles`, `programs`, `memory`) is in every version and is what I used here. The game's F3 readout does not show it yet (`src/systems.js:182`).
- Spector.js is a Chrome extension and standalone script for capturing WebGL frames ([Spector.js README](https://github.com/BabylonJS/Spector.js/blob/master/readme.md)).
- N8AO exposes `lastTime` per frame for AO cost (n8ao README).
- Chrome DevTools Performance panel and remote debugging of an Android phone over USB: **(unverified** here, because developer.chrome.com was blocked). It is the standard workflow, but I couldn't quote the docs.

### 13. three-mesh-bvh upgrade hazard (important)

- The vendored copy is 0.8.3 (`vendor/three-mesh-bvh.module.js:1`). The latest is 0.9.15. The changelog for 0.9.4 says: "Changed the internal storage of child indices from uint32 offsets to node indices" ([CHANGELOG](https://github.com/gkjohnson/three-mesh-bvh/blob/master/CHANGELOG.md)). In 0.9.15 `RIGHT_NODE` is `n32 + relativeOffset * UINT32_PER_NODE` (`src/core/utils/nodeBufferUtils.js`). In 0.8.3 it is the absolute `uint32Array[n32 + 6]`.
- `src/collision.js:176` uses the old absolute form. **Upgrading the vendor file without changing `castMesh` would silently break every ray**, so jelly movement, camera and enemy line of sight would all fail. If an upgrade happens, port `castMesh` to the relative offset, or use the library's public `raycastFirst`/`shapecast`.
- 0.9.x requires three ≥ 0.159 (`package.json` peerDependencies). The current 0.8.3 also works on r186, as my smoke test showed.

---

## Proposals for this codebase

Legend: payoff is P = phone, D = desktop. Effort is S/M/L. "Balance?" means the change could make the game harder or easier (CLAUDE.md rule 5: offer the balance bot, never run it unasked).

### Quick wins

| # | Change (where) | Payoff | Effort | Risk | Reversible | Balance? | CLAUDE.md notes |
|---|---|---|---|---|---|---|---|
| Q1 | **Light slots on phones.** At boot, keep the apartment lamps as data. Create K point-light slots plus the 3 spots once. Each frame (or every few frames), copy the K most relevant lamps into the slots: score each by distance to the jelly or camera against its cutoff `distance`, and fade intensity in and out to avoid popping. The light count never changes, so no recompile. Lives in `src/apartment.js` (where lights are made) plus a small per-frame step in `src/systems.js`. K goes in `look.css` (`--phone-lights`). | P: large (fragment cost scales with the light count; SwiftShader showed −27% at K=4). D: optional. | M | Lamps could pop if fades are short. `legacy-lighting.js` rescans lights (keep it working). | Yes (set K = all) | **Yes**: far corners get darker, and enemies are harder to see there. Offer the balance bot. | Rule 4: K in `look.css`. Rule 2: add a story, e.g. `engine/light-slots` asserting the program count is unchanged after the jelly moves across the room. |
| Q2 | **Turn off lamps in rooms the stage doesn't play in** (hall lights in act 1). Tag them in `tools/split.mjs` or in the stage's data (`src/stage1.js`). | P/D: small to medium | S | The view down the hallway gets darker | Yes | Slight (only areas you can't enter) | Data in the stage file, which is its one home. |
| Q3 | **Adaptive pixel ratio** in `src/graphics.js`. Measure the frame interval. If above budget for about 1 s, step the ratio down by 0.125 to a floor (e.g. 0.75 on phones). If well under for about 3 s, step up to the cap. Limits go in `look.css`. Call `gfx.resize()` after each change. | P: large on heavy scenes. D: small | S | Blurrier on slow phones. Resizing reallocates buffers (keep steps rare). | Yes | No (looks only) | Rule 4. Rule 2: a story that forces slow frames and checks the ratio drops. |
| Q4 | **Throttle frames behind menus**: in `src/main.js:485`, skip `GAME.render()` on most frames while `menuOpen()`. | P: battery and heat | S | Menu animations behind the overlay get choppy | Yes | No | |
| Q5 | **Cheaper `low` materials**: on `low`, bubbles drop iridescence and clearcoat (`src/bubbles.js:70`), the jelly drops sheen (`src/character.js:167`), and `addSurfaceDetail` is skipped (`src/main.js:144`). Read the tier from `gfx.quality`. | P: medium | S | Phones look a bit plainer | Yes | No | Not an id branch; it's a quality setting. Keep friendly bubbles cool-coloured (rule 3). |
| Q6 | **Renderer stats in F3** (`src/systems.js:182`): add `renderer.info.render.calls/triangles`, `programs.length` and `gfx` pixel ratio. Also add them to the Diagnostics panel. | Tooling | S | None | Yes | No | Lets the owner verify Q1 to Q5 on a Pixel. |
| Q7 | **Fix the stale shadow comment** and remove the `castShadow` writes that do nothing (`src/systems.js:122-123`, `src/batch.js:82,101`), or document that shadow maps are off by design. | Clarity | S | None | Yes | No | |
| Q8 | **Desktop composer path without canvas MSAA**: create the context with `antialias` only when the starting tier is `low`, and reload when switching. Medium gets an `SMAAPass`/`FXAAPass`. | D: small (memory and bandwidth); better medium AA | S | A tier switch needs a reload | Yes | No | |
| Q9 | **GlowPoints upload ranges**: use `addUpdateRange(0, n*…)` per attribute, and hoist the attribute-name array (`src/vfx.js:194`). | P/D: tiny | S | None | Yes | No | |

### Medium moves

| # | Change (where) | Payoff | Effort | Risk | Reversible | Balance? | CLAUDE.md notes |
|---|---|---|---|---|---|---|---|
| M1 | **Upgrade three to r186 (stay on `WebGLRenderer` + `EffectComposer`)**: change the import map in `index.html:19-21`, plus the `JF_THREE` note in CLAUDE.md, README and the tests. Then (a) desktop: `reversedDepthBuffer: true` in place of `logarithmicDepthBuffer`. Custom shaders include the `logdepthbuf_*` chunks (`src/vfx.js:29-30`), and `TeleMaterial` uses `polygonOffset` whose sign may need flipping under reversed Z **(unverified)**. (b) Optionally `outputBufferType: HalfFloatType` + `setEffects()` to drop `OutputPass`. | D: early-z back, fewer passes. P: bug fixes only | M | Look drift (light falloff patch verified; colours not checked across all scenes). EXT_clip_control on Android **(unverified)**. | Yes (import map) | No (look only), but run all stories | Rule 2: full story run. Rule 6: screenshots. Rule 9: shipping steps. Keep three-mesh-bvh at 0.8.3, or port `collision.js` first (finding 13). |
| M2 | **Phones step up to `medium` automatically** when Q3's controller has headroom at the cap for a sustained period (AO half-res `Performance` + bloom). | P: looks on high-end phones | M | Thermal throttling later in a run **(unverified)** | Yes | No | Needs Q3 first. |
| M3 | **Desktop post via pmndrs `postprocessing` `EffectPass`**: merge the Finite clamp, DOF+vignette and bloom composite. N8AO has a pmndrs pass. `src/graphics.js`, plus a vendored file under `vendor/`. | D: fewer full-screen passes | M | New dependency. The current `postprocessing-stub.js` would need replacing. | Yes | No | |
| M4 | **Fake lamp bloom on phones**: a pale halo sprite (through `GlowPoints.hold` or a separate `Points`) at each emissive lamp or screen. Positions from `apartment.json` lights. | P: looks | S-M | Could be mistaken for attacks | Yes | Slight (visibility) | **Rule 3 risk**: keep it low-saturation warm-white, never a `--hostile-*` hue. Colours go in `look.css`. |

### Big moves

| # | Change (where) | Payoff | Effort | Risk | Reversible | Balance? | CLAUDE.md notes |
|---|---|---|---|---|---|---|---|
| B1 | **Bake static lamp light and AO** into vertex colours (no UVs needed) or lightmaps (needs `unwrap` + a UV2) in `tools/export.mjs` / `tools/apartment-source.html`. At runtime, phones use the baked term plus 1 to 2 dynamic lights (the jelly's glow, maybe 1 nearby lamp). | P: very large (lighting cost drops to about K=1 to 2, and phones get AO "for free"). D: could replace N8AO. | L | **Conflicts with the layout editor**: moved furniture keeps stale baked light. The re-bake pipeline is long. Hard to match the r128 legacy look. | Yes (keep the dynamic path) | **Yes**: lighting and visibility change everywhere | One home: the bake lives in `tools/`, with values in `look.css`. Needs stories for both paths. |
| B2 | **Shell draw-call merge**: gltf-transform `palette` + `flatten` + `join` on `Shell…` nodes only (`tools/split.mjs`). | P/D: modest (maybe −30 to 60 calls per view, **unmeasured**) | M | Collision per mesh: bigger joined meshes make bigger BVHs, which is fine. Doors must stay separate. | Yes (re-bake) | No | Keep node names for anything the layout editor or stages use. |
| B3 | **KTX2/Basis colour textures** (`tools/compress.mjs` + `KTX2Loader` in `src/apartment.js`) | P: VRAM about 22 MB down to a few MB; small bandwidth win | M | Worker from `blob:` vs claude.ai CSP **(unverified)**. Adds a WASM transcoder to the artifact. | Yes (keep JPEG twin, like `-q`) | No | Rule 9: new files must be copied to the artifact. |
| B4 | **Move to `WebGPURenderer` + TSL** (`three/webgpu` import map). Port `legacy-lighting.js` (a ShaderChunk regex is impossible there; it needs a custom lighting model in TSL), `TeleMaterial`, `GlowPoints`, the batcher's `onBeforeCompile` opacity, `enemies.js` `onBeforeCompile`, `forcefield.js`, and all of `graphics.js` (N8AO → `GTAONode`, DOF → `DepthOfFieldNode`, bloom → `BloomNode` with MRT selective emissive). Gains: `DynamicLighting` (no recompiles), `ClusteredLighting` (point lights only, compute → WebGPU backend only), `TAAUNode`/`FSR1Node` upscaling, `compileAsync` non-blocking (r184). | P: potentially large on WebGPU phones, unknown on the WebGL 2 fallback. D: better post. | L | The manual itself warns "you will encounter missing features or a better performance with `WebGLRenderer`". Samsung Xclipse phones and Firefox Android stay on the WebGL 2 fallback. Every story must be re-proved. | Only via a long-lived branch | Possibly (lighting/visibility) | Rules 3 and 4 still hold but need re-implementing. Stories run in Chromium headless, so WebGPU in headless CI is **(unverified)**. |

---

## Open questions for the owner

1. **Target:** which Pixel models, and what frame rate counts as "good" (30, 60, or the display rate)? Can someone run `index.html` on a real Pixel with the F3 stats from Q6 and report fps, draw calls and programs? Everything here was measured in SwiftShader.
2. **Lights vs visibility:** may phones show fewer lamps (Q1/Q2), with distant corners darker? This could affect balance. Do you want the balance bot run before and after (about 15 minutes each)?
3. **Baking (B1):** is a build-time light bake acceptable given the layout editor moves furniture? Would you accept re-baking after layout edits, or a baked AO only (furniture-independent) with dynamic lamps kept?
4. **three.js version:** should we leave r170 (M1)? Pin r186.1, or stay on r170 until there is a feature you need? Keep three-mesh-bvh at 0.8.3 or port `collision.js`?
5. **WebGPU (B4):** is it a goal at all, given that the WebGL path must stay for Samsung Xclipse and Firefox Android? If it is, should it be a prototype branch only?
6. **Phones on `medium` (M2):** should strong phones get AO and bloom automatically, or should phones stay on `low` with manual opt-in?
7. **Artifact policy:** can someone check whether the claude.ai artifact allows `new Worker(URL.createObjectURL(blob))`? That decides whether KTX2 (B3) is possible there.
8. **Physical materials on phones (Q5):** how much of the jelly's clearcoat/sheen look must phones keep?
