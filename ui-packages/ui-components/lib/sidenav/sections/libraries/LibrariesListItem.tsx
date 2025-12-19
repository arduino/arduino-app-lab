import {
  ArduinoLoop,
  Checkmark,
  Puzzle,
  SelectArrow,
  ThreeDots,
  UserCommunity,
} from '@cloud-editor-mono/images/assets/icons';
import { IsFavoriteLibrary } from '@cloud-editor-mono/infrastructure';
import { QueryKey } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  forwardRef,
  Key,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePrevious } from 'react-use';

import { Button } from '../../../essential/button';
import { Details } from '../../../essential/details';
import { DropdownMenuSectionType } from '../../../essential/dropdown-menu';
import DropdownMenuButton from '../../../essential/dropdown-menu/DropdownMenuButton';
import { FavoriteButton } from '../../../essential/favorite-button';
import { useI18n } from '../../../i18n/useI18n';
import { useTooltip } from '../../../tooltip';
import { Link, TextSize, XSmall, XXSmall } from '../../../typography';
import { SidenavContext } from '../../context/sidenavContext';
import { messages } from '../../messages';
import { ExamplesFolder, LibraryMenuHandlersIds } from '../../sidenav.type';
import ExamplesList from '../examples/ExamplesList';
import ExamplesListItemSkeleton from '../examples/ExamplesListItemSkeleton';
import styles from './libraries.module.scss';
import {
  LibraryListItemProps,
  LibraryWithActionVersion,
  Versions,
  VersionSelection,
} from './librariesListItem.type';
import { libraryItemMessages } from './messages';
import {
  ARDUINO_LIB_TYPE_STRING,
  createDefaultVersionGroupName,
  createDefaultVersionLabel,
  createLibraryIdFromMetadata,
  createLibraryVersionId,
  createOtherVersionsGroupName,
} from './utils';

