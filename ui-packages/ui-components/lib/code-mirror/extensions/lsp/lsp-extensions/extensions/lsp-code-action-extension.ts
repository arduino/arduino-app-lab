import { LSPPlugin, WorkspaceMapping } from '@codemirror/lsp-client';
import { Extension, StateEffect, StateField } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  keymap,
  WidgetType,
} from '@codemirror/view';

import { getShortcutCommand } from '../../../../../common/utils';
import { FormatMessage } from '../../../../../i18n/useI18n';
import { CustomLspClient } from '../../lsp-client/lsp-client-types';
import { applyWorkspaceEditChanges } from '../../lsp-client/lsp-client-workspace';
import {
  LspCodeAction,
  LspCodeActionParams,
  LspCommand,
  LspDiagnostic,
  LspExecuteCommandParams,
  LspPosition,
  LspRange,
} from '../../lsp-types';
import { messages } from '../../messages';
import { showLspFeedbackTooltip } from './lsp-feedback-tooltip-extension';

export const getLspCodeActionExtension = ({
  client,
  formatMessage,
}: {
  client: CustomLspClient;
  formatMessage: FormatMessage;
}): Extension => {
  // trigger code actions on bulb click or keybinding
  const triggerCodeActions = (
    view: EditorView,
    anchor: DOMRect | null,
  ): boolean => {
    const plugin = LSPPlugin.get(view);
    if (!pluginSupportsCodeActions(plugin)) {
      showLspFeedbackTooltip({
        view,
        message: formatMessage(messages.codeActionsNotSupported),
      });
      return false;
    }

    const pos = view.state.selection.main.head;
    const position = plugin.toPosition(pos);

    const diagnostics = getDiagnosticsAtPosition({
      client,
      uri: plugin.uri,
      position,
    });

    client.sync();

    client
      .withMapping(async (mapping) => {
        const codeActions = await requestCodeActions({
          client,
          uri: plugin.uri,
          range: getSelectionRange(view, plugin),
          diagnostics,
          triggerKind: 1, // Invoked
        });

        if (!codeActions.length) {
          if (view.state.field(hasLspCodeActionsStateField)) {
            view.dispatch({ effects: hasLspCodeActionsStateEffect.of(false) });
          }
          showLspFeedbackTooltip({
            view,
            message: formatMessage(messages.noCodeActionsFound),
          });
          return;
        }

        const selected = await showActionMenu(view, codeActions, anchor);
        if (!selected) {
          return;
        }

        await applyWorkspaceEdit(client, selected, mapping);
      })
      .catch((err) => {
        console.error('LSP code action error:', err);
      });

    return true;
  };

  let lightbulbTimer: NodeJS.Timeout | null = null;
  let lastCheckedPos = -1;

  // check if code actions are available at cursor to show the bulb
  const checkCodeActions = (view: EditorView): void => {
    const plugin = LSPPlugin.get(view);
    if (!pluginSupportsCodeActions(plugin)) {
      return;
    }

    const pos = view.state.selection.main.head;

    if (pos === lastCheckedPos) {
      return;
    }
    lastCheckedPos = pos;

    // Clear immediately so the stale bulb doesn't appear on the new line while
    // the next request is in flight.
    if (view.state.field(hasLspCodeActionsStateField)) {
      view.dispatch({ effects: hasLspCodeActionsStateEffect.of(false) });
    }

    if (lightbulbTimer) {
      clearTimeout(lightbulbTimer);
    }

    lightbulbTimer = setTimeout(async () => {
      try {
        const position = plugin.toPosition(pos);

        const diagnostics = getDiagnosticsAtPosition({
          client,
          uri: plugin.uri,
          position,
        });

        const codeActions = await requestCodeActions({
          client,
          uri: plugin.uri,
          range: getSelectionRange(view, plugin),
          diagnostics,
          triggerKind: 2, // Automatic
        });

        // Discard the result if the cursor moved while the request was in flight.
        if (view.state.selection.main.head !== pos) {
          return;
        }

        const hasActions = codeActions.length > 0;
        if (hasActions !== view.state.field(hasLspCodeActionsStateField)) {
          view.dispatch({
            effects: hasLspCodeActionsStateEffect.of(hasActions),
          });
        }
      } catch (err) {
        console.error('LSP code action error:', err);
      }
    }, 250);
  };

  // Extension: runs checkCodeActionsAtCursor on text cursor change
  const updateListener = EditorView.updateListener.of((update) => {
    if (update.selectionSet) {
      checkCodeActions(update.view);
    }
  });

  // Extension: lightbulb
  const lightbulbStateField = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(_decorations, transaction) {
      if (!transaction.state.field(hasLspCodeActionsStateField)) {
        return Decoration.none;
      }

      const pos = transaction.state.selection.main.head;
      const line = transaction.state.doc.lineAt(pos);

      return Decoration.set([
        Decoration.widget({
          widget: new LightbulbWidget(triggerCodeActions, formatMessage),
          side: -1,
        }).range(line.from),
      ]);
    },
    provide: (field) => EditorView.decorations.from(field),
  });

  // Extension: keymap to trigger code actions
  const codeActionKeymap = keymap.of([
    {
      key: 'Mod-.',
      run: (view): boolean => triggerCodeActions(view, null),
      preventDefault: true,
    },
  ]);

  return [
    hasLspCodeActionsStateField,
    updateListener,
    lightbulbStateField,
    codeActionKeymap,
  ];
};

