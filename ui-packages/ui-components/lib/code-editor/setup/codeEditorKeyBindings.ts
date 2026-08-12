import { acceptCompletion, completionStatus } from '@codemirror/autocomplete';
import { indentLess, indentMore } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { KeyBinding } from '@codemirror/view';

export const tabKeyBinding: KeyBinding = {
  key: 'Tab',
  run: (editorView): boolean => {
    const { state, dispatch } = editorView;
    if (state.readOnly) {
      return true;
    }
    if (completionStatus(state)) {
      return acceptCompletion(editorView);
    }
    if (state.selection.ranges.some((r) => !r.empty)) {
      return indentMore({ state, dispatch });
    }
    dispatch(
      state.update(state.replaceSelection(state.facet(indentUnit)), {
        scrollIntoView: true,
        userEvent: 'input',
      }),
    );
    return true;
  },
  shift: ({ state, dispatch }) => {
    if (state.readOnly) {
      return true;
    }
    return indentLess({ state, dispatch });
  },
};
