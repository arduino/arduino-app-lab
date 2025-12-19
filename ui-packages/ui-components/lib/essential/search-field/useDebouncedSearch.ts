import { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

interface UseDebouncedSearchResult<T> {
  filteredItems: T[];
  query: string;
  setQuery: (query: string) => void;
  debouncedQuery: string;
}

const DEFAULT_DEBOUNCE_MS = 300;

const useDebouncedSearch = <T = unknown>(
  initialItems?: T[],
  filterItemsFn?: (items: T[], query: string) => T[],
  debounceDelay = DEFAULT_DEBOUNCE_MS,
): UseDebouncedSearchResult<T> => {
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [filteredItems, setFilteredItems] = useState<T[]>(initialItems || []);
  const [query, setQuery] = useState<string>('');

  useDebounce(() => setDebouncedQuery(query), debounceDelay, [
    query,
    debounceDelay,
  ]);

  useEffect(() => {
    if (!initialItems) return;
    const filterItems = (query: string): void => {
      if (filterItemsFn) {
        const filtered = filterItemsFn?.(initialItems, query);
        if (filtered) setFilteredItems(filtered);
      }
    };

    if (debouncedQuery) {
      filterItems(debouncedQuery);
    } else {
      setFilteredItems(initialItems);
    }
  }, [debouncedQuery, filterItemsFn, initialItems]);

  return { filteredItems, query, setQuery, debouncedQuery };
};

export default useDebouncedSearch;
