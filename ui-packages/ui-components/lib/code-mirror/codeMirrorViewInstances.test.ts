/**
 * Unit tests for the module-level utilities in codeMirrorViewInstances.ts.
 *
 * Coverage:
 *  - linkSplitEditors / unlinkSplitEditors + the split-sync mirroring they gate
 *  - useCodeMirrorInstanceCleanup (memory-leak prevention)
 *  - useCodeMirrorStateCleanup (stale-state pruning)
 *
 * The module uses several singleton maps/objects (viewInstances,
 * viewInstanceStateMaps) plus a private split-sync flag as module-level
 * state.  Each test restores these to a clean baseline in afterEach to
 * prevent inter-test leakage.
 */

import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearEditorStateCaches,
  createSplitSyncExtension,
  linkSplitEditors,
  splitSyncAnnotation,
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

const realViews: EditorView[] = [];

/** Creates a real EditorView carrying the permanent split-sync listener, so
 *  link/unlink tests exercise the same mirroring path the app uses. jsdom
 *  cannot lay a view out, but document/transaction handling — all that
 *  split-sync touches — works. */
function makeRealEditorView(viewId: ViewInstances, doc: string): EditorView {
  const view = new EditorView({
    state: EditorState.create({
      doc,
      extensions: [createSplitSyncExtension(viewId)],
    }),
    parent: document.body,
  });
  realViews.push(view);
  return view;
}

// ---------------------------------------------------------------------------
// Baseline cleanup between tests
// ---------------------------------------------------------------------------

afterEach(() => {
  // Reset the module-private splitSyncEnabled flag; a test that links must
  // not leave mirroring switched on for the next one.
  unlinkSplitEditors();

  while (realViews.length) {
    realViews.pop()?.destroy();
  }

  viewInstances[ViewInstances.Editor].instance = null;
  viewInstances[ViewInstances.Editor].appendedTo = null;
  viewInstances[ViewInstances.Editor].valueInstanceId = undefined;
  viewInstances[ViewInstances.Editor2].instance = null;
  viewInstances[ViewInstances.Editor2].appendedTo = null;
  viewInstances[ViewInstances.Editor2].valueInstanceId = undefined;
  viewInstances[ViewInstances.Console].instance = null;
  viewInstances[ViewInstances.Console].appendedTo = null;
  viewInstances[ViewInstances.Console].valueInstanceId = undefined;
  viewInstanceStateMaps[ViewInstances.Editor].clear();
  viewInstanceStateMaps[ViewInstances.Editor2].clear();
  viewInstanceStateMaps[ViewInstances.Console].clear();
});

// ---------------------------------------------------------------------------
// linkSplitEditors
// ---------------------------------------------------------------------------

