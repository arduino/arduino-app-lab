import {
  AddBrick as AddBrickIcon,
  AddLibrary as AddLibraryIcon,
  CaretDown as CaretDownIcon,
  FileAdd as FileAddIcon,
  FolderAdd as FolderAddIcon,
} from '@cloud-editor-mono/images/assets/icons';
import {
  AddAppBrickDialog,
  AddSketchLibraryDialog,
  AddSketchLibraryDialogLogic,
  AppLabBrickItem,
  AppLabLibraryItem,
  Button,
  ButtonSize,
  ButtonType,
  ButtonVariant,
  DeleteAppBrickDialog,
  DropdownMenuButton,
  FileNode,
  FileTree,
  FileTreeApi,
  FolderNode,
  isFileNode,
  isFolderNode,
  SelectableFileData,
  TreeNode,
  useI18n,
  XXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import Split from 'react-split';
7;
import {
  AppDetailedInfo,
  BrickCreateUpdateRequest,
  BrickInstance,
  BrickListItem,
} from '@cloud-editor-mono/infrastructure';
import { useRef, useState } from 'react';
import { useMeasure } from 'react-use';

import { getAppLabFileIcon } from '../../../../common/utils';
import { AppsSection } from '../../../routes/__root';
import EditorFeat from '../../editor/Editor.feat';
import { EditorLogicParams } from '../../editor/editor.type';
import styles from '../app-detail.module.scss';
import { useAppFilesSectionLogic } from './AppFilesSection.logic';
import { appFilesMessages } from './messages';

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
  addAppBrick(brickId: string): Promise<boolean>;
  deleteAppBrick(brickId: string): Promise<boolean>;
  loadAppBrick(brickId: string): Promise<BrickInstance>;
  updateAppBrick(
    brickId: string,
    params: BrickCreateUpdateRequest,
  ): Promise<boolean>;
  editorLogicParams: EditorLogicParams;
  addFileHandler: (path: string) => Promise<void>;
  renameFileHandler: (path: string, newName: string) => Promise<void>;
  deleteFileHandler: (path: string) => Promise<void>;
  addSketchLibraryDialogLogic: AddSketchLibraryDialogLogic;
  openAddSketchLibraryDialog: () => void;
  deleteSketchLibrary: (libRef: string) => Promise<void>;
  addFolderHandler: (path: string) => Promise<void>;
}

const renderIcon = (node: TreeNode): JSX.Element => {
  const Icon = isFolderNode(node)
    ? getAppLabFileIcon('folder')
    : node.name === 'app.yaml'
    ? getAppLabFileIcon('config')
    : getAppLabFileIcon(node.extension.slice(1));

  return <Icon />;
};

const AppFilesSection: React.FC<AppFilesSection> = (props: AppFilesSection) => {
  const {
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
    loadAppBrick,
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
    appBricks,
    bricks,
    addAppBrick,
    deleteAppBrick,
    loadAppBrick,
    updateAppBrick,
    openExternalLink,
  });

  const MIN_PERCENT = 10;
  const MAX_PERCENT = 90;

  const [collapseBricks, setCollapseBricks] = useState(false);
  const [collapseLibraries, setCollapseLibraries] = useState(false);
  const [collapseFiles, setCollapseFiles] = useState(false);
  const [sidePanelSizes, setSidePanelSizes] = useState([
    MIN_PERCENT,
    MAX_PERCENT,
  ]);

  const { formatMessage } = useI18n();

  const isFullscreen = sidePanelSizes[0] < MIN_PERCENT / 4;

  // Omit the root folder
  const files =
    fileTree && fileTree[0] ? (fileTree[0] as FolderNode).children : undefined;

  const fileTreeRef = useRef<FileTreeApi>(null);

  const handleDragEnd = (newSizes: number[]): void => {
    const sidebarPercent = newSizes[0];
    if (sidebarPercent < MIN_PERCENT / 2) {
      setSidePanelSizes([0, 100]);
    } else if (sidebarPercent < MIN_PERCENT) {
      setSidePanelSizes([MIN_PERCENT, 100 - MIN_PERCENT]);
    } else if (sidebarPercent > 50) {
      setSidePanelSizes([50, 50]);
    }
  };

  return (
    <Split
      className={styles['split']}
      sizes={sidePanelSizes}
      minSize={section === 'my-apps' ? 28 : 210}
      expandToMin={true}
      onDrag={setSidePanelSizes}
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
        <div className={styles['app-bricks']}>
          <div className={styles['app-header']}>
            {!isFullscreen ? (
              <Button
                title={formatMessage(appFilesMessages.bricksLabel)}
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
              <Button
                bold
                title={formatMessage(appFilesMessages.addBrickButton)}
                onClick={openAddAppBrickDialog}
                type={ButtonType.Secondary}
                size={ButtonSize.XSmall}
                Icon={AddBrickIcon}
                variant={ButtonVariant.LowContrast}
                classes={{
                  button: styles['app-header-button'],
                }}
              />
            )}
          </div>
          {!collapseBricks && !isFullscreen && (
            <>
              {appBricks && appBricks.length > 0 && (
                <div className={styles['app-list']}>
                  {appBricks.map((brick) => (
                    <AppLabBrickItem
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
                <XXSmall className={styles['app-empty']}>
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
                title={formatMessage(appFilesMessages.sketchLibrariesLabel)}
                onClick={(): void => {
                  setCollapseLibraries((prev) => !prev);
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
                  {formatMessage(appFilesMessages.sketchLibrariesLabel)}
                </XXSmall>
              </Button>
            ) : null}
            {section === 'my-apps' && (
              <Button
                bold
                title={formatMessage(appFilesMessages.addSketchLibraryButton)}
                onClick={openAddSketchLibraryDialog}
                type={ButtonType.Secondary}
                size={ButtonSize.XSmall}
                Icon={AddLibraryIcon}
                variant={ButtonVariant.LowContrast}
                classes={{
                  button: styles['app-header-button'],
                }}
              />
            )}
          </div>
          {!collapseLibraries && !isFullscreen && (
            <>
              {appLibraries && appLibraries.length > 0 && (
                <div className={styles['app-list']}>
                  {appLibraries.map((lib) => (
                    <AppLabLibraryItem
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
              {appLibraries && !appLibraries.length && (
                <XXSmall className={styles['app-empty']}>
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
                title={formatMessage(appFilesMessages.filesLabel)}
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
              <DropdownMenuButton
                title={formatMessage(appFilesMessages.addFileButton)}
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
                onAction={(key): void =>
                  key === 'create-file'
                    ? fileTreeRef.current?.handleFileCreate()
                    : fileTreeRef.current?.handleFolderCreate()
                }
                onOpen={(): void => {
                  if (isFullscreen) {
                    setSidePanelSizes([MIN_PERCENT, MAX_PERCENT]);
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
                onFileRename={renameFileHandler}
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
