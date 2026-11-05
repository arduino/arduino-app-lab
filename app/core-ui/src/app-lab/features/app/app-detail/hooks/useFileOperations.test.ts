/**
 * Renaming a folder has to move its listing with it: the file tree keys every
 * listing by its directory's path, so a rename that only invalidates leaves the
 * new folder unlisted and the old key alive to furnish whatever next takes the
 * name.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { createElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  keepMovedBuffer,
  useFileOperations,
  UseFileOperationsReturn,
} from './useFileOperations';

const h = vi.hoisted(() => ({
  renameAppFile: vi.fn(() => Promise.resolve()),
  subjects: new Map<string, unknown>(),
  unsaved: new Set<string>(),
}));

vi.mock(
  '@cloud-editor-mono/domain/src/services/services-by-app/app-lab',
  (): Record<string, unknown> => ({
    createAppFile: vi.fn(),
    createAppFolder: vi.fn(),
    getCodeSubjectById: (): never => {
      throw new Error('no subject');
    },
    getCodeSubjects: (): Map<string, unknown> => h.subjects,
    isUnsavedFile: (id: string): boolean => h.unsaved.has(id),
    removeAppFile: vi.fn(),
    removeCodeSubject: vi.fn(),
    renameAppFile: h.renameAppFile,
    renameCodeSubject: (from: string, to: string): void => {
      if (!h.subjects.has(from)) return;
      h.subjects.set(to, h.subjects.get(from));
      h.subjects.delete(from);
      if (h.unsaved.delete(from)) h.unsaved.add(to);
    },
    setCodeSubjects: vi.fn(),
  }),
);

const renameDir = vi.fn();
const invalidateDirs = vi.fn();

const renderOps = (): UseFileOperationsReturn => {
  const client = new QueryClient();
  const { result } = renderHook(
    () =>
      useFileOperations({
        appId: 'app-1',
        appPath: '/apps/foo',
        invalidateDirs,
        unlistDir: vi.fn(),
        renameDir,
        fetchFile: vi.fn(() => Promise.resolve()),
        selectFile: vi.fn(),
        closeFile: vi.fn(),
      }),
    {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client }, children),
    },
  );
  return result.current;
};

beforeEach(() => {
  vi.clearAllMocks();
  h.subjects.clear();
  h.unsaved.clear();
  h.renameAppFile.mockResolvedValue(undefined);
});

describe('useFileOperations.renameFile', () => {
  it('moves the folder listing across on a user rename', async () => {
    await renderOps().renameFile('python', 'py3', { nodeType: 'folder' });

    expect(renameDir).toHaveBeenCalledWith('python', 'py3');
  });

  // The watcher's half of an external rename never touches the backend, but the
  // listing has to move just the same.
  it('moves it across on a stream rename too', async () => {
    await renderOps().renameFile('python', 'py3', {
      nodeType: 'folder',
      source: 'stream',
    });

    expect(h.renameAppFile).not.toHaveBeenCalled();
    expect(renameDir).toHaveBeenCalledWith('python', 'py3');
  });

  it('leaves a file rename alone', async () => {
    await renderOps().renameFile('python/a.py', 'python/b.py', {
      nodeType: 'file',
    });

    expect(renameDir).not.toHaveBeenCalled();
  });

  // The folder is still at its old path, so moving the expansion would unlist a
  // folder that is still on screen.
  it('does not move it when the backend rename fails', async () => {
    h.renameAppFile.mockRejectedValue(new Error('read-only'));

    await expect(
      renderOps().renameFile('python', 'py3', { nodeType: 'folder' }),
    ).rejects.toThrow();
    expect(renameDir).not.toHaveBeenCalled();
  });

  // The move keeps the content, so the refetch its new id triggers must not replace a buffer with typing not saved yet.
  it('keeps a moved buffer with typing not saved yet, for every panel that shows it', async () => {
    h.subjects.set('python/a.py', {});
    h.unsaved.add('python/a.py');
    await renderOps().renameFile('python/a.py', 'python/b.py', {
      source: 'stream',
      nodeType: 'file',
    });

    expect(keepMovedBuffer('python/b.py')).toBe(true);
    expect(keepMovedBuffer('python/b.py')).toBe(true);
    expect(keepMovedBuffer('python/a.py')).toBe(false);

    // However late a refetch comes, the buffer stays until its typing is saved.
    h.unsaved.delete('python/b.py');
    expect(keepMovedBuffer('python/b.py')).toBe(false);
  });

  // An agent edit flushed to the board just before the move must reach the buffer.
  it('reloads a moved buffer with nothing unsaved', async () => {
    h.subjects.set('python/g.py', {});
    await renderOps().renameFile('python/g.py', 'python/h.py', {
      source: 'stream',
      nodeType: 'file',
    });

    expect(keepMovedBuffer('python/h.py')).toBe(false);
  });

  // The file tree moves the buffer before the board does, so its rename keeps the refetch it always had.
  it('marks nothing on a user rename', async () => {
    h.subjects.set('python/e.py', {});
    h.unsaved.add('python/e.py');
    await renderOps().renameFile('python/e.py', 'python/f.py', {
      nodeType: 'file',
    });

    expect(keepMovedBuffer('python/f.py')).toBe(false);
  });

  // Without a buffer there is nothing to keep, and skipping the fetch would leave the tab empty.
  it('marks nothing for a file with no buffer', async () => {
    await renderOps().renameFile('python/c.py', 'python/d.py', {
      source: 'stream',
      nodeType: 'file',
    });

    expect(keepMovedBuffer('python/d.py')).toBe(false);
  });
});
