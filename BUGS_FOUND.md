# BUGS_FOUND.md

An honest record of every bug found and fixed across the life of this project,
plus the adversarial bug-class audit run this session. Each entry lists how it
was caught, tagged one of:

- `self-review` — caught during an earlier build session by review
- `unit-test` — caught by an automated test
- `adversarial-pass` — caught by this session's dedicated bug hunt
- `manual-play` — reported by the user from playing the app

The audit covered eight bug classes. Where a class is impossible by
construction, the specific code/test that rules it out is cited rather than
padding the list.

---

## Bugs fixed

### 1. Rolldown native binding fails silently on Node < 20.19 ("Node 20.18 silent-bindings")

- **Symptom:** `npm test` / `npm run dev` / `npm run build` crash with
  `Cannot find module '../rolldown-binding.linux-x64-gnu.node'`
  (`MODULE_NOT_FOUND`) with no hint that the real cause is the Node version.
- **How it was found:** `manual-play` (user), re-reproduced this session on
  Node 20.18.1.
- **Root cause:** Vite 8 uses Rolldown, whose prebuilt native addon only loads
  on Node `^20.19.0 || >=22.12.0`. On 20.18.x the optional binding is absent and
  the loader throws a cryptic module-not-found error. The project already pinned
  the version (`.nvmrc` = 22.12.0, `package.json#engines`), but `engines` is
  advisory — npm does not enforce it — so an out-of-range Node failed *silently*
  at runtime instead of loudly at install.
- **Fix:** Added `.npmrc` with `engine-strict=true`, so `npm install` / `npm ci`
  fail immediately with a clear `EBADENGINE … Required: {"node":"^20.19.0 || >=22.12.0"}`
  error on an unsupported Node. The pre-existing `.nvmrc`/`engines` pin (added in
  the engine session) is retained.
- **Regression test:** `tooling regression guards > pins a Node engines range
  that excludes the pre-20.19 native-binding failure` and `> runs on a Node
  version that satisfies the engines range` in
  `src/engine/__tests__/tooling.test.ts`. Verified manually: `npm ci` on Node
  20.18.1 now exits non-zero with `EBADENGINE`.

### 2. Bare `vitest` hangs in watch mode ("vitest watch-mode hang")

- **Symptom:** Running `vitest` (no subcommand) prints results then sits on
  `Waiting for file changes...` forever; a scripted/CI invocation never
  terminates.
- **How it was found:** `manual-play` (user), reproduced this session (`npx
  vitest` did not exit; `vitest run` exits 0).
- **Root cause:** Vitest defaults to watch mode when invoked without `run`.
- **Fix:** The `test` script already uses `vitest run` (correct, non-watch).
  Added a regression guard so it cannot silently regress to a bare, hanging
  invocation.
- **Regression test:** `tooling regression guards > runs the test suite in
  non-watch mode so it always terminates` in
  `src/engine/__tests__/tooling.test.ts`.

---

## Manual playtest

The user's follow-up manual playtest surfaced no additional bugs, so there are
no `manual-play` entries beyond the two tooling findings above.

## Bug-class audit (adversarial-pass)

Each class below was checked against the engine (`src/engine/`) and UI
(`src/App.tsx`, `src/ui/`). No live defects were found in the game logic; the
guarantees are cited. Beyond the existing suite, a 2000-game fuzz (both sides
playing to completion) confirmed no invalid/repeat/off-board shots, correct
termination, and that the winner is set iff the loser's fleet is fully sunk.

- **Boundary errors (placement wrap / coordinate off-by-one):** impossible.
  `placement.shipCells` + `fitsOnBoard` and the `maxRow`/`maxCol` bounds keep
  every ship on one row/column within `[0, size)`; `game.fireShot` rejects
  off-board coordinates. Covered by `placement.test.ts` (1000 fleets: no
  overlap/out-of-bounds/wrap) and the AI 500-game sim (`offBoard === 0`).

- **Invalid-state acceptance (overlap / double-acting a cell):** impossible.
  Placement rejects overlaps via the `occupied` set; `fireShot` returns
  `invalid` (turn NOT consumed) for any cell whose grid is not `unknown`.
  Covered by `game.test.ts` "already-fired cell … invalid and leaves state
  unchanged" and the AI sim (`invalid === 0`, `repeat === 0`).

- **Event misreporting (sunk/win early, late, or wrong name):** impossible.
  `fireShot` computes `sunk` from the freshly-hit ship and reports
  `shipName = newShip.name`; win is `sunk && allSunk(griddedBoard)`, evaluated on
  the sinking shot. The UI reads win/loss from `FireResult.winner`, never by
  scanning the board (`App.describeResult`). Covered by `game.test.ts`
  "reports sunk exactly on its final cell hit … correct name" and "win is
  detected on the shot that sinks the fifth ship, not a turn later".

- **Turn/sequence desync (a side acting twice; AI acting off-turn/at setup):**
  impossible. `fireShot` returns `invalid` when `state.turn !== shooter`; the UI
  only schedules the AI after a valid, non-winning player shot and blocks input
  while `aiPending`. Covered by `game.test.ts` "turn alternation" and the AI
  fairness/sim tests.

- **Reset leaks (New Game leaving stale state):** none. `handleNewGame` clears
  the pending AI timer, replaces the game with `createGame()`, and clears the
  event string and `aiPending`. The AI is fully stateless (`chooseAiShot`
  derives everything from `GameState`), so there is no AI memory to leak.

- **Async races (input during AI delay; reset mid-AI; rapid clicks):** guarded.
  `handlePlayerFire` early-returns while `aiPending`; the enemy grid's cells are
  `disabled` while `aiPending`/after firing; React 18 (`createRoot`) flushes
  discrete click events synchronously, so a second rapid click lands on an
  already-disabled button. `handleNewGame` calls `clearTimeout` on the pending
  AI shot, so a reset during the delay cannot fire onto the new board.

- **Derived-state disagreement (trackers/status vs. source of truth):** none.
  `ShipTracker`, `Grid` (`boardView.cellVisual`/`sunkCells`) and the status bar
  all derive from the same `GameState`; "sunk" is computed identically from each
  ship's `hits`. Nothing caches a divergent copy.

- **Immutability violations (mutating state held by reference):** impossible.
  `fireShot` builds new ship/board/state objects via `map`/spread and never
  mutates its input; placement builds fresh arrays. Covered by `game.test.ts`
  "immutability: after a hit the previous state is unchanged and newState !==
  state".
