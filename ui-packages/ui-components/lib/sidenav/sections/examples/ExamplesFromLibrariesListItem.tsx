import clsx from 'clsx';
import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { usePrevious } from 'react-use';

import { Details } from '../../../essential/details';
import { Skeleton } from '../../../skeleton';
import { SidenavContext } from '../../context/sidenavContext';
import { GetLibrary, SidenavStandardLibrary } from '../../sidenav.type';
import styles from './examples.module.scss';
import ExamplesList from './ExamplesList';

interface ExamplesFromLibrariesListItemProps {
  libraryItem: SidenavStandardLibrary;
  getLibraryDetails: (item: SidenavStandardLibrary) => ReturnType<GetLibrary>;
  index?: number;
  onHeightChange?: (index?: number) => void;
  style?: React.CSSProperties;
  hydrateByPaths: (paths: string[]) => Promise<void>;
}

const ExamplesFromLibrariesListItem = forwardRef(
  (props: ExamplesFromLibrariesListItemProps, ref) => {
    const {
      libraryItem,
      getLibraryDetails,
      index,
      onHeightChange,
      style,
      hydrateByPaths,
    } = props;

    const { getCurrentResourceIds, getExamplesByFolder } =
      useContext(SidenavContext);

    const [examplesExpanded, setExamplesExpanded] = useState(false);
    const prevExamplesExpanded = usePrevious(examplesExpanded);
    const [selectedExampleExpanded, setSelectedExampleExpanded] =
      useState(true);

    const {
      library: libraryWithDetails,
      isLoading,
      refetch,
    } = getLibraryDetails && getLibraryDetails(libraryItem);
    const prevLibraryExamples = usePrevious(libraryWithDetails?.examples);

    const examples = libraryWithDetails?.examples || [];
    const examplesByFolder = getExamplesByFolder(examples);
    const { sourceLibraryID } = getCurrentResourceIds();

    const isCurrentExampleSelected =
      typeof sourceLibraryID === 'string'
        ? sourceLibraryID === libraryItem.id
        : false;

    const toggleExamplesExpanded = useCallback(
      (isOpen: boolean) => {
        !isOpen &&
          isCurrentExampleSelected &&
          setSelectedExampleExpanded(false);
        setExamplesExpanded((prev) => {
          if (!prev && !libraryWithDetails) {
            refetch();
          }
          return !prev;
        });
      },
      [isCurrentExampleSelected, libraryWithDetails, refetch],
    );

    useEffect(() => {
      if (
        (!prevLibraryExamples && libraryWithDetails?.examples) ||
        (prevExamplesExpanded && !examplesExpanded) ||
        (!prevExamplesExpanded && examplesExpanded)
      ) {
        onHeightChange && onHeightChange(index);
      }
    }, [
      examplesExpanded,
      index,
      libraryWithDetails?.examples,
      onHeightChange,
      prevExamplesExpanded,
      prevLibraryExamples,
    ]);

    return (
      <li
        style={style}
        ref={ref as (instance: HTMLLIElement | null) => void}
        className={styles['examples-virtual-list-item']}
        key={libraryItem.name}
      >
        <Details
          summaryNode={`${libraryItem.name} (${libraryItem.examplesNumber})`}
          chevronPosition="left"
          isOpen={
            examplesExpanded ||
            (isCurrentExampleSelected && selectedExampleExpanded)
          }
          onToggle={toggleExamplesExpanded}
          classes={{
            details: styles['examples-details'],
            summaryLabel: styles['examples-virtual-list-item-summary-label'],
          }}
        >
          {isLoading ? (
            <div
              className={clsx(
                styles['library-examples-list-item--skeleton'],
                styles['examples-list-item'],
              )}
            >
              <Skeleton variant="rounded" />
            </div>
          ) : (
            examplesByFolder.map((item) => (
              <ExamplesList
                key={item.name}
                items={item.examples}
                sourceLibraryID={`${libraryItem.id}@${libraryItem.version}`}
                index={index}
                onHeightChange={onHeightChange}
                hydrateByPaths={hydrateByPaths}
              />
            ))
          )}
        </Details>
      </li>
    );
  },
);

ExamplesFromLibrariesListItem.displayName = 'ExamplesFromLibrariesListItem';
export default ExamplesFromLibrariesListItem;
