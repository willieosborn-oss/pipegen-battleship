/**
 * Random fleet placement.
 *
 * Ships are placed sequentially; each ship gets a random orientation and origin,
 * and is retried until it fits fully on the board with no overlap and no
 * row-wrapping. Placement is a pure function of the provided RNG, so a seeded
 * RNG yields deterministic fleets.
 */

import {
  type Board,
  type Coord,
  type Orientation,
  type Ship,
  BOARD_SIZE,
  FLEET,
} from './types';
import { type Rng, randInt } from './rng';

/** Build an empty board of the given size with no ships and an all-unknown grid. */
export function createEmptyBoard(size: number = BOARD_SIZE): Board {
  const grid = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 'unknown' as const),
  );
  return { size, ships: [], grid };
}

/** Compute the cells a ship would occupy from an origin, orientation and length. */
function shipCells(
  origin: Coord,
  orientation: Orientation,
  length: number,
): Coord[] {
  const cells: Coord[] = [];
  for (let i = 0; i < length; i++) {
    if (orientation === 'horizontal') {
      cells.push({ row: origin.row, col: origin.col + i });
    } else {
      cells.push({ row: origin.row + i, col: origin.col });
    }
  }
  return cells;
}

/**
 * Whether every cell fits on the board. Horizontal ships never wrap because all
 * cells share `origin.row` and columns are bounded; vertical ships stay within a
 * single column. The bounds check enforces both.
 */
function fitsOnBoard(cells: readonly Coord[], size: number): boolean {
  return cells.every(
    (c) => c.row >= 0 && c.row < size && c.col >= 0 && c.col < size,
  );
}

/** Whether any of `cells` collides with an already-occupied cell. */
function overlaps(
  cells: readonly Coord[],
  occupied: ReadonlySet<string>,
): boolean {
  return cells.some((c) => occupied.has(`${c.row},${c.col}`));
}

/**
 * Place the full fleet randomly on a fresh copy of `board`.
 *
 * Returns a new Board; the input board is not mutated. Each ship is placed with
 * bounded retries; the search space for a standard fleet on a 10x10 board makes
 * exhaustion astronomically unlikely, but a guard throws rather than loop
 * forever in a pathological case.
 */
export function placeFleetRandomly(board: Board, rng: Rng): Board {
  const size = board.size;
  const occupied = new Set<string>();
  const ships: Ship[] = [];

  for (const spec of FLEET) {
    let placed = false;
    for (let attempt = 0; attempt < 10000 && !placed; attempt++) {
      const orientation: Orientation =
        randInt(rng, 2) === 0 ? 'horizontal' : 'vertical';
      const maxRow = orientation === 'vertical' ? size - spec.length : size - 1;
      const maxCol =
        orientation === 'horizontal' ? size - spec.length : size - 1;
      const origin: Coord = {
        row: randInt(rng, maxRow + 1),
        col: randInt(rng, maxCol + 1),
      };
      const cells = shipCells(origin, orientation, spec.length);
      if (!fitsOnBoard(cells, size) || overlaps(cells, occupied)) {
        continue;
      }
      for (const c of cells) {
        occupied.add(`${c.row},${c.col}`);
      }
      ships.push({
        name: spec.name,
        length: spec.length,
        cells,
        hits: cells.map(() => false),
      });
      placed = true;
    }
    if (!placed) {
      throw new Error(`Failed to place ship ${spec.name}`);
    }
  }

  const grid = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 'unknown' as const),
  );
  return { size, ships, grid };
}
