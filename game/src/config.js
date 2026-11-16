// LUMENFALL tuning: every number that shapes how the game feels lives here, so the
// balance can be read and changed in one place.
export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const WIN_WAVE = 10;

export const PALETTE = {
  backgroundTop: '#0b1026',
  backgroundBottom: '#05070f',
  star: '#cdd7ff',
  ember: '#ffb347',
  gold: '#ffd76a',
  cyan: '#6ee7ff',
  violet: '#b78cff',
  rose: '#ff6b81',
  leaf: '#7dffb0',
  ink: '#eaf0ff',
  dim: '#8b96c9',
};

export const PLAYER = {
  radius: 14,
  speed: 265,
  fireInterval: 0.135,
  bulletSpeed: 640,
  bulletRadius: 5,
  maxHearts: 5,
  startHearts: 3,
  dashCooldown: 1.6,
  dashTime: 0.16,
  dashSpeed: 3.1,
  invulnerableTime: 1.0,
  spreadTime: 12,
  shieldTime: 20,
};

// kind -> { radius, speed, hp, score, colour, behaviour }
export const ENEMIES = {
  wisp: { radius: 11, speed: 128, hp: 1, score: 10, colour: '#b78cff', glow: '#8b5cf6' },
  shade: { radius: 17, speed: 74, hp: 3, score: 25, colour: '#8b96c9', glow: '#5b6bbf' },
  spitter: { radius: 14, speed: 88, hp: 2, score: 30, colour: '#ff6b81', glow: '#e5484d' },
  brute: { radius: 28, speed: 46, hp: 10, score: 60, colour: '#ff9d5c', glow: '#f76b15' },
};

export const ELITE_MULTIPLIER = { size: 1.45, hp: 2.5, score: 3, speed: 0.9 };

export const PICKUPS = {
  ember: { score: 25, colour: '#ffb347' },
  heart: { colour: '#ff6b81' },
  spread: { colour: '#6ee7ff' },
  shield: { colour: '#7dffb0' },
  nova: { colour: '#ffd76a' },
};

// Wave N fields this many foes in total; the mix unlocks as the waves climb.
export function waveSize(wave) {
  return 5 + 3 * wave;
}
export function waveSpawnInterval(wave) {
  return Math.max(0.34, 1.05 - wave * 0.06);
}
export function waveClearBonus(wave) {
  return 50 + 50 * wave;
}
// Which kinds may appear in a wave, with their relative weights.
export function waveMix(wave) {
  const mix = [{ kind: 'wisp', weight: 10 }];
  if (wave >= 2) mix.push({ kind: 'shade', weight: 5 });
  if (wave >= 3) mix.push({ kind: 'spitter', weight: 4 });
  if (wave >= 4) mix.push({ kind: 'brute', weight: 2 });
  return mix;
}
export function eliteChance(wave) {
  return wave >= 4 ? Math.min(0.22, 0.05 + wave * 0.015) : 0;
}
