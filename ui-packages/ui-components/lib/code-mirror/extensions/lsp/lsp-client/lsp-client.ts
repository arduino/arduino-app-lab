import { setDiagnostics } from '@codemirror/lint';
import {
  hoverTooltips,
  LSPClientExtension,
  LSPPlugin,
  serverCompletion,
  serverDiagnostics,
  signatureHelp,
} from '@codemirror/lsp-client';
import { EditorView } from '@codemirror/view';

import { FileNode } from '../../../../file-tree';
import { LspState } from '../../..';
import { isWithinUri, joinFileUri, relativeUriPath } from '../lsp-file-uri';
import {
  LspClientCapabilities,
  LspId,
  LspMessage,
  LspProgressParams,
  LspPublishDiagnosticsParams,
  LspShowMessageParams,
} from '../lsp-types';
import {
  createLspClientTransport,
  isUserFacingMessageType,
} from './lsp-client-transport';
import { CustomLspClient } from './lsp-client-types';
import { LspClientWorkspace } from './lsp-client-workspace';

interface CreateLspClientParams {
  workspaceUri: string;
  lspId: LspId;
  fileId?: string;
  selectFile?: (params: {
    fileId?: string;
    openAtIndex?: number;
    isPreview?: boolean;
  }) => void;
  filesList?: FileNode[];
  sendLspMessage?: (lspId: LspId, message: LspMessage) => Promise<void>;
  subscribeLspMessages?: (
    lspId: LspId,
    onMessage: (message: LspMessage) => void,
  ) => () => void;
  getLspWorkspaceFile?: (fileUri: string) => Promise<string>;
  getActiveView?: () => EditorView | null;
  setFileValue?: (fileId: string, value: string) => boolean;
  ensureFileValue?: (fileId: string) => Promise<string | undefined>;
  lspStarted?: Promise<void> | undefined;
  onLspStateChange?: (lspId: LspId, state: LspState) => void;
}

export const createLspClient = ({
  workspaceUri,
  lspId,
  fileId,
  selectFile,
  filesList,
  sendLspMessage,
  subscribeLspMessages,
  getLspWorkspaceFile,
  getActiveView,
  setFileValue,
  ensureFileValue,
  lspStarted,
  onLspStateChange,
}: CreateLspClientParams): {
  client: CustomLspClient;
  transportDestroy: () => void;
} => {
  // Called by LspClientWorkspace displayFile() to open file in tab
  const openEditorFile = async (fileUri: string): Promise<void> => {
    // In-workspace files get a workspace-relative id; an external file (opened
    // via go-to-definition) keeps its full uri.
    const relative = relativeUriPath(fileUri, workspaceUri);
    selectFile?.({ fileId: relative ?? fileUri, isPreview: true });
  };

  const rootUri =
    lspId === 'arduino' ? joinFileUri(workspaceUri, 'sketch') : workspaceUri;

  const client = new CustomLspClient({
    extensions: [
      serverCompletion(),
      hoverTooltips(),
      signatureHelp(),
      serverDiagnostics(),
      lspClientExtension(),
    ],
    notificationHandlers: getNotificationHandlers(
      (state) => onLspStateChange?.(lspId, state),
      workspaceUri,
    ),
    rootUri,
    timeout: 10_000,
    workspace: (client): LspClientWorkspace =>
      new LspClientWorkspace(
        client,
        lspId,
        workspaceUri,
        openEditorFile,
        filesList,
        getLspWorkspaceFile,
        getActiveView,
        setFileValue,
        ensureFileValue,
      ),
  });

  const { transport, transportDestroy } = createLspClientTransport({
    lspId,
    rootUri,
    fileId,
    sendLspMessage,
    subscribeLspMessages,
    client,
  });

  // connect to transport when LS has started
  lspStarted?.then(() => {
    client.connect(transport);
  });

  return { client, transportDestroy };
};

/**
 * Used to notify LS of capabilities not supported/declared by @codemirror/lsp-client by default:
 * - workDoneProgress
 * - codeAction
 */
const lspClientExtension = (): LSPClientExtension => {
  const clientCapabilities: LspClientCapabilities = {
    window: {
      workDoneProgress: true,
    },
    textDocument: {
      codeAction: {},
    },
  };

  return { clientCapabilities };
};

/**
 * Notification handlers
 */

const LSP_MESSAGE_TYPE_TO_SNACKBAR_VARIANT = {
  1: 'error',
  2: 'warning',
  3: 'info',
} as const;

const LSP_DIAGNOSTIC_TO_CM_SEVERITY = {
  1: 'error',
  2: 'warning',
  3: 'info',
  4: 'hint',
} as const;

