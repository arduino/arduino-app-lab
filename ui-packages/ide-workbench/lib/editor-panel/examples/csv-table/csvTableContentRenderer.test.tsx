/**
 * EXAMPLE EXTENSION TEST — the testing template for a content renderer.
 *
 * A renderer is `match` + a pure `render(ctx)`, so most of it can be
 * tested directly against a context literal — no mocks needed. For an
 * integration test through the real EditorPanel (renderer precedence,
 * split panes, extras), copy the pattern in
 * components-by-app/app-lab/editor-panel/appLabContentRenderers.test.tsx.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  PaneContentContext,
  resolvePaneContent,
} from '../../paneContentRenderer';
import { csvTableContentRenderer } from './csvTableContentRenderer';

const makeCtx = (
  overrides: Partial<PaneContentContext> = {},
): PaneContentContext => ({
  file: {
    id: 'data-csv',
    ext: 'csv',
    getData: () => 'name,value\ntemp,21\nhum,40',
  },
  paneId: 'A',
  ...overrides,
});

describe('csvTableContentRenderer (example extension)', () => {
  it('matches only csv files', () => {
    expect(csvTableContentRenderer.match(makeCtx())).toBe(true);
    expect(
      csvTableContentRenderer.match(
        makeCtx({ file: { id: 'a', ext: 'ino', getData: () => '' } }),
      ),
    ).toBe(false);
  });

  it('renders the parsed rows as a table', () => {
    render(csvTableContentRenderer.render(makeCtx()));

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'name' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'temp' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '40' })).toBeInTheDocument();
  });

  it('shows the read-only note when the pane is read-only', () => {
    render(csvTableContentRenderer.render(makeCtx({ readOnly: true })));

    expect(screen.getByText('Read-only')).toBeInTheDocument();
  });

  it('wins the pane when placed before the defaults, like EditorPanel does', () => {
    const content = resolvePaneContent([csvTableContentRenderer], makeCtx());

    expect(content).not.toBeNull();
  });
});
