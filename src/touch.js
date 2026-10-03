// Phone and tablet controls:
//  - left side: a joystick that appears wherever your thumb lands
//  - right side: drag to look around
//  - jump button (hold it to climb fabric), a context button (unused for now), pause
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
      <button class="act" hidden></button><button class="jump" aria-label="Jump">⤴</button><button class="pause" aria-label="Pause">❚❚</button>`;
    this.stick = this.el.querySelector('.stick');
    this.knob = this.stick.firstChild;
    this.ghost = this.el.querySelector('.ghost');
    this.jumpBtn = this.el.querySelector('.jump');
    this.actBtn = this.el.querySelector('.act');
    this.move = null;   // { id, x, y }
    this.look = null;   // { id, x, y }
    this.lookSpeed = 2.2;

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
        this.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
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
    // no long-press menus or double-tap zoom on the controls
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  mount(parent) { parent.appendChild(this.el); }

  show(on) {
    this.el.hidden = !on;
    if (!on) {
      this.move = this.look = null;
      this.input.touchMove = null;
      this.input.touchJump = false;
      this.stick.classList.remove('on');
    }
  }

  // label: text for the context button, or null to hide it
  setAction(label) {
    if (!label) { this.actBtn.hidden = true; return; }
    if (this.actBtn.textContent !== label) this.actBtn.textContent = label;
    this.actBtn.hidden = false;
  }
}