/**
 * - `_typescript.applyCodeActionCommand`: a command that must be handled client-side by the editor
 * and no `workspace/applyEdit` follows after `workspace/executeCommand` call.
 * - `clangd.applyTweak`: not supported by ALS
 */
const UNSUPPORTED_COMMANDS = new Set([
  '_typescript.applyCodeActionCommand',
  'clangd.applyTweak',
]);

/**
 * These action kinds produce partial edits that only make sense when editor
 * also performs the client-side steps (e.g. creating a new file).
 * Applying only the server-side edit would corrupt the code.
 */
const UNSUPPORTED_ACTION_KINDS = new Set(['refactor.move.newFile']);

// check if an action has a valid WorkspaceEdit obj
const hasValidEdit = (action: LspCodeAction): boolean =>
  !!action.edit &&
  ((action.edit.documentChanges?.length ?? 0) > 0 ||
    Object.keys(action.edit.changes ?? {}).length > 0);

// check if an action has only an unsupported command (and no valid edit)
const hasOnlyUnsupportedCommand = (action: LspCodeAction): boolean =>
  UNSUPPORTED_COMMANDS.has(action.command?.command ?? '') &&
  !hasValidEdit(action);

const isUnsupportedActionKind = (action: LspCodeAction): boolean =>
  UNSUPPORTED_ACTION_KINDS.has(action.kind ?? '');

// An action with no valid edit and no command is a no-op.
// Exception: actions with `data` are pending resolve — the server will fill in the edit on `codeAction/resolve`.
const isNoOp = (action: LspCodeAction): boolean =>
  !action.command && !hasValidEdit(action) && action.data === undefined;

// wrap legacy LspCommand (top-level command string) as a LspCodeAction with nested command
const normalizeToCodeAction = (
  item: LspCodeAction | LspCommand,
): LspCodeAction =>
  typeof (item as LspCommand).command === 'string'
    ? { title: (item as LspCommand).title, command: item as LspCommand }
    : (item as LspCodeAction);

const filterSupportedActions = (
  items: (LspCodeAction | LspCommand)[],
): LspCodeAction[] =>
  items
    .map((item) => normalizeToCodeAction(item))
    .filter((item) => !isNoOp(item))
    .filter((item) => !hasOnlyUnsupportedCommand(item))
    .filter((item) => !isUnsupportedActionKind(item));

const getSelectionRange = (view: EditorView, plugin: LSPPlugin): LspRange => {
  const { from, to } = view.state.selection.main;
  return { start: plugin.toPosition(from), end: plugin.toPosition(to) };
};

// ask LS for code actions on a specific range
const requestCodeActions = async ({
  client,
  uri,
  range,
  diagnostics,
  triggerKind,
}: {
  client: CustomLspClient;
  uri: string;
  range: LspRange;
  diagnostics: LspDiagnostic[];
  triggerKind: LspCodeActionParams['context']['triggerKind'];
}): Promise<LspCodeAction[]> => {
  const result = await client.request<
    LspCodeActionParams,
    (LspCodeAction | LspCommand)[] | null
  >('textDocument/codeAction', {
    textDocument: { uri },
    range,
    context: {
      diagnostics,
      triggerKind,
      ...(diagnostics.length === 0 && {
        only: ['quickfix', 'refactor', 'source'],
      }),
    },
  });
  return filterSupportedActions(result ?? []);
};

const hasLspCodeActionsStateEffect = StateEffect.define<boolean>();

// Extension: whether the current cursor line has code actions available.
const hasLspCodeActionsStateField = StateField.define<boolean>({
  create: () => false,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(hasLspCodeActionsStateEffect)) {
        return effect.value;
      }
    }
    if (transaction.docChanged) {
      return false;
    }
    return value;
  },
});

// Lightbulb
class LightbulbWidget extends WidgetType {
  private triggerCodeActions: (view: EditorView, anchor: DOMRect) => boolean;
  private formatMessage: FormatMessage;

  constructor(
    triggerCodeActions: (view: EditorView, anchor: DOMRect) => boolean,
    formatMessage: FormatMessage,
  ) {
    super();
    this.triggerCodeActions = triggerCodeActions;
    this.formatMessage = formatMessage;
  }

