// Pooled particles and floating score texts. Everything is drawn additively over the
// world, and nothing here touches game state: it is pure feedback. The particle motion
// runs on its own seeded stream, so a staged screenshot scene renders identically
// every time from the same seed.
import { makeRandom } from './random.js';

export class Particles {
  constructor(seed = 1) {
    this.random = makeRandom(seed * 7919 + 13);
    this.list = [];
    this.texts = [];
  }

  burst(x, y, colour, count, speed = 220, life = 0.6, size = 3) {
    for (let i = 0; i < count; i += 1) {
      const angle = this.random() * Math.PI * 2;
      const velocity = speed * (0.3 + this.random() * 0.7);
      this.list.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: life * (0.6 + this.random() * 0.6),
        maxLife: life,
        size: size * (0.6 + this.random() * 0.8),
        colour,
      });
    }
    if (this.list.length > 420) this.list.splice(0, this.list.length - 420);
  }

  ring(x, y, colour, count = 26, speed = 320) {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      this.list.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5,
        maxLife: 0.5,
        size: 3,
        colour,
      });
    }
  }

  trail(x, y, colour) {
    this.list.push({ x, y, vx: 0, vy: 0, life: 0.3, maxLife: 0.3, size: 5, colour });
  }

  floatText(x, y, text, colour) {
    this.texts.push({ x, y, text, colour, life: 0.9, maxLife: 0.9 });
    if (this.texts.length > 24) this.texts.shift();
  }

  step(dt) {
    for (let i = this.list.length - 1; i >= 0; i -= 1) {
      const particle = this.list[i];
      particle.life -= dt;
      if (particle.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.94;
      particle.vy *= 0.94;
    }
    for (let i = this.texts.length - 1; i >= 0; i -= 1) {
      const text = this.texts[i];
      text.life -= dt;
      text.y -= 34 * dt;
      if (text.life <= 0) this.texts.splice(i, 1);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const particle of this.list) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.colour;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 15px system-ui, sans-serif';
    for (const text of this.texts) {
      ctx.globalAlpha = Math.max(0, text.life / text.maxLife);
      ctx.fillStyle = text.colour;
      ctx.fillText(text.text, text.x, text.y);
    }
    ctx.restore();
  }
}
