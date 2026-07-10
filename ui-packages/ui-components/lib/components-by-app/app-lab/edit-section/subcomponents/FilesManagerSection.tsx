import {
  AddBrick as AddBrickIcon,
  AddLibrary as AddLibraryIcon,
  CaretDown as CaretDownIcon,
  FileAdd as FileAddIcon,
  FolderAdd as FolderAddIcon,
  Sidebar as SidebarIcon,
  UploadFolder,
  UploadLight,
} from '@cloud-editor-mono/images/assets/icons';
import {
  AddAppBrickDialog,
  AddSketchLibraryDialog,
  BrickItem,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
  DeleteAppBrickDialog,
  DropdownMenuButton,
  DuplicateFileDialog,
  FileTree,
  FileTreeApi,
  FolderNode,
  IconButton,
  ImportResourceDialog,
  LibraryItem,
  useI18n,
  XXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useCallback, useRef, useState } from 'react';
import { useMeasure } from 'react-use';

import { CustomBrickDialog } from '../../../../dialogs/app-lab/add-app-brick-dialog/sub-components/CustomBrickDialog';
import styles from '../app-lab-edit-section.module.scss';
import { useAppFilesSectionLogic } from '../appFiles';
import { FilesManagerSectionLogic } from '../appLabEditSection.type';
import { messages } from '../messages';

interface FilesManagerSectionProps {
  logic: FilesManagerSectionLogic;
  isCollapsed: boolean;
  toggleCollapsed: () => void;
}

