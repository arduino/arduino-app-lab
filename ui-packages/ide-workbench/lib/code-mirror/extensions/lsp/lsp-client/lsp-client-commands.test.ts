/**
 * End-to-end tests for `lspRename`, `lspFormat` and `lspFindAllReferences` over
 * a fake backend: the real transport, client, workspace and rename panel, with
 * the language server replaced by hand-written responses.
 *
 * All three share a failure mode: silence. A name the server won't take is
 * answered with an empty edit, and so is a document the formatter cannot parse;
 * a references result that cannot be resolved throws where nothing was
 * listening. Nothing happens and nothing is reported. These tests pin both ends
 * of each — the work really lands, and a request that comes back empty or
 * broken says why.
 */

import { setDiagnostics } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, beforeAll, describe, expect, it, Mock, vi } from 'vitest';

import { FormatMessage } from '../../../../i18n/useI18n';
import { ViewInstances, viewInstances } from '../../../codeMirrorViewInstances';
import { getLspFeedbackTooltipExtension } from '../lsp-extensions/extensions/lsp-feedback-tooltip-extension';
import { LspReferencesResult } from '../lsp-references/lsp-references-types';
import {
  LspLocation,
  LspMessage,
  LspRequestMessage,
  LspWorkspaceEdit,
} from '../lsp-types';
import {
  lspFindAllReferences,
  lspFormat,
  lspRename,
} from './lsp-client-commands';
import { createLspClientTransport } from './lsp-client-transport';
import { CustomLspClient } from './lsp-client-types';
import { LspClientWorkspace } from './lsp-client-workspace';

// Keeps the protocol trace out of the test output.
vi.mock('../lsp-debug', () => ({ isLspDebugEnabled: (): boolean => false }));

beforeAll(() => {
  // jsdom has no layout: CodeMirror's tooltip positioning measures the range
  // it anchors to, which throws without this.
  Range.prototype.getClientRects = (): DOMRectList =>
    [] as unknown as DOMRectList;
});

const WORKSPACE_URI = 'file:///ws';
const FILE_URI = `${WORKSPACE_URI}/main.py`;
const DOC = 'value = 1\nprint(value)';

// Mimics useI18n's no-IntlProvider fallback: the default message with its
// placeholders filled in.
const formatMessage: FormatMessage = (descriptor, values) =>
  Object.entries(values ?? {}).reduce(
    (message, [key, value]) => message.replace(`{${key}}`, String(value)),
    String(descriptor.defaultMessage ?? ''),
  );

interface Backend {
  view: EditorView;
  client: CustomLspClient;
  /** Messages the client sent to the server, in order. */
  sent: LspRequestMessage[];
  /** Deliver a server message to the client. */
  receive: (message: LspMessage) => void;
  requestsFor: (method: string) => LspRequestMessage[];
  /** Store writes the workspace made for files with no view, in order. */
  writes: [string, string][];
  destroy: () => void;
}

const backends: Backend[] = [];

afterEach(() => {
  while (backends.length) {
    backends.pop()?.destroy();
  }
});

