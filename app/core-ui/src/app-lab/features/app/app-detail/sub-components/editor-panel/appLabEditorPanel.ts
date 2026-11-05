import {
  codeInjectionsSubjectNext,
  codeSubjectNext,
  getBrowser,
  getCodeInjectionsSubject,
  getCodeReloadSubject,
  getCodeSubjectById,
  getUnsavedFilesSubject,
  openLinkExternal,
  readText,
  replaceFileNameInvalidCharacters,
  saveAppFile,
  writeText,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import type { SaveCode } from '@cloud-editor-mono/domain/src/services/services-by-app/shared';
import { resolveFileIconComponent } from '@cloud-editor-mono/images/assets/file-icons';
import {
  AppLabPaneExtras,
  BRICK_FILE_EXTENSION,
  BrickDetailTabId,
  CodeEditorLogic,
  dismissSnackbar,
  EditorClipboard,
  EditorControlsProps,
  EditorPanelLogic,
  isBrickDetailTabId,
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
import { BehaviorSubject, Subject } from 'rxjs';

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
import {
  useObservable,
  useObservableSelector,
} from '../../../../../../common/hooks/useObservable';
import { makeAppBrickDetailLogic } from '../../../../../hooks/useBrickDetail';
import { isAbsoluteId, splitFileName } from '../../hooks/filePaths';
import { resolveNewTabInsertion } from '../../hooks/tabInsertion';
import { metaFromPath } from '../../hooks/useEditorFileMeta';
import { keepMovedBuffer } from '../../hooks/useFileOperations';
import { usePreviewFileId } from '../../hooks/usePreviewFileId';
import { EditorPanelLogicParams } from './appLabEditorPanel.type';
import { messages } from './messages';

// Tracks whether the code subject for `fileId` has a value yet. Used to
// gate the per-panel editor skeleton: the file's content subject is the
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

// Must keep a stable identity: `gutter` is a dependency of the extension-reconcile effect in
// `createUseCodeMirrorHook`, so an object literal reconciles the editor on every render.
const DEFAULT_GUTTER = { lineNumberStartOffset: 0 };

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
  | 'isLspEnabled'
  | 'lspWorkspaceDir'
  | 'lspClients'
  | 'selectFile'
  | 'startLSP'
  | 'sendLspMessage'
  | 'subscribeLspMessages'
  | 'getLspWorkspaceFile'
  | 'getActiveEditorPanel'
  | 'onLspStateChange'
  | 'showLspReferences'
  | 'closeLspReferences'
> & {
  // Built here rather than coming from the shared editor logic, because it has
  // to close over this panel's saveCode (see setLspFileValue).
  setLspFileValue?: (fileId: string, value: string) => boolean;
  ensureLspFileValue?: (fileId: string) => Promise<string | undefined>;
};

// App Lab's clipboard: the domain clipboard service, which the desktop shell
// registers with its native Wails bridge (see the standalone app's
// dependencies.ts). `preferInMemoryPaste` because the system clipboard is not a
// dependable paste source here — only the shell registers an implementation, so
// in the browser build the calls reject — and pasting what was last copied
// inside the editor is the behaviour users get today.
const appLabClipboard: EditorClipboard = {
  readText: () => readText(),
  writeText: (text) => writeText(text),
  preferInMemoryPaste: true,
};

type CodeEditorHookParams = {
  file: SelectableFileData | undefined;
  fileTabs: SelectableFileData[];
  setCode: ReturnType<CodeEditorLogic>['setCode'];
  saveCode: SaveCode;
  sketchDataIsLoading: boolean;
  readOnly: boolean;
  onReceiveViewInstance: (viewInstance: EditorView | null) => void;
  lsp?: LspEditorProps;
};

function buildCodeEditorHook({
  file,
  fileTabs,
  setCode,
  saveCode,
  sketchDataIsLoading,
  readOnly,
  onReceiveViewInstance,
  lsp,
}: CodeEditorHookParams): CodeEditorLogic {
  return function useCodeEditorLogic(): ReturnType<CodeEditorLogic> {
    useCodeInjectionsObservable(getCodeInjectionsSubject);
    // Re-render (and let CodeMirror reload the doc) when any open file's buffer
    // is re-fetched in place from disk — e.g. an external change picked up by
    // the file watcher. The event payload (file + cause) is available here for
    // future per-cause UI (e.g. a "changed on disk" hint).
    useObservable(getCodeReloadSubject());

    return {
      setCode,
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
            { saveCode },
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
      gutter: readOnly ? undefined : DEFAULT_GUTTER,
      fileError: file?.error,
      clipboard: appLabClipboard,
      openExternalLink: openLinkExternal,
      ...lsp,
    };
  };
}

type UseCreateEditorPanelLogic = (params: EditorPanelLogicParams) => {
  editorPanelLogic: EditorPanelLogic;
  /**
   * Open `fileId` in `targetPanel`, creating panel B if needed. Returned so
   * the single owner of this hook (`useAppDetailLogic`) can route file-tree
   * and brick drops into the split panel directly.
   */
  openFileInPanel: (
    fileId: string,
    targetPanel: 'A' | 'B',
    isPreview?: boolean,
  ) => void;
  /**
   * Read the panel the user last interacted with ('A' or 'B'). Used by
   * `setSelectedFile` in `appDetail.logic` to route file-tree clicks into
   * the focused panel. A ref-backed getter so callers always see the
   * latest value without re-rendering.
   */
  getActiveEditorPanel: () => 'A' | 'B';
  activeEditorPanel: 'A' | 'B';
  rightPanelSelectedFile: SelectableFileData | undefined;
  rightPanelTabs: SelectableFileData[];
  renameRightPanelTab: (oldId: string, newId: string) => void;
  closeRightPanelTab: (fileId: string) => void;
  /**
   * Panel-A close with the last-tab consolidation (folds panel B's tabs back
   * into A and collapses the split instead of leaving A empty). Exposed so
   * externally-driven closes (the watcher's stream deletes in
   * `closeFileBothPanels`) behave like a user's X-click — a raw `closeFile`
   * that empties panel A blanks the whole editor panel while panel B still
   * silently holds its tabs.
   */
  closeFileFromPanelA: (fileId: string) => void;
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
    openFiles: tabs,
    readOnly,
    fetchFile,
    onFileLoadError,
    canReadTab,
    previewFileId,
    allFiles,
    openFilesStore,
    tabsHydrated,
    storeSplitState,
    isLspEnabled,
    lspWorkspaceDir,
    lspClients,
    startLSP,
    sendLspMessage,
    subscribeLspMessages,
    getLspWorkspaceFile,
    onLspStateChange,
    showLspReferences,
    closeLspReferences,
    onToggleAgentPanel,
    agentPanelOpen,
  } = params;

  const [leftPanelMarkdownStateByFileId, setLeftPanelMarkdownStateByFileId] =
    useState<Map<string, boolean>>(new Map());
  const [rightPanelMarkdownStateByFileId, setRightPanelMarkdownStateByFileId] =
    useState<Map<string, boolean>>(new Map());
  const [leftPanelBrickTabStateByFileId, setLeftPanelBrickTabStateByFileId] =
    useState<Map<string, BrickDetailTabId>>(new Map());
  const [rightPanelBrickTabStateByFileId, setRightPanelBrickTabStateByFileId] =
    useState<Map<string, BrickDetailTabId>>(new Map());
  const [isSplit, setIsSplit] = useState(false);
  const [rightPanelTabs, setRightPanelTabs] = useState<SelectableFileData[]>(
    [],
  );
  const [rightPanelSelectedFile, setRightPanelSelectedFile] = useState<
    SelectableFileData | undefined
  >(undefined);

  // The tabs-bar and editor-panel logic functions subscribe inside the components that render them.
  const unsavedFiles$ = getUnsavedFilesSubject<Subject<Set<string>>>();

  // Panel B's preview tab — mirrors panel A's `previewFileId` (see
  // `usePreviewFileId`): the one B tab in preview, rendered italic and
  // replaced in place when another file is previewed. The ref lets the
  // tab-mutating callbacks read the latest value without a stale closure.
  const [
    rightPanelPreviewFileId,
    setRightPanelPreviewFileId,
    rightPanelPreviewFileIdRef,
  ] = usePreviewFileId(unsavedFiles$);

  // Read, not watched: an effect that re-runs reloads its file over unsaved edits.
  const onFileLoadErrorRef = useRef(onFileLoadError);
  onFileLoadErrorRef.current = onFileLoadError;
  const canReadTabRef = useRef(canReadTab);
  canReadTabRef.current = canReadTab;
  // A brick tab has no file to read.
  const isReadable = useCallback(
    (file: SelectableFileData): boolean =>
      file.fileExtension !== BRICK_FILE_EXTENSION &&
      (canReadTabRef.current?.(file.fileId) ?? true),
    [],
  );

  const reportLoadError = useCallback(
    (fileId: string) =>
      (error: unknown): void =>
        onFileLoadErrorRef.current
          ? onFileLoadErrorRef.current(fileId, error)
          : console.error('load file failed', error),
    [],
  );

  // A click on the tab on screen changes no selection: a tab that a failed read left empty is read here.
  const readEmptyTab = useCallback(
    (file: SelectableFileData | undefined): void => {
      if (
        !file ||
        !isReadable(file) ||
        getSelectedCodeObservableValue(getCodeSubjectById, file.fileId)
          ?.value !== undefined
      ) {
        return;
      }
      fetchFile?.(file.fileId).catch(reportLoadError(file.fileId));
    },
    [fetchFile, isReadable, reportLoadError],
  );

  // For the tabs not on screen: a load nobody waits for must not reject.
  const preloadTab = useCallback(
    (file: SelectableFileData) => {
      if (!isReadable(file)) return;
      fetchFile?.(file.fileId).catch((error) =>
        console.error('load file failed', error),
      );
    },
    [fetchFile, isReadable],
  );

  // Mirror of panel A's selection-driven fetch: whenever panel B's selected
  // file changes, make sure its content/subject is loaded. Without this,
  // clicking a B tab whose subject was never instantiated (or was lost in
  // a rekey edge case) leaves the editor stuck reading a missing subject.
  const rightPanelSelectedRef = useRef(rightPanelSelectedFile);
  rightPanelSelectedRef.current = rightPanelSelectedFile;
  const rightPanelSelectedId = rightPanelSelectedFile?.fileId;
  useEffect(() => {
    const file = rightPanelSelectedRef.current;
    if (
      file &&
      rightPanelSelectedId &&
      isReadable(file) &&
      !keepMovedBuffer(rightPanelSelectedId)
    ) {
      fetchFile?.(rightPanelSelectedId).catch(
        reportLoadError(rightPanelSelectedId),
      );
    }
  }, [fetchFile, rightPanelSelectedId, isReadable, reportLoadError]);

  // Tracks which panel the user last interacted with so file-tree clicks
  // open in the focused panel (defaulting to A). The ref mirrors the state
  // so non-render consumers (eg. `setSelectedFile` in `appDetail.logic`)
  // can read the latest value without a stale closure.
  const [activeEditorPanel, setActiveEditorPanel] = useState<'A' | 'B'>('A');
  const activeEditorPanelRef = useRef<'A' | 'B'>('A');
  const handleSetActiveEditorPanel = useCallback((panel: 'A' | 'B') => {
    activeEditorPanelRef.current = panel;
    setActiveEditorPanel(panel);
  }, []);
  const getActiveEditorPanel = useCallback(
    () => activeEditorPanelRef.current,
    [],
  );

  const { focusActiveEditorPanel } = useCodeEditorViewInstance(
    selectFile,
    tabs,
    getActiveEditorPanel,
  );

  const selectFileAndFocus = useCallback(
    (params: {
      fileId?: string;
      openAtIndex?: number;
      isPreview?: boolean;
    }): void => {
      handleSetActiveEditorPanel('A');
      if (params.fileId && params.fileId === selectedFile?.fileId) {
        readEmptyTab(selectedFile);
      }
      selectFile(params);
      focusActiveEditorPanel();
    },
    [
      handleSetActiveEditorPanel,
      selectedFile,
      readEmptyTab,
      selectFile,
      focusActiveEditorPanel,
    ],
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
  // A new id per notice: sonner keeps a dismissed id in its store, so showing
  // again under the same id updates the dismissed toast and it never appears.
  const fileNoticeId = useRef<string | number | undefined>(undefined);

  // Collapsing the split always returns focus to the single remaining
  // panel A, so file-tree clicks resume opening there. Panel B's Editor2 is
  // torn down on collapse, so drop its module-scoped view reference too
  // (the ui-components cleanup only nulls its own map, not ours).
  useEffect(() => {
    if (!isSplit) {
      activeEditorPanelRef.current = 'A';
      setActiveEditorPanel('A');
      codeEditorViewInstances.B = null;
    }
  }, [isSplit]);

  const shouldRenderMarkdown = selectedFile?.fileId
    ? leftPanelMarkdownStateByFileId.get(selectedFile.fileId) ?? true
    : true;

  const setShouldRenderMarkdown = useCallback(
    (value: boolean) => {
      const fileId = selectedFile?.fileId;
      if (!fileId) return;
      setLeftPanelMarkdownStateByFileId((prev) => {
        if (prev.get(fileId) === value) return prev;
        const next = new Map(prev);
        next.set(fileId, value);
        return next;
      });
    },
    [selectedFile?.fileId],
  );

  const rightPanelShouldRenderMarkdown = rightPanelSelectedFile?.fileId
    ? rightPanelMarkdownStateByFileId.get(rightPanelSelectedFile.fileId) ?? true
    : true;

  const setRightPanelShouldRenderMarkdown = useCallback(
    (value: boolean) => {
      const fileId = rightPanelSelectedFile?.fileId;
      if (!fileId) return;
      setRightPanelMarkdownStateByFileId((prev) => {
        if (prev.get(fileId) === value) return prev;
        const next = new Map(prev);
        next.set(fileId, value);
        return next;
      });
    },
    [rightPanelSelectedFile?.fileId],
  );

  const brickSelectedTab = selectedFile?.fileId
    ? leftPanelBrickTabStateByFileId.get(selectedFile.fileId) ?? 'overview'
    : 'overview';

  const setBrickSelectedTab = useCallback(
    (value: BrickDetailTabId) => {
      const fileId = selectedFile?.fileId;
      if (!fileId) return;
      setLeftPanelBrickTabStateByFileId((prev) => {
        if (prev.get(fileId) === value) return prev;
        const next = new Map(prev);
        next.set(fileId, value);
        return next;
      });
    },
    [selectedFile?.fileId],
  );

  const rightPanelBrickSelectedTab = rightPanelSelectedFile?.fileId
    ? rightPanelBrickTabStateByFileId.get(rightPanelSelectedFile.fileId) ??
      'overview'
    : 'overview';

  const setRightPanelBrickSelectedTab = useCallback(
    (value: BrickDetailTabId) => {
      const fileId = rightPanelSelectedFile?.fileId;
      if (!fileId) return;
      setRightPanelBrickTabStateByFileId((prev) => {
        if (prev.get(fileId) === value) return prev;
        const next = new Map(prev);
        next.set(fileId, value);
        return next;
      });
    },
    [rightPanelSelectedFile?.fileId],
  );

  const openBrickAiModelsTab = useCallback(
    (brickId: string): void => {
      setLeftPanelBrickTabStateByFileId((prev) => {
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

  // Restored from the stored record after panel A's tabs (a write before them is dropped), keeping only ids `allFiles` has.
  const splitHydrationComplete = useRef(false);
  // Panel A resets on a board switch that keeps this screen: the split state goes with it, and comes back from the next record.
  useEffect(() => {
    if (tabsHydrated || !splitHydrationComplete.current) return;
    splitHydrationComplete.current = false;
    setIsSplit(false);
    setRightPanelTabs([]);
    setRightPanelSelectedFile(undefined);
    setRightPanelPreviewFileId(undefined);
    setLeftPanelMarkdownStateByFileId(new Map());
    setRightPanelMarkdownStateByFileId(new Map());
    setLeftPanelBrickTabStateByFileId(new Map());
    setRightPanelBrickTabStateByFileId(new Map());
    handleSetActiveEditorPanel('A');
  }, [tabsHydrated, setRightPanelPreviewFileId, handleSetActiveEditorPanel]);
  useEffect(() => {
    if (splitHydrationComplete.current) return;
    if (!tabsHydrated) return;
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
    ): Map<string, BrickDetailTabId> => {
      const next = new Map<string, BrickDetailTabId>();
      if (!src) return next;
      for (const [k, v] of Object.entries(src)) {
        if (allFilesById.has(k) && isBrickDetailTabId(v)) {
          next.set(k, v);
        }
      }
      return next;
    };

    const panelA = openFilesStore.panes?.A;
    // Instantiate the code subject for every restored A-panel file. Without
    // this, only the currently selected file (which is unpended by the
    // `selectedFile` effect in `appDetail.logic`) leaves the skeleton —
    // any other restored tab stays stuck on the loader until the user
    // clicks it. Symmetric with the panel B branch below.
    const panelAItems = panelA?.items ?? openFilesStore.items ?? [];
    panelAItems.forEach((id) => {
      const file = allFilesById.get(id);
      if (file) preloadTab(file);
    });
    if (panelA?.markdownByFileId) {
      setLeftPanelMarkdownStateByFileId(
        pruneMarkdownMap(panelA.markdownByFileId),
      );
    }
    if (panelA?.brickTabByFileId) {
      setLeftPanelBrickTabStateByFileId(
        pruneBrickTabMap(panelA.brickTabByFileId),
      );
    }

    const panelB = openFilesStore.panes?.B;
    if (panelB) {
      const resolvedTabs = panelB.items
        .map((id) => allFilesById.get(id))
        .filter((f): f is SelectableFileData => Boolean(f));
      if (resolvedTabs.length > 0) {
        // Instantiate the code subject for each restored B-panel file.
        // Without this, files that aren't also open in panel A stay on the
        // loading skeleton because their content was never fetched (see
        // `openInPanelB` for the runtime equivalent).
        resolvedTabs.forEach(preloadTab);
        setRightPanelTabs(resolvedTabs);
        const selectedId = panelB.selected;
        const selected =
          (selectedId ? allFilesById.get(selectedId) : undefined) ??
          resolvedTabs[0];
        setRightPanelSelectedFile(selected);
        if (panelB.markdownByFileId) {
          setRightPanelMarkdownStateByFileId(
            pruneMarkdownMap(panelB.markdownByFileId),
          );
        }
        if (panelB.brickTabByFileId) {
          setRightPanelBrickTabStateByFileId(
            pruneBrickTabMap(panelB.brickTabByFileId),
          );
        }
        // Only restore isSplit when panel B has at least one valid file —
        // otherwise we'd render an empty right panel.
        if (openFilesStore.isSplit) {
          setIsSplit(true);
        }
      }
    }
  }, [tabsHydrated, openFilesStore, allFiles, preloadTab]);

  // Mirror split-view mutations into the persisted store, guarded by the
  // hydration ref so initial hydration doesn't trigger an immediate
  // write-back of stale values. Shallow-patches via `mergeStoreItem` so
  // it never clobbers panel A's `{items, selected}` written by
  // `useFiles.storeOpenFiles`.
  useEffect(() => {
    if (!splitHydrationComplete.current) return;
    if (!storeSplitState) return;
    storeSplitState({
      isSplit,
      panes: {
        A: {
          markdownByFileId: Object.fromEntries(leftPanelMarkdownStateByFileId),
          brickTabByFileId: Object.fromEntries(leftPanelBrickTabStateByFileId),
        },
        B: isSplit
          ? {
              items: rightPanelTabs.map((t) => t.fileId),
              selected: rightPanelSelectedFile?.fileId ?? null,
              markdownByFileId: Object.fromEntries(
                rightPanelMarkdownStateByFileId,
              ),
              brickTabByFileId: Object.fromEntries(
                rightPanelBrickTabStateByFileId,
              ),
            }
          : null,
      },
    });
  }, [
    isSplit,
    rightPanelTabs,
    rightPanelSelectedFile,
    leftPanelMarkdownStateByFileId,
    rightPanelMarkdownStateByFileId,
    leftPanelBrickTabStateByFileId,
    rightPanelBrickTabStateByFileId,
    storeSplitState,
  ]);

  // Persist the user's split-panel width. `EditorPanel` debounces the
  // `onLayout` calls before invoking this so we get one write per
  // drag-pause, not per frame.
  const handleSplitResize = useCallback(
    (leftPanelPercent: number) => {
      if (!storeSplitState) return;
      storeSplitState({ splitProportionLeft: leftPanelPercent });
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

    // Dismiss the previous file notice before showing a new one
    if (fileNoticeId.current !== undefined) {
      dismissSnackbar(fileNoticeId.current);
      fileNoticeId.current = undefined;
    }

    if (!notice || readOnly || filesWithToastShown.current.has(fileId)) {
      return;
    }

    fileNoticeId.current = snackbar({
      message: formatMessage(notice),
      variant: 'info',
      opts: { duration: 3000 },
    });

    filesWithToastShown.current.add(fileId);
  }, [selectedFile, readOnly, formatMessage]);

  const openInPanelB = useCallback(
    (target: SelectableFileData, insertIndex?: number, isPreview = false) => {
      // Ensure the file's content is fetched. Files start in a "pending"
      // state until the user selects them on the left panel (which triggers
      // their code subject to be instantiated); without this call, opening
      // a never-selected file in the right panel would leave the editor
      // stuck on the loading skeleton.
      preloadTab(target);

      // Seed B's markdown mode from A only on the first split — afterwards
      // the panel's mode is deliberately independent.
      setRightPanelMarkdownStateByFileId((prev) => {
        if (prev.has(target.fileId)) return prev;
        const seed = leftPanelMarkdownStateByFileId.get(target.fileId) ?? true;
        const next = new Map(prev);
        next.set(target.fileId, seed);
        return next;
      });

      const oldPreviewId = rightPanelPreviewFileIdRef.current;
      const oldSelectedId = rightPanelSelectedFile?.fileId;

      // Always use the functional updater so multiple synchronous calls
      // (e.g. dragging several files at once onto a closed panel B)
      // accumulate instead of clobbering each other through stale closures.
      setIsSplit(true);
      setRightPanelTabs((prev) => {
        const existingIdx = prev.findIndex((t) => t.fileId === target.fileId);
        if (existingIdx !== -1) {
          // Re-opening an already-open B tab without preview commits it,
          // mirroring panel A's `selectFile`.
          if (!isPreview && oldPreviewId === target.fileId) {
            setRightPanelPreviewFileId(undefined);
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
        // shared resolver so panel B stays in lock-step with panel A. Work in
        // id-space, then rebuild the object list from the resolved order.
        const { ids, previewId } = resolveNewTabInsertion({
          ids: prev.map((t) => t.fileId),
          targetId: target.fileId,
          insertIndex,
          isPreview,
          oldPreviewId,
          oldSelectedId,
        });
        setRightPanelPreviewFileId(previewId);
        const byId = new Map(prev.map((t) => [t.fileId, t]));
        byId.set(target.fileId, target);
        return ids
          .map((id) => byId.get(id))
          .filter((t): t is SelectableFileData => Boolean(t));
      });
      setRightPanelSelectedFile(target);
    },
    [
      leftPanelMarkdownStateByFileId,
      preloadTab,
      rightPanelSelectedFile?.fileId,
      setRightPanelPreviewFileId,
      rightPanelPreviewFileIdRef,
    ],
  );

  // Split sub-feature: duplicate `fileId` from `fromPanel` into the opposite
  // panel — the file remains in its origin (Split, not Move).
  const splitToOtherPanel = useCallback(
    (fileId: string | undefined, fromPanel: 'A' | 'B') => {
      if (fromPanel === 'A') {
        const target =
          fileId === undefined
            ? selectedFile
            : tabs.find((t) => t.fileId === fileId);
        if (!target) return;
        openInPanelB(target);
        return;
      }
      const resolvedId = fileId ?? rightPanelSelectedFile?.fileId;
      if (!resolvedId) return;
      // Mirror B's markdown mode into A so the duplicated view opens in
      // the same write/preview state.
      const targetInB =
        rightPanelTabs.find((t) => t.fileId === resolvedId) ??
        (rightPanelSelectedFile?.fileId === resolvedId
          ? rightPanelSelectedFile
          : undefined);
      if (targetInB?.fileExtension === 'md') {
        const bMode = rightPanelMarkdownStateByFileId.get(resolvedId);
        if (bMode !== undefined) {
          setLeftPanelMarkdownStateByFileId((prev) => {
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
      openInPanelB,
      rightPanelSelectedFile,
      rightPanelTabs,
      rightPanelMarkdownStateByFileId,
      selectFile,
    ],
  );

  const openFileInPanel = useCallback(
    (fileId: string, targetPanel: 'A' | 'B', isPreview = false) => {
      if (targetPanel === 'A') {
        selectFile({ fileId, isPreview });
        return;
      }
      // `allFiles` covers only ids that already reached a tab, so a file the
      // user never opened is in none of the three lists. Tab meta comes from
      // the path alone, so derive it instead of refusing the open.
      const target =
        tabs.find((t) => t.fileId === fileId) ??
        rightPanelTabs.find((t) => t.fileId === fileId) ??
        allFiles?.find((f) => f.fileId === fileId) ??
        metaFromPath(fileId, isAbsoluteId(fileId));
      openInPanelB(target, undefined, isPreview);
    },
    [selectFile, tabs, rightPanelTabs, allFiles, openInPanelB],
  );

  const selectFileInActiveEditorPanel = useCallback(
    (params: {
      fileId?: string;
      openAtIndex?: number;
      isPreview?: boolean;
    }): void => {
      if (getActiveEditorPanel() === 'A') {
        selectFile(params);
        return;
      }

      const { fileId, openAtIndex } = params;
      if (!fileId) {
        return;
      }

      // Same derivation as `openFileInPanel`, so a file opened this way gets
      // the icon and the read-only marking of one opened in panel A.
      openInPanelB(metaFromPath(fileId, isAbsoluteId(fileId)), openAtIndex);
    },
    [getActiveEditorPanel, selectFile, openInPanelB],
  );

  const openOrPushToSplit = useCallback(
    (fileId?: string) => splitToOtherPanel(fileId, 'A'),
    [splitToOtherPanel],
  );

  // Panel-A close wrapper: when the user closes A's last tab while panel B
  // exists, fold all B tabs back into A and collapse the split. The
  // closing tab is actually closed (so the X click takes effect) and the
  // active selection becomes whatever B had selected.
  const closeFileFromPanelA = useCallback(
    (fileId: string) => {
      const isClosingLastA = tabs.length <= 1 && tabs[0]?.fileId === fileId;
      const hasPanelB = isSplit && rightPanelTabs.length > 0;
      if (isClosingLastA && hasPanelB) {
        // Merge B's tabs into A first so A is never empty in between.
        const aIds = new Set(tabs.map((t) => t.fileId));
        rightPanelTabs.forEach((t) => {
          if (!aIds.has(t.fileId)) selectFile({ fileId: t.fileId });
        });
        // B's per-file markdown modes win (more-recent edit surface).
        setLeftPanelMarkdownStateByFileId((prev) => {
          let changed = false;
          const next = new Map(prev);
          rightPanelMarkdownStateByFileId.forEach((mode, mergedId) => {
            if (next.get(mergedId) !== mode) {
              next.set(mergedId, mode);
              changed = true;
            }
          });
          return changed ? next : prev;
        });
        setRightPanelMarkdownStateByFileId(new Map());
        const nextSelectedId = rightPanelTabs.find(
          (t) => t.fileId !== fileId,
        )?.fileId;
        if (nextSelectedId) selectFile({ fileId: nextSelectedId });
        setRightPanelTabs([]);
        setRightPanelSelectedFile(undefined);
        setIsSplit(false);
        setLeftPanelMarkdownStateByFileId((prev) => {
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
      setLeftPanelMarkdownStateByFileId((prev) => {
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
      rightPanelTabs,
      rightPanelMarkdownStateByFileId,
      selectFile,
      closeFile,
    ],
  );

  // Panel-A "Close All" wrapper. Default-loop close uses a stale `tabs`
  // closure inside the synchronous forEach, so it never lands in the
  // consolidation branch of `closeFileFromPanelA`. We do the merge once
  // here, then close every original A tab in one pass.
  const closeAllFromPanelA = useCallback(() => {
    const hasPanelB = isSplit && rightPanelTabs.length > 0;
    const keepIds = hasPanelB
      ? new Set(rightPanelTabs.map((t) => t.fileId))
      : new Set<string>();
    if (hasPanelB) {
      const aIds = new Set(tabs.map((t) => t.fileId));
      rightPanelTabs.forEach((t) => {
        if (!aIds.has(t.fileId)) selectFile({ fileId: t.fileId });
      });
      setLeftPanelMarkdownStateByFileId((prev) => {
        let changed = false;
        const next = new Map(prev);
        rightPanelMarkdownStateByFileId.forEach((mode, mergedId) => {
          if (next.get(mergedId) !== mode) {
            next.set(mergedId, mode);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
      setRightPanelMarkdownStateByFileId(new Map());
      const nextSelectedId = rightPanelSelectedFile?.fileId;
      if (nextSelectedId) selectFile({ fileId: nextSelectedId });
      setRightPanelTabs([]);
      setRightPanelSelectedFile(undefined);
      setIsSplit(false);
    }
    // The underlying `closeFile` protects the unclosable main file.
    tabs.forEach((t) => {
      if (keepIds.has(t.fileId)) return;
      setLeftPanelMarkdownStateByFileId((prev) => {
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
    rightPanelTabs,
    rightPanelSelectedFile,
    rightPanelMarkdownStateByFileId,
    selectFile,
    closeFile,
  ]);

  const selectSecretsTabInTabsBar = useCallback(() => {
    selectFile({ fileId: SKETCH_SECRETS_FILE_ID });
  }, [selectFile]);
  const closeRightPanelTab = useCallback(
    (fileId: string) => {
      if (rightPanelPreviewFileIdRef.current === fileId) {
        setRightPanelPreviewFileId(undefined);
      }
      setRightPanelMarkdownStateByFileId((prev) => {
        if (!prev.has(fileId)) return prev;
        const next = new Map(prev);
        next.delete(fileId);
        return next;
      });
      setRightPanelTabs((prev) => {
        const next = prev.filter((t) => t.fileId !== fileId);
        if (next.length === 0) {
          setIsSplit(false);
          setRightPanelSelectedFile(undefined);
        } else {
          setRightPanelSelectedFile((current) => {
            if (current?.fileId !== fileId) return current;
            const closedIdx = prev.findIndex((t) => t.fileId === fileId);
            return next[Math.min(closedIdx, next.length - 1)];
          });
        }
        return next;
      });
    },
    [setRightPanelPreviewFileId, rightPanelPreviewFileIdRef],
  );

  const renameRightPanelTab = useCallback((oldId: string, newId: string) => {
    if (oldId === newId) return;
    const rekey = <T>(prev: Map<string, T>): Map<string, T> =>
      rekeyMapEntry(prev, oldId, newId);

    setRightPanelTabs((prev) =>
      prev.some((t) => t.fileId === oldId)
        ? prev.map((t) =>
            t.fileId === oldId ? renameSelectableFile(t, newId) : t,
          )
        : prev,
    );
    setRightPanelSelectedFile((current) =>
      current?.fileId === oldId
        ? renameSelectableFile(current, newId)
        : current,
    );
    setRightPanelMarkdownStateByFileId(rekey);
    setRightPanelBrickTabStateByFileId(rekey);
  }, []);

  const moveTabToOtherPanel = useCallback(
    (fileId: string, fromPanel: 'A' | 'B', toIndex?: number) => {
      if (fromPanel === 'A') {
        const target = tabs.find((t) => t.fileId === fileId);
        if (!target) return;
        // Panel A must always have at least one tab while the editor is
        // shown. If moving this tab would empty A:
        //  - With no panel B: no-op (nowhere to land).
        //  - With panel B open: the move is realised as a collapse where
        //    panel B's content survives — B's tabs (in B's order) plus the
        //    dragged file become the single remaining panel, with the
        //    dragged file at `toIndex` (appended last when omitted —
        //    matches VS Code's last-tab move).
        if (tabs.length <= 1) {
          if (!isSplit || rightPanelTabs.length === 0) return;
          const aIds = new Set(tabs.map((t) => t.fileId));
          // Merge over B's tabs excluding the dragged file (it may be open
          // in both panels): the drop index was hit-tested against B's full
          // list, so when the dragged file sits before the drop position
          // its own slot must be discounted.
          const others = rightPanelTabs.filter((t) => !aIds.has(t.fileId));
          const draggedBIdx = rightPanelTabs.findIndex(
            (t) => t.fileId === fileId,
          );
          let dropAt: number;
          if (toIndex === undefined) {
            dropAt = others.length;
          } else {
            dropAt = Math.min(toIndex, rightPanelTabs.length);
            if (draggedBIdx !== -1 && draggedBIdx < dropAt) dropAt -= 1;
            dropAt = Math.min(dropAt, others.length);
          }
          others.forEach((t, idx) => {
            // Insert B's tabs around the dragged file (already in A at
            // index 0) so the surviving panel reads as panel B with the
            // moved file at the drop position.
            selectFile({
              fileId: t.fileId,
              openAtIndex: idx < dropAt ? idx : idx + 1,
            });
          });
          // B's per-file markdown modes win (more-recent edit surface).
          setLeftPanelMarkdownStateByFileId((prev) => {
            let changed = false;
            const next = new Map(prev);
            rightPanelMarkdownStateByFileId.forEach((mode, mergedId) => {
              if (next.get(mergedId) !== mode) {
                next.set(mergedId, mode);
                changed = true;
              }
            });
            return changed ? next : prev;
          });
          setRightPanelMarkdownStateByFileId(new Map());
          selectFile({ fileId });
          setRightPanelTabs([]);
          setRightPanelSelectedFile(undefined);
          setIsSplit(false);
          return;
        }
        openInPanelB(target, toIndex);
        closeFile(fileId);
        handleSetActiveEditorPanel('B');
        return;
      }
      const target = rightPanelTabs.find((t) => t.fileId === fileId);
      if (!target) return;
      // Mirror B's per-file markdown mode into A's per-file map before
      // removing the tab from B (closeRightPanelTab deletes the per-file
      // entry, so we must read it first).
      if (target.fileExtension === 'md') {
        const bMode = rightPanelMarkdownStateByFileId.get(fileId);
        if (bMode !== undefined) {
          setLeftPanelMarkdownStateByFileId((prev) => {
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
      closeRightPanelTab(fileId);
      handleSetActiveEditorPanel('A');
    },
    [
      tabs,
      rightPanelTabs,
      isSplit,
      openInPanelB,
      closeFile,
      selectFile,
      updateOpenFilesOrder,
      closeRightPanelTab,
      rightPanelMarkdownStateByFileId,
      handleSetActiveEditorPanel,
    ],
  );

  const useTabsBarLogic = (): ReturnType<TabsBarLogic> => {
    // Runs inside EditorTabsBar's render, so a dirty/clean transition re-renders the tabs
    // bar and nothing above it.
    const unsavedFileIds = useObservable(unsavedFiles$);
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
      closeTab: closeFileFromPanelA,
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
      onCloseAll: closeAllFromPanelA,
      // Receive a tab dropped from panel B's bar at the hovered position.
      onCrossPanelDrop: (fileId: string, insertIndex: number): void =>
        moveTabToOtherPanel(fileId, 'B', insertIndex),
    };
  };

  const tabsBarLogic = useCallback(useTabsBarLogic, [
    tabs,
    selectableMainFile,
    selectedFile,
    previewFileId,
    selectFileAndFocus,
    selectSecretsTabInTabsBar,
    closeFileFromPanelA,
    updateOpenFilesOrder,
    unsavedFiles$,
    hasSetHeightOnHover,
    addAppFile,
    renameAppFile,
    deleteAppFile,
    shouldRenderMarkdown,
    openOrPushToSplit,
    closeAllFromPanelA,
    moveTabToOtherPanel,
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

  const selectRightPanelFileById = useCallback(
    ({
      fileId,
      isPreview = false,
    }: {
      fileId?: string;
      openAtIndex?: number;
      isPreview?: boolean;
    }) => {
      setRightPanelSelectedFile(
        fileId ? rightPanelTabs.find((t) => t.fileId === fileId) : undefined,
      );
      // Tab-strip selection of an already-open tab only ever commits a
      // preview (double-click / explicit open) — it never turns a committed
      // tab back into a preview, matching panel A's `selectFile`.
      if (
        fileId &&
        !isPreview &&
        rightPanelPreviewFileIdRef.current === fileId
      ) {
        setRightPanelPreviewFileId(undefined);
      }
    },
    [rightPanelTabs, setRightPanelPreviewFileId, rightPanelPreviewFileIdRef],
  );

  const selectRightPanelFileByIdLegacy = useCallback(
    (fileId?: string) => selectRightPanelFileById({ fileId }),
    [selectRightPanelFileById],
  );

  const selectRightPanelFileAndFocus = useCallback(
    ({ fileId }: { fileId?: string }): void => {
      handleSetActiveEditorPanel('B');
      if (fileId && fileId === rightPanelSelectedFile?.fileId) {
        readEmptyTab(rightPanelSelectedFile);
      }
      selectRightPanelFileById({ fileId });
      focusActiveEditorPanel();
    },
    [
      handleSetActiveEditorPanel,
      rightPanelSelectedFile,
      readEmptyTab,
      selectRightPanelFileById,
      focusActiveEditorPanel,
    ],
  );

  const { setCode: setCode2, saveCode: saveCode2 } = useCodeChange(
    saveSketchFileQuery,
    selectRightPanelFileByIdLegacy,
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
    rightPanelSelectedFile,
    selectableMainFile,
    undefined,
    undefined,
    rightPanelTabs,
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

  const leftPanelSubjectHasValue = useSubjectHasValue(selectedFile?.fileId);
  const isLeftPanelFileLoading = !leftPanelSubjectHasValue;

  const lspEditorProps = useMemo<LspEditorProps>(
    () => ({
      isLspEnabled,
      lspWorkspaceDir,
      lspClients,
      selectFile: selectFileInActiveEditorPanel,
      startLSP,
      sendLspMessage,
      subscribeLspMessages,
      getLspWorkspaceFile,
      setLspFileValue,
      ensureLspFileValue,
      getActiveEditorPanel,
      onLspStateChange,
      showLspReferences,
      closeLspReferences,
    }),
    [
      isLspEnabled,
      lspWorkspaceDir,
      lspClients,
      selectFileInActiveEditorPanel,
      startLSP,
      sendLspMessage,
      subscribeLspMessages,
      getLspWorkspaceFile,
      setLspFileValue,
      ensureLspFileValue,
      getActiveEditorPanel,
      onLspStateChange,
      showLspReferences,
      closeLspReferences,
    ],
  );

  const codeEditorLogic = useMemo(
    () =>
      buildCodeEditorHook({
        file: selectedFile,
        fileTabs: tabs,
        setCode,
        saveCode,
        sketchDataIsLoading: isLeftPanelFileLoading,
        readOnly,
        onReceiveViewInstance: onReceiveViewInstanceA,
        lsp: lspEditorProps,
      }),
    [
      selectedFile,
      tabs,
      setCode,
      saveCode,
      isLeftPanelFileLoading,
      readOnly,
      onReceiveViewInstanceA,
      lspEditorProps,
    ],
  );

  const rightPanelSubjectHasValue = useSubjectHasValue(
    rightPanelSelectedFile?.fileId,
  );

  const isRightPanelFileLoading = !rightPanelSubjectHasValue;

  const codeEditorLogic2 = useMemo(
    () =>
      buildCodeEditorHook({
        file: rightPanelSelectedFile,
        fileTabs: rightPanelTabs,
        setCode: setCode2,
        saveCode: saveCode2,
        sketchDataIsLoading: isRightPanelFileLoading,
        readOnly,
        onReceiveViewInstance: onReceiveViewInstanceB,
        lsp: lspEditorProps,
      }),
    [
      rightPanelSelectedFile,
      rightPanelTabs,
      setCode2,
      saveCode2,
      isRightPanelFileLoading,
      readOnly,
      onReceiveViewInstanceB,
      lspEditorProps,
    ],
  );

  const selectSecretsTab = useCallback(() => {
    setRightPanelSelectedFile(
      rightPanelTabs.find((t) => t.fileId === SKETCH_SECRETS_FILE_ID),
    );
  }, [rightPanelTabs]);

  const useTabsBarLogic2 = (): ReturnType<TabsBarLogic> => {
    const unsavedFileIds = useObservable(unsavedFiles$);
    const validateFileName = useCallback(() => [], []);
    const makeUniqueFileName = useCallback((fileName: string): string => {
      return fileName;
    }, []);

    return {
      tabs: rightPanelTabs,
      selectableMainFile,
      selectedTab: rightPanelSelectedFile,
      previewFileId: rightPanelPreviewFileId,
      selectTab: selectRightPanelFileAndFocus,
      selectSecretsTab,
      closeTab: closeRightPanelTab,
      updateTabOrder: (ids: string[]) =>
        setRightPanelTabs((prev) => {
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
        (rightPanelSelectedFile?.fileExtension === 'md' &&
          rightPanelShouldRenderMarkdown) ||
        rightPanelSelectedFile?.fileExtension === BRICK_FILE_EXTENSION,
      onSplitLeft: (fileId: string) => splitToOtherPanel(fileId, 'B'),
      // Receive a tab dropped from panel A's bar at the hovered position.
      onCrossPanelDrop: (fileId: string, insertIndex: number): void =>
        moveTabToOtherPanel(fileId, 'A', insertIndex),
    };
  };

  const tabsBarLogic2 = useCallback(useTabsBarLogic2, [
    rightPanelTabs,
    selectableMainFile,
    rightPanelSelectedFile,
    rightPanelPreviewFileId,
    selectRightPanelFileAndFocus,
    selectSecretsTab,
    closeRightPanelTab,
    unsavedFiles$,
    hasSetHeightOnHover,
    addAppFile,
    renameAppFile,
    deleteAppFile,
    splitToOtherPanel,
    rightPanelShouldRenderMarkdown,
    moveTabToOtherPanel,
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
    // A markdown preview reads its text when this renders, so a file in view reloaded from disk (an agent's edit) must re-render it.
    useObservableSelector(getCodeReloadSubject(), (reload) =>
      reload?.fileId === selectedFile?.fileId ||
      reload?.fileId === rightPanelSelectedFile?.fileId
        ? reload?.id
        : undefined,
    );
    // Booleans, so EditorPanel re-renders only when the selected file's own flag changes.
    const selectedFileIsUnsaved = useObservableSelector(
      unsavedFiles$,
      (ids) => !!selectedFile?.fileId && !!ids?.has(selectedFile.fileId),
    );
    const rightPanelSelectedFileIsUnsaved = useObservableSelector(
      unsavedFiles$,
      (ids) =>
        !!rightPanelSelectedFile?.fileId &&
        !!ids?.has(rightPanelSelectedFile.fileId),
    );
    const controlsProps = {
      hideControls: true,
    } as EditorControlsProps;

    // App Lab-only state consumed by the renderers AppLabEditorPanel
    // injects (appLabContentRenderers, secretsWorkspaceRenderer); opaque
    // to the shared EditorPanel.
    const paneExtras: { A: AppLabPaneExtras; B: AppLabPaneExtras } = {
      A: {
        brickDetailLogic,
        brickSelectedTab,
        setBrickSelectedTab,
        secretsEditorLogic,
      },
      B: {
        brickDetailLogic,
        brickSelectedTab: rightPanelBrickSelectedTab,
        setBrickSelectedTab: setRightPanelBrickSelectedTab,
      },
    };

    return {
      tabsBarLogic,
      codeEditorLogic,
      paneExtras,
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
      canSwitchMarkdownMode: !selectedFileIsUnsaved,
      readOnly,
      isSplit,
      openOrPushToSplit,
      splitToOtherPanel,
      moveTabToOtherPanel,
      openFileInPanel,
      activeEditorPanel,
      setActiveEditorPanel: handleSetActiveEditorPanel,
      panelATabsCount: tabs.length,
      splitPanelCodeEditorLogic: codeEditorLogic2,
      splitPanelTabsBarLogic: tabsBarLogic2,
      splitPanelFileId: rightPanelSelectedFile?.fileId,
      splitPanelFile: rightPanelSelectedFile
        ? {
            id: rightPanelSelectedFile.fileId,
            ext: rightPanelSelectedFile.fileExtension,
            getData: getDataFromFile(rightPanelSelectedFile, appPath),
            error: rightPanelSelectedFile.error,
          }
        : undefined,
      splitPanelShouldRenderMarkdown: rightPanelShouldRenderMarkdown,
      splitPanelSetShouldRenderMarkdown: setRightPanelShouldRenderMarkdown,
      splitPanelCanSwitchMarkdownMode: !rightPanelSelectedFileIsUnsaved,
      storedSplitProportionLeft: openFilesStore?.splitProportionLeft,
      onSplitResize: handleSplitResize,
      onToggleAgentPanel,
      agentPanelOpen,
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
    unsavedFiles$,
    readOnly,
    isSplit,
    openOrPushToSplit,
    splitToOtherPanel,
    moveTabToOtherPanel,
    openFileInPanel,
    activeEditorPanel,
    handleSetActiveEditorPanel,
    tabs.length,
    codeEditorLogic2,
    tabsBarLogic2,
    rightPanelSelectedFile,
    rightPanelShouldRenderMarkdown,
    setRightPanelShouldRenderMarkdown,
    brickSelectedTab,
    setBrickSelectedTab,
    rightPanelBrickSelectedTab,
    setRightPanelBrickSelectedTab,
    openFilesStore?.splitProportionLeft,
    handleSplitResize,
    onToggleAgentPanel,
    agentPanelOpen,
  ]);

  return {
    editorPanelLogic,
    openFileInPanel,
    getActiveEditorPanel,
    activeEditorPanel,
    rightPanelSelectedFile,
    rightPanelTabs,
    renameRightPanelTab,
    closeRightPanelTab,
    closeFileFromPanelA,
    openBrickAiModelsTab,
  };
};
