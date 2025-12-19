import {
  GetLibrariesList_Response,
  SketchData,
} from '@cloud-editor-mono/infrastructure';
import clsx from 'clsx';
import { useMemo } from 'react';

import { messages } from '../../messages';
import {
  GetCustomLibrary,
  GetLibrary,
  LibraryMenuHandlerDictionary,
  OnClickInclude,
  SetFavoriteLibrary,
  SidenavLibrariesIds,
  SidenavStandardLibrary,
} from '../../sidenav.type';
import NoResults from '../common/NoResults';
import styles from './libraries.module.scss';
import LibrariesListItem from './LibrariesListItem';
import LibrariesListItemSkeleton from './LibrariesListItemSkeleton';
import { createLibraryComponentKey } from './utils';

export interface LibrariesListProps {
  getLibrary: GetLibrary;
  getCustomLibrary: GetCustomLibrary;
  standardLibraries?: SidenavStandardLibrary[];
  customLibraries?: GetLibrariesList_Response;
  isLoading?: boolean;
  onClickInclude: OnClickInclude;
  pinnedLibraries?: SketchData['libraries'];
  setFavorite: SetFavoriteLibrary;
  canModifyLibraryMetadata?: boolean;
  libraryMenuHandlers: LibraryMenuHandlerDictionary;
  selectedTab?: string;
  hydrateExamplesByPaths: (paths: string[]) => Promise<void>;
}

const LibrariesList: React.FC<LibrariesListProps> = (
  props: LibrariesListProps,
) => {
  const {
    standardLibraries,
    customLibraries,
    getLibrary,
    getCustomLibrary,
    onClickInclude,
    pinnedLibraries,
    isLoading = false,
    setFavorite,
    canModifyLibraryMetadata,
    libraryMenuHandlers,
    selectedTab,
    hydrateExamplesByPaths,
  } = props;

  const isCustomTab = selectedTab === SidenavLibrariesIds.Custom;

  const showNoResults =
    !isLoading &&
    (isCustomTab
      ? !customLibraries || customLibraries.length === 0
      : !standardLibraries || standardLibraries.length === 0);

  const title = useMemo(() => {
    switch (selectedTab) {
      case SidenavLibrariesIds.Favorites:
        return messages.noFavoriteLibrariesTitle;
      case SidenavLibrariesIds.Custom:
        return messages.noCustomLibrariesTitle;
      default:
        return undefined;
    }
  }, [selectedTab]);

  const message = useMemo(() => {
    switch (selectedTab) {
      case SidenavLibrariesIds.Favorites:
        return messages.noFavoriteLibrariesMsg;
      case SidenavLibrariesIds.Custom:
        return messages.noCustomLibrariesMsg;
      default:
        return undefined;
    }
  }, [selectedTab]);

  return (
    <div
      className={clsx(
        styles['libraries-list-container'],
        showNoResults && styles['no-overflow'],
      )}
    >
      {showNoResults ? (
        <NoResults
          title={title}
          message={message}
          resourceName={
            isCustomTab || selectedTab === SidenavLibrariesIds.Favorites
              ? undefined
              : 'library'
          }
          classes={{
            container: styles['no-results-container'],
            image: styles['no-results-image'],
          }}
        />
      ) : (
        <ul className={styles['libraries-list']}>
          {isLoading
            ? [...Array(3)].map((_, index) => (
                <LibrariesListItemSkeleton key={index} />
              ))
            : isCustomTab
            ? (customLibraries ?? []).map((customLibrary) => (
                <LibrariesListItem
                  key={customLibrary.id}
                  standardLibrary={undefined}
                  customLibrary={customLibrary}
                  libraryMenuHandlers={libraryMenuHandlers}
                  pinnedVersion={undefined}
                  getLibraryDetails={getCustomLibrary}
                  onClickInclude={onClickInclude}
                  setFavorite={undefined}
                  disableVersionSelect={undefined}
                  containerStyle={undefined}
                  onHeightChange={undefined}
                  isCustom
                  hydrateExamplesByPaths={hydrateExamplesByPaths}
                />
              ))
            : (standardLibraries ?? []).map((standardLibrary) => {
                const linkedCustomLibrary = customLibraries?.find(
                  (cl) => cl.name === standardLibrary.name,
                );

                const pinnedVersion = pinnedLibraries?.find(
                  (pl) => pl.name === standardLibrary.name,
                )?.version;

                return (
                  <LibrariesListItem
                    key={createLibraryComponentKey(
                      standardLibrary,
                      pinnedVersion,
                    )}
                    standardLibrary={standardLibrary}
                    customLibrary={linkedCustomLibrary}
                    pinnedVersion={pinnedVersion}
                    getLibraryDetails={getLibrary}
                    onClickInclude={onClickInclude}
                    setFavorite={setFavorite}
                    disableVersionSelect={!canModifyLibraryMetadata}
                    libraryMenuHandlers={libraryMenuHandlers}
                    isCustom={false}
                    hydrateExamplesByPaths={hydrateExamplesByPaths}
                  />
                );
              })}
        </ul>
      )}
    </div>
  );
};

LibrariesList.displayName = 'LibrariesList';
export default LibrariesList;
