// Keyboard and mouse state, read once per frame by the world. Edge-triggered actions
// (dash, pause, restart, mute) are consumed by the game loop so one press fires once.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseX = 640;
    this.mouseY = 360;
    this.mouseDown = false;
    this.dashQueued = false;
    this.pauseQueued = false;
    this.restartQueued = false;
    this.confirmQueued = false;
    this.resumeQueued = false;
    this.muteQueued = false;
    this.anyQueued = false;
    this.canvas = canvas;

    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.keys.add(event.code);
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') this.dashQueued = true;
      if (event.code === 'KeyP' || event.code === 'Escape') this.pauseQueued = true;
      if (event.code === 'KeyR' || event.code === 'Enter') this.restartQueued = true;
      if (event.code === 'KeyR' || event.code === 'Enter') this.confirmQueued = true;
      if (event.code === 'KeyM') this.muteQueued = true;
      this.anyQueued = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = ((event.clientX - rect.left) / rect.width) * 1280;
      this.mouseY = ((event.clientY - rect.top) / rect.height) * 720;
    });
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) this.mouseDown = true;
      if (event.button === 2) this.dashQueued = true;
      this.anyQueued = true;
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('click', () => {
      this.anyQueued = true;
      this.confirmQueued = true;
      this.resumeQueued = true;
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
  }

  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const length = Math.hypot(x, y);
      x /= length;
      y /= length;
    }
    return { x, y };
  }

  get firing() {
    return this.mouseDown || this.keys.has('Space');
  }

  consumeDash() {
    const queued = this.dashQueued;
    this.dashQueued = false;
    return queued;
  }

  consumePause() {
    const queued = this.pauseQueued;
    this.pauseQueued = false;
    return queued;
  }

  consumeRestart() {
    const queued = this.restartQueued;
    this.restartQueued = false;
    return queued;
  }

  consumeConfirm() {
    const queued = this.confirmQueued;
    this.confirmQueued = false;
    return queued;
  }

  consumeResume() {
    const queued = this.resumeQueued;
    this.resumeQueued = false;
    return queued;
  }

  // Drop every queued edge so a key pressed on one screen cannot fire on the next.
  clearQueues() {
    this.dashQueued = false;
    this.pauseQueued = false;
    this.restartQueued = false;
    this.confirmQueued = false;
    this.resumeQueued = false;
    this.muteQueued = false;
    this.anyQueued = false;
  }

  consumeMute() {
    const queued = this.muteQueued;
    this.muteQueued = false;
    return queued;
  }

  consumeAny() {
    const queued = this.anyQueued;
    this.anyQueued = false;
    return queued;
  }
}
