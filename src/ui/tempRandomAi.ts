/**
 * Temporary placeholder AI for PipeGen Battleship.
 *
 * Fires at a uniformly random cell that has not yet been fired upon on the
 * player's board. This deliberately lives outside `src/engine/` so a future
 * session can replace `chooseAiShot` with a real strategy without touching the
 * engine or the UI wiring. The 600ms firing delay is applied by the caller.
 */

import type { Coord, GameState } from '../engine';

/**
 * Choose the AI's next shot: a uniformly random un-fired cell on the player's
 * board (a cell whose grid state is still 'unknown').
 *
 * @throws if every cell has already been fired upon (never happens in a live
 * game, since the game ends once a fleet is sunk).
 */
export function chooseAiShot(state: GameState): Coord {
  const board = state.playerBoard;
  const candidates: Coord[] = [];
  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      if (board.grid[row][col] === 'unknown') {
        candidates.push({ row, col });
      }
    }
  }
  if (candidates.length === 0) {
    throw new Error('chooseAiShot: no un-fired cells remain');
  }
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}
