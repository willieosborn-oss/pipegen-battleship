/**
 * Hunt/target AI for PipeGen Battleship.
 *
 * `chooseAiShot` is a PURE, FULLY STATELESS function: it derives everything it
 * needs from the `GameState` on every call. There is no module-level mutable
 * state, nothing is added to `GameState`, and nothing is remembered between
 * calls. Two calls with equivalent public information (see fairness note) and
 * the same RNG always return the same coordinate.
 *
 * Fairness. The AI fires on `state.playerBoard`. It only ever consults:
 *   - its own shot history (the board grid: 'hit' / 'miss' / 'unknown'), and
 *   - the cells of player ships that are ALREADY SUNK (public once sunk).
 * It NEVER reads the cell positions of un-sunk player ships. This is enforced
 * structurally: the only place ship cells are read is {@link sunkShipCells},
 * which collects cells exclusively from ships that are fully sunk. "Active hits"
 * are then derived as the 'hit' grid cells that do NOT belong to a sunk ship,
 * so unexplained hits from a still-floating ship keep the AI in target mode
 * with no special-case bookkeeping.
 */

import { type Board, type Coord, type GameState, type Ship } from './types';
import { type Rng, randInt } from './rng';

/** Default RNG for live play: matches the previous temporary AI's randomness. */
const defaultRng: Rng = Math.random;

/** Stable "row,col" key for set membership. */
function key(coord: Coord): string {
  return `${coord.row},${coord.col}`;
}

/** Whether a ship is fully sunk (every cell hit). */
function isSunk(ship: Ship): boolean {
  return ship.hits.every((h) => h);
}

/**
 * Cells belonging to ships that are already sunk. This is the ONLY function
 * that reads ship cell positions, and it reads them exclusively from sunk
 * ships, which are public information. Un-sunk ships are skipped before their
 * cells are ever touched.
 */
function sunkShipCells(board: Board): Set<string> {
  const cells = new Set<string>();
  for (const ship of board.ships) {
    if (!isSunk(ship)) continue;
    for (const cell of ship.cells) {
      cells.add(key(cell));
    }
  }
  return cells;
}

/** Whether a coordinate is on the board. */
function onBoard(board: Board, coord: Coord): boolean {
  return (
    coord.row >= 0 &&
    coord.row < board.size &&
    coord.col >= 0 &&
    coord.col < board.size
  );
}

/** Whether a cell has not yet been fired upon. */
function isUnfired(board: Board, coord: Coord): boolean {
  return onBoard(board, coord) && board.grid[coord.row][coord.col] === 'unknown';
}

/** Every cell not yet fired upon, in row-major order. */
function unfiredCells(board: Board): Coord[] {
  const cells: Coord[] = [];
  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      if (board.grid[row][col] === 'unknown') cells.push({ row, col });
    }
  }
  return cells;
}

/**
 * Active hits: cells the AI has hit that belong to a ship NOT yet sunk. Derived
 * fresh every call as ('hit' grid cells) minus (cells of sunk ships).
 */
function activeHits(board: Board): Coord[] {
  const sunk = sunkShipCells(board);
  const hits: Coord[] = [];
  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      if (board.grid[row][col] === 'hit' && !sunk.has(key({ row, col }))) {
        hits.push({ row, col });
      }
    }
  }
  return hits;
}

/** Deterministically pick one candidate using the RNG. */
function pick(candidates: readonly Coord[], rng: Rng): Coord {
  return candidates[randInt(rng, candidates.length)];
}

/** The four orthogonal neighbours of a cell, in a fixed order. */
function orthogonalNeighbours(coord: Coord): Coord[] {
  return [
    { row: coord.row - 1, col: coord.col },
    { row: coord.row + 1, col: coord.col },
    { row: coord.row, col: coord.col - 1 },
    { row: coord.row, col: coord.col + 1 },
  ];
}

