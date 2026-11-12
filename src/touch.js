// Phone and tablet controls:
//  - left side: a joystick that appears wherever your thumb lands
//  - right side: drag to look around; until a player has, a dashed hint there with a see-through
//    finger sweeping across it, and the camera turning along with its first sweeps (TURN_KEY)
//  - jump button (hold it to climb fabric), a context button (unused for now), pause
// '1': this device has turned the camera. 'act': it had, but not yet this act (each act is a page
// load), so if the act ends unturned the next one shows the hint again. Missing: never turned.
export const TURN_KEY = 'jellyrun.turned';
const TURN_SWEEP = 2.4, TURN_REACH = 32, TURN_REST = 6;   // s per sweep, px each way, s between pairs of sweeps
const TURNED_PX = 30;           // a look drag this far counts as having turned
export const IS_TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

const CSS = `
#touch { position: fixed; inset: 0; z-index: 8; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
#touch[hidden] { display: none; }
#touch .stick { position: absolute; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%;
  background: #ffffff1a; border: 2px solid #ffffff55; pointer-events: none; display: none; }
#touch .stick i { position: absolute; left: 50%; top: 50%; width: 52px; height: 52px; margin: -26px 0 0 -26px; border-radius: 50%;
  background: #ffffffcc; box-shadow: 0 2px 8px #0006; }
#touch .stick.on { display: block; }
#touch .ghost { position: absolute; left: calc(env(safe-area-inset-left, 0px) + 70px); bottom: calc(env(safe-area-inset-bottom, 0px) + 70px);
  width: 100px; height: 100px; margin: -50px 0 0 -50px; border-radius: 50%; border: 2px dashed #ffffff40; pointer-events: none; }
#touch .ghost.off { display: none; }
#touch .turn { position: absolute; left: 72%; top: 44%; width: 150px; height: 58px; margin: -29px 0 0 -75px; border-radius: 29px;
  border: 2px dashed #ffffff40; pointer-events: none; color: #ffffff70; font: 700 22px system-ui, sans-serif;
  display: flex; align-items: center; justify-content: space-between; padding: 0 12px; box-sizing: border-box; }
#touch .turn i { position: absolute; left: 50%; top: 50%; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%;
  background: #ffffff8c; box-shadow: 0 2px 8px #0005; }
#touch .turn.off { display: none; }
#touch button { position: absolute; border: 0; border-radius: 50%; color: #fff; font: 700 15px system-ui, sans-serif;
  display: grid; place-items: center; touch-action: none; -webkit-tap-highlight-color: transparent; }
#touch .jump { right: calc(env(safe-area-inset-right, 0px) + 24px); bottom: calc(env(safe-area-inset-bottom, 0px) + 28px); width: 84px; height: 84px;
  background: #ff8ad0cc; box-shadow: 0 4px 14px #0007; font-size: 30px; }
#touch .jump.down { transform: scale(.92); background: #ff8ad0; }
#touch .act { right: calc(env(safe-area-inset-right, 0px) + 122px); bottom: calc(env(safe-area-inset-bottom, 0px) + 40px); min-width: 64px; height: 64px;
  border-radius: 32px; padding: 0 16px; background: #ffd23ae6; color: #1d1a12; box-shadow: 0 4px 14px #0007; }
#touch .act[hidden] { display: none; }
#touch .pause { top: calc(env(safe-area-inset-top, 0px) + 10px); right: calc(env(safe-area-inset-right, 0px) + 10px); width: 44px; height: 44px;
  background: #0007; font-size: 18px; }
`;

