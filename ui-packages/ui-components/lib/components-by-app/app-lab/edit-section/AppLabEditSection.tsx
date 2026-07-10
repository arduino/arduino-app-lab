import { ArduinoLogo } from '@cloud-editor-mono/images/assets/icons';
import type { BrickInstance } from '@cloud-editor-mono/infrastructure';
import {
  AppLabEditorPanel,
  isFileNode,
  MultipleConsolePanel,
  WorkspaceLayout,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { TreeNode } from '../../../file-tree';
import styles from './app-lab-edit-section.module.scss';
import {
  AppLabEditSectionLogic,
  FilesManagerSectionLogic,
} from './appLabEditSection.type';
import FileTreeDropOverlay from './FileTreeDropOverlay';
import { GlobalDragPreview } from './GlobalDragPreview';
import { FilesManagerSection } from './subcomponents/FilesManagerSection';

interface AppEditSectionProps {
  appLabEditSectionLogic: AppLabEditSectionLogic;
}

const AppFilesSection: React.FC<AppEditSectionProps> = (
  props: AppEditSectionProps,
) => {
  const { appLabEditSectionLogic } = props;
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
    addAppBrick,
    deleteAppBrick,
    updateAppBrick,
    addAppCustomBrick,
    addFileHandler,
    renameFileHandler,
    deleteFileHandler,
    moveFileHandler,
    addSketchLibraryDialogLogic,
    openAddSketchLibraryDialog,
    deleteSketchLibrary,
    addFolderHandler,
    multipleConsolePanelLogic,
    renderIcon,
    appLabEditorPanelLogic,
    brickDetailLogic,
    configureAppBrickDialogLogic,
    updateOpenFile,
    renameAppCustomBrick,
    onDuplicateConflict,
    duplicateFileDialogLogic,
    importFileDialogLogic,
    openImportFileDialog,
    onMoveBlocked,
    onDragOverFolderChange,
  } = appLabEditSectionLogic();

  const draggingFileNodesRef = useRef<TreeNode[] | null>(null);
  const onFileDragStart = useCallback((nodes: TreeNode[]): void => {
    draggingFileNodesRef.current = nodes;
  }, []);

  const draggingBrickRef = useRef<BrickInstance | null>(null);
  const onBrickDragStart = useCallback((brick: BrickInstance): void => {
    draggingBrickRef.current = brick;
  }, []);
  const onBrickDragEnd = useCallback((): void => {
    draggingBrickRef.current = null;
  }, []);

  // REFACTOR: should split this in different logics
  const filesManagerSectionLogic = useCallback<FilesManagerSectionLogic>(
    () => ({
      app,
      appBricks,
      bricks,
      appLibraries,
      section,
      fileTree,
      selectedFile,
      selectedNode,
      selectedFolder,
      draggingFileNodesRef,
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
    }),
    [
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
    ],
  );

  const [isDragOver, setIsDragOver] = useState(false);
  const [dragPreview, setDragPreview] = useState<{
    nodes: TreeNode[];
    x: number;
    y: number;
  } | null>(null);
  const dragOverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [dragPointer, setDragPointer] = useState<{
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const clearPreview = (): void => {
      draggingFileNodesRef.current = null;
      setDragPreview(null);
    };

    const handleDragOver = (e: DragEvent): void => {
      const nodes = draggingFileNodesRef.current;
      if (!nodes || nodes.length === 0) return;
      setDragPreview({ nodes, x: e.clientX, y: e.clientY });
      if (dragOverTimerRef.current) clearTimeout(dragOverTimerRef.current);
      dragOverTimerRef.current = setTimeout(clearPreview, 150);
    };

    const handleDragEnd = (): void => {
      if (dragOverTimerRef.current) clearTimeout(dragOverTimerRef.current);
      clearPreview();
      draggingBrickRef.current = null;
      setDragPointer(null);
      setIsDragOver(false);
    };

    document.addEventListener('dragover', handleDragOver, true);
    document.addEventListener('dragend', handleDragEnd, true);

    return () => {
      document.removeEventListener('dragover', handleDragOver, true);
      document.removeEventListener('dragend', handleDragEnd, true);
      if (dragOverTimerRef.current) clearTimeout(dragOverTimerRef.current);
    };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent): void => {
    if (draggingFileNodesRef.current || draggingBrickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
      setDragPointer({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragPointer(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent): void => {
      setIsDragOver(false);
      setDragPointer(null);
      const nodes = draggingFileNodesRef.current;
      const brick = draggingBrickRef.current;
      draggingFileNodesRef.current = null;
      draggingBrickRef.current = null;
      if ((!nodes || nodes.length === 0) && !brick) return;
      e.preventDefault();
      e.stopPropagation();

      // Decide the target pane once for the whole drop so multi-file and
      // folder drops land together.
      const editorEl = e.currentTarget as HTMLElement;
      const rightPaneEl = editorEl.querySelector<HTMLElement>('#split-right');
      let targetPane: 'A' | 'B' = 'A';
      if (rightPaneEl) {
        if (e.clientX >= rightPaneEl.getBoundingClientRect().left) {
          targetPane = 'B';
        }
      } else {
        const rect = editorEl.getBoundingClientRect();
        // Must match FileTreeDropOverlay's CREATE_B_THRESHOLD.
        if (e.clientX - rect.left > rect.width * 0.7) {
          targetPane = 'B';
        }
      }

      if (brick) {
        setSelectedFile(brick.id, false, targetPane);
        return;
      }

      if (!nodes) return;
      nodes.forEach((node) => {
        if (isFileNode(node)) {
          setSelectedFile(node, false, targetPane);
        } else {
          const getAllFilesInFolder = (folderNode: TreeNode): TreeNode[] => {
            const files: TreeNode[] = [];
            const traverse = (n: TreeNode): void => {
              if (isFileNode(n)) {
                files.push(n);
              } else if (n.children) {
                n.children.forEach(traverse);
              }
            };
            traverse(folderNode);
            return files;
          };

          getAllFilesInFolder(node).forEach((file) => {
            setSelectedFile(file, false, targetPane);
          });
        }
      });
    },
    [setSelectedFile],
  );

  const editorHasOpenFile =
    (selectedNode && isFileNode(selectedNode)) ||
    selectedFile?.fileExtension === 'brick';

  return (
    <>
      <WorkspaceLayout
        appId={app?.id}
        sideContent={(api): React.ReactNode => (
          <FilesManagerSection
            isCollapsed={api.isCollapsed}
            toggleCollapsed={api.toggleCollapsed}
            logic={filesManagerSectionLogic}
          />
        )}
        editorContent={
          <div
            ref={editorRef}
            className={styles['editor']}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {editorHasOpenFile ? (
              <AppLabEditorPanel appLabEditorLogic={appLabEditorPanelLogic} />
            ) : (
              <div
                className={clsx(styles['empty-editor'], {
                  [styles['empty-editor--drag-over']]: isDragOver,
                })}
              >
                <ArduinoLogo />
              </div>
            )}
            {editorHasOpenFile && isDragOver && dragPointer && (
              <FileTreeDropOverlay
                containerRef={editorRef}
                pointer={dragPointer}
              />
            )}
          </div>
        }
        consoleContent={(api): React.ReactNode => (
          <MultipleConsolePanel
            multipleConsolePanelLogic={multipleConsolePanelLogic}
            isCollapsed={api.isCollapsed}
            toggleCollapse={api.toggleCollapsed}
            isMaximized={api.isMaximized}
            onMaximize={api.toggleMaximize}
            onMinimize={api.toggleMaximize}
          />
        )}
      />
      {dragPreview && (
        <GlobalDragPreview
          nodes={dragPreview.nodes}
          x={dragPreview.x}
          y={dragPreview.y}
          renderIcon={renderIcon}
        />
      )}
    </>
  );
};

export default AppFilesSection;
