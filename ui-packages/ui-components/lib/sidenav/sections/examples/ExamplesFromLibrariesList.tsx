import React, { forwardRef } from 'react';

import { GetLibrary, SidenavStandardLibrary } from '../../sidenav.type';
import NoResults from '../common/NoResults';
import styles from './examples.module.scss';
import ExamplesFromLibrariesListItem from './ExamplesFromLibrariesListItem';
import ExamplesListItemSkeleton from './ExamplesListItemSkeleton';

interface ExamplesFromLibrariesListProps {
  libraries: SidenavStandardLibrary[];
  filter?: (lib: SidenavStandardLibrary) => boolean;
  getLibraryDetails: (item: SidenavStandardLibrary) => ReturnType<GetLibrary>;
  isLoading?: boolean;
  hydrateByPaths: (paths: string[]) => Promise<void>;
}

const ExamplesFromLibrariesList = forwardRef<
  HTMLUListElement,
  ExamplesFromLibrariesListProps
>((props, listRef) => {
  const {
    libraries,
    filter,
    getLibraryDetails,
    isLoading = false,
    hydrateByPaths,
  } = props;

  const filtered =
    (libraries || []).filter(
      (lib) => lib.examplesNumber > 0 && (filter ? filter(lib) : true),
    ) ?? [];

  const skeletonChildren = Number(styles.skeletonChildren);

  if (!isLoading && (!libraries || libraries.length === 0)) {
    return (
      <NoResults
        resourceName="examples"
        classes={{ container: styles['no-results-container'] }}
      />
    );
  }

  return (
    <div className={styles['examples-list-container']}>
      {isLoading ? (
        <ExamplesListItemSkeleton count={skeletonChildren} />
      ) : (
        <ul ref={listRef} className={styles['examples-list']}>
          {filtered.map((library, index) => (
            <ExamplesFromLibrariesListItem
              key={library.id}
              libraryItem={library}
              getLibraryDetails={getLibraryDetails}
              index={index}
              hydrateByPaths={hydrateByPaths}
            />
          ))}
        </ul>
      )}
    </div>
  );
});

ExamplesFromLibrariesList.displayName = 'ExamplesFromLibrariesList';
export default ExamplesFromLibrariesList;