export const FilesManagerSection = ({
  logic,
  isCollapsed,
  toggleCollapsed,
}: FilesManagerSectionProps): JSX.Element => {
  const {
    app,
    appBricks,
    bricks,
    appLibraries,
    section,
    fileTree,
    selectedFile,
    selectedNode,
    selectedFolder,
    defaultOpenFoldersState,
    setSelectedFile,
    setSelectedFolder,
    openExternalLink,
    addFileHandler,
    renameFileHandler,
    deleteFileHandler,
    addSketchLibraryDialogLogic,
    openAddSketchLibraryDialog,
    deleteSketchLibrary,
    addFolderHandler,
    addAppBrick,
    deleteAppBrick,
    updateAppBrick,
    renderIcon,
    brickDetailLogic,
    configureAppBrickDialogLogic,
    addAppCustomBrick,
    renameAppCustomBrick,
    moveFileHandler,
    updateOpenFile,
    appLabEditorPanelLogic,
    onDuplicateConflict,
    duplicateFileDialogLogic,
    importFileDialogLogic,
    openImportFileDialog,
    onMoveBlocked,
    onFileDragStart,
    onBrickDragStart,
    onBrickDragEnd,
    onDragOverFolderChange,
  } = logic();
  const { openFiles } = appLabEditorPanelLogic();

  const { formatMessage } = useI18n();
  const [ref, { height }] = useMeasure<HTMLDivElement>();

  const [collapseBricks, setCollapseBricks] = useState(false);
  const [collapseLibraries, setCollapseLibraries] = useState(false);
  const [collapseFiles, setCollapseFiles] = useState(false);

  const handleFileRename = useCallback(
    async (path: string, newName: string, nodeType?: 'file' | 'folder') => {
      await renameFileHandler(path, newName, false, nodeType);
    },
    [renameFileHandler],
  );

  const fileTreeRef = useRef<FileTreeApi>(null);
  const fileTreeContainerRef = useRef<HTMLDivElement>(null);

  // Omit the root folder
  const files =
    fileTree && fileTree[0] ? (fileTree[0] as FolderNode).children : undefined;

  const {
    addAppBrickDialogLogic,
    openAddAppBrickDialog,
    deleteAppBrickDialogLogic,
    openDeleteAppBrickDialog,
    renameAppBrickDialogLogic,
    openRenameAppBrickDialog,
  } = useAppFilesSectionLogic({
    appId: app?.id ?? '',
    appBricks,
    bricks,
    addAppBrick,
    deleteAppBrick,
    updateAppBrick,
    openExternalLink,
    brickDetailLogic,
    configureAppBrickDialogLogic,
    addAppCustomBrick,
    renameAppCustomBrick,
  });

  return (
    <>
      <AddAppBrickDialog logic={addAppBrickDialogLogic} />
      <DeleteAppBrickDialog logic={deleteAppBrickDialogLogic} />
      <AddSketchLibraryDialog logic={addSketchLibraryDialogLogic} />
      <CustomBrickDialog logic={renameAppBrickDialogLogic} />
      <ImportResourceDialog logic={importFileDialogLogic} />

      <div
        className={clsx(styles['sidebar'], {
          [styles['collapsed']]: isCollapsed,
        })}
      >
        <div
          className={clsx(styles['actions'], {
            [styles['actions-collapsed']]: isCollapsed,
          })}
        >
          <IconButton
            size={ButtonSize.XSmall}
            variant={ButtonVariant.Secondary}
            appearance={ButtonAppearance.LowContrast}
            Icon={AddBrickIcon}
            label={
              section !== 'my-apps'
                ? formatMessage(messages.exampleReadonly)
                : formatMessage(messages.addBrickButton)
            }
            onClick={openAddAppBrickDialog}
            disabled={section !== 'my-apps'}
          />

          <IconButton
            size={ButtonSize.XSmall}
            variant={ButtonVariant.Secondary}
            appearance={ButtonAppearance.LowContrast}
            Icon={AddLibraryIcon}
            label={
              section !== 'my-apps'
                ? formatMessage(messages.exampleReadonly)
                : formatMessage(messages.addSketchLibraryButton)
            }
            onClick={openAddSketchLibraryDialog}
            disabled={section !== 'my-apps'}
          />
          <DropdownMenuButton
            sections={[
              {
                name: 'Create Actions',
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
              {
                name: 'Import  Actions',
                items: [
                  {
                    id: 'import-file',
                    label: 'Import file',
                    labelPrefix: <UploadLight />,
                  },
                  {
                    id: 'import-folder',
                    label: 'Import folder',
                    labelPrefix: <UploadFolder />,
                  },
                ],
              },
            ]}
            buttonChildren={(
              buttonProps,
              buttonRef,
              isOpen,
            ): React.ReactNode => (
              <IconButton
                {...buttonProps}
                ref={buttonRef}
                classes={{ container: styles['action-button'] }}
                size={ButtonSize.XSmall}
                variant={ButtonVariant.Secondary}
                appearance={ButtonAppearance.LowContrast}
                Icon={FileAddIcon}
                label={
                  section !== 'my-apps'
                    ? formatMessage(messages.exampleReadonly)
                    : formatMessage(messages.addFileButton)
                }
                hideTooltip={isOpen}
              />
            )}
            onAction={(key): void => {
              key === 'create-file'
                ? fileTreeRef.current?.handleFileCreate()
                : key === 'create-folder'
                ? fileTreeRef.current?.handleFolderCreate()
                : fileTreeRef.current?.handleResourceImport({
                    isFolder: key === 'import-folder',
                  });
            }}
            onOpen={(isOpen): void => {
              if (isCollapsed && isOpen) {
                toggleCollapsed();
              }
            }}
            classes={{
              dropdownMenu: styles['action-menu'],
              dropdownMenuItem: styles['action-menu-item'],
              dropdownMenuButtonWrapper: styles['action-button-wrapper'],
            }}
            disabled={section !== 'my-apps'}
          />
          <IconButton
            classes={{
              container: styles['sidebar-toggle-button'],
            }}
            size={ButtonSize.XSmall}
            variant={ButtonVariant.Tertiary}
            appearance={ButtonAppearance.LowContrast}
            Icon={SidebarIcon}
            label={formatMessage(
              isCollapsed ? messages.sidebarExpand : messages.sidebarCollapse,
            )}
            onClick={toggleCollapsed}
          />
        </div>
        {!isCollapsed && (
          <>
            <div className={styles['app-bricks']}>
              <button
                onClick={(): void => {
                  setCollapseBricks((prev) => !prev);
                }}
                className={clsx(
                  styles['header-button'],
                  collapseBricks && styles['collapsed'],
                )}
              >
                <span className={styles['header-button-label']}>
                  {formatMessage(messages.bricksLabel)}
                </span>
                <CaretDownIcon className={styles['header-button-icon']} />
              </button>
              {!collapseBricks && (
                <>
                  {appBricks && appBricks.length > 0 && (
                    <div className={styles['app-list']}>
                      {appBricks.map((brick) => (
                        <BrickItem
                          key={brick.id}
                          brick={brick}
                          selected={brick.id === selectedFile?.fileId}
                          onClick={(): void =>
                            setSelectedFile(brick.id ?? '', true)
                          }
                          onDoubleClick={(): void =>
                            setSelectedFile(brick.id ?? '')
                          }
                          onDelete={
                            section === 'my-apps'
                              ? (): void => openDeleteAppBrickDialog(brick)
                              : undefined
                          }
                          onRename={
                            section === 'my-apps' && brick.author === 'App'
                              ? (): void => openRenameAppBrickDialog(brick)
                              : undefined
                          }
                          onAddBrick={
                            section === 'my-apps'
                              ? (): void => openAddAppBrickDialog()
                              : undefined
                          }
                          onDragStart={onBrickDragStart}
                          onDragEnd={onBrickDragEnd}
                          missingConfig={brick.status === 'not_found'}
                        />
                      ))}
                    </div>
                  )}
                  {appBricks && !appBricks.length && (
                    <XXSmall className={styles['app-empty']} truncate>
                      {formatMessage(messages.noBricksAddedYet)}
                    </XXSmall>
                  )}
                </>
              )}
            </div>

            <div className={styles['app-libraries']}>
              <button
                onClick={(): void => {
                  setCollapseLibraries((prev) => !prev);
                }}
                className={clsx(
                  styles['header-button'],
                  collapseLibraries && styles['collapsed'],
                )}
              >
                <span className={styles['header-button-label']}>
                  {formatMessage(messages.sketchLibrariesLabel)}
                </span>
                <CaretDownIcon className={styles['header-button-icon']} />
              </button>
              {!collapseLibraries && (
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
                                  deleteSketchLibrary(
                                    `${lib.id}@${lib.version}`,
                                  )
                              : undefined
                          }
                          onAddLibrary={
                            section === 'my-apps'
                              ? (): void => openAddSketchLibraryDialog()
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  )}
                  {(!appLibraries || !appLibraries.length) && (
                    <XXSmall className={styles['app-empty']} truncate>
                      {formatMessage(messages.noSketchLibrariesAddedYet)}
                    </XXSmall>
                  )}
                </>
              )}
            </div>

            <div className={styles['app-files']}>
              <button
                onClick={(): void => {
                  setCollapseFiles((prev) => !prev);
                }}
                className={clsx(
                  styles['header-button'],
                  collapseFiles && styles['collapsed'],
                )}
              >
                <span className={styles['header-button-label']}>
                  {formatMessage(messages.filesLabel)}
                </span>
                <CaretDownIcon className={styles['header-button-icon']} />
              </button>

              {!collapseFiles && !isCollapsed && (
                <div ref={ref} className={styles['app-list']}>
                  <div ref={fileTreeContainerRef}>
                    <FileTree
                      ref={fileTreeRef}
                      height={height}
                      nodes={files}
                      selectedNode={selectedNode}
                      selectedFolder={selectedFolder}
                      selectedFileChange={setSelectedFile}
                      onFolderSelect={setSelectedFolder}
                      defaultOpenFoldersState={defaultOpenFoldersState}
                      onFileCreate={addFileHandler}
                      onFileRename={handleFileRename}
                      onFileDelete={deleteFileHandler}
                      onFileMove={moveFileHandler}
                      onFolderCreate={addFolderHandler}
                      onResourceImport={openImportFileDialog}
                      isReadOnly={section !== 'my-apps'}
                      isBricksSelected={selectedFile?.fileExtension === 'brick'}
                      renderNodeIcon={renderIcon}
                      openFiles={openFiles}
                      updateOpenFile={updateOpenFile}
                      onDuplicateConflict={onDuplicateConflict}
                      duplicateFileDialogLogic={duplicateFileDialogLogic}
                      onAddBrick={openAddAppBrickDialog}
                      onAddSketchLibrary={openAddSketchLibraryDialog}
                      onFileDragStart={onFileDragStart}
                      onMoveBlocked={onMoveBlocked}
                      onDragOverFolderChange={onDragOverFolderChange}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {duplicateFileDialogLogic && (
        <DuplicateFileDialog logic={duplicateFileDialogLogic} />
      )}
    </>
  );
};
