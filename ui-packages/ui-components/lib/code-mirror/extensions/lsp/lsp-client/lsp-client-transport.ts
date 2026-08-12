import { Transport } from '@codemirror/lsp-client';
import { MessageType } from 'vscode-languageserver-protocol';

import { isLspDebugEnabled } from '../lsp-debug';
import {
  LspApplyWorkspaceEditParams,
  LspCompletionList,
  LspId,
  LspInitializeParams,
  LspMessage,
  LspRequestMessage,
  LspResponseMessage,
  LspShowMessageRequestParams,
  LspWorkspaceEdit,
} from '../lsp-types';
import { CustomLspClient } from './lsp-client-types';
import {
  applyWorkspaceEditChanges,
  describeSkippedEdits,
  normalizeWorkspaceEdit,
} from './lsp-client-workspace';

interface CreateLspClientTransportParams {
  lspId: LspId;
  rootUri: string;
  fileId?: string;
  sendLspMessage?: (lspId: LspId, message: LspMessage) => Promise<void>;
  subscribeLspMessages?: (
    lspId: LspId,
    onMessage: (message: LspMessage) => void,
  ) => () => void;
  client: CustomLspClient;
}

/**
 * Transport is used to handle FE-BE communication.
 */
export const createLspClientTransport = ({
  lspId,
  rootUri,
  fileId,
  sendLspMessage,
  subscribeLspMessages,
  client,
}: CreateLspClientTransportParams): {
  transport: Transport;
  transportDestroy: () => void;
} => {
  let handlers: ((value: string) => void)[] = [];

  const replyToServerRequest = (
    id: LspResponseMessage['id'],
    result: LspResponseMessage['result'],
  ): void => {
    const payload: LspResponseMessage = { jsonrpc: '2.0', id, result };
    logClientMessage(lspId, fileId, payload);
    sendLspMessage?.(lspId, payload);
  };

  const serverRequestHandlers = createServerRequestHandlers(client);

  // subscribe to events from the backend
  const unsubscribeLspMessages = subscribeLspMessages?.(
    lspId,
    (message: LspMessage) => {
      if (isServerRequestMessage(message)) {
        const handler = serverRequestHandlers[message.method];
        if (handler) {
          // do not send server request to @codemirror/lsp-client cause it doesn't handle it
          handler(message.params)
            .then((result) => replyToServerRequest(message.id, result))
            .catch(() => replyToServerRequest(message.id, { applied: false }));
        } else {
          // Unknown server request — forward to @codemirror/lsp-client so it replies with MethodNotFound.
          for (const h of handlers) {
            h(JSON.stringify(message));
          }
        }
      } else {
        handleResponseError(client, message);
        message.result = normalizeResult(message.result);
        for (const h of handlers) {
          h(JSON.stringify(message));
        }
      }

      logServerMessage(lspId, fileId, message);
    },
  );

  /**
   * Transport
   */

  const transportSend = (message: string): void => {
    let jsonMsg: LspRequestMessage;
    try {
      jsonMsg = JSON.parse(message);
    } catch (e) {
      console.error(`Failed to parse LSP message [${lspId}-${fileId}]:`, e);
      return;
    }
    patchInitializeRequest(jsonMsg, rootUri);
    logClientMessage(lspId, fileId, jsonMsg);
    sendLspMessage?.(lspId, jsonMsg)?.catch((e) => {
      console.error(`Failed to send LSP message [${lspId}-${fileId}]:`, e);
    });
  };

  const transportSubscribe = (handler: (value: string) => void): void => {
    handlers.push(handler);
  };

  const transportUnsubscribe = (handler: (value: string) => void): void => {
    handlers = handlers.filter((h) => h !== handler);
  };

  const transport: Transport = {
    send: transportSend,
    subscribe: transportSubscribe,
    unsubscribe: transportUnsubscribe,
  };

  return {
    transport,
    transportDestroy: (): void => {
      handlers = [];
      unsubscribeLspMessages?.();
    },
  };
};

// A server-initiated request has both id and method.
const isServerRequestMessage = (msg: LspMessage): msg is LspRequestMessage => {
  return msg.id != null && !!msg.method;
};

/**
 * True for the message types that explain a problem to the user, as opposed to
 * the Info/Log chatter servers emit while starting up and indexing.
 */
export const isUserFacingMessageType = (type: MessageType): boolean =>
  type === MessageType.Error || type === MessageType.Warning;

/**
 * @codemirror/lsp-client does not handle server-initiated requests and rejects them with MethodNotFound.
 * Known ones are handled here.
 */
const createServerRequestHandlers = (
  client: CustomLspClient,
): Record<
  string,
  (params: LspRequestMessage['params']) => Promise<LspResponseMessage['result']>
