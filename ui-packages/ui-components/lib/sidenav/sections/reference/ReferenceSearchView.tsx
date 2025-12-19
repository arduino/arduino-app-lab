import { useContext } from 'react';

import NoResults from '../common/NoResults';
import { ReferenceContext } from './context/ReferenceContext';
import styles from './reference.module.scss';
import { ReferencePath } from './reference.type';
import { ReferenceSkeleton } from './ReferenceSkeleton';
import { referencePathFromString, splitStringByQuery } from './utils';

type ReferenceSearchViewProps = {
  query: string;
  onPathChange: (path: ReferencePath) => void;
};

// TODO currently not used, update when search is restored
export const ReferenceSearchView: React.FC<ReferenceSearchViewProps> = ({
  query,
  onPathChange,
}: ReferenceSearchViewProps) => {
  const { searchReferenceItem } = useContext(ReferenceContext);

  // const { referenceSubcategories } = getReferenceCategories();
  const { searchResult, isLoading } = searchReferenceItem({ query }, !!query);

  const handlePathSelect = (href: string): void => {
    const path = href.split('language')[1];
    onPathChange(referencePathFromString(path));
  };

  return (
    <div className={styles['reference-search-view']}>
      {isLoading && <ReferenceSkeleton />}
      {searchResult && Object.keys(searchResult).length === 0 && (
        <NoResults
          classes={{ container: styles['reference-search-view-noResults'] }}
        />
      )}
      {searchResult &&
        // referenceSubcategories &&
        (Object.keys(searchResult) as Array<keyof typeof searchResult>).map(
          (category) => (
            <div
              key={category}
              className={styles['reference-search-view-category']}
            >
              <h3>{category}</h3>
              {Object.keys(searchResult[category]).map((subcategory) => (
                <div
                  key={subcategory}
                  className={styles['reference-search-view-subcategory']}
                >
                  {/* <h4>{referenceSubcategories[subcategory]}</h4> */}
                  <ul className={styles['reference-search-view-hits']}>
                    {searchResult[category][subcategory].map((item) => (
                      <li key={item.path}>
                        <button
                          onClick={(): void => handlePathSelect(item.path)}
                        >
                          {splitStringByQuery(item.title, query).map(
                            (substr, index) => {
                              if (
                                substr.toLocaleLowerCase() ===
                                query.toLocaleLowerCase()
                              ) {
                                return <b key={index}>{substr}</b>;
                              }
                              return substr;
                            },
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ),
        )}
    </div>
  );
};
