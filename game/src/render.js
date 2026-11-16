// Everything the player sees: the night field, the lighthouse, the foes, the HUD and
// every menu screen. All drawing is canvas 2D with pre-rendered glow sprites, so the
// game needs no image files at all.
import { FIELD, PALETTE, PLAYER, PICKUPS } from './config.js';
import { makeRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const STAR_COUNT = 110;
const MOTE_COUNT = 26;

const starRandom = makeRandom(99);
const stars = [];
for (let i = 0; i < STAR_COUNT; i += 1) {
  stars.push({
    x: starRandom() * FIELD.width,
    y: starRandom() * FIELD.height,
    size: 0.6 + starRandom() * 1.6,
    phase: starRandom() * Math.PI * 2,
    speed: 0.4 + starRandom() * 1.2,
  });
}
const moteRandom = makeRandom(7);
const motes = [];
for (let i = 0; i < MOTE_COUNT; i += 1) {
  motes.push({
    x: moteRandom() * FIELD.width,
    y: moteRandom() * FIELD.height,
    size: 1.5 + moteRandom() * 2.5,
    rise: 8 + moteRandom() * 16,
    sway: 10 + moteRandom() * 22,
    phase: moteRandom() * Math.PI * 2,
  });
}

const glowCache = new Map();
function glowSprite(colour) {
  let sprite = glowCache.get(colour);
  if (sprite) return sprite;
  sprite = document.createElement('canvas');
  sprite.width = 64;
  sprite.height = 64;
  const ctx = sprite.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, colour);
  gradient.addColorStop(0.35, colour);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  glowCache.set(colour, sprite);
  return sprite;
}