/** Append `coord` to `out` if it is on-board, un-fired, and not already present. */
function pushCandidate(
  out: Coord[],
  seen: Set<string>,
  board: Board,
  coord: Coord,
): void {
  const k = key(coord);
  if (isUnfired(board, coord) && !seen.has(k)) {
    seen.add(k);
    out.push(coord);
  }
}

/**
 * For contiguous runs of two or more collinear active hits, the un-fired cells
 * just beyond each end of the run — i.e. extending the discovered line in both
 * directions. Horizontal runs first, then vertical, each in row-major order.
 */
function lineExtensionCandidates(board: Board, hits: readonly Coord[]): Coord[] {
  const hitSet = new Set(hits.map(key));
  const out: Coord[] = [];
  const seen = new Set<string>();

  // Horizontal runs: start where the cell to the left is not itself an active hit.
  for (const hit of hits) {
    const isRunStart = !hitSet.has(key({ row: hit.row, col: hit.col - 1 }));
    if (!isRunStart) continue;
    let endCol = hit.col;
    while (hitSet.has(key({ row: hit.row, col: endCol + 1 }))) endCol++;
    if (endCol > hit.col) {
      pushCandidate(out, seen, board, { row: hit.row, col: hit.col - 1 });
      pushCandidate(out, seen, board, { row: hit.row, col: endCol + 1 });
    }
  }

  // Vertical runs: start where the cell above is not itself an active hit.
  for (const hit of hits) {
    const isRunStart = !hitSet.has(key({ row: hit.row - 1, col: hit.col }));
    if (!isRunStart) continue;
    let endRow = hit.row;
    while (hitSet.has(key({ row: endRow + 1, col: hit.col }))) endRow++;
    if (endRow > hit.row) {
      pushCandidate(out, seen, board, { row: hit.row - 1, col: hit.col });
      pushCandidate(out, seen, board, { row: endRow + 1, col: hit.col });
    }
  }

  return out;
}

/** Un-fired orthogonal neighbours of any active hit, in row-major order. */
function neighbourCandidates(board: Board, hits: readonly Coord[]): Coord[] {
  const out: Coord[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    for (const n of orthogonalNeighbours(hit)) {
      pushCandidate(out, seen, board, n);
    }
  }
  // Row-major order keeps selection deterministic regardless of hit order.
  return out.sort((a, b) => a.row - b.row || a.col - b.col);
}

/** Un-fired cells on checkerboard parity ((row + col) even), row-major. */
function huntParityCandidates(board: Board): Coord[] {
  return unfiredCells(board).filter((c) => (c.row + c.col) % 2 === 0);
}

/**
 * Choose the AI's next shot on the player's board.
 *
 * HUNT mode (no active hits): fire at a random un-fired cell on checkerboard
 * parity, since the smallest ship is length 2; if parity is exhausted, fall
 * back to any un-fired cell.
 *
 * TARGET mode (active hits present): fire at an un-fired orthogonal neighbour of
 * an active hit. When active hits form a collinear run, prefer extending that
 * line in both directions before trying perpendicular neighbours.
 *
 * @param rng RNG in [0, 1); defaults to `Math.random` so the UI call site stays
 *   `chooseAiShot(state)`. Pass a seeded RNG for deterministic behaviour.
 * @throws if no un-fired cells remain (never happens in a live game, which ends
 *   once a fleet is sunk).
 */
export function chooseAiShot(state: GameState, rng: Rng = defaultRng): Coord {
  const board = state.playerBoard;
  const hits = activeHits(board);

  if (hits.length > 0) {
    const lines = lineExtensionCandidates(board, hits);
    if (lines.length > 0) return pick(lines, rng);
    const neighbours = neighbourCandidates(board, hits);
    if (neighbours.length > 0) return pick(neighbours, rng);
    // No live neighbours (all surrounded by fired cells): fall through to hunt.
  }

  const parity = huntParityCandidates(board);
  if (parity.length > 0) return pick(parity, rng);

  const remaining = unfiredCells(board);
  if (remaining.length === 0) {
    throw new Error('chooseAiShot: no un-fired cells remain');
  }
  return pick(remaining, rng);
}
