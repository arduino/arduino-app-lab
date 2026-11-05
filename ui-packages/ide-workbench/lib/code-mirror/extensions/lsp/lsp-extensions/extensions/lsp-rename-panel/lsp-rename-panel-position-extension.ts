import { Extension } from '@codemirror/state';
import { type ViewUpdate, EditorView, ViewPlugin } from '@codemirror/view';

import { getRenamePanel } from './lsp-rename-panel';

const GAP = 8;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), Math.max(min, max));

// The panel is absolutely positioned inside `.cm-editor`: a fixed panel would be
// offset by App Lab's `contain: layout` on that element. So it is placed in
// editor coordinates and kept inside the editor's box.
const positionPanel = (view: EditorView): void => {
  view.requestMeasure({
    key: positionPanel,
    read: () => {
      const panel = getRenamePanel(view)?.dom;
      const cursor = view.coordsAtPos(view.state.selection.main.head);
      if (!panel || !cursor) {
        return null;
      }
      return {
        panel,
        cursor,
        editor: view.dom.getBoundingClientRect(),
        size: panel.getBoundingClientRect(),
      };
    },
    write: (measure) => {
      if (!measure || !measure.panel.isConnected) {
        return;
      }
      const { panel, cursor, editor, size } = measure;
      const below = cursor.bottom + GAP;
      const top =
        below + size.height > editor.bottom - GAP
          ? cursor.top - size.height - GAP
          : below;
      const left = clamp(
        cursor.left,
        editor.left + GAP,
        editor.right - size.width - GAP,
      );
      panel.style.left = `${left - editor.left}px`;
      panel.style.top = `${
        clamp(top, editor.top + GAP, editor.bottom - size.height - GAP) -
        editor.top
      }px`;
    },
  });
};

const renamePanelPositionPlugin = ViewPlugin.define(
  () => {
    let open = false;
    return {
      update(update: ViewUpdate): void {
        const isOpen = getRenamePanel(update.view) !== null;
        if (
          isOpen &&
          (!open || update.geometryChanged || update.selectionSet)
        ) {
          positionPanel(update.view);
        }
        open = isOpen;
      },
    };
  },
  {
    eventObservers: {
      scroll: (_event, view) => {
        if (getRenamePanel(view)) {
          positionPanel(view);
        }
      },
    },
  },
);

export const getLspRenamePanelPositionExtension = (): Extension =>
  renamePanelPositionPlugin;
