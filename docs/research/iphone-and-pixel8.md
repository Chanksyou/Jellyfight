# iPhones and Pixel 8+: what changes in the graphics plan

Research note, 2026-10-07. It follows up
[threejs-performance-and-graphics.md](threejs-performance-and-graphics.md), which only looked at
Android Chrome. The owner now says the target devices are **iPhones (iOS Safari, WebKit) and Pixel 8
and newer (Chrome)**. Meanwhile three.js is being upgraded from r170 to r186.1 on `WebGLRenderer`,
in parallel work. This note asks what the new targets change in that note's recommendations.

How this was checked. All iOS browsers use WebKit, so the WebKit source is the primary source for
iPhone behaviour. I read it from the `WebKit/WebKit` GitHub mirror (`main`, fetched 2026-10-07),
including the copy of ANGLE that WebKit ships. Safari's own release notes came from
developer.apple.com through its JSON data endpoint (`developer.apple.com/tutorials/data/documentation/safari-release-notes/…json`).
I also read Apple's Metal Feature Set Tables PDF and a Metal article, the Chromium GitHub mirror,
the gpuweb wiki (raw git copy) and the three r186.1 npm tarball.

The sandbox blocked webkit.org (the blog), bugs.webkit.org, support.apple.com, apple.com,
developer.chrome.com, chromium.googlesource.com, benchmarks.ul.com and most review sites. Where I
needed facts from those, I used a first-party mirror and say so. If no primary source was
reachable, the claim is marked **(unverified)** or **(secondary)**. Nothing here was measured on a
real iPhone or Pixel.

Links to WebKit and Chromium source point at `main`, so line numbers will drift.

---

## Summary: what changes

1. **iPhone Safari gives `requestAnimationFrame` about 60 fps, even on 120 Hz ProMotion screens.**
   WebKit's `PreferPageRenderingUpdatesNear60FPSEnabled` is on by default (everywhere except
   visionOS) and rounds the display rate to the nearest whole fraction near 60. **Low Power Mode
   halves this to 30 fps.** So does being an **un-tapped cross-origin iframe**, which is how the
   claude.ai artifact embeds the game. A Pixel in Chrome may run rAF at 120 Hz **(unverified)**.
   So the adaptive-resolution controller (old Q3) must learn the real frame cadence. It must not
   read a 30 fps cap as "too slow". On phones it should also **cap the game at 60 fps**: this
   halves GPU work and heat on a 120 Hz Pixel and changes nothing on an iPhone.
2. **`reversedDepthBuffer` now helps phones, not just desktop.** Safari has shipped
   `EXT_clip_control` since 17.4. ANGLE on Metal always exposes it. On iPhones, the 24-bit depth
   buffer is actually stored as **32-bit float**, because Metal on Apple GPUs has no 24-bit depth
   format. That is the ideal case for reversed Z. iPhones could then drop the 5 mm phone near
   plane and use the desktop's 2 mm one, without log depth. N8AO 2.0.1 and three r186 already
   handle reversed depth. Pixel support for `EXT_clip_control` is **(unverified)**. three falls back
   safely if the extension is missing.
3. **WebGPU is now available on both target platforms.** It is on by default in Safari 26 (iOS 26,
   every iPhone that runs iOS 26). In Chrome it covers Pixel 8 and 9 (Arm Mali, Android 12+,
   Chrome 121+). On Pixel 10 it is conditional: Imagination GPU, Android 16+, Chrome 139+, and a
   blocklisted PowerVR 25.1 driver. The verdict is still **"not now"**: the port costs as much as
   before, and iOS ≤ 18 and Lockdown Mode users would have no WebGPU. But the case for it later is
   stronger.
4. **The light-slot proposal (old Q1) is still the top win.** ANGLE on Metal allows 1,024 uniform
   vectors per stage, so the 20 lights fit easily. The cost is per-pixel shading, which tile-based
   GPUs (Apple, Mali) do not avoid. Keeping the light count fixed matters more on iOS, because
   every program change means GLSL → MSL translation plus a Metal compile.
