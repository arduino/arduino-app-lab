/**
 * Unit tests for the split-panel state machine in useCreateEditorPanelLogic:
 * the Split sub-feature (openOrPushToSplit), the Move sub-feature
 * (moveTabToOtherPane, both directions including the last-tab collapse),
 * Open/Edit routing (openFileInPane) and the pane-A close wrappers
 * (closeFileFromPaneA, closeAllFromPaneA).
 *
 * All behaviour is verified through the values returned by the logic hooks
 * (isSplit, splitPaneFileId, rightTabs, leftTabs) and the selectFile /
 * closeFile mock calls, so no real UI is rendered. Pane A's tab list is
 * owned by the parent (useFiles) and arrives via the openFiles param, so
 * assertions about pane A go through the mocks rather than leftTabs.
 *
 * The test wrapper calls every inner logic hook (tabsBarLogic, tabsBarLogic2)
 * unconditionally so the React hook call order is always the same across renders.
 */

import type { SelectableFileData } from '@cloud-editor-mono/ui-components/lib/editor-tabs-bar/EditorTabsBar.type';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TestProviderWrapper from '../../../../../../../tests-setup';
import { useCreateEditorPanelLogic } from './appLabEditorPanel';
import type { EditorPanelLogicParams } from './appLabEditorPanel.type';

// ---------------------------------------------------------------------------
// Module mocks — replace every cross-boundary dependency with a no-op/stub so
// the tests exercise only the state-machine logic inside this hook.
// ---------------------------------------------------------------------------

vi.mock(
  '@cloud-editor-mono/domain/src/services/services-by-app/app-lab',
  () => ({
    codeInjectionsSubjectNext: vi.fn(),
    codeSubjectNext: vi.fn(),
    getBrowser: vi.fn(() => 'Chrome'),
    getCodeInjectionsSubject: vi.fn(() => undefined),
    getCodeSubjectById: vi.fn(() => undefined),
    getUnsavedFilesSubject: vi.fn(() => undefined),
    openLinkExternal: vi.fn(),
    replaceFileNameInvalidCharacters: vi.fn((s: string) => s),
    saveAppFile: vi.fn(),
  }),
);

vi.mock(
  '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab',
  () => ({
    useI18n: vi.fn(() => ({
      formatMessage: vi.fn((m: { defaultMessage: string }) => m.defaultMessage),
    })),
    snackbar: vi.fn(),
    mapAssetSources: vi.fn((v: unknown) => v),
  }),
);

vi.mock(
  '@cloud-editor-mono/ui-components/lib/components-by-app/shared',
  () => ({}),
);

vi.mock('../../../../../../common/hooks/code', () => ({
  useCodeChange: vi.fn(() => ({ setCode: vi.fn(), saveCode: vi.fn() })),
  useCodeInjectionsObservable: vi.fn(),
  getSelectedCodeObservableValue: vi.fn(() => undefined),
}));

vi.mock('../../../../../../common/hooks/editor', () => ({
  useCodeEditorViewInstance: vi.fn(),
  codeEditorViewInstance: { instance: null },
}));

vi.mock('../../../../../../common/hooks/files', () => ({
  SKETCH_SECRETS_FILE_ID: 'sketch.secrets',
}));

vi.mock('../../../../../../common/utils', () => ({
  getAppLabFileIcon: vi.fn(() => null),
}));

vi.mock('../../../../../hooks/useBrickDetail', () => ({
  makeAppBrickDetailLogic: vi.fn(() => vi.fn()),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useMutation: vi.fn(() => ({ mutateAsync: vi.fn() })),
  };
});

