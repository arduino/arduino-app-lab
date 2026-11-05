/**
 * Repro harness for the "closing one tab closes another" bug.
 *
 * Drives `useEditorFiles` through the reported sequence: a committed tab A, a
 * preview tab B, two go-to-definition jumps (B -> C -> D, each replacing the
 * preview slot), then closing D. Go-to-definition is invoked through a
 * *frozen* `selectFile` — the LSP client captures the callback once when it is
 * created (`createUseCodeMirrorHook`) and never refreshes it — so the harness
 * keeps a snapshot of an early render's callback to mirror production.
 */

import {
  act,
  renderHook,
  RenderHookResult,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEditorFiles } from './useEditorFiles';
import {
  UseEditorFilesParams,
  UseEditorFilesReturn,
} from './useEditorFiles.type';

const h = vi.hoisted(() => ({
  idbGet: vi.fn(async () => undefined),
  idbUpdate: vi.fn(
    async (_key: string, _mutate: (prev: unknown) => unknown) => undefined,
  ),
  invalidateQueries: vi.fn(),
  storedOpenFiles: { value: null as unknown },
  // Nothing is found at a path naming `gone`, and a path naming `unreachable` gets no answer.
  statAppPath: vi.fn(async (path: string) => {
    if (path.includes('unreachable')) throw new Error('no answer');
    return path.includes('gone') ? null : { isDir: false };
  }),
}));

vi.mock('../../../../services/persistentStore', () => ({
  get: h.idbGet,
  update: h.idbUpdate,
}));

vi.mock(
  '@cloud-editor-mono/domain/src/services/services-by-app/app-lab',
  () => ({ statAppPath: h.statAppPath }),
);

vi.mock('@tanstack/react-query', () => ({
  // The stored record, once the query is allowed to read it.
  useQuery: (options: { enabled?: boolean }): { data: unknown } => ({
    data: options.enabled === false ? undefined : h.storedOpenFiles.value,
  }),
  useQueryClient: (): { invalidateQueries: () => void } => ({
    invalidateQueries: h.invalidateQueries,
  }),
}));

vi.mock('../../../../../common/hooks/useObservable', () => ({
  useObservable: (): undefined => undefined,
  useObservableRef: (): { current: undefined } => ({ current: undefined }),
}));

// The real catalogue pulls in image assets/JSX; the hook only needs id -> meta.
// `ghost.py` is withheld to stand in for an id the catalogue has no entry for —
// a brick that was deleted while its tab was open.
vi.mock('./useEditorFileMeta', () => ({
  useEditorFileMeta: (
    filePaths: string[] | undefined,
  ): Map<string, Record<string, unknown>> =>
    new Map(
      (filePaths ?? [])
        .filter((path) => path !== 'ghost.py')
        .map((path) => [
          path,
          { fileId: path, fileName: path, fileFullName: path, tags: [] },
        ]),
    ),
}));

// One array for every render: a new one each time would restart the check of the stored tabs.
const NO_BRICKS: never[] = [];

// Read on every render, so a test changes a param by assigning to the object it passed.
function setup(
  params: Partial<UseEditorFilesParams> = {},
): RenderHookResult<UseEditorFilesReturn, unknown> {
  return renderHook(() =>
    useEditorFiles({
      storeEntityId: 'app-1',
      boardId: 'A',
      appPath: '/apps/foo',
      defaultFilePath: null,
      appDirListed: true,
      appBricks: NO_BRICKS,
      getUnsavedFilesSubject: () => undefined,
      ...params,
    } as never),
  );
}