5. **Keep canvas MSAA on phones.** Apple calls its GPUs' MSAA efficient, and Safari 17.4 improved
   antialiased default-framebuffer performance. Half-float render targets (`RGBA16F`) are fully
   supported (render, blend, filter, MSAA) on every Apple GPU. Full float (`RGBA32F`) blending and
   filtering need A14 or newer. So the composer must stay on `HalfFloatType`, which is three's
   default.
6. **Keep the 1.5 pixel-ratio cap.** On a DPR-3 iPhone that is exactly 2:1, which upscales cleanly.
   Use **1.0, not 0.75,** as the adaptive floor on DPR-3 phones. The device can't be detected:
   WebKit reports the GPU as `"Apple GPU"` for every iPhone, and GPU timer queries are off by
   default in Safari. Tier and resolution must therefore come from measured frame intervals.
7. **The floor devices are roughly the same GPU class.** Pixel 8 (Tensor G3, Mali-G715) scores
   about the level of an iPhone 12's A14 or a bit below **(secondary)**. iPhone 11 (A13) is likely
   below Pixel 8 **(unverified)**. Neither should *start* on `medium`. Auto-promoting to `medium`
   (old M2) stays a measured decision, with step-down on thermal decline.
8. **New iOS-only hazards.** **Lockdown Mode disables WebGL entirely.** iOS can drop the WebGL
   context when Safari is backgrounded. Safari before 26.5 had a shader-compiler bug with
   NaN/infinity values, which matters for the `FiniteShader` clamp in `src/graphics.js`. The game
   should show a clear message in the first case and recover in the second.

---

## Findings

### 1. iOS Safari's WebGL 2 is ANGLE on Metal, running in the GPU process

- Safari 15 "Added support for WebGL 2. The implementation of WebGL runs on top of Metal for better performance." ([Safari 15 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-15-release-notes)). The Metal backend is ANGLE's (`Source/ThirdParty/ANGLE/src/libANGLE/renderer/metal/` in the [WebKit mirror](https://github.com/WebKit/WebKit/tree/main/Source/ThirdParty/ANGLE/src/libANGLE/renderer/metal)).
- WebGL calls run in a separate GPU process when `UseGPUProcessForWebGLEnabled` is on. It defaults to true when `ENABLE(GPU_PROCESS_BY_DEFAULT) && ENABLE(GPU_PROCESS_WEBGL_BY_DEFAULT)` ([UnifiedWebPreferences.yaml](https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml), `UseGPUProcessForWebGLEnabled`). **(Unverified:** that both flags are set on current iOS builds. That needs the Cocoa platform headers, which I did not trace.)
- **Lockdown Mode disables WebGL.** `WebGLEnabled` has `disableInLockdownMode: true`, and so does `WebGPUEnabled` (same file). If a player has Lockdown Mode on, `new THREE.WebGLRenderer` will fail.
- Each page can have at most 16 live WebGL contexts on the main thread. Beyond that, the oldest is recycled (`maxActiveContexts = 16`, [WebGLRenderingContextBase.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/html/canvas/WebGLRenderingContextBase.cpp) around line 195). The game uses one context, so this is not a problem.
- The renderer string is masked. `UNMASKED_RENDERER_WEBGL` always returns `"Apple GPU"` and `UNMASKED_VENDOR_WEBGL` returns `"Apple Inc."` (same file, around line 2236). **You cannot tell an iPhone 11 from an iPhone 17 Pro through WebGL.**
- GPU timer queries are off by default. `EXT_disjoint_timer_query_webgl2` is only exposed when `webGLTimerQueriesEnabled` is set ([WebGL2RenderingContext.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/html/canvas/WebGL2RenderingContext.cpp) line 2646), and that preference defaults to `false` with status `developer` (`WebGLTimerQueriesEnabled` in the preferences YAML). **On iPhones the only timing signal is frame intervals.**

### 2. Extensions and formats on iPhone (ANGLE Metal)

