/**
 * Game orchestration: creating games and firing shots.
 *
 * All operations are pure and fully immutable. `fireShot` never mutates its
 * input `state` (nor any nested board, ship, or grid); a hit produces new ship,
 * board, and state objects, leaving prior references intact so React can hold
 * previous snapshots safely.
 */

import {
  type Board,
  type Coord,
  type FireResult,
  type GameState,
  type Player,
  type Ship,
  type Winner,
} from './types';
import { createRng, randInt } from './rng';
import { placeFleetRandomly, createEmptyBoard } from './placement';

/** Derive a non-negative default seed when none is supplied. */
function defaultSeed(): number {
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}

/**
 * Create a new game. Both fleets are placed randomly. When `seed` is provided
 * the resulting game (including placement) is fully deterministic. The player
 * fires first.
 */
export function createGame(seed?: number): GameState {
  const rng = createRng(seed ?? defaultSeed());
  // Player and AI boards are placed from the same RNG stream so the whole game
  // derives deterministically from the seed.
  const playerBoard = placeFleetRandomly(createEmptyBoard(), rng);
  const aiBoard = placeFleetRandomly(createEmptyBoard(), rng);
  return {
    playerBoard,
    aiBoard,
    turn: 'player',
    winner: null,
  };
}

/** The board that the given shooter is firing upon (the opponent's board). */
function targetBoardFor(state: GameState, shooter: Player): Board {
  return shooter === 'player' ? state.aiBoard : state.playerBoard;
}

/** Whether every ship on a board is fully sunk. */
function allSunk(board: Board): boolean {
  return board.ships.every((ship) => ship.hits.every((h) => h));
}

/** Whether a single ship is fully sunk. */
function isSunk(ship: Ship): boolean {
  return ship.hits.every((h) => h);
}

/**
 * Fire a shot from `shooter` at `coord` on the opponent's board.
 *
 * Invalid (state unchanged, turn NOT consumed) when:
 *  - the game is already won,
 *  - it is not `shooter`'s turn,
 *  - `coord` is off-board,
 *  - `coord` has already been fired upon.
 *
 * Otherwise the shot is a miss, hit, or sunk. `winner` is always present:
 * null unless this shot sinks the opponent's fifth (last) ship, in which case
 * it is `shooter`.
 */
export function fireShot(
  state: GameState,
  shooter: Player,
  coord: Coord,
): FireResult {
  const invalid = (): FireResult => ({
    result: 'invalid',
    newState: state,
    winner: state.winner,
  });

  // Post-game or wrong-turn shots are invalid and do not consume the turn.
  if (state.winner !== null) return invalid();
  if (state.turn !== shooter) return invalid();

  const target = targetBoardFor(state, shooter);

  // Off-board coordinates are invalid.
  if (
    coord.row < 0 ||
    coord.row >= target.size ||
    coord.col < 0 ||
    coord.col >= target.size
  ) {
    return invalid();
  }

  // Already-fired cells are invalid and do not consume the turn.
  if (target.grid[coord.row][coord.col] !== 'unknown') {
    return invalid();
  }

  // Find a ship occupying the cell, if any.
  const hitShipIndex = target.ships.findIndex((ship) =>
    ship.cells.some((c) => c.row === coord.row && c.col === coord.col),
  );

  const nextTurn: Player = shooter === 'player' ? 'ai' : 'player';

  if (hitShipIndex === -1) {
    // Miss: record it on a fresh board/grid.
    const newBoard = withGridCell(target, coord, 'miss');
    const newState = withTargetBoard(state, shooter, newBoard, nextTurn, null);
    return { result: 'miss', newState, winner: null };
  }

  // Hit: build a new ship with the appropriate cell marked hit.
  const oldShip = target.ships[hitShipIndex];
  const cellIndex = oldShip.cells.findIndex(
    (c) => c.row === coord.row && c.col === coord.col,
  );
  const newHits = oldShip.hits.map((h, i) => (i === cellIndex ? true : h));
  const newShip: Ship = { ...oldShip, hits: newHits };

  const newShips = target.ships.map((s, i) =>
    i === hitShipIndex ? newShip : s,
  );
  const griddedBoard = withGridCell(
    { ...target, ships: newShips },
    coord,
    'hit',
  );

  const sunk = isSunk(newShip);
  const won = sunk && allSunk(griddedBoard);
  const winner: Winner = won ? shooter : null;
  const newState = withTargetBoard(
    state,
    shooter,
    griddedBoard,
    nextTurn,
    winner,
  );

  if (won) {
    return { result: 'sunk', shipName: newShip.name, newState, winner };
  }
  if (sunk) {
    return { result: 'sunk', shipName: newShip.name, newState, winner: null };
  }
  return { result: 'hit', shipName: newShip.name, newState, winner: null };
}

/** Return a new Board with a single grid cell updated (immutably). */
function withGridCell(
  board: Board,
  coord: Coord,
  value: 'hit' | 'miss',
): Board {
  const newGrid = board.grid.map((rowArr, r) =>
    r === coord.row
      ? rowArr.map((cell, c) => (c === coord.col ? value : cell))
      : rowArr,
  );
  return { ...board, grid: newGrid };
}

/**
 * Return a new GameState with the shooter's target board replaced and the turn
 * and winner updated. The shooter's own board is carried over by reference,
 * which is safe because it is never mutated.
 */
function withTargetBoard(
  state: GameState,
  shooter: Player,
  newTargetBoard: Board,
  nextTurn: Player,
  winner: Winner,
): GameState {
  if (shooter === 'player') {
    return {
      ...state,
      aiBoard: newTargetBoard,
      turn: nextTurn,
      winner,
    };
  }
  return {
    ...state,
    playerBoard: newTargetBoard,
    turn: nextTurn,
    winner,
  };
}

/** Re-export helpers useful to tests and later UI sessions. */
export { placeFleetRandomly, createEmptyBoard, createRng, randInt };
