import { FileTypeIno, ThreeDots } from '@cloud-editor-mono/images/assets/icons';
import { defaultStringifySearch } from '@tanstack/react-location';
import { QueryKey } from '@tanstack/react-query';
import {
  Key,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useButton } from 'react-aria';

import { DropdownMenuButton } from '../../../essential/dropdown-menu/DropdownMenuButton';
import { Link, XSmall } from '../../../typography';
import { SidenavContext } from '../../context/sidenavContext';
import { Example, ExamplesMenuItemIds } from '../../sidenav.type';
import styles from './examples.module.scss';
import { examplesMenuSections } from './examplesSpec';
import { useHighlightText } from './hooks/useHighlightText';

interface ExamplesListLinkProps {
  example: Example;
  sourceLibraryID?: string;
  customLibraryID?: string;
  searchQuery?: string;
}

const ExamplesListLink: React.FC<ExamplesListLinkProps> = (
  props: ExamplesListLinkProps,
) => {
  const { sourceLibraryID, customLibraryID, example, searchQuery } = props;
  const {
    isExampleSketchContext,
    getExampleLinkSearch,
    onExampleLinkInteract,
    exampleLinkToPath: linkTo,
    examplesMenuHandlers,
    getExampleFileContents,
    getCustomLibrary,
    bypassOrgHeader,
    onPrivateResourceRequestError,
    getCustomLibraryExamplesByFolder,
  } = useContext(SidenavContext);

  const [downloadRequested, setDownloadRequested] = useState(false);

  const ref = useRef<HTMLLinkElement>(null);
  const { buttonProps } = useButton(
    {
      onPress: onExampleLinkInteract,
    },
    ref,
  );

  const search = getExampleLinkSearch(
    example.path,
    sourceLibraryID,
    customLibraryID,
  );

  const isExampleSketch = isExampleSketchContext();

  const exampleName = useHighlightText(example.name, searchQuery ?? '');

  const exampleFiles = [example.ino, ...(example.files ?? [])];

  const customLibraryExampleKey: QueryKey = useMemo(
    () => ['get-custom-library-examples', example.path, bypassOrgHeader],
    [example.path, bypassOrgHeader],
  );
  const { filesList: customLibraryExampleFileContents } = getCustomLibrary(
    customLibraryExampleKey,
    !!customLibraryID,
    bypassOrgHeader,
    onPrivateResourceRequestError,
    example.path,
    true,
  );

  const customLibraryExamplesListByFolder = getCustomLibraryExamplesByFolder(
    customLibraryExampleFileContents ?? [],
  );

  const exampleFromCustomLibrary = useMemo(
    () =>
      customLibraryExamplesListByFolder.find(
        (customLibraryExample) => customLibraryExample.path === example.path,
      ),
    [customLibraryExamplesListByFolder, example.path],
  ) as Example;

  const customExampleFiles = [
    exampleFromCustomLibrary?.ino ?? undefined,
    ...(exampleFromCustomLibrary?.files ?? []),
  ];

  const files = customLibraryID ? customExampleFiles : exampleFiles;

  const { exampleFileContents, allContentsRetrieved, refetchAll } =
    getExampleFileContents(false, undefined, example.path, files);

  useEffect(() => {
    if (allContentsRetrieved && downloadRequested && exampleFileContents) {
      examplesMenuHandlers[ExamplesMenuItemIds.Download](
        example.path,
        exampleFileContents,
      );
      setDownloadRequested(false);
    }
  }, [
    allContentsRetrieved,
    downloadRequested,
    example.path,
    exampleFileContents,
    examplesMenuHandlers,
  ]);

  const menuAction = useCallback(
    (key: Key): void => {
      if (key === ExamplesMenuItemIds.CopyInYourSketches) {
        examplesMenuHandlers[ExamplesMenuItemIds.CopyInYourSketches](
          example.path,
          sourceLibraryID,
          customLibraryID,
        );
      } else if (key === ExamplesMenuItemIds.Download) {
        setDownloadRequested(() => {
          refetchAll();
          return true;
        });
      }
    },
    [
      examplesMenuHandlers,
      example.path,
      sourceLibraryID,
      customLibraryID,
      refetchAll,
    ],
  );

  return (
    <div className={styles['examples-link-wrapper']}>
      <Link
        {...buttonProps}
        id={example.path}
        className={styles['examples-link']}
        target={isExampleSketch ? undefined : `_blank`}
        href={`${linkTo}${defaultStringifySearch(search)}`}
      >
        <div className={styles['examples-icon']}>
          <FileTypeIno />
        </div>
        <XSmall title={example.name}>{exampleName}</XSmall>
      </Link>
      <DropdownMenuButton
        buttonChildren={<ThreeDots />}
        sections={examplesMenuSections}
        onAction={menuAction}
        classes={{
          dropdownMenuButtonWrapper: styles['examples-menu-button-wrapper'],
          dropdownMenuButton: styles['examples-menu-button'],
          dropdownMenuButtonOpen: styles['examples-menu-button-open'],
          dropdownMenu: styles['examples-menu'],
        }}
      />
    </div>
  );
};

export default ExamplesListLink;
