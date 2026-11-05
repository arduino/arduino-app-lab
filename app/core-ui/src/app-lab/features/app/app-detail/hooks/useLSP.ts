import {
  eventsEmit,
  eventsOn,
  getAppDetail,
  getAppFileContent,
  getLspTempWorkspaceAppDir,
  getLspWorkspaceFile,
  initLspWorkspace,
  isLspEnabled,
  listLspFiles,
  listLspSketchFiles,
  sendLspMessage,
  startLSP as apiStartLSP,
  stopAllLSP,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  Board,
  dismissSnackbar,
  fileNameFromUri,
  isLspDebugEnabled,
  LSP_FAILED_EVENT,
  LSP_LANGS,
  LSP_LOG_EVENT,
  LSP_SET_DEBUG_LOGGING_EVENT,
  LspClientRef,
  LspClientWorkspace,
  LspFailure,
  LspId,
  LspLang,
  LspLogLine,
  LspMessage,
  LspReferenceRow,
  LspReferencesResult,
  LspState,
  NodeType,
  setLspDebug,
  snackbar,
  toDocOffset,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMutation, useQuery } from '@tanstack/react-query';
import { debounce, isEqual, omit } from 'lodash-es';
import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';

import { useIsBoard } from '../../../../hooks/useIsBoard';
import { LanguageServerContext } from '../../../../providers/language-server/languageServerContext';
import { useLspReferencesStore } from '../../../../store/lspReferences';
import { messages } from '../messages';

const LSP_INITIALIZING_STATE_DEBOUNCE_MS = 500;

// What an app edit changes (a rename, the description, the icon): no file, and the watcher syncs app.yaml itself.
const APP_EDIT_FIELDS = ['id', 'name', 'path', 'description', 'icon'];

// One broken language-server install reports itself through several
// independent paths — the start rejection, the initialize rejection, the index
// stall guard and the backend's LSP_FAILED_EVENT — and every file opened
// afterwards retries and fails again. Giving the notice a fixed id makes each
// report update the snackbar already on screen rather than enqueue another
// one: queued copies only surfaced as earlier ones expired, which is how the
// warning ended up following the user onto the pages they browsed next.
const LSP_ERROR_SNACKBAR_ID = 'app-lab-lsp-error';

// Window augmented with the dev-tools console switch for LSP debug logging.
interface LspDebugWindow extends Window {
  arduinoLspDebug?: (on?: boolean) => void;
}

type ReturnType = {
  lspWorkspaceDir?: string;
  lspClients: Map<LspId, LspClientRef>;
  createLspNode: (path: string, nodeType?: NodeType) => void;
  deleteLspNode: (path: string, nodeType?: NodeType) => void;
  renameLspNode: (
    oldPath: string,
    newPath: string,
    nodeType?: NodeType,
  ) => void;
  syncLspWatchedChange: (path: string, op: 'create' | 'remove') => void;
  startLSP: (lspId: LspId, workspaceDir: string) => Promise<void>;
  sendLspMessage: (lspId: LspId, message: LspMessage) => Promise<void>;
  subscribeLspMessages: (
    lspId: LspId,
    onMessage: (message: LspMessage) => void,
  ) => () => void;
  getLspWorkspaceFile: (fileUri: string) => Promise<string>;
  reloadLspFile: (path: string) => Promise<void>;
  lspState: LspState;
  onLspStateChange: (lspId: LspId, state: LspState) => void;
  lspReferencesResult: LspReferencesResult | null;
  showLspReferences: (result: LspReferencesResult) => void;
  closeLspReferences: () => boolean;
  lspGoToReference: (row: LspReferenceRow) => void;
};

export type UseLSP =
  | ({ isLspEnabled: true } & ReturnType)
  | ({ isLspEnabled: false } & Partial<ReturnType>);