  override eq(other: WidgetType): boolean {
    return other instanceof LightbulbWidget;
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement('span');
    el.className = 'cm-lsp-lightbulb';
    el.textContent = '💡';
    const modKey = getShortcutCommand();
    el.title = this.formatMessage(messages.codeActionsAvailable, { modKey });
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const domRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      this.triggerCodeActions(view, domRect);
    });
    return el;
  }
}

// action menu
const MOUSEDOWN = 'mousedown';
const KEYDOWN = 'keydown';

const showActionMenu = (
  view: EditorView,
  actions: LspCodeAction[],
  anchor?: DOMRect | null,
): Promise<LspCodeAction | null> => {
  return new Promise((resolve) => {
    const menu = document.createElement('div');
    menu.className = 'cm-lsp-code-action-menu';

    if (anchor) {
      menu.style.top = `${anchor.bottom + 4}px`;
      menu.style.left = `${anchor.left}px`;
    } else {
      const pos = view.state.selection.main.head;
      const coords = view.coordsAtPos(pos);
      if (coords) {
        menu.style.top = `${coords.bottom + 4}px`;
        menu.style.left = `${coords.left}px`;
      }
    }

    const cleanup = (): void => {
      menu.remove();
      document.removeEventListener(MOUSEDOWN, outsideClick);
      document.removeEventListener(KEYDOWN, onKeydown);
    };

    const select = (action: LspCodeAction | null): void => {
      cleanup();
      resolve(action);
    };

    actions.forEach((action) => {
      const item = document.createElement('div');
      item.className = 'cm-lsp-code-action-item';
      item.textContent = action.title;
      item.addEventListener(MOUSEDOWN, (e) => {
        e.preventDefault();
        select(action);
      });
      menu.appendChild(item);
    });

    const outsideClick = (e: MouseEvent): void => {
      if (!menu.contains(e.target as Node)) {
        select(null);
      }
    };

    const onKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        select(null);
      }
    };

    view.dom.appendChild(menu);
    document.addEventListener(MOUSEDOWN, outsideClick);
    document.addEventListener(KEYDOWN, onKeydown);
  });
};

/**
 * apply workspace edit:
 * - using `action.edit`
 * - getting `action.edit` calling `codeAction/resolve`
 * - asking for `action.edit` calling `workspace/executeCommand`
 * */
const applyWorkspaceEdit = async (
  client: CustomLspClient,
  action: LspCodeAction,
  mapping: WorkspaceMapping,
): Promise<void> => {
  const resolveProvider =
    typeof client.serverCapabilities?.codeActionProvider === 'object' &&
    client.serverCapabilities.codeActionProvider.resolveProvider === true;

  // edit needs to be resolved
  if (resolveProvider && !action.edit && !action.command) {
    action = await client.request<LspCodeAction, LspCodeAction>(
      'codeAction/resolve',
      action,
    );
  }

  // edit available to apply them directly
  if (action.edit) {
    await applyWorkspaceEditChanges({
      client,
      edit: action.edit,
      mapping,
      userEvent: 'lsp.codeAction',
    });
  }

  // Command available to ask for edit.
  // LS will respond with `workspace/applyEdit` (this is a server initiated request handled in `lsp-client-transport`)
  if (action.command) {
    const cmd = action.command as LspCommand;
    if (!UNSUPPORTED_COMMANDS.has(cmd.command)) {
      await client.request<LspExecuteCommandParams, unknown>(
        'workspace/executeCommand',
        { command: cmd.command, arguments: cmd.arguments },
      );
    }
  }
};

// check if the current text cursor is within a diagnostic range
const isPositionInDiagnosticRange = (
  pos: LspPosition,
  range: LspRange,
): boolean => {
  if (pos.line < range.start.line || pos.line > range.end.line) {
    return false;
  }
  if (pos.line === range.start.line && pos.character < range.start.character) {
    return false;
  }
  if (pos.line === range.end.line && pos.character > range.end.character) {
    return false;
  }
  return true;
};

// get diagnostics at a specific position searching in cached diagnosticsMap
const getDiagnosticsAtPosition = ({
  client,
  uri,
  position,
}: {
  client: CustomLspClient;
  uri: string;
  position: LspPosition;
}): LspDiagnostic[] => {
  return (
    client
      .getDiagnostics(uri)
      ?.filter((diagnostic) =>
        isPositionInDiagnosticRange(position, diagnostic.range),
      ) ?? []
  );
};

// check if codeActionProvider is supported
const pluginSupportsCodeActions = (
  plugin: LSPPlugin | null,
): plugin is LSPPlugin =>
  !!plugin && !!plugin.client.serverCapabilities?.codeActionProvider;
