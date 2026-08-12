import { LSPPlugin } from '@codemirror/lsp-client';
import { Extension, StateEffect, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';

import { CustomLspClient } from '../../lsp-client/lsp-client-types';
import {
  LspDocumentHighlight,
  LspDocumentHighlightParams,
} from '../../lsp-types';

const HIGHLIGHT_DEBOUNCE_MS = 150;

const HIGHLIGHT_KIND_CLASS: Record<number, string> = {
  1: 'cm-lsp-highlight-text',
  2: 'cm-lsp-highlight-read',
  3: 'cm-lsp-highlight-write',
};

const getHighlightClass = (kind?: number): string => {
  return HIGHLIGHT_KIND_CLASS[kind ?? 1] ?? HIGHLIGHT_KIND_CLASS[1];
};

interface GetLspDocumentHighlightExtensionParams {
  client: CustomLspClient;
}

export const getLspDocumentHighlightExtension = ({
  client,
}: GetLspDocumentHighlightExtensionParams): Extension => {
  const highlightsStateEffect = StateEffect.define<DecorationSet>();

  const highlightsStateField = StateField.define<DecorationSet>({
    create() {
      return Decoration.none;
    },
    update(value, transaction) {
      if (transaction.docChanged) {
        value = Decoration.none;
      } else {
        value = value.map(transaction.changes);
      }
      for (const effect of transaction.effects) {
        if (effect.is(highlightsStateEffect)) {
          value = effect.value;
        }
      }
      return value;
    },
    provide: (field) => EditorView.decorations.from(field),
  });

  let highlightTimer: NodeJS.Timeout | null = null;

  const clearHighlights = (view: EditorView): void => {
    if (highlightTimer) {
      clearTimeout(highlightTimer);
      highlightTimer = null;
    }
    if (view.state.field(highlightsStateField).size > 0) {
      view.dispatch({ effects: highlightsStateEffect.of(Decoration.none) });
    }
  };

  const requestHighlights = (view: EditorView): void => {
    if (!client.serverCapabilities?.documentHighlightProvider) {
      return;
    }

    const pos = view.state.selection.main.head;

    if (highlightTimer) {
      clearTimeout(highlightTimer);
    }

    highlightTimer = setTimeout(async () => {
      const plugin = LSPPlugin.get(view);
      if (!plugin) {
        return;
      }

      // The file this response will describe. A pane is reused across tabs
      // (switching calls setState on the same EditorView), and a cross-file
      // rename opens other files into it, so by the time the response lands the
      // view can be showing something else entirely.
      const requestedUri = plugin.uri;

      try {
        // Bring the server's copy up to date first, like every other request
        // path does. Without it the server answers about the document as it was
        // up to HIGHLIGHT_DEBOUNCE_MS ago, and on a slow machine that is a
        // different document.
        plugin.client.sync();

        const result = await plugin.client.request<
          LspDocumentHighlightParams,
          LspDocumentHighlight[] | null
        >('textDocument/documentHighlight', {
          textDocument: { uri: plugin.uri },
          position: plugin.toPosition(pos),
        });

        // Discard the response if the pane moved on to another file. Comparing
        // the cursor alone is not enough — offsets collide between files, and a
        // response for a 200-line module converted against a 2-line one threw
        // `RangeError: Invalid position 108 in document of length 18` and lost
        // every highlight with it.
        const current = LSPPlugin.get(view);
        if (!current || current.uri !== requestedUri) {
          return;
        }

        // Discard the response if the cursor moved while it was in flight.
        if (view.state.selection.main.head !== pos) {
          return;
        }

        if (!result || result.length === 0) {
          if (view.state.field(highlightsStateField).size > 0) {
            view.dispatch({
              effects: highlightsStateEffect.of(Decoration.none),
            });
          }
          return;
        }

        // The server described `syncedDoc`, not the document on screen, so
        // convert against that and map the result forward through whatever has
        // been typed since — the same two steps publishDiagnostics takes. Doing
        // it against the live doc instead threw `RangeError: Invalid position N
        // in document of length M` whenever the server lagged (a rename, which
        // rewrites several occurrences at once, is the reliable way to see it)
        // and lost every highlight in the response.
        // Positions the server sent that do not fit the document it was
        // describing. Nothing sane is left to draw, and converting them throws
        // inside `doc.line()`, so drop the response rather than lose the pass.
        const syncedLines = plugin.syncedDoc.lines;
        if (
          result.some(
            (highlight) =>
              highlight.range.start.line >= syncedLines ||
              highlight.range.end.line >= syncedLines,
          )
        ) {
          return;
        }

        const decorations = result.flatMap((highlight) => {
          const from = plugin.unsyncedChanges.mapPos(
            plugin.fromPosition(highlight.range.start, plugin.syncedDoc),
          );
          const to = plugin.unsyncedChanges.mapPos(
            plugin.fromPosition(highlight.range.end, plugin.syncedDoc),
          );
          // A collapsed or inverted range is one the edits mapped away; marking
          // it would throw and take the rest of the highlights with it.
          if (to <= from) {
            return [];
          }
          return [
            Decoration.mark({
              class: getHighlightClass(highlight.kind),
            }).range(from, to),
          ];
        });

        view.dispatch({
          effects: highlightsStateEffect.of(Decoration.set(decorations, true)),
        });
      } catch (e) {
        console.error('LSP document highlight error:', e);
      }
    }, HIGHLIGHT_DEBOUNCE_MS);
  };

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      requestHighlights(update.view);
      return;
    }
    if (update.selectionSet) {
      requestHighlights(update.view);
    }
  });

  const domEventHandlers = EditorView.domEventHandlers({
    blur: (_event, view) => {
      clearHighlights(view);
      return false;
    },
  });

  return [highlightsStateField, updateListener, domEventHandlers];
};
