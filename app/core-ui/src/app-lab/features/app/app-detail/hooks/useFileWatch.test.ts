/**
 * Unit tests for useFileWatch: the hook that keeps an open app in sync with
 * external filesystem changes. It starts a single recursive backend watch on
 * mount, tears it down on unmount, and translates the backend's `refresh`
 * events into the right React Query invalidations / content reloads.
 *
 * Every cross-boundary dependency is stubbed so the tests exercise only the
 * the hook's orchestration: the domain watch service (watchApp/unwatchApp/onWatcherRefresh),
 * the query client, and the injected refreshFileContents callback. `emitRefresh`
 * drives the backend's refresh callback captured by the onWatcherRefresh mock.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFileWatch } from './useFileWatch';

type RefreshEvent = { kind: string; path: string; op?: string };

const h = vi.hoisted(() => {
  const listeners: Array<(event: RefreshEvent) => void> = [];
  const invalidateQueries = vi.fn();
  return {
    watchApp: vi.fn((_path: string) => Promise.resolve()),
    unwatchApp: vi.fn((_path: string) => Promise.resolve()),
    onWatcherRefresh: vi.fn((cb: (event: RefreshEvent) => void) => {
      listeners.push(cb);
      return () => {
        const i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
      };
    }),
    emitRefresh: (event: RefreshEvent) => {
      listeners.forEach((cb) => cb(event));
    },
    resetListeners: () => {
      listeners.length = 0;
    },
    invalidateQueries,
    queryClient: { invalidateQueries },
  };
});

vi.mock('./useAppFiles', () => ({
  APP_YAML_PATH: 'app.yaml',
  SKETCH_YAML_PATH: 'sketch/sketch.yaml',
}));

vi.mock(
  '@cloud-editor-mono/domain/src/services/services-by-app/app-lab',
  () => ({
    watchApp: h.watchApp,
    unwatchApp: h.unwatchApp,
    onWatcherRefresh: h.onWatcherRefresh,
  }),
);

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQueryClient: () => h.queryClient };
});

type Params = Parameters<typeof useFileWatch>[0];

const makeParams = (overrides: Partial<Params> = {}): Params => ({
  appId: 'app-1',
  appPath: '/apps/foo',
  openTabIds: [],
  refreshFileContents: vi.fn(() => Promise.resolve()),
  deleteFile: vi.fn(() => Promise.resolve()),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.resetListeners();
});

describe('useFileWatch', () => {
  describe('watch lifecycle', () => {
    it('starts a recursive watch on the app path when mounted', () => {
      renderHook(() => useFileWatch(makeParams()));

      expect(h.watchApp).toHaveBeenCalledTimes(1);
      expect(h.watchApp).toHaveBeenCalledWith('/apps/foo');
    });

    it('does not start a watch when the app path is undefined', () => {
      renderHook(() => useFileWatch(makeParams({ appPath: undefined })));

      expect(h.watchApp).not.toHaveBeenCalled();
    });

    it('stops the app watch on unmount', () => {
      const { unmount } = renderHook(() => useFileWatch(makeParams()));
      expect(h.unwatchApp).not.toHaveBeenCalled();

      unmount();

      expect(h.unwatchApp).toHaveBeenCalledWith('/apps/foo');
    });

    it('re-watches when the app path changes', () => {
      const base = makeParams();
      const { rerender } = renderHook((props: Params) => useFileWatch(props), {
        initialProps: { ...base, appPath: '/apps/foo' },
      });

      rerender({ ...base, appPath: '/apps/bar' });

      expect(h.unwatchApp).toHaveBeenCalledWith('/apps/foo');
      expect(h.watchApp).toHaveBeenCalledWith('/apps/bar');
    });
  });

  describe('refresh events', () => {
    it('reloads content when the changed file is open', () => {
      const refreshFileContents = vi.fn(() => Promise.resolve());
      renderHook(() =>
        useFileWatch(
          makeParams({ openTabIds: ['main.py'], refreshFileContents }),
        ),
      );

      act(() => h.emitRefresh({ kind: 'file', path: '/apps/foo/main.py' }));

      expect(refreshFileContents).toHaveBeenCalledWith(
        ['main.py'],
        'external-change',
      );
    });

    it('ignores a file event for a file that is not open', () => {
      const refreshFileContents = vi.fn(() => Promise.resolve());
      renderHook(() =>
        useFileWatch(
          makeParams({ openTabIds: ['main.py'], refreshFileContents }),
        ),
      );

      act(() => h.emitRefresh({ kind: 'file', path: '/apps/foo/other.py' }));

      expect(refreshFileContents).not.toHaveBeenCalled();
    });

    it('matches an already-absolute open-file id directly', () => {
      const refreshFileContents = vi.fn(() => Promise.resolve());
      renderHook(() =>
        useFileWatch(
          makeParams({
            openTabIds: ['/apps/foo/sub/x.py'],
            refreshFileContents,
          }),
        ),
      );

      act(() => h.emitRefresh({ kind: 'file', path: '/apps/foo/sub/x.py' }));

      expect(refreshFileContents).toHaveBeenCalledWith(
        ['/apps/foo/sub/x.py'],
        'external-change',
      );
    });

    it('syncs the LS on a file event even when the file is open in a tab', () => {
      // An open-but-background tab has no editor view, so the buffer reload
      // alone never reaches the LS; reloadLspFile must run too (it no-ops
      // for files with a live view). Skipping it lets the server drift and
      // a later tab-selection diff double-apply on the drifted copy.
      const refreshFileContents = vi.fn(() => Promise.resolve());
      const reloadLspFile = vi.fn(() => Promise.resolve());
      renderHook(() =>
        useFileWatch(
          makeParams({
            openTabIds: ['main.py'],
            refreshFileContents,
            reloadLspFile,
          }),
        ),
      );

      act(() => h.emitRefresh({ kind: 'file', path: '/apps/foo/main.py' }));

      expect(refreshFileContents).toHaveBeenCalledWith(
        ['main.py'],
        'external-change',
      );
      expect(reloadLspFile).toHaveBeenCalledWith('main.py');
    });

    it('syncs the LS on a file event for a file that is not open', () => {
      const reloadLspFile = vi.fn(() => Promise.resolve());
      renderHook(() =>
        useFileWatch(makeParams({ openTabIds: [], reloadLspFile })),
      );

      act(() => h.emitRefresh({ kind: 'file', path: '/apps/foo/lib/util.py' }));

      expect(reloadLspFile).toHaveBeenCalledWith('lib/util.py');
    });

    it('invalidates the app file tree on a dir create event', () => {
      renderHook(() => useFileWatch(makeParams()));

      act(() =>
        h.emitRefresh({ kind: 'dir', path: '/apps/foo/newdir', op: 'create' }),
      );

      expect(h.invalidateQueries).toHaveBeenCalledWith(['app-files', 'app-1']);
    });

    it('invalidates the app file tree on a dir event with no op (legacy payload)', () => {
      renderHook(() => useFileWatch(makeParams()));

      act(() => h.emitRefresh({ kind: 'dir', path: '/apps/foo/newdir' }));

      expect(h.invalidateQueries).toHaveBeenCalledWith(['app-files', 'app-1']);
    });

    it('closes an open file through deleteFile (stream) on a dir remove of that file', () => {
      const deleteFile = vi.fn(() => Promise.resolve());
      renderHook(() =>
        useFileWatch(makeParams({ openTabIds: ['old.py'], deleteFile })),
      );

      act(() =>
        h.emitRefresh({ kind: 'dir', path: '/apps/foo/old.py', op: 'remove' }),
      );

      expect(deleteFile).toHaveBeenCalledWith('old.py', { source: 'stream' });
    });

    it('closes open descendants (not the folder path) on a dir remove of a folder', () => {
      const deleteFile = vi.fn(() => Promise.resolve());
      renderHook(() =>
        useFileWatch(
          makeParams({
            // 'test/a' is open (e.g. in pane B); the folder itself is not a tab.
            openTabIds: ['test/a', 'other.py'],
            deleteFile,
          }),
        ),
      );

      act(() =>
        h.emitRefresh({ kind: 'dir', path: '/apps/foo/test', op: 'remove' }),
      );

      // The open descendant is closed; the folder path is never passed to
      // deleteFile (which would otherwise error on a folder), nor is the
      // unrelated open file touched.
      expect(deleteFile).toHaveBeenCalledTimes(1);
      expect(deleteFile).toHaveBeenCalledWith('test/a', { source: 'stream' });
    });

    it('only refetches the tree (no deleteFile) on a dir remove with nothing open under the path', () => {
      const deleteFile = vi.fn(() => Promise.resolve());
      renderHook(() =>
        useFileWatch(makeParams({ openTabIds: ['other.py'], deleteFile })),
      );

      act(() =>
        h.emitRefresh({ kind: 'dir', path: '/apps/foo/gone.py', op: 'remove' }),
      );

      expect(deleteFile).not.toHaveBeenCalled();
      expect(h.invalidateQueries).toHaveBeenCalledWith(['app-files', 'app-1']);
    });

    it('syncs LS content on a dir create of a non-open file (atomic save)', () => {
      // An editor's atomic save (write temp + rename) coalesces into a bare
      // dir create; the server would otherwise keep its stale didOpen'd
      // buffer forever (the touch-then-edit newVars.py bug).
      const refreshFileContents = vi.fn(() => Promise.resolve());
      const reloadLspFile = vi.fn(() => Promise.resolve());
      renderHook(() =>
        useFileWatch(
          makeParams({
            openTabIds: ['main.py'],
            refreshFileContents,
            reloadLspFile,
          }),
        ),
      );

      act(() =>
        h.emitRefresh({
          kind: 'dir',
          path: '/apps/foo/newVars.py',
          op: 'create',
        }),
      );

      expect(reloadLspFile).toHaveBeenCalledWith('newVars.py');
      expect(refreshFileContents).not.toHaveBeenCalled();
    });

    it('reloads the buffer and syncs the LS on a dir create of an open file', () => {
      const refreshFileContents = vi.fn(() => Promise.resolve());
      const reloadLspFile = vi.fn(() => Promise.resolve());
      renderHook(() =>
        useFileWatch(
          makeParams({
            openTabIds: ['main.py'],
            refreshFileContents,
            reloadLspFile,
          }),
        ),
      );

      act(() =>
        h.emitRefresh({ kind: 'dir', path: '/apps/foo/main.py', op: 'create' }),
      );

      expect(refreshFileContents).toHaveBeenCalledWith(
        ['main.py'],
        'external-change',
      );
      expect(reloadLspFile).toHaveBeenCalledWith('main.py');
    });

    it('does not reload content on a dir remove', () => {
      const refreshFileContents = vi.fn(() => Promise.resolve());
      const reloadLspFile = vi.fn(() => Promise.resolve());
      renderHook(() =>
        useFileWatch(
          makeParams({
            openTabIds: ['other.py'],
            refreshFileContents,
            reloadLspFile,
          }),
        ),
      );

      act(() =>
        h.emitRefresh({ kind: 'dir', path: '/apps/foo/gone.py', op: 'remove' }),
      );

      expect(refreshFileContents).not.toHaveBeenCalled();
      expect(reloadLspFile).not.toHaveBeenCalled();
    });

    it('invalidates manifest queries and reloads the manifest buffers on a manifest event', () => {
      const refreshFileContents = vi.fn(() => Promise.resolve());
      renderHook(() => useFileWatch(makeParams({ refreshFileContents })));

      act(() =>
        h.emitRefresh({ kind: 'manifest', path: '/apps/foo/app.yaml' }),
      );

      expect(h.invalidateQueries).toHaveBeenCalledWith(['app-files', 'app-1']);
      expect(h.invalidateQueries).toHaveBeenCalledWith(['app-bricks', 'app-1']);
      expect(h.invalidateQueries).toHaveBeenCalledWith([
        'app-sketch-libraries',
        'app-1',
      ]);
      expect(h.invalidateQueries).toHaveBeenCalledWith([
        'list-my-apps',
        'app-1',
      ]);
      expect(refreshFileContents).toHaveBeenCalledWith(
        ['app.yaml', 'sketch/sketch.yaml'],
        'external-change',
      );
    });

    it('does nothing for an apps event (handled by the app list)', () => {
      const refreshFileContents = vi.fn(() => Promise.resolve());
      renderHook(() => useFileWatch(makeParams({ refreshFileContents })));

      act(() => h.emitRefresh({ kind: 'apps', path: '/apps' }));

      expect(h.invalidateQueries).not.toHaveBeenCalled();
      expect(refreshFileContents).not.toHaveBeenCalled();
    });

    it('stops handling refresh events after unmount', () => {
      const refreshFileContents = vi.fn(() => Promise.resolve());
      const { unmount } = renderHook(() =>
        useFileWatch(
          makeParams({ openTabIds: ['main.py'], refreshFileContents }),
        ),
      );

      unmount();
      act(() => h.emitRefresh({ kind: 'file', path: '/apps/foo/main.py' }));

      expect(refreshFileContents).not.toHaveBeenCalled();
    });
  });
});
