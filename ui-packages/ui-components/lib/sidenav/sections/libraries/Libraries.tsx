import { setCSSVariable } from '@cloud-editor-mono/common';
// import {
//   ChevronDown,
//   ChevronRightNoPad,
//   Dots,
// } from '@cloud-editor-mono/images/assets/icons';
// import { ArduinoBuilderBoardv3WithId } from '@cloud-editor-mono/infrastructure';
// import clsx from 'clsx';
// import { uniq } from 'lodash';
import {
  Key,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePrevious, useUnmount } from 'react-use';

import { Button, ButtonType } from '../../../essential/button';
// import { MultiSelect } from '../../../essential/multi-select';
import { SearchField } from '../../../essential/search-field';
import useDebouncedSearch from '../../../essential/search-field/useDebouncedSearch';
import { useI18n } from '../../../i18n/useI18n';
import { TextSize, XXSmall } from '../../../typography';
import { SidenavContext } from '../../context/sidenavContext';
import { messages } from '../../messages';
import { SidenavItemId, SidenavLibrariesIds } from '../../sidenav.type';
import { SidenavTabs } from '../sub-components/SidenavTabs';
import { LibrariesContext } from './context/librariesContext';
import styles from './libraries.module.scss';
import LibrariesList from './LibrariesList';
import { sidenavLibrariesTabs } from './librariesSpec';