export class TouchControls {
  constructor(input, { onPause } = {}) {
    this.input = input;
    this.el = document.createElement('div');
    this.el.id = 'touch';
    this.el.hidden = true;
    this.el.innerHTML = `<style>${CSS}</style><div class="ghost"></div><div class="stick"><i></i></div>
      <div class="turn off" aria-hidden="true">‹<i></i>›</div>
      <button class="act" hidden></button><button class="jump" aria-label="Jump">⤴</button><button class="pause" aria-label="Pause">❚❚</button>`;
    this.stick = this.el.querySelector('.stick');
    this.knob = this.stick.firstChild;
    this.ghost = this.el.querySelector('.ghost');
    this.jumpBtn = this.el.querySelector('.jump');
    this.actBtn = this.el.querySelector('.act');
    this.move = null;   // { id, x, y }
    this.look = null;   // { id, x, y }
    this.lookSpeed = 2.2;
    this.turn = this.el.querySelector('.turn');
    this.finger = this.turn.querySelector('i');
    this.turnHint = null;   // decided the first time the controls show (null: not yet)
    this.turnT = 0;         // s into the finger's loop
    this.turnDemo = false;  // the camera turns with the finger's first two sweeps after the hint appears
    this.turnX = 0;         // the finger's offset, px
    this.calm = matchMedia('(prefers-reduced-motion: reduce)').matches;   // no finger, no camera turning

    const el = this.el;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      const left = e.clientX < innerWidth * 0.45;
      // a new left thumb always takes the stick: if the last touch's end got lost (a system
      // gesture, a notification), the stick would otherwise stay held by a finger that's gone
      if (left) {
        this.move = { id: e.pointerId, x: e.clientX, y: e.clientY };
        this.stick.style.left = e.clientX + 'px';
        this.stick.style.top = e.clientY + 'px';
        this.stick.classList.add('on');
        this.ghost.classList.add('off');
      } else if (!left && !this.look) {
        this.look = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
      }
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (this.move && e.pointerId === this.move.id) {
        let dx = e.clientX - this.move.x, dy = e.clientY - this.move.y;
        const L = Math.hypot(dx, dy), R = 50;
        if (L > R) { dx *= R / L; dy *= R / L; }
        this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
        // a little dead zone, then full speed past 70% of the ring
        // (dx, dy are clamped to the ring, so the direction divides by the clamped length:
        //  dragging past the ring stays full speed instead of shrinking)
        const m = Math.min(1, Math.max(0, (L / R - 0.12) / 0.58));
        const len = Math.max(Math.hypot(dx, dy), 1e-6);
        input.touchMove = L > 0 ? { x: (dx / len) * m, y: -(dy / len) * m } : null;
      } else if (this.look && e.pointerId === this.look.id) {
        input.mouseDX += (e.clientX - this.look.x) * this.lookSpeed;
        input.mouseDY += (e.clientY - this.look.y) * this.lookSpeed;
        this.look.moved += Math.abs(e.clientX - this.look.x);
        if (this.look.moved > TURNED_PX) this.turned();
        this.look.x = e.clientX;
        this.look.y = e.clientY;
      }
    });
    const end = (e) => {
      if (this.move && e.pointerId === this.move.id) {
        this.move = null;
        input.touchMove = null;
        this.stick.classList.remove('on');
        this.knob.style.transform = '';
      }
      if (this.look && e.pointerId === this.look.id) this.look = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);

    const press = (btn, down, up) => {
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); btn.setPointerCapture(e.pointerId); btn.classList.add('down'); down(); });
      const release = () => { btn.classList.remove('down'); up?.(); };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
    };
    press(this.jumpBtn, () => { input.jumpQueued = true; input.touchJump = true; }, () => { input.touchJump = false; });
    press(this.actBtn, () => { input.interactQueued = true; });
    press(this.el.querySelector('.pause'), () => onPause?.());
    // iOS can zoom positioned controls despite touch-action; cancel native gestures only in play.
    el.addEventListener('touchstart', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    // no long-press menus or double-tap zoom on the controls
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  mount(parent) { parent.appendChild(this.el); }

  show(on) {
    if (on && this.turnHint === null) {
      let seen = null; try { seen = localStorage.getItem(TURN_KEY); } catch {}
      this.setTurnHint(seen !== '1');
      if (seen === '1') try { localStorage.setItem(TURN_KEY, 'act'); } catch {}
    }
    document.documentElement.classList.toggle('touch-playing', on);
    this.el.hidden = !on;
    if (!on) {
      this.move = this.look = null;
      this.input.touchMove = null;
      this.input.touchJump = false;
      this.stick.classList.remove('on');
    }
  }

  // the player turned the camera: no hint for the rest of this act, nor the next ones while they keep turning
  turned() {
    if (this.turnedHere) return;
    this.turnedHere = true;
    this.setTurnHint(false);
    try { localStorage.setItem(TURN_KEY, '1'); } catch {}
  }

  setTurnHint(on) {
    this.turnHint = on;
    this.turn.classList.toggle('off', !on);
    this.turnT = 0; this.turnX = 0; this.turnDemo = on; this.finger.style.transform = '';
  }

  // each frame while playing: the finger sweeps twice, rests, sweeps again; the camera follows only
  // its first two sweeps, the way the player's own drag would turn it (back where it started after)
  update(dt) {
    if (!this.turnHint || this.el.hidden || this.calm) return;
    const loop = TURN_SWEEP * 2 + TURN_REST;
    this.turnT += dt;
    const t = this.turnT % loop;
    const x = t < TURN_SWEEP * 2 ? Math.sin((t / TURN_SWEEP) * Math.PI * 2) * TURN_REACH : 0;
    if (this.turnDemo && !this.look) this.input.mouseDX += (x - this.turnX) * this.lookSpeed;
    if (this.turnT >= TURN_SWEEP * 2) this.turnDemo = false;
    this.turnX = x;
    this.finger.style.transform = `translateX(${x.toFixed(1)}px)`;
  }

  // label: text for the context button, or null to hide it
  setAction(label) {
    if (!label) { this.actBtn.hidden = true; return; }
    if (this.actBtn.textContent !== label) this.actBtn.textContent = label;
    this.actBtn.hidden = false;
  }
}
