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
  highlightActiveLineGutter,
  keymap,
  rectangularSelection,
} from '@codemirror/view';

import { GutterDataWithFontSize } from '../../code-mirror/codeMirror.type';
import { createCustomLineNumberGutter } from './codeEditorGutterExtension';
import { tabKeyBinding } from './codeEditorKeyBindings';
import { editorViewStyle, foldGutterStyle } from './codeEditorStyle';

export function createGutterExtensions(
  gutter?: GutterDataWithFontSize,
): Extension {
  return [
    createCustomLineNumberGutter(
      gutter?.lineNumberStartOffset,
      gutter?.fontSize,
    ),
    foldGutter(foldGutterStyle),
  ];
}

export const setup: Extension = [
  closeBrackets(),
  highlightActiveLineGutter(),
  history(),
  EditorView.baseTheme(editorViewStyle),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  bracketMatching(),
  rectangularSelection(),
  crosshairCursor(),
  highlightSelectionMatches(),
  keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, tabKeyBinding]),
  EditorView.contentAttributes.of({ tabindex: '0' }),
];