const startBackend = async ({
  // Overridable so a test can use a Windows-shaped workspace, where the two
  // ends spell the same uri differently.
  workspaceUri = WORKSPACE_URI,
  // Content the workspace can read for files no view holds, by uri. Absent by
  // default, which is the consumer that wires up no disk reader at all.
  disk,
}: {
  workspaceUri?: string;
  disk?: Record<string, string>;
} = {}): Promise<Backend> => {
  const sent: LspRequestMessage[] = [];
  const writes: [string, string][] = [];
  let receive: (message: LspMessage) => void = () => undefined;
  const fileUri = `${workspaceUri}/main.py`;

  const client = new CustomLspClient({
    rootUri: workspaceUri,
    workspace: (c): LspClientWorkspace =>
      new LspClientWorkspace(
        c,
        'python',
        workspaceUri,
        () => undefined,
        disk && (async (uri) => disk[uri] ?? Promise.reject(new Error(uri))),
        undefined,
        disk &&
          ((fileId, value) => {
            writes.push([fileId, value]);
            return true;
          }),
        disk && (async (fileId) => disk[`${workspaceUri}/${fileId}`]),
      ),
  });

  const { transport, transportDestroy } = createLspClientTransport({
    lspId: 'python',
    rootUri: workspaceUri,
    fileId: 'main.py',
    sendLspMessage: async (_lspId, message) => {
      sent.push(message as LspRequestMessage);
    },
    subscribeLspMessages: (_lspId, onMessage) => {
      receive = onMessage;
      return () => undefined;
    },
    client,
  });

  client.connect(transport);
  // Sends leave the transport one at a time, so `initialize` is not out yet.
  await flush();

  const requestsFor = (method: string): LspRequestMessage[] =>
    sent.filter((message) => message.method === method);

  // Answer `initialize` so the client exposes the server capabilities the
  // commands check before running.
  const initialize = requestsFor('initialize')[0];
  receive({
    jsonrpc: '2.0',
    id: initialize.id,
    result: {
      capabilities: {
        renameProvider: true,
        documentFormattingProvider: true,
        documentRangeFormattingProvider: true,
        referencesProvider: true,
      },
    },
  });
  // The client picks the capabilities up when the request promise settles.
  await flush();

  const view = new EditorView({
    state: EditorState.create({
      doc: DOC,
      // Cursor inside `value`, the symbol to rename.
      selection: { anchor: 2 },
      extensions: [
        client.plugin(fileUri, 'py'),
        getLspFeedbackTooltipExtension(),
      ],
    }),
    parent: document.body,
  });

  const backend: Backend = {
    view,
    client,
    sent,
    receive: (message) => receive(message),
    requestsFor,
    writes,
    destroy: () => {
      view.destroy();
      transportDestroy();
      client.disconnect();
    },
  };
  backends.push(backend);
  return backend;
};

const submitRename = (view: EditorView, newName: string): void => {
  lspRename(view, formatMessage);
  const input = view.dom.querySelector(
    '.cm-lsp-rename-input',
  ) as HTMLInputElement;
  input.value = newName;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
  );
};

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

// Both occurrences of `value` in DOC, rewritten to `total`, keyed by whichever
// uri the server chose to name the file with.
const renameEdit = (uri: string = FILE_URI): LspWorkspaceEdit => ({
  changes: {
    [uri]: [
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 5 },
        },
        newText: 'total',
      },
      {
        range: {
          start: { line: 1, character: 6 },
          end: { line: 1, character: 11 },
        },
        newText: 'total',
      },
    ],
  },
});

describe('transport', () => {
  const notification = (method: string): string =>
    JSON.stringify({ jsonrpc: '2.0', method, params: {} });

  const startTransport = (
    sendLspMessage: (lspId: string, message: LspMessage) => Promise<void>,
  ): ReturnType<typeof createLspClientTransport> =>
    createLspClientTransport({
      lspId: 'python',
      rootUri: WORKSPACE_URI,
      sendLspMessage,
      subscribeLspMessages: () => () => undefined,
      client: new CustomLspClient({ rootUri: WORKSPACE_URI }),
    });

  it('starts a send only once the previous one was delivered', async () => {
    const started: string[] = [];
    let deliverFirst: () => void = () => undefined;
    const { transport, transportDestroy } = startTransport(
      async (_lspId, message) => {
        started.push((message as LspRequestMessage).method);
        if (started.length === 1) {
          await new Promise<void>((resolve) => {
            deliverFirst = resolve;
          });
        }
      },
    );

    transport.send(notification('textDocument/didClose'));
    transport.send(notification('textDocument/didOpen'));
    await flush();
    expect(started).toEqual(['textDocument/didClose']);

    deliverFirst();
    await flush();
    expect(started).toEqual(['textDocument/didClose', 'textDocument/didOpen']);
    transportDestroy();
  });

  it('keeps sending after a send fails', async () => {
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const started: string[] = [];
    const { transport, transportDestroy } = startTransport(
      async (_lspId, message) => {
        started.push((message as LspRequestMessage).method);
        if (started.length === 1) {
          throw new Error('LSP python is not active');
        }
      },
    );

    transport.send(notification('textDocument/didChange'));
    transport.send(notification('textDocument/didSave'));
    await flush();

    expect(started).toEqual(['textDocument/didChange', 'textDocument/didSave']);
    transportDestroy();
    error.mockRestore();
  });
});

