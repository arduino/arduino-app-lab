import { Extension, StateEffect, StateField } from '@codemirror/state';
import { EditorView, showTooltip, Tooltip } from '@codemirror/view';

interface FeedbackMessage {
  message: string;
  pos: number;
}

const feedbackStateEffect = StateEffect.define<FeedbackMessage | null>();

const feedbackStateField = StateField.define<FeedbackMessage | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(feedbackStateEffect)) {
        return effect.value;
      }
    }
    if (tr.docChanged || tr.selection) {
      return null;
    }
    return value;
  },
  provide: (field) =>
    showTooltip.compute([field], (state) => {
      const val = state.field(field);
      if (!val) {
        return null;
      }
      const tooltip: Tooltip = {
        pos: val.pos,
        above: true,
        create() {
          const dom = document.createElement('div');
          dom.className = 'cm-lsp-feedback-tooltip';
          dom.textContent = val.message;
          return { dom };
        },
      };
      return tooltip;
    }),
});

const clearFeedbackTooltip = (view: EditorView): void => {
  if (view.state.field(feedbackStateField) !== null) {
    view.dispatch({ effects: feedbackStateEffect.of(null) });
  }
};

const feedbackBlurHandler = EditorView.domEventHandlers({
  blur(_event, view) {
    clearFeedbackTooltip(view);
  },
  mousedown(_event, view) {
    clearFeedbackTooltip(view);
  },
});

export const getLspFeedbackTooltipExtension = (): Extension => [
  feedbackStateField,
  feedbackBlurHandler,
];

export const showLspFeedbackTooltip = ({
  view,
  message,
  pos,
}: {
  view: EditorView;
  message: string;
  pos?: number;
}): void => {
  const effectPos = pos ?? view.state.selection.main.head;
  view.dispatch({
    effects: feedbackStateEffect.of({ message, pos: effectPos }),
  });
};
