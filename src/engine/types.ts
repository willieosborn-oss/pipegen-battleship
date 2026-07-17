/**
 * Core engine types for PipeGen Battleship.
 *
 * All types are plain data (no classes, no methods) so state objects can be
 * held by React and freely structurally-cloned in a later UI session.
 */

/** Zero-indexed board coordinate. Display labels (A1, etc.) are a UI concern. */
export interface Coord {
  readonly row: number;
  readonly col: number;
}

/** Orientation of a ship on the board. */
export type Orientation = 'horizontal' | 'vertical';

/** The two sides. */
export type Player = 'player' | 'ai';

/** Winner is always present on results: a side, or null when nobody has won. */
export type Winner = Player | null;

/** The five ship names, in descending-length order. */
export type ShipName =
  | 'Majors'
  | 'Strategic Enterprise'
  | 'Enterprise'
  | 'Growth'
  | 'Startup';

/** A placed ship. `hits[i]` tracks whether `cells[i]` has been hit. */
export interface Ship {
  readonly name: ShipName;
  readonly length: number;
  readonly cells: readonly Coord[];
  readonly hits: readonly boolean[];
}

/** Outcome of a single cell being fired upon, tracked per-board. */
export type CellState = 'unknown' | 'hit' | 'miss';

/**
 * A single side's board: the fleet plus a grid of per-cell shot outcomes.
 * `grid[row][col]` records what has happened at that cell.
 */
export interface Board {
  readonly size: number;
  readonly ships: readonly Ship[];
  readonly grid: readonly (readonly CellState[])[];
}

/** Full game state. Immutable: every mutation produces a fresh object. */
export interface GameState {
  readonly playerBoard: Board;
  readonly aiBoard: Board;
  /** Whose turn it is to fire. */
  readonly turn: Player;
  /** The winner, or null while the game is ongoing. */
  readonly winner: Winner;
}

/** Result of a fired shot. */
export type ShotResult = 'hit' | 'miss' | 'sunk' | 'invalid';

/** Return value of {@link fireShot}. `winner` is always present. */
export interface FireResult {
  readonly result: ShotResult;
  readonly shipName?: ShipName;
  readonly newState: GameState;
  readonly winner: Winner;
}

/** The fleet definition: lengths and names, in placement order. */
export const FLEET: readonly { name: ShipName; length: number }[] = [
  { name: 'Majors', length: 5 },
  { name: 'Strategic Enterprise', length: 4 },
  { name: 'Enterprise', length: 3 },
  { name: 'Growth', length: 3 },
  { name: 'Startup', length: 2 },
];

/** Standard board dimension. */
export const BOARD_SIZE = 10;
