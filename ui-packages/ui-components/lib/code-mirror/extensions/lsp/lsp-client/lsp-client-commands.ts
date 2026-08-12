import { getIndentUnit, indentUnit } from '@codemirror/language';
import { forEachDiagnostic } from '@codemirror/lint';
import {
  jumpToDefinition,
  jumpToImplementation,
  jumpToTypeDefinition,
  LSPPlugin,
} from '@codemirror/lsp-client';
import { Text } from '@codemirror/state';
import { Command, EditorView } from '@codemirror/view';
import { MessageDescriptor } from 'react-intl';

import { FormatMessage } from '../../../../i18n/useI18n';
import { showLspFeedbackTooltip } from '../lsp-extensions/extensions/lsp-feedback-tooltip-extension';
import { openReferencesPanel } from '../lsp-extensions/extensions/lsp-panel-helpers';
import { openLspRenamePanel } from '../lsp-extensions/extensions/lsp-rename-panel/lsp-rename-panel';
import { validateRenameName } from '../lsp-extensions/extensions/lsp-rename-panel/lsp-rename-validation';
import {
  LspDefinitionParams,
  LspDocumentFormattingParams,
  LspDocumentRangeFormattingParams,
  LspLocation,
  LspPosition,
  LspRange,
  LspReferenceParams,
  LspRenameParams,
  LspServerCapabilities,
  LspTextEdit,
  LspWorkspaceEdit,
} from '../lsp-types';
import { messages } from '../messages';
import { CustomLspClient } from './lsp-client-types';
import {
  applyWorkspaceEditChanges,
  describeSkippedEdits,
  normalizeWorkspaceEdit,
} from './lsp-client-workspace';

const isClientReady = (
  view: EditorView,
  plugin: LSPPlugin,
  formatMessage: FormatMessage,
): boolean => {
  if (plugin.client.serverCapabilities) {
    return true;
  }
  showLspFeedbackTooltip({
    view,
    message: formatMessage(messages.languageServerStarting),
  });
  return false;
};

const hasServerCapability = (
  plugin: LSPPlugin,
  capability: keyof LspServerCapabilities,
): boolean => !!plugin.client.serverCapabilities?.[capability];

/**
 * Find all references
 */

export const lspFindAllReferences = (
  view: EditorView,
  formatMessage: FormatMessage,
): boolean => {
  const plugin = LSPPlugin.get(view);
  if (!plugin) {
    return false;
  }
  if (!isClientReady(view, plugin, formatMessage)) {
    return true;
  }
  if (!hasServerCapability(plugin, 'referencesProvider')) {
    showLspFeedbackTooltip({
      view,
      message: formatMessage(messages.findReferencesNotSupported),
    });
    return true;
  }
  plugin.client.sync();
  const posAtRequest = view.state.selection.main.head;
  plugin.client
    .request<LspReferenceParams, LspLocation[] | null>(
      'textDocument/references',
      {
        textDocument: { uri: plugin.uri },
        position: plugin.toPosition(posAtRequest),
        context: { includeDeclaration: true },
      },
    )
    .then((response) => {
      if (!response || response.length === 0) {
        showLspFeedbackTooltip({
          view,
          message: formatMessage(messages.noReferencesFound),
          pos: posAtRequest,
        });
      } else {
        openReferencesPanel(view);
      }
    })
    .catch(() => {
      // errors handled in `lsp-client-transport.ts`
    });
  return true;
};

/**
 * Rename
 */

export const lspRename = (
  view: EditorView,
  formatMessage: FormatMessage,
): boolean => {
  const plugin = LSPPlugin.get(view);
  if (!plugin) {
    return false;
  }
  if (!isClientReady(view, plugin, formatMessage)) {
    return true;
  }
  if (!hasServerCapability(plugin, 'renameProvider')) {
    showLspFeedbackTooltip({
      view,
      message: formatMessage(messages.renameNotSupported),
    });
    return true;
  }
  const word = view.state.wordAt(view.state.selection.main.head);
  if (!word) {
    showLspFeedbackTooltip({
      view,
      message: formatMessage(messages.placeCursorOnSymbolToRename),
    });
    return true;
  }

  openLspRenamePanel({
    view,
    currentName: view.state.sliceDoc(word.from, word.to),
    inputLabel: formatMessage(messages.renameNewNameLabel),
    hint: formatMessage(messages.renameHint),
    validate: (newName) => {
      const error = validateRenameName({ newName, uri: plugin.uri });
      return error ? formatMessage(error.message, error.values) : null;
    },
    onSubmit: (newName) => renameSymbol(view, plugin, newName, formatMessage),
  });
  return true;
};