> => ({
  // LS send this to create a progress token before streaming $/progress notifications.
  // Acknowledge just with null to let LS proceed.
  'window/workDoneProgress/create': async () => null,

  // How servers report a problem the user should see when the request itself
  // still "succeeds" — Basedpyright rejects an invalid rename target this way
  // and then answers the rename with an empty edit. Keep the text so the
  // command can surface it, and reply null (no action chosen); we don't show
  // the server's action buttons.
  'window/showMessageRequest': async (rawParams): Promise<null> => {
    const { type, message } = rawParams as LspShowMessageRequestParams;
    if (isUserFacingMessageType(type)) {
      client.recordServerMessage(message);
    }
    return null;
  },

  // Sent by LS after `workspace/executeCommand` to apply code edits.
  'workspace/applyEdit': async (
    rawParams,
  ): Promise<{
    applied: boolean;
  }> => {
    const { edit } = rawParams as LspApplyWorkspaceEditParams;
    const { skipped } = await client.withMapping(async (mapping) =>
      applyWorkspaceEditChanges({
        client,
        edit,
        mapping,
        userEvent: 'lsp.applyEdit',
      }),
    );
    if (skipped.length > 0) {
      console.warn(`[lsp] applyEdit skipped ${describeSkippedEdits(skipped)}`);
    }
    // Answer truthfully: a server told its edit was applied when we dropped
    // part of it goes on to the next step believing the file already changed.
    // An edit with nothing to do (nothing skipped, nothing written) counts as
    // applied.
    return { applied: skipped.length === 0 };
  },

  // typescript-language-server sends this after a rename-producing refactoring to ask
  // the editor to start an interactive rename. We don't support it.
  '_typescript.rename': async () => null,
});

/**
 * Apply normalizations to `result` obj.
 */
const normalizeResult = (
  result: LspResponseMessage['result'],
): LspResponseMessage['result'] => {
  return normalizeCompletionItems(
    normalizeWorkspaceEdit(result as LspWorkspaceEdit),
  );
};

/**
 * On `textDocument/completion` request, some LS might return a CompletionList with a null `items` array.
 * This function ensures that if the result is a CompletionList object, the `items` array is initialized.
 */
const normalizeCompletionItems = (
  result: LspResponseMessage['result'],
): LspResponseMessage['result'] => {
  if (
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    !('items' in result)
  ) {
    return result;
  }

  const res = result as LspCompletionList;
  if (res.items == null) {
    res.items = [];
  }
  return res;
};

// Debugging logs
const logClientMessage = (
  lspId: LspId,
  fileId: string | undefined,
  message: LspMessage,
): void => {
  const { id, method } = message;
  switch (true) {
    case !!method:
      lspLog(
        `%cLSP [${lspId}-${fileId}] CLIENT (request):`,
        'color: aqua;',
        message,
      );
      break;
    case id != null && !method:
      lspLog(
        `%cLSP [${lspId}-${fileId}] CLIENT (response):`,
        'color: DarkOrchid;',
        message,
      );
      break;
    default:
      break;
  }
};

// Debugging logs
const logServerMessage = (
  lspId: LspId,
  fileId: string | undefined,
  message: LspMessage,
): void => {
  const { id, method } = message;
  switch (true) {
    case id != null && !method:
      lspLog(
        `%cLSP [${lspId}-${fileId}] SERVER (response):`,
        'color: green;',
        message,
      );
      break;
    case id == null && !!method:
      lspLog(
        `%cLSP [${lspId}-${fileId}] SERVER (notification):`,
        'color: yellow;',
        message,
      );
      break;
    case id != null && !!method:
      lspLog(
        `%cLSP [${lspId}-${fileId}] SERVER (request):`,
        'color: salmon;',
        message,
      );
      break;
    default:
      break;
  }
};

const patchInitializeRequest = (
  msg: LspRequestMessage,
  rootUri: string,
): void => {
  if (msg.method !== 'initialize') {
    return;
  }
  const params = msg.params as LspInitializeParams | undefined;
  if (!params) {
    return;
  }
  // add `rootPath` in initialize request for servers like Basedpyright that still use the deprecated field
  params.rootPath = rootUri;
  // set the locale so servers like Basedpyright don't localize messages based on the host machine's OS locale
  params.locale = 'en';
};

const handleResponseError = (
  client: CustomLspClient,
  message: LspResponseMessage,
): void => {
  if (message.error) {
    console.error('LSP ERROR', message.error.message);
    // Some servers report a rejected request this way (e.g. clangd on an
    // invalid rename target), so keep the text for the command to surface
    // before it's dropped.
    if (message.error.message) {
      client.recordServerMessage(message.error.message);
    }
    // prevent CodeMirror's built-in error dialog from appearing
    delete message.error;
  }
};

// console.log wrapper. On in non-production; in a production build it stays
// quiet unless LSP debug logging is enabled at runtime (see lsp-debug.ts).
const lspLog = (...args: unknown[]): void => {
  if (isLspDebugEnabled()) {
    console.log(...args);
  }
};
