import { jumpToDefinition, LSPPlugin } from '@codemirror/lsp-client';
import { Extension, StateEffect, StateField } from '@codemirror/state';
import {
  Command,
  Decoration,
  DecorationSet,
  EditorView,
} from '@codemirror/view';

import { CustomLspClient } from '../../lsp-client/lsp-client-types';
import { normalizeFileUri } from '../../lsp-file-uri';
import {
  LspDefinitionParams,
  LspLocation,
  LspPosition,
  LspReferenceParams,
} from '../../lsp-types';
import { openReferencesPanel } from './lsp-panel-helpers';

interface GetLspNavigationFeatureExtensionParams {
  client: CustomLspClient;
}

/**
 * Extension for highlighting a word when a navigation feature is available(go-to-def, find-all-refs)
 */
export const getLspNavigationFeatureExtension = ({
  client,
}: GetLspNavigationFeatureExtensionParams): Extension => {
  const hoverStateEffect = StateEffect.define<{
    from: number;
    to: number;
  } | null>();

  // add style to hovered word
  const hoverStateField = StateField.define<DecorationSet>({
    create() {
      return Decoration.none;
    },
    update(value, transaction) {
      value = value.map(transaction.changes);
      for (const effect of transaction.effects) {
        if (effect.is(hoverStateEffect)) {
          if (effect.value) {
            value = Decoration.set([
              Decoration.mark({ class: 'cm-lsp-clickable-text' }).range(
                effect.value.from,
                effect.value.to,
              ),
            ]);
          } else {
            value = Decoration.none;
          }
        }
      }
      return value;
    },
    provide: (field) => EditorView.decorations.from(field),
  });

  let hoverTimer: NodeJS.Timeout | null = null;
  let lastHoverWord: string | null = null;
  let mousePos = { x: 0, y: 0 };
  let lspRequest: Command | null = null;

  const clearHoverEffect = (view: EditorView): void => {
    if (view.state.field(hoverStateField).size > 0) {
      view.dispatch({ effects: hoverStateEffect.of(null) });
    }
  };

  // clear hover state
  const clearHover = (view: EditorView): void => {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    lastHoverWord = null;

    lspRequest = null;
    clearHoverEffect(view);
  };

  // check for definition
  const checkDefinition = async (view: EditorView): Promise<void> => {
    const pos = view.posAtCoords(mousePos);
    if (!pos) {
      return;
    }

    const word = view.state.wordAt(pos);
    if (!word) {
      clearHoverEffect(view);
      return;
    }

    const wordText = view.state.sliceDoc(word.from, word.to);
    const wordKey = `${word.from}-${word.to}-${wordText}`;

    if (wordKey === lastHoverWord) {
      return;
    }
    lastHoverWord = wordKey;

    if (hoverTimer) {
      clearTimeout(hoverTimer);
    }
    clearHoverEffect(view);
    lspRequest = null;

    const isWordStale = (): boolean => {
      return lastHoverWord !== wordKey;
    };

    const dispatchHoverEffect = (): void => {
      view.dispatch({
        effects: hoverStateEffect.of({ from: word.from, to: word.to }),
      });
    };

    hoverTimer = setTimeout(async () => {
      const plugin = LSPPlugin.get(view);
      if (!plugin) {
        return;
      }

      const position = plugin.toPosition(word.from);
      try {
        // 1. try `Go to Definition`
        if (!client.serverCapabilities?.definitionProvider) {
          return;
        }
        const definitionResult = await plugin.client.request<
          LspDefinitionParams,
          LspLocation | LspLocation[] | null
        >('textDocument/definition', {
          textDocument: { uri: plugin.uri },
          position,
        });

        // check if we are still on the same word
        if (isWordStale()) {
          return;
        }

        if (
          isDefinitionLocationValid(
            plugin.uri,
            getLocation(definitionResult),
            position,
          )
        ) {
          dispatchHoverEffect();
          lspRequest = jumpToDefinition;
          return;
        }

        // 2. fallback: try `Find References`
        if (!client.serverCapabilities?.referencesProvider) {
          return;
        }
        const referencesResult = await plugin.client.request<
          LspReferenceParams,
          LspLocation | LspLocation[] | null
        >('textDocument/references', {
          textDocument: { uri: plugin.uri },
          position,
          context: { includeDeclaration: true },
        });

        if (isWordStale()) {
          return;
        }

        const location = getLocation(referencesResult);

        if (location) {
          dispatchHoverEffect();
          lspRequest = openReferencesPanel;
        }
      } catch (e) {
        console.error('LSP feature extension error:', e);
      }
    }, 150);
  };

  const domEventHandlers = EditorView.domEventHandlers({
    // prevent selection
    mousedown: (event, _) => {
      if (event.ctrlKey || event.metaKey) {
        return true;
      }
      return false;
    },
    // make lsp request
    mouseup: (event, view) => {
      if (lspRequest && (event.ctrlKey || event.metaKey)) {
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos !== null) {
          view.dispatch({ selection: { anchor: pos } });
          setTimeout(() => {
            lspRequest?.(view);
          });
          return true;
        }
      }
      return false;
    },
    // check for definition
    mousemove: (event, view) => {
      mousePos = { x: event.clientX, y: event.clientY };
      if (event.ctrlKey || event.metaKey) {
        checkDefinition(view);
      } else {
        clearHover(view);
      }
    },
    // check for definition
    keydown: (event, view) => {
      if (event.ctrlKey || event.metaKey) {
        checkDefinition(view);
      }
    },
    // clear hover state
    keyup: (event, view) => {
      if (!event.ctrlKey && !event.metaKey) {
        clearHover(view);
      }
    },
    // clear hover state
    mouseleave: (_, view) => {
      clearHover(view);
    },
  });

  return [domEventHandlers, hoverStateField];
};

const isDefinitionLocationValid = (
  currentFileUri: string,
  location: LspLocation | null,
  position: LspPosition,
): boolean => {
  if (!location) {
    return false;
  }

  // check if the location is the current selected word
  const isSelfReference =
    normalizeFileUri(currentFileUri) === normalizeFileUri(location.uri) &&
    location.range.start.line === position.line &&
    position.character >= location.range.start.character &&
    position.character <= location.range.end.character;

  return !isSelfReference;
};

const getLocation = (
  result: LspLocation | LspLocation[] | null,
): LspLocation | null => {
  return Array.isArray(result) ? result[0] : result;
};
