// The game world: the player, the foes, the bullets, the pickups, the waves and the
// score. It is a pure fixed-step simulation over a seeded random stream: the same seed
// and the same inputs always give the same world, which is what makes the screenshot
// scenes reproducible. Rendering and sound live elsewhere; the world only reports what
// happened through its events bitmask and its state.
import {
  FIELD,
  STEP,
  WIN_WAVE,
  PLAYER,
  ENEMIES,
  ELITE_MULTIPLIER,
  PICKUPS,
  waveSize,
  waveSpawnInterval,
  waveClearBonus,
  waveMix,
  eliteChance,
} from './config.js';
import { makeRandom, randomRange, randomPick, randomAngle } from './random.js';
import { Particles } from './particles.js';

export const EVENT_NONE = 0;
export const EVENT_SHOOT = 1;
export const EVENT_KILL = 2;
export const EVENT_HIT = 4;
export const EVENT_PICKUP = 8;
export const EVENT_WAVE = 16;
export const EVENT_DASH = 32;
export const EVENT_OVER = 64;
export const EVENT_WIN = 128;
export const EVENT_NOVA = 256;

export const KIND_WISP = 'wisp';
export const KIND_SHADE = 'shade';
export const KIND_SPITTER = 'spitter';
export const KIND_BRUTE = 'brute';

let nextId = 1;

export class World {
  constructor(seed = 1) {
    this.seed = seed;
    this.random = makeRandom(seed);
    this.particles = new Particles(seed);
    this.reset();
  }

  reset() {
    this.random = makeRandom(this.seed);
    this.particles = new Particles(this.seed);
    this.state = {
      time: 0,
      score: 0,
      best: 0,
      wave: 0,
      kills: 0,
      shotsFired: 0,
      shotsHit: 0,
      hearts: PLAYER.startHearts,
      player: {
        x: FIELD.width / 2,
        y: FIELD.height / 2 + 60,
        vx: 0,
        vy: 0,
        radius: PLAYER.radius,
        angle: -Math.PI / 2,
        fireTimer: 0,
        dashTimer: 0,
        dashCooldown: 0,
        invulnerable: 0,
        spread: 0,
        shield: 0,
        alive: true,
      },
      enemies: [],
      bullets: [],
      enemyBullets: [],
      pickups: [],
      spawnQueue: [],
      spawnTimer: 0,
      waveActive: false,
      waveBanner: 0,
      waveBannerText: '',
      shake: 0,
      flash: 0,
      over: false,
      won: false,
      endless: false,
    };
  }

  get player() {
    return this.state.player;
  }

  startWave(wave) {
    const state = this.state;
    state.wave = wave;
    state.waveActive = true;
    state.waveBanner = 2.2;
    state.waveBannerText = `WAVE ${wave}`;
    state.spawnQueue = [];
    const total = waveSize(wave);
    const mix = waveMix(wave);
    for (let i = 0; i < total; i += 1) {
      const kind = randomPick(this.random, mix);
      const elite = this.random() < eliteChance(wave);
      state.spawnQueue.push({ kind, elite });
    }
    state.spawnTimer = 0.6;
    return EVENT_WAVE;
  }

  spawnEnemy(kind, elite, atX = null, atY = null) {
    const state = this.state;
    const base = ENEMIES[kind];
    let x;
    let y;
    if (atX !== null && atY !== null) {
      x = atX;
      y = atY;
    } else {
      const angle = randomAngle(this.random);
      const distance = randomRange(this.random, 300, 460);
      x = FIELD.width / 2 + Math.cos(angle) * distance;
      y = FIELD.height / 2 + Math.sin(angle) * distance;
    }
    x = Math.max(30, Math.min(FIELD.width - 30, x));
    y = Math.max(30, Math.min(FIELD.height - 30, y));
    const size = elite ? ELITE_MULTIPLIER.size : 1;
    const enemy = {
      id: nextId,
      kind,
      elite,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: base.radius * size,
      hp: Math.round(base.hp * (elite ? ELITE_MULTIPLIER.hp : 1)),
      maxHp: Math.round(base.hp * (elite ? ELITE_MULTIPLIER.hp : 1)),
      speed: base.speed * (elite ? ELITE_MULTIPLIER.speed : 1) * (1 + state.wave * 0.02),
      score: base.score * (elite ? ELITE_MULTIPLIER.score : 1),
      colour: elite ? '#ffd76a' : base.colour,
      glow: base.glow,
      shootTimer: randomRange(this.random, 1.2, 2.4),
      wobble: randomRange(this.random, 0, Math.PI * 2),
      hitFlash: 0,
    };
    nextId += 1;
    state.enemies.push(enemy);
  }

