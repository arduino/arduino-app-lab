import { Extension } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';

import { LSP_RENAME_PANEL_CLASS } from './lsp-rename-panel';

const RENAME_PANEL_SELECTOR = `.cm-panel.${LSP_RENAME_PANEL_CLASS}`;

function positionPanelAtCursor(view: EditorView, panel: HTMLElement): void {
  const pos = view.state.selection.main.head;
  const coords = view.coordsAtPos(pos);
  if (!coords) {
    return;
  }

  panel.style.right = 'auto';
  panel.style.top = `${coords.bottom + 8}px`;
  panel.style.left = `${coords.left}px`;

  // After layout is computed, clamp so the panel stays within the viewport.
  requestAnimationFrame(() => {
    const rect = panel.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      panel.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.bottom > window.innerHeight - 8) {
      panel.style.top = `${coords.top - rect.height - 8}px`;
    }
  });
}

const renamePanelPositionPlugin = ViewPlugin.fromClass(
  class {
    private observer: MutationObserver;

    constructor(view: EditorView) {
      this.observer = new MutationObserver(() => {
        const panel = view.dom.querySelector(
          RENAME_PANEL_SELECTOR,
        ) as HTMLElement | null;
        if (panel) {
          positionPanelAtCursor(view, panel);
        }
      });

      this.observer.observe(view.dom, { childList: true, subtree: true });
    }

    destroy(): void {
      this.observer.disconnect();
    }
  },
);

export const getLspRenamePanelPositionExtension = (): Extension =>
  renamePanelPositionPlugin;
