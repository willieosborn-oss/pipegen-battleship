# Playbook: Adversarial Bug Hunt for a Stateful Web Game

## Overview

Run a dedicated bug-hunt and hardening pass on a stateful browser game or interactive web app. No new features. The output is fixed bugs with regression tests, plus an honest written record of every bug found across the project's history, including bugs the agent introduced itself in earlier sessions.

## Parameters (edit per project)

- Repo: https://github.com/willieosborn-oss/pipegen-battleship
- App type: turn-based browser game (Battleship variant), pure TS engine + React UI, no backend
- Known state seams: engine GameState (immutable), chooseAiShot(state) AI seam, React UI state
- User-reported findings from manual play: the vitest watch-mode hang, the Node 20.18 silent-bindings issue) plus the line "Manual playtest findings will arrive as a follow-up message mid-session; hold the PR open until then.

## Procedure

1. Read the full codebase, including tests, before changing anything.
2. Audit for each bug class below. For each: either demonstrate it is impossible (cite the specific code or test that rules it out) or fix it and add a regression test.
   - Boundary errors: entity placement wrapping across a row/grid edge; off-by-one in any coordinate handling
   - Invalid-state acceptance: overlapping placements; double-acting on the same cell/target consuming a turn, by either player
   - Event misreporting: completion/sunk reported early, late, or with the wrong entity name; win/end state detected a turn late or triggered early
   - Turn/sequence desync: one side acting twice consecutively; the AI acting during the other side's turn or during setup
   - Reset leaks: a "new game" action leaving stale state (previous shots/moves, AI memory, end-of-game banners)
   - Async races: user input landing during a delayed AI action; reset clicked while an AI action is pending; rapid repeated clicks on one control
   - Derived-state disagreement: any summary display (trackers, counters, status bars) disagreeing with the source-of-truth state
   - Immutability violations: any code path mutating state that the UI framework holds by reference
3. Reproduce, root-cause, and fix every user-reported finding from the Parameters section, each with a regression test.
4. Run the full test suite and confirm everything passes.
5. Write BUGS_FOUND.md at repo root covering every bug from this session AND every bug fixed in earlier sessions, one entry per bug: Symptom / How it was found / Root cause / Fix / Regression test name.
6. Open a PR containing only fixes, tests, and BUGS_FOUND.md.

## Advice

- Be honest in BUGS_FOUND.md. Include bugs you introduced yourself in earlier sessions. Do not sanitize; a short list of trivial bugs is a red flag, not an achievement.
- Tag each bug with how it was caught: in-session self-review, unit test, this adversarial pass, or the user's manual play.
- Prefer the smallest fix that makes the regression test pass. Refactors are out of scope.
- If a bug class is impossible by construction, say why in one sentence with a code or test citation; do not pad.

## Forbidden Actions

- Do not add features, change copy, or restyle anything.
- Do not modify test assertions to make failing tests pass; fix the code.
- Do not force-push or rewrite history.
- Do not touch deployment configuration.
