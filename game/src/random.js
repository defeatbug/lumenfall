// A small seeded random generator (mulberry32) so the game world, and therefore every
// screenshot scene, plays out exactly the same way from the same seed.
export function makeRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomRange(random, min, max) {
  return min + random() * (max - min);
}

export function randomPick(random, entries) {
  let total = 0;
  for (const entry of entries) total += entry.weight;
  let roll = random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.kind;
  }
  return entries[entries.length - 1].kind;
}

export function randomAngle(random) {
  return random() * Math.PI * 2;
}
