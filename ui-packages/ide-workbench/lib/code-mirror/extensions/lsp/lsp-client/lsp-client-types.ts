import { LSPClient } from '@codemirror/lsp-client';

import { normalizeFileUri } from '../lsp-file-uri';
import { LspDiagnostic } from '../lsp-types';
import { LspClientWorkspace } from './lsp-client-workspace';

type LspClientConfig = NonNullable<ConstructorParameters<typeof LSPClient>[0]>;
type CustomLspClientConfig = Omit<
  LspClientConfig,
  'workspace' | 'notificationHandlers' | 'unhandledNotification'
> & {
  workspace?: (client: CustomLspClient) => LspClientWorkspace;

  notificationHandlers?: {
    [method: string]: (client: CustomLspClient, params: unknown) => boolean;
  };

  unhandledNotification?: (
    client: CustomLspClient,
    method: string,
    params: unknown,
  ) => void;
};

/**
 * True for a server message worth putting in front of a user.
 *
 * Servers label plenty of internal text Error/Warning, and whatever they send
 * reaches an editor tooltip word for word (rename and format both report the
 * server's own reason in preference to a generic one). The Arduino LS sent a bare
 * `file:///` — a zero-value document URI, which is what it reports when it cannot
 * resolve the sketch because clangd is not up yet — and forwards clangd's raw
 * JSON-RPC failures like "-32602 trying to get AST for non-added document".
 * Neither means anything to the person who pressed Format.
 *
 * Prose, here, means: not empty, not just a URI, and not opening with a JSON-RPC
 * error code. Deliberately conservative — a false negative costs a generic
 * fallback message, a false positive puts protocol noise in the UI.
 */
export const isProseServerMessage = (message: string): boolean => {
  const trimmed = message.trim();
  if (trimmed === '') {
    return false;
  }
  // A URI on its own, with or without a path. Anything with prose around it
  // (e.g. "Cannot open file:///x") keeps a space and stays.
  if (/^\w[\w+.-]*:\/\/\S*$/.test(trimmed)) {
    return false;
  }
  // "-32602 trying to get AST…", "-32001 Line value is out of range (6)": the
  // language server prefixes forwarded failures with the code.
  if (/^-?3\d{4}\b/.test(trimmed)) {
    return false;
  }
  return true;
};

export class CustomLspClient extends LSPClient {
  declare workspace: LspClientWorkspace;
  // textDocument/publishDiagnostics results keyed by file URI (used by `lsp-code-action-extension`)
  private readonly diagnosticsMap = new Map<string, LspDiagnostic[]>();

  // Last user-facing message the server sent, with the time it arrived.
  private lastServerMessage?: { message: string; at: number };

  constructor(config?: CustomLspClientConfig) {
    super(config as LspClientConfig);
  }

  /**
   * Remember a message the server meant for the user: a `window/showMessage`
   * notification/request, or the `message` of an error response (see
   * `handleResponseError`). Both are otherwise dropped — @codemirror/lsp-client
   * answers server requests with MethodNotFound, and the transport strips
   * response errors to suppress the library's error dialog — which leaves the
   * commands they explain (rename, notably) failing silently.
   *
   * Only prose is kept, because these end up in an editor tooltip verbatim and
   * the severity flag is no promise that the text was written for a user — see
   * isProseServerMessage.
   */
  recordServerMessage(message: string): void {
    if (!isProseServerMessage(message)) {
      console.warn('[lsp] ignoring non-prose server message:', message);
      return;
    }
    this.lastServerMessage = { message, at: Date.now() };
  }

  /**
   * Consume the last server message, if it arrived at/after `since` (the time
   * the caller sent its request), so a command reports only the message its own
   * request produced.
   */
  takeServerMessage(since: number): string | undefined {
    const last = this.lastServerMessage;
    if (!last || last.at < since) {
      return undefined;
    }
    this.lastServerMessage = undefined;
    return last.message;
  }

  setDiagnostics(uri: string, diagnostics: LspDiagnostic[]): void {
    this.diagnosticsMap.set(normalizeFileUri(uri), diagnostics);
  }

  getDiagnostics(uri: string): LspDiagnostic[] | undefined {
    return this.diagnosticsMap.get(normalizeFileUri(uri));
  }

  deleteDiagnostics(uri: string): void {
    this.diagnosticsMap.delete(normalizeFileUri(uri));
  }
}

export type LspClientRef = {
  client: CustomLspClient;
  transportDestroy: () => void;
};
