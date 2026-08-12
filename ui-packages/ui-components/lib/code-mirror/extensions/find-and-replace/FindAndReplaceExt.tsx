import {
  closeSearchPanel as cmCloseSearchPanel,
  getSearchQuery,
  openSearchPanel as cmOpenSearchPanel,
  search,
  searchPanelOpen,
  SearchQuery,
  setSearchQuery,
} from '@codemirror/search';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { throttle } from 'lodash-es';
import { createRoot } from 'react-dom/client';
import UAParser from 'ua-parser-js';

import {
  createMatchCounterWorker,
  iterable,
} from '../../../common/utils/utils';
import FindAndReplaceSection from '../../../find-and-replace/FindAndReplaceSection';
import { CodeMirrorEventAnnotation } from '../../codeMirror.type';
import {
  SearchData,
  ViewInstances,
  viewInstances,
} from '../../codeMirrorViewInstances';
import {
  codeMirrorAnnotation,
  codeMirrorAnnotationMap,
  searchPanelUpdateMetadata,
} from '../../utils';

const parser = new UAParser();
const os = parser.getOS().name;

// Each search-enabled editor installs its own keydown listener, and split view
// mounts two at once. Every listener resolves the same target and only that
// view acts, so one Cmd+F can never toggle both panels.
const searchViews = new Set<EditorView>();
let lastFocusedSearchView: EditorView | null = null;

