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

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEditorFiles } from './useEditorFiles';

const h = vi.hoisted(() => ({
  idbGet: vi.fn(async () => undefined),
  idbUpdate: vi.fn(async () => undefined),
  invalidateQueries: vi.fn(),
}));

vi.mock('idb-keyval', () => ({
  get: h.idbGet,
  update: h.idbUpdate,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null }),
  useQueryClient: () => ({ invalidateQueries: h.invalidateQueries }),
}));

vi.mock('../../../../../common/hooks/useObservable', () => ({
  useObservable: () => undefined,
}));

// The real catalogue pulls in image assets/JSX; the hook only needs id -> meta.
vi.mock('./useEditorFileMeta', () => ({
  useEditorFileMeta: (filesList: { path: string }[] | undefined) =>
    new Map(
      (filesList ?? []).map((f) => [
        f.path,
        { fileId: f.path, fileName: f.path, fileFullName: f.path, tags: [] },
      ]),
    ),
}));

const filesList = ['A.py', 'B.py', 'C.py', 'D.py', 'Z.py'].map((path) => ({
  path,
  name: path,
  extension: '.py',
})) as never;

function setup() {
  return renderHook(() =>
    useEditorFiles({
      storeEntityId: undefined,
      defaultFileId: undefined,
      filesList,
      appBricks: undefined,
      getUnsavedFilesSubject: () => undefined,
    } as never),
  );
}

describe('useEditorFiles preview replacement + close', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  // Replays the logged session: the persisted tab list still named `main.py`
  // after the project's files moved under `sketch/`, so that id resolved to no
  // meta — it renders no tab but still occupies a slot in `openFileIds`.
  // `ghost.py` stands in for it here (absent from `filesList`).
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