// A file opened from outside waits for this.
describe('useEditorFiles tab hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('says the tabs are in place only once the stored ones have been read', async () => {
    h.storedOpenFiles.value = undefined; // the read is still running
    const { result, rerender } = setup();
    expect(result.current.tabsHydrated).toBe(false);

    h.storedOpenFiles.value = { items: ['python/main.py'], selected: null };
    rerender();

    await waitFor(() => expect(result.current.tabsHydrated).toBe(true));
    expect(result.current.openFileIds).toEqual(['python/main.py']);
  });

  // A file can go while the editor is unmounted, as in Agent Mode: a stored tab restores only if its file is there.
  it('leaves out the stored tabs whose file is gone', async () => {
    const tabs = ['README.md', 'gone.py', 'gone_brick', 'unreachable.py'];
    h.storedOpenFiles.value = {
      items: tabs,
      selected: 'gone.py',
      panes: {
        A: { items: tabs, selected: 'gone.py' },
        B: { items: ['sub/gone.py', 'sub/kept.py'], selected: 'sub/gone.py' },
      },
    };
    const { result } = setup({ appBricks: [{ id: 'gone_brick' }] });

    await waitFor(() => expect(result.current.tabsHydrated).toBe(true));

    // A brick tab is named by its id, and a stat that gets no answer cannot tell.
    expect(result.current.openFileIds).toEqual([
      'README.md',
      'gone_brick',
      'unreachable.py',
    ]);
    expect(result.current.selectedFile?.fileId).toBe('README.md');
    expect(result.current.openFilesStore?.panes?.B?.items).toEqual([
      'sub/kept.py',
    ]);
    expect(result.current.openFilesStore?.panes?.B?.selected).toBeNull();
    expect(h.statAppPath).not.toHaveBeenCalledWith('/apps/foo/gone_brick');
  });

  it('stats each stored tab once, whichever panels hold it', async () => {
    const tabs = ['README.md', 'gone.py', 'sub/kept.py'];
    h.storedOpenFiles.value = {
      items: tabs,
      selected: 'README.md',
      panes: {
        A: { items: tabs, selected: 'README.md' },
        B: { items: ['sub/kept.py'], selected: 'sub/kept.py' },
      },
    };
    const { result } = setup();

    await waitFor(() => expect(result.current.tabsHydrated).toBe(true));

    expect(h.statAppPath.mock.calls).toEqual([
      ['/apps/foo/README.md'],
      ['/apps/foo/gone.py'],
      ['/apps/foo/sub/kept.py'],
    ]);
    expect(result.current.openFileIds).toEqual(['README.md', 'sub/kept.py']);
  });

  // An example app keeps its store entity and its record on every board.
  it('asks the next board about the tabs when the switch comes during the check', async () => {
    h.storedOpenFiles.value = { items: ['x.py'], selected: null };
    let answerGone: VoidFunction = () => undefined;
    h.statAppPath.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answerGone = (): void => resolve(null);
        }),
    );
    const params: Partial<UseEditorFilesParams> = {
      storeEntityId: 'app-example',
    };
    const { result, rerender } = setup(params);
    await act(async () => undefined);

    Object.assign(params, {
      boardId: 'B',
      appDirListed: false,
      defaultFilePath: undefined,
      appBricks: undefined,
    });
    rerender();
    await act(async () => answerGone());
    Object.assign(params, {
      appDirListed: true,
      defaultFilePath: null,
      appBricks: [],
    });
    rerender();

    await waitFor(() => expect(result.current.tabsHydrated).toBe(true));
    expect(h.statAppPath).toHaveBeenCalledTimes(2);
    expect(result.current.openFileIds).toEqual(['x.py']);
  });

  it('checks the tabs again on the next board when the switch comes before they restore', async () => {
    h.storedOpenFiles.value = { items: ['x.py'], selected: null };
    h.statAppPath.mockResolvedValueOnce(null);
    // The restore waits for the default file, the check does not.
    const params: Partial<UseEditorFilesParams> = {
      storeEntityId: 'app-example',
      defaultFilePath: undefined,
    };
    const { result, rerender } = setup(params);
    await act(async () => undefined);
    expect(result.current.tabsHydrated).toBe(false);

    Object.assign(params, {
      boardId: 'B',
      appDirListed: false,
      appBricks: undefined,
    });
    rerender();
    await act(async () => undefined);
    Object.assign(params, {
      appDirListed: true,
      defaultFilePath: null,
      appBricks: [],
    });
    rerender();

    await waitFor(() => expect(result.current.tabsHydrated).toBe(true));
    expect(h.statAppPath).toHaveBeenCalledTimes(2);
    expect(result.current.openFileIds).toEqual(['x.py']);
  });

  // The app is refetched after a board switch, so for a moment there is no entity: its tabs are not known yet, not empty.
  it('restores nothing before it knows whose tabs they are', async () => {
    h.storedOpenFiles.value = { items: ['python/main.py'], selected: null };
    const params: Partial<UseEditorFilesParams> = {
      storeEntityId: undefined,
      defaultFilePath: 'README.md',
    };
    const { result, rerender } = setup(params);
    await act(async () => undefined);
    expect(result.current.tabsHydrated).toBe(false);

    params.storeEntityId = 'app-B';
    rerender();

    await waitFor(() => expect(result.current.tabsHydrated).toBe(true));
    expect(result.current.openFileIds).toEqual(['python/main.py']);
  });

  // In the commit of a board switch the entity already names the next board, while the tabs on screen are still this board's.
  it('writes the tabs on screen only to the board they were restored on', async () => {
    h.storedOpenFiles.value = { items: ['x.py'], selected: 'x.py' };
    const params: Partial<UseEditorFilesParams> = {
      storeEntityId: 'app1-A',
      boardId: 'A',
    };
    const { result, rerender } = setup(params);
    await waitFor(() => expect(result.current.tabsHydrated).toBe(true));
    await act(async () => undefined);
    h.idbUpdate.mockClear();

    Object.assign(params, { storeEntityId: 'app1-B', boardId: 'B' });
    rerender();
    await act(async () => undefined);
    expect(h.idbUpdate).not.toHaveBeenCalled();

    params.appDirListed = false;
    rerender();
    h.storedOpenFiles.value = { items: ['y.py'], selected: 'y.py' };
    params.appDirListed = true;
    rerender();
    await waitFor(() => expect(result.current.openFileIds).toEqual(['y.py']));
    await act(async () => undefined);
    const entities = h.idbUpdate.mock.calls.map(([, mutate]) =>
      Object.keys(mutate({}) as object),
    );
    expect(entities.length).toBeGreaterThan(0);
    expect(entities.every((keys) => keys.join() === 'app1-B')).toBe(true);
  });

  // A board can have no id at all, as a USB board whose serial the system does not report.
  it('writes the tabs of a board that has no id', async () => {
    h.storedOpenFiles.value = { items: ['x.py'], selected: 'x.py' };
    const { result } = setup({ storeEntityId: 'app1', boardId: undefined });
    await waitFor(() => expect(result.current.tabsHydrated).toBe(true));
    await act(async () => undefined);
    h.idbUpdate.mockClear();

    act(() => result.current.selectFile({ fileId: 'y.py' }));
    await act(async () => undefined);

    expect(h.idbUpdate).toHaveBeenCalled();
  });

  // Until the next restore the tabs on screen are no board's: the reset emptied them.
  it('writes nothing between a reset and the next restore', async () => {
    h.storedOpenFiles.value = { items: ['x.py'], selected: 'x.py' };
    const params: Partial<UseEditorFilesParams> = {};
    const { result, rerender } = setup(params);
    await waitFor(() => expect(result.current.tabsHydrated).toBe(true));

    params.appDirListed = false;
    rerender();
    await waitFor(() => expect(result.current.tabsHydrated).toBe(false));
    await act(async () => undefined);
    h.idbUpdate.mockClear();
    await act(() =>
      result.current.storeSplitState({
        isSplit: true,
        splitProportionLeft: 50,
      }),
    );

    expect(h.idbUpdate).not.toHaveBeenCalled();
  });

  // The tree takes clicks while the stored tabs are checked: the restore adds them next to the file opened.
  it('keeps a file opened during the check open and selected', async () => {
    let answer: (node: { isDir: boolean }) => void = () => undefined;
    h.statAppPath.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    h.storedOpenFiles.value = { items: ['x.py'], selected: 'x.py' };
    const { result } = setup();

    act(() => result.current.selectFile({ fileId: 'README.md' }));
    expect(result.current.tabsHydrated).toBe(false);
    await act(async () => answer({ isDir: false }));

    await waitFor(() => expect(result.current.tabsHydrated).toBe(true));
    expect(result.current.openFileIds).toEqual(['x.py', 'README.md']);
    expect(result.current.selectedFile?.fileId).toBe('README.md');
  });

  it("carries no file opened during board A's check into board B's tabs", async () => {
    h.statAppPath.mockImplementationOnce(() => new Promise(() => undefined));
    h.storedOpenFiles.value = { items: ['a.py'], selected: 'a.py' };
    const params: Partial<UseEditorFilesParams> = {
      storeEntityId: 'app-1-A',
      boardId: 'A',
    };
    const { result, rerender } = setup(params);
    act(() => result.current.selectFile({ fileId: 'only-on-A.py' }));

    Object.assign(params, {
      storeEntityId: 'app-1-B',
      boardId: 'B',
      appDirListed: false,
      appBricks: undefined,
    });
    h.storedOpenFiles.value = { items: ['b.py'], selected: 'b.py' };
    rerender();
    await act(async () => undefined);
    Object.assign(params, { appDirListed: true, appBricks: NO_BRICKS });
    rerender();

    await waitFor(() => expect(result.current.tabsHydrated).toBe(true));
    expect(result.current.openFileIds).toEqual(['b.py']);
    expect(result.current.selectedFile?.fileId).toBe('b.py');
  });

  // A write before the restore would change the record and start a second check.
  it('writes nothing before the tabs restore', async () => {
    h.storedOpenFiles.value = { items: ['x.py'], selected: 'x.py' };
    const { result } = setup({ defaultFilePath: undefined });
    await act(async () => undefined);
    expect(result.current.tabsHydrated).toBe(false);

    await act(() =>
      result.current.storeSplitState({
        isSplit: true,
        splitProportionLeft: 50,
      }),
    );

    expect(h.idbUpdate).not.toHaveBeenCalled();
    expect(h.statAppPath).toHaveBeenCalledTimes(1);
  });

  it('counts no check from the previous board, also one made without a brick list', async () => {
    h.storedOpenFiles.value = { items: ['x.py'], selected: null };
    const params: Partial<UseEditorFilesParams> = {
      storeEntityId: 'app-example',
      appBricks: undefined,
      appBricksFailed: true,
      defaultFilePath: undefined,
    };
    const { result, rerender } = setup(params);
    await act(async () => undefined);
    expect(h.statAppPath).not.toHaveBeenCalled();

    // The switch's first render still shows the last board's failed brick list; the next board then answers its default file first.
    params.boardId = 'B';
    rerender();
    await act(async () => undefined);
    Object.assign(params, { appBricksFailed: false, defaultFilePath: null });
    rerender();
    await act(async () => undefined);
    expect(result.current.tabsHydrated).toBe(false);

    params.appBricks = [];
    rerender();
    await waitFor(() => expect(result.current.tabsHydrated).toBe(true));
    expect(h.statAppPath.mock.calls).toEqual([['/apps/foo/x.py']]);
  });

  // Each tab change writes the record, and the store answers with a new one.
  it('sends no stat once the tabs are restored', async () => {
    h.storedOpenFiles.value = { items: ['x.py'], selected: 'x.py' };
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.tabsHydrated).toBe(true));
    h.statAppPath.mockClear();

    act(() => result.current.selectFile({ fileId: 'y.py' }));
    h.storedOpenFiles.value = { items: ['x.py', 'y.py'], selected: 'y.py' };
    rerender();
    act(() => result.current.closeFile('x.py'));
    h.storedOpenFiles.value = { items: ['y.py'], selected: 'y.py' };
    rerender();
    await act(async () => undefined);

    expect(result.current.openFileIds).toEqual(['y.py']);
    expect(h.statAppPath).not.toHaveBeenCalled();
  });

  it('waits for the brick list before it checks the stored tabs', async () => {
    h.storedOpenFiles.value = {
      items: ['python/main.py', 'my_brick'],
      selected: null,
    };
    const params: Partial<UseEditorFilesParams> = { appBricks: undefined };
    const { result, rerender } = setup(params);
    await act(async () => undefined);

    expect(result.current.tabsHydrated).toBe(false);
    expect(h.statAppPath).not.toHaveBeenCalled();

    params.appBricks = [{ id: 'my_brick' }];
    rerender();

    await waitFor(() => expect(result.current.tabsHydrated).toBe(true));
    expect(h.statAppPath.mock.calls).toEqual([['/apps/foo/python/main.py']]);
    expect(result.current.openFileIds).toEqual(['python/main.py', 'my_brick']);
  });

  // Without the brick list a brick tab cannot be told from a file tab.
  it('restores every stored tab when the brick list failed', async () => {
    h.storedOpenFiles.value = {
      items: ['gone.py', 'my_brick'],
      selected: null,
    };
    const { result } = setup({ appBricks: undefined, appBricksFailed: true });

    await waitFor(() => expect(result.current.tabsHydrated).toBe(true));

    expect(result.current.openFileIds).toEqual(['gone.py', 'my_brick']);
    expect(h.statAppPath).not.toHaveBeenCalled();
  });

  it('drops gone tabs only from the record it checked', async () => {
    h.storedOpenFiles.value = {
      items: ['README.md', 'gone.py'],
      selected: 'README.md',
    };
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.tabsHydrated).toBe(true));
    expect(result.current.openFilesStore?.items).toEqual(['README.md']);

    // The file is created again and opened, so the next record names it.
    h.storedOpenFiles.value = {
      items: ['README.md', 'gone.py'],
      selected: 'gone.py',
    };
    rerender();

    expect(result.current.openFilesStore?.items).toEqual([
      'README.md',
      'gone.py',
    ]);
  });
});

