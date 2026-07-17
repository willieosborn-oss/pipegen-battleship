# PipeGen Battleship

**Play it:** https://pipegen-battleship.vercel.app

A sales-themed Battleship game — hunt down the competitor's fleet before your
own book of business dries up.

## Build story

PipeGen Battleship was built with [Devin](https://devin.ai) across a series of
staged sessions, each starting from a reviewed plan: a pure, tests-first
TypeScript engine came first, then a playable React UI, then a stateless
hunt/target AI that replaced an early random-shot placeholder, and finally a
dedicated adversarial bug-hunt and hardening pass. The engine's Vitest suite was
written before the engine itself, so correctness was pinned from the start;
later sessions layered UI and AI on top without loosening those guarantees.

I used Claude to help me map out the plan and walk through the steps.

## Architecture

The `src/engine/` module is a pure, fully immutable core — seeded RNG, random
fleet placement, `fireShot` state transitions, and a stateless `chooseAiShot`
AI that derives everything from the current `GameState` on each call. The React
UI in `src/App.tsx` orchestrates the game loop (player fire → 600ms delay → AI
fire), while `src/ui/` renders boards, the fleet tracker, and status copy from
that state. There is no backend: all state lives client-side and the app deploys
as a static bundle to Vercel.

## Run locally

Requires Node `^20.19.0 || >=22.12.0` (see `.nvmrc`; `.npmrc` enforces it).

```bash
nvm use            # Node 22.12.0
npm install
npm run dev        # dev server at http://localhost:5173
npm test           # Vitest suite
npm run lint       # Oxlint
npm run build      # type-check + production build
```

## Devin sessions

Each session started with a plan I reviewed and approved (or corrected) before any code ran. In order:

- [Session 1]: Core engine. Pure TypeScript game logic, tests first: 8 passing tests covering placement validity across 1000 generated fleets, turn rules, sink and win detection, immutability, and determinism. No UI.
- [Session 2]: Playable UI. Two-grid layout, status bar, ship trackers, full reset. The temporary random AI was isolated behind a single chooseAiShot seam so the next session could replace it cleanly.
- [Session 3]: Hunt/target AI. Fully stateless: every decision is derived fresh from game state, which makes the adjacent-ships edge case work without special bookkeeping. Verified by a 500-game simulation (no repeat or off-board shots, mean ~51 shots to win) plus a structural fairness constraint: the AI can never read un-sunk ship positions.
- [Session 4]: Fleet rename. Copy-only pass, no logic changes.
- [Session 5]: Adversarial bug hunt, run from the committed playbook (bug-hunt.devin.md). Audited eight bug classes, proved six impossible with citing tests, fixed the two real findings (both toolchain bugs) with regression tests, and ran a 2000-game fuzz. Full write-up in BUGS.md.****

## QA playbook

[`bug-hunt.devin.md`](./bug-hunt.devin.md) is the reusable QA playbook used for
the adversarial bug-hunt pass; the results are written up in
[`BUGS.md`](./BUGS.md), with the raw working log in
[`BUGS_FOUND.md`](./BUGS_FOUND.md).