  dropPickup(x, y, forcedKind = null) {
    const state = this.state;
    let kind = forcedKind;
    if (!kind) {
      const roll = this.random();
      if (roll < 0.55) kind = 'ember';
      else if (roll < 0.7) kind = 'heart';
      else if (roll < 0.85) kind = 'spread';
      else kind = 'shield';
    }
    state.pickups.push({
      id: nextId,
      kind,
      x: Math.max(24, Math.min(FIELD.width - 24, x)),
      y: Math.max(24, Math.min(FIELD.height - 24, y)),
      life: 12,
      bob: randomRange(this.random, 0, Math.PI * 2),
    });
    nextId += 1;
  }

  fireBullet(angle) {
    const state = this.state;
    const player = state.player;
    state.bullets.push({
      x: player.x + Math.cos(angle) * (player.radius + 6),
      y: player.y + Math.sin(angle) * (player.radius + 6),
      vx: Math.cos(angle) * PLAYER.bulletSpeed,
      vy: Math.sin(angle) * PLAYER.bulletSpeed,
      radius: PLAYER.bulletRadius,
      life: 1.1,
    });
    state.shotsFired += 1;
  }

  killEnemy(enemy, awardScore) {
    const state = this.state;
    state.kills += 1;
    if (awardScore) {
      state.score += enemy.score;
      this.particles.floatText(enemy.x, enemy.y, `+${enemy.score}`, '#ffd76a');
    }
    this.particles.burst(enemy.x, enemy.y, enemy.glow, enemy.kind === 'brute' ? 26 : 14, 240, 0.55, 3.5);
    this.particles.ring(enemy.x, enemy.y, enemy.colour, 14, 200);
    if (enemy.kind === KIND_SHADE) {
      for (let i = 0; i < 2; i += 1) {
        const wisp = { ...enemy, id: nextId, kind: KIND_WISP, radius: ENEMIES.wisp.radius, hp: 1, maxHp: 1, speed: ENEMIES.wisp.speed, score: ENEMIES.wisp.score, colour: ENEMIES.wisp.colour, glow: ENEMIES.wisp.glow, elite: false };
        nextId += 1;
        wisp.x += (i === 0 ? -14 : 14);
        state.enemies.push(wisp);
      }
    }
    const roll = this.random();
    if (enemy.elite) {
      this.dropPickup(enemy.x, enemy.y, this.random() < 0.4 ? 'nova' : null);
    } else if (enemy.kind === KIND_BRUTE) {
      this.dropPickup(enemy.x, enemy.y);
    } else if (roll < 0.05) {
      this.dropPickup(enemy.x, enemy.y, 'ember');
    }
  }

