/**
 * Regression guards for two user-reported tooling findings from manual play:
 *
 *  1. "Node 20.18 silent-bindings issue" — Vite 8 / Rolldown ship a native
 *     addon that only loads on Node ^20.19.0 || >=22.12.0. On an unsupported
 *     Node (e.g. 20.18.x) the addon fails with a cryptic
 *     `Cannot find module '../rolldown-binding.*.node'` instead of a clear
 *     "unsupported Node" error. The project pins the version via `.nvmrc` and
 *     `package.json#engines`; these tests fail loudly if the test run is on an
 *     unsupported Node, and if that pin is ever weakened.
 *
 *  2. "vitest watch-mode hang" — bare `vitest` enters watch mode and never
 *     exits, so a scripted/CI run hangs forever. The fix is to invoke
 *     `vitest run`. This test guards the `test` script against regressing back
 *     to a bare, watch-mode invocation.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface PackageJson {
  engines?: { node?: string };
  scripts?: Record<string, string>;
}

const pkg: PackageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../package.json', import.meta.url)), 'utf8'),
);

/** Parse "a.b.c" (ignoring any pre-release/build suffix) into a numeric tuple. */
function parseVersion(v: string): [number, number, number] {
  const core = v.trim().replace(/^v/, '').split(/[-+]/)[0];
  const [major = 0, minor = 0, patch = 0] = core.split('.').map(Number);
  return [major, minor, patch];
}

/** a >= b for semver tuples. */
function gte(a: [number, number, number], b: [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

/**
 * Whether `version` satisfies one clause of an engines range. Supports the two
 * comparators used by this project's range: `^x.y.z` and `>=x.y.z`.
 */
function satisfiesClause(version: [number, number, number], clause: string): boolean {
  const c = clause.trim();
  if (c.startsWith('^')) {
    const base = parseVersion(c.slice(1));
    // Caret: same major, and >= base.
    return version[0] === base[0] && gte(version, base);
  }
  if (c.startsWith('>=')) {
    return gte(version, parseVersion(c.slice(2)));
  }
  throw new Error(`unsupported engines comparator: "${clause}"`);
}

/** Whether `version` satisfies a `clause || clause || ...` range. */
function satisfiesRange(version: [number, number, number], range: string): boolean {
  return range.split('||').some((clause) => satisfiesClause(version, clause));
}

describe('tooling regression guards', () => {
  it('pins a Node engines range that excludes the pre-20.19 native-binding failure', () => {
    const range = pkg.engines?.node;
    expect(range, 'package.json#engines.node must stay pinned').toBeTruthy();
    // 20.18.1 is the version that triggered the silent Rolldown binding failure.
    expect(satisfiesRange([20, 18, 1], range!)).toBe(false);
    // The supported minimums must remain in range.
    expect(satisfiesRange([20, 19, 0], range!)).toBe(true);
    expect(satisfiesRange([22, 12, 0], range!)).toBe(true);
  });

  it('runs on a Node version that satisfies the engines range', () => {
    const range = pkg.engines!.node!;
    const current = parseVersion(process.versions.node);
    expect(
      satisfiesRange(current, range),
      `Node ${process.versions.node} does not satisfy engines "${range}"; ` +
        'Vite/Rolldown native bindings will fail to load.',
    ).toBe(true);
  });

  it('runs the test suite in non-watch mode so it always terminates', () => {
    const testScript = pkg.scripts?.test ?? '';
    // A bare `vitest` invocation enters watch mode and hangs; require `run`.
    expect(/\bvitest\b/.test(testScript)).toBe(true);
    expect(/\bvitest\s+run\b/.test(testScript)).toBe(true);
  });
});
