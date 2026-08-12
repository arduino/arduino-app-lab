import { closeReferencePanel, findReferences } from '@codemirror/lsp-client';
import { Command, EditorView, getDialog } from '@codemirror/view';

import { viewInstances } from '../../../../codeMirrorViewInstances';
import { LSP_RENAME_PANEL_CLASS } from './lsp-rename-panel/lsp-rename-panel';

export { closeReferencePanel };

/**
 * Close any references panel already open on another view, to avoid overlapping.
 *
 * `closeReferencePanel` is a no-op on views with no open panel (e.g. the console)
 */
const closeReferencePanelsOnOtherPanes = (currentView: EditorView): void => {
  for (const { instance } of Object.values(viewInstances)) {
    if (instance && instance !== currentView) {
      closeReferencePanel(instance);
    }
  }
};

export const openReferencesPanel: Command = (view) => {
  closeReferencePanelsOnOtherPanes(view);
  return findReferences(view);
};

export function isRenamePanelOpen(view: EditorView): boolean {
  return getDialog(view, LSP_RENAME_PANEL_CLASS) !== null;
}

export function closeRenamePanel(view: EditorView): void {
  if (!isRenamePanelOpen(view)) return;
  const closeBtn = view.dom.querySelector(
    `.cm-panel.${LSP_RENAME_PANEL_CLASS} .cm-dialog-close`,
  ) as HTMLElement | null;
  closeBtn?.click();
}