describe('linkSplitEditors', () => {
  it('does not seed the peer when the primary editor instance is null', () => {
    const editor2 = makeMockEditorInstance();
    viewInstances[ViewInstances.Editor2].instance =
      editor2 as unknown as typeof viewInstances[ViewInstances.Editor2]['instance'];

    linkSplitEditors();

    expect(editor2.dispatch).not.toHaveBeenCalled();
  });

  it('does not seed the peer when the split editor instance is null', () => {
    const editor1 = makeMockEditorInstance();
    viewInstances[ViewInstances.Editor].instance =
      editor1 as unknown as typeof viewInstances[ViewInstances.Editor]['instance'];

    linkSplitEditors();

    expect(editor1.dispatch).not.toHaveBeenCalled();
  });

  it('seeds the split pane from the primary document when the panes differ', () => {
    const editor1 = makeRealEditorView(ViewInstances.Editor, 'void setup() {}');
    const editor2 = makeRealEditorView(ViewInstances.Editor2, 'stale content');

    viewInstances[ViewInstances.Editor].instance = editor1;
    viewInstances[ViewInstances.Editor2].instance = editor2;

    linkSplitEditors();

    expect(editor2.state.doc.toString()).toBe('void setup() {}');
    // The source pane is authoritative and is never written to.
    expect(editor1.state.doc.toString()).toBe('void setup() {}');
  });

  it('leaves the split pane untouched when both panes already match', () => {
    const editor1 = makeRealEditorView(ViewInstances.Editor, 'same doc');
    const editor2 = makeRealEditorView(ViewInstances.Editor2, 'same doc');

    viewInstances[ViewInstances.Editor].instance = editor1;
    viewInstances[ViewInstances.Editor2].instance = editor2;

    const dispatchSpy = vi.spyOn(editor2, 'dispatch');

    linkSplitEditors();

    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('enables mirroring, so later edits propagate in both directions', () => {
    const editor1 = makeRealEditorView(ViewInstances.Editor, 'ab');
    const editor2 = makeRealEditorView(ViewInstances.Editor2, 'ab');

    viewInstances[ViewInstances.Editor].instance = editor1;
    viewInstances[ViewInstances.Editor2].instance = editor2;

    linkSplitEditors();

    editor1.dispatch({ changes: { from: 2, insert: 'c' } });
    expect(editor2.state.doc.toString()).toBe('abc');

    editor2.dispatch({ changes: { from: 3, insert: 'd' } });
    expect(editor1.state.doc.toString()).toBe('abcd');
  });

  it('re-seeds the peer instead of throwing when the panes have diverged', () => {
    const editor1 = makeRealEditorView(ViewInstances.Editor, 'ab');
    const editor2 = makeRealEditorView(ViewInstances.Editor2, 'ab');

    viewInstances[ViewInstances.Editor].instance = editor1;
    viewInstances[ViewInstances.Editor2].instance = editor2;

    linkSplitEditors();

    // Force divergence behind split-sync's back: a transaction tagged as a
    // sync write is skipped by the listener, so it is not mirrored back.
    editor2.dispatch({
      changes: { from: 0, to: 2, insert: 'a completely different doc' },
      annotations: splitSyncAnnotation.of(true),
    });

    // Now an edit in the primary pane must re-converge the peer rather than
    // applying a change set against the wrong document length.
    editor1.dispatch({ changes: { from: 2, insert: 'c' } });

    expect(editor2.state.doc.toString()).toBe('abc');
  });
});

// ---------------------------------------------------------------------------
// unlinkSplitEditors
// ---------------------------------------------------------------------------

describe('unlinkSplitEditors', () => {
  it('does not throw when both instances are null', () => {
    expect(() => unlinkSplitEditors()).not.toThrow();
  });

  it('stops mirroring subsequent edits in both directions', () => {
    const editor1 = makeRealEditorView(ViewInstances.Editor, 'ab');
    const editor2 = makeRealEditorView(ViewInstances.Editor2, 'ab');

    viewInstances[ViewInstances.Editor].instance = editor1;
    viewInstances[ViewInstances.Editor2].instance = editor2;

    linkSplitEditors();
    unlinkSplitEditors();

    editor1.dispatch({ changes: { from: 2, insert: '1' } });
    expect(editor2.state.doc.toString()).toBe('ab');

    editor2.dispatch({ changes: { from: 2, insert: '2' } });
    expect(editor1.state.doc.toString()).toBe('ab1');
  });

  it('does not dispatch to either pane — it only flips the sync flag', () => {
    // Split-sync is a permanently-installed updateListener gated by a module
    // flag, so unlinking must neither reconfigure nor write to either view.
    const editor1 = makeMockEditorInstance();
    const editor2 = makeMockEditorInstance();

    viewInstances[ViewInstances.Editor].instance =
      editor1 as unknown as typeof viewInstances[ViewInstances.Editor]['instance'];
    viewInstances[ViewInstances.Editor2].instance =
      editor2 as unknown as typeof viewInstances[ViewInstances.Editor2]['instance'];

    unlinkSplitEditors();

    expect(editor1.dispatch).not.toHaveBeenCalled();
    expect(editor2.dispatch).not.toHaveBeenCalled();
  });

  it('does not throw when only one pane is present', () => {
    const editor1 = makeMockEditorInstance();
    viewInstances[ViewInstances.Editor].instance =
      editor1 as unknown as typeof viewInstances[ViewInstances.Editor]['instance'];

    expect(() => unlinkSplitEditors()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// useCodeMirrorInstanceCleanup — Editor2 (split pane)
// ---------------------------------------------------------------------------

describe('useCodeMirrorInstanceCleanup — Editor2', () => {
  it('destroys Editor2 without disabling split-sync, so a remount resumes mirroring', () => {
    // Cleanup deliberately leaves the split-sync flag alone: the flag is owned
    // by the EditorPanel link/unlink effect, and a StrictMode (or skeleton
    // transition) mount → unmount → remount of Editor2 would otherwise
    // switch mirroring off for good.
    const editor1 = makeRealEditorView(ViewInstances.Editor, 'ab');
    const editor2 = makeRealEditorView(ViewInstances.Editor2, 'ab');

    viewInstances[ViewInstances.Editor].instance = editor1;
    viewInstances[ViewInstances.Editor2].instance = editor2;

    linkSplitEditors();

    const { unmount } = renderHook(() =>
      useCodeMirrorInstanceCleanup(ViewInstances.Editor2),
    );

    unmount();

    expect(viewInstances[ViewInstances.Editor2].instance).toBeNull();
    // With no peer mounted, an edit in the primary pane is a no-op, not a throw
    // against the destroyed view.
    expect(() =>
      editor1.dispatch({ changes: { from: 2, insert: 'c' } }),
    ).not.toThrow();

    const remountedEditor2 = makeRealEditorView(ViewInstances.Editor2, 'abc');
    viewInstances[ViewInstances.Editor2].instance = remountedEditor2;

    editor1.dispatch({ changes: { from: 3, insert: 'd' } });

    expect(remountedEditor2.state.doc.toString()).toBe('abcd');
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