export const useLSP = (appId: string, selectedBoard?: Board): UseLSP => {
  const { lspState, setLspStates, resetLspState } = useContext(
    LanguageServerContext,
  );
  const clientsRef = useRef<Map<LspId, LspClientRef>>(new Map());
  const workspaceReadyRef = useRef<Promise<void>>(Promise.resolve());

  const { formatMessage } = useI18n();

  const { data: isBoard } = useIsBoard();

  const { data: enabled } = useQuery({
    queryKey: ['is-lsp-enabled', selectedBoard?.fqbn],
    queryFn: isLspEnabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const { data: appDetail } = useQuery({
    queryKey: ['list-my-apps', appId],
    queryFn: () => getAppDetail(appId),
  });

  const { data: tempWorkspaceAppDir } = useQuery({
    queryKey: ['lsp-ws-app-dir-path'],
    queryFn: getLspTempWorkspaceAppDir,
    enabled: enabled && isBoard === false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const workspaceDir = isBoard ? appDetail?.path : tempWorkspaceAppDir;

  const { mutateAsync: initWorkspace } = useMutation({
    mutationFn: (appPath: string) => initLspWorkspace(appPath),
  });

  // The detail of the last copy that finished, so a copy cut short by a rename runs again.
  const copiedForRef = useRef<typeof appDetail>();

  // init LSP workspace (examples included: their read-only files still need to
  // be copied into the temp workspace so the Arduino preprocessor and
  // cross-file features work against a real on-disk sketch)
  useEffect(() => {
    if (!enabled || isBoard !== false || !appDetail?.path) {
      copiedForRef.current = undefined;
      return;
    }
    const copiedFor = copiedForRef.current;
    // An app edit changes no file, and a copy while the servers run loses their open documents.
    if (
      copiedFor &&
      isEqual(
        omit(copiedFor, APP_EDIT_FIELDS),
        omit(appDetail, APP_EDIT_FIELDS),
      )
    ) {
      copiedForRef.current = appDetail;
      return;
    }
    copiedForRef.current = undefined;
    workspaceReadyRef.current = initWorkspace(appDetail.path)
      .then(() => {
        copiedForRef.current = appDetail;
      })
      .catch((error) => {
        console.error('Error init LSP app workspace', error);
      });
  }, [enabled, isBoard, appDetail, initWorkspace]);

  const getLspWsFile = useCallback(async (fileUri: string): Promise<string> => {
    await workspaceReadyRef.current;
    return getLspWorkspaceFile(fileUri);
  }, []);

  // The Arduino LS maps a clangd result back to a sketch file only if that file
  // was didOpen'd, and it shuts itself down when it cannot. The editor opens
  // files lazily, so without this a go-to-definition into a sketch file nobody
  // opened crashes the server. Catches its own errors: a failed listing must
  // not read as a failed LSP start.
  const trackSketchFiles = useCallback(async (dir: string): Promise<void> => {
    try {
      await workspaceReadyRef.current;
      const files = await listLspSketchFiles(`${dir}/sketch`);
      clientsRef.current
        .get('arduino')
        ?.client.workspace.trackFilesFromDisk(
          files.map((file) => `sketch/${file}`),
        );
    } catch (error) {
      console.error('LSP sketch files tracking error', error);
    }
  }, []);

  // Resolves as soon as the server is up, without waiting for trackSketchFiles:
  // the client connects only after this promise resolves. By then the client
  // has registered itself in clientsRef, in the same tick as the start call.
  const startLSP = useCallback(
    async (lspId: LspId, dir: string): Promise<void> => {
      await apiStartLSP(lspId, dir);
      if (lspId === 'arduino') {
        void trackSketchFiles(dir);
      }
    },
    [trackSketchFiles],
  );

  const subscribeLspMessages = useCallback(
    (lspId: LspId, onMessage: (message: LspMessage) => void): (() => void) =>
      eventsOn(`lsp-events-${lspId}`, onMessage),
    [],
  );

  //  stop all LSPs
  const stop = (): void => {
    stopAllLSP().catch((error) => {
      console.error('stopAllLSP error', error);
    });

    clientsRef.current.forEach((clientRef) => {
      clientRef.transportDestroy();
      clientRef.client.disconnect();
    });

    clientsRef.current.clear();
  };

  useEffect(() => {
    return () => {
      stop();
      resetLspState();
      useLspReferencesStore.getState().close();
      // The notice is about the app open on this page, so it leaves with it
      // instead of trailing into whatever the user opens next.
      dismissSnackbar(LSP_ERROR_SNACKBAR_ID);
    };
  }, [resetLspState]);

  // Bridge backend LSP logs (clangd / language-server stderr and crash/restart
  // events) to the dev-tools console. Production builds keep this off and the
  // desktop backend only writes slog to log files, so there is otherwise
  // nothing to inspect when diagnosing a field issue. Enable at runtime from
  // the console with `arduinoLspDebug(true)`, or persist it with
  // `localStorage['lsp-debug'] = '1'`.
  useEffect(() => {
    const debugWindow = window as LspDebugWindow;

    debugWindow.arduinoLspDebug = (on = true): void => {
      setLspDebug(on);
      // Tell the backend to start/stop forwarding its LSP logs.
      eventsEmit(LSP_SET_DEBUG_LOGGING_EVENT, on);
    };

    // If logging is already enabled, ask the backend to forward right away.
    if (isLspDebugEnabled()) {
      eventsEmit(LSP_SET_DEBUG_LOGGING_EVENT, true);
    }

    const unsubscribe = eventsOn(LSP_LOG_EVENT, (line: LspLogLine) => {
      if (!isLspDebugEnabled()) {
        return;
      }
      const color =
        line.level === 'error'
          ? '#ff5555'
          : line.level === 'warn'
          ? '#ffaa00'
          : '#66ccff';
      console.log(
        `%cLSP [${line.processId}] ${line.source}:`,
        `color: ${color};`,
        line.msg,
      );
    });

    return () => {
      unsubscribe();
      delete debugWindow.arduinoLspDebug;
    };
  }, []);

  const getClientWorkspace = useCallback(
    (path: string): LspClientWorkspace | undefined => {
      const lang = path.split('.').pop();
      const lspId = LSP_LANGS[lang as LspLang];
      return clientsRef.current.get(lspId)?.client.workspace;
    },
    [],
  );

  // Surgically sync a file that changed on disk (via the file watcher) but is
  // not open in an editor. For a tracked file, fetches the fresh source
  // content (which also refreshes the LSP tmp workspace copy) and sends a
  // didChange; for an untracked one (e.g. inside an externally moved-in
  // folder), announces the disk change so the server drops its cached copy.
  // Files shown in an editor sync through the buffer-reload path instead.
  const reloadLspFile = useCallback(
    async (path: string): Promise<void> => {
      const workspace = getClientWorkspace(path);
      if (!workspace || !appDetail?.path) {
        return;
      }
      try {
        // A disk-driven didOpen for this file may still be in flight (LSP
        // startup or a create event); wait for it so we observe the tracked
        // state it establishes instead of racing it with a stale decision.
        await workspace.waitForPendingDiskOpen(path);
        if (workspace.needsExternalReload(path)) {
          const content = await getAppFileContent(`${appDetail.path}/${path}`);
          workspace.refreshFile(path, content);
        } else if (!workspace.isTracked(path)) {
          workspace.notifyWatchedFileChanged(path);
        }
      } catch (error) {
        console.error('reloadLspFile error', path, error);
      }
    },
    [getClientWorkspace, appDetail?.path],
  );

  const {
    result: lspReferencesResult,
    show: showLspReferences,
    close: closeLspReferences,
  } = useLspReferencesStore();

  const lspGoToReference = useCallback(
    (row: LspReferenceRow): void => {
      const { result } = useLspReferencesStore.getState();
      const client = result && clientsRef.current.get(result.lspId)?.client;
      if (!client) {
        return;
      }
      void client.workspace.displayFile(row.fileUri).then((view) => {
        if (!view) {
          snackbar({
            message: formatMessage(messages.lspReferenceNotOpened, {
              fileName: fileNameFromUri(row.fileUri),
            }),
            variant: 'warning',
          });
          return;
        }
        view.dispatch({
          selection: {
            anchor: toDocOffset(view.state.doc, row.range.start),
            head: toDocOffset(view.state.doc, row.range.end),
          },
          scrollIntoView: true,
        });
        view.focus();
      });
    },
    [formatMessage],
  );

  // Workspace-relative paths of the LSP files under `path` in the LSP
  // workspace, for a folder whose files nothing reports one by one. Empty for a
  // file, a missing path, or a failed listing.
  const listLspFilesUnder = useCallback(
    async (path: string): Promise<string[]> => {
      if (!workspaceDir) {
        return [];
      }
      try {
        await workspaceReadyRef.current;
        return await listLspFiles(workspaceDir, path);
      } catch (error) {
        console.error('LSP file listing error', path, error);
        return [];
      }
    },
    [workspaceDir],
  );

  const announceFilesUnder = useCallback(
    (path: string): void => {
      void listLspFilesUnder(path).then((paths) => {
        if (paths.length === 0) {
          return;
        }
        clientsRef.current.forEach((clientRef) =>
          clientRef.client.workspace.createNodeFiles(paths),
        );
      });
    },
    [listLspFilesUnder],
  );

  // A references result names its files by uri, so after a file at or under
  // `path` moves or goes away a row would open a file that no longer exists.
  const closeLspReferencesUnder = useCallback((path: string): void => {
    const { result, close } = useLspReferencesStore.getState();
    const workspace =
      result && clientsRef.current.get(result.lspId)?.client.workspace;
    if (
      workspace &&
      result.groups.some((group) => workspace.containsUri(path, group.fileUri))
    ) {
      close();
    }
  }, []);

  const dispatchNodeAction = useCallback(
    ({
      path,
      nodeType,
      fileAction,
      folderAction,
    }: {
      path: string;
      nodeType?: NodeType;
      fileAction: (ws: LspClientWorkspace) => void;
      folderAction: (ws: LspClientWorkspace) => void;
    }) => {
      if (nodeType === 'folder') {
        clientsRef.current.forEach((clientRef) => {
          folderAction(clientRef.client.workspace);
        });
      } else {
        const workspace = getClientWorkspace(path);
        if (workspace) {
          fileAction(workspace);
        }
      }
    },
    [getClientWorkspace],
  );

  const createNode = useCallback(
    (path: string, nodeType?: NodeType) => {
      dispatchNodeAction({
        path,
        nodeType,
        fileAction: (ws) => ws.createNodeFile(path),
        // Creating an empty folder adds no files, so nothing to resolve.
        folderAction: () => undefined,
      });
    },
    [dispatchNodeAction],
  );

  const deleteNode = useCallback(
    (path: string, nodeType?: NodeType) => {
      closeLspReferencesUnder(path);
      dispatchNodeAction({
        path,
        nodeType,
        fileAction: (ws) => ws.deleteNodeFile(path),
        folderAction: (ws) => ws.deleteNodeFolder(path),
      });
    },
    [dispatchNodeAction, closeLspReferencesUnder],
  );

  const renameOrMoveNode = useCallback(
    (oldPath: string, newPath: string, nodeType?: NodeType) => {
      closeLspReferencesUnder(oldPath);
      if (nodeType === 'folder') {
        // The tracked files move at once, before the editor reopens them at
        // their new paths; the untracked ones follow when the listing returns.
        clientsRef.current.forEach((clientRef) =>
          clientRef.client.workspace.renameOrMoveNodeFolder(oldPath, newPath),
        );
        announceFilesUnder(newPath);
        return;
      }
      const oldWorkspace = getClientWorkspace(oldPath);
      const newWorkspace = getClientWorkspace(newPath);
      if (oldWorkspace === newWorkspace) {
        oldWorkspace?.renameOrMoveNodeFile(oldPath, newPath);
        return;
      }
      // A new extension moves the file to another server, or to none.
      oldWorkspace?.deleteNodeFile(oldPath);
      newWorkspace?.createNodeFile(newPath);
    },
    [getClientWorkspace, announceFilesUnder, closeLspReferencesUnder],
  );

  // A structural change detected by the file watcher (e.g. a terminal `mv`)
  // arrives as independent create/remove events the backend can't correlate,
  // so it can't be routed through the UI move path. Reconcile each half against
  // every LS so cross-file resolution recovers the same way a UI op does:
  //   - create: announce the new path (server drops its negative-resolution
  //     cache and re-resolves references from other files, reading the moved
  //     doc from the mirror-updated disk). A folder's files get no events of
  //     their own, so they are listed and announced too.
  //   - remove: close every tracked doc at or under the path (folder + exact
  //     file) so no stale didOpen lingers, then announce the deletion.
  // Imports call this too: the backend suppresses their watcher events.
  // Broadcast to all clients because the path may be a folder spanning
  // languages; each server ignores paths it doesn't handle. No restart/re-lint
  // is needed here because the client never sent the didClose/didOpen that
  // desyncs the arduino LS — its own index rebuild from disk suffices.
  const syncLspWatchedChange = useCallback(
    (path: string, op: 'create' | 'remove') => {
      if (op === 'remove') {
        closeLspReferencesUnder(path);
      }
      clientsRef.current.forEach((clientRef) => {
        const { workspace } = clientRef.client;
        if (op === 'create') {
          // A create of a file this server already has open is an atomic
          // replace (write a temp file, rename it over the file). useFileWatch
          // reloads it like an in-place write, and the reload sends the new
          // text as a didChange. Announcing the create would also restart the
          // Arduino LS. The restarted LS gives clangd each open .h/.cpp from
          // disk, which already has the new text, so the reload's didChange
          // (a diff from the old text) then corrupts clangd's copy.
          if (!workspace.isTracked(path)) {
            workspace.createNodeFile(path);
          }
        } else {
          workspace.deleteNodeFolder(path);
        }
      });
      // A path with an LSP extension is a file, which createNodeFile above
      // already tracks; any other path may be a folder.
      const lang = path.split('.').pop();
      if (op === 'create' && !LSP_LANGS[lang as LspLang]) {
        announceFilesUnder(path);
      }
    },
    [announceFilesUnder, closeLspReferencesUnder],
  );

  const onLspStateChange = useMemo(() => {
    const applyState = (lspId: LspId, state: LspState): void => {
      setLspStates((prev) => ({
        ...prev,
        [lspId]: state,
      }));
      if (state.type === 'error') {
        snackbar({
          message: formatMessage(messages.lspError),
          variant: 'warning',
          opts: { id: LSP_ERROR_SNACKBAR_ID },
        });
      }
    };

    const applyInitializingState = debounce(
      applyState,
      LSP_INITIALIZING_STATE_DEBOUNCE_MS,
    );

    return (lspId: LspId, state: LspState): void => {
      applyInitializingState.cancel();
      if (state.type === 'initializing') {
        applyInitializingState(lspId, state);
      } else {
        applyState(lspId, state);
      }
    };
  }, [formatMessage, setLspStates]);

  // A terminal backend failure is the only thing that can move an already-started
  // LSP out of its progress state: the frontend's start promise resolved long ago,
  // and a language server that dies simply stops sending index notifications — so
  // without this the footer would show it loading forever.
  useEffect(() => {
    const unsubscribe = eventsOn(LSP_FAILED_EVENT, (failure: LspFailure) => {
      onLspStateChange(failure.lspId as LspId, {
        type: 'error',
        message: failure.reason,
      });
    });
    return unsubscribe;
  }, [onLspStateChange]);

  if (!enabled) {
    return {
      isLspEnabled: false,
    };
  }

  return {
    isLspEnabled: true,
    lspWorkspaceDir: workspaceDir,
    lspClients: clientsRef.current,
    createLspNode: createNode,
    deleteLspNode: deleteNode,
    renameLspNode: renameOrMoveNode,
    syncLspWatchedChange,
    startLSP,
    sendLspMessage,
    subscribeLspMessages,
    getLspWorkspaceFile: getLspWsFile,
    reloadLspFile,
    lspReferencesResult,
    showLspReferences,
    closeLspReferences,
    lspGoToReference,
    lspState,
    onLspStateChange,
  };
};
