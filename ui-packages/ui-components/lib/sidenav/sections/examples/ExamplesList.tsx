import React from 'react';

import {
  CustomLibraryExampleItem,
  Example,
  ExamplesFolder,
  isExamplesFolder,
} from '../../sidenav.type';
import NoResults from '../common/NoResults';
import styles from './examples.module.scss';
import ExamplesFromCustomLibrariesListItem from './ExamplesFromCustomLibrariesListItem';
import ExamplesListItem from './ExamplesListItem';
import ExamplesListItemSkeleton from './ExamplesListItemSkeleton';

const skeletonChildren = Number(styles.skeletonChildren);

interface ExamplesListProps {
  items: (ExamplesFolder | Example | CustomLibraryExampleItem)[];
  sourceLibraryID?: string;
  customLibraryID?: string;
  isLoading?: boolean;
  searchQuery?: string;
  index?: number;
  onHeightChange?: (index?: number) => void;
  hydrateByPaths: (paths: string[]) => Promise<void>;
  hydrateOnToggle?: boolean;
}

const ExamplesList: React.FC<ExamplesListProps> = (
  props: ExamplesListProps,
) => {
  const {
    items,
    sourceLibraryID,
    customLibraryID,
    isLoading = false,
    searchQuery,
    index,
    onHeightChange,
    hydrateByPaths,
    hydrateOnToggle = true,
  } = props;

  const collectVisibleLeafPaths = (
    nodes: (Example | ExamplesFolder)[],
    query?: string,
  ): Set<string> => {
    const out = new Set<string>();
    const q = query?.trim()?.toLowerCase();
    const hasQuery = Boolean(q && q.length > 0);

    const visit = (n: Example | ExamplesFolder): void => {
      if (isExamplesFolder(n)) {
        n.examples.forEach(visit);
        return;
      }
      if (!n.path) return;

      if (!hasQuery) {
        out.add(n.path);
        return;
      }
      const name = n.name?.toLowerCase?.() ?? '';
      const path = n.path?.toLowerCase?.() ?? '';
      if (name.includes(q!) || path.includes(q!)) {
        out.add(n.path);
      }
    };

    nodes.forEach(visit);
    return out;
  };

  const visiblePaths = React.useMemo(
    () =>
      collectVisibleLeafPaths(
        items.filter(isExamplesFolder) as (Example | ExamplesFolder)[],
        searchQuery,
      ),
    [items, searchQuery],
  );

  return (
    <div className={styles['examples-list-container']}>
      {!isLoading && (!items || (items?.length === 0 && searchQuery)) ? (
        <NoResults
          resourceName="examples"
          classes={{
            container: styles['no-results-container'],
          }}
        />
      ) : (
        <ul className={styles['examples-list']}>
          {isLoading ? (
            <ExamplesListItemSkeleton count={skeletonChildren} />
          ) : customLibraryID ? (
            items.map((item) => (
              <ExamplesFromCustomLibrariesListItem
                key={`${item.name}-${customLibraryID}`}
                example={item as CustomLibraryExampleItem}
                customLibraryID={customLibraryID}
                hydrateByPaths={hydrateByPaths}
              />
            ))
          ) : (
            items.map((item) => (
              <ExamplesListItem
                visiblePaths={visiblePaths}
                key={`${item.name}-${sourceLibraryID}`}
                example={item as Example | ExamplesFolder}
                sourceLibraryID={sourceLibraryID}
                searchQuery={searchQuery}
                index={index}
                onHeightChange={onHeightChange}
                hydrateByPaths={hydrateByPaths}
                hydrateOnToggle={hydrateOnToggle}
              />
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default ExamplesList;
