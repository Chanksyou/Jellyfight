// Keyboard + mouse state. Mouse movement is accumulated and consumed each frame.
export class Input {
  constructor(element) {
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.jumpQueued = false;
    this.resetQueued = false;
    this.locked = false;

    addEventListener('keydown', (e) => {
      if (e.repeat || e.target.closest?.('input, textarea, select')) return;
      this.keys.add(e.code);
      if (e.code === 'Space') this.jumpQueued = true;
      if (e.code === 'KeyR') this.resetQueued = true;
      if (e.code === 'KeyE') this.interactQueued = true;
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    this.enabled = true; // main.js turns pointer lock off while menus are open
    element.addEventListener('click', () => { if (this.enabled && !this.touchOnly) element.requestPointerLock?.(); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === element;
    });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
  }

  // -1..1 on each axis
  moveAxes() {
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (this.touchMove) { x += this.touchMove.x; y += this.touchMove.y; }   // on-screen joystick (touch.js)
    return { x, y };
  }

  get jumpHeld() { return this.keys.has('Space') || !!this.touchJump; }

  consumeMouse() {
    const d = { x: this.mouseDX, y: this.mouseDY, wheel: this.wheel };
    this.mouseDX = this.mouseDY = this.wheel = 0;
    return d;
  }

  consumeJump() { const j = this.jumpQueued; this.jumpQueued = false; return j; }
  consumeReset() { const r = this.resetQueued; this.resetQueued = false; return r; }
  consumeInteract() { const r = this.interactQueued; this.interactQueued = false; return r; }
}
