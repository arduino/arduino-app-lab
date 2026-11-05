import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { createElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useFileContents } from './useFileContents';

const h = vi.hoisted(() => ({
  getAppFileContent: vi.fn((path: string) => Promise.resolve(`of ${path}`)),
  subjects: new Map<string, string>(),
}));

vi.mock(
  '@cloud-editor-mono/domain/src/services/services-by-app/app-lab',
  (): Record<string, unknown> => ({
    getAppFileContent: h.getAppFileContent,
    getCodeSubjects: (): Map<string, string> => h.subjects,
    setCodeSubjects: ({ path, content }: { path: string; content: string }) =>
      h.subjects.set(path, content),
    reloadCodeSubject: vi.fn(),
    getUnsavedFilesSubjectNext: vi.fn(),
  }),
);

vi.mock(
  '../../../../../../lib/app-components/app-lab/utils',
  (): Record<string, unknown> => ({ resetModuleScopedState: vi.fn() }),
);

// The selection effects fetch again whenever fetchFile changes, and a fetch replaces the buffer: an agent rename moves the path, not the files.
describe('useFileContents', () => {
  it('keeps fetchFile across an app path change, and reads from the new path', async () => {
    const client = new QueryClient();
    const { result, rerender } = renderHook(
      ({ appPath }) => useFileContents({ appPath }),
      {
        initialProps: { appPath: '/apps/blink' },
        wrapper: ({ children }: { children: ReactNode }) =>
          createElement(QueryClientProvider, { client }, children),
      },
    );
    const fetchFile = result.current.fetchFile;

    rerender({ appPath: '/apps/blink-fast' });
    await result.current.fetchFile('python/main.py');

    expect(result.current.fetchFile).toBe(fetchFile);
    expect(h.getAppFileContent).toHaveBeenCalledWith(
      '/apps/blink-fast/python/main.py',
    );
  });
});