export function Libraries(): JSX.Element {
  const { getLibraries, getLibrary, getCustomLibrary } =
    useContext(SidenavContext);
  const {
    // getBoards
    onClickInclude,
    pinnedLibraries,
    getCustomLibraries,
    selectedBoard,
    selectedArchitecture,
    getFavoriteLibraries,
    canModifySketchMetadata,
    libraryMenuHandlers,
    enableGetCustomLibraries,
    initialSelectedTab,
    hydrateExamplesByPaths,
  } = useContext(LibrariesContext);

  const { formatMessage } = useI18n();

  const [selectedTab, setSelectedTab] = useState(initialSelectedTab);

  // const [showFilters, setShowFilters] = useState(false);
  const filtersOverflowVisible = useRef(false);
  const filtersOverflowVisibleTimeoutId = useRef<number>();

  // const [selectedBoards, setSelectedBoards] = useState<
  //   ArduinoBuilderBoardv3WithId[] | undefined
  // >([]);

  const [currentSelectedArchitecture, setCurrentSelectedArchitecture] =
    useState(selectedArchitecture);

  const handleBoardsSelection = useCallback(() => {
    setCurrentSelectedArchitecture(
      currentSelectedArchitecture === undefined
        ? selectedArchitecture
        : undefined,
    );
  }, [currentSelectedArchitecture, selectedArchitecture]);

  // const { data: { boards } = {} } = getBoards();

  const { query, setQuery, debouncedQuery } = useDebouncedSearch();
  const libsPayload = useMemo(() => {
    // const architectureFilter = uniq(
    //   selectedBoards?.map((board) => board.architecture),
    // );

    return {
      // architecture:
      //   architectureFilter.length > 0 ? architectureFilter : undefined,
      architecture: currentSelectedArchitecture,
      ...(debouncedQuery ? { search: debouncedQuery, page: 1 } : { page: 1 }),
    };
  }, [debouncedQuery, currentSelectedArchitecture]);

  const { libraries, setFavorite, isLoading } = getLibraries(
    libsPayload,
    selectedTab === SidenavLibrariesIds.Standard,
  );

  const { customLibraries, customLibrariesAreLoading } = getCustomLibraries(
    enableGetCustomLibraries,
    selectedTab === SidenavLibrariesIds.Custom,
  );

  const {
    data: favoriteLibraries,
    isLoading: isLoadingFavoriteLibraries,
    isError: getFavoritesIsError,
  } = getFavoriteLibraries(selectedTab === SidenavLibrariesIds.Favorites);

  const allLibrariesLoaded =
    !isLoading && !customLibrariesAreLoading && !isLoadingFavoriteLibraries;
  const previousCustomLibrariesLength = usePrevious(customLibraries?.length);
  useEffect(() => {
    if (
      allLibrariesLoaded &&
      previousCustomLibrariesLength &&
      previousCustomLibrariesLength !== customLibraries?.length
    ) {
      setSelectedTab(SidenavLibrariesIds.Custom);
    }
  }, [previousCustomLibrariesLength, customLibraries, allLibrariesLoaded]);

  // const toggleFilters = useCallback(() => {
  //   setShowFilters((value) => !value);

  //   if (filtersOverflowVisible.current) {
  //     setCSSVariable(styles.librariesFiltersOverflow, 'hidden');
  //     filtersOverflowVisible.current = false;
  //   } else {
  //     if (filtersOverflowVisibleTimeoutId.current) {
  //       window.clearTimeout(filtersOverflowVisibleTimeoutId.current);
  //       filtersOverflowVisibleTimeoutId.current = undefined;
  //       return;
  //     }
  //     filtersOverflowVisibleTimeoutId.current = window.setTimeout(() => {
  //       setCSSVariable(styles.librariesFiltersOverflow, 'visible');
  //       filtersOverflowVisible.current = true;
  //       filtersOverflowVisibleTimeoutId.current = undefined;
  //     }, 300);
  //   }
  // }, []);

  // const handleBoardsSelection = useCallback(
  //   (selected: string[]) => {
  //     setSelectedBoards(
  //       boards?.filter((board) => selected.includes(board.name)),
  //     );
  //   },
  //   [boards],
  // );

  useUnmount(() => {
    setCSSVariable(styles.librariesFiltersOverflow, 'hidden');
    filtersOverflowVisible.current = false;
    filtersOverflowVisibleTimeoutId.current = undefined;
  });

  let standardLibraries, standardLibrariesAreLoading;
  if (selectedTab === SidenavLibrariesIds.Favorites) {
    [standardLibraries, standardLibrariesAreLoading] = [
      favoriteLibraries,
      isLoadingFavoriteLibraries,
    ];
  } else if (selectedTab === SidenavLibrariesIds.Custom) {
    [standardLibraries, standardLibrariesAreLoading] = [undefined, false];
  } else {
    [standardLibraries, standardLibrariesAreLoading] = [libraries, isLoading];
  }

  return (
    <div className={styles['libraries-container']}>
      <div className={styles['libraries-header']}>
        <SearchField
          placeholder={formatMessage(messages.searchLibraries)}
          label={formatMessage(messages.searchLibraries)}
          onChange={setQuery}
          value={query}
        />
        {/* <div
          className={clsx(
            styles['libraries-filters-container'],
            showFilters && styles['expanded'],
          )}
        >
          <button
            className={styles['libraries-filters-button']}
            onClick={toggleFilters}
          >
            <Dots />
            <XSmall>FILTERS & SORTING</XSmall>
            {showFilters ? <ChevronDown /> : <ChevronRightNoPad />}
          </button>
          <div
            className={clsx(
              styles['filters'],
              showFilters && styles['expanded'],
            )}
          > */}
        <div className={styles['libraries-board-filter-toggle']}>
          <XXSmall>{formatMessage(messages.showLibrariesFor)}</XXSmall>
          <Button
            type={ButtonType.Tertiary}
            size={TextSize.XXSmall}
            onClick={handleBoardsSelection}
            disabled={!selectedBoard}
            classes={{ button: styles['libraries-filter-button'] }}
          >{`${
            currentSelectedArchitecture !== undefined
              ? selectedBoard
              : formatMessage(messages.allDevices)
          }`}</Button>
        </div>
        {/*<MultiSelect
                items={(boards || []).map(({ name }) => name)}
                allItemsLabel="All boards"
                placeholder="Search board"
                ariaLabel="Search board"
                onSelect={handleBoardsSelection}
              />
          </div>
        </div> */}
      </div>
      <SidenavTabs
        type={SidenavItemId.Libraries}
        defaultTab={SidenavLibrariesIds.Standard}
        tabs={
          !getFavoritesIsError &&
          favoriteLibraries &&
          favoriteLibraries.length > 0
            ? sidenavLibrariesTabs
            : sidenavLibrariesTabs.filter(
                (tab) => tab.id !== SidenavLibrariesIds.Favorites,
              )
        }
        selectTab={setSelectedTab as (id: Key) => void}
        selectedTab={selectedTab}
      >
        <LibrariesList
          standardLibraries={standardLibraries}
          customLibraries={customLibraries}
          pinnedLibraries={pinnedLibraries}
          getLibrary={getLibrary}
          getCustomLibrary={getCustomLibrary}
          onClickInclude={onClickInclude}
          isLoading={
            selectedTab === SidenavLibrariesIds.Custom
              ? customLibrariesAreLoading
              : standardLibrariesAreLoading
          }
          setFavorite={setFavorite}
          canModifyLibraryMetadata={canModifySketchMetadata}
          libraryMenuHandlers={libraryMenuHandlers}
          selectedTab={selectedTab}
          hydrateExamplesByPaths={hydrateExamplesByPaths}
        />
      </SidenavTabs>
    </div>
  );
}
