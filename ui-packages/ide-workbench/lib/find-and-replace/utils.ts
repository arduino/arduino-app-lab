import { SearchQuery } from '@codemirror/search';
import { EditorSelection, SelectionRange } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { SearchState } from './findAndReplace.type';

/**
 * Returns an array of selection ranges that match the current search query in the editor.
 *
 * This function creates a `SearchQuery` based on the provided `searchState` options and
 * iterates through the editor content to find all matching ranges. Each match is represented
 * as a `SelectionRange` and added to the `ranges` array.
 *
 */
export const getMatchRanges = (
  searchState: SearchState,
  view: EditorView,
): SelectionRange[] => {
  const query = new SearchQuery({
    search: searchState.searchValue,
    literal: true,
    caseSensitive: searchState.caseSensitive,
    regexp: searchState.regexp,
    wholeWord: searchState.wholeWord,
  });

  const cursor = query.getCursor(view.state);

  const ranges = [];
  let result = cursor.next(); // Selects the first result
  while (!result.done) {
    // Access the `value` property from the result
    ranges.push(EditorSelection.range(result.value.from, result.value.to));
    result = cursor.next(); // Moves to the next result
  }

  return ranges;
};

/**
 * This function retrieves the current cursor position within the editor view and checks
 * it against an array of positions (heads) from the search query ranges. It returns the
 * index of the match that corresponds to the cursor's position.
 */
export const getCurrentMatch = (
  searchState: SearchState,
  view: EditorView,
): number => {
  // Get cursor position
  const cursorPos = view.state.selection.main.head;

  // Search query ranges
  const ranges: SelectionRange[] = getMatchRanges(searchState, view);
  const headsArray = ranges.map((e) => e.head);

  return headsArray.indexOf(cursorPos) + 1;
};

/**
 * Selects and highlights one or more ranges of text that match the current search query in the editor.
 */
export const selectRange = (
  searchState: SearchState,
  view: EditorView,
): void => {
  const ranges: SelectionRange[] = getMatchRanges(searchState, view);

  // When there is only one occurrence
  if (ranges.length === 1) {
    return view.dispatch({
      selection: EditorSelection.single(ranges[0].from, ranges[0].to),
    });
  }

  // If multiple occurrences are selected
  view.dispatch({
    selection: EditorSelection.create(ranges, 1),
  });
};
