import { signatureKeymap } from '@codemirror/lsp-client';
import { Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

import { FormatMessage } from '../../../../../../i18n/useI18n';
import {
  lspFindAllReferences,
  lspFormat,
  lspGoToDefinition,
  lspGoToImplementation,
  lspGoToTypeDefinition,
  lspRename,
} from '../../../lsp-client/lsp-client-commands';
import { LspReferencesPanelActions } from '../../../lsp-references/lsp-references-types';
import { closeRenamePanel } from '../lsp-rename-panel/lsp-rename-panel';

export const getLspClientKeymapExtension = ({
  formatMessage,
  readOnly = false,
  showLspReferences,
  closeLspReferences,
}: {
  formatMessage: FormatMessage;
  readOnly?: boolean;
} & LspReferencesPanelActions): Extension => {
  // Content-modifying shortcuts (rename, format) are omitted for read-only
  // files (external files + example apps).
  const editKeymaps = readOnly
    ? []
    : [
        {
          key: 'F2',
          run: (view: EditorView): boolean => {
            closeLspReferences?.();
            return lspRename(view, formatMessage);
          },
          preventDefault: true,
        },
        {
          key: 'Shift-Alt-f',
          run: (view: EditorView): boolean => lspFormat(view, formatMessage),
          preventDefault: true,
        },
      ];

  const keymaps = keymap.of([
    ...editKeymaps,
    {
      key: 'Shift-F12',
      run: (view: EditorView): boolean => {
        closeRenamePanel(view);
        return lspFindAllReferences(view, formatMessage, showLspReferences);
      },
      preventDefault: true,
    },
    {
      key: 'F12',
      run: (view: EditorView): boolean =>
        lspGoToDefinition(view, formatMessage),
      preventDefault: true,
    },
    {
      key: 'Alt-F12',
      run: (view: EditorView): boolean =>
        lspGoToTypeDefinition(view, formatMessage),
      preventDefault: true,
    },
    {
      key: 'Mod-F12',
      run: (view: EditorView): boolean =>
        lspGoToImplementation(view, formatMessage),
      preventDefault: true,
    },
    {
      key: 'Escape',
      run: (): boolean => closeLspReferences?.() ?? false,
    },
    ...signatureKeymap,
  ]);

  return keymaps;
};
