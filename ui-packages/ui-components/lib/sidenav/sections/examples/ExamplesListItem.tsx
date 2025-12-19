import clsx from 'clsx';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';

import { Details } from '../../../essential/details';
import { XSmall } from '../../../typography';
import { SidenavContext } from '../../context/sidenavContext';
import { Example, ExamplesFolder, isExamplesFolder } from '../../sidenav.type';
import styles from './examples.module.scss';
import ExamplesList from './ExamplesList';
import ExamplesListLink from './ExamplesListLink';
import { useHighlightText } from './hooks/useHighlightText';

interface ExamplesListItemProps {
  example: Example | ExamplesFolder;
  sourceLibraryID?: string;
  searchQuery?: string;
  index?: number;
  onHeightChange?: (index?: number) => void;
  visiblePaths?: Set<string>;
  hydrateByPaths: (paths: string[]) => Promise<void>;
  hydrateOnToggle?: boolean;
}

const ExamplesListItem: React.FC<ExamplesListItemProps> = (
  props: ExamplesListItemProps,
) => {
  const {
    example,
    sourceLibraryID,
    searchQuery,
    index,
    onHeightChange,
    visiblePaths,
    hydrateByPaths,
    hydrateOnToggle = true,
  } = props;

  const { getCurrentResourceIds } = useContext(SidenavContext);
  const { exampleID } = getCurrentResourceIds();

  const [examplesExpanded, setExamplesExpanded] = useState(false);
  const [selectedExampleExpanded, setSelectedExampleExpanded] = useState(true);

  const fetchedPathsRef = useRef<Set<string>>(new Set());

  const isCurrentExampleSelected = useCallback(
    (exampleFolder: ExamplesFolder): boolean =>
      exampleFolder.examples.some(
        (exampleItem) =>
          (!isExamplesFolder(exampleItem) && exampleItem.path === exampleID) ||
          (isExamplesFolder(exampleItem) &&
            isCurrentExampleSelected(exampleItem)),
      ),
    [exampleID],
  );

  const getLeaves = useCallback((node: Example | ExamplesFolder): Example[] => {
    if (!isExamplesFolder(node)) return [node];
    return node.examples.flatMap(getLeaves);
  }, []);

  const folderHasVisibleLeaf = useCallback(
    (folder: ExamplesFolder, visible?: Set<string>): boolean => {
      if (!visible || visible.size === 0) return false;
      return getLeaves(folder).some((l) => l.path && visible.has(l.path));
    },
    [getLeaves],
  );

  const hydrateFolder = useCallback(
    async (folder: ExamplesFolder): Promise<void> => {
      if (!hydrateOnToggle) return;

      const leavesAll = getLeaves(folder);

      const paths = leavesAll
        .map((l) => l.path)
        .filter((p): p is string => !!p)
        .filter(
          (p) =>
            !fetchedPathsRef.current.has(p) &&
            (!visiblePaths || visiblePaths.has(p)),
        );

      if (!paths.length) return;

      await hydrateByPaths(paths);
      paths.forEach((p) => fetchedPathsRef.current.add(p));
    },
    [getLeaves, visiblePaths, hydrateByPaths, hydrateOnToggle],
  );

  const toggleExamplesExpanded = useCallback(
    (isOpen: boolean) => {
      onHeightChange && onHeightChange(index);
      !isOpen &&
        isExamplesFolder(example) &&
        isCurrentExampleSelected(example) &&
        setSelectedExampleExpanded(false);

      if (hydrateOnToggle && !examplesExpanded && isExamplesFolder(example)) {
        void hydrateFolder(example);
      }

      setExamplesExpanded((prev) => !prev);
    },
    [
      example,
      index,
      isCurrentExampleSelected,
      onHeightChange,
      examplesExpanded,
      hydrateFolder,
      hydrateOnToggle,
    ],
  );

  const autoHydratedRef = useRef(false);

  useEffect(() => {
    if (!hydrateOnToggle) return;

    if (autoHydratedRef.current) return;
    if (!searchQuery) return;
    if (!isExamplesFolder(example)) return;
    if (!folderHasVisibleLeaf(example, visiblePaths)) return;

    void hydrateFolder(example);
    autoHydratedRef.current = true;
    setExamplesExpanded(true);
  }, [
    searchQuery,
    example,
    hydrateFolder,
    visiblePaths,
    folderHasVisibleLeaf,
    hydrateOnToggle,
  ]);

  const exampleItem = (
    <XSmall title={example.name}>
      {useHighlightText(example.name, searchQuery ?? '')}
    </XSmall>
  );

  return (
    <li
      className={clsx(styles['examples-list-item'], {
        [styles['examples-link-active']]:
          !isExamplesFolder(example) && example.path === exampleID,
      })}
    >
      {isExamplesFolder(example) ? (
        <Details
          summaryNode={exampleItem}
          chevronPosition="left"
          isOpen={
            !!searchQuery ||
            examplesExpanded ||
            (isCurrentExampleSelected(example) && selectedExampleExpanded)
          }
          onToggle={toggleExamplesExpanded}
          classes={{ details: styles['examples-details'] }}
        >
          <ExamplesList
            sourceLibraryID={sourceLibraryID}
            items={example.examples}
            searchQuery={searchQuery}
            hydrateByPaths={hydrateByPaths}
            hydrateOnToggle={hydrateOnToggle}
          />
        </Details>
      ) : (
        <ExamplesListLink
          example={example}
          sourceLibraryID={sourceLibraryID}
          searchQuery={searchQuery}
        />
      )}
    </li>
  );
};

export default ExamplesListItem;
