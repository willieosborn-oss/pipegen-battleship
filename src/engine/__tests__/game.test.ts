import { describe, it, expect } from 'vitest';
import { createGame, fireShot } from '../game';
import {
  type Coord,
  type GameState,
  type Player,
  type Ship,
} from '../types';

/** Return the coordinates of a named ship on the opponent's board. */
function shipCells(state: GameState, shooter: Player, name: string): Coord[] {
  const board = shooter === 'player' ? state.aiBoard : state.playerBoard;
  const ship = board.ships.find((s) => s.name === name);
  if (!ship) throw new Error(`ship ${name} not found`);
  return ship.cells.map((c) => ({ ...c }));
}

/** All opponent ship cells in a flat firing order for the given shooter. */
function allTargetCells(state: GameState, shooter: Player): Coord[] {
  const board = shooter === 'player' ? state.aiBoard : state.playerBoard;
  return board.ships.flatMap((s) => s.cells.map((c) => ({ ...c })));
}

/**
 * Find a board cell that is NOT occupied by a ship AND has not yet been fired
 * upon (grid still 'unknown'), so it is a guaranteed, non-repeating miss.
 */
function findMissCell(state: GameState, shooter: Player): Coord {
  const board = shooter === 'player' ? state.aiBoard : state.playerBoard;
  const occupied = new Set(
    board.ships.flatMap((s) => s.cells.map((c) => `${c.row},${c.col}`)),
  );
  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      if (!occupied.has(`${row},${col}`) && board.grid[row][col] === 'unknown') {
        return { row, col };
      }
    }
  }
  throw new Error('no empty cell');
}

