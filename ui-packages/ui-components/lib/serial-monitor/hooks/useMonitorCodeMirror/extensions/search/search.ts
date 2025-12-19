import { Config } from '@cloud-editor-mono/common';
import {
  closeSearchPanel as cmCloseSearchPanel,
  findNext,
  findPrevious,
  openSearchPanel as cmOpenSearchPanel,
  search,
  searchPanelOpen,
  SearchQuery,
  setSearchQuery,
} from '@codemirror/search';
import { Compartment, EditorSelection, Facet } from '@codemirror/state';
import {
  EditorView,
  showTooltip,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view';
import { throttle } from 'lodash';
import { UAParser } from 'ua-parser-js';

import {
  createMatchCounterWorker,
  iterable,
} from '../../../../../common/utils/utils';
import { type SentContent, sentContents } from '../sentContents';
import { Counter, includes } from './utils';
// Search state
type SearchState = {
  searchValue: string;
  isSentContentsSearch: boolean;
  currentMatch: Counter;
  totalMatches: Counter;
};

type Filters = 'all-log' | 'sent-by-me';

const searchState: SearchState = {
  /**
   * Current value of the searched text
   */
  searchValue: '',

  /**
   * Current flag indicating whether the user is currently searching only user-sent contents or not
   */
  isSentContentsSearch: false,

  /**
   * Current selected search match
   */
  currentMatch: new Counter(),

  /**
   * Total number of occurrences found for the search
   */
  totalMatches: new Proxy(new Counter(), {
    // When total matches is 0 hide navigation
    set(totalMatches, key, newValue): boolean {
      if (key === 'value' && navigation) {
        navigation.style.display = newValue > 0 ? 'flex' : 'none';
        totalMatches.value = newValue;
        return true;
      }
      return Reflect.set(totalMatches, key, newValue);
    },
    get(totalMatches, key): Counter[keyof Counter] {
      return Reflect.get(totalMatches, key);
    },
  }),
};

const matchCounter = createMatchCounterWorker(!Config.DISABLE_WEB_WORKER);
matchCounter?.addEventListener(
  'message',
  (event: MessageEvent<number>): void => {
    searchState.totalMatches.value = event.data;
  },
);

// Business logic
/**
 * Move the selection to the search occurrence starting at the given position
 */
function selectMatch(view: EditorView, match: SentContent): void {
  const anchor =
    match.from + match.textContent.indexOf(searchState.searchValue);
  view.dispatch({
    selection: {
      anchor: anchor,
      head: anchor + searchState.searchValue.length,
    },
    scrollIntoView: true,
    userEvent: 'select.search',
  });
}

/**
 * If is a search of user sent content, searches the previous occurrence inside `sentContents`
 * otherwise, searches the previous occurrence inside all the document contents
 */
function selectPrevMatch(view: EditorView): void {
  const { searchValue, isSentContentsSearch, totalMatches, currentMatch } =
    searchState;

  if (totalMatches.value === 0) return;
  if (isSentContentsSearch) {
    const sentContentsList = view.state.field(sentContents);
    let lastSearchIndex = sentContentsList.findLastIndex(
      ({ from }) => from <= view.state.selection.main.from,
    );
    if (lastSearchIndex === 0) {
      lastSearchIndex = sentContentsList.length;
    }
    const match = sentContentsList
      .slice(0, lastSearchIndex)
      .findLast(({ textContent }) =>
        includes(textContent, searchValue),
      ) as SentContent;
    selectMatch(view, match);
  } else {
    findPrevious(view);
  }
  if (currentMatch.value > 1) {
    currentMatch.value--;
  } else {
    currentMatch.value = totalMatches.value;
  }
}

/**
 * If is a search of user sent content, searches the next occurrence inside `sentContents`
 * otherwise, searches the next occurrence inside all the document contents
 */
function selectNextMatch(view: EditorView): void {
  const { searchValue, isSentContentsSearch, totalMatches, currentMatch } =
    searchState;

  if (totalMatches.value === 0) return;
  if (isSentContentsSearch) {
    const sentContentsList = view.state.field(sentContents);
    let nextSearchIndex = sentContentsList.findIndex(
      ({ from }) => from > view.state.selection.main.from,
    );
    if (nextSearchIndex === -1) {
      nextSearchIndex = 0;
    }
    const match = sentContentsList
      .slice(nextSearchIndex)
      .find(({ textContent }) =>
        includes(textContent, searchValue),
      ) as SentContent;
    selectMatch(view, match);
  } else {
    findNext(view);
  }
  if (currentMatch.value < totalMatches.value) {
    currentMatch.value++;
  } else {
    currentMatch.value = 1;
  }
}

function initializeSearch(view: EditorView): void {
  const { totalMatches, currentMatch } = searchState;

  view.dispatch({
    selection: EditorSelection.single(0, 0),
  });
  currentMatch.value = 0;
  totalMatches.value = 0;
}

const requestCount = throttle((view: EditorView) => {
  const uInt8Array = new TextEncoder().encode(view.state.doc.toString());
  matchCounter?.postMessage(
    {
      searchValue: searchState.searchValue,
      doc: uInt8Array,
    },
    [uInt8Array.buffer],
  );
}, 200);

/**
 * Updates search state with a given value
 */
function updateSearch(view: EditorView, value?: string | undefined): void {
  const { isSentContentsSearch, totalMatches } = searchState;

  if (typeof value === 'string') searchState.searchValue = value;

  // Reset selection and counters to be ready for the new search
  initializeSearch(view);

  // Create a new search query with the new input value
  const query = new SearchQuery({
    search: searchState.searchValue,
    literal: true,
  });

  // Calculate the total number of matches.
  // The user-sent contents are not numerous in order of size so we calculate the total number directly.
  // The content emitted by the board on the other hand could be thousands,
  // so from 100 onwards we pass the count to a separate web worker so as not to block the UI
  if (isSentContentsSearch) {
    totalMatches.value = view.state
      .field(sentContents)
      .filter(({ textContent }) => includes(textContent, query.search)).length;
  } else {
    let useMatchCounter = false;
    let count = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _match of iterable(query.getCursor(view.state))) {
      count++;
      if (count === 100) {
        useMatchCounter = true;
        break;
      }
    }
    if (useMatchCounter) {
      totalMatches.setPlaceholder('99+');
      requestCount(view);
    } else {
      totalMatches.value = count;
    }
  }

  // Perform the search
  view.dispatch({ effects: setSearchQuery.of(query) });
  selectNextMatch(view);
}

