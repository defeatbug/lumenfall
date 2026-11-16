// LUMENFALL boot and game loop. The loop runs the world on a fixed 1/60 s step and
// draws every animation frame; the state machine is title -> play <-> pause -> over /
// win, with restart from either end screen. With ?shot=start|play|end|win the page
// instead stages one deterministic screenshot scene, draws it once and sets
// window.__shotReady so a headless browser knows the frame is done.
import { FIELD, STEP, WIN_WAVE } from './config.js';
import { World, EVENT_OVER, EVENT_WIN, EVENT_SHOOT, EVENT_KILL, EVENT_HIT, EVENT_PICKUP, EVENT_WAVE, EVENT_DASH, EVENT_NOVA } from './world.js';
import { draw, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_OVER, SCREEN_WIN } from './render.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { stageShot } from './shots.js';

const BEST_KEY = 'lumenfall-best';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = FIELD.width * dpr;
  canvas.height = FIELD.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 7) || 7;

const world = new World(seed);
const input = new Input(canvas);
const sounds = new SoundBank();
let screen = SCREEN_TITLE;
// A read-only handle for automated play-testing; it changes nothing about the game.
window.__lumenfall = { world, screen: () => screen };
let best = 0;
try {
  best = Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
} catch {
  best = 0;
}
let muted = false;
let accumulator = 0;
let lastTime = performance.now();

function saveBest() {
  best = Math.max(best, world.state.score);
  try {
    window.localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // Best score is a nicety: never let storage break the game.
  }
}

function playSound(events) {
  if (events & EVENT_SHOOT) sounds.shoot();
  if (events & EVENT_KILL) sounds.enemyPop();
  if (events & EVENT_HIT) sounds.playerHit();
  if (events & EVENT_PICKUP) sounds.pickup();
  if (events & EVENT_WAVE) sounds.waveHorn();
  if (events & EVENT_DASH) sounds.dash();
  if (events & EVENT_NOVA) sounds.victory();
}

function startGame() {
  sounds.ensure();
  sounds.startPad();
  world.reset();
  world.startWave(1);
  screen = SCREEN_PLAY;
}

function continueEndless() {
  world.state.endless = true;
  world.state.won = false;
  world.startWave(WIN_WAVE + 1);
  screen = SCREEN_PLAY;
}

function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (input.consumeMute()) {
    muted = !muted;
    sounds.setMuted(muted);
  }

  if (screen === SCREEN_TITLE) {
    accumulator += dt;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      world.step(STEP, { moveX: 0, moveY: 0, aimX: 640, aimY: 200, firing: false, dash: false }, true);
    }
    if (input.consumeAny() || input.consumeRestart()) startGame();
  } else if (screen === SCREEN_PLAY) {
    if (input.consumePause()) {
      screen = SCREEN_PAUSE;
      input.clearQueues();
    } else {
      accumulator += dt;
      while (accumulator >= STEP) {
        accumulator -= STEP;
        const move = input.moveVector();
        const events = world.step(STEP, {
          moveX: move.x,
          moveY: move.y,
          aimX: input.mouseX,
          aimY: input.mouseY,
          firing: input.firing,
          dash: input.consumeDash(),
        });
        playSound(events);
        if (events & EVENT_WIN) {
          saveBest();
          sounds.victory();
          screen = SCREEN_WIN;
          input.clearQueues();
        } else if (events & EVENT_OVER) {
          saveBest();
          sounds.gameOver();
          screen = SCREEN_OVER;
          input.clearQueues();
        }
      }
    }
  } else if (screen === SCREEN_PAUSE) {
    if (input.consumePause() || input.consumeResume()) screen = SCREEN_PLAY;
  } else if (screen === SCREEN_OVER) {
    // The world keeps drifting behind the overlay; only the input restarts.
    accumulator += dt;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      world.step(STEP, { moveX: 0, moveY: 0, aimX: 640, aimY: 200, firing: false, dash: false }, true);
    }
    if (input.consumeConfirm()) startGame();
  } else if (screen === SCREEN_WIN) {
    accumulator += dt;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      world.step(STEP, { moveX: 0, moveY: 0, aimX: 640, aimY: 200, firing: false, dash: false }, true);
    }
    // Enter or a click keeps playing in endless mode; R starts a fresh run.
    if (input.keys.has('KeyR')) {
      input.keys.delete('KeyR');
      startGame();
    } else if (input.consumeConfirm()) {
      continueEndless();
    }
    input.consumeRestart();
  }

  draw(ctx, world, screen, best, muted);
  requestAnimationFrame(frame);
}

if (shotName) {
  // Screenshot mode: stage the scene, draw it once, and signal readiness. No audio,
  // no input, no animation loop: the frame is exactly the staged world.
  const staged = stageShot(shotName, world);
  screen = staged.screen;
  best = Math.max(best, staged.best);
  draw(ctx, world, staged.screen, best, false);
  window.__shotReady = true;
} else {
  world.startWave(1);
  requestAnimationFrame(frame);
}