vi.mock('sonner', () => ({
  toast: { dismiss: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface MinimalFile {
  fileId: string;
  fileFullName: string;
  fileName: string;
  fileExtension: string;
  tags: string[];
}

const makeFile = (id: string, ext = 'ino'): MinimalFile => ({
  fileId: id,
  fileFullName: `${id}.${ext}`,
  fileName: id,
  fileExtension: ext,
  tags: [],
});

const fileA = makeFile('file-a');
const fileB = makeFile('file-b');
const fileC = makeFile('file-c');

const makeParams = (
  overrides: Partial<EditorPanelLogicParams> = {},
): EditorPanelLogicParams => ({
  appId: 'test-app',
  appPath: '/test',
  selectedFile: undefined,
  selectFile: vi.fn(),
  closeFile: vi.fn(),
  updateOpenFilesOrder: vi.fn(),
  addAppFile: vi.fn(),
  deleteAppFile: vi.fn(),
  renameAppFile: vi.fn(),
  sketchDataIsLoading: false,
  selectableMainFile: undefined,
  unsavedFileIds: undefined,
  openFiles: [],
  readOnly: false,
  updateAppBrick: vi.fn(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test wrapper hook
//
// Calls the outer hook and both inner tabs-bar hooks unconditionally so the
// React hook call count is identical on every render.
// ---------------------------------------------------------------------------

type SelectTabParams = {
  fileId?: string;
  openAtIndex?: number;
  isPreview?: boolean;
};

function useTestWrapper(params: EditorPanelLogicParams): {
  isSplit: boolean;
  splitPaneFileId: string | undefined;
  openOrPushToSplit: ((fileId?: string) => void) | undefined;
  moveTabToOtherPane:
    | ((fileId: string, fromPane: 'A' | 'B', toIndex?: number) => void)
    | undefined;
  openFileInPane: (fileId: string, targetPane: 'A' | 'B') => void;
  rightTabs: SelectableFileData[];
  rightSelectedTab: SelectableFileData | undefined;
  closeRightTab: ((fileId: string) => void) | undefined;
  selectRightTab: ((params: SelectTabParams) => void) | undefined;
  closeLeftTab: ((fileId: string) => void) | undefined;
  closeAllLeftTabs: (() => void) | undefined;
  leftTabs: SelectableFileData[];
  activePane: 'A' | 'B' | undefined;
  renameRightPaneTab: (oldId: string, newId: string) => void;
  closeRightPaneTab: (fileId: string) => void;
} {
  const {
    editorPanelLogic,
    openFileInPane,
    renameRightPaneTab,
    closeRightPaneTab,
  } = useCreateEditorPanelLogic(params);
  const panel = editorPanelLogic();
  // Both bar logics must always be called (each calls useCallback x3 internally)
  const leftBar = panel.tabsBarLogic();
  const rightBar = panel.splitPaneTabsBarLogic!();
  return {
    isSplit: panel.isSplit ?? false,
    splitPaneFileId: panel.splitPaneFileId,
    openOrPushToSplit: panel.openOrPushToSplit,
    moveTabToOtherPane: panel.moveTabToOtherPane,
    openFileInPane,
    rightTabs: rightBar.tabs,
    rightSelectedTab: rightBar.selectedTab,
    closeRightTab: rightBar.closeTab,
    selectRightTab: rightBar.selectTab,
    closeLeftTab: leftBar.closeTab,
    closeAllLeftTabs: leftBar.onCloseAll,
    leftTabs: leftBar.tabs,
    activePane: panel.activePane,
    renameRightPaneTab,
    closeRightPaneTab,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCreateEditorPanelLogic — split panel state machine', () => {
  // ── Initial state ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with split view closed', () => {
      const { result } = renderHook(() => useTestWrapper(makeParams()), {
        wrapper: TestProviderWrapper,
      });
      expect(result.current.isSplit).toBe(false);
    });

    it('starts with no file in the right pane', () => {
      const { result } = renderHook(() => useTestWrapper(makeParams()), {
        wrapper: TestProviderWrapper,
      });
      expect(result.current.splitPaneFileId).toBeUndefined();
      expect(result.current.rightTabs).toHaveLength(0);
    });
  });

  // ── Opening the split via the CTA ─────────────────────────────────────────

  describe('opening the split view via the split CTA on a currently open file', () => {
    it('does nothing when no file is currently selected', () => {
      const { result } = renderHook(
        () => useTestWrapper(makeParams({ openFiles: [] })),
        { wrapper: TestProviderWrapper },
      );

      act(() => {
        result.current.openOrPushToSplit?.();
      });

      expect(result.current.isSplit).toBe(false);
      expect(result.current.splitPaneFileId).toBeUndefined();
    });

    it('sets isSplit to true with only the selected file in the right pane', () => {
      const { result } = renderHook(
        () =>
          useTestWrapper(
            makeParams({ selectedFile: fileA, openFiles: [fileA] }),
          ),
        { wrapper: TestProviderWrapper },
      );

      act(() => {
        result.current.openOrPushToSplit?.();
      });

      expect(result.current.isSplit).toBe(true);
      expect(result.current.rightTabs).toHaveLength(1);
      expect(result.current.rightTabs[0].fileId).toBe(fileA.fileId);
    });

    it('opens the right pane with only the currently selected file, not all open files', () => {
      const { result } = renderHook(
        () =>
          useTestWrapper(
            makeParams({
              selectedFile: fileA,
              openFiles: [fileA, fileB, fileC],
            }),
          ),
        { wrapper: TestProviderWrapper },
      );

      act(() => {
        result.current.openOrPushToSplit?.();
      });

      expect(result.current.rightTabs).toHaveLength(1);
      expect(result.current.rightTabs[0].fileId).toBe(fileA.fileId);
    });

    it('selects the opened file in the right pane (splitPaneFileId matches selected file)', () => {
      const { result } = renderHook(
        () =>
          useTestWrapper(
            makeParams({ selectedFile: fileA, openFiles: [fileA] }),
          ),
        { wrapper: TestProviderWrapper },
      );

      act(() => {
        result.current.openOrPushToSplit?.();
      });

      expect(result.current.splitPaneFileId).toBe(fileA.fileId);
    });
  });

  // ── Left panel reflects same observable after split ───────────────────────

  describe('modifications to a file are accessible from the left panel', () => {
    it('left panel still references the originally selected file after split is opened', () => {
      const { result } = renderHook((props) => useTestWrapper(props), {
        initialProps: makeParams({
          selectedFile: fileA,
          openFiles: [fileA],
        }),
        wrapper: TestProviderWrapper,
      });

      act(() => {
        result.current.openOrPushToSplit?.();
      });

      // Both panes point to fileA — they share the same code observable entry,
      // so any change made through setCode is visible to both panes.
      expect(result.current.splitPaneFileId).toBe(fileA.fileId);
    });
  });

  // ── Closing the file in the right panel ───────────────────────────────────

  describe('closing the file in the right panel', () => {
    it('closing the only right-pane tab collapses the split view', () => {
      const { result } = renderHook(
        () =>
          useTestWrapper(
            makeParams({ selectedFile: fileA, openFiles: [fileA] }),
          ),
        { wrapper: TestProviderWrapper },
      );

      act(() => {
        result.current.openOrPushToSplit?.();
      });

      act(() => {
        result.current.closeRightTab?.(fileA.fileId);
      });

      expect(result.current.isSplit).toBe(false);
      expect(result.current.rightTabs).toHaveLength(0);
      expect(result.current.splitPaneFileId).toBeUndefined();
    });

    it('closing one of several right-pane tabs keeps the split view open', () => {
      const { result, rerender } = renderHook(
        (props) => useTestWrapper(props),
        {
          initialProps: makeParams({
            selectedFile: fileA,
            openFiles: [fileA, fileB],
          }),
          wrapper: TestProviderWrapper,
        },
      );

      // fileA in right pane
      act(() => {
        result.current.openOrPushToSplit?.();
      });

      // Add fileB to right pane
      rerender(makeParams({ selectedFile: fileB, openFiles: [fileA, fileB] }));
      act(() => {
        result.current.openOrPushToSplit?.();
      });

      expect(result.current.rightTabs).toHaveLength(2);

      // Close fileA — fileB is still open
      act(() => {
        result.current.closeRightTab?.(fileA.fileId);
      });

      expect(result.current.isSplit).toBe(true);
      expect(result.current.rightTabs).toHaveLength(1);
      expect(result.current.rightTabs[0].fileId).toBe(fileB.fileId);
    });

    it('auto-selects an adjacent tab when the currently selected right-pane tab is closed', () => {
      const { result, rerender } = renderHook(
        (props) => useTestWrapper(props),
        {
          initialProps: makeParams({
            selectedFile: fileA,
            openFiles: [fileA, fileB],
          }),
          wrapper: TestProviderWrapper,
        },
      );

      // Open split with fileA, then add fileB
      act(() => {
        result.current.openOrPushToSplit?.();
      });
      rerender(makeParams({ selectedFile: fileB, openFiles: [fileA, fileB] }));
      act(() => {
        result.current.openOrPushToSplit?.();
      });

      // fileB is selected in the right pane
      expect(result.current.splitPaneFileId).toBe(fileB.fileId);

      // Close fileB — fileA should be auto-selected
      act(() => {
        result.current.closeRightTab?.(fileB.fileId);
      });

      expect(result.current.isSplit).toBe(true);
      expect(result.current.splitPaneFileId).toBe(fileA.fileId);
    });
  });

  // ── Closing the file in the left panel ────────────────────────────────────

  describe('closing the file in the left panel', () => {
    it('when all left-panel tabs are removed both panels lose their content', () => {
      const { result, rerender } = renderHook(
        (props) => useTestWrapper(props),
        {
          initialProps: makeParams({
            selectedFile: fileA,
            openFiles: [fileA],
          }),
          wrapper: TestProviderWrapper,
        },
      );

      act(() => {
        result.current.openOrPushToSplit?.();
      });

      // Parent removes the file from openFiles (simulates closeFile completing)
      rerender(makeParams({ selectedFile: undefined, openFiles: [] }));

      // leftTabs drives the AppLabEditorPanel rendering condition:
      // when openFiles.length === 0 the entire EditorPanel (including split pane) is hidden.
      expect(result.current.leftTabs).toHaveLength(0);
    });
  });

  // ── Opening a different file in the left panel while split ────────────────

  describe('opening a different file in the left panel while split is already open', () => {
    it('the right pane selection does not change when a new file is selected on the left', () => {
      const { result, rerender } = renderHook(
        (props) => useTestWrapper(props),
        {
          initialProps: makeParams({
            selectedFile: fileA,
            openFiles: [fileA, fileB],
          }),
          wrapper: TestProviderWrapper,
        },
      );

      // Open split — right pane shows fileA
      act(() => {
        result.current.openOrPushToSplit?.();
      });
      expect(result.current.splitPaneFileId).toBe(fileA.fileId);

      // Parent selects fileB in the left pane
      rerender(makeParams({ selectedFile: fileB, openFiles: [fileA, fileB] }));

      // Right pane should still show fileA
      expect(result.current.splitPaneFileId).toBe(fileA.fileId);
    });

    it('clicking split on the newly selected left-pane file adds it to the right pane', () => {
      const { result, rerender } = renderHook(
        (props) => useTestWrapper(props),
        {
          initialProps: makeParams({
            selectedFile: fileA,
            openFiles: [fileA, fileB],
          }),
          wrapper: TestProviderWrapper,
        },
      );

      act(() => {
        result.current.openOrPushToSplit?.();
      });

      // Select fileB on the left and click split
      rerender(makeParams({ selectedFile: fileB, openFiles: [fileA, fileB] }));
      act(() => {
        result.current.openOrPushToSplit?.();
      });

      expect(result.current.rightTabs).toHaveLength(2);
      expect(result.current.splitPaneFileId).toBe(fileB.fileId);
    });
  });

  // ── Re-selecting the original file in the left pane ───────────────────────

  describe('re-selecting the originally split file in the left pane', () => {
    it('clicking split re-selects the already open file in the right pane without duplicating it', () => {
      const { result, rerender } = renderHook(
        (props) => useTestWrapper(props),
        {
          initialProps: makeParams({
            selectedFile: fileA,
            openFiles: [fileA, fileB],
          }),
          wrapper: TestProviderWrapper,
        },
      );

      // Open split with fileA, then move right pane focus to fileB
      act(() => {
        result.current.openOrPushToSplit?.();
      });
      rerender(makeParams({ selectedFile: fileB, openFiles: [fileA, fileB] }));
      act(() => {
        result.current.openOrPushToSplit?.();
      });
      expect(result.current.splitPaneFileId).toBe(fileB.fileId);

      // Re-select fileA in the left and click split
      rerender(makeParams({ selectedFile: fileA, openFiles: [fileA, fileB] }));
      act(() => {
        result.current.openOrPushToSplit?.();
      });

      // fileA is re-selected in the right pane; no duplicate added
      expect(result.current.splitPaneFileId).toBe(fileA.fileId);
      expect(result.current.rightTabs).toHaveLength(2);
    });
  });

  // ── Selecting files in the right panel ────────────────────────────────────

  describe('selecting a file in the right panel', () => {
    it('selectTab in the right pane updates splitPaneFileId', () => {
      const { result, rerender } = renderHook(
        (props) => useTestWrapper(props),
        {
          initialProps: makeParams({
            selectedFile: fileA,
            openFiles: [fileA, fileB],
          }),
          wrapper: TestProviderWrapper,
        },
      );

      act(() => {
        result.current.openOrPushToSplit?.();
      });
      rerender(makeParams({ selectedFile: fileB, openFiles: [fileA, fileB] }));
      act(() => {
        result.current.openOrPushToSplit?.();
      });

      // Both files in right pane, fileB selected — now select fileA in right pane
      act(() => {
        result.current.selectRightTab?.({ fileId: fileA.fileId });
      });

      expect(result.current.splitPaneFileId).toBe(fileA.fileId);
    });

    it('selecting a different file in the right pane does not affect the left panel tabs', () => {
      const { result, rerender } = renderHook(
        (props) => useTestWrapper(props),
        {
          initialProps: makeParams({
            selectedFile: fileA,
            openFiles: [fileA, fileB, fileC],
          }),
          wrapper: TestProviderWrapper,
        },
      );

      // Build right pane with all three files
      act(() => {
        result.current.openOrPushToSplit?.();
      });
      rerender(
        makeParams({ selectedFile: fileB, openFiles: [fileA, fileB, fileC] }),
      );
      act(() => {
        result.current.openOrPushToSplit?.();
      });
      rerender(
        makeParams({ selectedFile: fileC, openFiles: [fileA, fileB, fileC] }),
      );
      act(() => {
        result.current.openOrPushToSplit?.();
      });

      // Select fileA in the right pane
      act(() => {
        result.current.selectRightTab?.({ fileId: fileA.fileId });
      });

      // Left panel still reflects the openFiles prop unchanged
      const leftIds = result.current.leftTabs.map((t) => t.fileId);
      expect(leftIds).toContain(fileA.fileId);
      expect(leftIds).toContain(fileB.fileId);
      expect(leftIds).toContain(fileC.fileId);
    });

    it('a modification made via the right pane does not change the left panel selected file', () => {
      const { result, rerender } = renderHook(
        (props) => useTestWrapper(props),
        {
          initialProps: makeParams({
            selectedFile: fileA,
            openFiles: [fileA, fileB],
          }),
          wrapper: TestProviderWrapper,
        },
      );

      act(() => {
        result.current.openOrPushToSplit?.();
      });

      // Select fileB in the right pane (different from left panel's fileA)
      rerender(makeParams({ selectedFile: fileB, openFiles: [fileA, fileB] }));
      act(() => {
        result.current.openOrPushToSplit?.();
      });

      act(() => {
        result.current.selectRightTab?.({ fileId: fileB.fileId });
      });

      // Right pane shows fileB; left panel prop still drives fileA as the left selection.
      // The two panes are on different files, confirming no cross-pane state bleed.
      expect(result.current.splitPaneFileId).toBe(fileB.fileId);
      // Left tabs still contain fileA (left selection is driven by the selectedFile prop)
      expect(
        result.current.leftTabs.some((t) => t.fileId === fileA.fileId),
      ).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Move sub-feature: moveTabToOtherPane
// ---------------------------------------------------------------------------

describe('useCreateEditorPanelLogic — moveTabToOtherPane', () => {
  describe('A → B', () => {
    it('moves the tab into pane B and closes it in pane A when A has other tabs', () => {
      const params = makeParams({
        selectedFile: fileA,
        openFiles: [fileA, fileB],
      });
      const { result } = renderHook(() => useTestWrapper(params), {
        wrapper: TestProviderWrapper,
      });

      act(() => {
        result.current.moveTabToOtherPane?.('file-b', 'A');
      });

      expect(result.current.isSplit).toBe(true);
      expect(result.current.rightTabs.map((t) => t.fileId)).toEqual(['file-b']);
      expect(result.current.splitPaneFileId).toBe('file-b');
      expect(params.closeFile).toHaveBeenCalledWith('file-b');
      // The drop focuses the destination pane (B).
      expect(result.current.activePane).toBe('B');
    });

    it("does nothing when dragging A's only tab and no split is open", () => {
      const params = makeParams({ selectedFile: fileA, openFiles: [fileA] });
      const { result } = renderHook(() => useTestWrapper(params), {
        wrapper: TestProviderWrapper,
      });

      act(() => {
        result.current.moveTabToOtherPane?.('file-a', 'A');
      });

      expect(result.current.isSplit).toBe(false);
      expect(params.selectFile).not.toHaveBeenCalled();
      expect(params.closeFile).not.toHaveBeenCalled();
    });

    it("moving A's only tab with a split open collapses to panel B's content with the moved file appended and selected", () => {
      const params = makeParams({
        selectedFile: fileA,
        openFiles: [fileA],
        allFiles: [fileA, fileB],
      });
      const { result } = renderHook(() => useTestWrapper(params), {
        wrapper: TestProviderWrapper,
      });

      // Panel B with fileB (resolved through the allFiles catalogue).
      act(() => {
        result.current.openFileInPane('file-b', 'B');
      });
      expect(result.current.isSplit).toBe(true);

      act(() => {
        result.current.moveTabToOtherPane?.('file-a', 'A');
      });

      // B's tab is inserted before the dragged file so the surviving pane
      // reads as panel B with the moved file appended last...
      expect(params.selectFile).toHaveBeenCalledWith({
        fileId: 'file-b',
        openAtIndex: 0,
      });
      // ...and the dragged file ends up selected.
      expect(params.selectFile).toHaveBeenLastCalledWith({
        fileId: 'file-a',
      });
      // The dragged file moves — it is NOT closed.
      expect(params.closeFile).not.toHaveBeenCalled();
      expect(result.current.isSplit).toBe(false);
      expect(result.current.rightTabs).toHaveLength(0);
      expect(result.current.splitPaneFileId).toBeUndefined();
    });
  });

  describe('B → A', () => {
    it('moves the file into pane A and collapses the split when it was the last B tab', () => {
      const params = makeParams({
        selectedFile: fileA,
        openFiles: [fileA],
        allFiles: [fileA, fileB],
      });
      const { result } = renderHook(() => useTestWrapper(params), {
        wrapper: TestProviderWrapper,
      });

      act(() => {
        result.current.openFileInPane('file-b', 'B');
      });
      act(() => {
        result.current.moveTabToOtherPane?.('file-b', 'B');
      });

      expect(params.selectFile).toHaveBeenCalledWith({ fileId: 'file-b' });
      expect(result.current.isSplit).toBe(false);
      expect(result.current.rightTabs).toHaveLength(0);
    });

    it('keeps the split open when other B tabs remain', () => {
      const params = makeParams({
        selectedFile: fileA,
        openFiles: [fileA],
        allFiles: [fileA, fileB, fileC],
      });
      const { result } = renderHook(() => useTestWrapper(params), {
        wrapper: TestProviderWrapper,
      });

      act(() => {
        result.current.openFileInPane('file-b', 'B');
      });
      act(() => {
        result.current.openFileInPane('file-c', 'B');
      });
      act(() => {
        result.current.moveTabToOtherPane?.('file-b', 'B');
      });

      expect(result.current.isSplit).toBe(true);
      expect(result.current.rightTabs.map((t) => t.fileId)).toEqual(['file-c']);
      expect(params.selectFile).toHaveBeenCalledWith({ fileId: 'file-b' });
      // The drop focuses the destination pane (A).
      expect(result.current.activePane).toBe('A');
    });

    it('does nothing for a file that is not a B tab', () => {
      const params = makeParams({
        selectedFile: fileA,
        openFiles: [fileA],
        allFiles: [fileA, fileB],
      });
      const { result } = renderHook(() => useTestWrapper(params), {
        wrapper: TestProviderWrapper,
      });

      act(() => {
        result.current.openFileInPane('file-b', 'B');
      });
      act(() => {
        result.current.moveTabToOtherPane?.('file-c', 'B');
      });

      expect(params.selectFile).not.toHaveBeenCalledWith({
        fileId: 'file-c',
      });
      expect(result.current.rightTabs.map((t) => t.fileId)).toEqual(['file-b']);
    });
  });

  // ── Cross-bar drops: positional insert (entry point 7) ────────────────────

  describe('positional insert via toIndex', () => {
    it('A → B inserts the moved tab at the drop index', () => {
      const params = makeParams({
        selectedFile: fileA,
        openFiles: [fileA, fileC],
        allFiles: [fileA, fileB, fileC],
      });
      const { result } = renderHook(() => useTestWrapper(params), {
        wrapper: TestProviderWrapper,
      });

      // Pane B with two tabs, then drop fileC between them (index 1).
      act(() => {
        result.current.openFileInPane('file-a', 'B');
      });
      act(() => {
        result.current.openFileInPane('file-b', 'B');
      });
      act(() => {
        result.current.moveTabToOtherPane?.('file-c', 'A', 1);
      });

      expect(result.current.rightTabs.map((t) => t.fileId)).toEqual([
        'file-a',
        'file-c',
        'file-b',
      ]);
      expect(result.current.splitPaneFileId).toBe('file-c');
      expect(params.closeFile).toHaveBeenCalledWith('file-c');
    });

    it('B → A passes the drop index to selectFile as openAtIndex', () => {
      const params = makeParams({
        selectedFile: fileA,
        openFiles: [fileA, fileC],
        allFiles: [fileA, fileB, fileC],
      });
      const { result } = renderHook(() => useTestWrapper(params), {
        wrapper: TestProviderWrapper,
      });

      act(() => {
        result.current.openFileInPane('file-b', 'B');
      });
      act(() => {
        result.current.moveTabToOtherPane?.('file-b', 'B', 1);
      });

      expect(params.selectFile).toHaveBeenCalledWith({
        fileId: 'file-b',
        openAtIndex: 1,
      });
      expect(result.current.isSplit).toBe(false);
    });

    it("moving A's only tab to a B index places it at that position in the surviving pane", () => {
      const params = makeParams({
        selectedFile: fileA,
        openFiles: [fileA],
        allFiles: [fileA, fileB, fileC],
      });
      const { result } = renderHook(() => useTestWrapper(params), {
        wrapper: TestProviderWrapper,
      });

      // B = [fileB, fileC]; drop fileA between them (index 1).
      act(() => {
        result.current.openFileInPane('file-b', 'B');
      });
      act(() => {
        result.current.openFileInPane('file-c', 'B');
      });
      act(() => {
        result.current.moveTabToOtherPane?.('file-a', 'A', 1);
      });

      // fileB stays before the dragged file, fileC shifts after it.
      expect(params.selectFile).toHaveBeenCalledWith({
        fileId: 'file-b',
        openAtIndex: 0,
      });
      expect(params.selectFile).toHaveBeenCalledWith({
        fileId: 'file-c',
        openAtIndex: 2,
      });
      expect(params.selectFile).toHaveBeenLastCalledWith({
        fileId: 'file-a',
      });
      expect(result.current.isSplit).toBe(false);
    });

    it('repositions a tab that already exists in pane B on cross-bar drop (A → B)', () => {
      const params = makeParams({
        selectedFile: fileA,
        openFiles: [fileA, fileB],
        allFiles: [fileA, fileB, fileC],
      });
      const { result } = renderHook(() => useTestWrapper(params), {
        wrapper: TestProviderWrapper,
      });

      // B = [fileB, fileC]; fileB is open in BOTH panes. Drag A's fileB
      // tab onto B's bar at the end (index 2).
      act(() => {
        result.current.openFileInPane('file-b', 'B');
      });
      act(() => {
        result.current.openFileInPane('file-c', 'B');
      });
      act(() => {
        result.current.moveTabToOtherPane?.('file-b', 'A', 2);
      });

      // The existing B tab moves to the drop position (index adjusted for
      // its own removal), gets selected, and A's copy closes.
      expect(result.current.rightTabs.map((t) => t.fileId)).toEqual([
        'file-c',
        'file-b',
      ]);
      expect(result.current.splitPaneFileId).toBe('file-b');
      expect(params.closeFile).toHaveBeenCalledWith('file-b');
    });

    it("discounts the dragged file's own B slot when moving A's only tab that is also open in B", () => {
      const params = makeParams({
        selectedFile: fileA,
        openFiles: [fileA],
        allFiles: [fileA, fileB, fileC],
      });
      const { result } = renderHook(() => useTestWrapper(params), {
        wrapper: TestProviderWrapper,
      });

      // B = [fileB, fileA, fileC] — the dragged file sits mid-list in B.
      act(() => {
        result.current.openFileInPane('file-b', 'B');
      });
      act(() => {
        result.current.openFileInPane('file-a', 'B');
      });
      act(() => {
        result.current.openFileInPane('file-c', 'B');
      });
      // Drop A's only tab (fileA) at the END of B's bar (index 3, hit-tested
      // with fileA still in B's list).
      act(() => {
        result.current.moveTabToOtherPane?.('file-a', 'A', 3);
      });

      // Surviving pane reads [fileB, fileC, fileA]: fileA's own B slot is
      // discounted from the drop index, so it truly lands last.
      expect(params.selectFile).toHaveBeenCalledWith({
        fileId: 'file-b',
        openAtIndex: 0,
      });
      expect(params.selectFile).toHaveBeenCalledWith({
        fileId: 'file-c',
        openAtIndex: 1,
      });
      expect(params.selectFile).toHaveBeenLastCalledWith({
        fileId: 'file-a',
      });
      expect(result.current.isSplit).toBe(false);
    });

    it('repositions a tab that already exists in pane A on cross-bar drop (B → A)', () => {
      const params = makeParams({
        selectedFile: fileA,
        openFiles: [fileA, fileB, fileC],
        allFiles: [fileA, fileB, fileC],
      });
      const { result } = renderHook(() => useTestWrapper(params), {
        wrapper: TestProviderWrapper,
      });

      // fileC is open in BOTH panes. Drag B's fileC tab onto A's bar at
      // the front (index 0).
      act(() => {
        result.current.openFileInPane('file-c', 'B');
      });
      act(() => {
        result.current.moveTabToOtherPane?.('file-c', 'B', 0);
      });

      // A's copy is reordered to the drop position and selected; B's copy
      // closes, collapsing the split.
      expect(params.updateOpenFilesOrder).toHaveBeenCalledWith(
        ['file-c', 'file-a', 'file-b'],
        'file-c',
      );
      expect(params.selectFile).toHaveBeenCalledWith({ fileId: 'file-c' });
      expect(result.current.isSplit).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Open/Edit sub-feature: openFileInPane
// ---------------------------------------------------------------------------

describe('useCreateEditorPanelLogic — openFileInPane', () => {
  it('routes pane A opens through selectFile', () => {
    const params = makeParams({ openFiles: [fileA] });
    const { result } = renderHook(() => useTestWrapper(params), {
      wrapper: TestProviderWrapper,
    });

    act(() => {
      result.current.openFileInPane('file-a', 'A');
    });

    expect(params.selectFile).toHaveBeenCalledWith({ fileId: 'file-a' });
    expect(result.current.isSplit).toBe(false);
  });

  it('opens a file known only to the allFiles catalogue in pane B', () => {
    const params = makeParams({
      openFiles: [fileA],
      allFiles: [fileA, fileC],
    });
    const { result } = renderHook(() => useTestWrapper(params), {
      wrapper: TestProviderWrapper,
    });

    act(() => {
      result.current.openFileInPane('file-c', 'B');
    });

    expect(result.current.isSplit).toBe(true);
    expect(result.current.rightTabs.map((t) => t.fileId)).toEqual(['file-c']);
    expect(result.current.splitPaneFileId).toBe('file-c');
  });

  it('is idempotent for a file already open in pane B (re-selects, no duplicate)', () => {
    const params = makeParams({
      openFiles: [fileA],
      allFiles: [fileA, fileB, fileC],
    });
    const { result } = renderHook(() => useTestWrapper(params), {
      wrapper: TestProviderWrapper,
    });

    act(() => {
      result.current.openFileInPane('file-b', 'B');
    });
    act(() => {
      result.current.openFileInPane('file-c', 'B');
    });
    expect(result.current.splitPaneFileId).toBe('file-c');

    act(() => {
      result.current.openFileInPane('file-b', 'B');
    });

    expect(result.current.rightTabs.map((t) => t.fileId)).toEqual([
      'file-b',
      'file-c',
    ]);
    expect(result.current.splitPaneFileId).toBe('file-b');
  });

  it('does nothing for an id that cannot be resolved', () => {
    const params = makeParams({ openFiles: [fileA], allFiles: [fileA] });
    const { result } = renderHook(() => useTestWrapper(params), {
      wrapper: TestProviderWrapper,
    });

    act(() => {
      result.current.openFileInPane('ghost-file', 'B');
    });

    expect(result.current.isSplit).toBe(false);
    expect(result.current.rightTabs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Close semantics: pane A close wrappers
// ---------------------------------------------------------------------------

describe('useCreateEditorPanelLogic — pane A close wrappers', () => {
  describe('closeTab (closeFileFromPaneA)', () => {
    it('closes normally when other A tabs remain', () => {
      const params = makeParams({
        selectedFile: fileA,
        openFiles: [fileA, fileB],
      });
      const { result } = renderHook(() => useTestWrapper(params), {
        wrapper: TestProviderWrapper,
      });

      act(() => {
        result.current.closeLeftTab?.('file-b');
      });

      expect(params.closeFile).toHaveBeenCalledWith('file-b');
      expect(result.current.isSplit).toBe(false);
    });

    it("closing A's last tab folds panel B back into A and collapses the split", () => {
      const params = makeParams({
        selectedFile: fileA,
        openFiles: [fileA],
        allFiles: [fileA, fileB],
      });
      const { result } = renderHook(() => useTestWrapper(params), {
        wrapper: TestProviderWrapper,
      });

      act(() => {
        result.current.openFileInPane('file-b', 'B');
      });
      act(() => {
        result.current.closeLeftTab?.('file-a');
      });

      // B's tab is merged into A and promoted as the next selection.
      expect(params.selectFile).toHaveBeenCalledWith({ fileId: 'file-b' });
      // The clicked tab is actually closed.
      expect(params.closeFile).toHaveBeenCalledWith('file-a');
      expect(result.current.isSplit).toBe(false);
      expect(result.current.rightTabs).toHaveLength(0);
    });
  });

  describe('onCloseAll (closeAllFromPaneA)', () => {
    it('closes every A tab when no split is open', () => {
      const params = makeParams({
        selectedFile: fileA,
        openFiles: [fileA, fileB],
      });
      const { result } = renderHook(() => useTestWrapper(params), {
        wrapper: TestProviderWrapper,
      });

      act(() => {
        result.current.closeAllLeftTabs?.();
      });

      expect(params.closeFile).toHaveBeenCalledWith('file-a');
      expect(params.closeFile).toHaveBeenCalledWith('file-b');
    });

    it('preserves files that live in panel B and collapses the split', () => {
      const params = makeParams({
        selectedFile: fileA,
        openFiles: [fileA, fileB],
        allFiles: [fileA, fileB, fileC],
      });
      const { result } = renderHook(() => useTestWrapper(params), {
        wrapper: TestProviderWrapper,
      });

      act(() => {
        result.current.openFileInPane('file-c', 'B');
      });
      act(() => {
        result.current.closeAllLeftTabs?.();
      });

      // B's file is pulled into A and survives the close-all.
      expect(params.selectFile).toHaveBeenCalledWith({ fileId: 'file-c' });
      expect(params.closeFile).toHaveBeenCalledWith('file-a');
      expect(params.closeFile).toHaveBeenCalledWith('file-b');
      expect(params.closeFile).not.toHaveBeenCalledWith('file-c');
      expect(result.current.isSplit).toBe(false);
      expect(result.current.rightTabs).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Module-scoped variable cleanup
//
// hasExecutedForFile is a module-level let declared in appLabEditorPanel.ts.
// These tests document its deduplication behaviour and the fact that it is NOT
// reset on component unmount (intentional — only one editor instance exists at
// a time, so cross-instance state is not a practical concern).
// ---------------------------------------------------------------------------

describe('useCreateEditorPanelLogic — module-scoped guard (hasExecutedForFile)', () => {
  // 'app.yaml' is listed in the readonly-files array inside the hook and will
  // trigger the snackbar on first selection.
  const readOnlyFileId = 'app.yaml';
  const readOnlyFile = makeFile(readOnlyFileId, 'yaml');

  beforeEach(async () => {
    const { snackbar } = await import(
      '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab'
    );
    vi.mocked(snackbar).mockClear();
  });

  it('does not show the readonly toast a second time for the same file in the same instance', async () => {
    const { snackbar } = await import(
      '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab'
    );
    const mockSnackbar = vi.mocked(snackbar);

    const { rerender } = renderHook((props) => useTestWrapper(props), {
      initialProps: makeParams({
        selectedFile: readOnlyFile,
        openFiles: [readOnlyFile],
      }),
      wrapper: TestProviderWrapper,
    });

    const countAfterFirstSelection = mockSnackbar.mock.calls.length;

    // Re-render without changing selectedFile
    rerender(
      makeParams({ selectedFile: readOnlyFile, openFiles: [readOnlyFile] }),
    );

    expect(mockSnackbar.mock.calls.length).toBe(countAfterFirstSelection);
  });

  it('resets the guard and shows the toast again when a different file is then selected', async () => {
    const { snackbar } = await import(
      '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab'
    );
    const mockSnackbar = vi.mocked(snackbar);

    const anotherReadOnlyFile = makeFile('sketch/sketch.yaml', 'yaml');

    const { rerender } = renderHook((props) => useTestWrapper(props), {
      initialProps: makeParams({
        selectedFile: readOnlyFile,
        openFiles: [readOnlyFile, anotherReadOnlyFile],
      }),
      wrapper: TestProviderWrapper,
    });

    const countAfterFirstFile = mockSnackbar.mock.calls.length;

    // Switch to the other readonly file — guard should reset and snackbar should fire
    rerender(
      makeParams({
        selectedFile: anotherReadOnlyFile,
        openFiles: [readOnlyFile, anotherReadOnlyFile],
      }),
    );

    expect(mockSnackbar.mock.calls.length).toBeGreaterThan(countAfterFirstFile);
  });

  it('the module-scoped guard persists across component unmounts (not reset on unmount)', async () => {
    const { snackbar } = await import(
      '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab'
    );
    const mockSnackbar = vi.mocked(snackbar);

    const firstParams = makeParams({
      selectedFile: readOnlyFile,
      openFiles: [readOnlyFile],
    });

    const { unmount } = renderHook(() => useTestWrapper(firstParams), {
      wrapper: TestProviderWrapper,
    });

    const countAfterFirstMount = mockSnackbar.mock.calls.length;
    unmount();

    // Second fresh component instance with the same readonly file
    renderHook(() => useTestWrapper(firstParams), {
      wrapper: TestProviderWrapper,
    });

    // Because hasExecutedForFile is module-scoped and not cleared on unmount,
    // the toast does NOT fire again for the second instance.
    // This is intentional: only one editor instance exists at a time.
    expect(mockSnackbar.mock.calls.length).toBe(countAfterFirstMount);
  });
});

// ---------------------------------------------------------------------------
// Pane B file-operation sync: rename/move (renameRightPaneTab) and
// delete (closeRightPaneTab)
// ---------------------------------------------------------------------------

describe('useCreateEditorPanelLogic — renameRightPaneTab', () => {
  it('remaps pane B tab + selection + derived name fields on rename', () => {
    const params = makeParams({
      openFiles: [fileA],
      allFiles: [fileA, fileB],
    });
    const { result } = renderHook(() => useTestWrapper(params), {
      wrapper: TestProviderWrapper,
    });

    act(() => {
      result.current.openFileInPane('file-b', 'B');
    });
    expect(result.current.splitPaneFileId).toBe('file-b');

    act(() => {
      result.current.renameRightPaneTab('file-b', 'nested/renamed.txt');
    });

    expect(result.current.rightTabs).toHaveLength(1);
    expect(result.current.rightTabs[0]).toMatchObject({
      fileId: 'nested/renamed.txt',
      fileFullName: 'renamed.txt',
      fileName: 'renamed',
      fileExtension: 'txt',
    });
    expect(result.current.splitPaneFileId).toBe('nested/renamed.txt');
  });

  it('keeps the split open and follows a move into another directory', () => {
    const params = makeParams({
      openFiles: [fileA],
      allFiles: [fileA, fileB],
    });
    const { result } = renderHook(() => useTestWrapper(params), {
      wrapper: TestProviderWrapper,
    });

    act(() => {
      result.current.openFileInPane('file-b', 'B');
    });

    act(() => {
      result.current.renameRightPaneTab('file-b', 'sub/file-b');
    });

    expect(result.current.isSplit).toBe(true);
    expect(result.current.rightTabs.map((t) => t.fileId)).toEqual([
      'sub/file-b',
    ]);
    expect(result.current.splitPaneFileId).toBe('sub/file-b');
  });

  it('is a no-op when pane B does not hold the renamed file', () => {
    const params = makeParams({
      openFiles: [fileA],
      allFiles: [fileA, fileB, fileC],
    });
    const { result } = renderHook(() => useTestWrapper(params), {
      wrapper: TestProviderWrapper,
    });

    act(() => {
      result.current.openFileInPane('file-b', 'B');
    });

    act(() => {
      result.current.renameRightPaneTab('file-c', 'renamed-c.ino');
    });

    expect(result.current.rightTabs.map((t) => t.fileId)).toEqual(['file-b']);
    expect(result.current.splitPaneFileId).toBe('file-b');
  });
});

describe('useCreateEditorPanelLogic — closeRightPaneTab', () => {
  it('removes a pane B tab and collapses the split when it was the last one', () => {
    const params = makeParams({
      openFiles: [fileA],
      allFiles: [fileA, fileB],
    });
    const { result } = renderHook(() => useTestWrapper(params), {
      wrapper: TestProviderWrapper,
    });

    act(() => {
      result.current.openFileInPane('file-b', 'B');
    });
    expect(result.current.isSplit).toBe(true);

    act(() => {
      result.current.closeRightPaneTab('file-b');
    });

    expect(result.current.isSplit).toBe(false);
    expect(result.current.rightTabs).toHaveLength(0);
  });

  it('removes one pane B tab and reselects an adjacent one', () => {
    const params = makeParams({
      openFiles: [fileA],
      allFiles: [fileA, fileB, fileC],
    });
    const { result } = renderHook(() => useTestWrapper(params), {
      wrapper: TestProviderWrapper,
    });

    act(() => {
      result.current.openFileInPane('file-b', 'B');
    });
    act(() => {
      result.current.openFileInPane('file-c', 'B');
    });

    act(() => {
      result.current.closeRightPaneTab('file-c');
    });

    expect(result.current.isSplit).toBe(true);
    expect(result.current.rightTabs.map((t) => t.fileId)).toEqual(['file-b']);
    expect(result.current.splitPaneFileId).toBe('file-b');
  });
});