/**
 * What the servers index. Nothing else tells them the workspace exists, and
 * without it they resolve only the documents this client has opened — which is
 * the set of files the user happens to have clicked on.
 */
describe('initialize', () => {
  it('declares the workspace root as a folder the server may read', async () => {
    const { requestsFor } = await startBackend();

    const [initialize] = requestsFor('initialize');
    expect(initialize.params).toMatchObject({
      rootUri: WORKSPACE_URI,
      rootPath: WORKSPACE_URI,
      workspaceFolders: [{ uri: WORKSPACE_URI, name: 'ws' }],
      capabilities: { workspace: { workspaceFolders: true } },
    });
  });

  it('answers the folders request the capability invites', async () => {
    const { receive, sent } = await startBackend();

    receive({
      jsonrpc: '2.0',
      id: 77,
      method: 'workspace/workspaceFolders',
      params: undefined,
    });
    await flush();

    expect(sent.find((message) => message.id === 77)).toEqual({
      jsonrpc: '2.0',
      id: 77,
      result: [{ uri: WORKSPACE_URI, name: 'ws' }],
    });
  });
});

describe('lspRename', () => {
  it('applies every edit the server returns', async () => {
    const { view, receive, requestsFor } = await startBackend();

    submitRename(view, 'total');
    await flush();

    const [request] = requestsFor('textDocument/rename');
    expect(request.params).toMatchObject({
      newName: 'total',
      textDocument: { uri: FILE_URI },
      // The symbol's start, not wherever inside it the cursor happened to be.
      position: { line: 0, character: 0 },
    });

    receive({ jsonrpc: '2.0', id: request.id, result: renameEdit() });
    await flush();

    expect(view.state.doc.toString()).toBe('total = 1\nprint(total)');
  });

  it('never sends a name the language rejects', async () => {
    const { view, requestsFor } = await startBackend();

    submitRename(view, '$bad');
    await flush();

    expect(requestsFor('textDocument/rename')).toHaveLength(0);
    // The panel stays open with the reason, instead of closing on a no-op.
    const message = view.dom.querySelector('.cm-lsp-rename-message');
    expect(message?.textContent).toBe('“$bad” is not a valid name');
  });

  it('does not send a request when the name is unchanged', async () => {
    const { view, requestsFor } = await startBackend();

    submitRename(view, 'value');
    await flush();

    expect(requestsFor('textDocument/rename')).toHaveLength(0);
    expect(view.state.doc.toString()).toBe(DOC);
  });

  it('keeps the server reason for a rename that comes back empty', async () => {
    const { view, sent, receive, requestsFor } = await startBackend();

    submitRename(view, 'total');
    await flush();
    const [request] = requestsFor('textDocument/rename');

    // What Basedpyright does with a name it won't take: a window message with
    // the reason, then an empty edit.
    receive({
      jsonrpc: '2.0',
      id: 99,
      method: 'window/showMessageRequest',
      params: { type: 2, message: 'Cannot rename a builtin', actions: [] },
    });
    receive({ jsonrpc: '2.0', id: request.id, result: { changes: {} } });
    await flush();

    expect(view.state.doc.toString()).toBe(DOC);
    // The message request is answered rather than refused with
    // MethodNotFound — which is what used to drop the only explanation the
    // user could have been given.
    expect(sent.find((message) => message.id === 99)).toEqual({
      jsonrpc: '2.0',
      id: 99,
      result: null,
    });
    // …and the reason reaches the editor as the rename's feedback.
    expect(
      view.dom.querySelector('.cm-lsp-feedback-tooltip')?.textContent,
    ).toBe('Cannot rename a builtin');
  });

  /**
   * The Windows case. We open `file:///C:/ws/main.py` (uppercase drive, literal
   * colon — what `toFileUri` builds from the path Go hands us), but the servers
   * serialize any uri they did not receive from us — everything their own
   * workspace scan and import resolution finds — as `file:///c%3A/ws/main.py`.
   *
   * Our lookups fold those together, but @codemirror/lsp-client's
   * WorkspaceMapping is a plain Map keyed by our exact didOpen string: mapping
   * a position through the server's spelling throws "Cannot map from a file
   * that's not in the workspace", inside a callback whose rejection nothing
   * was watching. Every Windows rename applied nothing and said nothing.
   */
  it('applies edits keyed with the spelling of the uri the server chose', async () => {
    const { view, receive, requestsFor } = await startBackend({
      workspaceUri: 'file:///C:/ws',
    });

    submitRename(view, 'total');
    await flush();
    const [request] = requestsFor('textDocument/rename');
    expect(request.params).toMatchObject({
      textDocument: { uri: 'file:///C:/ws/main.py' },
    });

    receive({
      jsonrpc: '2.0',
      id: request.id,
      result: renameEdit('file:///c%3A/ws/main.py'),
    });
    await flush();

    expect(view.state.doc.toString()).toBe('total = 1\nprint(total)');
    expect(feedbackText(view)).toBeUndefined();
  });

  /**
   * The common shape of a cross-file rename: the servers index the whole
   * workspace from disk, so they report references in files this client never
   * opened and has no mapping for. Those documents have to be picked up from
   * disk on the spot — skipping them renames a symbol in the open file only and
   * leaves the rest of the app calling a name that no longer exists.
   */
  it('applies an edit to a file the user never opened', async () => {
    const OTHER = 'other.py';
    const OTHER_URI = `${WORKSPACE_URI}/${OTHER}`;
    const { view, receive, requestsFor, writes } = await startBackend({
      disk: { [OTHER_URI]: DOC },
    });

    submitRename(view, 'total');
    await flush();
    const [request] = requestsFor('textDocument/rename');

    receive({
      jsonrpc: '2.0',
      id: request.id,
      result: {
        changes: {
          ...renameEdit().changes,
          ...renameEdit(OTHER_URI).changes,
        },
      },
    });
    await flush();

    expect(view.state.doc.toString()).toBe('total = 1\nprint(total)');
    expect(feedbackText(view)).toMatch(/^Renamed in this file and/);
    // Written through the store rather than opened in a panel: a rename must not
    // spawn a tab per file it touches.
    expect(writes).toEqual([[OTHER, 'total = 1\nprint(total)']]);
  });

  // The Arduino LS on Windows lists some edits of a rename twice for one file.
  it('applies an edit the server lists twice only once', async () => {
    const OTHER = 'other.py';
    const OTHER_URI = `${WORKSPACE_URI}/${OTHER}`;
    const { view, receive, requestsFor, writes } = await startBackend({
      disk: { [OTHER_URI]: DOC },
    });

    submitRename(view, 'total');
    await flush();
    const [request] = requestsFor('textDocument/rename');

    const twice = (uri: string): LspWorkspaceEdit['changes'] => {
      const edits = renameEdit(uri).changes?.[uri] ?? [];
      return { [uri]: [...edits, ...edits] };
    };
    receive({
      jsonrpc: '2.0',
      id: request.id,
      result: { changes: { ...twice(FILE_URI), ...twice(OTHER_URI) } },
    });
    await flush();

    expect(view.state.doc.toString()).toBe('total = 1\nprint(total)');
    expect(writes).toEqual([[OTHER, 'total = 1\nprint(total)']]);
  });

  it('reports instead of throwing when an edit names a file it cannot map', async () => {
    const { view, receive, requestsFor } = await startBackend();
    const logged = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    submitRename(view, 'total');
    await flush();
    const [request] = requestsFor('textDocument/rename');

    // A file the workspace never opened has no entry in the mapping, and this
    // consumer wires up no disk reader to pick one up with. Losing it must not
    // lose the request.
    receive({
      jsonrpc: '2.0',
      id: request.id,
      result: renameEdit(`${WORKSPACE_URI}/never-opened.py`),
    });
    await flush();

    expect(view.state.doc.toString()).toBe(DOC);
    expect(feedbackText(view)).toBe('Could not rename symbol');
    // The log has to name the gate: this one is retryable, unlike a uri that
    // resolved outside the workspace.
    expect(logged).toHaveBeenCalledWith(
      '[lsp] rename applied nothing — skipped file:///ws/never-opened.py (not-in-mapping)',
    );
    logged.mockRestore();
  });

  /**
   * A path spelling our folding cannot see through, which on Windows means an
   * 8.3 short workspace root (`%TMP%` hands one back whenever the account name
   * is not 8.3-clean) against the long form every server canonicalises to. The
   * uri resolves outside the workspace, so the edit is refused as if it were a
   * read-only library file — and only the Go side, which has the filesystem,
   * can fold the two spellings together. All this side can do is name it.
   */
  it('names the workspace root mismatch when an edit resolves outside it', async () => {
    const { view, receive, requestsFor } = await startBackend({
      workspaceUri: 'file:///C:/Users/A1B2C~1.LAS/ws',
    });
    const logged = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    submitRename(view, 'total');
    await flush();
    const [request] = requestsFor('textDocument/rename');

    receive({
      jsonrpc: '2.0',
      id: request.id,
      result: renameEdit('file:///c%3A/Users/first.last/ws/main.py'),
    });
    await flush();

    expect(view.state.doc.toString()).toBe(DOC);
    expect(feedbackText(view)).toBe('Could not rename symbol');
    expect(logged).toHaveBeenCalledWith(
      '[lsp] rename applied nothing — skipped file:///c%3A/Users/first.last/ws/main.py (outside-workspace)',
    );
    logged.mockRestore();
  });

  it('says so when only some of the files could be updated', async () => {
    const { view, receive, requestsFor } = await startBackend();

    submitRename(view, 'total');
    await flush();
    const [request] = requestsFor('textDocument/rename');

    receive({
      jsonrpc: '2.0',
      id: request.id,
      result: {
        changes: {
          ...renameEdit().changes,
          ...renameEdit(`${WORKSPACE_URI}/never-opened.py`).changes,
        },
      },
    });
    await flush();

    // What could be written is written, and the shortfall is reported rather
    // than passing for a complete rename.
    expect(view.state.doc.toString()).toBe('total = 1\nprint(total)');
    expect(feedbackText(view)).toBe(
      'Renamed, but some files could not be updated',
    );
  });
});

