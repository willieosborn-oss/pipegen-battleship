/**
 * Presentation helpers that translate engine board data into purely visual
 * cell states for rendering. No game logic lives here.
 */

import type { Board } from '../engine';

/** Visual-only classification of a single cell. */
export type CellVisual = 'untouched' | 'ship' | 'miss' | 'hit' | 'sunk';

/** Key a coordinate for set membership. */
const key = (row: number, col: number): string => `${row},${col}`;

/** The set of cells that belong to a fully-sunk ship on this board. */
export function sunkCells(board: Board): ReadonlySet<string> {
  const cells = new Set<string>();
  for (const ship of board.ships) {
    if (ship.hits.every((h) => h)) {
      for (const c of ship.cells) {
        cells.add(key(c.row, c.col));
      }
    }
  }
  return cells;
}

/** The set of cells occupied by any ship on this board. */
export function shipCells(board: Board): ReadonlySet<string> {
  const cells = new Set<string>();
  for (const ship of board.ships) {
    for (const c of ship.cells) {
      cells.add(key(c.row, c.col));
    }
  }
  return cells;
}

/**
 * Classify a single cell for rendering.
 *
 * `showShips` reveals un-hit ship cells (used for the player's own board); when
 * false, un-hit ship cells look untouched (used for the hidden enemy board).
 */
export function cellVisual(
  board: Board,
  row: number,
  col: number,
  showShips: boolean,
  sunk: ReadonlySet<string>,
  ships: ReadonlySet<string>,
): CellVisual {
  const state = board.grid[row][col];
  if (state === 'hit') {
    return sunk.has(key(row, col)) ? 'sunk' : 'hit';
  }
  if (state === 'miss') {
    return 'miss';
  }
  if (showShips && ships.has(key(row, col))) {
    return 'ship';
  }
  return 'untouched';
}
