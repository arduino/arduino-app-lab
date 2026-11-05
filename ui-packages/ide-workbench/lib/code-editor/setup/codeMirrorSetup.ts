import { closeBrackets } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
} from '@codemirror/language';
import { highlightSelectionMatches } from '@codemirror/search';
import { EditorState, Extension } from '@codemirror/state';
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';

import { tabKeyBinding } from './codeEditorKeyBindings';
import { editorViewStyle, foldGutterStyle } from './codeEditorStyle';

export const setup: Extension = [
  closeBrackets(),
  highlightActiveLineGutter(),
  highlightActiveLine(),
  history(),
  EditorView.theme(editorViewStyle),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  bracketMatching(),
  rectangularSelection(),
  crosshairCursor(),
  highlightSelectionMatches(),
  lineNumbers(),
  foldGutter(foldGutterStyle),
  keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, tabKeyBinding]),
  EditorView.contentAttributes.of({ tabindex: '0' }),
];
