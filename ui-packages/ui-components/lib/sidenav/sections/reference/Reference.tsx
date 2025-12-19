import { ReferenceCategory } from '@cloud-editor-mono/infrastructure';
import { useCallback, useContext, useEffect, useState } from 'react';

import { SearchField } from '../../../essential/search-field';
import useDebouncedSearch from '../../../essential/search-field/useDebouncedSearch';
import { SidenavItemId, SidenavReferenceIds } from '../../sidenav.type';
import SidenavTabs from '../sub-components/SidenavTabs';
import { ReferenceContext } from './context/ReferenceContext';
import styles from './reference.module.scss';
import { ReferencePath } from './reference.type';
import { ReferenceContent } from './ReferenceContent';
import { ReferenceSearchView } from './ReferenceSearchView';
import {
  referenceCategoryToTab,
  sidenavReferenceTabs,
  tabToReferenceCategory,
} from './referenceSpec';

// TODO backend is currently down, consider local search
const DISABLE_SEARCH = true;

export function Reference(): JSX.Element {
  const { selectedTab, setSelectedTab } = useContext(ReferenceContext);

  const [referencePath, setReferencePath] = useState<ReferencePath>({
    category: ReferenceCategory.Functions,
    itemPath: null,
  });
  const [isSearchActive, setIsSearchActive] = useState(false);

  const { query, setQuery, debouncedQuery } = useDebouncedSearch();

  const selectTab = useCallback(
    (tab: React.Key): void => {
      const currentSelectedTab = tab as SidenavReferenceIds;
      setSelectedTab(currentSelectedTab);
      setReferencePath({
        category: tabToReferenceCategory[currentSelectedTab],
        itemPath: null,
      });
    },
    [setSelectedTab],
  );

  useEffect(() => {
    setIsSearchActive(!!debouncedQuery);
  }, [debouncedQuery]);

  const handlePathChange = useCallback((referencePath: ReferencePath): void => {
    setReferencePath(referencePath);
    setIsSearchActive(false);
  }, []);

  useEffect(() => {
    setSelectedTab(referenceCategoryToTab[referencePath.category]);
  }, [referencePath, setSelectedTab]);

  return (
    <div className={styles['reference-container']}>
      {!DISABLE_SEARCH && (
        <div className={styles['reference-search']}>
          <SearchField
            placeholder="Search reference"
            label="Search Reference"
            onChange={setQuery}
            value={query}
          />
        </div>
      )}

      {isSearchActive ? (
        <ReferenceSearchView
          query={debouncedQuery}
          onPathChange={handlePathChange}
        />
      ) : (
        <SidenavTabs
          type={SidenavItemId.Reference}
          defaultTab={SidenavReferenceIds.Functions}
          tabs={sidenavReferenceTabs}
          selectTab={selectTab}
          selectedTab={selectedTab}
          classes={{
            tabPanel: styles['reference-tab-panel'],
            tabs: styles['reference-tabs'],
          }}
        >
          <>
            <ReferenceContent
              referencePath={referencePath}
              onPathChange={handlePathChange}
            />
          </>
        </SidenavTabs>
      )}
    </div>
  );
}
