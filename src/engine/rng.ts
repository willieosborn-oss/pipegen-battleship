/**
 * Deterministic seeded RNG.
 *
 * Uses mulberry32: a small, fast, well-distributed 32-bit generator. Given the
 * same seed it always produces the same sequence, which makes game setup and
 * tests reproducible. The RNG is a plain closure carrying its own state; callers
 * treat it as an opaque `() => number` returning a float in [0, 1).
 */

export type Rng = () => number;

/** Create a seeded RNG. Same seed -> same sequence. */
export function createRng(seed: number): Rng {
  // Coerce to a 32-bit unsigned integer state.
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [0, maxExclusive). */
export function randInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}
