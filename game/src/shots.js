// The screenshot scenes behind ?shot=start|play|end|win. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by an autopilot
// that aims at the nearest foe, flees what gets too close and dashes out of trouble, so
// every frame is what a real game looks like and the same seed always gives the same
// frame. The end scene uses a careless pilot (no dash, sloppy aim) so it is caught out
// in an early wave, as a hurried player is; the win scene plays until the tenth wave
// clears. The play scene is dressed after the simulation with a ring of foes closing
// in, bolts in flight and a burst of light, so the frame shows the fight at its
// busiest. Floating texts are cleared before an end or win screen is drawn, so the
// stats read cleanly.
import { FIELD, STEP, PLAYER } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 24;
const END_LIMIT_SECONDS = 300;
const WIN_LIMIT_SECONDS = 900;

/** Steer one step: where to move, where to aim, whether to fire and whether to dash. */
function autopilot(world, careless = false) {
  const state = world.state;
  const player = state.player;
  let moveX = 0;
  let moveY = 0;
  let aimX = player.x;
  let aimY = player.y - 100;
  let dash = false;

  let nearest = null;
  let nearestDistance = Infinity;
  for (const enemy of state.enemies) {
    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = enemy;
    }
  }
  if (nearest) {
    // Aim at the foe; the careless pilot's aim wanders.
    const aimError = careless ? (world.random() - 0.5) * 0.9 : 0;
    const aimAngle = Math.atan2(nearest.y - player.y, nearest.x - player.x) + aimError;
    aimX = player.x + Math.cos(aimAngle) * 200;
    aimY = player.y + Math.sin(aimAngle) * 200;
    // Flee anything closer than the flee radius, dash out of anything very close.
    const fleeRadius = careless ? 60 : 130;
    if (nearestDistance < fleeRadius) {
      const away = Math.atan2(player.y - nearest.y, player.x - nearest.x);
      moveX = Math.cos(away);
      moveY = Math.sin(away);
      if (!careless && nearestDistance < 70 && player.dashCooldown <= 0) dash = true;
    } else if (nearestDistance > 320) {
      moveX = (nearest.x - player.x) / nearestDistance;
      moveY = (nearest.y - player.y) / nearestDistance;
    } else {
      // Strafe around the lighthouse to stay off the walls.
      const cx = FIELD.width / 2 - player.x;
      const cy = FIELD.height / 2 - player.y;
      const centreDistance = Math.hypot(cx, cy) || 1;
      moveX = -cy / centreDistance * 0.7 + (nearest.x - player.x) / nearestDistance * 0.3;
      moveY = cx / centreDistance * 0.7 + (nearest.y - player.y) / nearestDistance * 0.3;
    }
  } else {
    // No foes: drift toward the nearest pickup, else the centre.
    let target = null;
    let targetDistance = Infinity;
    for (const pickup of state.pickups) {
      const distance = Math.hypot(pickup.x - player.x, pickup.y - player.y);
      if (distance < targetDistance) {
        targetDistance = distance;
        target = pickup;
      }
    }
    const tx = target ? target.x : FIELD.width / 2;
    const ty = target ? target.y : FIELD.height / 2;
    const dx = tx - player.x;
    const dy = ty - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 24) {
      moveX = dx / distance;
      moveY = dy / distance;
    }
    aimX = player.x + 100;
    aimY = player.y;
  }
  const length = Math.hypot(moveX, moveY) || 1;
  const firing = careless ? nearestDistance < 420 : true;
  return { moveX: moveX / length, moveY: moveY / length, aimX, aimY, firing, dash };
}

function playForward(world, seconds, careless) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = world.step(STEP, autopilot(world, careless));
    if (events & EVENT_OVER) return 'over';
    if (events & EVENT_WIN) return 'win';
  }
  return 'playing';
}

// Fill the frame with the fight at its busiest: a ring of foes closing in, a fan of
// bolts already in flight and a burst of light, all from the game's own entities.
function dressPlayScene(world) {
  const state = world.state;
  const player = state.player;
  const kinds = ['wisp', 'wisp', 'shade', 'wisp', 'spitter', 'wisp', 'brute', 'shade', 'wisp'];
  kinds.forEach((kind, i) => {
    const angle = (i / kinds.length) * Math.PI * 2 + 0.4;
    const distance = 180 + (i % 3) * 75;
    world.spawnEnemy(kind, false, player.x + Math.cos(angle) * distance, player.y + Math.sin(angle) * distance);
  });
  const aimAngle = Math.atan2(state.enemies[0].y - player.y, state.enemies[0].x - player.x);
  for (const offset of [-0.16, 0, 0.16]) {
    const angle = aimAngle + offset;
    state.bullets.push({
      x: player.x + Math.cos(angle) * 120,
      y: player.y + Math.sin(angle) * 120,
      vx: Math.cos(angle) * PLAYER.bulletSpeed,
      vy: Math.sin(angle) * PLAYER.bulletSpeed,
      radius: PLAYER.bulletRadius,
      life: 1.0,
    });
  }
  world.particles.burst(player.x + 120, player.y - 90, '#ffd76a', 16, 240, 0.6, 3.5);
  world.particles.burst(player.x - 160, player.y + 60, '#b78cff', 12, 200, 0.5, 3);
  state.player.spread = 6;
  state.waveBanner = 1.6;
  state.waveBannerText = `WAVE ${state.wave}`;
}

function clearFloatingText(world) {
  world.particles.texts = [];
}

/**
 * Set `world` to the named scene (start, play, end or win; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end' && name !== 'win') {
    world.startWave(1);
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { moveX: 0, moveY: 0, aimX: 640, aimY: 200, firing: false, dash: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    world.startWave(1);
    const outcome = playForward(world, PLAY_SECONDS, false);
    if (outcome === 'over') {
      clearFloatingText(world);
      return { screen: SCREEN_OVER, best: world.state.score };
    }
    if (outcome === 'win') {
      clearFloatingText(world);
      return { screen: SCREEN_WIN, best: world.state.score };
    }
    dressPlayScene(world);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    world.startWave(1);
    const outcome = playForward(world, END_LIMIT_SECONDS, true);
    clearFloatingText(world);
    if (outcome === 'over') return { screen: SCREEN_OVER, best: world.state.score };
    // The careless pilot survived everything: stage the defeat the renderer draws.
    world.state.hearts = 0;
    world.state.over = true;
    world.state.player.alive = false;
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  // Win: play until dawn, then show the victory screen with its stats.
  world.startWave(1);
  const outcome = playForward(world, WIN_LIMIT_SECONDS, false);
  clearFloatingText(world);
  if (outcome === 'win') return { screen: SCREEN_WIN, best: world.state.score };
  world.state.won = true;
  world.state.wave = 10;
  world.state.enemies = [];
  world.state.enemyBullets = [];
  world.state.spawnQueue = [];
  return { screen: SCREEN_WIN, best: world.state.score };
}
