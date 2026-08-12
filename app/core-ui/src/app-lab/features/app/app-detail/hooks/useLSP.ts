import {
  eventsEmit,
  eventsOn,
  getAppDetail,
  getAppFileContent,
  getLspTempWorkspaceAppDir,
  getLspWorkspaceFile,
  initLspWorkspace,
  isLspEnabled,
  sendLspMessage,
  startLSP,
  stopAllLSP,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  Board,
  dismissSnackbar,
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
  LspState,
  NodeType,
  setLspDebug,
  snackbar,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMutation, useQuery } from '@tanstack/react-query';
import { debounce } from 'lodash-es';
import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';

import { useIsBoard } from '../../../../hooks/useIsBoard';
import { LanguageServerContext } from '../../../../providers/language-server/languageServerContext';
import { messages } from '../messages';

const LSP_INITIALIZING_STATE_DEBOUNCE_MS = 500;

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
  moveLspNode: (oldPath: string, newPath: string, nodeType?: NodeType) => void;
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
    cacheTime: Infinity,
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
    cacheTime: Infinity,
  });

  const workspaceDir = isBoard ? appDetail?.path : tempWorkspaceAppDir;

  const { mutateAsync: initWorkspace } = useMutation({
    mutationFn: (appPath: string) => initLspWorkspace(appPath),
  });

  // init LSP workspace (examples included: their read-only files still need to
  // be copied into the temp workspace so the Arduino preprocessor and
  // cross-file features work against a real on-disk sketch)
  useEffect(() => {
    if (enabled && isBoard === false && appDetail?.path) {
      workspaceReadyRef.current = initWorkspace(appDetail.path).catch(
        (error) => {
          console.error('Error init LSP app workspace', error);
        },
      );
    }
  }, [enabled, isBoard, appDetail, initWorkspace]);

  const getLspWsFile = useCallback(async (fileUri: string): Promise<string> => {
    await workspaceReadyRef.current;
    return getLspWorkspaceFile(fileUri);
  }, []);

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
      dispatchNodeAction({
        path,
        nodeType,
        fileAction: (ws) => ws.deleteNodeFile(path),
        folderAction: (ws) => ws.deleteNodeFolder(path),
      });
    },
    [dispatchNodeAction],
  );

  const renameOrMoveNode = useCallback(
    (oldPath: string, newPath: string, nodeType?: NodeType) => {
      dispatchNodeAction({
        path: oldPath,
        nodeType,
        fileAction: (ws) => ws.renameOrMoveNodeFile(oldPath, newPath),
        folderAction: (ws) => ws.renameOrMoveNodeFolder(oldPath, newPath),
      });
    },
    [dispatchNodeAction],
  );

  // A structural change detected by the file watcher (e.g. a terminal `mv`)
  // arrives as independent create/remove events the backend can't correlate,
  // so it can't be routed through the UI move path. Reconcile each half against
  // every LS so cross-file resolution recovers the same way a UI op does:
  //   - create: announce the new path (server drops its negative-resolution
  //     cache and re-resolves references from other files, reading the moved
  //     doc from the mirror-updated disk).
  //   - remove: close every tracked doc at or under the path (folder + exact
  //     file) so no stale didOpen lingers, then announce the deletion.
  // Broadcast to all clients because the path may be a folder spanning
  // languages; each server ignores paths it doesn't handle. No restart/re-lint
  // is needed here because the client never sent the didClose/didOpen that
  // desyncs the arduino LS — its own index rebuild from disk suffices.
  const syncLspWatchedChange = useCallback(
    (path: string, op: 'create' | 'remove') => {
      clientsRef.current.forEach((clientRef) => {
        const { workspace } = clientRef.client;
        if (op === 'create') {
          workspace.createNodeFile(path);
        } else {
          workspace.deleteNodeFolder(path);
          workspace.deleteNodeFile(path);
        }
      });
    },
    [],
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
    moveLspNode: renameOrMoveNode,
    syncLspWatchedChange,
    startLSP,
    sendLspMessage,
    subscribeLspMessages,
    getLspWorkspaceFile: getLspWsFile,
    reloadLspFile,
    lspState,
    onLspStateChange,
  };
};