describe('useEditorFiles preview replacement + close', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.storedOpenFiles.value = null;
  });

  it('keeps the committed tab when the preview tab is closed after two jumps', () => {
    const { result } = setup();

    // A opened committed.
    act(() => result.current.selectFile({ fileId: 'A.py' }));
    // Snapshot of the callback the LSP client would have captured.
    const frozenSelectFile = result.current.selectFile;

    // B opened in preview from the file tree (fresh callback, like production).
    act(() => result.current.selectFile({ fileId: 'B.py', isPreview: true }));
    expect(result.current.openFileIds).toEqual(['A.py', 'B.py']);
    expect(result.current.previewFileId).toBe('B.py');

    // Go to definition B -> C, then C -> D, both via the frozen callback.
    act(() => frozenSelectFile({ fileId: 'C.py', isPreview: true }));
    expect(result.current.openFileIds).toEqual(['A.py', 'C.py']);

    act(() => frozenSelectFile({ fileId: 'D.py', isPreview: true }));
    expect(result.current.openFileIds).toEqual(['A.py', 'D.py']);
    expect(result.current.previewFileId).toBe('D.py');

    // Close D: only D should go.
    act(() => result.current.closeFile('D.py'));
    expect(result.current.openFileIds).toEqual(['A.py']);
    expect(result.current.selectedFile?.fileId).toBe('A.py');
  });

  it('clears the preview slot when the preview tab is closed', () => {
    const { result } = setup();

    act(() => result.current.selectFile({ fileId: 'A.py' }));
    act(() => result.current.selectFile({ fileId: 'B.py', isPreview: true }));
    expect(result.current.previewFileId).toBe('B.py');

    act(() => result.current.closeFile('B.py'));
    expect(result.current.openFileIds).toEqual(['A.py']);
    // A closed tab must not keep owning the preview slot: the next preview
    // open would otherwise compute its insertion against a ghost id.
    expect(result.current.previewFileId).toBeUndefined();
  });

  // Replays the logged session: an open tab whose id the meta catalogue has no
  // entry for renders no tab but still occupies a slot in `openFileIds`.
  it('never selects an id that renders no tab', () => {
    const { result } = setup();

    act(() => result.current.selectFile({ fileId: 'A.py' }));
    act(() => result.current.selectFile({ fileId: 'ghost.py' }));
    act(() => result.current.selectFile({ fileId: 'B.py', isPreview: true }));

    expect(result.current.openFileIds).toEqual(['A.py', 'ghost.py', 'B.py']);
    // Only two of the three ids actually render.
    expect(result.current.openFiles.map((f) => f.fileId)).toEqual([
      'A.py',
      'B.py',
    ]);

    act(() => result.current.closeFile('B.py'));

    // Indexing straight into openFileIds picks prevOpenFileIds[1] — the ghost —
    // which blanks the editor while A.py's tab is still on screen.
    expect(result.current.selectedFile?.fileId).toBe('A.py');
  });

  it('gives the new tab the replaced preview slot when the selection is stale', () => {
    const { result } = setup();

    // A trailing tab is what makes this discriminating: with nothing after the
    // preview, appending and taking the slot land in the same place.
    act(() => result.current.selectFile({ fileId: 'A.py' }));
    act(() => result.current.selectFile({ fileId: 'Z.py' }));
    act(() =>
      result.current.selectFile({
        fileId: 'B.py',
        isPreview: true,
        openAtIndex: 1,
      }),
    );
    expect(result.current.openFileIds).toEqual(['A.py', 'B.py', 'Z.py']);

    // Frozen callback, as the LSP client holds one: its `selectedFileId` is B.py.
    const frozenSelectFile = result.current.selectFile;

    act(() => frozenSelectFile({ fileId: 'C.py', isPreview: true }));
    expect(result.current.openFileIds).toEqual(['A.py', 'C.py', 'Z.py']);

    // Second jump: the frozen closure still names B.py, which is long gone, so
    // the "insert after the selected tab" rule can't apply. The new tab must
    // take C.py's slot rather than being appended past Z.py.
    act(() => frozenSelectFile({ fileId: 'D.py', isPreview: true }));
    expect(result.current.openFileIds).toEqual(['A.py', 'D.py', 'Z.py']);
  });

  it('rejects a reorder that repeats an id', () => {
    const { result } = setup();

    act(() => result.current.selectFile({ fileId: 'A.py' }));
    act(() => result.current.selectFile({ fileId: 'B.py' }));
    expect(result.current.openFileIds).toEqual(['A.py', 'B.py']);

    // Same length, every id present in the previous list — but duplicated.
    // `closeFile` drops all occurrences of an id, so accepting this would
    // make closing B remove both tabs.
    act(() => result.current.updateOpenFilesOrder(['B.py', 'B.py']));
    expect(result.current.openFileIds).toEqual(['A.py', 'B.py']);

    act(() => result.current.closeFile('B.py'));
    expect(result.current.openFileIds).toEqual(['A.py']);
  });

  it('re-opening a closed preview file does not evict the committed tab', () => {
    const { result } = setup();

    act(() => result.current.selectFile({ fileId: 'A.py' }));
    act(() => result.current.selectFile({ fileId: 'B.py', isPreview: true }));
    act(() => result.current.closeFile('B.py'));
    expect(result.current.openFileIds).toEqual(['A.py']);

    // B is reopened committed (double-click). It must be added, not swapped
    // into the slot of a tab that is still open.
    act(() => result.current.selectFile({ fileId: 'B.py' }));
    expect(result.current.openFileIds).toEqual(['A.py', 'B.py']);
  });
});

describe('useEditorFiles tab-meta catalogue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.storedOpenFiles.value = null;
  });

  // Panel B's stored tabs are resolved through this catalogue by the split-view
  // hydration, and they are not open in panel A.
  it('covers stored panel B tabs, not just the open ones', async () => {
    h.storedOpenFiles.value = {
      items: ['A.py'],
      panes: { A: { items: ['A.py'] }, B: { items: ['deep/panel-b.py'] } },
    };

    const { result } = setup();

    await waitFor(() =>
      expect(result.current.editorFiles.map((f) => f.fileId)).toContain(
        'deep/panel-b.py',
      ),
    );
  });
});
