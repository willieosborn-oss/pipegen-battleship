/** Public engine API for PipeGen Battleship. */
export * from './types';
export { createRng, randInt, type Rng } from './rng';
export { createEmptyBoard, placeFleetRandomly } from './placement';
export { createGame, fireShot } from './game';
export { chooseAiShot } from './ai';
