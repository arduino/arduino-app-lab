import {
  CategoryTree,
  ReferenceEntry,
  ReferenceItem,
  ReferencePath,
  ReferenceSearchResult,
} from '@cloud-editor-mono/ui-components';

export type UseGetReferenceCategories = (langCode?: string) => {
  categoryTree: CategoryTree | undefined;
  allEntries: Map<string, ReferenceEntry> | undefined;
  isLoading: boolean;
};

export type UseGetReferenceItem = (
  params: {
    path: ReferencePath;
    langCode?: string;
  },
  enabled: boolean,
) => {
  referenceItem: ReferenceItem | undefined;
  isLoading: boolean;
};

export type UseSearchReferenceItem = (
  params: {
    query: string;
  },
  enabled: boolean,
) => {
  searchResult: ReferenceSearchResult | undefined;
  isLoading: boolean;
};