const feedbackText = (view: EditorView): string | undefined =>
  view.dom.querySelector('.cm-lsp-feedback-tooltip')?.textContent ?? undefined;

// The error the main language server publishes for a file its formatter cannot
// parse. Set straight onto the lint state, which is where publishDiagnostics
// lands in production (see `lsp-client.ts`) and where the command reads from.
const showErrorDiagnostic = (view: EditorView): void => {
  view.dispatch(
    setDiagnostics(view.state, [
      { from: 0, to: 5, severity: 'error', message: 'Unindent not expected' },
    ]),
  );
};

describe('lspFormat', () => {
  it('applies the edits the server returns', async () => {
    const { view, receive, requestsFor } = await startBackend();

    lspFormat(view, formatMessage);
    await flush();

    const [request] = requestsFor('textDocument/formatting');
    expect(request.params).toMatchObject({ textDocument: { uri: FILE_URI } });

    // How a formatter answers: the whole document, rewritten.
    receive({
      jsonrpc: '2.0',
      id: request.id,
      result: [
        {
          range: {
            start: { line: 0, character: 0 },
            end: { line: 1, character: 12 },
          },
          newText: 'value = 1\nprint(value)\n',
        },
      ],
    });
    await flush();

    expect(view.state.doc.toString()).toBe('value = 1\nprint(value)\n');
    expect(feedbackText(view)).toBeUndefined();
  });

  it('formats only the selection when there is one', async () => {
    const { view, receive, requestsFor } = await startBackend();

    view.dispatch({ selection: { anchor: 0, head: 9 } });
    lspFormat(view, formatMessage);
    await flush();

    expect(requestsFor('textDocument/formatting')).toHaveLength(0);
    const [request] = requestsFor('textDocument/rangeFormatting');
    expect(request.params).toMatchObject({
      textDocument: { uri: FILE_URI },
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 9 },
      },
    });

    receive({
      jsonrpc: '2.0',
      id: request.id,
      result: [
        {
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 9 },
          },
          newText: 'value = 2',
        },
      ],
    });
    await flush();

    expect(view.state.doc.toString()).toBe('value = 2\nprint(value)');
  });

  it('applies an edit that ends past the end of the document', async () => {
    const { view, receive, requestsFor } = await startBackend();

    lspFormat(view, formatMessage);
    await flush();
    const [request] = requestsFor('textDocument/formatting');

    // What the Arduino LS sends for a sketch: clang-format's edit ends on the
    // first preprocessor-added line of the .cpp, which its sketch mapper
    // reports as the line *after* the .ino's last one. DOC has 2 lines, so line
    // 2 does not exist — converting it used to throw a RangeError and lose
    // every edit in the response.
    receive({
      jsonrpc: '2.0',
      id: request.id,
      result: [
        {
          range: {
            start: { line: 0, character: 0 },
            end: { line: 2, character: 0 },
          },
          newText: 'value = 1\nprint(value)\n',
        },
      ],
    });
    await flush();

    // The edit lands on the whole document, which is what "one past the last
    // line" described.
    expect(view.state.doc.toString()).toBe('value = 1\nprint(value)\n');
  });

  it('reports a document the formatter would not format', async () => {
    const { view, receive, requestsFor } = await startBackend();
    showErrorDiagnostic(view);

    lspFormat(view, formatMessage);
    await flush();
    const [request] = requestsFor('textDocument/formatting');

    // What ruff does with a file it cannot parse: no edits at all, with the
    // syntax error reported only in its own stderr log.
    receive({ jsonrpc: '2.0', id: request.id, result: null });
    await flush();

    expect(view.state.doc.toString()).toBe(DOC);
    expect(feedbackText(view)).toBe(
      'Could not format: fix the errors in this file first',
    );
  });

  it('stays quiet for a document that was already formatted', async () => {
    const { view, receive, requestsFor } = await startBackend();

    lspFormat(view, formatMessage);
    await flush();
    const [request] = requestsFor('textDocument/formatting');

    // Same empty answer, but nothing is wrong with the file — reporting it
    // would turn every no-op format into a false alarm.
    receive({ jsonrpc: '2.0', id: request.id, result: null });
    await flush();

    expect(view.state.doc.toString()).toBe(DOC);
    expect(feedbackText(view)).toBeUndefined();
  });

  it('stays quiet when the server sends an empty list of edits', async () => {
    const { view, receive, requestsFor } = await startBackend();
    // A sketch mid-edit: clangd reports errors while the code is incomplete,
    // and clang-format still formats it happily.
    showErrorDiagnostic(view);

    lspFormat(view, formatMessage);
    await flush();
    const [request] = requestsFor('textDocument/formatting');

    // "Here are the edits: none" — the document is already formatted, which is
    // not the same as the server refusing to format it.
    receive({ jsonrpc: '2.0', id: request.id, result: [] });
    await flush();

    expect(feedbackText(view)).toBeUndefined();
  });

  it('prefers the server reason when it sent one', async () => {
    const { view, receive, requestsFor } = await startBackend();
    showErrorDiagnostic(view);

    lspFormat(view, formatMessage);
    await flush();
    const [request] = requestsFor('textDocument/formatting');

    receive({
      jsonrpc: '2.0',
      id: 99,
      method: 'window/showMessageRequest',
      params: { type: 1, message: 'Failed to format document', actions: [] },
    });
    receive({ jsonrpc: '2.0', id: request.id, result: null });
    await flush();

    expect(feedbackText(view)).toBe('Failed to format document');
  });

  // The Arduino LS reports a document it cannot resolve — which is every document,
  // until clangd is up — as a zero-value URI. Formatting a sketch while the
  // language server was still loading put a bare "file:///" in the tooltip.
  it('does not show a bare URI the server sent as its reason', async () => {
    const { view, receive, requestsFor } = await startBackend();
    showErrorDiagnostic(view);

    lspFormat(view, formatMessage);
    await flush();
    const [request] = requestsFor('textDocument/formatting');

    receive({
      jsonrpc: '2.0',
      id: 99,
      method: 'window/showMessageRequest',
      params: { type: 1, message: 'file:///', actions: [] },
    });
    receive({ jsonrpc: '2.0', id: request.id, result: null });
    await flush();

    // Falls back to the reason we can actually explain, rather than the URI.
    expect(feedbackText(view)).toBe(
      'Could not format: fix the errors in this file first',
    );
  });

  // Same for clangd's raw JSON-RPC failures, which the Arduino LS forwards
  // verbatim ("-32602 trying to get AST for non-added document").
  it('does not show a forwarded JSON-RPC error code as its reason', async () => {
    const { view, receive, requestsFor } = await startBackend();

    lspFormat(view, formatMessage);
    await flush();
    const [request] = requestsFor('textDocument/formatting');

    receive({
      jsonrpc: '2.0',
      id: 98,
      method: 'window/showMessageRequest',
      params: {
        type: 1,
        message: '-32602 trying to get AST for non-added document',
        actions: [],
      },
    });
    receive({ jsonrpc: '2.0', id: request.id, result: null });
    await flush();

    // Nothing truthful is left to say, and inventing a message would be a false
    // alarm on every no-op format.
    expect(feedbackText(view)).toBeUndefined();
  });

  // A URI inside a sentence is the server explaining something real.
  it('still shows a reason that only contains a URI', async () => {
    const { view, receive, requestsFor } = await startBackend();

    lspFormat(view, formatMessage);
    await flush();
    const [request] = requestsFor('textDocument/formatting');

    receive({
      jsonrpc: '2.0',
      id: 97,
      method: 'window/showMessageRequest',
      params: {
        type: 1,
        message: 'Cannot open file:///tmp/x.ino',
        actions: [],
      },
    });
    receive({ jsonrpc: '2.0', id: request.id, result: null });
    await flush();

    expect(feedbackText(view)).toBe('Cannot open file:///tmp/x.ino');
  });
});

