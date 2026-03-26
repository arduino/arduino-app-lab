import {
  AddBrick as AddBrickIcon,
  AddLibrary as AddLibraryIcon,
  CaretDown as CaretDownIcon,
  FileAdd as FileAddIcon,
  FolderAdd as FolderAddIcon,
} from '@cloud-editor-mono/images/assets/icons';
import {
  AppDetailedInfo,
  BrickCreateUpdateRequest,
  BrickInstance,
  BrickListItem,
} from '@cloud-editor-mono/infrastructure';
import {
  AddAppBrickDialog,
  AddSketchLibraryDialog,
  AddSketchLibraryDialogLogic,
  BrickItem,
  Button,
  ButtonSize,
  DeleteAppBrickDialog,
  DropdownMenuButton,
  FileNode,
  FileTree,
  FileTreeApi,
  FolderNode,
  IconButton,
  isFileNode,
  isFolderNode,
  LibraryItem,
  SelectableFileData,
  TreeNode,
  useI18n,
  useTooltip,
  XXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { get, set } from 'idb-keyval';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import Split from 'react-split';
import { useMeasure } from 'react-use';

import { getAppLabFileIcon } from '../../../../../common/utils';
import EditorFeat from '../../../editor/Editor.feat';
import { EditorLogicParams } from '../../../editor/editor.type';
import { AppsSection } from '../../app.type';
import styles from '../app-detail.module.scss';
import { appFilesMessages } from '../messages';
import { useAppFilesSectionLogic } from './AppFilesSection.logic';

interface AppFilesSection {
  app: AppDetailedInfo | undefined;
  appBricks: BrickInstance[] | undefined;
  bricks: BrickListItem[] | undefined;
  appLibraries?: Array<{ id: string; version: string }>;
  section: AppsSection;
  fileTree?: TreeNode[];
  selectedFile?: SelectableFileData;
  selectedNode?: FileNode;
  defaultOpenFoldersState: { [key: string]: boolean } | undefined;
  setSelectedFile: (id: string | TreeNode | undefined) => void;
  openFilesFolder: () => void;
  openExternal: () => void;
  openExternalLink: (url: string) => void;
  editorLogicParams: EditorLogicParams;
  addFileHandler: (path: string) => Promise<void>;
  renameFileHandler: (
    path: string,
    newName: string,
    appendExt?: boolean,
    nodeType?: 'file' | 'folder',
  ) => Promise<void>;
  deleteFileHandler: (path: string) => Promise<void>;
  addSketchLibraryDialogLogic: AddSketchLibraryDialogLogic;
  openAddSketchLibraryDialog: () => void;
  deleteSketchLibrary: (libRef: string) => Promise<void>;
  addFolderHandler: (path: string) => Promise<void>;

  addAppBrick(brickId: string): Promise<boolean>;
  deleteAppBrick(brickId: string): Promise<boolean>;
  updateAppBrick(
    brickId: string,
    params: BrickCreateUpdateRequest,
  ): Promise<boolean>;
}

interface SidePanelSizes {
  left: number;
  right: number;
}

const MIN_PERCENT = 10;
const MAX_PERCENT = 90;
const SIDE_PANEL_SIZES_INITIAL_VALUES = {
  left: MIN_PERCENT,
  right: MAX_PERCENT,
};

const renderIcon = (node: TreeNode): JSX.Element => {
  if (isFolderNode(node)) {
    return <></>; // No icon for folders, only caret will be shown
  }

  const Icon =
    node.name === 'app.yaml'
      ? getAppLabFileIcon('config')
      : getAppLabFileIcon(node.extension.slice(1));

  return <Icon />;
};

const AppFilesSection: React.FC<AppFilesSection> = (props: AppFilesSection) => {
  const {
    app,
    appBricks,
    bricks,
    appLibraries,
    section,
    fileTree,
    selectedFile,
    selectedNode,
    defaultOpenFoldersState,
    setSelectedFile,
    openExternalLink,
    addAppBrick,
    deleteAppBrick,
    updateAppBrick,
    editorLogicParams,
    addFileHandler,
    renameFileHandler,
    deleteFileHandler,
    addSketchLibraryDialogLogic,
    openAddSketchLibraryDialog,
    deleteSketchLibrary,
    addFolderHandler,
  } = props;

  const [ref, { height }] = useMeasure<HTMLDivElement>();
  const {
    addAppBrickDialogLogic,
    openAddAppBrickDialog,
    deleteAppBrickDialogLogic,
    openDeleteAppBrickDialog,
  } = useAppFilesSectionLogic({
    appId: app?.id ?? '',
    appBricks,
    bricks,
    addAppBrick,
    deleteAppBrick,
    updateAppBrick,
    openExternalLink,
  });

  const [collapseBricks, setCollapseBricks] = useState(false);
  const [collapseLibraries, setCollapseLibraries] = useState(false);
  const [collapseFiles, setCollapseFiles] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [sidePanelSizes, setSidePanelSizes] = useState<SidePanelSizes | null>(
    null,
  );

  const { formatMessage } = useI18n();

  const handleFileRename = useCallback(
    async (path: string, newName: string, nodeType?: 'file' | 'folder') => {
      await renameFileHandler(path, newName, false, nodeType);
    },
    [renameFileHandler],
  );

  const { props: addBrickTooltipProps, renderTooltip: renderAddBrickTooltip } =
    useTooltip({
      content: formatMessage(appFilesMessages.addBrickButton),
      direction: 'down',
      timeout: 0,
    });

  const {
    props: addLibraryTooltipProps,
    renderTooltip: renderAddLibraryTooltip,
  } = useTooltip({
    content: formatMessage(appFilesMessages.addSketchLibraryButton),
    direction: 'down',
    timeout: 0,
  });

  const {
    props: addFileTooltipProps,
    renderTooltip: renderAddFileTooltip,
    setShowTooltip: setShowAddFileTooltip,
  } = useTooltip({
    content: formatMessage(appFilesMessages.addFileButton),
    direction: 'down',
    timeout: 0,
  });

  const fileTreeRef = useRef<FileTreeApi>(null);

  // Omit the root folder
  const files =
    fileTree && fileTree[0] ? (fileTree[0] as FolderNode).children : undefined;

  const SIDE_PANEL_SIZES_STORAGE_KEY = `app-detail-${section}-side-panel-sizes`;

  const { refetch: getStoredSidePanelSizes } = useQuery(
    [SIDE_PANEL_SIZES_STORAGE_KEY],
    async () => get<SidePanelSizes>(SIDE_PANEL_SIZES_STORAGE_KEY),
    { enabled: false },
  );

  const { mutateAsync: setStoredSidePanelSizes } = useMutation({
    mutationFn: (sizes: SidePanelSizes) =>
      set(SIDE_PANEL_SIZES_STORAGE_KEY, sizes),
  });

  // initialize sidePanelSizes value
  useLayoutEffect(() => {
    const initSidePanelSizes = async (): Promise<void> => {
      const { data: storedSizes } = await getStoredSidePanelSizes();
      const initialSizes = storedSizes ?? {
        left: MIN_PERCENT,
        right: MAX_PERCENT,
      };
      setSidePanelSizes(initialSizes);
    };

    initSidePanelSizes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOnDrag = useCallback((sizes: number[]): void => {
    const [left, right] = sizes;
    setSidePanelSizes({ left, right });
  }, []);

  const handleDragEnd = useCallback(
    async (newSizes: number[]): Promise<void> => {
      const [left, right] = newSizes;
      const sidebarPercent = left;
      let sizes: SidePanelSizes;

      switch (true) {
        case sidebarPercent < MIN_PERCENT / 2:
          sizes = { left: 0, right: 100 };
          break;
        case sidebarPercent < MIN_PERCENT:
          sizes = { left: MIN_PERCENT, right: 100 - MIN_PERCENT };
          break;
        case sidebarPercent > 50:
          sizes = { left: 50, right: 50 };
          break;
        default: {
          sizes = { left, right };
        }
      }

      setSidePanelSizes(sizes);
      await setStoredSidePanelSizes(sizes);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const isFullscreen = sidePanelSizes && sidePanelSizes?.left < MIN_PERCENT / 4;

  if (!sidePanelSizes) {
    return null;
  }

  return (
    <Split
      className={styles['split']}
      sizes={[sidePanelSizes?.left, sidePanelSizes.right]}
      minSize={section === 'my-apps' ? 28 : 210}
      expandToMin={true}
      onDrag={handleOnDrag}
      onDragEnd={handleDragEnd}
      gutterSize={16}
      gutterAlign="center"
      snapOffset={30}
      direction="horizontal"
      cursor="col-resize"
      gutter={(): HTMLElement => {
        const element = document.createElement('div');
        element.className = styles['gutter'];
        return element;
      }}
    >
      <AddAppBrickDialog logic={addAppBrickDialogLogic} />
      <DeleteAppBrickDialog logic={deleteAppBrickDialogLogic} />
      <AddSketchLibraryDialog logic={addSketchLibraryDialogLogic} />
      <div
        className={clsx(styles['split-item-left'], {
          [styles['fullscreen']]: isFullscreen,
        })}
      >
        <div>
          <div className={styles['app-header']}>
            {!isFullscreen ? (
              <Button
                onClick={(): void => {
                  setCollapseBricks((prev) => !prev);
                }}
                size={ButtonSize.XXSmall}
                classes={{
                  button: clsx(
                    styles['app-header-title'],
                    collapseBricks && styles['collapsed'],
                  ),
                  textButtonText: styles['app-header-title-content'],
                }}
              >
                <CaretDownIcon className={styles['app-header-icon']} />
                <XXSmall className={styles['app-header-title-label']}>
                  {formatMessage(appFilesMessages.bricksLabel)}
                </XXSmall>
              </Button>
            ) : null}
            {section === 'my-apps' && (
              <div className={styles['tooltip']} {...addBrickTooltipProps}>
                <IconButton
                  classes={{ button: styles['app-header-button'] }}
                  Icon={AddBrickIcon}
                  onPress={openAddAppBrickDialog}
                  label={formatMessage(appFilesMessages.addBrickButton)}
                />
                {renderAddBrickTooltip(styles['tooltip-content--brick'])}
              </div>
            )}
          </div>
          {!collapseBricks && !isFullscreen && (
            <>
              {appBricks && appBricks.length > 0 && (
                <div className={styles['app-list']}>
                  {appBricks.map((brick) => (
                    <BrickItem
                      key={brick.id}
                      brick={brick}
                      selected={brick.id === selectedFile?.fileId}
                      onClick={(): void => setSelectedFile(brick.id ?? '')}
                      onDelete={
                        section === 'my-apps'
                          ? (): void => openDeleteAppBrickDialog(brick)
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
              {appBricks && !appBricks.length && (
                <XXSmall className={styles['app-empty']} truncate>
                  {formatMessage(appFilesMessages.noBricksAddedYet)}
                </XXSmall>
              )}
            </>
          )}
        </div>

        <div className={styles['app-libraries']}>
          <div className={styles['app-header']}>
            {!isFullscreen ? (
              <Button
                onClick={(): void => {
                  setCollapseLibraries((prev) => !prev);
                }}
                size={ButtonSize.XXSmall}
                classes={{
                  button: clsx(
                    styles['app-header-title'],
                    collapseLibraries && styles['collapsed'],
                  ),
                  textButtonText: styles['app-header-title-content'],
                }}
              >
                <CaretDownIcon className={styles['app-header-icon']} />
                <XXSmall className={styles['app-header-title-label']}>
                  {formatMessage(appFilesMessages.sketchLibrariesLabel)}
                </XXSmall>
              </Button>
            ) : null}
            {section === 'my-apps' && (
              <div className={styles['tooltip']} {...addLibraryTooltipProps}>
                <IconButton
                  classes={{ button: styles['app-header-button'] }}
                  Icon={AddLibraryIcon}
                  onPress={openAddSketchLibraryDialog}
                  label={formatMessage(appFilesMessages.addSketchLibraryButton)}
                />
                {renderAddLibraryTooltip(styles['tooltip-content--library'])}
              </div>
            )}
          </div>
          {!collapseLibraries && !isFullscreen && (
            <>
              {appLibraries && appLibraries.length > 0 && (
                <div className={styles['app-list']}>
                  {appLibraries.map((lib) => (
                    <LibraryItem
                      key={lib.id}
                      name={lib.id}
                      version={lib.version}
                      onDelete={
                        section === 'my-apps'
                          ? (): Promise<void> =>
                              deleteSketchLibrary(`${lib.id}@${lib.version}`)
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
              {(!appLibraries || !appLibraries.length) && (
                <XXSmall className={styles['app-empty']} truncate>
                  {formatMessage(appFilesMessages.noSketchLibrariesAddedYet)}
                </XXSmall>
              )}
            </>
          )}
        </div>

        <div className={styles['app-files']}>
          <div className={styles['app-header']}>
            {!isFullscreen ? (
              <Button
                //title={formatMessage(appFilesMessages.filesLabel)}
                onClick={(): void => {
                  setCollapseFiles((prev) => !prev);
                }}
                size={ButtonSize.XXSmall}
                classes={{
                  button: clsx(
                    styles['app-header-title'],
                    collapseFiles && styles['collapsed'],
                  ),
                  textButtonText: styles['app-header-title-content'],
                }}
              >
                <CaretDownIcon className={styles['app-header-icon']} />
                <XXSmall className={styles['app-header-title-label']}>
                  {formatMessage(appFilesMessages.filesLabel)}
                </XXSmall>
              </Button>
            ) : null}
            {section === 'my-apps' && (
              <div
                className={clsx(
                  styles['tooltip'],
                  isDropdownOpen && styles['dropdown-open'],
                )}
                {...addFileTooltipProps}
              >
                <DropdownMenuButton
                  sections={[
                    {
                      name: 'Actions',
                      items: [
                        {
                          id: 'create-file',
                          label: 'Create file',
                          labelPrefix: <FileAddIcon />,
                        },
                        {
                          id: 'create-folder',
                          label: 'Create new folder',
                          labelPrefix: <FolderAddIcon />,
                        },
                      ],
                    },
                  ]}
                  buttonChildren={<FileAddIcon />}
                  onAction={(key): void => {
                    setShowAddFileTooltip(false);

                    key === 'create-file'
                      ? fileTreeRef.current?.handleFileCreate()
                      : fileTreeRef.current?.handleFolderCreate();
                  }}
                  onOpen={(isOpen): void => {
                    if (isOpen) {
                      setIsDropdownOpen(true);
                      if (isFullscreen) {
                        setSidePanelSizes(SIDE_PANEL_SIZES_INITIAL_VALUES);
                      }
                    } else {
                      setIsDropdownOpen(false);
                    }
                  }}
                  classes={{
                    dropdownMenu: styles['app-header-button-menu'],
                    dropdownMenuButton: styles['app-header-button'],
                    dropdownMenuButtonWrapper:
                      styles['app-header-button-wrapper'],
                    dropdownMenuItem: styles['app-header-button-menu-item'],
                  }}
                />
                {renderAddFileTooltip(styles['tooltip-content--file'])}
              </div>
            )}
          </div>

          {!collapseFiles && !isFullscreen && (
            <div ref={ref} className={styles['app-list']}>
              <FileTree
                ref={fileTreeRef}
                height={height}
                nodes={files}
                selectedNode={selectedNode}
                selectedFileChange={setSelectedFile}
                defaultOpenFoldersState={defaultOpenFoldersState}
                onFileCreate={addFileHandler}
                onFileRename={handleFileRename}
                onFileDelete={deleteFileHandler}
                onFolderCreate={addFolderHandler}
                isReadOnly={section !== 'my-apps'}
                isBricksSelected={selectedFile?.fileExtension === 'brick'}
                renderNodeIcon={renderIcon}
              />
            </div>
          )}
        </div>
      </div>
      <div className={clsx(styles['split-item'], styles['split-item-right'])}>
        {((selectedNode && isFileNode(selectedNode)) ||
          selectedFile?.fileExtension === 'brick') && (
          <EditorFeat editorLogicParams={editorLogicParams} />
        )}
      </div>
    </Split>
  );
};

export default AppFilesSection;