// Hidden or detached instances have zero dimensions and must never react.
const isViewVisible = (view: EditorView): boolean => {
  const rect = view.dom.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

/** Focused editor, else the last focused one, else panel A (left). */
const resolveShortcutTarget = (): EditorView | null => {
  const candidates = [...searchViews].filter(isViewVisible);
  if (candidates.length <= 1) {
    return candidates[0] ?? null;
  }

  const focused = candidates.find(
    (candidate) =>
      candidate.hasFocus || candidate.dom.contains(document.activeElement),
  );
  if (focused) {
    return focused;
  }

  if (lastFocusedSearchView && candidates.includes(lastFocusedSearchView)) {
    return lastFocusedSearchView;
  }

  const panelA = viewInstances[ViewInstances.Editor].instance;
  return panelA && candidates.includes(panelA) ? panelA : candidates[0];
};

const searchKeyMapExt = ViewPlugin.fromClass(
  class {
    view: EditorView;
    searchKeymapHandler: (event: KeyboardEvent) => void;
    focusHandler: () => void;

    constructor(view: EditorView) {
      this.view = view;
      searchViews.add(view);

      // `focusin` on view.dom, so focus in the Find & Replace inputs counts too.
      this.focusHandler = (): void => {
        lastFocusedSearchView = view;
      };
      view.dom.addEventListener('focusin', this.focusHandler);

      this.searchKeymapHandler = (event: KeyboardEvent): void => {
        const isFindShortcut =
          (event.ctrlKey || (os === 'Mac OS' && event.metaKey)) &&
          event.key === 'f';
        const isEscape = event.key === 'Escape';

        if (!isFindShortcut && !isEscape) {
          return;
        }

        if (resolveShortcutTarget() !== view) {
          return;
        }

        if (isFindShortcut) {
          event.preventDefault();
          if (searchPanelOpen(view.state)) {
            cmCloseSearchPanel(view);
          } else {
            cmOpenSearchPanel(view);
          }
          return;
        }

        if (searchPanelOpen(view.state)) {
          cmCloseSearchPanel(view);
        }
      };

      window.addEventListener('keydown', this.searchKeymapHandler);
    }

    destroy(): void {
      window.removeEventListener('keydown', this.searchKeymapHandler);
      this.view.dom.removeEventListener('focusin', this.focusHandler);
      searchViews.delete(this.view);
      if (lastFocusedSearchView === this.view) {
        lastFocusedSearchView = null;
      }
    }
  },
);

const createSearchConfig = (searchDep: SearchData): Extension =>
  search({
    createPanel: (view) => {
      const dom = document.createElement('div');
      // Tagged so this panel can be floated as a top-right overlay
      // anchored to `.cm-editor`. See codeEditorStyle.ts.
      dom.className = 'cm-find-replace-host';
      const root = createRoot(dom);

      const renderReactComponent = (
        hasHeader?: boolean,
        isSearching?: boolean,
        searchResultOccurrences?: number,
      ): void => {
        root.render(
          <FindAndReplaceSection
            view={view}
            loading={isSearching ?? searchDep.isSearching}
            setLoading={searchDep.setIsSearching}
            totalOccurrences={
              searchResultOccurrences ?? searchDep.searchResultOccurrences
            }
            setTotalOccurrences={searchDep.setSearchResultOccurrences}
            hasHeader={hasHeader}
          />,
        );
      };

      renderReactComponent(searchDep.hasHeader);
      return {
        dom,
        update(viewUpdate: ViewUpdate): void {
          for (const transaction of viewUpdate.transactions) {
            const annotation = transaction.annotation(codeMirrorAnnotation);

            if (!annotation) return;

            if (
              codeMirrorAnnotationMap[annotation].value ===
              CodeMirrorEventAnnotation.SearchPanelUpdate
            ) {
              const metadataAnnotation = transaction.annotation(
                searchPanelUpdateMetadata,
              );

              if (!metadataAnnotation) return;
              const { isSearching, searchResultOccurrences, hasHeader } =
                metadataAnnotation;

              renderReactComponent(
                hasHeader,
                isSearching,
                searchResultOccurrences,
              );
            }
          }
        },
        destroy(): void {
          root.unmount();
          dom.remove();
        },
      };
    },
  });

let matchCounter: Worker | undefined;
const requestCount = throttle(
  (
    view: EditorView,
    query: SearchQuery,
    onLoading: (value: boolean) => void,
    onTotalOccurrencesReceived: (value: number) => void,
  ) => {
    const uInt8Array = new TextEncoder().encode(view.state.doc.toString());
    //Clean active counters. To avoid errors on multiple successive requestCount()
    if (matchCounter) {
      matchCounter?.terminate();
      matchCounter = undefined;
    }

    //Create dedicated worker
    matchCounter = createMatchCounterWorker();
    matchCounter?.addEventListener(
      'message',
      (event: MessageEvent<number>): void => {
        onTotalOccurrencesReceived(event.data);
        onLoading(false);

        //Terminate the worker on response.
        matchCounter?.terminate();
        matchCounter = undefined;
      },
      //},
    );

    //Request the count
    matchCounter?.postMessage(
      {
        searchValue: query.search,
        doc: uInt8Array,
      },
      [uInt8Array.buffer],
    );
  },
  200,
);

export function runSearch(
  getSearch: () => SearchQuery,
  view: EditorView,
  state: EditorState,
  onLoading: (value: boolean) => void,
  onTotalOccurrencesReceived: (value: number) => void,
): number {
  try {
    const query = getSearch();
    let count = 0;
    let useMatchCounter = false;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _match of iterable(query.getCursor(state))) {
      count++;
      if (count === 100) {
        useMatchCounter = true;
        break;
      }
    }
    if (useMatchCounter) {
      requestCount(view, query, onLoading, onTotalOccurrencesReceived);
      onLoading(true);
    } else {
      onTotalOccurrencesReceived(count);
    }

    // Perform the search
    view.dispatch({ effects: setSearchQuery.of(query) });

    return count;
  } catch (error) {
    console.error(error);
    return 0;
  }
}

export const createSearchExt = (searchDep: SearchData): Extension[] => {
  //Whenever the codeMirror doc is update the search is updated.
  const setupSearchExt = (searchDep: SearchData): Extension => {
    return EditorView.updateListener.of((viewUpdate: ViewUpdate) => {
      if (viewUpdate.docChanged) {
        runSearch(
          () => getSearchQuery(viewUpdate.state),
          viewUpdate.view,
          viewUpdate.state,
          searchDep.setIsSearching,
          searchDep.setSearchResultOccurrences,
        );
      }
    });
  };
  return [
    createSearchConfig(searchDep),
    searchKeyMapExt,
    setupSearchExt(searchDep),
  ];
};
