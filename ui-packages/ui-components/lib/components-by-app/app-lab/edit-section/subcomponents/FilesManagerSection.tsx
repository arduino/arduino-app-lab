import {
  AddBrick as AddBrickIcon,
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
  BRICK_FILE_EXTENSION,
  BrickItem,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
  DeleteAppBrickDialog,
  DropdownMenuButton,
  DuplicateFileDialog,
  FileTree,
  FileTreeApi,
  IconButton,
  ImportResourceDialog,
  LibraryItem,
  useI18n,
  XXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import * as ContextMenu from '@radix-ui/react-context-menu';
import clsx from 'clsx';
import { useCallback, useRef, useState } from 'react';
import { useMeasure } from 'react-use';

import { CustomBrickDialog } from '../../../../dialogs/app-lab/add-app-brick-dialog/sub-components/CustomBrickDialog';
import styles from '../app-lab-edit-section.module.scss';
import { useAppFilesSectionLogic } from '../appFiles';
import { FilesManagerSectionLogic } from '../appLabEditSection.type';
import { messages } from '../messages';
import {
  AddSketchLibraryButton,
  AddSketchLibraryPopover,
} from './AddSketchLibraryButton';
import { FilesManagerContextMenu } from './FilesManagerContextMenu';

// File names, shown as they are on disk.
const SKETCH_FILE_NAMES = ['sketch.ino', 'sketch.yaml'];

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
    onFolderExpand,
    checkPathConflict,
    closeFolder,
    renamedFolder,
    sendAppLabNotification,
    hasSketch,
    boardOffline,
    boardType,
    addSketch,
    openNetworkSettings,
  } = logic();

  const isRelease = app?.release === true;
  const isReadOnly = isRelease || section !== 'my-apps';
  const readOnlyMessage = isRelease
    ? messages.releaseReadonly
    : messages.exampleReadonly;
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

  const canAddSketchLibrary =
    !isReadOnly && hasSketch === true && !boardOffline;

  // No sketch takes priority: creating one needs no internet.
  const addSketchLibraryPopover: AddSketchLibraryPopover | undefined =
    isReadOnly
      ? undefined
      : hasSketch === false
      ? {
          text: formatMessage(messages.noSketchPopoverText),
          listItems: SKETCH_FILE_NAMES,
          actionLabel: formatMessage(messages.addSketchFolderButton),
          onAction: addSketch,
        }
      : hasSketch === true && boardOffline
      ? {
          text: formatMessage(messages.offlinePopoverText, {
            boardType:
              boardType || formatMessage(messages.offlinePopoverBoardFallback),
          }),
          actionLabel: formatMessage(messages.offlinePopoverConnectButton),
          onAction: openNetworkSettings,
        }
      : undefined;

  const fileTreeRef = useRef<FileTreeApi>(null);
  const fileTreeContainerRef = useRef<HTMLDivElement>(null);

  const {
    addAppBrickDialogLogic,
    openAddAppBrickDialog,
    openCreateAppBrickDialog,
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
    sendAppLabNotification,
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
              isReadOnly
                ? formatMessage(readOnlyMessage)
                : formatMessage(messages.addBrickButton)
            }
            onClick={openAddAppBrickDialog}
            disabled={isReadOnly}
          />

          <AddSketchLibraryButton
            label={
              isReadOnly
                ? formatMessage(readOnlyMessage)
                : formatMessage(messages.addSketchLibraryButton)
            }
            onClick={openAddSketchLibraryDialog}
            disabled={isReadOnly}
            // Unknown while the sketch listing loads or failed.
            unavailable={!isReadOnly && hasSketch === undefined}
            popover={addSketchLibraryPopover}
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
                  isReadOnly
                    ? formatMessage(readOnlyMessage)
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
            // The sidebar lives in a resizable panel that clips its content and
            // caps its stacking order, so the menu must be portaled out of it.
            useStaticPosition={false}
            usePortal
            disabled={isReadOnly}
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
                <XXSmall semibold className={styles['header-button-label']}>
                  {formatMessage(messages.bricksLabel)}
                </XXSmall>
                <CaretDownIcon className={styles['header-button-icon']} />
              </button>
              {!collapseBricks && (
                <ContextMenu.Root>
                  <ContextMenu.Trigger
                    asChild
                    onContextMenu={(e): false | void =>
                      isReadOnly && e.preventDefault()
                    } // disable native context menu
                    disabled={isReadOnly}
                  >
                    <div>
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
                                !isReadOnly
                                  ? (): void => openDeleteAppBrickDialog(brick)
                                  : undefined
                              }
                              onRename={
                                !isReadOnly && brick.author === 'App'
                                  ? (): void => openRenameAppBrickDialog(brick)
                                  : undefined
                              }
                              onAddBrick={
                                !isReadOnly
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
                    </div>
                  </ContextMenu.Trigger>
                  <FilesManagerContextMenu onAddBrick={openAddAppBrickDialog} />
                </ContextMenu.Root>
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
                <XXSmall semibold className={styles['header-button-label']}>
                  {formatMessage(messages.sketchLibrariesLabel)}
                </XXSmall>
                <CaretDownIcon className={styles['header-button-icon']} />
              </button>
              {!collapseLibraries && (
                <ContextMenu.Root>
                  <ContextMenu.Trigger
                    asChild
                    onContextMenu={(e): false | void =>
                      !canAddSketchLibrary && e.preventDefault()
                    } // disable native context menu
                    disabled={!canAddSketchLibrary}
                  >
                    <div>
                      {appLibraries && appLibraries.length > 0 && (
                        <div className={styles['app-list']}>
                          {appLibraries.map((lib) => (
                            <LibraryItem
                              key={lib.id}
                              name={lib.id}
                              version={lib.version}
                              onDelete={
                                !isReadOnly
                                  ? (): Promise<void> =>
                                      deleteSketchLibrary(
                                        `${lib.id}@${lib.version}`,
                                      )
                                  : undefined
                              }
                              onAddLibrary={
                                !isReadOnly
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
                    </div>
                  </ContextMenu.Trigger>
                  <FilesManagerContextMenu
                    onAddSketchLibrary={openAddSketchLibraryDialog}
                  />
                </ContextMenu.Root>
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
                <XXSmall semibold className={styles['header-button-label']}>
                  {formatMessage(messages.filesLabel)}
                </XXSmall>
                <CaretDownIcon className={styles['header-button-icon']} />
              </button>

              {!collapseFiles && !isCollapsed && (
                <div ref={ref} className={styles['app-list']}>
                  <div ref={fileTreeContainerRef}>
                    <FileTree
                      ref={fileTreeRef}
                      height={height}
                      nodes={fileTree}
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
                      isReadOnly={isReadOnly}
                      isBricksSelected={
                        selectedFile?.fileExtension === BRICK_FILE_EXTENSION
                      }
                      renderNodeIcon={renderIcon}
                      openFiles={openFiles}
                      updateOpenFile={updateOpenFile}
                      onDuplicateConflict={onDuplicateConflict}
                      duplicateFileDialogLogic={duplicateFileDialogLogic}
                      onAddBrick={openAddAppBrickDialog}
                      onCreateBrick={openCreateAppBrickDialog}
                      onAddSketch={hasSketch === false ? addSketch : undefined}
                      onAddSketchLibrary={
                        canAddSketchLibrary
                          ? openAddSketchLibraryDialog
                          : undefined
                      }
                      onFileDragStart={onFileDragStart}
                      onMoveBlocked={onMoveBlocked}
                      onDragOverFolderChange={onDragOverFolderChange}
                      onFolderExpand={onFolderExpand}
                      checkPathConflict={checkPathConflict}
                      closeFolder={closeFolder}
                      renamedFolder={renamedFolder}
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
