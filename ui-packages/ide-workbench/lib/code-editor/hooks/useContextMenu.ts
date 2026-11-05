import {
  indentLess,
  indentMore,
  redo,
  selectAll,
  toggleComment,
  undo,
} from '@codemirror/commands';
import { openSearchPanel } from '@codemirror/search';
import { EditorView } from '@codemirror/view';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEvent as useEventListener } from 'react-use';
import { ServerCapabilities } from 'vscode-languageserver-protocol';

import { LSP_LANGS, LspClientRef, LspId, LspLang } from '../../code-mirror';
import { CodeMirrorEventAnnotation } from '../../code-mirror/codeMirror.type';
import {
  lspFindAllReferences,
  lspFormat,
  lspGoToDefinition,
  lspGoToImplementation,
  lspGoToTypeDefinition,
  lspRename,
} from '../../code-mirror/extensions/lsp/lsp-client/lsp-client-commands';
import { closeRenamePanel } from '../../code-mirror/extensions/lsp/lsp-extensions/extensions/lsp-rename-panel/lsp-rename-panel';
import { LspReferencesPanelActions } from '../../code-mirror/extensions/lsp/lsp-references/lsp-references-types';
import {
  codeMirrorAnnotationMap,
  getCurrentSelectedStrings,
} from '../../code-mirror/utils';
import { isDevelopmentBuild } from '../../common/buildMode';
import { NullableRef } from '../../common/react';
import {
  ContextMenuHandlerDictionary,
  ContextMenuItemIds,
  ContextMenuSectionIds,
  ContextMenuSectionType,
} from '../../context-menu/contextMenu.type';
import { contextMenuSections } from '../../context-menu/contextMenuSpec';
import { useI18n } from '../../i18n/useI18n';
import { browserClipboard } from '../browserClipboard';
import { EditorClipboard, OnChangeHandlerSetCode } from '../codeEditor.type';

const LSP_CAPABILITY_ITEMS: Array<{
  id: ContextMenuItemIds;
  isSupported: (caps: ServerCapabilities) => boolean;
}> = [
  {
    id: ContextMenuItemIds.GoToDefinition,
    isSupported: (caps) => !!caps.definitionProvider,
  },
  {
    id: ContextMenuItemIds.GoToTypeDefinition,
    isSupported: (caps) => !!caps.typeDefinitionProvider,
  },
  {
    id: ContextMenuItemIds.GoToImplementation,
    isSupported: (caps) => !!caps.implementationProvider,
  },
  {
    id: ContextMenuItemIds.FindAllReferences,
    isSupported: (caps) => !!caps.referencesProvider,
  },
  {
    id: ContextMenuItemIds.Format,
    isSupported: (caps) =>
      !!caps.documentFormattingProvider ||
      !!caps.documentRangeFormattingProvider,
  },
  {
    id: ContextMenuItemIds.Rename,
    isSupported: (caps) => !!caps.renameProvider,
  },
];

// Items disabled on read-only files (external files + example apps): every
// content-modifying action, including the LSP rename/format.
const READONLY_DISABLED_ITEMS: ContextMenuItemIds[] = [
  ContextMenuItemIds.Cut,
  ContextMenuItemIds.Paste,
  ContextMenuItemIds.Undo,
  ContextMenuItemIds.Redo,
  ContextMenuItemIds.CommentUncomment,
  ContextMenuItemIds.IncreaseIndent,
  ContextMenuItemIds.DecreaseIndent,
  ContextMenuItemIds.Format,
  ContextMenuItemIds.Rename,
];

type UseContextMenuParams = {
  viewInstance: EditorView | null;
  setCode: OnChangeHandlerSetCode;
  code?: string | null;
  isLspEnabled?: boolean;
  lspClients?: Map<LspId, LspClientRef>;
  currentFileExt?: string;
  readOnly?: boolean;
  /**
   * The host's clipboard. Defaults to `browserClipboard`
   * (`navigator.clipboard`) when a host injects none.
   */
  clipboard?: EditorClipboard;
} & LspReferencesPanelActions;

