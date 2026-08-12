import {
  codeInjectionsSubjectNext,
  codeSubjectNext,
  getBrowser,
  getCodeInjectionsSubject,
  getCodeReloadSubject,
  getCodeSubjectById,
  getUnsavedFilesSubject,
  openLinkExternal,
  replaceFileNameInvalidCharacters,
  saveAppFile,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import type { SaveCode } from '@cloud-editor-mono/domain/src/services/services-by-app/shared';
import { resolveFileIconComponent } from '@cloud-editor-mono/images/assets/file-icons';
import {
  BRICK_FILE_EXTENSION,
  CodeEditorLogic,
  dismissSnackbar,
  EditorControlsProps,
  EditorPanelLogic,
  mapAssetSources,
  SelectableFileData,
  snackbar,
  TabsBarLogic,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { SecretsEditorLogic } from '@cloud-editor-mono/ui-components/lib/components-by-app/shared';
import { EditorView } from '@codemirror/view';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BehaviorSubject } from 'rxjs';

import {
  getSelectedCodeObservableValue,
  useCodeChange,
  useCodeInjectionsObservable,
} from '../../../../../../common/hooks/code';
import {
  codeEditorViewInstances,
  useCodeEditorViewInstance,
} from '../../../../../../common/hooks/editor';
import { SKETCH_SECRETS_FILE_ID } from '../../../../../../common/hooks/files';
import { UseCreateSketchFromExisting } from '../../../../../../common/hooks/queries/create.type';
import { useObservable } from '../../../../../../common/hooks/useObservable';
import { makeAppBrickDetailLogic } from '../../../../../hooks/useBrickDetail';
import { splitFileName } from '../../hooks/filePaths';
import { resolveNewTabInsertion } from '../../hooks/tabInsertion';
import { usePreviewFileId } from '../../hooks/usePreviewFileId';
import { EditorPanelLogicParams } from './appLabEditorPanel.type';
import { messages } from './messages';

// Tracks whether the code subject for `fileId` has a value yet. Used to
// gate the per-pane editor skeleton: the file's content subject is the
// honest signal for whether the editor has something to render.
function useSubjectHasValue(fileId: string | undefined): boolean {
  const [hasValue, setHasValue] = useState(false);
  useEffect(() => {
    if (!fileId) {
      setHasValue(false);
      return undefined;
    }
    let sub: { unsubscribe: () => void } | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const trySubscribe = (): void => {
      // `getCodeSubjectById` throws when the subject hasn't been created yet
      // (eg. a never-opened file like `sketch/sketch.yaml`). Schedule a
      // retry so we pick the subject up once the underlying file-contents
      // query lands it.
      let subject;
      try {
        subject = getCodeSubjectById(fileId);
      } catch {
        setHasValue(false);
        retryTimer = setTimeout(trySubscribe, 250);
        return;
      }
      if (!(subject instanceof BehaviorSubject)) {
        setHasValue(false);
        retryTimer = setTimeout(trySubscribe, 250);
        return;
      }
      sub = subject.subscribe((v) => {
        setHasValue(v?.value !== undefined);
      });
    };
    trySubscribe();
    return (): void => {
      if (retryTimer) clearTimeout(retryTimer);
      sub?.unsubscribe();
    };
  }, [fileId]);
  return hasValue;
}

function getDataFromFile(
  file?: SelectableFileData,
  appPath?: string,
): () => string | undefined {
  const selectedFileValue = getSelectedCodeObservableValue(
    getCodeSubjectById,
    file?.fileId,
  )?.value;

  if (file?.fileExtension === 'md') {
    return () =>
      mapAssetSources(
        selectedFileValue,
        (path) => '/file-content-assets/' + path,
        appPath,
      );
  }
  return () => selectedFileValue;
}

const READONLY_FILE_IDS = ['app.yaml', 'sketch/sketch.yaml'];

function isReadonlyFile(file?: SelectableFileData): boolean {
  if (!file) return false;
  return (
    file.isMetadataReadOnly === true || READONLY_FILE_IDS.includes(file.fileId)
  );
}

/**
 * Whether to offer the "add an extension for highlighting" hint. True for a
 * file with no extension to infer a language from, so CodeMirror falls back to
 * plain text. Such files save normally — only highlighting is affected.
 *
 * Excluded:
 *  - bricks, which are not files. Their tab meta is synthesised in
 *    `useEditorFileMeta` from the brick's display name, and they render
 *    `BrickDetail` instead of an editor — there is no highlighting to enable
 *    and no filename anyone could add an extension to.
 *  - dotfiles. `.gitignore` and `.env` are named that way by convention, there
 *    is no extension anyone would sensibly add, and nagging is pure noise.
 *
 * Reads the name rather than the meta's `fileExtension`, which comes from the
 * file tree's `path.Ext` and reports `gitignore` for `.gitignore`. That is why
 * bricks need naming explicitly: their `fileExtension` is the marker `'brick'`,
 * but their *name* usually has no dot, so a name-based check alone matches them.
 */
function hasNoExtension(file?: SelectableFileData): boolean {
  if (!file || file.fileExtension === BRICK_FILE_EXTENSION) return false;
  const name = file.fileFullName ?? file.fileId.split('/').pop() ?? '';
  if (!name || name.startsWith('.')) return false;
  return !splitFileName(name).fileExtension;
}

function deriveFileNameFields(fileId: string): {
  fileFullName: string;
  fileName: string;
  fileExtension: string;
} {
  const fileFullName = fileId.split('/').pop() ?? fileId;
  return { fileFullName, ...splitFileName(fileFullName) };
}

function renameSelectableFile(
  file: SelectableFileData,
  newId: string,
): SelectableFileData {
  return { ...file, fileId: newId, ...deriveFileNameFields(newId) };
}

function rekeyMapEntry<T>(
  map: Map<string, T>,
  oldId: string,
  newId: string,
): Map<string, T> {
  if (!map.has(oldId)) return map;
  const next = new Map(map);
  next.set(newId, next.get(oldId) as T);
  next.delete(oldId);
  return next;
}

type LspEditorProps = Pick<
  ReturnType<CodeEditorLogic>,
  | 'filesList'
  | 'isLspEnabled'
  | 'lspWorkspaceDir'
  | 'lspClients'
  | 'selectFile'
  | 'startLSP'
  | 'sendLspMessage'
  | 'subscribeLspMessages'
  | 'getLspWorkspaceFile'
  | 'getActivePane'
  | 'onLspStateChange'
> & {
  // Built here rather than coming from the shared editor logic, because it has
  // to close over this panel's saveCode (see setLspFileValue).
  setLspFileValue?: (fileId: string, value: string) => boolean;
  ensureLspFileValue?: (fileId: string) => Promise<string | undefined>;
};

function buildCodeEditorHook(
  file: SelectableFileData | undefined,
  fileTabs: SelectableFileData[],
  setCodeFn: ReturnType<CodeEditorLogic>['setCode'],
  saveCodeFn: SaveCode,
  sketchDataIsLoading: boolean,
  readOnly: boolean,
  onReceiveViewInstance: (viewInstance: EditorView | null) => void,
  lsp?: LspEditorProps,
): CodeEditorLogic {
  return function useCodeEditorLogic(): ReturnType<CodeEditorLogic> {
    useCodeInjectionsObservable(getCodeInjectionsSubject);
    // Re-render (and let CodeMirror reload the doc) when any open file's buffer
    // is re-fetched in place from disk — e.g. an external change picked up by
    // the file watcher. The event payload (file + cause) is available here for
    // future per-cause UI (e.g. a "changed on disk" hint).
    useObservable(getCodeReloadSubject());

    return {
      setCode: setCodeFn,
      sketchDataIsLoading,
      getCode: () =>
        getSelectedCodeObservableValue(getCodeSubjectById, file?.fileId)?.value,
      getCodeExt: () =>
        getSelectedCodeObservableValue(getCodeSubjectById, file?.fileId)?.meta
          .ext,
      getCodeInstanceId: () =>
        getSelectedCodeObservableValue(getCodeSubjectById, file?.fileId)?.meta
          .instanceId,
      getCodeLastInjectionLine: (): number | undefined => {
        const value = getSelectedCodeObservableValue(
          getCodeSubjectById,
          file?.fileId,
        );
        const lineToScroll = value?.meta.lineToScroll;
        if (value && file?.fileId) {
          codeInjectionsSubjectNext(
            file.fileId,
            value.value,
            { saveCode: saveCodeFn },
            false,
            undefined,
          );
        }
        return lineToScroll;
      },
      getFileId: () => file?.fileId,
      codeInstanceIds: fileTabs
        .map(
          (t) =>
            getSelectedCodeObservableValue(getCodeSubjectById, t.fileId)?.meta
              .instanceId,
        )
        .filter((id): id is string => Boolean(id)),
      onReceiveViewInstance,
      fontSize: 12,
      readOnly: readOnly || isReadonlyFile(file),
      // A standing condition for the whole panel, so it earns the persistent
      // slot. Per-file notices go to the snackbar effect below instead.
      banner: readOnly ? 'read-only' : undefined,
      hasHeader: false,
      hasTabs: true,
      useScrollPastEnd: true,
      gutter: readOnly ? undefined : { lineNumberStartOffset: 0 },
      fileError: file?.error,
      ...lsp,
    };
  };
}

type UseCreateEditorPanelLogic = (params: EditorPanelLogicParams) => {
  editorPanelLogic: EditorPanelLogic;
  /**
   * Open `fileId` in `targetPane`, creating panel B if needed. Returned so
   * the single owner of this hook (`useAppDetailLogic`) can route file-tree
   * and brick drops into the split pane directly.
   */
  openFileInPane: (
    fileId: string,
    targetPane: 'A' | 'B',
    isPreview?: boolean,
  ) => void;
  /**
   * Read the pane the user last interacted with ('A' or 'B'). Used by
   * `setSelectedFile` in `appDetail.logic` to route file-tree clicks into
   * the focused pane. A ref-backed getter so callers always see the
   * latest value without re-rendering.
   */
  getActivePane: () => 'A' | 'B';
  activePane: 'A' | 'B';
  rightPaneSelectedFile: SelectableFileData | undefined;
  rightPaneTabs: SelectableFileData[];
  renameRightPaneTab: (oldId: string, newId: string) => void;
  closeRightPaneTab: (fileId: string) => void;
  /**
   * Pane-A close with the last-tab consolidation (folds pane B's tabs back
   * into A and collapses the split instead of leaving A empty). Exposed so
   * externally-driven closes (the watcher's stream deletes in
   * `closeFileBothPanes`) behave like a user's X-click — a raw `closeFile`
   * that empties pane A blanks the whole editor panel while pane B still
   * silently holds its tabs.
   */
  closeFileFromPaneA: (fileId: string) => void;
  openBrickAiModelsTab: (brickId: string) => void;
};

export const useCreateEditorPanelLogic: UseCreateEditorPanelLogic = function (
  params: EditorPanelLogicParams,
) {
  const {
    appId,
    appPath,
    selectedFile,
    selectFile,
    closeFile,
    updateOpenFilesOrder,
    addAppFile,
    deleteAppFile,
    renameAppFile,
    selectableMainFile,
    unsavedFileIds,
    openFiles: tabs,
    readOnly,
    fetchFile,
    previewFileId,
    allFiles,
    openFilesStore,
    filesContentLoaded,
    storeSplitState,
    filesList,
    isLspEnabled,
    lspWorkspaceDir,
    lspClients,
    startLSP,
    sendLspMessage,
    subscribeLspMessages,
    getLspWorkspaceFile,
    onLspStateChange,
  } = params;

  const [leftPaneMarkdownStateByFileId, setLeftPaneMarkdownStateByFileId] =
    useState<Map<string, boolean>>(new Map());
  const [rightPaneMarkdownStateByFileId, setRightPaneMarkdownStateByFileId] =
    useState<Map<string, boolean>>(new Map());
  const [leftPaneBrickTabStateByFileId, setLeftPaneBrickTabStateByFileId] =
    useState<Map<string, string>>(new Map());
  const [rightPaneBrickTabStateByFileId, setRightPaneBrickTabStateByFileId] =
    useState<Map<string, string>>(new Map());
  const [isSplit, setIsSplit] = useState(false);
  const [rightPaneTabs, setRightPaneTabs] = useState<SelectableFileData[]>([]);
  const [rightPaneSelectedFile, setRightPaneSelectedFile] = useState<
    SelectableFileData | undefined
  >(undefined);

  // Pane B's preview tab — mirrors pane A's `previewFileId` (see
  // `usePreviewFileId`): the one B tab in preview, rendered italic and
  // replaced in place when another file is previewed. The ref lets the
  // tab-mutating callbacks read the latest value without a stale closure.
  const [
    rightPanePreviewFileId,
    setRightPanePreviewFileId,
    rightPanePreviewFileIdRef,
  ] = usePreviewFileId(unsavedFileIds);

  // Mirror of pane A's selection-driven fetch: whenever pane B's selected
  // file changes, make sure its content/subject is loaded. Without this,
  // clicking a B tab whose subject was never instantiated (or was lost in
  // a rekey edge case) leaves the editor stuck reading a missing subject.
  useEffect(() => {
    if (rightPaneSelectedFile?.fileId) {
      void fetchFile?.(rightPaneSelectedFile.fileId);
    }
  }, [fetchFile, rightPaneSelectedFile?.fileId]);

  // Tracks which pane the user last interacted with so file-tree clicks
  // open in the focused pane (defaulting to A). The ref mirrors the state
  // so non-render consumers (eg. `setSelectedFile` in `appDetail.logic`)
  // can read the latest value without a stale closure.
  const [activePane, setActivePane] = useState<'A' | 'B'>('A');
  const activePaneRef = useRef<'A' | 'B'>('A');
  const handleSetActivePane = useCallback((pane: 'A' | 'B') => {
    activePaneRef.current = pane;
    setActivePane(pane);
  }, []);
  const getActivePane = useCallback(() => activePaneRef.current, []);

  const { focusActivePane } = useCodeEditorViewInstance(
    selectFile,
    tabs,
    getActivePane,
  );

  const selectFileAndFocus = useCallback(
    (params: {
      fileId?: string;
      openAtIndex?: number;
      isPreview?: boolean;
    }): void => {
      handleSetActivePane('A');
      selectFile(params);
      focusActivePane();
    },
    [handleSetActivePane, selectFile, focusActivePane],
  );

  const { formatMessage } = useI18n();
  // Files already told about (read-only, or no extension). Lives as long as the
  // panel does: the notice is about the file itself, not about this particular
  // visit to it, so re-opening a file says nothing new.
  const filesWithToastShown = useRef<Set<string>>(new Set());
  // The selection this notice effect last ran for, so unrelated re-renders
  // don't repeat its side effects (notably dismissing toasts). Per-instance so
  // it shares `filesWithToastShown`'s lifetime — as a module-level value it
  // outlived the record, and leaving app detail then re-entering suppressed the
  // notice for whichever file happened to be selected last.
  const handledSelection = useRef<string | undefined>(undefined);

  // Collapsing the split always returns focus to the single remaining
  // pane A, so file-tree clicks resume opening there. Pane B's Editor2 is
  // torn down on collapse, so drop its module-scoped view reference too
  // (the ui-components cleanup only nulls its own map, not ours).
  useEffect(() => {
    if (!isSplit) {
      activePaneRef.current = 'A';
      setActivePane('A');
      codeEditorViewInstances.B = null;
    }
  }, [isSplit]);

  const shouldRenderMarkdown = selectedFile?.fileId
    ? leftPaneMarkdownStateByFileId.get(selectedFile.fileId) ?? true
    : true;

  const setShouldRenderMarkdown = useCallback(
    (value: boolean) => {
      const fileId = selectedFile?.fileId;
      if (!fileId) return;
      setLeftPaneMarkdownStateByFileId((prev) => {
        if (prev.get(fileId) === value) return prev;
        const next = new Map(prev);
        next.set(fileId, value);
        return next;
      });
    },
    [selectedFile?.fileId],
  );

  const rightPaneShouldRenderMarkdown = rightPaneSelectedFile?.fileId
    ? rightPaneMarkdownStateByFileId.get(rightPaneSelectedFile.fileId) ?? true
    : true;

  const setRightPaneShouldRenderMarkdown = useCallback(
    (value: boolean) => {
      const fileId = rightPaneSelectedFile?.fileId;
      if (!fileId) return;
      setRightPaneMarkdownStateByFileId((prev) => {
        if (prev.get(fileId) === value) return prev;
        const next = new Map(prev);
        next.set(fileId, value);
        return next;
      });
    },
    [rightPaneSelectedFile?.fileId],
  );

  const brickSelectedTab = selectedFile?.fileId
    ? leftPaneBrickTabStateByFileId.get(selectedFile.fileId) ?? 'overview'
    : 'overview';

  const setBrickSelectedTab = useCallback(
    (value: string) => {
      const fileId = selectedFile?.fileId;
      if (!fileId) return;
      setLeftPaneBrickTabStateByFileId((prev) => {
        if (prev.get(fileId) === value) return prev;
        const next = new Map(prev);
        next.set(fileId, value);
        return next;
      });
    },
    [selectedFile?.fileId],
  );

  const rightPaneBrickSelectedTab = rightPaneSelectedFile?.fileId
    ? rightPaneBrickTabStateByFileId.get(rightPaneSelectedFile.fileId) ??
      'overview'
    : 'overview';

  const setRightPaneBrickSelectedTab = useCallback(
    (value: string) => {
      const fileId = rightPaneSelectedFile?.fileId;
      if (!fileId) return;
      setRightPaneBrickTabStateByFileId((prev) => {
        if (prev.get(fileId) === value) return prev;
        const next = new Map(prev);
        next.set(fileId, value);
        return next;
      });
    },
    [rightPaneSelectedFile?.fileId],
  );

  const openBrickAiModelsTab = useCallback(
    (brickId: string): void => {
      setLeftPaneBrickTabStateByFileId((prev) => {
        if (prev.get(brickId) === 'aiModels') return prev;
        const next = new Map(prev);
        next.set(brickId, 'aiModels');
        return next;
      });
      selectFile?.({ fileId: brickId });
    },
    [selectFile],
  );

  const hasSetHeightOnHover = useMemo(() => {
    const browser = getBrowser();
    return Boolean(
      browser?.includes('Safari') ||
        browser?.includes('Opera') ||
        browser?.includes('Chrome') ||
        browser?.includes('Edge') ||
        browser?.includes('WebKit'),
    );
  }, []);

  // One-shot hydration of split-view state from the persisted per-app
  // record. Gated on `filesContentLoaded` so we can resolve file ids
  // against the real `allFiles` catalogue (dropping deleted entries from
  // both pane B's tabs and the two markdown maps).
  const splitHydrationComplete = useRef(false);
  useEffect(() => {
    if (splitHydrationComplete.current) return;
    if (!filesContentLoaded) return;
    if (!openFilesStore) return;
    splitHydrationComplete.current = true;

    const allFilesById = new Map<string, SelectableFileData>();
    (allFiles ?? []).forEach((f) => allFilesById.set(f.fileId, f));

    const pruneMarkdownMap = (
      src: Record<string, boolean> | undefined,
    ): Map<string, boolean> => {
      const next = new Map<string, boolean>();
      if (!src) return next;
      for (const [k, v] of Object.entries(src)) {
        if (allFilesById.has(k)) next.set(k, v);
      }
      return next;
    };

    const pruneBrickTabMap = (
      src: Record<string, string> | undefined,
    ): Map<string, string> => {
      const next = new Map<string, string>();
      if (!src) return next;
      for (const [k, v] of Object.entries(src)) {
        if (allFilesById.has(k)) next.set(k, v);
      }
      return next;
    };

    const paneA = openFilesStore.panes?.A;
    // Instantiate the code subject for every restored A-pane file. Without
    // this, only the currently selected file (which is unpended by the
    // `selectedFile` effect in `appDetail.logic`) leaves the skeleton —
    // any other restored tab stays stuck on the loader until the user
    // clicks it. Symmetric with the pane B branch below.
    const paneAItems = paneA?.items ?? openFilesStore.items ?? [];
    paneAItems.forEach((id) => {
      if (allFilesById.has(id)) void fetchFile?.(id);
    });
    if (paneA?.markdownByFileId) {
      setLeftPaneMarkdownStateByFileId(
        pruneMarkdownMap(paneA.markdownByFileId),
      );
    }
    if (paneA?.brickTabByFileId) {
      setLeftPaneBrickTabStateByFileId(
        pruneBrickTabMap(paneA.brickTabByFileId),
      );
    }

    const paneB = openFilesStore.panes?.B;
    if (paneB) {
      const resolvedTabs = paneB.items
        .map((id) => allFilesById.get(id))
        .filter((f): f is SelectableFileData => Boolean(f));
      if (resolvedTabs.length > 0) {
        // Instantiate the code subject for each restored B-pane file.
        // Without this, files that aren't also open in pane A stay on the
        // loading skeleton because their content was never fetched (see
        // `openInPaneB` for the runtime equivalent).
        resolvedTabs.forEach((file) => void fetchFile?.(file.fileId));
        setRightPaneTabs(resolvedTabs);
        const selectedId = paneB.selected;
        const selected =
          (selectedId ? allFilesById.get(selectedId) : undefined) ??
          resolvedTabs[0];
        setRightPaneSelectedFile(selected);
        if (paneB.markdownByFileId) {
          setRightPaneMarkdownStateByFileId(
            pruneMarkdownMap(paneB.markdownByFileId),
          );
        }
        if (paneB.brickTabByFileId) {
          setRightPaneBrickTabStateByFileId(
            pruneBrickTabMap(paneB.brickTabByFileId),
          );
        }
        // Only restore isSplit when pane B has at least one valid file —
        // otherwise we'd render an empty right pane.
        if (openFilesStore.isSplit) {
          setIsSplit(true);
        }
      }
    }
  }, [filesContentLoaded, openFilesStore, allFiles, fetchFile]);

  // Mirror split-view mutations into the persisted store, guarded by the
  // hydration ref so initial hydration doesn't trigger an immediate
  // write-back of stale values. Shallow-patches via `mergeStoreItem` so
  // it never clobbers pane A's `{items, selected}` written by
  // `useFiles.storeOpenFiles`.
  useEffect(() => {
    if (!splitHydrationComplete.current) return;
    if (!storeSplitState) return;
    storeSplitState({
      isSplit,
      panes: {
        A: {
          markdownByFileId: Object.fromEntries(leftPaneMarkdownStateByFileId),
          brickTabByFileId: Object.fromEntries(leftPaneBrickTabStateByFileId),
        },
        B: isSplit
          ? {
              items: rightPaneTabs.map((t) => t.fileId),
              selected: rightPaneSelectedFile?.fileId ?? null,
              markdownByFileId: Object.fromEntries(
                rightPaneMarkdownStateByFileId,
              ),
              brickTabByFileId: Object.fromEntries(
                rightPaneBrickTabStateByFileId,
              ),
            }
          : null,
      },
    });
  }, [
    isSplit,
    rightPaneTabs,
    rightPaneSelectedFile,
    leftPaneMarkdownStateByFileId,
    rightPaneMarkdownStateByFileId,
    leftPaneBrickTabStateByFileId,
    rightPaneBrickTabStateByFileId,
    storeSplitState,
  ]);

  // Persist the user's split-pane width. `EditorPanel` debounces the
  // `onLayout` calls before invoking this so we get one write per
  // drag-pause, not per frame.
  const handleSplitResize = useCallback(
    (leftPanePercent: number) => {
      if (!storeSplitState) return;
      storeSplitState({ splitProportionLeft: leftPanePercent });
    },
    [storeSplitState],
  );

  // One-off notice about the file just opened: it can't be edited, or it will
  // get no syntax highlighting. Both are "heads up" messages rather than
  // standing conditions, so they go to a snackbar — a banner would sit in the
  // editor for as long as the file stayed open.
  //
  // Told once per file per visit to app detail (only for sketches, not
  // examples). Deliberately NOT re-told when the file merely leaves the tab
  // strip: the preview slot removes a tab as soon as another file is previewed,
  // so tying the record to tab presence meant single-clicking through the tree
  // re-announced the same file every time it came back.
  useEffect(() => {
    if (!selectedFile) return;

    const fileId = selectedFile.fileId;

    if (handledSelection.current === fileId) {
      return;
    }
    handledSelection.current = fileId;

    // Read-only wins: not being able to edit at all matters more than not
    // getting colours.
    const notice = isReadonlyFile(selectedFile)
      ? messages.readOnlyAttempt
      : hasNoExtension(selectedFile)
      ? messages.noExtensionHint
      : undefined;

    if (!notice || readOnly || filesWithToastShown.current.has(fileId)) {
      dismissSnackbar();
      return;
    }

    // Dismiss all existing toasts before showing a new one
    dismissSnackbar();

    snackbar({
      message: formatMessage(notice),
      variant: 'info',
      opts: { duration: 3000 },
    });

    filesWithToastShown.current.add(fileId);
  }, [selectedFile, readOnly, formatMessage]);

  const openInPaneB = useCallback(
    (target: SelectableFileData, insertIndex?: number, isPreview = false) => {
      // Ensure the file's content is fetched. Files start in a "pending"
      // state until the user selects them on the left pane (which triggers
      // their code subject to be instantiated); without this call, opening
      // a never-selected file in the right pane would leave the editor
      // stuck on the loading skeleton.
      void fetchFile?.(target.fileId);

      // Seed B's markdown mode from A only on the first split — afterwards
      // the pane's mode is deliberately independent.
      setRightPaneMarkdownStateByFileId((prev) => {
        if (prev.has(target.fileId)) return prev;
        const seed = leftPaneMarkdownStateByFileId.get(target.fileId) ?? true;
        const next = new Map(prev);
        next.set(target.fileId, seed);
        return next;
      });

      const oldPreviewId = rightPanePreviewFileIdRef.current;
      const oldSelectedId = rightPaneSelectedFile?.fileId;

      // Always use the functional updater so multiple synchronous calls
      // (e.g. dragging several files at once onto a closed pane B)
      // accumulate instead of clobbering each other through stale closures.
      setIsSplit(true);
      setRightPaneTabs((prev) => {
        const existingIdx = prev.findIndex((t) => t.fileId === target.fileId);
        if (existingIdx !== -1) {
          // Re-opening an already-open B tab without preview commits it,
          // mirroring pane A's `selectFile`.
          if (!isPreview && oldPreviewId === target.fileId) {
            setRightPanePreviewFileId(undefined);
          }
          if (insertIndex === undefined) return prev;
          // Already a B tab: reposition it to the drop position. The drop
          // index was hit-tested with the tab still in the list, so
          // account for its removal before splicing.
          const next = prev.filter((t) => t.fileId !== target.fileId);
          const at = Math.min(
            existingIdx < insertIndex ? insertIndex - 1 : insertIndex,
            next.length,
          );
          next.splice(Math.max(0, at), 0, prev[existingIdx]);
          return next;
        }

        // New B tab: delegate the insertion + preview-slot maths to the
        // shared resolver so pane B stays in lock-step with pane A. Work in
        // id-space, then rebuild the object list from the resolved order.
        const { ids, previewId } = resolveNewTabInsertion({
          ids: prev.map((t) => t.fileId),
          targetId: target.fileId,
          insertIndex,
          isPreview,
          oldPreviewId,
          oldSelectedId,
        });
        setRightPanePreviewFileId(previewId);
        const byId = new Map(prev.map((t) => [t.fileId, t]));
        byId.set(target.fileId, target);
        return ids
          .map((id) => byId.get(id))
          .filter((t): t is SelectableFileData => Boolean(t));
      });
      setRightPaneSelectedFile(target);
    },
    [
      leftPaneMarkdownStateByFileId,
      fetchFile,
      rightPaneSelectedFile?.fileId,
      setRightPanePreviewFileId,
      rightPanePreviewFileIdRef,
    ],
  );

  // Split sub-feature: duplicate `fileId` from `fromPane` into the opposite
  // pane — the file remains in its origin (Split, not Move).
  const splitToOtherPane = useCallback(
    (fileId: string | undefined, fromPane: 'A' | 'B') => {
      if (fromPane === 'A') {
        const target =
          fileId === undefined
            ? selectedFile
            : tabs.find((t) => t.fileId === fileId);
        if (!target) return;
        openInPaneB(target);
        return;
      }
      const resolvedId = fileId ?? rightPaneSelectedFile?.fileId;
      if (!resolvedId) return;
      // Mirror B's markdown mode into A so the duplicated view opens in
      // the same write/preview state.
      const targetInB =
        rightPaneTabs.find((t) => t.fileId === resolvedId) ??
        (rightPaneSelectedFile?.fileId === resolvedId
          ? rightPaneSelectedFile
          : undefined);
      if (targetInB?.fileExtension === 'md') {
        const bMode = rightPaneMarkdownStateByFileId.get(resolvedId);
        if (bMode !== undefined) {
          setLeftPaneMarkdownStateByFileId((prev) => {
            if (prev.get(resolvedId) === bMode) return prev;
            const next = new Map(prev);
            next.set(resolvedId, bMode);
            return next;
          });
        }
      }
      selectFile({ fileId: resolvedId });
    },
    [
      selectedFile,
      tabs,
      openInPaneB,
      rightPaneSelectedFile,
      rightPaneTabs,
      rightPaneMarkdownStateByFileId,
      selectFile,
    ],
  );

  const openFileInPane = useCallback(
    (fileId: string, targetPane: 'A' | 'B', isPreview = false) => {
      if (targetPane === 'A') {
        selectFile({ fileId, isPreview });
        return;
      }
      const target =
        tabs.find((t) => t.fileId === fileId) ??
        rightPaneTabs.find((t) => t.fileId === fileId) ??
        allFiles?.find((f) => f.fileId === fileId);
      if (!target) return;
      openInPaneB(target, undefined, isPreview);
    },
    [selectFile, tabs, rightPaneTabs, allFiles, openInPaneB],
  );

  const selectFileInActivePane = useCallback(
    (params: {
      fileId?: string;
      openAtIndex?: number;
      isPreview?: boolean;
    }): void => {
      if (getActivePane() === 'A') {
        selectFile(params);
        return;
      }

      const { fileId, openAtIndex } = params;
      if (!fileId) {
        return;
      }

      openInPaneB(
        {
          fileId,
          tags: [],
          ...deriveFileNameFields(fileId),
        },
        openAtIndex,
      );
    },
    [getActivePane, selectFile, openInPaneB],
  );

  const openOrPushToSplit = useCallback(
    (fileId?: string) => splitToOtherPane(fileId, 'A'),
    [splitToOtherPane],
  );

  // Pane-A close wrapper: when the user closes A's last tab while pane B
  // exists, fold all B tabs back into A and collapse the split. The
  // closing tab is actually closed (so the X click takes effect) and the
  // active selection becomes whatever B had selected.
  const closeFileFromPaneA = useCallback(
    (fileId: string) => {
      const isClosingLastA = tabs.length <= 1 && tabs[0]?.fileId === fileId;
      const hasPaneB = isSplit && rightPaneTabs.length > 0;
      if (isClosingLastA && hasPaneB) {
        // Merge B's tabs into A first so A is never empty in between.
        const aIds = new Set(tabs.map((t) => t.fileId));
        rightPaneTabs.forEach((t) => {
          if (!aIds.has(t.fileId)) selectFile({ fileId: t.fileId });
        });
        // B's per-file markdown modes win (more-recent edit surface).
        setLeftPaneMarkdownStateByFileId((prev) => {
          let changed = false;
          const next = new Map(prev);
          rightPaneMarkdownStateByFileId.forEach((mode, mergedId) => {
            if (next.get(mergedId) !== mode) {
              next.set(mergedId, mode);
              changed = true;
            }
          });
          return changed ? next : prev;
        });
        setRightPaneMarkdownStateByFileId(new Map());
        const nextSelectedId = rightPaneTabs.find(
          (t) => t.fileId !== fileId,
        )?.fileId;
        if (nextSelectedId) selectFile({ fileId: nextSelectedId });
        setRightPaneTabs([]);
        setRightPaneSelectedFile(undefined);
        setIsSplit(false);
        setLeftPaneMarkdownStateByFileId((prev) => {
          if (!prev.has(fileId)) return prev;
          const next = new Map(prev);
          next.delete(fileId);
          return next;
        });
        closeFile(fileId);
        return;
      }
      // Normal close: drop the file's per-file markdown mode from A's map
      // so a re-opened tab starts from the default Preview state.
      setLeftPaneMarkdownStateByFileId((prev) => {
        if (!prev.has(fileId)) return prev;
        const next = new Map(prev);
        next.delete(fileId);
        return next;
      });
      closeFile(fileId);
    },
    [
      tabs,
      isSplit,
      rightPaneTabs,
      rightPaneMarkdownStateByFileId,
      selectFile,
      closeFile,
    ],
  );

  // Pane-A "Close All" wrapper. Default-loop close uses a stale `tabs`
  // closure inside the synchronous forEach, so it never lands in the
  // consolidation branch of `closeFileFromPaneA`. We do the merge once
  // here, then close every original A tab in one pass.
  const closeAllFromPaneA = useCallback(() => {
    const hasPaneB = isSplit && rightPaneTabs.length > 0;
    const keepIds = hasPaneB
      ? new Set(rightPaneTabs.map((t) => t.fileId))
      : new Set<string>();
    if (hasPaneB) {
      const aIds = new Set(tabs.map((t) => t.fileId));
      rightPaneTabs.forEach((t) => {
        if (!aIds.has(t.fileId)) selectFile({ fileId: t.fileId });
      });
      setLeftPaneMarkdownStateByFileId((prev) => {
        let changed = false;
        const next = new Map(prev);
        rightPaneMarkdownStateByFileId.forEach((mode, mergedId) => {
          if (next.get(mergedId) !== mode) {
            next.set(mergedId, mode);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
      setRightPaneMarkdownStateByFileId(new Map());
      const nextSelectedId = rightPaneSelectedFile?.fileId;
      if (nextSelectedId) selectFile({ fileId: nextSelectedId });
      setRightPaneTabs([]);
      setRightPaneSelectedFile(undefined);
      setIsSplit(false);
    }
    // The underlying `closeFile` protects the unclosable main file.
    tabs.forEach((t) => {
      if (keepIds.has(t.fileId)) return;
      setLeftPaneMarkdownStateByFileId((prev) => {
        if (!prev.has(t.fileId)) return prev;
        const next = new Map(prev);
        next.delete(t.fileId);
        return next;
      });
      closeFile(t.fileId);
    });
  }, [
    tabs,
    isSplit,
    rightPaneTabs,
    rightPaneSelectedFile,
    rightPaneMarkdownStateByFileId,
    selectFile,
    closeFile,
  ]);

  const selectSecretsTabInTabsBar = useCallback(() => {
    selectFile({ fileId: SKETCH_SECRETS_FILE_ID });
  }, [selectFile]);
  const closeRightPaneTab = useCallback(
    (fileId: string) => {
      if (rightPanePreviewFileIdRef.current === fileId) {
        setRightPanePreviewFileId(undefined);
      }
      setRightPaneMarkdownStateByFileId((prev) => {
        if (!prev.has(fileId)) return prev;
        const next = new Map(prev);
        next.delete(fileId);
        return next;
      });
      setRightPaneTabs((prev) => {
        const next = prev.filter((t) => t.fileId !== fileId);
        if (next.length === 0) {
          setIsSplit(false);
          setRightPaneSelectedFile(undefined);
        } else {
          setRightPaneSelectedFile((current) => {
            if (current?.fileId !== fileId) return current;
            const closedIdx = prev.findIndex((t) => t.fileId === fileId);
            return next[Math.min(closedIdx, next.length - 1)];
          });
        }
        return next;
      });
    },
    [setRightPanePreviewFileId, rightPanePreviewFileIdRef],
  );

  const renameRightPaneTab = useCallback((oldId: string, newId: string) => {
    if (oldId === newId) return;
    const rekey = <T>(prev: Map<string, T>): Map<string, T> =>
      rekeyMapEntry(prev, oldId, newId);

    setRightPaneTabs((prev) =>
      prev.some((t) => t.fileId === oldId)
        ? prev.map((t) =>
            t.fileId === oldId ? renameSelectableFile(t, newId) : t,
          )
        : prev,
    );
    setRightPaneSelectedFile((current) =>
      current?.fileId === oldId
        ? renameSelectableFile(current, newId)
        : current,
    );
    setRightPaneMarkdownStateByFileId(rekey);
    setRightPaneBrickTabStateByFileId(rekey);
  }, []);

  const moveTabToOtherPane = useCallback(
    (fileId: string, fromPane: 'A' | 'B', toIndex?: number) => {
      if (fromPane === 'A') {
        const target = tabs.find((t) => t.fileId === fileId);
        if (!target) return;
        // Pane A must always have at least one tab while the editor is
        // shown. If moving this tab would empty A:
        //  - With no pane B: no-op (nowhere to land).
        //  - With pane B open: the move is realised as a collapse where
        //    panel B's content survives — B's tabs (in B's order) plus the
        //    dragged file become the single remaining pane, with the
        //    dragged file at `toIndex` (appended last when omitted —
        //    matches VS Code's last-tab move).
        if (tabs.length <= 1) {
          if (!isSplit || rightPaneTabs.length === 0) return;
          const aIds = new Set(tabs.map((t) => t.fileId));
          // Merge over B's tabs excluding the dragged file (it may be open
          // in both panes): the drop index was hit-tested against B's full
          // list, so when the dragged file sits before the drop position
          // its own slot must be discounted.
          const others = rightPaneTabs.filter((t) => !aIds.has(t.fileId));
          const draggedBIdx = rightPaneTabs.findIndex(
            (t) => t.fileId === fileId,
          );
          let dropAt: number;
          if (toIndex === undefined) {
            dropAt = others.length;
          } else {
            dropAt = Math.min(toIndex, rightPaneTabs.length);
            if (draggedBIdx !== -1 && draggedBIdx < dropAt) dropAt -= 1;
            dropAt = Math.min(dropAt, others.length);
          }
          others.forEach((t, idx) => {
            // Insert B's tabs around the dragged file (already in A at
            // index 0) so the surviving pane reads as panel B with the
            // moved file at the drop position.
            selectFile({
              fileId: t.fileId,
              openAtIndex: idx < dropAt ? idx : idx + 1,
            });
          });
          // B's per-file markdown modes win (more-recent edit surface).
          setLeftPaneMarkdownStateByFileId((prev) => {
            let changed = false;
            const next = new Map(prev);
            rightPaneMarkdownStateByFileId.forEach((mode, mergedId) => {
              if (next.get(mergedId) !== mode) {
                next.set(mergedId, mode);
                changed = true;
              }
            });
            return changed ? next : prev;
          });
          setRightPaneMarkdownStateByFileId(new Map());
          selectFile({ fileId });
          setRightPaneTabs([]);
          setRightPaneSelectedFile(undefined);
          setIsSplit(false);
          return;
        }
        openInPaneB(target, toIndex);
        closeFile(fileId);
        handleSetActivePane('B');
        return;
      }
      const target = rightPaneTabs.find((t) => t.fileId === fileId);
      if (!target) return;
      // Mirror B's per-file markdown mode into A's per-file map before
      // removing the tab from B (closeRightPaneTab deletes the per-file
      // entry, so we must read it first).
      if (target.fileExtension === 'md') {
        const bMode = rightPaneMarkdownStateByFileId.get(fileId);
        if (bMode !== undefined) {
          setLeftPaneMarkdownStateByFileId((prev) => {
            if (prev.get(fileId) === bMode) return prev;
            const next = new Map(prev);
            next.set(fileId, bMode);
            return next;
          });
        }
      }
      const existingAIdx = tabs.findIndex((t) => t.fileId === fileId);
      if (existingAIdx !== -1 && toIndex !== undefined) {
        // Already a tab in A: reposition it to the drop position. The
        // drop index was hit-tested with the tab still in the list, so
        // account for its removal before splicing.
        const ids = tabs.map((t) => t.fileId).filter((id) => id !== fileId);
        const at = Math.min(
          existingAIdx < toIndex ? toIndex - 1 : toIndex,
          ids.length,
        );
        ids.splice(Math.max(0, at), 0, fileId);
        updateOpenFilesOrder(ids, fileId);
        selectFile({ fileId });
      } else {
        selectFile({ fileId, openAtIndex: toIndex });
      }
      closeRightPaneTab(fileId);
      handleSetActivePane('A');
    },
    [
      tabs,
      rightPaneTabs,
      isSplit,
      openInPaneB,
      closeFile,
      selectFile,
      updateOpenFilesOrder,
      closeRightPaneTab,
      rightPaneMarkdownStateByFileId,
      handleSetActivePane,
    ],
  );

  const useTabsBarLogic = (): ReturnType<TabsBarLogic> => {
    const validateFileName = useCallback(() => [], []);

    const makeUniqueFileName = useCallback((fileName: string): string => {
      return fileName;
    }, []);

    return {
      tabs,
      selectableMainFile,
      selectedTab: selectedFile,
      previewFileId,
      selectTab: selectFileAndFocus,
      selectSecretsTab: selectSecretsTabInTabsBar,
      closeTab: closeFileFromPaneA,
      updateTabOrder: updateOpenFilesOrder,
      unsavedFileIds,
      isReadOnly: true,
      isExampleSketchRoute: false,
      hasSetHeightOnHover,
      validateFileName,
      makeUniqueFileName,
      addFile: addAppFile,
      renameFile: renameAppFile,
      deleteFile: deleteAppFile,
      replaceFileNameInvalidCharacters,
      getFileIcon: resolveFileIconComponent,
      isRenderedMarkdownFile:
        (selectedFile?.fileExtension === 'md' && shouldRenderMarkdown) ||
        selectedFile?.fileExtension === BRICK_FILE_EXTENSION,
      onSplitRight: openOrPushToSplit,
      onCloseAll: closeAllFromPaneA,
      // Receive a tab dropped from pane B's bar at the hovered position.
      onCrossPaneDrop: (fileId: string, insertIndex: number): void =>
        moveTabToOtherPane(fileId, 'B', insertIndex),
    };
  };

  const tabsBarLogic = useCallback(useTabsBarLogic, [
    tabs,
    selectableMainFile,
    selectedFile,
    previewFileId,
    selectFileAndFocus,
    selectSecretsTabInTabsBar,
    closeFileFromPaneA,
    updateOpenFilesOrder,
    unsavedFileIds,
    hasSetHeightOnHover,
    addAppFile,
    renameAppFile,
    deleteAppFile,
    shouldRenderMarkdown,
    openOrPushToSplit,
    closeAllFromPaneA,
    moveTabToOtherPane,
  ]);

  const { mutateAsync: saveSketchFileQuery } = useMutation({
    mutationFn: async (payload?: {
      fileId?: string;
      code?: string;
      hash?: string;
    }) => {
      if (!payload || !payload.fileId || typeof payload.code === 'undefined') {
        return Promise.reject(new Error('No payload provided'));
      }

      const { fileId: path, code: content } = payload;
      try {
        await saveAppFile(`${appPath}/${path}`, content);
      } catch (error) {
        return Promise.reject(
          new Error(`Failed to save sketch file: ${error}`),
        );
      }
      return null;
    },
  });

  const updateCodeSubjectHash = useCallback(async () => undefined, []);

  const useCreateSketchFromExisting =
    (): ReturnType<UseCreateSketchFromExisting> => ({
      create: async () => undefined,
      isLoading: false,
    });

  const createSketchFromExisting = useCallback(useCreateSketchFromExisting, []);

  const retrieveSketches = useCallback(async () => [], []);

  const selectFileById = useCallback(
    (fileId?: string) => selectFile({ fileId }),
    [selectFile],
  );

  const { setCode, saveCode } = useCodeChange(
    saveSketchFileQuery,
    selectFileById,
    codeInjectionsSubjectNext,
    getCodeSubjectById,
    codeSubjectNext,
    getUnsavedFilesSubject,
    updateCodeSubjectHash,
    createSketchFromExisting,
    retrieveSketches,
    false,
    false,
    readOnly,
    selectedFile,
    selectableMainFile,
    undefined,
    undefined,
    tabs,
    true,
  );

  /**
   * Write a file's content on behalf of the language server, keyed by the file
   * itself rather than by the current selection.
   *
   * `setCode` (the editor's onChange) writes to `selectedFile.fileId`, which is
   * correct for typing but wrong for a cross-file rename: those edits belong to a
   * file the user is not looking at. Routing them through here is what lets the
   * LSP apply them without opening the file first — the same call the prettify
   * formatter already uses to write a file it is not displaying, `shouldUpdate`
   * included so the editor adopts the new content if the file is opened later.
   */
  // Reports whether the write landed. `codeSubjectNext` silently no-ops (a
  // console.warn) when the file has no code subject, and subjects are created
  // lazily when a file is first opened — so for any file untouched this session
  // there is nowhere to write. Returning false lets the caller fall back to
  // opening the file, which is what creates the subject.
  const setLspFileValue = useCallback(
    (fileId: string, value: string): boolean => {
      if (!getSelectedCodeObservableValue(getCodeSubjectById, fileId)) {
        return false;
      }
      codeSubjectNext(fileId, value, saveCode, undefined, true);
      return true;
    },
    [saveCode],
  );

  /**
   * Create and populate a file's content subject without selecting it, returning
   * the content it now holds (or undefined if it could not be resolved).
   *
   * `fetchFile` reads the canonical content and calls `setCodeSubjects`, so it
   * does everything a first open would do to the store minus the tab and the
   * focus change. Awaiting it is what guarantees the content is resolved before
   * an edit is computed against it.
   *
   * Returning the content rather than a boolean lets the caller check it against
   * its own copy before writing: applying server-computed offsets to content that
   * has moved underneath us is how a cross-file rename corrupts a file.
   */
  const ensureLspFileValue = useCallback(
    async (fileId: string): Promise<string | undefined> => {
      await fetchFile?.(fileId);
      return getSelectedCodeObservableValue(getCodeSubjectById, fileId)?.value;
    },
    [fetchFile],
  );

  const selectRightPaneFileById = useCallback(
    ({
      fileId,
      isPreview = false,
    }: {
      fileId?: string;
      openAtIndex?: number;
      isPreview?: boolean;
    }) => {
      setRightPaneSelectedFile(
        fileId ? rightPaneTabs.find((t) => t.fileId === fileId) : undefined,
      );
      // Tab-strip selection of an already-open tab only ever commits a
      // preview (double-click / explicit open) — it never turns a committed
      // tab back into a preview, matching pane A's `selectFile`.
      if (
        fileId &&
        !isPreview &&
        rightPanePreviewFileIdRef.current === fileId
      ) {
        setRightPanePreviewFileId(undefined);
      }
    },
    [rightPaneTabs, setRightPanePreviewFileId, rightPanePreviewFileIdRef],
  );

  const selectRightPaneFileByIdLegacy = useCallback(
    (fileId?: string) => selectRightPaneFileById({ fileId }),
    [selectRightPaneFileById],
  );

  const selectRightPaneFileAndFocus = useCallback(
    ({ fileId }: { fileId?: string }): void => {
      handleSetActivePane('B');
      selectRightPaneFileById({ fileId });
      focusActivePane();
    },
    [handleSetActivePane, selectRightPaneFileById, focusActivePane],
  );

  const { setCode: setCode2, saveCode: saveCode2 } = useCodeChange(
    saveSketchFileQuery,
    selectRightPaneFileByIdLegacy,
    codeInjectionsSubjectNext,
    getCodeSubjectById,
    codeSubjectNext,
    getUnsavedFilesSubject,
    updateCodeSubjectHash,
    createSketchFromExisting,
    retrieveSketches,
    false,
    false,
    readOnly,
    rightPaneSelectedFile,
    selectableMainFile,
    undefined,
    undefined,
    rightPaneTabs,
    true,
  );

  const onReceiveViewInstanceA = useCallback(
    (viewInstance: EditorView | null): void => {
      codeEditorViewInstances.A = viewInstance;
    },
    [],
  );

  const onReceiveViewInstanceB = useCallback(
    (viewInstance: EditorView | null): void => {
      codeEditorViewInstances.B = viewInstance;
    },
    [],
  );

  const leftPaneSubjectHasValue = useSubjectHasValue(selectedFile?.fileId);
  const isLeftPaneFileLoading = !leftPaneSubjectHasValue;

  const codeEditorLogic = useMemo(
    () =>
      buildCodeEditorHook(
        selectedFile,
        tabs,
        setCode,
        saveCode,
        isLeftPaneFileLoading,
        readOnly,
        onReceiveViewInstanceA,
        {
          filesList,
          isLspEnabled,
          lspWorkspaceDir,
          lspClients,
          selectFile: selectFileInActivePane,
          startLSP,
          sendLspMessage,
          subscribeLspMessages,
          getLspWorkspaceFile,
          setLspFileValue,
          ensureLspFileValue,
          getActivePane,
          onLspStateChange,
        },
      ),
    [
      selectedFile,
      tabs,
      setCode,
      saveCode,
      isLeftPaneFileLoading,
      readOnly,
      onReceiveViewInstanceA,
      filesList,
      isLspEnabled,
      lspWorkspaceDir,
      lspClients,
      selectFileInActivePane,
      startLSP,
      sendLspMessage,
      subscribeLspMessages,
      getLspWorkspaceFile,
      getActivePane,
      onLspStateChange,
    ],
  );

  const rightPaneSubjectHasValue = useSubjectHasValue(
    rightPaneSelectedFile?.fileId,
  );

  const isRightPaneFileLoading = !rightPaneSubjectHasValue;

  const codeEditorLogic2 = useMemo(
    () =>
      buildCodeEditorHook(
        rightPaneSelectedFile,
        rightPaneTabs,
        setCode2,
        saveCode2,
        isRightPaneFileLoading,
        readOnly,
        onReceiveViewInstanceB,
        {
          filesList,
          isLspEnabled,
          lspWorkspaceDir,
          lspClients,
          selectFile: selectFileInActivePane,
          startLSP,
          sendLspMessage,
          subscribeLspMessages,
          getLspWorkspaceFile,
          setLspFileValue,
          ensureLspFileValue,
          getActivePane,
          onLspStateChange,
        },
      ),
    [
      rightPaneSelectedFile,
      rightPaneTabs,
      setCode2,
      saveCode2,
      isRightPaneFileLoading,
      readOnly,
      onReceiveViewInstanceB,
      filesList,
      isLspEnabled,
      lspWorkspaceDir,
      lspClients,
      selectFileInActivePane,
      startLSP,
      sendLspMessage,
      subscribeLspMessages,
      getLspWorkspaceFile,
      getActivePane,
      onLspStateChange,
    ],
  );

  const selectSecretsTab = useCallback(() => {
    setRightPaneSelectedFile(
      rightPaneTabs.find((t) => t.fileId === SKETCH_SECRETS_FILE_ID),
    );
  }, [rightPaneTabs]);

  const useTabsBarLogic2 = (): ReturnType<TabsBarLogic> => {
    const validateFileName = useCallback(() => [], []);
    const makeUniqueFileName = useCallback((fileName: string): string => {
      return fileName;
    }, []);

    return {
      tabs: rightPaneTabs,
      selectableMainFile,
      selectedTab: rightPaneSelectedFile,
      previewFileId: rightPanePreviewFileId,
      selectTab: selectRightPaneFileAndFocus,
      selectSecretsTab,
      closeTab: closeRightPaneTab,
      updateTabOrder: (ids: string[]) =>
        setRightPaneTabs((prev) => {
          const map = new Map(prev.map((t) => [t.fileId, t]));
          return ids
            .map((id) => map.get(id))
            .filter((t): t is SelectableFileData => Boolean(t));
        }),
      unsavedFileIds,
      isReadOnly: true,
      isExampleSketchRoute: false,
      hasSetHeightOnHover,
      validateFileName,
      makeUniqueFileName,
      addFile: addAppFile,
      renameFile: renameAppFile,
      deleteFile: deleteAppFile,
      replaceFileNameInvalidCharacters,
      getFileIcon: resolveFileIconComponent,
      isRenderedMarkdownFile:
        (rightPaneSelectedFile?.fileExtension === 'md' &&
          rightPaneShouldRenderMarkdown) ||
        rightPaneSelectedFile?.fileExtension === BRICK_FILE_EXTENSION,
      onSplitLeft: (fileId: string) => splitToOtherPane(fileId, 'B'),
      // Receive a tab dropped from pane A's bar at the hovered position.
      onCrossPaneDrop: (fileId: string, insertIndex: number): void =>
        moveTabToOtherPane(fileId, 'A', insertIndex),
    };
  };

  const tabsBarLogic2 = useCallback(useTabsBarLogic2, [
    rightPaneTabs,
    selectableMainFile,
    rightPaneSelectedFile,
    rightPanePreviewFileId,
    selectRightPaneFileAndFocus,
    selectSecretsTab,
    closeRightPaneTab,
    unsavedFileIds,
    hasSetHeightOnHover,
    addAppFile,
    renameAppFile,
    deleteAppFile,
    splitToOtherPane,
    rightPaneShouldRenderMarkdown,
    moveTabToOtherPane,
  ]);

  const useSecretsEditorLogic = (): ReturnType<SecretsEditorLogic> => {
    const updateSecrets = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      async (): Promise<void> => {},
      [],
    );

    const openDeleteSecretDialog = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      (): void => {},
      [],
    );

    return {
      secrets: undefined,
      updateSecrets,
      openDeleteSecretDialog,
    };
  };

  const secretsEditorLogic = useCallback(useSecretsEditorLogic, []);

  const openExternalLink = useCallback((url: string) => {
    if (!url) {
      console.warn('No URL provided to open externally');
      return;
    }
    openLinkExternal(url);
  }, []);

  const brickDetailLogic = useMemo(
    () => makeAppBrickDetailLogic(appId),
    [appId],
  );

  const useEditorPanelLogic = (): ReturnType<EditorPanelLogic> => {
    const controlsProps = {
      hideControls: true,
    } as EditorControlsProps;

    return {
      tabsBarLogic,
      codeEditorLogic,
      secretsEditorLogic,
      brickDetailLogic,
      selectedFile: selectedFile
        ? {
            id: selectedFile.fileId,
            ext: selectedFile.fileExtension,
            getData: getDataFromFile(selectedFile, appPath),
            error: selectedFile.error,
          }
        : undefined,
      ...controlsProps,
      isFullscreen: false,
      codeIsFormatting: false,
      isConcurrent: false,
      hideTabs: false,
      shouldRenderMarkdown,
      markdownCanBeRendered: true,
      setShouldRenderMarkdown,
      openExternalLink,
      canSwitchMarkdownMode: !(
        selectedFile?.fileId && unsavedFileIds?.has(selectedFile?.fileId)
      ),
      readOnly,
      isSplit,
      openOrPushToSplit,
      splitToOtherPane,
      moveTabToOtherPane,
      openFileInPane,
      activePane,
      setActivePane: handleSetActivePane,
      paneATabsCount: tabs.length,
      splitPaneCodeEditorLogic: codeEditorLogic2,
      splitPaneTabsBarLogic: tabsBarLogic2,
      splitPaneFileId: rightPaneSelectedFile?.fileId,
      splitPaneFile: rightPaneSelectedFile
        ? {
            id: rightPaneSelectedFile.fileId,
            ext: rightPaneSelectedFile.fileExtension,
            getData: getDataFromFile(rightPaneSelectedFile, appPath),
            error: rightPaneSelectedFile.error,
          }
        : undefined,
      splitPaneShouldRenderMarkdown: rightPaneShouldRenderMarkdown,
      splitPaneSetShouldRenderMarkdown: setRightPaneShouldRenderMarkdown,
      brickSelectedTab,
      setBrickSelectedTab,
      splitPaneBrickDetailLogic: brickDetailLogic,
      splitPaneBrickSelectedTab: rightPaneBrickSelectedTab,
      splitPaneSetBrickSelectedTab: setRightPaneBrickSelectedTab,
      splitPaneCanSwitchMarkdownMode: !(
        rightPaneSelectedFile?.fileId &&
        unsavedFileIds?.has(rightPaneSelectedFile.fileId)
      ),
      storedSplitProportionLeft: openFilesStore?.splitProportionLeft,
      onSplitResize: handleSplitResize,
    };
  };

  const editorPanelLogic = useCallback(useEditorPanelLogic, [
    tabsBarLogic,
    codeEditorLogic,
    secretsEditorLogic,
    brickDetailLogic,
    selectedFile,
    appPath,
    shouldRenderMarkdown,
    setShouldRenderMarkdown,
    openExternalLink,
    unsavedFileIds,
    readOnly,
    isSplit,
    openOrPushToSplit,
    splitToOtherPane,
    moveTabToOtherPane,
    openFileInPane,
    activePane,
    handleSetActivePane,
    tabs.length,
    codeEditorLogic2,
    tabsBarLogic2,
    rightPaneSelectedFile,
    rightPaneShouldRenderMarkdown,
    setRightPaneShouldRenderMarkdown,
    brickSelectedTab,
    setBrickSelectedTab,
    rightPaneBrickSelectedTab,
    setRightPaneBrickSelectedTab,
    openFilesStore?.splitProportionLeft,
    handleSplitResize,
  ]);

  return {
    editorPanelLogic,
    openFileInPane,
    getActivePane,
    activePane,
    rightPaneSelectedFile,
    rightPaneTabs,
    renameRightPaneTab,
    closeRightPaneTab,
    closeFileFromPaneA,
    openBrickAiModelsTab,
  };
};