  damagePlayer() {
    const state = this.state;
    const player = state.player;
    if (player.invulnerable > 0 || player.dashTimer > 0 || state.over) return EVENT_NONE;
    if (player.shield > 0) {
      player.shield = 0;
      player.invulnerable = 0.8;
      state.shake = Math.max(state.shake, 0.35);
      this.particles.ring(player.x, player.y, '#7dffb0', 22, 300);
      return EVENT_HIT;
    }
    state.hearts -= 1;
    player.invulnerable = PLAYER.invulnerableTime;
    state.shake = 0.7;
    state.flash = 0.5;
    this.particles.burst(player.x, player.y, '#ff6b81', 22, 260, 0.6, 4);
    if (state.hearts <= 0) {
      state.over = true;
      player.alive = false;
      this.particles.burst(player.x, player.y, '#ffd76a', 60, 380, 1.0, 4);
      this.particles.ring(player.x, player.y, '#ffd76a', 30, 420);
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  applyPickup(pickup) {
    const state = this.state;
    const player = state.player;
    let events = EVENT_PICKUP;
    if (pickup.kind === 'ember') {
      state.score += PICKUPS.ember.score;
      this.particles.floatText(pickup.x, pickup.y, `+${PICKUPS.ember.score}`, '#ffb347');
    } else if (pickup.kind === 'heart') {
      state.hearts = Math.min(PLAYER.maxHearts, state.hearts + 1);
      this.particles.floatText(pickup.x, pickup.y, '+1 ♥', '#ff6b81');
    } else if (pickup.kind === 'spread') {
      player.spread = PLAYER.spreadTime;
      this.particles.floatText(pickup.x, pickup.y, 'SPREAD SHOT', '#6ee7ff');
    } else if (pickup.kind === 'shield') {
      player.shield = PLAYER.shieldTime;
      this.particles.floatText(pickup.x, pickup.y, 'SHIELD', '#7dffb0');
    } else if (pickup.kind === 'nova') {
      for (const enemy of state.enemies) this.killEnemy(enemy, true);
      state.enemies = [];
      state.enemyBullets = [];
      events |= EVENT_NOVA;
      state.shake = 0.8;
      this.particles.ring(player.x, player.y, '#ffd76a', 40, 520);
    }
    this.particles.burst(pickup.x, pickup.y, PICKUPS[pickup.kind].colour, 10, 160, 0.5, 3);
    return events;
  }

  // One fixed step. `input` is { moveX, moveY, aimX, aimY, firing, dash }.
  // `ambient` plays the world with no player input (title backdrop).
  step(dt, input, ambient = false) {
    const state = this.state;
    const player = state.player;
    let events = EVENT_NONE;
    state.time += dt;

    if (state.waveBanner > 0) state.waveBanner -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.6);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.4);
    if (player.invulnerable > 0) player.invulnerable -= dt;
    if (player.dashCooldown > 0) player.dashCooldown -= dt;
    if (player.spread > 0) player.spread -= dt;
    if (player.shield > 0) player.shield -= dt;

    // Spawning.
    if (state.waveActive && state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        const next = state.spawnQueue.shift();
        this.spawnEnemy(next.kind, next.elite);
        state.spawnTimer = waveSpawnInterval(state.wave);
      }
    }

    // Player movement and dash.
    if (!state.over && !ambient) {
      const dashing = player.dashTimer > 0;
      if (input.dash && player.dashCooldown <= 0 && !dashing) {
        player.dashTimer = PLAYER.dashTime;
        player.dashCooldown = PLAYER.dashCooldown;
        events |= EVENT_DASH;
        this.particles.burst(player.x, player.y, '#6ee7ff', 8, 140, 0.3, 3);
      }
      if (player.dashTimer > 0) player.dashTimer -= dt;
      const speed = PLAYER.speed * (dashing ? PLAYER.dashSpeed : 1);
      player.x += input.moveX * speed * dt;
      player.y += input.moveY * speed * dt;
      player.x = Math.max(player.radius + 8, Math.min(FIELD.width - player.radius - 8, player.x));
      player.y = Math.max(player.radius + 8, Math.min(FIELD.height - player.radius - 8, player.y));
      player.angle = Math.atan2(input.aimY - player.y, input.aimX - player.x);

      // Firing.
      player.fireTimer -= dt;
      if (input.firing && player.fireTimer <= 0) {
        player.fireTimer = PLAYER.fireInterval;
        const spread = player.spread > 0 ? [-0.16, 0, 0.16] : [0];
        for (const offset of spread) this.fireBullet(player.angle + offset);
        events |= EVENT_SHOOT;
        this.particles.trail(player.x + Math.cos(player.angle) * 22, player.y + Math.sin(player.angle) * 22, '#ffd76a');
      }
    }

