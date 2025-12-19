import type { SearchResponse } from '@algolia/client-search';
import { Config } from '@cloud-editor-mono/common';
import algoliasearch, { SearchClient, SearchIndex } from 'algoliasearch';

let searchClient: SearchClient | null = null;
let referenceSearchIndex: SearchIndex | null = null;

function getSearchClient(): SearchClient {
  if (!searchClient) {
    searchClient = algoliasearch(Config.ALGOLIA_APP_ID, Config.ALGOLIA_API_KEY);
  }

  return searchClient;
}

function getReferenceSearchIndex(): SearchIndex {
  if (!referenceSearchIndex) {
    const searchClient = getSearchClient();
    referenceSearchIndex = searchClient.initIndex(
      Config.ALGOLIA_REFERENCE_INDEX,
    );
  }

  return referenceSearchIndex;
}

export async function searchReferenceIndex(
  query: string,
): Promise<SearchResponse<{ title: string; objectID: string }>> {
  return getReferenceSearchIndex().search<{ title: string; objectID: string }>(
    query,
    {
      filters: 'language_pretty:English AND types_of_reference:Language',
      restrictSearchableAttributes: ['title', 'splitTitle'],
      attributesToRetrieve: ['title', 'objectID'],
      typoTolerance: false,
    },
  );
}
