/**
 * Unit tests for the module-level utilities in codeMirrorViewInstances.ts.
 *
 * Coverage:
 *  - linkSplitEditors / unlinkSplitEditors
 *  - useCodeMirrorInstanceCleanup (memory-leak prevention)
 *  - useCodeMirrorStateCleanup (stale-state pruning)
 *
 * The module uses several singleton maps/objects (viewInstances,
 * viewInstanceStateMaps) as module-level state.  Each test restores these to
 * a clean baseline in afterEach to prevent inter-test leakage.
 */

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearEditorStateCaches,
  linkSplitEditors,
  unlinkSplitEditors,
  useCodeMirrorInstanceCleanup,
  useCodeMirrorStateCleanup,
  ViewInstances,
  viewInstances,
  viewInstanceStateMaps,
} from './codeMirrorViewInstances';

// ---------------------------------------------------------------------------
// SCSS module mock — code-editor-variables.module.scss exports CSS variable
// names that are used only in the Editor (not Editor2) cleanup path.
// ---------------------------------------------------------------------------
vi.mock('../code-editor/code-editor-variables.module.scss', () => ({
  default: {
    lineNumbersGutterWidth: '--line-numbers-gutter-width',
    defaultLineNumbersGutterWidth: '48px',
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal EditorView-like mock that satisfies the parts of the API
 *  that codeMirrorViewInstances.ts calls. */
function makeMockEditorInstance() {
  const dom = document.createElement('div');
  const parent = document.createElement('div');
  parent.appendChild(dom);
  return {
    dispatch: vi.fn(),
    destroy: vi.fn(),
    dom,
  };
}

// ---------------------------------------------------------------------------
// Baseline cleanup between tests
// ---------------------------------------------------------------------------

afterEach(() => {
  viewInstances[ViewInstances.Editor].instance = null;
  viewInstances[ViewInstances.Editor].appendedTo = null;
  viewInstances[ViewInstances.Editor2].instance = null;
  viewInstances[ViewInstances.Editor2].appendedTo = null;
  viewInstances[ViewInstances.Console].instance = null;
  viewInstances[ViewInstances.Console].appendedTo = null;
  viewInstanceStateMaps[ViewInstances.Editor].clear();
  viewInstanceStateMaps[ViewInstances.Editor2].clear();
  viewInstanceStateMaps[ViewInstances.Console].clear();
});

// ---------------------------------------------------------------------------
// linkSplitEditors
// ---------------------------------------------------------------------------

describe('linkSplitEditors', () => {
  it('does nothing when the primary editor instance is null', () => {
    const editor2 = makeMockEditorInstance();
    viewInstances[ViewInstances.Editor2].instance =
      editor2 as unknown as typeof viewInstances[ViewInstances.Editor2]['instance'];

    linkSplitEditors();

    expect(editor2.dispatch).not.toHaveBeenCalled();
  });

  it('does nothing when the split editor instance is null', () => {
    const editor1 = makeMockEditorInstance();
    viewInstances[ViewInstances.Editor].instance =
      editor1 as unknown as typeof viewInstances[ViewInstances.Editor]['instance'];

    linkSplitEditors();

    expect(editor1.dispatch).not.toHaveBeenCalled();
  });

  it('dispatches a reconfigure effect to both instances when both are present', () => {
    const editor1 = makeMockEditorInstance();
    const editor2 = makeMockEditorInstance();

    viewInstances[ViewInstances.Editor].instance =
      editor1 as unknown as typeof viewInstances[ViewInstances.Editor]['instance'];
    viewInstances[ViewInstances.Editor2].instance =
      editor2 as unknown as typeof viewInstances[ViewInstances.Editor2]['instance'];

    linkSplitEditors();

    expect(editor1.dispatch).toHaveBeenCalledTimes(1);
    expect(editor2.dispatch).toHaveBeenCalledTimes(1);

    // Each dispatch call should carry a StateEffect inside `effects`
    const [editor1Call] = editor1.dispatch.mock.calls;
    expect(editor1Call[0]).toHaveProperty('effects');

    const [editor2Call] = editor2.dispatch.mock.calls;
    expect(editor2Call[0]).toHaveProperty('effects');
  });
});

// ---------------------------------------------------------------------------
// unlinkSplitEditors
// ---------------------------------------------------------------------------

describe('unlinkSplitEditors', () => {
  it('does not throw when both instances are null', () => {
    expect(() => unlinkSplitEditors()).not.toThrow();
  });

  it('dispatches a reconfigure([]) effect on both instances when they exist', () => {
    const editor1 = makeMockEditorInstance();
    const editor2 = makeMockEditorInstance();

    viewInstances[ViewInstances.Editor].instance =
      editor1 as unknown as typeof viewInstances[ViewInstances.Editor]['instance'];
    viewInstances[ViewInstances.Editor2].instance =
      editor2 as unknown as typeof viewInstances[ViewInstances.Editor2]['instance'];

    unlinkSplitEditors();

    expect(editor1.dispatch).toHaveBeenCalledTimes(1);
    expect(editor2.dispatch).toHaveBeenCalledTimes(1);
  });

  it('still runs on the remaining instance when only one is present', () => {
    const editor1 = makeMockEditorInstance();
    viewInstances[ViewInstances.Editor].instance =
      editor1 as unknown as typeof viewInstances[ViewInstances.Editor]['instance'];

    expect(() => unlinkSplitEditors()).not.toThrow();
    // editor1 should still receive the reconfigure dispatch
    expect(editor1.dispatch).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// useCodeMirrorInstanceCleanup — Editor2 (split pane)
// ---------------------------------------------------------------------------

describe('useCodeMirrorInstanceCleanup — Editor2', () => {
  it('calls unlinkSplitEditors (dispatches to Editor) before destroying Editor2', () => {
    const callOrder: string[] = [];

    const editor1 = {
      ...makeMockEditorInstance(),
      dispatch: vi.fn(() => callOrder.push('editor1-dispatch')),
    };
    const editor2 = {
      ...makeMockEditorInstance(),
      dispatch: vi.fn(() => callOrder.push('editor2-dispatch')),
      destroy: vi.fn(() => callOrder.push('editor2-destroy')),
    };

    viewInstances[ViewInstances.Editor].instance =
      editor1 as unknown as typeof viewInstances[ViewInstances.Editor]['instance'];
    viewInstances[ViewInstances.Editor2].instance =
      editor2 as unknown as typeof viewInstances[ViewInstances.Editor2]['instance'];

    const { unmount } = renderHook(() =>
      useCodeMirrorInstanceCleanup(ViewInstances.Editor2),
    );

    unmount();

    const firstDispatchIdx = callOrder.findIndex((e) => e.includes('dispatch'));
    const destroyIdx = callOrder.indexOf('editor2-destroy');

    expect(firstDispatchIdx).toBeGreaterThanOrEqual(0);
    expect(destroyIdx).toBeGreaterThan(firstDispatchIdx);
  });

  it('destroys the Editor2 instance on unmount', () => {
    const editor2 = makeMockEditorInstance();
    viewInstances[ViewInstances.Editor2].instance =
      editor2 as unknown as typeof viewInstances[ViewInstances.Editor2]['instance'];

    const { unmount } = renderHook(() =>
      useCodeMirrorInstanceCleanup(ViewInstances.Editor2),
    );

    unmount();

    expect(editor2.destroy).toHaveBeenCalledTimes(1);
  });

  it('sets viewInstances[Editor2].instance to null after destroy', () => {
    const editor2 = makeMockEditorInstance();
    viewInstances[ViewInstances.Editor2].instance =
      editor2 as unknown as typeof viewInstances[ViewInstances.Editor2]['instance'];

    const { unmount } = renderHook(() =>
      useCodeMirrorInstanceCleanup(ViewInstances.Editor2),
    );

    unmount();

    expect(viewInstances[ViewInstances.Editor2].instance).toBeNull();
  });

  it('sets viewInstances[Editor2].appendedTo to null on unmount', () => {
    const editor2 = makeMockEditorInstance();
    const container = document.createElement('div');

    viewInstances[ViewInstances.Editor2].instance =
      editor2 as unknown as typeof viewInstances[ViewInstances.Editor2]['instance'];
    viewInstances[ViewInstances.Editor2].appendedTo = container;

    const { unmount } = renderHook(() =>
      useCodeMirrorInstanceCleanup(ViewInstances.Editor2),
    );

    unmount();

    expect(viewInstances[ViewInstances.Editor2].appendedTo).toBeNull();
  });

  it('does not throw when the Editor2 instance is already null on unmount', () => {
    // instance remains null; only appendedTo is set
    viewInstances[ViewInstances.Editor2].appendedTo =
      document.createElement('div');

    const { unmount } = renderHook(() =>
      useCodeMirrorInstanceCleanup(ViewInstances.Editor2),
    );

    expect(() => unmount()).not.toThrow();
    expect(viewInstances[ViewInstances.Editor2].appendedTo).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// useCodeMirrorInstanceCleanup — primary Editor (left pane)
// ---------------------------------------------------------------------------

describe('useCodeMirrorInstanceCleanup — primary Editor', () => {
  it('does NOT destroy the Editor instance on unmount (instance is reused across tabs)', () => {
    const editor = makeMockEditorInstance();
    viewInstances[ViewInstances.Editor].instance =
      editor as unknown as typeof viewInstances[ViewInstances.Editor]['instance'];

    const { unmount } = renderHook(() =>
      useCodeMirrorInstanceCleanup(ViewInstances.Editor),
    );

    unmount();

    expect(editor.destroy).not.toHaveBeenCalled();
    // Instance reference is NOT set to null for the primary Editor
    expect(viewInstances[ViewInstances.Editor].instance).not.toBeNull();
  });

  it('sets appendedTo to null on unmount', () => {
    const editor = makeMockEditorInstance();
    const container = document.createElement('div');

    viewInstances[ViewInstances.Editor].instance =
      editor as unknown as typeof viewInstances[ViewInstances.Editor]['instance'];
    viewInstances[ViewInstances.Editor].appendedTo = container;

    const { unmount } = renderHook(() =>
      useCodeMirrorInstanceCleanup(ViewInstances.Editor),
    );

    unmount();

    expect(viewInstances[ViewInstances.Editor].appendedTo).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// useCodeMirrorInstanceCleanup — Console
// ---------------------------------------------------------------------------

describe('useCodeMirrorInstanceCleanup — Console', () => {
  it('destroys the Console instance on unmount (same behaviour as Editor2)', () => {
    const consoleMock = makeMockEditorInstance();
    viewInstances[ViewInstances.Console].instance =
      consoleMock as unknown as typeof viewInstances[ViewInstances.Console]['instance'];

    const { unmount } = renderHook(() =>
      useCodeMirrorInstanceCleanup(ViewInstances.Console),
    );

    unmount();

    expect(consoleMock.destroy).toHaveBeenCalledTimes(1);
    expect(viewInstances[ViewInstances.Console].instance).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// useCodeMirrorStateCleanup
// ---------------------------------------------------------------------------

describe('useCodeMirrorStateCleanup', () => {
  it('removes entries whose IDs are not in valueInstanceIds', () => {
    const map = viewInstanceStateMaps[ViewInstances.Editor2];
    map.set('stale-id-1', {} as never);
    map.set('valid-id', {} as never);
    map.set('stale-id-2', {} as never);

    const validIds = ['valid-id'];
    renderHook(() =>
      useCodeMirrorStateCleanup(ViewInstances.Editor2, validIds),
    );

    expect(map.has('stale-id-1')).toBe(false);
    expect(map.has('stale-id-2')).toBe(false);
  });

  it('retains entries whose IDs are still in valueInstanceIds', () => {
    const map = viewInstanceStateMaps[ViewInstances.Editor2];
    map.set('id-a', {} as never);
    map.set('id-b', {} as never);

    const validIds = ['id-a', 'id-b'];
    renderHook(() =>
      useCodeMirrorStateCleanup(ViewInstances.Editor2, validIds),
    );

    expect(map.has('id-a')).toBe(true);
    expect(map.has('id-b')).toBe(true);
  });

  it('clears all entries when valueInstanceIds is empty', () => {
    const map = viewInstanceStateMaps[ViewInstances.Editor2];
    map.set('id-1', {} as never);
    map.set('id-2', {} as never);
    map.set('id-3', {} as never);

    renderHook(() => useCodeMirrorStateCleanup(ViewInstances.Editor2, []));

    expect(map.size).toBe(0);
  });

  it('operates independently on different ViewInstances without cross-contamination', () => {
    const editorMap = viewInstanceStateMaps[ViewInstances.Editor];
    const editor2Map = viewInstanceStateMaps[ViewInstances.Editor2];

    editorMap.set('shared-id', {} as never);
    editor2Map.set('shared-id', {} as never);

    // Clean only Editor2 entries
    renderHook(() => useCodeMirrorStateCleanup(ViewInstances.Editor2, []));

    // Editor map should be untouched
    expect(editorMap.has('shared-id')).toBe(true);
    expect(editor2Map.has('shared-id')).toBe(false);
  });

  it('re-runs the cleanup when valueInstanceIds reference changes', () => {
    const map = viewInstanceStateMaps[ViewInstances.Editor2];
    map.set('id-1', {} as never);
    map.set('id-2', {} as never);

    const { rerender } = renderHook(
      (ids: string[]) => useCodeMirrorStateCleanup(ViewInstances.Editor2, ids),
      { initialProps: ['id-1', 'id-2'] },
    );

    expect(map.size).toBe(2);

    // Remove id-2 from valid set
    map.set('id-2', {} as never); // re-add to check it gets cleaned
    rerender(['id-1']);

    expect(map.has('id-1')).toBe(true);
    expect(map.has('id-2')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// clearEditorStateCaches
// ---------------------------------------------------------------------------

describe('clearEditorStateCaches', () => {
  it('drops all cached states for both editor panes', () => {
    viewInstanceStateMaps[ViewInstances.Editor].set('file-1', {} as never);
    viewInstanceStateMaps[ViewInstances.Editor2].set('file-2', {} as never);

    clearEditorStateCaches();

    expect(viewInstanceStateMaps[ViewInstances.Editor].size).toBe(0);
    expect(viewInstanceStateMaps[ViewInstances.Editor2].size).toBe(0);
  });

  it('leaves the Console state map untouched', () => {
    viewInstanceStateMaps[ViewInstances.Console].set('console-1', {} as never);

    clearEditorStateCaches();

    expect(viewInstanceStateMaps[ViewInstances.Console].has('console-1')).toBe(
      true,
    );
  });
});
