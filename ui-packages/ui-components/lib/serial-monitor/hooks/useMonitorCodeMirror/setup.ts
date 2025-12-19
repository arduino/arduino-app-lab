import {
  defaultHighlightStyle,
  syntaxHighlighting,
} from '@codemirror/language';
import { EditorState, Extension, Prec } from '@codemirror/state';
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightSpecialChars,
} from '@codemirror/view';

import { hasLineWrapping } from './extensions/lineWrapping';
import { search } from './extensions/search';
import { sentContents } from './extensions/sentContents';
import { styledContents } from './extensions/styleContents';
import { timestamps } from './extensions/timestamps';
import { trackedData } from './extensions/trackData';

const disablePaste = EditorView.domEventHandlers({
  paste(event) {
    event.preventDefault();
  },
});

export const serialMonitorSetup = (
  onTimestampsToggle: (value: boolean) => void,
  lineSeparator: string,
  wrapLines: boolean,
): Extension => [
  EditorView.editable.of(false),
  EditorState.readOnly.of(true),
  EditorState.lineSeparator.of(lineSeparator),
  EditorState.allowMultipleSelections.of(false),
  hasLineWrapping(wrapLines),
  highlightSpecialChars(),
  drawSelection(),
  dropCursor(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  crosshairCursor(),
  disablePaste,
  // highlightSelectionMatches(),
  timestamps(onTimestampsToggle),
  trackedData,
  search,
  Prec.lowest(sentContents),
  Prec.lowest(styledContents),
];
