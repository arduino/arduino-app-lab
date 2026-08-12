/**
 * Architecture guard for the App Lab router import cycle (WEDO-7659).
 *
 * openAppFileInEditor.ts imports the router, so everything it reaches sits
 * below the router; openAppFile.ts holds the pending-file / peeked-app state and
 * is read from inside the route tree. Merging the two, or importing the router
 * from the state, closes
 * router -> routeTree -> routes -> appDetail.logic -> openAppFile -> router,
 * which boots only until one of the shared `const` exports is read at module
 * scope and throws "Cannot access '...' before initialization".
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

// Any specifier ending in openAppFileInEditor ('./openAppFileInEditor',
// '../../src/app-lab/openAppFileInEditor'), never a plain './openAppFile'.
const ROUTER_BOUND_IMPORT_RE = /['"][^'"]*openAppFileInEditor['"]/;

// A `from` clause, a bare side-effect import or a dynamic import()/require(),
// skipping comment lines: openAppFile's own header talks about imports in prose.
const ANY_IMPORT_RE =
  /^(?!\s*(\/\/|\*|\/\*))(?=.*(\bfrom\s*['"]|^\s*import\s*['"]|\bimport\s*\(|\brequire\s*\())/;

const SOURCE_FILE_RE = /\.(ts|tsx)$/;
const SKIPPED_DIRS = new Set(['node_modules', 'dist']);

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return SKIPPED_DIRS.has(entry.name) ? [] : listSourceFiles(fullPath);
    }
    return SOURCE_FILE_RE.test(entry.name) ? [fullPath] : [];
  });
}

function findRouterBoundImports(dir: string): string[] {
  return listSourceFiles(dir).flatMap((file) => {
    const lines = readFileSync(file, 'utf-8').split('\n');
    return lines
      .map((line, index) =>
        ROUTER_BOUND_IMPORT_RE.test(line)
          ? `${relative(REPO_ROOT, file)}:${index + 1} ${line.trim()}`
          : null,
      )
      .filter((match): match is string => match !== null);
  });
}

describe('App Lab import cycles', () => {
  it('App Lab code never imports the router-bound openAppFileInEditor', () => {
    const offenders = findRouterBoundImports(
      join(REPO_ROOT, 'app', 'core-ui', 'src', 'app-lab'),
    );
    expect(
      offenders,
      'openAppFileInEditor imports the router, so importing it from inside ' +
        'src/app-lab closes the cycle described at the top of this file. Read ' +
        'the pending-file / peeked-app state from ./openAppFile instead, and ' +
        'reach openAppFileInEditor only from ' +
        'lib/app-components/app-lab/AppLab.tsx.',
    ).toEqual([]);
  });

  // The test above only covers the call sites: openAppFile can also reopen the
  // cycle on its own, with every importer left untouched.
  it('openAppFile stays import-free', () => {
    const stash = join(
      REPO_ROOT,
      'app',
      'core-ui',
      'src',
      'app-lab',
      'openAppFile.ts',
    );
    const imports = readFileSync(stash, 'utf-8')
      .split('\n')
      .map((line, index) =>
        ANY_IMPORT_RE.test(line) ? `${index + 1} ${line.trim()}` : null,
      )
      .filter((match): match is string => match !== null);
    expect(
      imports,
      'openAppFile must import nothing: it is read from inside the route tree, ' +
        "so whatever it imports joins the router's own graph and an import of " +
        './router reopens the cycle. Put anything that needs a dependency in ' +
        './openAppFileInEditor, which sits outside the route tree.',
    ).toEqual([]);
  });
});
