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
import { throttle } from 'lodash';
import { createRoot } from 'react-dom/client';
import UAParser from 'ua-parser-js';

import {
  createMatchCounterWorker,
  iterable,
} from '../../../common/utils/utils';
import FindAndReplaceSection from '../../../find-and-replace/FindAndReplaceSection';
import { CodeMirrorEventAnnotation } from '../../codeMirror.type';
import { SearchData } from '../../codeMirrorViewInstances';
import {
  codeMirrorAnnotation,
  codeMirrorAnnotationMap,
  searchPanelUpdateMetadata,
} from '../../utils';

const parser = new UAParser();
const os = parser.getOS().name;
const searchKeyMapExt = ViewPlugin.fromClass(
  class {
    searchKeymapHandler: (event: KeyboardEvent) => void;

    constructor(view: EditorView) {
      this.searchKeymapHandler = (event: KeyboardEvent): void => {
        if (
          (event.ctrlKey || (os === 'Mac OS' && event.metaKey)) &&
          event.key === 'f'
        ) {
          event.preventDefault();
          if (searchPanelOpen(view.state)) {
            cmCloseSearchPanel(view);
          } else {
            cmOpenSearchPanel(view);
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

const createSearchConfig = (searchDep: SearchData): Extension =>
  search({
    createPanel: (view) => {
      const dom = document.createElement('div');
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
