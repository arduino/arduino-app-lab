import { QueryKey } from '@tanstack/react-query';
import clsx from 'clsx';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { Details } from '../../../essential/details';
import { Skeleton } from '../../../skeleton';
import { SidenavContext } from '../../context/sidenavContext';
import {
  CustomLibraryExampleItem,
  isCustomLibraryExamplesFolder,
} from '../../sidenav.type';
import styles from './examples.module.scss';
import ExamplesList from './ExamplesList';
import ExamplesListLink from './ExamplesListLink';

interface ExamplesFromCustomLibrariesListItemProps {
  example: CustomLibraryExampleItem;
  customLibraryID?: string;
  hydrateByPaths: (paths: string[]) => Promise<void>;
}

const ExamplesFromCustomLibrariesListItem: React.FC<
  ExamplesFromCustomLibrariesListItemProps
> = (props: ExamplesFromCustomLibrariesListItemProps) => {
  const { example, customLibraryID, hydrateByPaths } = props;

  const {
    getCurrentResourceIds,
    getCustomLibraryExamplesByFolder,
    bypassOrgHeader,
    onPrivateResourceRequestError,
    getCustomLibrary,
  } = useContext(SidenavContext);

  const [examplesExpanded, setExamplesExpanded] = useState(false);
  const [selectedExampleExpanded, setSelectedExampleExpanded] = useState(true);

  const { exampleID } = getCurrentResourceIds();

  const customLibraryExampleKey: QueryKey = useMemo(
    () => ['get-custom-library-examples', example.path, bypassOrgHeader],
    [example.path, bypassOrgHeader],
  );

  const customLibrariesFiles = getCustomLibrary(
    customLibraryExampleKey,
    exampleID?.includes(example.path) ?? false,
    bypassOrgHeader,
    onPrivateResourceRequestError,
    example.path,
    true,
  );

  const customLibraryExamples = customLibrariesFiles?.filesList;
  const customLibraryExamplesRefetch = customLibrariesFiles?.refetch;
  const customLibraryExamplesIsLoading =
    customLibrariesFiles?.getFilesIsLoading;

  const examples = customLibraryExamples || [];
  const examplesByFolder = getCustomLibraryExamplesByFolder(examples);

  const isCurrentExampleSelected = exampleID?.includes(example.path);

  const toggleExamplesExpanded = useCallback(
    (isOpen: boolean) => {
      !isOpen && isCurrentExampleSelected && setSelectedExampleExpanded(false);
      setExamplesExpanded((prev) => {
        if (!prev && !customLibraryExamples && customLibraryExamplesRefetch) {
          customLibraryExamplesRefetch();
        }
        return !prev;
      });
    },
    [
      customLibraryExamples,
      customLibraryExamplesRefetch,
      isCurrentExampleSelected,
    ],
  );

  useEffect(() => {
    if (customLibraryExampleKey && examplesExpanded) {
      customLibraryExamplesRefetch();
    }
  }, [customLibraryExampleKey, customLibraryExamplesRefetch, examplesExpanded]);

  return (
    <li
      className={clsx(styles['examples-list-item'], {
        [styles['examples-link-active']]:
          !isCustomLibraryExamplesFolder(example) && example.path === exampleID,
      })}
    >
      {isCustomLibraryExamplesFolder(example) ? (
        <Details
          summaryNode={`${example.name}`}
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
          {customLibraryExamplesIsLoading ? (
            <div
              className={clsx(
                styles['library-examples-list-item--skeleton'],
                styles['examples-list-item'],
              )}
            >
              <Skeleton variant="rounded" />
            </div>
          ) : (
            <ExamplesList
              key={'custom-library-example-' + example.name}
              items={examplesByFolder}
              customLibraryID={customLibraryID}
              hydrateByPaths={hydrateByPaths}
            />
          )}
        </Details>
      ) : (
        <ExamplesListLink example={example} customLibraryID={customLibraryID} />
      )}
    </li>
  );
};

export default ExamplesFromCustomLibrariesListItem;
