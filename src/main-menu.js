// The title screen borrows the player's real avatar. No duplicate model or gameplay motion.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { isNewPlayer } from './first-run.js';

// One unlit screen quad: drifting light and caustics, with no textures or new lights.
export class UnderwaterBackdrop {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.layers = new Map();
    this.cameraMask = null;
    this.material = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: {
        time: { value: 0 }, aspect: { value: 1 },
        deep: { value: new THREE.Color(LOOK.color('menu-water-deep', '#06162e')) },
        shallow: { value: new THREE.Color(LOOK.color('menu-water-shallow', '#175c70')) },
        glow: { value: new THREE.Color(LOOK.color('menu-water-glow', '#70ddc7')) },
        rayStrength: { value: LOOK.num('menu-water-rays', 0.12) },
        shimmer: { value: LOOK.num('menu-water-shimmer', 0.16) },
      },
      vertexShader: `varying vec2 uvWater;
        void main() { uvWater = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
      fragmentShader: `varying vec2 uvWater;
        uniform float time, aspect, rayStrength, shimmer;
        uniform vec3 deep, shallow, glow;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec2 uv = uvWater;
          vec2 p = vec2(uv.x * aspect, uv.y);
          vec3 color = mix(deep, shallow, smoothstep(0.0, 1.2, uv.y));
          float light = exp(-length((uv - vec2(0.57, 1.18)) * vec2(1.0, 0.8)) * 2.7);
          color += glow * light * 0.24;
          float ray = pow(max(0.0, sin((p.x + uv.y * 0.3) * 15.0 + sin(time * 0.12) * 0.6)), 12.0);
          ray += 0.45 * pow(max(0.0, sin((p.x - uv.y * 0.13) * 23.0 - time * 0.04)), 18.0);
          color += glow * ray * rayStrength * pow(uv.y, 1.5);
          vec2 q = p * 5.0 + vec2(time * 0.022, -time * 0.013);
          q += vec2(sin(q.y * 1.7 + time * 0.14), cos(q.x * 1.4 - time * 0.11)) * 0.65;
          float field = sin(q.x + q.y) + sin(q.x * 1.37 - q.y * 0.8) + sin(q.y * 1.9 + 0.5);
          float caustic = pow(max(0.0, 1.0 - abs(field) * 2.6), 3.0);
          float veil = smoothstep(0.25, 1.0, uv.y) * (0.45 + light);
          color += glow * caustic * shimmer * veil;
          vec2 drift = uv * vec2(17.0 * aspect, 11.0) + vec2(time * 0.008, -time * 0.035);
          vec2 cell = floor(drift), local = fract(drift);
          float seed = hash(cell);
          vec2 center = vec2(0.2 + seed * 0.6, 0.2 + hash(cell + 4.0) * 0.6);
          float mote = (1.0 - smoothstep(0.0, 0.032, length(local - center))) * step(0.92, seed);
          color += glow * mote * 0.3;
          color *= 0.76 + 0.24 * pow(max(0.0, 1.0 - length(uv - 0.5)), 0.5);
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.layers.set(30); // batch.js reserves 31; the portrait alone uses 30.
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  update(dt, subject, calm) {
    if (this.cameraMask !== null && this.subject !== subject) this.hide();
    if (this.cameraMask === null) {
      this.subject = subject;
      this.cameraMask = this.camera.layers.mask;
      const include = object => {
        this.layers.set(object, object.layers.mask);
        object.layers.enable(30);
      };
      subject.traverse(include);
      this.scene.traverse(object => { if (object.isLight) include(object); });
    }
    // The batcher and shadow system may still update; their normal layers stay outside this view.
    this.camera.layers.set(30);
    this.mesh.visible = true;
    this.material.uniforms.aspect.value = innerWidth / innerHeight;
    if (!calm) this.material.uniforms.time.value += dt;
  }

