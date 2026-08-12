import {
  readText,
  writeText,
} from '@bcmi-labs/cloud-editor-domain/src/services/services-by-app/app-lab';
import { Config } from '@cloud-editor-mono/common';
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
import {
  closeReferencePanel,
  closeRenamePanel,
} from '../../code-mirror/extensions/lsp/lsp-extensions/extensions/lsp-panel-helpers';
import {
  codeMirrorAnnotationMap,
  getCurrentSelectedStrings,
} from '../../code-mirror/utils';
import {
  ContextMenuHandlerDictionary,
  ContextMenuItemIds,
  ContextMenuSectionIds,
  ContextMenuSectionType,
} from '../../context-menu/contextMenu.type';
import { contextMenuSections } from '../../context-menu/contextMenuSpec';
import { useI18n } from '../../i18n/useI18n';
import { OnChangeHandlerSetCode } from '../codeEditor.type';

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

type UseContextMenu = (
  viewInstance: EditorView | null,
  setCode: OnChangeHandlerSetCode,
  code?: string | null,
  isLspEnabled?: boolean,
  lspClients?: Map<LspId, LspClientRef>,
  currentFileExt?: string,
  readOnly?: boolean,
) => {
  onContextMenuClose: (e: KeyboardEvent) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  clickHandlers: ContextMenuHandlerDictionary;
  disabledKeys: ContextMenuItemIds[];
  sections: ContextMenuSectionType[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export const useContextMenu: UseContextMenu = function (
  viewInstance: EditorView | null,
  setCode: OnChangeHandlerSetCode,
  code?: string | null,
  isLspEnabled?: boolean,
  lspClients?: Map<LspId, LspClientRef>,
  currentFileExt?: string,
  readOnly?: boolean,
): ReturnType<UseContextMenu> {
  const { formatMessage } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [isPasteDisabled, setIsPasteDisabled] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const internalClipboard = useRef<string | null>(null);

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
        await writeText(selectedText);
        internalClipboard.current = selectedText;
      }
    },
    [ContextMenuItemIds.Paste]: async (): Promise<void> => {
      const selection = viewInstance?.state.selection.ranges;

      // In App Lab, use the internal clipboard to avoid navigator.clipboard.readText()
      // which triggers an OS-level permission prompt.
      const clipboardValue =
        Config.APP_NAME === 'App Lab'
          ? internalClipboard.current
          : await readText();

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
        await writeText(selectedText);
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
        lspFindAllReferences(viewInstance, formatMessage);
      }
    },
    [ContextMenuItemIds.Format]: (): void => {
      if (viewInstance) {
        lspFormat(viewInstance, formatMessage);
      }
    },
    [ContextMenuItemIds.Rename]: (): void => {
      if (viewInstance) {
        closeReferencePanel(viewInstance);
        lspRename(viewInstance, formatMessage);
      }
    },
  };

  useEffect(() => {
    if (Config.APP_NAME !== 'App Lab') return;

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
  }, []);

  // Paste availability requires an async clipboard read, so it is resolved when
  // the menu opens and stored separately.
  useEffect(() => {
    async function updatePasteDisabled(): Promise<void> {
      //If the document is not focused and development console is open, an error will be thrown
      //To avoid this we prevent the function from getting called if the document is not focused and the mode is development
      if (!document.hasFocus() && Config.MODE === 'development') return;

      if (Config.APP_NAME === 'App Lab') {
        // Sync internalClipboard from system clipboard when menu opens.
        // This ensures that if the user copied from another app, the internal clipboard
        // is updated before they paste. The clipboard service uses Wails native API
        // in desktop environment without triggering permission prompts.
        try {
          const systemClipboard = await readText();
          if (systemClipboard) {
            internalClipboard.current = systemClipboard;
          }
        } catch (error) {
          if (Config.MODE === 'development') {
            console.error('Failed to read system clipboard:', error);
          }
        }

        setIsPasteDisabled(!internalClipboard.current);
      } else {
        try {
          const clipboardValue = await readText();
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
