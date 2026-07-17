import { describe, it, expect } from 'vitest';
import { chooseAiShot } from '../ai';
import { createGame, fireShot } from '../game';
import { createRng } from '../rng';
import {
  BOARD_SIZE,
  type Board,
  type Coord,
  type GameState,
  type Ship,
} from '../types';

/** Coordinate key for set membership in assertions. */
function key(c: Coord): string {
  return `${c.row},${c.col}`;
}

/** Whether a coordinate lies on a standard board. */
function onBoard(c: Coord): boolean {
  return c.row >= 0 && c.row < BOARD_SIZE && c.col >= 0 && c.col < BOARD_SIZE;
}

interface GameStats {
  shots: number;
  invalid: number;
  offBoard: number;
  repeat: number;
  terminated: boolean;
}

/**
 * Play one full game of the AI firing on a randomly-placed player board until
 * every player ship is sunk. Only the AI acts; the turn is forced back to 'ai'
 * after each shot so we exercise the AI in isolation. A seeded RNG makes the
 * whole game deterministic.
 */
function simulateGame(seed: number): GameStats {
  let state: GameState = { ...createGame(seed), turn: 'ai' };
  const rng = createRng(0x9e3779b9 ^ seed);
  const fired = new Set<string>();
  let shots = 0;
  let invalid = 0;
  let offBoard = 0;
  let repeat = 0;

  // 100 cells with no repeats bounds any real game well under this cap.
  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE + 1; i++) {
    if (state.winner !== null) break;
    const coord = chooseAiShot(state, rng);
    if (!onBoard(coord)) offBoard++;
    if (fired.has(key(coord))) repeat++;
    fired.add(key(coord));

    const res = fireShot(state, 'ai', coord);
    if (res.result === 'invalid') invalid++;
    shots++;
    state = { ...res.newState, turn: 'ai' };
  }

  return { shots, invalid, offBoard, repeat, terminated: state.winner === 'ai' };
}

/** Build a Board from an explicit fleet, with a grid derived from ship hits. */
function makeBoard(ships: Ship[], extraMisses: Coord[] = []): Board {
  const grid: ('unknown' | 'hit' | 'miss')[][] = Array.from(
    { length: BOARD_SIZE },
    () => Array.from({ length: BOARD_SIZE }, () => 'unknown' as const),
  );
  for (const ship of ships) {
    ship.cells.forEach((c, i) => {
      if (ship.hits[i]) grid[c.row][c.col] = 'hit';
    });
  }
  for (const m of extraMisses) grid[m.row][m.col] = 'miss';
  return { size: BOARD_SIZE, ships, grid };
}

/** A placed ship with an explicit hit mask. */
function ship(
  name: Ship['name'],
  cells: Coord[],
  hits: boolean[],
): Ship {
  return { name, length: cells.length, cells, hits };
}

/** A minimal opponent board for the AI (its contents are irrelevant here). */
function dummyAiBoard(): Board {
  return makeBoard([]);
}

const SIM_GAMES = 500;
const simResults: GameStats[] = Array.from({ length: SIM_GAMES }, (_, i) =>
  simulateGame(i),
);

describe('chooseAiShot: 500-game simulation', () => {
  it('never fires at an already-fired or off-board cell, and every game terminates', () => {
    for (const r of simResults) {
      expect(r.invalid).toBe(0);
      expect(r.offBoard).toBe(0);
      expect(r.repeat).toBe(0);
      expect(r.terminated).toBe(true);
    }
  });

  it('wins in a mean of under 70 shots across 500 games', () => {
    const total = simResults.reduce((sum, r) => sum + r.shots, 0);
    const mean = total / simResults.length;
    // Informative on failure; keep for tuning visibility.
    expect(mean).toBeLessThan(70);
  });
});

describe('chooseAiShot: adjacent ships', () => {
  it('keeps targeting a second ship\u2019s hits after the first ship sinks', () => {
    // Ship A (sunk) at (0,0),(0,1); ship B (one hit) adjacent at (0,2),(1,2),(2,2).
    const shipA = ship('Startup', [{ row: 0, col: 0 }, { row: 0, col: 1 }], [
      true,
      true,
    ]);
    const shipB = ship(
      'Enterprise',
      [{ row: 0, col: 2 }, { row: 1, col: 2 }, { row: 2, col: 2 }],
      [true, false, false],
    );
    const playerBoard = makeBoard([shipA, shipB]);
    const state: GameState = {
      playerBoard,
      aiBoard: dummyAiBoard(),
      turn: 'ai',
      winner: null,
    };

    // The only active hit is (0,2) (ship B). The AI must target its un-fired
    // orthogonal neighbours, never revert to a hunt shot elsewhere.
    const neighbours = new Set([
      key({ row: 0, col: 3 }),
      key({ row: 1, col: 2 }),
    ]);
    for (let seed = 0; seed < 50; seed++) {
      const shot = chooseAiShot(state, createRng(seed));
      expect(neighbours.has(key(shot))).toBe(true);
    }
  });
});

describe('chooseAiShot: fairness', () => {
  it('depends only on shot history and sunk ships, not un-sunk placements', () => {
    // Both states share an identical grid and an identical SUNK ship, but their
    // UN-SUNK ships are placed differently. A fair AI must ignore that.
    const sunk = ship('Startup', [{ row: 0, col: 0 }, { row: 0, col: 1 }], [
      true,
      true,
    ]);

    const unsunkHorizontal = ship(
      'Enterprise',
      [{ row: 5, col: 5 }, { row: 5, col: 6 }, { row: 5, col: 7 }],
      [true, false, false],
    );
    const unsunkVertical = ship(
      'Enterprise',
      [{ row: 5, col: 5 }, { row: 6, col: 5 }, { row: 7, col: 5 }],
      [true, false, false],
    );

    const stateA: GameState = {
      playerBoard: makeBoard([sunk, unsunkHorizontal]),
      aiBoard: dummyAiBoard(),
      turn: 'ai',
      winner: null,
    };
    const stateB: GameState = {
      playerBoard: makeBoard([sunk, unsunkVertical]),
      aiBoard: dummyAiBoard(),
      turn: 'ai',
      winner: null,
    };

    // Grids are byte-for-byte identical (only (0,0),(0,1),(5,5) are hits).
    expect(stateA.playerBoard.grid).toEqual(stateB.playerBoard.grid);

    for (let seed = 0; seed < 100; seed++) {
      const a = chooseAiShot(stateA, createRng(seed));
      const b = chooseAiShot(stateB, createRng(seed));
      expect(a).toEqual(b);
    }
  });
});