    // Enemies: chase, wobble, spit.
    for (const enemy of state.enemies) {
      if (enemy.hitFlash > 0) enemy.hitFlash -= dt;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;
      enemy.wobble += dt * 3;
      if (enemy.kind === KIND_SPITTER) {
        // Keep a ring around the player and spit shadow orbs.
        const want = 260;
        const radial = distance > want + 30 ? 1 : distance < want - 30 ? -1 : 0;
        const tangent = Math.sin(enemy.wobble * 0.5) * 0.6;
        enemy.x += ((dx / distance) * radial + (-dy / distance) * tangent) * enemy.speed * dt;
        enemy.y += ((dy / distance) * radial + (dx / distance) * tangent) * enemy.speed * dt;
        enemy.shootTimer -= dt;
        if (enemy.shootTimer <= 0 && distance < 560 && !state.over) {
          enemy.shootTimer = randomRange(this.random, 2.0, 2.8);
          state.enemyBullets.push({
            x: enemy.x,
            y: enemy.y,
            vx: (dx / distance) * 165,
            vy: (dy / distance) * 165,
            radius: 6,
            life: 4,
          });
        }
      } else {
        const wobble = Math.sin(enemy.wobble) * 0.35;
        const nx = dx / distance;
        const ny = dy / distance;
        const px = -ny * wobble;
        const py = nx * wobble;
        enemy.x += (nx + px) * enemy.speed * dt;
        enemy.y += (ny + py) * enemy.speed * dt;
      }
      enemy.x = Math.max(enemy.radius, Math.min(FIELD.width - enemy.radius, enemy.x));
      enemy.y = Math.max(enemy.radius, Math.min(FIELD.height - enemy.radius, enemy.y));
    }

    // Bullets.
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      let dead = bullet.life <= 0 || bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20;
      if (!dead) {
        for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
          const enemy = state.enemies[j];
          const dx = bullet.x - enemy.x;
          const dy = bullet.y - enemy.y;
          const reach = bullet.radius + enemy.radius;
          if (dx * dx + dy * dy < reach * reach) {
            enemy.hp -= 1;
            enemy.hitFlash = 0.08;
            state.shotsHit += 1;
            this.particles.burst(bullet.x, bullet.y, '#ffd76a', 4, 120, 0.25, 2.5);
            dead = true;
            if (enemy.hp <= 0) {
              state.enemies.splice(j, 1);
              this.killEnemy(enemy, true);
              events |= EVENT_KILL;
            }
            break;
          }
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }

    // Enemy bullets.
    for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.enemyBullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      let dead = bullet.life <= 0 || bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20;
      if (!dead && !state.over && !ambient && player.invulnerable <= 0) {
        const dx = bullet.x - player.x;
        const dy = bullet.y - player.y;
        const reach = bullet.radius + player.radius;
        if (dx * dx + dy * dy < reach * reach) {
          dead = true;
          events |= this.damagePlayer();
        }
      }
      if (dead) state.enemyBullets.splice(i, 1);
    }

    // Enemy contact with the player.
    if (!state.over && !ambient && player.invulnerable <= 0 && player.dashTimer <= 0) {
      for (const enemy of state.enemies) {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const reach = enemy.radius + player.radius - 2;
        if (dx * dx + dy * dy < reach * reach) {
          events |= this.damagePlayer();
          const distance = Math.hypot(dx, dy) || 1;
          enemy.x += (dx / distance) * 26;
          enemy.y += (dy / distance) * 26;
          break;
        }
      }
    }

    // Pickups: drift, expire, collect.
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = state.pickups[i];
      pickup.life -= dt;
      pickup.bob += dt * 4;
      if (pickup.life <= 0) {
        state.pickups.splice(i, 1);
        continue;
      }
      if (!state.over && !ambient) {
        const dx = pickup.x - player.x;
        const dy = pickup.y - player.y;
        const reach = 22 + player.radius;
        if (dx * dx + dy * dy < reach * reach) {
          state.pickups.splice(i, 1);
          events |= this.applyPickup(pickup);
        }
      }
    }

    // Wave cleared?
    if (state.waveActive && state.spawnQueue.length === 0 && state.enemies.length === 0 && !state.over) {
      state.waveActive = false;
      const bonus = waveClearBonus(state.wave);
      state.score += bonus;
      this.particles.floatText(FIELD.width / 2, FIELD.height / 2 - 40, `WAVE CLEAR  +${bonus}`, '#7dffb0');
      if (state.wave >= WIN_WAVE && !state.endless) {
        state.won = true;
        events |= EVENT_WIN;
      } else {
        events |= this.startWave(state.wave + 1);
      }
    }

    this.particles.step(dt);
    if (state.over) events |= EVENT_OVER;
    return events;
  }

  get accuracy() {
    const state = this.state;
    return state.shotsFired === 0 ? 0 : Math.round((state.shotsHit / state.shotsFired) * 100);
  }
}