/**
 * Ask the server to rename the symbol under the cursor and apply the edit it
 * returns. The word is re-read here rather than reused from when the panel
 * opened, since the document may have moved on meanwhile.
 */
const renameSymbol = (
  view: EditorView,
  plugin: LSPPlugin,
  newName: string,
  formatMessage: FormatMessage,
): void => {
  const word = view.state.wordAt(view.state.selection.main.head);
  if (!word || view.state.sliceDoc(word.from, word.to) === newName) {
    return;
  }
  const client = plugin.client as CustomLspClient;
  const posAtRequest = word.from;

  client.sync();
  void client.withMapping(async (mapping) => {
    // A rename the server refuses answers with an empty edit (or an error
    // response), with the reason sent separately as a window message — so
    // report that reason instead of leaving the rename looking like a no-op.
    const requestedAt = Date.now();
    const reportFailure = (): void => {
      showLspFeedbackTooltip({
        view,
        message:
          client.takeServerMessage(requestedAt) ??
          formatMessage(messages.renameFailed),
        // Clamped: the response arrives with the editor live again, so the
        // symbol's position may no longer be inside the document.
        pos: Math.min(posAtRequest, view.state.doc.length),
      });
    };

    try {
      const edit = await client.request<
        LspRenameParams,
        LspWorkspaceEdit | null
      >('textDocument/rename', {
        textDocument: { uri: plugin.uri },
        position: plugin.toPosition(posAtRequest),
        newName,
      });

      const changes = edit ? normalizeWorkspaceEdit(edit).changes : undefined;
      const hasChanges = Object.values(changes ?? {}).some(
        (edits) => !!edits?.length,
      );
      if (!edit || !hasChanges) {
        reportFailure();
        return;
      }

      const { applied, skipped } = await applyWorkspaceEditChanges({
        client,
        edit,
        mapping,
        userEvent: 'rename',
      });

      // The server agreed to the rename, so anything that doesn't reach a
      // document has to be said out loud: a rename that quietly changes
      // nothing (or all but one file) reads as a broken editor.
      if (applied.length === 0) {
        console.error(
          `[lsp] rename applied nothing — skipped ${describeSkippedEdits(
            skipped,
          )}`,
        );
        reportFailure();
      } else if (skipped.length > 0) {
        console.warn(`[lsp] rename skipped ${describeSkippedEdits(skipped)}`);
        showLspFeedbackTooltip({
          view,
          message: formatMessage(messages.renamePartiallyApplied),
          pos: Math.min(posAtRequest, view.state.doc.length),
        });
      } else if (applied.length > 1) {
        // Files other than this one are edited in place and never opened, so
        // without this the only sign they changed is their unsaved marker. The
        // count excludes the file being looked at, which the user can see.
        showLspFeedbackTooltip({
          view,
          message: formatMessage(messages.renamedOtherFiles, {
            count: applied.length - 1,
          }),
          pos: Math.min(posAtRequest, view.state.doc.length),
        });
      }
    } catch (error) {
      // Includes anything thrown while applying the edit, which would
      // otherwise surface as an unhandled rejection and no visible effect.
      console.error('[lsp] rename failed', error);
      reportFailure();
    }
  });
};

/**
 * Format
 */

export const lspFormat = (
  view: EditorView,
  formatMessage: FormatMessage,
): boolean => {
  const plugin = LSPPlugin.get(view);
  if (!plugin) {
    return false;
  }
  if (!isClientReady(view, plugin, formatMessage)) {
    return true;
  }
  const selection = view.state.selection.main;

  // With a non-empty selection, format only the selected range
  if (!selection.empty) {
    if (!hasServerCapability(plugin, 'documentRangeFormattingProvider')) {
      showLspFeedbackTooltip({
        view,
        message: formatMessage(messages.formatRangeNotSupported),
      });
      return true;
    }
    return requestFormatting({
      view,
      plugin,
      formatMessage,
      method: 'textDocument/rangeFormatting',
      range: {
        start: plugin.toPosition(selection.from),
        end: plugin.toPosition(selection.to),
      },
    });
  }

  if (!hasServerCapability(plugin, 'documentFormattingProvider')) {
    showLspFeedbackTooltip({
      view,
      message: formatMessage(messages.formatNotSupported),
    });
    return true;
  }
  return requestFormatting({
    view,
    plugin,
    formatMessage,
    method: 'textDocument/formatting',
  });
};

