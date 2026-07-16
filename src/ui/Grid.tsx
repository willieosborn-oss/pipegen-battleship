/**
 * A single 10x10 board rendered as a grid of cells.
 *
 * Cell appearance is entirely visual (color/marker via CSS classes); no event
 * text is rendered inside cells. Cells are only clickable on the interactive
 * (enemy) board, when firing is currently allowed and the cell is un-fired.
 */

import { useMemo } from 'react';
import type { Board, Coord } from '../engine';
import { cellVisual, shipCells, sunkCells } from './boardView';

interface GridProps {
  readonly title: string;
  readonly board: Board;
  /** Reveal un-hit ship cells (true for the player's own board). */
  readonly showShips: boolean;
  /** Whether the player may currently fire on this board. */
  readonly canFire: boolean;
  readonly onFire?: (coord: Coord) => void;
}

/** Column headers A.. and row headers 1.. for orientation. */
const COL_LABELS = 'ABCDEFGHIJ'.split('');

export function Grid({ title, board, showShips, canFire, onFire }: GridProps) {
  const sunk = useMemo(() => sunkCells(board), [board]);
  const ships = useMemo(() => shipCells(board), [board]);

  return (
    <section className="grid-panel">
      <h2 className="grid-title">{title}</h2>
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${board.size}, 1fr)` }}
        role="grid"
        aria-label={title}
      >
        {board.grid.map((rowArr, row) =>
          rowArr.map((_, col) => {
            const visual = cellVisual(board, row, col, showShips, sunk, ships);
            const fired = board.grid[row][col] !== 'unknown';
            const clickable = canFire && !fired;
            const label = `${COL_LABELS[col]}${row + 1}`;
            return (
              <button
                key={`${row}-${col}`}
                type="button"
                className={`cell cell-${visual}${clickable ? ' cell-clickable' : ''}`}
                role="gridcell"
                aria-label={label}
                disabled={!clickable}
                onClick={clickable ? () => onFire?.({ row, col }) : undefined}
              />
            );
          }),
        )}
      </div>
    </section>
  );
}
