import {
  findNext,
  findPrevious,
  replaceAll,
  SearchQuery,
  setSearchQuery,
} from '@codemirror/search';
import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useCallback, useEffect, useState } from 'react';

import { runSearch } from '../code-mirror/extensions/find-and-replace/FindAndReplaceExt';
import { SearchState } from './findAndReplace.type';
import { getCurrentMatch, getMatchRanges } from './utils';

export const useFindAndReplace = (
  view: EditorView,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setTotalOccurrences: React.Dispatch<React.SetStateAction<number>>,
): {
  searchState: SearchState;
  setSearchState: React.Dispatch<React.SetStateAction<SearchState>>;
  currentMatch: number;
  selectPrevMatch: () => void;
  selectNextMatch: () => void;
} => {
  const [currentMatch, setCurrentMatch] = useState<number>(0);
  const [searchState, setSearchState] = useState<SearchState>({
    searchValue: '',
    caseSensitive: false,
    regexp: false,
    wholeWord: false,
  });

  const selectPrevMatch = useCallback((): void => {
    findPrevious(view);
    setCurrentMatch(getCurrentMatch(searchState, view));
  }, [searchState, view]);

  const selectNextMatch = useCallback((): void => {
    findNext(view);
    setCurrentMatch(getCurrentMatch(searchState, view));
  }, [searchState, view]);

  useEffect(() => {
    view.dispatch({ selection: EditorSelection.single(0, 0) });
    runSearch(
      () =>
        new SearchQuery({
          search: searchState.searchValue,
          literal: true,
          caseSensitive: searchState.caseSensitive,
          regexp: searchState.regexp,
          wholeWord: searchState.wholeWord,
        }),
      view,
      view.state,
      setLoading,
      setTotalOccurrences,
    );
    selectNextMatch();
  }, [searchState, selectNextMatch, setLoading, setTotalOccurrences, view]);
  return {
    searchState,
    setSearchState,
    currentMatch,
    selectPrevMatch,
    selectNextMatch,
  };
};

export const useReplace = (
  view: EditorView,
  searchState: SearchState,
  selectNextMatch: () => void,
): {
  replaceValue: string;
  setReplaceValue: React.Dispatch<React.SetStateAction<string>>;
  replaceHandler: (replaceText: string) => void;
  replaceAllHandler: (replaceText: string) => void;
} => {
  const [replaceValue, setReplaceValue] = useState<string>('');

  const replaceHandler = (replaceText: string): void => {
    //Set the cursor selection only to include the ranges of the selection search query.
    const selectionRanges = view.state.selection.ranges;
    const searchRanges = getMatchRanges(searchState, view);

    //Check what ranges from the selected ranges are in the search ranges
    const matchedRanges = selectionRanges.filter((selectionRange) =>
      searchRanges.some(
        (searchRange) =>
          selectionRange.from === searchRange.from &&
          selectionRange.to === searchRange.to,
      ),
    );

    if (matchedRanges.length > 0) {
      // Create the transaction to replace text only in matchedRanges
      const changes = matchedRanges.map((range) => ({
        from: range.from,
        to: range.to,
        insert: replaceText,
      }));

      // Dispatch the transaction to apply the changes
      const transaction = view.state.update({
        changes: changes,
      });
      view.dispatch(transaction);

      // Move to next match after replacing
      selectNextMatch();
    }
  };

  const replaceAllHandler = (replaceText: string): void => {
    const query = new SearchQuery({
      search: searchState.searchValue,
      literal: true,
      caseSensitive: searchState.caseSensitive,
      regexp: searchState.regexp,
      wholeWord: searchState.wholeWord,
      replace: replaceText,
    });
    view.dispatch({ effects: setSearchQuery.of(query) });

    replaceAll(view);
  };

  return { replaceValue, setReplaceValue, replaceHandler, replaceAllHandler };
};