/**
 * `lspFindAllReferences` hands its result to a React panel rather than writing
 * to the document, so its failure mode is the same silence the two commands
 * above have: the request succeeds, resolving the locations into rows throws,
 * and the user sees no panel and no reason. The `catch` covering the request is
 * answered by the transport; this one has to speak for itself.
 */
describe('lspFindAllReferences', () => {
  const referenceAt = (
    line: number,
    from: number,
    to: number,
  ): LspLocation => ({
    uri: FILE_URI,
    range: { start: { line, character: from }, end: { line, character: to } },
  });

  /** Run the command and answer its request with `result`. */
  const search = async (
    backend: Backend,
    result: LspLocation[] | null,
  ): Promise<Mock<(result: LspReferencesResult) => void>> => {
    const showLspReferences = vi.fn();

    lspFindAllReferences(backend.view, formatMessage, showLspReferences);
    await flush();

    const [request] = backend.requestsFor('textDocument/references');
    backend.receive({ jsonrpc: '2.0', id: request.id, result });
    await flush();

    return showLspReferences;
  };

  afterEach(() => {
    viewInstances[ViewInstances.Editor2].instance = null;
  });

  it('hands the resolved rows to the panel', async () => {
    const backend = await startBackend();

    const showLspReferences = await search(backend, [
      referenceAt(0, 0, 5),
      referenceAt(1, 6, 11),
    ]);

    expect(showLspReferences).toHaveBeenCalledTimes(1);
    const [result] = showLspReferences.mock.calls[0];
    expect(result.symbol).toBe('value');
    expect(result.totalCount).toBe(2);
    expect(result.groups[0].rows.map((row) => row.lineNumber)).toEqual([1, 2]);
  });

  /**
   * The panel has to travel with the result: by the time the panel closes there
   * is nothing left in the DOM to recover it from, and a search started from
   * the context menu never leaves a focused panel behind at all.
   */
  it('carries the panel the search was run from', async () => {
    const backend = await startBackend();
    viewInstances[ViewInstances.Editor2].instance = backend.view;

    const showLspReferences = await search(backend, [referenceAt(0, 0, 5)]);

    const [result] = showLspReferences.mock.calls[0];
    expect(result.originViewInstanceId).toBe(ViewInstances.Editor2);
  });

  it('falls back to the left panel for a view that is not a registered panel', async () => {
    const backend = await startBackend();

    const showLspReferences = await search(backend, [referenceAt(0, 0, 5)]);

    const [result] = showLspReferences.mock.calls[0];
    expect(result.originViewInstanceId).toBe(ViewInstances.Editor);
  });

  it('reports a search the server answered with nothing', async () => {
    const backend = await startBackend();

    const showLspReferences = await search(backend, []);

    expect(showLspReferences).not.toHaveBeenCalled();
    expect(feedbackText(backend.view)).toBe('No references found');
  });

  /**
   * A refused search is indistinguishable from an empty one by the time it gets
   * here — the transport strips the JSON-RPC error before it can reject the
   * request — so the server's own account of it is the only thing that tells
   * the two apart, and reporting "No references found" over the top of it is a
   * plain lie about a symbol that may well have references.
   */
  it('prefers the reason the server gave for refusing the search', async () => {
    const backend = await startBackend();
    const showLspReferences = vi.fn();

    lspFindAllReferences(backend.view, formatMessage, showLspReferences);
    await flush();

    const [request] = backend.requestsFor('textDocument/references');
    backend.receive({
      jsonrpc: '2.0',
      id: request.id,
      error: { code: -32602, message: 'No symbol under the cursor' },
    } as unknown as LspMessage);
    await flush();

    expect(showLspReferences).not.toHaveBeenCalled();
    expect(feedbackText(backend.view)).toBe('No symbol under the cursor');
  });

  /**
   * The window message route, which is how Basedpyright explains a refusal it
   * then answers with an empty result rather than an error.
   */
  it('prefers a reason sent as a window message', async () => {
    const backend = await startBackend();
    const showLspReferences = vi.fn();

    lspFindAllReferences(backend.view, formatMessage, showLspReferences);
    await flush();

    backend.receive({
      jsonrpc: '2.0',
      id: 98,
      method: 'window/showMessageRequest',
      params: { type: 1, message: 'Indexing not finished', actions: [] },
    });
    const [request] = backend.requestsFor('textDocument/references');
    backend.receive({ jsonrpc: '2.0', id: request.id, result: [] });
    await flush();

    expect(feedbackText(backend.view)).toBe('Indexing not finished');
  });

  it('reports a result it could not resolve, rather than doing nothing', async () => {
    const backend = await startBackend();
    vi.spyOn(backend.client.workspace, 'requestFile').mockRejectedValue(
      new Error('workspace gone'),
    );

    const showLspReferences = await search(backend, [referenceAt(0, 0, 5)]);

    expect(showLspReferences).not.toHaveBeenCalled();
    expect(feedbackText(backend.view)).toBe('Could not list references');
  });
});