type UseContextMenu = (params: UseContextMenuParams) => {
  onContextMenuClose: (e: KeyboardEvent) => void;
  containerRef: NullableRef<HTMLDivElement>;
  clickHandlers: ContextMenuHandlerDictionary;
  disabledKeys: ContextMenuItemIds[];
  sections: ContextMenuSectionType[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export const useContextMenu: UseContextMenu = function ({
  viewInstance,
  setCode,
  code,
  isLspEnabled,
  lspClients,
  currentFileExt,
  readOnly,
  showLspReferences,
  closeLspReferences,
  clipboard = browserClipboard,
}: UseContextMenuParams): ReturnType<UseContextMenu> {
  const { formatMessage } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [isPasteDisabled, setIsPasteDisabled] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const internalClipboard = useRef<string | null>(null);

  // The paste-availability effect below must read the host's current clipboard
  // without the object itself triggering it: a host that builds it inline
  // makes a new object every render, and each run reads the system clipboard.
  const clipboardRef = useRef(clipboard);
  useEffect(() => {
    clipboardRef.current = clipboard;
  }, [clipboard]);

  const currentSelectedStrings = getCurrentSelectedStrings(
    code,
    viewInstance?.state.selection,
  );

  const clickHandlers: ContextMenuHandlerDictionary = {
    [ContextMenuItemIds.Copy]: async (): Promise<void> => {
      const selectedText = currentSelectedStrings
        ?.map((el) => el.label)
        .join('\n');
      if (selectedText) {
        await clipboard.writeText(selectedText);
        internalClipboard.current = selectedText;
      }
    },
    [ContextMenuItemIds.Paste]: async (): Promise<void> => {
      const selection = viewInstance?.state.selection.ranges;

      // With `preferInMemoryPaste` the mirror is the paste source: a host that
      // sets it cannot be asked for the system clipboard on demand without
      // prompting the user (see EditorClipboard).
      const clipboardValue = clipboard.preferInMemoryPaste
        ? internalClipboard.current
        : await clipboard.readText();

      if (!clipboardValue) return;

      if ((code || code === '') && selection) {
        const editorValue = viewInstance.state.doc.toString();
        viewInstance.dispatch({
          changes: {
            from: 0,
            to: editorValue.length,
            insert:
              code.slice(0, selection[0].from) +
              clipboardValue +
              code.slice(selection[0].to),
          },
          annotations:
            codeMirrorAnnotationMap[
              CodeMirrorEventAnnotation.ContextMenuAction
            ],
        });
        setCode(viewInstance.state.doc);
      }
    },
    [ContextMenuItemIds.Cut]: async (): Promise<void> => {
      if (!viewInstance) return;

      const selectedText = currentSelectedStrings
        ?.map((el) => el.label)
        .join('\n');
      if (selectedText) {
        await clipboard.writeText(selectedText);
        internalClipboard.current = selectedText;
      }

      if (code && currentSelectedStrings) {
        currentSelectedStrings.map((el) => {
          const editorValue = viewInstance?.state.doc.toString();

          viewInstance.dispatch({
            changes: {
              from: 0,
              to: editorValue.length,
              insert: code.slice(0, el.from) + code.slice(el.to),
            },
            annotations:
              codeMirrorAnnotationMap[
                CodeMirrorEventAnnotation.ContextMenuAction
              ],
          });
          setCode(viewInstance.state.doc);
        });
      }
    },
    [ContextMenuItemIds.Undo]: (): void => {
      if (viewInstance) {
        undo({
          state: viewInstance.state,
          dispatch: viewInstance.dispatch,
        });
      }
    },
    [ContextMenuItemIds.Redo]: (): void => {
      if (viewInstance) {
        redo({
          state: viewInstance.state,
          dispatch: viewInstance.dispatch,
        });
      }
    },
    [ContextMenuItemIds.SelectAll]: (): void => {
      if (viewInstance) {
        selectAll({
          state: viewInstance.state,
          dispatch: viewInstance.dispatch,
        });
      }
    },
    [ContextMenuItemIds.CommentUncomment]: (): void => {
      if (viewInstance) {
        toggleComment({
          state: viewInstance.state,
          dispatch: viewInstance.dispatch,
        });
      }
    },
    [ContextMenuItemIds.IncreaseIndent]: (): void => {
      if (viewInstance) {
        indentMore({
          state: viewInstance.state,
          dispatch: viewInstance.dispatch,
        });
      }
    },
    [ContextMenuItemIds.DecreaseIndent]: (): void => {
      if (viewInstance) {
        indentLess({
          state: viewInstance.state,
          dispatch: viewInstance.dispatch,
        });
      }
    },
    [ContextMenuItemIds.Find]: (): void => {
      if (viewInstance) {
        openSearchPanel(viewInstance);
      }
    },
    // LSP
    [ContextMenuItemIds.GoToDefinition]: (): void => {
      if (viewInstance) {
        lspGoToDefinition(viewInstance, formatMessage);
      }
    },
    [ContextMenuItemIds.GoToTypeDefinition]: (): void => {
      if (viewInstance) {
        lspGoToTypeDefinition(viewInstance, formatMessage);
      }
    },
    [ContextMenuItemIds.GoToImplementation]: (): void => {
      if (viewInstance) {
        lspGoToImplementation(viewInstance, formatMessage);
      }
    },
    [ContextMenuItemIds.FindAllReferences]: (): void => {
      if (viewInstance) {
        closeRenamePanel(viewInstance);
        lspFindAllReferences(viewInstance, formatMessage, showLspReferences);
      }
    },
    [ContextMenuItemIds.Format]: (): void => {
      if (viewInstance) {
        lspFormat(viewInstance, formatMessage);
      }
    },
    [ContextMenuItemIds.Rename]: (): void => {
      if (viewInstance) {
        closeLspReferences?.();
        lspRename(viewInstance, formatMessage);
      }
    },
  };

  useEffect(() => {
    if (!clipboard.preferInMemoryPaste) return;

    const handleNativeCopyOrCut = (): void => {
      const selected = window.getSelection()?.toString();
      if (selected) internalClipboard.current = selected;
    };

    const COPY = 'copy';
    const CUT = 'cut';

    document.addEventListener(COPY, handleNativeCopyOrCut);
    document.addEventListener(CUT, handleNativeCopyOrCut);

    return () => {
      document.removeEventListener(COPY, handleNativeCopyOrCut);
      document.removeEventListener(CUT, handleNativeCopyOrCut);
    };
  }, [clipboard.preferInMemoryPaste]);

  // Paste availability requires an async clipboard read, so it is resolved when
  // the menu opens and stored separately.
  useEffect(() => {
    async function updatePasteDisabled(): Promise<void> {
      //If the document is not focused and development console is open, an error will be thrown
      //To avoid this we prevent the function from getting called if the document is not focused and the mode is development
      if (!document.hasFocus() && isDevelopmentBuild()) return;

      const clipboard = clipboardRef.current;

      if (clipboard.preferInMemoryPaste) {
        // Refresh the mirror from the system clipboard while the menu opens, so
        // something copied in another application can still be pasted here.
        try {
          const systemClipboard = await clipboard.readText();
          if (systemClipboard) {
            internalClipboard.current = systemClipboard;
          }
        } catch (error) {
          if (isDevelopmentBuild()) {
            console.error('Failed to read system clipboard:', error);
          }
        }

        setIsPasteDisabled(!internalClipboard.current);
      } else {
        try {
          const clipboardValue = await clipboard.readText();
          setIsPasteDisabled(!clipboardValue);
        } catch {
          setIsPasteDisabled(true);
        }
      }
    }

    if (isOpen) {
      updatePasteDisabled();
    }
  }, [isOpen]);

  const lspDisabledKeys = useMemo<ContextMenuItemIds[]>(() => {
    const lspId = LSP_LANGS[currentFileExt as LspLang];
    if (!lspId) {
      return [];
    }
    const serverCapabilities =
      lspClients?.get(lspId)?.client.serverCapabilities;
    if (!serverCapabilities) {
      return LSP_CAPABILITY_ITEMS.map((cap) => cap.id);
    }
    return LSP_CAPABILITY_ITEMS.filter(
      (cap) => !cap.isSupported(serverCapabilities),
    ).map((cap) => cap.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFileExt, lspClients, isOpen]);

  const disabledKeys = useMemo<ContextMenuItemIds[]>(() => {
    return [
      ...lspDisabledKeys,
      ...(isPasteDisabled ? [ContextMenuItemIds.Paste] : []),
      ...(readOnly ? READONLY_DISABLED_ITEMS : []),
    ];
  }, [lspDisabledKeys, isPasteDisabled, readOnly]);

  const onContextMenuClose = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setIsOpen(false);
  }, []);

  useEventListener('keydown', onContextMenuClose);

  const filteredSections = useMemo(() => {
    const lspId = LSP_LANGS[currentFileExt as LspLang];
    return contextMenuSections.filter((section) => {
      if (section.name === ContextMenuSectionIds.LSP) {
        return isLspEnabled && !!lspId;
      }
      return true;
    });
  }, [currentFileExt, isLspEnabled]);

  return {
    onContextMenuClose,
    containerRef,
    clickHandlers,
    disabledKeys,
    sections: filteredSections,
    isOpen,
    setIsOpen,
  };
};