const LibrariesListItem = forwardRef((props: LibraryListItemProps, ref) => {
  const {
    isCustom,
    standardLibrary,
    customLibrary,
    libraryMenuHandlers,
    index,
    getLibraryDetails,
    pinnedVersion,
    onClickInclude,
    setFavorite,
    disableVersionSelect,
    onHeightChange,
    containerStyle,
    hydrateExamplesByPaths,
  } = props;

  const {
    getCurrentResourceIds,
    getExamplesByFolder,
    getCustomLibraryExamplesByFolder,
    bypassOrgHeader,
    onPrivateResourceRequestError,
    showMoreInfoLinks,
  } = useContext(SidenavContext);
  const { exampleID } = getCurrentResourceIds();
  const { formatMessage } = useI18n();

  const { props: tooltipProps, renderTooltip } = useTooltip({
    title: formatMessage(libraryItemMessages.includeDisabledTitle),
    content: formatMessage(libraryItemMessages.includeDisabledContent),
    direction: 'up',
  });

  const customLibIncludeDisabled = isCustom && !customLibrary.code;
  const customLibraryExamplesKey: QueryKey = useMemo(
    () => ['get-custom-library-examples', customLibrary?.path, bypassOrgHeader],
    [customLibrary?.path, bypassOrgHeader],
  );

  const customLibrariesFiles = isCustom
    ? getLibraryDetails(
        customLibraryExamplesKey,
        (customLibrary.path !== undefined &&
          exampleID?.includes(customLibrary.path)) ??
          false,
        bypassOrgHeader,
        onPrivateResourceRequestError,
        `${customLibrary?.path}/examples`,
        true,
      )
    : undefined;
  const customLibraryExamples = customLibrariesFiles?.filesList;
  const customLibraryExamplesRefetch = customLibrariesFiles?.refetch;
  const customLibraryExamplesIsLoading =
    customLibrariesFiles?.getFilesIsLoading;

  const customLibraryExamplesByFolder = getCustomLibraryExamplesByFolder(
    customLibraryExamples ?? [],
  );

  const pinnedVersionData: VersionSelection | undefined = useMemo(
    () =>
      !isCustom && pinnedVersion
        ? {
            originalId: createLibraryIdFromMetadata(
              standardLibrary.id,
              pinnedVersion,
            ),
            id: createLibraryVersionId(standardLibrary.id, pinnedVersion),
            label: pinnedVersion,
            version: pinnedVersion,
          }
        : undefined,
    [isCustom, pinnedVersion, standardLibrary],
  );

  const defaultVersionData: VersionSelection | undefined = useMemo(
    () =>
      !isCustom
        ? {
            originalId: createLibraryIdFromMetadata(
              standardLibrary.id,
              standardLibrary.version,
            ),
            id: createLibraryVersionId(
              standardLibrary.id,
              standardLibrary.version,
              true,
            ),
            label: createDefaultVersionLabel(
              formatMessage(libraryItemMessages.latestVersionPrefix),
              standardLibrary.version,
            ),
            version: standardLibrary.version,
          }
        : undefined,
    [formatMessage, isCustom, standardLibrary],
  );

  const [selectedVersion, setSelectedVersion] = useState<
    VersionSelection | undefined
  >(pinnedVersionData || defaultVersionData);

  const [getLibraryDetailsId, setGetLibraryDetailsId] = useState<
    string | undefined
  >(pinnedVersionData?.originalId || defaultVersionData?.originalId);

  const details =
    !isCustom && getLibraryDetailsId
      ? getLibraryDetails({ id: getLibraryDetailsId }, false)
      : undefined;

  const refetch = details?.refetch;

  useEffect(() => {
    if (
      (getLibraryDetailsId !== defaultVersionData?.originalId &&
        getLibraryDetailsId !== pinnedVersionData?.originalId) ||
      pinnedVersion
    ) {
      refetch && refetch();
    }
  }, [
    defaultVersionData?.originalId,
    getLibraryDetailsId,
    pinnedVersion,
    pinnedVersionData?.originalId,
    refetch,
  ]);

  const libraryWithDetails = details?.library;
  const libraryWithDetailsIsLoading = details?.isLoading;

  const versions: Versions = useMemo(() => {
    if (disableVersionSelect) return [];

    const otherVersions =
      libraryWithDetails?.otherVersions ?? standardLibrary?.otherVersions ?? [];

    const versionsGroups: Versions = !isCustom
      ? [
          {
            name: createDefaultVersionGroupName(standardLibrary?.id),
            items: [
              {
                originalId: defaultVersionData?.originalId as string, // es. "lvgl@9.4.0"
                id: defaultVersionData?.id as string,
                label: defaultVersionData?.label as string,
                value: defaultVersionData?.version as string,
                itemClassName: clsx(styles['item-default-version'], {
                  [styles['item-solo-default-version']]:
                    !otherVersions || otherVersions.length === 0,
                }),
              },
            ],
          },
        ]
      : [];

    const otherVersionsGroup: Versions[number] | undefined = !isCustom
      ? {
          name: createOtherVersionsGroupName(standardLibrary.id),
          items: [],
        }
      : undefined;

    if (!isCustom && otherVersions?.length && otherVersionsGroup) {
      otherVersionsGroup.items = otherVersions.map((otherVersion: string) => {
        const vid = createLibraryVersionId(standardLibrary.id, otherVersion);
        const isIncluded = pinnedVersionData && pinnedVersionData.id === vid;
        const isSelected = vid === selectedVersion?.id;

        return {
          originalId: createLibraryIdFromMetadata(
            standardLibrary.name,
            otherVersion, // "lvgl@9.2.2"
          ),
          id: vid,
          label: isIncluded
            ? `${formatMessage(
                libraryItemMessages.includedVersionPrefix,
              )} ${otherVersion}`
            : otherVersion,
          value: otherVersion,
          labelPrefix: isSelected ? (
            <Checkmark
              className={clsx(
                styles['item-selected-icon'],
                styles['color-primary'],
              )}
            />
          ) : null,
          itemClassName: clsx({
            [styles['item-selected-version']]: isSelected,
            [styles['item-included-version']]: isIncluded,
          }),
        };
      });
    }

    if (otherVersionsGroup && otherVersionsGroup.items.length > 0) {
      versionsGroups.push(otherVersionsGroup);
    }

    return versionsGroups;
  }, [
    defaultVersionData,
    disableVersionSelect,
    formatMessage,
    isCustom,
    libraryWithDetails,
    pinnedVersionData,
    selectedVersion,
    standardLibrary,
  ]);

  const contextMenu: DropdownMenuSectionType<string, string>[] = useMemo(() => {
    let libraryOptions: DropdownMenuSectionType<string, string>['items'] = [];
    if (standardLibrary && !customLibrary) {
      libraryOptions = [
        {
          id: LibraryMenuHandlersIds.CopyAndModify,
          label: formatMessage(messages.copyAndModifyLibrary),
          itemClassName: styles['library-option'],
        },
        {
          id: LibraryMenuHandlersIds.Download,
          label: formatMessage(messages.downloadLibrary),
          itemClassName: styles['library-option'],
        },
      ];
    } else if (standardLibrary && customLibrary) {
      libraryOptions = [
        {
          id: LibraryMenuHandlersIds.Modify,
          label: formatMessage(messages.modifyLibrary),
          itemClassName: styles['library-option'],
        },
        {
          id: LibraryMenuHandlersIds.Download,
          label: formatMessage(messages.downloadLibrary),
          itemClassName: styles['library-option'],
        },
      ];
    } else if (!standardLibrary && customLibrary) {
      libraryOptions = [
        {
          id: LibraryMenuHandlersIds.Modify,
          label: formatMessage(messages.modifyLibrary),
          itemClassName: styles['library-option'],
        },
        {
          id: LibraryMenuHandlersIds.Delete,
          label: formatMessage(messages.deleteLibrary),
          itemClassName: clsx(styles['library-option'], styles.warning),
        },
        {
          id: LibraryMenuHandlersIds.Download,
          label: formatMessage(messages.downloadLibrary),
          itemClassName: styles['library-option'],
        },
      ];
    }

    return [{ name: 'library-options', items: libraryOptions }];
  }, [customLibrary, formatMessage, standardLibrary]);

  const [examplesExpanded, setExamplesExpanded] = useState(false);

  const prevExamplesExpanded = usePrevious(examplesExpanded);
  const prevLibraryExamples = usePrevious(libraryWithDetails?.examples);

  const { examples = [] } = libraryWithDetails || {};

  const examplesByFolder = getExamplesByFolder(examples);
  const lastReleaseIdRef = useRef<string | undefined>(undefined);

  const currentReleaseId =
    selectedVersion?.version && standardLibrary?.id
      ? `${standardLibrary.id}@${selectedVersion.version}`
      : undefined;

  useEffect(() => {
    if (currentReleaseId !== lastReleaseIdRef.current) {
      lastReleaseIdRef.current = currentReleaseId;
    }
  }, [currentReleaseId]);

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

  const toggleExamplesExpanded = useCallback(() => {
    setExamplesExpanded((prev) => {
      if (
        !isCustom &&
        !prev &&
        standardLibrary.examplesNumber > 0 &&
        !libraryWithDetails &&
        refetch
      ) {
        refetch();
      } else if (
        isCustom &&
        !prev &&
        customLibrary?.examplesChildren &&
        customLibrary?.examplesChildren > 0 &&
        !customLibraryExamples &&
        customLibraryExamplesRefetch
      ) {
        customLibraryExamplesRefetch();
      }
      return !prev;
    });
  }, [
    customLibrary,
    customLibraryExamplesRefetch,
    isCustom,
    libraryWithDetails,
    refetch,
    standardLibrary?.examplesNumber,
    customLibraryExamples,
  ]);
  const TypeIcon = isCustom
    ? Puzzle
    : standardLibrary?.types.includes(ARDUINO_LIB_TYPE_STRING)
    ? ArduinoLoop
    : UserCommunity;

  const handleFavoriteClick = useCallback((): void => {
    if (!isCustom && standardLibrary.isFavorite !== IsFavoriteLibrary.Unknown) {
      const asFavorite = standardLibrary.isFavorite === IsFavoriteLibrary.No;
      setFavorite(standardLibrary, asFavorite);
    }
  }, [isCustom, setFavorite, standardLibrary]);

  const handleLibraryOptionClick = useCallback(
    (key: Key) => {
      switch (key) {
        //passing releaseId to the handler
        case LibraryMenuHandlersIds.CopyAndModify: {
          if (!standardLibrary) break;
          const releaseId = `${standardLibrary.id}@${
            selectedVersion?.version ?? standardLibrary.version
          }`;
          const payload: LibraryWithActionVersion = {
            ...standardLibrary,
            __releaseId: releaseId,
          };
          libraryMenuHandlers[key](payload);
          break;
        }
        case LibraryMenuHandlersIds.Modify:
          customLibrary && libraryMenuHandlers[key](customLibrary);
          break;

        case LibraryMenuHandlersIds.Delete:
          customLibrary && libraryMenuHandlers[key](customLibrary);
          break;

        case LibraryMenuHandlersIds.Download: {
          if (standardLibrary) {
            const versionForDownload =
              selectedVersion?.version ?? standardLibrary.version;

            libraryMenuHandlers[key]({
              ...standardLibrary,
              __versionForDownload: versionForDownload,
            });
          } else if (customLibrary) {
            libraryMenuHandlers[key](customLibrary);
          }
          break;
        }
      }
    },
    [
      customLibrary,
      libraryMenuHandlers,
      selectedVersion?.version,
      standardLibrary,
    ],
  );

  const handleVersionClick = useCallback(
    (key: Key) => {
      if (key === defaultVersionData?.id) {
        setSelectedVersion(defaultVersionData);
        setGetLibraryDetailsId(defaultVersionData.originalId); // "name@<current>"
        return;
      }

      const selection =
        standardLibrary &&
        versions
          .find(
            (group) =>
              group.name === createOtherVersionsGroupName(standardLibrary.id),
          )
          ?.items.find((v) => v.id === key);

      if (selection) {
        const isPinned =
          pinnedVersionData && pinnedVersionData.id === selection.id;

        setSelectedVersion({
          originalId: selection.originalId,
          id: selection.id,
          label: isPinned
            ? selection.value || selection.label
            : selection.label,
          version: selection.value || selection.label,
        });
        setGetLibraryDetailsId(selection.originalId); // "name@x.y.z"
      }
    },
    [defaultVersionData, pinnedVersionData, standardLibrary, versions],
  );

  const handleClickInclude = useCallback(() => {
    if (onClickInclude) {
      if (isCustom) {
        if (customLibrary.code && customLibrary.name) {
          onClickInclude(customLibrary.code, { name: customLibrary.name });
        } else {
          throw new Error('Missing custom library data');
        }
      } else {
        if (!pinnedVersion && selectedVersion?.id === defaultVersionData?.id) {
          onClickInclude(standardLibrary.code);
          return;
        }
        if (selectedVersion?.id === defaultVersionData?.id) {
          onClickInclude(standardLibrary.code, { name: standardLibrary.name });
          return;
        }
        onClickInclude(details?.library?.code || standardLibrary.code, {
          name: standardLibrary.name,
          version: selectedVersion?.version,
        });
      }
    }
  }, [
    customLibrary,
    defaultVersionData?.id,
    details?.library?.code,
    isCustom,
    onClickInclude,
    pinnedVersion,
    selectedVersion?.id,
    selectedVersion?.version,
    standardLibrary,
  ]);

  const handleClickDropdownMenuButton = useCallback(() => {
    const otherVersions =
      libraryWithDetails?.otherVersions ?? standardLibrary?.otherVersions ?? [];

    if (!otherVersions && refetch) {
      refetch();
    }
  }, [libraryWithDetails, refetch, standardLibrary]);

  return (
    <div
      style={containerStyle}
      className={styles['libraries-list-item-container']}
    >
      <li
        ref={ref as (instance: HTMLLIElement | null) => void}
        className={styles['libraries-list-item']}
      >
        <div className={styles['library-title-container']}>
          <div className={styles['library-name-container']}>
            <TypeIcon className={styles['library-maintainer-icon']} />
            <XSmall
              bold
              title={standardLibrary?.name || customLibrary?.name}
              className={styles['library-name']}
            >
              {standardLibrary?.name || customLibrary?.name}
            </XSmall>
          </div>
          <div className={styles['library-options-container']}>
            {!isCustom &&
            standardLibrary.isFavorite !== IsFavoriteLibrary.Unknown ? (
              <div className={styles['library-options']}>
                <FavoriteButton
                  isFilled={
                    standardLibrary.isFavorite === IsFavoriteLibrary.Yes
                  }
                  onClick={handleFavoriteClick}
                  addLabel={formatMessage(messages.addLibraryToFavorite)}
                  removeLabel={formatMessage(
                    messages.removeLibraryFromFavorite,
                  )}
                  classes={{ icon: styles['library-favorite-icon'] }}
                />
              </div>
            ) : null}
            <DropdownMenuButton
              buttonChildren={<ThreeDots />}
              classes={{
                dropdownMenuButtonWrapper: clsx(
                  styles['library-option-button-wrapper'],
                ),
              }}
              sections={contextMenu}
              onAction={handleLibraryOptionClick}
            />
          </div>
        </div>

        {!isCustom && (
          <XXSmall
            truncate
            title={standardLibrary.maintainer}
            className={styles['library-maintainer']}
          >
            {standardLibrary.maintainer}
          </XXSmall>
        )}
        <XXSmall className={styles['library-description']}>
          {standardLibrary?.sentence || customLibrary?.properties?.sentence}
        </XXSmall>
        {(standardLibrary?.url || customLibrary?.properties?.url) &&
        showMoreInfoLinks ? (
          <Link href={standardLibrary?.url || customLibrary?.properties?.url}>
            {formatMessage(messages.moreInfo)}
          </Link>
        ) : null}

        <div
          className={clsx(
            styles['item-buttons-container'],
            isCustom && styles['item-buttons-container-custom'],
          )}
        >
          {!isCustom ? (
            <DropdownMenuButton
              buttonChildren={
                <>
                  {selectedVersion?.id !== defaultVersionData?.id ? (
                    <Checkmark className={styles['color-primary']} />
                  ) : null}
                  <XXSmall>
                    {selectedVersion?.id !== defaultVersionData?.id
                      ? `v. ${selectedVersion?.label}`
                      : selectedVersion?.label}
                  </XXSmall>
                  <SelectArrow />
                </>
              }
              sections={versions}
              classes={{
                dropdownMenuButtonWrapper:
                  styles['item-version-button-wrapper'],
                dropdownMenuButton: clsx(styles['item-version-button'], {
                  [styles['item-version-button-pinned']]:
                    (pinnedVersionData &&
                      selectedVersion?.id === pinnedVersionData.id) ||
                    disableVersionSelect,
                  [styles['item-version-button-disabled']]:
                    disableVersionSelect,
                }),
                dropdownMenu: styles['item-version-menu'],
                dropdownMenuItem: styles['item-version'],
              }}
              onAction={handleVersionClick}
              onOpen={handleClickDropdownMenuButton}
              useStaticPosition={false}
            />
          ) : null}

          <div className={styles['include-button-wrapper']}>
            <Button
              size={TextSize.XSmall}
              classes={{
                button: customLibIncludeDisabled
                  ? styles['include-button-disabled']
                  : styles['include-button'],
              }}
              onClick={customLibIncludeDisabled ? () => {} : handleClickInclude}
              {...(customLibIncludeDisabled && tooltipProps)}
            >
              {formatMessage(messages.includeLibraryButton)}
            </Button>
            {customLibIncludeDisabled && renderTooltip()}
          </div>
        </div>

        {(!isCustom && standardLibrary.examplesNumber > 0) ||
        (isCustom &&
          customLibrary?.examplesChildren &&
          customLibrary?.examplesChildren > 0) ? (
          <Details
            isOpen={
              examplesExpanded ||
              (typeof exampleID === 'string' &&
                (libraryWithDetails?.examples?.some(
                  (example) => example.path === exampleID,
                ) ||
                  (customLibrary?.path !== undefined &&
                    exampleID?.includes(customLibrary.path))))
            }
            onToggle={toggleExamplesExpanded}
            summaryNode={formatMessage(messages.examplesInLibrariesLabel)}
            chevronPosition="left"
          >
            {(customLibraryExamplesIsLoading && isCustom) ||
            (libraryWithDetailsIsLoading && !isCustom) ? (
              <ExamplesListItemSkeleton count={1} />
            ) : isCustom ? (
              <ExamplesList
                items={customLibraryExamplesByFolder}
                customLibraryID={customLibrary?.name}
                hydrateByPaths={hydrateExamplesByPaths}
                hydrateOnToggle={false}
              />
            ) : (
              examplesByFolder.map((item: ExamplesFolder) => (
                <ExamplesList
                  key={item.name}
                  items={item.examples}
                  sourceLibraryID={`${standardLibrary.id}@${standardLibrary.version}`}
                  index={index}
                  onHeightChange={onHeightChange}
                  hydrateByPaths={hydrateExamplesByPaths}
                  hydrateOnToggle={false}
                />
              ))
            )}
          </Details>
        ) : null}
      </li>
    </div>
  );
});

LibrariesListItem.displayName = 'LibrariesListItem';
export default LibrariesListItem;
