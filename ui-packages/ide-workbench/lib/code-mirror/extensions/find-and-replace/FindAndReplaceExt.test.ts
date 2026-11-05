/**
 * The doc-change re-run in `createSearchExt` must skip an empty query, and the guard must sit in
 * the update listener rather than in `runSearch`: `useFindAndReplace` calls `runSearch` with an
 * empty query to clear the highlights. The last test covers that call.
 */

import {
  getSearchQuery,
  SearchQuery,
  setSearchQuery,
} from '@codemirror/search';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it, vi } from 'vitest';

import { SearchData } from '../../codeMirrorViewInstances';
import { createSearchExt, runSearch } from './FindAndReplaceExt';

function mount(doc = 'alpha\nbeta\nalpha'): {
  view: EditorView;
  searchDep: SearchData;
  type: (text: string) => void;
} {
  const searchDep: SearchData = {
    isSearching: false,
    setIsSearching: vi.fn(),
    searchResultOccurrences: 0,
    setSearchResultOccurrences: vi.fn(),
    hasHeader: false,
  };

  const view = new EditorView({
    state: EditorState.create({ doc, extensions: createSearchExt(searchDep) }),
    parent: document.body,
  });

  return {
    view,
    searchDep,
    type: (text) =>
      view.dispatch({
        changes: { from: view.state.doc.length, insert: text },
      }),
  };
}

describe('createSearchExt doc-change listener', () => {
  it('does not re-run the search on a doc change with no query', () => {
    const { view, searchDep, type } = mount();

    type('x');

    expect(searchDep.setSearchResultOccurrences).not.toHaveBeenCalled();
    expect(searchDep.setIsSearching).not.toHaveBeenCalled();
    view.destroy();
  });

  it('re-runs the search on a doc change while a query is set', () => {
    const { view, searchDep, type } = mount();
    view.dispatch({
      effects: setSearchQuery.of(new SearchQuery({ search: 'alpha' })),
    });
    vi.mocked(searchDep.setSearchResultOccurrences).mockClear();

    type('\nalpha');

    expect(searchDep.setSearchResultOccurrences).toHaveBeenCalledWith(3);
    view.destroy();
  });

  it('stops re-running once the query is cleared again', () => {
    const { view, searchDep, type } = mount();
    view.dispatch({
      effects: setSearchQuery.of(new SearchQuery({ search: 'alpha' })),
    });
    view.dispatch({
      effects: setSearchQuery.of(new SearchQuery({ search: '' })),
    });
    vi.mocked(searchDep.setSearchResultOccurrences).mockClear();

    type('x');

    expect(searchDep.setSearchResultOccurrences).not.toHaveBeenCalled();
    view.destroy();
  });
});

describe('runSearch with an empty query', () => {
  it('still installs the empty query, which is what clears the highlights', () => {
    const { view, searchDep } = mount();
    view.dispatch({
      effects: setSearchQuery.of(new SearchQuery({ search: 'alpha' })),
    });
    expect(getSearchQuery(view.state).search).toBe('alpha');

    // What `useFindAndReplace` does when the user empties the search box.
    const count = runSearch(
      () => new SearchQuery({ search: '', literal: true }),
      view,
      view.state,
      searchDep.setIsSearching,
      searchDep.setSearchResultOccurrences,
    );

    expect(count).toBe(0);
    expect(getSearchQuery(view.state).search).toBe('');
    expect(getSearchQuery(view.state).valid).toBe(false);
    expect(searchDep.setSearchResultOccurrences).toHaveBeenLastCalledWith(0);
    view.destroy();
  });
});
