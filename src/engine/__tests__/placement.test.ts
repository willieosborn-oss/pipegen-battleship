import { describe, it, expect } from 'vitest';
import { createEmptyBoard, placeFleetRandomly } from '../placement';
import { createRng } from '../rng';
import { FLEET, BOARD_SIZE, type Ship } from '../types';

/** All cells occupied by a fleet, as "row,col" strings. */
function occupiedKeys(ships: readonly Ship[]): string[] {
  return ships.flatMap((s) => s.cells.map((c) => `${c.row},${c.col}`));
}

/** Whether a ship's cells form a straight, contiguous, non-wrapping line. */
function isStraightNoWrap(ship: Ship): boolean {
  const rows = new Set(ship.cells.map((c) => c.row));
  const cols = new Set(ship.cells.map((c) => c.col));
  const sameRow = rows.size === 1; // horizontal
  const sameCol = cols.size === 1; // vertical
  if (!sameRow && !sameCol) return false;

  const axis = sameRow ? ship.cells.map((c) => c.col) : ship.cells.map((c) => c.row);
  const sorted = [...axis].sort((a, b) => a - b);
  // Contiguous run: each step is +1, and length matches.
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return sorted.length === ship.length;
}

describe('placeFleetRandomly', () => {
  it('Random placement: 1000 fleets have zero overlaps, out-of-bounds, and row-wrapping', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const rng = createRng(seed);
      const board = placeFleetRandomly(createEmptyBoard(), rng);

      // Correct fleet composition.
      expect(board.ships.length).toBe(FLEET.length);
      expect(board.ships.map((s) => s.length).sort((a, b) => a - b)).toEqual(
        [2, 3, 3, 4, 5],
      );
      expect(board.ships.map((s) => s.name)).toEqual([
        'Majors',
        'Strategic Enterprise',
        'Enterprise',
        'Growth',
        'Startup',
      ]);

      const keys = occupiedKeys(board.ships);

      // Zero overlaps: total occupied cells == sum of ship lengths.
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);

      for (const ship of board.ships) {
        // Zero out-of-bounds.
        for (const cell of ship.cells) {
          expect(cell.row).toBeGreaterThanOrEqual(0);
          expect(cell.row).toBeLessThan(BOARD_SIZE);
          expect(cell.col).toBeGreaterThanOrEqual(0);
          expect(cell.col).toBeLessThan(BOARD_SIZE);
        }
        // Zero row-wrapping: cells are straight and contiguous.
        expect(isStraightNoWrap(ship)).toBe(true);
      }
    }
  });

  it('is deterministic for a given seed', () => {
    const a = placeFleetRandomly(createEmptyBoard(), createRng(42));
    const b = placeFleetRandomly(createEmptyBoard(), createRng(42));
    expect(a.ships).toEqual(b.ships);
  });
});