function changeIsSentContentsSearch(view: EditorView, value: boolean): void {
  searchState.isSentContentsSearch = value;
  if (searchState.isSentContentsSearch) {
    view.dispatch({
      effects: [
        editorWrapperClass.reconfigure(
          EditorView.editorAttributes.of({
            class: 'sent-contents-search-active',
          }),
        ),
      ],
    });
  } else {
    view.dispatch({
      effects: [editorWrapperClass.reconfigure([])],
    });
  }
}

// Element references and builders
let searchInput: HTMLInputElement;
let navigation: HTMLDivElement;
let filterButton: HTMLButtonElement;
let filterDropdown: HTMLDivElement;

function createPanelRoot(...children: (HTMLElement | Text)[]): HTMLElement {
  const root = document.createElement('div');
  for (const child of children) {
    root.appendChild(child);
  }
  return root;
}

function createSearchIcon(): HTMLSpanElement {
  const icon = document.createElement('span');
  icon.classList.add('search-icon');
  return icon;
}

function createInput(onUpdate: (value: string) => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search';
  input.addEventListener('keyup', () => {
    onUpdate(input.value);
  });
  searchInput = input;
  return input;
}

function createNavButton(
  className: string,
  title: string,
  onClick: (ev: Event) => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.classList.add(className);
  button.title = title;
  button.addEventListener('click', onClick);
  return button;
}

function createNavigation(...children: (HTMLElement | Text)[]): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.classList.add('navigation');
  for (const child of children) {
    wrapper.appendChild(child);
  }
  navigation = wrapper;
  return wrapper;
}

function createFilterButton(onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = 'content-filter-btn';
  button.textContent = 'All log';
  button.addEventListener('click', () => {
    button.classList.toggle('dropdown-opened');
  });
  button.addEventListener('click', onClick);
  filterButton = button;
  return button;
}

function createFilterDropdown(
  onChange: (value: Filters) => void,
): HTMLDivElement {
  const dropdown = document.createElement('div');
  dropdown.id = 'content-filter-dropdown';
  const allLog = document.createElement('button');
  allLog.textContent = 'All log';
  allLog.classList.add('selected');
  const sentByMe = document.createElement('button');
  sentByMe.textContent = 'Sent by me';

  function buildClickHandler(value: Filters, label: string): () => void {
    return function (): void {
      onChange(value);
      allLog.classList.toggle('selected');
      sentByMe.classList.toggle('selected');
      filterButton.textContent = label;
      dropdown.style.display = 'none';
    };
  }

  allLog.addEventListener('click', buildClickHandler('all-log', 'All log'));
  sentByMe.addEventListener(
    'click',
    buildClickHandler('sent-by-me', 'Sent by me'),
  );

  dropdown.appendChild(allLog);
  dropdown.appendChild(sentByMe);
  filterDropdown = dropdown;
  return dropdown;
}