  hide() {
    this.mesh.visible = false;
    if (this.cameraMask !== null) this.camera.layers.mask = this.cameraMask;
    for (const [object, mask] of this.layers) object.layers.mask = mask;
    this.layers.clear();
    this.cameraMask = null;
    this.subject = null;
  }
}

export class MainMenu {
  constructor({ overlay, player, camera, gfx, scene, height, calm, board = null, onPoke = () => {} }) {
    Object.assign(this, { overlay, player, camera, gfx, height, calm, board, onPoke });
    this.home = true;
    this.launching = false;
    this.time = 0;
    this.pokeAge = 1;
    this.root = null;
    this.from = new THREE.Vector3();
    this.rotation = new THREE.Quaternion();
    this.basePosition = new THREE.Vector3();
    this.baseRotation = new THREE.Euler();
    this.baseScale = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.duration = LOOK.num('menu-launch-time', 0.28);
    this.water = scene ? new UnderwaterBackdrop(scene, camera) : null;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = new URL('../content/look.css', import.meta.url).href;
    document.head.appendChild(css);
    overlay.querySelector('h1').innerHTML = 'Jelly <span>Fight</span>';
    this.hero = document.createElement('button');
    this.hero.type = 'button';
    this.hero.className = 'menu-jelly';
    this.hero.setAttribute('aria-label', 'Poke your jellyfish');
    overlay.appendChild(this.hero);
    this.hero.addEventListener('click', () => this.poke());
    const caption = document.createElement('section');
    caption.className = 'menu-jelly-caption';
    caption.innerHTML = '<button type="button" data-act="creator">Change your look</button>';
    this.greet = document.createElement('p');
    this.greet.className = 'menu-greet';
    this.greet.hidden = true;
    caption.prepend(this.greet);
    overlay.appendChild(caption);
    overlay.addEventListener('pointerdown', e => {
      const b = e.target.closest('button');
      if (!b || b.disabled || this.calm()) return;
      b.classList.remove('menu-pop');
    });
    overlay.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || b.disabled || this.calm()) return;
      // Native click keeps touch cancellation and keyboard activation intact.
      b.classList.remove('menu-pop');
      void b.offsetWidth;
      b.classList.add('menu-pop');
    });
    overlay.addEventListener('animationend', e => e.target.classList.remove('menu-pop'));
    this.show();
  }

  show() {
    this.restore();
    this.home = true;
    this.launching = false;
    this.overlay.classList.remove('menu-launching');
    this.overlay.classList.add('menu-home');
    this.hero.disabled = false;
    this.overlay.querySelector('h1').innerHTML = 'Jelly <span>Fight</span>';
    this.refreshGreeting();
  }

  // A returning player is greeted over their jelly by the name on their leaderboard
  // entry: the name they last submitted is kept in this browser, and the board's own
  // row for them is the backup (on the claude.ai home their board entry can outlive
  // this browser's storage). 'Guest' and no name at all get no greeting.
  refreshGreeting() {
    let name = '';
    try { name = localStorage.getItem('jellyfight.name') || ''; } catch {}
    if ((!name || name === 'Guest') && this.board?.mine?.name) name = this.board.mine.name;
    if (name === 'Guest') name = '';
    const returning = !isNewPlayer() || !!this.board?.mine;
    this.greet.textContent = returning && name ? `Welcome back, ${name}` : '';
    this.greet.hidden = !this.greet.textContent;
  }

  poke() {
    if (!this.home || this.overlay.hidden || this.launching) return;
    if (!this.calm()) this.pokeAge = 0;
    this.onPoke();
  }

  // Called only after pointer lock succeeds, or directly from the phone's Play gesture.
  launch() {
    if (!this.home) return;
    this.from.copy(this.camera.position);
    this.rotation.copy(this.camera.quaternion);
    this.fromView = this.camera.view ? { ...this.camera.view } : null;
    this.home = false;
    this.restore();
    this.overlay.classList.remove('menu-home');
    if (this.calm()) { this.overlay.hidden = true; return; }
    this.launching = true;
    this.elapsed = 0;
    this.overlay.hidden = false;
    this.overlay.classList.add('menu-launching');
    this.hero.disabled = true;
    this.player.avatar?.pulse(0.8);
  }

  cancelLaunch() {
    this.launching = false;
    this.overlay.classList.remove('menu-launching');
    this.camera.clearViewOffset();
  }

  restore() {
    this.water?.hide();
    if (!this.root) return;
    this.root.position.copy(this.basePosition);
    this.root.rotation.copy(this.baseRotation);
    this.root.scale.copy(this.baseScale);
    this.root = null;
    this.camera.clearViewOffset();
  }

  update(dt, visible, customizing = false) {
    if (customizing) {
      if (this.root) this.restore();
      this.water?.update(dt, this.player.avatar.root, this.calm());
      return;
    }
    if (this.launching) {
      this.elapsed += dt;
      const u = this.calm() ? 1 : Math.min(1, this.elapsed / this.duration);
      const blend = u * u * (3 - 2 * u);
      this.camera.position.lerp(this.from, 1 - blend);
      this.camera.quaternion.slerp(this.rotation, 1 - blend);
      if (this.fromView?.enabled) {
        const v = this.fromView;
        this.camera.setViewOffset(v.fullWidth, v.fullHeight, v.offsetX * (1 - blend), v.offsetY * (1 - blend), v.width, v.height);
      }
      if (u === 1) {
        this.launching = false;
        this.overlay.hidden = true;
        this.overlay.classList.remove('menu-launching');
        this.camera.clearViewOffset();
      }
      return;
    }
    if (!this.home || !visible) { this.restore(); return; }
    const root = this.player.avatar?.root;
    if (!root) return;
    if (root !== this.root) {
      this.restore();
      this.root = root;
      this.basePosition.copy(root.position);
      this.baseRotation.copy(root.rotation);
      this.baseScale.copy(root.scale);
    }
    this.time += dt;
    this.pokeAge = Math.min(1, this.pokeAge + dt);
    const calm = this.calm(), h = this.height * (this.player.avatar.look?.size || 1);
    const kick = calm ? 0 : Math.exp(-this.pokeAge * 9) * Math.cos(this.pokeAge * 24);
    const poke = this.pokeAge < 0.6 ? kick * LOOK.num('menu-poke-squash', 0.15) : 0;
    root.scale.copy(this.baseScale);
    root.scale.y *= 1 - poke;
    root.scale.x *= 1 + poke * 0.5;
    root.scale.z *= 1 + poke * 0.5;
    root.position.copy(this.basePosition);
    root.position.y += calm ? 0 : Math.sin(this.time * 1.8) * h * LOOK.num('menu-bob', 0.045);
    root.rotation.copy(this.baseRotation);
    root.rotation.y += (calm ? 0 : Math.sin(this.time * 0.7) * 0.12);
    root.rotation.z += calm ? 0 : Math.sin(this.time * 1.1) * 0.035 + poke * 0.5;
    const w = innerWidth, ht = innerHeight, wide = w > ht;
    const p = this.player.position;
    const yaw = this.player.facing + LOOK.num('menu-camera-yaw', 0.22);
    const d = h * LOOK.num(wide ? 'menu-camera-distance' : 'menu-camera-distance-portrait', wide ? 2.35 : 4);
    this.camera.position.set(p.x + Math.sin(yaw) * d, p.y + h * 0.75, p.z + Math.cos(yaw) * d);
    this.target.copy(p); this.target.y += h * 0.53;
    this.camera.lookAt(this.target);
    this.camera.setViewOffset(w, ht, wide ? -w * 0.22 : 0, wide ? 0 : ht * LOOK.num('menu-camera-offset-portrait', 0.32), w, ht);
    this.gfx.focus = d;
    this.water?.update(dt, this.player.mesh || root, calm);
  }
}
