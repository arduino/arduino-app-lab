import {
  codeInjectionsSubjectNext,
  codeSubjectNext,
  getBrowser,
  getCodeInjectionsSubject,
  getCodeSubjectById,
  getUnsavedFilesSubject,
  openLinkExternal,
  replaceFileNameInvalidCharacters,
  saveAppFile,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import type { SaveCode } from '@cloud-editor-mono/domain/src/services/services-by-app/shared';
import { resolveFileIconComponent } from '@cloud-editor-mono/images/assets/file-icons';
import {
  CodeEditorLogic,
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
import { toast } from 'sonner';

import {
  getSelectedCodeObservableValue,
  useCodeChange,
  useCodeInjectionsObservable,
} from '../../../../../../common/hooks/code';
import {
  codeEditorViewInstance,
  useCodeEditorViewInstance,
} from '../../../../../../common/hooks/editor';
import { SKETCH_SECRETS_FILE_ID } from '../../../../../../common/hooks/files';
import { UseCreateSketchFromExisting } from '../../../../../../common/hooks/queries/create.type';
import { makeAppBrickDetailLogic } from '../../../../../hooks/useBrickDetail';
import { EditorPanelLogicParams } from './appLabEditorPanel.type';
import { messages } from './messages';

let hasExecutedForFile: string | undefined;

// Tracks whether the code subject for `fileId` has a value yet. Lets us
// gate the skeleton on a per-file basis instead of using the shared
// `sketchDataIsLoading` flag (which flips on any batch refetch and would
// otherwise skeletonize already-loaded files in a sibling pane).
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
  return READONLY_FILE_IDS.includes(file.fileId);
}

function deriveFileNameFields(fileId: string): {
  fileFullName: string;
  fileName: string;
  fileExtension: string;
} {
  const fileFullName = fileId.split('/').pop() ?? fileId;
  const dotIndex = fileFullName.lastIndexOf('.');
  return {
    fileFullName,
    fileExtension: dotIndex > 0 ? fileFullName.slice(dotIndex + 1) : '',
    fileName: dotIndex > 0 ? fileFullName.slice(0, dotIndex) : fileFullName,
  };
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

function buildCodeEditorHook(
  file: SelectableFileData | undefined,
  fileTabs: SelectableFileData[],
  setCodeFn: ReturnType<CodeEditorLogic>['setCode'],
  saveCodeFn: SaveCode,
  sketchDataIsLoading: boolean,
  readOnly: boolean,
  onReceiveViewInstance: (viewInstance: EditorView | null) => void,
): CodeEditorLogic {
  return function useCodeEditorLogic(): ReturnType<CodeEditorLogic> {
    useCodeInjectionsObservable(getCodeInjectionsSubject);

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
        if (value) {
          codeInjectionsSubjectNext(
            value.fileId,
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
      showReadOnlyBanner: readOnly,
      hasHeader: false,
      hasTabs: true,
      useScrollPastEnd: true,
      gutter: readOnly ? undefined : { lineNumberStartOffset: 0 },
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
  openFileInPane: (fileId: string, targetPane: 'A' | 'B') => void;
  /**
   * Read the pane the user last interacted with ('A' or 'B'). Used by
   * `setSelectedFile` in `appDetail.logic` to route file-tree clicks into
   * the focused pane. A ref-backed getter so callers always see the
   * latest value without re-rendering.
   */
  getActivePane: () => 'A' | 'B';
  activePane: 'A' | 'B';
  rightPaneSelectedFile: SelectableFileData | undefined;
  renameRightPaneTab: (oldId: string, newId: string) => void;
  closeRightPaneTab: (fileId: string) => void;
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
    sketchDataIsLoading,
    selectableMainFile,
    unsavedFileIds,
    openFiles: tabs,
    readOnly,
    removeFileFromPending,
    previewFileId,
    allFiles,
    openFilesStore,
    filesContentLoaded,
    storeSplitState,
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

  useEffect(() => {
    if (!removeFileFromPending) return;

    const fileId = rightPaneSelectedFile?.fileId;
    if (!fileId) return;

    const existsInFiles = (allFiles ?? []).some((f) => f.fileId === fileId);
    if (existsInFiles) {
      removeFileFromPending(fileId);
    }
  }, [allFiles, rightPaneSelectedFile, removeFileFromPending]);

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
  const { formatMessage } = useI18n();
  const filesWithToastShown = useRef<Set<string>>(new Set());

  // Collapsing the split always returns focus to the single remaining
  // pane A, so file-tree clicks resume opening there.
  useEffect(() => {
    if (!isSplit) {
      activePaneRef.current = 'A';
      setActivePane('A');
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
      if (allFilesById.has(id)) removeFileFromPending?.(id);
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
        resolvedTabs.forEach((file) => removeFileFromPending?.(file.fileId));
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
  }, [filesContentLoaded, openFilesStore, allFiles, removeFileFromPending]);

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

  // Show notification when a non-editable file is opened (only for sketches, not examples)
  useEffect(() => {
    if (!selectedFile) return;

    const currentFileIsReadonly = isReadonlyFile(selectedFile);
    const fileId = selectedFile.fileId;

    if (hasExecutedForFile && hasExecutedForFile !== fileId) {
      hasExecutedForFile = undefined;
    }

    if (hasExecutedForFile === fileId) {
      return;
    }
    hasExecutedForFile = fileId;

    // Remove files from Set that are no longer in tabs (file was closed)
    const currentTabIds = new Set(tabs.map((t) => t.fileId));
    for (const toastFileId of filesWithToastShown.current) {
      if (!currentTabIds.has(toastFileId)) {
        filesWithToastShown.current.delete(toastFileId);
      }
    }

    if (!currentFileIsReadonly) {
      toast.dismiss();
      return;
    }

    if (
      currentFileIsReadonly &&
      !readOnly &&
      !filesWithToastShown.current.has(fileId)
    ) {
      // Dismiss all existing toasts before showing a new one
      toast.dismiss();

      snackbar({
        message: formatMessage(messages.readOnlyAttempt),
        variant: 'info',
        opts: { duration: 3000 },
      });

      filesWithToastShown.current.add(fileId);
    }
  }, [selectedFile, readOnly, formatMessage, tabs]);

  const openInPaneB = useCallback(
    (target: SelectableFileData, insertIndex?: number) => {
      // Ensure the file's content is fetched. Files start in a "pending"
      // state until the user selects them on the left pane (which triggers
      // their code subject to be instantiated); without this call, opening
      // a never-selected file in the right pane would leave the editor
      // stuck on the loading skeleton.
      removeFileFromPending?.(target.fileId);

      // Seed B's markdown mode from A only on the first split — afterwards
      // the pane's mode is deliberately independent.
      setRightPaneMarkdownStateByFileId((prev) => {
        if (prev.has(target.fileId)) return prev;
        const seed = leftPaneMarkdownStateByFileId.get(target.fileId) ?? true;
        const next = new Map(prev);
        next.set(target.fileId, seed);
        return next;
      });

      // Always use the functional updater so multiple synchronous calls
      // (e.g. dragging several files at once onto a closed pane B)
      // accumulate instead of clobbering each other through stale closures.
      setIsSplit(true);
      setRightPaneTabs((prev) => {
        const existingIdx = prev.findIndex((t) => t.fileId === target.fileId);
        if (existingIdx !== -1) {
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
        if (insertIndex === undefined || insertIndex >= prev.length) {
          return [...prev, target];
        }
        const next = [...prev];
        next.splice(Math.max(0, insertIndex), 0, target);
        return next;
      });
      setRightPaneSelectedFile(target);
    },
    [leftPaneMarkdownStateByFileId, removeFileFromPending],
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
    (fileId: string, targetPane: 'A' | 'B') => {
      if (targetPane === 'A') {
        selectFile({ fileId });
        return;
      }
      const target =
        tabs.find((t) => t.fileId === fileId) ??
        rightPaneTabs.find((t) => t.fileId === fileId) ??
        allFiles?.find((f) => f.fileId === fileId);
      if (!target) return;
      openInPaneB(target);
    },
    [selectFile, tabs, rightPaneTabs, allFiles, openInPaneB],
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
  const closeRightPaneTab = useCallback((fileId: string) => {
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
  }, []);

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
      selectTab: selectFile,
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
        selectedFile?.fileExtension === 'brick',
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
    selectFile,
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
      if (!payload || !payload.fileId || !payload.code) {
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

  const selectRightPaneFileById = useCallback(
    ({ fileId }: { fileId?: string }) => {
      setRightPaneSelectedFile(
        fileId ? rightPaneTabs.find((t) => t.fileId === fileId) : undefined,
      );
    },
    [rightPaneTabs],
  );

  const selectRightPaneFileByIdLegacy = useCallback(
    (fileId?: string) => selectRightPaneFileById({ fileId }),
    [selectRightPaneFileById],
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

  useCodeEditorViewInstance(selectFile, tabs);

  const onReceiveViewInstance = useCallback(
    (viewInstance: EditorView | null): void => {
      codeEditorViewInstance.instance = viewInstance;
    },
    [],
  );

  const leftPaneSubjectHasValue = useSubjectHasValue(selectedFile?.fileId);
  const isLeftPaneFileLoading = sketchDataIsLoading && !leftPaneSubjectHasValue;

  const codeEditorLogic = useMemo(
    () =>
      buildCodeEditorHook(
        selectedFile,
        tabs,
        setCode,
        saveCode,
        isLeftPaneFileLoading,
        readOnly,
        onReceiveViewInstance,
      ),
    [
      selectedFile,
      tabs,
      setCode,
      saveCode,
      isLeftPaneFileLoading,
      readOnly,
      onReceiveViewInstance,
    ],
  );

  const rightPaneSubjectHasValue = useSubjectHasValue(
    rightPaneSelectedFile?.fileId,
  );

  const isRightPaneFileLoading =
    sketchDataIsLoading && !rightPaneSubjectHasValue;

  const codeEditorLogic2 = useMemo(
    () =>
      buildCodeEditorHook(
        rightPaneSelectedFile,
        rightPaneTabs,
        setCode2,
        saveCode2,
        isRightPaneFileLoading,
        readOnly,
        onReceiveViewInstance,
      ),
    [
      rightPaneSelectedFile,
      rightPaneTabs,
      setCode2,
      saveCode2,
      isRightPaneFileLoading,
      readOnly,
      onReceiveViewInstance,
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
      selectTab: selectRightPaneFileById,
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
        rightPaneSelectedFile?.fileExtension === 'brick',
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
    selectRightPaneFileById,
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
    renameRightPaneTab,
    closeRightPaneTab,
    openBrickAiModelsTab,
  };
};
