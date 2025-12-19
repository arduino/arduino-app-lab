import { SketchData } from '@cloud-editor-mono/infrastructure';
import React, { ForwardedRef, forwardRef, LegacyRef, useCallback } from 'react';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  Index,
  InfiniteLoader,
  List,
  ListRowProps,
} from 'react-virtualized';

import {
  LibraryMenuHandlerDictionary,
  SidenavStandardLibrary,
} from '../../sidenav.type';
import NoResults from '../common/NoResults';
import styles from './libraries.module.scss';
import { LibrariesListProps } from './LibrariesList';
import LibrariesListItem from './LibrariesListItem';
import LibrariesListItemSkeleton from './LibrariesListItemSkeleton';
import { createLibraryComponentKey } from './utils';

type LibrariesVirtualListProps = LibrariesListProps & {
  cache: CellMeasurerCache;
  getMoreItems: () => Promise<unknown>;
  isGettingMoreItems: boolean;
  hasMoreItems?: boolean;
  libraryMenuHandlers: LibraryMenuHandlerDictionary;
  hydrateExamplesByPaths: (paths: string[]) => Promise<void>;
};

const LibrariesVirtualList = forwardRef(
  (
    props: LibrariesVirtualListProps,
    listRef: ForwardedRef<List | undefined>,
  ) => {
    const {
      cache,
      standardLibraries: libraries,
      customLibraries,
      getLibrary,
      onClickInclude,
      pinnedLibraries,
      isLoading = false,
      setFavorite,
      getMoreItems,
      hasMoreItems,
      isGettingMoreItems,
      canModifyLibraryMetadata,
      libraryMenuHandlers,
      hydrateExamplesByPaths,
    } = props;

    const rowCount = !libraries
      ? 0
      : hasMoreItems
      ? libraries.length + 1
      : libraries.length;

    const loadMoreRows = isGettingMoreItems
      ? async (): Promise<void> => {
          return;
        }
      : getMoreItems;

    const isRowLoaded = ({ index }: Index): boolean =>
      !hasMoreItems || Boolean(libraries && index < libraries.length);

    const onHeightChange = useCallback(
      (index?: number) => {
        if (typeof index !== 'undefined') {
          cache.clear(index, 0);
          listRef &&
            (
              listRef as React.MutableRefObject<List | undefined>
            ).current?.recomputeRowHeights(index);
        }
      },
      [cache, listRef],
    );

    const rowRenderer = ({
      key,
      index,
      parent,
      style,
    }: ListRowProps): React.ReactNode => {
      return (
        <CellMeasurer
          key={key}
          cache={cache}
          parent={parent}
          columnIndex={0}
          rowIndex={index}
        >
          {({ registerChild }): React.ReactNode => {
            if (!isRowLoaded({ index })) {
              return (
                <LibrariesListItemSkeleton
                  ref={registerChild}
                  key={`libraries-list-item-skeleton-${key}`}
                  style={style}
                />
              );
            }

            const library = (libraries &&
              libraries[index]) as SidenavStandardLibrary;

            const linkedCustomLibrary = customLibraries?.find(
              (cl) => cl.name === library.name,
            );

            const pinnedVersion = pinnedLibraries?.find(
              (pl: SketchData['libraries'][0]) => pl.name === library.name,
            )?.version;

            return (
              <LibrariesListItem
                ref={registerChild}
                key={createLibraryComponentKey(library, pinnedVersion)}
                standardLibrary={library}
                customLibrary={linkedCustomLibrary}
                pinnedVersion={pinnedVersion}
                getLibraryDetails={getLibrary}
                onClickInclude={onClickInclude}
                setFavorite={setFavorite}
                containerStyle={style}
                index={index}
                onHeightChange={onHeightChange}
                disableVersionSelect={!canModifyLibraryMetadata}
                libraryMenuHandlers={libraryMenuHandlers}
                isCustom={false}
                hydrateExamplesByPaths={hydrateExamplesByPaths}
              />
            );
          }}
        </CellMeasurer>
      );
    };

    return (
      <>
        {!isLoading && (!libraries || libraries.length === 0) ? (
          <NoResults
            resourceName="library"
            classes={{ container: styles['no-results-container'] }}
          />
        ) : (
          <div className={styles['libraries-virtual-list-container']}>
            {isLoading ? (
              [...Array(3)].map((_, index) => (
                <LibrariesListItemSkeleton key={index} />
              ))
            ) : (
              <InfiniteLoader
                isRowLoaded={isRowLoaded}
                loadMoreRows={loadMoreRows}
                rowCount={rowCount}
              >
                {({ onRowsRendered }): React.ReactNode => (
                  <AutoSizer>
                    {({ width, height }): React.ReactNode => (
                      <List
                        ref={listRef as LegacyRef<List>}
                        width={width}
                        height={height}
                        rowCount={rowCount}
                        rowHeight={cache.rowHeight}
                        rowRenderer={rowRenderer}
                        onRowsRendered={onRowsRendered}
                        deferredMeasurementCache={cache}
                      />
                    )}
                  </AutoSizer>
                )}
              </InfiniteLoader>
            )}
          </div>
        )}
      </>
    );
  },
);

LibrariesVirtualList.displayName = 'LibrariesVirtualList';
export default LibrariesVirtualList;