/**
 * Ask the server to format the document — or only `range` of it — and apply the
 * edits it sends back.
 *
 * Used for the whole document too, in place of @codemirror/lsp-client's
 * `formatDocument`, which drops a response carrying no edits on the floor: ruff
 * answers a document it cannot parse that way and reports the syntax error only
 * in its own stderr log, so the command looked like a no-op on exactly the files
 * that need it most.
 */
const requestFormatting = ({
  view,
  plugin,
  formatMessage,
  method,
  range,
}: {
  view: EditorView;
  plugin: LSPPlugin;
  formatMessage: FormatMessage;
  method: 'textDocument/formatting' | 'textDocument/rangeFormatting';
  range?: LspRange;
}): boolean => {
  const client = plugin.client as CustomLspClient;
  const textDocument = { uri: plugin.uri };
  const options = {
    tabSize: getIndentUnit(view.state),
    insertSpaces: view.state.facet(indentUnit).indexOf('\t') < 0,
  };
  const requestedAt = Date.now();

  client.sync();
  client.withMapping((mapping) => {
    // The doc the edits will be expressed against: `sync()` has just brought
    // the server's copy up to date, and this is the doc the mapping measures
    // its changes from.
    const syncedDoc = client.workspace.getFile(plugin.uri)?.doc;

    return client
      .request<
        LspDocumentFormattingParams | LspDocumentRangeFormattingParams,
        LspTextEdit[] | null
      >(
        method,
        range ? { textDocument, range, options } : { textDocument, options },
      )
      .then((response) => {
        // A null result is the server declining to format, which is worth
        // reporting. An empty list of edits — what clangd sends — is it saying
        // the document is already formatted, which is not.
        if (!response) {
          reportRefusedFormatting({ view, client, requestedAt, formatMessage });
          return;
        }
        if (!syncedDoc) {
          return;
        }
        const changed = mapping.getMapping(plugin.uri);
        const changes: { from: number; to: number; insert: string }[] = [];
        for (const change of response) {
          let editFrom = toDocOffset(syncedDoc, change.range.start);
          let editTo = toDocOffset(syncedDoc, change.range.end);
          if (changed) {
            // Don't apply the changes if the affected code was touched meanwhile
            if (changed.touchesRange(editFrom, editTo)) {
              return;
            }
            editFrom = changed.mapPos(editFrom, 1);
            editTo = changed.mapPos(editTo, -1);
          }
          changes.push({ from: editFrom, to: editTo, insert: change.newText });
        }
        view.dispatch({ changes, userEvent: 'format' });
      })
      .catch((err) => {
        plugin.reportError('Formatting request failed', err);
      });
  });
  return true;
};

/**
 * The offset in `doc` that an LSP position points at, clamped to the document
 * instead of trusting the server to stay inside it.
 *
 * The Arduino LS maps clang-format's edits back from the preprocessed .cpp,
 * which carries the sketch plus the lines the preprocessor added. An edit whose
 * end falls on the first of those added lines — which is what clang-format
 * sends for the sketch's final newline — is reported as the start of the line
 * *after* the sketch's last one (the sketch mapper's "END LINE ADJUSTED" case,
 * `CppToInoRangeOk`), one line past the end of the .ino. @codemirror/lsp-client
 * converts positions with `doc.line()`, which throws a RangeError on that, and
 * the throw took the whole response with it: formatting a sketch raised an
 * unhandled rejection and applied nothing at all, not even the edits that were
 * in range.
 *
 * A position past the last line therefore means the end of the document, which
 * is exactly what the server was describing.
 */
const toDocOffset = (doc: Text, pos: LspPosition): number => {
  if (pos.line < 0) {
    return 0;
  }
  if (pos.line >= doc.lines) {
    return doc.length;
  }
  const line = doc.line(pos.line + 1);
  return line.from + Math.min(Math.max(pos.character, 0), line.length);
};

