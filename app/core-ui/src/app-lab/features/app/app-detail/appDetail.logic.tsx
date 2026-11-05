import {
  addAppBrick as addAppBrickRequest,
  addAppCustomBrick as addAppCustomBrickRequest,
  deleteAppBrick,
  getAppBricks,
  getAppDetail,
  getBricks,
  getUnsavedFilesSubject,
  importResourceToAppFromPath,
  onAgentRenamedApp,
  onAgentRenamedAppFile,
  openFileExternal,
  openLinkExternal,
  renameAppCustomBrick as renameAppCustomBrickRequest,
  selectResourcePathToImport,
  statAppPath,
  updateAppBrick as updateAppBrickRequest,
  updateAppDetail,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { FileIcon } from '@cloud-editor-mono/images/assets/file-icons';
import {
  AppDetailedInfo,
  BOARD_STORAGE_FULL_ERROR,
  BrickCreateUpdateRequest,
  UpdateAppDetailRequest,
} from '@cloud-editor-mono/infrastructure';
import {
  AGENT_SETTINGS_SECTION_ID,
  AgentEditorContext,
  AiModelRequiredDialogLogic,
  AppLabAppDetailLogic,
  AppLabEditorPanelLogic,
  AppLabEditSectionLogic,
  AppsSection,
  BRICK_FILE_EXTENSION,
  isEdgeImpulseModel,
  isFileNode,
  isFolderNode,
  SelectableFileData,
  TreeNode,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import {
  ConflictType,
  DuplicateFileDialogLogic,
  OnDuplicateConflictParams,
} from '@cloud-editor-mono/ui-components/lib/dialogs/app-lab/duplicate-file-dialog/types';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { WretchError } from 'wretch/resolver';

import { useKeywords } from '../../../../common/hooks/keywords';
import { queryClient } from '../../../../common/providers/data-fetching/QueryProvider';
import { BoardScopedQuery } from '../../../boardScopedQuery';
import {
  makeAppBrickDetailLogic,
  useConfigureAppBrickDialog,
} from '../../../hooks/useBrickDetail';
import { useImportResource } from '../../../hooks/useImportResource';
import { useIsBoard } from '../../../hooks/useIsBoard';
import { useNotFound } from '../../../hooks/useNotFound';
import {
  clearOpenAgentPanel,
  clearPendingAppFile,
  listenForAppFile,
  markRenamedInPlace,
  peekOpenAgentPanel,
  peekPendingAppFile,
  setAgentFileRenameHandled,
  stashOpenAgentPanel,
} from '../../../openAppFile';
import { LanguageServerContext } from '../../../providers/language-server/languageServerContext';
import { NetworkContext } from '../../../providers/network/networkContext';
import { DETAIL_PATH_BY_SECTION } from '../../../routes/__root';
import { useBoardLifecycleStore } from '../../../store/boardLifecycle';
import { useNetworkSettingsDialogStore } from '../../../store/networkSettingsDialog';
import { getBoardCacheId } from '../../../utils/board';
import { createWebUIFiles } from '../../../utils/create-webui-files';
import { SKETCH_YAML_TEMPLATE } from '../../../utils/sketch-file-templates';
import { sendAppLabNotification } from '../../notifications';
import { readAgentEditorContext } from './hooks/agentEditorContext';
import { splitFileName, toAppRelativeId } from './hooks/filePaths';
import {
  isSketchFilePath,
  SketchFileCheckError,
  useAddSketch,
} from './hooks/useAddSketch';
import { useAppFiles } from './hooks/useAppFiles';
import { useAppHasSketch } from './hooks/useAppHasSketch';
import { useEditorFiles } from './hooks/useEditorFiles';
import { keepMovedBuffer, useFileOperations } from './hooks/useFileOperations';
import { useFileWatch } from './hooks/useFileWatch';
import { useLSP } from './hooks/useLSP';
import { useSketchLibraries } from './hooks/useSketchLibraries';
import { useAddSketchLibraryDialog } from './hooks/useSketchLibrariesDialogs';
import { messages } from './messages';
import { moveAppQueries, renamedAppPath } from './renameInPlace';
import { useCreateEditorPanelLogic } from './sub-components/editor-panel/appLabEditorPanel';
import { EditorPanelLogicParams } from './sub-components/editor-panel/appLabEditorPanel.type';
import { useAppDetailRuntimeLogic } from './sub-components/runtime/appDetailRuntime';
import { useCreateAppTitleLogic } from './sub-components/title/appDetailTitle';

const RENAME_MESSAGES = {
  file: {
    success: messages.successfullyRenamedFile,
    error: messages.failedRenameFile,
  },
  folder: {
    success: messages.successfullyRenamedFolder,
    error: messages.failedRenameFolder,
  },
} as const;

const DELETE_MESSAGES = {
  file: {
    success: messages.successfullyDeletedFile,
    error: messages.failedDeleteFile,
  },
  folder: {
    success: messages.successfullyDeletedFolder,
    error: messages.failedDeleteFolder,
  },
} as const;

const defaultOpenFoldersState = {};

// The read's answer for a folder (a link to one shows in the tree as a file): no later read can work. `cat` says "Is a directory".
const isFolderReadError = (error: unknown): boolean =>
  /is a directory/i.test(
    error instanceof Error ? error.message : String(error),
  );

export const useAppDetailLogic: AppLabAppDetailLogic = function (
  appId: string,
  section: AppsSection,
): ReturnType<AppLabAppDetailLogic> {
  const { activeSelectedFile, setActiveSelectedFile } = useContext(
    LanguageServerContext,
  );
  const [deleteItemDialogOpen, setDeleteItemDialogOpen] = useState(false);
  const [deleteItemFileName, setDeleteItemFileName] = useState<string>('');
  const [deleteItemIsDirectory, setDeleteItemIsDirectory] = useState(false);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<
    (() => Promise<void>) | null
  >(null);
  const navigate = useNavigate({
    from: DETAIL_PATH_BY_SECTION[section || 'examples'],
  });

  const openApp = useCallback(
    (app: AppDetailedInfo) => {
      navigate({
        to: `/${app.example ? 'examples' : 'my-apps'}/${app.id}`,
      });
    },
    [navigate],
  );

  const { formatMessage } = useI18n();

  const [initialAppBrickTab, setInitialAppBrickTab] = useState<string>();
  const [selectedNode, setSelectedNode] = useState<TreeNode>();
  const [selectedFolder, setSelectedFolderState] = useState<TreeNode>();

  const [conflictQueue, setConflictQueue] = useState<
    Array<OnDuplicateConflictParams>
  >([]);

  const duplicateDialog = conflictQueue[0];

  const handleDuplicateConflict = useCallback(
    (params: OnDuplicateConflictParams) => {
      setConflictQueue((prev) => [...prev, params]);
    },
    [],
  );

  const { data: isBoard } = useIsBoard();
  const boardIsReachable = useBoardLifecycleStore(
    (state) => state.boardIsReachable,
  );

  const [updateOpenFile, setUpdateOpenFile] = useState<
    (currFileId: string, nextFileId: string) => void
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  >(() => () => {});

  const {
    data: app,
    isLoading: appDetailIsLoading,
    isError: appDetailFailed,
    refetch: refetchAppDetail,
  } = useQuery({
    queryKey: [BoardScopedQuery.LIST_MY_APPS, appId],

    queryFn: () => getAppDetail(appId),
  });

  // Read-only example/inspiration apps and installed releases can't run the
  // agent, so the side panel is only available for the user's own custom apps.
  const isReleaseApp = app?.release === true;
  const isReadOnlyApp = section === 'examples' || isReleaseApp;

  // The agent side panel's own open/close state — a second, additive entry point
  // (toolbar icon, ⌘L) next to the footer bar's full-screen Agent Mode swap.
  // Deliberately independent of that route-driven `aiAssistantActive` flag.
  const [agentPanelOpen, setAgentPanelOpen] = useState(() =>
    peekOpenAgentPanel(appId),
  );
  useEffect(() => {
    clearOpenAgentPanel(appId);
  }, [appId]);
  // Agent Mode unmounts this screen: an open panel must be open again when the user comes back from it.
  const router = useRouter();
  const agentPanelOpenRef = useRef(agentPanelOpen);
  agentPanelOpenRef.current = agentPanelOpen;
  const appIdRef = useRef(appId);
  appIdRef.current = appId;
  useEffect(
    () => () => {
      const toAgentMode =
        router.state.location.pathname.startsWith('/ai-assistant');
      if (agentPanelOpenRef.current && toAgentMode) {
        stashOpenAgentPanel(appIdRef.current);
      }
    },
    [router],
  );
  const toggleAgentPanel = useCallback(
    () => setAgentPanelOpen((prev) => !prev),
    [],
  );
  const closeAgentPanel = useCallback(() => setAgentPanelOpen(false), []);
  const openAgentSettings = useCallback(
    () => navigate({ to: '/settings', hash: AGENT_SETTINGS_SECTION_ID }),
    [navigate],
  );

  // ⌘L toggles the side panel. It lives here rather than in EditorPanel because the shortcut is
  // window-wide while that component is presentational. Read-only apps have no panel, so they leave
  // ⌘L to whatever else wants it.
  const agentModeActive = useRouterState({
    select: (state) => state.location.pathname.startsWith('/ai-assistant'),
  });
  useEffect(() => {
    if (isReadOnlyApp || agentModeActive) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() === 'l' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleAgentPanel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isReadOnlyApp, agentModeActive, toggleAgentPanel]);

  const editorPanelSyncRef = useRef<{
    renameRightPanelTab?: (oldId: string, newId: string) => void;
    closeRightPanelTab?: (fileId: string) => void;
    closeFileFromPanelA?: (fileId: string) => void;
  }>({});

  const {
    data: appBricks,
    isError: appBricksFailed,
    refetch: refetchAppBricks,
  } = useQuery({
    queryKey: [BoardScopedQuery.APP_BRICKS, appId],
    queryFn: () => getAppBricks(appId),
  });

  const onListError = useCallback(
    (relDir: string) => {
      sendAppLabNotification({
        message: formatMessage(messages.failedListFolder, { folder: relDir }),
        variant: 'error',
      });
    },
    [formatMessage],
  );

  const {
    defaultFilePath,
    fileTree,
    appDirListed,
    appDirFailed,
    expandDir,
    collapseDir,
    revealPath,
    findFileNode,
    invalidateDirs,
    unlistDir,
    relistDir,
    listFailure,
    renameDir,
    refetchAppYaml,
    refetchSketchYaml,
    fetchFile,
    refreshFileContents,
  } = useAppFiles({
    appId,
    appPath: app?.path,
    onListError,
  });

  const handleFolderExpand = useCallback(
    (path: string, isOpen: boolean) => {
      if (isOpen) expandDir(path);
      else collapseDir(path);
    },
    [expandDir, collapseDir],
  );

  // A failed refetch keeps the last good `app`, so an app that is gone needs a second signal: its directory on the board, missing only when it really went away — a broken app.yaml leaves the tree readable, and bouncing the user out of that one would strand them. Reachability gates the pair because invalidateManifest refetches both keys at once, so a single board hiccup fails both.
  const appIsGone = appDetailFailed && appDirFailed && boardIsReachable;
  // Cold (no cached app) this cannot help: appPath is unknown, so the file tree never runs and a broken app.yaml still redirects on the branch below.
  const shouldRedirect = (!appDetailIsLoading && !app?.id) || appIsGone;
  useNotFound(shouldRedirect, section);

  const selectedBoard = useBoardLifecycleStore(
    (state) => state.selectedConnectedBoard,
  );

  const {
    isLspEnabled,
    lspWorkspaceDir,
    lspClients,
    createLspNode,
    renameLspNode,
    deleteLspNode,
    syncLspWatchedChange,
    startLSP,
    sendLspMessage,
    subscribeLspMessages,
    getLspWorkspaceFile,
    reloadLspFile,
    lspReferencesResult,
    showLspReferences,
    closeLspReferences,
    lspGoToReference,
    lspState,
    onLspStateChange,
  } = useLSP(appId, selectedBoard);

  const storeEntityId = useMemo(() => {
    if (!app) return undefined;

    // For examples, keep same persistence across boards
    if (app.example) return `${app.id}-example`;

    if (selectedBoard?.serial) return `${app.id}-${selectedBoard.serial}`;
    // Fallback
    return app.id;
  }, [app, selectedBoard?.serial]);

  const {
    editorFiles,
    openFiles,
    openFileIds,
    selectedFile,
    selectFile,
    updateOpenFile: actualUpdateOpenFile,
    updateOpenFilesOrder,
    closeFile,
    onAppRename,
    previewFileId,
    openFilesStore,
    tabsHydrated,
    storeSplitState,
  } = useEditorFiles({
    storeEntityId,
    boardId: getBoardCacheId(selectedBoard),
    appPath: app?.path,
    defaultFilePath,
    appDirListed,
    appBricks,
    appBricksFailed,
    getUnsavedFilesSubject,
  });

  // The agent renamed this app, which gives it a new id: follow it there in place, so the editor and the side panel keep their state.
  useEffect(
    () =>
      onAgentRenamedApp((oldId, newId, newName) => {
        if (oldId !== appId) {
          return;
        }
        // On the board the language servers run in the app folder itself, so only a remount moves them to the new one.
        const newPath =
          section === 'my-apps' && isBoard === false && app?.path
            ? renamedAppPath(app.path, oldId, newId)
            : undefined;
        if (app && newPath) {
          moveAppQueries(
            queryClient,
            oldId,
            { ...app, id: newId, name: newName || app.name, path: newPath },
            storeEntityId,
          );
          markRenamedInPlace(oldId, newId);
        }
        if (agentPanelOpen) {
          stashOpenAgentPanel(newId);
        }
        navigate({ to: `/${section}/${newId}`, replace: true });
      }),
    [agentPanelOpen, app, appId, isBoard, navigate, section, storeEntityId],
  );

  const closeFileBothPanels = useCallback(
    (fileId: string) => {
      // Route panel A through the consolidating close (fold panel B's tabs
      // back into A when A's LAST tab closes, collapsing the split) — the
      // same path a user's X-click takes. A raw closeFile that empties panel
      // A blanks the whole editor panel (its render gates on panel A's open
      // files) while panel B silently keeps its tabs: an external delete of
      // panel A's only file then "closes" both panels, and reselecting the
      // panel-B file resurrects it doubled (preview in A, committed in B).
      const closePanelA =
        editorPanelSyncRef.current.closeFileFromPanelA ?? closeFile;
      closePanelA(fileId);
      editorPanelSyncRef.current.closeRightPanelTab?.(fileId);
    },
    [closeFile],
  );

  // Only a folder's tab closes: any other failure can pass, so the tab and the stored record stay for the next read.
  const fileLoadFailed = useCallback(
    (fileId: string, error: unknown) => {
      console.error('open file failed', error);
      const isFolder = isFolderReadError(error);
      sendAppLabNotification({
        message: formatMessage(
          isFolder ? messages.couldNotOpenFolder : messages.couldNotOpenFile,
        ),
        variant: 'error',
      });
      if (isFolder) {
        closeFileBothPanels(fileId);
      }
    },
    [closeFileBothPanels, formatMessage],
  );

  // With the brick list failed a brick tab looks like a file: a brick id names no path, and the root listing has every root file.
  const canReadTab = useCallback(
    (fileId: string): boolean => {
      if (appBricks) {
        return !appBricks.some((brick) => brick.id === fileId);
      }
      if (!appBricksFailed || fileId.includes('/')) {
        return true;
      }
      const node = findFileNode(fileId);
      return !!node && isFileNode(node);
    },
    [appBricks, appBricksFailed, findFileNode],
  );

  const { renameFile, deleteFile, removeFolder, addFile, addFolder, openFile } =
    useFileOperations({
      appId,
      appPath: app?.path,
      invalidateDirs,
      unlistDir,
      renameDir,
      fetchFile,
      selectFile,
      closeFile: closeFileBothPanels,
      updateOpenFile,
      createLspNode,
      deleteLspNode,
      renameLspNode,
    });

  const hasSketch = useAppHasSketch({
    appId,
    appPath: app?.path,
    fileTree,
    rootFailed: appDirFailed,
    boardIsReachable,
  });

  const notifyAddSketchFailed = useCallback(() => {
    sendAppLabNotification({
      message: formatMessage(messages.failedAddSketch),
      variant: 'error',
    });
  }, [formatMessage]);

  const { addSketch, createSketchFile } = useAddSketch({
    appPath: app?.path,
    addFolder,
    addFile,
    deleteFile,
    removeFolder,
    openFile,
    revealPath,
    invalidateDirs,
    onAddSketchError: notifyAddSketchFailed,
  });

  const { isConnected, networkStatusChecked } = useContext(NetworkContext);
  // Reachable and checked: an unreachable board, or the first poll still
  // running, is not "offline".
  const boardOffline =
    boardIsReachable && !!networkStatusChecked && !isConnected;
  const setNetworkSettingsDialogOpen = useNetworkSettingsDialogStore(
    (state) => state.setOpen,
  );
  const openNetworkSettings = useCallback(
    () => setNetworkSettingsDialogOpen(true),
    [setNetworkSettingsDialogOpen],
  );

  const selectableMainFile: SelectableFileData | undefined = undefined;

  useEffect(() => {
    setUpdateOpenFile(() => (currFileId: string, nextFileId: string) => {
      actualUpdateOpenFile(currFileId, nextFileId);
      editorPanelSyncRef.current.renameRightPanelTab?.(currFileId, nextFileId);
    });
  }, [actualUpdateOpenFile]);

  // A folder renamed on the board, by the agent or from the tree itself: the file tree reopens it, and its open subfolders, only on this.
  const [renamedFolder, setRenamedFolder] = useState<{
    from: string;
    to: string;
    seq: number;
  }>();
  const announceRenamedFolder = useCallback((from: string, to: string) => {
    setRenamedFolder((previous) => ({
      from,
      to,
      seq: (previous?.seq ?? 0) + 1,
    }));
  }, []);
  // The agent renamed a file or folder of this app on the board: its tabs follow, as after a rename in the file tree.
  const appPath = app?.path;
  useEffect(() => {
    if (!appPath) {
      return undefined;
    }
    setAgentFileRenameHandled(appPath, true);
    const unsubscribe = onAgentRenamedAppFile(
      (_appId, renamedIn, from, to, isFolder) => {
        if (renamedIn !== appPath) {
          return;
        }
        void renameFile(from, to, {
          source: 'stream',
          nodeType: isFolder ? 'folder' : 'file',
        });
        // Announced like a move in a board terminal: the language servers also resolve files no tab has open.
        syncLspWatchedChange?.(from, 'remove');
        syncLspWatchedChange?.(to, 'create');
        if (isFolder) {
          announceRenamedFolder(from, to);
        }
      },
    );
    return () => {
      unsubscribe();
      setAgentFileRenameHandled(appPath, false);
    };
  }, [appPath, renameFile, syncLspWatchedChange, announceRenamedFolder]);

  // Auto-open a file requested from outside the router (e.g. the AI assistant's file chip): open the stashed target once the tree has reached it. Listing its ancestors is what answers "does it exist" — no stat, and nothing to fail half way.
  // An object per request, so asking again for the file already asked for still opens it.
  const [pendingAgentFile, setPendingAgentFile] = useState(() => {
    const file = peekPendingAppFile(appId);
    return file === undefined ? undefined : { file };
  });
  const openedPendingFileRef = useRef(false);
  useEffect(
    () =>
      listenForAppFile(appId, (file) => {
        openedPendingFileRef.current = false;
        setPendingAgentFile({ file });
      }),
    [appId],
  );
  useEffect(() => {
    // Also wait for the editor to restore its stored tabs, so the file opens among them.
    if (openedPendingFileRef.current || !pendingAgentFile || !tabsHydrated) {
      return;
    }
    const { file } = pendingAgentFile;
    revealPath(file);
    if (!findFileNode(file)) return;

    openedPendingFileRef.current = true;
    clearPendingAppFile(appId);
    void openFile(file);
  }, [
    appId,
    pendingAgentFile,
    openFile,
    tabsHydrated,
    revealPath,
    findFileNode,
  ]);

  const notifyConflictCheckFailed = useCallback((): void => {
    sendAppLabNotification({
      message: formatMessage(messages.failedCheckPathConflict),
      variant: 'error',
    });
  }, [formatMessage]);

  // Resolved against the backend, not the file list: the tree is lazily loaded
  // and may never have listed the path being checked. It throws rather than
  // reporting "free" when it cannot tell — every caller writes to the path it
  // clears, and the backend truncates whatever is already there.
  const checkPathConflict = useCallback(
    async (
      relPath: string,
      wantedType: 'file' | 'folder',
    ): Promise<{ hasDuplicate: boolean; conflictType: ConflictType }> => {
      if (!app?.path) {
        throw new Error('Cannot check for conflicts: the app has no path');
      }

      const existing = await statAppPath(`${app.path}/${relPath}`);
      if (!existing) {
        return { hasDuplicate: false, conflictType: null };
      }

      return {
        hasDuplicate: true,
        conflictType: `${wantedType}-${
          existing.isDir ? 'folder' : 'file'
        }` as ConflictType,
      };
    },
    [app?.path],
  );

  // The backend hides an import from the file watcher, so the language
  // servers learn about the imported file or folder here.
  const importIntoApp = useCallback(
    async (
      remoteDir: string,
      sourcePath: string,
      isFolder?: boolean,
      newFileName?: string,
    ): ReturnType<typeof importResourceToAppFromPath> => {
      const result = await importResourceToAppFromPath(
        remoteDir,
        sourcePath,
        isFolder,
        newFileName,
      );
      const path = toAppRelativeId(result.id, app?.path);
      syncLspWatchedChange?.(path, 'create');
      // An import may overwrite a file the server already holds open.
      void reloadLspFile?.(path);
      return result;
    },
    [app?.path, syncLspWatchedChange, reloadLspFile],
  );

  // The file tree and the OS import abort on a rejection but cannot report it,
  // so the notification is raised here on the way out.
  const checkPathConflictReported = useCallback(
    async (
      relPath: string,
      wantedType: 'file' | 'folder',
    ): Promise<{ hasDuplicate: boolean; conflictType: ConflictType }> => {
      try {
        return await checkPathConflict(relPath, wantedType);
      } catch (error) {
        notifyConflictCheckFailed();
        throw error;
      }
    },
    [checkPathConflict, notifyConflictCheckFailed],
  );

  const duplicateFileDialogLogic: DuplicateFileDialogLogic = useCallback(
    () => ({
      open: conflictQueue.length > 0,
      fileName: duplicateDialog?.fileName || '',
      conflictType: duplicateDialog?.conflictType || null,

      onOverwrite: async (): Promise<boolean> => {
        if (!duplicateDialog) {
          return false;
        }
        try {
          if (!duplicateDialog.sourcePath || !duplicateDialog.targetPath) {
            console.error('Source or target path is missing');
            return false;
          }
          // What is being moved is the first half of the conflict type: a
          // `folder-file` is a folder dropped onto a file, not a file.
          const movedNodeType = duplicateDialog.conflictType?.startsWith(
            'folder',
          )
            ? 'folder'
            : 'file';
          // For folder-folder conflicts, delete target folder first, then move source
          if (duplicateDialog.conflictType === 'folder-folder') {
            // Close all files in target folder
            const filesInTargetFolder = openFiles.filter((f) =>
              f.fileId.startsWith(duplicateDialog.targetPath + '/'),
            );
            filesInTargetFolder.forEach((f) => closeFile(f.fileId));

            // Delete target folder
            await deleteFile(duplicateDialog.targetPath, {
              nodeType: 'folder',
            });
          } else {
            // For file-file conflicts, close target file if it's open
            if (
              openFiles.some((f) => f.fileId === duplicateDialog.targetPath)
            ) {
              closeFile(duplicateDialog.targetPath);
            }
          }

          if (duplicateDialog.isExternalImport) {
            const isFolder = duplicateDialog.conflictType?.startsWith('folder');
            const targetDir = duplicateDialog.targetPath.includes('/')
              ? duplicateDialog.targetPath.substring(
                  0,
                  duplicateDialog.targetPath.lastIndexOf('/'),
                )
              : '';
            const remoteDir = targetDir
              ? `${app?.path}/${targetDir}`
              : app?.path ?? '';

            await importIntoApp(
              remoteDir,
              duplicateDialog.sourcePath,
              isFolder,
            );
            invalidateDirs();
            queryClient.invalidateQueries({
              queryKey: ['get-batch-app-file-content'],
            });
          } else {
            await renameFile(
              duplicateDialog.sourcePath,
              duplicateDialog.targetPath,
              { nodeType: movedNodeType },
            );
          }
          const isLastItem = conflictQueue.length <= 1;
          setConflictQueue((prev) => prev.slice(1));

          return isLastItem;
        } catch (error) {
          console.error('Failed to overwrite duplicate:', error);
          return false;
        }
      },

      onKeepBoth: async (): Promise<boolean> => {
        try {
          if (!duplicateDialog.sourcePath || !duplicateDialog.targetPath) {
            console.error('Source or target path is missing');
            return false;
          }
          const targetPath = duplicateDialog.targetPath;
          const lastDotIndex = targetPath.lastIndexOf('.');
          const baseName =
            lastDotIndex !== -1
              ? targetPath.substring(0, lastDotIndex)
              : targetPath;
          const extension =
            lastDotIndex !== -1 ? targetPath.substring(lastDotIndex) : '';

          // Incremental naming logic
          const keepBothType = duplicateDialog.conflictType?.startsWith(
            'folder',
          )
            ? 'folder'
            : 'file';
          let newPath = `${baseName}_copy${extension}`;
          let counter = 1;

          while (
            (await checkPathConflict(newPath, keepBothType)).hasDuplicate
          ) {
            newPath = `${baseName}_copy_${counter}${extension}`;
            counter++;
          }

          if (duplicateDialog.isExternalImport) {
            const isFolder = duplicateDialog.conflictType?.startsWith('folder');
            const targetDir = duplicateDialog.targetPath.includes('/')
              ? duplicateDialog.targetPath.substring(
                  0,
                  duplicateDialog.targetPath.lastIndexOf('/'),
                )
              : '';
            const remoteDir = targetDir
              ? `${app?.path}/${targetDir}`
              : app?.path ?? '';
            const newFileName = newPath.split('/').pop() || '';

            await importIntoApp(
              remoteDir,
              duplicateDialog.sourcePath,
              isFolder,
              newFileName,
            );
            invalidateDirs();
            queryClient.invalidateQueries({
              queryKey: ['get-batch-app-file-content'],
            });
          } else {
            await renameFile(duplicateDialog.sourcePath, newPath, {
              nodeType: keepBothType,
            });
          }

          const isLastItem = conflictQueue.length <= 1;
          setConflictQueue((prev) => prev.slice(1));
          return isLastItem;
        } catch (error) {
          console.error('Failed to keep both:', error);
          return false;
        }
      },

      onOpenChange: (open: boolean): void => {
        if (!open) {
          setConflictQueue([]);
        }
      },
    }),
    [
      conflictQueue,
      duplicateDialog,
      renameFile,
      deleteFile,
      app?.path,
      checkPathConflict,
      openFiles,
      closeFile,
      invalidateDirs,
      importIntoApp,
    ],
  );

  const selectedFileId = selectedFile?.fileId;
  // Read by the load below, not watched: a reset of the brick list shows a brick tab as a file, and must not load it.
  const selectionRef = useRef({ selectedFile, fileLoadFailed, canReadTab });
  selectionRef.current = { selectedFile, fileLoadFailed, canReadTab };
  useEffect(() => {
    // A brick tab is named by the brick's id: there is no file to read.
    const isBrick =
      selectionRef.current.selectedFile?.fileExtension === BRICK_FILE_EXTENSION;
    if (
      selectedFileId &&
      !isBrick &&
      selectionRef.current.canReadTab(selectedFileId) &&
      !keepMovedBuffer(selectedFileId)
    ) {
      fetchFile(selectedFileId).catch((error) =>
        selectionRef.current.fileLoadFailed(selectedFileId, error),
      );
    }
  }, [fetchFile, selectedFileId]);

  useEffect(() => {
    if (selectedFile?.fileId) {
      setSelectedFolderState(undefined);
    }
  }, [selectedFile?.fileId]);

  const addAppBrick = useCallback(
    async (
      brickId: string,
      params: BrickCreateUpdateRequest = {},
      isCustom = false,
    ): Promise<boolean> => {
      const response = await addAppBrickRequest(appId, brickId, params);

      if (response) {
        await refetchAppYaml();
        await refetchAppBricks();

        // Check if this is the WebUI brick and create required files automatically AFTER successful brick addition
        if (brickId === 'arduino:web_ui' && app?.name) {
          try {
            await createWebUIFiles(app.name, addFolder, addFile);
          } catch (error) {
            console.error('Failed to create WebUI files:', error);
            sendAppLabNotification({
              message: formatMessage(messages.webUIFileCreationFailed),
              variant: 'error',
            });
          }
        }

        setInitialAppBrickTab('examples');
        selectFile({ fileId: brickId });
        sendAppLabNotification({
          message: formatMessage(
            isCustom
              ? messages.successfullyAddedCustomBrick
              : messages.successfullyAddedBrick,
          ),
          variant: 'success',
        });
        return true;
      }

      sendAppLabNotification({
        message: formatMessage(messages.failedAddBrick),
        variant: 'error',
      });
      return false;
    },
    [
      appId,
      app,
      refetchAppYaml,
      refetchAppBricks,
      addFolder,
      addFile,
      selectFile,
      formatMessage,
    ],
  );

  const removeAppBrick = useCallback(
    async (brickId: string): Promise<boolean> => {
      const response = await deleteAppBrick(appId, brickId);
      if (response) {
        await refetchAppYaml();
        await refetchAppBricks();
        closeFile(brickId);
        sendAppLabNotification({
          message: formatMessage(messages.successfullyDeletedBrick),
          variant: 'success',
        });
      } else {
        sendAppLabNotification({
          message: formatMessage(messages.failedDeleteBrick),
          variant: 'error',
        });
      }
      return response;
    },
    [appId, closeFile, formatMessage, refetchAppBricks, refetchAppYaml],
  );

  const addAppCustomBrick = useCallback(
    async (
      appId: string,
      body: {
        name: string;
        description?: string;
      },
    ): Promise<{ id: string } | undefined> => {
      try {
        const response = await addAppCustomBrickRequest(appId, body);

        if (response && response.id) {
          invalidateDirs();
          // A tab id missing from the brick list is shown as a file, so the
          // tab opens only once the list has the new brick.
          await refetchAppBricks();
          selectFile({ fileId: response.id });
          await refetchAppYaml();
          return response;
        }

        sendAppLabNotification({
          message: formatMessage(messages.failedAddCustomBrick),
          variant: 'error',
        });
      } catch (error) {
        if ((error as WretchError).status === 405) {
          sendAppLabNotification({
            message: formatMessage(messages.updateAppLab),
            variant: 'info',
            actions: [
              {
                text: 'Go to settings',
                onClick: () => navigate({ to: '/settings' }),
              },
            ],
          });
        } else if ((error as WretchError).status === 409) {
          sendAppLabNotification({
            message: formatMessage(messages.failedAddCustomBrick),
            variant: 'error',
          });
        } else {
          sendAppLabNotification({
            message: formatMessage(messages.failedAddCustomBrick),
            variant: 'error',
          });
        }
      }
    },
    [
      formatMessage,
      selectFile,
      refetchAppBricks,
      invalidateDirs,
      refetchAppYaml,
      navigate,
    ],
  );

  const renameAppCustomBrick = useCallback(
    async (brickId: string, params: { name: string }): Promise<boolean> => {
      const newBrickId = await renameAppCustomBrickRequest(
        appId,
        brickId,
        params,
      );
      if (newBrickId) {
        // The backend has already moved the folder, so `source: 'stream'` runs
        // only the local side of a folder rename. It runs first: while the old
        // folder is still expanded, any refetch of it fails.
        await renameFile(`bricks/${brickId}`, `bricks/${newBrickId}`, {
          nodeType: 'folder',
          source: 'stream',
        });
        // The brick tab is keyed by the brick id, and a tab id missing from
        // the brick list is shown as a file, so the tab is renamed only once
        // the list has the new id.
        await refetchAppBricks();
        updateOpenFile(brickId, newBrickId);
        await refetchAppYaml();
        sendAppLabNotification({
          message: formatMessage(messages.successfullyRenamedBrick),
          variant: 'success',
        });
        return true;
      } else {
        sendAppLabNotification({
          message: formatMessage(messages.failedRenameBrick),
          variant: 'error',
        });
        return false;
      }
    },
    [
      appId,
      formatMessage,
      refetchAppBricks,
      refetchAppYaml,
      renameFile,
      updateOpenFile,
    ],
  );

  const addFileHandler = useCallback(
    async (path: string) => {
      const fullName = path.split('/').pop();
      if (!fullName) {
        console.error('Invalid file name');
        return;
      }

      const { fileName, fileExtension } = splitFileName(fullName);
      const prevSelectedFileId = selectedFile?.fileId;

      try {
        const { hasDuplicate, conflictType } = await checkPathConflict(
          path,
          'file',
        );

        if (hasDuplicate) {
          // Show notification for all conflict types during creation
          const message =
            conflictType === 'file-folder'
              ? formatMessage(messages.fileAlreadyExistsFolder)
              : formatMessage(messages.fileAlreadyExists);
          sendAppLabNotification({
            message,
            variant: 'error',
          });
          return;
        }
      } catch (error) {
        console.error('Failed to check file existence:', error);
        notifyConflictCheckFailed();
        return;
      }

      // this row auto-open newly created files in editor
      selectFile({ fileId: path });
      try {
        if (isSketchFilePath(path)) {
          await createSketchFile(path);
        } else {
          // The daemon reads only `<app>/sketch/sketch.yaml`, but a sketch.yaml
          // anywhere is given the profile it needs.
          const content =
            fullName === 'sketch.yaml' ? SKETCH_YAML_TEMPLATE : '';
          await addFile(path, fileName, fileExtension, content);
        }
        sendAppLabNotification({
          message: formatMessage(messages.successfullyCreatedFile),
          variant: 'success',
        });
      } catch (error) {
        if (prevSelectedFileId) {
          selectFile({ fileId: prevSelectedFileId });
        }
        if (error instanceof SketchFileCheckError) {
          notifyConflictCheckFailed();
          return;
        }
        const message =
          error instanceof Error && error.message === BOARD_STORAGE_FULL_ERROR
            ? formatMessage(messages.failedCreateFileStorageFull)
            : formatMessage(messages.failedCreateFile);
        sendAppLabNotification({
          message,
          variant: 'error',
        });
      }
    },
    [
      addFile,
      createSketchFile,
      checkPathConflict,
      notifyConflictCheckFailed,
      formatMessage,
      selectFile,
      selectedFile?.fileId,
    ],
  );

  const addFolderHandler = useCallback(
    async (path: string) => {
      const folderName = path.split('/').pop();
      if (!folderName) {
        console.error('Invalid folder name');
        return;
      }

      try {
        const { hasDuplicate, conflictType } = await checkPathConflict(
          path,
          'folder',
        );

        if (hasDuplicate) {
          // Show notification for all conflict types during creation
          const message =
            conflictType === 'folder-file'
              ? formatMessage(messages.folderAlreadyExistsFile)
              : formatMessage(messages.folderAlreadyExists);
          sendAppLabNotification({
            message,
            variant: 'error',
          });
          return;
        }
      } catch (error) {
        console.error('Failed to check folder existence:', error);
        notifyConflictCheckFailed();
        return;
      }

      try {
        await addFolder(path);
        sendAppLabNotification({
          message: formatMessage(messages.successfullyCreatedFolder),
          variant: 'success',
        });
      } catch (error) {
        const message =
          error instanceof Error && error.message === BOARD_STORAGE_FULL_ERROR
            ? formatMessage(messages.failedCreateFolderStorageFull)
            : formatMessage(messages.failedCreateFolder);
        sendAppLabNotification({
          message,
          variant: 'error',
        });
      }
    },
    [checkPathConflict, notifyConflictCheckFailed, addFolder, formatMessage],
  );

  const renameFileHandler = useCallback(
    async (
      path: string,
      newName: string,
      appendExt?: boolean,
      nodeType?: 'file' | 'folder',
    ): Promise<void> => {
      const folder = path.split('/').slice(0, -1).join('/');
      let newPath = folder ? `${folder}/${newName}` : newName;

      if (appendExt) {
        const { fileExtension } = splitFileName(path.split('/').pop() ?? '');
        newPath += fileExtension ? `.${fileExtension}` : '';
      }

      try {
        const { hasDuplicate, conflictType } = await checkPathConflict(
          newPath,
          nodeType ?? 'file',
        );

        if (hasDuplicate) {
          sendAppLabNotification({
            message: formatMessage(
              conflictType?.endsWith('-folder')
                ? messages.folderAlreadyExistsRename
                : messages.fileAlreadyExistsRename,
            ),
            variant: 'error',
          });
          return;
        }
      } catch (error) {
        console.error('Failed to check rename conflict:', error);
        notifyConflictCheckFailed();
        return;
      }

      try {
        await renameFile(path, newPath, { nodeType });
        if (nodeType === 'folder') {
          announceRenamedFolder(path, newPath);
        }
        const messages = RENAME_MESSAGES[nodeType || 'file'];
        sendAppLabNotification({
          message: formatMessage(messages.success),
          variant: 'success',
        });
      } catch (error) {
        const messages = RENAME_MESSAGES[nodeType || 'file'];
        sendAppLabNotification({
          message: formatMessage(messages.error),
          variant: 'error',
        });
      }
    },
    [
      checkPathConflict,
      notifyConflictCheckFailed,
      formatMessage,
      renameFile,
      announceRenamedFolder,
    ],
  );

  const deleteFileHandler = useCallback(
    async (path: string, nodeType?: 'file' | 'folder') => {
      const fileName = path.split('/').pop() || '';
      const isDir = nodeType === 'folder';

      const performDelete = async (): Promise<void> => {
        const fileIndex = openFiles.findIndex((f) => f.fileId === path);
        try {
          editorPanelSyncRef.current.closeRightPanelTab?.(path);
          // Folders route through removeFolder so descendant tabs/buffers are
          // cleaned up; single files stay on deleteFile.
          await (isDir ? removeFolder(path) : deleteFile(path, { nodeType }));
          const messages = DELETE_MESSAGES[nodeType || 'file'];
          sendAppLabNotification({
            message: formatMessage(messages.success),
            variant: 'success',
          });
        } catch {
          selectFile({ fileId: path, openAtIndex: fileIndex });
          const messages = DELETE_MESSAGES[nodeType || 'file'];
          sendAppLabNotification({
            message: formatMessage(messages.error),
            variant: 'error',
          });
        }
      };

      setDeleteItemFileName(fileName);
      setDeleteItemIsDirectory(isDir);
      setPendingDeleteAction(() => performDelete);
      setDeleteItemDialogOpen(true);
    },
    [deleteFile, removeFolder, formatMessage, openFiles, selectFile],
  );

  const moveFileHandler = useCallback(
    async (
      fromPath: string,
      toPath: string,
      nodeType?: 'file' | 'folder',
      _filesToUpdate?: Array<{ oldPath: string; newPath: string }>,
    ): Promise<void> => {
      await renameFile(fromPath, toPath, { nodeType });
    },
    [renameFile],
  );

  const updateAppBrick = useCallback(
    async (
      brickId: string,
      params: BrickCreateUpdateRequest,
    ): Promise<boolean> => {
      const response = await updateAppBrickRequest(appId, brickId, params);
      if (response) {
        await refetchAppYaml();
        await refetchAppBricks();
      }
      return response;
    },
    [appId, refetchAppBricks, refetchAppYaml],
  );

  const updateAppBricks = useCallback(
    async (
      bricks: Record<string, BrickCreateUpdateRequest>,
    ): Promise<boolean> => {
      // One PATCH at a time: the daemon can lose a value when two PATCHes
      // to the same app run in parallel.
      const responses: boolean[] = [];
      for (const [brickId, params] of Object.entries(bricks)) {
        responses.push(await updateAppBrickRequest(appId, brickId, params));
      }
      const response = responses.every((res) => res);
      if (response) {
        await refetchAppYaml();
        await refetchAppBricks();
      }
      return response;
    },
    [appId, refetchAppBricks, refetchAppYaml],
  );

  // Adapter that bridges the editor panel's `(params) => void` selection
  // signature to the canonical `openFile(path, opts)`. The editor panel
  // consumes selection via a prop, so we adapt at this boundary. Use
  // `openFile` directly everywhere else.
  const openFileFromEditor = useCallback(
    (params: {
      fileId?: string;
      openAtIndex?: number;
      isPreview?: boolean;
    }): void => {
      const { fileId, openAtIndex, isPreview } = params;
      if (!fileId) {
        selectFile({ fileId, openAtIndex, isPreview });
        return;
      }
      openFile(fileId, { openAtIndex, isPreview });
    },
    [openFile, selectFile],
  );

  const renameFileFromEditor = useCallback(
    (path: string, newName: string, nodeType?: 'file' | 'folder') =>
      renameFileHandler(path, newName, true, nodeType),
    [renameFileHandler],
  );

  const editorPanelLogicParams: EditorPanelLogicParams = useMemo(() => {
    return {
      appId: app?.id,
      appPath: app?.path,
      appBricks,
      selectedFile,
      selectFile: openFileFromEditor,
      selectableMainFile,
      closeFile,
      updateOpenFilesOrder,
      deleteAppFile: deleteFileHandler,
      renameAppFile: renameFileFromEditor,
      addAppFile: addFileHandler,
      addAppFolder: addFolder,
      updateAppBrick,
      initialAppBrickTab,
      openFiles,
      allFiles: editorFiles,
      readOnly: isReadOnlyApp,
      fetchFile,
      onFileLoadError: fileLoadFailed,
      canReadTab,
      previewFileId,
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
      onToggleAgentPanel: isReadOnlyApp ? undefined : toggleAgentPanel,
      agentPanelOpen,
    };
  }, [
    app?.id,
    app?.path,
    appBricks,
    selectedFile,
    openFileFromEditor,
    selectableMainFile,
    closeFile,
    updateOpenFilesOrder,
    deleteFileHandler,
    renameFileFromEditor,
    addFileHandler,
    addFolder,
    updateAppBrick,
    initialAppBrickTab,
    openFiles,
    editorFiles,
    fetchFile,
    fileLoadFailed,
    canReadTab,
    previewFileId,
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
    toggleAgentPanel,
    agentPanelOpen,
    isReadOnlyApp,
  ]);

  // Single owner of the editor-panel/split state machine. Instantiated
  // once here (rather than inside `useAppLabEditorPanelLogic`) so that
  // every consumer of `appLabEditorPanelLogic` shares the same instance,
  // and so the file-tree/brick drop handler below can route files into
  // panel B by calling `openFileInPanel` directly.
  const {
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
  } = useCreateEditorPanelLogic(editorPanelLogicParams);

  useEffect(() => {
    editorPanelSyncRef.current = {
      renameRightPanelTab,
      closeRightPanelTab,
      closeFileFromPanelA,
    };
  }, [renameRightPanelTab, closeRightPanelTab, closeFileFromPanelA]);

  // An external change reloads/reconciles a file open as a tab in *either*
  // editor panel, so the watcher gets the union of both panels' tab ids. These
  // are the RAW id states (panel-A `openFileIds` + panel-B tab ids), not the
  // meta-derived `openFiles`: that drops any id whose metadata hasn't resolved
  // yet — i.e. possibly the very id the watcher needs to close a ghost tab.
  // Panel B's tabs live in the editor-panel logic above, which is why this is
  // resolved here rather than fed straight from `useEditorFiles` (panel A only).
  const openTabIds = useMemo(
    () =>
      Array.from(
        new Set([...openFileIds, ...rightPanelTabs.map((t) => t.fileId)]),
      ),
    [openFileIds, rightPanelTabs],
  );

  // Read when the user sends a prompt, so the agent gets the file as it is at that moment.
  const editorPanelsRef = useRef({
    selectedFile,
    rightPanelSelectedFile,
    getActiveEditorPanel,
  });
  editorPanelsRef.current = {
    selectedFile,
    rightPanelSelectedFile,
    getActiveEditorPanel,
  };
  const getAgentEditorContext = useCallback((): AgentEditorContext => {
    const panels = editorPanelsRef.current;
    const panel = panels.getActiveEditorPanel();
    return readAgentEditorContext(
      panel,
      panel === 'B' ? panels.rightPanelSelectedFile : panels.selectedFile,
    );
  }, []);

  useFileWatch({
    appId,
    appPath: app?.path,
    openTabIds,
    refreshFileContents,
    deleteFile,
    unlistDir,
    relistDir,
    reloadLspFile,
    syncLspWatchedChange,
  });

  useEffect(() => {
    setActiveSelectedFile(
      activeEditorPanel === 'B' ? rightPanelSelectedFile : selectedFile,
    );
  }, [
    activeEditorPanel,
    rightPanelSelectedFile,
    selectedFile,
    setActiveSelectedFile,
  ]);

  // The selection can name a file no listing has reached yet. Keyed on the id
  // alone, and kept out of the bookkeeping effect below: that one depends on
  // `findFileNode`, whose identity changes with every listing, so revealing
  // from there re-expanded the selected file's folder after any watcher
  // refetch — reopening the folder the user had just collapsed.
  const activeSelectedFileId = activeSelectedFile?.fileId;
  useEffect(() => {
    if (activeSelectedFileId) revealPath(activeSelectedFileId);
  }, [activeSelectedFileId, revealPath]);

  useEffect(() => {
    if (activeSelectedFile?.fileId) {
      const foundFile = findFileNode(activeSelectedFile.fileId);

      if (
        foundFile &&
        isFileNode(foundFile) &&
        activeSelectedFile.fileExtension !== BRICK_FILE_EXTENSION
      ) {
        // Keep selectedNode as the open file, regardless of folder selection
        setSelectedNode(foundFile);
      }
    } else if (
      !activeSelectedFile &&
      selectedNode &&
      isFileNode(selectedNode)
    ) {
      // Clear selectedNode when no file is open, but only if it's a file
      setSelectedNode(undefined);
      // Note: if selectedNode is a folder, keep it for file creation operations
    }
  }, [activeSelectedFile, findFileNode, selectedNode]);

  const openExternal = useCallback(() => {
    if (!selectedNode) {
      console.warn('No file selected to open externally');
      return;
    }
    openFileExternal(selectedNode.path);
  }, [selectedNode]);

  const openFilesFolder = useCallback((): void => {
    throw new Error('openFilesFolder not implemented');
  }, []);

  const openExternalLink = useCallback((url: string) => {
    if (!url) {
      console.warn('No URL provided to open externally');
      return;
    }
    openLinkExternal(url);
  }, []);

  const { mutateAsync: updateApp } = useMutation({
    mutationFn: async (request: UpdateAppDetailRequest): Promise<boolean> => {
      if (!app) return false;
      const result = await updateAppDetail(app.id, request);
      if (result === app.id) {
        if (Object.hasOwn(request, 'default')) {
          // Prefix match: the status hook, every list section and this detail ([LIST_MY_APPS, appId]) all carry `default`.
          queryClient.invalidateQueries({
            queryKey: [BoardScopedQuery.LIST_MY_APPS],
          });
        } else {
          refetchAppDetail();
        }
      } else if (result !== undefined) {
        onAppRename(result || '');
        navigate({
          to: `/${section}/${result}`,
        });
      }
      return result !== undefined;
    },
  });

  const { data: bricks } = useQuery({
    queryKey: [BoardScopedQuery.LIST_BRICKS],

    queryFn: () => getBricks(),
  });

  const setSelectedFile = useCallback(
    (
      node: string | TreeNode | undefined,
      isPreview = false,
      targetPanel?: 'A' | 'B',
    ) => {
      if (!node) return;
      setInitialAppBrickTab(undefined);
      const path = typeof node === 'string' ? node : node.path;

      // Route to the panel the user last focused when the caller doesn't
      // pin a target (file-tree clicks). Explicit callers (drag-and-drop)
      // still win. Panel-B routing falls back to default A behaviour while
      // nothing is open in A: the split editor only renders alongside a
      // populated panel A, so routing the first-ever file into B would
      // leave it invisible.
      const resolvedPanel = targetPanel ?? getActiveEditorPanel();
      if (resolvedPanel === 'B' && openFiles.length > 0) {
        openFileInPanel(path, 'B', isPreview);
        setSelectedFolderState(undefined);
        return;
      }

      const prevSelectedFileIndex = openFiles.findIndex(
        (f) => f.fileId === selectedFile?.fileId,
      );

      openFile(path, {
        openAtIndex: prevSelectedFileIndex + 1,
        isPreview,
      });

      // Reset selectedFolder when a file is selected
      setSelectedFolderState(undefined);
    },
    [
      openFiles,
      openFileInPanel,
      getActiveEditorPanel,
      openFile,
      selectedFile?.fileId,
    ],
  );

  const setSelectedFolder = useCallback((node: TreeNode | undefined) => {
    // For folders, use separate state for visual selection only
    // This doesn't affect file selection or open files
    setSelectedFolderState(node);
  }, []);

  const {
    libraries,
    librarySearchIsLoading,
    librarySearchError,
    retryLibrarySearch,
    searchSketchLibraries,
    appLibraries,
    appLibrariesById,
    installingLibraryId,
    addSketchLibrary,
    deletingLibraryId,
    deleteSketchLibrary,
    addSketchLibraryError,
  } = useSketchLibraries({
    appId,
    hasSketch,
    refetchSketchYaml,
    onAddSuccess: () =>
      sendAppLabNotification({
        message: formatMessage(messages.successfullyAddedLibrary),
        variant: 'success',
      }),
    onAddError: () =>
      sendAppLabNotification({
        message: formatMessage(messages.failedAddLibrary),
        variant: 'error',
      }),
    onDeleteSuccess: () =>
      sendAppLabNotification({
        message: formatMessage(messages.successfullyDeletedLibrary),
        variant: 'success',
      }),
    onDeleteError: () =>
      sendAppLabNotification({
        message: formatMessage(messages.failedDeleteLibrary),
        variant: 'error',
      }),
  });

  const {
    openDialog: openAddSketchLibraryDialog,
    dialogLogic: addSketchLibraryDialogLogic,
  } = useAddSketchLibraryDialog({
    libraries,
    librarySearchIsLoading,
    librarySearchError,
    retryLibrarySearch,
    searchSketchLibraries,
    appLibrariesById,
    installingLibraryId,
    addSketchLibrary,
    deletingLibraryId,
    deleteSketchLibrary,
    openExternalLink,
    isBoard,
    addSketchLibraryError,
    blocked: hasSketch !== true || boardOffline,
    closeOpenDialog: hasSketch === false,
  });

  // Pure closure over the single state-machine instance created above —
  // consumers (AppLabEditorPanel, FilesManagerSection) may invoke this
  // freely without instantiating duplicate editor-panel state.
  const useAppLabEditorPanelLogic: AppLabEditorPanelLogic =
    (): ReturnType<AppLabEditorPanelLogic> => {
      const onCopyCode = useCallback(() => {
        (): void =>
          sendAppLabNotification({
            message: formatMessage(messages.codeCopied),
            variant: 'success',
          });
      }, []);
      const onFileError = useCallback((_error: Error) => {
        sendAppLabNotification({
          message: formatMessage(messages.couldNotOpenFile),
          variant: 'error',
        });
      }, []);
      return {
        editorPanelLogic,
        getKeywords: useKeywords,
        onCopyCode,
        onFileError,
        openFiles: editorPanelLogicParams.openFiles,
        readOnly: editorPanelLogicParams.readOnly,
        lspState,
      };
    };

  const appLabEditorPanelLogic = useCallback(useAppLabEditorPanelLogic, [
    editorPanelLogic,
    editorPanelLogicParams,
    formatMessage,
    lspState,
  ]);

  const deleteTreeItemDialogLogic = useCallback(
    () => ({
      open: deleteItemDialogOpen,
      fileName: deleteItemFileName,
      isDirectory: deleteItemIsDirectory,
      confirmAction: async (): Promise<boolean> => {
        if (pendingDeleteAction) {
          await pendingDeleteAction();
          return true;
        }
        // no pending action -> error
        return false;
      },
      onOpenChange: (open: boolean): void => {
        setDeleteItemDialogOpen(open);
        if (!open) {
          setPendingDeleteAction(null);
          setDeleteItemFileName('');
          setDeleteItemIsDirectory(false);
        }
      },
    }),
    [
      deleteItemDialogOpen,
      deleteItemFileName,
      deleteItemIsDirectory,
      pendingDeleteAction,
    ],
  );

  const configureAppBrickDialogLogic = useCallback(
    useConfigureAppBrickDialog,
    [],
  );

  const brickDetailLogic = useMemo(
    () => makeAppBrickDetailLogic(appId),
    [appId],
  );

  const handleMoveBlocked = useCallback(() => {
    sendAppLabNotification({
      message: formatMessage(messages.fileCannotBeMoved),
      variant: 'info',
    });
  }, [formatMessage]);

  const {
    activePanel,
    defaultApp,
    setAsDefaultApp,
    configureAppBricksDialogLogic,
    swapRunningAppDialogLogic,
    multipleConsolePanelLogic,
    runtimeActionsLogic,
    aiModelRequiredDialog,
  } = useAppDetailRuntimeLogic(
    app,
    appBricks,
    fileTree,
    openApp,
    updateApp,
    updateAppBricks,
  );

  const aiModelRequiredDialogLogic: AiModelRequiredDialogLogic =
    useCallback(() => {
      const { brickId, modelId } = aiModelRequiredDialog;
      const { models, downloadGenericModel, downloadEIModel } =
        brickDetailLogic(brickId ?? '');

      const eiProjectId = modelId?.match(/^ei-model-(\d+)-\d+$/)?.[1];
      const modelName =
        models?.find((m) =>
          eiProjectId
            ? // Account-linked EI model: the id encodes the project id.
              m.edgeImpulseProps?.projectId === eiProjectId
            : // Generic/built-in match by id, or an unlinked EI model whose card
              // id is its project id — match it by the impulse's board model id.
              m.id === modelId ||
              m.edgeImpulseProps?.impulses.some(
                (i) => i.downloadModelId === modelId,
              ),
        )?.name ?? '';

      return {
        open: aiModelRequiredDialog.open,
        isReadOnlyApp,
        modelName,
        onOpenChange: (nextOpen: boolean): void => {
          if (!nextOpen) aiModelRequiredDialog.close();
        },
        onDownloadModel: (): void => {
          if (brickId) {
            openBrickAiModelsTab(brickId);
            // In read-only apps the model is fixed and the CTA is "Download Model",
            // so start the download (navigating lets the user watch progress).
            // Mirror the card's own download so progress is reported where the
            // card reads it: an unlinked EI model is a card keyed by project id,
            // so route it through downloadEIModel (progress under project id);
            // everything else downloads by id. Examples never require a linked EI
            // model, and a release ships its EI models, so the impulse-install path
            // is never hit.
            if (isReadOnlyApp && modelId) {
              const eiModel = models?.find((m) =>
                m.edgeImpulseProps?.impulses.some(
                  (i) => i.downloadModelId === modelId,
                ),
              );
              const eiImpulse = eiModel?.edgeImpulseProps?.impulses.find(
                (i) => i.downloadModelId === modelId,
              );

              if (eiModel && isEdgeImpulseModel(eiModel) && eiImpulse) {
                downloadEIModel?.(
                  eiModel.edgeImpulseProps.projectId,
                  eiImpulse.id,
                );
              } else {
                downloadGenericModel?.(modelId);
              }
            }
          }
          aiModelRequiredDialog.close();
        },
      };
    }, [
      aiModelRequiredDialog,
      brickDetailLogic,
      isReadOnlyApp,
      openBrickAiModelsTab,
    ]);

  const useAppLabEditSectionLogic: AppLabEditSectionLogic =
    (): ReturnType<AppLabEditSectionLogic> => {
      const [importFileDialogOpen, setImportFileDialogOpen] = useState(false);
      const [_importedFileId, setImportedFileId] = useState<
        string | undefined
      >();
      const [importTarget, setImportTarget] = useState({
        path: '',
        isFolder: false,
      });

      const handleDragOverFolderChange = useCallback((path: string) => {
        setImportTarget((prev) => {
          if (prev.path !== path) {
            return { path, isFolder: false };
          }
          return prev;
        });
      }, []);

      const renderIcon = useCallback((node: TreeNode): JSX.Element => {
        if (isFolderNode(node)) {
          return <></>; // No icon for folders, only caret will be shown
        }

        return <FileIcon fileName={node.name} />;
      }, []);

      const handleOpenImportFileDialog = useCallback(
        ({ path = '', isFolder = false }) => {
          setImportTarget({ path, isFolder });
          setImportFileDialogOpen(true);
        },
        [],
      );

      const importFileDialogLogic = useImportResource({
        importResourceDialogOpen: importFileDialogOpen,
        setImportResourceDialogOpen: setImportFileDialogOpen,
        setImportedResourceId: setImportedFileId,
        selectResourcePath: () =>
          selectResourcePathToImport(
            importTarget.path
              ? `${app?.path}/${importTarget.path}`
              : app?.path ?? '',
            importTarget.isFolder,
          ),
        importResourceFromPath: (
          filePath: string,
          isFolder: boolean,
          newFileName?: string,
        ) =>
          importIntoApp(
            importTarget.path
              ? `${app?.path}/${importTarget.path}`
              : app?.path ?? '',
            filePath,
            isFolder,
            newFileName,
          ),
        type: importTarget.isFolder ? 'folder' : 'file',
        invalidateQueries: () => {
          invalidateDirs();
          queryClient.invalidateQueries({
            queryKey: ['get-batch-app-file-content'],
          });
        },
        checkPathConflict: checkPathConflictReported,
        targetFolderPath: importTarget.path,
        onDuplicateConflict: handleDuplicateConflict,
      });

      return {
        app,
        multipleConsolePanelLogic,
        section,
        appBricks,
        bricks,
        appLibraries,
        fileTree,
        selectedFile: activeSelectedFile,
        selectedFolder,
        selectedNode,
        onFolderExpand: handleFolderExpand,
        checkPathConflict: checkPathConflictReported,
        // A folder dropped for a failed listing leaves its row open and empty
        // until the tree is told to close it.
        closeFolder: listFailure,
        renamedFolder,
        defaultOpenFoldersState,
        setSelectedFile,
        setSelectedFolder,
        openFilesFolder,
        openExternal,
        openExternalLink,
        addAppBrick,
        deleteAppBrick: removeAppBrick,
        updateAppBrick,
        addAppCustomBrick,
        addFileHandler,
        renameFileHandler,
        deleteFileHandler,
        moveFileHandler,
        addSketchLibraryDialogLogic,
        openAddSketchLibraryDialog,
        deleteSketchLibrary,
        addFolderHandler,
        appLabEditorPanelLogic,
        renderIcon,
        brickDetailLogic,
        configureAppBrickDialogLogic,
        updateOpenFile,
        renameAppCustomBrick,
        onDuplicateConflict: handleDuplicateConflict,
        duplicateFileDialogLogic,
        importFileDialogLogic,
        openImportFileDialog: handleOpenImportFileDialog,
        onMoveBlocked: handleMoveBlocked,
        onDragOverFolderChange: handleDragOverFolderChange,
        sendAppLabNotification,
        lspReferencesResult,
        closeLspReferences,
        lspGoToReference,
        hasSketch,
        boardOffline,
        boardType: selectedBoard?.type,
        addSketch,
        openNetworkSettings,
      };
    };

  const appLabEditSectionLogic = useCallback(useAppLabEditSectionLogic, [
    app,
    multipleConsolePanelLogic,
    section,
    appBricks,
    bricks,
    appLibraries,
    fileTree,
    activeSelectedFile,
    selectedFolder,
    selectedNode,
    handleFolderExpand,
    checkPathConflictReported,
    importIntoApp,
    listFailure,
    renamedFolder,
    setSelectedFile,
    setSelectedFolder,
    openFilesFolder,
    openExternal,
    openExternalLink,
    addAppBrick,
    removeAppBrick,
    updateAppBrick,
    addAppCustomBrick,
    addFileHandler,
    renameFileHandler,
    deleteFileHandler,
    moveFileHandler,
    addSketchLibraryDialogLogic,
    openAddSketchLibraryDialog,
    deleteSketchLibrary,
    addFolderHandler,
    appLabEditorPanelLogic,
    brickDetailLogic,
    configureAppBrickDialogLogic,
    updateOpenFile,
    renameAppCustomBrick,
    handleDuplicateConflict,
    duplicateFileDialogLogic,
    handleMoveBlocked,
    invalidateDirs,
    lspReferencesResult,
    closeLspReferences,
    lspGoToReference,
    hasSketch,
    boardOffline,
    selectedBoard?.type,
    addSketch,
    openNetworkSettings,
  ]);

  const { appStatus } = runtimeActionsLogic();

  const appTitleLogic = useCreateAppTitleLogic(
    app,
    appStatus,
    section,
    defaultApp,
    setAsDefaultApp,
    updateApp,
    openApp,
  );
  const { onAppAction } = appTitleLogic();

  return {
    app,
    fileTree,
    activePanel,
    configureAppBricksDialogLogic,
    swapRunningAppDialogLogic,
    aiModelRequiredDialogLogic,
    onAppAction,
    appTitleLogic,
    appLabEditSectionLogic,
    runtimeActionsLogic,
    updateOpenFile,
    deleteTreeItemDialogLogic,
    agentPanelVisible: agentPanelOpen && !isReadOnlyApp,
    closeAgentPanel,
    openAgentSettings,
    getAgentEditorContext,
  };
};