// Extensions
const editorWrapperClass = new Compartment();

const searchConfig = search({
  top: true,
  createPanel(view) {
    const { currentMatch, totalMatches } = searchState;

    const searchIcon = createSearchIcon();
    const input = createInput(function onUpdate(inputValue) {
      updateSearch(view, inputValue);
    });
    const navigation = createNavigation(
      currentMatch.el,
      document.createTextNode(' of '),
      totalMatches.el,
      createNavButton('prev', 'Previous result', function onClick() {
        selectPrevMatch(view);
      }),
      createNavButton('next', 'Next result', function onClick() {
        selectNextMatch(view);
      }),
    );
    const filterButton = createFilterButton(function onClick() {
      if (filterDropdown.style.display === 'block')
        filterDropdown.style.display = 'none';
      else filterDropdown.style.display = 'block';
    });

    return {
      top: true,
      dom: createPanelRoot(searchIcon, input, navigation, filterButton),
    };
  },
});

const filterDropdownExt = showTooltip.of({
  pos: 0,
  create: (view) => {
    const dropdown = createFilterDropdown(function onChange(
      value: Filters,
    ): void {
      if (value === 'all-log') changeIsSentContentsSearch(view, false);
      else if (value === 'sent-by-me') changeIsSentContentsSearch(view, true);
      updateSearch(view);
    });

    return {
      dom: dropdown,
    };
  },
});

const listenForSelectionReset = EditorView.updateListener.of(
  (update: ViewUpdate) => {
    if (update.selectionSet) {
      const range = update.state.selection.ranges?.[0];
      // No active selection so no selected search match
      if (range.from === range.to) {
        searchState.currentMatch.value = 0;
      }
    }
  },
);

const searchKeymap = new Compartment();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SearchKeyMapEnabled = { enabled: boolean; meta?: any };
const searchKeyMapEnabled = Facet.define<
  SearchKeyMapEnabled,
  SearchKeyMapEnabled
>({
  combine(values) {
    return values?.[0];
  },
});

const searchKeyMapExt = ViewPlugin.fromClass(
  class {
    searchKeymapHandler: (event: KeyboardEvent) => void;

    constructor(view: EditorView) {
      this.searchKeymapHandler = (event: KeyboardEvent): void => {
        if (
          (event.ctrlKey ||
            (new UAParser().getOS().name === 'Mac OS' && event.metaKey)) &&
          event.key === 'f'
        ) {
          event.preventDefault();
          if (searchPanelOpen(view.state)) {
            closeSearchPanel(view);
          } else {
            const { enabled, meta: showDisabledMessage } =
              view.state.facet(searchKeyMapEnabled);
            if (enabled) {
              openSearchPanel(view);
            } else {
              showDisabledMessage();
            }
          }
        }
      };

      window.addEventListener('keydown', this.searchKeymapHandler);
    }

    destroy(): void {
      window.removeEventListener('keydown', this.searchKeymapHandler);
    }
  },
);

export const searchExt = [
  editorWrapperClass.of([]),
  searchConfig,
  listenForSelectionReset,
  filterDropdownExt,
  searchKeymap.of(searchKeyMapEnabled.of({ enabled: true })),
  searchKeyMapExt,
];

export function closeSearchPanel(view: EditorView): void {
  const panel = document.querySelector('.cm-panels');
  panel?.classList.toggle('expanded');
  setTimeout(() => {
    cmCloseSearchPanel(view);
  }, 300);
}

function openSearchPanel(view: EditorView): void {
  cmOpenSearchPanel(view);
  setTimeout(() => {
    const panel = document.querySelector('.cm-panels');
    panel?.classList.toggle('expanded');
    searchInput.focus();
  });
}

export function toggleSearchPanel(view: EditorView): void {
  searchState.searchValue = '';
  view.dispatch({
    effects: setSearchQuery.of(new SearchQuery({ search: '' })),
  });
  initializeSearch(view);

  if (searchPanelOpen(view.state)) {
    closeSearchPanel(view);
  } else {
    openSearchPanel(view);
  }
}

export function enableSearchKeymapExt(view: EditorView): void {
  view.dispatch({
    effects: [
      searchKeymap.reconfigure(searchKeyMapEnabled.of({ enabled: true })),
    ],
  });
}
export function disableSearchKeymapExt(
  view: EditorView,
  showDisabledMessage: () => void,
): void {
  view.dispatch({
    effects: [
      searchKeymap.reconfigure(
        searchKeyMapEnabled.of({ enabled: false, meta: showDisabledMessage }),
      ),
    ],
  });
}
