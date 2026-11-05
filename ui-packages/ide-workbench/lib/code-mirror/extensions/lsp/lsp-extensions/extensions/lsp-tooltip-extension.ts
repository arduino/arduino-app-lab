import { Extension } from '@codemirror/state';
import { EditorView, Rect, tooltips } from '@codemirror/view';

const TOOLTIP_EDGE_GAP = 8;

export const getEditorTooltipSpace = (view: EditorView): Rect => {
  const { scrollDOM } = view;
  const editor = scrollDOM.getBoundingClientRect();

  const { clientHeight, clientWidth } = view.dom.ownerDocument.documentElement;

  const scrollbarWidth = scrollDOM.offsetWidth - scrollDOM.clientWidth;
  const scrollbarHeight = scrollDOM.offsetHeight - scrollDOM.clientHeight;

  const usableBottom = Math.min(clientHeight, editor.bottom) - scrollbarHeight;
  const usableRight = Math.min(clientWidth, editor.right) - scrollbarWidth;

  return {
    top: Math.max(0, editor.top) + TOOLTIP_EDGE_GAP,
    left: Math.max(0, editor.left) + TOOLTIP_EDGE_GAP,
    bottom: usableBottom - TOOLTIP_EDGE_GAP,
    right: usableRight - TOOLTIP_EDGE_GAP,
  };
};

export const getLspTooltipsExtension = (): Extension => {
  const tooltipsExtension = tooltips({
    parent: document.body,
    tooltipSpace: getEditorTooltipSpace,
  });

  return tooltipsExtension;
};