function drawGlow(ctx, x, y, radius, colour, alpha = 0.85) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.drawImage(glowSprite(colour), x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

function drawBackground(ctx, time) {
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  gradient.addColorStop(0, PALETTE.backgroundTop);
  gradient.addColorStop(1, PALETTE.backgroundBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.save();
  for (const star of stars) {
    const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * star.speed + star.phase));
    ctx.globalAlpha = twinkle * 0.8;
    ctx.fillStyle = PALETTE.star;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const mote of motes) {
    const y = ((mote.y - time * mote.rise) % FIELD.height + FIELD.height) % FIELD.height;
    const x = mote.x + Math.sin(time * 0.5 + mote.phase) * mote.sway;
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(time + mote.phase);
    ctx.fillStyle = PALETTE.ember;
    ctx.beginPath();
    ctx.arc(x, y, mote.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLighthouse(ctx, time) {
  const x = FIELD.width / 2;
  const y = FIELD.height / 2;
  ctx.save();
  // Rotating beams of light, fading from the lamp outward.
  ctx.globalCompositeOperation = 'lighter';
  const beamLength = 380;
  for (const offset of [0, Math.PI]) {
    const angle = time * 0.25 + offset;
    const tipX = x + Math.cos(angle) * beamLength;
    const tipY = y - 46 + Math.sin(angle) * 70;
    const gradient = ctx.createLinearGradient(x, y - 46, tipX, tipY);
    gradient.addColorStop(0, 'rgba(255,205,80,0.32)');
    gradient.addColorStop(0.45, 'rgba(255,205,80,0.12)');
    gradient.addColorStop(1, 'rgba(255,205,80,0)');
    ctx.fillStyle = gradient;
    const px = -Math.sin(angle) * 24;
    const py = Math.cos(angle) * 24;
    ctx.beginPath();
    ctx.moveTo(x, y - 46);
    ctx.lineTo(tipX + px, tipY + py);
    ctx.lineTo(tipX - px, tipY - py);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Stone tower.
  ctx.save();
  ctx.fillStyle = '#232a4d';
  ctx.strokeStyle = '#3a4470';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - 20, y - 6, 40, 46, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2c3560';
  ctx.fillRect(x - 20, y + 8, 40, 5);
  ctx.fillRect(x - 20, y + 24, 40, 5);
  // The lamp.
  drawGlow(ctx, x, y - 18, 46 + Math.sin(time * 2) * 4, '#ffd76a', 0.9);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(x, y - 18, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.arc(x, y - 18, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPickup(ctx, pickup, time) {
  const bob = Math.sin(pickup.bob) * 3;
  const y = pickup.y + bob;
  const colour = PICKUPS[pickup.kind].colour;
  const blink = pickup.life < 3 ? (Math.sin(time * 12) > 0 ? 1 : 0.25) : 1;
  ctx.save();
  ctx.globalAlpha = blink;
  drawGlow(ctx, pickup.x, y, 26, colour, 0.7);
  ctx.fillStyle = colour;
  ctx.strokeStyle = '#0b1026';
  ctx.lineWidth = 2;
  if (pickup.kind === 'ember') {
    ctx.beginPath();
    ctx.moveTo(pickup.x, y - 11);
    ctx.quadraticCurveTo(pickup.x + 9, y, pickup.x, y + 10);
    ctx.quadraticCurveTo(pickup.x - 9, y, pickup.x, y - 11);
    ctx.fill();
    ctx.stroke();
  } else if (pickup.kind === 'heart') {
    ctx.beginPath();
    ctx.moveTo(pickup.x, y + 8);
    ctx.bezierCurveTo(pickup.x - 12, y - 2, pickup.x - 7, y - 11, pickup.x, y - 4);
    ctx.bezierCurveTo(pickup.x + 7, y - 11, pickup.x + 12, y - 2, pickup.x, y + 8);
    ctx.fill();
    ctx.stroke();
  } else if (pickup.kind === 'spread') {
    for (const offset of [-8, 0, 8]) {
      ctx.beginPath();
      ctx.moveTo(pickup.x + offset, y - 8);
      ctx.lineTo(pickup.x + offset + 5, y + 2);
      ctx.lineTo(pickup.x + offset - 5, y + 2);
      ctx.closePath();
      ctx.fill();
    }
  } else if (pickup.kind === 'shield') {
    ctx.beginPath();
    ctx.arc(pickup.x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b1026';
    ctx.beginPath();
    ctx.arc(pickup.x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Nova star.
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const radius = i % 2 === 0 ? 12 : 5;
      const px = pickup.x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawEnemy(ctx, enemy, time) {
  ctx.save();
  if (enemy.hitFlash > 0) {
    drawGlow(ctx, enemy.x, enemy.y, enemy.radius * 3, '#ffffff', 0.9);
  } else {
    drawGlow(ctx, enemy.x, enemy.y, enemy.radius * 2.4, enemy.glow, 0.55);
  }
  ctx.translate(enemy.x, enemy.y);
  if (enemy.kind === 'wisp') {
    ctx.fillStyle = enemy.colour;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b1026';
    ctx.beginPath();
    ctx.arc(-4, -2, 2.4, 0, Math.PI * 2);
    ctx.arc(4, -2, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = enemy.colour;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(-6, enemy.radius - 2);
    ctx.quadraticCurveTo(0, enemy.radius + 8 + Math.sin(time * 6 + enemy.wobble) * 3, 6, enemy.radius - 2);
    ctx.stroke();
  } else if (enemy.kind === 'shade') {
    ctx.fillStyle = enemy.colour;
    ctx.beginPath();
    for (let i = 0; i <= 10; i += 1) {
      const angle = (i / 10) * Math.PI * 2;
      const wobble = 1 + 0.12 * Math.sin(angle * 3 + time * 2 + enemy.wobble);
      const px = Math.cos(angle) * enemy.radius * wobble;
      const py = Math.sin(angle) * enemy.radius * wobble;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff5c7a';
    ctx.beginPath();
    ctx.arc(-5, -3, 2.6, 0, Math.PI * 2);
    ctx.arc(5, -3, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'spitter') {
    ctx.rotate(Math.sin(time * 2 + enemy.wobble) * 0.2);
    ctx.fillStyle = enemy.colour;
    ctx.beginPath();
    ctx.moveTo(0, -enemy.radius);
    ctx.lineTo(enemy.radius, 0);
    ctx.lineTo(0, enemy.radius);
    ctx.lineTo(-enemy.radius, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Brute: a heavy hex plate with a burning core.
    ctx.fillStyle = enemy.colour;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const px = Math.cos(angle) * enemy.radius;
      const py = Math.sin(angle) * enemy.radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a2d12';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff5c7a';
    ctx.beginPath();
    ctx.arc(-8, -6, 2.5, 0, Math.PI * 2);
    ctx.arc(8, -6, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (enemy.elite) {
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Health bar for tough foes.
  if (enemy.maxHp > 1 && enemy.hp < enemy.maxHp) {
    const width = enemy.radius * 2;
    ctx.fillStyle = 'rgba(5,7,15,0.7)';
    ctx.fillRect(-width / 2, -enemy.radius - 12, width, 4);
    ctx.fillStyle = '#ff6b81';
    ctx.fillRect(-width / 2, -enemy.radius - 12, width * (enemy.hp / enemy.maxHp), 4);
  }
  ctx.restore();
}

function drawPlayer(ctx, player, time) {
  if (!player.alive) return;
  ctx.save();
  const blink = player.invulnerable > 0 && Math.sin(time * 30) > 0;
  ctx.globalAlpha = blink ? 0.35 : 1;
  if (player.shield > 0) {
    ctx.strokeStyle = '#7dffb0';
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(time * 6);
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = blink ? 0.35 : 1;
  }
  drawGlow(ctx, player.x, player.y, 52, '#ffd76a', 0.9);
  // Lantern body.
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius - 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a2d12';
  ctx.beginPath();
  ctx.arc(player.x, player.y, 4, 0, Math.PI * 2);
  ctx.fill();
  // Aim tick.
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(player.x + Math.cos(player.angle) * (player.radius + 2), player.y + Math.sin(player.angle) * (player.radius + 2));
  ctx.lineTo(player.x + Math.cos(player.angle) * (player.radius + 12), player.y + Math.sin(player.angle) * (player.radius + 12));
  ctx.stroke();
  ctx.restore();
}

function drawHud(ctx, state, best, muted) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  // Score, top left.
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText('SCORE', 24, 32);
  ctx.fillStyle = PALETTE.ink;
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.fillText(String(state.score), 24, 62);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText(`BEST  ${Math.max(best, state.score)}`, 24, 84);
  // Wave, top centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText(state.endless ? 'ENDLESS' : `WAVE ${Math.max(1, state.wave)} / 10`, FIELD.width / 2, 32);
  ctx.fillStyle = PALETTE.ink;
  ctx.font = '800 22px system-ui, sans-serif';
  const remaining = state.enemies.length + state.spawnQueue.length;
  ctx.fillText(state.waveActive ? `${remaining} shadows left` : 'clear!', FIELD.width / 2, 58);
  // Hearts, top right.
  ctx.textAlign = 'right';
  let hearts = '';
  for (let i = 0; i < PLAYER.maxHearts; i += 1) hearts += i < state.hearts ? '♥ ' : '♡ ';
  ctx.fillStyle = '#ff6b81';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText(hearts.trim(), FIELD.width - 24, 58);
  // Dash cooldown bar.
  const dashReady = state.player.dashCooldown <= 0;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(FIELD.width - 144, 70, 120, 6);
  ctx.fillStyle = dashReady ? '#6ee7ff' : '#3a4470';
  ctx.fillRect(FIELD.width - 144, 70, 120 * (dashReady ? 1 : 1 - state.player.dashCooldown / PLAYER.dashCooldown), 6);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText(dashReady ? 'DASH READY  [SHIFT]' : 'DASH…', FIELD.width - 24, 92);
  // Active powers.
  let powerY = 112;
  ctx.font = '700 13px system-ui, sans-serif';
  if (state.player.spread > 0) {
    ctx.fillStyle = '#6ee7ff';
    ctx.fillText(`SPREAD ${Math.ceil(state.player.spread)}s`, FIELD.width - 24, powerY);
    powerY += 20;
  }
  if (state.player.shield > 0) {
    ctx.fillStyle = '#7dffb0';
    ctx.fillText(`SHIELD ${Math.ceil(state.player.shield)}s`, FIELD.width - 24, powerY);
    powerY += 20;
  }
  // Mute state, bottom right.
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(muted ? 'SOUND OFF  [M]' : 'SOUND ON  [M]', FIELD.width - 24, FIELD.height - 18);
  ctx.restore();
}

function drawWaveBanner(ctx, state) {
  if (state.waveBanner <= 0) return;
  const alpha = Math.min(1, state.waveBanner);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = '800 54px system-ui, sans-serif';
  ctx.fillText(state.waveBannerText, FIELD.width / 2, FIELD.height / 2 - 70);
  ctx.fillStyle = PALETTE.ink;
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.fillText(state.wave === 1 ? 'The dark is coming — hold the light!' : 'They grow stronger…', FIELD.width / 2, FIELD.height / 2 - 38);
  ctx.restore();
}

function drawCentredPanel(ctx, lines) {
  ctx.save();
  ctx.textAlign = 'center';
  for (const line of lines) {
    ctx.fillStyle = line.colour;
    ctx.font = line.font;
    ctx.fillText(line.text, FIELD.width / 2, line.y);
  }
  ctx.restore();
}

function drawTitle(ctx, state, best, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(5,7,15,0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  drawGlow(ctx, FIELD.width / 2, 250, 260, '#ffd76a', 0.35);
  drawCentredPanel(ctx, [
    { text: 'LUMENFALL', colour: '#ffd76a', font: '800 84px system-ui, sans-serif', y: 218 },
    { text: '— Last Light of the Hollow —', colour: PALETTE.ink, font: '600 22px system-ui, sans-serif', y: 258 },
    { text: 'The dark sends its shadows. You are the last Warden of the Ember Lighthouse.', colour: PALETTE.dim, font: '500 17px system-ui, sans-serif', y: 300 },
    { text: 'Survive all 10 waves and bring back the dawn.', colour: PALETTE.dim, font: '500 17px system-ui, sans-serif', y: 326 },
  ]);
  const pulse = 0.65 + 0.35 * Math.sin(time * 3);
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#7dffb0';
  ctx.font = '800 24px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('▶  CLICK OR PRESS ENTER TO START', FIELD.width / 2, 392);
  ctx.restore();
  drawCentredPanel(ctx, [
    { text: 'WASD / ARROWS — move      MOUSE — aim      HOLD CLICK / SPACE — shoot      SHIFT — dash', colour: PALETTE.ink, font: '600 15px system-ui, sans-serif', y: 448 },
    { text: 'P — pause      M — sound      Grab embers, hearts, spread shot, shields and novas', colour: PALETTE.dim, font: '500 14px system-ui, sans-serif', y: 476 },
  ]);
  if (best > 0) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.fillText(`BEST SCORE  ${best}`, FIELD.width / 2, 528);
    ctx.restore();
  }
  ctx.restore();
}

function drawPause(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(5,7,15,0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  drawCentredPanel(ctx, [
    { text: 'PAUSED', colour: PALETTE.ink, font: '800 56px system-ui, sans-serif', y: 330 },
    { text: 'Press P or click to carry on', colour: PALETTE.dim, font: '500 18px system-ui, sans-serif', y: 372 },
  ]);
  ctx.restore();
}

function drawStats(ctx, state, best, y) {
  const accuracy = state.shotsFired === 0 ? 0 : Math.round((state.shotsHit / state.shotsFired) * 100);
  const rows = [
    `SCORE   ${state.score}`,
    `BEST   ${Math.max(best, state.score)}`,
    `WAVE REACHED   ${Math.max(1, state.wave)}`,
    `SHADOWS BANISHED   ${state.kills}`,
    `ACCURACY   ${accuracy}%`,
  ];
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '600 19px system-ui, sans-serif';
  rows.forEach((row, i) => {
    ctx.fillStyle = i === 0 ? PALETTE.gold : PALETTE.ink;
    ctx.fillText(row, FIELD.width / 2, y + i * 32);
  });
  ctx.restore();
}

function drawOver(ctx, state, best, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(5,7,15,0.68)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  drawCentredPanel(ctx, [
    { text: 'THE LIGHT FADES', colour: '#ff6b81', font: '800 58px system-ui, sans-serif', y: 210 },
    { text: 'The Hollow keeps its dark — this time.', colour: PALETTE.dim, font: '500 18px system-ui, sans-serif', y: 250 },
  ]);
  drawStats(ctx, state, best, 300);
  const pulse = 0.65 + 0.35 * Math.sin(time * 3);
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#7dffb0';
  ctx.font = '800 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('↻  PRESS R OR CLICK TO PLAY AGAIN', FIELD.width / 2, 500);
  ctx.restore();
  ctx.restore();
}

function drawWin(ctx, state, best, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(5,7,15,0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  drawGlow(ctx, FIELD.width / 2, 200, 300, '#ffd76a', 0.5);
  drawCentredPanel(ctx, [
    { text: 'DAWN BREAKS', colour: '#ffd76a', font: '800 62px system-ui, sans-serif', y: 200 },
    { text: 'All ten waves are gone. The Hollow is safe — for now.', colour: PALETTE.ink, font: '500 19px system-ui, sans-serif', y: 242 },
  ]);
  drawStats(ctx, state, best, 292);
  const pulse = 0.65 + 0.35 * Math.sin(time * 3);
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#7dffb0';
  ctx.font = '800 21px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ENTER — keep playing endless      R — play again', FIELD.width / 2, 492);
  ctx.restore();
  ctx.restore();
}

// Draw one frame. `screen` is one of the SCREEN_* constants; `best` is the saved best
// score and `muted` the sound state, both shown on the HUD.
export function draw(ctx, world, screen, best, muted) {
  const state = world.state;
  const time = state.time;
  ctx.save();
  if (state.shake > 0) {
    const magnitude = state.shake * 9;
    ctx.translate(Math.sin(time * 127.1) * magnitude, Math.cos(time * 149.7) * magnitude);
  }
  drawBackground(ctx, time);
  drawLighthouse(ctx, time);
  for (const pickup of state.pickups) drawPickup(ctx, pickup, time);
  for (const bullet of state.enemyBullets) {
    drawGlow(ctx, bullet.x, bullet.y, 18, '#b78cff', 0.8);
    ctx.fillStyle = '#d9b8ff';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const enemy of state.enemies) drawEnemy(ctx, enemy, time);
  if (screen !== SCREEN_TITLE) drawPlayer(ctx, state.player, time);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const bullet of state.bullets) {
    drawGlow(ctx, bullet.x, bullet.y, 14, '#ffd76a', 0.8);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  world.particles.draw(ctx);
  if (screen === SCREEN_PLAY || screen === SCREEN_PAUSE) drawHud(ctx, state, best, muted);
  drawWaveBanner(ctx, state);
  if (state.flash > 0) {
    const gradient = ctx.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.3,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.75,
    );
    gradient.addColorStop(0, 'rgba(255,60,80,0)');
    gradient.addColorStop(1, `rgba(255,60,80,${0.5 * state.flash})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
  ctx.restore();

  if (screen === SCREEN_TITLE) drawTitle(ctx, state, best, time);
  else if (screen === SCREEN_PAUSE) drawPause(ctx);
  else if (screen === SCREEN_OVER) drawOver(ctx, state, best, time);
  else if (screen === SCREEN_WIN) drawWin(ctx, state, best, time);
}
