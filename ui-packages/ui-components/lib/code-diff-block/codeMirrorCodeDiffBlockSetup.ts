import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { cpp } from '@codemirror/lang-cpp';
import {
  bracketMatching,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState, Extension } from '@codemirror/state';
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';

import { codeBlockTags } from '../code-mirror/extensions/language/codeBlockHighLightStyle';
import { highlightStyle } from '../code-mirror/extensions/language/highlightStyle';

export const codeDiffBlockSetup: Extension = [
  EditorView.baseTheme({
    '.cm-selectionBackground': {
      backgroundColor: '#FFCC00',
      opacity: '0.4',
    },
  }),
  EditorView.editable.of(false),
  EditorView.lineWrapping,
  highlightSpecialChars(),
  history(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  cpp(),
  syntaxHighlighting(highlightStyle(codeBlockTags), { fallback: true }),
  highlightSpecialChars(),
  bracketMatching(),
  rectangularSelection(),
  crosshairCursor(),
  highlightSelectionMatches(),
  lineNumbers(),
  keymap.of([
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
  ]),
];