describe('fireShot', () => {
  it('firing on an already-fired cell returns invalid and leaves state unchanged', () => {
    const state = createGame(1);
    const target = allTargetCells(state, 'player')[0];

    const first = fireShot(state, 'player', target);
    expect(first.result).not.toBe('invalid');

    // Fire the SAME cell again (turn is now ai; but the already-fired guard is
    // checked after turn — so fire as the correct player after a round trip).
    // Player fired, so it's ai's turn. Give ai a valid shot to return to player.
    const aiMiss = findMissCell(first.newState, 'ai');
    const afterAi = fireShot(first.newState, 'ai', aiMiss);
    expect(afterAi.result).not.toBe('invalid');
    expect(afterAi.newState.turn).toBe('player');

    // Now player fires the already-fired cell again.
    const repeat = fireShot(afterAi.newState, 'player', target);
    expect(repeat.result).toBe('invalid');
    expect(repeat.newState).toBe(afterAi.newState); // state unchanged (same ref)
    expect(repeat.winner).toBeNull();
  });

  it('a ship reports sunk exactly on its final cell hit, not before, with the correct name', () => {
    let state = createGame(7);
    const name = 'Startup'; // length 2, quickest to sink
    const cells = shipCells(state, 'player', name);

    // Hit all but the last cell: each is a plain 'hit', never 'sunk'.
    for (let i = 0; i < cells.length - 1; i++) {
      // Ensure it's player's turn by bouncing ai in between.
      if (state.turn !== 'player') {
        const aiMiss = findMissCell(state, 'ai');
        state = fireShot(state, 'ai', aiMiss).newState;
      }
      const res = fireShot(state, 'player', cells[i]);
      expect(res.result).toBe('hit');
      expect(res.shipName).toBe(name);
      state = res.newState;
    }

    // Final cell -> sunk with correct name.
    if (state.turn !== 'player') {
      const aiMiss = findMissCell(state, 'ai');
      state = fireShot(state, 'ai', aiMiss).newState;
    }
    const last = fireShot(state, 'player', cells[cells.length - 1]);
    expect(last.result).toBe('sunk');
    expect(last.shipName).toBe(name);
  });

  it('win is detected on the shot that sinks the fifth ship, not a turn later', () => {
    let state = createGame(123);
    const targets = allTargetCells(state, 'player'); // all 17 ai ship cells

    let sunkCount = 0;
    let winShotResult: ReturnType<typeof fireShot> | null = null;

    for (let i = 0; i < targets.length; i++) {
      // Keep it player's turn throughout by bouncing ai with guaranteed misses.
      if (state.turn !== 'player') {
        const aiMiss = findMissCell(state, 'ai');
        state = fireShot(state, 'ai', aiMiss).newState;
      }
      const res = fireShot(state, 'player', targets[i]);
      expect(res.result).not.toBe('invalid');
      state = res.newState;
      if (res.result === 'sunk') sunkCount++;

      const isLastCell = i === targets.length - 1;
      if (isLastCell) {
        winShotResult = res;
      } else {
        // Before the final cell, no winner is ever declared.
        expect(res.winner).toBeNull();
      }
    }

    expect(sunkCount).toBe(5);
    expect(winShotResult).not.toBeNull();
    expect(winShotResult!.result).toBe('sunk');
    expect(winShotResult!.winner).toBe('player');
    expect(state.winner).toBe('player');
  });

  it('turn alternation: a valid shot switches the turn; an invalid shot does not', () => {
    const state = createGame(55);
    expect(state.turn).toBe('player');

    // Valid shot switches turn.
    const missCell = findMissCell(state, 'player');
    const valid = fireShot(state, 'player', missCell);
    expect(valid.result).toBe('miss');
    expect(valid.newState.turn).toBe('ai');

    // Wrong-turn shot is invalid and does not switch the turn.
    const wrongTurn = fireShot(state, 'ai', findMissCell(state, 'ai'));
    expect(wrongTurn.result).toBe('invalid');
    expect(wrongTurn.newState.turn).toBe('player'); // unchanged
    expect(wrongTurn.newState).toBe(state);

    // Already-fired cell (as the correct player) is invalid, turn unchanged.
    const repeat = fireShot(valid.newState, 'ai', findMissCell(valid.newState, 'ai'));
    // (bounce back to player, then re-fire the same cell)
    const replay = fireShot(repeat.newState, 'player', missCell);
    expect(replay.result).toBe('invalid');
    expect(replay.newState.turn).toBe('player'); // still player's turn
  });

  it('immutability: after a hit the previous state is unchanged and newState !== state', () => {
    const state = createGame(9);
    const cell = allTargetCells(state, 'player')[0];

    // Snapshot the targeted ship's hit count before firing.
    const findShip = (s: GameState): Ship => {
      const ship = s.aiBoard.ships.find((sh) =>
        sh.cells.some((c) => c.row === cell.row && c.col === cell.col),
      );
      if (!ship) throw new Error('ship not found');
      return ship;
    };
    const before = findShip(state);
    const beforeHitCount = before.hits.filter(Boolean).length;

    const res = fireShot(state, 'player', cell);
    expect(res.result).toBe('hit');

    // newState is a different object.
    expect(res.newState).not.toBe(state);

    // Prior state is completely unchanged.
    const afterOnOldState = findShip(state);
    expect(afterOnOldState).toBe(before); // same ship reference
    expect(afterOnOldState.hits.filter(Boolean).length).toBe(beforeHitCount);
    expect(state.aiBoard.grid[cell.row][cell.col]).toBe('unknown');

    // New state reflects the hit.
    const newShip = findShip(res.newState);
    expect(newShip.hits.filter(Boolean).length).toBe(beforeHitCount + 1);
    expect(res.newState.aiBoard.grid[cell.row][cell.col]).toBe('hit');

    // Nested references were replaced, not mutated.
    expect(res.newState.aiBoard).not.toBe(state.aiBoard);
    expect(newShip).not.toBe(before);
  });

  it('post-game shots are invalid with state unchanged', () => {
    let state = createGame(321);
    const targets = allTargetCells(state, 'player');
    for (const t of targets) {
      if (state.turn !== 'player') {
        state = fireShot(state, 'ai', findMissCell(state, 'ai')).newState;
      }
      state = fireShot(state, 'player', t).newState;
    }
    expect(state.winner).toBe('player');

    // Any further shot is invalid and does not change state.
    const post = fireShot(state, 'ai', findMissCell(state, 'ai'));
    expect(post.result).toBe('invalid');
    expect(post.newState).toBe(state);
    expect(post.winner).toBe('player');
  });
});