| What three.js uses | iPhone status | Source |
|---|---|---|
| `KHR_parallel_shader_compile` (three's `compileAsync`) | Exposed. ANGLE Metal sets `parallelShaderCompileKHR = true`, and `enableParallelMtlLibraryCompilation` is on | [DisplayMtl.mm](https://github.com/WebKit/WebKit/blob/main/Source/ThirdParty/ANGLE/src/libANGLE/renderer/metal/DisplayMtl.mm) lines ~1073, ~1302. WebKit gates it only on the context supporting it ([KHRParallelShaderCompile.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/html/canvas/KHRParallelShaderCompile.cpp)) |
| `EXT_clip_control` (three's `reversedDepthBuffer`) | Exposed since **Safari 17.4**. ANGLE Metal sets `clipControlEXT = true` unconditionally | [Safari 17.4 notes](https://developer.apple.com/documentation/safari-release-notes/safari-17_4-release-notes) ("Added support for new WebGL extensions: `EXT_clip_control`"); DisplayMtl.mm line ~938 |
| Depth buffer format | A 24-bit depth request becomes **`D32_FLOAT`** (`override: D24_UNORM_X8_UINT → D32_FLOAT`, and on iOS `D24_UNORM_S8_UINT → D32_FLOAT_S8X24_UINT`) | [mtl_format_map.json](https://github.com/WebKit/WebKit/blob/main/Source/ThirdParty/ANGLE/src/libANGLE/renderer/metal/mtl_format_map.json) lines ~220-226. The [Metal Feature Set Tables](https://developer.apple.com/metal/Metal-Feature-Set-Tables.pdf) list no `Depth24Unorm_Stencil8` for Apple GPU families |
| `RGBA16F` render targets (EffectComposer, N8AO, bloom) | Filterable, blendable, MSAA and resolve on every Apple GPU | mtl_format_map.json line ~360 (`MTLPixelFormatRGBA16Float`: all `true`). ANGLE derives `EXT_color_buffer_half_float` / `EXT_color_buffer_float` from these format caps ([Caps.cpp](https://github.com/WebKit/WebKit/blob/main/Source/ThirdParty/ANGLE/src/libANGLE/Caps.cpp) lines ~793, ~812) |
| `RGBA32F` filter / blend (`OES_texture_float_linear`, `EXT_float_blend`) | Only on Apple7+ (A14 or newer) **and** when `supports32BitFloatFiltering` | mtl_format_map.json line ~624 |
| Uniform space for lights | `MAX_{VERTEX,FRAGMENT}_UNIFORM_VECTORS` = 16 KiB / 16 B = **1,024** | DisplayMtl.mm ~lines 835-843 (`kDefaultUniformsMaxSize / (sizeof(GLfloat)*4)`); [mtl_common.h](https://github.com/WebKit/WebKit/blob/main/Source/ThirdParty/ANGLE/src/libANGLE/renderer/metal/mtl_common.h) line 114 (`kDefaultUniformsMaxSize = 16 * 1024`) |
| MSAA | Max 4× on Apple GPUs before the newest family (8× only in the last column) | Metal Feature Set Tables, "Maximum sample count in render passes with MSAA" |
| Other WebGL extensions added in recent Safari releases | `WEBGL_clip_cull_distance` (17.2 default-on), `EXT_conservative_depth` (17.5), `WEBGL_render_shared_exponent`, `WEBGL_stencil_texturing`, `OES_shader_multisample_interpolation` (18.0), `WEBGL_polygon_mode` (17.4) | Safari [17.2](https://developer.apple.com/documentation/safari-release-notes/safari-17_2-release-notes), [17.5](https://developer.apple.com/documentation/safari-release-notes/safari-17_5-release-notes), [18](https://developer.apple.com/documentation/safari-release-notes/safari-18-release-notes) notes |

Apple GPU families, from the [Metal Feature Set Tables](https://developer.apple.com/metal/Metal-Feature-Set-Tables.pdf):
A13 = Apple6, A14 = Apple7, A15/A16 = Apple8, A17 Pro/A18 = Apple9, A19 = Apple10.

Release-note items that touch this game:

- Safari 17.4: "Improved performance of MSAA rendering, including antialiased default framebuffer" ([17.4 notes](https://developer.apple.com/documentation/safari-release-notes/safari-17_4-release-notes)).
- Safari 17.1: "Fixed an issue which would cause unnecessary 'WebGL: context lost.' errors after Safari has been moved to the background on iPadOS" ([17.1 notes](https://developer.apple.com/documentation/safari-release-notes/safari-17_1-release-notes)). Context loss on backgrounding is a known iOS-family behaviour. The game shows an error on `webglcontextlost` (`src/errors.js:34`) but does not restore.
- Safari 26.5: "Fixed WebGL shader compilation to properly handle `NaN` and `infinity` values" ([26.5 notes](https://developer.apple.com/documentation/safari-release-notes/safari-26_5-release-notes)). `FiniteShader` in `src/graphics.js` uses `isnan` but also falls back to range comparisons, which is the robust pattern. Keep it. **(Unverified:** what exactly was wrong before 26.5.)
- Safari 27: "Fixed some WebGL context state properties not being correctly reset on context loss" ([27 notes](https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes)).

Shader compile cost on iPhone. Each GLSL program is translated to Metal Shading Language and then
compiled into a `MTLLibrary`; the compile runs in parallel when `enableParallelMtlLibraryCompilation`
is on (DisplayMtl.mm). **(Unverified:** absolute compile times on A14/A15, and whether WebKit caches
compiled programs across page loads.) What follows for the game: `warmUp()` with
`compileAsync` behind the Play button is the right design on iOS too, and anything that changes a
program key during play (light count, a new material permutation, a quality-tier switch that builds
N8AO and bloom) costs a visible stall.

### 3. Logarithmic depth vs reversed depth on tile-based GPUs

- three's own JSDoc says `logarithmicDepthBuffer` "uses `gl_FragDepth` if available which disables the Early Fragment Test optimization". It also says `reversedDepthBuffer` "Requires the `EXT_clip_control` extension" and is "more faster and accurate" (r186.1 `src/renderers/WebGLRenderer.js` ~line 3701). three checks the extension and falls back with a warning (`WebGLCapabilities.js:96-100`).
- Apple: a TBDR GPU "processes all of the geometry of a render pass at the same time and shading only the visible primitives" ([Tailor your apps for Apple GPUs and tile-based deferred rendering](https://developer.apple.com/documentation/metal/tailor-your-apps-for-apple-gpus-and-tile-based-deferred-rendering)). Writing depth from the fragment shader works against this, because depth is no longer known before shading. **(Inference**, not a quote. Apple's article does not name `gl_FragDepth`.) Phones already skip log depth (`src/boot.js:18`). This note confirms that is right for iPhones too.
- **Reversed Z suits iPhones especially well.** Its precision gain needs a floating-point depth buffer, and on iPhones the default framebuffer's depth is `D32_FLOAT` anyway (table above). So `reversedDepthBuffer: true` on iPhone should allow the 2 mm near plane that desktop gets from log depth (`src/main.js:297` uses 5 mm when log depth is off) without the early-z cost. **(Unverified** on a device.)
- What the game needs for reversed Z, checked in source:
  - three r186.1 flips the polygon-offset *factor* under reversed depth (`WebGLState.js` ~line 871: `if ( depthBuffer.getReversed() ) factor = - factor;`). It does not flip *units*. The game only uses factors (`src/vfx.js:93-94` factor −2, `src/bathroom.js:57` factor −1), so `TeleMaterial` decals keep working. This settles the previous note's "(unverified)".
  - The vendored N8AO 2.0.1 reads `renderer.capabilities.reversedDepthBuffer` and compiles with `REVERSEDEPTH` (`vendor/n8ao.module.js:2069`, `:2825`, `:1052`). So medium/high AO is compatible.
  - `DofShader` in `src/graphics.js` converts depth with a standard-Z formula when log depth is off. It would need a reversed branch. It only runs on `high`.
  - The custom shaders include `logdepthbuf_*` chunks (`src/vfx.js:29-30`, `src/forcefield.js:9-10`). These become no-ops without log depth. Nothing else in the game writes depth by hand.

### 4. Frame rate: ProMotion, Low Power Mode, cross-origin iframes, thermal

From WebKit's [AnimationFrameRate.h](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/graphics/AnimationFrameRate.h) / [.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/graphics/AnimationFrameRate.cpp) and the preferences YAML:

- `PreferPageRenderingUpdatesNear60FPSEnabled` is described as "Prefer page rendering updates near 60 frames per second rather than using the display's refresh rate". Its default is `true`, except `PLATFORM(VISION): false`, and its status is `stable`, so users can see it as a Safari feature flag (preferences YAML ~line 4879). `framesPerSecondNearestFullSpeed(120)` returns 60 (120/⌊120/60⌋). **So iPhone Safari's rAF runs at about 60 fps on ProMotion displays** unless the user turns the flag off. The same code path serves WKWebView (the claude.ai iOS app) **(unverified** for that app's configuration).
- `halfSpeedThrottlingReasons = { LowPowerMode, NonInteractedCrossOriginFrame, VisuallyIdle, AggressiveThermalMitigation }` (AnimationFrameRate.cpp line 33). With any of these, the interval is doubled (`IntervalThrottlingFactor = 2`), which gives **30 fps**.
  - **Low Power Mode** → 30 fps. `Page` subscribes to `LowPowerModeNotifier` and adds the reason ([Page.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/page/Page.cpp) ~lines 556, 3057-3068).
  - **Cross-origin iframe that the user hasn't interacted with** → 30 fps. `Document::requestAnimationFrame` adds `NonInteractedCrossOriginFrame` when `!topOrigin().isSameOriginDomain(securityOrigin()) && !hasHadUserInteraction()`. The first handled user gesture removes it ([Document.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/dom/Document.cpp) ~lines 9421-9422, 9730-9731). The claude.ai artifact runs on its own origin inside claude.ai, so **the loading screen and menu run at 30 fps until the first tap**. After the Play tap, they run at full rate.
  - **Thermal.** `ThermalMitigation` alone does *not* halve rAF. Only `AggressiveThermalMitigation` does, and it requires `RespondToThermalPressureAggressively`, which defaults to `false` (Page.cpp ~3070-3088; preferences YAML ~5207). In practice, iOS thermal throttling shows up as **slower GPU clocks** (longer frames), not as a rAF cap **(unverified:** how iOS throttles GPU clocks is not in WebKit).
  - Pages outside the viewport get a 10 s interval (`AggressiveThrottlingAnimationInterval`). Hidden tabs suspend rAF. This is standard.
- Safari 27 fixed rAF timestamps lacking sub-millisecond precision in cross-origin-isolated contexts ([27 notes](https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes)). Elsewhere timestamps are coarser, so measure intervals over many frames.
- **Pixel 8+ in Chrome.** Chrome's `WindowAndroid` lists the display modes that differ only in refresh rate and can set `preferredDisplayModeId` when native code asks for a rate. With no preference (`0`), the system decides ([WindowAndroid.java](https://github.com/chromium/chromium/blob/main/ui/android/java/src/org/chromium/ui/base/WindowAndroid.java), `recomputeSupportedRefreshRates`, `doSetPreferredRefreshRate`). I could not find which native component picks the rate (the viz "frame rate decider" was not at the paths I tried). So **whether rAF runs at 120 Hz on a Pixel 8 with "Smooth Display" on, during a WebGL game, is (unverified)**. Plan for both 60 and 120.

### 5. WebGPU

- **Safari:** "Added support for WebGPU" in Safari 26, which "is available for iOS 26, iPadOS 26, visionOS 26, macOS 26…" ([Safari 26 notes](https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes)). The gpuweb status wiki agrees: "In macOS Tahoe 26, iOS 26, iPadOS 26, and visionOS 26, WebGPU is supported and enabled by default" ([raw wiki copy](https://raw.githubusercontent.com/wiki/gpuweb/gpuweb/Implementation-Status.md); the github.com wiki page was blocked).
  - Device floor: WebKit's WebGPU merges capabilities from `MTLGPUFamilyApple4` upward and rejects devices whose limits fall below the defaults ([HardwareCapabilities.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebGPU/WebGPU/HardwareCapabilities.mm) ~lines 591-630, 760-770). Apple4 is A11, so **every iPhone that runs iOS 26 qualifies**. **(Unverified:** the iOS 26 device list, which I believe is iPhone 11 / A13 and later; support.apple.com was blocked.)
  - Caveats in later notes: Safari 26.1 fixed "WebGPU video textures failed to load in Three.js panoramas". Safari 27 "Restored `maxStorageBuffersInFragmentStage` and related WebGPU limits". Safari 27.2 beta fixed "a severe frame rate drop when calling `executeBundles()` with render bundles that contain `drawIndirect()`" ([26.1](https://developer.apple.com/documentation/safari-release-notes/safari-26_1-release-notes), [27](https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes), [27.2](https://developer.apple.com/documentation/safari-release-notes/safari-27_2-release-notes)). WebKit's implementation is still young. iOS 18 and older have no WebGPU, and Lockdown Mode disables it.
- **Chrome on Pixel:** Chromium's Android allowlist ([webgpu_blocklist_impl.cc](https://github.com/chromium/chromium/blob/main/gpu/config/webgpu_blocklist_impl.cc) ~lines 107-148) allows ARM (0x13B5) and Qualcomm GPUs on Android 12+ (Vulkan), and Imagination (0x1010) on **Android 16+** on Vulkan. It also blocks the driver pattern `"*:*:PowerVR*25.1*"`, commented "ImgTec driver version 25.1 is known to have significant issues". The gpuweb wiki gives the versions: ARM/Qualcomm "Android 12+: 121", Imagination "Android 16+: 139", Samsung Xclipse "TBD".
  - Pixel 8 (Tensor G3) and Pixel 9 (Tensor G4) use Arm Mali GPUs, so they get WebGPU on Chrome 121+. **(Secondary:** GPU models from press coverage.)
  - Pixel 10 (Tensor G5) uses an Imagination PowerVR DXT-48-1536 **(secondary,** press reports such as [heyupnow](https://heyupnow.com/blogs/news/pixel-10s-tensor-g5-soc-specs-revealed-a-surprising-gpu-switch-and-major-cpu-gains)). It ships on Android 16, so it qualifies with Chrome 139+, **unless its driver string matches PowerVR 25.1 (unverified)**.

### 6. GPU class of the floor devices vs the game's tiers

- How the tier is chosen today: `new Graphics(renderer, scene, camera, IS_TOUCH ? 'low' : 'high')` (`src/main.js:170`). A value saved in localStorage overrides it (`src/graphics.js`, constructor). `IS_TOUCH` = `(pointer: coarse)` or `maxTouchPoints > 0` (`src/touch.js:5`). So every iPhone, iPad and Pixel starts on `low`. Pixel ratio is `min(devicePixelRatio, 1.5)` on touch (`src/boot.js:19`), and no tier changes it.
- The tiers' GPU cost: `low` is one forward pass, with all lights and canvas MSAA. `medium` adds N8AO (`Performance`, half resolution), a clamp pass, UnrealBloom (a chain of half-float blur targets) and OutputPass. `high` adds full-resolution AO with 4× MSAA and a 24-tap DOF. On tile-based GPUs, every extra full-screen pass writes its result out to memory and reads it back. That memory bandwidth is the scarce resource on phones (MDN, cited in the previous note).
- Rough GPU class, all **(secondary/unverified)**: Pixel 8 Pro scored about 2,445 in 3DMark Wild Life Extreme, against about 3,359 for the A16 (notebookcheck, via search snippet; notebookcheck and UL's site were blocked). Press summarised Tensor G3 graphics as "slower than Apple A14". So **Pixel 8 ≈ iPhone 12 (A14) class or a little below**, and iPhone 11 (A13) is probably the weakest device that can run iOS 26. Tensor G3 is also widely reported to throttle under sustained load **(unverified)**.
- Can they auto-run `medium`? I don't know, and nothing in the browser can predict it: the GPU string is masked on iOS and timer queries are off. A one-off benchmark at boot would also be misleading, because of the 30 fps caps (§4) and thermal decline later in a run. **So: start every phone on `low`, and promote only from measured headroom (old M2), with automatic step-down.** On A15+ iPhones and on Pixel 9/10, `medium` at a pixel ratio of about 1.0-1.25 is plausible **(unverified;** needs a device run with the new F3 readout).

### 7. devicePixelRatio and the cap

- three's manual: top phones have "an HD-DPI ratio of 3x … they have to do 9x the rendering" ([responsive.html](https://github.com/mrdoob/three.js/blob/dev/manual/pages/responsive.html)). Recent non-SE iPhones report `devicePixelRatio` 3. iPhone 11/XR/SE report 2 **(unverified** here; Apple's HIG device table did not come through the JSON endpoint). Pixel 8 is about 2.6 **(unverified)**. The F3 readout on the r186 branch already shows `dpr` and the canvas size, so one device run will settle it.
- Pixel budget, from CSS viewport × ratio² (a calculation, not a measurement):

  | Viewport | At 1.0 | At 1.5 | At native |
  |---|---|---|---|
  | iPhone, 393×852 | 0.33 MP | 0.75 MP | ≈3.0 MP (×3) |
  | Pixel 8, ≈412×915 | | ≈0.85 MP | ≈2.6 MP |

- **The 1.5 cap is right for both targets.** On a DPR-3 iPhone it is an exact 2:1 downscale, so the compositor's upscale is clean. On DPR-2 iPhones, 1.5 is a 1.33 ratio. That is fine, but 1.0 or 2.0 would be integer ratios. As the floor for adaptive resolution, 0.75 on a DPR-3 phone is a quarter of native linear resolution, which is too blurry for a game whose enemies are small bugs. Use 1.0. **(Judgement**, not a source.)

### 8. Memory and tab kills on iOS

- WebKit caps a canvas at 8192 × 8192 device pixels on iOS ([CanvasBase.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/html/CanvasBase.cpp) `maxCanvasArea`, around line 119). The game is far below that.
- iOS kills web content and GPU processes under memory pressure. WebKit's source does not set the limits; the OS does **(unverified;** Apple documents no number for Safari). The game's footprint is modest: about 22 MB of textures in act 1 (previous note), plus a few half-float targets at about 0.75 MP on `medium`. So memory is not the first risk. Context loss on backgrounding is (§2). three restores its own GL state on `webglcontextrestored`. The game would need to rebuild its composer and re-upload anything three doesn't own **(unverified** which parts that covers in this codebase).

---

## The previous note's proposals, re-judged for iPhone and Pixel 8+

| # (old) | Proposal | Verdict for the targets | What changed |
|---|---|---|---|
| Q1 | Light slots (fixed K lamps) | **Unchanged, still #1** | Uniform limits are not the issue (1,024 vectors). Per-pixel cost is. A fixed light count also avoids MSL recompiles on iOS. |
| Q2 | Turn off lamps in rooms not played | Unchanged | — |
| Q3 | Adaptive pixel ratio | **Changed: detect the cadence first** | rAF is ~60 on iPhone, 30 under Low Power Mode or before the first tap in the artifact, and possibly 120 on Pixel. The controller should (a) take the cadence as the shortest steady interval over the last few seconds, (b) count a frame as slow only when it misses that cadence, (c) never step down because of a steady 33 ms cap, and (d) use a floor of 1.0 on DPR-3 phones. No GPU timers on iOS, so it is frame intervals only. |
| new | **Cap phones at 60 fps** (skip alternate rAF callbacks when the interval is under ~12 ms) | **Add** | Halves GPU work and heat on a 120 Hz Pixel. Changes nothing on iPhone, which is already ~60. Gameplay uses real dt, so the rules don't change. The 12 ms threshold goes in `look.css`. |
| Q4 | Throttle frames behind menus | Unchanged; more valuable on iPhone (battery/thermal) | — |
| Q5 | Cheaper `low` materials | Unchanged | — |
| Q6 | Renderer stats in F3 | **In progress** on the r186 branch (`src/systems.js` diff) | Add the rAF cadence and `document.visibilityState`. Note that Low Power Mode is not detectable directly; the 30 fps cadence shows it. |
| Q8 | No canvas MSAA when a composer runs | Unchanged | MSAA is cheap on Apple GPUs ("an efficient MSAA implementation", Apple TBDR article; Safari 17.4 MSAA speed-up). Keep `antialias: true` on `low`. |
| M1 | r186 + `reversedDepthBuffer` on desktop | **Changed: also phones, iPhone first** | `EXT_clip_control` is on iPhone (Safari 17.4+) with D32F depth, so phones could get the 2 mm near plane. The polygon-offset concern is resolved, and N8AO supports it. Remaining work: a reversed branch in `DofShader`, `camera.near` from `renderer.capabilities.reversedDepthBuffer` rather than `logarithmicDepthBuffer`, and a check on Pixel. |
| M2 | Auto-promote phones to `medium` | Unchanged in intent, **stricter in method** | No device detection is possible, so it must be measured. Require sustained headroom at the cadence, and step down on thermal decline. Pre-compile the medium programs during warm-up, or accept a one-off stall when switching. |
| M4 | Fake lamp bloom sprites on phones | Unchanged | — |
| B1 | Bake lamp light / AO | Unchanged | — |
| B3 | KTX2/Basis | Unchanged, low priority | Apple GPUs and Mali both decode ASTC/ETC2, so Basis would transcode cleanly. But VRAM (about 22 MB) is not the bottleneck. The `blob:` worker question is about the artifact's CSP, not the device. |
| B4 | WebGPURenderer + TSL | **Still "not now", but the coverage argument improves** | Targets with WebGPU: iPhones on iOS 26+, Pixel 8/9 on Chrome 121+, and Pixel 10 on Chrome 139+ unless its driver is blocklisted. The WebGL path stays required for iOS ≤ 18 and Lockdown Mode. WebKit's WebGPU is still young (26.x-27.x fixes). Port cost is unchanged. |
| new | **Lockdown Mode / no-WebGL message** | **Add** (S) | Catch the `WebGLRenderer` constructor failure and say "WebGL is off (iOS Lockdown Mode or browser setting)". `src/boot.js` is the home. |
| new | **Recover from context loss** | **Add** (M) | iOS drops contexts on backgrounding. Handle `webglcontextrestored`: rebuild `gfx` and re-warm shaders, or offer a one-tap reload. `src/errors.js` already listens for the loss. |

Same CLAUDE.md notes as the previous note. Thresholds and caps go in `look.css` (rule 4). Each
behaviour change needs a story (rule 2): for example, a story that fakes a 33 ms steady cadence and
asserts the pixel ratio does *not* drop, and one that fakes 8 ms rAF and asserts that only every
other frame renders. Light slots and auto-medium could change visibility, so offer the balance bot
(rule 5).

---

## Open questions

1. **Which iPhone is the floor?** iOS 26 runs on iPhone 11 (A13) and later **(unverified)**. The A13 is probably weaker than Pixel 8. Is iPhone 12 (A14), which is about Pixel 8 class, an acceptable floor? Do we care about iOS 18 users (no WebGPU, same WebGL)?
2. **What frame rate is the goal on phones: 60, or 30 under Low Power Mode?** Should the game honour a 120 Hz Pixel, or cap at 60 (recommended)?
3. **Can someone run the r186 build with F3 on a real iPhone and a Pixel 8?** Report fps, cadence, `dpr`, draws and shaders, at the start position and in a 300-enemy fight, at 1 minute and at 10 minutes (thermal). Everything about `medium` on phones depends on this.
4. **Does a Pixel 8 expose `EXT_clip_control` and `KHR_parallel_shader_compile` in Chrome?** Check `renderer.capabilities.reversedDepthBuffer` with `reversedDepthBuffer: true`, and `renderer.extensions.has(...)`.
5. **Does rAF run at 120 Hz in Chrome on a Pixel 8 with Smooth Display on,** and does it drop to 60 in Battery Saver?
6. **The claude.ai iOS app (WKWebView):** does it keep WebKit's 60 fps default and the cross-origin 30 fps-until-tap rule? Both are expected from WebKit defaults but not checked.
7. **Context-loss recovery:** worth building, or is a "tap to reload" message enough?