/**
 * Explain a formatting request the server answered with nothing at all. Prefer
 * the server's own reason where it sent one (an error response counts: the
 * transport strips it to suppress the library's dialog, so the request resolves
 * empty rather than rejecting — see `handleResponseError`).
 *
 * Ruff sends neither: a document it cannot parse is answered with a bare null
 * and the syntax error goes to its stderr log, so the error diagnostics already
 * on screen are all the client has to go on. That leaves one wrong-footed case —
 * a file that is both already formatted and has errors of its own — which costs
 * a tooltip the user can ignore, against a silent no-op on every unparseable
 * file otherwise.
 *
 * Where the server's reason is not fit to show (a bare URI, a raw JSON-RPC code —
 * see `isProseServerMessage`) this falls through to silence just as it does for a
 * plain null, which is the right end state: nothing truthful is left to say, and
 * an invented message would be a false alarm on every no-op format.
 */
const reportRefusedFormatting = ({
  view,
  client,
  requestedAt,
  formatMessage,
}: {
  view: EditorView;
  client: CustomLspClient;
  requestedAt: number;
  formatMessage: FormatMessage;
}): void => {
  const message =
    client.takeServerMessage(requestedAt) ??
    (hasErrorDiagnostic(view)
      ? formatMessage(messages.formatFailedFixErrors)
      : undefined);
  if (message) {
    showLspFeedbackTooltip({ view, message });
  }
};

const hasErrorDiagnostic = (view: EditorView): boolean => {
  let hasError = false;
  forEachDiagnostic(view.state, (diagnostic) => {
    hasError = hasError || diagnostic.severity === 'error';
  });
  return hasError;
};

/**
 * Go to commands: goToDefinition, goToTypeDefinition, goToImplementation
 */

interface GoToParams {
  method: string;
  capability: keyof LspServerCapabilities;
  command: Command;
  notSupportedMessage: MessageDescriptor;
  notFoundMessage: MessageDescriptor;
}

const lspGoTo =
  ({
    method,
    capability,
    command,
    notSupportedMessage,
    notFoundMessage,
  }: GoToParams) =>
  (view: EditorView, formatMessage: FormatMessage): boolean => {
    const plugin = LSPPlugin.get(view);
    if (!plugin) {
      return false;
    }
    if (!isClientReady(view, plugin, formatMessage)) {
      return true;
    }
    if (!hasServerCapability(plugin, capability)) {
      showLspFeedbackTooltip({
        view,
        message: formatMessage(notSupportedMessage),
      });
      return true;
    }
    plugin.client.sync();
    const posAtRequest = view.state.selection.main.head;
    plugin.client
      .request<LspDefinitionParams, LspLocation | LspLocation[] | null>(
        method,
        {
          textDocument: { uri: plugin.uri },
          position: plugin.toPosition(posAtRequest),
        },
      )
      .then((response) => {
        const loc = Array.isArray(response) ? response[0] : response;
        if (!loc) {
          showLspFeedbackTooltip({
            view,
            message: formatMessage(notFoundMessage),
            pos: posAtRequest,
          });
        } else {
          command(view);
        }
      })
      .catch(() => {
        // errors handled in `lsp-client-transport.ts`
      });
    return true;
  };

export const lspGoToDefinition = lspGoTo({
  method: 'textDocument/definition',
  capability: 'definitionProvider',
  command: jumpToDefinition,
  notSupportedMessage: messages.goToDefinitionNotSupported,
  notFoundMessage: messages.noDefinitionFound,
});

export const lspGoToTypeDefinition = lspGoTo({
  method: 'textDocument/typeDefinition',
  capability: 'typeDefinitionProvider',
  command: jumpToTypeDefinition,
  notSupportedMessage: messages.goToTypeDefinitionNotSupported,
  notFoundMessage: messages.noTypeDefinitionFound,
});

export const lspGoToImplementation = lspGoTo({
  method: 'textDocument/implementation',
  capability: 'implementationProvider',
  command: jumpToImplementation,
  notSupportedMessage: messages.goToImplementationNotSupported,
  notFoundMessage: messages.noImplementationFound,
});
