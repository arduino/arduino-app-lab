import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useAppFiles } from './useAppFiles';

const h = vi.hoisted(() => ({
  // The root holds app.yaml only; the board cannot answer for python/main.py.
  listAppDirectory: vi.fn(async () => [
    {
      name: 'app.yaml',
      path: 'app.yaml',
      type: 'file',
      extension: 'yaml',
      mimeType: 'text/yaml',
    },
  ]),
  statAppPath: vi.fn(async (path: string) => {
    if (path.endsWith('python/main.py')) throw new Error('board busy');
    return null;
  }),
}));

vi.mock(
  '@cloud-editor-mono/domain/src/services/services-by-app/app-lab',
  () => ({
    listAppDirectory: h.listAppDirectory,
    statAppPath: h.statAppPath,
  }),
);

vi.mock('./useFileContents', () => ({
  useFileContents: (): Record<string, unknown> => ({
    fetchFile: vi.fn(),
    refreshFileContents: vi.fn(),
  }),
}));

describe('useAppFiles default file', () => {
  // The tabs restore only once the default file is known, so a stat that fails must not leave it unknown.
  it('passes over a candidate whose stat fails', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(
      () => useAppFiles({ appId: 'app-1', appPath: '/apps/foo' }),
      {
        wrapper: ({ children }: { children: ReactNode }) =>
          createElement(QueryClientProvider, { client }, children),
      },
    );

    await waitFor(() =>
      expect(result.current.defaultFilePath).toBe('app.yaml'),
    );
    expect(h.statAppPath).toHaveBeenCalledWith('/apps/foo/python/main.py');
  });
});
