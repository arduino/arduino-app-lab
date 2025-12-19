import { useCallback, useContext, useMemo, useState } from 'react';
import { useFilter } from 'react-aria';

import { Button, ButtonType } from '../../../essential/button';
import { SearchField } from '../../../essential/search-field';
import useDebouncedSearch from '../../../essential/search-field/useDebouncedSearch';
import { useI18n } from '../../../i18n/useI18n';
import { TextSize, XXSmall } from '../../../typography';
import { SidenavContext } from '../../context/sidenavContext';
import { messages } from '../../messages';
import {
  Example,
  ExamplesFolder,
  GetLibrary,
  SidenavExamplesIds,
  SidenavItemId,
  SidenavStandardLibrary,
} from '../../sidenav.type';
import { SidenavTabs } from '../sub-components/SidenavTabs';
import { ExamplesContext } from './context/examplesContext';
import styles from './examples.module.scss';
import ExamplesFromLibrariesList from './ExamplesFromLibrariesList';
import ExamplesList from './ExamplesList';
import { sidenavExamplesTabs } from './examplesSpec';
import { examplesMessages } from './messages';

const Examples: React.FC = () => {
  const { getLibraries, getExamplesByFolder, getLibrary } =
    useContext(SidenavContext);

  const {
    getExamples,
    initialSelectedTab,
    selectedBoard,
    selectedArchitecture,
    hydrateByPaths,
  } = useContext(ExamplesContext);

  const { formatMessage } = useI18n();

  const [selectedTab, setSelectedTab] = useState(initialSelectedTab);

  const { isLoading: getExamplesIsLoading, examples } = getExamples();
  const [currentSelectedArchitecture, setCurrentSelectedArchitecture] =
    useState(selectedArchitecture);

  const { contains } = useFilter({ sensitivity: 'base' });
  const filterExamples = useCallback(
    (items: Example[], query: string): Example[] =>
      items.filter((example) => {
        const nameHit = contains(example.name ?? '', query);
        const pathHit = contains(example.path ?? '', query);
        return nameHit || pathHit;
      }),
    [contains],
  );
  const { query, setQuery, debouncedQuery, filteredItems } =
    useDebouncedSearch<Example>(examples ?? [], filterExamples);

  const {
    query: libsQuery,
    setQuery: setLibsQuery,
    debouncedQuery: debouncedLibsQuery,
  } = useDebouncedSearch();
  const libsPayload = useMemo(() => {
    return {
      architecture: currentSelectedArchitecture,
      limit: 50,
      ...(debouncedLibsQuery && selectedTab === SidenavExamplesIds.FromLibraries
        ? { search: debouncedLibsQuery, page: 1 }
        : { page: 1 }),
    };
  }, [currentSelectedArchitecture, debouncedLibsQuery, selectedTab]);

  const libsPayloadWithSearchArch = useMemo(() => {
    return {
      ...libsPayload,
      limit: 350,
      search: `for ${currentSelectedArchitecture}`,
    };
  }, [currentSelectedArchitecture, libsPayload]);

  const {
    libraries: allLibraries,
    isLoading: getAllLibrariesIsLoading,
    isFetchingNextPage: isFetchingAllLibsNextPage,
    fetchNextPage: fetchAllLibsNextPage,
    hasNextPage: hasAllLibsNextPage,
    fromParams: allLibsFromParams,
  } = getLibraries(libsPayload, true);

  const {
    libraries: deviceLibraries,
    isLoading: getDeviceLibrariesIsLoading,
    isFetchingNextPage: isFetchingDeviceLibsNextPage,
    fetchNextPage: fetchDeviceLibsNextPage,
    hasNextPage: hasDeviceLibsNextPage,
    fromParams: deviceLibsFromParams,
  } = getLibraries(libsPayloadWithSearchArch, !!currentSelectedArchitecture);

  const [libraries, getLibrariesIsLoading] =
    selectedTab === SidenavExamplesIds.Device
      ? [
          deviceLibraries,
          getDeviceLibrariesIsLoading,
          isFetchingDeviceLibsNextPage,
          fetchDeviceLibsNextPage,
          hasDeviceLibsNextPage,
          deviceLibsFromParams,
        ]
      : [
          allLibraries,
          getAllLibrariesIsLoading,
          isFetchingAllLibsNextPage,
          fetchAllLibsNextPage,
          hasAllLibsNextPage,
          allLibsFromParams,
        ];

  const selectTab = (tab: React.Key): void => {
    const currentSelectedTab = tab as SidenavExamplesIds;
    setSelectedTab(currentSelectedTab);
  };

  const getLibraryDetails = useCallback(
    (item: SidenavStandardLibrary): ReturnType<GetLibrary> =>
      getLibrary({ id: `${item.id}@${item.version}` }, false),
    [getLibrary],
  );

  const handleBoardsSelection = useCallback(() => {
    setCurrentSelectedArchitecture(
      currentSelectedArchitecture === undefined
        ? selectedArchitecture
        : undefined,
    );
  }, [currentSelectedArchitecture, selectedArchitecture]);

  const items =
    selectedTab === SidenavExamplesIds.BuiltIn
      ? getExamplesByFolder(filteredItems)
      : libraries;

  return (
    <div className={styles['examples-container']}>
      <div className={styles['examples-header']}>
        {selectedTab === SidenavExamplesIds.BuiltIn ? (
          <SearchField
            placeholder={formatMessage(examplesMessages.searchExamples)}
            label={formatMessage(examplesMessages.searchExamples)}
            onChange={setQuery}
            value={query}
          />
        ) : (
          <SearchField
            placeholder={formatMessage(messages.searchLibraries)}
            label={formatMessage(messages.searchLibraries)}
            onChange={setLibsQuery}
            value={libsQuery}
          />
        )}
        <div className={styles['examples-filter']}>
          <XXSmall>{formatMessage(examplesMessages.showExamples)}</XXSmall>
          <Button
            type={ButtonType.Tertiary}
            size={TextSize.XXSmall}
            onClick={(): void => handleBoardsSelection()}
            disabled={!selectedBoard}
            classes={{ button: styles['examples-filter-button'] }}
          >{`${
            currentSelectedArchitecture !== undefined
              ? selectedBoard
              : formatMessage(examplesMessages.allDevices)
          }`}</Button>
        </div>
      </div>
      <SidenavTabs
        type={SidenavItemId.Examples}
        defaultTab={SidenavExamplesIds.Device}
        tabs={
          currentSelectedArchitecture
            ? sidenavExamplesTabs
            : sidenavExamplesTabs.filter(
                (tab) => tab.id !== SidenavExamplesIds.Device,
              )
        }
        selectTab={selectTab}
        selectedTab={selectedTab}
        classes={{
          tabPanel: styles['examples-tab-panel'],
          tabs: styles['examples-tabs'],
        }}
        isTabListHidden={!!debouncedQuery}
      >
        {selectedTab === SidenavExamplesIds.BuiltIn ? (
          <ExamplesList
            items={items as (ExamplesFolder | Example)[]}
            isLoading={getExamplesIsLoading}
            searchQuery={debouncedQuery}
            hydrateByPaths={hydrateByPaths}
          />
        ) : (
          <ExamplesFromLibrariesList
            libraries={items as SidenavStandardLibrary[]}
            filter={
              selectedTab === SidenavExamplesIds.Device
                ? (lib): boolean => {
                    return lib.id.startsWith(`${currentSelectedArchitecture}:`);
                  }
                : undefined
            }
            getLibraryDetails={getLibraryDetails}
            isLoading={getLibrariesIsLoading}
            hydrateByPaths={hydrateByPaths}
          />
        )}
      </SidenavTabs>
    </div>
  );
};

export default Examples;
