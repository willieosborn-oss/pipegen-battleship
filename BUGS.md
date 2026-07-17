# BUGS — QA record for external review

## Approach

The game was built in staged sessions, each opened with a written plan reviewed
before any code, and the engine was written tests-first (the Vitest suite in
`src/engine/__tests__/` predates and constrains the engine's behaviour). After
the feature work, a dedicated adversarial pass was run against the committed
playbook (`bug-hunt.devin.md`), auditing eight bug classes and backing the game
logic with a 2000-game fuzz (both sides played to completion, asserting no
invalid/repeat/off-board shots, guaranteed termination, and `winner` set iff the
loser's fleet is fully sunk). A final manual playthrough exercised the live UI.
The honest outcome: the adversarial pass and fuzz found **no** new defects in
the engine or AI — the only live bugs were two tooling/runtime findings surfaced
by manual play, both now fixed with regression tests.

## Findings

| # | Bug | Found by | Fix | Regression test |
|---|-----|----------|-----|-----------------|
| 1 | Vite 8 / Rolldown native binding fails on Node < 20.19 with a cryptic `Cannot find module '../rolldown-binding.*.node'` — `engines` was advisory, so an unsupported Node failed *silently* at runtime | manual play | Added `.npmrc` `engine-strict=true` so `npm ci`/`npm install` fail immediately with `EBADENGINE` on an out-of-range Node (verified on Node 20.18.1) | `tooling regression guards > pins a Node engines range that excludes the pre-20.19 native-binding failure`; `> runs on a Node version that satisfies the engines range` |
| 2 | Bare `vitest` enters watch mode and never exits, hanging scripted/CI runs | manual play | `test` script uses `vitest run`; added a guard against regressing to a bare invocation | `tooling regression guards > runs the test suite in non-watch mode so it always terminates` |

`Found by` legend: `unit test`, `agent self-review`, `adversarial pass`, `manual
play`. No bugs were attributable to the unit-test / self-review / adversarial-pass
columns this cycle — the tests-first engine held up. The raw, unedited working
log (including the full bug-class audit narrative) is preserved in
`BUGS_FOUND.md`.

## Bug classes demonstrated impossible / guarded

Each playbook bug class was checked against the engine and UI. Where a class is
ruled out by a test, the test name is cited.

| Class | Status | Evidence |
|-------|--------|----------|
| Boundary errors (placement wrap, coordinate off-by-one) | impossible | `placeFleetRandomly > Random placement: 1000 fleets have zero overlaps, out-of-bounds, and row-wrapping`; `chooseAiShot: 500-game simulation > never fires at an already-fired or off-board cell …` (`offBoard === 0`) |
| Invalid-state acceptance (overlap, double-acting a cell) | impossible | `fireShot > firing on an already-fired cell returns invalid and leaves state unchanged`; 500-game sim (`invalid === 0`, `repeat === 0`); placement overlap assertion in the 1000-fleet test |
| Event misreporting (sunk/win early, late, wrong name) | impossible | `fireShot > a ship reports sunk exactly on its final cell hit, not before, with the correct name`; `fireShot > win is detected on the shot that sinks the fifth ship, not a turn later` |
| Turn/sequence desync | impossible | `fireShot > turn alternation: a valid shot switches the turn; an invalid shot does not`; `fireShot > post-game shots are invalid with state unchanged` |
| Immutability violations | impossible | `fireShot > immutability: after a hit the previous state is unchanged and newState !== state` |
| AI fairness (reading un-sunk placements) | impossible | `chooseAiShot: fairness > depends only on shot history and sunk ships, not un-sunk placements` |
| Reset leaks (New Game leaving stale state) | guarded (code review) | `App.handleNewGame` clears the pending AI timer and resets game/event/`aiPending`; `chooseAiShot` is stateless so there is no AI memory to leak |
| Async races (input during AI delay, reset mid-AI, rapid clicks) | guarded (code review + manual play) | `handlePlayerFire` early-returns while `aiPending`; enemy cells are `disabled` during the delay; `handleNewGame` `clearTimeout`s the pending shot; React 18 flushes discrete clicks synchronously |
| Derived-state disagreement (trackers/status vs. truth) | none | `ShipTracker`, `Grid`/`boardView`, and the status bar all derive from the same `GameState`; "sunk" is computed identically from each ship's `hits` |

## What I'd harden next

1. **Automated UI tests.** The reset, rapid-click, and reset-during-AI-delay
   guards are verified only by code review and manual play. I'd add React
   Testing Library coverage with fake timers to lock in "reset while an AI shot
   is pending never fires onto the new board" and "a second rapid click is a
   no-op" — the highest-risk untested surface.
2. **A CI test gate.** Vercel builds the preview, but the Vitest suite and lint
   don't run on PRs, so a regression could merge. I'd add a GitHub Actions
   workflow running `npm run lint` and `npm test` on Node 22.12.
3. **AI strength / determinism.** The mean-shots bound (`< 70`) is loose and
   `lineExtensionCandidates` ordering leans on the RNG. Not a bug, but a
   probability-density hunt and an explicit deterministic ordering would make
   both the AI and its tests stronger.
