/**
 * Architecture guard for the App Lab bundle size.
 *
 * The ui-components top-level barrel (ui-packages/ui-components/lib/index.ts)
 * re-exports cloud-editor-only components such as DeviceAssociationDialog,
 * which statically imports every board photo in
 * ui-packages/images/assets/devices. A single static import of that barrel
 * from code that ends up in the App Lab bundle drags all of those PNGs in
 * (regression introduced in PR #1391, where two files inside ui-components
 * imported useI18n from their own package barrel).
 *
 * These tests scan the source tree and fail on any import of the barrel from
 * places where it must never appear. Deep imports such as
 * '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab' stay
 * allowed. The same constraint is mirrored as an ESLint
 * no-restricted-imports override in the root .eslintrc.js for editor-time
 * feedback; this test is the CI-enforced gate.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

const BARREL_IMPORT_RE =
  /['"]@cloud-editor-mono\/ui-components(\/lib(\/index)?)?['"]/;

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

function findBarrelImports(dir: string): string[] {
  return listSourceFiles(dir).flatMap((file) => {
    const lines = readFileSync(file, 'utf-8').split('\n');
    return lines
      .map((line, index) =>
        BARREL_IMPORT_RE.test(line)
          ? `${relative(REPO_ROOT, file)}:${index + 1} ${line.trim()}`
          : null,
      )
      .filter((match): match is string => match !== null);
  });
}

describe('ui-components barrel imports', () => {
  it('ui-components never imports its own package barrel', () => {
    const offenders = findBarrelImports(
      join(REPO_ROOT, 'ui-packages', 'ui-components', 'lib'),
    );
    expect(
      offenders,
      'Files inside ui-packages/ui-components must import their own modules ' +
        'relatively (e.g. ../i18n/useI18n), never via the ' +
        '@cloud-editor-mono/ui-components barrel: importing the barrel pulls ' +
        'every export (device images included) into any app that bundles a ' +
        'single component.',
    ).toEqual([]);
  });

  it('App Lab code never imports the ui-components top-level barrel', () => {
    const offenders = findBarrelImports(
      join(REPO_ROOT, 'app', 'core-ui', 'src', 'app-lab'),
    );
    expect(
      offenders,
      'App Lab code must use deep imports such as ' +
        "'@cloud-editor-mono/ui-components/lib/components-by-app/app-lab': " +
        'the top-level barrel re-exports cloud-editor-only components and ' +
        'their board images, bloating the App Lab bundle.',
    ).toEqual([]);
  });
});