const getNotificationHandlers = (
  onLspStateChange: ((state: LspState) => void) | undefined,
  workspaceUri: string,
): Record<string, (client: CustomLspClient, params: unknown) => boolean> => {
  let prevProgressPercentage: number | undefined;

  return {
    /**
     * Cache raw LSP diagnostics for use as context in `textDocument/codeAction` requests.
     *
     * Render diagnostic squiggles in every pane(split view).
     * Return true to suppress the single-view handler.
     */
    'textDocument/publishDiagnostics': (client, params): boolean => {
      const { uri, diagnostics, version } =
        params as LspPublishDiagnosticsParams;

      // Suppress diagnostics for external/host files (outside the workspace
      // root). They are read-only and often lack full project context, which
      // produces noisy false errors. Returning true prevents the library's
      // default handler from rendering them. Example apps live under the
      // workspace root and keep their diagnostics.
      if (!isWithinUri(uri, workspaceUri)) {
        return true;
      }

      client.setDiagnostics(uri, diagnostics);

      const file = client.workspace.getFile(uri);

      if (!file || (version != null && version !== file.version)) {
        // A transient mismatch (a publish computed while a didChange was in
        // flight) heals on the server's next publish. A PERSISTENT one means
        // the server missed one of our didChanges (e.g. a send failed while
        // its process was mid-crash) and every subsequent publish for this
        // file would be discarded — squiggles frozen while the server is
        // healthy. Surface it and re-align the server (no-op where a resync
        // is already in flight or unsupported — see resyncStaleDocument).
        if (file && version != null) {
          console.warn(
            `[lsp] dropped publishDiagnostics for ${uri}: server version ` +
              `${version} != client version ${file.version}`,
          );
          client.workspace.resyncStaleDocument(uri);
        }
        return false;
      }

      for (const view of file.getViews()) {
        const plugin = LSPPlugin.get(view);
        if (!plugin) {
          continue;
        }
        view.dispatch(
          setDiagnostics(
            view.state,
            diagnostics.map((diagnostic) => ({
              from: plugin.unsyncedChanges.mapPos(
                plugin.fromPosition(diagnostic.range.start, plugin.syncedDoc),
              ),
              to: plugin.unsyncedChanges.mapPos(
                plugin.fromPosition(diagnostic.range.end, plugin.syncedDoc),
              ),
              severity: LSP_DIAGNOSTIC_TO_CM_SEVERITY[diagnostic.severity ?? 1],
              message: diagnostic.message,
            })),
          ),
        );
      }

      return true;
    },
    /**
     * Handle `window/logMessage` notifications.
     * Returns true so the library's built-in handler does not log.
     */
    'window/logMessage': (_client, _params): boolean => {
      return true;
    },
    /**
     * Returns true so the library's built-in handler does not show the dialog.
     */
    'window/showMessage': (client, params): boolean => {
      const { type, message } = params as LspShowMessageParams;
      const variant =
        LSP_MESSAGE_TYPE_TO_SNACKBAR_VARIANT[
          type as keyof typeof LSP_MESSAGE_TYPE_TO_SNACKBAR_VARIANT
        ];
      if (variant) {
        console.log('window/showMessage', variant, message);
      }
      // Keep problem reports for the command that triggered them, which would
      // otherwise have nothing to show the user (see recordServerMessage).
      if (isUserFacingMessageType(type)) {
        client.recordServerMessage(message);
      }
      return true;
    },
    '$/progress': (client, params): boolean => {
      const { token, value } = params as LspProgressParams;

      // handle only Arduino Language Server workDoneProgress
      if (token !== 'backgroundIndexProgress') {
        return false;
      }

      switch (value.kind) {
        case 'begin':
          prevProgressPercentage = 0;
          onLspStateChange?.({ type: 'progress', progress: 0 });
          // The restart's index pass beginning is what promotes a pending sketch
          // re-lint to indexing (its `end` then flushes it).
          client.workspace?.markSketchRestartIndexing();
          break;
        case 'report':
          if (value.percentage !== prevProgressPercentage) {
            prevProgressPercentage = value.percentage;
            onLspStateChange?.({
              type: 'progress',
              progress: value.percentage,
            });
          }
          break;
        case 'end':
          prevProgressPercentage = undefined;
          onLspStateChange?.({ type: 'ready' });
          // A background-index pass completing is our signal that a restarted
          // Arduino LS is ready again, so flush any re-lint deferred from a
          // sketch-boundary move (no-op otherwise).
          client.workspace?.flushPendingSketchRelint();
          break;
        default:
          break;
      }

      return false;
    },
  };
};
