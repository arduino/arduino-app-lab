import { Extension } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';

import { closeRenamePanel, isRenamePanelOpen } from '../lsp-panel-helpers';
import { LSP_RENAME_PANEL_CLASS } from './lsp-rename-panel';

const RENAME_PANEL_SELECTOR = `.cm-panel.${LSP_RENAME_PANEL_CLASS}`;

const renamePanelBlurPlugin = ViewPlugin.fromClass(
  class {
    mouseDownHandler: (event: MouseEvent) => void;

    constructor(view: EditorView) {
      this.mouseDownHandler = (event: MouseEvent): void => {
        if (!isRenamePanelOpen(view)) return;

        const target = event.target as Node | null;
        if (!target) return;

        const panelContainer = view.dom.querySelector(RENAME_PANEL_SELECTOR);
        // If the click landed inside the rename panel, keep it open
        if (!panelContainer || panelContainer.contains(target)) return;

        closeRenamePanel(view);
      };

      document.addEventListener('mousedown', this.mouseDownHandler);
    }

    destroy(): void {
      document.removeEventListener('mousedown', this.mouseDownHandler);
    }
  },
);

export const getLspRenamePanelBlurExtension = (): Extension =>
  renamePanelBlurPlugin;
