/**
 * Regression tests for the position conversion in the document-highlight
 * extension, over the real transport, client and workspace with the language
 * server replaced by hand-written responses.
 *
 * The response describes the document the server has, not the one on screen. This
 * extension used to convert it against the live document, which threw
 * `RangeError: Invalid position N in document of length M` and lost the whole
 * response whenever the two had drifted — reliably during a rename, which rewrites
 * several occurrences at once, and only on a machine slow enough for the server to
 * fall behind the debounce.
 */

import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LspMessage, LspRequestMessage } from '../../lsp-types';
import { createLspClientTransport } from '../../lsp-client/lsp-client-transport';
import { CustomLspClient } from '../../lsp-client/lsp-client-types';
import { LspClientWorkspace } from '../../lsp-client/lsp-client-workspace';
import { getLspDocumentHighlightExtension } from './lsp-document-highlight-extension';

vi.mock('../../lsp-debug', () => ({
  isLspDebugEnabled: (): boolean => false,
}));

const WORKSPACE_URI = 'file:///ws';
const FILE_URI = `${WORKSPACE_URI}/main.py`;
const DOC = 'value = 1\nprint(value)';
const HIGHLIGHT_DEBOUNCE_MS = 150;

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

interface Backend {
  view: EditorView;
  sent: LspRequestMessage[];
  receive: (message: LspMessage) => void;
  requestsFor: (method: string) => LspRequestMessage[];
  destroy: () => void;
}

const backends: Backend[] = [];

afterEach(() => {
  while (backends.length) {
    backends.pop()?.destroy();
  }
  vi.useRealTimers();
});

const startBackend = async (): Promise<Backend> => {
  const sent: LspRequestMessage[] = [];
  let receive: (message: LspMessage) => void = () => undefined;

  const client = new CustomLspClient({
    rootUri: WORKSPACE_URI,
    workspace: (c): LspClientWorkspace =>
      new LspClientWorkspace(c, 'python', WORKSPACE_URI, () => undefined),
  });

  const { transport, transportDestroy } = createLspClientTransport({
    lspId: 'python',
    rootUri: WORKSPACE_URI,
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

  const requestsFor = (method: string): LspRequestMessage[] =>
    sent.filter((message) => message.method === method);

  const initialize = requestsFor('initialize')[0];
  receive({
    jsonrpc: '2.0',
    id: initialize.id,
    result: { capabilities: { documentHighlightProvider: true } },
  });
  await flush();

  const view = new EditorView({
    state: EditorState.create({
      doc: DOC,
      selection: { anchor: 2 },
      extensions: [
        client.plugin(FILE_URI, 'py'),
        getLspDocumentHighlightExtension({ client }),
      ],
    }),
    parent: document.body,
  });

  const backend: Backend = {
    view,
    sent,
    receive: (message) => receive(message),
    requestsFor,
    destroy: () => {
      view.destroy();
      transportDestroy();
      client.disconnect();
    },
  };
  backends.push(backend);
  return backend;
};

/** Count of highlight decorations currently rendered. */
const highlightCount = (view: EditorView): number =>
  view.dom.querySelectorAll('[class*="cm-lsp-highlight"]').length;

describe('lsp document highlight', () => {
  it('syncs the document before asking, so the server answers about what is on screen', async () => {
    const { view, requestsFor } = await startBackend();

    view.dispatch({ changes: { from: 0, insert: 'x' } });
    await new Promise((resolve) =>
      setTimeout(resolve, HIGHLIGHT_DEBOUNCE_MS + 50),
    );
    await flush();

    // Every other request path syncs first; this one did not, which is half of
    // why the server's answer could describe a different document.
    const didChange = requestsFor('textDocument/didChange');
    expect(didChange.length).toBeGreaterThan(0);
    expect(requestsFor('textDocument/documentHighlight').length).toBe(1);
  });

  it('survives a response describing a longer document than the one on screen', async () => {
    const { view, receive, requestsFor } = await startBackend();
    const errors: string[] = [];
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation((...args) => {
        errors.push(args.map((a) => String(a)).join(' '));
      });

    // The cursor sits at the very start and the edits all land after it, so
    // `selection.main.head` never moves. That matters: the extension discards a
    // response whose cursor moved, which would hide the conversion entirely.
    view.dispatch({ selection: { anchor: 0 } });
    view.dispatch({ changes: { from: view.state.doc.length, insert: '\nmore' } });
    await new Promise((resolve) =>
      setTimeout(resolve, HIGHLIGHT_DEBOUNCE_MS + 50),
    );
    await flush();
    const [request] = requestsFor('textDocument/documentHighlight');
    expect(request).toBeDefined();

    // A rename lands while the request is in flight, collapsing the document to
    // far shorter than what the server was told about — but leaving the cursor
    // where it was.
    view.dispatch({ changes: { from: 1, to: view.state.doc.length } });
    expect(view.state.doc.length).toBe(1);

    // Valid in the document the server has, far past the end of the one on
    // screen. Converted against the live doc this throws inside `doc.line()`.
    receive({
      jsonrpc: '2.0',
      id: request.id,
      result: [
        {
          range: {
            start: { line: 1, character: 6 },
            end: { line: 1, character: 11 },
          },
          kind: 1,
        },
      ],
    });
    await flush();

    expect(errors.filter((e) => e.includes('RangeError'))).toHaveLength(0);
    consoleError.mockRestore();
  });

  // A cross-file rename opens the other file into the same pane, so a response
  // for the file we asked about lands while the view shows a different one.
  // Positions from a 200-line module against a 2-line one threw
  // `RangeError: Invalid position 108 in document of length 18`.
  it('discards a response whose positions do not fit the document', async () => {
    const { view, receive, requestsFor } = await startBackend();
    const errors: string[] = [];
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation((...args) => {
        errors.push(args.map((a) => String(a)).join(' '));
      });

    view.dispatch({ selection: { anchor: 0 } });
    view.dispatch({ changes: { from: view.state.doc.length, insert: '\nx' } });
    await new Promise((resolve) =>
      setTimeout(resolve, HIGHLIGHT_DEBOUNCE_MS + 50),
    );
    await flush();
    const [request] = requestsFor('textDocument/documentHighlight');
    expect(request).toBeDefined();

    // Line 40 does not exist in this document at any version.
    receive({
      jsonrpc: '2.0',
      id: request.id,
      result: [
        {
          range: {
            start: { line: 40, character: 4 },
            end: { line: 40, character: 9 },
          },
          kind: 1,
        },
      ],
    });
    await flush();

    expect(errors.filter((e) => e.includes('RangeError'))).toHaveLength(0);
    expect(highlightCount(view)).toBe(0);
    consoleError.mockRestore();
  });

  it('renders highlights for a response that still fits', async () => {
    const { view, receive, requestsFor } = await startBackend();

    view.dispatch({ selection: { anchor: 3 } });
    await new Promise((resolve) =>
      setTimeout(resolve, HIGHLIGHT_DEBOUNCE_MS + 50),
    );
    await flush();
    const [request] = requestsFor('textDocument/documentHighlight');
    expect(request).toBeDefined();

    receive({
      jsonrpc: '2.0',
      id: request.id,
      result: [
        { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } }, kind: 3 },
        { range: { start: { line: 1, character: 6 }, end: { line: 1, character: 11 } }, kind: 2 },
      ],
    });
    await flush();

    expect(highlightCount(view)).toBe(2);
  });
});
