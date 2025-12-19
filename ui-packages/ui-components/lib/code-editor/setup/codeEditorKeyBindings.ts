import { indentLess, indentMore } from '@codemirror/commands';
import { KeyBinding } from '@codemirror/view';

export const tabKeyBinding: KeyBinding = {
  key: 'Tab',
  run: ({ state, dispatch }): boolean => {
    if (state.selection.ranges.some((r) => !r.empty))
      return indentMore({ state, dispatch });
    dispatch(
      state.update(state.replaceSelection('  '), {
        scrollIntoView: true,
        userEvent: 'input',
      }),
    );
    return true;
  },
  shift: indentLess,
};
